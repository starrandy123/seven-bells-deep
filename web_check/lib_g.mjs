// Shared by the g_*.mjs walls: the qa contract. Called as `node web_check/g_x.mjs <base url ending in index.html> <chromium|webkit>`.
// One line per check at the start of the line, `PASS <ID> ...` or `FAIL <ID> ...`; exit code 1 if any failed; a run that can't finish prints a FAIL.
import { createRequire } from 'module';
const require = createRequire('/Users/randy/Documents/package.json'); export const pw = require('playwright');

export function args() {
  const [base = 'http://127.0.0.1:8791/index.html', engine = 'chromium'] = process.argv.slice(2);
  return { base, engine };
}
export async function launch(engine) { return engine === 'chromium' ? pw.chromium.launch({ headless: true, channel: 'chromium' }) : pw[engine].launch({ headless: true }); }
const results = [];
export function ok(id, pass, note = '') { results.push({ id, pass }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${note}`); return pass; }
export function done() { process.exitCode = results.every((r) => r.pass) ? 0 : 1; return results; }

// a page on the bot's clock: no drawing, the fixed step driven by hand. Everything else is the real game.
export async function bench(browser, base, flags = '?demo&film&fresh&tier=phone') {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } }); const page = await ctx.newPage(); page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  page.on('console', (m) => { if (m.type() === 'error' && m.text().startsWith('[guard]')) page.errs.push(m.text()); });      // a safety net that fired is a bug it hid
  await page.goto(base + flags, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 120000 });
  await page.evaluate(() => { const G = window.__game; G.look.render = () => {}; G.rand = 1; });
  return page;
}
// run the game for up to `ms` of real time or until `stop` (a function body with G in scope) says true; returns what `read` (the same) reads
export const run = (page, ms, stop, read = 'null') => page.evaluate(([ms, stop, read]) => {
  const G = window.__game, f = new Function('G', `return (${stop})`), r = new Function('G', `return (${read})`), t0 = performance.now(); let n = 0;
  while (performance.now() - t0 < ms) { for (let i = 0; i < 24; i++) { G.frame(0.0833); n++; } if (f(G)) break; }
  return { n, done: !!f(G), t: G.time, out: r(G) };
}, [ms, stop, read]);
