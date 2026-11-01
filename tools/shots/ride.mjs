// the ride up close: Boost held on a meadow, film-stepped. Frames from the game's own camera and from the side and front. node ride.mjs <url> <out>
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [url, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const b = await pw.chromium.launch({ headless: true, channel: 'chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript({ path: '/Users/randy/Documents/UnrealProjects/DrownedCity_part2/web_check/lib/qa_page.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url + 'index.html?film&fresh&tier=phone', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted && window.__game.frame, null, { timeout: 90000 });
await page.addStyleTag({ content: '#hud,#title,#hurt,#speedv{display:none!important}' });
await page.evaluate(() => { const G = window.__game, q = G.quest, Q = window.__qa; G.started = G.playing = true; q.events.hold(true); const ms = q.missions; for (const m of ms.active.slice()) ms.stop(m); if (G.enemies.clearAll) G.enemies.clearAll(); G.scene.traverse((o) => { if (o.renderOrder === 22 && o.material && o.material.uniforms && o.material.uniforms.uC) o.material.uniforms.uC.value.set(0); });
  const h = G.hero; Q.walkAt(-400, -600); h.place(); h.inv = 1e6; Q.aim(-1, 0.3, 0); window.__step = (n) => { for (let i = 0; i < n; i++) { Q.drive({ my: 1, mx: 0, ud: 0, boost: true }); G.frame(1 / 60); } }; window.__step(150); });
const st = () => page.evaluate(() => { const h = window.__game.hero; return [h.state, +Math.hypot(h.vel.x, h.vel.z).toFixed(1)]; });
console.log(await st());
await page.screenshot({ path: `${out}/a_game.jpg`, type: 'jpeg', quality: 80 });
for (const [n, ax, up, d] of [['b_side', 1.57, 1.1, 3.4], ['c_front', 0.5, 1.3, 3.2], ['d_side2', -1.57, 1.0, 3.2]]) {
  await page.evaluate(([ax, up, d]) => { const G = window.__game, h = G.hero; G.filmCam = () => { const c = G.camera, a = h.heading + ax; c.fov = 40; c.updateProjectionMatrix(); c.position.set(h.drawPos.x + Math.sin(a) * d, h.drawPos.y + up - .3, h.drawPos.z + Math.cos(a) * d); c.lookAt(h.drawPos.x, h.drawPos.y + .1, h.drawPos.z); c.updateMatrixWorld(); }; window.__step(17); }, [ax, up, d]);
  await page.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 80 });
}
await page.evaluate(() => { const G = window.__game; G.filmCam = null; window.__step(30); });
await page.screenshot({ path: `${out}/e_game.jpg`, type: 'jpeg', quality: 80 });
console.log(await st(), errs.length ? errs.slice(0, 3) : 'no errors'); await b.close();
