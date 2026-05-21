import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { enrichedCollection } from '$lib/server/collection';
import { relativeAge, isStale } from '$lib/estimate-quality';

export const load: PageServerLoad = async () => {
  const now = new Date();
  const items = enrichedCollection(db).map((i) => ({
    id: i.id,
    gameId: i.gameId,
    title: i.title,
    console: i.console,
    boxartUrl: i.boxartUrl,
    condition: i.condition,
    grade: i.grade,
    notes: i.notes,
    acquiredAt: i.acquiredAt,
    manualPrice: i.manualPrice,
    value: i.value,
    valueSource: i.valueSource,
    estimateAge: i.estimatedAt ? relativeAge(i.estimatedAt, now) : null,
    estimateStale: i.estimatedAt ? isStale(i.estimatedAt, now) : false,
    listingCount: i.listingCount
  }));

  const valued = items.filter((i) => i.value !== null) as { value: number }[];
  const totalValue = valued.reduce((s, i) => s + i.value, 0);
  return {
    items,
    totalValue,
    averageValue: valued.length ? Math.round(totalValue / valued.length) : 0
  };
};
