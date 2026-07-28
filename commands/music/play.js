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

    // Remove the Lavalink check - let it fail naturally if actually offline
    // if (!interaction.client.lavalink.useable) {
    //   return interaction.reply({ embeds: [err('No music server is currently reachable. Please try again in a moment.')], ephemeral: true });
    // }

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
    
    // Check if music is already playing before adding to queue
    const wasPlaying = player.playing || player.paused;
    
    player.queue.add(tracks);

    if (!player.playing && !player.paused) {
      try {
        await player.play();
      } catch (e) {
        return interaction.editReply({ embeds: [err(`Failed to start playback: ${e.message}`)] });
      }
    }

    if (playlistName) {
      // Playlist queued embed
      const playlistEmbed = new EmbedBuilder()
        .setColor(0x57F287) // Green color
        .setDescription(`📀 **Playlist Queued**\n\nAdded **${tracks.length}** track(s) from **${playlistName}** to the queue.`);

      if (sourceNote) {
        playlistEmbed.setFooter({ text: sourceNote });
      }

      return interaction.editReply({ embeds: [playlistEmbed] });
    } else {
      // Single track - only show if adding to queue while music is playing
      if (wasPlaying) {
        const track = tracks[0];
        const queueEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`📀 **Track Queued**\n\nAdded **${track.info.title}** by **${track.info.author || 'Unknown'}** to the queue.`);
        
        return interaction.editReply({ embeds: [queueEmbed] });
      } else {
        // Starting fresh - just acknowledge, trackStart will show "Now Playing"
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription('⏳ Working on it...')] });
      }
    }
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
