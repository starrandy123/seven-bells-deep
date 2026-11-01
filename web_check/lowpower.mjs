// What an iPhone in Low Power Mode gives a page: requestAnimationFrame at 30 Hz ([WebKitLPM]). The stand-in: the page's frames handed over every other display frame, and in Chromium a 4x slower CPU as well (WebKit has no throttle here). A real iPhone in Low Power Mode is owed (Q12).
// B3l: 30 Hz holds: frames near 33.3 ms, no hitches. B3c: the game keeps real time: the rules aren't in slow motion: a second of clock is a second. B3e: a swim covers the same ground in the same time as at 60 Hz, within a step. C1l: a press still lands.
//   node lowpower.mjs <base> <chromium|webkit> [--only=B3l,B3c,B3e,C1l] [--secs=30]
import { gate, PHONE } from './lib/h.mjs';
import { packs, INIT, stats, ms } from './lib/frames.mjs';
const W = await gate('lowpower', { budget: 170 });
const { line, note, open, section, finish, flags, engine } = W;
const SECS = +(flags.secs || 40);
const HALF = `(() => { const raf = window.requestAnimationFrame.bind(window); let odd = false, q = []; const pump = (t) => { odd = !odd; if (!odd) { const l = q; q = []; for (const cb of l) cb(t); } raf(pump); }; raf(pump); window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; }; })();`;
const swim = (page, secs) => page.evaluate(async (secs) => { const Q = window.__qa, G = window.__game, w = Q.openWater(120, 14); G.bot = null; Q.calm(); Q.swimAt(w.x, w.y, w.z, w.ax * 7.5, w.ay * 7.5, 0); Q.aim(w.ax, w.ay, 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); const a = Q.where(), t0 = performance.now(), g0 = G.time; await new Promise((d) => setTimeout(d, secs * 1000)); const b = Q.where(); return { m: Math.hypot(b.x - a.x, b.y - a.y), wall: (performance.now() - t0) / 1000, clock: G.time - g0 }; }, secs);
await section(['B3l', 'B3c', 'B3e', 'C1l'], async () => {
  const fast = await open('?film&fresh&tier=phone', { ctx: PHONE, init: INIT }); await fast.close();
  const n = await open('?fresh&tier=phone', { ctx: PHONE, init: INIT }); await n.page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }); await n.page.tap('#dive').catch(() => n.page.click('#dive')); await n.page.waitForTimeout(500);
  const at60 = await swim(n.page, 4); await n.close();
  const p = await open('?fresh&tier=phone', { ctx: PHONE, init: [HALF, INIT] });
  await W.gpu(p.page);
  if (engine === 'chromium') { const c = await p.ctx.newCDPSession(p.page); await c.send('Emulation.setCPUThrottlingRate', { rate: 4 }); note('Chromium: a 4x slower CPU as well'); } else note('WebKit: no CPU throttle here: 30 Hz alone');
  await p.page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 30000 }); await p.page.tap('#dive').catch(() => p.page.click('#dive')); await p.page.waitForTimeout(500); note(`region packs: ${await packs(p.page)}`);
  const r = await p.page.evaluate(async (secs) => { window.__busy.length = 0; const Q = window.__qa, G = window.__game, g0 = G.time, w0 = performance.now(), t = await new Promise((done) => { const t = []; let last = performance.now(); const f = (now) => { const n = performance.now(); t.push(n - last); last = n; if (n - w0 < secs * 1000) requestAnimationFrame(f); else done(t); }; requestAnimationFrame(f); }); return { t, busy: window.__busy.slice(), clock: G.time - g0, wall: (performance.now() - w0) / 1000 }; }, SECS);
  const s = stats(r.t, r.busy);
  line('B3l', s.iqm <= 34.5 && s.p95 <= 50 && s.over50 <= 2, `at 30 Hz${engine === 'chromium' ? ' on a 4x slower CPU' : ''}: ${ms(s)} (the middle half's mean ≤ 34.5, p95 ≤ 50; hitches over 50 ms ${s.over50}, ≤ 2)`);
  const ratio = r.clock / r.wall;
  line('B3c', Math.abs(ratio - 1) <= 0.03, `the game keeps real time at 30 Hz: ${r.clock.toFixed(2)} s of its clock in ${r.wall.toFixed(2)} s (within 3%): not slow motion`);
  const at30 = await swim(p.page, 4), d = Math.abs(at30.m / at30.wall - at60.m / at60.wall) / (at60.m / at60.wall);
  line('B3e', d <= 0.03, `a swim is as far at 30 Hz: ${(at30.m / at30.wall).toFixed(2)} m/s against ${(at60.m / at60.wall).toFixed(2)} m/s at 60 Hz (within 3%)`);
  const hit = await p.page.evaluate(async () => { const G = window.__game, b = document.querySelector('#bAtk'), r = b.getBoundingClientRect(), o = { pointerId: 71, pointerType: 'touch', clientX: r.left + 9, clientY: r.top + 9, bubbles: true, cancelable: true }; let got = 0; const was = G.hero.state, t0 = performance.now(); b.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1 })); b.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 })); while (performance.now() - t0 < 400) { if (G.hero.state === 'attack') { got = performance.now() - t0; break; } await new Promise((d) => setTimeout(d, 5)); } return { got, was }; });
  line('C1l', hit.got > 0 && hit.got <= 120, `a press lands at 30 Hz: Strike is in its blow ${hit.got.toFixed(0)} ms after the press (≤ 120: two frames)`);
  await p.close();
});
await finish();
