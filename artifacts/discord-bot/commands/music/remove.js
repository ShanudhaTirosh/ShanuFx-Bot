const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireSameVoiceChannel, getActivePlayer } = require('../../music/voiceChecks');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue by its position')
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt.setName('position').setDescription('Queue position to remove (see /queue)').setRequired(true).setMinValue(1),
    ),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    if (!player || player.queue.tracks.length === 0) {
      return interaction.reply({ embeds: [err('The queue is empty.')], ephemeral: true });
    }

    const sameChannel = requireSameVoiceChannel(interaction, player);
    if (!sameChannel.ok) return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });

    const position = interaction.options.getInteger('position');
    if (position > player.queue.tracks.length) {
      return interaction.reply({ embeds: [err(`There are only ${player.queue.tracks.length} track(s) queued.`)], ephemeral: true });
    }

    const removed = await player.queue.splice(position - 1, 1);

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`🗑️ Removed **${removed?.info?.title ?? 'the track'}** from the queue.`)],
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
