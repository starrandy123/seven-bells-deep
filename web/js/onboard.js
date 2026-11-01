// The first minutes teach through play: one hint at a time, on the control it's about, the right one for this device, each done by doing it,
// and a Skip that ends them all. Words are in missions.json (`onboard`), never over twelve to a step.
import { TOUCH, FLAG } from './config.js';
import { DATA } from './data.js';

export function createOnboard(G, Q) {
  const h = G.hero, steps = DATA.missions.onboard || [];
  let i = -1, skipped = false, shown = null, hold = 0, base = null, wait = 0;

  // when a step may show, and what ends it
  const WHEN = {
    strike: () => G.enemies.alive().some((e) => e.pos.distanceTo(h.pos) < 16),
    bell: () => Q.m().tracked && Q.m().cur(Q.m().tracked).type === 'ring',
  };
  const DONE = {
    move: () => h.speed > 2.5,
    look: () => base && Math.abs(G.camYaw - base.yaw) + Math.abs(G.camPitch - base.pitch) > 0.3,
    boost: () => h.surge > 0.3,
    strike: () => h.state === 'attack',
    bell: () => h.state === 'attack' || !Q.m().tracked || Q.m().cur(Q.m().tracked).type !== 'ring',
  };

  function show(s) { shown = s; base = { yaw: G.camYaw, pitch: G.camPitch }; hold = 0; G.ui.hint(TOUCH ? { text: s.touch, on: s.on, zone: s.zone } : { text: s.keys, caps: s.caps }); }
  function clear() { shown = null; G.ui.hint(null); }
  function skip() { skipped = true; clear(); Q.milestone(); }

  function step(dt) {
    if (FLAG.demo || FLAG.film || skipped || !G.started || i < 0) return;
    if (shown) {
      if (DONE[shown.id] && DONE[shown.id]()) { hold += dt; if (hold > 0.25) { clear(); i++; wait = 0.9; Q.milestone(); } }
      return;
    }
    if (i >= steps.length) return;
    if ((wait -= dt) > 0) return;
    const s = steps[i];
    if (!WHEN[s.id] || WHEN[s.id]()) show(s);
  }

  return {
    step, skip,
    begin() { i = 0; skipped = false; clear(); wait = 0.8; },
    teach(key, P) { G.ui.pulse(key, 8); const t = P.tip; if (t) G.ui.tip(TOUCH ? t.touch : t.keys, 6); },
    note() {},
    get current() { return shown ? shown.id : null; },
    get skipped() { return skipped; },
    pack: () => ({ i, skipped }),
    unpack(s) { i = s.i === undefined ? -1 : s.i; skipped = !!s.skipped; clear(); wait = 1; },
  };
}
