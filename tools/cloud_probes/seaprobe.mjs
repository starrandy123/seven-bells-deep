// The breakers and a ride on them, and the cities again with their two levels of detail. Every shader error caught.
import { createRequire } from 'module'; const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const out = process.argv[2], tag = process.argv[3] || 'a';
console.log('start', new Date().toISOString());
const browser = await pw.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await ctx.addInitScript({ path: '/home/user/seven-bells-deep/web_check/lib/qa_page.js' }); await ctx.addInitScript({ path: process.env.S + '/tools/film.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 400))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 1400)); });
await page.goto('http://127.0.0.1:8843/index.html?film&fresh&tier=desktop', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 1800000 }); console.log('booted', new Date().toISOString());
const B = await page.evaluate(() => { const G = window.__game; window.__qa.start(); G.bot = null; window.__film.quiet(); for (const k of ['toast','card','bark','tip','place','event']) G.ui[k] = () => {}; const st = document.createElement('style'); st.textContent = '#hud,#hint{display:none!important}'; document.head.appendChild(st); if (G.sky.setHour) G.sky.setHour(0.42); return G.sky.breaks.map((b) => ({ x: b.x, z: b.z, ox: b.ox, oz: b.oz, half: b.half, phase: b.phase })); });
console.log('breaks', JSON.stringify(B.map((b) => [+b.x.toFixed(1), +b.z.toFixed(1)])));
const b = B[0], peak = (1.5708 - b.phase) / 0.1745;      // when this break's set is at its biggest
const P = (o, l, h) => [b.x + b.ox * o - b.oz * l, -(b.z + b.oz * o + b.ox * l), h];      // a point o m out to sea and l m along the shore, h m up, in Blender metres
const shot = async (name, p, at, t, fov = 55) => {
  await page.evaluate(([p, at, t, fov]) => { const G = window.__game; if (t !== null) G.look.uniforms.ocTime.value = t - 1.3; window.__film.path([{ t: 0, p, at, fov }, { t: 99, p, at, fov }], { hideHero: true }); for (let i = 0; i < 40; i++) G.frame(1 / 30); }, [p, at, t, fov]);
  await page.screenshot({ path: `${out}/sea_${tag}_${name}.png`, timeout: 900000 }); console.log('shot', name);
};
await shot('break_side', P(16, 46, 3.2), P(18, 0, 0.6), peak, 60);
await shot('break_beach', P(-6, 4, 2.6), P(45, -4, 0.2), peak + 2.5, 62);
await shot('break_above', P(40, 55, 26), P(20, 0, 0), peak + 1, 55);
// the ride: from 70 m out on the break's axis, facing the shore, Boost held
const ride = await page.evaluate(([b, peak]) => { const G = window.__game, Q = window.__qa, h = G.hero; G.filmCam = null; if (h.root) h.root.visible = true; G.look.uniforms.ocTime.value = peak - 4;
  const x = b.x + b.ox * 70, z = b.z + b.oz * 70; Q.swimAt(x, -z, -0.5); G.camYaw = Math.atan2(-b.ox, -b.oz); G.camPitch = -0.1; Q.drive({ my: 1, mx: 0, ud: 0, boost: true });
  const log = []; for (let i = 0; i < 300; i++) { G.frame(1 / 30); if (i % 15 === 14) { const o = (h.pos.x - b.x) * b.ox + (h.pos.z - b.z) * b.oz, k = G.sky.breakAt(h.pos.x, h.pos.z); log.push([+(i / 30 + 1 / 30).toFixed(1), h.state === 'surf' ? (h.surf.land ? 'SURF-LAND' : 'SURF') : h.air ? 'air' : h.land ? 'land' : 'swim', +(h.surf ? h.surf.v : h.speed).toFixed(1), +o.toFixed(1), +k.face.toFixed(2), +(h.pos.y - G.sky.waveAt(h.pos.x, h.pos.z)).toFixed(2), +k.foam.toFixed(2)]); } }
  return log; }, [b, peak]);
console.log('ride [t, state, speed, metres out, face, height over water, foam]:'); for (const r of ride) console.log('  ', JSON.stringify(r));
await page.screenshot({ path: `${out}/sea_${tag}_ride_end.png`, timeout: 900000 });
// the cities with their two levels of detail
const W = (cx, cy, u, v, a) => [cx + u * Math.cos(a) - v * Math.sin(a), cy + u * Math.sin(a) + v * Math.cos(a)];
const eg = (x, y) => page.evaluate(([x, y]) => window.__game.world.heightAt(x, y), [x, y]);
await shot('thalor_over', [95, -190, -14], [30, -80, -40], null);
{ const [x, y] = W(20, -88, 70, 52, 0), g = await eg(x, y); const [tx, ty] = W(20, -88, 70, 66, 0); await shot('facade_close', [x, y, g + 5], [tx, ty, g + 6], null, 50); }
{ const [x, y] = W(440, 246, 49.5, -20, 0.35), [tx, ty] = W(440, 246, 49.5, 90, 0.35), g = await eg(x, y); await shot('meridon_street', [x, y, g + 3.5], [tx, ty, g + 7], null, 62); }
console.log('errors', JSON.stringify(errs.slice(0, 4))); await browser.close();
