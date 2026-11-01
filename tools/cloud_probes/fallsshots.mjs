import { createRequire } from 'module'; const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const out = process.argv[2], tag = process.argv[3] || 'new';
console.log('start', new Date().toISOString());
const browser = await pw.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
await ctx.addInitScript({ path: '/home/user/seven-bells-deep/web_check/lib/qa_page.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:8843/index.html?film&fresh&tier=desktop', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 1800000 }); console.log('booted', new Date().toISOString());
await page.evaluate(() => { const G = window.__game; window.__qa.start(); G.bot = null; G.filmCam = null; for (const k of ['toast','card','bark','tip','place','event']) G.ui[k] = () => {}; const st = document.createElement('style'); st.textContent = '#hud{display:none!important}'; document.head.appendChild(st); if (G.sky && G.sky.setHour) G.sky.setHour(0.42); });
// cameras: distance out in front of the lip (local -y), across (local x), and the camera's pitch
for (const [n, outM, across, pitch] of [['front', 34, 0, 0.12], ['side', 22, 16, 0.05], ['pool', 12, 4, -0.05]]) {
  await page.evaluate(([outM, across, pitch]) => { const G = window.__game, Q = window.__qa, f = G.world.data.waterfalls[0], c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    const x = f.x + outM * s + across * c, y = f.y - outM * c + across * s; Q.walkAt(x, y); Q.drive({ my: 0, mx: 0, ud: 0, boost: false });
    const dx = f.x - x, dy = f.y - y; G.camYaw = Math.atan2(dx, -dy); G.camPitch = pitch; for (let i = 0; i < 40; i++) G.frame(1/30); }, [outM, across, pitch]);
  await page.screenshot({ path: `${out}/falls_${tag}_${n}.png`, timeout: 600000 });
}
console.log('errors', JSON.stringify(errs.slice(0, 5))); await browser.close();
