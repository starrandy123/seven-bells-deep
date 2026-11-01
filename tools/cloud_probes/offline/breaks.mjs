// Where the surf breaks: shoreline points whose seabed deepens gently and steadily offshore. Offline prototype on the real heightmap.
import fs from 'fs'; import zlib from 'zlib';
const W = '/home/user/seven-bells-deep/web/assets/', data = JSON.parse(fs.readFileSync(W + 'world.json', 'utf8'));
const n = data.grid, nn = n * n, u = zlib.inflateSync(fs.readFileSync(W + data.files.height)), H = new Uint16Array(nn), d = new Int32Array(n);
for (let j = 0, p = 0; j < n; j++) { let v = 0; for (let i = 0; i < n; i++, p++) { d[i] = (d[i] + (u[p] | u[p + nn] << 8)) & 0xffff; v = (v + d[i]) & 0xffff; H[p] = v * 2; } }
const size = data.size_m, cell = size / (n - 1), ox = data.origin[0], oy = data.origin[1], top = data.top_m || 0, HK = (top + data.depth_scale_m) / 65535;
const heightAt = (x, y) => { const fx = Math.max(0, Math.min(n - 1.001, (x - ox) / cell)), fy = Math.max(0, Math.min(n - 1.001, (y - oy) / cell)), ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * n + ix; return top - HK * (H[o] * (1 - ax) * (1 - ay) + H[o + 1] * ax * (1 - ay) + H[o + n] * (1 - ax) * ay + H[o + n + 1] * ax * ay); };
const islands = data.poi.filter((p) => p.z > 0 && p.r >= 40);
console.log('islands', islands.map((p) => p.id + ' r' + p.r).join(', '));
const found = [];
for (const isl of islands) {
  const cands = [];
  for (let a = 0; a < 360; a += 3) {
    const r = a * Math.PI / 180, dx = Math.cos(r), dy = Math.sin(r);
    // walk out from the island's middle to its shoreline (the first water past land)
    let s = 0, wasLand = false, shore = null;
    for (; s < isl.r * 2.4; s += 2) { const z = heightAt(isl.x + dx * s, isl.y + dy * s); if (z > 0.3) wasLand = true; else if (wasLand && z < 0) { shore = s; break; } }
    if (shore === null) continue;
    const at = (m) => -heightAt(isl.x + dx * (shore + m), isl.y + dy * (shore + m));
    const D = [10, 20, 30, 45].map(at), d30 = D[2], d60 = at(60), d100 = at(100);
    // a beach break: no rock in the first 45 m, the bed deepening steadily, 1-4.5 m deep 10 m out and 5-14 m at 45 m (beyond that a shelf or a drop is fine)
    let ok = D[0] > 0.8 && D[0] < 4.5 && D[3] > 5 && D[3] < 14, rise = 0;
    for (let i = 1; i < 4; i++) if (D[i] < D[i - 1] - 0.3) ok = false;
    for (let m = 2; m <= 45; m += 2) if (at(m) < 0.3) ok = false;
    if (ok && rise === 0) cands.push({ a, shore, d30, d60, d100, score: -Math.abs(D[3] - 8) - Math.abs(D[0] - 2) });
  }
  // runs of neighbouring angles: one spot per run, at its best, if the run is wide enough for a real break (40 m of shore or more)
  cands.sort((p, q) => p.a - q.a);
  const runs = []; for (const c of cands) { const last = runs[runs.length - 1]; if (last && c.a - last[last.length - 1].a <= 6) last.push(c); else runs.push([c]); }
  for (const run of runs) {
    const best = run.reduce((p, q) => (q.score > p.score ? q : p)), arc = (run[run.length - 1].a - run[0].a + 3) * Math.PI / 180 * best.shore;
    if (arc < 40) continue;
    found.push({ isl: isl.id, ...best, arc: Math.round(arc) });
  }
}
found.sort((p, q) => q.arc - p.arc);
for (const f of found) console.log(f.isl, 'angle', f.a, 'shore at', f.shore, 'm; depth 30/60/100 m out:', f.d30.toFixed(1), f.d60.toFixed(1), f.d100.toFixed(1), '; shore length', f.arc, 'm');
