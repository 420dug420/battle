/* Run backdrops, painted once into a canvas: retro pixel art, dark and ominous.
   Training Fields: a dead moor under a blood sky and a black sun, a far city of spires, gallows and crows.
   Battlefield: a storm over a pitched battle, a castle burning on the far hill, the enemy host on the ridge, the dead in the mud. */
const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function disc(c, cx, cy, r, col) { for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); R(c, col, cx - w, cy + y, w * 2 + 1, 1); } }
function ell(c, cx, cy, rx, ry, col) { for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01))); R(c, col, cx - w, cy + y, w * 2 + 1, 1); } }
function line(c, col, x0, y0, x1, y1, w = 1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let i = 0; i <= n; i++) { const u = n ? i / n : 0; R(c, col, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, w, w); } }
function tri(c, col, x0, y0, x1, y1, x2, y2) { c.fillStyle = col; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.fill(); }

/* sky in flat bands with a two-row checker dither at every seam: the old 16-bit look */
function bands(c, W, y0, y1, cols) {
  const n = cols.length, h = (y1 - y0) / n;
  cols.forEach((col, i) => R(c, col, 0, y0 + i * h, W, h + 1));
  for (let i = 1; i < n; i++) { const y = Math.round(y0 + i * h); c.fillStyle = cols[i - 1]; for (let x = 0; x < W; x += 2) { c.fillRect(x, y, 1, 1); c.fillRect(x + 1, y + 2, 1, 1); } c.fillStyle = cols[i]; for (let x = 1; x < W; x += 2) c.fillRect(x, y - 1, 1, 1); }
}
/* a dead tree: a trunk that forks into bare, crooked branches */
function tree(c, col, x, y, h, r, depth = 0) {
  const a = -Math.PI / 2 + (r() - 0.5) * 0.5, x1 = x + Math.cos(a) * h, y1 = y + Math.sin(a) * h;
  line(c, col, x, y, x1, y1, depth === 0 ? 3 : depth === 1 ? 2 : 1);
  if (depth >= 3) return;
  const k = 2 + (r() < 0.4 ? 1 : 0);
  for (let i = 0; i < k; i++) { const b = a + (i - (k - 1) / 2) * (0.7 + r() * 0.5); tree2(c, col, x1, y1, h * (0.55 + r() * 0.2), b, r, depth + 1); }
}
function tree2(c, col, x, y, h, a, r, depth) {
  const x1 = x + Math.cos(a) * h, y1 = y + Math.sin(a) * h; line(c, col, x, y, x1, y1, depth <= 1 ? 2 : 1);
  if (depth >= 4 || h < 4) return;
  for (let i = 0; i < 2; i++) tree2(c, col, x1, y1, h * (0.55 + r() * 0.2), a + (i ? 1 : -1) * (0.35 + r() * 0.5), r, depth + 1);
}
function crow(c, x, y, col, fly) {
  if (fly) { R(c, col, x - 3, y, 3, 1); R(c, col, x + 1, y, 3, 1); R(c, col, x - 4, y - 1, 1, 1); R(c, col, x + 4, y - 1, 1, 1); R(c, col, x, y, 1, 2); }
  else { R(c, col, x, y - 3, 2, 2); R(c, col, x - 1, y - 2, 4, 3); R(c, col, x + 3, y - 1, 2, 1); R(c, col, x, y + 1, 1, 1); }
}
function skullPike(c, x, y, h, col) { R(c, col, x, y - h, 1, h); R(c, '#b8ac94', x - 2, y - h - 4, 5, 4); R(c, '#14080a', x - 1, y - h - 3, 1, 1); R(c, '#14080a', x + 1, y - h - 3, 1, 1); R(c, '#8a7e6a', x - 1, y - h, 3, 1); }

/* ---------- Training Fields: 640 x 360, horizon at 196 ---------- */
export function makeFieldsBg(W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), r = rng(613), HZ = 196;
  bands(c, W, 0, HZ, ['#07050b', '#0e0810', '#170b14', '#220e18', '#30111c', '#42151e', '#5a1b20', '#762522', '#923424']);
  for (let i = 0; i < 60; i++) R(c, r() < 0.7 ? '#4a3a48' : '#8a7a86', Math.floor(r() * W), Math.floor(r() * 70), 1, 1);     // a few cold stars up high
  // the black sun: a dark disc in a ring of fire, the sky bleeding around it
  const sx = 476, sy = 86;
  [[64, 'rgba(160,40,30,.10)'], [50, 'rgba(190,50,30,.12)'], [40, 'rgba(220,80,40,.16)'], [33, 'rgba(240,140,70,.30)']].forEach(([rr, col]) => disc(c, sx, sy, rr, col));
  disc(c, sx, sy, 29, '#f0c070'); disc(c, sx, sy, 27, '#d8703a'); disc(c, sx, sy, 25, '#060306');
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + r() * 0.2, l = 4 + r() * 9; line(c, i % 2 ? '#e09050' : '#f8d890', sx + Math.cos(a) * 30, sy + Math.sin(a) * 30, sx + Math.cos(a) * (30 + l), sy + Math.sin(a) * (30 + l)); }
  // long torn clouds across the sun and the low sky
  for (let i = 0; i < 14; i++) { const y = 40 + r() * 120, x = r() * W, w = 50 + r() * 140; ell(c, Math.round(x), Math.round(y), Math.round(w), 1 + Math.round(r() * 2), y < 110 ? 'rgba(8,4,8,.65)' : 'rgba(40,10,14,.55)'); ell(c, Math.round(x + 10), Math.round(y + 2), Math.round(w * 0.7), 1, 'rgba(200,80,50,.18)'); }
  // far mountains, then the city of spires against the glow
  c.fillStyle = '#2c0f18'; c.beginPath(); c.moveTo(0, HZ); for (let x = 0; x <= W; x += 8) c.lineTo(x, HZ - 34 - Math.abs(Math.sin(x / 47)) * 22 - Math.sin(x / 13) * 4 - (r() * 5)); c.lineTo(W, HZ); c.fill();
  const city = (x0, x1, base) => {
    for (let x = x0; x < x1;) {
      const w = 6 + Math.floor(r() * 10), h = 14 + Math.floor(r() * 30), col = '#14070d';
      R(c, col, x, base - h, w, h); tri(c, col, x - 1, base - h, x + w / 2, base - h - 8 - r() * 16, x + w + 1, base - h);
      if (r() < 0.45) R(c, r() < 0.6 ? '#e08a3a' : '#a8402a', x + 2 + Math.floor(r() * (w - 3)), base - h + 4 + Math.floor(r() * (h - 8)), 1, 2);
      x += w + Math.floor(r() * 3);
    }
  };
  city(118, 300, HZ - 26);
  // the cathedral: a great spire over the rest
  R(c, '#14070d', 190, HZ - 92, 16, 66); tri(c, '#14070d', 188, HZ - 92, 198, HZ - 150, 208, HZ - 92); R(c, '#14070d', 178, HZ - 70, 40, 44);
  tri(c, '#14070d', 176, HZ - 70, 184, HZ - 92, 192, HZ - 70); tri(c, '#14070d', 204, HZ - 70, 212, HZ - 94, 220, HZ - 70); R(c, '#e8a04a', 197, HZ - 80, 2, 4); R(c, '#c05030', 196, HZ - 60, 4, 6);
  // the near moor: a black rise with dead trees, gallows, pikes
  c.fillStyle = '#100609'; c.beginPath(); c.moveTo(0, HZ + 2); for (let x = 0; x <= W; x += 4) c.lineTo(x, HZ - 8 - Math.sin(x / 70) * 6 - Math.sin(x / 23 + 1) * 2); c.lineTo(W, HZ + 2); c.fill();
  tree(c, '#0a0406', 44, HZ - 6, 34, r); tree(c, '#0a0406', 330, HZ - 8, 22, r); tree(c, '#0a0406', 600, HZ - 6, 40, r); tree(c, '#0a0406', 560, HZ - 4, 18, r);
  // a gibbet with a cage swinging from it
  R(c, '#0a0406', 96, HZ - 62, 3, 58); R(c, '#0a0406', 96, HZ - 62, 30, 3); line(c, '#0a0406', 99, HZ - 48, 112, HZ - 61, 2); R(c, '#2a1a14', 121, HZ - 59, 1, 10);
  for (let i = 0; i < 4; i++) R(c, '#0a0406', 116 + i * 3, HZ - 49, 1, 14); R(c, '#0a0406', 116, HZ - 49, 10, 1); R(c, '#0a0406', 116, HZ - 35, 10, 1); R(c, '#0a0406', 118, HZ - 52, 6, 3);
  for (const x of [252, 262, 274, 420, 432]) skullPike(c, x, HZ - 2, 24 + Math.floor(r() * 10), '#0a0406');
  crow(c, 64, HZ - 33, '#050203'); crow(c, 113, HZ - 64, '#050203'); crow(c, 612, HZ - 42, '#050203');
  for (let i = 0; i < 7; i++) crow(c, 380 + Math.floor(r() * 180), 40 + Math.floor(r() * 70), '#0a0508', true);
  // ground: black mud and dead grass, red light pooled in the ruts
  bands(c, W, HZ, H, ['#21140f', '#281912', '#2e1d14', '#2a1a12', '#22150e', '#1a100b']);
  [200, 206, 213, 222, 233, 246, 262, 281, 303, 328].forEach(y => R(c, 'rgba(0,0,0,.22)', 0, y, W, 1));
  for (let i = 0; i < 16; i++) { const x = r() * W, y = HZ + 8 + r() * (H - HZ - 20), w = 14 + r() * 40; ell(c, Math.round(x), Math.round(y), Math.round(w), 2 + Math.round(r() * 2), '#140a08'); ell(c, Math.round(x), Math.round(y), Math.round(w * 0.8), 1, 'rgba(150,40,30,.35)'); }
  for (let i = 0; i < 700; i++) { const y = HZ + 2 + r() * (H - HZ), x = Math.floor(r() * W), k = 1 + Math.floor((y - HZ) / 60); R(c, ['#3a2a1a', '#4a3820', '#1a0e0a', '#5a3a22'][Math.floor(r() * 4)], x, Math.floor(y), k, 1); if (r() < 0.12) R(c, '#5a4628', x, Math.floor(y) - k * 2, 1, k * 2); }
  for (let i = 0; i < 12; i++) { const x = Math.floor(r() * W), y = Math.floor(HZ + 20 + r() * (H - HZ - 30)); if (r() < 0.5) { R(c, '#b8ac94', x, y, 3, 2); R(c, '#14080a', x + 1, y, 1, 1); } else { R(c, '#a49a84', x, y, 6, 1); R(c, '#a49a84', x + 6, y - 1, 1, 3); } }    // skulls and bones in the mud
  for (let i = 0; i < 6; i++) ell(c, Math.round(r() * W), HZ + 4 + Math.round(r() * 14), 80 + Math.round(r() * 80), 3, 'rgba(150,60,60,.10)');     // a low red mist on the moor
  for (let y = 0; y < 30; y++) { R(c, 'rgba(0,0,0,' + (0.5 * (1 - y / 30)).toFixed(3) + ')', 0, H - 1 - y, W, 1); }
  for (let x = 0; x < 40; x++) { const a = (0.45 * (1 - x / 40)).toFixed(3); R(c, 'rgba(0,0,0,' + a + ')', x, 0, 1, H); R(c, 'rgba(0,0,0,' + a + ')', W - 1 - x, 0, 1, H); }
  return cv;
}

/* ---------- Battlefield: W x H world px, top = world y of the first row (negative when zoomed out), horizon at world 214 ---------- */
export function makeBattleBg(W, H, top) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), r = rng(977), Y = y => Math.round(y - top), HZ = Y(214);
  bands(c, W, 0, HZ, ['#08070b', '#0d0b11', '#141118', '#1b161e', '#231b22', '#2c1f24', '#3a2224', '#4e2722', '#6a3020', '#8a3c20']);
  // storm clouds: heavy lumps, lit red from the fires below
  for (let k = 0; k < 7; k++) {                                     // cloud banks: long lumpy masses, flat dark undersides lit red from the fires
    const y0 = Math.round(HZ * (0.06 + k * 0.1) + r() * 10), x0 = r() * W - 80, len = 160 + r() * 260, col = k < 3 ? '#0c0a0f' : k < 5 ? '#141017' : '#1c1519', hi = k < 3 ? '#1a151c' : '#261c20';
    for (let x = x0; x < x0 + len; x += 7) { const u = (x - x0) / len, rr = Math.round(6 + Math.sin(u * Math.PI) * (10 + r() * 8)); disc(c, Math.round(x), y0 - Math.round(rr * 0.4), rr, col); R(c, hi, Math.round(x) - 2, y0 - Math.round(rr * 1.3), 4, 1); }
    R(c, col, Math.round(x0), y0, Math.round(len), 3); R(c, 'rgba(150,50,30,.35)', Math.round(x0 + 6), y0 + 3, Math.round(len - 12), 1);
  }
  // a break in the clouds over the far hill, bleeding light
  ell(c, Math.round(W * 0.7), Math.round(HZ * 0.55), Math.round(W * 0.16), 10, 'rgba(200,90,50,.22)'); ell(c, Math.round(W * 0.7), Math.round(HZ * 0.55), Math.round(W * 0.09), 4, 'rgba(240,160,90,.30)');
  // lightning far off
  { let x = Math.round(W * 0.22), y = Math.round(HZ * 0.18); const y1 = HZ - 40; while (y < y1) { const nx = x + Math.round((r() - 0.5) * 10), ny = y + 4 + Math.round(r() * 6); line(c, '#d8d0e8', x, y, nx, ny); if (r() < 0.18) line(c, '#8a84a0', nx, ny, nx + Math.round((r() - 0.5) * 24), ny + 10); x = nx; y = ny; } }
  // far ridge with the enemy host on it: a hedge of pikes and rag banners
  c.fillStyle = '#1e1418'; c.beginPath(); c.moveTo(0, HZ); for (let x = 0; x <= W; x += 6) c.lineTo(x, HZ - 22 - Math.sin(x / 110) * 9 - Math.sin(x / 37) * 3); c.lineTo(W, HZ); c.fill();
  for (let x = Math.round(W * 0.42); x < W; x += 2 + Math.floor(r() * 3)) { const base = HZ - 22 - Math.sin(x / 110) * 9 - Math.sin(x / 37) * 3; R(c, '#120b0e', x, base - 6, 2, 6); if (r() < 0.6) R(c, '#120b0e', x, base - 14 - Math.floor(r() * 6), 1, 10); if (r() < 0.05) { R(c, '#120b0e', x, base - 26, 1, 20); R(c, r() < 0.5 ? '#5a1414' : '#2a1414', x + 1, base - 26, 6, 5); } }
  // the castle burning on the hill
  const cx = Math.round(W * 0.7), hb = HZ - 24;
  c.fillStyle = '#160e12'; c.beginPath(); c.moveTo(cx - 110, HZ); c.quadraticCurveTo(cx, hb - 62, cx + 110, HZ); c.fill();
  const cb = HZ - 40;
  R(c, '#0c080a', cx - 26, cb - 30, 52, 30); R(c, '#0c080a', cx - 34, cb - 44, 12, 44); R(c, '#0c080a', cx + 22, cb - 40, 12, 40); R(c, '#0c080a', cx - 8, cb - 58, 16, 30);
  for (const [x, y] of [[cx - 34, cb - 44], [cx + 22, cb - 40], [cx - 8, cb - 58]]) for (let i = 0; i < 3; i++) R(c, '#0c080a', x + i * 5, y - 3, 3, 3);
  R(c, '#0c080a', cx + 8, cb - 66, 3, 10); line(c, '#0c080a', cx + 10, cb - 66, cx + 22, cb - 72); line(c, '#0c080a', cx + 12, cb - 62, cx + 18, cb - 56);    // a broken roof beam
  for (let i = 0; i < 40; i++) { const x = cx - 30 + Math.floor(r() * 60), y = cb - 6 - Math.floor(r() * 54), s = 1 + Math.floor(r() * 3); R(c, ['#f0d070', '#f09040', '#c84020', '#901a10'][Math.floor(r() * 4)], x, y, s, s + 1); }
  for (const [x, y] of [[cx - 30, cb - 36], [cx - 4, cb - 50], [cx + 26, cb - 30], [cx - 16, cb - 18], [cx + 10, cb - 20]]) { R(c, '#f8c060', x, y, 2, 3); R(c, 'rgba(240,120,40,.35)', x - 2, y - 2, 6, 7); }
  for (let k = 0; k < 3; k++) { const s0 = cx - 14 + k * 16; for (let i = 0; i < 30; i++) { const u = i / 30; disc(c, Math.round(s0 + u * u * 120 + Math.sin(i * 0.7 + k) * 4), Math.round(cb - 46 - u * (cb - 60)), Math.round(3 + u * 13), i % 4 ? '#18111380'.slice(0, 7) : '#24181a'); } }   // smoke leaning away on the wind
  // a broken siege tower and gallows trees on the near side
  const tx = Math.round(W * 0.12), tb = HZ - 2;
  line(c, '#0c0709', tx, tb, tx + 8, tb - 70, 3); line(c, '#0c0709', tx + 30, tb, tx + 24, tb - 58, 3); for (let i = 0; i < 5; i++) line(c, '#0c0709', tx + 1 + i * 1.5, tb - 12 - i * 13, tx + 29 - i * 1.2, tb - 12 - i * 11, 2);
  line(c, '#0c0709', tx + 8, tb - 70, tx + 22, tb - 64, 2); line(c, '#0c0709', tx + 20, tb - 50, tx + 40, tb - 34, 2);
  tree(c, '#0a0607', Math.round(W * 0.34), HZ - 4, 30, r); tree(c, '#0a0607', Math.round(W * 0.93), HZ - 4, 36, r);
  for (let i = 0; i < 9; i++) skullPike(c, Math.round(W * 0.24 + i * 9 + r() * 4), HZ, 18 + Math.floor(r() * 12), '#0a0607');
  for (let i = 0; i < 10; i++) crow(c, Math.round(r() * W * 0.6), Math.round(HZ * 0.25 + r() * HZ * 0.4), '#0a0709', true);
  // ground: trampled mud churned with blood, the dead and what they dropped
  bands(c, W, HZ, H, ['#241a14', '#2a1f17', '#30231a', '#2c2017', '#251a12', '#1c130d']);
  for (let i = 0; i < 26; i++) { const x = r() * W, y = HZ + 6 + r() * (H - HZ - 10), w = 16 + r() * 50; ell(c, Math.round(x), Math.round(y), Math.round(w), 2 + Math.round(r() * 3), r() < 0.35 ? '#3a1210' : '#1a120c'); }
  for (let i = 0; i < 1100; i++) { const y = HZ + 2 + r() * (H - HZ), x = Math.floor(r() * W), k = 1 + Math.floor((y - HZ) / 70); R(c, ['#3a2c1e', '#4a3a26', '#1a120c', '#3a1a14', '#4e4030'][Math.floor(r() * 5)], x, Math.floor(y), k, 1); }
  for (let i = 0; i < 22; i++) {                                   // dropped arms, arrows in the mud, a torn banner, a fallen man
    const x = Math.round(r() * W), y = Math.round(Y(232) + r() * (Y(340) - Y(232))), t = r();
    if (t < 0.25) { R(c, '#4a3a2a', x, y, 10, 1); R(c, '#8a9098', x + 10, y - 1, 14, 2); R(c, '#c8ccd4', x + 10, y - 1, 14, 1); }                           // a sword
    else if (t < 0.45) { for (let k = 0; k < 3; k++) { line(c, '#4a3a26', x + k * 4, y, x + k * 4 + 4, y - 9); R(c, '#c8c0b0', x + k * 4 + 3, y - 10, 2, 2); } }  // arrows
    else if (t < 0.6) { ell(c, x, y, 6, 3, '#3a3438'); ell(c, x, y - 1, 4, 2, '#6a6670'); }                                                                    // a shield or helm
    else if (t < 0.72) { R(c, '#0e0a08', x, y - 1, 14, 1); for (let k = 0; k < 4; k++) R(c, k % 2 ? '#5a1414' : '#2a0e0e', x + 2 + k * 3, y, 3, 4 - k % 2); }   // a torn banner
    else { ell(c, x, y, 10, 3, '#14100e'); R(c, '#2a2420', x - 8, y - 2, 16, 3); R(c, '#4a4450', x - 10, y - 3, 4, 3); R(c, '#3a1210', x + 4, y + 1, 8, 2); }  // a body
  }
  for (let k = 0; k < 5; k++) ell(c, Math.round(r() * W), HZ + 6 + Math.round(r() * 10), 90 + Math.round(r() * 90), 3, 'rgba(130,110,110,.12)');      // smoke drifting low
  for (let y = 0; y < 34; y++) R(c, 'rgba(0,0,0,' + (0.5 * (1 - y / 34)).toFixed(3) + ')', 0, H - 1 - y, W, 1);
  return cv;
}
