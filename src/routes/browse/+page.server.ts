import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { consoleCounts, listGamesByConsole, searchGames } from '$lib/db/queries/games';
import { ownedConditionsByGame } from '$lib/db/queries/collection';
import { estimateMap } from '$lib/db/queries/prices';
import { CONDITIONS } from '$lib/types';

export const load: PageServerLoad = async ({ url }) => {
  const consoles = consoleCounts(db);
  const selectedConsole = url.searchParams.get('console') ?? consoles[0]?.console ?? '';
  const search = url.searchParams.get('q') ?? '';

  const rawGames = search
    ? searchGames(db, selectedConsole, search)
    : listGamesByConsole(db, selectedConsole);
  // Two batch queries instead of N per-game lookups.
  const estimates = estimateMap(db);
  const owned = ownedConditionsByGame(db);

  const gamesList = rawGames.map((g) => ({
    id: g.id,
    title: g.title,
    console: g.console,
    region: g.region,
    releaseYear: g.releaseYear,
    ownedConditions: owned.get(g.id) ?? [],
    estimates: Object.fromEntries(
      CONDITIONS.map((c) => [c, estimates.get(`${g.id}:${c}`) ?? null])
    ) as Record<string, number | null>
  }));

  return { consoles, selectedConsole, search, games: gamesList };
};
