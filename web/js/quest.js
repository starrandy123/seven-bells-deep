// The game's memory and its running order: bells, pearls and chests, places named on arrival, the missions, the people, what the compass
// points at, fast travel, upgrades, saves. The rules of a mission are in missions.js; its words are in web/data. The first fight can't be lost.
import * as THREE from 'three';
import { W, FLAG, TOUCH } from './config.js';
import { DATA } from './data.js';
import { readSave, writeSave, clearSave, packBits, unpackBits, KEY as SAVE_KEY } from './save.js';
import { createPlaces } from './places.js';
import { createThings } from './things.js';
import { createMissions } from './missions.js';
import { createPeople } from './people.js';
import { createCollect } from './collect.js';
import { createEvents } from './events.js';
import { createOnboard } from './onboard.js';
import { createBotNav } from './botnav.js';
import { createCine, keepClear } from './cine.js';

const FOG_N = 128;   // the map's fog: FOG_N x FOG_N cells, one bit each
const keyOf = (a) => `${Math.round(a[0])}_${Math.round(a[1])}`;
const hashId = (t) => { let h = 7; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 9973; return h; };
const SLOT = { riptide: 'dash', maelstrom: 'spin', wave: 'wave', geyser: 'p4', lance: 'dash', glacier: 'spin', breath: 'wave', icepath: 'p4', call: 'call', guard: 'parry' };
const ICE = new Set(['lance', 'glacier', 'breath', 'icepath', 'guard']);
const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
const NOTE_TIPS = {
  leap: () => 'In the air, strike to drive down into the sea',
  super: () => 'Super speed: you break what you hit',
  land: (touch) => (touch ? 'Hold Boost to sprint. Jump is on the right' : 'Hold Shift to sprint, Space to jump'),
};

export function createQuest(G) {
  const data = G.world.data, h = G.hero, size = data.size_m || 1280, origin = data.origin || [-size / 2, -size / 2];
  const bellTable = (DATA.missions.bells || {});
  const shrineIds = DATA.missions.shrines || ['reef_shrine', 'kelp_shrine', 'deep_shrine'];

  const pearls = (data.pearls || []).map((a, i) => ({ i, key: keyOf(a), home: W(a[0], a[1], a[2]), p: W(a[0], a[1], a[2]), on: true }));
  const chests = (data.chests || []).map((a, i) => ({ i, key: keyOf(a), p: W(a[0], a[1], a[2]), yaw: a[3] || 0, on: true }));
  const pois = (data.poi || []).map((a) => ({ ...a, p: W(a.x, a.y, a.z), seen: false }));
  const spawnP = W(data.spawn.x, data.spawn.y, data.spawn.z), arena = data.arena ? W(data.arena.x, data.arena.y, data.arena.z) : null;
  const st = {
    taken: 0, spent: 0, kills: 0, relicsLaid: 0, checkpoint: spawnP.clone(), yaw: data.spawn.yaw || 0, gateOpen: false, won: false, first: true, tips: new Set(), cine: null, talk: null,
    cleared: new Set(), best: {}, levels: {}, forms: ['tide_fork'], form: 'tide_fork', outfits: ['warden'], outfit: 'warden', shrines: new Set(), playT: 0, saveT: 12, seated: false, loaded: null, botT: 0, fogT: 0,
  };
  const fog = new Uint8Array((FOG_N * FOG_N) >> 3);

  // ------------------------------------------------------------------ what you can see: pearls glow, chests sit, the bells hang
  const pSrc = G.props && G.props.pearl;
  const pMat = new THREE.MeshStandardMaterial({ color: 0xf6f1e6, emissive: 0x9fdcff, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1 });
  G.look.patch(pMat, {});
  const pearlMesh = new THREE.InstancedMesh(pSrc ? pSrc.geometry : new THREE.SphereGeometry(0.28, 14, 10), pMat, Math.max(1, pearls.length));
  pearlMesh.frustumCulled = false; G.scene.add(pearlMesh);
  const m4 = new THREE.Matrix4(), v1 = new THREE.Vector3(), qI = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), s0 = new THREE.Vector3(0.0001, 0.0001, 0.0001), eu = new THREE.Euler(), q1 = new THREE.Quaternion();
  function layPearls(t) {
    for (const a of pearls) { v1.copy(a.p); if (a.on) v1.y += Math.sin(t * 1.3 + a.i) * 0.14; m4.compose(v1, qI, a.on ? s1 : s0); pearlMesh.setMatrixAt(a.i, m4); }
    pearlMesh.instanceMatrix.needsUpdate = true;
  }
  const cSrc = G.props && G.props.chest;
  const chestMesh = cSrc ? new THREE.InstancedMesh(cSrc.geometry, cSrc.material, Math.max(1, chests.length)) : null;
  if (chestMesh) { chestMesh.frustumCulled = false; G.scene.add(chestMesh); }
  function layChests() {
    if (!chestMesh) return;
    for (const c of chests) { eu.set(0, c.yaw, 0); q1.setFromEuler(eu); m4.compose(c.p, q1, c.on ? s1 : s0); chestMesh.setMatrixAt(c.i, m4); }
    chestMesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ the pieces
  const places = createPlaces(G);
  const things = G.things = createThings(G);

  const worldBells = data.bells || [];
  const bells = worldBells.map((b) => ({ ...b, p: W(b.x, b.y, b.z), rung: false }));
  for (const id in bellTable) {
    if (bells.some((b) => b.id === id) || !bellTable[id].at) continue;
    const pl = places.resolve(bellTable[id].at, 1.6);
    bells.push({ id, name: bellTable[id].bell, x: pl.x, y: pl.y, z: pl.z, p: pl.p, rung: false, ours: true });
  }
  const bellSrc = G.props && G.props.bell, bellMat = bellSrc ? bellSrc.material : new THREE.MeshStandardMaterial({ color: 0xc99a3f, metalness: 0.9, roughness: 0.32 });
  if (!bellSrc) G.look.patch(bellMat, {});
  for (const b of bells) {
    b.mesh = new THREE.Mesh(bellSrc ? bellSrc.geometry : new THREE.SphereGeometry(1.4, 16, 12), bellMat);
    b.mesh.position.copy(b.p); G.scene.add(b.mesh); b.swing = 0;
  }
  const rungCount = () => bells.filter((b) => b.rung).length;
  const lampsLit = () => { if (G.world.setLampsLit) G.world.setLampsLit(bells.length ? rungCount() / bells.length : 0); };

  // the Q handed to every part
  const Q = {
    tmp: new THREE.Vector3(), tmp2: new THREE.Vector3(),
    m: () => missions,
    place: (s, r) => places.resolve(s, r),
    things,
    talking: () => !!st.talk,
    bark: (who, text, sec = 5) => G.ui.bark(who ? people.nameOf(who) : '', text, sec),
    dialogue, milestone, give, timer: (s, label, up) => G.ui.timer(s, label, up),
    openGate, checkpoint, safeHere, weather, credits, chapterCard, finished, standDown, clearCourt, refreshRuns: () => refreshRuns(),
    enc: (id) => G.enemies.encounters.find((e) => e.id === id) || null,
    encDone: (e) => e.cleared || (e.tied_to && api.isRung(e.tied_to)),
    spawn: spawnEnc, unspawn: unspawnEnc, unstick,
    boss: (id) => (G.bosses && G.bosses[id]) || (id === 'leviathan' ? G.boss : null),
    bell: (id) => bells.find((b) => b.id === id) || null,
    spots, ringPath, pop, best, value, nearestOf, isNight, face, nearestWhale, route: (a, b) => nav.route(a, b), canUse, wakeBoss, scene,
    stanceFor: (what) => { if (ICE.has(what) && document.body.dataset.stance && document.body.dataset.stance !== 'ice') G.ui.pulse('stance', 8); },     // an Ice drill in the Water stance: the button says so
  };
  const missions = createMissions(G, Q);
  const people = G.people = createPeople(G, Q);
  Q.people = people; Q.followers = things.followers;
  const collect = G.collect = createCollect(G, Q);
  const events = G.events = createEvents(G, Q);
  const onboard = G.onboard = createOnboard(G, Q);
  const cine = G.cine = createCine(G);
  const nav = createBotNav(G);
  // the settings' promise: every power flash goes through here, so "reduced flashing" holds for all of them
  {
    const flash = G.look.flash; let last = -9;
    G.look.flash = (p, c, r, life) => {
      if (G.settings && G.settings.flash === false) { if (G.time - last < 0.34) return; last = G.time; flash(p, c, (r || 8) * 0.6, (life || 0.35) * 1.6); } else flash(p, c, r, life);
    };
    const shake = G.shake; G.shake = (a) => { if (!G.settings || G.settings.shake !== false) shake(a); };
  }

  // ------------------------------------------------------------------ small things the data asks for
  function spots(o, m) {
    if (o.at) return [].concat(o.at).map((s) => places.resolve(s, 0.6));
    const seed = hashId(m.def.id + m.i), out = [];
    for (let i = 0; i < (o.n || 3); i++) out.push(places.resolve({ ...(typeof o.around === 'string' ? { poi: o.around } : o.around), dir: (seed + i * 137.5) % 360, dist: (o.spread || 24) * (0.55 + (((i * 7 + seed) % 10) / 10) * 0.45), ground: o.ground === undefined ? 1.4 : o.ground, water: !o.onLand }, o.item === 'net' ? 3 : 1.2));
    return out;
  }
  // rings along a smooth line through named places, each facing along the line
  function ringPath(o) {
    const via = (o.via || []).map((s) => places.resolve(s).p.clone());
    if (via.length < 2) via.push(via[0].clone().add(new THREE.Vector3(120, 0, 0)));
    const line = new THREE.CatmullRomCurve3(via), out = [], n = o.n || 12;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), p = line.getPointAt(t), f = line.getTangentAt(t).clone(), g = G.world.heightAt(p.x, -p.z);
      if (o.surface) { p.y = Math.max(0.8, g + 1); f.y = 0; f.normalize(); } else p.y = Math.min(Math.max(p.y, g + (o.over || 7)), -3);
      if (o.surface && g > -2.5) continue;                              // a surf ring over rock can't be surfed
      const b = { x: p.x, y: -p.z, z: p.y }; G.world.collide(b, 2); out.push({ p: W(b.x, b.y, b.z), face: f });
    }
    out.len = line.getLength();
    return out;
  }
  function pop(p, item) { G.audio.pearl(); G.fx.sparks(p, 16, item === 'ember' ? 0xffa04a : 0xffe9b8, 5); G.look.flash(p, 0xffe9b8, 6, 0.3); }
  function best(id, t, higher) {
    const was = st.best[id], better = was === undefined || (higher ? t > was : t < was);
    if (better) st.best[id] = t;
    st.lastRun = { id, t, better, was };
    return better;
  }
  function value(what) {
    if (what === 'pearls') return st.taken;
    if (what === 'relics') return collect.foundCount();
    if (what === 'species') return collect.loggedCount();
    if (what === 'chests') return chests.filter((c) => !c.on).length;
    if (what === 'kills') return st.kills;
    return 0;
  }
  function nearestOf(what) {
    if (what === 'relics') return collect.nearestRelic();
    if (what === 'species') return collect.nearestUnlogged();
    if (what === 'chests') return nearestOn(chests);
    return nearestOn(pearls);
  }
  function nearestWhale() { let b = null, bd = 1e12; for (const w of (G.life && G.life.whales) || []) { const p = w.pos || w.position, d = p.distanceToSquared(h.pos); if (d < bd) { bd = d; b = p; } } return b; }
  function nearestOn(list) { let b = null, bd = 1e12; for (const a of list) { if (!a.on || a.botSkip) continue; const d = a.p.distanceToSquared(h.pos); if (d < bd) { bd = d; b = a.p; } } return b; }
  function isNight() {
    if (G.sky && typeof G.sky.isNight === 'function') return G.sky.isNight();
    return ((G.time / 840) % 1) > 0.62;
  }
  function weather(name, secs) { if (G.sky && G.sky.setWeather) G.sky.setWeather(name, secs); }
  function face(p) { const yaw = Math.atan2(p.x - h.pos.x, p.z - h.pos.z); h.heading = yaw; G.camYaw = yaw; }
  function credits() { if (!scene('ending', h.pos.clone(), () => { st.panelAt = G.time + 0.6; })) st.panelAt = G.time + 2.5; }
  // a cinematic holds the Warden safe and gives him back; in the bot's runs there is none and this answers false
  function scene(id, focus, done, opts = {}) {
    const on = cine.play(id, { focus, bearing: opts.bearing, alt: opts.alt, done: () => { if (h.state === 'cine') h.cine(false); if (done) done(); } });
    if (on) h.cine(true);
    return on;
  }
  function wakeBoss(id, b) {
    if (b.active) return; b.wake();
    scene(`boss_${id}`, () => b.frame || b.head || b.pos || h.pos, null, { bearing: b.bearing ? b.bearing() : G.camYaw + Math.PI });
  }
  // a power that isn't in the game yet must never hold a chapter up
  function canUse(what) {
    if (ICE.has(what) && (!h.powers.ice || !document.body.dataset.stance)) return false;
    return !G.combat || !G.combat.has || !!G.combat.has(what);
  }
  function chapterCard(def) { G.ui.toast(def.card || `Chapter ${WORDS[def.chapter] || def.chapter}`, def.title, 5.5); }
  // A boss is the whole fight at its place: the court that stands there in free roam stays out of it, as combat's walls measured it, and the bell it guards is free when the boss falls
  function clearCourt(pl, r) { for (const e of G.enemies.encounters) if (!e.ours && !e.cleared && e.state === 'idle' && Math.hypot(e.x - pl.x, e.y - pl.y) < r) { e.cleared = true; st.cleared.add(e.id); } }
  function standDown() { for (const e of G.enemies.encounters) if (/^patrol_/.test(e.id) && e.state === 'idle') { e.cleared = true; st.cleared.add(e.id); } }
  function checkpoint(spec) { const pl = places.resolve(spec); st.checkpoint.copy(pl.p); st.yaw = h.heading; }
  function spawnEnc(id, g) {
    let e = Q.enc(id); if (e) { e.cleared = false; if (e.ours) { const a = places.resolve(g.at); e.c.copy(a.p); if (g.near) { e.c.lerp(h.pos, 0.6); e.c.y = Math.min(e.c.y, -2); } } return e; }
    const pl = places.resolve(g.at), c = pl.p.clone();
    if (g.near) { c.copy(h.pos).lerp(pl.p, 0.4); c.y = Math.min(c.y, -2); }
    e = { id, kind: g.kind || 'reaver', n: g.n || 3, r: g.r || 26, x: pl.x, y: pl.y, z: pl.z, tied_to: null, c, state: 'idle', list: [], cleared: false, cool: 0, ours: true };
    G.enemies.encounters.push(e); return e;
  }
  // A foe stranded behind rock is brought to the fight: an objective must never wait on a path nobody can find. Only out of the Warden's sight
  // line of play: he's in the water, they've been out of reach for twelve seconds.
  // A foe that can't reach him can't be fought, so a fight must never wait on one: 12 s out of reach, or close by with rock between them, and it comes round behind him
  const seeA = { x: 0, y: 0, z: 0 }, seeB = { x: 0, y: 0, z: 0 };
  function walled(e, d, dt) {           // rock or ice between them, read twice a second
    if ((e.seeT = (e.seeT || 0) - dt) <= 0) {
      e.seeT = 0.5; seeA.x = h.pos.x; seeA.y = -h.pos.z; seeA.z = h.pos.y; seeB.x = e.pos.x; seeB.y = -e.pos.z; seeB.z = e.pos.y;
      e.walled = d < 30 && !!G.world.sweep(seeA, seeB, 0.4);
    }
    return e.walled;
  }
  function unstick(enc, dt) {
    if (h.land || h.air || !enc.list) return;
    for (const e of enc.list) {
      if (e.hp <= 0) continue;
      const d = e.pos.distanceTo(h.pos);
      if ((d < 14 && !walled(e, d, dt)) || d > (enc.r || 30) + 110) { e.far = 0; continue; }
      if ((e.far = (e.far || 0) + dt) < 12) continue;
      e.far = 0; const a = G.camYaw + Math.PI + (Math.random() - 0.5) * 1.6, p = { x: h.pos.x + Math.sin(a) * 10, y: -(h.pos.z + Math.cos(a) * 10), z: h.pos.y - 1 };
      G.world.collide(p, 1); if (G.world.heightAt(p.x, p.y) < -3) { e.pos.set(p.x, Math.min(p.z, -1.5), -p.y); e.vel.set(0, 0, 0); }
    }
  }
  function unspawnEnc(e) { const a = G.enemies.encounters, i = a.indexOf(e); if (i >= 0 && !e.list.length) a.splice(i, 1); }

  function give(r = {}, silent) {
    const said = [];
    if (r.pearls) { st.taken += r.pearls; said.push(`${r.pearls} pearls`); }
    if (r.power) { h.powers[r.power] = true; G.ui.unlock(r.power); }
    if (r.stance) { h.powers[r.stance] = true; if (G.combat && G.combat.unlockStance) G.combat.unlockStance(r.stance); G.ui.unlock(r.stance); G.ui.pulse('stance', 8); G.ui.tip(TOUCH ? 'New button: Stance. Tap to switch' : 'X to switch stance', 6); }
    if (r.form && !st.forms.includes(r.form)) { st.forms.push(r.form); const g = gearOf(r.form); if (g) said.push(g.name); }
    if (r.outfit && !st.outfits.includes(r.outfit)) { st.outfits.push(r.outfit); const g = gearOf(r.outfit); if (g) said.push(g.name); }
    if (r.relic) collect.grant(r.relic);
    return silent ? [] : said;
  }
  const gearOf = (id) => [...(DATA.gear.forms || []), ...(DATA.gear.outfits || [])].find((g) => g.id === id) || null;
  function finished(def, m) {
    const said = give(def.reward || {});
    G.audio.bell && def.kind === 'story' && G.audio.pearl();
    if (def.kind === 'story') G.ui.done(`Chapter ${WORDS[def.chapter] || ''} complete`, def.title, said);
    else if (def.kind === 'event') G.ui.done('Event over', def.title, said);
    else if (def.kind === 'challenge') {
      const run = st.lastRun; G.ui.done(run && run.better ? 'New best' : 'Run complete', def.title, [run ? timeText(run.t) : '', ...said].filter(Boolean));
    } else G.ui.done('Mission complete', def.title, said);
    milestone();
  }
  const timeText = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };

  // ------------------------------------------------------------------ talk
  function dialogue(id, done, opts = {}) {
    const lines = DATA.dialogue[id];
    if (!lines || !lines.length) { console.warn('no dialogue', id); if (done) done(); return; }
    st.talk = { id, lines, i: -1, done, npc: opts.npc || null, t: 0 };
    G.ui.lock(true); talkNext();
  }
  function talkNext() {
    const t = st.talk; if (!t) return;
    t.i++;
    if (t.i >= t.lines.length) { talkEnd(); return; }
    const [who, text] = t.lines[t.i];
    G.ui.talkLine(people.nameOf(who), text, people.portrait(who), t.i + 1 < t.lines.length); G.audio.bubble();
  }
  function talkEnd() {
    const t = st.talk; st.talk = null; G.ui.lock(false); G.ui.talkLine(null);
    if (t && t.done) t.done();
    milestone();
  }

  // ------------------------------------------------------------------ the bells
  function ring(b) {
    b.rung = true; b.swing = 1; st.first = false;
    const P = bellTable[b.id] || {};
    if (P.key) { h.powers[P.key] = true; G.ui.unlock(P.key); }
    h.hp = h.maxHp; h.tide = h.maxTide;
    G.audio.bell(); G.look.flash(b.p, 0xffe9b8, 60, 1.4); G.shake(0.7); G.hitstop = 0.2;
    G.fx.ring(b.p.clone(), 160, 3.4, 0xffe9b8, new THREE.Vector3(0, 1, 0)); G.fx.ring(b.p.clone(), 46, 1.6, 0x7ff3ff, new THREE.Vector3(0, 0, 1));
    if (G.life) G.life.scatter(b.p, 60);
    lampsLit();
    st.checkpoint.copy(b.p).add(new THREE.Vector3(0, 2, 4)); st.yaw = h.heading; G.enemies.clearAll();
    const bearing = Math.atan2(h.pos.x - b.p.x, h.pos.z - b.p.z);
    if (scene(`bell_${b.id}`, b.p.clone(), null, { bearing, alt: 'bell' })) { if (h.playOnce) h.playOnce('victory'); }
    else { st.cine = { t: 0, dur: 3.6, focus: b.p.clone(), a: bearing, r: 15 }; h.cine(true); if (h.playOnce) h.playOnce('victory'); }
    if (P.name) { G.ui.toast(P.name, P.how || '', 5.5); if (P.key) onboard.teach(P.key, P); }
    milestone();
  }
  function openGate() { if (st.gateOpen) return; st.gateOpen = true; if (G.world.setGateOpen) G.world.setGateOpen(true); G.audio.roar(); }

  // ------------------------------------------------------------------ fast travel and shrines
  const shrinePlaces = shrineIds.map((id) => ({ id, pl: places.has(id) ? places.resolve(id) : null, poi: places.poi(String(id).split('|').find((x) => places.poi(x)) || '') })).filter((s) => s.pl);
  function travel(id) {
    const s = shrinePlaces.find((x) => x.id === id); if (!s || !st.shrines.has(id)) return false;
    if (G.boss && G.boss.active) { G.ui.setPause(false); G.ui.tip('Not while it can see you', 3); return false; }
    G.ui.fade(true); G.ui.setPause(false);
    st.travelAt = G.time + 0.75; st.travelTo = s.pl.p.clone(); st.travelTo.y += 3;
    return true;
  }

  // a seat on land stands on it; a seat in the water swims
  function footing() {
    h.ride = null;                                                     // a whale doesn't come with him
    const g = G.world.heightAt(h.pos.x, -h.pos.z);
    if (g > -0.7) { h.land = true; h.grounded = true; h.air = false; h.pos.y = g + 0.92; } else { h.land = false; h.grounded = false; h.air = false; if (h.pos.y > -1.2) h.pos.y = -1.2; }
  }
  // the last safe place he stood: a death costs a swim, never a step of the story
  function safeHere() { if (!h.dead && !h.air && !G.enemies.alive().length && Number.isFinite(h.pos.x + h.pos.y + h.pos.z)) { st.checkpoint.copy(h.pos); st.yaw = h.heading; } }

  // ------------------------------------------------------------------ the map's fog of war
  function reveal() {
    const R = 7, cx = Math.floor(((h.pos.x - origin[0]) / size) * FOG_N), cy = Math.floor(((-h.pos.z - origin[1]) / size) * FOG_N);
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (x < 0 || y < 0 || x >= FOG_N || y >= FOG_N || (x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
      const i = y * FOG_N + x; fog[i >> 3] |= 1 << (i & 7);
    }
  }
  const fogAt = (x, y) => { const i = y * FOG_N + x; return (fog[i >> 3] >> (i & 7)) & 1; };

  // ------------------------------------------------------------------ the save: everything a returning player had
  function pack() {
    return {
      v: 2, at: Date.now(),
      player: { x: h.pos.x, y: h.pos.y, z: h.pos.z, yaw: G.camYaw, pitch: G.camPitch, land: !!h.land },
      checkpoint: { x: st.checkpoint.x, y: st.checkpoint.y, z: st.checkpoint.z, yaw: st.yaw },
      chapter: missions.chapter(), won: st.won, first: st.first, gate: st.gateOpen,
      missions: missions.pack(),
      bells: bells.filter((b) => b.rung).map((b) => b.id), powers: Object.keys(h.powers).filter((k) => h.powers[k]),
      pearls: pearls.filter((a) => !a.on).map((a) => a.key), chests: chests.filter((c) => !c.on).map((c) => c.key), taken: st.taken, spent: st.spent, kills: st.kills, relicsLaid: st.relicsLaid,
      cleared: [...st.cleared], seen: pois.filter((p) => p.seen).map((p) => p.id), shrines: [...st.shrines],
      levels: st.levels, best: st.best, forms: st.forms, form: st.form, outfits: st.outfits, outfit: st.outfit,
      collect: collect.pack(), moved: people.packMoves(), heard: people.packHeard(), events: events.pack(), onboard: onboard.pack(), fog: packBits(fog), play: Math.round(st.playT),
      settings: G.settings, screen: G.ui.screen ? G.ui.screen() : 'play',
    };
  }
  function save() {
    if (G.film || FLAG.demo || !G.started) return false;
    return writeSave(pack());
  }
  function milestone() { st.saveT = Math.min(st.saveT, 0.4); }

  // an old save (the first night's build) kept its pearls by index and knew three bells
  function migrate(s) {
    if (!s || s.v === 2) return s;
    const rec = {}, story = missions.story, bellsRung = s.b || [];
    const has = (m) => m.objectives.filter((o) => o.type === 'ring').every((o) => bellsRung.includes(o.bell));
    for (const m of story) { if (s.w || (m.objectives.some((o) => o.type === 'ring') && has(m))) rec[m.id] = { st: 'done', n: 1 }; else break; }
    const next = story.find((m) => !rec[m.id]); if (next) rec[next.id] = { st: 'active', i: 0, n: 0, s: {} };
    return {
      v: 2, bells: bellsRung, won: !!s.w, first: !bellsRung.length, missions: { rec, tracked: next ? next.id : null },
      pearls: (s.p || []).map((i) => pearls[i] && pearls[i].key).filter(Boolean), chests: (s.c || []).map((i) => chests[i] && chests[i].key).filter(Boolean),
      taken: (s.p || []).length + (s.c || []).length * 3,
      powers: bellsRung.map((id) => (bellTable[id] || {}).key).filter(Boolean),
    };
  }

  const tintOf = (id) => ((DATA.gear.outfits || []).find((o) => o.id === id) || {}).tint;
  function applyLevels() { if (G.combat && G.combat.applyUpgrades) G.combat.applyUpgrades(st.levels); if (h.setSpeedLevel) h.setSpeedLevel(st.levels.speed || 0); }
  // every field defaults: a new game is this with nothing in it, and an old save is never thrown on
  function applyState(raw) {
    const s = migrate(raw) || {};
    st.loaded = raw ? s : null;
    // nothing of the game before this one stays on the board
    if (G.enemies.clearAll) G.enemies.clearAll();
    { const list = G.enemies.encounters; for (let i = list.length - 1; i >= 0; i--) if (list[i].ours) list.splice(i, 1); }
    if (G.boss) { if (G.boss.active && G.boss.stop) G.boss.stop(); const lev = (G.bosses && G.bosses.leviathan) || G.boss; G.boss = lev; lev.dead = !!s.won; if (!s.won) lev.hp = lev.maxHp; }
    st.talk = null; G.ui.lock(false); G.ui.talkLine(null); if (cine.active) cine.stop(true); st.cine = null;
    const pk = new Set(s.pearls || []), ck = new Set(s.chests || []);
    for (const a of pearls) { a.p.copy(a.home); a.on = !pk.has(a.key); }
    for (const c of chests) c.on = !ck.has(c.key);
    st.taken = s.taken || 0; st.spent = s.spent || 0; st.kills = s.kills || 0; st.relicsLaid = s.relicsLaid || 0; st.won = !!s.won; st.first = s.first === undefined ? true : !!s.first;
    st.best = s.best || {}; st.levels = s.levels || {}; st.forms = s.forms || ['tide_fork']; st.form = s.form || 'tide_fork'; st.outfits = s.outfits || ['warden']; st.outfit = s.outfit || 'warden';
    st.playT = s.play || 0; st.tips.clear(); st.cleared = new Set(s.cleared || []); st.shrines = new Set(s.shrines || []);
    const rung = new Set(s.bells || []); for (const b of bells) b.rung = rung.has(b.id);
    for (const k in h.powers) h.powers[k] = false;
    if (G.ui.lockPowers) G.ui.lockPowers();
    for (const k of s.powers || []) { h.powers[k] = true; G.ui.unlock(k); }
    const seen = new Set(s.seen || []); for (const p of pois) p.seen = seen.has(p.id);
    fog.fill(0); if (s.fog) unpackBits(s.fog, fog);
    for (const e of G.enemies.encounters) e.cleared = st.cleared.has(e.id);
    people.reset(); people.unpackMoves(s.moved); people.unpackHeard(s.heard);
    collect.unpack(s.collect || {}); events.unpack(s.events || {}); onboard.unpack(s.onboard || {});
    if (s.checkpoint) { st.checkpoint.set(s.checkpoint.x, s.checkpoint.y, s.checkpoint.z); st.yaw = s.checkpoint.yaw || 0; } else { st.checkpoint.copy(spawnP); st.yaw = data.spawn.yaw || 0; }
    missions.unpack(s.missions || {});
    if (!missions.active.length && !Object.keys(s.missions ? s.missions.rec || {} : {}).length && missions.story[0]) missions.start(missions.story[0].id);
    st.gateOpen = false; if (s.gate) { st.gateOpen = true; if (G.world.setGateOpen) G.world.setGateOpen(true); } else if (G.world.setGateOpen) G.world.setGateOpen(false);
    lampsLit(); layPearls(0); layChests();
    applyLevels();
    if (h.setForm) h.setForm(st.form); if (h.setOutfit) h.setOutfit(st.outfit, tintOf(st.outfit));
    st.seated = false;
    if (G.settings && s.settings) G.ui.applySettings(s.settings);
    if (G.started && s.screen && s.screen !== 'play') G.ui.openScreen(s.screen);      // land them on the screen they left
  }
  function seat() {      // every session starts at sea, where the title shows him: his word, 1 Nov. A save keeps what he's done, never where he stood
    st.seated = true; h.ride = null;
  }

  if (G.sky) G.sky.onBolt = () => { st.thunderAt = G.time + 0.5 + Math.random() * 1.4; };
  addEventListener('pagehide', () => save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  // ------------------------------------------------------------------ the fixed step
  function arrive(dt) {
    for (const p of pois) {
      if (p.seen || p.p.distanceTo(h.pos) >= (p.r || 80)) continue;
      p.seen = true; if (p.id !== 'spawn' && p.id !== 'reef') G.ui.place(p.name); milestone(); missions.fire('arrive', p.id);
    }
    for (const s of shrinePlaces) {
      if (st.shrines.has(s.id) || s.pl.p.distanceTo(h.pos) > 30) continue;
      st.shrines.add(s.id); G.ui.tip('Shrine found. You can return here from the map', 4); milestone();
    }
    if ((st.fogT -= dt) <= 0) { st.fogT = 0.4; reveal(); }
  }

  let pearlT = 0, objectiveText = null, hintLabel = null;
  const finite = (v) => Number.isFinite(v.x + v.y + v.z);
  // A net, not a fix: a body that has lost his place (NaN) goes back to his last safe spot, and the console says so, so the bug behind it doesn't stay hidden
  function guard() {
    if (finite(h.pos)) return;
    st.lost = (st.lost || 0) + 1; const m = missions.tracked;
    console.error(`[guard] the Warden lost his place: ${st.lost} so far, state ${h.state}, ${m ? `${m.def.id}.${m.i}` : 'no mission'}, at ${G.time.toFixed(1)} s, velocity ${h.vel.toArray().map((v) => +v.toFixed(2))}`);
    const safe = finite(st.checkpoint) ? st.checkpoint : spawnP;
    h.pos.copy(safe); h.prev.copy(safe); h.drawPos.copy(safe); h.vel.set(0, 0, 0); h.spd = 0; footing();
  }
  function step(dt) {
    guard();
    st.playT += dt;
    { const lev = G.bosses && G.bosses.leviathan; if (lev && G.boss !== lev && G.boss.dead && !G.boss.active) G.boss = lev; }       // G.boss means the Leviathan unless another is up
    if (st.respawnAt && G.time >= st.respawnAt) {
      st.respawnAt = 0; h.respawn(st.checkpoint, st.yaw); footing(); G.enemies.reset();
      if (G.boss && G.boss.active) { G.boss.stop(); G.audio.setMood('calm'); G.look.setMood('normal', 1); }
      G.ui.fade(false);
    }
    if (st.travelAt && G.time >= st.travelAt) {
      st.travelAt = 0; h.respawn(st.travelTo, h.heading); footing(); if (st.liftZ) { h.land = true; h.grounded = true; h.air = false; h.pos.y = st.liftZ + 0.92; st.liftZ = 0; } h.prev.copy(h.pos); h.drawPos.copy(h.pos); G.enemies.reset(); G.ui.fade(false);
      for (const f of things.followers.list) f.pos.copy(h.pos).add(new THREE.Vector3(2, 0, 2));
    }
    if (st.panelAt && G.time >= st.panelAt) { st.panelAt = 0; G.ui.showPanel(true); }
    if (st.cine) {
      st.cine.t += dt;
      if (st.cine.t >= st.cine.dur) { st.cine = null; h.cine(false); }
    }
    if (st.talk) { h.inv = Math.max(h.inv, 0.25); }
    if (st.thunderAt && G.time > st.thunderAt) { st.thunderAt = 0; G.audio.boom(); }      // the stroke first, then its sound, from however far off it fell
    cine.step(dt);
    for (const a of pearls) {
      if (!a.on) continue; const d = a.p.distanceTo(h.pos);
      if (d < 3.4) { a.p.lerp(h.pos, 1 - Math.exp(-9 * dt)); }
      if (d < 1.5) {
        a.on = false; st.taken++; G.audio.pearl(); G.fx.sparks(a.p, 10, 0xdff6ff, 4); milestone();
      }
    }
    for (const c of chests) {
      if (c.on && c.p.distanceTo(h.pos) < 2.6) {
        c.on = false; st.taken += 3; G.audio.pearl(); G.fx.sparks(c.p, 26, 0xffd98a, 6); G.look.flash(c.p, 0xffd98a, 8, 0.4); G.ui.tip('Treasure: three pearls', 2.6); layChests(); milestone();
      }
    }
    arrive(dt);
    missions.step(dt); people.step(dt); collect.step(dt); events.step(dt); things.followers.step(dt); onboard.step(dt);
    const near = bells.find((b) => !b.rung && b.p.distanceTo(h.pos) < 12);
    if (near && !st.tips.has(near.id)) { st.tips.add(near.id); G.ui.tip(guarded(near) ? 'Defeat the guardians, then strike the bell' : 'Strike the bell', 4); }
    if (arena && st.gateOpen && !st.won && G.boss && !G.boss.active && !G.boss.dead && !h.dead && arena.distanceTo(h.pos) < (data.arena.r || 45) * 0.8) { wakeBoss('leviathan', G.boss); st.checkpoint.copy(arena).add(new THREE.Vector3(0, 6, 22)); st.yaw = Math.PI; }
    for (const b of bells) { if (b.swing > 0) { b.swing = Math.max(0, b.swing - dt * 0.32); b.mesh.rotation.x = Math.sin(G.time * 5) * 0.22 * b.swing; } }
    const o = objective(); if (o !== objectiveText) { objectiveText = o; G.ui.objective(o); }
    if ((st.hintT = (st.hintT || 0) - dt) <= 0) { st.hintT = 0.12; const a = actHint(), label = a ? a.label : null; if (label !== hintLabel) { hintLabel = label; G.ui.context(label); } }
    if ((st.saveT -= dt) <= 0) { st.saveT = 15; save(); }
  }
  const guarded = (b) => G.enemies.encounters.some((e) => e.tied_to === b.id && !e.cleared && (e.state === 'awake' || e.n > 0));

  // what the context button would do here
  function actHint() {
    if (st.talk || st.cine) return null;
    const p = people.nearest(); if (p && (p.want.length || p.offer || (p.chat && p.chat.length) || (p.barks && p.barks.length))) return { label: 'Talk', go: () => people.talk(p.id) };
    for (const s of shrinePlaces) if (s.pl.p.distanceTo(h.pos) < 12) return { label: 'Shrine', go: () => { st.shrines.add(s.id); checkpointAt(s.pl.p); G.ui.openScreen('powers'); } };
    for (const def of missions.defs.values()) {
      if (def.kind !== 'challenge' || !missions.ready(def) || (missions.rec[def.id] && missions.rec[def.id].st === 'active')) continue;
      const pl = startOf(def); if (pl && pl.p.distanceTo(h.pos) < 12) return { label: 'Run', go: () => missions.start(def.id) };
    }
    // a ring of fire on each city's square of the Burnt Isle: it carries him between the ground and the city in the sky
    { const L = G.world.lifts || []; for (let i = 0; i < L.length; i++) { const a = L[i]; if (Math.hypot(a.x - h.pos.x, a.y + h.pos.z, (a.z - h.pos.y) * 0.5) < 5) { const b = L[(i + 1) % L.length]; return { label: b.z > a.z ? 'Rise' : 'Descend', go: () => { G.ui.fade(true); st.travelAt = G.time + 0.75; st.travelTo = W(b.x + 4.5, b.y, b.z + 1.2); st.liftZ = b.z; } }; } } }
    return null;
  }
  const startOf = (def) => (def.start ? places.resolve(def.start) : null);
  // a run waits at a gold ring until it's taken; it comes back when it's done
  const runMarks = new Map();
  function refreshRuns() {
    for (const def of missions.defs.values()) {
      if (def.kind !== 'challenge') continue;
      const open = missions.ready(def) && !(missions.rec[def.id] && missions.rec[def.id].st === 'active'), it = runMarks.get(def.id);
      if (open && !it) { const pl = startOf(def); if (pl) runMarks.set(def.id, things.add('ring', pl.p, { scale: 1.2 })); }
      if (!open && it) { things.remove(it); runMarks.delete(def.id); }
    }
  }
  function checkpointAt(p) { st.checkpoint.copy(p); st.checkpoint.y += 2; st.yaw = h.heading; }

  function target() {
    const t = missions.target(); if (t) return t;
    if (missions.tracked) return null;
    return G.boss && G.boss.active ? null : nearestOn(pearls);
  }
  function objective() {
    const t = missions.objectiveText(); if (t) return t;
    return 'Free roam: find every pearl';
  }

  function draw(t, dt = 1 / 60) {
    if (!st.seated && G.started) seat();                  // on the title he's at the spawn, in the light, and that is where he starts
    if (!G.started) cine.step(dt);
    if ((pearlT += 1) % 2 === 0) layPearls(t);
    things.update(t); things.omenStep(t, dt);
    things.beacon(st.talk || st.cine || cine.active || G.noBeacon ? null : target(), dt);
    if (cine.draw()) return;
    if (st.cine && G.camera) {
      const c = st.cine, f = c.t / c.dur, a = c.a + f * 1.1;
      camGoal.set(c.focus.x + Math.sin(a) * c.r, c.focus.y + 3 + f * 3, c.focus.z + Math.cos(a) * c.r); keepClear(G, camGoal, h.pos);
      G.camera.position.copy(camGoal); G.camera.lookAt(c.focus);
    } else if (st.talk && G.camera) talkCamera(dt);
  }
  const camGoal = new THREE.Vector3(), camLook = new THREE.Vector3();
  function talkCamera(dt) {
    const t = st.talk, cam = G.camera;
    if (t.npc) {
      const who = people.pos(t.npc.id); camLook.copy(who); camLook.y += 1.15;
      v1.subVectors(h.pos, who); v1.y = 0; const d = Math.max(v1.length(), 0.5); v1.multiplyScalar(1 / d);
      camGoal.copy(h.pos).addScaledVector(v1, 2.6); camGoal.y += 1.1; camGoal.x += v1.z * 1.0; camGoal.z -= v1.x * 1.0;
    } else {
      camLook.copy(h.pos); camLook.y += 0.4; camGoal.set(h.pos.x + Math.sin(G.camYaw + 2.6) * 3.6, h.pos.y + 0.9, h.pos.z + Math.cos(G.camYaw + 2.6) * 3.6);
    }
    keepClear(G, camGoal, h.pos); cam.position.lerp(camGoal, 1 - Math.exp(-5 * dt)); cam.lookAt(camLook);
  }

  // ------------------------------------------------------------------ the bot finishes what a player can: travel, talk, press
  const botStuck = { t: 0, p: new THREE.Vector3(), side: 0, sideT: 0, n: 0, out: new THREE.Vector3(), outT: 0, way: null, wayT: 0 };
  const botFight = { t: 0, kills: 0, hurt: 0 };
  // the fights are combat's own fighter's: it reads tells, parries, soaks and freezes, which the plain demo bot can't, and some foes need that
  let botFighter = null; if (FLAG.demo) import('./combat_bot.js').then((m) => { botFighter = m.createFighter(G, 'expert'); }).catch(() => {});
  function botDrive(u, dt) {
    if (st.talk) { if ((st.botT -= dt) <= 0) { st.botT = 0.2; api.talkTap(); } u.my = u.mx = u.ud = 0; u.boost = false; return true; }
    if (st.cine) { u.my = u.mx = u.ud = 0; u.boost = false; return true; }
    if (G.boss && G.boss.active) {
      // the Colossus's crust takes a tenth of a blow until its vents are capped: Frost Lance at each, then bot.js at the open core
      const B = G.boss; let v = null, vd = 1e9;
      if (B.vents && !(B.openT > 0) && h.powers.ice) for (const q of B.vents) { if (!q.l || q.l.capped || q.capped) continue; const d = q.p.distanceTo(h.pos); if (d < vd) { vd = d; v = q; } }
      if (botFighter) { botFighter.drive(u, dt); return true; }
      if (!v) return false;
      const dx = v.p.x - h.pos.x, dy = v.p.y + 2 - h.pos.y, dz = v.p.z - h.pos.z, f = Math.hypot(dx, dz);
      G.camYaw = Math.atan2(dx, dz); G.camPitch = Math.max(-1.1, Math.min(1.1, Math.atan2(dy, Math.max(f, 1)))); u.mx = 0; u.ud = 0; u.yaw = 0; u.pitch = 0; u.boost = false; u.my = f > 18 ? 1 : 0;
      h.tide = h.maxTide; botPower(u, 'lance'); return true;
    }
    let close = 1e9; for (const e of G.enemies.alive()) { const d = e.pos.distanceTo(h.pos); if (d < close && !walled(e, d, dt)) close = d; }     // what's under the ice can wait: a foe he can't get at isn't a fight
    if (close < 18) {                                                                 // a fight: bot.js swings, and a drill still asks for its power
      const d = close < 14 && missions.botPlan(); if (d && d.act === 'power' && d.power) { h.tide = h.maxTide; botPower(u, d.power); }
      let hurt = 0; for (const e of G.enemies.alive()) if (e.pos.distanceTo(h.pos) < 24) hurt += e.hp;
      if (botFight.kills !== st.kills || hurt < botFight.hurt - 0.5) botFight.t = 0;
      botFight.kills = st.kills; botFight.hurt = hurt;
      if ((botFight.t += dt) < 25) { if (botFighter) { botFighter.drive(u, dt); return true; } return false; }       // 25 s and nothing's been hurt: a foe he can't get at. The story doesn't wait on it
    } else botFight.t = 0;
    const plan = missions.botPlan() || (missions.tracked ? null : { goal: nearestOn(pearls), stand: 0 });
    if (botStuck.m !== missions.tracked) { botStuck.m = missions.tracked; botStuck.n = 0; botStuck.side = 0; botStuck.sideT = 0; }
    if (!missions.tracked && botStuck.n >= 5) { const a = pearls.find((x) => x.p === plan.goal); if (a) { a.botSkip = true; botStuck.n = 0; } }     // free roam: a pearl only a breach reaches isn't worth the rest of the run
    if (h.ride && !(plan && plan.hold)) u.ride = true;                                 // the whale has done its part: let go
    if (!plan) { u.my = 0; u.mx = 0; return true; }
    if (plan.use) return botUse(u, plan.use);
    if (plan.act === 'power' && plan.power && G.enemies.alive().some((e) => e.pos.distanceTo(h.pos) < 14)) botPower(u, plan.power);
    if (plan.hold || !plan.goal) { u.my = 0; u.mx = 0; u.boost = false; return true; }
    let wp = nav.next(plan.goal);
    // over something he can't get down through (an arch, a roof): out past its edge at the goal's depth, a different way each time, then in. Held for 3 s: it's a move, not a pull that orbits the goal
    if (botStuck.outT > 0) { botStuck.outT -= dt; wp = Q.tmp2.copy(botStuck.out); }
    else if (botStuck.n >= 2 && Math.hypot(plan.goal.x - h.pos.x, plan.goal.z - h.pos.z) < 12 && h.pos.y > plan.goal.y + 3 && !plan.goal.isLand) { const a = botStuck.n * 2.4; botStuck.out.set(plan.goal.x + Math.sin(a) * 24, plan.goal.y, plan.goal.z + Math.cos(a) * 24); botStuck.outT = 3; }
    // behind something he can't see round: a way out, walked cell by cell. On land round a fort's walls, in the water out of a slot under the ice or a hall with one door
    if (!botStuck.way && botStuck.n >= (h.land ? 3 : 4)) {
      botStuck.wet = !h.land; nav.backedOff(plan.goal); botStuck.way = h.land ? nav.local(plan.goal) : nav.wetWay(plan.goal);
      if (!h.land && botStuck.way.length < 4) botStuck.way = nav.backOff(plan.goal);                       // the walk found no way out: back up, and come at it from somewhere else
      botStuck.wayT = 25; botStuck.n = 0; botStuck.side = 0; botStuck.sideT = 0;
    }
    if (botStuck.way) {
      const way = botStuck.way, wet = botStuck.wet; botStuck.wayT -= dt;
      while (way.length && Math.hypot(way[0].x - h.pos.x, way[0].y + h.pos.z, wet ? way[0].z - h.pos.y : 0) < 3.2) way.shift();
      if (!way.length || botStuck.wayT <= 0 || h.land === wet) botStuck.way = null;
      else wp = Q.tmp2.set(way[0].x, wet ? way[0].z : G.world.heightAt(way[0].x, way[0].y) + 1, -way[0].y);
    }
    const dx = wp.x - h.pos.x, dz = wp.z - h.pos.z, flat = Math.hypot(dx, dz), total = plan.goal.distanceTo(h.pos);
    const lift = h.land || botStuck.outT > 0 || botStuck.way ? 0 : flat > 10 ? Math.min(40, botStuck.n * 5) : botStuck.n >= 2 ? Math.min(24, botStuck.n * 4) : 0;            // stuck behind rock or a hull's side: up and over, a little higher each time, and down again near the goal
    const dy = (lift ? Math.min(wp.y + lift, -1.5) : wp.y) - h.pos.y;
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    G.camYaw = wrap(G.camYaw + wrap(Math.atan2(dx, dz) + botStuck.side - G.camYaw) * (1 - Math.exp(-6 * dt)));
    const p = Math.atan2(dy, Math.max(flat, 1)); G.camPitch += (Math.max(-1.1, Math.min(1.1, p)) - G.camPitch) * (1 - Math.exp(-4 * dt));
    const stand = plan.stand || 0;
    u.my = total > stand + 0.4 ? 1 : 0; u.mx = 0; u.ud = 0; u.yaw = 0; u.pitch = 0; u.boost = !plan.slow && !botStuck.way && (total > 30 || (plan.fast && (h.vel.x * dx + h.vel.z * dz) > 0.7 * Math.hypot(h.vel.x, h.vel.z) * flat));      // at speed, only when he's headed at it: a goal he's missed isn't orbited at 48 m/s
    if (botStuck.way && botStuck.wet && flat < 2.5 && Math.abs(dy) > 1) { u.my = 0; u.ud = dy > 0 ? 1 : -1; G.camPitch *= 0.5; }      // straight up or down a shaft: the stick can't point there
    if (h.land && !h.air && (h.vel.length() < 0.5) && u.my) u.jump = true;
    // a wall in the way: a little while to one side, and up
    botStuck.t += dt;
    if (botStuck.t > 2) {
      const moved = botStuck.p.distanceTo(h.pos); botStuck.t = 0; botStuck.p.copy(h.pos);
      if (moved < 4 && u.my && botStuck.sideT <= 0) { botStuck.n++; botStuck.side = (botStuck.n % 2 ? -1 : 1) * 1.2; botStuck.sideT = Math.min(5, 1 + botStuck.n * 0.5); nav.stuck(); } else if (moved > 14) botStuck.n = Math.max(0, botStuck.n - 1);
    }
    if (botStuck.sideT > 0) { botStuck.sideT -= dt; if (botStuck.sideT <= 0) botStuck.side = 0; }
    if (total < 3 || st.talk) botStuck.n = 0;
    if (plan.act === 'talk') { const a = actHint(); if (a) a.go(); }
    if (plan.act === 'strike' && (st.botT -= dt) <= 0) { st.botT = 0.5; u.atk = true; }
    if (plan.act === 'ride') u.ride = true;
    if (plan.act === 'power' && plan.power && plan.goal.distanceTo(h.pos) < 9) { h.tide = h.maxTide; botPower(u, plan.power); }
    return true;
  }
  function botPower(u, what) {
    const want = ICE.has(what) ? 'ice' : 'water', st0 = document.body.dataset.stance;
    if (st0 && st0 !== want) { u.stance = true; return; }
    const k = SLOT[what]; if (k && (h.cool[k] === undefined || h.cool[k] <= 0)) u[k] = true;
    if (what === 'guard') { u.parry = true; api.note('power:guard'); }
  }
  function botUse(u, what) {
    u.my = 0.4; u.mx = 0; u.ud = 0; u.boost = false;
    if (what === 'boost' || what === 'super') { u.my = 1; u.boost = true; }
    if (what === 'leap') { u.my = 1; u.boost = true; G.camPitch = 1.0; }
    if (what === 'strike') u.atk = true;
    if (h.tide < h.maxTide) h.tide = h.maxTide;     // the bench doesn't wait for tide to fill
    if (h.cool[SLOT[what]] > 0 && (st.botT -= 1 / 60) > 0) return true;
    st.botT = 0.5; botPower(u, what);
    return true;
  }

  const api = {
    step, draw, target, save, pack, botDrive, missions, things, people, collect, events, places, bells, pearls, chests, pois, st, fogAt, FOG_N, shrinePlaces, timeText, nav, spots,
    debugRingAll() { for (const b of bells) { b.rung = true; const P = bellTable[b.id]; if (P && P.key) h.powers[P.key] = true; } h.powers.dash = h.powers.spin = h.powers.wave = h.powers.call = true; st.first = false; openGate(); },
    isRung: (id) => bells.some((b) => b.id === id && b.rung), rungCount, cineOn: () => !!(st.cine || st.talk || cine.active),
    titleShot() { if (!FLAG.demo && !FLAG.film) cine.play('opening', { title: true }); }, endTitle() { if (cine.title) cine.stop(true); },
    pearlCount: () => st.taken - st.spent, pearlTotal: () => pearls.length + chests.length * 3, tablets: () => collect.foundCount() - st.relicsLaid,
    // every count the Quests screen shows: done, of how many, and the one number that says how much of the sea is left
    progress() {
      const ds = [...missions.defs.values()], n = (k) => ds.filter((d) => d.kind === k), d = (k) => n(k).filter((x) => missions.isDone(x.id)).length;
      const rows = { story: [d('story'), n('story').length], people: [d('side'), n('side').length], challenges: [d('challenge'), n('challenge').length], tablets: [collect.foundCount(), collect.relics.length], creatures: [collect.loggedCount(), collect.entries.length],
        pearls: [pearls.filter((a) => !a.on).length, pearls.length], chests: [chests.filter((c) => !c.on).length, chests.length], forms: [st.forms.length, (DATA.gear.forms || []).length], outfits: [st.outfits.length, (DATA.gear.outfits || []).length] };
      let a = 0, b = 0; for (const k in rows) { a += rows[k][0]; b += rows[k][1]; }
      return { rows, pct: b ? Math.floor((a / b) * 100) : 0 };
    },
    hasSave: () => { if (st.handedBack) return true; const s = readSave(); return !!(s && !FLAG.fresh && !FLAG.demo && !FLAG.film && (s.v === 1 || s.play > 1 || (s.missions && Object.keys(s.missions.rec || {}).length > 1))); },
    newGame() { clearSave(); applyState(null); h.respawn(spawnP, data.spawn.yaw || 0); h.prev.copy(h.pos); h.drawPos.copy(h.pos); G.camYaw = data.spawn.yaw || 0; onboard.begin(); },
    apply: applyState,
    travel, act() { const a = actHint(); if (a) { a.go(); return true; } return false; },
    talkTap() { if (G.ui.talkTyping()) G.ui.talkFinish(); else talkNext(); }, talkSkip() { const t = st.talk; if (t) { t.i = t.lines.length; talkNext(); } },
    spareFirstFight: () => { if (!st.first) return false; G.look.flash(h.pos, 0x7ff3ff, 18, 0.6); G.fx.ring(h.pos.clone(), 16, 1, 0x7ff3ff); G.enemies.pull(h.pos, 14); G.ui.tip('The sea will not let you fall yet', 3.5); return true; },
    strike(p, reach, name) {
      missions.fire('strike', { p, reach, name });
      for (const b of bells) {
        if (b.rung || b.p.distanceTo(p) > reach + 5.5) continue;
        if (G.enemies.encounters.some((e) => e.tied_to === b.id && !e.cleared && (e.state === 'awake' || e.n > 0))) { G.ui.tip('The guardians still stir', 2.4); continue; }
        ring(b);
      }
    },
    note(what) {
      if (what === 'kill') st.kills++;
      missions.fire('note', what); onboard.note(what);
      if (st.tips.has(what) || !NOTE_TIPS[what]) return;
      st.tips.add(what); G.ui.tip(NOTE_TIPS[what](TOUCH), 4);
    },
    onEncounter(e) {
      G.audio.setMood('tense');
      // what the drowned garrison shouts, from the first fight: it only makes sense later
      const lines = DATA.missions.reaverBarks || [];
      if (e && e.kind !== 'shark' && lines.length && G.time > (st.reaverAt || 0)) { st.reaverAt = G.time + 40; G.ui.bark('A Reaver', lines[Math.floor(G.time * 3) % lines.length], 3.5); }
    },
    onEncounterCleared(e) {
      G.audio.setMood('calm'); st.first = st.first && !e.tied_to;
      if (e.tied_to) { st.cleared.add(e.id); G.ui.tip('The bell is free. Strike it', 4); }
      milestone();
    },
    onDeath() { G.ui.fade(true); st.respawnAt = G.time + 2.6; },
    onBossDead(id) {
      missions.fire('boss', id);
      if (id && id !== 'leviathan') return;
      st.won = true; if (h.playOnce) h.playOnce('victory'); G.audio.setMood('bright'); milestone();
    },
    // for the checks: put the story at a mission, a chapter or an event without playing there
    debugStart(id) { const m = missions.start(id, true); if (m) missions.track(id); return !!m; },
    debugEvent(id) { return !!events.fire(id, true); },
    upgrade(key) {
      const u = (DATA.upgrades.list || []).find((x) => x.id === key); if (!u) return false;
      const lv = st.levels[key] || 0, c = (u.cost || DATA.upgrades.cost)[lv]; if (!c) return false;
      if (api.pearlCount() < c.pearls || api.tablets() < (c.relics || 0)) return false;
      st.spent += c.pearls; st.relicsLaid += c.relics || 0; st.levels[key] = lv + 1;
      applyLevels();
      G.audio.pearl(); milestone(); return true;
    },
    atShrine: () => shrinePlaces.some((s) => s.pl.p.distanceTo(h.pos) < 14),
    // the sink that never fills: once the upgrades are full, pearls still buy the sea's biggest waves
    callStorm() { if (api.pearlCount() < 10 || events.running) return false; st.spent += 10; events.fire('e_surge', true); milestone(); return true; },
    equip(kind, id) {
      if (kind === 'form' && st.forms.includes(id)) { st.form = id; if (h.setForm) h.setForm(id); }
      if (kind === 'outfit' && st.outfits.includes(id)) { st.outfit = id; if (h.setOutfit) h.setOutfit(id, tintOf(id)); }
      milestone();
    },
  };

  // what the platform asks for on leaving and reopening (BACKEND.md §6r), and the checks' one door to a returning player
  window.getGameState = () => pack();
  window.loadGameState = (s) => {
    if (!s) return false;
    const fresher = !G.started || (s.play || 0) + 1 >= st.playT;   // what the host hands back may be older than what's in play: never go backwards (a record keeps whole seconds)
    if (fresher) { applyState(s); st.handedBack = true; writeSave(s); if (!G.started) G.ui.refreshTitle(); }      // never a reload: a page once shown stays
    return true;
  };

  for (const f of DATA.missions.fixtures || []) things.add(f.item, places.resolve(f.at).p, {});   // what stands in the world whatever the story's doing: the lamp on the harbour wall
  layPearls(0); layChests(); reveal();
  const saved = FLAG.fresh || FLAG.demo || FLAG.film ? null : readSave();
  applyState(saved);
  if (!saved) onboard.begin();
  // the port kit: this game's own keys go to the player's row, named so no other game's keys on a shared origin ever come along. A row that arrives
  // after the page is shown is taken in place: a page once shown is never reloaded
  if (window.MosaPort && !FLAG.demo && !FLAG.film) {
    try {
      window.MosaPort.init({ id: 'thalor', saves: [SAVE_KEY, 'thalor.look'], onSaves: () => {
        const s = readSave(); if (s && (s.play || 0) > st.playT) { applyState(s); if (!G.started) G.ui.refreshTitle(); }
      } });
    } catch (_) { /* the game plays without it */ }
  }
  return api;
}
