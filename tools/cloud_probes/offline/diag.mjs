import fs from 'fs'; import zlib from 'zlib';
import { planCities } from './city.js';
const W = '/home/user/seven-bells-deep/web/assets/', data = JSON.parse(fs.readFileSync(W + 'world.json', 'utf8'));
const n = data.grid, nn = n * n, u = zlib.inflateSync(fs.readFileSync(W + data.files.height)), H = new Uint16Array(nn), d = new Int32Array(n);
for (let j = 0, p = 0; j < n; j++) { let v = 0; for (let i = 0; i < n; i++, p++) { d[i] = (d[i] + (u[p] | u[p + nn] << 8)) & 0xffff; v = (v + d[i]) & 0xffff; H[p] = v * 2; } }
const size = data.size_m, cell = size / (n - 1), ox = data.origin[0], oy = data.origin[1], top = data.top_m || 0, HK = (top + data.depth_scale_m) / 65535;
const crv = (a, b, c, e, t) => b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - e + t * (3 * (b - c) + e - a)));
global.heightAt = function (x, y) { let fx = (x - ox) / cell, fy = (y - oy) / cell; fx = Math.max(0, Math.min(n - 1.001, fx)); fy = Math.max(0, Math.min(n - 1.001, fy)); const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * n + ix;
  if (ix < 1 || iy < 1 || ix > n - 3 || iy > n - 3) return top - HK * (H[o] * (1 - ax) * (1 - ay) + H[o + 1] * ax * (1 - ay) + H[o + n] * (1 - ax) * ay + H[o + n + 1] * ax * ay);
  const r0 = crv(H[o - n - 1], H[o - n], H[o - n + 1], H[o - n + 2], ax), r1 = crv(H[o - 1], H[o], H[o + 1], H[o + 2], ax), r2 = crv(H[o + n - 1], H[o + n], H[o + n + 1], H[o + n + 2], ax), r3 = crv(H[o + 2 * n - 1], H[o + 2 * n], H[o + 2 * n + 1], H[o + 2 * n + 2], ax);
  return top - HK * crv(r0, r1, r2, r3, ay); };
const plan = planCities(data, heightAt, {});
const bad = plan.colliders.filter((c) => c.city !== 'sunward_harbour' && c.z1 > -3);
const by = {}; for (const c of bad) { const k = c.city + '/' + c.type; by[k] = (by[k] || 0) + 1; }
console.log('sea solids reaching above -3 m:', JSON.stringify(by)); if (bad[0]) console.log('e.g.', JSON.stringify(bad.slice(0, 3)));
// the land town: its ground over the plan's square, so we see where dry land is
const p = data.poi.find((q) => q.id === 'sunward_harbour'); console.log('sunward_harbour poi', JSON.stringify(p));
let rows = []; for (let v = -80; v <= 80; v += 10) { let r = ''; for (let uu = -80; uu <= 80; uu += 10) { const z = heightAt(p.x + uu, p.y + v); r += z < 0 ? ' ~~' : (z < 10 ? ' ' + z.toFixed(0).padStart(2) : z.toFixed(0).padStart(3)); } rows.push(r); }
console.log('ground around the harbour (10 m grid, ~~ = sea; north up):\n' + rows.reverse().join('\n'));
console.log('why lots stayed empty:', JSON.stringify(plan.why));
console.log('cleared:', JSON.stringify(plan.cleared));
console.log('counts:', JSON.stringify(plan.count), 'buildings', plan.total, 'triangles', plan.tris);
