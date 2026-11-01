import fs from 'fs'; import zlib from 'zlib';
import { planRivers } from './rivers.js';
const W = '/home/user/seven-bells-deep/web/assets/', data = JSON.parse(fs.readFileSync(W + 'world.json', 'utf8'));
const n = data.grid, nn = n * n, u = zlib.inflateSync(fs.readFileSync(W + data.files.height)), H = new Uint16Array(nn), d = new Int32Array(n);
for (let j = 0, p = 0; j < n; j++) { let v = 0; for (let i = 0; i < n; i++, p++) { d[i] = (d[i] + (u[p] | u[p + nn] << 8)) & 0xffff; v = (v + d[i]) & 0xffff; H[p] = v * 2; } }
const size = data.size_m, cell = size / (n - 1), ox = data.origin[0], oy = data.origin[1], top = data.top_m || 0, HK = (top + data.depth_scale_m) / 65535;
const Hz = new Float32Array(nn); for (let i = 0; i < nn; i++) Hz[i] = top - H[i] * HK; const H0 = Hz.slice();
const plan = planRivers(data, Hz, n, cell, ox, oy);
const rv = plan.rivers.find((r) => r.id === "crown_lower"); const PL = plan.pools[0];
console.log('pool polyline (first 16 samples):'); for (let i = 0; i <= 16; i++) console.log(i, rv.X[i].toFixed(1), rv.Y[i].toFixed(1), 'T', rv.TX[i].toFixed(2), rv.TY[i].toFixed(2), 'hw', rv.HW[i].toFixed(2), 'W', rv.W[i].toFixed(2));
// grid around the pool: original and carved, relative to the pool level, over a 30 m box
const cx = PL.cx, cy = PL.cy; rv.W[6] = PL.W; console.log('around s=6 (', cx.toFixed(1), cy.toFixed(1), '): rows +y down; values carved - W (orig - W)');
for (let gy = 6; gy >= -6; gy--) { let line = ''; for (let gx = -6; gx <= 6; gx++) { const fx = Math.round((cx - ox) / cell) + gx, fy = Math.round((cy - oy) / cell) + gy, k = fy * n + fx; line += (Hz[k] - rv.W[6]).toFixed(1).padStart(6); } console.log(line); }
console.log('foot', JSON.stringify(rv.foot), 'fall', JSON.stringify(rv.fall));
console.log('pools', JSON.stringify(plan.pools.map((p) => ({ W: p.W, ra: p.ra, rb: p.rb, cx: p.cx, cy: p.cy, foot: [p.ft.x, p.ft.y] }))));
