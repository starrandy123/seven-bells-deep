// What fire, water and ice leave on the ground, and fire that moves. Randy, 2 Nov: "be able to burn the environment" · "The water guys can extinguish and freeze" · "environment burns".
// A map the size of the wet map's, on the CPU so the rules can read it, a cell every 1.5 m: scorch, flame, frost and ember. Fire on it is a cell model ticked at 5 Hz: a burning cell tries to light its neighbours, with the published spread formula, calibrated on a real island fire, so a meadow burns as a thin line running with the wind and leaves black ground with red points in it. Pipeline/research/WORLD_RESPONSE_SOURCES.md
import * as THREE from 'three';

const N = 64, CELL = 1.5, SIZE = N * CELL, MOVE = 4, TICK = 0.2, TG = 300, CROWN_S = 12;
const BARE = 0, FUEL = 1, BURN = 2, DONE = 3;
const BURN_S = 0.8, SCORCH_HOLD = 20, SCORCH_BACK = 60, EMBER_S = 10, FROST_HOLD = 10, FROST_BACK = 6, WET_S = 15, FREE_M = 28, MOST = 60;
const WIND = 8, WX = 0.83, WZ = 0.55, UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);

export function createScorch(G) {
  // the top half of the texture is firelight.js's grid: one more sampler would be one too many for the ground
  const W = G.world, U = G.look.uniforms, px = new Uint8Array(N * N * 8), tex = new THREE.DataTexture(px, N, N * 2, THREE.RGBAFormat, THREE.UnsignedByteType), grid = px.subarray(N * N * 4);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.generateMipmaps = false; tex.needsUpdate = true; U.tOcBurn.value = tex;
  const st = new Uint8Array(N * N), veg = new Float32Array(N * N), hgt = new Float32Array(N * N), left = new Float32Array(N * N), wet = new Float32Array(N * N), hold = new Float32Array(N * N), ice = new Float32Array(N * N), dist = new Float32Array(N * N);
  const crown = new Float32Array(N * N), tall = new Float32Array(N * N); let trees = null;
  const w4 = [0, 0, 0, 0], v1 = new THREE.Vector3(), lit = new THREE.Vector3(); let ox = 0, oz = 0, live = false, active = 0, acc = 0, burning = 0, dirty = false, wide = false;
  const toX = (c) => ox + (c - N / 2 + 0.5) * CELL, toZ = (r) => oz - (r - N / 2 + 0.5) * CELL;      // rows run with the world's y, as the ground's shader reads the texture, as wetmap.js does

  // where trees stand, on a 12 m grid over the map, once, the first time anything burns: a tree above a burning cell catches, and its crown burns on after the ground is out
  function plant() {
    trees = new Uint8Array(TG * TG); const all = W.data.instances;
    for (const k in all) { if (!/^tree_|^palm/.test(k)) continue; const a = all[k]; for (let i = 0; i + 4 < a.length; i += 6) { const u = Math.floor((a[i] + 1800) / 12), v = Math.floor((a[i + 1] + 1800) / 12); if (u >= 0 && v >= 0 && u < TG && v < TG) trees[v * TG + u] = 1; } }
  }
  // how many of the 3 x 3 tree cells round a point hold trees: the falling leaves' weight
  function treesNear(x, z) { if (!trees) plant(); let n = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (treeAt(x + a * 12, z + b * 12)) n++; return n; }
  const treeAt = (x, z) => { const u = Math.floor((x + 1800) / 12), v = Math.floor((-z + 1800) / 12); return u >= 0 && v >= 0 && u < TG && v < TG && trees[v * TG + u]; };
  // what a cell of ground holds: grass where the biome's grass is, none under water or on bare rock
  function load(i, c, r) {
    const x = toX(c), z = toZ(r), h = W.heightAt(x, -z); hgt[i] = h; st[i] = BARE; veg[i] = 0; crown[i] = 0; tall[i] = 0; if (h < 0.6) { veg[i] = -1; return; }
    W.biomeWeights(x, -z, w4); const g = w4[1]; if (g > 0.35) { st[i] = FUEL; veg[i] = g > 0.75 ? -0.3 : -0.45; if (treeAt(x, z)) { tall[i] = 1; veg[i] += 0.4; } }
  }
  function start(x, z) { if (!trees) plant(); ox = Math.round(x / (MOVE * CELL)) * MOVE * CELL; oz = Math.round(z / (MOVE * CELL)) * MOVE * CELL; for (let r = 0, i = 0; r < N; r++) for (let c = 0; c < N; c++, i++) load(i, c, r); live = true; U.ocBurnM.value.set(ox, oz, 1 / SIZE, 1); }
  // the map follows him by whole steps, so nothing blurs
  function follow(x, z) {
    const dc = Math.abs(x - ox) > SIZE * 0.25 ? Math.round((x - ox) / (MOVE * CELL)) * MOVE : 0, dr = Math.abs(z - oz) > SIZE * 0.25 ? Math.round((oz - z) / (MOVE * CELL)) * MOVE : 0; if (!dc && !dr) return;
    ox += dc * CELL; oz -= dr * CELL;
    const sc = dc >= 0 ? 1 : -1, sr = dr >= 0 ? 1 : -1;
    for (let r = sr > 0 ? 0 : N - 1; r >= 0 && r < N; r += sr) for (let c = sc > 0 ? 0 : N - 1; c >= 0 && c < N; c += sc) {
      const i = r * N + c, a = c + dc, b = r + dr;
      if (a >= 0 && a < N && b >= 0 && b < N) { const j = b * N + a; st[i] = st[j]; veg[i] = veg[j]; hgt[i] = hgt[j]; crown[i] = crown[j]; tall[i] = tall[j]; left[i] = left[j]; wet[i] = wet[j]; hold[i] = hold[j]; ice[i] = ice[j]; dist[i] = dist[j]; px[i * 4] = px[j * 4]; px[i * 4 + 1] = px[j * 4 + 1]; px[i * 4 + 2] = px[j * 4 + 2]; px[i * 4 + 3] = px[j * 4 + 3]; }
      else { left[i] = wet[i] = hold[i] = ice[i] = dist[i] = 0; px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = px[i * 4 + 3] = 0; load(i, c, r); }
    }
    U.ocBurnM.value.set(ox, oz, 1 / SIZE, 1); dirty = true;
  }
  function ignite(i, from) { st[i] = BURN; left[i] = BURN_S; dist[i] = from; px[i * 4 + 1] = 255; burning++; }

  // ---------------------------------------------------------------- buildings: a tile of their own for each one that's hit, 32 at a time, the oldest given back first (Frostbite 2's destruction masks, flattened; Pipeline/research/WORLD_RESPONSE_SOURCES.md)
  // Fire chars and heats it; water washes the soot off, and on hot stone it cracks it (miners broke rock that way); ice crusts it; a heavy blow breaks it, the face off, then the room behind. Nothing falls: it all comes back
  const TT = U.tOcDmg.value, TD = TT.image.data, TS = 32, NS = 32, slotOf = new Map(), slots = Array.from({ length: NS }, () => ({ key: null, m: null, i: -1, hold: 0, at: 0, dirty: false })); let bgrid = null, tNow = 0;
  function buildGrid() {
    bgrid = new Map(); const M = new THREE.Matrix4(), B = new THREE.Box3();
    // Saltlight's buildings from its plan, not from their boxes' matrices: a box is hidden while its building stands as itself (saltlight_build.js), and the hit must still find it
    const MM = W.metro && W.metro.meshes && W.metro.meshes[0]; if (MM) W.metro.plan.boxes.forEach((b, i) => { if (b.kind !== 0) return; const cx = b.x, cz = -b.y, e = [MM, i, cx, cz, b.z0, b.z0 + b.h, Math.max(b.sx, b.sy) / 2], k = Math.floor(cx / 16) + ':' + Math.floor(cz / 16); if (!bgrid.has(k)) bgrid.set(k, []); bgrid.get(k).push(e); });
    for (const m of W.cityMeshes || []) { const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); B.copy(g.boundingBox).applyMatrix4(M); if (B.max.y < 0.5 || B.max.y - B.min.y < 2.5) continue; const cx = (B.min.x + B.max.x) / 2, cz = (B.min.z + B.max.z) / 2, e = [m, i, cx, cz, Math.max(B.min.y, 0), B.max.y, Math.max(B.max.x - B.min.x, B.max.z - B.min.z) / 2], k = Math.floor(cx / 16) + ':' + Math.floor(cz / 16); if (!bgrid.has(k)) bgrid.set(k, []); bgrid.get(k).push(e); } }
  }
  const setSlot = (m, i, v) => { const a = m.geometry.attributes.aDmg; if (!a) return; a.array[i * 4] = v; a.needsUpdate = true; };
  function slotFor(e) {
    const key = e[0].id + ':' + e[1]; let s = slotOf.get(key); if (s !== undefined) return s;
    let best = 0, bt = Infinity; for (let k = 0; k < NS; k++) { const q = slots[k]; if (!q.key) { best = k; bt = -1; break; } if (q.at < bt) { bt = q.at; best = k; } }
    const q = slots[best]; if (q.key) { slotOf.delete(q.key); setSlot(q.m, q.i, 0); }
    q.key = key; q.m = e[0]; q.i = e[1]; TD.fill(0, best * TS * TS * 4, (best + 1) * TS * TS * 4); slotOf.set(key, best); U.ocDmgC.value[best].set(e[2], e[4], e[3], 1 / Math.max(e[5] - e[4], 1)); setSlot(e[0], e[1], best + 1); return best;
  }
  function stampB(e, p, r, el, power) {
    const s = slotFor(e), q = slots[s], cx = e[2], cz = e[3], foot = e[4], H = Math.max(e[5] - foot, 1), dx = p.x - cx, dz = p.z - cz, ax = Math.abs(dx), az = Math.abs(dz), qq = dx / (ax + az + 1e-3), u = ((dz >= 0 ? 1 - qq : 3 + qq) * 0.25) * TS, v = ((p.y - foot) / H * 0.85 + Math.max(9 - Math.max(ax, az), 0) * 0.0167) * TS;
    const per = 4 * Math.max(ax + az, 2), ru = Math.max(1.6, (r / per) * TS * 2), rv = Math.max(1.6, (r / H) * 0.85 * TS), base = s * TS * TS * 4;
    for (let y = Math.max(0, Math.floor(v - rv)); y <= Math.min(TS - 1, Math.ceil(v + rv * 3)); y++) for (let k = Math.floor(u - ru * 2); k <= Math.ceil(u + ru * 2); k++) {
      // soot rises in a V: wider above, three times as tall as it is low
      const up = y > v, ry = up ? rv * 3 : rv, rx = ru * (up ? 1 + (y - v) / (rv * 3) : 1), d = ((k - u) / rx) ** 2 + ((y - v) / ry) ** 2; if (d >= 1) continue; const w = (1 - d) * power, o = base + (y * TS + ((k % TS) + TS) % TS) * 4;
      if (el === 'fire') { TD[o] = Math.max(TD[o], Math.min(255, w * 260)); if (!up || d < 0.4) TD[o + 1] = Math.max(TD[o + 1], Math.min(255, w * 255)); if (TD[o + 2] > 0) TD[o + 2] = Math.max(0, TD[o + 2] - w * 200); }
      else if (el === 'water') { if (TD[o + 1] > 150 && w > 0.3) TD[o + 3] = Math.min(255, TD[o + 3] + 60); TD[o] = TD[o] * (1 - 0.5 * w); TD[o + 1] = 0; }
      else { TD[o + 2] = Math.max(TD[o + 2], Math.min(255, w * 270)); TD[o + 1] = 0; }
      // a blow breaks it in stages, the way the study counts hit points: plaster off, then a breach, then the room; frozen or hot stone goes faster
      if (power >= 0.9 && !up && d < 0.5) TD[o + 3] = Math.min(255, TD[o + 3] + (TD[o + 2] > 120 ? 70 : TD[o + 1] > 150 ? 55 : 26));
    }
    q.hold = 30; q.dirty = true; q.at = tNow; active = 1;
  }
  function buildingHit(p, r, el, power) {
    if (!W.cityMeshes && !W.metro) return; if (!bgrid) buildGrid(); const kx = Math.floor(p.x / 16), kz = Math.floor(p.z / 16);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = bgrid.get(kx + a + ':' + (kz + b)); if (!L) continue; for (const e of L) { const d = Math.hypot(p.x - e[2], p.z - e[3]); if (d > e[6] + r + 0.8 || p.y < e[4] - 2 || p.y > e[5] + r + 1) continue; stampB(e, p, r, el, power); } }
  }
  // they come back: held 30 s, then receding, each channel at its own pace, frost fastest
  function mendB(dt) {
    let any = 0;
    for (let s = 0; s < NS; s++) {
      const q = slots[s]; if (!q.key) continue; any = 1; if (q.hold > 0) { q.hold -= dt; continue; }
      const base = s * TS * TS * 4, dC = (dt / 60) * 255, dH = (dt / 15) * 255, dF = (dt / 10) * 255, dB = (dt / 60) * 255; let left = 0;
      for (let o = base; o < base + TS * TS * 4; o += 4) { TD[o] = Math.max(0, TD[o] - dC); TD[o + 1] = Math.max(0, TD[o + 1] - dH); TD[o + 2] = Math.max(0, TD[o + 2] - dF); TD[o + 3] = Math.max(0, TD[o + 3] - dB); left |= TD[o] | TD[o + 1] | TD[o + 2] | TD[o + 3]; }
      q.dirty = true; if (!left) { setSlot(q.m, q.i, 0); slotOf.delete(q.key); q.key = null; }
    }
    // the whole array, when anything changed: a layer at a time left the layers past the first unseen in this build of three, and it's 131 KB at most five times a second
    let up = false; for (let s = 0; s < NS; s++) if (slots[s].dirty) { slots[s].dirty = false; up = true; } if (up) TT.needsUpdate = true;
    return any;
  }

  // one spot of anything: where it lands, how wide, what it is, how hard. Every power that reaches the ground comes through here
  function hit(p, r, el, power = 1) {
    const g = W.heightAt(p.x, -p.z), h = G.hero; if (Math.hypot(p.x - h.pos.x, p.z - h.pos.z) > SIZE * 0.42) return;
    buildingHit(p, r, el, power);
    if (g < 0.2 || p.y - g > r + 2.5) return;
    if (!live) start(h.pos.x, h.pos.z); else follow(h.pos.x, h.pos.z);
    const cc = Math.round((p.x - ox) / CELL + N / 2 - 0.5), cr = Math.round((oz - p.z) / CELL + N / 2 - 0.5), R = Math.ceil(r / CELL) + 1;
    if (el === 'fire') lit.copy(p);
    for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) {
      const c = cc + a, q = cr + b; if (c < 0 || q < 0 || c >= N || q >= N) continue; const i = q * N + c, d = Math.hypot(a, b) * CELL; if (d > r || hgt[i] < 0.2) continue; const k = (1 - (d / r) * (d / r)) * power, o = i * 4;
      if (el === 'fire') { if (wet[i] > 0) { wet[i] = Math.max(0, wet[i] - 4); continue; } px[o] = Math.max(px[o], clamp(k * 330, 0, 255)); px[o + 3] = Math.max(px[o + 3], clamp(k * 300, 0, 255)); hold[i] = Math.max(hold[i], SCORCH_HOLD); if (ice[i] > 0) { ice[i] = 0; px[o + 2] = 0; wet[i] = 6; } else if (st[i] === FUEL) { ignite(i, 0); left[i] = BURN_S * 2; } }
      else if (el === 'water') { wet[i] = WET_S; px[o + 3] = 0; px[o] = px[o] >> 1; if (st[i] === BURN) { st[i] = DONE; px[o + 1] = 0; burning--; } }
      else { ice[i] = FROST_HOLD; px[o + 2] = Math.max(px[o + 2], clamp(k * 330, 0, 255)); px[o + 3] = 0; if (st[i] === BURN) { st[i] = DONE; px[o + 1] = 0; burning--; } }
    }
    if (el === 'water' && W.wet) W.wet.stamp(p.x - 0.3, p.z, p.x + 0.3, p.z, r, 0.5, 1);
    active = 1; dirty = true;
  }

  // the spread: p = .58 (1 + veg)(1 + den) e^(.045 V) e^(.131 V (cos θ - 1)) e^(.078 slope°), per neighbour, per the 1 s the published cell takes. Past where it was lit it gives out
  function spread(i, c, r) {
    const hi = hgt[i], from = dist[i];
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      if (!a && !b) continue; const q = r + b, e = c + a; if (q < 0 || e < 0 || q >= N || e >= N) continue; const j = q * N + e; if (st[j] !== FUEL || wet[j] > 0) continue;
      const l = Math.hypot(a, b), run = from + l * CELL, cos = (a * WX - b * WZ) / l, slope = (Math.atan2(hgt[j] - hi, l * CELL) * 180) / Math.PI;
      let p = 0.58 * (1 + veg[j]) * Math.exp(0.045 * WIND) * Math.exp(0.131 * WIND * (cos - 1)) * Math.exp(0.078 * slope); if (run > FREE_M) p *= 0.2; if (G.rain > 0.3) p *= 0.25; p = 1 - Math.pow(1 - Math.min(p, 0.999), TICK / l);
      if (Math.random() < p && burning < MOST) ignite(j, run);
    }
  }
  const fires = [{ x: 0, y: 0, z: 0, n: 0 }, { x: 0, y: 0, z: 0, n: 0 }, { x: 0, y: 0, z: 0, n: 0 }, { x: 0, y: 0, z: 0, n: 0 }], blockN = new Float32Array(36), blockX = new Float32Array(36), blockZ = new Float32Array(36), blockY = new Float32Array(36);
  function groupFires() {
    blockN.fill(0); blockX.fill(0); blockZ.fill(0); blockY.fill(0);
    for (let r = 0, i = 0; r < N; r++) for (let c = 0; c < N; c++, i++) { if (st[i] !== BURN && crown[i] <= 0) continue; const b = ((r / 11) | 0) * 6 + ((c / 11) | 0), up = crown[i] > 0 ? 6 : 1; blockN[b]++; blockX[b] += toX(c); blockZ[b] += toZ(r); blockY[b] += hgt[i] + up; }
    for (const f of fires) { let best = -1, most = 0; for (let b = 0; b < 36; b++) if (blockN[b] > most) { most = blockN[b]; best = b; } f.n = most; if (best >= 0) { f.x = blockX[best] / most; f.y = blockY[best] / most; f.z = blockZ[best] / most; blockN[best] = 0; } }
  }
  function tick() {
    let any = 0, tongues = 0; const flames = G.flames;
    for (let r = 0, i = 0; r < N; r++) for (let c = 0; c < N; c++, i++) {
      const o = i * 4;
      if (wet[i] > 0) wet[i] -= TICK;
      if (st[i] === BURN) {
        any = 1; left[i] -= TICK; spread(i, c, r);
        if (flames && tongues < 40 && (i + (G.stats ? G.stats.frames : 0)) % 2 === 0) { tongues++; v1.set(toX(c) + rnd(-0.6, 0.6), hgt[i] + 0.05, toZ(r) + rnd(-0.6, 0.6)); flames.tongue(v1, UP, rnd(0.8, 1.2), rnd(0.9, 1.7), 0.32, WX * 2, 0.6, WZ * 2); if (i % 6 === 0) { v1.y += 1.6; G.fx.sp('smoke', v1, 1, rnd(1.4, 2.2), SMOKE, { s0: 0.7, s1: 2.8, a: 0.2, add: 0, hot: 0, vx: WX * 1.6, vy: 1.6, vz: WZ * 1.6, drag: 0.5 }); } }
        if (left[i] <= 0) { st[i] = DONE; burning--; px[o + 1] = 0; px[o] = 255; px[o + 3] = 255; hold[i] = SCORCH_HOLD; if (tall[i]) crown[i] = CROWN_S; }
      }
      // the crown goes on burning at its tips after the ground is out, and water puts it out
      if (crown[i] > 0) { any = 1; crown[i] -= TICK; if (wet[i] > 0) crown[i] = 0; else if (flames && tongues < 40 && (i + (G.stats ? G.stats.frames : 0)) % 7 === 0) { tongues++; v1.set(toX(c) + rnd(-2, 2), hgt[i] + rnd(5, 10), toZ(r) + rnd(-2, 2)); flames.tongue(v1, UP, rnd(1.2, 2), rnd(2, 3.4), 0.34, WX * 2.4, 1, WZ * 2.4); if (i % 3 === 0) { v1.y += 3; G.fx.sp('smoke', v1, 1, rnd(2, 3), SMOKE, { s0: 1, s1: 4.2, a: 0.22, add: 0, hot: 0, vx: WX * 2, vy: 2.4, vz: WZ * 2, drag: 0.4 }); } } }
      const emb = px[o + 3]; if (emb) { any = 1; px[o + 3] = Math.max(0, emb - (TICK / EMBER_S) * 255); }
      if (px[o]) { any = 1; if (hold[i] > 0) hold[i] -= TICK; else { px[o] = Math.max(0, px[o] - (TICK / SCORCH_BACK) * 255 * (wet[i] > 0 ? 2 : 1)); if (px[o] === 0 && st[i] === DONE) st[i] = FUEL; } }
      if (px[o + 2]) { any = 1; if (ice[i] > 0) ice[i] -= TICK; else px[o + 2] = Math.max(0, px[o + 2] - (TICK / FROST_BACK) * 255); }
    }
    active = any; dirty = true; groupFires();
  }
  return {
    hit, treesNear,
    update(dt, x, z) {
      if (!live && !slotOf.size) return; if (live && active) follow(x, z); acc += dt;
      tNow += dt; if (acc >= TICK) { acc = 0; if (active) tick(); if (mendB(TICK)) active = 1; if (dirty) { tex.needsUpdate = true; dirty = false; } }
      if (active && G.fireLight) for (const f of fires) if (f.n) G.fireLight.light(f.x, f.y + 1.2, f.z, 1, 0.42, 0.1, 10 + Math.min(10, f.n * 0.4), 16 + f.n, 0.6, f.x);
    },
    restore() { tex.needsUpdate = true; }, grid, touch() { tex.needsUpdate = true; },
    get burning() { return burning; }, get live() { return live; }, get fires() { return fires; },
    cell(x, z) { if (!live) return null; const c = Math.round((x - ox) / CELL + N / 2 - 0.5), r = Math.round((oz - z) / CELL + N / 2 - 0.5); if (c < 0 || r < 0 || c >= N || r >= N) return null; const i = r * N + c, o = i * 4; return { st: st[i], scorch: px[o], flame: px[o + 1], frost: px[o + 2], ember: px[o + 3], wet: wet[i] }; },
    get count() { let f = 0, b = 0, d = 0; for (let i = 0; i < N * N; i++) { if (st[i] === FUEL) f++; else if (st[i] === BURN) b++; else if (st[i] === DONE) d++; } return { fuel: f, burning: b, burnt: d }; },
  };
}
const SMOKE = new THREE.Color(0.2, 0.15, 0.11);
