# Collection Value Tracker — Design Spec

**Date:** 2026-05-19
**Status:** Revised after data-source pivot — ready for re-approval, then planning

## Revision History

- **2026-05-19 (initial):** Approved design built on PriceCharting's free CSV
  download for both catalog and prices.
- **2026-05-19 (this revision):** PriceCharting moved CSV downloads behind their
  $49/mo "Legendary" tier, and their API has no bulk-catalog endpoint. The price
  source pivoted to a **free + legitimate** stack:
  - **Catalog** comes from **TheGamesDB** (free community API).
  - **Prices** are *estimates* computed from **eBay's official Browse API**
    (active listings), with **manual per-item override** as the fallback.
  This is a no-cost, no-scraping path. It changes the data sources, the data
  model, the meaning of "value", and the Browse screen interaction. The
  SvelteKit + SQLite + Drizzle foundation is unchanged.

## Summary

A local-first web app to track the estimated market value of a retro video game
collection. The core idea inverts the typical collection-tracker UX: instead of
searching for and typing in each game one by one, the user browses a pre-loaded
catalog of the retro game universe (synced for free from TheGamesDB) and clicks
to mark what they own. Each owned game's value is *estimated* on demand from
current eBay active listings via eBay's official Browse API; the user can
override any estimate with a manually entered price. A portfolio-style dashboard
summarizes total estimated value, console breakdown, and the games that moved
most since the last refresh.

## Goals

- **Fast entry.** Browse a catalog, click a condition to add a game. No per-game
  searching, no manual addition of totals.
- **Portfolio view.** A dashboard showing total estimated value, breakdown by
  console, and top movers since the last refresh.
- **On-demand pricing.** Estimate prices for owned games when the user chooses —
  no real-time data, no background polling.
- **Free and legitimate.** No paid subscriptions, no scraping, no Terms-of-
  Service violations. Both data sources are official, free-tier APIs.
- **Honest about precision.** Values are clearly labelled *estimates* derived
  from active eBay listings, not authoritative sold-price data. Manual override
  is always available.
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
| Catalog source | **TheGamesDB** free API, synced into local SQLite |
| Price source | **eBay Browse API** active-listing *estimates*; **manual override** fallback |
| Price meaning | Estimate from current active eBay listings — explicitly not sold-price data |
| Catalog pricing | Prices fetched for **owned games only** (API is metered; the catalog is not pre-priced) |
| Value variants | Loose / CIB / New — all three, switchable per item |
| Portfolio features | Total value + console breakdown + top movers (no history chart, no cost basis) |
| Stack | SvelteKit + SQLite (better-sqlite3) + Drizzle ORM |

## Architecture

A single SvelteKit application — one repo, one process.

- Serves a web UI on `localhost` (dev: `:5173`). Reachable from other devices on
  the LAN if the host is explicitly bound to `0.0.0.0` (a later, optional choice).
- Embeds a SQLite database file at `data/collection.db`.
- Contacts **TheGamesDB** at catalog-sync time and **eBay** at price-refresh /
  add-game time. Otherwise fully offline. Browsing the local catalog makes zero
  network calls.

### External services

| Service | Used for | Auth | Notes |
|---|---|---|---|
| TheGamesDB | Game catalog (console, title, region, release year) | Public API key | Synced into `games` table; refreshed rarely |
| eBay Browse API | Active-listing price estimates | OAuth 2.0 client-credentials token | Free tier ~5,000 calls/day; called only for owned games |

Both credentials live in `.env` (gitignored). `.env.example` documents the
required keys. No secret is ever committed or sent anywhere except to the
service that issued it.

### Layers

- `src/routes/**/+page.svelte` — UI
- `src/routes/**/+page.server.ts`, `+server.ts` — server-side data loading and API routes
- `src/lib/db/` — Drizzle schema + query functions; the only code that touches SQLite
- `src/lib/sources/` — external-service clients and the sync/estimate logic

The `src/lib/db/` boundary is the productize-later seam: swapping the Drizzle
adapter from `better-sqlite3` to `postgres-js` and adding `user_id` columns is a
contained change that does not touch the UI layer.

The `src/lib/sources/` boundary isolates every external API. Each source exposes
a small, typed interface; the rest of the app never imports an HTTP client
directly. Swapping a price source (e.g. adding eBay Marketplace Insights sold-
price data later) is a new file behind the same interface.

### Directory layout

```
collection_value_tracker/
├── data/collection.db          # SQLite, gitignored
├── .env                        # API credentials, gitignored
├── .env.example                # Documents required keys, committed
├── src/
│   ├── lib/db/
│   │   ├── schema.ts           # Drizzle schema
│   │   ├── client.ts           # better-sqlite3 connection
│   │   └── queries/            # Reusable query functions
│   ├── lib/sources/
│   │   ├── thegamesdb.ts       # TheGamesDB client + catalog sync
│   │   ├── ebay/
│   │   │   ├── auth.ts         # OAuth client-credentials token (cached)
│   │   │   ├── client.ts       # Browse API search wrapper
│   │   │   └── estimate.ts     # Listings → per-condition price estimate
│   │   └── refresh.ts          # Re-estimate owned games; write snapshots
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
committed: `data/` (the SQLite DB), `.env` and `.env.*` (except `.env.example`),
`.superpowers/`, `node_modules/`, `.svelte-kit/`, `build/`.

- The collection database is personal data — it stays local.
- API credentials live only in `.env`.
- The running app binds to localhost; it is not internet-accessible unless
  explicitly exposed.

## Data Model

Five tables. Prices are stored as **integer cents** throughout to avoid
floating-point money bugs; the UI formats for display.

The pivot separates *catalog* (free, bulk, from TheGamesDB) from *price
estimates* (metered, per-owned-game, from eBay). Prices therefore live in their
own table rather than as columns on `games`.

### `games` — the catalog (one row per TheGamesDB entry)

| Column | Type | Notes |
|---|---|---|
| `id` | PK | TheGamesDB game ID (stable across syncs) |
| `console` | text | e.g. "Super Nintendo (SNES)" — TheGamesDB platform name |
| `title` | text | e.g. "Chrono Trigger" |
| `region` | text, nullable | e.g. "PAL", "NTSC-J" — from TheGamesDB where available |
| `release_year` | int, nullable | For display / disambiguation |
| `last_synced_at` | timestamp | When this row was last refreshed from TheGamesDB |

`games` holds **no prices** — it is a pure catalog. Browsing it is a local,
offline, zero-API-call operation.

### `collection_items` — owned items (ONE ROW PER PHYSICAL ITEM)

| Column | Type | Notes |
|---|---|---|
| `id` | PK, autoincrement | |
| `game_id` | FK → `games.id` | |
| `condition` | text | `"loose"` \| `"cib"` \| `"new"` |
| `grade` | text, nullable | Suggested: `mint`, `near_mint`, `good`, `fair`, `poor`. Stored as text (not strict enum) for future extensibility |
| `manual_price` | int (cents), nullable | User-entered override. When set, it wins over any eBay estimate |
| `acquired_at` | date, nullable | When the user got the item |
| `notes` | text, nullable | Free text, e.g. "yellowed shell" |
| `created_at` | timestamp | When the row was added |

Duplicates (multiple copies of the same game) are represented as multiple rows,
not a `quantity` column — this preserves per-copy condition, grade, notes, and
manual price. No schema change is needed to productize.

### `price_estimates` — latest known price per (game, condition)

| Column | Type | Notes |
|---|---|---|
| `id` | PK, autoincrement | |
| `game_id` | FK → `games.id` | |
| `condition` | text | `"loose"` \| `"cib"` \| `"new"` |
| `estimate` | int (cents), nullable | Latest computed estimate; null if no listings found |
| `listing_count` | int | How many eBay listings the estimate was computed from |
| `source` | text | `"ebay"` (manual prices live on `collection_items`, not here) |
| `computed_at` | timestamp | When the estimate was last computed |

`UNIQUE(game_id, condition)` — one current estimate per pair. Rows exist only
for `(game, condition)` pairs the user owns; the catalog at large is never
priced.

### `price_snapshots` — historical estimates for owned games

| Column | Type | Notes |
|---|---|---|
| `id` | PK, autoincrement | |
| `game_id` | FK → `games.id` | |
| `condition` | text | `"loose"` \| `"cib"` \| `"new"` |
| `estimate` | int (cents) | The estimate at snapshot time |
| `listing_count` | int | Listings behind that estimate |
| `refresh_event_id` | FK → `refresh_events.id` | Which refresh produced it |
| `snapshot_at` | timestamp | |

Snapshots are recorded only for games the user owns — keeps the table small.
Enables "top movers" now and a value-over-time chart later if desired.

### `refresh_events` — one row per price-refresh action

| Column | Type | Notes |
|---|---|---|
| `id` | PK, autoincrement | |
| `triggered_at` | timestamp | |
| `source` | text | e.g. `"ebay_browse:2026-05-19"` |
| `items_updated` | int | Number of owned (game, condition) pairs whose estimate changed |
| `errors` | int | Number of pairs that failed to estimate (kept old value) |

### Item value resolution

The displayed value of a `collection_item` is:

1. `collection_items.manual_price` if set, else
2. the `price_estimates.estimate` for that item's `(game_id, condition)` if present, else
3. unknown — shown as `—` in the UI, counted as `$0` toward totals but flagged.

### Deliberately NOT in v1

No `users` table and no `user_id` foreign keys — added in a single migration
if/when the app becomes multi-user. No `quantity` column (see above). No
`purchase_price` / cost-basis column. No box-art (TheGamesDB offers art; out of
scope for v1).

## Catalog Sync (TheGamesDB)

Lives in `src/lib/sources/thegamesdb.ts`. One operation: pull the game list for
each supported platform and UPSERT into `games`, keyed on TheGamesDB game ID.

1. The user triggers "Sync catalog" from Settings (rare — the catalog is near-
   static).
2. The client pages through TheGamesDB's per-platform games endpoint for each
   platform in a configured platform list.
3. Each game is UPSERTed into `games` (console, title, region, release year),
   keyed on TheGamesDB ID.
4. Progress is shown in the UI (`X / Y` platforms, running game count).
5. On completion: a summary (games loaded, platforms covered, errors).

The platform list is a config object — adding a console is a one-line change.
The TheGamesDB API key is read from `.env`.

## Price Estimation (eBay Browse API)

Lives in `src/lib/sources/ebay/`. Prices are computed, never imported wholesale.

### Authentication

`auth.ts` performs the OAuth 2.0 **client-credentials** grant using the eBay app
ID and client secret from `.env`, requesting the public Browse scope. The token
(~2 h lifetime) is cached in memory and refreshed on expiry. No user login.

### Estimating one (game, condition) pair

`client.ts` + `estimate.ts`, given a game and a condition:

1. Build a search query from the game's title and console plus condition
   keywords:
   - **loose** → keywords like `loose`, `cart only`, `disc only`, `game only`
   - **cib** → `complete`, `CIB`, `complete in box`
   - **new** → `sealed`, `brand new` (and prefer eBay `conditionId` 1000)
2. Call `GET /buy/browse/v1/item_summary/search` with the query, the video-game
   category filter, `buyingOptions:{FIXED_PRICE}` (Buy-It-Now only — avoids
   mid-auction prices), the `EBAY_US` marketplace, and a bounded `limit`.
3. From the returned listings, compute a robust estimate: the **median** of the
   listing prices (median resists outliers without explicit trimming).
4. Record the estimate and the `listing_count`. If zero usable listings are
   found, the estimate is `null` and `listing_count` is `0`.

The query construction and condition-keyword map are a single config object so
the heuristic can be tuned in one place (see Open Verification Items).

### When estimation runs

Estimation is **on demand only** — never background, never for the whole catalog:

- **On add:** when the user adds a game in a condition, that one
  `(game, condition)` pair is estimated (one eBay search) so a value appears
  shortly after the click.
- **On refresh:** "Refresh estimates" in Settings re-estimates every owned
  `(game, condition)` pair that has no `manual_price`. For a few hundred owned
  items this is a few hundred calls — minutes of work, well within the daily
  quota.

Refresh writes: update `price_estimates`; if the estimate changed, insert a
`price_snapshots` row; insert one `refresh_events` row with the summary. An item
with a `manual_price` is skipped (the user owns that number).

Refresh is idempotent in spirit — running it twice produces only the small drift
of live listings, not duplicate rows.

## UI / Screens

Four screens behind a shared app shell with navigation.

### Dashboard (`/`) — tile-grid layout

- Stat tiles: Total Estimated Value (with delta since last refresh), Item count.
- A stacked horizontal bar showing value distribution by console, with a legend.
- A Top Movers panel: games that changed most in dollars since the last refresh.
- Estimates are labelled as such — a small "estimated from eBay listings" note
  so the totals are never mistaken for authoritative valuations.

### Browse (`/browse`) — the browse-and-check entry screen

- Left sidebar: console list with per-console game counts; filter toggles
  (owned only / not-owned only).
- Search box for title search within the selected console.
- Scrolling list of catalog games. Each row shows the title and three controls
  under aligned **Loose / CIB / New** column headers.
- **The three controls are condition buttons, not prices** (the catalog is not
  pre-priced — see the architecture note). For a row the user does **not** own
  in that condition, the control is an "add" button. Clicking it adds a
  `collection_items` row in that condition and kicks off a background eBay
  estimate; when the estimate returns the control updates to show the value and
  a selected state. Clicking a selected control again removes that item.
- While an estimate is in flight the control shows a pending indicator.
- **Right-click an owned row** opens the detail editor (grade, notes, acquired
  date, manual price, "add another copy"). Also reachable via a hover
  affordance so it is not a hidden-only gesture.
- Adding a *second copy of the same condition* is done through the detail
  editor's "add another copy", not the condition toggle.
- Header columns and row controls share a single column-width definition (CSS
  Grid template or shared custom properties) so alignment cannot drift.

### My Collection (`/collection`)

- Summary strip: total estimated value, item count, average per item.
- Filter box, console filter, sort control, and a "Group by console" toggle.
- A sortable table: Title (with inline italic notes), Console, Condition badge,
  Grade, Value (estimate or manual price, with a marker showing which), and a
  per-row `⋯` menu.
- The `⋯` menu and click-to-expand both open the same editor: Edit
  (condition / grade / notes / acquired date / manual price), Add another copy,
  Remove.
- A manual price visibly overrides the estimate; clearing it returns the item
  to the eBay estimate.

### Settings / Import (`/settings`)

- **Catalog** block: count of games loaded, last sync info, supported platform
  list, "Sync catalog" action (TheGamesDB).
- **Prices** block: last-refreshed info, "Refresh estimates" action (eBay),
  owned-item count to be priced.
- **Credentials** block: shows whether the TheGamesDB key and eBay app
  credentials are present (read from `.env`); never displays the secrets.
- **Progress** UI shown during sync/refresh: a streaming `X / Y` bar; the app
  remains usable during the operation.
- **Recent refresh history**: rows from `refresh_events`.
- Footer note: the DB is `data/collection.db`; back it up by copying the file;
  nothing is sent anywhere except TheGamesDB and eBay.

## Non-Goals (v1)

- No authentication or multi-user.
- No value-history chart (snapshots are recorded, just not charted).
- No cost-basis / gain-loss tracking.
- No eBay *sold*-price data (Marketplace Insights API is a restricted program;
  v1 uses active listings only).
- No scraping of any site.
- No barcode scanning.
- No mobile-native app.
- No box-art images.

## Open Verification Items

These are believed-true assumptions to confirm early during implementation, not
blockers.

| # | Verify | Why it matters | Fallback |
|---|---|---|---|
| 1 | TheGamesDB free API: key acquisition, per-platform games endpoint, rate/allowance limits, response shape | Catalog sync depends on it | A one-time public dataset import; or IGDB as an alternate catalog source behind the same `sources/` interface |
| 2 | eBay Browse API: developer-app registration, OAuth client-credentials scope, daily call quota, `item_summary/search` parameters | The whole pricing path depends on it | Manual price entry already works with zero API; ship that first |
| 3 | Condition-keyword heuristic quality — do `loose` / `cib` / `new` queries return listings that actually match the condition? | Estimate accuracy | Keep the keyword map in one config object; let the user override any estimate manually |
| 4 | TheGamesDB platform names vs. how the user thinks of consoles; region data availability | Console grouping and filters | Normalize platform names in one mapping table |
| 5 | `better-sqlite3` builds on the target Windows machine (native module) | Could block `npm install` | Node 22+ built-in `node:sqlite` as a no-native-build fallback |

## Future / Productize-Later Path

If the tool proves valuable as a public product:

1. Add a `users` table and `user_id` foreign keys (one migration).
2. Add authentication.
3. Swap the Drizzle adapter from `better-sqlite3` to Postgres, or move to a
   per-user SQLite file on the server.
4. Add a higher-quality price source (e.g. eBay Marketplace Insights sold-price
   data, once approved) as a new file in `src/lib/sources/` behind the existing
   interface.

None of these require touching the UI layer or rewriting core logic.
