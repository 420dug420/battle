# Project War

1-5 player co-op mercenary-company game, built as a Discord Activity. Side-view combat with live 3D fighters drawn as pixel art.

- `game/`: combat rules (`sim.js`, no browser code; also runs on the server), page (`app.js`, `template.html`), tests (`tests.mjs`), Animator-made attacks (`anims.json`)
- `rig/`: 3D fighters. `humantest.js` is the humantest bundle plus a shim naming the internals the rig uses; `model3d.js` is the Project War rig: armor parts, poses, moves, blade-path baking
- `animator/`: the Animator tool
- `server/`: Cloudflare Worker + Durable Object fight rooms (free plan)
- `armor/`: armor mock page template
- `reference/`: the old 2D reference sheets and mock images
- `tools/`: `freevars.cjs` lists what code uses from the humantest bundle (rerun if humantest is rebuilt)
- `dist/`: built pages (`game.html`, `animator.html`, `armor-mock.html`)

    npm install
    npm run build     # dist/
    npm test          # rules tests
