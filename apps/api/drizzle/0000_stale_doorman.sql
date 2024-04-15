CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`user_image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`token_type` text,
	`expire_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_user_id` ON `users` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_user_name` ON `users` (`user_name`);--> statement-breakpoint
CREATE INDEX `idx_users_created_at` ON `users` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_users_updated_at` ON `users` (`updated_at`);