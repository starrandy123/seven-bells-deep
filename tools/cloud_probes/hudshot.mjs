// The phone HUD, upright and turned, in the real game: every power open, in a fight, so the whole cluster shows.
import { createRequire } from 'module'; const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const out = process.argv[2], eng = process.argv[3] || 'chromium';
const R = '/home/user/seven-bells-deep/web_check/lib/qa_page.js', F = '/tmp/claude-0/-home-user-seven-bells-deep/7c3468ca-0f0b-55b7-8f7d-22ef437fcb91/scratchpad/tools/film.js';
const browser = await pw[eng].launch({ headless: true });
for (const [w, h, name] of [[390, 844, 'up'], [844, 390, 'turned']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: eng !== 'webkit' });
  await ctx.addInitScript({ path: R }); await ctx.addInitScript({ path: F });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://127.0.0.1:8843/index.html?demo&film&fresh&tier=phone', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 600000 });
  await page.evaluate(() => { const G = window.__game, h = G.hero, V = h.pos.constructor; G.quest.debugRingAll(); G.quest.botDrive = () => false; G.quest.target = () => null;
    for (const k of ['toast','card','bark','tip','place','event']) G.ui[k] = () => {}; const st = document.createElement('style'); st.textContent = '#toast,#card,#bark,#tip,#place,#event,#feed,#hint,#done{display:none!important}'; document.head.appendChild(st);
    window.__qa && window.__qa.walkAt ? window.__qa.walkAt(-268,-578) : 0; });
  for (let i = 0; i < 40; i++) await page.evaluate(() => window.__game.frame(1 / 30));
  await page.screenshot({ path: `${out}/hud_${eng}_${name}.png` });
  const info = await page.evaluate(() => ({ controls: (window.__MOSA_CONTROLS || {}).actions?.map((a) => a.id), boxes: [...document.querySelectorAll('.btn.show, #stick, #pauseB')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return [e.id, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })}));
  console.log(name, JSON.stringify(info), 'errors', errs.slice(0, 3));
  await ctx.close();
}
await browser.close();
