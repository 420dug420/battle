import assert from 'node:assert';
import { CFG, Sim, makeRng, weaponStats, swingInterval, minDexForWindow, fitsWindow, segSegDist, moveTouches } from './sim.js';

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

// 14. Clash: blades crossing mid-swing freeze both fighters; a timed press decides it
{
  const flat = { t0: 0, c: 36, end: 89, n: 2, seg: [[0.2, 1, 1, 1], [0.2, 1, 1, 1], [0.2, 1, 1, 1]], hit: { shape: 'blade', w: 0.12, f0: 30, f1: 40 } };
  const setup = () => {
    const c = JSON.parse(JSON.stringify(CFG)); const s = new Sim(c, 4); s.moves.flat = flat; s.moves[c.enemy.move] = flat;
    s.player.inv = false; s.player.x = 300; s.player.face = 1;
    const e = s.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); e.x = 360; e.y = s.player.y; e.face = -1; e.hp = 99; e.maxHp = 99;
    s.player.swing = { t: 0.42, dur: 1, dur0: 1, hitAt: 0.45, hit: false, target: e.id, whiff: false, dramatic: false, extra: 0, move: 'flat' };
    e.atk = { t: 0.42, hit: false };
    s.step(1 / 60); return { s, e, c };
  };
  let { s, e, c } = setup();
  assert(s.clash && s.clash.eId === e.id, 'blades crossed: clash');
  const pt = s.player.swing.t, et = e.atk.t; s.step(1 / 60); s.step(1 / 60);
  assert.strictEqual(s.player.swing.t, pt, 'player frozen'); assert.strictEqual(e.atk.t, et, 'enemy frozen'); assert.strictEqual(e.hp, 99, 'no hit lands during a clash');
  while (s.clash.t < c.clash.target - 1 / 120) s.step(1 / 60);
  s.input.act = true; s.step(1 / 60);
  assert(!s.clash && s.lastClash.result === 'win' && e.stun > 0 && !e.atk, 'timed press wins: enemy staggered');
  ({ s, e, c } = setup()); const x0 = s.player.x;
  for (let i = 0; i < 70; i++) s.step(1 / 60);
  assert(s.lastClash.result === 'lose' && s.player.x === x0 - c.clash.knock, 'no press: knocked back');
  ({ s, e, c } = setup()); s.step(1 / 60); s.input.act = true; s.step(1 / 60);
  assert.strictEqual(s.lastClash.result, 'lose', 'pressing far too early loses');
  { const c2 = JSON.parse(JSON.stringify(CFG)); const s2 = new Sim(c2, 4); s2.moves.flat = flat; s2.moves[c2.enemy.move] = flat; s2.player.x = 300; s2.player.face = 1;
    const e2 = s2.spawn({ tier: 'leather', dur: 99, ai: 'stand' }); e2.x = 360; e2.y = s2.player.y; e2.face = -1;
    s2.input.act = true; s2.step(1 / 60);                          // key already held before the clash
    s2.player.swing = { t: 0.42, dur: 1, dur0: 1, hitAt: 0.45, hit: false, target: e2.id, extra: 0, move: 'flat' }; e2.atk = { t: 0.42, hit: false };
    for (let i = 0; i < 70; i++) s2.step(1 / 60);
    assert.strictEqual(s2.lastClash.result, 'lose', 'holding the key from before is not a press'); }
  console.log('PASS clash: crossing blades, freeze, timed press');
}

console.log('\nALL SIM TESTS PASSED');
