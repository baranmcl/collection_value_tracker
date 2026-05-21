import { describe, it, expect, vi } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, updateItem } from '$lib/db/queries/collection';
import { getEstimate } from '$lib/db/queries/prices';
import { estimatePair, refreshEstimates, type RefreshProgress } from './refresh';
import { EbayError } from './ebay/errors';
import { latestRefreshEvent } from '$lib/db/queries/refresh';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [
    { id: 1, console: 'SNES', title: 'Chrono Trigger', region: null, releaseYear: null },
    { id: 2, console: 'N64', title: 'GoldenEye', region: null, releaseYear: null }
  ]);
  return db;
}

function seedMany(n: number) {
  const db = makeTestDb();
  upsertGames(
    db,
    Array.from({ length: n }, (_, i) => ({
      id: i + 1, console: 'GameCube', title: `Game ${i + 1}`, region: null, releaseYear: null
    }))
  );
  for (let i = 1; i <= n; i++) addItem(db, { gameId: i, condition: 'loose' });
  return db;
}

describe('estimatePair', () => {
  it('searches eBay and writes a price estimate for one (game, condition)', async () => {
    const db = seed();
    const search = vi.fn(async (q: string) => [
      { priceCents: 5000, title: q, conditionId: 3000 },
      { priceCents: 6000, title: q, conditionId: 3000 },
      { priceCents: 7000, title: q, conditionId: 3000 }
    ]);
    await estimatePair(db, { gameId: 1, condition: 'loose' }, search);
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(6000);
    expect(search).toHaveBeenCalledOnce();
  });

  it('writes a null estimate when eBay returns nothing', async () => {
    const db = seed();
    await estimatePair(db, { gameId: 1, condition: 'new' }, async () => []);
    expect(getEstimate(db, 1, 'new')?.estimate).toBeNull();
  });

  it('drops listings that do not match the game before estimating', async () => {
    const db = seed();
    // game 1 is "Chrono Trigger" (see seed()). One matching listing, one junk.
    const search = vi.fn(async (q: string) => [
      { priceCents: 5000, title: q, conditionId: 3000 },                       // matches
      { priceCents: 999999, title: 'Unrelated Game SNES lot', conditionId: 3000 } // junk: wrong title + "lot"
    ]);
    await estimatePair(db, { gameId: 1, condition: 'loose' }, search);
    const e = getEstimate(db, 1, 'loose');
    expect(e?.estimate).toBe(5000);   // junk listing excluded — not a 2-item median
    expect(e?.listingCount).toBe(1);
  });
});

describe('refreshEstimates', () => {
  it('re-estimates every owned pair, snapshots them, and records the event', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const search = vi.fn(async (q: string) => [
      { priceCents: 4000, title: q, conditionId: 3000 },
      { priceCents: 4200, title: q, conditionId: 3000 }
    ]); // → median 4100
    const progress: RefreshProgress[] = [];
    const result = await refreshEstimates(db, { search, onProgress: (p) => progress.push(p) });

    expect(result.itemsUpdated).toBe(2);
    expect(result.errors).toBe(0);
    expect(getEstimate(db, 1, 'loose')?.estimate).toBe(4100);
    expect(progress).toHaveLength(2); // one tick per pair claimed
    expect(progress.every((p) => p.total === 2)).toBe(true);
    expect(progress.map((p) => p.current).sort()).toEqual(['Chrono Trigger', 'GoldenEye']);
  });

  it('skips owned pairs whose item has a manual price', async () => {
    const db = seed();
    const itemId = addItem(db, { gameId: 1, condition: 'loose' });
    updateItem(db, itemId, { manualPrice: 9999 });
    const search = vi.fn(async (q: string) => [{ priceCents: 1000, title: q, conditionId: 3000 }]);
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(search).not.toHaveBeenCalled();
    expect(result.itemsUpdated).toBe(0);
  });

  it('counts a non-fatal error and continues to the next pair', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    let call = 0;
    const search = vi.fn(async (q: string) => {
      call++;
      if (call === 1) throw new Error('network blip'); // plain Error → classified 'other'
      return [{ priceCents: 3000, title: q, conditionId: 3000 }];
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.errors).toBe(1);
    expect(result.errorsByReason).toEqual({ auth: 0, rate_limit: 0, other: 1 });
    expect(result.aborted).toBe(false);
    expect(result.itemsUpdated).toBe(1);
  });

  it('stops dispatching new pairs once a rate limit aborts the run', async () => {
    const db = seedMany(12); // 12 pairs > concurrency 5
    const search = vi.fn(async () => {
      throw new EbayError(429, 'eBay search failed: 429');
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.aborted).toBe(true);
    expect(search).toHaveBeenCalledTimes(5); // exactly the first wave; 6–12 never claimed
    expect(result.errorsByReason.rate_limit).toBe(5);
    expect(getEstimate(db, 12, 'loose')).toBeUndefined(); // a later pair, untouched
  });

  it('stops dispatching new pairs once an auth failure aborts the run', async () => {
    const db = seedMany(12);
    const search = vi.fn(async () => {
      throw new EbayError(401, 'eBay search failed: 401');
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.aborted).toBe(true);
    expect(search).toHaveBeenCalledTimes(5);
    expect(result.errorsByReason.auth).toBe(5);
    expect(getEstimate(db, 12, 'loose')).toBeUndefined();
  });

  it('estimates every pair correctly when there are more pairs than the concurrency limit', async () => {
    const db = seedMany(8); // 8 pairs > concurrency 5
    const search = vi.fn(async (q: string) => [{ priceCents: 1500, title: q, conditionId: 3000 }]);
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.itemsUpdated).toBe(8);
    expect(result.errors).toBe(0);
    expect(search).toHaveBeenCalledTimes(8);
    for (let i = 1; i <= 8; i++) expect(getEstimate(db, i, 'loose')?.estimate).toBe(1500);
  });

  it('reports the current game title on each progress tick', async () => {
    const db = seedMany(3);
    const search = vi.fn(async (q: string) => [{ priceCents: 1000, title: q, conditionId: 3000 }]);
    const progress: RefreshProgress[] = [];
    await refreshEstimates(db, { search, onProgress: (p) => progress.push(p) });
    expect(progress).toHaveLength(3);
    expect(progress.map((p) => p.current).sort()).toEqual(['Game 1', 'Game 2', 'Game 3']);
    expect(progress.every((p) => p.total === 3)).toBe(true);
  });

  it('persists an error summary for a failed run and null for a clean run', async () => {
    const cleanDb = seed();
    addItem(cleanDb, { gameId: 1, condition: 'loose' });
    await refreshEstimates(cleanDb, {
      search: async (q: string) => [{ priceCents: 3000, title: q, conditionId: 3000 }],
      onProgress: () => {}
    });
    expect(latestRefreshEvent(cleanDb)?.errorSummary).toBeNull();

    const failDb = seed();
    addItem(failDb, { gameId: 1, condition: 'loose' });
    await refreshEstimates(failDb, {
      search: async () => {
        throw new EbayError(429, 'eBay search failed: 429');
      },
      onProgress: () => {}
    });
    expect(latestRefreshEvent(failDb)?.errorSummary).toBe('rate_limit×1 (aborted)');
  });
});
