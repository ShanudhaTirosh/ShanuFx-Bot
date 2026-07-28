/**
 * commands/antispam/antispam.js
 * /antispam on
 * /antispam off
 * /antispam config limit:<n> window:<s> action:<warn|mute|kick>
 * /antispam invites on|off
 * /antispam status
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getConfig, saveConfig } = require('../../handlers/configHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('Configure the anti-spam protection system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)

    // ── /antispam on ────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('on').setDescription('Enable the anti-spam system'),
    )

    // ── /antispam off ───────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('off').setDescription('Disable the anti-spam system'),
    )

    // ── /antispam config ────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('config')
        .setDescription('Adjust detection thresholds and automatic action')
        .addIntegerOption(opt =>
          opt
            .setName('limit')
            .setDescription('Max messages allowed within the time window (default: 5)')
            .setMinValue(2)
            .setMaxValue(30),
        )
        .addIntegerOption(opt =>
          opt
            .setName('window')
            .setDescription('Rolling time window in seconds (default: 5)')
            .setMinValue(1)
            .setMaxValue(60),
        )
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('Action taken when spam is detected (default: warn)')
            .addChoices(
              { name: '⚠️  Warn  — DM warning + log',        value: 'warn' },
              { name: '🔇 Mute  — 10-min Discord timeout',   value: 'mute' },
              { name: '👢 Kick  — Remove from server + log', value: 'kick' },
            ),
        ),
    )

    // ── /antispam invites ───────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('invites')
        .setDescription('Toggle blocking of Discord invite links')
        .addStringOption(opt =>
          opt
            .setName('toggle')
            .setDescription('Enable or disable invite link blocking')
            .setRequired(true)
            .addChoices(
              { name: 'on  — Block invite links', value: 'on'  },
              { name: 'off — Allow invite links', value: 'off' },
            ),
        ),
    )

    // ── /antispam status ────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('status').setDescription('Show current anti-spam configuration'),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    // ── on ─────────────────────────────────────────────────────────────────
    if (sub === 'on') {
      config.antispam.enabled = true;
      saveConfig(interaction.guildId, config);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🛡️ Anti-Spam Enabled')
            .setDescription(
              `The anti-spam system is now **active**.\n\n` +
              buildSummary(config.antispam),
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    // ── off ────────────────────────────────────────────────────────────────
    if (sub === 'off') {
      config.antispam.enabled = false;
      saveConfig(interaction.guildId, config);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription('🔕 Anti-spam system has been **disabled**.'),
        ],
        ephemeral: true,
      });
    }

    // ── config ─────────────────────────────────────────────────────────────
    if (sub === 'config') {
      const limit  = interaction.options.getInteger('limit');
      const window = interaction.options.getInteger('window');
      const action = interaction.options.getString('action');

      let changed = false;

      if (limit !== null) {
        config.antispam.limit = limit;
        changed = true;
      }
      if (window !== null) {
        config.antispam.window = window;
        changed = true;
      }
      if (action !== null) {
        config.antispam.action = action;
        changed = true;
      }

      if (!changed) {
        return interaction.reply({
          embeds: [info('No changes were made. Pass at least one option to update.')],
          ephemeral: true,
        });
      }

      saveConfig(interaction.guildId, config);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('⚙️ Anti-Spam Config Updated')
            .setDescription(buildSummary(config.antispam))
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    // ── invites ────────────────────────────────────────────────────────────
    if (sub === 'invites') {
      const toggle = interaction.options.getString('toggle');
      config.antispam.blockInvites = toggle === 'on';
      saveConfig(interaction.guildId, config);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(toggle === 'on' ? 0x57F287 : 0xED4245)
            .setDescription(
              toggle === 'on'
                ? '✅ Invite link blocking is now **enabled**. Discord invite links will be removed.'
                : '🔕 Invite link blocking is now **disabled**. Invite links are allowed.',
            ),
        ],
        ephemeral: true,
      });
    }

    // ── status ─────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const as = config.antispam;
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(as.enabled ? 0x57F287 : 0xED4245)
            .setTitle('🛡️ Anti-Spam Status')
            .setDescription(buildSummary(as))
            .addFields(
              {
                name:   '🔍 Detections',
                value:  [
                  '• Message flood (rate limiting)',
                  '• Duplicate / repeated messages (3× in a row)',
                  '• Mass user mentions (> 5 pings)',
                  `• Discord invite links (${as.blockInvites ? '**blocked**' : 'allowed'})`,
                ].join('\n'),
              },
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ACTION_LABELS = {
  warn: '⚠️ Warn (DM + log)',
  mute: '🔇 Mute (10-min timeout)',
  kick: '👢 Kick (remove from server)',
};

function buildSummary(as) {
  return [
    `**Status**       : ${as.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
    `**Limit**        : ${as.limit} messages`,
    `**Window**       : ${as.window} second(s)`,
    `**Action**       : ${ACTION_LABELS[as.action] ?? as.action}`,
    `**Block Invites**: ${as.blockInvites ? '✅ Yes' : '❌ No'}`,
  ].join('\n');
}

function info(text) {
  return new EmbedBuilder().setColor(0x5865F2).setDescription(`ℹ️ ${text}`);
}
