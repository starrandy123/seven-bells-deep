// rivers.js offline on the real height field: what it digs and builds, whether any water edge floats, which props it disturbs
import fs from 'fs'; import zlib from 'zlib';
import { planRivers, dressRivers, riverGeometry, NO_WATER } from './rivers.js';
const W = '/home/user/seven-bells-deep/web/assets/', data = JSON.parse(fs.readFileSync(W + 'world.json', 'utf8'));
const n = data.grid, nn = n * n, u = zlib.inflateSync(fs.readFileSync(W + data.files.height)), H = new Uint16Array(nn), d = new Int32Array(n);
for (let j = 0, p = 0; j < n; j++) { let v = 0; for (let i = 0; i < n; i++, p++) { d[i] = (d[i] + (u[p] | u[p + nn] << 8)) & 0xffff; v = (v + d[i]) & 0xffff; H[p] = v * 2; } }
const size = data.size_m, cell = size / (n - 1), ox = data.origin[0], oy = data.origin[1], top = data.top_m || 0, HK = (top + data.depth_scale_m) / 65535;
const Hz = new Float32Array(nn); for (let i = 0; i < nn; i++) Hz[i] = top - H[i] * HK;
const Horig = Hz.slice();
const bil = (A) => (x, y) => { let fx = (x - ox) / cell, fy = (y - oy) / cell; fx = Math.max(0, Math.min(n - 1.001, fx)); fy = Math.max(0, Math.min(n - 1.001, fy)); const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * n + ix; return A[o] * (1 - ax) * (1 - ay) + A[o + 1] * ax * (1 - ay) + A[o + n] * (1 - ax) * ay + A[o + n + 1] * ax * ay; };
const orig = bil(Horig);
const t0 = Date.now(); const plan = planRivers(data, Hz, n, cell, ox, oy); console.log('planned in', Date.now() - t0, 'ms', JSON.stringify(plan.stats));
const now = bil(Hz);
for (const rv of plan.rivers) {
  console.log(`== ${rv.id} len ${rv.len.toFixed(0)} m, samples ${rv.N}, fall ${rv.pool ? "pool " + rv.pool.W.toFixed(2) + " leaves at sample " + rv.iOut : "-"}`);
  for (let i = 0; i <= rv.N; i += Math.max(1, Math.round(8 / rv.ds))) {
    const x = rv.X[i], y = rv.Y[i], nx = -rv.TY[i], ny = rv.TX[i], hw = rv.HW[i];
    const g0 = orig(x, y), g1 = now(x, y), eL = now(x - nx * (hw + .7), y - ny * (hw + .7)) - rv.W[i], eR = now(x + nx * (hw + .7), y + ny * (hw + .7)) - rv.W[i];
    const oL = now(x - nx * (hw + 2.2), y - ny * (hw + 2.2)) - rv.W[i], oR = now(x + nx * (hw + 2.2), y + ny * (hw + 2.2)) - rv.W[i];
    console.log(`  s ${(i * rv.ds).toFixed(0).padStart(4)} W ${rv.W[i].toFixed(2).padStart(6)} hw ${hw.toFixed(1)} bed was ${(g0 - rv.W[i]).toFixed(2).padStart(6)} now ${(g1 - rv.W[i]).toFixed(2).padStart(6)} | edge+.7 L ${eL.toFixed(2).padStart(5)} R ${eR.toFixed(2).padStart(5)} | +2.2 L ${oL.toFixed(2).padStart(5)} R ${oR.toFixed(2).padStart(5)} | v ${rv.V[i].toFixed(1)} turb ${rv.TURB[i].toFixed(2)} churn ${rv.CH[i].toFixed(2)}`);
  }
}
// floating edges: any section whose vertex at hw+.7 or hw+2.2 sits over ground lower than the water (visible as a lip of water in the air)
let float7 = 0, float22 = 0, secs = 0, worst = 0, worstAt = '';
for (const rv of plan.rivers) for (let i = 0; i <= rv.N; i++) { if (rv.W[i] <= .3) continue; secs++; const x = rv.X[i], y = rv.Y[i], nx = -rv.TY[i], ny = rv.TX[i], hw = rv.HW[i];
  for (const sd of [-1, 1]) { const a = now(x + nx * sd * (hw + .7), y + ny * sd * (hw + .7)) - rv.W[i], b = now(x + nx * sd * (hw + 2.2), y + ny * sd * (hw + 2.2)) - rv.W[i]; if (a < -.02) float7++; if (b < -.02) float22++; if (Math.min(a, b) < worst) { worst = Math.min(a, b); worstAt = `${rv.id} s ${(i * rv.ds).toFixed(0)} side ${sd}`; } } }
console.log('sections', secs, 'edge points under water level: at hw+.7', float7, 'at hw+2.2', float22, 'worst', worst.toFixed(2), worstAt);
// props the carve moves: anything standing within the changed area whose ground moved more than 15 cm
let moved = 0, drowned = 0; const byKind = {};
for (const k of Object.keys(data.instances)) { const L = data.instances[k]; for (let i = 0; i + 5 < L.length; i += 6) { const x = L[i], y = L[i + 1]; const dz = now(x, y) - orig(x, y); if (Math.abs(dz) > .15) { moved++; byKind[k] = (byKind[k] || 0) + 1; const w = plan.waterAt(x, y); if (w && now(x, y) < w.W) drowned++; } } }
console.log('props on moved ground', moved, JSON.stringify(byKind), 'now under river water', drowned);
const add = dressRivers(plan, now); console.log('dressing', Object.entries(add).map(([k, v]) => k + ' ' + v.length / 6).join(', '));
const g = riverGeometry(plan, now); console.log('ribbon vertices', g.P.length / 3, 'triangles', g.I.length / 3);
let nan = 0; for (const a of [g.P, g.A, g.B]) for (const v of a) if (!Number.isFinite(v)) nan++; console.log('non-finite', nan);
const f = data.waterfalls[0]; console.log('fall pool', f.pool && f.pool.toFixed(2), 'z1', f.z1);
const lv = plan.fillLevel(); let cnt = 0; for (let i = 0; i < nn; i++) if (lv[i] > NO_WATER) cnt++; console.log('level grid nodes', cnt);
// waterAt checks along crown_lower
const cl = plan.rivers.find((r) => r.id === 'crown_lower'); for (const i of [0, 5, 10, 20, 40]) { if (i > cl.N) continue; const w = plan.waterAt(cl.X[i] + 0.3, cl.Y[i] - 0.2); console.log('waterAt crown_lower', i, w ? w.W.toFixed(2) + ' d ' + w.d.toFixed(2) + ' v ' + w.v.toFixed(1) : null); }
fs.writeFileSync('/tmp/claude-0/-home-user-seven-bells-deep/7c3468ca-0f0b-55b7-8f7d-22ef437fcb91/scratchpad/citytest/carve.json', JSON.stringify({ rivers: plan.rivers.map((r) => ({ id: r.id, X: [...r.X], Y: [...r.Y], W: [...r.W], HW: [...r.HW] })) }));
