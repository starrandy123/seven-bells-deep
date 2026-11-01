// The combat rig: boots the real game headless, the draw stubbed unless a shot is wanted, and steps it by hand one fixed frame at a time.
import { createRequire } from 'module';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
export async function rig({ port = 8791, tier = 'phone', w = 844, h = 390, draw = false, limit = 150, engine = 'chromium', query = '' } = {}) {
  const kill = setTimeout(() => { console.log('✖ TIMED OUT at ' + limit + ' s'); process.exit(3); }, limit * 1000); kill.unref();
  const opts = { headless: true }; if (engine === 'chromium') opts.channel = 'chromium';
  const browser = await pw[engine].launch(opts).catch(() => pw[engine].launch({ headless: true }));
  const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('response', (q) => { if (q.status() >= 400) errors.push('http ' + q.status() + ' ' + q.url()); });
  await page.goto(`http://127.0.0.1:${port}/index.html?film&fresh&tier=${tier}${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 45000 }).catch((e) => { console.log('✖ no boot', errors.slice(0, 6)); throw e; });
  await page.evaluate((draw) => {
    const G = window.__game; if (!draw) { G.__render = G.look.render; G.look.render = () => {}; }
    G.quest.debugRingAll(); G.hero.powers.ice = true;
    for (const e of G.enemies.encounters) { e.cleared = true; e.state = 'idle'; } G.enemies.clearAll();
    G.frame(1 / 60);
  }, draw);
  return { browser, page, errors, close: async () => { await browser.close(); } };
}
