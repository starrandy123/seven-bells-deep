// What a land ride leaves (wetmap.js): the stream, then soaked ground and puddles drying over a minute, and the grass laid flat. A meadow and a beach.
import { createRequire } from 'module'; const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const out = process.argv[2], tag = process.argv[3] || 'w1';
const t0 = Date.now(), log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(0).padStart(5) + 's', ...a);
const browser = await pw.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await ctx.addInitScript({ path: '/home/user/seven-bells-deep/web_check/lib/qa_page.js' }); await ctx.addInitScript({ path: out + '/tools/film.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 400))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 900)); });
await page.goto('http://127.0.0.1:8843/index.html?film&fresh&tier=desktop', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 1800000 }); log('booted');
await page.evaluate(() => { const G = window.__game; window.__qa.start(); G.bot = null; window.__film.quiet(); for (const k of ['toast','card','bark','tip','place','event']) G.ui[k] = () => {}; const st = document.createElement('style'); st.textContent = '#hud,#hint{display:none!important}'; document.head.appendChild(st); if (G.sky.setHour) G.sky.setHour(0.42); });
for (const [name, x, y, dir] of [['meadow', -628.9, -474.9, [1, 0]]]) {
  const ride = await page.evaluate(([x, y, dir]) => { const G = window.__game, Q = window.__qa, h = G.hero; G.filmCam = null; if (h.root) h.root.visible = true; Q.walkAt(x, y); G.camYaw = Math.atan2(dir[0], -dir[1]); G.camPitch = -0.2; const L = [];
    const r0 = G.look.render; G.look.render = () => {}; const step = (secs, d) => { Q.drive(d); for (let i = 0; i < secs * 30; i++) { G.frame(1 / 30); if (i % 15 === 14) L.push([h.state === 'surf' ? (h.surf.land ? 'SURF-LAND' : 'SURF-SEA') : h.land ? 'land' : h.air ? 'air' : h.state, +(h.surf ? h.surf.v : Math.hypot(h.vel.x, h.vel.z)).toFixed(1)]); } };
    const a = [h.pos.x, -h.pos.z]; step(3.2, { my: 1, mx: 0, ud: 0, boost: true }); step(1.6, { my: 0, mx: 0, ud: 0, boost: false });
    const b = [h.pos.x, -h.pos.z]; G.look.render = r0; return { L, a, b, wet: G.world.wet.live, origin: [G.world.wet.origin.x, G.world.wet.origin.y] }; }, [x, y, dir]);
  log(name, 'ride', JSON.stringify(ride));
  // beside the trail, up a little, looking at its middle; the hero out of the frame
  const [ax, ay] = ride.a, [bx, by] = ride.b, mx = (ax + bx) / 2, my = (ay + by) / 2, l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l, ny = (bx - ax) / l;
  // from above the trail's middle, off to one side: nothing standing on the ground can get between the lens and the trail
  const cam = await page.evaluate(([ax, ay, bx, by]) => { const G = window.__game, l = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / l, uy = (by - ay) / l, mx = (ax + bx) / 2, my = (ay + by) / 2, px = mx - uy * 6 - ux * 7, py = my + ux * 6 - uy * 7;
    return { p: [px, py, G.world.heightAt(mx, my) + 7.5], at: [mx + ux * 3, my + uy * 3, G.world.heightAt(mx, my)] }; }, [ax, ay, bx, by]);
  log('camera', JSON.stringify(cam));
  for (const [when, secs] of [['1s', 0.6], ['10s', 9], ['40s', 30]]) {
    await page.evaluate(([cam, secs]) => { const G = window.__game, r = G.look.render; window.__film.path([{ t: 0, p: cam.p, at: cam.at, fov: 55 }, { t: 999, p: cam.p, at: cam.at, fov: 55 }], { hideHero: false }); G.look.render = () => {}; try { for (let i = 0; i < secs * 10; i++) G.frame(1 / 10); } finally { G.look.render = r; } G.frame(1 / 30); }, [cam, secs]);
    await page.screenshot({ path: `${out}/${tag}_${name}_${when}.png`, timeout: 900000 }); log('shot', name, when);
  }
}
log('errors', JSON.stringify(errs.slice(0, 6))); await browser.close();
