// ?demo: the game plays itself, for checks and films. It presses the same inputs a player has.
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createBot(G) {
  let t = 0, press = 0;
  return {
    drive(u, dt) {
      t += dt; press -= dt;
      if (G.quest.botDrive && G.quest.botDrive(u, dt)) return;
      const h = G.hero, foes = G.enemies.alive();
      let goal = G.quest.target(), close = null, cd = 1e9;
      for (const e of foes) { const d = e.pos.distanceTo(h.pos); if (d < cd) { cd = d; close = e; } }
      if (close && cd < 16) goal = close.pos;
      if (G.boss && G.boss.active) {
        const b = G.boss, lock = b.lockPoint(h.pos); goal = (lock && lock.pos) || b.head;
        const hd = b.head.distanceTo(h.pos);
        if (b.mode === 'bite' && hd < 7 && h.state === 'swim') u.parry = true;
        if (b.stunned > 0) goal = b.head;
        if (goal.distanceTo(h.pos) < 9 && press <= 0) { u.atk = true; press = 0.26; }
        if (h.powers.wave && h.cool.wave <= 0 && hd < 28) u.wave = true;
        if (h.powers.call && h.cool.call <= 0 && hd < 30) u.call = true;
      }
      if (!goal) { u.my = 0.4; return; }
      const dx = goal.x - h.pos.x, dy = goal.y - h.pos.y, dz = goal.z - h.pos.z, flat = Math.hypot(dx, dz), d = Math.hypot(flat, dy);
      G.camYaw = wrap(G.camYaw + wrap(Math.atan2(dx, dz) - G.camYaw) * (1 - Math.exp(-3.5 * dt)));
      const p = Math.atan2(dy, Math.max(flat, 1)); G.camPitch += (Math.max(-1.1, Math.min(1.1, p)) - G.camPitch) * (1 - Math.exp(-3 * dt));
      const stand = close && cd < 16 ? 2.6 : 1.2;
      u.my = d > stand ? 1 : 0; u.mx = 0; u.ud = 0; u.boost = d > 26;
      if (close && cd < 9 && press <= 0) { u.atk = true; press = 0.28; }
      if (close && cd < 9 && h.powers.spin && h.cool.spin <= 0 && foes.length > 1) u.spin = true;
      if (close && cd > 7 && cd < 22 && h.powers.dash && h.cool.dash <= 0) u.dash = true;
      if (close && cd < 28 && h.powers.wave && h.cool.wave <= 0) u.wave = true;
      if (!close && d < 8 && press <= 0) { u.atk = true; press = 0.7; }   // a bell
    },
  };
}
