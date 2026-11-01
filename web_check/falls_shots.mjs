// W23, W26: Crown Falls and its cliffs from fixed cameras, on the real GPU, for a person to read. One of the cameras is the frame he called a sheet of paper.
//   node falls_shots.mjs <base> <out> [chromium|webkit] [phone|desktop] [name,name]
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [base = 'http://127.0.0.1:8851/index.html', out = '/tmp/falls', engine = 'chromium', tier = 'phone', only = ''] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const opts = { headless: true }; if (engine === 'chromium') { opts.channel = 'chromium'; opts.args = ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist']; }
const browser = await pw[engine].launch(opts);
const VIEW = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }, wide: { viewport: { width: 960, height: 540 } } };
for (const form of ['phone', 'wide']) {
  const ctx = await browser.newContext(VIEW[form]); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}?film&fresh&tier=${tier}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.booted && window.__game.frame, null, { timeout: 90000 });
  await page.addStyleTag({ content: '#hud,#hurt,#speedv,#title,#bars{display:none!important}' });
  const info = await page.evaluate(() => { const G = window.__game, P = G.world.rivers, pl = P.pools[0], f = pl.f, h = G.hero; G.started = G.playing = true; G.quest.events && G.quest.events.hold && G.quest.events.hold(true); const ms = G.quest.missions; for (const m of ms.active.slice()) ms.stop(m); if (G.enemies.clearAll) G.enemies.clearAll();
    h.pos.set(pl.cx, pl.W + 1.5, -pl.cy); h.prev.copy(h.pos); h.drawPos.copy(h.pos); h.inv = 1e6; h.vel.set(0, 0, 0);
    window.__cam = { p: [0, 0, 0], at: [0, 0, 0], fov: 55 };
    G.scene.traverse((o) => { if (o.renderOrder === 22 && o.material && o.material.uniforms && o.material.uniforms.uC) o.material.uniforms.uC.value.set(0); });      // the objective's beacon: not part of the place
    G.filmCam = () => { const c = G.camera, v = window.__cam; c.fov = v.fov; c.updateProjectionMatrix(); c.position.set(v.p[0], v.p[2], -v.p[1]); c.lookAt(v.at[0], v.at[2], -v.at[1]); c.updateMatrixWorld(); };
    const rv = P.rivers.find((r) => r.pool === pl), bk = P.rivers.find((r) => r.id === 'sunward_beck'); const at = (r, i) => [r.X[i], r.Y[i], r.W[i]];
    return { W: pl.W, fx: pl.ft.x, fy: pl.ft.y, ox: pl.ux, oy: pl.uy, f: { x: f.x, y: f.y, z0: f.z0, z1: f.z1, w: f.w }, ra: pl.ra, rb: pl.rb, hx: pl.cx, hy: pl.cy, s0: at(rv, rv.iOut + 26), s1: at(rv, rv.iOut + 2), b0: at(bk, 150), b1: at(bk, 118) }; });
  const { W, fx, fy, ox, oy, f } = info, mid = (f.z0 + W) / 2;
  const cams = {
    falls_wide: { p: [fx + ox * 34 + oy * 6, fy + oy * 34 - ox * 6, W + 7], at: [f.x, f.y, mid - 3], fov: 55 },
    falls_near: { p: [fx + ox * 17 - oy * 2, fy + oy * 17 + ox * 2, W + 3.2], at: [fx, fy, mid], fov: 62 },
    falls_side: { p: [fx + ox * 4 + oy * 26, fy + oy * 4 - ox * 26, W + 8], at: [fx, fy, mid - 2], fov: 50 },
    cliff_left: { p: [fx + ox * 30 - oy * 22, fy + oy * 30 + ox * 22, W + 6], at: [fx + oy * 26, fy - ox * 26, W + 9], fov: 55 },
    crest: { p: [f.x + ox * 3 - oy * 16, f.y + oy * 3 + ox * 16, f.z0 + 6], at: [f.x + ox * 16 + oy * 16, f.y + oy * 16 - ox * 16, f.z0 - 8], fov: 60 },
    stream: { p: [info.s0[0], info.s0[1], info.s0[2] + 1.7], at: [info.s1[0], info.s1[1], info.s1[2] + 1.2], fov: 58 },
    hero: { p: [info.hx + 5, info.hy + 5, info.W + 2.4], at: [info.hx, info.hy, info.W + 1], fov: 50 },
    beck: { p: [info.b0[0], info.b0[1], info.b0[2] + 1.7], at: [info.b1[0], info.b1[1], info.b1[2] + .6], fov: 58 },
  };
  for (const [name, c] of Object.entries(cams)) {
    if (only && !only.split(',').includes(name)) continue;
    await page.evaluate((c) => { window.__cam.p = c.p; window.__cam.at = c.at; window.__cam.fov = c.fov; const G = window.__game; for (let i = 0; i < 40; i++) G.frame(1 / 30); }, c);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${out}/${form}_${name}.jpg`, type: 'jpeg', quality: 82 });
  }
  const st = await page.evaluate(() => { const i = window.__game.renderer.info.render; return { calls: i.calls, tris: i.triangles }; });
  console.log(form, JSON.stringify(info.f), JSON.stringify(st), errs.length ? errs.slice(0, 3) : 'no errors');
  await ctx.close();
}
await browser.close();
