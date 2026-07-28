/**
 * commands/music/play.js
 * /play query:<search term, YouTube/SoundCloud link, or Spotify link>
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireVoiceChannel, requireSameVoiceChannel, getActivePlayer } = require('../../music/voiceChecks');
const { resolveQuery } = require('../../music/resolveQuery');
const { formatDuration } = require('../../music/lavalinkManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or playlist (search term, YouTube/SoundCloud link, or Spotify link)')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('query').setDescription('What to play').setRequired(true),
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const query = interaction.options.getString('query');

    if (!interaction.client.lavalink.useable) {
      return interaction.reply({ embeds: [err('No music server is currently reachable. Please try again in a moment.')], ephemeral: true });
    }

    const voiceCheck = requireVoiceChannel(interaction);
    if (!voiceCheck.ok) {
      return interaction.reply({ embeds: [err(voiceCheck.reason)], ephemeral: true });
    }

    let player = getActivePlayer(interaction);
    if (player) {
      const sameChannel = requireSameVoiceChannel(interaction, player);
      if (!sameChannel.ok) {
        return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });
      }
    }

    await interaction.deferReply();

    if (!player) {
      player = interaction.client.lavalink.createPlayer({
        guildId: interaction.guildId,
        voiceChannelId: voiceCheck.voiceChannel.id,
        textChannelId: interaction.channelId,
        selfDeaf: true,
        volume: 100,
      });
    }

    if (!player.connected) {
      try {
        await player.connect();
      } catch (e) {
        return interaction.editReply({ embeds: [err(`Failed to join the voice channel: ${e.message}`)] });
      }
    }

    let resolved;
    try {
      resolved = await resolveQuery(player, query, interaction.user);
    } catch (e) {
      // If this was a freshly-created, still-empty player, tear it back
      // down instead of leaving a silent, useless connection behind.
      if (player.queue.tracks.length === 0 && !player.queue.current) {
        await player.destroy().catch(() => {});
      }
      return interaction.editReply({ embeds: [err(e.message)] });
    }

    const { tracks, playlistName, sourceNote } = resolved;
    player.queue.add(tracks);

    if (!player.playing && !player.paused) {
      try {
        await player.play();
      } catch (e) {
        return interaction.editReply({ embeds: [err(`Failed to start playback: ${e.message}`)] });
      }
    }

    // Determine platform icon and info
    const getPlatformInfo = (track) => {
      const uri = track?.info?.uri || query;
      if (uri.includes('spotify.com')) return { emoji: '🟢', name: 'Spotify', color: 0x1DB954 };
      if (uri.includes('youtube.com') || uri.includes('youtu.be')) return { emoji: '🔴', name: 'YouTube', color: 0xFF0000 };
      if (uri.includes('soundcloud.com')) return { emoji: '🟠', name: 'SoundCloud', color: 0xFF5500 };
      return { emoji: '🎵', name: 'Music', color: 0x5865F2 };
    };

    const platform = getPlatformInfo(tracks[0]);
    const embed = new EmbedBuilder().setColor(platform.color);

    if (playlistName) {
      // Calculate total duration
      const totalDuration = tracks.reduce((sum, track) => sum + (track.info.duration || 0), 0);
      const hours = Math.floor(totalDuration / 3600000);
      const minutes = Math.floor((totalDuration % 3600000) / 60000);
      const seconds = Math.floor((totalDuration % 60000) / 1000);
      const durationStr = hours > 0 
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${minutes}:${String(seconds).padStart(2, '0')}`;
      
      embed
        .setAuthor({ name: '📀 Playlist Added', iconURL: interaction.user.displayAvatarURL() })
        .setTitle(playlistName)
        .setDescription(`┌ **Platform:** ${platform.emoji} ${platform.name}\n├ **Tracks:** ${tracks.length}\n└ **Duration:** ${durationStr}`)
        .setThumbnail(tracks[0]?.info?.artworkUrl ?? null)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
    } else {
      const track = tracks[0];
      const queuePos = player.queue.tracks.indexOf(track);
      const positionText = player.queue.current === track ? '🎵 Now Playing' : `📝 Position ${queuePos + 1} in queue`;
      
      embed
        .setAuthor({ name: '🎵 Added to Queue', iconURL: interaction.user.displayAvatarURL() })
        .setTitle(track.info.title)
        .setURL(track.info.uri || 'https://discord.com')
        .setDescription(`**${track.info.author || 'Unknown Artist'}**`)
        .addFields(
          { name: '⏱️ Duration', value: track.info.isStream ? '🔴 LIVE' : formatDuration(track.info.duration), inline: true },
          { name: '📊 Position', value: positionText, inline: true },
          { name: '🎧 Platform', value: `${platform.emoji} ${platform.name}`, inline: true },
        )
        .setThumbnail(track.info.artworkUrl ?? null)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
    }

    if (sourceNote) embed.addFields({ name: '📝 Note', value: sourceNote, inline: false });

    return interaction.editReply({ embeds: [embed] });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
