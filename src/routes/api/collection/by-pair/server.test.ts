import { describe, it, expect } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, listCollection } from '$lib/db/queries/collection';
import { removeOneByPair } from './logic';

describe('removeOneByPair', () => {
  it('removes a single item matching the game and condition', () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 1, condition: 'loose' });
    removeOneByPair(db, { gameId: 1, condition: 'loose' });
    expect(listCollection(db)).toHaveLength(1); // only one copy removed
  });

  it('is a no-op when nothing matches', () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'X', region: null, releaseYear: null }]);
    removeOneByPair(db, { gameId: 1, condition: 'new' });
    expect(listCollection(db)).toHaveLength(0);
  });
});
