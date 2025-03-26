import { EmbedBuilder, ModalSubmitInteraction, User } from "discord.js";
import { baseEmbed, database } from "../../lib/config.js";
import { ModalHandler } from "../handler.js";

export class WatchlistModalHandler extends ModalHandler {
  private note: string;
  private targetUser: User;

  public constructor(interaction: ModalSubmitInteraction, targetUser: User) {
    super(interaction);
    this.note = interaction.fields.getTextInputValue('note') || 'No note provided.';
    this.targetUser = targetUser;
  }

  public async handle() {
    await this.interaction.deferReply();

    const recorded = await this.addNoteToDatabase(this.targetUser);
    if (!recorded) return this.handleError('Error occurred whilst creating note in NOTE table');

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`${this.targetUser.displayName}'s Watchlist`)
      .setDescription(`✅ Successfully added a note to **${this.targetUser.displayName}**`);

    await this.interaction.reply({ embeds: [embed] });
  }

  private async addNoteToDatabase(user: User) {
    const result = await database.notes.create({
      data: {
        authorID: this.interaction.user.id,
        date: Date.now().toString(),
        guildID: this.guild.id,
        noteText: this.note,
        watchedID: user.id
      }
    });

    return result;
  }
}
