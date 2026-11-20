// Local check against `wrangler dev`: a player joins, spawns a dummy, walks in, and the server's sim lands hits.
const URL = process.argv[2] || 'ws://127.0.0.1:8799/room/test-' + Date.now();
const got = { a: [], b: [] };
const open = k => new Promise((ok, bad) => { const ws = new WebSocket(URL); ws.onmessage = e => got[k].push(JSON.parse(e.data)); ws.onopen = () => ok(ws); ws.onerror = bad; });
const a = await open('a'), b = await open('b');
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
const role = (arr) => (arr.find(m => m.t === 'hello') || {}).role;
console.log('roles', role(got.a), role(got.b));
a.send(JSON.stringify({ t: 'spawn', tier: 'leather', n: 1, ai: 'stand' }));
b.send(JSON.stringify({ t: 'spawn', tier: 'plate', n: 5 }));               // watcher: must be ignored
await wait(300);
a.send(JSON.stringify({ t: 'input', x: 1, y: 0 })); await wait(1900); a.send(JSON.stringify({ t: 'input', x: 0, y: 0 }));
await wait(2500);
const last = got.a.filter(m => m.t === 'state').pop(), states = got.a.filter(m => m.t === 'state').length;
const logs = got.a.flatMap(m => m.log || []).map(l => l.text);
console.log('snapshots', states, 'over ~5 s; enemies', last.e.length, 'player x', last.p.x.toFixed(0));
console.log('log:', logs.slice(-4).join(' | '));
console.log('watcher snapshots', got.b.filter(m => m.t === 'state').length);
const kills = logs.filter(t => /KILLED/.test(t)).length;
if (role(got.a) !== 'player' || role(got.b) !== 'watcher' || !kills || last.e.some(e => e.tier === 'plate')) { console.log('FAIL'); process.exit(1); }
console.log('PASS server room: authoritative fight, watcher read-only');
a.close(); b.close(); process.exit(0);
