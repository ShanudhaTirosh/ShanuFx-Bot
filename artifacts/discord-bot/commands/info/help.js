/**
 * commands/info/help.js
 * /help — lists every loaded command grouped by category.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPrefix } = require('../../handlers/configHandler');

const CATEGORY_LABELS = {
  moderation: '🔨 Moderation',
  setup: '⚙️ Setup',
  antispam: '🛡️ Anti-Spam',
  info: 'ℹ️ Info',
  music: '🎵 Music',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands')
    .setDMPermission(false),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const commands = interaction.client.commands;

    const byCategory = new Map();
    for (const command of commands.values()) {
      const cat = command.category ?? 'other';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(command);
    }

    const fields = [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, cmds]) => ({
        name: CATEGORY_LABELS[cat] ?? `📁 ${cat}`,
        value: cmds
          .sort((a, b) => a.data.name.localeCompare(b.data.name))
          .map(c => `\`/${c.data.name}\` — ${c.data.description}`)
          .join('\n'),
      }));

    const { value: prefix, enabled: prefixEnabled } = getPrefix(interaction.guildId);
    const prefixNote = prefixEnabled
      ? `Every command also works as a text command — e.g. \`${prefix}help\`. Change the prefix with \`/setprefix\`.`
      : 'Text-prefix commands are currently disabled for this server — only slash commands (`/`) work. Enable them with `/setprefix enable`.';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Command Help')
      .setDescription(`This server has **${commands.size}** command(s) available — usable as \`/command\` or \`${prefix}command\`.`)
      .addFields(fields)
      .setFooter({ text: `Most commands require moderator/admin permissions. ${prefixNote}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
