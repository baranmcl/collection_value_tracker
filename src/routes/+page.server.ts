import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { dashboardData } from '$lib/server/dashboard';
import { topMovers } from '$lib/db/queries/refresh';

export const load: PageServerLoad = async () => {
  const data = dashboardData(db);
  // previousTotal = current total minus the sum of mover deltas
  const moverDeltaSum = topMovers(db, 1000).reduce((s, m) => s + m.delta, 0);
  return { ...data, previousTotal: data.totalValue - moverDeltaSum };
};
