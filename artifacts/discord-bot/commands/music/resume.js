const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireSameVoiceChannel, getActivePlayer } = require('../../music/voiceChecks');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the current track')
    .setDMPermission(false),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    if (!player) {
      return interaction.reply({ embeds: [err('Nothing is queued right now.')], ephemeral: true });
    }
    if (!player.paused) {
      return interaction.reply({ embeds: [err('Playback isn\'t paused.')], ephemeral: true });
    }

    const sameChannel = requireSameVoiceChannel(interaction, player);
    if (!sameChannel.ok) return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });

    await player.resume();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x57F287).setDescription('▶️ Resumed.')],
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
