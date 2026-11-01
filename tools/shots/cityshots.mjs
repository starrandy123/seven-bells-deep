// the cities from a swimmer's and a walker's height, in the street. node cityshots.mjs <url> <out>
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [url, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const b = await pw.webkit.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript({ path: '/Users/randy/Documents/UnrealProjects/DrownedCity_part2/web_check/lib/qa_page.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url + 'index.html?film&fresh&tier=phone', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted && window.__game.frame, null, { timeout: 90000 });
await page.addStyleTag({ content: '#hud,#title,#hurt,#speedv{display:none!important}' });
await page.evaluate(() => { const G = window.__game, q = G.quest; G.started = G.playing = true; q.events.hold(true); const ms = q.missions; for (const m of ms.active.slice()) ms.stop(m); if (G.enemies.clearAll) G.enemies.clearAll(); G.scene.traverse((o) => { if (o.renderOrder === 22 && o.material && o.material.uniforms && o.material.uniforms.uC) o.material.uniforms.uC.value.set(0); }); });
for (const [n, id, ang, d, z, pitch] of [['a_meridon_far', 'meridon', 2.2, 150, -22, 0.02], ['b_meridon_mid', 'meridon', 2.2, 70, -26, 0.04], ['c_meridon_near', 'meridon', 2.2, 25, -30, 0.06], ['d_thalor', 'thalor', 1.0, 90, -24, 0.05], ['e_vesper', 'vesper', 2.0, 40, -142, 0.08]]) {
  const r = await page.evaluate(([id, ang, d, z, pitch]) => { const G = window.__game, Q = window.__qa, h = G.hero, c = G.world.cities.cities.find((x) => x.def.id === id), p = c.p, sx = p.x + Math.cos(ang) * (p.r * .6 + d), sy = p.y + Math.sin(ang) * (p.r * .6 + d); Q.swimAt(sx, sy, z); h.place(); h.inv = 1e6; Q.aim(p.x - sx, p.y - sy, 0); G.camPitch = pitch; for (let i = 0; i < 40; i++) { Q.drive({ my: 0, mx: 0, ud: 0 }); G.frame(1 / 60); } const i = G.renderer.info.render; return { calls: i.calls, tris: i.triangles }; }, [id, ang, d, z, pitch]);
  console.log(n, JSON.stringify(r)); await page.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 82 });
}
const r = await page.evaluate(() => { const G = window.__game, Q = window.__qa, h = G.hero, c = G.world.cities.cities.find((x) => x.def.id === 'sunward_harbour'), p = c.p, ax = p.x - 34, ay = p.y + 4; Q.walkAt(ax - 40, ay - 40); h.place(); h.inv = 1e6; Q.aim(1, 1, 0); G.camPitch = .2; for (let i = 0; i < 40; i++) { Q.drive({ my: 0, mx: 0, ud: 0 }); G.frame(1 / 60); } const i = G.renderer.info.render; return { calls: i.calls, tris: i.triangles, inst: Object.fromEntries(Object.entries(c.inst).map(([k, v]) => [k, v.length])) }; });
console.log('town', JSON.stringify(r)); await page.screenshot({ path: `${out}/f_town.jpg`, type: 'jpeg', quality: 82 });
console.log(errs.length ? errs.slice(0, 3) : 'no errors'); await b.close();
