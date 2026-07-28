# 🎵 Supported URLs and Formats

This bot supports a wide variety of music sources and URL formats. All you need to do is use `/play query:URL` or `/play query:search term`.

---

## ✅ YouTube

### Direct Videos
```
/play query:https://www.youtube.com/watch?v=dQw4w9WgXcQ
/play query:https://youtu.be/dQw4w9WgXcQ
/play query:https://m.youtube.com/watch?v=dQw4w9WgXcQ
/play query:https://youtube.com/watch?v=dQw4w9WgXcQ
```

### YouTube Playlists
```
/play query:https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG
/play query:https://youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG
```

### YouTube Radio/Mix Playlists ⭐ NEW
These are **fully supported** - the bot will load the entire radio/mix playlist!

```
/play query:https://www.youtube.com/watch?v=tnZrhFN4X9s&list=RDtnZrhFN4X9s&start_radio=1
/play query:https://www.youtube.com/watch?v=VIDEO_ID&list=RDVIDEO_ID
/play query:https://music.youtube.com/watch?v=VIDEO_ID&list=RDAMVMVIDEO_ID
```

**Examples:**
- Radio from video: `https://www.youtube.com/watch?v=tnZrhFN4X9s&list=RDtnZrhFN4X9s&start_radio=1`
- Mix playlist: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ`
- YouTube Music mix: `https://music.youtube.com/watch?v=jNQXAC9IVRw&list=RDAMVMjNQXAC9IVRw`

**What happens:**
- Bot loads the first 50 tracks from the radio/mix
- Creates a continuous playback experience
- Shows "📀 Playlist Queued" with track count

### YouTube Music
```
/play query:https://music.youtube.com/watch?v=VIDEO_ID
/play query:https://music.youtube.com/playlist?list=PLAYLIST_ID
/play query:https://music.youtube.com/browse/MPREb_CHANNEL_ID
```

### YouTube Shorts
```
/play query:https://www.youtube.com/shorts/SHORT_ID
/play query:https://youtube.com/shorts/SHORT_ID
```

### YouTube Search
```
/play query:never gonna give you up
/play query:lofi hip hop radio
/play query:rock music 2024
```

---

## ✅ Spotify

**No credentials needed!** Bot uses keyless fallback automatically.

### Tracks
```
/play query:https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
/play query:https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6
```

### Albums
```
/play query:https://open.spotify.com/album/2fenSS68JI1h4Fo296JfGr
/play query:https://open.spotify.com/album/6DEjYFkNZh67HP7R9PSZvv
```

### Playlists ⭐
```
/play query:https://open.spotify.com/playlist/4HCXphcprM1q7yOv2gmUem
/play query:https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
/play query:https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd
```

### International Spotify Links
```
/play query:https://open.spotify.com/intl-es/track/TRACK_ID
/play query:https://open.spotify.com/intl-pt/playlist/PLAYLIST_ID
```

**How it works:**
1. Bot scrapes public Spotify metadata (no API keys needed)
2. Matches tracks on YouTube Music
3. Loads up to 50 tracks per playlist/album
4. Shows source note: "Matched from Spotify via YouTube Music"

---

## ✅ SoundCloud

### Tracks
```
/play query:https://soundcloud.com/artist/track-name
/play query:https://soundcloud.com/user/sets/playlist-name
```

### Playlists
```
/play query:https://soundcloud.com/user/sets/playlist-name
```

---

## ✅ Apple Music

**Requires Apple Music to be enabled in Lavalink** (already configured!)

### Tracks
```
/play query:https://music.apple.com/us/album/track-name/id123456789
/play query:https://music.apple.com/gb/song/song-name/123456789
```

### Albums
```
/play query:https://music.apple.com/us/album/album-name/1234567890
```

### Playlists
```
/play query:https://music.apple.com/us/playlist/playlist-name/pl.1234567890
```

---

## ✅ Deezer

### Tracks
```
/play query:https://www.deezer.com/track/123456789
/play query:https://deezer.com/us/track/123456789
```

### Albums
```
/play query:https://www.deezer.com/album/123456789
```

### Playlists
```
/play query:https://www.deezer.com/playlist/123456789
```

---

## ✅ Direct Audio URLs

### MP3 Files
```
/play query:https://example.com/audio.mp3
/play query:http://example.com/music/song.mp3
```

### Other Formats
```
/play query:https://example.com/audio.wav
/play query:https://example.com/audio.ogg
/play query:https://example.com/audio.flac
/play query:https://example.com/audio.m4a
```

---

## 🎯 Special Features

### YouTube Radio/Mix Detection

The bot automatically detects and properly handles:
- **Radio playlists** (`list=RDXXXXXX`)
- **Mix playlists** (`list=RDAMVMXXXXXX`)
- **User mixes** (`list=RDMMxxxxxx`)
- **Topic mixes** (`list=RDTMxxxxxx`)

**All radio parameters are preserved:**
- `&start_radio=1` - Start from specific position
- `&index=5` - Start from track 5
- `&t=30s` - Start at timestamp

### Playlist Load Limits

To prevent overload, playlists are limited to:
- **YouTube playlists:** 50 tracks (configurable in `lavalink/application.yml`)
- **Spotify playlists:** 50 tracks (via keyless fallback)
- **SoundCloud sets:** 50 tracks
- **Apple Music playlists:** 50 tracks
- **Deezer playlists:** No limit

**To change limits:** Edit `lavalink/application.yml`:
```yaml
lavalink:
  server:
    youtubePlaylistLoadLimit: 50  # Change this number
```

### Search Queries

The bot uses **YouTube Music search** by default for best music results.

**Examples:**
```
/play query:lofi hip hop beats
/play query:rock songs 2024
/play query:mozart symphony no 40
/play query:rap playlist
/play query:chill vibes
```

**Search tips:**
- Be specific: "lo-fi hip hop beats to study to" works better than "beats"
- Include artist names: "drake one dance" instead of just "one dance"
- Use genres: "rock", "jazz", "classical", "edm"
- Include year for specific versions: "bohemian rhapsody 1975"

---

## 🚫 What's NOT Supported

### Unsupported Platforms
- ❌ Spotify podcasts/audiobooks (music only)
- ❌ Twitter/X audio
- ❌ Facebook videos
- ❌ Instagram videos
- ❌ TikTok audio (not reliable)
- ❌ Bandcamp (not configured by default)

### Unsupported Spotify Features
- ❌ Spotify artist pages (link a specific track/album/playlist instead)
- ❌ Spotify shows/podcasts
- ❌ Spotify audiobooks

### Age-Restricted & Private Content
- ❌ Age-restricted YouTube videos (requires OAuth)
- ❌ Private Spotify playlists
- ❌ Unlisted/private YouTube videos
- ❌ Region-locked content

---

## 🔧 Technical Details

### How Spotify Works (Keyless)

1. **User pastes Spotify URL**
2. **Bot scrapes public metadata** from `open.spotify.com/embed/...`
3. **Extracts track names and artists**
4. **Searches each on YouTube Music**
5. **Queues the matches**

**Advantages:**
- ✅ No Spotify API credentials needed
- ✅ Works immediately after setup
- ✅ No rate limits
- ✅ Supports all public Spotify content

**Limitations:**
- Limited to 50 tracks per playlist (to avoid spam)
- Slightly less accurate than native Spotify API
- Rare cases where track names don't match well

### How YouTube Radio Works

YouTube radio links include a special playlist ID that starts with `RD`:
- `RDXXXXXX` - Regular radio
- `RDAMVMXXXXXX` - Album/song mix
- `RDMMxxxxxx` - My Mix
- `RDTMxxxxxx` - Topic mix

**Lavalink handles these automatically:**
1. Detects the `list=RD` parameter
2. Loads the generated playlist (up to 50 tracks)
3. Queues all tracks
4. Shows as "📀 Playlist Queued"

### YouTube Client Rotation

To avoid "Sign in to confirm you're not a bot" errors, the bot rotates through multiple YouTube clients:

1. **MUSIC** - YouTube Music (best for music)
2. **ANDROID_VR** - Android VR client
3. **WEB** - Standard web client
4. **WEBEMBEDDED** - Embedded player
5. **TVHTML5EMBEDDED** - TV embedded player

If one client is rate-limited, the next one is used automatically.

---

## 📊 Format Priority

When you use `/play` with a URL, this is the resolution order:

1. **Direct URL match** (YouTube, Spotify, SoundCloud, etc.)
2. **Lavalink native support** (if URL is recognized)
3. **Keyless fallback** (for Spotify without credentials)
4. **Search fallback** (if URL parsing fails)

For search queries:
1. **YouTube Music search** (default platform)
2. **First result is queued**

---

## 🎵 Examples for Testing

### Test YouTube Radio
```
/play query:https://www.youtube.com/watch?v=tnZrhFN4X9s&list=RDtnZrhFN4X9s&start_radio=1
```
**Expected:** Loads 50 tracks from the radio playlist

### Test Spotify Playlist
```
/play query:https://open.spotify.com/playlist/4HCXphcprM1q7yOv2gmUem
```
**Expected:** Matches tracks on YouTube Music, loads up to 50

### Test YouTube Playlist
```
/play query:https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG
```
**Expected:** Loads entire playlist (up to 50 tracks)

### Test Search
```
/play query:lo-fi hip hop beats to study to
```
**Expected:** Finds and plays the popular lo-fi stream

### Test Direct MP3
```
/play query:https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3
```
**Expected:** Plays the MP3 file directly

---

## 💡 Pro Tips

### 1. Use YouTube Radio for Discovery
```
/play query:https://www.youtube.com/watch?v=SONG_ID&list=RDSONG_ID
```
Creates a continuous radio based on that song!

### 2. Queue Multiple Sources
```
/play query:spotify playlist
/play query:youtube video
/play query:search term
```
Bot intelligently handles different sources in one queue!

### 3. Search with Quotes for Exact Matches
```
/play query:"artist name - song title"
```
Better accuracy for specific songs.

### 4. Use 24/7 Mode for Continuous Playback
```
/247
```
Bot stays in voice channel and auto-plays next track!

### 5. Check What's Playing
```
/nowplaying
/queue
```
See current track and upcoming tracks.

---

## 🆘 Troubleshooting

### "No results found for [URL]"
**Cause:** URL format not recognized or content unavailable

**Solutions:**
1. Check URL is complete and correct
2. Try removing extra parameters (keep only essential ones)
3. For Spotify: Make sure playlist/track is public
4. For YouTube: Check video isn't private/deleted

### YouTube Radio Not Loading Full Playlist
**Cause:** Playlist load limit reached

**Solution:** Increase limit in `lavalink/application.yml`:
```yaml
youtubePlaylistLoadLimit: 100  # Increase from 50
```

### Spotify Tracks Not Matching Well
**Cause:** Keyless fallback uses search matching

**Solutions:**
1. Add official Spotify credentials (see `COMPLETE_SETUP.md`)
2. Or manually search: `/play query:artist - song name`

### "Age-restricted content"
**Cause:** Video requires age verification

**Solution:** Enable YouTube OAuth (see `lavalink/application.yml` comments)

---

## 📚 More Information

- **Full Setup:** `COMPLETE_SETUP.md`
- **Music System:** `docs/MUSIC_SETUP.md`
- **Lavalink Config:** `lavalink/application.yml`
- **Commands:** `/help` in Discord

---

## ✅ Summary

**Supported:**
- ✅ YouTube (videos, playlists, radio/mix, shorts, search)
- ✅ Spotify (tracks, albums, playlists - no credentials needed!)
- ✅ Apple Music (tracks, albums, playlists)
- ✅ Deezer (tracks, albums, playlists)
- ✅ SoundCloud (tracks, playlists)
- ✅ Direct audio URLs (mp3, wav, ogg, flac, m4a)

**YouTube Radio specifically:**
- ✅ `&list=RD` playlists (radio/mix)
- ✅ `&start_radio=1` parameter
- ✅ Up to 50 tracks per radio playlist
- ✅ Automatic handling and queuing

Just use `/play query:YOUR_URL` and the bot handles the rest!

🎵 **Enjoy your music!**
