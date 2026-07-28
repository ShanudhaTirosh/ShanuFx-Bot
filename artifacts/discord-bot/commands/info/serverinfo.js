/**
 * commands/info/serverinfo.js
 * /serverinfo — Rich embed showing full server statistics.
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');

// Discord verification level labels
const VERIFICATION = ['None', 'Low', 'Medium', 'High', 'Highest'];

// Discord explicit content filter labels
const CONTENT_FILTER = ['Disabled', 'Members without roles', 'All members'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display detailed information about this server')
    .setDMPermission(false),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const { guild } = interaction;

    // ── Fetch full guild data (owner, bans, etc.) ──────────────────────────
    await guild.fetch();

    // ── Member counts ──────────────────────────────────────────────────────
    const totalMembers = guild.memberCount;
    // Use cache for bot/human split — may be partial without GUILD_MEMBERS intent
    const cachedMembers = guild.members.cache;
    const bots   = cachedMembers.filter(m => m.user.bot).size;
    const humans = cachedMembers.filter(m => !m.user.bot).size;

    // ── Channel counts ─────────────────────────────────────────────────────
    const channels   = guild.channels.cache;
    const textCount  = channels.filter(c => c.type === ChannelType.GuildText).size;
    const voiceCount = channels.filter(c =>
      c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice,
    ).size;
    const catCount   = channels.filter(c => c.type === ChannelType.GuildCategory).size;
    const totalChans = channels.size;

    // ── Misc stats ─────────────────────────────────────────────────────────
    const roleCount   = guild.roles.cache.size - 1; // subtract @everyone
    const emojiCount  = guild.emojis.cache.size;
    const boostLevel  = guild.premiumTier;          // 0 | 1 | 2 | 3
    const boostCount  = guild.premiumSubscriptionCount ?? 0;

    // ── Owner ──────────────────────────────────────────────────────────────
    const owner = await guild.fetchOwner().catch(() => null);

    // ── Creation date ──────────────────────────────────────────────────────
    const createdAt = Math.floor(guild.createdTimestamp / 1000);

    // ── Build embed ────────────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📊 ${guild.name}`)
      .setDescription(guild.description ?? '')
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) ?? null)
      .addFields(
        // Row 1
        {
          name:   '👑 Owner',
          value:  owner ? `${owner.user.tag}\n\`${guild.ownerId}\`` : `\`${guild.ownerId}\``,
          inline: true,
        },
        {
          name:   '🆔 Server ID',
          value:  `\`${guild.id}\``,
          inline: true,
        },
        {
          name:   '📅 Created',
          value:  `<t:${createdAt}:D>\n<t:${createdAt}:R>`,
          inline: true,
        },

        // Row 2 — Members
        {
          name:   '👥 Members',
          value:  [
            `**Total** : ${totalMembers.toLocaleString()}`,
            `**Humans**: ${humans > 0 ? humans.toLocaleString() : '—'}`,
            `**Bots**  : ${bots > 0   ? bots.toLocaleString()   : '—'}`,
          ].join('\n'),
          inline: true,
        },

        // Row 2 — Channels
        {
          name:   '📢 Channels',
          value:  [
            `**Total**     : ${totalChans}`,
            `**Text**      : ${textCount}`,
            `**Voice**     : ${voiceCount}`,
            `**Categories**: ${catCount}`,
          ].join('\n'),
          inline: true,
        },

        // Row 2 — Roles / Emoji
        {
          name:   '🎭 Roles & Emoji',
          value:  [
            `**Roles** : ${roleCount}`,
            `**Emojis**: ${emojiCount}`,
          ].join('\n'),
          inline: true,
        },

        // Row 3 — Boosts
        {
          name:   '🚀 Boost Status',
          value:  [
            `**Level** : Tier ${boostLevel}`,
            `**Boosts**: ${boostCount}`,
          ].join('\n'),
          inline: true,
        },

        // Row 3 — Security
        {
          name:   '🔒 Security',
          value:  [
            `**Verification**  : ${VERIFICATION[guild.verificationLevel] ?? 'Unknown'}`,
            `**Content Filter**: ${CONTENT_FILTER[guild.explicitContentFilter] ?? 'Unknown'}`,
          ].join('\n'),
          inline: true,
        },

        // Row 3 — Features
        ...(guild.features.length > 0
          ? [
              {
                name:   '✨ Features',
                value:  guild.features
                  .slice(0, 8)
                  .map(f => `\`${f}\``)
                  .join(', ') + (guild.features.length > 8 ? ` +${guild.features.length - 8} more` : ''),
                inline: false,
              },
            ]
          : []),
      )
      .setImage(guild.bannerURL({ size: 1024 }) ?? null)
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
