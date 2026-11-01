// QS-B4, Q2, Q3, W17a: in play and at 48 m/s, upright: 3,600 frames each. Long frames (over 34 ms) at most 5%, hitches (over 50 ms) two at most for this Mac's own noise. Long Animation Frames in Chromium.
//   node pace.mjs <base> <chromium|webkit> [--only=B4p,B4s,B4l] [--secs=60]
import { gate, PHONE } from './lib/h.mjs';
import { INIT, STALLS, FIRSTS, stallsSay, stats, ms, read, run48, worstAt } from './lib/frames.mjs';
const W = await gate('pace', { budget: 170 });
const { line, note, open, section, finish, flags, engine } = W;
const SECS = +(flags.secs || 60);
await section(['B4p', 'B4s', 'B4l'], async () => {
  const { page, errors, close } = await open('?demo&fresh&tier=phone', { ctx: PHONE, init: INIT });
  await W.gpu(page); await page.evaluate(STALLS); await page.evaluate(FIRSTS); await page.waitForTimeout(1000);
  const a = await read(page, SECS), sa = stats(a.t, a.busy), st0 = await page.evaluate(() => window.__stalls.slice()), firsts = await page.evaluate(() => window.__firsts.slice()), drew = st0.map((x) => `at ${x.at} s: ${firsts.filter((f) => Math.abs(f.at - x.at) <= 0.3).map((f) => f.obj).slice(0, 4).join(', ') || 'nothing new drawn'}`).join(' · ');
  line('B4p', sa.long <= 0.05 && sa.over50 <= 2 && sa.worst <= 100, `in play, the bot driving: ${ms(sa)}; long ${(sa.long * 100).toFixed(2)}% (≤ 5%), hitches ${sa.over50} (≤ 2, each ≤ 100 ms: Q3 allows two for this Mac's noise, and 400 ms isn't noise); worst: ${worstAt(a.t)}; stalls over 100 ms: ${stallsSay(st0)}${drew ? `; drawn for the first time then: ${drew}` : ''}`);
  await page.evaluate(() => { window.__stalls.length = 0; }); const b = await run48(page, SECS), sb = stats(b.t, b.busy), st = await page.evaluate(() => { const G = window.__game; return G.world.stats ? G.world.stats() : {}; }), st1 = await page.evaluate(() => window.__stalls.slice());
  line('B4s', sb.long <= 0.05 && sb.over50 <= 2 && sb.worst <= 100 && b.maxV >= 40 && b.dist > 400 && b.meanV >= 30, `the run at ${b.meanV.toFixed(0)} m/s (top ${b.maxV.toFixed(0)}), ${Math.round(b.dist)} m along the longest open water, ${b.turns} turns: ${ms(sb)}; long ${(sb.long * 100).toFixed(2)}% (≤ 5%), hitches ${sb.over50} (≤ 2, W17a); worst: ${worstAt(b.t)}; stalls over 100 ms: ${stallsSay(st1)}; streaming ${JSON.stringify(st)}`);
  if (engine === 'chromium') { const l = b.loaf.concat(a.loaf).filter((x) => x[1] > 50); line('B4l', l.length <= 2 && l.every((x) => x[1] <= 100), `Long Animation Frames over 50 ms: ${l.length} (≤ 2, each ≤ 100 ms, the standard's zero with room for this Mac's own noise)${l[0] ? ': ' + l.slice(0, 5).map((x) => `${x[1]} ms${x[2] ? ' (' + x[2] + ')' : ''}`).join(' · ') : ''}`); }
  else line('B4l', true, 'WebKit has no Long Animation Frames: read by its frame gaps, B4p and B4s');
  if (errors.length) line('F1c', false, `errors in the runs: ${errors[0]}`);
  await close();
});
await finish();
