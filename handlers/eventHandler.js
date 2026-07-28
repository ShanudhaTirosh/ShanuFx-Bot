/**
 * handlers/eventHandler.js
 * Loads all event modules from events/ and registers them on the Discord client.
 */

const fs   = require('fs');
const path = require('path');

/**
 * @param {import('discord.js').Client} client
 */
function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');

  if (!fs.existsSync(eventsPath)) {
    console.warn('[Events] events/ directory not found — skipping');
    return;
  }

  const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  let loaded = 0;

  for (const file of files) {
    const filePath = path.join(eventsPath, file);

    try {
      delete require.cache[require.resolve(filePath)];
      const event = require(filePath);

      if (!event.name || typeof event.execute !== 'function') {
        console.warn(`[Events] ⚠ Skipped ${file} — missing "name" or "execute" export`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }

      loaded++;
      console.log(`[Events]  ✔ Registered "${event.name}" (once=${!!event.once}) from ${file}`);
    } catch (err) {
      console.error(`[Events]  ✖ Error loading ${file}:`, err);
    }
  }

  console.log(`[Events]  ${loaded} event(s) registered\n`);
}

module.exports = { loadEvents };
