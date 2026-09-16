/**
 * music/lavalinkManager.js
 *
 * Wires up lavalink-client (https://github.com/Tomato6966/lavalink-client)
 * against the nodes from music/nodes.js, and adds the automatic-failover
 * behaviour the bot needs on top of the library's defaults:
 *
 *   - New players always land on whichever *connected* node currently has
 *     the least load (lavalink-client's default `createPlayer` behaviour
 *     when no explicit node is given) — so if the primary node is down
 *     when someone runs /play, they transparently get a fallback node
 *     instead of an error.
 *
 *   - Existing players on a node that disconnects or errors out get
 *     migrated live via player.moveNode() to another connected node,
 *     instead of music just stopping. The channel is told what happened
 *     so it isn't a silent, confusing pause.
 *
 * This file only builds and returns the manager — index.js is responsible
 * for forwarding discord.js's raw gateway events into it and calling
 * `.init()` once the bot is ready (both required by lavalink-client).
 */

const { LavalinkManager } = require('lavalink-client');
const { EmbedBuilder } = require('discord.js');
const { buildNodes } = require('./nodes');
const { onQueueEnd, onActivityResumed } = require('./idleTimers');
const { formatDuration } = require('./format');
const {
  buildTrackEmbed,
  buildControlsRow,
  trackActiveMessage,
  disableActiveControls,
} = require('./nowPlayingEmbed');

/**
 * @param {import('discord.js').Client} client
 * @returns {LavalinkManager}
 */
function createLavalinkManager(client) {
  const manager = new LavalinkManager({
    nodes: buildNodes(),
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
    autoSkip: true,
    client: {
      id: process.env.CLIENT_ID,
      username: 'ShanuFx Music',
    },
    playerOptions: {
      defaultSearchPlatform: 'ytmsearch',
      volumeDecrementer: 1,
      onDisconnect: {
        autoReconnect: false,  // Changed to false to prevent auto-rejoin
        destroyPlayer: true,    // Changed to true to fully destroy player on disconnect
      },
      onEmptyQueue: {
        // Idle-disconnect is handled manually (music/idleTimers.js) instead
        // of via destroyAfterMs here, because that option has no way to
        // check a guild's 24/7 setting before destroying the player.
        destroyAfterMs: undefined,
      },
      useUnresolvedData: true,
    },
    queueOptions: {
      maxPreviousTracks: 25,
    },
    linksAllowed: true,
  });

  // ── Node lifecycle logging + resuming ────────────────────────────────────
  manager.nodeManager.on('connect', node => {
    console.log(`[Music] ✔ Node "${node.id}" connected (${node.options.host}:${node.options.port})`);
    // Keep sessions resumable for 60s across brief reconnects, so a network
    // blip doesn't force every player on that node to restart from scratch.
    node.updateSession(true, 60_000).catch(() => {});
  });

  manager.nodeManager.on('error', (node, error) => {
    console.error(`[Music] ✖ Node "${node.id}" error: ${error?.message ?? error}`);
  });

  manager.nodeManager.on('disconnect', (node, reason) => {
    console.warn(`[Music] ⚠ Node "${node.id}" disconnected: ${reason?.reason ?? reason ?? 'unknown reason'}`);
    failoverPlayersFromNode(client, manager, node.id, 'The music node handling this server went offline');
  });

  manager.nodeManager.on('reconnecting', node => {
    console.warn(`[Music] ↻ Node "${node.id}" reconnecting...`);
  });

  // ── Track / queue notifications ──────────────────────────────────────────
  manager.on('trackStart', async (player, track) => {
    onActivityResumed(player.guildId);

    // The previous now-playing message (if any) is no longer current —
    // freeze its buttons so clicking "skip" on it later can't act on
    // whatever happens to be playing by then.
    await disableActiveControls(client, player.guildId, player);

    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel?.isTextBased()) return;

    try {
      const message = await channel.send({
        embeds: [buildTrackEmbed(client, player, track)],
        components: [buildControlsRow(player)],
      });
      trackActiveMessage(player.guildId, message);
    } catch (err) {
      console.error(`[Music] Failed to send now-playing message in guild ${player.guildId}:`, err.message);
    }
  });

  manager.on('queueEnd', async player => {
    onQueueEnd(player);
    await disableActiveControls(client, player.guildId, null);

    const channel = client.channels.cache.get(player.textChannelId);
    if (channel?.isTextBased()) {
      channel.send({
        embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription('📭 Queue finished — nothing left to play.')],
      }).catch(() => {});
    }
  });

  manager.on('playerDestroy', async player => {
    await disableActiveControls(client, player.guildId, null);
  });

  manager.on('playerDisconnect', player => {
    console.log(`[Music] Player disconnected in guild ${player.guildId}`);
  });

  return manager;
}

/**
 * Moves every active player on a dead/dying node onto another connected
 * node, so a node outage degrades to "brief interruption" instead of
 * "music silently stops and nobody knows why".
 */
function failoverPlayersFromNode(client, manager, deadNodeId, reasonText) {
  const affected = [...manager.players.values()].filter(p => p.node?.id === deadNodeId);
  if (affected.length === 0) return;

  console.warn(`[Music] Migrating ${affected.length} player(s) off node "${deadNodeId}"...`);

  for (const player of affected) {
    player.moveNode()
      .then(newNodeId => {
        console.log(`[Music] Player in guild ${player.guildId} moved to node "${newNodeId}"`);
        const channel = client.channels.cache.get(player.textChannelId);
        if (channel?.isTextBased()) {
          channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFEE75C)
                .setDescription(`🔁 ${reasonText} — switched to a backup server automatically. Playback continues.`),
            ],
          }).catch(() => {});
        }
      })
      .catch(err => {
        console.error(`[Music] Could not fail over player in guild ${player.guildId}: ${err.message}`);
        const channel = client.channels.cache.get(player.textChannelId);
        if (channel?.isTextBased()) {
          channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xED4245)
                .setDescription(`❌ ${reasonText} and no backup music server is currently reachable. Please try \`/play\` again shortly.`),
            ],
          }).catch(() => {});
        }
      });
  }
}

module.exports = { createLavalinkManager, formatDuration };
