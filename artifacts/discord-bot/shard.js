/**
 * shard.js
 * Production entry point. Spawns index.js once per shard via discord.js's
 * ShardingManager, so this bot keeps working past the ~2,500-guild mark
 * where Discord requires sharding — without any changes to index.js itself
 * (ShardingManager sets the shard env vars each spawned process reads).
 *
 * For local development or small/self-hosted single-shard use, run
 * index.js directly instead (`npm run start:single` / `npm run dev`) —
 * sharding overhead isn't worth it below a few thousand guilds, and
 * `node --watch` only makes sense against a single process.
 */

require('dotenv').config();
const path = require('path');
const { ShardingManager } = require('discord.js');
const { validateEnv, redact } = require('./utils/validateEnv');

validateEnv(['TOKEN'], { label: 'Sharding' });

const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
  token: process.env.TOKEN,
  totalShards: process.env.SHARD_COUNT ? Number(process.env.SHARD_COUNT) : 'auto',
  respawn: true,
});

manager.on('shardCreate', shard => {
  console.log(`[Sharding] Launching shard ${shard.id}...`);

  shard.on('ready', () => console.log(`[Sharding] Shard ${shard.id} ready.`));
  shard.on('disconnect', () => console.warn(`[Sharding] Shard ${shard.id} disconnected.`));
  shard.on('reconnecting', () => console.warn(`[Sharding] Shard ${shard.id} reconnecting...`));
  shard.on('death', () => console.error(`[Sharding] Shard ${shard.id} died — respawning.`));
});

manager.spawn().catch(err => {
  console.error('[Sharding] Failed to spawn shards:', redact(err?.message ?? String(err)));
  process.exit(1);
});
