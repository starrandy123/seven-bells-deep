// Movement evidence: drives the real game by steps from a script, films it from the game's own camera, logs the drawn bones every frame.
//   node move_film.mjs <out dir> <scenario> [port=8791] [w=640] [h=360] [everyNth=2]
// Writes <out>/<scenario>/frames/*.jpg, log.json (one row a frame), film_1x.mp4 and film_quarter.mp4. No file of the game is touched.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const require = createRequire('/Users/randy/Documents/package.json'); const pw = require('playwright');
const [outRoot = '/tmp/move', scenario = 'flat', port = '8791', W = '640', H = '360', nth = '2'] = process.argv.slice(2);
const out = path.join(outRoot, scenario), framesDir = path.join(out, 'frames'); fs.rmSync(framesDir, { recursive: true, force: true }); fs.mkdirSync(framesDir, { recursive: true });

// a scenario: where he starts, and timed steps { s: seconds, set: what the stick and buttons do }. look: turn the camera by this many radians over the step
const S = {
  scout: null,
  flat: { at: 'flat', steps: [
    { s: 1.0, set: { my: 0 }, name: 'stand' }, { s: 2.2, set: { my: 0.22 }, name: 'walk' },
    { s: 2.6, reset: 1, set: { my: 1 }, name: 'run' },
    { s: 0.5, reset: 1, set: { my: 1 }, name: 'accel' }, { s: 1.4, set: { my: 1, boost: true }, name: 'sprint' }, { s: 1.2, set: { my: 0, boost: false }, name: 'stop' },
    { s: 0.8, reset: 1, set: { my: 1 }, name: 'start' }, { s: 0.7, set: { my: 1 }, look: Math.PI, name: 'uturn' }, { s: 0.8, set: { my: 1 }, name: 'run2' },
    { s: 1.5, set: { my: 1, jump: true }, name: 'jump' }, { s: 0.8, set: { my: 0 }, name: 'settle' } ] },
  super: { at: 'long', steps: [ { s: 0.6, set: { my: 1 }, name: 'run' }, { s: 1.6, set: { my: 1, boost: true }, name: 'charge' }, { s: 1.6, set: { my: 1, boost: true }, name: 'super' }, { s: 1.0, set: { my: 0, boost: false }, name: 'stop' } ] },
  slope: { at: 'slope', steps: [ { s: 0.6, set: { my: 0 }, name: 'stand' }, { s: 4.0, set: { my: 0.25 }, name: 'walk_up' }, { s: 0.5, set: { my: 0 }, name: 'stop' }, { s: 3.0, set: { my: 1 }, name: 'run_up' } ] },
  surf: { at: 'sea', steps: [ { s: 0.5, set: { my: 1 }, name: 'swim' }, { s: 2.4, set: { my: 1, boost: true }, name: 'up' }, { s: 1.4, set: { my: 1, mx: 0.8, boost: true }, name: 'carve_r' }, { s: 1.2, set: { my: 1, mx: -0.8, boost: true }, name: 'carve_l' }, { s: 1.2, set: { my: 1, mx: 0, boost: true, jump: true }, name: 'jump' }, { s: 1.6, set: { my: 1, boost: true }, name: 'again' }, { s: 1.2, set: { my: 0, mx: 0, ud: -1, boost: false }, name: 'dive' } ] },
  ride: { at: 'sea', steps: [ { s: 0.3, set: { my: 0 }, name: 'sea' }, { s: 0.8, whale: 1, set: { my: 0 }, name: 'near' }, { s: 4.5, set: { ride: true }, name: 'ride' }, { s: 1.5, set: { ride: true }, name: 'off' } ] },
  dolphin: { at: 'sea', steps: [ { s: 0.9, set: { my: 1 }, name: 'swim' }, { s: 2.4, set: { my: 1, jump: true }, name: 'leap' }, { s: 1.4, set: { my: 1, boost: true }, name: 'boost' }, { s: 2.0, set: { my: 1, boost: true, jump: true }, name: 'leap_boost' }, { s: 0.9, set: { my: 1, jump: true }, name: 'tap' }, { s: 2.6, set: { my: 1 }, name: 'chain' }, { s: 1.0, set: { my: 1 }, name: 'in' } ] },
  tread: { at: 'spawn', steps: [ { s: 6, set: { my: 0 }, name: 'tread' }, { s: 2.4, set: { my: 0.7 }, name: 'swim' }, { s: 2.2, set: { my: 0 }, name: 'stop' } ] },
  treadside: { at: 'spawn', cam: 'side', steps: [ { s: 4, set: { my: 0 }, name: 'tread' }, { s: 2.4, set: { my: 0.7 }, name: 'swim' }, { s: 2, set: { my: 0 }, name: 'stop' } ] },
  treadback: { at: 'spawn', cam: 'back', steps: [ { s: 5, set: { my: 0 }, name: 'tread' } ] },
  treadnear: { at: 'spawn', cam: 'near', steps: [ { s: 5, set: { my: 0 }, name: 'tread' } ] },
  draw: { at: 'spawn', cam: 'near', steps: [ { s: 0.8, set: { my: 0 }, name: 'tread' }, { s: 1.2, set: { my: 0, atk: true }, name: 'blow' }, { s: 4.2, set: { my: 0 }, name: 'after' } ] },
  landnear: { at: 'flat', cam: 'near', steps: [ { s: 2, set: { my: 0 }, name: 'idle' }, { s: 2.6, set: { my: 0.25 }, name: 'walk' }, { s: 2.2, set: { my: 1 }, name: 'run' }, { s: 1.8, set: { my: 1, boost: true }, name: 'sprint' }, { s: 1.6, set: { my: 0, boost: false }, name: 'stop' }, { s: 1.0, set: { my: 0 }, name: 'still' } ] },
  landback: { at: 'flat', cam: 'back', steps: [ { s: 2, set: { my: 0 }, name: 'idle' }, { s: 2.6, set: { my: 0.25 }, name: 'walk' }, { s: 2.2, set: { my: 1 }, name: 'run' }, { s: 1.8, set: { my: 1, boost: true }, name: 'sprint' }, { s: 1.6, set: { my: 0, boost: false }, name: 'stop' }, { s: 1.0, set: { my: 0 }, name: 'still' } ] },
  flowwater: { at: 'sea', steps: [ { s: 1.2, set: { my: 1 }, name: 'swim' }, { s: 0.7, set: { my: 1, atk: true }, name: 'strike' }, { s: 0.6, set: { my: 1, boost: true }, name: 'dodge' }, { s: 2.6, set: { my: 1, boost: false, jump: true }, name: 'leap' }, { s: 1.2, set: { my: 0 }, name: 'after' } ] },
  flowland: { at: 'flat', steps: [ { s: 1.6, set: { my: 1 }, name: 'run' }, { s: 0.8, set: { my: 1, atk: true }, name: 'strike' }, { s: 0.9, set: { my: 1, dash: true }, name: 'dash' }, { s: 1.6, set: { my: 0 }, name: 'stop' } ] },
  cmp: { at: 'long', cam: 'near', label: 'in the game', steps: [ { s: 0.9, set: { my: 0.22 }, name: 'a' }, { s: 2.4, set: { my: 0.22 }, name: 'walk' }, { s: 0.8, set: { my: 0.66 }, name: 'b' }, { s: 2.4, set: { my: 0.66 }, name: 'jog' }, { s: 0.8, set: { my: 1 }, name: 'c' }, { s: 2.4, set: { my: 1 }, name: 'run' } ] },
  cmpraw: { at: 'long', cam: 'near', raw: 1, label: 'the raw capture on his body', steps: [ { s: 0.9, set: { my: 0.22 }, name: 'a' }, { s: 2.4, set: { my: 0.22 }, name: 'walk' }, { s: 0.8, set: { my: 0.66 }, name: 'b' }, { s: 2.4, set: { my: 0.66 }, name: 'jog' }, { s: 0.8, set: { my: 1 }, name: 'c' }, { s: 2.4, set: { my: 1 }, name: 'run' } ] },
  shore: { at: 'shore', steps: [ { s: 7.0, set: { my: 1 }, name: 'wade_out' }, { s: 1.0, set: { my: 0 }, name: 'stop' } ] },
};

setTimeout(() => { console.log('TIMED OUT at 170 s (own limit)'); process.exit(3); }, 170000);
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium' }).catch(() => pw.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: +W, height: +H } }); const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
await page.goto(`http://127.0.0.1:${port}/index.html?film&fresh&tier=${process.env.FILM_TIER || 'desktop'}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 120000 });

// find the ground: flat land, a slope, a shore, measured from the game's own heightAt
const places = await page.evaluate(() => {
  const G = window.__game, H = (x, z) => G.world.heightAt(x, -z), size = (G.world.data.size_m || 1280) / 2, out = { poi: (G.world.data.poi || []).map((p) => [p.id || p.name, Math.round(p.x), Math.round(-p.y), Math.round(p.z)]) };
  const slope = (x, z) => { const e = 1.5, gx = (H(x + e, z) - H(x - e, z)) / (2 * e), gz = (H(x, z + e) - H(x, z - e)) / (2 * e); return Math.hypot(gx, gz); };
  let land = 0, n = 0, flat = null, sl = null, shore = null, best = 0, flatBest = 0;
  const free = (x, z) => { const p = { x, y: -z, z: H(x, z) + 1.0 }; return !G.world.collide(p, 0.6); };
  for (let x = -size; x < size; x += 6) for (let z = -size; z < size; z += 6) {
    n++; const h = H(x, z); if (h < 0.4) continue; land++;
    const nearSun = Math.hypot(x + 330, z - 465) < 190; if (!nearSun) continue;
    // open meadow: the longest straight run along +x with gentle ground and nothing to hit
    let run = 0; for (let k = 0; k < 60; k++) { const px = x + k * 3; if (H(px, z) < 1.0 || slope(px, z) > 0.14 || !free(px, z)) break; run = k; }
    if (run > flatBest) { flatBest = run; flat = { x, z, h, run: run * 3 }; }
    const s = slope(x, z); if (s > best && s < 0.72 && h > 4 && free(x, z)) { best = s; sl = { x, z, h, s }; }
  }
  // the longest clear line on any land, any of 16 headings, for the super sprint
  let lng = null, lb = 0;
  for (let x = -size; x < size; x += 12) for (let z = -size; z < size; z += 12) { if (H(x, z) < 1) continue;
    for (let a = 0; a < 16; a++) { const yaw = a * Math.PI / 8, sx = Math.sin(yaw), sz = Math.cos(yaw); let r = 0;
      for (let k = 1; k < 70; k++) { const px = x + sx * k * 3, pz = z + sz * k * 3; if (H(px, pz) < 0.8 || slope(px, pz) > 0.3 || !free(px, pz)) break; r = k; }
      if (r > lb) { lb = r; lng = { x, z, yaw, run: r * 3 }; } } }
  out.long = lng;
  for (let x = -size; x < size && !shore; x += 4) for (let z = -size; z < size; z += 4) { const a = H(x, z), b = H(x + 30, z); if (a < -3 && b > 1) { let mono = true; for (let k = 1; k <= 15; k++) if (H(x + k * 2, z) < H(x + (k - 1) * 2, z) - 0.05) mono = false; if (mono) { shore = { x, z, a, b }; break; } } }
  let sea = null; for (let x = -size + 60; x < size - 200 && !sea; x += 24) for (let z = -size + 60; z < size - 60; z += 24) { let ok = true; for (let k = 0; k <= 12 && ok; k++) if (H(x + k * 12, z) > -9) ok = false; if (ok) { sea = { x, z }; break; } }
  return { ...out, land, n, flat, slope: sl, shore, sea };
});
console.log(JSON.stringify(places));
if (scenario === 'scout') { console.log('errors', errors.length ? errors.slice(0, 6) : 'none'); await browser.close(); process.exit(0); }
const sc = S[scenario];

await page.evaluate(({ sc, places }) => {
  const G = window.__game, h = G.hero; G.started = G.playing = true; document.getElementById('title')?.classList.remove('on'); const hud = document.getElementById('hud'); if (hud) hud.style.display = 'none'; G.ui.update = () => {};
  const sw = (G.world.data.spawn || {}), spot = sc.at === 'spawn' ? { x: sw.x, z: -sw.y } : places[sc.at];
  let x = spot.x, z = spot.z, yaw = Math.PI / 2;      // +x along three's axes
  if (sc.at === 'slope') { const e = 1.5, H = (a, b) => G.world.heightAt(a, -b), gx = (H(x + e, z) - H(x - e, z)) / (2 * e), gz = (H(x, z + e) - H(x, z - e)) / (2 * e); yaw = Math.atan2(gx, gz); x -= Math.sin(yaw) * 14; z -= Math.cos(yaw) * 14; }
  if (sc.at === 'shore') { yaw = -Math.PI / 2; x += 30; }
  if (sc.at === 'long') yaw = spot.yaw;
  if (sc.at === 'sea') yaw = Math.PI / 2;
  window.__home = () => { const y = G.world.heightAt(x, -z); h.pos.set(x, sc.at === 'spawn' ? (sw.z ?? -6) : y > 0 ? y + 0.92 : sc.at === 'sea' ? -0.6 : -1.4, z); h.vel.set(0, 0, 0); h.prev.copy(h.pos); h.drawPos.copy(h.pos); h.land = y > -1; h.grounded = h.land; h.air = false; h.surge = 0; h.boostHeld = 0; G.camYaw = h.heading = yaw; G.camPitch = sc.at === 'sea' ? 0 : -0.08; h.spd = 0; if (h.place) h.place(); };
  window.__home(); if (sc.at === 'spawn') { h.land = false; h.grounded = false; }
  if (sc.raw) h.body.raw = true;
  if (sc.label) document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;left:14px;top:10px;font:600 22px system-ui,sans-serif;color:#fff;text-shadow:0 1px 4px #000;z-index:99">${sc.label}</div>`);
  if (sc.cam === 'near' || sc.cam === 'back') G.filmCam = () => { const cam = G.camera, p = h.drawPos, a = h.heading + (sc.cam === 'near' ? 1.57 : 3.14), d = sc.cam === 'near' ? 3.0 : 3.2, u = sc.cam === 'near' ? 0.1 : 0.7; cam.position.set(p.x + Math.sin(a) * d, p.y + u, p.z + Math.cos(a) * d); cam.up.set(0, 1, 0); cam.fov = 50; cam.updateProjectionMatrix(); cam.lookAt(p.x, p.y - 0.1, p.z); };
  if (sc.cam === 'side') G.filmCam = () => { const cam = G.camera, p = h.drawPos, a = h.heading + 1.57; cam.position.set(p.x + Math.sin(a) * 4.4, p.y + 0.5, p.z + Math.cos(a) * 4.4); cam.up.set(0, 1, 0); cam.lookAt(p.x, p.y, p.z); };
  G.quest && (G.quest.step = () => {}); if (G.enemies && G.enemies.alive) for (const e of G.enemies.alive()) { e.t = 0; }
  G.script = { my: 0, mx: 0, boost: false, jump: false, ud: 0, turn: 0 };
  G.bot = { drive(u, dt) { const s = G.script; u.my = s.my; u.mx = s.mx; u.ud = s.ud; u.boost = s.boost; u.yaw = (s.turn || 0) * dt; if (s.jump) { u.jump = true; s.jump = false; } if (s.ride) { u.ride = true; s.ride = false; } if (s.atk) { u.atk = true; s.atk = false; } if (s.dash) { u.dash = true; s.dash = false; } G.hero.boostFuel = 1; } }; for (const k in h.powers) h.powers[k] = true;
  const pick = (n) => h.root.getObjectByName(n);
  window.__b = { fR: pick('foot_R'), fL: pick('foot_L'), tR: pick('toe_R'), tL: pick('toe_L'), hips: pick('hips'), head: pick('head') };
  window.__row = (name) => { const v = new (h.pos.constructor)(), b = window.__b, r = { n: name, t: +G.time.toFixed(4), p: h.pos.toArray().map((q) => +q.toFixed(3)), v: h.vel.toArray().map((q) => +q.toFixed(2)), sp: +h.speed.toFixed(2), hd: +h.heading.toFixed(3), st: h.state, land: h.land ? 1 : 0, air: h.air ? 1 : 0, sg: +h.surge.toFixed(2), gr: +G.world.heightAt(h.pos.x, -h.pos.z).toFixed(3), cam: G.camera.position.toArray().map((q) => +q.toFixed(2)) };
    for (const k of ['fR', 'fL', 'tR', 'tL', 'hips', 'head']) if (b[k]) { b[k].getWorldPosition(v); r[k] = v.toArray().map((q) => +q.toFixed(4)); }
    if (h.body && h.body.legs) { r.dnR = h.body.legs[0].down ? 1 : 0; r.dnL = h.body.legs[1].down ? 1 : 0; r.phase = +h.body.phase.toFixed(3); r.drop = +(h.dropNow || 0).toFixed(3); }
    r.gR = r.fR ? +G.world.heightAt(r.fR[0], -r.fR[2]).toFixed(3) : 0; r.gL = r.fL ? +G.world.heightAt(r.fL[0], -r.fL[2]).toFixed(3) : 0; return r; };
}, { sc, places });

const log = []; let f = 0; const every = +nth;
for (const st of sc.steps) {
  await page.evaluate((s) => { if (s.reset) window.__home(); if (s.whale) { const G = window.__game, h = G.hero, w = G.life.whales[0]; if (w) { h.pos.set(w.pos.x + 6, w.pos.y + 5, w.pos.z); h.vel.set(0, 0, 0); h.prev.copy(h.pos); h.drawPos.copy(h.pos); h.land = false; h.air = false; h.state = 'swim'; h.place(); } } const a = window.__game.script; Object.assign(a, s.set); a.turn = s.look ? s.look / s.s : 0; }, st);
  const n = Math.round(st.s * 60);
  for (let i = 0; i < n; i++) {
    const row = await page.evaluate(([name]) => { const G = window.__game; G.frame(1 / 60); return window.__row(name); }, [st.name]);
    log.push(row);
    if (i % every === 0) { await page.screenshot({ path: path.join(framesDir, String(f).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 80 }); f++; }
  }
}
fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify(log));
await browser.close();
const fps = 60 / every;
const mk = (rate, name) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(rate), '-i', path.join(framesDir, '%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', path.join(out, name)]);
mk(fps, 'film_1x.mp4'); mk(fps / 4, 'film_quarter.mp4');
console.log(JSON.stringify({ frames: f, rows: log.length, errors: [...new Set(errors)].slice(0, 8) }));
process.exit(0);
