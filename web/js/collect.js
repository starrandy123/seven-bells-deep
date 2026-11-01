// What the Warden finds: relic tablets (20, read as they're found) and Minnow's book of every species he swims near.
import { DATA } from './data.js';

export function createCollect(G, Q) {
  const h = G.hero;
  const relics = (DATA.relics.list || []).map((r) => ({ ...r, pl: null, item: null, found: false }));
  // the book lists what the sea really holds in this build: a species the world hasn't added can't be logged, so it isn't counted against the player
  const L0 = G.life || {}, live = new Set(['leviathan', ...Object.keys((G.combat && G.combat.data && G.combat.data.foes) || {}), ...Object.keys(L0.herds || {}), ...(L0.schools || []).map((s) => s.kind), ...(G.world.data.drifters || []).map((d) => d.kind)]);
  if (L0.whales && L0.whales.length) live.add('whale'); if (L0.pods && L0.pods.length) live.add('dolphin');
  const entries = (DATA.codex.list || []).filter((e) => (e.kinds || [e.id]).some((k) => live.has(k)));
  const kindTo = new Map(); for (const e of entries) for (const k of e.kinds || [e.id]) kindTo.set(k, e);
  const logged = {};            // entry id -> 1
  let relicT = 0, scanT = 0;

  function lay() {
    for (const r of relics) {
      if (r.item) { G.things.remove(r.item); r.item = null; }
      if (r.found) continue;
      r.pl = r.pl || Q.place(r.at, 0.7);
      r.item = G.things.add('tablet', r.pl.p, {});
    }
  }
  function find(r, quiet) {
    r.found = true; if (r.item) { G.things.remove(r.item); r.item = null; }
    if (quiet) return;
    G.audio.pearl(); G.fx.sparks(r.pl.p, 18, 0x9ff4ff, 5); G.look.flash(r.pl.p, 0x9ff4ff, 8, 0.4);
    G.ui.card(r.title, r.text, 9); Q.milestone(); Q.m().fire('relic', r.id);
  }
  function log(e) {
    if (!e || logged[e.id]) return;
    logged[e.id] = 1; G.audio.bubble();
    G.ui.card(`Minnow's book: ${e.name}`, e.note, 4.5, 'book'); Q.milestone(); Q.m().fire('species', e.id);
  }
  // swim near it to log it: live animals by their species, drifters and enemies the same way
  const touch = (k, d) => { const e = kindTo.get(k); if (e && !logged[e.id] && d < (e.near || 16)) log(e); };
  function scan() {
    const L = G.life; if (!L) return;
    if (L.herds) for (const k in L.herds) { const he = L.herds[k]; if (!kindTo.has(k)) continue; const e = kindTo.get(k); if (logged[e.id]) continue; for (const a of he.agents) { const d = a.pos.distanceTo(h.pos); if (d < (e.near || 16)) { log(e); break; } } }
    if (L.schools && L.schoolPos) for (const s of L.schools) { if (!kindTo.has(s.kind)) continue; const e = kindTo.get(s.kind); if (logged[e.id]) continue; if (L.schoolPos(s).distanceTo(h.pos) < (e.near || 16) + (s.ball || 0)) log(e); }
    if (L.whales) for (const w of L.whales) { const p = w.pos || w.position; if (p) touch('whale', p.distanceTo(h.pos) - 18); }
    if (L.pods) for (const w of L.pods) { const p = w.pos; if (p) touch('dolphin', p.distanceTo(h.pos)); }
    for (const d of G.world.data.drifters || []) { if (!kindTo.has(d.kind)) continue; const e = kindTo.get(d.kind); if (logged[e.id]) continue; const dx = d.x - h.pos.x, dy = d.y + h.pos.z, dz = d.z - h.pos.y; if (Math.hypot(dx, dy, dz) < (e.near || 16) + (d.r || 0)) log(e); }
    for (const e of G.enemies.alive()) touch(e.kind, e.pos.distanceTo(h.pos));
    if (G.boss && G.boss.active && G.boss.head) touch('leviathan', G.boss.head.distanceTo(h.pos));
  }

  function step(dt) {
    if ((relicT -= dt) <= 0) {
      relicT = 0.2;
      for (const r of relics) { if (!r.found && r.pl && r.pl.p.distanceTo(h.pos) < 3.2) find(r); }
    }
    if ((scanT -= dt) <= 0) { scanT = 0.5; scan(); }
  }

  function nearestRelic() { let b = null, bd = 1e12; for (const r of relics) { if (r.found || !r.pl) continue; const d = r.pl.p.distanceToSquared(h.pos); if (d < bd) { bd = d; b = r.pl.p; } } return b; }

  // the nearest animal not yet in the book, for the bot and for Minnow's List
  function nearestUnlogged() {
    const L = G.life; let b = null, bd = 1e12;
    const see = (k, p) => { if (!kindTo.has(k) || logged[kindTo.get(k).id]) return; const d = p.distanceToSquared(h.pos); if (d < bd) { bd = d; b = p; } };
    if (L) {
      for (const k in L.herds || {}) for (const a of L.herds[k].agents) see(k, a.pos);
      for (const s of L.schools || []) see(s.kind, L.schoolPos(s));
      for (const w of L.whales || []) see('whale', w.pos || w.position);
      for (const w of L.pods || []) see('dolphin', w.pos);
    }
    return b;
  }

  return {
    step, lay, relics, entries, logged, nearestRelic, nearestUnlogged, log,
    foundCount: () => relics.filter((r) => r.found).length,
    loggedCount: () => Object.keys(logged).length,
    grant(id) { const r = relics.find((x) => x.id === id); if (r && !r.found) { r.pl = r.pl || Q.place(r.at, 0.7); find(r); } },
    pack: () => ({ relics: relics.filter((r) => r.found).map((r) => r.id), codex: Object.keys(logged) }),
    unpack(s) {
      for (const r of relics) r.found = (s.relics || []).includes(r.id);
      for (const k in logged) delete logged[k]; for (const k of s.codex || []) logged[k] = 1;
      lay();
    },
  };
}
