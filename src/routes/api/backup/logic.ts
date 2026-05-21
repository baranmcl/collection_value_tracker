// ABOUTME: Builds the database-backup download response — a consistent SQLite
// ABOUTME: snapshot via VACUUM INTO, streamed as a .db file attachment.
import type Database from 'better-sqlite3';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** A download Response carrying a consistent snapshot of the database.
 *  `VACUUM INTO` writes a single defragmented file, correct even while the
 *  live WAL database is being written. `now` dates the filename. The temp
 *  snapshot is removed even if the snapshot throws. */
export function backupDatabase(sqlite: Database.Database, now: Date): Response {
  const tempPath = join(tmpdir(), `cvt-backup-${randomUUID()}.db`);
  try {
    sqlite.prepare('VACUUM INTO ?').run(tempPath);
    const bytes = readFileSync(tempPath);
    const date = now.toISOString().slice(0, 10);
    return new Response(new Uint8Array(bytes), {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="collection-backup-${date}.db"`
      }
    });
  } finally {
    rmSync(tempPath, { force: true });
  }
}
