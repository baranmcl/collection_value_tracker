/** Platforms synced from TheGamesDB. thegamesdbId values are confirmed
 *  during Verification Item #1; adjust here if the API differs. */
export interface Platform {
  thegamesdbId: number;
  name: string; // display name used as games.console
}

export const PLATFORMS: Platform[] = [
  { thegamesdbId: 2, name: 'GameCube' },
  { thegamesdbId: 3, name: 'N64' },
  { thegamesdbId: 4, name: 'Game Boy' },
  { thegamesdbId: 41, name: 'Game Boy Color' },
  { thegamesdbId: 5, name: 'Game Boy Advance' }
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

/** The year each console launched, keyed by the display `name` above. A
 *  catalog entry dated before its console existed is bad data — often
 *  homebrew with a placeholder/epoch date — so the Browse "hide likely
 *  homebrew" filter excludes those too. */
export const CONSOLE_RELEASE_YEAR: Record<string, number> = {
  GameCube: 2001,
  N64: 1996,
  'Game Boy': 1989,
  'Game Boy Color': 1998,
  'Game Boy Advance': 2001
};
