import { describe, it, expect } from 'vitest';
import { EbayError, classifyError } from './errors';

describe('EbayError', () => {
  it('carries the HTTP status, message, and is an Error', () => {
    const e = new EbayError(429, 'eBay search failed: 429');
    expect(e.status).toBe(429);
    expect(e.message).toBe('eBay search failed: 429');
    expect(e.name).toBe('EbayError');
    expect(e).toBeInstanceOf(Error);
  });
});

describe('classifyError', () => {
  it('classifies 401 and 403 as auth', () => {
    expect(classifyError(new EbayError(401, 'x'))).toBe('auth');
    expect(classifyError(new EbayError(403, 'x'))).toBe('auth');
  });
  it('classifies 429 as rate_limit', () => {
    expect(classifyError(new EbayError(429, 'x'))).toBe('rate_limit');
  });
  it('classifies other EbayError statuses as other', () => {
    expect(classifyError(new EbayError(500, 'x'))).toBe('other');
    expect(classifyError(new EbayError(404, 'x'))).toBe('other');
  });
  it('classifies a plain Error and non-Error values as other', () => {
    expect(classifyError(new Error('network down'))).toBe('other');
    expect(classifyError('boom')).toBe('other');
    expect(classifyError(undefined)).toBe('other');
  });
});
