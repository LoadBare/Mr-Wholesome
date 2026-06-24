import { AttachmentBuilder } from "discord.js";
import { ChannelIDs } from "../../lib/config.js";
import { CommandHandler } from "../command.js";

export class SnoCommandHandler extends CommandHandler {
  async handle() {
    const allowedChannelIDs = [ChannelIDs.BotSpam, ChannelIDs.IRLStuff];
    if (!this.checkChannelEligibility(allowedChannelIDs)) return this.postChannelIneligibleMessage(allowedChannelIDs);

    await this.interaction.deferReply();
    const snoAttachment = new AttachmentBuilder('./assets/SNO.gif');

    await this.interaction.editReply({ files: [snoAttachment] });
  }
}
