require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents }   = require('./handlers/eventHandler');
const { validateEnv, redact } = require('./utils/validateEnv');
const { createLavalinkManager } = require('./music/lavalinkManager');

// ─── Validate environment ─────────────────────────────────────────────────────
validateEnv(['TOKEN', 'CLIENT_ID'], { label: 'Boot' });

// ─── Client setup ─────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // Privileged — enable in Dev Portal
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,    // Privileged — enable in Dev Portal
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,  // Required for music — voice join/leave + alone-channel detection
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
    Partials.User,
  ],
});

// Commands collection — populated by commandHandler
client.commands = new Collection();

// ─── Music (Lavalink) ─────────────────────────────────────────────────────────
client.lavalink = createLavalinkManager(client);

// lavalink-client needs every raw gateway payload to catch VOICE_SERVER_UPDATE
// and VOICE_STATE_UPDATE frames itself (discord.js's parsed events don't carry
// everything it needs). client.lavalink.init() is called from events/ready.js
// once the bot has logged in.
client.on('raw', data => client.lavalink.sendRawData(data));

// ─── Load handlers ────────────────────────────────────────────────────────────
loadCommands(client);
loadEvents(client);

// ─── Global error guards ──────────────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('[Process] Unhandled rejection:', redact(err?.stack ?? String(err)));
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', redact(err?.stack ?? String(err)));
});

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(process.env.TOKEN).catch(err => {
  console.error('[Boot] Failed to log in:', redact(err?.message ?? String(err)));
  console.error('[Boot] Double-check TOKEN in your .env is correct and not expired/regenerated.');
  process.exit(1);
});
