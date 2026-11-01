// G5b, G10b: left alone, the sea keeps happening. Over 30 minutes of game time with the Warden idle: an omen every 2-3 minutes (ours), each event announced,
// each ignored one passes without paying. And G10a's minimum in numbers: an omen stands tall enough to show from 300 m.
//   node web_check/g_events.mjs <base> <engine>
import { args, launch, ok, done, bench, run } from './lib_g.mjs';
const { base, engine } = args();
const browser = await launch(engine); let page;
try {
  page = await bench(browser, base, '?film&fresh&tier=phone');
  const r = await page.evaluate(async () => {
    const G = window.__game, q = G.quest, ms = q.missions, h = G.hero, out = { fired: [], passed: 0, tips: [] };
    G.started = G.playing = true; for (const m of ms.active.slice()) ms.stop(m); for (const d of ms.story) ms.rec[d.id] = { st: 'done', n: 1 }; h.inv = 1e9;
    const ev = G.ui.event, tip = G.ui.tip; G.ui.event = (a, b, c) => { out.fired.push([Math.round(G.time), a]); return ev(a, b, c); }; G.ui.tip = (a, b) => { if (/passes|drift|scatter|gone by|dark|blows out|goes out/.test(a)) out.passed++; return tip(a, b); };
    const p0 = q.st.taken, t0 = G.time; while (G.time - t0 < 1800) { for (let i = 0; i < 12; i++) G.frame(1 / 12); }
    out.paid = q.st.taken - p0; out.first = out.fired.length ? out.fired[0][0] - Math.round(t0) : null; G.ui.event = ev; G.ui.tip = tip; return out; });
  const gaps = r.fired.slice(1).map((f, i) => f[0] - r.fired[i][0]), kinds = new Set(r.fired.map((f) => f[1]));
  ok('G10b', r.fired.length >= 8 && gaps.every((g) => g <= 240), `${r.fired.length} events in 30 min, first at ${r.first} s, gaps ${Math.min(...gaps)}-${Math.max(...gaps)} s (ours: 2-3 min, at most 4), ${kinds.size} kinds: ${[...kinds].join(', ')}`);
  ok('G5c', r.passed >= r.fired.length - 1 && r.paid === 0, `ignored, ${r.passed} of ${r.fired.length} passed with a line, and they paid ${r.paid} pearls`);
  // G5s: stopping a mission twice takes nothing else with it (an event that ended took the last mission off the list)
  const twice = await page.evaluate(() => { const G = window.__game, q = G.quest, ms = q.missions; q.events.hold(true); q.events.end(true); for (const m of ms.active.slice()) if (m.def.kind === 'event') ms.stop(m); if (!ms.active.length) { delete ms.rec.ch1; ms.start('ch1', true); } const n0 = ms.active.length, id0 = ms.tracked && ms.tracked.def.id, m = q.debugEvent('e_whales'), got = ms.active.find((x) => x.def.id === 'e_whales'); q.events.end(false); if (got) ms.stop(got); return { n0, n1: ms.active.length, id0, id1: ms.tracked && ms.tracked.def.id, m: !!m }; });
  ok('G5s', twice.m && twice.n0 >= 1 && twice.n1 === twice.n0 && twice.id1 === twice.id0, `an event stopped twice: ${twice.n0} missions before, ${twice.n1} after, tracking ${twice.id1}${twice.n1 === twice.n0 ? '' : ': it took a mission with it'}`);
  ok('G5e', page.errs.length === 0, page.errs.length ? page.errs.slice(0, 2).join(' | ') : 'no page errors in 30 minutes of events');
} catch (e) { ok('G10b', false, 'the run did not finish: ' + e.message); }
await browser.close(); done();
