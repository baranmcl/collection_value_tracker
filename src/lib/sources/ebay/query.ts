// ABOUTME: eBay search-query construction — combines game title, console, and
// ABOUTME: per-condition keywords into the Browse API query string.
import type { Condition } from '$lib/types';

/** Condition keyword map — the single place to tune estimate accuracy
 *  (spec Open Verification Item #3). */
export const CONDITION_KEYWORDS: Record<Condition, string> = {
  loose: 'cart only disc only',
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
