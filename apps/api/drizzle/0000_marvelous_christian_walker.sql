CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`user_image` text,
	`user_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_user_id` ON `users` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_user_name` ON `users` (`user_name`);