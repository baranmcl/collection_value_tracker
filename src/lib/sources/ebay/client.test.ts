import { describe, it, expect, vi } from 'vitest';
import { searchListings } from './client';

const SAMPLE = {
  itemSummaries: [
    { title: 'Chrono Trigger SNES loose', price: { value: '172.44', currency: 'USD' }, conditionId: '3000' },
    { title: 'Chrono Trigger cart only', price: { value: '160.00', currency: 'USD' }, conditionId: '3000' },
    { title: 'Chrono Trigger EUR', price: { value: '90.00', currency: 'EUR' }, conditionId: '3000' }
  ]
};

describe('searchListings', () => {
  it('returns USD listing prices as integer cents', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 }));
    const listings = await searchListings('TOKEN', 'chrono trigger snes', { fetchFn: f });
    expect(listings).toEqual([17244, 16000]); // EUR listing dropped
  });

  it('sends the auth token and US marketplace header', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ itemSummaries: [] }), { status: 200 }));
    await searchListings('TOKEN', 'q', { fetchFn: f });
    const [, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe('Bearer TOKEN');
    expect(init.headers['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_US');
  });

  it('returns an empty array when eBay reports no results', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    expect(await searchListings('TOKEN', 'q', { fetchFn: f })).toEqual([]);
  });

  it('throws on a non-200 response', async () => {
    const f = vi.fn(async () => new Response('err', { status: 500 }));
    await expect(searchListings('TOKEN', 'q', { fetchFn: f })).rejects.toThrow(/eBay search/);
  });
});
