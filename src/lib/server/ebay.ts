import { env } from '$env/dynamic/private';
import { createTokenProvider } from '$lib/sources/ebay/auth';
import { searchListings } from '$lib/sources/ebay/client';
import type { SearchFn } from '$lib/sources/refresh';
import type { Condition } from '$lib/types';

let provider: ReturnType<typeof createTokenProvider> | null = null;

/** A SearchFn backed by the real eBay API. Throws if credentials are missing —
 *  use for the refresh endpoint, where eBay is required. */
export function ebaySearch(): SearchFn {
  if (!env.EBAY_APP_ID || !env.EBAY_CLIENT_SECRET) {
    throw new Error('eBay credentials missing — set EBAY_APP_ID and EBAY_CLIENT_SECRET in .env');
  }
  provider ??= createTokenProvider({ appId: env.EBAY_APP_ID, clientSecret: env.EBAY_CLIENT_SECRET });
  return async (query: string, condition: Condition) => {
    const token = await provider!.getToken();
    return searchListings(token, query, condition);
  };
}

/** Like `ebaySearch`, but returns `null` instead of throwing when eBay is not
 *  configured — use where pricing is best-effort (e.g. adding a game). */
export function optionalEbaySearch(): SearchFn | null {
  if (!env.EBAY_APP_ID || !env.EBAY_CLIENT_SECRET) return null;
  return ebaySearch();
}
