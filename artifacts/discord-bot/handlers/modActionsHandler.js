/**
 * handlers/modActionsHandler.js
 *
 * Persistent moderation history, independent of the Discord log channel
 * (so history isn't lost if that channel gets deleted). Every ban/kick/
 * mute/unmute/warn/purge/antispam-action gets a row here with a case id.
 * This is the table the future web dashboard's "case history" screen reads.
 */

const { db } = require('../db/client');

const INSERT = db.prepare(`
  INSERT INTO mod_actions (guild_id, action, target_id, target_tag, moderator_id, moderator_tag, reason, extra_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const SELECT_ONE = db.prepare('SELECT * FROM mod_actions WHERE id = ?');
const SELECT_FOR_GUILD = db.prepare(`
  SELECT * FROM mod_actions WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?
`);
const SELECT_FOR_TARGET = db.prepare(`
  SELECT * FROM mod_actions WHERE guild_id = ? AND target_id = ? ORDER BY created_at DESC
`);

function rowToAction(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    action: row.action,
    targetId: row.target_id,
    targetTag: row.target_tag,
    moderatorId: row.moderator_id,
    moderatorTag: row.moderator_tag,
    reason: row.reason,
    extra: row.extra_json ? JSON.parse(row.extra_json) : null,
    date: row.created_at,
  };
}

/**
 * Records a moderation action. Returns the new case id.
 */
function logAction({ guildId, action, target, moderator, reason, extra }) {
  const info = INSERT.run(
    guildId,
    action,
    target.id,
    target.tag ?? String(target.id),
    moderator.id,
    moderator.tag ?? String(moderator.id),
    reason ?? null,
    extra ? JSON.stringify(extra) : null,
  );
  return info.lastInsertRowid;
}

function getRecentActions(guildId, limit = 25) {
  return SELECT_FOR_GUILD.all(guildId, limit).map(rowToAction);
}

function getActionsForUser(guildId, userId) {
  return SELECT_FOR_TARGET.all(guildId, userId).map(rowToAction);
}

module.exports = { logAction, getRecentActions, getActionsForUser };
