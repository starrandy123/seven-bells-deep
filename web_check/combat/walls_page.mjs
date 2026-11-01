// The real game, headless, the draw stubbed, stepped one fixed frame at a time. Every line drives the real input path and reads the real state.
//   node walls_page.mjs [port=8812] [only=regex] [tier=phone]
import { rig } from './rig.mjs'; import { STAGE, SHOTS } from './scenarios.mjs';
const [port = '8791', only = '', tier = 'phone', engine = 'chromium'] = process.argv.slice(2);
const r = await rig({ port: +port, tier, limit: 170, engine }); await r.page.evaluate(STAGE);
await r.page.evaluate(() => {
  const G = window.__game, h = G.hero, S = window.__stage; let seed = 7; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  S.spot = S.open();
  S.reset = (st = 'water', yaw = 0.6) => { seed = 7; G.enemies.clearAll(); G.combat.reset(); S.place(S.spot.x, S.spot.y, S.spot.z, yaw); h.state = 'swim'; h.dead = false; h.stun = 0; h.hp = h.maxHp = 1e5; h.tide = h.maxTide = 1e5; h.inv = 0; G.hitstop = 0; h.air = false; h.land = false; h.plunge = false; G.combat.setStance(st, true); S.held = {}; for (let i = 0; i < 2; i++) S.tick(); G.combat.reset(); };
  S.tick = (p) => S.frame(0, p || null);
  // exactly one fixed step: the frame's clock runs on until the step counter moves (a frame can hold 0, 1 or 2 steps)
  { const o = h.step; S.steps = 0; h.step = (dt) => { o(dt); S.steps++; if (S.onStep) S.onStep(); }; }
  S.step = (p) => { const n = S.steps; S.tick(p); let g = 0; while (S.steps === n && g++ < 3) S.tick(); };
  S.wait = (n, fn) => { for (let i = 0; i < n; i++) { S.tick(); if (fn) fn(i); } };
  S.tough = (e, hp = 1e4) => { e.hp = e.maxHp = hp; return e; };
  S.seen = (type, id) => G.combat.log.filter((l) => l.type === type && (id === undefined || l.id === id));
});
const W = [];
const wall = (name, fn) => W.push([name, fn]);

wall('a dodge answers from every frame', () => {
  const G = window.__game, S = window.__stage, D = G.combat.data, ids = ['strike1', 'strike2', 'strike3', 'launcher', 'riposte', 'counter', 'whip', 'riptide', 'maelstrom', 'wave', 'geyser', 'lance', 'glacier', 'breath', 'parry', 'guard']; let worst = 0, at = '';
  for (const id of ids) for (const off of [0, 3, 7, 11, 16, 22]) {
    S.reset(D.moves[id].element === 'ice' ? 'ice' : 'water'); S.tough(S.foe('reaver', 3)); G.combat.startAttack(id); S.wait(off);
    if (!G.combat.cur || G.combat.cur.id !== id) continue;
    S.tick({ dodge: true }); let n = 0; while (n < 40 && !(G.combat.cur && G.combat.cur.id === 'dodge')) { S.tick(); n++; }
    if (n > worst) { worst = n; at = `${id} at frame ${off}`; }
  }
  return { ok: worst <= 12, read: `longest wait for a dodge ${worst} frames, ${(worst / 60).toFixed(2)} s (≤ 12, 0.20 s; ${at})` };
});
wall('a press a moment early still counts', () => {
  const G = window.__game, S = window.__stage; const d = G.combat.data.moves.strike1, B = G.combat.data.input.buffer_f;
  const run = (early) => { S.reset(); S.step({ atk: true }); while (G.combat.cur.f < d.cancel.strike - early - 0.5) S.step(); S.step({ atk: true }); for (let i = 0; i < early + 4; i++) S.step(); return !!G.combat.cur && G.combat.cur.id === 'strike2'; };
  const M14C = 9, inside = run(M14C), outside = !run(B + 3);   // M14c: 0.15 s, the requirement's number and never the data's, or the wall moves with what it guards
  return { ok: inside && outside, read: `a press ${M14C} frames early (M14c 0.15 s) ${inside ? 'chains' : 'is LOST'}, one ${B + 3} early ${outside ? 'is dropped' : 'still chains'} (buffer ${B} f; whiffing, so no hit-stop in it)` };
});
wall('the chain runs at the reference\'s beat', () => {
  const G = window.__game, S = window.__stage; S.reset(); S.tough(S.foe('reaver', 3)); const hits = [];
  for (let f = 0; f < 180; f++) { S.tick(f % 4 === 0 ? { atk: true } : null); if (S.seen('hit').length > hits.length) hits.push(f); }
  const gaps = hits.slice(1).map((v, i) => v - hits[i]), lo = Math.min(...gaps), hi = Math.max(...gaps);
  return { ok: gaps.length >= 3 && lo >= 18 && hi <= 42, read: `hit to hit ${lo}-${hi} frames with hit-stop, ${(lo / 60).toFixed(2)}-${(hi / 60).toFixed(2)} s (reference 0.33-0.67; ${gaps.length} gaps: ${gaps.join(' ')})` };
});
wall('a move stops nothing dead: he keeps his speed into a blow', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset(); const sp0 = 13; h.vel.set(Math.sin(h.heading) * sp0, 0, Math.cos(h.heading) * sp0);
  S.tick({ atk: true }); let worst = 1, at = 0, prev = h.vel.length(), low = 1e9; for (let f = 0; f < 34; f++) { S.tick(); const v = h.vel.length(); if (prev > 1 && v / prev < worst) { worst = v / prev; at = f; } prev = v; if (f < 10) low = Math.min(low, v); }
  return { ok: worst >= 0.78 && low >= sp0 * 0.45, read: `speed lost in one frame at most ${((1 - worst) * 100).toFixed(0)}% (≤ 22%, frame ${at}); through the wind-up it stays ≥ ${low.toFixed(1)} of ${sp0} m/s (≥ 45%)` };
});
wall('the body never snaps to a new facing', () => {
  const G = window.__game, S = window.__stage, h = G.hero; let worst = 0, at = '';
  for (const [name, press] of [['strike', { atk: true }], ['riptide', { dash: true }], ['maelstrom', { spin: true }], ['wave', { wave: true }]]) {
    S.reset(); S.tough(S.foe('reaver', -5)); let prev = h.heading, f = 0; S.onStep = () => { f++; const d = Math.abs(Math.atan2(Math.sin(h.heading - prev), Math.cos(h.heading - prev))) * 57.3; if (d > worst) { worst = d; at = `${name} step ${f}`; } prev = h.heading; }; S.step(press); for (let k = 0; k < 40; k++) S.step(); S.onStep = null;
  }
  return { ok: worst > 0.5 && worst <= 12.05, read: `turns at most ${worst.toFixed(1)}° a step, ${(worst * 60).toFixed(0)}°/s (≤ 12°, M14e 720°/s; ${at}; target behind him)` };
});
wall('a dodge chains into a blow as fast as the reference', () => {
  const G = window.__game, S = window.__stage; S.reset(); S.tough(S.foe('reaver', 4)); S.tick({ dodge: true }); let f = 0, begin = 0, hit = 0;
  for (; f < 60 && !hit; f++) { S.tick(f < 16 && f % 2 === 0 ? { atk: true } : null); if (!begin && G.combat.cur && G.combat.cur.id === 'launcher') begin = f; if (S.seen('hit').length) hit = f; }
  return { ok: begin > 0 && begin <= 20 && hit > 0 && hit <= 30, read: `blow begins ${begin} f, ${(begin / 60).toFixed(2)} s after the dodge (reference 0.33), lands ${hit} f, ${(hit / 60).toFixed(2)} s (reference 0.43); launcher` };
});
wall('dodge frames are invulnerable, and only those', () => {
  const G = window.__game, S = window.__stage, h = G.hero, d = G.combat.data.moves.dodge, bad = [];
  for (let n = 1; n <= 24; n++) { S.reset(); S.tick({ dodge: true }); S.wait(n - 1); const f = G.combat.cur ? G.combat.cur.f : 99, res = h.damage(1, h.pos.clone().add({ x: 3, y: 0, z: 0 })), want = f >= d.iframes[0] && f <= d.iframes[1] ? 'dodged' : 'hit'; if (res !== want && !(want === 'hit' && res === 'miss')) bad.push(`frame ${f.toFixed(0)}: ${res}`); }
  return { ok: bad.length === 0, read: `i-frames ${d.iframes[0]}-${d.iframes[1]} hold exactly, ${bad.length} wrong${bad.length ? ': ' + bad.slice(0, 4).join(', ') : ''}` };
});
wall('a phone player can parry a real Reaver', () => {
  const G = window.__game, S = window.__stage, h = G.hero;
  const run = (offset) => { S.reset(); h.hp = h.maxHp = 1e5; const e = S.tough(S.foe('reaver', 4)); e.state = 'circle'; e.t = 0.01; for (let f = 0; f < 120; f++) { S.tick(f === offset ? { parry: true } : null); const c = S.seen('contact'); if (c.length) return { f, res: c[0].res }; } return { f: -1, res: 'none' }; };
  const base = run(-1); let good = 0, first = 1e9, last = -1; for (let k = 2; k <= 44; k++) { const r = run(base.f - k); if (r.res === 'parried') { good++; first = Math.min(first, k); last = Math.max(last, k); } }
  return { ok: base.f > 0 && good / 60 >= 0.4, read: `parry lands for presses ${first}-${last} frames before contact, ${(good / 60).toFixed(2)} s (≥ 0.40; contact at frame ${base.f})` };
});
wall('every blow is told, in a real fight, foe by foe', () => {
  const G = window.__game, S = window.__stage, h = G.hero, out = [], silent = []; let least = 9, at = '';
  for (const [kind, F] of Object.entries(G.combat.data.foes)) { if (kind === '_doc') continue; const all = F.blows; for (const blow of all) {
    if (blow.damage === 0) continue;   // the Siren's song lands no blow; it has its own wall
    F.blows = [blow]; S.reset(); h.inv = 0; if (F.walker === 'bed') { h.pos.y = G.world.heightAt(h.pos.x, -h.pos.z) + 1.4; h.prev.copy(h.pos); }   // a crab walks the bed: it fights what comes down to it
    const e = S.tough(S.foe(kind, kind === 'moray' ? 4 : 7)); if (F.pairs) S.tough(S.foe(kind, 8, 2));
    const open = new Map(); let n = 0;
    for (let f = 0; f < 420; f++) { h.hp = 1e5; h.inv = 0.1; const before = G.combat.log.length; S.tick(); for (let i = Math.max(0, before - 1); i < G.combat.log.length; i++) { const l = G.combat.log[i]; if (l._seen) continue; l._seen = 1; if (l.type === 'tell') open.set(l.foe, l.t); if (l.type === 'contact') { const t0 = open.get(l.foe); if (t0 !== undefined) { const lead = l.t - t0; n++; if (lead < least) { least = lead; at = `${kind} ${l.blow}`; } } } } }
    F.blows = all; if (!n) silent.push(`${kind} ${blow.id}`); else out.push(`${kind} ${blow.id} ${n}`);
  } }
  return { ok: least >= 0.5 && silent.length === 0, read: `least warning ${least.toFixed(2)} s (≥ 0.50; ${at}); every blow of every kind read: ${out.length}${silent.length ? ', NEVER SEEN: ' + silent.join(', ') : ''}` };
});
for (const [name, st, press, id, dist] of [['Water Whip', 'water', { atk: true }, 'whip', 11], ['Riptide', 'water', { dash: true }, 'riptide', 9], ['Maelstrom', 'water', { spin: true }, 'maelstrom', 4], ['Tidal Wave', 'water', { wave: true }, 'wave', 12], ['Geyser', 'water', { p4: true }, 'geyser', 8], ['Frost Lance', 'ice', { dash: true }, 'lance', 14], ['Glacier', 'ice', { spin: true }, 'glacier', 9], ["Winter's Breath", 'ice', { wave: true }, 'breath', 6]]) {
  wall(`${name} fires by its button and lands`, new Function(`const G = window.__game, S = window.__stage, h = G.hero; S.reset(${JSON.stringify(st)}); const e = S.tough(S.foe('reaver', ${dist}, 0.5, 0.2)); e.state = 'stun'; e.t = 9; const hp0 = e.hp, tide0 = h.tide, d0 = e.pos.distanceTo(h.pos); S.tick(${JSON.stringify(press)}); let peak = 0; S.wait(110, () => { peak = Math.max(peak, e.vel.length()); }); const rel = S.seen('release', ${JSON.stringify(id)}).length, hit = S.seen('hit', ${JSON.stringify(id)}).length, cost = tide0 - h.tide, cd = G.combat.power(${JSON.stringify(id)}).cool; const pulled = ${JSON.stringify(id)} === 'whip' ? peak : 0;   /* its speed, not the distance: a foe walks in by itself */ return { ok: rel === 1 && hit >= 1 && e.hp < hp0 && cost >= 0 && (${JSON.stringify(id)} !== 'whip' || pulled >= 14), read: 'released ' + rel + ', ' + hit + ' hits, ' + (hp0 - e.hp).toFixed(0) + ' damage' + (${JSON.stringify(id)} === 'whip' ? ', pulled at ' + pulled.toFixed(1) + ' m/s (≥ 14)' : '') }; `));
}
wall('Ice Path: the sea freezes and holds eight seconds', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset('ice'); h.pos.set(S.spot.x, -1.3, S.spot.z); h.prev.copy(h.pos); h.vel.set(0, 0, 0); S.tick({ p4: true }); h.vel.set(5, 0, 0); S.wait(30); const n = G.icePath.plates.length, p0 = G.icePath.plates[0], x = p0 && p0.x, z = p0 && p0.z, on = p0 ? G.icePath.heightAt(x, z) : -9; let t = 0; while (t < 12 && G.icePath.heightAt(x, z) > -1) { S.tick(); t += 1 / 60; }
  return { ok: n >= 1 && on > -0.1 && Math.abs(t + 0.5 - 8) <= 0.1, read: `${n} plates, surface ${on.toFixed(2)} m, held ${(t + 0.5).toFixed(2)} s (8 ± 0.1)` };
});
wall('Frost Guard freezes what it parries', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset('ice'); const e = S.tough(S.foe('reaver', 4)); e.state = 'circle'; e.t = 0.01; let f = 0; for (; f < 120 && !S.seen('tell').length; f++) S.tick(); const b = e.blow; S.wait(Math.round(b.tell_s * 60) - 12); S.tick({ parry: true }); S.wait(30);
  return { ok: e.frozen > 0, read: `foe frozen ${e.frozen.toFixed(1)} s after the parry (> 0; ${S.seen('contact').map((c) => c.res).join(',')})` };
});
wall('Shatter: soaked, then frozen, breaks for big damage', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset('water'); const e = S.tough(S.foe('reaver', 3)); e.state = 'stun'; e.t = 9; S.tick({ atk: true }); S.wait(30); const soaked = e.soaked > 0; G.combat.setStance('ice', true); G.combat.reset(); S.tick({ dash: true }); S.wait(30); const fz = e.frozen > 0, hp0 = e.hp; S.wait(20); G.combat.reset(); S.tick({ atk: true }); S.wait(30); const log = G.combat.log.filter((l) => l.type === 'shatter');
  return { ok: soaked && fz && log.length === 1 && log[0].name === 'shatter' && hp0 - e.hp >= 16 * 1.15 * 3 * 0.99, read: `soaked ${soaked}, frozen ${fz}, ${log.map((l) => l.name)}: ${(hp0 - e.hp).toFixed(0)} damage from a ${(16 * 1.15).toFixed(0)} blow (× 3)` };
});
wall('Smash: a heavy blow breaks the merely frozen', () => {
  const G = window.__game, S = window.__stage; S.reset('ice'); const e = S.tough(S.foe('reaver', 3)); G.enemies.freeze(e); e.frozen = 3; const hp0 = e.hp; G.combat.startAttack('strike3'); S.wait(36); const log = G.combat.log.filter((l) => l.type === 'shatter');
  return { ok: log.length === 1 && log[0].name === 'smash' && hp0 > e.hp, read: `${log.map((l) => l.name)}: ${(hp0 - e.hp).toFixed(0)} damage from Overhead` };
});
wall('Flash Freeze: frost leaps between the soaked', () => {
  const G = window.__game, S = window.__stage; S.reset('ice'); const a = S.tough(S.foe('reaver', 8)), b = S.tough(S.foe('reaver', 8, 3)), c = S.tough(S.foe('reaver', 8, -3)); for (const e of [a, b, c]) { e.soaked = 8; e.state = 'stun'; e.t = 9; } S.tick({ dash: true }); S.wait(40); const n = [a, b, c].filter((e) => e.frozen > 0).length;
  return { ok: n === 3, read: `${n} of 3 frozen from one lance` };
});
wall('Capped: ice stops a geyser, until it bursts', () => {
  const G = window.__game, S = window.__stage, P = G.combat.powers; S.reset('ice'); const e = S.tough(S.foe('reaver', 10)); e.state = 'stun'; e.t = 9; const d = G.combat.data.moves.geyser, p = S.ahead(8); p.y = G.hero.pos.y - 2; const l = P.spawnGeyser(p, d, { def: d, hits: new Set() }, true); S.wait(24); const on = l.on; S.tick({ spin: true }); S.wait(40); const capped = l.capped, stoppedOn = l.on; S.wait(80); const gone = !P.lives.includes(l);
  return { ok: on && capped && !stoppedOn && gone, read: `running ${on}, capped ${capped}, flow stopped ${!stoppedOn}, burst and gone ${gone}` };
});
wall('Ice Missile: Riptide sends the frozen flying', () => {
  const G = window.__game, S = window.__stage; S.reset('water'); const e = S.tough(S.foe('reaver', 5)), o = S.tough(S.foe('reaver', 13)); o.state = 'stun'; o.t = 9; G.enemies.freeze(e); e.frozen = 3; const hpO = o.hp; S.tick({ dash: true }); S.wait(70); const log = G.combat.log.filter((l) => l.type === 'ice_missile');
  return { ok: log.length === 1 && o.hp < hpO, read: `${log.length} missile, ${(hpO - o.hp).toFixed(0)} damage to the foe it hit` };
});
wall('launcher, aerial strikes, plunge: one chain', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset(); const e = S.tough(S.foe('reaver', 3.5)); e.state = 'stun'; e.t = 9; e.poise = 1e6; const y0 = e.pos.y; S.tick({ dodge: true }); S.wait(15); S.tick({ atk: true }); let top = y0; for (let f = 0; f < 150; f++) { S.tick(f % 5 === 0 ? { atk: true } : null); top = Math.max(top, e.pos.y); } const seq = S.seen('start').map((l) => l.id).join(' > '), want = ['launcher', 'air1', 'air2', 'plunge'].every((m) => seq.includes(m));
  return { ok: want && top - y0 >= 2 && S.seen('plunge').length >= 1, read: `${seq}; foe thrown ${(top - y0).toFixed(1)} m (≥ 2)` };
});
wall('a finisher takes a staggered foe', () => {
  const G = window.__game, S = window.__stage; S.reset(); const e = S.tough(S.foe('reaver', 3)); e.poise = 1; G.combat.startAttack('strike3'); S.wait(30); const st = e.stagger > 0; S.wait(30); G.combat.reset(); const hp0 = e.hp; S.tick({ atk: true }); S.wait(40); const fin = S.seen('start', 'finisher').length;
  return { ok: st && fin === 1 && hp0 - e.hp >= 100, read: `staggered ${st}, finisher ${fin}, ${(hp0 - e.hp).toFixed(0)} damage (≥ 100)` };
});
wall('a Captain\'s shield stops blows until he is parried or frozen', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset(); const e = S.tough(S.foe('captain', 3)); e.state = 'stun'; e.t = 9; e.heading = Math.atan2(h.pos.x - e.pos.x, h.pos.z - e.pos.z); const hp0 = e.hp; S.tick({ atk: true }); S.wait(30); const held = e.hp === hp0, blocked = G.combat.log.filter((l) => l.type === 'blocked').length; G.combat.reset(); e.guardBroken = 3; S.tick({ atk: true }); S.wait(30); const through = e.hp < hp0;
  // the way in for a player who can't parry: his own recovery
  S.reset(); const c = S.tough(S.foe('captain', 3)); c.heading = Math.atan2(h.pos.x - c.pos.x, h.pos.z - c.pos.z); c.state = 'recover'; c.blow = c.def.blows[0]; c.clock = 0; c.heading = Math.atan2(h.pos.x - c.pos.x, h.pos.z - c.pos.z); const hpC = c.hp; S.tick({ atk: true }); S.wait(14); const open = c.hp < hpC;
  return { ok: held && blocked >= 1 && through && open, read: `blocked ${blocked}, shield held ${held}, through once broken ${through}, open while he recovers ${open}` };
});
wall('an Archer\'s harpoon really flies and a parry sends it back', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset(); const e = S.tough(S.foe('archer', 16)); e.state = 'circle'; e.t = 0.01; let f = 0; while (f < 200 && !S.seen('strike').length) { h.hp = 1e5; S.tick(); f++; } const flew = S.seen('strike').length === 1; let cf = 0; while (cf < 80 && e.pos.distanceTo(h.pos) / 30 * 60 - cf > 16) { S.tick(); cf++; } S.tick({ parry: true }); const hp0 = e.hp; S.wait(100); const res = S.seen('contact').map((c) => c.res).join(',');
  return { ok: flew && res.startsWith('parried') && e.hp < hp0, read: `fired ${flew}, ${res}, ${(hp0 - e.hp).toFixed(0)} damage back` };
});
wall('Hammerheads charge as a pair', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset(); const a = S.tough(S.foe('hammerhead', 12)), b = S.tough(S.foe('hammerhead', 12, 6)); for (const e of [a, b]) { e.state = 'stalk'; e.t = 0.01; } let both = false; for (let f = 0; f < 300 && !both; f++) { h.hp = 1e5; S.tick(); both = a.state === 'tell' && b.state === 'tell'; }
  return { ok: both, read: `both telling at once: ${both}` };
});
wall('hit-stop holds the bodies for the data\'s frames, and shake obeys the setting', () => {
  const G = window.__game, S = window.__stage, h = G.hero, D = G.combat.data; S.reset(); S.tough(S.foe('reaver', 3)); let hs = 0; G.combat.startAttack('strike1'); for (let f = 0; f < 20; f++) { S.tick(); hs = Math.max(hs, G.hitstop); } const light = hs; S.reset(); S.tough(S.foe('reaver', 3)); hs = 0; G.combat.startAttack('strike3'); for (let f = 0; f < 30; f++) { S.tick(); hs = Math.max(hs, G.hitstop); } const heavy = hs;
  // the instrument: how far the camera leaves the hero's own path in a frame. With shake on it must read high, or it reads nothing
  const kick = (on) => { S.reset(); G.settings = G.settings || {}; const was = G.settings.shake; G.settings.shake = on; S.tough(S.foe('reaver', 3)); let m = 0; for (let k = 0; k < 40; k++) S.tick(); G.combat.startAttack('strike3'); for (let f = 0; f < 30; f++) { const b = G.camera.position.clone(), p = h.drawPos.clone(); S.tick(); const dc = G.camera.position.clone().sub(b), dh = h.drawPos.clone().sub(p); m = Math.max(m, dc.sub(dh).length()); } G.settings.shake = was; return m; };
  const moved = kick(false), shaken = kick(true);
  return { ok: light > 0 && light <= (D.impacts.light.hitstop_f + 0.5) / 60 && heavy > light && heavy <= (D.impacts.heavy.hitstop_f + 0.5) / 60 && moved < 0.3 && shaken > moved * 2 && heavy <= 0.1001, read: `light ${(light * 1000).toFixed(0)} ms, heavy ${(heavy * 1000).toFixed(0)} ms (0.03-0.10 s); the camera leaves his path by ${moved.toFixed(3)} m a frame with shake off (< 0.3, its own follow lag), ${shaken.toFixed(3)} with it on (over twice that)` };
});
wall('a blow\'s burst starts on its contact frame', () => {
  const G = window.__game, S = window.__stage; S.reset(); S.tough(S.foe('reaver', 3)); const stamps = [], o = G.fx.impact; G.fx.impact = (...a) => { stamps.push(G.time); return o(...a); }; for (let f = 0; f < 120; f++) S.tick(f % 6 === 0 ? { atk: true } : null); G.fx.impact = o; const hits = S.seen('hit').map((l) => l.t); let off = 0; hits.forEach((t, i) => { off = Math.max(off, Math.abs(t - (stamps[i] ?? 1e9))); });
  return { ok: hits.length >= 3 && stamps.length === hits.length && off < 1 / 240, read: `${hits.length} hits, ${stamps.length} bursts, furthest apart ${(off * 1000).toFixed(1)} ms (same step)` };
});
wall('speed carries across run > blow > dodge > blow', () => {
  const G = window.__game, S = window.__stage, h = G.hero; const pairs = {}; const note = (k, a, b) => { const r = a > 0.5 ? b / a : 1; pairs[k] = Math.min(pairs[k] ?? 9, r); };
  const f4 = () => { S.step(); S.step(); S.step(); return h.vel.length(); };
  S.reset(); h.vel.set(Math.sin(h.heading) * 12, 0, Math.cos(h.heading) * 12); let v0 = h.vel.length(); S.step({ atk: true }); note('run > blow', v0, f4());
  while (G.combat.cur && G.combat.cur.f < 16) S.step(); v0 = h.vel.length(); S.step({ dodge: true }); note('blow > dodge', v0, f4());
  while (G.combat.cur && G.combat.cur.f < 14) S.step(); v0 = h.vel.length(); S.step({ atk: true }); note('dodge > blow', v0, f4());
  const worst = Math.min(...Object.values(pairs));
  return { ok: worst >= 0.8, read: Object.entries(pairs).map(([k, v]) => `${k} keeps ${(v * 100).toFixed(0)}%`).join(', ') + ' (M14d ≥ 80%)' };
});
wall('Boost held from a dodge runs on into the boost', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset(); h.boostFuel = 1; h.combatT = 0; S.tough(S.foe('reaver', 6)).state = 'stun'; S.held = {}; const go = (o) => { Object.assign(S.held, { my: 1 }, o); S.step(); }; let dodged = false, low = 99, after = 0; for (let f = 0; f < 90; f++) { go({ boost: true }); if (G.combat.cur && G.combat.cur.id === 'dodge') dodged = true; if (dodged && !G.combat.cur) { low = Math.min(low, h.vel.length()); after = h.vel.length(); } }
  S.held = {};
  return { ok: dodged && low >= 6 && after >= 12, read: `dodged ${dodged}, lowest speed after it ${low.toFixed(1)} m/s (≥ 6), then ${after.toFixed(1)} m/s boosting (≥ 12)` };
});
wall('the drawn weapon reaches what its hit box hits', () => {
  const G = window.__game, S = window.__stage, h = G.hero; const o = G.fx.pushTrail, tip = new h.pos.constructor(); G.fx.pushTrail = (a, b, on) => { tip.copy(a); return o(a, b, on); }; let worst = 0, at = '', n = 0;
  for (const id of ['strike1', 'strike2', 'strike3']) for (const d of [2.4, 3.2, 5]) { S.reset(); const e = S.tough(S.foe('reaver', d)); e.state = 'stun'; e.t = 9; G.combat.startAttack(id); for (let f = 0; f < 50 && !S.seen('hit').length; f++) { S.tick(); } if (!S.seen('hit').length) continue; n++; S.tick(); const gap = Math.max(0, tip.distanceTo(e.pos) - e.r); if (gap > worst) { worst = gap; at = `${id} from ${d} m`; } } G.fx.pushTrail = o;
  return { ok: n >= 6 && worst <= 2.2, read: `the tip ends within ${worst.toFixed(2)} m of the body it hit (≤ 2.2; ${at}; ${n} hits; P4l)` };
});
wall('at most two strike at once, and nobody opens during a finisher', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset(); for (const [k, d, s] of [['reaver', 5, 2], ['reaver', 6, -2], ['archer', 12, 3], ['archer', 13, -4], ['shark', 9, 0]]) S.tough(S.foe(k, d, s)); let most = 0; const busy = () => G.enemies.alive().filter((e) => e.state === 'tell' || e.state === 'strike').length;
  for (let f = 0; f < 1200; f++) { h.hp = 1e5; h.inv = 1; S.tick(); most = Math.max(most, busy()); }
  S.reset(); const e = S.tough(S.foe('reaver', 3)), o = S.tough(S.foe('reaver', 5, 3)); e.poise = 1; e.state = 'stun'; e.t = 9; o.state = 'circle'; o.t = 0; G.combat.startAttack('strike3'); S.wait(16); let opened = 0; if (e.stagger > 0) { S.tick({ atk: true }); const before = S.seen('tell').length; for (let f = 0; f < 30 && G.combat.cur && G.combat.cur.id === 'finisher'; f++) { o.t = 0; S.tick(); } opened = S.seen('tell').length - before; }
  return { ok: most <= 2 && most >= 1 && opened === 0, read: `most at once ${most} (≤ 2, five foes, 20 s); ${opened} tells began during a finisher (0)` };
});
wall('an attacker off screen shows on screen before it strikes', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset(); const e = S.tough(S.foe('reaver', -5)); e.state = 'circle'; e.t = 0.01; const n0 = G.fx.stats.edges; let told = 0; for (let f = 0; f < 80 && !S.seen('strike').length; f++) { h.hp = 1e5; G.camYaw = 0.6; S.tick(); if (e.state === 'tell') told++; } const marks = G.fx.stats.edges - n0;
  S.reset(); const f2 = S.tough(S.foe('reaver', 4)); f2.state = 'circle'; f2.t = 0.01; const n1 = G.fx.stats.edges; for (let f = 0; f < 70 && !S.seen('strike').length; f++) { h.hp = 1e5; G.camYaw = 0.6; S.tick(); } const inView = G.fx.stats.edges - n1;
  return { ok: told > 20 && marks >= told * 0.8 && inView === 0, read: `behind him: ${marks} marks in ${told} frames of tell; in view: ${inView} (0)` };
});
wall('a light burst is gone by 0.33 s', () => {
  const G = window.__game, S = window.__stage, h = G.hero, out = []; let worst = 0;
  for (const el of ['water', 'ice']) { S.reset(el); for (let i = 0; i < 100 && G.fx.stats.burstLive > 0; i++) S.tick(); S.wait(2); const p = S.ahead(5, 0, 0.7), d = p.clone().sub(h.pos).normalize(); const n0 = G.fx.stats.impacts; G.fx.impact(p, d, 'light', el); const a0 = G.fx.stats.impacts - n0; let t = 0, gone = 0; for (let f = 0; f < 50; f++) { S.tick(); t += 1 / 60; if (G.fx.stats.burstLive > 0) gone = t; } out.push(`${el} ${gone.toFixed(2)} s`); worst = Math.max(worst, gone); void a0; }
  return { ok: worst > 0.1 && worst <= 0.34, read: `${out.join(', ')} (≤ 0.33; P11c)` };
});
wall('every encounter: no foe under the ground, no fish out of water', () => {
  const G = window.__game, S = window.__stage, h = G.hero, H = (x, z) => G.world.heightAt(x, -z); let bad = [], count = 0, land = 0, solid = 0, woke = 0; const encs = G.enemies.encounters, rung = G.quest.isRung, q = { x: 0, y: 0, z: 0 }, kinds = {}; G.quest.isRung = () => false; G.enemies.opened = 9;
  for (const enc of encs) {
    S.reset(); h.hp = h.maxHp = 1e5; h.inv = 99; h.pos.copy(enc.c); h.pos.y = Math.min(-2, Math.max(enc.c.y, H(enc.c.x, enc.c.z) + 2)); h.prev.copy(h.pos); enc.cleared = false; enc.state = 'idle'; enc.cool = 0;
    const check = (when) => { for (const e of G.enemies.all()) { if (e.hp <= 0) continue; const g = H(e.pos.x, e.pos.z), fish = e.fishy && e.def.walker !== 'bed'; kinds[e.kind] = 1; count++; if (e.onLand) land++; q.x = e.pos.x; q.y = -e.pos.z; q.z = e.pos.y; if (G.world.collide(q, 0.05)) { solid++; bad.push(`${enc.id} ${e.kind} ${when}: inside a solid`); } if (e.pos.y < g - 0.01) bad.push(`${enc.id} ${e.kind} ${when}: ${(g - e.pos.y).toFixed(2)} m under`); if (fish && (g > -1.2 || e.pos.y > -0.5)) bad.push(`${enc.id} ${e.kind} ${when}: out of the water, bed ${g.toFixed(1)}`); if (!fish && g > -1 && Math.abs(e.pos.y - (Math.max(g, G.world.solidTop(e.pos.x, -e.pos.z, e.pos.y)) + 0.92)) > 0.5 && !(e.launched > 0)) bad.push(`${enc.id} ${e.kind} ${when}: not on its feet, ${e.pos.y.toFixed(2)} over ground ${g.toFixed(2)}`); } };
    S.wait(2); if (enc.list.length) woke++; else bad.push(`${enc.id}: nobody came`); check('at spawn'); for (let f = 0; f < 180; f++) { h.inv = 99; S.tick(); if (f % 30 === 0) check('at ' + f); }
    enc.state = 'idle'; enc.cleared = true; G.enemies.clearAll(); enc.list.length = 0;
  }
  G.quest.isRung = rung; G.enemies.opened = undefined;
  return { ok: bad.length === 0 && count > 50 && woke === encs.length && Object.keys(kinds).length >= 10, read: `${woke} of ${encs.length} encounters woke, tied ones too, ${Object.keys(kinds).length} kinds; ${count} readings, ${land} on land, ${solid} inside a solid, ${bad.length} wrong${bad.length ? ': ' + bad.slice(0, 4).join('; ') : ''}` };
});
wall('on land a foe stands on the ground, walks to him and fights', () => {
  const G = window.__game, S = window.__stage, h = G.hero, H = (x, z) => G.world.heightAt(x, -z), size = (G.world.data.size_m || 1280) / 2; let spot = null;
  // a land place: firm ground, gentle, a run of it clear of anything solid
  for (let x = -size + 20; x < size - 20 && !spot; x += 18) for (let z = -size + 20; z < size - 20 && !spot; z += 18) { let ok = true; for (let k = 0; k < 7 && ok; k++) { const a = H(x + k * 2.5, z), b = H(x + k * 2.5 + 1, z); if (a < 0.8 || Math.abs(a - b) > 0.4 || G.world.collide({ x: x + k * 2.5, y: -z, z: a + 1 }, 0.7)) ok = false; } if (ok) spot = { x, z }; }
  if (!spot) return { ok: false, read: 'no land found on this map' };
  S.reset(); G.hero.pos.set(spot.x + 16, H(spot.x + 16, spot.z) + 0.92, spot.z); h.prev.copy(h.pos); h.land = true; h.grounded = true; h.hp = h.maxHp = 1e5; h.place && h.place();
  const e = S.tough(G.enemies.spawn('reaver', new h.pos.constructor(spot.x, 0, spot.z))), f = G.enemies.spawn('shark', new h.pos.constructor(spot.x + 4, 0, spot.z)); S.tough(f); let under = 0, worstOff = 0, closed = 1e9; const start = e.pos.distanceTo(h.pos);
  for (let i = 0; i < 300; i++) { h.hp = 1e5; h.inv = 1; S.tick(); for (const q of [e, f]) { const g = H(q.pos.x, q.pos.z); if (q.pos.y < g) under++; worstOff = Math.max(worstOff, Math.abs(q.pos.y - (g + 0.92))); } closed = Math.min(closed, e.pos.distanceTo(h.pos)); }
  const told = S.seen('tell').length, res = S.seen('contact').length;
  return { ok: under === 0 && worstOff < 0.3 && f.kind === 'reaver' && closed < 5 && told >= 1 && res >= 1, read: `under the ground ${under} steps, feet off it by ${worstOff.toFixed(2)} m (< 0.30), closed ${start.toFixed(0)} m to ${closed.toFixed(1)} m, ${told} tells, ${res} blows; a shark asked for on land came as a ${f.kind}` };
});
wall('upgrades do what their levels say, and a reload can repeat them', () => {
  const G = window.__game, S = window.__stage, h = G.hero, out = [], bad = []; const say = (n, ok, r) => { out.push(`${n} ${r}`); if (!ok) bad.push(n); };
  S.reset(); h.maxHp = 100; h.hp = 100; const base = h.maxHp; G.combat.applyUpgrades({ health: 2 }); G.combat.applyUpgrades({ health: 2 }); say('health', h.maxHp === base + 50, `${base} > ${h.maxHp}`); G.combat.applyUpgrades({}); say('back', h.maxHp === base, `${h.maxHp}`);
  const lashed = (lvl) => { S.reset(); G.combat.applyUpgrades({ whip: lvl }); const e = S.tough(S.foe('reaver', 18)); e.state = 'stun'; e.t = 9; const f = S.tough(S.foe('reaver', 19, 2)); f.state = 'stun'; f.t = 9; S.tick({ atk: true }); S.wait(40); const n = S.seen('hit', 'whip').length; G.combat.applyUpgrades({}); return n; };
  const w0 = lashed(0), w3 = lashed(3); say('whip reach + two', w0 === 0 && w3 >= 2, `${w0} > ${w3} hits`);
  const spikes = (lvl) => { S.reset('ice'); G.combat.applyUpgrades({ glacier: lvl }); let n = 0; const o = G.fx.spike; G.fx.spike = (...a) => { n++; return o(...a); }; S.tick({ spin: true }); S.wait(70); G.fx.spike = o; G.combat.applyUpgrades({}); return n; };
  const g0 = spikes(0), g1 = spikes(1); say('glacier longer', g1 > g0, `${g0} > ${g1} spikes`);
  const soak = (lvl) => { S.reset(); G.combat.applyUpgrades({ wave: lvl }); const e = S.tough(S.foe('reaver', 8)); e.state = 'stun'; e.t = 9; S.tick({ wave: true }); S.wait(60); const v = e.soaked > 0; G.combat.applyUpgrades({}); return v; };
  say('wave soaks at 3', !soak(0) && soak(3), 'dry > soaked');
  return { ok: bad.length === 0, read: out.join(' · ') + (bad.length ? ' FAILED: ' + bad.join(', ') : '') };
});
wall('each boss acts through its intro, comes up close and faces the camera, and strikes no blow', () => {
  const G = window.__game, S = window.__stage, h = G.hero, A = G.world.data.arena, out = []; let bad = 0;
  for (const id of ['kraken', 'wyrm', 'colossus', 'leviathan']) {
    S.reset(); for (const k in G.bosses) G.bosses[k].stop && G.bosses[k].stop(); const b = G.bosses[id], sh = S.SHOTS['boss_' + id], C = G.combat.data.bosses[id]; if (id === 'leviathan') S.place(A.x, A.z + 14, -A.y - 6, 0.6); else S.place(S.spot.x, S.spot.y, S.spot.z, 0.6); S.wait(3); b.dead = false; b.hp = b.maxHp; G.combat.log.length = 0;
    b.wake(); const y0 = b.head.y; G.cine.play('intro', { shots: sh, focus: () => b.frame, bearing: b.bearing(), film: true }); h.cine(true); const dur = sh.reduce((a, s) => a + s.dur, 0); let t = 0, rose = 0, least = 1e9, framed = 0, seen = 0, facing = -2, blocked = 0; const v = new h.pos.constructor(), n = new h.pos.constructor(), w = new h.pos.constructor();
    while (G.cine.active && t < 12) { S.tick(); t += 1 / 60; if (b.mode === 'rise') rose = t; v.copy(b.head).project(G.camera); if (t > dur - sh[sh.length - 1].dur) { seen++; if (Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1) framed++; least = Math.min(least, b.head.distanceTo(G.camera.position)); n.subVectors(G.camera.position, b.head); const L = n.length(); n.normalize(); facing = Math.max(facing, b.facing.dot(n)); if (b.pts) { let in_way = false; for (let i = 14; i < b.pts.length; i += 3) { w.subVectors(b.pts[i], b.head); const al = w.dot(n); if (al > 0.5 && al < L && w.addScaledVector(n, -al).length() < 2.8) in_way = true; } if (in_way) blocked++; } } }
    h.cine(false); const tells = G.combat.log.filter((l) => l.type === 'tell').length, clear = 1 - blocked / Math.max(1, seen), ok = Math.abs(t - dur) < 0.2 && rose >= dur - 0.3 && tells === 0 && framed / Math.max(1, seen) >= 0.9 && least <= 22 && facing >= 0.3 && clear >= 0.9; if (!ok) bad++; b.stop();
    out.push(`${id}: up ${rose.toFixed(1)} of ${dur.toFixed(1)} s, ${tells} blows, last shot ${least.toFixed(0)} m off with ${(framed / Math.max(1, seen) * 100).toFixed(0)}% in frame, ${(clear * 100).toFixed(0)}% clear of its own body, facing ${facing.toFixed(2)}`);
  }
  return { ok: bad === 0, read: out.join(' · ') + ' (the rise fills the intro, no blow in it, the last shot under 22 m, in frame and clear 90%, face to camera over 0.3)' };
});
const BOSS = () => { const G = window.__game, S = window.__stage, h = G.hero, A = G.world.data.arena;
  S.boss = (id) => { S.reset(); for (const k in G.bosses) G.bosses[k].stop && G.bosses[k].stop(); const b = G.bosses[id]; if (id === 'leviathan') S.place(A.x, A.z + 14, -A.y - 6, 0.6); else S.place(S.spot.x, S.spot.y, S.spot.z, 0.6); S.wait(3); b.dead = false; b.hp = b.maxHp; b.wake(); let n = 0; h.inv = 1e4; while (b.mode === 'rise' && n++ < 400) S.tick(); h.inv = 1e4; return b; }; };
await r.page.evaluate(BOSS);
wall('the Kraken: mantle shut till its arms are gone, and the frozen sever', () => {
  const G = window.__game, S = window.__stage, h = G.hero, b = S.boss('kraken'), C = G.combat.data.bosses.kraken, a = b.arms[0], info = { element: 'water' }, cold = { element: 'ice', status: { chill: 99 } }; const hit = (arm, d, i) => b.strike(arm.pts[8].clone(), 1, (t) => t.onHit(d, h.pos, 'x', i)); const h0 = b.hp; b.headT.onHit(100); const shut = h0 - b.hp;
  const hp0 = a.hp; hit(a, 100, info); const plain = hp0 - a.hp; a.hp = C.arm_hp; a.gone = false; hit(a, 40, cold); const frozen = C.arm_hp - a.hp, was = a.frozen > 0; hit(a, 40, info); hit(a, 40, info); hit(a, 40, info); const cut = a.gone; for (const q of b.arms) q.gone = true; S.wait(2); const open = b.exposed, h1 = b.hp; b.headT.onHit(100); const now = h1 - b.hp; b.stop();
  return { ok: shut === 10 && plain === 100 && was && frozen === 40 * C.frozen_mul && cut && open && now === 100, read: `the mantle took ${shut} of 100; an arm ${plain} of 100, frozen ${frozen} of 40, severed ${cut}; every arm gone, the mantle is ${open ? 'open' : 'shut'} and takes ${now} of 100` };
});
wall('the Colossus: his crust holds till the vents are capped with ice, and they stay capped', () => {
  const G = window.__game, S = window.__stage, h = G.hero, b = S.boss('colossus'), C = G.combat.data.bosses.colossus, P = G.combat.powers; let n = 0; G.combat.setStance('ice', true); while (b.vents.filter((v) => v.l && v.l.on).length < C.vents && n++ < 600) { S.tick(); h.inv = 1e4; } h.tide = h.maxTide = 1e5; const h0 = b.hp; b.headT.onHit(100); const crust = h0 - b.hp; const v = b.vents.find((q) => q.l && q.l.on);
  S.place(v.p.x + 6, Math.max(v.p.y + 3, -6), v.p.z, 0); G.camYaw = Math.atan2(v.p.x - h.pos.x, v.p.z - h.pos.z); G.camPitch = Math.atan2(v.p.y - h.pos.y, Math.hypot(v.p.x - h.pos.x, v.p.z - h.pos.z)); S.tick({ dash: true }); n = 0; while (!(v.l && v.l.capped) && n++ < 90) { S.tick(); h.inv = 1e4; }
  const capped = !!(v.l && v.l.capped), l = v.l; let held = 0; while (capped && P.lives.includes(l) && held < 900) { S.tick(); h.inv = 1e4; held++; }
  for (const q of b.vents) q.capped = true; if (b.vents[0].l) b.vents[0].l.capped = true; for (const q of b.vents) if (q.l) q.l.capped = true; S.wait(2); const open = b.openT, h1 = b.hp; b.headT.onHit(100); const now = h1 - b.hp; b.stop(); G.combat.setStance('water', true);
  return { ok: crust === 100 * C.armour_mul && capped && held / 60 >= C.cap_hold_s - 0.6 && open > C.open_s - 0.5 && now === 100, read: `the crust took ${crust.toFixed(0)} of 100; a Lance capped a vent for ${(held / 60).toFixed(1)} s (${C.cap_hold_s} s); all capped, the core is open ${open.toFixed(1)} s and takes ${now} of 100` };
});
wall('the Frost Wyrm takes water hard and cold hardly at all', () => {
  const G = window.__game, S = window.__stage, h = G.hero, b = S.boss('wyrm'), C = G.combat.data.bosses.wyrm; const a = b.hp; b.headT.onHit(100, h.pos, 'x', { element: 'water' }); const w = a - b.hp, a1 = b.hp; b.headT.onHit(100, h.pos, 'x', { element: 'ice' }); const i = a1 - b.hp; b.stop();
  return { ok: Math.abs(w - 100 * C.takes.water) < 1 && Math.abs(i - 100 * C.takes.ice) < 1 && w > i * 2, read: `water ${w.toFixed(0)} of 100, ice ${i.toFixed(0)} of 100` };
});
wall('the Leviathan: a parried bite stuns it, and a stunned head takes double', () => {
  const G = window.__game, S = window.__stage, h = G.hero, b = S.boss('leviathan'), hp0 = b.hp; b.stunned = 0; b.headT.onHit(100, h.pos, 'x', {}); const plain = hp0 - b.hp; let n = 0; h.inv = 0; while (b.mode !== 'lunge' && b.mode !== 'bite' && n++ < 1600) { S.tick(); h.inv = 1e3; } b.stop();
  const c = S.boss('leviathan'); c.stunned = 1; const h1 = c.hp; c.headT.onHit(100, h.pos, 'x', {}); const st = h1 - c.hp; c.stop(); return { ok: plain === 100 && st === 200, read: `${plain} of 100 awake, ${st} of 100 stunned` };
});
wall('a skipped intro, or none, hands him the fight at once', () => {
  const G = window.__game, S = window.__stage, h = G.hero, A = G.world.data.arena, out = []; let bad = 0;
  for (const id of ['kraken', 'wyrm', 'colossus', 'leviathan']) {
    S.reset(); for (const k in G.bosses) G.bosses[k].stop && G.bosses[k].stop(); const b = G.bosses[id]; if (id === 'leviathan') S.place(A.x, A.z + 14, -A.y - 6, 0.6); else S.place(S.spot.x, S.spot.y, S.spot.z, 0.6); S.wait(3); if (G.cine.active) G.cine.stop(true); h.cine(false); b.stop(); b.dead = false; b.hp = b.maxHp; const short = id === 'wyrm' || id === 'leviathan' ? 4.2 : 2.4;
    const was = [G.cine.active, G.cine.id]; b.wake(); let t = 0, on = 0; while (b.mode === 'rise' && t < 12) { S.tick(); t += 1 / 60; if (G.cine.active) on++; } const plain = t, cineId = G.cine.id; b.stop(); b.dead = false; if (on) out.push(`${id} a cinematic ran ${(on / 60).toFixed(1)} s: ${cineId} (before ${was})`);
    b.wake(); G.cine.play('intro', { shots: S.SHOTS['boss_' + id], focus: () => b.frame, bearing: b.bearing(), film: true }); h.cine(true); S.wait(60); G.cine.stop(true); h.cine(false); t = 0; while (b.mode === 'rise' && t < 12) { S.tick(); t += 1 / 60; } const skip = t; b.stop();
    if (plain > short + 0.1 || skip > short + 0.1) bad++; out.push(`${id} ${plain.toFixed(1)} s with none, ${skip.toFixed(1)} s after a skip`);
  }
  return { ok: bad === 0, read: out.join(' · ') + ' (2.4 s for the two, 4.2 s for the serpents, at most)' };
});
wall('every boss has a place to look and a way it looks', () => {
  const G = window.__game, S = window.__stage, h = G.hero, out = []; let bad = 0; for (const id of ['kraken', 'wyrm', 'colossus', 'leviathan']) { const b = G.bosses[id]; const ok = !!b.head && !!b.pos && !!b.facing && Number.isFinite(b.facing.x + b.facing.y + b.facing.z) && Math.abs(b.facing.length() - 1) < 0.01; if (!ok) { bad++; out.push(id); } }
  return { ok: bad === 0, read: bad ? 'missing on ' + out.join(', ') : 'head, pos and a unit facing on all four, for anything that frames them' };
});
wall('the whole cast is met on the map, a kind per bell', () => {
  const G = window.__game, E = G.enemies, F = G.combat.data.foes, all = Object.keys(F).filter((k) => k !== '_doc'), at = (n) => { const met = {}; E.opened = n; for (const e of E.encounters) for (let i = 0; i < (e.n || 3); i++) { const k = E.kindAt(e, i, n); met[k] = (met[k] || 0) + 1; } E.opened = undefined; return met; };
  const full = at(9), missing = all.filter((k) => !full[k]), bad = Object.keys(full).filter((k) => !F[k]), each = (n) => { let most = 0, sum = 0, reef = new Set(); E.opened = n; for (const e of E.encounters) { const s = new Set(); for (let i = 0; i < (e.n || 3); i++) s.add(E.kindAt(e, i, n)); most = Math.max(most, s.size); sum += s.size; if (E.rosterOf(e) === G.combat.data.rosters.reef) for (const k of s) reef.add(k); if (e.land && n < 3) for (const k of s) if (k !== 'reaver') most = 99; } E.opened = undefined; return { most, mean: sum / E.encounters.length, reef: [...reef] }; }, a = each(1), b = each(2), c = each(9);
  return { ok: !missing.length && !bad.length && a.most <= 2 && a.mean < b.mean && b.mean < c.mean && a.reef.every((k) => k === 'reaver' || k === 'shark'), read: `every bell: ${Object.keys(full).length} of ${all.length} kinds${missing.length ? ', never met: ' + missing.join(', ') : ''}${bad.length ? ', not foes: ' + bad.join(', ') : ''}; kinds in a fight, on average: ${a.mean.toFixed(1)} with no bells (2 at most), ${b.mean.toFixed(1)} with one, ${c.mean.toFixed(1)} with all; the first reef is ${a.reef.join(' and ')}` };
});
wall('a Duelist sets after two blows, turns the next aside, and his answer is the way in', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); const e = S.tough(S.foe('duelist', 2.6)); e.state = 'circle'; e.t = 60; const swing = () => { e.state = 'circle'; e.t = 60; c.interactLand ? 0 : 0; const r = e.onHit(10, h.pos, 'x', { move: 'strike1', melee: true, element: 'water', knock: 0, stun: 0, poise: 0 }); return r; };
  const a = swing(), set0 = e.stance > 0, b = swing(), set = e.stance > 0, hp = e.hp, r3 = swing(), turned = hp === e.hp, st = e.state, blow = e.blow && e.blow.id, tell = e.blow && e.blow.tell_s, rim = 0; S.wait(2);
  // he parries the answer: the opening a stopped player gets
  G.combat.startAttack('parry'); let n = 0; while (e.state === 'tell' && n++ < 60) S.tick(); while (e.state === 'strike' && n++ < 90) S.tick(); const stunned = e.state === 'stun', opened = e.t;
  const waited = S.tough(S.foe('duelist', 2.6, 3)); waited.state = 'circle'; waited.t = 60; for (let i = 0; i < 2; i++) { waited.state = 'circle'; waited.onHit(10, h.pos, 'x', { move: 'strike1', melee: true, element: 'water', knock: 0, stun: 0, poise: 0 }); } const up = waited.stance > 0; for (let i = 0; i < 100; i++) { S.tick(); waited.state = 'circle'; waited.t = 60; } const lapsed = waited.stance <= 0;
  return { ok: a !== 'blocked' && !set0 && set && r3 === 'blocked' && turned && st === 'tell' && blow === 'answer' && tell >= 0.5 && stunned && up && lapsed, read: `two blows land, the second sets him (${set}); the third is ${r3} and he answers in ${tell} s; parried, he's ${e.state} ${opened.toFixed(1)} s; left alone the stance lapses (${lapsed})` };
});
wall('a feint hangs, its rim dies, and a parry on the first beat is early', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat, D = c.data.foes.duelist.blows.find((b) => b.id === 'feint'); const run = (at) => { S.reset(); h.hp = h.maxHp = 1e5; const e = S.tough(S.foe('duelist', 2.6)); e.state = 'circle'; e.t = 60; const o = Math.random; G.combat.log.length = 0; Math.random = () => 0.9; c.log; const hold = e; hold.state = 'circle'; hold.t = 0; let n = 0, dull = 1, t0 = null, t1 = null, res = null; while (n++ < 200) { S.tick(); if (e.state === 'tell' && e.blow.id === 'feint' && t0 === null) t0 = G.time; if (t0 !== null && e.state === 'tell') { dull = Math.min(dull, e.clock > 0.5 && e.clock < 0.8 ? e.u.uTell.value : 1); if (at !== null && e.clock >= at && !c.cur) { c.startAttack('parry'); at = 99; } } if (t0 !== null && e.state === 'strike' && t1 === null) t1 = G.time; const l = G.combat.log.filter((q) => q.type === 'contact'); if (l.length) { res = l[0].res; break; } if (t0 !== null && e.state === 'recover') break; if (e.state === 'tell' && e.blow.id !== 'feint') { e.state = 'circle'; e.t = 0; c.reset(); } } Math.random = o; return { res, told: t1 - t0, dull }; };
  const early = run(D.tell_s - 0.2), right = run(D.tell_s + D.feint_s - 0.2);
  return { ok: Math.abs(early.told - (D.tell_s + D.feint_s)) < 0.08 && early.dull < 0.2 && early.res !== 'parried' && right.res === 'parried', read: `told ${early.told.toFixed(2)} s, the rim down to ${early.dull.toFixed(2)} in the hang; a parry on the first beat: ${early.res}; on the true beat: ${right.res}` };
});
wall('a Thornback turns a blow while its spines are up, and not one from afar', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); const e = S.tough(S.foe('thornback', 3)); e.spine = true; e.spineT = 9; const hp = e.hp, hh = h.hp; const up = e.onHit(10, h.pos, 'x', { melee: true, element: 'water', knock: 0, poise: 0 }), hurt = hh - h.hp, kept = e.hp === hp; h.inv = 0; const far = e.onHit(10, h.pos, 'x', { melee: false, element: 'water', knock: 0, poise: 0 }), tookFar = hp - e.hp; e.spine = false; const hp2 = e.hp; const flat = e.onHit(10, h.pos, 'x', { melee: true, element: 'water', knock: 0, poise: 0 }), tookFlat = hp2 - e.hp;
  e.spineT = 0.4; let ups = 0, was = e.spine; for (let i = 0; i < 400; i++) { S.tick(); e.state = 'circle'; e.t = 60; if (e.spine && !was) ups++; was = e.spine; } const rim = e.spine ? e.u.uTell.value : 0.7;
  return { ok: up === 'blocked' && kept && hurt > 0 && far !== 'blocked' && tookFar === 10 && tookFlat === 10 && ups >= 1 && rim > 0.4, read: `spines up: ${up}, he lost ${hurt}; from afar it took ${tookFar}; flat it took ${tookFlat}; the spines rose ${ups} times in 6.7 s on their own, the rim shows it` };
});
wall('Ice Path freezes the sea under a surf, and he skates on it at speed', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset('ice'); let spot = null; for (let x = -800; x < 800 && !spot; x += 30) for (let z = -800; z < 800 && !spot; z += 30) { let ok = true; for (let k = 0; k < 24 && ok; k++) { const d = k * 6; if (G.world.heightAt(x + d, -z) > -10) ok = false; const q = { x: x + d, y: -z, z: 0 }; if (G.world.collide(q, 1.2)) ok = false; } if (ok) spot = { x, z }; }
  if (!spot) return { ok: false, read: 'no open sea for a run' }; S.place(spot.x, -0.7, spot.z, Math.PI / 2); G.camYaw = Math.PI / 2; G.camPitch = -0.05; S.held.boost = true; S.held.my = 1; let n = 0; while (h.state !== 'surf' && n++ < 300) { if (Math.hypot(h.vel.x, h.vel.z) < 14) { h.vel.x = 14; h.vel.z = 0; } h.pos.y = Math.max(h.pos.y, -0.7); S.tick(); }
  const surfed = h.state === 'surf', v0 = Math.hypot(h.vel.x, h.vel.z), x0 = h.pos.x; S.tick({ p4: true }); let wet = 0, least = 1e9, top = 0, ticks = 0; const seen = {}; for (let i = 0; i < 120; i++) { S.held.boost = true; S.held.my = 1; S.tick(); ticks++; seen[h.state + (h.land ? ':ice' : h.air ? ':air' : '')] = 1; const sp = Math.hypot(h.vel.x, h.vel.z); if (i > 20) least = Math.min(least, sp); top = Math.max(top, h.pos.y); if (h.pos.y < -1.4) wet++; }
  S.held.boost = false; S.held.my = 0; const plates = G.icePath.plates.length, gone = h.pos.x - x0;
  return { ok: surfed && plates >= 8 && wet === 0 && least >= 9 && gone >= 18, read: `from a ${v0.toFixed(0)} m/s surf: ${plates} plates, ${gone.toFixed(0)} m in 2 s at ${least.toFixed(1)} m/s or better (9), ${wet} frames in the water, states ${Object.keys(seen).join(', ')}` };
});
wall('a foe walled off from him comes round', () => {
  const G = window.__game, S = window.__stage, h = G.hero, H = (x, z) => G.world.heightAt(x, -z), half = G.world.data.size_m / 2 - 40; S.reset(); let spot = null; const a = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 };
  for (let x = -half; x < half && !spot; x += 17) for (let z = -half; z < half && !spot; z += 19) { const g = H(x, z); if (g > -14 || g < -80) continue; const y = g + 4; a.x = x; a.y = -z; a.z = y; b.x = x + 9; b.y = -z; b.z = y; const g2 = H(x + 9, z); if (g2 > y - 2) continue; if (!G.world.sweep(a, b, 0.4)) continue; if (G.world.collide({ x, y: -z, z: y }, 0.8) || G.world.collide({ x: x + 9, y: -z, z: y }, 0.8)) continue; spot = { x, z, y }; }
  if (!spot) return { ok: false, read: 'no wall found on the map' }; const E = G.enemies, enc = E.encounters[0], list = enc.list, rung = G.quest.isRung, c0 = enc.c.clone(); G.quest.isRung = () => false; for (const q of E.encounters) { q.cleared = true; q.state = 'idle'; } enc.c.set(spot.x, spot.y, spot.z); S.place(spot.x, spot.y, spot.z, Math.PI / 2); const e = S.tough(E.spawn('reaver', new h.pos.constructor(spot.x + 9, spot.y, spot.z), enc)); e.pos.set(spot.x + 9, spot.y, spot.z); enc.state = 'awake'; enc.list.length = 0; enc.list.push(e); let n = 0, walled0 = false; for (; n < 900; n++) { h.pos.set(spot.x, spot.y, spot.z); h.vel.set(0, 0, 0); h.inv = 1e4; e.state = 'stun'; e.t = 20; e.pos.x = Math.max(e.pos.x, spot.x + (S.heard('cameRound').length ? -1e3 : 9)); S.tick(); walled0 = walled0 || e.walled; if (S.heard('cameRound').length) break; }
  const d = e.pos.distanceTo(h.pos), came = S.heard('cameRound').length; enc.c.copy(c0); enc.state = 'idle'; enc.cleared = true; enc.list.length = 0; G.quest.isRung = rung; G.enemies.clearAll();
  return { ok: came === 1 && walled0 && n / 60 >= 11 && n / 60 <= 14 && d < 14, read: `rock between them (${walled0}): he came round after ${(n / 60).toFixed(1)} s, ${d.toFixed(1)} m from him` };
});
const LAND = () => { const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.onGround = (st = 'water') => { S.reset(st); S.cleanSong(); const e = G.enemies.encounters.find((q) => q.id === 'land_frost_fort'), p = e.c, g = G.world.heightAt(p.x, -p.z); S.place(p.x, g + 0.92, p.z, 0.6); h.land = true; h.air = false; h.grounded = true; h.vel.set(0, 0, 0); for (const q of G.enemies.encounters) { q.cleared = true; q.state = 'idle'; } S.wait(6); return p; }; S.onGroundNow = () => Math.abs(h.pos.y - (G.world.heightAt(h.pos.x, -h.pos.z) + 0.92)) < 0.6 && h.land; };
await r.page.evaluate(LAND);
wall('every power works on the ground, and he stays on his feet', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat, out = [], bad = []; for (const [id, d] of [['strike1', 3], ['whip', 11], ['riptide', 8], ['maelstrom', 3], ['wave', 8], ['geyser', 9], ['lance', 9], ['glacier', 8], ['breath', 6], ['cast', 10]]) { const ice = c.data.moves[id].element === 'ice'; S.onGround(ice ? 'ice' : 'water'); const e = S.tough(S.foe('reaver', d)); e.state = 'stun'; e.t = 30; e.stunGuard = 1e3; const hp = e.hp; c.log.length = 0; if (id === 'cast') S.tick({ cast: true }); else c.startAttack(id); const tg = c.findTarget(20), yawTo = Math.atan2(e.pos.x - h.pos.x, e.pos.z - h.pos.z), dy = e.pos.y - h.pos.y, dist = e.pos.distanceTo(h.pos); let n = 0; while (n++ < 110) { S.tick(); e.state = 'stun'; e.t = 30; } const took = hp - e.hp; S.wait(50); const st = S.onGroundNow(); if (took <= 0 || !st) bad.push(`${id} ${took <= 0 ? 'hit nothing [target ' + !!tg + ', foe ' + dist.toFixed(1) + ' m off, ' + dy.toFixed(1) + ' m up, yaw ' + (yawTo - G.camYaw).toFixed(2) + ', log ' + c.log.filter((l) => /hang|thrown|release|blocked/.test(l.type)).map((l) => l.type).join(' ') + ']' : 'left him off the ground, y ' + h.pos.y.toFixed(1) + ' over ' + G.world.heightAt(h.pos.x, -h.pos.z).toFixed(1)}`); else out.push(id); }
  return { ok: !bad.length, read: `${out.length} of 10 land and leave him standing${bad.length ? '; ' + bad.join('; ') : ''}` };
});
wall('the dash on land goes where it should and no further', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; const p = S.onGround(), q = { x: 0, y: 0, z: 0 }; S.tough(S.foe('reaver', 14)).state = 'stun'; const x0 = h.pos.clone(); c.startAttack('riptide'); let inside = 0, top = 0, n = 0; while (n++ < 60) { S.tick(); q.x = h.pos.x; q.y = -h.pos.z; q.z = h.pos.y; if (G.world.collide(q, 0.05)) inside++; top = Math.max(top, h.pos.y - (G.world.heightAt(h.pos.x, -h.pos.z) + 0.92)); } S.wait(40); const far = Math.hypot(h.pos.x - x0.x, h.pos.z - x0.z), st = S.onGroundNow();
  return { ok: far >= 5 && inside === 0 && top < 2.5 && st, read: `${far.toFixed(1)} m along the ground (5 at least), ${top.toFixed(1)} m at most off it, ${inside} steps in a solid, ${st ? 'standing' : 'not standing'} after` };
});
wall('what needs the sea refuses on land, and costs nothing', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.onGround('ice'); const t0 = h.tide; S.tick({ p4: true }); S.wait(6); const path = G.icePath.plates.length, spent = t0 - h.tide, told = c.log.filter((l) => l.type === 'denied' && l.id === 'icepath').length; S.onGround(); S.book(true); let pack = 0; const o = G.enemies.callPack; G.enemies.callPack = (...a) => { pack++; return o(...a); }; c.log.length = 0; S.sing(95); S.wait(30); G.enemies.callPack = o; const brch = S.seen('start', 'breach').length; S.book(false); S.onGround(); S.held.jumpHeld = 1; S.wait(40); S.held.jumpHeld = 0; const spout = c.powers.spout.on; S.wait(30);
  return { ok: path === 0 && told === 1 && !pack && !brch && !spout, read: `Ice Path ${path} plates, ${told} refusal, ${Math.max(0, spent).toFixed(1)} tide; held Call: ${pack} packs, ${brch} whales; held Jump: ${spout ? 'a spout' : 'no spout'}` };
});
wall('a knock up a slope never leaves a foe inside a solid', () => {
  // the wedge where the bed rises under a rock's lower edge: the rock pushes down, the bed pushes up, and the two cancel. Found by scanning the map, so a new map can't leave this wall reading empty water
  const G = window.__game, S = window.__stage, h = G.hero, H = (x, z) => G.world.heightAt(x, -z), half = G.world.data.size_m / 2 - 40; S.reset(); h.inv = 1e4; let steps = 0, inside = 0, startedIn = 0; const q = { x: 0, y: 0, z: 0 }, spots = [];
  for (let x = -half; x < half && spots.length < 14; x += 11) for (let z = -half; z < half && spots.length < 14; z += 13) { const g = H(x, z); if (g > -4 || g < -60) continue; if (Math.hypot(H(x + 3, z) - g, H(x, z + 3) - g) < 0.7) continue; q.x = x; q.y = -z; q.z = g + 0.6; if (!G.world.collide(q, 0.05)) continue; if (Math.abs(q.z - (g + 0.6)) < 0.02 && Math.hypot(q.x - x, q.y + z) < 0.02) continue; if (spots.some((p) => Math.hypot(p.x - x, p.z - z) < 40)) continue; spots.push({ x, z, g }); }
  for (const p of spots) for (const kind of ['shark', 'reaver']) for (let a = 0; a < 6.28; a += 1.05) {
    G.enemies.clearAll(); S.place(p.x + 30, p.g + 8, p.z, 0.6); const at = new h.pos.constructor(p.x + Math.cos(a) * 7, 0, p.z + Math.sin(a) * 7); at.y = H(at.x, at.z) + 1.2; const e = G.enemies.spawn(kind, at); if (!e) continue; q.x = e.pos.x; q.y = -e.pos.z; q.z = e.pos.y; if (G.world.collide(q, 0.05)) { startedIn++; continue; } e.safe = null; e.state = 'stun'; e.t = 9;
    for (let i = 0; i < 40; i++) { e.state = 'stun'; e.t = 9; e.vel.set(p.x - e.pos.x, 2.4, p.z - e.pos.z).normalize().multiplyScalar(14); S.step(); q.x = e.pos.x; q.y = -e.pos.z; q.z = e.pos.y; steps++; if (G.world.collide(q, 0.05)) inside++; }
  }
  return { ok: inside === 0 && startedIn === 0 && spots.length >= 3 && steps > 500, read: `${spots.length} wedges found on the map; ${inside} of ${steps} steps ended with a foe's centre in a solid (0), driven in at 14 m/s from six sides; ${startedIn} spawned in one (0)` };
});
wall('deaths: he falls, and the fight lets him go', () => {
  const G = window.__game, S = window.__stage, h = G.hero; S.reset(); G.quest.spareFirstFight = () => false; h.hp = h.maxHp = 10; const res = h.damage(50, h.pos.clone().add({ x: 3, y: 0, z: 0 }));
  const ok = res === 'dead' && h.dead && G.combat.cur === null; let n = 0; while (h.dead && n++ < 900) S.tick(); S.wait(30);       // his respawn is on a clock: it mustn't land in the next wall
  return { ok, read: `${res}; no move left running` };
});

// ------------------------------------------------------------------ P13 Shoalsong, P5 Call, P14 Homeward Cast
const SONG = () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat, L = G.life, Q = c.data.shoal; const logged = G.quest.collect.logged;
  S.book = (on) => { for (const k of ['manta', 'turtle', 'reef_shark', 'whale']) { if (on) logged[k] = 1; else delete logged[k]; } };
  S.heard = (type) => c.log.filter((l) => l.type === type);
  S.near = (kind, off = 20) => {          // him in open water, off metres from the nearest of a kind, nobody else about
    let best = null, bd = 1e9; const sea = (x, z) => { const g = G.world.heightAt(x, -z); return g < -8 && g > -70; };
    if (kind === 'school') { for (const s of L.schools) { const p = L.schoolPos(s); if (sea(p.x + off, p.z) && p.y < -3) { const d = p.distanceTo(S.spot); if (d < bd) { bd = d; best = p.clone(); } } } }
    else for (const a of L.herds[kind].agents) { if (sea(a.pos.x + off, a.pos.z)) { const d = a.pos.distanceTo(S.spot); if (d < bd) { bd = d; best = a.pos.clone(); } } }
    if (!best) return false; const g = G.world.heightAt(best.x + off, -best.z); S.place(best.x + off, Math.max(g + 6, Math.min(best.y, -3)), best.z, 0.6); return true;
  };
  // the song by the real input: the press, then the finger held for so many frames
  S.sing = (frames = 0) => { const n = c.log.length; S.tick({ call: true, callHeld: 1 }); S.wait(frames); S.held.callHeld = 0; S.wait(2); return n; };
  S.cleanSong = () => { c.powers.shoal.clear(); c.powers.home.reset(); for (const k in c.cool) c.cool[k] = 0; };
};
await r.page.evaluate(SONG); await r.page.evaluate((j) => { window.__stage.SHOTS = j; }, SHOTS);
wall('a held song spreads a ring, and what it touches follows him for about 20 s', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat, Q = c.data.shoal; S.reset(); S.cleanSong(); S.book(true); if (!S.near('school', 22)) return { ok: false, read: 'no school in open water' };
  const t0 = G.time; S.sing(46); const joined = S.heard('joined'); const n = c.powers.shoal.led.filter((l) => !l.going).length; S.wait(30);
  // he swims off: they come with him
  let gap = 0, closest = 1e9; for (let i = 0; i < 300; i++) { S.tick(); S.held.my = 1; } S.held.my = 0; const led = c.powers.shoal.led.filter((l) => !l.going); for (const l of led) { const d = l.pos.distanceTo(h.pos); gap = Math.max(gap, d); closest = Math.min(closest, d); }
  while (G.time - t0 < 26 && !S.heard('left').length) S.tick();
  const left = S.heard('left'), held = left.length ? left[0].held : 0;
  return { ok: n >= 1 && closest < 16 && held >= 18.5 && held <= 21.5, read: `${n} followers, the first ${joined[0] ? joined[0].d + ' m away, a ' + joined[0].kind : 'none'}; after a 5 s swim the nearest is ${closest.toFixed(1)} m from him (under 16); they stayed ${held} s (about 20)` };
});
wall('they go home when the song ends', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.book(true); S.near('school', 22); S.sing(46);
  const l = c.powers.shoal.led.find((q) => q.type === 'school'); if (!l) return { ok: false, read: 'no school joined' }; const s = l.ref, r0 = l.homeR, home = l.home.clone(); let jump = 0, was = G.life.schoolPos(s).clone(); const track = () => { const p = G.life.schoolPos(s); jump = Math.max(jump, p.distanceTo(was)); was.copy(p); }; for (let i = 0; i < 240; i++) { S.tick(); track(); } const narrow = s.r;
  for (const q of c.powers.shoal.led) q.until = 0; let n = 0; while (n++ < 1800 && c.powers.shoal.led.includes(l)) { S.tick(); track(); }
  return { ok: Math.abs(s.r - r0) < 0.01 && s.c.distanceTo(home) < 0.01 && narrow < r0 && jump < 2.4, read: `narrowed to ${narrow.toFixed(1)} m while led, back to ${s.r} m at its own place in ${(n / 60).toFixed(1)} s; the biggest step of the ball ${jump.toFixed(2)} m a frame (under 2.4: it never jumps)` };
});
wall('what he leads holds its nerve when the pack comes', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.book(true); S.near('school', 16); S.sing(0); S.wait(150); const l = c.powers.shoal.led.find((q) => q.type === 'school'); if (!l) return { ok: false, read: 'no school joined' }; G.life.scatter(h.pos, 50); let wide = 0; for (let i = 0; i < 120; i++) { S.tick(); wide = Math.max(wide, l.ref.fleeR); } return { ok: wide <= 7 && l.pos.distanceTo(h.pos) < 14, read: `after a scatter by his side: the widest it shied ${wide.toFixed(1)} m (7 at most, 30 for a wild school), ${l.pos.distanceTo(h.pos).toFixed(1)} m from him` };
});
wall('the song and the cast have their levels', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat, U = c.data.upgrades, Q = c.data.shoal; const ring = (lvl) => { S.reset(); S.cleanSong(); c.applyUpgrades({ shoalsong: lvl }); S.near('school', 22); c.log.length = 0; S.sing(46); S.wait(30); const e = S.heard('song_end').pop(); const l = c.powers.shoal.led[0], stay = l ? l.until - l.born : 0; S.cleanSong(); return { ring: e && e.ring, stay }; }; const a = ring(0), b = ring(1), d = ring(2);
  const throwTo = (lvl) => { S.reset(); S.cleanSong(); c.applyUpgrades({ cast: lvl }); h.pos.y = Math.min(h.pos.y, -6); G.camPitch = 0; S.tick({ cast: true }); S.wait(12); const T = c.powers.home.T, left = T.left, far = c.data.moves.cast.range_m * (lvl >= 2 ? U.cast.range : 1); S.cleanSong(); return left; }; const t0 = throwTo(0), t2 = throwTo(2); const back = (lvl) => { S.reset(); S.cleanSong(); c.applyUpgrades({ cast: lvl }); const e = S.tough(S.foe('reaver', 8)); e.state = 'stun'; e.t = 60; S.tick({ cast: true }); S.wait(14); const T = c.powers.home.T; T.p.copy(S.ahead(16)); T.state = 'hang'; T.hangT = 7; T.left = 0; const hp = e.hp; S.tick({ cast: true }); let n = 0; while (T.state !== 'held' && n++ < 120) { S.tick(); e.state = 'stun'; e.t = 60; } const took = hp - e.hp; S.cleanSong(); return took; }; const k0 = back(0), k1 = back(1); c.applyUpgrades({});
  return { ok: b.ring > a.ring && d.stay > a.stay + 5 && t2 > t0 + 8 && k1 > k0 * 1.2, read: `the ring ${a.ring} m > ${b.ring} m; they stay ${a.stay} s > ${d.stay} s; the throw has ${t0.toFixed(0)} m left > ${t2.toFixed(0)} m; coming home it takes ${k0.toFixed(0)} > ${k1.toFixed(0)}` };
});
wall('the spout carries him 20 m over the sea, throws what it catches, and lets him down', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; const run = (y, foes) => { S.reset(); S.cleanSong(); S.place(S.spot.x, y, S.spot.z, 0.6); const list = foes ? [S.tough(S.foe('reaver', 7, 1), 3000), S.tough(S.foe('reaver', 9, -3), 3000)] : []; c.log.length = 0; S.held.jumpHeld = 1; let top = -99, n = 0; for (; n < 170; n++) { S.tick(); top = Math.max(top, h.pos.y); if (!c.powers.spout.riding && n > 40) break; } const leapt = c.powers.spout.T.mode, at = n; S.held.jumpHeld = 0; let g = 0; while (g++ < 400 && (h.air || h.pos.y > 0.5)) S.tick(); S.wait(30); return { top, at, y: h.pos.y, air: h.air, carried: !!h.carried, spun: c.log.filter((l) => l.type === 'spun').length, thrown: c.log.filter((l) => l.type === 'thrown').length, on: c.powers.spout.on, st: h.state }; };
  const a = run(-0.6, true), b = run(-7, false), short = (() => { S.reset(); S.cleanSong(); S.place(S.spot.x, -0.6, S.spot.z, 0.6); S.tick({ jumpHeld: 1 }); S.wait(5); S.held.jumpHeld = 0; S.wait(40); const on = c.powers.spout.on; S.cleanSong(); return on; })();
  return { ok: a.top >= 20 && b.top >= 20 && !a.carried && !a.air && a.y < 1 && a.spun >= 2 && a.thrown >= 2 && !short, read: `from the surface he reaches ${a.top.toFixed(1)} m (20 at least), from 7 m down ${b.top.toFixed(1)} m; ${a.spun} foes caught, ${a.thrown} thrown; he ends in the water at ${a.y.toFixed(1)} m, ${a.st}; a tap raises nothing` };
});
wall('a tap reaches less than a held song', () => {
  const G = window.__game, S = window.__stage, c = G.combat, Q = c.data.shoal; S.reset(); S.cleanSong(); S.near('school', 22); S.sing(0); S.wait(50); const a = S.heard('song_end').pop(); S.cleanSong(); c.log.length = 0; S.sing(46); S.wait(10); const b = S.heard('song_end').pop();
  return { ok: !!a && !!b && a.ring === Q.ring_tap_m && b.ring === Q.ring_m && b.ring > a.ring, read: `a tap ${a && a.ring} m, held ${b && b.ring} m` };
});
wall('a school takes one blow for him, and not a blow he must dodge', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.near('school', 16); S.sing(0); S.wait(180);
  const near = c.powers.shoal.led.filter((l) => l.job === 'shield' && !l.going && l.pos.distanceTo(h.pos) < c.data.shoal.shield_m).length; const from = h.pos.clone(); from.x += 3;
  const hp = h.hp, un = h.damage(30, from, { unblockable: true }); const hurt = h.hp < hp; h.state = 'swim'; h.stun = 0; h.inv = 0; const hp1 = h.hp, a = h.damage(30, from), hp2 = h.hp; h.state = 'swim'; h.inv = 0; const hp3 = h.hp, b = h.damage(30, from);
  return { ok: near >= 1 && hurt && a === 'shielded' && hp1 === hp2 && b === 'hit' && h.hp < hp3, read: `${near} round him; an unblockable went through; the next blow: ${a}, ${hp1 - hp2} lost; another straight after: ${b}: one blow in 6 s, however many came` };
});
wall('a second school swarms the foe and slows it', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat, L = G.life; S.reset(); S.cleanSong(); S.near('school', 8);
  // two schools by the book: bring a second in by the same song
  const Sh = c.powers.shoal, near = [...L.schools].sort((a, b) => L.schoolPos(a).distanceTo(h.pos) - L.schoolPos(b).distanceTo(h.pos)).slice(0, 2); near[1].c.copy(near[0].c); const r1 = near[1].r; near[1].r = near[0].r; near[1].clock = near[0].clock; near[1].ph = near[0].ph;
  const e = S.tough(S.foe('reaver', 12)); S.sing(40); const n = Sh.led.filter((l) => l.job === 'shield').length; let slow = 1, t = 0; for (let i = 0; i < 240; i++) { S.tick(); if (e.slow < slow) { slow = e.slow; } if (Sh.led.some((l) => l.foe === e)) t++; } near[1].r = r1;
  return { ok: n >= 2 && slow <= c.data.shoal.swarm_slow + 1e-6 && t > 60, read: `${n} schools, one on the Reaver ${(t / 60).toFixed(1)} s; his pace down to ${slow}` };
});
wall('a turtle lifts him out of a blow', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; const blow = () => { const y = h.pos.y, from = h.pos.clone(); from.x += 3; h.inv = 0; h.damage(30, from); let top = y; for (let i = 0; i < 60; i++) { S.tick(); top = Math.max(top, h.pos.y); } return top - y; };
  S.reset(); S.cleanSong(); S.book(false); S.near('turtle', 14); S.wait(4); const was = blow();
  S.reset(); S.cleanSong(); S.book(true); if (!S.near('turtle', 14)) return { ok: false, read: 'no turtle in open water' }; h.pos.y = Math.max(h.pos.y - 4, G.world.heightAt(h.pos.x, -h.pos.z) + 4); S.sing(10); S.wait(60); const l = c.powers.shoal.led.find((q) => q.job === 'lift'); if (!l) return { ok: false, read: 'no turtle joined: ' + JSON.stringify(c.powers.shoal.led.map((q) => q.kind)) };
  for (const q of c.powers.shoal.led) if (q.job === 'shield') q.going = true;      // a school would take the blow first: it's the turtle being read here
  const d0 = l.pos.distanceTo(h.pos), y0 = h.pos.y, rose = blow(), lifted = S.heard('lifted').length;
  return { ok: !!l && lifted === 1 && rose >= 2.5 && rose > was + 1.5, read: `a turtle ${d0.toFixed(1)} m off came under him; he rose ${rose.toFixed(1)} m in 1 s (${was.toFixed(1)} m alone), lifted ${lifted}, from ${y0.toFixed(1)} over a bed at ${G.world.heightAt(h.pos.x, -h.pos.z).toFixed(1)}, state ${h.state}, land ${h.land}, air ${h.air}` };
});
wall('sharks hunt what he marks', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.book(true); if (!S.near('reef_shark', 14)) return { ok: false, read: 'no shark in open water' }; const a = S.tough(S.foe('reaver', 16)), b = S.tough(S.foe('reaver', 7, 3)); a.state = 'stun'; a.t = 60; b.state = 'stun'; b.t = 60; for (const e of [a, b]) { e.stunGuard = 1e3; }
  S.sing(10); S.wait(20); c.powers.shoal.setMark(a); const n = c.powers.shoal.led.filter((l) => l.job === 'hunt').length, h0 = a.hp, h1 = b.hp; for (let i = 0; i < 600; i++) { S.tick(); a.state = 'stun'; a.t = 60; b.state = 'stun'; b.t = 60; a.vel.set(0, 0, 0); b.vel.set(0, 0, 0); }
  const bites = S.heard('hunt').length; return { ok: n >= 1 && bites >= 2 && a.hp < h0 && b.hp === h1, read: `${n} sharks led; ${bites} bites in 10 s took ${(h0 - a.hp).toFixed(0)} from the marked Reaver and ${(h1 - b.hp).toFixed(0)} from the other` };
});
wall('rays carry light through the dark, and only there', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; let lit = 0; const o = G.look.flash; G.look.flash = (...x) => { lit++; return o(...x); };
  S.reset(); S.cleanSong(); S.book(true); if (!S.near('manta', 16)) { G.look.flash = o; return { ok: false, read: 'no ray in open water' }; } S.sing(30); S.wait(120); const l = c.powers.shoal.led.find((q) => q.job === 'light');
  const shallow = h.pos.y > c.data.shoal.dark_y ? S.heard('raylight').length : -1; if (!l) { G.look.flash = o; return { ok: false, read: 'no ray joined' }; }
  // down into the dark, the ray with him: the depth is read at a real deep place
  let spot = null; for (let x = -600; x < 600 && !spot; x += 40) for (let z = -600; z < 600 && !spot; z += 40) { const g = G.world.heightAt(x, -z); if (g < -60) spot = { x, z, g }; }
  S.place(spot.x, Math.max(spot.g + 8, -50), spot.z, 0.6); l.ref.pos.set(h.pos.x + 12, h.pos.y, h.pos.z); lit = 0; S.wait(240); const n = S.heard('raylight').length; G.look.flash = o;
  return { ok: shallow === 0 && n >= 3 && lit >= 3, read: `${shallow} lights in the shallows; ${n} in 4 s at ${h.pos.y.toFixed(0)} m` };
});
wall('at least one kind answers anywhere on the map', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat, W = G.world.data; let spots = 0, land = 0, worst = 0, at = '', silent = 0, far = 0, gulls = 0; const list = [], half = W.size_m / 2 - 24;
  for (let x = -half; x <= half; x += 200) for (let z = -half; z <= half; z += 200) list.push({ x, z, id: `${x | 0},${z | 0}` });
  for (const p of W.poi) list.push({ x: p.x, z: -p.y, id: p.id });
  for (const q of list) {
    const g = G.world.heightAt(q.x, -q.z), dry = g > -1.2; if (dry) land++;
    S.reset(); S.cleanSong(); S.book(false); S.place(q.x, dry ? g + 1.2 : Math.max(g + 1.4, Math.min(g + 8, -1.4)), q.z, 0.6); h.land = dry; S.wait(2); G.combat.log.length = 0; spots++; S.sing(46); let t = 48, ok = false; const Sh = c.powers.shoal;
    while (t < 900 && !ok) { S.tick(); t++; ok = Sh.led.some((l) => !l.going && l.pos.distanceTo(h.pos) < (l.air ? 34 : 16)); }
    if (!ok) { silent++; at = q.id + ' ' + JSON.stringify(Sh.led.map((l) => [l.kind, +l.pos.distanceTo(h.pos).toFixed(0)])); } else { if (Sh.led.some((l) => l.air)) gulls++; if (t > worst) { worst = t; if (!silent) at = q.id; } } if (S.heard('joined').length && S.heard('joined')[0].d > c.data.shoal.ring_m) far++;
  }
  return { ok: spots >= 80 && silent === 0 && worst / 60 <= 8, read: `${spots} places, ${land} of them land, ${silent} silent; the worst waited ${(worst / 60).toFixed(1)} s for a follower (8 at most, ${at}); ${far} needed a creature from beyond the ring; a gull answered at ${gulls}` };
});
wall('Minnows book teaches the song', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; const ask = (log) => { S.reset(); S.cleanSong(); S.book(false); if (log) G.quest.collect.logged.manta = 1; S.near('manta', 14); S.wait(2); G.combat.log.length = 0; S.sing(46); S.wait(4); const n = c.powers.shoal.led.filter((l) => l.kind === 'manta').length; S.cleanSong(); return n; };
  const a = ask(false), b = ask(true); S.book(false); const kn = c.powers.shoal.knows('fish_a'), w0 = c.powers.shoal.knows('whale'); S.book(true); const w1 = c.powers.shoal.knows('whale');
  return { ok: a === 0 && b >= 1 && kn && !w0 && w1, read: `before the book ${a} rays answer, after it ${b}; fish always; the whale once logged` };
});
wall('the Call holds to its top tiers: the pack, then the breach', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat, Q = c.data.shoal; let pack = 0; const o = G.enemies.callPack; G.enemies.callPack = (...a) => { pack++; return o(...a); };
  const hold = (f, book) => { S.reset(); S.cleanSong(); S.book(book); G.combat.log.length = 0; pack = 0; S.sing(f); S.wait(40); const r = { song: S.heard('song').length, pack, breach: S.seen('start', 'breach').length, cool: h.cool.call }; S.cleanSong(); return r; };
  const a = hold(10, true), b = hold(48, true), d = hold(95, true), e = hold(95, false); G.enemies.callPack = o; S.book(false); const was = h.powers.call; h.powers.call = false; const f = hold(95, true); h.powers.call = was; S.book(false);
  return { ok: a.song === 1 && !a.pack && !a.breach && b.pack === 1 && !b.breach && d.breach === 1 && !d.pack && e.pack === 1 && !e.breach && !f.pack && !f.breach && f.song === 1 && a.cool > 0, read: `tap: song only · ${(48 / 60).toFixed(1)} s: the pack · ${(95 / 60).toFixed(1)} s: the breach · no whale in the book: the pack · no Call yet: the song only` };
});
wall('the whale breaks armour and throws what it comes up through', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.book(true); const crab = S.tough(S.foe('giant_crab', 9)), cap = S.tough(S.foe('captain', 8, 3)); crab.armour = 200; const hp = crab.hp, y = cap.pos.y, broke0 = cap.guardBroken;
  G.combat.log.length = 0; S.sing(95); let top = 0, seen = 0, frames = 0; for (let i = 0; i < 300; i++) { S.tick(); top = Math.max(top, cap.launched); if (c.powers.shoal.whale.visible) { seen++; } frames++; if (!c.powers.shoal.breaching() && i > 60) break; }
  const tris = c.powers.shoal.whale.geometry.attributes.position.count / 3; return { ok: S.heard('breach').length === 1 && crab.armour === 0 && crab.hp < hp && top > 0 && !c.powers.shoal.whale.visible && tris > 1000 && seen >= 60, read: `armour ${crab.armour} from 200, ${(hp - crab.hp).toFixed(0)} damage, the Captain thrown ${top.toFixed(1)} s, his guard ${cap.guardBroken > 0 ? 'broken' : 'held'}; the whale ${tris | 0} triangles, in sight ${(seen / 60).toFixed(1)} s, gone after` };
});
wall('the breach is told before it lands', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.book(true); S.tough(S.foe('reaver', 9)); G.combat.log.length = 0; S.sing(95); let n = 0; while (n++ < 180 && !S.heard('breach').length) S.tick(); const t = S.heard('tell').find((l) => l.foe === 'whale'), b = S.heard('breach')[0];
  return { ok: !!t && !!b && b.t - t.t >= 1.2, read: `${t && b ? (b.t - t.t).toFixed(2) : '?'} s from the circle to the blow, so a foe's strike still reads (1.2 at least)` };
});
wall('a hit bursts on the foe, at any range', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); const e = S.tough(S.foe('reaver', 20)); e.state = 'stun'; e.t = 20; let at = null; const o = G.fx.impact; G.fx.impact = (p, ...r) => { at = at || p.clone(); return o(p, ...r); }; S.tick({ cast: true }); let n = 0; while (!at && n++ < 90) S.tick(); G.fx.impact = o; const off = at ? Math.hypot(at.x - e.pos.x, at.z - e.pos.z) : 99;
  return { ok: off < 2.5, read: `a throw at 20 m bursts ${off.toFixed(1)} m from the foe (2.5 at most)` };
});
wall('the trident goes out through what it meets', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); const a = S.tough(S.foe('reaver', 12)), b = S.tough(S.foe('reaver', 18)); a.state = b.state = 'stun'; a.t = b.t = 9; G.combat.log.length = 0; const h0 = a.hp, h1 = b.hp;
  S.tick({ cast: true }); S.wait(50); const T = c.powers.home.T; const hit = S.seen('hit', 'cast').length; return { ok: a.hp < h0 && hit >= 1 && T.state !== 'held', read: `${hit} hit on the way out at 12 m${b.hp < h1 ? ' and 18 m' : ''}; it's ${T.state}, ${T.p.distanceTo(h.pos).toFixed(1)} m out` };
});
wall('it comes home from anywhere within 1.5 s of the call', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; let worst = 0, line = [];
  for (const far of [10, 40, 150, 420]) { S.reset(); S.cleanSong(); S.tick({ cast: true }); S.wait(30); const T = c.powers.home.T; T.p.copy(h.pos); T.p.x += far; T.state = 'hang'; T.hangT = 7; S.wait(1); G.combat.log.length = 0; const t0 = G.time; S.tick({ cast: true }); let n = 0; while (T.state !== 'held' && n++ < 200) S.tick(); const took = G.time - t0; if (T.state !== 'held') took = 99; worst = Math.max(worst, took); line.push(`${far} m ${took.toFixed(2)} s`); }
  return { ok: worst <= 1.5, read: `${line.join(', ')}; the longest ${worst.toFixed(2)} s (1.5 at most)` };
});
wall('the way back bends through foes and hits them', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.tick({ cast: true }); S.wait(10); const T = c.powers.home.T; T.p.copy(S.ahead(30)); T.state = 'hang'; T.hangT = 7; const a = S.tough(S.foe('reaver', 20, 7)), b = S.tough(S.foe('reaver', 10, -6)); for (const e of [a, b]) { e.state = 'stun'; e.t = 60; e.stunGuard = 1e3; } G.combat.log.length = 0; const line0 = T.p.clone(), h0 = a.hp, h1 = b.hp; let off = 0; S.tick({ cast: true }); const to = h.pos.clone().sub(line0).normalize(); let n = 0; while (T.state !== 'held' && n++ < 200) { S.tick(); const q = T.p.clone().sub(line0), al = q.dot(to); off = Math.max(off, q.addScaledVector(to, -al).length()); }
  const back = S.seen('hit', 'cast').length; return { ok: back === 2 && off > 5 && a.hp < h0 && b.hp < h1, read: `${back} hit on the way back, off the straight line by up to ${off.toFixed(1)} m` };
});
wall('with nobody near it still comes home on a curve', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.tick({ cast: true }); S.wait(50); const T = c.powers.home.T, p0 = T.p.clone(); S.tick({ cast: true }); const to = h.pos.clone().sub(p0).normalize(); let off = 0, n = 0; while (T.state !== 'held' && n++ < 200) { S.tick(); const q = T.p.clone().sub(p0), al = q.dot(to); off = Math.max(off, q.addScaledVector(to, -al).length()); }
  return { ok: off > 2 && T.state === 'held', read: `${off.toFixed(1)} m off the straight line` };
});
wall('it leaves his hand and the catch puts it back', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat, a = G.scene.getObjectByName('weapon'), b = G.scene.getObjectByName('weapon_tip'); let ours = false; G.scene.traverse((o) => { if (o.isSkinnedMesh && o.skeleton.bones[G.heroWeaponBone.value] === a) ours = true; }); const len = () => { const p = a.getWorldPosition(new h.pos.constructor()), q = b.getWorldPosition(new h.pos.constructor()); return p.distanceTo(q); };
  S.reset(); S.cleanSong(); S.wait(2); const hand = len(), mesh = c.powers.home.mesh; S.tick({ cast: true }); S.wait(30); const gone = len(), vis = mesh.visible; S.tick({ cast: true }); let n = 0; while (c.powers.home.out && n++ < 200) S.tick(); S.wait(2); const back = len();
  return { ok: ours && hand > 0.5 && gone < 0.01 && vis && !mesh.visible && Math.abs(back - hand) < 0.05, read: `the hero's own bone (${ours}) ${hand.toFixed(2)} m, ${gone.toFixed(3)} m while thrown, ${back.toFixed(2)} m after the catch; the flying one shown only while it's away` };
});
wall('the catch leaves him free to act', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.tick({ cast: true }); S.wait(40); S.tick({ cast: true }); const T = c.powers.home.T; while (T.state !== 'held') { if (T.t / T.dur > 0.6 && !c.cur) { c.startAttack('strike1'); break; } S.tick(); }
  const id = c.cur && c.cur.id; let n = 0; while (T.state !== 'held' && n++ < 200) S.tick(); const same = c.cur && c.cur.id === id, st = h.state; G.combat.log.length = 0; S.tick({ dodge: true }); n = 0; while (n < 40 && !(c.cur && c.cur.id === 'dodge')) { S.tick(); n++; }
  return { ok: !!id && same && n <= 12, read: `a ${id} ran on through the catch (${same ? 'same move' : 'it ended on its own'}, state ${st}); a dodge pressed there answered in ${n} frames (12 at most)` };
});
wall('a Strike pressed while it flies home waits for the catch', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.tick({ cast: true }); S.wait(50); const T = c.powers.home.T; S.tick({ cast: true }); while (T.state === 'back' && (T.dur - T.t) > 0.1) S.tick(); G.combat.log.length = 0; S.tick({ atk: true }); let n = 0; while (n++ < 30 && !S.seen('start', 'strike1').length) S.tick();
  return { ok: S.seen('start', 'strike1').length === 1, read: `the Strike came out ${n} frames after its press, on the catch` };
});
wall('Strike calls it home too, even from a hurt', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.tick({ cast: true }); S.wait(50); const T = c.powers.home.T, from = h.pos.clone(); from.x += 2; h.inv = 0; h.damage(10, from); const st = h.state; S.tick({ atk: true }); S.wait(2);
  return { ok: st === 'hurt' && T.state === 'back', read: `while ${st} the press sent it ${T.state}` };
});
wall('a shield stops the throw, and the way home takes it from behind', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); const e = S.tough(S.foe('captain', 10)); e.heading = Math.atan2(h.pos.x - e.pos.x, h.pos.z - e.pos.z); e.state = 'stun'; e.t = 60; e.stagger = 0; e.guardBroken = 0; G.combat.log.length = 0; const v0 = h.vel.length(); S.tick({ cast: true }); S.wait(40); const T = c.powers.home.T, stopped = T.left <= 0 && T.p.distanceTo(h.pos) < 14, shoved = h.vel.length(), blocked = S.heard('blocked').length;
  // thrown past him, it turns home behind his back
  S.reset(); S.cleanSong(); const f = S.tough(S.foe('captain', 10, 3)); f.heading = Math.atan2(h.pos.x - f.pos.x, h.pos.z - f.pos.z); f.state = 'stun'; f.t = 60; f.stagger = 0; S.tick({ cast: true }); S.wait(50); const hp = f.hp; const Ta = c.powers.home.T; Ta.p.copy(f.pos); const d = f.pos.clone().sub(h.pos).normalize(); Ta.p.addScaledVector(d, 6); Ta.state = 'hang'; Ta.hangT = 7; c.log.length = 0; S.tick({ cast: true }); let n = 0; while (Ta.state !== 'held' && n++ < 200) { S.tick(); f.state = 'stun'; f.t = 60; }
  return { ok: stopped && blocked >= 1 && shoved < 3 && f.hp < hp, read: `the shield stopped it ${T.p.distanceTo(h.pos).toFixed(1)} m out without shoving him (${shoved.toFixed(1)} m/s); from behind on the way home it took ${(hp - f.hp).toFixed(0)}` };
});
wall('a thrown trident comes back for a cinematic and for death', () => {
  const G = window.__game, S = window.__stage, h = G.hero, c = G.combat; S.reset(); S.cleanSong(); S.tick({ cast: true }); S.wait(30); const a = c.powers.home.out; h.state = 'cine'; S.wait(2); const b = c.powers.home.out; h.state = 'swim'; S.cleanSong(); S.tick({ cast: true }); S.wait(30); const d = c.powers.home.out; c.reset(); const e = c.powers.home.out, led = c.powers.shoal.led.length;
  return { ok: a && !b && d && !e && led === 0, read: `away ${a}, after the cinematic ${b}; away ${d}, after a reset ${e}` };
});

let bad = 0; const re = only ? new RegExp(only) : null, t0 = Date.now();
for (const [name, fn] of W) {
  if (re && !re.test(name)) continue;
  let out; try { out = await r.page.evaluate(fn); } catch (e) { out = { ok: false, read: 'threw: ' + e.message.slice(0, 300) }; }
  const group = /dodge answers|moment early|speed carries|Boost held|stops nothing|never snaps|chains into a blow|leaves him free/.test(name) ? 'wall_fluid' : /told|strike at once|off screen|parry a real/.test(name) ? 'wall_telegraph' : /Shatter|Smash|Flash Freeze|Capped|Missile|Ice Path/.test(name) ? 'wall_elements' : /burst/.test(name) ? 'wall_impact' : /fires by|Frost Guard/.test(name) ? 'wall_powers' : /encounter|land|Captain|Archer|Hammerhead/.test(name) ? 'wall_foes' : /song|ring|school|turtle|sharks hunt|rays carry|kind answers|Minnow|Call holds|whale|breach|trident|comes home|way back|nobody near|leaves his hand|Strike pressed|Strike calls|shield stops|its nerve/.test(name) ? 'wall_powers' : /Kraken|Colossus|Frost Wyrm|Leviathan|boss|intro/.test(name) ? 'wall_bosses' : /Duelist|feint|Thornback|cast is met|walled off|knock up/.test(name) ? 'wall_foes' : 'wall_frames';
  console.log((out.ok ? '✔ ' : '✖ ') + `[${group}] ` + name + ': ' + out.read); if (!out.ok) bad++;
}
const errs = [...new Set(r.errors)]; if (errs.length) { console.log('✖ page errors: ' + errs.slice(0, 5).join(' | ').slice(0, 800)); bad++; }
console.log(bad ? `RED: ${bad} failed` : `all green in ${((Date.now() - t0) / 1000).toFixed(1)} s`); await r.close(); process.exit(bad ? 1 : 0);
