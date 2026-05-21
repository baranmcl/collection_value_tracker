import { describe, it, expect } from 'vitest';
import { relativeAge, isStale, isLowConfidence } from './estimate-quality';

const now = new Date('2026-05-21T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe('relativeAge', () => {
  it('reads "today" for under one day', () => {
    expect(relativeAge(ago(0), now)).toBe('today');
    expect(relativeAge(new Date(now.getTime() - 3_600_000), now)).toBe('today');
  });
  it('reads days, weeks, months, and years, rounded down', () => {
    expect(relativeAge(ago(3), now)).toBe('3d ago');
    expect(relativeAge(ago(14), now)).toBe('2w ago');
    expect(relativeAge(ago(90), now)).toBe('3mo ago');
    expect(relativeAge(ago(800), now)).toBe('2y ago');
  });
  it('switches unit exactly at the day-7 boundary', () => {
    expect(relativeAge(ago(6), now)).toBe('6d ago');
    expect(relativeAge(ago(7), now)).toBe('1w ago');
  });
});

describe('isStale', () => {
  it('is false within the 30-day window and true past it', () => {
    expect(isStale(ago(29), now)).toBe(false);
    expect(isStale(ago(31), now)).toBe(true);
  });
});

describe('isLowConfidence', () => {
  it('flags estimates built on fewer than 3 listings', () => {
    expect(isLowConfidence(0)).toBe(true);
    expect(isLowConfidence(2)).toBe(true);
    expect(isLowConfidence(3)).toBe(false);
    expect(isLowConfidence(10)).toBe(false);
  });
});
