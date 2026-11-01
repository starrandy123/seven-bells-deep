// The cities, seen by a free camera (the film's own hook): overviews, streets, a close facade, night. Every shader error caught.
import { createRequire } from 'module'; const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const out = process.argv[2], tag = process.argv[3] || 'b', look = process.argv[4] || '';
console.log('start', new Date().toISOString());
const browser = await pw.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await ctx.addInitScript({ path: '/home/user/seven-bells-deep/web_check/lib/qa_page.js' }); await ctx.addInitScript({ path: process.env.S + '/tools/film.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 400))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 900)); });
await page.goto('http://127.0.0.1:8843/index.html?film&fresh&tier=desktop' + (look ? '&look=' + look : ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 1800000 }); console.log('booted', new Date().toISOString());
const info = await page.evaluate(() => { const G = window.__game; window.__qa.start(); G.bot = null; window.__film.quiet(); for (const k of ['toast','card','bark','tip','place','event']) G.ui[k] = () => {}; const st = document.createElement('style'); st.textContent = '#hud,#hint{display:none!important}'; document.head.appendChild(st);
  const P = G.world.cities; return { total: P.total, tris: P.tris, cleared: P.cleared }; });
console.log('cities', JSON.stringify(info));
// a shot: camera p and target at in Blender metres, an hour of the day; frames run so the streaming catches up, then the picture and the renderer's own count
const shot = async (name, p, at, hour, fov = 55) => {
  await page.evaluate(([p, at, hour, fov]) => { const G = window.__game; if (G.sky && G.sky.setHour) G.sky.setHour(hour); window.__film.path([{ t: 0, p, at, fov }, { t: 99, p, at, fov }], { hideHero: true }); for (let i = 0; i < 40; i++) G.frame(1 / 30); }, [p, at, hour, fov]);
  await page.screenshot({ path: `${out}/c2_${tag}_${name}.png`, timeout: 900000 });
  const r = await page.evaluate(() => { const i = window.__game.renderer.info; return { calls: i.render.calls, tris: i.render.triangles }; });
  console.log(name, JSON.stringify(r));
};
const W = (cx, cy, u, v, a) => [cx + u * Math.cos(a) - v * Math.sin(a), cy + u * Math.sin(a) + v * Math.cos(a)];
const eg = (x, y) => page.evaluate(([x, y]) => window.__game.world.heightAt(x, y), [x, y]);
// Thalor (centre 20, -88, grid angle 0), Meridon (440, 246, 0.35), Vesper (-205, 564, -0.5), the hill town (-315.9, -563.5, 0.18)
await shot('thalor_over', [95, -190, -14], [30, -80, -40], 0.42);
await shot('meridon_over', [370, 150, -12], [450, 250, -36], 0.42);
await shot('vesper_over', [-270, 470, -112], [-200, 570, -145], 0.42);
await shot('town_from_bay', [-245, -600, 22], [-318, -560, 8], 0.42);
{ const [x, y] = W(20, -88, 54, 30, 0), [tx, ty] = W(20, -88, 54, 120, 0), g = await eg(x, y); await shot('thalor_street', [x, y, g + 3.5], [tx, ty, g + 6], 0.42, 62); }
{ const [x, y] = W(440, 246, 49.5, -20, 0.35), [tx, ty] = W(440, 246, 49.5, 90, 0.35), g = await eg(x, y); await shot('meridon_street', [x, y, g + 3.5], [tx, ty, g + 7], 0.42, 62); }
{ const [x, y] = W(440, 246, 49.5, -20, 0.35), [tx, ty] = W(440, 246, 49.5, 90, 0.35), g = await eg(x, y); await shot('meridon_street_night', [x, y, g + 3.5], [tx, ty, g + 7], 0.9, 62); }
{ const [x, y] = W(20, -88, 70, 52, 0), g = await eg(x, y); const [tx, ty] = W(20, -88, 70, 66, 0); await shot('facade_close', [x, y, g + 5], [tx, ty, g + 6], 0.42, 50); }
await shot('town_night', [-245, -600, 22], [-318, -560, 8], 0.92);
console.log('errors', JSON.stringify(errs.slice(0, 4))); await browser.close();
