import { describe, it, expect } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, listCollection } from '$lib/db/queries/collection';
import { applyItemUpdate } from './logic';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
  return db;
}

describe('applyItemUpdate', () => {
  it('parses a manual dollar price into integer cents', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    applyItemUpdate(db, id, { manualPriceInput: '49.99', grade: 'good' });
    const item = listCollection(db).find((r) => r.id === id)!;
    expect(item.manualPrice).toBe(4999);
    expect(item.grade).toBe('good');
  });

  it('clears the manual price when the input is blank', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    applyItemUpdate(db, id, { manualPriceInput: '50' });
    applyItemUpdate(db, id, { manualPriceInput: '' });
    expect(listCollection(db).find((r) => r.id === id)!.manualPrice).toBeNull();
  });

  it('rejects an invalid condition', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    expect(() => applyItemUpdate(db, id, { condition: 'bad' })).toThrow(/condition/i);
  });

  it('rejects an invalid manual price instead of silently clearing it', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    expect(() => applyItemUpdate(db, id, { manualPriceInput: 'abc' })).toThrow(/price/i);
  });
});
