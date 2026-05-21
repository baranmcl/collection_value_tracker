// ABOUTME: Queries for refresh events and price snapshots — create and update a
// ABOUTME: refresh event, insert snapshots, and compute top movers.
import { desc, eq } from 'drizzle-orm';
import type { DB } from '../client';
import { priceSnapshots, refreshEvents, games } from '../schema';

export interface NewRefreshEvent {
  source: string;
  itemsUpdated: number;
  errors: number;
}

export function createRefreshEvent(db: DB, e: NewRefreshEvent): number {
  return db
    .insert(refreshEvents)
    .values({ ...e, triggeredAt: new Date() })
    .returning({ id: refreshEvents.id })
    .get().id;
}

export interface RefreshEventUpdate {
  itemsUpdated: number;
  errors: number;
  errorSummary: string | null;
  totalValue: number;
}

/** Write the final tallies onto a refresh event when a run finishes. */
export function updateRefreshEvent(db: DB, id: number, u: RefreshEventUpdate): void {
  db.update(refreshEvents).set(u).where(eq(refreshEvents.id, id)).run();
}

export function latestRefreshEvent(db: DB) {
  return db.select().from(refreshEvents).orderBy(desc(refreshEvents.id)).limit(1).get();
}

export function listRefreshEvents(db: DB, limit = 20) {
  return db.select().from(refreshEvents).orderBy(desc(refreshEvents.id)).limit(limit).all();
}

export interface NewSnapshot {
  gameId: number;
  condition: string;
  estimate: number;
  listingCount: number;
  refreshEventId: number;
}

export function insertSnapshot(db: DB, s: NewSnapshot): void {
  db.insert(priceSnapshots).values({ ...s, snapshotAt: new Date() }).run();
}

export interface Mover {
  gameId: number;
  title: string;
  condition: string;
  previous: number;
  current: number;
  delta: number;
}

/**
 * Dollar change for each (game, condition) between the two most recent
 * refresh events. Empty when fewer than two refreshes exist.
 */
export function topMovers(db: DB, limit: number): Mover[] {
  const events = db.select().from(refreshEvents).orderBy(desc(refreshEvents.id)).limit(2).all();
  if (events.length < 2) return [];
  const [current, previous] = events;

  const snapsFor = (eventId: number) =>
    db.select().from(priceSnapshots).where(eq(priceSnapshots.refreshEventId, eventId)).all();
  const prevMap = new Map(snapsFor(previous.id).map((s) => [`${s.gameId}:${s.condition}`, s.estimate]));
  const titles = new Map(db.select().from(games).all().map((g) => [g.id, g.title]));

  const movers: Mover[] = [];
  for (const s of snapsFor(current.id)) {
    const prev = prevMap.get(`${s.gameId}:${s.condition}`);
    if (prev === undefined) continue;
    movers.push({
      gameId: s.gameId,
      title: titles.get(s.gameId) ?? `#${s.gameId}`,
      condition: s.condition,
      previous: prev,
      current: s.estimate,
      delta: s.estimate - prev
    });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return movers.slice(0, limit);
}
