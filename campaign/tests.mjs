import assert from 'node:assert';
import * as D from './data.js';

// a new character: tier-1 gear equipped, 40 gold, one style, a connected map
const g = D.newGame({ seed: 42, name: 'Test', head: 'hood', torso: 'jerkin', weapon: 'longsword', company: 'The Rooks', liv: 'azure' });
assert.strictEqual(g.gold, 40); assert.strictEqual(g.styles.slotCount, 1); assert.deepStrictEqual(g.styles.owned, ['cut']);
assert.strictEqual(D.itemDef(D.itemById(g, g.equipped.head)).look, 'hood'); assert(g.equipped.shield, '1H starts with a buckler');
let d = D.derived(g); assert.strictEqual(d.hands, 1); assert.strictEqual(d.pct, 0); assert.strictEqual(d.durMax, 2 + 4 + 2);
const g2 = D.newGame({ seed: 42, weapon: 'greatsword' }); assert.strictEqual(g2.equipped.shield, null, '2H starts with no shield'); assert.strictEqual(D.derived(g2).hands, 2);
// map: same seed same map, all reachable, start is a town
const m = D.genMap(7), m2 = D.genMap(7); assert.deepStrictEqual(m, m2); assert.strictEqual(m.nodes[m.start].type, 'town');
assert(m.nodes.every(n => n.dist < 99), 'every place is reachable'); assert(m.nodes.filter(n => n.type === 'town').length >= 3);
assert(m.nodes.filter(n => n.type === 'camp').every(n => n.danger >= 1 && n.danger <= 5));
// equip rules
const gs = D.buy(Object.assign(g, { gold: 500 }), 'w_greatsword'); assert(gs.ok);
assert(D.equip(g, 'weapon', gs.it.iid).ok); assert.strictEqual(g.equipped.shield, null, 'a two-hander takes the shield off');
const sh = D.buy(g, 's_heater'); assert(!D.equip(g, 'shield', sh.it.iid).ok, 'no shield with two hands');
const sw = D.buy(g, 'w_axe'); assert(D.equip(g, 'weapon', sw.it.iid).ok); assert(D.equip(g, 'shield', sh.it.iid).ok);
// armor numbers: full mail 25% / 9, full plate 50% / 12
const gm = D.newGame({ seed: 1 }); gm.gold = 999;
D.equip(gm, 'head', D.buy(gm, 'h_helm').it.iid); D.equip(gm, 'torso', D.buy(gm, 't_mail').it.iid);
d = D.derived(gm); assert.strictEqual(Math.round(d.pct * 100), 25); assert.strictEqual(d.dur, 9 + 2);   // + the starting buckler's 2
D.equip(gm, 'head', D.buy(gm, 'h_bascinet').it.iid); D.equip(gm, 'torso', D.buy(gm, 't_plate').it.iid); assert.strictEqual(Math.round(D.derived(gm).pct * 100), 50);
// sell, repair
const gold0 = gm.gold, cap = gm.items.find(i => i.key === 'h_cap'); assert(D.sell(gm, cap.iid).ok && gm.gold > gold0, 'sold');
assert(!D.sell(gm, gm.equipped.head).ok, 'cannot sell what you wear');
const tor = D.itemById(gm, gm.equipped.torso); tor.dur = 2; const c = D.repairCost(tor); assert.strictEqual(c, 6 * 4); assert(D.repair(gm, tor.iid).ok && tor.dur === 8);
// styles
assert(!D.setSlot(g, 1, 'chop').ok, 'slot 2 is locked at the start');
// battles: deterministic, harder when danger is higher
const b1 = D.genBattle(5, 1, 'x'), b1b = D.genBattle(5, 1, 'x'); assert.deepStrictEqual(b1, b1b); assert(b1.enemies.every(e => e.tier === 'leather'));
const b5 = D.genBattle(5, 5); assert(b5.enemies.every(e => e.tier !== 'leather') && b5.pay > b1.pay);
// tutorial win teaches the second style and opens the second slot; losing the real fights costs gold and sends you home
const t = D.tutorialBattle(), r = D.finishBattle(g, t, { outcome: 'won', dur: 3, kills: ['leather', 'leather'] });
assert(r.won && g.flags.tutorialDone && g.styles.owned.includes('chop') && g.styles.slotCount === 2 && g.styles.slots[1] === 'chop' && r.pay === 10);
assert(D.setSlot(g, 1, 'chop').ok);
const g3 = D.newGame({ seed: 9 }); g3.gold = 100; g3.hirelings.push({ hid: 'h9', name: 'X', tier: 1, weapon: 'axe', hp: 18 });
const lost = D.finishBattle(g3, D.genBattle(3, 2), { outcome: 'lost', dur: 0, fallen: ['h9'], kills: [] });
assert(!lost.won && g3.gold === 75 && g3.hirelings.length === 0 && g3.at === g3.map.start && lost.dead[0] === 'X');
// hiring, roster cap, travel, save round trip
const g4 = D.newGame({ seed: 11 }); g4.gold = 999; const rec = D.recruits(g4, g4.map.start);
for (let i = 0; i < 3; i++) assert(D.hire(g4, rec[i], null).ok); assert(!D.hire(g4, D.recruits(g4, g4.map.start)[0], null).ok);
const nb = D.neighbors(g4.map, g4.at)[0], tr = D.travel(g4, nb); assert(tr.ok && g4.day === 2 && g4.at === nb);
assert(!D.travel(g4, 99).ok);
assert.deepStrictEqual(D.deserialize(D.serialize(g4)), JSON.parse(JSON.stringify(g4)));
assert(D.shopStock(g4, g4.map.start).length > 6);
console.log('ALL CAMPAIGN DATA TESTS PASSED');
