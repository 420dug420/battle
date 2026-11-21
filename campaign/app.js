/* ============================================================
   PROJECT WAR · CAMPAIGN  (browser only)
   Title, character creation, the hub (map, gear, trade, company, style), and battles on the shared sim.
   Rules live in game/sim.js and campaign/data.js; this file is screens and drawing.
   ============================================================ */
import M3 from '../rig/model3d.js';
import { CFG, Sim, applyCmd } from '../game/sim.js';
import BUILTIN_ANIMS from '../game/anims.json';
import * as D from './data.js';
import { bg, drawFigure, label } from './stage.js';

const $ = id => document.getElementById(id);
const root = $('root');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SAVEKEY = 'pw.campaign.v1', LIBKEY = 'pwlib2';
let G = null;                                   // the campaign
let scr = 'title', tab = 'map', sel = null, toast = '', modal = null, slotSel = 0;
let anims = BUILTIN_ANIMS.slice();              // the animation library: built in, plus anything loaded
let cc = { name: 'Captain', head: 'cap', torso: 'tunic', liv: 'red', weapon: 'longsword', company: 'The Free Company' };
let battle = null;
window.PWC = { get G() { return G; }, D, M3, get battle() { return battle; }, CFG };

/* ---------- animation library ---------- */
function loadLibrary(txt, quiet) {
  const o = JSON.parse(txt), user = o.anims || [o];
  const arr = BUILTIN_ANIMS.filter(b => !user.some(u => u.id === b.id)).concat(user);
  M3.clearCustom();
  let n = 0;
  for (const x of arr) { if (!x.keys || !x.keys.length) continue; if (M3.registerAnim({ id: x.id || 'legacy', type: x.type || 'attack', two: x.load ? x.load === '2' : !!x.two, contact: x.contact, loop: x.loop, len: x.len, end: x.end, keys: x.keys, hit: x.hit })) n++; }
  anims = arr; if (!quiet) { try { localStorage.setItem(LIBKEY, txt); } catch (e) { } }
  return n;
}
try { const t = localStorage.getItem(LIBKEY); loadLibrary(t || '{"anims":[]}', true); } catch (e) { loadLibrary('{"anims":[]}', true); }

/* ---------- save ---------- */
function save() { if (!G) return; try { localStorage.setItem(SAVEKEY, D.serialize(G)); } catch (e) { } }
function loadSaved() { try { const t = localStorage.getItem(SAVEKEY); return t ? D.deserialize(t) : null; } catch (e) { return null; } }
async function exportSave() {
  const txt = D.serialize(G), name = 'project-war-' + G.company.name.replace(/\W+/g, '-').toLowerCase() + '-day' + G.day + '.json';
  try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: name, data: txt }); return; } } catch (e) { }
  modal = { kind: 'export', text: txt }; render();           // no download available here: show the text to copy
}

/* ---------- logo ---------- */
const logoCv = document.createElement('canvas'); logoCv.width = logoCv.height = 36; logoCv.className = 'pv'; logoCv.style.cssText = 'width:180px;max-width:180px;cursor:crosshair;touch-action:none';
const lg = logoCv.getContext('2d');
const PALETTE = ['#d9b24a', '#e8e4d8', '#a82424', '#23468c', '#2f6b34', '#1c1c20', '#6b3f8f', '#c2602a', '#7fb0d9', '#8a6a45', '#5a5f68', '#f0d6a0'];
let ltool = 'draw', lcol = PALETTE[0], ldown = false;
const logoEmpty = () => { const d = lg.getImageData(0, 0, 36, 36).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return false; return true; };
function applyLogo() {
  M3.setLogo('p', logoEmpty() ? null : logoCv);
  if (G) { G.company.logo = logoEmpty() ? null : logoCv.toDataURL(); save(); }
}
function setLogoFrom(url) {
  lg.clearRect(0, 0, 36, 36);
  if (!url) { applyLogo(); return; }
  const im = new Image(); im.onload = () => { lg.clearRect(0, 0, 36, 36); lg.drawImage(im, 0, 0, 36, 36); M3.setLogo('p', logoEmpty() ? null : logoCv); refreshPreview(); }; im.src = url;
}
function flood(x, y, col) {
  const id = lg.getImageData(0, 0, 36, 36), d = id.data, at = (x, y) => (y * 36 + x) * 4, t0 = d.slice(at(x, y), at(x, y) + 4);
  const c = col ? [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16), 255] : [0, 0, 0, 0];
  if (t0.every((v, i) => v === c[i])) return;
  const st = [[x, y]];
  while (st.length) { const [px, py] = st.pop(); if (px < 0 || py < 0 || px > 35 || py > 35) continue; const i = at(px, py);
    if (d[i] !== t0[0] || d[i + 1] !== t0[1] || d[i + 2] !== t0[2] || d[i + 3] !== t0[3]) continue;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3]; st.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]); }
  lg.putImageData(id, 0, 0);
}
let lsave = 0;
function paint(ev) {
  const r = logoCv.getBoundingClientRect(), x = Math.floor((ev.clientX - r.left) / r.width * 36), y = Math.floor((ev.clientY - r.top) / r.height * 36);
  if (x < 0 || y < 0 || x > 35 || y > 35) return;
  if (ltool === 'fill') flood(x, y, lcol); else if (ltool === 'erase' || ev.buttons === 2) lg.clearRect(x, y, 1, 1); else { lg.fillStyle = lcol; lg.fillRect(x, y, 1, 1); }
  clearTimeout(lsave); lsave = setTimeout(applyLogo, 250);
}
logoCv.addEventListener('contextmenu', e => e.preventDefault());
logoCv.addEventListener('pointerdown', e => { ldown = true; logoCv.setPointerCapture(e.pointerId); paint(e); });
logoCv.addEventListener('pointermove', e => { if (ldown) paint(e); });
logoCv.addEventListener('pointerup', () => { ldown = false; });
function randomCrest() {
  const R = () => Math.random(), pk = () => PALETTE[Math.floor(R() * PALETTE.length)], a = pk(); let b = pk(), c = pk(); while (b === a) b = pk(); while (c === a || c === b) c = pk();
  lg.clearRect(0, 0, 36, 36); lg.fillStyle = a; lg.fillRect(0, 0, 36, 36);
  const k = Math.floor(R() * 4);
  lg.fillStyle = b;
  if (k === 0) lg.fillRect(0, 0, 18, 36);
  else if (k === 1) for (let i = 0; i < 36; i++) lg.fillRect(i, 0, 1, Math.max(0, 36 - i));
  else if (k === 2) { lg.fillRect(0, 12, 36, 12); }
  else for (let i = 0; i < 18; i++) lg.fillRect(i, 18 - i, 36 - 2 * i, 1);
  lg.fillStyle = c; const m = Math.floor(R() * 3);
  if (m === 0) { lg.fillRect(15, 6, 6, 24); lg.fillRect(8, 13, 20, 6); } else if (m === 1) { lg.beginPath(); lg.arc(18, 18, 7, 0, 7); lg.fill(); } else { lg.fillRect(8, 8, 6, 6); lg.fillRect(22, 8, 6, 6); lg.fillRect(15, 22, 6, 6); }
  applyLogo(); refreshPreview();
}

/* ---------- figures for previews ---------- */
let clock = 0;
function playerFig(extra) {
  const d = D.derived(G), w = CFG.weapons[d.weapon];
  return Object.assign({ role: 'p', tier: 'leather', pHead: d.look.head, pBody: d.look.body, pLiv: d.look.liv, pMetal: d.look.metal, two: d.hands === 2, wkind: w.kind || 'sword', shield: d.shield, face: 1, t: clock, broken: false, moving: false, walkT: 0, flash: 0, x: M3.ox, y: M3.oy }, extra || {});
}
function createFig() {
  const w = CFG.weapons[cc.weapon], hands = D.WEAPON_HANDS[cc.weapon];
  return { role: 'p', tier: 'leather', pHead: cc.head, pBody: cc.torso, pLiv: cc.liv, pMetal: 'steel', two: hands === 2, wkind: w.kind || 'sword', shield: hands === 1, face: 1, t: clock, broken: false, moving: false, walkT: 0, flash: 0, x: M3.ox, y: M3.oy };
}
function drawPreview() {
  const cv = $('pv'); if (!cv) return;
  const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2a2235'; ctx.fillRect(0, 0, 200, 200);
  if (cv.dataset.mode === 'style') {
    const st = cv.dataset.style, d = D.derived(G), iv = 1.2, tt = (clock % 1.6);
    const dur = Math.max(0.5, d.interval + 0.1);
    ctx.save(); ctx.translate(0, 0); drawFigure(ctx, playerFig({ style: st, swing: tt < dur ? { t: tt, dur, dur0: dur, hitAt: dur * 0.45, extra: 0 } : null, t: clock })); ctx.restore();
  } else drawFigure(ctx, scr === 'create' ? createFig() : playerFig());
}
function refreshPreview() { drawPreview(); }
let last = 0;
function tickPreview(ts) { clock = ts / 1000; if (scr !== 'battle') { try { drawPreview(); if (scr === 'hub' && tab === 'map') drawMap(); } catch (e) { } } requestAnimationFrame(tickPreview); }

/* ---------- screens ---------- */
function render() {
  if (scr === 'battle') { root.innerHTML = battleHTML(); bindBattle(); return; }
  let h = '';
  if (scr === 'title') h = titleHTML(); else if (scr === 'create') h = createHTML(); else h = hubHTML();
  if (modal) h += modalHTML();
  root.innerHTML = h;
  const slot = $('logoslot'); if (slot) slot.replaceWith(logoCv);
  if (scr === 'hub' && tab === 'map') { const m = $('map'); if (m) m.addEventListener('click', mapClick); }
  drawPreview();
}
const fmtPct = x => Math.round(x * 100) + '%';

function titleHTML() {
  const sv = loadSaved();
  return `<div class="title"><h1>PROJECT <span>WAR</span></h1><div class="sub">A mercenary company. Raise it, arm it, keep it alive.</div>
  <div class="btns" style="flex-direction:column;min-width:240px">
    ${sv ? `<button class="btn primary" data-a="continue">Continue: ${esc(sv.company.name)}, day ${sv.day}</button>` : ''}
    <button class="btn ${sv ? '' : 'primary'}" data-a="newgame">New company</button>
    <button class="btn" data-a="importmenu">Load from file or text</button>
  </div><p class="muted">${toast ? esc(toast) : 'Saves live in this browser and can be exported to a file.'}</p></div>`;
}

function createHTML() {
  const opt = (list, cur) => list.map(([id, n]) => `<option value="${id}"${id === cur ? ' selected' : ''}>${esc(n)}</option>`).join('');
  const heads = D.itemsOf('head', 1).map(i => [i.look, i.name]), torsos = D.itemsOf('torso', 1).map(i => [i.look, i.name]);
  const liv = (M3.parts && M3.parts.liveries ? M3.parts.liveries : D.LIVERY_IDS.map(i => [i, i])).filter(l => D.LIVERY_IDS.includes(l[0]));
  return `<header><h1>New <span>company</span></h1></header>
  <div class="cols"><div class="col"><canvas id="pv" class="pv" width="200" height="200"></canvas>
    <div class="panel"><h2>Company crest</h2><span id="logoslot"></span>
      <div class="btns">${['draw', 'fill', 'erase'].map(t => `<button class="btn sm" data-a="ltool" data-t="${t}" style="${ltool === t ? 'outline:2px solid var(--gold)' : ''}">${t}</button>`).join('')}<button class="btn sm" data-a="crest">Random</button><button class="btn sm" data-a="lclear">Clear</button></div>
      <div class="btns">${PALETTE.map(c => `<button class="sw" data-a="lcol" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>
      <p class="muted">Shows on your tabard, tunic and shield. You can change it later.</p></div></div>
  <div class="col"><div class="panel"><h2>Captain</h2>
    <div class="field"><label>Name</label><input type="text" data-f="name" value="${esc(cc.name)}" maxlength="24"></div>
    <div class="field"><label>Head</label><select data-f="head">${opt(heads, cc.head)}</select></div>
    <div class="field"><label>Torso</label><select data-f="torso">${opt(torsos, cc.torso)}</select></div>
    <div class="field"><label>Colors</label><select data-f="liv">${opt(liv, cc.liv)}</select></div></div>
  <div class="panel"><h2>Weapon</h2>
    ${D.itemsOf('weapon').map(w => `<label class="row" style="cursor:pointer"><span class="nm"><input type="radio" name="wp" data-f="weapon" value="${w.weapon}"${cc.weapon === w.weapon ? ' checked' : ''}> ${esc(w.name)}<small>${w.hands === 1 ? 'one hand, with a shield' : 'two hands'} · ${CFG.weaponClasses[CFG.weapons[w.weapon].cls].dmg} dmg · reach ${CFG.weaponClasses[CFG.weapons[w.weapon].cls].reach}</small></span></label>`).join('')}</div>
  <div class="panel"><h2>Company</h2><div class="field"><label>Name</label><input type="text" data-f="company" value="${esc(cc.company)}" maxlength="28"></div>
    <p class="muted">You start with ${D.START_GOLD} gold, the gear you chose (all rank 1), and one fighting style.</p>
    <div class="btns"><button class="btn primary" data-a="start">Begin</button><button class="btn" data-a="title">Back</button></div></div></div></div>`;
}

function hubHTML() {
  const n = G.map.nodes[G.at], tabs = [['map', 'Map'], ['gear', 'Gear'], ['trade', 'Trade'], ['company', 'Company'], ['style', 'Style']];
  let body = '';
  if (tab === 'map') body = mapHTML(); else if (tab === 'gear') body = gearHTML(); else if (tab === 'trade') body = tradeHTML(); else if (tab === 'company') body = companyHTML(); else body = styleHTML();
  return `<div class="topbar"><span class="co">${esc(G.company.name)}</span><span class="chip">Day <b>${G.day}</b></span><span class="chip">Gold <b class="gold">${G.gold}</b></span><span class="chip">At <b>${esc(n.name)}</b> (${n.type})</span>
    <span style="flex:1"></span><button class="btn sm" data-a="menu">Menu</button></div>
  <div class="tabs" role="tablist">${tabs.map(([id, t]) => `<button class="tab" role="tab" data-a="tab" data-t="${id}" aria-selected="${tab === id}">${t}</button>`).join('')}</div>
  ${toast ? `<div class="hint">${esc(toast)}</div>` : ''}${body}`;
}

/* ----- map ----- */
function mapHTML() {
  const m = G.map, n = m.nodes[G.at], s = sel != null ? m.nodes[sel] : null;
  let info = '';
  if (!G.flags.tutorialDone) info = `<div class="panel"><h2>Training ground</h2><p>Before the road, a short drill. Win it and you learn a second fighting style.</p><button class="btn primary" data-a="tutorial">Begin training</button></div>`;
  const here = n.type === 'camp'
    ? (D.campReady(G, n.id) ? `<button class="btn primary" data-a="camp" ${G.flags.tutorialDone ? '' : 'disabled'}>Attack the ${esc(n.kind.toLowerCase())}</button>` : `<span class="muted">Quiet until day ${G.camps[n.id].until}.</span>`)
    : `<span class="muted">A town: trade, mend, and hire from the Trade and Company tabs.</span>`;
  const nb = D.neighbors(m, G.at);
  let target = '';
  if (s && s.id !== G.at) target = nb.includes(s.id)
    ? `<div class="panel"><h2>${esc(s.name)}</h2><p>${s.type === 'town' ? 'Town' : esc(s.kind) + ' · danger ' + '★'.repeat(s.danger)}</p><button class="btn primary" data-a="travel" data-id="${s.id}" ${G.flags.tutorialDone ? '' : 'disabled'}>Travel (1 day)</button><p class="muted">The road may bring an ambush.</p></div>`
    : `<div class="panel"><h2>${esc(s.name)}</h2><p class="muted">Not on a road from here. Travel one stop at a time.</p></div>`;
  return `<div class="cols"><div class="col" style="flex:2 1 520px"><canvas id="map" width="640" height="360"></canvas><div class="sub">Click a place beside you to travel. ★ is how dangerous it is.</div></div>
  <div class="col">${info}<div class="panel"><h2>${esc(n.name)}</h2><p style="margin:0">${n.type === 'camp' ? esc(n.kind) + ' · danger ' + '★'.repeat(n.danger) : 'Town'}</p>${here}</div>${target}
  <div class="panel"><h2>Your company</h2><div class="row"><span class="nm">${esc(G.char.name)}</span><span>HP ${G.char.hp}</span></div>${G.hirelings.map(h => `<div class="row"><span class="nm">${esc(h.name)}<small>${D.tierName(h.tier)} · ${esc(CFG.weapons[h.weapon].label)}</small></span><span>HP ${h.hp}</span></div>`).join('') || '<p class="muted">No hirelings yet.</p>'}</div></div></div>`;
}
function drawMap() {
  const cv = $('map'); if (!cv) return; const c = cv.getContext('2d'), m = G.map;
  c.fillStyle = '#2b3a2a'; c.fillRect(0, 0, 640, 360);
  for (let i = 0; i < 70; i++) { const h = ((i * 2654435761) >>> 0); c.fillStyle = i % 3 ? '#26352a' : '#31422f'; c.fillRect(h % 630, (h >>> 9) % 350, 6 + (h % 7), 4); }
  c.lineWidth = 4; c.strokeStyle = '#8a7a58'; c.setLineDash([8, 5]);
  for (const [a, b] of m.edges) { c.beginPath(); c.moveTo(m.nodes[a].x, m.nodes[a].y); c.lineTo(m.nodes[b].x, m.nodes[b].y); c.stroke(); }
  c.setLineDash([]);
  const nb = D.neighbors(m, G.at);
  for (const n of m.nodes) {
    const reach = nb.includes(n.id), here = n.id === G.at;
    if (reach) { c.strokeStyle = '#f0c35a'; c.lineWidth = 2; c.beginPath(); c.arc(n.x, n.y, 20, 0, 7); c.stroke(); }
    if (sel === n.id) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(n.x, n.y, 24, 0, 7); c.stroke(); }
    if (n.type === 'town') { c.fillStyle = '#d9c9a0'; c.fillRect(n.x - 11, n.y - 9, 22, 18); c.fillStyle = '#7a3f34'; c.beginPath(); c.moveTo(n.x - 13, n.y - 9); c.lineTo(n.x, n.y - 21); c.lineTo(n.x + 13, n.y - 9); c.fill(); }
    else { const dead = !D.campReady(G, n.id); c.fillStyle = dead ? '#5a5f68' : '#a82424'; c.beginPath(); c.moveTo(n.x - 12, n.y + 9); c.lineTo(n.x, n.y - 12); c.lineTo(n.x + 12, n.y + 9); c.fill(); c.fillStyle = '#14101c'; c.fillRect(n.x - 2, n.y - 2, 4, 8); }
    label(c, n.name, n.x, n.y + 30, '#f4ecd8', 10);
    if (n.type === 'camp') label(c, '★'.repeat(n.danger), n.x, n.y - 24, '#f0c35a', 9);
    if (here) { c.fillStyle = '#f0c35a'; c.beginPath(); c.moveTo(n.x, n.y - 30); c.lineTo(n.x - 6, n.y - 40); c.lineTo(n.x + 6, n.y - 40); c.fill(); }
  }
}
function mapClick(e) {
  const cv = e.currentTarget, r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 640, y = (e.clientY - r.top) / r.height * 360;
  let best = null, bd = 28 * 28; for (const n of G.map.nodes) { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { best = n.id; bd = d; } }
  sel = best; toast = ''; render();
}

/* ----- gear ----- */
const itemLine = it => {
  const d = D.itemDef(it);
  if (d.slot === 'weapon') { const c = CFG.weaponClasses[CFG.weapons[d.weapon].cls]; return `${c.twoHanded ? 'two-handed' : 'one-handed'} · ${c.dmg} dmg · reach ${c.reach}`; }
  return `${fmtPct(d.pct)} armor · durability ${it.dur}/${d.dur}`;
};
function gearHTML() {
  const d = D.derived(G), chain = D.chainFor(G, anims).map(id => D.allStyles(anims).find(s => s.id === id).name);
  const stat = (k, v) => `<div class="rrow"><span>${k}</span><b>${v}</b></div>`;
  const slots = D.SLOTS.map(slot => {
    const cur = G.equipped[slot] && D.itemById(G, G.equipped[slot]), others = G.items.filter(i => D.itemDef(i).slot === slot && i.iid !== G.equipped[slot]);
    return `<div class="slot"><h3>${slot}</h3>${cur ? `<div class="row"><span class="nm">${esc(D.itemDef(cur).name)}<span class="tag">${D.tierName(D.itemDef(cur).tier)}</span><small>${itemLine(cur)}</small></span>${slot === 'shield' ? '<button class="btn sm" data-a="unequip" data-slot="shield">Remove</button>' : ''}</div>` : '<div class="muted">Nothing equipped.</div>'}
      ${others.length ? `<div class="pick">${others.map(i => `<button data-a="equip" data-slot="${slot}" data-iid="${i.iid}"><b>${esc(D.itemDef(i).name)}</b> <span class="tag">${D.tierName(D.itemDef(i).tier)}</span><br><small>${itemLine(i)}</small></button>`).join('')}</div>` : ''}</div>`;
  }).join('');
  return `<div class="cols"><div class="col"><canvas id="pv" class="pv" width="200" height="200"></canvas>
    <div class="panel"><h2>Stats</h2>${stat('Health', d.hp)}${stat('Armor reduction', fmtPct(d.pct))}${stat('Armor durability', d.dur + ' / ' + d.durMax)}${stat('Weapon', esc(d.weaponName) + (d.hands === 2 ? ' (two hands)' : d.shield ? ' + shield' : ''))}${stat('Damage', d.dmg)}${stat('Reach', d.reach)}${stat('Swing time', d.interval.toFixed(2) + ' s')}${stat('DEX / SAN / CHR', d.stats.dex + ' / ' + d.stats.san + ' / ' + d.stats.chr)}${stat('Chain', esc(chain.join(' > ')))}</div></div>
    <div class="col"><div class="panel"><h2>Equipment</h2>${slots}<p class="muted">Armor wears down in fights and protects nothing at 0 durability. Mend it in a town (Trade tab).</p></div></div></div>`;
}

/* ----- trade ----- */
function tradeHTML() {
  const n = G.map.nodes[G.at];
  if (n.type !== 'town') return `<div class="panel"><h2>Trade</h2><p>There is no market at ${esc(n.name)}. Reach a town to buy, sell or mend.</p></div>`;
  const stock = D.shopStock(G, n.id), sold = G.items.filter(i => !D.isEquipped(G, i.iid)), worn = G.items.filter(i => D.repairCost(i) > 0);
  const total = worn.reduce((a, i) => a + D.repairCost(i), 0);
  return `<div class="cols"><div class="col"><div class="panel"><h2>Buy · ${esc(n.name)}</h2>${stock.map(k => { const d = D.ITEMS[k]; return `<div class="row"><span class="nm">${esc(d.name)}<span class="tag">${D.tierName(d.tier)}</span><small>${itemLine({ key: k, dur: d.dur })}</small></span><button class="btn sm" data-a="buy" data-k="${k}" ${G.gold < d.price ? 'disabled' : ''}>${d.price} g</button></div>`; }).join('')}</div></div>
  <div class="col"><div class="panel"><h2>Mend</h2>${worn.map(i => `<div class="row"><span class="nm">${esc(D.itemDef(i).name)}<small>${i.dur}/${D.itemDef(i).dur}</small></span><button class="btn sm" data-a="repair" data-iid="${i.iid}" ${G.gold < D.repairCost(i) ? 'disabled' : ''}>${D.repairCost(i)} g</button></div>`).join('') || '<p class="muted">Everything is sound.</p>'}
    ${worn.length > 1 ? `<button class="btn" data-a="repairall" ${G.gold < total ? 'disabled' : ''}>Mend all (${total} g)</button>` : ''}</div>
  <div class="panel"><h2>Sell</h2>${sold.map(i => { const d = D.itemDef(i), wear = d.dur ? i.dur / d.dur : 1, g = Math.max(d.price ? 1 : 0, Math.floor(D.sellPrice(d) * (0.4 + 0.6 * wear))); return `<div class="row"><span class="nm">${esc(d.name)}<small>${itemLine(i)}</small></span><button class="btn sm" data-a="sell" data-iid="${i.iid}">${g} g</button></div>`; }).join('') || '<p class="muted">Nothing spare to sell. Worn items must come off first.</p>'}</div></div></div>`;
}

/* ----- company ----- */
function companyHTML() {
  const n = G.map.nodes[G.at], rec = n.type === 'town' ? D.recruits(G, n.id) : [];
  const liv = (M3.parts ? M3.parts.liveries : []).filter(l => D.LIVERY_IDS.includes(l[0]));
  return `<div class="cols"><div class="col"><div class="panel"><h2>Company</h2><div class="field"><label>Name</label><input type="text" data-f="cname" value="${esc(G.company.name)}" maxlength="28"></div>
    <div class="field"><label>Colors</label><select data-f="cliv">${liv.map(([id, nm]) => `<option value="${id}"${G.char.liv === id ? ' selected' : ''}>${esc(nm)}</option>`).join('')}</select></div></div>
    <div class="panel"><h2>Crest</h2><span id="logoslot"></span>
      <div class="btns">${['draw', 'fill', 'erase'].map(t => `<button class="btn sm" data-a="ltool" data-t="${t}" style="${ltool === t ? 'outline:2px solid var(--gold)' : ''}">${t}</button>`).join('')}<button class="btn sm" data-a="crest">Random</button><button class="btn sm" data-a="lclear">Clear</button></div>
      <div class="btns">${PALETTE.map(c => `<button class="sw" data-a="lcol" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div></div></div>
  <div class="col"><div class="panel"><h2>Hirelings (${G.hirelings.length}/${D.MAX_HIRELINGS})</h2>${G.hirelings.map(h => `<div class="row"><span class="nm">${esc(h.name)}<span class="tag">${D.tierName(h.tier)}</span><small>${esc(CFG.weapons[h.weapon].label)} · HP ${h.hp} · ${fmtPct(CFG.tiers[['', 'leather', 'mail', 'plate'][h.tier]].pct)} armor</small></span><button class="btn sm" data-a="dismiss" data-hid="${h.hid}">Dismiss</button></div>`).join('') || '<p class="muted">Nobody yet. Hire in a town. They fight beside you on their own.</p>'}</div>
    <div class="panel"><h2>Recruits${n.type === 'town' ? ' · ' + esc(n.name) : ''}</h2>${n.type !== 'town' ? '<p class="muted">Recruits wait in towns.</p>' : rec.map(r => { const hired = G.hirelings.some(h => h.rid === r.rid); return `<div class="row"><span class="nm">${esc(r.name)}<span class="tag">${D.tierName(r.tier)}</span><small>${esc(CFG.weapons[r.weapon].label)} · HP ${r.hp}</small></span><button class="btn sm" data-a="hire" data-rid="${r.rid}" ${hired || G.gold < r.fee || G.hirelings.length >= D.MAX_HIRELINGS ? 'disabled' : ''}>${hired ? 'Hired' : r.fee + ' g'}</button></div>`; }).join('')}
    <p class="muted">A one-time fee. Hirelings who fall in a lost fight are gone for good.</p></div></div></div>`;
}

/* ----- style ----- */
function styleHTML() {
  const all = D.allStyles(anims), hands = D.derived(G).hands, S = G.styles;
  const owned = all.filter(s => S.owned.includes(s.id)), locked = all.filter(s => !S.owned.includes(s.id));
  slotSel = Math.min(slotSel, S.slotCount - 1);
  const cur = all.find(s => s.id === S.slots[slotSel]) || all[0];
  const slots = Array.from({ length: D.MAX_SLOTS }, (_, i) => {
    if (i >= S.slotCount) return `<div class="cs lock"><b>Slot ${i + 1}</b><br><small>Locked</small></div>`;
    const st = all.find(s => s.id === S.slots[i]);
    return `<button class="cs" data-a="slot" data-i="${i}" aria-pressed="${i === slotSel}"><b>Slot ${i + 1}</b><br>${st ? esc(st.name) : '<small>empty</small>'}${st && !D.styleFits(st, hands) ? '<br><small class="bad">needs ' + st.hands + ' hands</small>' : ''}</button>`;
  }).join('');
  return `<div class="cols"><div class="col"><canvas id="pv" class="pv" width="200" height="200" data-mode="style" data-style="${cur.id}"></canvas><div class="sub" style="text-align:center">${esc(cur.name)}</div></div>
  <div class="col"><div class="panel"><h2>Chain</h2><p class="muted" style="margin:0">Your swings play in slot order, then start over. Moving or missing breaks the chain back to slot 1.</p><div class="chain">${slots}</div></div>
  <div class="panel"><h2>Styles you know</h2><div class="pick" style="max-height:260px">${owned.map(s => `<button data-a="setstyle" data-id="${s.id}" ${D.styleFits(s, hands) ? '' : 'style="opacity:.5"'}><b>${esc(s.name)}</b>${s.hands ? `<span class="tag">${s.hands === 2 ? 'two-handed' : 'one-handed'}</span>` : '<span class="tag">any</span>'}</button>`).join('')}</div>
    <p class="muted">${locked.length} more to learn. The training ground teaches your second.</p></div>
  <div class="panel"><details><summary>Animations</summary><div style="display:flex;flex-direction:column;gap:8px"><p class="muted">Made in the Animator? Paste the library here (or open the file) to use it. Attack animations become styles; idle, walk, damaged, dying and falling play automatically.</p>
    <textarea id="libtxt" placeholder="Library JSON"></textarea><div class="btns"><button class="btn sm" data-a="loadlib">Load</button><input type="file" id="libfile" accept=".json,application/json"><button class="btn sm" data-a="unlockall">Test: learn every style</button></div><p class="muted" id="libmsg"></p></div></details></div></div></div>`;
}

/* ----- modals ----- */
function modalHTML() {
  if (modal.kind === 'menu') return `<div class="overlay"><div class="modal"><h2>Menu</h2><p class="muted" style="margin:0">Saved automatically in this browser after every change.</p>
    <button class="btn" data-a="export">Export save to a file</button><button class="btn" data-a="importmenu">Load a save</button><button class="btn" data-a="title">Back to title</button><button class="btn" data-a="closemodal">Close</button></div></div>`;
  if (modal.kind === 'export') return `<div class="overlay"><div class="modal"><h2>Your save</h2><p class="muted" style="margin:0">Downloads are not available here. Copy this text into a file to keep it.</p><textarea readonly id="exptxt">${esc(modal.text)}</textarea><div class="btns"><button class="btn" data-a="copyexp">Copy</button><button class="btn" data-a="closemodal">Close</button></div></div></div>`;
  if (modal.kind === 'import') return `<div class="overlay"><div class="modal"><h2>Load a save</h2><input type="file" id="impfile" accept=".json,application/json"><textarea id="imptxt" placeholder="…or paste the save text here"></textarea><p class="muted" id="impmsg" style="margin:0"></p><div class="btns"><button class="btn primary" data-a="doimport">Load</button><button class="btn" data-a="closemodal">Cancel</button></div></div></div>`;
  if (modal.kind === 'ambush') return `<div class="overlay"><div class="modal"><h2>Ambush!</h2><p>Men step out of the trees on the road to ${esc(modal.to)}. ${modal.spec.enemies.length} of them. Danger ${'★'.repeat(modal.spec.danger)}.</p><button class="btn primary" data-a="fight">Draw steel</button></div></div>`;
  if (modal.kind === 'precamp') return `<div class="overlay"><div class="modal"><h2>${esc(modal.spec.label)}</h2><p>${modal.spec.enemies.length} men, danger ${'★'.repeat(modal.spec.danger)}. ${esc(modal.spec.weather)}, ${esc(modal.spec.time)}. Pay: <span class="gold">${modal.spec.pay} g</span>.</p><div class="btns"><button class="btn primary" data-a="fight">Attack</button><button class="btn" data-a="closemodal">Not yet</button></div></div></div>`;
  if (modal.kind === 'result') { const r = modal.r; return `<div class="overlay"><div class="modal"><h2>${r.won ? 'Victory' : 'Defeat'}</h2>
    ${r.won ? `<p>Paid <span class="gold">${r.pay} g</span>.</p>` : `<p>${r.lostGold ? 'You lost <span class="gold">' + r.lostGold + ' g</span>.' : ''}</p>`}
    ${r.loot.length ? `<p>Taken from the fallen: ${r.loot.map(i => esc(D.itemDef(i).name)).join(', ')}.</p>` : ''}${r.wear ? `<p class="muted">Your armor lost ${r.wear} durability.</p>` : ''}${r.dead.length ? `<p class="bad">Lost for good: ${r.dead.map(esc).join(', ')}.</p>` : ''}${r.text.map(t => `<p>${esc(t)}</p>`).join('')}
    <button class="btn primary" data-a="closemodal">Continue</button></div></div>`; }
  return '';
}

/* ---------- actions ---------- */
function say(t) { toast = t || ''; }
function act(a, ds, ev) {
  toast = toast && a === 'tab' ? '' : toast;
  switch (a) {
    case 'newgame': cc = { name: 'Captain', head: 'cap', torso: 'tunic', liv: 'red', weapon: 'longsword', company: 'The Free Company' }; setLogoFrom(null); scr = 'create'; toast = ''; break;
    case 'continue': { const s = loadSaved(); if (s) { G = s; setLogoFrom(G.company.logo); scr = 'hub'; tab = 'map'; sel = null; toast = ''; } break; }
    case 'title': scr = 'title'; modal = null; toast = ''; break;
    case 'ltool': ltool = ds.t; break;
    case 'lcol': lcol = ds.c; ltool = ltool === 'erase' ? 'draw' : ltool; break;
    case 'lclear': lg.clearRect(0, 0, 36, 36); applyLogo(); break;
    case 'crest': randomCrest(); return;
    case 'start': {
      G = D.newGame({ name: cc.name.trim() || 'Captain', head: cc.head, torso: cc.torso, liv: cc.liv, weapon: cc.weapon, company: cc.company.trim() || 'The Free Company', logo: logoEmpty() ? null : logoCv.toDataURL() });
      applyLogo(); save(); scr = 'hub'; tab = 'map'; sel = null; toast = 'Welcome, ' + G.char.name + '. Start with the training ground.'; break; }
    case 'tab': tab = ds.t; sel = tab === 'map' ? sel : sel; break;
    case 'menu': modal = { kind: 'menu' }; break;
    case 'closemodal': modal = null; break;
    case 'export': modal = null; exportSave(); return;
    case 'copyexp': { const t = $('exptxt'); t.select(); try { navigator.clipboard.writeText(t.value); } catch (e) { document.execCommand('copy'); } return; }
    case 'importmenu': modal = { kind: 'import' }; break;
    case 'doimport': {
      const txt = ($('imptxt').value || '').trim();
      try { const s = D.deserialize(txt); G = s; setLogoFrom(G.company.logo); save(); scr = 'hub'; tab = 'map'; modal = null; toast = 'Save loaded.'; } catch (e) { $('impmsg').textContent = 'That is not a Project War save.'; return; }
      break; }
    case 'equip': { const r = D.equip(G, ds.slot, ds.iid); say(r.ok ? '' : r.why); save(); break; }
    case 'unequip': { G.equipped.shield = null; save(); break; }
    case 'buy': { const r = D.buy(G, ds.k); say(r.ok ? 'Bought ' + D.itemDef(r.it).name + '.' : r.why); save(); break; }
    case 'sell': { const r = D.sell(G, ds.iid); say(r.ok ? 'Sold for ' + r.gold + ' gold.' : r.why); save(); break; }
    case 'repair': { const r = D.repair(G, ds.iid); say(r.ok ? 'Mended for ' + r.cost + ' gold.' : r.why); save(); break; }
    case 'repairall': { const r = D.repair(G, null); say(r.ok ? 'Mended everything for ' + r.cost + ' gold.' : r.why); save(); break; }
    case 'hire': { const n = G.map.nodes[G.at], rec = D.recruits(G, n.id).find(r => r.rid === ds.rid); const r = D.hire(G, rec, M3.enemyLook); say(r.ok ? r.h.name + ' joins the company.' : r.why); save(); break; }
    case 'dismiss': D.dismiss(G, ds.hid); save(); break;
    case 'slot': slotSel = +ds.i; break;
    case 'setstyle': { const r = D.setSlot(G, slotSel, ds.id); say(r.ok ? '' : r.why); save(); break; }
    case 'unlockall': for (const s of D.allStyles(anims)) D.learnStyle(G, s.id); G.styles.slotCount = D.MAX_SLOTS; say('Every style learned and every slot open (test).'); save(); break;
    case 'loadlib': { try { const n = loadLibrary($('libtxt').value.trim()); say('Library loaded (' + n + ' animations).'); } catch (e) { $('libmsg').textContent = 'That is not a valid animation file.'; return; } break; }
    case 'travel': {
      const r = D.travel(G, +ds.id); sel = null; save();
      if (r.ambush) { const spec = D.battleFor(G, G.at, true, r.danger); modal = { kind: 'ambush', spec, to: G.map.nodes[G.at].name }; }
      else say('You reach ' + G.map.nodes[G.at].name + '. Day ' + G.day + '.');
      break; }
    case 'tutorial': startBattle(D.tutorialBattle()); return;
    case 'camp': { const spec = D.battleFor(G, G.at, false); spec.campId = G.at; modal = { kind: 'precamp', spec }; break; }
    case 'fight': { const spec = modal.spec; modal = null; startBattle(spec); return; }
    case 'bpause': if (battle) battle.paused = !battle.paused; return;
    case 'bretreat': if (battle && !battle.over) { battle.sim.outcome = 'lost'; battle.retreat = true; battle.endAt = battle.sim.t; } return;
    case 'bhint': if (battle) { battle.hint = false; const h = $('bhint'); if (h) h.remove(); } return;
  }
  render();
}
root.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) act(b.dataset.a, b.dataset, e); });
root.addEventListener('input', fieldEvent); root.addEventListener('change', fieldEvent);
function fieldEvent(e) {
  const f = e.target.dataset && e.target.dataset.f;
  if (e.target.id === 'libfile' || e.target.id === 'impfile') { const file = e.target.files[0]; if (file) file.text().then(t => { if (e.target.id === 'libfile') { $('libtxt').value = t; } else { $('imptxt').value = t; } }); return; }
  if (!f) return;
  const v = e.target.value;
  if (scr === 'create') { cc[f === 'weapon' ? 'weapon' : f] = v; if (e.type === 'change' && (e.target.tagName === 'SELECT' || e.target.type === 'radio')) render(); else drawPreview(); return; }
  if (f === 'cname') { G.company.name = v.slice(0, 28) || 'The Free Company'; save(); const c = root.querySelector('.topbar .co'); if (c) c.textContent = G.company.name; }
  if (f === 'cliv') { G.char.liv = v; for (const h of G.hirelings) if (h.look) h.look.liv = v; save(); drawPreview(); }
}

/* ---------- battle ---------- */
function startBattle(spec) {
  const sim = new Sim(CFG, spec.seed); sim.mode = 'battle';
  const d = D.derived(G), hands2 = d.hands === 2, kind = CFG.weapons[d.weapon].kind || 'sword';
  applyCmd(sim, D.playerSet(G));
  const chain = D.chainFor(G, anims), cs = [];
  for (const id of chain) {
    const key = M3.moveKey(id, hands2), mid = key + '|' + kind;
    if (!sim.moves[mid]) { const m = M3.bakeMove(key, { two: hands2, wkind: kind }); if (m) sim.moves[mid] = m; }
    cs.push({ style: id, move: sim.moves[mid] ? mid : null });
  }
  applyCmd(sim, { t: 'set', chainStyles: cs });
  const em = M3.bakeMove('cut1', { role: 'e', two: false, wkind: 'sword', shield: true }); if (em) sim.moves[CFG.enemy.move] = em;
  const tiers = {};
  if (!spec.tutorial) G.hirelings.forEach((h, i) => sim.spawnAlly(Object.assign(D.allySpec(h), { index: i, look: h.look })));
  spec.enemies.forEach((o, i) => { const e = sim.spawn(Object.assign({}, o, { index: i })); tiers[e.id] = o.tier; });
  battle = { sim, spec, tiers, keys: {}, acc: 0, last: 0, paused: false, over: false, endAt: 0, hint: !!spec.tutorial, retreat: false, rain: Array.from({ length: 70 }, (_, i) => [Math.random() * 640, Math.random() * 360, 4 + Math.random() * 3]) };
  scr = 'battle'; modal = null; render(); requestAnimationFrame(battleFrame);
}
const HINTS = ['Walk toward the men (WASD or the arrow keys). You swing on your own once one is within reach.', 'Standing still keeps your chain going; moving or missing breaks it back to your first style.', 'When blades cross mid-swing, the ring closes: press Space or click as it meets the inner ring.', 'Win the training and you learn a second fighting style.'];
function battleHTML() {
  const b = battle, sp = b.spec;
  return `<div class="topbar"><span class="co">${esc(sp.label)}</span><span class="chip">${esc(sp.weather)} · ${esc(sp.time)}</span><span class="chip">Pay <b class="gold">${sp.pay}</b></span><span style="flex:1"></span><button class="btn sm" data-a="bpause">Pause</button><button class="btn sm" data-a="bretreat">${sp.tutorial ? 'Restart' : 'Retreat (counts as a loss)'}</button></div>
  ${b.hint ? `<div class="hint" id="bhint">${HINTS.map(esc).join('<br>')} <button class="btn sm" data-a="bhint">Got it</button></div>` : ''}
  <div class="hud" id="bhud"></div><canvas id="bstage" width="640" height="360" tabindex="0"></canvas>`;
}
function bindBattle() { const c = $('bstage'); if (c) { c.focus(); c.addEventListener('pointerdown', () => { battle.keys.act = true; }); } }
const KMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
window.addEventListener('keydown', e => { if (scr !== 'battle' || !battle) return; if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; if (e.code === 'Space') { battle.keys.act = true; e.preventDefault(); return; } if (e.code === 'KeyP') { battle.paused = !battle.paused; return; } const k = KMAP[e.code]; if (k) { battle.keys[k] = true; e.preventDefault(); } });
window.addEventListener('keyup', e => { if (!battle) return; if (e.code === 'Space') battle.keys.act = false; const k = KMAP[e.code]; if (k) battle.keys[k] = false; });
window.addEventListener('pointerup', () => { if (battle) battle.keys.act = false; });
window.addEventListener('blur', () => { if (battle) battle.keys = {}; });

function battleFrame(ts) {
  const b = battle; if (!b || scr !== 'battle') return;
  const real = Math.min(0.1, b.last ? (ts - b.last) / 1000 : 0); b.last = ts;
  const s = b.sim;
  if (!b.paused && !b.over) {
    b.acc += real;
    while (b.acc >= 1 / 60) {
      const k = b.keys; s.input = { x: (k.r ? 1 : 0) - (k.l ? 1 : 0), y: (k.d ? 1 : 0) - (k.u ? 1 : 0), act: !!k.act };
      s.step(1 / 60); b.acc -= 1 / 60;
      if (s.outcome && !b.endAt) b.endAt = s.t;
    }
    if (s.outcome && s.t - b.endAt > 1.6) { endBattle(); return; }
  }
  drawBattle();
  requestAnimationFrame(battleFrame);
}
function endBattle() {
  const b = battle; b.over = true;
  const kills = (b.sim.events || []).filter(e => e.kind === 'kill' || e.kind === 'dramatic').map(e => b.tiers[e.id]).filter(Boolean);
  const res = { outcome: b.sim.outcome, dur: b.sim.player.dur, fallen: b.sim.fallen.slice(), kills };
  let spec = b.spec, r;
  if (spec.tutorial && res.outcome === 'lost') { r = { won: false, pay: 0, loot: [], lostGold: 0, dead: [], wear: 0, unlocked: [], text: ['The drill goes badly. Catch your breath and try again; nothing is lost.'] }; }
  else r = D.finishBattle(G, spec, res);
  battle = null; save(); scr = 'hub'; tab = 'map'; sel = null; toast = ''; modal = { kind: 'result', r }; render();
}
function drawBattle() {
  const cv = $('bstage'); if (!cv) return; const ctx = cv.getContext('2d'), b = battle, sim = b.sim, p = sim.player, d = D.derived(G), w = CFG.weapons[p.weapon];
  ctx.imageSmoothingEnabled = false; ctx.save();
  if (sim.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 5), Math.round((Math.random() - 0.5) * 3));
  ctx.drawImage(bg, 0, 0);
  const list = [{ y: p.y, k: 'p' }].concat(sim.enemies.map(e => ({ y: e.y - (e.state === 'dying' ? 0.5 : 0), k: 'e', e }))).concat(sim.allies.map(a => ({ y: a.y - (a.state === 'dying' ? 0.5 : 0), k: 'a', a })));
  list.sort((x, y) => x.y - y.y);
  const sh = d.shield;
  for (const it of list) {
    if (it.k === 'p') {
      const st = p.swing && p.swing.style ? p.swing.style : 'cut';
      if (p.hp > 0) drawFigure(ctx, { role: 'p', x: p.x, y: p.y, face: p.face, tier: 'leather', pHead: d.look.head, pBody: d.look.body, pLiv: d.look.liv, pMetal: d.look.metal, broken: p.broken, two: d.hands === 2, wkind: w.kind || 'sword', shield: sh,
        swing: p.swing, moving: p.moving, walkT: p.walkT, t: sim.t, flash: p.flash, flashMax: 0.2, hurt: p.hurt, hurtMax: 0.6, style: st });
      else drawFigure(ctx, { role: 'p', x: p.x, y: p.y, face: p.face, tier: 'leather', pHead: d.look.head, pBody: d.look.body, pLiv: d.look.liv, pMetal: d.look.metal, two: d.hands === 2, wkind: w.kind || 'sword', shield: sh, dead: true, deathT: Math.max(0, sim.t - b.endAt) + 0.01, t: sim.t, flash: 0, swing: null });
    } else if (it.k === 'a') {
      const a = it.a, aw = CFG.weapons[a.weapon], two = CFG.weaponClasses[aw.cls].twoHanded, L = a.look || M3.enemyLook(a.tier, a.lookSeed);
      const swing = a.atk ? { t: a.atk.t, dur: Math.max(0.5, 1.0), dur0: 1.0, hitAt: 0.45, extra: 0 } : null;
      const base = { role: 'p', x: a.x, y: a.y, face: a.face, tier: 'leather', pHead: L.head, pBody: L.body, pLiv: L.liv || d.look.liv, pMetal: L.metal, two, wkind: aw.kind || 'sword', shield: !two, t: sim.t };
      if (a.state === 'dying') drawFigure(ctx, Object.assign(base, { dead: true, deathT: a.deathT, alpha: a.deathT > 1.9 ? Math.max(0, 1 - (a.deathT - 1.9) / 0.7) : 1, flash: 0, swing: null }));
      else drawFigure(ctx, Object.assign(base, { swing, moving: a.moving, walkT: a.walkT, flash: a.flash, flashMax: 0.2, hurt: a.hurt, hurtMax: 0.6, broken: a.broken }));
    } else {
      const e = it.e, L = e._look || (e._look = M3.enemyLook(e.tier, e.lookSeed));
      const common = { role: 'e', x: e.x, y: e.y, z: e.z, face: e.face, tier: e.tier, broken: e.broken, shield: true, pHead: L.head, pBody: L.body, pLiv: L.liv, pMetal: L.metal, t: sim.t };
      if (e.state === 'dying') drawFigure(ctx, Object.assign(common, { alpha: e.deathT > 1.9 ? Math.max(0, 1 - (e.deathT - 1.9) / 0.7) : 1, dead: true, deathT: e.deathT, dramatic: e.dramatic, flash: 0, swing: null }));
      else drawFigure(ctx, Object.assign(common, { swing: e.atk ? { t: e.atk.t, dur: CFG.enemy.atkDur, dur0: CFG.enemy.atkDur, hitAt: CFG.enemy.atkHitAt, extra: 0 } : null, woundedPose: e.wounded > 0, moving: e.moving, walkT: e.walkT, flash: e.flash, flashMax: 0.12, hurt: e.hurt, hurtMax: 0.6 }));
    }
  }
  for (const e of sim.enemies) {
    if (e.state !== 'alive') continue;
    const x = Math.round(e.x), y = Math.round(e.y) - 88;
    ctx.fillStyle = '#14101c'; ctx.fillRect(x - 15, y - 1, 30, 6); ctx.fillStyle = '#d65a4a'; ctx.fillRect(x - 14, y, Math.round(28 * e.hp / e.maxHp), 4);
    if (e.broken) label(ctx, 'ARMOR BREAK', x, y - 4, '#ff9a6a', 9); else if (e.wounded > 0) label(ctx, 'WOUNDED', x, y - 4, '#ffd27a', 9); else if (e.flee) label(ctx, 'FLEEING', x, y - 4, '#9fd0ff', 9);
  }
  for (const a of sim.allies) if (a.state === 'alive') { const x = Math.round(a.x), y = Math.round(a.y) - 88; ctx.fillStyle = '#14101c'; ctx.fillRect(x - 15, y - 1, 30, 6); ctx.fillStyle = '#6fd07a'; ctx.fillRect(x - 14, y, Math.round(28 * a.hp / a.maxHp), 4); label(ctx, a.name.split(' ')[0], x, y - 4, '#cfe8cf', 9); }
  for (const f of sim.fx) { ctx.globalAlpha = Math.max(0, f.life / f.max); ctx.fillStyle = f.col; ctx.fillRect(Math.round(f.x), Math.round(f.y), f.size, f.size); }
  ctx.globalAlpha = 1;
  if (sim.clash) { const k = sim.clash, X = Math.round(k.x), Y = Math.round(k.y - k.h), C = CFG.clash, r = Math.max(1, 7 + 34 * (k.target - k.t) / k.target);
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(X, Y, 7, 0, 7); ctx.stroke(); ctx.strokeStyle = Math.abs(k.t - k.target) <= C.window ? '#ffe27a' : '#e8a040'; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.stroke(); ctx.restore(); }
  for (const t of sim.texts) { ctx.globalAlpha = Math.min(1, t.life / 0.3); label(ctx, t.text, t.x, t.y, t.col, t.size + 2); }
  ctx.globalAlpha = 1;
  label(ctx, 'YOU', p.x, p.y - 88, '#f4ecd8', 10);
  ctx.restore();
  // weather and time of day (looks only, for now)
  const sp = b.spec;
  if (sp.time === 'night') { ctx.fillStyle = 'rgba(8,10,40,.45)'; ctx.fillRect(0, 0, 640, 360); } else if (sp.time === 'dusk') { ctx.fillStyle = 'rgba(190,90,40,.16)'; ctx.fillRect(0, 0, 640, 360); }
  if (sp.weather === 'fog') { ctx.fillStyle = 'rgba(210,215,225,.26)'; ctx.fillRect(0, 0, 640, 360); }
  if (sp.weather === 'rain') { ctx.strokeStyle = 'rgba(170,200,235,.5)'; ctx.lineWidth = 1; for (const r of b.rain) { r[1] += r[2]; r[0] -= 1.5; if (r[1] > 360) { r[1] = -8; r[0] = Math.random() * 660; } ctx.beginPath(); ctx.moveTo(r[0], r[1]); ctx.lineTo(r[0] + 2, r[1] + 8); ctx.stroke(); } }
  if (b.paused) label(ctx, 'PAUSED', 320, 180, '#ffd27a', 20);
  if (sim.outcome) label(ctx, sim.outcome === 'won' ? 'VICTORY' : 'DEFEAT', 320, 110, sim.outcome === 'won' ? '#8fd68a' : '#ff8f7a', 24);
  const hud = $('bhud');
  if (hud) hud.innerHTML = `<div class="u">${esc(G.char.name)} HP ${Math.max(0, p.hp)}/${p.maxHp}<div class="bar"><i style="width:${Math.max(0, 100 * p.hp / p.maxHp)}%"></i></div></div>` +
    `<div class="u">Armor ${p.broken ? '<b class="bad">BROKEN</b>' : p.dur + '/' + p.durMax}<div class="bar arm"><i style="width:${p.durMax ? 100 * p.dur / p.durMax : 0}%"></i></div></div>` +
    sim.allies.map(a => `<div class="u">${esc(a.name.split(' ')[0])} ${a.state === 'alive' ? a.hp + '/' + a.maxHp : '<b class="bad">down</b>'}<div class="bar"><i style="width:${100 * a.hp / a.maxHp}%"></i></div></div>`).join('') +
    `<div class="u">Enemies ${sim.enemies.filter(e => e.state === 'alive').length}</div>`;
}

/* ---------- boot ---------- */
render();
requestAnimationFrame(tickPreview);
