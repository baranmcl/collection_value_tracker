# Small-Items Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface estimate quality (age + low-confidence) on the Collection screen, add a CSV export of the collection, and add a one-click consistent database-backup download.

**Architecture:** Three independent phases. Phase 1 adds a pure `estimate-quality` module and a shared `enrichedCollection` server helper, then wires age/staleness/low-confidence into the Collection row. Phase 2 adds a pure RFC-4180 CSV formatter and a `/api/export` route that reuses `enrichedCollection`. Phase 3 exposes the raw SQLite connection and adds a `/api/backup` route that streams a `VACUUM INTO` snapshot. Routes follow the project's `logic.ts` (db-injected, testable) + thin `+server.ts` pattern.

**Tech Stack:** SvelteKit 2 / Svelte 5, TypeScript, better-sqlite3 + Drizzle ORM, Vitest 4, `@testing-library/svelte`.

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

**Overall:** Not started.

| Phase | Status | Ship SHA(s) | Notes |
|---|---|---|---|
| 1 — Estimate Quality | ⬜ Not started | — | Tasks 1.1–1.4 |
| 2 — CSV Export | ⬜ Not started | — | Tasks 2.1–2.3 |
| 3 — Database Backup | ⬜ Not started | — | Tasks 3.1–3.2 |

---

## Source Spec

This plan implements `docs/superpowers/specs/2026-05-21-small-items-batch-design.md`. Read it for rationale; this plan is the executable form.

## Task Discipline (applies to every task)

**§A — Before starting any task:** Invoke `superpowers:test-driven-development`. Read `docs/pitfalls/testing-pitfalls.md`. Follow TDD: write the failing test → run it, confirm it fails for the expected reason → minimum code to pass → run it, confirm green.

**§B — Before marking any task complete:** Review the new tests against `docs/pitfalls/testing-pitfalls.md`. Run `npx vitest run` (whole suite green) and `npm run check` (0 errors, 0 warnings). Test output pristine — no stray stderr, no debug prints.

**§C — Commit messages:** every `git commit` MUST end with the trailer via a second `-m`:
`git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"`

**Project pitfalls binding here:**
- **CVT-1 (money is integer cents).** Values stay integer cents in every query, helper, and load. The ONLY cents→dollars conversion is in the CSV formatter's `dollars()` helper, at the output boundary (Task 2.1). Pixel/pagination/listing-count numbers are not money.
- **CVT-2 (prices are estimates, not facts).** The age and low-confidence indicators reinforce this — they MUST render only for `valueSource === 'estimate'` rows, never for manual prices.
- **CVT-T1 (no live external calls in tests).** All Workstream D code is local — no eBay or TheGamesDB calls. Tests use a test DB; no network.

**Convention — ABOUTME headers:** source `.ts` modules under `src/lib/` get a 2-line `// ABOUTME:` header (the task code blocks below include them). `.svelte` files, route `+server.ts` / `+page.server.ts` / `+page.svelte` files, and `.test.ts` files do NOT get ABOUTME headers — match the existing files. Route `logic.ts` files DO get one (see `src/routes/api/refresh/logic.ts`, which has one). **Exception:** `src/lib/db/test-db.ts` is a test-only helper and currently has NO header — Task 3.1 rewrites it; keep it headerless to match its current form. Do NOT add an ABOUTME header to it.

## Execution Setup

Work continues on the existing branch `feat/small-items-batch` (created for the spec commit `ad49e58`) — do NOT execute on `main`, do NOT create a new branch. Execute tasks in numeric order (1.1 → 3.2). When done, use `superpowers:finishing-a-development-branch`.

---

## Phase 1 — Estimate Quality

**Execution Status:** ⬜ NOT STARTED

Adds the estimate age line, the stale treatment, and the low-confidence marker to the Collection screen. Tasks 1.1–1.3 build the pure/query layers; Task 1.4 wires them into the route.

### Task 1.1: The `estimate-quality` module

**Files:**
- Create: `src/lib/estimate-quality.ts`
- Test: `src/lib/estimate-quality.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Context:** A pure module holding the display policy for estimate quality — relative age, the staleness threshold, and the low-confidence threshold. No I/O. `relativeAge` and `isStale` take an explicit `now` so they are deterministic and unit-testable.

- [ ] **Step 1: Write the failing test**

Create `src/lib/estimate-quality.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { relativeAge, isStale, isLowConfidence } from './estimate-quality';

const now = new Date('2026-05-21T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe('relativeAge', () => {
  it('reads "today" for under one day', () => {
    expect(relativeAge(ago(0), now)).toBe('today');
    expect(relativeAge(new Date(now.getTime() - 3_600_000), now)).toBe('today');
  });
  it('reads days, weeks, months, and years, rounded down', () => {
    expect(relativeAge(ago(3), now)).toBe('3d ago');
    expect(relativeAge(ago(14), now)).toBe('2w ago');
    expect(relativeAge(ago(90), now)).toBe('3mo ago');
    expect(relativeAge(ago(800), now)).toBe('2y ago');
  });
  it('switches unit exactly at the day-7 boundary', () => {
    expect(relativeAge(ago(6), now)).toBe('6d ago');
    expect(relativeAge(ago(7), now)).toBe('1w ago');
  });
});

describe('isStale', () => {
  it('is false within the 30-day window and true past it', () => {
    expect(isStale(ago(29), now)).toBe(false);
    expect(isStale(ago(31), now)).toBe(true);
  });
});

describe('isLowConfidence', () => {
  it('flags estimates built on fewer than 3 listings', () => {
    expect(isLowConfidence(0)).toBe(true);
    expect(isLowConfidence(2)).toBe(true);
    expect(isLowConfidence(3)).toBe(false);
    expect(isLowConfidence(10)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/estimate-quality.test.ts`
Expected: FAIL — `Cannot find module './estimate-quality'`.

- [ ] **Step 3: Create `src/lib/estimate-quality.ts`**

```ts
// ABOUTME: Display policy for price-estimate quality — how old an estimate is
// ABOUTME: (relative age, staleness) and whether it rests on too few listings.

export const STALE_AFTER_DAYS = 30;
export const LOW_CONFIDENCE_BELOW = 3; // estimates from fewer listings are thin

const MS_PER_DAY = 86_400_000;

/** A short relative age — "today", "3d ago", "2w ago", "5mo ago", "2y ago".
 *  Rounds down to the largest whole unit. */
export function relativeAge(at: Date, now: Date): string {
  const days = Math.floor((now.getTime() - at.getTime()) / MS_PER_DAY);
  if (days <= 0) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** True once an estimate is older than STALE_AFTER_DAYS. */
export function isStale(at: Date, now: Date): boolean {
  return now.getTime() - at.getTime() > STALE_AFTER_DAYS * MS_PER_DAY;
}

/** True when an estimate rests on fewer listings than the confidence floor. */
export function isLowConfidence(listingCount: number): boolean {
  return listingCount < LOW_CONFIDENCE_BELOW;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/estimate-quality.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```
git add src/lib/estimate-quality.ts src/lib/estimate-quality.test.ts
git commit -m "Add estimate-quality module (relative age, staleness, confidence)" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.2: `estimateRecords` query

**Files:**
- Modify: `src/lib/db/queries/prices.ts`
- Test: `src/lib/db/queries/prices.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Context:** The Collection screen needs each estimate's `computedAt` and `listingCount`, not just its value. `estimateMap` (used by Browse and the dashboard) returns value-only and MUST stay unchanged. `estimateRecords` returns the full estimate rows. `PriceEstimate` is the inferred select type already exported from `../schema`.

**Do NOT:** do not modify `estimateMap`, `resolveItemValue`, `collectionTotalCents`, `upsertEstimate`, or `getEstimate`.

- [ ] **Step 1: Write the failing test**

In `src/lib/db/queries/prices.test.ts`, ensure these are imported, adding any that are missing: `estimateRecords` (from `./prices`), `makeTestDb` (from `$lib/db/test-db`), `upsertEstimate` (from `./prices`), and `upsertGames` (from `$lib/db/queries/games`). A `price_estimates` row has a foreign key to `games.id`, so a game row must exist first — that is why `upsertGames` is needed. Add this block:

```ts
describe('estimateRecords', () => {
  it('returns the full estimate row keyed by game:condition', () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'Chrono Trigger', region: null, releaseYear: 1995 }]);
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 4200, listingCount: 5 });

    const rec = estimateRecords(db).get('1:loose');
    expect(rec?.estimate).toBe(4200);
    expect(rec?.listingCount).toBe(5);
    expect(rec?.computedAt).toBeInstanceOf(Date);
    expect(estimateRecords(db).has('1:cib')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/db/queries/prices.test.ts`
Expected: FAIL — `estimateRecords` is not exported.

- [ ] **Step 3: Add `estimateRecords` to `prices.ts`**

Add `type PriceEstimate` to the existing import from `../schema` (the file currently imports `{ priceEstimates }`):

```ts
import { priceEstimates, type PriceEstimate } from '../schema';
```

Add this function immediately after `estimateMap`:

```ts
/** Full estimate rows keyed `${gameId}:${condition}` — value plus computedAt
 *  and listingCount, for the Collection screen's quality indicators. */
export function estimateRecords(db: DB): Map<string, PriceEstimate> {
  const rows = db.select().from(priceEstimates).all();
  return new Map(rows.map((r) => [`${r.gameId}:${r.condition}`, r]));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/db/queries/prices.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/lib/db/queries/prices.ts src/lib/db/queries/prices.test.ts
git commit -m "Add estimateRecords query — full estimate rows by game:condition" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.3: `enrichedCollection` server helper

**Files:**
- Create: `src/lib/server/collection.ts`
- Test: `src/lib/server/collection.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 1.2 (`estimateRecords`).

**Context:** The Collection load (Task 1.4) and the CSV export route (Task 2.2) both need the same value-resolved collection. `enrichedCollection` is the one definition — it mirrors `src/lib/server/dashboard.ts`. It MUST preserve exactly the `value` / `valueSource` semantics the current Collection load (`src/routes/collection/+page.server.ts:10-20`) produces: manual price wins (`'manual'`), else a non-null estimate value (`'estimate'`), else `'unknown'`. A manual-priced item carries `null` estimate metadata even when an estimate row exists. Row order is `listCollection`'s — alphabetical by title.

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/collection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, updateItem } from '$lib/db/queries/collection';
import { upsertEstimate } from '$lib/db/queries/prices';
import { enrichedCollection } from './collection';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [
    { id: 1, console: 'SNES', title: 'Estimate Game', region: null, releaseYear: 1995 },
    { id: 2, console: 'N64', title: 'Manual Game', region: null, releaseYear: 1997 },
    { id: 3, console: 'GBA', title: 'Unknown Game', region: null, releaseYear: 2002 }
  ]);
  return db;
}

describe('enrichedCollection', () => {
  it('resolves an estimate-valued item with its estimate metadata', () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 4200, listingCount: 5 });
    const item = enrichedCollection(db).find((i) => i.gameId === 1)!;
    expect(item.value).toBe(4200);
    expect(item.valueSource).toBe('estimate');
    expect(item.estimatedAt).toBeInstanceOf(Date);
    expect(item.listingCount).toBe(5);
  });

  it('gives a manual-priced item no estimate metadata even if an estimate exists', () => {
    const db = seed();
    const id = addItem(db, { gameId: 2, condition: 'cib' });
    updateItem(db, id, { manualPrice: 9000 });
    upsertEstimate(db, { gameId: 2, condition: 'cib', estimate: 1111, listingCount: 8 });
    const item = enrichedCollection(db).find((i) => i.gameId === 2)!;
    expect(item.value).toBe(9000);
    expect(item.valueSource).toBe('manual');
    expect(item.estimatedAt).toBeNull();
    expect(item.listingCount).toBeNull();
  });

  it('marks an item with neither a manual price nor an estimate as unknown', () => {
    const db = seed();
    addItem(db, { gameId: 3, condition: 'new' });
    const item = enrichedCollection(db).find((i) => i.gameId === 3)!;
    expect(item.value).toBeNull();
    expect(item.valueSource).toBe('unknown');
    expect(item.estimatedAt).toBeNull();
    expect(item.listingCount).toBeNull();
  });

  it('treats an estimate row with a null value as unknown, carrying no metadata', () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    // An estimate row can exist with a null value (e.g. zero qualifying listings).
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: null, listingCount: 0 });
    const item = enrichedCollection(db).find((i) => i.gameId === 1)!;
    expect(item.value).toBeNull();
    expect(item.valueSource).toBe('unknown');
    expect(item.estimatedAt).toBeNull();
    expect(item.listingCount).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/server/collection.test.ts`
Expected: FAIL — `Cannot find module './collection'`.

- [ ] **Step 3: Create `src/lib/server/collection.ts`**

```ts
// ABOUTME: The value-resolved collection — every owned item with its resolved
// ABOUTME: value, value source, and (when estimate-sourced) estimate metadata.
import type { DB } from '$lib/db/client';
import { listCollection } from '$lib/db/queries/collection';
import { estimateRecords, resolveItemValue } from '$lib/db/queries/prices';

export interface EnrichedItem {
  id: number;
  gameId: number;
  title: string;
  console: string;
  boxartUrl: string | null;
  condition: string;
  grade: string | null;
  notes: string | null;
  acquiredAt: string | null;
  manualPrice: number | null;
  value: number | null; // resolved, integer cents
  valueSource: 'manual' | 'estimate' | 'unknown';
  estimatedAt: Date | null; // the estimate's computedAt, when valueSource === 'estimate'
  listingCount: number | null; // the estimate's listingCount, when valueSource === 'estimate'
}

/** Every collection item with its resolved value and estimate metadata.
 *  Row order is listCollection's — alphabetical by title. */
export function enrichedCollection(db: DB): EnrichedItem[] {
  const rows = listCollection(db);
  const estimates = estimateRecords(db);
  return rows.map((r) => {
    const est = estimates.get(`${r.gameId}:${r.condition}`) ?? null;
    const value = resolveItemValue(r, est?.estimate ?? null);
    const valueSource: EnrichedItem['valueSource'] =
      r.manualPrice !== null ? 'manual' : est?.estimate != null ? 'estimate' : 'unknown';
    const fromEstimate = valueSource === 'estimate';
    return {
      id: r.id,
      gameId: r.gameId,
      title: r.title,
      console: r.console,
      boxartUrl: r.boxartUrl,
      condition: r.condition,
      grade: r.grade,
      notes: r.notes,
      acquiredAt: r.acquiredAt,
      manualPrice: r.manualPrice,
      value,
      valueSource,
      estimatedAt: fromEstimate ? est!.computedAt : null,
      listingCount: fromEstimate ? est!.listingCount : null
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/server/collection.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```
git add src/lib/server/collection.ts src/lib/server/collection.test.ts
git commit -m "Add enrichedCollection — the value-resolved collection helper" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.4: Wire estimate quality into the Collection screen

**Files:**
- Modify: `src/routes/collection/+page.server.ts`
- Modify: `src/routes/collection/+page.svelte`
- Test: `src/routes/collection/page.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 1.1 (`estimate-quality`), Task 1.3 (`enrichedCollection`).

**Context:** The Collection `load` switches its item source to `enrichedCollection`, and adds two presentation fields per item: `estimateAge` (the `relativeAge` string, or `null`) and `estimateStale` (the `isStale` boolean). It keeps emitting `listingCount`. The `+page.svelte` Value cell — inside the existing `<span class="num val">`, after the `value-source` `<small>` — gains an age line (only when `estimateAge` is set) with a `.stale` class when `estimateStale`, and a low-confidence marker when `listingCount` is below the floor. Manual and unknown rows show neither (CVT-2).

**Do NOT:** do not change the sorting/filtering logic, the summary tiles, the row grid columns, `GameThumb`, `ItemEditor`, or `ConditionButton`. Do not change `totalValue` / `averageValue` computation.

- [ ] **Step 1: Write the failing tests**

In `src/routes/collection/page.test.ts`:

(a) Add the three new fields to **every item** in both the `data` and `sortData` fixture object literals. For the estimate-sourced items (every `sortData` item, and `data` item id 1) add `estimateAge: '3d ago', estimateStale: false, listingCount: 5`. For the manual item (`data` item id 2) add `estimateAge: null, estimateStale: false, listingCount: null`. Keep the fixtures as plain object literals — match the file's existing untyped style.

(b) Add these tests inside the existing `describe('collection page', ...)` block:

```ts
  it('shows the relative age of an estimate-sourced value', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('est. 3d ago')).toBeInTheDocument();
  });
  it('renders an age line only for estimate-sourced items', () => {
    // data has one estimate item (id 1) and one manual item (id 2)
    const { container } = render(Page, { props: { data } });
    expect(container.querySelectorAll('.age').length).toBe(1);
  });
  it('marks a stale estimate with the stale class', () => {
    const staleData = { ...data, items: [{ ...data.items[0], estimateStale: true }] };
    const { container } = render(Page, { props: { data: staleData } });
    expect(container.querySelector('.age.stale')).not.toBeNull();
  });
  it('flags a low-confidence estimate with its listing count', () => {
    const thinData = { ...data, items: [{ ...data.items[0], listingCount: 1 }] };
    const { getByText } = render(Page, { props: { data: thinData } });
    expect(getByText(/⚠ 1 listing/)).toBeInTheDocument();
  });
  it('shows no low-confidence marker when the estimate has enough listings', () => {
    // data item 1 has listingCount 5 — above the floor of 3
    const { container } = render(Page, { props: { data } });
    expect(container.querySelectorAll('.lowconf').length).toBe(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/routes/collection/page.test.ts`
Expected: FAIL — the `.age` / `.lowconf` elements do not exist yet.

- [ ] **Step 3: Rewrite `src/routes/collection/+page.server.ts`**

Replace the entire contents with:

```ts
import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { enrichedCollection } from '$lib/server/collection';
import { relativeAge, isStale } from '$lib/estimate-quality';

export const load: PageServerLoad = async () => {
  const now = new Date();
  const items = enrichedCollection(db).map((i) => ({
    id: i.id,
    gameId: i.gameId,
    title: i.title,
    console: i.console,
    boxartUrl: i.boxartUrl,
    condition: i.condition,
    grade: i.grade,
    notes: i.notes,
    acquiredAt: i.acquiredAt,
    manualPrice: i.manualPrice,
    value: i.value,
    valueSource: i.valueSource,
    estimateAge: i.estimatedAt ? relativeAge(i.estimatedAt, now) : null,
    estimateStale: i.estimatedAt ? isStale(i.estimatedAt, now) : false,
    listingCount: i.listingCount
  }));

  const valued = items.filter((i) => i.value !== null) as { value: number }[];
  const totalValue = valued.reduce((s, i) => s + i.value, 0);
  return {
    items,
    totalValue,
    averageValue: valued.length ? Math.round(totalValue / valued.length) : 0
  };
};
```

- [ ] **Step 4: Update `src/routes/collection/+page.svelte`**

(a) Add to the script imports (after the existing `import { CONDITION_LABELS, ... }` line):

```ts
  import { isLowConfidence } from '$lib/estimate-quality';
```

(b) Find the Value-cell block (currently `+page.svelte:103-106`), which reads exactly:

```svelte
    <span class="num val">
      {formatCents(item.value)}
      <small data-testid={`value-source-${item.id}`} class="src">{item.valueSource}</small>
    </span>
```

Replace it with:

```svelte
    <span class="num val">
      {formatCents(item.value)}
      <small data-testid={`value-source-${item.id}`} class="src">{item.valueSource}</small>
      {#if item.estimateAge}
        <small class="age" class:stale={item.estimateStale}>est. {item.estimateAge}</small>
      {/if}
      {#if item.listingCount !== null && isLowConfidence(item.listingCount)}
        <small class="lowconf">⚠ {item.listingCount} {item.listingCount === 1 ? 'listing' : 'listings'}</small>
      {/if}
    </span>
```

(c) Add to the `<style>` block, after the existing `.src { … }` rule:

```css
  .age { display: block; font-size: 10px; color: var(--text-dim); }
  .age.stale { color: var(--accent-warm); }
  .lowconf { display: block; font-size: 10px; color: var(--accent-warm); }
```

(`.age.stale` uses `--accent-warm` — an attention tone, not an alarm: a stale estimate is worth refreshing, not an error. `--negative` would over-alarm.)

- [ ] **Step 5: Run the tests and type check**

Run: `npx vitest run src/routes/collection/page.test.ts` — Expected: PASS.
Run: `npx vitest run` — Expected: PASS, whole suite.
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```
git add src/routes/collection/+page.server.ts src/routes/collection/+page.svelte src/routes/collection/page.test.ts
git commit -m "Show estimate age, staleness, and low-confidence on the Collection screen" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Phase 1 group review

After Tasks 1.1–1.4:

```
Review the batch from multiple perspectives. Minimum 3 review rounds.
If round 3 still finds issues, keep going until clean.
```

Phase-specific review dimensions:
- **CVT-2 — estimates only:** the age line and the low-confidence marker render for `valueSource === 'estimate'` rows ONLY; a manual-priced or unknown row shows neither.
- **Value/source semantics preserved:** `enrichedCollection`'s `value` / `valueSource` match exactly what the old Collection load produced (manual wins; non-null estimate → `'estimate'`; else `'unknown'`); `totalValue` / `averageValue` are unchanged.
- **`estimateMap` untouched:** Browse and the dashboard still use the value-only `estimateMap`; only `estimateRecords` is new.
- **Pure helpers deterministic:** `relativeAge` / `isStale` take an injected `now`; no `new Date()` inside them.
- **CVT-T1:** every new test uses a test DB; no live calls.
- `npx vitest run` and `npm run check` clean.

When the phase ships, update the banner and the top-of-plan table per the Living Document Contract.

---

## Phase 2 — CSV Export

**Execution Status:** ⬜ NOT STARTED

Adds a downloadable CSV of the collection. Depends on Phase 1's `enrichedCollection` (Task 1.3).

### Task 2.1: `collectionToCsv` formatter

**Files:**
- Create: `src/lib/export/csv.ts`
- Test: `src/lib/export/csv.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 1.3 (`EnrichedItem`).

**Context:** A pure RFC-4180 CSV formatter — `EnrichedItem[]` in, a CSV string out. Header row, then one row per item, records joined with `\r\n` (no trailing newline). A field containing a comma, a double quote, CR, or LF is wrapped in double quotes with embedded quotes doubled — this matters because `notes` is free user text (testing-pitfalls §4: unicode/encoding edge cases). The `Value (USD)` column is a bare `"42.00"` string (no `$`); cents→dollars conversion happens ONLY here, at the output boundary (CVT-1).

**Do NOT:** do not use `formatCents` (it prefixes `$`); do not add columns beyond the eight listed.

- [ ] **Step 1: Write the failing test**

Create `src/lib/export/csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { collectionToCsv } from './csv';
import type { EnrichedItem } from '$lib/server/collection';

function item(over: Partial<EnrichedItem>): EnrichedItem {
  return {
    id: 1, gameId: 1, title: 'Chrono Trigger', console: 'SNES', boxartUrl: null,
    condition: 'loose', grade: 'mint', notes: null, acquiredAt: '2024-01-15',
    manualPrice: null, value: 4200, valueSource: 'estimate',
    estimatedAt: null, listingCount: 5, ...over
  };
}

describe('collectionToCsv', () => {
  it('emits the header row first', () => {
    expect(collectionToCsv([])).toBe(
      'Title,Console,Condition,Grade,Value (USD),Value Source,Acquired,Notes'
    );
  });

  it('renders a plain item row with a bare dollar value and the condition label', () => {
    const csv = collectionToCsv([item({})]);
    expect(csv.split('\r\n')[1]).toBe('Chrono Trigger,SNES,Loose,mint,42.00,estimate,2024-01-15,');
  });

  it('quotes a field with a comma, a quote, or a newline and doubles inner quotes', () => {
    const csv = collectionToCsv([item({ notes: 'has, comma and "quote"\nand newline' })]);
    const row = csv.split('\r\n')[1];
    expect(row.endsWith('"has, comma and ""quote""\nand newline"')).toBe(true);
  });

  it('renders null grade, acquired, and value as empty cells', () => {
    const csv = collectionToCsv([item({ grade: null, acquiredAt: null, value: null })]);
    expect(csv.split('\r\n')[1]).toBe('Chrono Trigger,SNES,Loose,,,estimate,,');
  });

  it('formats a non-round cents value as dollars and cents', () => {
    const csv = collectionToCsv([item({ value: 4250 })]);
    expect(csv.split('\r\n')[1]).toBe('Chrono Trigger,SNES,Loose,mint,42.50,estimate,2024-01-15,');
  });

  it('separates records with CRLF', () => {
    const csv = collectionToCsv([item({ id: 1 }), item({ id: 2, title: 'Zelda' })]);
    expect(csv.split('\r\n').length).toBe(3); // header + 2 rows
  });
});
```

Note: the `notes` test string contains a real newline (`\n`), which is NOT `\r\n`, so `split('\r\n')` keeps that record intact.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/export/csv.test.ts`
Expected: FAIL — `Cannot find module './csv'`.

- [ ] **Step 3: Create `src/lib/export/csv.ts`**

Before writing, open `src/lib/types.ts` and confirm `CONDITION_LABELS` maps `'loose' → 'Loose'`, `'cib' → 'CIB'`, `'new' → 'New'`, and that `Condition` is the union type. If a label differs, the test's expected `'Loose'` must match the real label — adjust the test, not the labels.

```ts
// ABOUTME: Renders the collection as RFC 4180 CSV — a header row plus one row
// ABOUTME: per item, with comma/quote/newline-bearing fields properly quoted.
import type { EnrichedItem } from '$lib/server/collection';
import { CONDITION_LABELS, type Condition } from '$lib/types';

const HEADER = ['Title', 'Console', 'Condition', 'Grade', 'Value (USD)', 'Value Source', 'Acquired', 'Notes'];

/** Quote a CSV field per RFC 4180: wrap in double quotes when it contains a
 *  comma, a double quote, CR, or LF; double any embedded quotes. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

/** Integer cents as a bare dollar string ("4200" → "42.00"); null → empty. */
function dollars(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

/** The whole collection as an RFC 4180 CSV string (CRLF record separators). */
export function collectionToCsv(items: EnrichedItem[]): string {
  const rows = items.map((i) => [
    i.title,
    i.console,
    CONDITION_LABELS[i.condition as Condition] ?? i.condition,
    i.grade ?? '',
    dollars(i.value),
    i.valueSource,
    i.acquiredAt ?? '',
    i.notes ?? ''
  ]);
  return [HEADER, ...rows].map((cols) => cols.map(csvField).join(',')).join('\r\n');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/export/csv.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```
git add src/lib/export/csv.ts src/lib/export/csv.test.ts
git commit -m "Add collectionToCsv — RFC 4180 CSV formatter for the collection" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.2: `/api/export` route

**Files:**
- Create: `src/routes/api/export/logic.ts`
- Create: `src/routes/api/export/+server.ts`
- Test: `src/routes/api/export/logic.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 1.3 (`enrichedCollection`), Task 2.1 (`collectionToCsv`).

**Context:** Following the project's route pattern (`src/routes/api/refresh/logic.ts` + thin `+server.ts`), `logic.ts` holds a `db`-injected, testable function that returns a complete `Response`; `+server.ts` is a one-line wrapper passing the real `db` and `new Date()`. `exportCsv` returns the CSV as a `text/csv` attachment named `collection-<yyyy-mm-dd>.csv` (dated by the injected `now`).

- [ ] **Step 1: Write the failing test**

Create `src/routes/api/export/logic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem } from '$lib/db/queries/collection';
import { upsertEstimate } from '$lib/db/queries/prices';
import { exportCsv } from './logic';

describe('exportCsv', () => {
  it('returns a CSV attachment dated by `now`', async () => {
    const res = exportCsv(makeTestDb(), new Date('2026-05-21T00:00:00Z'));
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="collection-2026-05-21.csv"'
    );
    const body = await res.text();
    expect(body.split('\r\n')[0]).toBe(
      'Title,Console,Condition,Grade,Value (USD),Value Source,Acquired,Notes'
    );
  });

  it('includes a seeded collection item in the body', async () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'Chrono Trigger', region: null, releaseYear: 1995 }]);
    addItem(db, { gameId: 1, condition: 'loose' });
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 4200, listingCount: 5 });
    const body = await exportCsv(db, new Date('2026-05-21T00:00:00Z')).text();
    expect(body).toContain('Chrono Trigger,SNES,Loose,,42.00,estimate,,');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/api/export/logic.test.ts`
Expected: FAIL — `Cannot find module './logic'`.

- [ ] **Step 3: Create `src/routes/api/export/logic.ts`**

```ts
// ABOUTME: Builds the collection-CSV download response — the enriched
// ABOUTME: collection rendered to CSV with the right headers and filename.
import type { DB } from '$lib/db/client';
import { enrichedCollection } from '$lib/server/collection';
import { collectionToCsv } from '$lib/export/csv';

/** A CSV-download Response for the whole collection. `now` dates the filename. */
export function exportCsv(db: DB, now: Date): Response {
  const csv = collectionToCsv(enrichedCollection(db));
  const date = now.toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="collection-${date}.csv"`
    }
  });
}
```

- [ ] **Step 4: Create `src/routes/api/export/+server.ts`**

```ts
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { exportCsv } from './logic';

export const GET: RequestHandler = () => exportCsv(db, new Date());
```

- [ ] **Step 5: Run the test and type check**

Run: `npx vitest run src/routes/api/export/logic.test.ts` — Expected: PASS.
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```
git add src/routes/api/export/logic.ts src/routes/api/export/+server.ts src/routes/api/export/logic.test.ts
git commit -m "Add /api/export route — CSV download of the collection" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.3: Export CSV link on the Collection screen

**Files:**
- Modify: `src/routes/collection/+page.svelte`
- Test: `src/routes/collection/page.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 2.2 (`/api/export` route).

**Context:** The Collection screen's controls row gains an "Export CSV" link — a plain `<a href="/api/export" download>`. A link, not a `fetch`: the browser downloads directly. Task 1.4 already modified this file and `page.test.ts`; this task adds to them.

**Do NOT:** do not change the filter input, the console select, the sorting logic, or anything from Task 1.4.

- [ ] **Step 1: Write the failing test**

In `src/routes/collection/page.test.ts`, add this test inside the `describe('collection page', ...)` block:

```ts
  it('has an Export CSV link pointing at the export route', () => {
    const { getByText } = render(Page, { props: { data } });
    const link = getByText('Export CSV');
    expect(link.getAttribute('href')).toBe('/api/export');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/collection/page.test.ts`
Expected: FAIL — no "Export CSV" element.

- [ ] **Step 3: Add the link to `src/routes/collection/+page.svelte`**

(a) In the `<div class="controls">` block, add as the last child, after the `<label>Console …</label>`:

```svelte
    <a class="export" href="/api/export" download>Export CSV</a>
```

(b) Add to the `<style>` block, after the `input, select { … }` rule:

```css
  .export {
    margin-left: auto; align-self: center;
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-2) var(--space-3);
    font-size: var(--fs-sm); text-decoration: none;
  }
```

- [ ] **Step 4: Run the tests and type check**

Run: `npx vitest run src/routes/collection/page.test.ts` — Expected: PASS.
Run: `npx vitest run` — Expected: PASS, whole suite.
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```
git add src/routes/collection/+page.svelte src/routes/collection/page.test.ts
git commit -m "Add Export CSV link to the Collection screen" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Phase 2 group review

After Tasks 2.1–2.3:

```
Review the batch from multiple perspectives. Minimum 3 review rounds.
If round 3 still finds issues, keep going until clean.
```

Phase-specific review dimensions:
- **CSV escaping is correct:** comma, double-quote, CR, LF in any field (especially `notes`) → the field is quoted, inner quotes doubled; an unproblematic field is left bare.
- **CVT-1:** the only cents→dollars conversion is `csv.ts`'s `dollars()`; `formatCents` is not used; values are integer cents everywhere else.
- **Headers correct:** `/api/export` returns `text/csv; charset=utf-8` and a dated `attachment` filename; the body's first line is the header row.
- **Reuse, not duplication:** the route uses `enrichedCollection` — value resolution is not re-implemented.
- **CVT-T1:** the route logic test uses a test DB; no live calls.
- `npx vitest run` and `npm run check` clean.

When the phase ships, update the banner and the top-of-plan table per the Living Document Contract.

---

## Phase 3 — Database Backup

**Execution Status:** ⬜ NOT STARTED

Adds a one-click download of a consistent SQLite snapshot. Independent of Phases 1 and 2.

### Task 3.1: `/api/backup` route

**Files:**
- Modify: `src/lib/db/client.ts`
- Modify: `src/lib/db/test-db.ts`
- Create: `src/routes/api/backup/logic.ts`
- Create: `src/routes/api/backup/+server.ts`
- Test: `src/routes/api/backup/logic.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Context:** `VACUUM INTO` produces a single-file, fully consistent, defragmented snapshot of a live SQLite database — correct even mid-write, which a plain filesystem copy of a WAL database is not. It must run on the raw better-sqlite3 connection (Drizzle has no snapshot primitive), so `client.ts` starts exporting that connection. `test-db.ts` gains a `makeRawTestDb` that returns the raw connection alongside the Drizzle db, so the backup logic can be tested against a populated in-memory DB; `makeTestDb` is reimplemented in terms of it with an unchanged signature, so its existing callers are unaffected. The route follows the `logic.ts` + thin `+server.ts` pattern: `backupDatabase(sqlite, now)` returns a complete `Response`.

**testing-pitfalls binding:** §3 (error-path resource cleanup — the temp snapshot file MUST be removed even when `VACUUM INTO` throws; there is an explicit test for this). §7 (no shared mutable state — the temp directory is shared OS state, so the cleanup tests use a before/after delta on `cvt-backup-*` files rather than an absolute count).

**Do NOT:** do not change `makeTestDb`'s return type or signature. Do not weaken the temp-file-cleanup assertion if it is awkward — the cleanup is the point of the test.

- [ ] **Step 1: Write the failing test**

Create `src/routes/api/backup/logic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { makeRawTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { backupDatabase } from './logic';

const SQLITE_MAGIC = 'SQLite format 3\0';
const tempBackupCount = () =>
  readdirSync(tmpdir()).filter((f) => f.startsWith('cvt-backup-')).length;

describe('backupDatabase', () => {
  it('returns a .db attachment whose bytes are a valid SQLite file', async () => {
    const { db, sqlite } = makeRawTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'Chrono Trigger', region: null, releaseYear: 1995 }]);
    const res = backupDatabase(sqlite, new Date('2026-05-21T00:00:00Z'));
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="collection-backup-2026-05-21.db"'
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 16))).toBe(SQLITE_MAGIC);
  });

  it('leaves no temp file behind on success', () => {
    const { db, sqlite } = makeRawTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'A', region: null, releaseYear: 1995 }]);
    const before = tempBackupCount();
    backupDatabase(sqlite, new Date());
    expect(tempBackupCount()).toBe(before);
  });

  it('cleans up and rethrows when the snapshot fails', () => {
    const { sqlite } = makeRawTestDb();
    sqlite.close(); // a closed connection makes VACUUM INTO throw
    const before = tempBackupCount();
    expect(() => backupDatabase(sqlite, new Date())).toThrow();
    expect(tempBackupCount()).toBe(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/api/backup/logic.test.ts`
Expected: FAIL — `makeRawTestDb` is not exported and `./logic` does not exist.

- [ ] **Step 3: Add `makeRawTestDb` to `src/lib/db/test-db.ts`**

Replace the entire contents with:

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

/** In-memory DB with the full schema applied, plus its raw connection.
 *  For tests only. */
export function makeRawTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return { db, sqlite };
}

/** In-memory DB with the full schema applied. For tests only. */
export function makeTestDb() {
  return makeRawTestDb().db;
}
```

- [ ] **Step 4: Export the raw connection from `src/lib/db/client.ts`**

Change the `const sqlite = new Database(DB_PATH);` line (currently `client.ts:12`) to:

```ts
export const sqlite = new Database(DB_PATH);
```

Change nothing else in `client.ts`.

- [ ] **Step 5: Create `src/routes/api/backup/logic.ts`**

```ts
// ABOUTME: Builds the database-backup download response — a consistent SQLite
// ABOUTME: snapshot via VACUUM INTO, streamed as a .db file attachment.
import type Database from 'better-sqlite3';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** A download Response carrying a consistent snapshot of the database.
 *  `VACUUM INTO` writes a single defragmented file, correct even while the
 *  live WAL database is being written. `now` dates the filename. The temp
 *  snapshot is removed even if the snapshot throws. */
export function backupDatabase(sqlite: Database.Database, now: Date): Response {
  const tempPath = join(tmpdir(), `cvt-backup-${randomUUID()}.db`);
  try {
    sqlite.prepare('VACUUM INTO ?').run(tempPath);
    const bytes = readFileSync(tempPath);
    const date = now.toISOString().slice(0, 10);
    return new Response(bytes, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="collection-backup-${date}.db"`
      }
    });
  } finally {
    rmSync(tempPath, { force: true });
  }
}
```

Note: SQLite's `VACUUM INTO` documentation explicitly allows a bound parameter for the target path, so `prepare('VACUUM INTO ?').run(tempPath)` is correct and avoids any path-quoting concern. If — and only if — that form is rejected at runtime, the documented fallback is `sqlite.exec(\`VACUUM INTO '\${tempPath.replace(/'/g, "''")}'\`)`; record the deviation in the plan if you must use it.

Note: `readFileSync` returns a Node `Buffer`, which is a `Uint8Array` and a valid `Response` body. If `npm run check` flags the `new Response(bytes, …)` call on the `Buffer` type, wrap it: `new Response(new Uint8Array(bytes), …)`. Do not change anything else.

- [ ] **Step 6: Create `src/routes/api/backup/+server.ts`**

```ts
import type { RequestHandler } from './$types';
import { sqlite } from '$lib/db/client';
import { backupDatabase } from './logic';

export const GET: RequestHandler = () => backupDatabase(sqlite, new Date());
```

- [ ] **Step 7: Run the tests and type check**

Run: `npx vitest run src/routes/api/backup/logic.test.ts` — Expected: PASS — 3 tests.
Run: `npx vitest run` — Expected: PASS, whole suite (confirms the `makeTestDb` refactor broke no existing test).
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 8: Commit**

```
git add src/lib/db/client.ts src/lib/db/test-db.ts src/routes/api/backup/logic.ts src/routes/api/backup/+server.ts src/routes/api/backup/logic.test.ts
git commit -m "Add /api/backup route — consistent SQLite snapshot download" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.2: Download backup button on Settings

**Files:**
- Modify: `src/routes/settings/+page.svelte`
- Test: `src/routes/settings/page.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 3.1 (`/api/backup` route).

**Context:** The Settings screen gains a "Backup" card with a "Download backup" link (`<a href="/api/backup" download>` styled as a button). The current footnote's first sentence ("Database lives at `data/collection.db` — back it up by copying that file.") is removed — the button supersedes it. The footnote's second sentence ("Nothing is sent anywhere except external price and catalog APIs.") stays.

**Do NOT:** do not change the Catalog, Prices, Credentials, or Recent-refreshes cards, the sync/refresh logic, or the `RefreshProgressBar`.

- [ ] **Step 1: Write the failing test**

Open `src/routes/settings/page.test.ts`, read its existing `data` fixture and `render` calls. Add this test inside the existing top-level `describe(...)` block, reusing whatever `data` fixture the file already defines (the backup link does not depend on `data`):

```ts
  it('has a Download backup link pointing at the backup route', () => {
    const { getByText } = render(Page, { props: { data } });
    const link = getByText('Download backup');
    expect(link.getAttribute('href')).toBe('/api/backup');
  });
```

If the file's existing tests use a differently-named fixture variable, match that name.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/settings/page.test.ts`
Expected: FAIL — no "Download backup" element.

- [ ] **Step 3: Add the Backup card to `src/routes/settings/+page.svelte`**

(a) Add a new `<section class="card">` immediately after the closing `</section>` of the "Recent refreshes" card and immediately before the `{#if message}` line (currently `+page.svelte:168` is that `</section>`, `+page.svelte:170` is the `{#if message}` line) — so the Backup card sits with the other cards, leaving the status message and footnote at the bottom:

```svelte
<section class="card">
  <h2>Backup</h2>
  <p>Download a complete snapshot of the database — catalog, collection, and price history.</p>
  <a class="button" href="/api/backup" download>Download backup</a>
</section>
```

(b) Replace the footnote paragraph (currently `+page.svelte:172-175`) with:

```svelte
<p class="dim footnote">
  Nothing is sent anywhere except external price and catalog APIs.
</p>
```

(c) Add to the `<style>` block, after the existing `button:disabled { … }` rule, a `.button` rule so the `<a>` matches the screen's buttons:

```css
  .button {
    display: inline-block; margin-top: var(--space-3);
    background: var(--accent); color: var(--bg);
    border: none; border-radius: var(--radius);
    padding: var(--space-2) var(--space-3); font-weight: 600; text-decoration: none;
  }
```

- [ ] **Step 4: Run the tests and type check**

Run: `npx vitest run src/routes/settings/page.test.ts` — Expected: PASS.
Run: `npx vitest run` — Expected: PASS, whole suite.
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```
git add src/routes/settings/+page.svelte src/routes/settings/page.test.ts
git commit -m "Add Download backup button to the Settings screen" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Phase 3 group review

After Tasks 3.1–3.2:

```
Review the batch from multiple perspectives. Minimum 3 review rounds.
If round 3 still finds issues, keep going until clean.
```

Phase-specific review dimensions:
- **Snapshot integrity:** `backupDatabase` uses `VACUUM INTO` (a consistent snapshot), not a filesystem copy; the response bytes begin with the SQLite magic header.
- **Temp-file cleanup:** the temp snapshot is removed on success AND on failure (the `finally`); both are covered by tests using a before/after delta (testing-pitfalls §3, §7).
- **`makeTestDb` unbroken:** the `test-db.ts` refactor left `makeTestDb`'s signature and return type identical; the whole pre-existing suite still passes.
- **Thin route wrapper:** `+server.ts` is a one-liner; all logic and all the testable behavior live in `logic.ts`.
- **CVT-T1:** the backup logic test uses an in-memory test DB; no live calls.
- `npx vitest run` and `npm run check` clean.

When the phase ships, update the banner and the top-of-plan table per the Living Document Contract.

---

## Spec Coverage Map

| Spec section | Task |
|---|---|
| §Design 1 — `estimate-quality.ts` (`relativeAge`, `isStale`, `isLowConfidence`, thresholds) | 1.1 |
| §Design 1 — `estimateRecords` query | 1.2 |
| §Design 1 — `enrichedCollection` + `EnrichedItem` | 1.3 |
| §Design 1 — Collection load + row (age line, stale treatment, low-confidence marker) | 1.4 |
| §Design 2 — `collectionToCsv` formatter | 2.1 |
| §Design 2 — `/api/export` route | 2.2 |
| §Design 2 — Export CSV link on the Collection screen | 2.3 |
| §Design 3 — raw `sqlite` export, `/api/backup` route, `VACUUM INTO` snapshot | 3.1 |
| §Design 3 — Download backup button on Settings | 3.2 |
| §Testing | every task's tests + the three group reviews |
