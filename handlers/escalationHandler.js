/**
 * handlers/escalationHandler.js
 * Checks a member's active warning count against the guild's configured
 * auto-escalation thresholds (see /warnsettings) and takes action if a
 * tier is reached. Called from commands/moderation/warn.js right after a
 * new warning is stored.
 *
 * Tiers are evaluated ban > kick > mute, so only the single harshest
 * applicable action fires for any given warning.
 */

const { EmbedBuilder } = require('discord.js');
const { sendModLog } = require('./modLogger');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').GuildMember} target
 * @param {number} warnCount
 * @param {object} config - result of getConfig(guildId)
 * @returns {Promise<{action: string, caseId: number} | null>} what happened, or null if nothing triggered
 */
async function maybeEscalate(interaction, target, warnCount, config) {
  const { muteAt, muteDuration, kickAt, banAt } = config.warnThresholds;
  const guild = interaction.guild;
  const botUser = interaction.client.user;
  const reason = `Auto-escalation: reached ${warnCount} active warning(s)`;

  // ── Auto-ban ───────────────────────────────────────────────────────────
  if (banAt && warnCount >= banAt) {
    if (!target.bannable) return null; // can't act — silently skip, mods still see the warning itself
    await target.user.send({
      embeds: [new EmbedBuilder().setColor(0xED4245).setTitle(`You were banned from ${guild.name}`)
        .setDescription(`Automatic action: you reached **${warnCount}** warnings.`).setTimestamp()],
    }).catch(() => {});
    await guild.bans.create(target.id, { reason });
    const caseId = await sendModLog(guild, { action: 'ban', target: target.user, moderator: botUser, reason, extra: [{ name: '🤖 Trigger', value: 'Auto-escalation', inline: true }] });
    return { action: 'ban', caseId };
  }

  // ── Auto-kick ──────────────────────────────────────────────────────────
  if (kickAt && warnCount >= kickAt) {
    if (!target.kickable) return null;
    await target.user.send({
      embeds: [new EmbedBuilder().setColor(0xFFA500).setTitle(`You were kicked from ${guild.name}`)
        .setDescription(`Automatic action: you reached **${warnCount}** warnings.`).setTimestamp()],
    }).catch(() => {});
    await target.kick(reason);
    const caseId = await sendModLog(guild, { action: 'kick', target: target.user, moderator: botUser, reason, extra: [{ name: '🤖 Trigger', value: 'Auto-escalation', inline: true }] });
    return { action: 'kick', caseId };
  }

  // ── Auto-mute ──────────────────────────────────────────────────────────
  if (muteAt && warnCount >= muteAt) {
    if (!target.moderatable) return null;
    await target.timeout(muteDuration * 60 * 1000, reason);
    await target.user.send({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`You were timed out in ${guild.name}`)
        .setDescription(`Automatic action: you reached **${warnCount}** warnings. Duration: **${muteDuration}m**.`).setTimestamp()],
    }).catch(() => {});
    const caseId = await sendModLog(guild, { action: 'mute', target: target.user, moderator: botUser, reason, extra: [{ name: '🤖 Trigger', value: 'Auto-escalation', inline: true }] });
    return { action: 'mute', caseId };
  }

  return null;
}

module.exports = { maybeEscalate };
