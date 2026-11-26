/* Party relay: a Durable Object that only passes messages. The first connection is the host (runs the sim); everyone else is a guest.
   Guest -> host only, host -> one guest or all. Max 5, small messages, rate capped. If the host leaves, the room closes so a fresh one can start. */
const MAX = 5, MAXLEN = 6000, RATE = 90;                    // messages per second per socket
export class PartyRoom {
  constructor(state) { this.state = state; this.socks = new Map(); this.host = null; this.n = 0; }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket only', { status: 426 });
    if (this.socks.size >= MAX) return new Response('Room full', { status: 409 });
    const [c, s] = Object.values(new WebSocketPair()); s.accept();
    const id = 'p' + (++this.n), rec = { id, ws: s, win: 0, cnt: 0 }; this.socks.set(id, rec);
    const isHost = !this.host; if (isHost) this.host = id;
    s.send(JSON.stringify({ t: 'hello', id, host: isHost }));
    if (!isHost) this.to(this.host, { t: 'peer-join', id });
    s.addEventListener('message', ev => {
      if (typeof ev.data !== 'string' || ev.data.length > MAXLEN) return;
      const now = Date.now(); if (now - rec.win > 1000) { rec.win = now; rec.cnt = 0; } if (++rec.cnt > RATE) return;
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      if (id === this.host) { const dest = m.to; delete m.to; if (dest) this.to(dest, m); else for (const k of this.socks.keys()) if (k !== id) this.to(k, m); }
      else { m.from = id; this.to(this.host, m); }
    });
    const gone = () => {
      if (!this.socks.delete(id)) return;
      if (id === this.host) { for (const r of this.socks.values()) { try { r.ws.send(JSON.stringify({ t: 'closed' })); r.ws.close(1000, 'host left'); } catch (e) { } } this.socks.clear(); this.host = null; }
      else this.to(this.host, { t: 'peer-leave', id });
    };
    s.addEventListener('close', gone); s.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: c });
  }
  to(id, m) { const r = this.socks.get(id); if (r) try { r.ws.send(JSON.stringify(m)); } catch (e) { } }
}
