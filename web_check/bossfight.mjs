// The Leviathan alone: rings the bells by hand, puts the Warden in the arena, lets the bot fight, prints each change.
import { createRequire } from 'module';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [url = 'http://127.0.0.1:8791/index.html?demo&film&fresh&tier=phone', secs = '150'] = process.argv.slice(2);
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium' }).catch(() => pw.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } }); const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 120000 });
await page.evaluate(() => { const G = window.__game, a = G.world.data.arena; G.quest.debugRingAll(); G.hero.pos.set(a.x, a.z + 6, -a.y); G.hero.prev.copy(G.hero.pos); });
const t0 = Date.now(); let last = ''; let deaths = 0;
while (Date.now() - t0 < +secs * 1000) {
  const s = await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 40; i++) G.frame(0.0833); const h = G.hero, b = G.boss;
    return { t: Math.round(G.time), pos: [h.pos.x, h.pos.y, h.pos.z].map((v) => Math.round(v)), hp: Math.round(h.hp), st: h.state, boss: b.active, bhp: Math.round(b.hp), mode: b.mode, foes: G.enemies.count(), won: b.dead, head: b.active ? [b.head.x, b.head.y, b.head.z].map((v) => Math.round(v)) : null, dist: b.active ? Math.round(b.head.distanceTo(h.pos)) : null }; });
  const key = `${s.mode}|${Math.floor(s.bhp / 200)}|${s.st === 'dead'}|${s.won}`;
  if (key !== last) { console.log(JSON.stringify(s)); last = key; if (s.st === 'dead') deaths++; }
  if (s.won && !s.boss) break;
}
console.log('deaths', deaths, 'errors', errors.length ? [...new Set(errors)].slice(0, 12).join('\n') : 'none');
await browser.close();
