import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../test-db';
import { games } from '../schema';
import { upsertGames, consoleCounts, getGame, backfillFoldedTitles, browseGames } from './games';
import { addItem } from '$lib/db/queries/collection';

const SAMPLE = [
  { id: 1, console: 'SNES', title: 'Chrono Trigger', region: 'NTSC', releaseYear: 1995 },
  { id: 2, console: 'SNES', title: 'Super Metroid', region: 'NTSC', releaseYear: 1994 },
  { id: 3, console: 'N64', title: 'GoldenEye 007', region: 'NTSC', releaseYear: 1997 }
];

describe('games queries', () => {
  it('upserts games and updates existing rows by id', () => {
    const db = makeTestDb();
    upsertGames(db, SAMPLE);
    expect(getGame(db, 1)?.title).toBe('Chrono Trigger');
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'Chrono Trigger (renamed)', region: 'NTSC', releaseYear: 1995 }]);
    expect(getGame(db, 1)?.title).toBe('Chrono Trigger (renamed)');
    expect(db.select().from(games).all()).toHaveLength(3);
  });

  it('counts games per console', () => {
    const db = makeTestDb();
    upsertGames(db, SAMPLE);
    expect(consoleCounts(db)).toEqual([
      { console: 'N64', count: 1 },
      { console: 'SNES', count: 2 }
    ]);
  });

  it('writes a folded title when upserting a game', () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'GBA', title: 'Pokémon Ruby', region: null, releaseYear: 2002 }]);
    expect(getGame(db, 1)?.titleFolded).toBe('pokemon ruby');
  });

  it('backfills folded titles for rows that lack one, idempotently', () => {
    const db = makeTestDb();
    // A row inserted directly, without title_folded (simulating a pre-migration row).
    db.insert(games).values({ id: 1, console: 'GBA', title: 'Métroid Fusion', lastSyncedAt: new Date() }).run();
    expect(getGame(db, 1)?.titleFolded).toBeNull();

    backfillFoldedTitles(db);
    expect(getGame(db, 1)?.titleFolded).toBe('metroid fusion');

    // Idempotent: a second run does not throw and does not change the value.
    backfillFoldedTitles(db);
    expect(getGame(db, 1)?.titleFolded).toBe('metroid fusion');
  });
});

describe('browseGames', () => {
  function seed() {
    const db = makeTestDb();
    upsertGames(db, [
      { id: 1, console: 'GBA', title: 'Pokémon Ruby', region: null, releaseYear: 2002 },
      { id: 2, console: 'GBA', title: 'Metroid Fusion', region: null, releaseYear: 2002 },
      { id: 3, console: 'GBA', title: 'Advance Wars', region: null, releaseYear: 2001 },
      { id: 4, console: 'GBA', title: 'Epoch Junk Hack', region: null, releaseYear: 1970 },
      { id: 5, console: 'N64', title: 'GoldenEye', region: null, releaseYear: 1997 }
    ]);
    return db;
  }

  it('filters by console and orders by folded title', () => {
    const { games: rows } = browseGames(seed(), { console: 'GBA', query: '', show: 'all', homebrewBounds: null }, 1, 100);
    expect(rows.map((g) => g.title)).toEqual(['Advance Wars', 'Epoch Junk Hack', 'Metroid Fusion', 'Pokémon Ruby']);
  });

  it('matches an accented title from a plain-ASCII folded query', () => {
    const { games: rows } = browseGames(seed(), { console: 'GBA', query: 'pokemon', show: 'all', homebrewBounds: null }, 1, 100);
    expect(rows.map((g) => g.id)).toEqual([1]);
  });

  it('excludes years outside the homebrew window but keeps null years', () => {
    const db = seed();
    upsertGames(db, [{ id: 6, console: 'GBA', title: 'No Year Game', region: null, releaseYear: null }]);
    const { games: rows } = browseGames(db, { console: 'GBA', query: '', show: 'all', homebrewBounds: { start: 2001, end: 2009 } }, 1, 100);
    const titles = rows.map((g) => g.title);
    expect(titles).toContain('No Year Game');       // null year kept
    expect(titles).not.toContain('Epoch Junk Hack'); // 1970 < 2001, excluded
  });

  it('filters to owned games', () => {
    const db = seed();
    addItem(db, { gameId: 2, condition: 'loose' });
    const { games: rows } = browseGames(db, { console: 'GBA', query: '', show: 'owned', homebrewBounds: null }, 1, 100);
    expect(rows.map((g) => g.id)).toEqual([2]);
  });

  it('pages with limit and offset and reports the full count', () => {
    const db = seed();
    const p1 = browseGames(db, { console: 'GBA', query: '', show: 'all', homebrewBounds: null }, 1, 2);
    const p2 = browseGames(db, { console: 'GBA', query: '', show: 'all', homebrewBounds: null }, 2, 2);
    expect(p1.games.map((g) => g.title)).toEqual(['Advance Wars', 'Epoch Junk Hack']);
    expect(p2.games.map((g) => g.title)).toEqual(['Metroid Fusion', 'Pokémon Ruby']);
    expect(p1.totalCount).toBe(4);
    expect(p2.totalCount).toBe(4);
  });
});
