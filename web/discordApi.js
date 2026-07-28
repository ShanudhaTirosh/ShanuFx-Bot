/**
 * web/discordApi.js
 * Thin wrapper around the bits of Discord's REST API the dashboard needs:
 * OAuth2 code exchange/refresh, current-user lookup, and the current-user's
 * guild list (used to figure out which servers they're allowed to manage
 * here).
 *
 * Uses Node's built-in `fetch` — no extra HTTP client dependency. Every
 * call has a timeout: an unresponsive discord.com shouldn't be able to
 * hang a dashboard request indefinitely.
 */

const API_BASE = 'https://discord.com/api/v10';
const REQUEST_TIMEOUT_MS = 8000;

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

async function timedFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Request to Discord timed out after ${REQUEST_TIMEOUT_MS}ms: ${url}`);
      timeoutErr.isNetworkError = true;
      throw timeoutErr;
    }
    // Any other fetch-level failure (DNS, connection refused, etc.) is a
    // network problem, not an API rejection — tag it so callers (see
    // web/middleware/auth.js) can fail open instead of forcing a logout.
    err.isNetworkError = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wraps a non-ok Response into an Error carrying the real HTTP status code
 * as `.status`, instead of only embedding it in the message string —
 * callers should branch on `err.status`, not on parsing the message.
 */
async function httpError(res, context) {
  const body = await res.text().catch(() => '');
  const err = new Error(`${context} (${res.status}): ${body}`);
  err.status = res.status;
  return err;
}

/**
 * Exchanges an OAuth2 authorization code for an access/refresh token pair.
 */
async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
  });

  const res = await timedFetch(`${API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) throw await httpError(res, 'Discord token exchange failed');
  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

/**
 * Exchanges a refresh token for a new access/refresh token pair. Used to
 * keep a session's Discord permissions check current without forcing a
 * full re-login (see web/middleware/auth.js's staleness check).
 */
async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await timedFetch(`${API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) throw await httpError(res, 'Discord token refresh failed');
  return res.json();
}

/**
 * Fetches the logged-in user's profile.
 */
async function getCurrentUser(accessToken) {
  const res = await timedFetch(`${API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw await httpError(res, 'Failed to fetch Discord user');
  return res.json(); // { id, username, avatar, ... }
}

/**
 * Fetches every guild the user is in, filtered down to the ones they can
 * manage (Administrator or Manage Server permission) — those are the only
 * guilds this dashboard should ever let them touch.
 */
async function getManageableGuilds(accessToken) {
  const res = await timedFetch(`${API_BASE}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw await httpError(res, 'Failed to fetch Discord guilds');
  const guilds = await res.json();

  return guilds
    .filter(g => {
      const perms = BigInt(g.permissions ?? 0);
      return (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & MANAGE_GUILD) === MANAGE_GUILD;
    })
    .map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${g.icon.startsWith('a_') ? 'gif' : 'png'}`
        : null,
    }));
}

module.exports = { exchangeCode, refreshAccessToken, getCurrentUser, getManageableGuilds };
