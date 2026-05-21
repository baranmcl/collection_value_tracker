import { describe, it, expect } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem } from '$lib/db/queries/collection';
import { upsertEstimate } from '$lib/db/queries/prices';
import { exportCsv } from './logic';

describe('exportCsv', () => {
  it('returns a CSV attachment dated by `now`', async () => {
    const res = exportCsv(makeTestDb(), new Date('2026-05-21T00:00:00Z'));
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="collection-2026-05-21.csv"'
    );
    const body = await res.text();
    expect(body.split('\r\n')[0]).toBe(
      'Title,Console,Condition,Grade,Value (USD),Value Source,Acquired,Notes'
    );
  });

  it('includes a seeded collection item in the body', async () => {
    const db = makeTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'Chrono Trigger', region: null, releaseYear: 1995 }]);
    addItem(db, { gameId: 1, condition: 'loose' });
    upsertEstimate(db, { gameId: 1, condition: 'loose', estimate: 4200, listingCount: 5 });
    const body = await exportCsv(db, new Date('2026-05-21T00:00:00Z')).text();
    expect(body).toContain('Chrono Trigger,SNES,Loose,,42.00,estimate,,');
  });
});
