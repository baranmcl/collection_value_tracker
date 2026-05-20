import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/db/client';
import { PLATFORMS } from '$lib/sources/platforms';
import { fetchPlatformGames } from '$lib/sources/thegamesdb';
import { runSync } from './logic';

export const POST: RequestHandler = async ({ request }) => {
  const apiKey = env.THEGAMESDB_API_KEY ?? '';
  // Optional { platformIds: number[] } body — sync only those consoles.
  // Empty or absent means sync every configured platform.
  const body = (await request.json().catch(() => ({}))) as { platformIds?: number[] };
  const ids = body.platformIds;
  const platforms =
    ids && ids.length > 0 ? PLATFORMS.filter((p) => ids.includes(p.thegamesdbId)) : PLATFORMS;
  try {
    const result = await runSync(db, {
      apiKey,
      platforms,
      fetchPage: (id, name, page) => fetchPlatformGames(apiKey, id, name, page)
    });
    return json(result);
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'sync failed');
  }
};
