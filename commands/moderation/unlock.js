/**
 * commands/moderation/unlock.js
 * /unlock [channel:#channel] [reason:<text>]
 * Reverses /lock — restores @everyone's Send Messages permission to its
 * channel default (removes the explicit deny overwrite rather than forcing
 * an explicit allow, so it doesn't fight any other overwrites in place).
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { sendModLog } = require('../../handlers/modLogger');

module.exports = {
  cooldown: 5, // permission-overwrite edits are rate-limit sensitive
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel so @everyone can send messages again')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Channel to unlock (defaults to the current channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for unlocking').setMaxLength(512),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    const everyone = interaction.guild.roles.everyone;
    const current = channel.permissionOverwrites.cache.get(everyone.id);

    if (!current?.deny.has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({ embeds: [err(`${channel} is not currently locked.`)], ephemeral: true });
    }

    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: null }, {
        reason: `${reason} | By: ${interaction.user.tag}`,
      });
    } catch (e) {
      return interaction.reply({ embeds: [err(`Failed to unlock: ${e.message}`)], ephemeral: true });
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`🔓 ${channel} has been **unlocked**. Members can send messages again.`)
          .setTimestamp(),
      ],
    });

    await sendModLog(interaction.guild, {
      action: 'unlock',
      target: { id: channel.id, tag: `#${channel.name}` },
      moderator: interaction.user,
      reason,
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
