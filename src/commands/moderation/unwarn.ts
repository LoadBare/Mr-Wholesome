import { ChatInputCommandInteraction } from "discord.js";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { database } from "../../lib/config.js";
import { CommandHandler } from "../command.js";

export class UnwarnCommandHandler extends CommandHandler {
  private warningID: string;

  constructor(interaction: ChatInputCommandInteraction) {
    super(interaction);
    this.warningID = this.interaction.options.getString('warning_id', true);
  }

  async handle() {
    const warning = await database
      .select()
      .from(schema.warnings)
      .where(eq(schema.warnings.date, this.warningID))
      .get();

    if (!warning) {
      return this.handleError(`**${this.warningID}** is not a valid warning ID!`);
    }

    const warningDeleteSuccessful = await database
      .delete(schema.warnings)
      .where(eq(schema.warnings.date, this.warningID))
      .then(() => true)
      .catch(() => false);

    if (!warningDeleteSuccessful) {
      return this.handleError('Error deleting warning from WARNING table!', true, 'unwarn.js');
    }

    await this.interaction.reply(`✅ Warning **${this.warningID}** has been removed.`);
  }
}
