# Estimate Accuracy & Refresh Error Surfacing — Design Spec

**Date:** 2026-05-20
**Status:** Approved — ready for planning

## Summary

Two related improvements to the eBay pricing path in `src/lib/sources/`:

1. **Estimate accuracy.** Today the search boundary returns a bare `number[]`
   of prices — eBay's listing title and condition are discarded inside
   `client.ts`, so no downstream code can reject mismatched listings. A
   keyword-built query plus a raw median means lots, bundles, reproductions,
   and wrong-condition listings all feed the estimate. This widens the search
   boundary to carry listing metadata and adds a listing-quality filter step.

2. **Refresh error surfacing.** `refreshEstimates` wraps each pair in a bare
   `catch {}` that increments an error count and discards the reason. Bad
   credentials or a rate-limit wall make every pair fail silently, with no
   diagnostics and hundreds of wasted API calls. This adds typed errors,
   classification, abort-on-fatal behavior, and a categorized result the UI
   and refresh history can show.

Both changes touch `src/lib/sources/ebay/` and `src/lib/sources/refresh.ts`.
The SvelteKit + SQLite + Drizzle foundation is unchanged. One small idempotent
schema migration is added.

## Goals

- **Trustworthy estimates.** The dollar figures the dashboard shows should be
  computed from listings that actually match the game and condition.
- **Diagnosable refreshes.** When a refresh fails, the user learns *why*
  (auth / rate limit / other) — live and in the "Recent refreshes" history.
- **No wasted quota.** A fatal error (bad token, rate-limit) aborts the run
  instead of burning the daily eBay allowance on doomed calls.
- **Tunable in one place.** Filter rules and condition keywords stay
  consolidated so the heuristic can be adjusted without hunting through code.
- **Independently testable units.** Each new module is small, has one job,
  and is tested against hand-built inputs.

## Non-Goals

- **Region filtering.** eBay's Browse API has no structured cartridge-region
  (NTSC / PAL / NTSC-J) field — region only appears as free text in titles,
  and the local catalog's `games.region` is frequently null. A title-keyword
  region heuristic would silently do nothing whenever either side lacks the
  data. Deferred; the title-match and junk filters carry the accuracy work.
- **Sold-price data.** eBay Marketplace Insights remains out of scope; v1
  estimates are still active-listing medians, honestly labelled as such.
- **Minimum-listing confidence threshold.** A thin result set still yields an
  estimate; `listingCount` is already shown in the UI and tells the user how
  much to trust it. Filtering will naturally lower those counts — that is
  honest, not a defect.
- **Reworking the on-add estimate path.** `estimatePair` is shared, so the
  add-a-game flow inherits the new filtering for free, but no endpoint or UI
  in that path is redesigned here.

## Part 1 — Estimate Accuracy

### The lossy boundary

`SearchFn` is currently `(query: string) => Promise<number[]>`.
`searchListings` in `client.ts` reads eBay `itemSummaries`, keeps only
`price`, and returns cents. Title and condition are dropped at that point and
cannot be recovered. Widening this boundary type is the enabling change.

### Widened pipeline

```
SearchFn:    (query) => Promise<Listing[]>
client.ts:   searchListings  -> Listing[]                       (keeps title + conditionId)
filter.ts:   filterListings(listings, game, condition) -> Listing[]    (NEW)
estimate.ts: estimateFromListings(number[]) -> Estimate          (unchanged — pure median)
estimatePair: search(query) -> filterListings(...) -> estimateFromListings(filtered prices)
```

### The `Listing` type

```ts
export interface Listing {
  priceCents: number;       // USD price in integer cents
  title: string;            // eBay listing title, as returned
  conditionId: number | null; // eBay conditionId, null when absent
}
```

`client.ts` builds `Listing[]` from `itemSummaries`, applying the same
USD-only / finite / non-negative price guards it has today. `conditionId`
comes from `itemSummary.conditionId` (string in the API → parsed to number;
`null` when missing).

### `filterListings(listings, game, condition)`

Lives in the new `src/lib/sources/ebay/filter.ts`. `game` carries at least
`{ title: string }`; `condition` is the `Condition` union. Filters apply in
this order:

1. **Title match.** Fold both the game title and each listing title with the
   same normalization the Browse screen uses — Unicode NFD decomposition,
   combining-mark strip, lowercase (`s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()`).
   Keep a listing only if **every game-title token of length ≥ 4** appears as
   a substring of the folded listing title. (Short tokens like "of", "the",
   "II" are skipped — they match too easily and exclude too aggressively.)
   This rule is the primary tuning knob.

2. **Junk exclusion.** Drop any listing whose folded title contains a junk
   marker: `lot`, `bundle`, `repro`, `reproduction`, `read description`, or a
   quantity multiplier matching the regex `\bx\s?\d+\b` (covers `x2`, `x 3`).
   Markers are a single exported array so the list is easy to extend.

3. **Condition.**
   - `new`: keep only listings whose `conditionId` is `1000` or `1500`
     (New / New other). A listing with a `null` conditionId is dropped for
     `new` — "new" is the one condition eBay structures reliably, so absence
     of the signal means it is not trusted as new.
   - `loose` / `cib`: eBay's condition IDs do not separate loose from
     complete (both are "Used", `3000`). Condition for these two is driven by
     the query keywords (step below) and the title-match filter only — no
     `conditionId` gate.

4. **Price sanity.** Compute the median of the prices surviving steps 1–3.
   Drop any listing priced below 10% or above 10× that median. This removes
   reproduction and for-parts listings that slipped past the title filter.
   With fewer than 3 survivors after step 3, skip this step (a median of 1–2
   points is not a stable reference).

The result is the surviving `Listing[]`; `estimatePair` maps it to
`priceCents` and passes that to the unchanged `estimateFromListings`.

### Query construction

`buildQuery` in `query.ts` keeps `title` + `console` and swaps the weak
condition keywords. `CONDITION_KEYWORDS` becomes:

```ts
export const CONDITION_KEYWORDS: Record<Condition, string> = {
  loose: 'cart only disc only',
  cib: 'complete in box',
  new: 'sealed'
};
```

`loose` previously sent the bare word "loose", which appears in the
description of many complete listings. `cart only` / `disc only` are stronger
loose signals. `query.ts` keeps its existing comment marking it as the
single tuning point for query text.

For the `new` condition, `searchListings` additionally passes
`conditionIds:{1000|1500}` in the eBay `filter` parameter, narrowing the
result set at the source before `filterListings` runs.

### Estimate behavior

`estimate.ts` is unchanged: `estimateFromListings(number[])` still returns the
median (`{ estimate, listingCount }`), `null` estimate for an empty array.
A pair whose listings are all filtered out yields `estimate: null,
listingCount: 0` — identical to "none found", and not an error.

## Part 2 — Refresh Error Surfacing

### Typed errors

`auth.ts` and `client.ts` currently throw `Error` with messages like
`eBay search failed: 429`. A new `src/lib/sources/ebay/errors.ts` defines:

```ts
export class EbayError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'EbayError';
  }
}

export type ErrorReason = 'auth' | 'rate_limit' | 'other';

export function classifyError(e: unknown): ErrorReason {
  if (e instanceof EbayError) {
    if (e.status === 401 || e.status === 403) return 'auth';
    if (e.status === 429) return 'rate_limit';
  }
  return 'other';
}
```

`auth.ts` throws `new EbayError(res.status, 'eBay auth failed: ' + res.status)`
on a non-OK token response. `client.ts` throws
`new EbayError(res.status, 'eBay search failed: ' + res.status)` on a non-OK
search response. A network-level failure (`fetch` rejecting before a
response) propagates as whatever `fetch` throws and classifies as `other`.

### Loop behavior

`refreshEstimates` replaces its bare `catch {}`:

- On a caught error, call `classifyError`.
- `auth` or `rate_limit` → **abort the run.** Stop the loop. Pairs not yet
  reached keep their existing estimates untouched. Record the reason.
- `other` → increment that pair's error count and continue to the next pair.

### Result shape

`RefreshResult` gains two fields:

```ts
export interface RefreshResult {
  itemsUpdated: number;
  errors: number;                          // total failed pairs (unchanged meaning)
  errorsByReason: Record<ErrorReason, number>; // e.g. { auth: 0, rate_limit: 1, other: 1 }
  aborted: boolean;                        // true when an auth/rate_limit error stopped the run
  refreshEventId: number;
}
```

`errorsByReason` always has all three keys (zeroed when unused) so consumers
need no presence checks.

### Persisted history

`refresh_events` gets a new nullable column:

| Column | Type | Notes |
|---|---|---|
| `error_summary` | text, nullable | Compact human string, `null` when the run had no errors |

The summary string is built from `errorsByReason`, e.g.
`"rate_limit×1; other×1 (aborted)"`. `null` when every pair succeeded.
(The fatal reason — `auth` or `rate_limit` — appears with a count of 1,
since the run aborts on the first such error; `other` may accumulate from
pairs processed before the abort.)

The migration is generated with `drizzle-kit` into `drizzle/` and applied by
the existing startup `migrate()` call in `client.ts` — idempotent, no manual
step. Adding a nullable column is non-destructive to existing rows.

`db/queries/refresh.ts` writes `error_summary` when the run finishes
(alongside the existing `itemsUpdated` / `errors` update).

### UI

- `routes/api/refresh/+server.ts` returns the full `RefreshResult` (it already
  passes the result through as JSON; the new fields ride along).
- `routes/settings/+page.svelte` builds a specific message from the result:
  - clean run → e.g. *"Priced 400 items, 12 changed."*
  - errors → e.g. *"Aborted after rate limit — 50/400 priced."*
- `routes/settings/+page.server.ts` already loads `refreshHistory`; it now
  includes `error_summary`, and `+page.svelte` renders it on the history line
  when present (`"… 2 errors — rate_limit×1; other×1 (aborted)"`).

## Architecture Notes

### File-level changes

| File | Change |
|---|---|
| `src/lib/sources/ebay/client.ts` | Return `Listing[]`; throw `EbayError`; pass `conditionIds` for `new` |
| `src/lib/sources/ebay/auth.ts` | Throw `EbayError` on non-OK token response |
| `src/lib/sources/ebay/errors.ts` | **New** — `EbayError`, `ErrorReason`, `classifyError` |
| `src/lib/sources/ebay/filter.ts` | **New** — `Listing`, `filterListings`, junk-marker list |
| `src/lib/sources/ebay/query.ts` | Stronger `CONDITION_KEYWORDS` |
| `src/lib/sources/ebay/estimate.ts` | Unchanged |
| `src/lib/sources/refresh.ts` | `SearchFn` returns `Listing[]`; filter step in `estimatePair`; abort logic + `errorsByReason` in `refreshEstimates` |
| `src/lib/db/schema.ts` | `refresh_events.error_summary` column |
| `drizzle/` | New generated migration for the column |
| `src/lib/db/queries/refresh.ts` | Write `error_summary` |
| `src/routes/api/refresh/+server.ts` | Pass through new result fields (mostly automatic) |
| `src/routes/settings/+page.svelte` | Categorized refresh message; render `error_summary` in history |
| `src/routes/settings/+page.server.ts` | Include `error_summary` in `refreshHistory` |
| `src/lib/server/ebay.ts` | `SearchFn` (`ebaySearch`, `optionalEbaySearch`) now returns `Listing[]` |

### Where `Listing` lives

`Listing` is defined in `filter.ts` and imported by `client.ts`, `refresh.ts`,
and `server/ebay.ts`. It is the boundary type for the whole eBay search path.

### Module responsibilities

- `client.ts` — HTTP only: call eBay, shape the response into `Listing[]`,
  throw `EbayError` on failure. Knows nothing about games or matching.
- `filter.ts` — pure functions: given listings + a game + a condition, return
  the listings worth pricing. No I/O, no DB.
- `estimate.ts` — pure aggregation: prices in, median out.
- `errors.ts` — pure error vocabulary: the `EbayError` type and `classifyError`.
- `refresh.ts` — orchestration: walk owned pairs, search → filter → estimate,
  snapshot, classify failures, abort or continue, summarize.

Each is understandable and testable without reading the others.

## Testing

TDD throughout; one failing test before each piece of behavior.

- **`filter.test.ts`** — title match keeps an exact match and an accented
  match (`Pokémon` game vs `Pokemon` listing), drops an unrelated title;
  junk exclusion drops `lot` / `bundle` / `repro` / `x2` titles; `new`
  condition keeps `conditionId` 1000/1500 and drops `3000` and `null`;
  `loose`/`cib` ignore `conditionId`; price-sanity drops a listing 20× the
  median and one at 5% of it; price-sanity is skipped with < 3 survivors.
- **`errors.test.ts`** — `classifyError` returns `auth` for 401 and 403,
  `rate_limit` for 429, `other` for a 500 `EbayError` and for a plain
  `Error` / non-Error value.
- **`client.test.ts`** — `searchListings` returns `Listing[]` with title and
  `conditionId` populated; still applies USD-only / finite price guards;
  throws `EbayError` carrying the status on a non-OK response; sends
  `conditionIds` in the filter for `new`.
- **`auth.test.ts`** — throws `EbayError` with the status on a non-OK token
  response; token caching behavior unchanged.
- **`query.test.ts`** — `buildQuery` emits the new condition keywords.
- **`refresh.test.ts`** — with a fake `SearchFn`: a 429 on pair 2 aborts the
  run, leaves later pairs untouched, sets `aborted: true` and
  `errorsByReason.rate_limit`; a 401 aborts the same way; an `other` error on
  one pair counts it and continues; a clean run reports `aborted: false` and
  all-zero `errorsByReason`; `error_summary` is written for a failed run and
  left `null` for a clean one.
- **`settings/page.test.ts`** — renders a categorized refresh message;
  renders `error_summary` on a history row when present.

All tests use hand-built inputs and fakes — no live eBay calls. Test output
must stay pristine; an intentionally-triggered error path captures and asserts
the thrown `EbayError` rather than letting it surface as noise.

## Verification

- `npm run check` clean.
- Full `vitest` suite green.
- The pre-existing platform/test count does not regress; new tests are added,
  none deleted.
