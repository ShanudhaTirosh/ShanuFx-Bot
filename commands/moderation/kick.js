/**
 * commands/moderation/kick.js
 * /kick user:@user [reason:<text>]
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendModLog } = require('../../handlers/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user').setDescription('Member to kick').setRequired(true),
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the kick').setMaxLength(512),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    // ── Validation ─────────────────────────────────────────────────────────
    if (!target) {
      return interaction.reply({ embeds: [err('That user is not in this server.')], ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [err('You cannot kick yourself.')], ephemeral: true });
    }
    if (target.id === interaction.guild.ownerId) {
      return interaction.reply({ embeds: [err('You cannot kick the server owner.')], ephemeral: true });
    }
    if (target.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ embeds: [err('You cannot kick someone with an equal or higher role than you.')], ephemeral: true });
    }
    if (!target.kickable) {
      return interaction.reply({ embeds: [err('I do not have permission to kick this member (check role hierarchy).')], ephemeral: true });
    }

    // ── DM the target ──────────────────────────────────────────────────────
    await target.user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle(`You were kicked from ${interaction.guild.name}`)
          .addFields({ name: '📋 Reason', value: reason })
          .setTimestamp(),
      ],
    }).catch(() => { /* DMs disabled */ });

    // ── Execute ────────────────────────────────────────────────────────────
    await target.kick(`${reason} | By: ${interaction.user.tag}`);

    // ── Reply to moderator ─────────────────────────────────────────────────
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('👢 Member Kicked')
          .addFields(
            { name: '👤 User',      value: target.user.tag,      inline: true },
            { name: '🛡️ Moderator', value: interaction.user.tag, inline: true },
            { name: '📋 Reason',    value: reason },
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });

    // ── Mod log ────────────────────────────────────────────────────────────
    await sendModLog(interaction.guild, {
      action:    'kick',
      target:    target.user,
      moderator: interaction.user,
      reason,
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
