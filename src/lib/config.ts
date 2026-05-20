type RawEnv = Record<string, string | undefined>;

export interface CredentialStatus {
  thegamesdb: boolean;
  ebay: boolean;
}

/** Reports presence of credentials. Never returns the secret values. */
export function credentialStatus(env: RawEnv): CredentialStatus {
  const has = (k: string) => Boolean(env[k] && env[k]!.trim() !== '');
  return {
    thegamesdb: has('THEGAMESDB_API_KEY'),
    ebay: has('EBAY_APP_ID') && has('EBAY_CLIENT_SECRET')
  };
}
