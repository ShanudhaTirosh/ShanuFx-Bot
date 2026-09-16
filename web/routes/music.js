/**
 * web/routes/music.js
 * Dashboard endpoints for live music control (proxies to the bot process's
 * internal API — see web/musicControlClient.js) and playlist management
 * (pure DB, no bot needed — see handlers/playlistHandler.js).
 *
 * Mounted at /api in web/server.js, behind the same requireAuth +
 * requireSameOrigin + apiLimiter chain as web/routes/api.js.
 */

const express = require('express');
const { requireGuildAccess } = require('../middleware/auth');
const { requirePositiveIntParam } = require('../middleware/validate');
const musicControl = require('../musicControlClient');
const playlists = require('../../handlers/playlistHandler');

const router = express.Router();

function requesterFromSession(req) {
  return { requesterId: req.session.userId, requesterTag: req.session.username };
}

/** Wraps a route so a MusicControlError becomes a clean JSON response
 * instead of an unhandled rejection / generic 500. */
function withMusicControl(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(err => {
      if (err instanceof musicControl.MusicControlError) {
        return res.status(err.status).json({ error: err.message });
      }
      next(err);
    });
  };
}

// ── Live playback control ───────────────────────────────────────────────────

router.get('/guilds/:guildId/voice-channels', requireGuildAccess, withMusicControl(async (req, res) => {
  res.json(await musicControl.getVoiceChannels(req.params.guildId));
}));

router.get('/guilds/:guildId/player', requireGuildAccess, withMusicControl(async (req, res) => {
  res.json(await musicControl.getPlayerState(req.params.guildId));
}));

router.post('/guilds/:guildId/player/play', requireGuildAccess, withMusicControl(async (req, res) => {
  const query = String(req.body?.query ?? '').trim();
  if (!query) return res.status(400).json({ error: 'query is required.' });
  if (query.length > 500) return res.status(400).json({ error: 'query is too long.' });

  const result = await musicControl.play(req.params.guildId, {
    query,
    voiceChannelId: req.body?.voiceChannelId,
    ...requesterFromSession(req),
  });
  res.json(result);
}));

router.post('/guilds/:guildId/player/action', requireGuildAccess, withMusicControl(async (req, res) => {
  const { action } = req.body ?? {};
  if (!['pause', 'resume', 'skip', 'stop', 'shuffle', 'clear'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action.' });
  }
  res.json(await musicControl.sendAction(req.params.guildId, action));
}));

router.post('/guilds/:guildId/player/volume', requireGuildAccess, withMusicControl(async (req, res) => {
  const percent = Number(req.body?.percent);
  if (!Number.isFinite(percent) || percent < 0 || percent > 200) {
    return res.status(400).json({ error: 'percent must be a number between 0 and 200.' });
  }
  res.json(await musicControl.setVolume(req.params.guildId, percent));
}));

router.post('/guilds/:guildId/player/loop', requireGuildAccess, withMusicControl(async (req, res) => {
  const { mode } = req.body ?? {};
  if (!['off', 'track', 'queue'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be one of off/track/queue.' });
  }
  res.json(await musicControl.setLoop(req.params.guildId, mode));
}));

// ── Playlists (DB-only — works even if the bot is offline) ────────────────

router.get('/guilds/:guildId/playlists', requireGuildAccess, (req, res) => {
  res.json(playlists.listPlaylists(req.params.guildId));
});

router.get('/guilds/:guildId/playlists/:playlistId', requireGuildAccess, requirePositiveIntParam('playlistId'), (req, res) => {
  const playlist = playlists.getPlaylistWithTracks(req.params.guildId, Number(req.params.playlistId));
  if (!playlist) return res.status(404).json({ error: 'Playlist not found.' });
  res.json(playlist);
});

router.post('/guilds/:guildId/playlists', requireGuildAccess, (req, res) => {
  const result = playlists.createPlaylist(req.params.guildId, req.body?.name, req.session.username);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.status(201).json({ id: result.id });
});

router.delete('/guilds/:guildId/playlists/:playlistId', requireGuildAccess, requirePositiveIntParam('playlistId'), (req, res) => {
  const deleted = playlists.deletePlaylist(req.params.guildId, Number(req.params.playlistId));
  if (!deleted) return res.status(404).json({ error: 'Playlist not found.' });
  res.status(204).end();
});

// Add a single track by search term/URL — resolves via the bot (no active
// player required) so we know the real title/author/artwork before saving.
router.post('/guilds/:guildId/playlists/:playlistId/tracks', requireGuildAccess, requirePositiveIntParam('playlistId'), withMusicControl(async (req, res) => {
  const query = String(req.body?.query ?? '').trim();
  if (!query) return res.status(400).json({ error: 'query is required.' });

  const track = await musicControl.resolveTrack(req.params.guildId, query, requesterFromSession(req));
  if (!track) return res.status(422).json({ error: 'Could not resolve that track.' });

  const result = playlists.addTrack(req.params.guildId, Number(req.params.playlistId), track);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.status(201).json(track);
}));

// Snapshot whatever's currently playing/queued into a playlist.
router.post('/guilds/:guildId/playlists/:playlistId/save-queue', requireGuildAccess, requirePositiveIntParam('playlistId'), withMusicControl(async (req, res) => {
  const player = await musicControl.getPlayerState(req.params.guildId);
  if (!player || (!player.current && player.queue.length === 0)) {
    return res.status(400).json({ error: 'Nothing is playing or queued right now.' });
  }

  const tracks = [player.current, ...player.queue].filter(Boolean);
  const added = playlists.addTracks(req.params.guildId, Number(req.params.playlistId), tracks);
  res.json({ added });
}));

router.delete('/guilds/:guildId/playlists/:playlistId/tracks/:trackId', requireGuildAccess, requirePositiveIntParam('playlistId'), requirePositiveIntParam('trackId'), (req, res) => {
  const removed = playlists.removeTrack(req.params.guildId, Number(req.params.playlistId), Number(req.params.trackId));
  if (!removed) return res.status(404).json({ error: 'Track not found.' });
  res.status(204).end();
});

// Load a saved playlist into the live queue (and start playback if idle).
router.post('/guilds/:guildId/playlists/:playlistId/play', requireGuildAccess, requirePositiveIntParam('playlistId'), withMusicControl(async (req, res) => {
  const playlist = playlists.getPlaylistWithTracks(req.params.guildId, Number(req.params.playlistId));
  if (!playlist) return res.status(404).json({ error: 'Playlist not found.' });
  if (playlist.tracks.length === 0) return res.status(400).json({ error: 'This playlist is empty.' });

  const result = await musicControl.queuePlaylist(req.params.guildId, {
    tracks: playlist.tracks.map(t => ({ uri: t.uri })),
    voiceChannelId: req.body?.voiceChannelId,
    ...requesterFromSession(req),
  });
  res.json(result);
}));

module.exports = router;
