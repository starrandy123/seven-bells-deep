// The gate's harness: every wall file is built on this, so every wall reads the same way.
//   node <wall>.mjs <base url ending in index.html> <chromium|webkit> [--only=A1,A2] [--out=dir] [--seed=n]
// A wall prints one line a check, at the start of the line: PASS <ID> ... or FAIL <ID> ...; its bound is in the line, with the worst case and where.
// A check that has no reading at the end of its section is a FAIL by its own line: a wall that didn't run never reads as a pass.
// Chromium is the full browser's windowless mode (ANGLE Metal, the GPU), never the headless shell (SwiftShader, software): no fallback.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const require = createRequire('/Users/randy/Documents/package.json'); export const pw = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));

export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
export const SMALL = { viewport: { width: 640, height: 360 } };                 // for walls that step the rules and don't read the picture
export const DESK = { viewport: { width: 1280, height: 720 } };

// a seeded Math.random, so a red names a seed and comes back
export const seeded = (s) => `(() => { let a = ${s >>> 0}; Math.random = function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;

export function parse() {
  const flags = {}, pos = [];
  for (const x of process.argv.slice(2)) { if (x.startsWith('--')) { const i = x.indexOf('='); if (i < 0) flags[x.slice(2)] = true; else flags[x.slice(2, i)] = x.slice(i + 1); } else pos.push(x); }
  return { base: pos[0] || 'http://127.0.0.1:8791/index.html', engine: pos[1] || 'chromium', pos, flags, only: flags.only ? new Set(String(flags.only).split(',')) : null };
}

export const QS_WALLS = new Set(['load', 'collide', 'play', 'rates', 'perf', 'pace', 'turned', 'lowpower', 'input', 'ui', 'focus', 'contrast', 'motion', 'state', 'weigh', 'first', 'soak', 'cold', 'lag']);
export async function gate(name, { budget = 170, engines = ['chromium', 'webkit'] } = {}) {
  const A = parse(); const { base, engine, only, flags } = A;
  const out = flags.out || `/tmp/web_check/${name}`; fs.mkdirSync(out, { recursive: true });
  const seed = +(flags.seed || 1931), R = [], t0 = Date.now();
  // X13: the 34 checkpoints print as QS-A1 and so on, because C1-C3 and G1-G4 also mean EPIC rows. A wall's --only and its plants use the bare ID.
  const qs = (id) => (QS_WALLS.has(name) && /^[A-G]\d/.test(id) ? 'QS-' + id : id);
  const line = (id, pass, what) => { R.push({ id, pass, what }); console.log(`${pass ? 'PASS' : 'FAIL'} ${qs(id)} ${what}`); };
  const note = (what) => console.log(`     ${what}`);
  const picked = (i) => only.has(i) || only.has(String(i).split('.')[0]);     // --only=C1t takes every C1t.x
  const want = (...ids) => !only || ids.some(picked);
  let browser = null; const contexts = new Set();
  const finish = async (code) => {
    for (const c of contexts) await Promise.race([c.close().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
    if (browser) await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
    fs.writeFileSync(path.join(out, `${name}_${engine}.json`), JSON.stringify({ name, engine, base, seed, results: R, seconds: Math.round((Date.now() - t0) / 1000) }, null, 1));
    const pass = R.filter((r) => r.pass).length, fail = R.filter((r) => !r.pass);
    if (!R.length) console.log(`FAIL NOTHING ${name} read nothing: --only matched no check, so this run says nothing`);
    console.log(`${name} ${engine}: ${pass} of ${R.length} pass in ${Math.round((Date.now() - t0) / 1000)} s${fail.length ? '; failing: ' + fail.map((r) => r.id).join(' ') : ''}`);
    process.exit(code ?? (fail.length || !R.length ? 1 : 0));
  };
  if (!engines.includes(engine)) { console.log(`     ${name} does not run in ${engine}: ${flags.why || 'see its head'}`); console.log(`${name} ${engine}: 0 of 0 pass in 0 s`); process.exit(0); }
  const dog = setTimeout(() => { line('TIME', false, `${name} ran out of its ${budget} s budget (the heavy lock is shared: split it)`); finish(3); }, budget * 1000); dog.unref();
  process.on('unhandledRejection', (e) => { line('CRASH', false, `${name}: ${String(e && e.stack || e).slice(0, 400)}`); finish(4); });

  const launch = async () => {
    if (browser) return browser;
    const opts = { headless: true }; if (engine === 'chromium') { opts.channel = 'chromium'; opts.args = ['--enable-precise-memory-info', '--js-flags=--expose-gc']; }
    browser = await pw[engine].launch(opts);
    return browser;
  };
  // ctx: one of the shapes above, or your own; init: strings or functions run before the page's own script
  const open = async (q = '', { ctx: co = SMALL, init = [], wait = true, seedIt = true, url = null, route = null } = {}) => {
    await launch();
    const ctx = await browser.newContext(co); contexts.add(ctx);
    if (seedIt) await ctx.addInitScript({ content: seeded(seed) });
    await ctx.addInitScript({ content: 'window.__MOSA_BOOT = window.__MOSA_BOOT || { ok: null };' });
    await ctx.addInitScript({ path: path.join(HERE, 'qa_page.js') });
    for (const i of [].concat(init)) await ctx.addInitScript(typeof i === 'string' ? { content: i } : i);
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 260)); });
    page.on('crash', () => errors.push('crash: the page crashed'));
    page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ' ' + r.url().replace(/^.*\/\/[^/]+/, '')); });
    if (route) await route(page);
    await page.goto(url || base + q, { waitUntil: 'load' });
    if (wait) { try { await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 30000 }); } catch (e) { line('BOOT', false, `the game didn't boot in 30 s at ${q}: ${errors.slice(0, 3).join(' | ') || (await page.evaluate(() => { const s = document.querySelector('#load small'); return s ? s.textContent : 'no message'; }).catch(() => 'no page'))}`); await finish(5); } }
    return { ctx, page, errors, close: async () => { contexts.delete(ctx); await ctx.close().catch(() => {}); } };
  };
  // a section: its ids, its work. Whatever happens, each id gets a line.
  const section = async (ids, fn) => {
    if (!want(...ids)) return;
    const seen = () => new Set(R.map((r) => r.id));
    try { await fn(); } catch (e) { for (const id of ids) if (!seen().has(id)) line(id, false, `did not finish: ${String(e && e.message || e).split('\n')[0].slice(0, 240)}`); }
    for (const id of ids) if (!seen().has(id) && (!only || picked(id))) line(id, false, 'no reading: the wall never reached this check');
  };
  // the GPU, printed once a run: a frame-rate reading from software would be a lie
  const gpu = async (page) => {
    const r = await page.evaluate(() => { const gl = window.__game.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
    note(`GPU ${engine}: ${r}`); if (/swiftshader|llvmpipe|software/i.test(r)) line('ENV', false, `this reading is on a software renderer (${r}): frame rates mean nothing`);
    return r;
  };
  return { ...A, out, seed, line, note, want, open, section, finish, gpu, launch, get browser() { return browser; } };
}

// the worst of a list, by a key
export const worst = (list, key) => list.reduce((b, x) => (b === null || key(x) > key(b) ? x : b), null);
export const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : NaN);
export const mb = (n) => (n / 1048576).toFixed(2);
