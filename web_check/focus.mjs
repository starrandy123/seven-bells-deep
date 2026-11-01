// D1, D2, D3: leaving and coming back, and the sound.
//   D1  hidden: the clock stops within a frame, nothing moves, the sound stops; on return no jump, the pause card up, and it runs again. Also through pagehide and the game's own pause. The frames are held while hidden, as a real hidden tab holds them.
//   D2  sound starts only from a press, and comes back after an interruption, on a press the browser counts as a gesture (touchend, click or pointerup: never pointerdown or a timer: iOS refuses those). iOS's own 'interrupted' state is put on the context by hand: a real iPhone is owed.
//   D3  (a SHOULD) separate music and effects volumes, kept across a reload; even levels.
//   node focus.mjs <base> <chromium|webkit> [--only=D1,D1r,D1p,D1o,D2,D2i,D2g,D3,D3l]
import { gate, PHONE, SMALL } from './lib/h.mjs';
const W = await gate('focus', { budget: 150 });
const { line, note, open, section, finish, engine } = W;
const dive = async (page) => { await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 30000 }); await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(600); };
const AUD = () => { const r = window.__qa.audio; return r && r[0] ? r[0].ctx.state : 'none'; };

await section(['D1', 'D1r', 'D1p', 'D1o'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone', { ctx: PHONE });
  await dive(page);
  const setup = () => page.evaluate(() => { const Q = window.__qa, G = window.__game, e = G.enemies.encounters[0]; if (e) { G.hero.inv = 1e6; G.hero.pos.copy(e.c).add({ x: 0, y: 2, z: 6 }); G.hero.prev.copy(G.hero.pos); } });
  await setup(); await page.waitForTimeout(1500);
  const hide = (on) => page.evaluate((on) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => on }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (on ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); }, on);
  const snap = () => page.evaluate(() => { const G = window.__game, h = G.hero, r = window.__qa.audio; return { t: G.time, p: [h.pos.x, h.pos.y, h.pos.z], foes: G.enemies.alive().map((e) => [e.pos.x, e.pos.y, e.pos.z]), paused: G.paused, audio: r && r[0] ? r[0].ctx.state : 'none', frames: G.stats.frames, pauseCard: !!document.querySelector('.screen.on') }; });
  const a = await snap(); await hide(true); const a1 = await snap(); await page.waitForTimeout(4000); const b = await snap(); const dT = b.t - a1.t, oneFrame = a1.t - a.t, mv = Math.hypot(b.p[0] - a1.p[0], b.p[1] - a1.p[1], b.p[2] - a1.p[2]); let fm = 0; b.foes.forEach((f, i) => { const g = a1.foes[i]; if (g) fm = Math.max(fm, Math.hypot(f[0] - g[0], f[1] - g[1], f[2] - g[2])); });
  line('D1', dT === 0 && mv === 0 && fm === 0 && b.paused && b.audio !== 'running', `hidden 4 s: the clock moved ${dT.toFixed(3)} s, he moved ${mv.toFixed(3)} m, ${b.foes.length} foes moved ${fm.toFixed(3)} m (all 0), paused ${b.paused}, sound ${b.audio} (not running)`);
  // back, after the frames were held as a hidden tab holds them
  await page.evaluate(() => window.__qa.holdFrames()); await page.waitForTimeout(3000); await hide(false); await page.evaluate(() => window.__qa.freeFrames()); await page.waitForTimeout(400); const c = await snap();
  const c1 = await page.evaluate(() => { const r = document.getElementById('resume'); r.click(); return true; }); const t0 = await snap(); await page.waitForTimeout(500); const d = await snap(); const ran = d.t - t0.t, jump = Math.hypot(d.p[0] - t0.p[0], d.p[1] - t0.p[1], d.p[2] - t0.p[2]);
  line('D1r', c.pauseCard && c.t - b.t === 0 && ran > 0.2 && ran < 0.9 && jump < 8, `shown again: the pause card up (${c.pauseCard}), no catch-up while it's up (${(c.t - b.t).toFixed(3)} s); Resume runs ${ran.toFixed(2)} s in 0.5 s, he moved ${jump.toFixed(2)} m, the sound ${d.audio}`);
  // pagehide (an app switch on a phone) does the same
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await page.waitForTimeout(150); const e = await snap(); await page.waitForTimeout(600); const f = await snap();
  line('D1p', e.paused && f.t - e.t === 0, `pagehide pauses too: paused ${e.paused}, the clock moved ${(f.t - e.t).toFixed(3)} s`);
  await page.evaluate(() => window.__game.ui.setPause(false)); await page.waitForTimeout(150);
  await page.evaluate(() => window.__game.ui.setPause(true)); const g = await snap(); await page.waitForTimeout(700); const g2 = await snap();
  line('D1o', g2.t - g.t === 0 && g2.audio !== 'running', `the game's own pause stops the same way: the clock ${(g2.t - g.t).toFixed(3)} s, the sound ${g2.audio}; ${errors.length} errors${errors[0] ? ': ' + errors[0] : ''}`);
  await close();
});

await section(['D2', 'D2i', 'D2g'], async () => {
  const msgs = [];
  const { page, errors, close } = await open('?fresh&tier=phone', { ctx: PHONE });
  page.on('console', (m) => { if (/autoplay|NotAllowed|audio/i.test(m.text())) msgs.push(m.text().slice(0, 120)); });
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => ({ made: window.__qa.audio ? window.__qa.audio.length : 0, on: window.__game.audio.on }));
  await dive(page); await page.waitForTimeout(300);
  const after = await page.evaluate(AUD);
  line('D2', before.made === 0 && !before.on && after === 'running' && msgs.length === 0, `sound starts from a press: ${before.made} contexts before any input, ${after} after the tap on Dive (running); ${msgs.length} autoplay complaints`);
  // an interruption: the context stops under the game, and the next press has to bring it back, inside a gesture the browser will honour
  const press = () => page.evaluate(() => { const b = document.querySelector('#bAtk'), r = b.getBoundingClientRect(), o = { pointerId: 51, pointerType: 'touch', clientX: r.left + 5, clientY: r.top + 5, bubbles: true, cancelable: true }; b.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1 })); b.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 })); const t = document.createEvent('Event'); t.initEvent('touchend', true, true); b.dispatchEvent(t); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.evaluate(() => window.__qa.audio[0].ctx.suspend()); await page.waitForTimeout(200); const s0 = await page.evaluate(AUD);
  await page.evaluate(() => { window.__qa.audio[0].resumes.length = 0; }); await press(); await page.waitForTimeout(300); const s1 = await page.evaluate(AUD), via = await page.evaluate(() => window.__qa.audio[0].resumes.slice());
  line('D2i', s0 !== 'running' && s1 === 'running', `after an interruption (suspended: ${s0}) the next press brings it back: ${s1}`);
  // iOS: the state reads 'interrupted', and only touchend or click may resume it
  const r = await page.evaluate(async () => { const rec = window.__qa.audio[0], c = rec.ctx; await c.suspend(); Object.defineProperty(c, 'state', { configurable: true, get: () => 'interrupted' }); rec.resumes.length = 0; return true; }); void r;
  await press(); await page.waitForTimeout(250);
  const v2 = await page.evaluate(() => window.__qa.audio[0].resumes.slice()); const good = v2.filter((t) => t === 'touchend' || t === 'click' || t === 'pointerup');
  line('D2g', good.length > 0, `iOS's 'interrupted' state: a press calls resume inside a gesture iOS honours (touchend, click, pointerup): calls ${JSON.stringify(v2)}`);
  await close();
});

await section(['D3', 'D3l'], async () => {
  const init = `(() => { const c0 = AudioNode.prototype.connect; AudioNode.prototype.connect = function (d, ...a) { if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode && !window.__tap) { const an = d.context.createAnalyser(); an.fftSize = 2048; c0.call(this, an); window.__tap = an; } return c0.call(this, d, ...a); }; })();`;
  const { page, close } = await open('?tier=phone', { ctx: PHONE, init });
  await dive(page);
  const has = await page.evaluate(() => { const G = window.__game; return { settings: !!G.settings, keys: G.settings ? Object.keys(G.settings) : [], setV: !!G.audio.setVolumes, apply: !!(G.ui && G.ui.applySettings) }; });
  if (!has.settings || !has.apply) line('D3', false, `no settings yet: G.settings ${has.settings}, ui.applySettings ${has.apply} (G7 owes music, sound, shake, camera speed, look, reduced flashing)`);
  else {
    const set = await page.evaluate(() => { const G = window.__game, k = Object.keys(G.settings), m = k.find((x) => /music/i.test(x)), s = k.find((x) => /sfx|sound|fx/i.test(x)); G.ui.applySettings({ ...G.settings, [m]: 0, [s]: 0.5 }); G.quest.save && G.quest.save(); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); return { m, s, now: G.settings }; });
    await page.waitForTimeout(250); await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__game.booted); await page.waitForTimeout(500);
    const kept = await page.evaluate((k) => { const G = window.__game; return { m: G.settings[k.m], s: G.settings[k.s] }; }, set);
    line('D3', kept.m === 0 && kept.s === 0.5, `music and effects are separate and kept across a reload: set 0 and 0.5, read ${kept.m} and ${kept.s}`);
  }
  await close();
  // levels: every effect, alone, through the master, in dB against the middle one
  const L = await open('?fresh&tier=phone', { ctx: PHONE, init });
  await dive(L.page); await L.page.waitForTimeout(500);
  const r = await L.page.evaluate(async () => { const G = window.__game, A = G.audio, an = window.__tap; if (!an) return null; if (A.setVolumes) A.setVolumes(0, 1); const buf = new Float32Array(an.fftSize), rms = async (ms) => { let peak = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; peak = Math.max(peak, Math.sqrt(s / buf.length)); await new Promise((d) => setTimeout(d, 30)); } return peak; }; const out = {}; await new Promise((d) => setTimeout(d, 2500)); const quiet = await rms(300); for (const [n, f] of [['hit', () => A.hit(false)], ['heavy hit', () => A.hit(true)], ['swing', () => A.swing()], ['pearl', () => A.pearl()], ['splash', () => A.splash()], ['boom', () => A.boom()], ['bell', () => A.bell()]]) { f(); out[n] = await rms(620); await new Promise((d) => setTimeout(d, 400)); } return { out, quiet }; });
  if (!r) line('D3l', false, 'no tap on the master bus: the sound never reached the speakers in this engine');
  else { const db = Object.entries(r.out).map(([k, v]) => [k, 20 * Math.log10(Math.max(v, 1e-5))]), s = db.map((x) => x[1]).sort((a, b) => a - b), mid = s[s.length >> 1], off = db.filter((x) => Math.abs(x[1] - mid) > 6); line('D3l', off.length === 0, `every effect within 6 dB of the middle one (${mid.toFixed(1)} dB): ${db.map((x) => `${x[0]} ${x[1].toFixed(1)}`).join(', ')}${off.length ? '; off: ' + off.map((x) => x[0]).join(', ') : ''}`); }
  await L.close();
});
await finish();
