import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionOverwriteOptions, userMention } from "discord.js";
import { and, eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { database } from "../../lib/config.js";
import { ButtonHandler } from "../button-handler.js";

export class createTicketButtonHandler extends ButtonHandler {
  async handle() {
    await this.interaction.deferReply({ ephemeral: true });
    const name = this.interaction.customId.split(':')[2];
    const guildID = this.guild.id;
    const ticketPanel = await database
      .select()
      .from(schema.ticketPanels)
      .where(and(eq(schema.ticketPanels.name, name), eq(schema.ticketPanels.guildID, guildID)))
      .get();

    if (!ticketPanel) {
      return this.handleError('Error fetching ticket panel from TICKET_PANEL table.', true, 'create-ticket.js');
    }

    const moderatorRole = await this.guild.roles.fetch(ticketPanel.moderatorRoleID);

    if (!moderatorRole) {
      return this.handleError('Error fetching moderator role from guild.', true, 'create-ticket.js');
    }


    const user = this.interaction.user;
    const bot = this.interaction.client.user;
    const ticketChannel = await this.guild.channels.create({
      name: `❌${user.username}`,
      type: ChannelType.GuildText,
      parent: ticketPanel.categoryID
    }).catch(() => null);

    if (!ticketChannel) {
      return this.handleError('Error creating ticket channel.', true, 'create-ticket.js');
    }

    const timeCreated = Date.now().toString();
    const closeTicketButton = new ButtonBuilder()
      .setCustomId(`ticket:close:${timeCreated}`)
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary);
    const closeTicketActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(closeTicketButton);

    const permissionOverwrites: PermissionOverwriteOptions = {
      AttachFiles: true,
      SendMessages: true,
      ReadMessageHistory: true,
      ViewChannel: true
    };
    await ticketChannel.permissionOverwrites.create(user, permissionOverwrites);
    await ticketChannel.permissionOverwrites.create(moderatorRole, permissionOverwrites);
    await ticketChannel.permissionOverwrites.create(bot, permissionOverwrites);
    await ticketChannel.permissionOverwrites.create(ticketChannel.guild.roles.everyone, { ViewChannel: false });

    const formattedJSON = ticketPanel.ticketEmbedJSON.replace('{user}', userMention(user.id));
    const ticketEmbed = JSON.parse(formattedJSON);
    await ticketChannel.send({ embeds: [ticketEmbed], components: [closeTicketActionRow] });

    const ticketCreationSuccessful = await database
      .insert(schema.tickets)
      .values({
        authorID: user.id,
        channelID: ticketChannel.id,
        ticketPanelName: name,
        timeCreated
      })
      .then(() => true)
      .catch(() => false);

    if (!ticketCreationSuccessful) {
      ticketChannel.delete().catch(() => null);
      return this.handleError('Error creating ticket in TICKET table!', true, 'create-ticket.js');
    }

    await this.interaction.editReply({ content: `✅ Ticket created in ${ticketChannel}` });
  }
}
