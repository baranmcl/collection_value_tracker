import { describe, it, expect, vi } from 'vitest';
import { addCollectionItem } from './logic';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { listCollection } from '$lib/db/queries/collection';
import { getEstimate } from '$lib/db/queries/prices';

describe('addCollectionItem', () => {
  it('adds the item then estimates its price', async () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    const search = vi.fn(async () => [1000, 2000, 3000]);
    const res = await addCollectionItem(db, { gameId: 1, condition: 'loose' }, search);
    expect(res.itemId).toBeTypeOf('number');
    expect(listCollection(db)).toHaveLength(1);
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(2000);
  });

  it('rejects an invalid condition', async () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    await expect(
      addCollectionItem(db, { gameId: 1, condition: 'broken' as never }, async () => [])
    ).rejects.toThrow(/condition/i);
  });

  it('still adds the item when no search function is configured', async () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    const res = await addCollectionItem(db, { gameId: 1, condition: 'loose' }, null);
    expect(res.itemId).toBeTypeOf('number');
    expect(listCollection(db)).toHaveLength(1);
    expect(getEstimate(db, 1, 'loose')).toBeUndefined();
  });

  it('still adds the item when the eBay search throws', async () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    const failing = async () => { throw new Error('eBay down'); };
    const res = await addCollectionItem(db, { gameId: 1, condition: 'loose' }, failing);
    expect(res.itemId).toBeTypeOf('number');
    expect(listCollection(db)).toHaveLength(1);
  });
});
