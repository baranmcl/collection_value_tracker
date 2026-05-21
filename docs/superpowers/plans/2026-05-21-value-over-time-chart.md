# Value-Over-Time Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Value over time" line chart to the dashboard, plotting the collection's total value recorded at each price refresh.

**Architecture:** A new nullable `refresh_events.total_value` column is populated at the end of every refresh with `collectionTotalCents(db)` — the single canonical collection-total function. A `valueHistory` query reads those points; a dependency-free hand-rolled SVG component (`ValueChart.svelte`) draws the line on the dashboard.

**Tech Stack:** SvelteKit 2 / Svelte 5, TypeScript, better-sqlite3 + Drizzle ORM + drizzle-kit, Vitest 4, `@testing-library/svelte`, inline SVG.

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

**Overall:** 1/1 phase shipped. On branch `feat/value-chart`, awaiting integration.

| Phase | Status | Ship SHA(s) | Notes |
|---|---|---|---|
| 1 — Value-Over-Time Chart | ✅ Shipped | `7831ed3`…`c471296` | Tasks 1–6, per-task + 3-round group review passed; 165 tests green |

### Deviations

- **Task 1:** `src/routes/settings/page.test.ts` was modified (not in the task's file list) — its `refreshHistory` fixtures are typed against `RefreshEvent`, so the new `total_value` column required `totalValue: null` added to two fixture objects. A minimal type-fix, no behavior change.

### Discoveries

- `src/routes/collection/+page.server.ts` has its own inline `totalValue` reducer for the collection page's average-value stat (pre-existing, out of scope for this feature). It is equivalent to `collectionTotalCents` given the same data; a future cleanup could route it through the canonical function.

---

## Source Spec

This plan implements `docs/superpowers/specs/2026-05-21-value-over-time-chart-design.md`. Read it for rationale; this plan is the executable form.

## Task Discipline (applies to every task)

**§A — Before starting any task:** Invoke `superpowers:test-driven-development`. Read `docs/pitfalls/testing-pitfalls.md`. Follow TDD: write the failing test → run it, confirm it fails for the expected reason → minimum code to pass → run it, confirm green.

**§B — Before marking any task complete:** Review the new tests against `docs/pitfalls/testing-pitfalls.md`. Run `npx vitest run` (whole suite green) and `npm run check` (0 errors, 0 warnings). Test output pristine — no stray stderr, no debug prints.

**§C — Commit messages:** every `git commit` MUST end with the trailer via a second `-m`:
`git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"`

**Project pitfalls binding here:** CVT-1 (money is integer cents — `total_value` and `collectionTotalCents` are integer cents; SVG pixel coordinates are floats but are never money and never stored). CVT-T1 (no live calls in tests — all use a test DB / `vi.fn` fakes).

## Execution Setup

Create a feature branch before Task 1 — do NOT execute on `main`. Suggested name: `feat/value-chart`. Execute tasks in numeric order (1 → 6). When done, use `superpowers:finishing-a-development-branch`.

---

## Phase 1 — Value-Over-Time Chart

**Execution Status:** ✅ SHIPPED at `7831ed3`…`c471296` on 2026-05-21 (branch `feat/value-chart`; per-task spec + code-quality reviews and the 3-round group review all passed; 165 tests green, `npm run check` clean)

### Task 1: `total_value` column on `refresh_events`

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: a generated migration in `drizzle/`
- Test: `src/lib/db/schema.test.ts`

**Discipline:** Task Discipline §A, §B, §C. Generating the migration (`drizzle-kit generate`) is codegen and exempt from TDD; the schema edit and its round-trip test are not.

**Context:** `refresh_events` records per-refresh tallies. This task adds a nullable integer-cents `total_value` column to hold the collection total at refresh time. `makeTestDb` applies migrations from `./drizzle`, so a generated migration auto-applies in tests.

- [ ] **Step 1: Write the failing test**

In `src/lib/db/schema.test.ts`, add this test inside the existing `describe('schema', ...)` block (`refreshEvents` is already imported there from a prior feature):

```ts
  it('stores a nullable total value on a refresh event', () => {
    const db = makeTestDb();
    db.insert(refreshEvents).values({ triggeredAt: new Date(), source: 'ebay_browse' }).run();
    expect(db.select().from(refreshEvents).get()?.totalValue).toBeNull();

    db.insert(refreshEvents)
      .values({ triggeredAt: new Date(), source: 'ebay_browse', totalValue: 508611 })
      .run();
    const rows = db.select().from(refreshEvents).all();
    expect(rows.map((r) => r.totalValue)).toContain(508611);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/db/schema.test.ts`
Expected: FAIL — `totalValue` is not a property of `refreshEvents`.

- [ ] **Step 3: Add the column to the schema**

In `src/lib/db/schema.ts`, replace the `refreshEvents` table definition with:

```ts
export const refreshEvents = sqliteTable('refresh_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  triggeredAt: integer('triggered_at', { mode: 'timestamp' }).notNull(),
  source: text('source').notNull(),
  itemsUpdated: integer('items_updated').notNull().default(0),
  errors: integer('errors').notNull().default(0),
  errorSummary: text('error_summary'),
  totalValue: integer('total_value')
});
```

`integer` and `text` are already imported at the top of the file. The nullable column has no `.notNull()`. Change nothing else.

- [ ] **Step 4: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new file `drizzle/NNNN_<name>.sql` containing an `ALTER TABLE` that adds the `total_value` integer column to `refresh_events`, and nothing else. Open the generated `.sql` and confirm. If the generator reports "No schema changes", the schema edit was not saved — re-check Step 3. (drizzle-kit also updates files under `drizzle/meta/` — expected.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/db/schema.test.ts`
Expected: PASS — `makeTestDb` applies the new migration; `totalValue` round-trips and defaults to `null`.

- [ ] **Step 6: Commit**

```
git add src/lib/db/schema.ts src/lib/db/schema.test.ts drizzle/
git commit -m "Add total_value column to refresh_events" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2: `collectionTotalCents` query

**Files:**
- Modify: `src/lib/db/queries/prices.ts`
- Test: `src/lib/db/queries/prices.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Context:** The dashboard total is computed inline in `dashboardData`. This task extracts the canonical definition into `collectionTotalCents(db)` — the single source of truth for "the collection's total value." `dashboardData` is refactored to use it in Task 6; this task only creates the function.

**Note on imports:** `prices.ts` will import `listCollection` from `./collection`. `collection.ts` does not import `prices.ts`, so there is no import cycle.

**Do NOT:** do not change `dashboardData` here (that is Task 6). Do not change `resolveItemValue`, `estimateMap`, or any existing export.

- [ ] **Step 1: Write the failing test**

In `src/lib/db/queries/prices.test.ts`, add `collectionTotalCents` to the import from `./prices`, and add this test (use whatever `describe` structure the file already has, or add a new `describe('collectionTotalCents', ...)` block):

```ts
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, updateItem } from '$lib/db/queries/collection';

describe('collectionTotalCents', () => {
  it('sums manual prices and estimates, skipping unvalued items', () => {
    const db = makeTestDb();
    upsertGames(db, [
      { id: 1, console: 'SNES', title: 'A', region: null, releaseYear: null },
      { id: 2, console: 'N64', title: 'B', region: null, releaseYear: null },
      { id: 3, console: 'SNES', title: 'C', region: null, releaseYear: null }
    ]);
    addItem(db, { gameId: 1, condition: 'loose' });
    const manualId = addItem(db, { gameId: 2, condition: 'cib' });
    addItem(db, { gameId: 3, condition: 'loose' }); // no estimate, no manual → unvalued
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 5000, listingCount: 3 });
    updateItem(db, manualId, { manualPrice: 9000 });

    expect(collectionTotalCents(db)).toBe(14000); // 5000 estimate + 9000 manual
  });

  it('returns 0 for an empty collection', () => {
    expect(collectionTotalCents(makeTestDb())).toBe(0);
  });
});
```

Note: `upsertEstimate` is already imported in this test file (it tests `prices.ts`). If `addItem`/`updateItem`/`upsertGames`/`makeTestDb` are not yet imported, add the imports shown above.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/db/queries/prices.test.ts`
Expected: FAIL — `collectionTotalCents` is not exported.

- [ ] **Step 3: Add `collectionTotalCents` to `prices.ts`**

In `src/lib/db/queries/prices.ts`:

This file currently has no `ABOUTME` header. The project convention (enforced in prior reviews) is that source `.ts` modules carry one — add it as the first two lines of the file:

```ts
// ABOUTME: Price-estimate and item-value queries — upsert and read eBay
// ABOUTME: estimates, and resolve each owned item's value.
```

Add an import for `listCollection` near the other imports:

```ts
import { listCollection } from './collection';
```

Add this function at the end of the file:

```ts
/** The collection's total value in integer cents — manual price wins, else
 *  the latest estimate, else the item contributes nothing. The single
 *  definition of "the collection total". */
export function collectionTotalCents(db: DB): number {
  const items = listCollection(db);
  const estimates = estimateMap(db);
  let total = 0;
  for (const item of items) {
    const value = resolveItemValue(item, estimates.get(`${item.gameId}:${item.condition}`) ?? null);
    if (value !== null) total += value;
  }
  return total;
}
```

`DB`, `estimateMap`, and `resolveItemValue` are already in this file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/db/queries/prices.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite and type check**

Run: `npx vitest run` — Expected: PASS.
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```
git add src/lib/db/queries/prices.ts src/lib/db/queries/prices.test.ts
git commit -m "Add collectionTotalCents — the canonical collection total" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3: Record the total on each refresh

**Files:**
- Modify: `src/lib/db/queries/refresh.ts` (`RefreshEventUpdate`)
- Modify: `src/lib/sources/refresh.ts` (`refreshEstimates`)
- Test: `src/lib/sources/refresh.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 1 (`total_value` column), Task 2 (`collectionTotalCents`).

**Context:** `refreshEstimates` ends by calling `updateRefreshEvent(db, eventId, { itemsUpdated, errors, errorSummary })`. This task widens `RefreshEventUpdate` with `totalValue` and has `refreshEstimates` compute `collectionTotalCents(db)` after the worker pool finishes and pass it. The total is recorded on **every** refresh, including aborted ones.

**Do NOT:** do not change `RefreshResult`, the worker pool, or `updateRefreshEvent`'s body — `updateRefreshEvent` does `db.update(refreshEvents).set(u)`, so adding a field to the `RefreshEventUpdate` interface is enough for Drizzle to write the new column.

- [ ] **Step 1: Write the failing test**

In `src/lib/sources/refresh.test.ts`, add `collectionTotalCents` to the imports:

```ts
import { collectionTotalCents } from '$lib/db/queries/prices';
```

Add this test at the end of the `describe('refreshEstimates', ...)` block (`latestRefreshEvent` is already imported from `$lib/db/queries/refresh`):

```ts
  it('records the collection total on the refresh event', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    const search = vi.fn(async (q: string) => [{ priceCents: 4200, title: q, conditionId: 3000 }]);
    await refreshEstimates(db, { search, onProgress: () => {} });
    expect(latestRefreshEvent(db)?.totalValue).toBe(collectionTotalCents(db));
    expect(latestRefreshEvent(db)?.totalValue).toBe(4200);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sources/refresh.test.ts`
Expected: FAIL — `totalValue` is `null` on the refresh event; `refreshEstimates` does not record it.

- [ ] **Step 3: Widen `RefreshEventUpdate`**

In `src/lib/db/queries/refresh.ts`, replace the `RefreshEventUpdate` interface with:

```ts
export interface RefreshEventUpdate {
  itemsUpdated: number;
  errors: number;
  errorSummary: string | null;
  totalValue: number;
}
```

`updateRefreshEvent`'s body is unchanged — `db.update(refreshEvents).set(u)` picks up the new field automatically.

- [ ] **Step 4: Record the total in `refreshEstimates`**

In `src/lib/sources/refresh.ts`, the file already imports `import { getEstimate, upsertEstimate } from '$lib/db/queries/prices';`. Add `collectionTotalCents` to that existing line so it becomes:

```ts
import { collectionTotalCents, getEstimate, upsertEstimate } from '$lib/db/queries/prices';
```

In `refreshEstimates`, find the final `updateRefreshEvent(...)` call. It currently reads:

```ts
  updateRefreshEvent(db, eventId, { itemsUpdated, errors, errorSummary: summarizeErrors(errorsByReason, aborted) });
```

Replace it with:

```ts
  updateRefreshEvent(db, eventId, {
    itemsUpdated,
    errors,
    errorSummary: summarizeErrors(errorsByReason, aborted),
    totalValue: collectionTotalCents(db)
  });
```

- [ ] **Step 5: Run the full suite and type check**

Run: `npx vitest run` — Expected: PASS, including the new test.
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```
git add src/lib/db/queries/refresh.ts src/lib/sources/refresh.ts src/lib/sources/refresh.test.ts
git commit -m "Record the collection total on every refresh event" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4: `valueHistory` query

**Files:**
- Modify: `src/lib/db/queries/refresh.ts`
- Test: `src/lib/db/queries/refresh.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 1 (`total_value` column). Task 3 also edits this same file (`src/lib/db/queries/refresh.ts`, the `RefreshEventUpdate` interface) — execute Task 3 before Task 4.

**Context:** The chart needs the recorded totals as time-ordered points. This task adds `valueHistory(db)` returning a `ValuePoint[]` — one point per refresh event that recorded a total, oldest first.

- [ ] **Step 1: Write the failing test**

In `src/lib/db/queries/refresh.test.ts`, add `valueHistory` to the import from `./refresh`, and add this test:

```ts
describe('valueHistory', () => {
  it('returns refresh totals oldest-first and skips events with no total', () => {
    const db = makeTestDb();
    db.insert(refreshEvents).values([
      { triggeredAt: new Date('2026-05-10T00:00:00Z'), source: 'x', totalValue: 5000 },
      { triggeredAt: new Date('2026-05-01T00:00:00Z'), source: 'x', totalValue: 3000 },
      { triggeredAt: new Date('2026-05-20T00:00:00Z'), source: 'x' } // no total → excluded
    ]).run();

    const history = valueHistory(db);
    expect(history.map((p) => p.value)).toEqual([3000, 5000]); // oldest first, null skipped
    expect(history[0].at).toBeInstanceOf(Date);
  });
});
```

`makeTestDb` and `refreshEvents` are imported in this file already if it tests refresh-event queries; if not, add `import { makeTestDb } from '$lib/db/test-db';` and `import { refreshEvents } from '$lib/db/schema';`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/db/queries/refresh.test.ts`
Expected: FAIL — `valueHistory` is not exported.

- [ ] **Step 3: Add `valueHistory` to `refresh.ts`**

In `src/lib/db/queries/refresh.ts`, change the drizzle-orm import to add `asc` and `isNotNull`:

```ts
import { asc, desc, eq, isNotNull } from 'drizzle-orm';
```

Add this interface and function at the end of the file:

```ts
/** One point on the value-over-time chart. */
export interface ValuePoint {
  at: Date;
  value: number; // integer cents
}

/** Total collection value at each refresh that recorded one, oldest first. */
export function valueHistory(db: DB): ValuePoint[] {
  return db
    .select({ at: refreshEvents.triggeredAt, value: refreshEvents.totalValue })
    .from(refreshEvents)
    .where(isNotNull(refreshEvents.totalValue))
    .orderBy(asc(refreshEvents.triggeredAt))
    .all()
    .map((r) => ({ at: r.at, value: r.value as number })); // isNotNull guarantees non-null
}
```

- [ ] **Step 4: Run the full suite and type check**

Run: `npx vitest run` — Expected: PASS.
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```
git add src/lib/db/queries/refresh.ts src/lib/db/queries/refresh.test.ts
git commit -m "Add valueHistory query for the value-over-time chart" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5: `ValueChart.svelte` component

**Files:**
- Create: `src/lib/components/ValueChart.svelte`
- Test: `src/lib/components/ValueChart.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 4 (`ValuePoint` type).

**Context:** A dependency-free, prop-driven SVG line chart. Empty and single-point states render plain messages; 2+ points render the line. Matches the project's hand-rolled-SVG convention (`ConsoleBar.svelte`).

**Do NOT:** do not add a charting library. Do not add an `ABOUTME` header to **either** new file — no `.svelte` component and no `.test.ts` file in this project carries one (an executor added them in a prior workstream and they had to be reverted). `ValueChart.svelte` starts with `<script lang="ts">` and `ValueChart.test.ts` starts with its `import` — exactly as shown below. Do not add JS interactivity beyond the native SVG `<title>` tooltips.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/ValueChart.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ValueChart from './ValueChart.svelte';

describe('ValueChart', () => {
  it('shows an empty-state message when there is no history', () => {
    const { getByText } = render(ValueChart, { props: { history: [] } });
    expect(getByText(/no value history yet/i)).toBeInTheDocument();
  });

  it('shows a single-value message when there is one refresh', () => {
    const { getByText } = render(ValueChart, {
      props: { history: [{ at: new Date('2026-05-01T00:00:00Z'), value: 5000 }] }
    });
    expect(getByText(/first value recorded/i)).toBeInTheDocument();
  });

  it('draws a polyline and one circle per point for 2+ refreshes', () => {
    const history = [
      { at: new Date('2026-05-01T00:00:00Z'), value: 5000 },
      { at: new Date('2026-05-10T00:00:00Z'), value: 6000 },
      { at: new Date('2026-05-20T00:00:00Z'), value: 5500 }
    ];
    const { container } = render(ValueChart, { props: { history } });
    expect(container.querySelector('polyline')).not.toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/ValueChart.test.ts`
Expected: FAIL — `Cannot find module './ValueChart.svelte'`.

- [ ] **Step 3: Create the component**

Create `src/lib/components/ValueChart.svelte`:

```svelte
<script lang="ts">
  import type { ValuePoint } from '$lib/db/queries/refresh';
  import { formatCents } from '$lib/money';

  let { history }: { history: ValuePoint[] } = $props();

  // SVG viewBox and plot-area bounds.
  const W = 600, H = 160;
  const L = 44, R = 560, TOP = 20, BOT = 128;

  // Geometry for the 2+-point line. null for the empty / single-point states.
  let chart = $derived.by(() => {
    if (history.length < 2) return null;
    const values = history.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    const x = (i: number) => L + (i * (R - L)) / (history.length - 1);
    const y = (v: number) => (span === 0 ? (TOP + BOT) / 2 : BOT - ((v - min) / span) * (BOT - TOP));
    const points = history.map((p, i) => ({ cx: x(i), cy: y(p.value), point: p }));
    return { points, polyline: points.map((p) => `${p.cx},${p.cy}`).join(' ') };
  });

  let last = $derived(history[history.length - 1]);
</script>

{#if history.length === 0}
  <p class="note">No value history yet — run a refresh to start tracking.</p>
{:else if history.length === 1}
  <p class="note">
    First value recorded: {formatCents(history[0].value)} on {history[0].at.toLocaleDateString()}.
    The trend line appears after your next refresh.
  </p>
{:else if chart}
  <svg viewBox="0 0 {W} {H}" class="chart" role="img" aria-label="Collection value over time">
    <polyline points={chart.polyline} fill="none" stroke="var(--accent)" stroke-width="2" />
    {#each chart.points as p}
      <circle cx={p.cx} cy={p.cy} r="3.5" fill="var(--accent-warm)">
        <title>{p.point.at.toLocaleDateString()} — {formatCents(p.point.value)}</title>
      </circle>
    {/each}
    <text x={L} y="148" class="axis">{history[0].at.toLocaleDateString()}</text>
    <text x={R} y="148" class="axis end">{last.at.toLocaleDateString()}</text>
    <text x={chart.points[0].cx} y={chart.points[0].cy - 9} class="val">{formatCents(history[0].value)}</text>
    <text x={chart.points[chart.points.length - 1].cx} y={chart.points[chart.points.length - 1].cy - 9} class="val end">{formatCents(last.value)}</text>
  </svg>
{/if}

<style>
  .note { color: var(--text-dim); font-size: var(--fs-sm); }
  .chart { width: 100%; height: auto; }
  .axis { fill: var(--text-dim); font-size: 11px; }
  .val { fill: var(--accent-warm); font-size: 12px; font-family: var(--mono); }
  .end { text-anchor: end; }
</style>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/ValueChart.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```
git add src/lib/components/ValueChart.svelte src/lib/components/ValueChart.test.ts
git commit -m "Add the ValueChart SVG line component" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 6: Dashboard wiring

**Files:**
- Modify: `src/lib/server/dashboard.ts`
- Modify: `src/routes/+page.svelte`
- Test: `src/lib/server/dashboard.test.ts`, `src/routes/page.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 2 (`collectionTotalCents`), Task 4 (`valueHistory`/`ValuePoint`), Task 5 (`ValueChart`).

**Context:** `dashboardData` computes `totalValue` inline in its item loop. This task: (1) sources `totalValue` from `collectionTotalCents` so there is one definition; (2) adds a `valueHistory` field to `DashboardData`; (3) renders the chart on the dashboard.

**Do NOT:** do not change the `byConsole` or `unvaluedCount` logic in `dashboardData`'s loop — only remove the `totalValue` accumulation. Do not touch `+page.server.ts` (it returns `dashboardData(db)` plus `refreshDelta`; the new field rides along).

- [ ] **Step 1: Write the failing tests**

In `src/lib/server/dashboard.test.ts`, add this test inside the existing `describe('dashboardData', ...)` block:

```ts
  it('includes value history from recorded refresh events', () => {
    const db = makeTestDb();
    db.insert(refreshEvents).values([
      { triggeredAt: new Date('2026-05-01T00:00:00Z'), source: 'x', totalValue: 3000 },
      { triggeredAt: new Date('2026-05-10T00:00:00Z'), source: 'x', totalValue: 4000 }
    ]).run();
    expect(dashboardData(db).valueHistory.map((p) => p.value)).toEqual([3000, 4000]);
  });
```

Add `refreshEvents` to the `$lib/db/schema` import in that test file if it is not already imported.

In `src/routes/page.test.ts`, add `valueHistory: []` to the `data` fixture object (so the dashboard renders with the new field), and add this test inside the `describe('dashboard', ...)` block:

```ts
  it('renders the value-over-time card', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('Value over time')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/server/dashboard.test.ts src/routes/page.test.ts`
Expected: FAIL — `DashboardData` has no `valueHistory`; the dashboard has no "Value over time" card.

- [ ] **Step 3: Update `dashboard.ts`**

In `src/lib/server/dashboard.ts`:

This file currently has no `ABOUTME` header. Add it as the first two lines (project convention for source `.ts` modules, enforced in prior reviews):

```ts
// ABOUTME: Assembles the dashboard's data — total value, per-console
// ABOUTME: breakdown, top movers, and value history.
```

Update the imports — both query modules are **already imported** in this file; add to the existing lines rather than creating new ones:

- the `import { estimateMap, resolveItemValue } from '$lib/db/queries/prices';` line gains `collectionTotalCents` → `import { collectionTotalCents, estimateMap, resolveItemValue } from '$lib/db/queries/prices';`
- the `import { topMovers, latestRefreshEvent, type Mover } from '$lib/db/queries/refresh';` line gains `valueHistory` and `type ValuePoint`.

Add `valueHistory` to the `DashboardData` interface:

```ts
export interface DashboardData {
  totalValue: number;
  itemCount: number;
  unvaluedCount: number;
  byConsole: { console: string; count: number; value: number }[];
  movers: Mover[];
  lastRefreshAt: Date | null;
  valueHistory: ValuePoint[];
}
```

Replace the entire `dashboardData` function with the version below. The changes from the current function: `totalValue` is sourced from `collectionTotalCents(db)` instead of being accumulated in the loop (the loop keeps `entry.value += value` for `byConsole` and `unvaluedCount`); and the returned object gains `valueHistory: valueHistory(db)`. Use the code below verbatim:

```ts
export function dashboardData(db: DB): DashboardData {
  const items = listCollection(db);
  const estimates = estimateMap(db);

  let unvaluedCount = 0;
  // Every owned item contributes to its console's count; only valued items
  // contribute to its value — so a console with no estimates still appears.
  const byConsoleMap = new Map<string, { count: number; value: number }>();

  for (const item of items) {
    const est = estimates.get(`${item.gameId}:${item.condition}`) ?? null;
    const value = resolveItemValue(item, est);
    const entry = byConsoleMap.get(item.console) ?? { count: 0, value: 0 };
    entry.count += 1;
    if (value === null) {
      unvaluedCount++;
    } else {
      entry.value += value;
    }
    byConsoleMap.set(item.console, entry);
  }

  const byConsole = [...byConsoleMap.entries()]
    .map(([console, { count, value }]) => ({ console, count, value }))
    .sort((a, b) => b.value - a.value || b.count - a.count);

  return {
    totalValue: collectionTotalCents(db),
    itemCount: items.length,
    unvaluedCount,
    byConsole,
    movers: topMovers(db, 5),
    lastRefreshAt: latestRefreshEvent(db)?.triggeredAt ?? null,
    valueHistory: valueHistory(db)
  };
}
```

- [ ] **Step 4: Update `+page.svelte`**

In `src/routes/+page.svelte`, add the component import alongside the other `$lib/components` imports:

```ts
  import ValueChart from '$lib/components/ValueChart.svelte';
```

Add a new card immediately after the closing `</div>` of the `<div class="tiles">` block and before the `<section class="card">` that contains `<h2>By console</h2>`:

```svelte
<section class="card">
  <h2>Value over time</h2>
  <ValueChart history={data.valueHistory} />
</section>
```

- [ ] **Step 5: Run the tests and type check**

Run: `npx vitest run src/lib/server/dashboard.test.ts src/routes/page.test.ts` — Expected: PASS.
Run: `npx vitest run` — Expected: PASS, whole suite (the existing `dashboardData` total tests still pass — `collectionTotalCents` computes the same figure the loop did).
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```
git add src/lib/server/dashboard.ts src/routes/+page.svelte src/lib/server/dashboard.test.ts src/routes/page.test.ts
git commit -m "Show the value-over-time chart on the dashboard" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Phase 1 group review

After Tasks 1–6:

```
Review the batch from multiple perspectives. Minimum 3 review rounds.
If round 3 still finds issues, keep going until clean.
```

Phase-specific review dimensions:
- **One total, not two:** `collectionTotalCents` is the only place the collection total is defined; `dashboardData` and `refreshEstimates` both route through it. No second inline total survives.
- **Data integrity:** `total_value` is recorded on every refresh (incl. aborted); `valueHistory` excludes null-total rows and is oldest-first.
- **Chart correctness:** empty / single / 2+ states each render correctly; the `span === 0` (all-equal values) case does not divide by zero; `circle` count matches point count.
- **No regression:** existing `dashboardData` total tests pass against the refactored function; `+page.server.ts` untouched; `RefreshResult` unchanged.
- **CVT-1** (integer cents) and **CVT-T1** (no live calls) hold.
- `npx vitest run` and `npm run check` clean.

When the phase ships, update the banner and the top-of-plan table per the Living Document Contract.

---

## Spec Coverage Map

| Spec section | Task |
|---|---|
| §1 `total_value` column + migration | 1 |
| §1 `collectionTotalCents` (canonical total) | 2 |
| §1 recording the total in `refreshEstimates` / `RefreshEventUpdate` | 3 |
| §2 `valueHistory` query + `ValuePoint` | 4 |
| §3 `ValueChart.svelte` (empty / single / line states) | 5 |
| §4 dashboard wiring (`DashboardData`, the card) | 6 |
| Testing section | every task's tests + the group review |
