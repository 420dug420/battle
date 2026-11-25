// Run layer tests: profile, attributes, leveling, shop, hire board, waves, the run loop, multi-clash.
import assert from 'node:assert';
import { CFG, Sim, applyCmd } from './sim.js';
import * as R from './run.js';
const run = (s, secs) => { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) s.step(1 / 60); };
const mkRun = (seed = 4) => { const sim = new Sim(CFG, seed), p = R.newProfile('Test'), r = new R.Run(sim, p, seed); return { sim, p, r }; };
const tick = (r, dt = 1 / 60) => { r.sim.step(dt); r.update(dt); };
const killAll = r => { for (const e of r.sim.enemies) if (e.state === 'alive') r.sim.applyHit(e, 999, { kind: 'light', mult: 1, pierce: 0 }); };

// 1. leveling
{
  const p = R.newProfile(); assert.strictEqual(p.level, 1);
  const up = R.addXp(p, R.xpNeed(1) + 1); assert.strictEqual(up, 1); assert.strictEqual(p.level, 2); assert.strictEqual(p.points, R.RUNCFG.pointsPerLevel, 'a level gives attribute points');
  assert(R.xpNeed(5) > R.xpNeed(2), 'later levels cost more');
  assert(R.spendPoint(p, 'str') && p.attrs.str === 6 && p.points === 2); p.points = 0; assert(!R.spendPoint(p, 'str'), 'no points, no spend');
  console.log('PASS leveling: xp, points, spend');
}
// 2. attributes change what the fighter can do
{
  const p = R.newProfile(), base = R.derive(p); assert.strictEqual(base.maxHp, CFG.player.hp); assert.strictEqual(base.dmgMult, 1); assert.strictEqual(base.hireCap, 1);
  for (const a of ['str', 'agi', 'con', 'ldr', 'chr']) p.attrs[a] = 11;
  const d = R.derive(p); assert(d.dmgMult > 1.3 && d.spdMult > 1.1 && d.regenMult > 1.2, 'STR and AGI raise damage, speed and regen'); assert(d.maxHp > base.maxHp && d.staminaMax > base.staminaMax, 'CON raises HP and stamina');
  assert.strictEqual(d.hireCap, 3, 'LDR 11 opens three hireling slots'); assert(d.hireStrength > 1 && d.hireDiscount > 0.1, 'LDR strengthens, CHR discounts');
  p.attrs.dex = 15; assert.strictEqual(R.derive(p).dex, 15);
  // it reaches the sim: a STR build hits harder, a DEX build swings faster, a CON build has more HP
  const { sim, p: q, r } = mkRun(); const w0 = sim.weaponInfo(); q.attrs.str = 15; q.attrs.dex = 12; q.attrs.con = 10; r.enterCamp(); const w1 = sim.weaponInfo();
  assert(w1.dmg > w0.dmg, 'STR shows in weapon damage'); assert(w1.interval < w0.interval, 'DEX shows in swing time'); assert.strictEqual(sim.player.maxHp, 30 + 4 * 5, 'CON shows in max HP');
  // use-growth
  const g = R.newProfile(); let grew = false; for (let i = 0; i < 60; i++) grew = R.trainFromUse(g, 'heavy') || grew; assert(grew && g.grown.str === 1, 'sixty heavy hits grow STR by one'); assert.strictEqual(R.attr(g, 'str'), 6);
  for (let i = 0; i < 1000; i++) R.trainFromUse(g, 'heavy'); assert.strictEqual(g.grown.str, R.RUNCFG.use.cap, 'use-growth is capped');
  console.log('PASS attributes: derived stats, reach the sim, use-growth');
}
// 3. shop, skills, hire board
{
  const p = R.newProfile(); p.gold = 100;
  assert(!R.buy(p, 'weapon', 'greatsword').ok && p.gold === 100, 'cannot afford'); p.gold = 500;
  assert(R.buy(p, 'weapon', 'greatsword').ok && p.gold === 380 && R.equipWeapon(p, 'greatsword') && p.weapon === 'greatsword'); assert(!R.buy(p, 'weapon', 'greatsword').ok, 'no double buys');
  assert(!R.equipWeapon(p, 'spear'), 'cannot equip what you do not own');
  assert(R.buy(p, 'skill', 'riposte').ok && R.buy(p, 'skill', 'shove').ok);
  assert(R.toggleSkill(p, 'riposte').ok && !R.toggleSkill(p, 'shove').ok, 'one skill slot to start');
  p.gold = 999; assert(R.buy(p, 'upgrade', 'slots').ok && R.toggleSkill(p, 'shove').ok && p.skills.length === 2, 'a slot upgrade opens another');
  const p0 = p.gold; R.buy(p, 'upgrade', 'hp'); const c1 = p0 - p.gold; const p1 = p.gold; R.buy(p, 'upgrade', 'hp'); assert(p1 - p.gold > c1, 'upgrades cost more each rank');
  // hire board
  const h = R.newProfile(); h.gold = 1000; const rec = R.recruits(h, 9); assert.strictEqual(rec.length, 4); assert.deepStrictEqual(rec, R.recruits(h, 9), 'the board is stable'); 
  assert(R.hire(h, rec[0]).ok && h.hirelings.length === 1); assert(!R.hire(h, rec[1]).ok, 'LDR 5 allows one hireling'); h.attrs.ldr = 11; assert(R.hire(h, rec[1]).ok && R.hire(h, rec[2]).ok && !R.hire(h, rec[3]).ok, 'cap is three');
  h.attrs.chr = 15; assert(R.recruits(h, 9)[0].fee < rec[0].fee, 'CHR makes hirelings cheaper'); R.dismiss(h, 1); assert.strictEqual(h.hirelings.length, 2);
  assert(R.fromJSON(R.toJSON(h)).hirelings.length === 2, 'the profile saves and loads');
  console.log('PASS shop, skills, hire board');
}
// 4. waves
{
  const a = R.wavePlan(1), b = R.wavePlan(6); assert(b.length > a.length, 'bigger waves'); assert(a.every(k => k === 'fodder' || k === 'soldier'), 'wave 1 is swarm fodder');
  assert(R.wavePlan(3).includes('tank') && !R.wavePlan(2).includes('tank'), 'tanks from wave 3'); assert(!R.wavePlan(4).includes('elite') && R.wavePlan(5).includes('elite'), 'elites from wave 5');
  assert.strictEqual(R.wavePlan(10).filter(k => k === 'elite').length, 2); assert.strictEqual(R.wavePlan(5)[R.wavePlan(5).length - 1], 'elite', 'elites arrive last');
  console.log('PASS waves: growth and mix');
}
// 5. a run: waves, rewards, the exit vote, camp again
{
  const { sim, p, r } = mkRun(); p.hirelings.push({ hid: 1, name: 'Bram', tier: 'leather', weapon: 'longsword', hp: 18, level: 1, xp: 0 }); p.nextHid = 2;
  assert.strictEqual(r.phase, 'camp'); assert(sim.enemies.some(e => e.dummy), 'a practice dummy stands in camp');
  assert(r.depart(), 'depart'); assert.strictEqual(r.phase, 'wave'); assert.strictEqual(sim.allies.length, 1, 'the hireling comes along'); assert.strictEqual(p.runs, 1);
  applyCmd(sim, { t: 'set', inv: true });
  let guard = 0; while (r.phase !== 'vote' && guard++ < 60 * 400) { killAll(r); tick(r); }
  assert.strictEqual(r.phase, 'vote', 'a vote opens after wave 5'); assert.strictEqual(r.wave, 5);
  assert(r.gold > 0 && p.xp + (p.level - 1) > 0 && p.level > 1, 'kills paid gold and xp, and the character levelled'); assert(p.hirelings[0].xp > 0 || p.hirelings[0].level > 1, 'the hireling earned xp');
  const g0 = p.gold, pay = r.leavePay(); assert(pay >= r.gold); assert(r.vote(true)); assert.strictEqual(p.gold, g0 + pay, 'leaving banks the gold'); assert.strictEqual(r.phase, 'left'); assert.strictEqual(p.best, 5);
  r.returnToCamp(); assert.strictEqual(r.phase, 'camp'); assert.strictEqual(sim.allies.length, 0);
  // the second trip: press on past the vote
  r.depart(); applyCmd(sim, { t: 'set', inv: true }); guard = 0; while (r.phase !== 'vote' && guard++ < 60 * 400) { killAll(r); tick(r); } assert(r.vote(false)); assert.strictEqual(r.phase, 'between'); guard = 0; while (r.wave < 6 && guard++ < 600) tick(r); assert.strictEqual(r.wave, 6, 'wave 6 follows');
  console.log('PASS run: waves, gold, xp, hirelings, exit vote, back to camp');
}
// 6. dying loses the run's gold and nothing else
{
  const { sim, p, r } = mkRun(); p.gold = 77; p.owned.weapons.push('axe'); r.depart(); r.gold = 50; const lvl = p.level;
  applyCmd(sim, { t: 'set', hp: 0 }); tick(r); assert.strictEqual(r.phase, 'dead'); assert.strictEqual(r.result.lost, 50, 'the run gold is reported lost'); assert.strictEqual(r.gold, 0);
  assert.strictEqual(p.gold, 77, 'banked gold is safe'); assert(p.owned.weapons.includes('axe'), 'gear is safe'); assert(p.level >= lvl);
  r.returnToCamp(); assert.strictEqual(r.phase, 'camp'); assert.strictEqual(sim.player.hp, sim.player.maxHp, 'back in camp, healed');
  // a real death: an enemy swing finishes you and the player stays down
  const m = mkRun(); m.r.depart(); applyCmd(m.sim, { t: 'set', hp: 1, inv: false }); const e = m.sim.spawn({ kind: 'soldier', ai: 'advance' }); e.x = m.sim.player.x + 20; e.y = m.sim.player.y; m.sim.enemyHitsPlayer(e);
  assert(m.sim.player.hp <= 0, 'the player is down and not restored in a run'); tick(m.r); assert.strictEqual(m.r.phase, 'dead');
  console.log('PASS death: run gold lost, the rest kept');
}
// 7. style rank rewards variety and breaks on a hit
{
  const { sim, p, r } = mkRun(); r.depart(); applyCmd(sim, { t: 'set', inv: true });
  const feed = f => { sim.feed.push(f); r.update(0.001); };
  for (const m of ['light', 'heavy', 'dash', 'jump', 'light', 'heavy', 'dash', 'jump', 'counter', 'light']) feed({ t: 'hit', move: m }); const t1 = r.tier; assert(t1 >= 2, 'varied moves raise the rank (' + r.rankName + ')');
  const before = r.rank.score; for (let i = 0; i < 4; i++) feed({ t: 'hit', move: 'light' }); assert(r.rank.score < before, 'repeating one move lowers it');
  feed({ t: 'hurt', dmg: 1 }); assert.strictEqual(r.tier, 0, 'a hit on you breaks it'); 
  const g0 = r.gold; for (const m of ['light', 'heavy', 'dash', 'jump', 'light', 'heavy', 'dash', 'jump']) feed({ t: 'hit', move: m }); feed({ t: 'kill', kind: 'fodder' }); assert(r.gold - g0 >= 1);
  assert(sim.player.dmgMult > R.derive(p).dmgMult, 'a high rank gives the small damage bonus');
  console.log('PASS style rank');
}
// 8. multi-clash
{
  const setup = multi => {
    const s = new Sim(CFG, 6); applyCmd(s, { t: 'manual', on: true }); applyCmd(s, { t: 'set', inv: true, skills: { multi } }); const w = s.weaponInfo(); const sw = s.startSwing('light', w);
    sw.t = sw.hitAt * 0.8; const es = [];
    for (let i = 0; i < 3; i++) { const e = s.spawn({ kind: 'soldier', ai: 'advance' }); e.x = s.player.x + 20 + i * 6; e.y = s.player.y; e.atk = { t: 0.4, hit: false }; es.push(e); }
    s.checkClash(); return { s, es };
  };
  let { es } = setup(false); assert.strictEqual(es.filter(e => e.clashT > 0).length, 1, 'by default one swing clashes with one');
  ({ es } = setup(true)); assert.strictEqual(es.filter(e => e.clashT > 0).length, 3, 'multi-clash takes all three'); assert(es.every(e => e.freeze > 0 && e.kvx > 0), 'each bounces and freezes');
  console.log('PASS multi-clash');
}
// 9. determinism
{
  const go = () => { const { sim, r } = mkRun(11); r.depart(); applyCmd(sim, { t: 'set', inv: true }); for (let i = 0; i < 900; i++) { if (i % 20 === 0) killAll(r); tick(r); } const o = sim.saveState(); delete o.events; return JSON.stringify([o, r.wave, r.gold, r.p.xp, r.queue.length]); };
  assert.strictEqual(go(), go(), 'the same seed gives the same run'); console.log('PASS run determinism');
}
console.log('ALL RUN TESTS PASSED');
