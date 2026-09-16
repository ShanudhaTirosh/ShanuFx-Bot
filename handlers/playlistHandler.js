/**
 * handlers/playlistHandler.js
 * CRUD for guild-scoped dashboard playlists. Same synchronous,
 * db.prepare-per-query style as configHandler/warningsHandler — this file
 * is the only thing that touches the playlists/playlist_tracks tables.
 */

const { db } = require('../db/client');

const MAX_PLAYLISTS_PER_GUILD = 50;
const MAX_TRACKS_PER_PLAYLIST = 500;
const MAX_NAME_LENGTH = 60;

const listPlaylistsStmt = db.prepare(`
  SELECT p.id, p.name, p.created_by, p.created_at,
         (SELECT COUNT(*) FROM playlist_tracks t WHERE t.playlist_id = p.id) AS track_count
  FROM playlists p
  WHERE p.guild_id = ?
  ORDER BY p.created_at DESC
`);

const getPlaylistStmt = db.prepare('SELECT * FROM playlists WHERE id = ? AND guild_id = ?');
const countPlaylistsStmt = db.prepare('SELECT COUNT(*) AS n FROM playlists WHERE guild_id = ?');
const insertPlaylistStmt = db.prepare('INSERT INTO playlists (guild_id, name, created_by) VALUES (?, ?, ?)');
const deletePlaylistStmt = db.prepare('DELETE FROM playlists WHERE id = ? AND guild_id = ?');

const listTracksStmt = db.prepare('SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC');
const countTracksStmt = db.prepare('SELECT COUNT(*) AS n FROM playlist_tracks WHERE playlist_id = ?');
const maxPositionStmt = db.prepare('SELECT MAX(position) AS pos FROM playlist_tracks WHERE playlist_id = ?');
const insertTrackStmt = db.prepare(`
  INSERT INTO playlist_tracks (playlist_id, position, title, author, uri, artwork_url, duration_ms)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const deleteTrackStmt = db.prepare('DELETE FROM playlist_tracks WHERE id = ? AND playlist_id = ?');

function listPlaylists(guildId) {
  return listPlaylistsStmt.all(guildId).map(row => ({
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    trackCount: row.track_count,
  }));
}

function getPlaylistWithTracks(guildId, playlistId) {
  const playlist = getPlaylistStmt.get(playlistId, guildId);
  if (!playlist) return null;

  const tracks = listTracksStmt.all(playlistId).map(t => ({
    id: t.id,
    title: t.title,
    author: t.author,
    uri: t.uri,
    artworkUrl: t.artwork_url,
    durationMs: t.duration_ms,
  }));

  return { id: playlist.id, name: playlist.name, createdBy: playlist.created_by, createdAt: playlist.created_at, tracks };
}

/**
 * @returns {{ ok: true, id: number } | { ok: false, error: string }}
 */
function createPlaylist(guildId, name, createdBy) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { ok: false, error: 'Playlist name is required.' };
  if (trimmed.length > MAX_NAME_LENGTH) return { ok: false, error: `Playlist name must be ${MAX_NAME_LENGTH} characters or fewer.` };

  const { n } = countPlaylistsStmt.get(guildId);
  if (n >= MAX_PLAYLISTS_PER_GUILD) return { ok: false, error: `This server already has the maximum of ${MAX_PLAYLISTS_PER_GUILD} playlists.` };

  const result = insertPlaylistStmt.run(guildId, trimmed, createdBy);
  return { ok: true, id: Number(result.lastInsertRowid) };
}

function deletePlaylist(guildId, playlistId) {
  const result = deletePlaylistStmt.run(playlistId, guildId);
  return result.changes > 0;
}

/**
 * @param {{ title: string, author?: string, uri: string, artworkUrl?: string, durationMs?: number }} track
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function addTrack(guildId, playlistId, track) {
  const playlist = getPlaylistStmt.get(playlistId, guildId);
  if (!playlist) return { ok: false, error: 'Playlist not found.' };

  const { n } = countTracksStmt.get(playlistId);
  if (n >= MAX_TRACKS_PER_PLAYLIST) return { ok: false, error: `This playlist already has the maximum of ${MAX_TRACKS_PER_PLAYLIST} tracks.` };

  if (!track?.uri || !track?.title) return { ok: false, error: 'Track is missing a title or URI.' };

  const { pos } = maxPositionStmt.get(playlistId);
  const nextPosition = (pos ?? -1) + 1;

  insertTrackStmt.run(
    playlistId,
    nextPosition,
    track.title,
    track.author ?? null,
    track.uri,
    track.artworkUrl ?? null,
    track.durationMs ?? null,
  );
  return { ok: true };
}

/**
 * Bulk-add, e.g. "save current queue as playlist". Stops at the track-count
 * cap rather than failing the whole batch.
 */
function addTracks(guildId, playlistId, tracks) {
  let added = 0;
  for (const track of tracks) {
    const result = addTrack(guildId, playlistId, track);
    if (!result.ok) break;
    added++;
  }
  return added;
}

function removeTrack(guildId, playlistId, trackId) {
  const playlist = getPlaylistStmt.get(playlistId, guildId);
  if (!playlist) return false;
  const result = deleteTrackStmt.run(trackId, playlistId);
  return result.changes > 0;
}

module.exports = {
  listPlaylists,
  getPlaylistWithTracks,
  createPlaylist,
  deletePlaylist,
  addTrack,
  addTracks,
  removeTrack,
  MAX_PLAYLISTS_PER_GUILD,
  MAX_TRACKS_PER_PLAYLIST,
};
