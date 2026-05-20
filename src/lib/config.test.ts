import { describe, it, expect } from 'vitest';
import { credentialStatus } from './config';

describe('credentialStatus', () => {
  it('reports which credentials are present without revealing them', () => {
    const status = credentialStatus({
      THEGAMESDB_API_KEY: 'abc',
      EBAY_APP_ID: '',
      EBAY_CLIENT_SECRET: undefined
    });
    expect(status).toEqual({ thegamesdb: true, ebay: false });
  });
});
