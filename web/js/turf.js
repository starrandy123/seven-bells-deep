// Turf (Randy, 2 Nov: "We need to discourage the elementals from fighting in their enemies turf. The fire elementals must be afraid of the water and water elementals must be afraid of the sky ones but they can reach each other").
// Nothing here stops anyone going anywhere. Each side pays for being on the other's ground, and the player is told what's happening. Numbers in combat.json `turf`.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createTurf(G) {
  const T = { fear: 0, where: '', told: {}, disarmed: 0, dragged: false };
  const tell = (k, big, small) => { if (T.told[k]) return; T.told[k] = 1; G.ui.toast(big, small, 4); };
  T.step = (dt) => {
    const h = G.hero, Q = G.combat.data && G.combat.data.turf; if (!Q || h.dead) return; T.disarmed = Math.max(0, T.disarmed - dt);
    // out of the sea after a drag: a moment no blow can land, so he never loses by the world
    if (T.dragged && (h.pos.y > 0.2 || h.air)) { T.dragged = false; h.inv = Math.max(h.inv, Q.out_inv_s); }
    // held by a column of water, he's its, not the sea's: nothing here till it lets him go
    if (h.carried) { T.fear = 0; T.where = ''; return; }
    const g = h.groundAt ? h.groundAt(h.pos.x, h.pos.z) : 0, open = g < -0.5, fire = G.sideNow === 'fire'; let fear = 0, where = '';
    if (fire) {
      if (h.pos.y < -0.2 && open) { fear = 1; where = 'sea'; h.tide = Math.max(0, h.tide - Q.sea_tide * dt); if (h.inv <= 0) h.hp = Math.max(1, h.hp - Q.sea_hp * dt); tell('sea', 'The sea is killing your fire', 'Get out. Boost lifts you off the water, at a price'); }
      else if (open && h.pos.y < Q.low_m) { fear = 0.5; where = 'low'; h.tide = Math.max(0, h.tide - Q.low_tide * dt); tell('low', 'Low over the water', 'The jets are weak here. Climb'); }
    } else if (!h.carried && skyNow(h, g, dt)) {
      fear = T.onFort ? 1 : clamp((h.pos.y - g - Q.high_m) / 20, 0.4, 1); where = 'sky'; if (h.tide > 0) h.tide = Math.max(0, h.tide - Q.sky_tide * fear * dt); else if (h.inv <= 0) h.hp = Math.max(1, h.hp - Q.sky_hp * dt); tell('sky', 'Far from the water', 'Your tide is running out up here, and your blows are weak');
    }
    T.fear = fear; T.where = where; if (fear > 0.4 && (T.pulse = (T.pulse || 0) - dt) <= 0) { T.pulse = 1.1; G.ui.hurt && G.ui.hurt(0.25 * fear); }
  };
  // dragged into the sea by a tornado: the jets are dead for jets_s, the powers for disarm_hero_s, and the fall in costs hurt_hp, never the last of him. Pipeline/research/WORLD_RESPONSE_SOURCES.md
  T.drag = () => {
    const h = G.hero, Q = G.combat.data.turf; T.disarmed = Q.disarm_hero_s; T.dragged = true; h.hp = Math.max(1, h.hp - Q.hurt_hp); G.ui.hurt && G.ui.hurt(0.7);
    if (h.endFly) h.endFly(); G.combat.log.push({ t: G.time, type: 'disarmed', hp: Math.round(h.hp) }); tell('disarmed', 'Disarmed', 'The sea has your fire. Swim, or jet out when it lets go');
  };
  T.jetsDead = () => T.disarmed > G.combat.data.turf.disarm_hero_s - G.combat.data.turf.jets_s;
  // the sky is a place, not a height (R59): on or over a sky city or fort, or more than high_m over the ground with no water within 60 m. A hilltop isn't the sky
  function skyNow(h, g, dt) {
    if ((T.skyT = (T.skyT || 0) - dt) > 0) return T.sky; T.skyT = 0.5; const W = G.world, p = h.pos, Q = G.combat.data.turf; T.onFort = false;
    for (const q of W.data.poi || []) if ((q.fort || q.id === 'sky_city') && Math.hypot(q.x - p.x, -q.y - p.z) < q.r && p.y > q.z - 12) T.onFort = true;
    let on = T.onFort; if (!on && p.y - g > Q.high_m) { on = true; for (const r of [30, 60]) for (let k = 0; k < 8 && on; k++) if (W.heightAt(p.x + Math.cos(k * 0.785) * r, -(p.z + Math.sin(k * 0.785) * r)) < -0.5) on = false; }
    return (T.sky = on);
  }
  // what a blow is worth, out of his element or into a body the sea has disarmed
  T.dealt = () => { const Q = G.combat.data.turf; return T.where === 'sky' || T.where === 'sea' ? Q.dealt_k : 1; };
  T.taken = () => { const Q = G.combat.data.turf; return T.where === 'sky' || T.where === 'sea' ? Q.taken_k : T.disarmed > 0 ? Q.hurt_k : 1; };
  T.speed = () => (T.where === 'low' ? G.combat.data.turf.speed_k : 1);
  return T;
}
