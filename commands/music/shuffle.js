const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireSameVoiceChannel, getActivePlayer } = require('../../music/voiceChecks');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the current queue')
    .setDMPermission(false),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    if (!player || player.queue.tracks.length < 2) {
      return interaction.reply({ embeds: [err('There aren\'t enough tracks queued to shuffle.')], ephemeral: true });
    }

    const sameChannel = requireSameVoiceChannel(interaction, player);
    if (!sameChannel.ok) return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });

    await player.queue.shuffle();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`🔀 Shuffled **${player.queue.tracks.length}** track(s).`)],
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
