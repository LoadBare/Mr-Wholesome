import { createHash } from 'crypto';
import {
  Attachment,
  Client,
  Collection,
  Message, TextChannel,
  inlineCode
} from 'discord.js';
import { database, guild } from './config';

/**
 * Logs a stylised message to the console.
 * @param message The message to log to the console
 * @param positive Whether the reason for logging is positive
 * @param payload Any additional payload to log to the console
 */
export function styleLog(message: string, positive: boolean, filename: string, ...payload: any) {
  console.log(`${positive ? '✔️ ' : '❌ '} [${filename}] — ${message}\n`, ...payload);
}

/**
 * Permanently stores attachments by sending them to the media channel.
 * @param attachments The Discord.JS Collection of attachments to store
 * @returns Array of objects containg each attachment's link, masked link and type
 */
export async function storeAttachments(attachments: Collection<string, Attachment>, client: Client) {
  const mediaStorageChannelID = process.env.MEDIA_STORAGE_CHANNEL_ID ?? '';
  const mediaChannel = await client.channels.fetch(mediaStorageChannelID) as TextChannel;
  const storedAttachments: Array<{ link: string, maskedLink: string, type: string; }> = [];
  const maxAttachmentSize = 15_000_000;

  const storedPromiseMessages: Array<Promise<undefined | Message>> = [];
  attachments.forEach((attachment) => {
    if (attachment !== undefined) {
      if (attachment.size >= maxAttachmentSize) {
        storedAttachments.push({
          link: '',
          maskedLink: `${inlineCode(attachment.name)} [No link, size >${Math.round(maxAttachmentSize / 1_000_000)}MB]`,
          type: attachment.contentType ?? '',
        });
      } else {
        storedPromiseMessages.push(mediaChannel.send({ files: [{ attachment: attachment.url }] }));
      }
    }
  });

  const storedMessages = await Promise.all(storedPromiseMessages);
  storedMessages.forEach((message) => {
    if (message !== undefined) {
      const storedAttachment = message.attachments.at(0);

      if (storedAttachment !== undefined) {
        storedAttachments.push({
          link: storedAttachment.url,
          maskedLink: `[${storedAttachment.name}](${storedAttachment.url})`,
          type: storedAttachment.contentType ?? 'N/A',
        });
      }
    }
  });

  return storedAttachments;
}

/**
 * Converts a date into a relative time string.
 * @param date The date to convert
 * @returns The relative time from the specified date
 */
export function getRelativeTimeString(date: Date | number) {
  // Allow dates or times to be passed
  const timeMs = typeof date === 'number' ? date : date.getTime();

  // Get the amount of seconds between the given date and now
  const deltaSeconds = Math.round((timeMs - Date.now()) / 1000);

  // Array reprsenting one minute, hour, day, week, month, etc in seconds
  const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity];

  // Array equivalent to the above but in the string representation of the units
  const units: Array<Intl.RelativeTimeFormatUnit> = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];

  // Grab the ideal cutoff unit
  const unitIndex = cutoffs.findIndex((cutoff) => cutoff > Math.abs(deltaSeconds));

  // Get the divisor to divide from the seconds. E.g. if our unit is "day" our divisor
  // is one day in seconds, so we can divide our seconds by this to get the # of days
  const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;

  // Intl.RelativeTimeFormat do its magic
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return rtf.format(Math.floor(deltaSeconds / divisor), units[unitIndex]);
}

/**
 * Allows for a synchronous delay in code execution if called with `await`.
 * @param ms The time, in milliseconds, to sleep
 * @returns Empty promise after specified delay has elapsed
 */
export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Finds the suffix of the specified number.
 * @param number The number to find the suffix for
 * @returns The number's suffix
 */
export function nth(number: number) {
  const suffixes: { [key in Intl.LDMLPluralRule]: string; } = {
    zero: 'th',
    one: 'st',
    two: 'nd',
    few: 'rd',
    many: 'th',
    other: 'th',
  };
  const suffixCategory = new Intl.PluralRules('en', { type: 'ordinal' }).select(number);

  return suffixes[suffixCategory];
}

export function getRandomIntegerFromSeed(seed: string, min: number, max: number): number {
  // Create a SHA-256 hash from the seed string
  const hash = createHash('sha256').update(seed).digest('hex');

  // Convert the hash to a number and map it to the desired range
  const hashNumber = parseInt(hash.slice(0, 8), 16);
  const range = max - min + 1;
  const randomNumber = (hashNumber % range) + min;

  return randomNumber;
}

export function formatDate(day: number, month: number) {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const formattedDay = `${day}${nth(day)}`;
  const formattedMonth = months.at(month) ?? 'N/A';

  return `${formattedDay} ${formattedMonth}`;
}

/**
 * Checks whether a channel has events ignored in the specified guild.
 * @param guildID The ID of the guild the channel is in
 * @param channelID The ID of the channel to check
 * @returns True if the channel has events ignored, or false otherwise
 */
export async function channelIgnoresEvents(guildID: string | null, channelID: string | null) {
  if (!guildID || !channelID) return true;

  const guildConfig = await database.guildConfig.findUnique({
    where: { guildID },
  }).catch(() => null);

  const eventIgnoredChannelIDs = guildConfig?.eventIgnoredChannelIDs.split(',') ?? [];
  return eventIgnoredChannelIDs.includes(channelID);
}