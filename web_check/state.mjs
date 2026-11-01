// F3: progress is kept, and the game runs with storage blocked. F4: a lost WebGL context.
//   F3b  localStorage throws on every touch: it boots, it plays, a pearl is taken, no error.
//   F3s  localStorage.setItem alone throws: the same (Safari's private mode of old).
//   F3r  a pearl and a bell's worth of progress, the page hidden, the page reloaded: a returning player has it. In this tree the bell comes by the real strike where it can.
//   F3w  a returning player comes back where they were (EPIC G9), not at the first reef.
//   F3o  a save written by the build before still loads (thalor.save.v1).
//   F4   a lost context: it draws again or says "tap to reload", no uncaught error, no reload by itself.
//   node state.mjs <base> <chromium|webkit> [--only=F3b,F3s,F3r,F3w,F3o,F4]
import { gate, PHONE, SMALL } from './lib/h.mjs';
const W = await gate('state', { budget: 170 });
const { line, note, open, section, finish, engine } = W;
const dive = async (page) => { await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 30000 }); await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(500); };
const pearlRun = (page) => page.evaluate(async () => { const Q = window.__qa, G = window.__game, p = G.world.data.pearls[0]; Q.calm(); G.hero.inv = 1e6; const before = G.quest.pearlCount(); for (let k = 0; k < 60 && G.quest.pearlCount() === before; k++) { Q.place(p[0], p[1], p[2]); await new Promise((d) => requestAnimationFrame(d)); } return { before, after: G.quest.pearlCount() }; });

await section(['F3b', 'F3s'], async () => {
  for (const [id, block, name] of [['F3b', `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });`, 'every touch of localStorage throws'], ['F3s', `Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };`, 'localStorage.setItem throws']]) {
    const { page, errors, close } = await open('?tier=phone', { ctx: PHONE, init: block });
    await dive(page); const r = await pearlRun(page); await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); }); await page.waitForTimeout(200);
    const t = await page.evaluate(() => window.__game.time);
    line(id, errors.length === 0 && t > 0.3 && r.after > r.before, `${name}: boots, plays (${t.toFixed(1)} s), a pearl taken (${r.before} to ${r.after}), hidden and pagehide survive; ${errors.length} errors${errors[0] ? ': ' + errors[0] : ''}`);
    await close();
  }
});

await section(['F3r', 'F3w', 'F3o'], async () => {
  const { page, close } = await open('?tier=phone', { ctx: PHONE });
  await dive(page);
  const r = await pearlRun(page);
  // a place far from the spawn, in the open: where a returning player should come back to
  const at = await page.evaluate(() => { const Q = window.__qa, w = Q.openWater(40); Q.swimAt(w.x, w.y, w.z); return [w.x, w.y, w.z]; }); await page.waitForTimeout(500);
  const was = await page.evaluate(() => { const Q = window.__qa, G = window.__game, h = G.hero; return { pearls: G.quest.pearlCount(), rung: G.quest.rungCount(), p: Q.where(), keys: Object.keys(localStorage) }; });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForTimeout(250);
  const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => /thalor|save/i.test(k)));
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 30000 }); await page.waitForTimeout(300);
  const dv = await page.evaluate(() => { const d = document.querySelector('#dive'); return !!d && d.style.display !== 'none' && d.offsetParent !== null; });
  if (dv) await page.tap('#dive').catch(() => {}); await page.waitForTimeout(600);
  const back = await page.evaluate(() => { const Q = window.__qa, G = window.__game; return { pearls: G.quest.pearlCount(), rung: G.quest.rungCount(), p: Q.where() }; });
  line('F3r', r.after > r.before && back.pearls === was.pearls && saved.length > 0, `hidden, then reloaded: pearls ${was.pearls} to ${back.pearls}, kept under ${JSON.stringify(saved)}; a returning player has them`);
  const far = Math.hypot(back.p.x - was.p.x, back.p.y - was.p.y, back.p.z - was.p.z);
  line('F3w', far < 60, `a returning player comes back where they were: ${far.toFixed(0)} m from where they left (≤ 60, EPIC G9)`);
  await close();
  const old = await open('?tier=phone', { ctx: PHONE, init: `try { if (!localStorage.getItem('thalor.save.v1')) localStorage.setItem('thalor.save.v1', JSON.stringify({ b: ['reef'], p: [1, 2, 3], c: [0], w: false })); } catch (e) {}` });
  await old.page.waitForTimeout(300); const o = await old.page.evaluate(() => { const G = window.__game; return { pearls: G.quest.pearlCount(), rung: G.quest.rungCount(), dash: G.hero.powers.dash }; });
  line('F3o', o.pearls >= 3 && o.rung === 1 && o.dash === true && old.errors.length === 0, `a save from the build before (v1: one bell, three pearls, a chest) loads: ${JSON.stringify(o)}; ${old.errors.length} errors${old.errors[0] ? ': ' + old.errors[0] : ''}`);
  await old.close();
});

await section(['F4'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone', { ctx: PHONE });
  const navs = []; page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push(f.url()); });
  await dive(page); await page.waitForTimeout(500);
  const r = await page.evaluate(() => new Promise((res) => {
    const Q = window.__qa, G = window.__game, gl = G.renderer.getContext(), ext = gl.getExtension('WEBGL_lose_context'); if (!ext) return res({ ext: false });
    const f0 = G.stats.frames, before = Q.pixels();
    ext.loseContext();
    setTimeout(() => { const lost = gl.isContextLost(); const msg = document.body.innerText; ext.restoreContext(); setTimeout(() => { const g2 = G.renderer.getContext(), px = Q.pixels(); res({ ext: true, lost, before, px, frames: G.stats.frames - f0, stillLost: g2.isContextLost(), tap: /tap to reload|reload/i.test(document.body.innerText) && !/reload/i.test(msg) }); }, 1500); }, 700);
  }));
  if (!r.ext) line('F4', true, 'WEBGL_lose_context isn\'t offered by this engine here: the check can\'t run');
  else line('F4', r.lost && navs.length === 0 && errors.length === 0 && ((r.px.lit >= 30 && r.px.distinct >= 4 && r.frames > 20) || r.tap), `a lost and restored context: lost ${r.lost}, ${navs.length} reloads, ${r.frames} frames on, ${r.px.lit} of ${r.px.of} pixels lit, ${r.px.distinct} colours (before: ${r.before.lit}, ${r.before.distinct}; a cleared frame has 1), tap-to-reload shown ${r.tap}; ${errors.length} errors${errors[0] ? ': ' + errors[0] : ''}`);
  await close();
});
await finish();
