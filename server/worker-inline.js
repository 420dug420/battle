/* Deploy entry that carries the built page inside the Worker (no static-assets upload needed). page.js is generated from ../dist/arena.html. */
import base, { FightRoom, PartyRoom } from './worker.js';
import PAGE from './page.js';
export { FightRoom, PartyRoom };
export default {
  fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/arena' || u.pathname === '/arena.html')) return new Response(PAGE, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-cache' } });
    return base.fetch(req, env, ctx);
  }
};
