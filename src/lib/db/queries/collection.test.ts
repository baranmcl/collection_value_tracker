import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../test-db';
import { upsertGames } from './games';
import { addItem, removeItem, listCollection, updateItem, ownedConditions, ownedConditionsByGame } from './collection';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [
    { id: 1, console: 'SNES', title: 'Chrono Trigger', region: 'NTSC', releaseYear: 1995 },
    { id: 2, console: 'N64', title: 'GoldenEye 007', region: 'NTSC', releaseYear: 1997 }
  ]);
  return db;
}

describe('collection queries', () => {
  it('adds an item and returns its id', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    expect(typeof id).toBe('number');
    expect(listCollection(db)).toHaveLength(1);
  });

  it('supports multiple copies of the same game+condition', () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 1, condition: 'loose' });
    expect(listCollection(db)).toHaveLength(2);
  });

  it('removes an item by id', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'cib' });
    removeItem(db, id);
    expect(listCollection(db)).toHaveLength(0);
  });

  it('updates grade, notes, acquiredAt and manualPrice', () => {
    const db = seed();
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    updateItem(db, id, { grade: 'mint', notes: 'yellowed', manualPrice: 5000 });
    const item = listCollection(db).find((r) => r.id === id)!;
    expect(item.grade).toBe('mint');
    expect(item.manualPrice).toBe(5000);
  });

  it('reports owned conditions for one game', () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 1, condition: 'new' });
    expect(ownedConditions(db, 1).sort()).toEqual(['loose', 'new']);
  });

  it('groups owned conditions by game id in a single batch query', () => {
    const db = seed();
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 1, condition: 'new' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const map = ownedConditionsByGame(db);
    expect([...(map.get(1) ?? [])].sort()).toEqual(['loose', 'new']);
    expect(map.get(2)).toEqual(['cib']);
    expect(map.get(99)).toBeUndefined();
  });

  it('listCollection joins game title and console', () => {
    const db = seed();
    addItem(db, { gameId: 2, condition: 'loose' });
    expect(listCollection(db)[0].title).toBe('GoldenEye 007');
    expect(listCollection(db)[0].console).toBe('N64');
  });
});
