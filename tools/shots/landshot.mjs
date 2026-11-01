// what his phone shows, turned: the title, then the game with its HUD, a new game and a returning one. node landshot.mjs <url> <out>
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [url, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const b = await pw.webkit.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript({ path: '/Users/randy/Documents/UnrealProjects/DrownedCity_part2/web_check/lib/qa_page.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url + 'index.html?fresh&tier=phone', { waitUntil: 'load' });
await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 90000 });
await page.waitForTimeout(800); await page.screenshot({ path: `${out}/1_title.jpg`, type: 'jpeg', quality: 85 });
await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/2_dived.jpg`, type: 'jpeg', quality: 85 });
await page.evaluate(() => { const G = window.__game; if (G.cine && G.cine.active) G.cine.stop(true); window.__qa.calm(); }); await page.waitForTimeout(9000); await page.screenshot({ path: `${out}/3_play.jpg`, type: 'jpeg', quality: 85 });
await page.evaluate(() => { const G = window.__game; G.quest.debugRingAll && G.quest.debugRingAll(); if (G.combat.refreshSlots) G.combat.refreshSlots(); }); await page.waitForTimeout(600); await page.screenshot({ path: `${out}/4_rung.jpg`, type: 'jpeg', quality: 85 });
console.log(errs.length ? errs.slice(0, 3) : 'no errors'); await b.close();
