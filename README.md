# Project War

1-5 player co-op mercenary-company game, built as a Discord Activity. Side-view combat with live 3D fighters drawn as pixel art.

- `campaign/`: the main game page. `data.js` (no browser code): characters, gear, gold, styles, hirelings, world map, battle generation, saves; `app.js`, `stage.js`, `template.html`: screens and drawing; `tests.mjs`
- `game/`: combat rules (`sim.js`, no browser code; also runs on the server), the combat test arena (`app.js`, `template.html`), tests (`tests.mjs`), Animator-made attacks (`anims.json`)
- `rig/`: 3D fighters. `humantest.js` is the humantest bundle plus a shim naming the internals the rig uses; `model3d.js` is the Project War rig: armor parts, poses, moves, blade-path baking
- `animator/`: the Animator tool (attacks with a "used as" role: light, heavy, dash, counter; idle/walk, damaged/dying/falling, grab/throw/slam/strike with an enemy dummy, and clash, parry, dash, shoot, block, stun)
- `server/`: Cloudflare Worker + Durable Object fight rooms (free plan)
- `armor/`: armor mock page template
- `reference/`: the old 2D reference sheets and mock images
- `tools/`: `freevars.cjs` lists what code uses from the humantest bundle (rerun if humantest is rebuilt)
- `dist/`: built pages (`game.html` the campaign, `arena.html` the combat test, `animator.html`, `armor-mock.html`)

    npm install
    npm run build     # dist/
    npm test          # rules tests

## Manual combat (arena, `sim.manual`)

Mouse side = facing, left click light, right click heavy, cursor aims throws and shots. Shift dashes (stamina), a click during or just after a dash is a dash attack. Hold Q to block, tap Q just before a hit to parry (heavies can only be parried; empty stamina while blocking breaks the guard). Two light swings that meet clash: both bounce, only the two fighters freeze for a few frames, bystanders are pushed away. Heavy attacks and swarm fodder never clash. Passive skills: riposte (no bounce, counter-swing) and shove (stuns the clashed enemy). There is no global hit-stop or slow-motion. All numbers are placeholders in `CFG` (`clash`, `stamina`, `dash`, `attack`, `aim`, `proj`, `kinds`).
