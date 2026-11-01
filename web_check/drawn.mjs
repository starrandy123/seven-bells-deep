// A1v, A1k, A2, A2n, A2t: the solids against what's drawn. Split from collide.mjs when the 2,048 m map went live: alone this reads every drawn surface, and it takes a turn of the lock of its own.
//   node drawn.mjs <base> <chromium|webkit> [--only=A1v,A2,A2n,A2t,A1k]
import { gate, SMALL } from './lib/h.mjs';
const W = await gate('drawn', { budget: 175 });
const { line, note, open, section, finish } = W;

// A1v, A1k, A2: the solids against what's drawn. Points on the drawn surface of every kind (about one per 0.25 m² on its largest instance; what the game really draws: the batches' own matrices).
// HARD kinds are solid in the player's eye and need a collider; the SOFT kinds below are swum through on purpose (ISTQB: "some objects in the game may well be decorative").
// A1v: the collider covers what you see: a drawn point sticking out of the solids and the ground by more than his clearance (0.62 m sphere - 0.30 m body = 0.32 m) can be swum into.
// A2's two classes: a built thing has flat faces and a prism fits it: 0.6 m. A natural shape read by its mass (a rock, a cliff, a wreck, an arch of the sea, an iceberg, a kelp spire, a dome of brain coral, a table coral, a lumpy chimney: world's reading on the big map, 2,309 of 2,997 failures, 2-10 solids each) can't be fitted by prisms, and a swimmer reads a rough rock by its mass: 1.5 m (ours: about the reach of his arms; world's fit_colliders.py aims at 0.6 m and reports its own figure piece by piece). A wall a swimmer can feel at arm's length and more is still a failure.
// Trees (palms, oaks, snow pines): the trunk is hard (the lower third, near the axis), the crown is soft. A1k: nothing hard is drawn without a collider. A2: no invisible walls: a point on a collider's open side farther than 0.6 m from anything drawn is a wall you can't see.
const NATURAL = /^(rock_|cliff_rock|beach_rock|sea_arch|islet|wreck_|iceberg|ice_floe|ice_pillar|kelp_spire|coral_brain|coral_table|smoker)/;
const SOFT = /^(seagrass|kelp_stalk|grass_tuft|grass|fern|bush|flower|wildflower|reed|anemone|coral_fan|coral_branch|coral_tube|glow_coral)/;
await section(['A1v', 'A2', 'A2n', 'A2t', 'A1k'], async () => {
  const { page, close } = await open('?film&fresh&tier=phone', { ctx: SMALL });
  // the region packs load after first play: until they're in, a region's kinds are far meshes, and the drawn surface isn't the one a swimmer meets
  const packs = await page.evaluate(async () => { const G = window.__game, W = G.world, t0 = performance.now(); if (W.packsDone === undefined) return 'no packs in this build'; while (!W.packsDone && performance.now() - t0 < 30000) { for (let i = 0; i < 6; i++) G.frame(1 / 60); await new Promise((d) => setTimeout(d, 10)); } return W.packsDone ? `in after ${Math.round(performance.now() - t0)} ms` : 'NOT IN after 30 s'; });
  note(`region packs: ${packs}`); if (/NOT IN/.test(packs)) line('A2', false, `no reading: the region packs never finished, so the drawn surface isn't the real one`);
  const r = await page.evaluate(([softSrc, natSrc]) => {
    const NAT = new RegExp(natSrc), SOFT = new RegExp(softSrc), TREE = /^(palm|oak|tree|snow_pine)/, Q = window.__qa, G = window.__game, W = G.world, C = W.data.colliders, Hs = Q.hash(C, 16), t0 = performance.now(), ground = (x, y) => W.heightAt(x, y);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const out = { kinds: [], soft: [], t: 0 };
    // the open sides of the colliders first: only the drawn points near them need keeping
    const H = 1 << 22, key = (x, y, z) => { const a = Math.floor(x) + 2048, b = Math.floor(y) + 2048, c = Math.floor(z) + 512; return (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) & (H - 1); };
    const wanted = new Uint8Array(H), faces = [], tops = [];
    C.forEach((c, i) => {
      if (c.gate) return;
      const z0 = Math.max(c.z0, ground(c.x, c.y) - 1), z1 = c.z1, ring = [];
      if (c.t === 'cyl') { const n = Math.min(24, Math.ceil((6.283 * c.r) / 0.8)); for (let k = 0; k < n; k++) ring.push([c.x + Math.cos((k / n) * 6.283) * c.r, c.y + Math.sin((k / n) * 6.283) * c.r]); }
      else { const cs = Math.cos(c.yaw || 0), sn = Math.sin(c.yaw || 0), nx = Math.min(10, Math.ceil(c.hx / 0.5)), ny = Math.min(10, Math.ceil(c.hy / 0.5)); for (let u = -nx; u <= nx; u++) for (const v of [-1, 1]) { const lx = (u / nx) * c.hx, ly = v * c.hy; ring.push([c.x + lx * cs - ly * sn, c.y + lx * sn + ly * cs]); } for (let u = -ny; u <= ny; u++) for (const v of [-1, 1]) { const lx = v * c.hx, ly = (u / ny) * c.hy; ring.push([c.x + lx * cs - ly * sn, c.y + lx * sn + ly * cs]); } }
      const nz = Math.max(1, Math.min(6, Math.ceil((z1 - z0) / 1.2))), list = [];
      for (const [x, y] of ring) for (let k = 0; k <= nz; k++) { const z = z0 + ((z1 - z0) * k) / nz; if (z < ground(x, y) + 0.2) continue; let hid = false; for (const j of Hs.near(x, y)) if (j !== i && Q.sd(C[j], x, y, z) < 0.15) { hid = true; break; } if (hid) continue; list.push(x, y, z);
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let d = -2; d <= 2; d++) wanted[key(x + a, y + b, z + d)] = 1; }
      if (list.length) faces.push({ i, c, list });
      // the top: what he'd stand on, or swim over. Standing on air is the other half of A2
      const top = [], zt = z1; if (zt > ground(c.x, c.y) + 0.2) { const pts = c.t === 'cyl' ? [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].map(([u, v]) => [c.x + u * c.r, c.y + v * c.r]) : (() => { const a = [], cs = Math.cos(c.yaw || 0), sn = Math.sin(c.yaw || 0); for (const u of [-0.75, -0.25, 0.25, 0.75]) for (const v of [-0.75, -0.25, 0.25, 0.75]) { const lx = u * c.hx, ly = v * c.hy; a.push([c.x + lx * cs - ly * sn, c.y + lx * sn + ly * cs]); } return a; })();
        for (const [x, y] of pts) { let hid = false; for (const j of Hs.near(x, y)) if (j !== i && Q.sd(C[j], x, y, zt + 0.1) < 0.15) { hid = true; break; } if (hid) continue; top.push(x, y, zt); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let d = -2; d <= 2; d++) wanted[key(x + a, y + b, zt + d)] = 1; } }
      if (top.length) tops.push({ i, c, list: top });
    });
    // which colliders stand on a big natural shape
    const natHash = new Map(), natKey = (x, y) => Math.floor(x / 32) * 100003 + Math.floor(y / 32); for (const b of W.batches) { if (!NAT.test(b.name)) continue; const M = b.M; for (let k = 0; k < b.count; k++) { const x = M[k * 16 + 12], y = -M[k * 16 + 14], rr = b.rad || 8, r0 = Math.ceil(rr / 32); for (let i = -r0; i <= r0; i++) for (let j = -r0; j <= r0; j++) { const q = natKey(x + i * 32, y + j * 32); let l = natHash.get(q); if (!l) natHash.set(q, l = []); l.push([x, y, rr]); } } }
    const isNatural = (c) => (natHash.get(natKey(c.x, c.y)) || []).some(([x, y, rr]) => Math.hypot(c.x - x, c.y - y) < rr + Q.rad(c));
    // every drawn surface, kind by kind, in Blender's axes
    let cap = 8000000, pts = new Float32Array(cap * 3), next = new Int32Array(cap), w = 0, total = 0; const head = new Int32Array(H).fill(-1);     // the store grows: a fixed cap dropped late kinds and read them 100% far (world, on the big map)
    for (const b of W.batches) {
      const g = b.mesh.geometry, P = g.attributes.position, I = g.index, n = I ? I.count / 3 : P.count / 3, M = b.M, cnt = b.count, loc = [], soft = SOFT.test(b.name);
      const scaleOf = (o) => Math.cbrt(Math.abs(M[o] * (M[o + 5] * M[o + 10] - M[o + 6] * M[o + 9]) - M[o + 4] * (M[o + 1] * M[o + 10] - M[o + 2] * M[o + 9]) + M[o + 8] * (M[o + 1] * M[o + 6] - M[o + 2] * M[o + 5]))) || 1;
      let sc = 0; for (let k = 0; k < cnt; k++) sc = Math.max(sc, scaleOf(k * 16));     // sampled for the largest instance, so the largest is dense enough
      const id = (i) => (I ? I.getX(i) : i), p = (i) => [P.getX(i), P.getY(i), P.getZ(i)];
      for (let t = 0; t < n; t++) {
        const a = p(id(t * 3)), bb = p(id(t * 3 + 1)), c = p(id(t * 3 + 2)), ux = bb[0] - a[0], uy = bb[1] - a[1], uz = bb[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) * sc * sc, k = Math.min(8000, Math.max(1, Math.round(area / 0.25)));     // a 48 m tile's two triangles want 4,608 each: a lower cap thins them and reads them far (world)
        for (let j = 0; j < k; j++) { let s = rnd(), v = rnd(); if (s + v > 1) { s = 1 - s; v = 1 - v; } loc.push(a[0] + ux * s + vx * v, a[1] + uy * s + vy * v, a[2] + uz * s + vz * v); }
      }
      const over = []; let lo = 1e9, hi = -1e9, worst = -1, at = null;
      const tree = TREE.test(b.name); let ztop = -1e9, zlow = 1e9; if (tree) { for (let i = 1; i < loc.length; i += 3) { ztop = Math.max(ztop, loc[i]); zlow = Math.min(zlow, loc[i]); } }
      for (let inst = 0; inst < cnt; inst++) {
        const o = inst * 16;
        for (let i = 0; i < loc.length; i += 3) {
          const x = loc[i], y = loc[i + 1], z = loc[i + 2], X = M[o] * x + M[o + 4] * y + M[o + 8] * z + M[o + 12], Y = -(M[o + 2] * x + M[o + 6] * y + M[o + 10] * z + M[o + 14]), Z = M[o + 1] * x + M[o + 5] * y + M[o + 9] * z + M[o + 13];
          total++; const h = key(X, Y, Z);
          if (wanted[h]) { if (w === cap) { cap *= 2; const p2 = new Float32Array(cap * 3), n2 = new Int32Array(cap); p2.set(pts); n2.set(next); pts = p2; next = n2; } pts[w * 3] = X; pts[w * 3 + 1] = Y; pts[w * 3 + 2] = Z; next[w] = head[h]; head[h] = w; w++; }
          if (!soft && (total % 5) === 0 && !(tree && (y > zlow + (ztop - zlow) * 0.3 || Math.hypot(x, z) > 1.2 / sc))) { const d = Math.max(0, Math.min(3, Math.min(Q.nearest(Hs, C, X, Y, Z).d, Z - ground(X, Y)))); over.push(d); if (d > worst) { worst = d; at = [+X.toFixed(1), +Y.toFixed(1), +Z.toFixed(1)]; } }
          if (inst === 0) { lo = Math.min(lo, Z); hi = Math.max(hi, Z); }
        }
      }
      if (soft) { out.soft.push(b.name); continue; }
      over.sort((a, c) => a - c);
      out.kinds.push({ name: b.name, cnt, pts: over.length, p50: +over[over.length >> 1].toFixed(2), p95: +over[Math.floor(over.length * 0.95)].toFixed(2), max: +over[over.length - 1].toFixed(2), covered: +(over.filter((d) => d <= 0.32).length / over.length).toFixed(3), at, tall: +(hi - lo).toFixed(1) });
    }
    const near = (x, y, z) => { let best = 4; const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) { for (let i = head[key(X + a, Y + b, Z + c)]; i >= 0; i = next[i]) { const dx = pts[i * 3] - x, dy = pts[i * 3 + 1] - y, dz = pts[i * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < best) best = d; } } return Math.sqrt(best); };
    let open = 0, far = 0, natOpen = 0, natFar = 0; const bad = [], natBad = [];
    for (const F of faces) { const nat = isNatural(F.c), lim = nat ? 1.5 : 0.6; let f = 0; const n = F.list.length / 3; for (let i = 0; i < F.list.length; i += 3) if (near(F.list[i], F.list[i + 1], F.list[i + 2]) > lim) f++; if (nat) { natOpen += n; natFar += f; } else { open += n; far += f; } if (f / n > 0.25) { const c = F.c; (nat ? natBad : bad).push({ i: F.i, t: c.t, x: +c.x.toFixed(1), y: +c.y.toFixed(1), z: [+c.z0.toFixed(1), +c.z1.toFixed(1)], size: c.t === 'cyl' ? c.r : [c.hx, c.hy], share: +(f / n).toFixed(2), n }); } }
    out.natOpen = natOpen; out.natFar = natFar; out.natBadN = natBad.length; out.natBad = natBad.sort((a, b) => b.share * b.n - a.share * a.n).slice(0, 12);
    let topN = 0, topFar = 0; const air = []; for (const F of tops) { const lim = isNatural(F.c) ? 1.5 : 0.6; let f = 0; const n = F.list.length / 3; for (let i = 0; i < F.list.length; i += 3) if (near(F.list[i], F.list[i + 1], F.list[i + 2]) > lim) f++; topN += n; topFar += f; if (f / n > 0.25) { const c = F.c; air.push({ t: c.t, x: +c.x.toFixed(1), y: +c.y.toFixed(1), z: +c.z1.toFixed(1), size: c.t === 'cyl' ? c.r : [c.hx, c.hy], share: +(f / n).toFixed(2), n }); } }
    out.topN = topN; out.topFar = topFar; out.airN = air.length; out.air = air.sort((a, b) => b.share * b.n - a.share * a.n).slice(0, 8);
    out.open = open; out.far = far; out.bad = bad.sort((a, b) => b.share * b.n - a.share * a.n).slice(0, 12); out.badN = bad.length; out.total = total; out.kept = w; out.t = Math.round(performance.now() - t0); out.colliders = C.length;
    return out;
  }, [SOFT.source, NATURAL.source]);
  const fs = await import('fs'); fs.writeFileSync(`${W.out}/collide_kinds_${W.engine}.json`, JSON.stringify(r, null, 1));
  note(`the drawn surface: ${r.total} points sampled, ${r.kept} kept near colliders, ${r.t} ms; soft kinds, swum through on purpose: ${r.soft.join(' ')}`);
  const none = r.kinds.filter((k) => k.covered < 0.3 && k.tall > 1.2), over = r.kinds.filter((k) => k.p95 > 0.32 && !none.includes(k)).sort((a, b) => b.p95 - a.p95);
  line('A1k', none.length === 0, `nothing hard is drawn without a collider: ${none.length ? none.map((k) => `${k.name} x${k.cnt} ${k.tall} m tall, ${Math.round(k.covered * 100)}% covered, worst at ${k.at}`).join(' · ') : r.kinds.length + ' hard kinds, each with one'}`);
  line('A1v', over.length === 0, `the collider covers what you see: ${r.kinds.length - over.length - none.length} of ${r.kinds.length} hard kinds have 95% of their drawn surface within 0.32 m of a collider or the ground${over.length ? '; over: ' + over.slice(0, 10).map((k) => `${k.name} p95 ${k.p95} m, worst ${k.max} m at ${k.at}`).join(' · ') : ''}`);
  const share = r.open ? r.far / r.open : 1;
  const say2 = (l) => l.slice(0, 5).map((b) => `${b.t} ${JSON.stringify(b.size)} at (${b.x}, ${b.y}) z ${b.z[0]}..${b.z[1]}: ${Math.round(b.share * 100)}% of ${b.n}`).join(' · ');
  line('A2', r.badN === 0 && r.open > 1000, `no invisible walls, built things: ${r.open} points on open sides, ${(share * 100).toFixed(1)}% farther than 0.6 m from anything drawn; ${r.badN} colliders with over a quarter of their open side like that (0)${r.bad.length ? ': ' + say2(r.bad) : ''}`);
  line('A2n', r.natBadN === 0, `no invisible walls, natural shapes read by their mass (what a swimmer feels): ${r.natOpen} points, ${(r.natFar / Math.max(1, r.natOpen) * 100).toFixed(1)}% farther than 1.5 m from anything drawn, ours; ${r.natBadN} colliders with over a quarter of their open side like that (0)${r.natBad.length ? ': ' + say2(r.natBad) : ''}`);
  line('A2t', r.airN === 0 && r.topN > 100, `no standing on air: ${r.topN} points on the tops of solids, ${(r.topFar / Math.max(1, r.topN) * 100).toFixed(1)}% farther than 0.6 m from anything drawn; ${r.airN} solids with over a quarter of their top like that (0)${r.air.length ? ': ' + r.air.slice(0, 5).map((b) => `${b.t} ${JSON.stringify(b.size)} at (${b.x}, ${b.y}) top ${b.z}: ${Math.round(b.share * 100)}% of ${b.n}`).join(' · ') : ''}`);
  await close();
});
await finish();
