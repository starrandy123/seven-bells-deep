// QS-B3, QS-B5, Q1, Q4, Q7, Q8: a phone's size (390 x 844 at 3x, the phone tier), the real frame loop on this Mac's GPU, in ms with the count. The world's own places; the heaviest held for 60 s, 3,600 frames. A real iPhone is owed: this is a Mac's GPU at a phone's size.
// pace.mjs reads play and the run at 48 m/s, turned.mjs the turned phone, lowpower.mjs the 30 Hz of an iPhone in Low Power Mode.
//   node perf.mjs <base> <chromium|webkit> [--only=B3,B3j,B4,B5,B5t,B4i,B3d,F1b] [--secs=60]
import { gate, PHONE, pct } from './lib/h.mjs';
import { packs, INIT, stats, ms, work, read, places, hold } from './lib/frames.mjs';
import fs from 'fs';
const W = await gate('perf', { budget: 170 });
const { line, note, open, section, finish, flags, engine, out } = W;
const SECS = +(flags.secs || 60);
const { page, errors, close } = await open('?demo&fresh&tier=phone', { ctx: PHONE, init: INIT });
await W.gpu(page); await page.waitForTimeout(800);
const packsIn = await packs(page); note(`region packs: ${packsIn}`);
let spots = [];
await section(['B5', 'B5t', 'B3', 'B3j', 'B4'], async () => {
  if (/NOT IN/.test(packsIn)) line('B5', false, 'no reading: the region packs never finished, so the scene is lighter than a player gets');
  spots = await places(page);
  const top = spots.slice().sort((a, b) => b.calls - a.calls)[0], topT = spots.slice().sort((a, b) => b.tris - a.tris)[0];
  line('B5', top.calls <= 100, `draw calls at ${spots.length} of the world's places: at most ${top.calls} at ${top.name} (≤ 100, Q7); ${spots.map((s) => s.calls).join(' ')}`);
  line('B5t', topT.tris <= 5e5, `triangles a frame: at most ${Math.round(topT.tris / 1000)}k at ${topT.name} (≤ 500k, Q8, TBR on the iPhone baseline; objective 325k)`);
  const heavy = spots.slice().sort((a, b) => b.tris + b.calls * 3000 - a.tris - a.calls * 3000)[0];
  await hold(page, heavy); const r = await read(page, SECS), s = stats(r.t, r.busy);
  await page.screenshot({ path: `${out}/perf_heaviest_${engine}.jpg`, type: 'jpeg', quality: 70 });
  fs.writeFileSync(`${out}/perf_frames_${engine}.json`, JSON.stringify({ heavy, spots, s }, null, 1));
  line('B3', s.iqm <= 16.95 && s.p95 <= 33.4 && s.n >= SECS * 55, `the heaviest place (${heavy.name}) at ${r.w} x ${r.h}, pixel ratio ${r.pr.toFixed(2)}: ${ms(s)} (the middle half's mean ≤ 16.95, 59 fps, Q1, X3; p95 ≤ 33.3). A median on a 60 Hz display shows no headroom`);
  line('B3j', s.b95 <= 11, `frame work there, update plus render submit: ${work(s)} (p95 ≤ 11, Q4)`);
  line('B4', s.long <= 0.05 && s.over50 <= 2 && s.worst <= 100, `long frames there (over 34 ms): ${(s.long * 100).toFixed(2)}% of ${s.n} (≤ 5%, Q2), hitches over 50 ms: ${s.over50} (≤ 2, Q3)`);
});
await section(['B4i'], async () => {
  const r = await page.evaluate(async () => {
    const out = []; const hit = async (el) => { const t0 = performance.now(); el.click(); await new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d))); return performance.now() - t0; };
    for (let i = 0; i < 6; i++) { out.push(await hit(document.getElementById('pauseB'))); await new Promise((d) => setTimeout(d, 60)); const t0 = performance.now(); document.getElementById('resume').click(); await new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d))); out.push(performance.now() - t0); await new Promise((d) => setTimeout(d, 60)); }
    return { out, ev: (window.__ev || []).map((e) => e[1]) };
  });
  const worst = Math.max(...r.out, ...(r.ev.length ? r.ev : [0]));
  line('B4i', worst <= 200, `a tap answered: pause and resume ${r.out.length} times, the next painted frame at worst ${worst.toFixed(0)} ms (≤ 200, INP's good)`);
});
await section(['F1b'], async () => { line('F1b', errors.length === 0, `no errors in the frame runs: ${errors.length}${errors[0] ? ': ' + errors[0] : ''}`); });
await close();
await section(['B3d'], async () => {
  const d = await open('?demo&fresh&tier=desktop', { ctx: { viewport: { width: 1280, height: 720 } }, init: INIT });
  await d.page.waitForTimeout(800); const r = await read(d.page, 15), s = stats(r.t, r.busy);
  line('B3d', s.iqm <= 16.95 && s.p95 <= 33.4, `the desktop tier at 1280 x 720: ${ms(s)} (the middle half's mean ≤ 16.95, p95 ≤ 33.3)`);
  await d.close();
});
await finish();
