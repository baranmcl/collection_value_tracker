import { describe, it, expect } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem, updateItem } from '$lib/db/queries/collection';
import { upsertEstimate } from '$lib/db/queries/prices';
import { dashboardData } from './dashboard';

describe('dashboardData', () => {
  it('totals item value and breaks it down by console', () => {
    const db = makeTestDb();
    upsertGames(db, [
      { id: 1, console: 'SNES', title: 'A', region: null, releaseYear: null },
      { id: 2, console: 'N64', title: 'B', region: null, releaseYear: null }
    ]);
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 5000, listingCount: 3 });
    upsertEstimate(db, { gameId: 2, condition: 'cib', estimate: 8000, listingCount: 2 });

    const data = dashboardData(db);
    expect(data.totalValue).toBe(13000);
    expect(data.itemCount).toBe(2);
    expect(data.byConsole).toEqual([
      { console: 'N64', count: 1, value: 8000 },
      { console: 'SNES', count: 1, value: 5000 }
    ]);
  });

  it('uses a manual price over the estimate in the total', () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'A', region: null, releaseYear: null }]);
    const id = addItem(db, { gameId: 1, condition: 'loose' });
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 5000, listingCount: 3 });
    updateItem(db, id, { manualPrice: 12000 });
    expect(dashboardData(db).totalValue).toBe(12000);
  });

  it('counts items with no known value as zero but reports them', () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'A', region: null, releaseYear: null }]);
    addItem(db, { gameId: 1, condition: 'loose' });
    const data = dashboardData(db);
    expect(data.totalValue).toBe(0);
    expect(data.unvaluedCount).toBe(1);
  });

  it('counts items per console even when none are priced', () => {
    const db = makeTestDb();
    upsertGames(db, [
      { id: 1, console: 'Game Boy', title: 'A', region: null, releaseYear: null },
      { id: 2, console: 'Game Boy', title: 'B', region: null, releaseYear: null },
      { id: 3, console: 'N64', title: 'C', region: null, releaseYear: null }
    ]);
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    addItem(db, { gameId: 3, condition: 'loose' });
    // No estimates at all — byConsole still reports a count per console.
    expect(dashboardData(db).byConsole).toEqual([
      { console: 'Game Boy', count: 2, value: 0 },
      { console: 'N64', count: 1, value: 0 }
    ]);
  });
});
