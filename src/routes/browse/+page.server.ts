import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { consoleCounts, browseGames } from '$lib/db/queries/games';
import { ownedConditionsByGame } from '$lib/db/queries/collection';
import { estimateMap } from '$lib/db/queries/prices';
import { CONDITIONS } from '$lib/types';
import { CONSOLE_RELEASE_YEAR, CONSOLE_END_YEAR } from '$lib/sources/platforms';
import { fold } from '$lib/fold';

const PAGE_SIZE = 100;
const SHOW_VALUES = ['all', 'owned', 'unowned', 'loose', 'cib', 'new'] as const;
type Show = (typeof SHOW_VALUES)[number];

export const load: PageServerLoad = async ({ url }) => {
  const consoles = consoleCounts(db);
  const selectedConsole = url.searchParams.get('console') ?? consoles[0]?.console ?? '';
  const query = url.searchParams.get('q') ?? '';
  const showParam = url.searchParams.get('show') ?? 'all';
  const show: Show = (SHOW_VALUES as readonly string[]).includes(showParam) ? (showParam as Show) : 'all';
  const hideHomebrew = url.searchParams.get('homebrew') !== 'show';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  const start = CONSOLE_RELEASE_YEAR[selectedConsole];
  const homebrewBounds =
    hideHomebrew && start !== undefined
      ? { start, end: CONSOLE_END_YEAR[selectedConsole] ?? null }
      : null;

  const { games, totalCount } = browseGames(
    db,
    { console: selectedConsole, query: fold(query.trim()), show, homebrewBounds },
    page,
    PAGE_SIZE
  );

  const estimates = estimateMap(db);
  const owned = ownedConditionsByGame(db);
  const gamesList = games.map((g) => ({
    id: g.id,
    title: g.title,
    console: g.console,
    region: g.region,
    releaseYear: g.releaseYear,
    boxartUrl: g.boxartUrl,
    ownedConditions: owned.get(g.id) ?? [],
    estimates: Object.fromEntries(
      CONDITIONS.map((c) => [c, estimates.get(`${g.id}:${c}`) ?? null])
    ) as Record<string, number | null>
  }));

  return {
    consoles,
    selectedConsole,
    games: gamesList,
    totalCount,
    page,
    pageSize: PAGE_SIZE,
    query,
    show,
    hideHomebrew
  };
};
