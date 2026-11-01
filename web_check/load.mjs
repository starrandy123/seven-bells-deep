// B1 (Q9): what a first play costs, read on what the host sends (CR-18). Every file is counted in the route handler as it goes to the page, up to the first moment input moves him: as files, and as the CDN sends them: brotli on text; .glb, .bin and .png go raw, as read at CloudFront on the 22:43 upload (70 files: 7.27 MB as files, 5.62 MB as sent). Both sizes are printed; ≤ 20 MB as sent, objective 15 MiB.
// B1n and Q24: what loads before play, so a person can check each file is needed by the first view; what loads after it. A late load keeps Q3 (pace.mjs).
// B2 (Q10b): playable on 10 Mbps at the size the CDN sends: the route handler holds each file for its time on the line, a 4x slower CPU in Chromium; ≤ 10 s. B2w: the worst host, nothing compressed, through the devtools' own throttle in Chromium. B2p: on screen in 1 s. B2c: the control, the time can't beat the wire.
//   node load.mjs <base> <chromium|webkit> [--only=B1,B1n,Q24,B2,B2w,B2p,B2c,BOOT,Q18]
import { gate, PHONE, mb } from './lib/h.mjs';
import zlib from 'zlib';
const W = await gate('load', { budget: 170 });
const { line, note, open, section, finish, engine, base } = W;

const off = [];      // requests that left the game's origin (Q18)
const route = (files, slow) => async (page) => {
  let busyUntil = 0; const t0 = Date.now();
  await page.route('**/*', async (r) => {
    const u = r.request().url(); if (/^(blob|data):/.test(u)) return r.continue().catch(() => {});      // WebKit routes a texture's blob: too; it's not a request, and fetching it here breaks it
    try {
      if (new URL(u).origin !== new URL(base).origin) off.push(u);
      const res = await r.fetch(), body = await res.body(), text = /\.(js|mjs|json|html|css|svg|txt|md)(\?|$)/.test(u) || u.endsWith('/'), sent = text ? zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }).length : body.length; files.push({ url: u.replace(/^.*\/\/[^/]+/, ''), bytes: body.length, sent, t: Date.now() - t0 });
      if (slow) { const now = Date.now(), wire = slow.sent ? sent : body.length, need = (wire * 8) / 10e6 * 1000; busyUntil = Math.max(busyUntil, now) + need; await new Promise((d) => setTimeout(d, busyUntil - now)); }
      await r.fulfill({ response: res, body });
    } catch (e) { try { await r.abort(); } catch (_) { /* the page went */ } }
  });
};
// from the tap to the first frame he has moved by the stick
const firstPlay = async (page) => {
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none' && window.__game && window.__game.booted; }, null, { timeout: 45000 });
  const tReady = Date.now(); await page.tap('#dive'); await page.waitForTimeout(120);
  const r = await page.evaluate(() => new Promise((done) => { const Q = window.__qa, G = window.__game, h = G.hero, p0 = h.pos.clone(), t0 = performance.now(); const s = document.querySelector('#stick'), b = s.getBoundingClientRect(), ev = (type, x, y) => s.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: 1 })); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; ev('pointerdown', cx, cy); ev('pointermove', cx, cy - 46);
    const look = () => { if (h.pos.distanceTo(p0) > 0.5) done({ ms: performance.now() - t0, moved: h.pos.distanceTo(p0) }); else if (performance.now() - t0 > 6000) done({ ms: -1, moved: h.pos.distanceTo(p0) }); else requestAnimationFrame(look); }; look(); }));
  return { tReady, ...r };
};

await section(['B1', 'B1n', 'Q24', 'BOOT', 'Q18'], async () => {
  const files = [];
  const { page, errors, close } = await open('?fresh&tier=phone', { ctx: PHONE, wait: false, route: route(files) });
  const f = await firstPlay(page), n = files.length, raw = files.reduce((s, x) => s + x.bytes, 0), sent = files.reduce((s, x) => s + x.sent, 0), mine = files.slice(), big = mine.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 5).map((x) => `${x.url.replace(/^\//, '')} ${mb(x.sent)}`).join(', ');
  await page.waitForTimeout(2500); const late = files.slice(n);
  const fsm = await import('fs'); fsm.writeFileSync(`${W.out}/load_files_${engine}.json`, JSON.stringify({ before: mine.map((x) => ({ url: x.url.replace(/^\//, ''), files: x.bytes, sent: x.sent })).sort((a, b) => b.sent - a.sent), after: late.map((x) => ({ url: x.url, files: x.bytes, sent: x.sent })) }, null, 1));
  line('B1', sent <= 20e6 && f.ms >= 0, `before first play: ${mb(raw)} MB as files, ${mb(sent)} MB as the CDN sends them (brotli on text, .glb, .bin, .png raw), ${n} files (≤ 20 MB sent, Q9; objective 15 MiB; Poki's 5 MB ${sent <= 5e6 ? 'met' : 'not met'}); largest as sent: ${big}`);
  line('B1n', n < 1500, `file count ${n} (CrazyGames' limit 1,500). What loads before play is listed in load_files_${engine}.json for a person to check each is needed by the first view (Q24)`);
  const kinds = {}; for (const x of mine) { const k = (/\.([a-z0-9]+)(\?|$)/.exec(x.url) || [0, 'other'])[1]; kinds[k] = (kinds[k] || 0) + x.sent; }
  line('Q24', late.length > 0, `files the first view doesn't need load after first play: ${late.length} load late, ${mb(late.reduce((s, x) => s + x.sent, 0))} MB; everything else, ${mb(sent)} MB as sent, loads first: ${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${mb(v)}`).join(', ')}`);
  const boot = await page.evaluate(() => window.__MOSA_BOOT && window.__MOSA_BOOT.ok);
  line('BOOT', boot === true && errors.length === 0, `the page says it's ready (__MOSA_BOOT.ok ${boot}), no errors (${errors.length})${errors[0] ? ': ' + errors[0] : ''}; 404s are errors here`);
  line('Q18', off.length === 0, `no request leaves the game's origin (Poki blocks them; the platform's rule): ${off.length}${off[0] ? ': ' + off.slice(0, 4).join(' ') : ''}, in a first load and first play`);
  await close();
});

await section(['B2', 'B2p', 'B2c', 'B2w'], async () => {
  const init = `window.__paint = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__paint.push([e.name, Math.round(e.startTime)]); }).observe({ type: 'paint', buffered: true }); } catch (e) {}`;
  const dive = (page) => page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none' && window.__game && window.__game.booted; }, null, { timeout: 60000 }).catch(() => {});
  const useCdp = engine === 'chromium', cpu = async (p) => { const c = await p.context().newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: 4 }); return c; };
  // at the size the CDN sends: the route handler is the wire, in both engines
  const files = []; const a = await open('?fresh&tier=phone', { ctx: PHONE, wait: false, init, route: async (p) => { if (useCdp) await cpu(p); await route(files, { sent: true })(p); } });
  const bar = await a.page.evaluate(() => !!document.querySelector('#load .bar')); await dive(a.page);
  const r = await a.page.evaluate(() => ({ now: Math.round(performance.now()), paint: window.__paint, ok: !!(window.__game && window.__game.booted) })), fcp = (r.paint || []).find((x) => x[0] === 'first-contentful-paint'), sent = files.reduce((s, x) => s + x.sent, 0), wire = (sent * 8) / 10e6 * 1000;
  line('B2p', !!fcp && fcp[1] <= 1000, `something on screen on 10 Mbps${useCdp ? ' with a 4x slower CPU' : ''}: first paint at ${fcp ? fcp[1] : 'none'} ms (≤ 1000, Q10a); the loading bar is in the first HTML: ${bar}`);
  line('B2', r.ok && r.now <= 10000, `playable on 10 Mbps${useCdp ? ' with a 4x slower CPU' : ''} at the size the CDN sends (${mb(sent)} MB): the Dive button up at ${r.now} ms (≤ 10,000, Q10b)`);
  line('B2c', r.now >= wire * 0.9, `the control: ${mb(sent)} MB can't arrive faster than ${Math.round(wire)} ms on this line, and it took ${r.now} ms: the throttle is real`);
  await a.close();
  // the worst host: nothing compressed. Chromium: the devtools' throttle on the real connection (a route handler would go round it); WebKit: the route handler at raw size
  const f2 = []; const b = await open('?fresh&tier=phone', { ctx: PHONE, wait: false, init, route: async (p) => { if (useCdp) { const c = await cpu(p); await c.send('Network.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: true }); await c.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 10e6 / 8, uploadThroughput: 2e6 / 8 }); } else await route(f2, { sent: false })(p); } });
  await dive(b.page); const w = await b.page.evaluate(() => ({ now: Math.round(performance.now()), ok: !!(window.__game && window.__game.booted), bytes: performance.getEntriesByType('resource').reduce((n, e) => n + (e.decodedBodySize || e.transferSize || 0), 0) }));
  line('B2w', w.ok && w.now <= 15000, `the worst host, nothing compressed (${mb(w.bytes || f2.reduce((s, x) => s + x.bytes, 0))} MB): the Dive button up at ${w.now} ms (≤ 15,000, GameSnacks' hard line; reported)`);
  await b.close();
});
await finish();
