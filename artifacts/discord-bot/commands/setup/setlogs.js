/**
 * commands/setup/setlogs.js
 * /setlogs set     channel:#channel
 * /setlogs disable
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const { getConfig, saveConfig } = require('../../handlers/configHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogs')
    .setDescription('Configure the moderation logs channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set the channel that receives moderation log embeds')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Text channel to send mod logs to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Disable mod logs (config is preserved)'),
    )
    .addSubcommand(sub =>
      sub
        .setName('messages')
        .setDescription('Toggle logging of edited/deleted messages to the logs channel')
        .addStringOption(opt =>
          opt
            .setName('toggle')
            .setDescription('Enable or disable message edit/delete logging')
            .setRequired(true)
            .addChoices(
              { name: 'on  — Log edited/deleted messages', value: 'on' },
              { name: 'off — Don\'t log message edits/deletes', value: 'off' },
            ),
        ),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    // ── /setlogs disable ───────────────────────────────────────────────────
    if (sub === 'disable') {
      config.logs.enabled = false;
      saveConfig(interaction.guildId, config);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription('🔕 Moderation logs have been **disabled**.'),
        ],
        ephemeral: true,
      });
    }

    // ── /setlogs messages ──────────────────────────────────────────────────
    if (sub === 'messages') {
      const toggle = interaction.options.getString('toggle');

      if (toggle === 'on' && (!config.logs.enabled || !config.logs.channelId)) {
        return interaction.reply({
          embeds: [errorEmbed('Set a logs channel first with `/setlogs set channel:#channel` before enabling message logging.')],
          ephemeral: true,
        });
      }

      config.logs.messageLogsEnabled = toggle === 'on';
      saveConfig(interaction.guildId, config);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(toggle === 'on' ? 0x57F287 : 0xED4245)
            .setDescription(
              toggle === 'on'
                ? `✅ Edited/deleted messages will now be logged in <#${config.logs.channelId}>.`
                : '🔕 Message edit/delete logging is now **disabled**.',
            ),
        ],
        ephemeral: true,
      });
    }

    // ── /setlogs set ───────────────────────────────────────────────────────
    const channel = interaction.options.getChannel('channel');

    const botPerms = channel.permissionsFor(interaction.guild.members.me);
    if (!botPerms.has('SendMessages') || !botPerms.has('EmbedLinks')) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `I need **Send Messages** and **Embed Links** permissions in ${channel} to post logs.`,
          ),
        ],
        ephemeral: true,
      });
    }

    config.logs.enabled   = true;
    config.logs.channelId = channel.id;
    saveConfig(interaction.guildId, config);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Logs Channel Set')
          .setDescription(
            `All moderation actions will be logged in <#${channel.id}>.`,
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  },
};

function errorEmbed(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
