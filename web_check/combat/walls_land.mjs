// The fights on the ground. Each: open from where he arrives (G1w's rule, on foot: a walk on a 3 m grid from the sea to the fight, no more than 1.6 times the straight line and 15 m), every foe on
// its feet, every foe reaches him and lands a blow, and the lens holds him among buildings.            node walls_land.mjs [port=8812] [only=regex] [engine]
import { rig } from './rig.mjs'; import { STAGE } from './scenarios.mjs';
const [port = '8791', only = '', engine = 'chromium'] = process.argv.slice(2);
const r = await rig({ port: +port, tier: 'phone', limit: 175, engine }); await r.page.evaluate(STAGE);
await r.page.evaluate(() => {
  const G = window.__game, S = window.__stage, h = G.hero, W = G.world, H = (x, z) => W.heightAt(x, -z), L = (id) => G.enemies.encounters.find((e) => e.id === id); let seed = 5; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  G.quest.isRung = () => false; G.enemies.opened = 9; G.quest.onDeath = () => {}; G.quest.spareFirstFight = () => false; S.lands = G.enemies.encounters.filter((e) => e.land).map((e) => e.id);
  // from the fight out to the sea on foot: a step is 3 m, up at most 42 degrees, nothing solid at chest height
  S.walk = (id) => {
    const e = L(id), C = 3, R = 150, N = (2 * R) / C + 1 | 0, seen = new Int32Array(N * N).fill(-1), at = (i) => i * C - R, c = N >> 1, q = [[c, c]], t = { x: 0, y: 0, z: 0 }; seen[c * N + c] = 0; let sea = null;
    while (q.length && !sea) { const [i, j] = q.shift(), g0 = H(e.c.x + at(i), e.c.z + at(j)); for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + u, b = j + v; if (a < 0 || b < 0 || a >= N || b >= N || seen[a * N + b] >= 0) continue; const x = e.c.x + at(a), z = e.c.z + at(b), g = H(x, z); if (g - g0 > C * 0.9 || (g0 - g > C * 1.6 && g > -1.5) || g0 - g > 8) continue; t.x = x; t.y = -z; t.z = g + 1.1; if (W.collide(t, 0.5)) continue; seen[a * N + b] = seen[i * N + j] + 1; if (g < -1.5) { sea = { x, z, d: seen[a * N + b] * C }; break; } q.push([a, b]); } }
    if (!sea) return { way: Infinity }; const straight = Math.hypot(sea.x - e.c.x, sea.z - e.c.z); return { way: sea.d, straight, x: sea.x, z: sea.z };
  };
  S.ground = (e) => { const g = H(e.pos.x, e.pos.z), s = W.solidTop(e.pos.x, -e.pos.z, e.pos.y); return Math.max(g, s); };
  // he stands off on the way in, foes come to him, and each must land a blow
  S.meet = (id) => {
    const e = L(id); G.enemies.clearAll(); G.combat.reset(); for (const q of G.enemies.encounters) { q.cleared = true; q.state = 'idle'; q.list.length = 0; } e.cleared = false; e.cool = 0; const c = e.c, a = S.walk(id), k = a.way === Infinity ? { x: 0, z: 1 } : { x: (a.x - c.x) / a.straight, z: (a.z - c.z) / a.straight }, off = Math.min(12, (a.straight || 20) * 0.5), x = c.x + k.x * off, z = c.z + k.z * off, g = H(x, z); S.place(x, g + 0.92, z, Math.atan2(c.x - x, c.z - z)); h.land = true; h.air = false; h.grounded = true; h.hp = h.maxHp = 1e6; h.state = 'swim'; h.inv = 0; G.bot = null; S.held = {};
    const got = {}, wrong = []; let t = 0, bad = 0, n = 0; G.combat.log.length = 0;
    while (t < 60) { S.frame(0, null); t += 1 / 60; h.hp = 1e6; h.inv = 0; for (const f of e.list) { if (f.launched > 0 || f.hp <= 0) continue; n++; const off = Math.abs(f.pos.y - (S.ground(f) + 0.92)); f.offT = off > 0.45 || !f.onLand ? (f.offT || 0) + 1 : 0; if (f.offT > 30) { bad++; if (wrong.length < 3) wrong.push(`${f.kind} ${f.onLand ? off.toFixed(1) + ' m off the ground' : 'not on land'}`); } } for (const l of G.combat.log) if (l.type === 'contact') got[l.foe] = (got[l.foe] || 0) + 1; G.combat.log.length = 0; if (e.list.length && e.list.every((f) => got[f.kind]) && t > 4) break; }
    const kinds = e.list.map((f) => f.kind), silent = [...new Set(kinds.filter((k) => !got[k]))]; G.enemies.clearAll(); return { woke: kinds.length, n, bad, wrong, silent, t: +t.toFixed(1), kinds: [...new Set(kinds)] };
  };
  // the lens through a fight there: never in a solid, never too close, and he stays in the frame
  S.lens = (id) => {
    const e = L(id), c = e.c, g = H(c.x, c.z); G.enemies.clearAll(); G.combat.reset(); e.cleared = true; e.state = 'idle'; S.place(c.x, S.groundAt ? 0 : g + 0.92, c.z, 0.6); h.pos.y = g + 0.92; h.land = true; h.air = false; h.grounded = true; let inside = 0, close = 0, off = 0, n = 0, t = 0; const v = new h.pos.constructor(), q = { x: 0, y: 0, z: 0 };
    for (let k = 0; k < 40; k++) { G.camYaw += 0.157; for (let i = 0; i < 8; i++) { S.frame(0, null); t++; n++; const P = G.camera.position; q.x = P.x; q.y = -P.z; q.z = P.y; if (W.collide(q, 0.12)) inside++; if (P.distanceTo(h.pos) < 1.3) close++; v.copy(h.pos).project(G.camera); if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) off++; } }
    return { n, inside, close, off };
  };
});
let bad = 0; const re = only ? new RegExp(only) : null; const ids = await r.page.evaluate(() => window.__stage.lands);
for (const id of ids) {
  if (re && !re.test(id)) continue; const a = await r.page.evaluate((i) => window.__stage.walk(i), id), m = await r.page.evaluate((i) => window.__stage.meet(i), id), l = await r.page.evaluate((i) => window.__stage.lens(i), id);
  const open = a.way !== Infinity && a.way <= a.straight * 1.6 + 15, ok = open && m.bad === 0 && !m.silent.length && m.woke >= 2 && l.inside === 0 && l.close / l.n < 0.02 && l.off / l.n < 0.02; if (!ok) bad++;
  console.log((ok ? '✔ ' : '✖ ') + `[wall_land] ${id}: a walk of ${a.way === Infinity ? 'none' : a.way + ' m'} from the sea${a.straight ? ' for a straight ' + a.straight.toFixed(0) + ' m to ' + a.x.toFixed(0) + ',' + a.z.toFixed(0) + ' from ' + (await r.page.evaluate((i) => { const e = window.__game.enemies.encounters.find((q) => q.id === i); return e.c.x.toFixed(0) + ',' + e.c.z.toFixed(0); }, id)) : ''}; ${m.woke} foes (${m.kinds.join(' ')}), ${m.bad} of ${m.n} readings off the ground${m.wrong.length ? ' [' + m.wrong.join('; ') + ']' : ''}; ${m.silent.length ? 'never landed a blow: ' + m.silent.join(' ') : 'all landed a blow in ' + m.t + ' s'}; the lens turning round him: ${l.inside} in a solid, ${l.close} too close, ${l.off} of ${l.n} with him out of frame`);
}
const errs = [...new Set(r.errors)]; if (errs.length) { console.log('✖ page errors: ' + errs.slice(0, 4).join(' | ').slice(0, 600)); bad++; }
console.log(bad ? `RED: ${bad} failed` : 'all green'); await r.close(); process.exit(bad ? 1 : 0);
