ALTER TABLE `users` ADD `supabaseId` varchar(36);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_supabaseId_unique` UNIQUE(`supabaseId`);