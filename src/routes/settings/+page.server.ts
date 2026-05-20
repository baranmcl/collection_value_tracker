import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/db/client';
import { sql } from 'drizzle-orm';
import { games } from '$lib/db/schema';
import { credentialStatus } from '$lib/config';
import { listRefreshEvents, latestRefreshEvent } from '$lib/db/queries/refresh';
import { listCollection } from '$lib/db/queries/collection';
import { PLATFORMS } from '$lib/sources/platforms';

export const load: PageServerLoad = async () => {
  const gameCount = db.select({ c: sql<number>`count(*)` }).from(games).get()?.c ?? 0;
  const lastSynced = db.select({ t: sql<number>`max(last_synced_at)` }).from(games).get()?.t ?? null;
  return {
    gameCount,
    lastSyncedAt: lastSynced ? new Date(lastSynced * 1000) : null,
    ownedItemCount: listCollection(db).length,
    lastRefreshAt: latestRefreshEvent(db)?.triggeredAt ?? null,
    credentials: credentialStatus(env),
    refreshHistory: listRefreshEvents(db, 10),
    platforms: PLATFORMS
  };
};
