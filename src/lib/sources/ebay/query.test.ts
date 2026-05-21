import { describe, it, expect } from 'vitest';
import { buildQuery, CONDITION_KEYWORDS } from './query';

const GAME = { title: 'Chrono Trigger', console: 'SNES' };

describe('buildQuery', () => {
  it('includes title and console', () => {
    expect(buildQuery(GAME, 'loose')).toContain('Chrono Trigger');
    expect(buildQuery(GAME, 'loose')).toContain('SNES');
  });
  it('uses strong cart/disc keywords for loose, not the bare word "loose"', () => {
    expect(buildQuery(GAME, 'loose')).toBe('Chrono Trigger SNES cart only disc only');
  });
  it('uses complete-in-box keywords for cib', () => {
    expect(buildQuery(GAME, 'cib')).toBe('Chrono Trigger SNES complete in box');
  });
  it('uses sealed keyword for new', () => {
    expect(buildQuery(GAME, 'new')).toBe('Chrono Trigger SNES sealed');
  });
});

describe('CONDITION_KEYWORDS', () => {
  it('maps each condition to its keyword string', () => {
    expect(CONDITION_KEYWORDS).toEqual({
      loose: 'cart only disc only',
      cib: 'complete in box',
      new: 'sealed'
    });
  });
});
