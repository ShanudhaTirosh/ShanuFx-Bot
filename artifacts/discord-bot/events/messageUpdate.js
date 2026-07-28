/**
 * events/messageUpdate.js
 * Logs edited messages (before/after content) to the configured logs
 * channel, if message-logs are enabled (`/setlogs messages on`).
 */

const { EmbedBuilder } = require('discord.js');
const { getConfig } = require('../handlers/configHandler');

module.exports = {
  name: 'messageUpdate',
  once: false,

  /**
   * @param {import('discord.js').Message} oldMessage
   * @param {import('discord.js').Message} newMessage
   */
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild) return; // DMs
    if (newMessage.author?.bot) return;
    // Ignore edits that don't change visible text (e.g. link-embed unfurl,
    // pin state) — only fire when the content actually changed.
    if (oldMessage.content === newMessage.content) return;

    const config = getConfig(newMessage.guild.id);
    if (!config.logs.messageLogsEnabled || !config.logs.channelId) return;
    if (newMessage.channelId === config.logs.channelId) return;

    const channel = newMessage.guild.channels.cache.get(config.logs.channelId);
    if (!channel) return;

    const truncate = s => (s && s.length > 500 ? `${s.slice(0, 500)}…` : s);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('✏️ Message Edited')
      .addFields(
        { name: '👤 Author', value: `${newMessage.author.tag}\n\`${newMessage.author.id}\``, inline: true },
        { name: '📢 Channel', value: `<#${newMessage.channelId}>`, inline: true },
        { name: '🔗 Jump', value: `[Click here](${newMessage.url})`, inline: true },
        { name: '📝 Before', value: oldMessage.partial ? '*Not available — not cached.*' : (truncate(oldMessage.content) || '*(empty)*') },
        { name: '📝 After', value: truncate(newMessage.content) || '*(empty)*' },
      )
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch { /* missing perms / channel gone */ }
  },
};
