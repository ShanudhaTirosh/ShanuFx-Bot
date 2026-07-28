# 🤖 New Bot Setup Complete!

**Date**: July 28, 2026
**Status**: ✅ Ready to Configure

---

## ✅ `.env` File Updated

Your `.env` file has been updated with the new bot credentials:

```env
✅ Bot Token: MTUyODMxMzM1MjkwNjk5NzkyMA.GW0OQ7...
✅ Client ID: 1528313352906997920
✅ Client Secret: FSgvZWuEimcaju1yLoDvo5AOxU3HuG_Y
✅ Permissions: Administrator (8)
```

---

## 🔧 **IMPORTANT: Configure Developer Portal**

Before the bot will work, you MUST configure these settings in the Discord Developer Portal:

### **Step 1: Open Your Bot's Developer Portal**
```
https://discord.com/developers/applications/1528313352906997920
```

---

### **Step 2: Enable Required Intents** ⚠️ CRITICAL!

1. Click **"Bot"** in the left sidebar
2. Scroll down to **"Privileged Gateway Intents"**
3. Enable these intents:
   - ✅ **Server Members Intent** ← REQUIRED!
   - ✅ **Message Content Intent** ← REQUIRED!
4. Click **"Save Changes"**

**Without these, the bot will NOT work!**

---

### **Step 3: Enable Guild Install** ⚠️ CRITICAL!

1. Click **"Installation"** in the left sidebar
2. Under **"Installation Contexts"**, enable:
   - ✅ **Guild Install** ← REQUIRED!
   - ✅ **User Install** (optional)
   
3. Under **"Guild Install"** section:
   - **Install Link**: Select **"Discord Provided Link"**
   - **Scopes**: Check ✅ `bot` and ✅ `applications.commands`
   - **Permissions**: Check ✅ `Administrator` (or enter `8`)
   
4. Click **"Save Changes"**

---

### **Step 4: Add OAuth Redirect URI**

1. Click **"OAuth2"** in the left sidebar
2. Click **"General"** sub-tab
3. Scroll to **"Redirects"**
4. Click **"Add Redirect"**
5. Enter: `http://localhost:3000/auth/callback`
6. Click **"Save Changes"**

---

## 🔗 **Your New Bot Invite Links**

### **Administrator Permission (Recommended):**
```
https://discord.com/api/oauth2/authorize?client_id=1528313352906997920&permissions=8&scope=bot%20applications.commands
```

### **Or use Dashboard** (after bot starts):
```
http://localhost:3000/invite
```

---

## 🚀 **Start Your Bot**

After configuring the Developer Portal settings above:

### **Option 1: Quick Start (Windows)**
```bash
start-bot.bat
```

### **Option 2: Manual Start**
```bash
# Start Lavalink
docker-compose up -d

# Start Bot
npm start

# Start Dashboard (new terminal)
npm run dashboard
```

---

## 📋 **Pre-Start Checklist**

Before starting the bot, verify:

- [ ] **Developer Portal Settings:**
  - [ ] Server Members Intent enabled
  - [ ] Message Content Intent enabled
  - [ ] Guild Install enabled
  - [ ] OAuth redirect added: `http://localhost:3000/auth/callback`
  - [ ] Install scopes: `bot` and `applications.commands`
  - [ ] Install permissions: Administrator (8)

- [ ] **Local Setup:**
  - [ ] `.env` file updated with new credentials ✅
  - [ ] Docker Desktop is running
  - [ ] Port 3000 is available
  - [ ] Port 2333 is available (Lavalink)

---

## 🎯 **After Starting**

### **1. Deploy Commands to Your Server**
```bash
deploy-commands.bat
```
Enter your server ID when prompted.

### **2. Invite Bot to Server**
Use the invite link above or click the dashboard invite button.

### **3. Test Commands**
```
/help
/play never gonna give you up
/serverinfo
```

---

## 🔍 **Verification**

### **Check Bot is Online:**
1. Look at Discord - bot should show online
2. Check console - should see "Bot online: [BotName]"
3. No error messages about token

### **Check Lavalink Connected:**
```
Console should show: [Music] ✔ Node "local" connected (localhost:2333)
```

### **Check Dashboard Working:**
```
Open: http://localhost:3000
Should show login page
```

---

## 🆘 **Troubleshooting**

### **Bot Won't Start - "Invalid Token"**
- Token might be wrong or expired
- Go to Developer Portal → Bot → Reset Token
- Copy new token and update `.env`
- Restart bot

### **Bot Starts but Commands Don't Work**
- Intents not enabled in Developer Portal
- Enable Server Members Intent and Message Content Intent
- Restart bot after enabling

### **Can't Invite Bot - "Integration requires code grant"**
- Guild Install not enabled in Developer Portal
- Go to Installation page
- Enable Guild Install
- Wait 2-3 minutes
- Try invite link again

### **Music Not Working**
- Lavalink not running
- Run: `docker-compose up -d`
- Check: `docker ps` (should see lavalink container)

---

## 📊 **Bot Information**

| Setting | Value |
|---------|-------|
| Application ID | `1528313352906997920` |
| Client ID | `1528313352906997920` |
| Permissions | `8` (Administrator) |
| OAuth Scopes | `bot`, `applications.commands` |
| Redirect URI | `http://localhost:3000/auth/callback` |

---

## 🔐 **Security Reminders**

⚠️ **NEVER share these publicly:**
- Bot Token: `MTUyODMxMzM1MjkwNjk5NzkyMA.GW0OQ7...`
- Client Secret: `FSgvZWuEimcaju1yLoDvo5AOxU3HuG_Y`

✅ **Safe to share:**
- Client ID / Application ID: `1528313352906997920`
- Invite links
- Public Key

---

## 📁 **Important Files**

- **`.env`** - Your configuration (UPDATED ✅)
- **`FIX_CODE_GRANT_ERROR.md`** - Guide to fix invite issues
- **`ADMINISTRATOR_INVITE.md`** - Admin permissions guide
- **`docs/COMPLETE_SETUP.md`** - Full setup guide
- **`docs/SUPPORTED_URLS.md`** - Music URL formats

---

## 🎉 **Next Steps**

1. ✅ **Configure Developer Portal** (Steps 2-4 above)
2. ✅ **Start the bot** (`start-bot.bat`)
3. ✅ **Deploy commands** (`deploy-commands.bat`)
4. ✅ **Invite to server** (use invite link)
5. ✅ **Test features** (music, moderation, etc.)
6. ✅ **Configure via dashboard** (http://localhost:3000)

---

## 🔗 **Quick Access Links**

| What | Link |
|------|------|
| Developer Portal | https://discord.com/developers/applications/1528313352906997920 |
| Invite Bot (Admin) | https://discord.com/api/oauth2/authorize?client_id=1528313352906997920&permissions=8&scope=bot%20applications.commands |
| Dashboard | http://localhost:3000 |
| Deploy Commands | `deploy-commands.bat` |

---

**Last Updated**: Just now
**Status**: ✅ Configuration Updated - Ready to Configure Portal
**New Bot ID**: 1528313352906997920
**Old Bot ID**: 1506844827554287706 (replaced)
