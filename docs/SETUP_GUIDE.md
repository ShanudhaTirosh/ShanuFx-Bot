# Complete Setup Guide - Discord Management Bot with Music

This guide will help you set up the Discord bot with all features including:
- ✅ Local Lavalink server (Docker)
- ✅ Spotify playlist support (keyless fallback + optional native)
- ✅ YouTube playlist & search support
- ✅ Web dashboard with bot status customization
- ✅ Private or public bot configuration

## Prerequisites

- **Node.js 22.5+** (for built-in SQLite support)
- **Docker Desktop** (already installed on your system)
- **Discord Developer Account** (https://discord.com/developers)

## Step 1: Discord Bot Setup

### 1.1 Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name your bot and click "Create"
4. Go to "Bot" section:
   - Click "Reset Token" and save it (you'll need this for `.env`)
   - Enable these **Privileged Gateway Intents**:
     - ✅ Server Members Intent
     - ✅ Message Content Intent
5. Go to "OAuth2" section:
   - Copy your "Client ID" and "Client Secret"
   - Add redirect URL: `http://localhost:3000/auth/callback`

### 1.2 Configure Environment

1. Open the `.env` file in the project root
2. Replace these values:

```env
# REQUIRED - Bot Credentials
TOKEN=paste_your_bot_token_here
CLIENT_ID=paste_your_client_id_here

# REQUIRED - Dashboard OAuth (same as CLIENT_ID above)
DISCORD_CLIENT_ID=paste_your_client_id_here
DISCORD_CLIENT_SECRET=paste_your_client_secret_here
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback

# REQUIRED - Session Security (generate with command below)
SESSION_SECRET=paste_generated_secret_here
```

### 1.3 Generate Session Secret

Run this command to generate a secure session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it into `SESSION_SECRET` in your `.env` file.

## Step 2: Private vs Public Bot Configuration

### For Private Bot (Single Server)

Your `.env` already has this configured:
- `LAVALINK_LOCAL_ENABLED=true` - Uses local Docker Lavalink
- `LAVALINK_ENABLE_PUBLIC_FALLBACK=true` - Backup nodes for reliability

This is perfect for a private bot! No additional configuration needed.

### For Public Bot (Multiple Servers)

If you want your bot to be public:

1. Set up your own hosted Lavalink node (see Step 5)
2. Update `.env`:
```env
LAVALINK_HOST=your.lavalink.domain.com
LAVALINK_PORT=443
LAVALINK_PASSWORD=your_secure_password
LAVALINK_SECURE=true
LAVALINK_LOCAL_ENABLED=false
```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Start Lavalink (Docker)

The bot needs Lavalink running for music commands. We'll use Docker:

```bash
docker compose up lavalink -d
```

This will:
- Download the Lavalink Docker image
- Start Lavalink on `localhost:2333`
- Install YouTube and Spotify plugins automatically
- Keep running in the background

To check if it's working:
```bash
docker compose logs lavalink
```

You should see: `Lavalink is ready to accept connections`

## Step 5: Deploy Slash Commands

Deploy commands to Discord:

### For Testing (Guild/Server Only - Instant)
```bash
npm run deploy:guild -- YOUR_SERVER_ID
```

Replace `YOUR_SERVER_ID` with your Discord server ID:
- Right-click your server icon → Copy Server ID
- (Enable Developer Mode: Settings → Advanced → Developer Mode)

### For Production (Global - Takes up to 1 hour)
```bash
npm run deploy:global
```

## Step 6: Start the Bot

```bash
npm start
```

You should see:
```
─────────────────────────────────────────
  ✅ Bot online: YourBot#1234
  📡 Guilds:     1
  👥 Users:      XX
─────────────────────────────────────────
[Music] ✔ Node "local" connected (localhost:2333)
```

## Step 7: Start the Dashboard (Optional)

In a new terminal:

```bash
npm run dashboard
```

Then visit: http://localhost:3000

- Click "Login with Discord"
- Select your server
- Customize settings including:
  - Welcome/goodbye messages
  - Auto-role
  - Anti-spam
  - **Bot Status** (new feature!)
  - Prefix commands
  - Warning auto-escalation

## Step 8: Invite Bot to Your Server

Generate invite URL:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=1099783210054&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your actual Client ID.

Or visit the dashboard at http://localhost:3000 and click "Add to Server".

## Step 9: Test Music Commands

Try these in your Discord server:

### YouTube
```
/play query:never gonna give you up
/play query:https://www.youtube.com/watch?v=dQw4w9WgXcQ
/play query:https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG
```

### Spotify (Works without any credentials!)
```
/play query:https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
/play query:https://open.spotify.com/playlist/4HCXphcprM1q7yOv2gmUem
/play query:https://open.spotify.com/album/2fenSS68JI1h4Fo296JfGr
```

### Other Commands
```
/queue          - Show current queue
/skip           - Skip current song
/pause          - Pause playback
/resume         - Resume playback
/stop           - Stop and clear queue
/nowplaying     - Current track info
/volume 50      - Set volume
/247            - Toggle 24/7 mode (stays in voice channel)
```

## Optional: Spotify Native Support

For better Spotify metadata (optional):

1. Go to https://developer.spotify.com/dashboard
2. Create a new app (free, no approval needed)
3. Copy Client ID and Client Secret
4. Edit `lavalink/application.yml`:
   - Set `plugins.lavasrc.sources.spotify: true`
   - Add your credentials:
     ```yaml
     spotify:
       clientId: "your_spotify_client_id"
       clientSecret: "your_spotify_client_secret"
     ```
5. Restart Lavalink:
   ```bash
   docker compose restart lavalink
   ```

**Note:** Even without this, Spotify links work fine using the keyless fallback!

## Managing Docker Containers

### View running containers
```bash
docker compose ps
```

### View logs
```bash
docker compose logs -f bot
docker compose logs -f lavalink
docker compose logs -f dashboard
```

### Stop everything
```bash
docker compose down
```

### Start everything
```bash
docker compose up -d
```

### Restart a service
```bash
docker compose restart bot
docker compose restart lavalink
```

## Troubleshooting

### Bot won't start
- Check your `TOKEN` and `CLIENT_ID` in `.env`
- Make sure Privileged Intents are enabled in Discord Developer Portal

### Music commands not working
- Check if Lavalink is running: `docker compose ps`
- Check Lavalink logs: `docker compose logs lavalink`
- Make sure bot is in a voice channel: `/play` requires you to be in voice

### "No music server is currently reachable"
- Restart Lavalink: `docker compose restart lavalink`
- Check `.env` has `LAVALINK_LOCAL_ENABLED=true`
- Wait 30 seconds after starting Lavalink

### Dashboard won't start
- Generate a new `SESSION_SECRET` (see Step 1.3)
- Check `DISCORD_CLIENT_SECRET` in `.env`
- Make sure redirect URI is added in Discord Developer Portal

### YouTube "Sign in to confirm you're not a bot" errors
The current configuration already handles this with multiple YouTube clients. If issues persist:
1. Edit `lavalink/application.yml`
2. Uncomment the OAuth section under `plugins.youtube`
3. Follow the instructions to authenticate
4. Restart Lavalink

## Bot Status Customization

Via Dashboard (http://localhost:3000):
1. Login and select your server
2. Go to "🤖 Bot Status" section
3. Choose:
   - **Status Type:** Online, Idle, DND, or Invisible
   - **Activity Type:** Playing, Streaming, Listening, Watching, or Competing
   - **Activity Text:** Custom text (e.g., "Managing 100 servers")
   - **Streaming URL:** Twitch URL (only for Streaming type)
4. Click "Save changes"

The bot status updates instantly!

## Production Deployment

For production deployment:

1. **Use Docker Compose:**
   ```bash
   docker compose up -d
   ```

2. **Set up environment variables** for production:
   - Use a strong `SESSION_SECRET`
   - Set `NODE_ENV=production`
   - Configure proper Lavalink host

3. **Enable HTTPS** for dashboard (required for production):
   - Use Nginx/Caddy reverse proxy
   - Get SSL certificate (Let's Encrypt)

4. **Monitor logs:**
   ```bash
   docker compose logs -f
   ```

5. **For scaling** (75+ servers), see `docs/DEPLOYMENT.md`

## Support & Documentation

- **Full Documentation:** `README.md`
- **Music Setup:** `docs/MUSIC_SETUP.md`
- **Deployment Guide:** `docs/DEPLOYMENT.md`
- **Bug Reports:** `docs/BUG_AUDIT.md`

## Quick Reference

### Restart Everything
```bash
docker compose restart
```

### Update Bot Code
```bash
git pull
npm install
docker compose restart bot
```

### Backup Database
```bash
cp data/bot.db data/bot.db.backup
```

### View All Commands
In Discord: `/help`

---

**You're all set!** 🎉

Your bot is now running with:
- ✅ Full music support (YouTube, Spotify, SoundCloud)
- ✅ Web dashboard
- ✅ Customizable bot status
- ✅ Moderation commands
- ✅ Anti-spam protection
- ✅ Welcome/goodbye messages
- ✅ Auto-role
- ✅ Logging system

Enjoy your bot! 🤖🎵
