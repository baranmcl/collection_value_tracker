import { describe, it, expect } from 'vitest';
import { makeTestDb } from './test-db';
import { games, collectionItems, priceEstimates } from './schema';

describe('schema', () => {
  it('inserts a game and an owned item', () => {
    const db = makeTestDb();
    db.insert(games).values({
      id: 1, console: 'SNES', title: 'Chrono Trigger',
      region: 'NTSC', releaseYear: 1995, lastSyncedAt: new Date()
    }).run();
    db.insert(collectionItems).values({
      gameId: 1, condition: 'loose', createdAt: new Date()
    }).run();
    expect(db.select().from(collectionItems).all()).toHaveLength(1);
  });

  it('enforces the unique (game, condition) estimate pair', () => {
    const db = makeTestDb();
    db.insert(games).values({ id: 1, console: 'SNES', title: 'X', lastSyncedAt: new Date() }).run();
    db.insert(priceEstimates).values({ gameId: 1, condition: 'loose', listingCount: 0, computedAt: new Date() }).run();
    expect(() =>
      db.insert(priceEstimates).values({ gameId: 1, condition: 'loose', listingCount: 0, computedAt: new Date() }).run()
    ).toThrow();
  });
});
