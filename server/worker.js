/* Project War server. GET /room/<name> as a WebSocket joins (or creates) that fight room. */
export { FightRoom } from './room.js';
export default {
  async fetch(req, env) {
    const url = new URL(req.url), m = url.pathname.match(/^\/room\/([\w-]{1,40})$/);
    if (!m) return new Response('Project War server. Rooms: /room/<name> (WebSocket).', { headers: { 'content-type': 'text/plain' } });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
  }
};
