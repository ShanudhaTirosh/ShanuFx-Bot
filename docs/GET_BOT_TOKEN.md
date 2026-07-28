# 🔑 How to Get Your Bot Token

## Quick Access Link

**Your Application:** https://discord.com/developers/applications/1506844827554287706

## Step-by-Step Instructions

### 1. Open Discord Developer Portal
Click the link above or go to:
- https://discord.com/developers/applications
- Find your application: **ID 1506844827554287706**

### 2. Get Bot Token

1. Click **"Bot"** in the left sidebar
2. Scroll down to the **"Token"** section
3. Click **"Reset Token"** button
4. Confirm by clicking **"Yes, do it!"**
5. **Copy the token** that appears (you can only see it once!)
6. **Save it somewhere safe** (don't share it with anyone!)

### 3. Enable Privileged Intents

Still on the Bot page, scroll down to **"Privileged Gateway Intents"**:

✅ **Enable these two:**
- [ ] Presence Intent (leave off - not needed)
- [x] **Server Members Intent** ← **ENABLE THIS**
- [x] **Message Content Intent** ← **ENABLE THIS**

Click **"Save Changes"** at the bottom

### 4. Add OAuth Redirect URI

1. Click **"OAuth2"** in the left sidebar
2. Scroll to **"Redirects"** section
3. Click **"Add Redirect"**
4. Enter: `http://localhost:3000/auth/callback`
5. Click **"Save Changes"**

### 5. Update .env File

1. Open `.env` file in your bot folder
2. Find this line:
   ```env
   TOKEN=your_bot_token_here
   ```
3. Replace with your actual token:
   ```env
   TOKEN=YOUR_ACTUAL_BOT_TOKEN_HERE
   ```
   (Your token will be different!)

### 6. Save and You're Done!

The `.env` file now has:
- ✅ TOKEN (you just added)
- ✅ CLIENT_ID (already set: 1506844827554287706)
- ✅ CLIENT_SECRET (already set - keep it secret!)
- ✅ SESSION_SECRET (already generated)

## 🎯 What Your Token Looks Like

A Discord bot token has this format:
```
MTxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- **First part:** Base64 encoded bot ID
- **Second part:** Timestamp
- **Third part:** HMAC signature

It's a long string starting with "MT" followed by dots and random characters.
If your token doesn't follow this general pattern, you copied it wrong!

## ⚠️ Security Warning

**NEVER share your bot token!**

❌ Don't post it on Discord
❌ Don't commit it to GitHub
❌ Don't share it in screenshots
❌ Don't give it to anyone

If someone gets your token, they can:
- Control your bot
- Access all servers it's in
- Send messages as your bot
- Delete data

**If your token is leaked:**
1. Go back to Discord Developer Portal
2. Click "Reset Token" immediately
3. Update `.env` with the new token

## ✅ Checklist

Before starting the bot:
- [ ] Bot token copied from Discord Developer Portal
- [ ] Token pasted into `.env` file (replace `your_bot_token_here`)
- [ ] Server Members Intent enabled
- [ ] Message Content Intent enabled
- [ ] OAuth redirect URI added: `http://localhost:3000/auth/callback`
- [ ] `.env` file saved

## 🚀 Next Steps

Once your token is in `.env`:

1. **Start the bot:**
   - Double-click `start-bot.bat`
   - OR run: `npm start`

2. **Deploy commands:**
   - Double-click `deploy-commands.bat`
   - OR run: `npm run deploy:guild -- YOUR_SERVER_ID`

3. **Invite bot:**
   ```
   https://discord.com/api/oauth2/authorize?client_id=1506844827554287706&permissions=1099783210054&scope=bot%20applications.commands
   ```

4. **Test:**
   ```
   /help
   /play query:never gonna give you up
   ```

## 🐛 Troubleshooting

### "Invalid Token" Error
**Solution:** 
- Go back to Developer Portal
- Reset token again
- Copy the NEW token
- Update `.env` again

### "Privileged intent provided is not enabled"
**Solution:**
- Check Server Members Intent is ON
- Check Message Content Intent is ON
- Save changes in Developer Portal
- Restart the bot

### Can't find application in Developer Portal
**Solution:**
- Make sure you're logged in with the correct Discord account
- Use this direct link: https://discord.com/developers/applications/1506844827554287706

### Token doesn't work after setup
**Solution:**
- Check there are no extra spaces before/after the token in `.env`
- Check the token is on the correct line
- Make sure you saved the `.env` file

## 💡 Pro Tips

1. **Keep `.env` file safe** - It contains all your secrets!

2. **Use .gitignore** - If you use Git, `.env` is already in `.gitignore`

3. **Backup your token** - Save it in a password manager

4. **Test in a private server first** - Create a test server before inviting to your main server

5. **Deploy commands to guild first** - Guild commands update instantly, global takes 1 hour

## 📋 Final .env Example

Your `.env` should look like this (with your actual token):

```env
# Your bot token
TOKEN=YOUR_ACTUAL_BOT_TOKEN_HERE

# Your client ID (already set)
CLIENT_ID=1506844827554287706

# Dashboard OAuth (already set)
DISCORD_CLIENT_ID=1506844827554287706
DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback

# Session secret (already set)
SESSION_SECRET=7e2a40e5251fd95318bda02e455c038aa60f4e82f6c1e495413df7a4d129f98b

# Dashboard port
DASHBOARD_PORT=3000

# Bot permissions
BOT_INVITE_PERMISSIONS=1099783210054

# Lavalink (already configured)
LAVALINK_LOCAL_ENABLED=true
LAVALINK_LOCAL_HOST=localhost
LAVALINK_LOCAL_PORT=2333
LAVALINK_LOCAL_PASSWORD=youshallnotpass
LAVALINK_ENABLE_PUBLIC_FALLBACK=true

# Optional Spotify (leave blank for now)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

## 🎉 Ready to Start!

Once you've added your token, you're all set!

**Next file to read:** `COMPLETE_SETUP.md`

Or just double-click: `start-bot.bat`

Good luck! 🚀
