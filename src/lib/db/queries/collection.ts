import { asc, eq } from 'drizzle-orm';
import type { DB } from '../client';
import { collectionItems, games } from '../schema';
import type { Condition } from '$lib/types';

export interface AddItemInput {
  gameId: number;
  condition: Condition;
}

export interface ItemPatch {
  condition?: Condition;
  grade?: string | null;
  notes?: string | null;
  acquiredAt?: string | null;
  manualPrice?: number | null;
}

export interface CollectionRow {
  id: number;
  gameId: number;
  title: string;
  console: string;
  boxartUrl: string | null;
  condition: string;
  grade: string | null;
  notes: string | null;
  acquiredAt: string | null;
  manualPrice: number | null;
  createdAt: Date;
}

/** Add one physical item. Returns the new row id. */
export function addItem(db: DB, input: AddItemInput): number {
  const res = db
    .insert(collectionItems)
    .values({ gameId: input.gameId, condition: input.condition, createdAt: new Date() })
    .returning({ id: collectionItems.id })
    .get();
  return res.id;
}

export function removeItem(db: DB, id: number): void {
  db.delete(collectionItems).where(eq(collectionItems.id, id)).run();
}

export function updateItem(db: DB, id: number, patch: ItemPatch): void {
  db.update(collectionItems).set(patch).where(eq(collectionItems.id, id)).run();
}

export function listCollection(db: DB): CollectionRow[] {
  return db
    .select({
      id: collectionItems.id,
      gameId: collectionItems.gameId,
      title: games.title,
      console: games.console,
      boxartUrl: games.boxartUrl,
      condition: collectionItems.condition,
      grade: collectionItems.grade,
      notes: collectionItems.notes,
      acquiredAt: collectionItems.acquiredAt,
      manualPrice: collectionItems.manualPrice,
      createdAt: collectionItems.createdAt
    })
    .from(collectionItems)
    .innerJoin(games, eq(collectionItems.gameId, games.id))
    .orderBy(asc(games.title))
    .all();
}

export function ownedConditions(db: DB, gameId: number): string[] {
  const rows = db
    .selectDistinct({ condition: collectionItems.condition })
    .from(collectionItems)
    .where(eq(collectionItems.gameId, gameId))
    .all();
  return rows.map((r) => r.condition);
}

/** All owned conditions grouped by game id — ONE query. Use this for the
 *  Browse screen; calling `ownedConditions` per catalog game is an N+1. */
export function ownedConditionsByGame(db: DB): Map<number, string[]> {
  const rows = db
    .selectDistinct({ gameId: collectionItems.gameId, condition: collectionItems.condition })
    .from(collectionItems)
    .all();
  const map = new Map<number, string[]>();
  for (const r of rows) {
    const list = map.get(r.gameId) ?? [];
    list.push(r.condition);
    map.set(r.gameId, list);
  }
  return map;
}
