// ABOUTME: Drizzle schema — the games catalog, owned collection items, and the
// ABOUTME: price-estimate, price-snapshot, and refresh-event tables.
import { sqliteTable, integer, text, unique } from 'drizzle-orm/sqlite-core';

export const games = sqliteTable('games', {
  id: integer('id').primaryKey(), // TheGamesDB game id
  console: text('console').notNull(),
  title: text('title').notNull(),
  region: text('region'),
  releaseYear: integer('release_year'),
  boxartUrl: text('boxart_url'), // front cover thumbnail URL, nullable
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }).notNull()
});

export const collectionItems = sqliteTable('collection_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  condition: text('condition').notNull(), // 'loose' | 'cib' | 'new'
  grade: text('grade'),
  manualPrice: integer('manual_price'), // cents, nullable
  acquiredAt: text('acquired_at'), // ISO yyyy-mm-dd
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const refreshEvents = sqliteTable('refresh_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  triggeredAt: integer('triggered_at', { mode: 'timestamp' }).notNull(),
  source: text('source').notNull(),
  itemsUpdated: integer('items_updated').notNull().default(0),
  errors: integer('errors').notNull().default(0),
  errorSummary: text('error_summary'),
  totalValue: integer('total_value')
});

export const priceEstimates = sqliteTable('price_estimates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  condition: text('condition').notNull(),
  estimate: integer('estimate'), // cents, nullable when no listings
  listingCount: integer('listing_count').notNull().default(0),
  source: text('source').notNull().default('ebay'),
  computedAt: integer('computed_at', { mode: 'timestamp' }).notNull()
}, (t) => ({ uniqPair: unique().on(t.gameId, t.condition) }));

export const priceSnapshots = sqliteTable('price_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  condition: text('condition').notNull(),
  estimate: integer('estimate').notNull(),
  listingCount: integer('listing_count').notNull(),
  refreshEventId: integer('refresh_event_id').notNull().references(() => refreshEvents.id),
  snapshotAt: integer('snapshot_at', { mode: 'timestamp' }).notNull()
});

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type CollectionItem = typeof collectionItems.$inferSelect;
export type PriceEstimate = typeof priceEstimates.$inferSelect;
export type RefreshEvent = typeof refreshEvents.$inferSelect;
