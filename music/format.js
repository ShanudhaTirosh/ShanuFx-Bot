/**
 * music/format.js
 * Tiny formatting helpers shared across music commands and the
 * now-playing embed builder. Kept dependency-free so nothing that needs
 * it risks a circular require.
 */

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

module.exports = { formatDuration };
