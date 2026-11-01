import { createRequire } from 'module'; const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const out = process.argv[2]; console.log('start', new Date().toISOString());
const browser = await pw.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
await ctx.addInitScript({ path: '/home/user/seven-bells-deep/web_check/lib/qa_page.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:8843/index.html?film&fresh&tier=desktop', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 1800000 }); console.log('booted', new Date().toISOString());
await page.evaluate(() => { const G = window.__game; window.__qa.start(); G.bot = null; G.filmCam = null; for (const k of ['toast','card','bark','tip','place','event']) G.ui[k] = () => {}; const st = document.createElement('style'); st.textContent = '#hud{display:none!important}'; document.head.appendChild(st); if (G.sky && G.sky.setHour) G.sky.setHour(0.42); });
// Sunward Isle, where the land run was filmed: face toward the sea (the run's own heading), Boost held
const run = async (label, secs, drive, shotAt) => {
  const r = await page.evaluate(([secs, drive]) => { const G = window.__game, Q = window.__qa, h = G.hero; Q.drive(drive); const log = [];
    for (let i = 0; i < secs * 30; i++) { G.frame(1/30); if (i % 10 === 9) log.push([+(h.surf ? h.surf.v : Math.hypot(h.vel.x, h.vel.z)).toFixed(1), h.state === 'surf' ? (h.surf.land ? 'SURF-LAND' : 'SURF-SEA') : h.land ? 'land' : h.air ? 'air' : h.state, +h.pos.y.toFixed(1), +h.groundAt(h.pos.x, h.pos.z).toFixed(1)]); }
    return log; }, [secs, drive]);
  console.log(label, JSON.stringify(r));
  if (shotAt) await page.screenshot({ path: `${out}/surf_${shotAt}.png`, timeout: 600000 });
};
await page.evaluate(() => { const G = window.__game, Q = window.__qa; Q.walkAt(-484, -824); G.camYaw = Math.atan2(0.92, -0.38); G.camPitch = -0.12; });
await run('sprint+boost 3 s (rolls into the ride?)', 3, { my: 1, mx: 0, ud: 0, boost: true }, 'land1');
await run('carve right 2 s', 2, { my: 1, mx: 0.8, ud: 0, boost: true }, 'land2');
await run('straight 6 s (to the sea?)', 6, { my: 1, mx: 0, ud: 0, boost: true }, 'sea');
await page.evaluate(() => { const G = window.__game, Q = window.__qa; Q.walkAt(-484, -824); G.camYaw = Math.atan2(0.92, -0.38); });
await run('ride 2 s then let go of Boost 3 s', 2, { my: 1, mx: 0, ud: 0, boost: true });
await run('...Boost let go', 3, { my: 1, mx: 0, ud: 0, boost: false }, 'off');
console.log('errors', JSON.stringify(errs.slice(0, 5))); await browser.close();
