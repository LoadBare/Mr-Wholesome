import {
  AuditLogEvent, EmbedBuilder, Events, Guild, Message, PartialMessage,
} from 'discord.js';
import { client } from '../../index.js';
import { EmbedColours, EventHandler, Images, baseEmbed, database } from '../../lib/config.js';
import { channelIgnoresEvents, storeAttachments } from '../../lib/utilities.js';

class MessageDeleteHandler extends EventHandler {
  message: Message | PartialMessage;
  guild: Guild | null;

  constructor(message: Message | PartialMessage) {
    super();
    this.message = message;
    this.guild = message.guild;
  }

  async handle() {
    const { guildId, channelId, author } = this.message;
    const channelHasEventsIgnored = await channelIgnoresEvents(guildId, channelId);
    if (author?.bot || channelHasEventsIgnored) return;

    this.logDeletedMessage();
  }

  private async getMessageDeleter() {
    const auditLogs = await this.guild?.fetchAuditLogs({ type: AuditLogEvent.MessageDelete });
    const latestAuditLog = auditLogs?.entries.at(0);

    let messageDeleter: string;
    if (
      latestAuditLog !== undefined
      && latestAuditLog.targetId === this.message.author?.id
      && (Date.now() - 10000) < latestAuditLog.createdTimestamp
    ) {
      messageDeleter = latestAuditLog.executor?.username ?? '???';
    } else {
      messageDeleter = this.message.author?.username ?? '???';
    }

    return messageDeleter;
  }

  private async logDeletedMessage() {
    const embeddableContentTypes = ['image/png', 'image/gif', 'image/webp', 'image/jpeg'];

    const removedAttachments = this.message.attachments;
    const storedAttachments = await storeAttachments(removedAttachments);

    const userWhoDeletedMessage = await this.getMessageDeleter();

    const embedDescription = [
      `### Deleted by @${userWhoDeletedMessage}`,
    ];

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`Message Deleted in ${this.message.channel}`)
      .setFooter({
        text: `@${this.message.author?.username} • Author ID: ${this.message.author?.id}`,
        iconURL: this.message.author?.displayAvatarURL(),
      })
      .setTimestamp()
      .setColor(EmbedColours.Negative);

    if (this.message.content !== '') {
      embedDescription.push('### Message', this.message.content ?? '');
    }

    if (storedAttachments.length === 1) {
      const storedAttachment = storedAttachments.at(0)!;
      embedDescription.push('### Attachment', storedAttachment.maskedLink);

      if (storedAttachment.link !== '' && embeddableContentTypes.includes(storedAttachment.type)) {
        embed.setImage(storedAttachment.link);
      }
    } else if (storedAttachments.length > 1) {
      embedDescription.push('### Attachments', storedAttachments.map((a) => `- ${a.maskedLink}`).join('\n'));
    }

    embed.setDescription(embedDescription.join('\n'));

    const watchlist = await this.fetchWatchlist();
    const userOnWatchlist = watchlist.map((note) => note.watchedID).includes(this.message.author?.id ?? '');
    if (userOnWatchlist) embed.setThumbnail(Images.WatchedUser);

    super.logChannel.send({ embeds: [embed] });
  }

  // == Database Methods ==
  private async fetchWatchlist() {
    const result = await database.notes.findMany({
      where: { guildID: this.message.guild?.id }
    });

    return result;
  }
}

client.on(Events.MessageDelete, (message) => {
  new MessageDeleteHandler(message).handle();
});
