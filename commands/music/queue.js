const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getActivePlayer } = require('../../music/voiceChecks');
const { formatDuration } = require('../../music/lavalinkManager');

const PAGE_SIZE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue')
    .setDMPermission(false),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
      return interaction.reply({ embeds: [err('The queue is empty.')], ephemeral: true });
    }

    const totalPages = Math.max(1, Math.ceil(player.queue.tracks.length / PAGE_SIZE));
    await interaction.reply({
      embeds: [buildPageEmbed(player, 0, totalPages)],
      components: totalPages > 1 ? [buildRow(0, totalPages)] : [],
    });

    if (totalPages <= 1) return;

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ time: 2 * 60 * 1000 });

    let page = 0;
    collector.on('collect', async i => {
      if (i.customId === 'queue_prev') page = Math.max(0, page - 1);
      if (i.customId === 'queue_next') page = Math.min(totalPages - 1, page + 1);
      await i.update({ embeds: [buildPageEmbed(player, page, totalPages)], components: [buildRow(page, totalPages)] });
    });

    collector.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
  },
};

function buildPageEmbed(player, page, totalPages) {
  const items = player.queue.tracks.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const lines = items.map((t, i) => {
    const pos = page * PAGE_SIZE + i + 1;
    const duration = t.info.isStream ? '🔴 LIVE' : formatDuration(t.info.duration);
    return `\`${String(pos).padStart(2, '0')}.\` [**${t.info.title}**](${t.info.uri})\n    └ ${t.info.author || 'Unknown'} • ${duration}`;
  });

  // Platform detection for color
  const currentTrack = player.queue.current;
  let color = 0x5865F2;
  if (currentTrack?.info?.uri) {
    if (currentTrack.info.uri.includes('spotify.com')) color = 0x1DB954;
    else if (currentTrack.info.uri.includes('youtube.com')) color = 0xFF0000;
    else if (currentTrack.info.uri.includes('soundcloud.com')) color = 0xFF5500;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: '📜 Music Queue', iconURL: player.client.user.displayAvatarURL() });

  if (currentTrack) {
    const platform = currentTrack.info.uri?.includes('spotify.com') ? '🟢 Spotify' :
                     currentTrack.info.uri?.includes('youtube.com') ? '🔴 YouTube' :
                     currentTrack.info.uri?.includes('soundcloud.com') ? '🟠 SoundCloud' : '🎵 Music';
    const duration = currentTrack.info.isStream ? '🔴 LIVE' : formatDuration(currentTrack.info.duration);
    
    embed.addFields({
      name: '▶️ Now Playing',
      value: `[**${currentTrack.info.title}**](${currentTrack.info.uri})\n┌ ${currentTrack.info.author || 'Unknown Artist'}\n├ ${platform}\n└ ${duration}`,
      inline: false,
    });
  }

  if (lines.length > 0) {
    embed.addFields({
      name: '📝 Up Next',
      value: lines.join('\n\n'),
      inline: false,
    });
  } else {
    embed.setDescription('*No more tracks in queue*');
  }

  const totalMs = player.queue.utils.totalDuration();
  const loopIcon = player.repeatMode === 'queue' ? '🔁' : player.repeatMode === 'track' ? '🔂' : '';
  const loopText = player.repeatMode !== 'off' ? ` • ${loopIcon} Loop: ${player.repeatMode}` : '';
  
  embed.setFooter({
    text: `${player.queue.tracks.length} track(s) • ${formatDuration(totalMs)} total${loopText} • Page ${page + 1}/${totalPages}`,
    iconURL: player.client.user.displayAvatarURL(),
  })
  .setTimestamp();

  return embed;
}

function buildRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('queue_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId('queue_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1),
  );
}

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
