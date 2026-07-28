# Discord Bot Verification — Prep Guide

Once this bot is in **75+ servers**, Discord requires the application to be **verified**
before it can join more. This is the part of "going public" people most often get caught
out by late, so start on it early — reviews can take days to weeks.

## 1. Prerequisites (do these first)

- [ ] Privacy Policy live at a public URL — `web/public/privacy.html` is a starting template,
      **not a finished policy**. Fill in every `[bracketed]` placeholder and get it reviewed.
- [ ] Terms of Service live at a public URL — same deal, `web/public/terms.html`.
- [ ] A support server or support contact (Discord asks for a way for users to reach you).
- [ ] App icon, description, and tags filled in on the
      [Developer Portal](https://discord.com/developers/applications) → your app → General Information.
- [ ] Two-factor authentication enabled on the Discord account that owns the application.

## 2. Privileged intents this bot uses

Discord verification requires justifying **every privileged intent** your bot requests.
This bot currently uses two:

### `GUILD_MEMBERS`
**Why it's needed:** welcome/goodbye messages (`events/guildMemberAdd.js`,
`guildMemberRemove.js`) and auto-role assignment on join both require knowing when a member
joins/leaves and being able to look up member objects (for role assignment, kick/ban target
resolution, etc.). This is a core, advertised feature — straightforward to justify.

### `MESSAGE_CONTENT`
**Why it's needed:** the anti-spam system (`events/messageCreate.js`) inspects message text
for two things: (a) duplicate-message flood detection, and (b) Discord invite-link detection
for the optional "block invite links" setting. Message edit/delete logging
(`events/messageDelete.js`, `messageUpdate.js`) also displays the before/after text when
enabled.

**This is the intent Discord scrutinizes hardest.** Reviewers commonly reject
`MESSAGE_CONTENT` requests where the bot could accomplish its stated purpose without raw
message text (e.g. slash-command-only bots don't need it at all). Before you submit:

- Be ready to explain specifically that duplicate-content and invite-link detection are
  impossible without reading message content — flood detection *alone* (message rate, not
  content) does not need this intent and already works without it.
- Consider whether you're comfortable making the content-dependent parts of anti-spam and
  the edit/delete-content logging **opt-in and clearly disclosed** in your Privacy Policy
  (the template already does this) — reviewers respond well to minimizing what a bot reads
  by default.
- If rejected, the bot still functions with `MESSAGE_CONTENT` removed: flood detection,
  moderation commands, warnings, welcome/goodbye, auto-role, and the dashboard are all
  unaffected. Only duplicate/invite-link spam detection and the message-content fields in
  edit/delete logs would need to be disabled (`config.antispam` and
  `config.logs.messageLogsEnabled` in `handlers/configHandler.js` — you'd gate those
  features off, not remove the code).

## 3. Submitting for verification

1. Developer Portal → your app → **App Settings → General Information**: fill out
   description, tags, and terms/privacy URLs.
2. **Bot** tab: toggle on the privileged intents you need (`Server Members Intent`,
   `Message Content Intent`) — note these toggles are separate from *verification*, but
   verification review depends on them being enabled with a stated reason.
3. Once near 75 servers, Discord will prompt you (or you can request early review) — fill
   out the verification form, including:
   - A description of what your bot does
   - Why each privileged intent is required (use Section 2 above as a starting point,
     written in your own words and specific to your final feature set)
   - Your Privacy Policy and Terms URLs
4. Expect back-and-forth — Discord may ask for clarification or ask you to remove/gate an
   intent you can't sufficiently justify.

## 4. After verification

- Verified bots get a "Verified" badge and can exceed the 75-server ceiling.
- You still need to comply with Discord's [Developer Terms of Service](https://discord.com/developers/docs/policies-and-agreements/developer-terms-of-service) and
  [Developer Policy](https://discord.com/developers/docs/policies-and-agreements/developer-policy) on an ongoing basis — verification isn't a one-time checkbox.
- If you materially change what data the bot collects or how privileged intents are used,
  update your Privacy Policy and be prepared for Discord to re-review.

## 5. Useful links

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Verification requirements](https://support-dev.discord.com/hc/en-us/articles/23926564536471-Bot-Verification-and-Data-Whitelisting)
- [Privileged intents FAQ](https://support-dev.discord.com/hc/en-us/articles/360040720412-Privileged-Intents-FAQ)
- [Developer Policy](https://discord.com/developers/docs/policies-and-agreements/developer-policy)
