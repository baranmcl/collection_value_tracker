import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/db/client';
import { PLATFORMS } from '$lib/sources/platforms';
import { fetchPlatformGames } from '$lib/sources/thegamesdb';
import { runSync } from './logic';

export const POST: RequestHandler = async () => {
  const apiKey = env.THEGAMESDB_API_KEY ?? '';
  try {
    const result = await runSync(db, {
      apiKey,
      platforms: PLATFORMS,
      fetchPage: (id, name, page) => fetchPlatformGames(apiKey, id, name, page)
    });
    return json(result);
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'sync failed');
  }
};
