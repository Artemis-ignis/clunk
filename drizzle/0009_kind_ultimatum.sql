CREATE TABLE `clunk_credit_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`pack_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`buyer_user_id` text NOT NULL,
	`status` text NOT NULL,
	`payment_provider` text NOT NULL,
	`payment_reference` text,
	`checkout_url` text,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`credits` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_clunk_credit_orders_buyer_created` ON `clunk_credit_orders` (`buyer_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `clunk_credit_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`credits` integer NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'KRW' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
