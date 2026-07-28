/**
 * music/resolveQuery.js
 *
 * Turns whatever a user typed into /play into a { tracks, playlistName }
 * result ready to hand to player.queue.add(), regardless of whether the
 * currently-connected Lavalink node has Spotify (LavaSrc) support.
 */

const { isSpotifyUrl, resolveSpotifyToQueries } = require('./spotifyResolve');

const MAX_FALLBACK_PLAYLIST_TRACKS = 100;

/**
 * @param {import('lavalink-client').Player} player
 * @param {string} query
 * @param {import('discord.js').User} requester
 * @returns {Promise<{ tracks: any[], playlistName: string | null, sourceNote: string | null }>}
 */
async function resolveQuery(player, query, requester) {
  if (isSpotifyUrl(query)) {
    return resolveSpotify(player, query, requester);
  }

  const result = await player.search({ query }, requester);
  
  if (result.loadType === 'error') {
    throw new Error(result.exception?.message || 'That link/search failed to load.');
  }
  if (result.loadType === 'empty' || result.tracks.length === 0) {
    throw new Error(`No results found for "${query}".`);
  }

  // Playlist detected by Lavalink
  if (result.loadType === 'playlist' && result.tracks.length > 0) {
    console.log(`[Music] Playlist loaded: ${result.playlist?.name}, tracks: ${result.tracks.length}`);
    return {
      tracks: result.tracks,
      playlistName: result.playlist?.name || 'Playlist',
      sourceNote: null,
    };
  }

  // Single track or search result - return only the first track
  console.log(`[Music] Single track: ${result.tracks[0]?.info?.title}`);
  return {
    tracks: [result.tracks[0]],
    playlistName: null,
    sourceNote: null,
  };
}

async function resolveSpotify(player, query, requester) {
  // Try native Spotify support first
  try {
    const result = await player.search({ query }, requester);
    if (result.loadType !== 'error' && result.loadType !== 'empty' && result.tracks.length > 0) {
      if (result.loadType === 'playlist') {
        return {
          tracks: result.tracks,
          playlistName: result.playlist?.name || 'Spotify Playlist',
          sourceNote: null,
        };
      }
      return {
        tracks: [result.tracks[0]],
        playlistName: null,
        sourceNote: null,
      };
    }
  } catch {
    // Fall through to YouTube Music fallback
  }

  // Fallback: scrape Spotify metadata and search on YouTube Music
  let resolved;
  try {
    resolved = await resolveSpotifyToQueries(query);
  } catch (err) {
    throw new Error(`Couldn't resolve that Spotify link: ${err.message}`);
  }

  const queries = resolved.queries.slice(0, MAX_FALLBACK_PLAYLIST_TRACKS);
  const tracks = [];

  for (const q of queries) {
    try {
      let searchResult = await player.search({ query: q, source: 'ytmsearch' }, requester);
      if (searchResult.tracks.length === 0) {
        searchResult = await player.search({ query: q, source: 'ytsearch' }, requester);
      }
      if (searchResult.tracks.length > 0) {
        tracks.push(searchResult.tracks[0]);
      }
    } catch {
      // Skip failed tracks
    }
  }

  if (tracks.length === 0) {
    throw new Error('Found the Spotify link, but couldn\'t match any tracks.');
  }

  return {
    tracks,
    playlistName: resolved.kind === 'track' ? null : resolved.name,
    sourceNote: resolved.kind === 'track' ? null : `Matched ${tracks.length}/${queries.length} tracks via YouTube Music.`,
  };
}

module.exports = { resolveQuery };
