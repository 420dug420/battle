/* ============================================================
   PROJECT WAR · CAMP AND RUN UI  (browser only)
   The walkable camp, its stations and menus, the wave HUD and the exit vote. Everything it shows comes from game/run.js.
   Windows follow the old Final Fantasy look: blue gradient, white frame. Placeholders everywhere; art comes later.
   ============================================================ */
import { CFG, applyCmd } from './sim.js';
import * as R from './run.js';
import { makeCampBg, drawCampLive, drawStation } from './camp.js';

const KEY = 'pw.run.profile';
const STATIONS = [                                        // where things are in camp (sim x); the dummy stands at 120
  { id: 'stats', x: 200, name: 'Trainer', hint: 'spend attribute points' },
  { id: 'shop', x: 275, name: 'Smith', hint: 'weapons, armor, upgrades, skills' },
  { id: 'style', x: 400, name: 'Style', hint: 'attack styles, combo chain, skills' },
  { id: 'hire', x: 478, name: 'Hire board', hint: 'hire fighters' },
  { id: 'cart', x: 570, name: 'Cart', hint: 'pick a map and depart' },
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
  const ui = { active: false, modal: null, run, profile, R, styles: () => env.styles() };

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
    const p = profile, d = R.derive(p), all = env.styles(), hands = env.hands(), nm = id => (all.find(x => x.id === id) || { name: id }).name;
    let h = head('Style', goldLine());
    const opt = (cur, none) => '<option value="">' + none + '</option>' + all.filter(x => p.styles.owned.includes(x.id)).map(x => '<option value="' + x.id + '"' + (x.id === cur ? ' selected' : '') + (R.styleFits(x, hands) ? '' : ' disabled') + '>' + esc(x.name) + (x.hands ? (x.hands === 2 ? ' (2H)' : ' (1H)') : '') + '</option>').join('');
    h += '<div class="sec">Combo chain <small>(left click plays these in order)</small></div>';
    for (let i = 0; i < d.chainSlots; i++) h += '<div class="srow"><span>Hit ' + (i + 1) + '</span><span class="d"></span><select class="rsel" data-f="chain:' + i + '">' + opt(p.styles.chain[i], '(empty)') + '</select></div>';
    h += '<div class="d">Now: ' + R.chainFor(p, all, hands).map(nm).map(esc).join(' &gt; ') + ' <small>(' + (hands === 2 ? 'two-handed' : 'one-handed') + ' weapon: only matching styles play. More slots from the Smith.)</small></div>';
    h += '<div class="sec">Other attacks</div>';
    for (const k of Object.keys(R.ROLES)) h += '<div class="srow"><span>' + R.ROLES[k] + '</span><span class="d"></span><select class="rsel" data-f="role:' + k + '">' + opt(p.styles.roles[k], 'Default') + '</select></div>';
    h += '<div class="sec">Learn attack styles</div>';
    for (const st of all) {
      const own = p.styles.owned.includes(st.id);
      h += '<div class="srow' + (own ? '' : ' dim') + '"><span>' + esc(st.name) + '</span><span class="d">' + (st.hands ? (st.hands === 2 ? 'Two-handed' : 'One-handed') : 'Any weapon') + '</span>' + (own ? '<button class="rb" disabled>Learned</button>' : '<button class="rb" data-a="style:' + st.id + '">Learn ' + R.stylePrice(st.id) + ' G</button>') + '</div>';
    }
    h += '<div class="sec">Skills</div><div class="pts">Skill slots: <b>' + p.skills.length + ' / ' + d.skillSlots + '</b> <small>(more from the Smith)</small></div>';
    for (const k of Object.keys(R.SKILLS)) {
      const s = R.SKILLS[k], own = p.owned.skills.includes(k), on = p.skills.includes(k);
      h += '<div class="srow' + (own ? '' : ' dim') + '"><span>' + s.n + '</span><span class="d">' + esc(s.d) + '</span>' + (own ? '<button class="rb" data-a="skill:' + k + '">' + (on ? 'Equipped' : 'Equip') + '</button>' : '<span class="d">learn at the Smith</span>') + '</div>';
    }
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

  ov.addEventListener('change', ev => {
    const f = ev.target.dataset && ev.target.dataset.f; if (!f) return; const [k, x] = f.split(':'); const v = ev.target.value || null;
    const r = k === 'chain' ? R.setChain(profile, +x, v) : R.setRole(profile, x, v); note = r.ok ? '' : r.why; rebuild(); render();
  });
  ov.addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]'); if (!b || b.disabled) return;
    const [a, x, y] = b.dataset.a.split(':'); note = '';
    if (a === 'close') { close(); return; }
    if (a === 'spend') { R.spendPoint(profile, x); rebuild(); }
    else if (a === 'buy') { const r = R.buy(profile, x, y); note = r.ok ? '' : r.why; if (r.ok) { if (x === 'weapon') R.equipWeapon(profile, y); if (x === 'armor') R.equipArmor(profile, y); rebuild(); } }
    else if (a === 'equip') { x === 'weapon' ? R.equipWeapon(profile, y) : R.equipArmor(profile, y); rebuild(); }
    else if (a === 'style') { const r = R.learnStyle(profile, x, env.styles()); note = r.ok ? '' : r.why; rebuild(); }
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

  const camp = makeCampBg(CFG.W, CFG.H); ui.campBg = camp.canvas;
  ui.inCamp = () => ui.active && run.phase === 'camp';
  ui.drawBack = c => {                                               // fire, flags and the station props, over the camp background and behind the fighters
    if (!ui.inCamp()) return;
    drawCampLive(c, live.t, camp.flags);
    for (const s of STATIONS) drawStation(c, s.id, s.x, 262, Math.abs(s.x - live.player.x) <= NEAR, live.t);
  };
  ui.drawLabels = c => {                                             // station names, at screen resolution
    if (!ui.inCamp()) return;
    c.save(); c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = '#14101c';
    for (const s of STATIONS) { const nearIt = Math.abs(s.x - live.player.x) <= NEAR; c.font = '9px ' + FONT; c.strokeText(s.name, s.x, 262 - 58); c.fillStyle = nearIt ? '#ffe27a' : '#f2ecdc'; c.fillText(s.name, s.x, 262 - 58); }
    c.font = '9px ' + FONT; c.strokeText('Practice dummy', 120, 232); c.fillStyle = '#f2ecdc'; c.fillText('Practice dummy', 120, 232);
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
