// The city plan, offline: the real world.json and heightmap, the game's own height sampling, city.js as shipped.
import fs from 'fs'; import zlib from 'zlib';
import { planCities, K } from './city.js';
const W = '/home/user/seven-bells-deep/web/assets/';
const data = JSON.parse(fs.readFileSync(W + 'world.json', 'utf8'));
const n = data.grid, nn = n * n, u = zlib.inflateSync(fs.readFileSync(W + data.files.height)), H = new Uint16Array(nn), d = new Int32Array(n);
for (let j = 0, p = 0; j < n; j++) { let v = 0; for (let i = 0; i < n; i++, p++) { d[i] = (d[i] + (u[p] | u[p + nn] << 8)) & 0xffff; v = (v + d[i]) & 0xffff; H[p] = v * 2; } }
const size = data.size_m, cell = size / (n - 1), ox = data.origin[0], oy = data.origin[1], top = data.top_m || 0, HK = (top + data.depth_scale_m) / 65535;
const crv = (a, b, c, e, t) => b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - e + t * (3 * (b - c) + e - a)));
function heightAt(x, y) { let fx = (x - ox) / cell, fy = (y - oy) / cell; fx = Math.max(0, Math.min(n - 1.001, fx)); fy = Math.max(0, Math.min(n - 1.001, fy)); const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * n + ix;
  if (ix < 1 || iy < 1 || ix > n - 3 || iy > n - 3) return top - HK * (H[o] * (1 - ax) * (1 - ay) + H[o + 1] * ax * (1 - ay) + H[o + n] * (1 - ax) * ay + H[o + n + 1] * ax * ay);
  const r0 = crv(H[o - n - 1], H[o - n], H[o - n + 1], H[o - n + 2], ax), r1 = crv(H[o - 1], H[o], H[o + 1], H[o + 2], ax), r2 = crv(H[o + n - 1], H[o + n], H[o + n + 1], H[o + n + 2], ax), r3 = crv(H[o + 2 * n - 1], H[o + 2 * n], H[o + 2 * n + 1], H[o + 2 * n + 2], ax);
  return top - HK * crv(r0, r1, r2, r3, ay); }
for (const phone of [false, true]) {
  const t0 = Date.now(), plan = planCities(data, heightAt, { phone });
  console.log(phone ? 'PHONE' : 'DESKTOP', 'planned in', Date.now() - t0, 'ms; buildings', plan.total, 'colliders', plan.colliders.length, 'triangles', plan.tris);
  if (!phone) console.log(JSON.stringify(plan.count));
}
// sanity: every sea building's top under the water, every land building on dry land; nothing standing on an existing kit piece
const plan = planCities(data, heightAt, {});
let worstTop = -1e9, worstLand = 1e9, cyl = 0, box = 0;
for (const c of plan.colliders) { if (c.t === 'cyl') cyl++; else box++; const sea = c.city !== 'sunward_harbour'; if (sea) worstTop = Math.max(worstTop, c.z1); else worstLand = Math.min(worstLand, c.z1); }
console.log('highest sea solid top', worstTop.toFixed(2), '(must stay under -3)', '| lowest land solid top', worstLand.toFixed(2), '| boxes', box, 'cylinders', cyl);
// heights of the buildings' solids above their own foot, per city, and any NaN
let nan = 0; for (const c of plan.colliders) for (const k of ['x', 'y', 'z0', 'z1']) if (!Number.isFinite(c[k])) nan++;
console.log('non-finite collider numbers:', nan);
