import { ActionRowBuilder, EmbedBuilder, ModalActionRowComponentBuilder, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { WatchlistModalHandler } from "modals/moderation/watchlist.js";
import { baseEmbed, database } from "../../lib/config.js";
import { CommandHandler } from "../command.js";

export class WatchlistCommandHandler extends CommandHandler {
  public async handle() {
    const command = this.interaction.options.getSubcommand();
    if (command === 'add_note') this.handleAddNote();
    else if (command === 'delete_note') this.handleDeleteNote();
  }

  private async handleAddNote() {
    const targetUser = this.interaction.options.getUser('user', true);
    const displayName = targetUser.displayName;

    const watchlistModal = new ModalBuilder()
      .setCustomId(this.interaction.id)
      .setTitle(`Adding a note to ${displayName}`);

    const noteTextInput = new TextInputBuilder()
      .setCustomId('note')
      .setLabel('Note')
      .setPlaceholder('No note provided.')
      .setMaxLength(3900)
      .setRequired(false)
      .setStyle(TextInputStyle.Paragraph);

    const noteActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(noteTextInput);
    watchlistModal.addComponents(noteActionRow);

    await this.interaction.showModal(watchlistModal);

    const filter = (i: ModalSubmitInteraction) => i.customId === this.interaction.id;
    const modalSubmitInteraction = await this.interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 }).catch(() => { });

    if (!modalSubmitInteraction) {
      return;
    }

    new WatchlistModalHandler(modalSubmitInteraction, targetUser).handle();
  }

  private async handleDeleteNote() {
    await this.interaction.deferReply();
    const noteID = this.interaction.options.getString('id', true);

    const result = await this.deleteNoteFromDatabase(noteID);
    if (!result) return this.handleError(`**${noteID}** is not a valid Note ID`);

    const displayName = this.interaction.user.displayName;
    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`${displayName}'s Watchlist`)
      .setDescription(`✅ Successfully deleted note of ID **${noteID}** from **${displayName}**`);

    await this.interaction.editReply({ embeds: [embed] });
  }

  private async deleteNoteFromDatabase(noteID: string) {
    const result = await database.notes.delete({
      where: {
        date: noteID
      }
    }).catch(() => null);

    return result;
  }
}
