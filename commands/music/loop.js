const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireSameVoiceChannel, getActivePlayer } = require('../../music/voiceChecks');

const LABELS = { off: '➡️ Off', track: '🔂 Track', queue: '🔁 Queue' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the repeat mode')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt
        .setName('mode')
        .setDescription('What to repeat')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track — repeat the current song', value: 'track' },
          { name: 'Queue — repeat the whole queue', value: 'queue' },
        ),
    ),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    if (!player) {
      return interaction.reply({ embeds: [err('I\'m not playing anything right now.')], ephemeral: true });
    }

    const sameChannel = requireSameVoiceChannel(interaction, player);
    if (!sameChannel.ok) return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });

    const mode = interaction.options.getString('mode');
    await player.setRepeatMode(mode);

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`Repeat mode set to **${LABELS[mode]}**.`)],
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
