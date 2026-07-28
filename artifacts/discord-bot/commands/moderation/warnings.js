/**
 * commands/moderation/warnings.js
 * /warnings view   user:@user          — paginated list of all warnings for a user
 * /warnings remove case:<id>           — clear a single warning by its case id
 * /warnings clear  user:@user          — wipe ALL warnings for a user
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getWarnings, clearWarnings, removeWarning } = require('../../handlers/warningsHandler');

const PAGE_SIZE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View, remove, or clear stored warnings for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('Show all warnings for a member')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to check').setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a single warning by its case id')
        .addIntegerOption(opt =>
          opt.setName('case').setDescription('Warning case id (shown in /warnings view)').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('clear')
        .setDescription('Clear ALL warnings for a member')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to clear warnings for').setRequired(true),
        ),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── /warnings remove ───────────────────────────────────────────────────
    if (sub === 'remove') {
      const caseId = interaction.options.getInteger('case');
      const removed = removeWarning(interaction.guildId, caseId);

      if (!removed) {
        return interaction.reply({
          embeds: [err(`No active warning found with case id \`#${caseId}\` in this server.`)],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(`✅ Removed warning \`#${caseId}\`.`),
        ],
        ephemeral: true,
      });
    }

    // ── /warnings clear ────────────────────────────────────────────────────
    if (sub === 'clear') {
      const targetUser = interaction.options.getUser('user');
      const cleared = clearWarnings(interaction.guildId, targetUser.id);

      if (cleared === 0) {
        return interaction.reply({
          embeds: [info(`**${targetUser.tag}** has no warnings to clear.`)],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(`✅ Cleared **${cleared}** warning(s) for **${targetUser.tag}**.`),
        ],
        ephemeral: true,
      });
    }

    // ── /warnings view ─────────────────────────────────────────────────────
    const targetUser = interaction.options.getUser('user');
    const userWarns = getWarnings(interaction.guildId, targetUser.id);

    if (userWarns.length === 0) {
      return interaction.reply({
        embeds: [info(`**${targetUser.tag}** has no warnings on record. Clean sheet! ✅`)],
        ephemeral: true,
      });
    }

    const totalPages = Math.ceil(userWarns.length / PAGE_SIZE);
    await interaction.reply({
      embeds: [buildPageEmbed(targetUser, userWarns, 0, totalPages)],
      components: totalPages > 1 ? [buildPaginationRow(0, totalPages)] : [],
      ephemeral: true,
    });

    if (totalPages <= 1) return;

    // ── Pagination button handling ─────────────────────────────────────────
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
      time: 2 * 60 * 1000, // 2 minutes
      filter: i => i.user.id === interaction.user.id,
    });

    let page = 0;
    collector.on('collect', async i => {
      if (i.customId === 'warnings_prev') page = Math.max(0, page - 1);
      if (i.customId === 'warnings_next') page = Math.min(totalPages - 1, page + 1);

      await i.update({
        embeds: [buildPageEmbed(targetUser, userWarns, page, totalPages)],
        components: [buildPaginationRow(page, totalPages)],
      });
    });

    collector.on('end', async () => {
      await interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildPageEmbed(targetUser, allWarnings, page, totalPages) {
  const pageItems = allWarnings.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const entries = pageItems.map(w => {
    const date = new Date(w.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    return `**Case #${w.id}** — ${w.reason}\n> By **${w.moderatorTag}** • ${date}`;
  });

  return new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle(`⚠️ Warnings for ${targetUser.tag}`)
    .setDescription(entries.join('\n\n'))
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .setFooter({
      text: `Total: ${allWarnings.length} warning(s) — page ${page + 1} of ${totalPages}`,
    })
    .setTimestamp();
}

function buildPaginationRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('warnings_prev')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('warnings_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages - 1),
  );
}

function info(text) {
  return new EmbedBuilder().setColor(0x5865F2).setDescription(`ℹ️ ${text}`);
}

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
