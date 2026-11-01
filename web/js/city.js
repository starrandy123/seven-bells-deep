// Cities you can walk and swim through: streets, blocks and many buildings, generated here from a plan instead of a few kit pieces.
// Randy, 1 Nov: "actual cities with blocks underwater ... and real life land cities too and not just one building".
// Original architecture throughout (Pipeline/AGENTS.md): no film's names, characters or designs.
//
// planCities(data, heightAt, opts) lays out every city before the world builds its colliders, so each building's boxes join the world's own solids and
// the hero meets them with the same physics as any rock. build(scene, mat) then makes one instanced draw per building type per city.
// Coordinates: data is Blender's (x, y on the ground, z up); the scene is (x, z, -y).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------------------------------------ the cities
// kind: 'sea' (domes, spires, terraced towers in weathered stone) or 'land' (houses with pitched roofs). block: metres from street centre to street centre.
const CITIES = [
  { id: 'thalor', kind: 'sea', block: 36, street: 9, avenue: 16, angle: 0.0, keep: ['colossus', 'arena', 'processional', 'high_temple'] },
  { id: 'meridon', kind: 'sea', block: 32, street: 8, avenue: 14, angle: 0.35, keep: ['rotunda', 'meridon_bakery', 'meridon_bridge'] },
  { id: 'vesper', kind: 'sea', block: 30, street: 8, avenue: 13, angle: -0.5, keep: [] },
  { id: 'sunward_harbour', kind: 'land', block: 22, street: 6, avenue: 9, angle: 0.18, keep: [] },
];
// existing kit pieces a new building must not stand on: their kind and how far to keep from them (m)
const SOLID_KINDS = { tower: 9, tower_cold: 9, dome_hall: 14, wall_bay: 6, wall_windows: 6, wall_windows_cold: 6, wall_broken: 5, temple_front: 12, arena_bay: 8, arena_seats: 10, column: 3, column_broken: 3, arch: 14, statue_colossus: 30, bell_shrine: 8, stair: 8, stair_steep: 6, bridge_span: 10, roof_slab: 6, cottage_a: 7, cottage_b: 7, quay: 8, pier: 6, pier_house: 8, lighthouse: 12, stone_wall: 3, lamp: 2, forge_hall: 16 };

// ------------------------------------------------------------------------------------------------ a tiny seeded random
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5 | 0, ((s ^ (s >>> 14)) >>> 0) / 4294967296)); }

// ------------------------------------------------------------------------------------------------ geometry: every piece has vertex colours; > 0.72 in any channel glows at night
const C = {
  stone: [0.62, 0.6, 0.55], stoneW: [0.66, 0.62, 0.54], stoneD: [0.44, 0.45, 0.42], marble: [0.68, 0.67, 0.62],
  gold: [0.7, 0.55, 0.22], verd: [0.31, 0.52, 0.45], window: [0.98, 0.82, 0.5], windowCold: [0.6, 0.9, 1.0], dark: [0.12, 0.13, 0.14],
  plaster: [0.7, 0.66, 0.58], plasterW: [0.69, 0.6, 0.48], roof: [0.52, 0.25, 0.16], roofD: [0.4, 0.22, 0.15], timber: [0.3, 0.22, 0.15],
};
function colorize(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; }
// a wall face of window cells: w x h metres, facing +z, its foot at y 0. Every other cell in a storey is a window inset a little
function facade(w, h, storey, bay, wallC, winC, inset = 0.18) {
  const P = [], Cc = [], rows = Math.max(1, Math.round(h / storey)), cols = Math.max(1, Math.round(w / bay)), sh = h / rows, sw = w / cols;
  const quad = (x0, y0, x1, y1, z, c) => { P.push(x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z); for (let k = 0; k < 6; k++) Cc.push(...c); };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x0 = -w / 2 + c * sw, y0 = r * sh, x1 = x0 + sw, y1 = y0 + sh;
    const win = r > 0 || rows === 1 ? (c % 2 === 1 || cols === 1) : c === Math.floor(cols / 2);       // the ground storey: one door
    if (!win) { quad(x0, y0, x1, y1, 0, wallC); continue; }
    const mx = sw * 0.24, my = sh * (r === 0 ? 0.0 : 0.22), ty = sh * 0.2;
    quad(x0, y0, x0 + mx, y1, 0, wallC); quad(x1 - mx, y0, x1, y1, 0, wallC); quad(x0 + mx, y0, x1 - mx, y0 + my, 0, wallC); quad(x0 + mx, y1 - ty, x1 - mx, y1, 0, wallC);
    quad(x0 + mx, y0 + my, x1 - mx, y1 - ty, -inset, r === 0 ? C.dark : winC);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); return g;
}
// a box of facades: four walls of windows and a flat roof
function block(w, d, h, storey, bay, wallC, winC, roofC) {
  const parts = [];
  for (const [fw, rot, off] of [[w, 0, d / 2], [w, Math.PI, d / 2], [d, Math.PI / 2, w / 2], [d, -Math.PI / 2, w / 2]]) {
    const f = facade(fw, h, storey, bay, wallC, winC); f.translate(0, 0, off); f.rotateY(rot); parts.push(f);
  }
  const roof = colorize(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(0, h, 0), roofC); parts.push(roof);
  const cornice = colorize(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6).translate(0, h - 0.25, 0), C.stoneD); parts.push(cornice);
  return mergeGeometries(parts.map(norm));
}
const norm = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'color') n.deleteAttribute(k); n.computeVertexNormals(); return n; };

// each archetype: geometry in a unit footprint (about 1 x 1 m before its instance's scale) and its solids as boxes [cx, cz, hx, hz, y0, y1] in those units
function archetypes(kind, phone) {
  const A = {};
  if (kind === 'sea') {
    // a terraced tower: three tiers stepping in, windows in rows, a gold-rimmed roof terrace
    {
      const t = [[1, 1, 0.42], [0.74, 0.74, 0.34], [0.5, 0.5, 0.28]], parts = [], solids = []; let y = 0;
      for (const [w, d, h] of t) { const b = block(w, d, h, 0.07, 0.12, C.stone, C.window, C.stoneD); b.translate(0, y, 0); parts.push(b); solids.push([0, 0, w / 2, d / 2, y, y + h]); y += h; }
      parts.push(norm(colorize(new THREE.CylinderGeometry(0.12, 0.16, 0.16, 8).translate(0, y + 0.08, 0), C.gold)));
      A.terrace = { geo: mergeGeometries(parts), solids, h: y };
    }
    // a domed hall: a drum of tall windows on a plinth, a ring of columns, a dome of verdigris and gold
    {
      const parts = [], seg = phone ? 14 : 20;
      parts.push(norm(colorize(new THREE.CylinderGeometry(0.62, 0.66, 0.08, seg).translate(0, 0.04, 0), C.stoneD)));
      const drum = new THREE.CylinderGeometry(0.46, 0.46, 0.34, seg, 1, true).translate(0, 0.25, 0); { const p = drum.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getX(i), p.getZ(i)); c.set(Math.floor((a / (2 * Math.PI) + 1) * seg) % 2 ? C.marble : C.window, i * 3); } drum.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
      parts.push(norm(drum));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; parts.push(norm(colorize(new THREE.CylinderGeometry(0.035, 0.04, 0.36, 6).translate(Math.sin(a) * 0.57, 0.26, Math.cos(a) * 0.57), C.marble))); }
      parts.push(norm(colorize(new THREE.CylinderGeometry(0.62, 0.62, 0.05, seg).translate(0, 0.45, 0), C.stoneD)));
      parts.push(norm(colorize(new THREE.SphereGeometry(0.47, seg, phone ? 6 : 9, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.42, 0), C.verd)));
      parts.push(norm(colorize(new THREE.ConeGeometry(0.06, 0.22, 8).translate(0, 0.98, 0), C.gold)));
      A.dome = { geo: mergeGeometries(parts), solids: [[0, 0, 0.6, 0.6, 0, 0.47], [0, 0, 0.36, 0.36, 0.47, 0.82]], h: 1.0 };
    }
    // a spire: a tall octagonal shaft with window bands and a gold point
    {
      const parts = [], seg = 8;
      parts.push(norm(colorize(new THREE.CylinderGeometry(0.42, 0.46, 0.1, seg).translate(0, 0.05, 0), C.stoneD)));
      const shaft = new THREE.CylinderGeometry(0.26, 0.34, 1.6, seg, 10, true).translate(0, 0.9, 0); { const p = shaft.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const band = Math.floor(p.getY(i) * 6.25) % 2 === 1 && (Math.round(Math.atan2(p.getX(i), p.getZ(i)) / (Math.PI / 4)) % 2 === 0); c.set(band ? C.windowCold : C.stoneW, i * 3); } shaft.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
      parts.push(norm(shaft));
      parts.push(norm(colorize(new THREE.CylinderGeometry(0.32, 0.27, 0.1, seg).translate(0, 1.72, 0), C.gold)));
      parts.push(norm(colorize(new THREE.ConeGeometry(0.27, 0.7, seg).translate(0, 2.12, 0), C.verd)));
      parts.push(norm(colorize(new THREE.ConeGeometry(0.05, 0.25, 6).translate(0, 2.58, 0), C.gold)));
      A.spire = { geo: mergeGeometries(parts), solids: [[0, 0, 0.33, 0.33, 0, 1.8], [0, 0, 0.2, 0.2, 1.8, 2.4]], h: 2.7 };
    }
    // a low terrace house: two storeys, a parapet, a small pergola
    {
      const b = block(1, 1, 0.5, 0.25, 0.25, C.stoneW, C.window, C.stoneD), parts = [b];
      parts.push(norm(colorize(new THREE.BoxGeometry(1.02, 0.08, 1.02).translate(0, 0.54, 0), C.stoneD)));
      parts.push(norm(colorize(new THREE.BoxGeometry(0.3, 0.18, 0.3).translate(0.25, 0.67, -0.2), C.verd)));
      A.low = { geo: mergeGeometries(parts), solids: [[0, 0, 0.5, 0.5, 0, 0.58]], h: 0.76 };
    }
    // a colonnade: a run of columns under an entablature, along the avenues
    {
      const parts = [];
      for (let i = 0; i < 6; i++) parts.push(norm(colorize(new THREE.CylinderGeometry(0.035, 0.045, 0.6, 6).translate(-0.5 + i * 0.2, 0.3, 0), C.marble)));
      parts.push(norm(colorize(new THREE.BoxGeometry(1.1, 0.1, 0.16).translate(0, 0.65, 0), C.marble)));
      parts.push(norm(colorize(new THREE.BoxGeometry(1.1, 0.04, 0.2).translate(0, 0.02, 0), C.stoneD)));
      A.colonnade = { geo: mergeGeometries(parts), solids: [[0, 0, 0.55, 0.08, 0, 0.7]], h: 0.7 };
    }
  } else {
    // a town house: plaster walls, a terracotta roof, shutters and lit windows
    for (const [name, wall] of [['house', C.plaster], ['houseW', C.plasterW]]) {
      const parts = [block(1, 0.8, 0.62, 0.31, 0.25, wall, C.window, C.stoneD)];
      const roof = new THREE.BufferGeometry(); const hw = 0.56, hd = 0.46, y0 = 0.62, y1 = 0.98;
      roof.setAttribute('position', new THREE.Float32BufferAttribute([
        -hw, y0, hd, hw, y0, hd, hw, y1, 0, -hw, y0, hd, hw, y1, 0, -hw, y1, 0,
        hw, y0, -hd, -hw, y0, -hd, -hw, y1, 0, hw, y0, -hd, -hw, y1, 0, hw, y1, 0,
        -hw + 0.06, y0, -hd + 0.06, -hw + 0.06, y0, hd - 0.06, -hw + 0.06, y1, 0, hw - 0.06, y0, hd - 0.06, hw - 0.06, y0, -hd + 0.06, hw - 0.06, y1, 0], 3));
      parts.push(norm(colorize(roof, C.roof)));
      parts.push(norm(colorize(new THREE.BoxGeometry(0.1, 0.25, 0.1).translate(0.25, 0.98, 0.1), C.stoneD)));      // a chimney
      A[name] = { geo: mergeGeometries(parts), solids: [[0, 0, 0.5, 0.4, 0, 0.62], [0, 0, 0.5, 0.2, 0.62, 0.9]], h: 0.98 };
    }
    // a market stall's awning
    {
      const parts = [norm(colorize(new THREE.BoxGeometry(1, 0.04, 0.6).rotateX(-0.12).translate(0, 0.5, 0), C.roofD))];
      for (const x of [-0.45, 0.45]) for (const z of [-0.25, 0.25]) parts.push(norm(colorize(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5).translate(x, 0.25, z), C.timber)));
      A.stall = { geo: mergeGeometries(parts), solids: [], h: 0.5 };
    }
  }
  return A;
}

// ------------------------------------------------------------------------------------------------ the plan
export function planCities(data, heightAt, opts = {}) {
  const phone = !!opts.phone, poi = new Map((data.poi || []).map((p) => [p.id, p])), colliders = [], cities = [];
  // where not to build: every existing solid kit piece, with its margin
  const keepOut = [];
  for (const kind in SOLID_KINDS) { const I = data.instances && data.instances[kind]; if (!I) continue; const m = SOLID_KINDS[kind]; for (let k = 0; k + 5 < I.length; k += 6) keepOut.push([I[k], I[k + 1], m * Math.max(1, I[k + 4] * 0.6)]); }
  const rivers = (data.rivers || []).map((r) => ({ pts: r.pts, w: r.w }));
  const nearRiver = (x, y) => { for (const r of rivers) for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)), px = a[0] + dx * t - x, py = a[1] + dy * t - y; if (px * px + py * py < (r.w * 0.5 + 7) ** 2) return true; } return false; };
  // a hash grid over the keep-out list, so each lot asks only its neighbours
  const KC = 24, kgrid = new Map(); for (const k of keepOut) { const cx = Math.floor(k[0] / KC), cy = Math.floor(k[1] / KC); const key = cx + ',' + cy; (kgrid.get(key) || kgrid.set(key, []).get(key)).push(k); }
  const blocked = (x, y, r) => { const cx = Math.floor(x / KC), cy = Math.floor(y / KC); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const L = kgrid.get((cx + i) + ',' + (cy + j)); if (L) for (const k of L) if ((k[0] - x) ** 2 + (k[1] - y) ** 2 < (k[2] + r) ** 2) return true; } return false; };

  for (const def of CITIES) {
    const p = poi.get(def.id); if (!p) continue;
    const rand = rng(Math.round(p.x * 131 + p.y * 977)), R = p.r * (def.kind === 'land' ? 1.25 : 0.96), ca = Math.cos(def.angle), sa = Math.sin(def.angle);
    const keepPoi = def.keep.map((id) => poi.get(id)).filter(Boolean);
    const inst = {}, put = (type, x, y, z, yaw, sx, sy, sz) => { (inst[type] ||= []).push([x, y, z, yaw, sx, sy, sz]); };
    const sea = def.kind === 'sea', B = def.block, half = Math.ceil(R / B);
    for (let gi = -half; gi <= half; gi++) for (let gj = -half; gj <= half; gj++) {
      // the block's centre, in the city's own grid turned by its angle
      const lu = gi * B, lv = gj * B, bx = p.x + lu * ca - lv * sa, by = p.y + lu * sa + lv * ca, dC = Math.hypot(lu, lv);
      if (dC > R - B * 0.4) continue;
      const onAvenue = gi === 0 || gj === 0;                             // the two grand avenues through the centre stay open
      if (onAvenue && dC > B * 0.6) {
        // colonnades line the avenues under the sea; stalls line the land town's main street
        if (sea && rand() < 0.75) { const along = gi === 0 ? def.angle + Math.PI / 2 : def.angle, off = def.avenue * 0.5 + 1.2; for (const s of [-1, 1]) { const ox = bx + s * off * Math.cos(along + Math.PI / 2), oy = by + s * off * Math.sin(along + Math.PI / 2); if (!blocked(ox, oy, 4) && !keepPoi.some((q) => Math.hypot(q.x - ox, q.y - oy) < q.r + 4)) { const z = heightAt(ox, oy); put('colonnade', ox, oy, z - 0.3, along, B * 0.7, 9 + rand() * 3, 9); } } }
        else if (!sea && rand() < 0.6) { const ox = bx + 4 * (rand() - 0.5), oy = by + 4 * (rand() - 0.5); if (!blocked(ox, oy, 3) && !nearRiver(ox, oy)) put('stall', ox, oy, heightAt(ox, oy), def.angle + (rand() < 0.5 ? 0 : Math.PI), 3.2, 3.6, 3.2); }
        continue;
      }
      if (dC < B * 0.6 && !keepPoi.length) continue;                     // a plaza at the heart of a city with no landmark there
      // the block's lots: 2 x 2 under the sea, 3 x 2 on land, each one building
      const inner = B - def.street, nu = sea ? 2 : 3, nv = 2, lw = inner / nu, ld = inner / nv;
      for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) {
        if (rand() < (sea ? 0.08 : 0.12)) continue;                      // a garden, a court, a gap
        const u = lu - inner / 2 + lw * (a + 0.5), v = lv - inner / 2 + ld * (b + 0.5), x = p.x + u * ca - v * sa, y = p.y + u * sa + v * ca, rr = Math.max(lw, ld) * 0.6;
        if (Math.hypot(u, v) > R) continue;
        if (keepPoi.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + rr)) continue;
        if (blocked(x, y, rr) || nearRiver(x, y)) continue;
        // the ground under the lot: a building on a slope sinks its foot to the lowest corner; too steep a lot stays open
        const hs = [heightAt(x, y), heightAt(x + lw * 0.45, y + ld * 0.45), heightAt(x - lw * 0.45, y + ld * 0.45), heightAt(x + lw * 0.45, y - ld * 0.45), heightAt(x - lw * 0.45, y - ld * 0.45)];
        const lo = Math.min(...hs), hi = Math.max(...hs); if (hi - lo > (sea ? 7 : 3.5)) continue;
        if (!sea && lo < 0.8) continue;                                  // a land house stands on dry land
        if (sea && hi > -6) continue;                                    // a sea building stays under the water
        // facing the nearest street; its type from how far it is from the centre
        const yaw = def.angle + (b === 0 ? Math.PI : 0), ring = dC / R, foot = Math.min(lw, ld) - 1.2;      // its front to the street on its side of the block
        let type, sxz, sy;
        if (sea) {
          const r0 = rand();
          if (ring < 0.35 && r0 < 0.3) { type = 'dome'; sxz = foot; sy = foot * (0.9 + rand() * 0.3); }
          else if (ring < 0.6 && r0 < 0.22) { type = 'spire'; sxz = foot * 0.75; sy = foot * (1.8 + rand() * 1.1); }
          else if (ring < 0.75 || r0 < 0.5) { type = 'terrace'; sxz = foot; sy = foot * (1.1 + rand() * 1.4) * (1.25 - ring * 0.6); }
          else { type = 'low'; sxz = foot; sy = foot * (0.8 + rand() * 0.6); }
        } else { type = rand() < 0.5 ? 'house' : 'houseW'; sxz = foot; sy = foot * (0.95 + rand() * 0.45); }
        const z = lo - (sea ? 0.6 : 0.25);
        put(type, x, y, z, yaw, sxz, sy, sxz);
      }
    }
    cities.push({ def, p, inst });
  }
  // every building's solids, turned and scaled as it stands
  const sets = { sea: archetypes('sea', phone), land: archetypes('land', phone) };
  for (const c of cities) for (const type in c.inst) {
    const A = sets[c.def.kind][type]; if (!A) continue;
    for (const [x, y, z, yaw, sx, sy, sz] of c.inst[type]) for (const [cx, cz, hx, hz, y0, y1] of A.solids) {
      // the archetype's local x, z (scene) to the world's x, y: local z is -y before the turn
      const co = Math.cos(yaw), si = Math.sin(yaw), lx = cx * sx, ly = -cz * sz;
      colliders.push({ t: 'box', x: x + lx * co - ly * si, y: y + lx * si + ly * co, z0: z + y0 * sy - 0.5, z1: z + y1 * sy, hx: hx * sx, hy: hz * sz, yaw, city: c.def.id });
    }
  }
  const count = cities.reduce((n, c) => n + Object.values(c.inst).reduce((m, L) => m + L.length, 0), 0);

  // the ink line (Randy, 1 Nov: "look out of a comic book"): each building drawn a second time inside out, pushed out along smooth normals
  const hulls = new Map();
  function hullOf(geo) {
    if (hulls.has(geo)) return hulls.get(geo);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', geo.attributes.position.clone());
    const w = mergeVertices(g, 1e-3); w.computeVertexNormals(); hulls.set(geo, w); return w;
  }
  function build(scene, matFor) {
    const meshes = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
    for (const c of cities) {
      const group = new THREE.Group(); group.name = 'city_' + c.def.id; group.userData = { x: c.p.x, y: c.p.y, r: c.p.r }; scene.add(group);
      const rand = rng(Math.round(c.p.x * 7 + c.p.y * 13));
      for (const type in c.inst) {
        const A = sets[c.def.kind][type], L = c.inst[type]; if (!A || !L.length) continue;
        const im = new THREE.InstancedMesh(A.geo, matFor(type), L.length);
        im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(L.length * 3), 3);
        L.forEach(([x, y, z, yaw, sx, sy, sz], i) => {
          v.set(x, z, -y); e.set(0, yaw, 0); q.setFromEuler(e); s.set(sx, sy, sz); m4.compose(v, q, s); im.setMatrixAt(i, m4);
          const t = 0.88 + rand() * 0.24; col.setRGB(t, t * (0.97 + rand() * 0.05), t * (0.94 + rand() * 0.06)); im.setColorAt(i, col);     // each stone its own weathering
        });
        im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.name = 'city_' + c.def.id + '_' + type;
        group.add(im); meshes.push(im);
        const ink = matFor('ink'); if (ink) { const om = new THREE.InstancedMesh(hullOf(A.geo), ink, L.length); om.instanceMatrix.copy(im.instanceMatrix); om.frustumCulled = false; om.name = im.name + '_ink'; om.renderOrder = 1; group.add(om); }
      }
    }
    return meshes;
  }
  // a whole city is drawn only while the camera is near enough to see it through the water (or the haze on land)
  function update(scene, cam, phone) {
    for (const c of cities) { const g = scene.getObjectByName('city_' + c.def.id); if (!g) continue; const d = Math.hypot(cam.x - c.p.x, -cam.z - c.p.y); g.visible = d < c.p.r + (c.def.kind === 'land' ? (phone ? 700 : 1100) : (phone ? 320 : 520)); }
  }
  return { colliders, cities, count, build, update };
}
