/**
 * handlers/warningsHandler.js
 *
 * Dedicated warnings storage (SQLite `warnings` table). Replaces the old
 * `config.warnings[userId] = [...]` JSON blob so that:
 *   - Every warning gets a stable, unique case ID (usable in
 *     `/warnings remove case:<id>`, which the old blob storage couldn't do)
 *   - Clearing/removing warnings is atomic instead of read-modify-write
 *   - A future web dashboard can list/search warnings directly
 */

const { db } = require('../db/client');

const INSERT = db.prepare(`
  INSERT INTO warnings (guild_id, user_id, reason, moderator_id, moderator_tag)
  VALUES (?, ?, ?, ?, ?)
`);
const SELECT_ACTIVE = db.prepare(`
  SELECT * FROM warnings
  WHERE guild_id = ? AND user_id = ? AND cleared = 0
  ORDER BY created_at ASC
`);
const CLEAR_ALL = db.prepare(`
  UPDATE warnings SET cleared = 1 WHERE guild_id = ? AND user_id = ? AND cleared = 0
`);
const CLEAR_ONE = db.prepare(`
  UPDATE warnings SET cleared = 1 WHERE id = ? AND guild_id = ? AND cleared = 0
`);
const SELECT_ONE = db.prepare(`SELECT * FROM warnings WHERE id = ? AND guild_id = ?`);

function rowToWarning(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    reason: row.reason,
    moderatorId: row.moderator_id,
    moderatorTag: row.moderator_tag,
    date: row.created_at,
  };
}

/**
 * Adds a warning and returns it (including its new case id).
 */
function addWarning(guildId, userId, reason, moderator) {
  const info = INSERT.run(guildId, userId, reason, moderator.id, moderator.tag);
  return rowToWarning(SELECT_ONE.get(info.lastInsertRowid, guildId));
}

/**
 * Returns all active (non-cleared) warnings for a user in a guild, oldest first.
 */
function getWarnings(guildId, userId) {
  if (userId) return SELECT_ACTIVE.all(guildId, userId).map(rowToWarning);

  // No userId: return everything for the guild (used by configHandler's
  // read-only `warnings` convenience map).
  return db
    .prepare('SELECT * FROM warnings WHERE guild_id = ? AND cleared = 0 ORDER BY created_at ASC')
    .all(guildId)
    .map(rowToWarning);
}

/**
 * Clears ALL active warnings for a user. Returns how many were cleared.
 */
function clearWarnings(guildId, userId) {
  const info = CLEAR_ALL.run(guildId, userId);
  return info.changes;
}

/**
 * Clears a single warning by its case id. Returns true if a row was cleared.
 */
function removeWarning(guildId, caseId) {
  const info = CLEAR_ONE.run(caseId, guildId);
  return info.changes > 0;
}

module.exports = { addWarning, getWarnings, clearWarnings, removeWarning };
