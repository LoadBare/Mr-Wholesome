import { stripIndents } from "common-tags";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, heading, italic, Message, ModalSubmitInteraction, User } from "discord.js";
import { baseEmbed, database, EmbedColours } from "../../lib/config.js";
import { ModalHandler } from "../handler.js";

export class WarningModalHandler extends ModalHandler {
  private reason: string;
  private targetUser: User;
  private notifyUser: boolean;

  constructor(interaction: ModalSubmitInteraction, targetUser: User, notifyUser: boolean) {
    super(interaction);
    this.reason = interaction.fields.getTextInputValue('reason') || 'No reason provided.';
    this.targetUser = targetUser;
    this.notifyUser = notifyUser;
  }

  async handle() {
    await this.interaction.deferReply();

    const confirmationEmbed = new EmbedBuilder(baseEmbed)
      .setTitle(`You're About To Warn ${this.targetUser.displayName}`)
      .setDescription(stripIndents`
          Doing so **${this.notifyUser ? 'will notify' : 'will not notify'}** them, if possible.
          
          # Reason
          ${this.reason}`);

    const confirmationButtons = new ActionRowBuilder<ButtonBuilder>()
      .setComponents(
        new ButtonBuilder()
          .setCustomId('yes')
          .setLabel(`Warn ${this.targetUser.displayName}`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('no')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    const message = await this.interaction.editReply({ embeds: [confirmationEmbed], components: [confirmationButtons] });

    const filter = (i: ButtonInteraction) => i.user.id === this.interaction.user.id;
    const confirmation = await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 60 * 1000 }).catch(() => { });

    if (!confirmation) {
      confirmationEmbed
        .setTitle('Warning Cancelled')
        .setDescription('No input detected after 60 seconds, warning has been cancelled.')
        .setColor(EmbedColours.Negative);

      this.interaction.editReply({ embeds: [confirmationEmbed], components: [] });
      return;
    }

    if (confirmation.customId === 'no') {
      confirmationEmbed
        .setDescription('Warning has been cancelled by user.')
        .setColor(EmbedColours.Neutral);

      this.interaction.editReply({ embeds: [confirmationEmbed], components: [] });
      return;
    }

    let notifiedMessage: Message<false> | boolean = false;
    if (this.notifyUser) {
      const content = [
        heading(`Warned in ${this.guild.name}`),
        this.reason
      ].join('\n');

      notifiedMessage = await this.messageUser(this.targetUser, content, 'Yellow');
    }

    const embedDescription = [
      `✅ ${this.targetUser.username} has been${notifiedMessage ? ' notified and' : ''} warned in the server.`,
    ];
    if (!notifiedMessage && this.notifyUser) embedDescription.push('', italic('⚠️ User has DMs disabled, unable to notify.'));

    const recorded = await this.addWarnToDatabase(this.targetUser);
    if (!recorded) embedDescription.push('', italic('⚠️ An error occurred whilst adding the warning to the database.'));

    const embed = new EmbedBuilder(baseEmbed)
      .setDescription(embedDescription.join('\n'));

    await this.interaction.editReply({ embeds: [embed], components: [] });
  }

  // == Database Methods ==
  private async addWarnToDatabase(user: User) {
    const authorID = this.interaction.user.id;
    const date = Date.now().toString();
    const guildID = this.guild.id;
    const warnedID = user.id;
    const reason = this.reason;

    const result = await database.warning.create({ data: { authorID, date, guildID, reason, warnedID } });
    return result ? true : false;
  }
}
