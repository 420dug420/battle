/* Discord Activity hooks. Outside Discord, initDiscord() resolves to null and nothing else here runs.
   Inside Discord it: starts the Embedded App SDK, signs the player in (the code is exchanged by the Worker at /api/token,
   so the client secret never reaches the browser), tracks who is in the activity, and sets the Rich Presence line.
   Setup steps are in DISCORD.md. */
import { DiscordSDK } from '@discord/embedded-app-sdk';

export const inDiscord = () => { try { const q = new URLSearchParams(location.search); return q.has('frame_id') && q.has('instance_id'); } catch (e) { return false; } };

export async function initDiscord({ clientId, onParticipants, onError } = {}) {
  if (!inDiscord()) return null;
  if (!clientId) { if (onError) onError('No Discord client id was set at build time (DISCORD_CLIENT_ID).'); return null; }
  const sdk = new DiscordSDK(clientId);
  const d = { sdk, user: null, name: 'Player', participants: [], instanceId: sdk.instanceId, channelId: sdk.channelId, guildId: sdk.guildId, ready: false, presenceAt: -1e9, presenceKey: '' };
  try {
    await sdk.ready();
    const { code } = await sdk.commands.authorize({ client_id: clientId, response_type: 'code', state: '', prompt: 'none', scope: ['identify', 'guilds', 'rpc.activities.write'] });
    const res = await fetch('/api/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    if (!res.ok) throw new Error('Token exchange failed (' + res.status + ')');
    const { access_token } = await res.json();
    const auth = await sdk.commands.authenticate({ access_token });
    d.user = auth && auth.user; d.name = (d.user && (d.user.global_name || d.user.username)) || 'Player';
    const setP = list => { d.participants = (list || []).map(p => ({ id: p.id, name: p.global_name || p.username, avatar: p.avatar })); if (onParticipants) onParticipants(d.participants); };
    try { const r = await sdk.commands.getInstanceConnectedParticipants(); setP(r.participants); } catch (e) { }
    sdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', e => setP(e.participants));
    d.ready = true;
  } catch (e) { if (onError) onError(String(e && e.message || e)); return null; }
  // Rich Presence: at most one update per 6 s, and only when the text changed (Discord limits how often it is allowed)
  d.setPresence = (details, state, now) => {
    const key = details + '|' + state; if (!d.ready || key === d.presenceKey || now - d.presenceAt < 6) return;
    d.presenceKey = key; d.presenceAt = now;
    sdk.commands.setActivity({ activity: { type: 0, details, state } }).catch(() => { });
  };
  d.roomName = 'dc-' + String(d.instanceId || 'solo').replace(/[^\w-]/g, '').slice(0, 36);
  d.wsBase = 'wss://' + location.host + '/.proxy/ws';          // the URL mapping /ws in the Developer Portal points at the Worker
  return d;
}
