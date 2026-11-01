// What's on the screen: real frames read back from the GPU. A burst's share of the screen, draw calls, the cost of a frame in the worst fight.
//   node walls_look.mjs [port=8812] [only=regex]
import { rig } from './rig.mjs'; import { STAGE } from './scenarios.mjs';
const [port = '8791', only = '', engine = 'chromium'] = process.argv.slice(2);
const r = await rig({ engine, port: +port, tier: 'phone', draw: true, limit: 150 }); await r.page.evaluate(STAGE);
await r.page.evaluate(() => {
  const G = window.__game, h = G.hero, S = window.__stage; S.spot = S.open();
  S.settle = (d) => { G.enemies.clearAll(); G.combat.reset(); S.place(S.spot.x, S.spot.y, S.spot.z, 0.6); h.hp = h.maxHp = 1e5; h.tide = h.maxTide = 1e5; h.state = 'swim'; G.hitstop = 0; for (let i = 0; i < 40; i++) G.frame(1 / 60); };
  const gl = G.renderer.getContext(); let buf = null;
  S.read = () => { const w = gl.drawingBufferWidth, hh = gl.drawingBufferHeight; if (!buf || buf.length !== w * hh * 4) buf = new Uint8Array(w * hh * 4); gl.readPixels(0, 0, w, hh, gl.RGBA, gl.UNSIGNED_BYTE, buf); const n = Math.floor(w / 3) * Math.floor(hh / 3), out = new Float32Array(n); let k = 0; for (let y = 1; y + 1 < hh && k < n; y += 3) for (let x = 1; x + 1 < w && k < n; x += 3) { const i = (y * w + x) * 4; out[k++] = 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]; } return out; };
  S.share = (a, b) => { let c = 0; for (let i = 0; i < a.length; i++) if (b[i] - a[i] > 42) c++; return (c / a.length) * 100; };
});
const results = []; let bad = 0; const re = only ? new RegExp(only) : null;
const say = (ok, line) => { if (re && !re.test(line)) return; console.log((ok ? '✔ ' : '✖ ') + line); if (!ok) bad++; };
const area = async () => r.page.evaluate(() => {
  const G = window.__game, S = window.__stage, h = G.hero; let worst = 0, at = '', control = 0;
  S.settle(); const c0 = S.read(); G.frame(1 / 60); const c1 = S.read(); control = S.share(c0, c1);
  for (const dist of [6.5, 3]) for (const kind of ['light', 'medium', 'heavy', 'finisher']) for (const el of ['water', 'ice']) {
    S.settle(); const p = S.ahead(dist, 0, 0.7), d = p.clone().sub(h.pos).normalize(); const base = S.read(); G.fx.impact(p, d, kind, el);
    for (let f = 0; f < 14; f++) { G.frame(1 / 60); const s = S.share(base, S.read()); if (s > worst) { worst = s; at = `${kind} ${el} at ${dist} m, frame ${f}`; } } G.frame(1 / 60);
    for (let f = 0; f < 40; f++) G.frame(1 / 60);
  }
  return { worst, at, control };
});
for (const [w, h, name] of [[844, 390, 'turned'], [390, 844, 'upright']]) {
  await r.page.setViewportSize({ width: w, height: h }); await r.page.waitForTimeout(300);
  const a = await area();
  say(a.worst <= 10 && a.control < 1, `a burst covers at most ${a.worst.toFixed(1)}% of the screen, ${name} (≤ 10; ${a.at}; a still sea reads ${a.control.toFixed(1)}%)`);
}
await r.page.setViewportSize({ width: 844, height: 390 }); await r.page.waitForTimeout(300);
const fight = await r.page.evaluate(() => {
  const G = window.__game, S = window.__stage, h = G.hero, gl = G.renderer.getContext(), px = new Uint8Array(4);
  const cost = (n) => { let sum = 0, peak = 0; for (let i = 0; i < n; i++) { const t = performance.now(); G.frame(1 / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const d = performance.now() - t; sum += d; peak = Math.max(peak, d); } return { avg: sum / n, peak }; };
  S.settle(); const idle = cost(40), callsIdle = G.look.stats().calls;
  S.settle(); h.hp = h.maxHp = 1e5; G.combat.setStance('water', true); for (const [d, s] of [[5, 1], [6, -2], [8, 2], [9, -3], [10, 0]]) { const e = S.foe('reaver', d, s, 0.3); e.hp = e.maxHp = 1e4; e.t = 99; }
  // combat's own draws, counted from its own objects: the renderer's total swings with the scenery as he lunges and the camera turns
  const own = () => { let n = 0; for (const o of G.fx.warmList) { if (o.visible === false) continue; o.traverse((c) => { if (c.isMesh && c.visible && !c.isInstancedMesh && !(c.parent && c.parent.visible === false)) n++; else if (c.isInstancedMesh && c.visible && c.count > 0) n++; }); } return n; };
  const busy = []; let maxCalls = 0, maxSprites = 0, maxVerts = 0, maxCr = 0, maxOwn = 0; const seq = [[0, { atk: true }], [24, { dash: true }], [60, { spin: true }], [110, { wave: true }], [150, { p4: true }], [190, { atk: true }]];
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // the GPU's backlog from the setup: a sync here, or the first timed frame reads it as a hitch
  const t0 = performance.now(); let sum = 0, peak = 0, n = 0;
  for (let f = 0; f < 240; f++) { const p = seq.find((q) => q[0] === f); S.held = {}; const t = performance.now(); S.frame(f, p ? p[1] : null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const d = performance.now() - t; sum += d; peak = Math.max(peak, d); n++; const st = G.look.stats(); maxOwn = Math.max(maxOwn, own()); maxCalls = Math.max(maxCalls, st.calls); maxSprites = Math.max(maxSprites, G.fx.stats.sprites + G.fx.stats.over); maxVerts = Math.max(maxVerts, G.fx.stats.fluidVerts); maxCr = Math.max(maxCr, G.fx.stats.crystals); }
  G.combat.setStance('ice', true); const seq2 = [[0, { dash: true }], [40, { spin: true }], [100, { wave: true }]]; for (let f = 0; f < 200; f++) { const p = seq2.find((q) => q[0] === f); S.frame(f, p ? p[1] : null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const st = G.look.stats(); maxOwn = Math.max(maxOwn, own()); maxCalls = Math.max(maxCalls, st.calls); maxSprites = Math.max(maxSprites, G.fx.stats.sprites + G.fx.stats.over); maxCr = Math.max(maxCr, G.fx.stats.crystals); }
  void t0; void busy; return { idle, callsIdle, avg: sum / n, peak, maxOwn, maxCalls, maxSprites, maxVerts, maxCr, geos: G.look.stats().geometries, tex: G.look.stats().textures };
});
say(fight.maxOwn <= 20 && fight.maxCalls <= 100, `a full fight draws ${fight.maxOwn} of its own (≤ 20: five foes with their ink, the effects), ${fight.maxCalls} in all with the world (≤ 100; ${fight.callsIdle} at rest)`);
say(fight.avg - fight.idle.avg <= 3 && fight.peak <= 33, `the fight's frame costs ${fight.avg.toFixed(1)} ms against ${fight.idle.avg.toFixed(1)} at rest on this M1 (≤ 3 ms added), worst frame ${fight.peak.toFixed(1)} ms (≤ 33: nothing compiles or uploads mid-fight)`);
say(fight.maxSprites < 450 && fight.maxVerts <= 3600, `at the peak ${fight.maxSprites} sprites, ${fight.maxVerts} fluid verts, ${fight.maxCr} crystals (phone caps 450, 3600, 96)`);
const errs = [...new Set(r.errors)]; if (errs.length) { console.log('✖ page errors: ' + errs.slice(0, 5).join(' | ').slice(0, 700)); bad++; }
console.log(bad ? `RED: ${bad} failed` : 'all green'); await r.close(); process.exit(bad ? 1 : 0);
