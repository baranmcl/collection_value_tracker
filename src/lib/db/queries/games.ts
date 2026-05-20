import { and, asc, eq, like, sql } from 'drizzle-orm';
import type { DB } from '../client';
import { games } from '../schema';

export interface CatalogGame {
  id: number;
  console: string;
  title: string;
  region: string | null;
  releaseYear: number | null;
}

/** Insert or update catalog games, keyed on TheGamesDB id. */
export function upsertGames(db: DB, rows: CatalogGame[]): void {
  if (rows.length === 0) return;
  const now = new Date();
  db.transaction((tx) => {
    for (const r of rows) {
      tx.insert(games)
        .values({ ...r, lastSyncedAt: now })
        .onConflictDoUpdate({
          target: games.id,
          set: { console: r.console, title: r.title, region: r.region, releaseYear: r.releaseYear, lastSyncedAt: now }
        })
        .run();
    }
  });
}

export function getGame(db: DB, id: number) {
  return db.select().from(games).where(eq(games.id, id)).get();
}

export function listGamesByConsole(db: DB, console: string) {
  return db.select().from(games).where(eq(games.console, console)).orderBy(asc(games.title)).all();
}

export function searchGames(db: DB, console: string, query: string) {
  return db
    .select()
    .from(games)
    .where(and(eq(games.console, console), like(games.title, `%${query}%`)))
    .orderBy(asc(games.title))
    .all();
}

export function consoleCounts(db: DB): { console: string; count: number }[] {
  return db
    .select({ console: games.console, count: sql<number>`count(*)` })
    .from(games)
    .groupBy(games.console)
    .orderBy(asc(games.console))
    .all();
}
