import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../test-db';
import { refreshEvents } from '../schema';
import { upsertGames } from './games';
import { createRefreshEvent, insertSnapshot, latestRefreshEvent, topMovers, valueHistory } from './refresh';

function seed() {
  const db = makeTestDb();
  upsertGames(db, [
    { id: 1, console: 'SNES', title: 'Chrono Trigger', region: null, releaseYear: null },
    { id: 2, console: 'N64', title: 'GoldenEye', region: null, releaseYear: null }
  ]);
  return db;
}

describe('refresh queries', () => {
  it('creates a refresh event and returns its id', () => {
    const db = seed();
    const id = createRefreshEvent(db, { source: 'ebay_browse:test', itemsUpdated: 2, errors: 0 });
    expect(latestRefreshEvent(db)?.id).toBe(id);
  });

  it('computes top movers by dollar change across the two latest snapshots', () => {
    const db = seed();
    const e1 = createRefreshEvent(db, { source: 'r1', itemsUpdated: 2, errors: 0 });
    insertSnapshot(db, { gameId: 1, condition: 'loose', estimate: 5000, listingCount: 4, refreshEventId: e1 });
    insertSnapshot(db, { gameId: 2, condition: 'cib', estimate: 8000, listingCount: 3, refreshEventId: e1 });
    const e2 = createRefreshEvent(db, { source: 'r2', itemsUpdated: 2, errors: 0 });
    insertSnapshot(db, { gameId: 1, condition: 'loose', estimate: 6200, listingCount: 5, refreshEventId: e2 });
    insertSnapshot(db, { gameId: 2, condition: 'cib', estimate: 7900, listingCount: 3, refreshEventId: e2 });

    const movers = topMovers(db, 10);
    expect(movers[0]).toMatchObject({ gameId: 1, condition: 'loose', delta: 1200 });
    expect(movers[1]).toMatchObject({ gameId: 2, condition: 'cib', delta: -100 });
  });

  it('returns no movers when there is only one refresh', () => {
    const db = seed();
    const e1 = createRefreshEvent(db, { source: 'r1', itemsUpdated: 1, errors: 0 });
    insertSnapshot(db, { gameId: 1, condition: 'loose', estimate: 5000, listingCount: 4, refreshEventId: e1 });
    expect(topMovers(db, 10)).toEqual([]);
  });
});

describe('valueHistory', () => {
  it('returns refresh totals oldest-first and skips events with no total', () => {
    const db = makeTestDb();
    db.insert(refreshEvents).values([
      { triggeredAt: new Date('2026-05-10T00:00:00Z'), source: 'x', totalValue: 5000 },
      { triggeredAt: new Date('2026-05-01T00:00:00Z'), source: 'x', totalValue: 3000 },
      { triggeredAt: new Date('2026-05-20T00:00:00Z'), source: 'x' } // no total → excluded
    ]).run();

    const history = valueHistory(db);
    expect(history.map((p) => p.value)).toEqual([3000, 5000]); // oldest first, null skipped
    expect(history[0].at).toBeInstanceOf(Date);
  });
});
