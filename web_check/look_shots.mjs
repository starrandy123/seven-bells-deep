// The look's eyes: named cameras from look_test.html, saved as JPEGs, with the numbers.
//   node web_check/look_shots.mjs [--cams reef,kelp] [--tier phone] [--size 390x844] [--dpr 3] [--tag v1] [--stats] [--sheet] [--wait 60]
// Headless, on the GPU, one page per tier and size. Under heavy.sh, always.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
const require = createRequire('/Users/randy/Documents/package.json');
const pw = require('playwright');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);
const ALL = 'spawn,reef,kelp,avenue,arena,trench,surface,whale,above';
const cams = arg('cams', ALL).split(',');
const tier = arg('tier', 'phone');
const [w, h] = arg('size', tier === 'phone' ? '390x844' : '1280x720').split('x').map(Number);
const dpr = +arg('dpr', tier === 'phone' ? 3 : 1);
const tag = arg('tag', 'v');
const settle = +arg('wait', 40);
const base = arg('url', 'http://127.0.0.1:8791/look_test.html');
const out = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'look');
fs.mkdirSync(out, { recursive: true });

const engine = arg('engine', 'chromium');
// --cross: the real game, a real breach and fall, stepped frame by frame; every frame's brightness and the frames round each crossing.
const crossing = has('cross');
const browser = engine === 'webkit' ? await pw.webkit.launch({ headless: true }) : await pw.chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] }).catch(() => pw.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, ...(engine === 'webkit' ? {} : { isMobile: tier === 'phone' }), hasTouch: tier === 'phone' });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning') { if (!/GPU stall|swiftshader|GL Driver Message/i.test(t)) logs.push(m.type() + ': ' + t.slice(0, 1500)); } });
page.on('pageerror', (e) => logs.push('pageerror: ' + (e.stack || e.message).slice(0, 1500)));
// Rough meshes still in the world builder's folder are used from there, read only.
for (const name of ['props.glb', 'creatures.glb']) {
  const live = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../web/assets', name), rough = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../Pipeline/world/out', name);
  await page.route('**/assets/' + name, (r) => (fs.existsSync(rough) && (!fs.existsSync(live) || fs.statSync(rough).mtimeMs > fs.statSync(live).mtimeMs)) ? r.fulfill({ path: rough, contentType: 'model/gltf-binary' }) : r.continue());
}
for (const m of arg('js', '').split(',').filter(Boolean)) { const [name, file] = m.split('='); await page.route('**/js/' + name, (r) => r.fulfill({ path: file, contentType: 'text/javascript' })); }
if (arg('props', '')) await page.route('**/assets/props.glb', (r) => r.fulfill({ path: arg('props', ''), contentType: 'model/gltf-binary' }));
if (has('plant')) await page.route('**/js/sky.js', async (r) => {
  const res = await r.fetch(); let t = await res.text();
  t = t.replace("bool inAir = uAbove > .5 || (uLensOn > .5 && rd.y > -.02 && ocLensS(vClip.xy/vClip.w) > 0.0);", "bool inAir = uAbove > .5;").replace("c = ocScatter(rd, max(d0, .4), len);", "c = ocScatter(rd, d0, len);");
  t = t.replace("if (uLensOn > .5 && ocLensS(vClip.xy/vClip.w) > 0.0) discard;", "if (uLensOn > .5 && ocLensS(vClip.xy/vClip.w) > 0.0) discard;");
  await r.fulfill({ response: res, body: t });
});
// --inside: a body set down inside a solid, at its centre and near each face, of every solid: collide and sweep must give finite numbers and bring it out, into no other solid. Then what the map doesn't promise, set on its sea bed as the page gets world.json:
// two boxes sharing a face, and a bed rising under a rock's lower edge. There pushes cancel and read as free. Bodies set inside, sweeps from outside, the hero swimming in. Plants: --plant-nan puts back the stale line that gave NaN; --plant-cancel takes out the way out and sweep's check.
if (has('inside')) {
  if (has('plant-cancel')) await page.route('**/js/world.js', async (r) => { const res = await r.fetch(); let t = await res.text(); const n = t.length; t = t.replace('if (k >= 0) { eject(p, r, k); hit = true; }', '').replace('const k = solidAt(p.x, p.y, p.z); if (k >= 0) eject(p, r, k);', '').replace(' || solidAt(qx, qy, qz) >= 0);', ');'); console.log('plant', t.length - n); await r.fulfill({ response: res, body: t }); });
  if (has('plant-nan')) await page.route('**/js/world.js', async (r) => { const res = await r.fetch(); let t = await res.text(); const n = t.length; t = t.replace('else if (up < dn) p.z = z1 + r; else p.z = z0 - r;', 'else if (up < dn) p.z = NaN; else p.z = NaN;'); console.log('plant', t.length - n); await r.fulfill({ response: res, body: t }); });
  await page.goto(`${arg('site', 'http://127.0.0.1:8791')}/index.html?film&fresh&tier=phone${arg('extra', '')}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.started && window.__game.world, null, { timeout: 90000 });
  const res = await page.evaluate(() => {
    const W = window.__game.world, C = W.data.colliders, out = { bodies: 0, sweeps: 0, nonFinite: 0, stuck: 0, first: null, kinds: { cyl: 0, box: 0 } };
    const ok = (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
    const within = (c, p) => { if (p.z <= c.z0 || p.z >= c.z1) return false; const dx = p.x - c.x, dy = p.y - c.y; if (c.t === 'cyl') return Math.hypot(dx, dy) < c.r - .02; const co = Math.cos(c.yaw || 0), si = Math.sin(c.yaw || 0); return Math.abs(dx * co + dy * si) < c.hx - .02 && Math.abs(-dx * si + dy * co) < c.hy - .02; };
    const cells = new Map(), key = (x, y) => (Math.floor(x / 32) + 4096) * 8192 + Math.floor(y / 32) + 4096;
    for (let i = 0; i < C.length; i++) { const c = C[i], R = c.t === 'cyl' ? c.r : Math.hypot(c.hx, c.hy); for (let a = Math.floor((c.x - R) / 32); a <= Math.floor((c.x + R) / 32); a++) for (let b = Math.floor((c.y - R) / 32); b <= Math.floor((c.y + R) / 32); b++) { const k = key(a * 32, b * 32); (cells.get(k) || cells.set(k, []).get(k)).push(c); } }
    const inAny = (p) => (cells.get(key(p.x, p.y)) || []).some((c) => within(c, p));
    for (let i = 0; i < C.length; i++) {
      const c = C[i], z = (c.z0 + c.z1) / 2, co = Math.cos(c.yaw || 0), si = Math.sin(c.yaw || 0), ax = c.t === 'cyl' ? c.r * .7 : c.hx * .8, ay = c.t === 'cyl' ? c.r * .7 : c.hy * .8; out.kinds[c.t]++;
      const spots = [[0, 0, z], [0, 0, c.z1 - .05], [0, 0, c.z0 + .05], [ax, 0, z], [-ax, 0, z], [0, ay, z], [0, -ay, z], [ax, ay, c.z1 - .05]];
      for (const [lx, ly, lz] of spots) for (const r of [.45, .62, 2]) {
        const p = { x: c.x + lx * co - ly * si, y: c.y + lx * si + ly * co, z: lz }; W.collide(p, r); out.bodies++;
        if (!ok(p)) { out.nonFinite++; out.first ||= `collide at solid ${i} ${c.t}, offset ${lx.toFixed(2)},${ly.toFixed(2)},${(lz - c.z0).toFixed(2)}, r ${r}`; } else if (inAny(p)) { out.stuck++; out.firstStuck ||= `solid ${i} ${c.t} r ${c.r || c.hx}, offset ${lx.toFixed(2)},${ly.toFixed(2)},${(lz - c.z0).toFixed(2)}, body ${r}, left at ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`; }
        if (r === .62) { const f = { x: c.x + lx * co - ly * si, y: c.y + lx * si + ly * co, z: lz }, t = { x: f.x + 3, y: f.y - 2, z: f.z + 1.5 }, h = W.sweep(f, t, r); out.sweeps++; if (h && !(Number.isFinite(h.x + h.y + h.z + h.nx + h.ny + h.nz + h.t))) { out.nonFinite++; out.first ||= `sweep at solid ${i}`; } }
      }
      if (!Number.isFinite(W.solidTop(c.x, c.y, 1e3)) && W.solidTop(c.x, c.y, 1e3) !== -Infinity) { out.nonFinite++; out.first ||= `solidTop at ${i}`; }
    }
    return out;
  });
  console.log(JSON.stringify(res));
  const real = res.nonFinite === 0 && res.stuck === 0 && res.bodies > 1000;
  console.log(`WALL inside: ${res.bodies} bodies and ${res.sweeps} sweeps from inside ${res.kinds.cyl} cylinders and ${res.kinds.box} boxes: ${res.nonFinite} not finite (bound 0)${res.first ? ', first ' + res.first : ''}, ${res.stuck} left inside a solid (bound 0)${res.firstStuck ? ', first ' + res.firstStuck : ''}: ${real ? 'green' : 'RED'}`);
  // places on the real sea bed with nothing near: one flat, one sloping, and the solids to set there
  const FIX = await page.evaluate(() => {
    const W = window.__game.world, C = W.data.colliders, S = W.data.size_m, O = W.data.origin, busy = new Set(), key = (x, y) => Math.floor(x / 40) + ',' + Math.floor(y / 40);
    for (let i = 0; i < C.length; i++) { const c = C[i], R = (c.t === 'cyl' ? c.r : Math.hypot(c.hx, c.hy)) + 80; for (let a = c.x - R; a <= c.x + R + 39; a += 40) for (let b = c.y - R; b <= c.y + R + 39; b += 40) busy.add(key(a, b)); }
    const H = (x, y) => W.heightAt(x, y), grad = (x, y) => [(H(x + 6, y) - H(x - 6, y)) / 12, (H(x, y + 6) - H(x, y - 6)) / 12];
    let flat = null, hill = null;
    for (let a = O[0] + 100; a < O[0] + S - 100 && !(flat && hill); a += 40) for (let b = O[1] + 100; b < O[1] + S - 100 && !(flat && hill); b += 40) {
      if (busy.has(key(a, b)) || H(a, b) > -24) continue;
      const g = grad(a, b), s = Math.hypot(g[0], g[1]);
      if (!flat && s < .06 && Math.abs(H(a + 30, b + 30) - H(a - 30, b - 30)) < 2) flat = [a, b];
      if (!hill && s > .22 && s < .7) hill = [a, b, g[0] / s, g[1] / s, s];
    }
    if (!flat || !hill) return { missing: [!!flat, !!hill] };
    const box = (x, y, z0, z1, hx, hy, yaw = 0) => ({ t: 'box', x, y, z0, z1, hx, hy, yaw }), cyl = (x, y, z0, z1, r) => ({ t: 'cyl', x, y, z0, z1, r });
    const [X, Y] = flat, g = [], f = (x, y) => H(x, y);
    { const x = X - 20, y = Y - 20, e = f(x, y); g.push({ name: 'two boxes sharing a face', seam: 1, solids: [box(x - 6, y, e + 5, e + 12, 6, 6), box(x + 6, y, e + 5, e + 12, 6, 6)] }); }
    { const x = X + 20, y = Y - 20, e = f(x, y), a = .6, c = Math.cos(a), s = Math.sin(a); g.push({ name: 'the same, turned', seam: 1, solids: [box(x - 6 * c, y - 6 * s, e + 5, e + 12, 6, 6, a), box(x + 6 * c, y + 6 * s, e + 5, e + 12, 6, 6, a)] }); }
    { const x = X - 20, y = Y + 20, e = f(x, y), L = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) L.push(box(x + i * 8, y + j * 8, e + 4, e + 11, 4, 4)); g.push({ name: 'a slab of nine tiles', seam: 1, solids: L }); }
    { const x = X + 20, y = Y + 20, e = f(x, y); g.push({ name: 'two boxes sunk in the bed', seam: 1, solids: [box(x - 6, y, e - 3, e + 5, 6, 6), box(x + 6, y, e - 3, e + 5, 6, 6)] }); }
    const [HX, HY, ux, uy] = hill, yaw = Math.atan2(uy, ux), e0 = f(HX, HY), x1 = HX - uy * 16, y1 = HY + ux * 16, e1 = f(x1, y1);
    g.push({ name: 'a bed rising under a box', wedge: [HX, HY, ux, uy], solids: [box(HX, HY, e0 + .3, e0 + 10, 8, 8, yaw)] });
    g.push({ name: 'a bed rising under a rock', wedge: [x1, y1, ux, uy], solids: [cyl(x1, y1, e1 + .3, e1 + 10, 7)] });
    return { groups: g, flat, hill };
  });
  if (FIX.missing) { console.log(`WALL inside cases: no place found (flat, sloping): ${FIX.missing}: RED`); await browser.close(); process.exit(0); }
  await page.addInitScript({ path: path.resolve(path.dirname(new URL(import.meta.url).pathname), 'lib/qa_page.js') });
  await page.route('**/assets/world.json', async (r) => { const res = await r.fetch(); const j = await res.json(); for (const G of FIX.groups) j.colliders.push(...G.solids); await r.fulfill({ response: res, body: JSON.stringify(j) }); });
  await page.goto(`${arg('site', 'http://127.0.0.1:8791')}/index.html?film&qa&fresh&tier=phone${arg('extra', '')}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.started && window.__game.hero && window.__qa, null, { timeout: 90000 });
  const res2 = await page.evaluate((FIX) => {
    const Q = window.__qa, G = window.__game, W = G.world, h = G.hero, rows = [];
    const within = (c, p) => { if (p.z <= c.z0 || p.z >= c.z1) return false; const dx = p.x - c.x, dy = p.y - c.y; if (c.t === 'cyl') return Math.hypot(dx, dy) < c.r - .02; const co = Math.cos(c.yaw || 0), si = Math.sin(c.yaw || 0); return Math.abs(dx * co + dy * si) < c.hx - .02 && Math.abs(-dx * si + dy * co) < c.hy - .02; };
    for (const g of FIX.groups) {
      const S = g.solids, inAny = (p) => S.some((c) => within(c, p)), o = { name: g.name, bodies: 0, left: 0, under: 0, nan: 0, far: 0, sweeps: 0, swept: 0, swims: 0, frames: 0, first: null };
      const local = (c, a, b, z) => { if (c.t === 'cyl') { return { x: c.x + a * c.r * .9, y: c.y + b * c.r * .9, z }; } const co = Math.cos(c.yaw || 0), si = Math.sin(c.yaw || 0), lx = a * c.hx, ly = b * c.hy; return { x: c.x + lx * co - ly * si, y: c.y + lx * si + ly * co, z }; };
      for (const c of S) for (const a of [-.98, -.6, 0, .6, .98]) for (const b of [-.98, -.6, 0, .6, .98]) { if (c.t === 'cyl' && a * a + b * b > 1) continue; for (const zt of [.03, .5, .97]) for (const r of [.42, .62, 2]) {
        const q = local(c, a, b, c.z0 + (c.z1 - c.z0) * zt), z0 = { x: q.x, y: q.y, z: q.z }; if (!inAny(q) || q.z < W.heightAt(q.x, q.y)) continue;
        W.collide(q, r); o.bodies++;
        if (!Number.isFinite(q.x + q.y + q.z)) { o.nan++; continue; }
        o.far = Math.max(o.far, Math.hypot(q.x - z0.x, q.y - z0.y, q.z - z0.z));
        if (inAny(q)) { o.left++; o.first ||= `from ${z0.x.toFixed(2)},${z0.y.toFixed(2)},${z0.z.toFixed(2)} body ${r} left at ${q.x.toFixed(2)},${q.y.toFixed(2)},${q.z.toFixed(2)}`; }
        if (q.z < W.heightAt(q.x, q.y) + r - .02) o.under++;
      } }
      // from outside: a ring of sweeps at every height, each aimed through the middle of a solid. None may end with its centre in one.
      const c0 = S[0], mx = S.reduce((a, c) => a + c.x, 0) / S.length, my = S.reduce((a, c) => a + c.y, 0) / S.length, reach = Math.max(...S.map((c) => Math.hypot(c.x - mx, c.y - my) + (c.t === 'cyl' ? c.r : Math.hypot(c.hx, c.hy)))) + 3;
      for (let i = 0; i < 48; i++) for (const zt of [-.1, .02, .5, 1.1]) { const a = i / 48 * 6.2832, f = { x: mx + Math.cos(a) * reach, y: my + Math.sin(a) * reach, z: 0 }, t = { x: mx, y: my, z: c0.z0 + (c0.z1 - c0.z0) * Math.max(zt, .02) }; f.z = Math.max(c0.z0 + (c0.z1 - c0.z0) * zt, W.heightAt(f.x, f.y) + .7); const H = W.sweep(f, t, .62), e = H ? { x: H.x, y: H.y, z: H.z } : t; o.sweeps++; if (inAny(e)) { o.swept++; o.first ||= `sweep from ${f.x.toFixed(1)},${f.y.toFixed(1)},${f.z.toFixed(1)} ended in it at ${e.x.toFixed(2)},${e.y.toFixed(2)},${e.z.toFixed(2)}`; } }
      // the hero himself. On a seam: set down inside, one frame and he's out. Under a lower edge: swimming up the bed, he stays out.
      if (g.seam) for (const c of S) for (const a of [-.9, 0, .9]) { const q = local(c, a, 0, (c.z0 + c.z1) / 2); if (!inAny(q)) continue; Q.swimAt(q.x, q.y, q.z, 0, 0, 0, 0); Q.aim(1, 0, 0); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); o.swims++; for (let k = 0; k < 3; k++) h.step(1 / 60); const p = Q.where(); if (inAny(p)) { o.frames++; o.first ||= `hero set in at ${q.x.toFixed(1)},${q.y.toFixed(1)},${q.z.toFixed(1)}, still in at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`; } }
      if (g.wedge) { const [x, y, ux, uy] = g.wedge; for (let s = -1; s <= 1; s++) for (const sp of [5, 15.5]) { const c = S[0], R = c.t === 'cyl' ? c.r : c.hx, sx = x - ux * (R + 6) - uy * s * R * .5, sy = y - uy * (R + 6) + ux * s * R * .5, z = W.heightAt(sx, sy) + 1.2; Q.swimAt(sx, sy, z, ux * sp, uy * sp, 0, sp > 10 ? 1 : 0); Q.aim(ux, uy, .15); Q.drive({ my: 1, mx: 0, ud: 0, boost: sp > 10 }); o.swims++; for (let k = 0; k < 150; k++) { h.step(1 / 60); const p = Q.where(); if (inAny(p)) { o.frames++; o.first ||= `hero swimming in at ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}, frame ${k}`; } } } }
      rows.push(o);
    }
    return rows;
  }, FIX);
  let bad = 0; for (const o of res2) { const ok = !o.nan && !o.left && !o.under && !o.swept && !o.frames && o.bodies > 20; if (!ok) bad++; console.log(`  ${o.name}: ${o.bodies} bodies, ${o.nan} not finite, ${o.left} left inside, ${o.under} under the bed, furthest moved ${o.far.toFixed(2)} m; ${o.sweeps} sweeps, ${o.swept} ended inside; ${o.swims} hero runs, ${o.frames} frames inside${o.first ? '; first ' + o.first : ''}: ${ok ? 'green' : 'RED'}`); }
  console.log(`WALL inside cases: ${res2.length} set on the sea bed at ${FIX.flat.map((v) => v.toFixed(0))} and ${FIX.hill.slice(0, 2).map((v) => v.toFixed(0))}: ${bad} red (bound 0): ${bad ? 'RED' : 'green'}`);
  for (const l of logs.slice(0, 6)) console.log(l);
  await browser.close();
  process.exit(0);
}
// --narrow: a roof of solid over a rising bed. A swimmer heading to where the gap is narrower than his body must stop, not be lifted through the roof. Plant: --plant-narrow takes the rule out of sweep.
if (has('narrow')) {
  if (has('plant-narrow')) await page.route('**/js/world.js', async (r) => { const res = await r.fetch(); let t = await res.text(); const n = t.length; t = t.replace('let wall = !heads && (wedged || (l >= .004 && !settles(sw, r)) || solidAt(qx, qy, qz) >= 0);', 'let wall = false;'); console.log('plant', t.length - n); await r.fulfill({ response: res, body: t }); });
  await page.addInitScript({ path: path.resolve(path.dirname(new URL(import.meta.url).pathname), 'lib/qa_page.js') });
  await page.goto(`${arg('site', 'http://127.0.0.1:8791')}/index.html?film&qa&fresh&tier=phone`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.started && window.__game.hero && window.__qa, null, { timeout: 90000 });
  const res = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, W = G.world, C = W.data.colliders, R = .62, out = { runs: 0, worst: 9, inside: 0, at: null, roofs: 0 };
    for (let i = 0; i < C.length && out.runs < 60; i++) {
      const c = C[i]; if (c.t !== 'box' || c.hx < 4 || c.hy < 4 || c.z0 > -1.2) continue;
      const co = Math.cos(c.yaw || 0), si = Math.sin(c.yaw || 0), wx = (a, b) => c.x + a * co - b * si, wy = (a, b) => c.y + a * si + b * co; let used = 0; out.roofs++;
      for (let a = -c.hx + 1; a < c.hx - 1 && used < 4; a += 3) for (let b = -c.hy + 1; b < c.hy - 1 && used < 4; b += 3) {
        const x = wx(a, b), y = wy(a, b), gap = c.z0 - W.heightAt(x, y); if (gap < 2 * R + .25 || gap > 2 * R + 3) continue;
        let best = null;
        for (let q = 0; q < 6.28 && !best; q += .39) for (const d of [3, 6, 9]) { const ta = a + Math.cos(q) * d, tb = b + Math.sin(q) * d; if (Math.abs(ta) > c.hx - .5 || Math.abs(tb) > c.hy - .5) continue; const tx = wx(ta, tb), ty = wy(ta, tb), g2 = c.z0 - W.heightAt(tx, ty); if (g2 > 0 && g2 < 2 * R - .2) { best = [tx - x, ty - y]; break; } }
        if (!best) continue;
        const l = Math.hypot(best[0], best[1]), dx = best[0] / l, dy = best[1] / l, z = c.z0 - R - .1, start = W.heightAt(x, y) + R + .05; if (z < start) continue;
        { const q = { x, y, z }; W.collide(q, R); if (Math.hypot(q.x - x, q.y - y, q.z - z) > .05) continue; }      // (a start another solid holds isn't a swim under this one)
        used++; out.runs++;
        Q.swimAt(x, y, z, dx * 5, dy * 5, 0, 0); Q.aim(dx, dy, 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: false });
        for (let k = 0; k < 90; k++) { h.step(1 / 60); const p = Q.where(), la = (p.x - c.x) * co + (p.y - c.y) * si, lb = -(p.x - c.x) * si + (p.y - c.y) * co; if (Math.abs(la) < c.hx && Math.abs(lb) < c.hy) { const clear = c.z0 - p.z; if (clear < out.worst) { out.worst = clear; out.at = [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)]; } if (p.z > c.z0 && p.z < c.z1) out.inside++; } }
      }
    }
    // the world owner's case: at speed under the slab's side, then a ridge lifts him toward it
    if (W.data.size_m > 1500) {
      const roofs = C.filter(c => c.t === 'box' && c.hx > 3 && c.hy > 3 && Math.hypot(c.x - 290, c.y - 768) < 90), a = [325.6, 771, -3.8], b = [284, 765.6], l = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / l, dy = (b[1] - a[1]) / l;
      Q.swimAt(a[0], a[1], a[2], dx * 15.5, dy * 15.5, 0, 1); Q.aim(dx, dy, -.1); Q.drive({ my: 1, mx: 0, ud: 0, boost: true });
      out.wedge = { inside: 0, highest: -99, far: 0 };
      for (let k = 0; k < 300; k++) { h.step(1 / 60); const p = Q.where(); out.wedge.far = Math.max(out.wedge.far, Math.hypot(p.x - a[0], p.y - a[1])); for (const c of roofs) { const co = Math.cos(c.yaw || 0), si = Math.sin(c.yaw || 0), la = (p.x - c.x) * co + (p.y - c.y) * si, lb = -(p.x - c.x) * si + (p.y - c.y) * co; if (Math.abs(la) < c.hx && Math.abs(lb) < c.hy && p.z > c.z0 && p.z < c.z1) { out.wedge.inside++; break; } } }
      const e = Q.where(); out.wedge.end = [+e.x.toFixed(1), +e.y.toFixed(1), +e.z.toFixed(1)];
      if (out.wedge.inside) out.inside += out.wedge.inside;
    }
    return out;
  });
  if (res.wedge) console.log('wedge', JSON.stringify(res.wedge));
  console.log(`WALL narrow: ${res.runs} swims under ${res.roofs} roofs toward a gap narrower than his body: nearest his centre came to the roof ${res.worst.toFixed(2)} m (bound >= .30), ${res.inside} frames inside it (0), at ${JSON.stringify(res.at)}: ${res.runs >= 8 && res.worst >= .30 && res.inside === 0 ? 'green' : 'RED'}`);
  for (const l of logs.slice(0, 6)) console.log(l);
  await browser.close();
  process.exit(0);
}
// --slide: a body touching a solid must slide along it. He starts touching a solid, swims along its side, and must cover 3 m in a second. Plant: --plant-slide puts back a sweep that calls any overlap a hit.
if (has('slide')) {
  if (has('plant-slide')) await page.route('**/js/world.js', async (r) => { const res = await r.fetch(); let t = await res.text(); const n = t.length; t = t.replace('if (!heads && !wall) { lx = qx; ly = qy; lz = qz; continue; }', ''); console.log('plant', n - t.length); await r.fulfill({ response: res, body: t }); });
  await page.addInitScript({ path: path.resolve(path.dirname(new URL(import.meta.url).pathname), 'lib/qa_page.js') });
  await page.goto(`${arg('site', 'http://127.0.0.1:8791')}/index.html?film&qa&fresh&tier=phone`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.started && window.__game.hero && window.__qa, null, { timeout: 90000 });
  const res = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, W = G.world, C = W.data.colliders, R = .62, out = [];
    let blocked = 0;
    G.bot = null; Q.calm();
    const pick = C.filter(c => (c.t === 'cyl' ? c.r > 1.2 : Math.min(c.hx, c.hy) > 1) && c.z1 - c.z0 > 2.4 && c.z0 > -200);
    for (let i = 0, step = Math.max(1, pick.length / 300 | 0); i < pick.length && out.length < 60; i += step) {
      const c = pick[i], z = Math.max((c.z0 + c.z1) / 2, W.heightAt(c.x, c.y) + 1.4);
      if (z > -2 || z > c.z1 - .8 || z < c.z0 + .8) continue;
      let x, y, tx, ty;
      if (c.t === 'cyl') { const a = i * 2.4; x = c.x + Math.cos(a) * (c.r + R); y = c.y + Math.sin(a) * (c.r + R); tx = -Math.sin(a); ty = Math.cos(a); }
      else { const co = Math.cos(c.yaw || 0), si = Math.sin(c.yaw || 0); x = c.x + co * (c.hx + R); y = c.y + si * (c.hx + R); tx = -si; ty = co; }
      const p = { x, y, z }, q = { x, y, z }; W.collide(q, R);
      if (Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) > .02) continue;                     // something else is in the way at the start
      const go = () => { Q.swimAt(x, y, z, tx * 6, ty * 6, 0, 0); Q.aim(tx, ty, 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); for (let k = 0; k < 60; k++) h.step(1 / 60); const e = Q.where(); return Math.hypot(e.x - x, e.y - y); };
      let moved = go();
      if (moved < 3) { c.off = true; const free = go(); c.off = false; if (free < 3) { blocked++; continue; } }      // the control: with this solid off he still stops, so a neighbour is in the way, not the slide
      out.push(+moved.toFixed(2));
    }
    return { out, blocked };
  });
  const sorted = res.out.slice().sort((a, b) => a - b), med = sorted[sorted.length >> 1], ok = res.out.filter(v => v >= 3).length;
  console.log(`WALL slide: ${res.out.length} touching starts proved by their control (${res.blocked} set aside: a neighbour stops him with this solid off); ${ok} moved 3 m in a second, median ${med} m, least ${sorted[0]} m (bound: at least 90% and median >= 3): ${res.out.length >= 20 && ok / res.out.length >= .9 && med >= 3 ? 'green' : 'RED'}`);
  for (const l of logs.slice(0, 6)) console.log(l);
  await browser.close();
  process.exit(0);
}
// --contrast (L6): the Warden 60 CSS px tall against what's behind him, in the real game, at a spot of each kind. His picture is the frame with him minus the frame without him.
// At each point of his outline: the best contrast between anything in the outer 2.5 CSS px of him and the background 3 px outside him: an edge reads if there's a 3:1 step across it,
// whichever of his two tones makes it. Printed: the median over the outline and its share at 3:1. Plant: --plant-ink takes line and rim away, and the wall must go red.
if (has('contrast')) {
  if (has('plant-ink')) await page.route('**/js/look.js', async (r) => { const res = await r.fetch(); let t = await res.text(); t = t.replace('mvPosition.xyz += nv*max(ocPaint*1.2, small*1.5)/perM;', 'mvPosition.xyz += nv*0.0;').replace('if (vOcInk > .002)', 'if (vOcInk > 2.0)'); await r.fulfill({ response: res, body: t }); });
  await page.goto(`${arg('site', 'http://127.0.0.1:8791')}/index.html?film&tier=${tier}${arg('extra', '')}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.hero && window.__game.started, null, { timeout: 90000 }).catch(async () => { console.log('never started', JSON.stringify(await page.evaluate(() => ({ game: !!window.__game, keys: window.__game ? Object.keys(window.__game).length : 0, frame: !!(window.__game && window.__game.frame), hero: !!(window.__game && window.__game.hero), started: window.__game && window.__game.started })))); for (const l of logs.slice(0, 8)) console.log(l); });
  const res = await page.evaluate(async (hour) => {
    const G = window.__game, h = G.hero, c = document.getElementById('c');
    if (hour >= 0) G.sky.setHour(hour, false);
    const places = [
      ['reef', -26, -520, -7], ['arch', -34, -350, -14], ['kelp', -392, 30, -44], ['city', 20, -200, -45], ['colossus', 40, -130, -40], ['arena', 20, 60, -48],
      ['open blue', 420, -80, -30], ['trench', 60, 470, -120], ['vesper', -205, 520, -130], ['meridon', 430, 210, -30], ['surface', -26, -470, .3], ['beach', -205, -445, 0],
    ];
    if (G.world.data.size_m > 1500) places.push(['cinder', 720, -640, -120], ['forge', 810, -744, -124], ['wrack', -826, 190, -70], ['kraken', -866, 20, -100], ['rime', -40, 838, -30]);
    const out = [], w = c.width, ht = c.height, dpr = ht / c.clientHeight, cv = document.createElement('canvas'); cv.width = w; cv.height = ht; const x = cv.getContext('2d', { willReadFrequently: true });
    const lin = (v) => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    const LUT = new Float32Array(256).map((_, i) => lin(i));
    const lum = (d, i) => .2126 * LUT[d[i]] + .7152 * LUT[d[i + 1]] + .0722 * LUT[d[i + 2]];
    const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const band = Math.round(2.5 * dpr);
    const grab = () => { G.look.render(); x.drawImage(c, 0, 0); return x.getImageData(0, 0, w, ht).data; };
    let why = '';
    for (const [name, px, py, pz] of places) {
      let best = null;
      const ground = G.world.heightAt(px, py), z = Math.max(pz, ground + 1.1);
      for (const yaw of [.67, 2.24, 3.81, 5.38]) {
        for (let tries = 0, want = 19; tries < 3; tries++) {
          const dx = Math.sin(yaw), dz = Math.cos(yaw), lift = z > 0 ? 7 : 2;
          G.filmCam = () => { const t = h.drawPos; G.camera.fov = 70; G.camera.updateProjectionMatrix(); G.camera.position.set(t.x + dx * want, t.y + lift, t.z + dz * want); G.camera.lookAt(t.x, t.y + .4, t.z); };
          for (let i = 0; i < 8; i++) { h.pos.set(px, z, -py); h.prev.copy(h.pos); h.vel.set(0, 0, 0); G.frame(1 / 30); }
          const A = grab(); h.root.visible = false; const B = grab(); h.root.visible = true;
          const mask = new Uint8Array(w * ht); let x0 = w, x1 = 0, y0 = ht, y1 = 0, n = 0;
          for (let y = 0; y < ht; y++) for (let k = 0; k < w; k++) { const i = (y * w + k) * 4; if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 9) { mask[y * w + k] = 1; n++; if (k < x0) x0 = k; if (k > x1) x1 = k; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
          const tall = y1 - y0;
          why = `n ${n} box ${x0},${y0} ${x1},${y1} of ${w}x${ht}`;
          if (n < 40 || x0 < 8 || y0 < 8 || x1 > w - 9 || y1 > ht - 9) break;                           // something stands between, or he's cut by the frame: another side
          if (tries < 2 && Math.abs(tall - 60 * dpr) > 5 * dpr) { want *= tall / (60 * dpr); continue; }
          const rs = [], at = (X, Y) => (Y * w + X) * 4; let fig = 0, figN = 0, bg = 0;
          for (let y = y0; y <= y1; y++) for (let k = x0; k <= x1; k++) {
            if (!mask[y * w + k]) continue;
            fig += lum(A, at(k, y)); figN++;
            for (const [nx, ny] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              if (mask[(y + ny) * w + k + nx]) continue;
              const qx = k + nx * 3, qy = y + ny * 3; if (mask[qy * w + qx]) continue;              // a pocket: nothing of the background to read there
              const Lb = lum(B, at(qx, qy)); bg += Lb;
              let m = 0; for (let d = 0; d < band; d++) { const ix = k - nx * d, iy = y - ny * d; if (mask[iy * w + ix]) m = Math.max(m, ratio(lum(A, at(ix, iy)), Lb)); }
              rs.push(m); break;
            }
          }
          if (!rs.length) break;
          rs.sort((a, b) => a - b);
          const med = rs[rs.length >> 1], share = rs.filter(v => v >= 3).length / rs.length;
          x.putImageData(new ImageData(new Uint8ClampedArray(A), w, ht), 0, 0);
          const sh = document.createElement('canvas'); sh.width = sh.height = 200; sh.getContext('2d').drawImage(cv, (x0 + x1) / 2 - 100, (y0 + y1) / 2 - 100, 200, 200, 0, 0, 200, 200);
          const r = { name, est: +(G.look.inkBg ?? 0).toFixed(3), tall: +(tall / dpr).toFixed(0), med: +med.toFixed(2), share: +(share * 100).toFixed(0), meanFig: +(fig / figN).toFixed(3), meanBg: +(bg / rs.length).toFixed(3), plain: +ratio(fig / figN, bg / rs.length).toFixed(2), crop: sh.toDataURL('image/jpeg', .9) };
          if (!best || r.med > best.med) best = r;
          break;
        }
        if (best) break;
      }
      out.push(best || { name: name + ' (' + why + ')', tall: 0, med: 0, share: 0, meanFig: 0, meanBg: 0, plain: 0, crop: null });
    }
    G.filmCam = null;
    return out;
  }, +arg('hour', -1));
  const seen = res.filter(r => r.tall > 0), worst = seen.reduce((a, b) => (b.med < a.med ? b : a), seen[0]);
  { const files = seen.map((r) => { const f = path.join(out, `ct_${tag}_${r.name.replace(/ /g, '_')}.jpg`); fs.writeFileSync(f, Buffer.from(r.crop.split(',')[1], 'base64')); return f; });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...files.flatMap(f => ['-i', f]), '-filter_complex', files.map((_, i) => `[${i}:v]`).join('') + `hstack=inputs=${files.length}`, '-q:v', '3', path.join(out, `ct_${tag}_sheet.jpg`)]); }
  console.log(res.map(r => `${r.name}: ${r.tall} px tall, outline median ${r.med}:1, ${r.share}% of it at 3:1 (bare means ${r.meanFig} on ${r.meanBg}, ${r.plain}:1)${r.est ? ', water ' + r.est : ''}`).join('\n'));
  console.log(`WALL L6: ${seen.length} of ${res.length} spots seen; worst outline median ${worst.med}:1 at ${worst.name} (bound >= 3): ${worst.med >= 3 && seen.length >= 10 ? 'green' : 'RED'}`);
  for (const l of logs.slice(0, 6)) console.log(l);
  await browser.close();
  process.exit(0);
}
if (crossing) {
  await page.goto(`http://127.0.0.1:8791/index.html?film&tier=${tier}${arg('extra', '')}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.hero && window.__game.started, null, { timeout: 90000 });
  const dtf = 1 / +arg('fps', 30), n = +arg('frames', 150), vy = +arg('vy', 19);
  const res = await page.evaluate(async ([dt, n, vy, W0]) => {
    const G = window.__game, h = G.hero, c = document.getElementById('c'), s = document.createElement('canvas'); s.width = W0; s.height = Math.round(W0 * c.height / c.width);
    const x = s.getContext('2d', { willReadFrequently: true }), out = [];
    for (let i = 0; i < 30; i++) G.frame(dt);
    const tread = vy <= 0;
    h.pos.y = tread ? -1.15 : -3.2; h.prev.copy(h.pos); h.vel.set(0, tread ? 0 : vy, 0); h.state = 'swim'; h.air = false; h.land = false;
    for (let i = 0; i < n; i++) {
      if (tread) { h.pos.y = -1.15; h.vel.set(0, 0, 0); }
      G.frame(dt);
      x.drawImage(c, 0, 0, s.width, s.height);
      const d = x.getImageData(0, 0, s.width, s.height).data; let lum = 0, lo = 0; for (let k = 0; k < d.length; k += 16) { const l = .2 * d[k] + .7 * d[k + 1] + .1 * d[k + 2]; lum += l; if (l < 18) lo++; }
      out.push({ i, y: +G.camera.position.y.toFixed(2), hy: +h.pos.y.toFixed(2), lum: +(lum / (d.length / 16)).toFixed(1), dark: +(lo / (d.length / 16)).toFixed(3), url: s.toDataURL('image/jpeg', .8) });
    }
    return out;
  }, [dtf, n, vy, +arg('thumb', 260)]);
  const tagc = tag + '_' + engine;
  if (has('clip')) {
    const dir = path.join(out, tagc + '_clip'); fs.mkdirSync(dir, { recursive: true });
    res.forEach((r, i) => fs.writeFileSync(path.join(dir, String(i).padStart(4, '0') + '.jpg'), Buffer.from(r.url.split(',')[1], 'base64')));
    const mp4 = path.join(out, tagc + '.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', arg('clipfps', '15'), '-i', path.join(dir, '%04d.jpg'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-movflags', '+faststart', mp4]);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('clip', mp4);
  }
  const lums = res.map(r => r.lum), minL = Math.min(...lums), worstDark = Math.max(...res.map(r => r.dark));
  const med = lums.slice().sort((a, b) => a - b)[lums.length >> 1];
  console.log(`WALL crossing: darkest frame lum ${minL} at frame ${lums.indexOf(minL)} (bound >= .75 of the median ${med}), most dark pixels ${worstDark} (bound <= .05): ${minL >= .75 * med && worstDark <= .05 ? 'green' : 'RED'}`);
  if (has('log')) console.log(res.map(r => `${r.i}: cam ${r.y} hero ${r.hy} lum ${r.lum} dark ${r.dark}`).join('\n'));
  // the frames round each time the camera changes sides, and any frame much darker than its neighbours
  const pick = new Set();
  const every = +arg('every', 2);
  res.forEach((r, i) => { if (i && Math.sign(r.y) !== Math.sign(res[i - 1].y)) { for (let k = i - 3; k <= i + 3; k++) if (res[k]) pick.add(k); for (let k = i + 3; k <= i + 40; k += 5 * every) if (res[k]) pick.add(k); } });
  res.forEach((r, i) => { if (r.dark > .3) pick.add(i); });
  const list = [...pick].sort((a, b) => a - b).slice(0, 26), files = [];
  list.forEach((i) => { const f = path.join(out, `${tagc}_f${String(i).padStart(3, '0')}.jpg`); fs.writeFileSync(f, Buffer.from(res[i].url.split(',')[1], 'base64')); files.push(f); });
  if (files.length) {
    const sheet = path.join(out, `${tagc}_sheet.jpg`), cols = 13, rows = Math.ceil(files.length / cols);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...files.flatMap(f => ['-i', f]), '-filter_complex', files.map((_, i) => `[${i}:v]scale=150:-2[v${i}]`).join(';') + ';' + files.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:layout=` + files.map((_, i) => `${(i % cols) * 150}_${Math.floor(i / cols) * Math.round(150 * res[0].url.length / res[0].url.length * (h / w))}`).join('|') + ':fill=black', '-q:v', '3', sheet]);
    console.log('sheet', sheet, 'frames', list.join(','));
  }
  for (const l of logs.slice(0, 8)) console.log(l);
  await browser.close();
  process.exit(0);
}
const t0 = Date.now();
await page.goto(`${base}?cam=${cams[0]}&tier=${tier}&still${arg('extra', '')}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__look && (window.__look.ready || window.__look.error), null, { timeout: 90000 }).catch(() => logs.push('timed out waiting for ready'));
const err = await page.evaluate(() => window.__look && window.__look.error);
if (err) logs.push('page: ' + err);
console.log('ready in', Date.now() - t0, 'ms');
const saved = [];
if (!err) {
  await page.evaluate(() => window.__look.pause(true));
  const seq = +arg('seq', 1), gap = +arg('gap', .5);
  for (const c of cams) for (let i = 0; i < seq; i++) {
    // Time passes in small steps with the camera kept on the subject, so a sequence shows real motion.
    const n = i ? Math.round(gap * 30) : settle;
    const url = await page.evaluate(async ([c, n]) => { const L = window.__look; for (let k = 0; k < n; k++) { L.setCam(c); L.step(1); } L.setCam(c); L.step(1); return L.shot(); }, [c, n]);
    const f = path.join(out, `${tag}_${tier}${w > h ? '_wide' : ''}_${c}${seq > 1 ? '_' + i : ''}.jpg`);
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    saved.push(f);
    if (has('shimmer')) console.log('shimmer', JSON.stringify(await page.evaluate(() => window.__look.shimmer())));
    if (has('stats')) {
      const s = await page.evaluate(async () => { const L = window.__look; const m = await L.measure(30); return { ...L.stats(), ...m }; });
      console.log(JSON.stringify(s));
    } else {
      const s = await page.evaluate(() => { const L = window.__look.stats(); return { cam: L.cam, calls: L.calls, tris: L.triangles, world: L.tris }; });
      console.log(JSON.stringify(s));
    }
  }
  if (has('stats')) console.log(JSON.stringify(await page.evaluate(() => window.__look.memory())));
  if (has('flips')) console.log('WALL look flips', JSON.stringify(await page.evaluate(() => window.__look.flips(20))));
  if (has('flight')) console.log('flight', JSON.stringify(await page.evaluate((s) => window.__look.flight(s), +arg('secs', 14))));
}
await browser.close();
if (has('sheet') && saved.length > 1) {
  const sheet = path.join(out, `${tag}_${tier}${w > h ? '_wide' : ''}_sheet.jpg`);
  const hh = +arg('hh', tier === 'phone' && w < h ? 900 : 480);
  const inputs = saved.flatMap(f => ['-i', f]);
  const filter = saved.map((_, i) => `[${i}:v]scale=-2:${hh}[v${i}]`).join(';') + ';' + saved.map((_, i) => `[v${i}]`).join('') + `hstack=inputs=${saved.length}`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-q:v', '3', sheet]);
  console.log('sheet', sheet);
}
for (const l of logs.slice(0, 12)) console.log(l);
console.log(saved.join('\n'));
