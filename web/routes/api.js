/**
 * web/routes/api.js
 * All routes here require a logged-in session (mounted behind requireAuth
 * in web/server.js). Guild-scoped routes additionally go through
 * requireGuildAccess, which checks the user actually manages that guild
 * *and* the bot is actually in it.
 *
 * Notice these routes call the exact same handler modules
 * (configHandler / warningsHandler / modActionsHandler) that the bot
 * process uses — that's the whole point of having moved to a shared
 * SQLite DB in Phase 1: the bot and the dashboard are never out of sync.
 */

const express = require('express');
const { requireGuildAccess } = require('../middleware/auth');
const { requireSnowflakeParam, optionalSnowflakeQuery, requirePositiveIntParam } = require('../middleware/validate');
const { getConfig, saveConfig } = require('../../handlers/configHandler');
const { getWarnings, removeWarning, clearWarnings } = require('../../handlers/warningsHandler');
const { getRecentActions, getActionsForUser } = require('../../handlers/modActionsHandler');
const { db } = require('../../db/client');

const router = express.Router();

// Validate the shape of :guildId on every /guilds/:guildId/* route before
// even checking permissions — a malformed id should never reach the
// permission check or the DB layer.
router.param('guildId', (req, res, next, value) => {
  if (!/^\d{17,20}$/.test(value)) {
    return res.status(400).json({ error: 'Invalid guildId: must be a 17-20 digit Discord ID.' });
  }
  next();
});

// ── Current user + their guild list ─────────────────────────────────────────
router.get('/me', (req, res) => {
  const { userId, username, avatar, guilds } = req.session;

  // Mark which of the user's manageable guilds actually have the bot.
  const withBotStatus = guilds.map(g => {
    const hasBot = !!db.prepare('SELECT 1 FROM guild_configs WHERE guild_id = ?').get(g.id);
    return { ...g, hasBot };
  });

  res.json({ userId, username, avatar, guilds: withBotStatus });
});

// ── Guild config ─────────────────────────────────────────────────────────────
router.get('/guilds/:guildId/config', requireGuildAccess, (req, res) => {
  res.json(getConfig(req.params.guildId));
});

router.put('/guilds/:guildId/config', requireGuildAccess, (req, res) => {
  const incoming = req.body;

  // Validate shape defensively — this endpoint is reachable by anyone with
  // Manage Server on the guild, so don't trust the payload blindly.
  const required = ['welcome', 'bye', 'autorole', 'logs', 'antispam', 'warnThresholds'];
  for (const key of required) {
    if (typeof incoming[key] !== 'object' || incoming[key] === null) {
      return res.status(400).json({ error: `Missing or invalid "${key}" in request body.` });
    }
  }
  if (!['warn', 'mute', 'kick'].includes(incoming.antispam.action)) {
    return res.status(400).json({ error: 'antispam.action must be one of: warn, mute, kick.' });
  }
  if (incoming.antispam.limit < 2 || incoming.antispam.limit > 30) {
    return res.status(400).json({ error: 'antispam.limit must be between 2 and 30.' });
  }
  if (incoming.antispam.window < 1 || incoming.antispam.window > 60) {
    return res.status(400).json({ error: 'antispam.window must be between 1 and 60 seconds.' });
  }
  if (incoming.prefix !== undefined) {
    if (typeof incoming.prefix !== 'object' || incoming.prefix === null) {
      return res.status(400).json({ error: 'Invalid "prefix" in request body.' });
    }
    const { value, enabled } = incoming.prefix;
    if (value !== undefined && (typeof value !== 'string' || value.trim().length === 0 || value.length > 5 || /\s/.test(value))) {
      return res.status(400).json({ error: 'prefix.value must be 1-5 characters with no spaces.' });
    }
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'prefix.enabled must be a boolean.' });
    }
  }

  saveConfig(req.params.guildId, incoming);
  res.json(getConfig(req.params.guildId));
});

// ── Warnings ─────────────────────────────────────────────────────────────────
router.get('/guilds/:guildId/warnings', requireGuildAccess, optionalSnowflakeQuery('userId'), (req, res) => {
  const { userId } = req.query;
  res.json(getWarnings(req.params.guildId, userId || undefined));
});

router.delete('/guilds/:guildId/warnings/:caseId', requireGuildAccess, requirePositiveIntParam('caseId'), (req, res) => {
  const removed = removeWarning(req.params.guildId, Number(req.params.caseId));
  if (!removed) return res.status(404).json({ error: 'Warning not found (already removed?).' });
  res.json({ ok: true });
});

router.delete('/guilds/:guildId/warnings/user/:userId', requireGuildAccess, requireSnowflakeParam('userId'), (req, res) => {
  const cleared = clearWarnings(req.params.guildId, req.params.userId);
  res.json({ ok: true, cleared });
});

// ── Moderation case history ──────────────────────────────────────────────────
router.get('/guilds/:guildId/cases', requireGuildAccess, optionalSnowflakeQuery('userId'), (req, res) => {
  const { userId, limit } = req.query;
  if (userId) return res.json(getActionsForUser(req.params.guildId, userId));
  res.json(getRecentActions(req.params.guildId, Math.min(Number(limit) || 25, 100)));
});

module.exports = router;
