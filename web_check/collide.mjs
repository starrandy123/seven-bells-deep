// A1, A2d, A8, W14: collision, on the real rules (the solids against what's drawn, A1v, A1k, A2, A2n and A2t, are in drawn.mjs). Each charge is the Warden himself (hero.step, the real input path) at a real speed at one solid, and each charge has its
// own control: the same charge with that solid's collision off must get in. A charge whose control doesn't get in proves nothing (a neighbour stopped it) and isn't counted.
// Read at every step: the centre of his body against the solid's own shape, the whole path of the step, so a pass-through that ends outside is caught too.
//   node collide.mjs <base> <chromium|webkit> [--only=A1,A1c,A1air,A2d,A2dc,A8] [--stride=1]
import { gate, SMALL } from './lib/h.mjs';
const W = await gate('collide', { budget: 175 });
const { line, note, open, section, finish, flags } = W;
const stride = +(flags.stride || 1);

// the charge itself, in the page
const CHARGE = () => {
  const Q = window.__qa, G = window.__game, h = G.hero, C = G.world.data.colliders, ground = (x, y) => G.world.heightAt(x, y), STEP = 1 / 60;
  G.bot = null; Q.calm();
  // the path of one step against a solid: the deepest it got, sampled every 10 cm along the step
  const along = (c, a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.1)); let m = 1e9; for (let i = 0; i <= n; i++) { const t = i / n, d = Q.sd(c, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); if (d < m) m = d; } return m; };
  // a run: from where, heading, how; returns the deepest the centre of the body got into solid c (negative = inside) and the step that was
  const run = (c, s, off) => {
    c.off = !!off; const d = s.dir;
    if (s.mode === 'swim') { Q.swimAt(s.x, s.y, s.z, d[0] * s.v, d[1] * s.v, d[2] * s.v, s.surge); Q.aim(d[0], d[1], d[2]); Q.drive({ my: 1, mx: 0, ud: 0, boost: s.boost }); }
    else if (s.mode === 'land') { Q.walkAt(s.x, s.y, d[0] * s.v, d[1] * s.v, s.surge); Q.aim(d[0], d[1], 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: s.boost }); }
    else { Q.leapAt(s.x, s.y, s.z, d[0] * s.v, d[1] * s.v, s.vz); Q.aim(d[0], d[1], 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); }
    let deep = 1e9, at = -1, a = Q.where();
    for (let i = 0; i < s.n; i++) { h.step(STEP); const b = Q.where(); const m = along(c, a, b); if (m < deep) { deep = m; at = i; } a = b; }
    c.off = false; return { deep, at, end: a };
  };
  // the charges a solid gets: swim at it, walk at it, leap at it
  const D = G.world.data, X0 = D.origin[0] + 8, Y0 = D.origin[1] + 8, X1 = D.origin[0] + D.size_m - 8, Y1 = D.origin[1] + D.size_m - 8;     // a charge starts on the map: past its edge the current turns him back, and that isn't the solid's doing
  const Hs = Q.hash(C, 16), free = (x, y, z) => { if (x < X0 || x > X1 || y < Y0 || y > Y1) return false; const n = Q.nearest(Hs, C, x, y, z); return n.d > 0.8; };
  const plans = (c, i, heading) => {
    const out = [], r = Q.rad(c), a = heading, ax = Math.cos(a), ay = Math.sin(a), g0 = ground(c.x, c.y);
    const swimz = () => { const lo = Math.max(c.z0 + 0.2, g0 + 0.9), hi = Math.min(c.z1 - 0.2, -1.4); return lo <= hi ? (lo + hi) / 2 : null; };
    const z = swimz();
    if (z !== null) for (const [v, boost, surge, m] of [[48, true, 1, 18], [15.5, true, 0, 8], [7.5, false, 0, 6]]) {
      const D = r + m, x = c.x + ax * D, y = c.y + ay * D; if (ground(x, y) > z - 0.8 || !free(x, y, z)) continue;
      out.push({ mode: 'swim', v, boost, surge, x, y, z, dir: [-ax, -ay, 0], n: Math.ceil(D / (v * STEP)) + 14 });
    }
    if (g0 > -1.0 && c.z0 < g0 + 2.2 && c.z1 > g0 + 0.3) for (const [v, boost, surge, m] of [[36, true, 1, 14], [13, true, 0, 6], [7, false, 0, 4]]) {
      const D = r + m, x = c.x + ax * D, y = c.y + ay * D, g1 = ground(x, y); if (g1 < -1 || Math.abs(g1 - g0) > D * 0.8 || !free(x, y, g1 + 0.92)) continue;
      out.push({ mode: 'land', v, boost, surge, x, y, dir: [-ax, -ay, 0], n: Math.ceil(D / (v * STEP)) + 14 });
    }
    if (c.z1 > 1) { const zm = Math.max(0.6, Math.min(c.z1 - 0.3, (Math.max(c.z0, 0.3) + Math.min(c.z1, Math.max(g0, 0) + 3)) / 2)), D = r + 5, x = c.x + ax * D, y = c.y + ay * D, gs = Math.max(ground(x, y), 0);
      if (zm + 1.2 > gs + 1 && free(x, y, zm + 1.2)) out.push({ mode: 'air', v: 13, vz: 2, x, y, z: zm + 1.2, dir: [-ax, -ay, 0], n: Math.ceil(D / (13 * STEP)) + 10 }); }
    return out;
  };
  return { C, run, plans };
};

await section(['A1', 'A1c', 'A1air'], async () => {
  const { page, errors, close } = await open('?film&fresh&tier=phone', { ctx: SMALL });
  await W.gpu(page);
  const r = await page.evaluate(([src, stride]) => {
    const { C, run, plans } = (new Function('return (' + src + ')()'))();
    const Q = window.__qa, out = { solids: C.length, tried: {}, proved: {}, bad: {}, inn: {}, solids_bad: {}, never: 0, ms: 0, cases: [], ctlMiss: 0 }, t0 = performance.now();
    for (let i = 0; i < C.length; i += stride) {
      const c = C[i]; let any = false, got = false;
      const size = c.t === 'cyl' ? 'r ' + c.r : 'half ' + c.hx + ' x ' + c.hy;
      for (let k = 0; k < 8; k++) {
        const heading = (k * Math.PI) / 4 + 0.13;
        for (const s of plans(c, i, heading)) {
          any = true; const key = s.mode === 'air' ? 'air' : s.mode;
          out.tried[key] = (out.tried[key] || 0) + 1;
          const ctl = run(c, s, true);
          if (ctl.deep > -0.03) { out.ctlMiss++; continue; }     // a neighbour stopped it: this charge proves nothing
          got = true; out.proved[key] = (out.proved[key] || 0) + 1;
          const real = run(c, s, false);
          if (real.deep < 0.3) { out.bad[key] = (out.bad[key] || 0) + 1; if (real.deep < 0) out.inn[key] = (out.inn[key] || 0) + 1; (out.solids_bad[key] = out.solids_bad[key] || new Set()).add(i); out.cases.push({ i, t: c.t + ' ' + size, mode: s.mode, v: s.v, x: +c.x.toFixed(1), y: +c.y.toFixed(1), z: [+c.z0.toFixed(1), +c.z1.toFixed(1)], r: +Q.rad(c).toFixed(2), deep: +real.deep.toFixed(2), at: real.at, from: [+s.x.toFixed(1), +s.y.toFixed(1), +(s.z || 0).toFixed(1)], end: [+real.end.x.toFixed(1), +real.end.y.toFixed(1), +real.end.z.toFixed(1)] }); }
        }
      }
      if (any && !got) out.never++;
      if (out.cases.length > 6000) out.cases = out.cases.sort((a, b) => a.deep - b.deep).slice(0, 4000);
      if (performance.now() - t0 > 140000) { out.cut = i; break; }     // a cut fails A1: every solid gets its charges. The big map takes about 110 s here, and collide has a turn of the lock to itself
    }
    out.ms = performance.now() - t0; for (const k in out.solids_bad) out.solids_bad[k] = out.solids_bad[k].size; return out;
  }, [String(CHARGE), stride]);
  { const fs = await import('fs'); const by = {}; for (const c of r.cases) { const k = `${c.mode} ${c.v}`; by[k] = (by[k] || 0) + 1; } fs.writeFileSync(`${W.out}/collide_cases_${W.engine}.json`, JSON.stringify({ by, solids: r.solids, cases: r.cases }, null, 0)); note(`the cases kept, by how: ${JSON.stringify(by)}`); }
  const n = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const on = n(r.tried), pr = n(r.proved), ground = r.cases.filter((c) => c.mode !== 'air'), air = r.cases.filter((c) => c.mode === 'air'), nb = (r.bad.swim || 0) + (r.bad.land || 0), ni = (r.inn.swim || 0) + (r.inn.land || 0);
  const say = (l) => l.slice().sort((a, b) => a.deep - b.deep).slice(0, 5).map((c) => `${c.mode} ${c.v} m/s at the ${c.t} (${c.x}, ${c.y}) z ${c.z[0]}..${c.z[1]}: ${c.deep} m, step ${c.at}, from ${c.from}`).join(' · ');
  note(`solids ${r.solids}, stride ${stride}${r.cut !== undefined ? `, cut at ${r.cut} by the time limit` : ''}; ${on} charges, ${pr} proved by their control (${JSON.stringify(r.proved)}), ${r.ctlMiss} stopped by a neighbour with the solid off, ${r.never} solids no charge could reach; ${Math.round(r.ms / 1000)} s`);
  line('A1', pr > 200 && !(r.bad.swim || r.bad.land) && r.cut === undefined, `can't enter a solid swimming or on foot: ${pr - (r.proved.air || 0)} charges proved by their control; ${nb} put the centre of his body under 0.30 m from a solid's surface (0; his body's half width), ${ni} of them inside it, at ${(r.solids_bad.swim || 0) + (r.solids_bad.land || 0)} solids${ground.length ? '; deepest: ' + say(ground) : ''}`);
  line('A1air', !r.bad.air && (r.proved.air || 0) >= 20, `can't enter a solid in the air (leaping, jumping): ${r.proved.air || 0} charges proved by their control, ${r.bad.air || 0} got in${air.length ? '; deepest: ' + say(air) : ''}`);
  line('A1c', pr >= on * 0.3 && pr > 100, `the control: with the solid's own collision off, ${pr} of ${on} charges got inside (at least 30%): the check can fail`);
  if (errors.length) line('A1', false, `page errors in the charges: ${errors[0]}`);
  await close();
});

// A2d: every opening that looks open lets him through, on the real rules, with its control: the same swim through the solid beside it is stopped.
// The list comes from world.json's own `openings` when the world has one ({ x, y, z, dx, dy, side }: the middle, a half-length across it, a sideways step that lands on solid wall), else from the kit's arches and wall bays.
await section(['A2d', 'A2dc'], async () => {
  const { page, close } = await open('?film&fresh&tier=phone', { ctx: SMALL });
  const r = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, d = G.world.data, h = G.hero, out = { tried: 0, good: 0, bad: [], ctlTried: 0, ctlStopped: 0, ctlBad: [] }; G.bot = null;
    let list = d.openings;
    if (!list) { list = []; const I = d.instances;
      for (const [name, half, dz, side] of [['arch', 9, 6, 7.6], ['wall_bay', 2.6, 3.6, 4.6]]) { const L = I[name] || []; for (let k = 0; k < L.length; k += 6) { const [x, y, z, yaw, s] = L.slice(k, k + 5), sc = name === 'arch' ? s : 1, dx = Math.sin(yaw) * half * sc, dy = -Math.cos(yaw) * half * sc; list.push({ kind: name, x, y, z: z + dz * sc, dx, dy, sx: Math.cos(yaw) * side * sc, sy: Math.sin(yaw) * side * sc }); } } }
    const go = (x0, y0, z0, x1, y1, z1) => { const l = Math.hypot(x1 - x0, y1 - y0, z1 - z0), v = 7.5, e = [(x1 - x0) / l, (y1 - y0) / l, (z1 - z0) / l]; let land = G.world.heightAt(x0, y0) > -1.1;
      if (land) Q.walkAt(x0, y0, e[0] * 5, e[1] * 5); else Q.swimAt(x0, y0, z0, e[0] * v, e[1] * v, e[2] * v); Q.aim(e[0], e[1], land ? 0 : e[2]); Q.drive({ my: 1, mx: 0, ud: 0, boost: false });
      let best = 1e9; const n = Math.ceil((l / v) * 60) + 60; for (let i = 0; i < n; i++) { h.step(1 / 60); const p = Q.where(); const dd = Math.hypot(p.x - x1, p.y - y1); if (dd < best) best = dd; if (dd < 0.9) break; } return best; };
    for (const o of list) {
      out.tried++; const best = Math.min(go(o.x - o.dx * 1.6, o.y - o.dy * 1.6, o.z, o.x + o.dx * 1.6, o.y + o.dy * 1.6, o.z), go(o.x + o.dx * 1.6, o.y + o.dy * 1.6, o.z, o.x - o.dx * 1.6, o.y - o.dy * 1.6, o.z));
      if (best < 1.5) out.good++; else out.bad.push([o.kind, +o.x.toFixed(1), +o.y.toFixed(1), +o.z.toFixed(1), +best.toFixed(1)]);
      if (o.sx !== undefined) { out.ctlTried++; const b2 = go(o.x + o.sx - o.dx * 1.6, o.y + o.sy - o.dy * 1.6, o.z, o.x + o.sx + o.dx * 1.6, o.y + o.sy + o.dy * 1.6, o.z); if (b2 >= 1.5) out.ctlStopped++; else out.ctlBad.push([o.kind, +o.x.toFixed(1), +o.y.toFixed(1)]); }
    }
    return out;
  });
  line('A2d', r.tried >= 10 && r.good === r.tried, `through every opening on the real rules: ${r.good} of ${r.tried}${r.bad.length ? '; stopped: ' + r.bad.slice(0, 8).map((b) => `${b[0]} (${b[1]}, ${b[2]}) z ${b[3]}, ${b[4]} m short`).join(' · ') : ''}`);
  line('A2dc', r.ctlTried > 0 && r.ctlStopped >= r.ctlTried * 0.9, `the control: the same swim through the solid beside the opening is stopped: ${r.ctlStopped} of ${r.ctlTried} (at least 90%)${r.ctlBad.length ? '; through: ' + r.ctlBad.slice(0, 6).map((b) => b.join(' ')).join(' · ') : ''}`);
  await close();
});

// A8: the collider types follow the guidance: static solids are convex primitives from the world's file, each sound; nothing thinner than a step at top speed can be passed in one step.
await section(['A8'], async () => {
  const { page, close } = await open('?film&fresh&tier=phone', { ctx: SMALL });
  const r = await page.evaluate(() => {
    const C = window.__game.world.data.colliders, out = { n: C.length, kinds: {}, broken: [], thin: [], long: [] };
    for (const c of C) {
      out.kinds[c.t] = (out.kinds[c.t] || 0) + 1;
      const nums = c.t === 'cyl' ? [c.x, c.y, c.z0, c.z1, c.r] : [c.x, c.y, c.z0, c.z1, c.hx, c.hy, c.yaw || 0];
      if (!nums.every(Number.isFinite) || !(c.z1 > c.z0) || (c.t === 'cyl' ? c.r <= 0 : c.hx <= 0 || c.hy <= 0) || !['cyl', 'box'].includes(c.t)) out.broken.push(c);
      const least = c.t === 'cyl' ? Math.min(c.r, (c.z1 - c.z0) / 2) : Math.min(c.hx, c.hy, (c.z1 - c.z0) / 2);
      if (least < 0.18) out.thin.push([c.t, +c.x.toFixed(1), +c.y.toFixed(1), +least.toFixed(3)]);
      const a = c.t === 'cyl' ? Math.max(c.r / ((c.z1 - c.z0) / 2), (c.z1 - c.z0) / 2 / c.r) : Math.max(c.hx, c.hy, (c.z1 - c.z0) / 2) / Math.min(c.hx, c.hy, (c.z1 - c.z0) / 2);
      if (a > 40) out.long.push([c.t, +c.x.toFixed(1), +c.y.toFixed(1), +a.toFixed(0)]);
    }
    return out;
  });
  line('A8', r.broken.length === 0 && r.thin.length === 0 && r.n > 100, `colliders: ${JSON.stringify(r.kinds)}, every one a convex primitive; ${r.broken.length} broken (0); ${r.thin.length} with a half thickness under 0.18 m, which a body of 0.62 m at 48 m/s (0.8 m a step) can cross in one step (0)${r.thin.length ? ': ' + r.thin.slice(0, 5).map((t) => t.join(' ')).join(' · ') : ''}; ${r.long.length} longer than 40:1 (reported)`);
  await close();
});

await finish();
