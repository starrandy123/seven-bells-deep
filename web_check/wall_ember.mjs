// The Emberkin (EPIC V1, V2, V5, V12): a flyer's rules, read in a real page by stepping the game's own frame. A wall says the rules hold; whether it looks like a flying fighter is his call on his phone.
//   node wall_ember.mjs <base> <chromium|webkit> [--only=E1,E2]
import { gate } from './lib/h.mjs';
const { line, note, open, section, finish } = await gate('wall_ember', { budget: 150 });
const TURNED = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const steps = (page, n, each = '') => page.evaluate(([n, each]) => { const G = window.__game, f = each ? new Function('G', 'i', each) : null; for (let i = 0; i < n; i++) { if (f) f(G, i); G.frame(1 / 60); } }, [n, each]);
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
