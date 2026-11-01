// Film the game frame by frame (smooth whatever the machine): the page steps itself (?film), we take each picture.
//   node film.mjs <out dir> <plan.json> [w=540] [h=540] [scale=2] [fps=30]    a shot may say "slow": 4 for a quarter-speed clip from the game's own clock
// plan: { "url": "...", "shots": [ { "name":, "seconds":, "setup": "js, run once with G", "each": "js, run each frame with G, t, i (t in the game's seconds)" } ] }
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [out, planFile, w = '540', h = '540', scale = '2', fps = '30'] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8')); fs.mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium' }).catch(() => pw.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
await ctx.addInitScript({ path: new URL('./lib/qa_page.js', import.meta.url).pathname });      // the checks' helpers, for a plan that wants them
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.text().startsWith('roof')) console.log(m.text()); });
await page.goto(plan.url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 120000 });
await page.addStyleTag({ content: plan.hud ? '' : '#hud,#hurt{display:none!important}' });
for (const shot of plan.shots) {
  const dir = path.join(out, shot.name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  if (shot.setup) await page.evaluate(new Function('code', 'const G = window.__game; return eval(code);'), shot.setup);
  const slow = shot.slow || 1, step = 1 / +fps / slow;      // slow 4: a clip at a quarter speed, from the game's own clock
  const warm = shot.warm ?? 20; for (let i = 0; i < warm; i++) await page.evaluate((dt) => window.__game.frame(dt), 1 / +fps);
  const n = Math.round(shot.seconds * slow * +fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate(([dt, each, t, k]) => { const G = window.__game; if (each) (new Function('G', 't', 'i', each))(G, t, k); G.frame(dt); }, [step, i % slow ? '' : shot.each || '', i * step, Math.floor(i / slow)]);   // `each` runs at the base rate, so a move lands at the same moment of the game at any speed
    await page.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', fps, '-i', path.join(dir, '%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', path.join(out, shot.name + '.mp4')]);
  fs.rmSync(dir, { recursive: true, force: true }); console.log('shot', shot.name, n, 'frames');
}
console.log('errors', errors.length ? errors.slice(0, 10).join('\n') : 'none');
await browser.close();
