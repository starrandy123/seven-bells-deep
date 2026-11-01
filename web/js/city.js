// Cities you can walk and swim through: streets, blocks and many buildings, generated here from a plan instead of a few kit pieces.
// Randy, 1 Nov: "actual cities with blocks underwater ... and real life land cities too and not just one building"; "The cities must come with the nice detail and
// textures of the art style too and look out of a comic book". Original architecture throughout (Pipeline/AGENTS.md): no film's names, characters or designs.
//
// How it's built (the standard way to make a city cheap enough for a phone): each building is simple massing in real metres, and its detail is drawn by the
// city material (world.js) from one attribute per vertex, aFac = (u, v, kind, w): u along the surface and v up it in metres, what the surface is, and a width
// (a face's bay, or a round piece's radius). Windows, frames, arches, ledges, pilasters, stone courses, roof tiles, scale-shingled domes and mosaic paving are
// all drawn there, in ink, at a constant line weight, and fade to a flat tone before they could shimmer. So a building is a few hundred triangles, not thousands.
//
// planCities(data, heightAt, opts) lays every city out before the world builds its colliders, so each building's solids (boxes, and cylinders for what's round)
// join the world's own and the hero meets them with the same physics as rock, and stands on their roofs. build(scene, matFor) makes one instanced draw per
// building type per city, and an ink hull for each. Coordinates: data is Blender's (x, y on the ground, z up); the scene is (x, z, -y).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------------------------------------ what a surface is (the city material reads these numbers)
export const K = { STONE: 0, SEA_WALL: 1, LAND_WALL: 2, TILE: 3, DOME: 4, DRUM: 5, COLUMN: 6, SPIRE: 7, GOLD: 8, PAVING: 9, LAMP: 10, AWNING: 11, FRIEZE: 12, DARK: 13, TIMBER: 14, SEA_GROUND: 15 };
const SEA_S = 4.2, SEA_BAY = 3.6, LAND_S = 3.0, LAND_BAY = 2.8;      // a storey and a bay, in metres; the material draws to the same storeys

// ------------------------------------------------------------------------------------------------ the cities
const CITIES = [
  { id: 'thalor', kind: 'sea', block: 36, street: 9, avenue: 16, angle: 0.0, keep: ['colossus', 'arena', 'processional', 'high_temple'], tint: [1, 1, 1] },
  { id: 'meridon', kind: 'sea', block: 33, street: 8, avenue: 14, angle: 0.35, keep: ['rotunda', 'meridon_bakery', 'meridon_bridge'], tint: [1.04, 1.0, 0.92] },
  { id: 'vesper', kind: 'sea', block: 33, street: 8, avenue: 14, angle: -0.5, keep: [], tint: [0.8, 0.86, 0.94] },
  // the harbour town climbs the hill behind the quays (the poi sits on the shoreline: the town's heart is moved up onto the land)
  { id: 'sunward_harbour', kind: 'land', block: 24, street: 7, avenue: 10, angle: 0.18, keep: [], tint: [1, 1, 1], shift: [-34, 4], radius: 1.2 },
];
// existing kit pieces a new building must not stand on: their kind and how far to keep from them (m)
const SOLID_KINDS = { tower: 9, tower_cold: 9, dome_hall: 14, wall_bay: 6, wall_windows: 6, wall_windows_cold: 6, wall_broken: 5, temple_front: 12, arena_bay: 8, arena_seats: 10, column: 3, column_broken: 3, arch: 14, statue_colossus: 30, bell_shrine: 8, stair: 8, stair_steep: 6, bridge_span: 10, roof_slab: 6, cottage_a: 7, cottage_b: 7, quay: 8, pier: 6, pier_house: 8, lighthouse: 12, stone_wall: 3, lamp: 2, forge_hall: 16, boat_fishing: 6 };
// the generic clutter a planned city replaces inside its own footprint (Randy: "not just one building"): scattered ruin pieces under the sea, field walls on
// land. Never a landmark (those stand in a city's `keep` and keep their radius), a temple, a statue, the arena, a shrine or a lamp
const CLEARS = { sea: ['wall_bay', 'wall_broken', 'wall_windows', 'wall_windows_cold', 'tower', 'tower_cold', 'roof_slab', 'column_broken', 'column_fallen'], land: ['stone_wall'] };
// a land house's plaster, each house its own (the Mediterranean range: cream, ochre, white, rose, pale blue, straw)
const PLASTER = [[1.0, 0.97, 0.9], [1.0, 0.86, 0.62], [1.06, 1.06, 1.04], [1.0, 0.8, 0.74], [0.82, 0.92, 1.02], [0.98, 0.9, 0.72]];

// ------------------------------------------------------------------------------------------------ a tiny seeded random
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5 | 0, ((s ^ (s >>> 14)) >>> 0) / 4294967296)); }

// ------------------------------------------------------------------------------------------------ the builder: faces in metres, each with its normal and its aFac
// A wall runs from (x0, z0) to (x1, z1) with its front on the side of dir x up, so a box's walls go round it in that order. Every quad is wound to face out.
class Mk {
  constructor() { this.P = []; this.N = []; this.F = []; this.I = []; this.S = []; }
  v(x, y, z, nx, ny, nz, u, w, k, b) { this.P.push(x, y, z); this.N.push(nx, ny, nz); this.F.push(u, w, k, b); return this.P.length / 3 - 1; }
  quad(a, b, c, d) { this.I.push(a, b, c, a, c, d); }
  // a wall: u along it, its bays fitted evenly to its length (the material draws bay by bay); v is height above `base`
  wall(x0, z0, x1, z1, y0, y1, k, bay, base = 0) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L, bw = L / Math.max(1, Math.round(L / bay));
    this.quad(this.v(x0, y0, z0, nx, 0, nz, 0, y0 - base, k, bw), this.v(x1, y0, z1, nx, 0, nz, L, y0 - base, k, bw), this.v(x1, y1, z1, nx, 0, nz, L, y1 - base, k, bw), this.v(x0, y1, z0, nx, 0, nz, 0, y1 - base, k, bw));
  }
  // a level rectangle facing up
  flat(x0, z0, x1, z1, y, k) {
    this.quad(this.v(x0, y, z1, 0, 1, 0, x0, z1, k, 1), this.v(x1, y, z1, 0, 1, 0, x1, z1, k, 1), this.v(x1, y, z0, 0, 1, 0, x1, z0, k, 1), this.v(x0, y, z0, 0, 1, 0, x0, z0, k, 1));
  }
  box(cx, cz, w, d, y0, y1, side, top, bay = 3, base = null, solid = true) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, b = base === null ? y0 : base;
    this.wall(x0, z1, x1, z1, y0, y1, side, bay, b); this.wall(x1, z1, x1, z0, y0, y1, side, bay, b); this.wall(x1, z0, x0, z0, y0, y1, side, bay, b); this.wall(x0, z0, x0, z1, y0, y1, side, bay, b);
    if (top !== null) this.flat(x0, z0, x1, z1, y1, top);
    if (solid) this.S.push({ t: 'box', x: cx, z: cz, hx: w / 2, hz: d / 2, y0, y1 });
  }
  // a round piece, tapering from r0 to r1: u is the arc in metres at its mean radius; w is the width of one bay round it (bays > 0) or its radius
  cyl(cx, cz, r0, r1, y0, y1, seg, k, { bays = 0, base = null, cap = null, solid = true, rot = 0 } = {}) {
    const rm = (r0 + r1) / 2, w = bays ? (2 * Math.PI * rm) / bays : rm, dy = y1 - y0, dr = r0 - r1, sl = Math.hypot(dy, dr) || 1, b = base === null ? y0 : base, i0 = this.P.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2 + rot, s = Math.sin(a), c = Math.cos(a), nx = (s * dy) / sl, ny = dr / sl, nz = (c * dy) / sl, u = (i / seg) * Math.PI * 2 * rm;
      this.v(cx + s * r0, y0, cz + c * r0, nx, ny, nz, u, y0 - b, k, w); this.v(cx + s * r1, y1, cz + c * r1, nx, ny, nz, u, y1 - b, k, w);
    }
    for (let i = 0; i < seg; i++) { const a = i0 + i * 2; this.quad(a, a + 2, a + 3, a + 1); }
    if (cap !== null && r1 > 0.02) {
      const ci = this.v(cx, y1, cz, 0, 1, 0, cx, cz, cap, 1), r = [];
      for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2 + rot, x = cx + Math.sin(a) * r1, z = cz + Math.cos(a) * r1; r.push(this.v(x, y1, z, 0, 1, 0, x, z, cap, 1)); }
      for (let i = 0; i < seg; i++) this.I.push(ci, r[i], r[i + 1]);
    }
    if (solid) this.S.push({ t: 'cyl', x: cx, z: cz, r: Math.max(r0, r1), y0, y1 });
  }
  // a dome: a hemisphere of radius r on y0; u is the angle times r (the material reads the angle back as u / w), v is height above its own foot
  dome(cx, cz, r, y0, seg, rings, k, solid = true) {
    const i0 = this.P.length / 3;
    for (let j = 0; j <= rings; j++) {
      const ph = (j / rings) * Math.PI * 0.5, cr = Math.cos(ph), sr = Math.sin(ph);
      for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a); this.v(cx + s * cr * r, y0 + sr * r, cz + c * cr * r, s * cr, sr, c * cr, a * r, sr * r, k, r); }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = i0 + j * (seg + 1) + i, b = a + seg + 1; this.quad(a, a + 1, b + 1, b); }
    if (solid) this.S.push({ t: 'cyl', x: cx, z: cz, r: r * 0.92, y0, y1: y0 + r * 0.85 });
  }
  // a pitched roof, its ridge along x at y0 + h: two tiled slopes from eaves that overhang the walls, a dark soffit under them, and gables flush with the
  // walls up to the ridge. u runs along the ridge, v up the slope from the eave
  roof(cx, cz, w, d, y0, h, over, gable = K.LAND_WALL, base = 0) {
    const hw = w / 2 + over, hd = d / 2 + over, x0 = cx - hw, x1 = cx + hw, zf = cz + hd, zb = cz - hd, yt = y0 + h, ye = y0 - (h * over) / (d / 2);
    const sl = Math.hypot(hd, yt - ye), ny = hd / sl, nz = (yt - ye) / sl, e = 0.08;
    this.quad(this.v(x0, ye, zf, 0, ny, nz, 0, 0, K.TILE, 1), this.v(x1, ye, zf, 0, ny, nz, 2 * hw, 0, K.TILE, 1), this.v(x1, yt, cz, 0, ny, nz, 2 * hw, sl, K.TILE, 1), this.v(x0, yt, cz, 0, ny, nz, 0, sl, K.TILE, 1));
    this.quad(this.v(x1, ye, zb, 0, ny, -nz, 0, 0, K.TILE, 1), this.v(x0, ye, zb, 0, ny, -nz, 2 * hw, 0, K.TILE, 1), this.v(x0, yt, cz, 0, ny, -nz, 2 * hw, sl, K.TILE, 1), this.v(x1, yt, cz, 0, ny, -nz, 0, sl, K.TILE, 1));
    this.quad(this.v(x0, ye - e, zf, 0, -ny, -nz, 0, 0, K.DARK, 1), this.v(x0, yt - e, cz, 0, -ny, -nz, 0, 1, K.DARK, 1), this.v(x1, yt - e, cz, 0, -ny, -nz, 1, 1, K.DARK, 1), this.v(x1, ye - e, zf, 0, -ny, -nz, 1, 0, K.DARK, 1));
    this.quad(this.v(x1, ye - e, zb, 0, -ny, nz, 0, 0, K.DARK, 1), this.v(x1, yt - e, cz, 0, -ny, nz, 0, 1, K.DARK, 1), this.v(x0, yt - e, cz, 0, -ny, nz, 1, 1, K.DARK, 1), this.v(x0, ye - e, zb, 0, -ny, nz, 1, 0, K.DARK, 1));
    const gx = w / 2, gd = d / 2;
    for (const sx of [-1, 1]) {      // the gable's corners in the order that faces it out
      const x = cx + sx * gx, za = sx < 0 ? cz - gd : cz + gd, zb2 = sx < 0 ? cz + gd : cz - gd;
      this.I.push(this.v(x, y0, za, sx, 0, 0, za - (cz - gd), y0 - base, gable, LAND_BAY), this.v(x, y0, zb2, sx, 0, 0, zb2 - (cz - gd), y0 - base, gable, LAND_BAY), this.v(x, yt, cz, sx, 0, 0, gd, yt - base, gable, LAND_BAY));
    }
    this.S.push({ t: 'box', x: cx, z: cz, hx: w / 2, hz: d / 4, y0, y1: y0 + h * 0.85 });
  }
  column(x, z, r, y0, h, seg) {
    this.box(x, z, r * 2.6, r * 2.6, y0, y0 + r * 0.9, K.STONE, K.STONE, 3, null, false);
    this.cyl(x, z, r, r * 0.86, y0 + r * 0.9, y0 + h - r * 0.9, seg, K.COLUMN, { solid: false });
    this.box(x, z, r * 2.7, r * 2.7, y0 + h - r * 0.9, y0 + h, K.STONE, K.STONE, 3, null, false);
    this.S.push({ t: 'cyl', x, z, r: r * 1.2, y0, y1: y0 + h });
  }
  geometry() {
    const g = new THREE.BufferGeometry(), n = this.P.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('aFac', new THREE.Float32BufferAttribute(this.F, 4)); g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------------------------------------------------------------------------ the buildings, in metres: geometry, solids, height and footprint
function seaSet(phone) {
  const A = {}, seg = phone ? 14 : 22, cseg = phone ? 8 : 10;
  const crown = (m, y) => { m.cyl(0, 0, 1.7, 1.7, y, y + 1.4, 12, K.GOLD); m.dome(0, 0, 1.8, y + 1.4, 12, 4, K.DOME); m.cyl(0, 0, 0.3, 0.02, y + 3.1, y + 4.6, 6, K.GOLD, { solid: false }); return y + 4.6; };
  // terraced towers: tiers stepping in, a wave frieze under every cornice, paved terraces, a gilded crown
  const terrace = (tiers) => {
    const m = new Mk(); m.box(0, 0, tiers[0][0] + 1.4, tiers[0][1] + 1.4, -2.5, 0.6, K.STONE, K.PAVING, 3);
    let y = 0.6;
    tiers.forEach(([w, d, n], i) => {
      const h = n * SEA_S; m.box(0, 0, w, d, y, y + h, i === 0 ? K.SEA_GROUND : K.SEA_WALL, null, SEA_BAY, y);
      m.box(0, 0, w + 0.3, d + 0.3, y + h - 0.9, y + h, K.FRIEZE, null, 1.1, y + h - 0.9, false);
      m.box(0, 0, w + 0.9, d + 0.9, y + h, y + h + 0.5, K.STONE, K.PAVING, 3);
      y += h + 0.5;
    });
    const H = crown(m, y); return { geo: m.geometry(), solids: m.S, H, W: tiers[0][0] + 1.4 };
  };
  A.terrace2 = terrace([[12, 12, 2], [8.4, 8.4, 2]]);
  A.terrace3 = terrace([[12, 12, 3], [9, 9, 2], [6, 6, 2]]);
  A.terrace5 = terrace([[12, 12, 4], [9.6, 9.6, 3], [7.4, 7.4, 3], [5.4, 5.4, 2]]);
  // a domed hall: a plinth, a drum of tall arched windows, a ring of fluted columns under a frieze, a scale-shingled dome ribbed in gold, a lantern
  {
    const m = new Mk(); m.box(0, 0, 18, 18, -2.5, 1.2, K.STONE, K.PAVING, 3);
    m.cyl(0, 0, 6.2, 6.2, 1.2, 9.6, seg, K.DRUM, { bays: 12 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + Math.PI / 12; m.column(Math.sin(a) * 7.7, Math.cos(a) * 7.7, 0.42, 1.2, 8.4, cseg); }
    m.cyl(0, 0, 8.4, 8.4, 9.6, 10.5, seg, K.FRIEZE, { cap: K.STONE });
    m.dome(0, 0, 6.6, 10.5, seg, phone ? 6 : 9, K.DOME);
    m.cyl(0, 0, 1.0, 1.0, 16.6, 18.0, 10, K.GOLD, { cap: K.GOLD, solid: false });
    m.cyl(0, 0, 0.9, 0.02, 18.0, 20.4, 8, K.GOLD, { solid: false });
    A.dome = { geo: m.geometry(), solids: m.S, H: 20.4, W: 18 };
  }
  // spires: a two-storey base with its arcade, an octagonal shaft banded with glowing slits, a gilded gallery, a shingled cone, a gold point
  const spire = (shaft) => {
    const m = new Mk(); m.box(0, 0, 9.4, 9.4, -2.5, 0.6, K.STONE, K.PAVING, 3);
    m.box(0, 0, 8, 8, 0.6, 9.0, K.SEA_GROUND, null, 2.7, 0.6);
    m.box(0, 0, 8.8, 8.8, 9.0, 9.5, K.STONE, K.PAVING, 3);
    m.cyl(0, 0, 2.9, 2.3, 9.5, 9.5 + shaft, 8, K.SPIRE, { bays: 8, rot: Math.PI / 8 });
    const g = 9.5 + shaft; m.cyl(0, 0, 3.3, 3.3, g, g + 0.7, 16, K.GOLD, { cap: K.PAVING });
    m.cyl(0, 0, 2.0, 1.8, g + 0.7, g + 4.9, 8, K.SPIRE, { bays: 8, rot: Math.PI / 8 });
    m.cyl(0, 0, 2.5, 0.05, g + 4.9, g + 12.5, 8, K.DOME, { rot: Math.PI / 8 });
    m.cyl(0, 0, 0.35, 0.02, g + 12.5, g + 15, 6, K.GOLD, { solid: false });
    return { geo: m.geometry(), solids: m.S, H: g + 15, W: 9.4 };
  };
  A.spireTall = spire(28);
  A.spireShort = spire(15);
  // a low house: two storeys over its arcade, a frieze, a flat roof, a gilded pergola
  {
    const m = new Mk(); m.box(0, 0, 13, 13, -2.5, 0.6, K.STONE, K.PAVING, 3);
    m.box(0, 0, 12, 12, 0.6, 9.0, K.SEA_GROUND, null, SEA_BAY, 0.6);
    m.box(0, 0, 12.3, 12.3, 8.1, 9.0, K.FRIEZE, null, 1.1, 8.1, false);
    m.box(0, 0, 12.8, 12.8, 9.0, 9.5, K.STONE, K.PAVING, 3);
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) m.cyl(x, z, 0.16, 0.16, 9.5, 12.0, 6, K.GOLD, { solid: false });
    for (let i = -3; i <= 3; i += 1.5) m.box(i, 0, 0.25, 6.8, 12.0, 12.25, K.GOLD, K.GOLD, 3, null, false);
    A.low = { geo: m.geometry(), solids: m.S, H: 12.3, W: 13 };
  }
  // a colonnade along an avenue: a stylobate, six fluted columns, a frieze, a cornice
  {
    const m = new Mk(); m.box(0, 0, 12.8, 2.6, -2.0, 0.5, K.STONE, K.PAVING, 3);
    for (let i = 0; i < 6; i++) m.column(-5.5 + i * 2.2, 0, 0.38, 0.5, 6.3, cseg);
    m.box(0, 0, 12.8, 1.6, 6.8, 7.7, K.FRIEZE, K.STONE, 1.1, 6.8);
    m.box(0, 0, 13.3, 2.0, 7.7, 8.1, K.STONE, K.STONE, 3);
    A.colonnade = { geo: m.geometry(), solids: m.S, H: 8.1, W: 13.3 };
  }
  // a lamp: a bronze post and a glowing globe
  {
    const m = new Mk(); m.box(0, 0, 0.9, 0.9, -1, 0.3, K.STONE, K.STONE, 3, null, false);
    m.cyl(0, 0, 0.17, 0.12, 0.3, 5.4, 8, K.GOLD, { solid: false });
    m.cyl(0, 0, 0.55, 0.55, 5.4, 6.3, 10, K.LAMP, { solid: false }); m.cyl(0, 0, 0.62, 0.05, 6.3, 6.9, 10, K.GOLD, { solid: false });
    m.S.push({ t: 'cyl', x: 0, z: 0, r: 0.35, y0: -1, y1: 6.9 });
    A.lamp = { geo: m.geometry(), solids: m.S, H: 6.9, W: 1.2 };
  }
  // a block's paved platform: a unit slab, scaled to the block (its paving and courses are drawn in world space, so a stretched slab stays true)
  { const m = new Mk(); m.box(0, 0, 1, 1, -4, 0, K.STONE, K.PAVING, 3); A.plinth = { geo: m.geometry(), solids: m.S, H: 0, W: 1 }; }
  return A;
}
function landSet(phone) {
  const A = {}, seg = phone ? 8 : 12;
  // town houses: plaster walls, shuttered windows, a door, a terracotta roof with eaves, a chimney
  const house = (w, d, n, roofH) => {
    const m = new Mk(); m.box(0, 0, w + 0.5, d + 0.5, -1.5, 0.2, K.STONE, K.PAVING, 3);
    const h = n * LAND_S; m.box(0, 0, w, d, 0.2, 0.2 + h, K.LAND_WALL, null, LAND_BAY, 0.2);
    m.roof(0, 0, w, d, 0.2 + h, roofH, 0.45, K.LAND_WALL, 0.2);
    m.box(w * 0.28, -d * 0.18, 0.7, 0.7, 0.2 + h, 0.2 + h + roofH + 1.0, K.STONE, K.DARK, 3, null, false);
    return { geo: m.geometry(), solids: m.S, H: 0.2 + h + roofH + 1.0, W: Math.max(w, d) + 0.5 };
  };
  A.house2 = house(7.0, 6.0, 2, 2.4);
  A.house3 = house(5.8, 6.2, 3, 2.1);
  // the town's bell tower, on its plaza: a stone shaft, a belfry of open arches, a tiled pyramid
  {
    const m = new Mk(); m.box(0, 0, 6, 6, -1.5, 0.3, K.STONE, K.PAVING, 3);
    m.box(0, 0, 5, 5, 0.3, 18.3, K.STONE, null, 3, 0.3);
    m.box(0, 0, 5.4, 5.4, 18.3, 22.5, K.SEA_GROUND, null, 2.5, 18.3);
    m.box(0, 0, 5.9, 5.9, 22.5, 23.0, K.STONE, K.STONE, 3);
    m.cyl(0, 0, 4.1, 0.05, 23.0, 28.0, 4, K.TILE, { rot: Math.PI / 4 });
    A.campanile = { geo: m.geometry(), solids: m.S, H: 28, W: 6 };
  }
  // the market hall: an open arcade under a long tiled roof
  {
    const m = new Mk(); m.box(0, 0, 13, 9, -1.5, 0.2, K.STONE, K.PAVING, 3);
    m.box(0, 0, 12, 8, 0.2, 4.6, K.SEA_GROUND, null, 3, 0.2);
    m.roof(0, 0, 12, 8, 4.6, 3.0, 0.6, K.STONE, 0.2);
    A.market = { geo: m.geometry(), solids: m.S, H: 7.6, W: 13 };
  }
  // a market stall: timber posts, a counter and a striped awning
  {
    const m = new Mk(); for (const x of [-1.5, 1.5]) for (const z of [-1, 1]) m.cyl(x, z, 0.07, 0.07, 0, 2.4, 5, K.TIMBER, { solid: false });
    m.box(0, -0.1, 3.4, 2.5, 2.4, 2.5, K.AWNING, K.AWNING, 3, null, false); m.box(0, 0, 3.0, 1.6, 0, 0.9, K.TIMBER, K.TIMBER, 3);
    A.stall = { geo: m.geometry(), solids: m.S, H: 2.5, W: 3.4 };
  }
  // a street lamp
  {
    const m = new Mk(); m.cyl(0, 0, 0.11, 0.08, 0, 3.8, 6, K.DARK, { solid: false }); m.cyl(0, 0, 0.3, 0.3, 3.8, 4.5, seg, K.LAMP, { solid: false }); m.cyl(0, 0, 0.36, 0.03, 4.5, 4.9, seg, K.DARK, { solid: false });
    m.S.push({ t: 'cyl', x: 0, z: 0, r: 0.22, y0: 0, y1: 4.9 });
    A.lamp = { geo: m.geometry(), solids: m.S, H: 4.9, W: 0.8 };
  }
  { const m = new Mk(); m.box(0, 0, 1, 1, -3, 0, K.STONE, K.PAVING, 3); A.plinth = { geo: m.geometry(), solids: m.S, H: 0, W: 1 }; }
  return A;
}

// ------------------------------------------------------------------------------------------------ the plan
export function planCities(data, heightAt, opts = {}) {
  const phone = !!opts.phone, poi = new Map((data.poi || []).map((p) => [p.id, p])), colliders = [], cities = [], why = {};
  const no = (city, r) => { const k = city + ':' + r; why[k] = (why[k] || 0) + 1; };      // why a lot stayed empty (for the checks)
  const sets = { sea: seaSet(phone), land: landSet(phone) };
  // first each city clears its footprint of the clutter it replaces (so this runs before the world draws or collides with any instance)
  const cleared = {};
  for (const def of CITIES) {
    const p = poi.get(def.id); if (!p || !data.instances) continue;
    const cx0 = p.x + (def.shift ? def.shift[0] : 0), cy0 = p.y + (def.shift ? def.shift[1] : 0), R = p.r * (def.radius || 0.96), keepPoi = def.keep.map((id) => poi.get(id)).filter(Boolean);
    for (const kind of CLEARS[def.kind]) {
      const I = data.instances[kind]; if (!I || !I.length) continue;
      const out = []; let gone = 0;
      for (let k = 0; k + 5 < I.length; k += 6) {
        const x = I[k], y = I[k + 1], inside = Math.hypot(x - cx0, y - cy0) < R && !keepPoi.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + 4);
        if (inside) gone++; else for (let j = 0; j < 6; j++) out.push(I[k + j]);
      }
      if (gone) { data.instances[kind] = out; cleared[def.id + ':' + kind] = gone; }
    }
  }
  // where not to build: every existing solid kit piece, with its margin, in a hash grid so each lot asks only its neighbours
  const KC = 24, kgrid = new Map();
  for (const kind in SOLID_KINDS) {
    const I = data.instances && data.instances[kind]; if (!I) continue; const m = SOLID_KINDS[kind];
    for (let k = 0; k + 5 < I.length; k += 6) { const e = [I[k], I[k + 1], m * Math.max(1, I[k + 4] * 0.6)], key = Math.floor(e[0] / KC) + ',' + Math.floor(e[1] / KC); (kgrid.get(key) || kgrid.set(key, []).get(key)).push(e); }
  }
  const blocked = (x, y, r) => { const cx = Math.floor(x / KC), cy = Math.floor(y / KC); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const L = kgrid.get((cx + i) + ',' + (cy + j)); if (L) for (const k of L) if ((k[0] - x) ** 2 + (k[1] - y) ** 2 < (k[2] + r) ** 2) return true; } return false; };
  const rivers = data.rivers || [];
  const nearRiver = (x, y, m = 7) => { for (const r of rivers) for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)), px = a[0] + dx * t - x, py = a[1] + dy * t - y; if (px * px + py * py < (r.w * 0.5 + m) ** 2) return true; } return false; };
  const ground = (x, y, hw, hd, ca, sa) => { let lo = Infinity, hi = -Infinity; for (const [u, v] of [[0, 0], [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd], [hw, 0], [-hw, 0], [0, hd], [0, -hd]]) { const z = heightAt(x + u * ca - v * sa, y + u * sa + v * ca); if (z < lo) lo = z; if (z > hi) hi = z; } return [lo, hi]; };

  for (const def of CITIES) {
    const p = poi.get(def.id); if (!p) continue;
    const rand = rng((Math.round(p.x * 131 + p.y * 977) ^ 0x9e37) >>> 0), R = p.r * (def.radius || 0.96), ca = Math.cos(def.angle), sa = Math.sin(def.angle), A = sets[def.kind];
    const cx0 = p.x + (def.shift ? def.shift[0] : 0), cy0 = p.y + (def.shift ? def.shift[1] : 0);
    const keepPoi = def.keep.map((id) => poi.get(id)).filter(Boolean), sea = def.kind === 'sea', B = def.block, inner = B - def.street, half = Math.ceil(R / B);
    const surface = -3;                                                      // a sea piece's top stays this far under the water
    // every piece goes in through here, so none can break the surface, whatever placed it
    const inst = {}, put = (type, x, y, z, yaw, sx, sy, sz, tint) => { if (sea && A[type] && z + A[type].H * sy > surface) return false; (inst[type] ||= []).push([x, y, z, yaw, sx, sy, sz, tint || def.tint]); return true; };
    const W = (u, v) => [cx0 + u * ca - v * sa, cy0 + u * sa + v * ca];
    const nearKeep = (x, y, r) => keepPoi.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + r);
    let plaza = null;
    for (let gi = -half; gi <= half; gi++) for (let gj = -half; gj <= half; gj++) {
      const lu = gi * B, lv = gj * B, [bx, by] = W(lu, lv), dC = Math.hypot(lu, lv);
      if (dC > R - B * 0.3) continue;
      // ---- the heart: a plaza (when no landmark stands there): paving, lamps at its corners; a domed hall under the sea, the bell tower and market hall on land
      if (gi === 0 && gj === 0) {
        if (nearKeep(bx, by, B * 0.5) || blocked(bx, by, B * 0.4)) { no(def.id, 'plaza: kit or landmark'); continue; }
        const [lo, hi] = ground(bx, by, B * 0.5, B * 0.5, ca, sa); if (hi - lo > (sea ? 6 : 3)) { no(def.id, 'plaza: steep ' + (hi - lo).toFixed(1)); continue; } if (sea && hi > surface - 22) continue; if (!sea && lo < 0.6) continue;
        plaza = [bx, by, hi]; put('plinth', bx, by, hi + 0.15, def.angle, B - 2, 1, B - 2);
        for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [x, y] = W(u * (B / 2 - 3), v * (B / 2 - 3)); put('lamp', x, y, hi + 0.15, def.angle, 1, 1, 1); }
        if (!sea) { put('campanile', bx, by, hi + 0.15, def.angle, 1, 1, 1); const [mx, my] = W(0, B / 2 - 6.5); put('market', mx, my, hi + 0.15, def.angle + Math.PI, 0.9, 0.9, 0.9); }
        else put('dome', bx, by, hi + 0.15, def.angle, 1.1, 1.1, 1.1);
        continue;
      }
      // ---- the two grand avenues: paved, lamps along both sides; colonnades under the sea, stalls on land
      if (gi === 0 || gj === 0) {
        if (nearKeep(bx, by, def.avenue)) continue;
        const along = gi === 0 ? def.angle + Math.PI / 2 : def.angle, au = Math.cos(along), av = Math.sin(along), cu = -av, cv = au;
        const lo = Math.min(heightAt(bx, by), heightAt(bx + au * B * 0.5, by + av * B * 0.5), heightAt(bx - au * B * 0.5, by - av * B * 0.5));
        if (!sea && lo < 0.6) continue; if (sea && lo > surface - 8) continue;
        if (!blocked(bx, by, def.avenue * 0.6) && !nearRiver(bx, by, 2)) put('plinth', bx, by, lo + 0.12, along, B, 1, def.avenue);
        for (const s of [-1, 1]) {
          const off = def.avenue * 0.5 + (sea ? 1.8 : 0.9), ox = bx + cu * off * s, oy = by + cv * off * s;
          for (const t of [-0.25, 0.25]) { const lx = ox + au * B * t, ly = oy + av * B * t; if (!blocked(lx, ly, 1.5) && !nearRiver(lx, ly, 2)) put('lamp', lx, ly, heightAt(lx, ly), along, 1, 1, 1); }
          if (sea && rand() < 0.8) { const cx2 = ox + cu * s * 1.6, cy2 = oy + cv * s * 1.6, z = Math.min(heightAt(cx2, cy2), heightAt(cx2 + au * 6, cy2 + av * 6), heightAt(cx2 - au * 6, cy2 - av * 6)); if (!blocked(cx2, cy2, 6.5) && z < surface - 9) put('colonnade', cx2, cy2, z, along, 1, 1, 1); }
          else if (!sea && rand() < 0.55) { const sx = ox + cu * s * 2.5, sy = oy + cv * s * 2.5, z = heightAt(sx, sy); if (!blocked(sx, sy, 2.5) && !nearRiver(sx, sy, 3) && z > 0.6) put('stall', sx, sy, z, along + (s > 0 ? Math.PI : 0), 1, 1, 1); }
        }
        continue;
      }
      // ---- a block: a paved platform at its highest ground when the ground is gentle enough, then its four lots, each one building
      const [blo, bhi] = ground(bx, by, inner * 0.5, inner * 0.5, ca, sa);
      if (!sea && bhi < 0.6) { no(def.id, 'block in the sea'); continue; }
      let base = null;
      if (bhi - blo < (sea ? 5 : 2.5) && (!sea || bhi < surface - 12) && (sea || blo > 0.4) && !blocked(bx, by, inner * 0.55) && !nearKeep(bx, by, inner * 0.6) && !nearRiver(bx, by, inner * 0.5)) { base = bhi + 0.15; put('plinth', bx, by, base, def.angle, inner + 1.5, 1, inner + 1.5); }
      const lw = inner / 2, ld = inner / 2;
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        if (rand() < (sea ? 0.07 : 0.08)) continue;                        // a court, a garden, a gap
        const u = lu - inner / 2 + lw * (a + 0.5), v = lv - inner / 2 + ld * (b + 0.5), [x, y] = W(u, v), foot = Math.min(lw, ld) - 1.0;
        if (Math.hypot(u, v) > R) { no(def.id, 'outside'); continue; } if (nearKeep(x, y, foot * 0.7)) { no(def.id, 'landmark'); continue; } if (blocked(x, y, foot * 0.6)) { no(def.id, 'kit piece'); continue; } if (nearRiver(x, y)) { no(def.id, 'river'); continue; }
        const [lo, hi] = ground(x, y, foot * 0.5, foot * 0.5, ca, sa);
        let z;
        if (base !== null) z = base;
        else if (sea) { if (hi - lo > 6) continue; z = lo - 0.2; }
        else {      // a hill town: a house on a slope stands on a stone foundation at its uphill side, the foundation showing down to the ground on its low side
          if (hi - lo > 6.5) { no(def.id, 'too steep'); continue; } z = hi - 0.1;
          if (hi - lo > 0.7) put('plinth', x, y, z, def.angle, foot + 0.6, (hi - lo + 1.2) / 3, foot + 0.6);
        }
        if (!sea && lo < 0.6) { no(def.id, 'sea, not land'); continue; }
        // its front to the street on its side of the block (lot b = 0 faces the street at lower v, b = 1 the one at higher v)
        let yaw = def.angle + (b === 1 ? Math.PI : 0);
        const ring = Math.hypot(u, v) / R, r0 = rand();
        if (sea) {
          const room = surface - z;                                         // how tall a building can stand here and stay under the water
          const fits = (t) => A[t].H * Math.min(1.12, foot / A[t].W) < room;
          const order = ring < 0.38 ? [['dome', 0.26], ['spireTall', 0.4], ['spireShort', 0.46], ['terrace5', 0.72], ['terrace3', 0.92], ['terrace2', 1.01]]
            : ring < 0.66 ? [['spireTall', 0.12], ['spireShort', 0.2], ['terrace5', 0.38], ['terrace3', 0.72], ['terrace2', 0.92], ['low', 1.01]]
              : [['terrace3', 0.25], ['terrace2', 0.6], ['low', 1.01]];
          let hit = order.find(([t, w8]) => r0 < w8 && fits(t)); if (!hit) hit = [['terrace3'], ['terrace2'], ['low']].find(([t]) => fits(t));
          if (!hit) continue;
          const t = hit[0], s = Math.min(1.12, foot / A[t].W), tone = 0.93 + rand() * 0.12;
          if (s < 0.6) continue;
          put(t, x, y, z, yaw + (t === 'dome' || t.startsWith('spire') ? rand() * 0.3 : 0), s, s, s, [def.tint[0] * tone, def.tint[1] * tone, def.tint[2] * tone]);
        } else {
          const t = r0 < 0.55 ? 'house2' : 'house3', s = Math.min(1.1, foot / A[t].W);
          if (s < 0.7) continue;
          if (a === 0 && rand() < 0.3) yaw = def.angle - Math.PI / 2; else if (a === 1 && rand() < 0.3) yaw = def.angle + Math.PI / 2;      // a corner house to its cross street
          put(t, x, y, z, yaw, s, s * (0.95 + rand() * 0.1), s, PLASTER[Math.floor(rand() * PLASTER.length)]);
        }
      }
    }
    cities.push({ def, p, inst, plaza });
  }
  // every building's solids, turned and scaled as it stands. The archetype's local x and z (scene) become the world's x, y: local z is -y before the turn
  for (const c of cities) for (const type in c.inst) {
    const A = sets[c.def.kind][type]; if (!A) continue;
    for (const [x, y, z, yaw, sx, sy, sz] of c.inst[type]) {
      const co = Math.cos(yaw), si = Math.sin(yaw);
      for (const s of A.solids) {
        const lx = s.x * sx, ly = -s.z * sz, wx = x + lx * co - ly * si, wy = y + lx * si + ly * co;
        if (s.t === 'cyl') colliders.push({ t: 'cyl', x: wx, y: wy, z0: z + s.y0 * sy, z1: z + s.y1 * sy, r: s.r * Math.max(sx, sz), city: c.def.id, type });
        else colliders.push({ t: 'box', x: wx, y: wy, z0: z + s.y0 * sy, z1: z + s.y1 * sy, hx: s.hx * sx, hy: s.hz * sz, yaw, city: c.def.id, type });
      }
    }
  }
  const count = {}; let total = 0, tris = 0;
  for (const c of cities) { count[c.def.id] = {}; for (const t in c.inst) { count[c.def.id][t] = c.inst[t].length; if (t !== 'plinth' && t !== 'lamp') total += c.inst[t].length; tris += c.inst[t].length * (sets[c.def.kind][t].geo.index.count / 3); } }

  // the ink line (a comic's outline): each building drawn again inside out, pushed out along smooth normals (welded, so the hull closes at every corner)
  const hulls = new Map();
  function hullOf(geo) {
    if (hulls.has(geo)) return hulls.get(geo);
    const flat = geo.toNonIndexed(), g = new THREE.BufferGeometry(); g.setAttribute('position', flat.attributes.position.clone());
    const w = mergeVertices(g, 1e-3); w.computeVertexNormals(); hulls.set(geo, w); return w;
  }
  function build(scene, matFor) {
    const meshes = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
    for (const c of cities) {
      const group = new THREE.Group(); group.name = 'city_' + c.def.id; scene.add(group);
      for (const type in c.inst) {
        const A = sets[c.def.kind][type], L = c.inst[type]; if (!A || !L.length) continue;
        const im = new THREE.InstancedMesh(A.geo, matFor(type), L.length);
        im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(L.length * 3), 3);
        L.forEach(([x, y, z, yaw, sx, sy, sz, tint], i) => { v.set(x, z, -y); e.set(0, yaw, 0); q.setFromEuler(e); s.set(sx, sy, sz); m4.compose(v, q, s); im.setMatrixAt(i, m4); col.setRGB(tint[0], tint[1], tint[2]); im.setColorAt(i, col); });
        im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.name = 'city_' + c.def.id + '_' + type;
        group.add(im); meshes.push(im);
        const ink = type === 'plinth' ? null : matFor('ink');
        if (ink) { const om = new THREE.InstancedMesh(hullOf(A.geo), ink, L.length); om.instanceMatrix.copy(im.instanceMatrix); om.frustumCulled = false; om.name = im.name + '_ink'; group.add(om); }
      }
    }
    return meshes;
  }
  // a whole city is drawn only while the camera is near enough to see it through the water (or across the haze on land)
  function update(scene, cam, ph) {
    for (const c of cities) { const g = scene.getObjectByName('city_' + c.def.id); if (!g) continue; const d = Math.hypot(cam.x - c.p.x, -cam.z - c.p.y); g.visible = d < c.p.r + (c.def.kind === 'land' ? (ph ? 700 : 1100) : (ph ? 340 : 560)); }
  }
  return { colliders, cities, count, total, tris, why, cleared, build, update };
}
