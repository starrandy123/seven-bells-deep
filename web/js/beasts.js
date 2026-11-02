// Fire animals. Randy, 2 Nov: "We need fire type animals too that the fire elementals can fight just like the water bosses". Pipeline/research/LIFE_SOURCES.md
// The first is the Scoria Monitor, a monitor lizard drawn half again life size: with its glow off, a biologist would name it. Built in the order a shipped game's creature talk gives: moving boxes, legs, weight, detail.
// The spine is a chain of 16 joints that follow the head, each bend held to 22.5°, kept in a float texture a row an animal, and one straight body bent along it in the vertex shader. Walking it holds a standing S, still at the shoulders and hips; at a charge the wave travels.
// Four two-bone legs step in diagonal pairs, never both at once; a planted foot holds its place in the world for its whole stance, and distance drives the stride, never a clock.
// Body heat is the fight's shared rule: fire stokes it until it pants open-mouthed with its throat bare, water chills it until its plates split and it slows. Both are real reptile behaviour.
import * as THREE from 'three';
import { chan } from './fireisle.js';

const J = 16, TAU = Math.PI * 2, LIMB = 22.5 * Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
// a 4.5 m monitor: head and trunk 2.2 m, tail 2.3 m. Stations along it: s from snout 0 to tail tip 1, half width, half height
const BODY = [[0, 0.02, 0.02], [0.03, 0.09, 0.07], [0.07, 0.13, 0.1], [0.1, 0.13, 0.11], [0.14, 0.15, 0.13], [0.2, 0.25, 0.19], [0.27, 0.32, 0.22], [0.35, 0.34, 0.23], [0.43, 0.31, 0.22], [0.49, 0.25, 0.19], [0.56, 0.19, 0.16], [0.65, 0.14, 0.13], [0.75, 0.1, 0.09], [0.86, 0.06, 0.06], [0.95, 0.03, 0.03], [1, 0.01, 0.01]];

// a 2.2 m newt, read off fire and giant salamanders: a flat head as wide as the trunk with the gland bumps behind the eyes, a round trunk, a tail flattened side to side for swimming
const NEWT = [[0, 0.03, 0.012], [0.03, 0.1, 0.04], [0.07, 0.135, 0.055], [0.11, 0.15, 0.062], [0.145, 0.12, 0.06], [0.2, 0.125, 0.075], [0.3, 0.14, 0.085], [0.4, 0.14, 0.085], [0.5, 0.125, 0.08], [0.56, 0.095, 0.08], [0.66, 0.06, 0.08], [0.76, 0.045, 0.07], [0.86, 0.032, 0.055], [0.94, 0.018, 0.035], [1, 0.005, 0.01]];

// the newt's skin: glossy black, and its glands where a real fire salamander carries them, the pair of big bumps behind the eyes and two broken rows down the back, in a hot yellow-orange. They brighten head to tail as it readies a lob, and go dark when they're spent
const NEWT_LOOK = (J, L) => ({ key: 'newt', skinned: true,
  vertexDecl: 'attribute vec4 aS;\nuniform sampler2D uPath; uniform float uRow, uJaw;\nvarying vec4 vS;\n',
  vertexBend: /* glsl */`{
    vS = aS; float f = aS.x*${(J - 1).toFixed(1)}; int i = int(floor(f)), j = min(i + 1, ${J - 1}); int r = int(uRow + .5);
    vec3 a = texelFetch(uPath, ivec2(i, r), 0).xyz, b = texelFetch(uPath, ivec2(j, r), 0).xyz, c = mix(a, b, fract(f));
    vec3 T = normalize(a - b + vec3(0.0, 0.0, 1e-4)), R = normalize(cross(vec3(0.0, 1.0, 0.0), T)), Up = cross(T, R);
    vec3 q = position; if (aS.x < .1 && aS.z < 0.0) q.y -= uJaw*(.1 - aS.x)*${(L * 3).toFixed(2)};
    transformed = c + R*q.x + Up*q.y; objectNormal = normalize(R*normal.x + Up*normal.y + T*normal.z); }`,
  fragmentPars: /* glsl */`varying vec4 vS; uniform float uHeat, uBeat, uLob, uSpent;
    float gland(vec4 S) { float s = S.x, side = S.y, up = S.z; vec2 cp = vec2(S.w*12.0, s*34.0), id = floor(cp); float r = fract(sin(dot(id, vec2(12.9, 78.2)))*43758.5), r2 = fract(r*7.13);
      float blot = smoothstep(.36, .22, length(fract(cp) - .5 + (vec2(r, r2) - .5)*.35))*step(.42, r), dorsal = smoothstep(-.15, .35, up);
      float par = smoothstep(.035, .0, abs(s - .115) - .02)*smoothstep(.25, .55, abs(side))*smoothstep(-.1, .3, up), row = smoothstep(.15, .2, s)*smoothstep(.8, .7, s)*dorsal;
      return max(par, blot*row); }\n`,
  albedo: /* glsl */`{ float g = gland(vS); diffuseColor.rgb = mix(vec3(.006, .006, .007), vec3(.55, .2, .005), g*(1.0 - .8*uSpent)); }`,
  glow: /* glsl */`{ float g = gland(vS), lob = uLob > 0.0 ? smoothstep(vS.x - .06, vS.x, .06 + uLob*.62)*2.6 : 0.0; ocGlow = vec3(1.0, .42, .04)*g*(.45 + 1.1*uHeat*uHeat*(.6 + .4*uBeat) + lob)*(1.0 - .92*uSpent)*(1.0 - .55*smoothstep(.2, .13, vS.x)); }`,
});

function bodyGeo(L, TAB = BODY, wk = 0.42, hk = 0.48) {
  const P = [], S = [], I = [], ring = 10, BODY = TAB;
  // the table's widths and heights are full sizes as a share of the length: a monitor 3 m long is about 0.4 m across the trunk
  for (let i = 0; i < BODY.length; i++) { const s = BODY[i][0], w = BODY[i][1] * wk, h = BODY[i][2] * hk; for (let k = 0; k < ring; k++) { const a = (k / ring) * TAU, y = Math.sin(a), x = Math.cos(a); P.push(x * w * L * 0.5, (y < 0 ? y * 0.75 : y) * h * L * 0.5 + h * L * 0.08, 0); S.push(s, x, y, k / ring); } }
  for (let i = 0; i < BODY.length - 1; i++) for (let k = 0; k < ring; k++) { const a = i * ring + k, b = i * ring + ((k + 1) % ring); I.push(a, a + ring, b, b, a + ring, b + ring); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 4)); g.setIndex(I); g.computeVertexNormals(); return g;
}

export function createBeasts(G, { foeMaterial, D, kind = 'monitor' }) {
  const NW = kind === 'newt', MAXB = 4, FOE = D.foes[kind], K = NW ? FOE.length_m / 3 : FOE.scale_k || 1.5, L = NW ? FOE.length_m : 3 * K, hip = NW ? 0.13 : 0.4 * K, upper = NW ? 0.15 : 0.3 * K, lower = NW ? 0.15 : 0.32 * K, stride = 0.24 * L, OUT = NW ? 0.26 : 0.55 * K;
  const tex = new Float32Array(J * MAXB * 4), path = new THREE.DataTexture(tex, J, MAXB, THREE.RGBAFormat, THREE.FloatType); path.minFilter = path.magFilter = THREE.NearestFilter; path.needsUpdate = true;
  const geo = NW ? bodyGeo(L, NEWT, 1.3, 1.15) : bodyGeo(L);
  // basalt-black beaded plates, the glow only in the gaps between them; the cracks pulse at its heart rate, so its heat reads across a fight
  const base = new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: NW ? 0.5 : 0.78, metalness: 0, envMapIntensity: NW ? 0.35 : 1 });
  G.look.patch(base, NW ? NEWT_LOOK(J, L) : { key: 'monitor', skinned: true,
    vertexDecl: 'attribute vec4 aS;\nuniform sampler2D uPath; uniform float uRow, uJaw;\nvarying vec4 vS;\n',
    vertexBend: /* glsl */`{
      vS = aS; float f = aS.x*${(J - 1).toFixed(1)}; int i = int(floor(f)), j = min(i + 1, ${J - 1}); int r = int(uRow + .5);
      vec3 a = texelFetch(uPath, ivec2(i, r), 0).xyz, b = texelFetch(uPath, ivec2(j, r), 0).xyz, c = mix(a, b, fract(f));
      vec3 T = normalize(a - b + vec3(0.0, 0.0, 1e-4)), R = normalize(cross(vec3(0.0, 1.0, 0.0), T)), Up = cross(T, R);
      vec3 q = position; if (aS.x < .1 && aS.z < 0.0) q.y -= uJaw*(.1 - aS.x)*${(L * 3).toFixed(2)};
      transformed = c + R*q.x + Up*q.y; objectNormal = normalize(R*normal.x + Up*normal.y + T*normal.z); }`,
    fragmentPars: 'varying vec4 vS; uniform float uHeat, uBeat;\n',
    albedo: /* glsl */`{ vec2 cp = vec2(vS.w*26.0, vS.x*90.0); vec2 id = floor(cp), f = fract(cp) - .5; float bead = length(f*vec2(1.0, 1.2)), gap = smoothstep(.36, .5, bead);
      diffuseColor.rgb = mix(vec3(.013, .011, .010), vec3(.03, .024, .02), fract(sin(dot(id, vec2(12.9, 78.2)))*43758.5))*(1.0 - .5*gap)*(vS.z < -.2 ? .7 : 1.0); }`,
    glow: /* glsl */`{ vec2 cp = vec2(vS.w*26.0, vS.x*90.0); float gap = smoothstep(.36, .5, length((fract(cp) - .5)*vec2(1.0, 1.2))); ocGlow = vec3(1.0, .3, .06)*gap*uHeat*uHeat*(.55 + .45*uBeat)*.9 + vec3(.9, .25, .05)*step(vS.x, .03)*uBeat*.5*step(.75, uHeat); }`,
  });
  // the legs: tapered capsules, one draw for every monitor's
  const cap = new THREE.CapsuleGeometry(NW ? 0.045 : 0.07 * K, 1, 3, 6); cap.translate(0, 0.5, 0);
  const legMat = new THREE.MeshStandardMaterial({ color: NW ? 0x0c0b0b : 0x15120f, roughness: NW ? 0.4 : 0.85 }); G.look.patch(legMat, { key: NW ? 'newtLeg' : 'monitorLeg' });
  const legs = new THREE.InstancedMesh(cap, legMat, MAXB * 8); legs.count = 0; legs.frustumCulled = false; G.scene.add(legs);
  const pool = []; for (let i = 0; i < MAXB; i++) { const g = new THREE.Group(), mat = foeMaterial(base, { uPath: { value: path }, uRow: { value: i }, uJaw: { value: 0 }, uHeat: { value: 0.55 }, uBeat: { value: 0 }, uLob: { value: 0 }, uSpent: { value: 0 } }), m = new THREE.Mesh(geo, mat); m.frustumCulled = false; g.add(m); g.visible = false; G.scene.add(g); pool.push({ g, mat, busy: false, row: i, mixer: null, acts: {} }); }

  let X = null; const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3();
  const groundAt = (x, z) => G.world.heightAt(x, -z);

  function born(e) {
    const s = e.slot; e.heat = 0.55; e.beat = 0; e.spent = 0; e.lobs = 0; e.crustT = 0; e.heardT = 0; e.inLava = NW && chanAt(e.pos.x, e.pos.z) < 0.55; s.mat.U.uSpent.value = 0; s.mat.U.uLob.value = 0; e.gape = 0; e.jaw = 0; e.gait = 0; e.chain = []; e.feet = []; e.swing = [0, 0, 0, 0]; e.step = 0; e.sweep = 0; e.fishy = false; e.onLand = true;
    for (let i = 0; i < J; i++) e.chain.push(new THREE.Vector3(e.pos.x - Math.sin(e.heading) * (i * L) / (J - 1), 0, e.pos.z - Math.cos(e.heading) * (i * L) / (J - 1)));
    for (let k = 0; k < 4; k++) e.feet.push({ p: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1 });
    s.mat.U.uHeat.value = 0.55; placeFeet(e, true);
    // heat: fire stokes it, water and ice chill it. A gaping throat and a cold body take more; its back is armour
    const take = e.onHit;
    e.onHit = (dmg, from, type, info = {}) => {
      const el = info.element || (G.sideNow === 'fire' ? 'fire' : 'water'); e.heat = clamp(e.heat + (el === 'fire' ? 0.12 : el === 'ice' ? -0.35 : -0.25), 0, 1);
      // a newt: fire fills its glands until they burst and go dark, its skin soft; water sets a wet crust on it that slows it
      if (NW) { if (el === 'fire' && e.heat >= 0.85 && !(e.spent > 0)) { e.spent = e.def.spent_s; e.heat = 0.5; e.lobs = 0; G.combat.teach('newt_spent', 'Glands spent', 'Its skin is soft: strike now'); G.fireKit && G.fireKit.burst(v1.copy(e.pos), 0.8, null); G.combat.log.push({ t: G.time, type: 'newt_spent', foe: e.kind }); } if (el !== 'fire') e.crustT = 4; return take(dmg * (e.spent > 0 ? 2 : 1), from, type, info); }
      v1.subVectors(from, e.pos).setY(0).normalize(); const front = v1.x * Math.sin(e.heading) + v1.z * Math.cos(e.heading), throat = front > 0.5 && (e.gape > 0 || e.stagger > 0);
      const mul = throat ? 2 : e.heat <= 0.25 ? 0.8 : front < -0.3 ? 0.35 : 1; return take(dmg * mul, from, type, info);
    };
  }
  // where each foot belongs: beside the shoulder (joint 3) or the hip (joint 7), out and a little forward
  const SH = NW ? [3, 3, 8, 8] : [3, 3, 7, 7], SIDE = [-1, 1, -1, 1];
  function home(e, k, out) { const jn = e.chain[SH[k]], nx = e.chain[SH[k] - 1], tx = jn.x - nx.x, tz = jn.z - nx.z, l = Math.hypot(tx, tz) || 1, rx = -tz / l, rz = tx / l; out.set(jn.x + rx * SIDE[k] * OUT - (tx / l) * 0.25 * K, 0, jn.z + rz * SIDE[k] * OUT - (tz / l) * 0.25 * K); out.y = floorOf(e, out.x, out.z); return out; }
  // what it stands on: the ground, or in a channel the lava's top, which stands proud of its bed
  const lavaY = (x, z) => Math.max(groundAt(x, z), groundAt(x + 3, z), groundAt(x - 3, z), groundAt(x, z + 3), groundAt(x, z - 3)) + 0.9;
  const floorOf = (e, x, z) => (e.inLava ? lavaY(x, z) - 0.25 : groundAt(x, z));
  function placeFeet(e, now) { for (let k = 0; k < 4; k++) { home(e, k, e.feet[k].p); e.feet[k].to.copy(e.feet[k].p); e.feet[k].t = 1; } }

  // the chain: the head goes where the body's heading and position say, and each joint follows the one ahead at its length, its bend held to 22.5°, with the walking wave laid across it
  function spine(e, dt) {
    const sp = Math.hypot(e.vel.x, e.vel.z), seg = L / (J - 1), hx = Math.sin(e.heading), hz = Math.cos(e.heading), S = e.chain;
    const swim = NW && e.inLava; e.gait += swim ? 0.85 * dt : (sp * dt) / (stride * 2); const travel = swim ? 1 : clamp((sp / L - 1.5) / 1.5, 0, 1), amp = swim ? 0.09 * L : clamp(sp / 4, 0.15, 1) * 0.14 * K;
    S[0].set(e.pos.x + hx * L * 0.28, 0, e.pos.z + hz * L * 0.28);
    for (let i = 1; i < J; i++) {
      const a = S[i - 1], b = S[i], pa = i > 1 ? S[i - 2] : v3.set(a.x + hx, 0, a.z + hz); let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      // the bend held to its limit against the line of the two ahead
      const fx = a.x - pa.x, fz = a.z - pa.z, fl = Math.hypot(fx, fz) || 1, ux = fx / fl, uz = fz / fl, cr = ux * dz - uz * dx, dt2 = ux * dx + uz * dz, ang = Math.atan2(cr, dt2);
      if (Math.abs(ang) > LIMB) { const lim = Math.sign(ang) * LIMB, c = Math.cos(lim), s = Math.sin(lim); dx = ux * c - uz * s; dz = ux * s + uz * c; }
      b.set(a.x + dx * seg, 0, a.z + dz * seg);
    }
    // the wave: a standing S at a walk, nodes at the shoulders and the hips; at speed it travels toward the tail
    for (let i = 0; i < J; i++) {
      const s = i / (J - 1), w = Math.sin(TAU * e.gait) * Math.sin(Math.PI * 2 * (s - 0.18)) * (1 - travel) + Math.sin(TAU * (e.gait - s * 1.2)) * travel, n = i ? i - 1 : 0, tx = S[i].x - S[n + (i ? 0 : 1)].x, tz = S[i].z - S[n + (i ? 0 : 1)].z, tl = Math.hypot(tx, tz) || 1;
      const g = swim ? lavaY(S[i].x, S[i].z) - 0.16 : groundAt(S[i].x, S[i].z), lift = swim ? 0 : s < 0.12 ? hip * (0.95 + 0.25 * (e.gape > 0 ? 1 : 0)) : s < 0.55 ? hip : hip * (1 - (s - 0.55) * 1.6);
      const o = (e.slot.row * J + i) * 4; tex[o] = S[i].x - (tz / tl) * w * amp * (0.4 + s); tex[o + 1] = Math.max(g, -0.4) + Math.max(lift, 0.1 * K) - e.sweep * 0; tex[o + 2] = S[i].z + (tx / tl) * w * amp * (0.4 + s);
      // the tail sweep: the body bends into a C, the tail out to the side
      if (e.sweep && s > 0.5) { const k = (s - 0.5) * 2; tex[o] += -Math.cos(e.heading) * e.sweep * k * k * L * 0.35; tex[o + 2] += Math.sin(e.heading) * e.sweep * k * k * L * 0.35; }
    }
    path.needsUpdate = true;
  }
  // the feet: a foot steps when it's a quarter of a body length from where it belongs. Diagonal pairs, one pair at a time; the arc is low, a sprawler's
  function stepFeet(e, dt) {
    const sp = Math.hypot(e.vel.x, e.vel.z), dur = clamp((stride / Math.max(sp, 0.5)) * 0.5, 0.12, 0.45), moving = (k) => e.feet[k].t < 1, pairBusy = [moving(0) || moving(3), moving(1) || moving(2)];
    for (let k = 0; k < 4; k++) {
      const f = e.feet[k]; home(e, k, v1);
      if (f.t < 1) { f.t = Math.min(1, f.t + dt / dur); const u = f.t, lift = Math.sin(Math.PI * u) * Math.max(0.25 * f.from.distanceTo(f.to), 0.08 * K); f.p.lerpVectors(f.from, f.to, u * u * (3 - 2 * u)); f.p.y += lift; if (f.t >= 1) { f.p.copy(f.to); if (sp > 3) G.fx.scuff && G.fx.scuff(f.p, 0.5, 1); } continue; }
      const pair = k === 0 || k === 3 ? 0 : 1; if (pairBusy[1 - pair]) continue;
      if (f.p.distanceTo(v1) > stride * (sp > 0.3 ? 1 : 2.2)) { f.from.copy(f.p); f.to.copy(v1).addScaledVector(v2.set(e.vel.x, 0, e.vel.z), dur * 0.5); f.to.y = groundAt(f.to.x, f.to.z); f.t = 0; pairBusy[pair] = true; }
    }
  }
  // two bones from shoulder to foot, the elbow out and up, above the shoulder line as a monitor's is
  function drawLegs(e, base) {
    for (let k = 0; k < 4; k++) {
      const jn = e.chain[SH[k]], o = (e.slot.row * J + SH[k]) * 4, sx = tex[o], sy = tex[o + 1] - 0.05 * K, sz = tex[o + 2], f = e.feet[k].p;
      const dx = f.x - sx, dy = f.y - sy, dz = f.z - sz, d = Math.hypot(dx, dy, dz) || 1, reach = Math.min(d, upper + lower - 0.01), a = Math.acos(clamp((upper * upper + reach * reach - lower * lower) / (2 * upper * reach), -1, 1));
      // the elbow: out from the body and up
      const ox = sx + dx * 0.5, oz = sz + dz * 0.5, outx = ox - jn.x, outz = oz - jn.z, ol = Math.hypot(outx, outz) || 1, ex = sx + (dx / d) * Math.cos(a) * upper + (outx / ol) * Math.sin(a) * upper * 0.8, ey = sy + (dy / d) * Math.cos(a) * upper + Math.sin(a) * upper * 0.6, ez = sz + (dz / d) * Math.cos(a) * upper + (outz / ol) * Math.sin(a) * upper * 0.8;
      bone(base + k * 2, sx, sy, sz, ex, ey, ez); bone(base + k * 2 + 1, ex, ey, ez, f.x, f.y + 0.04 * K, f.z);
    }
  }
  function bone(i, ax, ay, az, bx, by, bz) { v1.set(bx - ax, by - ay, bz - az); const l = v1.length() || 1e-3; q.setFromUnitVectors(Y, v1.multiplyScalar(1 / l)); m4.compose(v2.set(ax, ay, az), q, sc.set(1, l, 1)); legs.setMatrixAt(i, m4); }

  // its mind: a day before a fight. It patrols near home with its head sweeping for scent; it notices him, stalks head low, charges, and tells every blow in its body. It won't go into the sea
  function brain(e, dt) {
    const h = G.hero, dist = e.pos.distanceTo(h.pos), F = e.def; e.t -= dt;
    // heat drifts back to rest; out of the fight's range it basks
    e.heat = damp(e.heat, 0.55, 0.05, dt); const hot = e.heat >= 0.85, cold = e.heat <= 0.25, torpid = e.heat <= 0.1, pace = (cold ? 0.45 : e.heat > 0.6 ? 1.15 : 1) * e.slow;
    if (hot && e.gape <= 0) { e.gape = 3.5; X.dropToken(e); X.endTell(e); e.state = 'circle'; e.t = 3.5; G.combat.teach('monitor_hot', 'Overheated', 'Its throat is open: strike the front'); }
    if (e.gape > 0) e.gape -= dt;
    if (torpid && e.state !== 'stun') { X.dropToken(e); X.endTell(e); e.state = 'stun'; e.t = 3; }
    // turf (R63): a fire animal holds 8 m back from the waterline, and thrown into the sea it scrambles out for 1.5 s, steaming
    const sp = Math.hypot(e.vel.x, e.vel.z), ahead = sp > 0.3 ? 8 / sp : 0, toWater = groundAt(e.pos.x + e.vel.x * ahead, e.pos.z + e.vel.z * ahead) < 0.3;
    if (groundAt(e.pos.x, e.pos.z) < 0.3 && !(e.fleeT > 0) && e.state !== 'dead') { e.fleeT = 1.5; e.flee = landDir(e); if (e.flee) { X.dropToken(e); X.endTell(e); e.state = 'circle'; e.t = 1.6; G.combat.log.push({ t: G.time, type: 'turf_flee', foe: e.kind }); } }
    if (e.fleeT > 0) { e.fleeT -= dt; if (e.flee) { e.vel.x = damp(e.vel.x, e.flee.x * 6, 6, dt); e.vel.z = damp(e.vel.z, e.flee.z * 6, 6, dt); } if ((e.puffT = (e.puffT || 0) - dt) <= 0) { e.puffT = 0.12; v1.set(e.pos.x + (Math.random() - 0.5), e.pos.y + 0.3, e.pos.z + (Math.random() - 0.5)); G.fx.sp('smoke', v1, 1.2, 0.9, STEAM, { s0: 0.5, s1: 1.6, a: 0.28, add: 0, hot: 0, vy: 2.4 }); } e.vel.y = 0; return; }
    switch (e.state) {
      case 'swimTo': case 'patrol': {
        if (dist < 34 && h.pos.y - groundAt(h.pos.x, h.pos.z) < 14) { e.state = 'stalk'; break; }
        e.wander = e.wander ?? Math.random() * TAU; e.wander += (Math.random() - 0.5) * dt; v1.set(e.home.x + Math.cos(e.wander) * 8, e.pos.y, e.home.z + Math.sin(e.wander) * 8); X.steer(e, v1, 1.2 * pace, 2, dt); break;
      }
      case 'stalk': X.steer(e, h.pos, 2.4 * pace, 3, dt); if (dist < 12) { e.state = 'circle'; e.t = 0.4; } if (dist > 50) e.state = 'patrol'; break;
      case 'circle': {
        v1.subVectors(h.pos, e.pos); v2.crossVectors(v1, Y).normalize().multiplyScalar(e.circleDir * 1.6); const hold = (dist - F.hold_m) * 1.4; v1.setY(0).normalize().multiplyScalar(hold).add(v2).multiplyScalar(pace);
        e.vel.x = damp(e.vel.x, v1.x, 3, dt); e.vel.z = damp(e.vel.z, v1.z, 3, dt);
        if (dist > 16) e.state = 'stalk';
        if (e.t <= 0 && e.gape <= 0 && X.takeToken(e)) { X.beginTell(e); if (e.blow.id === 'charge') e.vel.multiplyScalar(0.2); break; }
        if (e.t <= 0) e.t = 0.4; break;
      }
      case 'tell': {
        const b = e.blow, q2 = clamp(e.clock / b.tell_s, 0, 1); v1.subVectors(h.pos, e.pos).setY(0); const d = v1.length() || 1;
        // the bite: three tongue flicks, it rises into a high walk, the throat swells. The tail: the body bends into a C
        if (b.id === 'tail') e.sweep = damp(e.sweep, 0.9 * e.circleDir, 6, dt); else e.jaw = damp(e.jaw, 0.08 + 0.1 * Math.max(0, Math.sin(e.clock * 30)), 10, dt);
        e.vel.x = damp(e.vel.x, b.id === 'bite' && d > b.reach_m ? (v1.x / d) * 2 * pace : 0, 6, dt); e.vel.z = damp(e.vel.z, b.id === 'bite' && d > b.reach_m ? (v1.z / d) * 2 * pace : 0, 6, dt);
        if (X.tellStep(e, dt * (cold ? 1 / 1.4 : 1))) { X.beginStrike(e); if (b.id === 'bite') { e.vel.addScaledVector(v1.normalize(), F.lunge_mps * pace); } }
        break;
      }
      case 'strike': {
        const b = e.blow; e.clock += dt; if (b.id === 'bite') e.jaw = damp(e.jaw, 0.42, 30, dt); else e.sweep = damp(e.sweep, -0.9 * e.circleDir, 14, dt);
        if (!e.hitDone && e.pos.distanceTo(h.pos) < b.reach_m + (b.id === 'tail' ? 1 : 0)) X.blowLands(e, b, e.pos);
        if (e.clock >= b.strike_s) { e.state = 'recover'; e.clock = 0; }
        break;
      }
      case 'recover': { const b = e.blow; e.clock += dt; e.vel.multiplyScalar(Math.exp(-4 * dt)); e.jaw = damp(e.jaw, 0, 6, dt); e.sweep = damp(e.sweep, 0, 4, dt); if (b && e.clock >= b.recover_s) { X.dropToken(e); X.endTell(e); e.state = 'circle'; e.t = 0.8 + Math.random() * 1.4; } break; }
      case 'stun': e.vel.multiplyScalar(Math.exp(-3 * dt)); if (e.t <= 0) { e.state = 'circle'; e.t = 0.6; } break;
    }
    if (e.state !== 'tell' && e.state !== 'strike') { e.jaw = damp(e.jaw, e.gape > 0 ? 0.32 : 0, 5, dt); e.sweep = damp(e.sweep, 0, 4, dt); }
    // never into the sea: it turns along the shore
    if (toWater) { e.vel.x *= -0.5; e.vel.z *= -0.5; }
    e.vel.y = 0;
  }
  // the way back to dry ground: the nearest of eight ways out to 12 m
  function landDir(e) { for (const r of [4, 8, 12]) for (let k = 0; k < 8; k++) { const a = k * 0.785, x = Math.cos(a), z = Math.sin(a); if (groundAt(e.pos.x + x * r, e.pos.z + z * r) > 0.6) return new THREE.Vector3(x, 0, z); } return null; }
  const STEAM = new THREE.Color(0.92, 0.94, 0.96);
  function draw(e, dt) {
    const s = e.slot, U = s.mat.U; s.g.position.set(0, 0, 0); s.g.quaternion.identity();
    if (e.state === 'dead') U.uFade.value = Math.min(1, U.uFade.value + dt * 1.25);
    // its heart: 0.5 beats a second cold, 1.67 hot
    e.beat = (e.beat || 0) + dt * (0.5 + 1.4 * e.heat); U.uBeat.value = Math.max(0, Math.sin(e.beat * TAU)) ** 3; U.uHeat.value = damp(U.uHeat.value, e.heat, 6, dt); U.uJaw.value = e.jaw;
    if (e.state !== 'dead' && e.frozen <= 0) { spine(e, dt); stepFeet(e, dt); }
    if (e.state === 'tell') G.fx.edge(e.pos, !!(e.blow && e.blow.unblockable));
  }
  // every frame, after all of them have moved: the legs of the living, in one draw
  function frame() { let n = 0; for (const s of pool) if (s.busy && s.e && s.e.state !== 'dead' && !(NW && s.e.inLava)) { drawLegs(s.e, n); n += 8; } legs.count = n; legs.instanceMatrix.needsUpdate = n > 0; if (NW) stepBlobs(); }
  const chanAt = (x, z) => chan(x, -z);

  // ------------------------------------------------------------------ the newt's mind. It can't see: as a giant salamander feels for movement in the water, it goes for thumps, his feet on the ground, his landings, his blows, within hear_m. A flyer who hangs quiet over it is safe until he strikes. Pipeline/research/LIFE_SOURCES.md R-2
  const by = (e, id) => e.def.blows.find((b) => b.id === id);
  function face(e, p, k, dt) { const want = Math.atan2(p.x - e.pos.x, p.z - e.pos.z); let d = want - e.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); e.heading += d * (1 - Math.exp(-k * dt)); }
  function newtBrain(e, dt) {
    const h = G.hero, F = e.def, U = e.slot.mat.U; e.t -= dt; e.inLava = chanAt(e.pos.x, e.pos.z) < 0.55;
    e.heat = damp(e.heat, 0.55, 0.05, dt); if (e.inLava) e.heat = Math.min(1, e.heat + 0.2 * dt);
    e.spent = Math.max(0, (e.spent || 0) - dt); e.crustT = Math.max(0, (e.crustT || 0) - dt); U.uSpent.value = damp(U.uSpent.value, e.spent > 0 ? 1 : 0, 4, dt);
    // its ears
    const dist = e.pos.distanceTo(h.pos), sp = Math.hypot(h.vel.x, h.vel.z), landed = e.wasAir && !h.air; e.wasAir = !!h.air;
    if (!h.dead && dist < F.hear_m && (h.state === 'attack' || (!h.air && sp > 1.5) || landed)) { (e.heardP = e.heardP || new THREE.Vector3()).copy(h.pos); e.heardT = 2.5; }
    e.heardT = Math.max(0, (e.heardT || 0) - dt);
    const pace = (e.heat <= 0.25 ? 0.5 : e.heat > 0.6 ? 1.15 : 1) * (e.crustT > 0 ? 0.7 : 1), run = e.inLava ? F.swim_mps : F.speed_mps;
    switch (e.state) {
      case 'swimTo': case 'patrol': case 'circle': {
        U.uLob.value = 0;
        if (e.heardT > 0) {
          const d = e.pos.distanceTo(e.heardP), lob = by(e, 'lob'), snap = by(e, 'snap');
          if (e.t <= 0 && d < snap.reach_m + 0.6 && X.takeToken(e)) { X.beginTell(e, snap); break; }
          if (e.t <= 0 && d > 4.5 && d < lob.reach_m && e.spent <= 0 && X.takeToken(e)) { const b = X.beginTell(e, lob); if (e.heat > 0.6) e.blow = { ...e.blow, tell_s: e.blow.tell_s * 0.75 }; break; }
          if (e.t <= 0) e.t = 0.5; face(e, e.heardP, 4, dt); X.steer(e, e.heardP, (d > 9 ? run : 0.4) * pace, 2.5, dt); break;
        }
        // its day: in the channel it swims its length near home; out of it, cold, it crawls back to the lava
        e.wander = e.wander ?? Math.random() * TAU; e.wander += (Math.random() - 0.5) * dt * 0.6; v1.set(e.home.x + Math.cos(e.wander) * 9, e.pos.y, e.home.z + Math.sin(e.wander) * 9);
        if (!e.inLava && e.heat <= 0.25) v1.copy(e.home); X.steer(e, v1, (e.inLava ? run * 0.5 : 1) * pace, 2, dt); break;
      }
      case 'tell': {
        const b = e.blow, q2 = clamp(e.clock / b.tell_s, 0, 1); if (e.heardP) face(e, e.heardP, 6, dt); e.vel.multiplyScalar(Math.exp(-5 * dt));
        if (b.id === 'lob') U.uLob.value = q2; else e.jaw = damp(e.jaw, 0.05, 8, dt);
        if (X.tellStep(e, dt)) { X.beginStrike(e); e.shots = b.shots || 0; e.gapT = 0; if (b.id === 'snap' && e.heardP) { v1.subVectors(e.heardP, e.pos).setY(0).normalize(); e.vel.addScaledVector(v1, F.lunge_mps); } }
        break;
      }
      case 'strike': {
        const b = e.blow; e.clock += dt;
        if (b.id === 'lob') { U.uLob.value = 1; if (e.shots > 0 && (e.gapT -= dt) <= 0) { e.gapT = b.gap_s; e.shots--; lobAt(e, b); } }
        else { e.jaw = damp(e.jaw, 0.4, 30, dt); if (!e.hitDone && e.pos.distanceTo(h.pos) < b.reach_m) X.blowLands(e, b, e.pos); }
        if (e.clock >= b.strike_s) { e.state = 'recover'; e.clock = 0; if (b.id === 'lob' && ++e.lobs >= 3) { e.lobs = 0; e.spent = F.spent_s; G.combat.teach('newt_spent', 'Glands spent', 'Its skin is soft: strike now'); G.combat.log.push({ t: G.time, type: 'newt_spent', foe: e.kind }); } }
        break;
      }
      case 'recover': { const b = e.blow; e.clock += dt; U.uLob.value = damp(U.uLob.value, 0, 6, dt); e.vel.multiplyScalar(Math.exp(-4 * dt)); e.jaw = damp(e.jaw, 0, 6, dt); if (b && e.clock >= b.recover_s) { X.dropToken(e); X.endTell(e); e.state = 'patrol'; e.t = 0.6 + Math.random() * 0.8; } break; }
      case 'stun': e.vel.multiplyScalar(Math.exp(-3 * dt)); if (e.t <= 0) { e.state = 'patrol'; e.t = 0.6; } break;
    }
    if (e.state !== 'tell' && e.state !== 'strike') e.jaw = damp(e.jaw, 0, 5, dt);
    // never into the sea, as every fire animal
    if (groundAt(e.pos.x + e.vel.x * 0.6, e.pos.z + e.vel.z * 0.6) < 0.3 && !e.inLava) { e.vel.x *= -0.5; e.vel.z *= -0.5; }
    e.vel.y = 0;
  }
  // a lob: a gobbet of fire from the glands on its back, thrown to come down where it heard him, or through him if he's hanging in the air over it. Where it will land on the ground is ringed
  const blobs = []; for (let i = 0; i < 6; i++) blobs.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, puff: 0, b: null, from: null });
  const HOT = new THREE.Color(1, 0.5, 0.08), SMK = new THREE.Color(0.2, 0.17, 0.15), GRAV = 9.8;
  function lobAt(e, b) {
    // where the footsteps are going: it leads a running man by most of the flight, as the thumps keep coming
    const o = blobs.find((q) => !q.on); if (!o) return; const h = G.hero, hearing = e.heardT > 2 && e.pos.distanceTo(h.pos) < b.reach_m + 4, tf = b.flight_s, T = v2.copy(hearing ? h.pos : e.heardP || h.pos); if (hearing && !h.air) T.addScaledVector(v3.set(h.vel.x, 0, h.vel.z), tf * 0.7);
    const c = e.chain[5 + (e.shots % 2) * 2]; o.p.set(c.x, (e.inLava ? lavaY(c.x, c.z) : groundAt(c.x, c.z)) + 0.35, c.z);
    o.v.set((T.x - o.p.x) / tf, (T.y - o.p.y) / tf + 0.5 * GRAV * tf, (T.z - o.p.z) / tf); o.t = 0; o.on = true; o.b = b; o.from = e; o.puff = 0;
    const g = groundAt(T.x, T.z); if (T.y - g < 2.5) G.fx.circle && G.fx.circle(v3.set(T.x, g + 0.1, T.z).clone(), null, b.ring_m, 'fire', tf + 0.05);
    G.combat.log.push({ t: G.time, type: 'lob', foe: e.kind }); G.audio.swing && G.audio.swing();
  }
  let lastT = null;
  function stepBlobs() {
    const dt = lastT === null ? 0 : Math.min(0.05, Math.max(0, G.time - lastT)); lastT = G.time; if (!dt) return; const h = G.hero;
    for (const o of blobs) {
      if (!o.on) continue; o.t += dt; o.v.y -= GRAV * dt; o.p.addScaledVector(o.v, dt);
      G.fx.sp('dot', o.p, 0.42, 0.12, HOT, { s0: 0.42, s1: 0.2, hot: 0.9, add: 1 }); if ((o.puff -= dt) <= 0) { o.puff = 0.05; G.fx.sp('smoke', o.p, 0.4, 0.7, SMK, { s0: 0.25, s1: 0.8, a: 0.3, add: 0, hot: 0, vy: 0.8 }); }
      let hit = false; const g = groundAt(o.p.x, o.p.z);
      if (o.p.distanceTo(h.pos) < 1.4) { hit = true; const res = h.damage(o.b.damage, o.p); G.combat.log.push({ t: G.time, type: 'contact', foe: 'newt', blow: 'lob', res }); }
      else if (o.p.y < g || o.t > 4) { hit = true; if (h.pos.distanceTo(v1.set(o.p.x, g, o.p.z)) < o.b.ring_m && h.pos.y - g < 2.5) { const res = h.damage(o.b.damage, o.p); G.combat.log.push({ t: G.time, type: 'contact', foe: 'newt', blow: 'lob', res }); } }
      if (hit) { o.on = false; v1.set(o.p.x, Math.max(o.p.y, g + 0.1), o.p.z); G.fireKit && G.fireKit.burst(v1.clone(), 0.7, null); G.fireLight && G.fireLight.pop(v1, 1, 0.5, 0.12, 9, 0.05, 20); G.dmg && G.dmg.hit(v1, o.b.ring_m, 'fire', 0.8); }
    }
  }
  return { pool, brain: NW ? newtBrain : brain, born, draw, frame, blobs, lavaAt: (x, z) => chanAt(x, z), use(x) { X = x; }, home: (x, z) => { for (let R = 0; R < 60; R += 6) for (let a = 0; a < TAU; a += 0.5) { const px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R; if (groundAt(px, pz) > 2) return new THREE.Vector3(px, groundAt(px, pz) + 1, pz); } return null; } };
}
