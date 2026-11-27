import { CFG, Sim } from './sim.js';
import { Run, newProfile, buildOf, RUNCFG } from './run.js';
import { PartyHost, GuestRun, applySnap } from './party.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const mk = () => { const s = new Sim(CFG, 3); const p = newProfile('Host'); const r = new Run(s, p, 5, 'h0'); return { s, p, r }; };
const H = mk();
const q = [];                                   // fake relay: messages to guests
const host = new PartyHost({ sim: H.s, run: H.r, send: (id, m) => q.push([id, m]), selfId: 'p1' });
ok(H.r.me.pid === 'p1' && H.s.players[0].pid === 'p1', 'host pid renamed');
const gp = newProfile('Guest'); host.onJoin('p2'); host.onMsg('p2', { t: 'join', build: buildOf(gp) });
ok(H.r.members.length === 2 && H.s.players.length === 2, 'guest added');
// both must be at the cart
H.s.players[0].x = RUNCFG.cart.x; host.onMsg('p2', { t: 'ready', map: 'fields' }); H.r.readyUp('p1', 'fields');
ok(H.r.phase === 'camp', 'guest not at cart: still camp');
H.s.players[1].x = RUNCFG.cart.x; host.onMsg('p2', { t: 'ready', map: 'fields' }); H.r.update(0.05);
ok(H.r.phase === 'wave', 'both ready -> wave, got ' + H.r.phase);
host.onMsg('p2', { t: 'in', i: { x: 1, y: 0 } });
for (let i = 0; i < 200; i++) { H.s.step(1 / 60); H.r.update(1 / 60); host.afterStep(); }
const snaps = q.filter(x => x[0] === null && x[1].t === 'snap'); ok(snaps.length > 10, 'snaps sent ' + snaps.length);
ok(H.s.players[1].x > 230, 'guest input moved player');
// guest mirror
const G = new Sim(CFG, 1); const gr = new GuestRun(G, gp, () => { }); const last = JSON.parse(JSON.stringify(snaps[snaps.length - 1][1]));
applySnap(G, last, 'p2'); gr.onSnap(last, 'p2');
ok(G.players.length === 2 && G.player.pid === 'p2', 'mirror players'); ok(gr.phase === 'wave' && gr.members.length === 2, 'mirror run');
ok(G.enemies.length === H.s.enemies.length, 'mirror enemies');
// hostile build is clamped
host.onMsg('p2', { t: 'build', build: { name: 'x'.repeat(99), level: 9999, d: { maxHp: 1e9, dmgMult: 1e9 } } });
ok(H.r.byPid('p2').build.name.length <= 16 && H.r.byPid('p2').build.d.maxHp <= 400, 'build clamped');
host.onLeave('p2'); ok(H.r.members.length === 1, 'leave removes');
// a host can't hand a guest an impossible reward
{ const { applyRemoteResult, newProfile: np } = await import('./run.js'); const g = np('G'), g0 = g.gold; applyRemoteResult(g, { kind: 'left', wave: 5, gold: 1e9, xp: 1e9, uses: { str: 1e9 } }); ok(g.gold - g0 <= 360 && g.level < 30, 'remote reward clamped'); }
// a hostile snapshot can't set prototypes or unknown fields
{ const S = new Sim(CFG, 1); applySnap(S, JSON.parse('{"t":"snap","time":1,"players":[{"pid":"p9","x":5,"__proto__":{"evil":1},"zzz":2}],"enemies":[],"allies":[],"proj":[],"texts":[]}'), 'p9'); ok(S.player.evil === undefined && S.player.zzz === undefined && S.player.x === 5, 'snapshot keys filtered'); }
if (fails) process.exit(1); console.log('PASS party net');
