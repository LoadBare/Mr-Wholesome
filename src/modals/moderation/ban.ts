import { stripIndents } from "common-tags";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, heading, italic, Message, ModalSubmitInteraction, User } from "discord.js";
import { baseEmbed, database, EmbedColours } from "../../lib/config.js";
import { ModalHandler } from "../handler.js";

export class BanModalHandler extends ModalHandler {
  private reason: string;
  private targetUser: User;
  private deleteMessages: number;
  private notifyUser: boolean;

  constructor(interaction: ModalSubmitInteraction, targetUser: User, deleteMessages: number, notifyUser: boolean) {
    super(interaction);
    this.reason = interaction.fields.getTextInputValue('reason') || 'No reason provided.';
    this.targetUser = targetUser;
    this.deleteMessages = deleteMessages;
    this.notifyUser = notifyUser;
  }

  async handle() {
    await this.interaction.deferReply();

    const guildBans = await this.guild.bans.fetch();
    if (guildBans.has(this.targetUser.id)) return this.handleError(`**${this.targetUser.displayName}** is already banned.`);

    const member = await this.guild.members.fetch(this.targetUser).catch(() => { });
    if (member && !member.bannable) return this.handleError(`**${this.targetUser.displayName}** is not considered bannable. This is likely permission related.`);

    let deleteMessageLength = '';

    if (this.deleteMessages === 0) deleteMessageLength = 'none';
    else if (this.deleteMessages === 60 * 60) deleteMessageLength = 'the Previous Hour';
    else if (this.deleteMessages === 6 * 60 * 60) deleteMessageLength = 'the Previous 6 Hours';
    else if (this.deleteMessages === 12 * 60 * 60) deleteMessageLength = 'the Previous 12 Hours';
    else if (this.deleteMessages === 24 * 60 * 60) deleteMessageLength = 'the Previous 24 Hours';
    else if (this.deleteMessages === 3 * 24 * 60 * 60) deleteMessageLength = 'the Previous 3 Days';
    else if (this.deleteMessages === 7 * 24 * 60 * 60) deleteMessageLength = 'the Previous 7 Days';
    else deleteMessageLength = `${this.deleteMessages}`;

    const confirmationEmbed = new EmbedBuilder(baseEmbed)
      .setTitle(`You're About To Ban ${this.targetUser.displayName}`)
      .setDescription(stripIndents`
      Doing so **${this.notifyUser ? 'will notify' : 'will not notify'}** them, if possible.
      It will also delete **${deleteMessageLength}** of their message history.
      
      # Reason
      ${this.reason}`);

    const confirmationButtons = new ActionRowBuilder<ButtonBuilder>()
      .setComponents(
        new ButtonBuilder()
          .setCustomId('yes')
          .setLabel(`Ban ${this.targetUser.displayName}`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('no')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    const message = await this.interaction.editReply({ embeds: [confirmationEmbed], components: [confirmationButtons] });

    const filter = (i: ButtonInteraction) => i.user.id === this.interaction.user.id;
    const confirmation = await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 30_000 }).catch(() => { });

    if (!confirmation) {
      confirmationEmbed
        .setTitle('Ban Cancelled')
        .setDescription('No input detected after 30 seconds, ban has been cancelled.')
        .setColor(EmbedColours.Negative);

      this.interaction.editReply({ embeds: [confirmationEmbed], components: [] });
      return;
    }

    if (confirmation.customId === 'no') {
      confirmationEmbed
        .setDescription('Ban has been cancelled by user.')
        .setColor(EmbedColours.Neutral);

      this.interaction.editReply({ embeds: [confirmationEmbed], components: [] });
      return;
    }

    let notifiedMessage: Message<false> | boolean = false;
    if (this.notifyUser) {
      const content = [
        heading(`Banned from ${this.guild.name}`),
        this.reason
      ].join('\n');

      notifiedMessage = await this.messageUser(this.targetUser, content, 'Red');
    }

    const banned = await this.guild.members.ban(this.targetUser, { deleteMessageSeconds: this.deleteMessages, reason: this.reason }).then(() => true).catch(() => false);
    if (!banned) {
      let editSuccessful = false;
      if (notifiedMessage instanceof Message) {
        const edited = await notifiedMessage.edit({ content: 'An error occurred, please disregard this notification. No action is necessary on your part.', embeds: [] }).catch(() => { });
        if (edited) editSuccessful = true;
      }

      let notificationDeletedMessage = '';
      if (editSuccessful) notificationDeletedMessage = '\nℹ️ The user was notified however the notification was quickly edited.';
      else if (!editSuccessful && notifiedMessage instanceof Message) notificationDeletedMessage = '\n⚠️ The user was notified and the notification could not be edited!';
      return this.handleError(`An error occurred whilst trying to ban ${this.targetUser.username}. Please try again.${notificationDeletedMessage}`);
    }

    const embedDescription = [
      `✅ ${this.targetUser.username} has been${notifiedMessage ? ' notified and' : ''} banned from the server.`,
    ];
    if (!notifiedMessage && this.notifyUser) embedDescription.push('', italic('⚠️ User has DMs disabled, unable to notify.'));

    const recorded = await this.addBanToDatabase(this.targetUser);
    if (!recorded) embedDescription.push('', italic('⚠️ An error occurred whilst adding the ban to the database.'));

    const embed = new EmbedBuilder(baseEmbed)
      .setDescription(embedDescription.join('\n'));

    await this.interaction.editReply({ embeds: [embed], components: [] });
  }

  // == Database Methods ==
  private async addBanToDatabase(user: User) {
    const result = await database.ban.create({
      data: {
        authorID: this.interaction.user.id,
        bannedID: user.id,
        date: Date.now().toString(),
        reason: this.reason,
        guildID: this.guild.id,
      }
    }).then(() => true).catch(() => false);

    return result;
  }
}
