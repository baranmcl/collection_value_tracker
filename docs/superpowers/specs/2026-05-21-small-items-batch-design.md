# Small-Items Batch — Design Spec

**Date:** 2026-05-21
**Status:** Approved — ready for planning
**Workstream:** D of 4 (refresh progress ✅ → value-over-time chart ✅ → browse performance ✅ → small-items batch)

## Summary

Three independent improvements, grouped because each is small:

1. **Estimate quality on the Collection screen** — every price estimate
   already carries a `computedAt` timestamp and a `listingCount` (how many
   eBay sold listings its median was built from). Neither surfaces in the
   UI. This adds, to each estimate-valued Collection row, a relative age
   ("est. 3d ago") that turns muted once past 30 days, and a low-confidence
   marker when the estimate rests on fewer than 3 listings.
2. **CSV export of the collection** — a download of the full collection as
   a spreadsheet-friendly CSV, triggered from the Collection screen.
3. **Database backup download** — a one-click download of a consistent
   SQLite snapshot from the Settings screen, replacing the current
   "copy the file yourself" footnote.

Each numbered item is built as its own phase — three phases total. Items 1
and 2 share a server-side helper (`enrichedCollection`): phase 1 introduces
it, phase 2 reuses it. Each phase ships independently.

## Goals

- **Estimate trust at a glance.** A Collection row makes plain how old its
  estimate is and whether it rests on thin data — the user can tell a
  confident number from a guess without leaving the screen.
- **The collection is exportable.** One click yields a CSV that opens
  cleanly in any spreadsheet, with every field correctly escaped.
- **A safe one-click backup.** The user can download a point-in-time
  snapshot of the whole database — including the price and value history
  that a CSV cannot capture — without risking a torn copy of a live file.
- **No new dependency.** CSV is hand-written; the snapshot uses SQLite's
  built-in `VACUUM INTO`.

## Non-Goals

- **CSV import / restore.** The CSV is a human-readable record, not a
  reload path. Restoring the collection from it would be manual re-entry.
  An importer is a possible later feature; out of scope here.
- **Estimate quality on Browse or the dashboard.** Staleness and
  low-confidence surface only on the Collection screen. Extending them to
  the Browse `ConditionButton` or the dashboard is a possible later
  addition.
- **Scheduled / automatic backups.** The backup is user-triggered only.
- **Configurable thresholds.** The 30-day staleness window and the
  3-listing confidence floor are fixed constants, not settings.

## Background: current shape

- `price_estimates` (`src/lib/db/schema.ts`) — one row per
  `(game, condition)`: `estimate` (cents, nullable), `listingCount`
  (default 0), `source`, `computedAt`. `PriceEstimate` is the inferred
  select type.
- `estimateMap(db)` (`src/lib/db/queries/prices.ts`) — returns
  `Map<string, number | null>` keyed `${gameId}:${condition}`, value only.
  Used by the Browse and dashboard loads.
- `resolveItemValue(item, estimate)` — manual price wins, else the
  estimate, else `null`.
- `src/routes/collection/+page.server.ts` — `load` calls `listCollection`
  + `estimateMap`, maps each row to `{ …, value, valueSource }` where
  `valueSource` is `'manual'` / `'estimate'` / `'unknown'`, then computes
  `totalValue` and `averageValue`.
- `src/routes/collection/+page.svelte` — renders a row grid; the Value
  cell shows `formatCents(value)` and a `<small class="src">` line with
  the `valueSource`.
- `src/lib/db/client.ts` — opens the better-sqlite3 connection (`sqlite`,
  not currently exported), wraps it with Drizzle as `db`, runs `migrate`
  and `backfillFoldedTitles`.
- `src/routes/settings/+page.svelte` — ends with a footnote: *"Database
  lives at `data/collection.db` — back it up by copying that file."*

## Design

### 1. Estimate quality (staleness + low confidence)

**The estimate-quality module.** A new pure module
`src/lib/estimate-quality.ts` holds the display policy for both signals:

```ts
export const STALE_AFTER_DAYS = 30;
export const LOW_CONFIDENCE_BELOW = 3; // estimates from <3 listings are thin

/** "today", "3d ago", "2w ago", "5mo ago", "2y ago". */
export function relativeAge(at: Date, now: Date): string;

/** True once an estimate is older than STALE_AFTER_DAYS. */
export function isStale(at: Date, now: Date): boolean;

/** True when an estimate rests on too few listings to trust. */
export function isLowConfidence(listingCount: number): boolean;
```

`relativeAge` and `isStale` take an explicit `now` so they are
deterministic and unit-testable. `relativeAge` rounds down to the largest
whole unit (day → week → month → year); under one day reads "today".

**The estimate-records query.** A new function in
`src/lib/db/queries/prices.ts`, beside `estimateMap`:

```ts
/** Full estimate rows keyed `${gameId}:${condition}` — value plus the
 *  computedAt timestamp and listingCount, for the Collection screen. */
export function estimateRecords(db: DB): Map<string, PriceEstimate>;
```

`estimateMap` is **left unchanged** — Browse and the dashboard keep using
its value-only shape; widening it would ripple needlessly.

**The enriched-collection helper.** The Collection `load` and the CSV
export route both need the same value-resolved collection. A new
`src/lib/server/collection.ts` (mirroring `src/lib/server/dashboard.ts`)
provides it:

```ts
export interface EnrichedItem {
  id: number; gameId: number; title: string; console: string;
  boxartUrl: string | null; condition: string; grade: string | null;
  notes: string | null; acquiredAt: string | null;
  manualPrice: number | null;
  value: number | null;                       // resolved, integer cents
  valueSource: 'manual' | 'estimate' | 'unknown';
  estimatedAt: Date | null;                    // estimate's computedAt, when valueSource === 'estimate'
  listingCount: number | null;                 // estimate's listingCount, when valueSource === 'estimate'
}

/** Every collection item with its resolved value and estimate metadata. */
export function enrichedCollection(db: DB): EnrichedItem[];
```

It calls `listCollection` + `estimateRecords`, resolves each value with
`resolveItemValue`, and fills `estimatedAt` / `listingCount` from the
estimate row only when the value came from an estimate (a manual-priced
item carries no estimate metadata even if an estimate exists). Row order
is `listCollection`'s — alphabetical by title.

**The Collection load.** `src/routes/collection/+page.server.ts` calls
`enrichedCollection`, then maps each item to the page shape, adding two
presentation fields derived with the estimate-quality helpers:

- `estimateAge: string | null` — `relativeAge(estimatedAt, now)` when
  `estimatedAt` is set, else `null`.
- `estimateStale: boolean` — `isStale(estimatedAt, now)` when set, else
  `false`.

It keeps emitting `listingCount` so the page can show the listing count in
the low-confidence marker. `totalValue` / `averageValue` are computed as
today.

**The Collection row.** In `+page.svelte`, the Value cell gains, below the
existing `valueSource` line and only for `valueSource === 'estimate'`
rows:

- the age line — `est. {estimateAge}` — with a `.stale` class applied
  when `estimateStale` (muted color);
- a low-confidence marker when `isLowConfidence(listingCount)` — a small
  warning-colored badge naming the count, e.g. *"⚠ 1 listing"* /
  *"⚠ 2 listings"*.

Manual and unknown rows show neither. No layout columns change — both
additions sit inside the existing Value cell.

### 2. CSV export

**The pure formatter.** `src/lib/export/csv.ts`:

```ts
export function collectionToCsv(items: EnrichedItem[]): string;
```

It emits RFC 4180 CSV: a header row, then one row per item, records
separated by `\r\n`. A field is wrapped in double quotes when it contains
a comma, a double quote, a CR, or an LF; embedded double quotes are
doubled. Columns, in order:

| Column | Source |
|---|---|
| Title | `title` |
| Console | `console` |
| Condition | `CONDITION_LABELS[condition]` (human label) |
| Grade | `grade` — empty cell when `null` |
| Value (USD) | `value` as a bare `"42.00"` (no `$`, no thousands sep); empty when `null` |
| Value Source | `valueSource` |
| Acquired | `acquiredAt` (ISO `yyyy-mm-dd`) — empty when `null` |
| Notes | `notes` — empty when `null` |

`Value (USD)` is a bare number so a spreadsheet reads the column as
numeric. Cents-to-dollars conversion happens only here, at the output
boundary (the value stays integer cents everywhere else — CVT-1).

**The route.** A new `src/routes/api/export/+server.ts` with a `GET`
handler: it calls `enrichedCollection(db)`, passes the items to
`collectionToCsv`, and returns the string as a `Response` with
`Content-Type: text/csv; charset=utf-8` and
`Content-Disposition: attachment; filename="collection-<yyyy-mm-dd>.csv"`
(the date is the server's current date).

**The trigger.** `src/routes/collection/+page.svelte` gains an
"Export CSV" link in the controls row — a plain
`<a href="/api/export" download>` styled to match the screen. A link, not
a `fetch`: the browser handles the download directly.

### 3. Database backup download

**Exposing the connection.** `src/lib/db/client.ts` adds `sqlite` (the
better-sqlite3 `Database` instance) to its exports, alongside `db` and the
`DB` type. The Drizzle wrapper has no snapshot primitive; `VACUUM INTO`
must run on the raw connection.

**The route.** A new `src/routes/api/backup/+server.ts` with a `GET`
handler:

1. Build a unique temp path — `<os.tmpdir()>/cvt-backup-<random>.db` — so
   concurrent requests never collide (`VACUUM INTO` refuses an existing
   file).
2. Run `VACUUM INTO` on `sqlite` targeting that path. This produces a
   single-file, fully consistent, defragmented snapshot — correct even
   while the live WAL database is being written, which a plain filesystem
   copy is not.
3. Read the snapshot bytes, return them as a `Response` with
   `Content-Type: application/octet-stream` and
   `Content-Disposition: attachment;
   filename="collection-backup-<yyyy-mm-dd>.db"`.
4. Delete the temp file in a `finally` so a failure mid-response still
   cleans up. If `VACUUM INTO` itself throws, the handler returns a 500
   with a short message and still removes any partial temp file.

**The trigger.** `src/routes/settings/+page.svelte` gains a
"Download backup" control — an `<a href="/api/backup" download>` styled as
a button, in its own small card or appended to an existing one, with a
one-line note ("Downloads a complete snapshot of the database — catalog,
collection, and price history."). The old footnote's manual-copy sentence
is removed (the button supersedes it); the footnote's second sentence
("Nothing is sent anywhere except external price and catalog APIs")
stays.

### Module responsibilities

- `src/lib/estimate-quality.ts` — pure display policy: `relativeAge`,
  `isStale`, `isLowConfidence`, and the two threshold constants. No I/O.
- `src/lib/db/queries/prices.ts` — gains `estimateRecords` (full estimate
  rows as a map). `estimateMap` unchanged.
- `src/lib/server/collection.ts` — `enrichedCollection`: the one
  definition of the value-resolved collection. Used by the Collection load
  and the export route.
- `src/lib/export/csv.ts` — pure `collectionToCsv`: `EnrichedItem[]` in, a
  CSV string out. No I/O.
- `src/routes/api/export/+server.ts` — wires `enrichedCollection` →
  `collectionToCsv` → a CSV download response.
- `src/routes/api/backup/+server.ts` — `VACUUM INTO` a temp snapshot →
  a `.db` download response → temp cleanup.
- `src/lib/db/client.ts` — additionally exports the raw `sqlite`
  connection.
- `src/routes/collection/+page.server.ts` — sources its items from
  `enrichedCollection`, adds `estimateAge` / `estimateStale`.
- `src/routes/collection/+page.svelte` — renders the age line, the stale
  treatment, the low-confidence marker, and the Export CSV link.
- `src/routes/settings/+page.svelte` — renders the Download backup
  control.

## Testing

All tests use a test DB and fakes — no live external calls (CVT-T1).

- **`estimate-quality`** — `relativeAge` for "today", days, weeks, months,
  years (with a fixed `now`); `isStale` false at 29 days and true at 31;
  `isLowConfidence` true for 0–2 listings, false for 3+.
- **`estimateRecords`** — returns the full row (value, `computedAt`,
  `listingCount`) per `gameId:condition`; absent pairs are absent from the
  map.
- **`enrichedCollection`** — a manual-priced item has `valueSource`
  `'manual'` and `estimatedAt` / `listingCount` `null` even when an
  estimate row exists; an estimate-valued item carries the estimate's
  `computedAt` and `listingCount`; an item with neither is `'unknown'`
  with a `null` value.
- **`collectionToCsv`** — the header row; a plain row; a notes field
  containing a comma, a double quote, and a newline is correctly quoted
  and the internal quote doubled; `null` grade / acquired / notes become
  empty cells; `value` renders as `"42.00"` and a `null` value as an empty
  cell; records are `\r\n`-separated.
- **`/api/export` route** — `GET` returns `text/csv`, a
  `Content-Disposition: attachment` filename, and a body whose first line
  is the header and which contains a seeded item.
- **`/api/backup` route** — `GET` returns
  `application/octet-stream`, an attachment filename ending `.db`, and a
  body whose first 16 bytes are the SQLite magic string
  `"SQLite format 3\0"`; after the request no `cvt-backup-*` file remains
  in the temp directory.
- **Collection page test** — an estimate-valued row renders its
  `est. … ago` age line; a row with a stale estimate carries the `.stale`
  class; a row whose `listingCount` is below the floor renders the
  low-confidence marker with the count; a manual-priced row renders
  neither; the Export CSV link points at `/api/export`.
- **Settings page test** — the Download backup control renders and points
  at `/api/backup`.

Test output must stay pristine.

## File-level change list

| File | Change |
|---|---|
| `src/lib/estimate-quality.ts` | **New** — `relativeAge`, `isStale`, `isLowConfidence`, thresholds |
| `src/lib/db/queries/prices.ts` | **New** `estimateRecords(db)` |
| `src/lib/server/collection.ts` | **New** — `enrichedCollection(db)` + `EnrichedItem` |
| `src/lib/export/csv.ts` | **New** — `collectionToCsv(items)` |
| `src/routes/api/export/+server.ts` | **New** — CSV download route |
| `src/routes/api/backup/+server.ts` | **New** — DB snapshot download route |
| `src/lib/db/client.ts` | Export the raw `sqlite` connection |
| `src/routes/collection/+page.server.ts` | Source items from `enrichedCollection`; add `estimateAge` / `estimateStale` |
| `src/routes/collection/+page.svelte` | Age line + stale treatment + low-confidence marker; Export CSV link |
| `src/routes/settings/+page.svelte` | Download backup control |
| Test files | `estimate-quality`, `estimateRecords`, `enrichedCollection`, `collectionToCsv`, the two routes, the Collection and Settings page tests |

## Verification

- `npm run check` clean; full `vitest` suite green.
- A Collection row priced from a recent estimate shows "est. <n>d ago"; an
  old one shows it muted; a thin one shows the low-confidence marker.
- "Export CSV" downloads a file that opens in a spreadsheet with every
  column intact, including notes containing commas and quotes.
- "Download backup" downloads a `.db` file that opens as a valid SQLite
  database holding the catalog, collection, and price history.
