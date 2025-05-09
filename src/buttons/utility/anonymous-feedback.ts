import { ButtonHandler } from "buttons/button-handler.js";
import { stripIndents } from "common-tags";
import { createHash } from "crypto";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, TextChannel, inlineCode, time } from "discord.js";
import { ChannelIDs, EmbedColours, Emotes, database } from "lib/config.js";

export class AnonymousFeedbackButtonHandler extends ButtonHandler {
  private operation: string;
  private userID: string;
  private hashedUserID: string;

  constructor(interaction: ButtonInteraction) {
    super(interaction);
    this.operation = interaction.customId.split('/')[1];
    this.userID = interaction.customId.split('/')[2];
    this.hashedUserID = createHash('sha256').update(this.userID).digest('base64');
  }

  async handle() {
    if (this.operation === 'warn') {
      await this.warnUser();
    }
    else if (this.operation === 'block') {
      await this.blockUser();
    }
    else if (this.operation === 'unblock') {
      await this.unblockUser();
    }
  }

  private async editFeedbackMessages(operation: 'warn' | 'block' | 'unblock') {
    const feedbackChannel = await this.guild.channels.fetch(ChannelIDs.AnonymousFeedback);
    if (!feedbackChannel || !(feedbackChannel instanceof TextChannel)) return;

    const feedbackMessageIDs = await database.feedback.findMany({
      where: {
        hashedUserID: this.hashedUserID
      },
    });

    const feedbackMessages = await Promise.all(feedbackMessageIDs.map(async (msg) => {
      const message = await feedbackChannel.messages.fetch(msg.messageID).catch(() => { });
      if (!message) return null;
      return message;
    }));

    const updatedButtons = new ActionRowBuilder<ButtonBuilder>();
    if (operation === 'warn') {
      updatedButtons.setComponents(
        new ButtonBuilder()
          .setCustomId(`feedback/warn/${this.userID}`)
          .setLabel('Warned')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`feedback/block/${this.userID}`)
          .setLabel('Block')
          .setStyle(ButtonStyle.Danger)
      );
    }
    else if (operation === 'block') {
      updatedButtons.setComponents(
        new ButtonBuilder()
          .setCustomId(`feedback/warn/${this.userID}`)
          .setLabel('Warned')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`feedback/block/${this.userID}`)
          .setLabel('Blocked')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`feedback/unblock/${this.userID}`)
          .setLabel('Unblock')
          .setStyle(ButtonStyle.Success)
      );
    }
    else {
      updatedButtons.setComponents(
        new ButtonBuilder()
          .setCustomId(`feedback/warn/${this.userID}`)
          .setLabel('Warned')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`feedback/block/${this.userID}`)
          .setLabel('Block')
          .setStyle(ButtonStyle.Danger)
      );
    }

    for await (const message of feedbackMessages) {
      if (!message) continue;

      await message.edit({ components: [updatedButtons] }).catch(() => { });
    };
  }

  private async warnUser() {
    const confirmationEmbed = new EmbedBuilder()
      .setTitle('Warning User')
      .setDescription(stripIndents`
        Are you sure you want to warn this user? This will notify them (if possible).

        -# User ID: ${inlineCode(this.hashedUserID)}
        -# This will timeout ${time(new Date(Date.now() + 10 * 60 * 1000), 'R')}.`)
      .setColor(EmbedColours.Neutral);

    const confirmationButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`yes`)
          .setLabel('Yes')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`no`)
          .setLabel('No')
          .setStyle(ButtonStyle.Secondary)
      );
    await this.interaction.reply({ embeds: [confirmationEmbed], components: [confirmationButtons] });
    const filter = (i: ButtonInteraction) => i.user.id === this.interaction.user.id;
    const confirmationInteraction = await this.interaction.channel?.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 10 * 60 * 1000 }).catch(() => { });
    if (!confirmationInteraction) {
      confirmationEmbed.setDescription('Warning has timed out.');
      confirmationEmbed.setColor(EmbedColours.Negative);
      await this.interaction.editReply({ embeds: [confirmationEmbed], components: [] });
      return;
    } else if (confirmationInteraction.customId === 'no') {
      confirmationEmbed.setDescription('Warning has been cancelled.');
      confirmationEmbed.setColor(EmbedColours.Negative);
      await this.interaction.editReply({ embeds: [confirmationEmbed], components: [] });
      return;
    }

    const botEmbed = new EmbedBuilder()
      .setTitle('Warning User')
      .setDescription(stripIndents`
        ${Emotes.Loading} Please wait while I warn the user, this will take a few minutes...

        -# User ID: ${inlineCode(this.hashedUserID)}`)
      .setColor(EmbedColours.Neutral);
    await this.interaction.editReply({ embeds: [botEmbed], components: [] });

    const targetUser = await this.interaction.client.users.fetch(this.userID).catch(() => { });
    let notified = false;
    if (targetUser) {
      const warningEmbed = new EmbedBuilder()
        .setTitle('⚠️ Abuse of Anonymous Feedback System')
        .setDescription(stripIndents`
        The anonymous feedback system exists to allow community members to provide feedback or suggestions without anxiety of repercussion, and abusing it will result in your account being unable to submit further feedback.
        
        Abuse of the anonymous feedback system looks like:
        - Compliments / pat-the-mods well-wishing
        - Unconstructive complaints
        - Any behaviour that violates community or Discord terms and guidelines

        This is your one and only warning, continued abuse will result in being blocked from submitting further feedback.`)
        .setColor(EmbedColours.Negative)
        .setFooter({ text: 'Your identity remains anonymous. This warning was handled by Mr Wholesome.' });

      notified = await targetUser.send({ embeds: [warningEmbed] })
        .then(() => { return true; })
        .catch(() => { return false; });
    }

    await this.editFeedbackMessages('warn').catch(() => { });

    await database.feedbackUser.update({
      where: {
        hashedUserID: this.hashedUserID
      },
      data: {
        warned: true
      }
    });

    botEmbed.setDescription(stripIndents`
      ${notified ? '✅' : '⚠️'} User has been warned ${notified ? 'and notified' : 'but could not be notified'}.
      All their feedback messages have been updated to reflect this.

      The block button has been enabled, which will block the user from submitting further feedback.

      -# User ID: ${inlineCode(this.hashedUserID)}`);
    botEmbed.setColor(EmbedColours.Positive);

    await this.interaction.editReply({ embeds: [botEmbed] });
  }

  private async blockUser() {
    const botEmbed = new EmbedBuilder()
      .setTitle('Blocking User')
      .setDescription(stripIndents`
        ${Emotes.Loading} Please wait while I block the user, this will take a few minutes...

        -# User ID: ${inlineCode(this.hashedUserID)}`)
      .setColor(EmbedColours.Neutral);

    await this.interaction.reply({ embeds: [botEmbed] });

    await this.editFeedbackMessages('block').catch(() => { });

    await database.feedbackUser.update({
      where: {
        hashedUserID: this.hashedUserID
      },
      data: {
        blocked: true
      }
    });

    botEmbed.setDescription(stripIndents`
      ✅ User has been blocked from submitting further feedback.
      All their feedback messages have been updated to reflect this.

      A new button has been added to unblock the user, which will allow them to submit feedback again.
      Note this will not remove the warning they received.
      
      -# User ID: ${inlineCode(this.hashedUserID)}`);
    botEmbed.setColor(EmbedColours.Positive);

    await this.interaction.editReply({ embeds: [botEmbed] });
  }

  private async unblockUser() {
    const botEmbed = new EmbedBuilder()
      .setTitle('Unblocking User')
      .setDescription(stripIndents`
        ${Emotes.Loading} Please wait while I unblock the user, this will take a few minutes...

        -# User ID: ${inlineCode(this.hashedUserID)}`)
      .setColor(EmbedColours.Neutral);

    await this.interaction.reply({ embeds: [botEmbed] });

    await this.editFeedbackMessages('unblock').catch(() => { });

    await database.feedbackUser.update({
      where: {
        hashedUserID: this.hashedUserID
      },
      data: {
        blocked: false
      }
    });

    botEmbed.setDescription(stripIndents`
      ✅ User has been unblocked and can now submit feedback again.
      All their feedback messages have been updated to reflect this.

      -# User ID: ${inlineCode(this.hashedUserID)}`);
    botEmbed.setColor(EmbedColours.Positive);

    await this.interaction.editReply({ embeds: [botEmbed] });
  }
}
