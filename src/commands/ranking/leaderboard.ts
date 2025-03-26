import { Canvas, GlobalFonts, loadImage, SKRSContext2D } from "@napi-rs/canvas";
import { Rank } from "@prisma/client";
import { stripIndents } from "common-tags";
import { AttachmentBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { baseEmbed, ChannelIDs, database } from "../../lib/config.js";
import { CommandHandler } from "../command.js";

export class LeaderboardCommandHandler extends CommandHandler {
  private canvas: Canvas;
  private canvasContext: SKRSContext2D;
  private page: number;

  constructor(interaction: ChatInputCommandInteraction) {
    super(interaction);

    GlobalFonts.registerFromPath('assets/fonts/Ubuntu-Medium.ttf', 'ubuntu-medium');
    GlobalFonts.registerFromPath('assets/fonts/NotoColorEmoji-Regular.ttf', 'notocoloremoji');
    this.canvas = new Canvas(620, 610);
    this.canvasContext = this.canvas.getContext('2d');
    this.page = this.interaction.options.getInteger('page', false) || 1;
  }

  async handle() {
    const allowedChannelIDs = [ChannelIDs.BotSpam];
    if (!this.checkChannelEligibility(allowedChannelIDs)) return this.postChannelIneligibleMessage(allowedChannelIDs);
    await this.interaction.deferReply();

    const leaderboardImage = await this.createLeaderboardImage();
    const ranks = await this.getRanks(false);
    const pageCount = Math.ceil(ranks.length / 10);
    const memberRank = ranks.find((rank) => rank.userID === this.interaction.user.id);
    const memberPosition = ranks.findIndex((rank) => rank.userID === this.interaction.user.id) + 1;

    const leaderboardEmbed = new EmbedBuilder(baseEmbed)
      .setTitle(`Server Rankings for ${this.guild.name}`)
      .setDescription(stripIndents
        `You are rank **#${memberPosition}** with a total of **${memberRank?.xp} XP**`
      )
      .setImage('attachment://leaderboard.png')
      .setThumbnail(this.guild.iconURL())
      .setFooter({ text: `Page ${this.page} / ${pageCount} • Run "/leaderboard ${this.page + 1}" to go to page ${this.page + 1} of the leaderboard` });

    this.interaction.editReply({ files: [leaderboardImage], embeds: [leaderboardEmbed] });
  }

  private async intialiseCanvas() {
    const backgroundImage = await loadImage('assets/leaderboard/leaderboard.png');
    this.canvasContext.drawImage(backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
  }

  private async drawBars() {
    const ranks = await this.getRanks();
    const ranksLength = ranks.length;

    if (ranksLength === 0) {
      const errorImage = await loadImage('assets/leaderboard/error.png');
      this.canvasContext.drawImage(errorImage, 0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    const barWidth = 600;
    const barHeight = 50;
    const barX = 10;
    const barY = 10;
    const barSpacing = 10;
    const barImage = await loadImage('assets/leaderboard/bar.png');
    const highlightedBarImage = await loadImage('assets/leaderboard/bar-highlighted.png');

    ranks.forEach((rank, index) => {
      const barIsInteractionUser = rank.userID === this.interaction.user.id;
      const barImageToDraw = barIsInteractionUser ? highlightedBarImage : barImage;
      const rankPosition = (this.page - 1) * 10 + index + 1;

      this.canvasContext.drawImage(barImageToDraw, barX, barY + (index * (barHeight + barSpacing)), barWidth, barHeight);
      this.drawBarText(rank, rankPosition, index);
    });

  }

  private drawBarText(rank: Rank, rankPosition: number, index: number) {
    const barTextX = 20;
    const barTextY = 43;
    const barTextSpacing = 60;

    // Draw Rank Position
    if (rankPosition === 1) this.canvasContext.fillStyle = '#FFDF00';
    else if (rankPosition === 2) this.canvasContext.fillStyle = '#D3D3D3';
    else if (rankPosition === 3) this.canvasContext.fillStyle = '#CD7F32';
    else this.canvasContext.fillStyle = '#FFFFFF';
    this.canvasContext.font = `24px ubuntu-medium, notocoloremoji`;
    this.canvasContext.textAlign = 'left';
    this.canvasContext.fillText(`#${rankPosition}`, barTextX, barTextY + (index) * barTextSpacing);
    const rankTextLength = this.canvasContext.measureText(`#${rankPosition}`).width;

    // Draw Dot Separator
    this.canvasContext.fillStyle = '#00000066';
    this.canvasContext.fillText('•', barTextX + rankTextLength + 5, barTextY + (index) * barTextSpacing);
    this.canvasContext.fillStyle = '#FFFFFF';

    // Draw Member XP
    const memberXP = rank.xp;
    const xpTextX = 600;
    this.canvasContext.textAlign = 'right';
    this.canvasContext.fillText(`${memberXP} XP`, xpTextX, barTextY + (index) * barTextSpacing);
    this.canvasContext.textAlign = 'left';

    // Draw Member Name
    const xpTextWidth = this.canvasContext.measureText(`${memberXP} XP`).width;
    const member = this.guild.members.cache.get(rank.userID);
    const memberName = member?.displayName || 'Unknown User';
    this.canvasContext.font = 'bold 24px ubuntu-medium, notocoloremoji';
    this.canvasContext.strokeText(memberName, barTextX + rankTextLength + 20, barTextY + (index) * barTextSpacing, xpTextX - xpTextWidth - 50 - 10 - barTextX);
    this.canvasContext.font = '24px ubuntu-medium, notocoloremoji';
    this.canvasContext.fillStyle = member?.roles.highest.hexColor || '#FFFFFF';
    this.canvasContext.fillText(memberName, barTextX + rankTextLength + 20, barTextY + (index) * barTextSpacing, xpTextX - xpTextWidth - 50 - 10 - barTextX);
    this.canvasContext.fillStyle = '#FFFFFF';
  }

  private async createLeaderboardImage() {
    await this.intialiseCanvas();
    await this.drawBars();

    const imageAltText = 'Server Leaderboard';
    const attachment = new AttachmentBuilder(await this.canvas.encode('png'), { name: 'leaderboard.png', description: imageAltText });
    return attachment;
  }

  private async getRanks(pageSlicing = true) {
    const guildID = this.guild.id;
    const userID = this.interaction.user.id;

    await database.rank.upsert({
      where: { userID_guildID: { guildID, userID } },
      create: { guildID, userID },
      update: {},
    });

    const guildMembers = await this.guild.members.fetch();
    const guildMemberIDs = guildMembers?.map((member) => member.id);

    const guildRanks = await database.rank.findMany({ where: { guildID }, orderBy: { xp: 'desc' }, });
    const filteredRanks = guildRanks.filter((rank) => guildMemberIDs?.includes(rank.userID));

    if (!pageSlicing) {
      return filteredRanks;
    }

    const sliceStart = (this.page - 1) * 10;
    const sliceEnd = this.page * 10;
    const slicedRanks = filteredRanks.slice(sliceStart, sliceEnd);
    return slicedRanks;
  }
}
