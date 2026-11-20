/* ============================================================
   PROJECT WAR · COMBAT TEST — sprite sheet loader (browser only)
   Sheets are loaded from the person's own computer and never leave the browser.
   ============================================================ */
const SheetKit = (() => {
  const ANIMS = [
    ['idle',    'Idle (loop)',                 4, 8],
    ['run',     'Run (loop)',                  6, 12],
    ['attack',  'Slap Slash (Set, Swing, Contact)', 9, 0],
    ['wounded', 'Wounded idle (loop)',         3, 6],
    ['hit',     'Hit reaction',                3, 0],
    ['death',   'Death, normal',               8, 12],
    ['deathv',  'Death, violent',              9, 12],
    ['attack2', 'Horizontal Slash',            9, 0],
  ];
  const sheets = {}, api = {};

  function parseList(t) {
    const out = [];
    String(t || '').split(/[,\s]+/).forEach(p => { const m = /^(\d+)(?:-(\d+))?$/.exec(p); if (!m) return; const a = +m[1], b = m[2] == null ? a : +m[2]; for (let i = a; a <= b ? i <= b : i >= b; a <= b ? i++ : i--) out.push(i); });
    return out;
  }
  function fmtList(l) {
    const out = []; for (let i = 0; i < l.length; i++) { let j = i; while (j + 1 < l.length && l[j + 1] === l[j] + 1) j++; out.push(j > i ? l[i] + '-' + l[j] : String(l[i])); i = j; }
    return out.join(',');
  }
  function newSheet(img, name) {
    const raw = document.createElement('canvas'); raw.width = img.width; raw.height = img.height;
    raw.getContext('2d').drawImage(img, 0, 0);
    const S = {
      name, raw, canvas: null, frames: [],
      mode: 'grid', cw: 128, ch: 96, ox: 0, oy: 0, gap: 2, feet: 6, scale: 1, flip: false, tol: 24, glob: false, contact: 4, contact2: 5, target: 80, tint: '',
      anims: {},
    };
    ANIMS.forEach((a, i) => { S.anims[a[0]] = { list: Array.from({ length: a[2] }, (_, k) => i * 10 + k), fps: a[3] }; });
    return S;
  }

  /* remove the sheet's background by flooding in from the border, so white swords inside the art survive */
  function key(S) {
    const w = S.raw.width, h = S.raw.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(S.raw, 0, 0);
    const im = g.getImageData(0, 0, w, h), d = im.data;
    if (d[3] > 10 && S.tol >= 0) {
      const r0 = d[0], g0 = d[1], b0 = d[2], tol = S.tol;
      const near = i => d[i + 3] > 0 && Math.abs(d[i] - r0) <= tol && Math.abs(d[i + 1] - g0) <= tol && Math.abs(d[i + 2] - b0) <= tol;
      if (S.glob) { for (let i = 0; i < d.length; i += 4) if (near(i)) d[i + 3] = 0; g.putImageData(im, 0, 0); S.canvas = c; return; }
      const seen = new Uint8Array(w * h), stack = [];
      const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const k = y * w + x; if (seen[k]) return; if (!near(k * 4)) return; seen[k] = 1; stack.push(k); };
      for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
      for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
      while (stack.length) {
        const k = stack.pop(), x = k % w, y = (k / w) | 0;
        d[k * 4 + 3] = 0;
        push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
      }
      g.putImageData(im, 0, 0);
    }
    S.canvas = c;
  }

  function runs(flags, gap) {          // groups of true values, merged when separated by fewer than `gap` empties
    const out = []; let start = -1, empty = 0;
    for (let i = 0; i <= flags.length; i++) {
      const on = i < flags.length && flags[i];
      if (on) { if (start < 0) start = i; empty = 0; }
      else if (start >= 0) { empty++; if (empty >= gap || i === flags.length) { out.push([start, i - empty]); start = -1; empty = 0; } }
    }
    return out;
  }

  function slice(S) {
    const W = S.canvas.width, H = S.canvas.height, F = [];
    if (S.mode === 'grid') {
      const cols = Math.floor((W - S.ox) / S.cw), rows = Math.floor((H - S.oy) / S.ch);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
        F.push({ sx: S.ox + c * S.cw, sy: S.oy + r * S.ch, sw: S.cw, sh: S.ch, ax: S.cw / 2, ay: S.ch - S.feet });
    } else {
      const d = S.canvas.getContext('2d').getImageData(0, 0, W, H).data, N = W * H, gp = Math.max(1, S.gap);
      const mask = new Uint8Array(N); for (let k = 0; k < N; k++) mask[k] = d[k * 4 + 3] > 8 ? 1 : 0;
      const hz = new Uint8Array(N), dil = new Uint8Array(N);          // grow the mask by `gap` so a figure and its slash arc stay together
      for (let y = 0; y < H; y++) { let last = -1e9; for (let x = 0; x < W; x++) { if (mask[y * W + x]) last = x; if (x - last <= gp) hz[y * W + x] = 1; } last = 1e9; for (let x = W - 1; x >= 0; x--) { if (mask[y * W + x]) last = x; if (last - x <= gp) hz[y * W + x] = 1; } }
      for (let x = 0; x < W; x++) { let last = -1e9; for (let y = 0; y < H; y++) { if (hz[y * W + x]) last = y; if (y - last <= gp) dil[y * W + x] = 1; } last = 1e9; for (let y = H - 1; y >= 0; y--) { if (hz[y * W + x]) last = y; if (last - y <= gp) dil[y * W + x] = 1; } }
      const seen = new Uint8Array(N), comps = [];
      for (let k0 = 0; k0 < N; k0++) {
        if (!dil[k0] || seen[k0]) continue;
        const st = [k0]; seen[k0] = 1; let x0 = W, y0 = H, x1 = -1, y1 = -1, px = 0;
        while (st.length) {
          const k = st.pop(), x = k % W, y = (k / W) | 0;
          if (mask[k]) { px++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          if (x + 1 < W && dil[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; st.push(k + 1); }
          if (x > 0 && dil[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; st.push(k - 1); }
          if (y + 1 < H && dil[k + W] && !seen[k + W]) { seen[k + W] = 1; st.push(k + W); }
          if (y > 0 && dil[k - W] && !seen[k - W]) { seen[k - W] = 1; st.push(k - W); }
        }
        if (px >= 12 && x1 - x0 >= 3 && y1 - y0 >= 3) comps.push({ x0, y0, x1, y1 });
      }
      comps.sort((a, b) => a.y1 - b.y1);                              // rows by where the feet are
      const rowsL = []; comps.forEach(c => { const r = rowsL[rowsL.length - 1]; if (r && c.y1 - r.ref <= 14) { r.items.push(c); } else rowsL.push({ ref: c.y1, items: [c] }); });
      rowsL.forEach(r => r.items.sort((a, b) => a.x0 - b.x0).forEach(c => {
        const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1;
        F.push({ sx: c.x0, sy: c.y0, sw: w, sh: h, ax: w / 2, ay: h - S.feet });
      }));
    }
    S.frames = F;
  }

  function rebuild(S, rekey) { if (rekey || !S.canvas) key(S); slice(S); }

  function contentHeight(S, fi) {
    const f = S.frames[fi]; if (!f) return 0;
    const d = S.canvas.getContext('2d').getImageData(f.sx, f.sy, f.sw, f.sh).data;
    let top = -1, bot = -1;
    for (let y = 0; y < f.sh; y++) for (let x = 0; x < f.sw; x++) if (d[(y * f.sw + x) * 4 + 3] > 8) { if (top < 0) top = y; bot = y; break; }
    return top < 0 ? 0 : bot - top + 1;
  }

  function drawFrame(ctx, S, fi, x, y, face, opts) {
    const f = S.frames[fi]; if (!f) return false;
    opts = opts || {};
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(face * (S.flip ? -1 : 1), 1);
    if (opts.rot) ctx.rotate(opts.rot);
    if (opts.squash) ctx.scale(1, opts.squash);
    if (opts.flash) ctx.filter = 'brightness(2.6)'; else if (S.tint) ctx.filter = S.tint;
    const sc = S.scale;
    ctx.drawImage(S.canvas, f.sx, f.sy, f.sw, f.sh, Math.round(-f.ax * sc), Math.round(-f.ay * sc), Math.round(f.sw * sc), Math.round(f.sh * sc));
    ctx.restore();
    return true;
  }

  /* ---------- which frame to show ---------- */
  const ok = (S, id) => S.anims[id] && S.anims[id].list.length > 0;
  const loopFrame = (S, id, t) => { const a = S.anims[id]; return a.list[Math.floor(t * Math.max(1, a.fps)) % a.list.length]; };
  const onceFrame = (S, id, t) => { const a = S.anims[id]; return a.list[Math.min(a.list.length - 1, Math.floor(t * Math.max(1, a.fps)))]; };

  function attackFrame(S, sw, id) {
    const a = S.anims[id], n = a.list.length;
    const cf = Math.max(0, Math.min(n - 1, (id === 'attack2' ? S.contact2 : S.contact) | 0));
    const t = sw.t, h = sw.hitAt, ex = sw.extra || 0;
    let i;
    if (t < h) i = cf > 0 ? Math.min(cf - 1, Math.floor((t / h) * cf)) : 0;
    else if (t < h + ex) i = cf;                         // the pause on the Contact frame while the game checks for a kill
    else {
      const rest = n - cf - 1, u = Math.min(1, (t - h - ex) / Math.max(0.05, sw.dur - h - ex));
      i = rest > 0 ? cf + 1 + Math.min(rest - 1, Math.floor(u * rest)) : cf;
    }
    return a.list[i];
  }

  function pick(S, f) {
    if (f.dead) {
      const id = f.dramatic && ok(S, 'deathv') ? 'deathv' : (ok(S, 'death') ? 'death' : null);
      if (id) return { fi: onceFrame(S, id, f.deathT || 0), own: true };
      return { fi: ok(S, 'idle') ? S.anims.idle.list[0] : 0, own: false };
    }
    if (f.swing) {
      const id = f.style === 'attack2' && ok(S, 'attack2') ? 'attack2' : (ok(S, 'attack') ? 'attack' : null);
      if (id) return { fi: attackFrame(S, f.swing, id), own: true };
    }
    if (f.flash > 0 && f.flashMax && ok(S, 'hit')) {
      const a = S.anims.hit, u = 1 - f.flash / f.flashMax;
      return { fi: a.list[Math.min(a.list.length - 1, Math.floor(u * a.list.length))], own: true };
    }
    if (f.woundedPose && ok(S, 'wounded')) return { fi: loopFrame(S, 'wounded', f.t), own: true };
    if (f.moving && ok(S, 'run')) return { fi: loopFrame(S, 'run', f.walkT * 1.2), own: true };
    if (ok(S, 'idle')) return { fi: loopFrame(S, 'idle', f.t), own: true };
    return { fi: 0, own: true };
  }

  /* ---------- the menu panel (built here so the page template stays small) ---------- */
  function buildPanel(root, role, title, hooks) {
    const labels = ANIMS.map(a => a[1]);
    root.innerHTML =
      '<details><summary>' + title + '</summary><div class="sheetbody">' +
      '<p class="muted">Pick a PNG from your computer. It stays in this browser tab and is never uploaded. Frames are numbered in the preview, left to right, top to bottom, starting at 0.</p>' +
      '<div class="btns"><label class="btn primary" tabindex="0">Load PNG<input type="file" accept="image/*" hidden data-k="file"></label>' +
      (hooks.presets || []).map(p => '<button class="btn primary" type="button" data-p="' + p[0] + '">' + p[1] + '</button>').join('') +
      '<button class="btn" type="button" data-k="bake">Use placeholder sheet</button>' +
            '<button class="btn" type="button" data-k="off">Remove</button></div>' +
      '<div class="muted" data-k="name">No sheet loaded. The rectangle figure is used.</div>' +
      '<div data-k="ctl" hidden>' +
      '<div class="field"><label>Slicing</label><select data-k="mode"><option value="grid">Grid of equal cells</option><option value="auto">Auto-detect each sprite</option></select></div>' +
      '<div class="field" data-g="grid"><label>Cell width / height</label><span class="pair"><input type="number" data-k="cw" min="4" step="1"><input type="number" data-k="ch" min="4" step="1"></span></div>' +
      '<div class="field" data-g="grid"><label>Grid offset x / y</label><span class="pair"><input type="number" data-k="ox" min="0" step="1"><input type="number" data-k="oy" min="0" step="1"></span></div>' +
      '<div class="field" data-g="auto"><label>Gap that splits frames (px)</label><input type="number" data-k="gap" min="1" step="1"></div>' +
      '<div class="field"><label>Feet above frame bottom (px)</label><input type="number" data-k="feet" min="0" step="1"></div>' +
      '<div class="field"><label>Remove background, tolerance</label><input type="number" data-k="tol" min="-1" max="255" step="2"></div>' +
      '<div class="field"><label>Remove that color everywhere</label><input type="checkbox" data-k="glob"></div>' +
      '<div class="field"><label>Color shift for this sheet</label><select data-k="tint"><option value="">None</option><option value="hue-rotate(250deg) saturate(1.1)">Purple</option><option value="hue-rotate(120deg)">Green</option><option value="grayscale(1) brightness(.8)">Grey</option><option value="sepia(1) saturate(2)">Gold</option></select></div>' +
      '<div class="field"><label>Draw scale</label><input type="number" data-k="scale" min="0.1" step="0.05"></div>' +
      '<div class="field"><label>Fit art height to (px)</label><span class="pair"><input type="number" data-k="target" min="10" step="1"><button class="btn" type="button" data-k="fit">Fit</button></span></div>' +
      '<div class="field"><label>Sheet art faces left</label><input type="checkbox" data-k="flip"></div>' +
      '<div class="field"><label>Contact frame, Slap Slash (0-based)</label><input type="number" data-k="contact" min="0" step="1"></div>' +
      '<div class="field"><label>Contact frame, Horizontal Slash</label><input type="number" data-k="contact2" min="0" step="1"></div>' +
      '<table class="anims"><thead><tr><th>Animation</th><th>Frames</th><th>FPS</th></tr></thead><tbody>' +
      ANIMS.map((a, i) => '<tr><td>' + labels[i] + '</td><td><input type="text" class="frm" placeholder="e.g. 0-3 or 19,20,22" data-a="' + a[0] + '" data-f="frames"></td><td>' +
        (a[3] ? '<input type="number" min="1" step="1" data-a="' + a[0] + '" data-f="fps">' : '<span class="muted">timed</span>') + '</td></tr>').join('') +
      '</tbody></table>' +
      '<canvas data-k="prev" class="prev" aria-label="Sheet preview with frame numbers"></canvas>' +
      '</div></div></details>';
    const q = k => root.querySelector('[data-k="' + k + '"]');
    const qa = (a, f) => root.querySelector('[data-a="' + a + '"][data-f="' + f + '"]');

    function sync() {                                 // fields <- sheet
      const S = sheets[role];
      q('ctl').hidden = !S; if (!S) return;
      ['cw', 'ch', 'ox', 'oy', 'gap', 'feet', 'tol', 'scale', 'target', 'contact', 'contact2'].forEach(k => { q(k).value = S[k]; });
      q('mode').value = S.mode; q('flip').checked = S.flip; q('glob').checked = S.glob; q('tint').value = S.tint;
      root.querySelectorAll('[data-g]').forEach(el => { el.hidden = el.dataset.g !== S.mode; });
      ANIMS.forEach(a => { qa(a[0], 'frames').value = fmtList(S.anims[a[0]].list); const el = qa(a[0], 'fps'); if (el) el.value = S.anims[a[0]].fps; });
      q('name').textContent = S.name + ' · ' + S.raw.width + '×' + S.raw.height + ' px · ' + S.frames.length + ' frames found';
      preview();
    }
    function preview() {
      const S = sheets[role], c = q('prev'); if (!S) return;
      const z = Math.max(1, Math.min(4, Math.floor(400 / S.raw.width)));
      c.width = S.raw.width * z; c.height = S.raw.height * z;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      g.fillStyle = '#2a2336'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(S.canvas, 0, 0, c.width, c.height);
      g.font = '10px monospace'; g.textBaseline = 'top';
      const used = new Set();
      ANIMS.forEach(a => S.anims[a[0]].list.forEach(i => used.add(i)));
      S.frames.forEach((f, i) => {
        g.strokeStyle = used.has(i) ? 'rgba(240,195,90,.9)' : 'rgba(150,140,175,.45)'; g.lineWidth = 1;
        g.strokeRect(f.sx * z + .5, f.sy * z + .5, f.sw * z - 1, f.sh * z - 1);
        if (S.frames.length <= 220) { const t = String(i), w = g.measureText(t).width + 4; g.fillStyle = 'rgba(18,14,25,.85)'; g.fillRect(f.sx * z + 1, f.sy * z + 1, w, 12); g.fillStyle = used.has(i) ? '#f0c35a' : '#cfc6e0'; g.fillText(t, f.sx * z + 3, f.sy * z + 2); }
      });
    }
    function read(rekey) {                            // sheet <- fields
      const S = sheets[role]; if (!S) return;
      const n = (k, d) => { const v = parseFloat(q(k).value); return isNaN(v) ? d : v; };
      S.mode = q('mode').value; S.flip = q('flip').checked;
      S.cw = Math.max(4, n('cw', S.cw)); S.ch = Math.max(4, n('ch', S.ch)); S.ox = Math.max(0, n('ox', 0)); S.oy = Math.max(0, n('oy', 0));
      S.gap = Math.max(1, n('gap', 2)); S.feet = Math.max(0, n('feet', 0)); S.tol = n('tol', 24); S.scale = Math.max(0.1, n('scale', 1));
      S.target = Math.max(10, n('target', 80)); S.contact = Math.max(0, n('contact', 0)); S.contact2 = Math.max(0, n('contact2', 0));
      S.glob = q('glob').checked; S.tint = q('tint').value;
      ANIMS.forEach(a => { S.anims[a[0]].list = parseList(qa(a[0], 'frames').value); const el = qa(a[0], 'fps'); if (el) S.anims[a[0]].fps = Math.max(1, parseInt(el.value, 10) || 1); });
      rebuild(S, rekey); sync();
    }
    function set(img, name, cfg) {
      const S = newSheet(img, name); sheets[role] = S;
      if (cfg) { Object.keys(cfg).forEach(k => { if (k !== 'anims') S[k] = cfg[k]; }); Object.keys(cfg.anims || {}).forEach(id => { const a = cfg.anims[id]; if (a.frames != null) S.anims[id].list = parseList(a.frames); if (a.fps != null) S.anims[id].fps = a.fps; }); }
      rebuild(S, true); sync(); hooks.changed(role);
    }
    api[role] = { set };

    q('file').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { set(img, file.name); URL.revokeObjectURL(url); };
      img.onerror = () => { q('name').textContent = 'That file could not be read as an image.'; URL.revokeObjectURL(url); };
      img.src = url; e.target.value = '';
    });
    root.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => hooks.usePreset(role, b.dataset.p)));
    q('bake').addEventListener('click', () => { const c = hooks.bake(role); set(c, 'placeholder sheet'); });
    q('off').addEventListener('click', () => { delete sheets[role]; sync(); hooks.changed(role); q('name').textContent = 'No sheet loaded. The rectangle figure is used.'; });
    q('fit').addEventListener('click', () => {
      const S = sheets[role]; if (!S) return;
      const A = S.anims.idle, h = contentHeight(S, A.list.length ? A.list[0] : 0);
      if (h > 0) { S.scale = Math.round(S.target / h * 100) / 100; sync(); }
    });
    root.querySelectorAll('input[data-k], select[data-k], input[data-a]').forEach(el => {
      if (el.dataset.k === 'file') return;
      const rekey = el.dataset.k === 'tol' || el.dataset.k === 'glob';
      el.addEventListener('change', () => read(rekey));
    });
    sync();
  }

  return {
    has: role => !!(sheets[role] && sheets[role].frames.length),
    get: role => sheets[role],
    pick, drawFrame, buildPanel,
    apply: (role, img, name, cfg) => api[role] && api[role].set(img, name, cfg),
  };
})();
