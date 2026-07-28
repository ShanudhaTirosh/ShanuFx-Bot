/**
 * commands/setup/setprefix.js
 * /setprefix set <prefix>
 * /setprefix enable
 * /setprefix disable
 * /setprefix status
 *
 * Controls the text-command prefix (default ".") that lets every slash
 * command also be run as e.g. ".ban @user spamming" — see
 * handlers/messageCommandAdapter.js and events/messageCreate.js.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getPrefix, setPrefix, setPrefixEnabled } = require('../../handlers/configHandler');

const MAX_PREFIX_LEN = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setprefix')
    .setDescription('Configure the text-command prefix (e.g. ".") for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Change the text-command prefix')
        .addStringOption((opt) =>
          opt.setName('prefix').setDescription('New prefix, 1-5 characters, no spaces (e.g. . ! or >)').setRequired(true).setMaxLength(MAX_PREFIX_LEN),
        ),
    )
    .addSubcommand((sub) => sub.setName('enable').setDescription('Turn text-prefix commands on'))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Turn text-prefix commands off (slash commands still work)'))
    .addSubcommand((sub) => sub.setName('status').setDescription('Show the current prefix settings')),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const current = getPrefix(interaction.guildId);

    if (sub === 'status') {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('⚙️ Text-Command Prefix')
            .addFields(
              { name: 'Prefix', value: `\`${current.value}\``, inline: true },
              { name: 'Enabled', value: current.enabled ? '✅ Yes' : '❌ No', inline: true },
              { name: 'Example', value: current.enabled ? `\`${current.value}play believer\`` : 'Disabled — use `/play` instead.' },
            ),
        ],
        ephemeral: true,
      });
    }

    if (sub === 'enable' || sub === 'disable') {
      setPrefixEnabled(interaction.guildId, sub === 'enable');
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(sub === 'enable' ? 0x57F287 : 0xED4245)
            .setDescription(
              sub === 'enable'
                ? `✅ Text-prefix commands are now **enabled** — try \`${current.value}help\`.`
                : '🔕 Text-prefix commands are now **disabled**. Slash commands (`/command`) still work.',
            ),
        ],
        ephemeral: true,
      });
    }

    // sub === 'set'
    const raw = interaction.options.getString('prefix');
    const prefix = raw.trim();

    if (!prefix || prefix.length > MAX_PREFIX_LEN) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ Prefix must be 1-${MAX_PREFIX_LEN} characters with no spaces.`)],
        ephemeral: true,
      });
    }
    if (/\s/.test(prefix)) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Prefix can\'t contain spaces.')],
        ephemeral: true,
      });
    }
    if (prefix.startsWith('/')) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Prefix can\'t start with `/` — that\'s reserved for slash commands.')],
        ephemeral: true,
      });
    }

    setPrefix(interaction.guildId, prefix);
    setPrefixEnabled(interaction.guildId, true);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`✅ Text-command prefix set to \`${prefix}\` — try \`${prefix}help\`.`),
      ],
      ephemeral: true,
    });
  },
};
