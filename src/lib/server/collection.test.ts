import { describe, it, expect } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, updateItem } from '$lib/db/queries/collection';
import { upsertEstimate } from '$lib/db/queries/prices';
import { enrichedCollection } from './collection';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [
    { id: 1, console: 'SNES', title: 'Estimate Game', region: null, releaseYear: 1995 },
    { id: 2, console: 'N64', title: 'Manual Game', region: null, releaseYear: 1997 },
    { id: 3, console: 'GBA', title: 'Unknown Game', region: null, releaseYear: 2002 }
  ]);
  return db;
}

describe('enrichedCollection', () => {
  it('resolves an estimate-valued item with its estimate metadata', () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 4200, listingCount: 5 });
    const item = enrichedCollection(db).find((i) => i.gameId === 1)!;
    expect(item.value).toBe(4200);
    expect(item.valueSource).toBe('estimate');
    expect(item.estimatedAt).toBeInstanceOf(Date);
    expect(item.listingCount).toBe(5);
  });

  it('gives a manual-priced item no estimate metadata even if an estimate exists', () => {
    const db = seed();
    const id = addItem(db, { gameId: 2, condition: 'cib' });
    updateItem(db, id, { manualPrice: 9000 });
    upsertEstimate(db, { gameId: 2, condition: 'cib', estimate: 1111, listingCount: 8 });
    const item = enrichedCollection(db).find((i) => i.gameId === 2)!;
    expect(item.value).toBe(9000);
    expect(item.valueSource).toBe('manual');
    expect(item.estimatedAt).toBeNull();
    expect(item.listingCount).toBeNull();
  });

  it('marks an item with neither a manual price nor an estimate as unknown', () => {
    const db = seed();
    addItem(db, { gameId: 3, condition: 'new' });
    const item = enrichedCollection(db).find((i) => i.gameId === 3)!;
    expect(item.value).toBeNull();
    expect(item.valueSource).toBe('unknown');
    expect(item.estimatedAt).toBeNull();
    expect(item.listingCount).toBeNull();
  });

  it('treats an estimate row with a null value as unknown, carrying no metadata', () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    // An estimate row can exist with a null value (e.g. zero qualifying listings).
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: null, listingCount: 0 });
    const item = enrichedCollection(db).find((i) => i.gameId === 1)!;
    expect(item.value).toBeNull();
    expect(item.valueSource).toBe('unknown');
    expect(item.estimatedAt).toBeNull();
    expect(item.listingCount).toBeNull();
  });
});
