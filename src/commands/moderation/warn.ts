import { ActionRowBuilder, ChatInputCommandInteraction, ModalActionRowComponentBuilder, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle, User } from "discord.js";
import { WarningModalHandler } from "modals/moderation/warn.js";
import { CommandHandler } from "../command.js";

export class WarnCommandHandler extends CommandHandler {
  private targetUser: User;
  private notifyUser: boolean;

  constructor(interaction: ChatInputCommandInteraction) {
    super(interaction);
    this.targetUser = interaction.options.getUser('user', true);
    this.notifyUser = interaction.options.getBoolean('notify_user', true);
  }

  async handle() {
    const warnModal = new ModalBuilder()
      .setCustomId(this.interaction.id)
      .setTitle(`Warn ${this.targetUser.username}`);

    const reasonTextInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Warning Reason')
      .setPlaceholder('No reason provided.')
      .setMaxLength(3900)
      .setRequired(false)
      .setStyle(TextInputStyle.Paragraph);

    const reasonActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonTextInput);
    warnModal.addComponents(reasonActionRow);

    await this.interaction.showModal(warnModal);

    const filter = (i: ModalSubmitInteraction) => i.customId === this.interaction.id;
    const modalSubmitInteraction = await this.interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 }).catch(() => { });

    if (!modalSubmitInteraction) {
      return;
    }

    new WarningModalHandler(modalSubmitInteraction, this.targetUser, this.notifyUser).handle();
  }
}
