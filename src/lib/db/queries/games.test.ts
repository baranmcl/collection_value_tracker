import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../test-db';
import { games } from '../schema';
import { upsertGames, listGamesByConsole, searchGames, consoleCounts, getGame, backfillFoldedTitles } from './games';

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

  it('lists games for one console alphabetically', () => {
    const db = makeTestDb();
    upsertGames(db, SAMPLE);
    const snes = listGamesByConsole(db, 'SNES');
    expect(snes.map((g) => g.title)).toEqual(['Chrono Trigger', 'Super Metroid']);
  });

  it('searches titles within a console, case-insensitively', () => {
    const db = makeTestDb();
    upsertGames(db, SAMPLE);
    expect(searchGames(db, 'SNES', 'metroid').map((g) => g.id)).toEqual([2]);
    expect(searchGames(db, 'SNES', 'goldeneye')).toHaveLength(0);
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
