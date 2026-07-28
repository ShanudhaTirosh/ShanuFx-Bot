/**
 * handlers/musicSettingsHandler.js
 * Tiny, dedicated handler for the one music-related persistent setting
 * (24/7 mode). Deliberately not folded into configHandler's getConfig/
 * saveConfig shape — that shape is round-tripped wholesale by the web
 * dashboard (see web/routes/api.js), and adding music fields there would
 * mean touching that validation/serialization path for a single boolean.
 */

const { db } = require('../db/client');

const SELECT = db.prepare('SELECT music_247_enabled FROM guild_configs WHERE guild_id = ?');
const INSERT_DEFAULT = db.prepare('INSERT INTO guild_configs (guild_id) VALUES (?)');
const UPDATE = db.prepare('UPDATE guild_configs SET music_247_enabled = ? WHERE guild_id = ?');

function is247Enabled(guildId) {
  const row = SELECT.get(guildId);
  return !!row?.music_247_enabled;
}

function set247(guildId, enabled) {
  if (!SELECT.get(guildId)) INSERT_DEFAULT.run(guildId);
  UPDATE.run(enabled ? 1 : 0, guildId);
}

module.exports = { is247Enabled, set247 };
