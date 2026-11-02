// Birds to fly with. Randy, 2 Nov: "some peaceful birds etc that we can fly with and have beautiful views". Pipeline/research/LIFE_SOURCES.md
// Every wing has a shoulder, a wrist and a hand, bent in the vertex shader with no bones: on the upstroke the wrist folds and the hand sweeps back, the one thing a hinge can't do. Flap rates from Pennycuick's formula, each species on its own schedule, and the body heaves while the head stays still in the air.
// Banking comes from the turn, atan(v^2 / (r g)). Frigatebirds ring the volcano's plume, where the air rises, and lift him if he flies inside the ring. Cranes cross between the isles in a ragged V he can slot into. Tropicbirds, real volcano birds, fly over the crater lake.
// Birds are never targets: no damage, no lock-on, no collisions.
import * as THREE from 'three';
import { FIRE_HILL } from './fireisle.js';

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), K = 1.5, G0 = 9.81;
// span m, flap Hz (Pennycuick, drawn K times life size: f / sqrt K), colours, wing shape: wrist at, hand sweep, tail fork, neck, legs
const SPEC = {
  frigate: { span: 2.2, hz: 2.2, body: [0.04, 0.04, 0.05], wing: [0.03, 0.03, 0.04], tip: [0.02, 0.02, 0.025], wrist: 0.42, crook: 0.5, fork: 1, neck: 0.25, legs: 0, n: 8 },
  crane: { span: 2.1, hz: 3.0, body: [0.62, 0.64, 0.66], wing: [0.66, 0.68, 0.7], tip: [0.05, 0.05, 0.06], wrist: 0.48, crook: 0.08, fork: 0, neck: 0.75, legs: 0.6, n: 17 },
  tropic: { span: 0.95, hz: 4.7, body: [0.95, 0.95, 0.93], wing: [0.93, 0.93, 0.92], tip: [0.08, 0.08, 0.09], wrist: 0.45, crook: 0.15, fork: 0, neck: 0.2, legs: 0, streamer: 1, n: 6 },
};

// a bird drawn as a few strips: body, two wings of span stations and chord, a tail, a neck. aW: span 0-1, side, chord, part (0 body, 1 wing, 2 tail, 3 neck, 4 legs)
function birdGeo(S) {
  const P = [], W = [], C = [], I = []; const add = (x, y, z, s, side, ch, part, c) => { P.push(x, y, z); W.push(s, side, ch, part); C.push(...c); return P.length / 3 - 1; };
  const quad = (a, b, c, d) => I.push(a, b, c, a, c, d);
  // body: a spindle
  // in proportion to the span: a crane's body is about half its span, its wing at the root a fifth
  const L = 0.46 * S.span, R = 0.055 * S.span, ring = 5, cw = 0.2 * S.span;
  for (let j = 0; j <= 4; j++) { const t = j / 4, z = (t - 0.5) * L, r = R * Math.sin(Math.PI * (0.12 + t * 0.76)); for (let k = 0; k < ring; k++) { const a = (k / ring) * TAU; add(Math.cos(a) * r, Math.sin(a) * r * 0.8, z, 0, 0, 0, 0, S.body); } }
  for (let j = 0; j < 4; j++) for (let k = 0; k < ring; k++) { const a = j * ring + k, b = j * ring + ((k + 1) % ring); quad(a, b, b + ring, a + ring); }
  // wings: 6 stations out to the tip, chord narrowing, the hand's last third dark-tipped
  for (const side of [-1, 1]) {
    const base = P.length / 3;
    for (let j = 0; j <= 6; j++) { const s = j / 6, ch = cw * (1 - 0.6 * s * s) * (1 - 0.3 * S.crook * s), c = s > 0.78 ? S.tip : S.wing; add(0, 0, 0.05, s, side, ch * 0.45, 1, c); add(0, 0, 0.05, s, side, -ch * 0.55, 1, c); }
    for (let j = 0; j < 6; j++) { const a = base + j * 2; quad(a, a + 1, a + 3, a + 2); }
  }
  // tail: a fan, forked for a frigatebird; streamers on a tropicbird
  { const b = P.length / 3, len = (S.streamer ? 0.55 : 0.16 + 0.12 * S.fork) * S.span; add(0, 0, -L * 0.45, 0, 0, 0, 2, S.body); add(-0.06, 0, -L * 0.45 - len, 0, -1, 0, 2, S.fork ? S.tip : S.body); add(0, 0, -L * 0.45 - len * (S.fork ? 0.45 : 1.05), 0, 0, 0, 2, S.body); add(0.06, 0, -L * 0.45 - len, 0, 1, 0, 2, S.fork ? S.tip : S.body); I.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  // neck and head: straight out ahead for a crane, short for the rest; legs trailing past the tail on a crane
  { const b = P.length / 3, nl = (0.06 + S.neck * 0.25) * S.span; add(-0.025, 0.02, L * 0.45, 0, 0, 0, 3, S.body); add(0.025, 0.02, L * 0.45, 0, 0, 0, 3, S.body); add(0.012, 0.03, L * 0.45 + nl, 0, 0, 0, 3, S.body); add(-0.012, 0.03, L * 0.45 + nl, 0, 0, 0, 3, S.body); quad(b, b + 1, b + 2, b + 3); const t = P.length / 3; add(0, 0.03, L * 0.45 + nl + 0.05 * S.span, 0, 0, 0, 3, S.neck > 0.5 ? [0.2, 0.18, 0.15] : [0.9, 0.6, 0.15]); I.push(b + 3, b + 2, t); }
  if (S.legs) { const b = P.length / 3; add(-0.02, -0.03, -L * 0.3, 0, 0, 0, 4, [0.1, 0.1, 0.1]); add(0.02, -0.03, -L * 0.3, 0, 0, 0, 4, [0.1, 0.1, 0.1]); add(0.015, -0.04, -L * 0.3 - S.legs * 0.45 * S.span, 0, 0, 0, 4, [0.1, 0.1, 0.1]); add(-0.015, -0.04, -L * 0.3 - S.legs * 0.45 * S.span, 0, 0, 0, 4, [0.1, 0.1, 0.1]); quad(b, b + 1, b + 2, b + 3); }
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aW', new THREE.Float32BufferAttribute(W, 4)); g.setAttribute('aC', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); return g;
}

const VS = /* glsl */`
  attribute vec4 aW; attribute vec3 aC; attribute vec4 iP, iQ, iA;
  uniform float uSpan, uWrist, uCrook; varying vec3 vC; varying float vFog;
  // iP: position, scale · iQ: yaw, pitch, bank, phase · iA: flap amount, fold, glide dihedral, tail spread
  void main() {
    vec3 p = position; float ph = iQ.w, amp = iA.x, up = cos(ph);
    if (aW.w == 1.0) {
      // the shoulder: 45 up at the top of the stroke, 25 down at the bottom, a shallow dihedral in a glide
      float sh = mix(iA.z, mix(-.44, .79, .5 + .5*sin(ph)), amp);
      // the hand: on the upstroke the wrist folds and the hand sweeps back and trails, the span to about 60%; on the downstroke the tip bends up under load
      float fold = max(up, 0.0)*amp*(.6 + .4*iA.y) + iA.y*.35, s = aW.x, w = uWrist, si = min(s, w), so = max(s - w, 0.0);
      float ha = sh + mix(-.2*amp*max(-up, 0.0), -.55*fold, step(0.0, up)) + uCrook*.6*(1.0 - amp), sweep = fold*1.05 + uCrook*.35;
      vec3 q = vec3(aW.y*si*cos(sh), si*sin(sh), 0.0);
      q += vec3(aW.y*so*cos(ha)*cos(sweep), so*sin(ha), -so*sin(sweep));
      p = q*uSpan*.5 + vec3(0.0, 0.0, p.z + aW.z*(1.0 - .4*so/(1.0 - w + .001)));
    }
    if (aW.w == 2.0) p.x *= 1.0 + iA.w;
    // the head holds still in the air; the body heaves under it
    float heave = (aW.w == 3.0 ? 0.0 : -.025)*sin(ph)*amp;
    p.y += heave;
    p *= iP.w;
    float cy = cos(iQ.x), sy = sin(iQ.x), cp = cos(iQ.y), sp = sin(iQ.y), cb = cos(iQ.z), sb = sin(iQ.z);
    p = vec3(p.x*cb - p.y*sb, p.x*sb + p.y*cb, p.z);
    p = vec3(p.x, p.y*cp + p.z*sp, -p.y*sp + p.z*cp);
    p = vec3(p.x*cy + p.z*sy, p.y, -p.x*sy + p.z*cy);
    vec4 w = vec4(p + iP.xyz, 1.0), mv = viewMatrix*w;
    vC = aC; vFog = 1.0 - exp(-length(mv.xyz)*.0016);
    gl_Position = projectionMatrix*mv;
  }`;
const FS = /* glsl */`uniform vec3 uFogC, uSun; varying vec3 vC; varying float vFog; void main() { gl_FragColor = vec4(mix(vC*uSun, uFogC, vFog*.85), 1.0); }`;

export function createBirds(G) {
  const U = G.look.uniforms, flocks = {}, sun = { value: new THREE.Color(1, 1, 1) }, fogC = { value: new THREE.Color(0.7, 0.75, 0.8) };
  for (const k in SPEC) {
    const S = SPEC[k], g = birdGeo(S), n = S.n, iP = new Float32Array(n * 4), iQ = new Float32Array(n * 4), iA = new Float32Array(n * 4);
    for (const [name, a] of [['iP', iP], ['iQ', iQ], ['iA', iA]]) g.setAttribute(name, new THREE.InstancedBufferAttribute(a, 4).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = n; const m = new THREE.ShaderMaterial({ uniforms: { uSpan: { value: S.span }, uWrist: { value: S.wrist }, uCrook: { value: S.crook }, uFogC: fogC, uSun: sun }, vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.visible = false; mesh.name = 'birds_' + k; G.scene.add(mesh);
    const birds = []; for (let i = 0; i < n; i++) birds.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), yaw: 0, pitch: 0, bank: 0, ph: Math.random() * TAU, amp: 0, beat: 0, fold: 0, hz: (S.hz / Math.sqrt(K)) * (0.92 + Math.random() * 0.16), scale: K * (0.9 + Math.random() * 0.2), r: 40 + Math.random() * 70, a: Math.random() * TAU, y: 90 + Math.random() * 150, seed: Math.random() * 100 });
    flocks[k] = { S, mesh, g, iP, iQ, iA, birds };
  }
  const plume = new THREE.Vector3(FIRE_HILL.x, 0, -FIRE_HILL.y), crater = new THREE.Vector3(FIRE_HILL.x, G.world.heightAt(FIRE_HILL.x, FIRE_HILL.y) + 14, -FIRE_HILL.y);
  // the cranes' route: a loop over the sea between the Burnt Isle and the islands, 120-150 m up
  const route = [[plume.x - 260, 135, plume.z + 120], [plume.x - 520, 140, plume.z + 520], [plume.x - 820, 130, plume.z + 880], [plume.x - 380, 150, plume.z + 980], [plume.x + 60, 135, plume.z + 520], [plume.x + 160, 140, plume.z + 240]].map((a) => new THREE.Vector3(...a));
  const V = { at: 0, p: route[0].clone(), dir: new THREE.Vector3(1, 0, 0), speed: 15, leader: 0, swapT: 40 };
  let t = 0, company = null; const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

  // a flap schedule: a frigatebird hardly beats at all; a crane in a V beats steadily; a tropicbird quick and steady
  function schedule(b, k, dt, climbing) {
    if (k === 'frigate') { if ((b.beat -= dt) <= 0) { const flap = Math.random() < (climbing ? 0.35 : 0.12); b.beat = flap ? 1.4 + Math.random() : 3 + Math.random() * 6; b.target = flap ? 1 : 0; } }
    else b.target = k === 'crane' ? 0.85 : 0.95;
    b.amp += ((b.target ?? 0) - b.amp) * (1 - Math.exp(-dt * 4)); b.ph += TAU * b.hz * dt * (0.4 + 0.6 * b.amp);
  }
  // facing and bank from the velocity and how hard it's turning: bank = atan(v^2 / (r g)), rolled in faster than out
  function aim(b, dt, prevYaw) {
    const sp = Math.hypot(b.v.x, b.v.z) || 1, yaw = Math.atan2(b.v.x, b.v.z), dy = Math.atan2(Math.sin(yaw - prevYaw), Math.cos(yaw - prevYaw)) / Math.max(dt, 1e-3), want = clamp(Math.atan((sp * dy) / G0), -1.15, 1.15);
    b.bank += (want - b.bank) * (1 - Math.exp(-dt * (Math.abs(want) > Math.abs(b.bank) ? 6 : 0.6))); b.yaw = yaw; b.pitch = Math.atan2(b.v.y, sp) * 0.7;
  }

  function step(dt, cam) {
    t += dt; const h = G.hero, fire = G.sideNow === 'fire', near = (p, R) => (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2 < R * R;
    // the sun's colour and the haze are vectors in the shared uniforms, not colours
    { const s = U.ocSunCol && U.ocSunCol.value, f = U.ocHaze && U.ocHaze.value; if (s) sun.value.setRGB((s.x ?? s.r) * 0.55 + 0.18, (s.y ?? s.g) * 0.55 + 0.18, (s.z ?? s.b) * 0.55 + 0.18); if (f) fogC.value.setRGB(f.x ?? f.r, f.y ?? f.g, f.z ?? f.b); }
    // frigatebirds: circles round the plume that drift and breathe, never a perfect ring
    { const F = flocks.frigate; F.mesh.visible = near(plume, 900);
      if (F.mesh.visible) for (const b of F.birds) { const py = b.yaw, R = b.r * (1 + 0.2 * Math.sin(t * 0.07 + b.seed)), w = 8.5 / R; b.a += w * dt; const cx = plume.x + Math.sin(t * 0.02 + b.seed) * 30, cz = plume.z + Math.cos(t * 0.017 + b.seed) * 30, y = b.y + Math.sin(t * 0.05 + b.seed) * 20; const nx = cx + Math.cos(b.a) * R, nz = cz + Math.sin(b.a) * R; b.v.set((nx - b.p.x) / Math.max(dt, 1e-3), (y - b.p.y) / Math.max(dt, 1e-3), (nz - b.p.z) / Math.max(dt, 1e-3)); if (b.p.lengthSq() === 0) b.v.set(-Math.sin(b.a) * 8.5, 0, Math.cos(b.a) * 8.5); b.p.set(nx, y, nz); schedule(b, 'frigate', dt, false); aim(b, dt, py); b.fold = 0.1; } }
    // tropicbirds over the lava lake, quick and low, lit red from below
    { const F = flocks.tropic; F.mesh.visible = near(crater, 420);
      if (F.mesh.visible) for (const b of F.birds) { const py = b.yaw, R = 12 + (b.seed % 1) * 14, w = 9 / R; b.a += w * dt * (b.seed % 2 > 1 ? 1 : -1); const nx = crater.x + Math.cos(b.a) * R, nz = crater.z + Math.sin(b.a) * R, y = crater.y + 6 + Math.sin(t * 0.4 + b.seed) * 5; b.v.set((nx - b.p.x) / Math.max(dt, 1e-3), (y - b.p.y) / Math.max(dt, 1e-3), (nz - b.p.z) / Math.max(dt, 1e-3)); b.p.set(nx, y, nz); schedule(b, 'tropic', dt); aim(b, dt, py); } }
    // the cranes: a ragged V on its route. Slots 0.8 span back and 0.89 span out per rank, one arm longer, the line rippling; each beats a little after the one ahead, so its wingtip follows the same air
    { const F = flocks.crane, S = F.S, span = S.span * K;
      const to = route[(V.at + 1) % route.length]; v1.subVectors(to, V.p); const l = v1.length(); if (l < 30) V.at = (V.at + 1) % route.length; v1.normalize(); V.dir.lerp(v1, 1 - Math.exp(-dt * 0.25)).normalize(); V.p.addScaledVector(V.dir, V.speed * dt);
      if ((V.swapT -= dt) <= 0) { V.swapT = 30 + Math.random() * 30; V.leader = (V.leader + 1 + Math.floor(Math.random() * 4)) % F.birds.length; }
      F.mesh.visible = near(V.p, 1100);
      const right = v2.set(-V.dir.z, 0, V.dir.x);
      F.birds.forEach((b, i) => {
        const k = (i - V.leader + F.birds.length) % F.birds.length, rank = Math.ceil(k / 2), side = k % 2 ? 1 : -1, arm = side > 0 ? 1 : 1.5, back = 0.8 * span * rank * arm, out = 0.89 * span * rank * side + Math.sin(t * 0.5 + i) * 0.1 * span, py = b.yaw;
        const target = new THREE.Vector3().copy(V.p).addScaledVector(V.dir, -back).addScaledVector(right, out); target.y += Math.sin(t * 0.3 + rank * 0.7) * 1.2;
        if (b.p.lengthSq() === 0) b.p.copy(target); v1.subVectors(target, b.p); b.v.copy(V.dir).multiplyScalar(V.speed).addScaledVector(v1, 1.2); b.p.addScaledVector(b.v, dt); b.ph = b.ph; schedule(b, 'crane', dt); b.ph -= TAU * b.hz * dt * 0; b.lag = rank * 2.2; aim(b, dt, py);
      });
      // he slots into the V: near a slot, at a speed near theirs and heading their way, he's taken in, and they set the pace
      const hp = h.pos, inFly = h.fly && !h.skim && fire; company = null;
      if (inFly && hp.distanceTo(V.p) < 90) { const sp = h.vel.length(), dot = h.vel.dot(V.dir) / (sp || 1); if (dot > 0.7) { const rank = 1 + Math.floor(F.birds.length / 2), slot = v1.copy(V.p).addScaledVector(V.dir, -0.8 * span * rank * 1.5).addScaledVector(right, -0.89 * span * rank); if (hp.distanceTo(slot) < 9) company = { speed: V.speed * 1.08, at: slot.clone(), n: F.birds.length }; } }
    }
    // write the instances
    for (const k in flocks) { const F = flocks[k]; if (!F.mesh.visible) continue; F.birds.forEach((b, i) => { const o = i * 4; F.iP[o] = b.p.x; F.iP[o + 1] = b.p.y; F.iP[o + 2] = b.p.z; F.iP[o + 3] = b.scale; F.iQ[o] = b.yaw; F.iQ[o + 1] = -b.pitch; F.iQ[o + 2] = -b.bank; F.iQ[o + 3] = b.ph - (b.lag || 0); F.iA[o] = b.amp; F.iA[o + 1] = b.fold; F.iA[o + 2] = 0.08 + 0.1 * (k === 'frigate' ? -1 : 1); F.iA[o + 3] = Math.abs(b.bank) * 0.6; }); for (const a of ['iP', 'iQ', 'iA']) F.g.attributes[a].needsUpdate = true; }
  }
  // the air rising round the plume: inside the frigatebirds' ring he climbs for free, up to 260 m, the birds show where
  function lift(p) { const d = Math.hypot(p.x - plume.x, p.z - plume.z); return d < 120 && p.y < 260 ? 3 * (1 - d / 120) * (1 - Math.max(0, p.y - 200) / 60) : 0; }
  function scatter(p, r) { for (const b of flocks.frigate.birds) if (b.p.distanceTo(p) < r) b.r += 40; }
  return { step, lift, scatter, get company() { return company; }, flocks };
}
