# Dashboard music control — setup

The web dashboard can control live music playback and manage playlists.
This needs one extra piece of wiring because the bot and the dashboard are
two separate processes that otherwise only share the SQLite database file:
a small internal HTTP bridge (`internal/controlServer.js`) that the bot
exposes so the dashboard can reach `client.lavalink`.

**This is optional.** If you don't set it up, everything else in the
dashboard (server config, warnings, case history, the command reference)
works exactly the same. The Music tab will just show a clear "not
available" message instead of controls.

## Same machine (no Docker)

1. Generate a secret (don't reuse your `SESSION_SECRET`):
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. In `.env`, set:
   ```
   INTERNAL_API_SECRET=<the generated value>
   INTERNAL_API_HOST=127.0.0.1
   INTERNAL_API_PORT=3100
   BOT_INTERNAL_URL=http://localhost:3100
   ```
3. Start both processes as usual: `npm run start:single` and
   `npm run dashboard`.

## Docker Compose

`docker-compose.yml` already wires the host/URL correctly
(`INTERNAL_API_HOST=0.0.0.0` on the `bot` service, `BOT_INTERNAL_URL=http://bot:3100`
on the `dashboard` service — `bot` there is the Compose service name, resolved
over the internal Docker network). You only need to set `INTERNAL_API_SECRET`
in your `.env` — do not add port `3100` to any `ports:` mapping; it should
never be reachable from outside the two containers.

## Sharding

If your bot needs more than one shard (a few thousand+ guilds —
`npm run start` / `shard.js`), dashboard music control automatically
disables itself once shard count exceeds 1, with a log line explaining why:
each shard only sees a subset of guilds, so control would silently work for
some servers and not others depending on which shard they landed on. A
single shard under `ShardingManager` (the normal Docker Compose case, even
for small bots) is unaffected — this only matters once you actually scale
past one shard.

## Troubleshooting

- **"Dashboard music control is not configured"** — `INTERNAL_API_SECRET`
  or `BOT_INTERNAL_URL` isn't set on the relevant process. Check the flow
  above matches your deployment (same-machine vs Docker).
- **"Could not reach the bot process. Is it running?"** — the bot process
  is down, or `BOT_INTERNAL_URL` points somewhere unreachable from the
  dashboard's container/host.
- **"Invalid or missing internal secret."** — `INTERNAL_API_SECRET` differs
  between the bot's `.env` and the dashboard's `.env` (both processes read
  the same file normally, so this usually means one was edited after the
  other started — restart both).
