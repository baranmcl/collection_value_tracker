import type { DB } from '$lib/db/client';
import { addItem, removeItem } from '$lib/db/queries/collection';
import { estimatePair } from '$lib/sources/refresh';
import type { SearchFn } from '$lib/sources/refresh';
import { isCondition } from '$lib/types';

export async function addCollectionItem(
  db: DB,
  input: { gameId: number; condition: string },
  search: SearchFn | null
): Promise<{ itemId: number }> {
  if (!isCondition(input.condition)) throw new Error(`Invalid condition: ${input.condition}`);
  // Adding the item is the primary action and MUST succeed on its own.
  const itemId = addItem(db, { gameId: input.gameId, condition: input.condition });
  // The estimate is best-effort: skip it if eBay is unconfigured, and never
  // let an eBay failure fail the add — a later refresh will fill in the price.
  if (search) {
    try {
      await estimatePair(db, { gameId: input.gameId, condition: input.condition }, search);
    } catch {
      /* estimate unavailable — item still added */
    }
  }
  return { itemId };
}

export function removeCollectionItem(db: DB, itemId: number): void {
  removeItem(db, itemId);
}
