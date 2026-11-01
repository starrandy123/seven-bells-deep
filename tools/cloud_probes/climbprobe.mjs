// Crown Falls: walk into the foot of the fall pushing toward the rock, then hold up; log height, state; pictures on the way up and at the top.
import { createRequire } from 'module'; const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const out = process.argv[2], S = process.env.S;
const browser = await pw.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
await ctx.addInitScript({ path: '/home/user/seven-bells-deep/web_check/lib/qa_page.js' }); await ctx.addInitScript({ path: S + '/tools/film.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:8843/index.html?film&fresh&tier=phone', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 900000 });
await page.evaluate(() => { const G = window.__game; window.__qa.start(); G.bot = null; G.filmCam = null; for (const k of ['toast','card','bark','tip','place','event']) G.ui[k] = () => {}; const st = document.createElement('style'); st.textContent = '#hud{display:none!important}'; document.head.appendChild(st); });
const info = await page.evaluate(() => { const G = window.__game, f = G.world.data.waterfalls[0], c = Math.cos(f.yaw), s = Math.sin(f.yaw);
  // stand out in front of the foot: walk out along local -y until the ground is near the fall's foot height
  let o = 2; for (; o < 80; o += 0.5) { const x = f.x + o * s, y = f.y - o * c; if (G.world.heightAt(x, y) < f.z1 + 0.6) break; }
  const x = f.x + (o + 3) * s, y = f.y - (o + 3) * c; window.__qa.walkAt(x, y); G.camYaw = Math.atan2(-s, -c);
  return { o, x, y, ground: +G.world.heightAt(x, y).toFixed(1), f }; });
console.log('start', JSON.stringify(info));
for (let k = 0; k < 4; k++) {
  const r = await page.evaluate((k) => { const G = window.__game, Q = window.__qa, h = G.hero; Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); const log = [];
    for (let i = 0; i < 45; i++) { G.frame(1/30); if (i % 9 === 8) log.push([+h.pos.y.toFixed(1), h.climb ? 'CLIMB' : h.air ? 'air' : h.land ? 'land' : h.state]); } return log; }, k);
  console.log('1.5 s:', JSON.stringify(r));
  await page.screenshot({ path: `${out}/climb_${k}.png`, timeout: 600000 });
}
console.log('errors', errs.slice(0, 3)); await browser.close();
