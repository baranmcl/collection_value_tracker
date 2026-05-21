import { and, asc, eq, gte, inArray, isNull, like, lte, notInArray, or, sql, type SQL } from 'drizzle-orm';

import { fold } from '$lib/fold';
import type { DB } from '../client';
import { collectionItems, games, type Game } from '../schema';

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

export interface BrowseFilters {
  console: string;
  query: string; // already folded by the caller; '' means no text filter
  show: 'all' | 'owned' | 'unowned' | 'loose' | 'cib' | 'new';
  homebrewBounds: { start: number; end: number | null } | null; // null = do not hide homebrew
}

export interface BrowsePage {
  games: Game[];
  totalCount: number; // full filtered count, ignoring LIMIT/OFFSET
}

/** One filtered, ordered page of catalog games, plus the full match count. */
export function browseGames(db: DB, filters: BrowseFilters, page: number, pageSize: number): BrowsePage {
  const conds: (SQL | undefined)[] = [eq(games.console, filters.console)];

  if (filters.query !== '') {
    conds.push(like(games.titleFolded, `%${filters.query}%`));
  }

  if (filters.homebrewBounds) {
    const { start, end } = filters.homebrewBounds;
    const inRange =
      end !== null ? and(gte(games.releaseYear, start), lte(games.releaseYear, end)) : gte(games.releaseYear, start);
    conds.push(or(isNull(games.releaseYear), inRange));
  }

  const ownedIds = db.select({ id: collectionItems.gameId }).from(collectionItems);
  if (filters.show === 'owned') {
    conds.push(inArray(games.id, ownedIds));
  } else if (filters.show === 'unowned') {
    conds.push(notInArray(games.id, ownedIds));
  } else if (filters.show === 'loose' || filters.show === 'cib' || filters.show === 'new') {
    conds.push(
      inArray(
        games.id,
        db.select({ id: collectionItems.gameId }).from(collectionItems).where(eq(collectionItems.condition, filters.show))
      )
    );
  }

  const where = and(...conds);
  const rows = db
    .select()
    .from(games)
    .where(where)
    .orderBy(asc(games.titleFolded))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();
  const totalCount = db.select({ c: sql<number>`count(*)` }).from(games).where(where).get()?.c ?? 0;
  return { games: rows, totalCount };
}
