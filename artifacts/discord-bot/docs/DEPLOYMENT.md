# Deployment Guide

This covers taking the bot from "runs on my machine" to "always-on, publicly addable."

## 1. One-time setup

### Discord Developer Portal
1. Create/open your application at https://discord.com/developers/applications
2. **Bot** tab → enable **Server Members Intent** and **Message Content Intent** (see
   `docs/DISCORD_VERIFICATION.md` for why this bot needs them, and what to do if you'd
   rather not request `MESSAGE_CONTENT`).
3. **OAuth2** tab → note your **Client ID** and generate a **Client Secret** (needed for the
   dashboard's login) → add a Redirect URL matching wherever you'll host the dashboard, e.g.
   `https://dashboard.yourdomain.com/auth/callback`.

### Environment
Copy `.env.example` to `.env` and fill in every value — see that file's comments for what
each one is. `SESSION_SECRET` should be a long random string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Deploy slash commands globally, once
Guild-scoped commands (`npm run deploy:guild`) are instant but only work in one server —
useful for development. For a public bot, deploy **globally** instead (takes up to an hour
to propagate the first time, but then every server that adds the bot gets the commands
automatically, with no per-server step):
```bash
npm run deploy:global
```
Re-run this whenever you add/change a command. You do not need to re-run it when the bot
joins a new server.

## 2. Running it — Docker (recommended)

```bash
docker compose up -d --build
```

This starts two containers (bot + dashboard) sharing one persistent volume for
`data/bot.db`. Check logs with `docker compose logs -f bot` / `docker compose logs -f dashboard`.

To run the global command deploy inside the container instead of locally:
```bash
docker compose run --rm bot npm run deploy:global
```

Put a reverse proxy (Caddy, Nginx, or your host's built-in one) with real TLS in front of
the dashboard container's port 3000. Set `NODE_ENV=production` (already set in
`docker-compose.yml`) so session cookies are marked `secure`.

## 3. Running it — bare metal / VPS (no Docker)

```bash
npm ci --omit=dev
npm run deploy:global          # once, and again whenever commands change
npm start                      # runs shard.js — the sharded, production entry point
```
Run the dashboard as a separate process (`npm run dashboard`), ideally under a process
manager (systemd, pm2) so both restart automatically on crash or reboot. Both processes
read/write the same `data/bot.db` file — make sure `DB_PATH` (if you set it) points at the
same location for both, and that the file lives on persistent storage, not an ephemeral
disk that resets on redeploy.

## 4. Hosting providers

Any host that gives you a persistent volume and lets a Node process run continuously works:
a small VPS (with Docker or bare Node), Railway, Render, Fly.io. Avoid pure-serverless
function platforms — this bot needs a long-lived process for the Discord gateway
connection, not a request/response function.

## 5. Scaling checkpoints

| Guilds | What changes |
|---|---|
| 1 – ~2,000 | `npm start` (shard.js) already auto-shards; nothing else to do. |
| ~75+ | Discord requires app **verification** — see `docs/DISCORD_VERIFICATION.md`. Start this well before you hit the ceiling; review can take a while. |
| ~2,500+ | Discord *requires* sharding — already handled by `shard.js`/`ShardingManager`, no action needed as long as you're using `npm start` and not `npm run start:single`. |
| High write volume across many guilds | SQLite's single-writer-per-file model starts to matter. `db/client.js` already uses WAL mode + `busy_timeout`, which comfortably handles moderate concurrent writes, but if you're seeing `SQLITE_BUSY` errors under load, that's the signal to migrate `db/client.js` + the three handler modules (`configHandler.js`, `warningsHandler.js`, `modActionsHandler.js`) to a client-server database (Postgres is the natural choice) — everything else in the codebase is unaffected since it only ever calls those handler functions. |

## 6. Monitoring

- `GET /health` on the dashboard returns `{"ok": true}` — point an uptime monitor at it.
- The bot process logs shard lifecycle events (`shard.js`) and guild join/leave events
  (`events/guildCreate.js` / `guildDelete.js`) to stdout — pipe these into whatever log
  aggregation your host provides, or add a service like Sentry for error tracking if you
  want alerting beyond basic uptime.
