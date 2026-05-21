import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from './test-db';
import { games, collectionItems, priceEstimates, refreshEvents } from './schema';

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

  it('stores a nullable error summary on a refresh event', () => {
    const db = makeTestDb();
    db.insert(refreshEvents).values({ triggeredAt: new Date(), source: 'ebay_browse' }).run();
    expect(db.select().from(refreshEvents).get()?.errorSummary).toBeNull();

    db.insert(refreshEvents)
      .values({ triggeredAt: new Date(), source: 'ebay_browse', errorSummary: 'rate_limit×1 (aborted)' })
      .run();
    const rows = db.select().from(refreshEvents).all();
    expect(rows.map((r) => r.errorSummary)).toContain('rate_limit×1 (aborted)');
  });

  it('stores a nullable total value on a refresh event', () => {
    const db = makeTestDb();
    db.insert(refreshEvents).values({ triggeredAt: new Date(), source: 'ebay_browse' }).run();
    expect(db.select().from(refreshEvents).get()?.totalValue).toBeNull();

    db.insert(refreshEvents)
      .values({ triggeredAt: new Date(), source: 'ebay_browse', totalValue: 508611 })
      .run();
    const rows = db.select().from(refreshEvents).all();
    expect(rows.map((r) => r.totalValue)).toContain(508611);
  });

  it('stores a nullable folded title on a game', () => {
    const db = makeTestDb();
    db.insert(games).values({ id: 1, console: 'SNES', title: 'A', lastSyncedAt: new Date() }).run();
    expect(db.select().from(games).get()?.titleFolded).toBeNull();

    db.insert(games)
      .values({ id: 2, console: 'SNES', title: 'Pokémon', titleFolded: 'pokemon', lastSyncedAt: new Date() })
      .run();
    expect(db.select().from(games).where(eq(games.id, 2)).get()?.titleFolded).toBe('pokemon');
  });
});
