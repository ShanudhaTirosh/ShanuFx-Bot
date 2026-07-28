const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireSameVoiceChannel, getActivePlayer } = require('../../music/voiceChecks');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear all upcoming tracks from the queue (keeps the current track playing)')
    .setDMPermission(false),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    if (!player || player.queue.tracks.length === 0) {
      return interaction.reply({ embeds: [err('There\'s nothing queued to clear.')], ephemeral: true });
    }

    const sameChannel = requireSameVoiceChannel(interaction, player);
    if (!sameChannel.ok) return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });

    const count = player.queue.tracks.length;
    await player.queue.splice(0, count);

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`🧹 Cleared **${count}** track(s) from the queue.`)],
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
