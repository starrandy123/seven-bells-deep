// The menu: Quests, Map, Codex, Powers, Settings. All thumb-sized, all in one screen with a tab bar along the bottom, upright and turned.
import { TOUCH } from './config.js';
import { DATA } from './data.js';
import { canSave } from './save.js';
import { createMap } from './map.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TITLES = { quests: 'Quests', map: 'Map', codex: 'Codex', powers: 'Powers', settings: 'Settings' };

export function createScreens(G, ui) {
  let tab = 'quests', codexTab = 'creatures', openDone = null, waiting = null;
  const map = createMap(G);

  function show(name) {
    tab = name;
    document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.id === `tab-${name}`));
    $('menuTitle').textContent = TITLES[name] || 'Paused';
    paint();
  }
  function paint() {
    const q = G.quest; if (!q) return;
    $('menuPearls').textContent = `${q.pearlCount()} pearls`;
    if (tab === 'quests') quests(); else if (tab === 'map') map.open(); else if (tab === 'codex') codex(); else if (tab === 'powers') powers(); else if (tab === 'settings') settings();
  }
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));

  // ------------------------------------------------------------------ Quests
  function steps(def, upto) {   // finished objectives, ticked; the one under way in bold
    const out = []; def.objectives.forEach((o, i) => { if (!o.text || i > upto) return; const cur = i === upto; out.push(`<small>${cur ? '<b style="display:inline">' : '&#10003; '}${esc(cur ? G.quest.missions.textOf(G.quest.missions.active.find((m) => m.def === def)) : o.text.replace(/\s*\(\{n\} of \{total\}\)/, '').replace(/ in \{time\} s/, ''))}${cur ? '</b>' : ''}</small>`); });
    return out.join('');
  }
  function line(m) {
    const q = G.quest, tr = q.missions.tracked === m;
    return `<div class="row tapp${tr ? ' track' : ''}" data-track="${esc(m.def.id)}"><div class="g"><b>${esc(m.def.title)}</b>${m.def.blurb ? `<small>${esc(m.def.blurb)}</small>` : ''}${steps(m.def, m.i)}</div><span class="tag">${tr ? 'Tracked' : 'Track'}</span></div>`;
  }
  function quests() {
    const q = G.quest, ms = q.missions, a = ms.active, pr = q.progress(), r = pr.rows; let h = '';
    h += `<div class="row"><div class="g"><b>${pr.pct}% of the sea</b><small>Bells ${q.rungCount()} of ${q.bells.length} · Story ${r.story.join(' of ')} · People helped ${r.people.join(' of ')} · Challenges ${r.challenges.join(' of ')}</small><small>Tablets ${r.tablets.join(' of ')} · Creatures ${r.creatures.join(' of ')} · Pearls ${r.pearls.join(' of ')} · Chests ${r.chests.join(' of ')}</small></div></div>`;
    const chapters = a.filter((m) => m.def.kind === 'story'), sides = a.filter((m) => m.def.kind === 'side'), runs = a.filter((m) => m.def.kind === 'challenge' || m.def.kind === 'event');
    if (chapters.length) h += '<div class="sect">The story</div>' + chapters.map(line).join('');
    if (sides.length) h += '<div class="sect">People to help</div>' + sides.map(line).join('');
    if (runs.length) h += '<div class="sect">Under way</div>' + runs.map(line).join('');
    const offers = [...ms.defs.values()].filter(ms.offerable);
    if (offers.length) h += '<div class="sect">Someone is asking</div>' + offers.map((d) => `<div class="row"><div class="g"><b>${esc(d.title)}</b><small>Talk to ${esc(q.people.nameOf(d.giver))}</small></div></div>`).join('');
    const ch = [...ms.defs.values()].filter((d) => d.kind === 'challenge' && ms.ready(d));
    if (ch.length) h += '<div class="sect">Challenges</div>' + ch.map((d) => { const b = q.st.best[d.id]; return `<div class="row"><div class="g"><b>${esc(d.title)}</b><small>${esc(d.blurb || '')}</small></div><span class="tag">${b === undefined ? 'No best yet' : `Best ${q.timeText(b)}`}</span></div>`; }).join('');
    const done = [...ms.defs.values()].filter((d) => (d.kind === 'story' || d.kind === 'side') && ms.isDone(d.id));
    if (done.length) h += `<div class="sect">Finished (${done.length})</div>` + done.map((d) => `<div class="row tapp" data-open="${esc(d.id)}"><div class="g"><b>${esc(d.title)}</b>${openDone === d.id ? d.objectives.filter((o) => o.text).map((o) => `<small>&#10003; ${esc(o.text.replace(/\s*\(\{n\} of \{total\}\)/, '').replace(/ in \{time\} s/, ''))}</small>`).join('') : ''}</div><span class="tag">Done</span></div>`).join('');
    const el = $('tab-quests'); el.innerHTML = h;
    el.querySelectorAll('[data-track]').forEach((r2) => r2.addEventListener('click', () => { ms.track(r2.dataset.track); quests(); }));
    el.querySelectorAll('[data-open]').forEach((r2) => r2.addEventListener('click', () => { openDone = openDone === r2.dataset.open ? null : r2.dataset.open; quests(); }));
  }

  // ------------------------------------------------------------------ Codex: Minnow's book, the tablets, the trident forms, the outfits
  function codex() {
    const q = G.quest, c = q.collect, el = $('tab-codex');
    const tabs = [['creatures', `Creatures ${c.loggedCount()}/${c.entries.length}`], ['tablets', `Tablets ${c.foundCount()}/${c.relics.length}`], ['gear', 'Trident and outfits']];
    let h = `<div class="seg" style="margin:0 0 8px;flex-wrap:wrap">${tabs.map(([k, n]) => `<button class="btn2${k === codexTab ? ' on' : ''}" data-ct="${k}" style="flex:1">${esc(n)}</button>`).join('')}</div>`;
    if (codexTab === 'creatures') h += c.entries.map((e) => (c.logged[e.id] ? `<div class="row"><div class="g"><b>${esc(e.name)}</b><small>${esc(e.note)}</small></div></div>` : `<div class="row"><div class="g"><b>Not yet seen</b><small>${esc(e.hint || 'Swim near it to log it.')}</small></div></div>`)).join('');
    if (codexTab === 'tablets') h += c.relics.map((r) => (r.found ? `<div class="row"><div class="g"><b>${esc(r.title)}</b><small>${esc(r.text)}</small></div></div>` : `<div class="row"><div class="g"><b>A tablet not found</b><small>${esc(r.hint || 'Somewhere in the sea.')}</small></div></div>`)).join('');
    if (codexTab === 'gear') {
      const row = (g, kind, has, on) => `<div class="row"><div class="g"><b>${esc(has ? g.name : 'Not found')}</b><small>${esc(has ? g.note : g.hint || '')}</small></div>${has ? `<button class="btn2${on ? ' on' : ''}" data-eq="${kind}:${esc(g.id)}">${on ? 'Worn' : 'Wear'}</button>` : ''}</div>`;
      h += '<div class="sect">Trident forms</div>' + (DATA.gear.forms || []).map((g) => row(g, 'form', q.st.forms.includes(g.id), q.st.form === g.id)).join('');
      h += '<div class="sect">Outfits</div>' + (DATA.gear.outfits || []).map((g) => row(g, 'outfit', q.st.outfits.includes(g.id), q.st.outfit === g.id)).join('');
    }
    el.innerHTML = h;
    el.querySelectorAll('[data-ct]').forEach((b) => b.addEventListener('click', () => { codexTab = b.dataset.ct; codex(); }));
    el.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => { const [k, id] = b.dataset.eq.split(':'); q.equip(k, id); codex(); }));
  }

  // ------------------------------------------------------------------ Powers: spend pearls at a shrine
  function powers() {
    const q = G.quest, el = $('tab-powers'), at = q.atShrine(), list = DATA.upgrades.list || [], costs = DATA.upgrades.cost || [];
    let h = `<div class="row"><div class="g"><b>${at ? 'You are at a shrine' : 'Find a shrine to spend pearls'}</b><small>${q.pearlCount()} pearls · ${q.tablets()} tablets to lay at a shrine. A tablet you lay stays in your book.</small></div></div>`;
    for (const u of list) {
      if (u.needs && !G.hero.powers[u.needs]) continue;
      const lv = q.st.levels[u.id] || 0, c = costs[lv], can = at && c && q.pearlCount() >= c.pearls && q.tablets() >= (c.relics || 0);
      const pips = '●'.repeat(lv) + '○'.repeat(3 - lv);
      h += `<div class="row"><div class="g"><b>${esc(u.name)} <span style="color:var(--gold)">${pips}</span></b><small>${esc(c ? u.levels[lv] : 'Full strength')}</small></div>${c ? `<button class="btn2" data-up="${esc(u.id)}"${can ? '' : ' disabled'}>${c.pearls} pearls${c.relics ? `<br>${c.relics} tablet` : ''}</button>` : ''}</div>`;
    }
    if (q.missions.isDone('ch7')) h += `<div class="sect">The Storm Bell</div><div class="row"><div class="g"><b>Call the Storm Surge</b><small>The sea's waves, when you want them</small></div><button class="btn2" id="callStorm"${at && q.pearlCount() >= 10 ? '' : ' disabled'}>10 pearls</button></div>`;
    el.innerHTML = h;
    el.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => { q.upgrade(b.dataset.up); paint(); }));
    const st = $('callStorm'); if (st) st.addEventListener('click', () => { if (q.callStorm()) ui.setPause(false); });
  }

  // ------------------------------------------------------------------ Settings
  function settings() {
    const s = G.settings, el = $('tab-settings'), looks = (G.look && G.look.looks) || [], cur = G.look && G.look.lookName;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, n]) => `<button class="btn2${String(s[key]) === String(v) ? ' on' : ''}" data-set="${key}" data-v="${v}">${n}</button>`).join('')}</div>`;
    let h = '';
    if (looks.length > 1) h += `<div class="row"><div class="g"><b>Look</b><small>Switch it any time</small></div><div class="seg">${looks.map((l) => `<button class="btn2${l === cur ? ' on' : ''}" data-look="${esc(l)}">${esc((l[0].toUpperCase() + l.slice(1)).replace(/_/g, ' '))}</button>`).join('')}</div></div>`;
    h += `<div class="row"><div class="g"><b>Music</b></div><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-range="music" aria-label="Music volume"></div>`;
    h += `<div class="row"><div class="g"><b>Sound</b></div><input type="range" min="0" max="1" step="0.05" value="${s.sound}" data-range="sound" aria-label="Sound volume"></div>`;
    h += `<div class="row"><div class="g"><b>Camera speed</b></div><input type="range" min="0.4" max="1.8" step="0.1" value="${s.camera}" data-range="camera" aria-label="Camera speed"></div>`;
    h += `<div class="row"><div class="g"><b>Difficulty</b><small>Change it any time. Nothing is lost</small></div>${seg('difficulty', [['easy', 'Gentle'], ['normal', 'Normal'], ['hard', 'Hard']])}</div>`;
    h += `<div class="row"><div class="g"><b>Camera shake</b></div>${seg('shake', [[true, 'On'], [false, 'Off']])}</div>`;
    h += `<div class="row"><div class="g"><b>Bright flashes</b><small>Off softens every flash</small></div>${seg('flash', [[true, 'On'], [false, 'Reduced']])}</div>`;
    if (!canSave()) h += '<div class="row"><div class="g"><b>This browser is not keeping saves</b><small>Your progress lasts until you close the page.</small></div></div>';
    h += `<div class="row"><div class="g"><b>Boost</b><small>Toggle means one press, not a held thumb</small></div>${seg('toggleBoost', [[false, 'Hold'], [true, 'Toggle']])}</div>`;
    h += `<div class="row"><div class="g"><b>Climb in flight</b><small>Push the stick up to climb, or pull it back as in a flight sim</small></div>${seg('pitchPull', [[false, 'Push up'], [true, 'Pull back']])}</div>`;
    if (!TOUCH) {
      const names = { atk: 'Strike', dash: 'First power', spin: 'Second power', wave: 'Third power', p4: 'Fourth power', stance: 'Stance', parry: 'Parry', call: 'Call of the Deep', cast: 'Cast the trident', ride: 'Talk, ride, use', map: 'Map' };
      h += '<div class="sect">Keys</div>' + Object.keys(names).map((a) => `<div class="row"><div class="g"><b>${names[a]}</b></div><button class="btn2" data-key="${a}">${waiting === a ? 'Press a key' : esc(String(s.keys[a]).replace(/^Key|^Digit/, ''))}</button></div>`).join('');
    }
    h += `<div class="row"><div class="g"><b>Controls</b><small>${TOUCH ? 'Left thumb moves, wherever it lands on the left half. Drag on the right to look. Hold Boost, then leave the water at speed to leap. In a fight, a press of Boost is a dodge. As the man in red: hold Boost to run on the jets, Jump to take off, then hold Fly: the stick turns him and pushes up to climb, and letting go of Fly hovers, where the stick moves him. Talk, Shrine, Run and Ride come up beside the buttons when they apply.' : 'W A S D swim, or hold the left mouse button · mouse or arrow keys look · Shift boost, or hold both mouse buttons; tap it to dodge · Space and C up and down · click or J strike · right click or L parry · the four powers, stance, Call and the rest are printed on the buttons, and below · Esc pause · H how it was made'}</small></div></div>`;
    h += '<div class="row"><div class="g"><b>How it was made</b><small>The whole stack, free to copy</small></div><button class="btn2" id="stackP">Open</button></div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-look]').forEach((b) => b.addEventListener('click', () => { G.look.setLook(b.dataset.look, 0.6); settings(); }));
    el.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => { const v = b.dataset.v; s[b.dataset.set] = v === 'true' ? true : v === 'false' ? false : v; G.ui.applySettings(); settings(); G.quest.save(); }));
    el.querySelectorAll('[data-range]').forEach((r) => r.addEventListener('input', () => { s[r.dataset.range] = +r.value; G.ui.applySettings(); }));
    el.querySelectorAll('[data-range]').forEach((r) => r.addEventListener('change', () => G.quest.save()));
    el.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => { waiting = b.dataset.key; G.ui.captureKey(waiting); settings(); waiting = null; }));
    const sp = $('stackP'); if (sp) sp.addEventListener('click', () => ui.showPanel(true));
  }

  return { show, open() { show(tab); }, map, refresh: paint, get tab() { return tab; } };
}
