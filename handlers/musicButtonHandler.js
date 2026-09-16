/**
 * handlers/musicButtonHandler.js
 * Handles the ⏯️ ⏭️ ⏹️ 🔀 🔁 button row attached to every now-playing
 * message (see music/nowPlayingEmbed.js). These are global — they aren't
 * tied to a single message's collector — so they keep working no matter
 * how old the message is; disableActiveControls() is what keeps a stale
 * message's buttons from acting on a track that isn't playing anymore.
 */

const { EmbedBuilder } = require('discord.js');
const { requireSameVoiceChannel } = require('../music/voiceChecks');
const { buildTrackEmbed, buildControlsRow } = require('../music/nowPlayingEmbed');
const { buildPageEmbed, buildRow: buildQueueRow } = require('../commands/music/queue');

const LOOP_CYCLE = { off: 'track', track: 'queue', queue: 'off' };

function err(text) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${text}`);
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleMusicButton(interaction) {
  const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
  if (!player) {
    return interaction.reply({ embeds: [err('This player is no longer active.')], ephemeral: true });
  }

  // Anyone can use the queue button (it's read-only); everything else
  // changes playback, so it needs the same "in my voice channel" check
  // the slash commands use.
  if (interaction.customId !== 'music_queue') {
    const sameChannel = requireSameVoiceChannel(interaction, player);
    if (!sameChannel.ok) {
      return interaction.reply({ embeds: [err(sameChannel.reason)], ephemeral: true });
    }
  }

  switch (interaction.customId) {
    case 'music_toggle': {
      if (!player.playing && !player.paused) {
        return interaction.reply({ embeds: [err('Nothing is playing right now.')], ephemeral: true });
      }
      if (player.paused) {
        await player.resume();
      } else {
        await player.pause();
      }
      return refreshNowPlaying(interaction, player);
    }

    case 'music_skip': {
      if (!player.playing && !player.paused) {
        return interaction.reply({ embeds: [err('Nothing is playing right now.')], ephemeral: true });
      }
      const skipped = player.queue.current;
      await player.skip();
      // The trackStart/queueEnd handler sends the next message and disables
      // this one — just acknowledge the click here.
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`⏭️ Skipped **${skipped?.info?.title ?? 'the track'}**.`)],
        ephemeral: true,
      });
    }

    case 'music_stop': {
      await player.destroy();
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⏹️ Stopped playback, cleared the queue, and left the voice channel.')],
      });
    }

    case 'music_shuffle': {
      if (player.queue.tracks.length < 2) {
        return interaction.reply({ embeds: [err('There aren\'t enough tracks queued to shuffle.')], ephemeral: true });
      }
      await player.queue.shuffle();
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`🔀 Shuffled **${player.queue.tracks.length}** track(s).`)],
        ephemeral: true,
      });
    }

    case 'music_loop': {
      if (!player.queue.current) {
        return interaction.reply({ embeds: [err('Nothing is playing right now.')], ephemeral: true });
      }
      const next = LOOP_CYCLE[player.repeatMode] ?? 'off';
      await player.setRepeatMode(next);
      const labels = { off: '➡️ Off', track: '🔂 Track', queue: '🔁 Queue' };
      await refreshNowPlaying(interaction, player, { skipReply: true });
      return interaction.followUp({
        embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`Repeat mode set to **${labels[next]}**.`)],
        ephemeral: true,
      });
    }

    case 'music_queue': {
      if (!player.queue.current && player.queue.tracks.length === 0) {
        return interaction.reply({ embeds: [err('The queue is empty.')], ephemeral: true });
      }
      const totalPages = Math.max(1, Math.ceil(player.queue.tracks.length / 10));
      return interaction.reply({
        embeds: [buildPageEmbed(interaction.client, interaction.guildId, 0, totalPages)],
        components: totalPages > 1 ? [buildQueueRow(0, totalPages)] : [],
        ephemeral: true,
      });
    }

    default:
      return interaction.reply({ embeds: [err('Unknown control.')], ephemeral: true });
  }
}

/**
 * Re-renders the clicked now-playing message in place to reflect the new
 * player state (paused/resumed, loop mode). If the underlying track has
 * moved on since this message was sent, this just reflects whatever is
 * current now rather than erroring — matching how most music bots behave.
 */
async function refreshNowPlaying(interaction, player, { skipReply = false } = {}) {
  const track = player.queue.current;
  if (!track) {
    if (skipReply) return;
    return interaction.update({ components: [] }).catch(() => {});
  }
  const payload = {
    embeds: [buildTrackEmbed(interaction.client, player, track)],
    components: [buildControlsRow(player)],
  };
  if (skipReply) {
    // Caller (music_loop) wants to send its own confirmation as a
    // follow-up, so update the message without consuming the reply slot.
    return interaction.update(payload).catch(() => {});
  }
  return interaction.update(payload);
}

module.exports = { handleMusicButton };
