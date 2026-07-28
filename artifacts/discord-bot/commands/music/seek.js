const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireSameVoiceChannel, getActivePlayer } = require('../../music/voiceChecks');
const { formatDuration } = require('../../music/lavalinkManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Seek to a position in the current track')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('position').setDescription('Timestamp to seek to, e.g. 1:30 or 90').setRequired(true),
    ),

  async execute(interaction) {
    const player = getActivePlayer(interaction);
    const track = player?.queue?.current;
    if (!player || !track) {
      return interaction.reply({ embeds: [err('Nothing is playing right now.')], ephemeral: true });
    }
    if (!track.info.isSeekable) {
      return interaction.reply({ embeds: [err('This track can\'t be seeked (likely a livestream).')], ephemeral: true });
    }

    const sameChannel = requireSameVoiceChannel(interaction, player);
    if (!sameChannel.ok) return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });

    const raw = interaction.options.getString('position');
    const ms = parseTimestamp(raw);
    if (ms === null) {
      return interaction.reply({ embeds: [err('Couldn\'t parse that position — use `mm:ss`, `hh:mm:ss`, or a plain number of seconds.')], ephemeral: true });
    }
    if (ms > track.info.duration) {
      return interaction.reply({ embeds: [err(`That's past the end of the track (${formatDuration(track.info.duration)}).`)], ephemeral: true });
    }

    await player.seek(ms);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`⏩ Seeked to **${formatDuration(ms)}**.`)],
    });
  },
};

function parseTimestamp(raw) {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;

  const parts = trimmed.split(':').map(p => Number(p));
  if (parts.some(Number.isNaN) || parts.length < 2 || parts.length > 3) return null;

  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + part;
  return seconds * 1000;
}

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
