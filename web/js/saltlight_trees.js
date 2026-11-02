// Saltlight's trees, from the AAA3d city's vegetation kit (orgo_u/aaa3d at fe8f7c1, geo/kitVeg.js: trees grown branch by branch, leaf cards sized to the crown they hang on, wind in the
// vertex stage, three tiers to a tree down to a four-triangle crossed card with its bole). Randy, 2 Nov: "It also looks flat with no foliage. We have AAA3d city here in the orgo_u repo. Use that".
// Where they stand is New York's own rule (NYC Parks, Tree Planting Standards, A. Spacing Requirements): 20-30 ft apart centre to centre, at least 25 ft from a streetlight and 40 ft from the
// middle of a crossing, in a pit against the kerb 4-5 ft by 10 ft. Saltlight's lamps stand every 18 m (streetlife.js), so a tree stands midway between two, 9 m from each, on every side of every
// block; a row along the harbour promenade; a ring round the Bell Ring's bowl.
// Cut to a phone: one instanced draw per prototype and tier, near trees as themselves, far ones as their crossed card, re-sorted five times a second.
import * as THREE from 'three';
import createVeg from './aaa3d/kitVeg.js';

export function createSaltlightTrees({ scene, look, plan, phone, ground, grid, land }) {
  // a film run streams all it can see, unless asked for the game's own budget (lod=game: how the cost is measured)
  const film = typeof location !== 'undefined' && /[?&]film\b/.test(location.search) && !/[?&]lod=game\b/.test(location.search);
  const veg = createVeg(null, null, null, { seed: 4021, anisotropy: phone ? 2 : 4 });
  // two prototypes for the streets (a field maple and an oak, the kit's broadleaves), a poplar for the promenade, as a waterfront's row is
  // on a phone the promenade takes the maple too: one prototype fewer is three draws fewer
  const PROTO = phone && !film ? [veg.tree('maple', 11), veg.tree('oak', 23)] : [veg.tree('maple', 11), veg.tree('oak', 23), veg.tree('poplar', 37)];
  const mats = { bark: PROTO[0].materials.bark, leaf: PROTO[0].materials.leaf };
  // the game's light, fog and sky over the kit's own shading (look.js chains onto the kit's wind)
  look.patch(mats.bark, { key: 'sl_aaa_bark' }); look.patch(mats.leaf, { key: 'sl_aaa_leaf', wrap: 0.35 });

  // where they stand, in the plan's frame (x, y as the world's data)
  const { PITCH, BLOCK, COLS, ROWS } = grid, HB = BLOCK / 2, cx = plan.center.x, cy = plan.center.y, ring = plan.ring, spots = [];
  const r = (() => { let s = 77; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const taken = (i, j) => (i >= ring.i0 && i <= ring.i0 + 1 && j >= ring.j0 && j <= ring.j0 + 1) || (Math.abs(cx + i * PITCH - plan.mast.x) < 1 && Math.abs(cy + j * PITCH - plan.mast.y) < 1);
  for (let i = COLS[0]; i <= COLS[1]; i++) for (let j = ROWS[0]; j <= ROWS[1]; j++) {
    if (taken(i, j)) continue;
    const bx = cx + i * PITCH, by = cy + j * PITCH, E = HB + 1.9;
    // the four kerbs of the block, each 52 m: a tree at 17 m and 35 m, midway between the lamps at 8, 26 and 44
    for (const [ax, ay, tx, ty] of [[1, 0, 0, 1], [-1, 0, 0, -1], [0, 1, -1, 0], [0, -1, 1, 0]]) for (const u of [17, 35]) {
      const t = u - HB; spots.push({ x: bx + ax * E + tx * t, y: by + ay * E + ty * t, p: r() < 0.55 ? 0 : 1, s: 0.8 + r() * 0.3, yaw: r() * 6.283 });
    }
  }
  // the promenade along the north quay: a row 4 m in from the parapet, 9 m apart, between the west quay's corner and where the beach begins
  for (let x = land.QW + 20; x < land.QE - 4; x += 9) spots.push({ x, y: land.QN - 4, p: PROTO.length > 2 ? 2 : 0, s: 0.75 + r() * 0.25, yaw: r() * 6.283 });
  // the pocket parks: a grove on each lawn, two rows
  for (const k of plan.parks || []) for (let a = -1; a <= 1; a += 2) for (let b = -1; b <= 1; b += 2) spots.push({ x: k.x + a * k.w * 0.25 + (r() - 0.5) * 2, y: k.y + b * k.d * 0.25 + (r() - 0.5) * 2, p: r() < 0.5 ? 0 : 1, s: 0.85 + r() * 0.3, yaw: r() * 6.283, park: k });
  // round the Bell Ring's bowl
  for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.283; spots.push({ x: ring.x + Math.cos(a) * (ring.BOWL + 6), y: ring.y + Math.sin(a) * (ring.BOWL + 6), p: k % 2, s: 0.85 + r() * 0.2, yaw: r() * 6.283 }); }
  for (const t of spots) t.z = t.park ? t.park.z + 0.3 : ground(t.x, t.y);

  // one instanced draw per prototype and tier: tier 1 (its middle detail) near, its crossed card far. A phone keeps the middle tier inside 80 m; a film run the full tree inside 40 m
  const near = film ? 0 : 1, NEAR = film ? 260 : phone ? 45 : 140, draws = [];
  for (let p = 0; p < PROTO.length; p++) {
    const T = PROTO[p].lodTiers, tn = T[near], tf = T[2], mk = (geo, mat, name) => { const m = new THREE.InstancedMesh(geo, mat, spots.length); m.count = 0; m.frustumCulled = false; m.name = name; scene.add(m); return m; };
    draws.push({ p, trunk: tn.trunk ? mk(tn.trunk, mats.bark, 'sl_aaa_trunk_' + p) : null, crown: mk(tn.canopy, mats.leaf, 'sl_aaa_crown_' + p), card: mk(tf.canopy, mats.leaf, 'sl_aaa_card_' + p) });
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  let t = 0, simT = 0;
  function update(camera, dt = 0.016) {
    simT += dt; veg.update(dt);
    // the kit's sun is the game's
    const sa = look.uniforms.ocSunA && look.uniforms.ocSunA.value; if (sa) veg.setSun({ x: sa.x, y: sa.y, z: sa.z }, { x: 1, y: 0.97, z: 0.92 }, sa.y > 0 ? 1 : 0);
    t -= dt; if (t > 0) return; t = film ? 0 : 0.2;
    const c = camera.position;
    for (const d of draws) { if (d.trunk) d.trunk.count = 0; d.crown.count = 0; d.card.count = 0; }
    for (const s of spots) {
      const d = draws[s.p], dist = Math.hypot(c.x - s.x, c.y - s.z, c.z + s.y);
      Q.setFromAxisAngle(Y, s.yaw); M.compose(P.set(s.x, s.z, -s.y), Q, S.set(s.s, s.s, s.s));
      if (dist < NEAR) { if (d.trunk) d.trunk.setMatrixAt(d.trunk.count++, M); d.crown.setMatrixAt(d.crown.count++, M); }
      else d.card.setMatrixAt(d.card.count++, M);
    }
    for (const d of draws) for (const m of [d.trunk, d.crown, d.card]) if (m) { m.instanceMatrix.needsUpdate = true; m.visible = m.count > 0; }
  }
  return { update, spots, veg, get stats() { const st = veg.stats(); return { trees: spots.length, textureMB: +st.textureMB.toFixed(1), drawn: draws.reduce((a, d) => a + (d.trunk ? d.trunk.count : 0) + d.crown.count + d.card.count, 0) }; } };
}
