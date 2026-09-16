/**
 * web/musicControlClient.js
 * Thin wrapper around fetch() calls to the bot process's internal control
 * API (internal/controlServer.js). Every function here can throw a
 * MusicControlError — route handlers should catch that specifically and
 * turn it into a clean JSON error instead of a raw 500.
 */

class MusicControlError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'MusicControlError';
    this.status = status;
  }
}

function baseUrl() {
  const url = process.env.BOT_INTERNAL_URL;
  if (!url) throw new MusicControlError('Dashboard music control is not configured (BOT_INTERNAL_URL is not set).', 501);
  return url.replace(/\/+$/, '');
}

function secret() {
  const s = process.env.INTERNAL_API_SECRET;
  if (!s) throw new MusicControlError('Dashboard music control is not configured (INTERNAL_API_SECRET is not set).', 501);
  return s;
}

async function call(path, { method = 'GET', body } = {}) {
  const url = `${baseUrl()}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secret(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    if (err instanceof MusicControlError) throw err;
    throw new MusicControlError('Could not reach the bot process. Is it running?', 503);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Some responses (e.g. a proxy error page) might not be JSON — fall through with data = null.
  }

  if (!response.ok) {
    throw new MusicControlError(data?.error || `Bot returned ${response.status}.`, response.status >= 500 ? 502 : response.status);
  }
  return data;
}

const getVoiceChannels = guildId => call(`/guilds/${guildId}/voice-channels`);
const getPlayerState = guildId => call(`/guilds/${guildId}/player`);
const resolveTrack = (guildId, query, requester) => call(`/guilds/${guildId}/resolve`, { method: 'POST', body: { query, ...requester } });
const play = (guildId, { query, voiceChannelId, requesterId, requesterTag }) =>
  call(`/guilds/${guildId}/player/play`, { method: 'POST', body: { query, voiceChannelId, requesterId, requesterTag } });
const queuePlaylist = (guildId, { tracks, voiceChannelId, requesterId, requesterTag }) =>
  call(`/guilds/${guildId}/player/queue-playlist`, { method: 'POST', body: { tracks, voiceChannelId, requesterId, requesterTag } });
const sendAction = (guildId, action) => call(`/guilds/${guildId}/player/action`, { method: 'POST', body: { action } });
const setVolume = (guildId, percent) => call(`/guilds/${guildId}/player/volume`, { method: 'POST', body: { percent } });
const setLoop = (guildId, mode) => call(`/guilds/${guildId}/player/loop`, { method: 'POST', body: { mode } });

module.exports = {
  MusicControlError,
  getVoiceChannels,
  getPlayerState,
  resolveTrack,
  play,
  queuePlaylist,
  sendAction,
  setVolume,
  setLoop,
};
