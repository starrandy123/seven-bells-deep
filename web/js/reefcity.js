// What grows on a drowned city. Real wrecks and sunken streets grow by exposure: corners and tops catch the current and carry the most, kelp roots on hard stone, silted flats stay poor (Pipeline/research/WORLD_SOURCES.md). So each building gets its own small reef at its foot and its corners. The stone's own crust is drawn in city_glsl.js.
import * as THREE from 'three';

const KELP = 2, CORAL = 2;
export function dressReefCity(cities, sets, heightAt) {
  const add = { kelp_stalk: [], coral_fan: [], coral_branch: [], coral_tube: [], anemone: [], glow_coral: [] }, kinds = ['glow_coral', 'coral_fan', 'glow_coral', 'coral_branch', 'glow_coral', 'coral_tube', 'anemone']; let s = 60493; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const c of cities) {
    if (c.def.kind !== 'sea') continue; const A = sets[c.def.id] || sets.sea;
    for (const t in c.inst) {
      if (t === 'lamp' || t === 'plinth') continue; const W = (A && A[t] && A[t].W) || 12;
      for (const b of c.inst[t]) {
        const [x, y, , yaw] = b, ca = Math.cos(yaw), sa = Math.sin(yaw), corner = () => { const u = (rnd() < 0.5 ? -1 : 1) * (W / 2 + 0.6 + rnd() * 1.8), v = (W / 2 + 0.6 + rnd() * 1.8) * (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.7 ? 1 : rnd()); return [x + u * ca - v * sa, y + u * sa + v * ca]; };
        for (let i = 0; i < KELP; i++) { if (rnd() < 0.3) continue; const [px, py] = corner(), z = heightAt(px, py); if (z > -8) continue; add.kelp_stalk.push(px, py, z - 0.1, rnd() * 6.283, 0.7 + rnd() * 0.8, rnd()); }
        for (let i = 0; i < CORAL; i++) { const [px, py] = corner(), z = heightAt(px, py); if (z > -5) continue; const k = kinds[Math.floor(rnd() * kinds.length)]; add[k].push(px, py, z - 0.08, rnd() * 6.283, (k === 'glow_coral' ? 1.2 : 0.6) + rnd() * 1.1, rnd()); }
      }
    }
  }
  return add;
}

// The streams of moving light along a drowned city's avenues: the thing that says this place is alive. One sprite each, only near him, so a phone pays for what it can see
export function createCityLights(G, cities, heightAt) {
  const lanes = [], COLS = [[1.0, 0.78, 0.4], [0.4, 0.95, 1.0], [0.95, 0.95, 1.0], [1.0, 0.5, 0.75]].map((c) => new THREE.Color(...c));
  for (const c of cities) {
    if (c.def.kind !== 'sea') continue; const R = c.p.r * 0.9, a = c.def.angle, cx = c.p.x, cy = c.p.y, B = c.def.block;
    for (let i = -3; i <= 3; i++) for (const q of [0, 1]) { const dir = a + q * Math.PI / 2, ca = Math.cos(dir), sa = Math.sin(dir), off = i * B + 2, ox = cx - sa * off, oy = cy + ca * off; lanes.push({ c, ox, oy, ca, sa, R, z: heightAt(ox, oy) + 8 + ((i + 3) % 3) * 4, back: (i + q) % 2 ? -1 : 1, v: 7 + ((i + 3) % 4) * 2.5, col: COLS[(i + 3 + q) % COLS.length] }); }
  }
  const v = new THREE.Vector3();
  return { frame() {
    const cam = G.camera.position; if (cam.y > -3) return; let n = 0, most = G.tier === 'phone' ? 70 : 130;
    for (const L of lanes) {
      const dcx = L.ox - cam.x, dcy = L.oy + cam.z; if (dcx * dcx + dcy * dcy > 260 * 260) continue;
      for (let k = 0; k < 9 && n < most; k++) { const s = (((G.time * L.v * L.back + k * 15) % (L.R * 2)) + L.R * 2) % (L.R * 2) - L.R; v.set(L.ox + L.ca * s, L.z + Math.sin(k * 2.1 + G.time * 0.7) * 0.5, -(L.oy + L.sa * s)); if (v.distanceToSquared(cam) > 170 * 170) continue; G.fx.ball(v, 0.5 + v.distanceTo(cam) * 0.012, L.col, 0.9, 0.9, 1); n++; }
    }
  } };
}
