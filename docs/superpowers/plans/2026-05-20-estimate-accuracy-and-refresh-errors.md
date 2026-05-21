# Estimate Accuracy & Refresh Error Surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make eBay price estimates trustworthy by filtering out mismatched listings, and make refresh failures diagnosable instead of silent.

**Architecture:** Widen the eBay search boundary (`SearchFn`) so listing title and condition survive the trip from the HTTP client; add a pure `filterListings` step between search and median. Introduce a typed `EbayError`, classify failures, abort the refresh loop on fatal errors, and persist a categorized error summary on `refresh_events`.

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

**Overall:** 1/2 phases shipped. Executing on branch `feat/estimate-accuracy-refresh-errors`.

| Phase | Status | Ship SHA(s) | Notes |
|---|---|---|---|
| 1 — Estimate Accuracy | ✅ Shipped | `cade9a2`…`0a4e7f3` | Tasks 1.1–1.6, group review passed; 135 tests green |
| 2 — Refresh Error Surfacing | ⬜ Not started | — | Tasks 2.1–2.3 |

### Deviations

- **Task 1.5:** `src/routes/api/collection/server.test.ts` was modified (not in the task's file list) — a `SearchFn` test fake there returned `number[]` and had to be updated to `Listing[]` for the suite to typecheck under the widened `SearchFn`. Test-fake type update only; no production code or test behavior changed. The plan's file list missed that the collection route has a test with a search fake.
- **Phase 1 follow-ups beyond the literal task steps:** `ABOUTME:` headers were added to `server/ebay.ts` (commit `4783319`) and to `auth.ts`/`query.ts`/`refresh.ts` (commit `0a4e7f3`) — these files were modified by the phase but pre-existed without the mandatory header. Surfaced by the code-quality and group reviews.
- **Extra review-driven test commits:** `a97c09d` (null-input coverage for `classifyError`) and `b006196` (read-description junk-marker coverage) — minor coverage gaps closed during review.

---

## Source Spec

This plan implements `docs/superpowers/specs/2026-05-20-estimate-accuracy-and-refresh-errors-design.md`. Read it for the rationale behind each decision; this plan is the executable form.

## Execution Setup

Before Task 1.1, create a feature branch — do NOT execute on `main`. Suggested name: `feat/estimate-accuracy-refresh-errors`. Execute the tasks in numeric order (1.1 → 1.2 → … → 2.3); the dependency notes assume that order. When all tasks are done, use `superpowers:finishing-a-development-branch`.

## Task Discipline (applies to every task)

Every task below references this section. Do not skip it.

**§A — Before starting any task:**

1. Invoke `superpowers:test-driven-development`.
2. Read `docs/pitfalls/testing-pitfalls.md`.
3. Follow TDD strictly: write the failing test → run it, confirm it fails for the expected reason → write the minimum code to pass → run it, confirm green → refactor if needed, keep green.

**§B — Before marking any task complete:**

1. Review the new tests against `docs/pitfalls/testing-pitfalls.md` — error paths covered, edge/empty inputs covered.
2. Run the full suite: `npx vitest run` — every test green.
3. Run `npm run check` — zero errors, zero warnings.
4. Confirm test output is pristine (testing-pitfalls §1): no stray stderr, no debug prints, no unhandled rejections.

**§C — Commit messages:** every `git commit` in this plan MUST end with the `Co-Authored-By` trailer. The commit commands shown in each task omit it for brevity — add it every time by passing a second `-m` flag (which produces the required blank line before it):

```
git commit -m "<subject from the task>" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

**Project pitfalls binding on this work** (`docs/pitfalls/`):

- **CVT-1 — money is integer cents.** All listing prices stay integer cents. Never introduce a float into a price path.
- **CVT-T1 — no live external calls in tests.** Every test touching eBay code uses an injected fake (`vi.fn`) or a fake `fetch`. A test that reaches the real network is forbidden.
- **CVT-T2 — async tests use deterministic synchronization.** Refresh tests `await` resolved/rejected mock promises; never a fixed sleep. If an assertion races, fix the synchronization — do not weaken or delete the assertion.
- **testing-pitfalls §1 + §3 — error-path coverage with pristine output.** Each error branch gets a test that triggers it and asserts the message/shape. Because thrown `EbayError`s are caught inside the code under test, they must not leak to stderr — do NOT add `console.error` anywhere in this work.

---

## Phase 1 — Estimate Accuracy

**Execution Status:** ✅ SHIPPED at `cade9a2`…`0a4e7f3` on 2026-05-21 (branch `feat/estimate-accuracy-refresh-errors`; per-task spec + code-quality reviews and the Phase 1 group review all passed; 135 tests green, `npm run check` clean)

Goal of this phase: an estimate is computed only from eBay listings that actually match the game and condition. The phase widens the search boundary type and inserts a filter step.

### Task 1.1: eBay error vocabulary

**Files:**
- Create: `src/lib/sources/ebay/errors.ts`
- Test: `src/lib/sources/ebay/errors.test.ts`

**Discipline:** Task Discipline §A before, §B after.

**Context:** `auth.ts` and `client.ts` currently `throw new Error('eBay search failed: 429')`. The refresh loop will need to tell auth failures and rate limits apart from ordinary errors. A plain `Error` forces fragile message-string parsing. This task adds a typed error carrying the HTTP status, plus a classifier. Nothing imports it yet — it lands standalone.

- [ ] **Step 1: Write the failing test**

Create `src/lib/sources/ebay/errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EbayError, classifyError } from './errors';

describe('EbayError', () => {
  it('carries the HTTP status, message, and is an Error', () => {
    const e = new EbayError(429, 'eBay search failed: 429');
    expect(e.status).toBe(429);
    expect(e.message).toBe('eBay search failed: 429');
    expect(e.name).toBe('EbayError');
    expect(e).toBeInstanceOf(Error);
  });
});

describe('classifyError', () => {
  it('classifies 401 and 403 as auth', () => {
    expect(classifyError(new EbayError(401, 'x'))).toBe('auth');
    expect(classifyError(new EbayError(403, 'x'))).toBe('auth');
  });
  it('classifies 429 as rate_limit', () => {
    expect(classifyError(new EbayError(429, 'x'))).toBe('rate_limit');
  });
  it('classifies other EbayError statuses as other', () => {
    expect(classifyError(new EbayError(500, 'x'))).toBe('other');
    expect(classifyError(new EbayError(404, 'x'))).toBe('other');
  });
  it('classifies a plain Error and non-Error values as other', () => {
    expect(classifyError(new Error('network down'))).toBe('other');
    expect(classifyError('boom')).toBe('other');
    expect(classifyError(undefined)).toBe('other');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sources/ebay/errors.test.ts`
Expected: FAIL — `Cannot find module './errors'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/sources/ebay/errors.ts`:

```ts
// ABOUTME: Error vocabulary for the eBay client — a typed error carrying the
// ABOUTME: HTTP status, and a classifier that buckets failures for the refresh loop.

/** An eBay API call that returned a non-OK HTTP response. */
export class EbayError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'EbayError';
  }
}

/** The three failure buckets the refresh loop reacts to. */
export type ErrorReason = 'auth' | 'rate_limit' | 'other';

/** Bucket any thrown value into a reason. Non-EbayError values are `other`. */
export function classifyError(e: unknown): ErrorReason {
  if (e instanceof EbayError) {
    if (e.status === 401 || e.status === 403) return 'auth';
    if (e.status === 429) return 'rate_limit';
  }
  return 'other';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/sources/ebay/errors.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sources/ebay/errors.ts src/lib/sources/ebay/errors.test.ts
git commit -m "Add typed EbayError and failure classifier"
```

### Task 1.2: Listing-quality filter

**Files:**
- Create: `src/lib/sources/ebay/filter.ts`
- Test: `src/lib/sources/ebay/filter.test.ts`

**Discipline:** Task Discipline §A before, §B after.

**Context:** Today an estimate is the raw median of every price a keyword search returned — lots, bundles, reproductions, and wrong-condition listings included. This task adds a pure function that drops listings not worth pricing. It defines the `Listing` type, which becomes the boundary type for the whole eBay search path in Task 1.5. Nothing imports it yet.

**Do NOT:** do not extract a shared `fold` helper to `$lib` or modify `src/routes/browse/+page.svelte` — the Browse screen has its own copy of accent-folding; deduplicating it is out of scope. Keep `fold` local to `filter.ts`.

**Known edge case (acceptable):** a game whose title has no token of length ≥ 4 (e.g. "UFO") produces an empty token list, so the title-match filter keeps every listing. The junk and condition filters still apply. This is rare and an acceptable degradation; do not add special handling.

**Refinement over the spec's literal wording:** the spec describes junk markers as a title-*contains* check and an `x2`/`x3` drop. Implemented naively those over-drop: substring `lot` matches inside "Pilotwings 64", and `x4` matches the real game "Mega Man X4". The code below uses **whole-word** junk matching (`JUNK_RE`) and **skips the quantity-multiplier rule when the game's own title contains an x-number** (`gameHasMultiplier`). This honors the spec's intent — drop junk, keep legitimate listings — without the false positives. Implement exactly as shown.

- [ ] **Step 1: Write the failing test**

Create `src/lib/sources/ebay/filter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterListings, type Listing } from './filter';

/** Build a Listing with sensible defaults; override per test. */
function listing(over: Partial<Listing> = {}): Listing {
  return { priceCents: 5000, title: 'Chrono Trigger SNES', conditionId: 3000, ...over };
}

describe('filterListings — title match', () => {
  it('keeps a listing whose title contains every significant game token', () => {
    const kept = filterListings([listing({ title: 'Chrono Trigger SNES cart only' })], { title: 'Chrono Trigger' }, 'loose');
    expect(kept).toHaveLength(1);
  });
  it('drops a listing whose title is missing a game token', () => {
    const kept = filterListings([listing({ title: 'Final Fantasy SNES' })], { title: 'Chrono Trigger' }, 'loose');
    expect(kept).toHaveLength(0);
  });
  it('matches accent-insensitively (Pokémon game vs Pokemon listing)', () => {
    const kept = filterListings(
      [listing({ title: 'Pokemon Red Version Game Boy authentic' })],
      { title: 'Pokémon Red Version' },
      'loose'
    );
    expect(kept).toHaveLength(1);
  });
});

describe('filterListings — junk exclusion', () => {
  it('drops lot, bundle, and reproduction listings', () => {
    const input = [
      listing({ title: 'Chrono Trigger SNES lot of 5' }),
      listing({ title: 'Chrono Trigger SNES game bundle' }),
      listing({ title: 'Chrono Trigger SNES repro cart' })
    ];
    expect(filterListings(input, { title: 'Chrono Trigger' }, 'loose')).toHaveLength(0);
  });
  it('drops a listing with a quantity multiplier like x3', () => {
    const kept = filterListings([listing({ title: 'Chrono Trigger SNES x3' })], { title: 'Chrono Trigger' }, 'loose');
    expect(kept).toHaveLength(0);
  });
  it('does not treat "lot" inside a word like Pilotwings as a junk marker', () => {
    const kept = filterListings(
      [listing({ title: 'Pilotwings 64 N64 authentic' })],
      { title: 'Pilotwings 64' },
      'loose'
    );
    expect(kept).toHaveLength(1);
  });
  it('keeps listings for a game whose own title has an x-number (Mega Man X4)', () => {
    const kept = filterListings(
      [listing({ title: 'Mega Man X4 complete' })],
      { title: 'Mega Man X4' },
      'cib'
    );
    expect(kept).toHaveLength(1);
  });
});

describe('filterListings — condition', () => {
  it('for new, keeps conditionId 1000 and 1500 and drops used / null', () => {
    const input = [
      listing({ title: 'Chrono Trigger SNES sealed', conditionId: 1000 }),
      listing({ title: 'Chrono Trigger SNES new', conditionId: 1500 }),
      listing({ title: 'Chrono Trigger SNES', conditionId: 3000 }),
      listing({ title: 'Chrono Trigger SNES', conditionId: null })
    ];
    expect(filterListings(input, { title: 'Chrono Trigger' }, 'new')).toHaveLength(2);
  });
  it('for loose and cib, ignores conditionId entirely', () => {
    const input = [
      listing({ title: 'Chrono Trigger SNES', conditionId: 3000 }),
      listing({ title: 'Chrono Trigger SNES', conditionId: null })
    ];
    expect(filterListings(input, { title: 'Chrono Trigger' }, 'loose')).toHaveLength(2);
    expect(filterListings(input, { title: 'Chrono Trigger' }, 'cib')).toHaveLength(2);
  });
});

describe('filterListings — price sanity', () => {
  it('drops listings far above or below the surviving median', () => {
    const input = [
      listing({ priceCents: 1000 }),
      listing({ priceCents: 1100 }),
      listing({ priceCents: 1200 }),
      listing({ priceCents: 50 }),     // far below median 1100
      listing({ priceCents: 99000 })   // far above median 1100
    ];
    const kept = filterListings(input, { title: 'Chrono Trigger' }, 'loose');
    expect(kept.map((l) => l.priceCents).sort((a, b) => a - b)).toEqual([1000, 1100, 1200]);
  });
  it('skips the price-sanity step with fewer than 3 survivors', () => {
    const input = [listing({ priceCents: 100 }), listing({ priceCents: 99000 })];
    expect(filterListings(input, { title: 'Chrono Trigger' }, 'loose')).toHaveLength(2);
  });
});

describe('filterListings — empty input', () => {
  it('returns an empty array for no listings', () => {
    expect(filterListings([], { title: 'Chrono Trigger' }, 'loose')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sources/ebay/filter.test.ts`
Expected: FAIL — `Cannot find module './filter'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/sources/ebay/filter.ts`:

```ts
// ABOUTME: Listing-quality filters — drop eBay listings that don't match the
// ABOUTME: game or condition before they reach the price estimate.
import type { Condition } from '$lib/types';

/** One eBay listing, carrying the fields the estimate pipeline needs. */
export interface Listing {
  priceCents: number;
  title: string;
  conditionId: number | null;
}

/** Words that mark a listing as junk (multi-item lots, reproductions). */
export const JUNK_MARKERS = ['lot', 'bundle', 'repro', 'reproduction', 'read description'];

/** Junk markers as one whole-word regex — so "lot" does not match inside
 *  "Pilotwings". Built once at module load. */
const JUNK_RE = new RegExp(`\\b(?:${JUNK_MARKERS.join('|')})\\b`);

/** eBay conditionIds that count as "new" for the `new` condition filter. */
const NEW_CONDITION_IDS = new Set([1000, 1500]);

/** Matches a quantity multiplier as a standalone token, e.g. "x2", "x 3". */
const QUANTITY_MULTIPLIER = /\bx\s?\d+\b/;

/** Accent-insensitive, case-insensitive normalization (NFD strip + lowercase).
 *  The character class is the combining-diacritical range U+0300–U+036F. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Keep only the listings worth pricing for this game and condition. */
export function filterListings(
  listings: Listing[],
  game: { title: string },
  condition: Condition
): Listing[] {
  const foldedGameTitle = fold(game.title);
  const tokens = foldedGameTitle.split(/\s+/).filter((t) => t.length >= 4);
  // A game whose own title contains a token like "x4" (e.g. "Mega Man X4")
  // must not have its listings dropped by the quantity-multiplier rule.
  const gameHasMultiplier = QUANTITY_MULTIPLIER.test(foldedGameTitle);

  let kept = listings.filter((l) => {
    const title = fold(l.title);
    // 1. Title match — every significant game token must appear.
    if (!tokens.every((t) => title.includes(t))) return false;
    // 2. Junk exclusion — whole-word markers, plus a quantity multiplier
    //    (skipped when the game's own title legitimately has one).
    if (JUNK_RE.test(title)) return false;
    if (!gameHasMultiplier && QUANTITY_MULTIPLIER.test(title)) return false;
    // 3. Condition — `new` requires a structured new conditionId; eBay's
    //    condition IDs cannot tell loose from cib, so those skip this gate.
    if (condition === 'new' && (l.conditionId === null || !NEW_CONDITION_IDS.has(l.conditionId))) {
      return false;
    }
    return true;
  });

  // 4. Price sanity — drop listings far from the surviving median. Skipped
  //    below 3 survivors, where a median is not a stable reference.
  if (kept.length >= 3) {
    const prices = kept.map((l) => l.priceCents).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    kept = kept.filter((l) => l.priceCents >= median * 0.1 && l.priceCents <= median * 10);
  }
  return kept;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/sources/ebay/filter.test.ts`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sources/ebay/filter.ts src/lib/sources/ebay/filter.test.ts
git commit -m "Add listing-quality filter for eBay estimates"
```

### Task 1.3: Stronger condition keywords

**Files:**
- Modify: `src/lib/sources/ebay/query.ts`
- Test: `src/lib/sources/ebay/query.test.ts`

**Discipline:** Task Discipline §A before, §B after.

**Context:** `CONDITION_KEYWORDS.loose` is currently the bare word `'loose'`, which appears in the description of many *complete* listings and is a weak signal. This task swaps in stronger keyword phrases. `query.ts:11` already comments that this is the single tuning point for query text.

- [ ] **Step 1: Update the failing test**

Replace the entire contents of `src/lib/sources/ebay/query.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { buildQuery, CONDITION_KEYWORDS } from './query';

const GAME = { title: 'Chrono Trigger', console: 'SNES' };

describe('buildQuery', () => {
  it('includes title and console', () => {
    expect(buildQuery(GAME, 'loose')).toContain('Chrono Trigger');
    expect(buildQuery(GAME, 'loose')).toContain('SNES');
  });
  it('uses strong cart/disc keywords for loose, not the bare word "loose"', () => {
    expect(buildQuery(GAME, 'loose')).toBe('Chrono Trigger SNES cart only disc only');
  });
  it('uses complete-in-box keywords for cib', () => {
    expect(buildQuery(GAME, 'cib')).toBe('Chrono Trigger SNES complete in box');
  });
  it('uses sealed keyword for new', () => {
    expect(buildQuery(GAME, 'new')).toBe('Chrono Trigger SNES sealed');
  });
});

describe('CONDITION_KEYWORDS', () => {
  it('maps each condition to its keyword string', () => {
    expect(CONDITION_KEYWORDS).toEqual({
      loose: 'cart only disc only',
      cib: 'complete in box',
      new: 'sealed'
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sources/ebay/query.test.ts`
Expected: FAIL — the loose assertion expects `cart only disc only`, current value is `loose`.

- [ ] **Step 3: Write the implementation**

In `src/lib/sources/ebay/query.ts`, replace the `CONDITION_KEYWORDS` constant (lines 5–9) with:

```ts
export const CONDITION_KEYWORDS: Record<Condition, string> = {
  loose: 'cart only disc only',
  cib: 'complete in box',
  new: 'sealed'
};
```

Leave the surrounding comment and the `buildQuery` function unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/sources/ebay/query.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sources/ebay/query.ts src/lib/sources/ebay/query.test.ts
git commit -m "Strengthen eBay condition keywords"
```

### Task 1.4: `auth.ts` throws `EbayError`

**Files:**
- Modify: `src/lib/sources/ebay/auth.ts`
- Test: `src/lib/sources/ebay/auth.test.ts`

**Discipline:** Task Discipline §A before, §B after.

**Depends on:** Task 1.1 (`EbayError`).

**Context:** `auth.ts:34` throws a plain `Error` on a non-OK token response. Switching it to `EbayError` lets the refresh loop classify an auth failure. The existing test asserts `rejects.toThrow(/eBay auth/)` — that still holds because the message is unchanged; this task adds an assertion on the new `status` field.

- [ ] **Step 1: Write the failing test**

In `src/lib/sources/ebay/auth.test.ts`, add this test inside the existing `describe('createTokenProvider', ...)` block, after the existing `'throws a clear error on auth failure'` test. Also add `EbayError` to the imports at the top: change `import { createTokenProvider } from './auth';` to keep that line and add `import { EbayError } from './errors';`.

```ts
  it('throws an EbayError carrying the HTTP status on auth failure', async () => {
    const f = vi.fn(async () => new Response('bad', { status: 401 }));
    const provider = createTokenProvider({ appId: 'id', clientSecret: 'sec', fetchFn: f, now: () => 0 });
    await expect(provider.getToken()).rejects.toBeInstanceOf(EbayError);
    await expect(provider.getToken()).rejects.toMatchObject({ status: 401, name: 'EbayError' });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sources/ebay/auth.test.ts`
Expected: FAIL — the thrown value is a plain `Error`, not an `EbayError`.

- [ ] **Step 3: Write the implementation**

In `src/lib/sources/ebay/auth.ts`:

Add the import as the first line of the file, above the existing `const TOKEN_URL` declaration:

```ts
import { EbayError } from './errors';
```

Replace the throw on the `if (!res.ok)` line:

```ts
      if (!res.ok) throw new EbayError(res.status, `eBay auth failed: ${res.status}`);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/sources/ebay/auth.test.ts`
Expected: PASS — all `createTokenProvider` tests, including the existing `/eBay auth/` assertion.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sources/ebay/auth.ts src/lib/sources/ebay/auth.test.ts
git commit -m "Throw EbayError from the eBay token provider"
```

### Task 1.5: Widen the search boundary to `Listing[]`

**Files:**
- Modify: `src/lib/sources/ebay/client.ts`
- Modify: `src/lib/sources/refresh.ts:11-12,20-26`
- Modify: `src/lib/server/ebay.ts:15-18`
- Test: `src/lib/sources/ebay/client.test.ts`
- Test: `src/lib/sources/refresh.test.ts`

**Discipline:** Task Discipline §A before, §B after.

**Depends on:** Task 1.1 (`EbayError`), Task 1.2 (`Listing`).

**Context:** This is the atomic boundary change. `searchListings` currently returns `number[]`, dropping eBay's listing title and condition. `SearchFn` is `(query) => Promise<number[]>`. After this task: `searchListings` returns `Listing[]`, throws `EbayError`, and passes `conditionIds:{1000|1500}` to the eBay API for the `new` condition; `SearchFn` becomes `(query, condition) => Promise<Listing[]>`; `estimatePair` maps `Listing[]` to prices for the unchanged `estimateFromListings`. All four production files plus the two test files must move together — a partial change breaks `npm run check`.

**Do NOT:** do not add the `filterListings` call in this task — that is Task 1.6. In this task `estimatePair` passes the raw search result straight to `estimateFromListings` (behavior stays equivalent to today). Do not add region filtering. Do not add `console.error`.

**Other callers to keep working:** `estimatePair` and `refreshEstimates` (both in `refresh.ts`) consume `SearchFn`; `server/ebay.ts` produces it. The on-add estimate path (`src/routes/api/collection/+server.ts` → `src/routes/api/collection/logic.ts`) only ever passes a `SearchFn` *through* to `estimatePair` — it never calls a search function directly — so it needs **no edit**; the widening is transparent to it. Step 9's `npm run check` confirms this across the whole project. Do NOT modify the collection route or its `logic.ts`.

- [ ] **Step 1: Update `client.test.ts` (failing test for the new return shape)**

Replace the entire contents of `src/lib/sources/ebay/client.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { searchListings } from './client';
import { EbayError } from './errors';

const SAMPLE = {
  itemSummaries: [
    { title: 'Chrono Trigger SNES loose', price: { value: '172.44', currency: 'USD' }, conditionId: '3000' },
    { title: 'Chrono Trigger cart only', price: { value: '160.00', currency: 'USD' }, conditionId: '3000' },
    { title: 'Chrono Trigger EUR', price: { value: '90.00', currency: 'EUR' }, conditionId: '3000' }
  ]
};

describe('searchListings', () => {
  it('returns USD listings with price, title, and conditionId', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 }));
    const listings = await searchListings('TOKEN', 'chrono trigger snes', 'loose', { fetchFn: f });
    expect(listings).toEqual([
      { priceCents: 17244, title: 'Chrono Trigger SNES loose', conditionId: 3000 },
      { priceCents: 16000, title: 'Chrono Trigger cart only', conditionId: 3000 }
    ]); // EUR listing dropped
  });

  it('keeps conditionId null when eBay omits it', async () => {
    const body = { itemSummaries: [{ title: 'X', price: { value: '10.00', currency: 'USD' } }] };
    const f = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    const listings = await searchListings('TOKEN', 'q', 'loose', { fetchFn: f });
    expect(listings[0].conditionId).toBeNull();
  });

  it('sends the auth token and US marketplace header', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ itemSummaries: [] }), { status: 200 }));
    await searchListings('TOKEN', 'q', 'loose', { fetchFn: f });
    const [, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe('Bearer TOKEN');
    expect(init.headers['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_US');
  });

  it('adds a conditionIds filter only for the new condition', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ itemSummaries: [] }), { status: 200 }));
    await searchListings('TOKEN', 'q', 'new', { fetchFn: f });
    const [newUrl] = f.mock.calls[0] as unknown as [string];
    expect(decodeURIComponent(newUrl)).toContain('conditionIds:{1000|1500}');

    f.mockClear();
    await searchListings('TOKEN', 'q', 'loose', { fetchFn: f });
    const [looseUrl] = f.mock.calls[0] as unknown as [string];
    expect(decodeURIComponent(looseUrl)).not.toContain('conditionIds');
  });

  it('returns an empty array when eBay reports no results', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    expect(await searchListings('TOKEN', 'q', 'loose', { fetchFn: f })).toEqual([]);
  });

  it('throws an EbayError carrying the status on a non-200 response', async () => {
    const f = vi.fn(async () => new Response('err', { status: 500 }));
    await expect(searchListings('TOKEN', 'q', 'loose', { fetchFn: f })).rejects.toBeInstanceOf(EbayError);
    await expect(searchListings('TOKEN', 'q', 'loose', { fetchFn: f })).rejects.toMatchObject({ status: 500 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sources/ebay/client.test.ts`
Expected: FAIL — `searchListings` returns `number[]` and its signature has no `condition` parameter.

- [ ] **Step 3: Rewrite `client.ts`**

Replace the entire contents of `src/lib/sources/ebay/client.ts` with:

```ts
// ABOUTME: eBay Browse API search client — calls item_summary/search and
// ABOUTME: shapes the response into Listing[]; throws EbayError on failure.
import type { Condition } from '$lib/types';
import { EbayError } from './errors';
import type { Listing } from './filter';

const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const VIDEO_GAME_CATEGORY = '139973';

export interface SearchOptions {
  limit?: number;
  fetchFn?: typeof fetch;
}

interface ItemSummary {
  title?: string;
  price?: { value?: string; currency?: string };
  conditionId?: string;
}

/** Search eBay active Buy-It-Now listings for a game in a condition. */
export async function searchListings(
  token: string,
  query: string,
  condition: Condition,
  opts: SearchOptions = {}
): Promise<Listing[]> {
  const fetchFn = opts.fetchFn ?? fetch;
  const filters = ['buyingOptions:{FIXED_PRICE}'];
  if (condition === 'new') filters.push('conditionIds:{1000|1500}');
  const params = new URLSearchParams({
    q: query,
    category_ids: VIDEO_GAME_CATEGORY,
    filter: filters.join(','),
    limit: String(opts.limit ?? 50)
  });
  const res = await fetchFn(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }
  });
  if (!res.ok) throw new EbayError(res.status, `eBay search failed: ${res.status}`);
  const body = (await res.json()) as { itemSummaries?: ItemSummary[] };
  const summaries = body.itemSummaries ?? [];

  const listings: Listing[] = [];
  for (const s of summaries) {
    if (s.price?.currency !== 'USD') continue;
    const value = Number(s.price.value);
    if (!Number.isFinite(value) || value < 0) continue;
    const rawCondition = s.conditionId !== undefined ? Number(s.conditionId) : NaN;
    listings.push({
      priceCents: Math.round(value * 100),
      title: s.title ?? '',
      conditionId: Number.isFinite(rawCondition) ? rawCondition : null
    });
  }
  return listings;
}
```

- [ ] **Step 4: Run the client test to verify it passes**

Run: `npx vitest run src/lib/sources/ebay/client.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Update `refresh.test.ts` fakes for the widened `SearchFn`**

In `src/lib/sources/refresh.test.ts`, the `SearchFn` fakes currently return `number[]`. They must return `Listing[]`. Write each fake to echo the `query` argument into the listing `title` — `query` is `buildQuery(game, condition)`, which contains the game title, so the listings will survive the filter added in Task 1.6.

Replace the two tests in the `describe('estimatePair', ...)` block with:

```ts
  it('searches eBay and writes a price estimate for one (game, condition)', async () => {
    const db = seed();
    const search = vi.fn(async (q: string) => [
      { priceCents: 5000, title: q, conditionId: 3000 },
      { priceCents: 6000, title: q, conditionId: 3000 },
      { priceCents: 7000, title: q, conditionId: 3000 }
    ]);
    await estimatePair(db, { gameId: 1, condition: 'loose' }, search);
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(6000);
    expect(search).toHaveBeenCalledOnce();
  });

  it('writes a null estimate when eBay returns nothing', async () => {
    const db = seed();
    await estimatePair(db, { gameId: 1, condition: 'new' }, async () => []);
    expect(getEstimate(db, 1, 'new')?.estimate).toBeNull();
  });
```

In the `describe('refreshEstimates', ...)` block, replace the `search` fake in the first test (`'re-estimates every owned pair...'`) and the `'skips owned pairs whose item has a manual price'` test so both return `Listing[]`:

```ts
  it('re-estimates every owned pair, snapshots them, and records the event', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const search = vi.fn(async (q: string) => [
      { priceCents: 4000, title: q, conditionId: 3000 },
      { priceCents: 4200, title: q, conditionId: 3000 }
    ]); // → median 4100
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
    const search = vi.fn(async (q: string) => [{ priceCents: 1000, title: q, conditionId: 3000 }]);
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(search).not.toHaveBeenCalled();
    expect(result.itemsUpdated).toBe(0);
  });
```

The `'counts an error and continues when one search throws'` test must also have its fake updated to return `Listing[]` — its current `return [3000];` is a `number[]` and will fail `npm run check` under the widened `SearchFn`. Replace that test's `search` fake with:

```ts
    const search = vi.fn(async (q: string) => {
      call++;
      if (call === 1) throw new Error('rate limited');
      return [{ priceCents: 3000, title: q, conditionId: 3000 }];
    });
```

Leave the rest of that test (its assertions) unchanged here — Task 2.2 replaces the whole test later.

- [ ] **Step 6: Run `refresh.test.ts` to verify it fails**

Run: `npx vitest run src/lib/sources/refresh.test.ts`
Expected: FAIL — the old `estimatePair` passes the fakes' `Listing[]` objects straight to `estimateFromListings`, which sorts them numerically into garbage, so the estimate assertions (e.g. `toBe(6000)`) fail. (Vitest strips types, so this surfaces as a runtime assertion failure, not a type error — `npm run check` would additionally flag the type mismatch.)

- [ ] **Step 7: Update `refresh.ts`**

In `src/lib/sources/refresh.ts`:

Replace the import block and `SearchFn` type (lines 1–12) so `Condition` and `Listing` are imported and `SearchFn` is widened. The new top of the file:

```ts
import { asc, eq, isNull } from 'drizzle-orm';
import type { DB } from '$lib/db/client';
import { collectionItems, refreshEvents } from '$lib/db/schema';
import { getGame } from '$lib/db/queries/games';
import { getEstimate, upsertEstimate } from '$lib/db/queries/prices';
import { createRefreshEvent, insertSnapshot } from '$lib/db/queries/refresh';
import { estimateFromListings } from './ebay/estimate';
import { buildQuery } from './ebay/query';
import type { Listing } from './ebay/filter';
import type { Condition } from '$lib/types';

/** Runs an eBay search for a query + condition, returning matching listings. */
export type SearchFn = (query: string, condition: Condition) => Promise<Listing[]>;
```

Replace `estimatePair` (the function body around lines 20–26) with:

```ts
/** Estimate one (game, condition) pair and persist the estimate. */
export async function estimatePair(db: DB, pair: Pair, search: SearchFn): Promise<void> {
  const game = getGame(db, pair.gameId);
  if (!game) return;
  const condition = pair.condition as Condition;
  const listings = await search(buildQuery(game, condition), condition);
  const { estimate, listingCount } = estimateFromListings(listings.map((l) => l.priceCents));
  upsertEstimate(db, { gameId: pair.gameId, condition, estimate, listingCount });
}
```

Leave `refreshEstimates`, `pairsToRefresh`, `Pair`, `RefreshOptions`, and `RefreshResult` unchanged in this task.

- [ ] **Step 8: Update `server/ebay.ts`**

In `src/lib/server/ebay.ts`, the returned `SearchFn` must accept and forward `condition`. Add the `Condition` import and update the closure.

Add to the imports at the top:

```ts
import type { Condition } from '$lib/types';
```

Replace the returned function inside `ebaySearch` (currently lines 15–18) with:

```ts
  return async (query: string, condition: Condition) => {
    const token = await provider!.getToken();
    return searchListings(token, query, condition);
  };
```

`optionalEbaySearch` is unchanged — it returns `ebaySearch()` and inherits the new signature.

- [ ] **Step 9: Run the full suite and type check**

Run: `npx vitest run`
Expected: PASS — all tests, including `refresh.test.ts` and `client.test.ts`.

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 10: Commit**

```bash
git add src/lib/sources/ebay/client.ts src/lib/sources/ebay/client.test.ts src/lib/sources/refresh.ts src/lib/sources/refresh.test.ts src/lib/server/ebay.ts
git commit -m "Widen the eBay search boundary to carry listing metadata"
```

### Task 1.6: Filter listings inside `estimatePair`

**Files:**
- Modify: `src/lib/sources/refresh.ts` (`estimatePair`)
- Test: `src/lib/sources/refresh.test.ts`

**Discipline:** Task Discipline §A before, §B after.

**Depends on:** Task 1.2 (`filterListings`), Task 1.5 (widened `SearchFn`).

**Context:** Task 1.5 left `estimatePair` passing the raw search result to `estimateFromListings`. This task inserts the `filterListings` step so junk listings never reach the median.

- [ ] **Step 1: Write the failing test**

In `src/lib/sources/refresh.test.ts`, add this test inside the `describe('estimatePair', ...)` block, after the existing two tests:

```ts
  it('drops listings that do not match the game before estimating', async () => {
    const db = seed();
    // game 1 is "Chrono Trigger" (see seed()). One matching listing, one junk.
    const search = vi.fn(async (q: string) => [
      { priceCents: 5000, title: q, conditionId: 3000 },                       // matches
      { priceCents: 999999, title: 'Unrelated Game SNES lot', conditionId: 3000 } // junk: wrong title + "lot"
    ]);
    await estimatePair(db, { gameId: 1, condition: 'loose' }, search);
    const e = getEstimate(db, 1, 'loose');
    expect(e?.estimate).toBe(5000);   // junk listing excluded — not a 2-item median
    expect(e?.listingCount).toBe(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sources/refresh.test.ts`
Expected: FAIL — `estimatePair` does not filter yet, so `estimateFromListings` sees both prices and `listingCount` is 2 (estimate `502499`, the averaged median of 5000 and 999999).

- [ ] **Step 3: Write the implementation**

In `src/lib/sources/refresh.ts`, add a value import for `filterListings` alongside the other `./ebay/*` imports. The existing `import type { Listing } from './ebay/filter';` line stays exactly as-is; add this as a separate line:

```ts
import { filterListings } from './ebay/filter';
```

Then update `estimatePair` to filter before estimating:

```ts
/** Estimate one (game, condition) pair and persist the estimate. */
export async function estimatePair(db: DB, pair: Pair, search: SearchFn): Promise<void> {
  const game = getGame(db, pair.gameId);
  if (!game) return;
  const condition = pair.condition as Condition;
  const listings = await search(buildQuery(game, condition), condition);
  const kept = filterListings(listings, game, condition);
  const { estimate, listingCount } = estimateFromListings(kept.map((l) => l.priceCents));
  upsertEstimate(db, { gameId: pair.gameId, condition, estimate, listingCount });
}
```

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `npx vitest run src/lib/sources/refresh.test.ts`
Expected: PASS — including the existing `refreshEstimates` tests (their fakes echo the query into the title, so filtered listings survive).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sources/refresh.ts src/lib/sources/refresh.test.ts
git commit -m "Filter mismatched listings before computing an estimate"
```

### Phase 1 group review

After completing Tasks 1.1–1.6:

```
Review the batch from multiple perspectives. Minimum 3 review rounds.
If round 3 still finds issues, keep going until clean.
```

Review dimensions specific to this phase:
- **Boundary consistency:** `Listing` is the single boundary type — `client.ts`, `refresh.ts`, `server/ebay.ts` all agree on its shape. No file still references `number[]` as a search result.
- **CVT-1:** every price stays integer cents through `searchListings` (`Math.round`), `filterListings`, and `estimateFromListings`.
- **CVT-T1:** no test reaches the network — all use `vi.fn` fakes.
- **Filter correctness:** re-read `filter.ts` against the spec's four-step order. Confirm the price-sanity skip-below-3 rule and the `new`-requires-conditionId rule.
- Run `npx vitest run` and `npm run check` — both clean.

When the phase ships, update this phase's **Execution Status** banner and the top-of-plan table per the Living Document Contract.

---

## Phase 2 — Refresh Error Surfacing

**Execution Status:** ⬜ NOT STARTED

Goal of this phase: a failed refresh tells the user *why* — live and in history — and a fatal error stops the run instead of burning quota.

### Task 2.1: `error_summary` column on `refresh_events`

**Files:**
- Modify: `src/lib/db/schema.ts:24-30`
- Create: a generated migration in `drizzle/`
- Test: `src/lib/db/schema.test.ts`

**Discipline:** Task Discipline §A before, §B after. Note: generating the migration file (`drizzle-kit generate`) is codegen and is exempt from TDD; the schema edit and its round-trip test are not.

**Context:** `refresh_events` records only an error *count*. This task adds a nullable `error_summary` text column so the "Recent refreshes" history can explain past failures. `makeTestDb` in `test-db.ts` applies migrations from `./drizzle`, so a generated migration auto-applies in tests.

- [ ] **Step 1: Write the failing test**

In `src/lib/db/schema.test.ts`, add `refreshEvents` to the schema import on line 3:

```ts
import { games, collectionItems, priceEstimates, refreshEvents } from './schema';
```

Add this test inside the existing `describe('schema', ...)` block:

```ts
  it('stores a nullable error summary on a refresh event', () => {
    const db = makeTestDb();
    db.insert(refreshEvents).values({ triggeredAt: new Date(), source: 'ebay_browse' }).run();
    expect(db.select().from(refreshEvents).get()?.errorSummary).toBeNull();

    db.insert(refreshEvents)
      .values({ triggeredAt: new Date(), source: 'ebay_browse', errorSummary: 'rate_limit×1 (aborted)' })
      .run();
    const rows = db.select().from(refreshEvents).all();
    expect(rows.map((r) => r.errorSummary)).toContain('rate_limit×1 (aborted)');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/db/schema.test.ts`
Expected: FAIL — `errorSummary` is not a property of `refreshEvents`.

- [ ] **Step 3: Add the column to the schema**

In `src/lib/db/schema.ts`, replace the `refreshEvents` table definition (lines 24–30) with:

```ts
export const refreshEvents = sqliteTable('refresh_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  triggeredAt: integer('triggered_at', { mode: 'timestamp' }).notNull(),
  source: text('source').notNull(),
  itemsUpdated: integer('items_updated').notNull().default(0),
  errors: integer('errors').notNull().default(0),
  errorSummary: text('error_summary')
});
```

`text` is already imported on line 1. The nullable column has no `.notNull()`.

- [ ] **Step 4: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new file `drizzle/NNNN_<name>.sql` is created containing
`ALTER TABLE \`refresh_events\` ADD \`error_summary\` text;`. Open the file and confirm it contains exactly that ALTER and no other table changes. If the generator reports no changes, the schema edit was not saved — re-check Step 3.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/db/schema.test.ts`
Expected: PASS — `makeTestDb` applies the new migration; `errorSummary` round-trips and defaults to `null`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/schema.test.ts drizzle/
git commit -m "Add error_summary column to refresh_events"
```

### Task 2.2: Abort-on-fatal refresh loop with categorized errors

**Files:**
- Modify: `src/lib/sources/refresh.ts` (`RefreshResult`, `refreshEstimates`)
- Modify: `src/lib/db/queries/refresh.ts` (add `updateRefreshEvent`)
- Test: `src/lib/sources/refresh.test.ts`

**Discipline:** Task Discipline §A before, §B after.

**Depends on:** Task 1.1 (`classifyError`, `EbayError`, `ErrorReason`), Task 1.6 (settled `refresh.ts`), Task 2.1 (`error_summary` column).

**Context:** `refreshEstimates` wraps each pair in a bare `catch {}` that increments an `errors` count and discards the reason (`refresh.ts:80-82`). This task classifies each failure, aborts the run on `auth`/`rate_limit`, counts `other` errors and continues, and persists a categorized `error_summary`. The current update of the refresh event is an inline `db.update(...)` (`refresh.ts:86`); this task moves it into a `updateRefreshEvent` query function so the query layer owns the `error_summary` write.

**Do NOT:** do not add retry or backoff logic — a fatal error simply aborts. Do not add `console.error`. Do not change `pairsToRefresh`, `estimatePair`, `createRefreshEvent`, or snapshot behavior.

- [ ] **Step 1: Write the failing tests**

In `src/lib/sources/refresh.test.ts`, add `EbayError` to the imports at the top:

```ts
import { EbayError } from './ebay/errors';
```

Add `latestRefreshEvent` to the existing `$lib/db/queries/refresh` import — if there is no such import line, add one:

```ts
import { latestRefreshEvent } from '$lib/db/queries/refresh';
```

Replace the existing `'counts an error and continues when one search throws'` test with the following four tests (the old test's intent is preserved by the first one, with a clearer name and a non-fatal error):

```ts
  it('counts a non-fatal error and continues to the next pair', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    let call = 0;
    const search = vi.fn(async (q: string) => {
      call++;
      if (call === 1) throw new Error('network blip'); // plain Error → classified 'other'
      return [{ priceCents: 3000, title: q, conditionId: 3000 }];
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.errors).toBe(1);
    expect(result.errorsByReason).toEqual({ auth: 0, rate_limit: 0, other: 1 });
    expect(result.aborted).toBe(false);
    expect(result.itemsUpdated).toBe(1);
  });

  it('aborts the whole run when a search hits a rate limit', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    let call = 0;
    const search = vi.fn(async (q: string) => {
      call++;
      if (call === 1) throw new EbayError(429, 'eBay search failed: 429');
      return [{ priceCents: 3000, title: q, conditionId: 3000 }];
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.aborted).toBe(true);
    expect(result.errorsByReason.rate_limit).toBe(1);
    expect(search).toHaveBeenCalledTimes(1);            // second pair never attempted
    expect(getEstimate(db, 2, 'cib')).toBeUndefined();  // later pair left untouched
  });

  it('aborts the whole run on an auth failure', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const search = vi.fn(async () => {
      throw new EbayError(401, 'eBay search failed: 401');
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.aborted).toBe(true);
    expect(result.errorsByReason.auth).toBe(1);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('persists an error summary for a failed run and null for a clean run', async () => {
    const cleanDb = seed();
    addItem(cleanDb, { gameId: 1, condition: 'loose' });
    await refreshEstimates(cleanDb, {
      search: async (q: string) => [{ priceCents: 3000, title: q, conditionId: 3000 }],
      onProgress: () => {}
    });
    expect(latestRefreshEvent(cleanDb)?.errorSummary).toBeNull();

    const failDb = seed();
    addItem(failDb, { gameId: 1, condition: 'loose' });
    await refreshEstimates(failDb, {
      search: async () => {
        throw new EbayError(429, 'eBay search failed: 429');
      },
      onProgress: () => {}
    });
    expect(latestRefreshEvent(failDb)?.errorSummary).toBe('rate_limit×1 (aborted)');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/sources/refresh.test.ts`
Expected: FAIL — `RefreshResult` has no `errorsByReason` or `aborted`; `updateRefreshEvent` does not exist; `error_summary` is never written.

- [ ] **Step 3: Add `updateRefreshEvent` to the query layer**

In `src/lib/db/queries/refresh.ts`, add this function after `createRefreshEvent` (the `eq` and `refreshEvents` symbols are already imported on lines 1 and 3):

```ts
export interface RefreshEventUpdate {
  itemsUpdated: number;
  errors: number;
  errorSummary: string | null;
}

/** Write the final tallies onto a refresh event when a run finishes. */
export function updateRefreshEvent(db: DB, id: number, u: RefreshEventUpdate): void {
  db.update(refreshEvents).set(u).where(eq(refreshEvents.id, id)).run();
}
```

- [ ] **Step 4: Rewrite `refreshEstimates` in `refresh.ts`**

In `src/lib/sources/refresh.ts`:

Add to the imports — `classifyError` and `ErrorReason` from the errors module, and `updateRefreshEvent` into the existing `./queries/refresh` import:

```ts
import { createRefreshEvent, insertSnapshot, updateRefreshEvent } from '$lib/db/queries/refresh';
```

```ts
import { classifyError, type ErrorReason } from './ebay/errors';
```

The `import { collectionItems, refreshEvents } from '$lib/db/schema';` line no longer needs `refreshEvents` (the inline `db.update` is being removed) and `eq` is no longer used by this file. Change line 1 and line 3 to:

```ts
import { asc, isNull } from 'drizzle-orm';
```
```ts
import { collectionItems } from '$lib/db/schema';
```

Replace the `RefreshResult` interface with:

```ts
export interface RefreshResult {
  itemsUpdated: number;
  errors: number;
  errorsByReason: Record<ErrorReason, number>;
  aborted: boolean;
  refreshEventId: number;
}
```

Add this private helper above `refreshEstimates`:

```ts
/** Compact human summary of a run's failures, or null when there were none. */
function summarizeErrors(byReason: Record<ErrorReason, number>, aborted: boolean): string | null {
  const parts = (['auth', 'rate_limit', 'other'] as const)
    .filter((r) => byReason[r] > 0)
    .map((r) => `${r}×${byReason[r]}`);
  if (parts.length === 0) return null;
  return parts.join('; ') + (aborted ? ' (aborted)' : '');
}
```

Replace the whole `refreshEstimates` function with:

```ts
/** Re-estimate every owned pair, snapshot changed estimates, record one refresh event. */
export async function refreshEstimates(db: DB, opts: RefreshOptions): Promise<RefreshResult> {
  const pairs = pairsToRefresh(db);
  const eventId = createRefreshEvent(db, { source: `ebay_browse:${new Date().toISOString()}`, itemsUpdated: 0, errors: 0 });

  let itemsUpdated = 0;
  const errorsByReason: Record<ErrorReason, number> = { auth: 0, rate_limit: 0, other: 0 };
  let aborted = false;

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
    } catch (e) {
      const reason = classifyError(e);
      errorsByReason[reason]++;
      // auth and rate_limit are fatal — continuing burns quota and fails
      // every remaining pair. Stop the run; later pairs keep their estimates.
      if (reason === 'auth' || reason === 'rate_limit') {
        aborted = true;
        opts.onProgress(i + 1, pairs.length);
        break;
      }
    }
    opts.onProgress(i + 1, pairs.length);
  }

  const errors = errorsByReason.auth + errorsByReason.rate_limit + errorsByReason.other;
  updateRefreshEvent(db, eventId, { itemsUpdated, errors, errorSummary: summarizeErrors(errorsByReason, aborted) });
  return { itemsUpdated, errors, errorsByReason, aborted, refreshEventId: eventId };
}
```

- [ ] **Step 5: Run the full suite and type check**

Run: `npx vitest run`
Expected: PASS — all tests, including the four new `refreshEstimates` tests.

Run: `npm run check`
Expected: 0 errors, 0 warnings (confirms `eq` / `refreshEvents` are no longer dangling imports in `refresh.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/sources/refresh.ts src/lib/sources/refresh.test.ts src/lib/db/queries/refresh.ts
git commit -m "Classify refresh failures and abort the run on fatal errors"
```

### Task 2.3: Surface refresh outcomes in Settings

**Files:**
- Modify: `src/routes/settings/+page.svelte`
- Test: `src/routes/settings/page.test.ts`

**Discipline:** Task Discipline §A before, §B after.

**Depends on:** Task 2.1 (`error_summary` reaches `refreshHistory`), Task 2.2 (`RefreshResult` has `errorsByReason` + `aborted`).

**Context:** The refresh button calls a generic `run()` helper that does `message = JSON.stringify(body)` then `location.reload()` — the reload wipes the message, so today a refresh gives no readable feedback. This task replaces `run()` with a refresh-specific handler: on a clean run it reloads (fresh page data); on an aborted or partly-failed run it stays and shows a categorized message. It also renders `error_summary` on each "Recent refreshes" history row.

**Do NOT:** do not change `src/routes/api/refresh/+server.ts` — it already returns the full `RefreshResult` as JSON and the new fields ride along. Do not change `src/routes/settings/+page.server.ts` — `listRefreshEvents` already selects all columns, so `errorSummary` is already in `refreshHistory`. Do not touch the `syncCatalog` handler.

- [ ] **Step 1: Write the failing test**

In `src/routes/settings/page.test.ts`, add this test inside the existing `describe('settings page', ...)` block. It renders a refresh-history row that carries an `errorSummary` and asserts the summary is shown:

```ts
  it('shows the error summary on a refresh history row', () => {
    const withHistory = {
      ...data,
      refreshHistory: [
        {
          id: 1,
          triggeredAt: new Date('2026-05-20T10:00:00Z'),
          source: 'ebay_browse',
          itemsUpdated: 5,
          errors: 2,
          errorSummary: 'rate_limit×1; other×1 (aborted)'
        }
      ]
    };
    const { getByText } = render(Page, { props: { data: withHistory } });
    expect(getByText(/rate_limit×1; other×1 \(aborted\)/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/settings/page.test.ts`
Expected: FAIL — the history `<li>` renders only `itemsUpdated` and `errors`, not `errorSummary`.

- [ ] **Step 3: Update `+page.svelte`**

In `src/routes/settings/+page.svelte`:

(a) Add a `RefreshResult` type import at the top of the `<script>` block, below the existing `import type { PageData }` line:

```ts
  import type { RefreshResult } from '$lib/sources/refresh';
```

(b) Replace the generic `run` function (the `async function run(url, setBusy) { ... }` block) with a refresh-specific handler and a message builder:

```ts
  function refreshMessage(r: RefreshResult): string {
    if (r.aborted) {
      const reason = r.errorsByReason.auth > 0 ? 'an authentication error' : 'a rate limit';
      return `Refresh aborted after ${reason} — ${r.itemsUpdated} estimate(s) changed before stopping.`;
    }
    if (r.errors > 0) {
      return `Refresh complete — ${r.itemsUpdated} changed, ${r.errors} failed.`;
    }
    return `Refresh complete — ${r.itemsUpdated} estimate(s) changed.`;
  }

  async function runRefresh() {
    refreshing = true;
    message = '';
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? 'failed');
      // Clean run: reload so counts and history update. Failed/aborted run:
      // stay on the page and show the categorized message.
      if (body.aborted || body.errors > 0) {
        message = refreshMessage(body);
      } else {
        location.reload();
      }
    } catch (e) {
      message = e instanceof Error ? e.message : 'error';
    } finally {
      refreshing = false;
    }
  }
```

(c) Update the "Refresh estimates" button's `onclick` (currently `onclick={() => run('/api/refresh', (b) => (refreshing = b))}`) to:

```svelte
  <button onclick={runRefresh} disabled={refreshing}>
    {refreshing ? 'Refreshing…' : 'Refresh estimates'}
  </button>
```

(d) Update the "Recent refreshes" history `<li>` to render `errorSummary` when present. Replace the existing line:

```svelte
        <li>{e.triggeredAt.toLocaleString()} — {e.itemsUpdated} updated, {e.errors} errors</li>
```

with:

```svelte
        <li>
          {e.triggeredAt.toLocaleString()} — {e.itemsUpdated} updated, {e.errors} errors{#if e.errorSummary} — {e.errorSummary}{/if}
        </li>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/routes/settings/page.test.ts`
Expected: PASS — all settings-page tests, including the new history-summary test.

- [ ] **Step 5: Run the full suite and type check**

Run: `npx vitest run`
Expected: PASS — whole suite.

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/routes/settings/+page.svelte src/routes/settings/page.test.ts
git commit -m "Show categorized refresh outcomes in Settings"
```

### Phase 2 group review

After completing Tasks 2.1–2.3:

```
Review the batch from multiple perspectives. Minimum 3 review rounds.
If round 3 still finds issues, keep going until clean.
```

Review dimensions specific to this phase:
- **Abort semantics:** confirm a fatal error stops the loop with `break` and that `onProgress` is still called for the failing pair. Confirm later pairs are left untouched (no `priceEstimates` row created).
- **Summary string:** `summarizeErrors` returns `null` for a clean run and `"<reason>×N; ... (aborted)"` for a failed one; the fatal reason count is always 1.
- **No dangling imports:** `refresh.ts` no longer imports `eq` or `refreshEvents` — `npm run check` confirms.
- **CVT-T2:** the new refresh tests await rejected mock promises; no sleeps.
- **Pristine output:** thrown `EbayError`s are caught inside `refreshEstimates`; the suite produces no stray stderr. No `console.error` was added anywhere.
- Run `npx vitest run` and `npm run check` — both clean.

When the phase ships, update this phase's **Execution Status** banner and the top-of-plan table per the Living Document Contract.

---

## Final Review

After both phases ship, dispatch a final code review over the whole change set (Tasks 1.1–2.3): boundary-type consistency, spec coverage, pitfalls compliance (CVT-1, CVT-T1, CVT-T2), and test completeness. Then use `superpowers:finishing-a-development-branch`.

## Spec Coverage Map

| Spec section | Task(s) |
|---|---|
| Part 1 — widened pipeline / `Listing` type | 1.2, 1.5 |
| Part 1 — `filterListings` (4 filter steps) | 1.2, 1.6 |
| Part 1 — query construction / keywords | 1.3 |
| Part 1 — `conditionIds` for `new` at the API | 1.5 |
| Part 2 — typed `EbayError` + `classifyError` | 1.1, 1.4, 1.5 |
| Part 2 — abort-on-fatal loop, `errorsByReason`, `aborted` | 2.2 |
| Part 2 — `refresh_events.error_summary` + migration | 2.1 |
| Part 2 — `updateRefreshEvent` writes the summary | 2.2 |
| Part 2 — Settings message + history rendering | 2.3 |
| Testing section | every task's tests |
