// A returning player: saved on land, comes back, dives. He goes on from where he left off (Randy, 2 Nov: "we should be able to continue the game from where we left from"), which replaced the older rule that he start at sea where the title showed him.
import { createRequire } from 'module';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [url, engine = 'webkit'] = process.argv.slice(2);
const opts = { headless: true }; if (engine === 'chromium') opts.channel = 'chromium';
const browser = await pw[engine].launch(opts);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const page = await ctx.newPage();
const boot = async () => { await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 90000 }); };
const dive = async () => { const d = await page.$('#dive'); if (d && await d.isVisible()) await d.click(); await page.waitForTimeout(1600); };
const where = () => page.evaluate(() => { const G = window.__game, h = G.hero; return { x: +h.pos.x.toFixed(1), y: +h.pos.y.toFixed(1), z: +h.pos.z.toFixed(1), land: !!h.land, st: h.state }; });
await boot(); await dive(); const first = await where(); console.log('first', JSON.stringify(first));
await page.evaluate(() => { const G = window.__game, h = G.hero; h.pos.set(-300, 8, 580); h.land = true; G.quest.save && G.quest.save(); });
console.log('saved on land at', JSON.stringify(await where())); await page.waitForTimeout(500);
await boot(); await dive(); const back = await where(); console.log('back', JSON.stringify(back));
console.log(Math.hypot(back.x - -300, back.z - 580) < 8 && back.land ? 'PASS a returning player goes on from where he left off' : 'FAIL he did not come back where he left off');
await browser.close();
