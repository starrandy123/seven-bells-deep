import { createRequire } from 'module'; const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const out = process.argv[2], tag = process.argv[3] || 'a'; console.log('start', new Date().toISOString());
const browser = await pw.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
await ctx.addInitScript({ path: '/home/user/seven-bells-deep/web_check/lib/qa_page.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:8843/index.html?film&fresh&tier=desktop', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 1800000 }); console.log('booted', new Date().toISOString());
const counts = await page.evaluate(() => { const G = window.__game; window.__qa.start(); G.bot = null; G.filmCam = null; for (const k of ['toast','card','bark','tip','place','event']) G.ui[k] = () => {}; const st = document.createElement('style'); st.textContent = '#hud{display:none!important}'; document.head.appendChild(st); if (G.sky && G.sky.setHour) G.sky.setHour(0.42);
  const P = G.world.cities; return { total: P.count, colliders: P.colliders.length, per: P.cities.map((c) => [c.def.id, Object.fromEntries(Object.entries(c.inst).map(([k, v]) => [k, v.length]))]) }; });
console.log('cities', JSON.stringify(counts));
const shot = async (name, fn) => { await page.evaluate(fn); await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__game.frame(1/30); }); await page.screenshot({ path: `${out}/city_${tag}_${name}.png`, timeout: 600000 }); };
// over a city: swim high above its centre, looking down across it
const over = (id, up, pitch, back) => `(() => { const G = window.__game, Q = window.__qa, p = G.world.data.poi.find((q) => q.id === '${id}'); const z = Math.min(-4, G.world.heightAt(p.x, p.y) + ${up}); Q.swimAt(p.x, p.y - ${back}, z); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); G.camYaw = 0; G.camPitch = ${pitch}; })()`;
await shot('thalor_above', over('thalor', 40, -0.55, 120));
await shot('meridon_above', over('meridon', 38, -0.5, 100));
await shot('vesper_above', over('vesper', 35, -0.5, 90));
// a street: along the city's first avenue, a few metres up
await shot('thalor_street', `(() => { const G = window.__game, Q = window.__qa, p = G.world.data.poi.find((q) => q.id === 'thalor'); const x = p.x + 80, y = p.y + 18; Q.swimAt(x, y, G.world.heightAt(x, y) + 4); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); G.camYaw = Math.PI / 2; G.camPitch = 0.05; })()`);
await shot('meridon_street', `(() => { const G = window.__game, Q = window.__qa, p = G.world.data.poi.find((q) => q.id === 'meridon'); const x = p.x - 90, y = p.y - 30; Q.swimAt(x, y, G.world.heightAt(x, y) + 4); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); G.camYaw = 1.2; G.camPitch = 0.08; })()`);
await shot('sunward_town', `(() => { const G = window.__game, Q = window.__qa, p = G.world.data.poi.find((q) => q.id === 'sunward_harbour'); Q.walkAt(p.x - 40, p.y - 40); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); G.camYaw = Math.atan2(40, -40); G.camPitch = -0.15; })()`);
// collision: swim straight at the nearest sea building's wall
const hit = await page.evaluate(() => { const G = window.__game, Q = window.__qa, h = G.hero, cs = G.world.cities.colliders.filter((c) => c.city === 'meridon' && c.z1 - c.z0 > 8); const c = cs[0];
  const sx = c.x - (c.hx + 12) * Math.cos(c.yaw), sy = c.y - (c.hx + 12) * Math.sin(c.yaw), z = c.z0 + 3; Q.swimAt(sx, sy, z);
  G.camYaw = Math.atan2(c.x - sx, -(c.y - sy)); G.camPitch = 0; Q.drive({ my: 1, mx: 0, ud: 0, boost: true });
  let minD = 1e9; for (let i = 0; i < 120; i++) { G.frame(1/30); const dx = h.pos.x - c.x, dy = -h.pos.z - c.y; const lx = dx * Math.cos(c.yaw) + dy * Math.sin(c.yaw), ly = -dx * Math.sin(c.yaw) + dy * Math.cos(c.yaw); minD = Math.min(minD, Math.max(Math.abs(lx) - c.hx, Math.abs(ly) - c.hy)); }
  return { box: [+c.hx.toFixed(1), +c.hy.toFixed(1), +(c.z1 - c.z0).toFixed(1)], closestOutsideWall: +minD.toFixed(2) }; });
console.log('collision (negative = inside the wall)', JSON.stringify(hit));
console.log('errors', JSON.stringify(errs.slice(0, 6))); await browser.close();
