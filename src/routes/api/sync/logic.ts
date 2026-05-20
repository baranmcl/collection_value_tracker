import type { DB } from '$lib/db/client';
import { syncCatalog, type FetchPage, type SyncResult } from '$lib/sources/sync';
import type { Platform } from '$lib/sources/platforms';

export interface RunSyncOptions {
  apiKey: string;
  platforms: Platform[];
  fetchPage: FetchPage;
}

export async function runSync(db: DB, opts: RunSyncOptions): Promise<SyncResult> {
  if (!opts.apiKey) throw new Error('TheGamesDB API key is not configured');
  return syncCatalog(db, { platforms: opts.platforms, fetchPage: opts.fetchPage, onProgress: () => {} });
}
