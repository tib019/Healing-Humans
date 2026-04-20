CREATE TABLE `billing_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`therapeutId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('pending','approved','paid','rejected') NOT NULL DEFAULT 'pending',
	`note` text,
	`sessionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coin_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`reason` varchar(255) NOT NULL,
	`referenceId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coin_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`inviteeEmail` varchar(320),
	`inviteeId` int,
	`coinAwarded` boolean NOT NULL DEFAULT false,
	`coinAwardedAt` timestamp,
	`status` enum('pending','registered','converted') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`therapeutId` int NOT NULL,
	`status` enum('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
	`calendlyEventId` varchar(255),
	`rating` int,
	`feedback` text,
	`scheduledAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('patient','therapeut','admin') NOT NULL DEFAULT 'patient';--> statement-breakpoint
ALTER TABLE `users` ADD `supabaseId` varchar(64);