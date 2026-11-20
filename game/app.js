/* ============================================================
   PROJECT WAR · COMBAT TEST  — rendering + menu (browser only)
   Fighters are live 3D models (rig/model3d.js) drawn into the 2D stage.
   ============================================================ */
import M3 from '../rig/model3d.js';
import { CFG, Sim, fitsWindow, minDexForWindow } from './sim.js';
{
  const $ = id => document.getElementById(id);
  const cv = $('stage');
  let ctx = cv.getContext('2d');
  const sim = new Sim(CFG);
  window.PW = { sim, M3, CFG };                         // console and test handle
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
    const k = MAP[e.code]; if (!k) return;
    if (e.target && e.target.type === 'range' && e.code.startsWith('Arrow')) return;
    keys[k] = true; e.preventDefault();
  });
  window.addEventListener('keyup', e => { const k = MAP[e.code]; if (k) keys[k] = false; });
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
    const w = sim.weaponInfo(), sel = $('atkstyle'), lg = sel.querySelector('option[value=lunge]');
    if (lg) { lg.disabled = !w.twoHanded; if (!w.twoHanded && sel.value === 'lunge') sel.value = 'chop'; }
    const v = sel.value;
    look.tier = $('ptier').value; look.head = $('lkhead').value; look.body = $('lkbody').value; look.liv = $('lkliv').value; look.metal = $('lkmetal').value;
    look.style = ({ horiz: 'attack2', chop: 'chop', lunge: 'lunge', cut: 'cut' })[v] || (v.slice(0, 2) === 'c_' ? v : 'cut');
  }
  ['ptier', 'lkhead', 'lkbody', 'lkliv', 'lkmetal', 'atkstyle'].forEach(id => $(id).addEventListener('change', readLook));
  function applySettings() {
    sim.player.weapon = $('weapon').value;
    sim.player.dex = Math.max(5, num('dex', 5)); $('dexv').textContent = sim.player.dex;
    const ov = $('dmgov').value.trim(); sim.player.dmgOverride = ov === '' ? null : Math.max(1, parseInt(ov, 10) || 1);
    sim.player.inv = $('inv').checked;
    CFG.woundedThreshold = Math.max(0, num('thr', 3));
    CFG.woundedChance = Math.min(1, Math.max(0, num('chance', 100) / 100));
    CFG.woundedDur = Math.max(0.1, num('wdur', 1));
    CFG.critOrder = $('critorder').value;
    CFG.fleeSan = num('flee', 3);
    CFG.enemy.san = num('esan', 5);
    timeScale = num('ts', 1); $('tsv').textContent = timeScale.toFixed(2) + 'x';
    readout(); readLook();
  }
  ['weapon', 'dex', 'dmgov', 'inv', 'thr', 'chance', 'wdur', 'critorder', 'flee', 'esan', 'ts'].forEach(id => { $(id).addEventListener('input', applySettings); $(id).addEventListener('change', applySettings); });
  $('tier').addEventListener('change', tierDefaults);
  $('spawn').addEventListener('click', () => {
    const n = Math.max(1, Math.min(5, parseInt($('count').value, 10) || 1));
    for (let i = 0; i < n; i++) sim.spawn({ tier: $('tier').value, dur: Math.max(1, num('dur', 6)), ai: $('ai').value, index: sim.enemies.filter(e => e.state === 'alive').length % 5 });
    sim.say('info', 'Spawned ' + n + ' ' + CFG.tiers[$('tier').value].label + ' man-at-arms (' + $('ai').value + ').');
  });
  $('clear').addEventListener('click', () => { sim.clearEnemies(); sim.say('info', 'Arena cleared.'); });
  $('heal').addEventListener('click', () => sim.healAll());
  $('repair').addEventListener('click', () => sim.repairAll());
  $('resetp').addEventListener('click', () => { sim.resetPlayer(); sim.say('info', 'Player reset.'); });
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
          drawFigure({ role: 'e', x: e.x, y: e.y, z: e.z, face: e.face, tier: e.tier, broken: e.broken, shield: true,
            alpha, dead: true, deathT: e.deathT, dramatic: e.dramatic, t: sim.t, flash: 0, swing: null });
        } else {
          if (target === e) {
            ctx.strokeStyle = 'rgba(240,195,90,.9)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.ellipse(Math.round(e.x), Math.round(e.y), 22, 6, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
          }
          const atk = e.atk ? { t: e.atk.t, dur: CFG.enemy.atkDur, dur0: CFG.enemy.atkDur, hitAt: CFG.enemy.atkHitAt, extra: 0 } : null;
          drawFigure({ role: 'e', x: e.x, y: e.y, face: e.face, tier: e.tier, broken: e.broken, shield: true,
            swing: atk, woundedPose: e.wounded > 0, moving: e.moving, walkT: e.walkT, t: sim.t, flash: e.flash, flashMax: 0.12 });
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
    for (const t of sim.texts) { ctx.globalAlpha = Math.min(1, t.life / 0.3); label(t.text, t.x, t.y, t.col, t.size + 2); }
    ctx.globalAlpha = 1;

    // player hp + swing
    label('YOU', p.x, p.y - 88, '#f4ecd8', 10);
    ctx.fillStyle = '#14101c'; ctx.fillRect(p.x - 15, p.y - 84, 30, 5); ctx.fillStyle = '#6fd07a'; ctx.fillRect(p.x - 14, p.y - 83, Math.round(28 * p.hp / p.maxHp), 3);
    if (dbg && p.swing) {
      const s = p.swing; ctx.fillStyle = '#14101c'; ctx.fillRect(p.x - 20, p.y - 100, 40, 4);
      ctx.fillStyle = '#f0c35a'; ctx.fillRect(p.x - 19, p.y - 99, Math.round(38 * Math.min(1, s.t / s.dur)), 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x - 19 + Math.round(38 * s.hitAt / s.dur), p.y - 101, 1, 6);
    }
    ctx.restore();
  }

  /* ---------- loop ---------- */
  let last = performance.now(), acc = 0;
  function frame(now) {
    const real = Math.min(0.05, (now - last) / 1000); last = now;
    if (!paused) {
      acc += real * timeScale;
      while (acc >= STEP) {
        sim.input = { x: (keys.r ? 1 : 0) - (keys.l ? 1 : 0), y: (keys.d ? 1 : 0) - (keys.u ? 1 : 0) };
        sim.step(STEP); acc -= STEP;
      }
    }
    render(); renderLog(); renderLast(); renderStatus();
    requestAnimationFrame(frame);
  }


  /* ---------- animation library made in the Animator ---------- */
  const BUILTIN_ANIMS = [{"id":"amwmwsy65ugd","name":"quick side","type":"attack","load":"1s","contact":11,"loop":0.55,"len":90,"end":89,"keys":[{"f":0,"hy":-0.376,"hz":0.146,"ba":20,"bx":0,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":0.019,"nh":19.386,"nk":36.466,"fh":-47.997,"fk":79.044,"fx":0.1,"fy":-0.252,"fz":0.153},{"f":1,"hy":-0.208,"hz":0.165,"ba":70.017,"bx":0,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-42.075,"nk":63.44,"fh":15.677,"fk":40.885,"fx":0.1,"fy":-0.252,"fz":0.153},{"f":2,"hy":0.366,"hz":-0.312,"ba":20,"bx":0,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-58.091,"nk":51.908,"fh":7.776,"fk":56.483,"fx":0.1,"fy":-0.252,"fz":0.153},{"f":3,"hy":0.375,"hz":-0.312,"ba":20,"bx":0,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-58.091,"nk":51.908,"fh":-10.678,"fk":73.719,"fx":0.1,"fy":-0.252,"fz":0.153},{"f":4,"hy":0.439,"hz":-0.27,"ba":20,"bx":0,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":-0.046,"nh":-63.779,"nk":63.284,"fh":-6.99,"fk":79.505,"fx":0.1,"fy":-0.252,"fz":0.153},{"f":5,"hy":0.308,"hz":-0.308,"ba":28.318,"bx":68.416,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":-0.05,"nh":-64.228,"nk":64.182,"fh":-6.699,"fk":79.962,"fx":0.1,"fy":-0.252,"fz":0.153},{"f":6,"hy":0.155,"hz":-0.291,"ba":36.454,"bx":126.72,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":-0.049,"nh":-64.078,"nk":63.882,"fh":-6.796,"fk":79.809,"fx":0.1,"fy":-0.252,"fz":0.153},{"f":7,"hy":-0.231,"hz":0.305,"ba":0.523,"bx":-92.091,"br":0,"pp":10,"py":-30,"hp":10,"hw":0,"rz":-0.047,"nh":-63.873,"nk":63.471,"fh":-6.93,"fk":79.6,"fx":0.1,"fy":-0.252,"fz":0.153},{"f":9,"hy":-0.259,"hz":0.485,"ba":0.131,"bx":-91.762,"br":0,"pp":10,"py":-30,"hp":10.116,"hw":0,"rz":-0.047,"nh":-63.87,"nk":63.466,"fh":-6.931,"fk":79.597,"fx":0.1,"fy":-0.252,"fz":0.153},{"f":10,"hy":-0.237,"hz":0.519,"ba":-1.001,"bx":-53.374,"br":0,"pp":10,"py":-30,"hp":10.117,"hw":0,"rz":-0.047,"nh":-63.87,"nk":63.466,"fh":-6.931,"fk":79.597,"fx":0.1,"fy":-0.252,"fz":0.153},{"f":11,"hy":-0.16,"hz":0.547,"ba":-0.065,"bx":0,"br":-63,"pp":10,"py":-30,"hp":10.117,"hw":0,"rz":-0.047,"nh":-63.87,"nk":63.466,"fh":-6.931,"fk":79.597,"fx":0.1,"fy":-0.252,"fz":0.153},{"f":12,"hy":-0.16,"hz":0.547,"ba":-0.059,"bx":0.286,"br":-63.394,"pp":10,"py":-30,"hp":10.117,"hw":0,"rz":-0.047,"nh":-63.87,"nk":63.466,"fh":-6.931,"fk":79.597,"fx":0.1,"fy":-0.252,"fz":0.153}]},{"id":"amwo3xbolg76","name":"stab","type":"attack","load":"1s","contact":12,"loop":0.55,"len":90,"end":89,"keys":[{"f":0,"hy":-0.1,"hz":0.4,"ba":20,"bx":0,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":0.005,"nh":-40.521,"nk":41.043,"fh":28.681,"fk":10.521,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":1,"hy":-0.477,"hz":0.244,"ba":20,"bx":0,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":0.005,"nh":-40.521,"nk":41.043,"fh":28.681,"fk":10.521,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":2,"hy":-0.56,"hz":0.104,"ba":11.068,"bx":11.151,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":0.005,"nh":-40.521,"nk":41.043,"fh":28.681,"fk":10.521,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":3,"hy":-0.565,"hz":-0.072,"ba":2.66,"bx":14.284,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":0.005,"nh":-40.521,"nk":41.043,"fh":28.681,"fk":10.521,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":4,"hy":-0.43,"hz":-0.073,"ba":3,"bx":14.302,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":0.005,"nh":-40.521,"nk":41.043,"fh":28.681,"fk":10.521,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":5,"hy":-0.429,"hz":-0.19,"ba":3.002,"bx":14.302,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":0.005,"nh":-40.521,"nk":41.043,"fh":28.681,"fk":10.521,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":6,"hy":-0.429,"hz":-0.191,"ba":3.002,"bx":14.302,"br":0,"pp":10,"py":-30,"hp":0,"hw":0,"rz":-0.019,"nh":-50.047,"nk":60.094,"fh":25.633,"fk":23.984,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":8,"hy":-0.43,"hz":-0.191,"ba":3.002,"bx":14.302,"br":0,"pp":10,"py":-30,"hp":11,"hw":0,"rz":-0.019,"nh":-50.156,"nk":60.312,"fh":25.598,"fk":24.138,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":9,"hy":-0.43,"hz":-0.191,"ba":3.002,"bx":14.302,"br":0,"pp":10,"py":-30,"hp":25,"hw":0,"rz":-0.019,"nh":-50.157,"nk":60.314,"fh":25.598,"fk":24.139,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":10,"hy":-0.458,"hz":0.128,"ba":3.002,"bx":14.302,"br":0,"pp":10,"py":-30,"hp":25.085,"hw":0,"rz":-0.019,"nh":-50.157,"nk":60.314,"fh":25.598,"fk":24.139,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":11,"hy":-0.458,"hz":0.323,"ba":3.002,"bx":14.302,"br":0,"pp":10,"py":-30,"hp":25.086,"hw":0,"rz":-0.019,"nh":-50.157,"nk":60.314,"fh":25.598,"fk":24.139,"fx":0.1,"fy":-0.233,"fz":0.199},{"f":12,"hy":-0.15,"hz":0.55,"ba":3.002,"bx":14.302,"br":0,"pp":10,"py":-30,"hp":25.086,"hw":-22,"rz":-0.019,"nh":-50.157,"nk":60.314,"fh":25.598,"fk":24.139,"fx":0.1,"fy":-0.552,"fz":0.144},{"f":13,"hy":-0.148,"hz":0.551,"ba":3.002,"bx":14.302,"br":0,"pp":10,"py":-30,"hp":25.086,"hw":-22.139,"rz":-0.019,"nh":-50.157,"nk":60.314,"fh":25.598,"fk":24.139,"fx":0.1,"fy":-0.554,"fz":0.143},{"f":14,"hy":-0.547,"hz":0.068,"ba":3.002,"bx":14.302,"br":0,"pp":10,"py":-30,"hp":25.086,"hw":9,"rz":0.023,"nh":-41.619,"nk":43.238,"fh":19.906,"fk":15.602,"fx":0.1,"fy":-0.132,"fz":0.311}]},{"id":"amwo45w0yhhl","name":"turn stab","type":"attack","load":"1s","contact":10,"loop":0.55,"len":90,"end":89,"keys":[{"f":0,"hy":-0.283,"hz":0.09,"ba":20,"bx":-30,"br":-50,"pp":1,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":40.333,"fk":0,"fx":0.03,"fy":-0.18,"fz":0.3},{"f":1,"hy":-0.306,"hz":-0.053,"ba":20,"bx":-67,"br":-17,"pp":10,"py":-30,"hp":0,"hw":0,"rz":-0.042,"nh":-49.309,"nk":67.111,"fh":23.441,"fk":32.757,"fx":0.03,"fy":-0.18,"fz":0.3},{"f":2,"hy":-0.316,"hz":-0.293,"ba":19.979,"bx":-110,"br":-16.817,"pp":10,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-42.38,"nk":58.776,"fh":34,"fk":4,"fx":0.03,"fy":-0.18,"fz":0.3},{"f":3,"hy":-0.265,"hz":-0.505,"ba":19.951,"bx":-180,"br":-87,"pp":1,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-45.755,"nk":66.126,"fh":13.799,"fk":44.058,"fx":0.03,"fy":-0.18,"fz":0.3},{"f":4,"hy":-0.291,"hz":-0.351,"ba":22.693,"bx":-155.972,"br":-126.361,"pp":-9,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-43.357,"nk":60.535,"fh":12.24,"fk":38.797,"fx":0.03,"fy":-0.18,"fz":0.3},{"f":5,"hy":-0.329,"hz":-0.131,"ba":19.817,"bx":-120,"br":-157,"pp":-17,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":11.115,"fk":39.792,"fx":0.03,"fy":-0.18,"fz":0.3},{"f":6,"hy":-0.371,"hz":0.188,"ba":9.451,"bx":-96.105,"br":-157.407,"pp":-8,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":9.125,"fk":43.092,"fx":0.03,"fy":-0.18,"fz":0.3},{"f":7,"hy":-0.376,"hz":0.35,"ba":4.185,"bx":-73.528,"br":-157.409,"pp":2,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":7.86,"fk":40.586,"fx":0.03,"fy":-0.18,"fz":0.3},{"f":8,"hy":-0.379,"hz":0.426,"ba":-0.597,"bx":-52.425,"br":-157.409,"pp":22,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":3.284,"fk":49.755,"fx":0.03,"fy":-0.18,"fz":0.3},{"f":9,"hy":-0.379,"hz":0.426,"ba":-7.674,"bx":-38.268,"br":-70,"pp":26,"py":-30,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":-1.007,"fk":43.303,"fx":0.03,"fy":-0.18,"fz":0.3},{"f":10,"hy":-0.303,"hz":0.483,"ba":-7.716,"bx":-38.182,"br":-69.467,"pp":21,"py":20,"hp":0,"hw":0,"rz":0.116,"nh":-51.401,"nk":76.724,"fh":4.083,"fk":57.758,"fx":0.03,"fy":-0.317,"fz":0.065},{"f":11,"hy":-0.303,"hz":0.483,"ba":-7.716,"bx":-38.182,"br":-69.464,"pp":33,"py":90,"hp":0,"hw":0,"rz":0.116,"nh":-42,"nk":49,"fh":30,"fk":0,"fx":0.03,"fy":-0.318,"fz":0.063}]},{"id":"amwo4ervj502","name":"body rotate slash","type":"attack","load":"1s","contact":8,"loop":0.55,"len":90,"end":89,"keys":[{"f":0,"hy":-0.1,"hz":0.4,"ba":20,"bx":27,"br":0,"pp":10,"py":20,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":1,"hy":-0.176,"hz":0.195,"ba":20,"bx":70,"br":0,"pp":10,"py":73,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":2,"hy":-0.17,"hz":0.062,"ba":20,"bx":63,"br":30,"pp":10,"py":85,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":3,"hy":-0.114,"hz":0.145,"ba":20,"bx":107,"br":0,"pp":10,"py":90,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":4,"hy":-0.087,"hz":-0.253,"ba":23.765,"bx":180,"br":87,"pp":10,"py":77.519,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":5,"hy":-0.03,"hz":-0.164,"ba":17.102,"bx":-180,"br":48.938,"pp":10,"py":61.292,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":6,"hy":-0.002,"hz":-0.172,"ba":16.414,"bx":180,"br":0,"pp":10,"py":40,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":7,"hy":-0.1,"hz":0.4,"ba":12.525,"bx":92.348,"br":0,"pp":10,"py":-13,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":8,"hy":-0.111,"hz":0.559,"ba":15.072,"bx":0,"br":-90,"pp":10,"py":-55,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.05,"fz":0.3},{"f":9,"hy":-0.046,"hz":0.568,"ba":10.572,"bx":0,"br":-90,"pp":10,"py":-90,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.295,"fz":0.182},{"f":10,"hy":-0.176,"hz":0.067,"ba":10.545,"bx":-53,"br":-13,"pp":10,"py":-90.213,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.296,"fz":0.181},{"f":11,"hy":-0.245,"hz":-0.28,"ba":10.519,"bx":-90,"br":-12.525,"pp":10,"py":-90.215,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.296,"fz":0.181},{"f":12,"hy":-0.189,"hz":-0.538,"ba":10.506,"bx":-180,"br":-93,"pp":10,"py":-90.215,"hp":0,"hw":0,"rz":0,"nh":-50,"nk":60,"fh":35,"fk":20,"fx":0.1,"fy":-0.296,"fz":0.181}]}];
  function loadLibrary(txt, quiet) {
    try {
      const o = JSON.parse(txt), user = o.anims || [o];
      const arr = BUILTIN_ANIMS.filter(b => !user.some(u => u.id === b.id)).concat(user);
      M3.clearCustom();
      const sel = $('atkstyle'); sel.querySelectorAll('option[data-custom]').forEach(x => x.remove());
      const info = []; let first = null;
      for (const x of arr) {
        if (!x.keys || !x.keys.length) continue;
        const two = x.load ? x.load === '2' : !!x.two, typ = x.type || 'attack';
        if (!M3.registerAnim({ id: x.id || 'legacy', type: typ, two, contact: x.contact, loop: x.loop, len: x.len, end: x.end, keys: x.keys })) continue;
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
    IDS.forEach(id => { if (saved[id] != null) $(id).value = saved[id]; });
    if (saved.inv != null) $('inv').checked = !!saved.inv;
    if (saved.dbg != null) $('dbg').checked = !!saved.dbg;
    if (saved.dur == null) tierDefaults();
    applySettings();
    try { if (saved.atkstyle && saved.atkstyle.slice(0, 2) === 'c_') $('atkstyle').value = saved.atkstyle; } catch (e) { }
    sim.say('info', 'Test arena ready. Walk into range; attacks are automatic.');
    sim.spawn({ tier: 'leather', dur: CFG.tiers.leather.dur, ai: 'stand', index: 0 });
    requestAnimationFrame(frame);
  }
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => { const o = {}; IDS.forEach(id => o[id] = $(id).value); o.inv = $('inv').checked; o.dbg = $('dbg').checked; return o; }); } catch (e) { }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
}
