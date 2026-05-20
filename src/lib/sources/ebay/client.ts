const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const VIDEO_GAME_CATEGORY = '139973';

export interface SearchOptions {
  limit?: number;
  fetchFn?: typeof fetch;
}

interface ItemSummary {
  price?: { value?: string; currency?: string };
}

/** Search eBay active Buy-It-Now listings. Returns USD prices as integer cents. */
export async function searchListings(token: string, query: string, opts: SearchOptions = {}): Promise<number[]> {
  const fetchFn = opts.fetchFn ?? fetch;
  const params = new URLSearchParams({
    q: query,
    category_ids: VIDEO_GAME_CATEGORY,
    filter: 'buyingOptions:{FIXED_PRICE}',
    limit: String(opts.limit ?? 50)
  });
  const res = await fetchFn(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }
  });
  if (!res.ok) throw new Error(`eBay search failed: ${res.status}`);
  const body = (await res.json()) as { itemSummaries?: ItemSummary[] };
  const summaries = body.itemSummaries ?? [];

  const cents: number[] = [];
  for (const s of summaries) {
    if (s.price?.currency !== 'USD') continue;
    const value = Number(s.price.value);
    if (Number.isFinite(value) && value >= 0) cents.push(Math.round(value * 100));
  }
  return cents;
}
