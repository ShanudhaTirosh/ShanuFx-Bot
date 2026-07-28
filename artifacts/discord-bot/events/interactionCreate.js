/**
 * events/interactionCreate.js
 * Routes all incoming chat input commands to the appropriate handler.
 */

const { EmbedBuilder } = require('discord.js');
const { checkAndStart } = require('../handlers/cooldownHandler');

module.exports = {
  name: 'interactionCreate',
  once: false,

  /**
   * @param {import('discord.js').Interaction} interaction
   */
  async execute(interaction) {
    // Only handle slash commands
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.warn(`[Interactions] Unknown command: /${interaction.commandName}`);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(`❌ Command \`/${interaction.commandName}\` not found.`),
        ],
        ephemeral: true,
      });
    }

    // ── Per-user cooldown ────────────────────────────────────────────────────
    const { onCooldown, remainingMs } = checkAndStart(command, interaction.user.id, interaction.guildId);
    if (onCooldown) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFEE75C)
            .setDescription(`⏳ Slow down — try \`/${interaction.commandName}\` again in **${Math.ceil(remainingMs / 1000)}s**.`),
        ],
        ephemeral: true,
      });
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[Interactions] Error in /${interaction.commandName}:`, err);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('❌ Command Error')
        .setDescription(
          'An unexpected error occurred while running this command.\nPlease try again later.',
        )
        .setTimestamp();

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
      }
    }
  },
};
