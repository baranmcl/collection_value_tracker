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
  it('normalizes a known TheGamesDB platform name to the display name', () => {
    expect(normalizeConsoleName('Super Nintendo (SNES)')).toBe('SNES');
    expect(normalizeConsoleName('Unknown Platform')).toBe('Unknown Platform');
  });
});
