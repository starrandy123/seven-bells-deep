// The breakers, offline, on the real seabed: where they are, how tall, how they move, where they foam; and that the formula is smooth (no jumps)
import fs from 'fs'; import zlib from 'zlib';
import { findBreaks, breakerAt, BREAK_K, BREAK_W } from './surf.js';
const W = '/home/user/seven-bells-deep/web/assets/', data = JSON.parse(fs.readFileSync(W + 'world.json', 'utf8'));
const n = data.grid, nn = n * n, u = zlib.inflateSync(fs.readFileSync(W + data.files.height)), H = new Uint16Array(nn), d = new Int32Array(n);
for (let j = 0, p = 0; j < n; j++) { let v = 0; for (let i = 0; i < n; i++, p++) { d[i] = (d[i] + (u[p] | u[p + nn] << 8)) & 0xffff; v = (v + d[i]) & 0xffff; H[p] = v * 2; } }
const size = data.size_m, cell = size / (n - 1), ox = data.origin[0], oy = data.origin[1], top = data.top_m || 0, HK = (top + data.depth_scale_m) / 65535;
const crv = (a, b, c, e, t) => b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - e + t * (3 * (b - c) + e - a)));
const heightAt = (x, y) => { let fx = (x - ox) / cell, fy = (y - oy) / cell; fx = Math.max(0, Math.min(n - 1.001, fx)); fy = Math.max(0, Math.min(n - 1.001, fy)); const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * n + ix;
  if (ix < 1 || iy < 1 || ix > n - 3 || iy > n - 3) return top - HK * (H[o] * (1 - ax) * (1 - ay) + H[o + 1] * ax * (1 - ay) + H[o + n] * (1 - ax) * ay + H[o + n + 1] * ax * ay);
  const r0 = crv(H[o - n - 1], H[o - n], H[o - n + 1], H[o - n + 2], ax), r1 = crv(H[o - 1], H[o], H[o + 1], H[o + 2], ax), r2 = crv(H[o + n - 1], H[o + n], H[o + n + 1], H[o + n + 2], ax), r3 = crv(H[o + 2 * n - 1], H[o + 2 * n], H[o + 2 * n + 1], H[o + 2 * n + 2], ax);
  return top - HK * crv(r0, r1, r2, r3, ay); };
const B = findBreaks(data, heightAt);
console.log('breaks:', B.length); for (const b of B) console.log(' ', b.isl, 'waterline', b.x.toFixed(1), b.z.toFixed(1), 'out', b.ox.toFixed(2), b.oz.toFixed(2), 'half width', b.half.toFixed(0));
// along the first break's centre line, out to sea: depth, the tallest the water stands over a 36 s set, foam
const b = B[0], out = {};
console.log('profile of break 0 (metres out: depth, max crest-to-trough over 40 s, max foam, max face):');
for (const o of [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80]) {
  const x = b.x + b.ox * o, z = b.z + b.oz * o, depth = -heightAt(x, -z); let lo = 1e9, hi = -1e9, fo = 0, fa = 0;
  for (let t = 0; t < 40; t += 0.05) { const y = breakerAt(B, x, z, depth, t, out); lo = Math.min(lo, y); hi = Math.max(hi, y); fo = Math.max(fo, out.foam); fa = Math.max(fa, out.face); }
  console.log(`  ${String(o).padStart(2)} m: depth ${depth.toFixed(1).padStart(5)}  height ${(hi - lo).toFixed(2)}  foam ${fo.toFixed(2)}  face ${fa.toFixed(2)}`);
}
// smoothness: the largest step in height between points 0.25 m apart along the line, at a few moments (a jump would be a seam in the water)
let worst = 0; for (const t of [3, 11, 17.5, 29]) { let prev = null; for (let o = -5; o < 90; o += 0.25) { const x = b.x + b.ox * o, z = b.z + b.oz * o, y = breakerAt(B, x, z, -heightAt(x, -z), t); if (prev !== null) worst = Math.max(worst, Math.abs(y - prev)); prev = y; } }
console.log('largest height step over 0.25 m:', worst.toFixed(3), 'm (a smooth surface stays well under 0.25)');
// a crest's speed: where the highest point is at t and at t + 1 s
const crestAt = (t) => { let best = -1e9, bo = 0; for (let o = 10; o < 60; o += 0.1) { const x = b.x + b.ox * o, z = b.z + b.oz * o, y = breakerAt(B, x, z, -heightAt(x, -z), t); if (y > best) { best = y; bo = o; } } return bo; };
console.log('a crest moves shoreward at', (crestAt(10) - crestAt(11)).toFixed(2), 'm/s (designed 6)');
