import { Events, Interaction } from 'discord.js';
import { ticketButtonHandler } from '../buttons/tickets/handler.js';
import { CatCommandHandler } from '../commands/fun/cat.js';
import { DogCommandHandler } from '../commands/fun/dog.js';
import { EightBallCommandHandler } from '../commands/fun/eight-ball.js';
import { FoxCommandHandler } from '../commands/fun/fox.js';
import { ReadingCommandHandler } from '../commands/fun/reading.js';
import { SnoCommandHandler } from '../commands/fun/sno.js';
import { WritingCommandHandler } from '../commands/fun/writing.js';
import { HelpCommandHandler } from '../commands/information/help.js';
import { PingCommandHandler } from '../commands/information/ping.js';
import { BanCommandHandler, ContextMenuBanCommandHandler } from '../commands/moderation/ban.js';
import { UnbanCommandHandler } from '../commands/moderation/unban.js';
import { UnwarnCommandHandler } from '../commands/moderation/unwarn.js';
import { WarnCommandHandler } from '../commands/moderation/warn.js';
import { WatchlistCommandHandler } from '../commands/moderation/watchlist.js';
import { LeaderboardCommandHandler } from '../commands/ranking/leaderboard.js';
import { RankCommandHandler } from '../commands/ranking/rank.js';
import { BirthdayCommandHandler } from '../commands/utility/birthday.js';
import { TicketPanelCommandHandler } from '../commands/utility/ticket-panel.js';
import { TicketCommandHandler } from '../commands/utility/ticket.js';
import { ViewCommandHandler } from '../commands/utility/view.js';
import { XPCommandHandler } from '../commands/utility/xp.js';
import { client } from '../index.js';
import { EventHandler } from '../lib/config.js';

class InteractionCreateHandler extends EventHandler {
  interaction: Interaction;

  constructor(interaction: Interaction) {
    super();
    this.interaction = interaction;
  }

  handle() {
    this.handleChatInputCommand();
    this.handleButton();
    this.handleUserContextMenu();
  }

  private async handleChatInputCommand() {
    if (!this.interaction.isChatInputCommand()) return;
    const chatInputInteraction = this.interaction;
    const cmd = chatInputInteraction.commandName;

    // Fun
    if (cmd === 'cat') new CatCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'dog') new DogCommandHandler(chatInputInteraction).handle();
    else if (cmd === '8ball') new EightBallCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'fox') new FoxCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'reading') new ReadingCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'sno') new SnoCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'writing') new WritingCommandHandler(chatInputInteraction).handle();

    // Information
    else if (cmd === 'help') new HelpCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'ping') new PingCommandHandler(chatInputInteraction).handle();

    // Moderation
    else if (cmd === 'ban') new BanCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'unban') new UnbanCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'warn') new WarnCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'unwarn') new UnwarnCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'watchlist') new WatchlistCommandHandler(chatInputInteraction).handle();

    // Ranking
    else if (cmd === 'leaderboard') new LeaderboardCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'rank') new RankCommandHandler(chatInputInteraction).handle();

    // Utility
    else if (cmd === 'birthday') new BirthdayCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'ticket-panel') new TicketPanelCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'ticket') new TicketCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'view') new ViewCommandHandler(chatInputInteraction).handle();
    else if (cmd === 'xp') new XPCommandHandler(chatInputInteraction).handle();

    // Unknown Command / Not Implemented
    else chatInputInteraction.reply({ content: 'This command hasn\'t been implemented yet, come back later (*・ω・)ﾉ', ephemeral: true });
  }

  private async handleButton() {
    if (!this.interaction.isButton()) return;
    const buttonInteraction = this.interaction;
    const customId = buttonInteraction.customId;

    if (customId.startsWith('ticket:')) new ticketButtonHandler(buttonInteraction).handle();
  }

  private async handleUserContextMenu() {
    if (!this.interaction.isUserContextMenuCommand()) return;
    const contextMenuInteraction = this.interaction;

    if (this.interaction.commandName === 'Ban User') new ContextMenuBanCommandHandler(contextMenuInteraction).handle();
  }
}

client.on(Events.InteractionCreate, (interaction) => {
  new InteractionCreateHandler(interaction).handle();
});
