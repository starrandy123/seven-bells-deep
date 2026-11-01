// A fighter who presses what a player presses, at one of three skills. It reads only what a player can see: a foe's tell, how far away things are, its own tide and cooldowns.
// The walls use it to prove every fight can be won by each kind of player; bot.js can hand it a fight with G.fighter = createFighter(G, 'casual').
const SKILL = {
  novice: { react: 0.42, parry: 0, dodge: 0.3, powers: 0.25, every: 0.34, stance: false, finish: false, close: 3.6 },
  casual: { react: 0.3, parry: 0.3, dodge: 0.55, powers: 0.7, every: 0.27, stance: false, finish: true, close: 3.2 },
  expert: { react: 0.16, parry: 0.8, dodge: 0.9, powers: 1, every: 0.2, stance: true, finish: true, close: 3, reads: true },
  masher: { react: 9, parry: 0, dodge: 0, powers: 0, every: 0.2, stance: false, finish: false, close: 3 },      // holds Strike and reads nothing: the walls measure what reads are worth against him
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function createFighter(G, level = 'casual') {
  const K = SKILL[level] || SKILL.casual; let press = 0, seen = new Map(), plan = null, stanceT = 0;
  // a tell a player has noticed: it takes `react` seconds to see it, and then he decides once
  function threat(foes, dt) {
    for (const e of foes) {
      const telling = e.state === 'tell' && e.blow;
      if (!telling) { seen.delete(e); continue; }
      const s = seen.get(e) || { t: 0, done: false }; s.t += dt; seen.set(e, s);
      // a feint's hang shows on the rim: an expert waits for the true beat, anyone else parries on the first
      const left = e.blow.tell_s + (K.reads ? e.blow.feint_s || 0 : 0) - e.clock, near = e.pos.distanceTo(G.hero.pos) < (e.def.brain === 'archer' ? 40 : 12);
      if (!s.done && s.t >= K.react && near) {
        s.done = true; const r = rnd(), blocked = !!e.blow.unblockable;
        if (r < K.parry && !blocked) plan = { what: 'parry', at: left + (e.def.brain === 'archer' ? e.pos.distanceTo(G.hero.pos) / (e.blow.speed_mps || 30) : 0) - 0.2 };
        else if (r < K.parry + K.dodge) plan = { what: 'dodge', at: left + (e.def.brain === 'archer' ? e.pos.distanceTo(G.hero.pos) / (e.blow.speed_mps || 30) : 0) - 0.08 };
      }
    }
  }
  return {
    level,
    drive(u, dt) {
      const h = G.hero, foes = G.enemies.alive(), C = G.combat; press -= dt; stanceT -= dt;
      if (h.dead) return;
      threat(foes, dt);
      if (plan) { plan.at -= dt; if (plan.at <= 0) { if (plan.what === 'parry') u.parry = true; else { const s = Math.sign(Math.sin(G.time * 3)) || 1; u.dodge = true; u.mx = s; } plan = null; } }
      let goal = null, cd = 1e9, close = null;
      for (const e of G.enemies.all ? G.enemies.all().filter((q) => q.hp > 0) : foes) { const d = e.pos.distanceTo(h.pos); if (d < cd) { cd = d; close = e; } }
      const boss = G.boss && G.boss.active ? G.boss : null;
      if (boss) { const l = boss.stunned > 0 ? boss.headT : boss.lockPoint(h.pos); if (l && l.pos.distanceTo(h.pos) < cd) { cd = l.pos.distanceTo(h.pos); close = l; } if (boss.mode === 'bite' && boss.head.distanceTo(h.pos) < 8) { if (rnd() < K.parry * 0.25) u.parry = true; else if (rnd() < K.dodge * 0.2) u.dodge = true; } }
      if (close) goal = close.pos;
      let aimOnly = false;
      if (boss && boss.slammers) { const a = boss.slammers.find((q) => q.state === 'tell' && !q.gone && !q.seen); if (a && a.t < 0.3 && a.mark.distanceTo(h.pos) < 6) { a.seen = true; if (rnd() < 0.5 + K.dodge * 0.5) { u.dodge = true; const s = rnd() < 0.5 ? 1 : -1; u.mx = s; } } for (const q of boss.slammers) if (q.state !== 'tell') q.seen = false; }
      if (boss && boss.vents && !(boss.openT > 0) && C.power('lance').open) {
        // the vents: Ice, look at the next one that runs, throw
        const v = boss.vents.find((q) => q.l && !q.l.capped && !q.capped && q.l.on);
        if (v) { goal = v.p; aimOnly = true; if (C.stance !== 'ice' && stanceT <= 0) { u.stance = true; stanceT = 0.8; } const dx0 = v.p.x - h.pos.x, dz0 = v.p.z - h.pos.z, on = Math.abs(wrap(Math.atan2(dx0, dz0) - G.camYaw)) < 0.3; if (on && C.stance === 'ice' && C.power('lance').cool <= 0 && C.power('lance').afford) u.dash = true; }
      } else if (boss && boss.vents && C.stance === 'ice' && stanceT <= 0) { u.stance = true; stanceT = 1; }
      if (!goal) { u.my = 0; return; }
      const dx = goal.x - h.pos.x, dy = goal.y - h.pos.y, dz = goal.z - h.pos.z, flat = Math.hypot(dx, dz), d = Math.hypot(flat, dy);
      G.camYaw = wrap(G.camYaw + wrap(Math.atan2(dx, dz) - G.camYaw) * (1 - Math.exp(-5 * dt)));
      G.camPitch += (Math.max(-1.1, Math.min(1.1, Math.atan2(dy, Math.max(flat, 1)))) - G.camPitch) * (1 - Math.exp(-4 * dt));
      u.my = !aimOnly && d > K.close ? 1 : 0; u.mx = u.mx || 0; u.ud = 0;
      if (aimOnly) return;
      // he stops on a set Duelist or a spined Thornback, and lets them come
      const wary = K.reads && close && (close.stance > 0 || close.spine);
      if (cd < 7 && press <= 0 && !wary) { u.atk = true; press = K.every; }
      if (cd >= 7 && cd < 15 && press <= 0 && C.stance === 'water') { u.atk = true; press = K.every * 2; }  // the whip
      if (rnd() < K.powers * dt * 2 && h.tide > 45) {
        const s = C.data.stances[C.stance].slots, keys = ['dash', 'spin', 'wave', 'p4'], i = Math.floor(rnd() * 3), id = s[i];
        if (C.power(id).open && C.power(id).cool <= 0 && C.power(id).afford) { if (id !== 'icepath') u[keys[i]] = true; }
      }
      if (K.stance && stanceT <= 0 && C.power('lance').open) {
        // the expert soaks them, then freezes what's soaked
        const soaked = foes.some((e) => e.soaked > 0 && e.frozen <= 0 && e.pos.distanceTo(h.pos) < 16), broke = foes.some((e) => e.frozen > 0);
        if ((C.stance === 'water' && soaked) || (C.stance === 'ice' && !broke && !foes.some((e) => e.soaked > 0))) { u.stance = true; stanceT = 2.4; }
      }
    },
  };
}
