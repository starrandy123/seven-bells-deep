// His face and body at the closest the game shows them, on a tier: node move_face.mjs <base> chromium --out=dir --tier=phone
// The hero stands on land, the camera is set by hand, the frame is the game's own render. Not a wall: stills to judge a texture size by eye.
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const args = process.argv.slice(2), base = args[0], opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const out = opt('out', '/tmp/move_face'), tier = opt('tier', 'phone'); fs.mkdirSync(out, { recursive: true });
setTimeout(() => { console.log('TIMED OUT at 120 s (own limit)'); process.exit(3); }, 120000).unref();
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium' }).catch(() => pw.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?film&fresh&tier=${tier}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 90000 });
await page.evaluate(() => { const G = window.__game; G.started = G.playing = true; document.getElementById('title')?.classList.remove('on'); });
const spots = await page.evaluate(() => {
  const G = window.__game, h = G.hero, Q = window.__qa, size = G.world.data.size_m / 2, H = (x, z) => G.world.heightAt(x, -z); let spot = null;
  for (let x = -size; x < size && !spot; x += 9) for (let z = -size; z < size; z += 9) { if (H(x, z) < 2 || Math.abs(H(x + 3, z) - H(x, z)) > 0.5) continue; const p = { x, y: -z, z: H(x, z) + 1.6 }; if (!G.world.collide(p, 1.2)) { spot = { x, z }; break; } }
  h.pos.set(spot.x, H(spot.x, spot.z) + 0.92, spot.z); h.vel.set(0, 0, 0); h.land = true; h.air = false; h.grounded = true; h.spd = 0; h.heading = 0; G.camYaw = 0; h.place(); window.__spot = spot; return spot;
});
const shots = [['face_near', 0.42, 1.62, 0.0, 36], ['face_cine', 0.8, 1.6, 0.4, 30], ['chest', 1.3, 1.4, -0.5, 40], ['whole', 3.4, 1.2, 0.5, 50]];
for (const [name, dist, up, side, fov] of shots) {
  await page.evaluate(([dist, up, side, fov]) => { const G = window.__game, h = G.hero, cam = G.camera, base = { camera: h.camera }; if (!window.__c) { window.__c = h.camera; } h.camera = () => { const y = h.pos.y - 0.92; cam.position.set(h.pos.x + side, y + up, h.pos.z + dist); cam.up.set(0, 1, 0); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(h.pos.x, y + up - 0.02, h.pos.z); }; for (let i = 0; i < 6; i++) G.frame(1 / 60); }, [dist, up, side, fov]);
  await page.screenshot({ path: path.join(out, `${tier}_${name}.jpg`), type: 'jpeg', quality: 90 });
}
// a Reaver at the closest a fight brings one: two shots of the first that comes up
await page.evaluate(() => { const G = window.__game, h = G.hero, cam = G.camera; h.inv = 1e6; const p = h.pos.clone(); p.z -= 1.6; p.y -= 0.9; const e = G.enemies.spawn('reaver', p); window.__e = e; });
for (const [name, dist, up, side, fov] of [['reaver_near', 1.1, 1.5, 0.3, 40], ['reaver_whole', 2.6, 1.1, 0.6, 50]]) {
  await page.evaluate(([dist, up, side, fov]) => { const G = window.__game, h = G.hero, cam = G.camera, e = window.__e; h.camera = () => { if (!e) return; cam.position.set(e.pos.x + side, h.pos.y - 0.92 + up, e.pos.z + dist); cam.up.set(0, 1, 0); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(e.pos.x, h.pos.y - 0.92 + up - 0.1, e.pos.z); }; for (let i = 0; i < 6; i++) G.frame(1 / 60); }, [dist, up, side, fov]);
  await page.screenshot({ path: path.join(out, `${tier}_${name}.jpg`), type: 'jpeg', quality: 90 });
}
const foeTex = await page.evaluate(() => { const e = window.__e, out = []; const o = e && (e.mesh || e.root || e.group || e.obj); (o || window.__game.scene).traverse && (o || { traverse() {} }).traverse((m) => { if (m.isMesh && m.material && m.material.map && m.material.map.image) out.push([m.material.map.image.width, m.material.map.image.height]); }); return { made: !!e, tex: out.slice(0, 3) }; });
console.log(JSON.stringify(foeTex));
const tex = await page.evaluate(() => { const G = window.__game, out = []; G.hero.root.traverse((o) => { if (o.isMesh && o.material) { for (const k of ['map', 'normalMap', 'emissiveMap', 'roughnessMap']) { const t = o.material[k]; if (t && t.image) out.push([k, t.image.width, t.image.height]); } } }); return out; });
console.log(JSON.stringify({ tier, spots, tex, errors: errors.slice(0, 4) }));
await browser.close(); process.exit(0);
