// The first boot on a machine that has never seen these shaders. macOS keeps compiled shaders: a warm boot here takes about 1 s, a cold one about 7, so every other wall reads a warm start a player's first visit never has (look's drive, scratchpad q24/desk.mjs, 1 Nov).
// A new number goes in the live shader code, where the compiler can't strip it, so no cache anywhere holds these programs. The page boots, Dive is pressed, and the wall reads the stall after Dive and the whole seconds at 0-1 frames.
// B4c: the platform's desktop pass: the desktop tier, in a frame, 1280 x 800. B4cp: a phone's size, the phone tier. Bounds, ours: no stall over 1,000 ms after Dive (look's fix reads 0.57-0.60 s, the old code 3.1-3.4 s), at most 1 whole second at 0-1 frames.
// B4cc: the control: the same page again, the same number: it must boot faster, or the number never reached a cache. The time to the page's `ok` is printed, not bounded: that cold stall stays open with look.
//   node cold.mjs <base> <chromium|webkit> [--only=B4c,B4cp,B4cc,B4pc]
import { gate, PHONE } from './lib/h.mjs';
import { INIT, STALLS, FIRSTS, stallsSay, stats, ms, read } from './lib/frames.mjs';
const W = await gate('cold', { budget: 170 });
const { line, note, open, section, finish, engine, base } = W;
const TICKS = `window.__ticks = []; (function t() { window.__ticks.push(performance.now()); requestAnimationFrame(t); })();`;
const OLD_A = 'vec3 ocApply(vec3 col, vec3 P) {', OLD_B = /vec3 ocScatter\(vec3 rd, float d0, float len\) \{/;
const cold = (nonce, seen) => (page) => page.route('**/js/look.js', async (r) => { const res = await r.fetch(); let t = await res.text(); const n0 = t.length; t = t.replace(OLD_A, `${OLD_A} col *= 1.0 + 1e-7*sin(P.x*${nonce});`).replace(OLD_B, `vec3 ocScatter(vec3 rd, float d0, float len) { len *= 1.0 + 1e-7*sin(rd.x*${nonce});`); seen.bytes = t.length - n0; await r.fulfill({ response: res, body: t }); });
const host = (src, w, h) => `<!doctype html><body style="margin:20px;background:#111"><iframe id=f src="${src}" style="width:${w}px;height:${h}px;border:0" allow="autoplay"></iframe></body>`;
const nonceOf = (k) => (1 + ((Date.now() + k * 977) % 100000) / 7).toFixed(4);

// one boot: the time to ok, then Dive, then 6 s of frames
async function bootOnce({ nonce, framed, ctx, q }) {
  const seen = { bytes: 0 }, hostUrl = base.replace(/index\.html.*$/, '__host.html'), src = base + q;
  const p = await open(q, { ctx, wait: false, seedIt: false, init: TICKS, url: framed ? hostUrl : null, route: async (page) => { await cold(nonce, seen)(page); if (framed) await page.route('**/__host.html', (r) => r.fulfill({ contentType: 'text/html', body: host(src, 1280, 800) })); } });
  const frame = () => (framed ? p.page.frames().find((f) => f.url().includes('index.html')) : p.page.mainFrame());
  const t0 = Date.now(); let ok = false;
  while (Date.now() - t0 < 40000) { const f = frame(); if (f && await f.evaluate(() => !!(window.__MOSA_BOOT && window.__MOSA_BOOT.ok === true)).catch(() => false)) { ok = true; break; } await p.page.waitForTimeout(100); }
  const okMs = Date.now() - t0; if (!ok) { await p.close(); return { ok, okMs, bytes: seen.bytes }; }
  await p.page.waitForTimeout(600);
  const f = frame(), tp = await f.evaluate(() => { const t = performance.now(); const d = document.getElementById('dive'); if (d) d.click(); return t; });
  await p.page.waitForTimeout(6000);
  const r = await f.evaluate((tp) => { const l = window.__ticks.filter((t) => t >= tp - 20), gaps = []; for (let i = 1; i < l.length; i++) gaps.push(l[i] - l[i - 1]); const per = {}; for (const t of l) { const s = Math.floor((t - tp) / 1000); per[s] = (per[s] || 0) + 1; } const low = []; for (let s = 0; s < 6; s++) if ((per[s] || 0) <= 1) low.push(s); return { stall: gaps.length ? Math.max(...gaps) : 1e9, frames: l.length, low, tier: window.__game.tier, started: window.__game.started }; }, tp);
  await p.close(); return { ok, okMs, bytes: seen.bytes, ...r };
}
const say = (r) => (r.ok ? `the page's ok at ${r.okMs} ms (printed, not bounded); after Dive the longest stall ${Math.round(r.stall)} ms (≤ 1,000), ${r.low.length} whole seconds at 0-1 frames (≤ 1), ${r.frames} frames in 6 s, tier ${r.tier}` : `no ok in ${r.okMs} ms`);
await section(['B4c', 'B4cc'], async () => {
  const n = nonceOf(1), a = await bootOnce({ nonce: n, framed: true, ctx: { viewport: { width: 1320, height: 840 }, deviceScaleFactor: 1 }, q: '?fresh&tier=desktop' });
  if (!a.bytes) { line('B4c', false, `no reading: the new number never went into the shader code: look.js has changed, rewrite the wall`); line('B4cc', false, 'no reading'); return; }
  line('B4c', a.ok && a.started && a.stall <= 1000 && a.low.length <= 1, `a cold first boot, the platform's desktop pass: ${say(a)}`);
  const b = await bootOnce({ nonce: n, framed: true, ctx: { viewport: { width: 1320, height: 840 }, deviceScaleFactor: 1 }, q: '?fresh&tier=desktop' });
  line('B4cc', a.ok && b.ok && a.okMs > b.okMs * 1.15, `the control: the same number again boots faster, so the first was cold: ${a.okMs} ms, then ${b.okMs} ms (at least 15% faster); warm, the stall after Dive is ${Math.round(b.stall || 0)} ms`);
});
await section(['B4cp'], async () => {
  const a = await bootOnce({ nonce: nonceOf(2), framed: false, ctx: PHONE, q: '?fresh&tier=phone' });
  line('B4cp', a.ok && a.started && a.stall <= 1000 && a.low.length <= 1, `a cold first boot at a phone's size on this Mac: ${say(a)}. A phone's own compile times are owed to a real iPhone`);
});
// B4pc: Q3 on a first visit. The bot's first minute on a cache that's never seen these shaders. Every other frame wall reads a warm cache, and a player's first minute isn't one: round 6's stall at 59.5 s showed in WebKit and in Chromium's first read, and not on Chromium's second. Each stall over 100 ms prints what was drawn for the first time within 0.3 s of it.
await section(['B4pc'], async () => {
  const seen = { bytes: 0 }, { page, errors, close } = await open('?demo&fresh&tier=phone', { ctx: PHONE, init: INIT, route: cold(nonceOf(3), seen) });
  if (!seen.bytes) { line('B4pc', false, 'no reading: the new number never went into the shader code: look.js has changed, rewrite the wall'); await close(); return; }
  await page.evaluate(STALLS); await page.evaluate(FIRSTS); await page.waitForTimeout(1000);
  const a = await read(page, 60), s = stats(a.t, a.busy), r = await page.evaluate(() => ({ stalls: window.__stalls.slice(), firsts: window.__firsts.slice() }));
  const by = r.stalls.map((x) => `at ${x.at} s: ${r.firsts.filter((f) => Math.abs(f.at - x.at) <= 0.3).map((f) => f.obj).slice(0, 4).join(', ') || 'nothing new drawn'}`).join(' · ');
  line('B4pc', s.worst <= 100 && r.stalls.every((x) => x.ms <= 100), `the bot's first minute on a cold cache (Q3 on a first visit, each frame ≤ 100 ms): ${ms(s)}; stalls: ${stallsSay(r.stalls)}${by ? `; drawn for the first time then: ${by}` : ''}; ${r.firsts.filter((f) => f.at > 5).length} draw states new after 5 s of play, the last ${(r.firsts[r.firsts.length - 1] || {}).obj} at ${(r.firsts[r.firsts.length - 1] || {}).at} s`);
  await close();
});
await finish();
