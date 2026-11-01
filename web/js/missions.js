// The mission engine. A mission is data (web/data/missions.json, challenges.json, events.json): a list of objectives, each one of the types
// below, with text, a place, what happens before and after, and a reward. Places come from world.json through places.js, never from here.
// A mission that never advances is a failure by name: every type has a `bot` answer, so the bot can finish everything a player can
// (web_check/g_story.mjs, g_side.mjs). Saved state lives in `m.s`; what can be rebuilt from data lives in `m.rt`, so a reload re-enters an
// objective where it stood.
import { DATA } from './data.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createMissions(G, Q) {
  const h = G.hero, defs = new Map(), story = [], rec = {}, flags = {};
  const add = (m, kind) => { m.kind = m.kind || kind; defs.set(m.id, m); return m; };
  for (const m of DATA.missions.story || []) story.push(add(m, 'story'));
  for (const m of DATA.missions.side || []) add(m, 'side');
  for (const m of DATA.challenges.list || []) add(m, 'challenge');
  for (const m of DATA.events.list || []) add(m, 'event');

  const active = [];          // live mission records, oldest first
  let tracked = null, scanT = 0;

  const cur = (m) => m.rt.o || m.def.objectives[m.i];
  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function near(pl, r) {
    const f = flat(h.pos, pl.p); if (f > r) return false;
    return pl.land ? true : Math.abs(h.pos.y - pl.p.y) < r + 14;
  }
  // the Arena has one way in: the gate first, then straight on
  function wayIn(m, o) {
    if (!o.gate || flat(h.pos, m.rt.pl.p) < 38) return m.rt.pl.p;
    const g = Q.place({ gate: true }).p; return flat(h.pos, g) < 5 ? m.rt.pl.p : g;
  }
  const pass = (m) => { m.passed = true; };
  const quiet = () => Q.talking() || (G.boss && G.boss.active);

  // ------------------------------------------------------------------ the objective types
  const OBJ = {
    goto: {
      begin(m, o) { m.rt.pl = Q.place(o.at); m.rt.r = o.r || clamp(m.rt.pl.r * 0.45, 6, 36); },
      step(m) { if (near(m.rt.pl, m.rt.r)) pass(m); },
      target: (m) => m.rt.pl.p,
      bot: (m) => ({ goal: m.rt.pl.p, stand: 0 }),
    },
    talk: {
      begin(m, o) { Q.people.want(o.npc, m, o); },
      step(m, o) { if (o.auto && !Q.talking() && Q.people.dist(o.npc) < (o.r || 10)) Q.people.talk(o.npc); },
      on(m, o, ev, a) { if (ev === 'talked' && a === m) pass(m); },
      leave(m, o) { Q.people.unwant(o.npc, m); },
      target: (m, o) => Q.people.pos(o.npc),
      bot: (m, o) => ({ goal: Q.people.pos(o.npc), stand: 2.6, act: Q.people.dist(o.npc) < 6 ? 'talk' : null }),
    },
    dialogue: {
      begin(m) { m.rt.open = false; },
      step(m, o) { if (!m.rt.open && !Q.talking()) { m.rt.open = true; Q.dialogue(o.id, () => pass(m)); } },
    },
    bark: { step(m, o) { Q.bark(o.who, o.say, o.sec || 5); pass(m); } },
    wait: { step(m, o, dt) { m.s.t = (m.s.t || 0) + dt; if (m.s.t >= o.t) pass(m); } },
    defeat: {
      begin(m, o) {
        m.rt.encs = [];
        const ids = [].concat(o.encounter || []);
        for (const id of ids) { const e = Q.enc(id); if (e) m.rt.encs.push(e); }
        if (!m.rt.encs.length) [].concat(o.spawn || []).forEach((g, i) => m.rt.encs.push(Q.spawn(`${m.def.id}.${m.i}.${i}`, g)));
      },
      step(m, o, dt) {
        let left = 0; for (const e of m.rt.encs) if (!Q.encDone(e)) { left++; Q.unstick(e, dt); }
        m.rt.left = left; if (!left) pass(m);
      },
      leave(m) { for (const e of m.rt.encs) if (e.ours) { e.cleared = true; Q.unspawn(e); } },     // given up, they don't come back on their own
      target(m) { const e = m.rt.encs.find((x) => !Q.encDone(x)); return e ? (e.list && e.list[0] ? e.list[0].pos : e.c) : null; },
      bot(m) { const e = m.rt.encs.find((x) => !Q.encDone(x)); return e ? { goal: e.list && e.list[0] ? e.list[0].pos : e.c, stand: 0 } : null; },
      vars: (m) => { let n = 0; for (const e of m.rt.encs) if (!Q.encDone(e)) n += Math.max(1, e.list ? e.list.length : 1); return { left: n }; },
    },
    boss: {
      begin(m, o) { m.rt.pl = Q.place(o.at); m.rt.r = o.r || 34; Q.clearCourt(m.rt.pl, 60); },
      step(m, o) {
        const b = Q.boss(o.boss); if (!b || b.dead) { pass(m); return; }
        if (!b.active && !h.dead && near(m.rt.pl, m.rt.r)) { if (o.gate) Q.openGate(); Q.wakeBoss(o.boss, b); }
      },
      on(m, o, ev, a) { if (ev === 'boss' && (a === o.boss || a === undefined)) pass(m); },
      target(m, o) { const b = Q.boss(o.boss); return b && b.active ? null : wayIn(m, o); },
      bot(m, o) { const b = Q.boss(o.boss); return b && b.active ? null : { goal: wayIn(m, o), stand: 0 }; },
    },
    ring: {
      begin(m, o) { m.rt.bell = Q.bell(o.bell); },
      step(m) { if (!m.rt.bell || m.rt.bell.rung) pass(m); },
      target: (m) => (m.rt.bell ? m.rt.bell.p : null),
      bot(m) {
        const b = m.rt.bell.p, d = b.distanceTo(h.pos), f = flat(h.pos, b);
        if (h.pos.y > b.y + 4 && f < 13) {                      // the shrine has a roof: out past its edge, then down and in
          const k = 13 / Math.max(f, 0.1); return { goal: Q.tmp.set(b.x + (h.pos.x - b.x) * k, b.y, b.z + (h.pos.z - b.z) * k), stand: 0 };
        }
        return { goal: b, stand: 2.4, act: d < 8.5 ? 'strike' : null };
      },
    },
    collect: {
      begin(m, o) {
        const spots = Q.spots(o, m); m.s.got = m.s.got || [];
        m.rt.spots = spots; m.rt.items = spots.map((p, i) => (m.s.got[i] ? null : Q.things.add(o.item || 'glint', p.p, o)));
      },
      step(m, o) {
        const reach = o.reach || 2.8, its = m.rt.items;
        for (let i = 0; i < its.length; i++) {
          if (!its[i] || m.rt.spots[i].p.distanceTo(h.pos) > reach) continue;
          m.s.got[i] = 1; Q.things.remove(its[i]); its[i] = null; Q.pop(m.rt.spots[i].p, o.item);
          if (o.each) Q.bark(o.each[0], o.each[1], 4);
        }
        if (its.every((x) => !x)) pass(m);
      },
      leave(m) { for (const it of m.rt.items) if (it) Q.things.remove(it); },
      target(m) { return nearestItem(m); },
      bot: (m) => ({ goal: nearestItem(m), stand: 0 }),
      vars: (m) => ({ n: m.rt.items.filter((x) => !x).length, total: m.rt.items.length }),
    },
    strike: {
      begin(m, o) { OBJ.collect.begin(m, o); },
      step(m) { if (m.rt.items.every((x) => !x)) pass(m); },
      on(m, o, ev, a) {
        // a plain cut needs the blow to land; a power counts where it was used, close enough that it would have reached
        const blow = ev === 'strike' && !o.with, power = ev === 'note' && o.with && a === `power:${o.with}`;
        if (!blow && !power) return;
        const from = blow ? a.p : h.pos, reach = blow ? a.reach + (o.reach || 2.2) : (o.reach || 2.2) + 8;
        const its = m.rt.items;
        for (let i = 0; i < its.length; i++) {
          if (!its[i] || m.rt.spots[i].p.distanceTo(from) > reach) continue;
          m.s.got[i] = 1; Q.things.remove(its[i]); its[i] = null; Q.pop(m.rt.spots[i].p, o.item);
          if (power) break;
        }
      },
      leave(m) { OBJ.collect.leave(m); },
      target: (m) => nearestItem(m),
      bot(m, o) { const g = nearestItem(m); return { goal: g, stand: 1.8, act: g && g.distanceTo(h.pos) < (o.with ? 9 : 4.5) ? (o.with ? 'power' : 'strike') : null, power: o.with }; },
      vars: (m) => OBJ.collect.vars(m),
    },
    count: {
      begin(m, o) { if (m.s.base === undefined) m.s.base = o.more ? Q.value(o.what) : 0; },
      step(m, o) { if (Q.value(o.what) - m.s.base >= o.n) pass(m); },
      target: (m, o) => Q.nearestOf(o.what),
      bot: (m, o) => { const g = Q.nearestOf(o.what); return g ? { goal: g, stand: 0 } : null; },
      vars: (m, o) => ({ n: Math.min(o.n, Q.value(o.what) - m.s.base), total: o.n }),
    },
    survive: {
      begin(m, o) { m.rt.pl = Q.place(o.at); m.rt.r = o.r || 40; m.rt.spawned = []; m.s.w = m.s.w || 0; m.s.t = m.s.t || 0; },
      step(m, o, dt) {
        if (near(m.rt.pl, m.rt.r)) {
          m.s.t += dt;
          const waves = o.waves || [];
          while (m.s.w < waves.length && waves[m.s.w].t <= m.s.t) { const w = waves[m.s.w]; m.rt.spawned.push(Q.spawn(`${m.def.id}.${m.i}.w${m.s.w}`, { ...w, at: o.at, near: true })); m.s.w++; }
        }
        Q.timer(Math.max(0, o.t - m.s.t), o.label || 'Hold');
        if (m.s.t >= o.t) pass(m);
      },
      leave(m) { Q.timer(null); for (const e of m.rt.spawned) Q.unspawn(e); },
      target: (m) => (near(m.rt.pl, m.rt.r) ? null : m.rt.pl.p),
      bot: (m) => ({ goal: m.rt.pl.p, stand: 6 }),
    },
    escort: {
      begin(m, o) {
        m.rt.to = Q.place(o.to); m.rt.r = o.r || 16;
        const from = m.s.p ? { x: m.s.p[0], y: m.s.p[1], z: m.s.p[2], free: true } : o.from;
        const at = Q.place(from || { x: h.pos.x, y: -h.pos.z, z: h.pos.y, free: true }).p;
        m.rt.f = Q.followers.add(o.who, at, o); m.rt.all = [m.rt.f];
        for (let i = 1; i < (o.n || 1); i++) m.rt.all.push(Q.followers.add(o.who, at, { ...o, gap: (o.gap || 4) + i * 3 }));
        m.rt.save = 0;
      },
      step(m, o, dt) {
        const f = m.rt.f; if ((m.rt.save -= dt) <= 0) { m.rt.save = 1; m.s.p = [f.pos.x, -f.pos.z, f.pos.y]; }
        if (m.rt.all.every((x) => flat(x.pos, m.rt.to.p) < m.rt.r)) pass(m);
      },
      leave(m) { for (const f of m.rt.all) Q.followers.remove(f); },
      target: (m) => (m.rt.f.pos.distanceTo(h.pos) > 40 ? m.rt.f.pos : m.rt.to.p),
      bot(m) { const f = m.rt.f, far = f.pos.distanceTo(h.pos); return far > 26 ? { goal: f.pos, stand: 6, slow: true } : { goal: m.rt.to.p, stand: 0, slow: true }; },
    },
    reachby: {
      begin(m, o) { m.rt.from = Q.place(o.from); m.rt.to = Q.place(o.to); m.rt.T = o.t || Math.ceil(Q.route(m.rt.from.p, m.rt.to.p) / (o.speed || 20)) + 6; m.s.on = false; m.rt.marks = [Q.things.add('ring', m.rt.from.p, { scale: 1.4 })]; },
      step(m, o, dt) {
        if (!m.s.on) {
          if (near(m.rt.from, o.startR || 12)) { m.s.on = true; m.s.left = m.rt.T; Q.bark(null, o.go || 'Go!', 2); G.audio.bubble(); for (const x of m.rt.marks) Q.things.remove(x); m.rt.marks = []; }
        } else {
          m.s.left -= dt; Q.timer(Math.max(0, m.s.left), o.label || 'Time');
          if (near(m.rt.to, o.r || 14)) pass(m);
          else if (m.s.left <= 0) { m.s.on = false; Q.timer(null); Q.bark(null, 'Too slow. Back to the start.', 3); m.rt.marks = [Q.things.add('ring', m.rt.from.p, { scale: 1.4 })]; }
        }
      },
      leave(m) { Q.timer(null); for (const x of m.rt.marks) Q.things.remove(x); },
      target: (m) => (m.s.on ? m.rt.to.p : m.rt.from.p),
      bot: (m) => ({ goal: m.s.on ? m.rt.to.p : m.rt.from.p, stand: 0 }),
      vars: (m) => ({ time: Math.ceil(m.s.on ? m.s.left : m.rt.T) }),
    },
    rings: {
      begin(m, o) {
        m.rt.path = Q.ringPath(o); m.s.i = 0; m.s.t = 0; m.rt.live = false;
        m.rt.items = m.rt.path.map((p, i) => Q.things.add('ring', p.p, { face: p.face, scale: i === 0 ? 1.3 : 1 }));
      },
      step(m, o, dt) {
        const path = m.rt.path, R = o.ringR || 7;
        if (m.rt.live) { m.s.t += dt; Q.timer(m.s.t, o.label || 'Run', true); }
        const a = path[m.s.i]; if (!a) { pass(m); return; }
        if (a.p.distanceTo(h.pos) < R) {
          Q.things.remove(m.rt.items[m.s.i]); m.rt.items[m.s.i] = null; G.audio.pearl();
          if (!m.rt.live) { m.rt.live = true; Q.bark(null, 'Go!', 1.6); }
          m.s.i++;
          if (m.s.i >= path.length) { m.rt.time = m.s.t; Q.best(m.def.id, m.s.t, o.more === 'more'); pass(m); }
        }
      },
      leave(m) { Q.timer(null); for (const it of m.rt.items) if (it) Q.things.remove(it); },
      target: (m) => (m.rt.path[m.s.i] ? m.rt.path[m.s.i].p : null),
      bot: (m) => ({ goal: m.rt.path[m.s.i] ? m.rt.path[m.s.i].p : null, stand: 0, fast: true }),
      vars: (m) => ({ n: m.s.i, total: m.rt.path.length }),
    },
    waves: {   // the arena: fight wave after wave; the score is how many you clear
      begin(m, o) { m.rt.pl = Q.place(o.at); m.rt.r = o.r || 46; m.s.w = 0; m.s.t = 0; m.rt.enc = null; },
      step(m, o, dt) {
        const list = o.list || [];
        if (!near(m.rt.pl, m.rt.r) && !m.rt.enc) return;
        m.s.t += dt; Q.timer(m.s.t, `Wave ${Math.min(list.length, m.s.w + 1)}`, true);
        if (!m.rt.enc) { const w = list[m.s.w]; m.rt.enc = Q.spawn(`${m.def.id}.w${m.s.w}`, { ...w, at: o.at, near: true }); }
        else Q.unstick(m.rt.enc, dt);
        if (m.rt.enc && Q.encDone(m.rt.enc)) {
          Q.unspawn(m.rt.enc); m.rt.enc = null; m.s.w++;
          if (m.s.w >= list.length) { m.rt.time = m.s.t; Q.best(m.def.id, m.s.t); pass(m); }
          else Q.bark(null, `Wave ${m.s.w + 1}`, 2);
        }
      },
      leave(m) { Q.timer(null); if (m.rt.enc) Q.unspawn(m.rt.enc); },
      target: (m) => (near(m.rt.pl, m.rt.r) ? null : m.rt.pl.p),
      bot(m) { const e = m.rt.enc, f = e && e.list && e.list.find((x) => x.hp > 0); return { goal: f ? f.pos : m.rt.pl.p, stand: f ? 2 : 10 }; },
      vars: (m, o) => ({ n: m.s.w, total: (o.list || []).length }),
    },
    ride: {   // the whales: take a fin and stay on
      step(m, o, dt) { if (h.ride) { m.s.t = (m.s.t || 0) + dt; Q.timer(Math.max(0, o.t - m.s.t), o.label || 'Ride'); } if ((m.s.t || 0) >= o.t) pass(m); },
      leave() { Q.timer(null); },
      target: () => Q.nearestWhale(),
      bot: () => (h.ride ? { hold: true } : { goal: Q.nearestWhale(), stand: 4, slow: false, act: h.nearWhale ? 'ride' : null }),
    },
    use: {   // one safe try of a power, or a move: done by doing it
      step(m, o) { if (!Q.canUse(o.what)) pass(m); },
      on(m, o, ev, a) { if (ev === 'note' && (a === o.what || a === `power:${o.what}`)) pass(m); },
      bot: (m, o) => ({ use: o.what }),
    },
    drill: {  // the second beat: the same power, harder, with foes on it
      begin(m, o) { m.s.n = m.s.n || 0; m.rt.encs = [].concat(o.spawn || []).map((g, i) => Q.spawn(`${m.def.id}.${m.i}.${i}`, g)); Q.stanceFor(o.power); },
      step(m, o, dt) {
        for (const e of m.rt.encs) Q.unstick(e, dt);
        const clear = m.rt.encs.every((e) => Q.encDone(e));
        if (m.s.n >= o.n || clear || !Q.canUse(o.power)) pass(m);
      },
      on(m, o, ev, a) { if (ev === 'note' && a === `power:${o.power}` && G.enemies.alive().some((e) => e.pos.distanceTo(h.pos) < 18)) m.s.n++; },
      target(m) { const e = m.rt.encs.find((x) => !Q.encDone(x)); return e ? e.c : null; },
      bot(m, o) { const e = m.rt.encs.find((x) => !Q.encDone(x)); return e ? { goal: e.list && e.list[0] ? e.list[0].pos : e.c, stand: 0, power: o.power, act: 'power' } : null; },
      vars: (m, o) => ({ n: Math.min(o.n, m.s.n), total: o.n }),
    },
  };

  function nearestItem(m) {
    let best = null, bd = 1e12;
    m.rt.items.forEach((it, i) => { if (!it) return; const d = m.rt.spots[i].p.distanceToSquared(h.pos); if (d < bd) { bd = d; best = m.rt.spots[i].p; } });
    return best;
  }

  // ------------------------------------------------------------------ what data can make happen
  function doAll(list) {
    for (const a of list || []) {
      if (a.flag) flags[a.flag] = 1;
      if (a.toast) G.ui.toast(a.toast[0], a.toast[1] || '', a.toast[2] || 5);
      if (a.tip) G.ui.tip(a.tip, 5);
      if (a.bark) Q.bark(a.bark[0], a.bark[1], a.bark[2] || 5);
      if (a.gate) Q.openGate();
      if (a.give) Q.give(a.give);
      if (a.start) start(a.start);
      if (a.checkpoint) Q.checkpoint(a.checkpoint);
      if (a.move) Q.people.move(a.move[0], a.move[1]);
      if (a.mood) G.audio.setMood(a.mood);
      if (a.water) G.look.setMood(a.water, a.secs || 2);
      if (a.weather) Q.weather(a.weather, a.secs || 3);
      if (a.cine) Q.scene(a.cine, h.pos.clone());
      if (a.credits) Q.credits();
      if (a.bosses === 'stand_down') Q.standDown();
    }
  }

  // ------------------------------------------------------------------ the life of a mission
  function enter(m, resume) {
    const def = m.def; let o = def.objectives[m.i];
    m.rt = {}; m.passed = false;
    if (o.type === 'boss' && !Q.boss(o.boss) && o.else) { o = { ...o.else, text: o.else.text || o.text }; m.rt.o = o; }
    if (!resume) doAll(o.before);
    const T = OBJ[o.type]; if (T && T.begin) T.begin(m, o);
    if (o.say && !resume) Q.bark(o.say[0], o.say[1], o.say[2] || 6);
    if (tracked === m) G.ui.objectiveChanged && G.ui.objectiveChanged();
  }
  function leave(m) { const o = cur(m), T = OBJ[o.type]; if (T && T.leave) T.leave(m, o); }
  function advance(m) {
    const o = cur(m); leave(m); if (m.def.kind === 'story') Q.safeHere(); doAll(o.after); m.i++; m.s = {};
    if (m.i >= m.def.objectives.length) finish(m); else enter(m);
    Q.milestone();
  }
  function finish(m) {
    const def = m.def, r = rec[def.id];
    r.st = 'done'; r.n = (r.n || 0) + 1; r.t = m.rt ? m.rt.time : undefined;
    active.splice(active.indexOf(m), 1);
    if (tracked === m) tracked = null;
    Q.finished(def, m);
    doAll(def.done);
    if (def.kind === 'story') { const i = story.indexOf(def), nx = story[i + 1]; if (nx) start(nx.id); }
    if (!tracked) tracked = active.find((x) => x.def.kind === 'story') || active[0] || null;
    if (tracked) G.ui.objectiveChanged && G.ui.objectiveChanged();
  }
  function start(id, force) {
    const def = defs.get(id); if (!def) { console.warn('no mission', id); return null; }
    const old = rec[id];
    if (old && old.st === 'active') return active.find((x) => x.def === def) || null;
    if (old && old.st === 'done' && !def.repeat) return null;
    if (!force && !ready(def)) return null;
    rec[id] = { st: 'active', i: 0, n: old ? old.n || 0 : 0 };
    const m = { def, i: 0, s: {}, rt: {} }; active.push(m);
    if (def.chapter && def.kind === 'story') Q.chapterCard(def);
    doAll(def.begin);
    if (def.kind === 'story' || !tracked || force) tracked = m;
    enter(m); Q.milestone();
    return m;
  }
  function stop(m) {   // an event that ran out, a challenge given up: no reward, no blame
    const at = active.indexOf(m); if (at < 0) return;
    leave(m); active.splice(at, 1);
    const r = rec[m.def.id]; if (r) { if (r.n) r.st = 'done'; else delete rec[m.def.id]; }
    if (tracked === m) tracked = active.find((x) => x.def.kind === 'story') || active[0] || null;
  }
  const isDone = (id) => !!(rec[id] && rec[id].n);
  function ready(def) { return (def.requires || []).every(isDone) && (!def.flag || flags[def.flag]); }
  const offerable = (def) => !rec[def.id] && ready(def) && def.kind === 'side';

  function step(dt) {
    for (const m of active.slice()) {
      const o = cur(m), T = OBJ[o.type];
      if (!m.passed && T && T.step) T.step(m, o, dt);
      if (m.passed) advance(m);
    }
    if ((scanT -= dt) <= 0) { scanT = 1; Q.people.refresh(); Q.refreshRuns(); }
  }
  function fire(ev, arg) {
    for (const m of active.slice()) {
      const o = cur(m), T = OBJ[o.type];
      if (T && T.on) T.on(m, o, ev, arg);
    }
  }

  // ------------------------------------------------------------------ what the HUD asks
  function textOf(m) {
    if (!m) return '';
    const o = cur(m), T = OBJ[o.type], vars = T && T.vars ? T.vars(m, o) : {};
    return String(o.text || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  }
  function target() {
    if (!tracked) return null;
    const o = cur(tracked), T = OBJ[o.type];
    return T && T.target ? T.target(tracked, o) : null;
  }
  function botPlan() {
    if (!tracked) return null;
    const o = cur(tracked), T = OBJ[o.type];
    return T && T.bot ? T.bot(tracked, o) : null;
  }

  // ------------------------------------------------------------------ the save
  function pack() {
    const out = {}; for (const id in rec) out[id] = { ...rec[id] };
    for (const m of active) {
      if (m.def.kind === 'event') { const r = out[m.def.id]; if (r.n) r.st = 'done'; else delete out[m.def.id]; continue; }   // an event is of its moment: it doesn't come back with the save
      const r = out[m.def.id]; r.i = m.i; r.s = m.s;
    }
    return { rec: out, tracked: tracked ? tracked.def.id : null, flags: { ...flags } };
  }
  function unpack(s) {
    for (const m of active.slice()) { leave(m); active.splice(active.indexOf(m), 1); }
    for (const k in rec) delete rec[k]; for (const k in flags) delete flags[k]; tracked = null;
    Object.assign(flags, s.flags || {});
    for (const id in s.rec || {}) {
      const r = s.rec[id], def = defs.get(id); if (!def) continue;
      rec[id] = { st: r.st, n: r.n || 0, t: r.t };
      if (r.st === 'active') {
        const i = Math.min(r.i || 0, def.objectives.length - 1), m = { def, i, s: r.s || {}, rt: {} };
        rec[id].i = i; active.push(m);
      }
    }
    for (const m of active) enter(m, true);
    tracked = active.find((x) => x.def.id === s.tracked) || active.find((x) => x.def.kind === 'story') || active[0] || null;
  }

  return {
    defs, story, rec, flags, active, start, stop, step, fire, target, botPlan, pack, unpack, isDone, ready, offerable, textOf, cur, OBJ,
    get tracked() { return tracked; },
    track(id) { const m = active.find((x) => x.def.id === id); if (m) { tracked = m; G.ui.objectiveChanged && G.ui.objectiveChanged(); } return !!m; },
    objectiveText: () => textOf(tracked),
    chapter() { let n = 0; for (const d of story) { if (rec[d.id] && d.chapter) n = Math.max(n, d.chapter); } return n; },
  };
}
