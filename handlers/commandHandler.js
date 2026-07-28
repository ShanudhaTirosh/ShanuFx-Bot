/**
 * handlers/commandHandler.js
 * Recursively loads all command modules from commands/** and registers
 * them in client.commands (Collection keyed by command name).
 */

const fs   = require('fs');
const path = require('path');

/**
 * @param {import('discord.js').Client} client
 */
function loadCommands(client) {
  const commandsPath = path.join(__dirname, '..', 'commands');

  if (!fs.existsSync(commandsPath)) {
    console.warn('[Commands] commands/ directory not found — skipping');
    return;
  }

  const categories = fs.readdirSync(commandsPath);
  let loaded = 0;

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const filePath = path.join(categoryPath, file);

      try {
        // Clear require cache in dev so hot-reload works
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
          command.category = category;
          client.commands.set(command.data.name, command);
          loaded++;
          console.log(`[Commands] ✔ Loaded /${command.data.name} (${category}/${file})`);
        } else {
          console.warn(`[Commands] ⚠ Skipped ${category}/${file} — missing "data" or "execute" export`);
        }
      } catch (err) {
        console.error(`[Commands] ✖ Error loading ${category}/${file}:`, err);
      }
    }
  }

  console.log(`[Commands] ${loaded} command(s) registered\n`);
}

module.exports = { loadCommands };
