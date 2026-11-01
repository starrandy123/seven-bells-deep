// First look: boot, optional dive, a run, what state the game reached, screenshots and every console error.
//   node smoke.mjs <url> <out dir> [chromium|webkit] [phone|desktop] [seconds]
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [url, out, engine = 'chromium', form = 'desktop', secs = '20'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const opts = { headless: true }; if (engine === 'chromium') opts.channel = 'chromium';
const browser = await pw[engine].launch(opts).catch(() => pw[engine].launch({ headless: true }));
const ctxOpts = form === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } };
const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' '))); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 240)); });
page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ' ' + r.url()); });
const t0 = Date.now(); await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 90000 }).catch(() => console.log('NO BOOT'));
console.log('boot', (Date.now() - t0) + 'ms');
const state = () => page.evaluate(() => { const G = window.__game; if (!G || !G.hero) return null; const h = G.hero, i = G.renderer.info;
  return { t: +G.time.toFixed(1), pos: [h.pos.x, h.pos.y, h.pos.z].map((v) => +v.toFixed(1)), sp: +h.speed.toFixed(1), st: h.state, hp: Math.round(h.hp), tide: Math.round(h.tide), pearls: G.quest.pearlCount(), rung: G.quest.rungCount(), foes: G.enemies.count(), boss: G.boss.active ? Math.round(G.boss.hp) : null, calls: i.render.calls, tris: i.render.triangles, frames: G.stats.frames }; });
await page.waitForTimeout(600); await page.screenshot({ path: out + '/0_start.png' });
const dive = await page.$('#dive'); if (dive && await dive.isVisible()) await dive.click();
const N = Math.ceil(+secs / 4);
for (let k = 0; k < N; k++) { await page.waitForTimeout(4000); console.log(JSON.stringify(await state())); await page.screenshot({ path: out + `/run_${k}.png` }); }
console.log('errors', errors.length ? '\n  ' + [...new Set(errors)].slice(0, 20).join('\n  ') : 'none');
await browser.close();
