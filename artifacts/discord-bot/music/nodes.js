/**
 * music/nodes.js
 *
 * Builds the list of Lavalink nodes the bot connects to. lavalink-client
 * picks the least-loaded *connected* node when creating a new player, so
 * if the primary is down, new requests transparently land on a fallback.
 * Existing players on a dying node get moved with player.moveNode()
 * (wired up in lavalinkManager.js) instead of music just stopping.
 *
 * ── Primary node ─────────────────────────────────────────────────────────
 * Configure via env vars. If LAVALINK_HOST isn't set, skipped entirely.
 *
 * ── Public fallback nodes ─────────────────────────────────────────────────
 * Free, publicly shared Lavalink v4 nodes. Set
 * LAVALINK_ENABLE_PUBLIC_FALLBACK=false to disable.
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
  // All support YouTube search (ytmsearch/ytsearch) and SoundCloud.
  // Spotify works via the bot's built-in keyless fallback on any of these.
  // Source: https://lavalink.darrennathanael.com and community lists
  if (bool(process.env.LAVALINK_ENABLE_PUBLIC_FALLBACK, true)) {
    nodes.push(
      // Ajie's node — one of the most reliable free Lavalink v4 nodes
      {
        id: 'public-ajie',
        host: 'lava-v4.ajieblogs.eu.org',
        port: 443,
        authorization: 'https://dsc.gg/ajidevserver',
        secure: true,
        retryAmount: 5,
        retryDelay: 8_000,
      },
      // Serenetia — another well-known free v4 node
      {
        id: 'public-serenetia',
        host: 'lavalinkv4.serenetia.com',
        port: 80,
        authorization: 'https://seretia.link/discord',
        secure: false,
        retryAmount: 5,
        retryDelay: 8_000,
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
