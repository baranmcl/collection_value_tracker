import { describe, it, expect, vi } from 'vitest';
import { mapApiGame, fetchPlatformGames } from './thegamesdb';

describe('mapApiGame', () => {
  it('maps a TheGamesDB game record to a CatalogGame', () => {
    const mapped = mapApiGame(
      { id: 42, game_title: 'Chrono Trigger', release_date: '1995-03-11', region_id: 1 },
      'SNES'
    );
    expect(mapped).toEqual({ id: 42, console: 'SNES', title: 'Chrono Trigger', region: 'NTSC', releaseYear: 1995 });
  });
  it('tolerates missing release date and region', () => {
    const mapped = mapApiGame({ id: 7, game_title: 'X' }, 'NES');
    expect(mapped).toEqual({ id: 7, console: 'NES', title: 'X', region: null, releaseYear: null });
  });
});

describe('fetchPlatformGames', () => {
  it('fetches a page, maps the games, and reports the next page', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      data: { games: [{ id: 1, game_title: 'X', release_date: '1990-06-01', region_id: 3 }] },
      pages: { next: 'https://api.thegamesdb.net/...&page=2' }
    }), { status: 200 }));
    const page = await fetchPlatformGames('KEY', 6, 'SNES', 1, fetchFn);
    expect(page.games).toEqual([{ id: 1, console: 'SNES', title: 'X', region: 'PAL', releaseYear: 1990 }]);
    expect(page.nextPage).toBe(2);
  });

  it('reports no next page when pages.next is absent', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ data: { games: [] } }), { status: 200 }));
    const page = await fetchPlatformGames('KEY', 6, 'SNES', 1, fetchFn);
    expect(page.games).toEqual([]);
    expect(page.nextPage).toBeNull();
  });

  it('throws a clear error on a non-OK response', async () => {
    const fetchFn = vi.fn(async () => new Response('err', { status: 503 }));
    await expect(fetchPlatformGames('KEY', 6, 'SNES', 1, fetchFn)).rejects.toThrow(/TheGamesDB/);
  });
});
