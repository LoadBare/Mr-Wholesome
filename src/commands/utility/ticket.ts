import { ChatInputCommandInteraction, PermissionOverwriteOptions, TextChannel, User } from "discord.js";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { database } from "../../lib/config.js";
import { CommandHandler } from "../command.js";

export class TicketCommandHandler extends CommandHandler {
  user: User;

  constructor(interaction: ChatInputCommandInteraction) {
    super(interaction);
    this.user = interaction.options.getUser('user', true);
  }

  async handle() {
    const subcommand = this.interaction.options.getSubcommand(true);

    if (subcommand === 'add_user') await this.addUser();
    else if (subcommand === 'remove_user') await this.removeUser();
  }

  private async addUser() {
    await this.interaction.deferReply({ ephemeral: true });
    const ticket = await database
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.channelID, this.interaction.channel!.id))
      .get();

    if (!ticket) {
      return this.handleError('You are not in a ticket channel.');
    }

    const channel = this.interaction.channel as TextChannel; // All ticket channels are text channels so this is safe

    const addedUsers = ticket.addedUsers;

    if (addedUsers.includes(this.user.id)) {
      return this.handleError('This user is already added to this ticket.');
    }

    addedUsers.push(this.user.id);

    const [ticketUpdated] = await database
      .update(schema.tickets)
      .set({ addedUsers })
      .where(eq(schema.tickets.channelID, channel.id))
      .returning()
      .catch(() => []);

    if (!ticketUpdated) {
      return this.handleError('Failed to update ticket in TICKET table.', true, 'ticket.js');
    }

    const permissionOverwrites: PermissionOverwriteOptions = {
      AttachFiles: true,
      SendMessages: true,
      ReadMessageHistory: true,
      ViewChannel: true
    };
    await channel.permissionOverwrites.create(this.user.id, permissionOverwrites);

    await this.interaction.editReply({ content: `"${this.user.username}" added to the ticket` });
  }

  private async removeUser() {
    await this.interaction.deferReply({ ephemeral: true });
    const ticket = await database
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.channelID, this.interaction.channel!.id))
      .get();

    if (!ticket) {
      return this.handleError('You are not in a ticket channel.');
    }

    const channel = this.interaction.channel as TextChannel; // All ticket channels are text channels so this is safe

    const addedUsers = ticket.addedUsers;
    if (!addedUsers.includes(this.user.id)) {
      return this.handleError('This user is not added to this ticket.');
    }

    addedUsers.splice(addedUsers.indexOf(this.user.id), 1);

    const [ticketUpdated] = await database
      .update(schema.tickets)
      .set({ addedUsers })
      .where(eq(schema.tickets.channelID, channel.id))
      .returning()
      .catch(() => []);

    if (!ticketUpdated) {
      return this.handleError('Failed to update ticket in TICKET table.', true, 'ticket.js');
    }

    const permissionOverwrites = channel.permissionOverwrites.resolve(this.user.id);
    if (permissionOverwrites) await permissionOverwrites.delete();
    await this.interaction.editReply({ content: `"${this.user.username}" removed from the ticket` });
  }
}
