/* ============================================================
   PROJECT WAR · COMBAT TEST  — rendering + menu (browser only)
   Fighters are live 3D models (rig/model3d.js) drawn into the 2D stage.
   ============================================================ */
import M3 from '../rig/model3d.js';
import { CFG, Sim, applyCmd, SIM_VERSION, fitsWindow, minDexForWindow, moveTau, segAt } from './sim.js';
import BUILTIN_ANIMS from './anims.json';
import { initRunUI } from './runui.js';
import { initDiscord } from './discord.js';
import { PartyHost, GuestRun, applySnap } from './party.js';
import { buildOf, resolveStyles } from './run.js';
const DISCORD_CLIENT_ID = typeof __DISCORD_CLIENT_ID__ === 'string' ? __DISCORD_CLIENT_ID__ : '';
const BASE_STYLES = [{ id: 'cut', name: 'Cut', hands: 0 }, { id: 'chop', name: 'Chop', hands: 0 }, { id: 'attack2', name: 'Horizontal sweep', hands: 0 }, { id: 'lunge', name: 'Lunge', hands: 2 }];
{
  const $ = id => document.getElementById(id);
  const cv = $('stage');
  let ctx = cv.getContext('2d');
  const live = new Sim(CFG);
  let runui = null;                                      // the camp and run layer (game/runui.js), set up at boot
  let sim = live;                                       // what is drawn: the live fight, or a replay while one plays
  window.PW = { get sim() { return sim; }, get runui() { return runui; }, live, M3, CFG, get rec() { return rec; },     // console and test handle
    checkReplay() { const s = Sim.fromState(rec.state, clone(rec.cfg), Object.assign({}, rec.moves)); let i = 0; const c = rec.cmds;   // re-run the recording; true if it ends exactly like the live fight
      while (s.stepN < live.stepN) { while (i < c.length && c[i].s <= s.stepN) applyCmd(s, c[i++].c); s.step(1 / 60); }
      const A = s.saveState(), B = live.saveState(); delete A.events; delete B.events; const out = [];
      const diff = (x, y, p) => { if (JSON.stringify(x) === JSON.stringify(y)) return; if (typeof x !== 'object' || !x || !y) { out.push(p + ': ' + JSON.stringify(x) + ' vs ' + JSON.stringify(y)); return; } for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) diff(x[k], y[k], p + '.' + k); };
      diff(A, B, ''); return out.length ? out.slice(0, 8) : true; } };

  /* ---------- recording: every outside change is a command, logged with the step it happened on ---------- */
  let rec = null, snaps = [], pb = null;                 // pb: replay playing
  const clone = o => JSON.parse(JSON.stringify(o));
  function startRec() { rec = { v: SIM_VERSION, cfg: clone(live.cfg), moves: Object.assign({}, live.moves), state: live.saveState(), cmds: [] }; snaps = []; }
  function cmd(c) {
    if (pb) return;                                      // the menu doesn't steer a replay
    if (rec) rec.cmds.push({ s: live.stepN, c: clone(c) });
    applyCmd(live, c);
  }
  const STEP = 1 / 60;
  const FONT = '"Pixelify Sans", monospace';

  /* ---------- background (built once) ---------- */
  const bg = document.createElement('canvas'); bg.width = CFG.W; bg.height = CFG.H;
  (function buildBg() {
    const g = bg.getContext('2d');
    const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    [[0, 60, '#1d1830'], [60, 100, '#2b2140'], [100, 135, '#43294a'], [135, 165, '#5e3350'], [165, 196, '#7e4350']].forEach(b => R(b[2], 0, b[0], 640, b[1] - b[0]));
    g.fillStyle = '#a45a50'; g.beginPath(); g.arc(500, 160, 34, 0, 7); g.fill();
    g.fillStyle = '#f0b66b'; g.beginPath(); g.arc(500, 160, 26, 0, 7); g.fill();
    g.fillStyle = '#2a1f3a'; g.beginPath();
    [[0, 170], [60, 155], [130, 165], [210, 150], [300, 162], [390, 152], [470, 165], [550, 150], [640, 162], [640, 196], [0, 196]].forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.fill();
    R('#1a1426', 45, 150, 50, 46); R('#1a1426', 52, 134, 36, 20);
    g.strokeStyle = '#1a1426'; g.lineWidth = 3; g.beginPath(); g.arc(103, 173, 16, 0, 7); g.stroke();
    R('#1a1426', 545, 131, 32, 65); for (let i = 0; i < 4; i++) R('#1a1426', 545 + i * 9, 125, 6, 7);
    R('#f0b66b', 557, 150, 7, 13);
    R('#4a3d4f', 0, 178, 640, 18);
    for (let i = 0; i < 640; i += 32) R('#4a3d4f', i + 5, 171, 19, 8);
    for (let i = 0; i < 640; i += 28) R('#392e3e', i, 178, 1, 18);
    R('#6a5a70', 0, 178, 640, 1);
    R('#2a2235', 17, 146, 3, 50); g.fillStyle = '#c2413b'; g.beginPath(); g.moveTo(20, 148); g.lineTo(46, 148); g.lineTo(40, 158); g.lineTo(46, 168); g.lineTo(20, 168); g.fill();
    R('#2a2235', 620, 146, 3, 50); g.fillStyle = '#7a63b8'; g.beginPath(); g.moveTo(620, 148); g.lineTo(594, 148); g.lineTo(600, 158); g.lineTo(594, 168); g.lineTo(620, 168); g.fill();
    R('#5a4a42', 0, 196, 640, 164); R('#4f4039', 0, 196, 640, 22);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    [202, 209, 217, 227, 238, 250, 265, 283, 302, 322, 344].forEach(y => { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, 640, 1); });
    for (let i = 0; i < 90; i++) { const y = 200 + rnd() * 150, k = 0.6 + (y - 200) / 150 * 0.9; g.fillStyle = rnd() < 0.55 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.08)'; g.fillRect(Math.round(rnd() * 630), Math.round(y), Math.round(9 * k), Math.round(3 * k)); }
    R('#3d322f', 0, 336, 640, 24);
  })();


  // 3D frame -> two small 2D canvases: the figure, and a black silhouette for the 1px outline.
  // Compositing instead of ctx.filter: one read of the WebGL canvas, and it works where canvas filters are missing.
  const oc = document.createElement('canvas'), sil = document.createElement('canvas');
  function prep3D(cv3, flash) {
    const S = cv3.width; if (oc.width !== S || oc.height !== cv3.height) { oc.width = sil.width = S; oc.height = sil.height = cv3.height; }
    const o = oc.getContext('2d'), s = sil.getContext('2d'), H = cv3.height;
    o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, S, H); o.drawImage(cv3, 0, 0);
    s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, S, H); s.drawImage(oc, 0, 0);
    s.globalCompositeOperation = 'source-in'; s.fillStyle = '#000'; s.fillRect(0, 0, S, H);
    if (flash) { o.globalCompositeOperation = 'source-atop'; o.fillStyle = 'rgba(255,255,255,.72)'; o.fillRect(0, 0, S, H); o.globalCompositeOperation = 'source-over'; }
  }
  /* build the enemy rigs ahead, a few hundred ms apart, only while in camp: building one costs a visible stall, which used to land in the middle of a fight */
  const warm = { q: [], on: false };
  function prewarmEnemies() {
    if (warm.on) return; warm.on = true;
    for (const [tier, broken] of [['leather', false], ['leather', true], ['mail', false], ['plate', false], ['mail', true], ['plate', true]]) for (let v = 0; v < M3.ENEMY_VARIANTS; v++) warm.q.push({ tier, seed: v, broken });      // the broken look (armor break) is its own rig too
    (function step() {
      if (!warm.q.length) { warm.on = false; return; }
      if (!(runui && runui.inCamp()) || runui.modal) return void setTimeout(step, 400);        // not while fighting or with a menu open
      const j = warm.q.shift(), l = M3.enemyLook(j.tier, j.seed);
      try { M3.getRig('e', { tier: j.tier, broken: j.broken, shield: true, pHead: l.head, pBody: l.body, pLiv: l.liv, pMetal: l.metal }); } catch (e) { }
      setTimeout(step, 250);
    })();
  }
  const enemyLook = e => e._look || (e._look = M3.enemyLook(e.tier, e.lookSeed));
  const withLook = (e, f) => { const l = enemyLook(e); f.pHead = l.head; f.pBody = l.body; f.pLiv = l.liv; f.pMetal = l.metal; return f; };
  /* figures that are only standing or walking are drawn at 12 frames a second and reused in between: each fresh 3D frame
     costs a read back from the graphics card, which was most of the frame time in busy fights. Swings, hits, grabs and deaths stay full rate. */
  const FC = new Map(), FC_DT = 1 / 12;
  const sigOf = f => [f.role, f.tier, f.pHead || '', f.pBody || '', f.pLiv || '', f.pMetal || '', f.broken ? 1 : 0, f.two ? 1 : 0, f.wkind || '', f.shield ? 1 : 0, f.moving ? 1 : 0].join('|');
  function drawFigure(f) {
    const id = f.cacheId, calm = id != null && !f.swing && !f.st && !(f.flash > 0) && !(f.hurt > 0) && !f.dead && !f.gx && !f.gv && !f.woundedPose && !(f.z > 0);
    let ent = id != null ? FC.get(id) : null; const sig = calm ? sigOf(f) : '';
    const fresh = !(calm && ent && ent.sig === sig && sim.t - ent.t < FC_DT && sim.t >= ent.t);
    let dx, dy, A, B;
    if (fresh) {
      const rig = M3.pose(f.role, f); if (!rig) return;
      const cv3 = M3.render(rig); dx = -Math.round(M3.ox); dy = -Math.round(M3.oy);
      prep3D(cv3, f.flash > 0); A = oc; B = sil;
      if (calm) {
        if (!ent) { ent = { a: document.createElement('canvas'), b: document.createElement('canvas') }; FC.set(id, ent); }
        if (ent.a.width !== oc.width || ent.a.height !== oc.height) { ent.a.width = ent.b.width = oc.width; ent.a.height = ent.b.height = oc.height; }
        const ga = ent.a.getContext('2d'), gb = ent.b.getContext('2d'); ga.clearRect(0, 0, oc.width, oc.height); gb.clearRect(0, 0, oc.width, oc.height); ga.drawImage(oc, 0, 0); gb.drawImage(sil, 0, 0);
        ent.sig = sig; ent.t = sim.t; ent.dx = dx; ent.dy = dy;
      } else if (ent) ent.t = -1;
    } else { A = ent.a; B = ent.b; dx = ent.dx; dy = ent.dy; }
    ctx.save();
    ctx.globalAlpha = f.alpha == null ? 1 : f.alpha;
    if (!f.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(Math.round(f.x), Math.round(f.y), 17, 4.5, 0, 0, 7); ctx.fill(); }
    ctx.translate(Math.round(f.x), Math.round(f.y - (f.z || 0))); ctx.scale(f.face, 1); ctx.imageSmoothingEnabled = false;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(B, dx + ox, dy + oy);
    ctx.drawImage(A, dx, dy);
    ctx.restore();
  }
  setInterval(() => { const ids = new Set(sim.enemies.map(e => 'e' + e.id).concat(sim.allies.map(a => 'a' + a.id), sim.players.map(q => 'p' + q.pid))); for (const k of FC.keys()) if (!ids.has(k)) FC.delete(k); }, 2000);

  /* guests: the host's updates come 20 times a second; blend each fighter from where it is drawn to where the update puts it */
  let SM = [];
  function smoothFrom() { SM = []; for (const L of [live.players, live.enemies, live.allies]) for (const o of L) SM.push([o, o.x, o.y, o.z || 0]); }
  function smoothTo() {
    const now = performance.now(), keep = new Set([...live.players, ...live.enemies, ...live.allies]);
    for (const [o, x, y, z] of SM) {
      if (!keep.has(o) || Math.abs(o.x - x) > 90 || Math.abs(o.y - y) > 60) { o._sm = null; continue; }
      o._sm = { x0: x, y0: y, z0: z, x1: o.x, y1: o.y, z1: o.z || 0, t: now }; o.x = x; o.y = y; o.z = z;
    }
  }
  function smoothStep(now) {
    for (const L of [live.players, live.enemies, live.allies]) for (const o of L) {
      const m = o._sm; if (!m) continue; const a = Math.min(1, (now - m.t) / 55);
      o.x = m.x0 + (m.x1 - m.x0) * a; o.y = m.y0 + (m.y1 - m.y0) * a; o.z = m.z0 + (m.z1 - m.z0) * a; if (a >= 1) o._sm = null;
    }
  }

  /* the HUD layer: text and windows drawn at the screen's own resolution, so they stay sharp while the 3D fighters stay pixel art */
  const hudCv = $('hud'), hx = hudCv.getContext('2d'); let hudOn = true;
  function hudBegin() {
    const r = hudCv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, w = Math.max(640, Math.min(2560, Math.round(r.width * dpr)));
    if (hudCv.width !== w) { hudCv.width = w; hudCv.height = Math.round(w * 9 / 16); }
    hx.setTransform(1, 0, 0, 1, 0, 0); hx.clearRect(0, 0, hudCv.width, hudCv.height); const k = hudCv.width / CFG.W; hx.setTransform(k, 0, 0, k, 0, 0);
    hx.lineJoin = 'round'; hx.globalAlpha = 1;
  }
  function label(text, x, y, col, size) {
    if (hudOn) { hx.globalAlpha = ctx.globalAlpha; hx.font = (size || 10) + 'px ' + FONT; hx.textAlign = 'center'; hx.lineWidth = 3; hx.strokeStyle = '#14101c'; hx.strokeText(text, x, y); hx.fillStyle = col; hx.fillText(text, x, y); hx.globalAlpha = 1; return; }
    ctx.font = (size || 10) + 'px ' + FONT; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = '#14101c'; ctx.strokeText(text, Math.round(x), Math.round(y));
    ctx.fillStyle = col; ctx.fillText(text, Math.round(x), Math.round(y));
  }

  /* ---------- keyboard and mouse ---------- */
  // Mouse side = facing, left click = light attack, right click = heavy attack, cursor = aim for throws and shots. Keys are rebindable.
  const keys = {}, aim = { x: null, y: null };
  const DEF = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', dash: 'ShiftLeft', block: 'KeyQ', grab: 'KeyG', throw: 'KeyF', slam: 'KeyV', strike: 'KeyR', fire: 'KeyE', jump: 'Space', use: 'KeyT' };
  const NAMES = { up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right', dash: 'Dash (stamina)', block: 'Block (hold) / parry (tap)', grab: 'Grab (hold)', throw: 'Throw', slam: 'Slam', strike: 'Strike', fire: 'Fire shot', jump: 'Jump (click in the air = jump attack)', use: 'Use (walk up to a camp sign)' };
  let binds = Object.assign({}, DEF); try { Object.assign(binds, JSON.parse(localStorage.getItem('pw.binds') || '{}')); } catch (e) { }
  const ARROW = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const norm = c => c.startsWith('Shift') ? 'ShiftLeft' : c;
  const actOf = code => { if (ARROW[code]) return ARROW[code]; code = norm(code); for (const a in binds) if (binds[a] === code) return a; return null; };
  const keyLabel = c => c.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('Space', 'Space');
  let rebinding = null;
  function typing(e) {
    const t = e.target, tag = t && t.tagName;
    if (tag === 'SELECT') return true;
    if (tag === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox') return true;
    return false;
  }
  const setKey = (a, v) => {
    if (a === 'up') keys.u = v; else if (a === 'down') keys.d = v; else if (a === 'left') keys.l = v; else if (a === 'right') keys.r = v;
    else if (a === 'dash') keys.dash = v; else if (a === 'block') keys.block = v; else if (a === 'grab') keys.g = v; else if (a === 'fire') keys.fire = v; else if (a === 'jump') keys.jump = v; else if (a === 'use') { }
    else if (v) keys.fin = a;                                          // throw / slam / strike: the last one pressed
    else if (keys.fin === a) keys.fin = '';
  };
  window.addEventListener('keydown', e => {
    if (rebinding) { e.preventDefault(); if (e.code !== 'Escape') { binds[rebinding] = norm(e.code); try { localStorage.setItem('pw.binds', JSON.stringify(binds)); } catch (x) { } } rebinding = null; drawBinds(); return; }
    if (typing(e)) return;
    if (runui && runui.active && runui.key(e.code, actOf(e.code))) { e.preventDefault(); return; }   // camp stations and menus take the key first
    if (e.code === 'KeyP') { togglePause(); return; }
    const a = actOf(e.code); if (!a) return;
    if (e.target && e.target.type === 'range' && e.code.startsWith('Arrow')) return;
    setKey(a, true); e.preventDefault();
  });
  window.addEventListener('keyup', e => { const a = actOf(e.code); if (a) setKey(a, false); });
  const toSim = ev => { const r = cv.getBoundingClientRect(); aim.x = Math.round((ev.clientX - r.left) / r.width * CFG.W); aim.y = Math.round((ev.clientY - r.top) / r.height * CFG.H); };
  cv.addEventListener('pointermove', toSim);
  cv.addEventListener('pointerdown', ev => { toSim(ev); cv.focus(); if (ev.button === 2) keys.heavy = true; else if (ev.button === 0) keys.act = true; ev.preventDefault(); });
  window.addEventListener('pointerup', ev => { if (ev.button === 2) keys.heavy = false; else if (ev.button === 0) keys.act = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  function drawBinds() {
    const el = $('binds'); if (!el) return;
    el.innerHTML = Object.keys(NAMES).map(a => '<div class="field"><label>' + NAMES[a] + '</label><button class="btn" type="button" data-bind="' + a + '">' + (rebinding === a ? 'press a key...' : keyLabel(binds[a])) + '</button></div>').join('');
    el.querySelectorAll('button').forEach(b => b.onclick = () => { rebinding = b.dataset.bind; drawBinds(); });
  }
  drawBinds();
  const resetBinds = $('bindreset'); if (resetBinds) resetBinds.onclick = () => { binds = Object.assign({}, DEF); try { localStorage.removeItem('pw.binds'); } catch (e) { } rebinding = null; drawBinds(); };
  const curInput = () => ({ x: (keys.r ? 1 : 0) - (keys.l ? 1 : 0), y: (keys.d ? 1 : 0) - (keys.u ? 1 : 0), act: !!keys.act, g: !!keys.g, fin: keys.fin || '', heavy: !!keys.heavy, block: !!keys.block, dash: !!keys.dash, fire: !!keys.fire, jump: !!keys.jump, ax: aim.x, ay: aim.y });
  const sameInput = (a, b) => ['x', 'y', 'act', 'g', 'fin', 'heavy', 'block', 'dash', 'fire', 'jump', 'ax', 'ay'].every(k => (a[k] == null ? null : a[k]) === (b[k] == null ? null : b[k]));
  let delayQ = [];                                                    // input delay (ms) to feel the parry and clash timing at online lag

  /* ---------- menu wiring ---------- */
  let paused = false, timeScale = 1;
  function togglePause() { paused = !paused; $('pause').textContent = paused ? 'Resume (P)' : 'Pause (P)'; $('pause').setAttribute('aria-pressed', paused); }
  const num = (id, d) => { const v = parseFloat($(id).value); return isNaN(v) ? d : v; };

  function tierDefaults() { $('dur').value = CFG.tiers[$('tier').value].dur; }
  function readout() {
    const w = sim.weaponInfo(), p = sim.player;
    const fits = fitsWindow(CFG, p.weapon, p.dex), need = minDexForWindow(CFG, p.weapon);
    const killsIn2 = fits && (w.dmg + w.dmg * CFG.critMult >= CFG.enemy.hp);
    $('readout').innerHTML =
      '<div class="rrow"><span>Swing to swing</span><b>' + w.interval.toFixed(2) + ' s</b></div>' +
      '<div class="rrow"><span>Wounded window</span><b>' + CFG.woundedDur.toFixed(2) + ' s</b></div>' +
      '<div class="rrow"><span>Follow-up lands in window</span><b class="' + (fits ? 'ok' : 'bad') + '">' + (fits ? 'yes' : 'no') + '</b></div>' +
      '<div class="rrow"><span>DEX needed for this weapon</span><b>' + (need == null ? 'never' : need) + '</b></div>' +
      '<div class="rrow"><span>Damage per hit / Wounded crit</span><b>' + w.dmg + ' / ' + w.dmg * CFG.critMult + '</b></div>' +
      '<div class="rrow"><span>Two-hit kill on 9 HP, no armor</span><b class="' + (killsIn2 ? 'ok' : 'bad') + '">' + (killsIn2 ? 'yes' : 'no') + '</b></div>';
  }
  const look = { tier: 'leather', head: '', body: '', liv: '', metal: '', style: 'cut' };
  let roleStyle = {}, libStyles = [];                                               // custom attacks the Animator marked as heavy, dash or counter
  function readLook() {
    const w = live.weaponInfo(), sel = $('atkstyle'), lg = sel.querySelector('option[value=lunge]');
    if (lg) { lg.disabled = !w.twoHanded; if (!w.twoHanded && sel.value === 'lunge') sel.value = 'chop'; }
    const v = sel.value;
    look.tier = $('ptier').value; look.head = $('lkhead').value; look.body = $('lkbody').value; look.liv = $('lkliv').value; look.metal = $('lkmetal').value;
    look.style = ({ horiz: 'attack2', chop: 'chop', lunge: 'lunge', cut: 'cut' })[v] || (v.slice(0, 2) === 'c_' ? v : 'cut');
    // the move the player's swings use, with its weapon path baked from the 3D rig for blade-contact hits
    const key = M3.moveKey(look.style, w.twoHanded), id = key + '|' + (w.kind || 'sword');
    if (!live.moves[id]) { const m = M3.bakeMove(key, { two: w.twoHanded, wkind: w.kind || 'sword' }); if (m) cmd({ t: 'move', id, data: m }); }
    const mv = live.moves[id] ? id : null; if (live.player.move !== mv) cmd({ t: 'set', move: mv });
    const bakeStyle = st => { const k = M3.moveKey(st, w.twoHanded), id2 = k + '|' + (w.kind || 'sword'); if (!live.moves[id2]) { const m = M3.bakeMove(k, { two: w.twoHanded, wkind: w.kind || 'sword' }); if (m) cmd({ t: 'move', id: id2, data: m }); } return live.moves[id2] ? id2 : null; };
    const ks = {};
    const km = { heavy: bakeStyle(roleStyle.heavy || 'chop'), dash: bakeStyle(roleStyle.dash || (w.twoHanded ? 'lunge' : 'cut')), counter: bakeStyle(roleStyle.counter || 'cut'), jump: bakeStyle(roleStyle.jump || 'chop') };   // heavy, dash and counter swings use their own blade paths
    if (runui && runui.active) {                                   // camp and run: the chain and attacks come from the profile's Style station
      const R = runui.R, pr = runui.profile, two = w.twoHanded, hands = two ? 2 : 1, wk = w.kind || 'sword';
      const bk = st => { const k = M3.moveKey(st, two), id2 = k + '|' + wk; if (!live.moves[id2]) { const m = M3.bakeMove(k, { two, wkind: wk }); if (m) cmd({ t: 'move', id: id2, data: m }); } return live.moves[id2] ? id2 : null; };
      const fits = id => id && pr.styles.owned.includes(id) && R.styleFits(runui.styles().find(x => x.id === id) || { hands: 0 }, hands);
      const cs = R.chainFor(pr, runui.styles(), hands).map(id => ({ style: id, move: bk(id) }));
      cmd({ t: 'set', chainStyles: cs });
      for (const r of ['heavy', 'dash', 'counter', 'jump']) { const id = pr.styles.roles[r]; if (fits(id)) { km[r] = bk(id); ks[r] = id; } }
    }
    for (const r of ['heavy', 'dash', 'counter', 'jump']) if (!ks[r] && roleStyle[r] && !(runui && runui.active)) ks[r] = roleStyle[r];
    const jl = libStyles.filter(x => x.juggle).map(x => x.id);
    if (JSON.stringify(km) !== JSON.stringify(live.player.kindMoves)) cmd({ t: 'set', kindMoves: km });
    if (JSON.stringify(ks) !== JSON.stringify(live.player.kindStyles) || JSON.stringify(jl) !== JSON.stringify(live.player.juggle)) cmd({ t: 'set', kindStyles: ks, juggle: jl });
    netSync();
  }
  ['ptier', 'lkhead', 'lkbody', 'lkliv', 'lkmetal', 'atkstyle'].forEach(id => $(id).addEventListener('change', readLook));
  function applySettings() {
    const ov = $('dmgov').value.trim();
    const set = { t: 'set', weapon: $('weapon').value, dex: Math.max(5, num('dex', 5)), dmgOverride: ov === '' ? null : Math.max(1, parseInt(ov, 10) || 1), inv: $('inv').checked };
    if (['weapon', 'dex', 'dmgOverride', 'inv'].some(k => live.player[k] !== set[k])) cmd(set);
    $('dexv').textContent = live.player.dex;
    const nc = clone(CFG);
    nc.woundedThreshold = Math.max(0, num('thr', 3)); nc.woundedChance = Math.min(1, Math.max(0, num('chance', 100) / 100)); nc.woundedDur = Math.max(0.1, num('wdur', 1));
    nc.critOrder = $('critorder').value; nc.fleeSan = num('flee', 3); nc.enemy.san = num('esan', 5);
    if (JSON.stringify(nc) !== JSON.stringify(CFG)) cmd({ t: 'cfg', cfg: nc });
    timeScale = num('ts', 1); $('tsv').textContent = timeScale.toFixed(2) + 'x';
    const sk = { riposte: $('skripo').checked, shove: $('skshove').checked, multi: $('skmulti').checked };
    if (JSON.stringify(sk) !== JSON.stringify(live.player.skills)) cmd({ t: 'set', skills: sk });
    if ($('manual').checked !== !!live.manual) cmd({ t: 'manual', on: $('manual').checked });
    $('delayv').textContent = Math.round(num('delay', 0)) + ' ms';
    readout(); readLook();
  }
  ['weapon', 'dex', 'dmgov', 'inv', 'thr', 'chance', 'wdur', 'critorder', 'flee', 'esan', 'ts', 'manual', 'skripo', 'skshove', 'skmulti', 'delay'].forEach(id => { $(id).addEventListener('input', applySettings); $(id).addEventListener('change', applySettings); });
  $('tier').addEventListener('change', tierDefaults);
  $('spawn').addEventListener('click', () => {
    const n = Math.max(1, Math.min(5, parseInt($('count').value, 10) || 1));
    if (net) { send({ t: 'spawn', tier: $('tier').value, n, ai: $('ai').value }); return; }
    const kd = $('kind').value, o = { dur: Math.max(1, num('dur', 6)), ai: $('ai').value, kind: kd }; if (kd === 'soldier') o.tier = $('tier').value;
    cmd({ t: 'spawn', list: Array.from({ length: n }, () => o), say: 'Spawned ' + n + ' ' + kd + ' (' + $('ai').value + ').' });
  });
  $('squad').addEventListener('click', () => cmd({ t: 'spawn', list: [{ kind: 'fodder', ai: 'advance' }, { kind: 'fodder', ai: 'advance' }, { kind: 'fodder', ai: 'advance' }, { kind: 'fodder', ai: 'advance' }, { kind: 'fodder', ai: 'advance' }, { kind: 'tank', ai: 'advance' }, { kind: 'elite', ai: 'advance' }], say: 'Test squad: 5 fodder, a tank and an elite.' }));
  $('clear').addEventListener('click', () => { if (net) { send({ t: 'clear' }); return; } cmd({ t: 'clear' }); if (!pb) startRec(); });   // a cleared arena starts a fresh recording
  $('heal').addEventListener('click', () => cmd({ t: 'heal' }));
  $('repair').addEventListener('click', () => cmd({ t: 'repair' }));
  $('resetp').addEventListener('click', () => cmd({ t: 'resetp' }));
  $('pause').addEventListener('click', togglePause);

  /* ---------- menu readouts that follow the sim ---------- */
  let logSeen = -1, lastKey = '';
  function renderLast() {
    const r = sim.lastHit;
    if (!r) { $('last').innerHTML = '<p class="muted">No hit yet. Walk up to a man-at-arms and the auto-attack takes over.</p>'; return; }
    const key = JSON.stringify(r); if (key === lastKey) return; lastKey = key;
    const rows = [
      ['Raw damage', r.raw],
      ['Armor (' + r.tier + ')', '-' + r.pct + '%'],
      ['Critical', r.crit ? 'yes, x' + CFG.critMult + ' (' + r.critCause + ')' : 'no'],
      ['Damage dealt', '<b>' + r.dmg + '</b>'],
      ['HP', r.hpBefore + ' > ' + r.hpAfter],
      ['Armor durability', r.durBefore + ' > ' + r.durAfter + ' of ' + r.durMax],
      ['Wounded threshold', r.threshold],
      ['Wounded set', r.woundedSet ? '<b class="ok">yes</b>' : 'no'],
    ];
    $('last').innerHTML = rows.map(x => '<div class="rrow"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join('') +
      (r.notes.length ? '<p class="muted">' + r.notes.join('. ') + '.</p>' : '') +
      (r.dead ? '<p class="muted">' + (r.dramatic ? 'Killed while Wounded: extended player swing, violent death.' : 'Killed normally: enemy crumples.') + '</p>' : '');
  }
  function renderLog() {
    if (logSeen === sim.logVer) return; logSeen = sim.logVer;
    const items = sim.log.slice(-14).reverse();
    $('log').innerHTML = items.map(l => '<li class="k-' + l.kind + '"><i>' + l.t.toFixed(1) + '</i>' + l.text.replace(/</g, '&lt;') + '</li>').join('');
  }
  function renderStatus() {
    const p = sim.player;
    $('status').textContent = fpsTxt + '  ·  ' + (sim.manual ? 'Manual' : 'Auto') + '  ·  stamina ' + Math.round(p.stamina) + '/' + p.staminaMax + (p.blocking ? '  ·  blocking' : '') + (p.swing ? '  ·  ' + (p.swing.kind || 'light') : '') + '  ·  chain ' + p.chain;
  }

  /* ---------- render ---------- */
  function playerState(p) {                                          // which combat pose to draw when nothing else (swing, grab) is playing
    if (p.grab || p.swing) return null;
    if (p.air) return { kind: 'jump', u: Math.min(1, p.jumpT / (2 * CFG.jump.vz / CFG.jump.grav)) };
    if (p.stunT > 0) return { kind: 'stun' };
    if (p.clashT > 0) return { kind: 'clash', u: 1 - p.clashT / (p.clashMax || 0.34) };
    if (p.parryT > 0) return { kind: 'parry', u: 1 - p.parryT / 0.3 };
    if (p.dash) return { kind: 'dash', u: p.dash.t / CFG.dash.dur };
    if (p.blocking) return { kind: 'block', u: p.blockT };
    if (p.shotT > 0) return { kind: 'shoot', u: 1 - p.shotT / 0.25 };
    return null;
  }
  const lookOf = q => ({ tier: q.armorKey || 'leather', head: (q.look && q.look.head) || '', body: (q.look && q.look.body) || '', liv: (q.look && q.look.liv) || '', metal: (q.look && q.look.metal) || '', style: 'cut' });
  const weaponOf = q => { const aw = CFG.weapons[q.weapon] || CFG.weapons.longsword, c = CFG.weaponClasses[aw.cls]; return { twoHanded: c.twoHanded, kind: aw.kind, reach: c.reach }; };
  function render() {
    ctx.imageSmoothingEnabled = false; hudBegin(); hudOn = !(pb && pb.zoom);
    ctx.save();
    if (pb && pb.zoom) { const W = cv.width, H = cv.height, z = 2, zx = Math.max(W / z / 2, Math.min(W - W / z / 2, pb.zoom.x)), zy = Math.max(H / z / 2, Math.min(H - H / z / 2, pb.zoom.y)); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-zx, -zy); }
    if (sim.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 5), Math.round((Math.random() - 0.5) * 3));
    ctx.drawImage(runui && runui.inCamp() ? runui.campBg : bg, 0, 0);
    if (runui && runui.active) runui.drawBack(ctx);
    const p = sim.player, w = sim.weaponInfo();
    const dbg = $('dbg').checked;

    if (dbg) {
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
      [CFG.band.top, CFG.band.bottom].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(640, y + .5); ctx.stroke(); });
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(240,195,90,.16)';
      const x0 = p.face > 0 ? p.x : p.x - (w.reach + 8);
      ctx.fillRect(x0, p.y - CFG.laneTol, w.reach + 8, CFG.laneTol * 2);
    }

    const list = sim.players.map(q => ({ kind: 'p', q, y: q.y })).concat(sim.enemies.map(e => ({ kind: 'e', e, y: e.y - (e.state === 'dying' ? 0.5 : 0) }))).concat(sim.allies.map(a => ({ kind: 'a', a, y: a.y - (a.state === 'dying' ? 0.5 : 0) })));
    list.sort((a, b) => a.y - b.y);
    const target = (!p.swing) ? sim.findTarget(w) : sim.enemies.find(e => e.id === p.swing.target);

    for (const it of list) {
      if (it.kind === 'p') {
        const q = it.q, mine = q === p, lk = mine ? look : lookOf(q), qw = mine ? w : weaponOf(q);
        if (q.rescued) continue;
        if (q.hp <= 0 && (sim.mode === 'battle' || sim.mode === 'run')) {                // downed: lying where they fell (or over a carrier's shoulder) until rescued or the wave ends
          drawFigure({ role: 'p', x: q.x, y: q.y, z: q.carried ? 18 : 0, face: q.face, tier: lk.tier, pHead: lk.head, pBody: lk.body, pLiv: lk.liv, pMetal: lk.metal, two: qw.twoHanded, wkind: qw.kind || 'sword', shield: false, dead: true, deathT: 3, t: sim.t, flash: 0, swing: null, alpha: q.carried ? 0.9 : 0.85, noShadow: !!q.carried });
          continue;
        }
        drawFigure(Object.assign({ role: 'p', x: q.x, y: q.y, z: q.z || 0, face: q.face, tier: lk.tier, pHead: lk.head, pBody: lk.body, pLiv: lk.liv, pMetal: lk.metal, broken: false, two: qw.twoHanded, wkind: qw.kind || 'sword', shield: false,
          swing: q.swing, moving: q.moving, walkT: q.walkT, t: sim.t, flash: q.flash, flashMax: 0.2, hurt: q.hurt, hurtMax: 0.6, st: playerState(q),
          style: q.swing && q.swing.kind && q.swing.kind !== 'light' ? (((mine && !(runui && runui.active)) ? roleStyle : (q.roleStyles || {}))[q.swing.kind] || ({ heavy: 'chop', dash: qw.twoHanded ? 'lunge' : 'cut', counter: 'cut', jump: 'chop' })[q.swing.kind]) : ((q.swing && q.swing.style) || (mine ? look.style : 'cut')) }, M3.grabAtt(sim, qw.twoHanded)));
      } else if (it.kind === 'a') {                                  // a hireling: a fighter on your side
        const a = it.a, aw = CFG.weapons[a.weapon], two = CFG.weaponClasses[aw.cls].twoHanded, L = a.look || M3.enemyLook(a.tier, a.lookSeed);
        const swing = a.atk ? { t: a.atk.t, dur: 1.0, dur0: 1.0, hitAt: 0.45, extra: 0 } : null;
        const base = { role: 'p', x: a.x, y: a.y, face: a.face, tier: 'leather', pHead: L.head, pBody: L.body, pLiv: L.liv || look.liv, pMetal: L.metal, two, wkind: aw.kind || 'sword', shield: !two, t: sim.t };
        if (a.state === 'dying') drawFigure(Object.assign(base, { dead: true, deathT: a.deathT, alpha: a.deathT > 1.9 ? Math.max(0, 1 - (a.deathT - 1.9) / 0.7) : 1, flash: 0, swing: null }));
        else drawFigure(Object.assign(base, { cacheId: 'a' + a.id, swing, moving: a.moving, walkT: a.walkT, flash: a.flash, flashMax: 0.2, hurt: a.hurt, hurtMax: 0.6, broken: a.broken }));
      } else {
        const e = it.e;
        if (e.state === 'dying') {
          const alpha = e.deathT > 1.9 ? Math.max(0, 1 - (e.deathT - 1.9) / 0.7) : 1;
          drawFigure(withLook(e, { role: 'e', x: e.x, y: e.y, z: e.z, face: e.face, tier: e.tier, broken: e.broken, shield: true,
            alpha, dead: true, deathT: e.deathT, dramatic: e.dramatic, t: sim.t, flash: 0, swing: null }));
        } else {
          if (target === e) {
            ctx.strokeStyle = 'rgba(240,195,90,.9)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.ellipse(Math.round(e.x), Math.round(e.y), 22, 6, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
          }
          const aDur = e.atk && e.atk.dur || CFG.enemy.atkDur, aHit = e.atk && e.atk.hitAt || CFG.enemy.atkHitAt;
          const atk = e.atk ? { t: e.atk.t, dur: aDur, dur0: aDur, hitAt: aHit, extra: 0 } : null;
          const est = e.jug ? { kind: 'stun' } : e.atk ? null : e.clashT > 0 ? { kind: 'clash', u: 1 - e.clashT / (e.clashMax || 0.34) } : (e.stun > 0 && !e.down && !e.held && !e.fly) ? { kind: 'stun' } : null;
          const gvw = M3.grabVic(sim, e, w.twoHanded), fe = { role: 'e', x: e.x, y: e.y, z: e.z, face: e.face, tier: e.tier, broken: e.broken, shield: true,
            swing: atk, st: est, style: e.atk && e.atk.heavy ? 'chop' : undefined, woundedPose: e.wounded > 0, moving: e.moving, walkT: e.walkT, t: sim.t, flash: e.flash, flashMax: 0.12, hurt: e.hurt, hurtMax: 0.6 };
          if (gvw) { Object.assign(fe, gvw.fields); fe.x += gvw.dx; fe.swing = null; }
          fe.cacheId = 'e' + e.id; drawFigure(withLook(e, fe));
        }
      }
    }

    // bars + tags
    for (const e of sim.enemies) {
      if (e.state !== 'alive') continue;
      const x = Math.round(e.x), y = Math.round(e.y - (e.z || 0)) - 128;
      ctx.fillStyle = '#14101c'; ctx.fillRect(x - 15, y - 1, 30, 6);
      ctx.fillStyle = '#d65a4a'; ctx.fillRect(x - 14, y, Math.round(28 * e.hp / e.maxHp), 4);
      if (e.durMax > 0) {
        ctx.fillStyle = '#14101c'; ctx.fillRect(x - 15, y + 6, 30, 4);
        ctx.fillStyle = e.broken ? '#5a3a3a' : '#7fb0d9'; ctx.fillRect(x - 14, y + 7, Math.round(28 * e.dur / e.durMax), 2);
      }
      label(e.hp + '/' + e.maxHp, x, y - 4, '#f4ecd8', 9);
      let ty = y - 14;
      if (e.broken) { label('ARMOR BREAK', x, ty, '#ff9a6a', 9); ty -= 10; }
      if (e.wounded > 0) {
        label('WOUNDED ' + e.wounded.toFixed(1), x, ty, '#ffd27a', 9); ty -= 10;
        ctx.fillStyle = '#14101c'; ctx.fillRect(x - 15, ty + 6, 30, 3); ctx.fillStyle = '#ffd27a'; ctx.fillRect(x - 14, ty + 7, Math.round(28 * e.wounded / CFG.woundedDur), 1);
      }
      if (e.flee) label('FLEEING', x, ty, '#9fd0ff', 9);
      if (e.kind && e.kind !== 'soldier') label(e.kind.toUpperCase(), x, y + 16, e.kind === 'elite' ? '#ff9a6a' : '#cfd8e6', 8);
      if (e.atk && e.atk.heavy && !e.atk.hit) { const u = Math.min(1, e.atk.t / (e.atk.hitAt || 1)); ctx.strokeStyle = 'rgba(255,90,74,' + (0.35 + 0.5 * u) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(Math.round(e.x), Math.round(e.y), 26, 8, 0, 0, 7); ctx.stroke(); label('HEAVY: PARRY IT', x, y - 24, '#ff7a6a', 9); }
    }

    for (const a of sim.allies) if (a.state === 'alive') { const x = Math.round(a.x), y = Math.round(a.y) - 128; ctx.fillStyle = '#14101c'; ctx.fillRect(x - 15, y - 1, 30, 6); ctx.fillStyle = '#6fd07a'; ctx.fillRect(x - 14, y, Math.round(28 * a.hp / a.maxHp), 4); label(a.name.split(' ')[0], x, y - 4, '#cfe8cf', 9); }
    // shots, the clash shockwave ring, the cursor
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
    for (const q of sim.proj || []) { const m = Math.sqrt(q.vx * q.vx + q.vy * q.vy) || 1; ctx.beginPath(); ctx.moveTo(Math.round(q.x), Math.round(q.y - 46)); ctx.lineTo(Math.round(q.x - q.vx / m * 9), Math.round(q.y - 46 - q.vy / m * 9)); ctx.stroke(); }
    if (sim.lastClash && sim.t - sim.lastClash.at < 0.28) { const u = (sim.t - sim.lastClash.at) / 0.28; ctx.strokeStyle = 'rgba(255,231,160,' + (1 - u) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(Math.round(sim.lastClash.x), Math.round(p.y), CFG.clash.wave.radius * u, CFG.clash.wave.radius * u * 0.3, 0, 0, 7); ctx.stroke(); }
    if (aim.x != null && !pb) { const X = aim.x, Y = aim.y; ctx.strokeStyle = 'rgba(255,240,200,.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X, Y, 5, 0, 7); ctx.moveTo(X - 9, Y); ctx.lineTo(X - 3, Y); ctx.moveTo(X + 3, Y); ctx.lineTo(X + 9, Y); ctx.moveTo(X, Y - 9); ctx.lineTo(X, Y - 3); ctx.moveTo(X, Y + 3); ctx.lineTo(X, Y + 9); ctx.stroke(); }
    // fx + texts
    for (const f of sim.fx) { ctx.globalAlpha = Math.max(0, f.life / f.max); ctx.fillStyle = f.col; ctx.fillRect(Math.round(f.x), Math.round(f.y), f.size, f.size); }
    ctx.globalAlpha = 1;
    for (const t of sim.texts) { ctx.globalAlpha = Math.min(1, t.life / 0.3); label(t.text, t.x, t.y, t.col, t.size + 2); }
    ctx.globalAlpha = 1;

    // player hp + swing
    if (p.hp > 0 && !p.carry && (sim.mode === 'battle' || sim.mode === 'run') && sim.players.some(q => q !== p && q.hp <= 0 && !q.rescued && !q.carried && Math.abs(q.x - p.x) <= CFG.rescue.reach + 6 && Math.abs(q.y - p.y) <= CFG.laneTol + 6)) label('G: carry them to the edge', p.x, p.y - 140, '#9fd3ff', 9);
    if (p.carry) label('Carry to the edge of the field (G drops)', p.x, p.y - 140, '#9fd3ff', 9);
    for (const q of sim.players) if (q !== p && q.hp <= 0 && !q.rescued && (sim.mode === 'battle' || sim.mode === 'run')) label((q.name || 'Ally') + ' DOWN', q.x, q.y - 40, '#ff9a8a', 9);
    for (const q of sim.players) if (q !== p && (q.hp > 0 || sim.mode === 'arena')) {
      label(q.name || 'Ally', q.x, q.y - 126, '#9fd3ff', 10);
      ctx.fillStyle = '#14101c'; ctx.fillRect(q.x - 15, q.y - 122, 30, 5); ctx.fillStyle = '#6fd07a'; ctx.fillRect(q.x - 14, q.y - 121, Math.round(28 * Math.max(0, q.hp) / q.maxHp), 3);
    }
    const meDown = p.hp <= 0 && (sim.mode === 'battle' || sim.mode === 'run');
    if (meDown && !p.rescued) label(p.carried ? 'YOU: being carried out' : 'YOU ARE DOWN: a partner can carry you out', p.x, p.y - 40, '#ff9a8a', 9);
    if (!meDown) {
        label('YOU', p.x, p.y - 126, '#f4ecd8', 10);
    ctx.fillStyle = '#14101c'; ctx.fillRect(p.x - 15, p.y - 122, 30, 5); ctx.fillStyle = '#6fd07a'; ctx.fillRect(p.x - 14, p.y - 121, Math.round(28 * p.hp / p.maxHp), 3);
    ctx.fillStyle = '#14101c'; ctx.fillRect(p.x - 15, p.y - 117, 30, 4); ctx.fillStyle = p.stunT > 0 ? '#ff7a6a' : '#e8c24a'; ctx.fillRect(p.x - 14, p.y - 116, Math.round(28 * p.stamina / p.staminaMax), 2);
    }
    if (p.blocking && p.blockT <= CFG.stamina.parryWin) { ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(Math.round(p.x), Math.round(p.y), 24, 7, 0, 0, 7); ctx.stroke(); }
    if (p.stunT > 0) label('GUARD BROKEN', p.x, p.y - 132, '#ff9a6a', 9);
    if (dbg && p.swing && p.swing.move && sim.moves[p.swing.move]) {
      const m = sim.moves[p.swing.move], s = p.swing, tau = moveTau(m, s, s.t), g = segAt(m, tau), P = CFG.pxPerM, live = tau >= m.hit.f0 && tau <= m.hit.f1;
      ctx.strokeStyle = live ? '#ff5a4a' : 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(p.x + p.face * g[0] * P, p.y - g[1] * P); ctx.lineTo(p.x + p.face * g[2] * P, p.y - g[3] * P); ctx.stroke();
      ctx.strokeStyle = 'rgba(127,176,217,.6)'; ctx.lineWidth = 1;
      for (const e of sim.enemies) if (e.state === 'alive' && e.atk && sim.moves[CFG.enemy.move]) {
        const em = sim.moves[CFG.enemy.move], es = { t: e.atk.t, dur: CFG.enemy.atkDur, hitAt: CFG.enemy.atkHitAt, extra: 0 }, et = moveTau(em, es, es.t), eg = segAt(em, et);
        ctx.strokeStyle = et >= em.hit.f0 && et <= em.hit.f1 ? '#ff5a4a' : 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(e.x + e.face * eg[0] * P, e.y - eg[1] * P); ctx.lineTo(e.x + e.face * eg[2] * P, e.y - eg[3] * P); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(127,176,217,.6)'; ctx.lineWidth = 1;
      for (const e of sim.enemies) if (e.state === 'alive') ctx.strokeRect(Math.round(e.x - CFG.body.radius * P) + .5, Math.round(e.y - CFG.body.height * P) + .5, Math.round(CFG.body.radius * 2 * P), Math.round(CFG.body.height * P));
    }
    if (dbg && p.swing) {
      const s = p.swing; ctx.fillStyle = '#14101c'; ctx.fillRect(p.x - 20, p.y - 138, 40, 4);
      ctx.fillStyle = '#f0c35a'; ctx.fillRect(p.x - 19, p.y - 137, Math.round(38 * Math.min(1, s.t / s.dur)), 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x - 19 + Math.round(38 * s.hitAt / s.dur), p.y - 139, 1, 6);
    }
    ctx.restore();
    if (runui && runui.active) { runui.drawLabels(hx); runui.drawFront(hx); }
    if (pb) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, 8, 74, 14); label(pb.label + (pb.speed < 1 ? ' ' + pb.speed + 'x' : ''), 45, 19, '#ffd27a', 9); }
  }


  /* ---------- company logo: 36x36 pixel editor; the logo is painted onto tabards, tunics and shields ---------- */
  const LC = $('logo'), lg = LC.getContext('2d'), EC = $('elogo');
  const PALETTE = ['#d9b24a', '#e8e4d8', '#a82424', '#23468c', '#2f6b34', '#1c1c20', '#6b3f8f', '#c2602a', '#7fb0d9', '#8a6a45', '#5a5f68', '#f0d6a0'];
  let ltool = 'draw', lcol = PALETTE[0], ldown = false, lsave = null;
  const sw = $('swatches');
  PALETTE.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.style.cssText = 'width:20px;height:20px;border:1px solid #000;border-radius:3px;padding:0;background:' + c; b.title = c; b.onclick = () => { lcol = c; $('lcolor').value = c; }; sw.appendChild(b); });
  $('lcolor').addEventListener('input', () => { lcol = $('lcolor').value; });
  const setTool = t => { ltool = t; for (const k of ['draw', 'fill', 'erase']) $('ltool-' + k).style.outline = k === t ? '2px solid var(--gold)' : 'none'; };
  ['draw', 'fill', 'erase'].forEach(k => $('ltool-' + k).addEventListener('click', () => setTool(k))); setTool('draw');
  const cell = ev => { const r = LC.getBoundingClientRect(); return [Math.floor((ev.clientX - r.left) / r.width * 36), Math.floor((ev.clientY - r.top) / r.height * 36)]; };
  function flood(x, y, col) {                                        // 4-way fill of the clicked colour
    const id = lg.getImageData(0, 0, 36, 36), d = id.data, at = (x, y) => (y * 36 + x) * 4, t0 = d.slice(at(x, y), at(x, y) + 4);
    const c = col ? [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16), 255] : [0, 0, 0, 0];
    if (t0.every((v, i) => v === c[i])) return;
    const st = [[x, y]];
    while (st.length) { const [px, py] = st.pop(); if (px < 0 || py < 0 || px > 35 || py > 35) continue; const i = at(px, py);
      if (d[i] !== t0[0] || d[i + 1] !== t0[1] || d[i + 2] !== t0[2] || d[i + 3] !== t0[3]) continue;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3]; st.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]); }
    lg.putImageData(id, 0, 0);
  }
  function paint(ev) {
    const [x, y] = cell(ev); if (x < 0 || y < 0 || x > 35 || y > 35) return;
    if (ltool === 'fill') flood(x, y, lcol);
    else if (ltool === 'erase' || ev.buttons === 2) lg.clearRect(x, y, 1, 1);
    else { lg.fillStyle = lcol; lg.fillRect(x, y, 1, 1); }
  }
  const logoEmpty = () => { const d = lg.getImageData(0, 0, 36, 36).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return false; return true; };
  function applyLogo() {
    M3.setLogo('p', $('luse').checked && !logoEmpty() ? LC : null);
    try { localStorage.setItem('pw.logo', LC.toDataURL()); } catch (e) { }
  }
  const later = () => { clearTimeout(lsave); lsave = setTimeout(applyLogo, 250); };
  LC.addEventListener('contextmenu', e => e.preventDefault());
  LC.addEventListener('pointerdown', e => { ldown = true; LC.setPointerCapture(e.pointerId); paint(e); if (ltool === 'fill') later(); });
  LC.addEventListener('pointermove', e => { if (ldown && ltool !== 'fill') paint(e); });
  LC.addEventListener('pointerup', () => { ldown = false; later(); });
  $('lclear').addEventListener('click', () => { lg.clearRect(0, 0, 36, 36); applyLogo(); });
  $('luse').addEventListener('change', applyLogo);
  try { const u = localStorage.getItem('pw.logo'); if (u) { const im = new Image(); im.onload = () => { lg.drawImage(im, 0, 0); applyLogo(); }; im.src = u; } } catch (e) { }

  // generated heraldry for the enemy faction: a field, an ordinary and maybe a charge, metal on colour
  function heraldry(seed, cv) {
    let a = seed >>> 0 || 1; const r = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }, pick = l => l[Math.floor(r() * l.length)];
    const METAL = ['#d9b24a', '#e8e4d8'], COLOUR = ['#a82424', '#23468c', '#2f6b34', '#1c1c20', '#6b3f8f'];
    const flip = r() < .5, f = flip ? pick(METAL) : pick(COLOUR), o = flip ? pick(COLOUR) : pick(METAL);
    const g = cv.getContext('2d'); g.clearRect(0, 0, 36, 36); g.fillStyle = f; g.fillRect(0, 0, 36, 36); g.fillStyle = o;
    const poly = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
    const kind = pick(['pale', 'fess', 'bend', 'chevron', 'cross', 'saltire', 'quarterly', 'perpale', 'perfess', 'bordure']);
    if (kind === 'pale') g.fillRect(13, 0, 10, 36); else if (kind === 'fess') g.fillRect(0, 13, 36, 10);
    else if (kind === 'bend') poly([[0, 0], [9, 0], [36, 27], [36, 36], [27, 36], [0, 9]]);
    else if (kind === 'chevron') poly([[0, 30], [18, 10], [36, 30], [36, 38], [18, 19], [0, 38]]);
    else if (kind === 'cross') { g.fillRect(14, 0, 8, 36); g.fillRect(0, 14, 36, 8); }
    else if (kind === 'saltire') { poly([[0, 0], [6, 0], [36, 30], [36, 36], [30, 36], [0, 6]]); poly([[36, 0], [36, 6], [6, 36], [0, 36], [0, 30], [30, 0]]); }
    else if (kind === 'quarterly') { g.fillRect(18, 0, 18, 18); g.fillRect(0, 18, 18, 18); }
    else if (kind === 'perpale') g.fillRect(18, 0, 18, 36); else if (kind === 'perfess') g.fillRect(0, 18, 36, 18);
    else { g.fillRect(0, 0, 36, 4); g.fillRect(0, 32, 36, 4); g.fillRect(0, 0, 4, 36); g.fillRect(32, 0, 4, 36); }
    if (r() < .55 && !['quarterly', 'perpale', 'perfess', 'cross', 'saltire'].includes(kind)) {   // a charge in the centre, in the field's opposite
      g.fillStyle = flip ? pick(COLOUR) : pick(METAL); const ch = pick(['roundel', 'lozenge', 'mullet']);
      if (ch === 'roundel') { g.beginPath(); g.arc(18, 18, 6, 0, 7); g.fill(); }
      else if (ch === 'lozenge') poly([[18, 10], [25, 18], [18, 26], [11, 18]]);
      else { const p = []; for (let i = 0; i < 10; i++) { const rr = i % 2 ? 3 : 8, an = -Math.PI / 2 + i * Math.PI / 5; p.push([18 + Math.cos(an) * rr, 18 + Math.sin(an) * rr]); } poly(p); }
    }
  }
  let eseed = (Date.now() >>> 0);
  const applyEnemy = () => { heraldry(eseed, EC); M3.setLogo('e', $('euse').checked ? EC : null); };
  $('enew').addEventListener('click', () => { eseed = (Math.imul(eseed, 2654435761) + 12345) >>> 0; applyEnemy(); });
  $('euse').addEventListener('change', applyEnemy);
  applyEnemy();

  /* ---------- online test: a server room owns the fight; this page sends input and draws its snapshots ---------- */
  const net = null;                                                // the old server-run test room is gone; online play is the party (below)
  const send = () => { };
  const netSync = () => { };

  /* ---------- party: one browser hosts the run, the others send input and draw what the host sends (game/party.js, server/party-room.js) ---------- */
  let party = null;
  const roomName = () => ($('netroom').value.trim() || 'test').replace(/[^\w-]/g, '').slice(0, 40);
  function bakeBuild(m, i) {                                     // a remote member's chain and attack moves, baked here because only this page knows the 3D rig
    if (m.p) return; const b = m.build, aw = CFG.weapons[b.weapon]; if (!aw) return;
    const two = CFG.weaponClasses[aw.cls].twoHanded, wk = aw.kind || 'sword', rs = resolveStyles(b.styles, BASE_STYLES.concat(libStyles), two ? 2 : 1);
    const bk = st => { const k = M3.moveKey(st, two), id = k + '|' + wk; if (!live.moves[id]) { const mv = M3.bakeMove(k, { two, wkind: wk }); if (mv) cmd({ t: 'move', id, data: mv }); } return live.moves[id] ? id : null; };
    cmd({ t: 'set', p: i, juggle: libStyles.filter(x => x.juggle).map(x => x.id), kindStyles: Object.assign({}, rs.roles), chainStyles: rs.chain.map(id => ({ style: id, move: bk(id) })), kindMoves: { heavy: bk(rs.roles.heavy || 'chop'), dash: bk(rs.roles.dash || (two ? 'lunge' : 'cut')), counter: bk(rs.roles.counter || 'cut'), jump: bk(rs.roles.jump || 'chop') }, move: bk('cut') });
  }
  function partyEnd(why) {
    if (!party) return; const was = party; party = null; live.textOut = null;
    if (was.g && was.prev) { runui.setRun(was.prev); runui.run.enterCamp(); }
    else if (was.h) for (const m of runui.run.members.slice()) runui.run.removeMember(m.pid);
    $('netgo').textContent = 'Connect'; $('netmsg').textContent = why || 'Offline: this page runs the fight itself.';
  }
  function netConnect() {
    if (party) { party.ws.close(); return; }
    const base = $('netbase').value.trim().replace(/\/+$/, ''), room = roomName();
    let ws; try { ws = new WebSocket(base.replace(/^http/, 'ws') + '/party/' + room); } catch (e) { $('netmsg').textContent = 'Bad server address.'; return; }
    const out = m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    party = { ws, id: null, h: null, g: null, prev: null, lastIn: '', inAt: 0 }; $('netgo').textContent = 'Disconnect'; $('netmsg').textContent = 'Connecting...';
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; } const P = party; if (!P) return;
      if (m.t === 'hello') {
        P.id = m.id;
        if (m.host) { runui.run.hooks.build = bakeBuild; P.h = new PartyHost({ sim: live, run: runui.run, send: (to, x) => out(to ? Object.assign({ to }, x) : x), selfId: m.id }); $('netmsg').textContent = 'Room ' + room + ': you are hosting. Others join the same room.'; }
        else { P.prev = runui.run; P.g = new GuestRun(live, runui.profile, out, { result: () => runui.afterResult() }); P.g.me.pid = m.id; runui.setRun(P.g); out({ t: 'join', build: buildOf(runui.profile) }); $('netmsg').textContent = 'Room ' + room + ': you joined the host\'s camp.'; }
      } else if (m.t === 'peer-join' && P.h) P.h.onJoin(m.id);
      else if (m.t === 'peer-leave' && P.h) P.h.onLeave(m.id);
      else if (P.h && m.from) P.h.onMsg(m.from, m);
      else if (P.g && m.t === 'snap') { if (typeof m.ping === 'number') out({ t: 'pong', k: m.ping }); smoothFrom(); applySnap(live, m, P.id); smoothTo(); P.g.onSnap(m, P.id); }
      else if (P.g && m.t === 'result') P.g.onResult(m.res);
    };
    ws.onclose = () => partyEnd(party && party.g ? 'The host left. Back in your own camp.' : null);
    ws.onerror = () => { $('netmsg').textContent = 'Could not reach the server.'; };
  }
  $('netgo').addEventListener('click', netConnect);

  /* ---------- replays and kill cams ---------- */
  function pbStep() { const c = pb.cmds; while (pb.i < c.length && c[pb.i].s <= pb.sim.stepN) applyCmd(pb.sim, c[pb.i++].c); pb.sim.step(STEP); }
  function play(state, cfg, moves, cmds, from, end, speed, zoom, label) {
    const s = Sim.fromState(state, clone(cfg), Object.assign({}, moves));
    pb = { sim: s, cmds, i: from, end, speed, zoom, acc: 0, label };
    while (pb.i < cmds.length && cmds[pb.i].s < state.stepN) pb.i++;
    sim = s; $('rstop').disabled = false;
  }
  function fastForward(to) { while (pb.sim.stepN < to) pbStep(); pb.sim.fx = []; pb.sim.texts = []; }
  function stopReplay() { pb = null; sim = live; $('rstop').disabled = true; }
  function killCam(ev) {                                       // from the last save at least 3 s before the kill: re-run it, then show it slowed and zoomed
    if (!rec) return;
    const from = Math.max(0, ev.step - 90), sn = [...snaps].reverse().find(x => x.step <= from);
    const base = sn || { state: rec.state, cfg: rec.cfg, moves: rec.moves, at: 0 };
    if (base.state.stepN > ev.step) return;
    play(base.state, base.cfg, Object.assign({}, rec.moves, base.moves, live.moves), rec.cmds, base.at, ev.step + 90, 0.5, { x: ev.x, y: ev.y - 40 }, 'KILL CAM');
    fastForward(from);
  }
  function refreshKills() {
    const ks = live.events.filter(e => e.kind === 'dramatic' || e.kind === 'kill').slice(-6).reverse(), sel = $('rkills'), key = ks.map(k => k.step).join();
    if (sel.dataset.k === key) return; sel.dataset.k = key;
    sel.innerHTML = ks.length ? ks.map((k, i) => '<option value="' + i + '">' + (k.kind === 'dramatic' ? 'Dramatic kill' : 'Kill') + ' at ' + (k.step / 60).toFixed(1) + ' s</option>').join('') : '<option>No kills yet</option>';
    sel._ks = ks;
  }
  setInterval(refreshKills, 500);
  $('rcam').addEventListener('click', () => { const ks = $('rkills')._ks || []; const k = ks[+$('rkills').value || 0]; if (k) killCam(k); });
  $('rwatch').addEventListener('click', () => { if (rec) play(rec.state, rec.cfg, rec.moves, rec.cmds, 0, live.stepN, 1, null, 'REPLAY'); });
  $('rstop').addEventListener('click', stopReplay);
  $('rsave').addEventListener('click', () => {
    if (!rec) return;
    const data = JSON.stringify(Object.assign({}, rec, { end: live.stepN, game: 'project-war' }));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = 'project-war-replay-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json'; document.body.appendChild(a); a.click(); a.remove();
    $('rmsg').textContent = 'Saved ' + (data.length / 1024).toFixed(0) + ' KB (' + ((live.stepN - rec.state.stepN) / 60).toFixed(0) + ' s of fight).';
  });
  $('rload').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const r = JSON.parse(await f.text()); if (r.game !== 'project-war') throw new Error('not a Project War replay');
      $('rmsg').textContent = r.v !== SIM_VERSION ? 'Made under rules v' + r.v + ' (this is v' + SIM_VERSION + '): it may play out differently.' : 'Playing the loaded replay.';
      play(r.state, r.cfg, r.moves, r.cmds, 0, r.end, 1, null, 'REPLAY');
    } catch (e) { $('rmsg').textContent = 'Could not load: ' + e.message; }
    ev.target.value = '';
  });

  /* ---------- loop ---------- */
  let last = performance.now(), acc = 0, fpsN = 0, fpsT = performance.now(), fpsTxt = '';
  function frame(now) {
    const real = Math.min(0.05, (now - last) / 1000); last = now;
    fpsN++; if (now - fpsT >= 1000) { fpsTxt = Math.round(fpsN * 1000 / (now - fpsT)) + ' fps · ' + (1 + sim.enemies.length) + ' fighters drawn'; fpsN = 0; fpsT = now; }   // measure the live 3D cost on your own machine
    if (party && party.g) {                                      // guest: the host steps the fight; send input when it changes (and now and then) and draw the snapshots
      const inp = curInput(), k = JSON.stringify(inp);
      if (party.ws.readyState === 1 && (k !== party.lastIn || now - party.inAt > 200)) { party.lastIn = k; party.inAt = now; party.ws.send(JSON.stringify({ t: 'in', i: inp })); }
      for (const t of sim.texts) t.life -= real; sim.texts = sim.texts.filter(t => t.life > 0);
      for (const f of sim.fx) f.life -= real; sim.fx = sim.fx.filter(f => f.life > 0);
      smoothStep(now); if (runui && runui.active) runui.update(real);
    } else if (pb) {                                             // a replay or kill cam is playing
      pb.acc += real * pb.speed;
      while (pb.acc >= STEP && pb.sim.stepN < pb.end) { pbStep(); pb.acc -= STEP; }
      if (pb.sim.stepN >= pb.end) stopReplay();
    } else if (!paused) {
      acc += real * timeScale;
      while (acc >= STEP) {
        const want = curInput(), dsteps = Math.round(num('delay', 0) / (1000 / 60));
        let inp = want;
        if (dsteps > 0) { delayQ.push({ s: live.stepN + dsteps, inp: want }); inp = live.input; while (delayQ.length && delayQ[0].s <= live.stepN) inp = delayQ.shift().inp; } else delayQ.length = 0;
        if (!sameInput(inp, live.input)) cmd(Object.assign({ t: 'input' }, inp));
        live.step(STEP); acc -= STEP; if (runui && runui.active) runui.update(STEP); if (party && party.h) party.h.afterStep();
        if (rec && live.stepN % 300 === 0) { snaps.push({ step: live.stepN, state: live.saveState(), cfg: clone(live.cfg), moves: Object.assign({}, live.moves), at: rec.cmds.length }); if (snaps.length > 8) snaps.shift(); }
      }
    }
    render(); renderLog(); renderLast(); renderStatus();
    requestAnimationFrame(frame);
  }


  /* ---------- animation library made in the Animator ---------- */
  // the four attacks made in the Animator so far (game/anims.json); a loaded library adds to or replaces these by id

  function loadLibrary(txt, quiet) {
    try {
      const o = JSON.parse(txt), user = o.anims || [o];
      const arr = BUILTIN_ANIMS.filter(b => !user.some(u => u.id === b.id)).concat(user);
      M3.clearCustom(); for (const k in sim.moves) if (k.slice(0, 2) === 'c_') delete sim.moves[k];
      const sel = $('atkstyle'); sel.querySelectorAll('option[data-custom]').forEach(x => x.remove());
      const info = []; let first = null; roleStyle = {}; libStyles = [];
      for (const x of arr) {
        if (!x.keys || !x.keys.length) continue;
        const two = x.load ? x.load === '2' : !!x.two, typ = x.type || 'attack';
        if (!M3.registerAnim({ id: x.id || 'legacy', type: typ, two, contact: x.contact, loop: x.loop, len: x.len, end: x.end, keys: x.keys, hit: x.hit, vm: x.vm })) continue;
        if (typ === 'attack') libStyles.push({ id: 'c_' + (x.id || 'legacy'), name: (x.name || 'Custom') + (x.juggle ? ' [juggle]' : ''), hands: two ? 2 : 1, custom: true, juggle: !!x.juggle });
        if (typ === 'attack' && x.role) { roleStyle[x.role] = 'c_' + (x.id || 'legacy'); info.push((x.name || 'attack') + ' [' + x.role + ' attack]'); continue; }
        if (typ === 'attack') {
          const op = document.createElement('option'); op.value = 'c_' + (x.id || 'legacy'); op.dataset.custom = 1;
          op.textContent = 'Custom: ' + (x.name || 'attack') + (two ? ' (2H)' : ' (1H)'); sel.appendChild(op); first = first || op.value;
        }
        info.push((x.name || typ) + ' [' + typ + (two ? ', 2H' : ', 1H') + ']');
      }
      if (!info.length) throw new Error('empty');
      try { localStorage.setItem('pwlib2', txt); } catch (e) { }
      $('customjson').value = txt;
      $('custommsg').textContent = 'Loaded: ' + info.join(', ') + '. Idle, walk, damaged, dying and falling animations apply to every 1H or 2H fighter automatically. Attacks appear in the Attack style list.';
      if (first && !quiet) sel.value = first;
      if (typeof readLook === 'function') try { readLook(); } catch (e) { }
      if (!quiet) sim.say('info', 'Animation library loaded (' + info.length + ').');
      return first;
    } catch (e) { $('custommsg').textContent = 'That is not a valid animation file.'; return null; }
  }
  $('customload').onclick = () => loadLibrary($('customjson').value.trim());
  $('customfile').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => loadLibrary(t.trim())); };
  { let saved = null; try { saved = localStorage.getItem('pwlib2'); } catch (e) { } const f0 = loadLibrary(saved || '{"anims":[]}', true); if (f0) $('atkstyle').value = f0; }

  /* ---------- boot (keeps menu values across a republish) ---------- */
  const IDS = ['ptier', 'lkhead', 'lkbody', 'lkliv', 'lkmetal', 'atkstyle', 'weapon', 'dex', 'dmgov', 'thr', 'chance', 'wdur', 'critorder', 'flee', 'esan', 'ts', 'tier', 'dur', 'ai', 'count', 'kind', 'delay'];
  { const P = M3.parts || null, fill = (id, list, none) => { const e = $(id); if (!e || !P) return; e.innerHTML = '<option value="">' + none + '</option>' + list.map(x => '<option value="' + x[0] + '">' + x[1] + '</option>').join(''); };
    if (P && P.presets) { const s = $('ptier'); s.innerHTML = P.presets.map(x => '<option value="' + x[0] + '">' + x[1] + '</option>').join(''); }
    fill('lkhead', P ? P.heads : [], 'from armor'); fill('lkbody', P ? P.bodies : [], 'from armor'); fill('lkliv', P ? P.liveries : [], 'from armor'); fill('lkmetal', P ? P.metals : [], 'from armor'); }
  function boot(saved) {
    saved = saved || {};
    startRec();
    { const m = M3.bakeMove('cut1', { role: 'e', two: false, wkind: 'sword', shield: true }); if (m) cmd({ t: 'move', id: CFG.enemy.move, data: m }); }   // enemy swing path
    IDS.forEach(id => { if (saved[id] != null) $(id).value = saved[id]; });
    if (saved.inv != null) $('inv').checked = !!saved.inv;
    ['manual', 'skripo', 'skshove', 'skmulti'].forEach(id => { if (saved[id] != null) $(id).checked = !!saved[id]; });
    if (saved.dbg != null) $('dbg').checked = !!saved.dbg;
    if (saved.dur == null) tierDefaults();
    applySettings();
    try { if (saved.atkstyle && saved.atkstyle.slice(0, 2) === 'c_') $('atkstyle').value = saved.atkstyle; } catch (e) { }
    cmd({ t: 'say', text: 'Manual combat: mouse aims and attacks, Q blocks, Shift dashes, E fires, G grabs.' });
    cmd({ t: 'spawn', list: [{ tier: 'leather', dur: CFG.tiers.leather.dur, ai: 'stand' }] });
    const clearKeys = () => { for (const k in keys) keys[k] = k === 'fin' ? '' : false; };
    runui = initRunUI({ $, live, FONT, readLook, lookOptions: tiers => { const pools = (tiers || ['leather', 'mail', 'plate']).map(t => M3.rankPools[t]).filter(Boolean), ok = (k, v) => !v || pools.some(p => p[k].includes(v));      // only the head, body and metal pieces of the armor tiers you may use
      return Object.fromEntries([['head', 'lkhead', 'heads'], ['body', 'lkbody', 'bodies'], ['liv', 'lkliv', null], ['metal', 'lkmetal', 'metals']].map(([k, id, pk]) => [k, [...$(id).options].filter(o => !pk || ok(pk, o.value)).map(o => ({ v: o.value, l: o.textContent }))])); }, styles: () => BASE_STYLES.concat(libStyles), hands: () => live.weaponInfo().twoHanded ? 2 : 1, stopRec: () => { rec = null; snaps = []; }, clearKeys, focusStage: () => cv.focus(),
      afterLeave: () => { cmd({ t: 'set', chainStyles: null }); startRec(); cmd({ t: 'manual', on: true }); cmd({ t: 'spawn', list: [{ tier: 'leather', dur: CFG.tiers.leather.dur, ai: 'stand' }] }); applySettings(); } });
    // Discord Activity: when this page runs inside Discord, sign in, use the instance as the room, and keep the Rich Presence line current
    initDiscord({ clientId: DISCORD_CLIENT_ID, onError: m => sim.say('info', 'Discord: ' + m) }).then(d => {
      if (!d) return; window.PW.discord = d;
      $('netroom').value = d.roomName; $('netbase').value = d.wsBase;
      sim.say('info', 'Discord: signed in as ' + d.name + '.'); if (!party) netConnect();
      setInterval(() => { const r = runui.run; d.setPresence(r.phase === 'camp' ? 'In camp' : r.phase === 'dead' ? 'Fell in the field' : 'Wave ' + r.wave, runui.profile.name + ' · Lv ' + runui.profile.level, performance.now() / 1000); }, 2000);
    });
    const setMode = m => {
      document.body.classList.toggle('runmode', m === 'run'); $('mRun').setAttribute('aria-pressed', m === 'run'); $('mTest').setAttribute('aria-pressed', m !== 'run');
      if (m === 'run') runui.enter(); else if (runui.active) runui.leave();
      try { localStorage.setItem('pw.mode', m); } catch (e) { }
    };
    $('mRun').onclick = () => setMode('run'); $('mTest').onclick = () => setMode('test');
    let mode = 'run'; try { mode = localStorage.getItem('pw.mode') || 'run'; } catch (e) { }
    setMode(mode);
    prewarmEnemies();
    requestAnimationFrame(frame);
  }
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => { const o = {}; IDS.forEach(id => o[id] = $(id).value); o.inv = $('inv').checked; o.dbg = $('dbg').checked; ['manual', 'skripo', 'skshove'].forEach(id => o[id] = $(id).checked); return o; }); } catch (e) { }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
}
