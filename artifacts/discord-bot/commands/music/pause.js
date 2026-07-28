const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireSameVoiceChannel, getActivePlayer } = require('../../music/voiceChecks');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current track')
    .setDMPermission(false),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    if (!player || !player.playing) {
      return interaction.reply({ embeds: [err('Nothing is playing right now.')], ephemeral: true });
    }
    if (player.paused) {
      return interaction.reply({ embeds: [err('Playback is already paused.')], ephemeral: true });
    }

    const sameChannel = requireSameVoiceChannel(interaction, player);
    if (!sameChannel.ok) return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });

    await player.pause();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription('⏸️ Paused.')],
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
