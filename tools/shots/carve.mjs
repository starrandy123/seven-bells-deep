// the ride through a hard turn each way, in the game's own camera and around him. node carve.mjs <url> <out> [land]
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [url, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const b = await pw.webkit.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1.5 });
await ctx.addInitScript({ path: '/Users/randy/Documents/UnrealProjects/DrownedCity_part2/web_check/lib/qa_page.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url + 'index.html?film&fresh&tier=phone', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted && window.__game.frame, null, { timeout: 90000 });
await page.addStyleTag({ content: '#hud,#title,#hurt,#speedv{display:none!important}' });
await page.evaluate((process_sea) => { const G = window.__game, q = G.quest, Q = window.__qa; G.started = G.playing = true; q.events.hold(true); const ms = q.missions; for (const m of ms.active.slice()) ms.stop(m); if (G.enemies.clearAll) G.enemies.clearAll(); G.scene.traverse((o) => { if (o.renderOrder === 22 && o.material && o.material.uniforms && o.material.uniforms.uC) o.material.uniforms.uC.value.set(0); });
  const h = G.hero, sea = process_sea; h.inv = 1e6; if (sea) { const w = Q.openWater(120); Q.swimAt(w.x, w.y, -0.3); h.place(); Q.aim(w.ax, w.ay, 0); } else { Q.walkAt(-400, -600); h.place(); Q.aim(-1, 0.3, 0); } window.__step = (n, mx) => { for (let i = 0; i < n; i++) { Q.drive({ my: 1, mx, ud: 0, boost: true }); G.frame(1 / 60); G.camYaw = h.heading; } }; window.__step(240, 0); }, process.argv[4] !== 'land');
const read = () => page.evaluate(() => { const h = window.__game.hero; return { st: h.state, v: +Math.hypot(h.vel.x, h.vel.z).toFixed(1), lean: +((h.surfLean || 0) * 57.3).toFixed(1), rake: +((h.surfRake || 0) * 57.3).toFixed(1), carve: +(h.carve || 0).toFixed(2) }; });
const SIDE = (ax, up, d) => page.evaluate(([ax, up, d]) => { const G = window.__game, h = G.hero; G.filmCam = ax === null ? null : () => { const c = G.camera, a = h.heading + ax; c.fov = 40; c.updateProjectionMatrix(); c.position.set(h.drawPos.x + Math.sin(a) * d, h.drawPos.y + up, h.drawPos.z + Math.cos(a) * d); c.up.set(0, 1, 0); c.lookAt(h.drawPos.x, h.drawPos.y - .1, h.drawPos.z); c.updateMatrixWorld(); }; }, [ax, up, d]);
for (const [n, ax, up, d, seq] of [['a_game', null, 0, 0, [[0, 20], [1, 34], [-1, 60]]], ['b_behind', Math.PI, 0.9, 4.2, [[0, 40], [1, 34], [-1, 60]]], ['c_front', 0, 0.7, 4.2, [[0, 40], [1, 34], [-1, 60]]]]) {
  await SIDE(ax, up, d); let i = 0;
  for (const [mx, f] of seq) { await page.evaluate(([f, mx]) => window.__step(f, mx), [f, mx]); console.log(n, mx, JSON.stringify(await read())); await page.screenshot({ path: `${out}/${n}_${++i}.jpg`, type: 'jpeg', quality: 80 }); }
}
console.log(errs.length ? errs.slice(0, 3) : 'no errors'); await b.close();
