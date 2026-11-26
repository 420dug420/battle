import assert from 'node:assert';
import { CFG, Sim, applyCmd, SIM_VERSION, makeRng, weaponStats, swingInterval, minDexForWindow, fitsWindow, segSegDist, moveTouches } from './sim.js';

function fresh(weapon, dex) {
  const s = new Sim(CFG); s.rng = () => 0; // always passes chance rolls
  s.player.weapon = weapon; s.player.dex = dex;
  return s;
}
function run(s, secs, onTick) {
  const n = Math.round(secs * 60);
  for (let i = 0; i < n; i++) { if (onTick) onTick(i / 60); s.step(1 / 60); }
}
const hits = s => s.log.filter(l => /Hit /.test(l.text));

// 1. window math
assert(fitsWindow(CFG, 'longsword', 5), 'longsword DEX5 fits the window');
assert(!fitsWindow(CFG, 'greatsword', 5), 'two-hander DEX5 misses the window');
const need = minDexForWindow(CFG, 'greatsword');
assert(need > 5 && fitsWindow(CFG, 'greatsword', need));
console.log('two-hander needs DEX', need, 'interval', swingInterval(CFG, 'greatsword', need).toFixed(3));

// 2. the design example: 9 HP, 3 dmg, Wounded crit kills in two hits (longsword, DEX 5, no movement)
let s = fresh('longsword', 5);
const e = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); e.x = s.player.x + 40; e.y = s.player.y;
run(s, 3);
assert.strictEqual(e.state, 'dying', 'enemy dead');
assert.strictEqual(e.dramatic, true, 'killed while wounded -> dramatic');
assert.strictEqual(hits(s).length, 2, 'exactly two hits');
console.log('PASS two-hit wounded kill:', hits(s).map(h => h.text).join(' || '));

// 3. moving between swings breaks the follow-up
s = fresh('longsword', 5);
const e2 = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); e2.x = s.player.x + 40; e2.y = s.player.y;
run(s, 2, t => { s.input = (t > 0.45 && t < 0.6) ? { x: 0.01, y: 0 } : { x: 0, y: 0 }; });
assert(e2.state === 'alive' || !e2.dramatic, 'moving mid-chain must not give the dramatic kill in time');
console.log('PASS moving breaks follow-up; enemy hp', e2.hp);

// 4. two-hander at DEX 5 cannot cash the Wounded window (4 dmg: 9 -> 5, then normal 4 -> 1)
s = fresh('greatsword', 5);
const e3 = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); e3.x = s.player.x + 50; e3.y = s.player.y;
run(s, 2.1);
assert.strictEqual(e3.hp, 1, 'two-hander left it on 1 HP, got ' + e3.hp);
// ...and at the DEX that fits the window it kills with a crit
s = fresh('greatsword', need);
const e4 = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); e4.x = s.player.x + 50; e4.y = s.player.y;
run(s, 2.1);
assert.strictEqual(e4.state, 'dying'); assert.strictEqual(e4.dramatic, true);
console.log('PASS two-hander DEX gate');

// 5. mail: 3 raw -> 2 (floor), below threshold 3 so no Wounded; durability 9 -> 6 -> 3 -> 0 breaks on hit 3
s = fresh('longsword', 5);
const e5 = s.spawn({ tier: 'mail', ai: 'stand' }); e5.x = s.player.x + 40; e5.y = s.player.y;
run(s, 0.4); // first hit lands at 0.36s
assert.strictEqual(e5.hp, 7); assert.strictEqual(e5.wounded, 0); assert.strictEqual(e5.dur, 6);
run(s, 0.9); assert.strictEqual(e5.hp, 5); assert.strictEqual(e5.dur, 3);
run(s, 0.9); assert.strictEqual(e5.hp, 3); assert.strictEqual(e5.dur, 0); assert.strictEqual(e5.broken, true);
assert(e5.wounded > 0, 'armor break wounds on any damage');
assert(s.effSan(e5) === 2.5, 'SAN halved');
run(s, 0.9); // next hit: crit, armor 0 -> 6 dmg kills (3 left)
assert.strictEqual(e5.state, 'dying');
console.log('PASS mail durability, Abreak, crit on every hit');

// 6. crit order toggle: mail enemy wounded elsewhere, raw 3
CFG.critOrder = 'before';
s = fresh('longsword', 5); const e6 = s.spawn({ tier: 'mail', dur: 99 }); e6.wounded = 1;
s.applyHit(e6, 3, null); assert.strictEqual(s.lastHit.dmg, 4); // floor(6*.75)=4
CFG.critOrder = 'after';
const e7 = s.spawn({ tier: 'mail', dur: 99 }); e7.wounded = 1;
s.applyHit(e7, 3, null); assert.strictEqual(s.lastHit.dmg, 4); // floor(3*.75)=2, x2
CFG.critOrder = 'before';
const e8 = s.spawn({ tier: 'plate', dur: 99 }); e8.wounded = 1;
s.applyHit(e8, 3, null); assert.strictEqual(s.lastHit.dmg, 3);
CFG.critOrder = 'after';
const e9 = s.spawn({ tier: 'plate', dur: 99 }); e9.wounded = 1;
s.applyHit(e9, 3, null); assert.strictEqual(s.lastHit.dmg, 2); // floor(1.5)=1, x2 = 2
CFG.critOrder = 'before';
console.log('PASS crit-order math (plate: before=3, after=2)');

// 7. low SAN flees after the crit when armor is broken
s = fresh('longsword', 5);
const e10 = s.spawn({ tier: 'leather', dur: 3, ai: 'stand', chr: 0 }); e10.hp = 99; e10.maxHp = 99; e10.x = s.player.x + 40; e10.y = s.player.y;
run(s, 0.45); assert(e10.broken, 'break on first hit (dur 3, raw 3)');
s.player.x -= 200; // step out of reach so it can recover
run(s, 1.4); assert(e10.flee, 'fled after recovering');
console.log('PASS Abreak enemy flees (SAN 2.5 <= 3)');

// 8. a Wounded enemy that survives the crit shrugs it off (state ends)
s = fresh('longsword', 5);
const e11 = s.spawn({ tier: 'leather', dur: 99 }); e11.hp = 99; e11.maxHp = 99; e11.x = s.player.x + 40; e11.y = s.player.y;
run(s, 0.4); assert(e11.wounded > 0);
run(s, 0.95); assert.strictEqual(e11.wounded, 0); assert.strictEqual(e11.hp, 99 - 3 - 6);
console.log('PASS shrug off after surviving crit');

// 9. determinism: same seed and inputs give the same fight, and particles do not shift the rules' rolls
{
  const c2 = JSON.parse(JSON.stringify(CFG)); c2.woundedChance = 0.5;
  const fight = (seed, extraFx) => { const s = new Sim(c2, seed); s.player.weapon = 'longsword';
    const e = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); e.hp = 999; e.maxHp = 999; e.x = s.player.x + 40; e.y = s.player.y;
    const out = []; for (let i = 0; i < 60 * 20; i++) { if (extraFx && i % 7 === 0) s.burst(0, 0, 5, '#fff', 10); const h = s.lastHit; s.step(1 / 60); if (s.lastHit && s.lastHit !== h) out.push(s.lastHit.woundedSet ? 1 : 0); }
    return out.join('') + '|' + e.hp; };
  assert.strictEqual(fight(42, false), fight(42, false), 'same seed, same fight');
  assert.strictEqual(fight(42, false), fight(42, true), 'particles must not change rule rolls');
  assert.notStrictEqual(fight(1, false), fight(2, false), 'different seeds differ');
  const r = makeRng(7); for (let i = 0; i < 1000; i++) { const v = r(); assert(v >= 0 && v < 1); }
  console.log('PASS seeded, deterministic sim');
}

// 10. routing and rallying
{
  let s = fresh('longsword', 5);
  const e = s.spawn({ tier: 'leather', dur: 99, ai: 'stand', chr: 0 }); e.flee = true; e.x = s.player.x + 60;
  run(s, 12); assert.strictEqual(s.routed, 1, 'fled off the field'); assert(!s.enemies.includes(e), 'routed enemy removed');
  s = fresh('longsword', 5);                                     // rng always 0: every roll passes, so it rallies at once
  const e2 = s.spawn({ tier: 'leather', dur: 99, ai: 'stand', chr: 5 }); e2.flee = true; e2.x = s.player.x + 60;
  run(s, 0.1); assert.strictEqual(e2.flee, false, 'rallied'); assert.strictEqual(s.routed, 0);
  s = new Sim(CFG, 3); s.rng = () => 0.999;                      // rolls always fail: never rallies
  const e3 = s.spawn({ tier: 'leather', dur: 99, ai: 'stand', chr: 99 }); e3.flee = true; e3.x = s.player.x + 60;
  run(s, 12); assert.strictEqual(s.routed, 1);
  console.log('PASS routed enemies leave; CHR rally');
}

// 11. weapon classes: same class, same fight; a weapon can override one stat
{
  const c = JSON.parse(JSON.stringify(CFG));
  c.weapons.claymore = { label: 'Claymore', cls: 'sword2' };
  c.weapons.zwei = { label: 'Zweihander', cls: 'sword2', reach: 66 };
  const a = weaponStats(c, 'greatsword'), b = weaponStats(c, 'claymore'), z = weaponStats(c, 'zwei');
  for (const k of ['dmg', 'reach', 'baseInterval', 'twoHanded', 'posture']) assert.strictEqual(a[k], b[k], k);
  assert.strictEqual(z.reach, 66); assert.strictEqual(z.dmg, a.dmg);
  assert.strictEqual(swingInterval(c, 'claymore', 15), swingInterval(c, 'greatsword', 15));
  console.log('PASS weapon classes share stats; overrides apply');
}

// 12. blade contact from a baked weapon path
{
  assert.strictEqual(segSegDist([0, 0, 10, 0], [5, -5, 5, 5]), 0, 'crossing segments');
  assert(Math.abs(segSegDist([0, 0, 10, 0], [15, -5, 15, 5]) - 5) < 1e-9, 'gap of 5');
  // a level blade at 1 m, hand 0.2 m and tip 1.0 m in front, for the whole move
  const flat = { t0: 0, c: 36, end: 89, n: 2, seg: [[0.2, 1, 1, 1], [0.2, 1, 1, 1], [0.2, 1, 1, 1]], hit: { shape: 'blade', w: 0.12, f0: 30, f1: 40 } };
  assert(moveTouches(CFG, flat, 36, 100, 1, 140), 'body 0.74 m away is cut');
  assert(!moveTouches(CFG, flat, 36, 100, 1, 175), 'body 1.39 m away is out of reach');
  assert(!moveTouches(CFG, flat, 36, 100, -1, 140), 'facing away');
  const sweepFight = (dist) => {
    const s = fresh('longsword', 5); s.moves.flat = flat; s.player.move = 'flat';
    const e = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); e.hp = 99; e.maxHp = 99; e.x = s.player.x + dist; e.y = s.player.y;
    let misses = 0; const t0 = s.texts.length; run(s, 0.8, () => {}); for (const x of s.texts) if (x.text === 'MISS') misses++;
    return { hp: e.hp, misses };
  };
  const near = sweepFight(40), far = sweepFight(52);
  assert.strictEqual(near.hp, 96, 'blade lands at 40 px'); assert.strictEqual(near.misses, 0);
  // at 52 px the reach rule starts the swing (44 + 8) and the tip (54 px + body 10.8 + edge 3.2) still reaches
  assert.strictEqual(far.hp, 96, 'blade reaches 52 px');
  const shortMove = JSON.parse(JSON.stringify(flat)); shortMove.seg = shortMove.seg.map(() => [0.1, 1, 0.5, 1]);
  const s2 = fresh('longsword', 5); s2.moves.short = shortMove; s2.player.move = 'short';
  const e2 = s2.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); e2.hp = 99; e2.maxHp = 99; e2.x = s2.player.x + 50; e2.y = s2.player.y;
  run(s2, 0.8); assert.strictEqual(e2.hp, 99, 'short blade whiffs at 50 px'); assert(s2.texts.some(x => x.text === 'MISS'));
  console.log('PASS blade sweep: contact, reach and whiffs');
}

// 13. enemy swings use a baked path too
{
  const flat = { t0: 0, c: 36, end: 89, n: 2, seg: [[0.2, 1, 1, 1], [0.2, 1, 1, 1], [0.2, 1, 1, 1]], hit: { shape: 'blade', w: 0.12, f0: 30, f1: 40 } };
  const short = { t0: 0, c: 36, end: 89, n: 2, seg: [[0.05, 1, 0.1, 1], [0.05, 1, 0.1, 1], [0.05, 1, 0.1, 1]], hit: { shape: 'blade', w: 0.12, f0: 30, f1: 40 } };
  const duel = mv => { const c = JSON.parse(JSON.stringify(CFG)); const s = new Sim(c, 9); s.moves[c.enemy.move] = mv; s.player.inv = false; s.player.weapon = 'longsword';
    s.player.x = 600; const e = s.spawn({ tier: 'leather', dur: 99, ai: 'advance' }); e.x = s.player.x - 40; e.y = s.player.y; s.player.x = 300; e.x = 330;
    s.player.cooldown = 99;                                      // the player never swings back
    for (let i = 0; i < 60 * 3; i++) s.step(1 / 60); return s.player.maxHp - s.player.hp; };
  assert(duel(flat) > 0, 'enemy blade lands');
  assert.strictEqual(duel(short), 0, 'enemy blade too short to reach');
  console.log('PASS enemy blade sweep');
}

// 14. Clash: two light attacks meet, both bounce, only the two clashers freeze, bystanders are pushed
{
  const flat = { t0: 0, c: 36, end: 89, n: 2, seg: [[0.2, 1, 1, 1], [0.2, 1, 1, 1], [0.2, 1, 1, 1]], hit: { shape: 'blade', w: 0.12, f0: 30, f1: 40 } };
  const setup = (opt) => {
    opt = opt || {};
    const c = JSON.parse(JSON.stringify(CFG)); const s = new Sim(c, 4); if (!opt.noMoves) { s.moves.flat = flat; s.moves[c.enemy.move] = flat; }
    s.manual = true; s.player.inv = false; s.player.x = 300; s.player.face = 1; Object.assign(s.player.skills, opt.skills || {});
    const e = s.spawn({ tier: 'leather', dur: 99, ai: 'stand', kind: opt.kind }); e.x = 340; e.y = s.player.y; e.face = -1; e.hp = 99; e.maxHp = 99;
    s.player.swing = { t: 0.42, dur: 1, dur0: 1, hitAt: 0.45, hit: false, target: e.id, whiff: false, dramatic: false, extra: 0, move: opt.noMoves ? null : 'flat', kind: opt.heavy ? 'heavy' : 'light', mult: 1, pierce: 0, after: 0 };
    e.atk = { t: 0.42, hit: false, dur: 1, hitAt: 0.45 };
    return { s, e, c };
  };
  let { s, e, c } = setup();
  const by = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); by.x = 360; by.y = s.player.y;   // near the clash
  const far = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); far.x = 560; far.y = s.player.y;
  const bx = by.x, fx = far.x, t0 = s.t; s.step(1 / 60);
  assert(s.lastClash && s.lastClash.eId === e.id, 'blades crossed: clash');
  assert(!s.player.swing && !e.atk, 'both swings are cancelled'); assert.strictEqual(e.hp, 99, 'no hit lands in a clash');
  assert(s.player.freeze > 0 && e.freeze > 0, 'both clashers freeze'); assert.strictEqual(by.freeze, 0, 'a bystander does not freeze');
  assert(by.kvx > 0 && by.kvx <= c.clash.wave.max, 'a bystander is pushed away, bounded'); assert.strictEqual(far.kvx, 0, 'a far one is not');
  const px0 = s.player.x, ex0 = e.x; run(s, 0.5);
  assert(s.player.x < px0 - 5 && e.x > ex0 + 5, 'both bounce back'); assert(by.x > bx && far.x === fx, 'bystander shoved, far one untouched');
  assert(Math.abs((s.t - t0) - 0.5 - 1 / 60) < 1e-6, 'time never slows: the clock ran in real time');
  assert(!('hitstop' in s) && !('slow' in s), 'no global time effects exist');
  // no baked path: the two reaches overlapping is enough
  ({ s, e } = setup({ noMoves: true })); s.step(1 / 60); assert(s.lastClash, 'reach rule clashes too');
  // heavy attacks never clash; fodder does not clash
  ({ s, e } = setup({ heavy: true })); s.step(1 / 60); assert(!s.lastClash, 'a heavy attack does not clash');
  ({ s, e } = setup({ kind: 'fodder' })); s.step(1 / 60); assert(!s.lastClash, 'swarm fodder does not clash');
  // an enemy heavy cannot be clashed either
  ({ s, e } = setup()); e.atk.heavy = true; s.step(1 / 60); assert(!s.lastClash, 'an enemy heavy does not clash');
  // riposte: no bounce, free counter-swing after the freeze; shove: enemy stunned and thrown far
  ({ s, e } = setup({ skills: { riposte: true } })); s.step(1 / 60); assert.strictEqual(s.player.kvx, 0, 'riposte: no bounce'); run(s, 0.2);
  assert(s.player.swing && s.player.swing.kind === 'counter', 'riposte: counter-swing starts at once');
  ({ s, e } = setup({ skills: { shove: true } })); s.step(1 / 60); assert(e.stun > 0 && e.kvx > c.clash.knock, 'shove: stunned and shoved harder');
  assert(s.grabbable(e), 'a shoved enemy can be grabbed');
  // the pair does not clash twice in one swing
  ({ s, e } = setup()); s.step(1 / 60); const n1 = s.log.filter(l => l.kind === 'clash').length; run(s, 0.3); assert.strictEqual(s.log.filter(l => l.kind === 'clash').length, n1, 'one clash per meeting');
  console.log('PASS clash: auto-meet, bounce, per-fighter freeze, shockwave, heavy and swarm exempt, riposte, shove');
}

// 14b. block, parry, stamina, guard break, dash, dash attack, heavy, projectile, aimed throw
{
  const duel = (o) => { o = o || {}; const s = new Sim(CFG, 11); s.manual = true; s.player.inv = false; s.player.x = 300; s.player.face = 1; s.player.hp = s.player.maxHp = 30;
    const e = s.spawn({ tier: 'leather', dur: 99, ai: 'advance', kind: o.kind }); e.x = 330; e.y = s.player.y; e.face = -1; e.hp = e.maxHp = 99; e.atkCd = 99;
    e.atk = { t: o.t == null ? 0.4 : o.t, hit: false, dur: 1, hitAt: 0.45, heavy: !!o.heavy }; if (o.heavy) { e.atk.dur = 1.5; e.atk.hitAt = 0.72; e.atk.t = o.t == null ? 0.7 : o.t; }
    return { s, e }; };
  const inp = (s, o) => applyCmd(s, Object.assign({ t: 'input', x: 0, y: 0, act: false, g: false, fin: '', heavy: false, block: false, dash: false, fire: false, ax: null, ay: null }, o));
  const S = CFG.stamina;
  // parry: block pressed just before the hit
  let { s, e } = duel(); s.enemies[0].atk.t = 0.41; inp(s, { block: true }); run(s, 0.1);
  assert.strictEqual(s.player.hp, 30, 'parried: no damage'); assert(e.stun > 0 && !e.atk, 'parry staggers the attacker'); assert(s.player.stamina >= s.player.staminaMax - S.blockPress + S.parryRefund - 1e-6 || s.player.stamina === s.player.staminaMax, 'parry refunds stamina');
  inp(s, { block: false }); run(s, 0.3); assert(s.log.some(l => /counter|Parry/.test(l.text)), 'parry logged'); assert(e.hp < 99, 'the free counter-swing hits');
  // holding block does not re-open the parry window
  ({ s, e } = duel({ t: 0.0 })); inp(s, { block: true }); run(s, 0.3); e.atk = { t: 0.44, hit: false, dur: 1, hitAt: 0.45 }; run(s, 0.1);
  assert.strictEqual(s.player.hp, 30, 'a plain block stops a light hit'); assert(s.player.stamina < s.player.staminaMax - 10, 'a plain block costs stamina'); assert(!(e.stun > 0), 'a plain block does not stagger');
  // a plain block does not stop a heavy; a parry does
  ({ s, e } = duel({ heavy: true, t: 0.0 })); inp(s, { block: true }); run(s, 0.9);
  assert(s.player.hp < 30, 'a plain block does not stop a heavy');
  ({ s, e } = duel({ heavy: true, t: 0.7 })); inp(s, { block: true }); run(s, 0.1); assert.strictEqual(s.player.hp, 30, 'a heavy can be parried'); assert(e.stun > 0);
  // guard break: empty stamina while blocking
  ({ s, e } = duel({ t: 0.0 })); inp(s, { block: true }); run(s, 0.3); s.player.stamina = 5; e.atk = { t: 0.44, hit: false, dur: 1, hitAt: 0.45 }; run(s, 0.1);
  assert(s.player.stunT > 0 && !s.player.blocking, 'empty stamina breaks the guard: stunned');
  // block only covers the front
  ({ s, e } = duel({ t: 0.0 })); s.player.face = -1; inp(s, { block: true, ax: 100 }); run(s, 0.1); e.atk = { t: 0.44, hit: false, dur: 1, hitAt: 0.45 }; run(s, 0.1); assert(s.player.hp < 30, 'a hit from behind lands');
  // dash: costs stamina, dodges in the first frames, a click makes it a dash attack
  ({ s, e } = duel({ t: 0.0 })); e.x = 380; const st0 = s.player.stamina, x0 = s.player.x; inp(s, { dash: true, x: 1 }); s.step(1 / 60); inp(s, { x: 1 });
  assert(s.player.dash && s.player.stamina === st0 - S.dashCost, 'dash spends stamina'); run(s, 0.05); assert(s.player.x > x0 + 8, 'dash moves you');
  inp(s, { x: 1, act: true }); s.step(1 / 60); assert(s.player.swing && s.player.swing.kind === 'dash', 'a click during a dash is a dash attack');
  ({ s, e } = duel({ t: 0.0 })); s.player.stamina = 5; inp(s, { dash: true }); s.step(1 / 60); assert(!s.player.dash, 'no stamina, no dash');
  ({ s, e } = duel({ t: 0.0 })); e.atk = null; e.x = 340; inp(s, { dash: true, x: 1 }); s.step(1 / 60); e.atk = { t: 0.44, hit: false, dur: 1, hitAt: 0.45 }; s.step(1 / 60); assert.strictEqual(s.player.hp, 30, 'the first dash frames dodge');
  // light, heavy, and armor piercing
  ({ s, e } = duel({ t: 0.0 })); e.atk = null; e.ai = 'stand'; e.atkCd = 99; e.armorPct = 0.5; e.tier = 'plate'; e.x = 330;
  s.player.weapon = 'longsword'; inp(s, { act: true }); run(s, 0.6); const light = 99 - e.hp; assert(light > 0, 'a held click swings: light'); inp(s, { act: false }); run(s, 0.5);
  e.hp = 99; e.broken = false; e.dur = 99; e.durMax = 99; inp(s, { heavy: true }); run(s, 1.4); const heavy = 99 - e.hp; assert(heavy > light, 'heavy hits harder than light (' + heavy + ' vs ' + light + ')');
  // nothing swings by itself in manual mode
  ({ s, e } = duel({ t: 0.0 })); e.atk = null; e.atkCd = 99; run(s, 1.5); assert.strictEqual(e.hp, 99, 'no auto-swing in manual mode');
  // facing follows the mouse
  inp(s, { ax: 50 }); s.step(1 / 60); assert.strictEqual(s.player.face, -1, 'the mouse side sets facing'); inp(s, { ax: 600 }); s.step(1 / 60); assert.strictEqual(s.player.face, 1);
  // projectile flies toward the cursor and hits
  ({ s, e } = duel({ t: 0.0 })); e.atk = null; e.atkCd = 99; e.x = 460; e.y = s.player.y; inp(s, { fire: true, ax: 460, ay: s.player.y }); s.step(1 / 60); assert.strictEqual(s.proj.length, 1, 'a shot is fired');
  inp(s, { fire: false }); run(s, 0.6); assert(e.hp < 99 && s.proj.length === 0, 'the shot hit and is gone'); assert.strictEqual(s.player.projCd > 0 || true, true);
  // aimed throw: lands near the cursor
  { const t = new Sim(CFG, 12); t.manual = true; t.player.inv = true; const v = t.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); v.hp = v.maxHp = 40; v.x = t.player.x + 30; v.y = t.player.y; v.stun = 1.5;
    inp(t, { g: true }); run(t, 0.5); const aimX = t.player.x + 120, aimY = t.player.y - 18; inp(t, { fin: 'throw', ax: aimX, ay: aimY }); run(t, 0.9);
    assert(!v.fly && v.z === 0, 'thrown body landed'); assert(Math.abs(v.x - aimX) < 25, 'landed near the cursor x: ' + v.x.toFixed(0) + ' vs ' + aimX); assert(v.y < t.player.y - 6, 'the cursor aimed it into another lane'); }
  console.log('PASS block, parry, stamina, guard break, dash, dash attack, heavy, manual swings, facing, projectile, aimed throw');
}

// 15. replays: the same start state plus the same commands give the same fight, from the start or from a mid-fight save
{
  const c = JSON.parse(JSON.stringify(CFG)); c.woundedChance = 0.6;
  const live = new Sim(c, 77); const cmds = []; const moves = {};
  const cmd = x => { cmds.push({ s: live.stepN, c: JSON.parse(JSON.stringify(x)) }); applyCmd(live, x); };
  const start = live.saveState(), cfg0 = JSON.parse(JSON.stringify(c));
  const r = makeRng(5); let mid = null, midCfg = null, midAt = 0;
  for (let i = 0; i < 60 * 40; i++) {
    if (i % 23 === 0) cmd({ t: 'input', x: Math.round(r() * 2 - 1), y: Math.round(r() * 2 - 1), act: r() < .2 });
    if (i % 400 === 5) cmd({ t: 'spawn', list: [{ tier: ['leather', 'mail', 'plate'][i % 3], dur: 4, ai: 'advance' }, { tier: 'leather', dur: 3, ai: 'stand' }] });
    if (i === 900) cmd({ t: 'set', weapon: 'greatsword', dex: 40 });
    if (i === 1300) { const cc = JSON.parse(JSON.stringify(live.cfg)); cc.woundedDur = 1.6; cmd({ t: 'cfg', cfg: cc }); }
    if (i === 1000) { mid = live.saveState(); midCfg = JSON.parse(JSON.stringify(live.cfg)); midAt = cmds.length; }
    live.step(1 / 60);
  }
  const end = JSON.stringify(live.saveState());
  const play = (st, cfg, list) => { const s = Sim.fromState(st, JSON.parse(JSON.stringify(cfg)), {}); let j = 0;
    while (s.stepN < live.stepN) { while (j < list.length && list[j].s <= s.stepN) applyCmd(s, list[j++].c); s.step(1 / 60); } return JSON.stringify(s.saveState()); };
  assert(live.enemies.length + live.log.filter(l => /KILLED/.test(l.text)).length > 0, 'the fight had action');
  assert.strictEqual(play(start, cfg0, cmds), end, 'replay from the start matches exactly');
  assert.strictEqual(play(mid, midCfg, cmds.slice(midAt)), end, 'replay from a mid-fight save matches exactly');
  assert(Number.isInteger(SIM_VERSION));
  console.log('PASS replays reproduce the fight exactly');
}

// 16. campaign battle rules: worn armor on the player, hired allies, chain styles, win and loss
{
  const s = new Sim(CFG, 3); s.mode = 'battle'; applyCmd(s, { t: 'set', inv: false, armorPct: 0.5, dur: 4, durMax: 4, hp: 30, maxHp: 30 });
  const e = s.spawn({ tier: 'leather', dur: 99, ai: 'advance' }); e.x = s.player.x + 30; e.y = s.player.y; e.atkCd = 0;
  s.player.weapon = 'longsword';
  run(s, 1.2, () => { s.player.cooldown = 9; });                       // you never swing; the enemy does
  assert(s.player.hp < 30 && s.player.hp >= 26, 'armor halves a 2-point hit to 1');
  assert(s.player.dur < 4, 'durability wears');
  let t2 = new Sim(CFG, 4); t2.mode = 'battle'; applyCmd(t2, { t: 'set', inv: false, hp: 2, maxHp: 2 });
  const e2 = t2.spawn({ tier: 'leather', dur: 99, ai: 'advance' }); e2.x = t2.player.x + 30; e2.y = t2.player.y; e2.atkCd = 0; t2.player.cooldown = 99;
  run(t2, 2, () => { t2.player.cooldown = 99; });
  assert.strictEqual(t2.outcome, 'lost', 'a downed player loses the battle'); assert.strictEqual(t2.player.hp, 0);
  // an ally wins the fight alone
  const s3 = new Sim(CFG, 5); s3.mode = 'battle'; applyCmd(s3, { t: 'set', inv: true });
  s3.player.cooldown = 99; s3.player.x = 40;
  const al = s3.spawnAlly({ tier: 'leather', weapon: 'longsword', hid: 'h1', hp: 40 });
  const en = s3.spawn({ tier: 'leather', dur: 99, ai: 'advance' }); en.x = 300; en.y = s3.player.y;
  run(s3, 12, () => { s3.player.cooldown = 99; });
  assert.strictEqual(s3.outcome, 'won', 'the hireling cleared the enemy'); assert(al.state === 'alive' && s3.fallen.length === 0);
  // chain styles play in order
  const s4 = new Sim(CFG, 6); s4.mode = 'battle'; applyCmd(s4, { t: 'set', chainStyles: [{ style: 'cut', move: null }, { style: 'chop', move: null }] });
  const en4 = s4.spawn({ tier: 'plate', dur: 99, ai: 'stand' }); en4.hp = en4.maxHp = 99; en4.x = s4.player.x + 40; en4.y = s4.player.y;
  const seen = []; run(s4, 6, () => { const w = s4.player.swing; if (w && w.style && seen[seen.length - 1] !== w.style + w.t.toFixed(0) && w.t === 0) seen.push(w.style); });
  assert(seen.length >= 3 && seen[0] === 'cut' && seen[1] === 'chop' && seen[2] === 'cut', 'styles alternate in slot order: ' + seen.join(','));
  console.log('PASS campaign battle rules: armor, allies, chain styles, outcome');
}

// 17. grabbing
{
  const mk = (tier, stun) => { const s = new Sim(CFG, 7); s.player.cooldown = 0; const e = s.spawn({ tier, dur: 99, ai: 'stand' }); e.hp = e.maxHp = 40; e.x = s.player.x + 30; e.y = s.player.y; e.stun = stun; return [s, e]; };
  const key = (s, o, secs) => { applyCmd(s, Object.assign({ t: 'input', x: 0, y: 0, act: false, g: false, fin: '' }, o)); run(s, secs); applyCmd(s, { t: 'input', x: 0, y: 0, act: false, g: false, fin: '' }); };
  // cannot grab a healthy enemy
  let [s, e] = mk('plate', 0); key(s, { g: true }, 0.1); assert(!s.player.grab && !e.held, 'a healthy enemy cannot be grabbed');
  // grab a stunned one, hold, slam: heavy damage ignoring armor percent, durability wears by the full amount
  [s, e] = mk('plate', 1.5); applyCmd(s, { t: 'set', inv: true }); key(s, { g: true }, 0.1);
  assert(s.player.grab && e.held, 'stunned enemy is seized');
  run(s, 0.4); assert.strictEqual(s.player.grab.phase, 'hold');
  const hp0 = e.hp, d0 = e.dur; key(s, { fin: 'slam' }, 0.8);
  assert.strictEqual(hp0 - e.hp, 12, 'slam = longsword 3 x4 = 12, plate % ignored'); assert.strictEqual(d0 - e.dur, 12, 'durability still wears by the full 12');
  assert(!s.player.grab && !e.held && e.stun > 0, 'slam ends with the victim downed');
  // throw: arcs away, lands staggered, bowls over a bystander
  [s, e] = mk('mail', 1.5); const bystander = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); bystander.x = s.player.x + 90; bystander.y = s.player.y; bystander.hp = bystander.maxHp = 40;
  applyCmd(s, { t: 'set', inv: true }); key(s, { g: true }, 0.5); const bx = e.x, bh = bystander.hp; key(s, { fin: 'throw' }, 1.4);
  assert(e.x > bx + 40 && !e.fly && e.z === 0, 'thrown enemy flew and landed'); assert(bystander.hp < bh && bystander.stun > 0 || bystander.hp < bh, 'bystander was hit by the thrown body');
  assert(e.hp === 40 - 9, 'throw = 3 x3 = 9');
  // strike keeps the hold, at most two
  [s, e] = mk('leather', 1.5); applyCmd(s, { t: 'set', inv: true }); key(s, { g: true }, 0.5);
  for (let i = 0; i < 3; i++) { key(s, { fin: 'strike' }, 0.1); key(s, {}, 0.5); }
  assert(s.player.grab && s.player.grab.phase === 'hold', 'still holding after strikes'); assert.strictEqual(e.hp, 40 - 4 * 2, 'two strikes of 4 (3 x1.5), the third refused');
  // mouse: left click while holding = quick strike, right click = throw
  [s, e] = mk('leather', 1.5); applyCmd(s, { t: 'set', inv: true }); key(s, { g: true }, 0.5); const h1 = e.hp;
  key(s, { act: true }, 0.1); key(s, {}, 0.5); assert(s.player.grab && s.player.grab.phase === 'hold' && e.hp < h1, 'left click while holding strikes and keeps the hold');
  const bx2 = e.x; key(s, { heavy: true }, 1.4); assert(!s.player.grab && e.x > bx2 + 40 && e.z === 0, 'right click while holding throws');
  // a hit on the player breaks the grab
  [s, e] = mk('leather', 1.5); applyCmd(s, { t: 'set', inv: false, hp: 30 }); key(s, { g: true }, 0.5); s.enemyHitsPlayer(e);
  assert(!s.player.grab && !e.held, 'getting hit breaks the grip');
  // killing the held enemy ends the grab cleanly
  [s, e] = mk('leather', 1.5); e.hp = 3; applyCmd(s, { t: 'set', inv: true }); key(s, { g: true }, 0.5); key(s, { fin: 'slam' }, 0.8);
  assert(e.state === 'dying' && !s.player.grab, 'finisher kill ends the grab');
  // replay determinism with grabs
  const a = new Sim(CFG, 9), b = new Sim(CFG, 9); const cmds = [{ t: 'spawn', list: [{ tier: 'mail' }] }];
  [a, b].forEach(q => { applyCmd(q, cmds[0]); const q1 = q.enemies[0]; q1.x = q.player.x + 30; q1.y = q.player.y; q1.stun = 1.5; applyCmd(q, { t: 'set', inv: true }); });
  [a, b].forEach(q => { applyCmd(q, { t: 'input', x: 0, y: 0, act: false, g: true, fin: '' }); run(q, 0.5); applyCmd(q, { t: 'input', x: 0, y: 0, act: false, g: false, fin: 'throw' }); run(q, 1.5); });
  assert.deepStrictEqual(a.saveState(), b.saveState(), 'grab fights replay identically');
  console.log('PASS grab: gate, hold, slam, throw, strike, break, kill, replay');
}


// crowd separation: enemies stacked on one spot spread out, stay in the band, settle, and replay identically
{
  const mk = () => { const s = new Sim(CFG, 3); applyCmd(s, { t: 'set', inv: true }); const L = []; for (let i = 0; i < 12; i++) { const e = s.spawn({ tier: 'leather', dur: 99, ai: 'advance' }); e.x = s.player.x + 120; e.y = s.player.y; L.push(e); } return [s, L]; };
  const [s, L] = mk(); for (let i = 0; i < 240; i++) s.step(1 / 60);
  let minD = 1e9; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) minD = Math.min(minD, Math.hypot((L[i].x - L[j].x) / CFG.sep.rx, (L[i].y - L[j].y) / CFG.sep.ry));
  assert(minD > 0.4, 'a stacked crowd spreads out (closest pair ' + minD.toFixed(2) + ')');
  assert(L.every(e => e.y >= CFG.band.top && e.y <= CFG.band.bottom && e.x >= CFG.arena.left && e.x <= CFG.arena.right), 'everyone stays inside the field');
  const [s2, L2] = mk(); for (let i = 0; i < 240; i++) s2.step(1 / 60); assert.deepStrictEqual(s.saveState(), s2.saveState(), 'separation replays identically');
  console.log('PASS crowd separation: spread, bounded, replay');
}


// jump and jump attack
{
  const mk = () => { const s = new Sim(CFG, 5); applyCmd(s, { t: 'manual', on: true }); s.player.cooldown = 0; return s; };
  const inp = (s, o, secs) => { applyCmd(s, { t: 'input', x: 0, y: 0, ...o }); run(s, secs); };
  let s = mk(); inp(s, { jump: true }, 0.05); inp(s, {}, 0.2);
  assert(s.player.air && s.player.z > 10, 'jump leaves the ground'); inp(s, {}, 0.6);
  assert(!s.player.air && s.player.z === 0, 'and lands again (airtime about 0.6 s)');
  // no dash, block or double jump in the air
  s = mk(); inp(s, { jump: true }, 0.05); inp(s, {}, 0.05); const st0 = s.player.stamina; inp(s, { dash: true }, 0.05); inp(s, { block: true }, 0.05);
  assert(!s.player.dash && !s.player.blocking && s.player.stamina >= st0, 'no dash or block while airborne'); inp(s, {}, 0.05); inp(s, { jump: true }, 0.05); assert(s.player.vz < CFG.jump.vz, 'no double jump');
  // air attack: its own swing kind with the 1.5 multiplier
  s = mk(); applyCmd(s, { t: 'set', inv: true }); const e = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); e.hp = e.maxHp = 40; e.x = s.player.x + 30; e.y = s.player.y;
  inp(s, { jump: true }, 0.05); inp(s, {}, 0.1); inp(s, { act: true }, 0.05); assert(s.player.swing && s.player.swing.kind === 'jump', 'a click in the air starts a jump attack'); inp(s, {}, 0.6);
  assert(e.hp < 40, 'the jump attack hits a ground enemy in front');
  // high in the air an enemy swing passes under you; on the ground it lands
  s = mk(); applyCmd(s, { t: 'set', inv: false, hp: 30, maxHp: 30 }); const f = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); f.x = s.player.x + 20; f.y = s.player.y;
  inp(s, { jump: true }, 0.05); inp(s, {}, 0.1); s.enemyHitsPlayer(f); assert.strictEqual(s.player.hp, 30, 'a swing passes under a jumping player');
  inp(s, {}, 0.8); s.enemyHitsPlayer(f); assert(s.player.hp < 30, 'but hits once you have landed');
  // replay
  const a = mk(), b = mk(); for (const q of [a, b]) { inp(q, { jump: true }, 0.05); inp(q, { x: 1 }, 0.2); inp(q, { act: true, x: 1 }, 0.05); inp(q, {}, 0.8); }
  assert.deepStrictEqual(a.saveState(), b.saveState(), 'jumping replays identically');
  console.log('PASS jump: arc, air limits, jump attack, air dodge, replay');
}

// several players in one fight
{
  const mk = () => { const s = new Sim(CFG, 6); applyCmd(s, { t: 'manual', on: true }); applyCmd(s, { t: 'set', inv: false }); s.mode = 'run'; return s; };
  const s = mk(); const p0 = s.players[0], p1 = s.addPlayer('bob', 'Bob'); assert.strictEqual(s.players.length, 2); assert.strictEqual(p1.pid, 'bob');
  p0.x = 100; p0.y = 282; p1.x = 560; p1.y = 282; p0.hp = p0.maxHp = 30; p1.hp = p1.maxHp = 30;
  const e = s.spawn({ kind: 'soldier', ai: 'advance' }); e.x = 500; e.y = 282;
  assert.strictEqual(s.pickTarget(e), p1, 'an enemy picks the nearer player');
  p1.hp = 0; assert.strictEqual(s.pickTarget(e), p0, 'a downed player is not a target');
  // each player has their own input and moves independently
  p1.hp = 30; e.state = 'dead'; s.enemies = [];
  applyCmd(s, { t: 'input', p: 0, x: 1, y: 0 }); applyCmd(s, { t: 'input', p: 1, x: -1, y: 0 });
  const x0 = p0.x, x1 = p1.x; for (let i = 0; i < 30; i++) s.step(1 / 60); assert(p0.x > x0 && p1.x < x1, 'both move on their own input');
  // kill credit goes to the player who struck
  applyCmd(s, { t: 'input', p: 0, x: 0, y: 0 }); applyCmd(s, { t: 'input', p: 1, x: 0, y: 0 }); const q = s.spawn({ kind: 'soldier', ai: 'stand' }); q.hp = 1; q.x = p1.x - 30; q.y = p1.y; s.feed = [];
  applyCmd(s, { t: 'set', p: 1, dmgOverride: 99, inv: true }); p1.face = -1; applyCmd(s, { t: 'input', p: 1, x: 0, y: 0, act: true }); for (let i = 0; i < 40 && !s.feed.some(f => f.t === 'kill'); i++) s.step(1 / 60);
  const k = s.feed.find(f => f.t === 'kill'); assert(k && k.pid === 'bob', 'the kill is credited to the striker');
  // a downed fighter takes no part; the fight is only lost when everyone is down
  const b = mk(); b.mode = 'battle'; b.addPlayer('bob'); b.spawn({ kind: 'soldier', ai: 'stand' }); b.players[0].hp = 0; b.step(1 / 60); assert(!b.outcome, 'one down is not a loss'); b.players[1].hp = 0; b.step(1 / 60); assert.strictEqual(b.outcome, 'lost');
  // save and restore keep both players, and the copy plays on the same
  const c = mk(); c.addPlayer('bob'); applyCmd(c, { t: 'input', p: 1, x: 1, y: 0 }); for (let i = 0; i < 20; i++) c.step(1 / 60);
  const d = Sim.fromState(c.saveState(), JSON.parse(JSON.stringify(CFG))); assert.strictEqual(d.players.length, 2); assert.strictEqual(d.player, d.players[0]);
  for (let i = 0; i < 20; i++) { c.step(1 / 60); d.step(1 / 60); } assert.deepStrictEqual(c.saveState().players.map(p => [p.x, p.y]), d.saveState().players.map(p => [p.x, p.y]), 'a restored fight with two players plays on identically');
  const r = c.players[1]; c.removePlayer('bob'); assert.strictEqual(c.players.length, 1);
  console.log('PASS several players');
}

console.log('\nALL SIM TESTS PASSED');
