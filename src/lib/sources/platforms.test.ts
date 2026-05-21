import { describe, it, expect } from 'vitest';
import { PLATFORMS, normalizeConsoleName, CONSOLE_RELEASE_YEAR } from './platforms';

describe('platforms', () => {
  it('has a non-empty platform list with id and display name', () => {
    expect(PLATFORMS.length).toBeGreaterThan(0);
    for (const p of PLATFORMS) {
      expect(typeof p.thegamesdbId).toBe('number');
      expect(p.name.length).toBeGreaterThan(0);
    }
  });
  it('has a launch year for every platform', () => {
    // Guards against adding a platform but forgetting CONSOLE_RELEASE_YEAR.
    for (const p of PLATFORMS) {
      expect(typeof CONSOLE_RELEASE_YEAR[p.name]).toBe('number');
    }
  });
  it('offers Nintendo DS and 3DS as syncable platforms', () => {
    const byName = new Map(PLATFORMS.map((p) => [p.name, p.thegamesdbId]));
    expect(byName.get('Nintendo DS')).toBe(8);
    expect(byName.get('Nintendo 3DS')).toBe(4912);
  });
  it('normalizes a known TheGamesDB platform name to the display name', () => {
    expect(normalizeConsoleName('Super Nintendo (SNES)')).toBe('SNES');
    expect(normalizeConsoleName('Unknown Platform')).toBe('Unknown Platform');
  });
});
