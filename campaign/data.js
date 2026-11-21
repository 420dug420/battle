/* ============================================================
   PROJECT WAR · CAMPAIGN DATA  (no DOM, no drawing)
   Characters, gear, gold, styles, hirelings, the world map and battle generation.
   Every number marked PLACEHOLDER is a tuning guess. The combat rules themselves live in game/sim.js.
   ============================================================ */
import { CFG, makeRng, hash32, weaponStats, swingInterval } from '../game/sim.js';

export const SAVE_VERSION = 1;
export const START_GOLD = 40;          // PLACEHOLDER
export const MAX_HIRELINGS = 3;        // PLACEHOLDER
export const MAX_SLOTS = 3;            // chain slots (style 1, 2, 3)
export const LOST_GOLD_FRAC = 0.25;    // PLACEHOLDER: gold lost when you lose a fight
export const CAMP_RESPAWN_DAYS = 5;    // PLACEHOLDER

/* ---------- gear ---------- */
// parts by rank (these are the same parts the rig draws; M3.rankPools lists them for enemies)
const HEAD_LISTS = {
  1: [['bare', 'Bare head'], ['cap', 'Arming cap'], ['leathercap', 'Leather cap'], ['hood', 'Cloth hood']],
  2: [['coif', 'Mail coif'], ['coifhelm', 'Skullcap over coif'], ['helm', 'Kettle helm'], ['cone', 'Conical helm'], ['sallet', 'Sallet'], ['kettlehat', 'Kettle hat']],
  3: [['bascinet', 'Bascinet'], ['greathelm', 'Great helm'], ['beaked', 'Beaked bascinet'], ['domed', 'Domed helm']],
};
const TORSO_LISTS = {
  1: [['tunic', 'Tunic'], ['jerkin', 'Leather jerkin'], ['quilted', 'Quilted coat'], ['jack', 'Padded jack']],
  2: [['haubergeon', 'Mail shirt over tunic'], ['mailjerkin', 'Mail under leather'], ['mail', 'Mail hauberk'], ['brigandine', 'Brigandine'], ['lamellar', 'Lamellar']],
  3: [['plate', 'Plate harness'], ['komtur', 'Mantle and cross'], ['griffon', 'Per fess tabard'], ['stag', 'Bend tabard'], ['sun', 'Sunburst surcoat']],
};
// per piece, by rank. A full mail set (head + torso) is 25% and 9 durability, plate 50% and 12: the old tiers, split between the pieces.
const HEAD_STAT = { 1: { pct: 0, dur: 2, price: 4, rep: 1 }, 2: { pct: 0.08, dur: 3, price: 20, rep: 2 }, 3: { pct: 0.17, dur: 4, price: 60, rep: 4 } };
const TORSO_STAT = { 1: { pct: 0, dur: 4, price: 8, rep: 1 }, 2: { pct: 0.17, dur: 6, price: 45, rep: 2 }, 3: { pct: 0.33, dur: 8, price: 140, rep: 4 } };
const SHIELD_DEFS = [['buckler', 'Wooden buckler', 1, 0, 2, 5], ['heater', 'Heater shield', 2, 0.05, 4, 25], ['kite', 'Kite shield', 3, 0.08, 6, 70]];
const WEAPON_DEFS = [['longsword', 'Longsword', 25, 1], ['greatsword', 'Two-hander', 45, 2], ['axe', 'Hand axe', 20, 1], ['mace', 'Mace', 20, 1], ['spear', 'Spear', 30, 2]];

export const ITEMS = {};
for (const r of [1, 2, 3]) {
  for (const [id, name] of HEAD_LISTS[r]) ITEMS['h_' + id] = Object.assign({ key: 'h_' + id, slot: 'head', name, tier: r, look: id }, HEAD_STAT[r], id === 'bare' ? { dur: 0, price: 0 } : {});
  for (const [id, name] of TORSO_LISTS[r]) ITEMS['t_' + id] = Object.assign({ key: 't_' + id, slot: 'torso', name, tier: r, look: id }, TORSO_STAT[r]);
}
for (const [id, name, tier, pct, dur, price] of SHIELD_DEFS) ITEMS['s_' + id] = { key: 's_' + id, slot: 'shield', name, tier, pct, dur, price, look: id };
for (const [id, name, price, hands] of WEAPON_DEFS) ITEMS['w_' + id] = { key: 'w_' + id, slot: 'weapon', name, tier: 1, weapon: id, hands, price, pct: 0, dur: 0 };
export const SLOTS = ['head', 'torso', 'weapon', 'shield'];
export const itemsOf = (slot, tier) => Object.values(ITEMS).filter(i => i.slot === slot && (tier == null || i.tier === tier));
export const sellPrice = it => Math.floor(it.price * 0.5);
export const REPAIR_PER_DUR = { 1: 1, 2: 2, 3: 4 };      // PLACEHOLDER: gold per durability point, by rank
export const tierName = t => ({ 1: 'Rank 1', 2: 'Rank 2', 3: 'Rank 3' })[t] || '';
export const WEAPON_HANDS = Object.fromEntries(WEAPON_DEFS.map(w => [w[0], w[3]]));

/* ---------- styles: the attack animations you can chain ---------- */
// built in: the procedural moves. Animator attacks arrive from the animation library (game/anims.json or a loaded file) as 'c_<id>'.
export const BASE_STYLES = [
  { id: 'cut', name: 'Cut', hands: 0 }, { id: 'chop', name: 'Chop', hands: 0 }, { id: 'attack2', name: 'Horizontal sweep', hands: 0 }, { id: 'lunge', name: 'Lunge', hands: 0 },
];
export function libraryStyles(anims) {                 // attack animations from a library; hands 1 or 2 from the loadout
  return (anims || []).filter(a => (a.type || 'attack') === 'attack' && a.keys && a.keys.length).map(a => ({ id: 'c_' + (a.id || 'legacy'), name: a.name || 'Custom', hands: (a.load ? a.load === '2' : a.two) ? 2 : 1, custom: true }));
}
export const allStyles = anims => BASE_STYLES.concat(libraryStyles(anims));
export const styleFits = (st, hands) => !st.hands || st.hands === hands;

/* ---------- names ---------- */
const SYL = ['ash', 'bran', 'cold', 'dun', 'el', 'fen', 'gar', 'hal', 'ing', 'kel', 'lor', 'mar', 'nor', 'ox', 'pen', 'rav', 'stan', 'thorn', 'ul', 'wick'];
const END = ['ford', 'wick', 'mere', 'holm', 'stead', 'brook', 'moor', 'haven', 'bury', 'cross', 'dale', 'gate'];
const FIRST = ['Aldric', 'Bertram', 'Cedric', 'Dunstan', 'Edmund', 'Faramond', 'Godwin', 'Hugh', 'Ivo', 'Jorund', 'Kolbein', 'Leofric', 'Magnus', 'Osric', 'Piers', 'Rowan', 'Sigurd', 'Tobias', 'Ulf', 'Wat', 'Ysolde', 'Maud', 'Hild', 'Brenna', 'Isolde', 'Edda'];
const BYNAME = ['the Lame', 'Red', 'of the Mill', 'One-Eye', 'the Younger', 'Ironside', 'Swift', 'the Quiet', 'Bellows', 'Crow', 'the Tall', 'Short', 'Wolfsbane', 'Blackbriar'];
const pick = (r, l) => l[Math.floor(r() * l.length) % l.length];
const placeName = r => { const a = pick(r, SYL), b = pick(r, END); return a[0].toUpperCase() + a.slice(1) + b; };
const personName = r => pick(r, FIRST) + ' ' + pick(r, BYNAME);

/* ---------- a new game ---------- */
export const LIVERY_IDS = ['red', 'violet', 'azure', 'green', 'black', 'white', 'gold', 'ash'];
let iidCounter = 1;
export function mkItem(state, key, durFrac) {
  const def = ITEMS[key]; if (!def) throw new Error('unknown item ' + key);
  const it = { iid: 'i' + (state.nextIid++), key, dur: Math.max(0, Math.round(def.dur * (durFrac == null ? 1 : durFrac))) };
  state.items.push(it); return it;
}
export const itemDef = it => ITEMS[it.key];
export const itemById = (state, iid) => state.items.find(i => i.iid === iid) || null;

export function newGame(o) {
  const seed = (o.seed != null ? o.seed : Date.now()) >>> 0;
  const st = {
    v: SAVE_VERSION, seed, day: 1, gold: START_GOLD, nextIid: 1, nextHid: 1,
    char: { name: (o.name || 'Captain').slice(0, 24), head: HEAD_LISTS[1].some(h => h[0] === o.head) ? o.head : 'cap', body: TORSO_LISTS[1].some(h => h[0] === o.torso) ? o.torso : 'tunic',
            liv: LIVERY_IDS.includes(o.liv) ? o.liv : 'red', metal: 'steel', dex: 5, chr: 5, san: 5, hp: CFG.player.hp },
    company: { name: (o.company || 'The Free Company').slice(0, 28), logo: o.logo || null },
    items: [], equipped: { head: null, torso: null, weapon: null, shield: null },
    styles: { owned: ['cut'], slots: ['cut'], slotCount: 1 }, library: null,
    hirelings: [], flags: { tutorialDone: false }, map: null, at: 0, camps: {}, log: [],
  };
  const w = WEAPON_DEFS.find(x => x[0] === o.weapon) || WEAPON_DEFS[0];
  st.equipped.head = mkItem(st, 'h_' + st.char.head).iid; st.equipped.torso = mkItem(st, 't_' + st.char.body).iid; st.equipped.weapon = mkItem(st, 'w_' + w[0]).iid;
  if (w[3] === 1) st.equipped.shield = mkItem(st, 's_buckler').iid;
  st.map = genMap(seed); st.at = st.map.start;
  return st;
}

/* ---------- derived numbers (the equip screen and the battle both read these) ---------- */
export function derived(state, cfg) {
  cfg = cfg || CFG;
  const eq = state.equipped, get = s => eq[s] ? itemById(state, eq[s]) : null;
  const head = get('head'), torso = get('torso'), weapon = get('weapon'), shield = get('shield');
  const worn = [head, torso, shield].filter(Boolean).map(it => ({ it, def: itemDef(it) }));
  const live = worn.filter(w => w.it.dur > 0 || w.def.dur === 0);                  // a worn-out piece protects nothing
  const pct = Math.min(0.9, live.reduce((a, w) => a + w.def.pct, 0)), dur = worn.reduce((a, w) => a + w.it.dur, 0), durMax = worn.reduce((a, w) => a + w.def.dur, 0);
  const wdef = weapon ? itemDef(weapon) : ITEMS.w_longsword, ws = weaponStats(cfg, wdef.weapon);
  return {
    hp: state.char.hp, pct, dur, durMax, weapon: wdef.weapon, weaponName: wdef.name, cls: ws.cls, hands: wdef.hands, dmg: ws.dmg, reach: ws.reach, posture: ws.posture,
    interval: swingInterval(cfg, wdef.weapon, state.char[ws.speedStat] || 5), shield: !!shield && wdef.hands === 1,
    look: { head: head ? itemDef(head).look : 'bare', body: torso ? itemDef(torso).look : 'tunic', liv: state.char.liv, metal: state.char.metal },
    stats: { dex: state.char.dex, chr: state.char.chr, san: state.char.san },
  };
}
// the 'set' command for a battle: your gear as the sim's single armor pool
export function playerSet(state, cfg) {
  const d = derived(state, cfg), c = state.char;
  return { t: 'set', weapon: d.weapon, dex: c.dex, san: c.san, chr: c.chr, inv: false, hp: d.hp, maxHp: d.hp, armorPct: d.pct, dur: d.dur, durMax: d.dur, broken: false };
}

/* ---------- equip, buy, sell, repair ---------- */
export function equip(state, slot, iid) {
  const it = iid ? itemById(state, iid) : null;
  if (iid && (!it || itemDef(it).slot !== slot)) return { ok: false, why: 'That does not go there.' };
  if (slot === 'head' || slot === 'torso') if (!it) return { ok: false, why: 'Wear something.' };
  if (slot === 'weapon') {
    if (!it) return { ok: false, why: 'Carry a weapon.' };
    state.equipped.weapon = iid;
    if (itemDef(it).hands === 2 && state.equipped.shield) state.equipped.shield = null;       // two hands on the weapon: the shield comes off
    return { ok: true };
  }
  if (slot === 'shield' && it) {
    const w = itemById(state, state.equipped.weapon);
    if (w && itemDef(w).hands === 2) return { ok: false, why: 'A two-handed weapon leaves no hand for a shield.' };
  }
  state.equipped[slot] = iid || null; return { ok: true };
}
export const isEquipped = (state, iid) => Object.values(state.equipped).includes(iid);

export function shopStock(state, townId) {
  const week = Math.floor((state.day - 1) / 7), r = makeRng(hash32(state.seed, townId * 131 + week * 7 + 1)), lvl = state.map.nodes[townId].level;
  const out = [];
  for (const slot of ['head', 'torso']) {
    const keys = new Set();
    for (let n = 0; n < 3; n++) { const t = 1 + Math.min(2, Math.floor(r() * (lvl + 1.5))); const pool = itemsOf(slot, t).filter(i => i.look !== 'bare'); keys.add(pool[Math.floor(r() * pool.length)].key); }
    keys.forEach(k => out.push(k));
  }
  for (const w of WEAPON_DEFS) out.push('w_' + w[0]);
  const sh = itemsOf('shield').filter(i => i.tier <= 1 + lvl); sh.forEach(i => out.push(i.key));
  return out;
}
export function buy(state, key) {
  const def = ITEMS[key]; if (!def) return { ok: false, why: 'No such item.' };
  if (state.gold < def.price) return { ok: false, why: 'Not enough gold.' };
  state.gold -= def.price; const it = mkItem(state, key); return { ok: true, it };
}
export function sell(state, iid) {
  const it = itemById(state, iid); if (!it) return { ok: false, why: 'No such item.' };
  if (isEquipped(state, iid)) return { ok: false, why: 'Take it off first.' };
  const def = itemDef(it), wear = def.dur ? it.dur / def.dur : 1;
  const g = Math.max(def.price ? 1 : 0, Math.floor(sellPrice(def) * (0.4 + 0.6 * wear)));
  state.gold += g; state.items = state.items.filter(i => i !== it); return { ok: true, gold: g };
}
export function repairCost(it) { const d = itemDef(it); return Math.max(0, d.dur - it.dur) * (REPAIR_PER_DUR[d.tier] || 1); }
export function repair(state, iid) {
  const items = iid ? [itemById(state, iid)] : state.items; let cost = 0;
  const todo = items.filter(Boolean).filter(it => repairCost(it) > 0);
  const total = todo.reduce((a, it) => a + repairCost(it), 0); if (!total) return { ok: false, why: 'Nothing needs mending.' };
  if (state.gold < total) return { ok: false, why: 'Repairs cost ' + total + ' gold.' };
  for (const it of todo) { cost += repairCost(it); it.dur = itemDef(it).dur; }
  state.gold -= cost; return { ok: true, cost };
}

/* ---------- styles ---------- */
export function chainFor(state, anims) {                 // style ids for the equipped slots that fit this weapon's hands, in order
  const hands = derived(state).hands, all = allStyles(anims), out = [];
  for (const id of state.styles.slots.slice(0, state.styles.slotCount)) { const st = all.find(s => s.id === id); if (st && styleFits(st, hands)) out.push(id); }
  return out.length ? out : ['cut'];
}
export function setSlot(state, i, id) {
  if (i < 0 || i >= state.styles.slotCount) return { ok: false, why: 'That slot is locked.' };
  if (id && !state.styles.owned.includes(id)) return { ok: false, why: 'You do not know that style.' };
  while (state.styles.slots.length < state.styles.slotCount) state.styles.slots.push(null);
  state.styles.slots[i] = id || null;
  if (!state.styles.slots.some(Boolean)) state.styles.slots[0] = 'cut';
  return { ok: true };
}
export function learnStyle(state, id) { if (!state.styles.owned.includes(id)) state.styles.owned.push(id); }

/* ---------- hirelings ---------- */
const HIRE_WEAPONS = ['longsword', 'axe', 'mace', 'spear'];
const HIRE_BASE = { 1: { hp: 18, fee: 15 }, 2: { hp: 24, fee: 45 }, 3: { hp: 30, fee: 110 } };   // PLACEHOLDER: one-time fee
export function recruits(state, townId) {
  const week = Math.floor((state.day - 1) / 7), r = makeRng(hash32(state.seed, townId * 977 + week * 13 + 5)), lvl = state.map.nodes[townId].level, out = [];
  for (let i = 0; i < 3; i++) {
    const tier = 1 + Math.min(2, Math.floor(r() * (lvl + 0.6))), weapon = pick(r, HIRE_WEAPONS), name = personName(r), seed = Math.floor(r() * 4e9);
    out.push({ rid: townId + ':' + week + ':' + i, name, tier, weapon, hp: HIRE_BASE[tier].hp, fee: HIRE_BASE[tier].fee + (weapon === 'spear' ? 5 : 0), seed });
  }
  return out;
}
export function hire(state, rec, enemyLook) {
  if (state.hirelings.length >= MAX_HIRELINGS) return { ok: false, why: 'Your company is full (' + MAX_HIRELINGS + ').' };
  if (state.hirelings.some(h => h.rid === rec.rid)) return { ok: false, why: 'Already hired.' };
  if (state.gold < rec.fee) return { ok: false, why: 'Not enough gold.' };
  state.gold -= rec.fee;
  const look = enemyLook ? enemyLook(rec.tier, rec.seed) : null;
  const h = { hid: 'h' + (state.nextHid++), rid: rec.rid, name: rec.name, tier: rec.tier, weapon: rec.weapon, hp: rec.hp, fee: rec.fee, look: look ? { head: look.head, body: look.body, metal: look.metal, liv: state.char.liv } : null };
  state.hirelings.push(h); return { ok: true, h };
}
export const dismiss = (state, hid) => { state.hirelings = state.hirelings.filter(h => h.hid !== hid); };
export function allySpec(h) { return { hid: h.hid, name: h.name, tier: h.tier, weapon: h.weapon, hp: h.hp, look: h.look }; }

/* ---------- world map ---------- */
export function genMap(seed) {
  const r = makeRng(hash32(seed, 0xA11CE)), cols = 3, rows = 3, nodes = [];
  const W = 640, H = 360, mx = 70, my = 55;
  for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) {
    nodes.push({ id: ry * cols + cx, x: Math.round(mx + cx * (W - 2 * mx) / (cols - 1) + (r() - 0.5) * 70), y: Math.round(my + ry * (H - 2 * my) / (rows - 1) + (r() - 0.5) * 50), type: 'camp', name: '', level: 0 });
  }
  const start = (rows - 1) * cols, towns = new Set([start]);
  const far = nodes.filter(n => n.id !== start).sort((a, b) => ((b.x - nodes[start].x) ** 2 + (b.y - nodes[start].y) ** 2) - ((a.x - nodes[start].x) ** 2 + (a.y - nodes[start].y) ** 2) + (r() - 0.5) * 4000);
  towns.add(far[0].id); towns.add(far[Math.floor(far.length / 2)].id); towns.add(far[far.length - 2].id);
  let edges = [];
  for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) { const i = ry * cols + cx; if (cx < cols - 1) edges.push([i, i + 1]); if (ry < rows - 1) edges.push([i, i + cols]); }
  const connected = es => { const seen = new Set([0]), q = [0]; while (q.length) { const a = q.pop(); for (const [u, v] of es) { const b = u === a ? v : v === a ? u : -1; if (b >= 0 && !seen.has(b)) { seen.add(b); q.push(b); } } } return seen.size === nodes.length; };
  for (let k = 0; k < 2; k++) { const i = Math.floor(r() * edges.length), tryE = edges.filter((_, j) => j !== i); if (connected(tryE)) edges = tryE; }
  const dist = new Array(nodes.length).fill(99); dist[start] = 0; const q = [start];
  while (q.length) { const a = q.shift(); for (const [u, v] of edges) { const b = u === a ? v : v === a ? u : -1; if (b >= 0 && dist[b] === 99) { dist[b] = dist[a] + 1; q.push(b); } } }
  const used = new Set(); const nm = () => { let n; do { n = placeName(r); } while (used.has(n)); used.add(n); return n; };
  for (const n of nodes) {
    n.dist = dist[n.id]; n.name = nm();
    if (towns.has(n.id)) { n.type = 'town'; n.level = Math.min(2, Math.floor(n.dist / 2)); if (n.id === start) { n.level = 0; n.name = 'Hearthmoor'; } }
    else { n.type = 'camp'; n.danger = Math.max(1, Math.min(5, n.dist)); n.kind = pick(r, ['Bandit camp', 'Deserter camp', 'Raider camp', 'Poacher hold']); }
  }
  return { nodes, edges, start };
}
export const neighbors = (map, id) => map.edges.filter(e => e[0] === id || e[1] === id).map(e => e[0] === id ? e[1] : e[0]);
export function campReady(state, id) { const c = state.camps[id]; return !c || state.day >= c.until; }

// travel one hop: a day passes; the road may bring an ambush (about one hop in four), decided by the seed so a reload can't dodge it
export function travel(state, to) {
  if (!neighbors(state.map, state.at).includes(to)) return { ok: false, why: 'No road leads there.' };
  const from = state.at; state.at = to; state.day += 1;
  const r = makeRng(hash32(state.seed, state.day * 1009 + from * 31 + to));
  const dest = state.map.nodes[to], ambush = r() < 0.25;
  return { ok: true, ambush, danger: Math.max(1, Math.min(5, Math.max(dest.dist || 1, state.map.nodes[from].dist || 1))) };
}

/* ---------- battles ---------- */
const TIER_KEY = { 1: 'leather', 2: 'mail', 3: 'plate', 4: 'special' };
const PAY = { leather: 6, mail: 14, plate: 30, special: 60 };      // PLACEHOLDER
const WEIGHTS = { 1: [1, 0, 0, 0], 2: [0.7, 0.3, 0, 0], 3: [0.4, 0.5, 0.1, 0], 4: [0.15, 0.5, 0.35, 0], 5: [0, 0.4, 0.5, 0.1] };
export function genBattle(seed, danger, label) {
  const r = makeRng(hash32(seed, 0xBA77)), d = Math.max(1, Math.min(5, danger | 0)), w = WEIGHTS[d], n = Math.min(7, 2 + d + Math.floor(r() * 2));
  const enemies = [];
  for (let i = 0; i < n; i++) {
    let x = r(), k = 0; while (k < 3 && x > w[k]) { x -= w[k]; k++; }
    enemies.push({ tier: TIER_KEY[k + 1], ai: r() < 0.75 ? 'advance' : 'stand', san: 4 + Math.floor(r() * 3), chr: 4 + Math.floor(r() * 4) });
  }
  const wx = r(), weather = wx < 0.55 ? 'clear' : wx < 0.8 ? 'rain' : 'fog', tx = r(), time = tx < 0.6 ? 'day' : tx < 0.85 ? 'dusk' : 'night';
  const pay = Math.round(enemies.reduce((a, e) => a + PAY[e.tier], 0) * (1 + d * 0.1));
  return { id: 'b' + (seed >>> 0), label: label || 'Skirmish', danger: d, enemies, weather, time, pay, seed: seed >>> 0, tutorial: false };
}
export function tutorialBattle() {
  return { id: 'tutorial', label: 'Training ground', danger: 0, enemies: [{ tier: 'leather', ai: 'advance', san: 5, chr: 5 }, { tier: 'leather', ai: 'advance', san: 5, chr: 5 }], weather: 'clear', time: 'day', pay: 10, seed: 12345, tutorial: true };
}
export const TUTORIAL_REWARD = 'chop';
export function battleFor(state, nodeId, ambush, danger) {
  const n = state.map.nodes[nodeId], seed = hash32(state.seed, state.day * 7919 + nodeId * 17 + (ambush ? 1 : 0));
  return genBattle(seed, ambush ? danger : n.danger, ambush ? 'Ambush on the road' : n.kind + ' near ' + n.name);
}

// applies a finished battle to the campaign and returns what happened, for the result screen
export function finishBattle(state, spec, res) {
  const out = { won: res.outcome === 'won', pay: 0, loot: [], lostGold: 0, dead: [], wear: 0, unlocked: [], text: [] };
  // armor wear: what the sim's pool lost, spread over the worn pieces
  const d = derived(state), loss = Math.max(0, d.dur - (res.dur != null ? res.dur : d.dur));
  if (loss > 0) {
    const pieces = ['torso', 'head', 'shield'].map(s => state.equipped[s] && itemById(state, state.equipped[s])).filter(it => it && it.dur > 0);
    let left = loss; const tot = pieces.reduce((a, it) => a + it.dur, 0) || 1;
    for (const it of pieces) { const take = Math.min(it.dur, Math.round(loss * it.dur / tot)); it.dur -= take; left -= take; }
    for (const it of pieces) { if (left <= 0) break; const take = Math.min(it.dur, left); it.dur -= take; left -= take; }
    out.wear = loss;
  }
  state.char.hp = CFG.player.hp;
  const fallen = res.fallen || [];
  if (out.won) {
    out.pay = spec.pay; state.gold += out.pay;
    for (const id of res.kills || []) {                                   // each man you downed may have carried something
      const r = makeRng(hash32(spec.seed, state.nextIid * 31 + out.loot.length + 7));
      if (r() < 0.3) { const t = { leather: 1, mail: 2, plate: 3, special: 3 }[id] || 1, slot = r() < 0.5 ? 'head' : 'torso', pool = itemsOf(slot, t).filter(i => i.look !== 'bare'); const it = mkItem(state, pool[Math.floor(r() * pool.length)].key, 0.4 + r() * 0.6); out.loot.push(it); }
    }
    if (spec.tutorial && !state.flags.tutorialDone) {
      state.flags.tutorialDone = true; learnStyle(state, TUTORIAL_REWARD); state.styles.slotCount = Math.max(state.styles.slotCount, 2);
      if (!state.styles.slots[1]) state.styles.slots[1] = TUTORIAL_REWARD; out.unlocked.push(TUTORIAL_REWARD);
      out.text.push('You learned a second fighting style, and a second slot to chain it in.');
    }
    if (!spec.tutorial && spec.campId != null) state.camps[spec.campId] = { until: state.day + CAMP_RESPAWN_DAYS };
  } else if (!spec.tutorial) {
    out.lostGold = Math.floor(state.gold * LOST_GOLD_FRAC); state.gold -= out.lostGold;
    for (const hid of fallen) { const h = state.hirelings.find(x => x.hid === hid); if (h) out.dead.push(h.name); }
    state.hirelings = state.hirelings.filter(h => !fallen.includes(h.hid));
    state.at = state.map.start; state.day += 2;                          // carried back to Hearthmoor
    out.text.push('You are carried back to ' + state.map.nodes[state.map.start].name + ' (2 days).');
  }
  return out;
}

/* ---------- saving ---------- */
export const serialize = state => JSON.stringify(state);
export function deserialize(txt) {
  const s = JSON.parse(txt);
  if (!s || s.v !== SAVE_VERSION || !s.map || !s.char || !s.items) throw new Error('not a Project War save');
  return s;
}
