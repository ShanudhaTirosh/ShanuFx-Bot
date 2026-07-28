/**
 * db/client.js
 *
 * Single shared SQLite database for the whole bot.
 *
 * Why SQLite (via Node's built-in `node:sqlite`) instead of a hosted DB:
 *   - Zero external services / zero native build step — works the same in
 *     dev, in CI, and on a single production host.
 *   - WAL mode lets the bot process and a future web-dashboard API process
 *     read/write the same file concurrently without locking each other out.
 *   - The whole app is behind the functions in handlers/configHandler.js,
 *     handlers/warningsHandler.js and handlers/modActionsHandler.js — if
 *     this ever needs to move to Postgres/MySQL for horizontal scaling,
 *     only this file and those three need to change, not the commands.
 *
 * Requires Node >= 22.5 (node:sqlite). This prints an ExperimentalWarning
 * on boot — that's expected and harmless.
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'bot.db');

const db = new DatabaseSync(DB_PATH);

// WAL = readers don't block writers; safe for a single-writer, few-reader setup.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

// ─── Schema (idempotent — safe to run on every boot) ──────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id              TEXT PRIMARY KEY,
    welcome_enabled       INTEGER NOT NULL DEFAULT 0,
    welcome_channel_id    TEXT,
    welcome_message       TEXT NOT NULL DEFAULT 'Welcome {user} to **{server}**! 🎉',
    bye_enabled           INTEGER NOT NULL DEFAULT 0,
    bye_channel_id        TEXT,
    bye_message           TEXT NOT NULL DEFAULT 'Goodbye **{username}**. We will miss you!',
    autorole_enabled      INTEGER NOT NULL DEFAULT 0,
    autorole_role_id      TEXT,
    logs_enabled          INTEGER NOT NULL DEFAULT 0,
    logs_channel_id       TEXT,
    antispam_enabled      INTEGER NOT NULL DEFAULT 0,
    antispam_limit        INTEGER NOT NULL DEFAULT 5,
    antispam_window       INTEGER NOT NULL DEFAULT 5,
    antispam_action       TEXT NOT NULL DEFAULT 'warn',
    antispam_block_invites INTEGER NOT NULL DEFAULT 1,
    created_at             TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    reason        TEXT NOT NULL,
    moderator_id  TEXT NOT NULL,
    moderator_tag TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    cleared       INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings (guild_id, user_id);

  -- Full moderation history (ban/kick/mute/unmute/warn/purge/antispam-action),
  -- independent of the Discord log channel — this is what the future web
  -- dashboard's "case history" view will read from.
  CREATE TABLE IF NOT EXISTS mod_actions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id       TEXT NOT NULL,
    action         TEXT NOT NULL,
    target_id      TEXT NOT NULL,
    target_tag     TEXT NOT NULL,
    moderator_id   TEXT NOT NULL,
    moderator_tag  TEXT NOT NULL,
    reason         TEXT,
    extra_json     TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mod_actions_guild ON mod_actions (guild_id, created_at);

  -- Web dashboard sessions. A signed, httpOnly cookie holds only this row's
  -- id — no tokens ever touch the browser directly.
  CREATE TABLE IF NOT EXISTS sessions (
    id               TEXT PRIMARY KEY,
    discord_user_id  TEXT NOT NULL,
    username         TEXT NOT NULL,
    avatar           TEXT,
    access_token     TEXT NOT NULL,
    refresh_token    TEXT,
    guilds_json      TEXT NOT NULL DEFAULT '[]',
    expires_at       TEXT NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
`);

// ─── Lightweight column migrations ─────────────────────────────────────────────
// SQLite's ALTER TABLE ADD COLUMN doesn't support "IF NOT EXISTS", so we just
// try each one and swallow the "duplicate column" error on repeat boots.
// Simple and sufficient at this scale — a real migration framework only
// becomes worth it once there are many more of these.
function addColumnIfMissing(table, columnDef) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (err) {
    if (!/duplicate column name/i.test(err.message)) throw err;
  }
}

// Warning auto-escalation thresholds (null = that tier is off)
addColumnIfMissing('guild_configs', 'warn_mute_at INTEGER');
addColumnIfMissing('guild_configs', "warn_mute_duration INTEGER NOT NULL DEFAULT 30");
addColumnIfMissing('guild_configs', 'warn_kick_at INTEGER');
addColumnIfMissing('guild_configs', 'warn_ban_at INTEGER');

// Message edit/delete logging — opt-in separately from mod-action logs
// because it can be noisy; reuses the same logs_channel_id.
addColumnIfMissing('guild_configs', 'message_logs_enabled INTEGER NOT NULL DEFAULT 0');

// Music: 24/7 mode — if enabled, the bot stays connected to its voice
// channel even when alone or the queue is empty (see events/voiceStateUpdate.js
// and playerOptions.onEmptyQueue in music/lavalinkManager.js).
addColumnIfMissing('guild_configs', 'music_247_enabled INTEGER NOT NULL DEFAULT 0');

// Text-prefix commands (e.g. ".ban @user spamming" alongside "/ban") —
// per-guild configurable prefix + on/off switch. See
// handlers/messageCommandAdapter.js and events/messageCreate.js.
addColumnIfMissing('guild_configs', "command_prefix TEXT NOT NULL DEFAULT '.'");
addColumnIfMissing('guild_configs', 'prefix_commands_enabled INTEGER NOT NULL DEFAULT 1');

// Tracks when a session's cached Discord guild-permission list was last
// refreshed, so we can periodically re-check it instead of trusting a
// 7-day-old snapshot of "servers this user manages" (see
// web/middleware/auth.js's staleness check).
addColumnIfMissing('sessions', "guilds_updated_at TEXT NOT NULL DEFAULT (datetime('now'))");

module.exports = { db };
