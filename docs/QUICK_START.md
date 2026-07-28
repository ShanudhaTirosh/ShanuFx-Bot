# 🚀 Quick Start Guide

Get your Discord bot up and running in minutes!

## Prerequisites Check

✅ Node.js 22.5+ installed
✅ Docker Desktop installed and running
✅ Discord Developer account

## Step 1: Configure Discord Bot (5 minutes)

1. **Go to** https://discord.com/developers/applications
2. **Create** a new application
3. **Get credentials:**
   - Bot Token (Bot section → Reset Token)
   - Client ID (General Information)
   - Client Secret (OAuth2 section)
4. **Enable intents** (Bot section):
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. **Add redirect** (OAuth2 section):
   - Add: `http://localhost:3000/auth/callback`

## Step 2: Configure .env File

Open `.env` and fill in:

```env
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=generate_with_command_below
```

**Generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 3: Start Everything (1 minute)

### Option A: Windows Quick Start (Easiest)

**Double-click these files in order:**

1. `start-bot.bat` 
   - Installs dependencies
   - Starts Lavalink
   - Starts bot
   
2. `start-dashboard.bat` (optional)
   - Opens dashboard on http://localhost:3000

3. `deploy-commands.bat`
   - Deploys slash commands to Discord

### Option B: Manual Start

```bash
# Install dependencies
npm install

# Start Lavalink
docker compose up lavalink -d

# Deploy commands (replace with your server ID)
npm run deploy:guild -- YOUR_SERVER_ID

# Start bot
npm start

# In another terminal - start dashboard (optional)
npm run dashboard
```

## Step 4: Invite Bot to Server

Use this URL (replace YOUR_CLIENT_ID):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=1099783210054&scope=bot%20applications.commands
```

Or get it from: http://localhost:3000 → "Add to Server"

## Step 5: Test It! 🎵

In your Discord server, try:

```
/help
/play query:never gonna give you up
/play query:https://open.spotify.com/playlist/4HCXphcprM1q7yOv2gmUem
/serverinfo
```

## Dashboard Access

Visit: http://localhost:3000

Configure:
- 👋 Welcome/goodbye messages
- 🎭 Auto-role
- 🛡️ Anti-spam
- 🤖 **Bot Status** (NEW!)
- ⌨️ Prefix commands
- ⚙️ Warning escalation

## Common Commands

### Music
```
/play query:song name or URL
/queue                  - Show queue
/skip                   - Skip current song
/stop                   - Stop playback
/pause / /resume        - Pause/resume
/volume 50              - Set volume
/247                    - Toggle 24/7 mode
```

### Moderation
```
/kick @user [reason]
/ban @user [reason]
/mute add @user 60 [reason]
/warn @user reason
/warnings view @user
/purge 50 [@user]
```

### Setup
```
/setwelcome set #channel message
/setbye set #channel message
/setlogs set #channel
/setautorole set @role
/antispam on
```

## Supported URLs

### Spotify (Works without credentials!)
- Tracks: `https://open.spotify.com/track/...`
- Playlists: `https://open.spotify.com/playlist/...`
- Albums: `https://open.spotify.com/album/...`

### YouTube
- Videos: `https://www.youtube.com/watch?v=...`
- Playlists: `https://www.youtube.com/playlist?list=...`
- Short URLs: `https://youtu.be/...`

### Others
- SoundCloud links
- Direct MP3/audio URLs
- Search queries

## Troubleshooting

### Bot won't start
- Check `.env` has correct TOKEN and CLIENT_ID
- Check Docker Desktop is running
- Check intents are enabled in Discord Developer Portal

### "No music server is currently reachable"
```bash
docker compose restart lavalink
# Wait 30 seconds, then try again
```

### Dashboard login fails
- Check `SESSION_SECRET` is set (32+ characters)
- Check `DISCORD_CLIENT_SECRET` is correct
- Check redirect URI is added in Discord Developer Portal

### Commands not appearing
```bash
# Re-deploy commands
npm run deploy:guild -- YOUR_SERVER_ID
# Wait a few seconds, then restart Discord
```

## Stop Everything

**Double-click:** `stop-all.bat`

Or manually:
```bash
docker compose down
# Press Ctrl+C in bot terminal
```

## Next Steps

📖 **Full documentation:** See `SETUP_GUIDE.md`

🎵 **Music setup:** See `docs/MUSIC_SETUP.md`

🚢 **Production deployment:** See `docs/DEPLOYMENT.md`

🐛 **Bug reports:** See `docs/BUG_AUDIT.md`

## Need Help?

Check these files:
- `SETUP_GUIDE.md` - Complete setup instructions
- `UPDATES_AND_FIXES.md` - What's new and changed
- `README.md` - Full feature documentation
- `docs/` folder - Detailed guides

## Quick Reference

| Action | Windows | Manual |
|--------|---------|--------|
| Start bot | `start-bot.bat` | `npm start` |
| Start dashboard | `start-dashboard.bat` | `npm run dashboard` |
| Deploy commands | `deploy-commands.bat` | `npm run deploy:guild -- ID` |
| Stop all | `stop-all.bat` | `docker compose down` |
| Restart Lavalink | - | `docker compose restart lavalink` |
| View logs | - | `docker compose logs -f` |

---

**That's it!** Your bot should now be running. 🎉

Test with `/play` and configure settings at http://localhost:3000

Enjoy! 🤖🎵
