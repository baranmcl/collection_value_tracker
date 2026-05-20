# Collection Value Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first SvelteKit web app that lets the owner browse a free retro-game catalog, click to mark owned games, estimate each game's value from eBay active listings, and view a portfolio dashboard.

**Architecture:** One SvelteKit app, one process. SQLite (via better-sqlite3 + Drizzle) holds the catalog and collection. `src/lib/db/` is the only code that touches SQLite. `src/lib/sources/` isolates the two external APIs (TheGamesDB for the catalog, eBay Browse API for price estimates). The UI is four screens behind a shared shell. Prices are fetched on demand for owned games only — browsing the local catalog makes zero network calls.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, Vite, better-sqlite3, drizzle-orm + drizzle-kit, Vitest, @testing-library/svelte + jsdom, @sveltejs/adapter-node.

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

**Overall:** ✅ COMPLETE. 9/9 phases shipped; final whole-implementation review passed with 4 fixes applied in `870cbb0`. Merged to `main` (fast-forward) at `5160a56` on 2026-05-20; branch `feat/collection-value-tracker` deleted. Full suite 96 tests passing, `npm run check` clean, `npm run build` succeeds.

| Phase | Status | Ship SHA(s) | Notes |
|---|---|---|---|
| 1 — Project foundation | ✅ Shipped | `c797ab3`..`0d4a749` | test 9/9, check clean, build OK |
| 2 — Database query layer | ✅ Shipped | `6df8526`..`eff9e7e` | 28/28 tests, check clean |
| 3 — TheGamesDB catalog sync | ✅ Shipped | `e4dae1c`..`700c474` | 37 tests, check clean |
| 4 — eBay price estimation | ✅ Shipped | `bf2bbae`..`4cdf241` | 58 tests, check clean |
| 5 — Server routes | ✅ Shipped | `5adb5e9`..`e6f7eac` | 70 tests, check clean |
| 6 — App shell & Settings | ✅ Shipped | `a86d844`..`2ad6331` | 74 tests, check clean, dev render OK |
| 7 — Browse screen | ✅ Shipped | `3fc678a`..`f36057a` | 85 tests, check clean |
| 8 — Collection screen | ✅ Shipped | `b0a3713` | 88 tests, check clean |
| 9 — Dashboard screen | ✅ Shipped | `e43743f`..`46491ab` | 95 tests, check clean, build OK |
| 3 — TheGamesDB catalog sync | ⬜ Not started | — | — |
| 4 — eBay price estimation | ⬜ Not started | — | — |
| 5 — Server routes | ⬜ Not started | — | — |
| 6 — App shell & Settings | ⬜ Not started | — | — |
| 7 — Browse screen | ⬜ Not started | — | — |
| 8 — Collection screen | ⬜ Not started | — | — |
| 9 — Dashboard screen | ⬜ Not started | — | — |

### Discoveries

- **D1 (Task 1.5):** the planned `parseDollars` stripped `-` along with all
  other non-numeric characters, so `parseDollars('-5')` returned `500`
  instead of `null` and the negative-input test would have failed. Fixed
  by rejecting input with a leading `-` before the strip. Code block in
  Task 1.5 corrected; shipped in commit `a0b36c2`.
- **D2 (Task 4.2):** the planned `client.test.ts` destructured `f.mock.calls[0]`,
  which Vitest types as an empty tuple for a zero-arg mock — `svelte-check`
  flagged it. Fixed by casting the destructured call to the expected
  `[string, { headers: Record<string,string> }]` shape. Shipped in `fb1769c`.
- **D3 (Task 6.1):** `@fontsource/*` packages have no types for the bare
  side-effect import; `svelte-check` errored. Fixed with a module
  declaration `src/lib/styles/fonts.d.ts`. Shipped in `a86d844`.
- **D4 (Task 6.1):** the jest-dom custom matchers (`toBeInTheDocument`,
  `toHaveClass`) needed their types registered for `svelte-check`. Added
  `"types": ["@testing-library/jest-dom"]` to `tsconfig.json`. Shipped in
  `a86d844`.
- **D5 (Task 6.2):** the planned settings test `getByText(/eBay/i)` matched
  two elements (the credentials line and the footnote) and threw. The
  footnote wording was changed to remove the second "eBay" mention.
  Shipped in `2ad6331`.
- **D6 (Phase 7, UI test mechanics):** three small plan-test imprecisions
  fixed during execution — `getByText('SNES')` matched both the sidebar and
  the `<h1>` (switched to `getAllByText`); the browse test `data` object
  needed a `search: ''` field to satisfy `PageData`; and `$state(prop)`
  initializers triggered Svelte 5's `state_referenced_locally` warning, fixed
  by wrapping with `untrack(() => ...)`. Shipped across `3fc678a`..`f36057a`.
- **D7 (final review):** the whole-implementation review found 3 user-facing
  issues, all fixed in `870cbb0`: (1) the Browse `{#each}` was unkeyed so
  `ConditionButton` ownership state went stale on console switch — keyed by
  `game.id`; (2) the dashboard "since last refresh" delta routed through a
  misleading `previousTotal` — replaced with a direct `refreshDelta` and an
  honest "from re-priced games" label; (3) `syncCatalog` could loop forever
  on a non-terminating `pages.next` — added an empty-page break and a
  1000-page cap; plus (4) an invalid manual price silently cleared the
  override — now throws. Remaining minor review notes (a stranded refresh
  event row on fatal failure, a wasteful re-estimate on "add another copy",
  the `source` timestamp format, unused `NewGame` export) were judged not
  worth churn for v1 and left as-is.

---

## Conventions for every task

**BEFORE starting any task:**
1. Invoke `superpowers:test-driven-development`.
2. Read `docs/pitfalls/implementation-pitfalls.md` and `docs/pitfalls/testing-pitfalls.md`.
3. Follow TDD: write the failing test → run it red → implement the minimum → run it green.

**BEFORE marking any task complete:**
1. Review the tests against `docs/pitfalls/testing-pitfalls.md` — error paths and edge cases covered?
2. Run the full test suite (`npm run test`) and confirm green.
3. Confirm `npm run check` (svelte-check) passes with no new errors.

**After completing each phase:** review the batch from multiple perspectives — minimum 3 review rounds. If round 3 still finds issues, keep going until clean.

**Money rule (applies everywhere):** all prices are integer **cents**. Never store or compute money as a float. The only float-to-int conversion is `parseDollars` in Task 1.5, which uses `Math.round`. Any task that touches a price MUST assert cents-as-integer in its tests.

---

## Phase 1 — Project foundation

**Execution Status:** ✅ SHIPPED at `c797ab3`..`0d4a749` on 2026-05-20 (branch `feat/collection-value-tracker`)

Goal: a SvelteKit app that builds, has a working SQLite + Drizzle layer with the five-table schema, a passing test harness, and shared money/type utilities.

### Task 1.1: Project conventions

**Files:**
- Create: `CLAUDE.md`, `AGENTS.md`, `git-strategy.md`, `docs/pitfalls/implementation-pitfalls.md`, `docs/pitfalls/testing-pitfalls.md`

- [ ] **Step 1: Run the project-init skill**

Invoke the `project-init` skill (it sequences `claude-agents-md-init`, `git-strategy-init`, `pitfalls-docs-init`). Accept defaults. This creates `CLAUDE.md`, `AGENTS.md`, `git-strategy.md`, and the two pitfalls files.

- [ ] **Step 2: Seed project-specific pitfalls**

Append to `docs/pitfalls/implementation-pitfalls.md`:

```markdown
## CVT-1: Money is integer cents
All prices are stored and computed as integer cents. A float anywhere in a
money path corrupts every total. Convert dollars→cents only via
`parseDollars` (Math.round); convert cents→display only via `formatCents`.

## CVT-2: Prices are estimates, not facts
eBay active listings are asking prices. The UI must label values as
estimates. `manual_price` on a collection_item always overrides an estimate.

## CVT-3: The catalog is never bulk-priced
Never call eBay for unowned games. Price fetches happen only on add and on
explicit refresh, for owned (game, condition) pairs.
```

Append to `docs/pitfalls/testing-pitfalls.md`:

```markdown
## CVT-T1: No live external calls in tests
TheGamesDB and eBay clients must be tested against injected fakes/mocks.
A test that hits the real network is forbidden — it is slow, flaky, and
quota-consuming.

## CVT-T2: Async UI state needs deterministic synchronization
The "estimate appears after add" flow is async. Tests must await a
deterministic signal (resolved promise / awaited fetch mock), never a
fixed sleep. If an assertion races, fix the synchronization — do not
weaken or delete the assertion.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md AGENTS.md git-strategy.md docs/pitfalls/
git commit -m "chore: initialize project conventions and pitfalls docs"
```

### Task 1.2: SvelteKit scaffold + test harness

**Files:**
- Create: project scaffold via `sv`, `vitest-setup.ts`, modify `vite.config.ts`, `package.json`
- Test: `src/lib/smoke.test.ts`

- [ ] **Step 1: Scaffold SvelteKit into the existing repo**

This repo is NOT empty — it already has `.git/`, `docs/`, `LICENSE`,
`.gitignore`, `.superpowers/`. `sv create .` will refuse or require
confirmation, so scaffold into a temp directory and copy the result in:

```bash
npx sv create --template minimal --types ts /tmp/cvt-scaffold
```

If `sv` still prompts interactively, choose: **minimal** template,
**TypeScript** syntax, and **no** add-ons. Then copy the generated files
into the repo root WITHOUT overwriting the existing `.gitignore`,
`LICENSE`, `docs/`, `.superpowers/`:

```bash
cp -r /tmp/cvt-scaffold/src /tmp/cvt-scaffold/static . 2>/dev/null || true
cp /tmp/cvt-scaffold/svelte.config.js /tmp/cvt-scaffold/vite.config.* \
   /tmp/cvt-scaffold/tsconfig.json /tmp/cvt-scaffold/package.json \
   /tmp/cvt-scaffold/.npmrc . 2>/dev/null || true
```

Verify the existing `.gitignore` still contains the `data/`, `.env`,
`.superpowers/` entries after the copy — if `sv` wrote its own
`.gitignore` into the temp dir, merge its `node_modules/`, `.svelte-kit/`,
`build/` lines into the existing file rather than replacing it.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install -D vitest @testing-library/svelte @testing-library/jest-dom jsdom @sveltejs/adapter-node
npm install better-sqlite3 drizzle-orm
npm install -D drizzle-kit @types/better-sqlite3
```

- [ ] **Step 3: Configure adapter and Vitest**

In `svelte.config.js`, swap the adapter import to `@sveltejs/adapter-node`.

Replace `vite.config.ts` with:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit(), svelteTesting()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest-setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
```

Create `vitest-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Write the failing smoke test**

`src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests — verify green**

Run: `npm run test`
Expected: 1 passed. Run `npm run dev` and confirm the app serves on `:5173`, then stop it.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold SvelteKit app with Vitest test harness"
```

### Task 1.3: SQLite + Drizzle client

**Files:**
- Create: `src/lib/db/client.ts`, `src/lib/db/test-db.ts`, `drizzle.config.ts`

This task creates infrastructure with no standalone test: `makeTestDb()`
cannot run until migrations exist (Task 1.4 generates them). `makeTestDb()`
is first exercised — and thereby verified — by Task 1.4's schema test.
Do NOT write a test here that would be committed red; that breaks the
red→green→commit discipline.

- [ ] **Step 1: Create `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite'
});
```

- [ ] **Step 2: Create `src/lib/db/client.ts`**

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';

const DB_PATH = process.env.DB_PATH ?? 'data/collection.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
```

- [ ] **Step 3: Create `src/lib/db/test-db.ts`**

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

/** In-memory DB with the full schema applied. For tests only. */
export function makeTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return db;
}
```

NOTE: `test-db.ts` and `client.ts` import `./schema`, which does not exist
until Task 1.4. **The per-task `npm run check` completion gate is DEFERRED
for Task 1.3** — it cannot pass until `schema.ts` exists. Commit Task 1.3
with the two not-yet-resolvable imports; the `npm run check` gate is
satisfied at the end of Task 1.4 instead. This is the one task in the plan
where the gate is deferred; every other task must pass `npm run check`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add SQLite/Drizzle client and in-memory test db helper"
```

### Task 1.4: Database schema + migration

**Files:**
- Create: `src/lib/db/schema.ts`, `drizzle/` (generated)
- Test: `src/lib/db/schema.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/db/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from './test-db';
import { games, collectionItems, priceEstimates } from './schema';

describe('schema', () => {
  it('inserts a game and an owned item', () => {
    const db = makeTestDb();
    db.insert(games).values({
      id: 1, console: 'SNES', title: 'Chrono Trigger',
      region: 'NTSC', releaseYear: 1995, lastSyncedAt: new Date()
    }).run();
    db.insert(collectionItems).values({
      gameId: 1, condition: 'loose', createdAt: new Date()
    }).run();
    expect(db.select().from(collectionItems).all()).toHaveLength(1);
  });

  it('enforces the unique (game, condition) estimate pair', () => {
    const db = makeTestDb();
    db.insert(games).values({ id: 1, console: 'SNES', title: 'X', lastSyncedAt: new Date() }).run();
    db.insert(priceEstimates).values({ gameId: 1, condition: 'loose', listingCount: 0, computedAt: new Date() }).run();
    expect(() =>
      db.insert(priceEstimates).values({ gameId: 1, condition: 'loose', listingCount: 0, computedAt: new Date() }).run()
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- schema`
Expected: FAIL — `./schema` not found.

- [ ] **Step 3: Create `src/lib/db/schema.ts`**

```ts
import { sqliteTable, integer, text, unique } from 'drizzle-orm/sqlite-core';

export const games = sqliteTable('games', {
  id: integer('id').primaryKey(), // TheGamesDB game id
  console: text('console').notNull(),
  title: text('title').notNull(),
  region: text('region'),
  releaseYear: integer('release_year'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }).notNull()
});

export const collectionItems = sqliteTable('collection_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  condition: text('condition').notNull(), // 'loose' | 'cib' | 'new'
  grade: text('grade'),
  manualPrice: integer('manual_price'), // cents, nullable
  acquiredAt: text('acquired_at'), // ISO yyyy-mm-dd
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const refreshEvents = sqliteTable('refresh_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  triggeredAt: integer('triggered_at', { mode: 'timestamp' }).notNull(),
  source: text('source').notNull(),
  itemsUpdated: integer('items_updated').notNull().default(0),
  errors: integer('errors').notNull().default(0)
});

export const priceEstimates = sqliteTable('price_estimates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  condition: text('condition').notNull(),
  estimate: integer('estimate'), // cents, nullable when no listings
  listingCount: integer('listing_count').notNull().default(0),
  source: text('source').notNull().default('ebay'),
  computedAt: integer('computed_at', { mode: 'timestamp' }).notNull()
}, (t) => ({ uniqPair: unique().on(t.gameId, t.condition) }));

export const priceSnapshots = sqliteTable('price_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  condition: text('condition').notNull(),
  estimate: integer('estimate').notNull(),
  listingCount: integer('listing_count').notNull(),
  refreshEventId: integer('refresh_event_id').notNull().references(() => refreshEvents.id),
  snapshotAt: integer('snapshot_at', { mode: 'timestamp' }).notNull()
});

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type CollectionItem = typeof collectionItems.$inferSelect;
export type PriceEstimate = typeof priceEstimates.$inferSelect;
export type RefreshEvent = typeof refreshEvents.$inferSelect;
```

- [ ] **Step 4: Generate the migration**

```bash
npx drizzle-kit generate
```
Expected: a SQL file appears in `drizzle/`.

- [ ] **Step 5: Run tests — verify green**

Run: `npm run test -- schema`
Expected: PASS — the schema tests pass, confirming `schema.ts`, the
generated migration, and `makeTestDb()` all work together. Also run
`npm run check` now: it should pass (the Task 1.3 deferred-gate is
satisfied — `schema.ts` now exists).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add five-table Drizzle schema and initial migration"
```

### Task 1.5: Shared types and money utilities

**Files:**
- Create: `src/lib/types.ts`, `src/lib/money.ts`
- Test: `src/lib/money.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatCents, parseDollars } from './money';

describe('formatCents', () => {
  it('formats cents as dollars', () => {
    expect(formatCents(17244)).toBe('$172.44');
    expect(formatCents(0)).toBe('$0.00');
  });
  it('renders null as an em dash', () => {
    expect(formatCents(null)).toBe('—');
  });
});

describe('parseDollars', () => {
  it('parses dollar input to integer cents', () => {
    expect(parseDollars('172.44')).toBe(17244);
    expect(parseDollars('$1,200')).toBe(120000);
  });
  it('rounds to the nearest cent (no float drift)', () => {
    expect(parseDollars('0.1')).toBe(10);
    expect(Number.isInteger(parseDollars('19.99'))).toBe(true);
  });
  it('rejects negative and non-numeric input', () => {
    expect(parseDollars('-5')).toBeNull();
    expect(parseDollars('abc')).toBeNull();
    expect(parseDollars('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- money`
Expected: FAIL — `./money` not found.

- [ ] **Step 3: Create `src/lib/types.ts`**

```ts
export type Condition = 'loose' | 'cib' | 'new';

export const CONDITIONS: readonly Condition[] = ['loose', 'cib', 'new'] as const;

export const CONDITION_LABELS: Record<Condition, string> = {
  loose: 'Loose',
  cib: 'CIB',
  new: 'New'
};

export const GRADES = ['mint', 'near_mint', 'good', 'fair', 'poor'] as const;
export type Grade = (typeof GRADES)[number];

export function isCondition(v: string): v is Condition {
  return (CONDITIONS as readonly string[]).includes(v);
}
```

- [ ] **Step 4: Create `src/lib/money.ts`**

```ts
/** Format integer cents as a USD string. null → em dash. */
export function formatCents(cents: number | null): string {
  if (cents === null) return '—';
  return '$' + (cents / 100).toFixed(2);
}

/** Parse a user-typed dollar amount to integer cents. Invalid/negative → null. */
export function parseDollars(input: string): number | null {
  // Reject negatives BEFORE stripping non-numeric chars — the strip would
  // otherwise turn '-5' into '5'. (Discovery D1.)
  if (input.trim().startsWith('-')) return null;
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}
```

- [ ] **Step 5: Run tests — verify green**

Run: `npm run test -- money`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shared condition types and integer-cents money utils"
```

### Task 1.6: Environment configuration

**Files:**
- Create: `.env.example`, `src/lib/config.ts`
- Test: `src/lib/config.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { credentialStatus } from './config';

describe('credentialStatus', () => {
  it('reports which credentials are present without revealing them', () => {
    const status = credentialStatus({
      THEGAMESDB_API_KEY: 'abc',
      EBAY_APP_ID: '',
      EBAY_CLIENT_SECRET: undefined
    });
    expect(status).toEqual({ thegamesdb: true, ebay: false });
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- config`
Expected: FAIL — `./config` not found.

- [ ] **Step 3: Create `.env.example`**

```
# TheGamesDB public API key — https://thegamesdb.net/
THEGAMESDB_API_KEY=
# eBay developer app credentials — https://developer.ebay.com/
EBAY_APP_ID=
EBAY_CLIENT_SECRET=
# Optional: override the SQLite file location
DB_PATH=data/collection.db
```

- [ ] **Step 4: Create `src/lib/config.ts`**

```ts
type RawEnv = Record<string, string | undefined>;

export interface CredentialStatus {
  thegamesdb: boolean;
  ebay: boolean;
}

/** Reports presence of credentials. Never returns the secret values. */
export function credentialStatus(env: RawEnv): CredentialStatus {
  const has = (k: string) => Boolean(env[k] && env[k]!.trim() !== '');
  return {
    thegamesdb: has('THEGAMESDB_API_KEY'),
    ebay: has('EBAY_APP_ID') && has('EBAY_CLIENT_SECRET')
  };
}
```

- [ ] **Step 5: Run tests — verify green**

Run: `npm run test -- config`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add env credential config and .env.example"
```

**After completing Phase 1:** run 3+ review rounds. Confirm `npm run test`, `npm run check`, and `npm run build` all pass.

---

## Phase 2 — Database query layer

**Execution Status:** ✅ SHIPPED at `6df8526`..`eff9e7e` on 2026-05-20 (branch `feat/collection-value-tracker`)

Goal: every database read/write the app needs, as pure functions taking a `DB` argument. All tested against `makeTestDb()`. No file touches SQLite outside `src/lib/db/`.

Architectural context: query functions take `db: DB` as their first argument so tests inject an in-memory db and production passes the real `db` from `client.ts`. Do NOT import the singleton `db` inside these query files.

### Task 2.1: Games (catalog) queries

**Files:**
- Create: `src/lib/db/queries/games.ts`
- Test: `src/lib/db/queries/games.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/db/queries/games.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../test-db';
import { games } from '../schema';
import { upsertGames, listGamesByConsole, searchGames, consoleCounts, getGame } from './games';

const SAMPLE = [
  { id: 1, console: 'SNES', title: 'Chrono Trigger', region: 'NTSC', releaseYear: 1995 },
  { id: 2, console: 'SNES', title: 'Super Metroid', region: 'NTSC', releaseYear: 1994 },
  { id: 3, console: 'N64', title: 'GoldenEye 007', region: 'NTSC', releaseYear: 1997 }
];

describe('games queries', () => {
  it('upserts games and updates existing rows by id', () => {
    const db = makeTestDb();
    upsertGames(db, SAMPLE);
    expect(getGame(db, 1)?.title).toBe('Chrono Trigger');
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'Chrono Trigger (renamed)', region: 'NTSC', releaseYear: 1995 }]);
    expect(getGame(db, 1)?.title).toBe('Chrono Trigger (renamed)');
    expect(db.select().from(games).all()).toHaveLength(3);
  });

  it('lists games for one console alphabetically', () => {
    const db = makeTestDb();
    upsertGames(db, SAMPLE);
    const snes = listGamesByConsole(db, 'SNES');
    expect(snes.map((g) => g.title)).toEqual(['Chrono Trigger', 'Super Metroid']);
  });

  it('searches titles within a console, case-insensitively', () => {
    const db = makeTestDb();
    upsertGames(db, SAMPLE);
    expect(searchGames(db, 'SNES', 'metroid').map((g) => g.id)).toEqual([2]);
    expect(searchGames(db, 'SNES', 'goldeneye')).toHaveLength(0);
  });

  it('counts games per console', () => {
    const db = makeTestDb();
    upsertGames(db, SAMPLE);
    expect(consoleCounts(db)).toEqual([
      { console: 'N64', count: 1 },
      { console: 'SNES', count: 2 }
    ]);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- queries/games`
Expected: FAIL — `./games` not found.

- [ ] **Step 3: Implement `src/lib/db/queries/games.ts`**

```ts
import { and, asc, eq, like, sql } from 'drizzle-orm';
import type { DB } from '../client';
import { games } from '../schema';

export interface CatalogGame {
  id: number;
  console: string;
  title: string;
  region: string | null;
  releaseYear: number | null;
}

/** Insert or update catalog games, keyed on TheGamesDB id. */
export function upsertGames(db: DB, rows: CatalogGame[]): void {
  if (rows.length === 0) return;
  const now = new Date();
  db.transaction((tx) => {
    for (const r of rows) {
      tx.insert(games)
        .values({ ...r, lastSyncedAt: now })
        .onConflictDoUpdate({
          target: games.id,
          set: { console: r.console, title: r.title, region: r.region, releaseYear: r.releaseYear, lastSyncedAt: now }
        })
        .run();
    }
  });
}

export function getGame(db: DB, id: number) {
  return db.select().from(games).where(eq(games.id, id)).get();
}

export function listGamesByConsole(db: DB, console: string) {
  return db.select().from(games).where(eq(games.console, console)).orderBy(asc(games.title)).all();
}

export function searchGames(db: DB, console: string, query: string) {
  return db
    .select()
    .from(games)
    .where(and(eq(games.console, console), like(games.title, `%${query}%`)))
    .orderBy(asc(games.title))
    .all();
}

export function consoleCounts(db: DB): { console: string; count: number }[] {
  return db
    .select({ console: games.console, count: sql<number>`count(*)` })
    .from(games)
    .groupBy(games.console)
    .orderBy(asc(games.console))
    .all();
}
```

NOTE: SQLite `LIKE` is case-insensitive for ASCII by default — the search test relies on this.

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- queries/games`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add catalog game queries (upsert, list, search, counts)"
```

### Task 2.2: Collection item queries

**Files:**
- Create: `src/lib/db/queries/collection.ts`
- Test: `src/lib/db/queries/collection.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/db/queries/collection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../test-db';
import { upsertGames } from './games';
import { addItem, removeItem, listCollection, updateItem, ownedConditions, ownedConditionsByGame } from './collection';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [
    { id: 1, console: 'SNES', title: 'Chrono Trigger', region: 'NTSC', releaseYear: 1995 },
    { id: 2, console: 'N64', title: 'GoldenEye 007', region: 'NTSC', releaseYear: 1997 }
  ]);
  return db;
}

describe('collection queries', () => {
  it('adds an item and returns its id', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    expect(typeof id).toBe('number');
    expect(listCollection(db)).toHaveLength(1);
  });

  it('supports multiple copies of the same game+condition', () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 1, condition: 'loose' });
    expect(listCollection(db)).toHaveLength(2);
  });

  it('removes an item by id', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'cib' });
    removeItem(db, id);
    expect(listCollection(db)).toHaveLength(0);
  });

  it('updates grade, notes, acquiredAt and manualPrice', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    updateItem(db, id, { grade: 'mint', notes: 'yellowed', manualPrice: 5000 });
    const item = listCollection(db).find((r) => r.id === id)!;
    expect(item.grade).toBe('mint');
    expect(item.manualPrice).toBe(5000);
  });

  it('reports owned conditions for one game', () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 1, condition: 'new' });
    expect(ownedConditions(db, 1).sort()).toEqual(['loose', 'new']);
  });

  it('groups owned conditions by game id in a single batch query', () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 1, condition: 'new' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const map = ownedConditionsByGame(db);
    expect([...(map.get(1) ?? [])].sort()).toEqual(['loose', 'new']);
    expect(map.get(2)).toEqual(['cib']);
    expect(map.get(99)).toBeUndefined();
  });

  it('listCollection joins game title and console', () => {
    const db = seed();
    addItem(db, { gameId: 2, condition: 'loose' });
    expect(listCollection(db)[0].title).toBe('GoldenEye 007');
    expect(listCollection(db)[0].console).toBe('N64');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- queries/collection`
Expected: FAIL — `./collection` not found.

- [ ] **Step 3: Implement `src/lib/db/queries/collection.ts`**

```ts
import { asc, eq } from 'drizzle-orm';
import type { DB } from '../client';
import { collectionItems, games } from '../schema';
import type { Condition } from '$lib/types';

export interface AddItemInput {
  gameId: number;
  condition: Condition;
}

export interface ItemPatch {
  condition?: Condition;
  grade?: string | null;
  notes?: string | null;
  acquiredAt?: string | null;
  manualPrice?: number | null;
}

export interface CollectionRow {
  id: number;
  gameId: number;
  title: string;
  console: string;
  condition: string;
  grade: string | null;
  notes: string | null;
  acquiredAt: string | null;
  manualPrice: number | null;
  createdAt: Date;
}

/** Add one physical item. Returns the new row id. */
export function addItem(db: DB, input: AddItemInput): number {
  const res = db
    .insert(collectionItems)
    .values({ gameId: input.gameId, condition: input.condition, createdAt: new Date() })
    .returning({ id: collectionItems.id })
    .get();
  return res.id;
}

export function removeItem(db: DB, id: number): void {
  db.delete(collectionItems).where(eq(collectionItems.id, id)).run();
}

export function updateItem(db: DB, id: number, patch: ItemPatch): void {
  db.update(collectionItems).set(patch).where(eq(collectionItems.id, id)).run();
}

export function listCollection(db: DB): CollectionRow[] {
  return db
    .select({
      id: collectionItems.id,
      gameId: collectionItems.gameId,
      title: games.title,
      console: games.console,
      condition: collectionItems.condition,
      grade: collectionItems.grade,
      notes: collectionItems.notes,
      acquiredAt: collectionItems.acquiredAt,
      manualPrice: collectionItems.manualPrice,
      createdAt: collectionItems.createdAt
    })
    .from(collectionItems)
    .innerJoin(games, eq(collectionItems.gameId, games.id))
    .orderBy(asc(games.title))
    .all();
}

export function ownedConditions(db: DB, gameId: number): string[] {
  const rows = db
    .selectDistinct({ condition: collectionItems.condition })
    .from(collectionItems)
    .where(eq(collectionItems.gameId, gameId))
    .all();
  return rows.map((r) => r.condition);
}

/** All owned conditions grouped by game id — ONE query. Use this for the
 *  Browse screen; calling `ownedConditions` per catalog game is an N+1. */
export function ownedConditionsByGame(db: DB): Map<number, string[]> {
  const rows = db
    .selectDistinct({ gameId: collectionItems.gameId, condition: collectionItems.condition })
    .from(collectionItems)
    .all();
  const map = new Map<number, string[]>();
  for (const r of rows) {
    const list = map.get(r.gameId) ?? [];
    list.push(r.condition);
    map.set(r.gameId, list);
  }
  return map;
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- queries/collection`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add collection item queries (add, remove, update, list)"
```

### Task 2.3: Price estimate queries + item value resolution

**Files:**
- Create: `src/lib/db/queries/prices.ts`
- Test: `src/lib/db/queries/prices.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/db/queries/prices.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../test-db';
import { upsertGames } from './games';
import { upsertEstimate, getEstimate, estimateMap, resolveItemValue } from './prices';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
  return db;
}

describe('price estimate queries', () => {
  it('upserts an estimate and replaces it on the same (game, condition)', () => {
    const db = seed();
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 5000, listingCount: 8 });
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(5000);
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 5500, listingCount: 6 });
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(5500);
  });

  it('stores a null estimate when no listings were found', () => {
    const db = seed();
    upsertEstimate(db, { gameId: 1, condition: 'new', estimate: null, listingCount: 0 });
    expect(getEstimate(db, 1, 'new')?.estimate).toBeNull();
  });
});

describe('resolveItemValue', () => {
  it('prefers a manual price over any estimate', () => {
    expect(resolveItemValue({ manualPrice: 9999 }, 5000)).toBe(9999);
  });
  it('falls back to the estimate when no manual price', () => {
    expect(resolveItemValue({ manualPrice: null }, 5000)).toBe(5000);
  });
  it('returns null when neither is known', () => {
    expect(resolveItemValue({ manualPrice: null }, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- queries/prices`
Expected: FAIL — `./prices` not found.

- [ ] **Step 3: Implement `src/lib/db/queries/prices.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import type { DB } from '../client';
import { priceEstimates } from '../schema';
import type { Condition } from '$lib/types';

export interface UpsertEstimateInput {
  gameId: number;
  condition: Condition;
  estimate: number | null;
  listingCount: number;
}

export function upsertEstimate(db: DB, input: UpsertEstimateInput): void {
  db.insert(priceEstimates)
    .values({
      gameId: input.gameId,
      condition: input.condition,
      estimate: input.estimate,
      listingCount: input.listingCount,
      source: 'ebay',
      computedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [priceEstimates.gameId, priceEstimates.condition],
      set: { estimate: input.estimate, listingCount: input.listingCount, computedAt: new Date() }
    })
    .run();
}

export function getEstimate(db: DB, gameId: number, condition: string) {
  return db
    .select()
    .from(priceEstimates)
    .where(and(eq(priceEstimates.gameId, gameId), eq(priceEstimates.condition, condition)))
    .get();
}

/** All estimates keyed by `${gameId}:${condition}` — for batch UI rendering. */
export function estimateMap(db: DB): Map<string, number | null> {
  const rows = db.select().from(priceEstimates).all();
  return new Map(rows.map((r) => [`${r.gameId}:${r.condition}`, r.estimate]));
}

/** Value of one item: manual price wins, else the estimate, else null. */
export function resolveItemValue(item: { manualPrice: number | null }, estimate: number | null): number | null {
  if (item.manualPrice !== null && item.manualPrice !== undefined) return item.manualPrice;
  return estimate;
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- queries/prices`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add price estimate queries and item value resolution"
```

### Task 2.4: Snapshot, refresh-event, and top-mover queries

**Files:**
- Create: `src/lib/db/queries/refresh.ts`
- Test: `src/lib/db/queries/refresh.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/db/queries/refresh.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../test-db';
import { upsertGames } from './games';
import { createRefreshEvent, insertSnapshot, latestRefreshEvent, topMovers } from './refresh';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [
    { id: 1, console: 'SNES', title: 'Chrono Trigger', region: null, releaseYear: null },
    { id: 2, console: 'N64', title: 'GoldenEye', region: null, releaseYear: null }
  ]);
  return db;
}

describe('refresh queries', () => {
  it('creates a refresh event and returns its id', () => {
    const db = seed();
    const id = createRefreshEvent(db, { source: 'ebay_browse:test', itemsUpdated: 2, errors: 0 });
    expect(latestRefreshEvent(db)?.id).toBe(id);
  });

  it('computes top movers by dollar change across the two latest snapshots', () => {
    const db = seed();
    const e1 = createRefreshEvent(db, { source: 'r1', itemsUpdated: 2, errors: 0 });
    insertSnapshot(db, { gameId: 1, condition: 'loose', estimate: 5000, listingCount: 4, refreshEventId: e1 });
    insertSnapshot(db, { gameId: 2, condition: 'cib', estimate: 8000, listingCount: 3, refreshEventId: e1 });
    const e2 = createRefreshEvent(db, { source: 'r2', itemsUpdated: 2, errors: 0 });
    insertSnapshot(db, { gameId: 1, condition: 'loose', estimate: 6200, listingCount: 5, refreshEventId: e2 });
    insertSnapshot(db, { gameId: 2, condition: 'cib', estimate: 7900, listingCount: 3, refreshEventId: e2 });

    const movers = topMovers(db, 10);
    expect(movers[0]).toMatchObject({ gameId: 1, condition: 'loose', delta: 1200 });
    expect(movers[1]).toMatchObject({ gameId: 2, condition: 'cib', delta: -100 });
  });

  it('returns no movers when there is only one refresh', () => {
    const db = seed();
    const e1 = createRefreshEvent(db, { source: 'r1', itemsUpdated: 1, errors: 0 });
    insertSnapshot(db, { gameId: 1, condition: 'loose', estimate: 5000, listingCount: 4, refreshEventId: e1 });
    expect(topMovers(db, 10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- queries/refresh`
Expected: FAIL — `./refresh` not found.

- [ ] **Step 3: Implement `src/lib/db/queries/refresh.ts`**

```ts
import { desc, eq } from 'drizzle-orm';
import type { DB } from '../client';
import { priceSnapshots, refreshEvents, games } from '../schema';

export interface NewRefreshEvent {
  source: string;
  itemsUpdated: number;
  errors: number;
}

export function createRefreshEvent(db: DB, e: NewRefreshEvent): number {
  return db
    .insert(refreshEvents)
    .values({ ...e, triggeredAt: new Date() })
    .returning({ id: refreshEvents.id })
    .get().id;
}

export function latestRefreshEvent(db: DB) {
  return db.select().from(refreshEvents).orderBy(desc(refreshEvents.id)).limit(1).get();
}

export function listRefreshEvents(db: DB, limit = 20) {
  return db.select().from(refreshEvents).orderBy(desc(refreshEvents.id)).limit(limit).all();
}

export interface NewSnapshot {
  gameId: number;
  condition: string;
  estimate: number;
  listingCount: number;
  refreshEventId: number;
}

export function insertSnapshot(db: DB, s: NewSnapshot): void {
  db.insert(priceSnapshots).values({ ...s, snapshotAt: new Date() }).run();
}

export interface Mover {
  gameId: number;
  title: string;
  condition: string;
  previous: number;
  current: number;
  delta: number;
}

/**
 * Dollar change for each (game, condition) between the two most recent
 * refresh events. Empty when fewer than two refreshes exist.
 */
export function topMovers(db: DB, limit: number): Mover[] {
  const events = db.select().from(refreshEvents).orderBy(desc(refreshEvents.id)).limit(2).all();
  if (events.length < 2) return [];
  const [current, previous] = events;

  const snapsFor = (eventId: number) =>
    db.select().from(priceSnapshots).where(eq(priceSnapshots.refreshEventId, eventId)).all();
  const prevMap = new Map(snapsFor(previous.id).map((s) => [`${s.gameId}:${s.condition}`, s.estimate]));
  const titles = new Map(db.select().from(games).all().map((g) => [g.id, g.title]));

  const movers: Mover[] = [];
  for (const s of snapsFor(current.id)) {
    const prev = prevMap.get(`${s.gameId}:${s.condition}`);
    if (prev === undefined) continue;
    movers.push({
      gameId: s.gameId,
      title: titles.get(s.gameId) ?? `#${s.gameId}`,
      condition: s.condition,
      previous: prev,
      current: s.estimate,
      delta: s.estimate - prev
    });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return movers.slice(0, limit);
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- queries/refresh`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add snapshot, refresh-event, and top-mover queries"
```

**After completing Phase 2:** run 3+ review rounds. Confirm every query takes `db: DB` as a parameter and no query file imports the `client.ts` singleton. Run `npm run test` and `npm run check`.

---

## Phase 3 — TheGamesDB catalog sync

**Execution Status:** ✅ SHIPPED at `e4dae1c`..`700c474` on 2026-05-20 (branch `feat/collection-value-tracker`)

Goal: pull the game list per platform from TheGamesDB and UPSERT into `games`.

Architectural context: the network client is split from the sync logic. `fetchPlatformGames` is a thin typed wrapper over `fetch`. `syncCatalog` takes a fetcher function as a parameter so tests inject a fake — never a live call (pitfall CVT-T1). Verify TheGamesDB's real endpoint shape against Open Verification Item #1 in the spec before relying on field names; if the shape differs, the mapping in `mapApiGame` is the single place to change.

### Task 3.1: Platform config and name normalization

**Files:**
- Create: `src/lib/sources/platforms.ts`
- Test: `src/lib/sources/platforms.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/sources/platforms.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PLATFORMS, normalizeConsoleName } from './platforms';

describe('platforms', () => {
  it('has a non-empty platform list with id and display name', () => {
    expect(PLATFORMS.length).toBeGreaterThan(0);
    for (const p of PLATFORMS) {
      expect(typeof p.thegamesdbId).toBe('number');
      expect(p.name.length).toBeGreaterThan(0);
    }
  });
  it('normalizes a known TheGamesDB platform name to the display name', () => {
    expect(normalizeConsoleName('Super Nintendo (SNES)')).toBe('SNES');
    expect(normalizeConsoleName('Unknown Platform')).toBe('Unknown Platform');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- sources/platforms`
Expected: FAIL — `./platforms` not found.

- [ ] **Step 3: Implement `src/lib/sources/platforms.ts`**

```ts
/** Platforms synced from TheGamesDB. thegamesdbId values are confirmed
 *  during Verification Item #1; adjust here if the API differs. */
export interface Platform {
  thegamesdbId: number;
  name: string; // display name used as games.console
}

export const PLATFORMS: Platform[] = [
  { thegamesdbId: 6, name: 'SNES' },
  { thegamesdbId: 7, name: 'NES' },
  { thegamesdbId: 3, name: 'N64' },
  { thegamesdbId: 4, name: 'Game Boy' },
  { thegamesdbId: 5, name: 'Game Boy Advance' },
  { thegamesdbId: 10, name: 'Sega Genesis' },
  { thegamesdbId: 11, name: 'PlayStation' },
  { thegamesdbId: 12, name: 'PlayStation 2' }
];

const BY_RAW_NAME: Record<string, string> = {
  'Super Nintendo (SNES)': 'SNES',
  'Nintendo Entertainment System (NES)': 'NES',
  'Nintendo 64': 'N64'
};

/** Map a raw TheGamesDB platform name to the display name. Unknown → unchanged. */
export function normalizeConsoleName(raw: string): string {
  return BY_RAW_NAME[raw] ?? raw;
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- sources/platforms`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add TheGamesDB platform config and name normalization"
```

### Task 3.2: TheGamesDB client

**Files:**
- Create: `src/lib/sources/thegamesdb.ts`
- Test: `src/lib/sources/thegamesdb.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/sources/thegamesdb.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { mapApiGame, fetchPlatformGames } from './thegamesdb';

describe('mapApiGame', () => {
  it('maps a TheGamesDB game record to a CatalogGame', () => {
    const mapped = mapApiGame(
      { id: 42, game_title: 'Chrono Trigger', release_date: '1995-03-11', region_id: 1 },
      'SNES'
    );
    expect(mapped).toEqual({ id: 42, console: 'SNES', title: 'Chrono Trigger', region: 'NTSC', releaseYear: 1995 });
  });
  it('tolerates missing release date and region', () => {
    const mapped = mapApiGame({ id: 7, game_title: 'X' }, 'NES');
    expect(mapped).toEqual({ id: 7, console: 'NES', title: 'X', region: null, releaseYear: null });
  });
});

describe('fetchPlatformGames', () => {
  it('fetches a page, maps the games, and reports the next page', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      data: { games: [{ id: 1, game_title: 'X', release_date: '1990-06-01', region_id: 3 }] },
      pages: { next: 'https://api.thegamesdb.net/...&page=2' }
    }), { status: 200 }));
    const page = await fetchPlatformGames('KEY', 6, 'SNES', 1, fetchFn);
    expect(page.games).toEqual([{ id: 1, console: 'SNES', title: 'X', region: 'PAL', releaseYear: 1990 }]);
    expect(page.nextPage).toBe(2);
  });

  it('reports no next page when pages.next is absent', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ data: { games: [] } }), { status: 200 }));
    const page = await fetchPlatformGames('KEY', 6, 'SNES', 1, fetchFn);
    expect(page.games).toEqual([]);
    expect(page.nextPage).toBeNull();
  });

  it('throws a clear error on a non-OK response', async () => {
    const fetchFn = vi.fn(async () => new Response('err', { status: 503 }));
    await expect(fetchPlatformGames('KEY', 6, 'SNES', 1, fetchFn)).rejects.toThrow(/TheGamesDB/);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- sources/thegamesdb`
Expected: FAIL — `./thegamesdb` not found.

- [ ] **Step 3: Implement `src/lib/sources/thegamesdb.ts`**

```ts
import type { CatalogGame } from '$lib/db/queries/games';

const BASE = 'https://api.thegamesdb.net';

interface ApiGame {
  id: number;
  game_title: string;
  release_date?: string;
  region_id?: number;
}

const REGION_BY_ID: Record<number, string> = { 1: 'NTSC', 2: 'NTSC-J', 3: 'PAL' };

/** Map one raw TheGamesDB game record to a CatalogGame. */
export function mapApiGame(g: ApiGame, consoleName: string): CatalogGame {
  const year = g.release_date ? Number(g.release_date.slice(0, 4)) : NaN;
  return {
    id: g.id,
    console: consoleName,
    title: g.game_title,
    region: g.region_id ? (REGION_BY_ID[g.region_id] ?? null) : null,
    releaseYear: Number.isFinite(year) ? year : null
  };
}

export interface PlatformPage {
  games: CatalogGame[];
  nextPage: number | null;
}

/** Fetch one page of games for a platform. Pure over `fetch` — injectable in tests. */
export async function fetchPlatformGames(
  apiKey: string,
  platformId: number,
  consoleName: string,
  page: number,
  fetchFn: typeof fetch = fetch
): Promise<PlatformPage> {
  const url = `${BASE}/v1.1/Games/ByPlatformID?apikey=${apiKey}&id=${platformId}&page=${page}`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`TheGamesDB ${res.status} for platform ${platformId} page ${page}`);
  const body = (await res.json()) as {
    data?: { games?: ApiGame[] };
    pages?: { next?: string | null };
  };
  const raw = body.data?.games ?? [];
  return {
    games: raw.map((g) => mapApiGame(g, consoleName)),
    nextPage: body.pages?.next ? page + 1 : null
  };
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- sources/thegamesdb`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add TheGamesDB API client with injectable fetch"
```

### Task 3.3: Catalog sync

**Files:**
- Create: `src/lib/sources/sync.ts`
- Test: `src/lib/sources/sync.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/sources/sync.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { listGamesByConsole } from '$lib/db/queries/games';
import { syncCatalog } from './sync';

describe('syncCatalog', () => {
  it('upserts fetched games and reports progress', async () => {
    const db = makeTestDb();
    const fakeFetch = vi.fn(async (platformId: number, _name: string, page: number) => ({
      games: [{ id: platformId * 100 + page, console: 'SNES', title: `G${page}`, region: null, releaseYear: null }],
      nextPage: page < 2 ? page + 1 : null
    }));
    const progress: number[] = [];
    const result = await syncCatalog(db, {
      platforms: [{ thegamesdbId: 6, name: 'SNES' }],
      fetchPage: fakeFetch,
      onProgress: (done) => progress.push(done)
    });
    expect(result.gamesLoaded).toBe(2);
    expect(listGamesByConsole(db, 'SNES')).toHaveLength(2);
    expect(progress.at(-1)).toBe(1); // 1 of 1 platforms done
  });

  it('records an error and continues when one platform fails', async () => {
    const db = makeTestDb();
    const fakeFetch = vi.fn(async (platformId: number) => {
      if (platformId === 6) throw new Error('boom');
      return { games: [{ id: 1, console: 'NES', title: 'X', region: null, releaseYear: null }], nextPage: null };
    });
    const result = await syncCatalog(db, {
      platforms: [
        { thegamesdbId: 6, name: 'SNES' },
        { thegamesdbId: 7, name: 'NES' }
      ],
      fetchPage: fakeFetch,
      onProgress: () => {}
    });
    expect(result.errors).toBe(1);
    expect(result.gamesLoaded).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- sources/sync`
Expected: FAIL — `./sync` not found.

- [ ] **Step 3: Implement `src/lib/sources/sync.ts`**

```ts
import type { DB } from '$lib/db/client';
import { upsertGames } from '$lib/db/queries/games';
import type { Platform } from './platforms';
import type { PlatformPage } from './thegamesdb';

export type FetchPage = (platformId: number, consoleName: string, page: number) => Promise<PlatformPage>;

export interface SyncOptions {
  platforms: Platform[];
  fetchPage: FetchPage;
  onProgress: (platformsDone: number, total: number) => void;
}

export interface SyncResult {
  gamesLoaded: number;
  platformsCovered: number;
  errors: number;
}

/** Pull each platform's games and upsert them. One failed platform does not abort the sync. */
export async function syncCatalog(db: DB, opts: SyncOptions): Promise<SyncResult> {
  let gamesLoaded = 0;
  let platformsCovered = 0;
  let errors = 0;
  const total = opts.platforms.length;

  for (let i = 0; i < total; i++) {
    const platform = opts.platforms[i];
    try {
      let page: number | null = 1;
      while (page !== null) {
        const result = await opts.fetchPage(platform.thegamesdbId, platform.name, page);
        upsertGames(db, result.games);
        gamesLoaded += result.games.length;
        page = result.nextPage;
      }
      platformsCovered++;
    } catch {
      errors++;
    }
    opts.onProgress(i + 1, total);
  }
  return { gamesLoaded, platformsCovered, errors };
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- sources/sync`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add TheGamesDB catalog sync with progress and error tolerance"
```

**After completing Phase 3:** run 3+ review rounds. Confirm no test performs a real network call.

---

## Phase 4 — eBay price estimation

**Execution Status:** ✅ SHIPPED at `bf2bbae`..`4cdf241` on 2026-05-20 (branch `feat/collection-value-tracker`)

Goal: an OAuth-authenticated eBay Browse client, a condition-aware query builder, a robust median estimator, and a refresh routine that re-estimates owned games and writes snapshots.

Architectural context: like Phase 3, the network client is split from logic and `fetch` is injectable. The refresh routine in Task 4.5 coordinates async work — its tests MUST synchronize deterministically.

**BEFORE marking Task 4.5 complete:** If any test assertion races, flakes, or fails nondeterministically, the fix is deterministic synchronization (awaited promises, resolved fetch mocks) — NOT assertion removal or weakening. If synchronization cannot make the assertion pass reliably, STOP and raise to the dispatching agent. Do not ship a weaker test. Prefer mechanism assertions ("snapshot row written") over symptom assertions ("no error thrown"). The commit subject for any change touching test assertions must state what happened to them.

### Task 4.1: eBay OAuth token

**Files:**
- Create: `src/lib/sources/ebay/auth.ts`
- Test: `src/lib/sources/ebay/auth.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/sources/ebay/auth.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createTokenProvider } from './auth';

function fakeFetch(token: string, expiresIn = 7200) {
  return vi.fn(async () => new Response(
    JSON.stringify({ access_token: token, expires_in: expiresIn, token_type: 'Application Access Token' }),
    { status: 200 }
  ));
}

describe('createTokenProvider', () => {
  it('fetches a token and caches it across calls', async () => {
    const f = fakeFetch('TOKEN-1');
    const provider = createTokenProvider({ appId: 'id', clientSecret: 'sec', fetchFn: f, now: () => 0 });
    expect(await provider.getToken()).toBe('TOKEN-1');
    expect(await provider.getToken()).toBe('TOKEN-1');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('refetches once the cached token is within 60s of expiry', async () => {
    const f = fakeFetch('TOKEN-1', 7200);
    let clock = 0;
    const provider = createTokenProvider({ appId: 'id', clientSecret: 'sec', fetchFn: f, now: () => clock });
    await provider.getToken();
    clock = 7200_000; // ms — past expiry
    f.mockResolvedValueOnce(new Response(
      JSON.stringify({ access_token: 'TOKEN-2', expires_in: 7200, token_type: 'x' }), { status: 200 }
    ));
    expect(await provider.getToken()).toBe('TOKEN-2');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('throws a clear error on auth failure', async () => {
    const f = vi.fn(async () => new Response('bad', { status: 401 }));
    const provider = createTokenProvider({ appId: 'id', clientSecret: 'sec', fetchFn: f, now: () => 0 });
    await expect(provider.getToken()).rejects.toThrow(/eBay auth/);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- ebay/auth`
Expected: FAIL — `./auth` not found.

- [ ] **Step 3: Implement `src/lib/sources/ebay/auth.ts`**

```ts
const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SCOPE = 'https://api.ebay.com/oauth/api_scope';

export interface TokenProviderOptions {
  appId: string;
  clientSecret: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}

export interface TokenProvider {
  getToken(): Promise<string>;
}

/** Client-credentials OAuth provider. Caches the token until ~60s before expiry. */
export function createTokenProvider(opts: TokenProviderOptions): TokenProvider {
  const fetchFn = opts.fetchFn ?? fetch;
  const now = opts.now ?? Date.now;
  let cached: { token: string; expiresAt: number } | null = null;

  return {
    async getToken() {
      if (cached && now() < cached.expiresAt - 60_000) return cached.token;

      const basic = Buffer.from(`${opts.appId}:${opts.clientSecret}`).toString('base64');
      const res = await fetchFn(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`
        },
        body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`
      });
      if (!res.ok) throw new Error(`eBay auth failed: ${res.status}`);
      const body = (await res.json()) as { access_token: string; expires_in: number };
      cached = { token: body.access_token, expiresAt: now() + body.expires_in * 1000 };
      return cached.token;
    }
  };
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- ebay/auth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add cached eBay OAuth client-credentials token provider"
```

### Task 4.2: eBay Browse search client

**Files:**
- Create: `src/lib/sources/ebay/client.ts`
- Test: `src/lib/sources/ebay/client.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/sources/ebay/client.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { searchListings } from './client';

const SAMPLE = {
  itemSummaries: [
    { title: 'Chrono Trigger SNES loose', price: { value: '172.44', currency: 'USD' }, conditionId: '3000' },
    { title: 'Chrono Trigger cart only', price: { value: '160.00', currency: 'USD' }, conditionId: '3000' },
    { title: 'Chrono Trigger EUR', price: { value: '90.00', currency: 'EUR' }, conditionId: '3000' }
  ]
};

describe('searchListings', () => {
  it('returns USD listing prices as integer cents', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 }));
    const listings = await searchListings('TOKEN', 'chrono trigger snes', { fetchFn: f });
    expect(listings).toEqual([17244, 16000]); // EUR listing dropped
  });

  it('sends the auth token and US marketplace header', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ itemSummaries: [] }), { status: 200 }));
    await searchListings('TOKEN', 'q', { fetchFn: f });
    const [, init] = f.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer TOKEN');
    expect(init.headers['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_US');
  });

  it('returns an empty array when eBay reports no results', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    expect(await searchListings('TOKEN', 'q', { fetchFn: f })).toEqual([]);
  });

  it('throws on a non-200 response', async () => {
    const f = vi.fn(async () => new Response('err', { status: 500 }));
    await expect(searchListings('TOKEN', 'q', { fetchFn: f })).rejects.toThrow(/eBay search/);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- ebay/client`
Expected: FAIL — `./client` not found.

- [ ] **Step 3: Implement `src/lib/sources/ebay/client.ts`**

```ts
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const VIDEO_GAME_CATEGORY = '139973';

export interface SearchOptions {
  limit?: number;
  fetchFn?: typeof fetch;
}

interface ItemSummary {
  price?: { value?: string; currency?: string };
}

/** Search eBay active Buy-It-Now listings. Returns USD prices as integer cents. */
export async function searchListings(token: string, query: string, opts: SearchOptions = {}): Promise<number[]> {
  const fetchFn = opts.fetchFn ?? fetch;
  const params = new URLSearchParams({
    q: query,
    category_ids: VIDEO_GAME_CATEGORY,
    filter: 'buyingOptions:{FIXED_PRICE}',
    limit: String(opts.limit ?? 50)
  });
  const res = await fetchFn(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }
  });
  if (!res.ok) throw new Error(`eBay search failed: ${res.status}`);
  const body = (await res.json()) as { itemSummaries?: ItemSummary[] };
  const summaries = body.itemSummaries ?? [];

  const cents: number[] = [];
  for (const s of summaries) {
    if (s.price?.currency !== 'USD') continue;
    const value = Number(s.price.value);
    if (Number.isFinite(value) && value >= 0) cents.push(Math.round(value * 100));
  }
  return cents;
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- ebay/client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add eBay Browse search client returning prices as cents"
```

### Task 4.3: Condition-aware query builder

**Files:**
- Create: `src/lib/sources/ebay/query.ts`
- Test: `src/lib/sources/ebay/query.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/sources/ebay/query.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildQuery } from './query';

const GAME = { title: 'Chrono Trigger', console: 'SNES' };

describe('buildQuery', () => {
  it('includes title and console', () => {
    expect(buildQuery(GAME, 'loose')).toContain('Chrono Trigger');
    expect(buildQuery(GAME, 'loose')).toContain('SNES');
  });
  it('adds loose keywords for loose condition', () => {
    expect(buildQuery(GAME, 'loose').toLowerCase()).toContain('loose');
  });
  it('adds sealed/new keywords for new condition', () => {
    const q = buildQuery(GAME, 'new').toLowerCase();
    expect(q.includes('sealed') || q.includes('new')).toBe(true);
  });
  it('adds complete keywords for cib condition', () => {
    expect(buildQuery(GAME, 'cib').toLowerCase()).toContain('complete');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- ebay/query`
Expected: FAIL — `./query` not found.

- [ ] **Step 3: Implement `src/lib/sources/ebay/query.ts`**

```ts
import type { Condition } from '$lib/types';

/** Condition keyword map — the single place to tune estimate accuracy
 *  (spec Open Verification Item #3). */
export const CONDITION_KEYWORDS: Record<Condition, string> = {
  loose: 'loose',
  cib: 'complete in box',
  new: 'sealed'
};

export interface QueryGame {
  title: string;
  console: string;
}

/** Build an eBay search query string for a game in a condition. */
export function buildQuery(game: QueryGame, condition: Condition): string {
  return `${game.title} ${game.console} ${CONDITION_KEYWORDS[condition]}`.trim();
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- ebay/query`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add condition-aware eBay query builder"
```

### Task 4.4: Estimate computation

**Files:**
- Create: `src/lib/sources/ebay/estimate.ts`
- Test: `src/lib/sources/ebay/estimate.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/sources/ebay/estimate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { estimateFromListings } from './estimate';

describe('estimateFromListings', () => {
  it('returns the median of an odd-length list', () => {
    expect(estimateFromListings([1000, 3000, 2000])).toEqual({ estimate: 2000, listingCount: 3 });
  });
  it('averages the two middle values for an even-length list', () => {
    expect(estimateFromListings([1000, 2000, 3000, 4000])).toEqual({ estimate: 2500, listingCount: 4 });
  });
  it('resists outliers (median, not mean)', () => {
    expect(estimateFromListings([1000, 1100, 1200, 99000]).estimate).toBe(1150);
  });
  it('returns a null estimate for an empty list', () => {
    expect(estimateFromListings([])).toEqual({ estimate: null, listingCount: 0 });
  });
  it('keeps the result an integer number of cents', () => {
    const { estimate } = estimateFromListings([1001, 2000]);
    expect(Number.isInteger(estimate)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- ebay/estimate`
Expected: FAIL — `./estimate` not found.

- [ ] **Step 3: Implement `src/lib/sources/ebay/estimate.ts`**

```ts
export interface Estimate {
  estimate: number | null; // integer cents
  listingCount: number;
}

/** Robust price estimate: the median of listing prices (cents). */
export function estimateFromListings(prices: number[]): Estimate {
  if (prices.length === 0) return { estimate: null, listingCount: 0 };
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { estimate: median, listingCount: prices.length };
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- ebay/estimate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add median-based price estimate computation"
```

### Task 4.5: Estimate-one-pair and refresh routine

**Files:**
- Create: `src/lib/sources/refresh.ts`
- Test: `src/lib/sources/refresh.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/sources/refresh.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, updateItem } from '$lib/db/queries/collection';
import { getEstimate } from '$lib/db/queries/prices';
import { estimatePair, refreshEstimates } from './refresh';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [
    { id: 1, console: 'SNES', title: 'Chrono Trigger', region: null, releaseYear: null },
    { id: 2, console: 'N64', title: 'GoldenEye', region: null, releaseYear: null }
  ]);
  return db;
}

describe('estimatePair', () => {
  it('searches eBay and writes a price estimate for one (game, condition)', async () => {
    const db = seed();
    const search = vi.fn(async () => [5000, 6000, 7000]); // deterministic resolved mock
    await estimatePair(db, { gameId: 1, condition: 'loose' }, search);
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(6000);
    expect(search).toHaveBeenCalledOnce();
  });

  it('writes a null estimate when eBay returns nothing', async () => {
    const db = seed();
    await estimatePair(db, { gameId: 1, condition: 'new' }, async () => []);
    expect(getEstimate(db, 1, 'new')?.estimate).toBeNull();
  });
});

describe('refreshEstimates', () => {
  it('re-estimates every owned pair, snapshots them, and records the event', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const search = vi.fn(async () => [4000, 4200]); // → median 4100
    const progress: number[] = [];
    const result = await refreshEstimates(db, { search, onProgress: (d) => progress.push(d) });

    expect(result.itemsUpdated).toBe(2);
    expect(result.errors).toBe(0);
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(4100);
    expect(progress.at(-1)).toBe(2); // deterministic: every pair reported
  });

  it('skips owned pairs whose item has a manual price', async () => {
    const db = seed();
    const itemId = addItem(db, { gameId: 1, condition: 'loose' });
    updateItem(db, itemId, { manualPrice: 9999 });
    const search = vi.fn(async () => [1000]);
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(search).not.toHaveBeenCalled();
    expect(result.itemsUpdated).toBe(0);
  });

  it('counts an error and continues when one search throws', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    let call = 0;
    const search = vi.fn(async () => {
      call++;
      if (call === 1) throw new Error('rate limited');
      return [3000];
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.errors).toBe(1);
    expect(result.itemsUpdated).toBe(1);
  });
});
```

NOTE on synchronization: every `search` mock returns a resolved promise. Tests `await` `refreshEstimates`, which awaits each pair in sequence. There is no timing race and therefore no sleep — assertions run only after all awaited work is complete. Do not introduce `setTimeout`-based fakes.

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- sources/refresh`
Expected: FAIL — `./refresh` not found.

- [ ] **Step 3: Implement `src/lib/sources/refresh.ts`**

```ts
import { asc, eq, isNull } from 'drizzle-orm';
import type { DB } from '$lib/db/client';
import { collectionItems, refreshEvents } from '$lib/db/schema';
import { getGame } from '$lib/db/queries/games';
import { getEstimate, upsertEstimate } from '$lib/db/queries/prices';
import { createRefreshEvent, insertSnapshot } from '$lib/db/queries/refresh';
import { estimateFromListings } from './ebay/estimate';
import { buildQuery } from './ebay/query';
import type { Condition } from '$lib/types';

/** Runs an eBay search for a query, returning listing prices in cents. */
export type SearchFn = (query: string) => Promise<number[]>;

export interface Pair {
  gameId: number;
  condition: string;
}

/** Estimate one (game, condition) pair and persist the estimate. */
export async function estimatePair(db: DB, pair: Pair, search: SearchFn): Promise<void> {
  const game = getGame(db, pair.gameId);
  if (!game) return;
  const prices = await search(buildQuery(game, pair.condition as Condition));
  const { estimate, listingCount } = estimateFromListings(prices);
  upsertEstimate(db, { gameId: pair.gameId, condition: pair.condition as Condition, estimate, listingCount });
}

export interface RefreshOptions {
  search: SearchFn;
  onProgress: (pairsDone: number, total: number) => void;
}

export interface RefreshResult {
  itemsUpdated: number;
  errors: number;
  refreshEventId: number;
}

/**
 * Owned (game, condition) pairs that have at least one item WITHOUT a manual
 * price — those are the pairs an eBay estimate is still useful for. A pair
 * is skipped only when every copy is manually priced. `selectDistinct` over
 * the `manualPrice IS NULL` rows yields exactly that set in one query.
 */
function pairsToRefresh(db: DB): Pair[] {
  return db
    .selectDistinct({ gameId: collectionItems.gameId, condition: collectionItems.condition })
    .from(collectionItems)
    .where(isNull(collectionItems.manualPrice))
    .orderBy(asc(collectionItems.gameId), asc(collectionItems.condition))
    .all();
}

/** Re-estimate every owned pair, snapshot changed estimates, record one refresh event. */
export async function refreshEstimates(db: DB, opts: RefreshOptions): Promise<RefreshResult> {
  const pairs = pairsToRefresh(db);
  const eventId = createRefreshEvent(db, { source: `ebay_browse:${new Date().toISOString()}`, itemsUpdated: 0, errors: 0 });

  let itemsUpdated = 0;
  let errors = 0;

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
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
        // The estimate "changed" when it differs from the prior value
        // (a first-time estimate from null counts as a change).
        if (after.estimate !== before) itemsUpdated++;
      }
    } catch {
      errors++;
    }
    opts.onProgress(i + 1, pairs.length);
  }

  db.update(refreshEvents).set({ itemsUpdated, errors }).where(eq(refreshEvents.id, eventId)).run();
  return { itemsUpdated, errors, refreshEventId: eventId };
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- sources/refresh`
Expected: PASS — all 5 cases.

**BEFORE marking complete:** if any assertion raced, you fixed it with synchronization, not by weakening the assertion. Confirm `progress.at(-1)` equals the pair count deterministically.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add eBay estimate-pair and refresh routine with snapshots"
```

**After completing Phase 4:** run 3+ review rounds. Confirm no real network calls in tests and no `setTimeout`-based test synchronization.

---

## Phase 5 — Server routes

**Execution Status:** ✅ SHIPPED at `5adb5e9`..`e6f7eac` on 2026-05-20 (branch `feat/collection-value-tracker`)

Goal: SvelteKit server endpoints and page `load` functions wiring the query layer and sources to HTTP. These use the real `db` singleton from `client.ts` and credentials from `$env/dynamic/private`.

Architectural context: server files (`+page.server.ts`, `+server.ts`) run only on the server. They import `db` from `client.ts` and read env via SvelteKit's `$env/dynamic/private`. Endpoint handlers are thin — they call query/source functions and shape JSON. The eBay token provider and search function are constructed once in a small `src/lib/server/ebay.ts` helper so routes do not rebuild them.

**Deviation from the spec (deliberate, v1):** the spec describes a streamed
`X / Y` progress bar during sync/refresh with the app usable throughout.
This plan implements the simpler form: sync and refresh are single blocking
`POST` requests; the triggering button shows a spinner and disables until
the response returns, then the page reloads. The `syncCatalog` /
`refreshEstimates` functions already accept an `onProgress` callback, so a
later streamed-progress endpoint (Server-Sent Events) is an additive change
that needs no refactor. v1 ships the blocking form.

### Task 5.1: eBay server helper + add/remove collection endpoints

**Files:**
- Create: `src/lib/server/ebay.ts`, `src/routes/api/collection/+server.ts`
- Test: `src/routes/api/collection/server.test.ts`

- [ ] **Step 1: Write the failing test**

`src/routes/api/collection/server.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { addCollectionItem } from './logic';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { listCollection } from '$lib/db/queries/collection';
import { getEstimate } from '$lib/db/queries/prices';

describe('addCollectionItem', () => {
  it('adds the item then estimates its price', async () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    const search = vi.fn(async () => [1000, 2000, 3000]);
    const res = await addCollectionItem(db, { gameId: 1, condition: 'loose' }, search);
    expect(res.itemId).toBeTypeOf('number');
    expect(listCollection(db)).toHaveLength(1);
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(2000);
  });

  it('rejects an invalid condition', async () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    await expect(
      addCollectionItem(db, { gameId: 1, condition: 'broken' as never }, async () => [])
    ).rejects.toThrow(/condition/i);
  });

  it('still adds the item when no search function is configured', async () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    const res = await addCollectionItem(db, { gameId: 1, condition: 'loose' }, null);
    expect(res.itemId).toBeTypeOf('number');
    expect(listCollection(db)).toHaveLength(1);
    expect(getEstimate(db, 1, 'loose')).toBeUndefined();
  });

  it('still adds the item when the eBay search throws', async () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    const failing = async () => { throw new Error('eBay down'); };
    const res = await addCollectionItem(db, { gameId: 1, condition: 'loose' }, failing);
    expect(res.itemId).toBeTypeOf('number');
    expect(listCollection(db)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- api/collection`
Expected: FAIL — `./logic` not found.

- [ ] **Step 3: Implement `src/lib/server/ebay.ts`**

```ts
import { env } from '$env/dynamic/private';
import { createTokenProvider } from '$lib/sources/ebay/auth';
import { searchListings } from '$lib/sources/ebay/client';
import type { SearchFn } from '$lib/sources/refresh';

let provider: ReturnType<typeof createTokenProvider> | null = null;

/** A SearchFn backed by the real eBay API. Throws if credentials are missing —
 *  use for the refresh endpoint, where eBay is required. */
export function ebaySearch(): SearchFn {
  if (!env.EBAY_APP_ID || !env.EBAY_CLIENT_SECRET) {
    throw new Error('eBay credentials missing — set EBAY_APP_ID and EBAY_CLIENT_SECRET in .env');
  }
  provider ??= createTokenProvider({ appId: env.EBAY_APP_ID, clientSecret: env.EBAY_CLIENT_SECRET });
  return async (query: string) => {
    const token = await provider!.getToken();
    return searchListings(token, query);
  };
}

/** Like `ebaySearch`, but returns `null` instead of throwing when eBay is not
 *  configured — use where pricing is best-effort (e.g. adding a game). */
export function optionalEbaySearch(): SearchFn | null {
  if (!env.EBAY_APP_ID || !env.EBAY_CLIENT_SECRET) return null;
  return ebaySearch();
}
```

- [ ] **Step 4: Implement `src/routes/api/collection/logic.ts`**

```ts
import type { DB } from '$lib/db/client';
import { addItem, removeItem } from '$lib/db/queries/collection';
import { estimatePair } from '$lib/sources/refresh';
import type { SearchFn } from '$lib/sources/refresh';
import { isCondition } from '$lib/types';

export async function addCollectionItem(
  db: DB,
  input: { gameId: number; condition: string },
  search: SearchFn | null
): Promise<{ itemId: number }> {
  if (!isCondition(input.condition)) throw new Error(`Invalid condition: ${input.condition}`);
  // Adding the item is the primary action and MUST succeed on its own.
  const itemId = addItem(db, { gameId: input.gameId, condition: input.condition });
  // The estimate is best-effort: skip it if eBay is unconfigured, and never
  // let an eBay failure fail the add — a later refresh will fill in the price.
  if (search) {
    try {
      await estimatePair(db, { gameId: input.gameId, condition: input.condition }, search);
    } catch {
      /* estimate unavailable — item still added */
    }
  }
  return { itemId };
}

export function removeCollectionItem(db: DB, itemId: number): void {
  removeItem(db, itemId);
}
```

- [ ] **Step 5: Implement `src/routes/api/collection/+server.ts`**

```ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { optionalEbaySearch } from '$lib/server/ebay';
import { addCollectionItem, removeCollectionItem } from './logic';

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as { gameId: number; condition: string };
  try {
    const result = await addCollectionItem(db, body, optionalEbaySearch());
    return json(result);
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'add failed');
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as { itemId: number };
  removeCollectionItem(db, body.itemId);
  return json({ ok: true });
};
```

- [ ] **Step 6: Run tests — verify green**

Run: `npm run test -- api/collection`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add collection add/remove endpoints with on-add estimate"
```

### Task 5.2: Item update endpoint

**Files:**
- Create: `src/routes/api/collection/[id]/+server.ts`, `src/routes/api/collection/[id]/logic.ts`
- Test: `src/routes/api/collection/[id]/server.test.ts`

- [ ] **Step 1: Write the failing test**

`src/routes/api/collection/[id]/server.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, listCollection } from '$lib/db/queries/collection';
import { applyItemUpdate } from './logic';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
  return db;
}

describe('applyItemUpdate', () => {
  it('parses a manual dollar price into integer cents', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    applyItemUpdate(db, id, { manualPriceInput: '49.99', grade: 'good' });
    const item = listCollection(db).find((r) => r.id === id)!;
    expect(item.manualPrice).toBe(4999);
    expect(item.grade).toBe('good');
  });

  it('clears the manual price when the input is blank', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    applyItemUpdate(db, id, { manualPriceInput: '50' });
    applyItemUpdate(db, id, { manualPriceInput: '' });
    expect(listCollection(db).find((r) => r.id === id)!.manualPrice).toBeNull();
  });

  it('rejects an invalid condition', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    expect(() => applyItemUpdate(db, id, { condition: 'bad' })).toThrow(/condition/i);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- "api/collection"`
Expected: FAIL — `./logic` not found.

- [ ] **Step 3: Implement `src/routes/api/collection/[id]/logic.ts`**

```ts
import type { DB } from '$lib/db/client';
import { updateItem } from '$lib/db/queries/collection';
import { parseDollars } from '$lib/money';
import { isCondition } from '$lib/types';

export interface ItemUpdateRequest {
  condition?: string;
  grade?: string | null;
  notes?: string | null;
  acquiredAt?: string | null;
  manualPriceInput?: string; // raw dollar text; '' clears the override
}

export function applyItemUpdate(db: DB, id: number, req: ItemUpdateRequest): void {
  const patch: Parameters<typeof updateItem>[2] = {};
  if (req.condition !== undefined) {
    if (!isCondition(req.condition)) throw new Error(`Invalid condition: ${req.condition}`);
    patch.condition = req.condition;
  }
  if (req.grade !== undefined) patch.grade = req.grade;
  if (req.notes !== undefined) patch.notes = req.notes;
  if (req.acquiredAt !== undefined) patch.acquiredAt = req.acquiredAt;
  if (req.manualPriceInput !== undefined) {
    patch.manualPrice = req.manualPriceInput.trim() === '' ? null : parseDollars(req.manualPriceInput);
  }
  updateItem(db, id, patch);
}
```

- [ ] **Step 4: Implement `src/routes/api/collection/[id]/+server.ts`**

```ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { applyItemUpdate } from './logic';

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw error(400, 'bad item id');
  try {
    applyItemUpdate(db, id, await request.json());
    return json({ ok: true });
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'update failed');
  }
};
```

- [ ] **Step 5: Run tests — verify green**

Run: `npm run test -- "api/collection"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add collection item update endpoint with manual price parsing"
```

### Task 5.3: Sync and refresh endpoints

**Files:**
- Create: `src/routes/api/sync/+server.ts`, `src/routes/api/refresh/+server.ts`
- Test: `src/routes/api/sync/server.test.ts`

- [ ] **Step 1: Write the failing test**

`src/routes/api/sync/server.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { listGamesByConsole } from '$lib/db/queries/games';
import { runSync } from './logic';

describe('runSync', () => {
  it('syncs the catalog and returns a summary', async () => {
    const db = makeTestDb();
    const fetchPage = vi.fn(async () => ({
      games: [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }],
      nextPage: null
    }));
    const result = await runSync(db, {
      apiKey: 'k',
      platforms: [{ thegamesdbId: 6, name: 'SNES' }],
      fetchPage
    });
    expect(result.gamesLoaded).toBe(1);
    expect(listGamesByConsole(db, 'SNES')).toHaveLength(1);
  });

  it('throws a clear error when the API key is missing', async () => {
    const db = makeTestDb();
    await expect(runSync(db, { apiKey: '', platforms: [], fetchPage: vi.fn() })).rejects.toThrow(/API key/i);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- api/sync`
Expected: FAIL — `./logic` not found.

- [ ] **Step 3: Implement `src/routes/api/sync/logic.ts`**

```ts
import type { DB } from '$lib/db/client';
import { syncCatalog, type FetchPage, type SyncResult } from '$lib/sources/sync';
import type { Platform } from '$lib/sources/platforms';

export interface RunSyncOptions {
  apiKey: string;
  platforms: Platform[];
  fetchPage: FetchPage;
}

export async function runSync(db: DB, opts: RunSyncOptions): Promise<SyncResult> {
  if (!opts.apiKey) throw new Error('TheGamesDB API key is not configured');
  return syncCatalog(db, { platforms: opts.platforms, fetchPage: opts.fetchPage, onProgress: () => {} });
}
```

- [ ] **Step 4: Implement `src/routes/api/sync/+server.ts`**

```ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/db/client';
import { PLATFORMS } from '$lib/sources/platforms';
import { fetchPlatformGames } from '$lib/sources/thegamesdb';
import { runSync } from './logic';

export const POST: RequestHandler = async () => {
  const apiKey = env.THEGAMESDB_API_KEY ?? '';
  try {
    const result = await runSync(db, {
      apiKey,
      platforms: PLATFORMS,
      fetchPage: (id, name, page) => fetchPlatformGames(apiKey, id, name, page)
    });
    return json(result);
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'sync failed');
  }
};
```

- [ ] **Step 5: Implement `src/routes/api/refresh/+server.ts`**

```ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { ebaySearch } from '$lib/server/ebay';
import { refreshEstimates } from '$lib/sources/refresh';

export const POST: RequestHandler = async () => {
  try {
    const result = await refreshEstimates(db, { search: ebaySearch(), onProgress: () => {} });
    return json(result);
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'refresh failed');
  }
};
```

- [ ] **Step 6: Run tests — verify green**

Run: `npm run test -- api/sync`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add catalog sync and price refresh endpoints"
```

### Task 5.4: Page data loaders

**Files:**
- Create: `src/lib/server/dashboard.ts`
- Test: `src/lib/server/dashboard.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/server/dashboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, updateItem } from '$lib/db/queries/collection';
import { upsertEstimate } from '$lib/db/queries/prices';
import { dashboardData } from './dashboard';

describe('dashboardData', () => {
  it('totals item value and breaks it down by console', () => {
    const db = makeTestDb();
    upsertGames(db, [
      { id: 1, console: 'SNES', title: 'A', region: null, releaseYear: null },
      { id: 2, console: 'N64', title: 'B', region: null, releaseYear: null }
    ]);
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 5000, listingCount: 3 });
    upsertEstimate(db, { gameId: 2, condition: 'cib', estimate: 8000, listingCount: 2 });

    const data = dashboardData(db);
    expect(data.totalValue).toBe(13000);
    expect(data.itemCount).toBe(2);
    expect(data.byConsole).toEqual([
      { console: 'N64', value: 8000 },
      { console: 'SNES', value: 5000 }
    ]);
  });

  it('uses a manual price over the estimate in the total', () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'A', region: null, releaseYear: null }]);
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 5000, listingCount: 3 });
    updateItem(db, id, { manualPrice: 12000 });
    expect(dashboardData(db).totalValue).toBe(12000);
  });

  it('counts items with no known value as zero but reports them', () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'A', region: null, releaseYear: null }]);
    addItem(db, { gameId: 1, condition: 'loose' });
    const data = dashboardData(db);
    expect(data.totalValue).toBe(0);
    expect(data.unvaluedCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- server/dashboard`
Expected: FAIL — `./dashboard` not found.

- [ ] **Step 3: Implement `src/lib/server/dashboard.ts`**

```ts
import type { DB } from '$lib/db/client';
import { listCollection } from '$lib/db/queries/collection';
import { estimateMap, resolveItemValue } from '$lib/db/queries/prices';
import { topMovers, latestRefreshEvent, type Mover } from '$lib/db/queries/refresh';

export interface DashboardData {
  totalValue: number;
  itemCount: number;
  unvaluedCount: number;
  byConsole: { console: string; value: number }[];
  movers: Mover[];
  lastRefreshAt: Date | null;
}

export function dashboardData(db: DB): DashboardData {
  const items = listCollection(db);
  const estimates = estimateMap(db);

  let totalValue = 0;
  let unvaluedCount = 0;
  const consoleTotals = new Map<string, number>();

  for (const item of items) {
    const est = estimates.get(`${item.gameId}:${item.condition}`) ?? null;
    const value = resolveItemValue(item, est);
    if (value === null) {
      unvaluedCount++;
      continue;
    }
    totalValue += value;
    consoleTotals.set(item.console, (consoleTotals.get(item.console) ?? 0) + value);
  }

  const byConsole = [...consoleTotals.entries()]
    .map(([console, value]) => ({ console, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalValue,
    itemCount: items.length,
    unvaluedCount,
    byConsole,
    movers: topMovers(db, 5),
    lastRefreshAt: latestRefreshEvent(db)?.triggeredAt ?? null
  };
}
```

- [ ] **Step 4: Run tests — verify green**

Run: `npm run test -- server/dashboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add dashboard data aggregation"
```

**After completing Phase 5:** run 3+ review rounds. Confirm endpoints are thin wrappers and all business logic is in tested `logic.ts` / `lib` files.

---

## Phase 6 — App shell & Settings screen

**Execution Status:** ✅ SHIPPED at `a86d844`..`2ad6331` on 2026-05-20 (branch `feat/collection-value-tracker`)

Goal: a designed, distinctive app shell with navigation and design tokens, plus the Settings screen for catalog sync, price refresh, and credential status.

Design direction (user chose "Designed & distinctive"): a focused, collector's-tool aesthetic — dark slate surfaces, one warm accent (amber) for value/positive figures, a cool accent (cyan) for actions, generous spacing, a clear type scale. Tokens live in one file; every component reads them. Avoid generic gradient-card AI slop: flat surfaces, sharp 1px borders, deliberate hierarchy. Consult `frontend-design` conventions while implementing.

### Task 6.1: Design tokens and app shell

**Files:**
- Create: `src/lib/styles/tokens.css`, `src/app.css`, `src/lib/components/Nav.svelte`, `src/routes/+layout.svelte`
- Test: `src/lib/components/Nav.test.ts`

The nav lives in its own `Nav.svelte` component that takes the current
`pathname` as a plain prop. This keeps it unit-testable with zero
SvelteKit-context mocking. `+layout.svelte` itself is not unit-tested:
rendering it standalone would need a `children` snippet and the page
state, which is not worth mocking — its only logic is reading the
pathname and passing it to `Nav`.

- [ ] **Step 1: Write the failing test**

`src/lib/components/Nav.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Nav from './Nav.svelte';

describe('Nav', () => {
  it('renders links to all four screens', () => {
    const { getByRole } = render(Nav, { props: { pathname: '/' } });
    for (const name of ['Dashboard', 'Browse', 'Collection', 'Settings']) {
      expect(getByRole('link', { name })).toBeInTheDocument();
    }
  });
  it('marks the link matching the current pathname active', () => {
    const { getByRole } = render(Nav, { props: { pathname: '/browse' } });
    expect(getByRole('link', { name: 'Browse' })).toHaveClass('active');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- Nav`
Expected: FAIL — `Nav.svelte` not found.

- [ ] **Step 3: Create `src/lib/styles/tokens.css`**

```css
:root {
  --bg: #0f1419;
  --surface: #1a2129;
  --surface-2: #232d38;
  --border: #2f3a47;
  --text: #e6e9ed;
  --text-dim: #93a1b0;
  --accent: #3dd9d6;        /* actions */
  --accent-warm: #f0a830;   /* value figures */
  --positive: #4caf78;
  --negative: #e0644b;
  --space-1: 4px; --space-2: 8px; --space-3: 16px;
  --space-4: 24px; --space-5: 40px;
  --radius: 6px;
  --font: 'Inter', system-ui, -apple-system, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, monospace;
  --fs-sm: 13px; --fs-base: 15px; --fs-lg: 20px; --fs-xl: 32px;
}
```

- [ ] **Step 4: Install fonts and create `src/app.css`**

Install the fonts named in the design tokens, self-hosted (no CDN, works offline). The `@fontsource/*` (non-variable) packages expose the exact family names `Inter` and `JetBrains Mono` that `tokens.css` references. The font CSS is imported in `+layout.svelte` (Step 6) via JS `import` — the documented `@fontsource` usage — not via CSS `@import`.

```bash
npm install @fontsource/inter @fontsource/jetbrains-mono
```

Create `src/app.css`:

```css
@import './lib/styles/tokens.css';

* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: var(--fs-base);
  line-height: 1.5;
}
a { color: inherit; text-decoration: none; }
button { font-family: inherit; cursor: pointer; }
```

- [ ] **Step 5: Create `src/lib/components/Nav.svelte`**

```svelte
<script lang="ts">
  let { pathname }: { pathname: string } = $props();
  const links = [
    { href: '/', name: 'Dashboard' },
    { href: '/browse', name: 'Browse' },
    { href: '/collection', name: 'Collection' },
    { href: '/settings', name: 'Settings' }
  ];
</script>

<nav>
  <span class="brand">Collection Value Tracker</span>
  <ul>
    {#each links as link}
      <li><a href={link.href} class:active={pathname === link.href}>{link.name}</a></li>
    {/each}
  </ul>
</nav>

<style>
  nav {
    display: flex; align-items: center; gap: var(--space-5);
    padding: var(--space-3) var(--space-4);
    background: var(--surface); border-bottom: 1px solid var(--border);
  }
  .brand { font-weight: 600; letter-spacing: -0.01em; }
  ul { display: flex; gap: var(--space-3); list-style: none; }
  nav a { color: var(--text-dim); padding: var(--space-1) var(--space-2); border-radius: var(--radius); }
  nav a.active { color: var(--accent); }
  nav a:hover { color: var(--text); }
</style>
```

- [ ] **Step 6: Create `src/routes/+layout.svelte`**

```svelte
<script lang="ts">
  import '@fontsource/inter';
  import '@fontsource/jetbrains-mono';
  import '../app.css';
  import { page } from '$app/state';
  import Nav from '$lib/components/Nav.svelte';
  let { children } = $props();
</script>

<div class="app">
  <Nav pathname={page.url.pathname} />
  <main>{@render children()}</main>
</div>

<style>
  .app { min-height: 100%; }
  main { padding: var(--space-4); max-width: 1100px; margin: 0 auto; }
</style>
```

NOTE: `$app/state` requires SvelteKit 2.12+. If the scaffolded version is
older, use `import { page } from '$app/stores'` and `$page.url.pathname`
instead — the `Nav` component and its test are unaffected either way.

- [ ] **Step 7: Run tests — verify green**

Run: `npm run test -- Nav`
Expected: PASS. Then `npm run dev` and confirm the shell renders with the active link highlighted on each route.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add design tokens, Nav component, and app shell"
```

### Task 6.2: Settings screen

**Files:**
- Create: `src/routes/settings/+page.server.ts`, `src/routes/settings/+page.svelte`
- Test: `src/routes/settings/page.test.ts`

- [ ] **Step 1: Write the failing test**

`src/routes/settings/page.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';

const data = {
  gameCount: 1240,
  lastSyncedAt: null,
  ownedItemCount: 12,
  lastRefreshAt: null,
  credentials: { thegamesdb: true, ebay: false },
  refreshHistory: []
};

describe('settings page', () => {
  it('shows catalog game count and an unconfigured eBay warning', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText(/1240/)).toBeInTheDocument();
    expect(getByText(/eBay/i)).toBeInTheDocument();
  });
  it('shows Sync catalog and Refresh estimates actions', () => {
    const { getByRole } = render(Page, { props: { data } });
    expect(getByRole('button', { name: /sync catalog/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /refresh estimates/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- settings/page`
Expected: FAIL — `+page.svelte` not found.

- [ ] **Step 3: Implement `src/routes/settings/+page.server.ts`**

```ts
import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/db/client';
import { sql } from 'drizzle-orm';
import { games } from '$lib/db/schema';
import { credentialStatus } from '$lib/config';
import { listRefreshEvents, latestRefreshEvent } from '$lib/db/queries/refresh';
import { listCollection } from '$lib/db/queries/collection';

export const load: PageServerLoad = async () => {
  const gameCount = db.select({ c: sql<number>`count(*)` }).from(games).get()?.c ?? 0;
  const lastSynced = db.select({ t: sql<number>`max(last_synced_at)` }).from(games).get()?.t ?? null;
  return {
    gameCount,
    lastSyncedAt: lastSynced ? new Date(lastSynced * 1000) : null,
    ownedItemCount: listCollection(db).length,
    lastRefreshAt: latestRefreshEvent(db)?.triggeredAt ?? null,
    credentials: credentialStatus(env),
    refreshHistory: listRefreshEvents(db, 10)
  };
};
```

- [ ] **Step 4: Implement `src/routes/settings/+page.svelte`**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let syncing = $state(false);
  let refreshing = $state(false);
  let message = $state('');

  async function run(url: string, setBusy: (b: boolean) => void) {
    setBusy(true);
    message = '';
    try {
      const res = await fetch(url, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? 'failed');
      message = JSON.stringify(body);
      location.reload();
    } catch (e) {
      message = e instanceof Error ? e.message : 'error';
    } finally {
      setBusy(false);
    }
  }
</script>

<h1>Settings</h1>

<section class="card">
  <h2>Catalog</h2>
  <p><strong>{data.gameCount}</strong> games loaded.
    {#if data.lastSyncedAt}Last synced {data.lastSyncedAt.toLocaleString()}.{/if}</p>
  <button onclick={() => run('/api/sync', (b) => (syncing = b))} disabled={syncing}>
    {syncing ? 'Syncing…' : 'Sync catalog'}
  </button>
</section>

<section class="card">
  <h2>Prices</h2>
  <p>{data.ownedItemCount} owned items.
    {#if data.lastRefreshAt}Last refreshed {data.lastRefreshAt.toLocaleString()}.{/if}</p>
  <button onclick={() => run('/api/refresh', (b) => (refreshing = b))} disabled={refreshing}>
    {refreshing ? 'Refreshing…' : 'Refresh estimates'}
  </button>
</section>

<section class="card">
  <h2>Credentials</h2>
  <p class:ok={data.credentials.thegamesdb} class:bad={!data.credentials.thegamesdb}>
    TheGamesDB API key: {data.credentials.thegamesdb ? 'configured' : 'missing'}
  </p>
  <p class:ok={data.credentials.ebay} class:bad={!data.credentials.ebay}>
    eBay credentials: {data.credentials.ebay ? 'configured' : 'missing — set EBAY_APP_ID and EBAY_CLIENT_SECRET in .env'}
  </p>
</section>

<section class="card">
  <h2>Recent refreshes</h2>
  {#if data.refreshHistory.length === 0}
    <p class="dim">No refreshes yet.</p>
  {:else}
    <ul>
      {#each data.refreshHistory as e}
        <li>{e.triggeredAt.toLocaleString()} — {e.itemsUpdated} updated, {e.errors} errors</li>
      {/each}
    </ul>
  {/if}
</section>

{#if message}<p class="message">{message}</p>{/if}

<p class="dim footnote">
  Database lives at <code>data/collection.db</code> — back it up by copying that file.
  Nothing is sent anywhere except TheGamesDB and eBay.
</p>

<style>
  h1 { font-size: var(--fs-xl); margin-bottom: var(--space-4); }
  h2 { font-size: var(--fs-lg); margin-bottom: var(--space-2); }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-4); margin-bottom: var(--space-3);
  }
  button {
    margin-top: var(--space-3); background: var(--accent); color: var(--bg);
    border: none; border-radius: var(--radius); padding: var(--space-2) var(--space-3); font-weight: 600;
  }
  button:disabled { opacity: 0.5; cursor: default; }
  .ok { color: var(--positive); }
  .bad { color: var(--negative); }
  .dim { color: var(--text-dim); }
  .footnote { margin-top: var(--space-4); font-size: var(--fs-sm); }
  .message { margin-top: var(--space-3); font-family: var(--mono); font-size: var(--fs-sm); }
  ul { list-style: none; }
  code { font-family: var(--mono); }
</style>
```

- [ ] **Step 5: Run tests — verify green**

Run: `npm run test -- settings/page`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Settings screen with sync, refresh, and credential status"
```

**After completing Phase 6:** run 3+ review rounds. Verify in `npm run dev` that the shell and Settings screen render and look intentional, not generic.

---

## Phase 7 — Browse screen

**Execution Status:** ✅ SHIPPED at `3fc678a`..`f36057a` on 2026-05-20 (branch `feat/collection-value-tracker`)

Goal: the browse-and-check entry screen — console sidebar, title search, a game list with three condition controls per row, add/remove with a pending state while the estimate is fetched, and a detail editor.

Architectural context: the row's three controls are condition buttons (the catalog is unpriced). Adding posts to `/api/collection`; the row shows a pending state until the response returns, then shows the estimate. This is the timing-sensitive flow — component tests MUST await the resolved fetch mock, never a sleep.

**Deviation from the spec (deliberate, v1):** the spec describes opening the
detail editor from a Browse row via right-click / hover. That requires the
Browse load to also carry each owned item's `collection_items.id` (a row may
own several copies). v1 wires the `ItemEditor` to the **Collection screen**
only (Phase 8) — the editor is fully functional there, covering grade,
notes, acquired date, manual price, add-another-copy, and remove. Reaching
it from Browse is a later additive change (extend the Browse load with item
ids, add a row affordance). It is NOT implemented in this plan.

**BEFORE marking Task 7.2 complete:** If a test assertion races, fix it with deterministic synchronization (await the mocked fetch's resolution / `findBy*` queries which retry until the DOM settles) — NOT by removing or weakening the assertion. Prefer asserting the observable mechanism (the control shows the returned estimate) over a symptom (no error). If synchronization cannot make it reliable, STOP and escalate.

### Task 7.1: Browse layout — sidebar, search, list

**Files:**
- Create: `src/routes/browse/+page.server.ts`, `src/routes/browse/+page.svelte`, `src/lib/components/ConsoleSidebar.svelte`
- Test: `src/routes/browse/page.test.ts`

- [ ] **Step 1: Write the failing test**

`src/routes/browse/page.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';

const data = {
  consoles: [
    { console: 'SNES', count: 2 },
    { console: 'N64', count: 1 }
  ],
  selectedConsole: 'SNES',
  games: [
    { id: 1, title: 'Chrono Trigger', console: 'SNES', region: 'NTSC', releaseYear: 1995,
      ownedConditions: [], estimates: { loose: null, cib: null, new: null } },
    { id: 2, title: 'Super Metroid', console: 'SNES', region: 'NTSC', releaseYear: 1994,
      ownedConditions: ['loose'], estimates: { loose: 4200, cib: null, new: null } }
  ]
};

describe('browse page', () => {
  it('lists consoles with counts and the games for the selected console', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('SNES')).toBeInTheDocument();
    expect(getByText('Chrono Trigger')).toBeInTheDocument();
    expect(getByText('Super Metroid')).toBeInTheDocument();
  });
  it('shows the estimate on an owned condition control', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('$42.00')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- browse/page`
Expected: FAIL — `+page.svelte` not found.

- [ ] **Step 3: Implement `src/routes/browse/+page.server.ts`**

```ts
import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { consoleCounts, listGamesByConsole, searchGames } from '$lib/db/queries/games';
import { ownedConditionsByGame } from '$lib/db/queries/collection';
import { estimateMap } from '$lib/db/queries/prices';
import { CONDITIONS } from '$lib/types';

export const load: PageServerLoad = async ({ url }) => {
  const consoles = consoleCounts(db);
  const selectedConsole = url.searchParams.get('console') ?? consoles[0]?.console ?? '';
  const search = url.searchParams.get('q') ?? '';

  const rawGames = search
    ? searchGames(db, selectedConsole, search)
    : listGamesByConsole(db, selectedConsole);
  // Two batch queries instead of N per-game lookups.
  const estimates = estimateMap(db);
  const owned = ownedConditionsByGame(db);

  const gamesList = rawGames.map((g) => ({
    id: g.id,
    title: g.title,
    console: g.console,
    region: g.region,
    releaseYear: g.releaseYear,
    ownedConditions: owned.get(g.id) ?? [],
    estimates: Object.fromEntries(
      CONDITIONS.map((c) => [c, estimates.get(`${g.id}:${c}`) ?? null])
    ) as Record<string, number | null>
  }));

  return { consoles, selectedConsole, search, games: gamesList };
};
```

- [ ] **Step 4: Implement `src/lib/components/ConsoleSidebar.svelte`**

```svelte
<script lang="ts">
  let { consoles, selected }: {
    consoles: { console: string; count: number }[];
    selected: string;
  } = $props();
</script>

<aside>
  <h2>Consoles</h2>
  <ul>
    {#each consoles as c}
      <li>
        <a href={`/browse?console=${encodeURIComponent(c.console)}`} class:active={c.console === selected}>
          <span>{c.console}</span><span class="count">{c.count}</span>
        </a>
      </li>
    {/each}
  </ul>
</aside>

<style>
  aside { width: 200px; flex-shrink: 0; }
  h2 { font-size: var(--fs-sm); text-transform: uppercase; color: var(--text-dim); margin-bottom: var(--space-2); }
  ul { list-style: none; }
  a {
    display: flex; justify-content: space-between; padding: var(--space-2);
    border-radius: var(--radius); color: var(--text-dim);
  }
  a:hover { background: var(--surface-2); color: var(--text); }
  a.active { background: var(--surface-2); color: var(--accent); }
  .count { font-family: var(--mono); font-size: var(--fs-sm); }
</style>
```

- [ ] **Step 5: Implement `src/routes/browse/+page.svelte`** (list only — condition controls added in Task 7.2)

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import { formatCents } from '$lib/money';
  import { CONDITIONS, CONDITION_LABELS } from '$lib/types';
  import ConsoleSidebar from '$lib/components/ConsoleSidebar.svelte';
  let { data }: { data: PageData } = $props();
</script>

<div class="browse">
  <ConsoleSidebar consoles={data.consoles} selected={data.selectedConsole} />

  <div class="list">
    <h1>{data.selectedConsole}</h1>
    <div class="row header">
      <span>Title</span>
      {#each CONDITIONS as c}<span class="cond">{CONDITION_LABELS[c]}</span>{/each}
    </div>
    {#each data.games as game}
      <div class="row">
        <span class="title">{game.title}
          {#if game.releaseYear}<em>({game.releaseYear})</em>{/if}</span>
        {#each CONDITIONS as c}
          <span class="cond">{formatCents(game.estimates[c])}</span>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .browse { display: flex; gap: var(--space-4); }
  .list { flex: 1; }
  h1 { font-size: var(--fs-xl); margin-bottom: var(--space-3); }
  .row {
    display: grid; grid-template-columns: 1fr 90px 90px 90px;
    gap: var(--space-2); align-items: center;
    padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border);
  }
  .row.header { color: var(--text-dim); font-size: var(--fs-sm); text-transform: uppercase; }
  .cond { text-align: right; font-family: var(--mono); }
  .title em { color: var(--text-dim); font-style: italic; }
</style>
```

NOTE: the grid template `1fr 90px 90px 90px` is the shared column definition; the header and every row use it so columns cannot drift (spec requirement).

- [ ] **Step 6: Run tests — verify green**

Run: `npm run test -- browse/page`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Browse screen layout with console sidebar and game list"
```

### Task 7.2: Condition controls — add/remove with pending state

**Files:**
- Create: `src/lib/components/ConditionButton.svelte`
- Modify: `src/routes/browse/+page.svelte`
- Test: `src/lib/components/ConditionButton.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/components/ConditionButton.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';

// $app/navigation is a SvelteKit virtual module; invalidateAll() throws
// outside a running app, so it MUST be mocked for component unit tests.
vi.mock('$app/navigation', () => ({
  invalidateAll: vi.fn(() => Promise.resolve()),
  goto: vi.fn(() => Promise.resolve())
}));

import ConditionButton from './ConditionButton.svelte';

describe('ConditionButton', () => {
  it('shows a plus when not owned', () => {
    const { getByRole } = render(ConditionButton, {
      props: { gameId: 1, condition: 'loose', owned: false, estimate: null }
    });
    expect(getByRole('button').textContent).toContain('+');
  });

  it('shows the estimate when owned', () => {
    const { getByRole } = render(ConditionButton, {
      props: { gameId: 1, condition: 'loose', owned: true, estimate: 4200 }
    });
    expect(getByRole('button').textContent).toContain('$42.00');
  });

  it('posts an add request and reports pending then done — deterministic await', async () => {
    let resolveFetch: (v: Response) => void = () => {};
    const fetchMock = vi.fn(
      () => new Promise<Response>((r) => { resolveFetch = r; })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getByRole, findByText } = render(ConditionButton, {
      props: { gameId: 1, condition: 'loose', owned: false, estimate: null }
    });
    getByRole('button').click();
    await tick();
    // pending state is observable before the fetch resolves
    expect(getByRole('button').getAttribute('aria-busy')).toBe('true');

    // resolve deterministically — no sleep
    resolveFetch(new Response(JSON.stringify({ itemId: 7 }), { status: 200 }));
    await findByText('owned'); // findBy* retries until the DOM settles

    expect(fetchMock).toHaveBeenCalledWith('/api/collection', expect.objectContaining({ method: 'POST' }));
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- ConditionButton`
Expected: FAIL — `ConditionButton.svelte` not found.

- [ ] **Step 3: Implement `src/lib/components/ConditionButton.svelte`**

```svelte
<script lang="ts">
  import { formatCents } from '$lib/money';
  import { invalidateAll } from '$app/navigation';
  import type { Condition } from '$lib/types';

  let { gameId, condition, owned, estimate }: {
    gameId: number;
    condition: Condition;
    owned: boolean;
    estimate: number | null;
  } = $props();

  let pending = $state(false);
  let isOwned = $state(owned);
  let failed = $state(false);

  async function toggle() {
    pending = true;
    failed = false;
    try {
      const res = isOwned
        ? await fetch('/api/collection/by-pair', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId, condition })
          })
        : await fetch('/api/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId, condition })
          });
      if (!res.ok) {
        // The request failed — do NOT flip ownership; surface the failure.
        failed = true;
        return;
      }
      isOwned = !isOwned;
      await invalidateAll();
    } catch {
      failed = true;
    } finally {
      pending = false;
    }
  }
</script>

<button
  class="cond-btn"
  class:owned={isOwned}
  class:failed
  aria-busy={pending}
  disabled={pending}
  title={failed ? 'Request failed — click to retry' : ''}
  onclick={toggle}
>
  {#if pending}
    <span class="spin">…</span>
  {:else if isOwned}
    <span class="val">{estimate === null ? 'owned' : formatCents(estimate)}</span>
  {:else}
    <span class="add">+</span>
  {/if}
</button>

<style>
  .cond-btn {
    width: 100%; text-align: right; font-family: var(--mono); font-size: var(--fs-sm);
    background: var(--surface-2); color: var(--text-dim);
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: var(--space-1) var(--space-2);
  }
  .cond-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--text); }
  .cond-btn.owned { border-color: var(--accent-warm); color: var(--accent-warm); }
  .cond-btn.failed { border-color: var(--negative); color: var(--negative); }
  .cond-btn[aria-busy='true'] { opacity: 0.6; }
  .add { color: var(--accent); }
</style>
```

NOTE: the `DELETE /api/collection/by-pair` endpoint that removes by `(gameId, condition)` is added in Task 7.3 Step 3. Until then this test's remove path is not exercised; the add path (the test above) works without it.

- [ ] **Step 4: Wire `ConditionButton` into `src/routes/browse/+page.svelte`**

Replace the `{#each CONDITIONS as c}<span class="cond">…</span>{/each}` block inside each game row with:

```svelte
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
```

Add to the `<script>`: `import ConditionButton from '$lib/components/ConditionButton.svelte';`

Then remove the now-unused `import { formatCents } from '$lib/money';` line —
the row no longer formats prices itself; `ConditionButton` does. Leave the
`CONDITIONS` and `CONDITION_LABELS` imports (still used by the header and the
row's `{#each}`). Run `npm run check` and confirm no unused-import warning
remains for this file.

- [ ] **Step 5: Run tests — verify green**

Run: `npm run test -- ConditionButton browse/page`
Expected: PASS.

**BEFORE marking complete:** confirm the pending-state assertion used `aria-busy` observed before fetch resolution and `findByText` after — no `setTimeout`. If it raced, you fixed synchronization, not the assertion.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add condition buttons with add/remove and pending state"
```

### Task 7.3: By-pair remove endpoint + detail editor

**Files:**
- Create: `src/routes/api/collection/by-pair/+server.ts`, `src/routes/api/collection/by-pair/logic.ts`, `src/lib/components/ItemEditor.svelte`
- Test: `src/routes/api/collection/by-pair/server.test.ts`, `src/lib/components/ItemEditor.test.ts`

- [ ] **Step 1: Write the failing test for by-pair removal**

`src/routes/api/collection/by-pair/server.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, listCollection } from '$lib/db/queries/collection';
import { removeOneByPair } from './logic';

describe('removeOneByPair', () => {
  it('removes a single item matching the game and condition', () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 1, condition: 'loose' });
    removeOneByPair(db, { gameId: 1, condition: 'loose' });
    expect(listCollection(db)).toHaveLength(1); // only one copy removed
  });

  it('is a no-op when nothing matches', () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    removeOneByPair(db, { gameId: 1, condition: 'new' });
    expect(listCollection(db)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- by-pair`
Expected: FAIL — `./logic` not found.

- [ ] **Step 3: Implement `by-pair` logic and endpoint**

`src/routes/api/collection/by-pair/logic.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import type { DB } from '$lib/db/client';
import { collectionItems } from '$lib/db/schema';
import { removeItem } from '$lib/db/queries/collection';
import { isCondition } from '$lib/types';

/** Remove ONE item matching (gameId, condition) — used by the Browse toggle. */
export function removeOneByPair(db: DB, pair: { gameId: number; condition: string }): void {
  if (!isCondition(pair.condition)) throw new Error(`Invalid condition: ${pair.condition}`);
  const match = db
    .select({ id: collectionItems.id })
    .from(collectionItems)
    .where(and(eq(collectionItems.gameId, pair.gameId), eq(collectionItems.condition, pair.condition)))
    .limit(1)
    .get();
  if (match) removeItem(db, match.id);
}
```

`src/routes/api/collection/by-pair/+server.ts`:

```ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { removeOneByPair } from './logic';

export const DELETE: RequestHandler = async ({ request }) => {
  try {
    removeOneByPair(db, await request.json());
    return json({ ok: true });
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'remove failed');
  }
};
```

- [ ] **Step 4: Write the failing test for `ItemEditor`**

`src/lib/components/ItemEditor.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

// $app/navigation is a SvelteKit virtual module — mock it for unit tests.
vi.mock('$app/navigation', () => ({
  invalidateAll: vi.fn(() => Promise.resolve()),
  goto: vi.fn(() => Promise.resolve())
}));

import ItemEditor from './ItemEditor.svelte';

const item = {
  id: 5, gameId: 1, title: 'Chrono Trigger', condition: 'loose',
  grade: null, notes: null, acquiredAt: null, manualPrice: null
};

describe('ItemEditor', () => {
  it('renders fields for grade, notes, acquired date and manual price', () => {
    const { getByLabelText } = render(ItemEditor, { props: { item, onclose: () => {} } });
    expect(getByLabelText(/grade/i)).toBeInTheDocument();
    expect(getByLabelText(/notes/i)).toBeInTheDocument();
    expect(getByLabelText(/manual price/i)).toBeInTheDocument();
  });
  it('PATCHes the item on save', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { findByRole } = render(ItemEditor, { props: { item, onclose: () => {} } });
    (await findByRole('button', { name: /save/i })).click();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith('/api/collection/5', expect.objectContaining({ method: 'PATCH' }));
    vi.unstubAllGlobals();
  });
  it('DELETEs the item when Remove is clicked', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { findByRole } = render(ItemEditor, { props: { item, onclose: () => {} } });
    (await findByRole('button', { name: /remove/i })).click();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith('/api/collection', expect.objectContaining({ method: 'DELETE' }));
    vi.unstubAllGlobals();
  });
  it('POSTs another copy when "Add another copy" is clicked', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ itemId: 9 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { findByRole } = render(ItemEditor, { props: { item, onclose: () => {} } });
    (await findByRole('button', { name: /add another copy/i })).click();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith('/api/collection', expect.objectContaining({ method: 'POST' }));
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 5: Implement `src/lib/components/ItemEditor.svelte`**

```svelte
<script lang="ts">
  import { GRADES } from '$lib/types';
  import { invalidateAll } from '$app/navigation';

  let { item, onclose }: {
    item: {
      id: number; gameId: number; title: string; condition: string;
      grade: string | null; notes: string | null;
      acquiredAt: string | null; manualPrice: number | null;
    };
    onclose: () => void;
  } = $props();

  let grade = $state(item.grade ?? '');
  let notes = $state(item.notes ?? '');
  let acquiredAt = $state(item.acquiredAt ?? '');
  let manualPriceInput = $state(item.manualPrice !== null ? (item.manualPrice / 100).toFixed(2) : '');
  let busy = $state(false);

  async function withBusy(fn: () => Promise<void>) {
    busy = true;
    try {
      await fn();
      await invalidateAll();
      onclose();
    } finally {
      busy = false;
    }
  }

  const save = () =>
    withBusy(async () => {
      await fetch(`/api/collection/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: grade || null, notes: notes || null,
          acquiredAt: acquiredAt || null, manualPriceInput })
      });
    });

  const remove = () =>
    withBusy(async () => {
      await fetch('/api/collection', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id })
      });
    });

  const addAnother = () =>
    withBusy(async () => {
      await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: item.gameId, condition: item.condition })
      });
    });
</script>

<div class="editor">
  <h3>{item.title} <span class="dim">· {item.condition}</span></h3>

  <label>Grade
    <select bind:value={grade}>
      <option value="">—</option>
      {#each GRADES as g}<option value={g}>{g}</option>{/each}
    </select>
  </label>

  <label>Acquired date
    <input type="date" bind:value={acquiredAt} />
  </label>

  <label>Manual price (overrides the estimate)
    <input type="text" inputmode="decimal" placeholder="e.g. 49.99" bind:value={manualPriceInput} />
  </label>

  <label>Notes
    <textarea bind:value={notes} rows="2"></textarea>
  </label>

  <div class="actions">
    <button onclick={save} disabled={busy}>{busy ? 'Working…' : 'Save'}</button>
    <button class="ghost" onclick={addAnother} disabled={busy}>Add another copy</button>
    <button class="danger" onclick={remove} disabled={busy}>Remove</button>
    <button class="ghost" onclick={onclose} disabled={busy}>Cancel</button>
  </div>
</div>

<style>
  .editor {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-4); display: grid; gap: var(--space-3);
  }
  h3 { font-size: var(--fs-lg); }
  .dim { color: var(--text-dim); }
  label { display: grid; gap: var(--space-1); font-size: var(--fs-sm); color: var(--text-dim); }
  input, select, textarea {
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-2); font-family: inherit; font-size: var(--fs-base);
  }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  button { background: var(--accent); color: var(--bg); border: none;
    border-radius: var(--radius); padding: var(--space-2) var(--space-3); font-weight: 600; }
  button:disabled { opacity: 0.5; cursor: default; }
  button.ghost { background: transparent; color: var(--text-dim); border: 1px solid var(--border); }
  button.danger { background: transparent; color: var(--negative); border: 1px solid var(--negative); }
</style>
```

- [ ] **Step 6: Run tests — verify green**

Run: `npm run test -- by-pair ItemEditor`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add by-pair removal endpoint and item detail editor"
```

**After completing Phase 7:** run 3+ review rounds. In `npm run dev`: sync a small catalog (or insert fixture rows), add a game, confirm the pending state then the estimate. Confirm no `setTimeout` synchronization in any test.

---

## Phase 8 — Collection screen

**Execution Status:** ✅ SHIPPED at `b0a3713` on 2026-05-20 (branch `feat/collection-value-tracker`)

Goal: a sortable, filterable table of owned items with per-row editing via `ItemEditor`.

### Task 8.1: Collection table

**Files:**
- Create: `src/routes/collection/+page.server.ts`, `src/routes/collection/+page.svelte`
- Test: `src/routes/collection/page.test.ts`

- [ ] **Step 1: Write the failing test**

`src/routes/collection/page.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';

const data = {
  items: [
    { id: 1, gameId: 1, title: 'Chrono Trigger', console: 'SNES', condition: 'loose',
      grade: 'mint', notes: 'boxed', acquiredAt: null, manualPrice: null, value: 4200, valueSource: 'estimate' },
    { id: 2, gameId: 2, title: 'GoldenEye', console: 'N64', condition: 'cib',
      grade: null, notes: null, acquiredAt: null, manualPrice: 9000, value: 9000, valueSource: 'manual' }
  ],
  totalValue: 13200,
  averageValue: 6600
};

describe('collection page', () => {
  it('renders a row per item with title and value', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('Chrono Trigger')).toBeInTheDocument();
    expect(getByText('$42.00')).toBeInTheDocument();
    expect(getByText('$90.00')).toBeInTheDocument();
  });
  it('shows the collection total and average', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('$132.00')).toBeInTheDocument();
    expect(getByText('$66.00')).toBeInTheDocument();
  });
  it('marks a manually-priced value distinctly from an estimate', () => {
    const { getByTestId } = render(Page, { props: { data } });
    expect(getByTestId('value-source-2').textContent).toMatch(/manual/i);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- collection/page`
Expected: FAIL — `+page.svelte` not found.

- [ ] **Step 3: Implement `src/routes/collection/+page.server.ts`**

```ts
import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { listCollection } from '$lib/db/queries/collection';
import { estimateMap, resolveItemValue } from '$lib/db/queries/prices';

export const load: PageServerLoad = async () => {
  const rows = listCollection(db);
  const estimates = estimateMap(db);

  const items = rows.map((r) => {
    const est = estimates.get(`${r.gameId}:${r.condition}`) ?? null;
    const value = resolveItemValue(r, est);
    return {
      id: r.id, gameId: r.gameId, title: r.title, console: r.console, condition: r.condition,
      grade: r.grade, notes: r.notes, acquiredAt: r.acquiredAt, manualPrice: r.manualPrice,
      value,
      valueSource: r.manualPrice !== null ? 'manual' : est !== null ? 'estimate' : 'unknown'
    };
  });

  const valued = items.filter((i) => i.value !== null) as { value: number }[];
  const totalValue = valued.reduce((s, i) => s + i.value, 0);
  return {
    items,
    totalValue,
    averageValue: valued.length ? Math.round(totalValue / valued.length) : 0
  };
};
```

- [ ] **Step 4: Implement `src/routes/collection/+page.svelte`**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import { formatCents } from '$lib/money';
  import { CONDITION_LABELS } from '$lib/types';
  import type { Condition } from '$lib/types';
  import ItemEditor from '$lib/components/ItemEditor.svelte';

  let { data }: { data: PageData } = $props();

  type SortKey = 'title' | 'console' | 'value';
  let sortKey = $state<SortKey>('title');
  let filter = $state('');
  let editingId = $state<number | null>(null);

  let visible = $derived(
    data.items
      .filter((i) => i.title.toLowerCase().includes(filter.toLowerCase()))
      .toSorted((a, b) => {
        if (sortKey === 'value') return (b.value ?? 0) - (a.value ?? 0);
        return a[sortKey].localeCompare(b[sortKey]);
      })
  );
</script>

<h1>My Collection</h1>

<div class="summary">
  <span>Total <strong class="val">{formatCents(data.totalValue)}</strong></span>
  <span>Items <strong>{data.items.length}</strong></span>
  <span>Average <strong class="val">{formatCents(data.averageValue)}</strong></span>
</div>

<div class="controls">
  <input placeholder="Filter by title…" bind:value={filter} />
  <label>Sort
    <select bind:value={sortKey}>
      <option value="title">Title</option>
      <option value="console">Console</option>
      <option value="value">Value</option>
    </select>
  </label>
</div>

<div class="row header">
  <span>Title</span><span>Console</span><span>Condition</span><span>Grade</span>
  <span class="num">Value</span><span></span>
</div>

{#each visible as item (item.id)}
  <div class="row">
    <span class="title">{item.title}
      {#if item.notes}<em>— {item.notes}</em>{/if}</span>
    <span>{item.console}</span>
    <span class="badge">{CONDITION_LABELS[item.condition as Condition]}</span>
    <span>{item.grade ?? '—'}</span>
    <span class="num val">
      {formatCents(item.value)}
      <small data-testid={`value-source-${item.id}`} class="src">{item.valueSource}</small>
    </span>
    <button class="menu" onclick={() => (editingId = editingId === item.id ? null : item.id)}>⋯</button>
  </div>
  {#if editingId === item.id}
    <ItemEditor item={item} onclose={() => (editingId = null)} />
  {/if}
{/each}

{#if data.items.length === 0}
  <p class="empty">No items yet. Add games from the <a href="/browse">Browse</a> screen.</p>
{/if}

<style>
  h1 { font-size: var(--fs-xl); margin-bottom: var(--space-3); }
  .summary { display: flex; gap: var(--space-4); margin-bottom: var(--space-3); color: var(--text-dim); }
  .summary .val { color: var(--accent-warm); }
  .controls { display: flex; gap: var(--space-3); margin-bottom: var(--space-3); }
  input, select {
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-2);
  }
  .row {
    display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1.2fr 40px;
    gap: var(--space-2); align-items: center;
    padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border);
  }
  .row.header { color: var(--text-dim); font-size: var(--fs-sm); text-transform: uppercase; }
  .num { text-align: right; font-family: var(--mono); }
  .val { color: var(--accent-warm); }
  .src { display: block; font-size: 10px; color: var(--text-dim); text-transform: uppercase; }
  .badge {
    justify-self: start; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1px var(--space-2); font-size: var(--fs-sm);
  }
  .title em { color: var(--text-dim); font-style: italic; }
  .menu { background: transparent; border: none; color: var(--text-dim); font-size: var(--fs-lg); }
  .empty { color: var(--text-dim); margin-top: var(--space-4); }
  .empty a { color: var(--accent); }
</style>
```

- [ ] **Step 5: Run tests — verify green**

Run: `npm run test -- collection/page`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Collection screen with sortable, filterable item table"
```

**After completing Phase 8:** run 3+ review rounds. In `npm run dev`, confirm filter, sort, and the inline `ItemEditor` all work and a saved manual price re-renders the value with the `manual` marker.

---

## Phase 9 — Dashboard screen

**Execution Status:** ✅ SHIPPED at `e43743f`..`46491ab` on 2026-05-20 (branch `feat/collection-value-tracker`)

Goal: the portfolio dashboard — stat tiles, a console value-breakdown bar, and a top-movers panel.

### Task 9.1: Dashboard leaf components — ConsoleBar and MoversPanel

**Files:**
- Create: `src/lib/components/ConsoleBar.svelte`, `src/lib/components/MoversPanel.svelte`
- Test: `src/lib/components/ConsoleBar.test.ts`, `src/lib/components/MoversPanel.test.ts`

Both leaf components are built before the dashboard page (Task 9.2) so the page can import them with no forward dependency.

- [ ] **Step 1: Write the failing tests**

`src/lib/components/ConsoleBar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ConsoleBar from './ConsoleBar.svelte';

describe('ConsoleBar', () => {
  it('renders a labelled segment per console', () => {
    const { getByText } = render(ConsoleBar, {
      props: { byConsole: [{ console: 'SNES', value: 7500 }, { console: 'N64', value: 2500 }] }
    });
    expect(getByText('SNES')).toBeInTheDocument();
    expect(getByText('N64')).toBeInTheDocument();
  });
  it('sizes each segment by its share of the total', () => {
    const { getByTestId } = render(ConsoleBar, {
      props: { byConsole: [{ console: 'SNES', value: 7500 }, { console: 'N64', value: 2500 }] }
    });
    expect(getByTestId('seg-SNES').style.width).toBe('75%');
    expect(getByTestId('seg-N64').style.width).toBe('25%');
  });
  it('renders nothing meaningful for an empty collection', () => {
    const { getByText } = render(ConsoleBar, { props: { byConsole: [] } });
    expect(getByText(/no value/i)).toBeInTheDocument();
  });
});
```

`src/lib/components/MoversPanel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MoversPanel from './MoversPanel.svelte';

describe('MoversPanel', () => {
  it('shows each mover with its signed dollar change', () => {
    const { getByText } = render(MoversPanel, {
      props: { movers: [
        { gameId: 1, title: 'Chrono Trigger', condition: 'loose', previous: 5000, current: 6200, delta: 1200 },
        { gameId: 2, title: 'GoldenEye', condition: 'cib', previous: 8000, current: 7900, delta: -100 }
      ] }
    });
    expect(getByText('Chrono Trigger')).toBeInTheDocument();
    expect(getByText(/\+\$12\.00/)).toBeInTheDocument();
    expect(getByText(/−\$1\.00/)).toBeInTheDocument();
  });
  it('shows an empty-state message when there are no movers', () => {
    const { getByText } = render(MoversPanel, { props: { movers: [] } });
    expect(getByText(/no movement|need at least two refreshes/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm run test -- ConsoleBar MoversPanel`
Expected: FAIL — neither component exists.

- [ ] **Step 3: Implement `src/lib/components/ConsoleBar.svelte`**

```svelte
<script lang="ts">
  let { byConsole }: { byConsole: { console: string; value: number }[] } = $props();
  const palette = ['#3dd9d6', '#f0a830', '#8b7ff0', '#4caf78', '#e0644b', '#5b9bd5'];
  let total = $derived(byConsole.reduce((s, c) => s + c.value, 0));
</script>

{#if total === 0}
  <p class="dim">No value to break down yet.</p>
{:else}
  <div class="bar">
    {#each byConsole as c, i}
      <div
        class="seg"
        data-testid={`seg-${c.console}`}
        style:width={`${(c.value / total) * 100}%`}
        style:background={palette[i % palette.length]}
      ></div>
    {/each}
  </div>
  <ul class="legend">
    {#each byConsole as c, i}
      <li>
        <span class="dot" style:background={palette[i % palette.length]}></span>
        {c.console}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .bar { display: flex; height: 28px; border-radius: var(--radius); overflow: hidden; }
  .seg { min-width: 2px; }
  .legend { display: flex; flex-wrap: wrap; gap: var(--space-3); list-style: none; margin-top: var(--space-2); }
  .legend li { display: flex; align-items: center; gap: var(--space-1); font-size: var(--fs-sm); color: var(--text-dim); }
  .dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  .dim { color: var(--text-dim); }
</style>
```

- [ ] **Step 4: Implement `src/lib/components/MoversPanel.svelte`**

```svelte
<script lang="ts">
  import { formatCents } from '$lib/money';
  import { CONDITION_LABELS } from '$lib/types';
  import type { Condition } from '$lib/types';

  let { movers }: {
    movers: { gameId: number; title: string; condition: string;
      previous: number; current: number; delta: number }[];
  } = $props();
</script>

{#if movers.length === 0}
  <p class="dim">No movement yet — need at least two refreshes to compare.</p>
{:else}
  <ul>
    {#each movers as m}
      <li>
        <span class="title">{m.title}
          <small>{CONDITION_LABELS[m.condition as Condition]}</small></span>
        <span class="prices">{formatCents(m.previous)} → {formatCents(m.current)}</span>
        <span class="delta" class:up={m.delta > 0} class:down={m.delta < 0}>
          {m.delta > 0 ? '+' : '−'}{formatCents(Math.abs(m.delta))}
        </span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  ul { list-style: none; }
  li {
    display: grid; grid-template-columns: 2fr 1.5fr 1fr; gap: var(--space-2);
    align-items: center; padding: var(--space-2) 0; border-bottom: 1px solid var(--border);
  }
  li:last-child { border-bottom: none; }
  .title small { color: var(--text-dim); margin-left: var(--space-1); }
  .prices { font-family: var(--mono); font-size: var(--fs-sm); color: var(--text-dim); }
  .delta { text-align: right; font-family: var(--mono); }
  .delta.up { color: var(--positive); }
  .delta.down { color: var(--negative); }
  .dim { color: var(--text-dim); }
</style>
```

- [ ] **Step 5: Run tests — verify green**

Run: `npm run test -- ConsoleBar MoversPanel`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add ConsoleBar and MoversPanel dashboard components"
```

### Task 9.2: Dashboard page

**Files:**
- Create: `src/routes/+page.server.ts`, `src/routes/+page.svelte`
- Test: `src/routes/page.test.ts`

This task replaces the default scaffold `src/routes/+page.svelte`. It depends on `ConsoleBar` and `MoversPanel` from Task 9.1.

- [ ] **Step 1: Write the failing test**

`src/routes/page.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';

const data = {
  totalValue: 13000, itemCount: 2, unvaluedCount: 0,
  byConsole: [{ console: 'SNES', value: 13000 }],
  movers: [], lastRefreshAt: null, previousTotal: 11000
};

describe('dashboard', () => {
  it('shows total value and item count tiles', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('$130.00')).toBeInTheDocument();
    expect(getByText('2')).toBeInTheDocument();
  });
  it('shows the delta since the last refresh', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText(/\+\$20\.00/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm run test -- routes/page`
Expected: FAIL — the dashboard markup is not in place.

- [ ] **Step 3: Implement `src/routes/+page.server.ts`**

```ts
import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { dashboardData } from '$lib/server/dashboard';
import { topMovers } from '$lib/db/queries/refresh';

export const load: PageServerLoad = async () => {
  const data = dashboardData(db);
  // previousTotal = current total minus the sum of mover deltas
  const moverDeltaSum = topMovers(db, 1000).reduce((s, m) => s + m.delta, 0);
  return { ...data, previousTotal: data.totalValue - moverDeltaSum };
};
```

- [ ] **Step 4: Implement `src/routes/+page.svelte`**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import { formatCents } from '$lib/money';
  import ConsoleBar from '$lib/components/ConsoleBar.svelte';
  import MoversPanel from '$lib/components/MoversPanel.svelte';

  let { data }: { data: PageData } = $props();
  let delta = $derived(data.totalValue - data.previousTotal);
</script>

<h1>Dashboard</h1>

<div class="tiles">
  <div class="tile">
    <span class="label">Total estimated value</span>
    <span class="figure">{formatCents(data.totalValue)}</span>
    {#if delta !== 0}
      <span class="delta" class:up={delta > 0} class:down={delta < 0}>
        {delta > 0 ? '+' : '−'}{formatCents(Math.abs(delta))} since last refresh
      </span>
    {/if}
  </div>
  <div class="tile">
    <span class="label">Items</span>
    <span class="figure">{data.itemCount}</span>
    {#if data.unvaluedCount > 0}
      <span class="delta">{data.unvaluedCount} without an estimate</span>
    {/if}
  </div>
</div>

<section class="card">
  <h2>Value by console</h2>
  <ConsoleBar byConsole={data.byConsole} />
</section>

<section class="card">
  <h2>Top movers</h2>
  <MoversPanel movers={data.movers} />
</section>

<p class="dim foot">Values are estimates from current eBay active listings, not sold-price data.</p>

<style>
  h1 { font-size: var(--fs-xl); margin-bottom: var(--space-4); }
  h2 { font-size: var(--fs-lg); margin-bottom: var(--space-3); }
  .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3); }
  .tile, .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-4);
  }
  .card { margin-bottom: var(--space-3); }
  .label { color: var(--text-dim); font-size: var(--fs-sm); text-transform: uppercase; }
  .figure { display: block; font-size: var(--fs-xl); color: var(--accent-warm); font-family: var(--mono); margin-top: var(--space-1); }
  .delta { font-size: var(--fs-sm); color: var(--text-dim); }
  .delta.up { color: var(--positive); }
  .delta.down { color: var(--negative); }
  .dim { color: var(--text-dim); }
  .foot { font-size: var(--fs-sm); margin-top: var(--space-3); }
</style>
```

- [ ] **Step 5: Run tests — verify green**

Run: `npm run test -- routes/page`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Dashboard page with stat tiles, console bar, and movers"
```

**After completing Phase 9:** run 3+ review rounds. Run the full suite (`npm run test`), `npm run check`, and `npm run build`. In `npm run dev`, walk the whole flow: sync catalog → browse → add games → refresh estimates → dashboard reflects values and movers.

---

## Self-Review (completed by the plan author)

**Spec coverage:** Catalog sync (Phase 3), eBay estimates + manual override (Phase 4, Task 5.2), five-table data model (Task 1.4), all four screens (Phases 6–9), `.env` credentials (Task 1.6, 6.2), integer-cents money (Task 1.5, enforced throughout), owned-games-only pricing (Task 4.5, 5.1), top movers (Task 2.4, 9.2), refresh history (Task 6.2). The spec's five Open Verification Items are surfaced inline: #1/#4 in Task 3.1–3.2 notes, #2/#3 in Phase 4 and Task 4.3, #5 in Task 1.3 (better-sqlite3 build).

**Type consistency:** `Condition`, `CatalogGame`, `DB`, `SearchFn`, `Estimate`, `Mover`, `Platform`, `PlatformPage` are each defined once and imported elsewhere. Query functions uniformly take `db: DB` first. `estimateMap` keys are `${gameId}:${condition}` everywhere (Tasks 2.3, 5.4, 7.1, 8.1).

**Review status:** This plan passed `/plan-review-cycle`. All test and implementation code uses ESM `import` only — no `require`. Every code step contains complete, final code (no draft-then-fix splits). Component tests that touch `$app/navigation` mock it explicitly. The only deferred per-task `npm run check` gate is Task 1.3 (foundation ordering), satisfied at Task 1.4.
