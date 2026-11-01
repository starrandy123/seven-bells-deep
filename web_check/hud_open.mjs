// H: a returning player can see what a build brought, and leaving makes no error. Randy, 1 Nov: "I don't see the tornado and hud shit" · "It hit an error every time I leave" · "Did you push the new update?"
//   node hud_open.mjs <base> <chromium|webkit>
import { gate, PHONE } from './lib/h.mjs';
const W = await gate('hud_open', { budget: 120 });
const { line, open, section, finish } = W;
const LAND = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: PHONE.isMobile, hasTouch: true };
const SLOTS = ['bStance', 'bDash', 'bSpin', 'bWave', 'bP4', 'bCast', 'bCall'];
await section(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9'], async () => {
  const seed = `window.addEventListener('unhandledrejection', (e) => { (window.__rej = window.__rej || []).push(String(e.reason && e.reason.message || e.reason)); });`;
  const { page, errors, close } = await open('?fresh&tier=phone', { ctx: LAND, init: [seed] });
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 60000 });
  const stamp = await page.evaluate(() => document.querySelector('#title .build').textContent);
  line('H6', /^Build [1-9]\d*$/.test(stamp), `the title says which build this is: "${stamp}"`);
  await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(900);
  const firstTime = await page.evaluate(() => document.querySelector('#toast').classList.contains('on'));
  line('H9', !firstTime, `a first-time player isn't told what's new: toast ${firstTime}`);
  await page.evaluate(() => { const G = window.__game, Q = window.__qa; if (G.cine && G.cine.active) G.cine.stop(true); Q.calm(); }); await page.waitForTimeout(400);
  const hud = await page.evaluate((ids) => ids.map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(), s = getComputedStyle(e); return { id, on: s.display !== 'none' && r.width > 0, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, locked: e.classList.contains('locked'), o: +s.opacity }; }), SLOTS);
  line('H1', hud.every((b) => b.on && b.inside), `every hotbar slot is on a turned phone's screen on a new game: ${hud.filter((b) => b.on && b.inside).length} of ${SLOTS.length}`);
  line('H2', hud.every((b) => b.locked && b.o < 1), `a slot not learned stands dimmed: ${hud.filter((b) => b.locked).length} of ${SLOTS.length}`);
  await page.waitForTimeout(5000);      // the feed says one thing at a time: a new game's first lines go first, and a tip waits 4 s at most for its turn (ui.js, LAPSE)
  await page.tap('#bDash').catch(() => page.click('#bDash'));
  await page.waitForFunction(() => /Bell/.test(document.querySelector('#tip').textContent), null, { timeout: 5000 }).catch(() => {});
  const said = await page.evaluate(() => document.querySelector('#tip').textContent);
  line('H3', /Reef Bell/.test(said), `a tap on a locked slot says which bell teaches it: "${said}"`);
  await page.waitForTimeout(100);
  const stance0 = await page.evaluate(() => window.__game.combat.stance); await page.tap('#bStance').catch(() => page.click('#bStance')); await page.waitForTimeout(300);
  const stance1 = await page.evaluate(() => window.__game.combat.stance);
  line('H4', stance0 === stance1, `a locked Stance slot changes nothing: ${stance0} > ${stance1}`);
  const told = await page.evaluate(async () => { const G = window.__game, A = window.AudioContext || window.webkitAudioContext, r = A.prototype.resume, S = A.prototype.suspend; G.audio.start(); await new Promise((d) => setTimeout(d, 100)); A.prototype.resume = function () { return Promise.reject(new DOMException('AudioDestinationNode is not initialized', 'InvalidStateError')); }; A.prototype.suspend = S; const c = G.audio; c.suspend(true); await new Promise((d) => setTimeout(d, 80)); c.start(); await new Promise((d) => setTimeout(d, 200)); A.prototype.resume = r; c.suspend(false); return window.__rej || []; });
  line('H5', told.length === 0, `a resume refused on a closing page is no error: ${told.length} unhandled ${told[0] || ''}`);
  const tip = await page.evaluate(async () => { const G = window.__game, Q = window.__qa, w = Q.openWater(120), h = G.hero; Q.swimAt(w.x, w.y, w.z); h.place(); h.inv = 1e6; for (let i = 0; i < 60 * 13; i++) { Q.drive({ my: 0, mx: 0, ud: 0 }); G.frame(1 / 60); } return !!(G.settings.taught && G.settings.taught.spout_open); });
  line('H7', tip, `the tornado is told once he's been twelve seconds in the water: ${tip}`);
  const news = await page.evaluate(() => { const G = window.__game; return { seen: (() => { try { return localStorage.getItem('thalor.build'); } catch (_) { return null; } })() }; });
  line('H8', stamp === 'Build ' + news.seen, `the build he's been told of is remembered, so it's said once: ${news.seen}; ${errors.length} errors`);
  await close();
});
await section(['H10'], async () => {
  const seed = `try { localStorage.setItem('thalor.build', '1'); } catch (_) {}`;
  const { page, close } = await open('?fresh&tier=phone', { ctx: LAND, init: [seed] });
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 60000 });
  await page.tap('#dive').catch(() => page.click('#dive'));
  await page.waitForFunction(() => /is in$/.test(document.querySelector('#toast b').textContent), null, { timeout: 6000 }).catch(() => {});
  const b = await page.evaluate(() => document.querySelector('#toast b').textContent);
  line('H10', /^Build \d+ is in$/.test(b), `someone back from an older build is told: "${b}"`);
  await close();
});
await finish();
