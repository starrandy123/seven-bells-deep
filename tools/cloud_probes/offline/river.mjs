import fs from 'fs'; import zlib from 'zlib';
const W = '/home/user/seven-bells-deep/web/assets/', data = JSON.parse(fs.readFileSync(W + 'world.json', 'utf8'));
const n = data.grid, nn = n * n, u = zlib.inflateSync(fs.readFileSync(W + data.files.height)), H = new Uint16Array(nn), d = new Int32Array(n);
for (let j = 0, p = 0; j < n; j++) { let v = 0; for (let i = 0; i < n; i++, p++) { d[i] = (d[i] + (u[p] | u[p + nn] << 8)) & 0xffff; v = (v + d[i]) & 0xffff; H[p] = v * 2; } }
const size = data.size_m, cell = size / (n - 1), ox = data.origin[0], oy = data.origin[1], top = data.top_m || 0, HK = (top + data.depth_scale_m) / 65535;
const crv = (a, b, c, e, t) => b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - e + t * (3 * (b - c) + e - a)));
const heightAt = (x, y) => { let fx = (x - ox) / cell, fy = (y - oy) / cell; fx = Math.max(0, Math.min(n - 1.001, fx)); fy = Math.max(0, Math.min(n - 1.001, fy)); const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * n + ix;
  if (ix < 1 || iy < 1 || ix > n - 3 || iy > n - 3) return top - HK * (H[o] * (1 - ax) * (1 - ay) + H[o + 1] * ax * (1 - ay) + H[o + n] * (1 - ax) * ay + H[o + n + 1] * ax * ay);
  const r0 = crv(H[o - n - 1], H[o - n], H[o - n + 1], H[o - n + 2], ax), r1 = crv(H[o - 1], H[o], H[o + 1], H[o + 2], ax), r2 = crv(H[o + n - 1], H[o + n], H[o + n + 1], H[o + n + 2], ax), r3 = crv(H[o + 2 * n - 1], H[o + 2 * n], H[o + 2 * n + 1], H[o + 2 * n + 2], ax);
  return top - HK * crv(r0, r1, r2, r3, ay); };
console.log('grid cell', cell.toFixed(2), 'm');
for (const r of data.rivers) {
  console.log('==', r.id, 'w', r.w, 'points', r.pts.length);
  for (let i = 0; i + 1 < r.pts.length; i++) {
    const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    for (const t of [0, 0.5]) { const x = a[0] + dx * t, y = a[1] + dy * t, z = a[2] + (b[2] - a[2]) * t;
      const cross = [-8, -5, -3, -1.5, 0, 1.5, 3, 5, 8].map((s) => (heightAt(x - uy * s, y + ux * s) - z).toFixed(1).padStart(5));
      console.log(`  seg ${i} t${t}: water ${z.toFixed(1)}  ground minus water, across -8..8 m: ${cross.join(' ')}  slope ${((a[2] - b[2]) / L).toFixed(3)}`); }
  }
}
const f = data.waterfalls[0]; console.log('falls', JSON.stringify(f));
