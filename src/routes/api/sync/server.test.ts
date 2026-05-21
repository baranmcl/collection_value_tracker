import { describe, it, expect, vi } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { browseGames } from '$lib/db/queries/games';
import { runSync } from './logic';

describe('runSync', () => {
  it('syncs the catalog and returns a summary', async () => {
    const db = makeTestDb();
    const fetchPage = vi.fn(async () => ({
      games: [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }],
      nextPage: null
    }));
    const result = await runSync(db, {
      apiKey: 'k',
      platforms: [{ thegamesdbId: 6, name: 'SNES' }],
      fetchPage
    });
    expect(result.gamesLoaded).toBe(1);
    expect(browseGames(db, { console: 'SNES', query: '', show: 'all', homebrewBounds: null }, 1, 100).totalCount).toBe(1);
  });

  it('throws a clear error when the API key is missing', async () => {
    const db = makeTestDb();
    await expect(runSync(db, { apiKey: '', platforms: [], fetchPage: vi.fn() })).rejects.toThrow(/API key/i);
  });
});
