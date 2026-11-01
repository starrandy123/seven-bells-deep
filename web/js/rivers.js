// Rivers that sit in the land. Randy, 1 Nov: "The water needs to actually ride out on the ground too to make the river stream on ground", "I'm talking about
// the waterfall". A river was a strip laid on the grass; now each one is levelled into a channel of its own before anything is built from the height field:
//   · its surface comes from the ground it runs through: a little under its lower bank, no deeper than its channel allows, never climbing as it runs down;
//   · the channel is dug under that surface, and a bank too low to hold it is built up, so the water meets the land along a real shoreline;
//   · a fall's foot gets a plunge pool: an oval basin dug where the water lands (the rock above it is only undercut, as falling water wears it), level with
//     the river it feeds, which leaves the pool through a gap in its rim.
// The ground you see, the ground he walks on and every prop's footing come from the carved field, so they agree. The surface level is kept on the height
// field's own grid (the ground's shader draws a wet bed and banks from it and grows no grass under water) and as profiles (the hero wades in them).
// Blender coordinates throughout (x, y on the ground, z up), as world.json is.
import * as THREE from 'three';

export const NO_WATER = -1000;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const FREE = 0.22;            // the surface sits this far under the lower bank
const MAXDIG = 1.0;           // and never more than this under the level its own channel gives: past that, the bank is built up instead
const BANK_H = 0.35, BANK_W = 1.8, FALLOFF = 3.5;     // the rim a bank is built to above the water, how far out it reaches, how far it takes to meet the ground as it was
const MAXBUILD = 1.6;         // a bank is built up this far at most: lower ground than that is a drop (a hillside, a fall's lip), not a bank to make good
const DS = 1.0;               // metres between profile samples
const POOL_EDGE = [1.0, 1.16];  // a pool's water gives way to its river's across this band of its oval (and the river's to the pool's, the other way)

// A fall's foot, found the way world.js lays its sheet: each row walks out from the lip until it's clear of the ground at that height.
function footOf(f, at) {
  const c = Math.cos(f.yaw || 0), sn = Math.sin(f.yaw || 0), rows = 20, h = f.z0 - f.z1;
  let o = 0;
  for (let i = 0; i <= rows; i++) { const z = f.z0 - h * i / rows; for (; o < 60; o += .25) if (at(f.x + o * sn, f.y - o * c) < z - .35) break; }
  const d = o + .35;
  return { x: f.x + d * sn, y: f.y - d * c, ox: sn, oy: -c };       // and the way out from the rock
}
// how far out on a pool's oval a point is: 0 at its middle, 1 on its rim
export const ovalOf = (pl, x, y) => { const dx = x - pl.cx, dy = y - pl.cy; return Math.hypot((dx * pl.ux + dy * pl.uy) / pl.ra, (-dx * pl.uy + dy * pl.ux) / pl.rb); };

export function planRivers(data, Hz, n, cell, ox, oy) {
  const R = data.rivers || [], F = data.waterfalls || [];
  if (!R.length && !F.length) return null;
  const at = (x, y) => {                                          // the field (as it was, until the carve is written)
    let fx = (x - ox) / cell, fy = (y - oy) / cell; fx = Math.max(0, Math.min(n - 1.001, fx)); fy = Math.max(0, Math.min(n - 1.001, fy));
    const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * n + ix;
    return Hz[o] * (1 - ax) * (1 - ay) + Hz[o + 1] * ax * (1 - ay) + Hz[o + n] * (1 - ax) * ay + Hz[o + n + 1] * ax * ay;
  };
  // a pool at every fall's foot: wider than the sheet where it lands, reaching a little in under it to the rock and on out past it; the river starting
  // nearest it (within 30 m) is the one it feeds
  const pools = [];
  for (const f of F) {
    const ft = footOf(f, at); let feed = null, bd = 30;
    for (const r of R) { const d = Math.hypot(r.pts[0][0] - ft.x, r.pts[0][1] - ft.y); if (d < bd) { bd = d; feed = r; } }
    const rb = Math.max(f.w * .5 * 1.1 * 1.3, feed ? feed.w * .5 + 2.2 : 4), ra = Math.max(4.5, rb * .85);
    pools.push({ f, ft, feed, cx: ft.x + ft.ox * ra * .55, cy: ft.y + ft.oy * ra * .55, ux: ft.ox, uy: ft.oy, ra, rb, W: null, depth: 1.7, sheetHalf: f.w * .5 * 1.1 });
  }

  const rivers = [];
  for (const r of R) {
    if (r.pts.length < 2) continue;
    const pool = pools.find((pl) => pl.feed === r) || null;
    const curve = new THREE.CatmullRomCurve3(r.pts.map((q) => new THREE.Vector3(q[0], q[1], 0)), false, 'centripetal');
    const len0 = curve.getLength(); curve.arcLengthDivisions = Math.max(200, Math.ceil(len0 * 2)); curve.updateArcLengths();
    const len = curve.getLength(), N = Math.max(2, Math.round(len / DS)), ds = len / N;
    const X = new Float32Array(N + 1), Y = new Float32Array(N + 1), TX = new Float32Array(N + 1), TY = new Float32Array(N + 1), HW = new Float32Array(N + 1), D = new Float32Array(N + 1);
    const Wr = new Float64Array(N + 1), p = new THREE.Vector3(), tg = new THREE.Vector3(), hw0 = r.w * .5, depth = .55 + .07 * r.w;
    const end = r.pts[r.pts.length - 1], lip = F.some((f) => Math.hypot(f.x - end[0], f.y - end[1]) < 3);       // this river goes over a fall
    for (let i = 0; i <= N; i++) {
      const u = i / N; curve.getPointAt(u, p); curve.getTangentAt(u, tg);
      // a stream's width wanders, and it fans out over a fall's lip (Randy, 1 Nov: the stream on the ground "looks sloppy"; a level ribbon of one width is what he saw)
      const sAt = i * ds, wander = 1 + .26 * Math.sin(sAt * .17 + r.w * 3.1) + .15 * Math.sin(sAt * .41 + r.w * 7.7), toLip = (len - sAt), fan = lip ? 1 + 1.3 * smooth(10, 0, toLip) : 1;
      const tl = Math.hypot(tg.x, tg.y) || 1; X[i] = p.x; Y[i] = p.y; TX[i] = tg.x / tl; TY[i] = tg.y / tl; HW[i] = hw0 * Math.max(wander, 1 - smooth(4, 0, sAt)) * fan; D[i] = depth;
      const nx = -TY[i], ny = TX[i], hw = HW[i];
      let bed = 1e9; for (let d = -.6 * hw; d <= .6 * hw + 1e-6; d += .5) bed = Math.min(bed, at(X[i] + nx * d, Y[i] + ny * d));
      const bank = (sd) => .5 * (at(X[i] + nx * sd * (hw + 1), Y[i] + ny * sd * (hw + 1)) + at(X[i] + nx * sd * (hw + 2.2), Y[i] + ny * sd * (hw + 2.2)));
      const low = Math.min(bank(-1), bank(1)), full = bed + D[i];
      Wr[i] = Math.min(full, Math.max(low - FREE, full - MAXDIG));
    }
    // smoothed, then never climbing downstream, then smoothed again (an average of a falling line still falls). The kernel shrinks symmetrically at the
    // ends, so a river's source and mouth keep their own height and slope instead of being dragged toward the middle.
    const blur = (a, sig) => { const K = Math.ceil(sig * 3), out = new Float64Array(a.length); for (let i = 0; i < a.length; i++) { const k = Math.min(K, i, a.length - 1 - i); let s = 0, w = 0; for (let j = -k; j <= k; j++) { const g = Math.exp(-(j * j) / (2 * sig * sig)); s += a[i + j] * g; w += g; } out[i] = s / w; } return out; };
    let W = blur(Wr, 3 / ds);
    for (let i = 1; i <= N; i++) if (W[i] > W[i - 1]) W[i] = W[i - 1];
    W = blur(W, 1.5 / ds);
    let iOut = 0;
    if (pool) {                                                   // inside its pool a river is the pool: level with it, from where it leaves the pool's rim
      while (iOut < N && ovalOf(pool, X[iOut], Y[iOut]) < 1.05) iOut++;
      for (let i = 0; i < iOut; i++) W[i] = W[iOut];
      pool.W = W[iOut]; pool.f.pool = pool.W;                     // the sheet reaches down to the pool's surface (world.js)
    }
    for (let i = 0; i <= N; i++) if (W[i] < 0) W[i] = 0;          // a river that reaches the sea ends at its level
    // how fast it runs (m/s) from how steeply it falls; the time the water takes to reach each sample (the shader moves its surface by that, so the
    // pattern runs at the river's own speed everywhere and stretches where it's fast); rapids where it's steep
    const SL = new Float32Array(N + 1), V = new Float32Array(N + 1), TAU = new Float32Array(N + 1), TURB = new Float32Array(N + 1), CH = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) { const a = Math.max(0, i - 2), b = Math.min(N, i + 2); SL[i] = Math.max(0, (W[a] - W[b]) / ((b - a) * ds)); }
    const SLs = blur(SL, 2 / ds);
    for (let i = 0; i <= N; i++) {
      V[i] = Math.min(5, .9 + 8 * SLs[i]); TURB[i] = smooth(.05, .25, SLs[i]);
      if (pool && i <= iOut + 6) { const k = smooth(iOut - 2, iOut + 6, i); V[i] = 1.6 + (V[i] - 1.6) * k; CH[i] = .35 * (1 - k); }     // pulled out of the pool, still stirred
      if (i) TAU[i] = TAU[i - 1] + ds / (.5 * (V[i] + V[i - 1]));
    }
    rivers.push({ id: r.id, w: r.w, N, ds, len, X, Y, TX, TY, HW, D, W: Float32Array.from(W), V, TAU, TURB, CH, pool, iOut });
  }
  for (const pl of pools) if (pl.W === null) { pl.W = Math.max(.1, pl.f.z1 - .4); pl.f.pool = pl.W; }      // a fall feeding no river keeps a pool of its own

  // where each grid node lies against each river: the nearest point on its course (a node on the outside of a bend belongs to the bend, not to whichever
  // sample happens to be closest), as the sample it falls after, how far past it (0-1) and its signed distance across. Nothing past either end: past a
  // river's end is a fall's lip or the sea.
  const near = new Map();                                         // node -> [river, sample, past, signed distance across, squared distance]
  for (let ri = 0; ri < rivers.length; ri++) {
    const rv = rivers[ri];
    for (let i = 0; i < rv.N; i++) {
      const ax = rv.X[i], ay = rv.Y[i], sx = rv.X[i + 1] - ax, sy = rv.Y[i + 1] - ay, l2 = sx * sx + sy * sy || 1e-6, reach = Math.max(rv.HW[i], rv.HW[i + 1]) + BANK_W + FALLOFF + 1;
      const x0 = Math.max(0, Math.floor((Math.min(ax, ax + sx) - reach - ox) / cell)), x1 = Math.min(n - 1, Math.ceil((Math.max(ax, ax + sx) + reach - ox) / cell));
      const y0 = Math.max(0, Math.floor((Math.min(ay, ay + sy) - reach - oy) / cell)), y1 = Math.min(n - 1, Math.ceil((Math.max(ay, ay + sy) + reach - oy) / cell));
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const px = ox + gx * cell - ax, py = oy + gy * cell - ay, tr = (px * sx + py * sy) / l2, t = Math.max(0, Math.min(1, tr)), qx = px - sx * t, qy = py - sy * t, e2 = qx * qx + qy * qy;
        if (e2 > reach * reach || (i === 0 && tr < 0) || (i === rv.N - 1 && tr > 1)) continue;
        const k = gy * n + gx, q = near.get(k);
        if (q && e2 >= q[4]) continue;
        const tx = rv.TX[i] + (rv.TX[i + 1] - rv.TX[i]) * t, ty = rv.TY[i] + (rv.TY[i + 1] - rv.TY[i]) * t, tl = Math.hypot(tx, ty) || 1;
        near.set(k, [ri, i, t, (qx * -ty + qy * tx) / tl, e2]);
      }
    }
  }
  const nearPool = new Map();                                     // node -> [pool, oval distance]
  pools.forEach((pl, pi) => {
    const reach = Math.max(pl.ra, pl.rb) + BANK_W + FALLOFF + 1, x0 = Math.max(0, Math.floor((pl.cx - reach - ox) / cell)), x1 = Math.min(n - 1, Math.ceil((pl.cx + reach - ox) / cell));
    const y0 = Math.max(0, Math.floor((pl.cy - reach - oy) / cell)), y1 = Math.min(n - 1, Math.ceil((pl.cy + reach - oy) / cell));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const e = ovalOf(pl, ox + gx * cell, oy + gy * cell), past = (e - 1) * Math.min(pl.ra, pl.rb);      // metres out past the rim (roughly)
      if (past > BANK_W + FALLOFF + 1) continue;
      const k = gy * n + gx, q = nearPool.get(k); if (!q || e < q[1]) nearPool.set(k, [pi, e]);
    }
  });
  const lerpAt = (A, i, t) => A[i] + (A[Math.min(i + 1, A.length - 1)] - A[i]) * t;

  // the carve: targets from the field as it was, then written. Inside any water (a river's channel or a pool's oval) the ground is dug to the deepest it
  // asks for; outside, a bank too low is built up to the highest rim near it (within MAXBUILD), and a dug channel's side is cut back to ~42°. Where a river
  // reaches the sea the carve gives way (the seabed is the sea's); a spring rises out of the ground, so its first metres are hardly dug; and the rock a fall
  // comes down is never dug, only what's within 2 m above its pool, so it's undercut where the water lands.
  const nodes = new Set([...near.keys(), ...nearPool.keys()]), out = [];
  let dug = 0, built = 0, maxDig = 0, maxBuild = 0, digAt = null, buildAt = null;
  for (const k of nodes) {
    const z0 = Hz[k], q = near.get(k), pq = nearPool.get(k);
    let dig = Infinity, rim = -Infinity, rimK = 0, cut = Infinity, cutK = 0, wet = false, strength = 1, tag = null;
    if (q) {
      const rv = rivers[q[0]], i = q[1], t = q[2], dn = Math.abs(q[3]), hw = lerpAt(rv.HW, i, t), Wl = lerpAt(rv.W, i, t), Dl = lerpAt(rv.D, i, t), sAt = (i + t) * rv.ds;
      const nearFall = rv.pool && ovalOf(rv.pool, ox + (k % n) * cell, oy + Math.floor(k / n) * cell) < 1.6;
      strength = smooth(.1, .6, Wl) * (rv.pool ? 1 : smooth(0, 6, sAt)); tag = [rv.id, +sAt.toFixed(1), +q[3].toFixed(1)];
      if (dn < hw) { const e = dn / hw; dig = Wl - .06 - (Dl - .06) * Math.pow(1 - e * e, .75); wet = true; }
      else {
        const x = dn - hw, kk = x < BANK_W ? 1 : 1 - smooth(BANK_W, BANK_W + FALLOFF, x);
        rim = Wl - .06 + (BANK_H + .06) * smooth(0, BANK_W, x); rimK = kk;
        if (!nearFall) { cut = Wl + .25 + x * .9; cutK = kk; }
      }
    }
    if (pq) {
      const pl = pools[pq[0]], e = pq[1];
      if (e < 1) { if (z0 <= pl.W + 2) dig = Math.min(dig, pl.W - .06 - (pl.depth - .06) * Math.pow(1 - e * e, .6)); wet = true; strength = 1; }
      else if (!wet) {
        const x = (e - 1) * Math.min(pl.ra, pl.rb), kk = x < BANK_W ? 1 : 1 - smooth(BANK_W, BANK_W + FALLOFF, x), r2 = pl.W - .06 + (BANK_H + .06) * smooth(0, BANK_W, x);
        if (r2 * kk > rim * rimK || rimK === 0) { rim = r2; rimK = kk; }
        cut = Infinity; cutK = 0; strength = 1;                  // round a fall's pool, the rock is left as it is
      }
    }
    let z = z0;
    if (wet) { if (z > dig) z = dig; }
    else {
      if (rimK > 0 && z < rim && rim - z <= MAXBUILD) z += (rim - z) * rimK;
      if (cutK > 0 && z > cut) z += (cut - z) * cutK;
    }
    z = z0 + (z - z0) * strength;
    if (z !== z0) {
      out.push(k, z);
      if (z < z0) { dug++; if (z0 - z > maxDig) { maxDig = z0 - z; digAt = tag || ['pool']; } } else { built++; if (z - z0 > maxBuild) { maxBuild = z - z0; buildAt = tag || ['pool']; } }
    }
  }
  const delta = new Map();
  for (let j = 0; j < out.length; j += 2) { delta.set(out[j], out[j + 1] - Hz[out[j]]); Hz[out[j]] = out[j + 1]; }
  const moveAt = (x, y) => {                                      // how far the ground under a point moved (bilinear over the nodes)
    const fx = Math.max(0, Math.min(n - 1.001, (x - ox) / cell)), fy = Math.max(0, Math.min(n - 1.001, (y - oy) / cell)), ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * n + ix;
    const g = (k) => delta.get(k) || 0;
    return g(o) * (1 - ax) * (1 - ay) + g(o + 1) * ax * (1 - ay) + g(o + n) * (1 - ax) * ay + g(o + n + 1) * ax * ay;
  };

  // the surface level on the grid, for the ground's shader: a pool's level over its oval and banks, else the nearest river's, nothing elsewhere. Kept as
  // the few nodes that have one; fillLevel() lays them on a whole grid for the GPU (again after a lost context), which is then let go.
  // A node whose ground lies further under the surface than any channel or pool is dug (a fall's rock face beside a river's end, a drop beside its bank) is
  // no part of the water: it gets none, or the ground's shader would draw a river bed all the way down the face.
  const lv = new Map();
  for (const [k, q] of near) { const Wl = lerpAt(rivers[q[0]].W, q[1], q[2]); if (Wl > .05 && Hz[k] > Wl - 2.2) lv.set(k, Wl); }
  for (const [k, pq] of nearPool) { const Wl = pools[pq[0]].W; if ((pq[1] < 1.25 || !lv.has(k)) && Hz[k] > Wl - 2.2) lv.set(k, Wl); }
  const LK = Int32Array.from(lv.keys()), LW = Float32Array.from(lv.values());
  const fillLevel = () => { const g = new Float32Array(n * n).fill(NO_WATER); for (let j = 0; j < LK.length; j++) g[LK[j]] = LW[j]; return g; };

  // where he is in which water: river samples hashed in 4 m cells
  const HS = 4, hash = new Map();
  rivers.forEach((rv, ri) => { for (let i = 0; i <= rv.N; i++) { const key = Math.floor(rv.X[i] / HS) * 65536 + Math.floor(rv.Y[i] / HS); let b = hash.get(key); if (!b) hash.set(key, b = []); b.push(ri, i); } });
  const hit = { W: 0, d: 0, hw: 0, vx: 0, vy: 0, v: 0, river: null, pool: null, s: 0 };
  // waterAt(x, y): the surface over that point and the way it runs there, or null. A pool's water spreads out from where the fall lands; a river's runs
  // down its course. Its reach: the half width plus a hand's breadth, where the bank meets it.
  function waterAt(x, y) {
    for (const pl of pools) {
      const e = ovalOf(pl, x, y); if (e > 1.02) continue;
      const dx = x - pl.ft.x, dy = y - pl.ft.y, l = Math.hypot(dx, dy) || 1;
      hit.W = pl.W; hit.d = 0; hit.hw = pl.rb; hit.vx = dx / l; hit.vy = dy / l; hit.v = 1.4 * (1 - smooth(0, pl.ra * 1.6, l)) + .3; hit.river = null; hit.pool = pl; hit.s = 0;
      return hit;
    }
    const cx = Math.floor(x / HS), cy = Math.floor(y / HS); let best = -1, bi = 0, bd = 1e9;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const L = hash.get((cx + a) * 65536 + (cy + b)); if (!L) continue;
      for (let j = 0; j < L.length; j += 2) { const rv = rivers[L[j]], i = L[j + 1], dx = x - rv.X[i], dy = y - rv.Y[i], e = dx * dx + dy * dy; if (e < bd) { bd = e; best = L[j]; bi = i; } }
    }
    if (best < 0) return null;
    const rv = rivers[best], d = (x - rv.X[bi]) * -rv.TY[bi] + (y - rv.Y[bi]) * rv.TX[bi];
    if (Math.abs(d) > rv.HW[bi] + .6 || bd > (rv.HW[bi] + 2) ** 2 || rv.W[bi] <= .05) return null;
    hit.W = rv.W[bi]; hit.d = d; hit.hw = rv.HW[bi]; hit.vx = rv.TX[bi]; hit.vy = rv.TY[bi]; hit.v = rv.V[bi]; hit.river = rv; hit.pool = null; hit.s = bi * rv.ds;
    return hit;
  }

  // the props the carve moved: a piece standing on changed ground follows it; a plant left under the water is taken out (data.instances, before anything is built)
  const PLANTS = /^(grass_patch|grass_tuft|wildflowers|fern|bush|palm_a|palm_b|tree_oak_a|tree_oak_b|snow_pine)$/;
  let moved = 0, dropped = 0;
  for (const kind of Object.keys(data.instances || {})) {
    const L = data.instances[kind], keep = [];
    let changed = false;
    for (let i = 0; i + 5 < L.length; i += 6) {
      const x = L[i], y = L[i + 1], fx = Math.round((x - ox) / cell), fy = Math.round((y - oy) / cell);
      if (fx < 0 || fy < 0 || fx >= n || fy >= n || !nodes.has(fy * n + fx)) { keep.push(L[i], L[i + 1], L[i + 2], L[i + 3], L[i + 4], L[i + 5]); continue; }
      const now = at(x, y), dz = moveAt(x, y), was = now - dz;
      if (PLANTS.test(kind)) { const w = waterAt(x, y); if (w && now < w.W + .08) { dropped++; changed = true; continue; } }
      let z = L[i + 2]; if (Math.abs(dz) > .02 && Math.abs(z - was) < 1.5) { z += dz; moved++; changed = true; }
      keep.push(x, y, z, L[i + 3], L[i + 4], L[i + 5]);
    }
    if (changed) data.instances[kind] = keep;
  }
  return { rivers, pools, fillLevel, levelNodes: LK.length, waterAt, stats: { nodes: nodes.size, dug, built, maxDig: +maxDig.toFixed(2), digAt, maxBuild: +maxBuild.toFixed(2), buildAt, moved, dropped } };
}

// What grows and lies along the water: stones at the waterline and in the rapids, ferns and grass on the banks, a bush further back, stones round a pool's
// rim. Instances in world.json's own form ([x, y, z, yaw, scale, tone] each), read off the carved ground; none within 5 m of a fall's foot, where he starts
// his climb, none in the gap a river leaves its pool by, and none where the bank is too steep to hold them.
export function dressRivers(plan, heightAt) {
  const add = { beach_rock: [], rock_a: [], fern: [], grass_tuft: [], bush: [] };
  let s = 90211; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const slope = (x, y) => Math.hypot(heightAt(x + .7, y) - heightAt(x - .7, y), heightAt(x, y + .7) - heightAt(x, y - .7)) / 1.4;
  const clear = (x, y) => plan.pools.every((pl) => Math.hypot(x - pl.ft.x, y - pl.ft.y) > 5);
  const put = (kind, x, y, sink, sc, dryAbove) => {
    if (!clear(x, y)) return;
    const z = heightAt(x, y); if (dryAbove !== null && z < dryAbove + .12) return; if (slope(x, y) > (kind === 'beach_rock' || kind === 'rock_a' ? 1.4 : .9)) return;
    add[kind].push(x, y, z - sink * sc, rnd() * 6.283, sc, rnd());
  };
  for (const rv of plan.rivers) {
    let nextRock = 2 + rnd() * 4, nextFern = rnd() * 2, nextBush = 4 + rnd() * 6, nextBoulder = 0, side = 1;
    for (let i = rv.pool ? rv.iOut + 2 : 0; i <= rv.N; i++) {
      const sAt = i * rv.ds, x = rv.X[i], y = rv.Y[i], nx = -rv.TY[i], ny = rv.TX[i], hw = rv.HW[i], Wl = rv.W[i];
      if (Wl <= .05) continue;                                     // the river's mouth is the sea's
      if (sAt >= nextRock) {
        nextRock = sAt + 4 + rnd() * 6; side = -side;
        const d = hw + .15 + rnd() * .8, big = rnd() < .3;
        put(big ? 'rock_a' : 'beach_rock', x + nx * side * d, y + ny * side * d, big ? .12 : .18, big ? .10 + rnd() * .07 : .2 + rnd() * .2, null);
      }
      if (sAt >= nextFern) {
        nextFern = sAt + 1.6 + rnd() * 1.8;
        for (const sd of [-1, 1]) { if (rnd() < .3) continue; const d = hw + .9 + rnd() * 2.4; put(rnd() < .55 ? 'fern' : 'grass_tuft', x + nx * sd * d, y + ny * sd * d, 0, .7 + rnd() * .55, Wl); }
      }
      if (sAt >= nextBush) { nextBush = sAt + 7 + rnd() * 8; const sd = rnd() < .5 ? -1 : 1, d = hw + 3 + rnd() * 3; put('bush', x + nx * sd * d, y + ny * sd * d, 0, .75 + rnd() * .5, Wl); }
      if (rv.TURB[i] > .45 && sAt >= nextBoulder) {               // stones the rapids break over
        nextBoulder = sAt + 3 + rnd() * 4; const d = (rnd() * 2 - 1) * hw * .55;
        put('beach_rock', x + nx * d, y + ny * d, .3, .16 + rnd() * .1, null);
      }
    }
  }
  for (const pl of plan.pools) {
    // the gap its river leaves by: the direction from the pool's middle to where the river crosses the rim
    const rv = plan.rivers.find((r) => r.pool === pl), gx = rv ? rv.X[rv.iOut] - pl.cx : 0, gy = rv ? rv.Y[rv.iOut] - pl.cy : 0, gl = Math.hypot(gx, gy) || 1;
    for (let a = 0; a < 6.283; a += .42 + rnd() * .3) {
      const ca = Math.cos(a), sa = Math.sin(a), e = 1.04 + rnd() * .14, x = pl.cx + (ca * pl.ra * e) * pl.ux - (sa * pl.rb * e) * pl.uy, y = pl.cy + (ca * pl.ra * e) * pl.uy + (sa * pl.rb * e) * pl.ux;
      if (rv && ((x - pl.cx) * gx + (y - pl.cy) * gy) / (gl * Math.hypot(x - pl.cx, y - pl.cy)) > .8) continue;
      if (heightAt(x, y) > pl.W + 2.5) continue;                 // the rock face: nothing to set a stone on
      put(rnd() < .35 ? 'rock_a' : 'beach_rock', x, y, .16, rnd() < .35 ? .1 + rnd() * .08 : .22 + rnd() * .22, null);
      if (rnd() < .6) { const e2 = e + .22 + rnd() * .3, x2 = pl.cx + (ca * pl.ra * e2) * pl.ux - (sa * pl.rb * e2) * pl.uy, y2 = pl.cy + (ca * pl.ra * e2) * pl.uy + (sa * pl.rb * e2) * pl.ux; put('fern', x2, y2, 0, .8 + rnd() * .5, pl.W); }
    }
  }
  return add;
}

// The water itself: one ribbon a river, level across (its edges reach in under the banks, so the ground draws the shoreline), a section every metre; and
// an oval disc a pool, its rings reaching out past the rim the same way. Where a river leaves its pool the two cross-fade over POOL_EDGE, at one level.
// aF: the water's time to get here (s), metres across from the middle, the half width, how broken it is (rapids). aG: its level, the churn under a fall,
// how much of it is drawn, metres along. heightAt: the carved ground, so an edge that would hang over a drop is drawn in to the bank.
export function riverGeometry(plan, heightAt) {
  const P = [], A = [], B = [], I = [];
  const poolFade = (x, y) => { let f = 1; for (const pl of plan.pools) f = Math.min(f, smooth(POOL_EDGE[0], POOL_EDGE[1], ovalOf(pl, x, y))); return f; };
  for (const rv of plan.rivers) {
    let open = false, base = 0;
    for (let i = 0; i <= rv.N; i++) {
      const Wl = rv.W[i], fade = smooth(.06, .4, Wl);
      if (fade <= 0) { open = false; continue; }
      const x = rv.X[i], y = rv.Y[i], nx = -rv.TY[i], ny = rv.TX[i], hw = rv.HW[i];
      const offs = [-(hw + 2.2), -(hw + .7), -hw * .75, -hw * .4, 0, hw * .4, hw * .75, hw + .7, hw + 2.2], v0 = P.length / 3;
      for (let j = 0; j < offs.length; j++) {
        let d = offs[j];
        if (Math.abs(d) > hw) for (let g = 0; g < 6 && heightAt(x + nx * d, y + ny * d) < Wl - .02; g++) d = Math.sign(d) * Math.max(hw * .8, Math.abs(d) - .4);     // over a drop: in to the bank
        const vx = x + nx * d, vy = y + ny * d;
        P.push(vx, Wl, -vy); A.push(rv.TAU[i], d, hw, rv.TURB[i]); B.push(Wl, rv.CH[i], fade * poolFade(vx, vy), i * rv.ds);
      }
      if (open) for (let k = 0; k < 8; k++) { const a = base + k, b = v0 + k; I.push(a, b, a + 1, a + 1, b, b + 1); }
      open = true; base = v0;
    }
  }
  for (const pl of plan.pools) {
    // rings out from the middle to past the rim; the churn is strongest along the line the sheet lands on and spreads out from it
    const RINGS = [0, .18, .36, .54, .7, .84, .94, 1.0, 1.08, 1.16, 1.3], SEG = 44, v0 = P.length / 3, sx = -pl.uy, sy = pl.ux;
    for (const e of RINGS) for (let k = 0; k < SEG; k++) {
      const a = k / SEG * 6.2831853, la = Math.cos(a) * pl.ra * e, lb = Math.sin(a) * pl.rb * e, x = pl.cx + la * pl.ux + lb * sx, y = pl.cy + la * pl.uy + lb * sy;
      const fx = x - pl.ft.x, fy = y - pl.ft.y, across = fx * sx + fy * sy, along = fx * pl.ux + fy * pl.uy, off = Math.max(0, Math.abs(across) - pl.sheetHalf * .85), dist = Math.hypot(off, along);
      P.push(x, pl.W, -y); A.push(dist / 1.7, lb, pl.rb, 0); B.push(pl.W, 1 - smooth(.3, pl.ra * 1.25, dist), 1 - smooth(POOL_EDGE[0], POOL_EDGE[1], e), dist);
      if (e === 0) break;                                         // the middle is one point
    }
    // the middle point to the first ring, then ring to ring
    for (let k = 0; k < SEG; k++) I.push(v0, v0 + 1 + k, v0 + 1 + (k + 1) % SEG);
    for (let r = 1; r < RINGS.length - 1; r++) for (let k = 0; k < SEG; k++) {
      const a = v0 + 1 + (r - 1) * SEG + k, b = v0 + 1 + (r - 1) * SEG + (k + 1) % SEG, a2 = a + SEG, b2 = b + SEG;
      I.push(a, a2, b, b, a2, b2);
    }
  }
  return { P, A, B, I };
}
