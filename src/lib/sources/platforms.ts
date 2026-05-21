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
  { thegamesdbId: 5, name: 'Game Boy Advance' },
  { thegamesdbId: 8, name: 'Nintendo DS' },
  { thegamesdbId: 4912, name: 'Nintendo 3DS' },
  { thegamesdbId: 9, name: 'Wii' },
  { thegamesdbId: 4971, name: 'Switch' }
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
  'Game Boy Advance': 2001,
  'Nintendo DS': 2004,
  'Nintendo 3DS': 2011,
  Wii: 2006,
  Switch: 2017
};

/** The last year each console received commercial releases. A catalog
 *  entry dated after this is homebrew/fan-made. A console still in
 *  production (Switch) is intentionally absent — its current-era games
 *  cannot be told apart from homebrew by release year. */
export const CONSOLE_END_YEAR: Record<string, number> = {
  GameCube: 2009,
  N64: 2009,
  'Game Boy': 2009,
  'Game Boy Color': 2009,
  'Game Boy Advance': 2009,
  'Nintendo DS': 2014,
  'Nintendo 3DS': 2023,
  Wii: 2014
};
