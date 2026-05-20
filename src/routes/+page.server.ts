import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { dashboardData } from '$lib/server/dashboard';
import { topMovers } from '$lib/db/queries/refresh';

export const load: PageServerLoad = async () => {
  const data = dashboardData(db);
  // Net dollar change across games re-priced by the most recent refresh.
  const refreshDelta = topMovers(db, 1000).reduce((s, m) => s + m.delta, 0);
  return { ...data, refreshDelta };
};
