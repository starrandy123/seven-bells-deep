// G1-G4: a new player's first minutes.
//   G1  in control within one tap, in a fresh browser: the taps from the first painted frame to the stick moving him. Also the time.
//   G2  teaches through play, right controls for the device: touch shows no key names, a computer shows keys, a tablet gets the phone's controls; every step 12 words or fewer; a skip that ends them; nothing blocks play.
//   G3  (a SHOULD) a safe start: the first fight can't be lost; the first reward within 60 s and the first upgrade within 3 min (ours), by the game's own bot.
//   G4  (a SHOULD) a goal on screen in every state; every milestone has its celebration.
//   node first.mjs <base> <chromium|webkit> [--only=G1,G2t,G2k,G2i,G2w,G2s,G3,G3t,G4,G4m]
import { gate, PHONE, DESK, SMALL } from './lib/h.mjs';
import fs from 'fs'; import path from 'path';
const W = await gate('first', { budget: 170 });
const { line, note, open, section, finish, engine, base } = W;
const CATCH = `window.__said = []; (function wait() { const t = setInterval(() => { const G = window.__game; if (!G || !G.ui || G.ui.__c) return; G.ui.__c = true; for (const k of ['tip', 'toast', 'hint', 'objective']) { const f = G.ui[k]; if (!f) continue; G.ui[k] = (...a) => { const v = a[0]; window.__said.push([k, typeof v === 'string' ? v : v && v.text ? v.text : '', typeof a[1] === 'string' ? a[1] : '', v && v.caps ? [].concat(v.caps).join(' ') : '']); return f.apply(G.ui, a); }; } clearInterval(t); }, 5); })();`;
const KEYNAME = /\b(WASD|Shift|Space|Ctrl|Esc|click|right click|mouse|[A-Z] (or|to)\b|key\b|keys\b)/;
const stickMoves = (page) => page.evaluate(() => new Promise((done) => { const G = window.__game, h = G.hero, p0 = h.pos.clone(), s = document.querySelector('#stick'), b = s.getBoundingClientRect(), ev = (type, x, y) => s.dispatchEvent(new PointerEvent(type, { pointerId: 61, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1 })), cx = b.left + b.width / 2, cy = b.top + b.height / 2, t0 = performance.now(); ev('pointerdown', cx, cy); ev('pointermove', cx, cy - 46); const look = () => { const m = h.pos.distanceTo(p0); if (m > 0.5) { ev('pointerup', cx, cy); done({ moved: m, ms: performance.now() - t0 }); } else if (performance.now() - t0 > 5000) done({ moved: m, ms: -1 }); else requestAnimationFrame(look); }; look(); }));

await section(['G1', 'G2t', 'G2w', 'G2n'], async () => {
  const { page, errors, close } = await open('?tier=phone', { ctx: PHONE, init: CATCH, wait: false });
  const t0 = Date.now(); await page.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 30000 });
  const tBoot = Date.now() - t0; await page.waitForTimeout(150); let taps = 0;
  const st = await page.evaluate(() => { const d = document.querySelector('#dive'); return { started: window.__game.started, dive: !!d && d.style.display !== 'none' }; });
  if (!st.started) { taps++; await page.tap('#dive'); await page.waitForTimeout(400); }
  const m = await stickMoves(page); const tot = Date.now() - t0;
  line('G1', taps <= 1 && m.ms >= 0, `in control within one tap: ${taps} tap, then the stick moved him ${m.moved.toFixed(1)} m; ${tot} ms from opening the page (here), ${tBoot} ms to the title`);
  // the first minute, doing what the hints say, then what a touch player has been told
  await page.evaluate(async () => { const Q = window.__qa, G = window.__game, h = G.hero; G.hero.inv = 1e6; Q.drive({ my: 1, mx: 0, ud: 0, boost: true }); await new Promise((d) => setTimeout(d, 2600)); Q.drive({ my: 1, mx: 0.3, ud: 0, boost: false }); });
  await page.waitForTimeout(600);
  // the words only some moments say: a bell, leaving the water, the land
  await page.evaluate(() => { const Q = window.__qa, G = window.__game, q = G.quest; try { for (const k of ['leap', 'super', 'land', 'dive']) q.note && q.note(k); } catch (e) {} });
  const said = await page.evaluate(() => window.__said.slice());
  const src = await page.evaluate(async () => { const out = []; try { const m = await (await fetch('data/missions.json')).json(); for (const s of m.onboard || []) out.push(['onboard', s.touch || s.text || '']); } catch (e) {} return out; });
  const lines = said.concat(src).map((s) => [s[0], [s[1], s[2]].filter(Boolean).join(' ')]).filter((s) => s[1]);
  const bad = [...new Set(lines.filter((s) => KEYNAME.test(s[1])).map((s) => s[1]))];
  line('G2t', lines.length >= 2 && bad.length === 0, `a phone shows touch words, no key names: ${lines.length} lines said in the first minute; ${bad.length} with a key's name${bad[0] ? ': ' + bad.slice(0, 5).map((b) => `"${b}"`).join(' · ') : ''}`);
  const teach = lines.filter((s) => s[0] === 'tip' || s[0] === 'hint' || s[0] === 'onboard'), long = [...new Set(teach.filter((s) => s[1].split(/\s+/).length > 12).map((s) => s[1]))];
  line('G2w', teach.length >= 1 && long.length === 0, `each teaching step is 12 words or fewer: ${teach.length} steps, ${long.length} over${long[0] ? ': ' + long.slice(0, 4).map((b) => `"${b}" (${b.split(/\s+/).length})`).join(' · ') : ''}`);
  line('G2n', errors.length === 0, `no errors in the first minute: ${errors.length}${errors[0] ? ': ' + errors[0] : ''}`);
  await close();
});

await section(['G2k', 'G2i', 'G2s'], async () => {
  const d = await open('?tier=desktop', { ctx: DESK, init: CATCH });
  await d.page.waitForFunction(() => { const x = document.querySelector('#dive'); return x && x.style.display !== 'none'; }); await d.page.click('#dive'); await d.page.waitForTimeout(3200);
  const sd = await d.page.evaluate(() => ({ said: window.__said.map((s) => [s[1], s[3]].filter(Boolean).join(' ')).filter(Boolean), keys: (document.getElementById('keys') || {}).innerHTML || '', touch: document.body.classList.contains('touch'), stick: getComputedStyle(document.getElementById('stick')).display }));
  const keyWords = /WASD|\bW\b|Shift|Space|mouse|click/;
  line('G2k', !sd.touch && sd.stick === 'none' && (keyWords.test(sd.said.join(' ')) || keyWords.test(sd.keys)), `a computer shows keys: touch UI ${sd.touch}, stick ${sd.stick}; said ${JSON.stringify(sd.said.slice(0, 3))}; the keys panel ${keyWords.test(sd.keys)}`);
  await d.close();
  const t = await open('?', { ctx: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } });
  await t.page.waitForTimeout(400);
  const st = await t.page.evaluate(() => ({ touch: document.body.classList.contains('touch'), stick: getComputedStyle(document.getElementById('stick')).display, tier: window.__game.tier }));
  line('G2i', st.touch && st.stick !== 'none' && st.tier === 'phone', `a tablet gets the phone's controls: touch UI ${st.touch}, stick ${st.stick}, tier ${st.tier}`);
  await t.close();
  const s = await open('?tier=phone', { ctx: PHONE, init: CATCH });
  await s.page.waitForFunction(() => { const x = document.querySelector('#dive'); return x && x.style.display !== 'none'; }); await s.page.tap('#dive'); await s.page.waitForTimeout(2600);
  const sk = await s.page.evaluate(() => { const G = window.__game, q = G.quest, skip = document.getElementById('skip') || document.querySelector('[data-skip],.skip,#hintSkip'); const hasApi = !!(q.onboard && q.onboard.skip) || !!G.onboard; return { dom: !!skip && window.__qa.vis(skip), id: skip ? skip.id : null, hasApi }; });
  const mv = await stickMoves(s.page);
  line('G2s', mv.ms >= 0 && (sk.dom || sk.hasApi), `the hints never block play (the stick moved him with them up: ${mv.moved.toFixed(1)} m); a skip: on screen ${sk.dom}${sk.id ? ' #' + sk.id : ''}, in the code ${sk.hasApi}`);
  await s.close();
});

await section(['G3', 'G3t'], async () => {
  const { page, close } = await open('?demo&film&fresh&tier=phone', { ctx: SMALL });
  const r = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero; G.look.render = () => {}; let first = -1, up = -1; const t0 = G.time, m0 = h.maxHp; let n = 0; const pearls = () => G.quest.pearlCount();
    for (; n < 60 * 240; n++) { G.frame(1 / 60); if (first < 0 && (pearls() > 0 || G.quest.rungCount() > 0)) first = G.time - t0; if (up < 0 && (G.quest.rungCount() > 0 || h.maxHp > m0)) up = G.time - t0; if (first >= 0 && up >= 0) break; }
    return { first, up, n };
  });
  line('G3t', r.first >= 0 && r.first <= 60 && r.up >= 0 && r.up <= 180, `the first reward at ${r.first.toFixed(0)} s (≤ 60), the first upgrade at ${r.up.toFixed(0)} s (≤ 180), by the game's own bot`);
  await close();
  const f = await open('?film&fresh&tier=phone', { ctx: SMALL });
  const s = await f.page.evaluate(() => { const Q = window.__qa, G = window.__game, h = G.hero; Q.start(); G.bot = null; const e = G.enemies.encounters.find((x) => !x.tied_to) || G.enemies.encounters[0]; h.pos.copy(e.c).add({ x: 2, y: 1, z: 2 }); h.prev.copy(h.pos); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 300; i++) G.frame(1 / 60); const r = []; h.inv = 0; for (let k = 0; k < 8; k++) { h.inv = 0; h.hp = 1; const res = h.damage(30, null); r.push(res); if (res === 'dead') break; h.inv = 0; for (let i = 0; i < 6; i++) G.frame(1 / 60); } return { r, dead: h.dead, hp: h.hp }; });
  line('G3', !s.dead && s.r.includes('spared'), `the first fight can't be lost: blows at 1 health read ${JSON.stringify(s.r.slice(0, 5))}, dead ${s.dead}, health ${Math.round(s.hp)}`);
  await f.close();
});

await section(['G4', 'G4m'], async () => {
  const { page, close } = await open('?film&fresh&tier=phone', { ctx: SMALL, init: CATCH });
  const r = await page.evaluate(async () => {
    const Q = window.__qa, G = window.__game, h = G.hero; Q.start(); G.bot = null; await new Promise((d) => setTimeout(d, 40)); const seen = [], goal = () => { const o = document.getElementById('obj'); return o && Q.vis(o) && o.textContent.trim(); }, run = (n) => { for (let i = 0; i < n; i++) G.frame(1 / 60); };
    run(30); if (G.cine && G.cine.active) { G.cine.stop(true); run(10); } seen.push(['the start', goal()]);
    const a = G.world.data.arena; if (G.quest.debugRingAll) G.quest.debugRingAll(); run(10); if (G.cine && G.cine.active) { G.cine.stop(true); run(10); } seen.push(['every bell rung', goal()]);
    const sounds = { pearl: 0, bell: 0 }; for (const k of Object.keys(sounds)) { const f = G.audio[k]; G.audio[k] = (...x) => { sounds[k]++; return f(...x); }; } let flashes = 0; const fl = G.look.flash; G.look.flash = (...x) => { flashes++; return fl.apply(G.look, x); };
    const said0 = window.__said.length; h.pos.set(a.x, a.z + 7, -a.y); h.prev.copy(h.pos); h.inv = 1e6; run(90); if (G.cine && G.cine.active) { G.cine.stop(true); run(10); } seen.push(['the arena', goal()]);   // a cinematic hides the HUD on purpose: the goal is read after it
    const p = G.world.data.pearls.slice(0, 8), n0 = G.quest.pearlCount(); for (const q of p) { Q.place(q[0], q[1], q[2]); run(4); } const got = G.quest.pearlCount() - n0;
    return { seen, sounds, got, said: window.__said.slice(said0).map((s) => s[0] + ':' + s[1]).slice(0, 5) };
  });
  const none = r.seen.filter((s) => !s[1]);
  line('G4', none.length === 0, `a goal is on the screen in every state: ${r.seen.map((s) => `${s[0]}: "${s[1] || 'none'}"`).join(' · ')}`);
  line('G4m', r.got > 0 && r.sounds.pearl >= r.got, `every milestone has its celebration: ${r.got} pearls, ${r.sounds.pearl} chimes`);
  await close();
});
await finish();
