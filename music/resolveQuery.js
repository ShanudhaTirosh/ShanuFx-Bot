/**
 * music/resolveQuery.js
 *
 * Turns whatever a user typed into /play into a { tracks, playlistName }
 * result ready to hand to player.queue.add(), regardless of whether the
 * currently-connected Lavalink node has Spotify (LavaSrc) support.
 *
 * Resolution order:
 *   1. Not a Spotify link → straight to player.search() (handles YouTube,
 *      YouTube Music, SoundCloud links, and plain text search terms).
 *   2. Spotify link, node supports it natively → player.search() resolves
 *      it directly via the node's LavaSrc plugin (best case: accurate
 *      metadata straight from Spotify's catalog).
 *   3. Spotify link, node does NOT support it (e.g. a free public
 *      fallback node with no LavaSrc/Spotify credentials) → fall back to
 *      music/spotifyResolve.js's keyless metadata scrape, then search
 *      each resulting "title artist" string on the node via YouTube Music.
 */

const { isSpotifyUrl, resolveSpotifyToQueries } = require('./spotifyResolve');

const MAX_FALLBACK_PLAYLIST_TRACKS = 100; // Increased from 50 to 100

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
  return fromSearchResult(result, query);
}

async function resolveSpotify(player, query, requester) {
  // Try the node's native Spotify support first (LavaSrc) — this is what
  // Shanu's own node should have configured (see docs/MUSIC_SETUP.md), and
  // gives the best metadata + full playlist support in one request.
  try {
    const result = await player.search({ query }, requester);
    if (result.loadType !== 'error' && result.loadType !== 'empty' && result.tracks.length > 0) {
      return fromSearchResult(result, query);
    }
  } catch {
    // Node doesn't support the "spotify" source, or the request otherwise
    // failed — fall through to the keyless metadata fallback below.
  }

  // Fallback: scrape public track/playlist/album metadata from Spotify
  // (no API key needed), then search each track on the connected node.
  let resolved;
  try {
    resolved = await resolveSpotifyToQueries(query);
  } catch (err) {
    throw new Error(`Couldn't resolve that Spotify link: ${err.message}`);
  }

  const queries = resolved.queries.slice(0, MAX_FALLBACK_PLAYLIST_TRACKS);
  const tracks = [];
  const failedTracks = [];

  for (const q of queries) {
    try {
      // Try YouTube Music search first (best for music)
      let searchResult = await player.search({ query: q, source: 'ytmsearch' }, requester);
      
      // If no results, try regular YouTube search as fallback
      if (searchResult.tracks.length === 0) {
        searchResult = await player.search({ query: q, source: 'ytsearch' }, requester);
      }
      
      if (searchResult.tracks.length > 0) {
        tracks.push(searchResult.tracks[0]);
      } else {
        failedTracks.push(q);
      }
    } catch {
      // Skip tracks that fail to resolve individually rather than failing
      // the whole playlist/album import over one bad match.
      failedTracks.push(q);
    }
  }

  if (tracks.length === 0) {
    throw new Error('Found the Spotify link, but couldn\'t match any of its tracks on the connected music server.');
  }

  // Build informative source note
  let sourceNote;
  if (resolved.kind === 'track') {
    sourceNote = 'Matched from Spotify via YouTube Music (this node doesn\'t have direct Spotify support).';
  } else {
    const successCount = tracks.length;
    const totalCount = queries.length;
    const failedCount = failedTracks.length;
    
    let note = `Matched ${successCount}/${totalCount} track(s) from "${resolved.name}" via YouTube Music`;
    
    if (failedCount > 0) {
      note += ` (${failedCount} track(s) couldn't be found)`;
    }
    
    if (resolved.queries.length > queries.length) {
      note += ` (only the first ${MAX_FALLBACK_PLAYLIST_TRACKS} of ${resolved.queries.length} tracks were checked)`;
    }
    
    sourceNote = note + '.';
  }

  return {
    tracks,
    playlistName: resolved.kind === 'track' ? null : resolved.name,
    sourceNote,
  };
}

function fromSearchResult(result, query) {
  if (result.loadType === 'error') {
    throw new Error(result.exception?.message || 'That link/search failed to load.');
  }
  if (result.loadType === 'empty' || result.tracks.length === 0) {
    throw new Error(`No results found for "${query}".`);
  }

  if (result.loadType === 'playlist') {
    return {
      tracks: result.tracks,
      playlistName: result.playlist?.name ?? null,
      sourceNote: null,
    };
  }

  // Check if query is a YouTube playlist/radio URL but was returned as 'track' or 'search'
  // This happens with YouTube Radio/Mix playlists sometimes
  const isYouTubePlaylist = /[?&]list=([^&]+)/.test(query);
  
  if (isYouTubePlaylist && result.tracks.length > 1) {
    // Extract playlist ID from URL
    const playlistMatch = query.match(/[?&]list=([^&]+)/);
    const playlistId = playlistMatch ? playlistMatch[1] : null;
    
    return {
      tracks: result.tracks,
      playlistName: playlistId && playlistId.startsWith('RD') 
        ? 'YouTube Mix' 
        : result.playlist?.name ?? 'YouTube Playlist',
      sourceNote: null,
    };
  }

  // 'track' or 'search' loadType — for a plain search, only queue the
  // top match (matches how every major music bot's /play behaves).
  return { tracks: [result.tracks[0]], playlistName: null, sourceNote: null };
}

module.exports = { resolveQuery };
