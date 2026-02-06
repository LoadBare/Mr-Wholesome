import {
  AuditLogEvent, EmbedBuilder, Events, Message, PartialMessage,
} from 'discord.js';
import { client } from '../../index.js';
import { EmbedColours, EventHandler, Images, baseEmbed, database } from '../../lib/config.js';
import { channelIgnoresEvents, storeAttachments } from '../../lib/utilities.js';

class MessageDeleteHandler extends EventHandler {
  message: Message | PartialMessage;

  constructor(message: Message | PartialMessage) {
    super();
    this.message = message;
  }

  async handle() {
    const { guildId, channelId, author } = this.message;
    const channelHasEventsIgnored = await channelIgnoresEvents(guildId, channelId);
    if (author?.bot || channelHasEventsIgnored) return;

    this.logDeletedMessage();
  }

  private async logDeletedMessage() {
    const embeddableContentTypes = ['image/png', 'image/gif', 'image/webp', 'image/jpeg'];

    const removedAttachments = this.message.attachments;
    const storedAttachments = await storeAttachments(removedAttachments, this.message.client);

    const auditLogs = await this.message.guild?.fetchAuditLogs({ type: AuditLogEvent.MessageDelete });
    const latestAuditLog = auditLogs?.entries.at(0);

    let userWhoDeletedMessage = this.message.author;
    if (latestAuditLog !== undefined // Audit log exists
      && latestAuditLog.targetId === this.message.author?.id // Audit log target is message author
      && (Date.now() - 10000) < latestAuditLog.createdTimestamp // Audit log created in last 10 seconds
    ) {
      userWhoDeletedMessage = latestAuditLog.executor;
    }

    const embedDescription = [
      `### Deleted by ${userWhoDeletedMessage}`,
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
