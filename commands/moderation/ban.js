/**
 * commands/moderation/ban.js
 * /ban user:@user [reason:<text>] [days:<0-7>]
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendModLog } = require('../../handlers/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server (works even if they have left)')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to ban').setRequired(true),
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the ban').setMaxLength(512),
    )
    .addIntegerOption(opt =>
      opt
        .setName('days')
        .setDescription('Days of messages to delete (0–7, default 0)')
        .setMinValue(0)
        .setMaxValue(7),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const member     = interaction.options.getMember('user'); // null if not in guild
    const reason     = interaction.options.getString('reason') ?? 'No reason provided';
    const days       = interaction.options.getInteger('days') ?? 0;

    // ── Validation ─────────────────────────────────────────────────────────
    if (!targetUser) {
      return interaction.reply({ embeds: [err('User not found.')], ephemeral: true });
    }
    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ embeds: [err('You cannot ban yourself.')], ephemeral: true });
    }
    if (targetUser.id === interaction.guild.ownerId) {
      return interaction.reply({ embeds: [err('You cannot ban the server owner.')], ephemeral: true });
    }
    if (member) {
      // Member is in the guild — extra checks
      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.reply({ embeds: [err('You cannot ban someone with an equal or higher role than you.')], ephemeral: true });
      }
      if (!member.bannable) {
        return interaction.reply({ embeds: [err('I do not have permission to ban this member (check role hierarchy).')], ephemeral: true });
      }
      // DM before ban (only works while they are in the guild)
      await targetUser.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`You were banned from ${interaction.guild.name}`)
            .addFields({ name: '📋 Reason', value: reason })
            .setTimestamp(),
        ],
      }).catch(() => { /* DMs disabled */ });
    }

    // ── Execute ban ────────────────────────────────────────────────────────
    try {
      await interaction.guild.bans.create(targetUser.id, {
        reason:               `${reason} | By: ${interaction.user.tag}`,
        deleteMessageSeconds: days * 86400,
      });
    } catch (e) {
      return interaction.reply({ embeds: [err(`Failed to ban: ${e.message}`)], ephemeral: true });
    }

    // ── Reply to moderator ─────────────────────────────────────────────────
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔨 User Banned')
          .addFields(
            { name: '👤 User',              value: targetUser.tag,        inline: true },
            { name: '🛡️ Moderator',         value: interaction.user.tag,  inline: true },
            { name: '🗑️ Messages Deleted',  value: `${days} day(s)`,      inline: true },
            { name: '📋 Reason',            value: reason },
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });

    // ── Mod log ────────────────────────────────────────────────────────────
    await sendModLog(interaction.guild, {
      action:    'ban',
      target:    targetUser,
      moderator: interaction.user,
      reason,
      extra: [{ name: '🗑️ Messages Deleted', value: `${days} day(s)`, inline: true }],
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
