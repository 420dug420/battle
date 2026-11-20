const assert = require('assert');
const { CFG, Sim, swingInterval, minDexForWindow, fitsWindow } = require('./sim.js');

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
const e10 = s.spawn({ tier: 'leather', dur: 3, ai: 'stand' }); e10.hp = 99; e10.maxHp = 99; e10.x = s.player.x + 40; e10.y = s.player.y;
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
  const { makeRng } = require('./sim.js');
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

console.log('\nALL SIM TESTS PASSED');
