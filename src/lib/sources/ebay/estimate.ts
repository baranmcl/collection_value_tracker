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
