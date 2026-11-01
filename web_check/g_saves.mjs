// G9: every step survives a reload, a returning player resumes where they were, and a page once shown is never reloaded.
//   G9a  a walk through Chapter One by the real objectives, hidden and reloaded mid-chapter: the same mission, objective, text, seat, pearls, tablets, book, fog, settings, best, upgrades
//   G9b  the title says Continue to a returning player, and one tap puts them in control
//   G9c  the record survives JSON, and loadGameState puts it back in a running game
//   G9d  a returning player on another device: the row in the platform's database arrives after the page is shown. It lands with no reload
//   G9h  the host hands the record back through loadGameState: the same
//   G9e  New game starts over in place, no reload, and leaves the settings alone
//   G9f  a broken save reads as a new player
//   node web_check/g_saves.mjs <base> <engine>
import { args, launch, ok, done } from './lib_g.mjs';
const { base, engine } = args();
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: engine === 'chromium', hasTouch: true };
const browser = await launch(engine);
const boot = async (ctx, q = '?tier=phone') => {
  const page = await ctx.newPage(); page.errs = []; page.navs = 0; let first = true;
  page.on('pageerror', (e) => page.errs.push(e.message)); page.on('framenavigated', (f) => { if (f === page.mainFrame()) { if (!first) page.navs++; first = false; } });
  await page.goto(base + q, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.booted && document.querySelector('#dive').style.display !== 'none', null, { timeout: 90000 });
  return page;
};
const dive = async (page) => { await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForFunction(() => window.__game.started, null, { timeout: 5000 }); await page.waitForTimeout(300); };
// the game read back, without the clock
const READ = () => { const G = window.__game, q = G.quest, ms = q.missions, m = ms.tracked, h = G.hero; return { mission: m && m.def.id, i: m && m.i, text: document.getElementById('obj').textContent, p: [h.pos.x, h.pos.y, h.pos.z].map((v) => Math.round(v * 10) / 10), pearls: q.pearlCount(), relics: q.collect.foundCount(), book: q.collect.loggedCount(), fog: Array.from({ length: q.FOG_N }, (_, y) => Array.from({ length: q.FOG_N }, (_2, x) => q.fogAt(x, y)).join('')).join('').replace(/0/g, '').length, music: G.settings.music, shake: G.settings.shake, best: JSON.stringify(q.st.best), levels: JSON.stringify(q.st.levels), powers: Object.keys(h.powers).filter((k) => h.powers[k]).join(), rung: q.rungCount(), seen: q.pois.filter((x) => x.seen).length }; };
// walk the Warden to the mission's own places through the real objectives: the same checks a player's swim trips
const walk = (page, until) => page.evaluate(async (until) => {
  const G = window.__game, q = G.quest, ms = q.missions, h = G.hero; h.inv = 1e6;
  for (let k = 0; k < 900; k++) {
    const m = ms.tracked; if (!m || m.i >= until) break;
    if (q.st.talk) q.talkTap();
    const t = q.target(); if (t && !q.st.talk) { h.pos.copy(t); h.pos.y = Math.max(h.pos.y, G.world.heightAt(t.x, -t.z) + 1.5); h.prev.copy(h.pos); h.vel.set(0, 0, 0); }
    const a = ms.cur(m); if (a.type === 'talk') q.act();
    if (a.type === 'defeat') for (const e of G.enemies.alive()) e.onHit(999, h.pos, 'atk3');
    await new Promise((r) => requestAnimationFrame(r));
  }
  return ms.tracked ? ms.tracked.i : -1;
}, until);
try {
  // ---- G9a, G9b: a returning player
  {
    const ctx = await browser.newContext(PHONE); const page = await boot(ctx); await dive(page);
    const got = await walk(page, 3);
    await page.evaluate(() => { const G = window.__game, q = G.quest; G.settings.music = 0.35; G.settings.shake = false; q.st.best.c_reef = 12.34; q.st.taken += 30; q.upgrade('health'); q.collect.grant(q.collect.relics[0].id); G.quest.collect.log(G.quest.collect.entries[0]); });
    await page.waitForTimeout(200);
    const was = await page.evaluate(READ);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
    await page.waitForTimeout(150);
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__game && window.__game.booted && document.querySelector('#dive').style.display !== 'none', null, { timeout: 90000 });
    const title = await page.evaluate(() => document.getElementById('dive').textContent);
    await dive(page); await page.waitForTimeout(200);
    const back = await page.evaluate(READ);
    // fog only clears: once he's back in the water the cells round him clear again, so it's kept if none were lost
    const same = Object.keys(was).filter((k) => k !== 'p' && (k === 'fog' ? back.fog < was.fog : String(was[k]) !== String(back[k])));
    const far = Math.hypot(was.p[0] - back.p[0], was.p[1] - back.p[1], was.p[2] - back.p[2]);
    ok('G9a', got >= 3 && !same.length && far < 3, `objective ${was.mission}.${was.i} "${was.text}" hidden and reloaded: ${same.length ? 'lost ' + same.map((k) => `${k} ${was[k]} to ${back[k]}`).join(', ') : 'mission, text, pearls, tablets, book, fog, settings, best, upgrades, powers all kept'}, seat within ${far.toFixed(1)} m (at most 3)`);
    ok('G9b', title === 'Continue', `the title's button for a returning player reads "${title}"`);
    // ---- G9c
    const c = await page.evaluate(() => { const before = JSON.stringify(window.getGameState()), s = JSON.parse(before), G = window.__game; G.quest.st.taken += 500; const r = window.loadGameState(s); return { r, pearls: G.quest.st.taken, was: s.taken, bytes: before.length }; });
    ok('G9c', c.r === true && c.pearls === c.was, `getGameState is plain JSON (${c.bytes} bytes), loadGameState put back ${c.was} pearls in a running game`);
    await ctx.close();
  }
  // ---- G9d: the player's row arrives after the page is shown (the port kit); G9h: the host hands the record back (BACKEND.md §6r). Neither reloads
  {
    const ctx = await browser.newContext(PHONE);
    const first = await boot(ctx, '?tier=phone'); await dive(first); await walk(first, 2);
    const rec = await first.evaluate(() => { const s = window.getGameState(); s.play = 900; s.taken = 77; return JSON.stringify(s); }); await first.close(); await ctx.close();
    const row = JSON.stringify({ 'thalor.save.v2': rec });
    const c2 = await browser.newContext(PHONE);
    await c2.addInitScript((row) => {
      window.__sets = 0;
      window.MosaicBridge = { db: { get: async () => new Promise((r) => setTimeout(() => r({ v: 1, best: 0, saves: row }), 900)), set: async () => { window.__sets++; return true; } } };
      window.MosaAppBridge = { createAppBridge: () => ({ mp: { mpRoom: () => ({ enabled: false, players: [], me: { userId: 'u1', displayName: 'A' } }), mpDrain: () => [], mpSync() {}, mpSend() { return { ok: true }; }, mpBudget: () => ({}) } }) };
    }, row);
    const page = await boot(c2, '?tier=phone');
    await page.waitForFunction(() => window.__game.quest.st.taken === 77, null, { timeout: 12000 }).catch(() => {});
    const r = await page.evaluate(() => ({ taken: window.__game.quest.st.taken, t: document.getElementById('dive').textContent })).catch(() => ({ taken: -1, t: '' }));      // a reload tears this very read down
    ok('G9d', r.taken === 77 && page.navs === 0 && r.t === 'Continue', `the player's row, arriving late, lands ${r.taken === 77 ? 'with the page still up' : 'NOT AT ALL'}: ${page.navs} reloads (must be 0), pearls ${r.taken}, button "${r.t}"`);
    await c2.close();
    const c3 = await browser.newContext(PHONE); const p3 = await boot(c3, '?tier=phone'); await p3.waitForTimeout(400);
    const h = await p3.evaluate((rec) => { const ok = window.loadGameState(JSON.parse(rec)); return { ok, taken: window.__game.quest.st.taken, t: document.getElementById('dive').textContent }; }, rec);
    ok('G9h', h.ok && h.taken === 77 && p3.navs === 0 && h.t === 'Continue', `a record the host hands back lands too: ${p3.navs} reloads, pearls ${h.taken}, button "${h.t}"`);
    await c3.close();
  }
  // ---- G9e, G9f
  {
    const ctx = await browser.newContext(PHONE); const page = await boot(ctx); await dive(page); await walk(page, 2); await page.waitForTimeout(1500);
    await page.evaluate(() => { const G = window.__game; G.settings.music = 0.2; G.quest.save(); }); await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.booted && document.querySelector('#dive').style.display !== 'none', null, { timeout: 90000 });
    const navs0 = page.navs;
    await page.tap('#newGame').catch(() => page.click('#newGame')); await page.waitForTimeout(120); await page.tap('#newGame').catch(() => page.click('#newGame')); await page.waitForTimeout(500);
    const n = await page.evaluate(() => { const G = window.__game, ms = G.quest.missions; return { i: ms.tracked && ms.tracked.i, id: ms.tracked && ms.tracked.def.id, pearls: G.quest.pearlCount(), started: G.started, music: G.settings.music }; });
    ok('G9e', n.id === 'ch1' && n.i === 0 && n.pearls === 0 && n.started && page.navs === navs0 && n.music === 0.2, `New game: ${n.id} objective ${n.i}, ${n.pearls} pearls, playing ${n.started}, no reload, music setting kept at ${n.music}`);
    await ctx.close();
    const c3 = await browser.newContext(PHONE); await c3.addInitScript(() => { try { localStorage.setItem('thalor.save.v2', '{not json'); } catch (_) {} });
    const p3 = await boot(c3); const t = await p3.evaluate(() => document.getElementById('dive').textContent); await dive(p3); const e = await p3.evaluate(() => window.__game.quest.missions.tracked.def.id);
    ok('G9f', t === 'Dive' && e === 'ch1' && p3.errs.length === 0, `a broken save reads as a new player: button "${t}", ${e}, ${p3.errs.length} errors`);
    await c3.close();
  }
} catch (e) { ok('G9', false, 'the run did not finish: ' + e.message); }
await browser.close(); done();
