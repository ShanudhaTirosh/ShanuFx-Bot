const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getActivePlayer } = require('../../music/voiceChecks');
const { formatDuration } = require('../../music/lavalinkManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show what\'s currently playing')
    .setDMPermission(false),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    const track = player?.queue?.current;
    if (!player || !track) {
      return interaction.reply({ embeds: [err('Nothing is playing right now.')], ephemeral: true });
    }

    const position = player.position ?? 0;
    const duration = track.info.duration;
    const bar = buildProgressBar(position, duration);
    
    // Platform detection
    const getPlatformInfo = (uri) => {
      if (!uri) return { emoji: '🎵', name: 'Music', color: 0x5865F2 };
      if (uri.includes('spotify.com')) return { emoji: '🟢', name: 'Spotify', color: 0x1DB954 };
      if (uri.includes('youtube.com') || uri.includes('youtu.be')) return { emoji: '🔴', name: 'YouTube', color: 0xFF0000 };
      if (uri.includes('soundcloud.com')) return { emoji: '🟠', name: 'SoundCloud', color: 0xFF5500 };
      return { emoji: '🎵', name: 'Music', color: 0x5865F2 };
    };
    
    const platform = getPlatformInfo(track.info.uri);
    const statusIcon = player.paused ? '⏸️' : '▶️';
    const statusText = player.paused ? 'Paused' : 'Now Playing';

    const embed = new EmbedBuilder()
      .setColor(platform.color)
      .setAuthor({ name: `${statusIcon} ${statusText}`, iconURL: interaction.user.displayAvatarURL() })
      .setTitle(track.info.title)
      .setURL(track.info.uri || 'https://discord.com')
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
        { name: '🎧 Requested by', value: track.requester?.tag ?? track.requester?.username ?? 'Unknown', inline: true },
        { name: '📊 Queue', value: `${player.queue.tracks.length} track(s)`, inline: true },
        { name: '🔊 Volume', value: `${player.volume}%`, inline: true },
      )
      .setFooter({ text: `Loop: ${player.queueRepeat ? 'Queue' : player.trackRepeat ? 'Track' : 'Off'}`, iconURL: interaction.client.user.displayAvatarURL() })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};

function buildProgressBar(position, duration, size = 20) {
  if (!duration || duration <= 0) return '▬'.repeat(size);
  const filled = Math.round((position / duration) * size);
  return '▬'.repeat(Math.max(0, filled - 1)) + '🔘' + '▬'.repeat(Math.max(0, size - filled));
}

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
