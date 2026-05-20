import { and, eq } from 'drizzle-orm';
import type { DB } from '$lib/db/client';
import { collectionItems } from '$lib/db/schema';
import { removeItem } from '$lib/db/queries/collection';
import { isCondition } from '$lib/types';

/** Remove ONE item matching (gameId, condition) — used by the Browse toggle. */
export function removeOneByPair(db: DB, pair: { gameId: number; condition: string }): void {
  if (!isCondition(pair.condition)) throw new Error(`Invalid condition: ${pair.condition}`);
  const match = db
    .select({ id: collectionItems.id })
    .from(collectionItems)
    .where(and(eq(collectionItems.gameId, pair.gameId), eq(collectionItems.condition, pair.condition)))
    .limit(1)
    .get();
  if (match) removeItem(db, match.id);
}
