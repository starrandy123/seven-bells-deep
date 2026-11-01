// Swim ashore, walk, sprint, jump, go back in. Prints the state, saves pictures.
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [out = '/tmp/land', tier = 'desktop'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium' }).catch(() => pw.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
await page.goto(`http://127.0.0.1:8791/index.html?film&fresh&tier=${tier}`, { waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 120000 });
await page.evaluate(() => { const G = window.__game; G.started = G.playing = true; document.getElementById('title').classList.remove('on'); document.getElementById('hud').classList.add('on');
  G.hero.pos.set(-120, -2, 423); G.hero.prev.copy(G.hero.pos); G.camYaw = G.hero.heading = -Math.PI / 2 - 0.1; G.camPitch = 0.02;
  G.script = { my: 1, boost: false, jump: false, ud: 0 }; G.bot = { drive(u) { const s = G.script; u.my = s.my; u.mx = 0; u.ud = s.ud; u.boost = s.boost; if (s.jump) { u.jump = true; s.jump = false; } } }; });
const run = async (label, secs, set) => {
  await page.evaluate((s) => Object.assign(window.__game.script, s), set || {});
  const n = Math.round(secs * 30);
  for (let i = 0; i < n; i += 15) {
    const s = await page.evaluate(() => { const G = window.__game; for (let k = 0; k < 15; k++) G.frame(1 / 30); const h = G.hero; return { t: +G.time.toFixed(1), p: [h.pos.x, h.pos.y, h.pos.z].map((v) => +v.toFixed(1)), g: +G.world.heightAt(h.pos.x, -h.pos.z).toFixed(1), sp: +h.speed.toFixed(1), land: h.land, air: h.air, st: h.state }; });
    if (i % 30 === 0) console.log(label, JSON.stringify(s));
  }
  await page.screenshot({ path: `${out}/${label}.png` });
};
await run('swim_in', 5); await run('walkrun', 4); await run('sprint', 3, { boost: true }); await run('jump', 1, { jump: true }); await run('stand', 2, { my: 0, boost: false });
console.log('errors', errors.length ? [...new Set(errors)].slice(0, 12).join('\n') : 'none');
await browser.close();
