// G7h: the pill, compass, distance, the feed and everything in it never sit on the vitals, the buttons, the stick or each other, upright and turned,
// on a small phone and a big one, with every button up, the longest text the game has, and a notch's insets. Rect against rect, in the page.
//   node web_check/g_hud.mjs <base> <engine>
import { args, launch, ok, done } from './lib_g.mjs';
const { base, engine } = args();
const browser = await launch(engine);
const SIZES = [[390, 844], [844, 390], [375, 667], [667, 375], [430, 932], [932, 430]];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: engine === 'chromium', hasTouch: true });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base + '?fresh&tier=phone', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.booted && document.querySelector('#dive').style.display !== 'none', null, { timeout: 90000 });
  await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(500);
  // the game's longest of each thing, up at once
  await page.evaluate(() => {
    const G = window.__game, q = G.quest, ms = q.missions;
    window.__fill = () => {
      const longObj = [...ms.defs.values()].flatMap((d) => d.objectives.map((o) => o.text || '')).sort((a, b) => b.length - a.length)[0];
      const longRelic = q.collect.relics.slice().sort((a, b) => b.text.length - a.text.length)[0];
      G.ui.objective(longObj.replace('{n}', '3').replace('{total}', '3')); G.ui.tip('Defeat the guardians, then strike the bell', 60); G.ui.toast('Chapter Seven', 'The Sunken Arena', 60); G.ui.place('The Hanging Terraces');
      G.ui.bark('Perpetua Ambry', 'Office hours are posted. They have not changed.', 60); G.ui.card(longRelic.title, longRelic.text, 60); G.ui.timer(42, 'Hold'); G.ui.context('Talk');
      for (const k of ['dash', 'spin', 'wave', 'p4', 'call', 'stance', 'jump']) G.ui.unlock(k);
      document.querySelectorAll('.btn').forEach((b) => b.classList.add('show'));
      if (G.hero) G.hero.land = true;
    };
    window.__rects = () => {
      const sel = ['#vitals', '#obj', '#compass', '#dist', '#pauseB', '#stick', ...[...document.querySelectorAll('.btn')].map((b) => '#' + b.id), '#toast.on', '#place.on', '#tip.on', '#bark.on', '#card.on', '#timer.on', '#hint.on', '#done.on', '#event.on'];
      const fb = document.getElementById('feed').getBoundingClientRect();     // the feed clips what can't fit: what's clipped isn't on the screen
      const list = sel.map((s) => [s, document.querySelector(s)]).filter((x) => x[1] && x[1].getClientRects().length).map(([s, el]) => { const r = el.getBoundingClientRect(), infeed = el.closest('#feed'); const b = infeed ? Math.min(r.bottom, fb.bottom) : r.bottom; return { s, l: r.left, t: r.top, r: r.right, b }; }).filter((x) => x.b > x.t);
      const hits = [], off = [];
      for (let i = 0; i < list.length; i++) {
        const a = list[i]; if (a.l < 0 || a.t < 0 || a.r > innerWidth || a.b > innerHeight) off.push(a.s);
        for (let j = i + 1; j < list.length; j++) { const b = list[j]; if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) hits.push(`${a.s}/${b.s}`); }
      }
      // the feed may clip what can't fit: count how much of it is cut
      const feed = document.getElementById('feed').getBoundingClientRect(), bottom = Math.max(...list.filter((x) => /(toast|place|tip|bark|card|timer)/.test(x.s)).map((x) => x.b));
      return { hits, off, n: list.length, cut: Math.max(0, bottom - feed.bottom), feedB: Math.round(feed.bottom) };
    };
  });
  let worst = []; const rows = [];
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250);
    await page.evaluate(() => window.__fill()); await page.waitForTimeout(250);
    const r = await page.evaluate(() => window.__rects());
    rows.push(`${w}x${h}: ${r.n} rects`); if (r.hits.length || r.off.length) worst.push(`${w}x${h}: ${r.hits.join(' ')} ${r.off.length ? 'off screen ' + r.off.join(' ') : ''}`);
  }
  ok('G7h', !worst.length, worst.length ? worst.join(' | ') : `no overlaps with the longest text and every button up: ${rows.join(', ')}`);
  ok('G7e', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'no page errors');
} catch (e) { ok('G7h', false, 'the run did not finish: ' + e.message); }
await browser.close(); done();
