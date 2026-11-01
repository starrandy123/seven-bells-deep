// A real look swipe: a pointer drag on the right of the screen, then the thumb lifts. The camera must turn by the swipe and stop.
import { createRequire } from 'module';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [url, engine = 'webkit'] = process.argv.slice(2);
const opts = { headless: true }; if (engine === 'chromium') opts.channel = 'chromium';
const browser = await pw[engine].launch(opts);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 90000 });
const dive = await page.$('#dive'); if (dive && await dive.isVisible()) await dive.click(); await page.waitForTimeout(1500);
const yaw = () => page.evaluate(() => window.__game.camYaw);
const drag = (dx) => page.evaluate(async (dx) => { const c = document.querySelector('canvas'); const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
  ev('pointerdown', 300, 400); for (let i = 1; i <= 10; i++) { ev('pointermove', 300 + dx * i / 10, 400); await new Promise((r) => requestAnimationFrame(r)); } ev('pointerup', 300 + dx, 400); }, dx);
const y0 = await yaw(); await drag(-60); const y1 = await yaw(); await page.waitForTimeout(1000); const y2 = await yaw(); await page.waitForTimeout(2000); const y3 = await yaw();
const deg = (a) => +(a * 57.3).toFixed(1);
console.log('swipe 60 px: turned', deg(y1 - y0), 'deg by lift; +1 s drift', deg(y2 - y1), 'deg; +3 s drift', deg(y3 - y1), 'deg');
await browser.close(); console.log(Math.abs(y3 - y1) < 0.02 ? 'PASS the camera stops when the thumb lifts' : 'FAIL the camera keeps turning after the thumb lifts');
