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
function shadow(c, x, base, rx) { c.fillStyle = 'rgba(0,0,0,.4)'; for (let y = -3; y <= 3; y++) { const w = Math.floor(rx * Math.sqrt(1 - (y * y) / 10)); c.fillRect(Math.round(x - w), Math.round(base + y), w * 2, 1); } }

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
/* ---------- the camp: a firelit clearing deep in an old, dark forest ---------- */
function pine(c, x, base, h, col, rim) {                            // a fir silhouette, tiered
  const tiers = Math.max(3, Math.round(h / 14));
  R(c, col, x - 1, base - h * 0.25, 3, h * 0.25);
  for (let i = 0; i < tiers; i++) { const ty = base - h * 0.2 - i * (h * 0.8 / tiers), w = Math.round((tiers - i) * h / tiers * 0.42) + 2;
    for (let y = 0; y < h * 0.8 / tiers + 4; y++) { const ww = Math.round(w * (y / (h * 0.8 / tiers + 4))); R(c, col, x - ww, ty - h * 0.8 / tiers - 4 + y, ww * 2 + 1, 1); if (rim && y > 2) R(c, rim, x - ww, ty - h * 0.8 / tiers - 4 + y, 1, 1); } }
}
function trunk(c, x, w, top, base, lean, bark, dark, rnd, rim) {      // rim: +1 lit on the right (the fire's side), -1 on the left          // a huge gnarled trunk with roots, from off-screen top to the ground
  for (let y = top; y < base; y++) { const u = (y - top) / (base - top), off = Math.round(Math.sin(u * 3.1 + x) * 3 + lean * (1 - u) * 18), ww = Math.round(w * (0.85 + 0.35 * u * u));
    R(c, OUT, x + off - 1, y, ww + 2, 1); R(c, bark, x + off, y, ww, 1); R(c, dark, x + off + ww - Math.max(2, ww / 3), y, Math.max(2, ww / 3), 1); R(c, shade(bark, 1.25), x + off + 2, y, 1, 1); if (rim) R(c, '#6a4630', rim > 0 ? x + off + ww - 2 : x + off, y, 2, 1);
    if (rnd() < 0.08) R(c, dark, x + off + 3 + Math.floor(rnd() * (ww - 6)), y, 1, 3 + Math.floor(rnd() * 6)); }
  for (const [dx, len, dir] of [[-4, 26, -1], [w * 0.3, 14, -1], [w * 0.6, 16, 1], [w + 2, 28, 1]]) {      // roots
    for (let i = 0; i < len; i++) { const yy = base - 6 + Math.round(i * 0.35), th = Math.max(1, Math.round(6 * (1 - i / len))); R(c, OUT, x + dx + dir * i - 1, yy - th, 3, th + 1); R(c, bark, x + dx + dir * i, yy - th + 1, 1, th); } }
  const hx = x + w * 0.4, hy = top + (base - top) * 0.55; ell(c, Math.round(hx + 4), Math.round(hy), 4, 6, '#06080a'); ell(c, Math.round(hx + 4), Math.round(hy), 3, 5, '#0c0f12');   // a knot hole
}
function canopy(c, x, y, r, col, hi, rnd) { for (let k = 0; k < 7; k++) disc(c, Math.round(x + (rnd() * 2 - 1) * r), Math.round(y + (rnd() * 2 - 1) * r * 0.45), Math.round(r * (0.45 + rnd() * 0.35)), col); if (hi) for (let k = 0; k < 10; k++) R(c, hi, x + (rnd() * 2 - 1) * r, y + r * 0.2 + rnd() * r * 0.3, 2, 1); }
function moss(c, x, y, len) { for (let i = 0; i < len; i++) R(c, i % 3 ? '#2a3a26' : '#3a4c30', x + Math.round(Math.sin(i * 0.7) * 1), y + i, 1, 1); }
function stump(c, x, base, w) { box(c, x - w / 2, base - 9, w, 9, '#4a3624'); ell(c, x, base - 9, w / 2, 3, '#6a5238'); ell(c, x, base - 9, w / 2 - 2, 2, '#8a6c4a'); R(c, '#4a3624', x - 1, base - 10, 2, 1); }
function rock(c, x, base, w, h) { ell(c, x, base - h / 2, w / 2 + 1, h / 2 + 1, OUT); ell(c, x, base - h / 2, w / 2, h / 2, '#3a3e44'); ell(c, x - w / 6, base - h * 0.65, w / 4, h / 5, '#50565e'); }
function mushroom(c, x, base, glow) { R(c, '#c8c0a8', x, base - 4, 2, 4); R(c, glow ? '#5ac8c8' : '#8a3a3a', x - 2, base - 6, 6, 2); R(c, glow ? '#a8f0f0' : '#c86a5a', x - 1, base - 7, 4, 1); }
function fern(c, x, base, s) { for (let i = -3; i <= 3; i++) { for (let j = 0; j < 6 * s; j++) R(c, j % 2 ? '#1e3020' : '#284028', x + Math.round(i * j * 0.5), base - Math.round(j * (1.6 - Math.abs(i) * 0.25)), 1, 1); } }
function skullStake(c, x, base) { R(c, OUT, x - 1, base - 34, 4, 35); R(c, '#5a4630', x, base - 34, 2, 35); ell(c, x + 1, base - 38, 5, 5, OUT); ell(c, x + 1, base - 38, 4, 4, '#cfc8b4'); R(c, '#1a1414', x - 2, base - 39, 2, 2); R(c, '#1a1414', x + 2, base - 39, 2, 2); R(c, '#1a1414', x, base - 35, 3, 1); R(c, '#9a927e', x - 3, base - 35, 8, 1); }

export function makeCampBg(W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), rnd = rng(23);
  const HZ = 176;
  R(c, '#121a14', 0, 0, W, H);                                     // no gaps: anything left clear would gather the firelight frame after frame
  // night sky, seen through the canopy
  [['#06090f', 0], ['#0a0f18', 30], ['#0e1520', 60], ['#121b26', 92], ['#16202c', 124], ['#1a2430', 150]].forEach(([col, y], i, a) => R(c, col, 0, y, W, (a[i + 1] ? a[i + 1][1] : HZ) - y));
  for (let i = 0; i < 60; i++) R(c, rnd() < 0.7 ? '#4a5466' : '#8a94a8', Math.floor(rnd() * W), Math.floor(rnd() * 120), 1, 1);
  disc(c, 452, 58, 17, '#2a2e2a'); disc(c, 452, 58, 16, '#c8ccb4'); disc(c, 446, 54, 3, '#a8ac98'); disc(c, 458, 63, 4, '#b0b49e'); disc(c, 455, 50, 2, '#a8ac98');   // a pale moon, low
  ell(c, 452, 58, 40, 30, 'rgba(160,170,150,0.05)');
  // three ranks of forest, fading into mist
  const ranks = [[HZ - 2, 70, 92, '#1a2630', '#22303a', 22], [HZ + 6, 60, 82, '#121c22', null, 18], [HZ + 14, 54, 72, '#0b1216', null, 15]];
  ranks.forEach(([base, hMin, hMax, col, rim, gap], ri) => {
    for (let x = -10; x < W + 10; x += gap - 4 + Math.floor(rnd() * 8)) pine(c, x, base + Math.floor(rnd() * 6), hMin + Math.floor(rnd() * (hMax - hMin)), col, rim);
    c.fillStyle = 'rgba(120,140,150,' + (0.10 - ri * 0.025) + ')'; c.fillRect(0, base - 18, W, 16);                  // a band of mist in front of each rank
  });
  // the forest floor
  [['#121a14', HZ + 12], ['#151e16', HZ + 22], ['#182218', HZ + 40], ['#1a2519', HZ + 70], ['#1c271a', HZ + 110]].forEach(([col, y], i, a) => R(c, col, 0, y, W, (a[i + 1] ? a[i + 1][1] : H) - y));
  for (let i = 0; i < 600; i++) { const y = HZ + 14 + rnd() * (H - HZ - 14), k = 1 + Math.floor((y - HZ) / 70), x = Math.floor(rnd() * W), col = ['#22301e', '#2a3a24', '#3a2c1e', '#4a3420', '#162016'][Math.floor(rnd() * 5)]; R(c, col, x, y, k, 1); if (rnd() < 0.3) R(c, col, x + 1, y - 1, 1, k); }
  // the clearing: trodden earth around the fire
  const cx = 336, cy = 268;
  for (let y = cy - 58; y <= cy + 62; y++) { const u = (y - cy) / 60, hw = Math.floor(300 * Math.sqrt(Math.max(0, 1 - u * u))) + Math.floor(rnd() * 4); if (hw <= 0) continue; R(c, '#2e261c', cx - hw, y, hw * 2, 1); R(c, '#352c20', cx - hw + 6, y, hw * 2 - 12, 1); }
  for (let y = cy - 30; y <= cy + 30; y++) { const u = (y - cy) / 30, hw = Math.floor(150 * Math.sqrt(Math.max(0, 1 - u * u))); if (hw > 0) R(c, '#3e3224', cx - hw, y - 10, hw * 2, 1); }
  for (let i = 0; i < 700; i++) { const x = cx + (rnd() * 2 - 1) * 290, y = cy + (rnd() * 2 - 1) * 56, u = (y - cy) / 60; if (Math.abs(x - cx) > 300 * Math.sqrt(Math.max(0, 1 - u * u)) - 3) continue; R(c, ['#241e16', '#4a3c2a', '#5a3a1e', '#3a2a1a'][Math.floor(rnd() * 4)], x, y, 1 + Math.floor(rnd() * 2), 1); }
  // tents at the back of the clearing, cloth gone dull in the dark
  const flags = flagsOut; flags.length = 0;
  pavilion(c, flags, 96, 204, 84, 66, '#4a3a5a', '#7a7262', '#6a2a2a', '#7a2a2a');
  tent(c, flags, 186, 198, 70, 54, '#6a604a', '#544a38', '#3a3226', '#2a5a3a');
  tent(c, flags, 500, 200, 74, 56, '#34465a', '#5a6068', '#22303e', '#8a7a3a');
  pavilion(c, flags, 590, 208, 80, 62, '#5a2c26', '#7a7262', '#8a7a3a', '#4a3a5a');
  // odds and ends of a war camp
  for (const [fn, ...a] of [[crate, 236, 206, 13], [crate, 250, 210, 10], [barrel, 434, 204], [barrel, 446, 207], [crate, 548, 210, 12], [barrel, 162, 212]]) fn(c, ...a);
  stump(c, 300, 214, 14); stump(c, 640 - 28, 300, 18); rock(c, 470, 214, 16, 9); rock(c, 52, 296, 22, 12); rock(c, 604, 252, 14, 8);
  for (const [x, y, g] of [[42, 300, 1], [50, 304, 0], [600, 258, 1], [612, 262, 1], [112, 318, 0], [530, 330, 1], [420, 210, 0]]) mushroom(c, x, y, g);
  for (const [x, y, k] of [[20, 330, 2], [80, 342, 1.5], [560, 344, 2], [624, 330, 1.6], [150, 350, 1.2], [470, 352, 1.4]]) fern(c, x, y, k);
  skullStake(c, 72, 238); skullStake(c, 532, 214);
  lantern(c, 150, 220); lantern(c, 470, 220);
  // the fire ring: stones, log seats and a cooking tripod
  const fx = FX, fy = FY;
  shadow(c, fx, fy + 6, 34);
  const stone = i => { const a = i / 14 * Math.PI * 2, sx = fx + Math.cos(a) * 20, sy = fy + 3 + Math.sin(a) * 7; box(c, sx - 3, sy - 3, 7, 5, i % 2 ? '#4a4c52' : '#5a5c62'); };
  for (let i = 0; i < 14; i++) if (Math.sin(i / 14 * Math.PI * 2) < 0.1) stone(i);
  R(c, '#120c0a', fx - 14, fy, 28, 6); R(c, '#2a1810', fx - 10, fy + 1, 20, 3);
  logSeat(c, fx - 64, fy + 2, 30); logSeat(c, fx + 34, fy + 3, 30); logSeat(c, fx - 16, fy + 17, 32);
  for (let i = 0; i < 14; i++) if (Math.sin(i / 14 * Math.PI * 2) >= 0.1) stone(i);
  R(c, OUT, fx - 24, fy - 40, 3, 44); R(c, '#5a3e26', fx - 23, fy - 40, 1, 44); R(c, OUT, fx + 22, fy - 40, 3, 44); R(c, '#5a3e26', fx + 23, fy - 40, 1, 44);
  R(c, OUT, fx - 24, fy - 41, 50, 3); R(c, '#6a4a2e', fx - 23, fy - 40, 48, 1);
  // the near trees that frame the clearing, and the canopy closing overhead
  trunk(c, -14, 46, -10, 318, 0.4, '#3a3028', '#1c1612', rnd, 1); trunk(c, 44, 18, 40, 236, -0.2, '#342a24', '#1a1410', rnd, 1);
  trunk(c, 606, 48, -10, 322, -0.5, '#3a3028', '#1c1612', rnd, -1); trunk(c, 572, 16, 50, 234, 0.3, '#342a24', '#1a1410', rnd, -1);
  for (const [x, y, r] of [[0, 8, 60], [70, 0, 50], [140, -10, 44], [210, -16, 36], [430, -14, 34], [500, -6, 46], [570, 2, 54], [640, 12, 62], [30, 40, 34], [610, 44, 36]]) canopy(c, x, y, r, '#0a100c', null, rnd);
  for (const [x, y, r] of [[10, 18, 48], [80, 8, 38], [150, 0, 30], [495, 4, 36], [560, 12, 42], [632, 22, 50]]) canopy(c, x, y, r, '#101a12', '#1c2a1c', rnd);
  for (const [x, y, l] of [[60, 30, 26], [96, 22, 18], [130, 14, 30], [520, 18, 24], [556, 28, 34], [598, 40, 20], [180, 6, 16], [470, 8, 20]]) moss(c, x, y, l);
  return { canvas: cv, flags };
}
const flagsOut = [];
const EYES = [[150, 178], [262, 184], [418, 176], [530, 182], [86, 186], [598, 190]];
const FLIES = Array.from({ length: 16 }, (_, i) => [((i * 97) % 600) + 20, 200 + ((i * 53) % 120), i * 1.7]);

/* ---------- live: fire, smoke, fog, eyes in the dark, fireflies and flags ---------- */
export function drawCampLive(c, t, flags) {
  const fx = FX, fy = FY, fl = 0.85 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04;
  // drifting fog low over the floor: soft, wide wisps
  for (let i = 0; i < 5; i++) {
    const x = ((t * (5 + i * 2.5) + i * 190) % 980) - 170, y = 192 + (i % 3) * 9;
    c.save(); c.translate(x, y); c.scale(1, 0.09); const g = c.createRadialGradient(0, 0, 0, 0, 0, 160); g.addColorStop(0, 'rgba(120,135,150,0.10)'); g.addColorStop(1, 'rgba(120,135,150,0)'); c.fillStyle = g; c.fillRect(-160, -160, 320, 320); c.restore();
  }
  // eyes watching from the trees: a pair opens now and then, blinks, and is gone
  EYES.forEach(([x, y], i) => { const v = Math.sin(t * 0.31 + i * 2.3), blink = Math.sin(t * 3.1 + i) > 0.96; if (v > 0.55 && !blink) { const col = i % 3 === 1 ? '#e8d24a' : '#d83a2a'; R(c, col, x, y, 2, 1); R(c, col, x + 5, y, 2, 1); c.globalAlpha = 0.35; R(c, col, x - 1, y - 1, 4, 3); R(c, col, x + 4, y - 1, 4, 3); c.globalAlpha = 1; } });
  // firelight on the clearing
  c.save(); c.globalCompositeOperation = 'lighter';
  let g = c.createRadialGradient(fx, fy - 4, 4, fx, fy - 4, 150 * fl); g.addColorStop(0, 'rgba(255,150,60,.34)'); g.addColorStop(0.45, 'rgba(200,90,30,.12)'); g.addColorStop(1, 'rgba(120,40,10,0)'); c.fillStyle = g; c.fillRect(fx - 160, fy - 160, 320, 320);
  for (const lx of [150, 470]) { g = c.createRadialGradient(lx + 3, 211, 1, lx + 3, 211, 26); g.addColorStop(0, 'rgba(255,200,100,.28)'); g.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = g; c.fillRect(lx - 26, 185, 58, 52); }
  c.restore();
  // the pot hanging from the tripod bar
  R(c, OUT, fx - 1, fy - 39, 3, 14); R(c, '#3a3a42', fx, fy - 39, 1, 14); box(c, fx - 8, fy - 26, 16, 12, '#363a42'); R(c, '#4a505c', fx - 7, fy - 25, 3, 9); R(c, '#1a1e24', fx - 8, fy - 26, 16, 2); R(c, '#c86a3a', fx - 6, fy - 26, 12, 1);
  // flames
  const f1 = Math.sin(t * 11) * 1.5, f2 = Math.sin(t * 7 + 1) * 1.5, f3 = Math.sin(t * 13 + 2);
  const flame = (x, w, h, col) => { for (let i = 0; i < h; i++) { const k = 1 - i / h, ww = Math.max(1, Math.round(w * k * (0.6 + 0.4 * Math.sin(i * 0.9 + t * 14 + x)))); R(c, col, x - ww / 2, fy + 1 - i, ww, 1); } };
  flame(fx - 8, 8, 15 + f1, '#d8502a'); flame(fx + 8, 8, 14 + f2, '#d8502a'); flame(fx, 13, 22 + f1 + f3, '#f07a32'); flame(fx - 3, 8, 16 + f2, '#ffac44'); flame(fx + 3, 7, 13 + f1, '#ffd060'); flame(fx, 5, 9 + f3, '#fff0b0');
  for (let i = 0; i < 7; i++) { const u = ((t * 0.7 + i * 0.17) % 1), x = fx + Math.sin(t * 2 + i * 3) * 9 + (i - 3) * 3, y = fy - 8 - u * 56; c.globalAlpha = 1 - u; R(c, i % 2 ? '#ffd86a' : '#ff8a3a', x, y, 1, 1); } c.globalAlpha = 1;
  for (let i = 0; i < 7; i++) { const u = ((t * 0.22 + i / 7) % 1), x = fx + 4 + Math.sin(t + i) * 5 + u * 14, y = fy - 34 - u * 80, r = 2 + u * 5; c.globalAlpha = 0.22 * (1 - u); disc(c, Math.round(x), Math.round(y), Math.round(r), '#9a9aa4'); } c.globalAlpha = 1;
  // fireflies
  FLIES.forEach(([x0, y0, ph]) => { const x = x0 + Math.sin(t * 0.6 + ph) * 18, y = y0 + Math.sin(t * 0.9 + ph * 2) * 8, on = Math.sin(t * 2.2 + ph * 3); if (on > 0.2) { c.globalAlpha = on; R(c, '#d8f07a', x, y, 1, 1); c.globalAlpha = on * 0.3; R(c, '#d8f07a', x - 1, y - 1, 3, 3); } }); c.globalAlpha = 1;
  // flags
  for (const f of flags || []) for (let i = 0; i < 14; i++) { const w = Math.sin(t * 3 + i * 0.5 + f.x) * (1 + i * 0.12); R(c, OUT, f.x + 1 + i, f.y + w - 1, 1, 8); R(c, i % 7 < 1 ? shade(f.col, 1.2) : f.col, f.x + 1 + i, f.y + w, 1, 6 - Math.floor(i / 5)); }
}
/* drawn over the fighters: the dark of the forest closing in, the fire holding it back */
export function drawCampOver(c, t, W, H) {
  const fl = 1 + Math.sin(t * 9) * 0.03 + Math.sin(t * 21) * 0.02;
  const g = c.createRadialGradient(FX, FY - 10, 60 * fl, FX, FY + 20, 380 * fl);
  g.addColorStop(0, 'rgba(4,6,12,0)'); g.addColorStop(0.5, 'rgba(4,6,12,.18)'); g.addColorStop(1, 'rgba(4,6,12,.62)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

/* ---------- station props, drawn on the ground line at (x, base), at the scale of the fighters ---------- */
export const STATION_TOP = { stats: 84, shop: 64, style: 76, hire: 74, cart: 64 };
export function drawStation(c, id, x, base, near, t) {
  c.save(); c.translate(Math.round(x), base);
  shadow(c, 2, 1, id === 'cart' ? 54 : 32);
  const post = (px, top, h, col) => { R(c, OUT, px - 1, -top, 4, h + 1); R(c, col || '#5a4028', px, -top, 2, h); R(c, shade(col || '#5a4028', 1.3), px, -top, 1, h); };
  if (id === 'stats') {                                           // the trainer: a war banner and a straw-bound sparring pell
    post(-24, 84, 84); R(c, OUT, -26, -86, 8, 3); R(c, '#8a7a3a', -25, -85, 6, 1);
    for (let y = 0; y < 40; y++) { const w = Math.round(Math.sin(t * 2.4 + y * 0.18) * 1.2); R(c, OUT, -21 + w, -80 + y, 26, 1); R(c, y < 3 ? '#8a2a2a' : '#6e2222', -20 + w, -80 + y, 24, 1); R(c, '#4a1616', -20 + w + 20, -80 + y, 4, 1); }
    for (let i = 0; i < 5; i++) R(c, '#6e2222', -20 + i * 5 + Math.round(Math.sin(t * 2.4 + 7) * 1.2), -40, 3, 3 + (i % 2) * 2);
    R(c, '#c8b060', -10, -72, 3, 22); R(c, '#c8b060', -15, -64, 13, 3); R(c, '#c8b060', -10, -75, 3, 3); R(c, '#8a7a3a', -9, -50, 1, 4);   // a sword device
    box(c, 10, -44, 12, 44, '#6a5034'); R(c, '#8a6c48', 11, -43, 3, 42);                                             // the pell
    for (const y of [-38, -26, -12]) { R(c, OUT, 8, y - 1, 16, 6); R(c, '#a8904a', 9, y, 14, 4); R(c, '#c8b060', 9, y, 14, 1); R(c, '#6a5a2a', 9, y + 3, 14, 1); }
    R(c, '#8a8a92', 22, -30, 6, 2); R(c, OUT, 27, -31, 1, 4);                                                       // a nail and notch marks
  } else if (id === 'shop') {                                     // the smith: a stone forge with a chimney, anvil on a stump, quench barrel
    box(c, -34, -30, 34, 30, '#4a4a52'); for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) R(c, (r + k) % 2 ? '#5a5a62' : '#3e3e46', -33 + k * 8 + (r % 2) * 4, -29 + r * 6, 7, 5);
    box(c, -28, -64, 16, 34, '#3e3e46'); for (let r = 0; r < 5; r++) R(c, '#4e4e56', -27, -62 + r * 7, 14, 1);
    const glow = 0.7 + Math.sin(t * 9) * 0.3; R(c, '#120a08', -28, -22, 22, 12); R(c, 'rgb(255,' + Math.round(100 + 90 * glow) + ',40)', -27, -20, 20, 8); R(c, '#ffd86a', -21, -19, 8, 3); R(c, '#fff0b0', -18, -18, 3, 1);
    c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(-17, -16, 1, -17, -16, 30); g.addColorStop(0, 'rgba(255,140,50,' + (0.3 * glow) + ')'); g.addColorStop(1, 'rgba(255,140,50,0)'); c.fillStyle = g; c.fillRect(-47, -46, 60, 60); c.restore();
    box(c, 10, -12, 12, 12, '#5a4028'); ell(c, 16, -12, 6, 2, '#7a5a3a');                                             // stump
    R(c, OUT, 3, -21, 28, 7); R(c, '#3a3a46', 4, -20, 26, 5); R(c, '#6a6a7a', 4, -20, 22, 1); R(c, OUT, 30, -20, 6, 3); R(c, '#3a3a46', 30, -19, 5, 1); box(c, 11, -14, 10, 3, '#2a2a34');   // anvil
    R(c, OUT, 14, -30, 2, 10); R(c, '#6a4a2e', 14, -29, 1, 8); box(c, 11, -32, 8, 4, '#5a5a66');                     // hammer resting on it
    box(c, 36, -16, 13, 16, '#5a3c26'); R(c, '#2a2a30', 36, -12, 13, 2); R(c, '#2a2a30', 36, -5, 13, 2); R(c, '#1a2a3a', 37, -16, 11, 2);   // quench barrel
    R(c, OUT, -42, -36, 2, 36); R(c, '#9aa4b0', -42, -35, 1, 26); R(c, '#6a4a2e', -43, -9, 3, 8); R(c, '#c8a84a', -45, -10, 7, 1);   // a blade for sale
    if (Math.sin(t * 6) > 0.8) { R(c, '#ffd86a', 14 + Math.sin(t * 20) * 6, -26, 1, 1); R(c, '#ffb84a', 22, -28, 1, 1); R(c, '#ffd86a', 8, -27, 1, 1); }
  } else if (id === 'style') {                                    // style: a weapon rack taller than a man, a shield leaning on it
    post(-26, 70, 70); post(24, 70, 70); R(c, OUT, -28, -72, 58, 4); R(c, '#6a4a2e', -27, -71, 56, 2); R(c, OUT, -28, -30, 58, 4); R(c, '#6a4a2e', -27, -29, 56, 2);
    const sword = (wx, top, len) => { R(c, OUT, wx - 1, -top - 1, 4, len + 2); R(c, '#aab2bc', wx, -top, 2, len); R(c, '#e0e6ee', wx, -top, 1, len - 2); R(c, OUT, wx - 4, -top + len - 1, 10, 3); R(c, '#c8a84a', wx - 3, -top + len, 8, 1); R(c, '#4a3220', wx, -top + len + 2, 2, 7); };
    sword(-18, 68, 30); sword(-8, 70, 36);
    R(c, '#5a3e26', 3, -76, 2, 72); R(c, OUT, -2, -77, 12, 9); R(c, '#9aa0aa', -1, -76, 10, 7); R(c, '#c8ccd4', -1, -76, 10, 2);   // a poleaxe, taller than the rack
    R(c, '#5a3e26', 15, -66, 2, 60); R(c, OUT, 13, -73, 6, 9); R(c, '#aab2bc', 14, -72, 4, 7); R(c, '#e0e6ee', 15, -72, 1, 5);      // a spear
    box(c, 18, -26, 16, 22, '#6a3020'); R(c, '#8a4a2a', 19, -25, 14, 3); R(c, '#c8a84a', 25, -22, 3, 14); R(c, '#c8a84a', 21, -16, 11, 3);   // shield
  } else if (id === 'hire') {                                     // hire board: a roofed notice board with a lantern
    post(-26, 66, 66); post(24, 66, 66);
    for (let i = 0; i < 64; i++) { const yy = -74 + Math.round(Math.abs(i - 32) * 0.22); R(c, OUT, -32 + i, yy - 1, 1, 6); R(c, i % 4 ? '#4a3424' : '#3a281a', -32 + i, yy, 1, 4); }
    box(c, -24, -60, 50, 38, '#6a5034'); R(c, '#8a6c48', -23, -59, 48, 1); R(c, '#4a3624', -23, -23, 48, 1);
    const note = (nx, ny, w, h, col) => { R(c, col, nx, ny, w, h); for (let k = 3; k < h - 2; k += 3) R(c, '#4a3220', nx + 2, ny + k, w - 4 - (k % 2), 1); R(c, '#8a2a2a', nx + w / 2, ny - 1, 2, 2); };
    note(-20, -56, 13, 16, '#d8ceb4'); note(-4, -55, 12, 14, '#c8bea4'); note(11, -56, 12, 17, '#ddd4bc'); note(-16, -36, 14, 10, '#c8bea4'); note(4, -36, 16, 10, '#d8ceb4');
    R(c, OUT, 28, -50, 8, 2); lantern(c, 34, -36);
    box(c, -40, -10, 10, 10, '#5a4028'); box(c, -38, -16, 6, 6, '#7a6a5a');                                       // a stool and a sack
  } else {                                                        // the cart: a covered wagon, bigger than a man
    box(c, -52, -30, 92, 14, '#5a3e28'); R(c, '#7a5a3a', -51, -29, 90, 2); R(c, '#3a281a', -51, -18, 90, 1); for (let k = -44; k < 40; k += 12) R(c, '#3a281a', k, -28, 1, 10);
    for (let px = -50; px < 38; px++) { const u = (px + 6) / 44, hh = Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * 32); R(c, OUT, px, -30 - hh - 1, 1, 1); R(c, Math.floor((px + 400) / 9) % 2 ? '#b8ae96' : '#a29882', px, -30 - hh, 1, hh); if (Math.floor((px + 400) / 9) % 2 === 0 && hh > 4) R(c, '#8a8070', px, -30 - hh + 1, 1, 2); }
    for (const hx of [-30, -6, 18]) for (let y = 0; y < 30; y++) { const u = (hx + 6) / 44, hh = Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * 32); if (y < hh) R(c, '#6a5a44', hx, -30 - y, 1, 1); }   // hoops showing through
    ell(c, -46, -40, 4, 9, '#0c0a10'); ell(c, 34, -40, 4, 9, '#120e14');
    crate(c, -36, -44, 10); R(c, OUT, 40, -20, 30, 3); R(c, '#5a4028', 40, -19, 30, 1); R(c, OUT, 68, -24, 3, 8);   // the shaft
    R(c, OUT, 36, -60, 2, 30); lantern(c, 40, -50);
    for (const wx of [-34, 22]) { disc(c, wx, -12, 13, OUT); disc(c, wx, -12, 12, '#5a3e28'); disc(c, wx, -12, 9, '#3a281a'); disc(c, wx, -12, 3, '#7a5a3a'); c.strokeStyle = '#6a4a30'; c.lineWidth = 2; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI + t * 0; c.beginPath(); c.moveTo(wx + Math.cos(a) * 9, -12 + Math.sin(a) * 9); c.lineTo(wx - Math.cos(a) * 9, -12 - Math.sin(a) * 9); c.stroke(); } }
  }
  c.restore();
  if (near) { c.save(); c.strokeStyle = 'rgba(255,220,140,.95)'; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.beginPath(); c.ellipse(x, base + 6, id === 'cart' ? 56 : 36, 8, 0, 0, 7); c.stroke(); c.restore(); }
}
