import fs from 'fs'; import zlib from 'zlib';
const W = '/home/user/seven-bells-deep/web/assets/', data = JSON.parse(fs.readFileSync(W + 'world.json', 'utf8'));
const n = data.grid, nn = n * n, u = zlib.inflateSync(fs.readFileSync(W + data.files.height)), H = new Uint16Array(nn), d = new Int32Array(n);
for (let j = 0, p = 0; j < n; j++) { let v = 0; for (let i = 0; i < n; i++, p++) { d[i] = (d[i] + (u[p] | u[p + nn] << 8)) & 0xffff; v = (v + d[i]) & 0xffff; H[p] = v * 2; } }
const size = data.size_m, cell = size / (n - 1), ox = data.origin[0], oy = data.origin[1], top = data.top_m || 0, HK = (top + data.depth_scale_m) / 65535;
const hz = (x, y) => { const fx = (x - ox) / cell, fy = (y - oy) / cell, ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * n + ix; return top - HK * (H[o] * (1 - ax) * (1 - ay) + H[o + 1] * ax * (1 - ay) + H[o + n] * (1 - ax) * ay + H[o + n + 1] * ax * ay); };
const G = data.instances.grass_patch, cols = [];
for (const k of Object.keys(data.col_kinds)) { const L = data.instances[k] || []; for (let i = 0; i < L.length; i += 6) cols.push([L[i], L[i + 1]]); }
const blocked = (x, y) => cols.some(([a, b]) => Math.hypot(a - x, b - y) < 14);
let best = [];
for (let i = 0; i < G.length; i += 6 * 7) {
  const x = G[i], y = G[i + 1], z0 = hz(x, y); if (z0 < 2.5) continue;
  for (let a = 0; a < 6.283; a += 0.785) { const dx = Math.cos(a), dy = Math.sin(a); let ok = true, zmax = z0, zmin = z0;
    for (let s = 0; s <= 50; s += 2.5) { const z = hz(x + dx * s, y + dy * s); zmax = Math.max(zmax, z); zmin = Math.min(zmin, z); if (z < 1.5 || blocked(x + dx * s, y + dy * s)) { ok = false; break; } }
    if (ok && zmax - zmin < 4 && zmax - zmin > 0.6) best.push([x, y, a, zmax - zmin, z0]); }
}
best.sort((p, q) => p[3] - q[3]); console.log(best.length, JSON.stringify(best.slice(0, 8).map((b) => b.map((v) => +v.toFixed(2)))));
