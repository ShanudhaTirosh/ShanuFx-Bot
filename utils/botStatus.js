/**
 * utils/botStatus.js
 *
 * Bot presence (status + activity) management. Since Discord.js clients
 * have a single global presence that applies across all guilds, this uses
 * a "primary guild" concept (the first guild in the bot's cache) to
 * determine which config's status settings to use.
 *
 * For bots serving a single server (private bots), this works perfectly.
 * For multi-server public bots, you'd typically set a fixed presence in
 * events/ready.js instead of pulling from guild configs.
 */

const { ActivityType } = require('discord.js');
const { getConfig } = require('../handlers/configHandler');

const ACTIVITY_TYPE_MAP = {
  playing: ActivityType.Playing,
  streaming: ActivityType.Streaming,
  listening: ActivityType.Listening,
  watching: ActivityType.Watching,
  competing: ActivityType.Competing,
};

/**
 * Updates the bot's global presence based on a guild's config.
 * @param {import('discord.js').Client} client
 * @param {string} guildId - Guild whose config to use
 */
function updateBotStatus(client, guildId) {
  try {
    const config = getConfig(guildId);
    const { statusType, activityType, activityText, activityUrl } = config.botStatus;

    const presence = {
      status: statusType || 'online',
      activities: [],
    };

    if (activityText) {
      const activity = {
        name: activityText,
        type: ACTIVITY_TYPE_MAP[activityType] ?? ActivityType.Playing,
      };

      // Streaming type requires a valid Twitch URL
      if (activityType === 'streaming' && activityUrl) {
        activity.url = activityUrl;
      }

      presence.activities.push(activity);
    }

    client.user.setPresence(presence);
    console.log(`[Status] Updated to: ${statusType} | ${activityType || 'none'}: ${activityText || 'none'}`);
  } catch (err) {
    console.error(`[Status] Failed to update bot status: ${err.message}`);
  }
}

/**
 * Sets up the default bot status based on the first guild in cache
 * (typically called from events/ready.js)
 * @param {import('discord.js').Client} client
 */
function setupDefaultStatus(client) {
  // For a private bot (single-guild), use that guild's config
  const firstGuild = client.guilds.cache.first();
  if (firstGuild) {
    updateBotStatus(client, firstGuild.id);
  } else {
    // Fallback if somehow no guilds are cached yet
    client.user.setPresence({
      status: 'online',
      activities: [{ name: 'Discord Management', type: ActivityType.Playing }],
    });
  }
}

module.exports = { updateBotStatus, setupDefaultStatus };
