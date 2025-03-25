import { Canvas, GlobalFonts, SKRSContext2D, loadImage } from "@napi-rs/canvas";
import { AttachmentBuilder, ChatInputCommandInteraction } from "discord.js";
import { ChannelIDs, database } from "../../lib/config.js";
import { xpRequiredForLevel } from "../../lib/ranking-handler.js";
import { CommandHandler } from "../command.js";

export class RankCommandHandler extends CommandHandler {
  private canvas: Canvas;
  private canvasContext: SKRSContext2D;

  constructor(interaction: ChatInputCommandInteraction) {
    super(interaction);

    GlobalFonts.registerFromPath('assets/fonts/Ubuntu-Medium.ttf', 'ubuntu-medium');
    GlobalFonts.registerFromPath('assets/fonts/NotoColorEmoji-Regular.ttf', 'notocoloremoji');
    this.canvas = new Canvas(1343, 410);
    this.canvasContext = this.canvas.getContext('2d');
  }

  async handle() {
    const allowedChannelIDs = [ChannelIDs.BotSpam];
    if (!this.checkChannelEligibility(allowedChannelIDs)) return this.postChannelIneligibleMessage(allowedChannelIDs);
    await this.interaction.deferReply();

    const userRankImage = await this.createUserRankImage();

    if (!userRankImage) {
      return;
    }

    await this.interaction.editReply({ files: [userRankImage] });
  }

  private async intialiseCanvas() {
    const backgroundImage = await loadImage('assets/rank/rank.png');
    this.canvasContext.drawImage(backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
  }

  private async drawAvatar() {
    const response = await fetch(this.interaction.user.displayAvatarURL({ extension: 'png', size: 1024 }))
      .catch(() => fetch('assets/rank/avatar-error.png'));
    const avatar = await loadImage(await response.arrayBuffer());
    const avatarX = 50;
    const avatarY = 50;
    const avatarSize = 310;
    const avatarRadius = avatarSize / 2;

    this.canvasContext.save();

    this.canvasContext.beginPath();
    this.canvasContext.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2, true);
    this.canvasContext.closePath();
    this.canvasContext.clip();

    this.canvasContext.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);

    this.canvasContext.restore();

    const avatarOutline = await loadImage('assets/rank/avatar-outline.png');
    this.canvasContext.drawImage(avatarOutline, 0, 0, this.canvas.width, this.canvas.height);
  }

  private async drawProgressBar(percent: number, xp: number, xpNeeded: number) {
    const barX = 452;
    const barY = 258;
    const barWidth = 800;
    const barHeight = 72;
    const barRadius = barHeight / 2;
    const pixelsPerPercent = barWidth / 100;

    // Create clipping mask for progress bar
    this.canvasContext.save();
    this.canvasContext.beginPath();
    this.canvasContext.arc(barX + barRadius, barY + barRadius, barRadius, Math.PI / 2, Math.PI * 1.5);
    this.canvasContext.lineTo(barX + barWidth - barRadius, barY);
    this.canvasContext.arc(barX + barWidth - barRadius, barY + barRadius, barRadius, Math.PI * 1.5, Math.PI / 2);
    this.canvasContext.lineTo(barX + barRadius, barY + barHeight);
    this.canvasContext.clip();

    // Draw progress bar
    this.canvasContext.fillStyle = '#66ff99';
    this.canvasContext.fillRect(barX, barY, pixelsPerPercent * percent, barHeight);
    this.canvasContext.restore();

    // Draw progress bar text
    this.canvasContext.font = 'bold 45px ubuntu-medium';
    this.canvasContext.textAlign = 'center';
    this.canvasContext.fillStyle = 'white';
    this.canvasContext.fillText(`${xp} / ${xpNeeded} XP`, barX + barWidth / 2, barY + barHeight / 2 + 15);

    const progressBarOutline = await loadImage('assets/rank/progress-bar-outline.png');
    this.canvasContext.drawImage(progressBarOutline, 0, 0, this.canvas.width, this.canvas.height);
  }

  private async drawRankInfo(level: number) {
    const progressBarX = 452;
    const progressBarY = 258;
    const progressBarWidth = 800;

    const aboveBarX = progressBarX + progressBarWidth / 2;
    const aboveBarY = progressBarY - 20;

    const userPosition = await this.fetchRankPosition() || '???';

    const usernameText = this.interaction.user.displayName;
    const levelText = `Level ${level}`;
    const userPositionText = `Rank #${userPosition}`;

    this.canvasContext.fillStyle = 'white';
    this.canvasContext.textAlign = 'center';
    this.canvasContext.font = 'bold 80px ubuntu-medium, notocoloremoji';
    this.canvasContext.fillText(usernameText, aboveBarX, 100, 900);

    this.canvasContext.font = 'bold 35px ubuntu-medium';
    this.canvasContext.textAlign = 'left';
    this.canvasContext.fillText(userPositionText, progressBarX, aboveBarY);

    this.canvasContext.textAlign = 'right';
    this.canvasContext.fillText(levelText, progressBarX + progressBarWidth, aboveBarY);

  }

  private fetchLevelProgress(xp: number, level: number) {
    const currentLevelTotalXP = xpRequiredForLevel(level);
    const nextLevelTotalXP = xpRequiredForLevel(level + 1);
    const xpNeededForEntireCurrentLevel = nextLevelTotalXP - currentLevelTotalXP;

    const xpIntoLevel = xp - currentLevelTotalXP;
    const xpIntoLevelPercent = Math.round(xpIntoLevel / xpNeededForEntireCurrentLevel * 100);

    return {
      xpNeeded: nextLevelTotalXP,
      percent: xpIntoLevelPercent,
    };
  }

  private async createUserRankImage() {
    const memberRank = await database.rank.upsert({
      where: { userID_guildID: { guildID: this.guild.id, userID: this.interaction.user.id } },
      create: { guildID: this.guild.id, userID: this.interaction.user.id },
      update: {},
    }).catch(() => null);

    if (!memberRank) {
      return this.handleError('Error upserting ranks from RANK table!', true, 'rank.js');
    }

    const { xp, xpLevel } = memberRank;
    const { percent, xpNeeded } = this.fetchLevelProgress(xp, xpLevel);

    await this.intialiseCanvas();
    await this.drawAvatar();
    await this.drawProgressBar(percent, xp, xpNeeded);
    await this.drawRankInfo(xpLevel);

    const imageAltText = `You are Level ${xpLevel} with ${xp} XP! ${xpNeeded - xp} XP until Level ${xpLevel + 1}!`;
    const attachment = new AttachmentBuilder(await this.canvas.encode('jpeg'), { name: 'rank.jpeg', description: imageAltText });
    return attachment;
  }

  private async fetchRankPosition() {
    const guildID = this.guild.id;
    const userID = this.interaction.user.id;

    const guildMembers = await this.guild.members.fetch().catch(() => null);

    if (!guildMembers) {
      return this.handleError('Error fetching members from guild!', true, 'rank.js');
    }

    const guildMemberIDs = guildMembers.map((member) => member.id);

    const guildRanks = await database.rank.findMany({ where: { guildID }, orderBy: { xp: 'desc' } }).catch(() => null);

    if (!guildRanks) {
      return this.handleError('Error fetching ranks from RANK table!', true, 'rank.js');
    }

    const filteredRanks = guildRanks.filter((rank) => guildMemberIDs.includes(rank.userID));

    const memberRankPosition = filteredRanks.findIndex((rank) => rank.userID === userID) + 1;
    return memberRankPosition;
  }
}
