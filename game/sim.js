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
  enemy:  { hp: 9, san: 5, chr: 5, speed: 46, atkDmg: 2, atkDur: 1.0, atkHitAt: 0.45, atkCool: 0.8, reach: 38 },
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
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Sim {
  // rng: rules (wounded chance). fxRng: particles only, so cosmetic effects never shift the rules' random sequence
  constructor(cfg, seed) { this.cfg = cfg; this.seed = seed == null ? (Date.now() >>> 0) : seed; this.rng = makeRng(this.seed); this.fxRng = makeRng(this.seed ^ 0x9E3779B9); this.resetAll(); }

  resetAll() {
    const c = this.cfg;
    this.t = 0; this.nextId = 1; this.hitstop = 0; this.slow = 0; this.shake = 0;
    this.player = {
      x: 170, y: 282, face: 1, hp: c.player.hp, maxHp: c.player.hp,
      weapon: 'longsword', dex: 5, dmgOverride: null, inv: true,
      swing: null, chain: 0, cooldown: 0, moved: false, flash: 0, walkT: 0, moving: false,
    };
    this.enemies = []; this.fx = []; this.texts = []; this.routed = 0;
    this.log = []; this.logVer = 0; this.lastHit = null;
    this.input = { x: 0, y: 0 };
  }
  clearEnemies() { this.enemies = []; this.fx = []; this.texts = []; }
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
    const tier = c.tiers[opts.tier] ? opts.tier : 'leather';
    const i = opts.index || 0;
    const offs = [0, -26, 26, -52, 52];
    const e = {
      id: this.nextId++, x: Math.min(c.arena.right - 20, 380 + i * 46),
      y: this.clampY(p.y + offs[i % 5]), face: -1,
      hp: c.enemy.hp, maxHp: c.enemy.hp, san: opts.san != null ? opts.san : c.enemy.san, chr: opts.chr != null ? opts.chr : c.enemy.chr,
      tier, armorPct: c.tiers[tier].pct,
      dur: opts.dur != null ? opts.dur : c.tiers[tier].dur,
      durMax: opts.dur != null ? opts.dur : c.tiers[tier].dur,
      broken: false, wounded: 0, state: 'alive', flee: false,
      ai: opts.ai === 'advance' ? 'advance' : 'stand',
      atk: null, atkCd: 0.6, deathT: 0, dramatic: false, vx: 0, vz: 0, z: 0, walkT: 0, moving: false, flash: 0,
    };
    e.lookSeed = hash32(this.seed, e.id);                        // picks this enemy's parts and colours from its rank's pools (client side)
    this.enemies.push(e);
    return e;
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
  step(dtReal) {
    if (this.hitstop > 0) { this.hitstop -= dtReal; return; }
    let dt = dtReal;
    if (this.slow > 0) { dt *= 0.35; this.slow -= dtReal; }
    if (this.shake > 0) this.shake -= dtReal;
    this.t += dt;
    this.updatePlayer(dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter(e => !(e.state === 'dying' && e.deathT > 2.6) && e.state !== 'routed');
    this.updateFx(dt);
  }

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

  updatePlayer(dt) {
    const p = this.player, c = this.cfg, w = this.weaponInfo();
    let ix = this.input.x, iy = this.input.y;
    const mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; }
    p.flash = Math.max(0, p.flash - dt);
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

    if (p.swing) {
      const s = p.swing; s.t += dt;
      if (!s.hit && s.t >= s.hitAt) { s.hit = true; this.playerStrike(s, w); }
      if (s.t >= s.dur) {
        if (s.whiff) { this.breakChain('missed'); }
        else if (p.moved) { this.breakChain('you moved'); p.cooldown = c.moveBreakDelay; }
        else p.chain++;
        p.swing = null;
      }
    }
    if (!p.swing && p.cooldown <= 0) {
      const tgt = this.findTarget(w);
      if (tgt) {
        p.face = tgt.x >= p.x ? 1 : -1;
        p.swing = { t: 0, dur: w.interval, dur0: w.interval, hitAt: w.interval * 0.45, hit: false, target: tgt.id, whiff: false, dramatic: false, extra: 0 };
        p.moved = false;
      }
    }
  }

  breakChain(why) {
    const p = this.player;
    if (p.chain > 0) this.say('info', 'Chain reset (' + why + ').');
    p.chain = 0;
  }

  playerStrike(s, w) {
    const p = this.player;
    let e = this.enemies.find(x => x.id === s.target);
    const ok = e && e.state === 'alive' && Math.abs(e.y - p.y) <= this.cfg.laneTol && Math.abs(e.x - p.x) <= w.reach + 8;
    if (!ok) e = this.findTarget(w);
    if (!e) { s.whiff = true; this.text(p.x + p.face * 40, p.y - 70, 'MISS', '#b7ab9a', 10); return; }
    this.applyHit(e, w.dmg, s);
  }

  /* ---------- the rules under test ---------- */
  applyHit(e, raw, swing) {
    const c = this.cfg, p = this.player;
    const wasW = e.wounded > 0, wasB = e.broken;
    const crit = wasW || wasB;
    const pct = wasB ? 0 : e.armorPct;
    const red = v => Math.max(1, Math.floor(v * (1 - pct) + 1e-9));
    let dmg;
    if (crit) dmg = c.critOrder === 'before' ? red(raw * c.critMult) : red(raw) * c.critMult;
    else dmg = red(raw);

    const hpBefore = e.hp, durBefore = e.dur;
    e.hp = Math.max(0, e.hp - dmg);
    let brokeNow = false;
    if (!e.broken && e.durMax > 0) {
      e.dur = Math.max(0, e.dur - raw);
      if (e.dur <= 0) { e.broken = true; brokeNow = true; }
    }
    const thr = e.broken ? 0 : c.woundedThreshold;
    const dead = e.hp <= 0;
    const rec = {
      raw, pct: Math.round(pct * 100), crit, critCause: wasB ? 'Armor Break' : (wasW ? 'Wounded' : ''),
      dmg, hpBefore, hpAfter: e.hp, durBefore, durAfter: e.dur, durMax: e.durMax,
      threshold: thr, woundedSet: false, dead, dramatic: false, notes: [], tier: c.tiers[e.tier].label,
    };

    e.flash = 0.12;
    this.burst(e.x, e.y - 48, crit ? 14 : 8, crit ? '#ffe08a' : '#f4ecd8', crit ? 150 : 100);
    this.text(e.x, e.y - 96, (crit ? 'CRIT ' : '') + '-' + dmg, crit ? '#ffd27a' : '#ffffff', crit ? 12 : 10);
    if (dead) { this.hitstop = Math.max(this.hitstop, 0.05); }
    else this.hitstop = Math.max(this.hitstop, crit ? 0.08 : 0.04);

    let line = (crit ? 'CRIT x2 (' + rec.critCause + ') ' : '') + 'Hit ' + raw + ' vs ' + rec.tier + ' -' + rec.pct + '% = ' + dmg + ' dmg, HP ' + hpBefore + '>' + e.hp;
    if (brokeNow) { this.say('break', 'ARMOR BREAK: durability gone (' + durBefore + ' > 0). SAN -50%, speed +25%, armor 0, crits on every hit.'); rec.notes.push('Armor broke on this hit'); this.burst(e.x, e.y - 40, 16, '#9aa7b6', 170); this.text(e.x, e.y - 110, 'ARMOR BREAK', '#ff9a6a', 10); }

    if (dead) {
      rec.dramatic = wasW;
      this.kill(e, wasW, swing);
      this.say(wasW ? 'kill' : 'hit', line + (wasW ? '  | KILLED WHILE WOUNDED (dramatic)' : '  | KILLED'));
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
    const dir = Math.sign(e.x - p.x) || 1;
    if (dramatic) {
      e.vx = dir * 230; e.vz = 190;
      if (swing) { swing.dramatic = true; swing.dur += this.cfg.dramaticExtend; swing.extra = this.cfg.dramaticExtend; }
      this.hitstop = 0.16; this.slow = 0.45; this.shake = 0.3;
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
    const c = this.cfg, p = this.player;
    e.flash = Math.max(0, e.flash - dt);
    if (e.state === 'dying') {
      e.deathT += dt;
      if (e.dramatic) {
        if (e.z > 0 || e.vz > 0) { e.z += e.vz * dt; e.vz -= 620 * dt; if (e.z <= 0) { e.z = 0; e.vz = 0; this.burst(e.x, e.y, 6, '#8a7a6a', 60); } }
        e.x = this.clampX(e.x + e.vx * dt); e.vx *= 0.975;
      } else { e.x = this.clampX(e.x + e.vx * dt); e.vx *= 0.9; }
      return;
    }
    e.moving = false;
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
      e.atk.t += dt;
      if (!e.atk.hit && e.atk.t >= c.enemy.atkHitAt) {
        e.atk.hit = true;
        if (Math.abs(dx) <= c.enemy.reach + 8 && Math.abs(dy) <= c.laneTol) this.enemyHitsPlayer(e);
      }
      if (e.atk.t >= c.enemy.atkDur) { e.atk = null; e.atkCd = c.enemy.atkCool; }
      return;
    }
    e.atkCd -= dt;
    if (Math.abs(dy) > c.laneTol * 0.5) { e.y = this.clampY(e.y + Math.sign(dy) * spd * 0.7 * dt); e.moving = true; }
    if (Math.abs(dx) > c.enemy.reach * 0.8) { e.x = this.clampX(e.x + Math.sign(dx) * spd * dt); e.moving = true; }
    else if (Math.abs(dy) <= c.laneTol && e.atkCd <= 0) e.atk = { t: 0, hit: false };
    if (e.moving) e.walkT += dt;
  }

  enemyHitsPlayer(e) {
    const p = this.player, c = this.cfg;
    p.flash = 0.2;
    if (!p.inv) {
      p.hp -= c.enemy.atkDmg;
      this.text(p.x, p.y - 96, '-' + c.enemy.atkDmg, '#ff7a6a', 10);
      if (p.hp <= 0) { this.say('info', 'Player downed; restored.'); p.hp = p.maxHp; }
    } else this.text(p.x, p.y - 96, 'HIT', '#9fd0ff', 10);
    if (p.swing) {
      p.swing = null; p.chain = 0; p.cooldown = c.interruptDelay;
      this.say('info', 'Player swing interrupted by an enemy hit.');
    }
  }

  /* ---------- effects ---------- */
  burst(x, y, n, col, speed) {
    for (let i = 0; i < n; i++) {
      const r = this.fxRng, a = r() * Math.PI * 2, s = speed * (0.3 + r() * 0.7);
      this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.35 + r() * 0.3, max: 0.65, col, size: r() < 0.3 ? 3 : 2 });
    }
  }
  text(x, y, text, col, size) { this.texts.push({ x, y, text, col, size: size || 10, life: 0.9, max: 0.9 }); }
  updateFx(dt) {
    for (const f of this.fx) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 520 * dt; }
    this.fx = this.fx.filter(f => f.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 14 * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
  }
}

