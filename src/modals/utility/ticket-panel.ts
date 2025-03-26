import { stripIndents } from "common-tags";
import { chatInputApplicationCommandMention, Colors, EmbedBuilder, ModalSubmitInteraction } from "discord.js";
import { baseEmbed, database } from "../../lib/config.js";
import { ModalHandler } from "../handler.js";

export class TicketPanelModalHandler extends ModalHandler {
  private title: string;
  private description: string;
  private ticketDesription: string;
  private panelName: string;
  private categoryID: string;
  private moderatorRoleID: string;

  constructor(interaction: ModalSubmitInteraction, panelName: string, categoryID: string, moderatorRoleID: string) {
    super(interaction);
    this.title = interaction.fields.getTextInputValue('title') || 'Support Tickets';
    this.description = interaction.fields.getTextInputValue('description') || 'Need help? Create a ticket using the button below!';
    this.ticketDesription = interaction.fields.getTextInputValue('ticket-description') || 'Welcome! Please describe your issue below.';
    this.panelName = panelName;
    this.categoryID = categoryID;
    this.moderatorRoleID = moderatorRoleID;
  }

  async handle() {
    const panelEmbed = new EmbedBuilder(baseEmbed)
      .setTitle(this.title)
      .setDescription(this.description)
      .setColor(Colors.Blue);
    const panelEmbedJSON = JSON.stringify(panelEmbed);

    const ticketEmbed = new EmbedBuilder(baseEmbed)
      .setDescription(this.ticketDesription)
      .setColor(Colors.Blue);
    const ticketEmbedJSON = JSON.stringify(ticketEmbed);

    const guildID = this.guild.id;
    const timeCreated = Date.now().toString();
    await database.ticketPanel.create({
      data: {
        categoryID: this.categoryID,
        guildID,
        moderatorRoleID: this.moderatorRoleID,
        name: this.panelName,
        panelEmbedJSON,
        ticketEmbedJSON,
        timeCreated
      }
    });

    const content = stripIndents`✅ Ticket panel "${[this.panelName]}" created successfully.
    You can use ${chatInputApplicationCommandMention('ticket-panel', 'post', '1260499767906275369')} to post this panel in a channel.
    
    A preview of the panel and ticket are shown below:`;
    await this.interaction.reply({ content, embeds: [panelEmbed, ticketEmbed] });
  }
}
