/**
 * events/guildMemberRemove.js
 * Fires when a member leaves or is kicked/banned from the guild.
 * Handles: goodbye message embed.
 */

const { EmbedBuilder } = require('discord.js');
const { getConfig }    = require('../handlers/configHandler');

module.exports = {
  name: 'guildMemberRemove',
  once: false,

  /**
   * @param {import('discord.js').GuildMember} member
   */
  async execute(member) {
    const { guild } = member;
    const config    = getConfig(guild.id);

    if (!config.bye.enabled || !config.bye.channelId) return;

    const channel = guild.channels.cache.get(config.bye.channelId);
    if (!channel) return;

    const description = resolveVars(config.bye.message, member, guild);

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(`👋 Goodbye from ${guild.name}`)
      .setDescription(description)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({ text: `We now have ${guild.memberCount} member(s)` })
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(`[Bye] Failed to send goodbye message in ${guild.name}: ${err.message}`);
    }
  },
};

// ─── Variable resolver ────────────────────────────────────────────────────────
function resolveVars(text, member, guild) {
  return text
    .replace(/{user}/g,        `<@${member.user.id}>`)
    .replace(/{username}/g,    member.user.username)
    .replace(/{server}/g,      guild.name)
    .replace(/{membercount}/g, String(guild.memberCount));
}
