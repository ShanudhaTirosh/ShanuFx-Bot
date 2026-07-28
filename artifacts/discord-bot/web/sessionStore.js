/**
 * web/sessionStore.js
 * Minimal server-side session store, backed by the same SQLite DB as the
 * bot. The browser only ever holds a random session id in a signed,
 * httpOnly cookie — Discord access/refresh tokens never leave the server.
 */

const crypto = require('crypto');
const { db } = require('../db/client');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const INSERT = db.prepare(`
  INSERT INTO sessions (id, discord_user_id, username, avatar, access_token, refresh_token, guilds_json, expires_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const SELECT = db.prepare('SELECT * FROM sessions WHERE id = ?');
const DELETE = db.prepare('DELETE FROM sessions WHERE id = ?');
const UPDATE_GUILDS = db.prepare("UPDATE sessions SET guilds_json = ?, guilds_updated_at = datetime('now') WHERE id = ?");
const UPDATE_TOKENS = db.prepare('UPDATE sessions SET access_token = ?, refresh_token = ? WHERE id = ?');
const DELETE_EXPIRED = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')");

/**
 * Creates a new session row and returns its id (to be put in a cookie).
 */
function createSession({ userId, username, avatar, accessToken, refreshToken, guilds }) {
  const id = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  INSERT.run(id, userId, username, avatar, accessToken, refreshToken ?? null, JSON.stringify(guilds ?? []), expiresAt);
  return id;
}

/**
 * Returns the session row (or null if missing/expired).
 */
function getSession(id) {
  if (!id) return null;
  const row = SELECT.get(id);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    DELETE.run(id);
    return null;
  }
  return {
    id: row.id,
    userId: row.discord_user_id,
    username: row.username,
    avatar: row.avatar,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    guilds: JSON.parse(row.guilds_json),
    guildsUpdatedAt: row.guilds_updated_at,
  };
}

function updateSessionGuilds(id, guilds) {
  UPDATE_GUILDS.run(JSON.stringify(guilds), id);
}

function updateSessionTokens(id, { accessToken, refreshToken }) {
  UPDATE_TOKENS.run(accessToken, refreshToken ?? null, id);
}

function destroySession(id) {
  DELETE.run(id);
}

// Best-effort periodic cleanup of expired sessions.
setInterval(() => DELETE_EXPIRED.run(), 60 * 60 * 1000).unref();

module.exports = { createSession, getSession, updateSessionGuilds, updateSessionTokens, destroySession };
