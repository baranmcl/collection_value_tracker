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
