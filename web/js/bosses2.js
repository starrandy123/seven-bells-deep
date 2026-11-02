// The two bosses that aren't serpents. Each answers what the game asks of a boss: wake, stop, step, draw, strike, lockPoint, active, dead, hp, phase, head, stunned, headT.
// The Kraken: tentacles slam, lie open, and a frozen one can be severed; when they're gone the body is open. The Colossus: armoured until its vents are capped with ice.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t), RISE = 2.4;
const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const UP = new THREE.Vector3(0, 1, 0);
const smoothstep01 = (x) => { const t = clamp(x * 2, 0, 1); return t * t * (3 - 2 * t); };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a)), LN2X2 = 2 * 0.69314718;
// A heavy body turns to face him on a critically damped spring, the short way round: simple_spring_damper_exact, Daniel Holden, Spring-It-On (MIT).
// No snap when he passes close by it, and never a spin the long way when the angle crosses its wrap. o.yaw, o.yawV: its facing and its rate
function yawTo(o, goal, dt, half) { const y = LN2X2 / half, j0 = wrapA(o.yaw - goal), j1 = o.yawV + j0 * y, e = Math.exp(-y * dt); o.yaw = wrapA(e * (j0 + j1 * dt) + goal); o.yawV = e * (o.yawV - j1 * y * dt); return o.yaw; }
// a limb's end follows its goal on the same spring, in three axes, with its own velocity: it starts and stops moving instead of jumping toward where it's sent
function reach(p, v, goal, dt, half) {
  const y = LN2X2 / half, e = Math.exp(-y * dt);
  let j0 = p.x - goal.x, j1 = v.x + j0 * y; p.x = e * (j0 + j1 * dt) + goal.x; v.x = e * (v.x - j1 * y * dt);
  j0 = p.y - goal.y; j1 = v.y + j0 * y; p.y = e * (j0 + j1 * dt) + goal.y; v.y = e * (v.y - j1 * y * dt);
  j0 = p.z - goal.z; j1 = v.z + j0 * y; p.z = e * (j0 + j1 * dt) + goal.z; v.z = e * (v.z - j1 * y * dt);
}
// A slam is thrown down, not teleported: from where it was raised to the mark over the strike's own time, on a constant acceleration, so it's fastest at the hit.
// It was a first-order lerp at 40 to 44 a second, half the way in its first frame. u: 0 as the strike starts, 1 at the hit
function slamPath(out, from, mark, u) { const k = u <= 0 ? 0 : u >= 1 ? 1 : u * u; out.lerpVectors(from, mark, k); }
const STRIKE_K = 0.14, SLAM_ARM = 0.13;

// what every boss here shares: the rule of a wake, the log the walls read, the end
function shell(G, C, b, onWake, onStop) {
  G.bosses = G.bosses || {}; G.bosses[C.id] = b;
  const tmp = new THREE.Vector3();
  b.head = new THREE.Vector3(); b.pos = b.head; b.frame = new THREE.Vector3();      // what a camera frames: its head, and the bed it's coming through until it's up
  Object.assign(b, {
    id: C.id, name: C.name, active: false, dead: false, hp: C.hp, maxHp: C.hp, phase: 1, stunned: 0, mode: 'idle', t: 0, riseLen: RISE, centre: new THREE.Vector3(),
    wake() {
      if (b.active) return; G.boss = b; const el = document.querySelector('#bossbar b'); if (el) el.textContent = C.name.toUpperCase();
      const h = G.hero, stand = C.stand_m || 16, floor = G.world.heightAt(h.pos.x, -h.pos.z); b.centre.set(h.pos.x + Math.sin(h.heading) * stand, Math.max(floor + 1, Math.min(-6, h.pos.y)), h.pos.z + Math.cos(h.heading) * stand);
      b.facing.set(h.pos.x - b.centre.x, 0, h.pos.z - b.centre.z); if (b.facing.lengthSq() > 0.01) b.facing.normalize(); else b.facing.set(Math.sin(h.heading + Math.PI), 0, Math.cos(h.heading + Math.PI));
      b.active = true; b.mode = 'rise'; b.t = b.riseLen = C.intro_s || RISE; b.roared = false; b.dust = 0; G.audio.roar(); G.audio.setMood('tense'); G.look.setMood('bossfight', 1); G.shake(0.6); G.ui.toast(C.name, C.hint, 5); onWake();
    },
    stop() { b.active = false; onStop(); },
    bearing() { return Math.atan2(b.facing.x, b.facing.z); },       // where a camera stands to look it in the face
    // the rise runs as long as the cinematic over it; with none, or skipped, it goes the short way, so a fight starts when he can play it
    cut() { if (b.mode === 'rise' && b.t > RISE && !(G.cine && G.cine.active)) b.t = b.riseLen = RISE; },
    risen() { return b.mode === 'rise' ? clamp(1 - b.t / b.riseLen, 0, 1) : 1; },
    // the bed giving way where it comes up
    dustAt(p, r, dt, hot) { if ((b.dust -= dt) > 0) return; b.dust = 0.09; G.fx.silt(p, r, hot); G.fx.bubbles(p, 6, r * 0.7); },
    roarNow(p, col) { if (b.roared) return; b.roared = true; G.audio.roar(); if (!(G.settings && G.settings.shake === false)) G.shake(0.8); G.look.flash(p, col, 24, 0.7); G.fx.ring(p.clone(), 24, 1, col, tmp.subVectors(G.camera.position, p).normalize().clone()); G.fx.bubbles(p, 40, 5); G.life && G.life.scatter(p, 50); },
    log(type, blow, extra) { G.combat.log.push({ t: G.time, type, foe: C.id, blow, ...extra }); },
    hurt(d) {
      if (!b.active || b.dead) return; b.hp -= d; b.flash = 1;
      if (b.hp <= 0) { b.hp = 0; b.dead = true; b.mode = 'die'; b.t = 4; G.audio.roar(); G.quest && G.quest.onBossDead(C.id); G.look.setMood('victory', 1); G.fx.ring(b.head.clone(), 30, 1.4, 0xffffff, tmp.subVectors(G.camera.position, b.head).normalize().clone()); }
    },
  });
}

// ------------------------------------------------------------------ the Kraken
export function createKraken(G, C) {
  const SEG = 16, R0 = 1.25, armGeo = new THREE.CylinderGeometry(0.82, 1, 1, 12, 1, false).translate(0, 0.5, 0);
  // the body: a mantle from a sphere, lumped by a few sines, dark red going pale at the belly
  // the mantle, drawn on a sphere by height: a skirt the arms leave from, a neck at the eyes, a long bulb lying back. Sockets stand out round the eyes, and the skin is mottled, pale under
  const bodyGeo = new THREE.SphereGeometry(1, 44, 32), EYE_AT = [-1, 1].map((s) => new THREE.Vector3(s * 2.5, 0.75, 2.85));
  { const rad = (t) => (t < 0.1 ? 2.2 + 2.6 * Math.sin((t / 0.1) * 1.57) : t < 0.34 ? 4.8 - 1.2 * Math.sin(((t - 0.1) / 0.24) * 1.57) : t < 0.72 ? 3.6 + 1.5 * Math.sin(((t - 0.34) / 0.38) * 1.57) : 5.1 * Math.sqrt(Math.max(0, 1 - ((t - 0.72) / 0.28) ** 2)));
    const p = bodyGeo.attributes.position, c = new Float32Array(p.count * 3), q0 = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const sx = p.getX(i), sy = p.getY(i), sz = p.getZ(i), ring = Math.hypot(sx, sz) || 1, t = (sy + 1) / 2, R = rad(t), lean = t > 0.4 ? -((t - 0.4) ** 2) * 9 : 0;
      let x = (sx / ring) * R, y = -4.4 + t * 14, z = (sz / ring) * R + lean; q0.set(x, y, z);
      for (const e of EYE_AT) { const d = q0.distanceTo(e), raise = 0.62 * Math.exp(-(d * d) / 2.2) - 0.5 * Math.exp(-(d * d) / 0.4); x += (sx / ring) * raise; z += (sz / ring) * raise; }
      const n = 1 + 0.045 * Math.sin(x * 1.3 + y) + 0.035 * Math.sin(z * 1.9 - y * 0.7) + 0.012 * Math.sin(x * 7 + y * 5) * Math.sin(z * 6.5 - y * 3); p.setXYZ(i, x * n, y, z * n);
      const q = clamp(t * 1.35, 0, 1), spot = smoothstep01(Math.sin(x * 1.5 + Math.sin(y * 1.1) * 1.4) * Math.sin(z * 1.7 + y * 0.6)), belly = clamp((0.2 - t) / 0.14, 0, 1), m = 1 - 0.6 * spot; c[i * 3] = (0.15 + q * 0.2) * m + belly * 0.3; c[i * 3 + 1] = (0.02 + q * 0.03) * m + belly * 0.16; c[i * 3 + 2] = (0.045 + q * 0.05) * m + belly * 0.14;
    }
    bodyGeo.setAttribute('color', new THREE.BufferAttribute(c, 3)); bodyGeo.computeVertexNormals(); }
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05 }); G.look.patch(skin, {});
  const armMat = new THREE.MeshStandardMaterial({ color: 0x5a1626, roughness: 0.34 }); G.look.patch(armMat, {});
  const body = new THREE.Mesh(bodyGeo, skin); body.visible = false; body.frustumCulled = false; G.scene.add(body);
  // its eyes: gold, a level slit for a pupil, and wet. The slit narrows when it looks at him
  const eyeGeo = new THREE.SphereGeometry(1.08, 20, 14), slit = { value: 0.3 }, eyeMat = new THREE.ShaderMaterial({ uniforms: { uSlit: slit }, vertexShader: 'varying vec3 vP, vN, vV; void main() { vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uSlit; varying vec3 vP, vN, vV; void main() { vec3 q = normalize(vP); vec2 p = q.xy / max(0.35, 1.0 + q.z) * 1.6; float r = length(p), a = atan(p.y, p.x); vec3 c = mix(vec3(1.0, 0.74, 0.2), vec3(0.5, 0.16, 0.03), smoothstep(0.1, 0.8, r)); c *= 0.78 + 0.22 * sin(a * 46.0 + sin(a * 9.0) * 2.0); float e = abs(p.y) - uSlit * max(0.0, 1.0 - pow(p.x / 0.62, 2.0)); c = mix(c, vec3(0.0), smoothstep(0.02, -0.01, e)); c = mix(c, vec3(0.04, 0.0, 0.02), smoothstep(0.8, 1.02, r)); c += pow(max(dot(reflect(-vV, normalize(vN)), normalize(vec3(0.3, 0.7, 0.6))), 0.0), 90.0) * 1.3; gl_FragColor = vec4(c, 1.0); }' });
  const eyes = EYE_AT.map((at) => { const m = new THREE.Mesh(eyeGeo, eyeMat); m.position.copy(at); m.lookAt(at.x * 1.5, at.y, at.z * 1.5 + 4); body.add(m); return m; });
  // an arm is a chain of segments: one instanced draw for all of them, each cylinder laid between two points
  const arms = [], M = new THREE.InstancedMesh(armGeo, armMat, C.arms * SEG); M.frustumCulled = false; M.visible = false; G.scene.add(M);
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), m4 = new THREE.Matrix4(), tmp = new THREE.Vector3();
  for (let i = 0; i < C.arms; i++) { const pts = []; for (let k = 0; k <= SEG; k++) pts.push(new THREE.Vector3()); arms.push({ pts, base: new THREE.Vector3(), tip: new THREE.Vector3(), tv: new THREE.Vector3(), from: new THREE.Vector3(), arch: 1, sw: 1, state: 'idle', t: 0, hp: C.arm_hp, frozen: 0, phase: i * 1.3, r: 1.4, pos: new THREE.Vector3(), mark: new THREE.Vector3(), hitDone: false, gone: false }); }
  const b = { facing: new THREE.Vector3(0, 0, 1) }; G.fx.warmList.push(body, M);
  shell(G, C, b, () => { body.visible = true; M.visible = true; b.nextT = 2.6; b.exposed = false; b.turn = { yaw: Math.atan2(b.facing.x, b.facing.z), yawV: 0 }; for (const a of arms) { a.state = 'idle'; a.hp = C.arm_hp; a.gone = false; a.frozen = 0; } b.hp = b.dead ? b.hp : C.hp; b.bodyHit = 0; }, () => { body.visible = false; M.visible = false; });
  b.headT = { pos: b.head, r: 4.6, onHit: (d) => { if (!b.exposed) { b.log('blocked', 'mantle'); b.hurt(d * 0.1); return; } b.hurt(d); } };
  const lay = (a, i, dt) => {
    // the wobble and the arch ease from one state's to the next: switched in a frame they moved the arm's middle up to 2.7 m at once
    a.sw = damp(a.sw, (a.state === 'idle' || a.state === 'tell' ? 1 : 0.15) * (b.mode === 'rise' ? 3 : 1), 10, dt); a.arch = damp(a.arch, a.state === 'down' ? 0.15 : 1, 10, dt);
    const swing = a.sw, n = a.pts.length - 1;
    a.pts[0].copy(a.base);
    if (a.state === 'idle') { const t = G.time * 0.9 + a.phase; const out = a.out === undefined ? a.phase * 2 : a.out; reach(a.tip, a.tv, tmp.set(a.base.x + Math.cos(out) * 7 + Math.sin(t) * 2, a.base.y + 8 + Math.sin(t * 1.3) * 2, a.base.z + Math.sin(out) * 7 + Math.cos(t) * 2), dt, 0.16); }
    for (let k = 1; k <= n; k++) { const u = k / n; v.lerpVectors(a.base, a.tip, u); v.y += Math.sin(u * Math.PI) * 3.2 * a.arch; v.x += Math.sin(u * 5 + G.time * 2 + a.phase) * 0.7 * swing * u; v.z += Math.cos(u * 4 + G.time * 1.7 + a.phase) * 0.7 * swing * u; a.pts[k].copy(v); }
    a.pos.copy(a.pts[n - 2]);
    for (let k = 0; k < n; k++) {
      const p0 = a.pts[k], p1 = a.pts[k + 1]; v.subVectors(p1, p0); const l = v.length() || 1, w = a.gone ? 0 : R0 * Math.pow(1 - k / n, 0.8) + 0.06; q.setFromUnitVectors(UP, v.multiplyScalar(1 / l)); m4.compose(p0, q, s.set(w, l * 1.18, w)); M.setMatrixAt(i * SEG + k, m4);
    }
  };
  function slam(a) {
    const h = G.hero; a.state = 'tell'; a.t = C.tell_s; a.mark.copy(h.pos); a.mark.y = Math.max(G.world.heightAt(h.pos.x, -h.pos.z) + 0.3, h.pos.y - 1.2); a.hitDone = false;
    G.fx.circle(a.mark, null, C.radius_m, 'water', C.tell_s + 0.1); b.log('tell', 'slam', { tell_s: C.tell_s }); G.audio.tell && G.audio.tell(false);
  }
  b.step = (dt) => {
    if (!b.active) return; const h = G.hero; b.t -= dt; b.cut(); const live = arms.filter((a) => !a.gone), pc = b.hp / b.maxHp; b.phase = !b.exposed ? 1 : pc > 0.5 ? 2 : 3; b.flash = Math.max(0, (b.flash || 0) - dt * 6);
    // the sand goes first, then the arms come up round the place one by one, then the mantle, and last the eyes open and it roars
    const rose = b.risen();
    if (b.mode === 'rise') {
      body.position.y = b.centre.y - 12 * (1 - ease(clamp((rose - 0.42) / 0.42, 0, 1))); if (rose < 0.55) b.dustAt(tmp.set(b.centre.x, G.world.heightAt(b.centre.x, -b.centre.z) + 0.6, b.centre.z), 5 + rose * 12, dt, false);
      if (rose >= 0.8) b.roarNow(tmp.copy(b.head).setY(b.head.y + 1), 0xffc040); if (b.t <= 0) b.mode = 'fight';
    }
    { const open = clamp((rose - 0.76) / 0.08, 0.06, 1); for (const m of eyes) m.scale.y = open; slit.value = 0.3 - 0.2 * clamp((rose - 0.82) / 0.1, 0, 1); }
    b.facing.set(h.pos.x - body.position.x, 0, h.pos.z - body.position.z); if (b.facing.lengthSq() > 0.01) b.facing.normalize(); else b.facing.set(0, 0, 1); if (b.mode !== 'die') body.rotation.y = yawTo(b.turn, Math.atan2(b.facing.x, b.facing.z), dt, 0.35);
    if (b.mode === 'die') { body.position.y -= dt * 2; if (b.t <= 0) b.stop(); }
    body.position.x = b.centre.x; body.position.z = b.centre.z; b.head.copy(body.position); b.frame.set(b.centre.x, Math.max(b.head.y, G.world.heightAt(b.centre.x, -b.centre.z) + 3), b.centre.z);
    arms.forEach((a, i) => {
      if (!a.base.lengthSq() || b.mode === 'rise') { const an = Math.atan2(b.facing.z, b.facing.x) + 0.628 + (i / C.arms) * 6.283; a.out = an; a.base.set(b.centre.x + Math.cos(an) * 4.4, body.position.y - 2.4, b.centre.z + Math.sin(an) * 4.4); if (b.mode === 'rise') { const up = ease(clamp((rose - (0.1 + i * 0.09)) / 0.2, 0, 1)); a.tip.set(a.base.x + Math.cos(an) * 7 * up, Math.max(a.base.y, G.world.heightAt(a.base.x, -a.base.z) - 0.6 + 12 * up), a.base.z + Math.sin(an) * 7 * up); } }
      if (a.gone) return;
      a.t -= dt;
      if (a.frozen > 0) { a.frozen -= dt; }
      switch (a.state) {
        case 'tell': reach(a.tip, a.tv, tmp.copy(a.base).add(v.set(0, 14, 0)).lerp(a.mark, 0.12), dt, 0.3); if (a.t <= 0) { a.state = 'strike'; a.from.copy(a.tip); a.t = STRIKE_K; b.log('strike', 'slam'); G.audio.swing(); } break;
        case 'strike': slamPath(a.tip, a.from, a.mark, 1 - a.t / STRIKE_K); a.tv.set(0, 0, 0); if (!a.hitDone && a.t <= 0) { a.hitDone = true; G.fx.shock(a.mark, C.radius_m, 'water'); if (a.mark.distanceTo(h.pos) < C.radius_m + 1) { const res = h.damage(C.slam, a.mark, { heavy: true }); b.log('contact', 'slam', { res }); if (res === 'parried') a.frozen = h.guardFroze ? 4 : 0; } else b.log('contact', 'slam', { res: 'clear' }); a.state = 'down'; a.t = C.down_s; } break;
        case 'down': if (a.t <= 0 && a.frozen <= 0) a.state = 'idle'; break;
      }
      lay(a, i, dt);
    });
    M.instanceMatrix.needsUpdate = true;
    if (b.mode === 'fight' && live.length) { b.nextT -= dt; if (b.nextT <= 0) { const idle = live.filter((a) => a.state === 'idle'); if (idle.length) slam(idle[Math.floor(Math.random() * idle.length)]); b.nextT = rand(C.every_s[0], C.every_s[1]) * (b.phase === 3 ? 0.7 : 1); } }
    if (!live.length && !b.exposed && b.mode === 'fight') { b.exposed = true; G.ui.tip('The mantle is open. Strike it', 3); G.audio.roar(); }
    // with every arm gone it has nothing but its own bulk: it drags itself at him
    if (b.exposed && b.mode === 'fight') { b.centre.x = damp(b.centre.x, h.pos.x + 9, 0.4, dt); b.centre.z = damp(b.centre.z, h.pos.z, 0.4, dt); }
  };
  b.draw = () => {};
  const armAt = (p, reach) => { let best = null, bd = 1e9; for (const a of arms) { if (a.gone) continue; for (let k = 4; k < a.pts.length; k += 2) { const d = a.pts[k].distanceTo(p); if (d < bd && d < reach + 1.2) { bd = d; best = a; a.pos.copy(a.pts[k]); } } } return best; };
  // one target per arm, kept: a blow remembers what it hit, so a fresh object each time would land on every active frame
  const armT = (a) => a.T || (a.T = { pos: a.pos, r: a.r, onHit: (d, from, type, info) => {
    if (info && info.status && info.status.chill) { a.frozen = 4; a.state = 'down'; a.t = 4; G.fx.crust && G.fx.frostBurst(a.pos, 1.4); b.log('freeze', 'arm'); }
    a.hp -= d * (a.frozen > 0 ? C.frozen_mul : 1);
    if (a.hp <= 0 && !a.gone) { a.gone = true; G.fx.shatter(a.pos, 12, 1.3); G.audio.boom(); b.log('sever', 'arm'); G.combat.teach('sever', 'Severed', 'Frozen arms break') ; b.hurt(C.arm_hp * 0.25); }
  } });
  b.strike = (p, reach, hit) => { const a = armAt(p, reach); if (a) { hit(armT(a)); return; } if (b.head.distanceTo(p) < reach + 5) hit(b.headT); };
  b.lockPoint = (p) => { const a = armAt(p, 30); return a ? armT(a) : b.headT; };
  b.arms = arms; b.slammers = arms;
  return b;
}

// ------------------------------------------------------------------ the Cinder Colossus
export function createColossus(G, C) {
  // a body of rock masses, each lumped by the same field so its facets meet: basalt, with the fire showing through its cracks
  const lump = (r, x, y, z, sx, sy, sz) => { const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const ax = p.getX(i) / r, ay = p.getY(i) / r, az = p.getZ(i) / r, n = 1 + 0.13 * Math.sin(ax * 5.1 + ay * 2.3) * Math.sin(az * 4.3 - ay * 3.1) + 0.07 * Math.sin((ax + az) * 9.2 + ay * 7.1); p.setXYZ(i, ax * r * n * sx + x, ay * r * n * sy + y, az * r * n * sz + z); } return g; };
  const geo = mergeGeometries([lump(3.5, 0, 7.8, 0, 1.3, 1, 0.92), lump(2, 0, 11.6, 0.5, 1, 1.05, 1), lump(2.5, -5, 9, 0, 1, 0.92, 1), lump(2.5, 5, 9, 0, 1, 0.92, 1), lump(3, 0, 3.4, 0, 1.25, 1, 1), lump(1.9, -2.3, 1, 0, 1, 1.15, 1), lump(1.9, 2.3, 1, 0, 1, 1.15, 1)], false); geo.computeVertexNormals();
  const heat = { value: 1.2 }, mat = new THREE.MeshStandardMaterial({ color: 0x322620, roughness: 0.82, flatShading: true }); G.look.patch(mat, {});
  { const inner = mat.onBeforeCompile; mat.onBeforeCompile = function (s, r) { inner.call(this, s, r); s.uniforms.uHeat = heat; s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHeat;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 cq = vOcP * 0.85; float crack = abs(sin(cq.x + sin(cq.y * 1.3) * 1.7)) * abs(sin(cq.y * 0.8 + sin(cq.z * 1.1) * 1.9)) * abs(sin(cq.z * 0.9 + cq.x * 0.4)); totalEmissiveRadiance += vec3(1.0, 0.3, 0.05) * smoothstep(0.03, 0.004, crack) * uHeat * 2.6; }`); }; }
  const body = new THREE.Mesh(geo, mat); body.visible = false; body.frustumCulled = false; G.scene.add(body);
  const fistGeo = new THREE.IcosahedronGeometry(2.1, 1), fists = [-1, 1].map(() => { const m = new THREE.Mesh(fistGeo, mat); m.visible = false; m.frustumCulled = false; G.scene.add(m); return { m, pos: new THREE.Vector3(), v: new THREE.Vector3(), from: new THREE.Vector3(), rest: new THREE.Vector3(), state: 'idle', t: 0, mark: new THREE.Vector3(), hitDone: false, fresh: true }; });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffa040 }), core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), coreMat); core.visible = false; G.scene.add(core);
  // his eyes: dark until the last of the rise. One mesh for the two
  const slitEye = (s) => new THREE.SphereGeometry(0.46, 12, 8).scale(1.6, 0.5, 0.55).rotateZ(s * 0.34).translate(s * 0.82, 12, 2.3);
  const eyeM = new THREE.Mesh(mergeGeometries([slitEye(-1), slitEye(1)], false), new THREE.ShaderMaterial({ vertexShader: 'varying vec3 vN, vV; void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }', fragmentShader: 'varying vec3 vN, vV; void main() { float f = pow(max(dot(normalize(vN), normalize(vV)), 0.0), 2.2); gl_FragColor = vec4(mix(vec3(0.8, 0.14, 0.02), vec3(1.0, 0.92, 0.62), f), 1.0); }' })); body.add(eyeM);
  const b = { facing: new THREE.Vector3(0, 0, 1), fire: true }, vents = [], tmp = new THREE.Vector3(); G.fx.warmList.push(body, core, ...fists.map((f) => f.m));
  const ventDef = { radius_m: 2.6, tell_s: 0.6, last_s: 2.2, name: 'vent' };
  shell(G, C, b, () => { body.visible = true; core.visible = true; b.turn = { yaw: Math.atan2(b.facing.x, b.facing.z), yawV: 0 }; for (const f of fists) { f.m.visible = true; f.fresh = true; f.state = 'idle'; } b.nextT = 2.8; b.ventT = 1.5; b.openT = 0; vents.length = 0; for (let i = 0; i < C.vents; i++) { const a = (i / C.vents) * 6.283 + 0.6; vents.push({ p: new THREE.Vector3(b.centre.x + Math.cos(a) * 11, 0, b.centre.z + Math.sin(a) * 11), l: null, capped: false }); } }, () => { body.visible = false; core.visible = false; for (const f of fists) f.m.visible = false; });
  b.headT = { pos: new THREE.Vector3(), r: 4, onHit: (d) => { if (b.openT > 0) b.hurt(d); else { b.hurt(d * C.armour_mul); b.log('blocked', 'crust'); } } };
  function slam(f) {
    const h = G.hero; f.state = 'tell'; f.t = C.tell_s; f.mark.copy(h.pos); f.mark.y = Math.max(G.world.heightAt(h.pos.x, -h.pos.z) + 0.3, h.pos.y - 1.2); f.hitDone = false;
    G.fx.circle(f.mark, null, C.radius_m, 'water', C.tell_s + 0.1); b.log('tell', 'slam', { tell_s: C.tell_s }); G.audio.tell && G.audio.tell(false);
  }
  b.step = (dt) => {
    if (!b.active) return; const h = G.hero, P = G.combat.powers; b.t -= dt; b.cut(); const pc = b.hp / b.maxHp; b.phase = pc > 0.66 ? 1 : pc > 0.33 ? 2 : 3; b.openT = Math.max(0, b.openT - dt);
    // the bed splits and glows, he comes up through it dark, the fire climbs him, and last his eyes light and he roars
    const rise = b.risen(), floor = G.world.heightAt(b.centre.x, -b.centre.z); if (b.mode === 'rise') { if (rise < 0.8) b.dustAt(tmp.set(b.centre.x, floor + 0.6, b.centre.z), 7, dt, true); if (rise >= 0.8) b.roarNow(tmp.copy(b.head).setY(b.head.y + 4), 0xff7a30); if (b.t <= 0) b.mode = 'fight'; } if (b.mode === 'die') { body.position.y -= dt * 3; if (b.t <= 0) b.stop(); }
    if (b.mode !== 'die') body.position.set(b.centre.x, floor - 13 * (1 - ease(clamp((rise - 0.16) / 0.6, 0, 1))), b.centre.z);
    eyeM.scale.setScalar(Math.max(0.001, clamp((rise - 0.76) / 0.1, 0, 1)));
    b.facing.set(h.pos.x - body.position.x, 0, h.pos.z - body.position.z); if (b.facing.lengthSq() > 0.01) b.facing.normalize(); else b.facing.set(0, 0, 1);
    const yaw = yawTo(b.turn, Math.atan2(b.facing.x, b.facing.z), dt, 0.35), sideX = Math.cos(yaw), sideZ = -Math.sin(yaw); body.rotation.set(0, yaw, 0); b.head.copy(body.position); b.head.y += 7.8; b.frame.set(b.centre.x, Math.max(b.head.y, floor + 3), b.centre.z); b.headT.pos.copy(b.head); core.position.copy(b.head); core.scale.setScalar(b.openT > 0 ? 1.5 + Math.sin(G.time * 9) * 0.15 : 0.5); heat.value = damp(heat.value, b.mode === 'rise' ? 0.1 + rise * rise * 1.1 : b.openT > 0 ? 0.08 : 1.2 + (b.flash || 0) * 1.4, 5, dt); b.flash = Math.max(0, (b.flash || 0) - dt * 6);
    fists.forEach((f, i) => {
      // at his own sides as he turns: they were set by the Warden's heading, so they swung round the giant's head whenever the player turned. And they wake where they rest: they flew in from the middle of the map, 18.7 m in a frame
      const s = i ? 1 : -1; f.rest.copy(b.head).add(tmp.set(sideX * s * 7, -2 + Math.sin(G.time + i) * 0.8, sideZ * s * 7)); f.t -= dt;
      if (f.fresh) { f.fresh = false; f.pos.copy(f.rest); f.v.set(0, 0, 0); }
      if (f.state === 'idle') reach(f.pos, f.v, f.rest, dt, 0.24);
      if (f.state === 'tell') { reach(f.pos, f.v, tmp.copy(f.mark).addScaledVector(UP, 11), dt, 0.22); if (f.t <= 0) { f.state = 'strike'; f.from.copy(f.pos); f.t = SLAM_ARM; b.log('strike', 'slam'); G.audio.swing(); } }
      if (f.state === 'strike') { slamPath(f.pos, f.from, f.mark, 1 - f.t / SLAM_ARM); f.v.set(0, 0, 0); if (f.t <= 0 && !f.hitDone) { f.hitDone = true; G.fx.shock(f.mark, C.radius_m, 'water'); if (f.mark.distanceTo(h.pos) < C.radius_m + 1) { const res = h.damage(C.slam, f.mark, { heavy: true }); b.log('contact', 'slam', { res }); } else b.log('contact', 'slam', { res: 'clear' }); f.state = 'down'; f.t = 1.2; } }
      if (f.state === 'down' && f.t <= 0) f.state = 'idle';
      f.m.position.copy(f.pos);
    });
    if (b.mode === 'fight') {
      b.nextT -= dt; if (b.nextT <= 0) { const f = fists.find((q) => q.state === 'idle'); if (f) slam(f); b.nextT = rand(C.every_s[0], C.every_s[1]) * (b.phase === 3 ? 0.75 : 1); }
      // the vents feed the crust: each one that runs keeps it hard. Cap them all with ice and the core is open
      b.ventT -= dt;
      if (b.ventT <= 0) { b.ventT = C.vent_s + 1; for (const v of vents) { if (v.capped && !(v.l && P.lives.includes(v.l))) v.capped = false; if (!v.l || !P.lives.includes(v.l)) { v.p.y = G.world.heightAt(v.p.x, -v.p.z) + 0.2; v.l = P.spawnGeyser(v.p.clone(), ventDef, { def: ventDef, hits: new Set() }, true); v.l.capHold = C.cap_hold_s; } } }
      let cappedN = 0; for (const v of vents) { if (v.l && v.l.capped) { v.capped = true; } if (v.capped) cappedN++; if (v.l && !v.l.capped && v.l.on && v.p.distanceTo(tmp.set(h.pos.x, v.p.y, h.pos.z)) < ventDef.radius_m && !v.hurtT) { v.hurtT = 1; h.damage(C.vent_burn, v.p); } if (v.hurtT) v.hurtT = Math.max(0, v.hurtT - dt); }
      if (cappedN >= C.vents && b.openT <= 0) { b.openT = C.open_s; G.audio.boom(); G.ui.tip('The core is open. Strike it', 3); b.log('open', 'core'); for (const v of vents) v.capped = false; }
    }
  };
  b.draw = () => {};
  b.breakArmour = (s) => { if (b.openT > 0) return; b.openT = s; G.audio.boom(); G.ui.tip('The whale broke his crust. Strike the core', 3); b.log('open', 'whale'); };
  b.strike = (p, reach, hit) => { if (b.head.distanceTo(p) < reach + 6.5 || tmp.set(b.head.x, p.y, b.head.z).distanceTo(p) < reach + 4) hit(b.headT); };
  b.lockPoint = () => b.headT;
  b.vents = vents; b.slammers = fists;
  return b;
}

// The Last Seawall: the land people's terror, and the boss for anyone standing on their quays. The harbour's own breakwater walking: courses of stone on two concrete tetrapod feet, crane arms, a lighthouse for a head. Pipeline/research/WORLD_SOURCES.md: the arena and the boss are one idea (it's made of the place it stands in), and a blow comes from its body. Its lamp locks on and burns along the beam; it throws tetrapods that land where a ring has told; after each salvo it kneels to reload, and the lamp room is in reach for as long as it's down. Anywhere else, stone shrugs a blow off
export function createSeawall(G, C) {
  const box = (w, h, d, x, y, z, c, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rz) g.rotateZ(rz); g.translate(x, y, z); const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const k = 0.9 + 0.2 * ((i * 7) % 5) / 5; col[i * 3] = c[0] * k; col[i * 3 + 1] = c[1] * k; col[i * 3 + 2] = c[2] * k; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g.index ? g.toNonIndexed() : g; };
  const cyl = (r0, r1, h, x, y, z, c, seg = 12) => { const g = new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y, z).toNonIndexed(), n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n * 3; i += 3) { col[i] = c[0]; col[i + 1] = c[1]; col[i + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; };
  const STONE = [0.2, 0.19, 0.18], DARK = [0.08, 0.08, 0.08], WEED = [0.06, 0.13, 0.08], WHITE = [0.7, 0.69, 0.65], RED = [0.5, 0.06, 0.05], parts = [];
  // the wall: courses, each a little different, weed along its waterline, a walkway along the top
  for (let i = 0; i < 6; i++) { const w = 11 - i * 0.5 + (i % 2) * 0.5, c = i < 2 ? WEED : i % 2 ? STONE : [0.15, 0.145, 0.14]; parts.push(box(w, 1.5, 4.2 - i * 0.2, (i % 3 - 1) * 0.16, 6 + i * 1.5, 0, c)); }
  parts.push(box(10, 0.5, 4.6, 0, 15.1, 0, DARK)); for (let i = -2; i <= 2; i++) parts.push(box(1.1, 0.8, 0.9, i * 2.1, 15.7, 2, STONE), box(1.1, 0.8, 0.9, i * 2.1, 15.7, -2, STONE));
  // the lighthouse: white and red, a gallery, the lamp room
  parts.push(cyl(1.9, 1.5, 2, 0, 16.4, 0, WHITE), cyl(1.5, 1.3, 2, 0, 18.4, 0, RED), cyl(1.3, 1.15, 2, 0, 20.4, 0, WHITE), cyl(1.9, 1.9, 0.3, 0, 21.5, 0, DARK), cyl(1.0, 1.0, 1.6, 0, 22.4, 0, [0.14, 0.13, 0.12], 8), cyl(1.4, 0.08, 1.3, 0, 23.8, 0, RED));
  const geo = mergeGeometries(parts, false); geo.computeVertexNormals(); const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }); G.look.patch(mat, {});
  const body = new THREE.Mesh(geo, mat), root = new THREE.Group(); body.frustumCulled = false; root.add(body); root.visible = false; G.scene.add(root);
  const tetra = (s) => { const g = []; for (const [x, y, z] of [[0, 1, 0], [0.94, -0.33, 0], [-0.47, -0.33, 0.82], [-0.47, -0.33, -0.82]]) { const c = new THREE.ConeGeometry(0.75 * s, 2.2 * s, 7).toNonIndexed(); c.lookAt && 0; const q = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(x, y, z).normalize()); c.translate(0, 1.1 * s, 0); c.applyQuaternion(q); const n = c.attributes.position.count, col = new Float32Array(n * 3).fill(0.26); c.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.push(c); } const m = mergeGeometries(g, false); m.computeVertexNormals(); return m; };
  const footG = tetra(2.5), feet = [-1, 1].map((s) => { const m = new THREE.Mesh(footG, mat); m.position.set(s * 3.6, 2.6, 0); root.add(m); return m; });
  const armG = mergeGeometries([box(1.3, 8.4, 1.3, 0, -3.8, 0, DARK), box(2, 2, 2, 0, 0, 0, STONE)], false); armG.computeVertexNormals(); const arms = [-1, 1].map((s) => { const m = new THREE.Mesh(armG, mat); m.position.set(s * 5.8, 13, 0); root.add(m); return m; });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 }), lamp = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), lampMat); lamp.position.set(0, 22.4, 0); root.add(lamp);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 60, 12, 1, true).translate(0, -30, 0).rotateX(Math.PI / 2 * -1), beamMat); beam.visible = false; beam.frustumCulled = false; G.scene.add(beam);
  const rocks = [0, 1, 2].map(() => { const m = new THREE.Mesh(tetra(1), mat); m.visible = false; m.frustumCulled = false; G.scene.add(m); return { m, on: false, p: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, T: 1.2, rest: 0 }; });
  const b = { facing: new THREE.Vector3(0, 0, 1) }, tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(); G.fx.warmList.push(body, ...feet, ...arms, lamp);
  shell(G, C, b, () => { root.visible = true; b.nextT = 2.4; b.st = 'walk'; b.downT = 0; b.salvo = 0; b.walk = 0; b.turn = { yaw: Math.atan2(b.facing.x, b.facing.z), yawV: 0 }; root.rotation.y = b.turn.yaw; beam.visible = false; b.centre.copy(C.at || G.hero.pos); b.centre.y = G.world.heightAt(b.centre.x, -b.centre.z); root.position.copy(b.centre); }, () => { root.visible = false; beam.visible = false; rocks.forEach((r) => { r.on = false; r.m.visible = false; }); });
  b.headT = { pos: new THREE.Vector3(), r: 2.2, onHit: (d) => { if (b.downT > 0) { b.hurt(d); lampMat.color.setHex(0xff7040); } else { b.hurt(d * C.armour_mul); b.log('blocked', 'stone'); } } };
  function toss() { const r = rocks.find((q) => !q.on); if (!r) return; const h = G.hero; r.on = true; r.t = 0; r.T = C.toss_s; r.rest = 0; r.m.visible = true; arms[b.salvo % 2].getWorldPosition(r.from); r.to.copy(h.pos).addScaledVector(h.vel, 0.45); r.to.y = Math.max(G.world.heightAt(r.to.x, -r.to.z), 0) + 0.3; G.fx.circle(r.to, null, C.radius_m, 'water', C.toss_s + 0.1); b.log('tell', 'tetrapod', { tell_s: C.toss_s }); G.audio.tell && G.audio.tell(false); G.audio.swing(); }
  b.step = (dt) => {
    if (!b.active) return; const h = G.hero; b.t -= dt; b.cut(); const pc = b.hp / b.maxHp; b.phase = pc > 0.66 ? 1 : pc > 0.33 ? 2 : 3;
    const rise = b.risen(), floor = Math.max(G.world.heightAt(b.centre.x, -b.centre.z), 0.2); root.position.x = b.centre.x; root.position.z = b.centre.z; b.facing.set(h.pos.x - b.centre.x, 0, h.pos.z - b.centre.z); const dist = b.facing.length(); if (dist > 0.01) b.facing.multiplyScalar(1 / dist);
    if (b.mode === 'rise') { root.position.y = floor - 22 * (1 - ease(clamp(rise * 1.2, 0, 1))); if (rise >= 0.8) b.roarNow(tmp.copy(b.centre).setY(floor + 20), 0xfff0b0); } else if (b.mode === 'die') { root.position.y -= dt * 4; root.rotation.z += dt * 0.16; if (b.t <= 0) b.stop(); }
    if (b.mode === 'rise' && b.t <= 0) { b.mode = 'fight'; G.audio.boom(); }
    if (b.mode === 'fight') {
      const k = b.downT > 0 ? ease(clamp((b.dropAt - b.downT) / 0.5, 0, 1)) * ease(clamp(b.downT / 0.5, 0, 1)) : 0; root.position.y = floor - k * 11; b.downT = Math.max(0, b.downT - dt); if (b.downT <= 0) lampMat.color.setHex(0xfff2b0);
      root.rotation.y = yawTo(b.turn || (b.turn = { yaw: root.rotation.y, yawV: 0 }), Math.atan2(b.facing.x, b.facing.z), dt, 0.45);
      if (b.st === 'walk') {
        b.walk += dt; if (dist > C.stand_m) { b.centre.addScaledVector(b.facing, C.walk_mps * dt); root.position.x = b.centre.x; root.position.z = b.centre.z; feet.forEach((f, i) => { f.position.y = 2.6 + Math.max(0, Math.sin(b.walk * 2.2 + i * Math.PI)) * 1.4; f.position.z = Math.sin(b.walk * 2.2 + i * Math.PI) * 2.2; }); }
        b.nextT -= dt; if (b.nextT <= 0 && b.downT <= 0) { if (b.salvo >= C.salvo + (b.phase - 1)) { b.salvo = 0; b.dropAt = b.downT = C.down_s; b.nextT = C.down_s + 1; b.log('open', 'lamp'); G.ui.tip('It kneels. Strike the lamp', 2.6); G.audio.boom(); } else if (Math.random() < 0.45) { b.st = 'lock'; b.t2 = C.lock_s; b.log('tell', 'beam', { tell_s: C.lock_s }); G.audio.tell && G.audio.tell(true); beam.visible = true; } else { toss(); b.salvo++; b.nextT = C.every_s / (b.phase > 2 ? 1.4 : 1); } }
      } else if (b.st === 'lock') { b.t2 -= dt; lamp.getWorldPosition(tmp); beam.position.copy(tmp); tmp2.copy(h.pos); beam.lookAt(tmp2); beamMat.opacity = 0.16 + 0.34 * (1 - b.t2 / C.lock_s); if (b.t2 <= 0) { b.st = 'burn'; b.t2 = 0.34; tmp2.sub(tmp).normalize(); b.dir = tmp2.clone(); b.hit = false; beamMat.opacity = 0.6; G.audio.boom(); }
      } else if (b.st === 'burn') { b.t2 -= dt; lamp.getWorldPosition(tmp); tmp2.subVectors(h.pos, tmp); const al = tmp2.dot(b.dir), off = tmp2.addScaledVector(b.dir, -al).length(); if (!b.hit && al > 0 && off < 2.2) { b.hit = true; const res = h.damage(C.beam, tmp, { heavy: true, unblockable: true }); G.combat.log.push({ t: G.time, type: 'contact', foe: 'seawall', blow: 'beam', res }); } if (b.t2 <= 0) { beam.visible = false; b.st = 'walk'; b.nextT = C.every_s; b.salvo++; } }
    }
    for (const r of rocks) { if (!r.on) continue; if (r.rest > 0) { r.rest -= dt; if (r.rest <= 0) { r.on = false; r.m.visible = false; } continue; } r.t += dt; const q = clamp(r.t / r.T, 0, 1); r.p.lerpVectors(r.from, r.to, q); r.p.y += Math.sin(q * Math.PI) * 14; r.m.position.copy(r.p); r.m.rotation.x += dt * 6; r.m.rotation.y += dt * 4; if (q >= 1) { r.rest = 2.2; G.fx.shock(r.to, C.radius_m, 'water'); G.audio.boom(); if (!(G.settings && G.settings.shake === false)) G.shake(0.3); if (r.to.distanceTo(h.pos) < C.radius_m + 0.6) { const res = h.damage(C.tetrapod, r.to, { heavy: true }); G.combat.log.push({ t: G.time, type: 'contact', foe: 'seawall', blow: 'tetrapod', res }); } } }
    lamp.getWorldPosition(b.head); b.frame.copy(b.head); b.headT.pos.copy(b.head);
  };
  b.draw = () => {};
  b.strike = (p, reach, hit) => { if (b.head.distanceTo(p) < reach + 3.2 || tmp.set(b.centre.x, p.y, b.centre.z).distanceTo(p) < reach + 6) hit(b.headT); };
  b.lockPoint = () => b.headT;
  return b;
}
