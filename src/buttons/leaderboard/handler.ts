import { ButtonInteraction } from "discord.js";
import { LeaderboardPayload } from "../../commands/ranking/leaderboard.js";
import { ButtonHandler } from "../button-handler.js";

export class leaderboardButtonsHandler extends ButtonHandler {
    constructor(interaction: ButtonInteraction) {
        super(interaction);
    }

    async handle() {
        await this.interaction.deferUpdate();

        const [, page] = this.interaction.customId.split(':');
        const updatedPayload = await new LeaderboardPayload(this.interaction, Number(page)).create();

        await this.interaction.message.edit(updatedPayload);
    }
}
