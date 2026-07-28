const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireSameVoiceChannel, getActivePlayer } = require('../../music/voiceChecks');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel and clear the queue (alias of /stop)')
    .setDMPermission(false),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    if (!player) {
      return interaction.reply({ embeds: [err('I\'m not in a voice channel.')], ephemeral: true });
    }

    const sameChannel = requireSameVoiceChannel(interaction, player);
    if (!sameChannel.ok) return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });

    await player.destroy();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('👋 Left the voice channel.')],
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
