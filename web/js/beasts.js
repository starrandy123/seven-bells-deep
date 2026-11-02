// Fire animals. Randy, 2 Nov: "We need fire type animals too that the fire elementals can fight just like the water bosses". Pipeline/research/LIFE_SOURCES.md
// The first is the Scoria Monitor, a monitor lizard drawn half again life size: with its glow off, a biologist would name it. Built in the order a shipped game's creature talk gives: moving boxes, legs, weight, detail.
// The spine is a chain of 16 joints that follow the head, each bend held to 22.5°, kept in a float texture a row an animal, and one straight body bent along it in the vertex shader. Walking it holds a standing S, still at the shoulders and hips; at a charge the wave travels.
// Four two-bone legs step in diagonal pairs, never both at once; a planted foot holds its place in the world for its whole stance, and distance drives the stride, never a clock.
// Body heat is the fight's shared rule: fire stokes it until it pants open-mouthed with its throat bare, water chills it until its plates split and it slows. Both are real reptile behaviour.
import * as THREE from 'three';

const J = 16, TAU = Math.PI * 2, LIMB = 22.5 * Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
// a 4.5 m monitor: head and trunk 2.2 m, tail 2.3 m. Stations along it: s from snout 0 to tail tip 1, half width, half height
const BODY = [[0, 0.02, 0.02], [0.03, 0.09, 0.07], [0.07, 0.13, 0.1], [0.1, 0.13, 0.11], [0.14, 0.15, 0.13], [0.2, 0.25, 0.19], [0.27, 0.32, 0.22], [0.35, 0.34, 0.23], [0.43, 0.31, 0.22], [0.49, 0.25, 0.19], [0.56, 0.19, 0.16], [0.65, 0.14, 0.13], [0.75, 0.1, 0.09], [0.86, 0.06, 0.06], [0.95, 0.03, 0.03], [1, 0.01, 0.01]];

function bodyGeo(L) {
  const P = [], S = [], I = [], ring = 10;
  // the table's widths and heights are full sizes as a share of the length: a monitor 3 m long is about 0.4 m across the trunk
  for (let i = 0; i < BODY.length; i++) { const s = BODY[i][0], w = BODY[i][1] * 0.42, h = BODY[i][2] * 0.48; for (let k = 0; k < ring; k++) { const a = (k / ring) * TAU, y = Math.sin(a), x = Math.cos(a); P.push(x * w * L * 0.5, (y < 0 ? y * 0.75 : y) * h * L * 0.5 + h * L * 0.08, 0); S.push(s, x, y, k / ring); } }
  for (let i = 0; i < BODY.length - 1; i++) for (let k = 0; k < ring; k++) { const a = i * ring + k, b = i * ring + ((k + 1) % ring); I.push(a, a + ring, b, b, a + ring, b + ring); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 4)); g.setIndex(I); g.computeVertexNormals(); return g;
}

export function createBeasts(G, { foeMaterial, D }) {
  const MAXB = 4, FOE = D.foes.monitor, K = FOE.scale_k || 1.5, L = 3 * K, hip = 0.4 * K, upper = 0.3 * K, lower = 0.32 * K, stride = 0.24 * L;
  const tex = new Float32Array(J * MAXB * 4), path = new THREE.DataTexture(tex, J, MAXB, THREE.RGBAFormat, THREE.FloatType); path.minFilter = path.magFilter = THREE.NearestFilter; path.needsUpdate = true;
  const geo = bodyGeo(L);
  // basalt-black beaded plates, the glow only in the gaps between them; the cracks pulse at its heart rate, so its heat reads across a fight
  const base = new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.78, metalness: 0 });
  G.look.patch(base, { key: 'monitor', skinned: true,
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
  const cap = new THREE.CapsuleGeometry(0.07 * K, 1, 3, 6); cap.translate(0, 0.5, 0);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.85 }); G.look.patch(legMat, { key: 'monitorLeg' });
  const legs = new THREE.InstancedMesh(cap, legMat, MAXB * 8); legs.count = 0; legs.frustumCulled = false; G.scene.add(legs);
  const pool = []; for (let i = 0; i < MAXB; i++) { const g = new THREE.Group(), mat = foeMaterial(base, { uPath: { value: path }, uRow: { value: i }, uJaw: { value: 0 }, uHeat: { value: 0.55 }, uBeat: { value: 0 } }), m = new THREE.Mesh(geo, mat); m.frustumCulled = false; g.add(m); g.visible = false; G.scene.add(g); pool.push({ g, mat, busy: false, row: i, mixer: null, acts: {} }); }

  let X = null; const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3();
  const groundAt = (x, z) => G.world.heightAt(x, -z);

  function born(e) {
    const s = e.slot; e.heat = 0.55; e.beat = 0; e.gape = 0; e.jaw = 0; e.gait = 0; e.chain = []; e.feet = []; e.swing = [0, 0, 0, 0]; e.step = 0; e.sweep = 0; e.fishy = false; e.onLand = true;
    for (let i = 0; i < J; i++) e.chain.push(new THREE.Vector3(e.pos.x - Math.sin(e.heading) * (i * L) / (J - 1), 0, e.pos.z - Math.cos(e.heading) * (i * L) / (J - 1)));
    for (let k = 0; k < 4; k++) e.feet.push({ p: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1 });
    s.mat.U.uHeat.value = 0.55; placeFeet(e, true);
    // heat: fire stokes it, water and ice chill it. A gaping throat and a cold body take more; its back is armour
    const take = e.onHit;
    e.onHit = (dmg, from, type, info = {}) => {
      const el = info.element || (G.sideNow === 'fire' ? 'fire' : 'water'); e.heat = clamp(e.heat + (el === 'fire' ? 0.12 : el === 'ice' ? -0.35 : -0.25), 0, 1);
      v1.subVectors(from, e.pos).setY(0).normalize(); const front = v1.x * Math.sin(e.heading) + v1.z * Math.cos(e.heading), throat = front > 0.5 && (e.gape > 0 || e.stagger > 0);
      const mul = throat ? 2 : e.heat <= 0.25 ? 0.8 : front < -0.3 ? 0.35 : 1; return take(dmg * mul, from, type, info);
    };
  }
  // where each foot belongs: beside the shoulder (joint 3) or the hip (joint 7), out and a little forward
  const SH = [3, 3, 7, 7], SIDE = [-1, 1, -1, 1];
  function home(e, k, out) { const jn = e.chain[SH[k]], nx = e.chain[SH[k] - 1], tx = jn.x - nx.x, tz = jn.z - nx.z, l = Math.hypot(tx, tz) || 1, rx = -tz / l, rz = tx / l; out.set(jn.x + rx * SIDE[k] * 0.55 * K - (tx / l) * 0.25 * K, 0, jn.z + rz * SIDE[k] * 0.55 * K - (tz / l) * 0.25 * K); out.y = groundAt(out.x, out.z); return out; }
  function placeFeet(e, now) { for (let k = 0; k < 4; k++) { home(e, k, e.feet[k].p); e.feet[k].to.copy(e.feet[k].p); e.feet[k].t = 1; } }

  // the chain: the head goes where the body's heading and position say, and each joint follows the one ahead at its length, its bend held to 22.5°, with the walking wave laid across it
  function spine(e, dt) {
    const sp = Math.hypot(e.vel.x, e.vel.z), seg = L / (J - 1), hx = Math.sin(e.heading), hz = Math.cos(e.heading), S = e.chain;
    e.gait += (sp * dt) / (stride * 2); const travel = clamp((sp / L - 1.5) / 1.5, 0, 1), amp = clamp(sp / 4, 0.15, 1) * 0.14 * K;
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
      const g = groundAt(S[i].x, S[i].z), lift = s < 0.12 ? hip * (0.95 + 0.25 * (e.gape > 0 ? 1 : 0)) : s < 0.55 ? hip : hip * (1 - (s - 0.55) * 1.6);
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
  function frame() { let n = 0; for (const s of pool) if (s.busy && s.e && s.e.state !== 'dead') { drawLegs(s.e, n); n += 8; } legs.count = n; legs.instanceMatrix.needsUpdate = n > 0; }
  return { pool, brain, born, draw, frame, use(x) { X = x; }, home: (x, z) => { for (let R = 0; R < 60; R += 6) for (let a = 0; a < TAU; a += 0.5) { const px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R; if (groundAt(px, pz) > 2) return new THREE.Vector3(px, groundAt(px, pz) + 1, pz); } return null; } };
}
