import { describe, it, expect, vi } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { listGamesByConsole } from '$lib/db/queries/games';
import { syncCatalog } from './sync';

describe('syncCatalog', () => {
  it('upserts fetched games and reports progress', async () => {
    const db = makeTestDb();
    const fakeFetch = vi.fn(async (platformId: number, _name: string, page: number) => ({
      games: [{ id: platformId * 100 + page, console: 'SNES', title: `G${page}`, region: null, releaseYear: null }],
      nextPage: page < 2 ? page + 1 : null
    }));
    const progress: number[] = [];
    const result = await syncCatalog(db, {
      platforms: [{ thegamesdbId: 6, name: 'SNES' }],
      fetchPage: fakeFetch,
      onProgress: (done) => progress.push(done)
    });
    expect(result.gamesLoaded).toBe(2);
    expect(listGamesByConsole(db, 'SNES')).toHaveLength(2);
    expect(progress.at(-1)).toBe(1); // 1 of 1 platforms done
  });

  it('records an error and continues when one platform fails', async () => {
    const db = makeTestDb();
    const fakeFetch = vi.fn(async (platformId: number) => {
      if (platformId === 6) throw new Error('boom');
      return { games: [{ id: 1, console: 'NES', title: 'X', region: null, releaseYear: null }], nextPage: null };
    });
    const result = await syncCatalog(db, {
      platforms: [
        { thegamesdbId: 6, name: 'SNES' },
        { thegamesdbId: 7, name: 'NES' }
      ],
      fetchPage: fakeFetch,
      onProgress: () => {}
    });
    expect(result.errors).toBe(1);
    expect(result.gamesLoaded).toBe(1);
  });
});
