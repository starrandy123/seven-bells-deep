// Land probe: how steep the islands are, what he does up real slopes at a run and a sprint, and pictures of the land water and the falls.
import { createRequire } from 'module'; const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const out = process.argv[2];
const browser = await pw.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
await ctx.addInitScript({ path: '/home/user/seven-bells-deep/web_check/lib/qa_page.js' }); await ctx.addInitScript({ path: '/tmp/claude-0/-home-user-seven-bells-deep/7c3468ca-0f0b-55b7-8f7d-22ef437fcb91/scratchpad/tools/film.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:8843/index.html?film&fresh&tier=phone', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 900000 });
await page.evaluate(() => { const G = window.__game; window.__qa.start(); G.bot = null; G.filmCam = null; G.quest.debugRingAll(); for (const k of ['toast','card','bark','tip','place','event']) G.ui[k] = () => {}; const st = document.createElement('style'); st.textContent = '#hud{display:none!important}'; document.head.appendChild(st); });
// 1. the islands' slopes: a grid over land, the angle at each land point
const hist = await page.evaluate(() => { const W = window.__game.world, b = [0,0,0,0,0,0,0,0,0,0], pts = {}; for (let x = -1000; x <= 1000; x += 6) for (let y = -1000; y <= 1000; y += 6) { const z = W.heightAt(x, y); if (z < 1) continue; const gx = (W.heightAt(x+1,y)-W.heightAt(x-1,y))/2, gy = (W.heightAt(x,y+1)-W.heightAt(x,y-1))/2, a = Math.atan(Math.hypot(gx,gy))*180/Math.PI; b[Math.min(9, Math.floor(a/6))]++; const k = Math.round(a/10)*10; if (!pts[k] && z > 4) pts[k] = [x, y, z, gx, gy]; } return { b, pts }; });
console.log('slopes per 6 deg band (0-6,6-12,...,54+):', JSON.stringify(hist.b)); console.log('sample points by angle:', JSON.stringify(hist.pts));
// 2. up each slope: face up the gradient, run then sprint, 3 s each
for (const ang of [10, 20, 30, 40]) {
  const p = hist.pts[ang]; if (!p) continue;
  for (const boost of [false, true]) {
    const r = await page.evaluate(([p, boost]) => { const G = window.__game, Q = window.__qa, h = G.hero; Q.walkAt(p[0], p[1]); const l = Math.hypot(p[3], p[4]); const dx = p[3]/l, dy = p[4]/l;   // uphill in Blender x,y; game z = -y
      G.camYaw = Math.atan2(dx, -dy); Q.drive({ my: 1, mx: 0, ud: 0, boost }); const log = []; const y0 = h.pos.y;
      for (let i = 0; i < 90; i++) { G.frame(1/30); if (i % 15 === 14) log.push([+(h.spd||0).toFixed(1), +(h.pos.y - y0).toFixed(1), h.land ? 'land' : h.air ? 'air' : h.state]); }
      return { log, rise: +(h.pos.y - y0).toFixed(1) }; }, [p, boost]);
    console.log(`slope ~${ang} deg ${boost ? 'SPRINT' : 'run   '}: speed/rise every 0.5 s ${JSON.stringify(r.log)}`);
  }
}
// 3. pictures: Sunward Beck from its bank, Crown Falls from below
const shots = [['river', -470, -548, 0.2, -1, 0], ['river2', -400, -545, 1, 0.2, 0], ['falls', 381.8 + 18 * Math.sin(-0.244), -305.1 - 18 * Math.cos(-0.244), 0, 1, 0.25]];
for (const [n, x, y, ax, ay] of shots) {
  await page.evaluate(([x, y, ax, ay]) => { const G = window.__game, Q = window.__qa; Q.walkAt(x, y); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); G.camYaw = Math.atan2(ax, -ay); for (let i = 0; i < 30; i++) G.frame(1/30); }, [x, y, ax, ay]);
  await page.screenshot({ path: `${out}/land_${n}.png`, timeout: 600000 });
}
console.log('errors', errs.slice(0, 3)); await browser.close();
