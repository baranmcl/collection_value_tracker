import { and, eq } from 'drizzle-orm';
import type { DB } from '../client';
import { priceEstimates } from '../schema';
import type { Condition } from '$lib/types';

export interface UpsertEstimateInput {
  gameId: number;
  condition: Condition;
  estimate: number | null;
  listingCount: number;
}

export function upsertEstimate(db: DB, input: UpsertEstimateInput): void {
  db.insert(priceEstimates)
    .values({
      gameId: input.gameId,
      condition: input.condition,
      estimate: input.estimate,
      listingCount: input.listingCount,
      source: 'ebay',
      computedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [priceEstimates.gameId, priceEstimates.condition],
      set: { estimate: input.estimate, listingCount: input.listingCount, computedAt: new Date() }
    })
    .run();
}

export function getEstimate(db: DB, gameId: number, condition: string) {
  return db
    .select()
    .from(priceEstimates)
    .where(and(eq(priceEstimates.gameId, gameId), eq(priceEstimates.condition, condition)))
    .get();
}

/** All estimates keyed by `${gameId}:${condition}` — for batch UI rendering. */
export function estimateMap(db: DB): Map<string, number | null> {
  const rows = db.select().from(priceEstimates).all();
  return new Map(rows.map((r) => [`${r.gameId}:${r.condition}`, r.estimate]));
}

/** Value of one item: manual price wins, else the estimate, else null. */
export function resolveItemValue(item: { manualPrice: number | null }, estimate: number | null): number | null {
  if (item.manualPrice !== null && item.manualPrice !== undefined) return item.manualPrice;
  return estimate;
}
