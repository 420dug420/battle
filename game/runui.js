/* ============================================================
   PROJECT WAR · CAMP AND RUN UI  (browser only)
   The walkable camp, its stations and menus, the wave HUD and the exit vote. Everything it shows comes from game/run.js.
   Windows follow the old Final Fantasy look: blue gradient, white frame. Placeholders everywhere; art comes later.
   ============================================================ */
import { CFG, applyCmd } from './sim.js';
import * as R from './run.js';
import { makeCampBg, drawCampLive, drawCampOver, drawStation, STATION_TOP } from './camp.js';

const KEY = 'pw.run.profile';
const STATIONS = [                                        // where things are in camp (sim x); the dummy stands at 120
  { id: 'book', x: 62, name: 'Book of Swords', hint: 'the log of every fighter' },
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
  let run = new R.Run(live, profile, (Date.now() >>> 0) || 1);
  const save = () => { const t = R.toJSON(profile); try { localStorage.setItem(KEY, t); } catch (e) { } const cl = env.cloud && env.cloud(); if (cl && profile.created) cl.put(t, R.publicProfile(profile)); };
  let wasPhase = 'camp';
  const ui = { active: false, modal: null, run, profile, setRun: r => { run = r; ui.run = r; wasPhase = r.phase; }, R, styles: () => env.styles() };

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
    const act = R.ACTIVES, slotOf = k => profile.actives.indexOf(k);
    let ah = '<div class="sec">Active skills <small>(E and R; cooldowns)</small></div>';
    for (const k of Object.keys(act)) { const own = profile.owned.actives.includes(k), sl = slotOf(k);
      ah += '<div class="srow"><span>' + esc(act[k].n) + (sl >= 0 ? ' <small>[' + (sl ? 'R' : 'E') + ']</small>' : '') + '</span><span class="d">' + esc(act[k].d) + '</span>' +
        (!own ? '<button class="rb" data-a="buy:active:' + k + '">Learn ' + act[k].price + ' G</button>' : '<span class="btnrow" style="margin:0"><button class="rb" data-a="act:0:' + k + '"' + (sl === 0 ? ' disabled' : '') + '>E</button><button class="rb" data-a="act:1:' + k + '"' + (sl === 1 ? ' disabled' : '') + '>R</button></span>') + '</div>'; }
    return head('Trainer', goldLine()) + ah +
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
    h += '<div class="sec">Shields <small>(one-handed weapons only)</small></div>';
    for (const k of Object.keys(R.SHIELDS)) {
      const S = R.SHIELDS[k], own = p.owned.shields.includes(k);
      h += '<div class="srow"><span>' + esc(S.n) + '</span><span class="d">' + esc(S.d) + '</span>' +
        (own ? '<button class="rb" data-a="equip:shield:' + k + '"' + (p.shield === k ? ' disabled>Equipped' : '>Equip') + '</button>' : '<button class="rb" data-a="buy:shield:' + k + '">Buy ' + S.price + ' G</button>') + '</div>';
    }
    h += '<div class="sec">Upgrades (permanent)</div>';
    for (const k of Object.keys(R.UPGRADES)) {
      const u = R.UPGRADES[k], n = p.upgrades[k]; if (u.hidden) continue;
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
    const nu = R.nextChainUnlock(p);
    if (p.level < R.CHAIN_FREE_AT) h += '<div class="srow"><span>Hit ' + (d.chainSlots + 1) + ' <small>locked</small></span><span class="d">Opens free at level ' + R.CHAIN_FREE_AT + ' (you are ' + p.level + ')</span><button class="rb" disabled>Level ' + R.CHAIN_FREE_AT + '</button></div>';
    else if (nu) { const ok = p.level >= nu.level; h += '<div class="srow"><span>Hit ' + (d.chainSlots + 1) + ' <small>locked</small></span><span class="d">' + (ok ? 'Unlock for ' + nu.price + ' G' : 'Needs level ' + nu.level + ' (you are ' + p.level + '), then ' + nu.price + ' G') + '</span><button class="rb" data-a="buy:chainslot:x"' + (ok && p.gold >= nu.price ? '>Unlock ' + nu.price + ' G' : ' disabled>' + (ok ? 'Need ' + nu.price + ' G' : 'Level ' + nu.level)) + '</button></div>'; }
    else h += '<div class="d">All 5 combo slots open.</div>';
    h += '<div class="d">Now: ' + R.chainFor(p, all, hands).map(nm).map(esc).join(' &gt; ') + ' <small>(' + (hands === 2 ? 'two-handed' : 'one-handed') + ' weapon: only matching styles play. Slot 3 opens free at level 3; slots 4 and 5 at levels 12 and 20, for gold.)</small></div>';
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
  const partyOf = () => run.members || [];
  function cartPanel() {
    const p = profile, ms = partyOf(), multi = ms.length > 1 || run.isGuest, me = run.me; let h = head('The cart');
    if (multi) {
      h += '<div class="sec">Party</div>' + ms.map(m => '<div class="srow"><span>' + esc(m.name) + (m.pid === me.pid ? ' (you)' : '') + '</span><span class="d">' + (m.ready ? 'ready' : (run.atCart(m) ? 'at the cart' : 'walk to the cart')) + '</span><span></span></div>').join('');
      h += '<p class="d">Everyone has to stand at the cart and be ready. The run starts when all of you are.</p>';
    }
    h += '<div class="sec">Choose a map</div>';
    for (const k of Object.keys(R.MAPS)) h += '<div class="map"><b>' + esc(R.MAPS[k].n) + '</b><span class="d">' + esc(R.MAPS[k].d) + '</span><span class="d">Best: wave ' + p.best + '</span>' + (me.ready ? '<button class="rb" data-a="unready">Not ready</button>' : '<button class="rb go" data-a="depart:' + k + '">' + (multi ? 'Ready' : 'Depart') + '</button>') + '</div>';
    h += '<p class="d">Waves grow. Every 5 waves the party votes to leave or press on; leaving keeps the gold, with a bonus the deeper you go. If everyone falls, the gold from this run is lost. Gear, levels and skills stay. Someone who joins mid-run drops straight into the fight.</p>';
    h += '<div class="sum">Hirelings: ' + (p.hirelings.length ? p.hirelings.map(x => esc(x.name)).join(', ') : 'none') + '</div>' + msg();
    return h;
  }
  function equipPanel() {
    const p = profile; let h = head('Equipment', goldLine());
    const d = R.derive(p), wc = CFG.weaponClasses[CFG.weapons[p.weapon].cls], ar = CFG.tiers[p.armor];
    h += '<div class="sum">Wielding ' + esc(CFG.weapons[p.weapon].label) + ' (' + (wc.twoHanded ? 'two-handed' : 'one-handed') + ') · wearing ' + esc(ar.label) + (p.shield && R.SHIELDS[p.shield] ? ' · ' + esc(R.SHIELDS[p.shield].n) + (wc.twoHanded ? ' (stowed)' : '') : '') + ' · HP ' + d.maxHp + ' · Damage x' + d.dmgMult.toFixed(2) + '</div>';
    h += '<div class="sec">Weapons</div>';
    for (const k of p.owned.weapons) { const w = CFG.weapons[k], c = CFG.weaponClasses[w.cls];
      h += '<div class="srow"><span>' + esc(w.label) + '</span><span class="d">dmg ' + c.dmg + ', reach ' + c.reach + ', ' + (c.twoHanded ? 'two-handed' : 'one-handed') + '</span><button class="rb" data-a="equip:weapon:' + k + '"' + (p.weapon === k ? ' disabled>Equipped' : '>Equip') + '</button></div>'; }
    h += '<div class="sec">Armor</div>';
    for (const k of p.owned.armor) { const t = CFG.tiers[k];
      h += '<div class="srow"><span>' + esc(t.label) + '</span><span class="d">' + Math.round(t.pct * 100) + '% off, durability ' + t.dur + '</span><button class="rb" data-a="equip:armor:' + k + '"' + (p.armor === k ? ' disabled>Worn' : '>Wear') + '</button></div>'; }
    const two = R.twoHanded(p.weapon), cur = p.shield && R.SHIELDS[p.shield];
    h += '<div class="sec">Shield</div>';
    h += '<div class="srow"><span>None</span><span class="d">Block key blocks and parries</span><button class="rb" data-a="equip:shield:none"' + (!p.shield ? ' disabled>Empty' : '>Unequip') + '</button></div>';
    for (const k of p.owned.shields) { const S = R.SHIELDS[k];
      h += '<div class="srow"><span>' + esc(S.n) + '</span><span class="d">' + esc(S.d) + '</span><button class="rb" data-a="equip:shield:' + k + '"' + (p.shield === k ? ' disabled>Equipped' : '>Equip') + '</button></div>'; }
    if (!p.owned.shields.length) h += '<p class="d">No shields yet. The Smith sells them.</p>';
    if (cur && two) h += '<p class="d">Your ' + esc(cur.n) + ' stays on your back while you wield a two-handed weapon.</p>';
    else if (cur) h += '<p class="d">With a shield: hold the block key to raise it (no parry). Attack while it is raised for a shield slam.</p>';
    const lk = p.look || {}; h += '<div class="sec">Look</div>' + lookSelect('head', 'Head', lk.head, p.owned.armor) + lookSelect('body', 'Body', lk.body, p.owned.armor) + lookSelect('liv', 'Livery', lk.liv, p.owned.armor) + lookSelect('metal', 'Metal', lk.metal, p.owned.armor);
    return h + '<p class="d">Buy more at the Smith. A change takes effect in camp and goes with you on the next run.</p>' + msg();
  }
  const lookSelect = (k, lab, cur, tiers) => { const o = env.lookOptions ? env.lookOptions(tiers) : {}; return '<div class="srow"><span>' + lab + '</span><select class="rsel" data-c="' + k + '">' + (o[k] || [{ v: '', l: 'From armor' }]).map(x => '<option value="' + esc(x.v) + '"' + ((cur || '') === x.v ? ' selected' : '') + '>' + esc(x.l) + '</option>').join('') + '</select><span></span></div>'; };
  let draft = null;
  function createPanel() {
    draft = draft || { name: profile.name === 'Baron' ? '' : profile.name, head: '', body: '', liv: '', metal: '' };
    const sel = (k, lab) => lookSelect(k, lab, draft[k], ['leather']);
    return '<div class="rhead"><span>Create your fighter</span></div>' +
      '<div class="srow"><span>Name</span><input class="rsel" data-c="name" maxlength="16" value="' + esc(draft.name) + '" placeholder="Your name"><span></span></div>' +
      sel('head', 'Head') + sel('body', 'Body') + sel('liv', 'Livery') + sel('metal', 'Metal') +
      '<p class="d">You start in tier 1 (leather) gear, so only its looks are offered. Better looks come with better armor. You can change the look later on the Equipment screen (I).</p>' + msg() +
      '<div class="btnrow"><button class="rb go" data-a="create">Begin</button></div>';
  }
  /* ---------- Tab: the character sheet (your own; others see the truncated one in the Book of Swords) ---------- */
  let swap = null;
  const portraitImg = (o, mode, w, alt) => { const u = env.portrait ? env.portrait(o, mode) : null; return u ? '<img src="' + u + '" alt="' + esc(alt) + '" style="width:' + w + 'px;image-rendering:pixelated">' : '<span class="d">[portrait]</span>'; };
  const myModel = () => ({ look: profile.look || null, tier: profile.armor, weapon: profile.weapon, shield: profile.shield || null });
  function sheetPanel() {
    const p = profile, d = R.derive(p), need = R.xpNeed(p.level), wc = CFG.weaponClasses[CFG.weapons[p.weapon].cls], ar = CFG.tiers[p.armor], sh = p.shield && R.SHIELDS[p.shield];
    const slot = (id, label, name, sub) => '<button class="slot' + (swap === id ? ' on' : '') + '" data-a="swap:' + id + '"><small>' + label + '</small><b>' + esc(name) + '</b><span class="d">' + esc(sub) + '</span></button>';
    const list = rows => '<div class="swaplist"><small>SWAP FOR (owned)</small>' + rows.join('') + '</div>';
    const opt = (a, name, sub, on) => '<button class="sopt" data-a="' + a + '"' + (on ? ' disabled' : '') + '><span>' + esc(name) + '</span><span class="d">' + (on ? 'equipped' : esc(sub)) + '</span></button>';
    let eq = slot('weapon', 'WEAPON', CFG.weapons[p.weapon].label, (wc.twoHanded ? 'two-handed' : 'one-handed') + ' · dmg ' + wc.dmg + ' · reach ' + wc.reach);
    if (swap === 'weapon') eq += list(p.owned.weapons.map(k => { const c = CFG.weaponClasses[CFG.weapons[k].cls]; return opt('equip:weapon:' + k, CFG.weapons[k].label, (c.twoHanded ? '2H' : '1H') + ' · dmg ' + c.dmg + (c.twoHanded && p.shield ? ' · shield stowed' : ''), p.weapon === k); }));
    eq += slot('armor', 'ARMOR', ar.label, Math.round(ar.pct * 100) + '% off hits · durability ' + ar.dur);
    if (swap === 'armor') eq += list(p.owned.armor.map(k => opt('equip:armor:' + k, CFG.tiers[k].label, Math.round(CFG.tiers[k].pct * 100) + '% off', p.armor === k)));
    eq += slot('shield', 'SHIELD', sh ? sh.n : 'None', sh ? (wc.twoHanded ? 'stowed: two-handed weapon' : (sh.heavy ? 'blocks heavies' : 'blocks normal hits') + ' · no parry') : 'block key blocks and parries');
    if (swap === 'shield') eq += list([opt('equip:shield:none', 'None', 'block and parry', !p.shield)].concat(p.owned.shields.map(k => opt('equip:shield:' + k, R.SHIELDS[k].n, R.SHIELDS[k].heavy ? 'blocks heavies' : 'light', p.shield === k))));
    for (const sl of [0, 1]) { const k = p.actives[sl];
      eq += slot('act' + sl, 'ACTIVE SKILL (' + (sl ? 'R' : 'E') + ')', k ? R.ACTIVES[k].n : 'None', k ? 'cooldown skill' : (p.owned.actives.length ? 'click to choose' : 'learn active skills at the Trainer'));
      if (swap === 'act' + sl) eq += list([opt('act:' + sl + ':none', 'None', 'empty slot', !k)].concat(p.owned.actives.map(a => opt('act:' + sl + ':' + a, R.ACTIVES[a].n, p.actives.indexOf(a) >= 0 && p.actives[sl] !== a ? 'swaps slots' : '', p.actives[sl] === a)))); }
    eq += slot('skill', 'SKILLS (' + p.skills.length + ' / ' + d.skillSlots + ')', p.skills.length ? p.skills.map(k => R.SKILLS[k].n).join(', ') : 'None', p.owned.skills.length ? 'click to change' : 'learn skills at the Smith');
    if (swap === 'skill') eq += list(p.owned.skills.length ? p.owned.skills.map(k => '<button class="sopt" data-a="skill:' + k + '"><span>' + esc(R.SKILLS[k].n) + '</span><span class="d">' + (p.skills.includes(k) ? 'on: click to take off' : 'off: click to equip') + '</span></button>') : ['<span class="d">No skills learned yet.</span>']);
    const attrs = R.ATTRS.map(a => '<div class="arow2"><b>' + R.ATTR_INFO[a].n + '</b><span class="d">' + esc(R.ATTR_INFO[a].d.split('.')[0]) + '</span><span>' + R.attr(p, a) + ((p.grown[a] || 0) ? ' <small>(+' + p.grown[a] + ')</small>' : '') + '</span><button class="rb" data-a="spend:' + a + '"' + (p.points > 0 ? '' : ' disabled') + ' aria-label="Raise ' + R.ATTR_INFO[a].n + '">+</button></div>').join('');
    const chainN = d.chainSlots, nu = R.nextChainUnlock(p), chain = Array.from({ length: chainN }, (_, i) => (p.styles.chain || [])[i] || null).map(id => !id ? '<span class="chip lock">(empty)</span>' : '<span class="chip">' + esc((env.styles().find(x => x.id === id) || { name: id || '(empty)' }).name) + '</span>').join('') +
      (p.level < R.CHAIN_FREE_AT ? '<span class="chip lock">Lv ' + R.CHAIN_FREE_AT + '</span>' : '') + R.CHAIN_UNLOCKS.slice(p.upgrades.chain || 0).map(u => '<span class="chip lock">Lv ' + u.level + '</span>').join('');
    return head('Character', '<div class="gold">' + p.gold + ' G</div><span class="d" style="margin-left:8px">Tab to close</span>') +
      '<div class="sheet">' +
        '<div class="scol"><div class="who"><div class="face">' + portraitImg(myModel(), 'face', 84, 'Your face') + '</div><div><div class="nm">' + esc(p.name) + '</div><div class="lv">Level ' + p.level + '</div><div class="d">XP ' + p.xp + ' / ' + need + '</div>' + bar(p.xp, need, 'xp') + '</div></div>' +
          (p.points > 0 ? '<div class="lvup">Level up: ' + p.points + ' point' + (p.points > 1 ? 's' : '') + ' to spend</div>' : '<div class="d">No points to spend. One per level.</div>') + attrs + '</div>' +
        '<div class="scol"><div class="sec">Equipped <small>(click an item to swap it)</small></div><div class="eqgrid"><div class="eqcol">' + eq + '</div>' +
          '<div class="model"><div class="mbox">' + portraitImg(p.model || myModel(), 'full', 130, 'Your profile model') + '</div><div class="d" style="text-align:center">Profile model: what others see in the Book of Swords' + (p.model ? '' : ' (not set: shows your current look)') + '</div><button class="rb go" data-a="model">Set profile model to my current look</button></div></div></div>' +
        '<div class="scol"><div class="sec">Stats</div><div class="kv"><span>Max HP</span><b>' + d.maxHp + '</b><span>Stamina</span><b>' + d.staminaMax + '</b><span>Damage</span><b>x' + d.dmgMult.toFixed(2) + '</b><span>Move speed</span><b>x' + d.spdMult.toFixed(2) + '</b><span>Stamina regen</span><b>x' + d.regenMult.toFixed(2) + '</b><span>Armor</span><b>' + Math.round(ar.pct * 100) + '%</b><span>Hirelings</span><b>' + p.hirelings.length + ' / ' + d.hireCap + '</b></div>' +
          '<div class="sec">Combo chain <small>' + chainN + ' / 5 slots</small></div><div class="chips">' + chain + '</div>' +
          '<div class="sec">Record</div><div class="kv"><span>Runs</span><b>' + (p.runs || 0) + '</b><span>Best wave</span><b>' + (p.best || 0) + '</b><span>Best style rank</span><b>' + R.RUNCFG.rank.names[p.bestRank || 0] + '</b></div></div>' +
      '</div>' + msg();
  }
  /* ---------- the Book of Swords: everyone who has played, from the save server ---------- */
  const book = { list: null, err: '', q: '', sel: null, prof: null, loading: false };
  function bookLoad() {
    const cl = env.cloud && env.cloud(); book.loading = true; book.err = '';
    if (!cl) { book.err = 'No connection to the save server.'; book.loading = false; return; }
    cl.book(book.q).then(r => { book.list = (r && r.players) || []; book.loading = false; if (ui.modal === 'book') render(); })
      .catch(() => { book.err = 'The Book of Swords lives on the save server, which this page can\'t reach. It works in the Discord activity.'; book.loading = false; if (ui.modal === 'book') render(); });
  }
  function bookOpen(id) {
    const cl = env.cloud && env.cloud(); book.sel = id; book.prof = null; if (!cl) return;
    cl.profile(id).then(r => { if (book.sel === id) { book.prof = r && r.profile; if (ui.modal === 'book') render(); } }).catch(() => { book.err = 'Could not open that page.'; if (ui.modal === 'book') render(); });
  }
  function bookPanel() {
    const ago = t => { if (!t) return '?'; const s = (Date.now() - t) / 1000; return s < 120 ? 'now' : s < 7200 ? Math.round(s / 60) + ' min' : s < 172800 ? Math.round(s / 3600) + ' h' : Math.round(s / 86400) + ' days'; };
    let left = '<label class="d">Find a fighter <input class="rsel" data-c="bookq" value="' + esc(book.q) + '" placeholder="Name" maxlength="16"></label>' +
      '<div class="brow hd"><span>NAME</span><span>LEVEL</span><span>BEST</span><span>SEEN</span></div>';
    if (book.loading && !book.list) left += '<div class="d">Opening the book...</div>';
    else if (book.list && !book.list.length) left += '<div class="d">No names written yet.</div>';
    else if (book.list) left += book.list.map(x => '<button class="brow' + (book.sel === x.id ? ' on' : '') + '" data-a="bk:' + esc(x.id) + '"><span>' + esc(x.name) + '</span><span>' + x.level + '</span><span>wave ' + x.best + '</span><span class="d">' + ago(x.lastSeen) + '</span></button>').join('');
    let right = '<div class="d">Pick a name to read their page.</div>';
    const P = book.prof;
    if (book.sel && !P) right = '<div class="d">Turning the pages...</div>';
    if (P) right = '<div class="who"><div class="face">' + portraitImg(P.model, 'face', 76, P.name + "'s face") + '</div><div><div class="nm">' + esc(P.name) + '</div><div class="lv">Level ' + P.level + '</div><div class="d">Last seen: ' + ago(P.lastSeen) + '</div></div></div>' +
      '<div class="eqgrid"><div class="mbox">' + portraitImg(P.model, 'full', 120, P.name + "'s profile model") + '</div><div><div class="sec">Attributes</div><div class="kv">' + R.ATTRS.map(a => '<span>' + R.ATTR_INFO[a].n + '</span><b>' + ((P.attrs || {})[a] || 0) + '</b>').join('') + '</div>' +
      '<div class="sec">Record</div><div class="kv"><span>Runs</span><b>' + (P.runs || 0) + '</b><span>Best wave</span><b>' + (P.best || 0) + '</b><span>Best style rank</span><b>' + R.RUNCFG.rank.names[P.bestRank || 0] + '</b><span>Fights with</span><b>' + esc((CFG.weapons[P.weapon] || { label: '?' }).label) + '</b></div></div></div>';
    return head('Book of Swords') + '<div class="d">Every fighter who has stood at a Project War fire.</div>' + (book.err ? '<div class="note">' + esc(book.err) + '</div>' : '') + '<div class="bookg"><div class="blist">' + left + '</div><div class="bpage">' + right + '</div></div>';
  }
  function votePanel() {
    const ms = partyOf(), me = run.me, mine = me.vote, left = Math.ceil(run.voteIn != null && run.isGuest ? run.voteIn : Math.max(0, run.voteAt - live.t));
    return '<div class="rhead"><span>Wave ' + run.wave + ' cleared</span><span class="d">' + left + 's</span></div><div class="big">Leave with <b>' + run.leavePay() + ' G</b>?</div>' +
      '<p class="d">Press on and the next stage pays more, but if everyone falls the run\'s gold is lost. Most votes decide; a tie, or no answer, presses on.</p>' +
      (ms.length > 1 ? ms.map(m => '<div class="srow"><span>' + esc(m.name) + '</span><span class="d">' + (m.vote === 'leave' ? 'leave' : m.vote === 'stay' ? 'press on' : 'deciding...') + '</span><span></span></div>').join('') : '') +
      (mine ? '<p class="d">You voted to ' + (mine === 'leave' ? 'leave' : 'press on') + '. Waiting for the others.</p>' : '') +
      '<div class="btnrow"><button class="rb go" data-a="vote:leave">Leave</button><button class="rb" data-a="vote:stay">Press on</button></div>';
  }
  function resultPanel() {
    const r = run.result; if (!r) return '';
    return '<div class="rhead"><span>' + (r.kind === 'dead' ? 'You fell' : 'Back from the field') + '</span></div>' +
      '<div class="big">Wave ' + r.wave + '</div><div class="sum">Kills ' + r.kills + ' · XP ' + r.xp + (r.levels ? ' · Levels +' + r.levels : '') + '</div>' +
      (r.kind === 'dead' ? '<div class="big bad">Lost ' + r.lost + ' G</div><p class="d">Gold from this run is gone. Gear, levels, skills and hirelings are safe.</p>' : '<div class="big">+' + r.gold + ' G</div>') +
      '<div class="btnrow"><button class="rb go" data-a="camp">' + (run.me.acked ? 'Waiting for the others...' : 'Return to camp') + '</button></div>';
  }
  const PANELS = { stats: statsPanel, shop: shopPanel, style: stylePanel, hire: hirePanel, cart: cartPanel, vote: votePanel, result: resultPanel, equip: equipPanel, create: createPanel, sheet: sheetPanel, book: bookPanel };
  function render() {
    if (!ui.modal) { ov.innerHTML = ''; return; }
    ov.innerHTML = '<div class="rback' + (ui.modal === 'create' ? ' r-create' : '') + '"><div class="ff rpanel p-' + ui.modal + '">' + PANELS[ui.modal]() + '</div></div>';
  }
  const applyLook = lk => { const L = lk || profile.look || {}; for (const [id, k] of [['lkhead', 'head'], ['lkbody', 'body'], ['lkliv', 'liv'], ['lkmetal', 'metal']]) { const el = $(id); if (el && [...el.options].some(o => o.value === (L[k] || ''))) el.value = L[k] || ''; } };
  const rebuild = () => { applyLook(); env.clearKeys(); run.applyBuild(false); applyCmd(live, { t: 'set', inv: true }); const t = $('ptier'); if (t && [...t.options].some(o => o.value === profile.armor)) t.value = profile.armor; env.readLook(); save(); };

  const onC = (ev, live2) => {
    const k = ev.target.dataset && ev.target.dataset.c; if (!k) return false;
    if (ui.modal === 'create') { draft[k] = ev.target.value; if (k !== 'name') { applyLook(draft); env.readLook(); const q = live.player; q.look = { head: draft.head, body: draft.body, liv: draft.liv, metal: draft.metal }; } }
    else if (k !== 'name') { profile.look = Object.assign({ head: '', body: '', liv: '', metal: '' }, profile.look, { [k]: ev.target.value }); rebuild(); }
    return true;
  };
  let bookT = 0;
  ov.addEventListener('input', ev => { const c = ev.target.dataset && ev.target.dataset.c; if (c === 'name') draft.name = ev.target.value; if (c === 'bookq') { book.q = ev.target.value.slice(0, 16); clearTimeout(bookT); bookT = setTimeout(() => { bookLoad(); }, 350); } });
  ov.addEventListener('change', ev => {
    if (ev.target.dataset && ev.target.dataset.c === 'bookq') return;
    if (onC(ev)) return;
    const f = ev.target.dataset && ev.target.dataset.f; if (!f) return; const [k, x] = f.split(':'); const v = ev.target.value || null;
    const r = k === 'chain' ? R.setChain(profile, +x, v) : R.setRole(profile, x, v); note = r.ok ? '' : r.why; rebuild(); render();
  });
  ov.addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]'); if (!b || b.disabled) return;
    const [a, x, y] = b.dataset.a.split(':'); note = '';
    if (a === 'close') { close(); return; }
    if (a === 'spend') { R.spendPoint(profile, x); rebuild(); }
    else if (a === 'buy') { const r = R.buy(profile, x, y); note = r.ok ? '' : r.why; if (r.ok) { if (x === 'weapon') R.equipWeapon(profile, y); if (x === 'armor') R.equipArmor(profile, y); if (x === 'shield') R.equipShield(profile, y); rebuild(); } }
    else if (a === 'equip') { swap = null; x === 'weapon' ? R.equipWeapon(profile, y) : x === 'shield' ? R.equipShield(profile, y) : R.equipArmor(profile, y); rebuild(); }
    else if (a === 'style') { const r = R.learnStyle(profile, x, env.styles()); note = r.ok ? '' : r.why; rebuild(); }
    else if (a === 'skill') { const r = R.toggleSkill(profile, x); note = r.ok ? '' : r.why; rebuild(); }
    else if (a === 'hire') { const r = R.hire(profile, R.recruits(profile, run.seed)[+x]); note = r.ok ? '' : r.why; save(); }
    else if (a === 'dismiss') { R.dismiss(profile, +x); save(); }
    else if (a === 'reset') { if (!ui.confirmReset) { ui.confirmReset = true; note = 'Press Delete save again to wipe your progress.'; render(); return; } ui.confirmReset = false; localStorage.removeItem(KEY); Object.assign(profile, R.newProfile('Baron')); draft = null; run.me.name = profile.name; run.enterCamp(); rebuild(); live.player.x = 150; open('create'); return; }
    else if (a === 'act') { R.equipActive(profile, +x, y); swap = null; rebuild(); }
    else if (a === 'swap') { swap = swap === x ? null : x; render(); return; }
    else if (a === 'model') { profile.model = myModel(); note = 'Profile model set: this is how you look in the Book of Swords.'; save(); render(); return; }
    else if (a === 'bk') { bookOpen(x); render(); return; }
    else if (a === 'create') { if (!draft) return; profile.name = (draft.name || '').trim().slice(0, 16) || 'Baron'; profile.look = { head: draft.head, body: draft.body, liv: draft.liv, metal: draft.metal }; profile.created = true; if (!profile.firstSeen) profile.firstSeen = Date.now(); draft = null; run.me.name = profile.name; live.player.x = 330; rebuild(); close(); return; }
    else if (a === 'unready') { run.unready(run.me.pid); }
    else if (a === 'depart') { save(); const multi = partyOf().length > 1 || run.isGuest; run.depart(x); if (multi && run.phase === 'camp') { note = run.atCart() ? 'Ready. Waiting for the others.' : 'Stand at the cart first.'; render(); return; } close(); env.readLook(); return; }
    else if (a === 'vote') { run.vote(x === 'leave'); render(); return; }
    else if (a === 'camp') { run.returnToCamp(); if (run.phase === 'camp' || !partyOf().length) { rebuild(); close(); } else render(); return; }
    ui.confirmReset = a === 'reset' ? ui.confirmReset : false;
    render();
  });

  /* ---------- mode control ---------- */
  ui.enter = () => {
    ui.active = true; ov.hidden = false; env.stopRec(); env.clearKeys();
    run.enterCamp(); rebuild(); close(); if (!profile.created) { live.player.x = 150; open('create'); }
  };
  ui.leave = () => {
    ui.active = false; ov.hidden = true; ui.modal = null; ov.innerHTML = '';
    live.mode = 'arena'; live.clearEnemies(); live.clearAllies(); live.proj = []; live.feed = []; env.clearKeys(); env.afterLeave();
  };
  let refT = 0;
  ui.afterResult = () => { save(); };
  ui.update = dt => {
    run.update(dt);
    if (run.phase !== wasPhase) {                                    // the run changed phase: open what the player needs to answer
      const was = wasPhase; wasPhase = run.phase;
      if (run.phase === 'vote') open('vote');
      else if (run.phase === 'dead' || run.phase === 'left') { save(); open('result'); }
      else if (run.phase === 'camp' && was !== 'camp') { save(); rebuild(); close(); }
      else if (run.phase === 'wave' && (ui.modal === 'cart' || ui.modal === 'vote')) close();
    }
    if (ui.modal && ['cart', 'vote', 'result'].includes(ui.modal) && (refT += dt) > 0.25) { refT = 0; render(); }       // other members' ready, votes and acks change under the open panel
  };
  const near = () => { if (run.phase !== 'camp') return null; const x = live.player.x; return STATIONS.find(s => Math.abs(s.x - x) <= NEAR) || null; };
  ui.saveNow = () => { save(); const cl = env.cloud && env.cloud(); if (cl) cl.flush(); };
  ui.loadSave = txt => {                                             // the server's save replaces this device's
    const p = R.fromJSON(txt); if (!p) return false;
    for (const k of Object.keys(profile)) delete profile[k]; Object.assign(profile, p);
    run.me.name = profile.name; try { localStorage.setItem(KEY, R.toJSON(profile)); } catch (e) { }
    if (ui.active) { rebuild(); if (ui.modal === 'create' && profile.created) close(); else if (ui.modal) render(); }
    return true;
  };
  ui.key = (code, act) => {                                          // true when the key was used here
    if (!ui.active) return false;
    if (ui.modal) { if ((code === 'Escape' || (code === 'Tab' && ui.modal === 'sheet')) && ui.modal !== 'vote' && ui.modal !== 'result' && ui.modal !== 'create') close(); return true; }
    if (code === 'Tab' && run.phase === 'camp') { swap = null; open('sheet'); return true; }
    if (act === 'use' && run.phase === 'camp') { const s = near(); if (s) { if (s.id === 'book') { book.sel = null; book.prof = null; bookLoad(); } open(s.id); } return true; }
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
  /* a living camp: your hirelings sit at the fire or spar by the dummy, and fighters from the Book of Swords who are away drift about the edges as ghosts */
  const ghosts = { list: [], at: -1e9, busy: false };
  function ghostLoad() {
    const cl = env.cloud && env.cloud(); if (!cl || ghosts.busy || Date.now() - ghosts.at < 300000) return; ghosts.busy = true; ghosts.at = Date.now();
    cl.book('').then(r => {
      const others = ((r && r.players) || []).filter(x => x.name !== profile.name).slice(0, 3);
      return Promise.all(others.map(x => cl.profile(x.id).then(q => q && q.profile ? { name: x.name, level: x.level, prof: q.profile } : null).catch(() => null)));
    }).then(L => { ghosts.list = (L || []).filter(Boolean); ghosts.busy = false; }).catch(() => { ghosts.busy = false; });
  }
  ui._ghosts = ghosts;
  const SEATS = [[284, 246, 1], [390, 246, -1], [236, 318, 1], [530, 318, -1]];
  ui.campActors = () => {
    if (!ui.inCamp()) return [];
    ghostLoad();
    const t = live.t, out = [], H = profile.hirelings || [];
    const spar = H.length >= 2 ? H.slice(0, 2) : [], sit = H.length >= 2 ? H.slice(2) : H;
    spar.forEach((h, i) => {                                        // two of them trade blows: one swings, the other parries, then they swap
      const cyc = t % 3.2, mine = i === (cyc < 1.6 ? 0 : 1), u = (cyc % 1.6) / 1.0;
      out.push({ key: 'h' + h.hid, x: i ? 468 : 432, y: 318, face: i ? -1 : 1, tier: h.tier, weapon: h.weapon, seed: h.hid * 7919 + 13, name: '',
        swing: mine && u < 1 ? { t: u, dur: 1, dur0: 1, hitAt: 0.45, extra: 0 } : null, st: !mine && u > 0.35 && u < 0.75 ? { kind: 'parry', u: (u - 0.35) / 0.4 } : null });
    });
    sit.slice(0, 4).forEach((h, i) => { const s = SEATS[i]; out.push({ key: 'h' + h.hid, x: s[0], y: s[1], face: s[2], tier: h.tier, weapon: h.weapon, seed: h.hid * 7919 + 13, name: '' }); });
    ghosts.list.forEach((g, i) => {                                 // away: pale, slow, wandering the far side of camp
      const m = (g.prof && g.prof.model) || {}, ph = t * 0.12 + i * 2.1, base = 470 + i * 55;
      out.push({ key: 'g' + i, x: base + Math.sin(ph) * 40, y: 248 + i * 5, face: Math.cos(ph) >= 0 ? 1 : -1, moving: true, walkT: t * 0.8, tier: m.tier || 'leather', weapon: m.weapon || 'longsword', look: m.look || null, ghost: true, alpha: 0.32, name: g.name + ' (away)' });
    });
    return out;
  };
  ui.drawBack = c => {                                               // fire, flags and the station props, over the camp background and behind the fighters
    if (!ui.inCamp()) return;
    drawCampLive(c, live.t, camp.flags);
    for (const s of STATIONS) drawStation(c, s.id, s.x, 262, Math.abs(s.x - live.player.x) <= NEAR, live.t);
  };
  ui.drawOver = c => { if (ui.inCamp()) drawCampOver(c, live.t, CFG.W, CFG.H); };
  ui.drawLabels = c => {                                             // station names, at screen resolution
    if (!ui.inCamp()) return;
    c.save(); c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = '#14101c';
    for (const s of STATIONS) { const nearIt = Math.abs(s.x - live.player.x) <= NEAR; c.font = '9px ' + FONT; const ly = 262 - (STATION_TOP[s.id] || 58) - 6; c.strokeText(s.name, s.x, ly); c.fillStyle = nearIt ? '#ffe27a' : '#f2ecdc'; c.fillText(s.name, s.x, ly); }
    c.font = '9px ' + FONT; c.strokeText('Practice dummy', 120, 232); c.fillStyle = '#f2ecdc'; c.fillText('Practice dummy', 120, 232);
    c.restore();
  };

  ui.drawFront = c => {
    if (!ui.active) return;
    { const q = live.player, A = q.actives || [];                  // the two active skill slots, E and R, with their cooldowns
      if (A[0] || A[1]) for (const sl of [0, 1]) { const k = A[sl]; if (!k) continue; const x = 640 - 112 + sl * 54, y = 360 - 40, cd = (q.acd || [0, 0])[sl], max = (CFG.actives[k] || { cd: 1 }).cd;
        win(c, x, y, 50, 30); txt(c, sl ? 'R' : 'E', x + 6, y + 13, '#ffe27a', 9); txt(c, R.ACTIVES[k].n.split(' ')[0], x + 25, y + 24, cd > 0 ? '#8a96c0' : '#fff', 7, 'center');
        if (cd > 0) { c.fillStyle = 'rgba(4,6,42,.55)'; c.fillRect(x + 3, y + 3, 44 * cd / max, 24); txt(c, Math.ceil(cd) + 's', x + 42, y + 13, '#cfd6ff', 8, 'right'); } } }
    { const B = live.enemies.find(e => e.state === 'alive' && e.boss && !e.dummy);                 // a knight or the general on the field: a bar across the top
      if (B && run.phase !== 'camp') { const nm = ((CFG.kinds[B.kind] || {}).name || B.kind).toUpperCase(), x = 200, y = 64, w = 240;
        c.save(); c.textAlign = 'center'; c.font = '10px ' + FONT; c.lineWidth = 3; c.strokeStyle = '#14101c'; c.strokeText(nm, 320, y - 4); c.fillStyle = '#ffb08a'; c.fillText(nm, 320, y - 4);
        c.fillStyle = '#14101c'; c.fillRect(x - 1, y - 1, w + 2, 8); c.fillStyle = '#5a1a1a'; c.fillRect(x, y, w, 6); c.fillStyle = '#e04a3a'; c.fillRect(x, y, Math.round(w * Math.max(0, B.hp) / B.maxHp), 6); c.restore(); } }
    const p = live.player, W = CFG.W, H = CFG.H;
    c.save();
    if (run.phase === 'camp') {
      const need = R.xpNeed(profile.level);
      win(c, 6, 6, 152, 50); txt(c, profile.name, 14, 21, '#fff', 11); txt(c, 'Lv ' + profile.level, 150, 21, '#ffe27a', 11, 'right');
      txt(c, 'XP', 14, 34, '#bcd', 8); gauge(c, 28, 28, 120, 6, profile.xp, need, '#6fb0ff'); txt(c, profile.gold + ' G', 14, 49, '#ffe27a', 10); if (profile.points) txt(c, profile.points + ' pts', 150, 49, '#9fe39f', 9, 'right');
      const s = near();
      win(c, 120, H - 40, 400, 32);
      if (s) { txt(c, 'T', 134, H - 20, '#ffe27a', 12); txt(c, s.name + ': ' + s.hint, 152, H - 20, '#fff', 10); }
      else txt(c, 'W A S D walk · Sign + T · Tab character · The cart starts a run', W / 2, H - 20, '#cfe', 9, 'center');
    } else {
      // party window (bottom left): you and your hirelings
      const others = live.players.filter(q => q !== p).map(q => { const m = partyOf().find(x => x.pid === q.pid); return { n: (q.name || 'Ally').slice(0, 9), hp: Math.max(0, q.hp), max: q.maxHp, lv: m && m.level, ally: true }; });
      const rows = [{ n: profile.name, hp: p.hp, max: p.maxHp, st: p.stamina, smax: p.staminaMax, lv: profile.level }].concat(others).concat(live.allies.map(a => ({ n: a.name.split(' ')[0], hp: a.hp, max: a.maxHp, ally: true })));
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
