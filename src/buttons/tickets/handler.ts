import { ButtonInteraction } from "discord.js";
import { ButtonHandler } from "../button-handler.js";
import { closeTicketButtonHandler } from "./close.js";
import { createTicketButtonHandler } from "./create.js";
import { deleteTicketButtonHandler } from "./delete.js";
import { openTicketButtonHandler } from "./open.js";

export class ticketButtonHandler extends ButtonHandler {
  constructor(interaction: ButtonInteraction) {
    super(interaction);
  }

  async handle() {
    const [, operation,] = this.interaction.customId.split(':');

    if (operation === 'create') new createTicketButtonHandler(this.interaction).handle();
    else if (operation === 'open') new openTicketButtonHandler(this.interaction).handle();
    else if (operation === 'close') new closeTicketButtonHandler(this.interaction).handle();
    else if (operation === 'delete') new deleteTicketButtonHandler(this.interaction).handle();
  }
}
