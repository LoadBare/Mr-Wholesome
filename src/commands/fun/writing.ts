import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import Chart, { ChartItem } from 'chart.js/auto';
import { stripIndents } from "common-tags";
import { AttachmentBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { and, eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { baseEmbed, ChannelIDs, database } from "../../lib/config.js";
import { CommandHandler } from "../command.js";

export class WritingCommandHandler extends CommandHandler {
  private canvasWidth: number;
  private canvasHeight: number;

  public constructor(interaction: ChatInputCommandInteraction) {
    super(interaction);
    this.canvasWidth = 1343;
    this.canvasHeight = 720;
  }

  public async handle() {
    const allowedChannelIDs = [ChannelIDs.BotSpam];
    if (!this.checkChannelEligibility(allowedChannelIDs)) return this.postChannelIneligibleMessage(allowedChannelIDs);
    await this.interaction.deferReply();

    const { messageCount, messagesPerHour } = await this.fetchMemberStats();
    const parsedHourlyMessages = this.parseHourlyMessages(messagesPerHour);
    const { mostActiveHourString, mostActiveHourCount } = this.findMostActiveHourAndCount(parsedHourlyMessages);
    const writingAttachment = await this.createWritingAttachment(parsedHourlyMessages);

    const displayName = this.interaction.user.displayName;
    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`${displayName}'s Writing Statistics`)
      .setDescription(stripIndents
        `Total Message Count: **${messageCount}**
        Most Active Hour: **${mostActiveHourString}** (**${mostActiveHourCount} messages**)`
      )
      .setImage('attachment://chart.png');
    await this.interaction.editReply({ embeds: [embed], files: [writingAttachment] });
  }

  private findMostActiveHourAndCount(hourlyMessages: Array<number>) {
    const timeStrings = Array.from({ length: 24 }, (_, i) => `${i % 12 === 0 ? 12 : i % 12}${i < 12 ? 'am' : 'pm'}`);
    const mostActiveHourCount = Math.max(...hourlyMessages);
    const mostActiveHour = hourlyMessages.indexOf(mostActiveHourCount);
    const mostActiveHourString = timeStrings.at(mostActiveHour);

    return {
      mostActiveHourString,
      mostActiveHourCount
    };
  }

  private createChartCanvas(hourlyMessages: Array<number>) {
    const dataLabels = Array.from({ length: 24 }, (_, i) => `${i % 12 === 0 ? 12 : i % 12}${i < 12 ? 'am' : 'pm'}`);
    GlobalFonts.registerFromPath('assets/fonts/Ubuntu-Medium.ttf', 'ubuntu-medium');
    const canvas = createCanvas(1343, 720);
    const canvasContext = canvas.getContext('2d') as unknown as ChartItem; // canvasContext needs to be cast to ChartItem for Chart.js to render with '@napi-rs/canvas' context

    new Chart(canvasContext, {
      type: 'bar',
      data: {
        labels: dataLabels,
        datasets: [{
          data: hourlyMessages,
          label: 'Message Count',
          backgroundColor: 'rgba(255, 255, 255, 0.5)'
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: 'white',
              font: { family: 'ubuntu-medium', size: 18, weight: 'bold' }
            },
            title: {
              display: true,
              text: 'Time of Day [UTC]',
              color: 'white',
              font: { family: 'ubuntu-medium', size: 16, weight: 'bold' }
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              color: 'white',
              font: { family: 'ubuntu-medium', size: 18, weight: 'bold' }
            },
            title: {
              display: true,
              text: 'Number of Messages',
              color: 'white',
              font: { family: 'ubuntu-medium', size: 16, weight: 'bold' }
            },
            beginAtZero: true
          }
        }
      }
    });

    return canvas;
  }

  private async createFinalCanvas(hourlyMessages: Array<number>) {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const canvasContext = canvas.getContext('2d');
    const backgroundImage = await loadImage('assets/writing/background.png');
    const chartCanvas = this.createChartCanvas(hourlyMessages);

    canvasContext.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    canvasContext.drawImage(chartCanvas, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  private async createWritingAttachment(hourlyMessages: Array<number>) {
    const finalCanvas = await this.createFinalCanvas(hourlyMessages);
    const buffer = finalCanvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { name: 'chart.png' });

    return attachment;
  }

  private parseHourlyMessages(messagesPerHourString: string) {
    const parsedMessagesPerHour = JSON.parse(messagesPerHourString) as Array<number>;
    return parsedMessagesPerHour;
  }

  private async fetchMemberStats() {
    const memberStats = await database
      .select()
      .from(schema.memberStats)
      .where(and(
        eq(schema.memberStats.userID, this.interaction.user.id),
        eq(schema.memberStats.guildID, this.interaction.guildId!)
      ))
      .get();

    if (memberStats) return memberStats;

    const createdMemberStats = await this.createMemberStats();
    return createdMemberStats;
  }

  private async createMemberStats() {
    const [memberStats] = await database
      .insert(schema.memberStats)
      .values({
        guildID: this.interaction.guildId!,
        messagesPerHour: JSON.stringify(new Array(24).fill(0)),
        userID: this.interaction.user.id
      })
      .returning();

    return memberStats;
  }
}
