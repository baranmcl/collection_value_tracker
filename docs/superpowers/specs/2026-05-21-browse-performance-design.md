# Browse-Screen Performance — Design Spec

**Date:** 2026-05-21
**Status:** Approved — ready for planning
**Workstream:** C of 4 (refresh progress ✅ → value-over-time chart ✅ → browse performance → small-items batch)

## Summary

The Browse screen lets the user walk the catalog and click to mark games
owned. Today its `+page.server.ts` ships the **entire** selected console's
catalog to the client (`listGamesByConsole`), and `+page.svelte` filters all
of it client-side on every keystroke — text, owned, homebrew, and sort.
For a small console this is fine; for a large one (Switch ≈ 5000 games, DS,
3DS) it is a heavy payload and thousands of DOM rows.

This workstream moves filtering and paging to the server: the search box,
Show dropdown, and homebrew toggle drive URL params; the `load` function
runs one SQL query that filters and returns a single 100-row page; a
Prev/Next pager walks the catalog. Payload and DOM are bounded to one page
regardless of catalog size.

A consequence: SQL `LIKE` is ASCII-case-insensitive only, so accent-
insensitive search (today's client-side `fold()` — "pokemon" matching
"Pokémon", a deliberate fix) requires a folded-title column.

## Goals

- **Bounded payload and DOM.** The Browse screen loads and renders exactly
  one 100-row page, whatever the catalog size.
- **All filtering server-side.** Text, owned/condition, and homebrew filters
  run in SQL; the client renders what it is given and filters nothing.
- **The whole catalog stays reachable.** A Prev/Next pager walks every page.
- **No accent-search regression.** "pokemon" must still match "Pokémon".
- **No new dependency.** No virtualization library, no UI framework.

## Non-Goals

- **Virtualized rendering / infinite scroll.** A server-capped page already
  bounds the DOM; windowing adds nothing. Out of scope.
- **Numbered page links.** A Prev/Next pager is sufficient; a `1 2 3 …`
  control is not built.
- **Fuzzy / ranked search.** Search stays a simple folded substring match,
  as today.
- **Reworking the console sidebar.** It already drives the `console` param;
  unchanged.

## Background: current shape

- `src/lib/db/queries/games.ts` — `listGamesByConsole(db, console)` returns
  every game for a console; `searchGames(db, console, query)` does a
  `console = ? AND title LIKE %query%` query. `searchGames` is currently
  **dead code** — nothing reaches it, because the search box is client-only.
- `src/routes/browse/+page.server.ts` — reads `console` and `q` from the
  URL, runs `searchGames` or `listGamesByConsole`, maps each game with
  `ownedConditions` (from `ownedConditionsByGame`) and `estimates` (from
  `estimateMap`), returns `{ consoles, selectedConsole, search, games }`.
- `src/routes/browse/+page.svelte` — holds `filter` / `show` / `hideHomebrew`
  as client `$state`; a `$derived visibleGames` filters `data.games`
  (folded substring, homebrew year window from `CONSOLE_RELEASE_YEAR` /
  `CONSOLE_END_YEAR`, owned/condition) and sorts by `localeCompare`.

## Design

### 1. Folded-title column

`games` gains a `title_folded` text column — the title with diacritics
stripped and lowercased. It serves two jobs: accent-insensitive search and
accent-insensitive ordering (SQLite's default `ORDER BY title` sorts
accented characters after all ASCII; `ORDER BY title_folded` keeps "Pokémon"
beside "Pokemon").

- A `drizzle-kit`-generated migration adds the column (nullable text;
  existing rows start `NULL`).
- The folding function moves to a shared `src/lib/fold.ts`:
  `fold(s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()`
  — the exact logic currently inlined in `browse/+page.svelte`.
- `upsertGames` (`games.ts`) computes `title_folded = fold(title)` for every
  row it writes, so all future syncs populate it.
- A one-time `backfillFoldedTitles(db)` fills existing rows: it selects games
  where `title_folded IS NULL`, computes `fold(title)`, and updates them. It
  is idempotent (only touches `NULL` rows) and runs at startup in
  `src/lib/db/client.ts`, immediately after the existing `migrate()` call.

### 2. The browse query

A new `browseGames` in `games.ts` replaces `listGamesByConsole` /
`searchGames` as the Browse data source (both old functions are removed —
`listGamesByConsole` has no other caller; `searchGames` is dead code):

```ts
export interface BrowseFilters {
  console: string;
  query: string;          // already folded by the caller; '' = no text filter
  show: 'all' | 'owned' | 'unowned' | 'loose' | 'cib' | 'new';
  homebrewBounds: { start: number; end: number | null } | null; // null = don't hide
}

export interface BrowsePage {
  games: Game[];     // the one page, ordered by title_folded
  totalCount: number; // full filtered count, ignoring LIMIT/OFFSET
}

export function browseGames(
  db: DB,
  filters: BrowseFilters,
  page: number,      // 1-based
  pageSize: number   // 100
): BrowsePage;
```

It builds one SQL statement:

- `WHERE console = ?`
- text — when `query` is non-empty: `AND title_folded LIKE '%' || ? || '%'`
- homebrew — when `homebrewBounds` is set:
  `AND (release_year IS NULL OR release_year >= ?`
  `       [AND release_year <= ?])` — the upper bound is included only when
  `homebrewBounds.end` is non-null (a console still in production has none)
- show — `owned`: `AND games.id IN (SELECT game_id FROM collection_items)`;
  `loose`/`cib`/`new`: `… WHERE condition = ?`; `unowned`: `NOT IN
  (SELECT game_id FROM collection_items)`; `all`: no clause
- `ORDER BY title_folded ASC LIMIT ? OFFSET ?` with `OFFSET = (page-1)*pageSize`

`totalCount` is a second `COUNT(*)` with the same `WHERE` and no
`LIMIT/OFFSET`, so the pager can show "Showing X–Y of M".

Page size is a fixed **100**.

### 3. The load function

`src/routes/browse/+page.server.ts` reads five URL params:

| Param | Meaning | Default |
|---|---|---|
| `console` | selected console | first console by `consoleCounts` |
| `q` | search text | `''` |
| `show` | `all`/`owned`/`unowned`/`loose`/`cib`/`new` | `all` |
| `homebrew` | `show` = include homebrew; absent = hide | hide |
| `page` | 1-based page number | `1` (parsed, clamped ≥ 1) |

It derives `homebrewBounds` from `CONSOLE_RELEASE_YEAR` /
`CONSOLE_END_YEAR` for the selected console (when `homebrew` ≠ `show`),
folds `q` with `fold()`, calls `browseGames`, and maps the returned page's
games with `ownedConditions` + `estimates`. It returns:
`{ consoles, selectedConsole, games, totalCount, page, pageSize, query,
show, hideHomebrew }`.

### 4. The page and pager

`src/routes/browse/+page.svelte`:

- **No client-side filtering.** It renders `data.games` directly. The
  `visibleGames` `$derived`, the `fold` helper, and the
  `CONSOLE_RELEASE_YEAR` import are removed.
- Filter controls initialize from the echoed `data` params (`data.query`,
  `data.show`, `data.hideHomebrew`).
- On change, controls navigate with SvelteKit `goto`:
  - the **search box is debounced ~250 ms**, then `goto` with
    `replaceState: true` (no per-keystroke history entry) and
    `keepFocus: true`;
  - the Show dropdown and the homebrew checkbox `goto` immediately;
  - **any filter change drops the `page` param** (back to page 1).
- A **pager** below the list: text *"Showing {start}–{end} of {totalCount}"*
  and **Prev** / **Next** buttons. Prev is disabled on page 1; Next is
  disabled once `page * pageSize >= totalCount`. Each button `goto`s with
  `page` set to the new number and all current filters preserved.
- The match-count span (`"{n} of {n}"`) is replaced by the pager's
  "Showing X–Y of M".

### Module responsibilities

- `src/lib/fold.ts` — one pure function, `fold`. No I/O.
- `games.ts` — `browseGames` (the paged, filtered query), `upsertGames`
  (now also writes `title_folded`), `backfillFoldedTitles`.
- `browse/+page.server.ts` — URL params → `BrowseFilters` → `browseGames` →
  per-page enrichment. No business logic beyond param parsing.
- `browse/+page.svelte` — renders a page, drives the URL from the controls,
  draws the pager. Filters nothing itself.

## Testing

All tests use a test DB; no live calls (CVT-T1).

- **`fold`** — strips diacritics, lowercases ("Pokémon" → "pokemon").
- **`browseGames`** — seed games with accented titles, varied `releaseYear`,
  and a few owned items. Assert: folded text match finds an accented title
  from an ASCII query; the homebrew year window excludes out-of-range years
  and keeps `NULL` years; each `show` mode; `LIMIT/OFFSET` paging (page 2
  returns the next slice, no overlap); `totalCount` is the unpaged count;
  results are ordered by `title_folded`.
- **`upsertGames`** — a written game has `title_folded = fold(title)`.
- **`backfillFoldedTitles`** — fills rows with `NULL` `title_folded`,
  leaves already-folded rows untouched, idempotent on a second run.
- **Schema test** — a `games` row round-trips `title_folded`.
- **`browse/page.test.ts`** — rewritten: the page renders the games passed
  in `data`; the pager shows the count and the correct Prev/Next disabled
  states (page 1: Prev disabled; last page: Next disabled). The former
  client-side-filter tests are removed — that behavior is now `browseGames`'.

Test output must stay pristine.

## File-level change list

| File | Change |
|---|---|
| `src/lib/fold.ts` | **New** — the shared `fold` function |
| `src/lib/db/schema.ts` + `drizzle/` | `games.title_folded` column + migration |
| `src/lib/db/queries/games.ts` | **New** `browseGames`, `backfillFoldedTitles`; `upsertGames` writes `title_folded`; remove `listGamesByConsole` + `searchGames` |
| `src/lib/db/client.ts` | call `backfillFoldedTitles` after `migrate()` |
| `src/routes/browse/+page.server.ts` | param parsing → `browseGames` → paged enrichment |
| `src/routes/browse/+page.svelte` | render one page, URL-driven controls, Prev/Next pager; drop client filtering |
| Test files | `fold`, `browseGames`, `upsertGames`, `backfillFoldedTitles`, schema, `browse/page.test.ts` |

Note: `src/lib/sources/ebay/filter.ts` has its own inline `fold` — it is left
as-is to keep this workstream's scope tight; deduplicating it against
`src/lib/fold.ts` is a possible later cleanup.

## Verification

- `npm run check` clean; full `vitest` suite green.
- Browsing a large console loads only 100 rows; Prev/Next walks the catalog;
  a search for an unaccented query still finds accented titles.
