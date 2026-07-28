/**
 * commands/moderation/lock.js
 * /lock [channel:#channel] [reason:<text>]
 * Prevents @everyone from sending messages in a channel (keeps existing
 * per-role/per-user overwrites intact — only touches @everyone's Send
 * Messages permission).
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { sendModLog } = require('../../handlers/modLogger');

module.exports = {
  cooldown: 5, // permission-overwrite edits are rate-limit sensitive
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel so @everyone cannot send messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Channel to lock (defaults to the current channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for locking').setMaxLength(512),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    const everyone = interaction.guild.roles.everyone;
    const current = channel.permissionOverwrites.cache.get(everyone.id);

    if (current?.deny.has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({ embeds: [err(`${channel} is already locked.`)], ephemeral: true });
    }

    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: false }, {
        reason: `${reason} | By: ${interaction.user.tag}`,
      });
    } catch (e) {
      return interaction.reply({ embeds: [err(`Failed to lock: ${e.message}`)], ephemeral: true });
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`🔒 ${channel} has been **locked**. Only members with an explicit override can send messages.`)
          .setTimestamp(),
      ],
    });

    await sendModLog(interaction.guild, {
      action: 'lock',
      target: { id: channel.id, tag: `#${channel.name}` },
      moderator: interaction.user,
      reason,
    });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
