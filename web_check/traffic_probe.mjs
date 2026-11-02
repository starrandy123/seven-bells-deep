// Run Saltlight's traffic for two minutes of game time and count how many cars move, stand at a red, or are stuck; and how many walkers wait or cross
import { createRequire } from 'module';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:8852/index.html?fresh&tier=phone&film&qa', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 90000 });
const out = await page.evaluate(() => {
  const G = window.__game, h = G.hero, V = h.pos.constructor; G.ember.setSide('fire', { place: false, quiet: true }); G.enemies.clearAll && G.enemies.clearAll(); h.respawn(new V(-646, 60, -640), 0); h.fireAir = true; h.air = true; h.fly = true; h.inv = 1e6;
  const L = G.streetLife, rows = [];
  for (let s = 0; s <= 120; s++) { for (let k = 0; k < 60; k++) { h.pos.set(-646, 60, -640); h.vel.set(0, 0, 0); G.frame(1 / 60); }
    if (s % 10 === 0) { const live = L.cars.filter((c) => c.out), mv = live.filter((c) => c.v > 0.5).length, inside = L.nodes.reduce((a, n) => a + n.inside.length, 0), stuckIn = L.nodes.filter((n) => n.inside.some((c) => c.v < 0.1)).length;
      const busy = L.nodes.reduce((a, n) => a + n.busy.N + n.busy.S + n.busy.E + n.busy.W, 0);
      rows.push({ t: s, cars: live.length, moving: mv, inside, nodesWithStoppedInside: stuckIn, walkers: L.people.filter((p) => p.out).length, cross: L.people.filter((p) => p.state === 'cross').length, wait: L.people.filter((p) => p.state === 'wait').length, busy }); } }
  return rows;
});
for (const r of out) console.log(JSON.stringify(r));
console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none'); await browser.close();
