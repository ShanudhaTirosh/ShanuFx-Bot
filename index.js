require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents }   = require('./handlers/eventHandler');
const { validateEnv, redact } = require('./utils/validateEnv');
const { createLavalinkManager } = require('./music/lavalinkManager');
const { startInternalControlServer } = require('./internal/controlServer');

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

// ─── Internal control API (dashboard music control bridge) ───────────────────
// See internal/controlServer.js — no-ops (and logs a warning) if
// INTERNAL_API_SECRET isn't set, so this is safe to always call.
//
// Only disabled for genuine multi-shard deployments (client.shard.count > 1):
// shard.js spawns index.js once per shard as separate processes, which
// would (a) all fight over the same port and (b) each only see the subset
// of guilds assigned to that shard — dashboard music control would
// silently work for some servers and not others depending on which shard
// they landed on. A single shard under ShardingManager (which is how
// docker-compose.yml runs the bot even for small servers) behaves
// identically to running unsharded — client.guilds.cache still has every
// guild — so that case is fine to allow.
if (client.shard && client.shard.count > 1) {
  console.warn(`[Internal API] Running with ${client.shard.count} shards — dashboard music control is disabled (only supported for a single shard).`);
} else {
  startInternalControlServer(client);
}

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
