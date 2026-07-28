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
    return `**${pos}.** [${t.info.title}](${t.info.uri}) — ${t.info.isStream ? 'LIVE' : formatDuration(t.info.duration)}`;
  });

  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🎶 Music Queue');

  if (player.queue.current) {
    embed.addFields({
      name: 'Now Playing',
      value: `[${player.queue.current.info.title}](${player.queue.current.info.uri}) — ${player.queue.current.info.isStream ? 'LIVE' : formatDuration(player.queue.current.info.duration)}`,
    });
  }

  embed.setDescription(lines.length ? lines.join('\n') : '*Nothing else queued.*');

  const totalMs = player.queue.utils.totalDuration();
  embed.setFooter({
    text: `${player.queue.tracks.length} track(s) queued — total ${formatDuration(totalMs)} — page ${page + 1} of ${totalPages}${player.repeatMode !== 'off' ? ` — 🔁 ${player.repeatMode}` : ''}`,
  });

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
