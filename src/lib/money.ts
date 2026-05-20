/** Format integer cents as a USD string. null → em dash. */
export function formatCents(cents: number | null): string {
  if (cents === null) return '—';
  return '$' + (cents / 100).toFixed(2);
}

/** Parse a user-typed dollar amount to integer cents. Invalid/negative → null. */
export function parseDollars(input: string): number | null {
  if (input.trim().startsWith('-')) return null;
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}
