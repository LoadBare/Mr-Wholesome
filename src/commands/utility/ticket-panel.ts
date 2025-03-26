import { stripIndents } from "common-tags";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CategoryChannel, ChannelType, ComponentType, EmbedBuilder, ForumChannel, MediaChannel, ModalActionRowComponentBuilder, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { TicketPanelModalHandler } from "modals/utility/ticket-panel.js";
import { baseEmbed, database, EmbedColours } from "../../lib/config.js";
import { CommandHandler } from "../command.js";

export class TicketPanelCommandHandler extends CommandHandler {
  async handle() {
    const subcommand = this.interaction.options.getSubcommand(true);

    if (subcommand === 'create') this.showTicketPanelCreationModal();
    else if (subcommand === 'delete') this.deleteTicketPanel();
    else if (subcommand === 'post') this.postTicketPanel();
  }

  private async showTicketPanelCreationModal() {
    const name = this.interaction.options.getString('name', true);
    const category = this.interaction.options.getChannel('category', true, [ChannelType.GuildCategory]);
    const moderatorRole = this.interaction.options.getRole('moderator-role', true);

    const ticketPanelModal = new ModalBuilder()
      .setCustomId(this.interaction.id)
      .setTitle('Ticket Panel');

    const panelTitleTextInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Panel Title')
      .setPlaceholder('Support Tickets')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    const panelDescriptionTextInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Panel Description')
      .setPlaceholder('Need help? Create a ticket using the button below!')
      .setRequired(true)
      .setStyle(TextInputStyle.Paragraph);

    const ticketDescriptionTextInput = new TextInputBuilder()
      .setCustomId('ticket-description')
      .setLabel('Ticket Description')
      .setPlaceholder('Welcome {user}! Please describe your issue below.')
      .setRequired(true)
      .setStyle(TextInputStyle.Paragraph);

    const panelTitleActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(panelTitleTextInput);
    const panelDescriptionActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(panelDescriptionTextInput);
    const ticketDescriptionActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(ticketDescriptionTextInput);
    ticketPanelModal.addComponents(panelTitleActionRow, panelDescriptionActionRow, ticketDescriptionActionRow);

    await this.interaction.showModal(ticketPanelModal);

    const filter = (i: ModalSubmitInteraction) => i.customId === this.interaction.id;
    const modalSubmitInteraction = await this.interaction.awaitModalSubmit({ filter, time: 5 * 60 * 1000 }).catch(() => { });

    if (!modalSubmitInteraction) {
      return;
    }

    new TicketPanelModalHandler(modalSubmitInteraction, name, category.id, moderatorRole.id).handle();
  }

  private async postTicketPanel() {
    const name = this.interaction.options.getString('name', true);
    const channel = this.interaction.options.getChannel('channel', true, [ChannelType.GuildText]);

    const ticketPanel = await database.ticketPanel.findUnique({ where: { name_guildID: { name: name, guildID: this.guild.id } } });

    if (!ticketPanel) {
      return this.handleError('Error fetching ticket panel from TICKET_PANEL table!', true, 'ticket-panel.js');
    }

    const ticketPanelEmbed = JSON.parse(ticketPanel.panelEmbedJSON);

    const createTicketButton = new ButtonBuilder()
      .setCustomId(`ticket:create:${name}`)
      .setLabel('Create Ticket')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary);
    const createButtonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(createTicketButton);

    const posted = await channel.send({ embeds: [ticketPanelEmbed], components: [createButtonActionRow] }).catch(() => { });

    if (!posted) {
      return this.handleError('Failed to post ticket panel to channel!', true, 'ticket-panel.js');
    }

    const postedPanelMessageIDs = JSON.parse(ticketPanel.postedPanelMessageIDs) as Array<{ channelID: string, messageID: string; }>;
    postedPanelMessageIDs.push({ channelID: channel.id, messageID: posted.id });
    const updatedPanelMessageIDs = JSON.stringify(postedPanelMessageIDs);

    await database.ticketPanel.update({
      where: { timeCreated: ticketPanel.timeCreated },
      data: { postedPanelMessageIDs: updatedPanelMessageIDs }
    });

    await this.interaction.reply({ content: `✅ Ticket panel "${name}" posted in ${channel} successfully.` });
  }

  private async deleteTicketPanel() {
    const name = this.interaction.options.getString('name', true);

    const ticketPanel = await database.ticketPanel.findUnique({ where: { name_guildID: { name: name, guildID: this.guild.id } } });

    if (!ticketPanel) {
      return this.handleError('Error fetching ticket panel from TICKET_PANEL table!', true, 'ticket-panel.js');
    }

    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`You're About To Delete '${ticketPanel.name}'`)
      .setDescription(stripIndents`
      Doing so will also delete all posted ticket panels, are you sure you want to continue?
      -# All tickets created will remain functional until deleted.`)
      .setColor(EmbedColours.Info);

    const confirmationButtons = new ActionRowBuilder<ButtonBuilder>()
      .setComponents(
        new ButtonBuilder()
          .setCustomId('yes')
          .setLabel(`Delete '${ticketPanel.name}'`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('no')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    const message = await this.interaction.reply({ embeds: [embed], components: [confirmationButtons] });
    const filter = (i: ButtonInteraction) => i.user.id === this.interaction.user.id;

    const confirmation = await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 30_000 }).catch(() => { });

    embed
      .setTitle('Deletion Cancelled')
      .setDescription('No input detected after 30 seconds, deletion has been cancelled.')
      .setColor(EmbedColours.Negative);
    if (!confirmation) return this.interaction.editReply({ embeds: [embed], components: [] });

    embed
      .setDescription('Deletion has been cancelled.')
      .setColor(EmbedColours.Neutral);
    if (confirmation.customId === 'no') return this.interaction.editReply({ embeds: [embed], components: [] });

    await database.ticketPanel.delete({
      where: { timeCreated: ticketPanel.timeCreated }
    });

    const postedPanelMessageIDs = JSON.parse(ticketPanel.postedPanelMessageIDs) as Array<{ channelID: string, messageID: string; }>;
    for await (const panel of postedPanelMessageIDs) {
      const channel = await this.guild.channels.fetch(panel.channelID);
      if (!channel || channel instanceof CategoryChannel || channel instanceof ForumChannel || channel instanceof MediaChannel) continue;

      const message = await channel.messages.fetch(panel.messageID);
      if (message && message.deletable) await message.delete();
    }

    embed
      .setTitle(`'${ticketPanel.name}' Deleted Successfully`)
      .setDescription(stripIndents`
      All posted ticket panels have been deleted and no new tickets can be created.
      Any remaining tickets will continue to function until deleted.`)
      .setColor(EmbedColours.Positive);
    await this.interaction.editReply({ embeds: [embed], components: [] });
  }
}
