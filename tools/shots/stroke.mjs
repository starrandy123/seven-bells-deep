// which way the hands go round in a crawl, in the game: + = reversed. node stroke.mjs <url>
import { createRequire } from 'module';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [url = 'http://127.0.0.1:8851/index.html'] = process.argv.slice(2);
const b = await pw.chromium.launch({ headless: true, channel: 'chromium' });
const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
await ctx.addInitScript({ path: '/Users/randy/Documents/UnrealProjects/DrownedCity_part2/web_check/lib/qa_page.js' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url + '?film&fresh&tier=phone', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 90000 });
const r = await page.evaluate(() => { const G = window.__game, Q = window.__qa, h = G.hero, q = G.quest; G.started = G.playing = true; q.events.hold(true); const ms = q.missions; for (const m of ms.active.slice()) ms.stop(m); if (G.enemies.clearAll) G.enemies.clearAll();
  const out = {};
  const bones = {}; h.root.traverse((o) => { if (/^(hand_R|hand_L|arm_R|arm_L|head|hips|spine_3|foot_R)$/.test(o.name)) bones[o.name] = o; }); out.bones = Object.keys(bones);
  const V = h.pos.constructor, a = new V(), bb = new V(), c = new V(), d0 = new V();
  for (const [name, wish, secs] of [['cruise', { my: .7, mx: 0, ud: 0, boost: false }, 6], ['full', { my: 1, mx: 0, ud: 0, boost: false }, 6]]) {
    const w = Q.openWater(120); Q.swimAt(w.x, w.y, w.z); h.place(); h.inv = 1e6; Q.aim(w.ax, w.ay, 0); const pts = { R: [], L: [] }; let sp = 0, tilt = 0, chestDot = 0, n = 0;
    for (let i = 0; i < 60 * secs; i++) { Q.drive(wish); G.frame(1 / 60); if (i < 120) continue; h.root.updateMatrixWorld(true); const vh = Math.hypot(h.vel.x, h.vel.z) || 1; d0.set(h.vel.x / vh, 0, h.vel.z / vh);
      for (const [s, nm, sh] of [['R', 'hand_R', 'arm_R'], ['L', 'hand_L', 'arm_L']]) { bones[nm].getWorldPosition(a); bones[sh].getWorldPosition(bb); c.subVectors(a, bb); pts[s].push([c.dot(d0), c.y]); }
      sp += h.speed; tilt += h.tilt; n++; }
    const circ = (P) => { let A = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q2 = P[(i + 1) % P.length]; A += p[0] * q2[1] - p[1] * q2[0]; } return A / 2 / P.length * 100; };
    const span = (P, k) => { const v = P.map((p) => p[k]); return [+Math.min(...v).toFixed(2), +Math.max(...v).toFixed(2)]; };
    // when the hand is high, which way does it go along the swim
    const high = (P) => { let f = 0, nf = 0; const zs = P.map((p) => p[1]).sort((x, y) => x - y), mid = zs[zs.length >> 1]; for (let i = 0; i + 1 < P.length; i++) { if (P[i][1] > mid) { f += P[i + 1][0] - P[i][0]; nf++; } } return +(f / nf * 60).toFixed(2); };
    out[name] = { speed: +(sp / n).toFixed(1), tilt: +(tilt / n).toFixed(2), R: { circ: +circ(pts.R).toFixed(1), along: span(pts.R, 0), up: span(pts.R, 1), highV: high(pts.R) }, L: { circ: +circ(pts.L).toFixed(1), along: span(pts.L, 0), up: span(pts.L, 1), highV: high(pts.L) } };
  }
  return out; });
console.log(JSON.stringify(r)); console.log(errs.length ? errs : 'no errors'); await b.close();
