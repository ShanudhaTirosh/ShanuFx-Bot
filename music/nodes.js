/**
 * music/nodes.js
 *
 * Builds the list of Lavalink nodes the bot connects to. Node order is
 * priority order for humans reading this file, but lavalink-client itself
 * doesn't "prefer" node[0] forever — when a player is created with no
 * explicit node, it picks the least-loaded *connected* node (see
 * music/lavalinkManager.js `createPlayer` calls), so if the primary node
 * is down, new players transparently land on a fallback node instead.
 * Existing players on a node that drops get moved with player.moveNode()
 * (also wired up in lavalinkManager.js) instead of the music just dying.
 *
 * ── Primary node ────────────────────────────────────────────────────────
 * This should be Shanu's own node (lavalink.shanufx.dev / whatever VPS
 * it's running on). Configure it via env vars — see .env.example. If
 * LAVALINK_HOST isn't set, the primary node is skipped entirely and the
 * bot runs on public fallback nodes only (fine for testing, not
 * recommended for production — public nodes are shared, rate-limited by
 * other bots' traffic, and can disappear without notice).
 *
 * ── Public fallback nodes ───────────────────────────────────────────────
 * These are free, publicly shared Lavalink v4 nodes. They rotate/die more
 * often than a node you control, so:
 *   - keep this list to nodes that are currently known-good
 *   - refresh it periodically from a live status tracker, e.g.
 *     https://freelavalink.serenetia.com/list or
 *     https://github.com/DarrenOfficial/lavalink-list
 *   - never rely on public nodes alone for a bot you actually care about;
 *     they're a safety net for when YOUR node has a bad moment, not a
 *     permanent substitute for it
 * Set LAVALINK_ENABLE_PUBLIC_FALLBACK=false to disable these entirely.
 *
 * ── Local node ───────────────────────────────────────────────────────────
 * If you're running Lavalink locally (e.g. `docker compose up lavalink`
 * per docs/MUSIC_SETUP.md), set LAVALINK_LOCAL_ENABLED=true and it's added
 * too — handy for development without touching the production node.
 */

function bool(value, defaultValue) {
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
}

function buildNodes() {
  const nodes = [];

  // ── Primary: Shanu's own Lavalink node ──────────────────────────────────
  if (process.env.LAVALINK_HOST) {
    nodes.push({
      id: process.env.LAVALINK_ID || 'primary-shanufx',
      host: process.env.LAVALINK_HOST, // e.g. lavalink.shanufx.dev
      port: Number(process.env.LAVALINK_PORT || 443),
      authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
      secure: bool(process.env.LAVALINK_SECURE, true),
      retryAmount: 10,
      retryDelay: 5_000,
    });
  } else {
    console.warn(
      '[Music] LAVALINK_HOST not set — no primary node configured. ' +
      'Set LAVALINK_HOST/LAVALINK_PORT/LAVALINK_PASSWORD in .env to use your own node. ' +
      'Falling back to public nodes only.',
    );
  }

  // ── Optional: local Lavalink (docker compose) ───────────────────────────
  if (bool(process.env.LAVALINK_LOCAL_ENABLED, false)) {
    nodes.push({
      id: 'local',
      host: process.env.LAVALINK_LOCAL_HOST || 'localhost',
      port: Number(process.env.LAVALINK_LOCAL_PORT || 2333),
      authorization: process.env.LAVALINK_LOCAL_PASSWORD || 'youshallnotpass',
      secure: false,
      retryAmount: 5,
      retryDelay: 5_000,
    });
  }

  // ── Public fallback nodes ────────────────────────────────────────────────
  if (bool(process.env.LAVALINK_ENABLE_PUBLIC_FALLBACK, true)) {
    nodes.push(
      {
        id: 'public-fallback-1',
        host: 'lava-v4.ajieblogs.eu.org',
        port: 443,
        authorization: 'https://dsc.gg/ajidevserver',
        secure: true,
        retryAmount: 3,
        retryDelay: 10_000,
      },
      {
        id: 'public-fallback-2',
        host: 'lavalink.heavencloud.in',
        port: 443,
        authorization: 'heavencloud',
        secure: true,
        retryAmount: 3,
        retryDelay: 10_000,
      },
    );
  }

  // ── Extra nodes via raw JSON (optional escape hatch) ────────────────────
  // LAVALINK_EXTRA_NODES='[{"id":"x","host":"...","port":443,"authorization":"...","secure":true}]'
  if (process.env.LAVALINK_EXTRA_NODES) {
    try {
      const extra = JSON.parse(process.env.LAVALINK_EXTRA_NODES);
      if (Array.isArray(extra)) nodes.push(...extra);
    } catch (err) {
      console.error('[Music] LAVALINK_EXTRA_NODES is not valid JSON — ignoring:', err.message);
    }
  }

  if (nodes.length === 0) {
    console.error(
      '[Music] No Lavalink nodes configured at all (no primary, no local, public fallback disabled). ' +
      'Music commands will not work until at least one node is available.',
    );
  }

  return nodes;
}

module.exports = { buildNodes };
