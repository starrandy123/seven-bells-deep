// Q1, Q2, Q3, W17a, turned: 844 x 390, the same reading: the view is wider, so more of the world is drawn (720-890k triangles were read turned, before far-cell thinning).
//   node turned.mjs <base> <chromium|webkit> [--only=B3t,B5tt,B4t,B4st] [--secs=45]
import { gate, PHONE } from './lib/h.mjs';
import { packs, INIT, stats, ms, read, places, hold, run48 } from './lib/frames.mjs';
const W = await gate('turned', { budget: 170 });
const { line, note, open, section, finish, flags } = W;
const SECS = +(flags.secs || 60);
await section(['B5tt', 'B3t', 'B4t', 'B4st'], async () => {
  const { page, close } = await open('?demo&fresh&tier=phone', { ctx: { ...PHONE, viewport: { width: 844, height: 390 } }, init: INIT });
  await W.gpu(page); await page.waitForTimeout(800); note(`region packs: ${await packs(page)}`);
  const spots = await places(page), top = spots.slice().sort((a, b) => b.tris - a.tris)[0], calls = spots.slice().sort((a, b) => b.calls - a.calls)[0];
  line('B5tt', top.tris <= 5e5 && calls.calls <= 100, `turned, at ${spots.length} places: at most ${Math.round(top.tris / 1000)}k triangles at ${top.name} (≤ 500k, Q8), ${calls.calls} draws at ${calls.name} (≤ 100)`);
  await hold(page, top); const r = await read(page, SECS), s = stats(r.t, r.busy);
  line('B3t', s.iqm <= 16.95 && s.p95 <= 33.4, `turned at the heaviest place (${top.name}), ${r.w} x ${r.h}: ${ms(s)} (the middle half's mean ≤ 16.95, p95 ≤ 33.3)`);
  line('B4t', s.long <= 0.05 && s.over50 <= 2 && s.worst <= 100, `turned there: long ${(s.long * 100).toFixed(2)}% (≤ 5%), hitches ${s.over50} (≤ 2)`);
  const b = await run48(page, SECS), sb = stats(b.t, b.busy);
  line('B4st', sb.long <= 0.05 && sb.over50 <= 2 && sb.worst <= 100 && b.maxV >= 40 && b.dist > 400 && b.meanV >= 30, `turned, the run at ${b.meanV.toFixed(0)} m/s, ${Math.round(b.dist)} m: ${ms(sb)}; long ${(sb.long * 100).toFixed(2)}%, hitches ${sb.over50} (W17a)`);
  await close();
});
await finish();
