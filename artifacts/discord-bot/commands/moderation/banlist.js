/**
 * commands/moderation/banlist.js
 * /banlist — shows the server's current ban list (up to 25 shown at a time).
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const PAGE_SIZE = 25;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banlist')
    .setDescription('Show the current ban list for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt.setName('page').setDescription('Page number (25 per page)').setMinValue(1),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const bans = await interaction.guild.bans.fetch().catch(() => null);
    if (!bans) {
      return interaction.editReply({ embeds: [err('Failed to fetch the ban list.')] });
    }

    if (bans.size === 0) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor(0x57F287).setDescription('✅ No bans on record for this server.'),
        ],
      });
    }

    const page = interaction.options.getInteger('page') ?? 1;
    const totalPages = Math.ceil(bans.size / PAGE_SIZE);
    const entries = [...bans.values()]
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map(b => `**${b.user.tag}** \`${b.user.id}\`${b.reason ? `\n> ${b.reason}` : ''}`);

    if (entries.length === 0) {
      return interaction.editReply({ embeds: [err(`Page ${page} is out of range — only ${totalPages} page(s) available.`)] });
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(`🔨 Ban List — ${interaction.guild.name}`)
      .setDescription(entries.join('\n\n'))
      .setFooter({ text: `Total bans: ${bans.size} — page ${page} of ${totalPages}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
