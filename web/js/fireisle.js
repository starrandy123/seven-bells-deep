// The Burnt Isle: the Emberkin's own land (EPIC V6, V10, V11). Randy, 1 Nov: "We need actual cities on ground and sky too". An island of black rock under a volcano in the open sea south of the islet, in sight of where he starts,
// a city in its streets (city.js, ash_city), and a second city on a rock that hangs in the sky over it (sky_city). It's raised here, at load, into the same height field everything reads, as the rivers are carved: the world's file doesn't change.
import * as THREE from 'three';
import { BURN } from './burn_glsl.js';

export const ISLE = { x: 300, y: -800, R: 190 };
export const FIRE_HILL = { x: 378, y: -874 };
const CITY = { id: 'ash_city', name: 'The Ash City', x: 246, y: -760, r: 86 }, SKY = { id: 'sky_city', name: 'The High City', x: 306, y: -806, z: 86, r: 66 };
// the sky fortresses: a keep on a rock of its own, flown to from the High City. Read off a real keep: a five-storey tower at the centre on a sloped stone base, smaller keeps by it, turrets at the corners, plastered walls between them with a gate (Himeji's plan, bunka.nii.ac.jp/suisensyo/himeji)
export const KEEPS = [{ id: 'cinder_keep', name: 'The Cinder Keep', x: 446, y: -792, z: 118, r: 30, a: 0.35 }, { id: 'ember_gate', name: 'The Ember Gate', x: 322, y: -966, z: 102, r: 26, a: -0.5 }];
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const shore = (a) => 1 + 0.10 * Math.sin(a * 3 + 1.1) + 0.07 * Math.sin(a * 5 + 2.7) + 0.045 * Math.sin(a * 9 + 0.4);
const rough = (x, y) => 0.5 * Math.sin(x * 0.061 + y * 0.043) + 0.3 * Math.sin(x * 0.13 - y * 0.097 + 1.3) + 0.2 * Math.sin(x * 0.23 + y * 0.19 + 2.1);
const edge = (x, y) => Math.hypot(x - ISLE.x, y - ISLE.y) / (ISLE.R * shore(Math.atan2(y - ISLE.y, x - ISLE.x)));

// The volcano world (Randy, 2 Nov: "We need a volcano world too to contrast the waterfall"). Read off drone footage of a real eruption: black ground, a blazing vent at the crater, braided rivers running out across it, a red glow on the plume, white steam where it meets the sea. The lava's rivers, from the crater to the sea, in the isle's own ground: each carves its channel with levees either side, and a cliff ring round the cone makes them fall, the same way the rivers of the other islands make waterfalls
const RIM = 96, FLOW = [
  { w: 5.5, pts: [[378, -874], [402, -866], [430, -882], [456, -862], [482, -874], [512, -868]] },
  { w: 5, pts: [[378, -874], [372, -902], [394, -928], [380, -956], [398, -986], [392, -1016]] },
  { w: 5.5, pts: [[378, -874], [404, -844], [412, -812], [442, -786], [456, -750], [486, -722]] },
  { w: 3.6, pts: [[412, -812], [386, -790], [374, -756], [352, -716], [340, -668], [336, -640]] },
  { w: 3.2, pts: [[394, -928], [426, -936], [446, -966], [474, -986]] },
];
let lines = null;
export function lavaLines() {
  if (lines) return lines; lines = [];
  const crm = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (const f of FLOW) { const P = f.pts, out = []; for (let i = 0; i + 1 < P.length; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)], n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 3.5); for (let k = 0; k < n; k++) { const t = k / n, wob = Math.sin(i * 3.1 + k * 0.7) * 1.2; out.push([crm(p0[0], p1[0], p2[0], p3[0], t) + wob, crm(p0[1], p1[1], p2[1], p3[1], t) - wob * 0.6]); } } out.push(P[P.length - 1]); lines.push({ w: f.w, pts: out }); }
  return lines;
}
let chanGrid = null;
const CH = 18;
export function chan(x, y) {        // the nearest lava channel: how far, in its own widths
  if (!chanGrid) { chanGrid = new Map(); lavaLines().forEach((l) => l.pts.forEach((p, i) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const k = (Math.floor(p[0] / CH) + a) * 4099 + Math.floor(p[1] / CH) + b; let L = chanGrid.get(k); if (!L) chanGrid.set(k, (L = [])); L.push([p[0], p[1], l.w]); } })); }
  const L = chanGrid.get(Math.floor(x / CH) * 4099 + Math.floor(y / CH)); if (!L) return 9; let best = 9; for (const c of L) { const d = Math.hypot(x - c[0], y - c[1]) / c[2]; if (d < best) best = d; } return best;
}

// the ground here: a low plain, a shore that falls away, and the volcano, its crater open at the top
export function isleZ(x, y, bed) {
  const r = edge(x, y); if (r >= 1.4) return bed;
  const land = 1 - smooth((r - 0.8) / 0.2), town = 1 - smooth((Math.hypot(x - CITY.x, y - CITY.y) - CITY.r) / 40); let z = -2.4 + land * (8.4 + rough(x, y) * 0.8 * (1 - town * 0.92));      // level under the streets, or every kerb is a wall
  const d = Math.hypot(x - FIRE_HILL.x, y - FIRE_HILL.y); z += land * (128 * Math.exp(-Math.pow(d / 72, 1.45)) - 54 * Math.exp(-Math.pow(d / 21, 2)) + 11 * (1 - smooth((d - RIM + rough(x, y) * 6) / 7)) * (1 - town));      // the cone, its crater, and the cliff ring its rivers fall over
  const cd = chan(x, y); if (cd < 3 && r < 1.02 && town < 0.5) z += -2.4 * Math.exp(-cd * cd * 1.1) + 0.9 * Math.exp(-(cd - 1.6) * (cd - 1.6) * 3);      // a channel, with its levees
  // a volcanic shore: it drops away at once into dark water, no pale shelf and no surf
  return r <= 1 ? z : Math.min(z + (Math.min(bed, -14) - z) * smooth((r - 1) / 0.14), z) * (1 - smooth((r - 1.14) / 0.26)) + bed * smooth((r - 1.14) / 0.26);
}
export function addIsle(data) {
  if (data.poi.some((p) => p.id === CITY.id)) return;
  data.poi.push({ id: 'burnt_isle', name: 'The Burnt Isle', x: ISLE.x, y: ISLE.y, z: 8, r: ISLE.R, noBreak: true }, { ...CITY, z: 8, noBreak: true }, { ...SKY, noBreak: true }, ...KEEPS.map((k) => ({ ...k, fort: true, noBreak: true })));
  const z = isleZ(FIRE_HILL.x, FIRE_HILL.y, 0) + 8; data.plumes.push({ id: 'isle_crater', x: FIRE_HILL.x, y: FIRE_HILL.y, z, r: 16, h: 120 });
  // what stood on this sea floor is under the island now
  for (const k in data.instances) { const L = data.instances[k]; let hit = false; for (let i = 0; i < L.length; i += 6) if (edge(L[i], L[i + 1]) < 1.15) { hit = true; break; } if (!hit) continue; const keep = []; for (let i = 0; i < L.length; i += 6) if (edge(L[i], L[i + 1]) >= 1.15) keep.push(L[i], L[i + 1], L[i + 2], L[i + 3], L[i + 4], L[i + 5]); data.instances[k] = keep; }
  for (const s of data.schools || []) { const r = edge(s.x, s.y); if (r < 1.3) { const a = Math.atan2(s.y - ISLE.y, s.x - ISLE.x); s.x = ISLE.x + Math.cos(a) * ISLE.R * 1.5; s.y = ISLE.y + Math.sin(a) * ISLE.R * 1.5; } }
}
export function raiseIsle(data, Hz, n, cell, ox, oy) {
  // land already raised here (Saltlight's plain runs into the isle's west shore, metro.js) keeps its height: the isle's shore only drops into the sea where there was sea
  const near = Math.ceil((ISLE.R * 1.6) / cell), ci = Math.round((ISLE.x - ox) / cell), cj = Math.round((ISLE.y - oy) / cell);
  for (let j = Math.max(0, cj - near); j <= Math.min(n - 1, cj + near); j++) for (let i = Math.max(0, ci - near); i <= Math.min(n - 1, ci + near); i++) { const o = j * n + i, was = Hz[o], z = isleZ(ox + i * cell, oy + j * cell, was); Hz[o] = was > 0.5 ? Math.max(z, was) : z; }
  // a pearl that was on the old sea floor now lies on the new ground
  for (const p of data.pearls || []) if (edge(p[0], p[1]) < 1.2) { const g = isleZ(p[0], p[1], p[2] - 2); if (g > p[2] - 1) p[2] = g + 1.3; }
}
// black rock wherever the isle stands (biome2, red: cinder. On land that's black rock)
export function paintIsle(b, bn, c, ox, oy) {
  const near = Math.ceil((ISLE.R * 1.3) / c), ci = Math.round((ISLE.x - ox) / c), cj = Math.round((ISLE.y - oy) / c);
  for (let j = Math.max(0, cj - near); j <= Math.min(bn - 1, cj + near); j++) for (let i = Math.max(0, ci - near); i <= Math.min(bn - 1, ci + near); i++) { const k = 1 - smooth((edge(ox + i * c, oy + j * c) - 1.0) / 0.12), o = (j * bn + i) * 4; if (k <= 0) continue; const c0 = Math.round(255 * k + b[o] * (1 - k)), g = Math.round(b[o + 1] * (1 - k)), r = Math.round(b[o + 2] * (1 - k)); b[o] = c0; b[o + 1] = g; b[o + 2] = r; const x = ox + i * c, y = oy + j * c, hc = Math.max(0, 1 - Math.hypot(x - FIRE_HILL.x, y - FIRE_HILL.y) / 140), hl = Math.max(0, 1 - chan(x, y) / 9); b[o + 3] = Math.round(255 * Math.min(1, Math.max(hc, hl)) * k); }
  return b;
}
// the rock the High City stands on: flat on top, a broken cone below it, split by the same molten seams as an Emberkin
export function skyRock(scene, look, U) {
  const P = [], M = [], I = [];
  // the High City's rock, and a smaller one under each keep: the same shape to scale, all one mesh and one draw
  const rock = (S, seg) => {
    const k0 = S.r / SKY.r, base = P.length / 3, rings = [[0, 0], [0.45, 0], [0.8, 0], [0.97, -0.2], [1.02, -1.4], [1.0, -6], [0.88, -15], [0.68, -28], [0.46, -42], [0.27, -56], [0.1, -70]];
    const rim = (a) => S.r * 1.07 * (1 + 0.06 * Math.sin(a * 3 + S.x + 0.7) + 0.045 * Math.sin(a * 7 + 1.9)), bump = (a, d) => (d < -1 ? k0 : 0) * (2.6 * Math.sin(a * 11 + d * 0.3) + 1.8 * Math.sin(a * 17 - d * 0.21 + 1));
    for (let k = 0; k < rings.length; k++) for (let j = 0; j < seg; j++) { const a = (j / seg) * 6.2832, f = rings[k][0], d = rings[k][1] * (rings[k][1] < -1 ? k0 : 1), r = f * rim(a) + bump(a, d) * Math.min(1, f * 1.4); P.push(S.x + Math.cos(a) * r, S.z + d + (d < -1 ? bump(a + 1, d) * 0.8 : 0), -(S.y + Math.sin(a) * r)); M.push(d < -1 ? 0.55 + 0.25 * Math.sin(a * 5 + d) : 0.1, 0, 0, 1); }
    for (let k = 0; k + 1 < rings.length; k++) for (let j = 0; j < seg; j++) { const a = base + k * seg + j, b = base + k * seg + (j + 1) % seg, c = a + seg, e = b + seg; I.push(a, e, b, a, c, e); }
    const tip = P.length / 3; P.push(S.x, S.z - 84 * k0, -S.y); M.push(0.9, 0, 0, 1); for (let j = 0; j < seg; j++) I.push(base + (rings.length - 1) * seg + j, tip, base + (rings.length - 1) * seg + (j + 1) % seg);
  };
  rock(SKY, 56); for (const k of KEEPS) rock(k, 30);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('_mask', new THREE.Float32BufferAttribute(M, 4)); g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(P.length).fill(1), 3)); g.setIndex(I); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  look.patch(m, { key: 'skyrock', uniforms: { uEmT: U.ocTime, uHeat: { value: 1 }, uEmS: { value: new THREE.Vector4(0, 0, 0, 0.035) }, uSide: { value: 0 } }, ...BURN });
  const o = new THREE.Mesh(g, m); o.name = 'sky_rock'; o.frustumCulled = true; g.computeBoundingSphere(); scene.add(o); return o;
}
