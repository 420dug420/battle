/* Project War server (Cloudflare Worker, free plan). This file is what runs at project-war.<you>.workers.dev.
   /party/<room>  WebSocket party relay (party-room.js; Durable Object, SQLite class, free plan)
   /api/token     Discord Activity login: OAuth code -> access token. DISCORD_CLIENT_ID is a var, DISCORD_CLIENT_SECRET a secret.
   /              the game page, read from the public repo (docs/index.html), so a git push updates the live page. */
export { PartyRoom } from './party-room.js';
const PAGE = 'https://raw.githubusercontent.com/420dug420/battle/main/docs/index.html';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } });
export default {
  async fetch(req, env) {
    const url = new URL(req.url), pm = url.pathname.match(/^\/(?:ws\/)?party\/([\w-]{1,40})$/);
    if (pm) return env.PARTY.get(env.PARTY.idFromName(pm[1])).fetch(req);
    if ((url.pathname === '/api/token' || url.pathname === '/token') && req.method === 'POST') {
      if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return json({ error: 'Discord is not configured on this server.' }, 501);
      let code; try { code = (await req.json()).code; } catch (e) { }
      if (typeof code !== 'string' || !code || code.length > 200) return json({ error: 'Missing code.' }, 400);
      const r = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code }) });
      const o = await r.json().catch(() => ({}));
      if (!r.ok || !o.access_token) return json({ error: 'Discord refused the code.' }, 502);
      return json({ access_token: o.access_token });
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/arena.html')) {
      const r = await fetch(PAGE + '?v=' + Math.floor(Date.now() / 60000), { cf: { cacheTtl: 30, cacheEverything: true } });
      if (!r.ok) return new Response('Could not load the game page (' + r.status + ').', { status: 502 });
      return new Response(r.body, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
    }
    return new Response('Not found', { status: 404 });
  }
};
