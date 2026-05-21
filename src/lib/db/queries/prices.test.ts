import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../test-db';
import { upsertGames } from './games';
import { addItem, updateItem } from './collection';
import { upsertEstimate, getEstimate, estimateMap, resolveItemValue, collectionTotalCents } from './prices';

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

describe('collectionTotalCents', () => {
  it('sums manual prices and estimates, skipping unvalued items', () => {
    const db = makeTestDb();
    upsertGames(db, [
      { id: 1, console: 'SNES', title: 'A', region: null, releaseYear: null },
      { id: 2, console: 'N64', title: 'B', region: null, releaseYear: null },
      { id: 3, console: 'SNES', title: 'C', region: null, releaseYear: null }
    ]);
    addItem(db, { gameId: 1, condition: 'loose' });
    const manualId = addItem(db, { gameId: 2, condition: 'cib' });
    addItem(db, { gameId: 3, condition: 'loose' }); // no estimate, no manual → unvalued
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 5000, listingCount: 3 });
    updateItem(db, manualId, { manualPrice: 9000 });

    expect(collectionTotalCents(db)).toBe(14000); // 5000 estimate + 9000 manual
  });

  it('returns 0 for an empty collection', () => {
    expect(collectionTotalCents(makeTestDb())).toBe(0);
  });
});
