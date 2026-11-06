import { stripIndents } from 'common-tags';
import { EmbedBuilder, Events, GuildMember } from 'discord.js';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema.js';
import { client } from '../../index.js';
import { EventHandler, Images, RoleIDs, baseEmbed, database } from '../../lib/config.js';
import { getRelativeTimeString, sleep, styleLog } from '../../lib/utilities.js';

class GuildMemberAddHandler extends EventHandler {
  member: GuildMember;

  constructor(member: GuildMember) {
    super();
    this.member = member;
  }

  handle() {
    this.logMemberJoined();
    this.giveMemberRole();
  }

  private async logMemberJoined() {
    const embed = new EmbedBuilder(baseEmbed)
      .setTitle('Member Joined')
      .setDescription(stripIndents
        `### Member
        ${this.member.user}
        ### Account Created
        ${getRelativeTimeString(this.member.user.createdAt)}`
      )
      .setThumbnail(this.member.user.displayAvatarURL())
      .setFooter({
        text: `@${this.member.user.username} • User ID: ${this.member.user.id}`,
        iconURL: this.member.user.displayAvatarURL(),
      })
      .setTimestamp();

    const watchlist = await this.fetchWatchlist();
    const userOnWatchlist = watchlist.map((note) => note.watchedID).includes(this.member.id);
    if (userOnWatchlist) embed.setThumbnail(Images.WatchedUser);

    super.logChannel.send({ embeds: [embed] });
  }

  private async giveMemberRole() {
    /*
     * This delay is necessary to prevent duplicate Member Role Updated embeds from being posted.
     * Because upon a user joining a server for the first time, multiple guild-member-update events
     * are fired simultaneously which leads to multiple Member Role Updated embeds being posted
     * 90% of the time.
     *
     * Having this delay allows the initial guild-member-update events to be fired and processed
     * first so no duplicate embeds occur when adding the role.
     */
    await sleep(1000);

    await this.member.roles.add(RoleIDs.Akialyte)
      .then(() => styleLog(`Gave Akialyte role to ${this.member.displayName}!`, true, 'guild-member-add.js'))
      .catch((e) => styleLog(`Error giving Akialyte role to ${this.member.displayName}!`, false, 'guild-member-add.js', e));
  }

  // == Database Methods ==
  private async fetchWatchlist() {
    const result = await database
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.guildID, this.member.guild.id));

    return result;
  }
}

client.on(Events.GuildMemberAdd, (member) => {
  new GuildMemberAddHandler(member).handle();
});
