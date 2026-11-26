/* Camp art, drawn in code on the 640x360 stage: an open field with tents, a fire ring, and one prop per station.
   makeCampBg() paints everything that does not move once; drawCampLive() adds the fire, flags and smoke each frame;
   drawStation() draws a station's prop. Original pixel art, no outside assets. */

const OUT = '#1a1420', FX = 336, FY = 232;
const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function disc(c, cx, cy, r, col) { for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); R(c, col, cx - w, cy + y, w * 2 + 1, 1); } }
function ell(c, cx, cy, rx, ry, col) { for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01))); R(c, col, cx - w, cy + y, w * 2 + 1, 1); } }
function box(c, x, y, w, h, col, edge) { R(c, edge || OUT, x - 1, y - 1, w + 2, h + 2); R(c, col, x, y, w, h); }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join(''); }

/* ---------- pieces ---------- */
function tree(c, x, base, s) {                                   // a round-crowned tree; s is the size
  const h = Math.round(22 * s), r = Math.round(15 * s);
  R(c, OUT, x - 4 * s, base - h, 8 * s + 2, h + 1); R(c, '#6a4a2e', x - 3 * s, base - h, 6 * s, h); R(c, '#4a3220', x + s, base - h, 2 * s, h);
  const top = base - h - r * 0.4;
  [[-0.7, 0.2, 0.75], [0.7, 0.25, 0.7], [0, -0.5, 0.95], [-0.2, 0.3, 0.8]].forEach(([dx, dy, k]) => disc(c, Math.round(x + dx * r), Math.round(top + dy * r), Math.round(r * k) + 1, OUT));
  [[-0.7, 0.2, 0.75, '#2f6a34'], [0.7, 0.25, 0.7, '#2a5e30'], [0, -0.5, 0.95, '#3f8a3f'], [-0.2, 0.3, 0.8, '#357a38']].forEach(([dx, dy, k, col]) => disc(c, Math.round(x + dx * r), Math.round(top + dy * r), Math.round(r * k), col));
  disc(c, Math.round(x - r * 0.3), Math.round(top - r * 0.6), Math.round(r * 0.4), '#5aa84c');
  disc(c, Math.round(x + r * 0.35), Math.round(top - r * 0.3), Math.round(r * 0.22), '#6dbb58');
}
function bush(c, x, base, w) { ell(c, x, base - 4, w / 2 + 1, 6, OUT); ell(c, x, base - 4, w / 2, 5, '#2f6a34'); ell(c, x - w / 5, base - 6, w / 3, 3, '#4a9a46'); R(c, '#e8d870', x + w / 5, base - 6, 2, 2); R(c, '#e86a6a', x - w / 4, base - 4, 2, 2); }
function shadow(c, x, base, rx) { c.fillStyle = 'rgba(20,40,20,.28)'; for (let y = -3; y <= 3; y++) { const w = Math.floor(rx * Math.sqrt(1 - (y * y) / 10)); c.fillRect(Math.round(x - w), Math.round(base + y), w * 2, 1); } }

/* an A-frame tent. stripes: [colour, colour] alternates every 7px; flags are drawn live */
function tent(c, flags, x, base, w, h, a, b, trim, flagCol) {
  shadow(c, x + 3, base, w / 2 + 6);
  const dark = shade(a, 0.78);
  for (let i = 0; i < h; i++) {
    const y = base - h + i, half = Math.round(2 + (i + 0.5) / h * (w / 2 - 2));
    R(c, OUT, x - half - 1, y, half * 2 + 2, 1);
  }
  for (let i = 0; i < h; i++) {
    const y = base - h + i, half = Math.round(2 + (i + 0.5) / h * (w / 2 - 2));
    for (let px = -half; px < half; px++) {
      const stripe = Math.floor((px + 400) / 7) % 2 === 0 ? a : b; let col = stripe;
      if (px >= 0) col = shade(col, 0.8);
      R(c, col, x + px, y, 1, 1);
    }
  }
  for (let i = 0; i < h; i++) { const y = base - h + i, half = Math.round(2 + (i + 0.5) / h * (w / 2 - 2)); R(c, trim, x - half, y, 1, 1); R(c, shade(trim, 0.7), x + half - 1, y, 1, 1); }
  R(c, OUT, x - 1, base - h - 4, 3, 5); R(c, trim, x, base - h - 3, 1, 3);                // ridge cap
  const eh = Math.round(h * 0.62);                                                          // the doorway: a dark triangle with two flaps
  for (let i = 0; i < eh; i++) { const y = base - eh + i, half = Math.round(1 + (i + 0.5) / eh * (w * 0.15)); R(c, '#1c1222', x - half, y, half * 2, 1); }
  for (let i = 0; i < eh; i++) { const y = base - eh + i, half = Math.round(1 + (i + 0.5) / eh * (w * 0.15)); R(c, a, x - half - 2, y, 2, 1); R(c, dark, x + half, y, 2, 1); }
  R(c, '#2a1c2a', x - 1, base - 3, 2, 3);
  R(c, OUT, x - w / 2 - 1, base, w + 2, 2); R(c, shade(a, 0.6), x - w / 2, base, w, 1);   // hem
  [[-w / 2 - 7, 5], [w / 2 + 7, 5]].forEach(([dx]) => { c.strokeStyle = '#d8c8a0'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + (dx > 0 ? w / 4 : -w / 4) + 0.5, base - h * 0.45); c.lineTo(x + dx + 0.5, base + 1); c.stroke(); R(c, '#6a4a2e', x + dx - 1, base - 1, 2, 3); });
  if (flagCol) flags.push({ x, y: base - h - 3, col: flagCol });
}

/* a bell pavilion: round roof, striped walls, scalloped edge */
function pavilion(c, flags, x, base, w, h, a, b, trim, flagCol) {
  shadow(c, x + 4, base, w / 2 + 8);
  const wall = Math.round(h * 0.4), roofH = h - wall;
  for (let i = 0; i < roofH; i++) { const y = base - h + i, half = Math.round(3 + Math.pow((i + 1) / roofH, 0.75) * (w / 2 + 3 - 3)); R(c, OUT, x - half - 1, y, half * 2 + 2, 1); }
  R(c, OUT, x - w / 2 - 1, base - wall - 1, w + 2, wall + 2);
  for (let i = 0; i < roofH; i++) {
    const y = base - h + i, half = Math.round(3 + Math.pow((i + 1) / roofH, 0.75) * (w / 2));
    for (let px = -half; px < half; px++) { let col = Math.floor((px + 400) / 8) % 2 === 0 ? a : b; if (px >= 0) col = shade(col, 0.8); R(c, col, x + px, y, 1, 1); }
  }
  for (let px = -w / 2; px < w / 2; px++) for (let y = 0; y < wall; y++) { let col = Math.floor((px + 400) / 8) % 2 === 0 ? a : b; col = shade(col, y < 3 ? 0.62 : 0.88); if (px >= 0) col = shade(col, 0.82); R(c, col, x + px, base - wall + y, 1, 1); }
  for (let px = -w / 2; px < w / 2; px += 6) { disc(c, Math.round(x + px + 3), base - wall - 1, 3, OUT); }
  for (let px = -w / 2; px < w / 2; px += 6) { disc(c, Math.round(x + px + 3), base - wall - 1, 2, trim); }
  const dw = Math.round(w * 0.17);
  R(c, '#1c1222', x - dw, base - wall + 2, dw * 2, wall - 2); for (let i = 0; i < wall - 2; i++) { R(c, a, x - dw - 3 + Math.round(i * 0.12), base - wall + 2 + i, 3, 1); R(c, shade(a, 0.78), x + dw - Math.round(i * 0.12), base - wall + 2 + i, 3, 1); }
  R(c, OUT, x - 1, base - h - 6, 3, 8); disc(c, x, base - h - 7, 2, trim);
  if (flagCol) flags.push({ x, y: base - h - 8, col: flagCol });
}
function logSeat(c, x, y, w) { box(c, x, y, w, 5, '#7a5634'); R(c, '#9a7448', x + 1, y, w - 2, 1); R(c, '#4a3220', x + 1, y + 4, w - 2, 1); R(c, '#d8b886', x, y + 1, 2, 3); R(c, '#c2a070', x + w - 2, y + 1, 2, 3); }
function crate(c, x, y, s) { box(c, x, y, s, s, '#9a7448'); R(c, '#6a4a2e', x, y + s / 2, s, 1); R(c, '#6a4a2e', x + s / 2, y, 1, s); R(c, '#b8905c', x + 1, y + 1, s - 2, 1); }
function barrel(c, x, y) { box(c, x, y, 9, 11, '#8a6040'); R(c, '#5a3c26', x, y + 2, 9, 1); R(c, '#5a3c26', x, y + 8, 9, 1); R(c, '#a87a52', x + 1, y + 3, 2, 5); }
function hay(c, x, y, w) { ell(c, x + w / 2, y + 5, w / 2 + 1, 6, OUT); ell(c, x + w / 2, y + 5, w / 2, 5, '#d8b858'); R(c, '#b8963e', x + 3, y + 5, w - 6, 1); R(c, '#f0d880', x + 4, y + 2, w / 2, 1); }
function fence(c, x, y, n) { for (let i = 0; i < n; i++) { const px = x + i * 14; R(c, OUT, px - 1, y - 12, 4, 14); R(c, '#8a6a46', px, y - 11, 2, 12); } R(c, OUT, x - 1, y - 9, n * 14 - 12, 3); R(c, '#9a7a52', x, y - 8, n * 14 - 14, 1); R(c, OUT, x - 1, y - 4, n * 14 - 12, 3); R(c, '#8a6a46', x, y - 3, n * 14 - 14, 1); }
function lantern(c, x, y) { R(c, OUT, x - 1, y - 14, 3, 16); R(c, '#6a4a2e', x, y - 14, 1, 16); box(c, x + 1, y - 12, 5, 6, '#ffd86a'); R(c, '#fff2b0', x + 2, y - 11, 2, 3); }

/* ---------- the static background ---------- */
export function makeCampBg(W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), rnd = rng(11);
  const HZ = 168;
  // sky in bands
  [['#4f93dc', 0], ['#5da0e2', 34], ['#70afe8', 66], ['#88c0ee', 92], ['#a6d2f2', 116], ['#c4e2f4', 138], ['#dcefF4', 154]].forEach(([col, y], i, a) => R(c, col, 0, y, W, (a[i + 1] ? a[i + 1][1] : HZ + 8) - y));
  // clouds
  const cloud = (x, y, k) => { [[0, 0, 15], [14, -5, 12], [28, 0, 14], [12, 3, 12]].forEach(([dx, dy, r]) => ell(c, Math.round(x + dx * k), Math.round(y + dy * k), Math.round(r * k * 1.5), Math.round(r * k * 0.6), '#f6fbff')); ell(c, Math.round(x + 14 * k), Math.round(y + 6 * k), Math.round(26 * k), Math.round(4 * k), '#d4e6f2'); };
  cloud(70, 44, 1); cloud(300, 28, 0.8); cloud(470, 60, 1.1); cloud(590, 34, 0.7); cloud(190, 86, 0.6);
  // far mountains, two ridges
  for (let x = 0; x < W; x += 2) { const h1 = 34 + Math.sin(x / 70) * 14 + Math.sin(x / 23 + 1) * 5, h2 = 18 + Math.sin(x / 45 + 2) * 8 + Math.sin(x / 13) * 3; R(c, '#9db8d4', x, HZ - h1, 2, h1 + 2); R(c, '#b4cce2', x, HZ - h1, 2, 2); R(c, '#7ea3bf', x, HZ - h2, 2, h2 + 2); }
  // treeline
  for (let x = -6; x < W + 8; x += 7) { const r = 7 + Math.floor(rnd() * 5); disc(c, x, HZ - r + 4, r + 1, '#1f4a2c'); }
  for (let x = -3; x < W + 8; x += 7) { const r = 6 + Math.floor(rnd() * 4); disc(c, x, HZ - r + 6, r, '#2c6a38'); R(c, '#3f8444', x - r / 2, HZ - r - 1, r / 2, 1); }
  // the field
  R(c, '#4a8a42', 0, HZ + 2, W, H - HZ);
  [[HZ + 2, 14, '#5b9a4c'], [HZ + 16, 12, '#52924a'], [HZ + 28, 22, '#4a8a42'], [HZ + 50, 40, '#46853f'], [HZ + 90, 120, '#417d3b']].forEach(([y, h, col]) => R(c, col, 0, y, W, h));
  for (let i = 0; i < 520; i++) {                                // grass tufts, bigger toward the front
    const y = HZ + 6 + rnd() * (H - HZ - 6), k = 1 + Math.floor((y - HZ) / 60), x = Math.floor(rnd() * W), dk = rnd() < 0.5;
    R(c, dk ? '#356f33' : '#69ad55', x, y, 1, k + 1); R(c, dk ? '#356f33' : '#69ad55', x + 2 + k, y + 1, 1, k); if (k > 1) R(c, dk ? '#356f33' : '#69ad55', x + 1, y - 1, 1, k);
  }
  // the trodden camp ground and two paths
  const cx = 336, cy = 266;
  for (let y = cy - 62; y <= cy + 66; y++) {
    const u = (y - cy) / 64, hw = Math.floor(318 * Math.sqrt(Math.max(0, 1 - u * u))) + Math.floor(rnd() * 3);
    if (hw <= 0) continue; R(c, '#8e7048', cx - hw, y, hw * 2, 1); R(c, '#a08256', cx - hw + 4, y, hw * 2 - 8, 1);
  }
  for (let i = 0; i < 700; i++) { const x = cx + (rnd() * 2 - 1) * 300, y = cy + (rnd() * 2 - 1) * 58, u = (y - cy) / 64; if (Math.abs(x - cx) > 318 * Math.sqrt(Math.max(0, 1 - u * u)) - 3) continue; R(c, rnd() < 0.5 ? '#78603c' : '#b89a68', x, y, 1 + Math.floor(rnd() * 2), 1); }
  for (let y = cy - 60; y <= cy + 64; y++) { const u = (y - cy) / 64, hw = Math.floor(318 * Math.sqrt(Math.max(0, 1 - u * u))); if (hw > 0) { R(c, '#6a5232', cx - hw, y, 1, 1); R(c, '#6a5232', cx + hw - 1, y, 1, 1); } }
  // flowers, mostly in the grass at the back and the front
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rnd() * W), y = HZ + 8 + Math.floor(rnd() * (H - HZ - 10)), u = (y - cy) / 64; if (Math.abs(u) < 1 && Math.abs(x - cx) < 318 * Math.sqrt(1 - u * u) + 4) continue;
    const col = ['#f4f0e0', '#f4d85a', '#e8685a', '#b88af0'][Math.floor(rnd() * 4)]; R(c, col, x, y, 2, 2); R(c, '#3a7a38', x, y + 2, 1, 2);
  }
  // back row: trees at the edges, tents and fences along the top of the camp ground
  const back = [['tree', 20, 206, 1.5], ['tree', 70, 190, 1.05], ['tree', 616, 204, 1.45], ['tree', 566, 188, 1.0], ['tree', 626, 246, 1.15], ['tree', 10, 250, 1.15],
    ['bush', 112, 206, 24], ['bush', 520, 198, 22], ['bush', 600, 236, 18], ['bush', 40, 240, 16], ['bush', 330, 190, 20]];
  const flags = flagsOut; flags.length = 0;
  fence(c, 244, 190, 14); fence(c, 400, 190, 4);
  back.filter(b => b[2] < 200).forEach(b => b[0] === 'tree' ? tree(c, b[1], b[2], b[3]) : bush(c, b[1], b[2], b[3]));
  pavilion(c, flags, 92, 200, 70, 52, '#7a5ab8', '#e8dcc8', '#c2413b', '#c2413b');
  tent(c, flags, 176, 196, 58, 40, '#c8b890', '#a89870', '#7a6a48', '#3a8a5a');
  tent(c, flags, 504, 198, 62, 42, '#4a78b0', '#e0e4ec', '#2a4a78', '#e8c24a');
  pavilion(c, flags, 584, 204, 66, 48, '#b8483a', '#e8dcc8', '#e8c24a', '#7a5ab8');
  back.filter(b => b[2] >= 200).forEach(b => b[0] === 'tree' ? tree(c, b[1], b[2], b[3]) : bush(c, b[1], b[2], b[3]));
  // odds and ends
  barrel(c, 214, 204); barrel(c, 226, 206); crate(c, 252, 200, 11); crate(c, 264, 204, 9); hay(c, 392, 202, 26); hay(c, 422, 206, 22); crate(c, 446, 202, 10); barrel(c, 540, 208); crate(c, 612, 268, 12);
  lantern(c, 150, 214); lantern(c, 470, 214);
  // the fire ring: stones, log seats and a cooking tripod
  const fx = FX, fy = FY;
  shadow(c, fx, fy + 6, 30);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, sx = fx + Math.cos(a) * 17, sy = fy + 3 + Math.sin(a) * 6; if (Math.sin(a) < 0.1) box(c, sx - 3, sy - 3, 6, 5, i % 2 ? '#8a8a92' : '#a0a0a8'); }
  R(c, '#2a1c1a', fx - 12, fy, 24, 5); R(c, '#3a2824', fx - 9, fy + 1, 18, 3);
  logSeat(c, fx - 56, fy + 2, 26); logSeat(c, fx + 30, fy + 3, 26); logSeat(c, fx - 14, fy + 15, 28);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, sx = fx + Math.cos(a) * 17, sy = fy + 3 + Math.sin(a) * 6; if (Math.sin(a) >= 0.1) box(c, sx - 3, sy - 3, 6, 5, i % 2 ? '#8a8a92' : '#a0a0a8'); }
  R(c, OUT, fx - 22, fy - 34, 3, 38); R(c, '#6a4a2e', fx - 21, fy - 34, 1, 38); R(c, OUT, fx + 20, fy - 34, 3, 38); R(c, '#6a4a2e', fx + 21, fy - 34, 1, 38);
  R(c, OUT, fx - 22, fy - 35, 46, 3); R(c, '#7a5a3a', fx - 21, fy - 34, 44, 1);
  return { canvas: cv, flags };
}
const flagsOut = [];

/* ---------- live: fire, smoke and flags ---------- */
export function drawCampLive(c, t, flags) {
  const fx = FX, fy = FY;
  // glow
  const g = c.createRadialGradient(fx, fy - 6, 2, fx, fy - 6, 70); g.addColorStop(0, 'rgba(255,190,90,.30)'); g.addColorStop(1, 'rgba(255,190,90,0)'); c.fillStyle = g; c.fillRect(fx - 70, fy - 76, 140, 140);
  // the pot hanging from the tripod bar
  R(c, OUT, fx - 1, fy - 33, 3, 12); R(c, '#4a4a52', fx, fy - 33, 1, 12); box(c, fx - 7, fy - 22, 14, 10, '#4a4e58'); R(c, '#6a7080', fx - 6, fy - 21, 3, 7); R(c, '#2a2e36', fx - 7, fy - 22, 14, 2); R(c, '#c86a3a', fx - 5, fy - 22, 10, 1);
  // flames
  const f1 = Math.sin(t * 11) * 1.5, f2 = Math.sin(t * 7 + 1) * 1.5, f3 = Math.sin(t * 13 + 2);
  const flame = (x, w, h, col) => { for (let i = 0; i < h; i++) { const k = 1 - i / h, ww = Math.max(1, Math.round(w * k * (0.6 + 0.4 * Math.sin(i * 0.9 + t * 14 + x)))); R(c, col, x - ww / 2, fy + 1 - i, ww, 1); } };
  flame(fx - 7, 7, 13 + f1, '#e8602a'); flame(fx + 7, 7, 12 + f2, '#e8602a'); flame(fx, 11, 19 + f1 + f3, '#f08a3a'); flame(fx - 3, 7, 14 + f2, '#ffb84a'); flame(fx + 3, 6, 12 + f1, '#ffd86a'); flame(fx, 4, 8 + f3, '#fff2b0');
  // embers rising
  for (let i = 0; i < 5; i++) { const u = ((t * 0.7 + i * 0.21) % 1), x = fx + Math.sin(t * 2 + i * 3) * 8 + (i - 2) * 3, y = fy - 8 - u * 46; c.globalAlpha = 1 - u; R(c, i % 2 ? '#ffd86a' : '#ff9a4a', x, y, 1, 1); } c.globalAlpha = 1;
  // a thin smoke trail
  for (let i = 0; i < 6; i++) { const u = ((t * 0.25 + i / 6) % 1), x = fx + 4 + Math.sin(t + i) * 4 + u * 10, y = fy - 28 - u * 70, r = 2 + u * 4; c.globalAlpha = 0.28 * (1 - u); disc(c, Math.round(x), Math.round(y), Math.round(r), '#d8d8e0'); } c.globalAlpha = 1;
  // flags
  for (const f of flags || []) {
    for (let i = 0; i < 14; i++) { const w = Math.sin(t * 5 + i * 0.5 + f.x) * (1 + i * 0.15); R(c, OUT, f.x + 1 + i, f.y + w - 1, 1, 8); R(c, i % 7 < 1 ? shade(f.col, 1.2) : f.col, f.x + 1 + i, f.y + w, 1, 6 - Math.floor(i / 5)); }
  }
}

/* ---------- station props, drawn on the ground line at (x, base) ---------- */
export function drawStation(c, id, x, base, near, t) {
  c.save(); c.translate(Math.round(x), base);
  shadow(c, 2, 1, 26);
  if (id === 'stats') {                                           // the trainer: a banner pole and a sparring post
    R(c, OUT, -22, -52, 3, 54); R(c, '#7a5a3a', -21, -52, 1, 54); R(c, OUT, 14, -52, 3, 54); R(c, '#7a5a3a', 15, -52, 1, 54); R(c, OUT, -22, -53, 40, 3); R(c, '#8a6a46', -21, -52, 38, 1);
    for (let i = 0; i < 26; i++) { const w = Math.round(Math.sin(t * 3 + i * 0.3) * 0.6); R(c, OUT, -17 + i * 1, -49 + w, 1, 1); } box(c, -18, -49, 30, 24, '#b83a3a'); R(c, '#d85a4a', -17, -48, 28, 2); for (let i = 0; i < 6; i++) R(c, '#b83a3a', -18 + i * 6, -26 + (i % 2) * 2, 4, 3);
    R(c, '#f0d880', -4, -44, 2, 14); R(c, '#f0d880', -8, -38, 10, 2); R(c, '#f0d880', -4, -46, 2, 2);        // a sword emblem
    box(c, 22, -22, 8, 24, '#8a6040'); R(c, '#a87a52', 23, -21, 2, 20); R(c, '#d8c8a0', 22, -14, 8, 2);          // a sparring post
  } else if (id === 'shop') {                                     // the smith: forge, anvil and stump
    box(c, -26, -22, 24, 22, '#7a7a84'); R(c, '#9a9aa4', -25, -21, 22, 2); R(c, '#5a5a64', -25, -10, 22, 1); R(c, '#5a5a64', -14, -21, 1, 20);
    const glow = 0.7 + Math.sin(t * 9) * 0.3; R(c, '#2a1c1a', -22, -17, 16, 8); R(c, 'rgba(255,' + Math.round(110 + 80 * glow) + ',40,1)', -21, -16, 14, 5); R(c, '#ffd86a', -17, -16, 6, 2);
    box(c, -22, -34, 16, 10, '#5a5a64'); R(c, '#7a7a84', -21, -33, 14, 1);                                          // chimney
    box(c, 6, -6, 14, 6, '#3a3a44'); R(c, '#5a5a68', 6, -7, 14, 1); R(c, OUT, 3, -10, 22, 4); R(c, '#4a4a58', 4, -9, 20, 2); R(c, '#6a6a7a', 4, -9, 16, 1);    // anvil
    box(c, 10, -1, 6, 4, '#6a4a2e'); box(c, 24, -4, 6, 5, '#7a5634');
    R(c, OUT, 29, -16, 2, 14); R(c, '#9aa4b0', 29, -15, 1, 10); R(c, '#6a4a2e', 28, -4, 3, 4);                       // a sword for sale
    if (Math.sin(t * 6) > 0.85) { R(c, '#ffd86a', 8 + Math.sin(t * 20) * 4, -14, 1, 1); R(c, '#ffb84a', 14, -17, 1, 1); }
  } else if (id === 'style') {                                    // style: a weapon rack
    R(c, OUT, -20, -44, 3, 46); R(c, '#7a5a3a', -19, -44, 1, 46); R(c, OUT, 17, -44, 3, 46); R(c, '#7a5a3a', 18, -44, 1, 46); R(c, OUT, -20, -46, 40, 3); R(c, '#8a6a46', -19, -45, 38, 1); R(c, OUT, -20, -20, 40, 3); R(c, '#8a6a46', -19, -19, 38, 1);
    R(c, '#c8ccd4', -13, -42, 2, 22); R(c, '#e8ecf4', -13, -42, 1, 22); R(c, OUT, -16, -26, 8, 3); R(c, '#e8c24a', -15, -26, 6, 1); R(c, '#6a4a2e', -13, -23, 2, 5);
    R(c, '#7a5a3a', -2, -42, 2, 36); R(c, '#c8ccd4', -5, -42, 8, 6); R(c, '#9aa0aa', -5, -37, 8, 1); R(c, OUT, -6, -43, 10, 1);
    R(c, '#c8ccd4', 8, -44, 2, 10); R(c, '#e8ecf4', 8, -44, 1, 8); R(c, '#7a5a3a', 8, -34, 2, 26);
    box(c, 8, -12, 8, 12, '#a85a3a'); R(c, '#e8c24a', 11, -9, 2, 6);                                                  // a shield on the ground
  } else if (id === 'hire') {                                     // hire board: a lean-to with notices
    R(c, OUT, -24, -42, 3, 44); R(c, '#7a5a3a', -23, -42, 1, 44); R(c, OUT, 22, -42, 3, 44); R(c, '#7a5a3a', 23, -42, 1, 44);
    box(c, -22, -32, 46, 26, '#8a6a46'); R(c, '#a08256', -21, -31, 44, 1); R(c, '#6a4a2e', -21, -7, 44, 1);
    const note = (nx, ny, w, h, col) => { R(c, col, nx, ny, w, h); R(c, '#4a3220', nx + 2, ny + 3, w - 4, 1); R(c, '#4a3220', nx + 2, ny + 6, w - 5, 1); R(c, '#c2413b', nx + w / 2, ny - 1, 1, 2); };
    note(-18, -29, 11, 14, '#f0e8d0'); note(-4, -28, 10, 12, '#e8dcc0'); note(9, -29, 11, 15, '#f4eed8'); note(-14, -14, 12, 7, '#e8dcc0'); note(4, -13, 14, 6, '#f0e8d0');
    for (let i = 0; i < 52; i++) R(c, i % 8 < 4 ? '#c2413b' : '#e8dcc8', -26 + i, -42 + (i % 8 < 4 ? 0 : 1), 1, 6 - Math.round(Math.abs(i - 26) * 0.08));            // striped awning
    R(c, OUT, -26, -43, 52, 1);
  } else {                                                        // the cart: a covered wagon
    box(c, -30, -16, 56, 10, '#8a6040'); R(c, '#a87a52', -29, -15, 54, 2); R(c, '#5a3c26', -29, -8, 54, 1);
    for (let px = -28; px < 24; px++) { const u = (px + 2) / 26, hh = Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * 20); R(c, OUT, px, -16 - hh - 1, 1, 1); R(c, Math.floor((px + 400) / 6) % 2 ? '#ece4d0' : '#d8cfb8', px, -16 - hh, 1, hh); }
    R(c, '#1c1222', -26, -24, 6, 8); R(c, '#2c2230', 16, -24, 8, 8);
    crate(c, 28, -14, 8); R(c, OUT, 26, -10, 18, 3); R(c, '#6a4a2e', 26, -9, 18, 1);                                  // the shaft
    [[-18, 0], [14, 0]].forEach(([wx]) => { disc(c, wx, -6, 8, OUT); disc(c, wx, -6, 7, '#7a5634'); disc(c, wx, -6, 5, '#5a3c26'); disc(c, wx, -6, 2, '#a87a52'); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI; c.strokeStyle = '#a87a52'; c.lineWidth = 1; c.beginPath(); c.moveTo(wx + Math.cos(a) * 6, -6 + Math.sin(a) * 6); c.lineTo(wx - Math.cos(a) * 6, -6 - Math.sin(a) * 6); c.stroke(); } });
  }
  c.restore();
  if (near) { c.save(); c.strokeStyle = 'rgba(255,240,160,.95)'; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.beginPath(); c.ellipse(x, base + 6, 32, 7, 0, 0, 7); c.stroke(); c.restore(); }
}
