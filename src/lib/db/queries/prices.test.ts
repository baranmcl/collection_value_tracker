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
