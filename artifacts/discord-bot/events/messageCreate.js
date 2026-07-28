/**
 * events/messageCreate.js
 * Anti-spam engine — runs on every message in a guild.
 *
 * Detections:
 *   1. Message flood  — too many messages within the configured time window
 *   2. Duplicate spam — same content sent 3+ times consecutively
 *   3. Mass mentions  — more than 5 unique user pings in one message
 *   4. Invite links   — discord.gg/... (togglable via /antispam invites)
 *
 * Actions: warn | mute (10-min timeout) | kick — every triggered action is
 * persisted via modLogger's sendModLog (same case-history table as manual
 * moderation), so auto-actions show up in `/warnings`-adjacent tooling and
 * the web dashboard's case history exactly like a human moderator's would.
 */

const { EmbedBuilder } = require('discord.js');
const { getConfig, getPrefix } = require('../handlers/configHandler');
const { sendModLog }   = require('../handlers/modLogger');
const { checkAndStart } = require('../handlers/cooldownHandler');
const { tokenize, parseArgs, buildAdapter, UsageError } = require('../handlers/messageCommandAdapter');
const { formatUsage } = require('../handlers/prefixHelp');

// ─── In-memory spam tracker ───────────────────────────────────────────────────
// Structure: Map<guildId, Map<userId, { timestamps: number[], recent: string[], lastSeen: number }>>
//
// NOTE: this is per-process, in-memory state. It resets on restart and is
// NOT shared across shards if this bot is later sharded — fine for a single
// process, but if you move to ShardingManager, move this to Redis so all
// shards see the same counters (a user could otherwise dodge detection by
// having messages land on different shards, though in practice a guild's
// messages always route through the same shard, so this only matters for
// cross-guild rate limiting, which this bot doesn't do).
const spamMap   = new Map();
const INVITE_RE = /discord(?:\.gg|app\.com\/invite|\.com\/invite)\/[\w-]+/i;

// Sweep stale per-user trackers periodically so memory doesn't grow forever
// as more users talk across more guilds. A tracker is stale if nobody has
// touched it in 10 minutes — comfortably longer than any antispam window.
const STALE_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [guildId, guildMap] of spamMap) {
    for (const [userId, data] of guildMap) {
      if (now - (data.lastSeen ?? 0) > STALE_MS) guildMap.delete(userId);
    }
    if (guildMap.size === 0) spamMap.delete(guildId);
  }
}, 5 * 60 * 1000).unref();

module.exports = {
  name: 'messageCreate',
  once: false,

  /**
   * @param {import('discord.js').Message} message
   */
  async execute(message) {
    // Ignore bots, DMs, and system messages
    if (message.author.bot || !message.guild || !message.member) return;

    // ── Text-prefix commands (".ban @user ...", alongside "/ban") ─────────
    // Handled first and returns early on any match/attempt, so a prefix
    // command's own message is never also run back through anti-spam.
    if (await tryHandlePrefixCommand(message)) return;

    const config = getConfig(message.guild.id);
    if (!config.antispam.enabled) return;

    // Moderators (ManageMessages) are exempt from anti-spam
    if (message.member.permissions.has('ManageMessages')) return;

    const { limit, window: windowSecs, action, blockInvites } = config.antispam;
    const now     = Date.now();
    const guildId = message.guild.id;
    const userId  = message.author.id;

    // ── Initialise tracker ────────────────────────────────────────────────
    if (!spamMap.has(guildId)) spamMap.set(guildId, new Map());
    const guildMap = spamMap.get(guildId);
    if (!guildMap.has(userId)) guildMap.set(userId, { timestamps: [], recent: [], lastSeen: now });
    const userData = guildMap.get(userId);
    userData.lastSeen = now;

    // Purge timestamps outside the rolling window
    const windowMs = windowSecs * 1000;
    userData.timestamps = userData.timestamps.filter(t => now - t < windowMs);
    userData.timestamps.push(now);

    // Keep the last 3 messages for duplicate detection
    userData.recent.push(message.content.trim());
    if (userData.recent.length > 3) userData.recent.shift();

    // ── Run detections ────────────────────────────────────────────────────
    let triggered = false;
    let spamReason = '';

    // 1. Flood
    if (!triggered && userData.timestamps.length >= limit) {
      triggered  = true;
      spamReason = `Message flood — ${userData.timestamps.length} messages in ${windowSecs}s`;
    }

    // 2. Duplicate messages (same non-empty content 3× in a row)
    if (!triggered && userData.recent.length === 3) {
      const [a, b, c] = userData.recent;
      if (a.length > 0 && a === b && b === c) {
        triggered  = true;
        spamReason = 'Repeated identical messages (3× in a row)';
      }
    }

    // 3. Mass user mentions (>5 unique user pings; ignores @everyone/@here)
    if (!triggered && message.mentions.users.size > 5) {
      triggered  = true;
      spamReason = `Mass mentions — ${message.mentions.users.size} user pings in one message`;
    }

    // 4. Discord invite link
    if (!triggered && blockInvites && INVITE_RE.test(message.content)) {
      triggered  = true;
      spamReason = 'Discord invite link posted';
    }

    if (!triggered) return;

    // ── Reset tracker for this user ───────────────────────────────────────
    guildMap.set(userId, { timestamps: [], recent: [], lastSeen: now });

    // ── Delete the offending message ──────────────────────────────────────
    try { await message.delete(); } catch { /* Already deleted or missing perms */ }

    // ── Execute configured action ─────────────────────────────────────────
    await runAction(message, action, spamReason);
  },
};

// ─── Prefix-command router ──────────────────────────────────────────────────
/**
 * Detects and runs text-prefix commands (default ".", configurable per
 * guild via /setprefix; the bot mention also always works as a prefix,
 * e.g. "@BotName play believer"). Every command in commands/** already
 * works here unmodified — see handlers/messageCommandAdapter.js.
 *
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>} true if this message was a command
 *   attempt (matched a prefix), whether or not it succeeded — the caller
 *   uses this to skip anti-spam processing for that message either way.
 */
async function tryHandlePrefixCommand(message) {
  const { value: prefix, enabled } = getPrefix(message.guild.id);
  if (!enabled) return false;

  const mentionRe = new RegExp(`^<@!?${message.client.user.id}>\\s*`);
  let rest = null;

  if (mentionRe.test(message.content)) {
    rest = message.content.replace(mentionRe, '');
  } else if (prefix && message.content.startsWith(prefix)) {
    rest = message.content.slice(prefix.length);
  }

  if (rest === null) return false;
  rest = rest.trim();
  if (!rest) return false;

  const tokens = tokenize(rest);
  const commandName = tokens.shift()?.toLowerCase();
  if (!commandName) return false;

  const command = message.client.commands.get(commandName);
  if (!command) return false; // not a recognized command — treat as a normal message, not an "attempt"

  // ── Permission gate ─────────────────────────────────────────────────────
  // Slash commands get this enforced by Discord itself before the
  // interaction ever reaches the bot; prefix commands need it checked here.
  const requiredPerms = command.data.default_member_permissions
    ?? command.data.toJSON?.().default_member_permissions;
  if (requiredPerms !== null && requiredPerms !== undefined) {
    if (!message.member.permissions.has(BigInt(requiredPerms))) {
      await message.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ You don't have permission to use this command.")],
        allowedMentions: { repliedUser: false },
      }).catch(() => {});
      return true;
    }
  }

  // ── Cooldown ─────────────────────────────────────────────────────────────
  const { onCooldown, remainingMs } = checkAndStart(command, message.author.id, message.guild.id);
  if (onCooldown) {
    await message.reply({
      embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription(`⏳ Slow down — try \`${prefix}${commandName}\` again in **${Math.ceil(remainingMs / 1000)}s**.`)],
      allowedMentions: { repliedUser: false },
    }).catch(() => {});
    return true;
  }

  // ── Parse args against the command's own slash-option schema ───────────
  const optionDefs = command.data.toJSON().options ?? [];
  let parsed;
  try {
    parsed = await parseArgs(message, tokens, optionDefs);
  } catch (err) {
    if (err instanceof UsageError) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFEE75C)
            .setDescription(`❌ ${err.message}\n\n**Usage:** \`${formatUsage(command, prefix)}\``),
        ],
        allowedMentions: { repliedUser: false },
      }).catch(() => {});
      return true;
    }
    console.error(`[PrefixCommands] Error parsing args for ${prefix}${commandName}:`, err);
    await message.reply({ content: '❌ Something went wrong reading that command\'s arguments.', allowedMentions: { repliedUser: false } }).catch(() => {});
    return true;
  }

  const adapter = buildAdapter(message, command, parsed);

  try {
    await command.execute(adapter);
  } catch (err) {
    console.error(`[PrefixCommands] Error in ${prefix}${commandName}:`, err);
    const errorEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('❌ Command Error')
      .setDescription('An unexpected error occurred while running this command.\nPlease try again later.')
      .setTimestamp();
    if (adapter.replied || adapter.deferred) {
      await adapter.followUp({ embeds: [errorEmbed] }).catch(() => {});
    } else {
      await message.reply({ embeds: [errorEmbed], allowedMentions: { repliedUser: false } }).catch(() => {});
    }
  }

  return true;
}

// ─── Action runner ────────────────────────────────────────────────────────────
async function runAction(message, action, reason) {
  const { member, guild } = message;
  let applied = true; // whether the action actually happened, vs. blocked by permissions

  switch (action) {
    // ── WARN ──────────────────────────────────────────────────────────────
    case 'warn': {
      try {
        await member.user.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFEE75C)
              .setTitle('⚠️ Anti-Spam Warning')
              .setDescription(
                `You triggered the anti-spam system in **${guild.name}**.\n**Reason:** ${reason}`,
              )
              .setTimestamp(),
          ],
        });
      } catch { /* DMs disabled — not fatal, the warning itself still "happened" */ }
      break;
    }

    // ── MUTE (10-min Discord timeout) ─────────────────────────────────────
    case 'mute': {
      if (!member.moderatable) { applied = false; break; }
      try {
        await member.timeout(10 * 60 * 1000, `Anti-spam: ${reason}`);
        await member.user.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('🔇 You have been timed out')
              .setDescription(
                `You have been muted in **${guild.name}** for **10 minutes**.\n**Reason:** ${reason}`,
              )
              .setTimestamp(),
          ],
        }).catch(() => {});
      } catch (err) {
        applied = false;
        console.error(`[AntiSpam] Timeout failed: ${err.message}`);
      }
      break;
    }

    // ── KICK ──────────────────────────────────────────────────────────────
    case 'kick': {
      if (!member.kickable) { applied = false; break; }
      try {
        await member.user.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('👢 You have been kicked')
              .setDescription(
                `You were kicked from **${guild.name}** by the anti-spam system.\n**Reason:** ${reason}`,
              )
              .setTimestamp(),
          ],
        }).catch(() => {});
        await member.kick(`Anti-spam: ${reason}`);
      } catch (err) {
        applied = false;
        console.error(`[AntiSpam] Kick failed: ${err.message}`);
      }
      break;
    }

    default:
      break;
  }

  // ── Persist + log (same case-history system as manual mod actions) ────
  // Log truthfully: if the escalated action (mute/kick) couldn't actually be
  // applied because the bot lacks permission/role hierarchy, don't record a
  // case claiming it happened — record it as the message-deletion-only
  // outcome that it actually was.
  await sendModLog(guild, {
    action: applied ? action : 'warn',
    target: member.user,
    moderator: guild.client.user,
    reason: applied ? `Anti-spam: ${reason}` : `Anti-spam: ${reason} (message deleted only — bot lacked permission to ${action})`,
    extra: [{ name: '🤖 Trigger', value: 'Anti-spam system', inline: true }],
  });
}
