# Project War: working rules

## Every new animation gets an Animator setup
Any feature that adds a new pose or motion for a fighter (player, party member, hireling or enemy) must ship with all of these in the same change:

1. **An Animator type**: an option in the type list (`animator/template.html`, `#newtype`), a default name and length in `mkAnim`, and a preview case in `figureAt` (one-shot types also go in `ONESHOT`).
2. **A game hook**: the game asks for it by kind (`playerState()` / the enemy `est` in `game/app.js`, a `st: { kind }` read by `M3.statePose`), so an animation of that type made in the Animator replaces the built-in.
3. **A built-in fallback**: a `STATE_POSE` entry (or a fallback in `M3.statePose`) in `rig/model3d.js`, so the game looks right before anyone animates it; `registerAnim` must file the type as a one-shot (`ONE`) or a loop (`CLOOP`) with a sensible default length.
4. **Load built-ins**: the type is in the Animator's `Load built-ins` list (with a loop length in `BASE_LOOPS` if it loops), so the built-in can be loaded as keys and edited.

Current state types made this way: idle, walk, hurt, dying, falling, clash, parry, dash, jump, shoot, block, stun, shieldup (shield raised), bash (shield slam), carry (carrying a downed ally), launched (juggled in the air). Attacks: built-in styles can be loaded and replaced via `base`; new attacks are Animator attacks (juggle tag available).

## Other standing rules
- Never anything that costs money: free plans and free tiers only (Cloudflare Worker + Durable Object on the free plan, GitHub Pages/raw).
- The live page is `docs/index.html` (copy of `dist/arena.html` built with `DISCORD_CLIENT_ID=1575635299189653668 npm run build`); the `project-war` Worker serves it from the repo, so a push updates the game.
- Run `npm test` before pushing.
