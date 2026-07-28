/**
 * commands/moderation/mute.js
 * /mute   user:@user duration:<minutes> [reason:<text>]
 * /unmute user:@user [reason:<text>]
 *
 * Uses Discord's native timeout (communication_disabled_until) API.
 * Max timeout via Discord: 28 days (40,320 minutes).
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendModLog } = require('../../handlers/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (mute) or un-timeout a member using Discord\'s native timeout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Timeout a member')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to mute').setRequired(true),
        )
        .addIntegerOption(opt =>
          opt
            .setName('duration')
            .setDescription('Timeout duration in minutes (1–40320)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(40320),
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason for the mute').setMaxLength(512),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove an active timeout from a member')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to unmute').setRequired(true),
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason for removing the mute').setMaxLength(512),
        ),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    if (!target) {
      return interaction.reply({ embeds: [err('That user is not in this server.')], ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [err('You cannot mute/unmute yourself.')], ephemeral: true });
    }
    if (target.id === interaction.guild.ownerId) {
      return interaction.reply({ embeds: [err('You cannot mute the server owner.')], ephemeral: true });
    }
    if (target.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ embeds: [err('You cannot mute someone with an equal or higher role than you.')], ephemeral: true });
    }
    if (!target.moderatable) {
      return interaction.reply({ embeds: [err('I do not have permission to moderate this member (check role hierarchy).')], ephemeral: true });
    }

    // ─────────────────────────────────────────────────────────────────────
    //  MUTE
    // ─────────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const duration   = interaction.options.getInteger('duration');
      const durationMs = duration * 60 * 1000;

      try {
        await target.timeout(durationMs, `${reason} | By: ${interaction.user.tag}`);
      } catch (e) {
        return interaction.reply({ embeds: [err(`Failed to mute: ${e.message}`)], ephemeral: true });
      }

      // DM notification
      await target.user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`You were timed out in ${interaction.guild.name}`)
            .addFields(
              { name: '⏱️ Duration', value: formatDuration(duration), inline: true },
              { name: '📋 Reason',   value: reason },
            )
            .setTimestamp(),
        ],
      }).catch(() => {});

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🔇 Member Muted')
            .addFields(
              { name: '👤 User',      value: target.user.tag,            inline: true },
              { name: '⏱️ Duration',  value: formatDuration(duration),   inline: true },
              { name: '🛡️ Moderator', value: interaction.user.tag,       inline: true },
              { name: '📋 Reason',    value: reason },
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });

      await sendModLog(interaction.guild, {
        action:    'mute',
        target:    target.user,
        moderator: interaction.user,
        reason,
        extra: [{ name: '⏱️ Duration', value: formatDuration(duration), inline: true }],
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  UNMUTE
    // ─────────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      if (!target.isCommunicationDisabled()) {
        return interaction.reply({ embeds: [err('This member is not currently timed out.')], ephemeral: true });
      }

      try {
        await target.timeout(null, `${reason} | By: ${interaction.user.tag}`);
      } catch (e) {
        return interaction.reply({ embeds: [err(`Failed to unmute: ${e.message}`)], ephemeral: true });
      }

      await target.user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(`Your timeout in ${interaction.guild.name} was removed`)
            .addFields({ name: '📋 Reason', value: reason })
            .setTimestamp(),
        ],
      }).catch(() => {});

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🔊 Member Unmuted')
            .addFields(
              { name: '👤 User',      value: target.user.tag,      inline: true },
              { name: '🛡️ Moderator', value: interaction.user.tag, inline: true },
              { name: '📋 Reason',    value: reason },
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });

      await sendModLog(interaction.guild, {
        action:    'unmute',
        target:    target.user,
        moderator: interaction.user,
        reason,
      });
    }
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(minutes) {
  if (minutes < 60)        return `${minutes}m`;
  if (minutes < 1440)      return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
