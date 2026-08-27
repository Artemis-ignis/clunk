CREATE TABLE `clunk_asset_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`file_name` text NOT NULL,
	`role` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_length` integer NOT NULL,
	`sha256` text NOT NULL,
	`object_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clunk_asset_artifact_asset_file` ON `clunk_asset_artifacts` (`asset_id`,`file_name`);--> statement-breakpoint
CREATE INDEX `idx_clunk_artifacts_asset_created` ON `clunk_asset_artifacts` (`asset_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `clunk_asset_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`visual_runtime` text NOT NULL,
	`player_facing` text NOT NULL,
	`human_decision` text NOT NULL,
	`note` text,
	`evidence_json` text NOT NULL,
	`reviewer_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_clunk_reviews_asset_created` ON `clunk_asset_reviews` (`asset_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `clunk_generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`asset_id` text,
	`asset_kind` text NOT NULL,
	`target_profile_id` text NOT NULL,
	`provider` text NOT NULL,
	`prompt` text NOT NULL,
	`status` text NOT NULL,
	`recipe_json` text NOT NULL,
	`provenance_json` text NOT NULL,
	`evidence_json` text,
	`storage_status` text DEFAULT 'UNAVAILABLE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_clunk_generation_workspace_created` ON `clunk_generation_jobs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `clunk_marketplace_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text DEFAULT 'KRW' NOT NULL,
	`license_status` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clunk_marketplace_listing_slug_unique` ON `clunk_marketplace_listings` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_clunk_listings_status_created` ON `clunk_marketplace_listings` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_clunk_listings_workspace_created` ON `clunk_marketplace_listings` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `clunk_marketplace_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_user_id` text NOT NULL,
	`status` text NOT NULL,
	`payment_provider` text NOT NULL,
	`payment_reference` text,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_clunk_orders_buyer_created` ON `clunk_marketplace_orders` (`buyer_user_id`,`created_at`);