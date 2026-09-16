/**
 * music/nowPlayingEmbed.js
 *
 * Single source of truth for what a "now playing" message looks like, so
 * /nowplaying and the automatic trackStart announcement never drift apart
 * the way they used to (trackStart was a bare text line with no embed,
 * thumbnail, or controls, while /nowplaying had all of that).
 *
 * Also tracks the most recent now-playing message per guild so its
 * buttons can be disabled once it stops being current (new track starts,
 * queue ends, or the player is destroyed) instead of staying clickable
 * forever and acting on whatever happens to be playing later.
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { formatDuration } = require('./format');

/** guildId -> { channelId, messageId } for the most recent controls message */
const activeMessages = new Map();

function getPlatformInfo(uri) {
  if (!uri) return { emoji: '🎵', name: 'Music', color: 0x5865F2 };
  if (uri.includes('spotify.com')) return { emoji: '🟢', name: 'Spotify', color: 0x1DB954 };
  if (uri.includes('youtube.com') || uri.includes('youtu.be')) return { emoji: '🔴', name: 'YouTube', color: 0xFF0000 };
  if (uri.includes('soundcloud.com')) return { emoji: '🟠', name: 'SoundCloud', color: 0xFF5500 };
  return { emoji: '🎵', name: 'Music', color: 0x5865F2 };
}

function buildProgressBar(position, duration, size = 20) {
  if (!duration || duration <= 0) return '▬'.repeat(size);
  const filled = Math.round((position / duration) * size);
  return '▬'.repeat(Math.max(0, filled - 1)) + '🔘' + '▬'.repeat(Math.max(0, size - filled));
}

/**
 * @param {import('discord.js').Client} client
 * @param {import('lavalink-client').Player} player
 * @param {any} track
 */
function buildTrackEmbed(client, player, track) {
  const position = player.position ?? 0;
  const duration = track.info.duration;
  const bar = buildProgressBar(position, duration);
  const platform = getPlatformInfo(track.info.uri);
  const statusIcon = player.paused ? '⏸️' : '▶️';
  const statusText = player.paused ? 'Paused' : 'Now Playing';

  const requesterName = track.requester?.tag ?? track.requester?.username ?? 'Unknown';
  const requesterAvatar = typeof track.requester?.displayAvatarURL === 'function'
    ? track.requester.displayAvatarURL()
    : undefined;

  return new EmbedBuilder()
    .setColor(platform.color)
    .setAuthor({ name: `${statusIcon} ${statusText}`, iconURL: requesterAvatar })
    .setTitle(track.info.title)
    .setURL(track.info.uri || null)
    .setDescription(`**${track.info.author || 'Unknown Artist'}**\n\n${platform.emoji} **Platform:** ${platform.name}`)
    .setThumbnail(track.info.artworkUrl ?? null)
    .addFields({
      name: '⏱️ Progress',
      value: track.info.isStream
        ? `${bar}\n🔴 **LIVE STREAM**`
        : `${bar}\n\`${formatDuration(position)}\` ━━━━ \`${formatDuration(duration)}\``,
      inline: false,
    })
    .addFields(
      { name: '🎧 Requested by', value: requesterName, inline: true },
      { name: '📊 Queue', value: `${player.queue.tracks.length} track(s)`, inline: true },
      { name: '🔊 Volume', value: `${player.volume}%`, inline: true },
    )
    .setFooter({ text: `Loop: ${player.repeatMode === 'queue' ? 'Queue' : player.repeatMode === 'track' ? 'Track' : 'Off'}`, iconURL: client.user.displayAvatarURL() })
    .setTimestamp();
}

/**
 * @param {import('lavalink-client').Player} player
 */
function buildControlsRow(player) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_toggle')
      .setEmoji(player.paused ? '▶️' : '⏸️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('music_skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('music_shuffle')
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(player.queue.tracks.length < 2),
    new ButtonBuilder()
      .setCustomId('music_loop')
      .setEmoji(player.repeatMode === 'queue' ? '🔁' : player.repeatMode === 'track' ? '🔂' : '➡️')
      .setStyle(player.repeatMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success),
  );
}

/** Disabled copy of the controls row, used once a message stops being current. */
function buildDisabledControlsRow(player) {
  return buildControlsRow(player).setComponents(
    buildControlsRow(player).components.map(b => ButtonBuilder.from(b).setDisabled(true)),
  );
}

function trackActiveMessage(guildId, message) {
  activeMessages.set(guildId, { channelId: message.channelId, messageId: message.id });
}

/**
 * Disables the buttons on the last-tracked now-playing message for a guild,
 * if it still exists. Safe to call even if there is none.
 * @param {import('discord.js').Client} client
 */
async function disableActiveControls(client, guildId, player) {
  const ref = activeMessages.get(guildId);
  if (!ref) return;
  activeMessages.delete(guildId);

  try {
    const channel = client.channels.cache.get(ref.channelId);
    if (!channel?.isTextBased()) return;
    const message = await channel.messages.fetch(ref.messageId).catch(() => null);
    if (!message || !message.editable) return;

    const row = player
      ? buildDisabledControlsRow(player)
      : new ActionRowBuilder().addComponents(
          ...(message.components[0]?.components ?? []).map(c => ButtonBuilder.from(c).setDisabled(true)),
        );

    await message.edit({ components: [row] }).catch(() => {});
  } catch {
    // Best-effort — an old message failing to edit shouldn't break playback.
  }
}

module.exports = {
  getPlatformInfo,
  buildProgressBar,
  buildTrackEmbed,
  buildControlsRow,
  buildDisabledControlsRow,
  trackActiveMessage,
  disableActiveControls,
};
