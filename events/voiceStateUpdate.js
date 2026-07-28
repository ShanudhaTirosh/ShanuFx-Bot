/**
 * events/voiceStateUpdate.js
 * Fires on any voice state change in any guild. Used here for:
 * 1. Idle-disconnect when bot is alone in voice channel
 * 2. Auto-pause when bot is server muted
 * 3. Auto-resume when bot is unmuted
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

    // Check if this is the bot's voice state change
    const botId = client.user.id;
    const isBotStateChange = newState.id === botId || oldState.id === botId;

    // Handle bot being server muted/unmuted
    if (isBotStateChange) {
      const wasServerMuted = oldState.serverMute;
      const isServerMuted = newState.serverMute;

      // Bot was unmuted → muted
      if (!wasServerMuted && isServerMuted) {
        console.log(`[Music] Bot server muted in guild ${guildId}, pausing playback`);
        if (player.playing && !player.paused) {
          await player.pause();
          
          const channel = client.channels.cache.get(player.textChannelId);
          if (channel?.isTextBased()) {
            channel.send('⏸️ Paused - Bot was server muted').catch(() => {});
          }
        }
      }

      // Bot was muted → unmuted
      if (wasServerMuted && !isServerMuted) {
        console.log(`[Music] Bot server unmuted in guild ${guildId}, resuming playback`);
        if (!player.playing && player.paused) {
          await player.resume();
          
          const channel = client.channels.cache.get(player.textChannelId);
          if (channel?.isTextBased()) {
            channel.send('▶️ Resumed - Bot was unmuted').catch(() => {});
          }
        }
      }
    }

    // Handle idle disconnect when alone
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
