/* ============================================================
   PROJECT WAR · CAMP AND RUN UI  (browser only)
   The walkable camp, its stations and menus, the wave HUD and the exit vote. Everything it shows comes from game/run.js.
   Windows follow the old Final Fantasy look: blue gradient, white frame. Placeholders everywhere; art comes later.
   ============================================================ */
import { CFG, applyCmd } from './sim.js';
import * as R from './run.js';

const KEY = 'pw.run.profile';
const STATIONS = [                                        // where things are in camp (sim x); the dummy stands at 120
  { id: 'stats', x: 215, name: 'Trainer', hint: 'spend attribute points' },
  { id: 'shop', x: 300, name: 'Smith', hint: 'weapons, armor, upgrades, skills' },
  { id: 'style', x: 385, name: 'Style', hint: 'equip learned skills' },
  { id: 'hire', x: 470, name: 'Hire board', hint: 'hire fighters' },
  { id: 'cart', x: 572, name: 'Cart', hint: 'pick a map and depart' },
];
const NEAR = 40;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function initRunUI(env) {
  const { $, live, FONT } = env;
  let profile = null;
  try { profile = R.fromJSON(localStorage.getItem(KEY) || ''); } catch (e) { }
  if (!profile) profile = R.newProfile('Baron');
  const run = new R.Run(live, profile, (Date.now() >>> 0) || 1);
  const save = () => { try { localStorage.setItem(KEY, R.toJSON(profile)); } catch (e) { } };
  const ui = { active: false, modal: null, run, profile };

  /* ---------- the overlay: menus are plain HTML over the stage ---------- */
  const host = $('stage').parentElement, ov = document.createElement('div'); ov.id = 'runui'; ov.hidden = true; host.appendChild(ov);
  let note = '';
  const close = () => { ui.modal = null; ov.innerHTML = ''; env.focusStage(); };
  const open = id => { ui.modal = id; env.clearKeys(); render(); };
  const bar = (v, max, cls) => '<i class="bar ' + (cls || '') + '"><b style="width:' + Math.max(0, Math.min(100, 100 * v / (max || 1))) + '%"></b></i>';
  const goldLine = () => '<div class="gold">' + profile.gold + ' G</div>';
  const head = (title, extra) => '<div class="rhead"><span>' + title + '</span>' + (extra || '') + '<button class="rb x" data-a="close" title="Close (Esc)">x</button></div>';
  const msg = () => note ? '<div class="note">' + esc(note) + '</div>' : '';

  function statsPanel() {
    const d = R.derive(profile), need = R.xpNeed(profile.level);
    let rows = '';
    for (const a of R.ATTRS) {
      const info = R.ATTR_INFO[a], v = R.attr(profile, a), g = profile.grown[a] || 0, dim = a === 'int' || a === 'wis' || a === 'san';
      rows += '<div class="arow' + (dim ? ' dim' : '') + '"><b>' + info.n + '</b><span class="v">' + v + (g ? ' <small>(+' + g + ' from use)</small>' : '') + '</span><span class="d">' + esc(info.d) + '</span>' +
        '<button class="rb" data-a="spend:' + a + '"' + (profile.points > 0 ? '' : ' disabled') + '>+</button></div>';
    }
    return head('Trainer', goldLine()) +
      '<div class="lvl">Level <b>' + profile.level + '</b> &nbsp; XP ' + profile.xp + ' / ' + need + bar(profile.xp, need, 'xp') + '</div>' +
      '<div class="pts">Points to spend: <b>' + profile.points + '</b></div>' + rows +
      '<div class="sum">HP ' + d.maxHp + ' · Stamina ' + d.staminaMax + ' · Damage x' + d.dmgMult.toFixed(2) + ' · Speed x' + d.spdMult.toFixed(2) + ' · Hire slots ' + d.hireCap + '</div>' +
      msg() + '<div class="foot"><button class="rb warn" data-a="reset">Delete save</button></div>';
  }
  function shopPanel() {
    const p = profile; let h = head('Smith', goldLine());
    h += '<div class="sec">Weapons</div>';
    for (const k of Object.keys(R.WEAPON_PRICE)) {
      const own = p.owned.weapons.includes(k), lab = CFG.weapons[k].label;
      h += '<div class="srow"><span>' + esc(lab) + '</span><span class="d">dmg ' + CFG.weaponClasses[CFG.weapons[k].cls].dmg + ', reach ' + CFG.weaponClasses[CFG.weapons[k].cls].reach + '</span>' +
        (own ? '<button class="rb" data-a="equip:weapon:' + k + '"' + (p.weapon === k ? ' disabled>Equipped' : '>Equip') + '</button>' : '<button class="rb" data-a="buy:weapon:' + k + '">Buy ' + R.WEAPON_PRICE[k] + ' G</button>') + '</div>';
    }
    h += '<div class="sec">Armor</div>';
    for (const k of Object.keys(R.ARMOR_PRICE)) {
      const own = p.owned.armor.includes(k), t = CFG.tiers[k];
      h += '<div class="srow"><span>' + esc(t.label) + '</span><span class="d">' + Math.round(t.pct * 100) + '% off, durability ' + t.dur + '</span>' +
        (own ? '<button class="rb" data-a="equip:armor:' + k + '"' + (p.armor === k ? ' disabled>Worn' : '>Wear') + '</button>' : '<button class="rb" data-a="buy:armor:' + k + '">Buy ' + R.ARMOR_PRICE[k] + ' G</button>') + '</div>';
    }
    h += '<div class="sec">Upgrades (permanent)</div>';
    for (const k of Object.keys(R.UPGRADES)) {
      const u = R.UPGRADES[k], n = p.upgrades[k];
      h += '<div class="srow"><span>' + u.n + ' <small>rank ' + n + '/' + u.max + '</small></span><span class="d">' + u.d + '</span><button class="rb" data-a="buy:upgrade:' + k + '"' + (n >= u.max ? ' disabled>Max' : '>' + R.upgradePrice(p, k) + ' G') + '</button></div>';
    }
    h += '<div class="sec">Skills</div>';
    for (const k of Object.keys(R.SKILLS)) {
      const s = R.SKILLS[k], own = p.owned.skills.includes(k);
      h += '<div class="srow"><span>' + s.n + '</span><span class="d">' + esc(s.d) + '</span>' + (own ? '<button class="rb" disabled>Learned</button>' : '<button class="rb" data-a="buy:skill:' + k + '">Learn ' + s.price + ' G</button>') + '</div>';
    }
    return h + msg();
  }
  function stylePanel() {
    const p = profile, d = R.derive(p); let h = head('Style');
    h += '<div class="pts">Skill slots: <b>' + p.skills.length + ' / ' + d.skillSlots + '</b> <small>(more from the Smith)</small></div>';
    for (const k of Object.keys(R.SKILLS)) {
      const s = R.SKILLS[k], own = p.owned.skills.includes(k), on = p.skills.includes(k);
      h += '<div class="srow' + (own ? '' : ' dim') + '"><span>' + s.n + '</span><span class="d">' + esc(s.d) + '</span>' + (own ? '<button class="rb" data-a="skill:' + k + '">' + (on ? 'Equipped' : 'Equip') + '</button>' : '<span class="d">not learned</span>') + '</div>';
    }
    h += '<p class="d">Attack animations come from the Animator library. Traits are not built yet.</p>';
    return h + msg();
  }
  function hirePanel() {
    const p = profile, d = R.derive(p); let h = head('Hire board', goldLine());
    h += '<div class="pts">Your fighters: <b>' + p.hirelings.length + ' / ' + d.hireCap + '</b> <small>(LDR opens slots, up to ' + R.RUNCFG.maxHirelings + ')</small></div>';
    for (const x of p.hirelings) h += '<div class="srow"><span>' + esc(x.name) + ' <small>Lv ' + x.level + '</small></span><span class="d">' + esc(CFG.weapons[x.weapon].label) + ', ' + esc(CFG.tiers[x.tier].label) + ', HP ' + x.hp + '</span><button class="rb" data-a="dismiss:' + x.hid + '">Dismiss</button></div>';
    h += '<div class="sec">For hire</div>';
    for (const r of R.recruits(p, run.seed)) {
      const hired = p.hirelings.some(x => x.name === r.name && x.weapon === r.weapon && x.tier === r.tier);
      h += '<div class="srow"><span>' + esc(r.name) + '</span><span class="d">' + esc(CFG.weapons[r.weapon].label) + ', ' + esc(CFG.tiers[r.tier].label) + ', HP ' + r.hp + '</span>' + (hired ? '<button class="rb" disabled>Hired</button>' : '<button class="rb" data-a="hire:' + r.rid + '">Hire ' + r.fee + ' G</button>') + '</div>';
    }
    return h + '<p class="d">Hirelings keep fighting for you for good. Fallen ones are back next wave, no penalty.</p>' + msg();
  }
  function cartPanel() {
    const p = profile; let h = head('The cart');
    h += '<div class="sec">Choose a map</div>';
    for (const k of Object.keys(R.MAPS)) h += '<div class="map"><b>' + esc(R.MAPS[k].n) + '</b><span class="d">' + esc(R.MAPS[k].d) + '</span><span class="d">Best: wave ' + p.best + '</span><button class="rb go" data-a="depart:' + k + '">Depart</button></div>';
    h += '<p class="d">Waves grow. Every 5 waves you may leave and keep the gold, with a bonus the deeper you go. If you fall, the gold from this run is lost. Gear, levels and skills stay.</p>';
    h += '<div class="sum">Party: you' + p.hirelings.map(x => ', ' + esc(x.name)).join('') + '</div>';
    return h;
  }
  function votePanel() {
    return '<div class="rhead"><span>Wave ' + run.wave + ' cleared</span></div><div class="big">Leave with <b>' + run.leavePay() + ' G</b>?</div>' +
      '<p class="d">That is ' + run.gold + ' gold earned' + (R.stageOf(run.wave) > 1 ? ', plus a deep-run bonus' : '') + '. Press on and the next stage pays more, but falling loses it all.</p>' +
      '<div class="btnrow"><button class="rb go" data-a="vote:leave">Leave</button><button class="rb" data-a="vote:stay">Press on</button></div>';
  }
  function resultPanel() {
    const r = run.result; if (!r) return '';
    return '<div class="rhead"><span>' + (r.kind === 'dead' ? 'You fell' : 'Back from the field') + '</span></div>' +
      '<div class="big">Wave ' + r.wave + '</div><div class="sum">Kills ' + r.kills + ' · XP ' + r.xp + (r.levels ? ' · Levels +' + r.levels : '') + '</div>' +
      (r.kind === 'dead' ? '<div class="big bad">Lost ' + r.lost + ' G</div><p class="d">Gold from this run is gone. Gear, levels, skills and hirelings are safe.</p>' : '<div class="big">+' + r.gold + ' G</div>') +
      '<div class="btnrow"><button class="rb go" data-a="camp">Return to camp</button></div>';
  }
  const PANELS = { stats: statsPanel, shop: shopPanel, style: stylePanel, hire: hirePanel, cart: cartPanel, vote: votePanel, result: resultPanel };
  function render() {
    if (!ui.modal) { ov.innerHTML = ''; return; }
    ov.innerHTML = '<div class="rback"><div class="ff rpanel p-' + ui.modal + '">' + PANELS[ui.modal]() + '</div></div>';
  }
  const rebuild = () => { env.clearKeys(); run.applyBuild(false); applyCmd(live, { t: 'set', inv: true }); const t = $('ptier'); if (t && [...t.options].some(o => o.value === profile.armor)) t.value = profile.armor; env.readLook(); save(); };

  ov.addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]'); if (!b || b.disabled) return;
    const [a, x, y] = b.dataset.a.split(':'); note = '';
    if (a === 'close') { close(); return; }
    if (a === 'spend') { R.spendPoint(profile, x); rebuild(); }
    else if (a === 'buy') { const r = R.buy(profile, x, y); note = r.ok ? '' : r.why; if (r.ok) { if (x === 'weapon') R.equipWeapon(profile, y); if (x === 'armor') R.equipArmor(profile, y); rebuild(); } }
    else if (a === 'equip') { x === 'weapon' ? R.equipWeapon(profile, y) : R.equipArmor(profile, y); rebuild(); }
    else if (a === 'skill') { const r = R.toggleSkill(profile, x); note = r.ok ? '' : r.why; rebuild(); }
    else if (a === 'hire') { const r = R.hire(profile, R.recruits(profile, run.seed)[+x]); note = r.ok ? '' : r.why; save(); }
    else if (a === 'dismiss') { R.dismiss(profile, +x); save(); }
    else if (a === 'reset') { if (!ui.confirmReset) { ui.confirmReset = true; note = 'Press Delete save again to wipe your progress.'; render(); return; } ui.confirmReset = false; localStorage.removeItem(KEY); Object.assign(profile, R.newProfile('Baron')); run.enterCamp(); rebuild(); note = 'Save deleted.'; }
    else if (a === 'depart') { close(); save(); run.depart(x); env.readLook(); return; }
    else if (a === 'vote') { run.vote(x === 'leave'); if (x === 'leave') { save(); open('result'); } else close(); return; }
    else if (a === 'camp') { run.returnToCamp(); rebuild(); close(); return; }
    ui.confirmReset = a === 'reset' ? ui.confirmReset : false;
    render();
  });

  /* ---------- mode control ---------- */
  ui.enter = () => {
    ui.active = true; ov.hidden = false; env.stopRec(); env.clearKeys();
    run.enterCamp(); rebuild(); close();
  };
  ui.leave = () => {
    ui.active = false; ov.hidden = true; ui.modal = null; ov.innerHTML = '';
    live.mode = 'arena'; live.clearEnemies(); live.clearAllies(); live.proj = []; live.feed = []; env.clearKeys(); env.afterLeave();
  };
  let wasPhase = 'camp';
  ui.update = dt => {
    run.update(dt);
    if (run.phase !== wasPhase) {                                    // the run changed phase: open what the player needs to answer
      if (run.phase === 'vote') open('vote'); else if (run.phase === 'dead') { save(); open('result'); } else if (run.phase === 'camp' && wasPhase !== 'camp') save();
      wasPhase = run.phase;
    }
  };
  const near = () => { if (run.phase !== 'camp') return null; const x = live.player.x; return STATIONS.find(s => Math.abs(s.x - x) <= NEAR) || null; };
  ui.key = (code, act) => {                                          // true when the key was used here
    if (!ui.active) return false;
    if (ui.modal) { if (code === 'Escape' && ui.modal !== 'vote' && ui.modal !== 'result') close(); return true; }
    if (act === 'use' && run.phase === 'camp') { const s = near(); if (s) open(s.id); return true; }
    return false;
  };

  /* ---------- drawing: world dressing and the HUD, on the 640x360 stage ---------- */
  const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
  function win(c, x, y, w, h) {
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#3550d0'); g.addColorStop(1, '#0a1260');
    c.fillStyle = '#04062a'; rr(c, x - 1, y - 1, w + 2, h + 2, 5); c.fill();
    c.fillStyle = g; rr(c, x, y, w, h, 4); c.fill();
    c.strokeStyle = '#f2f4ff'; c.lineWidth = 2; rr(c, x + 1, y + 1, w - 2, h - 2, 4); c.stroke();
    c.strokeStyle = 'rgba(120,140,235,.8)'; c.lineWidth = 1; rr(c, x + 3.5, y + 3.5, w - 7, h - 7, 2); c.stroke();
  }
  function txt(c, s, x, y, col, size, align) {
    c.font = (size || 10) + 'px ' + FONT; c.textAlign = align || 'left'; c.fillStyle = '#000'; c.fillText(s, x + 1, y + 1); c.fillStyle = col || '#fff'; c.fillText(s, x, y);
  }
  function gauge(c, x, y, w, h, v, max, col) {
    c.fillStyle = '#04062a'; c.fillRect(x, y, w, h); c.fillStyle = col; c.fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * Math.min(1, v / (max || 1)))), h - 2);
  }
  const hpCol = f => f > 0.5 ? '#7be07b' : f > 0.25 ? '#f0d14a' : '#f06a5a';

  ui.drawBack = c => {                                               // camp props behind the fighters
    if (!ui.active || run.phase !== 'camp') return;
    c.save();
    const base = 262;
    // a campfire and tents in the back, then each station
    c.fillStyle = '#3a2a2f'; [[40, 58], [160, 62], [430, 56], [520, 60]].forEach(([x, w]) => { c.beginPath(); c.moveTo(x, base - 6); c.lineTo(x + w / 2, base - 52); c.lineTo(x + w, base - 6); c.closePath(); c.fill(); });
    c.fillStyle = '#5a3a3a'; [[40, 58], [430, 56]].forEach(([x, w]) => { c.beginPath(); c.moveTo(x + w / 2, base - 52); c.lineTo(x + w / 2 - 6, base - 6); c.lineTo(x + w / 2 + 6, base - 6); c.closePath(); c.fill(); });
    const t = live.t, fl = 4 + Math.sin(t * 9) * 1.5;
    c.fillStyle = '#4a3a30'; c.fillRect(322, base - 5, 22, 4); c.fillStyle = '#f08a3a'; c.beginPath(); c.moveTo(326, base - 5); c.lineTo(333, base - 14 - fl); c.lineTo(340, base - 5); c.fill(); c.fillStyle = '#ffd86a'; c.beginPath(); c.moveTo(329, base - 5); c.lineTo(333, base - 10 - fl * 0.5); c.lineTo(337, base - 5); c.fill();
    const prop = (s) => {
      const x = s.x, nearIt = Math.abs(x - live.player.x) <= NEAR;
      c.save(); c.translate(x, base);
      if (s.id === 'stats') { c.fillStyle = '#6a4b3a'; c.fillRect(-14, -30, 28, 30); c.fillStyle = '#8a6a4a'; c.fillRect(-16, -34, 32, 6); c.fillStyle = '#e8d8b0'; c.fillRect(-9, -24, 18, 12); }            // a banner stand with a board
      else if (s.id === 'shop') { c.fillStyle = '#5a4a42'; c.fillRect(-18, -22, 36, 22); c.fillStyle = '#c24a3a'; c.fillRect(-20, -32, 40, 10); c.fillStyle = '#9aa4b0'; c.fillRect(-10, -30, 3, 12); c.fillRect(2, -29, 8, 3); }  // a stall with an awning
      else if (s.id === 'style') { c.fillStyle = '#4a5a8a'; c.fillRect(-12, -26, 24, 26); c.fillStyle = '#e8d8b0'; c.fillRect(-7, -22, 14, 10); c.fillStyle = '#c2413b'; c.fillRect(-2, -36, 4, 12); }                              // a rack
      else if (s.id === 'hire') { c.fillStyle = '#6a4b3a'; c.fillRect(-16, -30, 32, 24); c.fillStyle = '#e8d8b0'; c.fillRect(-12, -26, 10, 8); c.fillRect(2, -26, 10, 8); c.fillRect(-12, -16, 24, 6); c.fillStyle = '#4a3a30'; c.fillRect(-18, -6, 4, 6); c.fillRect(14, -6, 4, 6); }   // a notice board
      else { c.fillStyle = '#7a5a3a'; c.fillRect(-26, -22, 52, 14); c.fillStyle = '#5a3a2a'; c.fillRect(-22, -34, 30, 12); c.fillStyle = '#e8e4d8'; c.fillRect(-20, -34, 26, 3);
        c.fillStyle = '#2a2018'; c.beginPath(); c.arc(-16, -6, 7, 0, 7); c.arc(16, -6, 7, 0, 7); c.fill(); c.fillStyle = '#8a6a45'; c.beginPath(); c.arc(-16, -6, 3, 0, 7); c.arc(16, -6, 3, 0, 7); c.fill(); }   // the cart
      c.restore();
      if (nearIt) { c.strokeStyle = 'rgba(255,240,160,.9)'; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.beginPath(); c.ellipse(x, base + 4, 30, 7, 0, 0, 7); c.stroke(); c.setLineDash([]); }
      c.font = '9px ' + FONT; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#14101c'; c.strokeText(s.name, x, base - 40); c.fillStyle = nearIt ? '#ffe27a' : '#e8e0d0'; c.fillText(s.name, x, base - 40);
    };
    STATIONS.forEach(prop);
    c.font = '9px ' + FONT; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#14101c'; c.strokeText('Practice dummy', 120, 236); c.fillStyle = '#e8e0d0'; c.fillText('Practice dummy', 120, 236);
    c.restore();
  };

  ui.drawFront = c => {
    if (!ui.active) return;
    const p = live.player, W = CFG.W, H = CFG.H;
    c.save();
    if (run.phase === 'camp') {
      const need = R.xpNeed(profile.level);
      win(c, 6, 6, 152, 50); txt(c, profile.name, 14, 21, '#fff', 11); txt(c, 'Lv ' + profile.level, 150, 21, '#ffe27a', 11, 'right');
      txt(c, 'XP', 14, 34, '#bcd', 8); gauge(c, 28, 28, 120, 6, profile.xp, need, '#6fb0ff'); txt(c, profile.gold + ' G', 14, 49, '#ffe27a', 10); if (profile.points) txt(c, profile.points + ' pts', 150, 49, '#9fe39f', 9, 'right');
      const s = near();
      win(c, 120, H - 40, 400, 32);
      if (s) { txt(c, 'T', 134, H - 20, '#ffe27a', 12); txt(c, s.name + ': ' + s.hint, 152, H - 20, '#fff', 10); }
      else txt(c, 'W A S D walk · Walk up to a sign and press T · The cart starts a run', W / 2, H - 20, '#cfe', 9, 'center');
    } else {
      // party window (bottom left): you and your hirelings
      const rows = [{ n: profile.name, hp: p.hp, max: p.maxHp, st: p.stamina, smax: p.staminaMax, lv: profile.level }].concat(live.allies.map(a => ({ n: a.name.split(' ')[0], hp: a.hp, max: a.maxHp, ally: true })));
      const rh = 24, hh = 10 + rows.length * rh; win(c, 6, H - hh - 6, 218, hh);
      rows.forEach((r, i) => {
        const y = H - hh - 6 + 8 + i * rh;
        txt(c, r.n, 14, y + 8, r.hp > 0 ? '#fff' : '#f08a7a', 9); if (r.lv) txt(c, 'Lv ' + r.lv, 62, y + 8, '#ffe27a', 8);
        txt(c, 'HP', 96, y + 8, '#bcd', 8); txt(c, Math.max(0, Math.ceil(r.hp)) + '/' + r.max, 216, y + 8, hpCol(r.hp / r.max), 9, 'right');
        gauge(c, 14, y + 11, 202, 5, r.hp, r.max, hpCol(r.hp / r.max)); if (!r.ally) gauge(c, 14, y + 17, 202, 3, r.st, r.smax, p.stunT > 0 ? '#f06a5a' : '#e8c24a');
      });
      // top left: the wave
      win(c, 6, 6, 128, 40); txt(c, 'WAVE ' + run.wave, 14, 22, '#fff', 12);
      const left = run.queue.length + run.alive(); txt(c, left + ' left', 14, 38, '#bcd', 9);
      // top right: gold and style rank
      win(c, W - 150, 6, 144, 50); txt(c, run.gold + ' G', W - 14, 22, '#ffe27a', 12, 'right');
      const rk = R.RUNCFG.rank, tier = run.tier, lo = rk.at[tier], hi = rk.at[tier + 1] != null ? rk.at[tier + 1] : 100;
      txt(c, 'STYLE', W - 142, 40, '#bcd', 8); gauge(c, W - 110, 34, 70, 6, run.rank.score - lo, hi - lo, '#e8c24a');
      txt(c, run.rankName, W - 14, 46, tier >= 3 ? '#ffe27a' : '#fff', 16, 'right');
      // banner and recent messages
      if (run.banner && live.t - run.banner.at < 1.8) { const u = (live.t - run.banner.at) / 1.8; c.globalAlpha = u < 0.15 ? u / 0.15 : u > 0.75 ? (1 - u) / 0.25 : 1; c.font = '26px ' + FONT; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = '#04062a'; c.strokeText(run.banner.text, W / 2, 110); c.fillStyle = '#fff'; c.fillText(run.banner.text, W / 2, 110); c.globalAlpha = 1; }
      let my = 66; for (const m of run.msgs.slice(-3)) { const age = live.t - m.t; if (age < 5) { c.globalAlpha = age > 4 ? 5 - age : 1; txt(c, m.text, W - 14, my, '#dfe8ff', 9, 'right'); my += 12; } } c.globalAlpha = 1;
    }
    c.restore();
  };
  return ui;
}
