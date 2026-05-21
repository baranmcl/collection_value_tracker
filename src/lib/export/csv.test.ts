import { describe, it, expect } from 'vitest';
import { collectionToCsv } from './csv';
import type { EnrichedItem } from '$lib/server/collection';

function item(over: Partial<EnrichedItem>): EnrichedItem {
  return {
    id: 1, gameId: 1, title: 'Chrono Trigger', console: 'SNES', boxartUrl: null,
    condition: 'loose', grade: 'mint', notes: null, acquiredAt: '2024-01-15',
    manualPrice: null, value: 4200, valueSource: 'estimate',
    estimatedAt: null, listingCount: 5, ...over
  };
}

describe('collectionToCsv', () => {
  it('emits the header row first', () => {
    expect(collectionToCsv([])).toBe(
      'Title,Console,Condition,Grade,Value (USD),Value Source,Acquired,Notes'
    );
  });

  it('renders a plain item row with a bare dollar value and the condition label', () => {
    const csv = collectionToCsv([item({})]);
    expect(csv.split('\r\n')[1]).toBe('Chrono Trigger,SNES,Loose,mint,42.00,estimate,2024-01-15,');
  });

  it('quotes a field with a comma, a quote, or a newline and doubles inner quotes', () => {
    const csv = collectionToCsv([item({ notes: 'has, comma and "quote"\nand newline' })]);
    const row = csv.split('\r\n')[1];
    expect(row.endsWith('"has, comma and ""quote""\nand newline"')).toBe(true);
  });

  it('renders null grade, acquired, and value as empty cells', () => {
    const csv = collectionToCsv([item({ grade: null, acquiredAt: null, value: null })]);
    expect(csv.split('\r\n')[1]).toBe('Chrono Trigger,SNES,Loose,,,estimate,,');
  });

  it('formats a non-round cents value as dollars and cents', () => {
    const csv = collectionToCsv([item({ value: 4250 })]);
    expect(csv.split('\r\n')[1]).toBe('Chrono Trigger,SNES,Loose,mint,42.50,estimate,2024-01-15,');
  });

  it('separates records with CRLF', () => {
    const csv = collectionToCsv([item({ id: 1 }), item({ id: 2, title: 'Zelda' })]);
    expect(csv.split('\r\n').length).toBe(3); // header + 2 rows
  });
});
