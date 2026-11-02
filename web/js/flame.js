// Fire as fire (Randy, 2 Nov: "doesn't look like actual fire being emitted and blasted and comboed at users"). Sources: Pipeline/research/FIRE_SOURCES.md.
// Read off frames of hand-drawn elemental fights: bold shapes in three flat tones, a near-white core, a yellow-orange body, a hard red-orange rim; blasts are comets with a round head and a long tail; a kick throws a crescent, tapered at both ends; everything breaks into tongues and is gone in a moment; what it hits gives a spiked burst and round smoke.
// The method is the proven one from real-time effects: alpha erosion through a gradient map. Noise times a mask, minus how far this flame has burnt away, then a hard edge (MIT, the Stylized Fire shader on godotshaders.com, after Minions Art; subtracting, not multiplying, is what erodes cleanly).
// One draw for every flame in the world: instanced strips, bent in the vertex shader into crescents, stood up along a line for comets and tongues, or faced to the lens for puffs.
import * as THREE from 'three';

const SEG = 10, PUFF = 0, COMET = 1, ARC = 2, TONGUE = 3, FIELDS = 15;

export function createFlames(G, cap = 150) {
  const P = [], I = [];
  for (let j = 0; j <= SEG; j++) for (let k = 0; k < 2; k++) P.push(j / SEG, k, 0);
  for (let j = 0; j < SEG; j++) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; I.push(a, b, d, a, d, c); }
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I);
  const data = new Float32Array(cap * FIELDS), ib = new THREE.InstancedInterleavedBuffer(data, FIELDS); ib.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iP', new THREE.InterleavedBufferAttribute(ib, 4, 0));      // centre, width
  g.setAttribute('iA', new THREE.InterleavedBufferAttribute(ib, 4, 4));      // the line it lies along (or an arc's first radius), length
  g.setAttribute('iN', new THREE.InterleavedBufferAttribute(ib, 4, 8));      // an arc's second radius, how far round it goes
  g.setAttribute('iK', new THREE.InterleavedBufferAttribute(ib, 3, 12));     // burnt away (0-1), kind, a number of its own
  g.instanceCount = 0; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const U = { uT: { value: 0 }, tN: { value: G.fx.noiseT }, uWet: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation, uniforms: U,
    vertexShader: /* glsl */`
      attribute vec4 iP, iA, iN; attribute vec3 iK; varying vec2 vUv; varying vec3 vK;
      void main() {
        float kind = iK.y, u = position.x, v = position.y; vec3 w; vUv = vec2(u, v); vK = iK;
        if (kind > 1.5 && kind < 2.5) {
          // a crescent: the arc from a to b round its centre, tapered at both ends
          float a0 = iN.w*u, r = iA.w; vec3 rad = cos(a0)*iA.xyz + sin(a0)*iN.xyz; float wide = iP.w*sin(3.1416*pow(u, .8));
          w = iP.xyz + rad*(r + (v - .5)*wide);
        } else {
          vec3 c = iP.xyz, along = iA.xyz, side;
          if (kind < .5) { vec3 x = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), y = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]); float a = iK.z*6.28; along = cos(a)*y + sin(a)*x; side = cos(a)*x - sin(a)*y; }
          else side = normalize(cross(along, normalize(cameraPosition - c)));
          w = c + along*(u - .5)*iA.w + side*(v - .5)*iP.w;
        }
        gl_Position = projectionMatrix*viewMatrix*vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uT, uWet; uniform sampler2D tN; varying vec2 vUv; varying vec3 vK;
      void main() {
        float burn = vK.x, kind = vK.y, seed = vK.z, u = vUv.x, v = vUv.y, c = abs(v - .5)*2.0, mask;
        vec2 n1, n2;
        if (kind < .5) { float r = length(vUv - .5)*2.0; mask = 1.0 - r; n1 = vUv*.7 + seed; n2 = vUv*1.6 - seed*2.0; }
        else if (kind < 1.5) {
          // the comet: its head at u = 1, the tail narrowing behind it
          float t = 1.0 - u, w = mix(1.0, .05, pow(t, .7))*smoothstep(1.0, .9, u + .08*(1.0 - c)); mask = (w - c)/max(w, .01)*smoothstep(0.0, .1, u); n1 = vec2(u*1.2 - uT*3.2 + seed, v*.5 + seed); n2 = vec2(u*2.6 - uT*5.0 - seed, v*1.1);
        }
        else if (kind < 2.5) { mask = 1.0 - c; n1 = vec2(u*1.5 - uT*1.6 + seed, v*.4 + seed); n2 = vec2(u*3.4 - uT*2.6, v*.9 - seed); }
        else { float h = u, w = (1.0 - h)*smoothstep(0.0, .12, h)*1.25; mask = (w - c)/max(w, .01); n1 = vec2(v*.5 + seed, h*.8 - uT*1.9); n2 = vec2(v*1.1 - seed, h*1.9 - uT*3.2); }
        float n = texture2D(tN, n1).r*.65 + texture2D(tN, n2).g*.35;
        // the three tones, each a hard line: noise times the mask, less what's burnt
        float f = n*1.15*clamp(mask*1.7, 0.0, 1.0) + mask*.42 - burn*1.05 - .12, e = .022;
        float rim = smoothstep(.02 - e, .02 + e, f), body = smoothstep(.22 - e, .22 + e, f), core = smoothstep(.46 - e, .46 + e, f);
        if (rim < .01) discard;
        vec3 R = mix(vec3(.93, .2, .03), vec3(.2, .55, .95), uWet), B = mix(vec3(1.0, .56, .08), vec3(.5, .85, 1.0), uWet), C = mix(vec3(1.0, .95, .62), vec3(.92, 1.0, 1.0), uWet);
        vec3 rgb = mix(mix(R, B, body), C, core);
        gl_FragColor = vec4(rgb*rim, rim*(.8 + .2*body));
      }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 15.8; mesh.visible = false; G.scene.add(mesh);
  const live = []; for (let i = 0; i < cap; i++) live.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), a: new THREE.Vector3(), n: new THREE.Vector3(), w: 1, l: 1, age: 0, life: 1, kind: 0, seed: 0, drag: 0, rise: 0, grow: 1, turn: 0 });
  let head = 0;
  const take = () => { const f = live[head]; head = (head + 1) % cap; f.on = true; f.age = 0; f.seed = Math.random(); f.drag = 0; f.rise = 0; f.grow = 1; f.turn = 0; return f; };
  const X = new THREE.Vector3(1, 0, 0), t1 = new THREE.Vector3();
  const api = {
    mesh,
    // a round flame, thrown: where, its size, how long it lasts, its velocity, how fast the air stops it, how fast heat lifts it, how much it swells
    puff(p, size, life, vx = 0, vy = 0, vz = 0, drag = 2, rise = 2, grow = 1.7) { const f = take(); f.kind = PUFF; f.p.copy(p); f.v.set(vx, vy, vz); f.w = f.l = size; f.a.set(0, 1, 0); f.life = life; f.drag = drag; f.rise = rise; f.grow = grow; return f; },
    // a comet: its head at p, flying along v, its tail length l behind
    comet(p, v, w, l, life) { const f = take(); f.kind = COMET; f.p.copy(p); f.v.copy(v); f.a.copy(v).normalize(); f.w = w; f.l = l; f.life = life; f.drag = 0; return f; },
    // a crescent round centre c, from the way a, in the plane of a and b, sweeping `sweep` radians, at radius r
    arc(c, a, b, r, sweep, w, life) { const f = take(); f.kind = ARC; f.p.copy(c); f.a.copy(a).normalize(); f.n.copy(b).normalize(); f.w = w; f.l = r; f.turn = sweep; f.life = life; f.v.set(0, 0, 0); return f; },
    // a tongue standing along a line
    tongue(p, up, w, l, life, vx = 0, vy = 0, vz = 0) { const f = take(); f.kind = TONGUE; f.p.copy(p); f.a.copy(up).normalize(); f.v.set(vx, vy, vz); f.w = w; f.l = l; f.life = life; f.drag = 3; return f; },
    set wet(k) { U.uWet.value = k; },
    step(dt) {
      let n = 0; U.uT.value = G.time;
      for (const f of live) {
        if (!f.on) continue; f.age += dt; if (f.age >= f.life) { f.on = false; continue; }
        if (f.drag) f.v.multiplyScalar(Math.exp(-f.drag * dt)); f.v.y += f.rise * dt; f.p.addScaledVector(f.v, dt);
        const q = f.age / f.life, s = f.kind === PUFF ? 1 + (f.grow - 1) * (1 - (1 - q) * (1 - q)) : 1, o = n++ * FIELDS, c = f.kind === COMET || f.kind === TONGUE ? t1.copy(f.p).addScaledVector(f.a, f.kind === COMET ? -f.l * 0.5 : f.l * 0.5 * s) : f.p;
        data[o] = c.x; data[o + 1] = c.y; data[o + 2] = c.z; data[o + 3] = f.w * s; data[o + 4] = f.a.x; data[o + 5] = f.a.y; data[o + 6] = f.a.z; data[o + 7] = f.l * s;
        data[o + 8] = f.n.x; data[o + 9] = f.n.y; data[o + 10] = f.n.z; data[o + 11] = f.turn; data[o + 12] = q * q * (f.kind === PUFF ? 0.95 : 1.1); data[o + 13] = f.kind; data[o + 14] = f.seed;
      }
      g.instanceCount = n; mesh.visible = n > 0; if (n) { ib.clearUpdateRanges(); ib.addUpdateRange(0, n * FIELDS); ib.needsUpdate = true; }
    },
  };
  return api;
}
