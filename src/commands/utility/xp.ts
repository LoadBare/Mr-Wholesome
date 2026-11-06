import { stripIndents } from "common-tags";
import { ChannelType, EmbedBuilder } from "discord.js";
import { and, eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { baseEmbed, database } from "../../lib/config.js";
import { levelAtGivenXP } from "../../lib/ranking-handler.js";
import { styleLog } from "../../lib/utilities.js";
import { CommandHandler } from "../command.js";

export class XPCommandHandler extends CommandHandler {
  async handle() {
    await this.interaction.deferReply();

    const subcommandGroup = this.interaction.options.getSubcommandGroup(true);
    const subcommand = this.interaction.options.getSubcommand(true);

    if (subcommandGroup === 'channels') {
      if (subcommand === 'allow') this.allowChannel();
      else if (subcommand === 'deny') this.denyChannel();
      else if (subcommand === 'view') this.viewChannels();
    }
    else if (subcommandGroup === 'user') {
      if (subcommand === 'add') this.changeUserXP('add');
      else if (subcommand === 'remove') this.changeUserXP('remove');
      else if (subcommand === 'set') this.changeUserXP('set');
    }
  }

  private async allowChannel() {
    const { GuildText, GuildVoice, GuildAnnouncement, AnnouncementThread, PublicThread } = ChannelType;
    const channel = this.interaction.options.getChannel('channel', true, [GuildText, GuildVoice, GuildAnnouncement, AnnouncementThread, PublicThread]);

    const [guildConfig] = await database
      .insert(schema.guildConfig)
      .values({ id: this.guild.id })
      .onConflictDoUpdate({ target: schema.guildConfig.id, set: { id: this.guild.id } })
      .returning();
    if (!guildConfig) return styleLog('Error upserting the GUILDCONFIG table!', false, 'xp.js');

    const rankIgnoredChannelIDs = guildConfig.rankIgnoredChannelIDs;

    if (!rankIgnoredChannelIDs.includes(channel.id)) return this.handleError(`${channel} is already allowed to award XP to users!`);
    const updatedChannelIDs = rankIgnoredChannelIDs.filter((channelID) => channelID !== channel.id);

    await database
      .update(schema.guildConfig)
      .set({ rankIgnoredChannelIDs: updatedChannelIDs })
      .where(eq(schema.guildConfig.id, this.guild.id));

    await this.interaction.editReply({ embeds: [this.simpleEmbed(`${channel} has been **allowed** and will now award XP to users for chatting in it!`)] });
  }

  private async denyChannel() {
    const { GuildText, GuildVoice, GuildAnnouncement, AnnouncementThread, PublicThread } = ChannelType;
    const channel = this.interaction.options.getChannel('channel', true, [GuildText, GuildVoice, GuildAnnouncement, AnnouncementThread, PublicThread]);

    const [guildConfig] = await database
      .insert(schema.guildConfig)
      .values({ id: this.guild.id })
      .onConflictDoUpdate({ target: schema.guildConfig.id, set: { id: this.guild.id } })
      .returning();
    if (!guildConfig) return styleLog('Error upserting the GUILDCONFIG table!', false, 'xp.js');

    const rankIgnoredChannelIDs = guildConfig.rankIgnoredChannelIDs;

    if (rankIgnoredChannelIDs.includes(channel.id)) return this.handleError(`${channel} is already denied from awarding XP to users!`);
    rankIgnoredChannelIDs.push(channel.id);

    await database
      .update(schema.guildConfig)
      .set({ rankIgnoredChannelIDs })
      .where(eq(schema.guildConfig.id, this.guild.id));

    await this.interaction.editReply({ embeds: [this.simpleEmbed(`${channel} has been **denied** and will no longer award XP to users!`)] });
  }

  private async viewChannels() {
    const [guildConfig] = await database
      .insert(schema.guildConfig)
      .values({ id: this.guild.id })
      .onConflictDoUpdate({ target: schema.guildConfig.id, set: { id: this.guild.id } })
      .returning();
    if (!guildConfig) return styleLog('Error upserting the GUILDCONFIG table!', false, 'xp.js');

    const rankedIgnoredChannels = [];

    for await (const channelID of guildConfig.rankIgnoredChannelIDs) {
      const rankedChannel = await this.guild.channels.fetch(channelID);
      rankedIgnoredChannels.push(`- ${rankedChannel}`);
    }

    const channelsList = rankedIgnoredChannels.length > 0 ? rankedIgnoredChannels.join('\n') : 'There are no denied channels.';

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle('Channels Denying XP')
      .setDescription(stripIndents`
            Below is a list of all **denied** channels that are **not** awarding XP.
            
            ${channelsList}`);

    await this.interaction.editReply({ embeds: [embed] });
  }

  private async changeUserXP(option: 'add' | 'remove' | 'set') {
    const user = this.interaction.options.getUser('user', true);
    const amount = this.interaction.options.getInteger('amount', true);

    const rank = await database
      .select()
      .from(schema.ranks)
      .where(and(eq(schema.ranks.userID, user.id), eq(schema.ranks.guildID, this.guild.id)))
      .get();

    const currentXP = rank?.xp ?? 0;
    let updatedXP = 0;
    if (option === 'add') updatedXP = currentXP + amount;
    else if (option === 'remove') updatedXP = currentXP - amount;
    else updatedXP = amount;

    const updatedLevel = levelAtGivenXP(updatedXP);

    await database
      .insert(schema.ranks)
      .values({ guildID: this.guild.id, userID: user.id, xp: updatedXP, xpLevel: updatedLevel })
      .onConflictDoUpdate({
        target: [schema.ranks.userID, schema.ranks.guildID],
        set: { xp: updatedXP, xpLevel: updatedLevel }
      });

    let embedText = '';
    if (option === 'add') embedText = `**${amount} XP** has been added to ${user}, they now have **${updatedXP} XP** in total!`;
    else if (option === 'remove') embedText = `**${amount} XP** has been removed from ${user}, they now have **${updatedXP} XP** in total!`;
    else embedText = `${user}'s XP has been set to **${updatedXP} XP**!`;

    await this.interaction.editReply({ embeds: [this.simpleEmbed(embedText)] });
  }
}
