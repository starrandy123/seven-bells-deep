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
  // Randy, 1 Nov: "we need the water animation and movement surf to be actually better". The mound is water now: a moving surface, see-through at its edge,
  // the sky in it, and a white crest along its front where it shoves forward. Local +z is the way he rides (the mesh turns with his heading).
  const WATER_FS = `uniform vec3 uTop, uLow; uniform float uA, uT; varying float vH; varying vec2 vP;
    float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
    void main() {
      float r = length(vP);
      float n = vn(vP * 5.0 + vec2(0.0, uT * 3.2)) * 0.6 + vn(vP * 11.0 - vec2(uT * 1.7, uT * 4.1)) * 0.4;
      float crest = smoothstep(0.35, 0.85, vP.y) * (1.0 - smoothstep(0.55, 1.0, r)) * smoothstep(0.45, 0.7, n + 0.25 * vP.y);
      float sheen = pow(smoothstep(0.15, 0.95, vH), 1.6) * (0.55 + 0.45 * n);
      vec3 c = mix(uLow, uTop, sheen);
      c = mix(c, vec3(0.96, 0.99, 1.0), crest);
      float a = (1.0 - smoothstep(0.62 + 0.12 * n, 1.0, r)) * uA * mix(0.55, 0.95, max(sheen, crest));
      gl_FragColor = vec4(c, a);
    }`;
  const swM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTop: { value: new THREE.Color(0.82, 0.97, 0.98) }, uLow: { value: new THREE.Color(0.06, 0.36, 0.44) }, uA: { value: 0 }, uT: { value: 0 } },
    vertexShader: 'varying float vH; varying vec2 vP; void main() { vH = position.y; vP = vec2(position.x, position.z); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: WATER_FS });
  // the trail (Randy, 1 Nov: "The water needs to actually ride out on the ground too to make the river stream on ground"): the water he rides on stays behind him
  // as a stream across the ground for about five seconds, draped on the ground under each of its edges, flowing away from him along its own channel, deep
  // in the middle and foaming at its edges, a white rush where it's freshest; and under it a wider band of wet, dark ground that outlasts the water.
  const TRAIL = 140, trP = new Float32Array(TRAIL * 2 * 3), trA = new Float32Array(TRAIL * 2 * 3), wtP = new Float32Array(TRAIL * 2 * 3), trI = [];
  for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; trI.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const ribbon = (P) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aA', new THREE.BufferAttribute(trA, 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(trI); return g; };
  const trG = ribbon(trP), wtG = ribbon(wtP);
  const NOISE = `float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }`;
  const RVS = 'attribute vec3 aA; varying vec3 vA; varying vec3 vW; void main() { vA = aA; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }';
  // the stream's water (seen in the game, 1 Nov: at a second old it read as a white band, not water): clear running water, the sky in it at a glance and
  // the sun glinting off its ripples, which run back along it; white only where it breaks: its fresh head, its two lips, a streak here and there.
  // Lit and toned with the rest of the scene.
  const LU = G.look && G.look.uniforms ? G.look.uniforms : null, v3 = (x, y, z) => ({ value: new THREE.Vector3(x, y, z) });
  const trM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexShader: RVS,
    uniforms: { uT: { value: 0 }, uSun: LU ? LU.ocSunA : v3(0.4, 0.8, 0.3), uSkyZ: LU ? LU.ocSkyZ : v3(0.3, 0.5, 0.8), uSkyH: LU ? LU.ocSkyH : v3(0.7, 0.8, 0.9), uSunCol: LU ? LU.ocSunCol : v3(3, 2.8, 2.4) },
    fragmentShader: `uniform float uT; uniform vec3 uSun, uSkyZ, uSkyH, uSunCol; varying vec3 vA; varying vec3 vW; ${NOISE}
      void main() {
        float age = vA.x, side = abs(vA.y), along = vA.z;                           // age 0..1, side 0 centre .. 1 edge, metres along the stream from its head
        float s1 = vn(vec2(vA.y * 1.6, along * 0.42 - uT * 3.1)), s2 = vn(vec2(vA.y * 3.7 + 3.0, along * 1.1 - uT * 4.6)), s3 = vn(vW.xz * 2.2 + uT * 0.7);
        vec2 g = vec2(s1 - 0.5, s2 - 0.5) * 0.55 + (s3 - 0.5) * 0.25;
        vec3 n = normalize(vec3(g.x, 1.0, g.y)), V = normalize(cameraPosition - vW);
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(V, n), 0.0), 5.0);
        float deep = 1.0 - smoothstep(0.0, 0.9, side);
        vec3 c = mix(mix(vec3(0.10, 0.30, 0.32), vec3(0.03, 0.17, 0.22), deep), mix(uSkyH, uSkyZ, 0.5), F * 0.9);
        c += uSunCol * pow(max(dot(n, normalize(uSun + V)), 0.0), 140.0) * 1.4;
        float lip = smoothstep(0.72, 0.98, side + (s2 - 0.5) * 0.3), head = 1.0 - smoothstep(0.0, 0.06, age);
        float streak = smoothstep(0.70, 0.86, s1 * 0.6 + s2 * 0.4) * (1.0 - smoothstep(0.1, 0.5, age)) * 0.6;
        float foam = clamp(max(max(lip * 0.8, head), streak), 0.0, 1.0);
        c = mix(c, vec3(0.92, 0.97, 0.98), foam * 0.8);
        float a = (1.0 - smoothstep(0.62 + 0.25 * s3, 1.0, side)) * (1.0 - smoothstep(0.45, 1.0, age)) * mix(0.38, 0.85, max(max(deep * 0.75, F), foam));
        if (a < 0.01) discard;
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const wtM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } }, vertexShader: RVS,
    fragmentShader: `uniform float uT; varying vec3 vA; varying vec3 vW; ${NOISE}
      void main() {
        float age = vA.x, side = abs(vA.y), n = vn(vW.xz * 1.3);
        float a = (1.0 - smoothstep(0.55 + 0.3 * n, 1.0, side)) * (1.0 - smoothstep(0.7, 1.0, age)) * 0.42;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.03, 0.035, 0.03) + vec3(0.10, 0.12, 0.12) * pow(n, 6.0), a);      // wet ground: darker, a glint here and there
      }` });
  const wet = new THREE.Mesh(wtG, wtM); wet.frustumCulled = false; wet.renderOrder = 1; G.scene.add(wet);
  const trail = new THREE.Mesh(trG, trM); trail.frustumCulled = false; trail.renderOrder = 2; G.scene.add(trail);
  const trPts = []; let trT = 0, lastStamp = null; const TRAIL_LIFE = 6.0, TRAIL_W = 0.36;
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
    const gnd = h.groundAt(ground[0], ground[2]), rw = G.world.waterAt ? G.world.waterAt(ground[0], -ground[2]) : null, lvl = rw && rw.W > gnd ? rw.W : 0, depth = lvl - gnd;      // the sea, or a river's own surface
    if (h.land && depth > 0.12 && sp > 0.8) {          // each step in water throws a ring on the surface and drops up to the knees
      spot.set(ground[0], lvl + 0.03, ground[2]); G.fx.ring(spot, 0.5 + sp * 0.16, 0.34, 0xe8fbff);
      spot.y = lvl + Math.min(0.5, depth * 0.5 + 0.1); G.fx.sparks(spot, Math.min(9, 3 + (sp * 1.2 | 0)), 0xe8fbff, 2 + sp * 0.4);
      if ((kick++ & 1) === 0 && sp > 3) G.audio.bubble();
    }
  };

  const spot = new THREE.Vector3();
  function update(dt) {
    if (warm > 0 && --warm === 0) { dust.visible = anyDust; swell.visible = false; for (const g of ghosts) g.g.visible = false; }
    const surfing = h.state === 'surf' && h.surf;
    swM.uniforms.uT.value += dt; trM.uniforms.uT.value += dt;
    swM.uniforms.uT.value += 0; wtM.uniforms.uT.value = trM.uniforms.uT.value;
    // the stream: a point every 40 ms behind his feet while he rides, each edge set on the ground (or the sea) under it, each fading over TRAIL_LIFE
    trT -= dt;
    if (surfing && trT <= 0) {
      trT = 0.04; const sn = Math.sin(h.heading), cs = Math.cos(h.heading), x = h.pos.x - sn * 0.9, z = h.pos.z - cs * 0.9, w = TRAIL_W * (0.8 + 0.4 * Math.min(1, (h.surf.v || 10) / 20));
      const lx = x - cs * w, lz = z + sn * w, rx = x + cs * w, rz = z - sn * w, onSea = !h.surf.land;
      const sea = (px, pz) => (G.sky && G.sky.waveAt ? G.sky.waveAt(px, pz) : 0), at = (px, pz) => (onSea ? sea(px, pz) : Math.max(h.groundAt(px, pz), sea(px, pz)));
      trPts.unshift({ lx, lz, ly: at(lx, lz) + 0.07, rx, rz, ry: at(rx, rz) + 0.07, x, z, cx: cs, cz: -sn, w, t: 0 }); if (trPts.length > TRAIL) trPts.pop();
      // what it leaves (Randy, 1 Nov: "The land surf should leave some water too"): the ground it ran over stays soaked, with water standing in it (wetmap.js)
      if (G.world.wet && !onSea && lastStamp && h.groundAt(x, z) > 0.02) G.world.wet.stamp(lastStamp.x, lastStamp.z, x, z, w * 1.35, 0.95, 1);
      lastStamp = { x, z };
    }
    if (!surfing) lastStamp = null;
    for (const q of trPts) q.t += dt; while (trPts.length && trPts[trPts.length - 1].t > TRAIL_LIFE) trPts.pop();
    trail.visible = wet.visible = trPts.length > 1;
    if (trail.visible) {
      let along = 0;
      for (let i = 0; i < TRAIL; i++) {
        const k = Math.min(i, trPts.length - 1), q = trPts[k], age = q.t / TRAIL_LIFE, live = i < trPts.length, o = i * 6, shrink = 1 - 0.35 * age, cx = (q.lx + q.rx) / 2, cz = (q.lz + q.rz) / 2;
        if (i > 0 && live) along += Math.hypot(q.x - trPts[k - 1].x, q.z - trPts[k - 1].z);
        const lx = cx + (q.lx - cx) * shrink, lz = cz + (q.lz - cz) * shrink, rx = cx + (q.rx - cx) * shrink, rz = cz + (q.rz - cz) * shrink;
        trP[o] = lx; trP[o + 1] = q.ly; trP[o + 2] = lz; trP[o + 3] = rx; trP[o + 4] = q.ry; trP[o + 5] = rz;
        wtP[o] = cx + (q.lx - cx) * 1.45; wtP[o + 1] = q.ly - 0.03; wtP[o + 2] = cz + (q.lz - cz) * 1.45; wtP[o + 3] = cx + (q.rx - cx) * 1.45; wtP[o + 4] = q.ry - 0.03; wtP[o + 5] = cz + (q.rz - cz) * 1.45;
        const ag = live ? age : 1; trA.set([ag, -1, along, ag, 1, along], i * 6);
      }
      trG.attributes.position.needsUpdate = true; trG.attributes.aA.needsUpdate = true; wtG.attributes.position.needsUpdate = true; wtG.attributes.aA.needsUpdate = true;
    }
    if (!warm) { const y = surfing ? h.swellY || 0 : 0; swell.visible = surfing || swM.uniforms.uA.value > 0.02; swM.uniforms.uA.value += ((surfing ? (h.surf.land ? 0.62 : 1) : 0) - swM.uniforms.uA.value) * (1 - Math.exp(-6 * dt)); if (swell.visible) { swell.position.set(h.pos.x, 0.02 + (h.surfBase ?? (G.sky && G.sky.waveAt ? G.sky.waveAt(h.pos.x, h.pos.z) : 0)), h.pos.z); const onLand = h.surf && h.surf.land; swell.scale.set(onLand ? 1.05 : 3.4, Math.max(y, 0.05), onLand ? 2.3 : 6.0); swell.rotation.y = h.heading; } }      // a tongue of water under his feet, longer than it's wide (Randy, 1 Nov: "too wide": it was a disc 15 m across)
    foamT = Math.max(0, foamT - dt); mat.uniforms.uCol.value.copy(surfing || foamT > 0 || (!h.land && !h.air) ? FOAM : SAND);
    if (surfing) {            // the ride throws a white wake off both sides of him, and rings run out behind on the water
      sprayT -= dt; ringT -= dt; const sn = Math.sin(h.heading), cs = Math.cos(h.heading), y0 = h.pos.y - 0.74, v = h.surf.v;
      if (sprayT <= 0) { sprayT = 0.03; const onL = h.surf.land, w0 = onL ? 0.22 : 0.4, w1 = onL ? 0.2 : 0.45; for (const s of [-1, 1]) puff(h.pos.x - sn + cs * s * (w0 + Math.random() * w1), y0 - 0.1 + Math.random() * 0.1, h.pos.z - cs - sn * s * (w0 + Math.random() * w1), onL ? 0.1 + v * 0.006 : 0.3 + v * 0.014, onL ? 0.3 : 0.42 + v * 0.006); }      // low and small: the camera looks down this wake at him, and anything taller stands between it and his body
      // a hard carve throws its water off the outside rail, the way he's not leaning
      const rail = Math.abs(h.surfLean || 0); if (rail > 0.2 && sprayT === 0.03) { const out = (h.surfLean > 0 ? 1 : -1), onL = h.surf.land; for (let i = 0; i < 2; i++) { const o = (onL ? 0.3 : 0.55) + Math.random() * 0.5, b = Math.random() * 0.8 - 0.2; puff(h.pos.x + cs * out * o - sn * b, y0 + Math.random() * 0.3, h.pos.z - sn * out * o - cs * b, (onL ? 0.12 : 0.3) + rail * (onL ? 0.22 : 0.6), onL ? 0.32 : 0.5); } }
      if (ringT <= 0) { ringT = 0.38; spot.set(h.pos.x - sn * 1.2, y0 + 0.02, h.pos.z - cs * 1.2); G.fx.ring(spot, h.surf.land ? 0.7 : 1.6 + v * 0.05, 0.45, 0xe8fbff); }
    }
    const sp = Math.hypot(h.vel.x, h.vel.z), onFoot = h.land && !h.air, fast = onFoot ? sp : 0;
    // a steady wake once strides can't keep up
    if (fast > 14) { since += dt; const every = 0.03; while (since > every) { since -= every; puff(h.pos.x - Math.sin(h.heading) * 1.2 + (Math.random() - 0.5) * 0.9, h.pos.y - 0.86, h.pos.z - Math.cos(h.heading) * 1.2 + (Math.random() - 0.5) * 0.9, 0.5 + sp * 0.02, 0.5 + sp * 0.01); } }      // behind him and low: the lens is right behind him at this speed, and a taller cloud stands between it and his legs
    if (anyDust) { let live = false; for (let i = 0; i < DUST; i++) { const p = P[i]; p.t += dt; const u = p.t / p.life; if (u < 1) { live = true; p.y += p.vy * dt; const o = i * 4; seat[o] = p.x; seat[o + 1] = p.y; seat[o + 2] = p.z; seat[o + 3] = p.r * (1 + u * 1.6); glow[i] = (1 - u) * (1 - u); } else glow[i] = 0; } geo.attributes.aSeat.needsUpdate = true; geo.attributes.aA.needsUpdate = true; anyDust = live; if (!warm) dust.visible = live; }
    // afterimages: the same over the match limit, on land or in the water at super speed
    // the afterimages are the Warden's own mesh: the man in red has his jets, and no ghost of anybody else behind him. Randy, 2 Nov: "When I fly with fire, I see some semblance of the water guy too smimming with the trident"
    const over = G.sideNow === 'fire' ? 0 : onFoot ? clamp((sp - 14) / 8, 0, 1) : clamp((h.speed - 30) / 12, 0, 1);
    if (ghosts.length) {
      turn += dt;
      if (over > 0 && turn > 0.07) { turn = 0; mesh.skeleton.update(); const g = ghosts.reduce((a, b) => (a.t > b.t ? a : b)); g.sk.boneMatrices.set(mesh.skeleton.boneMatrices); if (g.sk.boneTexture) g.sk.boneTexture.needsUpdate = true; g.t = 0; g.strength = over; g.g.visible = true; }
      for (const g of ghosts) { if (!g.g.visible) continue; g.t += dt; const u = g.t / 0.26; if (u >= 1) { g.g.visible = false; g.m.opacity = 0; } else g.m.opacity = (1 - u) * 0.28 * (g.strength || 1); }
    }
  }
  return { update, get active() { return { ghosts: ghosts.filter((g) => g.g.visible).length, dust: P.filter((p) => p.t < p.life).length }; } };
}
