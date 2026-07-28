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

    const embed = new EmbedBuilder().setColor(0x1DB954);

    if (playlistName) {
      embed
        .setTitle('📀 Playlist Queued')
        .setDescription(`Added **${tracks.length}** track(s) from **${playlistName}** to the queue.`);
    } else {
      const track = tracks[0];
      embed
        .setTitle('🎵 Queued')
        .setDescription(`[${track.info.title}](${track.info.uri}) — ${track.info.author || 'Unknown'}`)
        .setThumbnail(track.info.artworkUrl ?? null)
        .addFields(
          { name: 'Duration', value: track.info.isStream ? 'LIVE' : formatDuration(track.info.duration), inline: true },
          { name: 'Position in queue', value: player.queue.current === track ? 'Now playing' : String(player.queue.tracks.indexOf(track) + 1), inline: true },
        );
    }

    if (sourceNote) embed.setFooter({ text: sourceNote });

    return interaction.editReply({ embeds: [embed] });
  },
};

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}
