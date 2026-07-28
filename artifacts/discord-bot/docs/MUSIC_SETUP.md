# Music Setup (Lavalink + Spotify)

This bot plays music via [Lavalink](https://github.com/lavalink-devs/Lavalink)
using [lavalink-client](https://github.com/Tomato6966/lavalink-client), the
same underlying approach as most major open-source music bots. It supports
**multiple Lavalink nodes with automatic failover** and **Spotify links
without requiring a Spotify Developer app**.

> **YouTube playback requires the `youtube-source` plugin.** Lavalink's
> built-in YouTube source is deprecated and effectively broken (YouTube's
> bot-detection rejects it), so `lavalink/application.yml` sets
> `sources.youtube: false` and installs
> [`youtube-source`](https://github.com/lavalink-devs/youtube-source)
> instead, configured to rotate through several YouTube "clients" (MUSIC,
> ANDROID_VR, WEB, WEBEMBEDDED, TVHTML5EMBEDDED) for reliability — still
> completely free, no Google account or API key needed. If you still hit
> frequent "Sign in to confirm you're not a bot" errors, the config has a
> commented-out OAuth block (also free — a one-time device-code login from
> any Google account fixes it long-term). This is already wired up if
> you're running `docker compose up lavalink` from this repo; if you're
> pointing at a different/existing Lavalink node, make sure it has the same
> plugin installed.

> **No Spotify Developer app? You don't need one.** By default this repo's
> `lavalink/application.yml` has `plugins.lavasrc.sources.spotify: false`
> (no credentials configured), so Spotify links are handled entirely by the
> bot's own keyless fallback described below — scraping Spotify's public
> embed page (same data Spotify's own embed widgets use) and matching
> tracks on YouTube Music. This works out of the box with zero setup. Only
> bother with the optional LavaSrc section further down if you specifically
> want native Spotify metadata/playlist paging later.

## How node failover works

- `music/nodes.js` builds a node list: your own node (primary) + free public
  nodes (fallback), all from env vars in `.env`.
- When `/play` creates a new player, `lavalink-client` automatically picks
  whichever **connected** node currently has the least load. If your primary
  node is down at that moment, new requests transparently land on a fallback
  node — no code path needed for that, it's the library's default behavior
  when you don't force a specific node.
- If a node an **existing** player is using disconnects or errors, the bot
  catches that in `music/lavalinkManager.js` and calls `player.moveNode()` to
  migrate playback to another connected node live, and posts a message in the
  channel explaining what happened. If literally no node is reachable, the
  channel gets a clear error instead of silence.

## Setting up your own node (recommended)

You already mentioned running things at `lavalink.shanufx.dev` — that's the
intended primary node here. Any Lavalink v4-compatible host works the same
way. Minimal steps if you're starting fresh:

1. Install Java 17+ on the VPS.
2. Download the latest Lavalink v4 jar from
   https://github.com/lavalink-devs/Lavalink/releases
3. Create an `application.yml` next to the jar (see `docs/lavalink.example.yml`
   in this repo for a ready-to-edit template with LavaSrc + Spotify already
   wired up).
4. Run it (`java -jar Lavalink.jar`), put it behind your existing nginx +
   Cloudflare setup on a subdomain (`lavalink.shanufx.dev`) with a WebSocket-
   capable reverse proxy config, same pattern as your existing
   `lavalink.shanufx.dev` Lavalink hosting work.
5. In this bot's `.env`:
   ```
   LAVALINK_HOST=lavalink.shanufx.dev
   LAVALINK_PORT=443
   LAVALINK_PASSWORD=<whatever you set as `password` in application.yml>
   LAVALINK_SECURE=true
   ```

### Optional: native Spotify support on your node (LavaSrc)

Free public nodes essentially never have this enabled, which is why the bot
has a built-in fallback (see below) that works with zero configuration. But
if you want the *best* Spotify results (accurate metadata straight from
Spotify's catalog, full playlist paging beyond ~100 tracks, etc.) on **your
own** node specifically:

1. Add the [LavaSrc plugin](https://github.com/topi314/LavaSrc) to your
   node's `application.yml` under `lavalink.plugins`.
2. Create a **free** Spotify Developer app at
   https://developer.spotify.com/dashboard (takes ~2 minutes, no cost, no
   approval wait — this only grants metadata access, which is all Spotify
   allows anyone to have; nobody gets real Spotify audio playback through
   the public API).
3. Put that app's Client ID/Secret in `application.yml` under
   `plugins.lavasrc.spotify` — **not** in this bot's `.env`. The bot never
   needs Spotify credentials itself.

Actual audio still comes from YouTube/SoundCloud either way — Spotify has
never allowed third-party audio streaming through its API, for anyone.
LavaSrc's benefit is metadata quality and playlist handling, not audio
source.

## Spotify without any setup at all (default behavior)

Out of the box, with zero Spotify configuration anywhere, `/play` still
handles `open.spotify.com` track/album/playlist links:

1. `music/resolveQuery.js` first tries the connected node's native Spotify
   support (works if that happens to be your own LavaSrc-configured node).
2. If that's unavailable (any public fallback node, or your node without
   LavaSrc), `music/spotifyResolve.js` scrapes Spotify's public embed page
   for the track/artist names — the same public, keyless endpoint
   Spotify's own embed widgets use, no login or app registration required.
3. Those track names get searched on YouTube Music via whichever node is
   connected, and queued normally.

This means Spotify links work immediately after `npm install`, even before
you've touched any Lavalink config — they'll just use YouTube Music search
matching until/unless you set up LavaSrc on your primary node.

## Free public fallback nodes

`LAVALINK_ENABLE_PUBLIC_FALLBACK=true` (default) adds a couple of free,
publicly shared Lavalink v4 nodes as a safety net. Keep in mind:

- They're shared with every other bot using them — expect occasional
  slowness or downtime outside your control.
- Public node lists rotate. If both configured fallback nodes are ever dead,
  check https://freelavalink.serenetia.com/list or
  https://github.com/DarrenOfficial/lavalink-list for current ones and
  either update `music/nodes.js` or add one via:
  ```
  LAVALINK_EXTRA_NODES=[{"id":"my-extra","host":"...","port":443,"authorization":"...","secure":true}]
  ```
- They almost never have LavaSrc/Spotify configured, which is exactly the
  case the fallback resolver above handles.

Set `LAVALINK_ENABLE_PUBLIC_FALLBACK=false` if you'd rather the bot simply
be unavailable than run on infrastructure you don't control.

## Running Lavalink locally for development

```
LAVALINK_LOCAL_ENABLED=true
```

then run a local Lavalink (Docker is easiest — see
`docs/lavalink.example.yml` for config; run it with
`docker run -v ./application.yml:/opt/Lavalink/application.yml -p 2333:2333 ghcr.io/lavalink-devs/lavalink:4`).
Handy for testing without touching the production node.

## Commands

`/play`, `/skip`, `/stop`, `/pause`, `/resume`, `/queue`, `/nowplaying`,
`/volume`, `/loop`, `/shuffle`, `/remove`, `/clear`, `/seek`, `/leave`,
`/247` (toggle 24/7 mode — bot stays connected even when idle/alone).

Run `node deploy-commands.js` after pulling this update so Discord picks up
the new commands, and re-invite the bot (or re-run OAuth) if it was invited
before this update — the default invite permissions changed to include
Connect + Speak (voice) permissions, which the old invite link won't have.
