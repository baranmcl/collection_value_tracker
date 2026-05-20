import { describe, it, expect, vi } from 'vitest';
import { mapApiGame, fetchPlatformGames } from './thegamesdb';

describe('mapApiGame', () => {
  it('maps a TheGamesDB game record to a CatalogGame', () => {
    const mapped = mapApiGame(
      { id: 42, game_title: 'Chrono Trigger', release_date: '1995-03-11', region_id: 1 },
      'SNES'
    );
    expect(mapped).toEqual({
      id: 42, console: 'SNES', title: 'Chrono Trigger', region: 'NTSC', releaseYear: 1995, boxartUrl: null
    });
  });
  it('tolerates missing release date and region', () => {
    const mapped = mapApiGame({ id: 7, game_title: 'X' }, 'NES');
    expect(mapped).toEqual({
      id: 7, console: 'NES', title: 'X', region: null, releaseYear: null, boxartUrl: null
    });
  });
  it('keeps the boxart URL when one is supplied', () => {
    const mapped = mapApiGame({ id: 7, game_title: 'X' }, 'NES', 'https://cdn/x.jpg');
    expect(mapped.boxartUrl).toBe('https://cdn/x.jpg');
  });
});

describe('fetchPlatformGames', () => {
  it('fetches a page, maps games, attaches front boxart, and reports the next page', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      data: {
        games: [
          { id: 1, game_title: 'X', release_date: '1990-06-01', region_id: 3 },
          { id: 2, game_title: 'Y', release_date: '1991-01-01', region_id: 1 }
        ]
      },
      pages: { next: 'https://api.thegamesdb.net/...&page=2' },
      include: {
        boxart: {
          base_url: { thumb: 'https://cdn.thegamesdb.net/images/thumb/' },
          data: {
            // game 1 has front + back — only the front is used; game 2 has none
            '1': [
              { type: 'boxart', side: 'back', filename: 'boxart/back/1-1.jpg' },
              { type: 'boxart', side: 'front', filename: 'boxart/front/1-1.jpg' }
            ]
          }
        }
      }
    }), { status: 200 }));
    const page = await fetchPlatformGames('KEY', 6, 'SNES', 1, fetchFn);
    expect(page.games).toEqual([
      { id: 1, console: 'SNES', title: 'X', region: 'PAL', releaseYear: 1990,
        boxartUrl: 'https://cdn.thegamesdb.net/images/thumb/boxart/front/1-1.jpg' },
      { id: 2, console: 'SNES', title: 'Y', region: 'NTSC', releaseYear: 1991, boxartUrl: null }
    ]);
    expect(page.nextPage).toBe(2);
    // the request opts into the boxart include
    expect(String(fetchFn.mock.calls[0][0])).toContain('include=boxart');
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
