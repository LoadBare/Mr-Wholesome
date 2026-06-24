import { stripIndents } from "common-tags";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import { baseEmbed, database } from "../../lib/config.js";
import { ButtonHandler } from "../button-handler.js";

export class ToggleLevelNotifButtonHandler extends ButtonHandler {
  private levelNotifs: boolean;

  constructor(interaction: ButtonInteraction, levelNotifs: boolean) {
    super(interaction);
    this.levelNotifs = levelNotifs;
  }

  async handle() {
    await this.interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const userID = this.interaction.user.id;
    const successfulUpdate = await database.rank.upsert({
      create: { guildID: this.guild.id, userID, levelNotifs: this.levelNotifs },
      update: { levelNotifs: !this.levelNotifs },
      where: { userID_guildID: { guildID: this.guild.id, userID } }
    }).catch(() => false).then(() => true);

    if (!successfulUpdate) {
      return this.handleError('Error updating level notification stat in RANK table!', true, 'toggle-level-notifs.js');
    }

    const displayName = this.interaction.user.displayName;
    const embed = new EmbedBuilder(baseEmbed)
      .setTitle(`${displayName}'s Level Notifications`)
      .setDescription(stripIndents
        `✅ Successfully ${!this.levelNotifs ? 'enabled' : 'disabled'} level up ping!
        You will ${this.levelNotifs ? 'no longer' : 'now'} be pinged when you level up.`
      );

    await this.disableButtonReusability(this.levelNotifs);

    await this.interaction.editReply({ embeds: [embed] });
  }

  private async disableButtonReusability(levelNotifState: boolean) {
    const label = levelNotifState ? 'Disable Ping' : 'Enable Ping';
    const button = new ActionRowBuilder<ButtonBuilder>()
      .setComponents(
        new ButtonBuilder()
          .setCustomId(this.interaction.customId)
          .setLabel(label)
          .setStyle(this.interaction.component.style)
          .setDisabled(true)
      );

    await this.interaction.message.edit({ components: [button] });
  }
}
