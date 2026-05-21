# Browse-Screen Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Browse-screen filtering and paging to the server so the page loads and renders one bounded 100-row page regardless of catalog size.

**Architecture:** A `title_folded` column gives SQL accent-insensitive search and sort. A new `browseGames` query filters (console, folded text, homebrew year window, owned) and pages (`LIMIT/OFFSET`) entirely in SQL. The Browse `load` reads filters from URL params; `+page.svelte` renders one page and drives the URL via `goto`, with a Prev/Next pager.

**Tech Stack:** SvelteKit 2 / Svelte 5, TypeScript, better-sqlite3 + Drizzle ORM + drizzle-kit, Vitest 4, `@testing-library/svelte`.

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

**Overall:** 1/1 phases shipped.

| Phase | Status | Ship SHA(s) | Notes |
|---|---|---|---|
| 1 — Browse-Screen Performance | ✅ Shipped | `24b473a`, `d7c5914`, `3fa90a9`, `b1d4f00`, `0fa2c35` | Tasks 1–5; group review passed (3 rounds, 0 substantive findings) |

### Deviations
- Task 5: `listGamesByConsole` had two callers outside the task's stated file list — `src/lib/sources/sync.test.ts` and `src/routes/api/sync/server.test.ts`. Both were rewired to assert via `browseGames(...).totalCount` instead; the assertion verifies the same thing (games persisted after sync) and is arguably stronger (unpaged SQL `COUNT(*)` vs array `.length`).
- Task 5: `searchValue` initializer wrapped in `untrack(() => data.query)` to suppress a Svelte 5 state-capture warning; an `$effect` still re-syncs it on external `data.query` change.

### Discoveries
- Non-blocking: a hand-forged out-of-range URL such as `/browse?page=99` renders a nonsensical "Showing 9801–N" range. Unreachable through the UI (Next is disabled at the last page); the load clamps `page` only to `≥ 1`, not to the last valid page. Not fixed — outside the spec's pager scope.

---

## Source Spec

This plan implements `docs/superpowers/specs/2026-05-21-browse-performance-design.md`. Read it for rationale; this plan is the executable form.

## Task Discipline (applies to every task)

**§A — Before starting any task:** Invoke `superpowers:test-driven-development`. Read `docs/pitfalls/testing-pitfalls.md`. Follow TDD: write the failing test → run it, confirm it fails for the expected reason → minimum code to pass → run it, confirm green.

**§B — Before marking any task complete:** Review the new tests against `docs/pitfalls/testing-pitfalls.md`. Run `npx vitest run` (whole suite green) and `npm run check` (0 errors, 0 warnings). Test output pristine — no stray stderr, no debug prints.

**§C — Commit messages:** every `git commit` MUST end with the trailer via a second `-m`:
`git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"`

**Project pitfalls binding here:** CVT-1 (money is integer cents — unaffected here; SVG/pixel and pagination numbers are not money). CVT-T1 (no live calls in tests — all use a test DB / mocked `$app/navigation`).

## Execution Setup

Create a feature branch before Task 1 — do NOT execute on `main`. Suggested name: `feat/browse-perf`. Execute tasks in numeric order (1 → 5). When done, use `superpowers:finishing-a-development-branch`.

---

## Phase 1 — Browse-Screen Performance

**Execution Status:** ✅ SHIPPED at `24b473a`, `d7c5914`, `3fa90a9`, `b1d4f00`, `0fa2c35` on 2026-05-21 (branch `feat/browse-perf`). Group review passed — 3 rounds, 0 substantive findings.

### Task 1: Shared `fold` function

**Files:**
- Create: `src/lib/fold.ts`
- Test: `src/lib/fold.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Context:** Accent-insensitive search is currently a `fold` helper inlined in `browse/+page.svelte`. Server-side search needs the same logic, so it moves to a shared module. (`src/lib/sources/ebay/filter.ts` has its own inline copy — leave that one alone; deduplicating it is out of scope.)

- [ ] **Step 1: Write the failing test**

Create `src/lib/fold.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fold } from './fold';

describe('fold', () => {
  it('strips diacritics and lowercases', () => {
    expect(fold('Pokémon')).toBe('pokemon');
    expect(fold('CHRONO TRIGGER')).toBe('chrono trigger');
  });
  it('leaves plain ASCII unchanged except for case', () => {
    expect(fold('GoldenEye 007')).toBe('goldeneye 007');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/fold.test.ts`
Expected: FAIL — `Cannot find module './fold'`.

- [ ] **Step 3: Create `src/lib/fold.ts`**

```ts
// ABOUTME: Accent-insensitive text normalization — strips diacritics and
// ABOUTME: lowercases, so a plain-ASCII search matches accented titles.

/** Normalize a string for accent-insensitive comparison: NFD-decompose,
 *  drop combining marks, lowercase. "Pokémon" → "pokemon". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
```

The character class is the combining-diacritical range U+0300–U+036F (the same form already used in `browse/+page.svelte`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/fold.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```
git add src/lib/fold.ts src/lib/fold.test.ts
git commit -m "Add shared accent-folding helper" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2: `title_folded` column on `games`

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: a generated migration in `drizzle/`
- Test: `src/lib/db/schema.test.ts`

**Discipline:** Task Discipline §A, §B, §C. Generating the migration (`drizzle-kit generate`) is codegen and exempt from TDD; the schema edit and its round-trip test are not.

**Context:** `games` needs a `title_folded` text column for accent-insensitive SQL search and sort. Nullable — existing rows start `NULL` and are filled by a backfill in Task 3.

- [ ] **Step 1: Write the failing test**

In `src/lib/db/schema.test.ts`, add this test inside the existing `describe('schema', ...)` block (`games` is already imported there):

```ts
  it('stores a nullable folded title on a game', () => {
    const db = makeTestDb();
    db.insert(games).values({ id: 1, console: 'SNES', title: 'A', lastSyncedAt: new Date() }).run();
    expect(db.select().from(games).get()?.titleFolded).toBeNull();

    db.insert(games)
      .values({ id: 2, console: 'SNES', title: 'Pokémon', titleFolded: 'pokemon', lastSyncedAt: new Date() })
      .run();
    expect(db.select().from(games).where(eq(games.id, 2)).get()?.titleFolded).toBe('pokemon');
  });
```

Add `eq` to the `drizzle-orm` import at the top of `schema.test.ts` if it is not already imported.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/db/schema.test.ts`
Expected: FAIL — `titleFolded` is not a property of `games`.

- [ ] **Step 3: Add the column to the schema**

In `src/lib/db/schema.ts`, replace the `games` table definition with:

```ts
export const games = sqliteTable('games', {
  id: integer('id').primaryKey(), // TheGamesDB game id
  console: text('console').notNull(),
  title: text('title').notNull(),
  region: text('region'),
  releaseYear: integer('release_year'),
  boxartUrl: text('boxart_url'), // front cover thumbnail URL, nullable
  titleFolded: text('title_folded'), // accent-folded lowercase title, for search/sort
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }).notNull()
});
```

Change nothing else in the file.

- [ ] **Step 4: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new file `drizzle/NNNN_<name>.sql` containing an `ALTER TABLE` that adds the `title_folded` text column to `games`, and nothing else. Open the generated `.sql` and confirm. If the generator reports "No schema changes", the schema edit was not saved — re-check Step 3. (drizzle-kit also updates `drizzle/meta/` — expected.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add src/lib/db/schema.ts src/lib/db/schema.test.ts drizzle/
git commit -m "Add title_folded column to games" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3: Populate `title_folded` — on sync and via backfill

**Files:**
- Modify: `src/lib/db/queries/games.ts` (`upsertGames`; add `backfillFoldedTitles`)
- Modify: `src/lib/db/client.ts`
- Test: `src/lib/db/queries/games.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 1 (`fold`), Task 2 (`title_folded` column).

**Context:** `upsertGames` must write `title_folded` for every synced game so future syncs populate it. `backfillFoldedTitles` fills rows synced before the column existed; it runs once at startup. `client.ts` calls it after `migrate()`.

**Do NOT:** do not change `getGame`, `consoleCounts`, `listGamesByConsole`, or `searchGames` in this task.

- [ ] **Step 1: Write the failing tests**

In `src/lib/db/queries/games.test.ts`, add `backfillFoldedTitles` to the import from `./games` (`games`, `makeTestDb`, `upsertGames`, `getGame` are already imported). Add these tests inside the `describe('games queries', ...)` block:

```ts
  it('writes a folded title when upserting a game', () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'GBA', title: 'Pokémon Ruby', region: null, releaseYear: 2002 }]);
    expect(getGame(db, 1)?.titleFolded).toBe('pokemon ruby');
  });

  it('backfills folded titles for rows that lack one, idempotently', () => {
    const db = makeTestDb();
    // A row inserted directly, without title_folded (simulating a pre-migration row).
    db.insert(games).values({ id: 1, console: 'GBA', title: 'Métroid Fusion', lastSyncedAt: new Date() }).run();
    expect(getGame(db, 1)?.titleFolded).toBeNull();

    backfillFoldedTitles(db);
    expect(getGame(db, 1)?.titleFolded).toBe('metroid fusion');

    // Idempotent: a second run does not throw and does not change the value.
    backfillFoldedTitles(db);
    expect(getGame(db, 1)?.titleFolded).toBe('metroid fusion');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/db/queries/games.test.ts`
Expected: FAIL — `upsertGames` does not write `titleFolded`; `backfillFoldedTitles` is not exported.

- [ ] **Step 3: Update `games.ts`**

(a) Add to the imports: `fold` and `isNull`:

```ts
import { fold } from '$lib/fold';
```

and add `isNull` to the existing `drizzle-orm` import line (it currently imports `and, asc, eq, like, sql`).

(b) In `upsertGames`, compute the folded title and write it in both the insert values and the conflict-update set. Replace the loop body inside `db.transaction((tx) => { for (const r of rows) { ... } })` with:

```ts
    for (const r of rows) {
      const boxartUrl = r.boxartUrl ?? null;
      const titleFolded = fold(r.title);
      tx.insert(games)
        .values({ ...r, boxartUrl, titleFolded, lastSyncedAt: now })
        .onConflictDoUpdate({
          target: games.id,
          set: {
            console: r.console,
            title: r.title,
            region: r.region,
            releaseYear: r.releaseYear,
            boxartUrl,
            titleFolded,
            lastSyncedAt: now
          }
        })
        .run();
    }
```

(c) Add `backfillFoldedTitles` at the end of the file:

```ts
/** Populate title_folded for any rows synced before the column existed.
 *  Idempotent — only touches rows where title_folded IS NULL. */
export function backfillFoldedTitles(db: DB): void {
  const rows = db.select({ id: games.id, title: games.title }).from(games).where(isNull(games.titleFolded)).all();
  if (rows.length === 0) return;
  db.transaction((tx) => {
    for (const r of rows) {
      tx.update(games).set({ titleFolded: fold(r.title) }).where(eq(games.id, r.id)).run();
    }
  });
}
```

- [ ] **Step 4: Wire the backfill into startup**

In `src/lib/db/client.ts`, after the `migrate(db, { migrationsFolder: 'drizzle' });` line, add:

```ts
import { backfillFoldedTitles } from './queries/games';
```

(at the top with the other imports) and after the `migrate(...)` call:

```ts
// One-time fill of title_folded for games synced before that column existed.
backfillFoldedTitles(db);
```

- [ ] **Step 5: Run the tests and type check**

Run: `npx vitest run src/lib/db/queries/games.test.ts` — Expected: PASS.
Run: `npx vitest run` — Expected: PASS, whole suite.
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```
git add src/lib/db/queries/games.ts src/lib/db/client.ts src/lib/db/queries/games.test.ts
git commit -m "Populate title_folded on sync and backfill at startup" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4: `browseGames` — the paged, filtered query

**Files:**
- Modify: `src/lib/db/queries/games.ts`
- Test: `src/lib/db/queries/games.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 2 (`title_folded` column), Task 3 (settled `games.ts`).

**Context:** `browseGames` is the new single Browse data source — it filters by console, folded text, homebrew year window, and owned/condition, then orders by `title_folded` and returns one page plus the full filtered count.

**Do NOT:** do not remove `listGamesByConsole` / `searchGames` in this task (Task 5 does that, once the Browse route stops using them).

- [ ] **Step 1: Write the failing tests**

In `src/lib/db/queries/games.test.ts`, add `browseGames` to the import from `./games`. Add `addItem` from `$lib/db/queries/collection` to the imports if absent. Add this block:

```ts
describe('browseGames', () => {
  function seed() {
    const db = makeTestDb();
    upsertGames(db, [
      { id: 1, console: 'GBA', title: 'Pokémon Ruby', region: null, releaseYear: 2002 },
      { id: 2, console: 'GBA', title: 'Metroid Fusion', region: null, releaseYear: 2002 },
      { id: 3, console: 'GBA', title: 'Advance Wars', region: null, releaseYear: 2001 },
      { id: 4, console: 'GBA', title: 'Epoch Junk Hack', region: null, releaseYear: 1970 },
      { id: 5, console: 'N64', title: 'GoldenEye', region: null, releaseYear: 1997 }
    ]);
    return db;
  }

  it('filters by console and orders by folded title', () => {
    const { games: rows } = browseGames(seed(), { console: 'GBA', query: '', show: 'all', homebrewBounds: null }, 1, 100);
    expect(rows.map((g) => g.title)).toEqual(['Advance Wars', 'Epoch Junk Hack', 'Metroid Fusion', 'Pokémon Ruby']);
  });

  it('matches an accented title from a plain-ASCII folded query', () => {
    const { games: rows } = browseGames(seed(), { console: 'GBA', query: 'pokemon', show: 'all', homebrewBounds: null }, 1, 100);
    expect(rows.map((g) => g.id)).toEqual([1]);
  });

  it('excludes years outside the homebrew window but keeps null years', () => {
    const db = seed();
    upsertGames(db, [{ id: 6, console: 'GBA', title: 'No Year Game', region: null, releaseYear: null }]);
    const { games: rows } = browseGames(db, { console: 'GBA', query: '', show: 'all', homebrewBounds: { start: 2001, end: 2009 } }, 1, 100);
    const titles = rows.map((g) => g.title);
    expect(titles).toContain('No Year Game');       // null year kept
    expect(titles).not.toContain('Epoch Junk Hack'); // 1970 < 2001, excluded
  });

  it('filters to owned games', () => {
    const db = seed();
    addItem(db, { gameId: 2, condition: 'loose' });
    const { games: rows } = browseGames(db, { console: 'GBA', query: '', show: 'owned', homebrewBounds: null }, 1, 100);
    expect(rows.map((g) => g.id)).toEqual([2]);
  });

  it('pages with limit and offset and reports the full count', () => {
    const db = seed();
    const p1 = browseGames(db, { console: 'GBA', query: '', show: 'all', homebrewBounds: null }, 1, 2);
    const p2 = browseGames(db, { console: 'GBA', query: '', show: 'all', homebrewBounds: null }, 2, 2);
    expect(p1.games.map((g) => g.title)).toEqual(['Advance Wars', 'Epoch Junk Hack']);
    expect(p2.games.map((g) => g.title)).toEqual(['Metroid Fusion', 'Pokémon Ruby']);
    expect(p1.totalCount).toBe(4);
    expect(p2.totalCount).toBe(4);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/db/queries/games.test.ts`
Expected: FAIL — `browseGames` is not exported.

- [ ] **Step 3: Add `browseGames` to `games.ts`**

Extend the `drizzle-orm` import so the line reads:

```ts
import { and, asc, eq, gte, inArray, isNull, like, lte, notInArray, or, sql, type SQL } from 'drizzle-orm';
```

Add `collectionItems` and `type Game` to the schema import (the file currently imports `{ games }` from `../schema`):

```ts
import { collectionItems, games, type Game } from '../schema';
```

Add at the end of the file:

```ts
export interface BrowseFilters {
  console: string;
  query: string; // already folded by the caller; '' means no text filter
  show: 'all' | 'owned' | 'unowned' | 'loose' | 'cib' | 'new';
  homebrewBounds: { start: number; end: number | null } | null; // null = do not hide homebrew
}

export interface BrowsePage {
  games: Game[];
  totalCount: number; // full filtered count, ignoring LIMIT/OFFSET
}

/** One filtered, ordered page of catalog games, plus the full match count. */
export function browseGames(db: DB, filters: BrowseFilters, page: number, pageSize: number): BrowsePage {
  const conds: (SQL | undefined)[] = [eq(games.console, filters.console)];

  if (filters.query !== '') {
    conds.push(like(games.titleFolded, `%${filters.query}%`));
  }

  if (filters.homebrewBounds) {
    const { start, end } = filters.homebrewBounds;
    const inRange =
      end !== null ? and(gte(games.releaseYear, start), lte(games.releaseYear, end)) : gte(games.releaseYear, start);
    conds.push(or(isNull(games.releaseYear), inRange));
  }

  const ownedIds = db.select({ id: collectionItems.gameId }).from(collectionItems);
  if (filters.show === 'owned') {
    conds.push(inArray(games.id, ownedIds));
  } else if (filters.show === 'unowned') {
    conds.push(notInArray(games.id, ownedIds));
  } else if (filters.show === 'loose' || filters.show === 'cib' || filters.show === 'new') {
    conds.push(
      inArray(
        games.id,
        db.select({ id: collectionItems.gameId }).from(collectionItems).where(eq(collectionItems.condition, filters.show))
      )
    );
  }

  const where = and(...conds);
  const rows = db
    .select()
    .from(games)
    .where(where)
    .orderBy(asc(games.titleFolded))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();
  const totalCount = db.select({ c: sql<number>`count(*)` }).from(games).where(where).get()?.c ?? 0;
  return { games: rows, totalCount };
}
```

- [ ] **Step 4: Run the tests and type check**

Run: `npx vitest run src/lib/db/queries/games.test.ts` — Expected: PASS.
Run: `npx vitest run` — Expected: PASS.
Run: `npm run check` — Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```
git add src/lib/db/queries/games.ts src/lib/db/queries/games.test.ts
git commit -m "Add browseGames — server-side filtered, paged catalog query" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5: Rewire the Browse route to server-side filtering + pager

**Files:**
- Modify: `src/routes/browse/+page.server.ts`
- Modify: `src/routes/browse/+page.svelte`
- Modify: `src/lib/db/queries/games.ts` (remove `listGamesByConsole`, `searchGames`)
- Test: `src/routes/browse/page.test.ts`, `src/lib/db/queries/games.test.ts`

**Discipline:** Task Discipline §A, §B, §C.

**Depends on:** Task 1 (`fold`), Task 4 (`browseGames`).

**Context:** The Browse `load` switches from `listGamesByConsole`/`searchGames` to `browseGames`, parsing all filters from URL params. `+page.svelte` stops filtering client-side — it renders one page and drives the URL via `goto`, with a Prev/Next pager. `listGamesByConsole` and `searchGames` then have no caller and are removed.

**Do NOT:** do not change `ConsoleSidebar.svelte` — its links are bare `/browse?console=X`, which correctly resets all filters on a console switch. Do not change `consoleCounts`, `ownedConditionsByGame`, `estimateMap`, `ConditionButton`, or `GameThumb`.

- [ ] **Step 1: Rewrite the failing test — `src/routes/browse/page.test.ts`**

Replace the entire contents of `src/routes/browse/page.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

// vi.mock is hoisted above all imports/top-level code, so its factory cannot
// see an ordinary `const`. vi.hoisted runs first and makes `goto` available.
const { goto } = vi.hoisted(() => ({ goto: vi.fn(() => Promise.resolve()) }));
vi.mock('$app/navigation', () => ({ goto }));

import type { PageData } from './$types';
import Page from './+page.svelte';

// Typed as PageData so the `show` union field and the game shape are checked
// (a bare object literal would widen `show: 'all'` to `string`). Tests that
// vary fields spread this base with typed overrides.
const data: PageData = {
  consoles: [{ console: 'Game Boy', count: 3 }, { console: 'N64', count: 1 }],
  selectedConsole: 'Game Boy',
  games: [
    { id: 1, title: 'Chrono Trigger', console: 'Game Boy', region: 'NTSC', releaseYear: 1995,
      boxartUrl: null, ownedConditions: [], estimates: { loose: null, cib: null, new: null } },
    { id: 2, title: 'Super Metroid', console: 'Game Boy', region: 'NTSC', releaseYear: 1994,
      boxartUrl: 'https://cdn.thegamesdb.net/images/thumb/boxart/front/2-1.jpg',
      ownedConditions: ['loose'], estimates: { loose: 4200, cib: null, new: null } }
  ],
  totalCount: 250,
  page: 1,
  pageSize: 100,
  query: '',
  show: 'all',
  hideHomebrew: true
};

describe('browse page', () => {
  it('renders the games it is given', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('Chrono Trigger')).toBeInTheDocument();
    expect(getByText('Super Metroid')).toBeInTheDocument();
  });

  it('shows the estimate on an owned condition control', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('$42.00')).toBeInTheDocument();
  });

  it('renders a box-art thumbnail for games that have one', () => {
    const { container } = render(Page, { props: { data } });
    const imgs = [...container.querySelectorAll('img')];
    expect(imgs.some((i) => i.getAttribute('src')?.includes('boxart/front/2-1.jpg'))).toBe(true);
  });

  it('shows the page range and total count', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText(/Showing 1–100 of 250/)).toBeInTheDocument();
  });

  it('shows an empty state when the page has no games', () => {
    const { getByText } = render(Page, { props: { data: { ...data, games: [], totalCount: 0 } } });
    expect(getByText(/no games match/i)).toBeInTheDocument();
  });

  it('disables Prev on the first page and enables Next when more pages exist', () => {
    const { getByRole } = render(Page, { props: { data } });
    expect(getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(getByRole('button', { name: 'Next' })).not.toBeDisabled();
  });

  it('disables Next on the last page', () => {
    // page 3 × 100 = 300 ≥ 250 → no next page
    const { getByRole } = render(Page, { props: { data: { ...data, page: 3 } } });
    expect(getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('navigates to the next page when Next is clicked', () => {
    goto.mockClear();
    const { getByRole } = render(Page, { props: { data } });
    getByRole('button', { name: 'Next' }).click();
    // Prev/Next call goto(url) with a single argument — no options object.
    expect(goto).toHaveBeenCalledWith(expect.stringContaining('page=2'));
  });

  it('debounced search navigates with the query and resets the page', () => {
    vi.useFakeTimers();
    goto.mockClear();
    const { getByPlaceholderText } = render(Page, { props: { data: { ...data, page: 2 } } });
    const input = getByPlaceholderText(/filter by title/i) as HTMLInputElement;
    input.value = 'metroid';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(300);
    // The search goto passes an options object as its second argument.
    expect(goto).toHaveBeenCalledWith(expect.stringContaining('q=metroid'), expect.anything());
    expect(goto.mock.calls.at(-1)?.[0]).not.toContain('page='); // page dropped on filter change
    vi.useRealTimers();
  });
});
```

Note: `goto` is created via `vi.hoisted` so the hoisted `vi.mock` factory can reference it; the tests then assert on `goto` directly. `import Page` comes *after* the `vi.mock` call so the mock is registered before the component module loads.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/browse/page.test.ts`
Expected: FAIL — the current `+page.svelte` has no pager and expects a different `data` shape.

- [ ] **Step 3: Rewrite `src/routes/browse/+page.server.ts`**

Replace the entire contents with:

```ts
import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { consoleCounts, browseGames } from '$lib/db/queries/games';
import { ownedConditionsByGame } from '$lib/db/queries/collection';
import { estimateMap } from '$lib/db/queries/prices';
import { CONDITIONS } from '$lib/types';
import { CONSOLE_RELEASE_YEAR, CONSOLE_END_YEAR } from '$lib/sources/platforms';
import { fold } from '$lib/fold';

const PAGE_SIZE = 100;
const SHOW_VALUES = ['all', 'owned', 'unowned', 'loose', 'cib', 'new'] as const;
type Show = (typeof SHOW_VALUES)[number];

export const load: PageServerLoad = async ({ url }) => {
  const consoles = consoleCounts(db);
  const selectedConsole = url.searchParams.get('console') ?? consoles[0]?.console ?? '';
  const query = url.searchParams.get('q') ?? '';
  const showParam = url.searchParams.get('show') ?? 'all';
  const show: Show = (SHOW_VALUES as readonly string[]).includes(showParam) ? (showParam as Show) : 'all';
  const hideHomebrew = url.searchParams.get('homebrew') !== 'show';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  const start = CONSOLE_RELEASE_YEAR[selectedConsole];
  const homebrewBounds =
    hideHomebrew && start !== undefined
      ? { start, end: CONSOLE_END_YEAR[selectedConsole] ?? null }
      : null;

  const { games, totalCount } = browseGames(
    db,
    { console: selectedConsole, query: fold(query.trim()), show, homebrewBounds },
    page,
    PAGE_SIZE
  );

  const estimates = estimateMap(db);
  const owned = ownedConditionsByGame(db);
  const gamesList = games.map((g) => ({
    id: g.id,
    title: g.title,
    console: g.console,
    region: g.region,
    releaseYear: g.releaseYear,
    boxartUrl: g.boxartUrl,
    ownedConditions: owned.get(g.id) ?? [],
    estimates: Object.fromEntries(
      CONDITIONS.map((c) => [c, estimates.get(`${g.id}:${c}`) ?? null])
    ) as Record<string, number | null>
  }));

  return {
    consoles,
    selectedConsole,
    games: gamesList,
    totalCount,
    page,
    pageSize: PAGE_SIZE,
    query,
    show,
    hideHomebrew
  };
};
```

- [ ] **Step 4: Rewrite `src/routes/browse/+page.svelte`**

Replace the entire contents with:

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';
  import { CONDITIONS, CONDITION_LABELS } from '$lib/types';
  import ConsoleSidebar from '$lib/components/ConsoleSidebar.svelte';
  import ConditionButton from '$lib/components/ConditionButton.svelte';
  import GameThumb from '$lib/components/GameThumb.svelte';

  let { data }: { data: PageData } = $props();

  let searchValue = $state(data.query);
  // Re-sync the box when the URL's query changes from outside (e.g. switching
  // console clears it). Reads data.query, not searchValue, so live typing
  // (which only changes searchValue) does not trigger or fight this.
  $effect(() => {
    searchValue = data.query;
  });

  let debounceTimer: ReturnType<typeof setTimeout>;

  /** Build a /browse URL from the current filters, applying overrides.
   *  A null override removes that param. */
  function browseUrl(overrides: Record<string, string | null>): string {
    const params = new URLSearchParams();
    params.set('console', data.selectedConsole);
    if (data.query) params.set('q', data.query);
    if (data.show !== 'all') params.set('show', data.show);
    if (!data.hideHomebrew) params.set('homebrew', 'show');
    if (data.page > 1) params.set('page', String(data.page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    return `/browse?${params}`;
  }

  function onSearchInput(e: Event) {
    // Read the value off the event so the debounce does not depend on the
    // bind:value signal having flushed.
    const v = (e.currentTarget as HTMLInputElement).value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      goto(browseUrl({ q: v.trim() || null, page: null }), {
        replaceState: true,
        keepFocus: true,
        noScroll: true
      });
    }, 250);
  }

  function onShowChange(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value;
    goto(browseUrl({ show: v === 'all' ? null : v, page: null }));
  }

  function onHomebrewChange(e: Event) {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    goto(browseUrl({ homebrew: checked ? null : 'show', page: null }));
  }

  let firstRow = $derived(data.totalCount === 0 ? 0 : (data.page - 1) * data.pageSize + 1);
  let lastRow = $derived(Math.min(data.page * data.pageSize, data.totalCount));
  let hasPrev = $derived(data.page > 1);
  let hasNext = $derived(data.page * data.pageSize < data.totalCount);
</script>

<div class="browse">
  <ConsoleSidebar consoles={data.consoles} selected={data.selectedConsole} />

  <div class="list">
    <h1>{data.selectedConsole}</h1>

    <div class="filters">
      <input
        class="search"
        type="search"
        placeholder="Filter by title…"
        bind:value={searchValue}
        oninput={onSearchInput}
      />
      <label>
        Show
        <select value={data.show} onchange={onShowChange}>
          <option value="all">All games</option>
          <option value="owned">Owned — any</option>
          <option value="loose">Owned — Loose</option>
          <option value="cib">Owned — CIB</option>
          <option value="new">Owned — New</option>
          <option value="unowned">Not owned</option>
        </select>
      </label>
      <label class="check">
        <input type="checkbox" checked={data.hideHomebrew} onchange={onHomebrewChange} />
        Hide likely homebrew
      </label>
    </div>

    <div class="row header">
      <span></span>
      <span>Title</span>
      {#each CONDITIONS as c}<span class="cond">{CONDITION_LABELS[c]}</span>{/each}
    </div>

    {#each data.games as game (game.id)}
      <div class="row">
        <GameThumb url={game.boxartUrl} />
        <span class="title">{game.title}
          {#if game.releaseYear}<em>({game.releaseYear})</em>{/if}</span>
        {#each CONDITIONS as c}
          <span class="cond">
            <ConditionButton
              gameId={game.id}
              condition={c}
              owned={game.ownedConditions.includes(c)}
              estimate={game.estimates[c]}
            />
          </span>
        {/each}
      </div>
    {/each}

    {#if data.games.length === 0}
      <p class="empty">No games match the current filters.</p>
    {/if}

    <div class="pager">
      <span class="count">
        {#if data.totalCount === 0}No games{:else}Showing {firstRow}–{lastRow} of {data.totalCount}{/if}
      </span>
      <button onclick={() => goto(browseUrl({ page: String(data.page - 1) }))} disabled={!hasPrev}>Prev</button>
      <button onclick={() => goto(browseUrl({ page: String(data.page + 1) }))} disabled={!hasNext}>Next</button>
    </div>
  </div>
</div>

<style>
  .browse { display: flex; gap: var(--space-4); }
  .list { flex: 1; }
  h1 { font-size: var(--fs-xl); margin-bottom: var(--space-3); }
  .filters {
    display: flex; align-items: center; gap: var(--space-3);
    margin-bottom: var(--space-3); flex-wrap: wrap;
  }
  .search {
    flex: 1; min-width: 180px;
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-2) var(--space-3); font: inherit;
  }
  .filters label {
    display: flex; align-items: center; gap: var(--space-2);
    color: var(--text-dim); font-size: var(--fs-sm);
  }
  .filters select {
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-2); font: inherit;
  }
  .filters .check { cursor: pointer; }
  .filters input[type='checkbox'] { accent-color: var(--accent); cursor: pointer; }
  .row {
    display: grid; grid-template-columns: 44px 1fr 90px 90px 90px;
    gap: var(--space-2); align-items: center;
    padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border);
  }
  .row.header { color: var(--text-dim); font-size: var(--fs-sm); text-transform: uppercase; }
  .cond { text-align: right; font-family: var(--mono); }
  .title em { color: var(--text-dim); font-style: italic; }
  .empty { color: var(--text-dim); margin-top: var(--space-4); }
  .pager {
    display: flex; align-items: center; gap: var(--space-3);
    margin-top: var(--space-3); color: var(--text-dim); font-size: var(--fs-sm);
  }
  .pager .count { font-family: var(--mono); margin-right: auto; }
  .pager button {
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-1) var(--space-3); font: inherit;
  }
  .pager button:disabled { opacity: 0.4; cursor: default; }
</style>
```

- [ ] **Step 5: Remove the superseded queries from `games.ts`**

`browse/+page.server.ts` no longer imports `listGamesByConsole` or `searchGames`, and they have no other caller. In `src/lib/db/queries/games.ts`, delete the `listGamesByConsole` and `searchGames` function definitions. Then check the `drizzle-orm` import line — if `like` is now used only by `browseGames` keep it; if any imported symbol is now unused, remove it (run `npm run check` in Step 7 to confirm no unused-import or other errors).

In `src/lib/db/queries/games.test.ts`, remove `listGamesByConsole` and `searchGames` from the import from `./games`, and delete the two tests `'lists games for one console alphabetically'` and `'searches titles within a console, case-insensitively'` (their behavior is now covered by the `browseGames` tests).

- [ ] **Step 6: Run the browse test to verify it passes**

Run: `npx vitest run src/routes/browse/page.test.ts`
Expected: PASS — all browse-page tests.

- [ ] **Step 7: Run the full suite and type check**

Run: `npx vitest run` — Expected: PASS, whole suite.
Run: `npm run check` — Expected: 0 errors, 0 warnings (this also confirms no dangling import of the removed functions and no unused imports in `games.ts`).

- [ ] **Step 8: Commit**

```
git add src/routes/browse/+page.server.ts src/routes/browse/+page.svelte src/lib/db/queries/games.ts src/lib/db/queries/games.test.ts src/routes/browse/page.test.ts
git commit -m "Move Browse filtering and paging to the server" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Phase 1 group review

After Tasks 1–5:

```
Review the batch from multiple perspectives. Minimum 3 review rounds.
If round 3 still finds issues, keep going until clean.
```

Phase-specific review dimensions:
- **Accent search preserved:** a plain-ASCII query still finds accented titles — `title_folded` is populated on sync AND backfilled at startup, and `browseGames` searches it.
- **Bounded output:** `browseGames` always applies `LIMIT pageSize OFFSET …`; the page renders only `data.games`; no client-side filtering remains in `+page.svelte`.
- **Pager correctness:** Prev disabled on page 1; Next disabled when `page * pageSize >= totalCount`; "Showing X–Y of M" arithmetic is right (including the `totalCount === 0` case); a filter change drops the `page` param.
- **No dead code / no regression:** `listGamesByConsole` and `searchGames` are gone with no remaining caller; `ConsoleSidebar` still resets filters on console switch; `consoleCounts` unchanged.
- **CVT-T1:** the browse page test mocks `$app/navigation`; query tests use a test DB. No live calls.
- `npx vitest run` and `npm run check` clean.

When the phase ships, update the banner and the top-of-plan table per the Living Document Contract.

---

## Spec Coverage Map

| Spec section | Task |
|---|---|
| §1 `title_folded` column + migration | 2 |
| §1 shared `fold`; `upsertGames` populates; `backfillFoldedTitles` + startup wiring | 1, 3 |
| §2 `browseGames` (filter + page query) | 4 |
| §3 the `load` function (URL params → `browseGames`) | 5 |
| §4 the page + Prev/Next pager; remove dead queries | 5 |
| Testing section | every task's tests + the group review |
