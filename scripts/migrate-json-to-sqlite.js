/**
 * scripts/migrate-json-to-sqlite.js
 *
 * One-time migration for existing self-hosted deployments that still have
 * the old config/{guildId}.json files (from before this bot moved to
 * SQLite). Safe to run multiple times — it upserts, it doesn't duplicate.
 *
 * Usage:
 *   node scripts/migrate-json-to-sqlite.js [path-to-old-config-dir]
 *
 * Defaults to ./config if no path is given.
 */

const fs = require('fs');
const path = require('path');

const legacyDir = process.argv[2] || path.join(__dirname, '..', 'config');

if (!fs.existsSync(legacyDir)) {
  console.log(`[Migrate] No legacy config directory found at ${legacyDir} — nothing to do.`);
  process.exit(0);
}

const { saveConfig, getConfig } = require('../handlers/configHandler');
const { addWarning, getWarnings } = require('../handlers/warningsHandler');

const files = fs.readdirSync(legacyDir).filter(f => f.endsWith('.json'));
console.log(`[Migrate] Found ${files.length} legacy guild config file(s) in ${legacyDir}\n`);

let migratedGuilds = 0;
let migratedWarnings = 0;

for (const file of files) {
  const guildId = path.basename(file, '.json');
  if (!/^\d{17,20}$/.test(guildId)) {
    console.warn(`[Migrate] Skipping ${file} — filename isn't a valid guild id`);
    continue;
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(path.join(legacyDir, file), 'utf-8'));
  } catch (err) {
    console.error(`[Migrate] ✖ Failed to parse ${file}: ${err.message}`);
    continue;
  }

  // Seed a default row, then overwrite with legacy values.
  const config = getConfig(guildId);
  const merged = {
    welcome: { ...config.welcome, ...parsed.welcome },
    bye: { ...config.bye, ...parsed.bye },
    autorole: { ...config.autorole, ...parsed.autorole },
    logs: { ...config.logs, ...parsed.logs },
    antispam: { ...config.antispam, ...parsed.antispam },
  };
  saveConfig(guildId, merged);
  migratedGuilds++;

  // Warnings: parsed.warnings is { userId: [ {reason, date, moderator}, ... ] }
  const existingCount = getWarnings(guildId).length;
  if (existingCount === 0 && parsed.warnings) {
    for (const [userId, warns] of Object.entries(parsed.warnings)) {
      for (const w of warns) {
        addWarning(guildId, userId, w.reason ?? 'No reason provided', {
          id: 'unknown',
          tag: w.moderator ?? 'Unknown',
        });
        migratedWarnings++;
      }
    }
  }

  console.log(`[Migrate] ✔ ${guildId} — config migrated${parsed.warnings ? `, warnings checked` : ''}`);
}

console.log(`\n[Migrate] Done. ${migratedGuilds} guild config(s), ${migratedWarnings} warning(s) migrated.`);
console.log('[Migrate] You can now safely delete the old config/ directory.');
