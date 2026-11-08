import { ButtonInteraction } from "discord.js";
import { GuildBansPayload } from "../../commands/utility/view.js";
import { ButtonHandler } from "../button-handler.js";

export class bansButtonsHandler extends ButtonHandler {
    constructor(interaction: ButtonInteraction) {
        super(interaction);
    }

    async handle() {
        if (!this.interaction.memberPermissions?.has('BanMembers')) {
            await this.interaction.reply({ content: 'You need the Ban Members permission to browse bans.', ephemeral: true });
            return;
        }

        await this.interaction.deferUpdate();

        const [, page] = this.interaction.customId.split(':');
        const updatedPayload = await new GuildBansPayload(this.interaction, Number(page)).create();

        await this.interaction.message.edit(updatedPayload);
    }
}
