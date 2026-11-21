/* ============================================================
   PROJECT WAR · COMBAT TEST  — rendering + menu (browser only)
   Fighters are live 3D models (rig/model3d.js) drawn into the 2D stage.
   ============================================================ */
import M3 from '../rig/model3d.js';
import { CFG, Sim, applyCmd, SIM_VERSION, fitsWindow, minDexForWindow, moveTau, segAt } from './sim.js';
import BUILTIN_ANIMS from './anims.json';
import { applySnapshot } from '../server/protocol.js';
{
  const $ = id => document.getElementById(id);
  const cv = $('stage');
  let ctx = cv.getContext('2d');
  const live = new Sim(CFG);
  let sim = live;                                       // what is drawn: the live fight, or a replay while one plays
  window.PW = { get sim() { return sim; }, live, M3, CFG, get rec() { return rec; },     // console and test handle
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
  const enemyLook = e => e._look || (e._look = M3.enemyLook(e.tier, e.lookSeed));
  const withLook = (e, f) => { const l = enemyLook(e); f.pHead = l.head; f.pBody = l.body; f.pLiv = l.liv; f.pMetal = l.metal; return f; };
  function drawFigure(f) {
    const rig = M3.pose(f.role, f); if (!rig) return;
    ctx.save();
    ctx.globalAlpha = f.alpha == null ? 1 : f.alpha;
    if (!f.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(Math.round(f.x), Math.round(f.y), 17, 4.5, 0, 0, 7); ctx.fill(); }
    const cv3 = M3.render(rig);
    ctx.translate(Math.round(f.x), Math.round(f.y - (f.z || 0))); ctx.scale(f.face, 1); ctx.imageSmoothingEnabled = false;
    const dx = -Math.round(M3.ox), dy = -Math.round(M3.oy);
    prep3D(cv3, f.flash > 0);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(sil, dx + ox, dy + oy);
    ctx.drawImage(oc, dx, dy);
    ctx.restore();
  }

  function label(text, x, y, col, size) {
    ctx.font = (size || 10) + 'px ' + FONT; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = '#14101c'; ctx.strokeText(text, Math.round(x), Math.round(y));
    ctx.fillStyle = col; ctx.fillText(text, Math.round(x), Math.round(y));
  }

  /* ---------- keyboard ---------- */
  const keys = {};
  const MAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  function typing(e) {
    const t = e.target, tag = t && t.tagName;
    if (tag === 'SELECT') return true;
    if (tag === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox') return true;
    return false;
  }
  window.addEventListener('keydown', e => {
    if (typing(e)) return;
    if (e.code === 'KeyP') { togglePause(); return; }
    if (e.code === 'Space') { keys.act = true; e.preventDefault(); return; }    // Clash press
    const k = MAP[e.code]; if (!k) return;
    if (e.target && e.target.type === 'range' && e.code.startsWith('Arrow')) return;
    keys[k] = true; e.preventDefault();
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space') keys.act = false; const k = MAP[e.code]; if (k) keys[k] = false; });
  cv.addEventListener('pointerdown', () => { keys.act = true; }); window.addEventListener('pointerup', () => { keys.act = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  cv.addEventListener('pointerdown', () => cv.focus());

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
    readout(); readLook();
  }
  ['weapon', 'dex', 'dmgov', 'inv', 'thr', 'chance', 'wdur', 'critorder', 'flee', 'esan', 'ts'].forEach(id => { $(id).addEventListener('input', applySettings); $(id).addEventListener('change', applySettings); });
  $('tier').addEventListener('change', tierDefaults);
  $('spawn').addEventListener('click', () => {
    const n = Math.max(1, Math.min(5, parseInt($('count').value, 10) || 1));
    if (net) { send({ t: 'spawn', tier: $('tier').value, n, ai: $('ai').value }); return; }
    const o = { tier: $('tier').value, dur: Math.max(1, num('dur', 6)), ai: $('ai').value };
    cmd({ t: 'spawn', list: Array.from({ length: n }, () => o), say: 'Spawned ' + n + ' ' + CFG.tiers[$('tier').value].label + ' man-at-arms (' + $('ai').value + ').' });
  });
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
    $('status').textContent = 'Chain step ' + (p.chain + 1) + (p.swing ? '  ·  swinging' : '') + (sim.slow > 0 ? '  ·  slow-mo' : '');
  }

  /* ---------- render ---------- */
  function render() {
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (pb && pb.zoom) { const W = cv.width, H = cv.height, z = 2, zx = Math.max(W / z / 2, Math.min(W - W / z / 2, pb.zoom.x)), zy = Math.max(H / z / 2, Math.min(H - H / z / 2, pb.zoom.y)); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-zx, -zy); }
    if (sim.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 5), Math.round((Math.random() - 0.5) * 3));
    ctx.drawImage(bg, 0, 0);
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

    const list = [{ kind: 'p', y: p.y }].concat(sim.enemies.map(e => ({ kind: 'e', e, y: e.y - (e.state === 'dying' ? 0.5 : 0) })));
    list.sort((a, b) => a.y - b.y);
    const target = (!p.swing) ? sim.findTarget(w) : sim.enemies.find(e => e.id === p.swing.target);

    for (const it of list) {
      if (it.kind === 'p') {
        drawFigure({ role: 'p', x: p.x, y: p.y, face: p.face, tier: look.tier, pHead: look.head, pBody: look.body, pLiv: look.liv, pMetal: look.metal, broken: false, two: w.twoHanded, wkind: w.kind || 'sword', shield: false,
          swing: p.swing, moving: p.moving, walkT: p.walkT, t: sim.t, flash: p.flash, flashMax: 0.2, style: look.style });
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
          const atk = e.atk ? { t: e.atk.t, dur: CFG.enemy.atkDur, dur0: CFG.enemy.atkDur, hitAt: CFG.enemy.atkHitAt, extra: 0 } : null;
          drawFigure(withLook(e, { role: 'e', x: e.x, y: e.y, face: e.face, tier: e.tier, broken: e.broken, shield: true,
            swing: atk, woundedPose: e.wounded > 0, moving: e.moving, walkT: e.walkT, t: sim.t, flash: e.flash, flashMax: 0.12 }));
        }
      }
    }

    // bars + tags
    for (const e of sim.enemies) {
      if (e.state !== 'alive') continue;
      const x = Math.round(e.x), y = Math.round(e.y) - 88;
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
    }

    // fx + texts
    for (const f of sim.fx) { ctx.globalAlpha = Math.max(0, f.life / f.max); ctx.fillStyle = f.col; ctx.fillRect(Math.round(f.x), Math.round(f.y), f.size, f.size); }
    ctx.globalAlpha = 1;
    if (sim.clash) {                                               // Clash: the ring closes on the inner ring; press as they meet
      const k = sim.clash, X = Math.round(k.x), Y = Math.round(k.y - k.h), C = CFG.clash, r = Math.max(1, 7 + 34 * (k.target - k.t) / k.target);
      ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(X, Y, 7, 0, 7); ctx.stroke();
      ctx.strokeStyle = Math.abs(k.t - k.target) <= C.window ? '#ffe27a' : '#e8a040'; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.stroke(); ctx.restore();
    }
    for (const t of sim.texts) { ctx.globalAlpha = Math.min(1, t.life / 0.3); label(t.text, t.x, t.y, t.col, t.size + 2); }
    ctx.globalAlpha = 1;

    // player hp + swing
    label('YOU', p.x, p.y - 88, '#f4ecd8', 10);
    ctx.fillStyle = '#14101c'; ctx.fillRect(p.x - 15, p.y - 84, 30, 5); ctx.fillStyle = '#6fd07a'; ctx.fillRect(p.x - 14, p.y - 83, Math.round(28 * p.hp / p.maxHp), 3);
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
      const s = p.swing; ctx.fillStyle = '#14101c'; ctx.fillRect(p.x - 20, p.y - 100, 40, 4);
      ctx.fillStyle = '#f0c35a'; ctx.fillRect(p.x - 19, p.y - 99, Math.round(38 * Math.min(1, s.t / s.dur)), 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x - 19 + Math.round(38 * s.hitAt / s.dur), p.y - 101, 1, 6);
    }
    ctx.restore();
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
  let net = null;
  const send = m => { if (net && net.ws.readyState === 1 && net.role === 'player') net.ws.send(JSON.stringify(m)); };
  function netSync() {                                           // weapon, DEX and the move (with its baked blade path) to the room
    if (!net) return; const p = sim.player;
    for (const id in sim.moves) if (!net.sentMoves.has(id)) { send({ t: 'move', id, data: sim.moves[id] }); net.sentMoves.add(id); }   // player and enemy blade paths
    send({ t: 'set', weapon: p.weapon, dex: p.dex, move: p.move });
  }
  function netConnect() {
    if (net) { net.ws.close(); return; }
    const base = $('netbase').value.trim().replace(/\/+$/, ''), room = ($('netroom').value.trim() || 'test').replace(/[^\w-]/g, '').slice(0, 40);
    let ws; try { ws = new WebSocket(base.replace(/^http/, 'ws') + '/room/' + room); } catch (e) { $('netmsg').textContent = 'Bad server address.'; return; }
    net = { ws, role: null, sentMoves: new Set(), lastIn: '' }; $('netgo').textContent = 'Disconnect'; $('netmsg').textContent = 'Connecting...';
    ws.onmessage = ev => { const m = JSON.parse(ev.data);
      if (m.t === 'hello') { net.role = m.role; sim.enemies = []; sim.texts = []; sim.fx = []; $('netmsg').textContent = 'Room ' + room + ': you are the ' + m.role + '.'; netSync(); }
      else if (m.t === 'state') applySnapshot(sim, m);
      else if (m.t === 'error') $('netmsg').textContent = 'Server: ' + m.msg; };
    ws.onclose = () => { net = null; $('netgo').textContent = 'Connect'; $('netmsg').textContent = 'Offline: this page runs the fight itself.'; };
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
  let last = performance.now(), acc = 0;
  function frame(now) {
    const real = Math.min(0.05, (now - last) / 1000); last = now;
    if (net) {                                                   // online: send input when it changes; the room steps the fight
      const inp = { x: (keys.r ? 1 : 0) - (keys.l ? 1 : 0), y: (keys.d ? 1 : 0) - (keys.u ? 1 : 0), act: !!keys.act }, k = inp.x + ',' + inp.y + ',' + inp.act;
      if (k !== net.lastIn) { net.lastIn = k; send(Object.assign({ t: 'input' }, inp)); }
      for (const t of sim.texts) t.life -= real; sim.texts = sim.texts.filter(t => t.life > 0);
    } else if (pb) {                                             // a replay or kill cam is playing
      pb.acc += real * pb.speed;
      while (pb.acc >= STEP && pb.sim.stepN < pb.end) { pbStep(); pb.acc -= STEP; }
      if (pb.sim.stepN >= pb.end) stopReplay();
    } else if (!paused) {
      acc += real * timeScale;
      while (acc >= STEP) {
        const inp = { x: (keys.r ? 1 : 0) - (keys.l ? 1 : 0), y: (keys.d ? 1 : 0) - (keys.u ? 1 : 0), act: !!keys.act }, s0 = live.input;
        if (inp.x !== s0.x || inp.y !== s0.y || inp.act !== !!s0.act) cmd(Object.assign({ t: 'input' }, inp));
        live.step(STEP); acc -= STEP;
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
      const info = []; let first = null;
      for (const x of arr) {
        if (!x.keys || !x.keys.length) continue;
        const two = x.load ? x.load === '2' : !!x.two, typ = x.type || 'attack';
        if (!M3.registerAnim({ id: x.id || 'legacy', type: typ, two, contact: x.contact, loop: x.loop, len: x.len, end: x.end, keys: x.keys, hit: x.hit })) continue;
        if (typ === 'attack') {
          const op = document.createElement('option'); op.value = 'c_' + (x.id || 'legacy'); op.dataset.custom = 1;
          op.textContent = 'Custom: ' + (x.name || 'attack') + (two ? ' (2H)' : ' (1H)'); sel.appendChild(op); first = first || op.value;
        }
        info.push((x.name || typ) + ' [' + typ + (two ? ', 2H' : ', 1H') + ']');
      }
      if (!info.length) throw new Error('empty');
      try { localStorage.setItem('pwlib2', txt); } catch (e) { }
      $('customjson').value = txt;
      $('custommsg').textContent = 'Loaded: ' + info.join(', ') + '. Idle and walk animations apply to every 1H or 2H fighter automatically. Attacks appear in the Attack style list.';
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
  const IDS = ['ptier', 'lkhead', 'lkbody', 'lkliv', 'lkmetal', 'atkstyle', 'weapon', 'dex', 'dmgov', 'thr', 'chance', 'wdur', 'critorder', 'flee', 'esan', 'ts', 'tier', 'dur', 'ai', 'count'];
  { const P = M3.parts || null, fill = (id, list, none) => { const e = $(id); if (!e || !P) return; e.innerHTML = '<option value="">' + none + '</option>' + list.map(x => '<option value="' + x[0] + '">' + x[1] + '</option>').join(''); };
    if (P && P.presets) { const s = $('ptier'); s.innerHTML = P.presets.map(x => '<option value="' + x[0] + '">' + x[1] + '</option>').join(''); }
    fill('lkhead', P ? P.heads : [], 'from armor'); fill('lkbody', P ? P.bodies : [], 'from armor'); fill('lkliv', P ? P.liveries : [], 'from armor'); fill('lkmetal', P ? P.metals : [], 'from armor'); }
  function boot(saved) {
    saved = saved || {};
    startRec();
    { const m = M3.bakeMove('cut1', { role: 'e', two: false, wkind: 'sword', shield: true }); if (m) cmd({ t: 'move', id: CFG.enemy.move, data: m }); }   // enemy swing path
    IDS.forEach(id => { if (saved[id] != null) $(id).value = saved[id]; });
    if (saved.inv != null) $('inv').checked = !!saved.inv;
    if (saved.dbg != null) $('dbg').checked = !!saved.dbg;
    if (saved.dur == null) tierDefaults();
    applySettings();
    try { if (saved.atkstyle && saved.atkstyle.slice(0, 2) === 'c_') $('atkstyle').value = saved.atkstyle; } catch (e) { }
    cmd({ t: 'say', text: 'Test arena ready. Walk into range; attacks are automatic.' });
    cmd({ t: 'spawn', list: [{ tier: 'leather', dur: CFG.tiers.leather.dur, ai: 'stand' }] });
    requestAnimationFrame(frame);
  }
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => { const o = {}; IDS.forEach(id => o[id] = $(id).value); o.inv = $('inv').checked; o.dbg = $('dbg').checked; return o; }); } catch (e) { }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
}
