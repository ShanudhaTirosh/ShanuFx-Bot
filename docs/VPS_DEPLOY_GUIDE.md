# VPS Deployment Guide — Bot + Lavalink + Cloudflare Tunnel

Full path from a fresh VPS to a running bot with working music, using the
`lavalink` service now included in `docker-compose.yml`. This assumes
Ubuntu/Debian; adjust package manager commands if you're on something else.

You already have `cloudflared` installed and authenticated (`cert.pem` in
`/root/.cloudflared/`) — this guide continues from there.

## 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version
docker compose version
```

## 2. Get the code onto the VPS

```bash
mkdir -p /opt/shanufx-bot && cd /opt/shanufx-bot
# upload the zip (scp from your machine) then:
unzip bot.zip
cd discordbot   # or whatever the extracted folder is named
```

## 3. Fill in `.env`

```bash
cp .env.example .env
nano .env
```

Required at minimum:
- `TOKEN`, `CLIENT_ID` — from the Discord Developer Portal
- `LAVALINK_HOST=lavalink.shanufx.dev`
- `LAVALINK_PASSWORD` — pick a real password here (this is the ONE value
  that both the bot and the `lavalink` docker container read from this same
  file — you only set it once)
- If you're running the dashboard too: `DISCORD_CLIENT_SECRET`,
  `SESSION_SECRET`, `DISCORD_REDIRECT_URI`

> Since a `.env` with real secrets was shared in chat earlier in this
> conversation, rotate the bot token, client secret, and session secret
> before going live — see the note in the previous message for exactly
> where to regenerate each one.

Leave `LAVALINK_PORT=443` and `LAVALINK_SECURE=true` — that's the tunnel's
public HTTPS endpoint, not the container's internal port (the container
itself listens on plain 2333; Cloudflare handles TLS termination).

## 4. Start Lavalink + the bot

```bash
docker compose up -d --build
docker compose logs -f lavalink
```

Wait for a line like:
```
Lavalink is ready to accept connections.
```
`Ctrl+C` to stop tailing (the container keeps running).

Sanity-check it's actually listening on the host's loopback:
```bash
curl -H "Authorization: <your LAVALINK_PASSWORD>" http://127.0.0.1:2333/version
```
Should return a version string, not a connection error.

## 5. Point the Cloudflare Tunnel at it

If you haven't finished the tunnel yet:
```bash
cloudflared tunnel create lavalink
```
Note the `<TUNNEL_ID>` it prints, then create `/root/.cloudflared/config.yml`:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: lavalink.shanufx.dev
    service: http://localhost:2333
  - service: http_status:404
```
```bash
cloudflared tunnel route dns lavalink lavalink.shanufx.dev
cloudflared service install
systemctl enable --now cloudflared
systemctl status cloudflared
```

`http://localhost:2333` here refers to the VPS host's own loopback — which
is exactly where the `lavalink` container publishes to (`127.0.0.1:2333` in
`docker-compose.yml`), so this lines up correctly as long as `cloudflared`
runs directly on the host (not inside another container/namespace).

## 6. Verify the full public path works

```bash
curl -H "Authorization: <your LAVALINK_PASSWORD>" https://lavalink.shanufx.dev/v4/info
```
Expect JSON back with `version`, `sourceManagers`, etc. If you get a
Cloudflare error page instead, give DNS a minute to propagate and retry.
If you get a connection refused, double check `systemctl status cloudflared`
for errors first.

## 7. Deploy slash commands and restart the bot

```bash
docker compose run --rm bot npm run deploy:global
docker compose restart bot
docker compose logs -f bot
```
Look for:
```
[Music] ✔ Node "primary-shanufx" connected (lavalink.shanufx.dev:443)
```

## 8. Re-invite the bot

The default invite permission integer changed to include voice permissions
(Connect + Speak) for the music feature. If the bot was already invited
before this update, regenerate the invite link (Developer Portal → OAuth2 →
URL Generator, or use `BOT_INVITE_PERMISSIONS` from `.env`) and re-invite —
otherwise `/play` will fail with a permissions error when trying to join a
voice channel.

## 9. Test it

In a server the bot's in: `/play` a song. You should see it join voice and
post a "Now Playing" embed.

---

## Troubleshooting reference (from what you've already hit)

**`401: Unauthorized` on `npm run deploy:global`**
Not related to Lavalink — that's Discord rejecting `TOKEN`. See the
diagnostic `curl`/`fetch` check from earlier in this conversation. Usually
means the token was regenerated in the Portal after `.env` was last edited,
or there's a stray quote/space around it.

**`Error: Node Request resulted into an error ... /v4/info` /
`does not provide any /v4/info`**
This means the bot successfully opened a WebSocket to that node, but the
node's `/v4/info` REST endpoint didn't respond as expected — usually because
that public node is down, mid-restart, or returning an HTML error page
(e.g. a dead domain behind Cloudflare) instead of JSON. This is exactly the
"public nodes rotate constantly" problem — it's why your own node
(`lavalink.shanufx.dev`, set up in this guide) is the one you should
actually depend on.

**`Client network socket disconnected before secure TLS connection was
established` / repeated `reconnecting...` spam**
Same root cause as above — that specific public node is unreachable.
`lavalink-client`'s `retryAmount`/`retryDelay` (set in `music/nodes.js`)
will keep trying and logging until it's given up, which is normal, if noisy.
Once your own node is live and working, you can set
`LAVALINK_ENABLE_PUBLIC_FALLBACK=false` in `.env` to stop relying on public
nodes at all and silence this — you'll still get the reliability benefit of
failover, just among nodes you actually control (add a second node of your
own via `LAVALINK_EXTRA_NODES` if you want true redundancy without public
nodes).

**Checking for currently-alive public nodes**, if you do want the fallback:
https://freelavalink.serenetia.com/list or
https://github.com/DarrenOfficial/lavalink-list — these track uptime and
prune dead entries regularly, unlike a hardcoded list in this repo which
will inevitably go stale.
