import { PrismaClient } from '@prisma/client';
import { ButtonInteraction, ChatInputCommandInteraction, ColorResolvable, Colors, EmbedBuilder, escapeMarkdown, Guild, ModalSubmitInteraction, TextChannel } from 'discord.js';
import { client } from '../index.js';
import { styleLog } from './utilities.js';

export const database = new PrismaClient();
export const xpCooldownCache: { [userID: string]: number; } = {};
export const akialytesGuild = await client.guilds.fetch(process.env.AKIALYTES_GUILD_ID ?? '');
export const EmbedColours = {
  Positive: Colors.Green,
  Neutral: Colors.Aqua,
  Negative: Colors.Red,
  Info: Colors.Purple,
};
export const baseEmbed = new EmbedBuilder().setColor(EmbedColours.Neutral).toJSON();
export const Emotes = {
  Bonque: process.env.BONQUE ?? '🔨',
  Arson: process.env.ARSON ?? '🔥',
  Added: process.env.ADDED ?? '➕',
  Removed: process.env.REMOVED ?? '➖',
  Ghost: process.env.GHOST ?? '👻',
  Bird: process.env.BIRD ?? '🐦',
  Chart: process.env.CHART ?? '📊',
  Loading: process.env.LOADING ?? '⏳'
};
export const Images = {
  WatchedUser: 'https://cdn.discordapp.com/attachments/1297278175046533247/1298572168338083930/ic_fluent_person_note_24_filled.png?ex=671a0d13&is=6718bb93&hm=b494bb3f608a08225c554c78b37fe61e37fe3e116f90814ed29c7c3067f900f5&'
};
export const UserIDs = {
  Bot: process.env.BOT_ID ?? '',
  Akialyne: process.env.AKIALYNE_USER_ID ?? '',
};
export const ChannelIDs = {
  Birthday: process.env.BIRTHDAY_CHANNEL_ID ?? '',
  Memes: process.env.MEMES_CHANNEL_ID ?? '',
  ComfyVibes: process.env.COMFY_VIBES_CHANNEL_ID ?? '',
  BotSpam: process.env.BOT_SPAM_CHANNEL_ID ?? '',
  ModerationLogs: process.env.MODERATION_LOGS_CHANNEL_ID ?? '',
  LevelUp: process.env.LEVEL_UP_CHANNEL_ID ?? '',
  IRLStuff: process.env.IRL_STUFF_CHANNEL_ID ?? '',
  AnonymousFeedback: process.env.ANONYMOUS_FEEDBACK_CHANNEL_ID ?? ''
};
export const RoleIDs = {
  Akialyte: process.env.AKIALYTE_ROLE_ID ?? '',
  Birthday: process.env.BIRTHDAY_ROLE_ID ?? '',
};
export const GuildIDs = {
  BotTesting: process.env.BOT_TESTING_GUILD_ID ?? '',
  Akialytes: process.env.AKIALYTES_GUILD_ID ?? '',
};
export function escapeAllFormatting(text: string | null) {
  return escapeMarkdown(text ?? '', { bulletedList: true, heading: true, maskedLink: true, numberedList: true });
}
export class EventHandler {
  get logChannel() {
    return client.channels.resolve(process.env.MODERATION_LOGS_CHANNEL_ID ?? '') as TextChannel;
  }
}
export abstract class BaseInteractionHandler {
  private baseInteraction: ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction;
  protected guild: Guild;

  constructor(interaction: ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction) {
    this.baseInteraction = interaction;
    this.guild = interaction.guild!;
  }

  protected abstract handle(): Promise<void>;

  protected simpleEmbed(description: string, colour: ColorResolvable = EmbedColours.Info) {
    return new EmbedBuilder().setDescription(description).setColor(colour);
  }

  protected async userInGuild(userID: string) {
    const member = await this.guild.members.fetch(userID).catch(() => null);
    return member;
  }

  protected async handleError(error: string, log: boolean = false, filename?: string) {
    if (log && !filename) {
      throw new Error("Filename must be provided if logging is enabled");
    }

    const options = { embeds: [this.simpleEmbed(`❌ ${error}`, EmbedColours.Negative)] };

    if (this.baseInteraction.replied || this.baseInteraction.deferred) {
      await this.baseInteraction.editReply(options);
    } else {
      await this.baseInteraction.reply(options);
    }

    if (log && filename) {
      styleLog(error, false, filename);
    }
  }

}
