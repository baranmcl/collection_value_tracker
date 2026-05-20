import { describe, it, expect } from 'vitest';
import { formatCents, parseDollars } from './money';

describe('formatCents', () => {
  it('formats cents as dollars', () => {
    expect(formatCents(17244)).toBe('$172.44');
    expect(formatCents(0)).toBe('$0.00');
  });
  it('renders null as an em dash', () => {
    expect(formatCents(null)).toBe('—');
  });
});

describe('parseDollars', () => {
  it('parses dollar input to integer cents', () => {
    expect(parseDollars('172.44')).toBe(17244);
    expect(parseDollars('$1,200')).toBe(120000);
  });
  it('rounds to the nearest cent (no float drift)', () => {
    expect(parseDollars('0.1')).toBe(10);
    expect(Number.isInteger(parseDollars('19.99'))).toBe(true);
  });
  it('rejects negative and non-numeric input', () => {
    expect(parseDollars('-5')).toBeNull();
    expect(parseDollars('abc')).toBeNull();
    expect(parseDollars('')).toBeNull();
  });
});
