/* ============================================================
   PROJECT WAR · RUN LAYER  (no DOM, no drawing)
   The camp, the profile (gold, level, attributes, gear, skills, hirelings), the wave run, the exit vote every 5 waves,
   style rank. It sits on top of the combat sim: it reads what the sim reports (sim.feed) and steers it with commands.
   Every number marked PLACEHOLDER is a tuning guess, not design.
   ============================================================ */
import { CFG, applyCmd, hash32, makeRng } from './sim.js';

export const ATTRS = ['str', 'dex', 'agi', 'int', 'con', 'wis', 'ldr', 'chr', 'san'];
// What each attribute does right now. STR to LDR are first guesses; INT and WIS are kept for magic; SAN is still the old placeholder.
export const ATTR_INFO = {
  str: { n: 'STR', d: 'More damage on every swing, throw and slam.' },
  dex: { n: 'DEX', d: 'Faster swings.' },
  agi: { n: 'AGI', d: 'Faster walking and dashing, quicker stamina regen.' },
  int: { n: 'INT', d: 'Kept for magic. No effect yet.' },
  con: { n: 'CON', d: 'More max HP and max stamina.' },
  wis: { n: 'WIS', d: 'Kept for magic. No effect yet.' },
  ldr: { n: 'LDR', d: 'More hireling slots and stronger hirelings.' },
  chr: { n: 'CHR', d: 'Cheaper hirelings.' },
  san: { n: 'SAN', d: 'Placeholder. No effect on you yet.' },
};

export const RUNCFG = {
  base: 5, pointsPerLevel: 3, startGold: 30,
  str: { dmg: 0.06 }, agi: { speed: 0.02, regen: 0.04 }, con: { hp: 4, stamina: 5 }, ldr: { perSlot: 3, strength: 0.03 }, chr: { discount: 0.02, maxDiscount: 0.5 },
  maxHirelings: 3,
  xp: { base: 20, growth: 1.35, kill: { fodder: 2, soldier: 4, tank: 9, elite: 25 }, wave: 5 },
  gold: { kill: { fodder: 1, soldier: 2, tank: 5, elite: 14 }, wave: 5 },
  exitEvery: 5, deepBonus: 0.25,                       // leaving at wave 5, 10, 15 ... pays 1 + 0.25 per stage after the first
  waveHp: 0.06, between: 2.5, spawnGap: 0.45, maxAlive: 8, maxAlivePerWave: 1, healBetween: 0.25,
  use: { threshold: 60, cap: 5 },                      // each 60 uses of an attribute's kind of action grows it by 1, up to +5 (the hybrid growth)
  rank: { names: ['D', 'C', 'B', 'A', 'S'], at: [0, 20, 40, 65, 90], gain: 4, repeat: -6, decay: 6, idle: 3, goldMult: 0.1, dmgBonus: 0.05 },
  hire: { fee: { leather: 40, mail: 100, plate: 240 }, hp: { leather: 18, mail: 24, plate: 32 }, xpPerLevel: 5, levelBonus: 0.1 },
};

/* ---------- profile ---------- */
export function newProfile(name) {
  return {
    v: 1, name: name || 'Baron', gold: RUNCFG.startGold, xp: 0, level: 1, points: 0,
    attrs: Object.fromEntries(ATTRS.map(a => [a, RUNCFG.base])), grown: { str: 0, dex: 0, agi: 0, con: 0 }, use: { str: 0, dex: 0, agi: 0, con: 0 },
    weapon: 'longsword', armor: 'leather', owned: { weapons: ['longsword'], armor: ['leather'], skills: [] }, skills: [],
    upgrades: { hp: 0, stamina: 0, damage: 0, slots: 0 }, hirelings: [], nextHid: 1, runs: 0, best: 0,
  };
}
export const toJSON = p => JSON.stringify(p);
export function fromJSON(txt) { try { const o = JSON.parse(txt); return o && o.v === 1 ? Object.assign(newProfile(), o) : null; } catch (e) { return null; } }

export const xpNeed = level => Math.round(RUNCFG.xp.base * Math.pow(RUNCFG.xp.growth, level - 1));
export function addXp(p, n) {                          // returns the number of levels gained
  p.xp += n; let up = 0;
  while (p.xp >= xpNeed(p.level)) { p.xp -= xpNeed(p.level); p.level++; p.points += RUNCFG.pointsPerLevel; up++; }
  return up;
}
export const attr = (p, a) => p.attrs[a] + (p.grown[a] || 0);
export function spendPoint(p, a) { if (p.points <= 0 || !(a in p.attrs)) return false; p.attrs[a]++; p.points--; return true; }

/* everything the sim needs to know about you, from the profile */
export function derive(p) {
  const R = RUNCFG, b = R.base, A = a => attr(p, a);
  const ldr = A('ldr'), chr = A('chr');
  return {
    dmgMult: (1 + R.str.dmg * (A('str') - b)) * (1 + 0.05 * p.upgrades.damage),
    dex: A('dex'),
    spdMult: 1 + R.agi.speed * (A('agi') - b), regenMult: 1 + R.agi.regen * (A('agi') - b),
    maxHp: CFG.player.hp + R.con.hp * (A('con') - b) + 4 * p.upgrades.hp,
    staminaMax: CFG.stamina.max + R.con.stamina * (A('con') - b) + 10 * p.upgrades.stamina,
    hireCap: Math.min(R.maxHirelings, 1 + Math.max(0, Math.floor((ldr - b) / R.ldr.perSlot))),
    hireStrength: 1 + R.ldr.strength * (ldr - b),
    hireDiscount: Math.min(R.chr.maxDiscount, Math.max(0, R.chr.discount * (chr - b))),
    skillSlots: 1 + p.upgrades.slots,
  };
}

/* use-growth: the action just taken trains one attribute a little */
export function trainFromUse(p, kind) {
  const a = ({ heavy: 'str', throw: 'str', slam: 'str', strike: 'str', light: 'dex', counter: 'dex', dash: 'agi', jump: 'agi', hurt: 'con' })[kind]; if (!a) return false;
  p.use[a]++;
  if (p.use[a] >= RUNCFG.use.threshold) { p.use[a] = 0; if ((p.grown[a] || 0) < RUNCFG.use.cap) { p.grown[a] = (p.grown[a] || 0) + 1; return a; } }
  return false;
}

/* ---------- shop ---------- */
export const WEAPON_PRICE = { longsword: 0, greatsword: 120, axe: 60, mace: 60, spear: 90 };
export const ARMOR_PRICE = { leather: 0, mail: 150, plate: 400 };
export const SKILLS = {
  riposte: { n: 'Riposte', d: 'A clash makes no bounce; you counter-swing at once.', price: 100 },
  shove: { n: 'Shove', d: 'A clash shoves the enemy far and stuns it, so you can grab it.', price: 100 },
  multi: { n: 'Multi-clash', d: 'One swing can clash with up to four enemy swings at once.', price: 250 },
};
export const UPGRADES = { hp: { n: 'Toughness', d: '+4 max HP per rank.', base: 40, max: 10 }, stamina: { n: 'Endurance', d: '+10 max stamina per rank.', base: 40, max: 10 },
  damage: { n: 'Whetstone', d: '+5% damage per rank.', base: 60, max: 10 }, slots: { n: 'Skill slot', d: 'Equip one more skill.', base: 150, max: 2 } };
export const upgradePrice = (p, k) => Math.round(UPGRADES[k].base * Math.pow(1.6, p.upgrades[k]));
function pay(p, n) { if (p.gold < n) return { ok: false, why: 'Not enough gold.' }; p.gold -= n; return { ok: true }; }
export function buy(p, kind, key) {
  if (kind === 'weapon') { if (p.owned.weapons.includes(key)) return { ok: false, why: 'Already owned.' }; const r = pay(p, WEAPON_PRICE[key]); if (r.ok) p.owned.weapons.push(key); return r; }
  if (kind === 'armor') { if (p.owned.armor.includes(key)) return { ok: false, why: 'Already owned.' }; const r = pay(p, ARMOR_PRICE[key]); if (r.ok) p.owned.armor.push(key); return r; }
  if (kind === 'skill') { if (p.owned.skills.includes(key)) return { ok: false, why: 'Already learned.' }; const r = pay(p, SKILLS[key].price); if (r.ok) p.owned.skills.push(key); return r; }
  if (kind === 'upgrade') { if (p.upgrades[key] >= UPGRADES[key].max) return { ok: false, why: 'Maxed.' }; const r = pay(p, upgradePrice(p, key)); if (r.ok) p.upgrades[key]++; return r; }
  return { ok: false, why: 'Unknown item.' };
}
export const equipWeapon = (p, k) => p.owned.weapons.includes(k) ? (p.weapon = k, true) : false;
export const equipArmor = (p, k) => p.owned.armor.includes(k) ? (p.armor = k, true) : false;
export function toggleSkill(p, k) {
  if (!p.owned.skills.includes(k)) return { ok: false, why: 'Not learned.' };
  if (p.skills.includes(k)) { p.skills = p.skills.filter(x => x !== k); return { ok: true }; }
  if (p.skills.length >= derive(p).skillSlots) return { ok: false, why: 'No free skill slot.' };
  p.skills.push(k); return { ok: true };
}

/* ---------- hire board: the same faces all week, a new batch after each run ---------- */
const NAMES = ['Aldric', 'Bram', 'Cedric', 'Dunstan', 'Edda', 'Fenn', 'Garrick', 'Hild', 'Ivo', 'Jorun', 'Kell', 'Lothar', 'Maren', 'Osk', 'Perrin', 'Rolf', 'Sigrid', 'Tam', 'Ulf', 'Wulf'];
const HIRE_WEAPONS = ['longsword', 'axe', 'mace', 'spear', 'greatsword'];
export function recruits(p, seed) {
  const r = makeRng(hash32(seed || 1, p.runs + 17)), d = derive(p), out = [];
  for (let i = 0; i < 4; i++) {
    const tier = i === 3 ? 'plate' : i === 2 ? 'mail' : 'leather', w = HIRE_WEAPONS[Math.floor(r() * HIRE_WEAPONS.length)];
    out.push({ rid: i, name: NAMES[Math.floor(r() * NAMES.length)], tier, weapon: w, hp: RUNCFG.hire.hp[tier], fee: Math.round(RUNCFG.hire.fee[tier] * (1 - d.hireDiscount)) });
  }
  return out;
}
export function hire(p, rec) {
  const d = derive(p);
  if (p.hirelings.length >= d.hireCap) return { ok: false, why: 'No free slot (LDR raises it).' };
  const r = pay(p, rec.fee); if (!r.ok) return r;
  p.hirelings.push({ hid: p.nextHid++, name: rec.name, tier: rec.tier, weapon: rec.weapon, hp: rec.hp, level: 1, xp: 0 }); return { ok: true };
}
export const dismiss = (p, hid) => { p.hirelings = p.hirelings.filter(h => h.hid !== hid); };
export function hirelingXp(h, n) { h.xp += n; let up = 0; while (h.xp >= RUNCFG.hire.xpPerLevel * h.level) { h.xp -= RUNCFG.hire.xpPerLevel * h.level; h.level++; up++; } return up; }
export const allySpec = (h, p) => { const d = derive(p), s = d.hireStrength * (1 + RUNCFG.hire.levelBonus * (h.level - 1)); return { hid: h.hid, name: h.name, tier: h.tier, weapon: h.weapon, hp: Math.round(h.hp * s), dmgMult: s }; };

/* ---------- waves ---------- */
export function wavePlan(n) {                          // the kinds of the n-th wave, in the order they arrive
  const total = 6 + 3 * n, elites = n >= 5 ? Math.floor(n / 5) : 0, tanks = n >= 3 ? Math.floor(n / 3) : 0, soldiers = n >= 2 ? Math.floor(total * 0.25) : 0;
  const list = [];
  for (let i = 0; i < total; i++) list.push('fodder');
  for (let i = 0; i < soldiers; i++) list[Math.floor((i + 0.5) * total / (soldiers + 1))] = 'soldier';
  for (let i = 0; i < tanks; i++) list[Math.floor((i + 1) * total / (tanks + 1)) | 1] = 'tank';
  for (let i = 0; i < elites; i++) list.push('elite');   // elites arrive last
  return list;
}
export const MAPS = { fields: { n: 'Training Fields', d: 'Open ground outside the camp. A basic map.' } };
export const stageOf = wave => Math.floor(wave / RUNCFG.exitEvery);

/* ---------- the run ---------- */
export class Run {
  constructor(sim, profile, seed) {
    this.sim = sim; this.p = profile; this.rng = makeRng(hash32(seed || 1, profile.runs + 3)); this.seed = seed || 1;
    this.phase = 'camp'; this.wave = 0; this.gold = 0; this.kills = 0; this.xpGain = 0; this.timer = 0; this.queue = []; this.spawnT = 0; this.waveKills = 0;
    this.rank = { score: 0, last: '', idle: 0, tier: 0 }; this.msgs = []; this.dummyT = 0; this.result = null; this.levelUps = 0; this.banner = null;
    this.enterCamp();
  }
  say(t) { this.msgs.push({ t: this.sim.t, text: t }); if (this.msgs.length > 12) this.msgs.shift(); }
  get tier() { const a = RUNCFG.rank.at; let t = 0; for (let i = 0; i < a.length; i++) if (this.rank.score >= a[i]) t = i; return t; }
  get rankName() { return RUNCFG.rank.names[this.tier]; }
  goldMult() { return 1 + RUNCFG.rank.goldMult * this.tier; }

  /* put your build on the fighter: weapon, armor, attributes, skills */
  applyBuild(inRun) {
    const p = this.p, d = derive(p), sim = this.sim, tier = CFG.tiers[p.armor], bonus = inRun ? 1 + RUNCFG.rank.dmgBonus * this.tier : 1;
    applyCmd(sim, { t: 'set', weapon: p.weapon, dex: d.dex, maxHp: d.maxHp, hp: d.maxHp, staminaMax: d.staminaMax, stamina: d.staminaMax, dmgMult: d.dmgMult * bonus, spdMult: d.spdMult, regenMult: d.regenMult,
      armorPct: tier.pct, dur: tier.dur, durMax: tier.dur, broken: false, inv: false, skills: { riposte: p.skills.includes('riposte'), shove: p.skills.includes('shove'), multi: p.skills.includes('multi') } });
  }
  enterCamp() {
    const sim = this.sim; this.phase = 'camp'; sim.mode = 'arena'; sim.manual = true;
    sim.clearEnemies(); sim.clearAllies(); sim.proj = []; sim.player.x = 330; sim.player.y = 282; sim.player.swing = null; sim.player.air = false; sim.player.z = 0;
    this.applyBuild(false); applyCmd(sim, { t: 'set', inv: true });         // nothing in camp can hurt you
    this.spawnDummy();
  }
  spawnDummy() {
    const e = this.sim.spawn({ kind: 'soldier', tier: 'leather', dur: 99, ai: 'stand' }); e.hp = e.maxHp = 60; e.x = 120; e.y = 282; e.face = 1; e.dummy = true; this.dummy = e; return e;
  }

  depart(map) {
    if (this.phase !== 'camp') return false;
    const sim = this.sim, p = this.p; p.runs++; this.map = map || 'fields'; this.wave = 0; this.gold = 0; this.kills = 0; this.xpGain = 0; this.levelUps = 0; this.result = null; this.rank.score = 0; this.rank.last = '';
    sim.clearEnemies(); sim.mode = 'run'; sim.manual = true; sim.proj = []; sim.player.x = 170; sim.player.y = 282; sim.player.swing = null;
    this.applyBuild(true); this.spawnAllies(); this.say('The run begins.'); this.startWave(1); return true;
  }
  spawnAllies() {
    const sim = this.sim; sim.clearAllies();
    this.p.hirelings.forEach((h, i) => sim.spawnAlly(Object.assign(allySpec(h, this.p), { index: i })));
  }
  startWave(n) {
    this.banner = { text: 'WAVE ' + n, at: this.sim.t }; this.wave = n; this.phase = 'wave'; this.queue = wavePlan(n); this.spawnT = 0.5; this.waveKills = 0; this.waveHits = 0;
    this.say('Wave ' + n + ': ' + this.queue.length + ' enemies.');
  }
  alive() { return this.sim.enemies.filter(e => e.state === 'alive').length; }

  /* call once per sim step, after sim.step() */
  update(dt) {
    const sim = this.sim, R = RUNCFG;
    const feed = sim.feed; sim.feed = [];
    if (this.phase === 'camp') {
      // the camp dummy gives no growth and no rewards
      if (this.dummy && this.dummy.state !== 'alive') { this.dummyT += dt; if (this.dummyT > 1.5) { this.dummyT = 0; this.dummy = null; this.spawnDummy(); } }
      else if (this.dummy && this.dummy.hp < this.dummy.maxHp) this.dummy.hp = Math.min(this.dummy.maxHp, this.dummy.hp + 8 * dt);
      return;
    }
    // rewards and style rank from what happened this frame
    for (const f of feed) {
      if (f.t === 'kill') this.onKill(f);
      else if (f.t === 'hit') this.onHit(f.move);
      else if (f.t === 'hurt') { this.rank.score = 0; this.rank.last = ''; trainFromUse(this.p, 'hurt'); this.syncRank(); }
    }
    if (this.phase === 'wave' || this.phase === 'between') {
      this.rank.idle += dt; if (this.rank.idle > R.rank.idle) { this.rank.score = Math.max(0, this.rank.score - R.rank.decay * dt); this.syncRank(); }
    }
    if (sim.player.hp <= 0 && this.phase !== 'dead' && this.phase !== 'left') { this.die(); return; }
    if (this.phase === 'wave') {
      this.spawnT -= dt;
      const cap = R.maxAlive + this.wave * R.maxAlivePerWave;
      if (this.queue.length && this.spawnT <= 0 && this.alive() < cap) { this.spawnOne(); this.spawnT = R.spawnGap; }
      if (!this.queue.length && this.alive() === 0) this.clearWave();
    } else if (this.phase === 'between') {
      this.timer -= dt; if (this.timer <= 0) this.startWave(this.wave + 1);
    }
  }
  spawnOne() {
    const sim = this.sim, kind = this.queue.shift(), side = this.rng() < 0.5 ? -1 : 1;
    const e = sim.spawn({ kind, ai: 'advance' });
    e.x = side > 0 ? CFG.arena.right - 8 : CFG.arena.left + 8; e.y = sim.clampY(CFG.band.top + this.rng() * (CFG.band.bottom - CFG.band.top)); e.face = -side;
    const k = 1 + R_HP() * (this.wave - 1); e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * k));
    return e;
  }
  onKill(f) {
    const R = RUNCFG, k = f.kind; this.kills++; this.waveKills++;
    const g = Math.round((R.gold.kill[k] || 1) * this.goldMult()); this.gold += g;
    this.giveXp(R.xp.kill[k] || 1);
  }
  giveXp(n) { this.xpGain += n; const up = addXp(this.p, n); if (up) { this.levelUps += up; this.say('Level ' + this.p.level + '! +' + up * RUNCFG.pointsPerLevel + ' attribute points.'); this.sim.text(this.sim.player.x, this.sim.player.y - 120, 'LEVEL UP', '#ffe27a', 12); } }
  onHit(move) {
    const R = RUNCFG.rank, g = trainFromUse(this.p, move);
    if (g) this.say(g.toUpperCase() + ' grew from use.');
    this.rank.idle = 0;
    if (this.rank.last && this.rank.last === move) this.rank.score = Math.max(0, this.rank.score + R.repeat); else this.rank.score = Math.min(100, this.rank.score + R.gain);
    this.rank.last = move; this.syncRank();
  }
  syncRank() {                                         // the small combat bonus follows the rank tier
    const t = this.tier; if (t === this.rank.tier) return; this.rank.tier = t;
    const d = derive(this.p); applyCmd(this.sim, { t: 'set', dmgMult: d.dmgMult * (1 + RUNCFG.rank.dmgBonus * t) });
  }
  clearWave() {
    const R = RUNCFG, sim = this.sim; this.say('Wave ' + this.wave + ' cleared.'); this.banner = { text: 'WAVE CLEARED', at: sim.t };
    this.gold += Math.round(R.gold.wave * this.wave * this.goldMult()); this.giveXp(R.xp.wave * this.wave);
    for (const h of this.p.hirelings) if (hirelingXp(h, 1)) this.say(h.name + ' reached level ' + h.level + '.');
    const pl = sim.player; pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * R.healBetween)); pl.stamina = pl.staminaMax;
    this.spawnAllies();                                // fallen hirelings return, no penalty
    if (this.wave % R.exitEvery === 0) { this.phase = 'vote'; this.say('Leave with ' + this.leavePay() + ' gold, or press on?'); }
    else { this.phase = 'between'; this.timer = R.between; }
  }
  leavePay() { return Math.round(this.gold * (1 + RUNCFG.deepBonus * (stageOf(this.wave) - 1))); }
  vote(leave) {
    if (this.phase !== 'vote') return false;
    if (leave) { const g = this.leavePay(); this.p.gold += g; this.p.best = Math.max(this.p.best, this.wave); this.result = { kind: 'left', wave: this.wave, gold: g, kills: this.kills, xp: this.xpGain, levels: this.levelUps }; this.phase = 'left'; }
    else { this.phase = 'between'; this.timer = RUNCFG.between; }
    return true;
  }
  die() {
    this.phase = 'dead'; this.p.best = Math.max(this.p.best, this.wave - 1);
    this.result = { kind: 'dead', wave: this.wave, lost: this.gold, kills: this.kills, xp: this.xpGain, levels: this.levelUps }; this.gold = 0;   // the run's gold is gone; gear, levels and unlocks stay
  }
  returnToCamp() { if (this.phase === 'dead' || this.phase === 'left') this.enterCamp(); }
}
const R_HP = () => RUNCFG.waveHp;
