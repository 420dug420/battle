/* ============================================================
   PROJECT WAR · CLOUD  (saves and the Book of Swords, on the project-war Worker)
   Inside Discord the save lives on the server, under the player's Discord account (the Worker checks the token with Discord).
   Outside Discord, or when the server can't be reached, the browser's own save is all there is.
   ============================================================ */
export function makeCloud() {
  let token = null, timer = null, pending = null, lastSent = '';
  const api = async (path, opt) => { const r = await fetch('/data' + path, opt); if (!r.ok) throw new Error('server ' + r.status); return r.json(); };
  const auth = () => ({ authorization: 'Bearer ' + token, 'content-type': 'application/json' });
  async function flush(keep) {
    clearTimeout(timer); timer = null; if (!token || !pending) return;
    const body = JSON.stringify(pending); pending = null; if (body === lastSent) return;
    try { await fetch('/data/me', { method: 'PUT', headers: auth(), body, keepalive: !!keep }); lastSent = body; } catch (e) { }
  }
  return {
    get signedIn() { return !!token; },
    setToken(t) { token = t || null; },
    async load() { if (!token) return null; return api('/me', { headers: auth() }); },          // { save: text | null }
    put(save, pub) { if (!token) return; pending = { save, pub }; clearTimeout(timer); timer = setTimeout(flush, 4000); },   // at most one write per few seconds
    flush,
    book(q) { return api('/book?q=' + encodeURIComponent(q || '')); },                             // { players: [{ id, name, level, best, lastSeen }] }
    profile(id) { return api('/profile/' + encodeURIComponent(id)); },                            // the public profile: no inventory
  };
}
