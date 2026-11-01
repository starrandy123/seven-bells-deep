// World events: every few minutes the sea does something. They are announced, optional and rewarded. Each is a mission of kind 'event'
// in web/data/events.json with a time limit; this file decides when one fires and ends it if the player lets it pass.
import { DATA } from './data.js';

export function createEvents(G, Q) {
  const list = DATA.events.list || [];
  const gap = DATA.events.gap || [200, 340], first = DATA.events.first || 150;
  const last = {};               // id -> G.time it last ran
  let nextAt = first, running = null, played = 0, off = false;
  // an event with `roam` comes down 260-420 m from the Warden, on open water, so its omen is what he sees on the horizon
  const here = { x: 0, y: 0, z: -30, r: 40 };
  function roam() {
    const h = G.hero;
    for (let k = 0; k < 24; k++) {
      const a = Math.random() * 6.28, d = 260 + Math.random() * 160, x = h.pos.x + Math.sin(a) * d, y = -h.pos.z + Math.cos(a) * d;
      const half = (G.world.data.size_m || 1280) / 2 - 120; if (Math.abs(x) > half || Math.abs(y) > half) continue;
      if (G.world.heightAt(x, y) < -8) { here.x = x; here.y = y; here.z = -6; return; }
    }
    here.x = h.pos.x; here.y = -h.pos.z; here.z = h.pos.y;
  }

  const eligible = (d) => {
    const m = Q.m();
    if (!(d.requires || []).every(m.isDone)) return false;
    if (d.night && !Q.isNight()) return false;
    if (last[d.id] !== undefined && G.time - last[d.id] < (d.cool || 480)) return false;
    return true;
  };

  function fire(id, force) {
    const d = list.find((x) => x.id === id); if (!d) return null;
    const m = Q.m(); if (running) end(false);
    if (d.roam) roam();
    const r = m.start(d.id, force === true); if (!r) return null;
    running = { m: r, d, ends: G.time + (d.dur || 150) };
    last[d.id] = G.time; played++;
    nextAt = G.time + gap[0] + Math.random() * (gap[1] - gap[0]);       // start to start: an omen every 2-3 minutes (G10b)
    G.ui.event(d.title, d.text, 8);
    { const t = d.roam ? Q.place({ event: true }).p : d.omenAt === 'whale' ? Q.nearestWhale() : d.omenAt ? Q.place(d.omenAt).p : G.hero.pos; G.things.omen(d.omen || 'wake', t || G.hero.pos, d.omenAt === 'whale'); running.omenAt = (t || G.hero.pos).clone(); }
    for (const a of d.fx || []) Q.weather(a, 3);
    return r;
  }
  function end(paid) {
    if (!running) return;
    const { m, d } = running; running = null; G.things.omen(null);
    if (!paid) { Q.m().stop(m); G.ui.tip(d.passed || 'The moment passes', 3.5); }
    for (const a of d.fx || []) Q.weather('calm', 6);
  }

  function step() {
    if (off) return;
    if (running) {
      if (Q.m().rec[running.d.id] && Q.m().rec[running.d.id].st === 'done') { end(true); return; }
      if (G.time >= running.ends) end(false);
      return;
    }
    if (G.time < nextAt || Q.talking() || (G.boss && G.boss.active) || G.hero.combatT < 4) return;
    const can = list.filter(eligible); if (!can.length) { nextAt = G.time + 30; return; }
    let w = 0; for (const d of can) w += d.weight || 1;
    let pick = Math.random() * w, c = can[0];
    for (const d of can) { pick -= d.weight || 1; if (pick <= 0) { c = d; break; } }
    fire(c.id);
  }

  return {
    step, fire, end, list, hold(on) { off = on; }, place: here,
    get omen() { return running ? running.omenAt : null; },
    get running() { return running ? running.d.id : null; },
    get timeLeft() { return running ? Math.max(0, running.ends - G.time) : 0; },
    played: () => played,
    pack: () => ({ played }),
    unpack(s) { played = s.played || 0; running = null; G.things.omen(null); nextAt = G.time + first; for (const k in last) delete last[k]; },
  };
}
