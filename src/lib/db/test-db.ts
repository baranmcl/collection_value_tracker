import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

/** In-memory DB with the full schema applied, plus its raw connection.
 *  For tests only. */
export function makeRawTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return { db, sqlite };
}

/** In-memory DB with the full schema applied. For tests only. */
export function makeTestDb() {
  return makeRawTestDb().db;
}
