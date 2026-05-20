import type { DB } from '$lib/db/client';
import { upsertGames } from '$lib/db/queries/games';
import type { Platform } from './platforms';
import type { PlatformPage } from './thegamesdb';

export type FetchPage = (platformId: number, consoleName: string, page: number) => Promise<PlatformPage>;

export interface SyncOptions {
  platforms: Platform[];
  fetchPage: FetchPage;
  onProgress: (platformsDone: number, total: number) => void;
}

export interface SyncResult {
  gamesLoaded: number;
  platformsCovered: number;
  errors: number;
}

/** Pull each platform's games and upsert them. One failed platform does not abort the sync. */
export async function syncCatalog(db: DB, opts: SyncOptions): Promise<SyncResult> {
  let gamesLoaded = 0;
  let platformsCovered = 0;
  let errors = 0;
  const total = opts.platforms.length;

  for (let i = 0; i < total; i++) {
    const platform = opts.platforms[i];
    try {
      let page: number | null = 1;
      while (page !== null) {
        const result = await opts.fetchPage(platform.thegamesdbId, platform.name, page);
        upsertGames(db, result.games);
        gamesLoaded += result.games.length;
        page = result.nextPage;
      }
      platformsCovered++;
    } catch {
      errors++;
    }
    opts.onProgress(i + 1, total);
  }
  return { gamesLoaded, platformsCovered, errors };
}
