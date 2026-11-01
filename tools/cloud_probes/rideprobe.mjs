// The land ride's stream on screen, the run to the shore (the hand-over onto the sea, the glance off what's in the way), and Crown Falls again.
import { createRequire } from 'module'; const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const out = process.argv[2], tag = process.argv[3] || 'a';
console.log('start', new Date().toISOString());
const browser = await pw.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await ctx.addInitScript({ path: '/home/user/seven-bells-deep/web_check/lib/qa_page.js' }); await ctx.addInitScript({ path: process.env.S + '/tools/film.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 400))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 900)); });
await page.goto('http://127.0.0.1:8843/index.html?film&fresh&tier=desktop', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 1800000 }); console.log('booted', new Date().toISOString());
await page.evaluate(() => { const G = window.__game; window.__qa.start(); G.bot = null; window.__film.quiet(); for (const k of ['toast','card','bark','tip','place','event']) G.ui[k] = () => {}; const st = document.createElement('style'); st.textContent = '#hud,#hint{display:none!important}'; document.head.appendChild(st); if (G.sky.setHour) G.sky.setHour(0.42); });
const run = (secs, drive) => page.evaluate(([secs, drive]) => { const G = window.__game, Q = window.__qa, h = G.hero; Q.drive(drive); const log = [];
  for (let i = 0; i < secs * 30; i++) { G.frame(1 / 30); if (i % 10 === 9) log.push([h.state === 'surf' ? (h.surf.land ? 'SURF-LAND' : 'SURF-SEA') : h.land ? 'land' : h.air ? 'air' : h.state, +(h.surf ? h.surf.v : Math.hypot(h.vel.x, h.vel.z)).toFixed(1), +h.groundAt(h.pos.x, h.pos.z).toFixed(1)]); }
  return log; }, [secs, drive]);
// the ride, from the follow camera
await page.evaluate(() => { const G = window.__game, Q = window.__qa; G.filmCam = null; Q.walkAt(-484, -824); G.camYaw = Math.atan2(0.92, -0.38); G.camPitch = -0.22; });
console.log('ride 2.6 s', JSON.stringify(await run(2.6, { my: 1, mx: 0.25, ud: 0, boost: true })));
await page.screenshot({ path: `${out}/ride_${tag}_chase.png`, timeout: 900000 });
// the stream from beside, the camera standing off to the side of where he just rode
const side = await page.evaluate(() => { const G = window.__game, h = G.hero, sn = Math.sin(h.heading), cs = Math.cos(h.heading); const bx = h.pos.x - sn * 9, bz = h.pos.z - cs * 9, px = bx + cs * 9, pz = bz - sn * 9; return { p: [px, -pz, G.world.heightAt(px, -pz) + 3.2], at: [bx, -bz, G.world.heightAt(bx, -bz) + 0.3] }; });
await page.evaluate(([p, at]) => { const G = window.__game; window.__film.path([{ t: 0, p, at, fov: 55 }, { t: 99, p, at, fov: 55 }]); G.frame(1 / 30); }, [side.p, side.at]);
await page.screenshot({ path: `${out}/ride_${tag}_side.png`, timeout: 900000 });
await page.evaluate(() => { window.__game.filmCam = null; });
console.log('on to the sea 7 s', JSON.stringify(await run(7, { my: 1, mx: 0.1, ud: 0, boost: true })));
await page.screenshot({ path: `${out}/ride_${tag}_sea.png`, timeout: 900000 });
// Crown Falls again: from the front and at the pool
for (const [n, outM, across, pitch] of [['falls_front', 34, 0, 0.12], ['falls_pool', 12, 4, -0.05]]) {
  await page.evaluate(([outM, across, pitch]) => { const G = window.__game, Q = window.__qa, f = G.world.data.waterfalls[0], c = Math.cos(f.yaw), s = Math.sin(f.yaw); G.filmCam = null;
    const x = f.x + outM * s + across * c, y = f.y - outM * c + across * s; Q.walkAt(x, y); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); G.camYaw = Math.atan2(f.x - x, -(f.y - y)); G.camPitch = pitch; for (let i = 0; i < 40; i++) G.frame(1 / 30); }, [outM, across, pitch]);
  await page.screenshot({ path: `${out}/ride_${tag}_${n}.png`, timeout: 900000 });
}
console.log('errors', JSON.stringify(errs.slice(0, 4))); await browser.close();
