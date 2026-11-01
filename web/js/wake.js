// What a stride can't show past its limit (M6): a dust wake on the ground and afterimages of him. One draw for the dust, one a ghost, both capped; nothing runs below their speed.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DUST = 44, GHOSTS_PHONE = 2, GHOSTS_DESK = 3;

export function createWake(G, h, mesh) {
  // ---------------------------------------------------------------- dust: soft puffs that stay where they were kicked up and fade
  const geo = new THREE.InstancedBufferGeometry(); geo.index = new THREE.PlaneGeometry(1, 1).index; geo.setAttribute('position', new THREE.PlaneGeometry(1, 1).attributes.position); geo.setAttribute('uv', new THREE.PlaneGeometry(1, 1).attributes.uv);
  const seat = new Float32Array(DUST * 4), glow = new Float32Array(DUST); geo.setAttribute('aSeat', new THREE.InstancedBufferAttribute(seat, 4).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('aA', new THREE.InstancedBufferAttribute(glow, 1).setUsage(THREE.DynamicDrawUsage)); geo.instanceCount = DUST;
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uCol: { value: new THREE.Color(0.86, 0.8, 0.66) } },
    vertexShader: `attribute vec4 aSeat; attribute float aA; varying vec2 vUv; varying float vA;
      void main() { vUv = uv; vA = aA; vec4 c = modelViewMatrix * vec4(aSeat.xyz, 1.0); c.xy += position.xy * aSeat.w; gl_Position = projectionMatrix * c; }`,
    fragmentShader: `uniform vec3 uCol; varying vec2 vUv; varying float vA; void main() { float d = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.25, d); if (a * vA < 0.01) discard; gl_FragColor = vec4(uCol, a * vA * 0.55); }` });
  const dust = new THREE.Mesh(geo, mat); dust.frustumCulled = false; dust.renderOrder = 3; G.scene.add(dust);
  const P = Array.from({ length: DUST }, () => ({ t: 9, life: 1, x: 0, y: -999, z: 0, r: 1, vy: 0 })); let next = 0, anyDust = false;
  function puff(x, y, z, r, life, vy) { const p = P[next]; next = (next + 1) % DUST; p.t = 0; p.life = life; p.x = x; p.y = y; p.z = z; p.r = r; p.vy = vy ?? 0.5 + Math.random() * 0.6; anyDust = true; }

  // ---------------------------------------------------------------- the swell under a surf and its spray: one soft mound of water, a disc raised by a gaussian, moved with him
  const swG = new THREE.CircleGeometry(1, 28, 0, Math.PI * 2); { const q = swG.attributes.position; for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i), r = Math.hypot(x, y); q.setXYZ(i, x, Math.exp(-r * r * 3.2) - 0.04, -y); } swG.computeVertexNormals(); }
  const swM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTop: { value: new THREE.Color(0.82, 0.97, 0.98) }, uLow: { value: new THREE.Color(0.1, 0.5, 0.56) }, uA: { value: 0 } },
    vertexShader: 'varying float vH; varying vec2 vP; void main() { vH = position.y; vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uTop, uLow; uniform float uA; varying float vH; varying vec2 vP; void main() { float r = length(vP); float a = smoothstep(1.0, 0.72, r) * uA; gl_FragColor = vec4(mix(uLow, uTop, smoothstep(0.1, 0.9, vH)), a * 0.72); }' });
  const swell = new THREE.Mesh(swG, swM); swell.frustumCulled = false; swell.renderOrder = 2; swell.visible = true; G.scene.add(swell);
  let sprayT = 0, ringT = 0; const FOAM = new THREE.Color(0.94, 0.99, 1), SAND = new THREE.Color(0.86, 0.8, 0.66);

  // ---------------------------------------------------------------- afterimages: the same mesh with a frozen copy of the bones' matrices
  const ghosts = [], n = G.tier === 'phone' ? GHOSTS_PHONE : GHOSTS_DESK;
  if (mesh && mesh.isSkinnedMesh) for (let i = 0; i < n; i++) {
    const m = new THREE.MeshBasicMaterial({ color: 0x8feeff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const sk = new THREE.Skeleton(mesh.skeleton.bones, mesh.skeleton.boneInverses); sk.computeBoneTexture(); sk.update = () => {};     // never follows the live bones: it holds what it was given
    const g = new THREE.SkinnedMesh(mesh.geometry, m); g.bind(sk, mesh.bindMatrix); g.frustumCulled = false; g.visible = true; g.renderOrder = 2; G.scene.add(g);      // drawn for the first frames at opacity 0, so its program is built during loading, not at his first sprint      // at the origin, attached: the frozen matrices are already in the world
    ghosts.push({ g, sk, m, t: 9 });
  }
  let turn = 0, since = 0, kick = 0, warm = 3;

  // a leap going out or coming back: a white column thrown up off the water
  let foamT = 0;
  h.onSplash = (p, size) => { foamT = 1.4; const n = Math.min(DUST - 4, Math.round(18 + size * 16)); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, r = Math.random() * (0.7 + size * 1.1), up = 2 + Math.random() * (7 + size * 7); puff(p.x + Math.cos(a) * r, p.y + 0.2 + Math.random() * 0.6, p.z + Math.sin(a) * r, 0.7 + size * 0.6 + Math.random() * 0.6, 0.6 + size * 0.25 + Math.random() * 0.3, up); } };

  // called when a foot lands at speed
  h.onPlant = (l, ground) => {
    const sp = Math.hypot(h.vel.x, h.vel.z);
    if (h.land && sp > 9 && ground[1] > -0.1) for (let i = 0; i < 2; i++) puff(ground[0] + (Math.random() - 0.5) * 0.3, ground[1] + 0.16, ground[2] + (Math.random() - 0.5) * 0.3, 0.5 + sp * 0.02, 0.45 + sp * 0.012);
    const depth = -h.groundAt(ground[0], ground[2]);
    if (h.land && depth > 0.12 && sp > 0.8) {          // each step in water throws a ring on the surface and drops up to the knees
      spot.set(ground[0], 0.03, ground[2]); G.fx.ring(spot, 0.5 + sp * 0.16, 0.34, 0xe8fbff);
      spot.y = Math.min(0.5, depth * 0.5 + 0.1); G.fx.sparks(spot, Math.min(9, 3 + (sp * 1.2 | 0)), 0xe8fbff, 2 + sp * 0.4);
      if ((kick++ & 1) === 0 && sp > 3) G.audio.bubble();
    }
  };

  const spot = new THREE.Vector3();
  function update(dt) {
    if (warm > 0 && --warm === 0) { dust.visible = anyDust; swell.visible = false; for (const g of ghosts) g.g.visible = false; }
    const surfing = h.state === 'surf' && h.surf;
    if (!warm) { const y = surfing ? h.swellY || 0 : 0; swell.visible = surfing || swM.uniforms.uA.value > 0.02; swM.uniforms.uA.value += ((surfing ? 1 : 0) - swM.uniforms.uA.value) * (1 - Math.exp(-6 * dt)); if (swell.visible) { swell.position.set(h.pos.x, 0.02 + (G.sky && G.sky.waveAt ? G.sky.waveAt(h.pos.x, h.pos.z) : 0), h.pos.z); swell.scale.set(5.5 + h.surf?.v * 0.1 || 5.5, Math.max(y, 0.05), 5.5 + h.surf?.v * 0.1 || 5.5); swell.rotation.y = h.heading; } }
    foamT = Math.max(0, foamT - dt); mat.uniforms.uCol.value.copy(surfing || foamT > 0 || (!h.land && !h.air) ? FOAM : SAND);
    if (surfing) {            // the ride throws a white wake off both sides of him, and rings run out behind on the water
      sprayT -= dt; ringT -= dt; const sn = Math.sin(h.heading), cs = Math.cos(h.heading), y0 = h.pos.y - 0.74, v = h.surf.v;
      if (sprayT <= 0) { sprayT = 0.03; for (const s of [-1, 1]) puff(h.pos.x - sn + cs * s * (0.4 + Math.random() * 0.45), y0 - 0.1 + Math.random() * 0.1, h.pos.z - cs - sn * s * (0.4 + Math.random() * 0.45), 0.3 + v * 0.014, 0.42 + v * 0.006); }      // low and small: the camera looks down this wake at him, and anything taller stands between it and his body
      if (ringT <= 0) { ringT = 0.38; spot.set(h.pos.x - sn * 1.2, y0 + 0.02, h.pos.z - cs * 1.2); G.fx.ring(spot, 1.6 + v * 0.05, 0.45, 0xe8fbff); }
    }
    const sp = Math.hypot(h.vel.x, h.vel.z), onFoot = h.land && !h.air, fast = onFoot ? sp : 0;
    // a steady wake once strides can't keep up
    if (fast > 14) { since += dt; const every = 0.03; while (since > every) { since -= every; puff(h.pos.x - Math.sin(h.heading) * 1.2 + (Math.random() - 0.5) * 0.9, h.pos.y - 0.86, h.pos.z - Math.cos(h.heading) * 1.2 + (Math.random() - 0.5) * 0.9, 0.5 + sp * 0.02, 0.5 + sp * 0.01); } }      // behind him and low: the lens is right behind him at this speed, and a taller cloud stands between it and his legs
    if (anyDust) { let live = false; for (let i = 0; i < DUST; i++) { const p = P[i]; p.t += dt; const u = p.t / p.life; if (u < 1) { live = true; p.y += p.vy * dt; const o = i * 4; seat[o] = p.x; seat[o + 1] = p.y; seat[o + 2] = p.z; seat[o + 3] = p.r * (1 + u * 1.6); glow[i] = (1 - u) * (1 - u); } else glow[i] = 0; } geo.attributes.aSeat.needsUpdate = true; geo.attributes.aA.needsUpdate = true; anyDust = live; if (!warm) dust.visible = live; }
    // afterimages: the same over the match limit, on land or in the water at super speed
    const over = onFoot ? clamp((sp - 14) / 8, 0, 1) : clamp((h.speed - 30) / 12, 0, 1);
    if (ghosts.length) {
      turn += dt;
      if (over > 0 && turn > 0.07) { turn = 0; mesh.skeleton.update(); const g = ghosts.reduce((a, b) => (a.t > b.t ? a : b)); g.sk.boneMatrices.set(mesh.skeleton.boneMatrices); if (g.sk.boneTexture) g.sk.boneTexture.needsUpdate = true; g.t = 0; g.strength = over; g.g.visible = true; }
      for (const g of ghosts) { if (!g.g.visible) continue; g.t += dt; const u = g.t / 0.26; if (u >= 1) { g.g.visible = false; g.m.opacity = 0; } else g.m.opacity = (1 - u) * 0.28 * (g.strength || 1); }
    }
  }
  return { update, get active() { return { ghosts: ghosts.filter((g) => g.g.visible).length, dust: P.filter((p) => p.t < p.life).length }; } };
}
