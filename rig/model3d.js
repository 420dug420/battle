import { HT } from './humantest.js';
const { Vector3, Mesh, Group, BoxGeometry, litMaterial, paintTexture, loftGeometry, setLights } = HT;
/* ===== Project War 3D fighters: glue code (humantest internals come from ./humantest.js, under readable names) ===== */
const M3 = {};
const V3 = Vector3, Q4 = new Group().quaternion.constructor, M4 = new Group().matrix.constructor;
const SZ = 200, PXU = 54, CZ = 0.2, CY = 1.45;       // render size, pixels per world unit, window centre (z forward, y up)
const cvs = HT.renderer.domElement; cvs.style.display = 'none';
if (!document.getElementById('tris')) { const s = document.createElement('span'); s.id = 'tris'; s.style.display = 'none'; document.body.appendChild(s); }
HT.renderer.setSize(SZ, SZ, false); HT.renderer.setClearColor(0x000000, 0);
HT.uniforms.uSnap.value = 0; HT.uniforms.uRes.value.set(SZ, SZ);
HT.scene.fog = null; HT.scene.background = null; HT.world.visible = false;
setLights([[-2.6, 2.4, 1.2, 3.6, 1, .95, .85], [1.6, 2.2, -1.6, 2.0, .5, .6, 1], [-1.8, .5, -1.4, 1.0, .8, .6, .5]], [.46, .47, .52], [.22, .2, .2]);
const cam = HT.camera; cam.position.set(-4, CY, CZ); cam.lookAt(0, CY, CZ); cam.updateMatrixWorld(true);
{ const hh = SZ / PXU / 2; cam.projectionMatrix.makeOrthographic(-hh, hh, hh, -hh, 0.1, 20); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert(); }
M3.SZ = SZ; M3.ox = SZ / 2 - CZ * PXU; M3.oy = SZ / 2 + CY * PXU;   // pixel column of world z=0, pixel row of world y=0

const D2R = Math.PI / 180, tmpV = new V3(), tmpV2 = new V3(), tmpV3 = new V3();
const QI = () => new Q4(), MI = () => new M4();
function basisQuat(x, y, z) { const m = MI(); m.makeBasis(x, y, z); return QI().setFromRotationMatrix(m); }
function perp(a, ref) { const r = ref.clone(); r.addScaledVector(a, -r.dot(a)); if (r.lengthSq() < 1e-6) r.set(1, 0, 0).addScaledVector(a, -a.x); return r.normalize(); }

/* two-bone arm IK in pelvis space; sets sg/eg quaternions so the wrist origin lands on T (clamped to reach) */
function armIK(arm, T, pole) {
  const S = arm.sg.position, L1 = 0.3, L2 = 0.275;
  const d = tmpV.copy(T).sub(S); let dist = d.length(); if (dist < 0.05) { d.set(0, -1, 0); dist = 0.05; }
  const u = d.clone().normalize(); const reach = Math.min(dist, L1 + L2 - 0.004), Tp = S.clone().addScaledVector(u, reach);
  const a = (L1 * L1 - L2 * L2 + reach * reach) / (2 * reach), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pv = perp(u, pole), E = S.clone().addScaledVector(u, a).addScaledVector(pv, h);
  const u1 = E.clone().sub(S).normalize(), u2 = Tp.clone().sub(E).normalize();
  let N = new V3().crossVectors(u1, u2); if (N.lengthSq() < 1e-8) N = new V3().crossVectors(u1, pv); N.normalize();
  const yAx = u1.clone().negate(), zAx = new V3().crossVectors(N, yAx).normalize();
  const qs = basisQuat(N, yAx, zAx); arm.sg.quaternion.copy(qs);
  const u2l = u2.clone().applyQuaternion(qs.clone().invert());       // forearm direction in the shoulder's frame
  const yl = u2l.clone().negate(), xl = new V3(1, 0, 0), zl = new V3().crossVectors(xl, yl).normalize();
  arm.eg.quaternion.copy(basisQuat(xl, yl, zl));
  arm._q = qs.clone().multiply(arm.eg.quaternion);                     // forearm orientation in pelvis space
}
/* orient the wrist so the weapon's blade points along dir (pelvis space), flat facing roughly up */
function wristAim(arm, dir, up, roll) {
  const y = dir.clone().normalize().negate();                           // local -y is the blade direction
  const z = perp(y, up || new V3(0, 1, 0)); if (roll) z.applyAxisAngle(y, roll * D2R); const x = new V3().crossVectors(y, z).normalize();
  const want = basisQuat(x, y, z);
  arm.wg.quaternion.copy(arm._q.clone().invert().multiply(want));
  arm._wq = want;
}
const SWORD_LEN = 0.82;
function wristWorldToPelvis(arm, atLocalY) {                            // point on the weapon axis (wg-local y) in pelvis space
  return new V3(0, atLocalY, 0).applyQuaternion(arm._wq).add(arm._T);
}

/* ---------- build a fighter ---------- */
const BASE = { outfit: 1, build: 2, skin: 0, hair: 0, hairStyle: 0, face: 0, beard: 0, helmet: 1, visor: 1, armor: 1, shieldDev: 0, gear: 0, walk: 0, spin: 0, ps1: 0, wire: 0 };
function box(w, h, d, col, parent, x, y, z) {
  const m = new Mesh(new BoxGeometry(w, h, d), mat('box' + col, () => paintTexture(8, 8, T => T.fill(col)))); m.position.set(x, y, z); parent.add(m); return m;
}
function addSword(wg, two, big, handle, kind) {
  const g = new Group(); wg.add(g); g.position.set(0, -0.02, 0.012);
  const W = '#dfe5ec', WD = '#8d97a3', WOOD = '#6b4a2b';
  if (kind === 'axe' || kind === 'mace') {                                                    // one-handed hafted weapons: same grip point, different head
    const gl = handle || 0.14, L = kind === 'axe' ? 0.72 : 0.68, y0 = 0.04 - gl - 0.02;
    box(0.032, gl, 0.032, '#3a2a1c', g, 0, 0.04 - gl / 2, 0); box(0.05, 0.04, 0.05, '#c9a24a', g, 0, 0.06, 0);
    box(0.03, L, 0.03, WOOD, g, 0, y0 - L / 2, 0);                                              // haft
    if (kind === 'axe') {
      box(0.05, 0.2, 0.05, WD, g, 0, y0 - L + 0.08, 0);                                         // socket
      box(0.07, 0.1, 0.035, W, g, 0.05, y0 - L + 0.07, 0); box(0.07, 0.19, 0.035, W, g, 0.11, y0 - L + 0.07, 0); box(0.05, 0.3, 0.03, W, g, 0.17, y0 - L + 0.07, 0);   // flared bit: edge is the +x side
      box(0.04, 0.12, 0.04, WD, g, -0.03, y0 - L + 0.07, 0);                                    // poll
      g._tipY = y0 - L - 0.04;
    } else {
      box(0.14, 0.17, 0.14, WD, g, 0, y0 - L + 0.02, 0);                                        // flanged head
      box(0.21, 0.05, 0.04, W, g, 0, y0 - L + 0.02, 0); box(0.04, 0.05, 0.21, W, g, 0, y0 - L + 0.02, 0);
      box(0.045, 0.08, 0.045, W, g, 0, y0 - L - 0.09, 0); box(0.2, 0.03, 0.03, W, g, 0, y0 - L + 0.09, 0);
      g._tipY = y0 - L - 0.13;
    }
    g._gripTop = 0.04; g._len = L; g._two = false; g._kind = kind; return g;
  }
  if (kind === 'spear') {                                                                       // two-handed: long shaft carried through the grip, leaf head at the tip
    const L = 1.55, y0 = 0.3;
    box(0.032, L + 0.35, 0.032, WOOD, g, 0, y0 - L / 2 + 0.17, 0);                              // shaft runs past the hand both ways
    box(0.04, 0.06, 0.04, '#c9a24a', g, 0, 0.5, 0);                                             // butt cap
    box(0.045, 0.1, 0.045, WD, g, 0, y0 - L + 0.05, 0);                                         // socket
    box(0.07, 0.2, 0.025, W, g, 0, y0 - L - 0.08, 0);                                           // leaf head
    box(0.04, 0.1, 0.02, W, g, 0, y0 - L - 0.23, 0);
    box(0.012, 0.06, 0.012, W, g, 0, y0 - L - 0.31, 0);
    g._tipY = y0 - L - 0.34; g._gripTop = 0.04; g._len = L; g._two = true; g._kind = kind; return g;
  }
  const gl = two ? 0.3 : (handle || 0.14), L = big ? 1.05 : two ? 0.9 : 0.78, y0 = 0.04 - gl - 0.035;
  box(0.034, gl, 0.034, '#3a2a1c', g, 0, 0.04 - gl / 2, 0);                                  // leather grip
  box(0.055, 0.045, 0.055, '#c9a24a', g, 0, 0.06, 0);                                       // wheel pommel
  box(two || big ? 0.3 : 0.22, 0.032, 0.05, '#c9a24a', g, 0, 0.04 - gl - 0.012, 0);          // crossguard
  box(0.075, L * 0.62, 0.04, W, g, 0, y0 - L * 0.31, 0);                                    // blade, wide forte
  box(0.056, L * 0.28, 0.034, W, g, 0, y0 - L * 0.62 - L * 0.14, 0);                        // tapering
  box(0.03, L * 0.1, 0.026, W, g, 0, y0 - L * 0.9 - L * 0.05, 0);                           // point
  box(0.018, L * 0.7, 0.046, WD, g, 0, y0 - L * 0.36, 0);                                   // fuller
  g._tipY = y0 - L; g._gripTop = 0.04; g._len = L; g._two = two;
  return g;
}
/* ===== medieval kit: gambeson, mail, plate, helms, tabards and heater shields ===== */
HT.outfits[0] = Object.assign({}, HT.outfits[0], { coat: '#6b5238', lining: '#3a2a1a', shirt: '#9a8a6a', pants: '#4b3b2b', boots: '#2a2018', gloves: '#3a2a1c', bootH: .17, skirt: true, collar: false, pads: false });
HT.outfits[2] = Object.assign({}, HT.outfits[2], { coat: '#6e5a40', lining: '#3a2a1a', shirt: '#a09070', pants: '#43372a', boots: '#2a2018', gloves: '#3a2a1c', bootH: .2, skirt: false, collar: false, pads: false, sleeves: 'long' });
HT.outfits[1] = Object.assign({}, HT.outfits[1], { coat: '#6e5a40', lining: '#3a2a1a', shirt: '#a09070', pants: '#43372a', boots: '#2a2018', gloves: '#3a2a1c', bootH: .2, skirt: true, collar: false, pads: false });
const TX = (w, h, fn) => paintTexture(w, h, fn);
const MAT = {};
function mat(name, mk) { return MAT[name] || (MAT[name] = litMaterial(mk(), {})); }
const steel = (hi, base, lo, gold) => TX(64, 64, T => {
  T.fill(base); T.speckle(500, [lo, hi], .03, .12, 1.4);
  T.rect(.46, 0, .54, 1, hi); T.rect(0, 0, .04, 1, lo); T.rect(.96, 0, 1, 1, lo); T.rect(0, 0, 1, .03, lo);
  if (gold) { T.rect(0, .93, 1, 1, '#c9a24a'); T.rect(0, 0, 1, .06, '#c9a24a'); } else T.rect(0, .97, 1, 1, hi);
});
const mailtex = (base, hi, lo) => TX(64, 64, T => { T.fill(base); T.speckle(1800, [lo, hi], .02, .09, 1.2); for (let y = .05; y < 1; y += .1) T.line([[0, y], [1, y]], lo, 1); });
const quilt = (base, line) => TX(64, 64, T => { T.fill(base); T.speckle(300, ['#000', '#fff'], .02, .06, 1.4); for (let i = 0; i <= 8; i++) { T.line([[i / 8, 0], [i / 8, 1]], line, 1.2); T.line([[0, i / 8], [1, i / 8]], line, 1.2); } });
const cloth = (c, c2) => TX(32, 32, T => { T.fill(c); T.speckle(160, ['#000', '#fff'], .02, .06, 1.2); if (c2) { T.rect(0, 0, 1, .06, c2); T.rect(0, .94, 1, 1, c2); } });
function loft(rings, segs, m, parent, x, y, z, ymin, ymax) {
  const mesh = new Mesh(loftGeometry(rings, segs, { sub: 0, ymin, ymax }), m); mesh.position.set(x || 0, y || 0, z || 0); parent.add(mesh); return mesh;
}
function ringsOf(list) { return list.map(([y, rx, rz, cz]) => ({ y, rx, rz, cz: cz || 0 })); }
function tube(parent, y0, y1, r0, r1, m, segs) {
  const r = [{ y: y0, rx: r0, rz: r0 }, { y: (y0 + y1) / 2, rx: (r0 + r1) / 2, rz: (r0 + r1) / 2 }, { y: y1, rx: r1, rz: r1 }];
  return loft(r, segs || 10, m, parent, 0, 0, 0, Math.min(y0, y1), Math.max(y0, y1));
}
function dome(parent, x, y, z, rx, rz, h, m, tx, tz) {
  const rr = [{ y: 0, rx: rx, rz: rz }, { y: h * .35, rx: rx * .93, rz: rz * .93 }, { y: h * .7, rx: rx * .65, rz: rz * .65 }, { y: h * .92, rx: rx * .3, rz: rz * .3 }, { y: h, rx: rx * .02, rz: rz * .02 }];
  const mm = loft(rr, 10, m, parent, x, y, z, 0, h); mm.rotation.set(tx || 0, 0, tz || 0); return mm;
}
const COL = { p: { tab: '#b8352f', trim: '#e0c27a' }, e: { tab: '#6b4fa8', trim: '#d7d0e6' } };

/* ===================== Armor as mix-and-match parts =====================
   A fighter wears one HEAD, one BODY (torso, arms, legs, tabard), a LIVERY (two cloth colours) and a METAL.
   Every combination is valid. The old tiers (leather, mail, plate, special) are presets of these. */
const G = '#c9a24a';
const METALS = {
  steel: { label: 'Steel', t: ['#d5dbe2', '#8f98a2', '#4d545d', false] }, gilded: { label: 'Gilded steel', t: ['#d5dbe2', '#8f98a2', '#4d545d', true] },
  black: { label: 'Blackened iron', t: ['#8a8f99', '#3b3f46', '#14161a', false] }, bronze: { label: 'Bronze', t: ['#f0d6a0', '#b0864a', '#5a3f1c', false] },
  silver: { label: 'Bright silver', t: ['#eef3f6', '#b6c2cb', '#5a656d', false] }
};
const LIVERIES = {
  red: { label: 'Company red', c: ['#b8352f', '#e0c27a'] }, violet: { label: 'Violet', c: ['#6b4fa8', '#d7d0e6'] }, azure: { label: 'Azure and cream', c: ['#2c4a8c', '#e9e3d0'] },
  green: { label: 'Green and silver', c: ['#2f5a35', '#d9dde3'] }, black: { label: 'Black and gold', c: ['#1d1d22', '#c9a24a'] }, white: { label: 'White and black', c: ['#efeadb', '#17171a'] },
  gold: { label: 'Gold and blue', c: ['#d9b24a', '#2c4a8c'] }, ash: { label: 'Ash grey', c: ['#6b6f78', '#d9dde3'] }
};
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)))); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); };
const flankU = fn => { fn(.22); fn(.78); };
/* company logos: a 36x36 canvas per side ('p' your company, 'e' the enemy faction), painted where a tabard carries its device */
const LOGOS = { p: null, e: null };
const lk = k => k.logo ? 'L' + k.logo.ver : '';                    // material cache key part
function logoAt(T, logo, cx, v0, size) {                           // paint the logo upright, centred at u=cx, from v0 up
  const g = T.g; g.save(); g.imageSmoothingEnabled = false; g.translate(cx - size / 2, v0 + size); g.scale(size, -size); g.drawImage(logo.canvas, 0, 0, 1, 1); g.restore();
}
const logoFlanks = (T, logo) => flankU(cx => logoAt(T, logo, cx, .12, .32));
const hmat = (name, painter) => mat(name, () => TX(128, 128, painter));
const clothBase = (T, c, hem) => { T.fill(c); T.speckle(500, ['#000', '#fff'], .02, .06, 1.2); if (hem) T.rect(0, 0, 1, .05, hem); };
const longTab = (P, m, lo) => loft(ringsOf([[lo, .25, .17], [lo + .1, .243, .163], [-.3, .232, .152], [-.2, .221, .143], [-.1, .207, .132], [.1, .205, .127], [.3, .212, .13], [.5, .2, .12], [.57, .15, .1]]), 22, m, P, 0, 0, 0, lo, .57);
const gorget = (H, mail) => loft(ringsOf([[0, .12, .11], [-.07, .16, .14], [-.14, .2, .15]]), 14, mail, H, 0, 0, 0, -.14, 0);
const pauld = (P, s, m, y) => dome(P, s * .26, y || .5, 0, .13, .115, .1, m, 0, -s * .55);
const slit = (H, y, z) => box(.13, .016, .01, '#050505', H, 0, y, z);
const HEADS = {}, BODIES = {};
HEADS.hood = { label: 'Cloth hood', f: k => { dome(k.H, 0, .1, .018, .1, .122, .17, mat('hood' + k.A, () => cloth(shade(k.A, -.35)))); } };
HEADS.helm = { label: 'Kettle helm', f: k => { const { H, mail, metal } = k; gorget(H, mail); dome(H, 0, .1, .018, .1, .122, .17, metal); loft(ringsOf([[0, .15, .17], [.018, .15, .17]]), 14, metal, H, 0, .098, .02, 0, .018); box(.016, .11, .014, '#9aa2ac', H, 0, .02, .146); } };
HEADS.bascinet = { label: 'Bascinet', f: k => { const { H, mail, metal } = k; gorget(H, mail); loft(ringsOf([[-.03, .095, .115, .018], [.02, .1, .122, .018], [.2, .1, .122, .018], [.235, .085, .1, .018], [.26, .045, .055, .018], [.27, .005, .006, .018]]), 14, metal, H, 0, 0, 0, -.03, .27); slit(H, .15, .146); box(.012, .08, .01, '#050505', H, .03, .05, .146); box(.012, .08, .01, '#050505', H, -.03, .05, .146); box(.012, .1, .012, G, H, 0, .12, .148); } };
HEADS.crested = { label: 'Crested bascinet', f: k => { HEADS.bascinet.f(k); box(.034, .1, .24, '#b8352f', k.H, 0, .27, -.02); box(.03, .06, .2, G, k.H, 0, .34, -.03); } };
HEADS.kettlehat = { label: 'Kettle hat', f: k => { const { H } = k, rust = mat('rust', () => steel('#a89a86', '#6e5f50', '#3a3128')); dome(H, 0, .1, .018, .105, .125, .13, rust); loft(ringsOf([[0, .21, .22], [.02, .21, .22]]), 18, rust, H, 0, .1, .02, 0, .02); box(.012, .12, .01, '#3a2a1c', H, .09, 0, .06); box(.012, .12, .01, '#3a2a1c', H, -.09, 0, .06); loft(ringsOf([[0, .115, .13], [-.08, .15, .15]]), 12, mat('jackhood' + k.A, () => cloth('#6a5a40')), H, 0, 0, 0, -.08, 0); } };
HEADS.sallet = { label: 'Sallet', f: k => { const { H, mail, metal } = k; loft(ringsOf([[-.14, .12, .1, -.05], [-.04, .105, .12, -.02], [.1, .1, .12, 0], [.2, .085, .1, 0], [.255, .04, .05, 0], [.265, .005, .006, 0]]), 14, metal, H, 0, 0, 0, -.14, .265); box(.15, .035, .14, '#8f98a2', H, 0, -.06, -.13); slit(H, .1, .15); gorget(H, mail); } };
HEADS.cone = { label: 'Conical helm', f: k => { const { H, mail, metal } = k; loft(ringsOf([[-.08, .11, .14, .012], [.04, .11, .14, .012], [.16, .105, .13, .008], [.24, .085, .1, .004], [.31, .04, .05, 0], [.36, .02, .026, 0], [.4, .004, .005, 0]]), 14, metal, H, 0, 0, 0, -.08, .4); loft(ringsOf([[0, .12, .11], [-.1, .17, .15], [-.2, .21, .16]]), 14, mail, H, 0, 0, 0, -.2, 0); box(.1, .014, .01, '#050505', H, 0, .06, .146); } };
HEADS.greathelm = { label: 'Great helm', f: k => { const { H, mail, metal } = k; gorget(H, mail); loft(ringsOf([[-.08, .118, .13], [.02, .122, .135], [.22, .122, .135], [.245, .112, .124], [.26, .09, .1]]), 18, metal, H, 0, 0, 0, -.08, .26); box(.25, .012, .27, '#8f98a2', H, 0, .262, 0); box(.13, .022, .012, '#050505', H, 0, .115, .139); box(.012, .1, .012, '#050505', H, 0, .06, .139); } };
HEADS.beaked = { label: 'Beaked bascinet', f: k => { const { H, mail, metal } = k; gorget(H, mail); loft(ringsOf([[-.1, .102, .13, 0], [.02, .102, .14, .015], [.12, .098, .135, .03], [.21, .085, .115, .02], [.26, .045, .055, 0], [.27, .005, .006, 0]]), 16, metal, H, 0, 0, 0, -.1, .27); box(.13, .016, .01, '#050505', H, 0, .11, .175); } };
HEADS.spire = { label: 'Spire helm', f: k => { const { H, metal } = k; loft(ringsOf([[-.06, .098, .12], [.02, .102, .126], [.16, .1, .125], [.24, .075, .095], [.32, .04, .05], [.4, .016, .02], [.46, .004, .005]]), 14, metal, H, 0, 0, 0, -.06, .46); box(.13, .016, .01, '#050505', H, 0, .1, .135); box(.012, .09, .012, k.B, H, 0, .2, .13); } };
HEADS.domed = { label: 'Domed helm', f: k => { const { H, mail, metal } = k; gorget(H, mail); loft(ringsOf([[-.06, .1, .125], [.04, .104, .13], [.2, .102, .128], [.25, .08, .1], [.285, .03, .04], [.3, .004, .005]]), 16, metal, H, 0, 0, 0, -.06, .3); box(.13, .018, .012, k.B, H, 0, .1, .136); } };
HEADS.blackhelm = { label: 'War helm', f: k => { const { H, metal } = k; loft(ringsOf([[-.05, .098, .118], [.02, .102, .124], [.2, .102, .124], [.235, .088, .102], [.26, .046, .056], [.27, .005, .006, .018]]), 14, metal, H, 0, 0, 0, -.05, .27); box(.13, .02, .01, k.A, H, 0, .145, .146); box(.012, .08, .01, '#050505', H, .03, .05, .146); box(.012, .08, .01, '#050505', H, -.03, .05, .146); } };

const armsLegs = (k, m, w) => { const { rig, bothArms } = k; bothArms(a => { tube(a.sg, -.03, -.27, .071, .062, m, 12); tube(a.eg, -.015, -.2, .056, .046, m, 12); tube(a.wg, .02, -.1, .06, .052, m, 10); dome(a.eg, 0, .03, .01, .06, .06, .06, m); });
  for (const lg of [rig.legN, rig.legF]) { tube(lg.hg, -.03, -.42, .118, .084, m, 12); dome(lg.kg, 0, -.03, .035, .07, .07, .06, m, Math.PI / 2, 0); tube(lg.kg, -.06, -.38, .07, .056, m, 12); } };
BODIES.quilted = { label: 'Quilted coat', f: k => { const { P, A, c, belt, bothArms, torsoR, quil } = k; loft(torsoR(1.09, -.05, .55), 14, quil, P, 0, 0, 0, -.05, .55); belt(); bothArms(a => tube(a.sg, -.02, -.28, .066, .056, quil, 10)); box(.3, .62, .012, A, P, 0, -.0, .13); box(.3, .56, .012, A, P, 0, 0, -.13); } };
BODIES.mail = { label: 'Mail hauberk', f: k => { const { P, H, A, belt, bothArms, mail } = k; loft(ringsOf([[-.2, .21, .15], [-.1, .2, .13], [.05, .19, .115], [.3, .205, .125], [.5, .2, .12], [.57, .15, .1]]), 14, mail, P, 0, 0, 0, -.2, .57); bothArms(a => tube(a.sg, -.02, -.3, .062, .054, mail, 10)); gorget(H, mail); belt(); box(.32, .66, .012, A, P, 0, -.06, .131); box(.32, .6, .012, A, P, 0, -.02, -.131); } };
BODIES.plate = { label: 'Plate harness', f: k => { const { P, H, A, belt, torsoR, mail, metal } = k; loft(ringsOf([[-.2, .21, .15], [-.1, .2, .13], [.05, .19, .115], [.3, .205, .125], [.5, .2, .12], [.57, .15, .1]]), 14, mail, P, 0, 0, 0, -.2, .57); gorget(H, mail); belt();
  loft(torsoR(1.07, .06, .56), 14, metal, P, 0, 0, 0, .06, .56); for (const s of [-1, 1]) { dome(P, s * .255, .5, 0, .115, .1, .1, metal, 0, -s * .55); dome(P, s * .268, .47, 0, .1, .09, .085, metal, 0, -s * .75); }
  k.bothArms(a => { tube(a.sg, -.03, -.27, .071, .062, metal, 10); tube(a.eg, -.015, -.2, .056, .046, metal, 10); box(.092, .09, .09, '#8f98a2', a.wg, 0, -.02, 0); dome(a.eg, 0, .03, .01, .06, .06, .06, metal); });
  for (const lg of [k.rig.legN, k.rig.legF]) { tube(lg.hg, -.03, -.42, .118, .084, metal, 10); dome(lg.kg, 0, -.03, .035, .07, .07, .06, metal, Math.PI / 2, 0); tube(lg.kg, -.06, -.38, .07, .056, metal, 10); }
  box(.34, .56, .012, A, P, 0, -.12, .133); box(.34, .5, .012, A, P, 0, -.08, -.133); } };
BODIES.jack = { label: 'Padded jack', f: k => { const { P, A, B, belt, bothArms } = k, q = mat('jackq' + B, () => quilt(B, shade(B, -.45)));
  loft(ringsOf([[-.12, .2, .125], [0, .215, .135], [.28, .235, .145], [.5, .23, .14], [.57, .17, .11]]), 14, q, P, 0, 0, 0, -.12, .57); bothArms(a => { tube(a.sg, -.02, -.28, .078, .068, q, 10); tube(a.eg, -.01, -.1, .06, .056, q, 10); }); belt(); box(.3, .5, .012, A, P, 0, -.02, .142); box(.3, .45, .012, A, P, 0, 0, -.142); } };
BODIES.brigandine = { label: 'Brigandine', f: k => { const { P, A, rig, belt, bothArms, mail, metal } = k, cth = hmat('brig' + A, T => { clothBase(T, A, G); flankU(cx => { for (let v = .15; v < .95; v += .09) for (const u of [-.07, 0, .07]) T.ell(cx + u, v, .012, .012, '#d9b45a'); }); });
  loft(ringsOf([[-.18, .215, .14], [-.05, .205, .125], [.06, .2, .12], [.3, .215, .13], [.5, .21, .125], [.57, .16, .1]]), 18, cth, P, 0, 0, 0, -.18, .57);
  bothArms(a => { tube(a.sg, -.02, -.3, .062, .054, mail, 10); dome(a.sg, 0, .0, 0, .105, .1, .09, cth); }); belt(); for (const lg of [rig.legN, rig.legF]) tube(lg.hg, -.03, -.3, .104, .088, cth, 10); } };
BODIES.lamellar = { label: 'Lamellar', f: k => { const { P, A, rig, belt, bothArms, mail, metal } = k, lac = mat('lac' + A, () => steel(shade(A, .35), A, shade(A, -.6), true));
  for (let i = 0; i < 8; i++) { const y = -.05 + i * .075; loft(ringsOf([[y, .205 + i * .002, .125], [y + .085, .212 + i * .002, .13]]), 16, i % 2 ? lac : metal, P, 0, 0, 0, y, y + .085); }
  loft(ringsOf([[.5, .2, .12], [.58, .15, .1]]), 14, metal, P, 0, 0, 0, .5, .58); bothArms(a => { tube(a.sg, -.02, -.3, .062, .054, mail, 10); for (let i = 0; i < 3; i++) tube(a.sg, -.03 - i * .08, -.09 - i * .08, .07, .068, lac, 8); });
  belt(); for (const lg of [rig.legN, rig.legF]) for (let i = 0; i < 4; i++) tube(lg.hg, -.03 - i * .075, -.1 - i * .075, .115 - i * .006, .11 - i * .006, i % 2 ? lac : metal, 10); } };
BODIES.komtur = { label: 'Mantle and cross', f: k => { const { P, A, B, belt, bothArms, mail, metal } = k;
  longTab(P, hmat('komtur' + A + B + lk(k), T => { clothBase(T, A, B); (k.logo ? logoFlanks(T, k.logo) : flankU(cx => { T.rect(cx - .03, .1, cx + .03, .5, B); T.rect(cx - .12, .34, cx + .12, .4, B); T.poly([[cx - .03, .5], [cx + .03, .5], [cx + .065, .56], [cx - .065, .56]], B); T.poly([[cx - .03, .1], [cx + .03, .1], [cx + .065, .04], [cx - .065, .04]], B); T.poly([[cx - .12, .34], [cx - .12, .4], [cx - .17, .44], [cx - .17, .3]], B); T.poly([[cx + .12, .34], [cx + .12, .4], [cx + .17, .44], [cx + .17, .3]], B); })); }), -.5);
  bothArms(a => { tube(a.sg, -.02, -.3, .062, .054, mail, 10); dome(a.sg, 0, .0, 0, .12, .11, .1, metal); }); belt(); } };
BODIES.spire = { label: 'Lancet cuirass', f: k => { const { P, A, B, rig, belt, bothArms, metal } = k;
  const torso = hmat('spireT' + B + k.met.id, T => { T.fill(k.met.t[1]); T.speckle(500, [k.met.t[2], k.met.t[0]], .03, .12, 1.4); flankU(cx => { for (const j of [-.13, 0, .13]) T.line([[cx + j - .045, .3], [cx + j - .045, .66], [cx + j, .8], [cx + j + .045, .66], [cx + j + .045, .3], [cx + j - .045, .3]], B, 1.6); }); T.rect(0, 0, 1, .03, B); });
  loft(ringsOf([[.04, .175, .11], [.12, .195, .12], [.2, .212, .128], [.32, .232, .138], [.51, .205, .122], [.57, .16, .1]]), 20, torso, P, 0, 0, 0, .04, .57);
  for (const s of [-1, 1]) { pauld(P, s, metal); loft(ringsOf([[0, .06, .05], [.3, .004, .004]]), 10, metal, P, s * .3, .55, -.03, 0, .3); loft(ringsOf([[0, .04, .04], [.18, .004, .004]]), 10, metal, P, s * .31, .5, .06, 0, .18); }
  bothArms(a => { tube(a.sg, -.03, -.27, .072, .063, metal, 12); tube(a.eg, -.015, -.2, .058, .048, metal, 12); loft(ringsOf([[0, .05, .05], [.12, .004, .004]]), 8, metal, a.eg, 0, .03, 0, 0, .12); tube(a.wg, .02, -.1, .06, .052, metal, 10); });
  for (const lg of [rig.legN, rig.legF]) { tube(lg.hg, -.03, -.42, .12, .086, metal, 12); dome(lg.kg, 0, -.03, .045, .08, .08, .07, metal, Math.PI / 2, 0); loft(ringsOf([[0, .03, .03], [.1, .004, .004]]), 8, metal, lg.kg, 0, .02, .08, 0, .1); tube(lg.kg, -.06, -.38, .072, .058, metal, 12); }
  box(.34, 1.0, .014, shade(A, -.6), P, 0, -.36, -.15); belt(); } };
BODIES.deco = { label: 'Deco plate', f: k => { const { P, A, B, rig, belt, bothArms, metal } = k, gd = mat('decog' + B, () => steel(shade(B, .5), B, shade(B, -.6), false));
  const chev = (T, cx, v, w, th, col) => T.poly([[cx, v + .1], [cx + w, v], [cx + w, v - th], [cx, v + .1 - th], [cx - w, v - th], [cx - w, v]], col);
  const torso = hmat('decoT' + B + k.met.id, T => { T.fill(k.met.t[1]); T.speckle(500, [k.met.t[2], k.met.t[0]], .03, .12, 1.4); T.rect(.46, 0, .54, 1, k.met.t[0]); flankU(cx => { for (let i = 0; i < 4; i++) chev(T, cx, .34 + i * .13, .17, .035, B); }); });
  loft(ringsOf([[.04, .175, .105], [.12, .192, .115], [.2, .205, .125], [.31, .225, .135], [.51, .2, .12], [.57, .155, .098]]), 22, torso, P, 0, 0, 0, .04, .57);
  for (const s of [-1, 1]) for (let j = 0; j < 3; j++) loft(ringsOf([[0, .13 - j * .035, .12 - j * .03], [.04, .13 - j * .035, .12 - j * .03]]), 14, j === 1 ? gd : metal, P, s * .26, .47 + j * .045, 0, 0, .04);
  armsLegs(k, metal);
  loft(ringsOf([[-.2, .226, .152], [-.1, .212, .138], [.05, .2, .124]]), 22, hmat('decoA' + A + B, T => { clothBase(T, A, B); flankU(cx => { for (let i = 0; i < 3; i++) chev(T, cx, .25 + i * .22, .17, .05, B); }); }), P, 0, 0, 0, -.2, .05); belt(); } };
BODIES.griffon = { label: 'Per fess tabard', f: k => { const { P, A, B, belt, bothArms, mail, metal } = k, S = '#e9e3d0';
  longTab(P, hmat('griffon' + A + B + lk(k), T => { clothBase(T, A, S); T.rect(0, 0, 1, .44, B); T.rect(0, .44, 1, .47, S); T.rect(0, 0, 1, .05, S); (k.logo ? logoFlanks(T, k.logo) : flankU(cx => { T.poly([[cx, .47], [cx + .17, .24], [cx + .17, .14], [cx, .37], [cx - .17, .14], [cx - .17, .24]], A); })); }), -.42);
  bothArms(a => { tube(a.sg, -.02, -.3, .062, .054, mail, 10); dome(a.sg, 0, .0, 0, .12, .11, .1, metal); }); belt(); } };
BODIES.sun = { label: 'Sunburst surcoat', f: k => { const { P, A, B, belt, bothArms, metal } = k;
  longTab(P, hmat('sunT' + A + B + lk(k), T => { clothBase(T, A, B); (k.logo ? logoFlanks(T, k.logo) : flankU(cx => { T.ell(cx, .3, .06, .06, B); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r1 = .07, r2 = i % 2 ? .11 : .16, px = Math.cos(a + .13), py = Math.sin(a + .13), qx = Math.cos(a - .13), qy = Math.sin(a - .13); T.poly([[cx + qx * r1, .3 + qy * r1], [cx + Math.cos(a) * r2, .3 + Math.sin(a) * r2], [cx + px * r1, .3 + py * r1]], B); } })); }), -.46);
  for (const s of [-1, 1]) pauld(P, s, metal); armsLegs(k, metal); belt(); } };
BODIES.stag = { label: 'Bend tabard', f: k => { const { P, A, B, belt, bothArms, mail, metal } = k;
  longTab(P, hmat('stag' + A + B + lk(k), T => { clothBase(T, A, G); (k.logo ? logoFlanks(T, k.logo) : flankU(cx => { T.poly([[cx - .2, .55], [cx - .08, .55], [cx + .2, .08], [cx + .08, .08]], B); })); }), -.46);
  for (const s of [-1, 1]) { pauld(P, s, metal, .52); pauld(P, s, mat('stagl' + k.met.id, () => steel(shade(k.met.t[0], .3), shade(k.met.t[1], .3), k.met.t[2], false)), .46); }
  bothArms(a => { tube(a.sg, -.02, -.3, .062, .054, mail, 10); }); belt(); } };
BODIES.warlord = { label: 'Spiked harness', f: k => { const { P, A, rig, belt, bothArms, metal } = k;
  loft(ringsOf([[.04, .18, .11], [.2, .215, .13], [.31, .235, .14], [.52, .21, .125], [.57, .16, .1]]), 16, metal, P, 0, 0, 0, .04, .57);
  for (const s of [-1, 1]) { dome(P, s * .27, .5, 0, .15, .125, .12, metal, 0, -s * .6); loft(ringsOf([[0, .05, .05], [.22, .004, .004]]), 8, metal, P, s * .29, .56, 0, 0, .22); loft(ringsOf([[0, .035, .035], [.14, .004, .004]]), 8, metal, P, s * .31, .5, .05, 0, .14); }
  armsLegs(k, metal); box(.3, .95, .012, A, P, 0, -.34, -.145); belt(); } };

/* ----- low-tier clothing and mail ----- */
const leatherTex = (base, hi, lo) => TX(64, 64, T => { T.fill(base); T.speckle(420, [lo, hi], .02, .08, 1.3); T.rect(0, 0, 1, .035, lo); T.rect(0, .965, 1, 1, lo); });
const tunicMat = (A, B, logo) => mat('tunic' + A + B + (logo ? 'L' + logo.ver : ''), () => TX(logo ? 128 : 64, logo ? 128 : 64, T => { clothBase(T, A, B); T.rect(0, .05, 1, .065, shade(A, -.25)); if (logo) flankU(cx => logoAt(T, logo, cx, .3, .3)); }));
const tunicSkirt = (k, lo, logo) => loft(ringsOf([[lo, .24, .17], [lo + .12, .225, .155], [-.1, .205, .135], [.06, .19, .118], [.3, .205, .126], [.5, .2, .12], [.57, .15, .1]]), 16, tunicMat(k.A, k.B, logo), k.P, 0, 0, 0, lo, .57);
const sleeves = (k, m, long) => k.bothArms(a => { tube(a.sg, -.02, -.29, .068, .058, m, 10); if (long) tube(a.eg, -.01, -.19, .054, .046, m, 10); });
HEADS.bare = { label: 'Bare head', f: k => { } };
HEADS.cap = { label: 'Arming cap', f: k => { const { H } = k, m = mat('cap' + k.B, () => quilt(shade(k.B, -.15), shade(k.B, -.45)));
  loft(ringsOf([[.06, .104, .126], [.16, .106, .128], [.23, .088, .108], [.27, .05, .062], [.285, .006, .008]]), 14, m, H, 0, 0, 0, .06, .285);
  for (const s of [-1, 1]) box(.012, .1, .05, shade(k.B, -.15), H, s * .1, .05, .04); } };
HEADS.leathercap = { label: 'Leather cap', f: k => { const { H } = k, m = mat('lcap', () => leatherTex('#5a3f27', '#7a5a3a', '#2c1d10'));
  loft(ringsOf([[.13, .108, .13], [.19, .106, .127], [.25, .084, .1], [.285, .04, .048], [.295, .005, .006]]), 14, m, H, 0, 0, 0, .13, .295);
  loft(ringsOf([[.12, .118, .14], [.15, .118, .14]]), 14, m, H, 0, 0, 0, .12, .15); } };
HEADS.coif = { label: 'Mail coif', f: k => { const { H, mail } = k;
  loft(ringsOf([[-.16, .2, .15, -.03], [-.08, .15, .125, -.03], [0, .118, .12, -.035], [.1, .112, .12, -.035], [.2, .104, .118, -.025], [.25, .082, .094, -.015], [.285, .032, .036], [.29, .004, .005]]), 16, mail, H, 0, 0, 0, -.16, .29); } };
HEADS.coifhelm = { label: 'Skullcap over coif', f: k => { HEADS.coif.f(k); const { H, metal } = k;
  loft(ringsOf([[.15, .116, .136], [.21, .108, .128], [.26, .082, .098], [.29, .036, .044], [.3, .004, .005]]), 16, metal, H, 0, 0, 0, .15, .3);
  box(.016, .1, .012, '#8f98a2', H, 0, .1, .138); } };
BODIES.tunic = { label: 'Tunic', f: k => { tunicSkirt(k, -.34, k.logo); sleeves(k, tunicMat(k.A, k.B), true); k.belt(); } };
BODIES.jerkin = { label: 'Leather jerkin', f: k => { const { P } = k, lth = mat('jerkin', () => leatherTex('#6a4a2c', '#8a6a44', '#33220f'));
  tunicSkirt(k, -.3); sleeves(k, tunicMat(k.A, k.B), true);
  loft(ringsOf([[-.14, .22, .15], [-.02, .21, .138], [.1, .2, .128], [.3, .214, .134], [.5, .208, .126], [.56, .16, .104]]), 16, lth, P, 0, 0, 0, -.14, .56);
  k.bothArms(a => dome(a.sg, 0, -.02, 0, .085, .08, .07, lth)); k.belt(); } };
BODIES.haubergeon = { label: 'Mail shirt over tunic', f: k => { const { P, mail } = k;
  tunicSkirt(k, -.36); sleeves(k, tunicMat(k.A, k.B), true);
  loft(ringsOf([[-.16, .222, .152], [-.05, .208, .136], [.08, .198, .124], [.3, .212, .132], [.5, .206, .124], [.57, .155, .1]]), 16, mail, P, 0, 0, 0, -.16, .57);
  k.bothArms(a => tube(a.sg, -.0, -.16, .074, .068, mail, 10)); k.belt(); } };
BODIES.mailjerkin = { label: 'Mail under leather', f: k => { const { P, mail } = k, lth = mat('jerkin', () => leatherTex('#6a4a2c', '#8a6a44', '#33220f'));
  loft(ringsOf([[-.24, .225, .155], [-.1, .208, .136], [.05, .196, .122], [.3, .21, .13], [.5, .204, .124], [.57, .155, .1]]), 16, mail, P, 0, 0, 0, -.24, .57);
  k.bothArms(a => tube(a.sg, -.02, -.3, .064, .056, mail, 10));
  loft(ringsOf([[-.06, .228, .16], [.06, .214, .144], [.3, .224, .142], [.5, .218, .134], [.555, .17, .11]]), 16, lth, P, 0, 0, 0, -.06, .555);
  k.belt(); } };

/* ----- five more models: heads barbute, nasal, furcap, spangen, burgonet; bodies coatplates, furmantle, scale, robe, halfplate ----- */
const furtex = (base, hi, lo) => TX(64, 64, T => { T.fill(base); T.speckle(1400, [lo, hi], .015, .07, 1.1); for (let i = 0; i < 40; i++) { const x = (i * 37 % 100) / 100, y = (i * 53 % 100) / 100; T.line([[x, y], [x + .02, y + .07]], hi, 1); } });
const scaletex = (base, hi, lo) => TX(64, 64, T => { T.fill(lo); for (let r = 0; r < 10; r++) for (let c = 0; c < 8; c++) { const u = (c + (r % 2 ? .5 : 0)) / 8 + .0625, v = r / 10 + .05; T.ell(u, v, .06, .06, base); T.ell(u, v + .012, .03, .03, hi); } });
HEADS.barbute = { label: 'Barbute', f: k => { const { H, mail, metal } = k; gorget(H, mail);
  loft(ringsOf([[-.12, .118, .1, .01], [-.04, .102, .12, .012], [.08, .102, .126, .012], [.2, .1, .124, .012], [.25, .072, .092, .01], [.285, .005, .006, .01]]), 16, metal, H, 0, 0, 0, -.12, .285);
  box(.12, .026, .02, '#8f98a2', H, 0, .17, .14); box(.1, .02, .012, '#050505', H, 0, .125, .142); box(.02, .15, .012, '#050505', H, 0, .04, .142); box(.012, .1, .012, G, H, 0, .24, .1); } };
HEADS.nasal = { label: 'Nasal helm', f: k => { const { H, metal } = k; HEADS.coif.f(k);
  loft(ringsOf([[.14, .116, .136], [.2, .108, .128], [.255, .08, .096], [.292, .034, .04], [.305, .004, .005]]), 16, metal, H, 0, 0, 0, .14, .305);
  box(.026, .13, .014, '#8f98a2', H, 0, .06, .146); box(.14, .018, .02, '#8f98a2', H, 0, .15, .14); } };
HEADS.furcap = { label: 'Fur cap', f: k => { const { H } = k, fur = mat('fur', () => furtex('#5a4430', '#8a6c48', '#2c1f12'));
  loft(ringsOf([[.07, .118, .14], [.14, .114, .134], [.23, .092, .11], [.28, .05, .06], [.3, .006, .008]]), 14, fur, H, 0, 0, 0, .07, .3);
  loft(ringsOf([[.07, .128, .15], [.14, .128, .15]]), 14, fur, H, 0, 0, 0, .07, .14);
  for (const s of [-1, 1]) loft(ringsOf([[-.04, .03, .05], [.07, .05, .07]]), 8, fur, H, s * .11, 0, .0, -.04, .07); } };
HEADS.spangen = { label: 'Spangenhelm', f: k => { const { H, metal } = k, gd = mat('spanggd', () => steel('#f0d6a0', '#b0864a', '#5a3f1c', false));
  loft(ringsOf([[.08, .104, .126], [.2, .1, .122], [.255, .075, .092], [.295, .03, .036], [.31, .004, .005]]), 12, metal, H, 0, 0, 0, .08, .31);
  loft(ringsOf([[.07, .112, .134], [.1, .112, .134]]), 12, gd, H, 0, 0, 0, .07, .1);
  box(.012, .26, .012, gd, H, 0, .2, .126); box(.012, .26, .012, gd, H, 0, .2, -.126); box(.2, .012, .012, gd, H, 0, .2, 0); box(.012, .012, .24, gd, H, 0, .21, 0);
  box(.026, .13, .014, '#8f98a2', H, 0, .06, .14); for (const s of [-1, 1]) box(.01, .1, .08, '#8f98a2', H, s * .1, .04, .04); } };
HEADS.burgonet = { label: 'Burgonet', f: k => { const { H, mail, metal } = k; gorget(H, mail);
  loft(ringsOf([[-.04, .1, .12], [.02, .104, .126], [.2, .102, .124], [.245, .082, .1], [.285, .03, .04], [.3, .004, .005]]), 16, metal, H, 0, 0, 0, -.04, .3);
  box(.2, .014, .09, metal, H, 0, .17, .14); box(.03, .06, .3, '#b8352f', H, 0, .32, 0); box(.016, .035, .32, metal, H, 0, .295, 0);
  for (const s of [-1, 1]) { box(.016, .15, .1, metal, H, s * .108, .04, .04); box(.012, .09, .05, '#8f98a2', H, s * .11, -.06, .02); } } };
BODIES.coatplates = { label: 'Coat of plates', f: k => { const { P, A, B, belt, bothArms, mail } = k;
  const coat = hmat('coatpl' + A + B, T => { clothBase(T, A, B); for (let v = .12; v < .96; v += .08) for (let u = .05; u < 1; u += .09) T.rect(u, v, u + .02, v + .02, '#c9a24a'); });
  loft(ringsOf([[-.34, .24, .17], [-.2, .221, .15], [-.05, .205, .13], [.06, .192, .118], [.3, .208, .128], [.5, .2, .12], [.57, .15, .1]]), 18, coat, P, 0, 0, 0, -.34, .57);
  bothArms(a => { tube(a.sg, -.02, -.3, .064, .056, mail, 10); dome(a.sg, 0, 0, 0, .105, .1, .09, coat); }); belt(); } };
BODIES.furmantle = { label: 'Fur mantle', f: k => { const { P, A, B, belt, bothArms } = k, fur = mat('fur', () => furtex('#5a4430', '#8a6c48', '#2c1f12')), lth = mat('jerkin', () => leatherTex('#6a4a2c', '#8a6a44', '#33220f'));
  tunicSkirt(k, -.3); sleeves(k, tunicMat(A, B), true);
  loft(ringsOf([[-.14, .22, .15], [-.02, .21, .138], [.1, .2, .128], [.3, .214, .134], [.5, .208, .126], [.56, .16, .104]]), 16, lth, P, 0, 0, 0, -.14, .56);
  loft(ringsOf([[.44, .27, .19], [.5, .26, .185], [.56, .2, .14], [.6, .13, .1]]), 16, fur, P, 0, 0, 0, .44, .6); for (const s of [-1, 1]) dome(P, s * .26, .46, 0, .13, .12, .11, fur, 0, -s * .5); belt(); } };
BODIES.scale = { label: 'Scale hauberk', f: k => { const { P, A, rig, belt, bothArms, mail } = k, sc = mat('scale' + A + k.met.id, () => scaletex(k.met.t[1], k.met.t[0], k.met.t[2]));
  loft(ringsOf([[-.3, .232, .16], [-.2, .218, .146], [-.05, .204, .128], [.1, .19, .118], [.3, .208, .128], [.5, .202, .122], [.57, .152, .1]]), 18, sc, P, 0, 0, 0, -.3, .57);
  bothArms(a => { tube(a.sg, -.02, -.3, .066, .058, sc, 10); tube(a.eg, -.01, -.19, .054, .046, mail, 10); }); for (const lg of [rig.legN, rig.legF]) tube(lg.hg, -.03, -.26, .106, .09, mail, 10);
  box(.3, .5, .012, A, P, 0, -.15, .132); belt(); } };
BODIES.robe = { label: 'Warrior-monk robe', f: k => { const { P, A, B, belt, bothArms } = k, rb = hmat('robe' + A + B, T => { clothBase(T, A, shade(A, -.3)); T.rect(.46, .05, .54, 1, shade(A, -.25)); });
  loft(ringsOf([[-.62, .27, .2], [-.4, .245, .18], [-.2, .225, .155], [0, .205, .13], [.3, .208, .13], [.5, .2, .122], [.57, .15, .1]]), 18, rb, P, 0, 0, 0, -.62, .57);
  bothArms(a => { tube(a.sg, -.02, -.3, .075, .09, rb, 10); tube(a.eg, -.01, -.2, .09, .085, rb, 10); });
  loft(ringsOf([[.3, .22, .15], [.45, .21, .14], [.55, .16, .105]]), 14, hmat('scap' + B, T => clothBase(T, B, shade(B, -.3))), P, 0, 0, 0, .3, .55);
  loft(ringsOf([[0, .21, .134], [.04, .21, .134]]), 14, mat('rope', () => cloth('#c9b58a')), P, 0, 0, 0, 0, .04); box(.04, .24, .03, '#c9b58a', P, .1, -.1, .13); } };
BODIES.halfplate = { label: 'Cuirassier half-plate', f: k => { const { P, A, B, rig, belt, bothArms, torsoR, mail, metal } = k;
  loft(ringsOf([[-.2, .21, .15], [-.1, .2, .13], [.05, .19, .115], [.3, .205, .125], [.5, .2, .12], [.57, .15, .1]]), 14, mail, P, 0, 0, 0, -.2, .57); gorget(k.H, mail);
  loft(torsoR(1.08, .04, .57), 18, metal, P, 0, 0, 0, .04, .57);
  for (const s of [-1, 1]) { for (let j = 0; j < 3; j++) dome(P, s * (.26 + j * .006), .5 - j * .05, 0, .12 - j * .01, .11, .09, metal, 0, -s * .5); }
  bothArms(a => { tube(a.sg, -.03, -.27, .071, .062, metal, 10); tube(a.eg, -.015, -.2, .056, .046, metal, 10); dome(a.eg, 0, .03, .01, .06, .06, .06, metal); });
  for (const lg of [rig.legN, rig.legF]) { for (let i = 0; i < 4; i++) loft(ringsOf([[0, .122 - i * .004, .11 - i * .004], [-.1, .122 - i * .004, .11 - i * .004]]), 12, i % 2 ? metal : mail, lg.hg, 0, -.02 - i * .09, 0, -.1, 0); dome(lg.kg, 0, -.03, .035, .07, .07, .06, metal, Math.PI / 2, 0); tube(lg.kg, -.06, -.38, .07, .056, metal, 10); }
  for (let i = 0; i < 3; i++) loft(ringsOf([[-.2 - i * .06, .215 + i * .01, .15 + i * .008], [-.12 - i * .06, .215 + i * .01, .15 + i * .008]]), 18, i % 2 ? metal : mail, P, 0, 0, 0, -.2 - i * .06, -.12 - i * .06);
  box(.3, .5, .012, A, P, 0, -.1, .15); belt(); } };

// presets: the old tiers and the new designs. Each is just a choice of head, body, livery and metal
const ARMOR_PRESETS = {
  leather: { label: 'Leather / cloth', head: 'hood', body: 'quilted', metal: 'steel' }, mail: { label: 'Mail', head: 'helm', body: 'mail', metal: 'steel' }, plate: { label: 'Plate', head: 'bascinet', body: 'plate', metal: 'steel' }, special: { label: 'Special (gilded)', head: 'crested', body: 'plate', metal: 'gilded' },
  militia: { label: 'Militia (cap, tunic)', head: 'cap', body: 'tunic', metal: 'steel' }, sergeant: { label: 'Sergeant (coif, mail shirt)', head: 'coifhelm', body: 'haubergeon', metal: 'steel' },
  jack: { label: 'Jack and kettle hat', head: 'kettlehat', body: 'jack', metal: 'steel' }, brigandine: { label: 'Brigandine and sallet', head: 'sallet', body: 'brigandine', metal: 'steel' }, lamellar: { label: 'Lamellar', head: 'cone', body: 'lamellar', metal: 'steel' },
  komtur: { label: 'Komtur (mantle, great helm)', head: 'greathelm', body: 'komtur', metal: 'steel', liv: 'white' }, spire: { label: 'Spire (black lancet)', head: 'spire', body: 'spire', metal: 'black', liv: 'black' }, deco: { label: 'Deco plate', head: 'domed', body: 'deco', metal: 'silver', liv: 'azure' },
  wolfhunter: { label: 'Wolf-hunter (fur cap and mantle)', head: 'furcap', body: 'furmantle', metal: 'steel', liv: 'green' }, norman: { label: 'Norman (nasal helm, coat of plates)', head: 'nasal', body: 'coatplates', metal: 'steel', liv: 'red' },
  varangian: { label: 'Varangian (spangenhelm, scale)', head: 'spangen', body: 'scale', metal: 'bronze', liv: 'azure' }, cuirassier: { label: 'Cuirassier (burgonet, half-plate)', head: 'burgonet', body: 'halfplate', metal: 'silver', liv: 'black' }, monk: { label: 'Warrior-monk (barbute, robe)', head: 'barbute', body: 'robe', metal: 'black', liv: 'ash' },
  griffon: { label: 'Griffon (per fess)', head: 'beaked', body: 'griffon', metal: 'steel', liv: 'azure' }, sun: { label: 'Sunburst', head: 'domed', body: 'sun', metal: 'silver', liv: 'red' }, stag: { label: 'Stag (bend tabard)', head: 'beaked', body: 'stag', metal: 'steel', liv: 'green' }, warlord: { label: 'Warlord (black spiked)', head: 'blackhelm', body: 'warlord', metal: 'black', liv: 'red' }
};
const BODYCFG = { coatplates: 'mail', furmantle: 'leather', scale: 'mail', robe: 'leather', quilted: 'leather', jack: 'leather', tunic: 'leather', jerkin: 'leather', mail: 'mail', brigandine: 'mail', lamellar: 'mail', haubergeon: 'mail', mailjerkin: 'mail' };
function dressMedieval(rig, role, tier, broken, lo) {
  const P = rig.pelvis, H = rig.headG, c = COL[role] || COL.p;
  const pre = ARMOR_PRESETS[tier] || ARMOR_PRESETS.leather, head = (lo && HEADS[lo.head]) ? lo.head : pre.head, body = (lo && BODIES[lo.body]) ? lo.body : pre.body;
  const metalId = (lo && METALS[lo.metal]) ? lo.metal : pre.metal, met = Object.assign({ id: metalId }, METALS[metalId]);
  const lv = (lo && LIVERIES[lo.liv]) ? LIVERIES[lo.liv].c : (pre.liv ? LIVERIES[pre.liv].c : [c.tab, c.trim]);
  const metal = mat('steel' + metalId, () => steel(...met.t)), mail = mat('mail', () => mailtex('#6f767e', '#b2bac2', '#3c4147'));
  const quil = mat('quilt' + role, () => quilt(role === 'p' ? '#b79d73' : '#8d7a62', '#6a5638'));
  const leather = mat('leather', () => cloth('#4a3524', '#2a1c10'));
  const torsoR = (s, y0, y1) => ringsOf([[y0, .17 * s, .105 * s], [y0 + .14, .185 * s, .112 * s], [(y0 + y1) / 2, .2 * s, .125 * s], [y1 - .05, .205 * s, .122 * s], [y1, .16 * s, .1 * s]]);
  const belt = () => { loft(ringsOf([[0, .182, .114], [.045, .182, .114]]), 12, leather, P, 0, .03, 0, 0, .045); box(.05, .05, .03, G, P, 0, .05, .122); };
  const bothArms = f => { f(rig.near); f(rig.far); };
  if (broken) { belt(); box(.28, .36, .012, c.tab, P, 0, .12, .122); box(.28, .3, .012, c.tab, P, 0, .12, -.122); return; }
  const k = { rig, role, P, H, c, A: lv[0], B: lv[1], met, metal, mail, quil, leather, torsoR, belt, bothArms, logo: LOGOS[role] || null };
  BODIES[body].f(k); HEADS[head].f(k);
}

function makeRig(cfg, opts) {
  Object.assign(HT.character, BASE, cfg, { helmet: 0, visor: 0, armor: 0, shieldDev: 0 });
  HT.buildCharacter(); const rig = HT.rig; HT.rig = null; HT.figureRoot.remove(rig.g);
  if (HT.gun) HT.gun.visible = false;
  const nearArm = rig.arms.find(a => a.s < 0), farArm = rig.arms.find(a => a.s > 0);
  rig.near = nearArm; rig.far = farArm; rig.legN = rig.legs.find(l => l.s < 0); rig.legF = rig.legs.find(l => l.s > 0);
  dressMedieval(rig, opts.role, opts.tier, opts.broken, opts.look);
  rig.sword = addSword(nearArm.wg, !!opts.two, !!opts.big, opts.handle, opts.kind);
  if (opts.shield) {
    rig.shield = new Group(); farArm.eg.add(rig.shield); rig.shield.position.set(0.0, -0.16, 0.1); rig.shield.rotation.y = 0;
    const col = opts.shield, c2 = '#d9cfa8';
    const steps = [[.36, .1, .08], [.33, .1, .0], [.27, .1, -.08], [.19, .1, -.16], [.1, .09, -.23], [.03, .08, -.29]];
    for (const [w, h, y] of steps) { box(0.035, h, w, col, rig.shield, 0, y, 0); box(0.043, h * .8, w * .22, c2, rig.shield, 0, y, 0); }
    box(0.046, 0.026, 0.32, c2, rig.shield, 0, 0.06, 0); box(0.05, 0.05, 0.05, '#c9a24a', rig.shield, 0, 0.0, 0);
    const lg = LOGOS[opts.role];
    if (lg) {                                                       // company or faction logo on the shield face
      const m = new Mesh(new BoxGeometry(0.05, 0.26, 0.26), mat('shieldlogo' + opts.role + lg.ver, () => TX(36, 36, T => logoAt(T, lg, .5, 0, 1))));
      m.position.set(0, 0.0, 0); rig.shield.add(m);
    }
  }
  HT.scene.add(rig.g); rig.g.visible = false; rig.opts = opts; rig.ankle0 = 0.07;
  return rig;
}
M3.rigs = {};
const RIG_CAP = 64; let rigClock = 0, visRig = null;      // cap: 5 players + 20 varied enemies + their Armor Break versions fit
function dropRig(key) {                                                 // geometry is per rig; materials are shared through MAT and stay
  const r = M3.rigs[key]; if (!r) return; HT.scene.remove(r.g); if (visRig === r) visRig = null;
  r.g.traverse(o => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); }); delete M3.rigs[key];
}
M3.make = (key, cfg, opts) => {
  dropRig(key);
  const keys = Object.keys(M3.rigs);
  if (keys.length >= RIG_CAP) { keys.sort((a, b) => M3.rigs[a]._used - M3.rigs[b]._used); for (const k of keys.slice(0, keys.length - RIG_CAP + 1)) dropRig(k); }
  const r = makeRig(cfg, opts || {}); r._used = ++rigClock; M3.rigs[key] = r; return r;
};
/* armor tiers -> humantest parts (outfit, build, helmet + visor type, armor vest + gear colour) */
const TIERLOOK = {
  p: { leather: { outfit: 0, build: 1, helmet: 0, visor: 0, armor: 0, gear: 0 }, mail: { outfit: 2, build: 1, helmet: 1, visor: 2, armor: 1, gear: 0 },
       plate: { outfit: 2, build: 1, helmet: 1, visor: 1, armor: 1, gear: 0 }, special: { outfit: 2, build: 1, helmet: 1, visor: 1, armor: 1, gear: 2 } },
  e: { leather: { outfit: 0, build: 1, helmet: 0, visor: 0, armor: 0, gear: 2, hair: 1, beard: 1 }, mail: { outfit: 2, build: 1, helmet: 1, visor: 2, armor: 1, gear: 3 },
       plate: { outfit: 2, build: 1, helmet: 1, visor: 1, armor: 1, gear: 1 }, special: { outfit: 2, build: 1, helmet: 1, visor: 1, armor: 1, gear: 2 } }
};
const SHIELDCOL = { leather: '#8a6a45', mail: '#7a8088', plate: '#9aa2ac', special: '#b8363a' };
Object.assign(SHIELDCOL, { jack: '#8a6a45', brigandine: '#7d2a2a', lamellar: '#a37a4a', crusader: '#ece6d4', gothic: '#9aa2ac', warlord: '#2a2d33' });
M3.getRig = function (role, f) {
  const tier = ARMOR_PRESETS[f.tier] ? f.tier : 'leather', broken = !!f.broken, two = !!f.two, sh = !!f.shield;
  const lo = (f.pHead || f.pBody || f.pLiv || f.pMetal) ? { head: f.pHead, body: f.pBody, liv: f.pLiv, metal: f.pMetal } : null;
  const pre = ARMOR_PRESETS[tier], bodyId = (lo && BODIES[lo.body]) ? lo.body : pre.body, livId = (lo && LIVERIES[lo.liv]) ? lo.liv : (pre.liv || '');
  const wk = f.wkind || 'sword', key = [role, 'L' + (LOGOS[role] ? LOGOS[role].ver : 0), tier, lo ? [lo.head || '', lo.body || '', lo.liv || '', lo.metal || ''].join('/') : '', broken ? 1 : 0, two ? 1 : 0, sh ? 1 : 0, wk].join('|');
  let r = M3.rigs[key];
  if (r) r._used = ++rigClock;
  if (!r) {
    const base = TIERLOOK[role][BODYCFG[bodyId] || 'plate'];
    const cfg = Object.assign({}, base);
    if (broken) { cfg.armor = 0; cfg.helmet = 0; cfg.visor = 0; }                 // Armor Break: the pads and helmet come off
    const shc = livId ? LIVERIES[livId].c[0] : (SHIELDCOL[tier] || '#9aa2ac');
    r = M3.make(key, cfg, { role: role, tier: tier, look: lo, broken: broken, two: two, kind: wk, big: two, handle: role === 'p' ? 0.22 : 0.14, shield: sh && !two ? shc : null });
    if (role === 'e') r.g.scale.x = -1;                        // enemies carry the shield on the camera side
    r.key = key;
  }
  return r;
};
/* enemy looks: random per enemy, from pools set by rank (armor class). The sim hands each enemy a lookSeed, so every client draws the same man. */
const RANK_POOLS = {
  leather: { heads: ['bare', 'cap', 'leathercap', 'hood'], bodies: ['tunic', 'jerkin', 'quilted', 'jack'], metals: ['steel'] },
  mail:    { heads: ['coif', 'coifhelm', 'helm', 'cone', 'sallet', 'kettlehat'], bodies: ['haubergeon', 'mailjerkin', 'mail', 'brigandine', 'lamellar'], metals: ['steel', 'black'] },
  plate:   { heads: ['bascinet', 'sallet', 'greathelm', 'beaked', 'domed'], bodies: ['plate', 'komtur', 'griffon', 'stag', 'sun'], metals: ['steel', 'silver', 'black'] },
  special: { heads: ['crested', 'spire', 'blackhelm', 'greathelm', 'domed'], bodies: ['spire', 'warlord', 'deco', 'plate'], metals: ['gilded', 'black', 'silver', 'bronze'] }
};
M3.rankPools = RANK_POOLS;
M3.enemyLook = function (tier, seed) {
  const pool = RANK_POOLS[tier] || RANK_POOLS.leather; let a = (seed >>> 0) || 1;
  const pick = list => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return list[(a >>> 8) % list.length]; };
  const livs = Object.keys(LIVERIES);
  return { head: pick(pool.heads), body: pick(pool.bodies), metal: pick(pool.metals), liv: pick(livs) };
};
const listParts = (R, draft) => Object.keys(R).filter(id => !!R[id].draft === draft).map(id => [id, R[id].label]);
M3.draftParts = { heads: listParts(HEADS, true), bodies: listParts(BODIES, true) };
let logoVer = 0;
M3.setLogo = function (role, src) {                                  // src: a 36x36 canvas, or null to go back to the painted devices
  if (!src) { LOGOS[role] = null; return; }
  const c = document.createElement('canvas'); c.width = c.height = 36; c.getContext('2d').drawImage(src, 0, 0, 36, 36);
  LOGOS[role] = { canvas: c, ver: ++logoVer };
};
M3.parts = { heads: listParts(HEADS, false), bodies: listParts(BODIES, false), liveries: Object.keys(LIVERIES).map(id => [id, LIVERIES[id].label]), metals: Object.keys(METALS).map(id => [id, METALS[id].label]), presets: Object.keys(ARMOR_PRESETS).map(id => [id, ARMOR_PRESETS[id].label]) };

/* ---------- poses ---------- */
// pose fields (all optional; missing = neutral guard):
//  py pelvis height offset; pel [pitch, yaw, roll] deg; head [pitch,yaw]; hand [x,y,z] near-hand target in pelvis space; blade [x,y,z] direction;
//  two: far hand grips the handle (offset along the handle); far [x,y,z] far-wrist target if not two; legN/legF [hipX, hipZ, kneeX, ankX, hipY]; hy hips yaw deg
const P = (o) => Object.assign({ py: 0, pel: [0, 0, 0], head: [0, 0], hand: [-0.22, 0.34, 0.3], blade: [0, 0.35, 1], two: false, far: [0.2, 0.2, 0.12], grip: 0.13,
  legN: [-4, 0, 6, 0, 0], legF: [6, 0, 8, 0, 0], hy: 0, rz: 0, w: 0, pole: [-0.5, -1, -0.3], fpole: [0.5, -1, -0.3], g: [0, 0, 0], broll: 0, fwOn: 0, farW: [0, 0, 0] }, o);
const KEYS = {
  idle: [
    P({ py: 0, pel: [1, -4, 0.6], head: [0, 4], hand: [-0.22, 0.34, 0.3], blade: [0, 0.5, 1], far: [0.22, 0.14, 0.26], legN: [-6, 0, 8, 0, 0], legF: [8, 0, 12, 0, 0] }),
    P({ py: -0.014, pel: [3, -7, 0.2], head: [2, 2], hand: [-0.21, 0.37, 0.32], blade: [0, 0.6, 1], far: [0.23, 0.16, 0.27], legN: [-8, 0, 11, 0, 0], legF: [9, 0, 14, 0, 0] }),
    P({ py: -0.004, pel: [2, -2, -0.6], head: [0, 0], hand: [-0.23, 0.33, 0.29], blade: [0, 0.4, 1], far: [0.21, 0.13, 0.25], legN: [-5, 0, 9, 0, 0], legF: [7, 0, 11, 0, 0] }),
    P({ py: -0.01, pel: [3, -5, 0], head: [1, 3], hand: [-0.22, 0.36, 0.31], blade: [0, 0.55, 1], far: [0.22, 0.15, 0.26], legN: [-7, 0, 10, 0, 0], legF: [8, 0, 13, 0, 0] })
  ],
  idleTwo: [                                                                                                 // two-handed ready stance: both hands on the hilt, point up and forward
    P({ w: 1, two: true, grip: 0.12, py: 0, pel: [8, -30, 0], head: [3, 4], hand: [0, -0.15, 0.3], blade: [0, 0.74, 0.67], legN: [-30, 0, 38, 0, 0], legF: [26, 0, 30, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, py: -0.012, pel: [9, -30, 0], head: [3, 4], hand: [0, -0.138, 0.3], blade: [0, 0.76, 0.65], legN: [-30, 0, 38, 0, 0], legF: [26, 0, 30, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, py: -0.004, pel: [7.5, -30, 0], head: [3, 4], hand: [0, -0.158, 0.3], blade: [0, 0.72, 0.69], legN: [-30, 0, 38, 0, 0], legF: [26, 0, 30, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, py: -0.008, pel: [8.5, -30, 0], head: [3, 4], hand: [0, -0.144, 0.3], blade: [0, 0.75, 0.66], legN: [-30, 0, 38, 0, 0], legF: [26, 0, 30, 0, 0] })
  ],
  idle1s: [
    P({ w: 1, py: 0, pel: [4, -30, 0], head: [0, 2], hand: [0, 0.28, 0.32], blade: [0, 1, 0.08], far: [0.32, 0.05, 0.42], legN: [-34, 0, 40, 0, 0], legF: [30, 0, 36, 0, 0] }),
    P({ w: 1, py: -0.012, pel: [5.5, -30, 0], head: [0, 2], hand: [0, 0.292, 0.32], blade: [0, 1, 0.08], far: [0.32, 0.05, 0.42], legN: [-34, 0, 40, 0, 0], legF: [30, 0, 36, 0, 0] }),
    P({ w: 1, py: -0.004, pel: [3.5, -30, 0], head: [0, 2], hand: [0, 0.272, 0.32], blade: [0, 1, 0.08], far: [0.32, 0.05, 0.42], legN: [-34, 0, 40, 0, 0], legF: [30, 0, 36, 0, 0] }),
    P({ w: 1, py: -0.008, pel: [5, -30, 0], head: [0, 2], hand: [0, 0.286, 0.32], blade: [0, 1, 0.08], far: [0.32, 0.05, 0.42], legN: [-34, 0, 40, 0, 0], legF: [30, 0, 36, 0, 0] })
  ],
  idle1: [
    P({ w: 1, py: 0, pel: [4, -30, 0], head: [0, 2], hand: [0, 0.28, 0.32], blade: [0, 1, 0.08], far: [0.2, -0.1, 0.12], legN: [-34, 0, 40, 0, 0], legF: [30, 0, 36, 0, 0] }),
    P({ w: 1, py: -0.012, pel: [5.5, -30, 0], head: [0, 2], hand: [0, 0.292, 0.32], blade: [0, 1, 0.08], far: [0.2, -0.1, 0.12], legN: [-34, 0, 40, 0, 0], legF: [30, 0, 36, 0, 0] }),
    P({ w: 1, py: -0.004, pel: [3.5, -30, 0], head: [0, 2], hand: [0, 0.272, 0.32], blade: [0, 1, 0.08], far: [0.2, -0.1, 0.12], legN: [-34, 0, 40, 0, 0], legF: [30, 0, 36, 0, 0] }),
    P({ w: 1, py: -0.008, pel: [5, -30, 0], head: [0, 2], hand: [0, 0.286, 0.32], blade: [0, 1, 0.08], far: [0.2, -0.1, 0.12], legN: [-34, 0, 40, 0, 0], legF: [30, 0, 36, 0, 0] })
  ],
  idle2: [
    P({ w: 1, two: true, grip: 0.12, py: 0, pel: [8, -34, 0], head: [4, 2], hand: [0, -0.32, 0.32], blade: [0, 0.28, 0.96], legN: [-38, 0, 56, 0, 0], legF: [32, 0, 40, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, py: -0.012, pel: [9.5, -34, 0], head: [4, 2], hand: [0, -0.308, 0.32], blade: [0, 0.28, 0.96], legN: [-38, 0, 56, 0, 0], legF: [32, 0, 40, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, py: -0.004, pel: [7.5, -34, 0], head: [4, 2], hand: [0, -0.328, 0.32], blade: [0, 0.28, 0.96], legN: [-38, 0, 56, 0, 0], legF: [32, 0, 40, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, py: -0.008, pel: [9, -34, 0], head: [4, 2], hand: [0, -0.314, 0.32], blade: [0, 0.28, 0.96], legN: [-38, 0, 56, 0, 0], legF: [32, 0, 40, 0, 0] })
  ],
  // ---- ONE-HANDED (sword + shield) ----
  // Overhead Chop (Oberhau): raise high, arm up and back, drive down in front, cut through to a low finish
  chop1: [
    P({ w: 1, py: 0, pel: [1, -4, 0.6], head: [0, 4], hand: [-0.22, 0.34, 0.3], blade: [0, 0.5, 1], far: [0.22, 0.14, 0.26], legN: [-6, 0, 8, 0, 0], legF: [8, 0, 12, 0, 0] }),
    P({ w: 1, py: 0, pel: [14, -44, 0], head: [2, 2], hand: [0, -0.3, 0.2], blade: [0, -0.5, -1], far: [0.22, 0.3, 0.3], legN: [-61, 0, 84, 0, 0], legF: [45, 0, 19, 0, 0] }),
    P({ w: 1, rz: -0.04, pel: [20, -52, 0], head: [2, 2], hand: [0, -0.15, -0.1], blade: [0, -0.2, -1], far: [0.26, 0.4, 0.36], legN: [-62, 0, 86, 0, 0], legF: [46, 0, 20, 0, 0] }),
    P({ w: 1, rz: -0.04, pel: [4, -44, 0], head: [-2, 2], hand: [0, 0.45, -0.05], blade: [0, 0.74, -0.67], far: [0.28, 0.5, 0.4], legN: [-60, 0, 82, 0, 0], legF: [44, 0, 18, 0, 0] }),
    P({ w: 1, rz: -0.05, pel: [-8, -34, 0], head: [-8, 0], hand: [0, 0.55, -0.1], blade: [0, 0.3, -1], far: [0.3, 0.55, 0.42], legN: [-58, 0, 78, 0, 0], legF: [43, 0, 16, 0, 0] }),
    P({ w: 1, rz: 0.02, pel: [10, -48, 0], head: [2, 2], hand: [0, 0.3, 0.35], blade: [0, 0.74, 0.67], far: [0.3, 0.3, 0.1], legN: [-56, 0, 74, 0, 0], legF: [42, 0, 14, 0, 0] }),
    P({ w: 1, rz: 0.1, pel: [20, -58, 0], head: [6, 2], hand: [0, -0.1, 0.52], blade: [0, -0.5, 0.95], far: [0.34, 0.12, -0.14], legN: [-56, 0, 74, 0, 0], legF: [42, 0, 14, 0, 0] }),
    P({ w: 1, rz: 0.1, pel: [20, -58, 0], head: [6, 2], hand: [0, -0.1, 0.52], blade: [0, -0.5, 0.95], far: [0.34, 0.12, -0.14], legN: [-56, 0, 74, 0, 0], legF: [42, 0, 14, 0, 0] }),
    P({ w: 1, rz: 0.12, pel: [22, -52, 0], head: [8, 2], hand: [0, -0.4, 0.35], blade: [0, -1, 0.35], far: [0.36, 0.2, -0.2], legN: [-57, 0, 76, 0, 0], legF: [42, 0, 15, 0, 0] }),
    P({ w: 1, rz: 0.06, pel: [16, -48, 0], head: [4, 2], hand: [0, -0.3, 0.28], blade: [0, -0.45, 0.85], far: [0.3, 0.2, 0.0], legN: [-40, 0, 50, 0, 0], legF: [30, 0, 16, 0, 0] }),
    P({ pel: [4, -10, 0], hand: [-0.22, 0.3, 0.3], blade: [0, 0.3, 1], far: [0.22, 0.2, 0.2], legN: [-12, 0, 14, 0, 0], legF: [10, 0, 14, 0, 0] }),
    P({ pel: [4, -10, 0], hand: [-0.22, 0.3, 0.3], blade: [0, 0.3, 1], far: [0.22, 0.2, 0.2], legN: [-12, 0, 14, 0, 0], legF: [10, 0, 14, 0, 0] })
  ],
  // Heavy Lunge: sword goes up, front leg out, rear knee drops (taking a knee), cut down and carry through
  lunge1: [
    P({ w: 1, py: 0, pel: [1, -4, 0.6], head: [0, 4], hand: [-0.22, 0.34, 0.3], blade: [0, 0.5, 1], far: [0.22, 0.14, 0.26], legN: [-6, 0, 8, 0, 0], legF: [8, 0, 12, 0, 0] }),
    P({ w: 1, pel: [6, -25, 0], head: [5, 3], hand: [0, -0.37, -0.3], blade: [0, -0.7, -0.72], far: [0.24, 0.15, 0.3], legN: [-34, 0, 70, 0, 0], legF: [35, 0, 5, 0, 0] }),
    P({ w: 1, rz: -0.02, pel: [4, -30, 0], head: [10, 3], hand: [0, -0.04, -0.31], blade: [0, -0.04, -1], far: [0.28, 0.3, 0.34], legN: [-19, 0, 39, 0, 0], legF: [20, 0, 6, 0, 0] }),
    P({ w: 1, rz: -0.02, pel: [-4, -25, 0], head: [-6, 0], hand: [0, 0.5, -0.1], blade: [0, 0.74, -0.67], far: [0.26, 0.5, 0.42], legN: [-20, 0, 40, 0, 0], legF: [20, 0, 6, 0, 0] }),
    P({ w: 1, rz: 0.04, pel: [8, -25, 0], head: [2, 2], hand: [0, 0.15, 0.4], blade: [0, 0.3, 0.95], far: [0.3, 0.3, 0.1], legN: [-30, 0, 60, 0, 0], legF: [30, 0, 5, 0, 0] }),
    P({ w: 1, rz: 0.12, pel: [18, -22, 0], head: [10, 2], hand: [0, -0.49, 0.26], blade: [0, -0.45, 0.89], far: [0.34, 0.12, -0.14], legN: [-42, 0, 86, 0, 0], legF: [47, 0, 4, 0, 0] }),
    P({ w: 1, rz: 0.13, pel: [19, -22, 0], head: [11, 2], hand: [0, -0.45, 0.3], blade: [0, -0.5, 0.85], far: [0.36, 0.2, -0.2], legN: [-42, 0, 86, 0, 0], legF: [47, 0, 4, 0, 0] }),
    P({ w: 1, rz: 0.06, pel: [6, -25, 0], head: [8, 2], hand: [0, -0.29, 0.21], blade: [0, -0.59, 0.81], far: [0.3, 0.2, 0.0], legN: [-20, 0, 42, 0, 0], legF: [21, 0, 6, 0, 0] }),
    P({ w: 1, rz: 0.05, pel: [10, -22, 0], head: [6, 2], hand: [0, -0.3, 0.3], blade: [0, -0.45, 0.85], far: [0.3, 0.2, 0.0], legN: [-24, 0, 44, 0, 0], legF: [22, 0, 8, 0, 0] }),
    P({ pel: [4, -10, 0], hand: [-0.22, 0.3, 0.3], blade: [0, 0.3, 1], far: [0.22, 0.2, 0.2], legN: [-12, 0, 14, 0, 0], legF: [10, 0, 14, 0, 0] }),
    P({ pel: [4, -10, 0], hand: [-0.22, 0.3, 0.3], blade: [0, 0.3, 1], far: [0.22, 0.2, 0.2], legN: [-12, 0, 14, 0, 0], legF: [10, 0, 14, 0, 0] })
  ],
  // Longsword Cut: diagonal from a high guard over the shoulder, smooth and wide
  cut1: [
    P({ w: 1, py: 0, pel: [1, -4, 0.6], head: [0, 4], hand: [-0.22, 0.34, 0.3], blade: [0, 0.5, 1], far: [0.22, 0.14, 0.26], legN: [-6, 0, 8, 0, 0], legF: [8, 0, 12, 0, 0] }),
    P({ w: 1, pel: [14, -44, 0], head: [2, 2], hand: [0, -0.3, 0.2], blade: [0, -0.5, -1], far: [0.22, 0.3, 0.3], legN: [-63, 0, 66, 0, 0], legF: [37, 0, 25, 0, 0] }),
    P({ w: 1, rz: -0.03, pel: [10, -52, 0], head: [0, 6], hand: [0, 0.25, -0.1], blade: [0, 0.74, -0.67], far: [0.28, 0.4, 0.36], legN: [-64, 0, 68, 0, 0], legF: [38, 0, 26, 0, 0] }),
    P({ w: 1, rz: -0.04, pel: [-2, -46, 0], head: [-4, 6], hand: [0, 0.5, -0.05], blade: [0, 0.74, -0.67], far: [0.3, 0.5, 0.4], legN: [-62, 0, 64, 0, 0], legF: [36, 0, 24, 0, 0] }),
    P({ w: 1, rz: 0.0, pel: [4, -36, 0], head: [0, 4], hand: [0, 0.45, 0.2], blade: [0, 0.74, 0.67], far: [0.3, 0.4, 0.3], legN: [-60, 0, 60, 0, 0], legF: [35, 0, 22, 0, 0] }),
    P({ w: 1, rz: 0.05, pel: [10, -18, 0], head: [2, 0], hand: [0, 0.2, 0.45], blade: [0, 0.35, 1], far: [0.32, 0.22, 0.1], legN: [-58, 0, 56, 0, 0], legF: [34, 0, 20, 0, 0] }),
    P({ w: 1, rz: 0.11, pel: [14, 6, 0], head: [4, -6], hand: [0, -0.05, 0.52], blade: [0, -0.35, 0.95], far: [0.34, 0.14, -0.1], legN: [-58, 0, 56, 0, 0], legF: [34, 0, 20, 0, 0], hy: 10 }),
    P({ w: 1, rz: 0.1, pel: [16, 10, 0], head: [6, -8], hand: [0, -0.25, 0.42], blade: [0, -0.5, 0.82], far: [0.34, 0.14, -0.1], legN: [-52, 0, 52, 0, 0], legF: [32, 0, 18, 0, 0] }),
    P({ pel: [4, -10, 0], hand: [-0.22, 0.3, 0.3], blade: [0, 0.3, 1], far: [0.22, 0.2, 0.2], legN: [-12, 0, 14, 0, 0], legF: [10, 0, 14, 0, 0] }),
    P({ pel: [4, -10, 0], hand: [-0.22, 0.3, 0.3], blade: [0, 0.3, 1], far: [0.22, 0.2, 0.2], legN: [-12, 0, 14, 0, 0], legF: [10, 0, 14, 0, 0] })
  ],
  // ---- TWO-HANDED ----
  // Horizontal Slash: two-handed baseball swing (hitch, stride, hips fire, hands lag, wrap)
  attack2: [
    P({ two: true, pel: [-2, -22, 0], hand: [-0.12, 0.62, -0.14], blade: [0, 0.74, -0.67], grip: 0.12, legN: [-12, 0, 8, 0, 0], legF: [14, 0, 10, 0, -10], hy: -10 }),                                   // 0 set
    P({ two: true, py: -0.04, rz: -0.08, pel: [-4, -50, 0], head: [0, 24], hand: [-0.22, 0.58, -0.28], blade: [-0.1, 1, -0.6], grip: 0.12, legN: [-6, 0, 10, 0, 0], legF: [28, 0, 34, 0, -16], hy: -30 }),  // 1 load: weight onto the back leg, hands drawn back
    P({ two: true, py: -0.07, rz: -0.02, pel: [2, -56, 0], head: [0, 28], hand: [-0.24, 0.5, -0.22], blade: [-0.2, 0.75, -0.75], grip: 0.12, legN: [-38, 0, 30, 0, 0], legF: [24, 0, 20, 0, -22], hy: -28 }), // 2 stride plants
    P({ two: true, py: -0.08, rz: 0.04, pel: [6, -36, 0], head: [0, 22], hand: [-0.2, 0.46, -0.1], blade: [-0.1, 0.5, -0.9], grip: 0.12, legN: [-42, 0, 26, 0, 0], legF: [22, 0, 18, 0, -6], hy: -2 }),     // 3 hips fire, hands still back (lag)
    P({ two: true, py: -0.08, rz: 0.08, pel: [8, -8, 0], head: [0, 8], hand: [-0.12, 0.42, 0.18], blade: [-0.2, 0.2, 0.7], grip: 0.12, legN: [-44, 0, 24, 0, 0], legF: [26, 0, 24, 0, 8], hy: 22 }),     // 4 shoulders, hands drive, barrel behind
    P({ two: true, py: -0.08, rz: 0.1, pel: [8, 24, 0], head: [0, -12], hand: [0.0, 0.4, 0.46], blade: [0.4, 0.0, 1], grip: 0.12, legN: [-44, 0, 22, 0, 0], legF: [30, 0, 28, 0, 24], hy: 38 }),         // 5 CONTACT
    P({ two: true, py: -0.08, rz: 0.12, pel: [8, 54, 0], head: [0, -26], hand: [0.08, 0.42, 0.46], blade: [0.85, 0.1, 0.8], grip: 0.12, legN: [-44, 0, 22, 0, 0], legF: [30, 0, 28, 0, 32], hy: 50 }),   // 6 extend
    P({ two: true, py: -0.06, rz: 0.1, pel: [4, 78, 0], head: [0, -42], hand: [0.18, 0.62, 0.12], blade: [0.5, 1, 0.1], grip: 0.12, legN: [-36, 0, 20, 0, 0], legF: [26, 0, 24, 0, 38], hy: 60 }),         // 7 wrap over the shoulder
    P({ two: true, py: -0.04, rz: 0.07, pel: [4, 56, 0], head: [0, -30], hand: [0.14, 0.68, 0.06], blade: [0.3, 1, 0.0], grip: 0.12, legN: [-28, 0, 18, 0, 0], legF: [22, 0, 20, 0, 28], hy: 44 }),         // 8 overshoot settles
    P({ pel: [3, 20, 0], hand: [-0.2, 0.34, 0.3], blade: [0, 0.4, 1], legN: [-14, 0, 12, 0, 0], legF: [12, 0, 12, 0, 6], hy: 10 })                                                                 // 9 recover
  ],
  attack21: [
    P({ w: 1, py: 0, pel: [1, -4, 0.6], head: [0, 4], hand: [-0.22, 0.34, 0.3], blade: [0, 0.5, 1], far: [0.22, 0.14, 0.26], legN: [-6, 0, 8, 0, 0], legF: [8, 0, 12, 0, 0] }),
    P({ w: 1, rz: 0.00, pel: [6, -44, 0], hand: [0, -0.1, 0.15], blade: [0, -0.3, -1], far: [0.24, 0.1, 0.2], legN: [-61, 0, 80, 0, 0], legF: [43, 0, 21, 0, 0] }),
    P({ w: 1, rz: 0.00, pel: [6, -56, 0], hand: [0, 0.0, -0.2], blade: [0, 0.0, -1], far: [0.28, 0.2, 0.3], legN: [-62, 0, 82, 0, 0], legF: [44, 0, 22, 0, 0] }),
    P({ w: 1, rz: 0.00, pel: [6, -62, 0], hand: [0, 0.08, -0.3], blade: [0, 0.05, -1], far: [0.3, 0.3, 0.34], legN: [-60, 0, 78, 0, 0], legF: [42, 0, 20, 0, 0] }),
    P({ w: 1, rz: 0.00, pel: [6, -52, 0], hand: [0, 0.1, -0.22], blade: [0, 0.05, -1], far: [0.3, 0.25, 0.3], legN: [-58, 0, 74, 0, 0], legF: [41, 0, 18, 0, 0] }),
    P({ w: 1, rz: 0.10, pel: [6, -30, 0], hand: [0, 0.12, 0.15], blade: [0.3, 0.0, 0.95], far: [0.3, 0.2, 0.1], legN: [-56, 0, 70, 0, 0], legF: [40, 0, 16, 0, 0] }),
    P({ w: 1, rz: 0.10, pel: [6, -4, 0], hand: [0, 0.1, 0.5], blade: [0, -0.05, 1], far: [0.26, 0.1, -0.05], legN: [-56, 0, 70, 0, 0], legF: [40, 0, 16, 0, 0] }),
    P({ w: 1, rz: 0.10, pel: [6, 20, 0], hand: [0, 0.12, 0.52], blade: [0, 0.0, 1], far: [0.22, 0.05, -0.15], legN: [-57, 0, 72, 0, 0], legF: [40, 0, 17, 0, 0] }),
    P({ w: 1, rz: 0.10, pel: [6, 36, 0], hand: [0, 0.25, 0.3], blade: [0, 0.3, 0.92], far: [0.2, 0.0, -0.1], legN: [-59, 0, 76, 0, 0], legF: [42, 0, 19, 0, 0] }),
    P({ w: 1, rz: 0.10, pel: [6, 22, 0], hand: [0, 0.0, 0.3], blade: [0, -0.1, 1], far: [0.22, 0.1, 0.1], legN: [-60, 0, 78, 0, 0], legF: [42, 0, 20, 0, 0] }),
    P({ pel: [4, -10, 0], hand: [-0.22, 0.3, 0.3], blade: [0, 0.3, 1], far: [0.22, 0.2, 0.2], legN: [-12, 0, 14, 0, 0], legF: [10, 0, 14, 0, 0] }),
    P({ pel: [4, -10, 0], hand: [-0.22, 0.3, 0.3], blade: [0, 0.3, 1], far: [0.22, 0.2, 0.2], legN: [-12, 0, 14, 0, 0], legF: [10, 0, 14, 0, 0] })
  ],

  // Overhead Chop (Oberhau): vom tag overhead, arms reach up, step and cut straight down through the target
  // Overhead Chop (two-hand)
  chop2: [
    P({ w: 1, two: true, grip: 0.12, rz: 0, pel: [10, -36, 0], head: [2, 2], hand: [0, 0.0, 0.3], blade: [0, 0.75, 0.65], legN: [-56, 0, 80, 0, 0], legF: [42, 0, 18, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, rz: 0, pel: [2, -34, 0], head: [2, 2], hand: [0, 0.35, 0.15], blade: [0, 0.95, 0.3], legN: [-56, 0, 76, 0, 0], legF: [42, 0, 16, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, rz: 0, pel: [-6, -32, 0], head: [2, 2], hand: [0, 0.62, 0.1], blade: [0, 1, 0.0], legN: [-56, 0, 74, 0, 0], legF: [42, 0, 14, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, rz: 0.03, pel: [6, -36, 0], head: [2, 2], hand: [0, 0.42, 0.4], blade: [0, 0.4, 0.92], legN: [-56, 0, 74, 0, 0], legF: [42, 0, 14, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, rz: 0.08, pel: [18, -42, 0], head: [2, 2], hand: [0, 0.1, 0.5], blade: [0, -0.4, 0.92], legN: [-56, 0, 74, 0, 0], legF: [42, 0, 14, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, rz: 0.1, pel: [22, -44, 0], head: [2, 2], hand: [0, -0.28, 0.32], blade: [0, -1, 0.1], legN: [-56, 0, 76, 0, 0], legF: [42, 0, 15, 0, 0] }),
    P({ w: 1, two: true, grip: 0.12, rz: 0.06, pel: [12, -36, 0], head: [2, 2], hand: [0, -0.22, 0.32], blade: [0, -0.55, 0.8], legN: [-44, 0, 56, 0, 0], legF: [34, 0, 16, 0, 0] }),
    P({ pel: [4, -10, 0], hand: [-0.22, 0.3, 0.3], blade: [0, 0.3, 1], far: [0.22, 0.2, 0.2], legN: [-12, 0, 14, 0, 0], legF: [10, 0, 14, 0, 0] })
  ],
  lunge2: [
    P({ two: true, rz: 0, py: -0.002, pel: [2, -51.9, -0.4], head: [-0.4, -0.9], hand: [-0.137, 0.211, 0.342], blade: [-0.273, 0.213, 0.987], grip: 0.119, legN: [-7, 0, 15, 0, 0], legF: [4, 0, 11, 0, 0], hy: -1.5 }) /* ref 0 */,
    P({ two: true, rz: 0, py: -0.004, pel: [4, -51.8, -0.4], head: [-0.3, -0.1], hand: [-0.13, 0.085, 0.374], blade: [-0.392, 0.458, 0.904], grip: 0.119, legN: [-9, 0, 18, 0, 0], legF: [5, 0, 12, 0, 0], hy: -1.0 }) /* ref 12 */,
    P({ two: true, rz: 0.02, py: -0.004, pel: [-6, -43.1, -0.4], head: [-2.0, -0.1], hand: [-0.071, 0.08, 0.373], blade: [-0.582, 0.447, 0.63], grip: 0.118, legN: [-20, 0, 26, 0, 0], legF: [10, 0, 20, 0, 0], hy: -0.8 }) /* ref 96 */,
    P({ two: true, rz: 0.1, py: -0.001, pel: [8, -28.8, -0.4], head: [-0.8, -0.6], hand: [-0.025, 0.141, 0.589], blade: [-0.448, 0.885, -0.055], grip: 0.119, legN: [-40, 0, 46, 0, 0], legF: [16, 0, 16, 0, 0], hy: -0.9 }) /* ref 108 */,
    P({ two: true, rz: 0.25, py: 0.009, pel: [10, -13.3, -0.3], head: [2.3, -2.1], hand: [0.017, 0.189, 0.574], blade: [-0.235, 0.997, -0.12], grip: 0.12, legN: [-58, 0, 62, 0, 0], legF: [20, 0, 12, 0, 0], hy: -0.0 }) /* ref 114 */,
    P({ two: true, rz: 0.42, py: 0.009, pel: [12, -5.7, -0.3], head: [4.0, -1.6], hand: [0.045, 0.095, 0.6], blade: [-0.266, 0.992, 0.197], grip: 0.12, legN: [-66, 0, 70, 0, 0], legF: [22, 0, 8, 0, 0], hy: 0.4 }) /* ref 120 */,
    P({ two: true, rz: 0.52, py: 0.02, pel: [14, 4.3, -0.1], head: [8.1, -1.5], hand: [-0.11, 0.072, 0.493], blade: [-0.591, 0.622, 0.723], grip: 0.121, legN: [-72, 0, 78, 0, 0], legF: [24, 0, 6, 0, 0], hy: -1.4 }) /* ref 126 */,
    P({ two: true, rz: 0.56, py: 0.02, pel: [14, 4.3, -0.1], head: [7.8, -1.5], hand: [-0.131, 0.099, 0.465], blade: [-0.588, 0.619, 0.645], grip: 0.121, legN: [-72, 0, 78, 0, 0], legF: [24, 0, 6, 0, 0], hy: -1.6 }) /* ref 132 */,
    P({ two: true, rz: 0.56, py: 0.02, pel: [14, 4.5, -0.1], head: [7.2, -1.5], hand: [-0.165, 0.169, 0.465], blade: [-0.647, 0.619, 0.575], grip: 0.122, legN: [-72, 0, 78, 0, 0], legF: [24, 0, 6, 0, 0], hy: -1.7 }) /* ref 144 */,
    P({ two: true, rz: 0.0, py: -0.002, pel: [2, -51.9, -0.4], head: [-0.4, -0.9], hand: [-0.137, 0.211, 0.342], blade: [-0.273, 0.213, 0.987], grip: 0.119, legN: [-7, 0, 15, 0, 0], legF: [4, 0, 11, 0, 0], hy: -1.5 }) /* ref recover */
  ],
  // Longsword Cut: diagonal from the FAR shoulder (hips turn the opposite way to the baseball swing)
  cut2: [
    P({ w: 1, two: true, pel: [-2, 24, 0], hand: [0, 0.4, 0.0], blade: [0, 0.74, -0.67], grip: 0.12, legN: [-60, 0, 72, 0, 0], legF: [40, 0, 22, 0, 0], hy: 14 }),
    P({ w: 1, two: true, rz: -0.04, pel: [-5, 32, 0], head: [0, -10], hand: [0, 0.5, -0.1], blade: [0, 0.74, -0.67], grip: 0.12, legN: [-61, 0, 74, 0, 0], legF: [41, 0, 23, 0, 0], hy: 24 }),
    P({ w: 1, two: true, rz: 0.0, pel: [0, 20, 0], head: [0, -6], hand: [0, 0.45, 0.1], blade: [0, 0.74, 0.67], grip: 0.12, legN: [-59, 0, 70, 0, 0], legF: [40, 0, 21, 0, 0], hy: 10 }),
    P({ w: 1, two: true, rz: 0.06, pel: [8, 2, 0], head: [0, 0], hand: [0, 0.25, 0.4], blade: [0, 0.2, 1], grip: 0.12, legN: [-57, 0, 66, 0, 0], legF: [38, 0, 19, 0, 0], hy: -4 }),
    P({ w: 1, two: true, rz: 0.12, pel: [14, -18, 0], head: [4, 8], hand: [0, -0.05, 0.5], blade: [0, -0.4, 1], grip: 0.12, legN: [-56, 0, 64, 0, 0], legF: [38, 0, 18, 0, 0], hy: -22 }),
    P({ w: 1, two: true, grip: 0.12, rz: 0.12, pel: [16, -24, 0], head: [6, 10], hand: [0, -0.28, 0.42], blade: [0, -0.5, 0.82], legN: [-54, 0, 60, 0, 0], legF: [36, 0, 18, 0, 0] }),
    P({ pel: [4, -10, 0], hand: [-0.22, 0.3, 0.3], blade: [0, 0.3, 1], far: [0.22, 0.2, 0.2], legN: [-12, 0, 14, 0, 0], legF: [10, 0, 14, 0, 0] })
  ],
  hit: [P({ py: -0.03, pel: [-16, 6, 4], head: [-14, 0], hand: [-0.3, 0.3, 0.1], blade: [0, 0.74, 0.67], legN: [-8, 0, 14, 0, 0], legF: [12, 0, 18, 0, 0] })],
  wounded: [
    P({ py: -0.2, pel: [30, 4, 0], head: [10, 0], hand: [-0.18, -0.05, 0.2], blade: [0.3, -0.3, 1], legN: [-62, 0, 74, 0, 0], legF: [30, 0, 92, 0, 0] }),
    P({ py: -0.21, pel: [32, 2, 0], head: [12, 0], hand: [-0.18, -0.06, 0.2], blade: [0.3, -0.3, 1], legN: [-62, 0, 76, 0, 0], legF: [30, 0, 94, 0, 0] })
  ]
};
function lerpP(a, b, t) {
  const o = {}; for (const k in a) {
    const x = a[k], y = b[k];
    if (Array.isArray(x)) o[k] = x.map((v, i) => v + (y[i] - v) * t); else if (typeof x === 'number') o[k] = x + (y - x) * t; else o[k] = t < 0.5 ? x : y;
  } return o;
}
function crP(k0, k1, k2, k3, t) {          // Catmull-Rom through numeric fields
  const o = {}; for (const k in k1) {
    const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    const x1 = k1[k];
    if (Array.isArray(x1)) o[k] = x1.map((_, i) => f(k0[k][i], k1[k][i], k2[k][i], k3[k][i])); else if (typeof x1 === 'number') o[k] = f(k0[k], k1[k], k2[k], k3[k]); else o[k] = t < 0.5 ? k1[k] : k2[k];
  } return o;
}

const KT = {
  chop1: { t: [0, 15, 19, 24, 28, 31, 33, 36, 42, 52, 62, 89], c: 36, lead: 25 }, lunge1: { t: [0, 23, 27, 30, 33, 36, 42, 50, 58, 68, 89], c: 36, lead: 29 }, cut1: { t: [0, 15, 23, 32, 34, 35, 36, 44, 56, 89], c: 36, lead: 26 },
  attack2: { t: [0, 8, 15, 21, 24, 26, 30, 35, 41, 52], c: 26 }, attack21: { t: [0, 16, 22, 27, 32, 34.5, 36, 40, 44, 48, 52, 89], c: 36, lead: 24 }, chop2: { t: [0, 7, 13, 17, 20, 23, 29, 36], c: 20 },
  lunge2: { t: [0, 10, 20, 28, 34, 40, 46, 52, 60, 72], c: 52 }, cut2: { t: [0, 6, 11, 14, 16, 19, 23], c: 16 } };
function sampleT(keys, times, tau) {
  const n = keys.length; tau = Math.max(times[0], Math.min(times[n - 1], tau));
  let i = 0; while (i < n - 2 && tau >= times[i + 1]) i++;
  const u = (tau - times[i]) / Math.max(1e-6, times[i + 1] - times[i]);
  const at = j => keys[Math.max(0, Math.min(n - 1, j))];
  return u < 1e-6 ? keys[i] : crP(at(i - 1), at(i), at(i + 1), at(i + 2), u);
}
function sample(keys, pos, loop) {
  const n = keys.length; if (!loop) pos = Math.max(0, Math.min(n - 1, pos));
  let i = Math.floor(pos), t = pos - i;
  const at = j => loop ? keys[((j % n) + n) % n] : keys[Math.max(0, Math.min(n - 1, j))];
  if (t < 1e-6) return at(i);
  return crP(at(i - 1), at(i), at(i + 1), at(i + 2), t);
}

/* ---------- apply a pose to a rig ---------- */
function applyPose(rig, p, aux) {
  const { pelvis, headG, near, far, legN, legF } = rig;
  aux = aux || {};
  pelvis.rotation.set(p.pel[0] * D2R, p.pel[1] * D2R, p.pel[2] * D2R);
  headG.rotation.set(p.head[0] * D2R, p.head[1] * D2R, 0);
  pelvis.position.y = 0.97 + p.py;
  for (const [lg, a] of [[legN, p.legN], [legF, p.legF]]) {
    lg.hg.position.y = 0.95 + p.py;
    lg.hg.rotation.set(a[0] * D2R, (a[4] + p.hy * 0.6) * D2R, lg.s * 0.045 + a[1] * D2R);
    lg.kg.rotation.set(a[2] * D2R, 0, 0);
    lg.ag.rotation.set(-(a[0] + a[2]) * D2R + a[3] * D2R, lg.s * 0.22, -lg.s * 0.045);
  }
  pelvis.updateMatrix(); near.sg.updateMatrix();
  // near (weapon) hand
  near._T = new V3(...p.hand); if (p.w) near._T = near.sg.position.clone().add(new V3(...p.hand).applyQuaternion(pelvis.quaternion.clone().invert()));
  armIK(near, near._T, new V3(...p.pole));
  const bladeDir = new V3(...p.blade); if (p.w) bladeDir.applyQuaternion(pelvis.quaternion.clone().invert());
  // the flat of the blade faces the camera, so the EDGE leads every cut (blades travel in the screen plane); the crossguard also reads in profile
  { const inv = pelvis.quaternion.clone().invert(), cam = new V3(1, 0, 0).applyQuaternion(inv), upW = new V3(0, 1, 0).applyQuaternion(inv);
    const d = Math.abs(bladeDir.clone().normalize().dot(cam)), sm = Math.max(0, Math.min(1, (d - 0.5) / 0.4)), s2 = sm * sm * (3 - 2 * sm);   // blade pointing at the camera: flat faces up, edge leads the sweep
    wristAim(near, bladeDir, cam.clone().multiplyScalar(1 - s2).addScaledVector(upW, s2), p.broll); }
  // far hand
  if (p.two) {
    const T = wristWorldToPelvis(near, -p.grip * 0.9 - 0.02); T.add(new V3(0.0, 0.0, 0));
    armIK(far, T, new V3(...p.fpole));
    far.wg.quaternion.copy(far._q.clone().invert().multiply(near._wq));
  } else {
    let farT = new V3(...p.far); if (p.fwOn > 0.5) farT = far.sg.position.clone().add(new V3(...p.farW).applyQuaternion(pelvis.quaternion.clone().invert()));
    armIK(far, farT, new V3(...p.fpole));
    far.wg.rotation.set(-0.05, 0, 0);
  }
  if (rig.shield) { rig.shield.visible = !p.two; }
  if (aux.rigRot) { rig.g.rotation.set(...aux.rigRot); }
  else rig.g.rotation.set(0, 0, 0);
  rig.g.position.set(0, 0, (aux.rigZ || 0) + (p.rz || 0));
}
function groundLock(rig, ys) {
  rig.g.position.y = 0; rig.g.updateMatrixWorld(true);
  let m = 1e9; const v = tmpV3;
  const pts = [[rig.legN.ag, 0.07], [rig.legF.ag, 0.07], [rig.headG, 0.14], [rig.pelvis, 0.12], [rig.near.wg, 0.05], [rig.far.wg, 0.05], [rig.near.eg, 0.06], [rig.far.eg, 0.06], [rig.legN.kg, 0.08], [rig.legF.kg, 0.08]];
  for (const [o, r] of pts) { o.getWorldPosition(v); m = Math.min(m, v.y - r); }
  rig.g.position.y = -m + (ys || 0);
}

/* ---------- combat states: block, parry, clash, stun, dash, jump, shoot ----------
   First-pass poses drafted in code; an animation of the same type made in the Animator (registerAnim) replaces each one.
   f.st = { kind, u }: u runs 0 to 1 for one-shot states (clash, parry, shoot, dash); for block it is seconds held. */
const STATE_POSE = {
  block:  P({ w: 1, py: -0.03, pel: [6, -22, 0], head: [2, 2], hand: [0.02, 0.46, 0.44], blade: [0, 0.62, 0.78], far: [0.34, 0.42, 0.5], legN: [-34, 0, 46, 0, 0], legF: [30, 0, 40, 0, 0] }),
  parry:  P({ w: 1, py: -0.02, pel: [12, -6, 0], head: [-2, 0], hand: [0.02, 0.7, 0.62], blade: [0, 0.35, 1], far: [0.34, 0.4, 0.5], legN: [-40, 0, 52, 0, 0], legF: [34, 0, 40, 0, 0] }),
  clash:  P({ w: 1, py: -0.035, pel: [-14, -26, 3], head: [-8, 0], hand: [-0.1, 0.55, 0.2], blade: [0, 0.8, 0.35], far: [0.3, 0.35, 0.3], legN: [-24, 0, 36, 0, 0], legF: [22, 0, 30, 0, 0] }),
  dash:   P({ w: 1, py: -0.09, pel: [24, -12, 0], head: [8, 0], hand: [-0.2, 0.18, 0.05], blade: [0, 0.05, 1], far: [0.2, 0.1, 0.1], legN: [-52, 0, 62, 0, 0], legF: [42, 0, 50, 0, 0] }),
  jump:   P({ w: 1, py: -0.05, pel: [10, -6, 0], head: [-6, 0], hand: [-0.05, 0.6, 0.3], blade: [0, 0.4, 0.8], far: [0.3, 0.55, 0.45], legN: [-62, 0, 78, 0, 0], legF: [30, 0, 70, 0, 0] }),
  shoot:  P({ w: 1, py: -0.01, pel: [6, -4, 0], head: [-2, 0], hand: [0, 0.55, 0.62], blade: [0, 0.3, 1], far: [0.1, 0.45, 0.58], legN: [-30, 0, 38, 0, 0], legF: [26, 0, 32, 0, 0] }),
};
const STATE_TWO = { two: true, grip: 0.12 };
const env = u => u < 0.25 ? u / 0.25 : Math.max(0, 1 - (u - 0.25) / 0.75);        // quick snap in, slower recovery
M3.statePose = function (f) {
  const st = f.st, two = f.two ? 2 : 1, k = st.kind, u = Math.max(0, Math.min(1, st.u || 0));
  if (k === 'stun') { const LS = CLOOP['stun' + two]; return LS ? loopSample(LS, f.t || 0) : sample(KEYS.wounded, ((f.t || 0) * 1.5) % 2, true); }
  const C = ONE[k + two];
  if (C) return sampleT(C.keys, C.T, u * C.len);                                  // an animation made in the Animator
  const L = CLOOP[k + two]; if (L) return loopSample(L, st.u || 0);
  let a = STATE_POSE[k]; if (!a) return null;
  if (f.two) a = Object.assign({}, a, STATE_TWO, { hand: [0, a.hand[1] - 0.2, a.hand[2] - 0.05] });
  const idle = f.two ? KEYS.idleTwo[0] : KEYS.idle1[0];
  if (k === 'block' || k === 'dash') return lerpP(idle, a, Math.min(1, (k === 'block' ? (st.u || 0) * 14 : u * 6) + 0.2));
  return lerpP(idle, a, env(u));
};

/* ---------- a pose for each game state ---------- */
M3.pose = function (role, f) {
  const rig = M3.getRig(role, f); if (!rig) return false;
  let p, aux = {}, free = false;
  const dt = 0.016;
  let gp = null;
  if (f.gx) {                                                        // the fighter doing the grabbing
    gp = M3.grabPoseP(f.gx, !!f.two);
    if (!gp && f.gx.kind !== 'grab' && f.gx.kind !== 'hold') f = Object.assign({}, f, { swing: { t: f.gx.u, dur: 1, hitAt: f.gx.hu || 0.5, extra: 0 }, style: GRAB_FALLBACK[f.gx.kind] || 'cut' });   // no custom move: borrow a standard swing
  }
  if (f.gv) {                                                        // the fighter being held, thrown or lying where it landed
    const x = M3.victimXf(f.gv, !!f.gv.two);
    p = KEYS.hit[0]; aux.rigRot = [x.rot, 0, 0]; aux.rigZ = x.rz || 0; aux.lift = x.lift; free = true;
  } else if (gp) { p = gp;
  } else if (f.dead) {
    const two = f.two ? 2 : 1, viol = !!f.dramatic, T = f.deathT || 0;
    const cd = ONE['dying' + two], cf = ONE['falling' + two], dD = cd ? cd.dur : 0, fD = cf ? cf.dur : DEAD_T(viol);
    const u = Math.min(1, Math.max(0, T - dD) / fD), e = u * u * (3 - 2 * u);
    const base = cd ? sampleT(cd.keys, cd.T, cd.len) : KEYS.hit[0];             // pose the fall starts from: the end of a custom dying, else the hit flinch
    if (cd && T < dD) p = sampleT(cd.keys, cd.T, T / dD * cd.len);
    else if (cf) p = sampleT(cf.keys, cf.T, u * cf.len);
    else p = lerpP(base, P({ py: -0.08, pel: [-40, 10, 0], head: [-30, 0], hand: [-0.5, 0.2, -0.2], blade: [0, -1, 0.4], far: [0.4, 0.1, -0.3], legN: [14, 0, 60, 0, 0], legF: [-8, 0, 50, 0, 0] }), e);
    aux.rigRot = [-(Math.PI / 2 - 0.12) * e, 0, 0]; aux.rigZ = 0.8 * e;
    free = true;
    if (viol) aux.lift = Math.sin(Math.min(1, u * 1.1) * Math.PI) * 0.5;
  } else if (f.st && !f.swing && (p = M3.statePose(f))) {
  } else if (f.swing) {
    const sw = f.swing, st = M3.moveKey(f.style, f.two);
    const keys = KEYS[st], cf = KT[st].c, n = keys.length;
    const t = sw.t, h = sw.hitAt, ex = sw.extra || 0; let pos;
    if (KT[st]) {
      const kt = KT[st], T = kt.t, end = T[T.length - 1]; let tau;
      if (t < h) tau = T[0] + (kt.c - T[0]) * Math.max(0, t / h);
      else if (t < h + ex) tau = kt.c;
      else tau = kt.c + (end - kt.c) * Math.min(1, (t - h - ex) / Math.max(0.05, sw.dur - h - ex));
      p = sampleT(keys, T, tau);
      if (kt.lead != null && tau < kt.lead) p = idleLead(f);   // idle stance holds, then the swing simply starts (no blend)
    } else {
    if (t < h) pos = cf * Math.max(0, t / h);
    else if (t < h + ex) pos = cf;
    else pos = cf + (n - 1 - cf) * Math.min(1, (t - h - ex) / Math.max(0.05, sw.dur - h - ex));
    p = sample(keys, pos, false);
    }
  } else if (f.hurt > 0 && f.hurtMax && ONE['hurt' + (f.two ? 2 : 1)] && (f.hurtMax - f.hurt) < ONE['hurt' + (f.two ? 2 : 1)].dur) {
    const h = ONE['hurt' + (f.two ? 2 : 1)], u = (f.hurtMax - f.hurt) / h.dur;     // damaged: plays from the moment of the hit
    p = sampleT(h.keys, h.T, u * h.len);
  } else if (f.flash > 0 && f.flashMax) {
    const u = 1 - f.flash / f.flashMax; p = lerpP(f.two ? KEYS.idleTwo[0] : KEYS.idle[0], KEYS.hit[0], Math.sin(Math.min(1, u) * Math.PI) * 0.9 + 0.1);
  } else if (f.woundedPose) {
    p = sample(KEYS.wounded, (f.t * 1.5) % 2, true);
  } else if (f.moving && CLOOP['walk' + (f.two ? 2 : 1)]) {
    const cw = CLOOP['walk' + (f.two ? 2 : 1)]; p = loopSample(cw, (f.walkT || 0) * 12 / (2 * Math.PI) * cw.period);
  } else if (f.moving) {
    // legs from the humantest run; the weapon hand rides forward
    HT.locomotion.wW = 0; HT.locomotion.wR = 1; HT.character.walk = 2; HT.locomotion.ph = (f.walkT || 0) * 12;
    const wp = HT.locomotion.ph; p = P({ hand: [f.two ? -0.14 : -0.2, (f.two ? 0.16 : 0.3) + 0.025 * Math.sin(wp * 2 - 0.6), (f.two ? 0.26 : 0.32) + 0.04 * Math.sin(wp - 0.4)], blade: [0, (f.two ? 0.55 : 0.2) + 0.18 * Math.sin(wp * 2 - 1.2), 1], far: [0.22, 0.12 + 0.03 * Math.sin(wp * 2), 0.14 - 0.1 * Math.sin(wp)], two: !!f.two, grip: 0.12 });
    applyRun(rig, p); groundLock(rig); return rig;
  } else {
    { const ci = CLOOP['idle' + (f.two ? 2 : 1)]; p = ci ? loopSample(ci, f.t || 0) : sample(f.two ? KEYS.idleTwo : KEYS.idle, (f.t * 0.8) % 4, true); }
  }
  M3.lastP = p;
  applyPose(rig, p, aux); groundLock(rig, aux.lift || 0);
  return rig;
};
/* ---- grabbing: the grabber's moves and where the victim hangs ----
   grab (reach, then held), throw, slam and strike are one-shot animations like attacks, each with a contact frame.
   Their keys may also carry the victim's place: vz forward of the grip (m), vy height (m), vr tilt (degrees). */
const GRAB_FALLBACK = { strike: 'lunge', slam: 'chop', throw: 'cut' };
const grabTau = (A, g) => { const c = A.c == null ? A.len * 0.5 : A.c, hu = g.hu || 0.5; return g.u < hu ? c * (g.u / hu) : c + (A.len - 1 - c) * Math.min(1, (g.u - hu) / Math.max(0.05, 1 - hu)); };
M3.grabPoseP = function (g, two) {
  const A = ONE[(g.kind === 'hold' ? 'grab' : g.kind) + (two ? 2 : 1)]; if (!A) return null;
  if (g.kind === 'grab') return sampleT(A.keys, A.T, g.u * (A.len - 1));
  if (g.kind === 'hold') return sampleT(A.keys, A.T, A.len - 1);
  return sampleT(A.keys, A.T, grabTau(A, g));
};
const lerp1 = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));
M3.victimDefault = function (kind, u, hu) {                         // fixed grip: the victim hangs from the hand, whatever the animation does
  hu = hu || 0.5;
  if (kind === 'throw') return u < hu ? { dz: lerp1(0, -0.2, u / hu), lift: lerp1(0.12, 0.6, u / hu), rot: lerp1(-0.2, -0.9, u / hu) } : { dz: -0.2, lift: 0.6, rot: -0.9 };
  if (kind === 'slam') return u < hu ? { dz: lerp1(0, -0.1, u / hu), lift: lerp1(0.12, 1.1, u / hu), rot: lerp1(-0.2, -0.7, u / hu) } : { dz: lerp1(-0.1, 0.2, (u - hu) / 0.3), lift: lerp1(1.1, 0, (u - hu) / 0.3), rot: lerp1(-0.7, -1.45, (u - hu) / 0.3) };
  if (kind === 'strike') return { dz: 0, lift: 0.12, rot: -0.2 - 0.25 * Math.sin(Math.PI * Math.max(0, Math.min(1, u))) };
  return { dz: 0, lift: 0.12, rot: -0.2 };                           // grab, hold
};
/* what to draw for a grab in progress. grabAtt: fields for the grabber's figure (or null); grabVic: fields plus an x shift (px) for the enemy
   that is held, flying or lying down (or null). Merge the result into each figure's draw object. */
function grabPhase(sim) {
  const p = sim.player, G = sim.cfg.grab, g = p.grab; if (!g) return null;
  const ph = g.phase, F = G[ph], u = F ? Math.min(1, g.t / F.dur) : (ph === 'reach' ? Math.min(1, g.t / g.dur) : 0);
  return { ph, u, hu: F ? F.hitAt / F.dur : 0.5, kind: ph === 'reach' ? 'grab' : ph, eId: g.eId };
}
M3.grabAtt = function (sim, two) { const q = grabPhase(sim); return q ? { gx: { kind: q.kind, u: q.u, hu: q.hu } } : null; };
M3.grabVic = function (sim, e, two) {
  const q = grabPhase(sim), p = sim.player;
  if (q && q.eId === e.id && e.held) { const gv = { kind: q.kind, u: q.u, hu: q.hu, two: !!two }, x = M3.victimXf(gv); return { fields: { gv }, dx: p.face * x.dz * PXU }; }
  if (e.fly) return { fields: { gv: { kind: 'fly', u: Math.min(1, (e.z || 0) / 40) } }, dx: 0 };
  if (e.down && e.stun > 0 && e.state === 'alive') return { fields: { gv: { kind: 'down', rise: Math.max(0, Math.min(1, 1 - e.stun / 0.4)) } }, dx: 0 };
  return null;
};
M3.victimXf = function (v) {                                         // v: { kind: grab|hold|throw|slam|strike|fly|down, u, hu, two, rise }
  const k = v.kind, two = v.two ? 2 : 1;
  if (k === 'fly') return { dz: 0, lift: 0, rot: -1.1 - 0.5 * Math.min(1, v.u || 0), rz: 0.5 };
  if (k === 'down') { const e = 1 - (v.rise || 0), ee = e * e * (3 - 2 * e); return { dz: 0, lift: 0, rot: -(Math.PI / 2 - 0.12) * ee, rz: 0.8 * ee }; }
  const d = M3.victimDefault(k, v.u, v.hu), A = ONE[(k === 'hold' ? 'grab' : k) + two];
  if (A && A.vm && A.V) {                                            // victim posed by hand in the Animator: interpolate its keys
    const tau = k === 'hold' ? A.len - 1 : k === 'grab' ? v.u * (A.len - 1) : grabTau(A, v), V = A.V, T = A.T;
    let i = 0; while (i < T.length - 2 && tau >= T[i + 1]) i++;
    const a = V[i] || d, b = V[Math.min(T.length - 1, i + 1)] || a, u = Math.max(0, Math.min(1, (tau - T[i]) / Math.max(1e-6, T[i + 1] - T[i])));
    return { dz: lerp1(a.dz, b.dz, u), lift: lerp1(a.lift, b.lift, u), rot: lerp1(a.rot, b.rot, u) };
  }
  return d;
};
function applyRun(rig, p) {
  // hx wrote the run onto Ri; we need it on this rig instead: run hx against the rig by swapping Ri
  HT.rig = rig; HT.poseRun(0.0001); HT.rig = null;
  const { pelvis, near, far } = rig;
  pelvis.updateMatrix();
  near._T = new V3(...p.hand); if (p.w) near._T = near.sg.position.clone().add(new V3(...p.hand).applyQuaternion(pelvis.quaternion.clone().invert())); armIK(near, near._T, new V3(-0.5, -1, -0.3)); wristAim(near, new V3(...p.blade));
  armIK(far, new V3(0.18, 0.12, 0.1), new V3(0.5, -1, -0.3)); far.wg.rotation.set(-0.05, 0, 0);
  if (rig.shield) rig.shield.visible = true;
  rig.g.rotation.set(0, 0, 0); rig.g.position.set(0, 0, 0);
}
/* which animation a style plays for a one- or two-handed fighter (the sim uses the same key to look up the blade path) */
M3.moveKey = function (style, two) {
  const sf = two ? '2' : '1';
  if (typeof style === 'string' && style.slice(0, 2) === 'c_') return (KT[style] && KT[style].two === !!two) ? style : 'cut' + sf;
  const st0 = style || 'cut';
  return KT[st0 + sf] ? st0 + sf : (KT[st0] ? st0 : 'cut' + sf);
};
/* bake a move's weapon path: hand and tip (metres; z forward, y up from the feet) at n+1 even steps of animation time,
   plus its hit window. Pure data, so the sim (and the server) can test real blade contact without a 3D rig. */
M3.bakeMove = function (key, f, n) {
  const kt = KT[key]; if (!kt) return null; n = n || 48;
  const rig = M3.getRig((f && f.role) || 'p', Object.assign({ tier: 'leather', two: !!kt.two || key.slice(-1) === '2' }, f || {}));
  const T = kt.t, t0 = T[0], end = T[T.length - 1], seg = [], hp = new V3(), tp = new V3();
  const lead = kt.lead != null ? idleLead({ two: rig.opts.two }) : null;
  for (let i = 0; i <= n; i++) {
    const tau = t0 + (end - t0) * i / n;
    const p = (lead && tau < kt.lead) ? lead : sampleT(KEYS[key], T, tau);
    applyPose(rig, p, {}); groundLock(rig, 0); rig.g.updateMatrixWorld(true);
    rig.near.wg.getWorldPosition(hp); tp.set(0, rig.sword._tipY, 0); rig.sword.localToWorld(tp);
    seg.push([+hp.z.toFixed(3), +hp.y.toFixed(3), +tp.z.toFixed(3), +tp.y.toFixed(3)]);
  }
  const hit = kt.hit || { shape: 'blade', w: 0.12, f0: Math.max(t0, kt.c - 2), f1: Math.min(end, kt.c + 3) };
  return { key, t0, c: kt.c, end, n, seg, hit };
};
M3.render = function (rig) {
  if (!rig) return null;
  if (visRig !== rig) { if (visRig) visRig.g.visible = false; rig.g.visible = true; visRig = rig; }
  HT.renderer.render(HT.scene, cam);
  return cvs;
};

/* ===== animator support: poses from a few readable parameters, joint lookup, and a library of custom animations ===== */
const ONE = {};                                                         // custom one-shot reactions by 'hurt1' 'dying2' 'falling1' ... : { keys, T, len, dur }
const DEAD_T = d => d ? 0.62 : 0.8;                                      // default fall time (violent, normal)
const dieDur = two => (ONE['dying' + (two ? 2 : 1)] || { dur: 0 }).dur;
M3.dieDur = dieDur;
const CLOOP = {};                                                       // custom idle / walk loops by 'idle1' 'idle2' 'walk1' 'walk2'
function loopSample(c, t) { const u = (((t / c.period) % 1) + 1) % 1; return sampleT(c.keys, c.T, u * c.len); }
function idleLead(f) { const ci = CLOOP['idle' + (f.two ? 2 : 1)]; return ci ? ci.keys[0] : (f.two ? KEYS.idleTwo[0] : KEYS.idle[0]); }
M3.buildPose = function (q, two) {
  const e = (q.ba || 0) * D2R, az = (q.bx || 0) * D2R;
  const o = { w: 1, rz: q.rz || 0, pel: [q.pp || 0, q.py == null ? -30 : q.py, 0], head: [q.hp || 0, q.hw || 0],
    hand: [0, q.hy || 0, q.hz || 0], blade: [Math.cos(e) * Math.sin(az), Math.sin(e), Math.cos(e) * Math.cos(az)], broll: q.br || 0,
    legN: [q.nh == null ? -50 : q.nh, 0, q.nk == null ? 60 : q.nk, 0, 0], legF: [q.fh == null ? 35 : q.fh, 0, q.fk == null ? 20 : q.fk, 0, 0] };
  if (two) { o.two = true; o.grip = 0.12; } else { o.fwOn = 1; o.farW = [q.fx == null ? 0.1 : q.fx, q.fy == null ? -0.05 : q.fy, q.fz == null ? 0.3 : q.fz]; }
  return P(o);
};
M3.paramsFromP = function (p) {
  const b = p.blade, o = { hy: p.hand[1], hz: p.hand[2], ba: Math.atan2(b[1], Math.hypot(b[0], b[2])) / D2R, bx: Math.atan2(b[0], b[2]) / D2R, br: p.broll || 0,
    pp: p.pel[0], py: p.pel[1], hp: p.head[0], hw: p.head[1], rz: p.rz || 0, nh: p.legN[0], nk: p.legN[2], fh: p.legF[0], fk: p.legF[2] };
  if (p.fwOn > 0.5) { o.fx = p.farW[0]; o.fy = p.farW[1]; o.fz = p.farW[2]; }
  return o;
};
M3.poseCustom = function (role, f, q) {
  const rig = M3.getRig(role, f); if (!rig) return null;
  const p = M3.buildPose(q, !!f.two); applyPose(rig, p, {}); groundLock(rig, 0); rig.g.updateMatrixWorld(true); return rig;
};
M3.joints = function (rig) {
  rig.g.updateMatrixWorld(true); const v = new V3();
  const sc = o => { o.getWorldPosition(v); return [M3.ox + v.z * PXU, M3.oy - v.y * PXU, v.x]; };
  return { hand: sc(rig.near.wg), shoulder: sc(rig.near.sg), pelvis: sc(rig.pelvis), head: sc(rig.headG), ankN: sc(rig.legN.ag), ankF: sc(rig.legF.ag),
    kneeN: sc(rig.legN.kg), kneeF: sc(rig.legF.kg), farHand: sc(rig.far.wg), farShoulder: sc(rig.far.sg), tipLen: Math.abs(rig.sword._tipY) + 0.02 };
};
M3.clearCustom = function () { for (const k of Object.keys(KT)) if (k.slice(0, 2) === 'c_' || k.slice(0, 6) === 'custom') { delete KT[k]; delete KEYS[k]; } for (const k of Object.keys(CLOOP)) delete CLOOP[k]; for (const k of Object.keys(ONE)) delete ONE[k]; };
/* def = { id, type: attack|idle|walk|hurt|dying|falling, two, contact, loop (seconds), len (frames in a loop), end, keys:[{ f, ...params }] } */
M3.registerAnim = function (def) {
  const ks = (def.keys || []).slice().sort((a, b) => a.f - b.f); if (!ks.length) return false;
  const two = !!def.two, typ = def.type || 'attack', keys = [], T = [];
  const add = (k, t) => { if (T.length && t <= T[T.length - 1]) return; keys.push(M3.buildPose(k, two)); T.push(t); };
  if (typ === 'attack') {
    const END = def.end || 89;
    if (ks[0].f > 0) add(ks[0], 0);
    for (const k of ks) add(k, k.f);
    if (T[T.length - 1] < END) add(ks[ks.length - 1], END);
    if (keys.length < 2) { keys.push(keys[0]); T.push(END); }
    const id = 'c_' + (def.id || 'x');
    KEYS[id] = keys; KT[id] = { t: T, c: Math.max(1, Math.min(END - 1, def.contact || 36)), lead: ks[0].f > 0 ? ks[0].f : null, two: two, hit: def.hit || null };
  } else if (typ === 'grab' || typ === 'throw' || typ === 'slam' || typ === 'strike') {
    const L = def.len || 90, V = [];
    const add2 = (k, t) => { if (T.length && t <= T[T.length - 1]) return; keys.push(M3.buildPose(k, two)); T.push(t); V.push(k.vz == null ? null : { dz: k.vz, lift: k.vy || 0, rot: (k.vr || 0) * D2R }); };
    if (ks[0].f > 0) add2(ks[0], 0);
    for (const k of ks) add2(k, k.f);
    if (T[T.length - 1] < L - 1) add2(ks[ks.length - 1], L - 1);
    if (keys.length < 2) { keys.push(keys[0]); T.push(L - 1); V.push(V[0]); }
    ONE[typ + (two ? 2 : 1)] = { keys, T, len: L, c: typ === 'grab' ? null : Math.max(1, Math.min(L - 2, def.contact || Math.round(L * 0.4))), V, vm: !!def.vm && V.some(Boolean), dur: 0.5 };
  } else if (typ === 'hurt' || typ === 'dying' || typ === 'falling' || typ === 'clash' || typ === 'parry' || typ === 'dash' || typ === 'jump' || typ === 'shoot') {
    const L = def.len || 60;
    for (const k of ks) add(k, k.f);
    if (T[0] > 0) { keys.unshift(M3.buildPose(ks[0], two)); T.unshift(0); }
    if (T[T.length - 1] < L) { keys.push(typ === 'hurt' || typ === 'clash' || typ === 'parry' || typ === 'shoot' ? M3.buildPose(ks[0], two) : keys[keys.length - 1]); T.push(L); }   // a flinch returns to its first pose; a death holds its last
    if (keys.length < 2) { keys.push(keys[0]); T.push(L); }
    ONE[typ + (two ? 2 : 1)] = { keys, T, len: L, dur: def.loop || ({ hurt: 0.3, dying: 0.35, falling: 0.5, clash: 0.34, parry: 0.3, dash: 0.22, jump: 0.6, shoot: 0.25 })[typ] };
  } else {
    const L = def.len || 60;
    for (const k of ks) add(k, k.f);
    if (T[0] > 0) { keys.unshift(M3.buildPose(ks[0], two)); T.unshift(0); }
    keys.push(M3.buildPose(ks[0], two)); T.push(L);
    CLOOP[typ + (two ? 2 : 1)] = { keys, T, len: L, period: def.loop || (typ === 'idle' ? 3 : 0.55) };
  }
  return true;
};
M3.registerCustom = function (def) { return M3.registerAnim({ id: 'legacy', type: 'attack', two: def.two, contact: def.contact, end: def.end, keys: def.keys }); };
M3.textureCanvases = function () { const o = {}; for (const k in MAT) { const u = MAT[k].uniforms && MAT[k].uniforms.map, im = u && u.value && u.value.image; if (im && im.toDataURL) o[k] = im; } return o; };   // every armor texture built so far, by material name
M3.ready = true;
M3.debug = { KEYS, P, applyPose, groundLock, sample, wr: HT.renderer, cam, ln: HT.scene };

export default M3;
