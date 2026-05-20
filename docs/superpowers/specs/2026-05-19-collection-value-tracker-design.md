# Collection Value Tracker — Design Spec

**Date:** 2026-05-19
**Status:** Approved design, ready for implementation planning

## Summary

A local-first web app to track the current market value of a retro video game
collection. The core idea inverts the typical collection-tracker UX: instead of
searching for and typing in each game one by one (the PriceCharting pain point),
the user browses a pre-loaded catalog of the entire retro game universe and
clicks to mark what they own. Prices come from PriceCharting's downloadable CSV.
A portfolio-style dashboard summarizes total value, console breakdown, and the
games that moved most since the last price refresh.

## Goals

- **Fast entry.** Browse a catalog, click a price to add a game in that
  condition. No per-game searching, no manual addition of totals.
- **Portfolio view.** A dashboard showing total collection value, breakdown by
  console, and top movers since the last refresh.
- **On-demand pricing.** Refresh prices for owned games when the user chooses —
  no real-time data, no background polling.
- **Own your data.** Collection lives in a local SQLite file the user controls.
- **Productionizable later.** If the tool proves valuable, it can become a
  hosted multi-user product without a rewrite.

## Audience

Single user (the project owner) for v1. Possible future: a public multi-user
product. The design keeps a clean seam for that transition but does not build
multi-user infrastructure now.

## Decisions Locked During Brainstorming

| Topic | Decision |
|---|---|
| Audience | Single-user v1; productize-later seam preserved |
| Primary pain point | Fast browse-and-check entry; portfolio view |
| Platform | Local-first web app (no paid hosting) |
| Price source | PriceCharting CSV download (free tier), manually placed |
| Catalog scope | Load the entire CSV; filter in the UI |
| Value variants | Loose / CIB / New — all three, switchable per item |
| Portfolio features | Total value + console breakdown + top movers (no history chart, no cost basis) |
| Stack | SvelteKit + SQLite (better-sqlite3) + Drizzle ORM |

## Architecture

A single SvelteKit application — one repo, one process.

- Serves a web UI on `localhost` (dev: `:5173`). Reachable from other devices on
  the LAN if the host is explicitly bound to `0.0.0.0` (a later, optional choice).
- Embeds a SQLite database file at `data/collection.db`.
- Contacts PriceCharting only at import/refresh time. Otherwise fully offline.

### Layers

- `src/routes/**/+page.svelte` — UI
- `src/routes/**/+page.server.ts`, `+server.ts` — server-side data loading and API routes
- `src/lib/db/` — Drizzle schema + query functions; the only code that touches SQLite
- `src/lib/import/` — CSV parsing, catalog import, price refresh

The `src/lib/db/` boundary is the productize-later seam: swapping the Drizzle
adapter from `better-sqlite3` to `postgres-js` and adding `user_id` columns is a
contained change that does not touch the UI layer.

### Directory layout

```
collection_value_tracker/
├── data/collection.db          # SQLite, gitignored
├── data/imports/*.csv          # Downloaded PriceCharting CSVs, gitignored
├── src/
│   ├── lib/db/
│   │   ├── schema.ts           # Drizzle schema
│   │   ├── client.ts           # better-sqlite3 connection
│   │   └── queries/            # Reusable query functions
│   ├── lib/import/
│   │   ├── pricecharting.ts    # CSV stream parser → DB upsert
│   │   ├── refresh.ts          # Re-import + snapshot owned-game prices
│   │   └── sources/
│   │       └── file-drop.ts    # v1: reads a CSV from data/imports/
│   └── routes/
│       ├── +layout.svelte      # App shell, nav
│       ├── +page.svelte        # Dashboard
│       ├── browse/+page.svelte
│       ├── collection/+page.svelte
│       └── settings/+page.svelte
└── drizzle/                    # Migrations
```

## Privacy & Git Hygiene

The GitHub repository is public. The following are gitignored and never
committed: `data/` (the SQLite DB and any downloaded CSVs), `.superpowers/`,
`node_modules/`, `.svelte-kit/`, `build/`, `.env*` (except `.env.example`).

- The collection database is personal data — it stays local.
- The PriceCharting CSV is third-party data — not redistributed.
- The running app binds to localhost; it is not internet-accessible unless
  explicitly exposed.

## Data Model

Four tables. Prices are stored as **integer cents** throughout to avoid
floating-point money bugs; the UI formats for display.

### `games` — the catalog (one row per unique PriceCharting entry)

| Column | Type | Notes |
|---|---|---|
| `id` | PK | PriceCharting product ID (stable across CSV refreshes) |
| `console` | text | e.g. "SNES", "Nintendo 64" |
| `title` | text | e.g. "Chrono Trigger" |
| `region` | text, nullable | e.g. "PAL", "NTSC-J" |
| `loose_price` | int (cents) | Latest known loose price |
| `cib_price` | int (cents) | Latest known complete-in-box price |
| `new_price` | int (cents) | Latest known sealed price |
| `last_updated_at` | timestamp | When the three prices were last refreshed |

### `collection_items` — owned items (ONE ROW PER PHYSICAL ITEM)

| Column | Type | Notes |
|---|---|---|
| `id` | PK, autoincrement | |
| `game_id` | FK → `games.id` | |
| `condition` | text | `"loose"` \| `"cib"` \| `"new"` |
| `grade` | text, nullable | Suggested values: `mint`, `near_mint`, `good`, `fair`, `poor`. Stored as text (not strict enum) for future extensibility |
| `acquired_at` | date, nullable | When the user got the item |
| `notes` | text, nullable | Free text, e.g. "yellowed shell" |
| `created_at` | timestamp | When the row was added |

Duplicates (multiple copies of the same game) are represented as multiple rows,
not a `quantity` column — this preserves per-copy condition, grade, and notes.
This already supports other users' duplicate-heavy collections; no schema change
is needed to productize.

### `price_snapshots` — historical prices for owned games only

| Column | Type | Notes |
|---|---|---|
| `id` | PK, autoincrement | |
| `game_id` | FK → `games.id` | |
| `condition` | text | `"loose"` \| `"cib"` \| `"new"` |
| `price` | int (cents) | |
| `snapshot_at` | timestamp | Equals a refresh event |

Snapshots are recorded only for games the user owns — keeps the table small
(hundreds of rows per refresh, not 150k). Enables "top movers" now and a
value-over-time chart later if desired.

### `refresh_events` — one row per price-refresh action

| Column | Type | Notes |
|---|---|---|
| `id` | PK, autoincrement | |
| `triggered_at` | timestamp | |
| `source` | text | e.g. `"pricecharting_csv:2026-05-19"` |
| `games_updated` | int | Number of owned games whose price changed |

### Deliberately NOT in v1

No `users` table and no `user_id` foreign keys — added in a single migration
if/when the app becomes multi-user. No `quantity` column (see above). No
`purchase_price` / cost-basis column.

## CSV Import & Refresh

Both operations live in `src/lib/import/` and share most of one code path. The
CSV parser accepts a `Readable` stream and knows nothing about where the stream
came from — a dependency-inversion seam. v1 has one source (`file-drop.ts`,
reading from `data/imports/`); future sources (stored URL, authenticated
download) are new ~30-line files, not parser changes.

### Initial import

1. User downloads the PriceCharting CSV and places it in `data/imports/`
   (or picks it via a file chooser).
2. App reads the CSV with a **streaming** parser — never loads the whole file
   into memory.
3. Each row is UPSERTed into `games`, keyed on PriceCharting's product `id`
   (not title — titles vary by region/edition).
4. Progress is shown in the UI (`X / Y` rows).
5. On completion: a summary (games loaded, errors).

### Price refresh (the routine workflow)

1. Same streaming read of the most recent CSV.
2. Only games matching a `collection_items.game_id` are updated.
3. For each owned game whose price changed: update `games` price columns and
   insert a `price_snapshots` row.
4. Insert one `refresh_events` row with the summary.
5. UI reports how many games rose/fell and links to top movers.

The refresh action is idempotent — running it twice in a row finds no changes
and exits early.

## UI / Screens

Four screens behind a shared app shell with navigation.

### Dashboard (`/`) — tile-grid layout

- Stat tiles: Total Value (with delta since last refresh), Item count.
- A stacked horizontal bar showing value distribution by console, with a legend.
- A Top Movers panel: games that changed most in dollars since the last refresh.

### Browse (`/browse`) — the browse-and-check entry screen

- Left sidebar: console list with per-console game counts; filter toggles
  (owned only / not-owned only).
- Search box for title search within the selected console.
- Scrolling list of games. Each row shows the title and three price buttons
  under aligned **Loose / CIB / New** column headers.
- **Prices are the buttons.** Clicking a price adds a `collection_items` row in
  that condition; the button shows as selected. Clicking the selected price
  again removes that item.
- **Right-click an owned row** opens the detail editor (grade, notes,
  acquired date, "add another copy"). Also reachable via a hover affordance so
  it is not a hidden-only gesture.
- Adding a *second copy of the same condition* is done through the detail
  editor's "add another copy", not the price toggle.
- Header columns and row price columns share a single column-width definition
  (CSS Grid template or shared custom properties) so alignment cannot drift.

### My Collection (`/collection`)

- Summary strip: total value, item count, average per item.
- Filter box, console filter, sort control, and a "Group by console" toggle.
- A sortable table: Title (with inline italic notes), Console, Condition badge,
  Grade, Value (reflecting the item's condition), and a per-row `⋯` menu.
- The `⋯` menu and click-to-expand both open the same editor: Edit
  (condition / grade / notes / acquired date), Add another copy, Remove.

### Settings / Import (`/settings`)

- **Catalog** block: count of games loaded, last import info, file chooser /
  drop target, "Import catalog" action.
- **Prices** block: last-refreshed info, "Refresh now" action.
- **Progress** UI shown during import/refresh: a streaming `X / Y` bar; the app
  remains usable during the operation.
- **Recent refresh history**: rows from `refresh_events`.
- Footer note: the DB is `data/collection.db`; back it up by copying the file;
  nothing is sent anywhere.

## Non-Goals (v1)

- No authentication or multi-user.
- No value-history chart (snapshots are recorded, just not charted).
- No cost-basis / gain-loss tracking.
- No automated CSV download (manual file drop only).
- No eBay or real-time pricing.
- No barcode scanning.
- No mobile-native app.
- No box-art images.

## Open Verification Items

These are believed-true assumptions to confirm early during implementation, not
blockers.

| # | Verify | Why it matters | Fallback |
|---|---|---|---|
| 1 | PriceCharting free CSV scope today + exact columns | The pricing model depends on it | $40/yr API; the source-agnostic import layer contains the change |
| 2 | CSV delimiter, encoding, header names | Parser maps columns to schema | Column mapping kept in one config object; make it tolerant |
| 3 | `better-sqlite3` builds on the target Windows machine (native module) | Could block `npm install` | Node 22+ built-in `node:sqlite` as a no-native-build fallback |
| 4 | PriceCharting product `id` stability across CSV versions | It is the UPSERT primary key | Composite natural key `(console, title, region)` |

## Future / Productize-Later Path

If the tool proves valuable as a public product:

1. Add a `users` table and `user_id` foreign keys (one migration).
2. Add authentication.
3. Swap the Drizzle adapter from `better-sqlite3` to Postgres, or move to a
   per-user SQLite file on the server.
4. Add a CSV source that fetches automatically (stored URL or authenticated
   download) via a new file in `src/lib/import/sources/`.

None of these require touching the UI layer or rewriting core logic.
