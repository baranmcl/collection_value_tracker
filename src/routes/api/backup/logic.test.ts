import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { makeRawTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { backupDatabase } from './logic';

const SQLITE_MAGIC = 'SQLite format 3\0';
const tempBackupCount = () =>
  readdirSync(tmpdir()).filter((f) => f.startsWith('cvt-backup-')).length;

describe('backupDatabase', () => {
  it('returns a .db attachment whose bytes are a valid SQLite file', async () => {
    const { db, sqlite } = makeRawTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'Chrono Trigger', region: null, releaseYear: 1995 }]);
    const res = backupDatabase(sqlite, new Date('2026-05-21T00:00:00Z'));
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="collection-backup-2026-05-21.db"'
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 16))).toBe(SQLITE_MAGIC);
  });

  it('leaves no temp file behind on success', () => {
    const { db, sqlite } = makeRawTestDb();
    upsertGames(db, [{ id: 1, console: 'SNES', title: 'A', region: null, releaseYear: 1995 }]);
    const before = tempBackupCount();
    backupDatabase(sqlite, new Date());
    expect(tempBackupCount()).toBe(before);
  });

  it('cleans up and rethrows when the snapshot fails', () => {
    const { sqlite } = makeRawTestDb();
    sqlite.close(); // a closed connection makes VACUUM INTO throw
    const before = tempBackupCount();
    expect(() => backupDatabase(sqlite, new Date())).toThrow();
    expect(tempBackupCount()).toBe(before);
  });
});
