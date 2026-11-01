// E3: no seizure-risk flashing, and shake can be turned off. E4 (a SHOULD): keys by position, remapping, toggles, haptics.
// E3f reads what's on the screen: every frame of a scripted pass through the game's loud moments (blows, powers, a bell, the boss, a plunge) is read from the canvas right after it's drawn, into a grid of cells, as relative luminance, with the hurt overlay on top.
// WCAG 2.3.1's general flash: a pair of opposing changes of 10% of full luminance, the darker under 0.8, over 11% of the screen together (the small safe area, 341 x 256 of 1024 x 768); more than 3 in any second fails. Red: the same on saturated red (R/(R+G+B) ≥ 0.8). EA's IRIS can't be installed here: this is the same rule, written out, and a real phone recording is owed to it.
// E3c counts the game's own flashes (look.flash): at most 3 started in any 1 s. E3s: shake off: the setting, and prefers-reduced-motion, leave the camera still; the control: with shake on it moves.
//   node motion.mjs <base> <chromium|webkit> [--only=E3f,E3r,E3c,E3s,E3m,E4,E4r,E4t,E4h]
import { gate, SMALL } from './lib/h.mjs';
const W = await gate('motion', { budget: 170 });
const { line, note, open, section, finish, engine } = W;

const PASS = () => {
  const Q = window.__qa, G = window.__game, h = G.hero, cv = G.renderer.domElement, tmp = document.createElement('canvas'); tmp.width = 32; tmp.height = 18; const c2 = tmp.getContext('2d', { willReadFrequently: true });
  G.bot = null; Q.start();
  const lum = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const flashes = []; const fl0 = G.look.flash; G.look.flash = (...a) => { flashes.push(G.time); return fl0.apply(G.look, a); };
  const rows = [], reds = [], hurtEl = document.getElementById('hurt');
  const read = () => { c2.drawImage(cv, 0, 0, 32, 18); const d = c2.getImageData(0, 0, 32, 18).data, L = new Float32Array(32 * 18), R = new Uint8Array(32 * 18), a = parseFloat(getComputedStyle(hurtEl).opacity) || 0; for (let i = 0; i < L.length; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], l = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b); L[i] = l * (1 - a * 0.5) + 0.05 * a * 0.5; R[i] = r / (r + g + b + 1) >= 0.8 ? 1 : 0; } rows.push(L); reds.push(R); };
  const frames = (n, each) => { for (let i = 0; i < n; i++) { if (each) each(i); G.frame(1 / 60); read(); } };
  // the loud moments
  const e = G.enemies.encounters.find((x) => x.kind !== 'shark') || G.enemies.encounters[0];
  for (const k in h.powers) h.powers[k] = true; h.tide = h.maxTide = 900; h.inv = 1e6; G.hero.hp = G.hero.maxHp = 5000;
  h.pos.copy(e.c).add({ x: 3, y: 2, z: 4 }); h.prev.copy(h.pos); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); frames(60);
  const press = (k) => { const c = h.cool; for (const n in c) c[n] = 0; h.tide = 900; Q._wish[k] = true; };
  for (const k of ['atk', 'atk', 'atk', 'dash', 'spin', 'wave', 'call', 'atk', 'atk', 'parry', 'dash', 'wave']) { press(k); frames(26); }
  frames(40);
  // a bell's ring and the Leviathan
  if (G.quest.debugRingAll) G.quest.debugRingAll();
  const ar = G.world.data.arena; if (ar && G.boss) { h.pos.set(ar.x, ar.z + 7, -ar.y); h.prev.copy(h.pos); frames(20); try { if (!G.boss.active && G.boss.wake) G.boss.wake(); } catch (x) { /* its own wall */ } frames(120); for (const k of ['atk', 'wave', 'atk', 'call', 'atk']) { press(k); frames(30); } }
  // a leap and a plunge
  const w = Q.openWater(40, 6); Q.swimAt(w.x, w.y, -3, w.ax * 10, w.ay * 10, 20); frames(30); Q._wish.atk = true; frames(50);
  return { rows, reds, flashes };
};

await section(['E3f', 'E3r', 'E3c'], async () => {
  const { page, close } = await open('?film&fresh&tier=phone', { ctx: { viewport: { width: 390, height: 640 } } });
  const r = await page.evaluate(([src]) => {
    const { rows, reds, flashes } = (new Function('return (' + src + ')()'))(); const N = rows.length, cells = rows[0].length, fps = 60;
    // a flash is the screen changing together: over 4 frames (a 15 Hz ramp at 60 fps), the cells that rise 0.1 or more less the cells that fall, as a share of the screen, the darker side under 0.8.
    // A change of direction with 11% or more of the screen is half a flash; a second holds at most 3 flashes. Things moving across the view rise here and fall there, and cancel: that isn't a flash.
    const K = 4, count = (src) => { const n = src.length, ev = []; let dir = 0; for (let f = K; f < n; f++) { let up = 0, dn = 0; const a = src[f], b = src[f - K]; for (let c = 0; c < cells; c++) { const d = a[c] - b[c]; if (d >= 0.1 && b[c] < 0.8) up++; else if (d <= -0.1 && a[c] < 0.8) dn++; } const net = (up - dn) / cells; if (Math.abs(net) >= 0.11) { const nd = Math.sign(net); if (nd !== dir) { ev.push(f); dir = nd; } } } let worst = 0, at = 0; for (let i = 0; i < ev.length; i++) { let c = 0; for (let j = i; j < ev.length && ev[j] - ev[i] < fps; j++) c++; const fl = Math.floor(c / 2); if (fl > worst) { worst = fl; at = ev[i]; } } return { worst, at, events: ev.length }; };
    const gen = count(rows), redRows = rows.map((L, i) => L.map((v, k) => (reds[i][k] ? v : 0))), red = count(redRows);
    let cw = 0, ct = 0; for (let i = 0; i < flashes.length; i++) { let n = 0; for (let j = i; j < flashes.length && flashes[j] - flashes[i] < 1; j++) n++; if (n > cw) { cw = n; ct = flashes[i]; } }
    // the control, through the same reader: a white 6 Hz flash over the whole screen must read 6 flashes in a second
    const L0 = new Float32Array(cells).fill(0.02), L1 = new Float32Array(cells).fill(0.9), fake = []; for (let f = 0; f < 120; f++) fake.push(f % 10 < 5 ? L1 : L0); const ctl = count(fake).worst;
    return { N, gen, red, cw, ct, total: flashes.length, ctl };
  }, [String(PASS)]);
  line('E3f', r.gen.worst <= 3 && r.ctl >= 5, `${r.N} frames through the blows, powers, a bell, the boss and a plunge: at most ${r.gen.worst} flashes in any 1 s, at frame ${r.gen.at} (≤ 3; ${r.gen.events} changes of direction in all, over 11% of the screen); the control, a white 6 Hz flash, reads ${r.ctl}`);
  line('E3r', r.red.worst <= 3, `saturated red flashes: at most ${r.red.worst} in any 1 s (≤ 3)`);
  line('E3c', r.cw <= 3, `the game's own flashes: at most ${r.cw} started in any 1 s, at ${r.ct.toFixed(1)} s (≤ 3), ${r.total} in the pass`);
  await close();
});

const JITTER = () => { const Q = window.__qa, G = window.__game, h = G.hero; Q.start(); G.bot = null; const w = Q.openWater(30); Q.swimAt(w.x, w.y, w.z); Q.aim(w.ax, w.ay, 0); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 240; i++) G.frame(1 / 60); const seq = []; G.shake(1); for (let i = 0; i < 40; i++) { G.frame(1 / 60); const c = G.camera.position; seq.push([c.x, c.y, c.z]); } let sum = 0; for (let i = 2; i < seq.length; i++) { const a = seq[i], b = seq[i - 1], z = seq[i - 2]; sum += Math.hypot(a[0] - 2 * b[0] + z[0], a[1] - 2 * b[1] + z[1], a[2] - 2 * b[2] + z[2]); } return sum; };
await section(['E3s', 'E3m'], async () => {
  const a = await open('?film&fresh&tier=phone', { ctx: SMALL });
  const on = await a.page.evaluate(`(${JITTER})()`);
  const off = await a.page.evaluate(`(() => { const G = window.__game; const had = !!G.settings; if (had) G.settings.shake = false; return { had, j: (${JITTER})() }; })()`);
  await a.close();
  line('E3s', off.had && off.j < on * 0.02 && on > 0.01, `shake can be turned off: the camera's jolt ${on.toFixed(3)} on, ${off.j.toFixed(3)} with the setting off${off.had ? '' : ' (no G.settings yet)'} (under 2%; on must move: the control)`);
  const b = await open('?film&fresh&tier=phone', { ctx: { ...SMALL, reducedMotion: 'reduce' } });
  const rm = await b.page.evaluate(`(${JITTER})()`); await b.close();
  line('E3m', rm < on * 0.02, `prefers-reduced-motion: the camera's jolt ${rm.toFixed(3)} of ${on.toFixed(3)} (under 2%)`);
});

await section(['E4', 'E4r', 'E4t', 'E4h'], async () => {
  const { page, close } = await open('?fresh&tier=desktop', { ctx: { viewport: { width: 1024, height: 600 } }, init: `window.__vib = 0; navigator.vibrate = () => { window.__vib++; return true; };` });
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }); await page.click('#dive'); await page.waitForTimeout(500);
  const a = await page.evaluate(() => { const Q = window.__qa, G = window.__game, w = Q.openWater(40); Q.swimAt(w.x, w.y, w.z); Q.aim(w.ax, w.ay, 0); const p = G.hero.pos; return [p.x, p.y, p.z]; });
  const f0 = await page.evaluate(() => window.__game.stats.frames);
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'z', bubbles: true })); }); await page.waitForTimeout(1500);
  const b = await page.evaluate(() => { const s = window.__game.hero; window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'z', bubbles: true })); const p = s.pos; return [p.x, p.y, p.z]; }), f1 = await page.evaluate(() => window.__game.stats.frames);
  const m = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  line('E4', m > 1, `keys go by their place, not their letter (AZERTY's Z at W's place): ${m.toFixed(1)} m in 1.5 s, ${f1 - f0} frames`);
  // a key moved, used, and kept across a reload; the boost as a toggle
  const has = await page.evaluate(() => { const G = window.__game; return { keys: !!(G.settings && G.settings.keys), toggle: !!(G.settings && 'toggleBoost' in G.settings), all: G.settings ? Object.keys(G.settings) : [], vib: window.__vib }; });
  if (!has.keys) line('E4r', false, `keys can be remapped and kept (a SHOULD): no key table in the settings: ${JSON.stringify(has.all)}`);
  else {
    await page.evaluate(() => { const Q = window.__qa, G = window.__game; G.settings.keys.atk = 'KeyY'; if (G.quest.save) G.quest.save(); const w = Q.openWater(30); Q.swimAt(w.x, w.y, w.z); }); await page.waitForTimeout(1200);
    await page.keyboard.press('KeyY'); await page.waitForTimeout(140); const st = await page.evaluate(() => window.__game.hero.state);
    await page.evaluate(() => { const G = window.__game; document.dispatchEvent(new Event('visibilitychange')); if (G.quest.save) G.quest.save(); }); await page.waitForTimeout(150);
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 30000 }); await page.waitForTimeout(300);
    const kept = await page.evaluate(() => window.__game.settings.keys.atk);
    line('E4r', st === 'attack' && kept === 'KeyY', `a key remapped, used and kept (a SHOULD): the new key strikes (${st}), after a reload the table says ${kept}`);
  }
  if (!has.toggle) line('E4t', false, `held actions can be toggles (a SHOULD): settings ${JSON.stringify(has.all)}`);
  else {
    const d = await page.evaluate(() => { const d = document.querySelector('#dive'); return !!d && d.style.display !== 'none'; }); if (d) { await page.click('#dive').catch(() => {}); await page.waitForTimeout(400); }
    await page.evaluate(() => { const G = window.__game; G.settings.toggleBoost = true; }); await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(100); const on = await page.evaluate(() => window.__game.ui.sample().boost); await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(100); const off = await page.evaluate(() => window.__game.ui.sample().boost);
    line('E4t', on === true && off === false, `the boost as a toggle (a SHOULD): one press on (${on}), the next off (${off}), nothing held`);
  }
  line('E4h', has.vib === 0 || has.all.some((k) => /haptic|vibr/i.test(k)), `haptics: ${has.vib} vibrations here; a switch only owed if it vibrates`);
  await close();
});
await finish();
