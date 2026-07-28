/**
 * music/idleTimers.js
 * Manual idle-disconnect handling (instead of lavalink-client's built-in
 * onEmptyQueue.destroyAfterMs) so we can check each guild's 24/7 setting
 * before actually destroying a player. Two situations trigger a timer:
 *
 *   1. The queue finishes ('queueEnd' event, wired in lavalinkManager.js)
 *   2. Everyone leaves the voice channel except the bot
 *      (events/voiceStateUpdate.js)
 *
 * Either one is cancelled if playback resumes / someone rejoins before it
 * fires, and both are skipped entirely if 24/7 mode is on for that guild.
 */

const { is247Enabled } = require('../handlers/musicSettingsHandler');

const IDLE_QUEUE_END_MS = 2 * 60 * 1000; // leave 2 min after the queue empties
const IDLE_ALONE_MS = 60 * 1000; // leave 1 min after being left alone

const timers = new Map(); // guildId -> Timeout

function clearIdleTimer(guildId) {
  const existing = timers.get(guildId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(guildId);
  }
}

function scheduleIdleDisconnect(player, delayMs, reasonText) {
  const { guildId } = player;
  clearIdleTimer(guildId);

  const timer = setTimeout(async () => {
    timers.delete(guildId);
    if (is247Enabled(guildId)) return; // 24/7 mode — never auto-leave on idle

    const current = player.LavalinkManager.getPlayer(guildId);
    if (!current) return; // already destroyed some other way
    if (current.playing && !current.paused) return; // something started playing again

    console.log(`[Music] Auto-leaving guild ${guildId} (${reasonText}, idle timeout reached)`);
    await current.destroy().catch(() => {});
  }, delayMs);

  timers.set(guildId, timer);
}

function onQueueEnd(player) {
  scheduleIdleDisconnect(player, IDLE_QUEUE_END_MS, 'queue finished');
}

function onAlone(player) {
  scheduleIdleDisconnect(player, IDLE_ALONE_MS, 'left alone in voice channel');
}

function onActivityResumed(guildId) {
  clearIdleTimer(guildId);
}

module.exports = { onQueueEnd, onAlone, onActivityResumed, clearIdleTimer };
