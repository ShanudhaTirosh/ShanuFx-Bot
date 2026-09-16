/**
 * internal/controlServer.js
 *
 * The bot (index.js) and the dashboard (web/server.js) are two separate
 * processes — they normally only share the SQLite DB file. Controlling a
 * *live* Lavalink player (pause/skip/volume/etc.) or reading its current
 * state needs an actual reference to `client.lavalink`, which only the
 * bot process has. This file is that bridge: a small internal HTTP API,
 * bot-process-side, that the dashboard calls into (see
 * web/musicControlClient.js).
 *
 * This is NOT meant to be internet-facing:
 *   - Bound to 127.0.0.1 by default (INTERNAL_API_HOST=0.0.0.0 only makes
 *     sense in the two-container docker-compose setup, where it's still
 *     unreachable from outside because it's never published via `ports:`).
 *   - Every request must carry a shared secret (INTERNAL_API_SECRET,
 *     compared with a timing-safe check) in an `X-Internal-Secret` header.
 *   - Entirely disabled (server never starts) if INTERNAL_API_SECRET isn't
 *     set — dashboard-side music control routes then fail closed with a
 *     clear "not configured" error rather than silently doing nothing.
 */

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { resolveQuery } = require('../music/resolveQuery');
const { SNOWFLAKE_RE } = require('../web/middleware/validate');

const MAX_QUEUE_TRACKS_IN_RESPONSE = 50;
const MAX_PLAYLIST_TRACKS_PER_REQUEST = 100;

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function serializeTrack(track) {
  if (!track) return null;
  return {
    title: track.info.title,
    author: track.info.author || null,
    uri: track.info.uri || null,
    artworkUrl: track.info.artworkUrl ?? null,
    durationMs: track.info.duration ?? null,
    isStream: !!track.info.isStream,
    requesterTag: track.requester?.tag ?? track.requester?.username ?? null,
  };
}

function serializePlayer(player) {
  if (!player) return null;
  return {
    connected: !!player.connected,
    voiceChannelId: player.voiceChannelId ?? null,
    textChannelId: player.textChannelId ?? null,
    playing: !!player.playing,
    paused: !!player.paused,
    volume: player.volume,
    repeatMode: player.repeatMode,
    position: player.position ?? 0,
    current: serializeTrack(player.queue.current),
    queue: player.queue.tracks.slice(0, MAX_QUEUE_TRACKS_IN_RESPONSE).map(serializeTrack),
    queueLength: player.queue.tracks.length,
  };
}

/** A minimal player-shaped object so resolveQuery() can be reused to
 * resolve a query with no live player yet (e.g. adding a track to a
 * playlist without starting playback). */
function searchOnlyShim(node) {
  return { search: (query, requester) => node.search(query, requester) };
}

function getAnyUsableNode(manager) {
  if (!manager?.useable) return null;
  return manager.nodeManager.leastUsedNodes()[0] ?? null;
}

function requesterFromBody(body) {
  const tag = typeof body.requesterTag === 'string' ? body.requesterTag.slice(0, 64) : 'Dashboard user';
  return { id: body.requesterId, tag, username: tag };
}

/**
 * @param {import('discord.js').Client} client
 */
function startInternalControlServer(client) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.warn('[Internal API] INTERNAL_API_SECRET not set — dashboard music control is disabled.');
    return null;
  }

  const app = express();
  app.set('trust proxy', false);
  app.use(express.json({ limit: '32kb' }));

  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  app.use((req, res, next) => {
    const provided = req.get('x-internal-secret');
    if (!provided || !timingSafeEqual(provided, secret)) {
      return res.status(401).json({ error: 'Invalid or missing internal secret.' });
    }
    next();
  });

  app.param('guildId', (req, res, next, value) => {
    if (!SNOWFLAKE_RE.test(value)) {
      return res.status(400).json({ error: 'Invalid guildId.' });
    }
    next();
  });

  function requireReady(req, res, next) {
    if (!client.isReady()) {
      return res.status(503).json({ error: 'Bot is still starting up.' });
    }
    next();
  }

  function requireGuild(req, res, next) {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Bot is not in this server.' });
    }
    req.discordGuild = guild;
    next();
  }

  /**
   * Resolves + validates a voiceChannelId against a guild, or returns null
   * with a response already sent.
   */
  function resolveVoiceChannel(req, res, guild, voiceChannelId) {
    if (!voiceChannelId || !SNOWFLAKE_RE.test(voiceChannelId)) {
      res.status(400).json({ error: 'A valid voiceChannelId is required.' });
      return null;
    }
    const channel = guild.channels.cache.get(voiceChannelId);
    if (!channel || !channel.isVoiceBased()) {
      res.status(400).json({ error: 'That voice channel does not exist in this server.' });
      return null;
    }
    const perms = channel.permissionsFor(guild.members.me);
    if (!perms?.has('Connect') || !perms?.has('Speak')) {
      res.status(400).json({ error: `I don't have permission to join/speak in that channel.` });
      return null;
    }
    return channel;
  }

  app.get('/health', (req, res) => res.json({ ok: true, ready: client.isReady() }));

  app.get('/guilds/:guildId/voice-channels', requireReady, requireGuild, (req, res) => {
    const channels = [...req.discordGuild.channels.cache.values()]
      .filter(c => c.isVoiceBased())
      .filter(c => {
        const perms = c.permissionsFor(req.discordGuild.members.me);
        return perms?.has('Connect') && perms?.has('Speak');
      })
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .map(c => ({ id: c.id, name: c.name, userCount: c.members.size, userLimit: c.userLimit || null }));
    res.json(channels);
  });

  app.get('/guilds/:guildId/player', requireReady, requireGuild, (req, res) => {
    const player = client.lavalink.getPlayer(req.params.guildId);
    res.json(serializePlayer(player));
  });

  app.post('/guilds/:guildId/resolve', requireReady, (req, res, next) => {
    (async () => {
      const query = (req.body?.query ?? '').trim();
      if (!query) return res.status(400).json({ error: 'query is required.' });

      const node = getAnyUsableNode(client.lavalink);
      if (!node) return res.status(503).json({ error: 'No music server is currently reachable.' });

      try {
        const { tracks } = await resolveQuery(searchOnlyShim(node), query, requesterFromBody(req.body ?? {}));
        return res.json(serializeTrack(tracks[0]));
      } catch (e) {
        return res.status(422).json({ error: e.message });
      }
    })().catch(next);
  });

  app.post('/guilds/:guildId/player/play', requireReady, requireGuild, (req, res, next) => {
    (async () => {
      const guild = req.discordGuild;
      const query = (req.body?.query ?? '').trim();
      if (!query) return res.status(400).json({ error: 'query is required.' });

      let player = client.lavalink.getPlayer(guild.id);
      if (!player) {
        const voiceChannel = resolveVoiceChannel(req, res, guild, req.body?.voiceChannelId);
        if (!voiceChannel) return; // response already sent
        player = client.lavalink.createPlayer({
          guildId: guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: voiceChannel.id, // no dashboard-originated text channel — track announcements go nowhere useful, so point at the voice channel's own chat if it has one
          selfDeaf: true,
          volume: 100,
        });
      }

      if (!player.connected) {
        try {
          await player.connect();
        } catch (e) {
          return res.status(502).json({ error: `Failed to join the voice channel: ${e.message}` });
        }
      }

      let resolved;
      try {
        resolved = await resolveQuery(player, query, requesterFromBody(req.body ?? {}));
      } catch (e) {
        if (player.queue.tracks.length === 0 && !player.queue.current) await player.destroy().catch(() => {});
        return res.status(422).json({ error: e.message });
      }

      const wasIdle = !player.playing && !player.paused;
      player.queue.add(resolved.tracks);
      if (wasIdle) {
        try {
          await player.play();
        } catch (e) {
          return res.status(502).json({ error: `Failed to start playback: ${e.message}` });
        }
      }

      res.json({ added: resolved.tracks.length, playlistName: resolved.playlistName, startedPlaying: wasIdle });
    })().catch(next);
  });

  app.post('/guilds/:guildId/player/queue-playlist', requireReady, requireGuild, (req, res, next) => {
    (async () => {
      const guild = req.discordGuild;
      const tracksIn = Array.isArray(req.body?.tracks) ? req.body.tracks.slice(0, MAX_PLAYLIST_TRACKS_PER_REQUEST) : [];
      if (tracksIn.length === 0) return res.status(400).json({ error: 'tracks[] is required.' });

      let player = client.lavalink.getPlayer(guild.id);
      if (!player) {
        const voiceChannel = resolveVoiceChannel(req, res, guild, req.body?.voiceChannelId);
        if (!voiceChannel) return;
        player = client.lavalink.createPlayer({
          guildId: guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: voiceChannel.id,
          selfDeaf: true,
          volume: 100,
        });
      }

      if (!player.connected) {
        try {
          await player.connect();
        } catch (e) {
          return res.status(502).json({ error: `Failed to join the voice channel: ${e.message}` });
        }
      }

      const requester = requesterFromBody(req.body ?? {});
      const resolvedTracks = [];
      let failed = 0;

      for (const t of tracksIn) {
        if (!t?.uri) { failed++; continue; }
        try {
          const result = await player.search({ query: t.uri }, requester);
          if (result.tracks.length > 0) resolvedTracks.push(result.tracks[0]);
          else failed++;
        } catch {
          failed++;
        }
      }

      if (resolvedTracks.length === 0) {
        if (player.queue.tracks.length === 0 && !player.queue.current) await player.destroy().catch(() => {});
        return res.status(422).json({ error: 'None of the tracks in that playlist could be resolved.' });
      }

      const wasIdle = !player.playing && !player.paused;
      player.queue.add(resolvedTracks);
      if (wasIdle) {
        try {
          await player.play();
        } catch (e) {
          return res.status(502).json({ error: `Failed to start playback: ${e.message}` });
        }
      }

      res.json({ added: resolvedTracks.length, failed, startedPlaying: wasIdle });
    })().catch(next);
  });

  app.post('/guilds/:guildId/player/action', requireReady, requireGuild, (req, res, next) => {
    (async () => {
      const player = client.lavalink.getPlayer(req.params.guildId);
      if (!player) return res.status(404).json({ error: 'No active player in this server.' });

      const { action } = req.body ?? {};
      switch (action) {
        case 'pause':
          if (!player.playing) return res.status(400).json({ error: 'Nothing is playing.' });
          if (player.paused) return res.status(400).json({ error: 'Already paused.' });
          await player.pause();
          break;
        case 'resume':
          if (!player.paused) return res.status(400).json({ error: 'Not paused.' });
          await player.resume();
          break;
        case 'skip':
          if (!player.playing && !player.paused) return res.status(400).json({ error: 'Nothing is playing.' });
          await player.skip();
          break;
        case 'stop':
          await player.destroy();
          break;
        case 'shuffle':
          if (player.queue.tracks.length < 2) return res.status(400).json({ error: 'Not enough tracks to shuffle.' });
          await player.queue.shuffle();
          break;
        case 'clear':
          await player.queue.splice(0, player.queue.tracks.length);
          break;
        default:
          return res.status(400).json({ error: `Unknown action "${action}".` });
      }

      res.json(serializePlayer(action === 'stop' ? null : player));
    })().catch(next);
  });

  app.post('/guilds/:guildId/player/volume', requireReady, requireGuild, (req, res, next) => {
    (async () => {
      const player = client.lavalink.getPlayer(req.params.guildId);
      if (!player) return res.status(404).json({ error: 'No active player in this server.' });

      const percent = Number(req.body?.percent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 200) {
        return res.status(400).json({ error: 'percent must be a number between 0 and 200.' });
      }
      await player.setVolume(percent);
      res.json(serializePlayer(player));
    })().catch(next);
  });

  app.post('/guilds/:guildId/player/loop', requireReady, requireGuild, (req, res, next) => {
    (async () => {
      const player = client.lavalink.getPlayer(req.params.guildId);
      if (!player) return res.status(404).json({ error: 'No active player in this server.' });

      const mode = req.body?.mode;
      if (!['off', 'track', 'queue'].includes(mode)) {
        return res.status(400).json({ error: 'mode must be one of off/track/queue.' });
      }
      await player.setRepeatMode(mode);
      res.json(serializePlayer(player));
    })().catch(next);
  });

  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error('[Internal API] Unhandled error:', err);
    res.status(500).json({ error: 'Internal error.' });
  });

  const host = process.env.INTERNAL_API_HOST || '127.0.0.1';
  const port = Number(process.env.INTERNAL_API_PORT) || 3100;

  const server = app.listen(port, host, () => {
    console.log(`[Internal API] Listening on http://${host}:${port} (dashboard music control bridge)`);
  });

  return server;
}

module.exports = { startInternalControlServer };
