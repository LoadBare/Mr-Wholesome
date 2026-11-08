import { stripIndents } from "common-tags";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, Guild, time, User, userMention, } from "discord.js";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { baseEmbed, database } from "../../lib/config.js";
import { CommandHandler } from "../command.js";

export class ViewCommandHandler extends CommandHandler {
  async handle() {
    await this.interaction.deferReply();

    const subcommand = this.interaction.options.getSubcommand(true);
    if (subcommand === 'ban') new BanViewer(this.interaction).handle();
    else if (subcommand === 'warning') new WarningViewer(this.interaction).handle();
    else if (subcommand === 'watchlist') new WatchlistViewer(this.interaction).handle();
  }
}

class BanViewer extends CommandHandler {
  private id: string;

  constructor(interaction: ChatInputCommandInteraction) {
    super(interaction);
    this.id = (interaction.options.getString('id') || '').replace(/[^0-9]/g, '');
  }

  async handle() {
    if (!this.id) return this.viewGuildBans();

    const ban = await database
      .select()
      .from(schema.bans)
      .where(eq(schema.bans.date, this.id))
      .get();
    const user = await this.interaction.client.users.fetch(this.id).catch(() => null);

    if (ban) this.viewBan(ban);
    else if (user) this.viewUserBans(user);
    else this.handleError(`**${this.id}** is not a valid @mention, User ID, or Warning ID!`);
  }

  private async viewBan(ban: typeof schema.bans.$inferSelect) {
    const date = new Date(Number(ban.date));
    const author = await this.interaction.client.users.fetch(ban.authorID).catch(() => null);
    const user = await this.interaction.client.users.fetch(ban.bannedID).catch(() => null);

    if (!author || !user) {
      return this.handleError('Error fetching user data from Discord API!', true, 'view.js');
    }

    const displayName = user.displayName;
    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`${ban.unbanned ? '🟥' : '🟩'} ${displayName}'s Ban`)
      .setDescription(stripIndents
        `### Ban Reason
        ${ban.reason}`
      )
      .addFields([
        { name: 'Time', value: time(date, 'R'), inline: true },
        { name: 'Ban ID', value: ban.date, inline: true },
        { name: 'Banned', value: `@${user.username} — User ID: ${user.id}` },
        { name: 'Author', value: `@${author.username} — User ID: ${author.id}` }
      ])
      .setFooter({ text: '🟩 = active, 🟥 = unbanned' });

    await this.interaction.editReply({ embeds: [embed] });
  }

  private async viewGuildBans() {
    const payload = await new GuildBansPayload(this.interaction, 1).create();
    await this.interaction.editReply(payload);
  }

  private async viewUserBans(user: User) {
    const displayName = user.displayName;
    const userBans = await database
      .select()
      .from(schema.bans)
      .where(and(eq(schema.bans.guildID, this.guild.id), eq(schema.bans.bannedID, user.id)))
      .orderBy(desc(schema.bans.date))
      .catch(() => null);

    if (!userBans) return this.handleError('Error fetching bans from BAN table', true, 'view.js');

    const embedDescription: Array<string> = [];
    if (userBans.length === 0) embedDescription.push(`${displayName} has never been banned`);

    userBans.forEach((ban, index) => {
      const active = ban.unbanned ? '🟥' : '🟩';
      embedDescription.push(stripIndents
        `${active} **Ban ${index + 1}**
        ├ **Time:** ${time(new Date(Number(ban.date)), 'R')}
        └ **Ban ID:** ${ban.date}`
      );
    });

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`${displayName}'s Bans`)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(embedDescription.join('\n\n'))
      .setFooter({ text: '🟩 = active, 🟥 = unbanned' });

    await this.interaction.editReply({ embeds: [embed] });
  }
}

export class GuildBansPayload {
  static readonly bansPerPage = 10;
  private static readonly maxReasonLength = 60;

  private interaction: ChatInputCommandInteraction | ButtonInteraction;
  private guild: Guild;
  private page: number;

  constructor(interaction: ChatInputCommandInteraction | ButtonInteraction, page: number) {
    this.interaction = interaction;
    this.guild = interaction.guild!;
    this.page = page;
  }

  async create() {
    const bans = await database
      .select()
      .from(schema.bans)
      .where(eq(schema.bans.guildID, this.guild.id))
      .orderBy(desc(schema.bans.date));

    const pageCount = Math.max(1, Math.ceil(bans.length / GuildBansPayload.bansPerPage));
    this.page = Math.min(Math.max(1, this.page || 1), pageCount);

    const pageStart = (this.page - 1) * GuildBansPayload.bansPerPage;
    const pageBans = bans.slice(pageStart, pageStart + GuildBansPayload.bansPerPage);
    const activeCount = bans.filter((ban) => !ban.unbanned).length;

    const bannedUsers = await Promise.all(pageBans.map((ban) => this.interaction.client.users.fetch(ban.bannedID).catch(() => null)));

    const lines = pageBans.map((ban, index) => {
      const displayName = bannedUsers[index]?.displayName ?? 'Unknown User';
      const flatReason = ban.reason.replace(/\s+/g, ' ');
      const reason = flatReason.length > GuildBansPayload.maxReasonLength
        ? `${flatReason.slice(0, GuildBansPayload.maxReasonLength - 1)}…`
        : flatReason;

      return stripIndents
        `${ban.unbanned ? '🟥' : '🟩'} **${displayName}** · ${time(new Date(Number(ban.date)), 'R')} · by ${userMention(ban.authorID)}
        -# \`${ban.date}\` — ${reason}`;
    });

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`Bans in ${this.guild.name}`)
      .setThumbnail(this.guild.iconURL())
      .setDescription(lines.length ? lines.join('\n\n') : `There are no bans in ${this.guild.name}`)
      .setFooter({ text: `🟩 ${activeCount} active · 🟥 ${bans.length - activeCount} unbanned · ${bans.length} total` });

    return { embeds: [embed], components: [this.pageButtons(pageCount)] };
  }

  private pageButtons(pageCount: number) {
    return new ActionRowBuilder<ButtonBuilder>()
      .setComponents(
        new ButtonBuilder()
          .setCustomId('bans:1:first')
          .setLabel('<<')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(this.page === 1),
        new ButtonBuilder()
          .setCustomId(`bans:${this.page - 1}`)
          .setLabel('<')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(this.page === 1),
        new ButtonBuilder()
          .setCustomId('bans:page')
          .setLabel(`Page ${this.page} / ${pageCount}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`bans:${this.page + 1}`)
          .setLabel('>')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(this.page === pageCount),
        new ButtonBuilder()
          .setCustomId(`bans:${pageCount}:last`)
          .setLabel('>>')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(this.page === pageCount)
      );
  }
}

class WarningViewer extends CommandHandler {
  private id: string;

  constructor(interaction: ChatInputCommandInteraction) {
    super(interaction);
    this.id = (interaction.options.getString('id') || '').replace(/[^0-9]/g, '');
  }

  async handle() {
    if (!this.id) return this.viewGuildWarnings();

    const warning = await database
      .select()
      .from(schema.warnings)
      .where(eq(schema.warnings.date, this.id))
      .get();
    const user = await this.interaction.client.users.fetch(this.id).catch(() => null);

    if (warning) this.viewWarning(warning);
    else if (user) this.viewUserWarnings(user);
    else this.handleError(`**${this.id}** is not a valid @mention, User ID, or Warning ID!`);
  }

  private async viewWarning(warning: typeof schema.warnings.$inferSelect) {
    const date = new Date(Number(warning.date));
    const author = await this.interaction.client.users.fetch(warning.authorID).catch(() => null);
    const warned = await this.interaction.client.users.fetch(warning.warnedID).catch(() => null);

    if (!author || !warned) return this.handleError('Error fetching user data from Discord API!', true, 'view.js');

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`${warned.displayName}'s Warning`)
      .setThumbnail(warned.displayAvatarURL())
      .setDescription(stripIndents
        `### Warning Reason
      ${warning.reason}`
      )
      .addFields([
        { name: 'Time', value: time(date, 'R'), inline: true },
        { name: 'Warning ID', value: warning.date, inline: true },
        { name: 'Warned', value: `@${warned.username} — User ID: ${warned.id}` },
        { name: 'Author', value: `@${author.username} — User ID: ${author.id}` }
      ]);

    await this.interaction.editReply({ embeds: [embed] });
  }

  private async viewGuildWarnings() {
    const warnings = await database
      .select()
      .from(schema.warnings)
      .where(eq(schema.warnings.guildID, this.guild.id))
      .orderBy(desc(schema.warnings.date))
      .catch(() => null);
    if (!warnings) return this.handleError('Error fetching warnings from WARNING table!', true, 'view.js');

    const accumulator = new Map<string, { name: string, id: string, amount: number, latest: string; }>();
    for await (const warning of warnings) {
      const warnedUser = await this.interaction.client.users.fetch(warning.warnedID);
      const displayName = warnedUser.displayName;
      const mappedWarning = accumulator.get(warning.warnedID);

      if (mappedWarning) {
        mappedWarning.amount++;
        if (mappedWarning.latest < warning.date) mappedWarning.latest = warning.date;
      } else {
        accumulator.set(warning.warnedID, { amount: 1, id: warning.warnedID, name: displayName, latest: warning.date });
      }
    }

    const embedDescription: Array<string> = [];
    accumulator.forEach((value) => {
      embedDescription.push(stripIndents
        `**${value.name}** — ${value.amount} warning(s)
        ├ **User ID:** ${value.id}
        └ **Latest Warning:** ${time(new Date(Number(value.latest)), 'R')}`
      );
    });

    if (warnings.length === 0) embedDescription.push(`There are no warnings in ${this.guild.name}`);

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`Warnings in ${this.guild.name}`)
      .setThumbnail(this.guild.iconURL())
      .setDescription(embedDescription.join('\n\n'));

    await this.interaction.editReply({ embeds: [embed] });
  }

  private async viewUserWarnings(user: User) {
    const displayName = user.displayName;
    const userWarnings = await database
      .select()
      .from(schema.warnings)
      .where(and(eq(schema.warnings.guildID, this.guild.id), eq(schema.warnings.warnedID, user.id)))
      .orderBy(desc(schema.warnings.date));
    if (!userWarnings) return this.handleError('Error fetching warnings from WARNING table', true, 'view.js');

    const embedDescription: Array<string> = [];
    if (userWarnings.length === 0) embedDescription.push(`${displayName} has no warnings`);

    userWarnings.forEach((warning, index) => {
      embedDescription.push(stripIndents
        `**Warning ${index + 1}**
          ├ **Time:** ${time(new Date(Number(warning.date)), 'R')}
          └ **Warning ID:** ${warning.date}`
      );
    });

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`${displayName}'s Warnings`)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(embedDescription.join('\n\n'));

    await this.interaction.editReply({ embeds: [embed] });
  }
}

class WatchlistViewer extends CommandHandler {
  private id: string;

  constructor(interaction: ChatInputCommandInteraction) {
    super(interaction);
    this.id = (interaction.options.getString('id') || '').replace(/[^0-9]/g, '');
  }

  public async handle() {
    if (!this.id) return this.viewGuildNotes();

    const note = await database
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.date, this.id))
      .get();
    const user = await this.interaction.client.users.fetch(this.id).catch(() => null);

    if (note) this.viewNote(note);
    else if (user) this.viewUserNotes(user);
    else this.handleError(`**${this.id}** is not a valid @mention, User ID or Note ID`);
  }

  private async viewNote(note: typeof schema.notes.$inferSelect) {
    const date = new Date(Number(note.date));
    const author = await this.interaction.client.users.fetch(note.authorID).catch(() => null);
    const watched = await this.interaction.client.users.fetch(note.watchedID).catch(() => null);

    if (!author || !watched) return this.handleError('Error fetching user data from Discord API', true, 'view.js');

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`${watched.displayName}'s Watchlist`)
      .setThumbnail(watched.displayAvatarURL())
      .setDescription(stripIndents
        `### Note Text
        ${note.noteText}`
      )
      .addFields([
        { name: 'Time', value: time(date, 'R'), inline: true },
        { name: 'Note ID', value: note.date, inline: true },
        { name: 'Watched', value: `@${watched.username} — User ID: ${watched.id}` },
        { name: 'Author', value: `@${author.username} — User ID: ${author.id}` }
      ]);

    await this.interaction.editReply({ embeds: [embed] });
  }

  private async viewGuildNotes() {
    const notes = await database
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.guildID, this.guild.id))
      .orderBy(desc(schema.notes.date))
      .catch(() => null);
    if (!notes) return this.handleError('Error fetching notes from NOTES table', true, 'view.js');

    const accumulator = new Map<string, { name: string, id: string, amount: number, latest: string; }>();
    for await (const note of notes) {
      const watchedUser = await this.interaction.client.users.fetch(note.watchedID);
      const displayName = watchedUser.displayName;
      const mappedNote = accumulator.get(note.watchedID);

      if (mappedNote) {
        mappedNote.amount++;
        if (mappedNote.latest < note.date) mappedNote.latest = note.date;
      } else {
        accumulator.set(note.watchedID, { amount: 1, id: note.watchedID, name: displayName, latest: note.date });
      }
    }

    const embedDescription: Array<string> = [];
    accumulator.forEach((value) => {
      embedDescription.push(stripIndents
        `**${value.name}** — ${value.amount} note(s)
        ├ **User ID:** ${value.id}
        └ **Latest Note:** ${time(new Date(Number(value.latest)), 'R')}`
      );
    });

    if (notes.length === 0) embedDescription.push(`There is nobody on ${this.guild.name}'s watchlist`);

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`${this.guild.name}'s Watchlist`)
      .setThumbnail(this.guild.iconURL())
      .setDescription(embedDescription.join('\n\n'));

    await this.interaction.editReply({ embeds: [embed] });
  }

  private async viewUserNotes(user: User) {
    const displayName = user.displayName;
    const userNotes = await database
      .select()
      .from(schema.notes)
      .where(and(eq(schema.notes.guildID, this.guild.id), eq(schema.notes.watchedID, user.id)))
      .orderBy(desc(schema.notes.date));
    if (!userNotes) return this.handleError('Error fetching notes from NOTES table', true, 'view.js');

    const embedDescription: Array<string> = [];
    if (userNotes.length === 0) embedDescription.push(`${displayName} has no notes and therefore isn't on the watchlist`);

    userNotes.forEach((note, index) => {
      embedDescription.push(stripIndents
        `**Note ${index + 1}**
        ├ **Time:** ${time(new Date(Number(note.date)), 'R')}
        └ **Note ID:** ${note.date}`
      );
    });

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`${displayName}'s Watchlist`)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(embedDescription.join('\n\n'));

    await this.interaction.editReply({ embeds: [embed] });
  }
}
