const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { is247Enabled, set247 } = require('../../handlers/musicSettingsHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('247')
    .setDescription('Toggle 24/7 mode — keeps the bot in voice even when alone or the queue is empty')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    const enabled = is247Enabled(interaction.guildId);
    set247(interaction.guildId, !enabled);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(!enabled ? 0x57F287 : 0xED4245)
          .setDescription(
            !enabled
              ? '📌 24/7 mode **enabled** — I\'ll stay connected even when the voice channel is empty or the queue runs out.'
              : '📌 24/7 mode **disabled** — I\'ll leave after being alone or idle for a while, as usual.',
          ),
      ],
    });
  },
};
