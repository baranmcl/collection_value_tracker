import { and, asc, eq, isNull, like, sql } from 'drizzle-orm';
import { fold } from '$lib/fold';
import type { DB } from '../client';
import { games } from '../schema';

export interface CatalogGame {
  id: number;
  console: string;
  title: string;
  region: string | null;
  releaseYear: number | null;
  boxartUrl?: string | null; // front cover thumbnail URL, if TheGamesDB has one
}

/** Insert or update catalog games, keyed on TheGamesDB id. */
export function upsertGames(db: DB, rows: CatalogGame[]): void {
  if (rows.length === 0) return;
  const now = new Date();
  db.transaction((tx) => {
    for (const r of rows) {
      const boxartUrl = r.boxartUrl ?? null;
      const titleFolded = fold(r.title);
      tx.insert(games)
        .values({ ...r, boxartUrl, titleFolded, lastSyncedAt: now })
        .onConflictDoUpdate({
          target: games.id,
          set: {
            console: r.console,
            title: r.title,
            region: r.region,
            releaseYear: r.releaseYear,
            boxartUrl,
            titleFolded,
            lastSyncedAt: now
          }
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

/** Populate title_folded for any rows synced before the column existed.
 *  Idempotent — only touches rows where title_folded IS NULL. */
export function backfillFoldedTitles(db: DB): void {
  const rows = db.select({ id: games.id, title: games.title }).from(games).where(isNull(games.titleFolded)).all();
  if (rows.length === 0) return;
  db.transaction((tx) => {
    for (const r of rows) {
      tx.update(games).set({ titleFolded: fold(r.title) }).where(eq(games.id, r.id)).run();
    }
  });
}
