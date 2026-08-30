CREATE TABLE `clunk_marketplace_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`buyer_user_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`provider_reference` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clunk_marketplace_entitlement_order_unique` ON `clunk_marketplace_entitlements` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `clunk_marketplace_entitlement_buyer_asset_status_unique` ON `clunk_marketplace_entitlements` (`buyer_user_id`,`asset_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_clunk_entitlements_buyer_asset` ON `clunk_marketplace_entitlements` (`buyer_user_id`,`asset_id`,`status`);--> statement-breakpoint
ALTER TABLE `clunk_marketplace_orders` ADD `checkout_url` text;