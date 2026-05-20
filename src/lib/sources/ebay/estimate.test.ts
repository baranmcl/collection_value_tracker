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
