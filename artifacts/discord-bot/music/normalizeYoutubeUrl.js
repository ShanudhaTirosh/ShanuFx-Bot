/**
 * music/normalizeYoutubeUrl.js
 *
 * Cleans up YouTube links before handing them to Lavalink:
 *
 *  - Strips YouTube's auto-generated "Radio"/"Mix" playlist param
 *    (list=RD...) plus start_radio/index — these show up when someone
 *    copies a link from the autoplay sidebar (e.g.
 *    ?v=ID&list=RDID&start_radio=1) and, left in, would make the node
 *    try to load YouTube's auto-mix queue (effectively endless) instead
 *    of just the one video the person meant to share.
 *  - Leaves REAL saved playlists alone (list=PL.../UU.../OLAK5uy... etc.)
 *    so playlist links still queue the whole playlist as expected.
 *  - Strips share/tracking-only params (si, feature, pp, ...) that never
 *    affect what gets loaded, just for a cleaner query.
 *  - Anything that isn't a youtube.com/youtu.be URL (including plain
 *    search text and Spotify links) is returned unchanged.
 */

const YOUTUBE_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

const TRACKING_PARAMS = ['si', 'feature', 'pp', 'ab_channel', 'utm_source', 'utm_medium', 'utm_campaign'];

function normalizeYoutubeUrl(query) {
  let url;
  try {
    url = new URL(query);
  } catch {
    return query; // Not a URL — plain search text, leave it alone.
  }

  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return query;

  const listParam = url.searchParams.get('list');
  // Every real saved/auto playlist id (PL, UU uploads, LL likes, WL watch
  // later, FL, OLAK5uy albums, ...) never starts with "RD" — that prefix
  // is reserved for YouTube's dynamically generated Radio/Mix queues.
  if (listParam && listParam.toUpperCase().startsWith('RD')) {
    url.searchParams.delete('list');
    url.searchParams.delete('start_radio');
    url.searchParams.delete('index');
  }

  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param);
  }

  return url.toString();
}

module.exports = { normalizeYoutubeUrl };
