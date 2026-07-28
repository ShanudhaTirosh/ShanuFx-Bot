/**
 * music/voiceChecks.js
 * Shared preconditions for music commands — keeps every command file from
 * re-implementing the same "are you even in a voice channel" checks.
 */

const { PermissionFlagsBits } = require('discord.js');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {{ ok: true, voiceChannel: import('discord.js').VoiceBasedChannel } | { ok: false, reason: string }}
 */
function requireVoiceChannel(interaction) {
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return { ok: false, reason: 'You need to be in a voice channel to use this command.' };
  }

  const perms = voiceChannel.permissionsFor(interaction.guild.members.me);
  if (!perms.has(PermissionFlagsBits.Connect)) {
    return { ok: false, reason: `I don't have permission to **join** ${voiceChannel}.` };
  }
  if (!perms.has(PermissionFlagsBits.Speak)) {
    return { ok: false, reason: `I don't have permission to **speak** in ${voiceChannel}.` };
  }

  return { ok: true, voiceChannel };
}

/**
 * For commands that act on an *existing* player (skip, pause, queue, etc.) —
 * requires the user to be in the same voice channel the bot is already in.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('lavalink-client').Player} player
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function requireSameVoiceChannel(interaction, player) {
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return { ok: false, reason: 'You need to be in my voice channel to use this command.' };
  }
  if (voiceChannel.id !== player.voiceChannelId) {
    return { ok: false, reason: `You need to be in <#${player.voiceChannelId}> to use this command.` };
  }
  return { ok: true };
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {import('lavalink-client').Player | null}
 */
function getActivePlayer(interaction) {
  return interaction.client.lavalink.getPlayer(interaction.guildId) ?? null;
}

module.exports = { requireVoiceChannel, requireSameVoiceChannel, getActivePlayer };
