// The world as the game really draws it: the look builder's page, my viewpoints. Run under heavy.sh, always.
//   node game_shots.mjs <tag> <name,name,...> [desktop|phone]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire('/Users/randy/Documents/package.json');
const pw = require('playwright');
const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, 'preview');
const [tag = 'g', names = 'meridon', tier = 'desktop'] = process.argv.slice(2);
const V = JSON.parse(fs.readFileSync(path.join(here, 'views.json'), 'utf8'));
const [w, h] = tier === 'phone' ? [844, 390] : [1280, 720];
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium' }).catch(() => pw.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tier === 'phone' ? 2 : 1 });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push('error ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await page.goto(`${process.env.GAME_BASE || 'http://127.0.0.1:8791'}/look_test.html?cam=reef&tier=${tier}&still`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__look && (window.__look.ready || window.__look.error), null, { timeout: 90000 });
const err = await page.evaluate(() => window.__look.error);
if (err) console.log('page error', err);
// the region packs stream after first play: step the world until their near meshes are in, or these are pictures of far meshes
await page.evaluate(async () => { const L = window.__look; for (let i = 0; i < 400 && L.world && L.world.packsDone === false; i++) { L.step(2); await new Promise((r) => setTimeout(r, 30)); } });
await page.evaluate(() => window.__look.pause(true));
for (const n of names.split(',')) {
  const v = V[n];
  if (!v) { console.log('no view', n); continue; }
  const under = await page.evaluate((v) => { const w = window.__look.world; return w && w.heightAt ? w.heightAt(v.from[0], v.from[1]) : null; }, v);
  if (under !== null && under > v.from[2]) console.log(`  ! ${n}: the camera is ${(under - v.from[2]).toFixed(1)} m under the ground: this shot shows the back of the terrain`);
  const url = await page.evaluate(async (v) => {
    const L = window.__look, c = L.camera, T = L.three;
    const W = (p) => new T.Vector3(p[0], p[2], -p[1]);
    for (let k = 0; k < 40; k++) { c.position.copy(W(v.from)); c.up.set(0, 1, 0); c.lookAt(W(v.to)); c.updateMatrixWorld(); L.step(1); }
    c.position.copy(W(v.from)); c.lookAt(W(v.to)); c.updateMatrixWorld(); L.step(1);
    return L.shot();
  }, v);
  const f = path.join(out, `game_${tag}_${n}.jpg`);
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  const s = await page.evaluate(() => { const L = window.__look.stats(); return { calls: L.calls, tris: L.triangles }; });
  console.log(n, JSON.stringify(s));
}
await browser.close();
console.log(logs.slice(0, 6).join('\n'));
