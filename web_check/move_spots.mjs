// Where the arm comes up short: he's put at each spot, at eight headings, and held there; the arm's length is read and the last frame shot. Not a wall: for finding out why.
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const args = process.argv.slice(2), base = args[0], opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const out = opt('out', '/tmp/move_spots'); fs.mkdirSync(out, { recursive: true });
const spots = JSON.parse(opt('spots', '[[416,65,-92],[440,80,-85],[420,60,-100],[440,40,-80]]'));
setTimeout(() => { console.log('TIMED OUT at 150 s (own limit)'); process.exit(3); }, 150000).unref();
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium' }).catch(() => pw.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 }); const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?film&fresh&tier=phone`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 90000 });
await page.evaluate(() => { const G = window.__game; G.started = G.playing = true; document.getElementById('title')?.classList.remove('on'); });
for (const [n, s] of spots.entries()) {
  const row = await page.evaluate(([x, y, z]) => { const G = window.__game, h = G.hero, dt = 1 / 60, out = []; G.bot = null; h.inv = 1e6;
    for (let k = 0; k < 8; k++) { const yaw = k * Math.PI / 4; h.pos.set(x, z, -y); h.vel.set(0, 0, 0); h.land = false; h.air = false; h.spd = 0; h.state = 'swim'; h.place(); G.camYaw = yaw; G.camPitch = 0; h.heading = yaw; for (let i = 0; i < 90; i++) { G.frame(dt); } const c = G.camera.position; out.push(+Math.hypot(c.x - h.pos.x, c.y - h.pos.y, c.z - h.pos.z).toFixed(2)); }
    const px = h.pos.x, py = -h.pos.z, pz = h.pos.y, list = []; for (const c of G.world.data.colliders) { const R = Math.hypot(c.hx || c.r || 0, c.hy || 0) + 6; if (Math.abs(c.x - px) > R || Math.abs(c.y - py) > R || c.z1 < pz - 8 || c.z0 > pz + 8) continue; list.push({ t: c.t, x: +c.x.toFixed(1), y: +c.y.toFixed(1), z0: +c.z0.toFixed(1), z1: +c.z1.toFixed(1), hx: c.hx && +c.hx.toFixed(1), hy: c.hy && +c.hy.toFixed(1), r: c.r && +c.r.toFixed(1), yaw: c.yaw && +c.yaw.toFixed(2), off: c.off ? 1 : 0 }); }
    return { at: [+px.toFixed(1), +py.toFixed(1), +pz.toFixed(1)], g: +G.world.heightAt(px, py).toFixed(1), arms: out, near: list.slice(0, 10) }; }, s);
  console.log(JSON.stringify(row)); await page.screenshot({ path: path.join(out, `spot_${n}.jpg`), type: 'jpeg', quality: 85 });
}
console.log(JSON.stringify({ errors: errors.slice(0, 4) }));
await browser.close(); process.exit(0);
