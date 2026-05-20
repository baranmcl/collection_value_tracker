const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SCOPE = 'https://api.ebay.com/oauth/api_scope';

export interface TokenProviderOptions {
  appId: string;
  clientSecret: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}

export interface TokenProvider {
  getToken(): Promise<string>;
}

/** Client-credentials OAuth provider. Caches the token until ~60s before expiry. */
export function createTokenProvider(opts: TokenProviderOptions): TokenProvider {
  const fetchFn = opts.fetchFn ?? fetch;
  const now = opts.now ?? Date.now;
  let cached: { token: string; expiresAt: number } | null = null;

  return {
    async getToken() {
      if (cached && now() < cached.expiresAt - 60_000) return cached.token;

      const basic = Buffer.from(`${opts.appId}:${opts.clientSecret}`).toString('base64');
      const res = await fetchFn(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`
        },
        body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`
      });
      if (!res.ok) throw new Error(`eBay auth failed: ${res.status}`);
      const body = (await res.json()) as { access_token: string; expires_in: number };
      cached = { token: body.access_token, expiresAt: now() + body.expires_in * 1000 };
      return cached.token;
    }
  };
}
