// Every place a mission, a person or a relic names comes from web/assets/world.json. Nothing here holds a coordinate.
// A place is written in the data as a string or an object:
//   "rimehold|frost_isle|open_blue"         the first of these poi ids (or `land` ids) that exists; a later one counts as a fallback
//   { "poi": "reef_shrine", "dir": 40, "dist": 12, "ground": 1.5, "dz": 2 }
//       dir, dist: a compass offset from the place, in degrees and metres · ground: sit this high over the seabed or the land · dz: a plain lift
//   { "bell": "reef" } · { "arena": true } · { "gate": true } · { "spawn": true } · { "encounter": "kelp_court" }
// A resolved place is pushed clear of the world's solids, so nothing ever sits inside a wall.
import { W } from './config.js';

export function createPlaces(G) {
  const d = G.world.data;
  const pois = new Map((d.poi || []).map((p) => [p.id, p]));
  for (const l of d.land || []) if (!pois.has(l.id)) pois.set(l.id, { r: 26, ...l, land: true });
  const bells = new Map((d.bells || []).map((b) => [b.id, b]));
  const encs = new Map((d.encounters || []).map((e) => [e.id, e]));
  const missing = new Map();        // poi id asked for -> what stood in for it, for the check that names what the world still owes
  const cache = new Map();

  function pick(name) {
    const ids = String(name).split('|');
    for (let i = 0; i < ids.length; i++) {
      const p = pois.get(ids[i]);
      if (p) { if (i > 0) missing.set(ids[0], ids[i]); return p; }
    }
    missing.set(ids[0], null);
    return null;
  }

  function base(s) {
    if (typeof s === 'string') return pick(s);
    if (s.poi) return pick(s.poi);
    if (s.bell) { const b = bells.get(s.bell); if (b) return { ...b, r: 20 }; return s.or ? pick(s.or) : null; }
    if (s.arena && d.arena) return d.arena;
    if (s.gate && d.arena) return d.arena.gate ? { r: 12, ...d.arena.gate } : d.arena;
    if (s.spawn) return { ...d.spawn, r: 20 };
    if (s.encounter) { const e = encs.get(s.encounter); if (e) return e; return s.or ? pick(s.or) : null; }
    if (s.event) return G.events.place;
    if (s.x !== undefined) return s;
    return null;
  }

  // Pushed clear of the solids. A rock standing on the seabed can push a place down into the floor and back for ever: such a place moves to the
  // nearest free spot on a widening ring, as high over the ground as it was meant to be, and under water if it was under water.
  function settle(q, r) {
    const lift = q.z - G.world.heightAt(q.x, q.y), wet = q.z < -1, t = { x: 0, y: 0, z: 0 };
    G.world.collide(q, r); t.x = q.x; t.y = q.y; t.z = q.z;
    if (!G.world.collide(t, r)) return;
    const ox = q.x, oy = q.y;
    for (let R = 6; R < 120; R += 6) for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 6.2832, x = ox + Math.sin(a) * R, y = oy + Math.cos(a) * R, z = G.world.heightAt(x, y) + lift;
      if (wet && z > -1) continue;
      t.x = x; t.y = y; t.z = z; if (!G.world.collide(t, r)) { q.x = x; q.y = y; q.z = z; return; }
    }
  }

  // the place, in Blender coordinates, then in the game's
  function resolve(spec, radius = 0.8) {
    const key = typeof spec === 'string' ? spec : JSON.stringify(spec);
    const moving = !!(spec && spec.event);                        // a world event's place is chosen as it fires
    if (!moving && cache.has(key)) return cache.get(key);
    const b = base(spec), s = typeof spec === 'string' ? {} : spec;
    if (!b) { const sp = d.spawn; return { x: sp.x, y: sp.y, z: sp.z, r: 20, id: null, p: W(sp.x, sp.y, sp.z), lost: true }; }
    const a = ((s.dir || 0) * Math.PI) / 180, dist = s.dist || 0;
    const q = { x: b.x + Math.sin(a) * dist, y: b.y + Math.cos(a) * dist, z: b.z };
    // a place meant to be under water that the land has grown over moves to the nearest water, so a swimmer can reach it
    if ((s.water || (b.z < -1 && !s.surface && !s.sea)) && G.world.heightAt(q.x, q.y) > -3.5) {
      search: for (let R = 12; R < 360; R += 12) for (let i = 0; i < 12; i++) {
        const t = (i / 12) * 6.2832, x = q.x + Math.sin(t) * R, y = q.y + Math.cos(t) * R;
        if (G.world.heightAt(x, y) < -5) { q.x = x; q.y = y; break search; }
      }
    }
    const ground = G.world.heightAt(q.x, q.y);
    if (s.ground !== undefined) q.z = ground + s.ground;
    else if (s.dz && !s.sea) q.z += s.dz;
    if (s.surface) q.z = ground > 0 ? ground + 1 : -1.6;
    if (s.sea) q.z = (s.dz || 0) + 0.02;                               // afloat
    if (q.z < ground + 0.3) q.z = ground + 0.3;
    if (!s.free && !s.sea) settle(q, radius);
    const out = { x: q.x, y: q.y, z: q.z, r: s.r || b.r || 20, id: b.id || null, land: ground > -0.7, p: W(q.x, q.y, q.z) };
    if (!moving) cache.set(key, out);
    return out;
  }

  return {
    resolve, missing, all: pois,
    poi: (id) => pois.get(id) || null,
    has: (name) => String(name).split('|').some((id) => pois.has(id)),
  };
}
