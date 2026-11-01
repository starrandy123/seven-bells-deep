// How the bot crosses the map: a coarse grid over the height field, A* round the islands, a cruise high in the water, a dive at the end.
// Only the bot uses this; a player has eyes. It reads the world through heightAt, so a bigger map needs no change here.
import * as THREE from 'three';

const CELL = 16;

export function createBotNav(G) {
  const d = G.world.data, size = d.size_m || 1280, o = d.origin || [-size / 2, -size / 2], N = Math.ceil(size / CELL);
  let cost = null, tall = null;
  const stalls = [];
  const out = new THREE.Vector3(), h = G.hero;
  const ix = (x, y) => [Math.floor((x - o[0]) / CELL), Math.floor((y - o[1]) / CELL)];
  const groundAt = (c, r) => G.world.heightAt(o[0] + (c + 0.5) * CELL, o[1] + (r + 0.5) * CELL);

  function build() {
    cost = new Float32Array(N * N);
    const hs = new Float32Array(N * N);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) hs[r * N + c] = groundAt(c, r);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const g = hs[r * N + c]; let climb = 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + a, nr = r + b; if (nc < 0 || nr < 0 || nc >= N || nr >= N) continue; climb = Math.max(climb, Math.abs(hs[nr * N + nc] - g)); }
      cost[r * N + c] = g < -9 ? 1 : g < -2 ? 1.3 : (g > 0 && climb > 15 ? 0 : g > 0 ? 2.5 : 1.4);   // 0 is a wall; shallow water costs a little, so a route takes the deep channels
    }
    // rock that stands up through the water he cruises in is a wall too; anything lower he swims over
    tall = new Uint8Array(N * N);
    // the bot's alone: a player's route only reads the height field, and asking for data.colliders builds the whole view
    for (const k of G.bot ? d.colliders || [] : []) {
      if (k.z1 < -12 || k.z0 > -1) continue;
      const rad = (k.t === 'cyl' ? k.r : Math.hypot(k.hx, k.hy)) + 3;
      for (let y = k.y - rad; y <= k.y + rad; y += CELL / 2) for (let x = k.x - rad; x <= k.x + rad; x += CELL / 2) {
        if (Math.hypot(x - k.x, y - k.y) > rad) continue;
        const [c, r] = ix(x, y); if (c >= 0 && r >= 0 && c < N && r < N) tall[r * N + c] = 1;
      }
    }
  }

  // a binary heap, and each cell settled once: even a search that fails is a millisecond, so the bot never costs a frame
  const heapF = [], heapV = [];
  function push(f, v) {
    let i = heapF.length; heapF.push(f); heapV.push(v);
    while (i > 0) { const p = (i - 1) >> 1; if (heapF[p] <= f) break; heapF[i] = heapF[p]; heapV[i] = heapV[p]; i = p; }
    heapF[i] = f; heapV[i] = v;
  }
  function pop() {
    const top = heapV[0], f = heapF.pop(), v = heapV.pop(), n = heapF.length;
    if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && heapF[c + 1] < heapF[c]) c++; if (heapF[c] >= f) break; heapF[i] = heapF[c]; heapV[i] = heapV[c]; i = c; } heapF[i] = f; heapV[i] = v; }
    return top;
  }
  const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]];
  let best = null, from = null, shut = null, aground = 0;           // aground: how often he's stuck on the way to this goal; each time, land costs more

  function astar(a, b, wet, rock) {
    if (!cost) build();
    if (!best) { best = new Float32Array(N * N); from = new Int32Array(N * N); shut = new Uint8Array(N * N); }
    best.fill(1e9); from.fill(-1); shut.fill(0); heapF.length = heapV.length = 0;
    const start = a[1] * N + a[0], goal = b[1] * N + b[0];
    if (start < 0 || goal < 0 || start >= N * N || goal >= N * N) return null;
    best[start] = 0; push(0, start);
    while (heapV.length) {
      const u = pop(); if (shut[u]) continue; shut[u] = 1;
      if (u === goal) break;
      const uc = u % N, ur = (u - uc) / N;
      for (const [x, y, w] of STEPS) {
        const c = uc + x, r = ur + y; if (c < 0 || r < 0 || c >= N || r >= N) continue;
        const v = r * N + c; if (shut[v] || (!cost[v] && v !== goal)) continue;
        if (rock && tall[v] && v !== goal && Math.hypot(c - a[0], r - a[1]) > 1.5) continue;     // the cell he starts in may touch rock
        const nd = best[u] + w * ((wet && cost[v] > 1.2 ? 14 + aground * 40 : cost[v]) || 1);
        if (nd < best[v]) { best[v] = nd; from[v] = u; push(nd + Math.hypot(c - b[0], r - b[1]), v); }
      }
    }
    if (from[goal] < 0) return null;
    const path = []; for (let v = goal; v !== start && v >= 0; v = from[v]) path.unshift(v);
    return path.map((v) => { const c = v % N, r = (v - c) / N; return { x: o[0] + (c + 0.5) * CELL, y: o[1] + (r + 0.5) * CELL }; });
  }

  // clear of standing rock if there's such a way, else any way a swimmer has
  const way = (a, b, wet) => astar(a, b, wet, true) || astar(a, b, wet, false);

  // is the straight line all water deep enough to swim?
  function clearLine(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 12);
    if (!cost) build();
    for (let i = 1; i < n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; if (G.world.heightAt(x, y) > -2.2) return false;
      if (i * 12 > 14 && (n - i) * 12 > 14) { const [c, r] = ix(x, y); if (c >= 0 && r >= 0 && c < N && r < N && tall[r * N + c]) return false; }
    }
    return true;
  }

  let path = null, at = 0, lastGoal = new THREE.Vector3(1e9, 0, 0), age = 0, force = false;
  return {
    // how far it really is by water, round the islands: time limits are read from this, never from the straight line
    route(a, b) {
      const ax = a.x, ay = -a.z, bx = b.x, by = -b.z;
      if (clearLine(ax, ay, bx, by)) return Math.hypot(bx - ax, by - ay);
      const p = way(ix(ax, ay), ix(bx, by), G.world.heightAt(bx, by) < -1); if (!p) return Math.hypot(bx - ax, by - ay) * 1.5;
      let len = 0, x = ax, y = ay; for (const w of p) { len += Math.hypot(w.x - x, w.y - y); x = w.x; y = w.y; }
      return len;
    },
    next(goal) {
      const hx = h.pos.x, hy = -h.pos.z, gx = goal.x, gy = -goal.z;
      age -= 1 / 60;
      if (force || age <= 0 || lastGoal.distanceTo(goal) > 10) {
        if (lastGoal.distanceTo(goal) > 10) aground = 0;
        force = false; age = 3; lastGoal.copy(goal); at = 0;
        path = clearLine(hx, hy, gx, gy) ? null : way(ix(hx, hy), ix(gx, gy), G.world.heightAt(gx, gy) < -1);
      }
      const flatGoal = Math.hypot(gx - hx, gy - hy);
      if (path) {
        while (at < path.length - 1 && Math.hypot(path[at].x - hx, path[at].y - hy) < 22) at++;
        const w = path[at], g = G.world.heightAt(w.x, w.y);
        if (at < path.length - 1 || flatGoal > 24) { out.set(w.x, g > -2 ? g + 1 : Math.max(g + 5, -8), -w.y); return out; }
      }
      if (flatGoal > 90) { const a = Math.atan2(gx - hx, gy - hy), wx = hx + Math.sin(a) * 60, wy = hy + Math.cos(a) * 60, g = G.world.heightAt(wx, wy); out.set(wx, Math.max(g + 6, -9), -wy); return out; }
      return goal;
    },
    stuck() { force = true; aground = Math.min(aground + 1, 10); },
    // Every place the bot had to back out of, kept and said, so the pockets in a world get found: x, y, z (Blender), and what it was trying to reach
    stalls,
    backedOff(goal) {
      const [c, r] = ix(h.pos.x, -h.pos.z); if (cost && c >= 0 && r >= 0 && c < N && r < N) tall[r * N + c] = 1;           // not this way again
      const p = [h.pos.x, -h.pos.z, h.pos.y].map(Math.round), key = p.join(), row = stalls.find((a) => a.at === key);
      if (row) row.n++; else { stalls.push({ at: key, n: 1, goal: [goal.x, -goal.z, goal.y].map(Math.round).join() }); console.warn(`[bot] backing out of ${key}, bound for ${stalls[stalls.length - 1].goal}`); }
    },
    // Nothing better found: 25 m back the way that's clear, away from the goal first, level or lower
    backOff(goal) {
      const a0 = Math.atan2(-(goal.x - h.pos.x), -(-goal.z + h.pos.z)), f = { x: h.pos.x, y: -h.pos.z, z: h.pos.y }, t = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < 12; i++) for (const dz of [0, -8, 8]) {
        const a = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.52; t.x = f.x + Math.sin(a) * 25; t.y = f.y + Math.cos(a) * 25; t.z = Math.min(f.z + dz, -1.5);
        if (t.z > G.world.heightAt(t.x, t.y) + 1.5 && !G.world.sweep(f, t, 0.55)) return [{ x: t.x, y: t.y, z: t.z }];
      }
      return [];
    },
    // On land and stuck (a fort's walls, a bank): a walk on a 2.5 m grid over what he can really stand on and climb, out to the first water if that's where he's bound, else to the cell nearest the goal
    local(goal) {
      const C = 2.5, R = 48, W2 = R * 2 + 1, hx = h.pos.x, hy = -h.pos.z, gx = goal.x, gy = -goal.z, wet = goal.y < -1, id = (i, j) => (i + R) + (j + R) * W2, seen = new Int32Array(W2 * W2).fill(-2), t = { x: 0, y: 0, z: 0 }, q = [[0, 0]];
      seen[id(0, 0)] = -1; let best = id(0, 0), bd = 1e12;
      for (let a = 0; a < q.length; a++) {
        const [i, j] = q[a], x = hx + i * C, y = hy + j * C, g = G.world.heightAt(x, y), dg = Math.hypot(x - gx, y - gy);
        if (wet && g < -1.5) { best = id(i, j); break; }
        if (dg < bd) { bd = dg; best = id(i, j); }
        for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const ni = i + u, nj = j + v; if (Math.abs(ni) > R || Math.abs(nj) > R) continue;
          const k = id(ni, nj); if (seen[k] !== -2) continue;
          const nx = hx + ni * C, ny = hy + nj * C, ng = G.world.heightAt(nx, ny);
          t.x = nx; t.y = ny; t.z = Math.max(ng, -0.5) + 1.1;
          if (ng - g > C * 0.85 * Math.hypot(u, v) || G.world.collide(t, 0.5)) { seen[k] = -3; continue; }
          seen[k] = id(i, j); q.push([ni, nj]);
        }
      }
      const way = []; for (let k = best; k >= 0 && seen[k] !== -1; k = seen[k]) { const i = (k % W2) - R, j = (k - (k % W2)) / W2 - R; way.unshift({ x: hx + i * C, y: hy + j * C }); }
      return way;
    },
    // In the water and stuck (a slot under the ice, a hall with one door): a walk on a 5 m grid through free water. A far goal: out to the first place with open water up to the surface. A near one: as close as the water goes
    wetWay(goal) {
      const C = 5, R = 24, Z = 18, W2 = R * 2 + 1, H2 = Z * 2 + 1, hx = h.pos.x, hy = -h.pos.z, hz = h.pos.y, gx = goal.x, gy = -goal.z, gz = goal.y, far = Math.hypot(gx - hx, gy - hy) > 120;
      const id = (i, j, k) => (i + R) + W2 * ((j + R) + W2 * (k + Z)), seen = new Int32Array(W2 * W2 * H2).fill(-2), t = { x: 0, y: 0, z: 0 }, q = [[0, 0, 0]], up = new Map(), pa = { x: 0, y: 0, z: 0 }, pb = { x: 0, y: 0, z: 0 };
      const free = (x, y, z) => { if (z > -0.8) return false; t.x = x; t.y = y; t.z = z; return !G.world.collide(t, 0.55); };
      const open = (x, y, z, key) => { let v = up.get(key); if (v !== undefined && v <= z) return true; for (let zz = z; zz < -1; zz += 3) if (!free(x, y, zz)) return false; if (v === undefined || z < v) up.set(key, z); return true; };
      seen[id(0, 0, 0)] = -1; let best = id(0, 0, 0), bd = 1e12;
      for (let a = 0; a < q.length && a < 6000; a++) {
        const [i, j, k] = q[a], x = hx + i * C, y = hy + j * C, z = hz + k * C, n = Math.abs(i) + Math.abs(j) + Math.abs(k);
        if (far && n >= 3 && open(x, y, z, i * 1000 + j)) { best = id(i, j, k); break; }
        const dg = Math.hypot(x - gx, y - gy, z - gz); if (dg < bd) { bd = dg; best = id(i, j, k); }
        for (const [u, v, w] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const ni = i + u, nj = j + v, nk = k + w; if (Math.abs(ni) > R || Math.abs(nj) > R || Math.abs(nk) > Z) continue;
          const key = id(ni, nj, nk); if (seen[key] !== -2) continue;
          pa.x = x; pa.y = y; pa.z = z; pb.x = hx + ni * C; pb.y = hy + nj * C; pb.z = hz + nk * C;
          if (!free(pb.x, pb.y, pb.z) || G.world.sweep(pa, pb, 0.55)) continue;             // a thin wall between two free cells is still a wall: this edge is shut, the cell may be reached another way
          seen[key] = id(i, j, k); q.push([ni, nj, nk]);
        }
      }
      const way = []; for (let k0 = best; k0 >= 0 && seen[k0] !== -1; k0 = seen[k0]) { const a = k0 % W2, rest = (k0 - a) / W2, b = rest % W2, c = (rest - b) / W2; way.unshift({ x: hx + (a - R) * C, y: hy + (b - R) * C, z: hz + (c - Z) * C }); }
      return way;
    },
    // can a swimmer get there at all? (the checks ask this of every place a mission names)
    reachable(a, b) { return clearLine(a.x, -a.z, b.x, -b.z) || !!way(ix(a.x, -a.z), ix(b.x, -b.z)); },
  };
}
