/* ============================================================
   PROJECT WAR · PARTY  (no DOM, no sockets: callers pass a send function)
   One browser is the host: it runs the sim and the run for everyone. Guests send their input and build, and draw the snapshots they get back.
   The relay (server/party-room.js) only passes messages. Peer ids are the players' ids in the sim.
   ============================================================ */
import { Run, buildOf, applyRemoteResult, RUNCFG } from './run.js';
import { applyCmd } from './sim.js';

const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const pickR = (o, keys, r) => { const out = {}; for (const k of keys) { const v = o[k]; out[k] = typeof v === 'number' ? (r ? r(v) : v) : v; } return out; };
const P_KEYS = ['pid', 'name', 'look', 'armorKey', 'roleStyles', 'weapon', 'x', 'y', 'z', 'face', 'hp', 'maxHp', 'stamina', 'staminaMax', 'moving', 'walkT', 'flash', 'hurt', 'blocking', 'blockT', 'stunT', 'clashT', 'clashMax', 'parryT', 'shotT', 'air', 'jumpT', 'chain', 'move', 'inv', 'dex'];
const SW_KEYS = ['t', 'dur', 'dur0', 'hitAt', 'extra', 'move', 'target', 'hit', 'kind', 'style', 'whiff', 'mult'];
const GR_KEYS = ['eId', 'phase', 't', 'dur', 'hit', 'strikes', 'holdT'];
const E_KEYS = ['id', 'x', 'y', 'z', 'face', 'state', 'hp', 'maxHp', 'dur', 'durMax', 'broken', 'wounded', 'flee', 'tier', 'kind', 'lookSeed', 'moving', 'walkT', 'flash', 'hurt', 'deathT', 'dramatic', 'stun', 'down', 'held', 'clashT', 'clashMax', 'dummy', 'chr', 'san'];
const A_KEYS = ['id', 'name', 'x', 'y', 'z', 'face', 'hp', 'maxHp', 'tier', 'weapon', 'state', 'deathT', 'moving', 'walkT', 'flash', 'hurt', 'broken', 'lookSeed', 'owner'];

/* ---------- snapshot: what the host sends, and how a guest's mirror sim takes it ---------- */
export function packSnap(sim, run, tick, texts) {
  return {
    t: 'snap', n: tick, time: r2(sim.t), shake: r2(sim.shake || 0), mode: sim.mode,
    players: sim.players.map(q => Object.assign(pickR(q, P_KEYS, r1), {
      swing: q.swing ? pickR(q.swing, SW_KEYS, r2) : null, grab: q.grab ? pickR(q.grab, GR_KEYS, r2) : null,
      dash: q.dash ? { t: r2(q.dash.t), dx: q.dash.dx, dy: q.dash.dy } : null, kindMoves: q.kindMoves && Object.keys(q.kindMoves).length ? q.kindMoves : undefined })),
    enemies: sim.enemies.map(e => Object.assign(pickR(e, E_KEYS, r1), { atk: e.atk ? pickR(e.atk, ['t', 'dur', 'hitAt', 'heavy', 'hit'], r2) : null, fly: e.fly ? { vx: r1(e.fly.vx || 0), vz: r1(e.fly.vz || 0), fr: !!e.fly.fr } : null })),
    allies: sim.allies.map(a => Object.assign(pickR(a, A_KEYS, r1), { atk: a.atk ? { t: r2(a.atk.t) } : null })),
    proj: sim.proj.map(q => ({ x: r1(q.x), y: r1(q.y), vx: r1(q.vx), vy: r1(q.vy) })),
    texts: texts || [],
    run: { phase: run.phase, wave: run.wave, left: run.queue.length + run.alive(), banner: run.banner, msgs: run.msgs.slice(-3), voteIn: run.phase === 'vote' ? Math.max(0, r1(run.voteAt - sim.t)) : 0, runN: run.runN || 0,
      members: run.members.map(m => ({ pid: m.pid, name: m.name, level: m.build.level, gold: m.gold, rank: r1(m.rank.score), tier: run.tierOf(m), ready: m.ready, vote: m.vote, down: m.down, acked: m.acked, atCart: run.atCart(m), pay: run.leavePayOf(m) })) },
  };
}
export function applySnap(sim, m, myPid) {
  sim.t = m.time; sim.shake = m.shake; sim.mode = m.mode;
  const old = new Map(sim.players.map(q => [q.pid, q]));
  sim.players = m.players.map(n => {
    const q = old.get(n.pid) || sim.mkPlayer(0, n.pid); Object.assign(q, n); if (!n.swing) q.swing = null; if (!n.grab) q.grab = null; if (!n.dash) q.dash = null; if (!n.kindMoves) q.kindMoves = {}; return q;
  });
  sim.players.forEach((q, i) => q.i = i);
  sim.player = sim.players.find(q => q.pid === myPid) || sim.players[0];
  const oe = new Map(sim.enemies.map(e => [e.id, e])); sim.enemies = m.enemies.map(n => Object.assign(oe.get(n.id) || {}, n));   // keep client-only fields (cached look)
  const oa = new Map(sim.allies.map(a => [a.id, a])); sim.allies = m.allies.map(n => Object.assign(oa.get(n.id) || {}, n));
  sim.proj = m.proj;
  for (const t of m.texts) sim.texts.push(Object.assign({ life: 0.9, max: 0.9, size: 10 }, t));
}

/* ---------- guest side: stands in for Run, so the camp and HUD code reads one thing ---------- */
export class GuestRun {
  constructor(sim, profile, send, hooks) {
    this.sim = sim; this.p = profile; this.send = send; this.hooks = hooks || {}; this.seed = 1; this.phase = 'camp'; this.wave = 0; this.members = []; this.banner = null; this.msgs = []; this.view = null;
    this.queue = { length: 0 }; this._alive = 0; this.appliedRun = 0; this.voteIn = 0; this.isGuest = true; this.me = { pid: null, gold: 0, rank: { score: 0 }, result: null, ready: false, vote: null, down: false, pay: 0 };
  }
  get gold() { return this.me.gold; } get rank() { return this.me.rank; } get result() { return this.me.result; } get kills() { return 0; } get levelUps() { return 0; }
  get tier() { return this.me.tier || 0; } get rankName() { return RUNCFG.rank.names[this.tier]; }
  alive() { return this._alive; }
  leavePay() { return this.me.pay || 0; }
  say() { }
  atCart(m) { return !!(m || this.me).atCart; }
  applyBuild() { this.send({ t: 'build', build: buildOf(this.p) }); }       // camp edits (gear, skills, styles) go to the host
  enterCamp() { }
  depart(map) { this.send({ t: 'ready', map: map || 'fields' }); return false; }
  unready() { this.send({ t: 'unready' }); }
  vote(leave) { this.send({ t: 'vote', leave: !!leave }); return true; }
  returnToCamp() { this.send({ t: 'ack' }); }
  update() { }
  onSnap(m, myPid) {
    this.me.pid = myPid; const r = m.run, was = this.phase;
    this.phase = r.phase; this.wave = r.wave; this.banner = r.banner; this.msgs = r.msgs; this.members = r.members; this.queue = { length: r.left }; this._alive = 0; this.voteIn = r.voteIn;
    const mine = r.members.find(x => x.pid === myPid); if (mine) { const res = this.me.result; Object.assign(this.me, mine); this.me.rank = { score: mine.rank }; this.me.result = res; }
    if (this.phase === 'camp' || this.phase === 'wave') this.me.result = null;
    if (this.hooks.phase && was !== this.phase) this.hooks.phase(this.phase, was);
  }
  onResult(res) {                                      // the host's verdict on this run, applied once to the guest's own profile
    if (!res || res.runN === this.appliedRun) return; this.appliedRun = res.runN; this.me.result = res;
    const out = applyRemoteResult(this.p, res); res.levels = out.levels; if (this.hooks.result) this.hooks.result(res);
  }
}

/* ---------- host side ---------- */
export class PartyHost {
  constructor({ sim, run, send, selfId }) {
    this.sim = sim; this.run = run; this.send = send; this.peers = new Map(); this.tick = 0; this.id = selfId; run.setPid(selfId); run.runN = run.runN || 0;
    sim.textOut = []; this.lastPhase = run.phase; this.resultsSent = 0; this.sentRun = 0;
  }
  onJoin(id) { this.peers.set(id, { id, last: 0 }); }                                   // the guest's build arrives next as a 'join' message
  onLeave(id) { this.peers.delete(id); this.run.removeMember(id); }
  onMsg(from, m) {
    const run = this.run, sim = this.sim;
    switch (m.t) {
      case 'join': case 'build': if (m.build && typeof m.build === 'object') { const b = clean(m.build); if (run.byPid(from)) run.setBuild(from, b); else run.addMember(from, b, null); } break;
      case 'in': { const i = sim.players.findIndex(q => q.pid === from); if (i >= 0 && m.i && typeof m.i === 'object') { const c = m.i, n = v => Math.max(-1, Math.min(1, +v || 0)), a = v => v == null ? null : (isFinite(+v) ? +v : null); applyCmd(sim, { t: 'input', p: i, x: n(c.x), y: n(c.y), act: c.act, g: c.g, fin: typeof c.fin === 'string' ? c.fin.slice(0, 20) : '', heavy: c.heavy, block: c.block, dash: c.dash, fire: c.fire, jump: c.jump, ax: a(c.ax), ay: a(c.ay) }); } break; }
      case 'ready': run.readyUp(from, typeof m.map === 'string' ? m.map.slice(0, 20) : 'fields'); break;
      case 'unready': run.unready(from); break;
      case 'vote': run.castVote(from, !!m.leave); break;
      case 'ack': run.ack(from); break;
    }
  }
  /* call once per sim step after run.update(); sends snapshots at 20 Hz and each guest's result once */
  afterStep() {
    const run = this.run, sim = this.sim; this.tick++;
    if (run.phase === 'wave' && this.lastPhase === 'camp') run.runN++;
    this.lastPhase = run.phase;
    if ((run.phase === 'dead' || run.phase === 'left') && this.sentRun !== run.runN) {
      this.sentRun = run.runN;
      for (const m of run.members) if (m !== run.me && m.result && m.result.kind !== 'wait') this.send(m.pid, { t: 'result', res: Object.assign({ runN: run.runN }, m.result) });
    }
    if (this.tick % 3) return;
    const texts = sim.textOut.splice(0).map(t => ({ x: r1(t.x), y: r1(t.y), text: t.text, col: t.col, size: t.size }));
    const snap = packSnap(sim, run, this.tick, texts);
    for (const id of this.peers.keys()) this.send(id, snap);
  }
}
// builds come from the network: keep only what the host reads, bounded
function clean(b) {
  const str = (v, n) => String(v == null ? '' : v).slice(0, n), num = (v, lo, hi, d) => { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  const d = b.d || {};
  return { name: str(b.name, 16) || 'Player', look: b.look && typeof b.look === 'object' ? { head: str(b.look.head, 20), body: str(b.look.body, 20), liv: str(b.look.liv, 20), metal: str(b.look.metal, 20) } : null, level: num(b.level, 1, 99, 1),
    weapon: str(b.weapon, 20), armor: str(b.armor, 20), skills: (Array.isArray(b.skills) ? b.skills : []).slice(0, 5).map(x => str(x, 12)),
    d: { dex: num(d.dex, 5, 99, 5), maxHp: num(d.maxHp, 1, 400, 30), staminaMax: num(d.staminaMax, 10, 500, 100), dmgMult: num(d.dmgMult, 0.1, 5, 1), spdMult: num(d.spdMult, 0.5, 2, 1), regenMult: num(d.regenMult, 0.5, 3, 1) },
    styles: { chain: (b.styles && Array.isArray(b.styles.chain) ? b.styles.chain : []).slice(0, 8).map(x => str(x, 40)), roles: Object.fromEntries(['heavy', 'dash', 'counter', 'jump'].map(k => [k, b.styles && b.styles.roles && b.styles.roles[k] ? str(b.styles.roles[k], 40) : null])) },
    hirelings: (Array.isArray(b.hirelings) ? b.hirelings : []).slice(0, 3).map(h => ({ hid: num(h.hid, 0, 1e6, 0), name: str(h.name, 16), tier: str(h.tier, 12), weapon: str(h.weapon, 20), hp: num(h.hp, 1, 200, 18), dmgMult: num(h.dmgMult, 0.1, 5, 1) })) };
}
export { clean as cleanBuild };
