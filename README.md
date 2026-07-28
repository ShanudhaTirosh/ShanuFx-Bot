# 🤖 Discord Management Bot

A production-ready Discord server management bot built with **Discord.js v14** and **Node.js 22.5+**.  
Fully modular — commands, events, and handlers are cleanly separated and auto-loaded.

> **Storage:** guild config, warnings, and moderation history are stored in a local SQLite
> database (`data/bot.db`, via Node's built-in `node:sqlite`) instead of per-guild JSON
> files. This gives atomic writes, an auto-incrementing case ID for every warning/mod
> action, and a foundation a future web dashboard can read from directly. If you're
> upgrading from an older version that used `config/{guildId}.json` files, run
> `node scripts/migrate-json-to-sqlite.js` once to import them.

---

## ✨ Features

| Feature | Commands |
|---|---|
| 👋 Welcome Messages | `/setwelcome set`, `/setwelcome disable` |
| 👋 Goodbye Messages | `/setbye set`, `/setbye disable` |
| 🎭 Auto Role on Join | `/setautorole set`, `/setautorole remove` |
| 📋 Mod Logs Channel | `/setlogs set`, `/setlogs disable` |
| 🛡️ Anti-Spam System | `/antispam on/off/config/invites/status` |
| 👢 Kick | `/kick` |
| 🔨 Ban / Unban | `/ban`, `/unban`, `/banlist` |
| 🔇 Mute / Unmute | `/mute add`, `/mute remove` |
| ⚠️ Warn | `/warn` |
| 📋 View / Remove Warnings | `/warnings view` (paginated), `/warnings remove case:<id>`, `/warnings clear` |
| 🗑️ Purge Messages | `/purge` |
| 📊 Server Info | `/serverinfo` |
| 📖 Help | `/help` |
| ⚙️ Warning Auto-Escalation | `/warnsettings set/status/disable` — auto mute/kick/ban at N warnings |
| ✏️ Message Edit/Delete Logs | `/setlogs messages on/off` |
| 🔒 Channel Lock / Unlock | `/lock`, `/unlock` |
| 🐌 Slowmode | `/slowmode` |

---

## 🗂️ Project Structure

```
/
├── index.js                  ← Bot process (also the per-shard entry point)
├── shard.js                  ← Production entry point — spawns index.js via ShardingManager
├── deploy-commands.js        ← Slash command deployer (guild or global)
├── .env                      ← TOKEN, CLIENT_ID, dashboard vars (see .env.example)
├── Dockerfile / docker-compose.yml / .dockerignore
├── docs/
│   ├── DEPLOYMENT.md              ← Docker, bare-metal, scaling checkpoints
│   └── DISCORD_VERIFICATION.md    ← Privileged-intent justification, verification steps
├── data/
│   └── bot.db                ← SQLite database (auto-created on first run)
├── db/
│   └── client.js             ← SQLite connection + schema bootstrap/migrations
├── scripts/
│   ├── migrate-json-to-sqlite.js  ← One-time importer for old config/*.json setups
│   └── smoke-test.js              ← Syntax + DB + loader + dashboard regression check
├── .github/workflows/ci.yml   ← Runs smoke-test.js on every push/PR
├── web/                        ← Browser control panel (separate process, shares the DB)
│   ├── server.js                 ← Express entry point
│   ├── discordApi.js             ← Discord OAuth2 + REST helpers
│   ├── sessionStore.js           ← DB-backed sessions
│   ├── middleware/auth.js        ← Login + per-guild access checks
│   ├── routes/auth.js            ← /auth/login, /auth/callback, /auth/logout
│   ├── routes/api.js             ← Config / warnings / case-history REST API
│   └── public/                   ← Landing, guild picker, control panel, privacy/terms
├── commands/
│   ├── setup/
│   │   ├── setwelcome.js
│   │   ├── setbye.js
│   │   ├── setlogs.js            ← incl. message edit/delete log toggle
│   │   └── setautorole.js
│   ├── moderation/
│   │   ├── kick.js
│   │   ├── ban.js / unban.js / banlist.js
│   │   ├── mute.js
│   │   ├── warn.js / warnings.js / warnsettings.js  ← incl. auto-escalation config
│   │   ├── purge.js
│   │   ├── lock.js / unlock.js / slowmode.js
│   ├── antispam/
│   │   └── antispam.js
│   └── info/
│       ├── serverinfo.js
│       └── help.js
├── events/
│   ├── ready.js
│   ├── interactionCreate.js
│   ├── guildCreate.js / guildDelete.js
│   ├── guildMemberAdd.js / guildMemberRemove.js
│   └── messageCreate.js / messageUpdate.js / messageDelete.js
└── handlers/
    ├── commandHandler.js     ← Auto-loads all commands/ recursively
    ├── eventHandler.js       ← Auto-loads all events/
    ├── configHandler.js      ← Per-guild config (SQLite-backed)
    ├── warningsHandler.js    ← Per-user warnings with case IDs (SQLite-backed)
    ├── modActionsHandler.js  ← Full moderation case history (SQLite-backed)
    ├── escalationHandler.js  ← Auto mute/kick/ban at configured warning thresholds
    └── modLogger.js          ← Shared mod log embed sender + case logger
```

---

## 🚀 Setup & Installation

### 1. Clone the repo

```bash
git clone https://github.com/your-username/discord-management-bot.git
cd discord-management-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
```

- **TOKEN** — from [Discord Developer Portal](https://discord.com/developers/applications) → Your App → Bot → Reset Token  
- **CLIENT_ID** — from the same portal → General Information → Application ID

### 4. Enable Privileged Intents

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. Select your application → **Bot**
2. Under **Privileged Gateway Intents**, enable:
   - ✅ **Server Members Intent** (for welcome/bye/autorole)
   - ✅ **Message Content Intent** (for anti-spam)

### 5. Deploy slash commands

**Guild deploy** (instant, recommended for testing):
```bash
npm run deploy:guild -- <YOUR_GUILD_ID>
# or:
node deploy-commands.js guild YOUR_GUILD_ID
```

**Global deploy** (up to 1 hour propagation):
```bash
npm run deploy:global
# or:
node deploy-commands.js global
```

### 6. Start the bot

```bash
npm start
# runs shard.js — the production entry point, auto-shards as you grow.
# For local development (single process, no sharding overhead):
npm run dev
```

---

## 🖥️ Web Dashboard

A browser control panel lives in `web/` — a separate Express process from the bot, sharing
the same SQLite database (`data/bot.db`). Server admins log in with their own Discord account
(OAuth2) and only ever see servers where they have **Manage Server** permission *and* the bot
is present.

### Setup

1. In the [Discord Developer Portal](https://discord.com/developers/applications) → your app → **OAuth2**:
   - Copy the **Client Secret**
   - Add a redirect URL: `http://localhost:3000/auth/callback` (adjust host/port for production)
2. Add the dashboard variables to your `.env` (see `.env.example` for the full list):
   ```env
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_CLIENT_SECRET=your_client_secret_here
   DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback
   SESSION_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   ```
3. Start it:
   ```bash
   npm run dashboard
   # or for development with auto-restart:
   npm run dashboard:dev
   ```
4. Visit `http://localhost:3000`, log in with Discord, pick a server.

### How it fits together

- The bot process and dashboard process are independent — run one, both, or the dashboard on
  a different machine than the bot, as long as they share the same `data/bot.db` file (e.g. a
  mounted volume) or you point `DB_PATH` at the same location for both.
- The dashboard's API routes (`web/routes/api.js`) call the **exact same** `configHandler.js`,
  `warningsHandler.js`, and `modActionsHandler.js` modules the bot uses — there's no separate
  dashboard-only data layer to keep in sync.
- Security: a user can only read/write a guild's config if (a) Discord's OAuth `guilds` scope
  says they have Manage Server / Administrator there, and (b) the bot actually has a config row
  for that guild (i.e. it's actually in that server). Both are checked on every request in
  `web/middleware/auth.js`, not just at login.
- Sessions are server-side rows in the same DB; the browser only ever holds a random, signed,
  httpOnly cookie — Discord access/refresh tokens never reach the browser.

### Production notes

- Put a reverse proxy (Caddy/Nginx) with real TLS in front of this — `SESSION_SECRET` cookies
  are marked `secure` automatically once `NODE_ENV=production` is set.
- The `/invite` route builds the "Add to Server" URL from `BOT_INVITE_PERMISSIONS` — regenerate
  that permission integer via the Developer Portal's OAuth2 URL Generator if you add commands
  that need more permissions.

---

## ⚙️ Bot Permissions

When inviting the bot, it needs these permissions (or **Administrator** for simplicity):

| Permission | Used For |
|---|---|
| View Channels | General access |
| Send Messages | Welcome / bye / log embeds |
| Embed Links | All embeds |
| Manage Messages | `/purge` bulk delete |
| Kick Members | `/kick` command |
| Ban Members | `/ban` command |
| Moderate Members | `/mute` — Discord timeout API |
| Manage Roles | `/setautorole` — assigning roles on join |
| Read Message History | `/purge` fetching messages |

**Invite URL template:**

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=1374389534806&scope=bot%20applications.commands
```
*(Replace `YOUR_CLIENT_ID` with your actual Client ID)*

---

## 📋 Command Reference

### Setup

| Command | Description |
|---|---|
| `/setwelcome set channel:#ch message:<text>` | Set welcome channel + message |
| `/setwelcome disable` | Disable welcome messages |
| `/setbye set channel:#ch message:<text>` | Set goodbye channel + message |
| `/setbye disable` | Disable goodbye messages |
| `/setlogs set channel:#ch` | Set mod logs channel |
| `/setlogs disable` | Disable mod logs |
| `/setautorole set role:@role` | Assign role automatically on join |
| `/setautorole remove` | Remove auto role |

**Message Variables:**
- `{user}` — mentions the user (`@Username`)
- `{username}` — plain username (no mention)
- `{server}` — server name
- `{membercount}` — current member count

---

### Moderation

| Command | Description | Required Permission |
|---|---|---|
| `/kick user:@user [reason]` | Kick a member | Kick Members |
| `/ban user:@user [reason] [days:0-7]` | Ban a user + optional message purge | Ban Members |
| `/mute add user:@user duration:<mins> [reason]` | Timeout a member | Moderate Members |
| `/mute remove user:@user [reason]` | Remove timeout | Moderate Members |
| `/warn user:@user reason:<text>` | Issue a warning (stored in JSON) | Moderate Members |
| `/warnings view user:@user` | View all warnings for a user | Moderate Members |
| `/warnings clear user:@user` | Clear all warnings for a user | Moderate Members |
| `/purge amount:<1-100> [user:@user]` | Bulk-delete recent messages | Manage Messages |

All moderation actions:
- ✅ Check role hierarchy before acting
- ✅ DM the target user a notification
- ✅ Send a colour-coded embed to the mod logs channel

---

### Anti-Spam

| Command | Description |
|---|---|
| `/antispam on` | Enable anti-spam |
| `/antispam off` | Disable anti-spam |
| `/antispam config [limit] [window] [action]` | Configure thresholds |
| `/antispam invites on\|off` | Toggle invite link blocking |
| `/antispam status` | Show current config |

**Detections:**
1. **Message flood** — more than `limit` messages in `window` seconds
2. **Duplicate messages** — same content sent 3× in a row
3. **Mass mentions** — more than 5 unique user pings in one message
4. **Discord invite links** — `discord.gg/...` (if `blockInvites` is on)

**Actions:** `warn` (DM + log) | `mute` (10-min timeout) | `kick`

> Moderators with **Manage Messages** are exempt from anti-spam.

---

### Info

| Command | Description |
|---|---|
| `/serverinfo` | Full server statistics embed |

---

## 🗄️ Config Schema

Each guild gets its own `config/{guildId}.json` auto-created with these defaults:

```json
{
  "welcome":  { "enabled": false, "channelId": null, "message": "Welcome {user} to **{server}**! 🎉" },
  "bye":      { "enabled": false, "channelId": null, "message": "Goodbye **{username}**. We will miss you!" },
  "autorole": { "enabled": false, "roleId": null },
  "logs":     { "enabled": false, "channelId": null },
  "antispam": {
    "enabled": false,
    "limit": 5,
    "window": 5,
    "action": "warn",
    "blockInvites": true
  },
  "warnings": {}
}
```

---

## 🔒 Security Notes

**Bot**
- All slash command replies use `ephemeral: true` — only the executor sees them
- Role hierarchy is always checked before kick/ban/mute
- Bot role must be **above** any role it tries to assign (autorole)
- Anti-spam exempts users with **Manage Messages** permission (or Administrator)
- Server owner can never be kicked, banned, or warned; self-targeting is blocked on
  ban/kick/mute/warn
- Per-user, per-command **cooldowns** (`handlers/cooldownHandler.js`) throttle command abuse —
  heavier commands (`/purge`, `/lock`, `/unlock`, `/slowmode`) get longer cooldowns since
  they're more rate-limit-sensitive on Discord's side
- Anti-spam auto-actions (mute/kick) and manual moderation both write to the same persistent
  case-history table — and if the bot lacks permission to actually apply an escalated action,
  the case log says so truthfully rather than recording an action that didn't happen
- Every free-text command option (reasons, messages) has an explicit `setMaxLength`; every
  numeric option has explicit min/max bounds — enforced by Discord before the interaction
  ever reaches this bot's code

**Dashboard**
- Security headers via `helmet` (CSP, `X-Frame-Options`, `X-Content-Type-Options`, no
  `X-Powered-By`) — the CSP is scoped to this app's actual needs (inline scripts/styles,
  Google Fonts, Discord's CDN for avatars) rather than disabled outright
- Rate limiting via `express-rate-limit` at three tiers: a generous global floor (300/min) on
  every route, tight on `/auth/*` (20/5min — login abuse also risks our own app's Discord API
  rate limit), and moderate on `/api/*` (120/min — normal dashboard use, not scraping)
- Explicit JSON body size limit (64kb) — nothing this app sends legitimately approaches that
- **CSRF defense-in-depth**: session cookies are `SameSite=Lax` (the primary defense — browsers
  won't attach them to cross-site state-changing requests), *plus* every state-changing API
  request independently must carry an `Origin`/`Referer` header matching this server's own
  host (`web/server.js`'s `requireSameOrigin`)
- Every route under `/api/guilds/:guildId/*` validates that `guildId` (and any `userId`/
  `caseId` involved) is shaped like a real Discord ID/case id **before** it reaches a
  permission check or a DB query
- **Session permission staleness**: a session's cached "servers this user can manage" list is
  re-validated against live Discord data if it's more than 10 minutes old, with automatic
  access-token refresh — so losing Manage Server on Discord (or the bot being removed and
  re-added under someone else) is reflected here within minutes, not up to the full 7-day
  session lifetime. If Discord is genuinely unreachable, this fails open on the cached list
  rather than locking users out over a transient network blip; a real 4xx rejection from
  Discord (token actually revoked) forces re-login
- Dashboard sessions never expose Discord access/refresh tokens to the browser — only a
  signed, httpOnly cookie referencing a server-side session row (see `web/sessionStore.js`)
- Startup validates `SESSION_SECRET` is both present and at least 32 characters, and flags any
  env var that still looks like an unedited `.env.example` placeholder (`utils/validateEnv.js`)
  — every entry point (bot, sharding manager, command deploy, dashboard) uses this same check
- Errors that might otherwise leak a token/secret into logs are passed through a redaction
  helper first (`utils/validateEnv.js`'s `redact()`)

**Infrastructure**
- `docker-compose.yml` runs both containers with a read-only root filesystem (writable only
  at the mounted data volume and a `tmpfs` `/tmp`), all Linux capabilities dropped, and
  `no-new-privileges` — plus memory limits so a single runaway process can't take down the host
- `scripts/smoke-test.js` boots the real dashboard server and drives real HTTP requests
  (including a genuinely authenticated session) to verify every one of the above — status
  codes, security headers, and access-control boundaries are asserted, not assumed

---

## 🌍 Going Public

Turning this from "a bot in my server" into "a bot anyone can add" involves more than code —
see:

- **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** — Docker/`docker-compose`, bare-metal setup,
  global slash-command deployment, and scaling checkpoints (75 guilds, 2,500 guilds).
- **[`docs/DISCORD_VERIFICATION.md`](docs/DISCORD_VERIFICATION.md)** — what Discord requires
  once you pass 75 servers, and a draft justification for this bot's two privileged intents
  (`GUILD_MEMBERS`, `MESSAGE_CONTENT`).
- **`web/public/privacy.html`** / **`web/public/terms.html`** — Privacy Policy / Terms of
  Service **templates**. These are starting points, not finished legal documents — every
  `[bracketed]` placeholder needs filling in and real legal review before you rely on them,
  especially before submitting them as part of Discord verification.

### Continuous integration

`npm run smoke-test` (also run automatically on every push/PR via
`.github/workflows/ci.yml`) syntax-checks every file, loads all commands/events through the
real loaders, round-trips the database layer (including a schema-migration idempotency
check), and boots the actual dashboard server to verify its auth guards return the right
status codes — the same checks this project's changes have been manually verified against
throughout development, now automated.

---

## 📦 Dependencies

```json
{
  "discord.js": "^14.15.0",
  "@discordjs/rest": "^2.0.0",
  "discord-api-types": "^0.38.0",
  "dotenv": "^16.0.0",
  "express": "^4.19.2",
  "cookie-parser": "^1.4.6",
  "express-rate-limit": "^7.4.0",
  "helmet": "^7.1.0"
}
```

The bot itself only needs the first four (the rest are for the optional web dashboard). No
external database service required — config, warnings, and moderation history are stored in
a local SQLite file (`data/bot.db`) via Node's built-in `node:sqlite` (requires Node ≥ 22.5).

---

## 📄 License

MIT — feel free to use, fork, and modify.
