// G1: the bot finishes the seven chapters and the eighth, through the real objectives. A mission that never advances is a failure by name:
// an objective open more than 480 s of game time, 600 s for a fight, 720 s for a boss (bounds ours), fails with its chapter, objective, text and where the Warden was.
//   node web_check/g_story.mjs <base> <engine>
import { args, launch, ok, done, bench, run } from './lib_g.mjs';
const { base, engine } = args(), LIMIT = 480, FIGHT = 600, BOSS = 720, WALL = 150000;      // a fight is what the bot's worst at: slow is fine, a stall isn't (bounds ours)
const browser = await launch(engine); let page;
try {
  page = await bench(browser, base);
  const t0 = Date.now(); let last = '', since = 0, worst = { t: 0, what: '' }, bad = null, chapters = {};
  while (Date.now() - t0 < WALL && !bad) {
    const r = await run(page, 700, '!G.quest.missions.tracked', '(() => { const ms = G.quest.missions, m = ms.tracked, h = G.hero; return { foes: G.enemies.alive().length, close: Math.round(Math.min(999, ...G.enemies.alive().map((e) => e.pos.distanceTo(h.pos)))), id: m ? m.def.id : null, i: m ? m.i : -1, text: ms.objectiveText(), type: m ? ms.cur(m).type : "", pos: [h.pos.x, h.pos.y, h.pos.z].map(Math.round), hp: Math.round(h.hp) }; })()');
    const key = r.out.id + '.' + r.out.i;
    if (key !== last) { if (last && r.t - since > worst.t) worst = { t: r.t - since, what: last }; last = key; since = r.t; if (r.out.id) chapters[r.out.id] = (chapters[r.out.id] || 0) + 1; }
    if (r.t - since > (r.out.type === 'boss' ? BOSS : /defeat|drill|survive/.test(r.out.type) ? FIGHT : LIMIT) && r.out.id) bad = { ...r.out, t: Math.round(r.t), open: Math.round(r.t - since) };
    if (r.done) break;
  }
  const s = await page.evaluate(() => { const G = window.__game, ms = G.quest.missions; return { rec: ms.story.map((d) => [d.id, ms.isDone(d.id)]), t: Math.round(G.time), rung: G.quest.rungCount(), bells: G.quest.bells.length, won: G.quest.st.won, dead: G.boss.dead, active: ms.active.length, missing: [...G.quest.places.missing.keys()] }; });
  const notDone = s.rec.filter((x) => !x[1]).map((x) => x[0]);
  const stalls = await page.evaluate(() => (window.__game.quest.nav.stalls || []).slice(0, 12).map((a) => `${a.at} (${a.n})`));
  console.log(`     the bot backed out of ${stalls.length ? stalls.join(' · ') : 'nowhere'}`);
  ok('G1', !bad && !notDone.length, bad ? `objective open over its bound: ${bad.id} objective ${bad.i} (${bad.type}) "${bad.text}", ${bad.open} s, Warden at ${bad.pos} hp ${bad.hp}, ${bad.foes} foes, the nearest ${bad.close} m` : notDone.length ? `not finished in ${Math.round((Date.now() - t0) / 1000)} s of real time: ${notDone.join(' ')} (stopped in ${last})` : `bot finished ${s.rec.length} chapters in ${s.t} s of game time, longest objective ${Math.round(worst.t)} s (${worst.what}), bound ${LIMIT} s`);
  ok('G1b', s.rung === s.bells && s.won, `${s.rung} of ${s.bells} bells rung, Leviathan down: ${s.won}`);
  ok('G1e', page.errs.length === 0, page.errs.length ? [...new Set(page.errs)].slice(0, 3).join(' | ') : 'no page errors in the whole story');
} catch (e) { ok('G1', false, 'the run did not finish: ' + e.message); }
await browser.close(); done();
