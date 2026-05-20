CREATE TABLE `collection_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`condition` text NOT NULL,
	`grade` text,
	`manual_price` integer,
	`acquired_at` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY NOT NULL,
	`console` text NOT NULL,
	`title` text NOT NULL,
	`region` text,
	`release_year` integer,
	`last_synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_estimates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`condition` text NOT NULL,
	`estimate` integer,
	`listing_count` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'ebay' NOT NULL,
	`computed_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_estimates_game_id_condition_unique` ON `price_estimates` (`game_id`,`condition`);--> statement-breakpoint
CREATE TABLE `price_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`condition` text NOT NULL,
	`estimate` integer NOT NULL,
	`listing_count` integer NOT NULL,
	`refresh_event_id` integer NOT NULL,
	`snapshot_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`refresh_event_id`) REFERENCES `refresh_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `refresh_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`triggered_at` integer NOT NULL,
	`source` text NOT NULL,
	`items_updated` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL
);
