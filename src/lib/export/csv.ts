// ABOUTME: Renders the collection as RFC 4180 CSV — a header row plus one row
// ABOUTME: per item, with comma/quote/newline-bearing fields properly quoted.
import type { EnrichedItem } from '$lib/server/collection';
import { CONDITION_LABELS, type Condition } from '$lib/types';

const HEADER = ['Title', 'Console', 'Condition', 'Grade', 'Value (USD)', 'Value Source', 'Acquired', 'Notes'];

/** Quote a CSV field per RFC 4180: wrap in double quotes when it contains a
 *  comma, a double quote, CR, or LF; double any embedded quotes. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

/** Integer cents as a bare dollar string ("4200" → "42.00"); null → empty. */
function dollars(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

/** The whole collection as an RFC 4180 CSV string (CRLF record separators). */
export function collectionToCsv(items: EnrichedItem[]): string {
  const rows = items.map((i) => [
    i.title,
    i.console,
    CONDITION_LABELS[i.condition as Condition] ?? i.condition,
    i.grade ?? '',
    dollars(i.value),
    i.valueSource,
    i.acquiredAt ?? '',
    i.notes ?? ''
  ]);
  return [HEADER, ...rows].map((cols) => cols.map(csvField).join(',')).join('\r\n');
}
