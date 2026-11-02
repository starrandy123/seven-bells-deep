// Fire that lights what's round it. Randy, 2 Nov: "we HAVE 0 shadows in the game or water reflections! Or fire having the light with the vex needed" · "fire must glow and shit with the city too".
// Sixteen lights, at most four to a 4 m cell of a grid laid on the world, the way a 2010 open-world console game did it: no pass, no draw, nothing to lose in a context loss, and no cost at all with no fire about. Pipeline/research/LIGHT_SOURCES.md
// Anyone can push a light for this frame (light) or a short one that fades (pop). Each frame the sixteen that matter most at the camera go up as uniforms, strongest first, and the grid says which of them reach each cell.
const MAX = 16, CELL = 4, CELLS = 64, POOL = 56, F = 10;

// a stepped noise, never a sine: mostly up to 17% over base and now and then a third, about ten steps a second, slower for a big fire, as a flame's flicker scales with its size
const hash = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

export function createFireLight(G, grid, touch) {
  const U = G.look.uniforms, A = new Float32Array(POOL * F), order = new Int16Array(POOL), score = new Float32Array(POOL), pops = []; let n = 0, on = 0, t = 0;
  for (let i = 0; i < 12; i++) pops.push({ x: 0, y: 0, z: 0, r: 0, g: 0, b: 0, R: 1, e: 0, age: 1, life: 0, seed: 0 });
  // this frame only. (r, g, b) is its colour, R how far it reaches in metres, e its energy, wrap how far round a face it lights: 0.2 a small flame, 0.6 a big one
  function light(x, y, z, r, g, b, R, e, wrap = 0.3, seed = 0) { if (n >= POOL) return; const o = n * F; A[o] = x; A[o + 1] = y; A[o + 2] = z; A[o + 3] = R; A[o + 4] = r * e; A[o + 5] = g * e; A[o + 6] = b * e; A[o + 7] = wrap; A[o + 8] = seed; A[o + 9] = Math.max(r, g, b) * e; n++; }
  function pop(p, r, g, b, R, life, e, wrap = 0.5) { let f = pops[0]; for (const q of pops) if (q.age / Math.max(q.life, 1e-3) > f.age / Math.max(f.life, 1e-3)) f = q; f.x = p.x; f.y = p.y; f.z = p.z; f.r = r; f.g = g; f.b = b; f.R = R; f.e = e; f.age = 0; f.life = life; f.seed = Math.random() * 100; f.wrap = wrap; }
  // every look.flash, with no change to its callers: as bright at half its reach as it used to be
  G.look.setFlashLight((p, c, R, q) => light(p.x, p.y, p.z, c.r, c.g, c.b, R, 1.3 * q * (1 + R * R * 0.25), 0.6, R));

  function update(dt, cam) {
    t += dt;
    for (const f of pops) { if (f.age >= f.life) continue; f.age += dt; const q = Math.max(0, 1 - f.age / f.life); light(f.x, f.y, f.z, f.r, f.g, f.b, f.R, f.e * q * q, f.wrap, f.seed); }
    if (!n) { if (on) { on = 0; U.ocLightN.value = 0; } return; }
    for (let i = 0; i < n; i++) { const o = i * F, dx = A[o] - cam.x, dy = A[o + 1] - cam.y, dz = A[o + 2] - cam.z; order[i] = i; score[i] = (A[o + 9] * A[o + 3] * A[o + 3]) / (1 + dx * dx + dy * dy + dz * dz); }
    const list = Array.prototype.slice.call(order, 0, n).sort((a, b) => score[b] - score[a]), m = Math.min(MAX, n);
    grid.fill(0); const gx = Math.floor(cam.x / CELL - CELLS / 2) * CELL, gz = Math.floor(cam.z / CELL - CELLS / 2) * CELL;
    for (let i = 0; i < m; i++) {
      const o = list[i] * F, R = A[o + 3], seed = A[o + 8], rate = 10 * Math.min(1, 6 / Math.max(R, 1) + 0.2), step = Math.floor(t * rate + seed * 17), h = hash(step + seed), fl = 1 + 0.17 * h + (hash(step * 1.7 + seed) > 0.92 ? 0.16 : 0), jx = (hash(step + 3.1) - 0.5) * R * 0.08, jz = (hash(step + 7.7) - 0.5) * R * 0.08, x = A[o] + jx, y = A[o + 1], z = A[o + 2] + jz;
      U.ocLightP.value[i].set(x, y, z, R); U.ocLightC.value[i].set(A[o + 4] * fl, A[o + 5] * fl, A[o + 6] * fl, A[o + 7]);
      const c0 = Math.max(0, Math.floor((x - R - gx) / CELL)), c1 = Math.min(CELLS - 1, Math.floor((x + R - gx) / CELL)), r0 = Math.max(0, Math.floor((z - R - gz) / CELL)), r1 = Math.min(CELLS - 1, Math.floor((z + R - gz) / CELL));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const ex = gx + (c + 0.5) * CELL - x, ez = gz + (r + 0.5) * CELL - z, lim = R + CELL * 0.75; if (ex * ex + ez * ez > lim * lim) continue; const q = (r * CELLS + c) * 4; for (let s = 0; s < 4; s++) if (!grid[q + s]) { grid[q + s] = i + 1; break; } }
    }
    U.ocGridM.value.set(gx, gz, 1 / CELL, CELLS); U.ocLightN.value = m; on = m; touch(); n = 0;
  }
  // who casts a capsule shadow: him, and the three nearest of those he's fighting
  const capA = U.ocCapA.value, capB = U.ocCapB.value; let capN = 0, heroBones = null; const near = [], wp = new (G.hero.pos.constructor)(), wq = new (G.hero.pos.constructor)();
  function cap(i, ax, ay, az, bx, by, bz, r) { capA[i].set(ax, ay, az, r); capB[i].set(bx, by, bz, 0); }
  function casters() {
    const h = G.hero; let i = 0; const B = h.bones;
    if (B && B.head && B.hips && h.model && !h.dead) { B.head.getWorldPosition(wp); B.foot_L.getWorldPosition(wq); cap(i++, wp.x, wp.y, wp.z, wq.x, wq.y, wq.z, 0.42); }
    near.length = 0; if (G.enemies && G.enemies.alive) for (const e of G.enemies.alive()) { if (e.hidden || !e.pos || (e.def && e.def.body === undefined && !e.def.flyer)) continue; const d = (e.pos.x - h.pos.x) ** 2 + (e.pos.z - h.pos.z) ** 2; if (d < 1600) near.push([d, e]); }
    if (near.length > 1) near.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < near.length && i < 4; k++) { const e = near[k][1], u = e.up, s = e.def && e.def.scale ? e.def.scale : 1, r = 0.44 * s, ux = (u ? u.x : 0) * s, uy = (u ? u.y : 1) * s, uz = (u ? u.z : 0) * s; cap(i++, e.pos.x + ux * 0.8, e.pos.y + uy * 0.8, e.pos.z + uz * 0.8, e.pos.x - ux * 0.9, e.pos.y - uy * 0.9, e.pos.z - uz * 0.9, r); }
    for (let k = i; k < capN; k++) capA[k].w = 0; capN = i;
  }
  return { light, pop, update(dt, cam) { casters(); update(dt, cam); }, get count() { return on; } };
}
