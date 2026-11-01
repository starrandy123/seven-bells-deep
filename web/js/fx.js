// Everything a blow and a power draw. Built for a phone: one atlas painted by code at boot, one instanced sprite batch (two draws: over and in the scene),
// one fluid mesh rebuilt each frame (thick water with real normals), one instanced crystal (all the ice), and crisp circles. Timings are the reference's, DESIGN.md §Combat.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ the atlas: R is white-hot, G is the body that takes the tint
const CELLS = {
  star: [0, 0, 256, 256], star2: [256, 0, 256, 256], iceStar: [512, 0, 256, 256], ring: [768, 0, 256, 256],
  crescent: [0, 256, 512, 256], foamRing: [512, 256, 256, 256], smoke: [768, 256, 256, 256],
  dot: [0, 512, 128, 128], bead: [128, 512, 128, 128], streak: [256, 512, 128, 128], glint: [384, 512, 128, 128],
  foam: [512, 512, 128, 128], bubble: [640, 512, 128, 128], shard: [768, 512, 128, 128], flake: [896, 512, 128, 128],
  beam: [0, 640, 512, 128], frost: [512, 640, 256, 256], burst: [768, 640, 256, 256],
};

function atlasBytes() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'lighter';
  let sd = 77; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647, rr = (a, b) => a + r() * (b - a);
  const hot = (a) => `rgba(255,0,0,${a})`, body = (a) => `rgba(0,255,0,${a})`;
  const cell = (name, fn) => { const [x, y, w, h] = CELLS[name]; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x + w / 2, y + h / 2); g.scale(w / 2, h / 2); fn(); g.restore(); };
  const radial = (R, stops) => { const q = g.createRadialGradient(0, 0, 0, 0, 0, R); for (const [t, col] of stops) q.addColorStop(t, col); g.fillStyle = q; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); };
  const spike = (a, len, w, col) => {
    const cx = Math.cos(a), sy = Math.sin(a), q = g.createLinearGradient(0, 0, cx * len, sy * len);
    q.addColorStop(0, col(1)); q.addColorStop(0.6, col(0.75)); q.addColorStop(1, col(0)); g.fillStyle = q;
    g.beginPath(); g.moveTo(-sy * w, cx * w); g.lineTo(cx * len, sy * len); g.lineTo(sy * w, -cx * w); g.closePath(); g.fill();
  };
  const starCell = (n, seedShift) => () => {
    sd += seedShift;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rr(-0.12, 0.12), big = i % 3 === 0; spike(a, big ? rr(0.82, 0.98) : rr(0.36, 0.66), big ? rr(0.045, 0.075) : rr(0.03, 0.06), body); }
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rr(-0.2, 0.2); spike(a, rr(0.22, 0.5), rr(0.018, 0.035), hot); }
    radial(0.5, [[0, body(0.95)], [0.3, body(0.55)], [1, body(0)]]);
    radial(0.34, [[0, hot(1)], [0.42, hot(0.85)], [1, hot(0)]]);
  };
  cell('star', starCell(19, 11)); cell('star2', starCell(13, 41));
  cell('iceStar', () => {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.26; spike(a, 0.96, 0.1, body); spike(a, 0.72, 0.035, hot); spike(a + 0.52, 0.5, 0.06, body); }
    g.strokeStyle = body(0.9); g.lineWidth = 0.012; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.26; g.beginPath(); g.moveTo(Math.cos(a) * 0.44, Math.sin(a) * 0.44); g.lineTo(Math.cos(a + 1.05) * 0.44, Math.sin(a + 1.05) * 0.44); g.stroke(); }
    radial(0.4, [[0, body(0.8)], [1, body(0)]]); radial(0.24, [[0, hot(1)], [0.5, hot(0.8)], [1, hot(0)]]);
  });
  cell('ring', () => {
    g.lineWidth = 0.022; g.strokeStyle = hot(1); g.beginPath(); g.arc(0, 0, 0.93, 0, TAU); g.stroke();
    g.lineWidth = 0.05; g.strokeStyle = body(1); g.beginPath(); g.arc(0, 0, 0.93, 0, TAU); g.stroke();
    const q = g.createRadialGradient(0, 0, 0.78, 0, 0, 0.93); q.addColorStop(0, body(0)); q.addColorStop(1, body(0.22)); g.fillStyle = q; g.beginPath(); g.arc(0, 0, 0.93, 0, TAU); g.fill();
  });
  cell('crescent', () => {
    // a thin moon: it swells in the middle and comes to two points
    g.save(); g.scale(1, 2); g.translate(0, 0.1); const outer = 0.92, inner = 0.76;
    const moon = () => { g.beginPath(); g.arc(0, 0.32, outer, Math.PI * 1.1, Math.PI * 1.9); g.arc(0, 0.46, inner + 0.2, Math.PI * 1.86, Math.PI * 1.14, true); g.closePath(); };
    const q = g.createLinearGradient(0, -0.62, 0, -0.3); q.addColorStop(0, body(1)); q.addColorStop(1, body(0.1)); g.fillStyle = q; moon(); g.fill();
    g.lineWidth = 0.014; g.strokeStyle = hot(1); g.beginPath(); g.arc(0, 0.32, outer - 0.012, Math.PI * 1.18, Math.PI * 1.82); g.stroke();
    g.restore();
  });
  cell('foamRing', () => { for (let i = 0; i < 230; i++) { const a = r() * TAU, R = rr(0.7, 0.95), s = rr(0.012, 0.05); g.fillStyle = i % 3 ? body(0.8) : hot(0.8); g.beginPath(); g.arc(Math.cos(a) * R, Math.sin(a) * R, s, 0, TAU); g.fill(); } });
  cell('smoke', () => { for (let i = 0; i < 46; i++) { const a = r() * TAU, R = Math.sqrt(r()) * 0.6, s = rr(0.14, 0.38); g.save(); g.translate(Math.cos(a) * R, Math.sin(a) * R); radial(s, [[0, body(0.28)], [1, body(0)]]); g.restore(); } });
  cell('dot', () => { radial(1, [[0, body(1)], [0.35, body(0.5)], [1, body(0)]]); radial(0.5, [[0, hot(0.9)], [1, hot(0)]]); });
  cell('bead', () => {
    radial(0.92, [[0, body(0.16)], [0.6, body(0.26)], [0.84, body(0.95)], [0.93, body(0.85)], [1, body(0)]]);
    g.fillStyle = hot(1); g.beginPath(); g.ellipse(-0.3, -0.36, 0.17, 0.1, -0.6, 0, TAU); g.fill();
    g.strokeStyle = hot(0.55); g.lineWidth = 0.05; g.beginPath(); g.arc(0, 0, 0.7, 0.4, 1.4); g.stroke();
  });
  cell('streak', () => { g.fillStyle = body(1); g.beginPath(); g.moveTo(-1, 0); g.quadraticCurveTo(0.2, -0.12, 1, 0); g.quadraticCurveTo(0.2, 0.12, -1, 0); g.fill(); g.fillStyle = hot(1); g.beginPath(); g.moveTo(-0.7, 0); g.quadraticCurveTo(0.3, -0.05, 0.95, 0); g.quadraticCurveTo(0.3, 0.05, -0.7, 0); g.fill(); });
  cell('glint', () => { for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.0; spike(a, 0.98, 0.07, body); spike(a, 0.8, 0.03, hot); } radial(0.3, [[0, hot(1)], [1, hot(0)]]); radial(0.42, [[0, body(0.8)], [1, body(0)]]); });
  cell('foam', () => { radial(0.8, [[0, body(0.22)], [1, body(0)]]); for (let i = 0; i < 150; i++) { const a = r() * TAU, R = Math.pow(r(), 0.7) * 0.86, s = rr(0.012, 0.05) * (1 - R * 0.6); g.fillStyle = i % 3 ? body(0.75) : hot(0.8); g.beginPath(); g.arc(Math.cos(a) * R, Math.sin(a) * R, s, 0, TAU); g.fill(); } });
  cell('bubble', () => { g.lineWidth = 0.1; g.strokeStyle = body(0.95); g.beginPath(); g.arc(0, 0, 0.82, 0, TAU); g.stroke(); radial(0.8, [[0.6, body(0)], [1, body(0.3)]]); g.fillStyle = hot(1); g.beginPath(); g.ellipse(-0.32, -0.36, 0.16, 0.1, -0.7, 0, TAU); g.fill(); });
  cell('shard', () => { g.fillStyle = body(1); g.beginPath(); g.moveTo(0, -0.95); g.lineTo(0.42, -0.1); g.lineTo(0.16, 0.9); g.lineTo(-0.38, 0.3); g.closePath(); g.fill(); g.fillStyle = hot(0.9); g.beginPath(); g.moveTo(0, -0.95); g.lineTo(0.1, -0.05); g.lineTo(-0.38, 0.3); g.closePath(); g.fill(); });
  cell('flake', () => { g.strokeStyle = body(1); g.lineWidth = 0.07; for (let i = 0; i < 6; i++) { g.save(); g.rotate((i / 6) * TAU); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -0.9); g.moveTo(0, -0.5); g.lineTo(0.26, -0.72); g.moveTo(0, -0.5); g.lineTo(-0.26, -0.72); g.stroke(); g.restore(); } radial(0.26, [[0, hot(1)], [1, hot(0)]]); });
  cell('beam', () => { g.save(); g.scale(1, 4); g.fillStyle = body(1); g.beginPath(); g.moveTo(-1, 0); g.quadraticCurveTo(0, -0.17, 1, 0); g.quadraticCurveTo(0, 0.17, -1, 0); g.fill(); g.fillStyle = hot(1); g.beginPath(); g.moveTo(-0.92, 0); g.quadraticCurveTo(0, -0.07, 0.92, 0); g.quadraticCurveTo(0, 0.07, -0.92, 0); g.fill(); g.restore(); });
  cell('frost', () => {
    // frost feathers: each arm branches as it grows, so it reads as ice spreading
    const arm = (x, y, a, len, w, depth) => { const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len; g.lineWidth = w; g.strokeStyle = depth > 2 ? hot(0.75) : body(0.95); g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); g.strokeStyle = body(0.95); g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); if (depth > 0) { for (let k = 1; k <= 3; k++) { const t = k / 3.4, bx = x + Math.cos(a) * len * t, by = y + Math.sin(a) * len * t; arm(bx, by, a + 0.82 + rr(-0.1, 0.1), len * 0.42, w * 0.7, depth - 1); arm(bx, by, a - 0.82 + rr(-0.1, 0.1), len * 0.42, w * 0.7, depth - 1); } arm(nx, ny, a + rr(-0.16, 0.16), len * 0.6, w * 0.75, depth - 1); } };
    for (let i = 0; i < 7; i++) arm(0, 0, (i / 7) * TAU + 0.2, 0.42, 0.024, 3);
  });
  cell('burst', () => { for (let i = 0; i < 26; i++) { const a = r() * TAU, l = rr(0.5, 0.98); g.strokeStyle = body(0.9); g.lineWidth = rr(0.012, 0.03); g.beginPath(); g.moveTo(Math.cos(a) * l * 0.4, Math.sin(a) * l * 0.4); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.stroke(); } });
  const px = g.getImageData(0, 0, S, S).data, rg = new Uint8Array(S * S * 2);
  for (let i = 0, n = S * S; i < n; i++) { rg[i * 2] = px[i * 4]; rg[i * 2 + 1] = px[i * 4 + 1]; }
  return rg;
}
// the bytes go once the GPU has them, 2 MB of heap back; a lost context paints them again
function paintAtlas(G) {
  const S = 1024, t = new THREE.DataTexture(atlasBytes(), S, S, THREE.RGFormat, THREE.UnsignedByteType), free = () => { t.image.data = null; t.onUpdate = null; };
  t.flipY = false; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.onUpdate = free; t.needsUpdate = true;
  if (G.look.onRestore) G.look.onRestore(() => { t.image.data = atlasBytes(); t.onUpdate = free; t.needsUpdate = true; });
  return t;
}

// a tiling noise for the water's surface and the ice's veils: two octaves, wrapped by construction
function noiseTexture(renderer) {
  const N = 128, d = new Uint8Array(N * N), lat = (n, seed) => { const a = new Float32Array(n * n); let s = seed; for (let i = 0; i < a.length; i++) { s = (s * 16807) % 2147483647; a[i] = s / 2147483647; } return a; };
  const smooth = (t) => t * t * (3 - 2 * t), octs = [[8, 0.5, lat(8, 91)], [16, 0.3, lat(16, 57)], [32, 0.2, lat(32, 13)]];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const [n, amp, a] of octs) { const fx = (x / N) * n, fy = (y / N) * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = smooth(fx - ix), ty = smooth(fy - iy), at = (u, w) => a[((w % n) + n) % n * n + ((u % n) + n) % n]; v += amp * (at(ix, iy) * (1 - tx) * (1 - ty) + at(ix + 1, iy) * tx * (1 - ty) + at(ix, iy + 1) * (1 - tx) * ty + at(ix + 1, iy + 1) * tx * ty); }
    d[y * N + x] = clamp(v, 0, 1) * 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true; void renderer;
  return t;
}

export function createFx(G) {
  const scene = G.scene, phone = G.tier === 'phone', atlas = paintAtlas(G), noiseT = noiseTexture(G.renderer);
  const C = { water: new THREE.Color(0.18, 0.78, 1.0), ice: new THREE.Color(0.62, 0.86, 1.0), gold: new THREE.Color(1.0, 0.72, 0.3), foam: new THREE.Color(0.86, 0.97, 1.0), bead: new THREE.Color(0.62, 0.92, 1.0), dark: new THREE.Color(0.0, 0.1, 0.24) };
  const tmpC = new THREE.Color(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), ZF = new THREE.Vector3(0, 0, 1);
  const shared = { uT: { value: 0 } };
  const reduced = () => G.settings && G.settings.flash === false;
  const stats = { sprites: 0, over: 0, fluidVerts: 0, crystals: 0, circles: 0, bigFlashes: 0, edges: 0, impacts: 0 };

  // ------------------------------------------------------------------ the sprite batch: every sprite one instance; alpha 0 in its mode adds, alpha 1 lays on top
  const FLOATS = 19, uvOf = {}; for (const k in CELLS) { const c = CELLS[k]; uvOf[k] = [c[0] / 1024, c[1] / 1024, c[2] / 1024, c[3] / 1024]; }
  function batch(cap, depthTest, order) {
    const data = new Float32Array(cap * FLOATS), ib = new THREE.InstancedInterleavedBuffer(data, FLOATS); ib.setUsage(THREE.DynamicDrawUsage);
    const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('iP', new THREE.InterleavedBufferAttribute(ib, 3, 0)); g.setAttribute('iX', new THREE.InterleavedBufferAttribute(ib, 3, 3)); g.setAttribute('iY', new THREE.InterleavedBufferAttribute(ib, 3, 6));
    g.setAttribute('iUV', new THREE.InterleavedBufferAttribute(ib, 4, 9)); g.setAttribute('iC', new THREE.InterleavedBufferAttribute(ib, 4, 13)); g.setAttribute('iM', new THREE.InterleavedBufferAttribute(ib, 2, 17));
    g.instanceCount = 0; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest, side: THREE.DoubleSide, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
      uniforms: { tA: { value: atlas } },
      vertexShader: `attribute vec3 iP, iX, iY; attribute vec4 iUV, iC; attribute vec2 iM; varying vec2 vU; varying vec4 vC; varying vec2 vM;
        void main() { vU = iUV.xy + (position.xy * 0.5 + 0.5) * iUV.zw; vC = iC; vM = iM; vec3 w = iP + iX * position.x + iY * position.y; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: `uniform sampler2D tA; varying vec2 vU; varying vec4 vC; varying vec2 vM;
        void main() { vec2 t = texture2D(tA, vU).rg; float body = t.g, hotS = t.r * vM.x; vec3 rgb = (vC.rgb * body + vec3(hotS) * 1.25) * vC.a; float a = body * vC.a * (1.0 - vM.y);
          gl_FragColor = vec4(rgb, a); }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.visible = false; scene.add(mesh);
    return { data, ib, g, mesh, n: 0, cap };
  }
  const CAP = phone ? 360 : 560;
  // the sea's surface draws at 15 from above: an effect has to come after it, or anything over the water seen from over the water is painted out by the sea
  const inScene = batch(CAP, true, 15.7), over = batch(phone ? 90 : 140, false, 16);

  const pool = []; for (let i = 0; i < CAP + 60; i++) pool.push({ on: false, b: 0, cell: 'dot', mode: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, age: 0, life: 1, delay: 0, s0: 1, s1: 1, aspect: 1, thin: 1, stretch: 0, rot: 0, spin: 0, r: 1, g: 1, b2: 1, a: 1, hot: 1, add: 1, grav: 0, drag: 0, inF: 0.0, outF: 0.4, sink: 0 });
  let head = 0, inBurst = 0;
  // the next sprite, wiped: fields set here are what every sprite shares
  function sp(cell, p, size, life, col, out = {}) {
    const s = pool[head]; head = (head + 1) % pool.length;
    s.on = true; s.b = 0; s.cell = cell; s.mode = 0; s.x = p.x; s.y = p.y; s.z = p.z; s.vx = s.vy = s.vz = 0; s.age = 0; s.life = life; s.delay = 0; s.s0 = s.s1 = size; s.aspect = 1; s.thin = 1; s.stretch = 0; s.rot = 0; s.spin = 0;
    s.r = col.r; s.g = col.g; s.b2 = col.b; s.a = 1; s.hot = 1; s.add = 1; s.grav = 0; s.drag = 0; s.inF = 0; s.outF = 0.4; s.sink = 0; s.burst = inBurst;
    Object.assign(s, out); return s;
  }
  function planeAxes(s, normal, spin = 0) {
    v1.copy(Math.abs(normal.y) > 0.9 ? ZF : Y).cross(normal).normalize(); v2.crossVectors(normal, v1).normalize();
    const c = Math.cos(spin), sn = Math.sin(spin);
    s.ax = v1.x * c + v2.x * sn; s.ay = v1.y * c + v2.y * sn; s.az = v1.z * c + v2.z * sn;
    s.bx = -v1.x * sn + v2.x * c; s.by = -v1.y * sn + v2.y * c; s.bz = -v1.z * sn + v2.z * c; s.mode = 2;
  }

  // ------------------------------------------------------------------ what's left of the old list, on the batch
  function sparks(p, n = 14, col = 0x9ff4ff, speed = 7) {
    tmpC.set(col);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, b = Math.acos(2 * Math.random() - 1), s = speed * (0.45 + Math.random() * 1.1);
      sp('streak', p, 0.07 + Math.random() * 0.05, 0.24 + Math.random() * 0.3, tmpC, { mode: 1, stretch: 0.12, vx: Math.sin(b) * Math.cos(a) * s, vy: Math.cos(b) * s, vz: Math.sin(b) * Math.sin(a) * s, drag: 3.2, grav: 3.5 });
    }
  }
  function bubbles(p, n = 6, spread = 0.5) {
    for (let k = 0; k < n; k++) {
      v1.set(p.x + (Math.random() - 0.5) * spread, p.y + (Math.random() - 0.5) * spread, p.z + (Math.random() - 0.5) * spread);
      if (v1.y > -0.1) continue;
      sp('bubble', v1, 0.025 + Math.random() * 0.06, 1 + Math.random() * 1.2, C.foam, { add: 0.6, hot: 0.9, vx: (Math.random() - 0.5) * 0.7, vy: 1.2 + Math.random() * 1.8, vz: (Math.random() - 0.5) * 0.7, grav: -1.6, drag: 0.5, sink: 1 });
    }
  }
  function ring(p, radius, dur, colour, normal) {
    tmpC.set(colour);
    const s = sp('ring', p, 0.1, dur, tmpC, { s1: radius, outF: 0.25, add: 1, hot: 0.8, a: 0.9 });
    planeAxes(s, normal || Y);
  }

  // ------------------------------------------------------------------ a contact. The order and the lengths are counted from the reference
  const recent = [];
  function impact(p, dir, kind, el) {
    const I = G.combat && G.combat.data ? G.combat.data.impacts[kind] : { core_m: 2, spike_m: 3, beam_m: 0, ring_m: 0, sparks: 14, beads: 8, shards: 3 };
    const L = kind === 'light' ? 0.33 : kind === 'medium' ? 0.42 : 0.62, last = (a, b) => Math.min(L, rnd(a, b));   // a burst lasts only as long as the blow: a light one is gone by 0.33 s
    const ice = el === 'ice', tint = ice ? C.ice : C.water, soft = reduced(); stats.impacts++; inBurst = 1;
    // E3: at most three big flashes a second, the rest come in softer; the setting softens them all
    const big = I.core_m >= 2.8, now = G.time; while (recent.length && now - recent[0] > 1) recent.shift();
    let hit = soft ? 0.5 : 1; if (big) { if (recent.length >= 3) hit = Math.min(hit, 0.45); else { recent.push(now); stats.bigFlashes++; } }
    // a burst is sized at the target, and capped by the screen: the solid core stays under a tenth of the frame's area at this distance, on any phone, upright or turned
    const cam = G.camera, far = Math.max(1.5, cam.position.distanceTo(p)), tall = 2 * far * Math.tan((cam.fov * Math.PI) / 360), area = tall * tall * cam.aspect, capR = Math.sqrt((0.10 * area) / Math.PI) * 0.62, lens = Math.min(1, capR / (I.core_m * 0.5 * 1.25));
    const R = I.core_m * 0.5 * lens * (soft ? 0.8 : 1), S = I.spike_m * 0.5 * lens * (soft ? 0.8 : 1), lie = Math.atan2(dir.x, dir.z);   // half-widths: a quad runs from -1 to 1
    // a dark breath behind it: on a bright sea, white needs something to stand on
    sp('dot', p, R * 2.1, 0.2, C.dark, { b: 1, s0: R * 1.2, a: 0.55 * hit, hot: 0, add: 0, outF: 0.25 });
    // the core, two stars across each other, peaking in 2-3 of the reference's frames
    const core = (name, size, life, rot, a) => { const s = sp(name, p, size * 0.5, life, tint, { b: 1, s1: size, rot, spin: rnd(-1.2, 1.2), a: a * hit, hot: hit, inF: 0.08, outF: 0.34 }); s.s0 = size * 0.62; return s; };
    if (ice) { core('iceStar', S, 0.24, Math.random() * TAU, 1); core('star2', R, 0.17, Math.random() * TAU, 1); }
    else { core('star', S, 0.24, Math.random() * TAU, 1); core('star2', R, 0.17, Math.random() * TAU, 1); }
    sp('dot', p, R * 1.25, 0.14, tint, { b: 1, s0: R * 0.6, a: 0.8 * hit, hot: 0.55 * hit, outF: 0.2 });
    // a crescent along the blow, thin and pale, the first three frames
    if (!soft) { const s = sp('crescent', p, S * 0.55, 0.13, ice ? C.foam : tint, { b: 1, aspect: 2, rot: lie + rnd(-0.5, 0.5), a: 0.85, hot: 0.9, s0: S * 0.36, outF: 0.3 }); s.mode = 0; }
    // a shockwave for the big ones
    if (I.ring_m > 0) { const s = sp('ring', p, 0.2, 0.3, tint, { b: 1, s0: I.ring_m * 0.11 * lens, s1: I.ring_m * 0.5 * lens, a: 0.9 * hit, hot: 0.8 * hit, outF: 0.12 }); v2.copy(dir).negate(); planeAxes(s, v2, Math.random() * TAU); if (!ice) { const f = sp('foamRing', p, 0.2, 0.42, C.foam, { b: 0, s0: I.ring_m * 0.09 * lens, s1: I.ring_m * 0.42 * lens, a: 0.8, hot: 0.5, add: 0.4, outF: 0.2 }); planeAxes(f, v2, Math.random() * TAU); } }
    // the beam after the core: starts 3-4 of their frames in, lasts five
    if (I.beam_m > 0) {
      const half = (I.beam_m * lens * 0.5) / 14;      // the quad's half-height; 14 times that is the beam's half-length, so it stays a line
      const b = sp('beam', p, half, 0.17, ice ? C.foam : tint, { b: 1, delay: 0.055, aspect: 14, rot: Math.PI / 2 + rnd(-0.7, 0.7) + (Math.random() < 0.5 ? Math.PI / 2 : 0), a: 0.95, hot: 1, inF: 0.1, outF: 0.25 });
      b.s0 = half * 0.8;
      if (I.beam_m >= 5) sp('beam', p, half * 0.72, 0.17, C.gold, { b: 1, delay: 0.075, aspect: 14, rot: b.rot + 1.2, a: 0.8, hot: 1, inF: 0.1, outF: 0.3 });
    }
    // sparks with weight: thrown hard, they drop. A few gold ones off the bronze
    for (let k = 0; k < I.sparks; k++) {
      const gold = k % 4 === 0, a = Math.random() * TAU, b = Math.acos(2 * Math.random() - 1), sp0 = rnd(5, 16) * (I.core_m / 2);
      sp('streak', p, rnd(0.03, 0.06), last(0.2, 0.46), gold ? C.gold : ice ? C.foam : tint, { mode: 1, stretch: 0.06, vx: Math.sin(b) * Math.cos(a) * sp0 + dir.x * 5, vy: Math.cos(b) * sp0 + 2, vz: Math.sin(b) * Math.sin(a) * sp0 + dir.z * 5, drag: 4.2, grav: 9, a: 1, hot: 1 });
    }
    if (ice) {
      for (let k = 0; k < I.shards; k++) { v1.set(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize(); crystal(p, v1, rnd(0.3, 0.7), rnd(0.07, 0.16), last(0.3, 0.6), { fly: rnd(6, 13), grav: 9, grow: 0.01 }); }
      for (let k = 0; k < I.beads; k++) { const a = Math.random() * TAU, b = rnd(0.2, 3), sp0 = rnd(2, 9); sp(k % 2 ? 'flake' : 'glint', p, rnd(0.08, 0.22), last(0.3, 0.7), C.foam, { vx: Math.cos(a) * sp0, vy: b * 2, vz: Math.sin(a) * sp0, drag: 3.5, grav: 1.5, spin: rnd(-6, 6), rot: Math.random() * TAU, hot: 1 }); }
    } else {
      // thick beads and foam: water that has been hit
      for (let k = 0; k < I.beads; k++) { const a = Math.random() * TAU, b = Math.acos(2 * Math.random() - 1), sp0 = rnd(4, 12); sp('bead', p, k % 4 === 0 ? rnd(0.09, 0.15) : rnd(0.035, 0.08), last(0.3, 0.62), C.bead, { add: 0.35, hot: 0.95, a: 0.95, vx: Math.sin(b) * Math.cos(a) * sp0 + dir.x * 3, vy: Math.cos(b) * sp0 + 2.5, vz: Math.sin(b) * Math.sin(a) * sp0 + dir.z * 3, drag: 2.2, grav: 11, sink: 1 }); }
      sp('foam', p, R * 0.75, Math.min(L, 0.34), C.foam, { add: 0.25, hot: 0.65, a: 0.8, s0: R * 0.3, spin: rnd(-2, 2), rot: Math.random() * TAU, outF: 0.25 });
      if (p.y < -0.3 && kind !== 'light') bubbles(p, Math.min(12, I.beads), 1.5);
    }
    // embers last the longest and are the smallest
    for (let k = 0; k < 4; k++) sp('dot', p, rnd(0.03, 0.06), last(0.3, 0.55), gold0(k) ? C.gold : tint, { vx: rnd(-3, 3), vy: rnd(0, 4), vz: rnd(-3, 3), drag: 2, grav: 1, hot: 1 });
    inBurst = 0;
  }
  const gold0 = (k) => k % 2 === 0;

  function parry(p, el) {
    const t = el === 'ice' ? C.ice : C.gold;
    sp('star', p, 3.6, 0.22, t, { b: 1, s0: 1.6, rot: Math.random() * TAU, hot: 1, outF: 0.3 });
    const s = sp('ring', p, 0.2, 0.26, t, { b: 1, s0: 0.6, s1: 4.6, hot: 1, outF: 0.1 }); v1.copy(G.camera.position).sub(p).normalize(); planeAxes(s, v1);
    sparks(p, 16, el === 'ice' ? 0xdff4ff : 0xffe7a8, 12);
  }
  function guard(p, el) { v1.copy(G.camera.position).sub(p).normalize(); v2.copy(p); v2.y += 0.9; const s = sp('ring', v2, 0.2, 0.2, el === 'ice' ? C.ice : C.gold, { b: 1, s0: 1.2, s1: 1.8, a: 0.5, hot: 0.4, outF: 0.4 }); planeAxes(s, v1); }
  function block(p) { sp('star2', p, 2.1, 0.16, C.gold, { b: 1, s0: 1, rot: Math.random() * TAU, a: 0.9, hot: 0.8 }); sparks(p, 12, 0xffd080, 9); }
  function dodge(p, dir, el) {
    v2.copy(p); const t = el === 'ice' ? C.ice : C.water;
    const s = sp('ring', v2, 1.6, 0.17, t, { b: 0, s0: 0.9, s1: 2.3, a: 0.8, hot: 0.9, outF: 0.25 }); v1.copy(G.camera.position).sub(p).normalize(); planeAxes(s, v1);
    for (let k = 0; k < 6; k++) { sp('streak', v2, rnd(0.05, 0.08), rnd(0.12, 0.22), t, { mode: 1, stretch: 0.09, vx: -dir.x * rnd(8, 22) + rnd(-3, 3), vy: -dir.y * rnd(8, 22) + rnd(-3, 3), vz: -dir.z * rnd(8, 22) + rnd(-3, 3), drag: 5 }); }
    bubbles(p, 8, 1.1);
  }
  function perfect(p, el) {
    v2.copy(p); v2.y += 0.3; const t = el === 'ice' ? C.ice : C.water;
    const s = sp('ring', v2, 3, 0.3, t, { b: 1, s0: 1.2, s1: 3.2, a: 1, hot: 1, outF: 0.3 }); v1.copy(G.camera.position).sub(p).normalize(); planeAxes(s, v1);
    sp('glint', v2, 3, 0.2, C.foam, { b: 1, s0: 1, rot: 0.4, hot: 1 });
    for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; sp('streak', v2, 0.08, 0.26, t, { mode: 1, stretch: 0.09, vx: Math.cos(a) * 15, vy: Math.sin(a) * 15 * 0.5, vz: Math.sin(a) * 15, drag: 4 }); }
  }
  function stance(p, el) {
    v2.copy(p); const t = el === 'ice' ? C.ice : C.water;
    const s = sp('ring', v2, 2.8, 0.34, t, { b: 0, s0: 0.5, s1: 2.8, hot: 0.9, outF: 0.2 }); v1.copy(G.camera.position).sub(p).normalize(); planeAxes(s, v1);
    for (let k = 0; k < 14; k++) { const a = Math.random() * TAU, y = rnd(-1, 1.4); v1.set(p.x + Math.cos(a) * 0.5, p.y + y, p.z + Math.sin(a) * 0.5); sp(el === 'ice' ? 'flake' : 'bead', v1, rnd(0.07, 0.15), rnd(0.3, 0.55), t, { add: el === 'ice' ? 1 : 0.2, vx: Math.cos(a) * rnd(2, 5), vy: rnd(1, 4), vz: Math.sin(a) * rnd(2, 5), drag: 3, hot: 0.9 }); }
  }
  function tell(e, b) { const c = b.unblockable ? 0xff4422 : 0xffb238; tmpC.set(c); v1.copy(e.pos); v1.y += 1.1; const s = sp('ring', v1, 2.8, b.tell_s, tmpC, { b: 1, s0: 2.6, s1: 0.7, a: 0.75, hot: 0.12, inF: 0.08, outF: 0.8 }); v2.copy(G.camera.position).sub(v1).normalize(); planeAxes(s, v2); }
  function glint(p, colour, amt) { tmpC.set(colour); sp('glint', p, 0.34 + amt * 0.9, 0.05, tmpC, { b: 1, rot: G.time * 2.4, a: 0.5 + amt * 0.5, hot: 0.4 + amt * 0.6, outF: 0.6 }); }
  // P8d: an attacker off screen shows on screen before it strikes: a mark on the edge of the frame, on the side it's coming from
  const edgeP = new THREE.Vector3(), edgeC = { amber: new THREE.Color(0xffb238), red: new THREE.Color(0xff4422) };
  function edge(p, red) {
    const cam = G.camera; edgeP.copy(p).project(cam); const behind = edgeP.z > 1; let x = edgeP.x, y = edgeP.y;
    if (!behind && Math.abs(x) < 0.94 && Math.abs(y) < 0.94) return false;
    if (behind) { x = -x; y = -y; } const m = Math.max(Math.abs(x), Math.abs(y), 1e-3), k = 0.86 / m; edgeP.set(x * k, y * k, 0.5).unproject(cam);
    v1.copy(edgeP).sub(cam.position).normalize().multiplyScalar(2.2).add(cam.position);
    sp('glint', v1, 0.14 + 0.04 * Math.sin(G.time * 14), 0.05, red ? edgeC.red : edgeC.amber, { b: 1, rot: 0.78, hot: 0.5, outF: 0.7 }); stats.edges++;
    return true;
  }
  // Shoalsong: a wide ring that goes out through the water, a second behind it, and the sound of it in motes of light
  function song(p, r) {
    v1.copy(p); const a = sp('ring', v1, 1, 1.1, C.water, { b: 0, s0: 1.5, s1: r, a: 0.85, hot: 0.7, outF: 0.25 }); planeAxes(a, Y);
    const b = sp('ring', v1, 1, 1.1, C.foam, { b: 0, delay: 0.16, s0: 1.2, s1: r * 0.72, a: 0.6, hot: 0.5, outF: 0.25 }); planeAxes(b, Y);
    for (let k = 0; k < 16; k++) { const an = (k / 16) * TAU, sp0 = rnd(9, 16); v1.set(p.x, p.y + rnd(-0.6, 0.8), p.z); sp('dot', v1, rnd(0.05, 0.11), rnd(0.5, 0.9), C.water, { vx: Math.cos(an) * sp0, vz: Math.sin(an) * sp0, vy: rnd(-1, 1), drag: 1.2, hot: 0.8, stretch: 1.6, outF: 0.5 }); }
  }
  // the song held: each tier it reaches rings round him
  // the water tornado's spray: thrown off the skirt where it tears out of the sea, and off the crown at the top. Sprites only: the column is its own mesh
  function spoutSpray(base, topY, R, k, fall) {
    const baseY = Math.max(base.y, 0.1), n = k > 0.6 ? 3 : 1;
    for (let i = 0; i < n; i++) { const an = rnd(0, TAU), q = R * rnd(1.4, 2.6), out = rnd(3, 8), sw = 9; v1.set(base.x + Math.cos(an) * q, baseY + rnd(0, 1), base.z + Math.sin(an) * q); if (nearLens(v1)) continue; sp('foam', v1, rnd(0.6, 1.3), rnd(0.6, 1), C.foam, { vx: Math.cos(an) * out - Math.sin(an) * sw, vz: Math.sin(an) * out + Math.cos(an) * sw, vy: rnd(5, 13), grav: 14, drag: 0.2, a: 0.8, hot: 0.2, add: 0, inF: 0.1, outF: 0.5, s1: rnd(1.8, 3) }); }
    if (Math.random() < 0.5) { const an = rnd(0, TAU), q = R * rnd(1, 3); v1.set(base.x + Math.cos(an) * q, baseY + rnd(0.5, 3), base.z + Math.sin(an) * q); tmpC.set(0xd8f2ff); if (!nearLens(v1)) sp('smoke', v1, rnd(2.4, 4), rnd(0.9, 1.5), tmpC, { vy: rnd(1, 3), a: 0.22, hot: 0.1, add: 0, inF: 0.2, outF: 0.6, s1: rnd(5, 8) }); }
    if (k > 0.6 && fall <= 0) for (let i = 0; i < 3; i++) { const an = rnd(0, TAU), q = R * rnd(1.6, 2.1), out = rnd(5, 13); v1.set(base.x + Math.cos(an) * q, topY - rnd(0, 2), base.z + Math.sin(an) * q); if (nearLens(v1)) continue; sp(i ? 'bead' : 'foam', v1, i ? rnd(0.08, 0.2) : rnd(0.5, 1.1), rnd(0.6, 1.1), C.foam, { vx: Math.cos(an) * out - Math.sin(an) * 7, vz: Math.sin(an) * out + Math.cos(an) * 7, vy: rnd(1, 7), grav: 18, drag: 0.15, a: 0.85, hot: 0.3, add: 0, inF: 0.06, outF: 0.5, s1: i ? undefined : rnd(1.4, 2.4) }); }
  }
  // something very large going through the top of the sea: a crown of spray thrown out and up, falling back, with foam running out from where it broke
  function crown(p, r) { sheet(p, 4, r); }
  // a thornback's spines: barbs stood out round the body, hot at the tip
  function spines(p, r) { tmpC.set(0xff9a50); for (let k = 0; k < 7; k++) { const an = rnd(0, TAU), up = rnd(-0.7, 0.7), R = r * rnd(0.9, 1.25); v1.set(p.x + Math.cos(an) * R, p.y + up * R, p.z + Math.sin(an) * R); sp('dot', v1, rnd(0.08, 0.14), 0.3, tmpC, { vx: Math.cos(an) * 3, vy: up * 3, vz: Math.sin(an) * 3, stretch: 2.5, a: 0.9, hot: 1, outF: 0.5 }); } }
  // the bed giving way: silt in the sea, embers where the ground burns
  function silt(p, r, hot) { tmpC.set(hot ? 0xff7a30 : 0xa89878); for (let k = 0; k < 4; k++) { const an = rnd(0, TAU), q = Math.sqrt(Math.random()) * r; v1.set(p.x + Math.cos(an) * q, p.y + rnd(0, 1), p.z + Math.sin(an) * q); sp('smoke', v1, rnd(1.2, 2.6), rnd(0.9, 1.6), tmpC, { vy: rnd(0.6, 2), a: hot ? 0.5 : 0.3, hot: hot ? 0.5 : 0.05, add: hot ? 1 : 0, inF: 0.2, outF: 0.6, s1: rnd(2.5, 4), drag: 0.6 }); } }
  function rayLight(p) { for (let k = 0; k < 2; k++) { v1.set(p.x + rnd(-1.5, 1.5), p.y + rnd(-0.4, 0.4), p.z + rnd(-1.5, 1.5)); sp('dot', v1, rnd(1.2, 2.2), 0.7, C.water, { a: 0.4, hot: 0.5, inF: 0.3, outF: 0.5 }); } }
  function chargeRing(p, tier) { v1.copy(p); const s = sp('ring', v1, 1, 0.3, tier === 2 ? C.gold : C.water, { b: 1, s0: 2.4 + tier, s1: 1, a: 0.8, hot: 0.8, outF: 0.4 }); v2.copy(G.camera.position).sub(v1).normalize(); planeAxes(s, v2); }
  function motes(p, n, el) { for (let k = 0; k < n; k++) { v1.set(p.x + rnd(-0.6, 0.6), p.y + rnd(-0.6, 0.8), p.z + rnd(-0.6, 0.6)); sp(el === 'ice' ? 'flake' : 'bead', v1, rnd(0.04, 0.1), rnd(0.3, 0.6), el === 'ice' ? C.foam : C.water, { add: el === 'ice' ? 1 : 0.25, vy: el === 'ice' ? rnd(-0.6, 0.6) : -1.5, grav: el === 'ice' ? 0 : 3, spin: rnd(-3, 3), hot: 0.8 }); } }
  function denied() { if (G.ui && G.ui.hurt) void 0; }
  function shock(p, r, el) {
    const t = el === 'ice' ? C.ice : C.water; v1.copy(p); v1.y -= 0.6;
    const s = sp('ring', v1, 0.4, 0.5, t, { b: 0, s0: r * 0.2, s1: r * 1.2, hot: 0.9, outF: 0.15 }); planeAxes(s, Y);
    if (el === 'ice') { const f = sp('frost', v1, r * 0.9, 1.1, C.foam, { b: 0, s0: r * 0.3, add: 0.7, hot: 0.7, outF: 0.6 }); planeAxes(f, Y, Math.random() * TAU); }
    else { const f = sp('foamRing', v1, 0.4, 0.7, C.foam, { b: 0, s0: r * 0.2, s1: r, add: 0.3, hot: 0.5, outF: 0.3 }); planeAxes(f, Y, Math.random() * TAU); }
    v1.copy(p); impact(v1, Y, 'heavy', el);
  }
  function dissolve(p, body) {
    // what's left of them goes as dark smoke; it takes as long as the reference's, about 0.8 s
    tmpC.setRGB(0.012, 0.02, 0.03);
    const n = body === 'shark' ? 10 : 14;
    for (let k = 0; k < n; k++) { v1.set(p.x + rnd(-0.8, 0.8), p.y + rnd(-1, 1.1), p.z + rnd(-0.8, 0.8)); sp('smoke', v1, rnd(1.1, 2), rnd(0.6, 1.0), tmpC, { add: 0, hot: 0, a: 0.75, delay: rnd(0, 0.32), s0: rnd(0.5, 0.9), vy: rnd(0.2, 1.1), vx: rnd(-0.5, 0.5), vz: rnd(-0.5, 0.5), inF: 0.2, outF: 0.5, spin: rnd(-1, 1), rot: Math.random() * TAU }); }
  }
  function frostBurst(p, r) { for (let k = 0; k < 5; k++) { v1.set(p.x + rnd(-r, r), p.y + rnd(0, r * 1.2), p.z + rnd(-r, r)); sp('smoke', v1, r * 1.5, rnd(0.3, 0.6), C.foam, { add: 0.8, a: 0.3, hot: 0.1, s0: r * 0.5, vy: 1 }); sp('glint', v1, rnd(0.2, 0.5), rnd(0.15, 0.32), C.foam, { hot: 1, rot: Math.random() * TAU }); } v1.copy(p); v1.y += 0.1; const f = sp('frost', v1, r * 2.1, 1.4, C.ice, { b: 0, s0: r, add: 0.75, hot: 0.65, a: 0.85, outF: 0.55 }); planeAxes(f, Y, Math.random() * TAU); }
  // Winter's Breath: a cone of cold, drawn every step it runs
  function frost(p, dir, range, coneDeg) {
    const half = (coneDeg * Math.PI) / 360, sp0 = range * 2.2;
    for (let k = 0; k < (phone ? 3 : 4); k++) {
      const a = Math.random() * TAU, off = Math.random() * half * 0.92;
      v1.copy(Math.abs(dir.y) > 0.9 ? ZF : Y).cross(dir).normalize(); v2.crossVectors(dir, v1).normalize();
      v3.copy(dir).multiplyScalar(Math.cos(off)).addScaledVector(v1, Math.sin(off) * Math.cos(a)).addScaledVector(v2, Math.sin(off) * Math.sin(a));
      sp(k % 3 === 0 ? 'smoke' : k % 3 === 1 ? 'flake' : 'glint', p, k % 3 === 0 ? rnd(0.9, 1.8) : rnd(0.1, 0.28), 0.5, C.ice, { add: 0.85, a: k % 3 === 0 ? 0.32 : 1, hot: k % 3 === 0 ? 0.15 : 1, s0: k % 3 === 0 ? 0.3 : undefined, vx: v3.x * sp0, vy: v3.y * sp0, vz: v3.z * sp0, drag: 1.2, spin: rnd(-4, 4), rot: Math.random() * TAU, outF: 0.5 });
    }
  }

  // ------------------------------------------------------------------ the fluid mesh: rebuilt every frame from what's running, one draw, one material, real normals
  const FV = phone ? 3600 : 5200, FI = FV * 6;
  const fPos = new Float32Array(FV * 3), fNor = new Float32Array(FV * 3), fUv = new Float32Array(FV * 2), fAt = new Float32Array(FV * 3), fIdx = new Uint16Array(FI);
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3).setUsage(THREE.DynamicDrawUsage)); fGeo.setAttribute('normal', new THREE.BufferAttribute(fNor, 3).setUsage(THREE.DynamicDrawUsage));
  fGeo.setAttribute('uv', new THREE.BufferAttribute(fUv, 2).setUsage(THREE.DynamicDrawUsage)); fGeo.setAttribute('aF', new THREE.BufferAttribute(fAt, 3).setUsage(THREE.DynamicDrawUsage));
  fGeo.setIndex(new THREE.BufferAttribute(fIdx, 1).setUsage(THREE.DynamicDrawUsage)); fGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const sunDir = new THREE.Vector3(0.35, 0.86, 0.36).normalize();
  const fMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    uniforms: { uT: shared.uT, tN: { value: noiseT }, uSun: { value: sunDir } },
    vertexShader: `attribute vec3 aF; varying vec3 vN, vW, vF; varying vec2 vUv; uniform float uT;
      void main() { vUv = uv; vF = aF; vN = normal; vec3 p = position + normal * (sin(uv.x * 9.0 - uT * 11.0 + uv.y * 6.0) * 0.022 + sin(uv.x * 23.0 + uT * 7.0) * 0.012);
        vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uT; uniform sampler2D tN; uniform vec3 uSun; varying vec3 vN, vW, vF; varying vec2 vUv;
      void main() {
        vec3 V = normalize(cameraPosition - vW), N = normalize(vN); if (!gl_FrontFacing) N = -N;
        float n1 = texture2D(tN, vUv * vec2(0.5, 0.33) + vec2(-uT * 0.9, uT * 0.17)).r, n2 = texture2D(tN, vUv * vec2(1.3, 0.8) + vec2(uT * 0.5, -uT * 0.43)).r;
        N = normalize(N + (vec3(n1, n2, 1.0 - n1) - 0.5) * 0.9);
        float nv = clamp(dot(N, V), 0.0, 1.0), fres = pow(1.0 - nv, 2.6);
        vec3 deep = mix(vec3(0.03, 0.42, 0.68), vec3(0.0, 0.10, 0.26), vF.z), mid = mix(vec3(0.16, 0.68, 0.88), vec3(0.01, 0.33, 0.60), vF.z), lite = vec3(0.72, 0.98, 1.0);
        vec3 R = reflect(-V, N); float sky = smoothstep(-0.25, 0.85, R.y);
        // light through a thick body: dark at its heart, lit where it thins
        vec3 col = mix(deep, mid, smoothstep(0.1, 0.9, n1 * 0.7 + (1.0 - nv) * 0.8));
        // caustic veins: ridged noise, thin bright lines that slide through it, what makes a body of water read as water
        float n3 = texture2D(tN, vUv * vec2(0.8, 0.6) + vec2(-uT * 1.3, uT * 0.31) + n1 * 0.3).r, vein = pow(clamp(1.0 - abs(n3 * 2.0 - 1.0) * 2.6, 0.0, 1.0), 5.0);
        col += lite * vein * 0.85 * (0.4 + 0.6 * nv);
        col = mix(col, mix(mid, lite * 1.3, sky), fres * 0.92);
        float s = max(dot(R, uSun), 0.0), spec = pow(s, 80.0) * 2.6 + pow(s, 10.0) * 0.2;
        float foam = smoothstep(0.6, 0.72, n1 * 0.6 + n2 * 0.6 + vF.x * 0.62 - 0.3);
        col = mix(col, vec3(0.93, 0.99, 1.0), foam);
        float a = clamp((mix(0.3, 0.46, vF.z) + fres * 0.7 + vein * 0.3 + foam * 0.5), 0.0, 1.0) * vF.y;
        gl_FragColor = vec4((col + spec) * a, a); }`,
  });
  const fMesh = new THREE.Mesh(fGeo, fMat); fMesh.frustumCulled = false; fMesh.renderOrder = 15.5; fMesh.visible = false; scene.add(fMesh);
  // A real splash: a sheet of water thrown up and out in a scalloped crown, stalling, falling back in on itself and tearing as it goes, with droplets off its rim and a thin ring on the sea.
  // size is how hard: 1 a dolphin going in, 3 a leap from speed, 4 a slam. wide opens the crown round something broad. One instanced mesh on the GPU, one draw for every one of them
  const SHN = phone ? 6 : 8, shI = new Float32Array(SHN * 7).fill(-1e4), shGeo = new THREE.InstancedBufferGeometry(); let shAt = 0;
  { const NU = 64, NV = 12, A = new Float32Array((NU + 1) * (NV + 1) * 2), idx = []; let k = 0; for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { A[k++] = (i / NU) * TAU; A[k++] = j / NV; } for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    shGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(A.length / 2 * 3), 3)); shGeo.setAttribute('aS', new THREE.BufferAttribute(A, 2)); shGeo.setIndex(idx); const ib = new THREE.InstancedInterleavedBuffer(shI, 7); ib.setUsage(THREE.DynamicDrawUsage); shGeo.userData.ib = ib; shGeo.setAttribute('iA', new THREE.InterleavedBufferAttribute(ib, 4, 0)); shGeo.setAttribute('iB', new THREE.InterleavedBufferAttribute(ib, 3, 4)); shGeo.instanceCount = SHN; shGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); }
  const shMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    uniforms: { uT: shared.uT, tN: { value: noiseT }, uSun: { value: sunDir } },
    vertexShader: `attribute vec2 aS; attribute vec4 iA; attribute vec3 iB; uniform float uT; varying vec3 vN, vW; varying vec3 vQ;
      vec3 at(float a, float v, float q, float S, float seed, float wide) {
        float rise = sin(min(q * 1.5, 1.0) * 1.5708), lobe = 1.0 + 0.2 * sin(a * 5.0 + seed) + 0.14 * sin(a * 3.0 - seed * 2.0) + 0.07 * sin(a * 11.0 + seed * 3.0), H = (1.3 + S * 2.5) * lobe * (rise - 0.92 * q * q * q);
        float r0 = wide + 0.5 + S * 0.6, rim = r0 + (0.6 + S * 1.5) * pow(q, 0.7) * (1.0 + 0.1 * sin(a * 5.0 + seed)), r = mix(r0 * (0.86 + 0.3 * q), rim, pow(v, 0.8)) + (0.3 + S * 0.16) * sin(v * 3.1416) * (1.0 - q); return vec3(cos(a) * r, max(H, 0.0) * v, sin(a) * r); }
      void main() { float S = iA.w, T = 0.66 + 0.13 * S, q = (uT - iB.x) / T; if (q < 0.0 || q >= 1.0) { gl_Position = vec4(0.0, 0.0, 9.0, 1.0); return; }
        float a = aS.x, v = aS.y; vec3 p = at(a, v, q, S, iB.y, iB.z), dA = at(a + 0.03, v, q, S, iB.y, iB.z) - p, dV = at(a, v + 0.03, q, S, iB.y, iB.z) - p; vN = normalize(cross(dV, dA)); vW = p + iA.xyz; vQ = vec3(a + iB.y, v, q); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
    fragmentShader: `uniform float uT; uniform sampler2D tN; uniform vec3 uSun; varying vec3 vN, vW; varying vec3 vQ;
      void main() { vec3 V = normalize(cameraPosition - vW), N = normalize(vN); if (!gl_FrontFacing) N = -N; float v = vQ.y, q = vQ.z, n1 = texture2D(tN, vec2(vQ.x * 0.477465, v * 0.8 - uT * 0.5)).r, n2 = texture2D(tN, vec2(vQ.x * 1.432394, v * 1.7 + uT * 0.4)).r;
        N = normalize(N + (vec3(n1, n2, 1.0 - n1) - 0.5) * 0.9); float nv = clamp(dot(N, V), 0.0, 1.0), fres = pow(1.0 - nv, 2.4); vec3 R = reflect(-V, N); float sky = smoothstep(-0.25, 0.85, R.y), s = max(dot(R, uSun), 0.0), spec = pow(s, 60.0) * 2.2;
        vec3 col = mix(vec3(0.03, 0.46, 0.7), vec3(0.14, 0.72, 0.92), n1); col = mix(col, mix(vec3(0.3, 0.8, 0.95), vec3(0.85, 1.0, 1.0), sky), fres * 0.85); float foam = smoothstep(0.42, 0.7, n1 * 0.5 + n2 * 0.4 + v * v * 0.55 + q * 0.3 - 0.1); col = mix(col, vec3(0.94, 0.99, 1.0), foam);
        // it thins and tears as it falls, from the rim down
        float cut = q * q * 1.25 + v * q * 0.3, tear = smoothstep(cut - 0.1, cut + 0.1, n2 * 0.62 + n1 * 0.5), rim = smoothstep(1.02, 0.62, v + (n2 - 0.5) * 0.55), a = clamp(0.3 + fres * 0.5 + foam * 0.5, 0.0, 1.0) * tear * rim * smoothstep(1.0, 0.75, q) * smoothstep(0.0, 0.12, v + 0.02); if (a < 0.01) discard; gl_FragColor = vec4((col + spec) * a, a); }`,
  });
  const shMesh = new THREE.Mesh(shGeo, shMat); shMesh.frustumCulled = false; shMesh.renderOrder = 15.45; scene.add(shMesh);
  const nearLens = (q) => q.distanceToSquared(G.camera.position) < 64;      // a droplet by the lens is a disc across half the frame
  function sheet(p, size = 1, wide = 0) {
    const k = shAt * 7, S = clamp(size, 0.3, 4.4); shAt = (shAt + 1) % SHN; shI[k] = p.x; shI[k + 1] = p.y; shI[k + 2] = p.z; shI[k + 3] = S; shI[k + 4] = shared.uT.value; shI[k + 5] = rnd(0, TAU); shI[k + 6] = wide; shGeo.userData.ib.needsUpdate = true;
    const R = wide + 0.7 + S * 0.8, n = 8 + (S * 12 | 0);
    for (let i = 0; i < n; i++) { const an = rnd(0, TAU), up = rnd(0.45, 1) * (5 + S * 4.2), out = rnd(1, 2.4) * (1 + S * 0.7); v1.set(p.x + Math.cos(an) * R, p.y + rnd(0.2, 1 + S * 0.6), p.z + Math.sin(an) * R); if (nearLens(v1)) continue; sp('bead', v1, rnd(0.07, 0.13) + S * 0.03, rnd(0.55, 0.95), C.foam, { vx: Math.cos(an) * out, vz: Math.sin(an) * out, vy: up, grav: 15, drag: 0.1, a: 0.95, hot: 0.5, outF: 0.35 }); }
    for (let i = 0; i < 4 + (S * 2 | 0); i++) { const an = rnd(0, TAU); v1.set(p.x + Math.cos(an) * R, p.y + rnd(0, 0.8), p.z + Math.sin(an) * R); if (nearLens(v1)) continue; tmpC.set(0xeaf8ff); sp('smoke', v1, 0.8 + S * 0.35, rnd(0.6, 1), tmpC, { vy: rnd(0.8, 2.4), vx: Math.cos(an) * 1.6, vz: Math.sin(an) * 1.6, a: 0.28, hot: 0.1, add: 0, inF: 0.15, outF: 0.6, s1: 1.8 + S * 0.8 }); }
    tmpC.set(0xe8fbff); v2.set(p.x, Math.max(p.y, 0.04), p.z); const s = sp('foamRing', v2, 1, 1 + S * 0.15, C.foam, { s0: R * 0.7, s1: R * 1.5, a: 0.5, hot: 0.15, add: 0.2, outF: 0.5 }); planeAxes(s, Y, rnd(0, TAU)); const s2 = sp('ring', v2, 0.1, 0.8 + S * 0.1, tmpC, { s0: R * 0.8, s1: R * 2, a: 0.18, hot: 0.1, outF: 0.3 }); planeAxes(s2, Y);
  }
  let fv = 0, fi = 0; const O = { x: 0, y: 0, z: 0, foam: 0, a: 1, thick: 1 };

  // a grid of (nu+1)x(nv+1) points from fill(u, v); normals from its own neighbours; closeV joins the last column to the first
  function grid(nu, nv, closeV, fill, uScale = 1, vScale = 1) {
    const rows = nu + 1, cols = nv + 1, n = rows * cols; if (fv + n > FV || fi + nu * nv * 6 > FI) return;
    const start = fv;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      fill(i / nu, j / nv, i, j); const k = fv * 3;
      fPos[k] = O.x; fPos[k + 1] = O.y; fPos[k + 2] = O.z; fUv[fv * 2] = (i / nu) * uScale; fUv[fv * 2 + 1] = (j / nv) * vScale; fAt[fv * 3] = O.foam; fAt[fv * 3 + 1] = O.a; fAt[fv * 3 + 2] = O.thick; fv++;
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const at = (a, b) => (start + a * cols + b) * 3, ip = Math.min(nu, i + 1), im = Math.max(0, i - 1);
      const jp = closeV ? (j + 1) % nv : Math.min(nv, j + 1), jm = closeV ? (j - 1 + nv) % nv : Math.max(0, j - 1);
      const a = at(ip, j), b = at(im, j), c = at(i, jp), d = at(i, jm);
      const ux = fPos[a] - fPos[b], uy = fPos[a + 1] - fPos[b + 1], uz = fPos[a + 2] - fPos[b + 2], vx = fPos[c] - fPos[d], vy = fPos[c + 1] - fPos[d + 1], vz = fPos[c + 2] - fPos[d + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const k = at(i, j); fNor[k] = nx; fNor[k + 1] = ny; fNor[k + 2] = nz;
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = start + i * cols + j, b = a + cols; fIdx[fi++] = a; fIdx[fi++] = b; fIdx[fi++] = a + 1; fIdx[fi++] = a + 1; fIdx[fi++] = b; fIdx[fi++] = b + 1; }
  }
  // a tube round a line of points, its frame carried along so it never twists
  const fwdT = new THREE.Vector3(), nA = new THREE.Vector3(), bA = new THREE.Vector3();
  const tubeF = { n: [], b: [] }; for (let i = 0; i < 48; i++) { tubeF.n.push(new THREE.Vector3()); tubeF.b.push(new THREE.Vector3()); }
  function tube(pts, count, radius, ringN, foamAt, alphaAt) {
    if (count < 3) return;
    fwdT.subVectors(pts[1], pts[0]).normalize(); nA.copy(Math.abs(fwdT.y) > 0.9 ? ZF : Y).cross(fwdT).normalize();
    for (let i = 0; i < count; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(count - 1, i + 1)]; fwdT.subVectors(b, a); if (fwdT.lengthSq() < 1e-8) fwdT.set(0, 0, 1); fwdT.normalize();
      nA.addScaledVector(fwdT, -nA.dot(fwdT)).normalize(); bA.crossVectors(fwdT, nA); tubeF.n[i].copy(nA); tubeF.b[i].copy(bA);
    }
    let len = 0; for (let i = 1; i < count; i++) len += pts[i].distanceTo(pts[i - 1]);
    grid(count - 1, ringN, true, (u, v, i, j) => {
      const r = radius(u), a = (j % ringN) / ringN * TAU, c = Math.cos(a) * r, s = Math.sin(a) * r, p = pts[i], n = tubeF.n[i], b = tubeF.b[i];
      O.x = p.x + n.x * c + b.x * s; O.y = p.y + n.y * c + b.y * s; O.z = p.z + n.z * c + b.z * s; O.foam = foamAt(u); O.a = alphaAt(u); O.thick = 0.25;
    }, Math.max(1, len) * 0.45, 4);
  }

  // ------------------------------------------------------------------ the trident's stream: it leaves water behind it, thick enough to catch the light
  const HIST = 18, hist = []; for (let i = 0; i < HIST; i++) hist.push({ p: new THREE.Vector3(), on: 0 });
  const line = []; for (let i = 0; i < 48; i++) line.push(new THREE.Vector3());
  let trailOn = 0, shardT = 0;
  function pushTrail(a, b, on) {
    void b;
    const heat = G.combat && G.combat.trail ? G.combat.trail() * (on ? 1 : 0) : on; const last = hist.pop(); last.p.copy(a); last.on = heat; hist.unshift(last);
    trailOn = Math.max(heat, trailOn * 0.86);
  }
  function trailMesh() {
    let k = 0; for (let i = 0; i < HIST; i++) if (hist[i].on > 0.5) k = i + 1; if (k < 4) return;
    const ice = G.combat && G.combat.stance === 'ice';
    if (ice) {
      shardT -= 1; if (shardT <= 0 && hist[0].on > 0.5) { shardT = 2; v2.copy(hist[0].p).sub(hist[2].p); if (v2.lengthSq() > 1e-4) { v2.normalize(); crystal(hist[0].p, v2, rnd(0.35, 0.8), rnd(0.07, 0.13), rnd(0.22, 0.4), { fly: rnd(0.2, 1.4), grav: 3 }); sp('glint', hist[0].p, rnd(0.16, 0.36), 0.16, C.foam, { hot: 1, rot: Math.random() * TAU }); } }
      return;
    }
    // smooth the history into a line twice as fine
    const n = Math.min(k, HIST), N = Math.min(40, (n - 1) * 2 + 1);
    for (let i = 0; i < N; i++) { const t = (i / (N - 1)) * (n - 1), a = Math.floor(t), f = t - a, p0 = hist[Math.max(0, a - 1)].p, p1 = hist[a].p, p2 = hist[Math.min(n - 1, a + 1)].p, p3 = hist[Math.min(n - 1, a + 2)].p, f2 = f * f, f3 = f2 * f; line[i].set(0.5 * (2 * p1.x + (p2.x - p0.x) * f + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * f3), 0.5 * (2 * p1.y + (p2.y - p0.y) * f + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * f3), 0.5 * (2 * p1.z + (p2.z - p0.z) * f + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * f2 + (3 * p1.z - p0.z - 3 * p2.z + p3.z) * f3)); }
    const R = 0.15, s = trailOn;
    tube(line, N, (u) => R * s * Math.pow(Math.sin(Math.PI * clamp(Math.pow(u, 0.62), 0.02, 0.98)), 0.7), 7, (u) => 0.1 + u * 0.32, (u) => (1 - u * u) * s);
    if (Math.random() < 0.55) { const i = Math.floor(Math.random() * N); v2.subVectors(line[Math.min(N - 1, i + 1)], line[i]).multiplyScalar(14); sp('bead', line[i], rnd(0.04, 0.1), rnd(0.25, 0.45), C.bead, { add: 0.35, a: 0.95, hot: 0.95, vx: v2.x * 0.3, vy: v2.y * 0.3 + 1, vz: v2.z * 0.3, grav: 10, drag: 1.6, sink: 1 }); }
  }

  // ------------------------------------------------------------------ Water Whip: a rope of water from his hand, the lash's wave running out along it
  const whipS = { on: 0, a: new THREE.Vector3(), b: new THREE.Vector3(), t: 0 };
  function whip(a, b, s) { whipS.on = s; whipS.a.copy(a); whipS.b.copy(b); whipS.t = 2; }
  function whipMesh(dt) {
    if (whipS.t <= 0) return; whipS.t -= 1; const s = whipS.on;
    fwdT.subVectors(whipS.b, whipS.a); const L = fwdT.length(); if (L < 0.2) return; fwdT.multiplyScalar(1 / L);
    v2.copy(Y).cross(fwdT).normalize(); v3.crossVectors(fwdT, v2).normalize();
    const N = 26, tt = G.time * 21;
    for (let i = 0; i < N; i++) { const u = i / (N - 1), env = Math.sin(Math.PI * u) * (0.35 + 0.65 * (1 - u)), w = Math.sin(u * 8 - tt) * 0.42 * env, q = Math.cos(u * 5 - tt * 0.7) * 0.28 * env; line[i].copy(whipS.a).addScaledVector(fwdT, L * u).addScaledVector(v2, w).addScaledVector(v3, q); }
    tube(line, N, (u) => (0.2 - 0.1 * u + Math.sin(u * 30 - tt) * 0.035) * s * (u > 0.94 ? (1 - u) / 0.06 : 1), 7, (u) => 0.15 + u * 0.4, () => clamp(s * 1.2, 0, 1));
    if (Math.random() < 0.8) { const i = Math.floor(Math.random() * N); sp('bead', line[i], rnd(0.04, 0.1), rnd(0.2, 0.4), C.bead, { add: 0.35, hot: 0.95, vx: rnd(-2, 2), vy: rnd(-1, 3), vz: rnd(-2, 2), grav: 9, sink: 1 }); }
    if (s > 0.9) { sp('foam', whipS.b, rnd(0.5, 0.9), 0.13, C.foam, { add: 0.3, hot: 0.6, rot: Math.random() * TAU }); }
  }

  // ------------------------------------------------------------------ Riptide: two streams wind round him and stream off behind
  let ripOn = 0, ripWant = 0;
  function riptide(on) { ripWant = on ? 1 : 0; }
  function ripMesh(dt) {
    ripOn += (ripWant - ripOn) * (1 - Math.exp(-(ripWant ? 22 : 9) * dt)); if (ripOn < 0.03) return;
    const h = G.hero, sp0 = h.vel.length(); if (sp0 < 2 && !ripWant) return;
    fwdT.copy(h.vel).normalize(); if (!isFinite(fwdT.x)) return; v2.copy(Y).cross(fwdT).normalize(); v3.crossVectors(fwdT, v2);
    for (let arm = 0; arm < 2; arm++) {
      const N = 22, ph = arm * Math.PI + G.time * 24;
      for (let i = 0; i < N; i++) { const u = i / (N - 1), R = (0.55 + u * 1.2) * (1 - u * 0.3), a = ph - u * 9, back = 1.2 - u * 7.4; line[i].copy(h.drawPos).addScaledVector(fwdT, back).addScaledVector(v2, Math.cos(a) * R).addScaledVector(v3, Math.sin(a) * R); }
      tube(line, N, (u) => 0.1 * ripOn * Math.sin(Math.PI * clamp(u * 0.94 + 0.05, 0, 1)), 6, (u) => 0.15 + u * 0.55, (u) => ripOn * (1 - u * u));
    }
    bubbles(h.pos, 2, 1.2);
  }

  // ------------------------------------------------------------------ Maelstrom: three streams pour round him, climbing and widening
  let vortT = 0, vortP = new THREE.Vector3();
  function spin(p) { vortT = 1.0; vortP.copy(p); bubbles(p, 26, 5); }
  function vortexMesh(dt) {
    if (vortT <= 0) return; vortT -= dt; if (G.hero) vortP.copy(G.hero.drawPos);
    const k = clamp(vortT * 3.2, 0, 1) * clamp((1.0 - vortT) * 8, 0, 1);
    for (let arm = 0; arm < 3; arm++) {
      const N = 30, ph = (arm / 3) * TAU + G.time * 8.5;
      for (let i = 0; i < N; i++) { const u = i / (N - 1), R = 0.9 + u * 3.5, a = ph + u * 7.6, y = -1.2 + u * 3.6; line[i].set(vortP.x + Math.cos(a) * R, vortP.y + y, vortP.z + Math.sin(a) * R); }
      tube(line, N, (u) => k * (0.22 - 0.06 * u) * Math.pow(Math.sin(Math.PI * clamp(u, 0.03, 0.97)), 0.6), 6, (u) => 0.15 + u * 0.6, (u) => k * (1 - u * 0.6));
    }
    for (let i = 0; i < 2; i++) { const a = Math.random() * TAU, R = rnd(1, 4.2); v1.set(vortP.x + Math.cos(a) * R, vortP.y + rnd(-1, 2.4), vortP.z + Math.sin(a) * R); sp(i ? 'foam' : 'bubble', v1, i ? rnd(0.4, 0.8) : rnd(0.04, 0.09), 0.34, C.foam, { add: 0.3, hot: 0.8, a: 0.8, vx: -Math.sin(a) * 9, vz: Math.cos(a) * 9, vy: 1.4, rot: Math.random() * TAU, sink: 1 }); }
  }

  // ------------------------------------------------------------------ Tidal Wave: a rolling wall, a real lip over a real face, foam at the crest
  const shot = { on: false, from: new THREE.Vector3(), dir: new THREE.Vector3(), d: 0, t: 0, speed: 34, max: 38 };
  function wave(from, dir) { shot.on = true; shot.from.copy(from); shot.dir.copy(dir).normalize(); shot.d = 1; shot.t = 0; }
  function waveMesh(dt) {
    if (!shot.on) return;
    shot.d += shot.speed * dt; shot.t += dt; const q = shot.d / shot.max; if (q >= 1) { shot.on = false; return; }
    const dir = shot.dir; v2.copy(Y).cross(dir); if (v2.lengthSq() < 1e-3) v2.set(1, 0, 0); v2.normalize(); v3.crossVectors(dir, v2).normalize();
    const hw = 8 + q * 7, H = 3.6 + q * 2.4, fade = clamp((1 - q) * 3.4, 0, 1) * clamp(shot.t * 9, 0, 1);
    v1.copy(shot.from).addScaledVector(dir, shot.d);
    const cx = v1.x, cy = v1.y, cz = v1.z, tt = G.time * 5;
    grid(22, 10, false, (u, v) => {
      const x = (u - 0.5) * 2, bow = -x * x * 3.4, edge = 1 - x * x * x * x, h = H * edge * (0.86 + 0.14 * Math.sin(x * 7 + tt));
      // a wave's section: a rising face, a lip thrown forward, a back that falls away
      const th = v * Math.PI * 1.25 - 0.25, ry = (1 - Math.cos(th)) * 0.5 * h, rz = Math.sin(th) * (0.9 + v * v * 1.9);
      O.x = cx + v2.x * x * hw + dir.x * (bow + rz) + v3.x * (ry - h * 0.4); O.y = cy + v2.y * x * hw + dir.y * (bow + rz) + v3.y * (ry - h * 0.4); O.z = cz + v2.z * x * hw + dir.z * (bow + rz) + v3.z * (ry - h * 0.4);
      O.foam = clamp(1.25 * Math.pow(v, 3) + (v < 0.12 ? 0.6 : 0), 0, 1.2); O.a = fade * clamp(edge * 2.2, 0, 1); O.thick = 1;
    }, 7, 3);
    for (let k = 0; k < 3; k++) { const x = rnd(-1, 1); v1.set(cx + v2.x * x * hw * 0.9 + dir.x * 2, cy + v2.y * x * hw * 0.9 + H * 0.6, cz + v2.z * x * hw * 0.9 + dir.z * 2); sp(k ? 'bead' : 'foam', v1, k ? rnd(0.06, 0.15) : rnd(0.5, 1.1), rnd(0.3, 0.6), k ? C.bead : C.foam, { add: 0.2, hot: 0.85, a: 0.9, vx: dir.x * rnd(14, 34), vy: dir.y * 20 + rnd(1, 7), vz: dir.z * rnd(14, 34), grav: 13, drag: 1.2, rot: Math.random() * TAU, sink: 1 }); }
    if (Math.random() < 0.6) bubbles(v1, 3, 6);
  }

  // ------------------------------------------------------------------ Geyser: bubbling first (the tell), then a column with a crown
  const gey = []; for (let i = 0; i < 3; i++) gey.push({ on: 0, p: new THREE.Vector3(), r: 3, h: 12, t: 0, tell: 0, T: 1 });
  function geyser(p, r, h, t, tell, T) { let g = gey.find((x) => x.on > 0 && x.p.distanceToSquared(p) < 0.01); if (!g) g = gey.find((x) => x.on <= 0) || gey[0]; g.on = 2; g.p.copy(p); g.r = r; g.h = h; g.t = t; g.tell = tell; g.T = T; }
  function geyserMesh() {
    for (const g of gey) {
      if (g.on <= 0) continue; g.on -= 1;
      const p = g.p;
      if (g.t < g.tell) { const q = g.t / g.tell; if (Math.random() < 0.9) { const a = Math.random() * TAU, R = Math.sqrt(Math.random()) * g.r; v1.set(p.x + Math.cos(a) * R, p.y + 0.2, p.z + Math.sin(a) * R); sp(Math.random() < 0.4 ? 'foam' : 'bubble', v1, rnd(0.2, 0.5) * (0.5 + q), 0.3, C.foam, { add: 0.3, hot: 0.8, vy: rnd(1, 5), rot: Math.random() * TAU }); } continue; }
      const age = g.t - g.tell, life = g.T - g.tell, up = clamp(age / 0.13, 0, 1), fall = clamp((life - age) / 0.3, 0, 1), H = g.h * (1 - (1 - up) * (1 - up)) * (0.4 + 0.6 * fall), rad = g.r * 0.72, tt = G.time * 16;
      grid(14, 12, true, (u, v, i, j) => {
        const a = (j % 12) / 12 * TAU, y = u * H, bell = u > 0.82 ? 1 + (u - 0.82) * 3.2 : 1 - u * 0.42, r = rad * bell * (1 + 0.14 * Math.sin(a * 3 + y * 1.1 - tt) + 0.08 * Math.sin(a * 5 - y * 2.1 + tt));
        O.x = p.x + Math.cos(a) * r; O.y = p.y + y; O.z = p.z + Math.sin(a) * r; O.foam = 0.32 + (u > 0.78 ? (u - 0.78) * 4 : 0) + (u < 0.1 ? 0.5 : 0); O.a = fall * (u > 0.96 ? (1 - u) / 0.04 : 1); O.thick = 0.8;
      }, 4, 5);
      for (let k = 0; k < 3; k++) { const a = Math.random() * TAU; v1.set(p.x + Math.cos(a) * rad, p.y + H * rnd(0.7, 1), p.z + Math.sin(a) * rad); const s = rnd(5, 12); sp(k ? 'bead' : 'foam', v1, k ? rnd(0.07, 0.16) : rnd(0.7, 1.4), rnd(0.35, 0.65), k ? C.bead : C.foam, { add: 0.2, hot: 0.85, a: 0.9, vx: Math.cos(a) * s, vy: rnd(3, 11), vz: Math.sin(a) * s, grav: 15, drag: 0.8, rot: Math.random() * TAU, sink: 1 }); }
    }
  }

  // ------------------------------------------------------------------ the crystals: one faceted mesh, every piece of ice in the game is an instance of it
  const crystalGeo = (() => {
    // a long irregular hex spike: base at 0, a shoulder, a point, a short keel under it so a flying shard is closed
    let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, P = [], I = [], n = 6;
    const ring = (y, R, j) => { for (let i = 0; i < n; i++) { const a = (i / n) * TAU + j, q = R * (0.8 + r() * 0.34); P.push(Math.cos(a) * q, y, Math.sin(a) * q); } };
    ring(0.0, 0.92, 0); ring(0.62, 1.0, 0.18); P.push(0.12, 1.0, 0.06, 0, -0.14, 0); const tip = n * 2, keel = tip + 1;
    for (let i = 0; i < n; i++) { const a = i, b = (i + 1) % n, c = a + n, d = b + n; I.push(a, c, b, b, c, d, c, tip, d, a, b, keel); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); return g;
  })();
  const CN = phone ? 96 : 160;
  const cMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, toneMapped: false, side: THREE.FrontSide,
    uniforms: { uT: shared.uT, tN: { value: noiseT }, uSun: { value: sunDir } },
    vertexShader: `attribute vec2 aI; varying vec3 vW, vL; varying vec2 vI;
      void main() { vI = aI; vL = position * 3.0; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uT; uniform sampler2D tN; uniform vec3 uSun; varying vec3 vW, vL; varying vec2 vI;
      void main() {
        vec3 N = normalize(cross(dFdx(vW), dFdy(vW))); vec3 V = normalize(cameraPosition - vW); if (dot(N, V) < 0.0) N = -N;
        float nv = clamp(dot(N, V), 0.0, 1.0), fres = pow(1.0 - nv, 2.1);
        vec3 T = refract(-V, N, 0.76), R = reflect(-V, N);
        // what's inside: two veils seen through the facet, offset by the refracted ray, so they slide as the crystal turns
        float a1 = texture2D(tN, vL.xy * 0.34 + T.xy * 0.55).r, a2 = texture2D(tN, vL.zy * 0.21 - T.zx * 0.4 + 0.3).r, veil = pow(clamp(a1 * a2 * 3.3, 0.0, 1.4), 2.0);
        vec3 deep = vec3(0.05, 0.27, 0.54), pale = vec3(0.60, 0.90, 1.0);
        vec3 col = mix(deep, pale, clamp(veil, 0.0, 1.0));
        float facet = 0.5 + 0.5 * dot(N, normalize(vec3(0.3, 0.8, 0.5))); col *= 0.74 + 0.5 * facet;
        col = mix(col, vec3(0.86, 0.97, 1.0), fres);
        float s = max(dot(R, uSun), 0.0), spec = pow(s, 42.0) * 2.0;
        // a cold glow from within, strongest when the ice is new
        col += vec3(0.22, 0.6, 1.0) * (0.25 + vI.x * 1.0);
        gl_FragColor = vec4(col + spec, (0.86 + fres * 0.14) * vI.y); }`,
  });
  const cMesh = new THREE.InstancedMesh(crystalGeo, cMat, CN); cMesh.frustumCulled = false; cMesh.renderOrder = 6; cMesh.count = 0; cMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const cAttr = new THREE.InstancedBufferAttribute(new Float32Array(CN * 2), 2).setUsage(THREE.DynamicDrawUsage); crystalGeo.setAttribute('aI', cAttr); scene.add(cMesh);
  const crystals = []; for (let i = 0; i < CN; i++) crystals.push({ on: false, p: new THREE.Vector3(), q: new THREE.Quaternion(), l: 1, w: 1, age: 0, life: 1, grow: 0.09, vel: new THREE.Vector3(), grav: 0, flying: false, spin: new THREE.Vector3(), follow: null, off: new THREE.Vector3(), glow: 1, held: false });
  let cHead = 0; const m4 = new THREE.Matrix4(), sc = new THREE.Vector3(), qT = new THREE.Quaternion(), eul = new THREE.Euler();
  /** a crystal: p its base, dir where it points, len and width in metres. opts.fly throws it. Returns a handle the caller can place and kill. */
  function crystal(p, dir, len, width, life, opts = {}) {
    const c = crystals[cHead]; cHead = (cHead + 1) % CN;
    c.on = true; c.p.copy(p); c.q.setFromUnitVectors(Y, dir); c.l = len; c.w = width; c.age = 0; c.life = life; c.grow = opts.grow ?? 0.08; c.glow = 1; c.grav = opts.grav || 0; c.held = false; c.follow = opts.follow || null; if (c.follow) c.off.copy(p).sub(c.follow.pos);
    c.burst = inBurst; c.flying = !!opts.fly; c.vel.copy(dir).multiplyScalar(opts.fly || 0); c.spin.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
    return { place(np, nd) { c.p.copy(np); c.q.setFromUnitVectors(Y, nd); }, kill() { c.on = false; } };
  }
  function spike(p, dir, len, width, life) { crystal(p, dir, len, width, life + 0.34, { grow: 0.1 }); }
  function shatter(p, n, scale = 1) {
    v2.copy(p); v2.y += 0.8;
    for (let k = 0; k < n; k++) { v1.set(rnd(-1, 1), rnd(-0.5, 1.1), rnd(-1, 1)).normalize(); crystal(v2, v1, rnd(0.3, 0.9) * scale, rnd(0.09, 0.2) * scale, rnd(0.42, 0.8), { fly: rnd(6, 16), grav: 10, grow: 0.01 }); }
    sp('iceStar', v2, 5 * scale, 0.22, C.ice, { b: 1, s0: 2 * scale, rot: Math.random() * TAU, hot: 1, outF: 0.3 });
    sp('frost', v2, 3.4 * scale, 0.34, C.foam, { b: 1, s0: 1.2 * scale, add: 1, a: 0.7, hot: 0.7, rot: Math.random() * TAU });
    const s = sp('ring', v2, 0.3, 0.3, C.ice, { b: 1, s0: 1 * scale, s1: 5.4 * scale, hot: 0.9, outF: 0.12 }); v1.copy(G.camera.position).sub(v2).normalize(); planeAxes(s, v1);
    for (let k = 0; k < 10; k++) { const a = Math.random() * TAU, sp0 = rnd(3, 11); sp('flake', v2, rnd(0.08, 0.2), rnd(0.3, 0.7), C.foam, { vx: Math.cos(a) * sp0, vy: rnd(1, 9), vz: Math.sin(a) * sp0, drag: 2.6, grav: 4, spin: rnd(-7, 7), rot: Math.random() * TAU, hot: 1 }); }
  }
  // a frozen foe: crystals grown out of its body, the frost spreading, a cold light. All of it follows the foe and goes when it does
  const crusts = new Map();
  function crust(e) {
    const long = e.def.body !== 'reaver', H = long ? 1 : 1.9, L = long ? 3 : 1, n = long ? 10 : 12, list = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU * 2.3 + rnd(-0.3, 0.3), yy = rnd(-0.75, 0.95) * H * 0.5, R = rnd(0.28, 0.42), body = rnd(-1, 1) * L * 0.5;
      v2.set(Math.cos(a), rnd(-0.1, 0.75), Math.sin(a)).normalize();
      v1.copy(e.pos); v1.y += yy; v1.x += Math.cos(a) * R + Math.sin(e.heading) * body; v1.z += Math.sin(a) * R + Math.cos(e.heading) * body;
      crystal(v1, v2, rnd(0.55, 1.15) * (e.def.scale || 1), rnd(0.16, 0.3), 99, { follow: e, grow: 0.12 + k * 0.012 });
      list.push(cHead === 0 ? CN - 1 : cHead - 1);
    }
    crusts.set(e, list);
    frostBurst(v1.copy(e.pos), 1.5); G.look.flash(e.pos, 0xcfeeff, 7, 0.35);
  }
  function thaw(e) { const l = crusts.get(e); if (l) { for (const i of l) { const c = crystals[i]; if (c.follow === e) { c.follow = null; c.life = c.age + 0.2; } } crusts.delete(e); } }
  function plate(p, r, hold) {
    // an ice plate on the sea: a flat crystal, and the frost feathering out from it
    v1.set(rnd(-0.03, 0.03), 1, rnd(-0.03, 0.03)).normalize(); crystal(p, v1, 0.3, r * 0.75, hold, { grow: 0.12 });
    const f = sp('frost', p, r * 1.5, hold, C.ice, { b: 0, s0: r * 0.5, add: 0.8, hot: 0.65, a: 0.9, inF: 0.02, outF: 0.9 }); planeAxes(f, Y, Math.random() * TAU);
    for (let k = 0; k < 3; k++) { v2.set(p.x + rnd(-r, r), 0.1, p.z + rnd(-r, r)); sp('glint', v2, rnd(0.2, 0.4), 0.3, C.foam, { hot: 1, delay: rnd(0, 0.4), rot: Math.random() * TAU }); }
  }
  function stagger(e) { v1.copy(e.pos); v1.y += 1.5; const s = sp('ring', v1, 2.4, 0.4, C.gold, { b: 1, s0: 0.7, s1: 2.4, hot: 0.9, outF: 0.25 }); v2.copy(G.camera.position).sub(v1).normalize(); planeAxes(s, v2); }

  // ------------------------------------------------------------------ magic circles: a shader, so they stay crisp at any size
  const circleMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, toneMapped: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    uniforms: { uA: { value: 0 }, uT: { value: 0 }, uCol: { value: new THREE.Color() }, uN: { value: 6 } },
    vertexShader: `varying vec2 vU; void main() { vU = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA, uT, uN; uniform vec3 uCol; varying vec2 vU;
      float line(float d, float w) { return smoothstep(w, 0.0, abs(d)); }
      void main() { float r = length(vU), a = atan(vU.y, vU.x), aa = fwidth(r) * 1.4 + 0.003;
        float v = line(r - 0.96, aa + 0.012) + line(r - 0.88, aa + 0.003) * 0.7 + line(r - 0.44, aa + 0.005) * 0.8;
        float seg = fract(a * 30.0 / 6.2832 + uT * 0.5); v += step(abs(seg - 0.5), 0.09) * step(0.88, r) * step(r, 0.96) * 0.9;
        float k = 6.2832 / uN, b1 = mod(a + uT * 0.8, k) - k * 0.5, b2 = mod(a - uT * 0.55 + k * 0.5, k) - k * 0.5;
        v += line(cos(b1) * r - 0.62, aa + 0.005) * step(r, 0.88) + line(cos(b2) * r - 0.62, aa + 0.005) * step(r, 0.88) * 0.7;
        float rad = abs(fract(a * uN / 6.2832 - uT * 0.13) - 0.5); v += step(rad, 0.012 + aa * 0.5) * step(0.44, r) * step(r, 0.88) * 0.5;
        v *= smoothstep(1.0, 0.975, r); gl_FragColor = vec4(uCol * v * uA * 0.95, 1.0); }`,
  });
  const circles = []; const circleGeo = new THREE.PlaneGeometry(2, 2);
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(circleGeo, circleMat()); m.visible = false; m.frustumCulled = false; m.renderOrder = 15.4; scene.add(m); circles.push({ m, t: 0, dur: 1, r: 1, rise: 0 }); }
  function circle(p, normal, radius, el, dur) {
    const c = circles.find((x) => !x.m.visible) || circles[0]; c.t = 0; c.dur = dur; c.r = radius; c.m.visible = true; c.m.position.copy(p);
    c.m.material.uniforms.uCol.value.copy(el === 'ice' ? C.ice : C.water); c.m.material.uniforms.uN.value = el === 'ice' ? 6 : 5;
    if (normal) c.m.quaternion.setFromUnitVectors(ZF, normal); else c.m.rotation.set(-Math.PI / 2, 0, 0);
    v1.copy(p); const s = sp('ring', v1, radius * 1.05, Math.min(0.3, dur), el === 'ice' ? C.ice : C.water, { b: 0, s0: radius * 1.3, a: 0.9, hot: 0.8, outF: 0.4 }); if (normal) planeAxes(s, normal); else planeAxes(s, Y);
  }

  // ------------------------------------------------------------------ super speed: streaks that rush past the camera
  const NS = phone ? 90 : 170;
  const sPos = new Float32Array(NS * 6), sCol = new Float32Array(NS * 6), sSeed = new Float32Array(NS * 3);
  for (let i = 0; i < NS; i++) { const a = Math.random() * TAU, r = 1.8 + Math.random() * 13; sSeed[i * 3] = Math.cos(a) * r; sSeed[i * 3 + 1] = Math.sin(a) * r; sSeed[i * 3 + 2] = Math.random() * 60 - 30; for (let k = 0; k < 3; k++) { sCol[i * 6 + k] = 0.62 + 0.12 * k; sCol[i * 6 + 3 + k] = 0; } }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage)); sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const sMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const streaks = new THREE.LineSegments(sGeo, sMat); streaks.frustumCulled = false; streaks.visible = false; streaks.renderOrder = 16; scene.add(streaks);
  const velDir = new THREE.Vector3();
  function speed(surge, vel, dt) {
    const on = surge > 0.03;
    streaks.visible = on; if (!on) return;
    const spd = vel.length(), L = 1.6 + spd * 0.2; velDir.copy(vel).normalize();
    streaks.position.copy(G.camera.position); streaks.quaternion.setFromUnitVectors(ZF, velDir); sMat.opacity = Math.min(0.42, surge * 0.5);
    for (let i = 0; i < NS; i++) {
      let z = sSeed[i * 3 + 2] - spd * dt; if (z < -30) z += 60; sSeed[i * 3 + 2] = z;
      sPos[i * 6] = sPos[i * 6 + 3] = sSeed[i * 3]; sPos[i * 6 + 1] = sPos[i * 6 + 4] = sSeed[i * 3 + 1]; sPos[i * 6 + 2] = z; sPos[i * 6 + 5] = z - L;
    }
    sGeo.attributes.position.needsUpdate = true;
  }

  // ------------------------------------------------------------------ the screen punch: a kick along the blow and a shove in, gone in a few frames. The camera rebuilds itself
  // every frame, so this goes on after it and leaves nothing behind
  const punchV = new THREE.Vector3(), punchOut = new THREE.Vector3(); let punchF = 0;
  function punch(dir, amount) { punchV.copy(dir).multiplyScalar(amount * 0.5); punchF = amount; }
  // the last foe of a fight: the lens goes in on him and eases back
  const pushP = new THREE.Vector3(); let pushT = 0, pushS = 1;
  function pushIn(p, s) { if (G.settings && G.settings.shake === false) return; pushP.copy(p); pushP.y += 0.9; pushT = pushS = s; }
  function applyPunch(dt) {
    if (pushT > 0) { pushT = Math.max(0, pushT - dt); const cam = G.camera, q = Math.sin((1 - pushT / pushS) * Math.PI), ease = q * q * (3 - 2 * q); cam.position.lerp(pushP, ease * 0.34); cam.fov -= ease * 7; cam.updateProjectionMatrix(); stats.pushing = ease; } else stats.pushing = 0;
    if (punchF < 0.004) return; const cam = G.camera, k = Math.exp(-20 * dt);
    if (G.settings && G.settings.shake === false) { punchF = 0; punchV.set(0, 0, 0); return; }
    cam.getWorldDirection(punchOut); cam.position.addScaledVector(punchOut, punchF).add(punchV); punchF *= k; punchV.multiplyScalar(k);
  }

  // ------------------------------------------------------------------ one frame
  const R = new THREE.Vector3(), U = new THREE.Vector3();
  function writeSprites(dt) {
    const cam = G.camera; cam.updateMatrixWorld(); const e = cam.matrixWorld.elements; R.set(e[0], e[1], e[2]); U.set(e[4], e[5], e[6]);
    let n0 = 0, n1 = 0, live = 0;
    for (let i = 0; i < pool.length; i++) {
      const s = pool[i]; if (!s.on) continue; live += s.burst;
      if (s.delay > 0) { s.delay -= dt; continue; }
      s.age += dt; if (s.age >= s.life) { s.on = false; continue; }
      const f = Math.exp(-s.drag * dt); s.vx *= f; s.vy *= f; s.vz *= f; s.vy -= s.grav * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.sink && s.y > -0.04 && s.vy > 0 && s.grav < 0) { s.on = false; continue; }
      const q = s.age / s.life, ease = 1 - (1 - q) * (1 - q), size = s.s0 + (s.s1 - s.s0) * ease;
      s.rot += s.spin * dt;
      let al = s.a; if (s.inF > 0 && q < s.inF) al *= q / s.inF; if (q > s.outF) al *= 1 - (q - s.outF) / (1 - s.outF);
      const b = s.b ? over : inScene; if ((s.b ? n1 : n0) >= b.cap) continue;
      const o = (s.b ? n1++ : n0++) * FLOATS, d = b.data;
      let hx, hy, hz, ux, uy, uz;
      if (s.mode === 2) { hx = s.ax * size; hy = s.ay * size; hz = s.az * size; ux = s.bx * size; uy = s.by * size; uz = s.bz * size; }
      else if (s.mode === 1) {
        const vr = s.vx * R.x + s.vy * R.y + s.vz * R.z, vu = s.vx * U.x + s.vy * U.y + s.vz * U.z, l = Math.hypot(vr, vu) || 1, dx = vr / l, dy = vu / l, sl = size * (1 + l * s.stretch * 12), w = size;
        hx = (R.x * dx + U.x * dy) * sl; hy = (R.y * dx + U.y * dy) * sl; hz = (R.z * dx + U.z * dy) * sl; ux = (-R.x * dy + U.x * dx) * w; uy = (-R.y * dy + U.y * dx) * w; uz = (-R.z * dy + U.z * dx) * w;
      } else {
        const c = Math.cos(s.rot), n = Math.sin(s.rot), a = size * s.aspect;
        hx = (R.x * c + U.x * n) * a; hy = (R.y * c + U.y * n) * a; hz = (R.z * c + U.z * n) * a; ux = (-R.x * n + U.x * c) * size; uy = (-R.y * n + U.y * c) * size; uz = (-R.z * n + U.z * c) * size;
      }
      const uv = uvOf[s.cell];
      d[o] = s.x; d[o + 1] = s.y; d[o + 2] = s.z; d[o + 3] = hx; d[o + 4] = hy; d[o + 5] = hz; d[o + 6] = ux; d[o + 7] = uy; d[o + 8] = uz;
      d[o + 9] = uv[0]; d[o + 10] = uv[1]; d[o + 11] = uv[2]; d[o + 12] = uv[3]; d[o + 13] = s.r; d[o + 14] = s.g; d[o + 15] = s.b2; d[o + 16] = al; d[o + 17] = s.hot; d[o + 18] = s.add;
    }
    for (const [b, n] of [[inScene, n0], [over, n1]]) { b.n = n; b.g.instanceCount = n; b.mesh.visible = n > 0; if (n) { b.ib.clearUpdateRanges(); b.ib.addUpdateRange(0, n * FLOATS); b.ib.needsUpdate = true; } }
    stats.sprites = n0; stats.over = n1; stats.burstLive = live;
  }
  function writeCrystals(dt) {
    let n = 0; const ia = cAttr.array;
    for (let i = 0; i < CN; i++) {
      const c = crystals[i]; if (!c.on) continue;
      c.age += dt; if (c.age >= c.life) { c.on = false; continue; }
      if (c.flying) { c.vel.y -= c.grav * dt; c.p.addScaledVector(c.vel, dt); eul.set(c.spin.x * dt, c.spin.y * dt, c.spin.z * dt); qT.setFromEuler(eul); c.q.multiply(qT); }
      else if (c.follow) { c.p.copy(c.follow.pos).add(c.off); if (c.follow.hp <= 0 || !(c.follow.frozen > 0)) { c.follow = null; c.life = c.age + 0.22; } }
      const grow = clamp(c.age / Math.max(c.grow, 1e-3), 0, 1), left = c.life - c.age, shrink = clamp(left / 0.22, 0, 1), up = (1 - (1 - grow) * (1 - grow)) * (c.flying ? 1 : shrink), w = c.w * (0.55 + 0.45 * grow) * shrink;
      m4.compose(c.p, c.q, sc.set(w, c.l * up + 1e-3, w)); m4.toArray(cMesh.instanceMatrix.array, n * 16);
      ia[n * 2] = Math.max(0, 1 - c.age / 0.4); ia[n * 2 + 1] = c.flying ? clamp(left * 5, 0, 1) : 1; n++;
    }
    cMesh.count = n; cMesh.visible = n > 0; if (n) { cMesh.instanceMatrix.needsUpdate = true; cAttr.needsUpdate = true; }
    stats.crystals = n; { let b = 0; for (let i = 0; i < CN; i++) if (crystals[i].on && crystals[i].burst) b++; stats.burstLive += b; }
  }

  function update(dt, time) {
    shared.uT.value = time; applyPunch(dt);
    { const H = G.hero, P = G.combat && G.combat.powers; if (H && P && (H.state === 'cine' || H.dead)) P.quiet(); }        // the fixed step that runs the powers stops in a cinematic: the trident comes home to his hand for it
    fv = 0; fi = 0;
    trailMesh(); whipMesh(dt); ripMesh(dt); vortexMesh(dt); waveMesh(dt); geyserMesh();
    fMesh.visible = fi > 0;
    if (fi > 0) {
      fGeo.setDrawRange(0, fi);
      for (const k of ['position', 'normal', 'uv', 'aF']) { const a = fGeo.attributes[k]; a.clearUpdateRanges(); a.addUpdateRange(0, fv * a.itemSize); a.needsUpdate = true; }
      fGeo.index.clearUpdateRanges(); fGeo.index.addUpdateRange(0, fi); fGeo.index.needsUpdate = true;
    }
    stats.fluidVerts = fv;
    writeSprites(dt); writeCrystals(dt);
    let cn = 0;
    for (const c of circles) {
      if (!c.m.visible) continue; c.t += dt; const q = c.t / c.dur; if (q >= 1) { c.m.visible = false; continue; } cn++;
      const inn = clamp(q / 0.16, 0, 1), s = c.r * (0.55 + 0.45 * (1 - (1 - inn) * (1 - inn))); c.m.scale.set(s, s, s);
      const u = c.m.material.uniforms; u.uA.value = (q < 0.7 ? 1 : (1 - q) / 0.3) * inn; u.uT.value = time;
    }
    stats.circles = cn;
  }

  // nothing hidden is left to compile on the first blow: a shader built mid-fight is a 0.5 s hole in the frame
  // compile() reaches the shaders; one real frame with everything hidden shown reaches the rest (geometry uploads, first-use state), through the game's own render path, under the load screen
  const warmList = [inScene.mesh, over.mesh, fMesh, shMesh, cMesh, ...circles.map((c) => c.m)];
  function prewarm() {
    const r = G.renderer; r.initTexture(atlas); r.initTexture(noiseT);
    const was = warmList.map((o) => o.visible); warmList.forEach((o) => { o.visible = true; });
    G.look.render();
    warmList.forEach((o, i) => { o.visible = was[i]; });
  }

  return { update, speed, punch, prewarm, warmList, edge, song, rayLight, silt, spines, crown, sheet, pushIn, spoutSpray, noiseT, sunDir, chargeRing, sparks, bubbles, pushTrail, ring, spin, wave, shot, impact, parry, guard, block, dodge, perfect, stance, tell, glint, motes, denied, shock, dissolve, frost, frostBurst, whip, riptide, geyser, circle, crystal, spike, shatter, crust, thaw, plate, stagger, stats };
}
