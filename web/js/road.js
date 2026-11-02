// The fire side's road: what a player on this side is doing, step by step, the way the water side has its story. Take to the air, reach the High City, stand on the rim of the volcano, break the raids, beat the Tidecaller, carry the fight to the harbour, bring down the Last Seawall. After that the world is his.
import * as THREE from 'three';

export function createRoad(G) {
  const at = (x, y, z) => new THREE.Vector3(x, z, -y), near = (p, m) => G.hero.pos.distanceTo(p) < m, kills = () => G.ember.raids ? G.ember.raids.kills || 0 : 0;
  const STEPS = [
    { text: 'Take off: hold Boost, then Jump', done: () => G.hero.fireAir },
    { text: 'Hold Fly and reach the High City', to: at(306, -806, 92), done: (s) => near(s.to, 60) },
    { text: 'Stand on the rim of the volcano', to: at(378, -874, 112), done: (s) => near(s.to, 46) },
    { text: 'Break the raids: bring down three', done: () => kills() >= 3 },
    { text: 'Beat the Tidecaller', done: () => G.ember.champions().beaten },
    { text: 'Carry the fire to Sunward Harbour', to: at(-316, -563, 8), done: (s) => near(s.to, 80) },
    { text: 'Bring down the Last Seawall', done: () => { const b = G.bosses && G.bosses.seawall; return b && b.dead; } },
    { text: '', end: true },
  ];
  let i = 0; try { i = Math.min(STEPS.length - 1, parseInt(localStorage.getItem('thalor.road') || '0', 10) || 0); } catch (_) { /* from the start, then */ }
  return {
    step() {
      const s = STEPS[i]; if (s.end || !s.done(s) || G.sideNow !== 'fire') return; i++; try { localStorage.setItem('thalor.road', String(i)); } catch (_) { /* this visit */ } G.audio.bell && G.audio.bell(); const n = STEPS[i]; if (n.end) G.ui.toast('The world is yours', 'Go where you like. Pause, then Watch the duel', 6); else G.ui.tip && G.ui.tip(n.text, 3.5); G.combat.log.push({ t: G.time, type: 'road', i });
    },
    text: () => STEPS[i].text, target: () => STEPS[i].to || null, get at() { return i; }, set at(k) { i = k; },
  };
}
