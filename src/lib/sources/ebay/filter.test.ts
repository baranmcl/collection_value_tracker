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
  it('drops a "read description" listing', () => {
    const kept = filterListings(
      [listing({ title: 'Chrono Trigger SNES read description' })],
      { title: 'Chrono Trigger' },
      'loose'
    );
    expect(kept).toHaveLength(0);
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
      listing({ priceCents: 50 }),
      listing({ priceCents: 99000 })
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
