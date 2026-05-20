import { describe, it, expect } from 'vitest';
import { buildQuery } from './query';

const GAME = { title: 'Chrono Trigger', console: 'SNES' };

describe('buildQuery', () => {
  it('includes title and console', () => {
    expect(buildQuery(GAME, 'loose')).toContain('Chrono Trigger');
    expect(buildQuery(GAME, 'loose')).toContain('SNES');
  });
  it('adds loose keywords for loose condition', () => {
    expect(buildQuery(GAME, 'loose').toLowerCase()).toContain('loose');
  });
  it('adds sealed/new keywords for new condition', () => {
    const q = buildQuery(GAME, 'new').toLowerCase();
    expect(q.includes('sealed') || q.includes('new')).toBe(true);
  });
  it('adds complete keywords for cib condition', () => {
    expect(buildQuery(GAME, 'cib').toLowerCase()).toContain('complete');
  });
});
