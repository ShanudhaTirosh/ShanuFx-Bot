const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireSameVoiceChannel, getActivePlayer } = require('../../music/voiceChecks');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track')
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt.setName('to').setDescription('Skip forward to this queue position instead of just the next track').setMinValue(1),
    ),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    if (!player || (!player.playing && !player.paused)) {
      return interaction.reply({ embeds: [err('Nothing is playing right now.')], ephemeral: true });
    }

    const sameChannel = requireSameVoiceChannel(interaction, player);
    if (!sameChannel.ok) return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });

    const skippedTrack = player.queue.current;
    const to = interaction.options.getInteger('to');

    try {
      if (to) {
        if (to > player.queue.tracks.length) {
          return interaction.reply({ embeds: [err(`There are only ${player.queue.tracks.length} track(s) queued.`)], ephemeral: true });
        }
        await player.skip(to - 1);
      } else {
        await player.skip();
      }
    } catch (e) {
      return interaction.reply({ embeds: [err(`Failed to skip: ${e.message}`)], ephemeral: true });
    }

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`⏭️ Skipped **${skippedTrack?.info?.title ?? 'the current track'}**.`)],
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
