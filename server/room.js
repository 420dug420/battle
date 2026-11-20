/* FightRoom: one Durable Object per room name. It owns the fight: runs game/sim.js at 60 steps a second,
   takes inputs from the player's browser and sends back snapshots ~30 times a second. Browsers only draw.
   Prototype scope: one player per room; anyone else who connects watches. No storage is used. */
import { DurableObject } from 'cloudflare:workers';
import { CFG, Sim } from '../game/sim.js';
import { snapshot } from './protocol.js';

const STEP = 1 / 60, SEND_EVERY = 2;

export class FightRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.cfg = JSON.parse(JSON.stringify(CFG));
    this.sim = new Sim(this.cfg); this.sim.player.inv = true; this.sim.textOut = [];
    this.sockets = new Set(); this.pilot = null; this.timer = null; this.tick = 0; this.logSent = 0;
  }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('FightRoom: connect with a WebSocket', { status: 426 });
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    server.accept(); this.join(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  join(ws) {
    this.sockets.add(ws);
    if (!this.pilot) this.pilot = ws;
    ws.send(JSON.stringify({ t: 'hello', role: this.pilot === ws ? 'player' : 'watcher', seed: this.sim.seed }));
    ws.addEventListener('message', ev => { try { this.onMsg(ws, JSON.parse(ev.data)); } catch (e) { ws.send(JSON.stringify({ t: 'error', msg: String(e.message || e) })); } });
    const bye = () => { this.sockets.delete(ws); if (this.pilot === ws) { this.pilot = [...this.sockets][0] || null; if (this.pilot) this.pilot.send(JSON.stringify({ t: 'hello', role: 'player', seed: this.sim.seed })); } if (!this.sockets.size) this.stop(); };
    ws.addEventListener('close', bye); ws.addEventListener('error', bye);
    this.start();
  }
  onMsg(ws, m) {
    if (ws !== this.pilot && m.t !== 'ping') return;               // watchers can't steer
    const s = this.sim, c = this.cfg;
    switch (m.t) {
      case 'input': s.input = { x: Math.max(-1, Math.min(1, +m.x || 0)), y: Math.max(-1, Math.min(1, +m.y || 0)) }; break;
      case 'set':
        if (m.weapon && c.weapons[m.weapon]) s.player.weapon = m.weapon;
        if (m.dex != null) s.player.dex = Math.max(5, Math.min(99, +m.dex || 5));
        if ('move' in m) s.player.move = typeof m.move === 'string' ? m.move.slice(0, 80) : null;
        break;
      case 'move':                                                 // a baked weapon path from the client (prototype: trusted)
        if (typeof m.id === 'string' && m.data && Array.isArray(m.data.seg) && m.data.seg.length <= 200) s.moves[m.id.slice(0, 80)] = m.data;
        break;
      case 'spawn': {
        const n = Math.max(1, Math.min(5, +m.n || 1));
        for (let i = 0; i < n; i++) s.spawn({ tier: m.tier, ai: m.ai, index: s.enemies.filter(e => e.state === 'alive').length % 5 });
        s.say('info', 'Spawned ' + n + ' (' + (m.tier || 'leather') + ').'); break;
      }
      case 'clear': s.clearEnemies(); break;
      case 'ping': ws.send(JSON.stringify({ t: 'pong', at: m.at })); break;
    }
  }
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.sim.step(STEP); this.tick++;
      if (this.tick % SEND_EVERY) return;
      const snap = snapshot(this.sim, this.tick, this.logSent); this.logSent = snap.logTo;
      const msg = JSON.stringify(snap.msg);
      for (const ws of this.sockets) { try { ws.send(msg); } catch (e) { } }
    }, STEP * 1000);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }   // empty room: no ticking, no compute time
}
