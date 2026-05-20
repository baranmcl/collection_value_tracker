import type { CatalogGame } from '$lib/db/queries/games';

const BASE = 'https://api.thegamesdb.net';

interface ApiGame {
  id: number;
  game_title: string;
  release_date?: string;
  region_id?: number;
}

interface BoxartRecord {
  type?: string;
  side?: string;
  filename?: string;
}

const REGION_BY_ID: Record<number, string> = { 1: 'NTSC', 2: 'NTSC-J', 3: 'PAL' };

/** Map one raw TheGamesDB game record to a CatalogGame. */
export function mapApiGame(
  g: ApiGame,
  consoleName: string,
  boxartUrl: string | null = null
): CatalogGame {
  const year = g.release_date ? Number(g.release_date.slice(0, 4)) : NaN;
  return {
    id: g.id,
    console: consoleName,
    title: g.game_title,
    region: g.region_id ? (REGION_BY_ID[g.region_id] ?? null) : null,
    releaseYear: Number.isFinite(year) ? year : null,
    boxartUrl
  };
}

export interface PlatformPage {
  games: CatalogGame[];
  nextPage: number | null;
}

/** Fetch one page of games for a platform. Pure over `fetch` — injectable in tests. */
export async function fetchPlatformGames(
  apiKey: string,
  platformId: number,
  consoleName: string,
  page: number,
  fetchFn: typeof fetch = fetch
): Promise<PlatformPage> {
  // include=boxart returns cover images inline — same request, no extra call.
  const url = `${BASE}/v1/Games/ByPlatformID?apikey=${apiKey}&id=${platformId}&page=${page}&include=boxart`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`TheGamesDB ${res.status} for platform ${platformId} page ${page}`);
  const body = (await res.json()) as {
    data?: { games?: ApiGame[] };
    pages?: { next?: string | null };
    include?: {
      boxart?: {
        base_url?: { thumb?: string };
        data?: Record<string, BoxartRecord[]>;
      };
    };
  };
  const raw = body.data?.games ?? [];

  // Build each game's front-cover thumbnail URL from the boxart include.
  const thumbBase = body.include?.boxart?.base_url?.thumb ?? '';
  const boxartData = body.include?.boxart?.data ?? {};
  const frontBoxart = (gameId: number): string | null => {
    if (!thumbBase) return null;
    const front = (boxartData[String(gameId)] ?? []).find(
      (a) => a.type === 'boxart' && a.side === 'front' && a.filename
    );
    return front?.filename ? thumbBase + front.filename : null;
  };

  return {
    games: raw.map((g) => mapApiGame(g, consoleName, frontBoxart(g.id))),
    nextPage: body.pages?.next ? page + 1 : null
  };
}
