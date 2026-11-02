// The Emberkin (EPIC V1, V2, V5, V12): a flyer's rules, read in a real page by stepping the game's own frame. A wall says the rules hold; whether it looks like a flying fighter is his call on his phone.
//   node wall_ember.mjs <base> <chromium|webkit> [--only=E1,E2]
import { gate } from './lib/h.mjs';
const { line, note, open, section, finish } = await gate('wall_ember', { budget: 230 });
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
// fire on the ground: a line that runs and stops, water that puts it out and won't let it catch, ice that holds and goes, and all of it gone in time
await section(['E21'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&qa', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => window.__game && window.__game.booted && window.__game.dmg, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const G = window.__game, S = { x: -362, z: 556 }, g = G.world.heightAt(S.x, -S.z), V = G.hero.pos.constructor, run = (s) => { let top = 0; for (let t = 0; t < s; t += 0.2) { G.dmg.update(0.2, S.x - 14, S.z - 14); top = Math.max(top, G.dmg.burning); } return top; };
    G.hero.pos.set(S.x - 14, g + 1, S.z - 14); G.dmg.hit(new V(S.x, g + 0.5, S.z), 3, 'fire', 1); const top = run(30), c = G.dmg.count, black = G.dmg.cell(S.x + 1, S.z + 1);
    G.dmg.hit(new V(S.x - 20, g + 0.5, S.z - 2), 5, 'water', 1); const wet = G.dmg.cell(S.x - 20, S.z - 2); G.dmg.hit(new V(S.x - 20, g + 0.5, S.z - 2), 2, 'fire', 1); run(3); const wet2 = G.dmg.cell(S.x - 20, S.z - 2);
    G.dmg.hit(new V(S.x - 8, g + 0.5, S.z - 12), 4, 'ice', 1); const ice = G.dmg.cell(S.x - 8, S.z - 12); run(20); const iceAfter = G.dmg.cell(S.x - 8, S.z - 12); run(90); const after = G.dmg.count;
    return { top, c, black, wet, wet2, ice, iceAfter, after };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x));
  line('E21', r.top >= 15 && r.top <= 60 && r.c.burning === 0 && r.c.burnt > 60 && r.c.burnt < 900 && r.black.scorch > 200 && r.wet.wet > 10 && r.wet2.st !== 2 && r.ice.frost > 200 && r.iceAfter.frost === 0 && r.after.burnt === 0 && !real.length, `${r.top} cells at the peak, ${r.c.burnt} burnt and out of ${r.c.fuel} fuel; soaked ground took no fire (${r.wet2.st}); frost ${r.ice.frost} then ${r.iceAfter.frost}; ${r.after.burnt} still burnt after two minutes; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// the flight law: the stick points him, Fly pushes him along the nose, let go and he hovers
await section(['E22'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const G = window.__game, Q = window.__qa, h = G.hero, V = h.pos.constructor, step = (s) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) G.frame(1 / 60); }, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    G.ember.setSide('fire', { place: false, quiet: true }); const up = (y = 80) => { h.endFly(); h.pos.set(700, y, 300); h.prev.copy(h.pos); h.vel.set(0, 0, 0); h.air = true; h.land = false; h.fireAir = true; h.launchT = 9; };
    up(); G.camYaw = 0.5; Q.drive({ boost: true, mx: 0, my: 0 }); step(3); const y0 = h.nYaw, a = { fly: h.fly, sp: h.vel.length(), turn: Math.abs(wrap(h.heading - 0.5)) };
    Q.drive({ boost: true, mx: 1, my: 0 }); step(1.6); let slip = 0; for (let i = 0; i < 90; i++) { G.frame(1 / 60); slip = Math.max(slip, Math.acos(Math.min(1, h.vel.clone().normalize().dot(h.noseV)))); } const b = { turned: wrap(y0 - h.nYaw), bank: h.nBank, slip: slip * 57.3 };
    Q.drive({ boost: true, mx: 0, my: 0 }); step(2); const c = { bank: h.nBank };
    Q.drive({ boost: false, mx: 0, my: 0 }); step(4.5); const d = { sp: h.vel.length(), fly: h.fly };
    const p0 = h.nPitch; Q.drive({ boost: false, mx: 0, my: -1 }); step(0.5); const e = { up: h.nPitch - p0 }; Q.drive({ boost: false, mx: 0, my: 0 }); step(1); const p1 = h.nPitch; G.settings.invertFlight = true; Q.drive({ boost: false, mx: 0, my: -1 }); step(0.4); e.inv = h.nPitch - p1; G.settings.invertFlight = false; Q.drive({ boost: false, mx: 0, my: 0 }); step(0.3);
    G.combat.log.length = 0; const y1 = h.pos.y; Q.drive({ boost: false, mx: 0, my: 0, jumpHeld: true }); step(2); const f = { fell: y1 - h.pos.y, dodges: G.combat.log.filter((x) => x.type === 'air_dodge').length }; Q.drive({ boost: false, mx: 0, my: 0, jumpHeld: false }); step(0.3);
    up(); G.camYaw = 0; Q.drive({ boost: true, mx: 0, my: 1 }); step(0.8); const g = { pitch: h.nPitch, latch: h.latch };
    return { a, b, c, d, e, f, g };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x)), { a, b, c, d, e, f, g } = r;
  line('E22', a.fly && a.sp > 20 && a.turn < 0.02 && b.turned > 0.6 && b.bank > 0.9 && b.slip < 10 && Math.abs(c.bank) < 0.05 && d.sp < 1 && d.fly && e.up > 0.1 && e.inv < -0.05 && f.fell > 4 && !f.dodges && g.pitch > -0.02 && !real.length, `Fly alone flew straight at ${a.sp.toFixed(0)} m/s; full stick turned ${(b.turned * 57.3).toFixed(0)}° on a ${(b.bank * 57.3).toFixed(0)}° bank with the nose ${b.slip.toFixed(1)}° off his path; wings came level (${(c.bank * 57.3).toFixed(1)}°); let go: ${d.sp.toFixed(2)} m/s, still flying; pull back raised the nose ${(e.up * 57.3).toFixed(0)}°, inverted ${(e.inv * 57.3).toFixed(0)}°; Jump held fell ${f.fell.toFixed(1)} m with ${f.dodges} dodges; a thumb held up through the start kept the nose at ${(g.pitch * 57.3).toFixed(0)}°; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// a building marked where it's hit, and whole again in time
await section(['E23'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&qa', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => window.__game && window.__game.booted && window.__game.dmg, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const G = window.__game, W = G.world, V = G.hero.pos.constructor, mat = new (G.camera.matrixWorld.constructor)(); let best = null;
    for (const m of W.cityMeshes) { const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, mat); const b = g.boundingBox.clone().applyMatrix4(mat); if (b.max.y - b.min.y < 8 || b.min.y < 1) continue; const d = Math.hypot((b.min.x + b.max.x) / 2 + 372, b.min.z - 528); if (!best || d < best.d) best = { d, b, m, i }; } }
    const b = best.b; G.hero.pos.set((b.min.x + b.max.x) / 2, b.min.y + 1, b.min.z - 10); G.dmg.hit(new V((b.min.x + b.max.x) / 2, b.min.y + 2, b.min.z - 0.15), 2.4, 'fire', 1); G.dmg.update(0.25, G.hero.pos.x, G.hero.pos.z);
    const slot = best.m.geometry.attributes.aDmg.array[best.i * 4], T = G.look.uniforms.tOcDmg.value.image.data; let ink = 0; if (slot) for (let k = (slot - 1) * 4096; k < slot * 4096; k++) if (T[k]) ink++;
    for (let t = 0; t < 130; t += 0.25) G.dmg.update(0.25, G.hero.pos.x, G.hero.pos.z);
    return { slot, ink, after: best.m.geometry.attributes.aDmg.array[best.i * 4] };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x));
  line('E23', r.slot > 0 && r.ink > 100 && r.after === 0 && !real.length, `a fire blow marks the wall (slot ${r.slot}, ${r.ink} values in its tile) and two minutes later it's whole again (slot ${r.after}); ${real.length} errors ${real[0] || ''}`);
  await close();
});
// the Tidecaller's tornado: by the sea it takes a man who stays and drags him under, never to his death; flown out of during its tell it takes nobody; inland it never comes
await section(['E24'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const G = window.__game, Q = window.__qa, h = G.hero, CH = G.ember.champions(), W = G.world, step = (s) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) G.frame(1 / 60); };
    G.ember.setSide('fire', { place: true, quiet: true }); G.enemies.clearAll && G.enemies.clearAll(); const home = h.pos.clone();
    let x = 439, z = 910; const hover = () => { h.endFly(); h.pos.set(x, 6, z); h.prev.copy(h.pos); h.vel.set(0, 0, 0); h.air = true; h.land = false; h.fireAir = true; h.launchT = 9; h.inv = 0; Q.drive({ boost: true, mx: 0, my: 0 }); step(0.2); Q.drive({ boost: false, mx: 0, my: 0 }); step(0.5); };
    const ph = G.combat.data.champions.phases, keep = ph.map((p) => p.moves.slice()); ph.forEach((p) => (p.moves = ['spout', 'volley', 'combo']));
    hover(); const e = CH.start('water'); h.hp = h.maxHp; G.combat.log.length = 0; let tellAt = 0, strikeAt = 0, t = 0, dragged = 0;
    for (let i = 0; i < 60 * 40 && !dragged; i++) { G.frame(1 / 60); t += 1 / 60; if (!G.combat.log.some((q) => q.type === 'spout_grab')) h.hp = Math.max(h.hp, 60); if (e.B.move === 'spout' && e.B.st === 'tell' && !tellAt) tellAt = t; if (e.B.move === 'spout' && e.B.st === 'strike' && !strikeAt) strikeAt = t; if (G.combat.log.some((q) => q.type === 'dragged')) dragged = t; }
    const a = { tell: strikeAt - tellAt, dragged: !!dragged, hp: h.hp, dis: G.turf.disarmed, jets: G.turf.jetsDead(), L: G.combat.log.map((q) => q.type + '@' + q.t.toFixed(2)).slice(-10).join(' '), now: G.time.toFixed(2), y: h.pos.y.toFixed(1) };
    step(0.3); G.combat.log.length = 0; Q.drive({ wave: true }); step(0.1); Q.drive({}); step(0.2); Q.drive({ dash: true }); step(0.1); Q.drive({}); a.denied = G.combat.log.filter((q) => q.type === 'denied').length;
    Q.drive({ jump: true }); step(0.1); Q.drive({}); step(0.2); a.stayed = h.pos.y < 0.5; step(1.0); Q.drive({ jump: true }); step(0.1); Q.drive({}); step(0.4); a.out = h.pos.y; a.inv = h.inv;
    // again, and this time he flies off across it as soon as it's told
    e.B.spoutAt = 0; e.B.move = 'volley'; e.B.st = 'open'; e.B.t = 0.1; hover(); G.combat.log.length = 0; let told = false, b = { grabbed: false, through: false };
    for (let i = 0; i < 60 * 40; i++) { G.frame(1 / 60); h.hp = Math.max(h.hp, 60); if (e.B.move === 'spout' && e.B.st === 'tell' && !told) { told = true; G.camYaw = 1.2; Q.drive({ boost: true, mx: 0, my: 0 }); } if (told && e.B.move !== 'spout') { b.through = true; break; } }
    Q.drive({}); b.grabbed = G.combat.log.some((q) => q.type === 'spout_grab'); b.told = told;
    // inland: no water to raise it from
    G.champ = null; for (const o of G.enemies.all ? G.enemies.all() : []) if (o.champ) o.hp = 0; step(0.5); h.endFly(); Q.walkAt(home.x, -home.z); const inland = W.heightAt(home.x, -home.z); let deepNear = false; for (let r = 0; r <= 14; r += 4.5) for (let k = 0; k < 8; k++) if (W.heightAt(home.x + Math.cos(k * 0.785) * r, -(home.z + Math.sin(k * 0.785) * r)) < -3) deepNear = true;
    const e2 = CH.start('water'); const seen = new Set(); for (let i = 0; i < 60 * 30; i++) { G.frame(1 / 60); h.hp = h.maxHp; if (e2 && e2.B.move) seen.add(e2.B.move); }
    ph.forEach((p, i) => (p.moves = keep[i]));
    return { a, b, c: { seen: [...seen], inland, deepNear } };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x)), { a, b, c } = r;
  line('E24', a.tell >= 1.99 && a.dragged && a.hp >= 1 && a.hp <= 71 && a.dis > 2.5 && a.jets && a.denied >= 1 && a.stayed && a.out > 3 && b.told && !b.grabbed && b.through && !c.deepNear && !c.seen.includes('spout') && !real.length, `${real.length || !a.dragged || a.dis < 2.5 ? JSON.stringify([a.L, a.now, a.y]) : ''} told ${a.tell.toFixed(2)} s on the water, then it took him and dragged him under: ${a.hp.toFixed(0)} HP left, disarmed ${a.dis.toFixed(1)} s, a power refused ${a.denied}×, the first Jump kept him in (${a.stayed}), the one after 1.6 s took him out to ${a.out.toFixed(1)} m; flown off at its tell: taken ${b.grabbed}; inland (bed ${c.inland.toFixed(0)} m, sea near ${c.deepNear}) he chose ${c.seen.join(' ')}; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// turf for foes: fire won't go into the sea after a man under it and fights him on it from range, holding 7 m up; a fire animal thrown in the sea scrambles out; a hilltop isn't the sky and a sky city is
await section(['E25'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const G = window.__game, Q = window.__qa, h = G.hero, W = G.world, step = (s, f) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) { G.frame(1 / 60); f && f(); } };
    const s = W.data.spawn; Q.swimAt(s.x, s.y, -5); h.inv = 1e6; const foes = G.ember.raidNow(2) || []; let low = 1e9, outSeen = false; G.combat.log.length = 0;
    step(30, () => { Q.swimAt(s.x, s.y, -5); for (const e of foes) { if (e.hp <= 0) continue; if (W.heightAt(e.pos.x, -e.pos.z) < -0.5 && e.state !== 'dead' && e.doused <= 0 && e.state !== 'swimTo') low = Math.min(low, e.pos.y); if (e.out) outSeen = true; } });
    const under = G.combat.log.filter((q) => q.type === 'tell').map((q) => q.blow), panics = G.combat.log.filter((q) => q.type === 'turf_panic').length;
    G.combat.log.length = 0; step(20, () => { Q.swimAt(s.x, s.y, -0.4); h.inv = 1e6; }); const surf = G.combat.log.filter((q) => q.type === 'tell').map((q) => q.blow);
    for (const e of foes) e.hp = 0; G.enemies.clearAll && G.enemies.clearAll(); step(0.5);
    const m = G.enemies.spawn('monitor', h.pos.clone().set(400, 5, 700)); let flee = 0, outT = -1; if (m) { let x = m.pos.x; const z = m.pos.z; for (let i = 0; i < 300 && W.heightAt(x, -z) > -0.8; i++) x += 1; m.pos.set(x, 0.2, z); m.vel.set(0, 0, 0); G.combat.log.length = 0; let t = 0; step(4, () => { t += 1 / 60; if (outT < 0 && W.heightAt(m.pos.x, -m.pos.z) > 0.3) outT = t; }); flee = G.combat.log.filter((q) => q.type === 'turf_flee').length; }
    G.ember.setSide('water', { place: false, quiet: true }); let hill = null; for (let i = 0; i < 4000 && !hill; i++) { const x = (Math.random() - 0.5) * 2400, z = (Math.random() - 0.5) * 2400, g = W.heightAt(x, -z); if (g > 40) { let wet = false; for (let k = 0; k < 16; k++) if (W.heightAt(x + Math.cos(k * 0.39) * 60, -(z + Math.sin(k * 0.39) * 60)) < -0.5) wet = true; if (!wet) hill = { x, z, g }; } }
    let onHill = 'none'; if (hill) { Q.walkAt(hill.x, -hill.z); h.inv = 0; step(1.2); onHill = G.turf.where; }
    const fort = (W.data.poi || []).find((q) => q.fort || q.id === 'sky_city'); let onFort = 'none'; if (fort) { h.endFly && h.endFly(); step(1.2, () => Q.leapAt(fort.x, fort.y, fort.z + 3, 0, 0, 0)); onFort = G.turf.where; }
    return { low, outSeen, under, panics, surf, m: !!m, flee, outT, hill: !!hill, onHill, onFort };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x)), q = r;
  line('E25', q.low >= 6 && q.outSeen && !q.under.length && q.surf.length >= 3 && !q.surf.some((b) => b !== 'bolt' && b !== 'strafe') && q.m && q.flee >= 1 && q.outT > 0 && q.outT < 3 && q.hill && q.onHill !== 'sky' && q.onFort === 'sky' && !real.length, `two fire flyers over a man 5 m under the sea, far out: lowest ${q.low.toFixed(1)} m over open water, ${q.panics} panics up, out of their element ${q.outSeen}, ${q.under.length} blows told at him; at the surface ${q.surf.length} blows, all from range (${[...new Set(q.surf)].join(' ')}); a monitor thrown in the sea fled ${q.flee}× and was out in ${q.outT.toFixed(2)} s; a hilltop reads '${q.onHill}', the sky city '${q.onFort}'; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// the Spatter Newt: it can't see, so it goes for thumps. A man running near it is lobbed at, a man hanging quiet over it isn't; after three lobs its glands go dark and a blow does double; stoked past its heat they burst
await section(['E26'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const G = window.__game, Q = window.__qa, h = G.hero, W = G.world, V = h.pos.constructor, step = (s, f) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) { G.frame(1 / 60); f && f(i); } };
    G.ember.setSide('fire', { place: true, quiet: true }); for (const q of G.enemies.encounters) q.cleared = true; G.enemies.clearAll && G.enemies.clearAll(); const c = new V(456, 0, 862); let bx = 0, bz = 0;
    for (let rr = 10; rr < 40 && !bx; rr += 2) for (let k = 0; k < 16; k++) { const x = c.x + Math.cos(k * 0.39) * rr, z = c.z + Math.sin(k * 0.39) * rr; if (G.newts.lavaAt(x, z) > 3 && W.heightAt(x, -z) > 1) { bx = x; bz = z; break; } }
    const e = G.enemies.spawn('newt', new V(bx, W.heightAt(bx, -bz) + 0.3, bz)); const g0 = W.heightAt(bx, -bz);
    // quiet: hanging in the air 8 m off it, still
    const hang = () => { h.endFly(); h.pos.set(bx + 8, g0 + 9, bz); h.prev.copy(h.pos); h.vel.set(0, 0, 0); h.air = true; h.land = false; h.fireAir = true; h.launchT = 9; h.inv = 1e6; };
    hang(); Q.drive({ boost: true }); step(0.2); Q.drive({}); G.combat.log.length = 0; step(8, () => { h.inv = 1e6; }); const quiet = G.combat.log.filter((q) => q.type === 'lob' || (q.type === 'tell' && q.foe === 'newt')).length;
    // loud: running about on the ground 9 m off
    h.endFly(); Q.walkAt(e.pos.x + 9, -e.pos.z); G.combat.log.length = 0; step(20, (i) => { h.inv = 1e6; h.hp = h.maxHp; const dx = h.pos.x - e.pos.x, dz = h.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1, tx = -dz / d, tz = dx / d, rx = tx - (dx / d) * (d - 9) * 0.3, rz = tz - (dz / d) * (d - 9) * 0.3, sn = Math.sin(G.camYaw), cs = Math.cos(G.camYaw); Q.drive({ mx: -(rx * cs - rz * sn) * 0.8, my: (rx * sn + rz * cs) * 0.8 }); });
    Q.drive({}); const lobs = G.combat.log.filter((q) => q.type === 'lob').length, spent = G.combat.log.filter((q) => q.type === 'newt_spent').length, contacts = G.combat.log.filter((q) => q.type === 'contact' && q.foe === 'newt').length;
    // a blow on spent glands does double; then stoked by fire, they burst
    e.spent = 4; let a0 = e.hp; e.onHit(10, h.pos, 'atk1', { element: 'water' }); const soft = a0 - e.hp; e.spent = 0; e.heat = 0.8; e.hp = e.maxHp; G.combat.log.length = 0; e.onHit(1, h.pos, 'atk1', { element: 'fire' }); const burst = G.combat.log.some((q) => q.type === 'newt_spent');
    return { at: [bx | 0, bz | 0], quiet, lobs, spent, contacts, soft, burst, dbg: [e.lobs, e.spent, e.state, G.combat.log.filter((q) => q.foe === 'newt').map((q) => q.type + (q.blow ? ':' + q.blow : '')).slice(0, 14).join(' ')] };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x)), q = r;
  line('E26', q.at[0] !== 0 && q.quiet === 0 && q.lobs >= 3 && q.spent >= 1 && q.soft >= 19.9 && q.burst && !real.length, `hanging quiet 8 m off it for 8 s: ${q.quiet} blows; running round it 9 m off for 20 s: ${q.lobs} lobs, ${q.contacts} reached him, glands spent ${q.spent}×; a blow on spent glands: 10 did ${q.soft.toFixed(0)}; stoked past its heat its glands burst: ${q.burst}; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// in flight the hands hold one place against the chest whatever the flight is doing, his and the Emberkin's, and the jets are short: about six nozzle widths at full thrust (Randy, 2 Nov: "The jet propulsion stream is too long too and the hands needs to be consistent and flail around too much")
await section(['E27'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const G = window.__game, Q = window.__qa, h = G.hero, B = h.bones, V = h.pos.constructor, M = new (G.camera.matrixWorld.constructor)(), a = new V(), step = (s, f) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) { G.frame(1 / 60); f && f(i); } };
    G.ember.setSide('fire', { place: false, quiet: true }); h.endFly(); h.pos.set(700, 80, 300); h.prev.copy(h.pos); h.vel.set(0, 0, 0); h.air = true; h.land = false; h.fireAir = true; h.launchT = 9; h.inv = 1e6;
    const means = [], spreads = []; let jetTop = 0; const J = () => G.ember.heroJets ? G.ember.heroJets() : null;
    for (const w of [{ boost: true }, { boost: true, mx: 1 }, { boost: false }, { boost: false, mx: 0.6 }]) { const pts = []; step(2.5, (i) => { Q.drive(w); if (i < 60) return; h.root.updateMatrixWorld(true); M.copy(B.spine_3.matrixWorld).invert(); B.hand_R.getWorldPosition(a); pts.push(a.applyMatrix4(M).clone()); }); const c = pts.reduce((s, p) => s.add(p), new V()).multiplyScalar(1 / pts.length); means.push(c); spreads.push(Math.sqrt(pts.reduce((s, p) => s + p.distanceToSquared(c), 0) / pts.length)); }
    let shift = 0; for (const m of means) shift = Math.max(shift, m.distanceTo(means[0]));
    Q.drive({}); const L = G.ember.jetLengths ? G.ember.jetLengths() : null;
    G.ember.setSide('water', { place: false, quiet: true }); const s = G.world.data.spawn; Q.swimAt(s.x, s.y, -0.4); h.inv = 1e6; const e = (G.ember.raidNow(1) || [])[0]; const by = {}; if (e) e.slot.g.traverse((o) => { if (o.isBone) by[o.name] = o; });
    let last = '', since = 0, top = 0, prev = null, n = 0; const pts = [];
    step(20, () => { Q.swimAt(s.x, s.y, -0.4); h.inv = 1e6; if (!e || !by.hand_R) return; if (e.state !== last) { last = e.state; since = 0; prev = null; } since++; if (e.state !== 'circle' && e.state !== 'swimTo') return; if (since < 60) return; e.slot.g.updateMatrixWorld(true); M.copy(by.spine_3.matrixWorld).invert(); by.hand_R.getWorldPosition(a); a.applyMatrix4(M); if (prev) top = Math.max(top, a.distanceTo(prev) * 60); prev = a.clone(); pts.push(prev); n++; });
    const c = pts.length ? pts.reduce((q, p) => q.add(p), new V()).multiplyScalar(1 / pts.length) : new V(), sp = pts.length ? Math.sqrt(pts.reduce((q, p) => q + p.distanceToSquared(c), 0) / pts.length) : 1;
    return { spreads: spreads.map((x) => +x.toFixed(3)), shift: +shift.toFixed(3), L, emb: { n, spread: +sp.toFixed(3), top: +top.toFixed(2) } };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x)), q = r;
  line('E27', Math.max(...q.spreads) < 0.01 && q.shift < 0.01 && q.L && q.L.hand <= 0.61 && q.L.foot <= 1.51 && q.emb.n > 60 && q.emb.spread < 0.02 && q.emb.top < 0.5 && !real.length, `his hand against his chest through cruise, turn, hover and hover with the stick: wanders ${q.spreads.map((x) => (x * 100).toFixed(1)).join(', ')} cm, moves ${(q.shift * 100).toFixed(1)} cm between them; jets at full thrust: hands ${q.L ? q.L.hand : '?'} m, feet ${q.L ? q.L.foot : '?'} m; an Emberkin flying between blows: its hand wanders ${(q.emb.spread * 100).toFixed(1)} cm, at most ${q.emb.top} m/s, over ${q.emb.n} frames; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// the Cinder Hornets: a scout comes out to him; killed it brings nothing, let live it marks him and the swarm comes; fire that isn't a fist burns a wing and it drops; a cruising flyer leaves them behind
await section(['E28'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const G = window.__game, Q = window.__qa, h = G.hero, V = h.pos.constructor, HN = G.hornets, L = () => G.combat.log, has = (t) => L().some((q) => q.type === t), step = (s, f) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) { G.frame(1 / 60); f && f(i); } };
    G.ember.setSide('fire', { place: true, quiet: true }); G.enemies.clearAll && G.enemies.clearAll(); for (const q of G.enemies.encounters) q.cleared = true; h.inv = 1e6; const N = HN.nest;
    const out = Math.atan2(N.x - 300, N.z - 800), ox = Math.sin(out), oz = Math.cos(out); const hang = () => { h.endFly(); h.pos.set(N.x + ox * 22, Math.max(N.y, 4) + 9, N.z + oz * 22); h.prev.copy(h.pos); h.vel.set(0, 0, 0); h.air = true; h.land = false; h.fireAir = true; h.launchT = 9; Q.drive({ boost: true }); step(0.1); Q.drive({}); };
    L().length = 0; hang(); let t = 0; for (let i = 0; i < 60 * 10 && !(HN.S.scout && HN.S.scout.state === 'mark'); i++) { G.frame(1 / 60); h.inv = 1e6; } const scoutOut = has('scout_out'), sc = HN.S.scout;
    // the scout killed with two ordinary blows: nothing comes
    let killed = false; if (sc) { sc.onHit(16, h.pos, 'atk1', { melee: true, element: 'fire' }); const after1 = sc.hp > 0; sc.onHit(16, h.pos, 'atk2', { melee: true, element: 'fire' }); killed = after1 && sc.hp <= 0; }
    L().length = 0; step(10, () => { h.inv = 1e6; }); const quiet = !has('swarm');
    // another, let live: it marks him and the nest comes
    HN.S.cool = 0; L().length = 0; let marked = -1, swarm = -1; t = 0; step(26, () => { t += 1 / 60; h.inv = 1e6; h.hp = h.maxHp; if (marked < 0 && has('marked')) marked = t; if (swarm < 0 && has('swarm')) swarm = t; });
    const members = HN.list.filter((q) => q.on && q.hp > 0 && (q.state === 'swarm' || q.state === 'tell' || q.state === 'strike')).length, blows = L().filter((q) => q.type === 'tell' && q.foe === 'hornet').map((q) => q.blow);
    // a fire blast that isn't a fist: the wings go and it drops
    const one = HN.list.find((q) => q.on && q.hp > 0 && q.state !== 'guard'); let burnt = false; if (one) { one.onHit(4, h.pos, 'fireball', { melee: false, element: 'fire' }); burnt = one.state === 'fall' && one.hp <= 0; }
    // he cruises away and they're left behind
    L().length = 0; G.camYaw = Math.atan2(h.pos.x - N.x, h.pos.z - N.z); const away = Math.PI / 2; h.nYaw = away; h.heading = away; h.nPitch = 0.08; h.pos.y = Math.max(h.pos.y, 28); h.prev.copy(h.pos); Q.drive({ boost: true, mx: 0, my: 0 }); let far = 0; step(14, () => { h.inv = 1e6; far = Math.max(far, Math.hypot(h.pos.x - N.x, h.pos.z - N.z)); }); Q.drive({}); const gaveUp = has('swarm_off'), dbg = { far: far | 0, sp: +h.speed.toFixed(1), y: +h.pos.y.toFixed(1), where: G.turf.where, fly: h.fly, S: HN.S.swarm, lost: +HN.S.lost.toFixed(1) };
    return { scoutOut, killed, quiet, marked: +marked.toFixed(2), swarm: +swarm.toFixed(2), members, blows: [...new Set(blows)], burnt, gaveUp, dbg };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x)), q = r;
  line('E28', q.scoutOut && q.killed && q.quiet && q.marked > 0 && q.swarm > q.marked && q.swarm - q.marked < 9 && q.members >= 4 && q.burnt && q.gaveUp && !real.length, `a scout came out (${q.scoutOut}); killed in two blows (${q.killed}) nothing followed (${q.quiet}); the next marked him at ${q.marked} s and the swarm came at ${q.swarm} s, ${q.members} strong, telling ${q.blows.join(' ')}; a fire blast burnt one's wings (${q.burnt}); cruising away he lost them (${q.gaveUp}) ${q.gaveUp ? '' : JSON.stringify(q.dbg)}; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// the Tephra Winder: under the ash it can't be struck; close in and it comes up and strikes after its tell; sidewinding, the parts of it on the ground hold still while it goes
await section(['E29'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const G = window.__game, Q = window.__qa, h = G.hero, W = G.world, L = () => G.combat.log, step = (s, f) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) { G.frame(1 / 60); f && f(i); } };
    G.ember.setSide('fire', { place: true, quiet: true }); for (const q of G.enemies.encounters) q.cleared = true; G.enemies.clearAll && G.enemies.clearAll();
    const c = G.winders.apron(), e = G.enemies.spawn('winder', c.clone()); e.state = 'patrol'; Q.walkAt(c.x + 30, -c.z); h.inv = 1e6; step(3, () => { h.inv = 1e6; });
    const buried = e.state === 'buried' && !G.enemies.alive().includes(e);
    L().length = 0; Q.walkAt(e.pos.x + 6, -e.pos.z); let tell = 0; step(3, () => { h.inv = 1e6; const q = L().find((x) => x.type === 'tell' && x.foe === 'winder'); if (q && !tell) tell = q.tell_s; });
    const ambush = L().some((x) => x.type === 'ambush'), struck = L().some((x) => x.type === 'contact' && x.foe === 'winder');
    // sidewinding: watch the joints on the ground and how far they slide while the body moves
    const T = e.slot.mat.U.uPath.value.image.data, row = e.slot.row, prev = []; let slide = 0, n = 0, moved = 0; e.state = 'patrol'; e.home.set(e.pos.x + 30, e.pos.y, e.pos.z + 10); Q.walkAt(e.pos.x - 60, -e.pos.z); const p0 = e.pos.clone();
    step(3, (i) => { h.inv = 1e6; for (let j = 0; j < 16; j++) { const o = (row * 16 + j) * 4, x = T[o], y = T[o + 1], z = T[o + 2], g = W.heightAt(x, -z), down = y - g < 0.125; if (prev[j] && prev[j].down && down && i > 20) { slide += Math.hypot(x - prev[j].x, z - prev[j].z) * 60; n++; } prev[j] = { x, z, down }; } });
    moved = e.pos.distanceTo(p0) / 3;
    return { buried, ambush, tell, struck, slip: n ? slide / n : -1, speed: moved, contacts: n };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x)), q = r;
  line('E29', q.buried && q.ambush && q.tell >= 0.69 && q.speed > 2 && q.slip >= 0 && q.slip < q.speed * 0.35 && !real.length, `buried it can't be struck (${q.buried}); close in and it came up (${q.ambush}) with a ${q.tell} s tell, reached him ${q.struck}; sidewinding at ${q.speed.toFixed(1)} m/s its joints on the ground slid ${q.slip.toFixed(2)} m/s on average over ${q.contacts} contacts; ${real.length} errors ${real[0] || ''}`);
  await close();
});
// the open sea: heights by wind where Beaufort's table has them, whitecaps on the share of the sea Monahan measured, no crest looping over, and a swimmer riding the surface that's drawn
await section(['E30'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone&film&qa', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const G = window.__game, Q = window.__qa, h = G.hero, S = G.sky.waves, out = {};
    for (const U of [4.6, 7, 9]) {
      G.sky.wind = U; for (let f = 0; f < 20; f++) G.frame(1 / 60); const W = S.W; let hs = 0, n = 0, white = 0; const cut = G.sky.above.material.uniforms.ocCapK.value;
      for (let i = 0; i < 20000; i++) { const x = Math.random() * 2000, z = Math.random() * 2000, t = Math.random() * 1000; let jxx = 1, jzz = 1, jxz = 0, y = 0; for (let k = 0; k < 6; k++) { const w = W[k], kk = Math.hypot(w.x, w.y), th = x * w.x + z * w.y + t * w.z, s = Math.sin(th); jxx -= S.Q[k] * w.w * (w.x / kk) * w.x * s; jzz -= S.Q[k] * w.w * (w.y / kk) * w.y * s; jxz -= S.Q[k] * w.w * (w.x / kk) * w.y * s; y += w.w * s; } if (jxx * jzz - jxz * jxz < cut) white++; hs += y * y; n++; }
      out[U] = { Hs: 4 * Math.sqrt(hs / n), white: white / n, want: 3.84e-6 * U ** 3.41, loops: W.reduce((s, w, k) => s + S.Q[k] * Math.hypot(w.x, w.y) * w.w, 0) };
    }
    // a swimmer on the open sea rides it: his height follows the surface the CPU reads, which is the GPU's
    G.sky.wind = 8; const sp = G.world.data.spawn; let far = 0, rise = [1e9, -1e9]; Q.swimAt(sp.x, sp.y, -0.3); h.inv = 1e6;
    for (let f = 0; f < 240; f++) { G.frame(1 / 60); const y = G.sky.waveAt(h.pos.x, h.pos.z); rise[0] = Math.min(rise[0], y); rise[1] = Math.max(rise[1], y); far = Math.max(far, Math.abs(h.pos.y - y)); }
    return { out, swim: { far, range: rise[1] - rise[0] } };
  });
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x)), o = r.out, ok = (U, lo, hi) => o[U].Hs >= lo && o[U].Hs <= hi && o[U].white > o[U].want * 0.4 && o[U].white < o[U].want * 2.5 && o[U].loops <= 1;
  line('E30', ok(4.6, 0.4, 1.0) && ok(7, 0.8, 1.6) && ok(9, 1.7, 2.6) && !real.length, `significant height by wind: 4.6 m/s ${o[4.6].Hs.toFixed(2)} m (Beaufort 3: 0.6), 7 m/s ${o[7].Hs.toFixed(2)} m (4: 1.0-1.5), 9 m/s ${o[9].Hs.toFixed(2)} m (5: 2.0-2.5); whitecap cover ${[4.6, 7, 9].map((U) => (o[U].white * 100).toFixed(2) + '% for ' + (o[U].want * 100).toFixed(2) + '%').join(', ')} (Monahan); steepness sums ${[4.6, 7, 9].map((U) => o[U].loops.toFixed(2)).join(', ')} (under 1: no loops); a swimmer's surface moved ${r.swim.range.toFixed(2)} m in 4 s; ${real.length} errors ${real[0] || ''}`);
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
