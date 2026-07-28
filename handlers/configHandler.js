/**
 * handlers/configHandler.js
 *
 * Per-guild configuration, now backed by SQLite (db/client.js) instead of
 * config/{guildId}.json files. Kept intentionally synchronous and with the
 * exact same getConfig(guildId) / saveConfig(guildId, config) shape as the
 * old JSON version, so every command file that already calls these needed
 * zero changes.
 *
 * Why this replaced the JSON-file version:
 *   - Atomic writes (no read-modify-write race if two commands touch the
 *     same guild at once)
 *   - Works on hosts with ephemeral local disks as long as the DB file
 *     itself lives on a persistent volume
 *   - Can be read by a separate web-dashboard process at the same time
 *     (WAL mode) instead of only ever being touched by the bot process
 *
 * NOTE: warnings are NOT stored here anymore — see handlers/warningsHandler.js
 * for the dedicated, case-ID-based warnings table. `config.warnings` is kept
 * as a computed read-only convenience array for any old code that expects it,
 * but new code should use warningsHandler directly.
 */

const { db } = require('../db/client');
const { getWarnings } = require('./warningsHandler');

const DEFAULTS = {
  welcome_message: 'Welcome {user} to **{server}**! 🎉',
  bye_message: 'Goodbye **{username}**. We will miss you!',
};

const SELECT = db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?');
const INSERT_DEFAULT = db.prepare(`
  INSERT INTO guild_configs (guild_id) VALUES (?)
`);
const UPDATE = db.prepare(`
  UPDATE guild_configs SET
    welcome_enabled = ?, welcome_channel_id = ?, welcome_message = ?,
    bye_enabled = ?, bye_channel_id = ?, bye_message = ?,
    autorole_enabled = ?, autorole_role_id = ?,
    logs_enabled = ?, logs_channel_id = ?, message_logs_enabled = ?,
    antispam_enabled = ?, antispam_limit = ?, antispam_window = ?,
    antispam_action = ?, antispam_block_invites = ?,
    warn_mute_at = ?, warn_mute_duration = ?, warn_kick_at = ?, warn_ban_at = ?,
    status_type = ?, activity_type = ?, activity_text = ?, activity_url = ?,
    updated_at = datetime('now')
  WHERE guild_id = ?
`);

// ─── Row <-> app-shape mapping ─────────────────────────────────────────────────
function rowToConfig(row, guildId) {
  return {
    welcome: {
      enabled: !!row.welcome_enabled,
      channelId: row.welcome_channel_id,
      message: row.welcome_message ?? DEFAULTS.welcome_message,
    },
    bye: {
      enabled: !!row.bye_enabled,
      channelId: row.bye_channel_id,
      message: row.bye_message ?? DEFAULTS.bye_message,
    },
    autorole: {
      enabled: !!row.autorole_enabled,
      roleId: row.autorole_role_id,
    },
    logs: {
      enabled: !!row.logs_enabled,
      channelId: row.logs_channel_id,
      messageLogsEnabled: !!row.message_logs_enabled,
    },
    warnThresholds: {
      muteAt: row.warn_mute_at,
      muteDuration: row.warn_mute_duration,
      kickAt: row.warn_kick_at,
      banAt: row.warn_ban_at,
    },
    antispam: {
      enabled: !!row.antispam_enabled,
      limit: row.antispam_limit,
      window: row.antispam_window,
      action: row.antispam_action,
      blockInvites: !!row.antispam_block_invites,
    },
    prefix: {
      value: row.command_prefix || '.',
      enabled: row.prefix_commands_enabled === undefined ? true : !!row.prefix_commands_enabled,
    },
    botStatus: {
      statusType: row.status_type || 'online',
      activityType: row.activity_type || 'playing',
      activityText: row.activity_text || null,
      activityUrl: row.activity_url || null,
    },
    // Read-only convenience view; use warningsHandler for real reads/writes.
    get warnings() {
      const list = getWarnings(guildId);
      const byUser = {};
      for (const w of list) {
        (byUser[w.userId] ??= []).push(w);
      }
      return byUser;
    },
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns full guild config object, creating a default row if absent.
 * @param {string} guildId
 * @returns {object}
 */
function getConfig(guildId) {
  let row = SELECT.get(guildId);
  if (!row) {
    INSERT_DEFAULT.run(guildId);
    row = SELECT.get(guildId);
  }
  return rowToConfig(row, guildId);
}

/**
 * Persists a guild config object (same shape returned by getConfig, minus
 * `warnings` which is managed separately).
 * @param {string} guildId
 * @param {object} config
 */
function saveConfig(guildId, config) {
  // Make sure a row exists first (upsert-ish).
  if (!SELECT.get(guildId)) INSERT_DEFAULT.run(guildId);

  UPDATE.run(
    config.welcome.enabled ? 1 : 0,
    config.welcome.channelId ?? null,
    config.welcome.message ?? DEFAULTS.welcome_message,
    config.bye.enabled ? 1 : 0,
    config.bye.channelId ?? null,
    config.bye.message ?? DEFAULTS.bye_message,
    config.autorole.enabled ? 1 : 0,
    config.autorole.roleId ?? null,
    config.logs.enabled ? 1 : 0,
    config.logs.channelId ?? null,
    config.logs.messageLogsEnabled ? 1 : 0,
    config.antispam.enabled ? 1 : 0,
    config.antispam.limit,
    config.antispam.window,
    config.antispam.action,
    config.antispam.blockInvites ? 1 : 0,
    config.warnThresholds?.muteAt ?? null,
    config.warnThresholds?.muteDuration ?? 30,
    config.warnThresholds?.kickAt ?? null,
    config.warnThresholds?.banAt ?? null,
    config.botStatus?.statusType ?? 'online',
    config.botStatus?.activityType ?? 'playing',
    config.botStatus?.activityText ?? null,
    config.botStatus?.activityUrl ?? null,
    guildId,
  );

  // Prefix is optional in the incoming payload (older callers/tests don't
  // send it) — only touch those columns if the caller actually included it.
  if (config.prefix) {
    if (typeof config.prefix.value === 'string' && config.prefix.value.trim()) {
      SET_PREFIX.run(config.prefix.value.trim(), guildId);
    }
    if (typeof config.prefix.enabled === 'boolean') {
      SET_PREFIX_ENABLED.run(config.prefix.enabled ? 1 : 0, guildId);
    }
  }
}

const SELECT_PREFIX = db.prepare('SELECT command_prefix, prefix_commands_enabled FROM guild_configs WHERE guild_id = ?');
const SET_PREFIX = db.prepare(`
  UPDATE guild_configs SET command_prefix = ?, updated_at = datetime('now') WHERE guild_id = ?
`);
const SET_PREFIX_ENABLED = db.prepare(`
  UPDATE guild_configs SET prefix_commands_enabled = ?, updated_at = datetime('now') WHERE guild_id = ?
`);

/**
 * Fast path for the message-command router (called on every message in a
 * guild), so it doesn't need to build the full config object just to read
 * one field.
 * @param {string} guildId
 * @returns {{ value: string, enabled: boolean }}
 */
function getPrefix(guildId) {
  let row = SELECT_PREFIX.get(guildId);
  if (!row) {
    INSERT_DEFAULT.run(guildId);
    row = SELECT_PREFIX.get(guildId);
  }
  return { value: row.command_prefix || '.', enabled: !!row.prefix_commands_enabled };
}

/**
 * @param {string} guildId
 * @param {string} prefix — 1-5 non-whitespace characters
 */
function setPrefix(guildId, prefix) {
  if (!SELECT.get(guildId)) INSERT_DEFAULT.run(guildId);
  SET_PREFIX.run(prefix, guildId);
}

/**
 * @param {string} guildId
 * @param {boolean} enabled
 */
function setPrefixEnabled(guildId, enabled) {
  if (!SELECT.get(guildId)) INSERT_DEFAULT.run(guildId);
  SET_PREFIX_ENABLED.run(enabled ? 1 : 0, guildId);
}

/**
 * Deletes a guild's config entirely (called on guildDelete).
 * Warnings/mod history are intentionally preserved for audit purposes even
 * if the bot is re-added later — see handlers/modActionsHandler.js.
 * @param {string} guildId
 */
function deleteConfig(guildId) {
  db.prepare('DELETE FROM guild_configs WHERE guild_id = ?').run(guildId);
}

module.exports = { getConfig, saveConfig, deleteConfig, getPrefix, setPrefix, setPrefixEnabled };
