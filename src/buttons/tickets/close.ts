import { ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from "discord.js";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { database, EmbedColours } from "../../lib/config.js";
import { ButtonHandler } from "../button-handler.js";

export class closeTicketButtonHandler extends ButtonHandler {
  async handle() {
    await this.interaction.deferReply();
    const timeCreated = this.interaction.customId.split(':')[2];
    const ticket = await database
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.timeCreated, timeCreated))
      .get();

    if (!ticket) {
      return this.handleError('Error fetching ticket from TICKET table.', true, 'close-ticket.js');
    }

    if (!ticket.open) {
      return this.handleError('This ticket is already closed.');
    }

    const ticketChannel = this.interaction.channel as TextChannel; // Button is only available in ticket channel, so it's safe to cast to TextChannel
    for (const addedUser of ticket.addedUsers) {
      await ticketChannel.permissionOverwrites.delete(addedUser);
    }
    await ticketChannel.permissionOverwrites.delete(ticket.authorID);
    await ticketChannel.setName(`✅${ticketChannel.name.substring(1)}`);
    const ticketUpdated = await database
      .update(schema.tickets)
      .set({ open: false })
      .where(eq(schema.tickets.timeCreated, timeCreated))
      .then(() => true)
      .catch(() => false);

    if (!ticketUpdated) {
      return this.handleError('Error updating ticket in TICKET table!', true, 'close-ticket.js');
    }

    const openTicketButton = new ButtonBuilder()
      .setCustomId(`ticket:open:${timeCreated}`)
      .setLabel('Open Ticket')
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Secondary);
    const deleteTicketButton = new ButtonBuilder()
      .setCustomId(`ticket:delete:${timeCreated}`)
      .setLabel('Delete Ticket')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger);
    const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(openTicketButton, deleteTicketButton);

    const embeds = [this.simpleEmbed(`Ticket closed by ${this.interaction.user}.`, EmbedColours.Info)];
    await this.interaction.editReply({ embeds, components: [buttonActionRow] });
  }
}
