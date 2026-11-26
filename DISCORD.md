# Discord Activity setup

The code side is ready; the steps below need your Discord and Cloudflare accounts. All of it is free (Discord applications and Cloudflare Workers' free plan). Nothing here buys or upgrades anything.

## What is already in the repo
- `game/discord.js`: when the page runs inside Discord it starts the Embedded App SDK, signs the player in, tracks who is in the activity and sets the Rich Presence line. Outside Discord it does nothing.
- `server/worker.js`: `POST /api/token` swaps the Discord login code for an access token (the secret stays on the server), `/room/<name>` is the fight room, and every other path serves the built pages from `dist/` (`/` is the arena page).
- `window.PW.discord` holds `{ user, name, participants, instanceId, channelId, guildId, roomName, wsBase }` once signed in. The online test fields are filled with the instance's room and the proxy address.
- The pixel font is embedded in the page, because Discord blocks outside font hosts.

## Steps
1. discord.com/developers/applications, New Application. Copy the Application ID (public) and, under OAuth2, the Client Secret (private).
2. Activities, Settings: turn Activities on. Add a Redirect URI under OAuth2 (any placeholder such as `https://127.0.0.1`).
3. Build with your id: `DISCORD_CLIENT_ID=<application id> npm run build`
4. Put the id in `server/wrangler.toml` (`DISCORD_CLIENT_ID`), then in `server/`: `npx wrangler login`, `npx wrangler secret put DISCORD_CLIENT_SECRET`, `npx wrangler deploy`. It prints `https://project-war.<you>.workers.dev`.
5. Developer Portal, Activities, URL Mappings (no `https://`):
   - `/` to `project-war.<you>.workers.dev`
   - `/ws` to `project-war.<you>.workers.dev`
   - `/api` is covered by the `/` mapping.
6. Activities, Settings: add yourself as a tester (or add the app to a test server), then start the Activity from a voice channel's rocket icon.

## Limits to know
- Scopes asked: `identify`, `guilds`, `rpc.activities.write`. Rich Presence updates are rate limited, so the page sends at most one per 6 seconds and only when the text changes.
- Online play still carries only the old inputs (see `server/README.md`), so the Discord room is wired but multiplayer combat is not finished.
- The Activity needs the Worker deployed; it cannot be tested from the claude.ai artifact page.
