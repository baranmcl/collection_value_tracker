import { describe, it, expect } from 'vitest';
import { fold } from './fold';

describe('fold', () => {
  it('strips diacritics and lowercases', () => {
    expect(fold('Pokémon')).toBe('pokemon');
    expect(fold('CHRONO TRIGGER')).toBe('chrono trigger');
  });
  it('leaves plain ASCII unchanged except for case', () => {
    expect(fold('GoldenEye 007')).toBe('goldeneye 007');
  });
});
