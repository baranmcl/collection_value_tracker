import { describe, it, expect, vi } from 'vitest';
import { searchListings } from './client';
import { EbayError } from './errors';

const SAMPLE = {
  itemSummaries: [
    { title: 'Chrono Trigger SNES loose', price: { value: '172.44', currency: 'USD' }, conditionId: '3000' },
    { title: 'Chrono Trigger cart only', price: { value: '160.00', currency: 'USD' }, conditionId: '3000' },
    { title: 'Chrono Trigger EUR', price: { value: '90.00', currency: 'EUR' }, conditionId: '3000' }
  ]
};

describe('searchListings', () => {
  it('returns USD listings with price, title, and conditionId', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 }));
    const listings = await searchListings('TOKEN', 'chrono trigger snes', 'loose', { fetchFn: f });
    expect(listings).toEqual([
      { priceCents: 17244, title: 'Chrono Trigger SNES loose', conditionId: 3000 },
      { priceCents: 16000, title: 'Chrono Trigger cart only', conditionId: 3000 }
    ]); // EUR listing dropped
  });

  it('keeps conditionId null when eBay omits it', async () => {
    const body = { itemSummaries: [{ title: 'X', price: { value: '10.00', currency: 'USD' } }] };
    const f = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    const listings = await searchListings('TOKEN', 'q', 'loose', { fetchFn: f });
    expect(listings[0].conditionId).toBeNull();
  });

  it('sends the auth token and US marketplace header', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ itemSummaries: [] }), { status: 200 }));
    await searchListings('TOKEN', 'q', 'loose', { fetchFn: f });
    const [, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe('Bearer TOKEN');
    expect(init.headers['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_US');
  });

  it('adds a conditionIds filter only for the new condition', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ itemSummaries: [] }), { status: 200 }));
    await searchListings('TOKEN', 'q', 'new', { fetchFn: f });
    const [newUrl] = f.mock.calls[0] as unknown as [string];
    expect(decodeURIComponent(newUrl)).toContain('conditionIds:{1000|1500}');

    f.mockClear();
    await searchListings('TOKEN', 'q', 'loose', { fetchFn: f });
    const [looseUrl] = f.mock.calls[0] as unknown as [string];
    expect(decodeURIComponent(looseUrl)).not.toContain('conditionIds');
  });

  it('returns an empty array when eBay reports no results', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    expect(await searchListings('TOKEN', 'q', 'loose', { fetchFn: f })).toEqual([]);
  });

  it('throws an EbayError carrying the status on a non-200 response', async () => {
    const f = vi.fn(async () => new Response('err', { status: 500 }));
    await expect(searchListings('TOKEN', 'q', 'loose', { fetchFn: f })).rejects.toBeInstanceOf(EbayError);
    await expect(searchListings('TOKEN', 'q', 'loose', { fetchFn: f })).rejects.toMatchObject({ status: 500 });
  });
});
