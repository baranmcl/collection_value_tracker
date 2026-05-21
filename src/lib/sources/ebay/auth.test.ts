import { describe, it, expect, vi } from 'vitest';
import { createTokenProvider } from './auth';
import { EbayError } from './errors';

function fakeFetch(token: string, expiresIn = 7200) {
  return vi.fn(async () => new Response(
    JSON.stringify({ access_token: token, expires_in: expiresIn, token_type: 'Application Access Token' }),
    { status: 200 }
  ));
}

describe('createTokenProvider', () => {
  it('fetches a token and caches it across calls', async () => {
    const f = fakeFetch('TOKEN-1');
    const provider = createTokenProvider({ appId: 'id', clientSecret: 'sec', fetchFn: f, now: () => 0 });
    expect(await provider.getToken()).toBe('TOKEN-1');
    expect(await provider.getToken()).toBe('TOKEN-1');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('refetches once the cached token is within 60s of expiry', async () => {
    const f = fakeFetch('TOKEN-1', 7200);
    let clock = 0;
    const provider = createTokenProvider({ appId: 'id', clientSecret: 'sec', fetchFn: f, now: () => clock });
    await provider.getToken();
    clock = 7200_000; // ms — past expiry
    f.mockResolvedValueOnce(new Response(
      JSON.stringify({ access_token: 'TOKEN-2', expires_in: 7200, token_type: 'x' }), { status: 200 }
    ));
    expect(await provider.getToken()).toBe('TOKEN-2');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('throws a clear error on auth failure', async () => {
    const f = vi.fn(async () => new Response('bad', { status: 401 }));
    const provider = createTokenProvider({ appId: 'id', clientSecret: 'sec', fetchFn: f, now: () => 0 });
    await expect(provider.getToken()).rejects.toThrow(/eBay auth/);
  });

  it('throws an EbayError carrying the HTTP status on auth failure', async () => {
    const f = vi.fn(async () => new Response('bad', { status: 401 }));
    const provider = createTokenProvider({ appId: 'id', clientSecret: 'sec', fetchFn: f, now: () => 0 });
    await expect(provider.getToken()).rejects.toBeInstanceOf(EbayError);
    await expect(provider.getToken()).rejects.toMatchObject({ status: 401, name: 'EbayError' });
  });
});
