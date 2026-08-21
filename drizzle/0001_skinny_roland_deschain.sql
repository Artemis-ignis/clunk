CREATE TABLE `clunk_credit_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clunk_credit_operation_workspace_key` ON `clunk_credit_operations` (`workspace_id`,`idempotency_key`);