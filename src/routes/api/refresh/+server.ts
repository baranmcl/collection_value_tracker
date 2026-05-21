import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { ebaySearch } from '$lib/server/ebay';
import type { SearchFn } from '$lib/sources/refresh';
import { refreshStream } from './logic';

export const POST: RequestHandler = async () => {
  let search: SearchFn;
  try {
    search = ebaySearch(); // throws if eBay credentials are not configured
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'refresh failed');
  }
  return new Response(refreshStream(db, search), {
    headers: { 'content-type': 'application/x-ndjson' }
  });
};
