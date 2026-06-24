import { stripIndents } from "common-tags";
import { ChannelType, EmbedBuilder } from "discord.js";
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

    const guildConfig = await database.guildConfig.upsert({
      where: { guildID: this.guild.id },
      create: { guildID: this.guild.id },
      update: {},
    });
    if (!guildConfig) return styleLog('Error upserting the GUILDCONFIG table!', false, 'xp.js');

    const rankedIgnoredChannelIDs = JSON.parse(guildConfig.rankedIgnoredChannelIDs) as Array<string>;

    if (!rankedIgnoredChannelIDs.includes(channel.id)) return this.handleError(`${channel} is already allowed to award XP to users!`);
    const updatedChannelIDs = rankedIgnoredChannelIDs.filter((channelID) => channelID !== channel.id);

    await database.guildConfig.update({
      where: { guildID: this.guild.id },
      data: { rankedIgnoredChannelIDs: JSON.stringify(updatedChannelIDs) }
    });

    await this.interaction.editReply({ embeds: [this.simpleEmbed(`${channel} has been **allowed** and will now award XP to users for chatting in it!`)] });
  }

  private async denyChannel() {
    const { GuildText, GuildVoice, GuildAnnouncement, AnnouncementThread, PublicThread } = ChannelType;
    const channel = this.interaction.options.getChannel('channel', true, [GuildText, GuildVoice, GuildAnnouncement, AnnouncementThread, PublicThread]);

    const guildConfig = await database.guildConfig.upsert({
      where: { guildID: this.guild.id },
      create: { guildID: this.guild.id },
      update: {},
    });
    if (!guildConfig) return styleLog('Error upserting the GUILDCONFIG table!', false, 'xp.js');

    const rankedIgnoredChannelIDs = JSON.parse(guildConfig.rankedIgnoredChannelIDs) as Array<string>;

    if (rankedIgnoredChannelIDs.includes(channel.id)) return this.handleError(`${channel} is already denied from awarding XP to users!`);
    rankedIgnoredChannelIDs.push(channel.id);

    await database.guildConfig.update({
      where: { guildID: this.guild.id },
      data: { rankedIgnoredChannelIDs: JSON.stringify(rankedIgnoredChannelIDs) }
    });

    await this.interaction.editReply({ embeds: [this.simpleEmbed(`${channel} has been **denied** and will no longer award XP to users!`)] });
  }

  private async viewChannels() {
    const guildConfig = await database.guildConfig.upsert({
      where: { guildID: this.guild.id },
      create: { guildID: this.guild.id },
      update: {},
    });
    if (!guildConfig) return styleLog('Error upserting the GUILDCONFIG table!', false, 'xp.js');

    const rankedIgnoredChannelIDs = JSON.parse(guildConfig.rankedIgnoredChannelIDs) as Array<string>;
    const rankedIgnoredChannels = [];

    for await (const channelID of rankedIgnoredChannelIDs) {
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

    const rank = await database.rank.findUnique({
      where: { userID_guildID: { guildID: this.guild.id, userID: user.id } }
    });

    const currentXP = rank?.xp ?? 0;
    let updatedXP = 0;
    if (option === 'add') updatedXP = currentXP + amount;
    else if (option === 'remove') updatedXP = currentXP - amount;
    else updatedXP = amount;

    const updatedLevel = levelAtGivenXP(updatedXP);

    await database.rank.update({
      where: { userID_guildID: { guildID: this.guild.id, userID: user.id } },
      data: { xp: updatedXP, xpLevel: updatedLevel }
    });

    let embedText = '';
    if (option === 'add') embedText = `**${amount} XP** has been added to ${user}, they now have **${updatedXP} XP** in total!`;
    else if (option === 'remove') embedText = `**${amount} XP** has been removed from ${user}, they now have **${updatedXP} XP** in total!`;
    else embedText = `${user}'s XP has been set to **${updatedXP} XP**!`;

    await this.interaction.editReply({ embeds: [this.simpleEmbed(embedText)] });
  }
}
