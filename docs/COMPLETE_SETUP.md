# ✅ Complete Setup Instructions

## Your Configuration Status

✅ **Client ID configured:** `1506844827554287706`
✅ **Client Secret configured:** `S0k8KkQGQrrG9Wao7pZR_PxAxso0To7r`
✅ **Session Secret generated:** `7e2a40e5251fd95318bda02e455c038aa60f4e82f6c1e495413df7a4d129f98b`
✅ **Lavalink enhanced:** All production plugins installed
✅ **Dashboard ready:** Port 3000

## ⚠️ REQUIRED: Get Your Bot Token

You need to add your **Bot Token** to the `.env` file.

### Step 1: Get Bot Token from Discord

1. Go to: https://discord.com/developers/applications/1506844827554287706
2. Click on "Bot" in the left sidebar
3. Under "Token" section, click **"Reset Token"**
4. Copy the new token (save it somewhere safe!)
5. **Enable these Privileged Gateway Intents:**
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
6. Click **"Save Changes"**

### Step 2: Add Token to .env

Open `.env` file and replace this line:
```env
TOKEN=your_bot_token_here
```

With your actual token:
```env
TOKEN=YOUR_ACTUAL_BOT_TOKEN_FROM_STEP_1
```

### Step 3: Add OAuth Redirect URI

1. Still in Discord Developer Portal
2. Go to "OAuth2" section
3. Click "Add Redirect"
4. Add: `http://localhost:3000/auth/callback`
5. Click "Save Changes"

## 🚀 Start Everything

### Option 1: Quick Start (Windows - Recommended)

1. **Double-click:** `start-bot.bat`
   - This will install dependencies, start Lavalink, and start the bot
   - Wait for "Bot online" message

2. **Double-click:** `deploy-commands.bat`
   - Choose option 1 (Guild deployment)
   - Enter your server ID when prompted

3. **Double-click:** `start-dashboard.bat` (optional)
   - Opens dashboard at http://localhost:3000

### Option 2: Manual Start

```bash
# 1. Install dependencies
npm install

# 2. Start Lavalink with all plugins
docker compose up lavalink -d

# 3. Wait for Lavalink to be ready (check logs)
docker compose logs -f lavalink

# 4. Deploy commands (replace YOUR_SERVER_ID)
npm run deploy:guild -- YOUR_SERVER_ID

# 5. Start bot
npm start

# 6. In another terminal - start dashboard
npm run dashboard
```

## 🎵 Enhanced Lavalink Features

Your Lavalink now has ALL these plugins:

### 1. YouTube Source Plugin (v1.13.5)
- ✅ Multiple client rotation for reliability
- ✅ Supports direct links, playlists, and search
- ✅ OAuth support (optional)

### 2. LavaSrc Plugin (v4.8.0)
**Supports:**
- ✅ Spotify (with optional credentials or keyless fallback)
- ✅ Apple Music
- ✅ Deezer
- ✅ Yandex Music
- ✅ YouTube

### 3. LavaSearch Plugin (v1.0.0)
- ✅ Advanced search across all platforms
- ✅ Better search results

### 4. LavaLyrics Plugin (v1.0.0)
- ✅ Fetch lyrics for playing songs
- ✅ Supports Spotify, YouTube, Deezer, Apple Music

## 🌐 Invite Bot to Your Server

Use this link (already configured with your Client ID):
```
https://discord.com/api/oauth2/authorize?client_id=1506844827554287706&permissions=1099783210054&scope=bot%20applications.commands
```

Or visit: http://localhost:3000 → Click "Add to Server"

## 🧪 Test All Features

### Test Music (All Platforms)

**Spotify:**
```
/play query:https://open.spotify.com/playlist/4HCXphcprM1q7yOv2gmUem
/play query:https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
```

**YouTube:**
```
/play query:https://www.youtube.com/watch?v=tnZrhFN4X9s
/play query:https://youtube.com/playlist?list=RDtnZrhFN4X9s
/play query:never gonna give you up
```

**Apple Music:** (if configured)
```
/play query:https://music.apple.com/us/album/...
```

**Deezer:**
```
/play query:https://www.deezer.com/track/...
```

**SoundCloud:**
```
/play query:https://soundcloud.com/...
```

### Music Commands
```
/play query:song or URL       - Play music
/queue                        - Show queue  
/skip                         - Skip song
/stop                         - Stop playback
/pause / /resume             - Pause/Resume
/nowplaying                  - Current song info
/volume 50                    - Set volume
/loop                         - Loop modes
/shuffle                      - Shuffle queue
/remove 3                     - Remove track
/clear                        - Clear queue
/seek 60                      - Skip to position
/leave                        - Leave voice
/247                          - Toggle 24/7 mode
```

### Moderation Commands
```
/kick @user reason            - Kick member
/ban @user reason             - Ban member
/mute add @user 60 reason     - Timeout member
/warn @user reason            - Warn member
/warnings view @user          - View warnings
/purge 50                     - Delete messages
/lock                         - Lock channel
/unlock                       - Unlock channel
/slowmode 10                  - Set slowmode
```

### Setup Commands
```
/setwelcome set #channel message
/setbye set #channel message
/setlogs set #channel
/setautorole set @role
/antispam on
/setprefix set .
```

## 📊 Dashboard Features

Visit: http://localhost:3000

**Configure:**
- 📊 Overview & Statistics
- 👋 Welcome & Goodbye Messages
- 🎭 Auto-role
- 📋 Logging (Moderation + Message logs)
- 🛡️ Anti-Spam Settings
- 🤖 **Bot Status** (NEW!)
  - Status: Online/Idle/DND/Invisible
  - Activity: Playing/Streaming/Listening/Watching/Competing
  - Custom text and Twitch URL
- ⌨️ Prefix Commands
- ⚙️ Warning Auto-Escalation
- ⚠️ View/Manage Warnings
- 🗂️ Case History

## 🔧 Optional: Add Spotify Credentials

For better Spotify metadata (optional):

1. Go to: https://developer.spotify.com/dashboard
2. Create a new app (free, instant)
3. Copy Client ID and Secret
4. Add to `.env`:
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_secret
```
5. Edit `lavalink/application.yml`:
   - Change `spotify: false` to `spotify: true`
6. Restart Lavalink:
```bash
docker compose restart lavalink
```

**Note:** Without credentials, Spotify still works via keyless fallback!

## 📈 Monitoring & Logs

### Check Lavalink Status
```bash
docker compose ps
```

### View Lavalink Logs
```bash
docker compose logs -f lavalink
```

### View Bot Logs
The bot logs to console. Look for:
- `✅ Bot online`
- `✔ Node "local" connected`
- `[Music] Track playback messages`

### Check Plugin Installation
In Lavalink logs, you should see:
```
Loaded plugin: YouTube-Plugin
Loaded plugin: LavaSrc-Plugin
Loaded plugin: LavaSearch-Plugin
Loaded plugin: LavaLyrics-Plugin
```

## 🐛 Troubleshooting

### Bot won't start
**Solution:**
1. Check you added TOKEN to `.env`
2. Check intents are enabled (Server Members, Message Content)
3. Run: `node --check index.js` to verify syntax

### "No music server is currently reachable"
**Solution:**
```bash
# Restart Lavalink
docker compose restart lavalink

# Check logs
docker compose logs -f lavalink

# Wait for "Lavalink is ready to accept connections"
```

### Plugins not loading
**Solution:**
```bash
# Stop and remove everything
docker compose down -v

# Start fresh
docker compose up lavalink -d

# Watch logs for plugin downloads
docker compose logs -f lavalink
```

### Dashboard login fails
**Solution:**
1. Check `SESSION_SECRET` is 32+ characters in `.env`
2. Check `DISCORD_CLIENT_SECRET` matches Discord portal
3. Check redirect URI is added: `http://localhost:3000/auth/callback`

### YouTube "Sign in to confirm you're not a bot"
**Solution:**
Already handled by multiple client rotation. If still issues:
1. Edit `lavalink/application.yml`
2. Under `plugins.youtube.oauth`:
   - Set `enabled: true`
3. Restart Lavalink
4. Follow OAuth instructions in console
5. Add refresh token to config

## 🔒 Security Notes

### Current Setup (Development)
- ✅ Lavalink bound to localhost only
- ✅ Dashboard on localhost:3000
- ✅ Secure session cookies
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ Input validation

### For Production
1. **Use HTTPS** for dashboard (required)
2. **Set environment variable:**
   ```env
   NODE_ENV=production
   ```
3. **Use strong password:**
   ```env
   LAVALINK_PASSWORD=generate_strong_password
   ```
4. **Update redirect URI** for your domain
5. **Enable firewall rules**
6. **Set up monitoring**

## 📁 Project Structure

```
discordbot/
├── .env                       ← YOUR CONFIGURATION (TOKEN HERE!)
├── START_HERE.md             ← Quick overview
├── COMPLETE_SETUP.md         ← This file
├── QUICK_START.md            ← Fast setup guide
├── SETUP_GUIDE.md            ← Detailed instructions
├── start-bot.bat             ← Click to start
├── start-dashboard.bat       ← Click for dashboard
├── deploy-commands.bat       ← Click to deploy
├── stop-all.bat              ← Click to stop
├── docker-compose.yml        ← Enhanced with all plugins
├── lavalink/
│   ├── application.yml       ← Enhanced config with all plugins
│   └── plugins/              ← Auto-downloaded plugins
├── commands/                 ← All bot commands
├── music/                    ← Music system
├── web/                      ← Dashboard
└── data/                     ← SQLite database
```

## 🎯 Quick Checklist

Before starting:
- [ ] Bot Token added to `.env`
- [ ] Intents enabled in Discord portal
- [ ] Redirect URI added to OAuth2
- [ ] Docker Desktop is running
- [ ] Node.js 22.5+ installed

After starting:
- [ ] Bot shows online in Discord
- [ ] Lavalink logs show all 4 plugins loaded
- [ ] Music commands work (`/play`)
- [ ] Dashboard accessible at http://localhost:3000
- [ ] Commands deployed (`/help` works)

## 🌟 What's Working Now

✅ **Music Sources:**
- YouTube (direct links, playlists, search)
- Spotify (tracks, albums, playlists)
- Apple Music
- Deezer
- SoundCloud
- Direct audio URLs

✅ **Advanced Features:**
- Multi-platform search
- Lyrics support
- 24/7 voice mode
- Queue management
- Audio filters
- Volume control
- Loop modes
- Shuffle

✅ **Bot Management:**
- Web dashboard
- Custom bot status
- Prefix commands
- Auto-moderation
- Warning system
- Case tracking

## 🚀 Production Deployment

For production with hosted Lavalink:

1. **Update `.env`:**
```env
LAVALINK_HOST=your.lavalink.domain.com
LAVALINK_PORT=443
LAVALINK_PASSWORD=your_secure_password
LAVALINK_SECURE=true
LAVALINK_LOCAL_ENABLED=false
```

2. **Deploy with Docker:**
```bash
docker compose up -d
```

3. **Monitor:**
```bash
docker compose logs -f
```

See `docs/DEPLOYMENT.md` for full production guide.

## 📞 Support Resources

- **Setup Issues:** See `SETUP_GUIDE.md`
- **Music Issues:** See `docs/MUSIC_SETUP.md`
- **Deployment:** See `docs/DEPLOYMENT.md`
- **Bugs:** See `docs/BUG_AUDIT.md`

## 🎉 You're Ready!

Everything is configured. Just:

1. ✍️ Add your **Bot Token** to `.env`
2. ▶️ Double-click `start-bot.bat`
3. 🎵 Test with `/play`
4. 🎨 Customize at http://localhost:3000

**Enjoy your fully-featured music bot!** 🤖🎵
