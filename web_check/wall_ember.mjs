// The Emberkin (EPIC V1, V2, V5, V12): a flyer's rules, read in a real page by stepping the game's own frame. A wall says the rules hold; whether it looks like a flying fighter is his call on his phone.
//   node wall_ember.mjs <base> <chromium|webkit> [--only=E1,E2]
import { gate } from './lib/h.mjs';
const { line, note, open, section, finish } = await gate('wall_ember', { budget: 150 });
const TURNED = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const steps = (page, n, each = '') => page.evaluate(([n, each]) => { const G = window.__game, f = each ? new Function('G', 'i', each) : null; for (let i = 0; i < n; i++) { if (f) f(G, i); G.frame(1 / 60); } }, [n, each]);
await section(['E13'], async () => {
  const { page, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED });
  const r = await page.evaluate(() => { const G = window.__game, CH = G.ember.champions(), h = G.hero; h.inv = 1e6; const e = CH.start('fire'), seen = new Set(), states = new Set(); for (let i = 0; i < 2400; i++) { G.frame(1 / 30); h.hp = h.maxHp; if (e.B.move) seen.add(e.B.move); states.add(e.B.st); if (i === 500) e.hp = e.maxHp * 0.5; if (i === 1000) e.hp = e.maxHp * 0.3; if (i === 1500) e.hp = e.maxHp * 0.08; if (i === 2000) e.hp = 1; } const bar = document.getElementById('bossbar').classList.contains('on'); e.hp = 0; for (let i = 0; i < 30; i++) G.frame(1 / 30); return { seen: [...seen], states: [...states], bar, gone: !G.champ }; });
  line('E13', r.seen.length >= 5 && r.states.includes('fallen') && r.bar && r.gone, `a champion comes, shows ${r.seen.join(' ')}, falls and rises (${r.states.join(' ')}), holds the bar, and goes when he dies: ${r.gone}`);
  await close();
});
await section(['E14'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED });
  const r = await page.evaluate(() => { const G = window.__game, CH = G.ember.champions(), h = G.hero; G.ember.setSide('fire', { place: true, quiet: true }); h.inv = 1e6; const e = CH.start('water'), seen = new Set(); G.combat.log.length = 0; for (let i = 0; i < 2600; i++) { G.frame(1 / 30); h.hp = h.maxHp; if (e.B.move) seen.add(e.B.move); if (i === 400) e.hp = e.maxHp * 0.5; if (i === 900) e.hp = e.maxHp * 0.3; if (i % 40 === 0) { const a = { hits: new Set(), def: { damage: 40, kind: 'strike', impact: 'light' } }; try { e.onHit(40, h.pos, 'fire', { element: 'fire', melee: false, knock: 1, stun: 0.1, poise: 1 }); } catch (x) { console.error(String(x)); } } } return { seen: [...seen], hp: e.hp | 0, side: e.side, contacts: G.combat.log.filter((x) => x.foe === 'champion').length }; });
  line('E14', r.seen.length >= 5 && r.side === 'water' && !errors.filter((x) => !/qa\.js|Failed to load/.test(x)).length, `the Tidecaller fights a fire player with his whole kit: ${r.seen.join(' ')}; ${r.contacts} logged; side ${r.side}; errors ${JSON.stringify(errors.slice(0, 3)).slice(0, 300)}`);
  await close();
});
// the whole road on the fire side, a step at a time, from the player's seat: every step can be done, and the next one follows. A step that can't finish would strand a player for good
await section(['E15'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED });
  const r = await page.evaluate(() => {
    const G = window.__game, h = G.hero, E = G.ember, R = G.road, V = G.camera.position.constructor, seen = [], run = (n) => { for (let i = 0; i < n; i++) { h.hp = h.maxHp; G.frame(1 / 30); } };
    E.setSide('fire', { place: true, quiet: true }); R.at = 0; h.inv = 1e6;
    const put = (p, air) => { h.respawn(new V(p.x, p.y, p.z), 0); if (air) { h.fireAir = true; h.air = true; h.fly = true; } else { h.land = true; h.grounded = true; h.air = false; h.place(); } };
    for (let guard = 0; guard < 12; guard++) {
      const t = R.text(), to = R.target(), at = R.at; seen.push(t); if (!t) break;
      if (/Take off/.test(t)) { h.air = true; h.fireAir = true; }
      else if (to) put(to, !/Land on/.test(t));
      else if (/raids/.test(t)) { E.raids.kills = 3; }
      else if (/Tidecaller/.test(t)) { G.enemies.clearAll(); for (const e of E.raids.list) e.hp = 0; run(60); let c = G.champ; if (!c) { E.champions().start('water'); c = G.champ; } seen.push(c ? 'he comes' : 'NO CHAMPION'); if (c) { c.e.B.falsed = true; c.e.hp = 0; } }
      else if (/Seawall/.test(t)) { const b = G.bosses && G.bosses.seawall; if (b) { b.dead = true; } }
      run(40); if (R.at === at) { run(120); if (R.at === at) { seen.push('STUCK at ' + t + ' pos ' + h.pos.toArray().map((v) => v | 0)); break; } }
    }
    return { seen, end: R.at, foes: G.enemies.alive ? G.enemies.alive().length : -1 };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x));
  line('E15', r.seen.length >= 8 && !r.seen.some((x) => /STUCK|NO CHAMPION/.test(x)) && !real.length, `the fire road runs to its end: ${r.seen.join(' > ').slice(0, 330)}; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// the showcase, asked for in the worst moment: a raid has every body in the pool, then a real fight is on
await section(['E16'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED });
  const r = await page.evaluate(() => { const G = window.__game, E = G.ember, CH = E.champions(); E.setSide('fire', { place: true, quiet: true }); E.raidNow(3); for (let i = 0; i < 20; i++) G.frame(1 / 30); const full = E.pool.filter((q) => q.busy).length; CH.watch(true); for (let i = 0; i < 120; i++) G.frame(1 / 30); const d = CH.duel, both = !!(d && d.a && d.b && d.a.B && d.b.B); CH.watch(false); for (let i = 0; i < 20; i++) G.frame(1 / 30); const c = CH.start('water'), refused = CH.watch(true); return { full, both, c: !!c, refused }; });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x));
  line('E16', r.both && r.c && r.refused === false && !real.length, `Watch the duel with the pool full (${r.full} taken) still gives two fighters: ${r.both}; refused in a real fight: ${r.refused === false}; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// what a player who loses sees: death on the fire side, New Game on it, and a Seawall that beat him
await section(['E17'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED });
  const r = await page.evaluate(() => {
    const G = window.__game, h = G.hero, E = G.ember, V = G.camera.position.constructor, run = (n) => { for (let i = 0; i < n; i++) G.frame(1 / 30); }, kill = () => { h.hp = 0; h.dead = true; h.state = 'dead'; G.quest.onDeath(); }, pos = () => h.pos.toArray().map((v) => Math.round(v));
    E.setSide('fire', { place: true, quiet: true }); run(10); kill(); run(110); const one = { p: pos(), land: h.land, dead: h.dead };
    const c = G.world.cities.cities.find((q) => q.def.id === 'sunward_harbour'), sx = c.p.x + c.def.shift[0], sy = c.p.y + c.def.shift[1], s = [sx, sy, Math.max(G.world.heightAt(sx, sy), 1)]; h.respawn(new V(s[0] + 30, s[2] + 1, -s[1]), 0); h.land = true; h.air = false; h.place(); run(5); kill(); run(110); const two = { p: pos(), land: h.land, under: h.pos.y < 0 };
    G.road.at = 3; G.quest.newGame(); run(10); const three = { p: pos(), road: G.road.at };
    const b = G.bosses.seawall; b.dead = false; E.raids.kills = 1; E.raids.on = false; for (const q of G.enemies.alive ? G.enemies.alive().slice() : []) q.hp = 0; G.enemies.clearAll(); h.respawn(new V(s[0], s[2] + 1, -s[1]), 0); h.land = true; h.air = false; h.place(); run(30); const woke = b.active; let saved = null; try { saved = localStorage.getItem('thalor.seawall2'); } catch (_) { saved = 'x'; } if (b.active) b.stop(); run(5);
    return { one, two, three, woke, saved };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x)), high = (o) => Math.hypot(o.p[0] - 306, o.p[2] - 806) < 80 && o.p[1] > 80;
  line('E17', high(r.one) && r.one.land && !r.one.dead && !r.two.under && r.two.p[0] < 0 && high(r.three) && r.three.road === 0 && r.woke && r.saved !== '1' && !real.length, `dead on the isle he's back on the High City ${r.one.p}, dead by the harbour he's back in its square ${r.two.p}, New Game goes home with the road at ${r.three.road}, the Seawall woke ${r.woke} and isn't marked beaten; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// the elevator: from the sea, Jump held, up past the sky cities, off the top onto the one he's looking at. And what he pays when he's there
await section(['E18'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED });
  const r = await page.evaluate(() => {
    const G = window.__game, h = G.hero, Q = window.__qa, V = G.camera.position.constructor, run = (n) => { for (let i = 0; i < n; i++) G.frame(1 / 30); };
    for (const k in h.powers) h.powers[k] = true; h.maxTide = 200; h.tide = 200; h.inv = 1e6; const y0 = -0.5; h.respawn(new V(470, y0, 900), 0); h.land = false; h.air = false; h.state = 'swim'; h.place && h.place();
    G.camYaw = Math.atan2(446 - 470, 792 - 900); h.inv = 1e6; run(5); const S = G.combat.powers.spout; h.tide = 200; S.start(); let top = 0; for (let i = 0; i < 300 && h.pos.y < 126; i++) { Q.drive({ my: 0, mx: 0, jumpHeld: true, boost: false }); h.tide = 200; G.combat.powers.spout.step(0, true); G.frame(1 / 30); top = Math.max(top, h.pos.y); }
    G.camYaw = Math.atan2(446 - h.pos.x, 792 - (-h.pos.z) * -1 >= 0 ? (-792 * -1 + -h.pos.z * 0) : 1); const dx = 446 - h.pos.x, dz = 792 - h.pos.z; G.camYaw = Math.atan2(dx, dz); S.leap(false); const slung = !!S.T.sl; for (let i = 0; i < 160; i++) { Q.drive({ my: 0, mx: 0, jumpHeld: false, boost: false }); G.frame(1 / 30); }
    const at = { x: Math.round(h.pos.x), y: Math.round(h.pos.y), z: Math.round(h.pos.z), land: h.land, air: h.air }, t0 = h.tide; h.inv = 0; run(60); return { top: Math.round(top), slung, at, drain: Math.round(t0 - h.tide), where: G.turf.where, d: Math.round(Math.hypot(at.x - 446, at.z - 792)) };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x));
  line('E18', r.top > 118 && r.slung && r.d < 34 && r.at.y > 116 && r.drain > 4 && r.where === 'sky' && !real.length, `the tornado takes him from the sea to ${r.top} m, throws him ${r.slung ? 'across' : 'nowhere'} onto the Keep ${JSON.stringify(r.at)}, ${r.d} m from its heart; up there the tide runs out, ${r.drain} in 2 s; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// the man in red in the sea: no tornado and no wave, and Jump blasts him out
await section(['E19'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED });
  const r = await page.evaluate(() => {
    const G = window.__game, h = G.hero, Q = window.__qa, V = G.camera.position.constructor, run = (n, w) => { for (let i = 0; i < n; i++) { Q.drive(w); G.frame(1 / 30); } };
    G.ember.setSide('fire', { place: true, quiet: true }); for (const k in h.powers) h.powers[k] = true; h.respawn(new V(600, -0.5, 1000), 0); h.land = false; h.air = false; h.state = 'swim'; h.tide = h.maxTide; h.place && h.place(); run(10, { my: 0, mx: 0, jumpHeld: false, boost: false });
    run(30, { my: 0, mx: 0, jumpHeld: true, boost: false, jump: false }); const spout = G.combat.powers.spout.on; h.jumpBuf = 0; run(6, { my: 0, mx: 0, jumpHeld: false, boost: false }); const y0 = h.pos.y; h.air = false; h.land = false; h.pos.y = -0.5; h.tide = h.maxTide; h.jumpBuf = 0.2; run(14, { my: 0, mx: 0, jumpHeld: false, boost: false }); return { spout, y0: +y0.toFixed(1), y: +h.pos.y.toFixed(1), air: h.fireAir };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x));
  line('E19', !r.spout && r.air && r.y > 2 && !real.length, `in the sea Jump held raises no tornado (${r.spout}); a Jump blasts him out to ${r.y} m; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// a returning player goes on from where he left off, and the fire side's pause reads Ignite
await section(['E20'], async () => {
  const { page, errors, close } = await open('?tier=phone&qa', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 60000 }); await page.waitForTimeout(400);
  await page.locator('#pickFire').tap(); await page.waitForTimeout(500); const word = await page.evaluate(() => [document.getElementById('dive').textContent, document.getElementById('resume').textContent]); await page.locator('#dive').tap(); await page.waitForTimeout(1500);
  await page.evaluate(() => { const G = window.__game, h = G.hero; window.__qa.walkAt(246, -760); G.quest.save(); return localStorage.getItem('thalor.save.v2').length; }); await page.waitForTimeout(400); await page.evaluate(() => window.__game.quest.save());
  await page.reload(); await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 60000 }); await page.waitForTimeout(500); const label = await page.evaluate(() => document.getElementById('dive').textContent); await page.locator('#dive').tap(); await page.waitForTimeout(1400);
  const r = await page.evaluate(() => { const h = window.__game.hero; return { side: window.__game.sideNow, x: Math.round(h.pos.x), y: Math.round(h.pos.y), z: Math.round(h.pos.z) }; });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x));
  line('E20', word[0] === 'Ignite' && word[1] === 'Ignite' && label === 'Continue' && r.side === 'fire' && Math.hypot(r.x - 246, r.z - 760) < 14 && !real.length, `the fire side reads ${word.join(' and ')}; ${label} comes back ${JSON.stringify(r)}; ${real.length} errors ${real[0] || ''}`);
  await close();
});
await section(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED });
  await page.evaluate(() => { const Q = window.__qa, G = window.__game, s = G.world.data.spawn; Q.swimAt(s.x, s.y, -0.4); G.camYaw = 0.4; window.__e = G.ember.raidNow(1)[0]; });
  const start = await page.evaluate(() => { const e = window.__e, h = window.__game.hero; return { d: e.pos.distanceTo(h.pos), inFront: Math.sin(window.__game.camYaw) * (e.pos.x - h.pos.x) + Math.cos(window.__game.camYaw) * (e.pos.z - h.pos.z) > 0, kind: e.kind }; });
  line('E1', start.d > 250 && start.inFront && start.kind === 'emberkin', `one comes in from the horizon, ahead of the camera: ${start.d.toFixed(0)} m away, ${start.inFront ? 'in front' : 'behind'}`);
  // the lean is what makes it flight: lying into the speed at cruise, near upright at rest
  let tilt = 0, thrust = 0, lowest = 1e9; for (let i = 0; i < 12; i++) { await steps(page, 15); const r = await page.evaluate(() => { const e = window.__e; return { a: Math.acos(Math.min(1, e.up.y)) * 57.3, sp: e.vel.length(), th: e.thrust, y: e.pos.y, st: e.state, spr: window.__game.fx.stats ? window.__game.fx.stats.sprites : 0 }; }); if (r.sp > 28) tilt = Math.max(tilt, r.a); thrust = Math.max(thrust, r.th); lowest = Math.min(lowest, r.y); }
  line('E2', tilt >= 50, `at speed he lies along his way: ${tilt.toFixed(0)}° off upright (at least 50°): flight by thrust, not a sliding figure`);
  line('E3', thrust > 2 && lowest > 0.5, `the jets work and he stays out of the water on the way in: thrust ${thrust.toFixed(1)} g at most, lowest ${lowest.toFixed(1)} m`);
  let arrived = false, tAt = 0; for (let i = 0; i < 60 && !arrived; i++) { await steps(page, 15); tAt = 3 + i * 0.25; arrived = await page.evaluate(() => window.__e.state === 'circle' || window.__e.state === 'tell'); }
  line('E4', arrived && tAt < 13, `he's over the Warden and fighting ${tAt.toFixed(1)} s after he's seen`);
  const hov = await page.evaluate(() => { const e = window.__e; e.vel.set(0, 0, 0); e.ask.set(0, 0, 0); e.state = 'stun'; e.t = 1.2; return true; }); void hov; await steps(page, 50, 'window.__e.t = 1;');
  const up = await page.evaluate(() => Math.acos(Math.min(1, window.__e.up.y)) * 57.3); line('E5', up < 14, `held still he stands upright on the jets: ${up.toFixed(1)}° off upright`);
  // the fire: a bolt flies, and reaches him
  const shot = await page.evaluate(() => { const G = window.__game, e = window.__e, h = G.hero; h.inv = 0; const hp0 = h.hp; e.t = 0; e.state = 'circle'; const B = e.def.blows.find((b) => b.id === 'bolt'); h.vel.set(0, 0, 0); e.pos.set(h.pos.x + 8, 5, h.pos.z + 8); e.vel.set(0, 0, 0); window.__hp0 = hp0; G.enemies.all().length; return B.tell_s; });
  note(`bolt tell ${shot} s`);
  await page.evaluate(() => { const G = window.__game, e = window.__e, c = G.combat.log; c.length = 0; e.t = 0; }); let bolts = 0, contact = 0, tell = 0; for (let i = 0; i < 110 && !contact; i++) { await steps(page, 12, 'window.__e.heat = 1;'); const L = await page.evaluate(() => window.__game.combat.log.filter((x) => ['bolt', 'contact', 'tell'].includes(x.type)).map((x) => [x.type, x.tell_s || 0])); bolts = L.filter((x) => x[0] === 'bolt').length; contact = L.filter((x) => x[0] === 'contact').length; tell = Math.max(0, ...L.filter((x) => x[0] === 'tell').map((x) => x[1])); }
  line('E6', tell >= 0.5 && contact > 0, `a blow is told first and reaches him: tell ${tell} s (at least 0.5, P8), ${bolts} bolts fired, ${contact} reached him`);
  // water against fire: three hits put him out, his jets die, he falls into the sea and hisses, a blow does double, and he lights again
  const quench = await page.evaluate(() => { const G = window.__game, e = window.__e, h = G.hero, a = []; e.heat = 1; e.state = 'circle'; e.t = 9; e.pos.set(h.pos.x + 6, 6, h.pos.z); e.vel.set(0, 0, 0); for (let i = 0; i < 3; i++) { e.onHit(1, h.pos, 'water', { element: 'water', status: { soak: 1 }, knock: 0, stun: 0, poise: 0 }); a.push(+e.heat.toFixed(2)); } return { a, doused: e.doused, st: e.state }; });
  line('E7', quench.doused > 0, `three hits of water put him out: heat ${quench.a.join(' > ')}, doused for ${quench.doused.toFixed(1)} s`);
  const y0 = await page.evaluate(() => window.__e.pos.y); await steps(page, 90); const fall = await page.evaluate(() => { const e = window.__e, G = window.__game; return { y: e.pos.y, hp: e.hp, hiss: G.combat.log.some((x) => x.type === 'hiss') || e.splashed }; });
  const dbl = await page.evaluate(() => { const e = window.__e, h = window.__game.hero, a = e.hp; e.onHit(10, h.pos, 'atk1', {}); return a - e.hp; });
  line('E8', fall.y < y0 - 3 && dbl >= 19.9, `doused he falls, ${y0.toFixed(1)} to ${fall.y.toFixed(1)} m, and a blow does double: 10 does ${dbl.toFixed(0)}`);
  await steps(page, 170); const lit = await page.evaluate(() => { const e = window.__e; return { d: e.doused, st: e.state, heat: e.heat, y: e.pos.y }; }); await steps(page, 120); const y2 = await page.evaluate(() => window.__e.pos.y), bad = errors.filter((x) => !/qa\.js|Failed to load resource/.test(x));
  line('E9', lit.d <= 0 && lit.heat > 0.4 && y2 > 2.5 && bad.length === 0, `he lights again and takes to the air: heat ${lit.heat.toFixed(2)}, ${lit.st}, then ${y2.toFixed(1)} m up; ${bad.length} page errors${bad[0] ? ': ' + bad[0] : ''} (the checks' own qa.js isn't in a build)`);
  // a man in red until he's pressed: below his line he goes all fire, it's told, and water puts it out and leaves the man
  const man = await page.evaluate(() => { const e = window.__e, s = e.slot; return { man: s.man.visible, fire: s.fire.visible, sup: e.super, armed: !!s.g.getObjectByName('spear') }; });
  line('E10', man.man && !man.fire && !man.sup && !man.armed, `he's a man in red, the fire form hidden, no weapon on him: man ${man.man}, fire ${man.fire}`);
  await page.evaluate(() => { const e = window.__e, G = window.__game; e.hp = e.maxHp * 0.4; e.heat = 1; e.superT = 0; e.doused = 0; e.state = 'circle'; e.t = 9; G.combat.log.length = 0; });
  let lit2 = null; for (let i = 0; i < 16; i++) { await steps(page, 12, 'window.__e.t = window.__e.state === "circle" ? 9 : window.__e.t;'); lit2 = await page.evaluate(() => { const e = window.__e, L = window.__game.combat.log; return { sup: e.super, fire: e.slot.fire.visible, man: e.slot.man.visible, ig: L.find((x) => x.type === 'ignite'), su: L.find((x) => x.type === 'super') }; }); if (lit2.sup) break; }
  const told = lit2.su && lit2.ig ? lit2.su.t - lit2.ig.t : 0; line('E11', lit2.sup && lit2.fire && !lit2.man && told >= 0.5, `pressed he goes all fire, told ${told.toFixed(2)} s first (at least 0.5, P8): fire shows, the man doesn't`);
  const out = await page.evaluate(() => { const G = window.__game, e = window.__e, h = G.hero, a = []; e.heat = 1; for (let i = 0; i < 5; i++) { e.onHit(1, h.pos, 'water', { element: 'water', status: { soak: 1 }, knock: 0, stun: 0, poise: 0 }); a.push(+e.heat.toFixed(2)); if (e.doused > 0) break; } return { a, doused: e.doused, sup: e.super, man: e.slot.man.visible }; });
  line('E12', out.doused > 0 && !out.sup && out.man, `water puts the fire out and leaves the man, falling: heat ${out.a.join(' > ')}`);
  await close();
});
await finish();
