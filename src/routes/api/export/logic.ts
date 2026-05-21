// ABOUTME: Builds the collection-CSV download response — the enriched
// ABOUTME: collection rendered to CSV with the right headers and filename.
import type { DB } from '$lib/db/client';
import { enrichedCollection } from '$lib/server/collection';
import { collectionToCsv } from '$lib/export/csv';

/** A CSV-download Response for the whole collection. `now` dates the filename. */
export function exportCsv(db: DB, now: Date): Response {
  const csv = collectionToCsv(enrichedCollection(db));
  const date = now.toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="collection-${date}.csv"`
    }
  });
}
