import { stripIndents } from "common-tags";
import { ChatInputCommandInteraction, EmbedBuilder, time, User } from "discord.js";
import { Ban, Notes, Warning } from "../../generated/prisma/client.js";
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

    const ban = await database.ban.findUnique({ where: { date: this.id } }).catch(() => null);
    const user = await this.interaction.client.users.fetch(this.id).catch(() => null);

    if (ban) this.viewBan(ban);
    else if (user) this.viewUserBans(user);
    else this.handleError(`**${this.id}** is not a valid @mention, User ID, or Warning ID!`);
  }

  private async viewBan(ban: Ban) {
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
    const bans = await database.ban.findMany({
      where: { guildID: this.guild.id },
      orderBy: { date: 'desc' }
    }).catch(() => null);

    if (!bans) { return this.handleError('Error fetching bans from BAN table!', true, 'view.js'); }

    const embedDescription: Array<string> = [];
    for await (const ban of bans) {
      const bannedUser = await this.interaction.client.users.fetch(ban.bannedID);
      const displayName = bannedUser.displayName;
      const date = new Date(Number(ban.date));
      const active = ban.unbanned ? '🟥' : '🟩';

      embedDescription.push(stripIndents
        `${active} **${displayName}** — ${time(date, 'R')}
        ├ **User ID:** ${ban.bannedID}
        └ **Ban ID:** ${ban.date}`
      );
    }

    if (bans.length === 0) embedDescription.push(`There are no bans in ${this.guild.name}`);

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`Bans in ${this.guild.name}`)
      .setThumbnail(this.guild.iconURL())
      .setDescription(embedDescription.join('\n\n'))
      .setFooter({ text: '🟩 = active, 🟥 = unbanned' });

    await this.interaction.editReply({ embeds: [embed] });
  }

  private async viewUserBans(user: User) {
    const displayName = user.displayName;
    const userBans = await database.ban.findMany({
      where: { guildID: this.guild.id, bannedID: user.id },
      orderBy: { date: 'desc' }
    }).catch(() => null);

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

class WarningViewer extends CommandHandler {
  private id: string;

  constructor(interaction: ChatInputCommandInteraction) {
    super(interaction);
    this.id = (interaction.options.getString('id') || '').replace(/[^0-9]/g, '');
  }

  async handle() {
    if (!this.id) return this.viewGuildWarnings();

    const warning = await database.warning.findUnique({ where: { date: this.id } }).catch(() => null);
    const user = await this.interaction.client.users.fetch(this.id).catch(() => null);

    if (warning) this.viewWarning(warning);
    else if (user) this.viewUserWarnings(user);
    else this.handleError(`**${this.id}** is not a valid @mention, User ID, or Warning ID!`);
  }

  private async viewWarning(warning: Warning) {
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
    const warnings = await database.warning.findMany({
      where: { guildID: this.guild.id },
      orderBy: { date: 'desc' }
    }).catch(() => null);
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
    const userWarnings = await database.warning.findMany({
      where: { guildID: this.guild.id, warnedID: user.id },
      orderBy: { date: 'desc' }
    });
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

    const note = await database.notes.findUnique({ where: { date: this.id } }).catch(() => null);
    const user = await this.interaction.client.users.fetch(this.id).catch(() => null);

    if (note) this.viewNote(note);
    else if (user) this.viewUserNotes(user);
    else this.handleError(`**${this.id}** is not a valid @mention, User ID or Note ID`);
  }

  private async viewNote(note: Notes) {
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
    const notes = await database.notes.findMany({
      where: { guildID: this.guild.id },
      orderBy: { date: 'desc' }
    }).catch(() => null);
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
    const userNotes = await database.notes.findMany({
      where: { guildID: this.guild.id, watchedID: user.id },
      orderBy: { date: 'desc' }
    });
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
