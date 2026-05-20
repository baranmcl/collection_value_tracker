import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { ebaySearch } from '$lib/server/ebay';
import { refreshEstimates } from '$lib/sources/refresh';

export const POST: RequestHandler = async () => {
  try {
    const result = await refreshEstimates(db, { search: ebaySearch(), onProgress: () => {} });
    return json(result);
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'refresh failed');
  }
};
