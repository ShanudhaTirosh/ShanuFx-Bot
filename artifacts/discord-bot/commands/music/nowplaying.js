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

    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setAuthor({ name: player.paused ? '⏸️ Paused' : '▶️ Now Playing' })
      .setTitle(track.info.title)
      .setURL(track.info.uri)
      .setThumbnail(track.info.artworkUrl ?? null)
      .addFields(
        { name: 'Author', value: track.info.author || 'Unknown', inline: true },
        { name: 'Requested by', value: track.requester?.tag ?? track.requester?.username ?? 'Unknown', inline: true },
        { name: 'Source', value: track.info.sourceName ?? 'unknown', inline: true },
        {
          name: '\u200b',
          value: track.info.isStream
            ? `${bar} 🔴 LIVE`
            : `${bar}\n${formatDuration(position)} / ${formatDuration(duration)}`,
        },
      );

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
