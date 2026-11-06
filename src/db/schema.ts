import { integer, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// --- HELPERS --- //
const idList = () => text({ mode: 'json' }).$type<string[]>().notNull().default([]);

// --- USER MODELS --- //
export const birthdays = sqliteTable('birthdays', {
    id: text().primaryKey(),
    date: text().notNull()
});

// --- GUILD MODELS --- //
export const guildConfig = sqliteTable('guildConfig', {
    id: text().primaryKey(),
    eventIgnoredChannelIDs: idList(),
    rankIgnoredChannelIDs: idList()
});

export const bans = sqliteTable('bans', {
    date: text().primaryKey(),
    guildID: text().notNull(),
    authorID: text().notNull(),
    bannedID: text().notNull(),
    reason: text().notNull(),
    unbanned: integer({ mode: 'boolean' }).notNull().default(false)
});

export const ranks = sqliteTable('ranks', {
    userID: text().notNull(),
    guildID: text().notNull(),
    xp: integer().notNull().default(0),
    xpLevel: integer().notNull().default(0),
    levelNotifs: integer({ mode: 'boolean' }).notNull().default(true),
    credits: integer().notNull().default(0)
}, (t) => [
    primaryKey({ columns: [t.userID, t.guildID] })
]);

export const tickets = sqliteTable('tickets', {
    timeCreated: text().primaryKey(),
    ticketPanelName: text().notNull(),
    authorID: text().notNull(),
    channelID: text().notNull().unique(),
    addedUsers: idList(),
    open: integer({ mode: 'boolean' }).notNull().default(true)
});

export const ticketPanels = sqliteTable('ticketPanels', {
    timeCreated: text().primaryKey(),
    name: text().notNull(),
    guildID: text().notNull(),
    categoryID: text().notNull(),
    moderatorRoleID: text().notNull(),
    panelEmbedJSON: text().notNull(),
    ticketEmbedJSON: text().notNull(),
    postedPanelMessageIDs: text({ mode: 'json' }).$type<{ channelID: string, messageID: string }[]>().notNull().default([])
}, (t) => [
    unique().on(t.name, t.guildID)
]);

export const warnings = sqliteTable('warnings', {
    date: text().primaryKey(),
    guildID: text().notNull(),
    authorID: text().notNull(),
    warnedID: text().notNull(),
    reason: text().notNull()
});

export const notes = sqliteTable('notes', {
    date: text().primaryKey(),
    authorID: text().notNull(),
    watchedID: text().notNull(),
    guildID: text().notNull(),
    noteText: text().notNull()
});

export const memberStats = sqliteTable('memberStats', {
    userID: text().notNull(),
    guildID: text().notNull(),
    messageCount: integer().notNull().default(0),
    messagesPerHour: text().notNull()
}, (t) => [
    primaryKey({ columns: [t.userID, t.guildID] })
]);
