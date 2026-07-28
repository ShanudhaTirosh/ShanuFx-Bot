# Discord Management Bot (Shanu_Fx)

Discord bot with music (YouTube, Spotify, SoundCloud), moderation, anti-spam, welcome/bye messages, and a web dashboard.

## Run & Operate

- **"Discord Bot" workflow** — starts `node index.js` in `artifacts/discord-bot/`
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages

## Bot Commands (35 total)

**Music**: `/play`, `/skip`, `/stop`, `/pause`, `/resume`, `/queue`, `/nowplaying`, `/volume`, `/loop`, `/shuffle`, `/remove`, `/clear`, `/seek`, `/leave`, `/247`
**Moderation**: `/ban`, `/unban`, `/kick`, `/mute`, `/warn`, `/warnings`, `/warnsettings`, `/purge`, `/lock`, `/unlock`, `/slowmode`, `/banlist`
**Setup**: `/setprefix`, `/setwelcome`, `/setbye`, `/setlogs`, `/setautorole`
**Info**: `/help`, `/serverinfo`, `/antispam`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
