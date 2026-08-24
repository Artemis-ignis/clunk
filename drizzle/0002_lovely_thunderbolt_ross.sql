CREATE TABLE `clunk_collaboration_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`body` text NOT NULL,
	`asset_id` text,
	`input_hash` text NOT NULL,
	`target_profile_id` text NOT NULL,
	`status_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clunk_collaboration_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`subject` text NOT NULL,
	`asset_id` text,
	`input_hash` text NOT NULL,
	`target_profile_id` text NOT NULL,
	`rule_set_id` text NOT NULL,
	`status_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
