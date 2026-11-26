/* Project War server.
   GET /room/<name> as a WebSocket joins (or creates) that fight room.
   POST /api/token turns a Discord OAuth code into an access token (Discord Activity login). Secrets: DISCORD_CLIENT_ID (a var) and DISCORD_CLIENT_SECRET (wrangler secret put).
   Everything else serves the built pages from ../dist (the Worker's free static assets); "/" is the arena page. */
export { FightRoom } from './room.js';
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json' } });
export default {
  async fetch(req, env) {
    const url = new URL(req.url), m = url.pathname.match(/^\/(?:ws\/)?room\/([\w-]{1,40})$/);
    if (m) return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
    if (url.pathname === '/api/token' && req.method === 'POST') {
      if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return json({ error: 'Discord is not configured on this server.' }, 501);
      let code; try { code = (await req.json()).code; } catch (e) { }
      if (typeof code !== 'string' || !code || code.length > 200) return json({ error: 'Missing code.' }, 400);
      const r = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code }) });
      const o = await r.json().catch(() => ({}));
      if (!r.ok || !o.access_token) return json({ error: 'Discord refused the code.' }, 502);
      return json({ access_token: o.access_token });
    }
    if (env.ASSETS) { const p = url.pathname === '/' ? '/arena.html' : url.pathname; return env.ASSETS.fetch(new Request(new URL(p, url), req)); }
    return new Response('Project War server. Rooms: /room/<name> (WebSocket).', { headers: { 'content-type': 'text/plain' } });
  }
};
