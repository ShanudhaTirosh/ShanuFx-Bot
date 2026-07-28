/**
 * music/spotifyResolve.js
 *
 * "Free Spotify support" without needing a Spotify Developer app.
 *
 * Two paths, depending on which Lavalink node ends up serving the request:
 *
 *   1. If the connected node has the LavaSrc plugin configured with a
 *      Spotify Client ID/Secret (recommended for the primary node — see
 *      docs/MUSIC_SETUP.md), lavalink-client resolves Spotify links
 *      natively via `source: "spsearch"` and this file isn't even
 *      needed for those requests. Actual audio still streams from
 *      YouTube/etc under the hood (Spotify doesn't allow third parties to
 *      stream its audio) — LavaSrc just gets *better* track metadata
 *      and playlist support directly from Spotify's catalog.
 *
 *   2. If the connected node does NOT have LavaSrc/Spotify configured
 *      (true for essentially all free public nodes), `spsearch`/direct
 *      Spotify URL resolution fails. This module is the fallback: it
 *      scrapes Spotify's own public embed page (open.spotify.com/embed/...),
 *      which requires no API key, no login, and no rate-limit-prone OAuth
 *      dance — then hands back plain "song title — artist" strings that
 *      get searched on YouTube Music via the node that IS connected.
 *
 * This is the same approach used by most free/self-hosted music bots,
 * because Spotify's real Web API (which DOES need a Client ID/Secret)
 * still only returns metadata, never playable audio — so there's no
 * loss of capability from skipping official API registration.
 */

const SPOTIFY_URL_RE =
  /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist)\/([a-zA-Z0-9]+)/i;

let spotifyClient = null;
function getClient() {
  if (!spotifyClient) {
    // spotify-url-info wants a fetch implementation injected — Node 22 has
    // a built-in global fetch, but with no timeout of its own, so a slow
    // or hanging request to Spotify would otherwise stall /play forever.
    // Wrap it with a 10s timeout via AbortSignal.
    const timedFetch = (url, opts = {}) => fetch(url, { ...opts, signal: AbortSignal.timeout(10_000) });
    spotifyClient = require('spotify-url-info')(timedFetch);
  }
  return spotifyClient;
}

/**
 * @param {string} query
 * @returns {{ type: 'track'|'album'|'playlist'|'artist', id: string } | null}
 */
function parseSpotifyUrl(query) {
  const match = SPOTIFY_URL_RE.exec(query);
  if (!match) return null;
  return { type: match[1], id: match[2] };
}

function isSpotifyUrl(query) {
  return SPOTIFY_URL_RE.test(query);
}

/**
 * Rebuilds a Spotify URL from just its type + id, dropping any sharing/
 * tracking query params (e.g. `?si=...`) that could otherwise trip up the
 * embed-page scraper or a node's native resolver.
 *
 * @param {string} query
 * @returns {string | null}
 */
function toCanonicalSpotifyUrl(query) {
  const parsed = parseSpotifyUrl(query);
  if (!parsed) return null;
  return `https://open.spotify.com/${parsed.type}/${parsed.id}`;
}

/**
 * Resolves a Spotify URL into an array of plain search query strings
 * (`"Title Artist"`), suitable for feeding into player.search() against
 * whichever Lavalink node is actually connected.
 *
 * @param {string} url
 * @returns {Promise<{ queries: string[], name: string, kind: string }>}
 */
async function resolveSpotifyToQueries(url) {
  const { getPreview, getTracks } = getClient();
  const parsed = parseSpotifyUrl(url);

  if (!parsed) throw new Error('Not a recognizable Spotify URL.');

  // Use a clean canonical URL (no ?si=... or other query params) for the
  // actual scrape — those params sometimes come from mobile share sheets
  // and aren't needed to identify the track/album/playlist.
  const cleanUrl = `https://open.spotify.com/${parsed.type}/${parsed.id}`;

  if (parsed.type === 'track') {
    const preview = await fetchSpotify(() => getPreview(cleanUrl));
    if (!preview?.title) throw new Error('Could not read track metadata from Spotify.');
    return {
      kind: 'track',
      name: preview.title,
      queries: [buildQuery(preview.track ?? preview.title, preview.artist)],
    };
  }

  // Album / playlist — getTracks returns up to the first 100 tracks.
  if (parsed.type === 'album' || parsed.type === 'playlist') {
    const [preview, tracks] = await Promise.all([
      fetchSpotify(() => getPreview(cleanUrl)).catch(() => null),
      fetchSpotify(() => getTracks(cleanUrl)),
    ]);
    if (!tracks || tracks.length === 0) {
      throw new Error('Could not read any tracks from that Spotify link.');
    }
    return {
      kind: parsed.type,
      name: preview?.title ?? (parsed.type === 'album' ? 'Spotify Album' : 'Spotify Playlist'),
      queries: tracks.map(t => buildQuery(t.name, artistNames(t))).filter(Boolean),
    };
  }

  throw new Error('Spotify artist links aren\'t supported — link a track, album, or playlist instead.');
}

/**
 * Normalizes the handful of ways scraping Spotify's embed page can fail
 * into messages that actually help the person using /play, instead of
 * spotify-url-info's internal parser errors leaking through verbatim.
 */
async function fetchSpotify(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      throw new Error('Spotify took too long to respond — try again in a moment.');
    }
    if (/couldn't find any data|not an? (track|album|playlist)/i.test(err.message || '')) {
      throw new Error('That Spotify link looks private, region-locked, or unavailable.');
    }
    throw err;
  }
}

function artistNames(track) {
  if (Array.isArray(track.artists)) return track.artists.map(a => a.name).join(' ');
  return track.artist ?? '';
}

function buildQuery(title, artist) {
  if (!title) return null;
  return artist ? `${title} ${artist}` : title;
}

module.exports = { isSpotifyUrl, parseSpotifyUrl, toCanonicalSpotifyUrl, resolveSpotifyToQueries };
