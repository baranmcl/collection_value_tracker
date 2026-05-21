// ABOUTME: eBay Browse API search client — calls item_summary/search and
// ABOUTME: shapes the response into Listing[]; throws EbayError on failure.
import type { Condition } from '$lib/types';
import { EbayError } from './errors';
import type { Listing } from './filter';

const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const VIDEO_GAME_CATEGORY = '139973';

export interface SearchOptions {
  limit?: number;
  fetchFn?: typeof fetch;
}

interface ItemSummary {
  title?: string;
  price?: { value?: string; currency?: string };
  conditionId?: string;
}

/** Search eBay active Buy-It-Now listings for a game in a condition. */
export async function searchListings(
  token: string,
  query: string,
  condition: Condition,
  opts: SearchOptions = {}
): Promise<Listing[]> {
  const fetchFn = opts.fetchFn ?? fetch;
  const filters = ['buyingOptions:{FIXED_PRICE}'];
  if (condition === 'new') filters.push('conditionIds:{1000|1500}');
  const params = new URLSearchParams({
    q: query,
    category_ids: VIDEO_GAME_CATEGORY,
    filter: filters.join(','),
    limit: String(opts.limit ?? 50)
  });
  const res = await fetchFn(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }
  });
  if (!res.ok) throw new EbayError(res.status, `eBay search failed: ${res.status}`);
  const body = (await res.json()) as { itemSummaries?: ItemSummary[] };
  const summaries = body.itemSummaries ?? [];

  const listings: Listing[] = [];
  for (const s of summaries) {
    if (s.price?.currency !== 'USD') continue;
    const value = Number(s.price.value);
    if (!Number.isFinite(value) || value < 0) continue;
    const rawCondition = s.conditionId !== undefined ? Number(s.conditionId) : NaN;
    listings.push({
      priceCents: Math.round(value * 100),
      title: s.title ?? '',
      conditionId: Number.isFinite(rawCondition) ? rawCondition : null
    });
  }
  return listings;
}
