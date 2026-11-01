// B5l, F1, F2s: a long session. The bot plays and a seeded monkey throws keys, taps, drags, pauses, the panel and turns of the phone at it. The clock is stepped so a run of the lock covers more minutes of play, and every frame is drawn, because leaks are in what's drawn.
// Read every 30 s of play: the renderer's geometries, textures and programs, the scene's objects, the script heap after a collection (Chromium). Bound: growth over 10% after a 3-minute warm-up: round 5's rows went 18 to 29 textures by 181 s, then flat for 830 s, so a first minute's warm-up read first uses as a leak. F1: not one pageerror, console.error, crash, failed file.
//   node soak.mjs <base> <chromium|webkit> [--only=F1,B5l,B5h] [--secs=130] [--seed=n]
import { gate } from './lib/h.mjs';
import fs from 'fs';
const W = await gate('soak', { budget: 175 });
const { line, note, open, section, finish, flags, engine, seed, out } = W;
const secs = +(flags.secs || 130);
const TALLY = '/Users/randy/Documents/ports_src/_kit/weigh_tally.js';
await section(['F1', 'B5l', 'B5h', 'B5o', 'Q6'], async () => {
  const { page, errors, close } = await open('?demo&film&fresh&tier=phone', { ctx: { viewport: { width: 390, height: 640 }, hasTouch: true, isMobile: engine !== 'x' }, seedIt: true, init: fs.existsSync(TALLY) ? { path: TALLY } : [] });
  const r = await page.evaluate(async ([secs, seed]) => {
    const Q = window.__qa, G = window.__game, t0 = performance.now(), log = [], fps = 60; let s = seed * 3 + 11, frames = 0, inputs = 0, pauses = 0; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const read = () => { const raw = performance.memory ? performance.memory.usedJSHeapSize : null; if (window.gc) window.gc(); const I = G.renderer.info, n = (() => { let c = 0; G.scene.traverse(() => c++); return c; })(); return { t: Math.round(G.time), geo: I.memory.geometries, tex: I.memory.textures, prog: (I.programs || []).length, objs: n, heap: performance.memory ? performance.memory.usedJSHeapSize : null, raw }; };
    const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'KeyJ', 'KeyK', 'KeyQ', 'KeyE', 'KeyL', 'KeyR', 'KeyF', 'KeyP', 'KeyH', 'Escape', 'KeyC', 'Digit1', 'Tab', 'Enter'];
    const monkey = () => { const r = rnd(); inputs++;
      if (r < 0.45) { const code = keys[Math.floor(rnd() * keys.length)]; window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code })); window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code })); }
      else if (r < 0.85) { const x = rnd() * innerWidth, y = rnd() * innerHeight, el = document.elementFromPoint(x, y) || document.body, id = 20 + Math.floor(rnd() * 3), ev = (t, px, py, b) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', clientX: px, clientY: py, bubbles: true, cancelable: true, buttons: b })); ev('pointerdown', x, y, 1); ev('pointermove', x + rnd() * 40 - 20, y + rnd() * 40 - 20, 1); ev('pointerup', x, y, 0); if (el.click && el.tagName === 'BUTTON') el.click(); }
      else if (r < 0.92) window.dispatchEvent(new Event('resize')); else window.dispatchEvent(new Event('blur')); };
    let next = 0; const rows = [];
    while (performance.now() - t0 < secs * 1000) {
      for (let i = 0; i < 12; i++) { if (G.paused) { pauses++; G.ui.setPause(false); } G.frame(1 / fps); frames++; if (frames % 40 === 0) monkey(); if (G.hero.dead === false && frames % 2400 === 0) { G.hero.hp = G.hero.maxHp; } }
      if (G.time >= next) { next = G.time + 30; rows.push(read()); }
      await new Promise((d) => setTimeout(d, 0));
    }
    rows.push(read());
    return { rows, frames, inputs, pauses, ms: performance.now() - t0, pearls: G.quest.pearlCount(), rung: G.quest.rungCount() };
  }, [secs, seed]);
  fs.writeFileSync(`${out}/soak_detail_${engine}.json`, JSON.stringify(r, null, 1));
  const R = r.rows.filter((x) => x.t >= 180), a = R[0] || r.rows[0], first = r.rows[0], z = r.rows[r.rows.length - 1], g = (k) => (a[k] ? ((z[k] - a[k]) / a[k]) * 100 : 0), mins = r.frames / 3600;
  note(`${mins.toFixed(1)} min of play in ${Math.round(r.ms / 1000)} s, ${r.frames} frames drawn, ${r.inputs} monkey inputs, ${r.pauses} pauses undone, seed ${seed}`);
  line('F1', errors.length === 0 && mins >= 2, `${mins.toFixed(1)} min of play with ${r.inputs} random inputs: ${errors.length} errors (0)${errors.length ? ': ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`);
  line('B5l', g('geo') <= 10 && g('tex') <= 10 && g('prog') <= 10, `nothing leaks to the GPU after the first 3 minutes (ours: round 5's rows show first uses, then flat): geometries ${a.geo} to ${z.geo} (${g('geo').toFixed(1)}%), textures ${a.tex} to ${z.tex} (${g('tex').toFixed(1)}%), shader programs ${a.prog} to ${z.prog} (${g('prog').toFixed(1)}%), over ${z.t - a.t} s of play (≤ 10%); from the start ${first.geo}, ${first.tex}, ${first.prog}`);
  line('B5o', g('objs') <= 10, `the scene doesn't fill up: ${a.objs} objects to ${z.objs} (${g('objs').toFixed(1)}%, ≤ 10%)`);
  line('B5h', a.heap === null || g('heap') <= 10, a.heap === null ? `WebKit gives no script heap: read in Chromium; the renderer's counts above hold here` : `the script heap after a collection: ${(a.heap / 1048576).toFixed(1)} MB to ${(z.heap / 1048576).toFixed(1)} MB (${g('heap').toFixed(1)}%, ≤ 10%)`);
  const w = await page.evaluate(() => (window.__MOSA_WEIGHT ? window.__MOSA_WEIGHT.read() : null)), heapMax = Math.max(...r.rows.map((x) => x.heap || 0)) / 1048576, rawMax = Math.max(0, ...r.rows.slice(1).map((x) => x.raw || 0)) / 1048576, rawFirst = (r.rows[0].raw || 0) / 1048576, tally = w ? +w.peak_mb + +w.surfaces_peak_mb : 0;   // the first row is this ?demo page's own load, with the bot in it: load's peak is watched in a player's page by F2t, every 100 ms from the first script
  if (w) line('Q6', tally + rawMax <= 128, `working memory's peak in play over the soak (Q6, CR-22: the tally plus the raw heap): ${(tally + rawMax).toFixed(1)} MB (under 128): the tally ${tally.toFixed(1)} (graphics ${w.peak_mb}, surfaces ${w.surfaces_peak_mb}), heap ${engine === 'chromium' ? `raw ${rawMax.toFixed(1)} in play, after a collection ${heapMax.toFixed(1)}; at this ?demo page's load it read ${rawFirst.toFixed(1)}, printed, not bound: F2t reads load in a player's page` : 'WebKit gives no heap: this is the tally alone, not a Q6 reading'}`); else line('Q6', false, 'the framework\'s tally is missing');
  await close();
});
await finish();
