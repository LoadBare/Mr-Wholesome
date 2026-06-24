import { stripIndents } from 'common-tags';
import { Change, diffChars } from 'diff';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  Events, Message, PartialMessage
} from 'discord.js';
import { client } from '../../index.js';
import { EventHandler, Images, baseEmbed, database } from '../../lib/config.js';
import { channelIgnoresEvents, storeAttachments } from '../../lib/utilities.js';

class MessageUpdateHandler extends EventHandler {
  oldMessage: Message | PartialMessage;

  newMessage: Message | PartialMessage;

  constructor(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
    super();
    this.oldMessage = oldMessage;
    this.newMessage = newMessage;
  }

  async handle() {
    const { guildId, channelId, author } = this.newMessage;
    const channelHasEventsIgnored = await channelIgnoresEvents(guildId, channelId);
    if (author?.bot || channelHasEventsIgnored) return;

    this.logEditedMessage();
    this.logRemovedMessageAttachment();
  }

  private findEditIndexes(contentDifference: Array<Change>) {
    const indexes = {
      firstEdit: 0,
      lastEdit: -1
    };

    let charCount = 0;
    contentDifference.forEach((diff, index) => {
      charCount += diff.count ?? 0;
      if (index === 1) {
        const firstDiff = contentDifference[0];
        if (firstDiff.added || firstDiff.removed) indexes.firstEdit = 0;
        else indexes.firstEdit = charCount - (diff.count ?? 0);
      }

      if (index === contentDifference.length - 2) {
        const lastDiff = contentDifference[index + 1];
        if (lastDiff.added || lastDiff.removed) indexes.lastEdit = charCount + (lastDiff.count ?? 0);
        else indexes.lastEdit = charCount;
      }
    });

    return indexes;
  }

  private async logEditedMessage() {
    const oldContent = this.oldMessage.content ?? '';
    const newContent = this.newMessage.content ?? '';
    if (oldContent === newContent) return;

    const contentDifference = diffChars(oldContent, newContent);
    const { firstEdit, lastEdit } = this.findEditIndexes(contentDifference);
    // Embed description max length is 4096, so each one should be at most 2000 to leave 96 characters for writing "Before" and "After" as well as "..." 
    const contentMaxLength = 2000;

    const oldContentFormatted = [oldContent.slice(
      firstEdit < 10 ? 0 : firstEdit - 10,
      lastEdit + 10 > oldContent.length ? oldContent.length : lastEdit + 10
    )];
    const newContentFormatted = [newContent.slice(
      firstEdit < 10 ? 0 : firstEdit - 10,
      lastEdit + 10 > newContent.length ? newContent.length : lastEdit + 10
    )];

    if (oldContentFormatted[0].length > contentMaxLength) oldContentFormatted[0] = oldContentFormatted[0].slice(0, contentMaxLength - 1);
    if (newContentFormatted[0].length > contentMaxLength) newContentFormatted[0] = newContentFormatted[0].slice(0, contentMaxLength - 1);

    if (firstEdit > 10) {
      oldContentFormatted.unshift('...');
      newContentFormatted.unshift('...');
    }
    if (lastEdit < oldContent.length - 10) oldContentFormatted.push('...');
    if (lastEdit < newContent.length - 10) newContentFormatted.push('...');

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`Message edited in ${this.newMessage.channel}`)
      .setDescription(stripIndents
        `## Before
          ${oldContentFormatted.join('')}
          ## After
          ${newContentFormatted.join('')}`
      )
      .setFooter({
        text: `@${this.newMessage.author?.username} • User ID: ${this.newMessage.author?.id}`,
        iconURL: this.newMessage.author?.displayAvatarURL(),
      })
      .setTimestamp();

    const jumpButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Jump To Message')
        .setStyle(ButtonStyle.Link)
        .setURL(this.newMessage.url),
    );

    const watchlist = await this.fetchWatchlist();
    const userOnWatchlist = watchlist.map((note) => note.watchedID).includes(this.newMessage.author?.id ?? '');
    if (userOnWatchlist) embed.setThumbnail(Images.WatchedUser);

    super.logChannel.send({ embeds: [embed], components: [jumpButton] });
  }

  private async logRemovedMessageAttachment() {
    if (this.oldMessage.attachments.size === this.newMessage.attachments.size) return;
    const embeddableContentTypes = ['image/png', 'image/gif', 'image/webp', 'image/jpeg'];
    const removedAttachment = this.oldMessage.attachments.difference(this.newMessage.attachments);

    const storedAttachment = (await storeAttachments(removedAttachment)).at(0);

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`Message Attachment Removed in ${this.newMessage.channel}`)
      .setDescription(stripIndents
        `### Attachment
        ${storedAttachment?.maskedLink}`
      )
      .setFooter({
        text: `@${this.newMessage.author?.username} • Author ID: ${this.newMessage.author?.id}`,
        iconURL: this.newMessage.author?.displayAvatarURL(),
      })
      .setTimestamp();

    if (storedAttachment?.link !== '' && embeddableContentTypes.includes(storedAttachment?.type ?? '')) {
      embed.setImage(storedAttachment?.link ?? '');
    }

    const jumpButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Jump To Message')
        .setStyle(ButtonStyle.Link)
        .setURL(this.newMessage.url),
    );

    const watchlist = await this.fetchWatchlist();
    const userOnWatchlist = watchlist.map((note) => note.watchedID).includes(this.newMessage.author?.id ?? '');
    if (userOnWatchlist) embed.setThumbnail(Images.WatchedUser);

    super.logChannel.send({ embeds: [embed], components: [jumpButton] });
  }

  // == Database Methods ==
  private async fetchWatchlist() {
    const result = await database.notes.findMany({
      where: { guildID: this.newMessage.guild?.id }
    });

    return result;
  }
}

client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
  new MessageUpdateHandler(oldMessage, newMessage).handle();
});
