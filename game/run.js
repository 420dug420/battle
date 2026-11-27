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
  base: 5, pointsPerLevel: 3, startGold: 30, chainBase: 2,
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
    v: 1, created: false, look: null, name: name || 'Baron', gold: RUNCFG.startGold, xp: 0, level: 1, points: 0,
    attrs: Object.fromEntries(ATTRS.map(a => [a, RUNCFG.base])), grown: { str: 0, dex: 0, agi: 0, con: 0 }, use: { str: 0, dex: 0, agi: 0, con: 0 },
    weapon: 'longsword', armor: 'leather', owned: { weapons: ['longsword'], armor: ['leather'], skills: [] }, skills: [],
    upgrades: { hp: 0, stamina: 0, damage: 0, slots: 0, chain: 0 }, styles: { owned: ['cut', 'chop'], chain: ['cut', 'chop'], roles: { heavy: null, dash: null, counter: null, jump: null } }, hirelings: [], nextHid: 1, runs: 0, best: 0,
  };
}
export const toJSON = p => JSON.stringify(p);
export function fromJSON(txt) {
  try {
    const o = JSON.parse(txt); if (!o || o.v !== 1) return null; const d = newProfile(), p = Object.assign(d, o); if (o.created == null) p.created = true;      // saves from before character creation count as made
    p.upgrades = Object.assign({}, newProfile().upgrades, o.upgrades || {}); p.styles = Object.assign({}, newProfile().styles, o.styles || {}); p.styles.roles = Object.assign({}, newProfile().styles.roles, p.styles.roles || {}); return p;
  } catch (e) { return null; }
}

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
    skillSlots: 1 + p.upgrades.slots, chainSlots: RUNCFG.chainBase + (p.upgrades.chain || 0),
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
  damage: { n: 'Whetstone', d: '+5% damage per rank.', base: 60, max: 10 }, slots: { n: 'Skill slot', d: 'Equip one more skill.', base: 150, max: 2 },
  chain: { n: 'Combo slot', d: 'One more attack in your light-attack chain.', base: 80, max: 4 } };
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
/* ---------- styles: attack animations, the combo chain, and the heavy / dash / counter / jump attacks ---------- */
export const STYLE_PRICE = { cut: 0, chop: 0, attack2: 40, lunge: 60 }, STYLE_PRICE_CUSTOM = 80;          // PLACEHOLDER
export const stylePrice = id => id in STYLE_PRICE ? STYLE_PRICE[id] : STYLE_PRICE_CUSTOM;
export const ROLES = { heavy: 'Heavy attack (right click)', dash: 'Dash attack', counter: 'Counter (after a parry)', jump: 'Jump attack' };
export const styleFits = (st, hands) => !st.hands || st.hands === hands;
export function learnStyle(p, id, all) {
  if (p.styles.owned.includes(id)) return { ok: false, why: 'Already learned.' };
  if (!all.some(s => s.id === id)) return { ok: false, why: 'Unknown style.' };
  const r = pay(p, stylePrice(id)); if (r.ok) p.styles.owned.push(id); return r;
}
export function setChain(p, i, id) {
  const n = derive(p).chainSlots; if (i < 0 || i >= n) return { ok: false, why: 'That slot is locked.' };
  if (id && !p.styles.owned.includes(id)) return { ok: false, why: 'Not learned.' };
  while (p.styles.chain.length < n) p.styles.chain.push(null);
  p.styles.chain[i] = id || null; return { ok: true };
}
export function setRole(p, role, id) {
  if (!(role in ROLES)) return { ok: false, why: 'Unknown role.' };
  if (id && !p.styles.owned.includes(id)) return { ok: false, why: 'Not learned.' };
  p.styles.roles[role] = id || null; return { ok: true };
}
/* a build's styles turned into what plays: the chain that fits the weapon's hands (never empty) and the role attacks that fit */
export function resolveStyles(styles, all, hands) {
  const ok = id => { const st = id && all.find(x => x.id === id); return st && styleFits(st, hands) ? id : null; };
  const chain = (styles.chain || []).map(ok).filter(Boolean), roles = {};
  for (const r in ROLES) { const id = ok(styles.roles && styles.roles[r]); if (id) roles[r] = id; }
  return { chain: chain.length ? chain : ['cut'], roles };
}
export function chainFor(p, all, hands) {            // equipped chain ids that fit the weapon's hands, in order; never empty
  const out = [], n = derive(p).chainSlots;
  for (const id of p.styles.chain.slice(0, n)) { const st = all.find(s => s.id === id); if (st && p.styles.owned.includes(id) && styleFits(st, hands)) out.push(id); }
  return out.length ? out : ['cut'];
}
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
  const ramp = [0.33, 0.5, 0.7, 0.85][n - 1] || 1;                 // the first waves are a tutorial: wave 1 is 3 fodder
  const total = Math.round((6 + 3 * n) * ramp), elites = n >= 5 ? Math.floor(n / 5) : 0, tanks = n >= 3 ? Math.floor(n / 3) : 0, soldiers = n >= 2 ? Math.floor(total * 0.25) : 0;
  const list = [];
  for (let i = 0; i < total; i++) list.push('fodder');
  for (let i = 0; i < soldiers; i++) list[Math.floor((i + 0.5) * total / (soldiers + 1))] = 'soldier';
  for (let i = 0; i < tanks; i++) list[Math.floor((i + 1) * total / (tanks + 1)) | 1] = 'tank';
  for (let i = 0; i < elites; i++) list.push('elite');   // elites arrive last
  return list;
}
export const MAPS = { fields: { n: 'Training Fields', d: 'Open ground outside the camp. A basic map.' } };
export const stageOf = wave => Math.floor(wave / RUNCFG.exitEvery);

/* ---------- what the host needs to know about a member ---------- */
export function buildOf(p) {
  const d = derive(p);
  return { name: p.name, look: p.look || null, level: p.level, weapon: p.weapon, armor: p.armor, skills: p.skills.slice(),
    d: { dex: d.dex, maxHp: d.maxHp, staminaMax: d.staminaMax, dmgMult: d.dmgMult, spdMult: d.spdMult, regenMult: d.regenMult },
    styles: { chain: p.styles.chain.slice(0, d.chainSlots), roles: Object.assign({}, p.styles.roles) }, hirelings: p.hirelings.map(h => allySpec(h, p)) };
}
RUNCFG.cart = { x: 570, r: 46 };                    // standing here (within r) with the cart panel open is what "at the cart" means
RUNCFG.voteSecs = 25; RUNCFG.ackSecs = 15; RUNCFG.reviveHp = 0.4;

/* ---------- the run: one or more members share it. Member 0 is the local player (with a profile); others are remote (a build only) ---------- */
export class Run {
  constructor(sim, profile, seed, pid) {
    this.sim = sim; this.seed = seed || 1; this.rng = makeRng(hash32(this.seed, profile.runs + 3)); this.hooks = {};
    this.phase = 'camp'; this.wave = 0; this.timer = 0; this.queue = []; this.spawnT = 0; this.waveKills = 0; this.msgs = []; this.dummyT = 0; this.banner = null; this.members = []; this.voteAt = 0; this.ackAt = 0; this.map = 'fields';
    sim.players[0].pid = pid || 'host';
    this.me = this.addMember(pid || 'host', buildOf(profile), profile);
    this.enterCamp();
  }
  setPid(pid) {                                        // the relay names the host; every place the old name was used follows
    const old = this.me.pid; if (old === pid) return; this.me.pid = pid; const q = this.sim.players[0]; q.pid = pid;
    for (const a of this.sim.allies) if (a.owner === old) a.owner = pid;
  }
  /* the local member's numbers, under the old names */
  get p() { return this.me.p; }
  get gold() { return this.me.gold; } set gold(v) { this.me.gold = v; }
  get kills() { return this.me.kills; } set kills(v) { this.me.kills = v; }
  get xpGain() { return this.me.xpGain; } set xpGain(v) { this.me.xpGain = v; }
  get levelUps() { return this.me.levelUps; } set levelUps(v) { this.me.levelUps = v; }
  get rank() { return this.me.rank; }
  get result() { return this.me.result; } set result(v) { this.me.result = v; }
  say(t) { this.msgs.push({ t: this.sim.t, text: t }); if (this.msgs.length > 12) this.msgs.shift(); }
  tierOf(m) { const a = RUNCFG.rank.at; let t = 0; for (let i = 0; i < a.length; i++) if (m.rank.score >= a[i]) t = i; return t; }
  get tier() { return this.tierOf(this.me); }
  get rankName() { return RUNCFG.rank.names[this.tier]; }
  goldMult(m) { return 1 + RUNCFG.rank.goldMult * this.tierOf(m || this.me); }
  byPid(pid) { return this.members.find(m => m.pid === pid) || null; }
  idx(m) { return this.sim.players.findIndex(q => q.pid === m.pid); }
  pl(m) { return this.sim.players.find(q => q.pid === m.pid) || null; }
  atCart(m) { const q = this.pl(m || this.me); return !!q && Math.abs(q.x - RUNCFG.cart.x) <= RUNCFG.cart.r; }

  /* ---------- members ---------- */
  addMember(pid, build, profile) {
    let m = this.byPid(pid); if (m) { m.build = build; return m; }
    m = { pid, name: build.name, build, p: profile || null, gold: 0, kills: 0, xpGain: 0, levelUps: 0, uses: {}, hireXp: 0, rank: { score: 0, last: '', idle: 0, tier: 0 }, ready: false, vote: null, acked: false, result: null, down: false };
    this.members.push(m);
    if (!this.sim.players.some(q => q.pid === pid)) this.sim.addPlayer(pid, build.name);
    const q = this.pl(m); q.name = build.name; q.look = build.look || null;
    if (this.members.length > 1) this.say(build.name + ' joined.');
    if (this.phase === 'camp') { this.applyBuild(false, m); }
    else if (this.phase === 'dead' || this.phase === 'left') { m.result = { kind: 'wait' }; m.acked = true; this.applyBuild(false, m); }
    else {                                                                // join in progress: straight into the fight, at the current wave
      const lead = this.sim.players.find(o => o !== q && o.hp > 0) || this.sim.players[0];
      q.x = this.sim.clampX(lead.x - 36); q.y = this.sim.clampY(lead.y + 18); q.swing = null;
      this.applyBuild(true, m); this.spawnAlliesFor(m);
    }
    return m;
  }
  removeMember(pid) {
    const m = this.byPid(pid); if (!m || m === this.me) return false;
    this.members = this.members.filter(o => o !== m); this.sim.removePlayer(pid); this.sim.allies = this.sim.allies.filter(a => a.owner !== pid);
    this.say(m.name + ' left.');
    if (this.phase === 'camp') this.checkDepart(); else if (this.phase === 'vote') this.checkVote();
    return true;
  }
  setBuild(pid, build) { const m = this.byPid(pid); if (!m) return; m.build = build; m.name = build.name; if (this.phase === 'camp') this.applyBuild(false, m); else { const q = this.pl(m); if (q) { q.name = build.name; q.look = build.look || null; } } }

  /* put a member's build on their fighter */
  applyBuild(inRun, m) {
    m = m || this.me; if (m.p) m.build = buildOf(m.p);
    const b = m.build, d = b.d, sim = this.sim, tier = CFG.tiers[b.armor], bonus = inRun ? 1 + RUNCFG.rank.dmgBonus * this.tierOf(m) : 1, i = this.idx(m); if (i < 0) return;
    applyCmd(sim, { t: 'set', p: i, weapon: b.weapon, dex: d.dex, maxHp: d.maxHp, hp: d.maxHp, staminaMax: d.staminaMax, stamina: d.staminaMax, dmgMult: d.dmgMult * bonus, spdMult: d.spdMult, regenMult: d.regenMult,
      armorPct: tier.pct, dur: tier.dur, durMax: tier.dur, broken: false, inv: !inRun, skills: { riposte: b.skills.includes('riposte'), shove: b.skills.includes('shove'), multi: b.skills.includes('multi') } });
    const q = sim.players[i]; q.name = b.name; q.look = b.look || null; q.armorKey = b.armor; q.roleStyles = Object.assign({}, b.styles.roles); m.down = false;
    if (this.hooks.build) this.hooks.build(m, i);                          // the page bakes the chain and attack moves it knows
  }
  enterCamp() {
    const sim = this.sim; this.phase = 'camp'; sim.mode = 'arena'; sim.manual = true;
    sim.clearEnemies(); sim.clearAllies(); sim.proj = [];
    this.members.forEach((m, k) => { const q = this.pl(m); q.x = 330 + k * 26; q.y = 282; q.swing = null; q.air = false; q.z = 0; q.grab = null; m.ready = false; m.vote = null; m.acked = false; m.result = null; this.applyBuild(false, m); });
    this.spawnDummy();
  }
  spawnDummy() {
    const e = this.sim.spawn({ kind: 'soldier', tier: 'leather', dur: 99, ai: 'stand' }); e.hp = e.maxHp = 60; e.x = 120; e.y = 282; e.face = 1; e.dummy = true; this.dummy = e; return e;
  }

  /* ---------- leaving camp: everyone stands at the cart and is ready ---------- */
  readyUp(pid, map) {
    const m = this.byPid(pid); if (!m || this.phase !== 'camp' || !this.atCart(m)) return false;
    m.ready = true; m.map = map || m.map || 'fields'; this.checkDepart(); return true;
  }
  unready(pid) { const m = this.byPid(pid); if (m) m.ready = false; }
  checkDepart() {
    if (this.phase !== 'camp' || !this.members.length) return false;
    if (!this.members.every(m => m.ready && this.atCart(m))) return false;
    this.launch(this.members[0].map || 'fields'); return true;
  }
  depart(map) { this.readyUp(this.me.pid, map); return this.phase === 'wave'; }          // alone, being ready is leaving
  launch(map) {
    const sim = this.sim; this.map = map || 'fields'; this.wave = 0;
    sim.clearEnemies(); sim.mode = 'run'; sim.manual = true; sim.proj = []; this.result = null;
    this.members.forEach((m, k) => {
      if (m.p) m.p.runs++; m.gold = 0; m.kills = 0; m.xpGain = 0; m.levelUps = 0; m.uses = {}; m.hireXp = 0; m.rank = { score: 0, last: '', idle: 0, tier: 0 }; m.result = null; m.vote = null; m.ready = false; m.down = false;
      const q = this.pl(m); q.x = 170 - k * 26; q.y = 282; q.swing = null; q.grab = null; this.applyBuild(true, m);
    });
    this.spawnAllies(); this.say('The run begins.'); this.startWave(1);
  }
  spawnAllies() { this.sim.clearAllies(); this.members.forEach(m => this.spawnAlliesFor(m)); }
  spawnAlliesFor(m) {
    const sim = this.sim, q = this.pl(m); sim.allies = sim.allies.filter(a => a.owner !== m.pid);
    m.build.hirelings.forEach((h, i) => { const a = sim.spawnAlly(Object.assign({}, h, { index: i, owner: m.pid })); if (q) { a.x = sim.clampX(q.x - 34 - i * 30); } });
  }
  startWave(n) {
    this.banner = { text: 'WAVE ' + n, at: this.sim.t }; this.wave = n; this.phase = 'wave'; this.queue = wavePlan(n); this.spawnT = 0.5; this.waveKills = 0;
    this.say('Wave ' + n + ': ' + this.queue.length + ' enemies.');
  }
  alive() { return this.sim.enemies.filter(e => e.state === 'alive').length; }

  /* call once per sim step, after sim.step() */
  update(dt) {
    const sim = this.sim, R = RUNCFG;
    const feed = sim.feed; sim.feed = [];
    if (this.phase === 'camp') {
      if (this.dummy && this.dummy.state !== 'alive') { this.dummyT += dt; if (this.dummyT > 1.5) { this.dummyT = 0; this.dummy = null; this.spawnDummy(); } }
      else if (this.dummy && this.dummy.hp < this.dummy.maxHp) this.dummy.hp = Math.min(this.dummy.maxHp, this.dummy.hp + 8 * dt);
      for (const m of this.members) if (m.ready && !this.atCart(m)) m.ready = false;       // walking away takes the ready back
      return;
    }
    for (const f of feed) {
      const who = f.pid != null ? [this.byPid(f.pid)].filter(Boolean) : (f.t === 'kill' ? this.members : [this.me]);
      if (f.t === 'kill') { for (const m of who) this.onKill(m, f, who.length); }
      else if (f.t === 'hit') { for (const m of who) this.onHit(m, f.move); }
      else if (f.t === 'hurt') { for (const m of who) { m.rank.score = 0; m.rank.last = ''; this.train(m, 'hurt'); this.syncRank(m); } }
    }
    if (this.phase === 'wave' || this.phase === 'between') for (const m of this.members) { m.rank.idle += dt; if (m.rank.idle > R.rank.idle) { m.rank.score = Math.max(0, m.rank.score - R.rank.decay * dt); this.syncRank(m); } }
    if (this.phase === 'wave' || this.phase === 'between' || this.phase === 'vote') {
      for (const m of this.members) { const q = this.pl(m); if (q && q.hp <= 0 && !m.down) { m.down = true; this.say(m.name + ' is down.'); } }
      if (this.members.length && this.members.every(m => m.down)) { this.die(); return; }
    }
    if (this.phase === 'wave') {
      this.spawnT -= dt;
      const cap = Math.min(R.maxAlive + this.wave * R.maxAlivePerWave, 3 + 2 * (this.wave - 1)) + 4 * (this.members.length - 1);       // 3 at a time on wave 1, building to the full cap by wave 7
      if (this.queue.length && this.spawnT <= 0 && this.alive() < cap) { this.spawnOne(); this.spawnT = R.spawnGap; }
      if (!this.queue.length && this.alive() === 0) this.clearWave();
    } else if (this.phase === 'between') {
      this.timer -= dt; if (this.timer <= 0) this.startWave(this.wave + 1);
    } else if (this.phase === 'vote') {
      if (sim.t >= this.voteAt) this.resolveVote();
    } else if (this.phase === 'dead' || this.phase === 'left') {
      if (sim.t >= this.ackAt) this.enterCamp();
    }
  }
  spawnOne() {
    const sim = this.sim, kind = this.queue.shift(), side = this.rng() < 0.5 ? -1 : 1;
    const e = sim.spawn({ kind, ai: 'advance' });
    e.x = side > 0 ? CFG.arena.right - 8 : CFG.arena.left + 8; e.y = sim.clampY(CFG.band.top + this.rng() * (CFG.band.bottom - CFG.band.top)); e.face = -side;
    const k = 1 + R_HP() * (this.wave - 1) + 0.25 * (this.members.length - 1); e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * k));
    return e;
  }
  train(m, kind) { if (m.p) return trainFromUse(m.p, kind); m.uses[kind] = (m.uses[kind] || 0) + 1; return false; }
  onKill(m, f, share) {
    const R = RUNCFG, k = f.kind; m.kills++;
    m.gold += Math.max(1, Math.round((R.gold.kill[k] || 1) * this.goldMult(m) / share)); this.giveXp(m, Math.max(1, Math.round((R.xp.kill[k] || 1) / share)));
  }
  giveXp(m, n) {
    m.xpGain += n; if (!m.p) return;
    const up = addXp(m.p, n); if (up) { m.levelUps += up; this.say(m.name + ' reached level ' + m.p.level + '.'); const q = this.pl(m); if (q) this.sim.text(q.x, q.y - 120, 'LEVEL UP', '#ffe27a', 12); }
  }
  onHit(m, move) {
    const R = RUNCFG.rank, g = this.train(m, move);
    if (g && m === this.me) this.say(g.toUpperCase() + ' grew from use.');
    m.rank.idle = 0;
    if (m.rank.last && m.rank.last === move) m.rank.score = Math.max(0, m.rank.score + R.repeat); else m.rank.score = Math.min(100, m.rank.score + R.gain);
    m.rank.last = move; this.syncRank(m);
  }
  syncRank(m) {                                        // the small combat bonus follows the rank tier
    const t = this.tierOf(m); if (t === m.rank.tier) return; m.rank.tier = t;
    const i = this.idx(m); if (i >= 0) applyCmd(this.sim, { t: 'set', p: i, dmgMult: m.build.d.dmgMult * (1 + RUNCFG.rank.dmgBonus * t) });
  }
  clearWave() {
    const R = RUNCFG, sim = this.sim; this.say('Wave ' + this.wave + ' cleared.'); this.banner = { text: 'WAVE CLEARED', at: sim.t };
    for (const m of this.members) {
      m.gold += Math.round(R.gold.wave * this.wave * this.goldMult(m)); this.giveXp(m, R.xp.wave * this.wave);
      if (m.p) { for (const h of m.p.hirelings) if (hirelingXp(h, 1)) this.say(h.name + ' reached level ' + h.level + '.'); } else m.hireXp++;
      const q = this.pl(m), i = this.idx(m);
      if (q.hp <= 0) applyCmd(sim, { t: 'set', p: i, hp: Math.max(1, Math.round(q.maxHp * R.reviveHp)) });       // a downed fighter is back on their feet
      else applyCmd(sim, { t: 'set', p: i, hp: Math.min(q.maxHp, q.hp + Math.round(q.maxHp * R.healBetween)) });
      applyCmd(sim, { t: 'set', p: i, stamina: q.staminaMax }); m.down = false;
    }
    this.spawnAllies();                                // fallen hirelings return, no penalty
    if (this.wave % R.exitEvery === 0) { this.phase = 'vote'; this.voteAt = sim.t + R.voteSecs; for (const m of this.members) m.vote = null; this.say('Leave, or press on?'); }
    else { this.phase = 'between'; this.timer = R.between; }
  }
  leavePayOf(m) { return Math.round(m.gold * (1 + RUNCFG.deepBonus * (stageOf(this.wave) - 1))); }
  leavePay() { return this.leavePayOf(this.me); }
  /* the exit vote: leave if more vote to leave than to stay; silence counts as staying */
  castVote(pid, leave) { const m = this.byPid(pid); if (!m || this.phase !== 'vote') return false; m.vote = leave ? 'leave' : 'stay'; this.checkVote(); return true; }
  vote(leave) { return this.castVote(this.me.pid, leave); }
  checkVote() { if (this.phase === 'vote' && this.members.every(m => m.vote)) this.resolveVote(); }
  resolveVote() {
    if (this.phase !== 'vote') return;
    const leave = this.members.filter(m => m.vote === 'leave').length, stay = this.members.length - leave;
    if (leave > stay) {
      for (const m of this.members) { const g = this.leavePayOf(m); if (m.p) { m.p.gold += g; m.p.best = Math.max(m.p.best, this.wave); } m.result = { kind: 'left', wave: this.wave, gold: g, kills: m.kills, xp: m.xpGain, levels: m.levelUps, uses: m.uses, hireXp: m.hireXp }; m.acked = false; }
      this.phase = 'left'; this.ackAt = this.sim.t + RUNCFG.ackSecs;
    } else { this.say(this.members.length > 1 ? 'The party presses on.' : ''); this.phase = 'between'; this.timer = RUNCFG.between; }
  }
  die() {
    this.phase = 'dead'; this.ackAt = this.sim.t + RUNCFG.ackSecs;
    for (const m of this.members) { if (m.p) m.p.best = Math.max(m.p.best, this.wave - 1); m.result = { kind: 'dead', wave: this.wave, lost: m.gold, kills: m.kills, xp: m.xpGain, levels: m.levelUps, uses: m.uses, hireXp: m.hireXp }; m.gold = 0; m.acked = false; }   // the run's gold is gone; gear, levels and unlocks stay
  }
  ack(pid) { const m = this.byPid(pid); if (!m) return; m.acked = true; if (this.members.every(o => o.acked)) this.enterCamp(); }
  returnToCamp() { if (this.phase === 'dead' || this.phase === 'left') this.ack(this.me.pid); }
}
const R_HP = () => RUNCFG.waveHp;

/* what a remote member's browser does with the reward the host sends it when a run ends (and for the local run's growth is already applied) */
export function applyRemoteResult(p, r) {
  if (!r || r.kind === 'wait') return { levels: 0 };
  let up = addXp(p, r.xp || 0);
  for (const k in (r.uses || {})) for (let i = 0; i < r.uses[k]; i++) trainFromUse(p, k);
  for (const h of p.hirelings) for (let i = 0; i < (r.hireXp || 0); i++) hirelingXp(h, 1);
  if (r.kind === 'left') { p.gold += r.gold; p.best = Math.max(p.best, r.wave); } else p.best = Math.max(p.best, r.wave - 1);
  return { levels: up };
}
