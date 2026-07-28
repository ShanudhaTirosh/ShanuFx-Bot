/**
 * utils/validateEnv.js
 * Shared startup validation for every entry point (index.js, shard.js,
 * deploy-commands.js, web/server.js). Previously each file duplicated its
 * own ad-hoc "is it set?" check — centralizing it means every entry point
 * gets the same, stronger checks: not just presence, but catching the very
 * common misconfiguration of leaving a placeholder value from .env.example
 * in place, and (for secrets) a minimum-strength check.
 */

const PLACEHOLDER_MARKERS = ['your_', '_here', 'changeme', 'change_this', 'change this'];

function looksLikePlaceholder(value) {
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some(marker => lower.includes(marker));
}

/**
 * @param {string[]} requiredKeys - env var names that must be set
 * @param {object} [opts]
 * @param {string} [opts.label] - log prefix, e.g. 'Boot' / 'Dashboard'
 * @param {Record<string, number>} [opts.minLength] - per-key minimum string length (e.g. secrets)
 * @param {boolean} [opts.exitOnFailure] - process.exit(1) on failure (default true)
 * @returns {boolean} whether validation passed
 */
function validateEnv(requiredKeys, { label = 'Boot', minLength = {}, exitOnFailure = true } = {}) {
  const missing = [];
  const placeholders = [];
  const tooWeak = [];

  for (const key of requiredKeys) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
      continue;
    }
    if (looksLikePlaceholder(value)) {
      placeholders.push(key);
      continue;
    }
    if (minLength[key] && value.length < minLength[key]) {
      tooWeak.push(`${key} (needs >= ${minLength[key]} chars, got ${value.length})`);
    }
  }

  if (missing.length === 0 && placeholders.length === 0 && tooWeak.length === 0) return true;

  if (missing.length) {
    console.error(`[${label}] ERROR: missing required env var(s): ${missing.join(', ')}`);
  }
  if (placeholders.length) {
    console.error(
      `[${label}] ERROR: these still look like unedited placeholder values from .env.example: ${placeholders.join(', ')}`,
    );
  }
  if (tooWeak.length) {
    console.error(`[${label}] ERROR: these secrets are too short/weak: ${tooWeak.join(', ')}`);
    console.error(`[${label}] Generate a strong one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`);
  }
  console.error(`[${label}] See .env.example for what to set.`);

  if (exitOnFailure) process.exit(1);
  return false;
}

/**
 * Best-effort redaction for anything logged that might contain a secret
 * (e.g. an HTTP client's dumped request config, which can include auth
 * headers). Not a substitute for not logging secrets in the first place —
 * just a safety net for the "some error object serializes the whole
 * request" case.
 */
function redact(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/Bot\s+[\w-]{20,}\.[\w-]{6,}\.[\w-]{20,}/gi, 'Bot [REDACTED]')
    .replace(/Bearer\s+[\w-]{15,}/gi, 'Bearer [REDACTED]')
    .replace(new RegExp(escapeRegExp(process.env.TOKEN ?? '\u0000no-token-set'), 'g'), '[REDACTED_TOKEN]')
    .replace(new RegExp(escapeRegExp(process.env.DISCORD_CLIENT_SECRET ?? '\u0000no-secret-set'), 'g'), '[REDACTED_SECRET]')
    .replace(new RegExp(escapeRegExp(process.env.SESSION_SECRET ?? '\u0000no-session-secret-set'), 'g'), '[REDACTED_SESSION_SECRET]');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { validateEnv, looksLikePlaceholder, redact };
