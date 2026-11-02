// The towers' depth. Randy, 2 Nov: "The buildings look flat and not actually 3d bro" · "The city looks like paper machet" · "the city buildings still look fucked so that needs fixing too".
// Every source is in Pipeline/research/CITY_LIFE_SOURCES.md, "The towers' depth". The method is the shipped one: a building is a volume styled by a shape grammar into floors and bays (Müller et al.
// 2006), built from kit pieces that stand proud of the wall (game source 10), with a bottom style and an upper style. The pieces' profiles are the MIT-licensed New York kit's
// (achrefelouafi/ProceduralBuildingsThreeJS, Copyright 2026 mohamedachrefelouafi: CRN_Profile, BAND_Profile, SILL, BAL_Slab), its proportions read off its French generator (3 m bays, a 4.2 m ground
// floor, 3.2 m floors, a corner pier, a cornice per bay). Sizes are the real ones: a reveal of 0.10-0.20 m, projections up to 0.25 m over a street and balconies to 0.76 m (NYC LL28 of 2012), a 1.1 m
// railing wall on a balcony (Japan's Enforcement Order Art. 126), parapets 0.76-1.22 m, water tanks 3-3.7 m, packaged roof units 1.9-4.0 m long, lift overruns 3.9-5.4 m.
// Cut to a phone (his rule: too heavy is not a no, make the optimised version): the walls stay one instanced box each with the windows set into them in the shader (metro.js), and the pieces
// that stand out are merged at load into one mesh per district, one draw each, as a distant district is one mesh in game source 12.
import * as THREE from 'three';

const STOREY = 3.4, SHOP = 6.8;
export const FAMILY = { GLASS: 0, MASONRY: 1, RIBBON: 2, FINS: 3, FLATS: 4 };
// which facade a building takes, by its height: glass and fins on the towers; masonry and flats under the roofline, as an old port city's blocks are
export const TOWER = [[FAMILY.GLASS, 0.42], [FAMILY.FINS, 0.25], [FAMILY.RIBBON, 0.2], [FAMILY.MASONRY, 0.13]];
export const MIDRISE = [[FAMILY.MASONRY, 0.32], [FAMILY.FLATS, 0.34], [FAMILY.RIBBON, 0.22], [FAMILY.GLASS, 0.12]];
export const LOW = [[FAMILY.FLATS, 0.45], [FAMILY.MASONRY, 0.4], [FAMILY.RIBBON, 0.15]];
export function pickFam(r, table) { for (const [f, w] of table) { if ((r -= w) <= 0) return f; } return table[table.length - 1][0]; }

// A window in its bay, by family, as fractions of the bay and the storey: [side margin, sill, head]. The shader and the kit read this one table, so sills, fins and balconies sit on the windows.
// Flats: tall doors to the balcony on a street face, small windows on a face over a light well
const WIN = [[0.05, 0.08, 0.06], [0.25, 0.28, 0.22], [0.0, 0.36, 0.18], [0.12, 0.06, 0.06], [0.08, 0.0, 0.25]], WIN_WELL = [0.3, 0.4, 0.25];
// how deep each window sits behind its wall (m): curtain glass just behind its caps; a masonry reveal "usually 4 inches, sometimes 8"; ribbon and fin glass behind their slab edges
const REVEAL = [0.07, 0.17, 0.12, 0.15, 0.11];
// wall tones, four to a family (linear albedo): glass towers' frames; masonry buff, red and brown brick and limestone; ribbon concretes; fins in white concrete, terracotta, dark metal, sandstone;
// flats in white tile, beige, pale grey and cream, as an anime city's blocks are
const TONES = [
  [[0.05, 0.055, 0.06], [0.30, 0.27, 0.22], [0.42, 0.42, 0.42], [0.12, 0.09, 0.07]],
  [[0.42, 0.30, 0.19], [0.30, 0.13, 0.08], [0.50, 0.45, 0.36], [0.24, 0.15, 0.11]],
  [[0.40, 0.40, 0.38], [0.34, 0.34, 0.33], [0.45, 0.43, 0.40], [0.30, 0.31, 0.32]],
  [[0.55, 0.54, 0.52], [0.42, 0.22, 0.14], [0.10, 0.10, 0.11], [0.48, 0.42, 0.32]],
  [[0.58, 0.56, 0.52], [0.52, 0.45, 0.35], [0.44, 0.44, 0.43], [0.56, 0.50, 0.40]],
];
// a street face is one with at least 10 m before the next building; less is a light well between plots
export const STREET = 10;

// The GLSL side of the same tables, for the walls' shader (metro.js)
export function familyGLSL() {
  const f = (x) => (+x).toFixed(3), v3 = (a) => `vec3(${a.map(f).join(', ')})`;
  return /* glsl */`
    const vec3 OC_WIN[5] = vec3[5](${WIN.map(v3).join(', ')});
    const vec3 OC_WIN_WELL = ${v3(WIN_WELL)};
    const float OC_REVEAL[5] = float[5](${REVEAL.map(f).join(', ')});
    const vec3 OC_TONE[20] = vec3[20](${TONES.flat().map(v3).join(', ')});
    vec3 ocWinOf(int fam, float street) { return fam == 4 && street < ${f(STREET)} ? OC_WIN_WELL : OC_WIN[fam]; }
  `;
}

// The opposite side of each face: how wide its street is and how tall the building across it, so the shader can take the sky a lower floor sees (the configuration factor in the sources)
const inFoot = (b, x, y) => { const c = Math.cos(b.yaw || 0), s = Math.sin(b.yaw || 0), dx = x - b.x, dz = -(y - b.y), ox = dx * c - dz * s, oz = dx * s + dz * c; return Math.abs(ox) <= b.sx / 2 && Math.abs(oz) <= b.sy / 2; };
// a face's frame in the world: its u = 0 corner, the way u runs, its outward normal (x and z of three's world) and its width; the same as the shader's vFa (metro.js), face order +x, -x, +z, -z
export function faceFrames(b) {
  const c = Math.cos(b.yaw || 0), s = Math.sin(b.yaw || 0), R = (ox, oz) => [ox * c + oz * s, -ox * s + oz * c], Wp = (ox, oz) => { const r = R(ox, oz); return [b.x + r[0], -b.y + r[1]]; }, hx = b.sx / 2, hz = b.sy / 2;
  return [
    { n: R(1, 0), t: R(0, -1), o: Wp(hx, hz), w: b.sy },
    { n: R(-1, 0), t: R(0, 1), o: Wp(-hx, -hz), w: b.sy },
    { n: R(0, 1), t: R(1, 0), o: Wp(-hx, hz), w: b.sx },
    { n: R(0, -1), t: R(-1, 0), o: Wp(hx, -hz), w: b.sx },
  ];
}
export function measureStreets(boxes) {
  const vols = boxes.filter((b) => b.kind === 0), top = new Map(), grid = new Map(), C = 16, key = (i, j) => i * 4099 + j;
  for (const b of vols) top.set(b.bid, Math.max(top.get(b.bid) || 0, b.z0 + b.h));
  for (const b of vols) { const r = Math.hypot(b.sx, b.sy) / 2; for (let i = Math.floor((b.x - r) / C); i <= Math.floor((b.x + r) / C); i++) for (let j = Math.floor((b.y - r) / C); j <= Math.floor((b.y + r) / C); j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); } }
  for (const b of vols) {
    b.cw = [90, 90, 90, 90]; b.ch = [0, 0, 0, 0];
    faceFrames(b).forEach((F, k) => {
      const cx = F.o[0] + F.t[0] * F.w / 2, cz = F.o[1] + F.t[1] * F.w / 2;
      for (let d = 0.6; d < 90; d += 1) {
        const x = cx + F.n[0] * d, y = -(cz + F.n[1] * d), L = grid.get(key(Math.floor(x / C), Math.floor(y / C))); if (!L) continue;
        const hit = L.find((o) => o.bid !== b.bid && inFoot(o, x, y)); if (hit) { b.cw[k] = d; b.ch[k] = top.get(hit.bid) - b.foot; break; }
      }
    });
  }
}

// ---------------------------------------------------------------- the pieces
// Profiles in (out from the wall, up), closed, read off the kit's meshes: the cornice (CRN_Profile: a frieze, a bed moulding, the corona 1.04 m out, its cymatium) and the belt course (BAND_Profile)
const CORNICE = [[0, 0], [0.06, 0], [0.06, 0.35], [0.14, 0.33], [0.14, 0.40], [0.20, 0.40], [0.20, 0.62], [1.0, 0.62], [1.0, 0.86], [1.04, 0.86], [1.04, 0.93], [0.98, 0.93], [0.98, 1.0], [0, 1.0]];
const BAND = [[0, 0], [0.06, 0], [0.06, 0.25], [0.10, 0.25], [0.10, 0.30], [0.13, 0.30], [0.13, 0.35], [0, 0.35]];
const rect = (o, u0, u1) => [[0, u0], [o, u0], [o, u1], [0, u1]];
const sc = (P, so, su, du = 0) => P.map(([o, u]) => [o * so, u * su + du]);
// each family's crown, as (profile, how far above the roof it rises): masonry the kit's cornice, 0.75 m out and 0.9 m tall, 0.35 m of it above the roof as the parapet; flats a 1.1 m railing wall;
// ribbon a concrete coping; glass and fins a metal one
const CROWN = [sc(rect(1, 0, 1), 0.12, 0.7, -0.25), sc(CORNICE, 0.72, 0.9, -0.55), sc(rect(1, 0, 1), 0.3, 0.9, -0.35), sc(rect(1, 0, 1), 0.12, 0.7, -0.25), sc(rect(1, 0, 1), 0.18, 1.35, -0.25)];
const TRIM = (fam, tone) => fam === FAMILY.MASONRY ? (tone === 2 ? [0.58, 0.54, 0.46] : [0.50, 0.46, 0.38]) : fam === FAMILY.GLASS ? [0.30, 0.31, 0.32] : TONES[fam][tone].map((c) => Math.min(1, c * 1.12 + 0.03));

export function buildKit({ plan, look, phone }) {
  const vols = plan.boxes.filter((b) => b.kind === 0), cx = plan.center.x, cy = plan.center.y, D = [0, 1, 2, 3].map(() => ({ P: [], N: [], C: [] }));
  let tris = 0;
  // geometry is written straight into its district's arrays: three's world (x, up, z = -y)
  const tri = (d, a, b, c, col) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; for (const p of [a, b, c]) { d.P.push(p[0], p[1], p[2]); d.N.push(nx, ny, nz); d.C.push(col[0], col[1], col[2]); } tris++; };
  // a quad whose front faces away from a point inside the solid
  const quad = (d, a, b, c, e, col, inside) => { const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, mz = (a[2] + c[2]) / 2, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (nx * (mx - inside[0]) + ny * (my - inside[1]) + nz * (mz - inside[2]) < 0) { tri(d, a, c, b, col); tri(d, a, e, c, col); } else { tri(d, a, b, c, col); tri(d, a, c, e, col); } };
  const quadTo = (d, a, b, c, e, col, want) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (nx * want[0] + ny * want[1] + nz * want[2] < 0) { tri(d, a, c, b, col); tri(d, a, e, c, col); } else { tri(d, a, b, c, col); tri(d, a, c, e, col); } };
  const triIn = (d, a, b, c, col, inside) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, mx = (a[0] + b[0] + c[0]) / 3 - inside[0], my = (a[1] + b[1] + c[1]) / 3 - inside[1], mz = (a[2] + b[2] + c[2]) / 3 - inside[2]; if (nx * mx + ny * my + nz * mz < 0) tri(d, a, c, b, col); else tri(d, a, b, c, col); };
  // a profile run along a face from u0 to u1 at height z, mitred at the ends it's told to (a building's convex corners meet at 45°, so no corner overlaps another and none is open)
  const run = (d, F, u0, u1, z, prof, col, mitre0, mitre1) => {
    const at = (u, o, up) => [F.o[0] + F.t[0] * u + F.n[0] * o, z + up, F.o[1] + F.t[1] * u + F.n[1] * o];
    for (let i = 0; i < prof.length; i++) {
      const [o0, v0] = prof[i], [o1, v1] = prof[(i + 1) % prof.length];
      if (o0 <= 0.001 && o1 <= 0.001) continue;
      const a = at(u0 - (mitre0 ? o0 : 0), o0, v0), b = at(u0 - (mitre0 ? o1 : 0), o1, v1), c = at(u1 + (mitre1 ? o1 : 0), o1, v1), e = at(u1 + (mitre1 ? o0 : 0), o0, v0);
      const no = v1 - v0, nu = -(o1 - o0);
      quadTo(d, a, b, c, e, col, [F.n[0] * no, nu, F.n[1] * no]);
    }
    if (!mitre0 || !mitre1) { const tr = THREE.ShapeUtils.triangulateShape(prof.map(([o, u]) => new THREE.Vector2(o, u)), []); for (const [end, u, m] of [[0, u0, mitre0], [1, u1, mitre1]]) { if (m) continue; const want = end ? [F.t[0], 0, F.t[1]] : [-F.t[0], 0, -F.t[1]]; for (const [i, j, k] of tr) { const A = at(u, ...prof[i]), B = at(u, ...prof[j]), Cc = at(u, ...prof[k]); quadTo(d, A, B, Cc, Cc, col, want); } } }
  };
  // a box set against a face: u from u0 to u1, out from o0 to o1, up from z0 to z1; its back is in the wall and isn't drawn
  const slab = (d, F, u0, u1, o0, o1, z0, z1, col) => {
    const at = (u, o, z) => [F.o[0] + F.t[0] * u + F.n[0] * o, z, F.o[1] + F.t[1] * u + F.n[1] * o], ins = at((u0 + u1) / 2, (o0 + o1) / 2, (z0 + z1) / 2);
    const P = [at(u0, o0, z0), at(u1, o0, z0), at(u1, o1, z0), at(u0, o1, z0), at(u0, o0, z1), at(u1, o0, z1), at(u1, o1, z1), at(u0, o1, z1)];
    for (const [a, b, c, e] of [[4, 5, 6, 7], [0, 1, 2, 3], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]]) quad(d, P[a], P[b], P[c], P[e], col, ins);
    if (o0 > 0.01) quad(d, P[0], P[1], P[5], P[4], col, ins);
  };
  // a free box on a roof, turned to its building
  const cube = (d, b, ox, oy, z0, w, l, h, col) => { const F = faceFrames(b)[2], cxw = b.x + ox, czw = -(b.y + oy), ex = [F.t[0] * w / 2, F.t[1] * w / 2], ez = [F.n[0] * l / 2, F.n[1] * l / 2], ins = [cxw, z0 + h / 2, czw];
    const p = (sx, sz, z) => [cxw + ex[0] * sx + ez[0] * sz, z, czw + ex[1] * sx + ez[1] * sz], P = [p(-1, -1, z0), p(1, -1, z0), p(1, 1, z0), p(-1, 1, z0), p(-1, -1, z0 + h), p(1, -1, z0 + h), p(1, 1, z0 + h), p(-1, 1, z0 + h)];
    for (const [a, bb, c, e] of [[4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) quad(d, P[a], P[bb], P[c], P[e], col, ins); };
  // a round tank on a stand of four legs, as a New York roof has: 3.3 m across, 3.5 m of staves, a cone of a roof
  const tank = (d, x, y, z, r, h, col) => { const n = 10, cz = -y, legs = 2.4, z0 = z + legs, wood = col, steel = [0.16, 0.16, 0.17];
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lx = x + sx * r * 0.62, lz = cz + sz * r * 0.62, w = 0.12; const P = [[lx - w, z, lz - w], [lx + w, z, lz - w], [lx + w, z, lz + w], [lx - w, z, lz + w]].map((q) => q); for (let k = 0; k < 4; k++) { const a = P[k], b = P[(k + 1) % 4]; quad(d, a, b, [b[0], z0, b[2]], [a[0], z0, a[2]], steel, [lx, z + 1, lz]); } }
    for (let k = 0; k < n; k++) { const a0 = (k / n) * 6.2832, a1 = ((k + 1) / n) * 6.2832, A = [x + Math.cos(a0) * r, z0, cz + Math.sin(a0) * r], B = [x + Math.cos(a1) * r, z0, cz + Math.sin(a1) * r]; quad(d, A, B, [B[0], z0 + h, B[2]], [A[0], z0 + h, A[2]], wood, [x, z0 + h / 2, cz]); triIn(d, [A[0], z0 + h, A[2]], [x, z0 + h + 1.0, cz], [B[0], z0 + h, B[2]], [0.20, 0.13, 0.08], [x, z0 + h - 1, cz]); triIn(d, [A[0], z0, A[2]], [B[0], z0, B[2]], [x, z0, cz], steel, [x, z0 + 1, cz]); }
  };
  const top = new Map(); for (const b of vols) { const t = top.get(b.bid); if (!t || b.z0 + b.h > t.z0 + t.h) top.set(b.bid, b); }
  const rng = (seed) => { let s = Math.floor(seed * 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  for (const b of vols) {
    const d = D[(b.x < cx ? 0 : 1) + (b.y < cy ? 0 : 2)], fam = b.fam ?? 1, tone = b.tone ?? 0, wall = TONES[fam][tone], trim = TRIM(fam, tone), T = b.z0 + b.h, fr = faceFrames(b), r = rng(b.seed * 0.73 + 0.11);
    const rows0 = Math.max(2, Math.ceil((b.z0 - b.foot) / STOREY - 0.01)), rows1 = Math.floor((T - b.foot) / STOREY + 0.01) - 1, bay = b.bay || 3.6;
    fr.forEach((F, k) => {
      const street = b.cw ? b.cw[k] : 90, W = F.w;
      // the crown on every roofline, setbacks included
      run(d, F, 0, W, T, CROWN[fam], trim, true, true);
      // the band over the shops, on the volume the shops are in
      if (fam !== FAMILY.GLASS && fam !== FAMILY.FINS && b.z0 - b.foot < SHOP - 0.5 && T - b.foot > SHOP + 2) run(d, F, 0, W, b.foot + SHOP - 0.12, sc(BAND, 1.4, 1, 0), trim, true, true);
      // masonry: a ledge between groups of four floors (Müller's split); ribbon: a slab edge at every floor, 0.25 m out, so the facade reads in horizontal bands of shadow
      if (fam === FAMILY.MASONRY) for (let row = 6; row <= rows1 - 1; row += 4) run(d, F, 0, W, b.foot + row * STOREY - 0.12, sc(BAND, 1.0, 0.9, 0), trim, true, true);
      if (fam === FAMILY.RIBBON) for (let row = rows0; row <= rows1; row++) run(d, F, 0, W, b.foot + row * STOREY - 0.1, rect(0.25, 0, 0.32), trim, true, true);
      const n = Math.max(1, Math.floor(W / bay + 1e-6)), cw = W / n;
      // masonry: a stone sill under every window on a street face, up to the fourteenth floor (beyond, too small to see)
      if (fam === FAMILY.MASONRY && street >= 6) { const [mx, mb] = WIN[1]; for (let row = rows0; row <= Math.min(rows1, 14); row++) for (let i = 0; i < n; i++) { const u0 = i * cw + mx * cw - 0.08, u1 = (i + 1) * cw - mx * cw + 0.08, z = b.foot + row * STOREY + mb * STOREY; slab(d, F, u0, u1, 0, 0.15, z - 0.09, z, trim); } }
      // fins: one at every bay line, 0.6 m deep and 0.3 m thick (sun fins to 2 ft 6 in), from over the shops to under the coping
      if (fam === FAMILY.FINS) for (let i = 1; i < n; i++) slab(d, F, i * cw - 0.15, i * cw + 0.15, 0, 0.6, Math.max(b.z0, b.foot + SHOP), T - 0.25, trim);
      // flats on a street face: a balcony on every floor, 1.2 m deep, its solid railing wall 1.1 m tall, a partition between flats every two bays, and an outdoor unit on some
      if (fam === FAMILY.FLATS && street >= STREET && W > 6) {
        const rail = tone === 2 ? [0.36, 0.42, 0.46] : wall.map((c) => Math.min(1, c * 1.05));
        for (let row = rows0; row <= rows1; row++) { const z = b.foot + row * STOREY; slab(d, F, 0.3, W - 0.3, 0, 1.2, z - 0.16, z, wall); slab(d, F, 0.3, W - 0.3, 1.08, 1.2, z, z + 1.1, rail); slab(d, F, 0.3, 0.42, 0, 1.08, z, z + 1.1, rail); slab(d, F, W - 0.42, W - 0.3, 0, 1.08, z, z + 1.1, rail);
          for (let i = 2; i < n; i += 2) slab(d, F, i * cw - 0.05, i * cw + 0.05, 0, 1.08, z, z + 2.4, [0.30, 0.31, 0.32]);
          for (let i = 0; i < n; i++) if (r() < 0.35) slab(d, F, i * cw + 0.3, i * cw + 1.1, 0.7, 1.0, z, z + 0.62, [0.62, 0.62, 0.60]); }
      }
      // masonry: window units in some windows, the New York way, up to the twelfth floor
      if (fam === FAMILY.MASONRY && street >= 6) for (let row = rows0; row <= Math.min(rows1, 12); row++) for (let i = 0; i < n; i++) if (r() < 0.12) { const u = (i + 0.5) * cw, z = b.foot + row * STOREY + WIN[1][1] * STOREY; slab(d, F, u - 0.33, u + 0.33, 0, 0.42, z, z + 0.45, [0.58, 0.58, 0.56]); }
    });
    // roof gear on each building's highest roof, sized from the real units, kept off the crown
    if (top.get(b.bid) !== b || b.sx < 8 || b.sy < 8) continue;
    const ry = (q) => (q - 0.5), tall = T - b.foot > 60;
    if (tall) { cube(d, b, ry(r()) * b.sx * 0.3, ry(r()) * b.sy * 0.3, T, 5.5, 4.6, 4.6, [0.36, 0.36, 0.37]); for (let k = 0; k < 3; k++) cube(d, b, (k - 1) * 2.9, b.sy * 0.28, T, 2.24, 1.5, 1.04, [0.56, 0.56, 0.54]); }
    else if (fam === FAMILY.MASONRY) { tank(d, b.x + ry(r()) * b.sx * 0.4, b.y + ry(r()) * b.sy * 0.4, T, 1.65, 3.5, [0.30, 0.20, 0.12]); cube(d, b, -b.sx * 0.2, -b.sy * 0.2, T, 3.4, 4.9, 3.2, trim); }
    else if (fam === FAMILY.FLATS) { cube(d, b, ry(r()) * b.sx * 0.3, ry(r()) * b.sy * 0.3, T, 4, 3, 3, wall); cube(d, b, b.sx * 0.25, -b.sy * 0.25, T, 1.92, 0.96, 1.28, [0.70, 0.70, 0.68]); }
    else { const k = 2 + Math.floor(r() * 3); for (let i = 0; i < k; i++) cube(d, b, ry(r()) * b.sx * 0.6, ry(r()) * b.sy * 0.6, T, i % 2 ? 2.9 : 1.9, i % 2 ? 1.6 : 1.2, i % 2 ? 1.0 : 0.84, [0.56, 0.56, 0.54]); cube(d, b, -b.sx * 0.22, b.sy * 0.2, T, 3.4, 4.9, 3.4, [0.34, 0.34, 0.35]); }
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 });
  // the same chosen shade as the walls (metro.js): a face turned from the sun takes the teal of an anime street's shade
  look.patch(mat, { key: 'metro_kit', vertexDecl: 'varying vec3 vKN;\n', vertexBend: '{ vKN = normalize(normal); }', fragmentPars: 'varying vec3 vKN;\n',
    albedo: '{ diffuseColor.rgb *= mix(vec3(.22, .36, .45), vec3(1.0), smoothstep(-.05, .3, dot(normalize(vKN), normalize(ocSunA)))); }' });
  const meshes = D.filter((d) => d.P.length).map((d, i) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(d.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(d.N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(d.C, 3)); g.computeBoundingSphere(); const m = new THREE.Mesh(g, mat); m.name = 'metro_kit_' + i; return m; });
  return { meshes, tris };
}
