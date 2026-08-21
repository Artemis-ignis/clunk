CREATE TABLE `clunk_analysis_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`input_hash` text NOT NULL,
	`profile_id` text NOT NULL,
	`rule_set_id` text NOT NULL,
	`status` text NOT NULL,
	`score` integer NOT NULL,
	`hard_blocker_count` integer NOT NULL,
	`finding_count` integer NOT NULL,
	`report_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clunk_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`file_name` text NOT NULL,
	`format` text NOT NULL,
	`byte_length` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clunk_credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`reference_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clunk_optimization_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`source_hash` text NOT NULL,
	`output_hash` text NOT NULL,
	`status` text NOT NULL,
	`operations_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clunk_passports` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`optimization_run_id` text,
	`source_hash` text NOT NULL,
	`output_hash` text NOT NULL,
	`passport_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clunk_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`monthly_credits` integer NOT NULL,
	`is_demo` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clunk_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'demo' NOT NULL,
	`provider` text DEFAULT 'demo' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clunk_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clunk_workspace_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `clunk_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
