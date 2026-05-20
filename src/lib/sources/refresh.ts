import { asc, eq, isNull } from 'drizzle-orm';
import type { DB } from '$lib/db/client';
import { collectionItems, refreshEvents } from '$lib/db/schema';
import { getGame } from '$lib/db/queries/games';
import { getEstimate, upsertEstimate } from '$lib/db/queries/prices';
import { createRefreshEvent, insertSnapshot } from '$lib/db/queries/refresh';
import { estimateFromListings } from './ebay/estimate';
import { buildQuery } from './ebay/query';
import type { Condition } from '$lib/types';

/** Runs an eBay search for a query, returning listing prices in cents. */
export type SearchFn = (query: string) => Promise<number[]>;

export interface Pair {
  gameId: number;
  condition: string;
}

/** Estimate one (game, condition) pair and persist the estimate. */
export async function estimatePair(db: DB, pair: Pair, search: SearchFn): Promise<void> {
  const game = getGame(db, pair.gameId);
  if (!game) return;
  const prices = await search(buildQuery(game, pair.condition as Condition));
  const { estimate, listingCount } = estimateFromListings(prices);
  upsertEstimate(db, { gameId: pair.gameId, condition: pair.condition as Condition, estimate, listingCount });
}

export interface RefreshOptions {
  search: SearchFn;
  onProgress: (pairsDone: number, total: number) => void;
}

export interface RefreshResult {
  itemsUpdated: number;
  errors: number;
  refreshEventId: number;
}

/**
 * Owned (game, condition) pairs that have at least one item WITHOUT a manual
 * price — those are the pairs an eBay estimate is still useful for. A pair
 * is skipped only when every copy is manually priced. `selectDistinct` over
 * the `manualPrice IS NULL` rows yields exactly that set in one query.
 */
function pairsToRefresh(db: DB): Pair[] {
  return db
    .selectDistinct({ gameId: collectionItems.gameId, condition: collectionItems.condition })
    .from(collectionItems)
    .where(isNull(collectionItems.manualPrice))
    .orderBy(asc(collectionItems.gameId), asc(collectionItems.condition))
    .all();
}

/** Re-estimate every owned pair, snapshot changed estimates, record one refresh event. */
export async function refreshEstimates(db: DB, opts: RefreshOptions): Promise<RefreshResult> {
  const pairs = pairsToRefresh(db);
  const eventId = createRefreshEvent(db, { source: `ebay_browse:${new Date().toISOString()}`, itemsUpdated: 0, errors: 0 });

  let itemsUpdated = 0;
  let errors = 0;

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    try {
      const before = getEstimate(db, pair.gameId, pair.condition)?.estimate ?? null;
      await estimatePair(db, pair, opts.search);
      const after = getEstimate(db, pair.gameId, pair.condition);
      if (after && after.estimate !== null) {
        insertSnapshot(db, {
          gameId: pair.gameId,
          condition: pair.condition,
          estimate: after.estimate,
          listingCount: after.listingCount,
          refreshEventId: eventId
        });
        // The estimate "changed" when it differs from the prior value
        // (a first-time estimate from null counts as a change).
        if (after.estimate !== before) itemsUpdated++;
      }
    } catch {
      errors++;
    }
    opts.onProgress(i + 1, pairs.length);
  }

  db.update(refreshEvents).set({ itemsUpdated, errors }).where(eq(refreshEvents.id, eventId)).run();
  return { itemsUpdated, errors, refreshEventId: eventId };
}
