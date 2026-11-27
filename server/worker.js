/* Project War server (Cloudflare Worker, free plan). This file is what runs at project-war.<you>.workers.dev.
   /party/<room>  WebSocket party relay (party-room.js; Durable Object, SQLite class, free plan)
   /api/token     Discord Activity login: OAuth code -> access token. DISCORD_CLIENT_ID is a var, DISCORD_CLIENT_SECRET a secret.
   /data/...      saves and the Book of Swords (D1 database DB, free plan). The player is whoever Discord says owns the token.
   /              the game page, read from the public repo (docs/index.html), so a git push updates the live page. */
export { PartyRoom } from './party-room.js';
const PAGE = 'https://raw.githubusercontent.com/420dug420/battle/main/docs/index.html';
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } });
/* ---------- saves and the Book of Swords ---------- */
const WHO = new Map();                                                // token -> { id, at }: Discord asked at most once a minute per token
async function who(req) {
  const h = req.headers.get('authorization') || '', tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!tok || tok.length > 200) return null;
  const c = WHO.get(tok); if (c && Date.now() - c.at < 60000) return c.id;
  const r = await fetch('https://discord.com/api/users/@me', { headers: { authorization: 'Bearer ' + tok } });
  if (!r.ok) return null; const u = await r.json(); if (!u || !u.id) return null;
  if (WHO.size > 500) WHO.clear(); WHO.set(tok, { id: String(u.id), at: Date.now() }); return String(u.id);
}
const LAST = new Map();
const str = (v, n) => String(v == null ? '' : v).slice(0, n), int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(+v) || 0));
function cleanPub(p) {                                                // what the Book shows: held to sane shapes and sizes
  p = p && typeof p === 'object' ? p : {}; const m = p.model && typeof p.model === 'object' ? p.model : {}, lk = m.look && typeof m.look === 'object' ? m.look : {};
  const attrs = {}; for (const a of ['str', 'dex', 'agi', 'int', 'con', 'wis', 'ldr', 'chr', 'san']) attrs[a] = int((p.attrs || {})[a], 0, 999);
  return { name: str(p.name, 16) || 'Fighter', level: int(p.level, 1, 999), attrs, runs: int(p.runs, 0, 1e6), best: int(p.best, 0, 1e4), bestRank: int(p.bestRank, 0, 4), weapon: str(p.weapon, 20), firstSeen: int(p.firstSeen, 0, 9e15),
    model: { look: { head: str(lk.head, 20), body: str(lk.body, 20), liv: str(lk.liv, 20), metal: str(lk.metal, 20) }, tier: str(m.tier, 12), weapon: str(m.weapon, 20), shield: m.shield ? str(m.shield, 12) : null } };
}
async function data(req, env, path) {
  if (!env.DB) return json({ error: 'No database bound.' }, 501);
  if (path === '/me') {
    const id = await who(req); if (!id) return json({ error: 'Sign in through Discord.' }, 401);
    if (req.method === 'GET') { const r = await env.DB.prepare('SELECT save FROM players WHERE id = ?').bind(id).first(); return json({ save: r ? r.save : null }); }
    if (req.method === 'PUT') {
      const t = Date.now(); if (t - (LAST.get(id) || 0) < 1500) return json({ ok: true, skipped: true }); LAST.set(id, t);
      const txt = await req.text(); if (txt.length > 120000) return json({ error: 'Save too big.' }, 413);
      let b; try { b = JSON.parse(txt); } catch (e) { return json({ error: 'Bad save.' }, 400); }
      if (!b || typeof b.save !== 'string' || b.save.length > 100000) return json({ error: 'Bad save.' }, 400);
      const pub = cleanPub(b.pub);
      await env.DB.prepare('INSERT INTO players (id, save, profile, name, level, best, first_seen, last_seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) ON CONFLICT(id) DO UPDATE SET save = ?2, profile = ?3, name = ?4, level = ?5, best = ?6, last_seen = ?7')
        .bind(id, b.save, JSON.stringify(pub), pub.name, pub.level, pub.best, t).run();
      return json({ ok: true });
    }
    return json({ error: 'GET or PUT.' }, 405);
  }
  if (path === '/book' && req.method === 'GET') {
    const q = str(new URL(req.url).searchParams.get('q'), 16).replace(/[%_]/g, '');
    const rs = await env.DB.prepare('SELECT id, name, level, best, last_seen FROM players WHERE name LIKE ? ORDER BY last_seen DESC LIMIT 60').bind('%' + q + '%').all();
    return json({ players: (rs.results || []).map(r => ({ id: r.id, name: r.name, level: r.level, best: r.best, lastSeen: r.last_seen })) });
  }
  const pm = path.match(/^\/profile\/(\d{1,24})$/);
  if (pm && req.method === 'GET') {
    const r = await env.DB.prepare('SELECT profile, first_seen, last_seen FROM players WHERE id = ?').bind(pm[1]).first();
    if (!r) return json({ error: 'No such page.' }, 404);
    return json({ profile: Object.assign(JSON.parse(r.profile || '{}'), { lastSeen: r.last_seen, firstSeen: r.first_seen }) });
  }
  return json({ error: 'Not found.' }, 404);
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/data/')) { try { return await data(req, env, url.pathname.slice(5)); } catch (e) { return json({ error: 'Server error.' }, 500); } }
    const pm = url.pathname.match(/^\/(?:ws\/)?party\/([\w-]{1,40})$/);
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
