# Refresh Progress & Concurrency — Design Spec

**Date:** 2026-05-21
**Status:** Approved — ready for planning
**Workstream:** A of 4 (refresh progress → value-over-time chart → browse performance → small-items batch)

## Summary

A price refresh re-estimates every owned `(game, condition)` pair against the
eBay Browse API. Today that runs as a single blocking `POST /api/refresh`:
the loop is **serial** (one eBay round-trip at a time) and the request
returns nothing until the whole run finishes, so a refresh over dozens of
items is a multi-minute spinner with no feedback. `refreshEstimates` already
calls an `onProgress(done, total)` hook on every pair, but the endpoint
passes a no-op for it.

This workstream makes the refresh **fast** (bounded-concurrency network
calls) and **visible** (a streamed progress bar naming the game currently
being priced). It changes the refresh loop, the refresh endpoint, and the
Settings UI. It does not change what an estimate *is* or how it is computed.

## Goals

- **Visible progress.** A progress bar with `done / total` and the game
  currently being looked up, updating live as the refresh runs.
- **Faster refreshes.** Overlap the network round-trips instead of running
  them strictly one at a time.
- **No behavior regression.** `RefreshResult`, the abort-on-fatal rule, the
  persisted `error_summary`, snapshots, and the manual-price skip all keep
  working exactly as they do now.
- **No new infrastructure.** No background-job system, no server-side job
  state, no extra endpoints — the refresh stays a single request.

## Non-Goals

- **Surviving navigation.** The refresh is tied to its HTTP request. If the
  user navigates away from Settings mid-run, the `fetch` is cancelled and
  the refresh stops. A partial refresh is harmless — estimates already
  written stand, and re-running completes the rest. Decoupling the refresh
  from the request (a background job) is deliberately out of scope.
- **Configurable concurrency.** The concurrency limit is a fixed constant,
  not a user setting.
- **Per-pair retry / backoff.** Unchanged from today: a fatal error aborts,
  a non-fatal one is counted. No retry logic is added.
- **eBay quota accounting.** Not in scope.

## Background: current shape

- `src/lib/sources/refresh.ts` — `refreshEstimates(db, { search, onProgress })`
  walks `pairsToRefresh(db)` in a serial `for` loop, `await`ing `estimatePair`
  for each. `onProgress(i + 1, pairs.length)` is called per pair. A fatal
  (`auth` / `rate_limit`) error sets `aborted` and `break`s. Returns
  `RefreshResult` (`itemsUpdated`, `errors`, `errorsByReason`, `aborted`,
  `refreshEventId`).
- `src/routes/api/refresh/+server.ts` — `POST` calls
  `refreshEstimates(db, { search: ebaySearch(), onProgress: () => {} })` and
  returns `json(result)` once the whole run completes.
- `src/routes/settings/+page.svelte` — `runRefresh()` POSTs `/api/refresh`,
  `await`s the single JSON response, then shows a categorized message or
  reloads.

## Design

### 1. Streaming protocol

`POST /api/refresh` responds with a **streamed `application/x-ndjson`
body** — newline-delimited JSON, one object per line:

| Line | Shape | When |
|---|---|---|
| progress | `{"type":"progress","done":N,"total":M,"current":"<game title>"}` | as each pair is picked up by a worker |
| result | `{"type":"result","itemsUpdated":…,"errors":…,"errorsByReason":{…},"aborted":…,"refreshEventId":…}` | once, as the final line |

The credentials-missing case is caught **before** the stream opens: if
`EBAY_APP_ID` / `EBAY_CLIENT_SECRET` are unset, the endpoint returns a normal
`400` JSON error (`{ message }`) exactly as today — the client's existing
error path handles it unchanged.

NDJSON over the honest POST is used rather than Server-Sent Events because
`EventSource` issues GET only, and a refresh mutates (it writes estimates and
a refresh event). Streaming a plain NDJSON body over the POST keeps the verb
honest and needs no `EventSource`-style reconnect machinery.

### 2. Concurrency model

`refreshEstimates` replaces its serial `for` loop with a **bounded worker
pool**:

- A fixed concurrency limit of **5**. Polite to eBay's free tier; no config
  surface.
- Five workers pull `(game, condition)` pairs from a shared queue. Each
  worker: claim the next pair, report progress, `await estimatePair`, record
  the snapshot / `itemsUpdated` exactly as the serial loop does, repeat.
- Only the network `search` call overlaps. `better-sqlite3` is synchronous,
  so all DB reads/writes (`getEstimate`, `upsertEstimate`, `insertSnapshot`)
  run to completion without interleaving — there is no DB race even though
  fetches are concurrent.
- The shared accumulators (`itemsUpdated`, `errorsByReason`) are mutated only
  in synchronous stretches between `await`s, so no atomicity primitive is
  needed.

`pairsToRefresh` is extended to **join `games`** so each queued pair carries
its `title`. This lets a progress tick name the game with no extra query.

### 3. Abort under concurrency

When any worker's pair fails with a fatal reason (`auth` / `rate_limit`,
classified by the existing `classifyError`):

- An `aborted` flag is set.
- Workers check the flag **before claiming the next pair** and stop.
- Pairs already in flight finish naturally; their results count normally.
- Pairs never claimed are simply left with their existing estimates.

`RefreshResult` keeps its exact current shape. "Abort" now means "stop
dispatching new pairs" rather than "stop at index i".

**Consequence — the fatal-reason count can exceed 1.** In the serial loop a
fatal error aborted immediately, so `errorsByReason.rate_limit` (or `.auth`)
was always exactly 1. Under concurrency, a whole in-flight wave of up to 5
calls can fail with the same fatal reason before the flag short-circuits the
rest, so the count can be up to the concurrency limit. The persisted
`error_summary` reflects this honestly (e.g. `rate_limit×5 (aborted)`) — it
is accurate, not a bug.

### 4. `onProgress` signature

`onProgress` widens from `(done: number, total: number)` to a single object
argument:

```ts
export interface RefreshProgress {
  done: number;     // pairs completed so far
  total: number;    // total pairs to refresh
  current: string;  // title of the game just picked up
}
export type OnProgress = (p: RefreshProgress) => void;
```

A worker calls `onProgress` when it **claims** a pair (so `current` names a
game whose lookup just started). `done` is incremented as pairs **complete**.
Under concurrency `current` flickers among the ~5 in-flight games — this was
accepted as "approximate" during design.

### 5. Endpoint structure

A new `src/routes/api/refresh/logic.ts` holds the testable core, matching the
project's existing `logic.ts` convention (`api/collection/logic.ts`,
`api/sync/logic.ts`):

```ts
/** Run a refresh and stream its progress + result as NDJSON bytes. */
export function refreshStream(db: DB, search: SearchFn): ReadableStream<Uint8Array>;
```

`refreshStream` builds a `ReadableStream` whose `start` runs
`refreshEstimates(db, { search, onProgress })` with an `onProgress` that
enqueues an encoded `progress` line, then enqueues the `result` line, then
closes the stream.

`+server.ts` stays thin:

```ts
export const POST = async () => {
  let search: SearchFn;
  try {
    search = ebaySearch();           // throws if credentials are missing
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'refresh failed');
  }
  return new Response(refreshStream(db, search), {
    headers: { 'content-type': 'application/x-ndjson' }
  });
};
```

### 6. Client — `runRefresh` in `settings/+page.svelte`

- POST `/api/refresh`; if the response is not OK, parse the JSON error and
  show it (existing path).
- Otherwise read `response.body` with a stream reader: decode chunks,
  accumulate a buffer, split on `\n`, `JSON.parse` each complete line.
- A new state `refreshProgress: RefreshProgress | null`:
  - each `progress` line sets it;
  - the `result` line clears it (`null`) and hands the `RefreshResult` to the
    existing `refreshMessage` / clean-run-reloads-vs-aborted-stays logic,
    completely unchanged.
- While `refreshProgress` is non-null, render below the Refresh button:
  - a thin progress bar — a track div with a filled inner div whose width is
    `done / total` as a percentage;
  - a line: *"Pricing {current}… — {done} / {total}"*.
- The Refresh button stays disabled (`refreshing`) for the whole run.

### Module responsibilities

- `refresh.ts` — orchestration: the worker pool, abort, progress callback,
  snapshot/tally bookkeeping. No HTTP, no streaming.
- `api/refresh/logic.ts` — adapts `refreshEstimates` into an NDJSON byte
  stream. No business logic.
- `api/refresh/+server.ts` — credential check + `Response` wiring only.
- `settings/+page.svelte` — reads the stream, drives the progress UI, reuses
  the existing result-message logic.

## Testing

All tests use fakes — no live eBay calls (project rule CVT-T1). Async tests
use deterministic synchronization, never sleeps (CVT-T2).

- **`refresh.test.ts`** — existing tests adapted to the widened `onProgress`
  object. New: concurrency does not corrupt `itemsUpdated` / `errorsByReason`
  / snapshots; `onProgress` reports `current`; abort under concurrency stops
  dispatching un-claimed pairs. Concurrency and abort tests use **controlled
  fake `search` functions** — promises resolved/rejected explicitly by the
  test, so ordering is deterministic. The abort test uses more pairs than the
  concurrency limit and asserts `search` was called no more than the limit
  (later pairs never dispatched), `aborted` is true, and the tallies are
  exact. If an assertion races, the fix is a deterministic fence in the fake
  — never weakening the assertion.
- **`api/refresh/logic.test.ts`** (new) — `refreshStream` against a test DB
  and a fake search: drain the whole stream, decode, split into lines, assert
  one or more `progress` lines followed by exactly one `result` line whose
  payload matches the `RefreshResult`.
- **`settings/page.test.ts`** — a test that the progress bar and the
  *"Pricing …"* line render when `refreshProgress` is populated; existing
  settings tests stay green.

Test output must stay pristine: a thrown `EbayError` in a concurrency test is
caught inside `refreshEstimates`, so it must not surface as stderr.

## File-level change list

| File | Change |
|---|---|
| `src/lib/sources/refresh.ts` | Worker-pool loop; `RefreshProgress` / `OnProgress` types; widened `onProgress`; `pairsToRefresh` joins `games` for `title` |
| `src/routes/api/refresh/logic.ts` | **New** — `refreshStream` |
| `src/routes/api/refresh/+server.ts` | Credential check, then return the streamed `Response` |
| `src/routes/settings/+page.svelte` | Stream-reading `runRefresh`; `refreshProgress` state; progress-bar markup |
| `src/lib/sources/refresh.test.ts` | Adapted + new concurrency/abort/progress tests |
| `src/routes/api/refresh/logic.test.ts` | **New** — stream test |
| `src/routes/settings/page.test.ts` | Progress-bar render test |

Note: `pairsToRefresh` currently lives in `refresh.ts` as a private function;
it stays there, just gains a join. The `RefreshResult` shape, `estimatePair`,
`classifyError`, `summarizeErrors`, and `updateRefreshEvent` are unchanged.

## Verification

- `npm run check` clean; full `vitest` suite green.
- A real refresh (with eBay credentials configured) shows a moving progress
  bar and completes faster than the serial version.
