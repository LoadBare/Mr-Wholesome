import { AttachmentBuilder, Events, ForumChannel, Message } from 'discord.js';
import { client } from '../../index.js';
import { ChannelIDs, Emotes, EventHandler, UserIDs } from '../../lib/config.js';
import MessageStatisticsHandler from '../../lib/message-statistics-handler.js';
import RankingHandler from '../../lib/ranking-handler.js';
import { channelIgnoresEvents, sleep, styleLog } from '../../lib/utilities.js';

class MessageCreateHandler extends EventHandler {
  message: Message;

  constructor(message: Message) {
    super();
    this.message = message;
  }

  async handle() {
    const { guildId, channelId, author } = this.message;
    const channelHasEventsIgnored = await channelIgnoresEvents(guildId, channelId);
    if (author.bot || channelHasEventsIgnored) return;

    this.autoCrosspost();
    this.bonkAkiaForSorry();
    this.painAuChocolat();
    this.reactWithArson();
    this.useSlashCommands();
    this.handleRanking();
    this.handleMessageStatistics();
    this.handleModOnlyForumChannel();
    this.akiaSnoGif();
  }

  // Automatically crosspost any message sent in Announcement channels
  private async autoCrosspost() {
    if (!this.message.crosspostable) return;

    await this.message.crosspost()
      .then(() => styleLog(`Crossposted message! [${this.message.url}]`, true, 'message-create.js'))
      .catch((e) => styleLog(`Error crossposting message! [${this.message.url}]`, false, 'message-create.js', e));
  }

  // React with :akiaBonque: emoji and say "NO SORRY" if message contains "sorry" and sent by Akia
  private async bonkAkiaForSorry() {
    const messageContainsSorry = this.message.content.search(/[s]+[o]+[rw]+[y]+/mi) !== -1;
    const authorIsAkia = this.message.author.id === UserIDs.Akialyne;
    if (!messageContainsSorry || !authorIsAkia) return;

    await this.message.react(Emotes.Bonque)
      .then(() => styleLog(`Reacted with Bonque! [${this.message.url}]`, true, 'message-create.js'))
      .catch((e) => styleLog(`Error reacting to message! [${this.message.url}]`, false, 'message-create.js', e));
    await this.message.reply(`NO SORRY ${Emotes.Bonque}`)
      .then(() => styleLog(`Replied with "NO SORRY"! [${this.message.url}]`, true, 'message-create.js'))
      .catch((e) => styleLog(`Error replying to message! [${this.message.url}]`, false, 'message-create.js', e));
  }

  // Say "au chocolat?" if the message ends with "pain" and is sent in #🤡-memes-🤡
  private async painAuChocolat() {
    const messageEndsWithPain = this.message.content.search(/\bpain\W{0,}$/i) !== -1;
    const channelIsMemes = this.message.channelId === ChannelIDs.Memes;
    if (!messageEndsWithPain || !channelIsMemes) return;

    await this.message.reply('au chocolat?')
      .then(() => styleLog(`Replied with "au chocolat?"! [${this.message.url}]`, true, 'message-create.js'))
      .catch((e) => styleLog(`Error replying to message! [${this.message.url}]`, false, 'message-create.js', e));
  }

  // React with the :arson: emoji if the message contains "arson"
  private async reactWithArson() {
    const messageContainsArson = this.message.content.search(/(?<!\S)[a]+[r]+[s]+[o]+[n]+/mi) !== -1;
    if (!messageContainsArson) return;

    await this.message.react(Emotes.Arson)
      .then(() => styleLog(`Reacted with Arson! [${this.message.url}]`, true, 'message-create.js'))
      .catch((e) => styleLog(`Error reacting to message! [${this.message.url}]`, false, 'message-create.js', e));
  }

  // Say "Hey, I use slash commands now!" if the message is an old command
  private async useSlashCommands() {
    const oldCommands = ['!birthday', '!8ball', '!cookie', '!cat', '!dog', '!fox', '!reading', '!help', '!mystats', '!ping', '!ban', '!warn', '!watchlist', '!top', '!rank', '!ticketpanel'];
    const messageIsOldCommand = oldCommands.includes(this.message.content.split(' ')[0]);
    if (!messageIsOldCommand) return;

    await this.message.reply('Hey, I use slash commands now!')
      .then(() => styleLog(`Replied with Slash Command Reminder! [${this.message.url}]`, true, 'message-create.js'))
      .catch((e) => styleLog(`Error replying to message! [${this.message.url}]`, false, 'message-create.js', e));
  }

  // Handle everything related to member ranking
  private async handleRanking() {
    new RankingHandler(this.message).handle();
  }

  // Handle everything related to tracking member message statistics
  private handleMessageStatistics() {
    new MessageStatisticsHandler(this.message).handle();
  }

  private async handleModOnlyForumChannel() {
    if (!this.message.channel.isThread()) return;
    if (!(this.message.channel.parent instanceof ForumChannel)) return;

    const availableTags = this.message.channel.parent.availableTags;
    const appliedTags = this.message.channel.appliedTags;
    const modPostTag = availableTags.filter((tag) => tag.name === 'Mod Post');
    if (modPostTag.length !== 1) return;

    const threadIsModPost = appliedTags.findIndex((tag) => tag === modPostTag[0].id) !== -1 ? true : false;
    if (!threadIsModPost) return;

    const authorIsMod = this.message.member?.permissions.has('BanMembers');
    if (authorIsMod) return;

    const reply = await this.message.reply({ content: 'You must be a moderator to post in forum channels with the "Mod Post" tag!\n-# Deleting in 5 seconds.', allowedMentions: { repliedUser: true } });
    await this.message.delete();
    await sleep(5000);
    await reply.delete();
  }

  private async akiaSnoGif() {
    const channelIsIRLStuff = this.message.channelId === ChannelIDs.IRLStuff;
    const authorIsAkia = this.message.author.id === UserIDs.Akialyne;
    const messageContainsSno = this.message.content.search(/[s]+[n]+[o]+/mi) !== -1;
    if (!(channelIsIRLStuff && authorIsAkia && messageContainsSno)) return;

    const snoAttachment = new AttachmentBuilder('./assets/SNO.gif');
    await this.message.reply({ files: [snoAttachment] });
  }
}

client.on(Events.MessageCreate, (message) => {
  new MessageCreateHandler(message).handle();
});
