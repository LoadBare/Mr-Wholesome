import { ActivityType, Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';

const { Guilds, GuildMembers, GuildMessages, MessageContent, GuildModeration } = GatewayIntentBits;

dotenv.config();

export const client = new Client({
  intents: [Guilds, GuildMembers, GuildMessages, MessageContent, GuildModeration],
  presence: {
    activities: [{
      name: 'over The Akialytes',
      type: ActivityType.Watching,
    }],
  },
  allowedMentions: {
    repliedUser: false,
    roles: []
  },
});

// Initalise event listeners
import('./listeners/index.js');

client.login(process.env.TOKEN)
  .catch((e) => console.error('An error occurred while logging in!', e));
