import { stripIndents } from 'common-tags';
import {
  EmbedBuilder, Events, GuildMember, PartialGuildMember,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema.js';
import { client } from '../../index.js';
import { Emotes, EventHandler, Images, baseEmbed, database, escapeAllFormatting } from '../../lib/config.js';

class GuildMemberUpdateHandler extends EventHandler {
  oldMember: GuildMember | PartialGuildMember;
  newMember: GuildMember;

  constructor(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    super();
    this.oldMember = oldMember;
    this.newMember = newMember;
  }

  handle() {
    this.logNicknameUpdate();
    this.logRolesUpdate();
  }

  private async logNicknameUpdate() {
    if (this.oldMember.nickname === this.newMember.nickname) return;
    const oldNickname = escapeAllFormatting(this.oldMember.nickname);
    const newNickname = escapeAllFormatting(this.newMember.nickname);

    const embed = new EmbedBuilder(baseEmbed)
      .setFooter({
        text: `@${this.newMember.user.username} • User ID: ${this.newMember.user.id}`,
        iconURL: this.newMember.user.displayAvatarURL(),
      })
      .setTimestamp();

    if (!oldNickname) {
      embed.setTitle('Nickname Added');
      embed.setDescription(stripIndents
        `### New Nickname
        ${newNickname}`
      );
    } else if (!newNickname) {
      embed.setTitle('Nickname Reset');
      embed.setDescription(stripIndents
        `### Old Nickname
        ${oldNickname}`
      );
    } else {
      embed.setTitle('Nickname Changed');
      embed.setDescription(stripIndents
        `### Old Nickname
        ${oldNickname}
        ### New Nickname
        ${newNickname}`
      );
    }

    const watchlist = await this.fetchWatchlist();
    const userOnWatchlist = watchlist.map((note) => note.watchedID).includes(this.newMember.id);
    if (userOnWatchlist) embed.setThumbnail(Images.WatchedUser);

    super.logChannel.send({ embeds: [embed] });
  }

  private async logRolesUpdate() {
    const oldRoles = this.oldMember.roles.cache;
    const newRoles = this.newMember.roles.cache;
    if (oldRoles.equals(newRoles)) return;

    const rolesDifference = oldRoles.difference(newRoles);
    const embedDescription = [
      '### Role Changes'
    ];

    rolesDifference.forEach((role) => {
      const roleWasRemoved = oldRoles.has(role.id);

      if (roleWasRemoved) embedDescription.push(`${Emotes.Removed} ${role}`);
      else embedDescription.push(`${Emotes.Added} ${role}`);
    });

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle('Member Roles Updated')
      .setDescription(embedDescription.join('\n'))
      .setFooter({
        text: `@${this.newMember.user.username} • User ID: ${this.newMember.user.id}`,
        iconURL: this.newMember.user.displayAvatarURL(),
      })
      .setTimestamp();

    const watchlist = await this.fetchWatchlist();
    const userOnWatchlist = watchlist.map((note) => note.watchedID).includes(this.newMember.id);
    if (userOnWatchlist) embed.setThumbnail(Images.WatchedUser);

    super.logChannel.send({ embeds: [embed] });
  }

  // == Database Methods ==
  private async fetchWatchlist() {
    const result = await database
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.guildID, this.newMember.guild.id));

    return result;
  }

}

client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
  new GuildMemberUpdateHandler(oldMember, newMember).handle();
});
