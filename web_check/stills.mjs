// Stills of named moments, stepped: node stills.mjs <out> <w> <h> <tier> <name,name,...>
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [out = '/tmp/stills', w = '1280', h = '720', tier = 'desktop', only = ''] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium' }).catch(() => pw.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: +w, height: +h } }); const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:8791/index.html?demo&film&fresh&tier=${tier}`, { waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud,#hurt,#speedv{display:none!important}' });
const step = (n, dt = 1 / 30) => page.evaluate(([n, dt]) => { const G = window.__game; for (let i = 0; i < n; i++) G.frame(dt); }, [n, dt]);
const shots = {
  async boss() {
    await page.evaluate(() => { const G = window.__game, a = G.world.data.arena; G.quest.debugRingAll(); G.hero.pos.set(a.x, a.z + 7, -a.y + 10); G.hero.prev.copy(G.hero.pos); });
    await step(130, 1 / 20); await page.screenshot({ path: out + '/boss1.png' }); await step(60, 1 / 20); await page.screenshot({ path: out + '/boss2.png' }); await step(50, 1 / 20); await page.screenshot({ path: out + '/boss3.png' });
    await page.evaluate(() => { const G = window.__game; G.boss.stop(); });
  },
  async reaver() {
    await page.evaluate(() => { const G = window.__game; const e = G.enemies.encounters.find((x) => x.id === 'kelp_court') || G.enemies.encounters[1]; G.hero.pos.copy(e.c).add({ x: 0, y: 2, z: 0 }); G.hero.prev.copy(G.hero.pos); });
    await step(120, 1 / 20); await page.screenshot({ path: out + '/reaver1.png' }); await step(25, 1 / 20); await page.screenshot({ path: out + '/reaver2.png' });
  },
  async powers() {
    await page.evaluate(() => { const G = window.__game; G.bot = null; G.quest.debugRingAll(); G.enemies.clearAll(); const e = G.enemies.encounters.find((x) => x.id === 'kelp_court') || G.enemies.encounters[1]; e.state = 'idle'; e.cleared = false; e.cool = 0; G.hero.pos.copy(e.c).add({ x: 4, y: 3, z: 6 }); G.hero.prev.copy(G.hero.pos); G.hero.tide = G.hero.maxTide = 300; G.hero.hp = G.hero.maxHp = 400; });
    await step(90, 1 / 20);
    const fire = async (k, name, frames) => { await page.evaluate((k) => { const G = window.__game; G.ui.input[k] = true; for (const c in G.hero.cool) G.hero.cool[c] = 0; }, k); await step(frames); await page.screenshot({ path: out + '/' + name + '.png' }); await step(30); };
    await fire('spin', 'p_spin', 14); await fire('wave', 'p_wave', 20); await fire('call', 'p_call', 26); await fire('dash', 'p_dash', 9); await fire('atk', 'p_atk', 9); await step(8); await page.evaluate(() => { window.__game.ui.input.atk = true; }); await step(9); await page.evaluate(() => { window.__game.ui.input.atk = true; }); await step(24); await page.screenshot({ path: out + '/p_atk3.png' });
  },
  async whale() {
    await page.evaluate(() => { const G = window.__game, w = G.life.whales[0]; G.bot = null; G.hero.pos.copy(w.position || w.pos); G.hero.pos.y += 5; G.hero.prev.copy(G.hero.pos); G.enemies.clearAll(); G.ui.input.ride = false; });
    await step(12); await page.evaluate(() => { window.__game.ui.input.ride = true; }); await step(100); await page.screenshot({ path: out + '/whale1.png' });
    await page.evaluate(() => { const G = window.__game; G.camYaw += 1.5; }); await step(40); await page.screenshot({ path: out + '/whale2.png' });
  },
};
for (const k of (only ? only.split(',') : Object.keys(shots))) { console.log('shot', k); await shots[k](); }
console.log('errors', errors.length ? [...new Set(errors)].slice(0, 8).join('\n') : 'none'); await browser.close();
