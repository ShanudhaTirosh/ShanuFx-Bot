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
