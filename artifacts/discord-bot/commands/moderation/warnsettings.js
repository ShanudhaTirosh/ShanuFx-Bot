/**
 * commands/moderation/warnsettings.js
 * /warnsettings set    [mute_at] [mute_duration] [kick_at] [ban_at]
 * /warnsettings status
 * /warnsettings disable
 *
 * Lets a server auto-escalate: once a member reaches N active warnings,
 * the bot automatically mutes/kicks/bans them (checked right after /warn).
 * Any tier left unset stays off. Tiers are evaluated ban > kick > mute so
 * the harshest applicable action fires once per warning.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getConfig, saveConfig } = require('../../handlers/configHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnsettings')
    .setDescription('Configure automatic escalation based on warning count')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set auto-escalation thresholds (leave a field out to leave it unchanged)')
        .addIntegerOption(opt =>
          opt.setName('mute_at').setDescription('Auto-mute at this many active warnings (0 = off)').setMinValue(0).setMaxValue(50),
        )
        .addIntegerOption(opt =>
          opt.setName('mute_duration').setDescription('Auto-mute duration in minutes (default 30)').setMinValue(1).setMaxValue(40320),
        )
        .addIntegerOption(opt =>
          opt.setName('kick_at').setDescription('Auto-kick at this many active warnings (0 = off)').setMinValue(0).setMaxValue(50),
        )
        .addIntegerOption(opt =>
          opt.setName('ban_at').setDescription('Auto-ban at this many active warnings (0 = off)').setMinValue(0).setMaxValue(50),
        ),
    )
    .addSubcommand(sub => sub.setName('status').setDescription('Show current auto-escalation settings'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Turn off all auto-escalation tiers')),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    if (sub === 'disable') {
      config.warnThresholds = { muteAt: null, muteDuration: config.warnThresholds.muteDuration, kickAt: null, banAt: null };
      saveConfig(interaction.guildId, config);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('🔕 Warning auto-escalation has been **disabled**.')],
        ephemeral: true,
      });
    }

    if (sub === 'set') {
      const muteAt = interaction.options.getInteger('mute_at');
      const muteDuration = interaction.options.getInteger('mute_duration');
      const kickAt = interaction.options.getInteger('kick_at');
      const banAt = interaction.options.getInteger('ban_at');

      if (muteAt !== null) config.warnThresholds.muteAt = muteAt === 0 ? null : muteAt;
      if (muteDuration !== null) config.warnThresholds.muteDuration = muteDuration;
      if (kickAt !== null) config.warnThresholds.kickAt = kickAt === 0 ? null : kickAt;
      if (banAt !== null) config.warnThresholds.banAt = banAt === 0 ? null : banAt;

      // Sanity check: tiers should escalate (mute < kick < ban) or they'll
      // never really "escalate" — warn, don't block, since a mod might have
      // a reason for an unusual setup.
      const { muteAt: m, kickAt: k, banAt: b } = config.warnThresholds;
      const outOfOrder = (m && k && m >= k) || (k && b && k >= b) || (m && b && m >= b);

      saveConfig(interaction.guildId, config);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('⚙️ Warning Auto-Escalation Updated')
            .setDescription(buildSummary(config.warnThresholds))
            .setFooter(outOfOrder ? { text: '⚠️ Note: thresholds aren\'t in increasing order (mute < kick < ban) — double check this is intentional.' } : null)
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    // ── status ─────────────────────────────────────────────────────────────
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('⚙️ Warning Auto-Escalation Status')
          .setDescription(buildSummary(config.warnThresholds))
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  },
};

function buildSummary(t) {
  return [
    `**Auto-mute** : ${t.muteAt ? `at **${t.muteAt}** warnings, for **${t.muteDuration}** minute(s)` : '🔴 off'}`,
    `**Auto-kick** : ${t.kickAt ? `at **${t.kickAt}** warnings` : '🔴 off'}`,
    `**Auto-ban**  : ${t.banAt ? `at **${t.banAt}** warnings` : '🔴 off'}`,
  ].join('\n');
}
