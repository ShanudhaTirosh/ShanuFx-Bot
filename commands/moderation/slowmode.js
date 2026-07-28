/**
 * commands/moderation/slowmode.js
 * /slowmode seconds:<0-21600> [channel:#channel]
 * Sets (or clears, with seconds:0) a channel's slowmode/rate-limit.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { sendModLog } = require('../../handlers/modLogger');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set a channel\'s slowmode delay')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt
        .setName('seconds')
        .setDescription('Seconds between messages per user (0 = off, max 21600 = 6h)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600),
    )
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Channel to apply slowmode to (defaults to the current channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    try {
      await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);
    } catch (e) {
      return interaction.reply({ embeds: [err(`Failed to set slowmode: ${e.message}`)], ephemeral: true });
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(seconds === 0 ? 0x57F287 : 0x5865F2)
          .setDescription(
            seconds === 0
              ? `🐌 Slowmode **disabled** in ${channel}.`
              : `🐌 Slowmode set to **${seconds}s** in ${channel}.`,
          )
          .setTimestamp(),
      ],
    });

    await sendModLog(interaction.guild, {
      action: 'slowmode',
      target: { id: channel.id, tag: `#${channel.name}` },
      moderator: interaction.user,
      reason: `Set to ${seconds}s`,
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
