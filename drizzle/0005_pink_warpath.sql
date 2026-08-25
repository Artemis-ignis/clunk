CREATE TABLE `clunk_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`label` text NOT NULL,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clunk_api_keys_key_hash_unique` ON `clunk_api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `idx_clunk_api_keys_workspace_created` ON `clunk_api_keys` (`workspace_id`,`created_at`);