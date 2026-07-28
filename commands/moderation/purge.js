/**
 * commands/moderation/purge.js
 * /purge amount:<1-100> [user:@user]
 *
 * Respects Discord's 14-day bulk-delete limit.
 * Optionally filters to only delete messages from a specific user.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendModLog } = require('../../handlers/modLogger');

module.exports = {
  cooldown: 8, // channel purges are heavier and can hit Discord rate limits fast
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete recent messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt
        .setName('amount')
        .setDescription('Number of messages to delete (1–100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('Only delete messages from this specific user (optional)'),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const amount     = interaction.options.getInteger('amount');
    const filterUser = interaction.options.getUser('user');

    // Defer so we have time to fetch + delete
    await interaction.deferReply({ ephemeral: true });

    // ── Fetch messages ─────────────────────────────────────────────────────
    let messages;
    try {
      messages = await interaction.channel.messages.fetch({ limit: 100 });
    } catch (e) {
      return interaction.editReply({ embeds: [err(`Failed to fetch messages: ${e.message}`)] });
    }

    // ── Filter: user ───────────────────────────────────────────────────────
    if (filterUser) {
      messages = messages.filter(m => m.author.id === filterUser.id);
    }

    // ── Filter: 14-day limit (Discord requirement for bulkDelete) ──────────
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    messages = messages.filter(m => m.createdTimestamp > twoWeeksAgo);

    const toDelete = [...messages.values()].slice(0, amount);

    if (toDelete.length === 0) {
      return interaction.editReply({
        embeds: [
          err(
            filterUser
              ? `No recent messages from **${filterUser.tag}** found (messages must be under 14 days old).`
              : 'No deletable messages found (messages must be under 14 days old).',
          ),
        ],
      });
    }

    // ── Bulk delete ────────────────────────────────────────────────────────
    let deleted;
    try {
      deleted = await interaction.channel.bulkDelete(toDelete, true);
    } catch (e) {
      return interaction.editReply({ embeds: [err(`Failed to delete: ${e.message}`)] });
    }

    const filterNote = filterUser ? ` from **${filterUser.tag}**` : '';

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(
            `✅ Deleted **${deleted.size}** message(s)${filterNote} in <#${interaction.channelId}>.`,
          )
          .setTimestamp(),
      ],
    });

    // ── Mod log ────────────────────────────────────────────────────────────
    await sendModLog(interaction.guild, {
      action:    'purge',
      target:    filterUser ?? interaction.user, // log the channel if no filter
      moderator: interaction.user,
      reason:    `Purged ${deleted.size} message(s) in #${interaction.channel.name}${filterUser ? ` (filter: ${filterUser.tag})` : ''}`,
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
