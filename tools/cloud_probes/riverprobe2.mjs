// The carved rivers and the falls' pool in the game: wide and close on the falls, along the stream it feeds, the beck, and him wading.
import { createRequire } from 'module'; const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const out = process.argv[2], tag = process.argv[3] || 'r1';
const t0 = Date.now(), log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(0).padStart(5) + 's', ...a);
const browser = await pw.chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await ctx.addInitScript({ path: '/home/user/seven-bells-deep/web_check/lib/qa_page.js' });
await ctx.addInitScript({ path: out + '/tools/film.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || /warn/i.test(m.type())) errs.push(m.type() + ': ' + m.text().slice(0, 400)); });
await page.goto('http://127.0.0.1:8843/index.html?film&fresh&tier=desktop', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 1800000 }); log('booted');
const info = await page.evaluate(() => { const G = window.__game; window.__qa.start(); G.bot = null; for (const k of ['toast','card','bark','tip','place','event']) G.ui[k] = () => {}; const st = document.createElement('style'); st.textContent = '#hud{display:none!important}'; document.head.appendChild(st); if (G.sky && G.sky.setHour) G.sky.setHour(0.42); window.__film.quiet();
  const P = G.world.rivers; if (!P) return { none: true };
  const pl = P.pools[0], cl = P.rivers.find((r) => r.id === 'crown_lower'), sb = P.rivers.find((r) => r.id === 'sunward_beck');
  return { stats: P.stats, pool: { W: pl.W, cx: pl.cx, cy: pl.cy, ra: pl.ra, rb: pl.rb, fx: pl.ft.x, fy: pl.ft.y, ox: pl.ux, oy: pl.uy }, cl: [20, 30, 45].map((i) => [cl.X[i], cl.Y[i], cl.W[i], cl.TX[i], cl.TY[i]]), sb: [60, 100, 150].map((i) => [sb.X[i], sb.Y[i], sb.W[i], sb.TX[i], sb.TY[i]]), fall: G.world.data.waterfalls[0] };
});
log('plan', JSON.stringify(info).slice(0, 900));
const shot = async (name, keys, frames = 50) => {
  await page.evaluate(([keys, frames]) => { const G = window.__game; window.__film.path(keys, { hideHero: true }); for (let i = 0; i < frames; i++) G.frame(1 / 30); }, [keys, frames]);
  await page.screenshot({ path: `${out}/${tag}_${name}.png`, timeout: 900000 }); log('shot', name);
};
const p = info.pool, f = info.fall;
// the falls from out in front and a little up: the sheet, its pool and the stream leaving it
await shot('falls_wide', [{ t: 0, p: [p.fx + p.ox * 34 + p.oy * 6, p.fy + p.oy * 34 - p.ox * 6, p.W + 7], at: [f.x, f.y, (f.z0 + p.W) / 2 - 3], fov: 55 }]);
// the pool close, from its side, a little above the water
await shot('pool_close', [{ t: 0, p: [p.cx + p.oy * 11 + p.ox * 5, p.cy - p.ox * 11 + p.oy * 5, p.W + 2.4], at: [p.fx, p.fy, p.W + 1.2], fov: 60 }]);
// the stream it feeds: from above, looking down its course
const [cx, cy, cw, ctx_, cty] = info.cl[0];
await shot('stream_above', [{ t: 0, p: [cx - ctx_ * 9, cy - cty * 9, cw + 6], at: [cx + ctx_ * 14, cy + cty * 14, cw - 1], fov: 55 }]);
// low on its bank, looking along it
const [dx, dy, dw, dtx, dty] = info.cl[1];
await shot('stream_bank', [{ t: 0, p: [dx - dty * 4.5 - dtx * 3, dy + dtx * 4.5 - dty * 3, dw + 1.4], at: [dx + dtx * 10, dy + dty * 10, dw], fov: 60 }]);
log('errors', JSON.stringify(errs.slice(0, 8)));
await browser.close();
