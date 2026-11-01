import fs from 'fs'; import zlib from 'zlib';
const W = '/home/user/seven-bells-deep/web/assets/', data = JSON.parse(fs.readFileSync(W + 'world.json', 'utf8'));
const n = data.grid, nn = n * n, u = zlib.inflateSync(fs.readFileSync(W + data.files.height)), H = new Uint16Array(nn), d = new Int32Array(n);
for (let j = 0, p = 0; j < n; j++) { let v = 0; for (let i = 0; i < n; i++, p++) { d[i] = (d[i] + (u[p] | u[p + nn] << 8)) & 0xffff; v = (v + d[i]) & 0xffff; H[p] = v * 2; } }
const size = data.size_m, cell = size / (n - 1), ox = data.origin[0], oy = data.origin[1], top = data.top_m || 0, HK = (top + data.depth_scale_m) / 65535;
const heightAt = (x, y) => { const fx = Math.max(0, Math.min(n - 1.001, (x - ox) / cell)), fy = Math.max(0, Math.min(n - 1.001, (y - oy) / cell)), ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * n + ix; return top - HK * (H[o] * (1 - ax) * (1 - ay) + H[o + 1] * ax * (1 - ay) + H[o + n] * (1 - ax) * ay + H[o + n + 1] * ax * ay); };
for (const id of ['sunward', 'crown', 'frost_isle']) {
  const isl = data.poi.find((p) => p.id === id); console.log('==', id, isl.x, isl.y, 'r', isl.r);
  for (let a = 0; a < 360; a += 15) {
    const r = a * Math.PI / 180, dx = Math.cos(r), dy = Math.sin(r); let s = 0, wasLand = false, shore = null;
    for (; s < isl.r * 3; s += 2) { const z = heightAt(isl.x + dx * s, isl.y + dy * s); if (z > 0.3) wasLand = true; else if (wasLand && z < 0) { shore = s; break; } }
    if (shore === null) { console.log(a, 'no shore'); continue; }
    const prof = [10, 20, 30, 45, 60, 80, 100, 130, 160].map((m) => (-heightAt(isl.x + dx * (shore + m), isl.y + dy * (shore + m))).toFixed(1));
    console.log(String(a).padStart(3), 'shore', shore, 'depth at 10..160 m out:', prof.join(' '));
  }
}
