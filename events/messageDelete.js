/**
 * events/messageDelete.js
 * Logs deleted messages to the configured logs channel, if message-logs
 * are enabled (`/setlogs messages on`). Opt-in and separate from mod-action
 * logs because it can be noisy on active servers.
 */

const { EmbedBuilder } = require('discord.js');
const { getConfig } = require('../handlers/configHandler');

module.exports = {
  name: 'messageDelete',
  once: false,

  /**
   * @param {import('discord.js').Message} message
   */
  async execute(message) {
    if (!message.guild) return; // DMs
    if (message.author?.bot) return;

    const config = getConfig(message.guild.id);
    if (!config.logs.messageLogsEnabled || !config.logs.channelId) return;
    // Don't log deletions in the log channel itself (avoids noise loops).
    if (message.channelId === config.logs.channelId) return;

    const channel = message.guild.channels.cache.get(config.logs.channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x95A5A6)
      .setTitle('🗑️ Message Deleted')
      .addFields(
        { name: '👤 Author', value: message.partial ? 'Unknown (uncached message)' : `${message.author.tag}\n\`${message.author.id}\``, inline: true },
        { name: '📢 Channel', value: `<#${message.channelId}>`, inline: true },
      )
      .setTimestamp();

    if (message.partial || !message.content) {
      embed.addFields({ name: '📝 Content', value: '*Not available — message wasn\'t cached before deletion.*' });
    } else {
      const content = message.content.length > 1000 ? `${message.content.slice(0, 1000)}…` : message.content;
      embed.addFields({ name: '📝 Content', value: content || '*(no text content — embed/attachment only)*' });
    }

    if (!message.partial && message.attachments.size > 0) {
      embed.addFields({
        name: '📎 Attachments',
        value: message.attachments.map(a => a.name ?? a.url).join('\n').slice(0, 1000),
      });
    }

    try {
      await channel.send({ embeds: [embed] });
    } catch { /* missing perms / channel gone */ }
  },
};
