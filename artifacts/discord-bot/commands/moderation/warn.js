/**
 * commands/moderation/warn.js
 * /warn user:@user reason:<text>
 *
 * Warnings are stored in the SQLite `warnings` table (handlers/warningsHandler.js),
 * each with its own case id. If the guild has auto-escalation thresholds set
 * (see /warnsettings), reaching a threshold triggers an automatic mute/kick/ban.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addWarning, getWarnings }   = require('../../handlers/warningsHandler');
const { sendModLog }                = require('../../handlers/modLogger');
const { getConfig }                 = require('../../handlers/configHandler');
const { maybeEscalate }             = require('../../handlers/escalationHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a formal warning to a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user').setDescription('Member to warn').setRequired(true),
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Reason for the warning')
        .setMaxLength(512)
        .setRequired(true),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');

    // ── Validation ─────────────────────────────────────────────────────────
    if (!target) {
      return interaction.reply({ embeds: [err('That user is not in this server.')], ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [err('You cannot warn yourself.')], ephemeral: true });
    }
    if (target.user.bot) {
      return interaction.reply({ embeds: [err('You cannot warn a bot.')], ephemeral: true });
    }
    if (target.id === interaction.guild.ownerId) {
      return interaction.reply({ embeds: [err('You cannot warn the server owner.')], ephemeral: true });
    }
    if (target.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ embeds: [err('You cannot warn someone with an equal or higher role than you.')], ephemeral: true });
    }

    // ── Store warning ──────────────────────────────────────────────────────
    const warning = addWarning(interaction.guildId, target.id, reason, interaction.user);
    const warnCount = getWarnings(interaction.guildId, target.id).length;

    // ── DM the target ──────────────────────────────────────────────────────
    await target.user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`You received a warning in ${interaction.guild.name}`)
          .addFields(
            { name: '📋 Reason',         value: reason },
            { name: '🔢 Total Warnings', value: String(warnCount), inline: true },
            { name: '🆔 Warning ID',     value: `#${warning.id}`,  inline: true },
          )
          .setFooter({ text: 'Please review the server rules to avoid further action.' })
          .setTimestamp(),
      ],
    }).catch(() => { /* DMs disabled */ });

    // ── Reply to moderator ─────────────────────────────────────────────────
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`⚠️ Member Warned — #${warning.id}`)
          .addFields(
            { name: '👤 User',           value: target.user.tag,      inline: true },
            { name: '🛡️ Moderator',      value: interaction.user.tag, inline: true },
            { name: '🔢 Total Warnings', value: String(warnCount),    inline: true },
            { name: '📋 Reason',         value: reason },
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });

    // ── Mod log ────────────────────────────────────────────────────────────
    await sendModLog(interaction.guild, {
      action:    'warn',
      target:    target.user,
      moderator: interaction.user,
      reason,
      extra: [{ name: '🔢 Warning #', value: String(warnCount), inline: true }],
    });

    // ── Auto-escalation ─────────────────────────────────────────────────────
    const config = getConfig(interaction.guildId);
    const escalation = await maybeEscalate(interaction, target, warnCount, config).catch(err2 => {
      console.error(`[Escalation] Failed for ${target.id} in ${interaction.guild.name}: ${err2.message}`);
      return null;
    });

    if (escalation) {
      const labels = { mute: '🔇 auto-muted', kick: '👢 auto-kicked', ban: '🔨 auto-banned' };
      await interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(
              `🤖 **${target.user.tag}** reached the configured threshold and was ${labels[escalation.action]} ` +
              `(Case #${escalation.caseId}). See \`/warnsettings status\` to adjust.`,
            ),
        ],
        ephemeral: true,
      }).catch(() => {});
    }
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
