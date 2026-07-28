/**
 * events/ready.js
 * Fires once after the bot successfully logs in and is ready.
 */

const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,

  /**
   * @param {import('discord.js').Client} client
   */
  execute(client) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  ✅ Bot online: ${client.user.tag}`);
    console.log(`  📡 Guilds:     ${client.guilds.cache.size}`);
    console.log(`  👥 Users:      ${client.users.cache.size}`);
    console.log(`${'─'.repeat(50)}\n`);

    client.user.setPresence({
      activities: [
        {
          name: 'custom',
          state: '🛡️ Protecting shanudatirosh\'s server',
          type: ActivityType.Custom,
        },
      ],
      status: 'online',
    });

    if (client.lavalink && !client.lavalink.initiated) {
      client.lavalink.init({ id: client.user.id, username: client.user.username });
    }
  },
};
