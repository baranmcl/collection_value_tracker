// ABOUTME: Assembles the dashboard's data — total value, per-console
// ABOUTME: breakdown, top movers, and value history.
import type { DB } from '$lib/db/client';
import { listCollection } from '$lib/db/queries/collection';
import { collectionTotalCents, estimateMap, resolveItemValue } from '$lib/db/queries/prices';
import { topMovers, latestRefreshEvent, valueHistory, type Mover, type ValuePoint } from '$lib/db/queries/refresh';

export interface DashboardData {
  totalValue: number;
  itemCount: number;
  unvaluedCount: number;
  byConsole: { console: string; count: number; value: number }[];
  movers: Mover[];
  lastRefreshAt: Date | null;
  valueHistory: ValuePoint[];
}

export function dashboardData(db: DB): DashboardData {
  const items = listCollection(db);
  const estimates = estimateMap(db);

  let unvaluedCount = 0;
  // Every owned item contributes to its console's count; only valued items
  // contribute to its value — so a console with no estimates still appears.
  const byConsoleMap = new Map<string, { count: number; value: number }>();

  for (const item of items) {
    const est = estimates.get(`${item.gameId}:${item.condition}`) ?? null;
    const value = resolveItemValue(item, est);
    const entry = byConsoleMap.get(item.console) ?? { count: 0, value: 0 };
    entry.count += 1;
    if (value === null) {
      unvaluedCount++;
    } else {
      entry.value += value;
    }
    byConsoleMap.set(item.console, entry);
  }

  const byConsole = [...byConsoleMap.entries()]
    .map(([console, { count, value }]) => ({ console, count, value }))
    .sort((a, b) => b.value - a.value || b.count - a.count);

  return {
    totalValue: collectionTotalCents(db),
    itemCount: items.length,
    unvaluedCount,
    byConsole,
    movers: topMovers(db, 5),
    lastRefreshAt: latestRefreshEvent(db)?.triggeredAt ?? null,
    valueHistory: valueHistory(db)
  };
}
