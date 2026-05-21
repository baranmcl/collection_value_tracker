// ABOUTME: Accent-insensitive text normalization — strips diacritics and
// ABOUTME: lowercases, so a plain-ASCII search matches accented titles.

/** Normalize a string for accent-insensitive comparison: NFD-decompose,
 *  drop combining marks, lowercase. "Pokémon" → "pokemon". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
