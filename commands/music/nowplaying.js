const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getActivePlayer } = require('../../music/voiceChecks');
const { buildTrackEmbed, buildControlsRow, trackActiveMessage } = require('../../music/nowPlayingEmbed');

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

    await interaction.reply({
      embeds: [buildTrackEmbed(interaction.client, player, track)],
      components: [buildControlsRow(player)],
    });

    // Treat this as the new "active" controls message too, so the
    // automatic trackStart handler knows to disable it once this track
    // stops being current instead of leaving two live control messages
    // pointed at the same player.
    const message = await interaction.fetchReply().catch(() => null);
    if (message) trackActiveMessage(interaction.guildId, message);
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
