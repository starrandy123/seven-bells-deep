// What fire, water and ice leave on the ground, and fire that moves. Randy, 2 Nov: "be able to burn the environment" · "The water guys can extinguish and freeze" · "environment burns".
// A map the size of the wet map's, on the CPU so the rules can read it, a cell every 1.5 m: scorch, flame, frost and ember. Fire on it is a cell model ticked at 5 Hz: a burning cell tries to light its neighbours, with the published spread formula, calibrated on a real island fire, so a meadow burns as a thin line running with the wind and leaves black ground with red points in it. Pipeline/research/WORLD_RESPONSE_SOURCES.md
import * as THREE from 'three';

const N = 64, CELL = 1.5, SIZE = N * CELL, MOVE = 4, TICK = 0.2, TG = 300, CROWN_S = 12;
const BARE = 0, FUEL = 1, BURN = 2, DONE = 3;
const BURN_S = 0.8, SCORCH_HOLD = 20, SCORCH_BACK = 60, EMBER_S = 10, FROST_HOLD = 10, FROST_BACK = 6, WET_S = 15, FREE_M = 28, MOST = 60;
const WIND = 8, WX = 0.83, WZ = 0.55, UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);

export function createScorch(G) {
  const W = G.world, U = G.look.uniforms, px = new Uint8Array(N * N * 4), tex = new THREE.DataTexture(px, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
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

  // one spot of anything: where it lands, how wide, what it is, how hard. Every power that reaches the ground comes through here
  function hit(p, r, el, power = 1) {
    const g = W.heightAt(p.x, -p.z), h = G.hero; if (g < 0.2 || p.y - g > r + 2.5 || Math.hypot(p.x - h.pos.x, p.z - h.pos.z) > SIZE * 0.42) return;
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
    active = any; dirty = true;
  }
  return {
    hit,
    update(dt, x, z) {
      if (!live) return; if (active) follow(x, z); acc += dt;
      if (acc >= TICK) { acc = 0; if (active) tick(); if (dirty) { tex.needsUpdate = true; dirty = false; } }
    },
    restore() { tex.needsUpdate = true; },
    get burning() { return burning; }, get live() { return live; },
    cell(x, z) { if (!live) return null; const c = Math.round((x - ox) / CELL + N / 2 - 0.5), r = Math.round((oz - z) / CELL + N / 2 - 0.5); if (c < 0 || r < 0 || c >= N || r >= N) return null; const i = r * N + c, o = i * 4; return { st: st[i], scorch: px[o], flame: px[o + 1], frost: px[o + 2], ember: px[o + 3], wet: wet[i] }; },
    get count() { let f = 0, b = 0, d = 0; for (let i = 0; i < N * N; i++) { if (st[i] === FUEL) f++; else if (st[i] === BURN) b++; else if (st[i] === DONE) d++; } return { fuel: f, burning: b, burnt: d }; },
  };
}
const SMOKE = new THREE.Color(0.2, 0.15, 0.11);
