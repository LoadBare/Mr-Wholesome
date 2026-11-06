CREATE TABLE `bans` (
	`date` text PRIMARY KEY,
	`guildID` text NOT NULL,
	`authorID` text NOT NULL,
	`bannedID` text NOT NULL,
	`reason` text NOT NULL,
	`unbanned` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `birthdays` (
	`id` text PRIMARY KEY,
	`date` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guildConfig` (
	`id` text PRIMARY KEY,
	`eventIgnoredChannelIDs` text DEFAULT '[]' NOT NULL,
	`rankIgnoredChannelIDs` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memberStats` (
	`userID` text NOT NULL,
	`guildID` text NOT NULL,
	`messageCount` integer DEFAULT 0 NOT NULL,
	`messagesPerHour` text NOT NULL,
	CONSTRAINT `memberStats_pk` PRIMARY KEY(`userID`, `guildID`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`date` text PRIMARY KEY,
	`authorID` text NOT NULL,
	`watchedID` text NOT NULL,
	`guildID` text NOT NULL,
	`noteText` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ranks` (
	`userID` text NOT NULL,
	`guildID` text NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`xpLevel` integer DEFAULT 0 NOT NULL,
	`levelNotifs` integer DEFAULT true NOT NULL,
	`credits` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `ranks_pk` PRIMARY KEY(`userID`, `guildID`)
);
--> statement-breakpoint
CREATE TABLE `ticketPanels` (
	`timeCreated` text PRIMARY KEY,
	`name` text NOT NULL,
	`guildID` text NOT NULL,
	`categoryID` text NOT NULL,
	`moderatorRoleID` text NOT NULL,
	`panelEmbedJSON` text NOT NULL,
	`ticketEmbedJSON` text NOT NULL,
	`postedPanelMessageIDs` text DEFAULT '[]' NOT NULL,
	CONSTRAINT `ticketPanels_name_guildID_unique` UNIQUE(`name`,`guildID`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`timeCreated` text PRIMARY KEY,
	`ticketPanelName` text NOT NULL,
	`authorID` text NOT NULL,
	`channelID` text NOT NULL UNIQUE,
	`addedUsers` text DEFAULT '[]' NOT NULL,
	`open` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `warnings` (
	`date` text PRIMARY KEY,
	`guildID` text NOT NULL,
	`authorID` text NOT NULL,
	`warnedID` text NOT NULL,
	`reason` text NOT NULL
);
