/* Shared stage drawing for the campaign: the arena backdrop and live 3D fighters composited as pixel art. */
import M3 from '../rig/model3d.js';
import { CFG } from '../game/sim.js';
export const FONT = '"Pixelify Sans", monospace';
export const bg = document.createElement('canvas'); bg.width = CFG.W; bg.height = CFG.H;
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

const oc = document.createElement('canvas'), sil = document.createElement('canvas');
function prep3D(cv3, flash) {
  const S = cv3.width; if (oc.width !== S || oc.height !== cv3.height) { oc.width = sil.width = S; oc.height = sil.height = cv3.height; }
  const o = oc.getContext('2d'), s = sil.getContext('2d'), H = cv3.height;
  o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, S, H); o.drawImage(cv3, 0, 0);
  s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, S, H); s.drawImage(oc, 0, 0);
  s.globalCompositeOperation = 'source-in'; s.fillStyle = '#000'; s.fillRect(0, 0, S, H);
  if (flash) { o.globalCompositeOperation = 'source-atop'; o.fillStyle = 'rgba(255,255,255,.72)'; o.fillRect(0, 0, S, H); o.globalCompositeOperation = 'source-over'; }
}
export function drawFigure(ctx, f) {
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
export function label(ctx, text, x, y, col, size) {
  ctx.font = (size || 10) + 'px ' + FONT; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = '#14101c'; ctx.strokeText(text, Math.round(x), Math.round(y));
  ctx.fillStyle = col; ctx.fillText(text, Math.round(x), Math.round(y));
}
