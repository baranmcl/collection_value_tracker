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
