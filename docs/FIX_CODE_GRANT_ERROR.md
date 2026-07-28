# 🔧 Fix "Integration requires code grant" Error

**Error**: "Integration requires code grant. You may now close this window or tab."

This error means your Discord Application settings need to be updated. Follow these steps:

---

## ✅ **Solution: Update Discord Developer Portal**

### **Step 1: Open Developer Portal**

Go to your bot's application page:
```
https://discord.com/developers/applications/1506844827554287706
```

Login with your Discord account if needed.

---

### **Step 2: Enable Guild Install (IMPORTANT!)**

1. Click **"Installation"** in the left sidebar
2. Find **"Installation Contexts"**
3. Make sure these are checked:
   - ✅ **Guild Install** ← **THIS IS CRITICAL!**
   - ✅ **User Install** (optional, but recommended)

4. Scroll down to **"Guild Install"** section
5. Under **"Install Link"**, select: **Discord Provided Link**
6. Under **"Default Install Settings"**:
   - **Scopes**: 
     - ✅ `bot`
     - ✅ `applications.commands`
   - **Permissions**:
     - ✅ `Administrator` (or manually enter `8`)

7. Click **"Save Changes"** at the bottom

---

### **Step 3: Check OAuth2 Settings**

1. Click **"OAuth2"** in the left sidebar
2. Click **"General"** sub-tab
3. Verify these settings:
   - **Client ID**: `1506844827554287706` ✅
   - **Client Secret**: (should be there, hidden)
   - **Authorization Method**: In-app Authorization ✅
   
4. Scroll down to **"Redirects"**
5. Make sure you have:
   ```
   http://localhost:3000/auth/callback
   ```
   
6. If not added, click **"Add Redirect"**, paste the URL, click **"Save Changes"**

---

### **Step 4: Verify Bot Settings**

1. Click **"Bot"** in the left sidebar
2. Scroll down to **"Privileged Gateway Intents"**
3. Make sure these are **ENABLED**:
   - ✅ **Presence Intent** (optional)
   - ✅ **Server Members Intent** ← **REQUIRED!**
   - ✅ **Message Content Intent** ← **REQUIRED!**

4. Click **"Save Changes"** if you made any changes

---

### **Step 5: Use the Correct Invite Link**

After updating the settings above, use this invite link:

**Administrator Permission (Full Access):**
```
https://discord.com/api/oauth2/authorize?client_id=1506844827554287706&permissions=8&scope=bot%20applications.commands
```

**Or copy this link and paste in your browser:**
```
https://discord.com/api/oauth2/authorize?client_id=1506844827554287706&permissions=8&scope=bot+applications.commands
```

---

## 🎯 **Alternative: Use Developer Portal Generated Link**

Discord can generate the link for you:

1. Go to: https://discord.com/developers/applications/1506844827554287706
2. Click **"Installation"** in left sidebar
3. Scroll to **"Install Link"**
4. Make sure **"Discord Provided Link"** is selected
5. Click the **"Copy"** button next to the generated link
6. Paste that link in your browser
7. Select your server
8. Click "Authorize"

---

## 📋 **Checklist Before Inviting**

Make sure you've done all of these:

- [ ] Opened Developer Portal
- [ ] Enabled **"Guild Install"** in Installation settings
- [ ] Set scopes: `bot` and `applications.commands`
- [ ] Set permissions: `Administrator` or `8`
- [ ] Saved changes in Installation page
- [ ] Enabled **Server Members Intent** in Bot settings
- [ ] Enabled **Message Content Intent** in Bot settings
- [ ] Saved changes in Bot page
- [ ] Using the correct invite link

---

## 🔄 **If Error Persists**

### **Option A: Wait a Few Minutes**
Discord sometimes takes 5-10 minutes to update settings. Wait and try again.

### **Option B: Regenerate Bot Token**
If nothing works, the bot token might be the issue:

1. Go to Developer Portal → **"Bot"**
2. Click **"Reset Token"**
3. Copy the new token
4. Update `.env` file:
   ```env
   TOKEN=YOUR_NEW_TOKEN_HERE
   ```
5. Restart bot: Ctrl+C, then `npm start`
6. Try invite link again

### **Option C: Check Bot Token is Correct**
Make sure your bot token in `.env` matches the one in Developer Portal → Bot → Token

---

## 🆘 **Common Issues**

### **Issue 1: "Guild Install" not enabled**
**Solution**: Enable it in Installation settings (Step 2 above)

### **Issue 2: Wrong scopes**
**Solution**: Must have both `bot` AND `applications.commands`

### **Issue 3: Intents not enabled**
**Solution**: Enable Server Members Intent and Message Content Intent

### **Issue 4: Old cache**
**Solution**: 
- Clear browser cache (Ctrl+Shift+Delete)
- Try in incognito/private window
- Try different browser

---

## 📸 **Visual Guide**

### Installation Page Should Look Like:
```
Installation Contexts:
  ✅ Guild Install
  ✅ User Install

Guild Install:
  Install Link: ● Discord Provided Link
  
  Default Install Settings:
    Scopes: 
      ✅ bot
      ✅ applications.commands
    
    Permissions:
      ✅ Administrator
```

### Bot Page Should Look Like:
```
Privileged Gateway Intents:
  ☐ Presence Intent
  ✅ Server Members Intent
  ✅ Message Content Intent
```

---

## ✅ **After Fixing**

Once you've updated the settings:

1. **Wait 2-3 minutes** for Discord to update
2. **Use the invite link**:
   ```
   https://discord.com/api/oauth2/authorize?client_id=1506844827554287706&permissions=8&scope=bot%20applications.commands
   ```
3. **Select your server**
4. **Check "Administrator"** is shown
5. **Click "Authorize"**
6. **Complete captcha** if shown
7. ✅ **Done!** Bot should be added

---

## 🎉 **Verify It Worked**

After bot is added:

1. Bot appears in member list
2. Bot has role with administrator permission
3. Try command: `/help`
4. Bot responds successfully
5. Try music: `/play never gonna give you up`

---

## 📞 **Still Having Issues?**

If you still get "Integration requires code grant" after following all steps:

1. **Screenshot** your Installation page settings
2. **Screenshot** your Bot page intents
3. **Double-check** Guild Install is enabled
4. **Try** using the Developer Portal generated link
5. **Wait** 10 minutes and try again (Discord cache)

---

## 🔗 **Important Links**

| What | Link |
|------|------|
| Developer Portal | https://discord.com/developers/applications/1506844827554287706 |
| Invite Link (Admin) | https://discord.com/api/oauth2/authorize?client_id=1506844827554287706&permissions=8&scope=bot%20applications.commands |
| Dashboard | http://localhost:3000 |

---

## 💡 **Why This Happens**

The "Integration requires code grant" error occurs when:

1. ❌ "Guild Install" is not enabled in Installation settings
2. ❌ Wrong OAuth2 scopes (missing `bot` or `applications.commands`)
3. ❌ Application is configured for user install only
4. ❌ Bot token has been regenerated but not updated in code

**The fix is to enable Guild Install and use the proper scopes!**

---

**Last Updated**: Just now
**Your Bot ID**: 1506844827554287706
**Required Scopes**: bot, applications.commands
**Required Permission**: 8 (Administrator)
