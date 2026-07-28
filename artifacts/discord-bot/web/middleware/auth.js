/**
 * web/middleware/auth.js
 */

const { getSession, updateSessionGuilds, updateSessionTokens, destroySession } = require('../sessionStore');
const { getManageableGuilds, refreshAccessToken } = require('../discordApi');
const { db } = require('../../db/client');

const COOKIE_NAME = 'session';

// How long we trust a session's cached "which guilds can this user manage"
// list before re-checking it against live Discord data. Without this, a
// user who loses Manage Server on Discord (or has the bot kicked and
// re-invited under someone else) would keep dashboard access to that guild
// for up to the full 7-day session lifetime.
const GUILDS_STALE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Reads the session cookie, loads the session row, and attaches it to
 * req.session. Does NOT block the request if there's no session — routes
 * that need auth should use requireAuth after this. Deliberately does no
 * network calls here (this runs on every request, including static
 * assets) — staleness re-validation happens in requireGuildAccess instead,
 * where it's actually needed.
 */
function attachSession(req, res, next) {
  const sessionId = req.signedCookies?.[COOKIE_NAME];
  req.session = getSession(sessionId);
  next();
}

/**
 * Blocks the request unless a valid session is attached.
 */
function requireAuth(req, res, next) {
  if (!req.session) {
    if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Not logged in' });
    return res.redirect('/');
  }
  next();
}

/**
 * Blocks the request unless the logged-in user is allowed to manage
 * :guildId AND the bot is actually present in that guild (a config row
 * exists — see events/guildCreate.js).
 *
 * If the cached "guilds this user manages" list is older than
 * GUILDS_STALE_MS, this re-fetches it from Discord first — refreshing the
 * access token if needed — so a permission change on Discord's side is
 * reflected here within minutes, not up to 7 days later. If Discord can't
 * be reached at all, we fail open on freshness (use the stale cache rather
 * than lock the user out over a transient network blip) but still enforce
 * whatever the most recent successful check said.
 */
async function requireGuildAccess(req, res, next) {
  const { guildId } = req.params;

  const ageMs = Date.now() - new Date(`${req.session.guildsUpdatedAt.replace(' ', 'T')}Z`).getTime();
  if (ageMs > GUILDS_STALE_MS) {
    const refreshed = await refreshGuildsList(req.session);
    if (refreshed === 'logged-out') {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ error: 'Your session expired. Please log in again.' });
    }
    if (refreshed) req.session.guilds = refreshed;
    // else: Discord unreachable — proceed with the existing cached list.
  }

  const allowed = req.session.guilds.some(g => g.id === guildId);
  if (!allowed) {
    return res.status(403).json({ error: 'You do not have permission to manage this server.' });
  }

  // getConfig() auto-creates a row, which would make "bot not in guild"
  // indistinguishable from "bot in guild with defaults" — so instead we
  // check row existence directly via a raw lookup before that happens.
  const exists = db.prepare('SELECT 1 FROM guild_configs WHERE guild_id = ?').get(guildId);
  if (!exists) {
    return res.status(404).json({ error: 'The bot is not in this server yet.', needsInvite: true });
  }

  next();
}

/**
 * @returns {Promise<Array|null|'logged-out'>} fresh guild list, null if
 * Discord was unreachable (caller should fail open), or 'logged-out' if
 * both the access and refresh token are no longer valid.
 */
async function refreshGuildsList(session) {
  try {
    const guilds = await getManageableGuilds(session.accessToken);
    updateSessionGuilds(session.id, guilds);
    return guilds;
  } catch {
    // Access token likely expired — try a refresh before giving up.
  }

  try {
    const tokens = await refreshAccessToken(session.refreshToken);
    updateSessionTokens(session.id, { accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
    const guilds = await getManageableGuilds(tokens.access_token);
    updateSessionGuilds(session.id, guilds);
    return guilds;
  } catch (err) {
    // A genuine 4xx from Discord (invalid_grant, revoked token, etc.) means
    // this session truly can't be trusted anymore — force re-login. Any
    // other failure (timeout, DNS, 5xx, proxy/network issues) is treated as
    // "Discord is temporarily unreachable" and fails open on the existing
    // cached permission list rather than punishing the user for our
    // connectivity problem.
    if (!err.isNetworkError && err.status >= 400 && err.status < 500) {
      destroySession(session.id);
      return 'logged-out';
    }
    console.warn(`[Auth] Could not refresh guild list for session (Discord unreachable?): ${err.message}`);
    return null;
  }
}

module.exports = { COOKIE_NAME, attachSession, requireAuth, requireGuildAccess };
