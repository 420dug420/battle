/* ============================================================
   PROJECT WAR · COMBAT SIM  (no DOM, no drawing)
   No browser APIs: the same file runs in the page and in the
   Durable Object that owns a contract room (server/).
   All numbers marked PLACEHOLDER are tuning guesses, not design.
   ============================================================ */
export const CFG = {
  W: 640, H: 360,
  band:  { top: 244, bottom: 322 },       // walkable depth band, feet y
  arena: { left: 24, right: 616 },
  laneTol: 12,                            // px of lane difference that still connects
  woundedDur: 1.0,                        // s (design)
  woundedThreshold: 3,                    // man-at-arms (design)
  woundedChance: 1.0,                     // rank-based chance, 100% until decided
  critMult: 2,                            // design
  critOrder: 'before',                    // 'before' | 'after' armor (OPEN question)
  fleeSan: 3,                             // PLACEHOLDER: SAN at or below this flees
  swingMoveMult: 0.35,                    // PLACEHOLDER: move speed while swinging
  moveBreakDelay: 0.30,                   // PLACEHOLDER: re-ready delay after moving mid-chain
  interruptDelay: 0.35,                   // PLACEHOLDER: delay after being struck mid-swing
  dramaticExtend: 0.35,                   // s added to the player swing on a Wounded kill
  dexStep: 0.03,                          // PLACEHOLDER: swing time shrinks 3% per DEX above 5
  tiers: {                                // reductions are design; durability is PLACEHOLDER
    leather: { label: 'Leather / cloth', pct: 0.00, dur: 6  },
    mail:    { label: 'Mail / scale',    pct: 0.25, dur: 9  },
    plate:   { label: 'Plate',           pct: 0.50, dur: 12 },
    special: { label: 'Special unit',    pct: 0.75, dur: 18 },
  },
  // Weapon classes carry the stats; a weapon is a look plus its class. Every weapon of a class fights the same
  // unless it lists its own override (any class field). posture picks the stance and animation set.
  // speedStat: the attribute that shortens the swing (dexStep per point above 5). dmg and intervals are PLACEHOLDERS.
  weaponClasses: {
    sword1: { dmg: 3, reach: 44, baseInterval: 0.80, twoHanded: false, posture: 'one',   speedStat: 'dex' },
    sword2: { dmg: 4, reach: 58, baseInterval: 1.35, twoHanded: true,  posture: 'two',   speedStat: 'dex' },
    axe1:   { dmg: 4, reach: 38, baseInterval: 0.95, twoHanded: false, posture: 'one',   speedStat: 'dex' },
    mace1:  { dmg: 4, reach: 36, baseInterval: 1.00, twoHanded: false, posture: 'one',   speedStat: 'dex' },
    spear2: { dmg: 3, reach: 72, baseInterval: 1.10, twoHanded: true,  posture: 'spear', speedStat: 'dex' },
  },
  weapons: {
    longsword:  { label: 'Longsword',  cls: 'sword1' },
    greatsword: { label: 'Two-hander', cls: 'sword2' },
    axe:        { label: 'Hand axe',   cls: 'axe1',   kind: 'axe' },
    mace:       { label: 'Mace',       cls: 'mace1',  kind: 'mace' },
    spear:      { label: 'Spear',      cls: 'spear2', kind: 'spear' },
  },
  abreak: { sanMult: 0.5, speedMult: 1.25 },   // design
  pxPerM: 54,                             // sim pixels per metre (the 3D render scale)
  // Clash (design): when two light attacks' hit areas meet, both fighters play a set clash animation and bounce back. No winner.
  // Only the two clashing fighters freeze (a few frames); nothing else is slowed. Everyone nearby is pushed away (bounded, deterministic).
  // Heavy attacks never clash. All numbers are PLACEHOLDERS to tune by feel.
  clash: { dur: 0.34, freeze: 0.07, knock: 200, decay: 9, wave: { radius: 72, push: 190, max: 230 }, enemyCd: 0.5, early: 0.55, late: 0.12,
           shoveMult: 2.2, shoveStun: 1.1, ripostePause: 0 },
  // Block / parry / stamina (design): hold to block the front; a well-timed press is a perfect block (parry); blocking and dashing cost stamina.
  // A normal block stops light hits only. Heavy attacks can only be parried. Empty stamina while blocking breaks the guard: a stun.
  stamina: { max: 100, regen: 30, regenDelay: 0.6, blockPress: 3, blockHit: 14, parryWin: 0.2, parryRefund: 30, parryStun: 1.1, breakStun: 1.1, dashCost: 22 },
  dash: { dur: 0.22, speed: 330, iframes: 0.12, atkWin: 0.30, lunge: 150 },
  attack: { heavy: { durMult: 1.5, hitFrac: 0.6, mult: 2.2, pierce: 0.5, after: 0.4 },
            dash:  { durMult: 0.9, hitFrac: 0.4, mult: 1.4 },
            counter: { durMult: 0.8, hitFrac: 0.3, mult: 1.5 } },
  // Aim (design): the mouse sets the side you face; the cursor aims throws and projectiles.
  aim: { throwRange: 170, throwAir: 0.387 },
  proj: { speed: 340, dmg: 2, cd: 0.7, range: 280, hitR: 10 },
  // Enemy kinds: fodder swarms and does not clash; soldier is the old default; tank is armored; elite swings heavy every third attack.
  kinds: { fodder: { hp: 5, tier: 'leather', clash: false }, soldier: { clash: true }, tank: { hp: 14, tier: 'plate', clash: true },
           elite: { hp: 30, tier: 'mail', clash: true, heavyEvery: 3 } },
  enemyHeavy: { durMult: 1.5, hitMult: 1.6, dmgMult: 2.5 },
  // Grab: hold G beside a staggered or wounded enemy. Then throw, slam, or strike (short hold-and-strike). Damage = weapon damage x mult, armor PERCENT ignored, durability still wears by the same amount. PLACEHOLDERS.
  grab: { reach: 36, grip: 22, reachDur: 0.22, holdMax: 2.0, maxStrikes: 2,
    throw:  { dur: 0.55, hitAt: 0.30, mult: 3,   speed: 260, lob: 120, bowl: 1.5, after: 0.35 },
    slam:   { dur: 0.60, hitAt: 0.38, mult: 4,   after: 0.35, downed: 1.4 },
    strike: { dur: 0.35, hitAt: 0.15, mult: 1.5, after: 0.0 } },
  body: { height: 1.7, radius: 0.2 },     // PLACEHOLDER: a fighter's hit capsule, metres (side view)
  enemy:  { hp: 9, san: 5, chr: 5, speed: 46, atkDmg: 2, atkDur: 1.0, atkHitAt: 0.45, atkCool: 0.8, reach: 38, move: 'cut1|sword' },   // move: the baked path its swing uses, if the client provided one
  rallyPerChr: 0.004,                     // PLACEHOLDER: chance per second, per CHR point, that a fleeing enemy rallies (CHR 5 = 2%/s)
  player: { hp: 30, speed: 90 },
};

/* a weapon's fighting stats: its class, with the weapon's own overrides on top */
export function weaponStats(cfg, weaponKey) {
  const w = cfg.weapons[weaponKey]; if (!w) throw new Error('unknown weapon ' + weaponKey);
  const c = cfg.weaponClasses[w.cls]; if (!c) throw new Error('unknown weapon class ' + w.cls);
  return Object.assign({}, c, w);
}
export function swingInterval(cfg, weaponKey, stat) {
  return weaponStats(cfg, weaponKey).baseInterval * Math.max(0.35, 1 - cfg.dexStep * (stat - 5));
}
export const WINDOW_MARGIN = 0.05; // s of safety: frame quantization and hit-stop must not decide the kill
export function fitsWindow(cfg, weaponKey, dex) {
  return swingInterval(cfg, weaponKey, dex) <= cfg.woundedDur - WINDOW_MARGIN + 1e-9;
}
export function minDexForWindow(cfg, weaponKey) {
  for (let d = 5; d <= 99; d++) if (fitsWindow(cfg, weaponKey, d)) return d;
  return null;
}

/* small seeded generator: the same seed and inputs give the same fight, which a server-run sim needs */
export function hash32(a, b) { let h = Math.imul((a >>> 0) ^ 0x85EBCA6B, 0xC2B2AE35) ^ Math.imul((b >>> 0) + 0x27D4EB2F, 0x165667B1); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; return h >>> 0; }
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.get = () => a; f.set = v => { a = v >>> 0; };                   // saved and restored with the fight state (replays)
  return f;
}

/* ---------- replays: rules version, saved state, and the one way anything outside changes a fight ---------- */
export const SIM_VERSION = 5;                                       // bump when a rule changes, so old replays are flagged
const NOT_STATE = ['cfg', 'rng', 'fxRng', 'moves', 'fx', 'texts', 'textOut'];
// every outside change (input, spawns, settings) goes through here, live and in replays, so a replay repeats the fight exactly
export function applyCmd(sim, c) {
  switch (c.t) {
    case 'input': sim.input = { x: c.x, y: c.y, act: !!c.act, g: !!c.g, fin: c.fin || '', heavy: !!c.heavy, block: !!c.block, dash: !!c.dash, fire: !!c.fire, ax: c.ax == null ? null : c.ax, ay: c.ay == null ? null : c.ay }; break;
    case 'manual': sim.manual = !!c.on; break;
    case 'spawn': for (const o of c.list) sim.spawn(Object.assign({}, o, { index: sim.enemies.filter(e => e.state === 'alive').length % 5 })); if (c.say) sim.say('info', c.say); break;
    case 'clear': sim.clearEnemies(); sim.say('info', 'Arena cleared.'); break;
    case 'heal': sim.healAll(); break;
    case 'repair': sim.repairAll(); break;
    case 'resetp': sim.resetPlayer(); sim.say('info', 'Player reset.'); break;
    case 'set': for (const k of ['weapon', 'dex', 'dmgOverride', 'inv', 'move', 'kindMoves', 'skills', 'chainStyles', 'armorPct', 'dur', 'durMax', 'broken', 'hp', 'maxHp', 'san', 'chr']) if (k in c) sim.player[k] = c[k]; break;
    case 'ally': sim.spawnAlly(c.o); break;
    case 'mode': sim.mode = c.mode; break;
    case 'cfg': { const d = JSON.parse(JSON.stringify(c.cfg)); for (const k in d) sim.cfg[k] = d[k]; break; }
    case 'move': sim.moves[c.id] = c.data; break;
    case 'say': sim.say(c.kind || 'info', c.text); break;
  }
}

/* ---------- blade contact: baked weapon paths (rig/model3d.js bakeMove) tested against body capsules ---------- */
// animation time ("tau") for a swing at time t: the same mapping the renderer uses, so the blade you see is the blade that hits
export function moveTau(m, s, t) {
  const h = s.hitAt, ex = s.extra || 0;
  if (t < h) return m.t0 + (m.c - m.t0) * Math.max(0, t / h);
  if (t < h + ex) return m.c;
  return m.c + (m.end - m.c) * Math.min(1, (t - h - ex) / Math.max(0.05, s.dur - h - ex));
}
export function segAt(m, tau) {                                   // [handZ, handY, tipZ, tipY] in metres
  const u = Math.max(0, Math.min(1, (tau - m.t0) / Math.max(1e-6, m.end - m.t0))) * m.n, i = Math.min(m.n - 1, Math.floor(u)), f = u - i, a = m.seg[i], b = m.seg[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
}
function ptSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); const qx = ax + dx * t - px, qy = ay + dy * t - py; return Math.sqrt(qx * qx + qy * qy); }
function cross(ax, ay, bx, by, cx, cy) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }
export function segSegDist(a, b) {                               // a, b: [x1, y1, x2, y2]
  const d1 = cross(a[0], a[1], a[2], a[3], b[0], b[1]), d2 = cross(a[0], a[1], a[2], a[3], b[2], b[3]), d3 = cross(b[0], b[1], b[2], b[3], a[0], a[1]), d4 = cross(b[0], b[1], b[2], b[3], a[2], a[3]);
  if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return 0;
  return Math.min(ptSeg(a[0], a[1], b[0], b[1], b[2], b[3]), ptSeg(a[2], a[3], b[0], b[1], b[2], b[3]), ptSeg(b[0], b[1], a[0], a[1], a[2], a[3]), ptSeg(b[2], b[3], a[0], a[1], a[2], a[3]));
}
// does the move's hit shape at animation time tau touch a body standing at ex? (attacker at ax facing face; side view, px)
export function moveTouches(cfg, m, tau, ax, face, ex) {
  const P = cfg.pxPerM, R = cfg.body.radius * P, Hb = cfg.body.height * P, hb = m.hit, sg = segAt(m, tau);
  const X = z => ax + face * z * P, axis = [ex, 0, ex, Hb];
  if (hb.shape === 'box') {
    const x0 = Math.min(ax, X(hb.reach)), x1 = Math.max(ax, X(hb.reach)), y0 = (hb.y - hb.h / 2) * P, y1 = (hb.y + hb.h / 2) * P;
    return ex >= x0 - R && ex <= x1 + R && y1 >= 0 && y0 <= Hb;
  }
  if (hb.shape === 'circle') return ptSeg(X(sg[0]), sg[1] * P, ex, 0, ex, Hb) <= hb.r * P + R;
  return segSegDist([X(sg[0]), sg[1] * P, X(sg[2]), sg[3] * P], axis) <= R + (hb.w || 0.12) * P / 2;
}

// first of the targets ({x, y}) the move touches between swing times tPrev and t; 'past' once the hit window is over
export function sweepHit(cfg, m, s, tPrev, ax, ay, face, targets) {
  const a = moveTau(m, s, tPrev), b = moveTau(m, s, s.t);
  if (a > m.hit.f1) return 'past';
  const lo = Math.max(a, m.hit.f0), hi = Math.min(b, m.hit.f1); if (hi < lo) return null;
  for (let k = 0; k <= 3; k++) {
    const tau = lo + (hi - lo) * k / 3;
    for (const e of targets) if (Math.abs(e.y - ay) <= cfg.laneTol && moveTouches(cfg, m, tau, ax, face, e.x)) return e;
  }
  return null;
}

export class Sim {
  // rng: rules (wounded chance). fxRng: particles only, so cosmetic effects never shift the rules' random sequence
  constructor(cfg, seed) { this.cfg = cfg; this.seed = seed == null ? (Date.now() >>> 0) : seed; this.rng = makeRng(this.seed); this.fxRng = makeRng(this.seed ^ 0x9E3779B9); this.stepN = 0; this.events = []; this.resetAll(); }
  // the whole fight as plain data (no rules, no blade paths); fromState() rebuilds an identical sim
  saveState() {
    const o = {}; for (const k in this) if (!NOT_STATE.includes(k) && typeof this[k] !== 'function') o[k] = this[k];
    const st = JSON.parse(JSON.stringify(o, (k, v) => k[0] === '_' ? undefined : v)); st.rngState = this.rng.get ? this.rng.get() : null; st.fxRngState = this.fxRng.get ? this.fxRng.get() : null; return st;
  }
  static fromState(st, cfg, moves) {
    const s = new Sim(cfg, st.seed); const d = JSON.parse(JSON.stringify(st));
    const r = d.rngState, fr = d.fxRngState; delete d.rngState; delete d.fxRngState; Object.assign(s, d);
    if (r != null) s.rng.set(r); if (fr != null) s.fxRng.set(fr); s.moves = moves || {}; s.fx = []; s.texts = []; return s;
  }

  resetAll() {
    const c = this.cfg;
    this.t = 0; this.nextId = 1; this.shake = 0; this.manual = this.manual || false; this.proj = [];
    this.player = {
      x: 170, y: 282, face: 1, hp: c.player.hp, maxHp: c.player.hp,
      weapon: 'longsword', dex: 5, dmgOverride: null, inv: true,
      swing: null, chain: 0, cooldown: 0, moved: false, flash: 0, hurt: 0, walkT: 0, moving: false,
      armorPct: 0, dur: 0, durMax: 0, broken: false, chainStyles: null, san: 5, chr: 5,
      stamina: c.stamina.max, staminaMax: c.stamina.max, stamRegenT: 0, blocking: false, blockT: 0, stunT: 0, freeze: 0, dash: null, dashT: 99, kvx: 0, projCd: 0, counter: null, clashT: 0, clashMax: 0,
      skills: { riposte: false, shove: false }, kindMoves: {},   // worn armor as one pool (campaign gear); chainStyles: [{ style, move }] played in order
    };
    this.mode = this.mode || 'arena'; this.outcome = null; this.spawned = 0; this.allies = []; this.fallen = [];   // mode 'battle': a downed player loses the fight instead of being restored
    this.enemies = []; this.fx = []; this.texts = []; this.routed = 0;
    this.log = []; this.logVer = 0; this.lastHit = null;
    this.moves = this.moves || {};                                // baked weapon paths by move id; a move without one uses the reach rule
    this.input = { x: 0, y: 0, act: false, g: false, fin: '', heavy: false, block: false, dash: false, fire: false, ax: null, ay: null };
    this.actPrev = false; this.gPrev = false; this.finPrev = ''; this.heavyPrev = false; this.blockPrev = false; this.dashPrev = false; this.firePrev = false; this.lastClash = null;
  }
  clearEnemies() { this.enemies = []; this.fx = []; this.texts = []; }
  clearAllies() { this.allies = []; }
  resetPlayer() {
    const p = this.player; p.x = 170; p.y = 282; p.face = 1; p.hp = p.maxHp;
    p.swing = null; p.chain = 0; p.cooldown = 0; p.moved = false;
  }

  say(kind, text) {
    this.log.push({ t: this.t, kind, text });
    if (this.log.length > 80) this.log.shift();
    this.logVer++;
  }

  weaponInfo() {
    const p = this.player, w = weaponStats(this.cfg, p.weapon);
    return {
      key: p.weapon, cls: w.cls, label: w.label, reach: w.reach, twoHanded: w.twoHanded, kind: w.kind, posture: w.posture,
      dmg: p.dmgOverride != null ? p.dmgOverride : w.dmg,
      interval: swingInterval(this.cfg, p.weapon, p[w.speedStat] != null ? p[w.speedStat] : 5),
    };
  }

  /* ---------- spawning ---------- */
  spawn(opts) {
    const c = this.cfg, p = this.player;
    const K = c.kinds[opts.kind] || {};
    const tier = c.tiers[opts.tier] ? opts.tier : (c.tiers[K.tier] ? K.tier : 'leather');
    const i = opts.index || 0;
    const offs = [0, -26, 26, -52, 52];
    const e = {
      id: this.nextId++, x: Math.min(c.arena.right - 20, 380 + i * 46),
      y: this.clampY(p.y + offs[i % 5]), face: -1,
      hp: K.hp || c.enemy.hp, maxHp: K.hp || c.enemy.hp, san: opts.san != null ? opts.san : c.enemy.san, chr: opts.chr != null ? opts.chr : c.enemy.chr,
      tier, armorPct: c.tiers[tier].pct,
      dur: opts.dur != null ? opts.dur : c.tiers[tier].dur,
      durMax: opts.dur != null ? opts.dur : c.tiers[tier].dur,
      broken: false, wounded: 0, state: 'alive', flee: false,
      ai: opts.ai === 'advance' ? 'advance' : 'stand',
      atk: null, atkCd: 0.6, deathT: 0, dramatic: false, vx: 0, vz: 0, z: 0, walkT: 0, moving: false, flash: 0, hurt: 0,
      kind: opts.kind || 'soldier', clash: K.clash !== false, heavyEvery: K.heavyEvery || 0, atkN: 0, kvx: 0, freeze: 0, clashT: 0,
    };
    e.lookSeed = hash32(this.seed, e.id);                        // picks this enemy's parts and colours from its rank's pools (client side)
    this.enemies.push(e); this.spawned++;
    return e;
  }
  // a hired fighter on your side: fights with the same weapon classes and armor rules, steers itself
  spawnAlly(o) {
    const c = this.cfg, p = this.player, t = c.tiers[o.tier] ? o.tier : 'leather', w = o.weapon && c.weapons[o.weapon] ? o.weapon : 'longsword', i = o.index || 0, offs = [26, -26, 52, -52, 0];
    const a = {
      id: this.nextId++, hid: o.hid || null, name: o.name || 'Hireling', x: Math.max(c.arena.left + 10, p.x - 34 - i * 30), y: this.clampY(p.y + offs[i % 5]), face: 1,
      hp: o.hp || 18, maxHp: o.hp || 18, tier: t, armorPct: o.armorPct != null ? o.armorPct : c.tiers[t].pct,
      dur: o.dur != null ? o.dur : c.tiers[t].dur, durMax: o.dur != null ? o.dur : c.tiers[t].dur, broken: false,
      weapon: w, dex: o.dex || 5, state: 'alive', atk: null, atkCd: 0.5, deathT: 0, vx: 0, vz: 0, z: 0, walkT: 0, moving: false, flash: 0, hurt: 0, kvx: 0,
      look: o.look || null, lookSeed: hash32(this.seed, this.nextId * 7),
    };
    this.allies.push(a); return a;
  }
  healAll() { this.enemies.forEach(e => { if (e.state === 'alive') e.hp = e.maxHp; }); this.say('info', 'All enemies healed.'); }
  repairAll() {
    let n = 0;
    this.enemies.forEach(e => {
      if (e.state !== 'alive') return;
      if (e.broken || e.dur < e.durMax) { e.broken = false; e.dur = e.durMax; n++; }
      e.flee = false;
    });
    this.say('info', 'Support unit repaired armor on ' + n + ' enemy(ies).');
  }

  clampY(y) { return Math.max(this.cfg.band.top, Math.min(this.cfg.band.bottom, y)); }
  clampX(x) { return Math.max(this.cfg.arena.left, Math.min(this.cfg.arena.right, x)); }
  effSan(e) { return e.san * (e.broken ? this.cfg.abreak.sanMult : 1); }

  /* ---------- main step ---------- */
  step(dt) {
    this.stepN++;
    const I = this.input, edge = (now, key) => { const v = !!now, pr = v && !this[key]; this[key] = v; return pr; };   // a press is the moment the key goes down
    const pressed = edge(I.act, 'actPrev'), gPress = edge(I.g, 'gPrev'), heavyP = edge(I.heavy, 'heavyPrev'), blockP = edge(I.block, 'blockPrev'), dashP = edge(I.dash, 'dashPrev'), fireP = edge(I.fire, 'firePrev');
    const fin = I.fin || '', finPress = fin && fin !== this.finPrev ? fin : ''; this.finPrev = fin;
    this._press = { act: pressed, g: gPress, fin: finPress, heavy: heavyP, block: blockP, dash: dashP, fire: fireP };
    if (this.shake > 0) this.shake -= dt;
    this.t += dt;                                                      // one clock for everyone: nothing in the game slows or stops time
    this.checkClash();
    const p = this.player;
    if (p.freeze > 0) { p.freeze -= dt; p.moving = false; if (p.clashT > 0) p.clashT -= dt; }   // only a clashing fighter holds, for a few frames
    else this.updatePlayer(dt);
    for (const e of this.enemies) { if (e.freeze > 0) { e.freeze -= dt; e.moving = false; if (e.clashT > 0) e.clashT -= dt; continue; } this.updateEnemy(e, dt); }
    for (const a of this.allies) this.updateAlly(a, dt);
    this.updateProj(dt);
    this.enemies = this.enemies.filter(e => !(e.state === 'dying' && e.deathT > 2.6) && e.state !== 'routed');
    if (this.mode === 'battle' && !this.outcome) {
      if (this.player.hp <= 0) this.outcome = 'lost';
      else if (this.spawned > 0 && !this.enemies.some(e => e.state === 'alive')) this.outcome = 'won';
    }
    this.updateFx(dt);
  }
  kv(o, dt) {                                                          // a push (clash bounce, shockwave): glides and fades, bounded
    if (!o.kvx) return;
    o.x = this.clampX(o.x + o.kvx * dt); o.kvx *= Math.max(0, 1 - this.cfg.clash.decay * dt); if (Math.abs(o.kvx) < 4) o.kvx = 0;
  }
  regenStamina(dt) { const p = this.player, S = this.cfg.stamina; if (p.stamRegenT > 0) { p.stamRegenT -= dt; return; } if (p.stamina < p.staminaMax) p.stamina = Math.min(p.staminaMax, p.stamina + S.regen * dt); }

  /* ---------- player ---------- */
  findTarget(w) {
    const p = this.player, c = this.cfg;
    let best = null, bd = 1e9;
    for (const e of this.enemies) {
      if (e.state !== 'alive') continue;
      const dx = Math.abs(e.x - p.x), dy = Math.abs(e.y - p.y);
      if (dy <= c.laneTol && dx <= w.reach + 8 && dx < bd) { best = e; bd = dx; }
    }
    return best;
  }

  swingDmg(s, w) { return Math.max(1, Math.floor(w.dmg * ((s && s.mult) || 1) + 1e-9)); }
  // kind: light | heavy | dash | counter. Heavy cannot clash; dash lunges; counter is the free swing after a parry or riposte.
  startSwing(kind, w, tgt) {
    const p = this.player, c = this.cfg, A = c.attack[kind] || {}, base = w.interval;
    const dur = kind === 'light' ? base : base * A.durMult, hitAt = kind === 'light' ? base * 0.45 : dur * A.hitFrac;
    const cs = kind === 'light' && p.chainStyles && p.chainStyles.length ? p.chainStyles[p.chain % p.chainStyles.length] : null;
    const move = (p.kindMoves && p.kindMoves[kind]) || (cs ? cs.move : (p.move || null));
    p.swing = { t: 0, dur, dur0: dur, hitAt, hit: false, target: tgt == null ? null : tgt, whiff: false, dramatic: false, extra: 0, move, style: cs ? cs.style : null, kind, mult: A.mult || 1, pierce: A.pierce || 0, after: A.after || 0 };
    p.moved = false;
    if (kind === 'dash') p.lunge = { t: 0.18, v: c.dash.lunge };
    if (tgt != null) { const e = this.enemies.find(x => x.id === tgt); if (e) p.face = e.x >= p.x ? 1 : -1; }
    return p.swing;
  }

  updatePlayer(dt) {
    const p = this.player, c = this.cfg, w = this.weaponInfo(), I = this.input, pr = this._press || {};
    let ix = I.x, iy = I.y;
    const mag = Math.sqrt(ix * ix + iy * iy);                     // not Math.hypot: identical results on every engine (replays, server)
    if (mag > 1) { ix /= mag; iy /= mag; }
    p.flash = Math.max(0, p.flash - dt); p.hurt = Math.max(0, (p.hurt || 0) - dt);
    this.kv(p, dt);
    if (p.clashT > 0) p.clashT -= dt;
    if (p.projCd > 0) p.projCd -= dt;
    for (const k of ['parryT', 'shotT', 'blockHitT']) if (p[k] > 0) p[k] -= dt;
    this.regenStamina(dt);
    if (I.fire && p.projCd <= 0 && !p.grab && !(p.stunT > 0)) this.fireProj();
    if (p.grab) { p.moving = false; this.updateGrab(dt); return; }   // holding someone: planted until you let go
    if (p.stunT > 0) { p.stunT -= dt; p.moving = false; p.blocking = false; return; }   // guard broken
    if (this.manual) { this.updateManual(dt, w, ix, iy, mag); return; }
    const swinging = !!p.swing;
    const spd = c.player.speed * (swinging ? c.swingMoveMult : 1);
    p.moving = mag > 0;
    if (p.moving) {
      p.x = this.clampX(p.x + ix * spd * dt);
      p.y = this.clampY(p.y + iy * spd * dt * 0.7);
      p.moved = true; p.walkT += dt;
      if (!swinging && ix !== 0) p.face = Math.sign(ix);
    }
    if (p.cooldown > 0) p.cooldown -= dt;
    const goG = !!I.g;                                               // holding G: reach for a staggered enemy instead of swinging
    if (goG && this.tryGrab(!!pr.g)) return;

    if (p.swing) {
      const s = p.swing, t0 = s.t; s.t += dt;
      const m = s.move && this.moves[s.move];
      if (m && m.seg) { if (!s.hit) this.bladeCheck(s, m, t0, w); }
      else if (!s.hit && s.t >= s.hitAt) { s.hit = true; this.playerStrike(s, w); }
      if (s.t >= s.dur) {
        if (p.moved) { this.breakChain('you moved'); p.cooldown = c.moveBreakDelay; }
        else p.chain++;
        p.swing = null;
      }
    }
    if (!p.swing && p.cooldown <= 0 && !goG) {
      const tgt = this.findTarget(w);
      if (tgt) { p.face = tgt.x >= p.x ? 1 : -1; this.startSwing('light', w, tgt.id); }
    }
  }

  /* Manual combat (design): nothing swings by itself. Mouse side = facing; left click light, right click heavy, hold block (press = parry),
     dash spends stamina and a click during or just after it is a dash attack; the cursor aims throws and shots. */
  updateManual(dt, w, ix, iy, mag) {
    const p = this.player, c = this.cfg, I = this.input, pr = this._press || {}, S = c.stamina, D = c.dash;
    p.dashT = Math.min(99, p.dashT + dt);
    if (!I.block) p.blockLock = false;
    if (p.dash) {                                                     // mid-dash: carried along; a click turns it into the dash attack
      const d = p.dash; d.t += dt;
      p.x = this.clampX(p.x + d.dx * D.speed * dt); p.y = this.clampY(p.y + d.dy * D.speed * dt * 0.7); p.moving = true; p.walkT += dt;
      if (pr.act) { p.dash = null; this.startSwing('dash', w); return; }
      if (d.t >= D.dur) p.dash = null;
      return;
    }
    if (pr.dash && !p.swing && p.stamina >= S.dashCost) {
      p.stamina -= S.dashCost; p.stamRegenT = S.regenDelay; p.blocking = false;
      const dx = mag > 0.1 ? ix / mag : p.face, dy = mag > 0.1 ? iy / mag : 0;
      p.dash = { t: 0, dx, dy }; p.dashT = 0; p.moving = true; return;
    }
    const wantBlock = !!I.block && !p.swing && !p.blockLock && p.stamina > 0;
    if (wantBlock && !p.blocking) { p.blocking = true; p.blockT = 0; p.stamina = Math.max(0, p.stamina - S.blockPress); }
    else if (!wantBlock) p.blocking = false;
    if (p.blocking) { p.blockT += dt; p.stamRegenT = S.regenDelay; }
    const spd = c.player.speed * (p.swing ? c.swingMoveMult : 1) * (p.blocking ? 0.5 : 1);
    p.moving = mag > 0;
    if (p.moving) { p.x = this.clampX(p.x + ix * spd * dt); p.y = this.clampY(p.y + iy * spd * dt * 0.7); p.walkT += dt; }
    if (p.lunge && p.lunge.t > 0) { p.lunge.t -= dt; p.x = this.clampX(p.x + p.face * p.lunge.v * dt); }
    if (!p.swing) {                                                   // the mouse's side is the way you face
      if (I.ax != null) { if (Math.abs(I.ax - p.x) > 6) p.face = I.ax >= p.x ? 1 : -1; }
      else if (ix !== 0) p.face = Math.sign(ix);
    }
    if (p.cooldown > 0) p.cooldown -= dt;
    if (I.g && this.tryGrab(!!pr.g)) return;
    if (p.swing) {
      const s = p.swing, t0 = s.t; s.t += dt;
      const m = s.move && this.moves[s.move];
      if (m && m.seg) { if (!s.hit) this.bladeCheck(s, m, t0, w); }
      else if (!s.hit && s.t >= s.hitAt) { s.hit = true; this.playerStrike(s, w); }
      if (s.t >= s.dur) { p.chain++; p.cooldown = Math.max(p.cooldown, s.after || 0); p.swing = null; }
    }
    if (!p.swing && p.counter) { const tg = p.counter.eId; p.counter = null; this.startSwing('counter', w, tg); return; }
    if (!p.swing && !p.blocking && p.cooldown <= 0 && !I.g) {
      if (pr.heavy) this.startSwing('heavy', w);
      else if (pr.act && p.dashT <= D.atkWin) this.startSwing('dash', w);
      else if (I.act) this.startSwing('light', w);
    }
  }

  /* ---------- projectiles: fired toward the cursor ---------- */
  fireProj() {
    const p = this.player, P = this.cfg.proj, I = this.input;
    let dx = I.ax == null ? p.face : I.ax - p.x, dy = I.ay == null ? 0 : I.ay - p.y;
    const L = Math.sqrt(dx * dx + dy * dy) || 1; dx /= L; dy /= L;
    if (dx * p.face < 0.2) dx = p.face * 0.2;                          // the shot goes the way you face
    dy = Math.max(-0.6 * Math.abs(dx), Math.min(0.6 * Math.abs(dx), dy));
    const L2 = Math.sqrt(dx * dx + dy * dy); dx /= L2; dy /= L2;
    this.proj.push({ id: this.nextId++, x: p.x + p.face * 14, y: p.y, vx: dx * P.speed, vy: dy * P.speed, life: P.range / P.speed, dmg: P.dmg });
    p.projCd = P.cd; p.shotT = 0.25;
  }
  updateProj(dt) {
    const c = this.cfg;
    for (const q of this.proj) {
      q.x += q.vx * dt; q.y = this.clampY(q.y + q.vy * dt); q.life -= dt;
      if (q.x < c.arena.left || q.x > c.arena.right) q.life = 0;
      if (q.life <= 0) continue;
      for (const e of this.enemies) {
        if (e.state !== 'alive' || e.held || e.fly) continue;
        if (Math.abs(e.x - q.x) <= c.proj.hitR && Math.abs(e.y - q.y) <= c.laneTol) { this.applyHit(e, q.dmg, null); this.burst(q.x, q.y - 40, 5, '#f4ecd8', 90); q.life = 0; break; }
      }
    }
    this.proj = this.proj.filter(q => q.life > 0);
  }

  /* ---------- Grab: seize a staggered or wounded enemy, then throw, slam or strike ---------- */
  grabbable(e) { return e.state === 'alive' && !e.held && !e.fly && (e.stun > 0 || e.wounded > 0); }
  tryGrab(announce) {
    const p = this.player, c = this.cfg; let best = null, bd = 1e9;
    for (const e of this.enemies) {
      if (!this.grabbable(e)) continue;
      const dx = Math.abs(e.x - p.x), dy = Math.abs(e.y - p.y);
      if (dy <= c.laneTol && dx <= c.grab.reach && dx < bd) { best = e; bd = dx; }
    }
    if (!best) { if (announce) this.text(p.x, p.y - 96, 'NOTHING TO GRAB', '#b7ab9a', 9); return false; }
    p.face = best.x >= p.x ? 1 : -1; p.swing = null; p.chain = 0; p.moved = false;
    best.held = true; best.atk = null; best.stun = 0; best.wounded = 0;
    p.grab = { eId: best.id, phase: 'reach', t: 0, dur: c.grab.reachDur, hit: false, strikes: 0, holdT: 0 };
    this.say('info', 'Grab: seized enemy #' + best.id + '.');
    return true;
  }
  grabVictim() { const g = this.player.grab; return g && this.enemies.find(x => x.id === g.eId); }
  endGrab(stun, down) {
    const p = this.player, e = this.grabVictim();
    if (e) { e.held = false; if (e.state === 'alive' && stun > 0) { e.stun = Math.max(e.stun || 0, stun); if (down) e.down = true; } }
    p.grab = null;
  }
  updateGrab(dt) {
    const p = this.player, c = this.cfg, G = c.grab, g = p.grab, e = this.grabVictim(), pr = this._press || {};
    if (!e || e.state !== 'alive') { p.grab = null; return; }
    g.t += dt; if (e.held) { e.x = this.clampX(p.x + p.face * G.grip); e.y = p.y; e.face = -p.face; }
    if (g.phase === 'reach') { if (g.t >= g.dur) { g.phase = 'hold'; g.t = 0; } return; }
    if (g.phase === 'hold') {
      g.holdT += dt;
      const pick = (pr.fin === 'throw' || pr.heavy) ? 'throw' : pr.fin === 'slam' ? 'slam' : (pr.fin === 'strike' || pr.act) ? 'strike' : null;   // right click throws, left click strikes
      if (pick === 'strike' && g.strikes >= G.maxStrikes) return;
      if (pick) { g.phase = pick; g.t = 0; g.dur = G[pick].dur; g.hit = false; this.say('info', 'Grab: ' + pick + '.'); return; }
      if (g.holdT >= G.holdMax) { this.text(p.x, p.y - 100, 'LOST GRIP', '#b7ab9a', 9); this.endGrab(0.5); }
      return;
    }
    const F = G[g.phase];
    if (!g.hit && g.t >= F.hitAt) {
      g.hit = true; const w = this.weaponInfo(), raw = Math.max(1, Math.floor(w.dmg * F.mult + 1e-9));
      this.text(p.x, p.y - 112, g.phase.toUpperCase(), '#ffd27a', 11); this.shake = Math.max(this.shake, 0.14);
      this.applyHit(e, raw, null, g.phase);
      if (e.state !== 'alive') { e.held = false; p.grab = null; p.cooldown = F.after; return; }
      if (g.phase === 'throw') {                                       // thrown toward the cursor, up to a range
        const I = this.input, A = c.aim; let dx = I.ax == null ? p.face * 100 : I.ax - e.x, dy = I.ay == null ? 0 : I.ay - e.y;
        const L = Math.sqrt(dx * dx + dy * dy) || 1, R = Math.max(30, Math.min(A.throwRange, L)); dx = dx / L * R; dy = dy / L * R * 0.7;
        e.held = false; e.fly = { vx: dx / A.throwAir, vy: dy / A.throwAir, vz: G.throw.lob, hit: [], fr: 1 }; e.z = 1;
      }
      else if (g.phase === 'slam') { this.burst(e.x, e.y, 10, '#8a7a6a', 90); }
    }
    if (g.t >= F.dur) {
      if (g.phase === 'strike') { g.strikes++; g.phase = 'hold'; g.t = 0; g.holdT = 0; return; }   // back to holding, more choices
      p.cooldown = F.after;
      if (g.phase === 'slam') this.endGrab(G.slam.downed, true); else p.grab = null;
    }
  }
  // a thrown enemy: flies, knocks over anyone in the way, lands staggered
  updateFly(e, dt) {
    const c = this.cfg, f = e.fly;
    e.x = this.clampX(e.x + f.vx * dt); if (f.vy) e.y = this.clampY(e.y + f.vy * dt); e.z += f.vz * dt; f.vz -= 620 * dt; f.vx *= (f.fr || 0.985);
    for (const o of this.enemies) {
      if (o === e || o.state !== 'alive' || o.held || f.hit.includes(o.id) || Math.abs(o.y - e.y) > c.laneTol || Math.abs(o.x - e.x) > 18) continue;
      f.hit.push(o.id); o.stun = Math.max(o.stun || 0, 1.0); o.atk = null;
      const raw = Math.max(1, Math.floor(this.weaponInfo().dmg * c.grab.throw.bowl + 1e-9));
      this.applyHit(o, raw, null, 'bowl'); this.text(o.x, o.y - 120, 'STRIKE!', '#ffd27a', 10);
    }
    if ((e.z <= 0 && f.vz < 0) || (!f.fr && Math.abs(f.vx) < 6)) { e.z = 0; e.fly = null; e.stun = c.grab.slam.downed; e.down = true; this.burst(e.x, e.y, 8, '#8a7a6a', 80); this.shake = Math.max(this.shake, 0.1); }
  }

  // the blade's path between the last step and this one, inside the move's hit window, against every enemy in the lane
  bladeCheck(s, m, tPrev, w) {
    const p = this.player, r = sweepHit(this.cfg, m, s, tPrev, p.x, p.y, p.face, this.enemies.filter(e => e.state === 'alive'));
    if (r === 'past') { s.hit = true; s.whiff = true; this.text(p.x + p.face * 40, p.y - 70, 'MISS', '#b7ab9a', 10); }
    else if (r) { s.hit = true; s.target = r.id; this.applyHit(r, this.swingDmg(s, w), s); }
  }

  /* ---------- Clash ---------- */
  checkClash() {
    const p = this.player, c = this.cfg, K = c.clash, s = p.swing;
    if (!s || s.hit || s.kind === 'heavy' || p.grab || p.freeze > 0) return;
    const inWin = (t, hitAt) => t >= hitAt * K.early && t <= hitAt + K.late;
    if (!inWin(s.t, s.hitAt)) return;
    const w = this.weaponInfo(), pm = s.move && this.moves[s.move], em = this.moves[c.enemy.move];
    let best = null, bd = 1e9;
    for (const e of this.enemies) {                                   // one clash at a time: the nearest opposing swing (a multi-clash skill comes later)
      const a = e.atk;
      if (e.state !== 'alive' || !a || a.hit || a.heavy || e.clash === false || e.freeze > 0 || e.held || e.fly) continue;
      if (Math.abs(e.y - p.y) > c.laneTol || Math.sign(e.x - p.x) !== p.face) continue;
      const aDur = a.dur || c.enemy.atkDur, aHit = a.hitAt || c.enemy.atkHitAt;
      if (!inWin(a.t, aHit)) continue;
      let ok;
      if (pm && pm.seg && em && em.seg) {                             // baked blades: the two blade segments cross
        const es = { t: a.t, dur: aDur, hitAt: aHit, extra: 0 };
        const A = this.bladePx(pm, s, s.t, p.x, p.face), B = this.bladePx(em, es, es.t, e.x, e.face);
        ok = segSegDist(A, B) <= ((pm.hit.w || 0.12) + (em.hit.w || 0.12)) * c.pxPerM / 2;
      } else ok = Math.abs(e.x - p.x) <= w.reach + c.enemy.reach;     // no baked path: the two reaches overlap
      if (ok) { const d = Math.abs(e.x - p.x); if (d < bd) { best = e; bd = d; } }
    }
    if (best) this.doClash(best);
  }
  bladePx(m, s, t, x, face) {                                        // a swing's blade as a segment in sim px, height up
    const g = segAt(m, moveTau(m, s, t)), P = this.cfg.pxPerM;
    return [x + face * g[0] * P, g[1] * P, x + face * g[2] * P, g[3] * P];
  }
  // No winner: both swings stop, both fighters hold a few frames and bounce back, everyone nearby is shoved away.
  doClash(e) {
    const p = this.player, c = this.cfg, K = c.clash, sk = p.skills || {};
    const cx = (p.x + e.x) / 2, dir = Math.sign(e.x - p.x) || 1;
    p.swing = null; p.chain = 0; p.cooldown = Math.max(p.cooldown, 0.1); p.moved = false; p.lunge = null;
    p.freeze = K.freeze; p.clashT = K.dur; p.clashMax = K.dur;
    e.atk = null; e.atkCd = K.enemyCd; e.freeze = K.freeze; e.clashT = K.dur; e.clashMax = K.dur;
    if (sk.riposte) p.counter = { eId: e.id }; else p.kvx = -dir * K.knock;        // riposte (passive): no bounce, a counter-swing at once
    if (sk.shove) { e.kvx = dir * K.knock * K.shoveMult; e.stun = Math.max(e.stun || 0, K.shoveStun); e.down = false; }   // break guard: shoved far and stunned
    else e.kvx = dir * K.knock;
    this.shockwave(cx, p.y, [e.id]);
    this.burst(cx, p.y - 60, 12, '#ffe7a0', 130); this.text(cx, p.y - 96, 'CLASH', '#ffe27a', 11); this.shake = Math.max(this.shake, 0.1);
    this.lastClash = { at: this.t, eId: e.id, x: cx };
    this.say('clash', 'CLASH with enemy #' + e.id + (sk.riposte ? ' (riposte)' : '') + (sk.shove ? ' (shove)' : '') + '.');
  }
  shockwave(cx, cy, skip) {                                          // bounded and deterministic: a push that fades with distance
    const K = this.cfg.clash.wave, lane = this.cfg.laneTol * 3;
    const push = o => {
      if (o.state !== 'alive' || o.held || o.fly || skip.includes(o.id)) return;
      const dx = o.x - cx, d = Math.abs(dx); if (d > K.radius || Math.abs(o.y - cy) > lane) return;
      o.kvx = Math.max(-K.max, Math.min(K.max, (o.kvx || 0) + (Math.sign(dx) || 1) * K.push * (1 - d / K.radius)));
    };
    for (const o of this.enemies) push(o); for (const a of this.allies) push(a);
  }
  // a hit on you while blocking: a dodge in the first dash frames, a parry if the block was just pressed, a block for light hits
  defend(e, heavy) {
    const p = this.player, c = this.cfg, S = c.stamina;
    if (p.dash && p.dash.t < c.dash.iframes) { this.text(p.x, p.y - 96, 'DODGE', '#9fd0ff', 10); return true; }
    if (!p.blocking || Math.sign(e.x - p.x) !== p.face) return false;
    if (p.blockT <= S.parryWin) {                                     // perfect block
      e.atk = null; e.atkCd = 0.6; e.stun = Math.max(e.stun || 0, S.parryStun); e.down = false;
      p.stamina = Math.min(p.staminaMax, p.stamina + S.parryRefund); p.blocking = false; p.blockLock = true; p.counter = { eId: e.id }; p.parryT = 0.3;
      this.text(p.x, p.y - 100, 'PARRY!', '#ffe27a', 12); this.burst(p.x + p.face * 20, p.y - 60, 14, '#fff2c0', 150); this.shake = Math.max(this.shake, 0.12);
      this.say('clash', 'Parry: enemy #' + e.id + ' staggered, stamina back, free counter.');
      return true;
    }
    if (heavy) return false;                                          // a plain block does not stop a heavy
    p.stamina -= S.blockHit; p.stamRegenT = S.regenDelay; p.blockHitT = 0.2;
    this.burst(p.x + p.face * 18, p.y - 56, 6, '#cfd8e6', 90); this.text(p.x, p.y - 96, 'BLOCK', '#cfd8e6', 10);
    if (p.stamina <= 0) { p.stamina = 0; p.blocking = false; p.blockLock = true; p.stunT = S.breakStun; this.text(p.x, p.y - 110, 'GUARD BROKEN', '#ff9a6a', 10); this.say('info', 'Guard broken: stunned.'); }
    return true;
  }

  breakChain(why) {
    const p = this.player;
    if (p.chain > 0) { this.say('info', 'Chain reset (' + why + ').'); this.text(p.x, p.y - 108, 'CHAIN BROKEN: ' + why, '#ff9a6a', 9); }
    p.chain = 0;
  }

  playerStrike(s, w) {
    const p = this.player;
    let e = this.enemies.find(x => x.id === s.target);
    const ok = e && e.state === 'alive' && Math.abs(e.y - p.y) <= this.cfg.laneTol && Math.abs(e.x - p.x) <= w.reach + 8;
    if (!ok) e = this.findTarget(w);
    if (!e) { s.whiff = true; this.text(p.x + p.face * 40, p.y - 70, 'MISS', '#b7ab9a', 10); return; }
    this.applyHit(e, this.swingDmg(s, w), s);
  }

  /* ---------- the rules under test ---------- */
  applyHit(e, raw, swing, fin) {
    const c = this.cfg, p = this.player;   // fin: a grab finisher; armor percent ignored, durability still wears, no crit or wound rules
    const wasW = e.wounded > 0, wasB = e.broken;
    const crit = !fin && (wasW || wasB);
    const pct = (wasB || fin) ? 0 : e.armorPct * (1 - ((swing && swing.pierce) || 0));
    const red = v => Math.max(1, Math.floor(v * (1 - pct) + 1e-9));
    let dmg;
    if (crit) dmg = c.critOrder === 'before' ? red(raw * c.critMult) : red(raw) * c.critMult;
    else dmg = red(raw);

    const hpBefore = e.hp, durBefore = e.dur;
    e.hp = Math.max(0, e.hp - dmg);
    let brokeNow = false;
    if (!e.broken && e.durMax > 0) {
      e.dur = Math.max(0, e.dur - raw);   // a finisher's raw is its full heavy damage, so it wears the set heavily too
      if (e.dur <= 0) { e.broken = true; brokeNow = true; }
    }
    const thr = e.broken ? 0 : c.woundedThreshold;
    const dead = e.hp <= 0;
    const rec = {
      raw, pct: Math.round(pct * 100), crit, critCause: wasB ? 'Armor Break' : (wasW ? 'Wounded' : ''),
      dmg, hpBefore, hpAfter: e.hp, durBefore, durAfter: e.dur, durMax: e.durMax,
      threshold: thr, woundedSet: false, dead, dramatic: false, notes: [], tier: c.tiers[e.tier].label,
    };

    e.flash = 0.12; e.hurt = 0.6;                                  // flash is the white blink; hurt times the custom damaged animation (visual only)
    this.burst(e.x, e.y - 48, crit ? 14 : 8, crit ? '#ffe08a' : '#f4ecd8', crit ? 150 : 100);
    this.text(e.x, e.y - 96, (crit ? 'CRIT ' : '') + '-' + dmg, crit ? '#ffd27a' : '#ffffff', crit ? 12 : 10);

    let line = (crit ? 'CRIT x2 (' + rec.critCause + ') ' : '') + 'Hit ' + raw + ' vs ' + rec.tier + ' -' + rec.pct + '% = ' + dmg + ' dmg, HP ' + hpBefore + '>' + e.hp;
    if (brokeNow) { this.say('break', 'ARMOR BREAK: durability gone (' + durBefore + ' > 0). SAN -50%, speed +25%, armor 0, crits on every hit.'); rec.notes.push('Armor broke on this hit'); this.burst(e.x, e.y - 40, 16, '#9aa7b6', 170); this.text(e.x, e.y - 110, 'ARMOR BREAK', '#ff9a6a', 10); }

    if (dead) {
      rec.dramatic = wasW;
      this.kill(e, wasW, swing);
      this.say(wasW ? 'kill' : 'hit', line + (wasW ? '  | KILLED WHILE WOUNDED (dramatic)' : '  | KILLED'));
    } else if (fin) {
      this.say('hit', line + '  | ' + fin.toUpperCase() + ' (armor % ignored)');
    } else {
      let setW = false, consumed = false;
      if (e.broken) setW = dmg > 0;
      else if (wasW) consumed = true;
      else if (dmg >= thr) {
        if (this.rng() < c.woundedChance) setW = true; else rec.notes.push('Wounded chance roll failed');
      } else rec.notes.push('Damage ' + dmg + ' is below the wounded threshold ' + thr);
      if (consumed) { e.wounded = 0; rec.notes.push('Crit consumed Wounded; enemy shrugs it off'); this.checkFlee(e); }
      if (setW) { e.wounded = c.woundedDur; e.atk = null; rec.woundedSet = true; this.text(e.x, e.y - 110 + (brokeNow ? -12 : 0), 'WOUNDED', '#ffd27a', 10); }
      this.say(setW ? 'wound' : 'hit', line + (setW ? '  | WOUNDED ' + c.woundedDur + 's' : (consumed ? '  | shrugs it off' : '')));
    }
    this.lastHit = rec;
  }

  kill(e, dramatic, swing) {
    const p = this.player;
    e.state = 'dying'; e.deathT = 0; e.dramatic = dramatic; e.wounded = 0; e.atk = null; e.flee = false;
    this.events.push({ kind: dramatic ? 'dramatic' : 'kill', step: this.stepN, x: e.x, y: e.y, id: e.id }); if (this.events.length > 20) this.events.shift();   // kill cams
    const dir = Math.sign(e.x - p.x) || 1;
    if (dramatic) {
      e.vx = dir * 230; e.vz = 190;
      if (swing && !this.manual) { swing.dramatic = true; swing.dur += this.cfg.dramaticExtend; swing.extra = this.cfg.dramaticExtend; }   // legacy modes only: a held pose
      this.shake = 0.3;
      this.burst(e.x, e.y - 48, 30, '#ff8a5c', 260);
      this.burst(e.x, e.y - 48, 12, '#ffe08a', 200);
    } else {
      e.vx = dir * 26; e.vz = 0;
      this.burst(e.x, e.y - 40, 6, '#d65a4a', 70);
    }
  }

  checkFlee(e) {
    if (e.state === 'alive' && !e.flee && this.effSan(e) <= this.cfg.fleeSan) {
      e.flee = true;
      this.say('flee', 'Enemy SAN ' + this.effSan(e).toFixed(1) + ' <= ' + this.cfg.fleeSan + ': it flees.');
      this.text(e.x, e.y - 110, 'FLEEING', '#9fd0ff', 10);
    }
  }

  /* ---------- enemies ---------- */
  updateEnemy(e, dt) {
    const c = this.cfg, p = this.pickTarget(e);                    // the nearest of you and your hirelings
    e.flash = Math.max(0, e.flash - dt); e.hurt = Math.max(0, (e.hurt || 0) - dt);
    if (e.state === 'dying') {
      e.deathT += dt;
      if (e.dramatic) {
        if (e.z > 0 || e.vz > 0) { e.z += e.vz * dt; e.vz -= 620 * dt; if (e.z <= 0) { e.z = 0; e.vz = 0; this.burst(e.x, e.y, 6, '#8a7a6a', 60); } }
        e.x = this.clampX(e.x + e.vx * dt); e.vx *= 0.975;
      } else { e.x = this.clampX(e.x + e.vx * dt); e.vx *= 0.9; }
      return;
    }
    e.moving = false;
    if (e.clashT > 0) e.clashT -= dt;
    if (e.held || e.fly) e.kvx = 0; else this.kv(e, dt);
    if (e.held) return;                                              // in the player's grip: pinned by updateGrab
    if (e.fly) { this.updateFly(e, dt); return; }
    if (!p) return;                                                  // nobody left standing to fight
    if (e.stun > 0) { e.stun -= dt; if (e.stun <= 0) e.down = false; return; }                         // staggered after losing a clash
    if (e.wounded > 0) {
      e.wounded -= dt;
      if (e.wounded <= 0) { e.wounded = 0; this.checkFlee(e); }
      return;
    }
    const spd = c.enemy.speed * (e.broken ? c.abreak.speedMult : 1);
    const dx = p.x - e.x, dy = p.y - e.y;
    if (e.flee) {
      if (this.rng() < Math.min(1, e.chr * c.rallyPerChr) * dt) {   // small CHR-based chance to stop running and fight again
        e.flee = false;
        this.say('flee', 'Enemy rallies (CHR ' + e.chr + ').'); this.text(e.x, e.y - 110, 'RALLIES', '#ffd27a', 10);
        return;
      }
      const dir = Math.sign(e.x - p.x) || 1;
      const nx = this.clampX(e.x + dir * spd * 1.1 * dt);
      e.moving = nx !== e.x; e.x = nx; e.face = dir; e.walkT += dt;
      if (nx === (dir > 0 ? c.arena.right : c.arena.left)) {           // reached the edge: off the field, counted as routed
        e.state = 'routed'; this.routed = (this.routed || 0) + 1;
        this.say('flee', 'Enemy routed off the field (' + this.routed + ' so far).');
      }
      return;
    }
    e.face = dx >= 0 ? 1 : -1;
    if (e.ai !== 'advance') return;

    if (e.atk) {
      const t0 = e.atk.t; e.atk.t += dt;
      const m = this.moves[c.enemy.move];
      if (m && m.seg) {                                            // blade path: the swing lands only if the sword reaches you
        if (!e.atk.hit) {
          const s = { t: e.atk.t, dur: e.atk.dur || c.enemy.atkDur, hitAt: e.atk.hitAt || c.enemy.atkHitAt, extra: 0 };
          const r = sweepHit(c, m, s, t0, e.x, e.y, e.face, [p]);
          if (r === 'past') e.atk.hit = true; else if (r) { e.atk.hit = true; this.enemyHits(e, p); }
        }
      } else if (!e.atk.hit && e.atk.t >= (e.atk.hitAt || c.enemy.atkHitAt)) {
        e.atk.hit = true;
        if (Math.abs(dx) <= c.enemy.reach + 8 && Math.abs(dy) <= c.laneTol) this.enemyHits(e, p);
      }
      if (e.atk && e.atk.t >= (e.atk.dur || c.enemy.atkDur)) { e.atk = null; e.atkCd = c.enemy.atkCool; }
      return;
    }
    e.atkCd -= dt;
    if (Math.abs(dy) > c.laneTol * 0.5) { e.y = this.clampY(e.y + Math.sign(dy) * spd * 0.7 * dt); e.moving = true; }
    if (Math.abs(dx) > c.enemy.reach * 0.8) { e.x = this.clampX(e.x + Math.sign(dx) * spd * dt); e.moving = true; }
    else if (Math.abs(dy) <= c.laneTol && e.atkCd <= 0) {
      e.atkN = (e.atkN || 0) + 1; const H = c.enemyHeavy, heavy = !!e.heavyEvery && e.atkN % e.heavyEvery === 0;
      e.atk = heavy ? { t: 0, hit: false, heavy: true, dur: c.enemy.atkDur * H.durMult, hitAt: c.enemy.atkHitAt * H.hitMult } : { t: 0, hit: false, dur: c.enemy.atkDur, hitAt: c.enemy.atkHitAt };
    }
    if (e.moving) e.walkT += dt;
  }

  pickTarget(e) {
    let best = this.player.hp > 0 ? this.player : null, bd = best ? (best.x - e.x) ** 2 + 4 * (best.y - e.y) ** 2 : 1e12;
    for (const a of this.allies) { if (a.state !== 'alive') continue; const d = (a.x - e.x) ** 2 + 4 * (a.y - e.y) ** 2; if (d < bd) { best = a; bd = d; } }
    return best;
  }
  enemyHits(e, t) { if (t === this.player) this.enemyHitsPlayer(e); else this.enemyHitsAlly(e, t); }
  // damage to a worn-armor fighter: percent off (at least 1), durability drops by the raw hit, a broken set protects nothing
  takeHit(t, raw) {
    const dmg = Math.max(1, Math.floor(raw * (1 - (t.broken ? 0 : t.armorPct)) + 1e-9)); let broke = false;
    t.hp -= dmg;
    if (t.durMax > 0 && !t.broken) { t.dur = Math.max(0, t.dur - raw); if (t.dur <= 0) { t.broken = true; broke = true; } }
    return { dmg, broke };
  }
  enemyHitsPlayer(e) {
    const p = this.player, c = this.cfg, heavy = !!(e.atk && e.atk.heavy);
    if ((p.blocking || p.dash) && this.defend(e, heavy)) return;
    p.flash = 0.2; p.hurt = 0.6; p.blocking = false; p.blockLock = !!this.input.block;
    if (!p.inv) {
      const r = this.takeHit(p, Math.floor(c.enemy.atkDmg * (heavy ? c.enemyHeavy.dmgMult : 1) + 1e-9));
      this.text(p.x, p.y - 96, '-' + r.dmg, '#ff7a6a', 10);
      if (r.broke) { this.say('break', 'Your armor broke.'); this.text(p.x, p.y - 110, 'ARMOR BROKEN', '#ff9a6a', 9); }
      if (p.hp <= 0) { if (this.mode === 'battle') p.hp = 0; else { this.say('info', 'Player downed; restored.'); p.hp = p.maxHp; } }
    } else this.text(p.x, p.y - 96, 'HIT', '#9fd0ff', 10);
    if (p.grab && !p.inv) { this.text(p.x, p.y - 108, 'GRAB BROKEN', '#ff9a6a', 9); this.endGrab(0.5); p.cooldown = c.interruptDelay; }
    if (p.swing) {
      if (p.chain > 0) this.text(p.x, p.y - 108, 'CHAIN BROKEN: hit', '#ff9a6a', 9);
      p.swing = null; p.chain = 0; p.cooldown = c.interruptDelay;
      this.say('info', 'Player swing interrupted by an enemy hit.');
    }
  }
  enemyHitsAlly(e, a) {
    a.flash = 0.2; a.hurt = 0.6; a.atk = null; a.atkCd = Math.max(a.atkCd, 0.4);
    const r = this.takeHit(a, this.cfg.enemy.atkDmg);
    this.text(a.x, a.y - 96, '-' + r.dmg, '#ff7a6a', 10);
    this.burst(a.x, a.y - 48, 6, '#f4ecd8', 90);
    if (a.hp <= 0) {
      a.hp = 0; a.state = 'dying'; a.deathT = 0; a.vx = (Math.sign(a.x - e.x) || 1) * 26;
      if (a.hid) this.fallen.push(a.hid);
      this.say('info', a.name + ' is down.');
    }
  }
  updateAlly(a, dt) {
    const c = this.cfg, p = this.player;
    a.flash = Math.max(0, a.flash - dt); a.hurt = Math.max(0, (a.hurt || 0) - dt); this.kv(a, dt);
    if (a.state === 'dying') { a.deathT += dt; a.x = this.clampX(a.x + a.vx * dt); a.vx *= 0.9; return; }
    a.moving = false;
    const w = weaponStats(c, a.weapon), iv = swingInterval(c, a.weapon, a.dex || 5), spd = c.player.speed * 0.8;
    let tgt = null, bd = 1e12;
    for (const e of this.enemies) { if (e.state !== 'alive') continue; const d = (e.x - a.x) ** 2 + 4 * (e.y - a.y) ** 2; if (d < bd) { tgt = e; bd = d; } }
    if (a.atk) {                                                      // mid-swing: the blow lands once, at its hit time
      a.atk.t += dt;
      if (!a.atk.hit && a.atk.t >= iv * 0.45) {
        a.atk.hit = true;
        const e = this.enemies.find(q => q.id === a.atk.target);
        if (e && e.state === 'alive' && Math.abs(e.x - a.x) <= w.reach + 8 && Math.abs(e.y - a.y) <= c.laneTol) this.applyHit(e, w.dmg, null);
      }
      if (a.atk.t >= iv) { a.atk = null; a.atkCd = 0.15; }
      return;
    }
    a.atkCd -= dt;
    if (!tgt) {                                                       // nothing to fight: keep near you
      const dx = p.x - 40 - a.x; if (Math.abs(dx) > 40) { a.x = this.clampX(a.x + Math.sign(dx) * spd * dt); a.face = Math.sign(dx); a.moving = true; a.walkT += dt; }
      return;
    }
    const dx = tgt.x - a.x, dy = tgt.y - a.y; a.face = dx >= 0 ? 1 : -1;
    if (Math.abs(dy) > c.laneTol * 0.5) { a.y = this.clampY(a.y + Math.sign(dy) * spd * 0.7 * dt); a.moving = true; }
    if (Math.abs(dx) > w.reach * 0.8) { a.x = this.clampX(a.x + Math.sign(dx) * spd * dt); a.moving = true; }
    else if (Math.abs(dy) <= c.laneTol && a.atkCd <= 0) a.atk = { t: 0, hit: false, target: tgt.id };
    if (a.moving) a.walkT += dt;
  }

  /* ---------- effects ---------- */
  burst(x, y, n, col, speed) {
    for (let i = 0; i < n; i++) {
      const r = this.fxRng, a = r() * Math.PI * 2, s = speed * (0.3 + r() * 0.7);
      this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.35 + r() * 0.3, max: 0.65, col, size: r() < 0.3 ? 3 : 2 });
    }
  }
  text(x, y, text, col, size) { const t = { x, y, text, col, size: size || 10, life: 0.9, max: 0.9 }; this.texts.push(t); if (this.textOut) this.textOut.push(Object.assign({}, t)); }   // textOut: a server collects new texts to send
  updateFx(dt) {
    for (const f of this.fx) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 520 * dt; }
    this.fx = this.fx.filter(f => f.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 14 * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
  }
}

