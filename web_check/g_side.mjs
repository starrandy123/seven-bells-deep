// G3, G4, G5: the bot finishes every side mission, every challenge, and each world event fires, ends and pays. Each starts from a fresh chain
// (the story is marked done up to what it needs, so a side mission sees the world it would see). Bound: 420 s of game time each, twice that for The Pit's five waves (ours).
//   node web_check/g_side.mjs <base> <engine>
import { args, launch, ok, done, bench, run } from './lib_g.mjs';
const { base, engine } = args(), LIMIT = 420, WALL = 165000;
const browser = await launch(engine); let page;
try {
  page = await bench(browser, base);
  const list = await page.evaluate(() => { const G = window.__game, ms = G.quest.missions; return [...ms.defs.values()].filter((d) => d.kind !== 'story').map((d) => ({ id: d.id, kind: d.kind, title: d.title })); });
  const t0 = Date.now(), res = {}; let fails = [], pay = [];
  // the story is done for this bench: everybody is where they end up
  await page.evaluate(() => { const G = window.__game, ms = G.quest.missions; for (const m of ms.active.slice()) ms.stop(m); for (const d of ms.story) ms.rec[d.id] = { st: 'done', n: 1 }; G.quest.debugRingAll(); G.quest.st.won = true; G.boss.dead = true; G.enemies.clearAll(); G.quest.events.hold(true); G.hero.maxHp = G.hero.hp = 100000; });
  const only = process.env.G_ONLY ? new RegExp(process.env.G_ONLY) : null;      // a debugging run: G_ONLY=^e_ node web_check/g_side.mjs ...
  for (const d of list) {
    if (only && !only.test(d.id)) continue;
    if (Date.now() - t0 > WALL) { fails.push(`${d.id}: no time left in this run`); continue; }
    const start = await page.evaluate((d) => { const G = window.__game, q = G.quest, ms = q.missions; G.enemies.clearAll(); q.events.hold(false); q.events.end(true); q.events.hold(d.kind !== 'event'); G.hero.dead = false; G.hero.maxHp = 100000; G.hero.hp = G.hero.maxHp; for (const m of ms.active.slice()) ms.stop(m); const started = d.kind === 'event' ? q.debugEvent(d.id) : q.debugStart(d.id);
      // an event ends on a clock: the bench starts the Warden 200 m out, a swim any player near it would make
      if (d.kind === 'event') { const t = q.target(); if (t) { G.hero.pos.set(t.x + 150, Math.min(t.y + 20, -3), t.z + 130); const b = { x: G.hero.pos.x, y: -G.hero.pos.z, z: G.hero.pos.y }; G.world.collide(b, 0.7); G.hero.pos.set(b.x, b.z, -b.y); G.hero.prev.copy(G.hero.pos); G.hero.land = false; } }
      return { ok: started, pearls: q.st.taken, t: G.time }; }, d);
    if (!start.ok) { fails.push(`${d.id}: would not start`); continue; }
    let r;
    for (let k = 0; k < 40; k++) {
      r = await run(page, 800, `(G.quest.missions.rec['${d.id}'] || {}).st === 'done' || !G.quest.missions.active.some((m) => m.def.id === '${d.id}') || G.time - ${start.t} > ${d.id === 'c_pit' ? 2 * LIMIT : LIMIT}`, `(() => { const ms = G.quest.missions, m = ms.active.find((x) => x.def.id === '${d.id}'), h = G.hero; return { st: (ms.rec['${d.id}'] || {}).st, i: m ? m.i : -1, text: m ? ms.textOf(m) : '', pos: [h.pos.x, h.pos.y, h.pos.z].map(Math.round), pearls: G.quest.st.taken, plan: m && ms.tracked === m ? JSON.stringify(ms.botPlan()) : ms.tracked ? 'tracking ' + ms.tracked.def.id : 'nothing tracked', foes: G.enemies.count() }; })()`);
      if (only) console.log(d.id, Math.round(r.t - start.t), JSON.stringify(r.out).slice(0, 300));
      if (r.done) break;
    }
    const secs = Math.round(r.t - start.t), okd = r.out.st === 'done';
    res[d.id] = okd ? secs : null;
    if (!okd) fails.push(`${d.id} stopped at objective ${r.out.i} "${r.out.text}", ${secs} s, Warden at ${r.out.pos}`);
    if (d.kind === 'event') pay.push(`${d.id} ${okd ? '+' + (r.out.pearls - start.pearls) : 'unpaid'}`);
  }
  // G2a: the bot talks to each person: a dialogue box opens, or they say a line
  const spoke = await page.evaluate(async () => { const G = window.__game, q = G.quest, h = G.hero, ms = q.missions, out = []; for (const m of ms.active.slice()) ms.stop(m);
    for (const p of q.people.list) { if (p.gone) q.people.move(p.id, p.at); h.pos.copy(q.people.pos(p.id)); h.pos.y += 1; h.prev.copy(h.pos); let said = false; const b = G.ui.bark, d = G.ui.talkLine; G.ui.bark = (...a) => { said = true; return b(...a); }; G.ui.talkLine = (...a) => { if (a[0]) said = true; return d(...a); }; p.heard = {}; q.people.refresh(); q.people.talk(p.id); G.ui.bark = b; G.ui.talkLine = d; if (q.st.talk) { q.talkSkip(); } if (said && q.people.portrait(p.id).length > 2000) out.push(p.id); else out.push('!' + p.id); }
    return out; });
  const dumb = spoke.filter((s) => s[0] === '!');
  ok('G2t', !dumb.length && spoke.length >= 8, dumb.length ? `silent or no portrait: ${dumb.join(' ')}` : `${spoke.length} people answer and have a painted portrait`);
  const of = (k) => list.filter((d) => d.kind === k);
  const line = (k) => { const a = of(k), g = a.filter((d) => res[d.id] != null); return `${g.length} of ${a.length}`; };
  ok('G3', of('side').length >= 12 && of('side').every((d) => res[d.id] != null), `side missions finished by the bot: ${line('side')} (at least 12) ${fails.filter((f) => of('side').some((d) => f.startsWith(d.id))).join(' | ')}`);
  ok('G4', of('challenge').every((d) => res[d.id] != null), `challenges finished: ${line('challenge')}, best kept ${await page.evaluate(() => Object.keys(window.__game.quest.st.best).length)} ${fails.filter((f) => of('challenge').some((d) => f.startsWith(d.id))).join(' | ')}`);
  ok('G5', of('event').length >= 6 && of('event').every((d) => res[d.id] != null), `events fired, ended and paid: ${line('event')} (at least 6): ${pay.join(', ')} ${fails.filter((f) => of('event').some((d) => f.startsWith(d.id))).join(' | ')}`);
  ok('G3e', page.errs.length === 0, page.errs.length ? [...new Set(page.errs)].slice(0, 3).join(' | ') : 'no page errors');
} catch (e) { ok('G3', false, 'the run did not finish: ' + e.message); }
await browser.close(); done();
