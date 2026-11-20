# Project War server (Cloudflare Workers, free plan)

One Durable Object per fight room runs `game/sim.js`: the browser sends input, the room sends back snapshots ~30 times a second.
Uses only free-plan features: a SQLite-backed Durable Object class, no storage writes, no paid add-ons.
On the free plan, going over a daily limit makes requests fail with an error; nothing is billed.

Free-plan cost notes: a room only ticks while someone is connected, and stops when the last player leaves.

## Try it locally
    npm install
    npx wrangler dev --local --port 8799        (run inside server/)
    node server/test-room.mjs                   (separate terminal: a scripted player fights a dummy)
Then open dist/game.html, open "Online test", keep ws://127.0.0.1:8799 and press Connect.

## Put it online (your free Cloudflare account)
    cd server
    npx wrangler login
    npx wrangler deploy
It prints an address like https://project-war.<you>.workers.dev; use wss://project-war.<you>.workers.dev as the Server in the game.

Prototype limits: one player per room (others who join watch), the client uploads its own blade paths (trusted), enemy attacks still use the reach rule.
