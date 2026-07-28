/**
 * events/voiceStateUpdate.js
 * Fires on any voice state change in any guild. Used here purely for the
 * music feature: when the bot ends up alone in its voice channel, start
 * (or keep) an idle-disconnect timer; when someone rejoins, cancel it.
 */

const { onAlone, onActivityResumed } = require('../music/idleTimers');

module.exports = {
  name: 'voiceStateUpdate',
  once: false,

  /**
   * @param {import('discord.js').VoiceState} oldState
   * @param {import('discord.js').VoiceState} newState
   */
  async execute(oldState, newState) {
    const client = newState.client ?? oldState.client;
    const guildId = newState.guild?.id ?? oldState.guild?.id;
    if (!guildId) return;

    const player = client.lavalink?.getPlayer(guildId);
    if (!player || !player.voiceChannelId) return;

    const voiceChannel = newState.guild.channels.cache.get(player.voiceChannelId);
    if (!voiceChannel) return;

    const humanMembers = voiceChannel.members.filter(m => !m.user.bot);

    if (humanMembers.size === 0) {
      onAlone(player);
    } else {
      onActivityResumed(guildId);
    }
  },
};
