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
 * ── Primary node ─────────────────────────────────────────────────────────
 * Configure via env vars — see .env.example. If LAVALINK_HOST isn't set,
 * the primary node is skipped entirely and the bot runs on public fallback
 * nodes only.
 *
 * ── Public fallback nodes ─────────────────────────────────────────────────
 * These are free, publicly shared Lavalink v4 nodes. They rotate/die more
 * often than a node you control — they're a safety net, not a permanent
 * substitute for your own node.
 * Set LAVALINK_ENABLE_PUBLIC_FALLBACK=false to disable these entirely.
 */

function bool(value, defaultValue) {
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
}

function buildNodes() {
  const nodes = [];

  // ── Primary: your own Lavalink node ─────────────────────────────────────
  if (process.env.LAVALINK_HOST) {
    nodes.push({
      id: process.env.LAVALINK_ID || 'primary',
      host: process.env.LAVALINK_HOST,
      port: Number(process.env.LAVALINK_PORT || 443),
      authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
      secure: bool(process.env.LAVALINK_SECURE, true),
      retryAmount: 10,
      retryDelay: 5_000,
    });
  } else {
    console.warn(
      '[Music] LAVALINK_HOST not set — no primary node configured. ' +
      'Falling back to public nodes only.',
    );
  }

  // ── Optional: local Lavalink ─────────────────────────────────────────────
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
  // Sources: https://lavalink.darrennathanael.com/ and community lists
  // All support YouTube (ytmsearch/ytsearch), SoundCloud, and HTTP streams.
  // Spotify works via the bot's own keyless fallback on any of these nodes.
  if (bool(process.env.LAVALINK_ENABLE_PUBLIC_FALLBACK, true)) {
    nodes.push(
      {
        id: 'public-lavalink.darrennathanael.com',
        host: 'lavalink.darrennathanael.com',
        port: 443,
        authorization: 'LL2A5RDPBM5UveCp3DOtg2gRZ51jR9M04m4lWWVBxkgJt1Hg3S',
        secure: true,
        retryAmount: 3,
        retryDelay: 10_000,
      },
      {
        id: 'public-lava-v4.ajieblogs.eu.org',
        host: 'lava-v4.ajieblogs.eu.org',
        port: 443,
        authorization: 'https://dsc.gg/ajidevserver',
        secure: true,
        retryAmount: 3,
        retryDelay: 10_000,
      },
      {
        id: 'public-lavalink.heavencloud.in',
        host: 'lavalink.heavencloud.in',
        port: 443,
        authorization: 'heavencloud',
        secure: true,
        retryAmount: 3,
        retryDelay: 10_000,
      },
      {
        id: 'public-serenetia-v4',
        host: 'lavalinkv4.serenetia.com',
        port: 80,
        authorization: 'https://seretia.link/discord',
        secure: false,
        retryAmount: 3,
        retryDelay: 10_000,
      },
    );
  }

  // ── Extra nodes via raw JSON ─────────────────────────────────────────────
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
      '[Music] No Lavalink nodes configured at all. ' +
      'Music commands will not work until at least one node is available.',
    );
  }

  return nodes;
}

module.exports = { buildNodes };
