/**
 * commands/moderation/unban.js
 * /unban userid:<snowflake> [reason:<text>]
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendModLog } = require('../../handlers/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Revoke a ban by user ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('userid').setDescription('User ID to unban').setRequired(true).setMaxLength(20),
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the unban').setMaxLength(512),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const userId = interaction.options.getString('userid').trim();
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ embeds: [err('That doesn\'t look like a valid user ID (17-20 digit snowflake).')], ephemeral: true });
    }

    const banEntry = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!banEntry) {
      return interaction.reply({ embeds: [err('That user is not currently banned.')], ephemeral: true });
    }

    try {
      await interaction.guild.bans.remove(userId, `${reason} | By: ${interaction.user.tag}`);
    } catch (e) {
      return interaction.reply({ embeds: [err(`Failed to unban: ${e.message}`)], ephemeral: true });
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('🔓 User Unbanned')
          .addFields(
            { name: '👤 User',      value: `${banEntry.user.tag}\n\`${userId}\``, inline: true },
            { name: '🛡️ Moderator', value: interaction.user.tag,                  inline: true },
            { name: '📋 Reason',    value: reason },
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });

    await sendModLog(interaction.guild, {
      action: 'unban',
      target: banEntry.user,
      moderator: interaction.user,
      reason,
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
