# Refresh Progress & Concurrency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a price refresh fast (bounded-concurrency eBay calls) and visible (a streamed progress bar naming the game being priced).

**Architecture:** `refreshEstimates` becomes a bounded worker pool (concurrency 5) and reports an `{done,total,current}` progress object per claimed pair. A new `refreshStream` adapts it into an NDJSON byte stream; `POST /api/refresh` returns that stream; the Settings page reads it incrementally and renders a progress bar.

**Tech Stack:** SvelteKit 2 / Svelte 5, TypeScript, better-sqlite3 + Drizzle ORM, Vitest 4, `@testing-library/svelte`, Web Streams (`ReadableStream`).

## Living Document Contract

This plan is a living document. Every executing agent MUST update it as
execution progresses, not only at completion.

- **On phase claim:** the executor MUST flip the banner to 🚧 IN PROGRESS
  with a claim timestamp (ISO 8601 UTC) and the active branch name. The
  banner MUST NOT include an expected-completion estimate — agents cannot
  reliably estimate their own wall-clock, and a fabricated duration
  becomes a stale anchor that misleads future readers. Followers
  encountering a 🚧 banner determine liveness by observable signals (PR
  existence, recent branch commits), not by arithmetic on expected times.
  See Step 5's stale-claim reclaim protocol.
- **On phase ship:** the executor MUST update that phase's **Execution
  Status** banner with the shipped commit SHA(s) and date. If a PR is
  open, the PR number and URL MUST appear in the top-of-plan Execution
  Status table.
- **On phase defer:** the executor MUST update the banner with ⏸ status
  AND a prose description of the unblock condition + a link to the
  likely-unblocker artifact (plan page, task, or PR whose own Execution
  Status banner will signal completion). Prose + link is durable across
  paraphrases and scope edits; exact-string coordination between agents
  is not.
- **On PR merge:** the executor MUST record the merge SHA in the banner
  + the top-of-plan Execution Status table.
- **On deviation from the written plan** (scope edits, structural
  refactors, dropped tasks, reordered phases): the executor MUST
  inline-document the deviation in the affected task AND summarize it
  in the top-of-plan Execution Status as a "Deviations" subsection.
  Deviation state MUST NOT live only in PR notes or status reports.
- **On discovery** (pre-existing drift surfaced during execution, new
  bugs found, architectural issues noted): the executor MUST add a
  "Discoveries" subsection at the top of the plan with pointers to the
  files/lines affected. Follow-up dispatches read this subsection to
  avoid duplicate discovery work.

The plan SHOULD reflect reality at the end of every session that touches
it. Anything worth putting in a status report to the user is worth
putting in the plan.

Rationale: `/writing-plans-enhanced` Step 5. Writing at ship time is
cheap; reconstruction by downstream readers is expensive, compounds
across dispatches, and fails silently when state is split across PR
notes and commit messages.

## Execution Status

**Overall:** Task 1 shipped.

| Phase | Status | Ship SHA(s) | Notes |
|---|---|---|---|
| 1 — Refresh Progress & Concurrency | 🚧 IN PROGRESS | Task 1: see below | Tasks 2–3 remaining |

---

## Source Spec

This plan implements `docs/superpowers/specs/2026-05-21-refresh-progress-and-concurrency-design.md`. Read it for rationale; this plan is the executable form.

## Task Discipline (applies to every task)

**§A — Before starting any task:** Invoke `superpowers:test-driven-development`. Read `docs/pitfalls/testing-pitfalls.md`. Follow TDD: write the failing test → run it, confirm it fails for the expected reason → minimum code to pass → run it, confirm green.

**§B — Before marking any task complete:** Review the new tests against `docs/pitfalls/testing-pitfalls.md`. Run `npx vitest run` (whole suite green) and `npm run check` (0 errors, 0 warnings). Confirm test output is pristine — no stray stderr, no debug prints.

**§C — Concurrency-test rigor (Task 1):** If a concurrency or abort test assertion races or flakes, the fix is **deterministic synchronization** (an explicitly resolved/rejected promise, an awaitable fence) — NEVER assertion removal or weakening. The fake `search` functions in concurrency tests must make ordering deterministic by construction. If a test cannot be made reliable without weakening it, STOP and escalate. A commit touching test assertions must say in its subject what happened to them.

**§D — Commit messages:** every `git commit` MUST end with the trailer via a second `-m`:
`git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"`

**Project pitfalls binding here:** CVT-1 (money stays integer cents — unaffected, but do not introduce a float into a price path); CVT-T1 (no live eBay calls in tests — all use `vi.fn` fakes); CVT-T2 (async tests use deterministic synchronization, never sleeps).

## Execution Setup

Create a feature branch before Task 1 — do NOT execute on `main`. Suggested name: `feat/refresh-progress`. Execute tasks in order (1 → 2 → 3). When done, use `superpowers:finishing-a-development-branch`.

---

## Phase 1 — Refresh Progress & Concurrency

**Execution Status:** 🚧 IN PROGRESS (2026-05-21T09:20:00Z) — branch `feat/refresh-progress`

### Task 1: Bounded-concurrency refresh with progress reporting

**Files:**
- Modify: `src/lib/sources/refresh.ts`
- Test: `src/lib/sources/refresh.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Context:** `refreshEstimates` (`src/lib/sources/refresh.ts:73-116`) runs a serial `for` loop, `await`ing one `estimatePair` at a time, and calls `opts.onProgress(pairsDone, total)`. This task replaces the loop with a bounded worker pool (concurrency 5) and widens `onProgress` to report `{done, total, current}` so the UI can name the game being priced. `pairsToRefresh` gains a `games` join so each pair carries its `title`.

**Why concurrency is safe:** only the network `search` call overlaps. `better-sqlite3` is synchronous — `getEstimate` / `upsertEstimate` / `insertSnapshot` run to completion without interleaving — so there is no DB race. The shared counters (`itemsUpdated`, `errorsByReason`, `done`, `next`) are mutated only in synchronous stretches between `await`s, so no atomicity primitive is needed.

**Do NOT:** do not add retry/backoff. Do not add `console.error`. Do not change `estimatePair`, `RefreshResult`, `summarizeErrors`, `createRefreshEvent`, or `updateRefreshEvent`. Do not make the concurrency limit configurable — it is a fixed constant.

**Other callers to keep working:** `estimatePair` is also called by `src/routes/api/collection/logic.ts` with a plain `{ gameId, condition }` object. This task must NOT widen the `Pair` interface (that would break that caller). `pairsToRefresh` returns a new internal type `RefreshPair` that extends `Pair` with `title` — `RefreshPair` is assignable to `Pair`, so `estimatePair(db, refreshPair, search)` still type-checks.

- [x] **Step 1: Update the failing tests**

In `src/lib/sources/refresh.test.ts`:

(a) The `describe('refreshEstimates', ...)` test named `'re-estimates every owned pair, snapshots them, and records the event'` currently collects progress as `number[]` via `onProgress: (d) => progress.push(d)` and asserts `progress.at(-1)).toBe(2)`. Under the widened `onProgress` and concurrency, `onProgress` receives a `RefreshProgress` object and is called once per pair *as it is claimed* (so `done` will not reach `total`). Replace that test with:

```ts
  it('re-estimates every owned pair, snapshots them, and records the event', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const search = vi.fn(async (q: string) => [
      { priceCents: 4000, title: q, conditionId: 3000 },
      { priceCents: 4200, title: q, conditionId: 3000 }
    ]); // → median 4100
    const progress: RefreshProgress[] = [];
    const result = await refreshEstimates(db, { search, onProgress: (p) => progress.push(p) });

    expect(result.itemsUpdated).toBe(2);
    expect(result.errors).toBe(0);
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(4100);
    expect(progress).toHaveLength(2); // one tick per pair claimed
    expect(progress.every((p) => p.total === 2)).toBe(true);
    expect(progress.map((p) => p.current).sort()).toEqual(['Chrono Trigger', 'GoldenEye']);
  });
```

Add `RefreshProgress` to the import from `./refresh` (the line that imports `estimatePair, refreshEstimates`):

```ts
import { estimatePair, refreshEstimates, type RefreshProgress } from './refresh';
```

(b) Add a `seedMany` helper near the existing `seed()` helper — it seeds N games (`id` 1..N, titled `Game 1`…`Game N`) so concurrency tests can exceed the pool size:

```ts
function seedMany(n: number) {
  const db = makeTestDb();
  upsertGames(
    db,
    Array.from({ length: n }, (_, i) => ({
      id: i + 1, console: 'GameCube', title: `Game ${i + 1}`, region: null, releaseYear: null
    }))
  );
  for (let i = 1; i <= n; i++) addItem(db, { gameId: i, condition: 'loose' });
  return db;
}
```

(c) **Replace** the two existing tests named `'aborts the whole run when a search hits a rate limit'` and `'aborts the whole run on an auth failure'`. Their current assertions (`errorsByReason.<reason>` is 1, `search` called once) are valid only for the old serial loop — under the worker pool, the whole first in-flight wave fails before the abort flag short-circuits the rest, so the count is the concurrency limit. Replace both with these concurrency-aware versions:

```ts
  it('stops dispatching new pairs once a rate limit aborts the run', async () => {
    const db = seedMany(12); // 12 pairs > concurrency 5
    const search = vi.fn(async () => {
      throw new EbayError(429, 'eBay search failed: 429');
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.aborted).toBe(true);
    expect(search).toHaveBeenCalledTimes(5); // exactly the first wave; 6–12 never claimed
    expect(result.errorsByReason.rate_limit).toBe(5);
    expect(getEstimate(db, 12, 'loose')).toBeUndefined(); // a later pair, untouched
  });

  it('stops dispatching new pairs once an auth failure aborts the run', async () => {
    const db = seedMany(12);
    const search = vi.fn(async () => {
      throw new EbayError(401, 'eBay search failed: 401');
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.aborted).toBe(true);
    expect(search).toHaveBeenCalledTimes(5);
    expect(result.errorsByReason.auth).toBe(5);
    expect(getEstimate(db, 12, 'loose')).toBeUndefined();
  });
```

Both are deterministic by construction: the 5 pool workers each synchronously claim a pair and call `search` before any promise settles, so `search` is called exactly 5 times; every settled rejection sets `aborted`, and on the next loop iteration `while (!aborted)` is false, so no worker claims a 6th pair.

(d) Add two more tests at the end of the `describe('refreshEstimates', ...)` block:

```ts
  it('estimates every pair correctly when there are more pairs than the concurrency limit', async () => {
    const db = seedMany(8); // 8 pairs > concurrency 5
    const search = vi.fn(async (q: string) => [{ priceCents: 1500, title: q, conditionId: 3000 }]);
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.itemsUpdated).toBe(8);
    expect(result.errors).toBe(0);
    expect(search).toHaveBeenCalledTimes(8);
    for (let i = 1; i <= 8; i++) expect(getEstimate(db, i, 'loose')?.estimate).toBe(1500);
  });

  it('reports the current game title on each progress tick', async () => {
    const db = seedMany(3);
    const search = vi.fn(async (q: string) => [{ priceCents: 1000, title: q, conditionId: 3000 }]);
    const progress: RefreshProgress[] = [];
    await refreshEstimates(db, { search, onProgress: (p) => progress.push(p) });
    expect(progress).toHaveLength(3);
    expect(progress.map((p) => p.current).sort()).toEqual(['Game 1', 'Game 2', 'Game 3']);
    expect(progress.every((p) => p.total === 3)).toBe(true);
  });
```

(e) Leave every other test in `refresh.test.ts` unchanged — the `estimatePair` tests, `'skips owned pairs whose item has a manual price'`, `'counts a non-fatal error and continues to the next pair'`, and `'persists an error summary for a failed run and null for a clean run'` all still hold under the worker pool (each involves ≤ 2 pairs or a deterministic per-call fake).

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/sources/refresh.test.ts`
Expected: FAIL — against the current serial `refreshEstimates`, the changed/new tests fail: the `'re-estimates'` test's `p.total` assertion (the serial `onProgress` passes a number, not an object), the two abort tests' `search`-called-5-times assertions (serial aborts after 1 call), and the progress test's `current` assertion. Note: `'estimates every pair correctly…'` may already pass against the serial code — serial also estimates all 8 pairs — which is fine; it is a regression guard for the concurrent version, not a behavior-driving test.

- [x] **Step 3: Rewrite `refresh.ts`**

In `src/lib/sources/refresh.ts`:

(a) The import on line 3 is `import { asc, isNull } from 'drizzle-orm';` — add `eq`:

```ts
import { asc, eq, isNull } from 'drizzle-orm';
```

(b) The import on line 5 is `import { collectionItems } from '$lib/db/schema';` — add `games`:

```ts
import { collectionItems, games } from '$lib/db/schema';
```

(c) Replace the `RefreshOptions` interface (lines 35-38) with the progress types and the widened options:

```ts
/** A single progress tick — emitted as each pair is picked up. */
export interface RefreshProgress {
  done: number;     // pairs completed so far
  total: number;    // total pairs to refresh
  current: string;  // title of the game just picked up
}

export type OnProgress = (p: RefreshProgress) => void;

export interface RefreshOptions {
  search: SearchFn;
  onProgress: OnProgress;
}

/** A pair to refresh, carrying the game title for progress reporting. */
interface RefreshPair extends Pair {
  title: string;
}
```

(d) Replace the whole `pairsToRefresh` function (located by name — its line number has shifted after edit (c); it includes a multi-line doc comment) with a version that joins `games` for the title:

```ts
/**
 * Owned (game, condition) pairs that have at least one item WITHOUT a manual
 * price — those are the pairs an eBay estimate is still useful for. A pair
 * is skipped only when every copy is manually priced. The `games` join
 * carries each pair's title for progress reporting.
 */
function pairsToRefresh(db: DB): RefreshPair[] {
  return db
    .selectDistinct({
      gameId: collectionItems.gameId,
      condition: collectionItems.condition,
      title: games.title
    })
    .from(collectionItems)
    .innerJoin(games, eq(games.id, collectionItems.gameId))
    .where(isNull(collectionItems.manualPrice))
    .orderBy(asc(collectionItems.gameId), asc(collectionItems.condition))
    .all();
}
```

(e) Replace the whole `refreshEstimates` function **and its preceding `/** Re-estimate… */` doc comment** (located by name — its line number has shifted after the earlier edits) with the block below. The block supplies its own doc comments — do not leave the old one behind:

```ts
/** How many eBay searches run concurrently during a refresh. */
const REFRESH_CONCURRENCY = 5;

/** Re-estimate every owned pair, snapshot changed estimates, record one refresh event. */
export async function refreshEstimates(db: DB, opts: RefreshOptions): Promise<RefreshResult> {
  const pairs = pairsToRefresh(db);
  const eventId = createRefreshEvent(db, { source: `ebay_browse:${new Date().toISOString()}`, itemsUpdated: 0, errors: 0 });

  let itemsUpdated = 0;
  const errorsByReason: Record<ErrorReason, number> = { auth: 0, rate_limit: 0, other: 0 };
  let aborted = false;
  let done = 0;
  let next = 0;

  async function worker(): Promise<void> {
    while (!aborted) {
      const index = next++;
      if (index >= pairs.length) return;
      const pair = pairs[index];
      opts.onProgress({ done, total: pairs.length, current: pair.title });
      try {
        const before = getEstimate(db, pair.gameId, pair.condition)?.estimate ?? null;
        await estimatePair(db, pair, opts.search);
        const after = getEstimate(db, pair.gameId, pair.condition);
        if (after && after.estimate !== null) {
          insertSnapshot(db, {
            gameId: pair.gameId,
            condition: pair.condition,
            estimate: after.estimate,
            listingCount: after.listingCount,
            refreshEventId: eventId
          });
          // A first-time estimate from null counts as a change.
          if (after.estimate !== before) itemsUpdated++;
        }
      } catch (e) {
        const reason = classifyError(e);
        errorsByReason[reason]++;
        // auth and rate_limit are fatal — stop claiming new pairs. In-flight
        // pairs finish; pairs never claimed keep their existing estimates.
        if (reason === 'auth' || reason === 'rate_limit') aborted = true;
      }
      done++;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(REFRESH_CONCURRENCY, pairs.length) }, () => worker())
  );

  const errors = errorsByReason.auth + errorsByReason.rate_limit + errorsByReason.other;
  updateRefreshEvent(db, eventId, { itemsUpdated, errors, errorSummary: summarizeErrors(errorsByReason, aborted) });
  return { itemsUpdated, errors, errorsByReason, aborted, refreshEventId: eventId };
}
```

Leave the ABOUTME header, `SearchFn`, `Pair`, `estimatePair`, `RefreshResult`, and `summarizeErrors` unchanged.

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/sources/refresh.test.ts`
Expected: PASS — all `estimatePair` and `refreshEstimates` tests, including the three new ones.

- [x] **Step 5: Run the full suite and type check**

Run: `npx vitest run` — Expected: PASS, whole suite (the existing `/api/refresh/+server.ts` still compiles: its `onProgress: () => {}` is assignable to the widened `OnProgress`).
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [x] **Step 6: Commit**

```
git add src/lib/sources/refresh.ts src/lib/sources/refresh.test.ts
git commit -m "Refresh estimates with bounded concurrency and progress ticks" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2: NDJSON streaming refresh endpoint

**Files:**
- Create: `src/routes/api/refresh/logic.ts`
- Create: `src/routes/api/refresh/logic.test.ts`
- Modify: `src/routes/api/refresh/+server.ts`

**Discipline:** Task Discipline §A, §B, §D.

**Depends on:** Task 1 (`RefreshProgress`, the widened `refreshEstimates`).

**Context:** `POST /api/refresh` currently runs `refreshEstimates` and returns one `json(result)` after the whole run. This task makes it stream: a new `refreshStream` runs `refreshEstimates` and emits NDJSON lines — one `{"type":"progress",...}` per progress tick, then one final `{"type":"result",...}` line. The endpoint returns that stream. `refreshStream` lives in `logic.ts` (the project's testable-core convention, as in `api/collection/logic.ts`); `+server.ts` stays thin wiring.

**Do NOT:** do not change `refresh.ts`. Do not add an error-line type to the protocol — credentials-missing is handled before the stream (a `400` JSON error), and a catastrophic mid-stream failure simply errors the stream, which the client's `try/catch` handles.

- [ ] **Step 1: Write the failing test**

Create `src/routes/api/refresh/logic.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem } from '$lib/db/queries/collection';
import { refreshStream } from './logic';

/** Read an entire NDJSON byte stream into parsed objects. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<Record<string, unknown>[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
  }
  return buf
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

describe('refreshStream', () => {
  it('streams progress lines then a single final result line', async () => {
    const db = makeTestDb();
    upsertGames(db, [
      { id: 1, console: 'GameCube', title: 'Pikmin', region: null, releaseYear: null },
      { id: 2, console: 'N64', title: 'GoldenEye', region: null, releaseYear: null }
    ]);
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const search = vi.fn(async (q: string) => [{ priceCents: 2500, title: q, conditionId: 3000 }]);

    const lines = await drain(refreshStream(db, search));

    const progress = lines.filter((l) => l.type === 'progress');
    const results = lines.filter((l) => l.type === 'result');
    expect(progress.length).toBeGreaterThanOrEqual(1);
    expect(results).toHaveLength(1);
    expect(progress[0]).toMatchObject({ total: 2 });
    expect(typeof progress[0].current).toBe('string');
    expect(results[0]).toMatchObject({ type: 'result', itemsUpdated: 2, errors: 0, aborted: false });
    expect(typeof results[0].refreshEventId).toBe('number');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/api/refresh/logic.test.ts`
Expected: FAIL — `Cannot find module './logic'`.

- [ ] **Step 3: Create `logic.ts`**

Create `src/routes/api/refresh/logic.ts`:

```ts
// ABOUTME: Adapts a price refresh into an NDJSON byte stream — one progress
// ABOUTME: line per pair, then a final result line.
import type { DB } from '$lib/db/client';
import { refreshEstimates, type SearchFn } from '$lib/sources/refresh';

const encoder = new TextEncoder();

/** Encode one value as an NDJSON line (JSON + newline) of UTF-8 bytes. */
function line(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value) + '\n');
}

/** Run a refresh and stream its progress ticks + final result as NDJSON. */
export function refreshStream(db: DB, search: SearchFn): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const result = await refreshEstimates(db, {
        search,
        onProgress: (p) => controller.enqueue(line({ type: 'progress', ...p }))
      });
      controller.enqueue(line({ type: 'result', ...result }));
      controller.close();
    }
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/routes/api/refresh/logic.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `+server.ts`**

Replace the entire contents of `src/routes/api/refresh/+server.ts` with:

```ts
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { ebaySearch } from '$lib/server/ebay';
import type { SearchFn } from '$lib/sources/refresh';
import { refreshStream } from './logic';

export const POST: RequestHandler = async () => {
  let search: SearchFn;
  try {
    search = ebaySearch(); // throws if eBay credentials are not configured
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'refresh failed');
  }
  return new Response(refreshStream(db, search), {
    headers: { 'content-type': 'application/x-ndjson' }
  });
};
```

(`+server.ts` is thin wiring — the streaming logic is `refreshStream`, covered by `logic.test.ts`; the only branch here is the credentials guard, which delegates to `ebaySearch`. No separate endpoint test is added.)

- [ ] **Step 6: Run the full suite and type check**

Run: `npx vitest run` — Expected: PASS.
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```
git add src/routes/api/refresh/logic.ts src/routes/api/refresh/logic.test.ts src/routes/api/refresh/+server.ts
git commit -m "Stream refresh progress from the refresh endpoint as NDJSON" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3: Progress bar in the Settings UI

**Files:**
- Create: `src/lib/components/RefreshProgressBar.svelte`
- Create: `src/lib/components/RefreshProgressBar.test.ts`
- Modify: `src/routes/settings/+page.svelte`
- Test: `src/routes/settings/page.test.ts`

**Discipline:** Task Discipline §A, §B, §D.

**Depends on:** Task 1 (`RefreshProgress`), Task 2 (the endpoint now streams NDJSON).

**Context:** `runRefresh` in `settings/+page.svelte` currently `await`s a single JSON response. This task rewrites it to read the NDJSON stream: each `progress` line updates a `refreshProgress` state; the `result` line clears it and feeds the existing `refreshMessage` / clean-run-reloads-vs-aborted-stays logic, unchanged. A new prop-driven `RefreshProgressBar` component renders the bar (kept separate so it is testable without driving a streaming fetch).

**Do NOT:** do not change `refreshMessage` or the clean-run-reload / aborted-stays branching logic — only how the `RefreshResult` is obtained (last stream line instead of whole-body JSON). Do not touch `syncCatalog`.

- [ ] **Step 1: Write the failing component test**

Create `src/lib/components/RefreshProgressBar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import RefreshProgressBar from './RefreshProgressBar.svelte';

describe('RefreshProgressBar', () => {
  it('shows the current game and the done/total count', () => {
    const { getByText } = render(RefreshProgressBar, {
      props: { progress: { done: 12, total: 40, current: 'Chrono Trigger' } }
    });
    expect(getByText(/Chrono Trigger/)).toBeInTheDocument();
    expect(getByText(/12 \/ 40/)).toBeInTheDocument();
  });
  it('sizes the bar fill to the done/total fraction', () => {
    const { getByTestId } = render(RefreshProgressBar, {
      props: { progress: { done: 10, total: 40, current: 'X' } }
    });
    expect(getByTestId('progress-fill').style.width).toBe('25%');
  });
  it('renders a 0%-wide fill at the start of a run', () => {
    const { getByTestId } = render(RefreshProgressBar, {
      props: { progress: { done: 0, total: 40, current: 'X' } }
    });
    expect(getByTestId('progress-fill').style.width).toBe('0%');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/RefreshProgressBar.test.ts`
Expected: FAIL — `Cannot find module './RefreshProgressBar.svelte'`.

- [ ] **Step 3: Create the component**

Create `src/lib/components/RefreshProgressBar.svelte`:

```svelte
<script lang="ts">
  import type { RefreshProgress } from '$lib/sources/refresh';

  let { progress }: { progress: RefreshProgress } = $props();

  let pct = $derived(progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0);
</script>

<div class="wrap">
  <div class="track">
    <div class="fill" data-testid="progress-fill" style="width: {pct}%"></div>
  </div>
  <p class="label">Pricing {progress.current}… — {progress.done} / {progress.total}</p>
</div>

<style>
  .wrap { margin-top: var(--space-3); }
  .track {
    height: 8px; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden;
  }
  .fill { height: 100%; background: var(--accent); transition: width 120ms linear; }
  .label { margin-top: var(--space-1); font-size: var(--fs-sm); color: var(--text-dim); }
</style>
```

- [ ] **Step 4: Run the component test to verify it passes**

Run: `npx vitest run src/lib/components/RefreshProgressBar.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Write the failing Settings test**

In `src/routes/settings/page.test.ts`, add this test inside the `describe('settings page', ...)` block. It drives `runRefresh` with a fake streaming `fetch` whose final line is an aborted result (the aborted path stays on the page and shows a message — it does not call `location.reload()`):

```ts
  it('reads the refresh stream and shows the categorized result message', async () => {
    const ndjson = (objs: object[]) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            const enc = new TextEncoder();
            for (const o of objs) c.enqueue(enc.encode(JSON.stringify(o) + '\n'));
            c.close();
          }
        }),
        { status: 200, headers: { 'content-type': 'application/x-ndjson' } }
      );
    const fetchMock = vi.fn(async () =>
      ndjson([
        { type: 'progress', done: 0, total: 2, current: 'Pikmin' },
        { type: 'progress', done: 1, total: 2, current: 'GoldenEye' },
        { type: 'result', itemsUpdated: 1, errors: 1, errorsByReason: { auth: 0, rate_limit: 1, other: 0 }, aborted: true, refreshEventId: 7 }
      ])
    );
    vi.stubGlobal('fetch', fetchMock);
    const { getByRole, findByText } = render(Page, { props: { data } });
    getByRole('button', { name: /refresh estimates/i }).click();
    expect(await findByText(/aborted after a rate limit/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
```

Add `vi` to the `vitest` import at the top of the file: `import { describe, it, expect, vi } from 'vitest';`.

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/routes/settings/page.test.ts`
Expected: FAIL — `runRefresh` still parses one whole-body JSON response, not an NDJSON stream.

- [ ] **Step 7: Update `settings/+page.svelte`**

In `src/routes/settings/+page.svelte`:

(a) Add to the `<script>` imports, below the existing `import type { RefreshResult } from '$lib/sources/refresh';` line:

```ts
  import type { RefreshProgress } from '$lib/sources/refresh';
  import RefreshProgressBar from '$lib/components/RefreshProgressBar.svelte';
```

(b) Add a progress state declaration next to the other `$state` declarations:

```ts
  let refreshProgress = $state<RefreshProgress | null>(null);
```

(c) Replace the entire `runRefresh` function with a stream-reading version. `refreshMessage` is unchanged — keep it as-is. The new `runRefresh`:

```ts
  async function runRefresh() {
    refreshing = true;
    message = '';
    refreshProgress = null;
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'failed');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let result: RefreshResult | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const raw = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (raw.length === 0) continue;
          const event = JSON.parse(raw);
          if (event.type === 'progress') {
            refreshProgress = { done: event.done, total: event.total, current: event.current };
          } else if (event.type === 'result') {
            result = event;
          }
        }
      }
      refreshProgress = null;
      if (!result) throw new Error('refresh ended without a result');
      // Clean run: reload so counts and history update. Failed/aborted run:
      // stay on the page and show the categorized message.
      if (result.aborted || result.errors > 0) {
        message = refreshMessage(result);
      } else {
        location.reload();
      }
    } catch (e) {
      refreshProgress = null;
      message = e instanceof Error ? e.message : 'error';
    } finally {
      refreshing = false;
    }
  }
```

(d) In the Prices `<section>`, immediately after the "Refresh estimates" `<button>`, add the progress bar:

```svelte
  {#if refreshProgress}
    <RefreshProgressBar progress={refreshProgress} />
  {/if}
```

Leave `refreshMessage`, the button itself, the history list, `syncCatalog`, and the styles unchanged.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/routes/settings/page.test.ts` — Expected: PASS.
Run: `npx vitest run` — Expected: PASS, whole suite.
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 9: Commit**

```
git add src/lib/components/RefreshProgressBar.svelte src/lib/components/RefreshProgressBar.test.ts src/routes/settings/+page.svelte src/routes/settings/page.test.ts
git commit -m "Show a live refresh progress bar in Settings" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Phase 1 group review

After Tasks 1–3:

```
Review the batch from multiple perspectives. Minimum 3 review rounds.
If round 3 still finds issues, keep going until clean.
```

Phase-specific review dimensions:
- **Concurrency correctness:** no DB race (all `better-sqlite3` calls are sync); `itemsUpdated` / `errorsByReason` tallies are exact under the worker pool; the abort flag genuinely stops un-claimed pairs.
- **Determinism:** the concurrency/abort tests pass reliably with no sleeps and no weakened assertions (Task Discipline §C).
- **Protocol integrity:** every stream emits ≥1 `progress` line then exactly one `result` line; `RefreshResult` shape unchanged.
- **No behavior regression:** clean-run-reloads / aborted-stays logic and `refreshMessage` are byte-identical to before; `estimatePair`'s other caller (`api/collection/logic.ts`) still compiles.
- **CVT-1 / CVT-T1 / CVT-T2** all hold.
- `npx vitest run` and `npm run check` clean.

When the phase ships, update the banner and the top-of-plan table per the Living Document Contract.

---

## Spec Coverage Map

| Spec section | Task |
|---|---|
| §1 streaming protocol (NDJSON, progress + result lines) | 2 |
| §2 concurrency model (worker pool, limit 5) | 1 |
| §3 abort under concurrency | 1 |
| §4 `onProgress` / `RefreshProgress` widening | 1 |
| §5 endpoint structure (`logic.ts` `refreshStream` + thin `+server.ts`) | 2 |
| §6 client `runRefresh` + progress bar | 3 |
| Testing section | every task's tests + the group review |
