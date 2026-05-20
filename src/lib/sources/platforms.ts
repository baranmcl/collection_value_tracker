/** Platforms synced from TheGamesDB. thegamesdbId values are confirmed
 *  during Verification Item #1; adjust here if the API differs. */
export interface Platform {
  thegamesdbId: number;
  name: string; // display name used as games.console
}

export const PLATFORMS: Platform[] = [
  { thegamesdbId: 6, name: 'SNES' },
  { thegamesdbId: 7, name: 'NES' },
  { thegamesdbId: 3, name: 'N64' },
  { thegamesdbId: 4, name: 'Game Boy' },
  { thegamesdbId: 5, name: 'Game Boy Advance' },
  { thegamesdbId: 10, name: 'Sega Genesis' },
  { thegamesdbId: 11, name: 'PlayStation' },
  { thegamesdbId: 12, name: 'PlayStation 2' }
];

const BY_RAW_NAME: Record<string, string> = {
  'Super Nintendo (SNES)': 'SNES',
  'Nintendo Entertainment System (NES)': 'NES',
  'Nintendo 64': 'N64'
};

/** Map a raw TheGamesDB platform name to the display name. Unknown → unchanged. */
export function normalizeConsoleName(raw: string): string {
  return BY_RAW_NAME[raw] ?? raw;
}
