import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';

const DB_PATH = process.env.DB_PATH ?? 'data/collection.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Bring the database file up to date with the schema on startup. `migrate`
// is idempotent (it tracks applied migrations), so running it every boot is
// safe and means a fresh `data/collection.db` works with zero manual setup.
migrate(db, { migrationsFolder: 'drizzle' });

export type DB = typeof db;
