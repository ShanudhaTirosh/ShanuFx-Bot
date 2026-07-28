const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireSameVoiceChannel, getActivePlayer } = require('../../music/voiceChecks');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set or view the player volume')
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt.setName('percent').setDescription('Volume percent (0-200)').setMinValue(0).setMaxValue(200),
    ),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    if (!player) {
      return interaction.reply({ embeds: [err('I\'m not playing anything right now.')], ephemeral: true });
    }

    const percent = interaction.options.getInteger('percent');
    if (percent === null) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`🔊 Current volume: **${player.volume}%**`)],
      });
    }

    const sameChannel = requireSameVoiceChannel(interaction, player);
    if (!sameChannel.ok) return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });

    await player.setVolume(percent);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`🔊 Volume set to **${percent}%**.`)],
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
