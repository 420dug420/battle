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

## Party play (1 to 5 players)
- One browser hosts: it runs the fight and the run for everyone. The first to open the activity in a Discord voice channel is the host; later ones join that camp. If the host leaves, the others go back to their own camp (no host hand-over yet).
- The relay is a Durable Object (`server/party-room.js`, route `/party/<room>`, free-plan SQLite class). It only passes messages. Redeploy the Worker with `server/` (wrangler) for it to exist; the dashboard single-file upload cannot carry Durable Objects.
- In camp everyone has to stand at the cart and press Ready; the run starts when all are. Someone who joins mid-run drops into the fight at the current wave.
- Every 5 waves the party votes (leave only if leave votes beat stay; ties and silence press on). If everyone falls, gold from the run is lost; gear, levels and skills stay.
- Guests are trusted for their build (gear, stats are clamped to sane ranges, not verified).
- Local test: `cd server && npx wrangler dev --local --port 8788`, open `http://127.0.0.1:8788/arena.html` in two windows, set Server `ws://127.0.0.1:8788` and the same Room in Test arena, press Connect.

## Saves and the Book of Swords
- Inside Discord the save lives on the server (D1 database `project-war`, free plan), under the player's Discord account: the Worker checks the login token with Discord (`/data/me`). The server's save wins on load; with none yet, the device's save is uploaded.
- Writes are throttled (one per few seconds per player). Outside Discord the browser's save is all there is.
- The Book of Swords (`/data/book`, `/data/profile/<id>`) lists everyone who has played, newest first, with the public profile only: name, level, profile model, attributes, record. No inventory or gold.
- Saves are trusted from the player's own game (clamped, not verified), so a player can edit their own numbers.
