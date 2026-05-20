import type { DB } from '$lib/db/client';
import { listCollection } from '$lib/db/queries/collection';
import { estimateMap, resolveItemValue } from '$lib/db/queries/prices';
import { topMovers, latestRefreshEvent, type Mover } from '$lib/db/queries/refresh';

export interface DashboardData {
  totalValue: number;
  itemCount: number;
  unvaluedCount: number;
  byConsole: { console: string; value: number }[];
  movers: Mover[];
  lastRefreshAt: Date | null;
}

export function dashboardData(db: DB): DashboardData {
  const items = listCollection(db);
  const estimates = estimateMap(db);

  let totalValue = 0;
  let unvaluedCount = 0;
  const consoleTotals = new Map<string, number>();

  for (const item of items) {
    const est = estimates.get(`${item.gameId}:${item.condition}`) ?? null;
    const value = resolveItemValue(item, est);
    if (value === null) {
      unvaluedCount++;
      continue;
    }
    totalValue += value;
    consoleTotals.set(item.console, (consoleTotals.get(item.console) ?? 0) + value);
  }

  const byConsole = [...consoleTotals.entries()]
    .map(([console, value]) => ({ console, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalValue,
    itemCount: items.length,
    unvaluedCount,
    byConsole,
    movers: topMovers(db, 5),
    lastRefreshAt: latestRefreshEvent(db)?.triggeredAt ?? null
  };
}
