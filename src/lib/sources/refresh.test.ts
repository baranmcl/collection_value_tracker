import { describe, it, expect, vi } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, updateItem } from '$lib/db/queries/collection';
import { getEstimate } from '$lib/db/queries/prices';
import { estimatePair, refreshEstimates } from './refresh';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [
    { id: 1, console: 'SNES', title: 'Chrono Trigger', region: null, releaseYear: null },
    { id: 2, console: 'N64', title: 'GoldenEye', region: null, releaseYear: null }
  ]);
  return db;
}

describe('estimatePair', () => {
  it('searches eBay and writes a price estimate for one (game, condition)', async () => {
    const db = seed();
    const search = vi.fn(async () => [5000, 6000, 7000]); // deterministic resolved mock
    await estimatePair(db, { gameId: 1, condition: 'loose' }, search);
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(6000);
    expect(search).toHaveBeenCalledOnce();
  });

  it('writes a null estimate when eBay returns nothing', async () => {
    const db = seed();
    await estimatePair(db, { gameId: 1, condition: 'new' }, async () => []);
    expect(getEstimate(db, 1, 'new')?.estimate).toBeNull();
  });
});

describe('refreshEstimates', () => {
  it('re-estimates every owned pair, snapshots them, and records the event', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const search = vi.fn(async () => [4000, 4200]); // → median 4100
    const progress: number[] = [];
    const result = await refreshEstimates(db, { search, onProgress: (d) => progress.push(d) });

    expect(result.itemsUpdated).toBe(2);
    expect(result.errors).toBe(0);
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(4100);
    expect(progress.at(-1)).toBe(2); // deterministic: every pair reported
  });

  it('skips owned pairs whose item has a manual price', async () => {
    const db = seed();
    const itemId = addItem(db, { gameId: 1, condition: 'loose' });
    updateItem(db, itemId, { manualPrice: 9999 });
    const search = vi.fn(async () => [1000]);
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(search).not.toHaveBeenCalled();
    expect(result.itemsUpdated).toBe(0);
  });

  it('counts an error and continues when one search throws', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    let call = 0;
    const search = vi.fn(async () => {
      call++;
      if (call === 1) throw new Error('rate limited');
      return [3000];
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.errors).toBe(1);
    expect(result.itemsUpdated).toBe(1);
  });
});
