/**
 * events/guildDelete.js
 * Fires when the bot is removed from a guild (kicked, or the guild is deleted).
 * Handles: config cleanup and presence refresh.
 *
 * Warnings and mod-action history are intentionally kept (not deleted) —
 * if the bot is re-added later, that audit trail is still useful, and a
 * partial outage or accidental removal shouldn't wipe moderation history.
 */

const { ActivityType } = require('discord.js');
const { deleteConfig } = require('../handlers/configHandler');

module.exports = {
  name: 'guildDelete',
  once: false,

  /**
   * @param {import('discord.js').Guild} guild
   */
  execute(guild) {
    console.log(`[Guilds] ➖ Removed from "${guild.name}" (${guild.id}) — now in ${guild.client.guilds.cache.size} guild(s)`);

    deleteConfig(guild.id);

    guild.client.user.setPresence({
      activities: [
        {
          name: `${guild.client.guilds.cache.size} server(s) | /help`,
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });
  },
};
