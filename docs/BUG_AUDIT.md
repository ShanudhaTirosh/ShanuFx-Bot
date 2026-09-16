# Bug Audit — Full Codebase Review

Reviewed every file in the bot: `index.js`, `shard.js`, `handlers/`, `events/`,
`commands/` (all categories), `db/client.js`, `web/` (dashboard), `utils/`,
`deploy-commands.js`, Docker config. Overall assessment: **this is a
well-engineered codebase** — parameterized SQL everywhere, sensible
permission checks, graceful handling of missing/partial data, no obvious
security holes in the dashboard's auth/session code. The issues below are
the actual problems found, not filler.

## Fixed

### 1. Cooldowns leaked across servers (`handlers/cooldownHandler.js`)
Cooldowns were keyed only by `commandName + userId`. A user running `/purge`
in Server A would be blocked from running `/purge` in Server B for the same
cooldown window, even though those are unrelated actions in unrelated
servers sharing nothing but the same Discord user ID.
**Fix:** cooldown key now includes `guildId` (`handlers/cooldownHandler.js`,
`events/interactionCreate.js`).

### 2. Dashboard rejected a value the bot itself accepts (`web/routes/api.js`)
The `/antispam` slash command allows `window` down to 1 second
(`.setMinValue(1)` in the command definition), but the dashboard's config
validation required `window >= 2`, silently rejecting `window: 1` if a user
tried to set it from the web UI — a real, if minor, functional mismatch
between the two ways of configuring the same setting.
**Fix:** validation bound changed to match the slash command (`>= 1`).

### 3. Bot invite link missing voice permissions
`BOT_INVITE_PERMISSIONS` in `.env.example` didn't include `Connect` or
`Speak`. Not a pre-existing bug (the bot had no voice features before), but
it would have silently blocked every music command post-update for anyone
using the existing invite link, with no obvious error pointing at
"permissions" as the cause.
**Fix:** updated default permission integer; noted in `docs/MUSIC_SETUP.md`
that existing installs need to re-invite.

## Notable but not changed (design choices, flagged for awareness)

- **`web/server.js` docker-compose `read_only: true`** — fine as-is since
  `/app/data` is a mounted volume, but worth remembering if you add any
  other write paths later (e.g. temp file exports) — they'll silently fail
  under a read-only root filesystem unless also volume-mounted.
- **`commands/info/serverinfo.js`** calls `guild.fetch()` on every
  invocation rather than using cached data — correct for freshness, but
  means every `/serverinfo` call costs an extra Discord API round-trip.
  Not wrong, just a minor latency/rate-limit tradeoff worth knowing about
  if the command gets heavy use.
- **`handlers/warningsHandler.js` / `handlers/configHandler.js`** —
  `getWarnings(guildId)` (no `userId`) and `getWarnings(guildId, userId)`
  share one function with a conditional branch. Works correctly, just
  flagging that adding a third caller pattern later would be a good time to
  split it into two named functions for clarity.

## New code review (music feature)

The music module added in this session (`music/`, `commands/music/`,
`events/voiceStateUpdate.js`) went through the same checks as the rest:
`node --check` on every file, a full dry-`require()` pass with a mocked
client, live instantiation of the `LavalinkManager` against real node
config, a live SQLite round-trip test of the new `music_247_enabled`
column, and unit-level checks of the Spotify URL parser and timestamp
parser. All passed — see the conversation for the specific test commands if
you want to rerun them.

One thing to watch, not a bug per se: the built-in `onEmptyQueue` idle-leave
that ships with `lavalink-client` was intentionally **not** used, because it
has no way to check a guild's 24/7 setting before destroying a player.
Idle-disconnect is instead handled manually in `music/idleTimers.js`, which
does check 24/7 status. If you ever refactor that file, keep that
distinction in mind — reverting to the library's built-in option would
silently break `/247`.

## Session: prefix commands + Lavalink YouTube fix + dashboard fixes

### Added: text-prefix commands (`.cmd` alongside `/cmd`)
New `handlers/messageCommandAdapter.js` walks each command's existing
`SlashCommandBuilder` schema to parse a text message into the same
`options.getX()` shape `ChatInputCommandInteraction` provides, then builds a
small object mimicking `reply`/`deferReply`/`editReply`/`followUp` on top of
`Message`. Every command in `commands/**` works via `.command` with zero
per-command changes. Wired into `events/messageCreate.js`
(`tryHandlePrefixCommand`), with its own permission gate (mirrors what
Discord enforces natively for slash commands via
`default_member_permissions`) and cooldown check
(`handlers/cooldownHandler.js`, reused as-is). New `/setprefix` command and
`command_prefix`/`prefix_commands_enabled` columns on `guild_configs`
(`db/client.js`, `handlers/configHandler.js`). Also exposed in the
dashboard (new "Prefix Commands" section in `web/public/guild.html`,
validated server-side in `web/routes/api.js`).

Parser handles the common "trailing optional args after a free-text reason"
pattern correctly (e.g. `.ban @user being spammy 3` → `reason: "being
spammy"`, `days: 3`) by peeling matching trailing tokens off the end before
the greedy string option claims the rest — see the unit tests and the
`.warn`/`.help`/`.ban` end-to-end runs in the conversation for verification
commands.

**Not attempted:** autocomplete (no prefix-command equivalent exists),
attachment options beyond "first attachment on the message", true ephemeral
replies (no such concept for normal messages — they just post normally,
which is correct for a text command anyway).

### Fixed: Lavalink YouTube source was using the deprecated built-in source
`lavalink/application.yml` had `sources.youtube: true`, Lavalink's
built-in YouTube source — deprecated and effectively broken since YouTube's
bot-detection changes; this is a known, widely-reported issue across the
Lavalink ecosystem, not specific to this bot. **Fix:** switched to
`sources.youtube: false` + the maintained `youtube-source` plugin
(`dev.lavalink.youtube:youtube-plugin:1.13.5`) with client rotation
(MUSIC/ANDROID_VR/WEB/WEBEMBEDDED/TVHTML5EMBEDDED) and commented-out OAuth
instructions for further reliability. Bumped LavaSrc to 4.8.0. Applied the
same fix to `docs/lavalink.example.yml` (the standalone-node template).

### Changed: Spotify source defaults to off in LavaSrc (no keys configured)
Since no Spotify Developer app credentials are set up for this install,
`plugins.lavasrc.sources.spotify` now defaults to `false` in both yml
templates — avoids a wasted round-trip + noisy logs on every Spotify link
before falling back anyway. Spotify links are fully handled by the existing
keyless fallback (`music/spotifyResolve.js` — scrapes the public embed
page, matches on YouTube Music), which needed no changes; it was already
correctly implemented as the primary path for installs without LavaSrc
credentials. Flip `sources.spotify` back to `true` (and fill in
`SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`) if you get a free Spotify
Developer app later.

### Fixed: dashboard error message didn't match its own validation bound
`web/routes/api.js`'s antispam window validation was already correctly
fixed to accept `>= 1` (see "Fixed #2" above), but the error message text
still said *"must be between 2 and 60 seconds"*, and the HTML `<input
min="2">` in `web/public/guild.html` still blocked entering `1` via the
number spinner/native validation — a genuine, user-visible leftover from
that earlier fix not being applied everywhere. **Fix:** both now say/allow
1-60. Verified with a live HTTP round-trip test against the real dashboard
server (`window: 1` → 200, `window: 0` → 400).

### Cleanup: dead ternary in `/help`
`commands/info/help.js` had `commands.get('help') ? 'help' : ''` — always
truthy (the map always contains the very `help` command this file defines),
so it always evaluated to `'help'` anyway. Simplified to a plain string;
no behavior change.

## Session: dashboard mobile nav + music controls (post-deploy pass)

No live Discord/Lavalink access in this environment, so this pass covers
what's verifiable by static review and could be run through `node --check`
and simulated loading — actual in-server behavior (button clicks, embed
rendering in a real channel) still needs a real run per `docs/BUG_AUDIT.md`'s
own recommended verification checklist.

### Fixed: dashboard sidebar had no mobile equivalent
`web/public/guild.html`'s sidebar (the only way to switch between Overview /
Welcome / Auto-role / etc.) was `display: none` below 800px with nothing to
replace it — on a phone there was no way to navigate the dashboard at all
past the initially-active Overview tab. **Fix:** sidebar becomes a slide-out
drawer under 800px, opened via a new hamburger button in a mobile topbar,
closable via a scrim, Escape, or picking a section. Also fixed the sidebar
showing a truncated guild ID (`Server 123456…`) instead of the real name —
`dashboard.html` now passes `name`/`icon` in the link to `guild.html`.

### Added: searchable command reference on the dashboard
New `GET /api/commands` route (`web/routes/api.js`) reads the same
`commands/**` directory `handlers/commandHandler.js` loads at startup, so
it can't drift out of sync with what's actually registered. Rendered as a
new "Commands" section in `guild.html` with client-side search.

### Fixed: `trackStart`/`queueEnd` sent plain text instead of the bot's
### normal embed style
`music/lavalinkManager.js` announced new tracks with a bare
`channel.send('🔴 Started playing X by Y')` — no embed, thumbnail,
progress bar, or requester info, while `/nowplaying` right next to it had
all of that. Extracted the shared pieces into two new modules:
`music/format.js` (just `formatDuration`, pulled out of
`lavalinkManager.js` to avoid a circular require) and
`music/nowPlayingEmbed.js` (`buildTrackEmbed`, platform detection,
progress bar — generalized from what `/nowplaying` already had).
`trackStart` now sends the same rich embed `/nowplaying` shows;
`queueEnd` sends an embed instead of a plain string.

### Added: live control buttons on now-playing messages
Every now-playing message (both the automatic one and `/nowplaying`'s own)
now ships with ⏯️ ⏭️ ⏹️ 🔀 🔁 buttons (`buildControlsRow` in
`music/nowPlayingEmbed.js`), handled globally in
`handlers/musicButtonHandler.js` (routed from `events/interactionCreate.js`
by `music_`-prefixed custom IDs — left `queue.js`'s own `queue_prev`/
`queue_next` pagination buttons untouched since those already have their
own per-message collector). Buttons enforce the same "must be in my voice
channel" rule as the equivalent slash commands. A message's buttons are
frozen (disabled, not left silently broken) once it stops being current —
new track starts, queue ends, or the player is destroyed — via
`disableActiveControls()`, which tracks the single most-recent controls
message per guild so an old message's "skip" button can't act on whatever
happens to be playing much later.

**Verification performed:** `node --check` on every touched file, a full
project-wide syntax sweep, `require()`-loading every new/changed module to
confirm no circular-dependency breakage (`nowPlayingEmbed.js` importing
`formatDuration` from `lavalinkManager.js` would have created one — moved
the shared function into `music/format.js` instead), a real
`handlers/commandHandler.js` load confirming all 35 commands still
register, and a scripted embed/button-JSON render against a fake
player/track to confirm the output shape is well-formed.
**Not verified (needs a live bot):** actual button click round-trips in
Discord, real embed rendering, and the trackStart/queueEnd firing sequence
against a real Lavalink node.

## Session: dashboard live music control + playlists

Adds the ability to control live playback and manage saved playlists from
the web dashboard. The bot and dashboard are separate processes (see
"Cleanup" notes elsewhere in this file) with no shared memory, so this
needed a real bridge rather than just new API routes.

### Added: internal control API bridge (`internal/controlServer.js`)
A small HTTP API the bot process exposes so the dashboard process can
reach `client.lavalink`. Secured with a shared secret compared via
`crypto.timingSafeEqual` (`X-Internal-Secret` header), bound to
127.0.0.1 by default, and entirely disabled (server never starts, clear
warning logged) if `INTERNAL_API_SECRET` isn't set. Endpoints: voice
channel listing, live player state, play/pause/resume/skip/stop/shuffle/
loop/volume, single-track resolve (for playlist adds without starting
playback), and bulk queue-from-playlist.

**Caught during implementation, not after:** `docker-compose.yml` runs the
bot via `shard.js` (`ShardingManager`), which spawns `index.js` once per
shard as separate processes — starting this server unconditionally would
have (a) had every shard fight over the same port and (b) made control
only work for whichever shard happened to own a given guild, silently
failing for the rest. Gated on `client.shard.count > 1` specifically
(not just "is `client.shard` set") so the normal single-shard
docker-compose deployment — which still runs under `ShardingManager` —
keeps working; only genuine multi-shard deployments disable the feature,
with a log line explaining why.

### Added: playlists (`playlists`/`playlist_tracks` tables, `handlers/playlistHandler.js`)
Guild-scoped (shared across the mod team, like every other dashboard
feature). Tracks are stored by URI + display metadata, not Lavalink's
opaque encoded track blobs, which are node-specific and can go stale —
playing a saved playlist re-resolves each URI fresh, same as pasting the
link into `/play`.

### Added: dashboard routes + UI
`web/musicControlClient.js` (dashboard-side fetch wrapper),
`web/routes/music.js` (mounted at `/api` behind the same auth/CSRF/
rate-limit chain as the rest of the API), and a new "Music" tab in
`guild.html`: live now-playing card with progress bar and controls
(pause/resume/skip/stop/shuffle/loop-cycle/volume slider), a play box
with a voice-channel picker, and a playlists panel (create, delete,
expand to view/add/remove tracks, play, and "save current queue as a
playlist").

**Verification performed:** full syntax sweep; `handlers/playlistHandler.js`
tested against a real SQLite DB (create/add/remove/list/delete, including
the name-required and per-guild-cap error paths); `internal/controlServer.js`
tested end-to-end against a realistic fake Lavalink player covering the
full lifecycle (play → queue → pause/resume → volume → loop → queue-playlist
→ skip → stop, plus the security/validation paths — wrong secret, invalid
guildId, invalid volume, unknown action); the dashboard routes tested
end-to-end through the *real* `web/server.js` (real auth/session/CSRF
middleware intact) against a fake bot backend, covering playlist CRUD,
track resolve-and-save, live play/action/volume, and playlist playback;
every lavalink-client method name used (`connect`, `destroy`, `play`,
`setVolume`, `setRepeatMode`, `queue.shuffle`, `queue.splice`,
`queue.add`, `node.search`, `nodeManager.leastUsedNodes`) was checked
against the installed package's type definitions rather than assumed.
**Not verified (needs a live bot + real Lavalink node + Docker Compose
run):** actual browser-driven use of the new Music tab, the two-container
network path in a real `docker compose up`, and behavior against Lavalink
node failover while dashboard controls are in use.
