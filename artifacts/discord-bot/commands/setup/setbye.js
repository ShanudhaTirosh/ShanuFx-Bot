/**
 * commands/setup/setbye.js
 * /setbye set   channel:#channel  message:<text>
 * /setbye disable
 *
 * Variables supported: {user}, {username}, {server}, {membercount}
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
    .setName('setbye')
    .setDescription('Configure the goodbye message system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set the goodbye channel and message')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Text channel to send goodbye messages in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption(opt =>
          opt
            .setName('message')
            .setDescription('Message text — use {user} {username} {server} {membercount}')
            .setMaxLength(1024)
            .setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Disable goodbye messages without clearing the config'),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    // ── /setbye disable ────────────────────────────────────────────────────
    if (sub === 'disable') {
      config.bye.enabled = false;
      saveConfig(interaction.guildId, config);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription('🔕 Goodbye messages have been **disabled**.'),
        ],
        ephemeral: true,
      });
    }

    // ── /setbye set ────────────────────────────────────────────────────────
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    if (!channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
      return interaction.reply({
        embeds: [errorEmbed(`I don't have permission to send messages in ${channel}.`)],
        ephemeral: true,
      });
    }

    config.bye.enabled   = true;
    config.bye.channelId = channel.id;
    config.bye.message   = message;
    saveConfig(interaction.guildId, config);

    const preview = message
      .replace(/{user}/g,        `@${interaction.user.username}`)
      .replace(/{username}/g,    interaction.user.username)
      .replace(/{server}/g,      interaction.guild.name)
      .replace(/{membercount}/g, String(interaction.guild.memberCount));

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('✅ Goodbye System Configured')
          .addFields(
            { name: '📢 Channel', value: `<#${channel.id}>`, inline: true },
            { name: '🔢 Status',  value: 'Enabled',          inline: true },
            { name: '📝 Message', value: message },
            { name: '👁️ Preview', value: preview },
          )
          .setFooter({
            text: 'Variables: {user} • {username} • {server} • {membercount}',
          })
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  },
};

function errorEmbed(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
