import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { listCollection } from '$lib/db/queries/collection';
import { estimateMap, resolveItemValue } from '$lib/db/queries/prices';

export const load: PageServerLoad = async () => {
  const rows = listCollection(db);
  const estimates = estimateMap(db);

  const items = rows.map((r) => {
    const est = estimates.get(`${r.gameId}:${r.condition}`) ?? null;
    const value = resolveItemValue(r, est);
    return {
      id: r.id, gameId: r.gameId, title: r.title, console: r.console, boxartUrl: r.boxartUrl,
      condition: r.condition,
      grade: r.grade, notes: r.notes, acquiredAt: r.acquiredAt, manualPrice: r.manualPrice,
      value,
      valueSource: r.manualPrice !== null ? 'manual' : est !== null ? 'estimate' : 'unknown'
    };
  });

  const valued = items.filter((i) => i.value !== null) as { value: number }[];
  const totalValue = valued.reduce((s, i) => s + i.value, 0);
  return {
    items,
    totalValue,
    averageValue: valued.length ? Math.round(totalValue / valued.length) : 0
  };
};
