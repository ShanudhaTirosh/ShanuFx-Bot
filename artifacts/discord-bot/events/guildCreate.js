/**
 * events/guildCreate.js
 * Fires when the bot is added to a new guild.
 * Handles: config initialization, presence refresh, and a "getting started"
 * DM to whoever added the bot (best-effort — many users have DMs closed).
 */

const { EmbedBuilder, ActivityType, AuditLogEvent } = require('discord.js');
const { getConfig } = require('../handlers/configHandler');

module.exports = {
  name: 'guildCreate',
  once: false,

  /**
   * @param {import('discord.js').Guild} guild
   */
  async execute(guild) {
    console.log(`[Guilds] ➕ Joined "${guild.name}" (${guild.id}) — now in ${guild.client.guilds.cache.size} guild(s)`);

    // ── Private bot protection ────────────────────────────────────────────
    // This bot is private — it only stays in guilds listed in
    // ALLOWED_GUILD_IDS (comma-separated guild IDs). Anyone who somehow
    // generates an invite link (e.g. if "Public Bot" ever gets re-enabled
    // in the Discord Developer Portal) gets auto-kicked out instead of
    // silently gaining access to a private bot.
    const allowList = (process.env.ALLOWED_GUILD_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    if (allowList.length > 0 && !allowList.includes(guild.id)) {
      console.warn(`[Guilds] ⛔ "${guild.name}" (${guild.id}) is not in ALLOWED_GUILD_IDS — leaving (this is a private bot).`);
      try {
        const owner = await guild.fetchOwner().catch(() => null);
        if (owner) {
          await owner.send(
            'This bot is private and is not available for other servers. Leaving now.',
          ).catch(() => {});
        }
      } finally {
        await guild.leave().catch(() => {});
      }
      return;
    }

    // Creates the default config row for this guild up front.
    getConfig(guild.id);

    guild.client.user.setPresence({
      activities: [
        {
          name: 'custom',
          state: '🛡️ Protecting shanudatirosh\'s server',
          type: ActivityType.Custom,
        },
      ],
      status: 'online',
    });

    // Best-effort: figure out who added the bot via the audit log, and DM them.
    try {
      const audit = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
      const entry = audit.entries.find(e => e.target?.id === guild.client.user.id);
      const inviter = entry?.executor ?? (await guild.fetchOwner().catch(() => null))?.user;

      if (inviter) {
        await inviter.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle(`👋 Thanks for adding me to ${guild.name}!`)
              .setDescription(
                'Here’s how to get set up:\n\n' +
                '`/setlogs set` — pick a channel for moderation logs\n' +
                '`/setwelcome set` / `/setbye set` — welcome & goodbye messages\n' +
                '`/setautorole set` — auto-role on join\n' +
                '`/antispam on` — enable spam protection\n' +
                '`/help` — see every command\n\n' +
                'All setup commands require the **Manage Server** permission.',
              )
              .setTimestamp(),
          ],
        }).catch(() => { /* DMs disabled — not fatal */ });
      }
    } catch (err) {
      console.warn(`[Guilds] Could not resolve inviter for ${guild.name}: ${err.message}`);
    }
  },
};
