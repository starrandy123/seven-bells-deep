// A6: the same input at any screen rate: 30, 60, 90, 120, 144 Hz through the game's own frame loop. A6d: what's drawn moves evenly at the stamps real screens hand a page, and after a hitch.
// A7: slopes and steps in a code-only test room: the ground under him is swapped for a ramp or a step, the rest is the real hero. As the standard asks, the room passes or fails by the game's own setting: hero.js's TAN_CLIMB, 42°: 20, 35, 41 climb, 45 and 55 don't. Steps, ours from the standard's list: 0.10, 0.25, 0.40 m climb, 0.60 doesn't, at a run, a sprint and super speed alike.
//   node rates.mjs <base> <chromium|webkit> [--only=A6,A6j,A6d,A7,A7s]
import { gate, SMALL } from './lib/h.mjs';
const W = await gate('rates', { budget: 150 });
const { line, note, open, section, finish } = W;

await section(['A6', 'A6j'], async () => {
  const ends = [];
  for (const hz of [30, 60, 90, 120, 144]) {
    const { page, close } = await open('?film&fresh&tier=phone', { ctx: SMALL });
    ends.push(await page.evaluate((hz) => {
      const Q = window.__qa, G = window.__game, h = G.hero; Q.start(); G.bot = null; G.time = 0; const w = Q.openWater(90), run = (sec) => { const n = Math.round(sec * hz); for (let i = 0; i < n; i++) G.frame(1 / hz); };
      let apex = -1e9; const step = h.step; h.step = (d) => { step(d); apex = Math.max(apex, h.pos.y); };
      Q.swimAt(w.x, w.y, w.z); Q.aim(w.ax, w.ay, 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); run(2); Q._wish.boost = true; run(2); Q._wish.boost = false; Q._wish.my = 0; run(1);
      const swim = Q.where(), d0 = Math.hypot(swim.x - w.x, swim.y - w.y);
      // on foot: the longest flat of the first beach, walk, sprint, a jump
      const L = G.world.data.land || [], b = L[0] || G.world.data.spawn; let best = 0, ax = 1, ay = 0; for (let a = 0; a < 16; a++) { const cx = Math.cos(a * 0.3927), cy = Math.sin(a * 0.3927); let run2 = 0; for (let t = 2; t < 60; t += 2) { const g = G.world.heightAt(b.x + cx * t, b.y + cy * t); if (g > -0.2 && g < 14) run2 = t; else break; } if (run2 > best) { best = run2; ax = cx; ay = cy; } }
      Q.walkAt(b.x, b.y); Q.aim(ax, ay, 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); run(1); Q._wish.boost = true; run(1); apex = -1e9; Q._wish.jump = true; run(1.2); const ap = apex - G.world.heightAt(h.pos.x, -h.pos.z); Q._wish.my = 0; Q._wish.boost = false; run(0.5);
      const land = Q.where(); return { hz, swim, d0, land, ap, apexY: apex };
    }, hz));
    await close();
  }
  const sp = (k) => Math.max(...ends.map((e) => e[k.split('.')[0]][k.split('.')[1]])) - Math.min(...ends.map((e) => e[k.split('.')[0]][k.split('.')[1]]));
  const s = Math.max(sp('swim.x'), sp('swim.y'), sp('swim.z')), l = Math.max(sp('land.x'), sp('land.y'), sp('land.z')), path = ends[0].d0;
  line('A6', s <= path * 0.01 && l <= 0.3, `the same input at 30, 60, 90, 120, 144 Hz: a ${path.toFixed(0)} m swim ends ${s.toFixed(3)} m apart at worst (≤ 1%, ${(path * 0.01).toFixed(2)} m), on foot ${l.toFixed(3)} m (≤ 0.30)`);
  const ap = ends.map((e) => e.apexY), spread = Math.max(...ap) - Math.min(...ap), hi = Math.max(...ends.map((e) => e.ap));
  line('A6j', spread <= Math.max(0.02, Math.abs(hi) * 0.01) + 0.02, `the jump's top at each rate: ${ap.map((a) => a.toFixed(3)).join(' / ')} (spread ${spread.toFixed(3)} m, ≤ 1% of its height + 2 cm)`);
});

await section(['A6d'], async () => {
  const { page, close } = await open('?film&fresh&tier=phone', { ctx: SMALL });
  const r = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero; Q.start(); G.bot = null; const w = Q.openWater(120, 18), out = [];
    const stampsOf = (hz, n, hitchAt = -1) => { const s = []; let t = 0; for (let i = 0; i < n; i++) { t += 1000 / hz; if (i === hitchAt) t += 33.4; s.push(Math.round(t * 10) / 10); } return s; };
    for (const [name, hz, hitch] of [['30', 30, -1], ['60', 60, -1], ['59.94', 59.94, -1], ['90', 90, -1], ['120', 120, -1], ['144', 144, -1], ['60 after a hitch', 60, 90], ['120 after a hitch', 120, 150]]) {
      Q.swimAt(w.x, w.y, w.z, w.ax * 7.5, w.ay * 7.5, 0); Q.aim(w.ax, w.ay, 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 30; i++) G.frame(1 / 60);
      const st = stampsOf(hz, Math.round(hz * 3), hitch); let worst = 0, at = 0, p0 = h.drawPos.clone(), sum = 0, cnt = 0;
      for (let i = 1; i < st.length; i++) { const dt = (st[i] - st[i - 1]) / 1000; G.frame(dt); const m = h.drawPos.distanceTo(p0), want = h.vel.length() * dt; p0.copy(h.drawPos); if (i < 6) continue; const e = Math.abs(m / want - 1); if (e > worst) { worst = e; at = i; } sum += e; cnt++; }
      out.push({ name, worst, at, mean: sum / cnt });
    }
    return out;
  });
  const bad = r.filter((x) => x.worst > 0.02);
  line('A6d', bad.length === 0, `what's drawn moves evenly: a frame's drawn move against speed × its own time, worst ${r.map((x) => `${x.name}: ${(x.worst * 100).toFixed(1)}%`).join(', ')} (≤ 2%)`);
  await close();
});

await section(['A7', 'A7s'], async () => {
  const { page, close } = await open('?film&fresh&tier=phone', { ctx: SMALL });
  const r = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, W = G.world; Q.start(); G.bot = null; const realH = W.heightAt, realC = W.collide, X0 = 100, Y0 = 100, Z0 = 6;
    let shape = () => 0;
    W.heightAt = (x, y) => Z0 + shape(x - X0);
    W.collide = (p, r) => { const f = W.heightAt(p.x, p.y) + r; if (p.z < f) { p.z = f; return true; } return false; };   // the room has one solid: its floor
    const go = (fn, speed, boost, surge, far) => { shape = fn; const out = { far: -1e9, back: 0, pop: 0, end: 0 }; Q.walkAt(X0 - 8, Y0, speed, 0, surge); Q.aim(1, 0, 0); Q.drive({ my: 1, mx: 0, ud: 0, boost }); let last = Q.where(), dir = 0;
      for (let i = 0; i < 420; i++) { h.step(1 / 60); const p = Q.where(), dx = p.x - last.x; out.far = Math.max(out.far, p.x - X0); out.back = Math.max(out.back, last.x - p.x); out.pop = Math.max(out.pop, Math.abs(p.z - last.z)); last = p; if (p.x - X0 > far) break; } out.end = last.x - X0; return out; };
    const ramp = (deg) => { const t = Math.tan((deg * Math.PI) / 180), top = 8; return (x) => (x <= 0 ? 0 : Math.min(top, x * t)); };
    const step = (s) => (x) => (x <= 0 ? 0 : s);
    const speeds = [['run', 7, false, 0], ['sprint', 13, true, 0], ['super', 36, true, 1]];
    const res = { ramps: [], steps: [] };
    for (const [deg, want] of [[20, true], [35, true], [41, true], [45, false], [55, false]]) for (const [nm, v, b, su] of speeds) { const top = 8 / Math.tan((deg * Math.PI) / 180), o = go(ramp(deg), v, b, su, top + 3); res.ramps.push({ deg, nm, want, got: o.far > top + 1, far: +o.far.toFixed(1), top: +top.toFixed(1), back: +o.back.toFixed(3) }); }
    for (const [s, want] of [[0.1, true], [0.25, true], [0.4, true], [0.6, false]]) for (const [nm, v, b, su] of speeds) { const o = go(step(s), v, b, su, 3); res.steps.push({ s, nm, want, got: o.far > 1, far: +o.far.toFixed(2), back: +o.back.toFixed(3) }); }
    W.heightAt = realH; W.collide = realC; return res;
  });
  const bad = r.ramps.filter((x) => x.got !== x.want), jitter = r.ramps.filter((x) => x.back > 0.2), sb = r.steps.filter((x) => x.got !== x.want);
  line('A7', bad.length === 0 && jitter.length === 0, `slopes in the test room, ${r.ramps.length} runs at run, sprint and super: 20, 35, 41° climbed, 45, 55° refused (hero.js's own 42°): ${bad.length} wrong${bad.length ? ': ' + bad.slice(0, 6).map((x) => `${x.deg}° at a ${x.nm} ${x.got ? 'climbed' : `stopped ${x.far} m of ${x.top}`}`).join(' · ') : ''}; ${jitter.length} thrown back over 0.2 m in a step (0)${jitter[0] ? ': ' + JSON.stringify(jitter[0]) : ''}`);
  line('A7s', sb.length === 0, `steps in the test room, ${r.steps.length} runs: 0.10, 0.25, 0.40 m climbed, 0.60 m refused, at every speed alike: ${sb.length} wrong${sb.length ? ': ' + sb.slice(0, 7).map((x) => `${x.s} m at a ${x.nm} ${x.got ? 'climbed' : 'refused'}`).join(' · ') : ''}`);
  await close();
});
await finish();
