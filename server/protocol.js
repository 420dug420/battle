/* What a room sends each snapshot, and how a browser applies it. Shared by the server and the game page. */
const P_KEYS = ['x', 'y', 'face', 'hp', 'maxHp', 'weapon', 'dex', 'chain', 'moving', 'walkT', 'flash', 'move'];
const E_KEYS = ['id', 'x', 'y', 'z', 'face', 'state', 'hp', 'maxHp', 'dur', 'durMax', 'broken', 'wounded', 'flee', 'tier', 'lookSeed', 'moving', 'walkT', 'flash', 'deathT', 'dramatic', 'chr', 'san'];
const pick = (o, keys) => { const r = {}; for (const k of keys) r[k] = o[k]; return r; };
export function snapshot(sim, tick, logFrom) {
  const p = sim.player;
  const msg = { t: 'state', tick, time: sim.t, slow: sim.slow, shake: sim.shake, routed: sim.routed,
    p: Object.assign(pick(p, P_KEYS), { swing: p.swing ? pick(p.swing, ['t', 'dur', 'dur0', 'hitAt', 'extra', 'move', 'target', 'hit']) : null }),
    e: sim.enemies.map(e => Object.assign(pick(e, E_KEYS), { atk: e.atk ? { t: e.atk.t } : null })),
    log: [], texts: sim.textOut ? sim.textOut.splice(0) : [] };
  const logTo = sim.logVer; if (logTo > logFrom) msg.log = sim.log.slice(-(Math.min(sim.log.length, logTo - logFrom)));   // only new log lines
  if (sim.lastHit !== sim._sentHit) { msg.lastHit = sim.lastHit; sim._sentHit = sim.lastHit; }
  return { msg, logTo };
}
// browser side: copy a snapshot into the local sim object that the renderer reads
export function applySnapshot(sim, m) {
  sim.t = m.time; sim.slow = m.slow; sim.shake = m.shake; sim.routed = m.routed;
  const p = sim.player; Object.assign(p, m.p);
  const old = new Map(sim.enemies.map(e => [e.id, e]));
  sim.enemies = m.e.map(n => Object.assign(old.get(n.id) || {}, n));   // keep client-only fields (cached look)
  for (const l of m.log) { sim.log.push(l); if (sim.log.length > 80) sim.log.shift(); sim.logVer++; }
  for (const t of m.texts) sim.texts.push(t);
  if (m.lastHit) sim.lastHit = m.lastHit;
}
