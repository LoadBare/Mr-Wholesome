import { PermissionOverwriteOptions, TextChannel } from "discord.js";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { database } from "../../lib/config.js";
import { ButtonHandler } from "../button-handler.js";

export class openTicketButtonHandler extends ButtonHandler {
  async handle() {
    await this.interaction.deferReply();
    const timeCreated = this.interaction.customId.split(':')[2];
    const ticket = await database
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.timeCreated, timeCreated))
      .get();

    if (!ticket) {
      return this.handleError('Error fetching ticket from TICKET table.', true, 'open-ticket.js');
    }

    if (ticket.open) {
      return this.handleError('This ticket is already open.');
    }

    const ticketChannel = this.interaction.channel as TextChannel; // Button is only available in ticket channel, so it's safe to cast to TextChannel
    const permissionOverwrites: PermissionOverwriteOptions = {
      AttachFiles: true,
      SendMessages: true,
      ReadMessageHistory: true,
      ViewChannel: true
    };
    for (const addedUser of ticket.addedUsers) {
      await ticketChannel.permissionOverwrites.create(addedUser, permissionOverwrites);
    }
    await ticketChannel.permissionOverwrites.create(ticket.authorID, permissionOverwrites);
    await ticketChannel.setName(`❌${ticketChannel.name.substring(1)}`);
    const [ticketUpdated] = await database
      .update(schema.tickets)
      .set({ open: true })
      .where(eq(schema.tickets.timeCreated, timeCreated))
      .returning();

    if (!ticketUpdated) {
      return this.handleError('Error updating ticket in TICKET table!', true, 'open-ticket.js');
    }

    await this.interaction.editReply({ content: 'Ticket opened.' });
  }
}
