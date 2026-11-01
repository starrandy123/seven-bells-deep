// F2: memory, by the framework's own weighing (ports_src/_kit/weigh_tally.js, the count the platform's certification reads): what the page asks the graphics card to hold, at a phone's size at 3x, at the title, in the game, at the arena, turned, turned back, and in the Painted look. The number is the most ever held: peak_mb + surfaces_peak_mb. EPIC §1.4: under 96 MB, never over 128 MB. Also the pixel ratio cap and the script heap.
// A real iPhone is owed: Safari's per-tab limit isn't published.
//   node weigh.mjs <base> <chromium|webkit> [--only=F2,F2p,F2t,F2r,F2h,F2m,F2n,F2l]
import { gate, PHONE } from './lib/h.mjs';
import { packs } from './lib/frames.mjs';
import fs from 'fs';
const W = await gate('weigh', { budget: 170 });
const { line, note, open, section, finish, engine, out } = W;
const TALLY = '/Users/randy/Documents/ports_src/_kit/weigh_tally.js';
const makeRead = (page, cdp) => async (label) => {
    const r = await page.evaluate(async () => { const mb = () => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null), raw = mb(), series = []; if (window.gc) { window.gc(); series.push(+mb().toFixed(1)); for (let i = 0; i < 7; i++) { await new Promise((d) => setTimeout(d, 500)); window.gc(); series.push(+mb().toFixed(1)); if (Math.abs(series[series.length - 1] - series[series.length - 2]) < 1) break; } } const o = window.__MOSA_WEIGHT.read(); o.heap_raw = raw === null ? null : +raw.toFixed(1); o.series = series; if (series.length) o.heap_mb = series[series.length - 1]; return o; });
    let v8 = ''; if (cdp) { try { const u = await cdp.send('Runtime.getHeapUsage'); r.v8 = u; v8 = `, V8 used ${(u.usedSize / 1048576).toFixed(1)}${u.backingStorageSize !== undefined ? ` + array buffers ${(u.backingStorageSize / 1048576).toFixed(1)}` : ''}`; } catch (e) { /* older browser */ } }
    note(`${label}: peak ${r.peak_mb} MB (textures ${r.textures_mb}, render buffers ${r.render_buffers_mb}, vertex buffers ${r.vertex_buffers_mb}), surfaces peak ${r.surfaces_peak_mb} MB; heap raw ${r.heap_raw}, after gc ${(r.series || []).join(' > ') || 'not read'}${v8}; canvas ${r.canvases.join(' ')}`); return r; };
await section(['F2', 'F2p', 'F2t', 'F2r', 'F2h'], async () => {
  if (!fs.existsSync(TALLY)) { line('F2', false, `the framework's tally isn't at ${TALLY}`); return; }
  // no ?demo: the bot doesn't ship (about 4 MB on the small map, look's reading), so he's driven through the game's own input
  // Q6 is 'never over', so it's watched, not sampled at the stops: every 100 ms from the first script, the tally so far plus the raw heap at that moment (a mix of one moment's heap and another's tally is a figure nothing ever held)
  const WATCH = `(() => { const S = window.__weighPeak = { peak: 0, at: 0, raw: 0, tally: 0, rawPeak: 0, rawAt: 0, n: 0 }, t0 = performance.now(); setInterval(() => { const raw = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0, w = window.__MOSA_WEIGHT && window.__MOSA_WEIGHT.read ? window.__MOSA_WEIGHT.read() : null, tally = w ? +w.peak_mb + +w.surfaces_peak_mb : 0, at = performance.now() - t0; S.n++; if (raw > S.rawPeak) { S.rawPeak = raw; S.rawAt = at; } if (raw + tally > S.peak) { S.peak = raw + tally; S.at = at; S.raw = raw; S.tally = tally; } }, 100); })()`;
  const { page, ctx, errors, close } = await open('?fresh&tier=phone', { ctx: PHONE, init: [{ path: TALLY }, WATCH] });
  const cdp = engine === 'chromium' ? await ctx.newCDPSession(page) : null;
  // CR-22 (X23, the lead's ruling): Q5 reads the platform's tally plus the heap after a collection; Q6 reads the tally plus the raw heap; the tally prints beside them, all three side by side. It's a definition chosen, not a pass earned. The room left under 96 MB is printed, and tools/score.mjs flags a round where it narrows
  // A collection isn't finished when gc() returns: freed ArrayBuffers go later (look read 74 MB at 1.5 s, 68 at 3.8, 52 at 9, straight after gc). So the collected heap here is settled: gc, wait 0.5 s, again, until two readings agree within 1 MB. The first reading, the settled one and V8's own split are all printed, so whether a load-time figure is a real peak can be read off the line.
  const read = makeRead(page, cdp);
  await page.waitForTimeout(1500); const a = await read('at the title');
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 15000 }); await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(500);
  await page.evaluate(() => { const Q = window.__qa, G = window.__game; if (G.cine && G.cine.active) G.cine.stop(true); Q.calm(); Q.drive({ my: 1, mx: 0.2, ud: 0, boost: true }); }); await page.waitForTimeout(6000); const packsIn = await packs(page); note(`region packs: ${packsIn}`); if (/NOT IN/.test(packsIn)) line('F2', false, 'no reading: the region packs never finished, so the tally is lighter than a player gets'); const b = await read('in the game');
  await page.evaluate(() => { const Q = window.__qa, G = window.__game, d = G.world.data, a = d.arena; Q.calm(); Q.swimAt(a.x, a.y - 30, Math.max(G.world.heightAt(a.x, a.y - 30) + 4, -20)); Q.drive({ my: 0.4, mx: 0, ud: 0, boost: false }); }); await page.waitForTimeout(2000);
  const c = await read('at the arena');
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(2500); const d = await read('turned');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(2500); const e0 = await read('upright again');
  const painted = await page.evaluate(() => { const G = window.__game; if (!G.look.setLook) return false; G.look.setLook('painted'); return true; }); await page.waitForTimeout(2500); const e = await read('in the Painted look');
  fs.writeFileSync(`${out}/weigh_detail_${engine}.json`, JSON.stringify({ a, b, c, d, e0, e }, null, 1));
  // EPIC §1: working memory is the JS heap plus the GPU's textures, buffers and drawing surfaces. WebKit gives no heap: its line is the GPU part alone, and says so.
  // The tally's peak is the most ever held, so after the Painted look every later reading carries Painted: Q5 in the look he starts in is read before the switch, and Painted has its own line.
  const peak = (r) => +r.peak_mb + +r.surfaces_peak_mb, gpu = peak(e0), gpuP = peak(e), played = [a, b, c, d, e0], heapMax = Math.max(...played.map((r) => +r.heap_mb || 0)), firstMax = Math.max(...played.map((r) => (r.series && r.series[0]) || 0));
  const S = await page.evaluate(() => { const s = window.__weighPeak; return { ...s, wall: performance.now() }; });
  const kept = gpu + heapMax, room = 96 - kept, keptP = gpuP + (+e.heap_mb || 0), turned = peak(d) - peak(c);
  const heapNote = engine === 'chromium' ? `tally plus the heap settled by at least two collections, until two agree within 1 MB, ${kept.toFixed(1)} MB (heap ${heapMax.toFixed(1)}: title ${a.heap_mb}, game ${b.heap_mb}, arena ${c.heap_mb}, turned ${d.heap_mb}, back ${e0.heap_mb}; straight after one gc it read ${firstMax.toFixed(1)} at most), the raw heap ${a.heap_raw} at the title, ${b.heap_raw} in the game` : 'WebKit gives no heap: this is the tally alone, not a Q5 reading';
  fs.writeFileSync(`${out}/weigh_room_${engine}.json`, JSON.stringify({ engine, gpu, heap: heapMax, q5: kept, room, painted: { gpu: gpuP, heap: +e.heap_mb || 0, q5: keptP, room: 96 - keptP }, q6: S.peak, q6at: S }, null, 1));
  line('F2', kept <= 96, `working memory in play, in the look he starts in (Q5, CR-22): ${kept.toFixed(1)} MB, under 96, ${room.toFixed(1)} MB of room, on this map, on V8 on this Mac: a definition chosen, not a pass earned; a real iPhone is owed. The platform's tally ${gpu.toFixed(1)} MB (graphics ${e0.peak_mb}, drawing surfaces ${e0.surfaces_peak_mb}); ${heapNote}; the largest: ${(e0.biggest || []).slice(0, 3).map((b) => b.join(' ')).join(' · ') || 'none over 4 MB'}`);
  line('F2p', painted && (engine === 'chromium' ? keptP <= 96 : gpuP <= 96), painted ? `Q5 holds in every look a player can pick: in Painted, ${engine === 'chromium' ? `${keptP.toFixed(1)} MB (under 96), ${(96 - keptP).toFixed(1)} MB of room: the tally ${gpuP.toFixed(1)} (graphics ${e.peak_mb}, drawing surfaces ${e.surfaces_peak_mb}), settled heap ${e.heap_mb}` : `the tally alone ${gpuP.toFixed(1)} MB (under 96), WebKit gives no heap`}` : 'no look switch in this build');
  line('F2t', S.peak <= 128 && turned <= 2, `never over 128 MB (Q6, CR-22: the tally so far plus the raw heap, sampled ${S.n} times, every 100 ms from the first script to the last reading, in a player's page: load, the title, the dive, the sea, the arena, turned, Painted): ${S.peak.toFixed(1)} MB at ${(S.at / 1000).toFixed(1)} s (the tally ${S.tally.toFixed(1)}, ${engine === 'chromium' ? `the raw heap ${S.raw.toFixed(1)}; the raw heap's own top ${S.rawPeak.toFixed(1)} at ${(S.rawAt / 1000).toFixed(1)} s` : 'WebKit gives no heap: this is the tally alone'}); turning added ${turned.toFixed(1)} MB to the graphics (≤ 2, ours: a resize that asks for its frames again shows here)`);
  const pr = await page.evaluate(() => window.__game.renderer.getPixelRatio());
  line('F2r', pr <= 2, `the pixel ratio on a 3x phone: ${pr.toFixed(2)} (≤ 2)`);
  line('F2h', engine !== 'chromium' || (+e.heap_mb > 0 && +e.heap_mb <= 96), engine === 'chromium' ? `the script heap, settled ${e.heap_mb} MB, with its garbage ${e.heap_raw} MB (≤ 96); ${errors.length} errors` : 'WebKit gives no heap: read in Chromium');
  await close();
});
// F2m, F2n: Q5 after the whole map. The route above barely grows a list and never meets the heavy near meshes, so it's a floor (the lead's tour, 1 Nov: 90.4 MB on that route, 93.7 over the whole map, 97.0 in Painted). Every named place, and a 256 m grid at two heights, then the same reading, then Painted
await section(['F2m', 'F2n'], async () => {
  const { page, ctx, errors, close } = await open('?fresh&tier=phone', { ctx: PHONE, init: [{ path: TALLY }] });
  const cdp = engine === 'chromium' ? await ctx.newCDPSession(page) : null, read = makeRead(page, cdp);
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 15000 }); await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(500);
  const n = await page.evaluate(async () => { const G = window.__game, Q = window.__qa, W = G.world, d = W.data, h = G.hero, S = d.size_m, stops = (d.poi || []).map((p) => [p.x, p.y, p.z]); if (G.cine && G.cine.active) G.cine.stop(true);
    for (let x = d.origin[0] + 128; x < d.origin[0] + S; x += 256) for (let y = d.origin[1] + 128; y < d.origin[1] + S; y += 256) { const g = W.heightAt(x, y); stops.push([x, y, Math.min(g + 6, -4)], [x, y, -1.5]); }
    for (const [x, y, z] of stops) { const g = W.heightAt(x, y); if (g > 0.5) Q.walkAt(x, y); else Q.swimAt(x, y, Math.max(z, g + 2)); h.place(); h.inv = 1e6; Q.aim(Math.cos(x), Math.sin(y), 0); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 70)))); }
    return stops.length; });
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(1500); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(1500);
  const m = await read('after the whole map'), peak = (r) => +r.peak_mb + +r.surfaces_peak_mb, kept = peak(m) + (+m.heap_mb || 0);
  await page.evaluate(() => { const G = window.__game; if (G.look.setLook) G.look.setLook('painted'); }); await page.waitForTimeout(2500); const e = await read('then Painted'), keptP = peak(e) + (+e.heap_mb || 0), gpu = engine !== 'chromium';
  line('F2m', gpu ? peak(m) <= 96 : kept <= 96, `Q5 after the whole map (${n} stops): ${gpu ? `the tally alone ${peak(m).toFixed(1)} MB, WebKit gives no heap` : `${kept.toFixed(1)} MB, ${(96 - kept).toFixed(1)} MB of room: the tally ${peak(m).toFixed(1)}, settled heap ${m.heap_mb}`}`);
  line('F2n', gpu ? peak(e) <= 96 : keptP <= 96, `Q5 after the whole map in Painted: ${gpu ? `the tally alone ${peak(e).toFixed(1)} MB` : `${keptP.toFixed(1)} MB, ${(96 - keptP).toFixed(1)} MB of room`}; ${errors.length} errors`);
  await close();
});
// F2l: is load's raw peak held, or garbage? The same player's page, with a collection at every sample: what's still alive after it is what any engine has to hold at that moment, however eagerly it collects. Q6 stays the raw figure (CR-22); this says what kind of peak it is. It reads high if anything, because a collection frees array buffers after it returns (look's reading).
await section(['F2l'], async () => {
  if (engine !== 'chromium') { line('F2l', true, 'WebKit gives no heap: read in Chromium'); return; }
  const LIVE = `(() => { const S = window.__weighLive = { peak: 0, at: 0, live: 0, tally: 0, n: 0, top: 0, topAt: 0 }, t0 = performance.now(); setInterval(() => { if (!window.gc || !performance.memory) return; window.gc(); const live = performance.memory.usedJSHeapSize / 1048576, w = window.__MOSA_WEIGHT && window.__MOSA_WEIGHT.read ? window.__MOSA_WEIGHT.read() : null, tally = w ? +w.peak_mb + +w.surfaces_peak_mb : 0, at = performance.now() - t0; S.n++; if (live > S.top) { S.top = live; S.topAt = at; } if (live + tally > S.peak) { S.peak = live + tally; S.at = at; S.live = live; S.tally = tally; } }, 100); })()`;
  const { page, close } = await open('?fresh&tier=phone', { ctx: PHONE, init: [{ path: TALLY }, LIVE] });
  await page.waitForTimeout(3000); const S = await page.evaluate(() => window.__weighLive); await close();
  line('F2l', S.n >= 10 && S.peak <= 128, `load's peak, with a collection at every 100 ms sample from the first script (${S.n} samples): the tally so far plus what's still alive, ${S.peak.toFixed(1)} MB at ${(S.at / 1000).toFixed(1)} s (under 128, the raw bound's own line): the tally ${S.tally.toFixed(1)}, alive ${S.live.toFixed(1)}; the most alive at any sample ${S.top.toFixed(1)} MB at ${(S.topAt / 1000).toFixed(1)} s`);
});
await finish();
