// G6: pearls and chests counted, the twenty tablets found and read, the book logs what he swims near; and every place a mission, a person or a tablet
// names can really be reached from the spawn (a route over water and walkable land), and isn't inside a solid.
//   node web_check/g_collect.mjs <base> <engine>
import { args, launch, ok, done, bench } from './lib_g.mjs';
const { base, engine } = args();
const browser = await launch(engine); let page;
try {
  page = await bench(browser, base, '?film&fresh&tier=phone');
  await page.evaluate(() => { const G = window.__game; G.started = G.playing = true; G.quest.events.hold(true); const ms = G.quest.missions; for (const m of ms.active.slice()) ms.stop(m); });
  const a = await page.evaluate(() => { const G = window.__game, q = G.quest, h = G.hero, go = (p) => { h.pos.copy(p); h.prev.copy(h.pos); h.vel.set(0, 0, 0); h.land = false; h.air = p.y > -0.3; for (let i = 0; i < 12; i++) G.frame(1 / 30); };
    const p0 = q.pearlCount(), c0 = q.progress().rows.chests[0]; let n = 0; const missed = [];
    for (const a of q.pearls.slice(0, 8)) { go(a.p); n++; if (a.on) missed.push([Math.round(a.home.x), Math.round(a.home.y), Math.round(a.home.z)].join()); } const got = q.pearlCount() - p0;
    for (const c of q.chests.slice(0, 2)) go(c.p); const ch = q.progress().rows.chests[0] - c0, after = q.pearlCount() - p0 - got;
    return { n, got, ch, after, missed, left: q.progress().rows.pearls, chests: q.progress().rows.chests }; });
  ok('G6a', a.got === a.n && a.ch === 2 && a.after >= 6, `${a.got} of ${a.n} pearls taken, ${a.ch} chests paid ${a.after}; the counts read ${a.left.join(' of ')} and ${a.chests.join(' of ')}${a.missed.length ? '; not reached: ' + a.missed.join(' ') : ''}`);
  const r = await page.evaluate(() => { const G = window.__game, q = G.quest, h = G.hero, c = q.collect; let shown = 0; const titles = new Set(c.relics.map((t) => t.title)), card = G.ui.card; G.ui.card = (...x) => { if (titles.has(x[0])) shown++; return card(...x); };
    const miss = []; for (const t of c.relics) { if (t.found || !t.pl) { if (!t.found) miss.push(t.id); continue; } h.pos.copy(t.pl.p); h.prev.copy(h.pos); h.vel.set(0, 0, 0); for (let i = 0; i < 16; i++) G.frame(1 / 30); if (!t.found) miss.push(t.id); }
    G.ui.card = card; return { found: c.foundCount(), total: c.relics.length, shown, miss }; });
  ok('G6b', r.found === 20 && r.shown === 20, `${r.found} of ${r.total} tablets found by swimming to them, ${r.shown} read on screen${r.miss.length ? '; missed ' + r.miss : ''}`);
  // every pearl in reach: under water, or no higher over the land or the sea than he can get. A breach tops out at about 7 m (measured by a bot, ours), and a pearl comes to him from 2 m
  const high = await page.evaluate(() => { const G = window.__game, W = G.world, FAR = 9, out = []; let n = 0, deck = (x, y) => { for (const k of W.data.decks || []) if (Math.hypot(x - k.x, y - k.y) < Math.max(k.hx, k.hy) + 2) return k.z; return -1e9; };
    for (const a of G.quest.pearls) { const x = a.home.x, y = -a.home.z, z = a.home.y; n++; if (z < 0) continue; const under = Math.max(0, W.heightAt(x, y), deck(x, y)); if (z - under > FAR) out.push(`${Math.round(x)},${Math.round(y)},${Math.round(z)} is ${Math.round(z - under)} m up`); } return { n, out }; });
  ok('G6r', !high.out.length, high.out.length ? `out of his reach: ${high.out.join(' · ')}` : `all ${high.n} pearls are under water or within his reach of the land or the sea`);
  const c = await page.evaluate(() => { const G = window.__game, q = G.quest, h = G.hero, b = q.collect, L = G.life, seen = []; const go = (p) => { h.pos.copy(p); h.pos.y = Math.min(h.pos.y, -2); h.prev.copy(h.pos); h.vel.set(0, 0, 0); for (let i = 0; i < 40; i++) G.frame(1 / 30); };
    for (let k = 0; k < 60; k++) { const p = b.nearestUnlogged(); if (!p) break; go(p); }
    return { n: b.loggedCount(), of: b.entries.length, left: b.entries.filter((e) => !b.logged[e.id]).map((e) => e.id), all: b.entries.length }; });
  ok('G6c', c.n >= Math.min(8, c.of), `the book logged ${c.n} of the ${c.of} species this build's sea holds by swimming near them${c.left.length ? '; not reached by this bench: ' + c.left.join(' ') : ''}`);
  const places = await page.evaluate(() => { const G = window.__game, q = G.quest, nav = q.nav, spawn = q.places.resolve({ spawn: true }).p, bad = [], stuck = [], n = { all: 0 };
    const test = (name, pl) => { if (!pl || pl.lost) { bad.push(name); return; } n.all++; if (!nav.reachable(spawn, pl.p)) bad.push(name); const c = { x: pl.x, y: pl.y, z: pl.z }; if (G.world.collide(c, 0.3) && Math.hypot(c.x - pl.x, c.y - pl.y, c.z - pl.z) > 1.2) stuck.push(name); };
    for (const r of q.collect.relics) test(r.id, r.pl);
    for (const p of q.people.list) test(p.id, q.places.resolve(p.moved || p.at, 0.5));
    for (const b of q.bells) test('bell ' + b.id, { x: b.x, y: b.y, z: b.z, p: b.p });
    for (const d of q.missions.defs.values()) for (const o of d.objectives) for (const k of ['at', 'to', 'from']) { const sp = o[k]; if (!sp) continue; for (const s of [].concat(sp)) { if (s && s.event) continue; test(`${d.id}.${k}`, q.places.resolve(s, 0.6)); } }
    // the things a mission scatters round a place
    for (const d of q.missions.defs.values()) d.objectives.forEach((o, i) => { if (o.around) q.spots(o, { def: d, i }).forEach((pl, k) => test(`${d.id}.${i}.spot${k}`, pl)); });
    return { n: n.all, bad: [...new Set(bad)], stuck: [...new Set(stuck)] }; });
  // G1w: a fight is never set behind a wall from where the player comes to it. A walk on a 5 m grid, in free water, from the last place the mission named to where the foes start: over 1.6 times the straight line and 15 m is a wall in the way
  const walled = await page.evaluate(() => { const G = window.__game, q = G.quest, W = G.world, C = 5, out = []; let n = 0;
    const walk = (a, b) => { const lo = [Math.min(a.x, b.x) - 60, Math.min(a.y, b.y) - 60, Math.min(a.z, b.z) - 20], size = [Math.abs(a.x - b.x) + 120, Math.abs(a.y - b.y) + 120, Math.abs(a.z - b.z) + 70].map((v) => Math.ceil(v / C) + 1), id = (i, j, k) => i + size[0] * (j + size[1] * k), cell = (p) => [Math.round((p.x - lo[0]) / C), Math.round((p.y - lo[1]) / C), Math.round((p.z - lo[2]) / C)], seen = new Int32Array(size[0] * size[1] * size[2]).fill(-1), [ax, ay, az] = cell(a), [bx, by, bz] = cell(b), t = { x: 0, y: 0, z: 0 };
      const free = (i, j, k) => { t.x = lo[0] + i * C; t.y = lo[1] + j * C; t.z = lo[2] + k * C; if (t.z > Math.max(3, W.heightAt(t.x, t.y) + 6) + C / 2) return false; return !W.collide(t, 1.2); };      // over water to the surface, over land as high as he leaps. The half cell: a beach steps down inside one cell, and with no slack this grid can't come down a shore he walks (s_bell.1, 1 Nov: read red with an 8 s walk there, driven by bellrun)
      let line = [[ax, ay, az]]; seen[id(ax, ay, az)] = 0;
      for (let d = 1; line.length && d < 400; d++) { const next = []; for (const [i, j, k] of line) for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const u = i + x, v = j + y, w = k + z; if (u < 0 || v < 0 || w < 0 || u >= size[0] || v >= size[1] || w >= size[2] || seen[id(u, v, w)] >= 0) continue; seen[id(u, v, w)] = d; if (Math.abs(u - bx) + Math.abs(v - by) + Math.abs(w - bz) <= 1) return d * C; if (free(u, v, w)) next.push([u, v, w]); else seen[id(u, v, w)] = 1e9; } line = next; }
      return Infinity; };
    for (const d of q.missions.defs.values()) { let from = null; d.objectives.forEach((o, i) => { const sp = o.at || o.to; if (sp && !Array.isArray(sp) && !sp.event) from = q.places.resolve(sp.gate ? { gate: true, dir: 180, dist: 12 } : sp, 0.6);      // the gate itself is shut in this bench: he stands on its road
      for (const g of [].concat(o.spawn || [])) { if (!g.at || g.at.event) continue; const to = q.places.resolve(g.at, 0.6); if (!from) { from = to; continue; } n++; const straight = Math.abs(from.x - to.x) + Math.abs(from.y - to.y) + Math.abs(from.z - to.z), got = walk(from, to); if (got > straight * 1.6 + 15) out.push(`${d.id}.${i} ${got === Infinity ? 'no way' : Math.round(got) + ' m'} for a straight ${Math.round(straight)} m`); } }); }
    return { n, out }; });
  ok('G1w', !walled.out.length, walled.out.length ? `a fight behind a wall: ${walled.out.join(' · ')}` : `all ${walled.n} mission fights are in open water from where the player comes to them`);
  // G1o: nothing sits in a sealed pocket. From each thing to find, a walk on a 2.5 m grid for a body of his size, until a cell has open water straight up to the surface
  const sealed = await page.evaluate(() => { const G = window.__game, q = G.quest, W = G.world, C = 2.5, R = 0.62, out = []; let n = 0;
    const open = (p) => !W.sweep(p, { x: p.x, y: p.y, z: -0.5 }, R), t = { x: 0, y: 0, z: 0 };
    const out_of = (s) => { if (s.z > -0.8 || open(s)) return true; const seen = new Set(['0,0,0']); let line = [[0, 0, 0]];
      for (let d = 0; d < 120 && line.length; d++) { const next = []; for (const [i, j, k] of line) for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const u = i + x, v = j + y, w = k + z, key = `${u},${v},${w}`; if (seen.has(key)) continue; seen.add(key); t.x = s.x + u * C; t.y = s.y + v * C; t.z = s.z + w * C; const c = { x: t.x, y: t.y, z: t.z }; if (W.collide(t, R)) continue; if (open(c)) return true; next.push([u, v, w]); } line = next; }
      return false; };
    const test = (name, p) => { n++; const b = { x: p.x, y: -p.z, z: p.y }; if (!out_of(b)) out.push(`${name} at ${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.z)}`); };
    q.pearls.forEach((a, i) => test(`pearl ${i}`, a.home)); q.chests.forEach((c, i) => test(`chest ${i}`, c.p)); for (const r of q.collect.relics) if (r.pl) test(r.id, r.pl.p); for (const b of q.bells) test(`bell ${b.id}`, b.p); for (const p of q.people.list) test(p.id, q.people.pos(p.id));
    for (const d of q.missions.defs.values()) d.objectives.forEach((o, i) => { for (const k of ['at', 'to', 'from']) for (const sp of [].concat(o[k] || [])) if (sp && !sp.event && !sp.gate) test(`${d.id}.${i}`, q.places.resolve(sp, 0.6).p); if (o.around) q.spots(o, { def: d, i }).forEach((pl, j) => test(`${d.id}.${i}.spot${j}`, pl.p)); });
    return { n, out: [...new Set(out)] }; });
  ok('G1o', !sealed.out.length, sealed.out.length ? `in a sealed pocket: ${sealed.out.slice(0, 12).join(' · ')}` : `all ${sealed.n} things to find and places to go can be swum to from open water`);
  ok('G1r', !places.bad.length, places.bad.length ? `no route from the spawn: ${places.bad.join(' ')}` : `all ${places.n} places a mission, person, bell or tablet names have a route from the spawn`);
  ok('G1s', !places.stuck.length, places.stuck.length ? `inside a solid by more than 1.2 m: ${places.stuck.join(' ')}` : 'none of them sits inside a solid');
  // P9c: the price of every level against what a full game can collect once: 100-120% (ours), summed from the game's own data
  { const root = base.replace(/index\.html.*$/, ''), get = async (f) => (await fetch(root + f)).json(), [up, ms, wd] = await Promise.all([get('data/upgrades.json'), get('data/missions.json'), get('assets/world.json')]);
    let found = (wd.pearls || []).length + (wd.chests || []).length * 3; for (const m of [...ms.story, ...ms.side]) found += (m.reward && m.reward.pearls) || 0;
    const price = up.list.length * up.cost.reduce((a, c) => a + c.pearls, 0), pct = Math.round((price / found) * 100);
    ok('P9c', pct >= 100 && pct <= 120, `${up.list.length} upgrades cost ${price} pearls, a full game finds ${found}: ${pct}% (100-120)`); }
  // G1g: the count reaches 100 only with The Drowned Fleet done. Run last: it marks everything found
  const g = await page.evaluate(() => { const q = window.__game.quest, ms = q.missions, c = q.collect, rows = q.progress().rows;
    for (const a of q.pearls) a.on = false; for (const b of q.chests) b.on = false; for (const r of c.relics) r.found = true; for (const e of c.entries) c.logged[e.id] = 1;
    q.st.forms = new Array(rows.forms[1]).fill('x'); q.st.outfits = new Array(rows.outfits[1]).fill('x');
    const ds = [...ms.defs.values()].filter((d) => d.kind !== 'event'), fleet = ds.filter((d) => /^fleet/.test(d.id));
    for (const d of ds) ms.rec[d.id] = { st: 'done', n: 1 };
    for (const d of fleet) delete ms.rec[d.id]; const short = q.progress().pct;
    for (const d of fleet) ms.rec[d.id] = { st: 'done', n: 1 };
    return { fleet: fleet.map((d) => d.id), short, full: q.progress().pct }; });
  ok('G1g', g.fleet.length >= 2 && g.short < 100 && g.full === 100, `all but The Drowned Fleet (${g.fleet.join(' ')}) reads ${g.short}%, with it ${g.full}%`);
  ok('G6e', page.errs.length === 0, page.errs.length ? page.errs.slice(0, 2).join(' | ') : 'no page errors');
} catch (e) { ok('G6a', false, 'the run did not finish: ' + e.message); }
await browser.close(); done();
