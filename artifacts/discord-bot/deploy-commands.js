/**
 * deploy-commands.js — Slash Command Deployer
 *
 * Guild deploy  (fast, instant):  node deploy-commands.js guild <GUILD_ID>
 * Global deploy (up to 1hr):      node deploy-commands.js global
 */

require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
const { validateEnv, redact } = require('./utils/validateEnv');

validateEnv(['TOKEN', 'CLIENT_ID'], { label: 'Deploy' });

// ─── Collect all command data ─────────────────────────────────────────────────
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const categories = fs.readdirSync(commandsPath);

for (const category of categories) {
  const categoryPath = path.join(commandsPath, category);
  if (!fs.statSync(categoryPath).isDirectory()) continue;

  const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const command = require(path.join(categoryPath, file));
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      console.log(`[Deploy] Queued: /${command.data.name}`);
    } else {
      console.warn(`[Deploy] Skipped ${file} — missing data or execute export`);
    }
  }
}

// ─── REST client ─────────────────────────────────────────────────────────────
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// ─── Determine mode ───────────────────────────────────────────────────────────
const deployMode = process.argv[2]; // 'guild' | 'global'
const guildId = process.argv[3]; // Required for guild mode

(async () => {
  try {
    console.log(`\n[Deploy] Registering ${commands.length} slash command(s) in ${deployMode ?? 'global'} mode...\n`);

    if (deployMode === 'guild') {
      if (!guildId) {
        console.error('[Deploy] Guild ID required.\n  Usage: node deploy-commands.js guild <GUILD_ID>');
        process.exit(1);
      }
      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands },
      );
      console.log(`[Deploy] ✅ Successfully registered ${data.length} command(s) to guild ${guildId} (instant)`);

    } else {
      // Default: global deploy
      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log(`[Deploy] ✅ Successfully registered ${data.length} global command(s) (may take up to 1 hour to propagate)`);
    }
  } catch (err) {
    console.error('[Deploy] ❌ Deployment failed:', redact(err?.message ?? String(err)));
    process.exit(1);
  }
})();