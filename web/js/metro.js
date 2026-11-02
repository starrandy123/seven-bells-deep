// The skyscraper city (Randy, 2 Nov: "We need ground cities too with skyscrapers and full anime type POIs we can visit and do fights in"; that night: "What about the skyscrapers cities? We need that design and implemented too").
// Laid out from the cities study, Pipeline/research/CITY_SOURCES.md §4, in its order: the island, the plan, the heights, the towers, the street, then the places.
// The plan: a 64 m pitch, 52 m blocks and 12 m streets, every third street an avenue. The heights: a 31 m roofline, as old Tokyo's height limit left a level cornice that towers later broke, with rare towers rising out of it
// (31 + 155 r³ in the core, as one open city generator does), and the top storeys stepped back off the street, as Japan's road-slant rule cuts them. A tower is stretched boxes, one draw for every tier of every building,
// and its windows are rooms drawn in the shader by van Dongen's interior mapping: a ray into a box one bay wide and one storey high, so a city of rooms costs no textures at all.
// Working names, owed a names search: Saltlight, the Signal Mast, the Bell Ring.
import * as THREE from 'three';
import { FAMILY, STREET, measureStreets, familyGLSL } from './metro_kit.js';
import { createNearBuildings, DMG_PARS } from './saltlight_build.js';
import { createSaltlightTrees } from './saltlight_trees.js';

export const METRO = { id: 'saltlight', name: 'Saltlight', x: -30, y: -750, R: 230, Z: 2.5 };
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const PITCH = 64, BLOCK = 52, STOREY = 3.4, DATUM = 31, EXTENT = 220;
// the grid the street life walks and drives on (streetlife.js): five blocks across and four deep, between the quays and the hills
const COLS = [-2, 2], ROWS = [-2, 1];
export const GRID = { PITCH, BLOCK, EXTENT, COLS, ROWS };
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

// ---------------------------------------------------------------- the land
// Randy, 2 Nov: "We need the city placed on land and not segregated from the shit" · "Make sure the land is primed to support the city and elevations and shit well"; his pick: a mainland grown from the Burnt Isle.
// From Pipeline/research/CITY_LIFE_SOURCES.md, "The city's land": a coastal plain between the sea and hills, facing the volcano along the coast, as Kagoshima faces its own, Kobe lies between sea and
// mountains and Naples sits in a bay under its hills with a headland on its west. The quays on the north and west have their crown at +2.5 m (NILIM: a large quay 1.0-2.0 m over high water, and where
// waves reach it HWL + H1/3/2 + 0.5 m; this sea's waves run to about 2 m), the water beside them dredged to 8 m; the north quay stands on reclaimed land, as Kobe's and Hong Kong's do. The plain rises
// inland at 2.1%, so a kerb's gutter drains (0.5% at least) and an avenue stays well under an arterial's 4-6%. East of the quays a beach runs round into the Burnt Isle's black shore at the Ash City.
// Behind: hills with spurs and gullies, a crest that wanders and rounds over (W26: no razor crease, no smooth face, a foot that blends in; the cliff dresser sets crags in the steep), cliffs into the
// sea on their far side, and a headland on the west.
const QN = -636, QW = -208, FOOT = -920, GRADE = 0.021, QUAY = 2.5, DREDGE = -8, QE = 150, EAST = 260;
export const LAND = { QN, QW, FOOT, GRADE, QUAY, QE, EAST };
// the plain itself, a plane: every street, kerb, lamp and building foot stands on it
export function metroGround(x, y) { return QUAY + GRADE * Math.max(0, QN - y); }
const wav = (x, y) => 0.5 * Math.sin(x * 0.071 + y * 0.053) + 0.3 * Math.sin(x * 0.137 - y * 0.111 + 1.7) + 0.2 * Math.sin(x * 0.29 + y * 0.23 + 0.6);
// the hills' foot: along the south, and bending north up the west side, where the headland stands
const footY = (x) => FOOT + 76 * smooth((-190 - x) / 56);
// the plain's own ground: inside the quays and the beach, short of the hills' foot
export function onPlain(x, y, pad = 0) { return x > QW - pad && y < QN + pad && y > footY(x) - 4 - pad && x < QE + 30 + pad; }
// the shore line on the north: the quay straight to the grid's corner, then a beach bending back into a cove and out to the isle
const shoreN = (x) => x <= QE ? QN : QN - 16 * smooth((x - QE) / 46) + 9 * smooth((x - QE - 50) / 50) + 2.2 * Math.sin(x * 0.11);
// how far inside the quays and the shore a point is: the north and west quays meet round a 14 m corner
function inside(x, y) {
  const R = 14, cx = QW + R, cy = QN - R;
  if (x < cx && y > cy) return R - Math.hypot(x - cx, y - cy);
  return Math.min(x - QW, shoreN(x) - y);
}
// the hills: a mass along the south with two summits (58 m over the west of the city, 52 m over the east), spurs and gullies down the north face every 68 m or so, the crest rounding over,
// a headland on the west, cliffs on the far side into the sea before the world's edge, and their east end falling into the saddle by the isle. Returns -99 where there is none
function hills(x, y) {
  const fy = footY(x); if (y > fy + 2) return -99;
  const crestY = -978 + 8 * Math.sin(x * 0.021 + 0.8) + 5 * Math.sin(x * 0.057) + 46 * smooth((-196 - x) / 64), foot = metroGround(x, Math.min(fy, -600));
  const crestH = 42 + 16 * Math.exp(-(((x + 140) / 72) ** 2)) + 10 * Math.exp(-(((x - 72) / 58) ** 2)) + 4 * Math.sin(x * 0.09 + 1.2) + 2.5 * Math.sin(x * 0.23 + 0.4);
  const k = (1 - smooth((x - 140) / 90)) * smooth((x + 305) / 48), spur = 0.5 + 0.5 * Math.cos((x / 68) * 6.283 + 0.6 * Math.sin(x * 0.013));
  let z;
  if (y >= crestY) {
    const t = Math.min(1, Math.max(0, (fy - y) / (fy - crestY)));
    z = foot + (crestH - foot) * Math.pow(smooth(t), 1 + 0.7 * (1 - spur)) * k + (3.2 * wav(x, y) + 1.2 * wav(x * 2.3 + 40, y * 2.3)) * Math.sin(Math.PI * t) * k;
  } else {
    const t = Math.min(1, Math.max(0, (crestY - y) / (crestY + 1016))), top = foot + (crestH - foot) * k;
    z = top + (-10 - top) * smooth(t) * (0.55 + 0.45 * t) + (2.6 * wav(x + 13, y) + 1.1 * wav(x * 2.1, y * 2.1 - 30)) * Math.sin(Math.PI * Math.min(1, t * 1.6)) * k;
  }
  // the west face of the headland falls into the strait
  if (x < -262) z = z + (-10 - z) * smooth((-262 - x) / 40);
  return z;
}
export function metroZ(x, y, bed) {
  if (x < -320 || x > 300 || y > -570) return bed;
  const deep = Math.min(bed, DREDGE);
  let z = bed;
  if (y > footY(x) - 6 && x < EAST) {
    const d = inside(x, y);
    if (x <= QE || x < QW + 30) z = d > 0 ? metroGround(x, y) : deep + (bed - deep) * smooth((-d - 2) / 50);
    // the beach east of the quays: the berm at 1.2 m, down to 4 m under the sea 25 m out, then the old sea floor
    else z = d > 18 ? metroGround(x, y) : d > 0 ? 1.2 + (metroGround(x, y) - 1.2) * smooth(d / 18) : 1.2 + (Math.min(bed, -4) - 1.2) * smooth(-d / 25) + (bed - Math.min(bed, -4)) * smooth((-d - 25) / 30);
    if (x > EAST - 40) z = z + (bed - z) * smooth((x - EAST + 40) / 40);
  }
  const h = hills(x, y); if (h > z) z = h;
  return z;
}
export function raiseMetro(data, Hz, n, cell, ox, oy) {
  const i0 = Math.max(0, Math.floor((-300 - ox) / cell)), i1 = Math.min(n - 1, Math.ceil((270 - ox) / cell)), j0 = Math.max(0, Math.floor((-1024 - oy) / cell)), j1 = Math.min(n - 1, Math.ceil((-590 - oy) / cell));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const o = j * n + i; Hz[o] = metroZ(ox + i * cell, oy + j * cell, Hz[o]); }
  // a pearl that was on the old sea floor now lies on the new ground
  for (const p of data.pearls || []) { const g = metroZ(p[0], p[1], p[2] - 2); if (g > p[2] - 1) p[2] = g + 1.3; }
  dressRidge(data);
}
// what stood on this sea floor is under the land now
const landAt = (x, y) => metroZ(x, y, -40) > -1;
export function addMetro(data) {
  if (data.poi.some((p) => p.id === METRO.id)) return;
  data.poi.push({ id: METRO.id, name: METRO.name, x: METRO.x, y: METRO.y, z: metroGround(METRO.x, METRO.y), r: 190, noBreak: true, metro: true });
  for (const k in data.instances) { const L = data.instances[k]; let hit = false; for (let i = 0; i < L.length; i += 6) if (landAt(L[i], L[i + 1])) { hit = true; break; } if (!hit) continue; const keep = []; for (let i = 0; i < L.length; i += 6) if (!landAt(L[i], L[i + 1])) keep.push(L[i], L[i + 1], L[i + 2], L[i + 3], L[i + 4], L[i + 5]); data.instances[k] = keep; }
  // the fish go out to the open water north of the quays
  for (const s of data.schools || []) if (landAt(s.x, s.y) || inside(s.x, s.y) > -12 && s.x > QW - 12 && s.x < EAST) { s.y = QN + 40 + ((s.x * 7.3) % 30 + 30) % 30; if (s.x < QW) s.x = QW - 40; }
}
// The ridge's woods, placed by rule on its slope and height, the way shipped open worlds place their plants (van Muijden, GDC 2017, as cliffs.js reads it): oaks where soil holds (under 35°),
// palms low on the warm side, bushes and ferns beneath them, meadow on the gentle shoulders; nothing on the plain, nothing on rock too steep for soil (the cliff dresser's)
function dressRidge(data) {
  const rnd = rngOf(4242), add = (k, x, y, z, yaw, s, t) => { (data.instances[k] ||= []).push(+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), +yaw.toFixed(3), +s.toFixed(3), +t.toFixed(3)); };
  const slopeAt = (x, y) => { const e = 1.5, gx = (metroZ(x + e, y, -40) - metroZ(x - e, y, -40)) / (2 * e), gy = (metroZ(x, y + e, -40) - metroZ(x, y - e, -40)) / (2 * e); return Math.hypot(gx, gy); };
  for (let k = 0; k < 4200; k++) {
    const x = -300 + rnd() * 450, y = -1016 + rnd() * 200, z = metroZ(x, y, -40); if (z < 3.5 || y > footY(x) - 4) continue;
    const sl = slopeAt(x, y), deg = Math.atan(sl) * 57.3, r = rnd(); if (deg > 38) continue;
    const thin = smooth((deg - 22) / 16), yaw = rnd() * 6.283;
    if (r < 0.16 * (1 - thin)) add(z < 18 && rnd() < 0.35 ? (rnd() < 0.5 ? 'palm_a' : 'palm_b') : rnd() < 0.6 ? 'tree_oak_a' : 'tree_oak_b', x, y, z - 0.3, yaw, 0.8 + rnd() * 0.55, rnd());
    else if (r < 0.34) add(rnd() < 0.55 ? 'bush' : 'fern', x, y, z - 0.1, yaw, 0.7 + rnd() * 0.7, rnd());
    else if (r < 0.52 && deg < 24) add('grass_patch', x, y, z, yaw, 0.8 + rnd() * 0.5, rnd());
    else if (r < 0.545 && deg < 20) add('wildflowers', x, y, z, yaw, 0.8 + rnd() * 0.4, rnd());
  }
}
// The new land's ground in the biome map: the ridge green (the kelp weight is the land's meadow and wood above the tide), the plain and the harbour floor paved (the city weight)
export function paintMetro(b, bn, c, ox, oy) {
  const i0 = Math.max(0, Math.floor((-300 - ox) / c)), i1 = Math.min(bn - 1, Math.ceil((270 - ox) / c)), j0 = Math.max(0, Math.floor((-1024 - oy) / c)), j1 = Math.min(bn - 1, Math.ceil((-590 - oy) / c));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = ox + i * c, y = oy + j * c, z = metroZ(x, y, -40), o = (j * bn + i) * 4; if (z < -30) continue;
    const plain = onPlain(x, y) && y > footY(x) + 2 && inside(x, y) > 0 ? 1 : 0, k = Math.max(0, Math.min(1, (z + 12) / 10));
    const w = plain ? [0, 0, 255, 0] : z > 1 ? [0, 255, 0, 0] : [0, 0, 255, 0];
    for (let q = 0; q < 4; q++) b[o + q] = Math.round(w[q] * k + b[o + q] * (1 - k));
  }
  return b;
}

// ---------------------------------------------------------------- the plan
// Every box is { x, y (data), z0, h, sx, sy, yaw, seed, foot, kind, bay }: kind 0 a storeyed volume with windows, 1 roof gear, 2 an aircraft lamp
// The AAA3d generator's own vertical layout (aaa3d/cityGen.js, SkyscraperGenerator.build), replayed so what can be stood on is what is drawn: its floors and bays snapped to the brick
// (0.6 m), its height a whole number of floors, its base and crown fractions the first two draws of its seeded stream, its crown set back by setbackDepth bays. (A height not a whole
// number of floors left the drawn roof up to half a floor over the box he stood on: Randy, 2 Nov, "It seems the character fell inside the buildings too")
function genLayout(gen) {
  let s = (gen.seed >>> 0) || 1; const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const baseF = 0.10 + rand() * 0.07, crownF = 0.08 + rand() * 0.08;
  const fh = Math.max(1.8, Math.round(gen.floorHeight / 0.6) * 0.6), bw = Math.max(1.8, Math.round(gen.bayWidth / 0.6) * 0.6);
  const floors = Math.max(3, Math.round(gen.totalHeight / fh)), bF = Math.max(1, Math.round(floors * baseF)), cF = Math.max(1, Math.round(floors * crownF)), sF = Math.max(1, floors - bF - cF);
  return { H: (bF + sF + cF) * fh, shaftTop: (bF + sF) * fh, inset: (gen.setbackDepth || 0) * bw, fh, bw };
}
export function planMetro(data) {
  const rnd = rngOf(90210), boxes = [], colliders = [], signs = [], parks = [], cx = METRO.x, cy = METRO.y; let tall60 = 0, tall150 = 0, lots = 0;
  // the towers crowd the business district on the waterfront, west of the centre, as a port city's do (its quays, its station), and fall away up the slope towards the ridge
  const cbd = { x: cx - 0.5 * PITCH, y: cy + 0.5 * PITCH };
  // each building's facade family and wall tone (metro_kit.js FAMILY): a tower's podium may take a different one from its shaft, a bottom and an upper style as the demo city's grammar has
  let cur = { bid: 0, fam: 1, tone: 0 };
  const box = (b) => { if (b.kind === 0) { b.bid = cur.bid; b.fam = cur.fam; b.tone = cur.tone; } boxes.push(b); if (b.kind !== 2 && !b.nocol) colliders.push({ t: 'box', x: b.x, y: b.y, z0: b.z0, z1: b.z0 + b.h, hx: b.sx / 2, hy: b.sy / 2, yaw: b.yaw || 0, city: METRO.id, type: 'tower' }); };
  // the places take their blocks first: the Bell Ring a square of four on the harbour, east of the centre, looking across at the volcano; the Signal Mast by the western quay, where the sea sees it
  const ring = { i0: 1, j0: 0, x: cx + 1.5 * PITCH, y: cy + 0.5 * PITCH }, mast = { x: cx - 2 * PITCH, y: cy };
  const taken = (i, j) => (i >= 1 && i <= 2 && j >= 0 && j <= 1) || (i === -2 && j === 0);
  for (let i = COLS[0]; i <= COLS[1]; i++) for (let j = ROWS[0]; j <= ROWS[1]; j++) {
    const bx = cx + i * PITCH, by = cy + j * PITCH, dc = Math.hypot(bx - cbd.x, by - cbd.y); if (taken(i, j)) continue;
    // every third street an avenue: the blocks beside it give up 4 m to it
    const wX = BLOCK - (i % 3 === 0 ? 4 : 0), wY = BLOCK - (j % 3 === 0 ? 4 : 0);
    const one = dc < 100 ? rnd() < 0.5 : rnd() < 0.15;
    const plots = one ? [[bx, by, wX, wY]] : [[bx - wX / 4, by - wY / 4, wX / 2 - 2, wY / 2 - 2], [bx + wX / 4, by - wY / 4, wX / 2 - 2, wY / 2 - 2], [bx - wX / 4, by + wY / 4, wX / 2 - 2, wY / 2 - 2], [bx + wX / 4, by + wY / 4, wX / 2 - 2, wY / 2 - 2]];
    for (const [px, py, pw, pd] of plots) {
      // now and then a plot of a split block is a pocket park, a lawn and trees between the buildings, as Paley Park is between its neighbours
      if (!one && dc > 60 && rnd() < 0.16) { parks.push({ x: px, y: py, w: pw - 1, d: pd - 1, z: metroGround(px, py + pd / 2) }); continue; }
      // each building stands on the plain at its plot's downhill (harbour) edge; the slope covers the foot of its uphill side, as on any street that climbs
      const d = Math.hypot(px - cbd.x, py - cbd.y), seed = rnd(), Z = metroGround(px, py + pd / 2); lots++;
      let h = d < 100 ? DATUM + 155 * rnd() ** 3 : d < 170 ? (rnd() < 0.6 ? DATUM : 15 + 15 * rnd()) : 15 + 15 * rnd();
      if (h > 60 && (tall60 + 1) / lots > 0.2) h = DATUM + 20 * rnd(); if (h > 150 && tall150 >= 3) h = 90 + 50 * rnd(); if (h > 60) tall60++; if (h > 150) tall150++;
      h = Math.max(STOREY * 4, Math.round(h / STOREY) * STOREY); const bay = [3.2, 4.0, 4.8, 3.6][Math.floor(seed * 4)];
      // The building is the AAA3d city's (saltlight_build.js): three.js r185's SkyscraperGenerator, a tripartite tower, its arcaded base, its shaft of floors and bays, its crown, its piers,
      // windows set into the wall, cornices, string courses and window units, varied lot by lot the way its CityGenerator varies them. Corner plots chamfer toward the crossing.
      // Far off it is a box of the same size with the same masonry (metro.js's walls); near, the real one streams in
      const r = rngOf(Math.floor(seed * 1e9) + 7), cornerX = one ? 0 : Math.sign(px - bx), cornerZ = one ? 0 : -Math.sign(py - by), tone = Math.floor(r() * 4);
      const gen = { seed: Math.floor(seed * 100000), totalHeight: h, footprint: { width: pw - 1, depth: pd - 1 }, floorHeight: STOREY + r() * 0.8, bayWidth: 1.9 + r() * 2.1, pierWidth: 0.4 + r() * 0.5, pierDepth: 0.3 + r() * 0.4,
        chamferWidth: !one ? 3 + r() * 4 : 0, chamferCornerX: cornerX, chamferCornerZ: cornerZ, setbackDepth: r() < 0.4 ? 0.8 + r() * 2 : 0, stringCourseEvery: r() < 0.85 ? 3 + Math.floor(r() * 6) : 0 };
      cur = { bid: lots, fam: FAMILY.MASONRY, tone };
      // what can be stood on: the mass to its ledge, and the crown above it, set in by its setback
      const L = genLayout(gen); h = L.H;
      box({ x: px, y: py, z0: Z, h, sx: pw - 1, sy: pd - 1, seed, foot: Z, kind: 0, bay: L.bw, floor: L.fh, gen, glass: Math.floor(r() * 4), nocol: true });
      if (L.inset > 0.05) { const cw = Math.max(L.bw * 2, pw - 1 - 2 * L.inset), cd = Math.max(L.bw * 2, pd - 1 - 2 * L.inset);
        colliders.push({ t: 'box', x: px, y: py, z0: Z, z1: Z + L.shaftTop, hx: (pw - 1) / 2, hy: (pd - 1) / 2, yaw: 0, city: METRO.id, type: 'tower' }, { t: 'box', x: px, y: py, z0: Z + L.shaftTop, z1: Z + h, hx: cw / 2, hy: cd / 2, yaw: 0, city: METRO.id, type: 'tower' }); }
      else colliders.push({ t: 'box', x: px, y: py, z0: Z, z1: Z + h, hx: (pw - 1) / 2, hy: (pd - 1) / 2, yaw: 0, city: METRO.id, type: 'tower' });
      // its blade signs: up the corner, out over the street
      if (rnd() < 0.7) { const n = 1 + Math.floor(rnd() * 2); for (let k = 0; k < n; k++) { const side = rnd() < 0.5, sgn = rnd() < 0.5 ? -1 : 1; signs.push({ x: px + (side ? sgn * (pw / 2 + 0.7) : (rnd() - 0.5) * pw * 0.7), y: py + (side ? (rnd() - 0.5) * pd * 0.7 : sgn * (pd / 2 + 0.7)), z: Z + 4.5 + rnd() * 3, h: 4 + rnd() * Math.min(9, h - 9), yaw: side ? 0 : Math.PI / 2, hue: Math.floor(rnd() * 6), seed: rnd() }); } }
      // a red lamp on every roof over 100 m, as air safety asks
      if (h > 100) box({ x: px, y: py, z0: Z + h + 1.5, h: 0.9, sx: 0.9, sy: 0.9, seed, foot: Z, kind: 2, bay });
    }
  }
  measureStreets(boxes);
  // the Bell Ring: an octagon ring raised 1.5 m on a moat, a bowl of steps round it, four banner masts and a bronze bell hung over the middle
  const R0 = 20, BOWL = 46, Z = metroGround(ring.x, ring.y), ZM = metroGround(mast.x, mast.y);
  colliders.push({ t: 'cyl', x: ring.x, y: ring.y, z0: Z - 2, z1: Z + 1.5, r: R0, city: METRO.id, type: 'ring' });
  for (let k = 0; k < 4; k++) { const r1 = 28 + k * 4.5; for (let a = 0; a < 16; a++) { const ang = (a / 16) * Math.PI * 2, x = ring.x + Math.cos(ang) * r1, y = ring.y + Math.sin(ang) * r1; colliders.push({ t: 'box', x, y, z0: Z, z1: Z + 0.8 + k * 0.8, hx: 2.3, hy: (r1 * Math.PI * 2) / 32 + 0.4, yaw: ang, city: METRO.id, type: 'bowl' }); } }
  // the Signal Mast: three legs, decks at 110 and 190 m you can stand on, 240 m to its tip
  colliders.push({ t: 'cyl', x: mast.x, y: mast.y, z0: ZM, z1: ZM + 17, r: 13, city: METRO.id, type: 'mast_base' }, { t: 'cyl', x: mast.x, y: mast.y, z0: ZM + 108, z1: ZM + 110, r: 9.5, city: METRO.id, type: 'mast_deck' }, { t: 'cyl', x: mast.x, y: mast.y, z0: ZM + 188, z1: ZM + 190, r: 6, city: METRO.id, type: 'mast_deck' });
  return { boxes, colliders, signs, parks, ring: { ...ring, R0, BOWL, z: Z }, mast: { ...mast, z: ZM }, center: { x: cx, y: cy } };
}

// ---------------------------------------------------------------- what's drawn
function boxGeo() {
  // a unit box standing on its base, no floor: ten triangles
  const P = [], N = [], F = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]];
  for (const n of F) { const u = n[1] ? [1, 0, 0] : [-n[2], 0, n[0]], v = n[1] ? [0, 0, -1] : [0, 1, 0], c = [n[0] * 0.5, n[1] ? 1 : 0.5, n[2] * 0.5]; const q = (a, b) => [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b, c[2] + u[2] * a + v[2] * b]; const A = q(-0.5, -0.5), B = q(0.5, -0.5), C = q(0.5, 0.5), Dd = q(-0.5, 0.5); for (const p of [A, B, C, A, C, Dd]) { P.push(...p); N.push(...n); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return g;
}

export function buildMetro({ scene, look, plan, phone, heightAt }) {
  const meshes = [], B = plan.boxes, n = B.length;
  // the towers: every tier of every building in one draw. Per box: its seed, the height of its building's foot, its kind, its window bay; its facade family, wall tone and top; and for each of its
  // four faces how wide the street in front is and how tall the building across it (metro_kit.js)
  const geo = boxGeo(), tw = new Float32Array(n * 4), fx = new Float32Array(n * 4), cwA = new Float32Array(n * 4), chA = new Float32Array(n * 4);
  geo.setAttribute('aTw', new THREE.InstancedBufferAttribute(tw, 4)); geo.setAttribute('aFx', new THREE.InstancedBufferAttribute(fx, 4)); geo.setAttribute('aCw', new THREE.InstancedBufferAttribute(cwA, 4)); geo.setAttribute('aCh', new THREE.InstancedBufferAttribute(chA, 4));
  // the damage slot each box is given when it's hit (scorch.js writes it, as the houses' are written)
  geo.setAttribute('aDmg', new THREE.InstancedBufferAttribute(new Uint8Array(n * 4), 4, true));
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.05 });
  look.patch(mat, { key: 'metro', uniforms: { tOcDmg: look.uniforms.tOcDmg, ocDmgC: look.uniforms.ocDmgC },
    vertexDecl: 'attribute vec4 aTw; attribute vec4 aFx; attribute vec4 aCw; attribute vec4 aCh; attribute vec4 aDmg;\nvarying vec4 vTw; varying vec3 vFa; varying vec3 vWN; varying vec4 vFx; varying vec2 vCan; flat varying mediump float vDmgS;\n',
    // each face's own metres: u along it, v above the building's foot, so storeys stay true however the box is stretched (the study's Appendix A); and the street this face looks onto
    vertexBend: /* glsl */`{ vTw = aTw; vFx = aFx; vDmgS = floor(aDmg.r*255.0 + .5) - 1.0; vec3 S = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vec3 tl = vec3(normal.z, 0.0, -normal.x); float W = abs(normal.x) > .5 ? S.z : S.x;
      vFa = vec3((dot(position, tl) + .5)*W, position.y*S.y + (instanceMatrix[3].y - aTw.y), normal.y > .5 ? 1.0 : 0.0); vWN = normalize(mat3(instanceMatrix)*normal);
      vCan = normal.x > .5 ? vec2(aCw.x, aCh.x) : normal.x < -.5 ? vec2(aCw.y, aCh.y) : normal.z > .5 ? vec2(aCw.z, aCh.z) : vec2(aCw.w, aCh.w); }`,
    fragmentPars: /* glsl */`varying vec4 vTw; varying vec3 vFa; varying vec3 vWN; varying vec4 vFx; varying vec2 vCan; flat varying mediump float vDmgS;
      ${DMG_PARS}
      ${familyGLSL()}
      float mh(float x) { return fract(sin(x*127.1)*43758.5453); }
      // a room behind the glass: a ray into a box one bay wide and one storey deep, tested against only the three planes it faces (van Dongen 2008)
      vec3 ocRoom(vec2 f, vec3 rd, vec2 cell, float d, float id, float lit, float near) {
        vec3 r = rd/vec3(cell, d), p = vec3(f, 0.0), t3 = (step(vec3(0.0), r) - p)/r; float t = min(t3.z, min(t3.x, t3.y)); vec3 h = p + r*t;
        float h1 = mh(id*7.31), h2 = mh(id*3.17), h3 = mh(id*5.77); vec3 wall = mix(vec3(.60, .55, .46), vec3(.42, .50, .56), step(.5, h1));
        vec3 c = t == t3.z ? wall*(.72 + .28*h.y) : t == t3.x ? wall*.58 : r.y > 0.0 ? mix(wall*.86, vec3(1.0, .86, .62)*1.7, exp(-dot(h.xz - vec2(.5, .3), h.xz - vec2(.5, .3))*7.0)) : mix(vec3(.15, .12, .10), vec3(.30, .24, .19), h2);
        if (near > .5) { float tf = (.40 + .25*h3)/r.z; if (tf < t) { vec3 q = p + r*tf; if (q.y < .28 + .22*h3 && fract(q.x*(2.0 + floor(h2*3.0)) + h1) < .7) c = vec3(.045, .045, .06); } }
        return c*mix(.05, 1.0, lit); }
      // in the shadow of a ledge whose underside is at zl and which stands p out of the wall: everything below it to p times the sun's height over this face
      float ocLedge(float v, float zl, float p, float tanA) { float s = zl - v; return step(0.0, s)*step(s, p*tanA); }
      vec3 ocWin; float ocWinGlow; vec3 ocRevN; float ocRev;\n`,
    albedo: /* glsl */`{
      float seed = vTw.x, kind = vTw.z, dist = length(vOcP - cameraPosition); ocWin = vec3(0.0); ocWinGlow = 0.0; ocRev = 0.0; ocRevN = vec3(0.0, 1.0, 0.0);
      if (kind > .5) { diffuseColor.rgb = kind > 1.5 ? vec3(.25, .02, .02) : vec3(.16, .165, .17)*(.8 + .25*mh(seed*9.0)); }
      else if (vFa.z > .5) { vec2 g = fract(vOcP.xz*.5); diffuseColor.rgb = mix(vec3(.28, .28, .27), vec3(.38, .37, .35), mh(seed*7.0))*(.9 + .1*step(.95, max(g.x, g.y))); }
      else {
        // the facade family and wall tone the plan gave this building (metro_kit.js): curtain glass, punched masonry, ribbon windows, fins, or flats with balconies
        int fam = int(vFx.x + .5), tone = int(vFx.y + .5); float topV = vFx.z, Wc = vCan.x, Hc = vCan.y;
        vec2 cell = vec2(vTw.w, vFx.w > 0.0 ? vFx.w : ${STOREY.toFixed(1)}); vec2 uv = vFa.xy, f = fract(uv/cell), id2 = floor(uv/cell);
        vec3 wallC = OC_TONE[fam*4 + tone]*mix(.92, 1.06, mh(seed*5.1)), frame = fam == 0 ? wallC : wallC*.7;
        vec3 m = ocWinOf(fam, Wc); float mx = m.x, mb = m.y, mt = m.z, rv = OC_REVEAL[fam];
        // the shops: glass from half a metre to the head of the ground floor, a sign band and mezzanine above (NYC ZR 37-34: glazing from 2 ft 6 in at most to 12 ft)
        bool shop = uv.y < 6.8; if (shop) { mx = .04; mb = uv.y > 3.4 ? .06 : .15; mt = uv.y > 3.4 ? .5 : .0; rv = .12; }
        vec2 pm = f*cell, lo = vec2(mx, mb)*cell, hi = vec2(1.0 - mx, 1.0 - mt)*cell;
        bool win = pm.x > lo.x && pm.x < hi.x && pm.y > lo.y && pm.y < hi.y;
        vec3 Fn = normalize(vWN), T = vec3(Fn.z, 0.0, -Fn.x), V = normalize(vOcP - cameraPosition), rd = vec3(dot(V, T), V.y, -dot(V, Fn)), L = normalize(ocSunA), Ls = vec3(dot(L, T), L.y, dot(L, Fn));
        vec3 col = fam == 0 && !shop ? frame : wallC*(.94 + .06*mh(id2.x + id2.y*3.0));
        if (win) {
          // the window is set into the wall: the ray from the eye meets the jambs, the head or the sill before the glass if it comes in at a slant (Müller's window depth; reveals 0.07-0.17 m)
          float tg = rv/max(rd.z, .05), tx = rd.x > 0.0 ? (hi.x - pm.x)/max(rd.x, 1e-4) : (lo.x - pm.x)/min(rd.x, -1e-4), ty = rd.y > 0.0 ? (hi.y - pm.y)/max(rd.y, 1e-4) : (lo.y - pm.y)/min(rd.y, -1e-4), ts = min(tx, ty);
          if (ts < tg && dist < 180.0) {
            ocRev = 1.0; ocRevN = tx < ty ? -sign(rd.x)*T : vec3(0.0, -sign(rd.y), 0.0);
            col = (fam == 0 ? frame : wallC)*mix(1.0, .72, clamp(ts*rd.z/rv, 0.0, 1.0));
          } else {
            vec2 g = dist < 180.0 ? pm + rd.xy*tg : pm, wf = clamp((g - lo)/(hi - lo), 0.0, 1.0);
            float rid = id2.x*17.0 + id2.y*131.0 + seed*977.0, share = .15 + .45*mh(seed*21.0), floorLit = step(mh(seed*41.0), .25)*step(mh(id2.y + seed*61.0), share*1.6), lit = max(step(mh(rid), share), floorLit);
            vec3 room = dist < 270.0 ? ocRoom(wf, rd, hi - lo, 4.0, rid, mix(.35, lit, ocNight), dist < 40.0 ? 1.0 : 0.0) : mix(vec3(.10, .12, .14), vec3(.9, .75, .5), lit*ocNight)*(.6 + .4*mh(floor(uv.x/(cell.x*3.0)) + floor(uv.y/(cell.y*2.0))*7.0));
            if (shop) room = mix(vec3(.55, .48, .36), vec3(.70, .58, .40), mh(rid))*(uv.y < 3.4 ? 1.0 : .25);
            // the glass: the room through it head on, the sky in it at a glance
            float fres = pow(1.0 - abs(dot(V, Fn)), 3.0); vec3 sky = mix(vec3(.10, .21, .31), vec3(.02, .03, .06), ocNight);
            col = mix(room, sky, clamp(fres*.85 + (fam == 0 ? .18 : .06), 0.0, 1.0));
            // the head and the jambs shade the glass: from the glass, the sun's ray back out through the opening
            if (Ls.z > .02 && L.y > 0.0) { vec2 e = g + Ls.xy*(rv/Ls.z); float shd = 1.0 - step(lo.x, e.x)*step(e.x, hi.x)*step(lo.y, e.y)*step(e.y, hi.y); col *= mix(1.0, .55, shd*(1.0 - ocNight)); }
            ocWin = room; ocWinGlow = shop ? 1.0 : lit*ocNight;
          }
        }
        // the shadow lines: what stands out of the wall above a point throws its shadow down it, as far as its projection times the sun's height over this face; the kit's pieces (metro_kit.js)
        // are where these say they are. The baked sun map (3.4 m a texel) holds the towers' own shadows; these are too fine for it
        float tanA = Ls.z > .02 ? max(L.y, 0.0)/Ls.z : 0.0, sunOn = step(.02, Ls.z)*step(0.0, L.y)*(1.0 - ocNight), shl = 0.0;
        shl = max(shl, ocLedge(uv.y, topV - (fam == 1 ? .55 : .25), fam == 1 ? .75 : fam == 4 ? .18 : fam == 2 ? .3 : .12, tanA));
        if ((fam == 1 || fam == 2 || fam == 4) && uv.y < 6.8) shl = max(shl, ocLedge(uv.y, 6.68, .18, tanA));
        if (uv.y > 6.8) {
          float fl = (floor(uv.y/${STOREY.toFixed(1)}) + 1.0)*${STOREY.toFixed(1)};
          if (fam == 2) shl = max(shl, ocLedge(uv.y, fl - .1, .25, tanA));
          if (fam == 4 && Wc >= ${STREET.toFixed(1)}) shl = max(shl, ocLedge(uv.y, fl - .16, 1.2, tanA));
          if (fam == 1) shl = max(shl, ocLedge(uv.y, floor(uv.y/cell.y)*cell.y + mb*cell.y - .09, .15, tanA));
          if (fam == 3) { float off = -.6*Ls.x/max(Ls.z, .02), uu = mod(uv.x, cell.x); shl = max(shl, off > 0.0 ? step(uu, off) : step(cell.x + off, uu)); }
        }
        col *= mix(vec3(1.0), vec3(.30, .42, .50), shl*sunOn);
        // the sky a lower floor sees down its street: a wall's view of the sky over the roofs across, (1 - sin a)/2 against an open wall's 1/2 (the configuration factor, Oke's benchmarks)
        float skyF = 1.0 - sin(atan(max(Hc - uv.y, 0.0), max(Wc, .5)));
        col *= mix(.58, 1.0, sqrt(skyF));
        // where it meets the street, darker (the plain under it: metroGround)
        float gH = vOcP.y - (${QUAY.toFixed(2)} + ${GRADE.toFixed(4)}*max(0.0, vOcP.z - ${(-QN).toFixed(1)}));
        col *= mix(.68, 1.0, smoothstep(0.0, 2.4, gH));
        // what the powers have done to it (scorch.js): soot, heat, ice, the break
        if (vDmgS > -.5) { float g = ocWinGlow; vec3 gc = ocWin; col = slDamage(col, slDmgTile(int(vDmgS), vOcP), vOcP, g, gc); ocWinGlow = max(ocWinGlow, g); ocWin = mix(ocWin, gc, step(.01, g)); }
        diffuseColor.rgb = col;
      }
      // the shade is chosen, not computed (the study's A3, from a fighting game's art talk): a face turned from the sun takes a teal tint, so lit to shade runs about 6 to 1 as anime streets do
      if (kind < .5) { vec3 nS = ocRev > .5 ? ocRevN : normalize(vWN); diffuseColor.rgb *= mix(vec3(.22, .36, .45), vec3(1.0), smoothstep(-.05, .3, dot(nS, normalize(ocSunA)))); } }`,
    // a reveal's own face takes the light as itself: a head faces down, a sill up, a jamb across
    normalHook: /* glsl */`if (ocRev > .5) normal = normalize((viewMatrix*vec4(ocRevN, 0.0)).xyz);`,
    glow: /* glsl */`{ ocGlow = ocWin*ocWinGlow*(.25 + .9*ocNight); if (vTw.z > 1.5) ocGlow = vec3(1.0, .08, .04)*(.4 + 3.0*step(.5, fract(ocTime*.5 + vTw.x)))*(.3 + .7*ocNight); }`,
  });
  const towers = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  B.forEach((b, i) => { q.setFromAxisAngle(Y, b.yaw || 0); m4.compose(p.set(b.x, b.z0, -b.y), q, s.set(b.sx, b.h, b.sy)); towers.setMatrixAt(i, m4); tw[i * 4] = b.seed; tw[i * 4 + 1] = b.foot; tw[i * 4 + 2] = b.kind; tw[i * 4 + 3] = b.bay;
    fx[i * 4] = b.fam ?? 1; fx[i * 4 + 1] = b.tone ?? 0; fx[i * 4 + 2] = b.z0 + b.h - b.foot; fx[i * 4 + 3] = b.floor || 0; const W = b.cw || [90, 90, 90, 90], H = b.ch || [0, 0, 0, 0]; for (let k = 0; k < 4; k++) { cwA[i * 4 + k] = W[k]; chA[i * 4 + k] = H[k]; } });
  towers.frustumCulled = false; towers.name = 'metro_towers'; scene.add(towers); meshes.push(towers);
  // near, each building stands as itself: the AAA3d city's generator and facade (saltlight_build.js); this box is its far self, hidden while the real one stands
  const near = createNearBuildings({ scene, look, plan, towers, phone }), light = { share: 0.2, glow: 4 };
  // the trees: the AAA3d city's own, on every kerb, along the promenade, round the Bell Ring (saltlight_trees.js)
  const trees = createSaltlightTrees({ scene, look, plan, phone, ground: metroGround, grid: GRID, land: LAND });

  // the street: one ground, its asphalt, kerbs, pavements, avenue lanes and zebra crossings all drawn in the shader from the plan's grid (C14, C18)
  // it lies on the plain, which is a plane (metroGround): one quad from the west quay to where the road climbs into the Ash City, and from the north quay to the ridge's foot
  const GX1 = 150, groundGeo = (() => { const g = new THREE.BufferGeometry(), c = [[QW, QN], [GX1, QN], [GX1, FOOT], [QW, FOOT]], P = []; for (const [x, y] of c) P.push(x, metroGround(x, y) + 0.03, -y); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals(); return g; })();
  const gm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  look.patch(gm, { key: 'metro_ground',
    fragmentPars: `uniform vec2 uMetroC;\n`,
    // the plan's blocks are centred on the grid's points, so a block runs from -BLOCK/2 to +BLOCK/2 and the street from there to the next block (this drew them 6 m off, half of each street as pale paving).
    // A 12 m street: a 2.5 m pavement each side with its kerb, and two 3.5 m lanes, the way a city's local street is laid out; crossings at every corner
    albedo: /* glsl */`{ vec2 w = vec2(vOcP.x, -vOcP.z) - uMetroC + ${(BLOCK / 2).toFixed(1)}; vec2 c = mod(w, ${PITCH.toFixed(1)});
      vec2 inS = step(vec2(${BLOCK.toFixed(1)}), c), u = c - ${BLOCK.toFixed(1)}; float street = max(inS.x, inS.y), cross = inS.x*inS.y;
      float n1 = fract(sin(dot(floor(vec2(vOcP.x, vOcP.z)*.8), vec2(12.9, 78.2)))*437.5);
      // the pavement: concrete flags 1.5 m square, their joints darker; on a block it runs up to the buildings
      vec2 fl = abs(fract(vec2(vOcP.x, vOcP.z)/1.5) - .5); float joint = step(.47, max(fl.x, fl.y));
      vec3 pave = vec3(.215, .21, .195)*(.9 + .12*n1)*(1.0 - .25*joint);
      vec3 col = pave;
      // outside the grid's last streets: the quays' apron, granite setts 0.6 m in courses, and the road east into the Ash City
      vec2 gw = vec2(vOcP.x, -vOcP.z) - uMetroC;
      bool apron = gw.x < ${(COLS[0] * PITCH - PITCH + BLOCK / 2).toFixed(1)} || gw.x > ${(COLS[1] * PITCH + PITCH - BLOCK / 2).toFixed(1)} || gw.y > ${(ROWS[1] * PITCH + PITCH - BLOCK / 2).toFixed(1)} || gw.y < ${(ROWS[0] * PITCH - PITCH + BLOCK / 2).toFixed(1)};
      if (apron) { vec2 st = fract(vec2(vOcP.x*1.6667, vOcP.z*1.6667 + floor(vOcP.x*1.6667)*.5)); float sj = step(.9, max(st.x, st.y)); street = 0.0; col = vec3(.235, .225, .21)*(.88 + .16*n1)*(1.0 - .28*sj);
        float qd = min(vOcP.x - ${QW.toFixed(1)}, ${QN.toFixed(1)} + vOcP.z); col = mix(col, vec3(.34, .33, .31)*(.95 + .1*n1), step(qd, 1.2));
        float ry = -vOcP.z - (uMetroC.y + ${(PITCH / 2).toFixed(1)}); if (gw.x > 0.0 && abs(ry) < 6.0) { col = abs(ry) < 3.6 ? vec3(.050, .050, .055)*(.9 + .1*n1) : vec3(.46, .45, .42); col = mix(col, vec3(.70, .70, .66), step(abs(ry), .08)*step(fract(vOcP.x/9.0), .34)); } }
      if (street > .5) {
        // across the street: 0 to 12 m from one block's edge to the next; pavements on 0-2.5 and 9.5-12, a kerb at their edge
        float ax = inS.x*(1.0 - inS.y), ay = inS.y*(1.0 - inS.x);
        float acr = ax > .5 ? u.x : u.y, along = ax > .5 ? c.y : c.x;
        vec3 asph = vec3(.050, .050, .055)*(.9 + .1*n1);
        if (cross > .5) {
          // the crossing itself: asphalt, with the pavements' corners squared off
          float cx0 = min(u.x, ${(PITCH - BLOCK).toFixed(1)} - u.x), cy0 = min(u.y, ${(PITCH - BLOCK).toFixed(1)} - u.y);
          col = (cx0 < 2.5 && cy0 < 2.5) ? pave : asph;
        } else {
          float side = min(acr, ${(PITCH - BLOCK).toFixed(1)} - acr);
          if (side < 2.5) col = mix(pave, vec3(.46, .45, .42), step(2.3, side));
          else {
            col = asph;
            // the centre line, dashed 3 m in 9; the crossings: white bars 0.5 m wide across the lanes, 4 m deep, at each end of the block
            float centre = step(abs(acr - 6.0), .08)*step(fract(along/9.0), .34);
            float zeb = (step(along, 4.0) + step(${(BLOCK - 4).toFixed(1)}, along))*step(.5, fract(acr/1.0));
            float stopL = step(abs(along - 4.4), .2) + step(abs(along - ${(BLOCK - 4.4).toFixed(1)}), .2);
            col = mix(col, vec3(.70, .70, .66), clamp(centre + zeb + stopL*step(acr, 6.0)*(1.0 - step(${(BLOCK / 2).toFixed(1)}, along)) + stopL*step(6.0, acr)*step(${(BLOCK / 2).toFixed(1)}, along), 0.0, 1.0));
          }
        }
      }
      diffuseColor.rgb = col; }`,
  });
  gm.userData.uMetroC = { value: new THREE.Vector2(plan.center.x, plan.center.y) };
  { const ob = gm.onBeforeCompile; gm.onBeforeCompile = function (sh, r) { ob && ob.call(this, sh, r); sh.uniforms.uMetroC = gm.userData.uMetroC; }; }
  const ground = new THREE.Mesh(groundGeo, gm); ground.name = 'metro_ground'; scene.add(ground);
  // the pocket parks: a lawn raised 0.3 m in its stone kerb, its grass mown in stripes, one draw for all of them (their trees are saltlight_trees.js's)
  const parkGeo = (() => { const P = [], C = [], I = [], add = (x, y, z, c) => { P.push(x, z, -y); C.push(...c); return P.length / 3 - 1; };
    for (const k of plan.parks) { const h = 0.3, x0 = k.x - k.w / 2, x1 = k.x + k.w / 2, y0 = k.y - k.d / 2, y1 = k.y + k.d / 2, zt = k.z + h, g = [0.11, 0.20, 0.06], st = [0.30, 0.29, 0.27];
      const a = add(x0 + 0.4, y0 + 0.4, zt, g), b = add(x1 - 0.4, y0 + 0.4, zt, g), c = add(x1 - 0.4, y1 - 0.4, zt, g), d = add(x0 + 0.4, y1 - 0.4, zt, g); I.push(a, c, b, a, d, c);
      const ring = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      for (let i = 0; i < 4; i++) { const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % 4]; const o = add(ax, ay, k.z - 0.2, st), p2 = add(bx, by, k.z - 0.2, st), q = add(bx, by, zt, st), r2 = add(ax, ay, zt, st); I.push(o, p2, q, o, q, r2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals(); return g; })();
  const pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  look.patch(pm, { key: 'metro_park', albedo: '{ vec2 q = vOcP.xz; float stripe = step(.5, fract((q.x + q.y)*.25)); float n = fract(sin(dot(floor(q*2.0), vec2(12.9, 78.2)))*437.5); diffuseColor.rgb *= (.9 + .12*stripe)*(.92 + .1*n); }' });
  const parksM = new THREE.Mesh(parkGeo, pm); parksM.name = 'metro_parks'; scene.add(parksM);

  // The quays: a caisson's face straight down to the dredged floor, and over the edge a seawall parapet 0.9 m tall with its walk, as a harbour wall has; it also hides the lip the height field
  // leaves where it falls 10 m in one sample (a Catmull-Rom curve overshoots a step by up to 0.8 m on its high side). North quay from the corner to the grid's east street, where the beach begins; west quay down to the headland
  const quayGeo = (() => {
    const P = [], Cc = [], I = [], top = (x, y) => (x > GX1 && heightAt ? Math.max(metroGround(x, y), heightAt(x, y)) : metroGround(x, y)), path = [];
    for (let y = footY(QW) + 6; y <= QN - 14; y += 4) path.push([QW, y, -1, 0]);
    for (let k = 0; k <= 8; k++) { const a = Math.PI - (k / 8) * (Math.PI / 2), x = QW + 14 + Math.cos(a) * 14, y = QN - 14 + Math.sin(a) * 14; path.push([x, y, Math.cos(a), Math.sin(a)]); }
    for (let x = QW + 18; x <= QE; x += 4) path.push([x, QN, 0, 1]);
    const quad = (a, b, c, d, col) => { const o = P.length / 3; P.push(...a, ...b, ...c, ...d); for (let k = 0; k < 4; k++) Cc.push(...col); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
    for (let k = 0; k + 1 < path.length; k++) {
      const [x0, y0, nx0, ny0] = path[k], [x1, y1, nx1, ny1] = path[k + 1], t0 = top(x0 - nx0 * 1.0, y0 - ny0 * 1.0) + 0.9, t1 = top(x1 - nx1 * 1.0, y1 - ny1 * 1.0) + 0.9;
      // the face, 0.6 m out from the edge, from the parapet's top to the floor; stained dark below the tide line; the walk on top, 2.6 m deep; its back, down to the apron
      const f0 = [x0 + nx0 * 0.6, y0 + ny0 * 0.6], f1 = [x1 + nx1 * 0.6, y1 + ny1 * 0.6], b0 = [x0 - nx0 * 2.0, y0 - ny0 * 2.0], b1 = [x1 - nx1 * 2.0, y1 - ny1 * 2.0];
      const W = (x, y, z) => [x, z, -y];
      quad(W(...f0, 0.4), W(...f1, 0.4), W(...f1, t1), W(...f0, t0), [.40, .395, .38]);
      quad(W(...f0, -9), W(...f1, -9), W(...f1, 0.4), W(...f0, 0.4), [.13, .14, .13]);
      quad(W(...f0, t0), W(...f1, t1), W(...b1, t1), W(...b0, t0), [.52, .51, .49]);
      quad(W(...b0, t0), W(...b1, t1), W(...b1, top(...b1) - 0.2), W(...b0, top(...b0) - 0.2), [.36, .355, .34]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setIndex(I); g.computeVertexNormals(); return g;
  })();
  const qm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }); look.patch(qm, { key: 'metro_quay' });
  const quay = new THREE.Mesh(quayGeo, qm); quay.name = 'metro_quay'; scene.add(quay);

  // the blade signs (C12): original glyphs only, no brand and no real writing, in the neon hues measured off anime streets. One quad each, one draw
  const S = plan.signs.slice(0, phone ? 260 : 600), sgGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), sd = new Float32Array(S.length * 4); sgGeo.setAttribute('aSg', new THREE.InstancedBufferAttribute(sd, 4));
  const sgm = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  sgm.onBeforeCompile = (sh) => {
    sh.uniforms.ocTime = look.uniforms.ocTime; sh.uniforms.ocNight = look.uniforms.ocNight;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aSg; varying vec4 vSg; varying vec2 vSu;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSg = aSg; vSu = vec2(position.x + .5, position.y);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float ocTime, ocNight; varying vec4 vSg; varying vec2 vSu;\nfloat sh1(float x) { return fract(sin(x*91.7)*43758.5); }').replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );
      { vec3 hue = vSg.x < .5 ? vec3(.81, .34, .37) : vSg.x < 1.5 ? vec3(.35, .68, .75) : vSg.x < 2.5 ? vec3(.40, .81, .75) : vSg.x < 3.5 ? vec3(.31, .63, .45) : vSg.x < 4.5 ? vec3(.67, .51, .29) : vec3(.65, .36, .27);
        float rows = max(2.0, floor(vSg.z)); vec2 g = vec2(vSu.x, vSu.y*rows); vec2 gi = floor(g*vec2(4.0, 4.0)), gf = fract(g);
        float cellOn = step(.45, sh1(gi.x + gi.y*7.0 + floor(g.y)*31.0 + vSg.y*300.0)), inner = step(.12, vSu.x)*step(vSu.x, .88)*step(.03, fract(g.y))*step(fract(g.y), .9);
        float border = 1.0 - step(.06, vSu.x)*step(vSu.x, .94)*step(.02, vSu.y)*step(vSu.y, .98), flick = .85 + .15*step(.97, sh1(floor(ocTime*8.0) + vSg.y*50.0));
        vec3 c = mix(vec3(.04, .04, .05), hue*1.6, max(border, cellOn*inner)*flick); diffuseColor.rgb = c*(.55 + .9*ocNight); }`);
  };
  const signs = new THREE.InstancedMesh(sgGeo, sgm, Math.max(1, S.length));
  S.forEach((g, i) => { q.setFromAxisAngle(Y, g.yaw); m4.compose(p.set(g.x, g.z, -g.y), q, s.set(1.2, g.h, 1)); signs.setMatrixAt(i, m4); sd[i * 4] = g.hue; sd[i * 4 + 1] = g.seed; sd[i * 4 + 2] = g.h / 1.1; sd[i * 4 + 3] = 0; });
  signs.count = S.length; signs.frustumCulled = false; signs.name = 'metro_signs'; scene.add(signs);

  // the Signal Mast (§4d 5): three legs leaning in to a 240 m tip, cross-braced, two decks, painted in the red and white bands that air safety asks of a tall mast
  const mastGeo = (() => {
    const parts = [], M = plan.mast, legs = 3, H = 240, base = 12, add = (g) => parts.push(g);
    const strut = (a, b, r) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(), g = new THREE.CylinderGeometry(r, r, L, 4, 1); g.translate(0, L / 2, 0); const qq = new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()); g.applyQuaternion(qq); g.translate(a.x, a.y, a.z); const c = new Float32Array(g.attributes.position.count); for (let i = 0; i < c.length; i++) { const yy = g.attributes.position.getY(i); c[i] = Math.floor(yy / 24) % 2; } g.setAttribute('aBand', new THREE.BufferAttribute(c, 1)); add(g); };
      const legAt = (k, y) => { const r = base * (1 - y / H) + 1.2 * (y / H), a = (k / legs) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); };
    for (let k = 0; k < legs; k++) strut(legAt(k, 0), legAt(k, H), 0.55);
    for (let y = 0; y < H - 16; y += 16) for (let k = 0; k < legs; k++) { strut(legAt(k, y), legAt((k + 1) % legs, y + 16), 0.18); strut(legAt((k + 1) % legs, y), legAt(k, y + 16), 0.18); }
    for (const [y, r] of [[110, 9.5], [190, 6]]) { const g = new THREE.CylinderGeometry(r, r, 2, 12, 1); g.translate(0, y - 1, 0); const c = new Float32Array(g.attributes.position.count).fill(2); g.setAttribute('aBand', new THREE.BufferAttribute(c, 1)); add(g); }
    { const g = new THREE.CylinderGeometry(13, 14, 17, 12, 1); g.translate(0, 8.5, 0); const c = new Float32Array(g.attributes.position.count).fill(3); g.setAttribute('aBand', new THREE.BufferAttribute(c, 1)); add(g); }
    const all = parts.map((g) => g.toNonIndexed()); let cnt = 0; for (const g of all) cnt += g.attributes.position.count; const P = new Float32Array(cnt * 3), Nn = new Float32Array(cnt * 3), Bd = new Float32Array(cnt); let o = 0;
    for (const g of all) { g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); Nn.set(g.attributes.normal.array, o * 3); Bd.set(g.attributes.aBand.array, o); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); out.setAttribute('aBand', new THREE.BufferAttribute(Bd, 1)); out.translate(M.x, M.z, -M.y); return out;
  })();
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3 });
  look.patch(mastMat, { key: 'metro_mast', vertexDecl: 'attribute float aBand;\nvarying float vBand; varying float vMy;\n', vertexBend: '{ vBand = aBand; vMy = position.y; }', fragmentPars: 'varying float vBand; varying float vMy;\n',
    albedo: '{ diffuseColor.rgb = vBand > 2.5 ? vec3(.26, .26, .27) : vBand > 1.5 ? vec3(.55, .55, .57) : vBand > .5 ? vec3(.55, .05, .03) : vec3(.66, .66, .68); }',
    glow: '{ ocGlow = vec3(1.0, .08, .04)*step(vMy, 9999.0)*0.0 + vec3(1.0, .1, .05)*step(.5, fract(ocTime*.5))*step(234.0 + 7.0, vMy)*(.5 + 2.0*ocNight); }' });
  const mastM = new THREE.Mesh(mastGeo, mastMat); mastM.name = 'metro_mast'; mastM.frustumCulled = false; scene.add(mastM);

  // the Bell Ring (§4d 1): the floor bright as a tournament floor so every silhouette reads, a dark moat round it, steps rising to the bowl's rim, four banner masts and the bell
  const ringGeo = (() => {
    const R = plan.ring, parts = [], tag = (g, k) => { const c = new Float32Array(g.attributes.position.count).fill(k); g.setAttribute('aK', new THREE.BufferAttribute(c, 1)); parts.push(g.toNonIndexed()); };
    { const g = new THREE.CylinderGeometry(R.R0, R.R0, 3.5, 8, 1); g.rotateY(Math.PI / 8); g.translate(0, -0.25, 0); tag(g, 0); }
    { const g = new THREE.RingGeometry(R.R0, R.R0 + 5, 32, 1); g.rotateX(-Math.PI / 2); g.translate(0, -0.6, 0); tag(g, 1); }
    for (let k = 0; k < 4; k++) { const r1 = 26 + k * 4.5, g = new THREE.CylinderGeometry(r1 + 2.3, r1 + 2.3, 0.8 + k * 0.8 + 3.5, 32, 1, true); g.translate(0, (0.8 + k * 0.8 - 3.5) / 2, 0); tag(g, 2); const top = new THREE.RingGeometry(r1 - 2.3, r1 + 2.3, 32, 1); top.rotateX(-Math.PI / 2); top.translate(0, 0.8 + k * 0.8, 0); tag(top, 2); }
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2, x = Math.cos(a) * (R.BOWL - 2), z = Math.sin(a) * (R.BOWL - 2); const m = new THREE.CylinderGeometry(0.35, 0.45, 40, 6, 1); m.translate(x, 20, z); tag(m, 3); const b = new THREE.PlaneGeometry(3, 12); b.translate(x + 1.7, 32, z); tag(b, 4); }
    { const g = new THREE.BoxGeometry(2 * R.R0 + 8, 1, 1); g.translate(0, 22, 0); tag(g, 3); for (const sx of [-1, 1]) { const p = new THREE.BoxGeometry(1, 22, 1); p.translate(sx * (R.R0 + 4), 11, 0); tag(p, 3); } }
    { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.4 + 2.6 * Math.pow(t, 1.6) + (t > 0.85 ? 0.4 : 0), 21.5 - 6 * t)); } const g = new THREE.LatheGeometry(pts, 16); tag(g, 5); }
    let cnt = 0; for (const g of parts) cnt += g.attributes.position.count; const P = new Float32Array(cnt * 3), K = new Float32Array(cnt); let o = 0;
    for (const g of parts) { P.set(g.attributes.position.array, o * 3); K.set(g.attributes.aK.array, o); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('aK', new THREE.BufferAttribute(K, 1)); out.computeVertexNormals(); out.translate(R.x, R.z + 1.5, -R.y); return out;
  })();
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide });
  look.patch(ringMat, { key: 'metro_ring', vertexDecl: 'attribute float aK;\nvarying float vK;\n', vertexBend: '{ vK = aK; }', fragmentPars: 'varying float vK;\n',
    albedo: '{ vec2 g = fract(vOcP.xz*.25); float line = step(.96, max(g.x, g.y)); diffuseColor.rgb = vK < .5 ? mix(vec3(.62, .64, .66), vec3(.34, .42, .52), line) : vK < 1.5 ? vec3(.01, .025, .035) : vK < 2.5 ? vec3(.26, .25, .23) : vK < 3.5 ? vec3(.08, .085, .09) : vK < 4.5 ? vec3(.45, .06, .05) : vec3(.30, .18, .07); }',
    glow: '{ ocGlow = vK > 3.5 && vK < 4.5 ? vec3(.3, .03, .02)*ocNight : vec3(0.0); }' });
  const ringM = new THREE.Mesh(ringGeo, ringMat); ringM.name = 'metro_ring'; scene.add(ringM);

  // seen from far: the whole city draws from 1,100 m, the mast from the far plane, so the skyline is there to fly at
  const centre = new THREE.Vector3(METRO.x, metroGround(METRO.x, METRO.y), -METRO.y);
  // a film of the game without its city (Randy, 2 Nov: "give me the video clips without the city then with the city"): ?nocity keeps all of it out of the frame
  const NOCITY = typeof location !== 'undefined' && /[?&]nocity\b/.test(location.search);
  let tPrev = performance.now();
  function update(camera) {
    if (NOCITY) { towers.visible = ground.visible = quay.visible = parksM.visible = signs.visible = mastM.visible = ringM.visible = false; scene.traverse((o) => { if (/^saltlight_building$|^sl_aaa_/.test(o.name)) o.visible = false; }); return; } const now = performance.now(), dt = Math.min(0.25, (now - tPrev) / 1000); tPrev = now; const d = camera.position.distanceTo(centre); const on = d < 1150; towers.visible = on;
    // the lit rooms follow the clock: a fifth by day, half the windows at night
    const night = look.uniforms.ocNight ? look.uniforms.ocNight.value : 0; light.share = 0.2 + 0.35 * night; light.glow = 4; if (on) { near.update(camera, dt, light); trees.update(camera, dt); } ground.visible = d < 700; quay.visible = d < 900; signs.visible = d < 500; ringM.visible = d < 900; mastM.visible = true; }
  return { meshes: [towers], all: [towers, ground, quay, parksM, signs, mastM, ringM], near, trees, update, plan };
}
