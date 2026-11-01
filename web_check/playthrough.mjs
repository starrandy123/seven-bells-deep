// The whole game, fast: the bot plays from the reef to the Leviathan with the clock stepped by hand. Prints each change of state.
//   node playthrough.mjs [url] [real seconds=170]
import { createRequire } from 'module';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [url = 'http://127.0.0.1:8791/index.html?demo&film&fresh&tier=phone', secs = '170'] = process.argv.slice(2);
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium' }).catch(() => pw.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } }); const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 120000 });
const t0 = Date.now(); let last = '', stuck = 0, lastPos = null;
while (Date.now() - t0 < +secs * 1000) {
  const s = await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 40; i++) G.frame(0.0833); const h = G.hero, t = G.quest.target();
    return { t: Math.round(G.time), pos: [h.pos.x, h.pos.y, h.pos.z].map((v) => Math.round(v)), st: h.state, hp: Math.round(h.hp), rung: G.quest.rungCount(), foes: G.enemies.count(), boss: G.boss.active ? Math.round(G.boss.hp) : null, mode: G.boss.active ? G.boss.mode : '', dead: h.dead, won: G.boss.dead, dist: t ? Math.round(t.distanceTo(h.pos)) : null, pearls: G.quest.pearlCount() }; });
  const key = `${s.rung}|${s.foes}|${s.dead}|${s.boss === null}|${s.mode}|${s.won}`;
  if (key !== last) { console.log(JSON.stringify(s)); last = key; }
  const p = s.pos.join(); if (p === lastPos) stuck++; else stuck = 0; lastPos = p;
  if (stuck === 12) console.log('STUCK', JSON.stringify(s));
  if (s.won && s.boss === null) break;
}
console.log('end', await page.evaluate(() => { const G = window.__game; return JSON.stringify({ t: G.time, rung: G.quest.rungCount(), bossHp: G.boss.hp, won: G.boss.dead }); }));
console.log('errors', errors.length ? [...new Set(errors)].slice(0, 12).join('\n') : 'none');
await browser.close();
