/**
 * events/guildMemberAdd.js
 * Fires when a member joins the guild.
 * Handles: welcome message embed, auto-role assignment.
 */

const { EmbedBuilder } = require('discord.js');
const { getConfig }    = require('../handlers/configHandler');

module.exports = {
  name: 'guildMemberAdd',
  once: false,

  /**
   * @param {import('discord.js').GuildMember} member
   */
  async execute(member) {
    const { guild } = member;
    const config    = getConfig(guild.id);

    // ── Auto Role ──────────────────────────────────────────────────────────
    if (config.autorole.enabled && config.autorole.roleId) {
      const role = guild.roles.cache.get(config.autorole.roleId);

      if (!role) {
        console.warn(`[AutoRole] Role ${config.autorole.roleId} not found in ${guild.name}`);
      } else {
        const botMember = guild.members.me;
        if (role.position >= botMember.roles.highest.position) {
          console.warn(`[AutoRole] Cannot assign "${role.name}" — role is above bot's highest role`);
        } else {
          try {
            await member.roles.add(role, 'Auto-role on member join');
          } catch (err) {
            console.error(`[AutoRole] Failed to assign role in ${guild.name}: ${err.message}`);
          }
        }
      }
    }

    // ── Welcome Message ────────────────────────────────────────────────────
    if (!config.welcome.enabled || !config.welcome.channelId) return;

    const channel = guild.channels.cache.get(config.welcome.channelId);
    if (!channel) return;

    const description = resolveVars(config.welcome.message, member, guild);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`👋 Welcome to ${guild.name}!`)
      .setDescription(description)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({ text: `Member #${guild.memberCount}` })
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(`[Welcome] Failed to send message in ${guild.name}: ${err.message}`);
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
