import { ActionRowBuilder, ChatInputCommandInteraction, ModalActionRowComponentBuilder, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle, User, UserContextMenuCommandInteraction } from "discord.js";
import { BanModalHandler } from "../../modals/moderation/ban.js";
import { CommandHandler } from "../command.js";

export class BanCommandHandler extends CommandHandler {
  private targetUser: User;
  private deleteMessages: number;
  private notifyUser: boolean;

  constructor(interaction: ChatInputCommandInteraction) {
    super(interaction);
    this.targetUser = interaction.options.getUser('user', true);
    this.deleteMessages = interaction.options.getInteger('delete_messages', true);
    this.notifyUser = interaction.options.getBoolean('notify_user', true);
  }

  async handle() {
    const banModal = new ModalBuilder()
      .setCustomId(this.interaction.id)
      .setTitle(`Ban ${this.targetUser.username}`);

    const reasonTextInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Ban Reason')
      .setPlaceholder('No reason provided.')
      .setMaxLength(3900)
      .setRequired(false)
      .setStyle(TextInputStyle.Paragraph);

    const reasonActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonTextInput);
    banModal.addComponents(reasonActionRow);

    await this.interaction.showModal(banModal);

    const filter = (i: ModalSubmitInteraction) => i.customId === this.interaction.id;
    const modalSubmitInteraction = await this.interaction.awaitModalSubmit({ filter, time: 10 * 60 * 1000 }).catch(() => { });

    if (!modalSubmitInteraction) {
      return;
    }

    new BanModalHandler(modalSubmitInteraction, this.targetUser, this.deleteMessages, this.notifyUser);
  }
}

export class ContextMenuBanCommandHandler {
  private interaction: UserContextMenuCommandInteraction;
  private targetUser: User;

  constructor(interaction: UserContextMenuCommandInteraction) {
    this.interaction = interaction;
    this.targetUser = interaction.targetUser;
  }

  async handle() {
    const banModal = new ModalBuilder()
      .setCustomId(this.interaction.id)
      .setTitle(`Ban ${this.targetUser.username}`);

    const reasonTextInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Ban Reason')
      .setPlaceholder('No reason provided.')
      .setMaxLength(3900)
      .setRequired(false)
      .setStyle(TextInputStyle.Paragraph);

    const reasonActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonTextInput);
    banModal.addComponents(reasonActionRow);

    await this.interaction.showModal(banModal);

    const filter = (i: ModalSubmitInteraction) => i.customId === this.interaction.id;
    const modalSubmitInteraction = await this.interaction.awaitModalSubmit({ filter, time: 10 * 60 * 1000 }).catch(() => { });

    if (!modalSubmitInteraction) {
      return;
    }

    new BanModalHandler(modalSubmitInteraction, this.targetUser, 7 * 24 * 60 * 60, true).handle();
  }
}
