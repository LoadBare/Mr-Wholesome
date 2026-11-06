import { TextChannel, time } from "discord.js";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { database } from "../../lib/config.js";
import { sleep } from "../../lib/utilities.js";
import { ButtonHandler } from "../button-handler.js";

export class deleteTicketButtonHandler extends ButtonHandler {
  async handle() {
    const timeCreated = this.interaction.customId.split(':')[2];
    const ticket = await database
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.timeCreated, timeCreated))
      .get();

    if (!ticket) {
      return this.handleError('Error fetching ticket from TICKET table.', true, 'delete-ticket.js');
    }

    const ticketChannel = this.interaction.channel as TextChannel; // Button is only available in ticket channel, so it's safe to cast to TextChannel
    const futureDate = new Date(Date.now() + 5000);
    await this.interaction.reply({ content: `Deleting ticket ${time(futureDate, 'R')}...` });
    await sleep(5000);

    const ticketDeleteSuccessful = await database
      .delete(schema.tickets)
      .where(eq(schema.tickets.timeCreated, timeCreated))
      .then(() => true)
      .catch(() => false);

    if (!ticketDeleteSuccessful) {
      return this.handleError('Error deleting ticket from TICKET table!', true, 'delete-ticket.js');
    }

    const channelDeleteSuccessful = await ticketChannel.delete().then(() => true).catch(() => false);

    if (!channelDeleteSuccessful) {
      return this.handleError('Error deleting ticket channel.', true, 'delete-ticket.js');
    }
  }
}
