# Value-Over-Time Chart — Design Spec

**Date:** 2026-05-21
**Status:** Approved — ready for planning
**Workstream:** B of 4 (refresh progress ✅ → value-over-time chart → browse performance → small-items batch)

## Summary

The dashboard shows the collection's *current* total value but nothing about
how it has moved over time. This adds a "Value over time" chart to the
dashboard: a line of the collection's total value at each price refresh.

The honest data path matters here. `price_snapshots` records each
`(game, condition)` pair's estimate at each refresh, but it does **not**
record collection composition over time — no quantity-at-the-time, no record
of items since removed, and manual-priced items are never snapshotted. A
precise total-value history therefore cannot be faithfully reconstructed from
`price_snapshots`. Instead, this feature records the real collection total on
each refresh **going forward**: a new `refresh_events.total_value` column,
populated at refresh time with the exact figure the dashboard computes. The
chart plots that column. It is accurate and trivially queried; the trade-off
is that it has no retroactive points — the chart begins with the next refresh
and grows one point per refresh.

## Goals

- **An accurate value-over-time line.** Each point is the real collection
  total at a past refresh — not an approximation.
- **Zero new dependencies.** The chart is a hand-rolled SVG, consistent with
  the app's minimal-cost ethos and the existing hand-rolled `ConsoleBar`.
- **One definition of "the total."** The figure recorded per refresh and the
  figure shown on the dashboard come from a single shared function.
- **Honest empty/thin states.** With no history, or only one refresh, the
  panel says so plainly rather than drawing a misleading chart.

## Non-Goals

- **Retroactive history.** Past refreshes (recorded before this feature) have
  no `total_value` and do not appear on the chart. Reconstructing them from
  `price_snapshots` was considered and rejected — the composition history
  needed for an accurate total is not stored.
- **Per-game price-history charts.** Out of scope; this is a single
  portfolio-level line.
- **Interactivity beyond native tooltips.** No zoom, no pan, no JS-driven
  hover. Each data point gets a native SVG `<title>` and nothing more.
- **A charting library.** Deliberately not added.

## Background: current shape

- `refresh_events` (`src/lib/db/schema.ts`) — one row per refresh:
  `id`, `triggeredAt`, `source`, `itemsUpdated`, `errors`, `errorSummary`.
- `refreshEstimates` (`src/lib/sources/refresh.ts`) — runs a refresh, then
  calls `updateRefreshEvent(db, eventId, { itemsUpdated, errors, errorSummary })`.
- `updateRefreshEvent` (`src/lib/db/queries/refresh.ts`) — writes those
  tallies onto the event row.
- `dashboardData` (`src/lib/server/dashboard.ts`) — computes `totalValue` by
  looping owned items and summing `resolveItemValue(item, estimate)`.
- The dashboard route (`src/routes/+page.server.ts` → `+page.svelte`) renders
  stat tiles, a "By console" card, and a "Top movers" card.

## Design

### 1. Recording the total

**Schema.** `refresh_events` gains a nullable integer-cents column:

| Column | Type | Notes |
|---|---|---|
| `total_value` | integer, nullable | Collection total at refresh time; `null` on rows created before this feature |

A `drizzle-kit`-generated migration adds it; the existing idempotent startup
`migrate()` applies it. Adding a nullable column is non-destructive.

**One canonical total.** A new query function is the single definition of the
collection's total value:

```ts
// in src/lib/db/queries/prices.ts, beside resolveItemValue
/** The collection's total value in integer cents — manual price wins,
 *  else the latest estimate, else the item contributes nothing. */
export function collectionTotalCents(db: DB): number;
```

It sums `resolveItemValue(item, estimate)` over owned items, skipping items
with no known value — identical semantics to today's `dashboardData.totalValue`.
`dashboardData` is refactored to derive its `totalValue` from this same
definition, so the recorded total and the displayed total can never diverge.

**Recording.** `RefreshEventUpdate` (the `updateRefreshEvent` input) gains a
`totalValue: number` field. At the end of `refreshEstimates` — after the
worker pool finishes, alongside the existing `errors` / `errorSummary`
computation — `collectionTotalCents(db)` is computed and passed to
`updateRefreshEvent`, which writes it to `total_value`.

This happens on **every** refresh, including aborted ones: the total at that
moment is a real data point (an aborted refresh simply yields a point close
to the previous one). `RefreshResult` is unchanged — `total_value` is
persisted, not returned to the caller.

### 2. History query

`valueHistory(db)` in `src/lib/db/queries/refresh.ts`, beside
`listRefreshEvents` / `topMovers`:

```ts
export interface ValuePoint {
  at: Date;
  value: number; // integer cents
}

/** Total collection value at each refresh that recorded one, oldest first. */
export function valueHistory(db: DB): ValuePoint[];
```

Selects `triggeredAt` and `total_value` from `refresh_events` where
`total_value IS NOT NULL`, ordered by `triggeredAt` ascending.

### 3. The chart component

A new `src/lib/components/ValueChart.svelte`, prop
`history: ValuePoint[]`:

- **0 points** — a dim message: *"No value history yet — run a refresh to
  start tracking."*
- **1 point** — a one-line message naming the single recorded value and its
  date (a trend line needs two points).
- **2+ points** — a hand-rolled SVG line chart:
  - a `<polyline>` through the points;
  - a `<circle>` per refresh, each carrying a native SVG `<title>` of the form
    `"<localized date> — <formatted value>"` (free hover tooltip, no JS);
  - the Y axis scaled to the data's min–max range (with small padding) so the
    trend is visible rather than flattened against a 0 baseline;
  - the first and last point's value labelled, and the first/last date shown
    on the X extent.
  - Values are formatted with the existing `formatCents`.

No JS interactivity, no external dependency. The component is pure and
prop-driven — fully testable by passing a `history` array.

### 4. Dashboard wiring

- `DashboardData` (`src/lib/server/dashboard.ts`) gains a
  `valueHistory: ValuePoint[]` field; `dashboardData` populates it by calling
  `valueHistory(db)`. `src/routes/+page.server.ts` is unchanged — it already
  returns `dashboardData(db)`.
- `src/routes/+page.svelte` renders a new `<section class="card">` titled
  *"Value over time"* containing `<ValueChart history={data.valueHistory} />`,
  placed immediately after the stat tiles (above the "By console" card) — it
  is the headline portfolio trend.

### Module responsibilities

- `collectionTotalCents` — the one definition of the collection total. No I/O
  beyond its DB reads.
- `valueHistory` — a pure read query over `refresh_events`.
- `ValueChart.svelte` — pure presentation: a `ValuePoint[]` in, an SVG out.
- `refreshEstimates` — unchanged in shape; gains one call to
  `collectionTotalCents` and one widened `updateRefreshEvent` argument.
- `dashboardData` — gains one field; its total is now sourced from
  `collectionTotalCents`.

## Testing

All tests use a test DB and fakes — no live calls (CVT-T1).

- **`valueHistory`** — insert `refresh_events` with and without `total_value`;
  assert the `null`-total rows are excluded and the result is oldest-first.
- **`collectionTotalCents`** — owned items mixing eBay estimates, manual
  prices, and unvalued items → the correct integer-cents sum. The existing
  `dashboardData` total tests must still pass against the refactored code.
- **`refreshEstimates` records the total** — run a refresh against a fake
  search, then assert `latestRefreshEvent(db)?.totalValue` equals
  `collectionTotalCents(db)`.
- **`ValueChart.svelte`** — renders the empty-state message for `[]`; the
  single-value message for one point; a `<polyline>` and the correct number
  of `<circle>` elements for 2+ points.
- **Dashboard page test** — the "Value over time" card renders.
- **Schema test** — a `refresh_events` row round-trips `total_value` and
  defaults it to `null`.

Test output must stay pristine.

## File-level change list

| File | Change |
|---|---|
| `src/lib/db/schema.ts` + `drizzle/` | `refresh_events.total_value` column + generated migration |
| `src/lib/db/queries/prices.ts` | **New** `collectionTotalCents(db)` |
| `src/lib/db/queries/refresh.ts` | **New** `valueHistory(db)` + `ValuePoint`; `RefreshEventUpdate` gains `totalValue` |
| `src/lib/sources/refresh.ts` | `refreshEstimates` computes `collectionTotalCents` and passes it to `updateRefreshEvent` |
| `src/lib/server/dashboard.ts` | `DashboardData` gains `valueHistory`; `totalValue` sourced from `collectionTotalCents` |
| `src/lib/components/ValueChart.svelte` | **New** — the SVG line chart |
| `src/routes/+page.svelte` | New "Value over time" card |
| Test files | `valueHistory`, `collectionTotalCents`, `refresh.test.ts`, `ValueChart.test.ts`, dashboard + schema tests |

## Verification

- `npm run check` clean; full `vitest` suite green.
- After two or more real refreshes, the dashboard shows a line trending
  between the recorded totals, with per-point hover tooltips.
