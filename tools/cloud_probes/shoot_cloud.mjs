// Film the real game frame by frame from a frozen snapshot. The page steps itself (?film), so a shot plays at real speed whatever the machine does: each frame moves the game's own clock by 1/fps.
// Cloud copy: the same as shoot.mjs, with Playwright from this container (/opt/node-tools) instead of the Mac path. Software WebGL: ~2.7 s a frame at 1080 x 2338, so set SHOOT_LIMIT.
//   node shoot.mjs <out dir> <plan.json> [w=540] [h=540] [scale=2] [fps=30]
// plan: { url, engine: 'chromium'|'webkit', hud: false, touch: false, shots: [ { name, seconds, setup, each, warm, log } ] }
//   setup: js run once, with G, F (film.js helpers), Q (the checks' helpers).  each: js run before each frame, with G, F, Q, t, i.   log: an expression read after each frame, written to <name>.log.json
// Reads no game file for writing, changes nothing on disk outside <out dir>. Own limit 170 s, so a job never sits on the heavy lock: a shot that runs out says so and writes what it has.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const require = createRequire('/opt/node-tools/node_modules/'); const pw = require('playwright');
const [out, planFile, w = '540', h = '540', scale = '2', fps = '30'] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8')); fs.mkdirSync(out, { recursive: true });
const LIMIT = +(process.env.SHOOT_LIMIT || 170) * 1000, t0 = Date.now(); let timedOut = false;
const here = path.dirname(new URL(import.meta.url).pathname);
const eng = plan.engine === 'webkit' ? pw.webkit : pw.chromium;
const browser = plan.engine === 'webkit' ? await eng.launch({ headless: true }) : await eng.launch({ headless: true, channel: 'chromium' }).catch(() => eng.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale, hasTouch: !!plan.touch, isMobile: !!plan.touch && plan.engine !== 'webkit' });
await ctx.addInitScript({ path: path.join(here, '../../../web_check/lib/qa_page.js') });
await ctx.addInitScript({ path: path.join(here, 'film.js') });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.text().startsWith('[film]')) console.log(m.text()); });
await page.goto(plan.url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 120000 });
if (!plan.hud) await page.addStyleTag({ content: '#hud,#hurt{display:none!important}' });
// the region packs stream after first play: step until the near meshes are in, or these are pictures of far meshes
await page.evaluate(async () => { const G = window.__game, x0 = G.hero.pos.x; for (let i = 0; i < 700 && G.world.packsDone === false; i++) { G.frame(1 / 60); if (i === 2) { G.hero.pos.x += 2; G.hero.prev.copy(G.hero.pos); } await new Promise((r) => setTimeout(r, 12)); } G.hero.pos.x = x0; G.hero.prev.copy(G.hero.pos); });
console.log('booted', Math.round((Date.now() - t0) / 1000), 's; packs', await page.evaluate(() => window.__game.world.packsDone));
for (const shot of plan.shots) {
  const dir = path.join(out, shot.name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  if (shot.setup) await page.evaluate(new Function('code', 'const G = window.__game, F = window.__film, Q = window.__qa; return eval(code);'), shot.setup);
  const step = 1 / +fps, warm = shot.warm ?? 20;
  for (let i = 0; i < warm; i++) await page.evaluate(([dt, each]) => { const G = window.__game; if (each) (new Function('G', 'F', 'Q', 't', 'i', each))(G, window.__film, window.__qa, 0, 0); G.frame(dt); }, [step, shot.warmEach || '']);
  if (shot.warmUntil) { let left = shot.warmMax ?? 1800, hit = false; while (left > 0 && !hit && Date.now() - t0 < LIMIT) { hit = await page.evaluate(([dt, cond, each]) => { const G = window.__game, F = window.__film, Q = window.__qa, C = new Function('G', 'F', 'Q', 'return ' + cond), E = each ? new Function('G', 'F', 'Q', 't', 'i', each) : null; for (let k = 0; k < 90; k++) { if (C(G, F, Q)) return true; if (E) E(G, F, Q, 0, 0); G.frame(dt); } return C(G, F, Q); }, [step, shot.warmUntil, shot.warmEach || '']); left -= 90; } console.log('warmUntil', shot.name, hit, 'game time', await page.evaluate(() => +window.__game.time.toFixed(1))); }
  if (shot.still) { await page.screenshot({ path: path.join(out, shot.name + '.jpg'), type: 'jpeg', quality: 90 }); fs.rmSync(dir, { recursive: true, force: true }); console.log('still', shot.name, await page.evaluate(() => { const r = window.__game.renderer.info.render; return r.calls + ' calls ' + r.triangles + ' tris'; })); continue; }
  const n = Math.round(shot.seconds * +fps), rows = []; let done = 0;
  for (let i = 0; i < n; i++) {
    if (Date.now() - t0 > LIMIT) { timedOut = true; console.log('OWN LIMIT reached at frame', i, 'of', n, 'in', shot.name); break; }
    const row = await page.evaluate(([dt, each, t, k, log]) => { const G = window.__game; if (each) (new Function('G', 'F', 'Q', 't', 'i', each))(G, window.__film, window.__qa, t, k); G.frame(dt); return log ? (new Function('G', 'F', 'Q', 't', 'return ' + log))(G, window.__film, window.__qa, t) : null; }, [step, shot.each || '', i * step, i, shot.log || '']);
    if (shot.log) rows.push(row);
    await page.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 }); done++;
  }
  if (shot.log) fs.writeFileSync(path.join(out, shot.name + '.log.json'), JSON.stringify(rows));
  if (done) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', fps, '-i', path.join(dir, '%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-movflags', '+faststart', path.join(out, shot.name + '.mp4')]);
  if (!process.env.SHOOT_KEEP) fs.rmSync(dir, { recursive: true, force: true });
  console.log('shot', shot.name, done, 'frames', Math.round((Date.now() - t0) / 1000), 's');
  if (timedOut) break;
}
console.log('errors', errors.length ? [...new Set(errors)].slice(0, 10).join('\n') : 'none');
await browser.close(); process.exit(timedOut ? 3 : 0);
