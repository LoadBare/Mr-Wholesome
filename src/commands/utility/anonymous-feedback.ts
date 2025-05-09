import { CommandHandler } from "commands/command.js";
import { stripIndents } from "common-tags";
import { createHash } from "crypto";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalActionRowComponentBuilder, ModalBuilder, ModalSubmitInteraction, TextChannel, TextInputBuilder, TextInputStyle } from "discord.js";
import { ChannelIDs, database } from "lib/config.js";

export class AnonymousFeedbackCommandHandler extends CommandHandler {
  async handle() {
    const hashedUserID = createHash('sha256').update(this.interaction.user.id).digest('base64');
    const feedbackUser = await database.feedbackUser.upsert({
      where: { hashedUserID },
      update: {},
      create: {
        hashedUserID,
        warned: false,
        blocked: false,
      },
    });

    if (feedbackUser.blocked) {
      this.interaction.reply({ content: '❌ You have been blocked from sending anonymous feedback.', flags: MessageFlags.Ephemeral });
      return;
    }

    const messageModal = new ModalBuilder()
      .setCustomId(this.interaction.id)
      .setTitle(`Anonymous Feedback`);

    const messageTextInput = new TextInputBuilder()
      .setCustomId('message')
      .setLabel('Message')
      .setPlaceholder('Text entered here will be 100% anonymised and shared with the mods by Mr Wholesome.')
      .setMaxLength(3900)
      .setRequired(true)
      .setStyle(TextInputStyle.Paragraph);

    const messageActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(messageTextInput);
    messageModal.addComponents(messageActionRow);

    await this.interaction.showModal(messageModal);

    const filter = (i: ModalSubmitInteraction) => i.customId === this.interaction.id;
    const modalSubmitInteraction = await this.interaction.awaitModalSubmit({ filter, time: 10 * 60 * 1000 }).catch(() => { });

    if (!modalSubmitInteraction) return;

    await modalSubmitInteraction.reply({ content: '✅ Your feedback has been anonymised and shared with the mods.', flags: MessageFlags.Ephemeral });
    const content = modalSubmitInteraction.fields.getTextInputValue('message');

    const feedbackChannel = await this.guild.channels.fetch(ChannelIDs.AnonymousFeedback);
    if (!feedbackChannel || !(feedbackChannel instanceof TextChannel)) return;

    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .setComponents(
        new ButtonBuilder()
          .setCustomId(`feedback/warn/${this.interaction.user.id}`)
          .setLabel(feedbackUser.warned ? 'Warned' : 'Warn')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(feedbackUser.warned),
        new ButtonBuilder()
          .setCustomId(`feedback/block/${this.interaction.user.id}`)
          .setLabel(feedbackUser.warned ? 'Block' : 'Block (Warn First)')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!feedbackUser.warned)
      );

    const embed = new EmbedBuilder().setDescription('This message was sent anonymously.');
    const feedbackMessage = await feedbackChannel.send({ content, embeds: [embed], components: [buttons] });

    const messageID = feedbackMessage.id;
    embed.setDescription(stripIndents`
      This message was sent anonymously.
      -# Message ID: ${messageID}
      -# User ID: ${hashedUserID}`);
    await feedbackMessage.edit({ embeds: [embed] });


    await database.feedback.create({
      data: {
        messageID,
        hashedUserID
      },
    });
  }
}

/**
 * When it comes to warn/block buttons, they're gonna have to be permanent and linked.
 * E.g. if 2+ feedback sent by same user who is then warned, ALL feedback buttons need to be updated to disabled and label say "Warned".
 * Likely store message IDs in database so that they can be fetched and buttons updated when warned.
 * Do same with block button, update all to be disabled and label say "Blocked".
 * Also need an unblock command.
 */