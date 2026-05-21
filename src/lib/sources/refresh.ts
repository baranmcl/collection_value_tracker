// ABOUTME: Price-estimate orchestration — estimates one (game, condition) pair
// ABOUTME: and re-estimates every owned pair, recording snapshots and events.
import { asc, isNull } from 'drizzle-orm';
import type { DB } from '$lib/db/client';
import { collectionItems } from '$lib/db/schema';
import { getGame } from '$lib/db/queries/games';
import { getEstimate, upsertEstimate } from '$lib/db/queries/prices';
import { createRefreshEvent, insertSnapshot, updateRefreshEvent } from '$lib/db/queries/refresh';
import { classifyError, type ErrorReason } from './ebay/errors';
import { estimateFromListings } from './ebay/estimate';
import { buildQuery } from './ebay/query';
import { filterListings } from './ebay/filter';
import type { Listing } from './ebay/filter';
import type { Condition } from '$lib/types';

/** Runs an eBay search for a query + condition, returning matching listings. */
export type SearchFn = (query: string, condition: Condition) => Promise<Listing[]>;

export interface Pair {
  gameId: number;
  condition: string;
}

/** Estimate one (game, condition) pair and persist the estimate. */
export async function estimatePair(db: DB, pair: Pair, search: SearchFn): Promise<void> {
  const game = getGame(db, pair.gameId);
  if (!game) return;
  const condition = pair.condition as Condition;
  const listings = await search(buildQuery(game, condition), condition);
  const kept = filterListings(listings, game, condition);
  const { estimate, listingCount } = estimateFromListings(kept.map((l) => l.priceCents));
  upsertEstimate(db, { gameId: pair.gameId, condition, estimate, listingCount });
}

export interface RefreshOptions {
  search: SearchFn;
  onProgress: (pairsDone: number, total: number) => void;
}

export interface RefreshResult {
  itemsUpdated: number;
  errors: number;
  errorsByReason: Record<ErrorReason, number>;
  aborted: boolean;
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

/** Compact human summary of a run's failures, or null when there were none. */
function summarizeErrors(byReason: Record<ErrorReason, number>, aborted: boolean): string | null {
  const parts = (['auth', 'rate_limit', 'other'] as const)
    .filter((r) => byReason[r] > 0)
    .map((r) => `${r}×${byReason[r]}`);
  if (parts.length === 0) return null;
  return parts.join('; ') + (aborted ? ' (aborted)' : '');
}

/** Re-estimate every owned pair, snapshot changed estimates, record one refresh event. */
export async function refreshEstimates(db: DB, opts: RefreshOptions): Promise<RefreshResult> {
  const pairs = pairsToRefresh(db);
  const eventId = createRefreshEvent(db, { source: `ebay_browse:${new Date().toISOString()}`, itemsUpdated: 0, errors: 0 });

  let itemsUpdated = 0;
  const errorsByReason: Record<ErrorReason, number> = { auth: 0, rate_limit: 0, other: 0 };
  let aborted = false;

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
    } catch (e) {
      const reason = classifyError(e);
      errorsByReason[reason]++;
      // auth and rate_limit are fatal — continuing burns quota and fails
      // every remaining pair. Stop the run; later pairs keep their estimates.
      if (reason === 'auth' || reason === 'rate_limit') {
        aborted = true;
        opts.onProgress(i + 1, pairs.length);
        break;
      }
    }
    opts.onProgress(i + 1, pairs.length);
  }

  const errors = errorsByReason.auth + errorsByReason.rate_limit + errorsByReason.other;
  updateRefreshEvent(db, eventId, { itemsUpdated, errors, errorSummary: summarizeErrors(errorsByReason, aborted) });
  return { itemsUpdated, errors, errorsByReason, aborted, refreshEventId: eventId };
}
