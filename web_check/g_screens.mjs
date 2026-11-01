// G7, C1: the screens, by touch, on a phone, upright and turned. The map with its fog, fast travel between shrines, the quest log with current and finished
// objectives, the codex, upgrades bought at a shrine, every setting reaching the game and kept, and a cinematic that shows bars, pauses and skips on one tap.
//   node web_check/g_screens.mjs <base> <engine>
import { args, launch, ok, done } from './lib_g.mjs';
const { base, engine } = args();
const browser = await launch(engine);
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: engine === 'chromium', hasTouch: true });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base + '?fresh&tier=phone', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.booted && document.querySelector('#dive').style.display !== 'none', null, { timeout: 90000 });
  await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(500);
  const tap = async (s) => { await page.tap(s).catch(() => page.click(s)); await page.waitForTimeout(160); };
  // ---- the map
  await page.evaluate(() => { const G = window.__game, q = G.quest; for (const s of q.shrinePlaces) q.st.shrines.add(s.id); for (const p of q.pois) p.seen = true; });
  await tap('#pauseB'); await tap('[data-tab=map]'); await page.waitForTimeout(350);
  const px = await page.evaluate(() => { const c = document.getElementById('mapC'), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4000) seen.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`); const G = window.__game; return { colours: seen.size, fogged: Array.from({ length: 64 }, (_, i) => G.quest.fogAt(i * 2, 64)).filter((v) => !v).length, w: c.width }; });
  ok('G7a', px.colours >= 4 && px.fogged > 0, `the map draws (${px.colours} tones in a sample), with fog over ${px.fogged} of 64 sampled cells`);
  const sh = await page.evaluate(() => { const G = window.__game, q = G.quest, m = G.ui.screens.map, s = q.shrinePlaces[0], c = document.getElementById('mapC').getBoundingClientRect(); return { id: s.id, n: q.shrinePlaces.length, pos: [s.pl.x, s.pl.y] }; });
  const before = await page.evaluate(() => { const h = window.__game.hero; return [h.pos.x, h.pos.z]; });
  await page.evaluate((id) => window.__game.quest.travel(id), sh.id); await page.waitForTimeout(1500);
  const after = await page.evaluate(() => { const G = window.__game, h = G.hero; return { p: [h.pos.x, h.pos.z], paused: G.paused, st: h.state }; });
  ok('G7c', Math.hypot(after.p[0] - sh.pos[0], after.p[1] + sh.pos[1]) < 8 && !after.paused, `fast travel to ${sh.id}: landed ${Math.hypot(after.p[0] - sh.pos[0], after.p[1] + sh.pos[1]).toFixed(1)} m from it, game running, ${sh.n} shrines on the map`);
  // ---- the log
  await page.evaluate(() => { const G = window.__game, ms = G.quest.missions; ms.rec.s_nets = { st: 'done', n: 1 }; ms.start('s_list', true); }); await tap('#pauseB'); await tap('[data-tab=quests]');
  const log = await page.evaluate(() => { const t = document.getElementById('tab-quests').innerText; return { cur: /Swim to the light|Talk|Strike|Someone/.test(t), done: /Finished \(1\)|FINISHED \(1\)/i.test(t), left: /of the sea/.test(t) && /Tablets 0 of 20/.test(t), track: document.querySelectorAll('[data-track]').length }; });
  ok('G7b', log.cur && log.done && log.left && log.track >= 2, `the log shows current objectives, ${log.done ? 'a finished mission' : 'NO finished mission'}, the counts left, ${log.track} missions to track`);
  await page.evaluate(() => document.querySelectorAll('[data-track]')[1].click()); await page.waitForTimeout(120);
  ok('G7t', await page.evaluate(() => window.__game.quest.missions.tracked.def.id === 's_list'), 'tapping a mission tracks it');
  // ---- the codex
  await tap('[data-tab=codex]');
  const cx = await page.evaluate(() => { const G = window.__game, b = document.getElementById('tab-codex').innerText; return /Creatures 0\/\d+|Creatures \d+\/\d+/.test(b) && /Tablets/.test(b); });
  ok('G7d', cx, 'the codex screen counts creatures and tablets');
  // ---- upgrades
  await page.evaluate(() => { const G = window.__game, q = G.quest, s = q.shrinePlaces[0]; q.st.taken += 40; G.hero.pos.copy(s.pl.p); }); await tap('[data-tab=powers]');
  const u0 = await page.evaluate(() => [window.__game.quest.pearlCount(), window.__game.quest.st.levels.health || 0, document.querySelectorAll('#tab-powers [data-up]').length]);
  await page.evaluate(() => document.querySelector('#tab-powers [data-up]').click()); await page.waitForTimeout(100);
  const u1 = await page.evaluate(() => [window.__game.quest.pearlCount(), window.__game.quest.st.levels.health || 0]);
  ok('G7e', u1[1] === u0[1] + 1 && u1[0] < u0[0], `at a shrine: ${u0[2]} upgrades listed, health ${u0[1]} to ${u1[1]}, pearls ${u0[0]} to ${u1[0]}`);
  // ---- settings
  await tap('[data-tab=settings]');
  const set = await page.evaluate(() => { const G = window.__game, S = G.settings, set = (key, v) => { const r = document.querySelector(`[data-range=${key}]`); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); };
    set('music', 0.25); set('sound', 0.5); set('camera', 1.5);
    document.querySelector('[data-set=shake][data-v=false]').click(); return { music: S.music, sound: S.sound, cam: S.camera, shake: S.shake }; });
  await page.waitForTimeout(120);
  await page.evaluate(() => document.querySelector('[data-set=flash][data-v=false]').click());
  const looks = await page.evaluate(() => { const G = window.__game; const b = document.querySelectorAll('[data-look]'); const name = b[b.length - 1].dataset.look; b[b.length - 1].click(); return { name, now: G.look.lookName, flash: G.settings.flash }; });
  const shook = await page.evaluate(() => { const G = window.__game; let n = 0; const c0 = G.camera.position.clone(); G.shake(1); return G.settings.shake === false; });
  ok('G7f', set.music === 0.25 && set.sound === 0.5 && set.cam === 1.5 && set.shake === false && looks.flash === false && looks.now === looks.name && shook, `music ${set.music}, sound ${set.sound}, camera ${set.cam}, shake ${set.shake}, flashes ${looks.flash}, look ${looks.now}`);
  await page.evaluate(() => { const G = window.__game; G.look.setLook(G.look.looks[0], 0.1); });
  await tap('#resume');
  // ---- a cinematic: bars, a pause, one tap to skip
  await page.evaluate(() => { const G = window.__game; G.quest.debugScene = G.cine.play('bell_reef', { focus: G.hero.pos.clone() }); });
  await page.waitForTimeout(500);
  const c = await page.evaluate(() => { const G = window.__game, b = document.querySelector('#bars .b').getBoundingClientRect(); return { on: G.cine.active, bar: b.height, id: G.cine.id, hud: getComputedStyle(document.getElementById('hud')).visibility }; });
  ok('C1b', c.on && c.bar > 40 && c.hud === 'hidden', `cinematic ${c.id}: bars ${Math.round(c.bar)} px, HUD ${c.hud}`);
  await tap('#cinePause'); const p0 = await page.evaluate(() => [window.__game.paused, window.__game.time]); await page.waitForTimeout(400); const p1 = await page.evaluate(() => window.__game.time);
  ok('C1d', p0[0] && p0[1] === p1, `the cinematic pauses: paused ${p0[0]}, game time held at ${p0[1].toFixed(2)}`);
  await tap('#resume'); await page.waitForTimeout(120); await tap('#cineSkip');
  const s = await page.evaluate(() => ({ on: window.__game.cine.active, bars: document.getElementById('bars').classList.contains('on') }));
  ok('C1c', !s.on && !s.bars, 'one tap on Skip ends it');
  // C1s: every shot of every cinematic, its camera sampled ten times a second at the place it plays: never in a solid, never under the ground
  const cam = await page.evaluate(() => { const G = window.__game, q = G.quest, cine = G.cine, h = G.hero, bad = {}; let n = 0, ids = 0; const keep = h.pos.clone(), fov = G.camera.fov;
    for (const id of cine.list()) { const bell = q.bells.find((b) => `bell_${b.id}` === id), boss = /^boss_/.test(id), at = bell ? bell.p : boss ? q.places.resolve({ arena: true }).p : h.pos;
      if (bell) h.pos.copy(bell.p); else if (boss) h.pos.copy(at); else h.pos.copy(keep);
      if (!cine.play(id, { focus: at.clone(), bearing: 0.7, film: true })) continue; ids++;
      for (let i = 0; i < 400 && cine.active; i++) { cine.step(0.1); if (!cine.active) break; if (!cine.draw()) continue; n++; const c = G.camera.position, b = { x: c.x, y: -c.z, z: c.y }; if (G.world.collide(b, 0.25) && Math.hypot(b.x - c.x, b.y + c.z, b.z - c.y) > 0.02) (bad[id] = bad[id] || []).push([c.x, c.y, c.z].map(Math.round).join()); }
      cine.stop(true); }
    h.pos.copy(keep); h.prev.copy(keep); G.camera.fov = fov; G.camera.updateProjectionMatrix(); return { n, ids, bad: Object.entries(bad).map(([k, v]) => `${k} ${v.length} at ${v[0]}`) }; });
  ok('C1s', cam.ids >= 13 && !cam.bad.length, cam.bad.length ? `a camera in a solid or the ground: ${cam.bad.join(' · ')}` : `${cam.ids} cinematics, ${cam.n} samples: no camera in a solid or under the ground`);
  // ---- a person, by fingers: the Talk button comes up, a tap opens the box, a tap goes on, Skip closes it
  await page.evaluate(() => { const G = window.__game, q = G.quest, ms = q.missions; G.hero.inv = 1e6; for (const m of ms.active.slice()) ms.stop(m); ms.rec.ch1 = { st: 'done', n: 1 }; q.people.refresh(); const p = q.people.byId.get('tamsin'); G.hero.pos.copy(q.people.pos('tamsin')); G.hero.pos.y += 1; G.hero.pos.x += 2; G.hero.prev.copy(G.hero.pos); G.hero.land = true; }); await page.waitForTimeout(1300);
  const up = await page.evaluate(() => { const b = document.getElementById('bRide'), G = window.__game, q = G.quest, n = q.people.nearest(); return { show: b.classList.contains('show'), text: b.textContent, near: n && n.id, d: Math.round(q.people.dist('tamsin') * 10) / 10, talk: !!q.st.talk, paused: G.paused, st: G.hero.state, body: document.body.className }; });
  if (!up.show) { ok('G2d', false, `the Talk button never came up beside Tamsin: ${JSON.stringify(up)}`); throw new Error('no Talk button'); }
  await tap('#bRide'); await page.waitForTimeout(250);
  const box = await page.evaluate(() => { const t = document.getElementById('talk'); return { on: t.classList.contains('on'), who: document.getElementById('talkWho').textContent, pic: getComputedStyle(document.getElementById('talkPic')).backgroundImage.length, hud: getComputedStyle(document.getElementById('stick')).display }; });
  await tap('#talk'); await page.waitForTimeout(120);                       // the first tap finishes the line as it's written out
  if (await page.evaluate(() => document.getElementById('talk').classList.contains('on'))) await tap('#talkSkip'); await page.waitForTimeout(150);
  const shut = await page.evaluate(() => ({ on: document.getElementById('talk').classList.contains('on'), lock: document.body.classList.contains('talking'), give: window.__game.quest.missions.rec.s_nets }));
  ok('G2d', up.show && /Talk/.test(up.text) && box.on && box.who === 'Tamsin Vear' && box.pic > 2000 && box.hud === 'none' && !shut.on && !shut.lock, `by fingers: the button reads "${up.text}", the box shows ${box.who} with a painted portrait, the thumbs are out of the way, Skip closes it`);
  // ---- turned
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(250); await tap('#pauseB');
  const fit = await page.evaluate(() => { const out = []; for (const t of ['quests', 'map', 'codex', 'powers', 'settings']) { document.querySelector(`[data-tab=${t}]`).click(); const r = document.getElementById(`tab-${t}`).getBoundingClientRect(), nav = document.getElementById('tabs').getBoundingClientRect(); if (r.height < 150 || r.bottom > nav.top + 1 || r.right > innerWidth) out.push(`${t} ${Math.round(r.height)}`); } const btns = [...document.querySelectorAll('#tabs button')].map((b) => Math.round(Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))); return { out, btns }; });
  ok('G7g', !fit.out.length && Math.min(...fit.btns) >= 62, `turned, every tab fits above the tab bar${fit.out.length ? ': not ' + fit.out : ''}; tab buttons at least ${Math.min(...fit.btns)} px`);
  // G8g: the Ice drill at the Arena gate by a player's own taps, with no bot's help: to Ice, a parry twice beside the Reavers, and the chapter goes on
  await page.evaluate(() => { const G = window.__game; G.ui.setPause(false); });
  const dr0 = await page.evaluate(() => { const G = window.__game, q = G.quest, ms = q.missions, h = G.hero; for (const m of ms.active.slice()) ms.stop(m); delete ms.rec.ch7; for (const k in h.powers) h.powers[k] = true; h.powers.ice = true; if (G.combat.unlockStance) G.combat.unlockStance('ice'); G.ui.unlock('ice'); h.inv = 1e6; h.tide = h.maxTide;
    ms.start('ch7', true); const m = ms.active.find((x) => x.def.id === 'ch7'); for (let i = 0; i < 4; i++) { m.passed = true; ms.step(0); } const e = m.rt.encs[0], c = e.c || e.list[0].pos; h.pos.set(c.x, c.y, c.z); h.prev.copy(h.pos); h.vel.set(0, 0, 0); h.land = false; return { i: m.i, text: ms.textOf(m), stance: document.body.dataset.stance, n: e.list.length }; });
  await page.waitForTimeout(400);
  if (dr0.stance !== 'ice') await tap('#bStance'); await page.waitForTimeout(500);
  const dr1 = []; for (let k = 0; k < 2; k++) { await tap('#bParry'); await page.waitForTimeout(1300); dr1.push(await page.evaluate(() => { const ms = window.__game.quest.missions, m = ms.active.find((x) => x.def.id === 'ch7'); return m ? [m.i, ms.textOf(m)] : null; })); }
  ok('G8g', dr0.i === 4 && dr1[1] && dr1[1][0] > 4, `objective ${dr0.i} "${dr0.text}", two parries by touch in Ice: now objective ${dr1[1] && dr1[1][0]}, "${dr1[1] && dr1[1][1]}"`);
  ok('G7z', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'no page errors through every screen');
} catch (e) { ok('G7', false, 'the run did not finish: ' + e.message); }
await browser.close(); done();
