/* Project War login helper: the smallest Worker, for pasting into the Cloudflare dashboard editor (no build, no Durable Objects).
   POST /api/token (or /token) turns a Discord OAuth code into an access token.
   Variables to add in the dashboard: DISCORD_CLIENT_ID (text) and DISCORD_CLIENT_SECRET (secret). */
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json' } });
export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    if (req.method !== 'POST' || (path !== '/api/token' && path !== '/token')) return new Response('Project War login helper.', { headers: { 'content-type': 'text/plain' } });
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return json({ error: 'Discord is not configured on this server.' }, 501);
    let code; try { code = (await req.json()).code; } catch (e) { }
    if (typeof code !== 'string' || !code || code.length > 200) return json({ error: 'Missing code.' }, 400);
    const r = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code }) });
    const o = await r.json().catch(() => ({}));
    if (!r.ok || !o.access_token) return json({ error: 'Discord refused the code.' }, 502);
    return json({ access_token: o.access_token });
  }
};
