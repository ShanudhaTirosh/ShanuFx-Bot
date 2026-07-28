/**
 * commands/setup/setwelcome.js
 * /setwelcome set   channel:#channel  message:<text>
 * /setwelcome disable
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
    .setName('setwelcome')
    .setDescription('Configure the welcome message system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set the welcome channel and message')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Text channel to send welcome messages in')
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
        .setDescription('Disable welcome messages without clearing the config'),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    // ── /setwelcome disable ────────────────────────────────────────────────
    if (sub === 'disable') {
      config.welcome.enabled = false;
      saveConfig(interaction.guildId, config);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription('🔕 Welcome messages have been **disabled**.'),
        ],
        ephemeral: true,
      });
    }

    // ── /setwelcome set ────────────────────────────────────────────────────
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    // Verify the bot can send messages there
    if (!channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
      return interaction.reply({
        embeds: [errorEmbed(`I don't have permission to send messages in ${channel}.`)],
        ephemeral: true,
      });
    }

    config.welcome.enabled   = true;
    config.welcome.channelId = channel.id;
    config.welcome.message   = message;
    saveConfig(interaction.guildId, config);

    const preview = message
      .replace(/{user}/g,        `@${interaction.user.username}`)
      .replace(/{username}/g,    interaction.user.username)
      .replace(/{server}/g,      interaction.guild.name)
      .replace(/{membercount}/g, String(interaction.guild.memberCount));

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Welcome System Configured')
          .addFields(
            { name: '📢 Channel',  value: `<#${channel.id}>`, inline: true },
            { name: '🔢 Status',   value: 'Enabled',          inline: true },
            { name: '📝 Message',  value: message },
            { name: '👁️ Preview',  value: preview },
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
