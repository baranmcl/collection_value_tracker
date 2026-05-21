import { describe, it, expect, vi } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, updateItem } from '$lib/db/queries/collection';
import { getEstimate } from '$lib/db/queries/prices';
import { estimatePair, refreshEstimates } from './refresh';
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

  it('aborts the whole run when a search hits a rate limit', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const search = vi.fn(async () => {
      throw new EbayError(429, 'eBay search failed: 429');
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.aborted).toBe(true);
    expect(result.errorsByReason.rate_limit).toBe(1);
    expect(search).toHaveBeenCalledTimes(1);            // second pair never attempted
    expect(getEstimate(db, 2, 'cib')).toBeUndefined();  // later pair left untouched
  });

  it('aborts the whole run on an auth failure', async () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const search = vi.fn(async () => {
      throw new EbayError(401, 'eBay search failed: 401');
    });
    const result = await refreshEstimates(db, { search, onProgress: () => {} });
    expect(result.aborted).toBe(true);
    expect(result.errorsByReason.auth).toBe(1);
    expect(search).toHaveBeenCalledTimes(1);
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
