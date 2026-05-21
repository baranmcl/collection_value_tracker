// ABOUTME: The value-resolved collection — every owned item with its resolved
// ABOUTME: value, value source, and (when estimate-sourced) estimate metadata.
import type { DB } from '$lib/db/client';
import { listCollection } from '$lib/db/queries/collection';
import { estimateRecords, resolveItemValue } from '$lib/db/queries/prices';

export interface EnrichedItem {
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
  value: number | null; // resolved, integer cents
  valueSource: 'manual' | 'estimate' | 'unknown';
  estimatedAt: Date | null; // the estimate's computedAt, when valueSource === 'estimate'
  listingCount: number | null; // the estimate's listingCount, when valueSource === 'estimate'
}

/** Every collection item with its resolved value and estimate metadata.
 *  Row order is listCollection's — alphabetical by title. */
export function enrichedCollection(db: DB): EnrichedItem[] {
  const rows = listCollection(db);
  const estimates = estimateRecords(db);
  return rows.map((r) => {
    const est = estimates.get(`${r.gameId}:${r.condition}`) ?? null;
    const value = resolveItemValue(r, est?.estimate ?? null);
    const valueSource: EnrichedItem['valueSource'] =
      r.manualPrice !== null ? 'manual' : est?.estimate != null ? 'estimate' : 'unknown';
    const fromEstimate = valueSource === 'estimate';
    return {
      id: r.id,
      gameId: r.gameId,
      title: r.title,
      console: r.console,
      boxartUrl: r.boxartUrl,
      condition: r.condition,
      grade: r.grade,
      notes: r.notes,
      acquiredAt: r.acquiredAt,
      manualPrice: r.manualPrice,
      value,
      valueSource,
      estimatedAt: fromEstimate ? est!.computedAt : null,
      listingCount: fromEstimate ? est!.listingCount : null
    };
  });
}
