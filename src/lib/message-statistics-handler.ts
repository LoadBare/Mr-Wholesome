import { Message } from "discord.js";
import { and, eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { database } from "./config.js";
import { styleLog } from "./utilities.js";

export default class MessageStatisticsHandler {
  private message: Message;

  public constructor(message: Message) {
    this.message = message;
  }

  public async handle() {
    const { messageCount, messagesPerHour } = await this.fetchMemberStats();
    const parsedMessagesPerHour = this.parseHourlyMessages(messagesPerHour);

    const updatedMessageCount = messageCount + 1;
    const currentUTCHour = new Date().getUTCHours();
    if (typeof parsedMessagesPerHour.at(currentUTCHour) !== 'undefined') parsedMessagesPerHour[currentUTCHour] += 1;
    else styleLog(`Message count undefined at current UTC hour (${currentUTCHour}) for ${this.message.author.username} (${this.message.author.id})`, false, 'message-statistics-handler.js');

    const stringifiedMessagesPerHour = this.stringifyHourlyMessages(parsedMessagesPerHour);
    await this.updateMemberStats(updatedMessageCount, stringifiedMessagesPerHour);
  }

  private parseHourlyMessages(messagesPerHourString: string) {
    const parsedMessagesPerHour = JSON.parse(messagesPerHourString) as Array<number>;
    return parsedMessagesPerHour;
  }

  private stringifyHourlyMessages(messagesPerHourArray: Array<number>) {
    const stringifiedMessagesPerHour = JSON.stringify(messagesPerHourArray);
    return stringifiedMessagesPerHour;
  }

  private async fetchMemberStats() {
    const memberStats = await database
      .select()
      .from(schema.memberStats)
      .where(and(
        eq(schema.memberStats.userID, this.message.author.id),
        eq(schema.memberStats.guildID, this.message.guildId!)
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
        guildID: this.message.guildId!,
        messagesPerHour: JSON.stringify(new Array(24).fill(0)),
        userID: this.message.author.id
      })
      .returning();

    return memberStats;
  }

  private async updateMemberStats(messageCount: number, messagesPerHour: string) {
    const [updatedMemberStats] = await database
      .update(schema.memberStats)
      .set({ messageCount, messagesPerHour })
      .where(and(
        eq(schema.memberStats.userID, this.message.author.id),
        eq(schema.memberStats.guildID, this.message.guildId!)
      ))
      .returning();

    return updatedMemberStats;
  }
}
