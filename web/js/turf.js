// Turf (Randy, 2 Nov: "We need to discourage the elementals from fighting in their enemies turf. The fire elementals must be afraid of the water and water elementals must be afraid of the sky ones but they can reach each other").
// Nothing here stops anyone going anywhere. Each side pays for being on the other's ground, and the player is told what's happening. Numbers in combat.json `turf`.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createTurf(G) {
  const T = { fear: 0, where: '', told: {}, disarmed: 0 };
  const tell = (k, big, small) => { if (T.told[k]) return; T.told[k] = 1; G.ui.toast(big, small, 4); };
  T.step = (dt) => {
    const h = G.hero, Q = G.combat.data && G.combat.data.turf; if (!Q || h.dead) return; T.disarmed = Math.max(0, T.disarmed - dt);
    const g = h.groundAt ? h.groundAt(h.pos.x, h.pos.z) : 0, open = g < -0.5, fire = G.sideNow === 'fire'; let fear = 0, where = '';
    if (fire) {
      if (h.pos.y < -0.2 && open) { fear = 1; where = 'sea'; h.tide = Math.max(0, h.tide - Q.sea_tide * dt); if (h.inv <= 0) h.hp = Math.max(1, h.hp - Q.sea_hp * dt); tell('sea', 'The sea is killing your fire', 'Get out. Boost lifts you off the water, at a price'); }
      else if (open && h.pos.y < Q.low_m) { fear = 0.5; where = 'low'; h.tide = Math.max(0, h.tide - Q.low_tide * dt); tell('low', 'Low over the water', 'The jets are weak here. Climb'); }
    } else if (h.pos.y > Q.high_m && !h.carried) {
      fear = clamp((h.pos.y - Q.high_m) / 20, 0.4, 1); where = 'sky'; if (h.tide > 0) h.tide = Math.max(0, h.tide - Q.sky_tide * fear * dt); else if (h.inv <= 0) h.hp = Math.max(1, h.hp - Q.sky_hp * dt); tell('sky', 'Far from the water', 'Your tide is running out up here, and your blows are weak');
    }
    T.fear = fear; T.where = where; if (fear > 0.4 && (T.pulse = (T.pulse || 0) - dt) <= 0) { T.pulse = 1.1; G.ui.hurt && G.ui.hurt(0.25 * fear); }
  };
  // what a blow is worth, out of his element or into a body the sea has disarmed
  T.dealt = () => { const Q = G.combat.data.turf; return T.where === 'sky' || T.where === 'sea' ? Q.dealt_k : 1; };
  T.taken = () => { const Q = G.combat.data.turf; return T.where === 'sky' || T.where === 'sea' ? Q.taken_k : T.disarmed > 0 ? Q.hurt_k : 1; };
  T.speed = () => (T.where === 'low' ? G.combat.data.turf.speed_k : 1);
  return T;
}
