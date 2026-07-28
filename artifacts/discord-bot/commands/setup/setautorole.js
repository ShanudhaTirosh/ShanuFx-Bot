/**
 * commands/setup/setautorole.js
 * /setautorole set    role:@role
 * /setautorole remove
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { getConfig, saveConfig } = require('../../handlers/configHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setautorole')
    .setDescription('Configure automatic role assignment on member join')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set the role automatically given to new members')
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Role to assign when a member joins')
            .setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove the auto role (new members get no automatic role)'),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    // ── /setautorole remove ────────────────────────────────────────────────
    if (sub === 'remove') {
      config.autorole.enabled = false;
      config.autorole.roleId  = null;
      saveConfig(interaction.guildId, config);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription('✅ Auto role has been **removed**. New members will not receive a role automatically.'),
        ],
        ephemeral: true,
      });
    }

    // ── /setautorole set ───────────────────────────────────────────────────
    const role      = interaction.options.getRole('role');
    const botMember = interaction.guild.members.me;

    // Cannot assign managed (bot/integration) roles
    if (role.managed) {
      return interaction.reply({
        embeds: [errorEmbed(`**${role.name}** is a managed role (integration/bot) and cannot be assigned manually.`)],
        ephemeral: true,
      });
    }

    // Cannot assign @everyone
    if (role.id === interaction.guild.id) {
      return interaction.reply({
        embeds: [errorEmbed('You cannot use **@everyone** as an auto role.')],
        ephemeral: true,
      });
    }

    // Bot hierarchy check — bot's highest role must be above the target role
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `I cannot assign **${role.name}** because it is at or above my highest role (**${botMember.roles.highest.name}**).` +
            '\nMove my role above the target role and try again.',
          ),
        ],
        ephemeral: true,
      });
    }

    config.autorole.enabled = true;
    config.autorole.roleId  = role.id;
    saveConfig(interaction.guildId, config);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Auto Role Set')
          .setDescription(`New members will automatically receive <@&${role.id}> when they join.`)
          .addFields(
            { name: '🎭 Role',   value: `<@&${role.id}>`, inline: true },
            { name: '🔢 Status', value: 'Enabled',         inline: true },
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
