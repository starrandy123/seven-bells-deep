// Hunts a NaN in a foe: every step, every foe's position and velocity read before and after each stage, the first bad one named with what wrote it.
import { rig } from './rig.mjs'; import { STAGE } from './scenarios.mjs';
const r = await rig({ port: 8791, limit: 170 }); await r.page.evaluate(STAGE);
const out = await r.page.evaluate(async () => {
  const G = window.__game, S = window.__stage, h = G.hero, m = await import('/js/combat_bot.js'); S.spot = S.open(); let seed = 9; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const bad = (v) => !(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z));
  let found = null; const check = (where, f) => { if (found) return; for (const e of G.enemies.all()) { if (bad(e.pos) || bad(e.vel)) { found = { where, f, kind: e.kind, state: e.state, pos: [e.pos.x, e.pos.y, e.pos.z], vel: [e.vel.x, e.vel.y, e.vel.z], t: e.t, slow: e.slow, pull: e.pull, launched: e.launched, frozen: e.frozen, missile: e.missile, blow: e.blow && e.blow.id, log: G.combat.log.slice(-6).map((l) => l.type + ':' + (l.id || l.foe || '')) }; return; } } };
  const es = G.enemies.step; G.enemies.step = (dt) => { check('before foes.step', fr); es(dt); check('after foes.step', fr); };
  const hs = h.step; h.step = (dt) => { hs(dt); check('after hero.step', fr); };
  let fr = 0; h.hp = h.maxHp = 1e6; h.tide = h.maxTide = 1e6; const kinds = Object.keys(G.combat.data.foes).filter((k) => k !== '_doc'), bot = m.createFighter(G, 'expert'); S.frame = () => G.frame(1 / 60); G.bot = bot;
  const spots = [S.spot]; { const H = (x, z) => G.world.heightAt(x, -z), size = (G.world.data.size_m || 1280) / 2; for (let k = 0; k < 400 && spots.length < 8; k++) { const x = (Math.random() - 0.5) * 2 * (size - 60), z = (Math.random() - 0.5) * 2 * (size - 60), g = H(x, z); if (g < -2 && g > -7) spots.push({ x, y: Math.min(-1.5, g + 2), z }); } }
  const stances = ['water', 'ice']; let n = 0;
  while (fr < 26000 && !found) {
    const sp = spots[n % spots.length]; G.enemies.clearAll(); G.combat.reset(); S.place(sp.x, sp.y, sp.z, Math.random() * 6); h.hp = 1e6; h.tide = 1e6; h.dead = false; h.state = 'swim'; G.combat.setStance(stances[n % 2], true);
    for (let i = 0; i < 4; i++) { const e = S.foe(kinds[(n + i * 3) % kinds.length], 6 + i * 2, i - 1.5, 0.3); if (e) { e.hp = e.maxHp = 3000; } }
    for (let f = 0; f < 700 && !found; f++) { fr++; h.hp = 1e6; h.tide = 1e6; for (const k in G.combat.cool) G.combat.cool[k] = 0; G.frame(1 / 60); }
    n++;
  }
  return { fr, rounds: n, found };
});
console.log(JSON.stringify(out).slice(0, 1200)); console.log('errors', [...new Set(r.errors)].slice(0, 4)); await r.close();
