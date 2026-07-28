/**
 * handlers/modLogger.js
 * Shared utility — sends a colour-coded embed to the configured logs channel.
 *
 * Color palette:
 *   ban    → 0xED4245  (red)
 *   kick   → 0xFFA500  (orange)
 *   mute   → 0x5865F2  (blurple)
 *   unmute → 0x57F287  (green)
 *   warn   → 0xFEE75C  (yellow)
 *   purge  → 0x95A5A6  (grey)
 */

const { EmbedBuilder } = require('discord.js');
const { getConfig }    = require('./configHandler');
const { logAction }    = require('./modActionsHandler');

const ACTION_META = {
  ban:      { color: 0xED4245, icon: '🔨' },
  unban:    { color: 0x57F287, icon: '🔓' },
  kick:     { color: 0xFFA500, icon: '👢' },
  mute:     { color: 0x5865F2, icon: '🔇' },
  unmute:   { color: 0x57F287, icon: '🔊' },
  warn:     { color: 0xFEE75C, icon: '⚠️' },
  purge:    { color: 0x95A5A6, icon: '🗑️' },
  lock:     { color: 0xED4245, icon: '🔒' },
  unlock:   { color: 0x57F287, icon: '🔓' },
  slowmode: { color: 0x5865F2, icon: '🐌' },
};

/**
 * @param {import('discord.js').Guild} guild
 * @param {object}                     opts
 * @param {string}                     opts.action       - e.g. 'ban'
 * @param {import('discord.js').User}  opts.target       - punished user
 * @param {import('discord.js').User}  opts.moderator    - moderator who acted
 * @param {string}                     opts.reason
 * @param {import('discord.js').EmbedField[]} [opts.extra] - additional fields
 * @returns {number} the persistent case id for this action
 */
async function sendModLog(guild, { action, target, moderator, reason, extra = [] }) {
  // Always persist to the DB (case history), independent of whether a logs
  // channel is configured — the log channel can be deleted/misconfigured
  // without losing the audit trail.
  const caseId = logAction({
    guildId: guild.id,
    action,
    target,
    moderator,
    reason,
    extra: extra.length ? extra.map(f => ({ name: f.name, value: f.value })) : null,
  });

  const config = getConfig(guild.id);
  if (!config.logs.enabled || !config.logs.channelId) return caseId;

  const channel = guild.channels.cache.get(config.logs.channelId);
  if (!channel) return caseId;

  const meta = ACTION_META[action] ?? { color: 0x99AAB5, icon: '🛡️' };
  const isUserTarget = typeof target.displayAvatarURL === 'function';

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.icon} ${action.toUpperCase()} — Case #${caseId}`)
    .addFields(
      { name: isUserTarget ? '👤 User' : '🎯 Target', value: `${target.tag}\n\`${target.id}\``, inline: true },
      { name: '🛡️ Moderator', value: moderator.tag,                     inline: true },
      ...extra,
      { name: '📋 Reason', value: reason },
    )
    .setFooter({ text: `Case #${caseId}` })
    .setTimestamp();

  if (isUserTarget) embed.setThumbnail(target.displayAvatarURL({ dynamic: true }));

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`[ModLog] Failed to send log in ${guild.name}: ${err.message}`);
  }

  return caseId;
}

module.exports = { sendModLog };
