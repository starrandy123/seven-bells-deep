// The Emberkin: fire elementals who fly on jets at the palms and the soles (EPIC V1, V2, V5). No weapon: fists, kicks and fire. The rules of a fight stay in enemies.js (tokens, tells, blows, what a hit does);
// this file holds what's theirs: a body that burns, flight that leans into what the jets are doing, fire bolts that really fly, and what water does to them.
// Flight is a thrust and not a slide: the body's axis stands along the push the jets must give, which is gravity, plus what he's asking of his speed, plus the drag of going fast. So he leans into a turn, lies flat at speed and rears back to stop, with no state saying so.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { FLAG } from './config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const Y = new THREE.Vector3(0, 1, 0);
const GR = 9.81, DRAG = 0.03;       // at 30 m/s the jets lie 70° over, at 12 m/s 24°: the drag is what lays him flat

// what burns on a body: cells of slag, the seams between them molten, hottest where the mask says, each seam's light moving. In object space, so no texture memory and no seam at a UV edge
const BURN = {
  vertexDecl: 'attribute vec4 _mask; uniform vec4 uEmS; varying vec4 vEM; varying vec3 vEO;\n',
  vertexBend: 'vEO = position*uEmS.w + uEmS.xyz; vEM = _mask;',
  fragmentPars: /* glsl */`
    uniform float uHeat, uEmT; varying vec4 vEM; varying vec3 vEO; vec3 emGlow;
    vec3 emH(vec3 p) { p = fract(p*vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx)*p.zyx); }
    vec3 emCell(vec3 x) {
      vec3 n = floor(x), f = x - n, b = step(.5, f) - 1.0; float F1 = 9.0, F2 = 9.0, id = 0.0;
      for (int k = 0; k < 2; k++) for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
        vec3 g = b + vec3(float(i), float(j), float(k)), h = emH(n + g), r = g + h - f; float d = dot(r, r);
        if (d < F1) { F2 = F1; F1 = d; id = h.x; } else if (d < F2) F2 = d;
      }
      return vec3(sqrt(F1), sqrt(F2), id);
    }`,
  albedo: /* glsl */`
    { vec3 p = vEO*vec3(10.0, 8.0, 10.0); p += .32*sin(p.yzx*1.4); vec3 c = emCell(p);
      float seam = c.y - c.x, line = 1.0 - smoothstep(.02, .15, seam), halo = 1.0 - smoothstep(.04, .62, seam);
      float run = .62 + .38*sin(vEO.y*5.0 - uEmT*2.4 + c.z*6.283), hot = clamp(vEM.r, 0.0, 1.0)*uHeat;
      float T = line*(.34 + .66*hot)*run*smoothstep(0.0, .22, uHeat);
      diffuseColor.rgb *= mix(vec3(.030, .024, .024), vec3(.095, .074, .066), c.z*c.z)*(1.0 - .55*line);
      vec3 ramp = mix(vec3(.86, .10, .012), vec3(1.0, .40, .05), clamp(T*1.7, 0.0, 1.0)); ramp = mix(ramp, vec3(1.0, .86, .46), clamp(T*3.0 - 1.5, 0.0, 1.0));
      emGlow = ramp*(T*T*7.0 + halo*hot*.42) + vec3(1.0, .62, .22)*vEM.g*3.4*(.3 + .7*uHeat) + vec3(1.0, .34, .05)*pow(hot, 3.0)*1.1; }`,
  glow: 'ocGlow = emGlow;',
};

export async function createEmber(G, { foeMaterial, D }) {
  const phone = G.tier === 'phone', Q = D.ember, H = Q.heat, MAX = phone ? 3 : 4, time = { value: 0 };
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('assets/ember.glb');
  let shared = null, geo = null; const packed = new THREE.Vector4(0, 0, 0, 1);       // the packer stores positions as whole numbers with a scale on the node: the fire's pattern is in metres
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => { if (o.isMesh) { if (!shared) { const m = o.matrixWorld.elements; packed.set(m[12], m[13], m[14], Math.hypot(m[0], m[1], m[2])); } shared = shared || o.material; geo = geo || o.geometry; } });
  for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) { if (shared[k]) shared[k].dispose(); shared[k] = null; }
  shared.vertexColors = true; shared.roughness = 0.82; shared.metalness = 0; shared.emissive.setRGB(0, 0, 0); shared.color.setRGB(1, 1, 1); shared.envMapIntensity = 0.5;
  geo.deleteAttribute('uv');
  G.look.patch(shared, { skinned: true, key: 'ember', uniforms: { uEmT: time, uHeat: { value: 1 }, uEmS: { value: packed } }, ...BURN });
  // a blow in the air leaves his legs to the flight: his upper body takes the clip and the jets keep holding him. On the ground, or for a kick, the whole body does
  const UPPER = /^(spine_|neck|head|clav_|arm_|fore_|hand_)/, AIR = /^e_(blast|cross|hook|jab)$/;
  for (const c of gltf.animations) if (AIR.test(c.name)) c.tracks = c.tracks.filter((t) => UPPER.test(t.name));
  const pool = [];
  for (let i = 0; i < MAX; i++) {
    const model = SkeletonUtils.clone(gltf.scene), g = new THREE.Group(); g.add(model); g.visible = false; G.scene.add(g);
    const mat = foeMaterial(shared, { uHeat: { value: 1 }, uEmT: time, uEmS: { value: packed } }), skinned = [];
    model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = mat; if (o.isSkinnedMesh) skinned.push(o); } });
    if (G.look.addOutline) for (const o of skinned) G.look.addOutline(o, { warm: true });
    const mixer = new THREE.AnimationMixer(model), acts = {};
    for (const c of gltf.animations) { const a = acts[c.name] = mixer.clipAction(c); if (AIR.test(c.name)) a.weight = 8; }
    const bone = (n) => model.getObjectByName(n);
    pool.push({ g, mixer, acts, busy: false, mat, shield: null, tip: null, jets: [[bone('fore_R'), bone('hand_R')], [bone('fore_L'), bone('hand_L')], [bone('shin_R'), bone('foot_R')], [bone('shin_L'), bone('foot_L')]], head: bone('head'), chest: bone('spine_3') });
  }
  for (const s of pool) s.g.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) { o.skeleton.computeBoneTexture(); G.renderer.initTexture(o.skeleton.boneTexture); } });

  const shots = []; for (let i = 0; i < (phone ? 6 : 9); i++) shots.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, from: null, dmg: 0, back: false, cued: false, trailT: 0 });
  let X = null;      // what enemies.js lends: takeToken, dropToken, beginTell, tellStep, beginStrike, endTell, blowLands, playClip, free, spawn, count
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), acc = new THREE.Vector3(), want = new THREE.Vector3(), push = new THREE.Vector3(), viewX = new THREE.Vector3(), qT = new THREE.Quaternion(), qY = new THREE.Quaternion();
  const FIRE = new THREE.Color(1.0, 0.42, 0.07), HOT = new THREE.Color(1.0, 0.72, 0.28), SMOKE = new THREE.Color(0.10, 0.09, 0.09), STEAM = new THREE.Color(0.82, 0.86, 0.9);
  const groundAt = (x, z) => G.world.heightAt(x, -z);
  const floorAt = (x, z) => Math.max(groundAt(x, z), 0);
  const probe = { x: 0, y: 0, z: 0 };
  const fx = () => G.fx, A = () => G.audio;

  // ------------------------------------------------------------------ flight: ask for a speed, get it through the jets
  function aim(e, w, most, dt) {
    acc.subVectors(w, e.vel).multiplyScalar(3.2); const l = acc.length(); if (l > most) acc.multiplyScalar(most / l);
    e.vel.addScaledVector(acc, dt * e.slow); e.ask.lerp(acc, 1 - Math.exp(-10 * dt));
  }
  function faceHim(e, dt, k = 7) { const h = G.hero.pos, y = Math.atan2(h.x - e.pos.x, h.z - e.pos.z); e.heading = wrap(e.heading + wrap(y - e.heading) * (1 - Math.exp(-k * dt))); }
  function faceGoing(e, dt) { if (e.vel.lengthSq() > 1) { const y = Math.atan2(e.vel.x, e.vel.z); e.heading = wrap(e.heading + wrap(y - e.heading) * (1 - Math.exp(-5 * dt))); } }
  // how high he holds: over the water, or over the land under him, and over the Warden wherever he's standing
  const heightFor = (e) => { const f = floorAt(e.pos.x, e.pos.z), hp = G.hero.pos.y; return Math.max(f + Q.flight.hover_m, hp + Q.flight.over_m); };
  function goto(e, x, y, z, speed, most, dt) {
    want.set(x - e.pos.x, y - e.pos.y, z - e.pos.z); const d = want.length() || 1; want.multiplyScalar(Math.min(speed, d * 1.3) / d); aim(e, want, most, dt); return d;
  }

  // ------------------------------------------------------------------ one flyer's head: comes in, rings him, picks its moment. Tokens and tells are the same as every foe's
  function brain(e, dt) {
    const h = G.hero, F = e.def, dist = e.pos.distanceTo(h.pos), Fl = Q.flight;
    e.t -= dt; if (e.state !== 'dead') e.heat = Math.min(1, e.heat + (e.doused > 0 ? 0 : H.regain_per_s) * dt);
    if (e.doused > 0) { e.doused -= dt; if (e.doused <= 0 && e.hp > 0) relight(e); else { fallStep(e, dt); return; } }
    switch (e.state) {
      case 'swimTo': { // in from the horizon, flat out, and rearing up to stop short of him
        faceGoing(e, dt); const b = v1.subVectors(h.pos, e.pos); b.y = 0; const flat = b.length() || 1, s = flat > Fl.brake_m ? Fl.boost_mps : Fl.cruise_mps;
        goto(e, h.pos.x, heightFor(e), h.pos.z, s, Fl.accel, dt);
        if (flat < Fl.ring_m + 8) { e.state = 'circle'; e.t = rand(F.wait_s[0], F.wait_s[1]) + 2.2; e.ang = Math.atan2(e.pos.z - h.pos.z, e.pos.x - h.pos.x); }
        break;
      }
      case 'circle': {
        faceHim(e, dt); const R = e.ring = damp(e.ring || Fl.ring_m, Fl.ring_m + Math.sin(G.time * 0.31 + e.phase) * 3, 1, dt), sp = Fl.ring_mps; e.ang += (e.circleDir * sp / R) * dt;
        goto(e, h.pos.x + Math.cos(e.ang) * R, heightFor(e) + Math.sin(G.time * 0.8 + e.phase) * 0.8, h.pos.z + Math.sin(e.ang) * R, sp + 6, Fl.accel, dt);
        if (dist > 60) e.state = 'swimTo';
        if (e.t <= 0) { if (X.takeToken(e)) begin(e); else e.t = 0.4; }
        break;
      }
      case 'tell': {
        faceHim(e, dt, 9); want.set(0, 0, 0); if (e.blow.land) want.y = 0.6; aim(e, want, Fl.accel * 0.7, dt);
        if (X.tellStep(e, dt)) { X.beginStrike(e); strikeBegins(e); }
        break;
      }
      case 'strike': {
        const b = e.blow; e.clock += dt;
        if (b.burst) {
          if (b.pass_mps) { want.copy(e.passDir).multiplyScalar(b.pass_mps); want.y = (heightFor(e) - e.pos.y) * 1.2; aim(e, want, Fl.accel, dt); faceGoing(e, dt); } else { want.set(0, 0, 0); aim(e, want, Fl.accel, dt); faceHim(e, dt, 9); }
          if (e.shotsLeft > 0 && (e.gapT -= dt) <= 0) { e.gapT = b.gap_s; e.shotsLeft--; bolt(e, b); }
          if (e.clock >= b.strike_s && e.shotsLeft <= 0) { e.state = 'recover'; e.clock = 0; }
        } else if (b.land) {
          goto(e, e.spot.x, e.spot.y, e.spot.z, b.lunge_mps, Fl.accel * 1.6, dt); faceHim(e, dt, 9);
          if (e.pos.distanceTo(e.spot) < 1.2 || e.clock > 2.2) touchDown(e, b);
        } else {
          v1.copy(h.pos); v1.y = Math.max(h.pos.y + 0.4, -6); goto(e, v1.x, v1.y, v1.z, b.lunge_mps, Fl.accel * 2.2, dt); faceHim(e, dt, 12);
          if (!e.hitDone && dist < b.reach_m + 0.5) { X.blowLands(e, b, e.pos); if (e.state === 'strike') { e.state = 'recover'; e.clock = 0; } }
          if (e.state === 'strike' && e.clock >= b.strike_s) { e.state = 'recover'; e.clock = 0; }
        }
        break;
      }
      case 'recover': {
        const b = e.blow; e.clock += dt; want.set(0, 0, 0); if (b && !b.burst) { v1.subVectors(e.pos, h.pos); v1.y = 0; v1.normalize(); want.copy(v1).multiplyScalar(9); want.y = 4; } aim(e, want, Fl.accel * 0.6, dt); faceHim(e, dt);
        if (!b || e.clock >= b.recover_s) back(e);
        break;
      }
      case 'landed': {
        e.vel.multiplyScalar(Math.exp(-8 * dt)); e.ask.set(0, 0, 0); faceHim(e, dt, 4); if (e.t <= 0) { e.state = 'takeoff'; e.t = 0.5; X.dropToken(e); if (e.cur) e.cur.fadeOut(0.2); e.cur = null; A().boom && 0; }
        break;
      }
      case 'takeoff': want.set(0, Fl.climb_mps, 0); aim(e, want, Fl.accel, dt); faceHim(e, dt); if (e.t <= 0) back(e); break;
      case 'stun': e.vel.multiplyScalar(Math.exp(-3 * dt)); e.ask.multiplyScalar(0.8); if (e.t <= 0) back(e); break;
      case 'dead': fallStep(e, dt); if (e.t <= 0) X.free(e); break;
    }
    fly(e, dt);
  }
  function back(e) { X.dropToken(e); X.endTell(e); e.state = 'circle'; e.t = rand(e.def.wait_s[0], e.def.wait_s[1]); if (e.cur) e.cur.fadeOut(0.18); e.cur = null; }
  // which blow: from the air he shoots; a swoop comes when he's near; a Warden in the water is only reached by going in after him; on land he comes down
  function begin(e) {
    const h = G.hero, B = e.def.blows, by = (id) => B.find((b) => b.id === id), under = h.pos.y < -2.5, r = Math.random();
    if (under) { if (h.pos.y > -Q.flight.dive_m && r < 0.7) return X.beginTell(e, by('swoop')); e.t = 1.2; X.dropToken(e); return; }
    if (groundAt(h.pos.x, h.pos.z) > 0.6 && r < 0.3) { const a = Math.random() * 6.283; e.spot = (e.spot || new THREE.Vector3()).set(h.pos.x + Math.cos(a) * 7, 0, h.pos.z + Math.sin(a) * 7); e.spot.y = groundAt(e.spot.x, e.spot.z) + 1.0; if (e.spot.y > 1.5) return X.beginTell(e, by('slam')); }
    X.beginTell(e, by(r < 0.45 ? 'bolt' : r < 0.75 ? 'strafe' : 'swoop'));
  }
  function strikeBegins(e) {
    const b = e.blow; if (b.burst) { e.shotsLeft = b.burst; e.gapT = 0; if (b.pass_mps) { e.passDir = (e.passDir || new THREE.Vector3()).subVectors(G.hero.pos, e.pos); e.passDir.y = 0; e.passDir.normalize(); } }
    if (!b.burst && !b.land && b.clip === 'e_kick') A().swing();
  }
  function touchDown(e, b) {
    e.pos.copy(e.spot); e.vel.set(0, 0, 0); e.ask.set(0, 0, 0); e.state = 'landed'; e.t = b.hold_s; e.onGround = true; X.playClip(e, 'land', 0.08, true);
    fx().ring && fx().ring(v1.set(e.pos.x, e.spot.y - 0.9, e.pos.z), b.radius_m, 0.5, 0xff8a30, Y); fx().silt(v1, 2.4, true); A().boom(); G.fx.punch && G.fx.punch(Y, 0.3);
    const h = G.hero; if (h.pos.distanceTo(e.pos) < b.radius_m) { const res = h.damage(b.damage, e.pos, { heavy: true, unblockable: true }); G.combat.log.push({ t: G.time, type: 'contact', foe: e.kind, blow: b.id, res }); }
    G.combat.log.push({ t: G.time, type: 'landed', foe: e.kind });
  }

  // what the jets are giving, for the body and the flame: the ask, gravity, and the drag at this speed
  function fly(e, dt) {
    const sp = e.vel.length(); push.copy(e.ask); push.y += GR; if (sp > 1) push.addScaledVector(e.vel, DRAG * sp);
    const thrust = push.length() / GR; push.normalize();
    const was = e.up; if (was.dot(push) < 0.999) { const a = was.angleTo(push), most = Q.flight.turn_rad * dt; was.lerp(push, Math.min(1, most / Math.max(a, 1e-4))).normalize(); }
    e.thrust = damp(e.thrust, clamp(thrust, 0.5, 4), 9, dt);
    const inWater = e.pos.y < 0.3;
    if (inWater && !e.wetNow) { e.wetNow = true; hissAt(e.pos, 2.2); fx().sheet && fx().sheet(v1.copy(e.pos).setY(0), 2, 0); G.combat.log.push({ t: G.time, type: 'hiss', foe: e.kind }); }
    if (!inWater) e.wetNow = false;
    if (inWater) { e.vel.multiplyScalar(Math.exp(-Q.flight.water_drag * dt)); e.heat = Math.max(0, e.heat - H.sea_per_s * dt); if ((e.steamT = (e.steamT || 0) - dt) <= 0) { e.steamT = 0.09; steam(e.pos, 1, 1.1); } if (e.heat <= 0) douse(e); }
  }
  function fallStep(e, dt) { e.up.lerp(Y, 1 - Math.exp(-2 * dt)).normalize(); e.ask.set(0, 0, 0); e.thrust = damp(e.thrust, 0, 8, dt); if ((e.steamT = (e.steamT || 0) - dt) <= 0) { e.steamT = 0.22; v1.copy(e.pos); v1.y += 0.5; if (e.state === 'dead' || e.pos.y < 2) steam(v1, 1, 0.6); } }

  // ------------------------------------------------------------------ the world's rules for a body in the air: solids stop him, what's fallen falls, the sea takes him in
  function keepOut(e, dt) {
    const fallen = e.doused > 0 || e.hp <= 0 || e.frozen > 0 || e.launched > 0, g = groundAt(e.pos.x, e.pos.z);
    probe.x = e.pos.x; probe.y = -e.pos.z; probe.z = e.pos.y;
    if (G.world.collide(probe, e.r * 0.8) && Number.isFinite(probe.x + probe.y + probe.z)) { e.pos.set(probe.x, probe.z, -probe.y); e.vel.multiplyScalar(0.6); }
    if (fallen) {
      if (e.pos.y > 0.2) e.vel.y -= Q.flight.fall_g * dt; else if (e.pos.y < -0.2) e.vel.y = damp(e.vel.y, 0.5, 3, dt);
      if (g > 0 && e.pos.y < g + 1.0) { if (e.vel.y < -6) { fx().silt(v1.copy(e.pos), 1.6, true); A().hit(true); } e.pos.y = g + 1.0; e.vel.multiplyScalar(0.3); e.vel.y = 0; }
      else if (g <= 0 && e.pos.y < -1.4) e.pos.y = -1.4;
      if (!e.splashed && g <= 0 && e.pos.y < 0.3) { e.splashed = true; hissAt(e.pos, 3); fx().sheet && fx().sheet(v1.copy(e.pos).setY(0), 3, 0); A().splash(); e.vel.multiplyScalar(0.25); }
      return;
    }
    e.splashed = false;
    const low = g > 0 ? g + 0.9 : (e.state === 'strike' && e.blow && !e.blow.burst ? -Q.flight.dive_m : 0.9); if (e.pos.y < low) { e.pos.y = low; e.vel.y = Math.max(0, e.vel.y); }
  }

  // ------------------------------------------------------------------ fire: a bolt flies, leaves its trail, and meets something
  function bolt(e, b) {
    const s = shots.find((x) => !x.on); if (!s) return; const h = G.hero, side = e.nextHand = (e.nextHand || 0) ^ 1, hand = e.slot.jets[side][1];
    hand.getWorldPosition(s.p); s.on = true; s.back = false; s.cued = false; s.from = e; s.dmg = b.damage; s.t = 3.2; s.trailT = 0; s.blow = b.id;
    v1.copy(h.pos); v1.y = Math.max(h.pos.y + 0.3, 0.3); const l = s.p.distanceTo(v1) / b.speed_mps; v1.addScaledVector(h.vel, l * b.lead); s.v.subVectors(v1, s.p).normalize().multiplyScalar(b.speed_mps);
    fx().sparks(s.p, 6, 0xffa040, 5); A().fwoosh && A().fwoosh(); G.combat.log.push({ t: G.time, type: 'bolt', foe: e.kind, blow: b.id });
  }
  function burst(p, n, k = 1) {
    const f = fx(); f.sparks(p, n, 0xffa040, 9 * k); f.ring(p.clone(), 1.6 * k, 0.28, 0xff7a22, v1.subVectors(G.camera.position, p).normalize().clone());
    f.sp('burst', p, 1.1 * k, 0.24, HOT, { s0: 0.5 * k, s1: 1.4 * k, hot: 1, add: 0.7, rot: Math.random() * 6.28 });
    for (let i = 0; i < 3; i++) { v1.set(p.x + rand(-0.4, 0.4), p.y + rand(-0.4, 0.4), p.z + rand(-0.4, 0.4)); f.sp('smoke', v1, 0.7 * k, 0.9, SMOKE, { s0: 0.4 * k, s1: 1.4 * k, a: 0.5, add: 0, hot: 0, vy: 1.2, drag: 1, rot: Math.random() * 6.28 }); }
  }
  function hissAt(p, k) { steam(p, 6, k); A().hiss && A().hiss(Math.min(1, k / 3)); }
  function steam(p, n, k) { const f = fx(); for (let i = 0; i < n; i++) { v1.set(p.x + rand(-0.5, 0.5) * k, Math.max(p.y, 0.1) + rand(0, 0.5) * k, p.z + rand(-0.5, 0.5) * k); f.sp('smoke', v1, k, rand(0.8, 1.4), STEAM, { s0: 0.3 * k, s1: 1.3 * k, a: 0.55, add: 0.1, hot: 0, vy: rand(1.4, 2.6), vx: rand(-0.6, 0.6), vz: rand(-0.6, 0.6), drag: 0.8, rot: Math.random() * 6.28, spin: rand(-1, 1) }); } }
  function stepShots(dt) {
    const h = G.hero;
    for (const s of shots) {
      if (!s.on) continue; s.t -= dt; s.p.addScaledVector(s.v, dt); const dist = s.p.distanceTo(h.pos), sp = s.v.length() || 1; let done = s.t <= 0;
      if (!s.back && !s.cued && dist / sp < 0.42 && h.pos.y > -1.6) { s.cued = true; G.ui.cue('parry'); }
      if ((s.trailT -= dt) <= 0) { s.trailT = 0.03; fx().sp('dot', s.p, 0.42, 0.26, FIRE, { s0: 0.42, s1: 0.1, hot: 0.7, add: 0.8 }); if (Math.random() < 0.35) fx().sp('smoke', s.p, 0.3, 0.6, SMOKE, { s0: 0.22, s1: 0.6, a: 0.28, add: 0, hot: 0, rot: Math.random() * 6.28 }); }
      if (s.back) { const o = s.from; if (o && o.hp > 0 && s.p.distanceTo(o.pos) < 1.9) { o.onHit(s.dmg * 3, s.p, 'bolt', { knock: 8, stun: 1.2, poise: 40 }); burst(s.p, 14); A().boom(); done = true; } }
      else if (dist < 1.5) {
        const res = h.damage(s.dmg, s.p); G.combat.log.push({ t: G.time, type: 'contact', foe: 'emberkin', blow: s.blow, res });
        if (res === 'parried') { s.back = true; s.t = 2; if (s.from) { v1.subVectors(s.from.pos, s.p).normalize(); s.v.copy(v1).multiplyScalar(sp * 1.25); } burst(s.p, 8, 0.7); }
        else if (res !== 'dodged' && res !== 'miss') { burst(s.p, 14); done = true; }
      }
      if (!done && s.p.y < 0) { hissAt(v1.copy(s.p).setY(0.1), 1.1); fx().ring(v2.copy(s.p).setY(0.05), 1.8, 0.4, 0xdff4ff, Y); A().splash(); done = true; }
      if (!done) { const g = groundAt(s.p.x, s.p.z); if (s.p.y < g) { burst(s.p, 12); done = true; } }
      if (done) s.on = false;
    }
  }
  function drawShots() {
    const cam = G.camera.position;
    for (const s of shots) {
      if (!s.on) continue; const len = s.v.length() || 1; v1.copy(s.v).multiplyScalar(-1 / len); viewX.subVectors(cam, s.p).normalize().cross(v1).normalize();
      const L = 1.0, W = 0.34; G.fx.now('flame', s.p.x + v1.x * L, s.p.y + v1.y * L, s.p.z + v1.z * L, viewX.x * W, viewX.y * W, viewX.z * W, v1.x * -L, v1.y * -L, v1.z * -L, FIRE, 1, 0.9, 0.6);
      G.fx.ball(s.p, 0.5, HOT);
    }
  }

  // ------------------------------------------------------------------ water against fire (V5): what a hit of water does. Each is one line of combat.json `ember.heat`
  function struck(e, info) {
    const wet = info.element === 'water' || (info.status && info.status.soak), cold = info.element === 'ice' || (info.status && info.status.chill);
    if (!wet && !cold) return; e.heat = Math.max(0, e.heat - (wet ? H.water : H.ice)); v2.copy(e.pos); v2.y += 0.4; steam(v2, wet ? 5 : 3, 0.9); A().hiss && A().hiss(0.5); G.combat.log.push({ t: G.time, type: 'quench', foe: e.kind, heat: +e.heat.toFixed(2) });
    if (e.heat <= 0.01) douse(e);
  }
  function douse(e) {
    if (e.doused > 0 || e.hp <= 0) return; e.doused = H.doused_s; X.dropToken(e); X.endTell(e); e.state = 'stun'; e.t = H.doused_s; e.heat = 0; steam(e.pos, 10, 1.6); A().hiss && A().hiss(1); X.playClip(e, 'fall', 0.2, false);
    G.combat.teach('doused', 'Doused', 'Water puts them out. Strike now'); G.combat.log.push({ t: G.time, type: 'doused', foe: e.kind }); e.ask.set(0, 0, 0);
  }
  function relight(e) {
    e.doused = 0; e.heat = H.relight; e.state = 'takeoff'; e.t = 0.7; if (e.cur) e.cur.fadeOut(0.18); e.cur = null; burst(v1.copy(e.pos), 18, 1.5); A().boom(); G.combat.log.push({ t: G.time, type: 'relit', foe: e.kind });
  }
  function died(e, broken) {
    e.t = broken ? 0.05 : 3.0; e.doused = 0; e.heat = 0; burst(v1.copy(e.pos), 22, 1.8); steam(e.pos, 8, 1.4); A().boom();
  }

  // ------------------------------------------------------------------ drawing: the tilt, the clips by how he's moving, the flame at each palm and sole
  const WEIGHTS = ['fly_hover', 'fly_forward', 'fly_boost', 'fly_brake'];
  function draw(e, dt) {
    const s = e.slot, g = s.g, sp = e.vel.length(), Fl = Q.flight;
    qT.setFromUnitVectors(Y, e.up); qY.setFromAxisAngle(Y, e.heading); g.quaternion.copy(qT).multiply(qY);
    const bob = e.state === 'dead' || e.doused > 0 ? 0 : Math.sin(G.time * 2.2 + e.phase) * 0.06 * clamp(1 - sp / 12, 0, 1); g.position.copy(e.draw || e.pos).addScaledVector(e.up, -1.0 * (e.def.scale || 1)); g.position.y += bob;
    // the four flight poses by how he's really moving: at rest he hovers, at speed he lies out, full on he boosts, and when he's shedding speed he rears
    const f = clamp(sp / 16, 0, 1), b = clamp((sp - Fl.cruise_mps * 0.8) / 12, 0, 1); let brake = 0; if (sp > 4) brake = clamp(-e.ask.dot(e.vel) / (sp * Fl.accel * 0.45), 0, 1);
    const grounded = e.state === 'landed' || e.doused > 0 || e.hp <= 0, whole = e.cur && !(e.cur.getClip && AIR.test(e.cur.getClip().name)), rest = whole || grounded ? 0 : 1;
    const W = [(1 - f) * (1 - brake), f * (1 - b) * (1 - brake), f * b * (1 - brake), brake];
    for (let i = 0; i < 4; i++) { const a = s.acts[WEIGHTS[i]]; e.w[i] = damp(e.w[i], W[i], 7, dt); a.setEffectiveWeight(e.w[i] * rest); }
    if (e.frozen <= 0) s.mixer.update(G.hitstop > 0 ? dt * 0.08 : dt);
    e.u.uHeat.value = damp(e.u.uHeat.value, e.heat, 6, dt);
    if (e.hp <= 0 && e.t < 1.4) e.u.uFade.value = Math.min(1, e.u.uFade.value + dt * 0.8);
    if (e.state === 'tell') G.fx.edge(e.pos, !!(e.blow && e.blow.unblockable));
    const lit = e.hp > 0 && e.frozen <= 0 && e.doused <= 0 && e.state !== 'landed' ? clamp(e.heat * 1.6, 0.15, 1) : 0;
    g.updateMatrixWorld(true);
    const cam = G.camera.position, far = e.pos.distanceTo(cam);
    if (lit > 0) {
      const flick = 0.82 + 0.3 * Math.random(), sputter = e.heat < 0.35 && Math.random() < 0.3 ? 0.3 : 1;
      for (let i = 0; i < 4; i++) {
        const [a, c] = s.jets[i]; a.getWorldPosition(v1); c.getWorldPosition(v2); v3.subVectors(v2, v1).normalize().multiplyScalar(0.72).addScaledVector(e.up, -0.5).normalize();
        const foot = i >= 2, L = (foot ? 0.62 : 0.42) * (0.55 + 0.62 * e.thrust) * flick * sputter * lit, Wd = (foot ? 0.2 : 0.15) * (0.7 + 0.2 * e.thrust);
        v2.addScaledVector(v3, foot ? 0.12 : 0.06);
        viewX.subVectors(cam, v2).normalize().cross(v3).normalize();
        const cell = (G.stats.frames + i) % 2 ? 'flame' : 'flame2';
        G.fx.now(cell, v2.x + v3.x * L, v2.y + v3.y * L, v2.z + v3.z * L, viewX.x * Wd, viewX.y * Wd, viewX.z * Wd, v3.x * -L, v3.y * -L, v3.z * -L, FIRE, 1, 1.0, 0.55);
        const L2 = L * 0.52, W2 = Wd * 0.46; G.fx.now(cell, v2.x + v3.x * L2, v2.y + v3.y * L2, v2.z + v3.z * L2, viewX.x * W2, viewX.y * W2, viewX.z * W2, v3.x * -L2, v3.y * -L2, v3.z * -L2, HOT, 1, 1.0, 0.8);
      }
      // the crown of fire: it stands straight up off his head and his speed lays it back
      s.head.getWorldPosition(v1); v1.addScaledVector(e.up, 0.12); v3.copy(Y).multiplyScalar(5).addScaledVector(e.vel, -0.5).normalize(); const Lc = 0.56 * flick * (0.5 + 0.5 * e.heat), Wc = 0.27; viewX.subVectors(cam, v1).normalize().cross(v3).normalize();
      G.fx.now(G.stats.frames % 3 ? 'flame2' : 'flame', v1.x + v3.x * Lc, v1.y + v3.y * Lc, v1.z + v3.z * Lc, viewX.x * Wc, viewX.y * Wc, viewX.z * Wc, v3.x * -Lc, v3.y * -Lc, v3.z * -Lc, FIRE, 1, 0.9, 0.5);
      // seen from far off he's a light, and the sprite holds its size on the screen so a phone reads him at 40 m
      if (far > 14) { const halo = Math.min(far * 0.07, 9); s.chest.getWorldPosition(v1); G.fx.ball(v1, halo, FIRE, clamp((far - 14) / 40, 0.1, 0.6)); }
      if ((e.smokeT = (e.smokeT || 0) - dt) <= 0) {
        e.smokeT = sp > 14 ? 0.035 : 0.09; v1.copy(e.pos).addScaledVector(e.up, -0.9); const k = 0.5 + Math.min(1, sp / 30);
        G.fx.sp('smoke', v1, k, sp > 14 ? 1.6 : 0.9, SMOKE, { s0: 0.3 * k, s1: 1.1 * k, a: 0.34, add: 0, hot: 0, vy: 0.9, drag: 0.7, rot: Math.random() * 6.28 });
        if (Math.random() < 0.5) G.fx.sp('dot', v1, 0.1, 0.8, HOT, { s0: 0.11, s1: 0.03, hot: 0.8, add: 1, vx: e.vel.x * 0.2 + rand(-1.4, 1.4), vy: e.vel.y * 0.2 + rand(-1, 1.6), vz: e.vel.z * 0.2 + rand(-1.4, 1.4), grav: 3 });
      }
      // low over the sea the jets dig into it
      const dy = e.pos.y; if (dy < 5.5 && groundAt(e.pos.x, e.pos.z) < 0 && (e.washT = (e.washT || 0) - dt) <= 0) { e.washT = 0.14; v1.set(e.pos.x, 0.06, e.pos.z); G.fx.ring(v1.clone(), 1.6 + (5.5 - dy) * 0.5, 0.5, 0xeaf6ff, Y); if (Math.random() < 0.5) G.fx.sp('smoke', v1, 1, 0.9, STEAM, { s0: 0.5, s1: 1.5, a: 0.3, add: 0.1, hot: 0, vy: 1.2, vx: rand(-2, 2), vz: rand(-2, 2), drag: 1, rot: Math.random() * 6.28 }); }
    }
    drawJetSound(e, far, lit);
  }
  let loud = 0;
  function drawJetSound(e, far, lit) { const v = lit * clamp(1 - far / 90, 0, 1) * (0.25 + 0.25 * e.thrust); if (v > loud) loud = v; }

  // ------------------------------------------------------------------ the raid: one comes in from the horizon, from where he's looking. When it's down, the next, after a breath
  const R = { on: false, cool: Q.raid.first_s, list: [], told: false, kills: 0 };
  const quiet = () => { const b = G.boss; return G.playing && !G.paused && G.started && !(b && b.active) && !(G.quest && G.quest.cineOn && G.quest.cineOn()) && !(G.cine && G.cine.active) && G.enemies.count() === 0; };
  function raidNow(n = 1, from = null) {
    const h = G.hero, yaw = G.camYaw + rand(-0.5, 0.5);
    for (let i = 0; i < n; i++) {
      const p = from ? from.clone() : new THREE.Vector3(h.pos.x + Math.sin(yaw) * -Q.raid.from_m + i * 18, Q.raid.high_m + i * 4, h.pos.z + Math.cos(yaw) * -Q.raid.from_m); const e = X.spawn('emberkin', p); if (e) R.list.push(e);
    }
    R.on = R.list.length > 0; if (R.on) { G.combat.log.push({ t: G.time, type: 'raid', n: R.list.length }); if (!FLAG.film) G.ui.toast && G.ui.toast('Fire on the horizon', 'An Emberkin is coming', 4); }
    return R.list;
  }
  function raid(dt) {
    if (!R.auto) return;
    if (R.on) { R.list = R.list.filter((e) => e.hp > 0); if (!R.list.length) { R.on = false; R.cool = Q.raid.again_s; R.kills++; } return; }
    if ((R.cool -= dt) > 0 || !quiet()) return;
    if (G.hero.pos.y < -Q.raid.deepest_m) { if (!R.told) { R.told = true; G.ui.tip && G.ui.tip('Something burns above the water. Go up', 6); } return; }
    raidNow(Math.min(1 + (R.kills >> 1), MAX));
  }

  function step(dt) { stepShots(dt); raid(dt); }
  function frame(dt) { time.value = G.time; drawShots(); if (A().jet) A().jet(loud); loud = 0; void dt; }

  return {
    pool, brain, keepOut, draw, struck, died, step, frame, raidNow, raids: R, shots, MAX,
    warm: [...pool.map((s) => s.g)],
    use(x) { X = x; R.auto = !(FLAG.qa || FLAG.demo || FLAG.film); },
    born(e) { e.heat = 1; e.doused = 0; e.up = new THREE.Vector3(0, 1, 0); e.ask = new THREE.Vector3(); e.thrust = 1; e.w = [1, 0, 0, 0]; e.vel.set(0, 0, 0); e.state = 'swimTo'; e.u.uHeat.value = 1; e.u.uFade.value = 0; e.ring = Q.flight.ring_m; e.ang = 0; e.heading = Math.atan2(G.hero.pos.x - e.pos.x, G.hero.pos.z - e.pos.z); e.splashed = false; e.wetNow = false; e.onGround = false;
      const a = e.slot.acts; for (const n of WEIGHTS) { a[n].reset(); a[n].setEffectiveWeight(n === 'fly_hover' ? 1 : 0); a[n].play(); } },
  };
}
