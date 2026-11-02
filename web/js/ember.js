// The elementals (EPIC V1, V2, V5, V8, V12, V13). The Emberkin: regular men in red who fly on fire jets at the palms and the soles. No weapon: fists, kicks and fire. Pressed, one goes into his super mode, the all-fire form, and water puts it out.
// Randy, 1 Nov: "The fire elementals should just be a regular guy with red attire. We can use the all fire design as a super mode". Both forms ride one rig: one mesh shows, the other waits.
// The water elementals fight beside the Warden: the all-fire body's shape and the same flight in the sea's own colours. Not called into a raid until he asks (combat.json ember.water.in_raids).
// The rules of a fight stay in enemies.js (tokens, tells, blows, what a hit does); this file holds what's theirs: a body that burns or runs with water, flight that leans into what the jets are doing, bolts that really fly, and what water does to fire.
// Flight is a thrust and not a slide: the body's axis stands along the push the jets must give, which is gravity, plus what he's asking of his speed, plus the drag of going fast. So he leans into a turn, lies flat at speed and rears back to stop, with no state saying so.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { FLAG } from './config.js';
import { BURN } from './burn_glsl.js';
import { createTurbines } from './turbine.js';
import { createFlames } from './flame.js';
import { createFireKit } from './firekit.js';
import { createChampions } from './champion.js';
import { aimChain, faceIn } from './formulas/aim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const Y = new THREE.Vector3(0, 1, 0);
const LOOK_S = [0.14, 0.38, 0.48], GR = 9.81, DRAG = 0.03;       // at 30 m/s the jets lie 70° over, at 12 m/s 24°: the drag is what lays him flat

export async function createEmber(G, { foeMaterial, D }) {
  const phone = G.tier === 'phone', Q = D.ember, H = Q.heat, MAX = phone ? 2 : 3, WATERS = Q.water.in_raids ? (phone ? 2 : 3) : 0, time = { value: 0 };
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('assets/ember.glb');
  let manB = null, fireB = null; const packed = new THREE.Vector4(0, 0, 0, 1);       // the packer stores positions as whole numbers with a scale on the node: the fire's pattern is in metres
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => { if (!o.isMesh) return; if (o.material.name === 'M_emberfire') { fireB = o.material; const m = o.matrixWorld.elements; packed.set(m[12], m[13], m[14], Math.hypot(m[0], m[1], m[2])); o.geometry.deleteAttribute('uv'); } else manB = o.material; });
  const strip = (m, keep) => { for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) { if (keep.includes(k) || !m[k]) continue; m[k].dispose(); m[k] = null; } m.vertexColors = true; m.metalness = 0; m.emissive.setRGB(0, 0, 0); m.color.setRGB(1, 1, 1); };
  strip(manB, ['map', 'normalMap']); strip(fireB, []); manB.roughness = 0.68; fireB.roughness = 0.82; fireB.envMapIntensity = 0.5;
  // the same man for the other side: his red goes blue. Only a true red: skin's ratio of red to the rest is about two, the cloth's over ten
  G.look.patch(manB, { skinned: true, key: 'emberman', uniforms: { uSwap: { value: 0 } }, fragmentPars: 'uniform float uSwap;\n', albedo: 'if (uSwap > .5) { float ocRed = smoothstep(2.6, 4.0, diffuseColor.r/max(max(diffuseColor.g, diffuseColor.b), .004)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.04, .2, .95)*diffuseColor.r*1.5, ocRed); }' });
  G.look.patch(fireB, { skinned: true, key: 'ember', uniforms: { uEmT: time, uHeat: { value: 1 }, uEmS: { value: packed }, uSide: { value: 0 } }, ...BURN });
  // a blow in the air leaves his legs to the flight: his upper body takes the clip and the jets keep holding him. On the ground, or for a kick, the whole body does
  const UPPER = /^(spine_|neck|head|clav_|arm_|fore_|hand_)/, AIR = /^e_(blast|cross|hook|jab)$/;
  const airClips = gltf.animations.map((c) => (AIR.test(c.name) ? new THREE.AnimationClip(c.name, c.duration, c.tracks.filter((t) => UPPER.test(t.name))) : c));
  const pool = [], waterPool = [];
  for (let i = 0; i < MAX + WATERS; i++) {
    const water = i >= MAX, model = SkeletonUtils.clone(gltf.scene), g = new THREE.Group(); g.add(model); g.visible = false; G.scene.add(g);
    const mat = foeMaterial(manB, { uSwap: { value: 0 } }), burning = foeMaterial(fireB, { ...mat.U, uHeat: { value: 1 }, uEmT: time, uEmS: { value: packed }, uSide: { value: water ? 1 : 0 } }), skinned = []; mat.U.uHeat = burning.U.uHeat; mat.U.uSide = burning.U.uSide; if (water) { burning.roughness = 0.16; burning.envMapIntensity = 1.2; }
    let man = null, fire = null;
    model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; if (o.material.name === 'M_emberfire') { o.material = burning; fire = o; } else { o.material = mat; man = o; } if (o.isSkinnedMesh) skinned.push(o); } });
    if (G.look.addOutline) for (const o of skinned) G.look.addOutline(o, { warm: o === fire });
    const mixer = new THREE.AnimationMixer(model), acts = {};
    for (const c of airClips) { const a = acts[c.name] = mixer.clipAction(c); if (AIR.test(c.name)) a.weight = 8; }
    const bone = (n) => model.getObjectByName(n); model.updateMatrixWorld(true);
    (water ? waterPool : pool).push({ g, mixer, acts, busy: false, mat, shield: null, tip: null, look: [bone('spine_3'), bone('neck'), bone('head')], face: faceIn(bone('head').getWorldQuaternion(new THREE.Quaternion())), jets: [[bone('fore_R'), bone('hand_R')], [bone('fore_L'), bone('hand_L')], [bone('shin_R'), bone('foot_R'), bone('toe_R')], [bone('shin_L'), bone('foot_L'), bone('toe_L')]], head: bone('head'), chest: bone('spine_3'), man, fire });
  }
  for (const s of [...pool, ...waterPool]) s.g.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) { o.skeleton.computeBoneTexture(); G.renderer.initTexture(o.skeleton.boneTexture); } });

  const shots = []; for (let i = 0; i < (phone ? 6 : 9); i++) shots.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, from: null, dmg: 0, back: false, cued: false, trailT: 0 });
  let X = null;      // what enemies.js lends: takeToken, dropToken, beginTell, tellStep, beginStrike, endTell, blowLands, playClip, free, spawn, count
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), acc = new THREE.Vector3(), want = new THREE.Vector3(), push = new THREE.Vector3(), viewX = new THREE.Vector3(), qT = new THREE.Quaternion(), qY = new THREE.Quaternion();
  const FIRE = new THREE.Color(1.0, 0.42, 0.07), HOT = new THREE.Color(1.0, 0.72, 0.28), SMOKE = new THREE.Color(0.2, 0.18, 0.18), STEAM = new THREE.Color(0.82, 0.86, 0.9), SEA = new THREE.Color(0.22, 0.72, 1.0), FOAM = new THREE.Color(0.86, 0.97, 1.0);
  const DUST = new THREE.Color(0.74, 0.69, 0.62);
  const waters = [];      // the water elementals in the air. They aren't foes: nothing the Warden aims lands on them, and they aren't counted in a fight
  const JET = createTurbines(G, phone ? 12 : 18), FL = createFlames(G, phone ? 130 : 190); G.fireKit = createFireKit(G, FL); G.flames = FL;
  const groundAt = (x, z) => G.world.heightAt(x, -z);
  const floorAt = (x, z) => Math.max(groundAt(x, z), 0);
  const probe = { x: 0, y: 0, z: 0 };
  const fx = () => G.fx, A = () => G.audio;
  const FIERCE = { ...Q.flight, ring_mps: Q.flight.ring_mps * Q.super.speed, accel: Q.flight.accel * Q.super.speed, boost_mps: Q.flight.boost_mps * Q.super.speed, cruise_mps: Q.flight.cruise_mps * Q.super.speed };

  // ------------------------------------------------------------------ flight: ask for a speed, get it through the jets
  function aim(e, w, most, dt) {
    acc.subVectors(w, e.vel).multiplyScalar(3.2); const l = acc.length(); if (l > most) acc.multiplyScalar(most / l);
    e.vel.addScaledVector(acc, dt * e.slow); e.ask.lerp(acc, 1 - Math.exp(-10 * dt));
  }
  function faceHim(e, dt, k = 7) { const h = (e.foe || G.hero).pos, y = Math.atan2(h.x - e.pos.x, h.z - e.pos.z); e.heading = wrap(e.heading + wrap(y - e.heading) * (1 - Math.exp(-k * dt))); }
  function faceGoing(e, dt) { if (e.vel.lengthSq() > 1) { const y = Math.atan2(e.vel.x, e.vel.z); e.heading = wrap(e.heading + wrap(y - e.heading) * (1 - Math.exp(-5 * dt))); } }
  // how high he holds: over the water, or over the land under him, and over the Warden wherever he's standing
  const heightFor = (e) => { const f = floorAt(e.pos.x, e.pos.z), Fl = Q.flight; if (fights(e)) return f + Fl.duel_m + Math.sin(G.time * 0.5 + e.phase) * 2.2; return Math.max(f + Fl.hover_m, (e.foe || G.hero).pos.y + Fl.over_m); };
  function goto(e, x, y, z, speed, most, dt) {
    want.set(x - e.pos.x, y - e.pos.y, z - e.pos.z); const d = want.length() || 1; want.multiplyScalar(Math.min(speed, d * 1.3) / d); aim(e, want, most, dt); return d;
  }

  // who a flyer is after. Fire: the Warden, or a water elemental that's nearer. Water: the nearest Emberkin, and with none left it stays by him a while, then goes back to the sea
  const up = (t) => t && (t === G.hero ? !t.dead : t.hp > 0);
  const emberkin = () => G.enemies.all().filter((o) => o.def.flyer && o.hp > 0 && !o.hidden);
  function pick(e, dt) {
    if (e.champ) { if (!e.foe || !up(e.foe)) e.foe = G.hero; return; }
    if ((e.pickT = (e.pickT || 0) - dt) > 0 && up(e.foe)) return; e.pickT = 1.4;
    if (e.friend) { let best = null, bd = 1e9; for (const o of emberkin()) { const d = o.pos.distanceTo(e.pos); if (d < bd) { bd = d; best = o; } } e.foe = best || G.hero; e.free = !best; return; }
    let best = G.hero, bd = G.hero.pos.distanceTo(e.pos) + (e.first ? 1e3 : 6); e.first = false; for (const w of waters) { if (w.hp <= 0) continue; const d = w.pos.distanceTo(e.pos); if (d < bd) { bd = d; best = w; } } e.foe = best;
  }
  const fights = (e) => e.foe && e.foe !== G.hero;       // against another elemental: no token, no parry call, no telegraph for the player to read: it's not at him
  function tellDone(e, dt) { if (!fights(e)) return X.tellStep(e, dt); const b = e.blow; e.clock += dt; const q = clamp(e.clock / b.tell_s, 0, 1); e.u.uTell.value = q * q; return e.clock >= b.tell_s; }

  // ------------------------------------------------------------------ one flyer's head: comes in, rings him, picks its moment. Tokens and tells are the same as every foe's
  function brain(e, dt) {
    pick(e, dt);
    const h = e.foe || G.hero, F = e.def, dist = e.pos.distanceTo(h.pos), Fl = e.super ? FIERCE : Q.flight;
    if (e.friend && e.free && e.state === 'circle' && (e.idleT = (e.idleT || 0) + dt) > Q.water.stays_s) { e.state = 'leave'; e.t = 2.4; } else if (!e.free) e.idleT = 0;
    e.t -= dt; if (e.state !== 'dead') e.heat = Math.min(1, e.heat + (e.doused > 0 ? 0 : H.regain_per_s) * dt);
    if (!e.champ && !e.friend && !e.super && e.state === 'circle' && e.doused <= 0) { e.superT -= dt; if (e.superT <= 0 && e.hp < e.maxHp * Q.super.at_hp) { e.state = 'ignite'; e.t = Q.super.tell_s; X.dropToken(e); X.playClip(e, 'e_hook', 0.12, true); G.combat.log.push({ t: G.time, type: 'ignite', foe: e.kind }); A().tell && A().tell(true); } }
    if (e.doused > 0) { e.doused -= dt; if (e.doused <= 0 && e.hp > 0) relight(e); else { fallStep(e, dt); return; } }
    if (e.champ) { if (CH.step(e, dt)) { fly(e, dt); return; } }
    switch (e.state) {
      case 'swimTo': { // in from the horizon, flat out, and rearing up to stop short of him
        faceGoing(e, dt); const b = v1.subVectors(h.pos, e.pos); b.y = 0; const flat = b.length() || 1, s = flat > Fl.brake_m ? Fl.boost_mps : Fl.cruise_mps;
        goto(e, h.pos.x, heightFor(e) + clamp((flat - 40) * 0.05, 0, 9), h.pos.z, s, Fl.accel, dt);      // low enough all the way in to stay above the horizon in a phone's frame, a line of fire coming at him
        if (flat < Fl.ring_m + 8) { e.state = 'circle'; e.t = rand(F.wait_s[0], F.wait_s[1]) + 2.2; e.ang = Math.atan2(e.pos.z - h.pos.z, e.pos.x - h.pos.x); }
        break;
      }
      case 'circle': {
        faceHim(e, dt); const R = e.ring = damp(e.ring || Fl.ring_m, Fl.ring_m + (fights(e) ? -2 : 0) + Math.sin(G.time * 0.31 + e.phase) * 3, 1, dt), sp = Fl.ring_mps; e.ang += (e.circleDir * sp / R) * dt;
        goto(e, h.pos.x + Math.cos(e.ang) * R, heightFor(e) + Math.sin(G.time * 0.8 + e.phase) * 0.8, h.pos.z + Math.sin(e.ang) * R, sp + 6, Fl.accel, dt);
        if (dist > 60) e.state = 'swimTo';
        if (e.t <= 0 && !(e.friend && e.free)) { if (fights(e) || X.takeToken(e)) begin(e); else e.t = 0.4; }
        break;
      }
      case 'tell': {
        faceHim(e, dt, 9); want.set(0, 0, 0); if (e.blow.land) want.y = 0.6; aim(e, want, Fl.accel * 0.7, dt);
        if (tellDone(e, dt)) { X.beginStrike(e); strikeBegins(e); }
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
          if (!e.hitDone && dist < b.reach_m + 0.5) { if (fights(e)) { e.hitDone = true; meets(e, h, b); } else X.blowLands(e, b, e.pos); if (e.state === 'strike') { e.state = 'recover'; e.clock = 0; } }
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
      case 'ignite': { // the fire comes up through him: it's told, for as long as any blow is, and then he's all fire
        const q = clamp(1 - e.t / Q.super.tell_s, 0, 1); want.set(0, 0.8, 0); aim(e, want, Fl.accel, dt); faceHim(e, dt); e.u.uTell.value = q * q * 1.4;
        if ((e.flareT = (e.flareT || 0) - dt) <= 0) { e.flareT = 0.05; v1.copy(e.pos); v1.x += rand(-0.5, 0.5); v1.y += rand(-0.9, 0.9); v1.z += rand(-0.5, 0.5); G.fx.sp('flame', v1, 0.4 + q * 0.5, 0.42, FIRE, { s0: 0.3, s1: 0.8 + q * 0.5, vy: 3 + q * 3, hot: 1, add: 0.6, a: 0.9 }); }
        if (e.t <= 0) ignite(e);
        break;
      }
      case 'takeoff': want.set(0, Fl.climb_mps, 0); aim(e, want, Fl.accel, dt); faceHim(e, dt); if (e.t <= 0) back(e); break;
      case 'stun': e.vel.multiplyScalar(Math.exp(-3 * dt)); e.ask.multiplyScalar(0.8); if (e.t <= 0) back(e); break;
      case 'leave': want.set(0, -14, 0); aim(e, want, Fl.accel, dt); if (e.pos.y < 0.4 && !e.wetNow) { e.wetNow = true; rise(e.pos); } if (e.t <= 0 || e.pos.y < -1.5) { sink(e); return; } break;
      case 'dead': fallStep(e, dt); if (e.t <= 0) { if (e.friend) sink(e); else X.free(e); } break;
    }
    fly(e, dt);
  }
  // two elementals meet: a blow of one on the other, and the sea or the steam says who it was
  function meets(e, o, b) {
    v1.lerpVectors(e.pos, o.pos, 0.5);
    if (e.friend) { o.onHit(b.damage, e.pos, 'water', { element: 'water', melee: false, status: { soak: 1 }, knock: 9, stun: 0.5, poise: 30 }); fx().sparks(v1, 12, 0xbdf7ff, 8); steam(v1, 6, 1); }
    else { hurt(o, b.damage, e.pos); burst(v1, 12); }
    A().hit(true); G.combat.log.push({ t: G.time, type: 'elementals', a: e.side, blow: b.id }); v2.subVectors(o.pos, e.pos).normalize(); e.vel.addScaledVector(v2, -7); if (o.vel) o.vel.addScaledVector(v2, 7);
  }
  function hurt(w, n, from) {
    if (w.hp <= 0) return; w.hp -= n; w.u.uFlash.value = 1; if (w.hp <= 0) { w.state = 'dead'; w.t = 2.2; X.endTell(w); if (w.cur) w.cur.fadeOut(0.1); w.cur = null; X.playClip(w, 'death', 0.1, true); rise(w.pos, 1.4); G.combat.log.push({ t: G.time, type: 'water_down' }); } else { v2.subVectors(w.pos, from).normalize(); w.vel.addScaledVector(v2, 5); }
  }
  function sink(e) { e.slot.busy = false; e.slot.g.visible = false; e.slot.mixer.stopAllAction(); const i = waters.indexOf(e); if (i >= 0) waters.splice(i, 1); rise(e.pos, 0.9); }
  function form(s, burning) { s.man.visible = !burning; s.fire.visible = burning; }
  function ignite(e) {
    e.super = true; form(e.slot, true); e.heat = 1; e.u.uHeat.value = 1; e.u.uTell.value = 0; e.state = 'circle'; e.t = 0.5; if (e.cur) e.cur.fadeOut(0.15); e.cur = null;
    burst(v1.copy(e.pos), 30, 2.2); fx().shock && fx().shock(v1.copy(e.pos), 7, 'fire'); A().boom(); A().roar && A().roar(); G.combat.log.push({ t: G.time, type: 'super', foe: e.kind }); G.combat.teach('super', 'All fire', 'Faster and harder. Water still puts it out');
    const h = G.hero, d = h.pos.distanceTo(e.pos); if (d < Q.super.blast_m) { h.vel.addScaledVector(v1.subVectors(h.pos, e.pos).normalize(), 12); G.combat.log.push({ t: G.time, type: 'blast', d }); }
  }
  function back(e) { X.dropToken(e); X.endTell(e); e.state = 'circle'; e.t = rand(e.def.wait_s[0], e.def.wait_s[1]); if (e.cur) e.cur.fadeOut(0.18); e.cur = null; }
  // which blow: from the air he shoots; a swoop comes when he's near; a Warden in the water is only reached by going in after him; on land he comes down
  function tellOf(e, b) {
    if (!fights(e)) return X.beginTell(e, b);
    e.blow = b; e.state = 'tell'; e.clock = 0; e.hitDone = false; e.cued = false; if (b.clip) { const a = X.playClip(e, b.clip, 0.1, true); if (a && b.clip_t) { a.time = b.clip_t[0]; a.setEffectiveTimeScale((b.clip_t[1] - b.clip_t[0]) / b.tell_s); } e.act = a; }
  }
  function begin(e) {
    const h = e.foe || G.hero, B = e.def.blows, by = (id) => B.find((b) => b.id === id), under = h.pos.y < -2.5, r = Math.random();
    if (fights(e)) return tellOf(e, by(r < 0.5 ? 'bolt' : r < 0.72 ? 'strafe' : 'swoop'));
    if (under) { if (h.pos.y > -Q.flight.dive_m && r < 0.7) return X.beginTell(e, by('swoop')); e.t = 1.2; X.dropToken(e); return; }
    if (groundAt(h.pos.x, h.pos.z) > 0.6 && r < 0.3) { const a = Math.random() * 6.283; e.spot = (e.spot || new THREE.Vector3()).set(h.pos.x + Math.cos(a) * 7, 0, h.pos.z + Math.sin(a) * 7); e.spot.y = groundAt(e.spot.x, e.spot.z) + 1.0; if (e.spot.y > 1.5) return X.beginTell(e, by('slam')); }
    X.beginTell(e, by(r < 0.45 ? 'bolt' : r < 0.75 ? 'strafe' : 'swoop'));
  }
  function strikeBegins(e) {
    const b = e.blow; if (b.burst) { e.shotsLeft = b.burst + (e.super ? 1 : 0); e.gapT = 0; if (b.pass_mps) { e.passDir = (e.passDir || new THREE.Vector3()).subVectors((e.foe || G.hero).pos, e.pos); e.passDir.y = 0; e.passDir.normalize(); } }
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
    if (e.side === 'water') return;
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
    const s = shots.find((x) => !x.on); if (!s) return; const h = e.foe || G.hero, side = e.nextHand = (e.nextHand || 0) ^ 1, hand = e.slot.jets[side][1];
    hand.getWorldPosition(s.p); s.on = true; s.back = false; s.cued = false; s.from = e; s.dmg = b.damage * (e.super ? Q.super.damage : 1); s.t = 3.2; s.trailT = 0; s.blow = b.id;
    v1.copy(h.pos); if (h === G.hero) v1.y = Math.max(h.pos.y + 0.3, 0.3); const l = s.p.distanceTo(v1) / b.speed_mps; v1.addScaledVector(h.vel, l * b.lead); s.v.subVectors(v1, s.p).normalize().multiplyScalar(b.speed_mps); s.side = e.side; s.friendly = !!e.friend;
    fx().sparks(s.p, 6, e.side === 'water' ? 0xbdf7ff : 0xffa040, 5); A().fwoosh && A().fwoosh(); G.combat.log.push({ t: G.time, type: 'bolt', foe: e.kind, blow: b.id });
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
    // fire and water meeting in the air: both gone, in a burst of steam
    for (const a of shots) { if (!a.on || a.side !== 'fire') continue; for (const b of shots) if (b.on && b.side === 'water' && a.p.distanceTo(b.p) < 1.5) { a.on = b.on = false; v1.lerpVectors(a.p, b.p, 0.5); steam(v1, 10, 1.5); fx().sparks(v1, 12, 0xffd8a0, 8); fx().sp('burst', v1, 1.4, 0.26, FOAM, { s0: 0.6, s1: 2, hot: 1, add: 0.6, rot: Math.random() * 6.28 }); A().hiss && A().hiss(0.8); G.combat.log.push({ t: G.time, type: 'clash' }); break; } }
    for (const s of shots) {
      if (!s.on) continue; s.t -= dt; s.p.addScaledVector(s.v, dt); const dist = s.p.distanceTo(h.pos), sp = s.v.length() || 1, wet = s.side === 'water'; let done = s.t <= 0;
      if ((s.trailT -= dt) <= 0) {
        s.trailT = 0.03;
        if (wet) { fx().sp('dot', s.p, 0.34, 0.24, SEA, { s0: 0.34, s1: 0.08, hot: 0.6, add: 0.5 }); fx().sp('bead', s.p, 0.1, 0.5, FOAM, { s0: 0.1, s1: 0.04, hot: 0.4, add: 0.3, vy: 1, grav: 7 }); }
        else { fx().sp('dot', s.p, 0.42, 0.26, FIRE, { s0: 0.42, s1: 0.1, hot: 0.7, add: 0.8 }); if (Math.random() < 0.35) fx().sp('smoke', s.p, 0.3, 0.6, SMOKE, { s0: 0.22, s1: 0.6, a: 0.28, add: 0, hot: 0, rot: Math.random() * 6.28 }); }
      }
      if (s.friendly) { for (const o of emberkin()) if (!done && o.pos.distanceTo(s.p) < 1.6) { o.onHit(s.dmg, s.p, 'water', { element: 'water', status: { soak: 1 }, knock: 3, stun: 0.25, poise: 14 }); fx().sparks(s.p, 10, 0xbdf7ff, 7); steam(s.p, 4, 0.9); done = true; } }
      else {
        if (!s.back && !s.cued && dist / sp < 0.42 && h.pos.y > -1.6) { s.cued = true; G.ui.cue('parry'); }
        for (const w of waters) if (!done && w.hp > 0 && w.pos.distanceTo(s.p) < 1.6) { hurt(w, s.dmg, s.p); burst(s.p, 10); steam(s.p, 4, 0.9); done = true; }
        if (s.back) { const o = s.from; if (o && o.hp > 0 && s.p.distanceTo(o.pos) < 1.9) { o.onHit(s.dmg * 3, s.p, 'bolt', { knock: 8, stun: 1.2, poise: 40 }); burst(s.p, 14); A().boom(); done = true; } }
        else if (dist < 1.5) {
          const res = h.damage(s.dmg, s.p); G.combat.log.push({ t: G.time, type: 'contact', foe: 'emberkin', blow: s.blow, res });
          if (res === 'parried') { s.back = true; s.t = 2; if (s.from) { v1.subVectors(s.from.pos, s.p).normalize(); s.v.copy(v1).multiplyScalar(sp * 1.25); } burst(s.p, 8, 0.7); }
          else if (res !== 'dodged' && res !== 'miss') { if (wet) { fx().sparks(s.p, 14, 0xbdf7ff, 8); steam(s.p, 3, 0.8); } else burst(s.p, 14); done = true; }
        }
      }
      if (!done && s.p.y < 0) { if (wet) fx().ring(v2.copy(s.p).setY(0.05), 1.4, 0.35, 0xdff4ff, Y); else { hissAt(v1.copy(s.p).setY(0.1), 1.1); fx().ring(v2.copy(s.p).setY(0.05), 1.8, 0.4, 0xdff4ff, Y); A().splash(); } done = true; }
      if (!done) { const g = groundAt(s.p.x, s.p.z); if (s.p.y < g) { if (wet) fx().sparks(s.p, 8, 0xbdf7ff, 5); else burst(s.p, 12); done = true; } }
      if (done) s.on = false;
    }
  }
  function drawShots() {
    const cam = G.camera.position;
    for (const s of shots) {
      if (!s.on) continue; const len = s.v.length() || 1, wet = s.side === 'water'; v1.copy(s.v).multiplyScalar(-1 / len); viewX.subVectors(cam, s.p).normalize().cross(v1).normalize();
      if (wet) { const L = 1.0, W = 0.34; G.fx.now('flame', s.p.x + v1.x * L, s.p.y + v1.y * L, s.p.z + v1.z * L, viewX.x * W, viewX.y * W, viewX.z * W, v1.x * -L, v1.y * -L, v1.z * -L, SEA, 1, 0.9, 0.3); G.fx.ball(s.p, 0.5, FOAM, 1, 0.6, 0.5); }
      else { if (!s.flame || s.flame.age >= s.flame.life || !s.flame.on) s.flame = FL.comet(s.p, s.v, 0.8, 3, 0.12); else { s.flame.p.copy(s.p); s.flame.a.copy(s.v).normalize(); s.flame.v.copy(s.v); s.flame.age = 0; } if ((s.trailF = (s.trailF || 0) - 1) <= 0) { s.trailF = 2; FL.puff(s.p, 0.34, 0.2, v1.x * 4, v1.y * 4, v1.z * 4, 4, 2, 1.4); } }
    }
  }

  // ------------------------------------------------------------------ water against fire (V5): what a hit of water does. Each is one line of combat.json `ember.heat`
  function struck(e, info) {
    const wet = info.element === 'water' || (info.status && info.status.soak), cold = info.element === 'ice' || (info.status && info.status.chill);
    if (!wet && !cold) return; e.heat = Math.max(0, e.heat - (wet ? H.water : H.ice) * (e.super ? Q.super.water_k : 1)); v2.copy(e.pos); v2.y += 0.4; steam(v2, wet ? 5 : 3, 0.9); A().hiss && A().hiss(0.5); G.combat.log.push({ t: G.time, type: 'quench', foe: e.kind, heat: +e.heat.toFixed(2) });
    if (e.heat <= 0.01) douse(e);
  }
  function douse(e) {
    if (e.doused > 0 || e.hp <= 0) return; e.doused = H.doused_s; X.dropToken(e); X.endTell(e); if (e.super) { e.super = false; form(e.slot, false); e.superT = Q.super.again_s; G.combat.log.push({ t: G.time, type: 'put_out', foe: e.kind }); } e.u.uTell.value = 0; e.state = 'stun'; e.t = H.doused_s; e.heat = 0; steam(e.pos, 10, 1.6); A().hiss && A().hiss(1); X.playClip(e, 'fall', 0.2, false);
    if (e.side === 'water') G.combat.teach('boiled', 'Boiled dry', 'Fire burns off their jets. Strike now'); else G.combat.teach('doused', 'Doused', 'Water puts them out. Strike now'); G.combat.log.push({ t: G.time, type: 'doused', foe: e.kind }); e.ask.set(0, 0, 0);
  }
  function relight(e) {
    e.doused = 0; e.heat = H.relight; e.state = 'takeoff'; e.t = 0.7; if (e.cur) e.cur.fadeOut(0.18); e.cur = null; burst(v1.copy(e.pos), 18, 1.5); A().boom(); G.combat.log.push({ t: G.time, type: 'relit', foe: e.kind });
  }
  function died(e, broken) {
    e.t = broken ? 0.05 : 3.0; e.doused = 0; e.heat = 0; burst(v1.copy(e.pos), 22, 1.8); steam(e.pos, 8, 1.4); A().boom();
  }

  // ------------------------------------------------------------------ drawing: the tilt, the clips by how he's moving, the flame at each palm and sole
  const WEIGHTS = ['fly_hover', 'fly_forward', 'fly_boost', 'fly_brake'], footA = new THREE.Vector3(), footB = new THREE.Vector3();
  // the jets: a turbine's at each palm and one under the feet, held together (Randy: "Make sure the foot thrusters are one"). The foot jet is the big one: it holds him up. Each leaves along its limb, leaning to the line of the body. `spool` is the turbine's: it comes up and down over a moment and doesn't follow the throttle (turbine.js)
  function jetsOf(pairs, up, spool, wet, seed) {
    for (let i = 0; i < 3; i++) {
      const foot = i === 2, [a, c, t] = pairs[i]; a.getWorldPosition(v1); c.getWorldPosition(v2);
      if (foot) { const [a2, c2, t2] = pairs[3]; a2.getWorldPosition(footA); c2.getWorldPosition(footB); v1.add(footA).multiplyScalar(0.5); v2.add(footB).multiplyScalar(0.5); t.getWorldPosition(footA); t2.getWorldPosition(footB); footA.add(footB).multiplyScalar(0.5); }
      v3.subVectors(v2, v1).normalize().multiplyScalar(foot ? 0.6 : 0.3).addScaledVector(up, -1).normalize();
      if (foot) v2.lerp(footA, 0.45).addScaledVector(v3, 0.07); else v2.addScaledVector(v3, 0.08);
      const L = (foot ? 3.1 : 1.1) * (0.36 + 0.64 * spool), R = foot ? 0.125 : 0.072;
      JET.add(v2.x, v2.y, v2.z, v3.x, v3.y, v3.z, L, R, spool, wet, seed + i * 0.37);
      G.fx.ball(v2, (foot ? 0.17 : 0.09) * (0.8 + 0.5 * spool), wet ? FOAM : HOT, 0.34 + 0.2 * spool, 0.9, 1);
    }
  }
  // what the jet does to what's under it: the push spreads out along the surface, a white ring on water and a low dust on land, and the higher he is the less of it arrives. Radius and rate go by his height and the turbine's speed, as a rotor's wash is scripted
  function washUnder(p, spool, dt, box) {
    const reach = 3 + 10 * spool, gy = Math.max(groundAt(p.x, p.z), 0), d = p.y - 0.9 - gy; if (d > reach || d < -1 || (box.washT = (box.washT || 0) - dt) > 0) return;
    const near = 1 - clamp(d / reach, 0, 1), wet = gy <= 0.02, col = wet ? FOAM : DUST; box.washT = 0.045 + 0.07 * (1 - near); v1.set(p.x, gy + 0.12, p.z);
    for (let i = 0; i < 2; i++) { const a = Math.random() * 6.283, c = Math.cos(a), n = Math.sin(a), r = 0.3 + 1.4 * (1 - near), vel = 5 + 10 * near; v2.set(v1.x + c * r, v1.y, v1.z + n * r); G.fx.sp('smoke', v2, 1, 0.6 + 0.5 * Math.random(), col, { s0: 0.5, s1: 1.8 + 1.8 * near, a: (wet ? 0.34 : 0.36) * (0.35 + 0.65 * near), add: 0, hot: 0, vx: c * vel, vz: n * vel, vy: wet ? 2.2 : 0.7, drag: 1.5, rot: Math.random() * 6.28 }); }
    if (wet && (box.ringT = (box.ringT || 0) - dt) <= 0) { box.ringT = 0.38; G.fx.ring(v1.clone(), 2.5 + 3.5 * near, 0.6, 0xe8fbff, Y); }
  }
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
    if (rest > 0 && e.hp > 0 && e.frozen <= 0) { const tg = e.target || G.hero; v1.copy(sp > 6 ? e.vel : v2.subVectors(tg.pos, e.pos)).normalize(); aimChain(s.look, LOOK_S, s.head, s.face, v1, 1.42, e.w[0] * 0.8 + 1 - e.w[0]); }
    e.u.uHeat.value = damp(e.u.uHeat.value, e.heat, 6, dt);
    if (e.hp <= 0 && e.t < 1.4) e.u.uFade.value = Math.min(1, e.u.uFade.value + dt * 0.8);
    if (e.state === 'tell' && !fights(e) && !e.friend) G.fx.edge(e.pos, !!(e.blow && e.blow.unblockable));
    const wetBody = e.side === 'water', JET = wetBody ? SEA : FIRE, CORE = wetBody ? FOAM : HOT, AIRY = wetBody ? 0.28 : 0.55;
    const lit = e.hp > 0 && e.frozen <= 0 && e.doused <= 0 && e.state !== 'landed' ? clamp(e.heat * 1.6, 0.15, 1) : 0;
    g.updateMatrixWorld(true);
    const cam = G.camera.position, far = e.pos.distanceTo(cam);
    if (lit > 0) {
      const flick = 0.82 + 0.3 * Math.random(); e.spool = damp(e.spool ?? 0.4, clamp((0.2 + e.thrust / 3.2) * (e.heat < 0.35 && Math.random() < 0.3 ? 0.4 : 1), 0.3, 1), 3.6, dt);
      jetsOf(s.jets, e.up, e.spool * lit, wetBody ? 1 : 0, e.phase);
      // the crown of fire: it stands straight up off his head and his speed lays it back. The man has none
      if (e.super || e.friend) { s.head.getWorldPosition(v1); v1.addScaledVector(e.up, 0.12); v3.copy(Y).multiplyScalar(5).addScaledVector(e.vel, -0.5).normalize(); const Lc = 0.42 * flick * (0.5 + 0.5 * e.heat), Wc = 0.3; viewX.subVectors(cam, v1).normalize().cross(v3).normalize();
      G.fx.now(G.stats.frames % 3 ? 'flame2' : 'flame', v1.x + v3.x * Lc, v1.y + v3.y * Lc, v1.z + v3.z * Lc, viewX.x * Wc, viewX.y * Wc, viewX.z * Wc, v3.x * -Lc, v3.y * -Lc, v3.z * -Lc, JET, 1, 0.9, AIRY); }
      // seen from far off he's a light, and the sprite holds its size on the screen so a phone reads him at 40 m
      if (far > 12) { const halo = Math.min(far * 0.05, 12) * (e.super || e.friend ? 1 : 0.62); s.chest.getWorldPosition(v1); G.fx.ball(v1, halo, JET, clamp((far - 12) / 60, 0.08, 0.55), 0.05, 0.4); G.fx.ball(v1, halo * 0.32, CORE, clamp((far - 12) / 30, 0.1, 0.9), 0.5, 0.5); }
      if ((e.smokeT = (e.smokeT || 0) - dt) <= 0) {
        e.smokeT = sp > 14 ? 0.07 : 0.16; v1.copy(e.pos).addScaledVector(e.up, -0.9); const k = 0.45 + 0.5 * Math.min(1, sp / 30);
        G.fx.sp('smoke', v1, k, sp > 14 ? 1.1 : 0.8, wetBody ? FOAM : SMOKE, { s0: 0.26 * k, s1: 0.9 * k, a: wetBody ? 0.12 : 0.15, add: 0, hot: 0, vy: wetBody ? -0.4 : 0.9, drag: 0.7, rot: Math.random() * 6.28 });
        if (Math.random() < 0.5) G.fx.sp(wetBody ? 'bead' : 'dot', v1, 0.1, 0.8, CORE, { s0: 0.11, s1: 0.03, hot: 0.8, add: 1, vx: e.vel.x * 0.2 + rand(-1.4, 1.4), vy: e.vel.y * 0.2 + rand(-1, 1.6), vz: e.vel.z * 0.2 + rand(-1.4, 1.4), grav: 3 });
      }
      // low over the sea the jets dig into it
      const dy = e.pos.y; if (dy < 5.5 && groundAt(e.pos.x, e.pos.z) < 0 && (e.washT = (e.washT || 0) - dt) <= 0) { e.washT = 0.1; const near = (5.5 - dy) / 5.5, k = 0.5 + near; for (let i = 0; i < 2; i++) { const a = Math.random() * 6.283, c = Math.cos(a), n = Math.sin(a); v1.set(e.pos.x + c * 0.7, 0.1, e.pos.z + n * 0.7); G.fx.sp('smoke', v1, k, 0.7, STEAM, { s0: 0.3 * k, s1: 1.1 * k, a: 0.16 + 0.16 * near, add: 0.1, hot: 0, vx: c * 5 * k, vy: 0.6, vz: n * 5 * k, drag: 1.6, rot: Math.random() * 6.28 }); } }
    }
    drawJetSound(e, far, lit);
  }
  let loud = 0;
  function drawJetSound(e, far, lit) { const v = lit * clamp(1 - far / 90, 0, 1) * (0.25 + 0.25 * e.thrust); if (v > loud) loud = v; }

  // ------------------------------------------------------------------ the raid: one comes in from the horizon, from where he's looking. When it's down, the next, after a breath
  const R = { on: false, cool: Q.raid.first_s, list: [], told: false, kills: 0 };
  const quiet = () => { const b = G.boss; return G.playing && !G.paused && G.started && !(b && b.active) && !(G.quest && G.quest.cineOn && G.quest.cineOn()) && !(G.cine && G.cine.active) && G.enemies.count() === 0; };
  // a water elemental comes up out of the sea beside him
  function rise(p, k = 1) { const f = fx(); v1.copy(p); v1.y = 0.05; f.sheet && f.sheet(v1, 3 * k, 0); f.ring(v1.clone(), 3 * k, 0.6, 0xdff4ff, Y); A().splash(); for (let i = 0; i < 8; i++) { const a = i * 0.785, s2 = rand(4, 9) * k; f.sp('bead', v1, 0.16, 0.9, FOAM, { s0: 0.16, s1: 0.07, hot: 0.4, add: 0.3, vx: Math.cos(a) * s2, vy: rand(6, 12) * k, vz: Math.sin(a) * s2, grav: 16 }); } }
  function callWater(at = null) {
    const slot = waterPool.find((x) => !x.busy); if (!slot) return null; const h = G.hero, a = G.camYaw + (Math.random() < 0.5 ? 1.2 : -1.2), W = Q.water;
    const p = at ? at.clone() : new THREE.Vector3(h.pos.x + Math.sin(a) * 9, -2.2, h.pos.z + Math.cos(a) * 9); if (groundAt(p.x, p.z) > -2) p.y = groundAt(p.x, p.z) + 1;
    slot.busy = true; slot.g.visible = true; slot.g.scale.setScalar(1); const e = { kind: 'water_elemental', side: 'water', def: W, friend: true, slot, pos: p, vel: new THREE.Vector3(0, 16, 0), heading: a + 3.14, hp: W.hp, maxHp: W.hp, r: 0.85, t: 0, circleDir: Math.random() < 0.5 ? -1 : 1, phase: Math.random() * 6.28, cur: null, clock: 0, slow: 1, frozen: 0, launched: 0, hitDone: false, hold: false, blow: null, u: slot.mat.U, first: false };
    for (const k of ['uFrost', 'uWet', 'uTell', 'uFlash', 'uFade']) e.u[k].value = 0; e.u.uTint.value.setRGB(1, 1, 1); born(e); e.side = 'water'; e.vel.set(0, 16, 0); waters.push(e); rise(p); G.combat.log.push({ t: G.time, type: 'water_rises' }); return e;
  }
  function raidNow(n = 1, from = null) {
    const h = G.hero, yaw = G.camYaw + rand(-0.15, 0.15), mine = G.sideNow === 'fire'; R.side = mine ? 'water' : 'fire';      // whoever he plays, the other side comes for him
    for (let i = 0; i < n; i++) {
      const p = from ? from.clone() : new THREE.Vector3(h.pos.x + Math.sin(yaw) * Q.raid.from_m + i * 18, Q.raid.high_m + i * 4, h.pos.z + Math.cos(yaw) * Q.raid.from_m); const e = X.spawn('emberkin', p); if (e) { e.first = true; R.list.push(e); }
    }
    R.water = 5.5;
    R.on = R.list.length > 0; if (R.on) { G.combat.log.push({ t: G.time, type: 'raid', n: R.list.length }); if (!FLAG.film) { if (mine) G.ui.toast('The sea sends its own', 'Men in blue are coming', 4); else if (h.pos.y < -3) G.ui.toast('Fire above the water', 'An Emberkin is coming. Go up and look at the sky', 6); else G.ui.toast('Fire on the horizon', 'An Emberkin is coming', 4); } }
    return R.list;
  }
  let CH = null;
  function raid(dt) {
    CH.stepShow(dt);
    if (!R.auto || G.champ) return;
    if (R.kills >= Q.raid.before_champion && !R.champed && !R.on && quiet()) { R.champed = true; CH.start(G.sideNow === 'fire' ? 'water' : 'fire'); return; }
    if (R.on) { R.list = R.list.filter((e) => e.hp > 0); if (!R.list.length) { R.on = false; R.cool = Q.raid.again_s; R.kills++; } return; }
    if ((R.cool -= dt) > 0 || !quiet()) return;
    if (G.hero.pos.y < -Q.raid.deepest_m) { if (!R.told) { R.told = true; G.ui.tip && G.ui.tip('Something burns above the water. Go up', 6); } return; }
    raidNow(Math.min(1 + (R.kills >> 1), MAX));
  }

  // ------------------------------------------------------------------ playing him: the Warden's bones and rules, this body. Randy, 1 Nov: "Allow users to choose in the Home Screen for water and fire and be able to switch too"
  const H2 = { on: false, sup: 0, cool: 0, man: null, fire: null, own: [], pairs: null, up: new THREE.Vector3(0, 1, 0), crownT: 0 };
  function dressHero(h) {
    if (!h.model || !h.bones || !h.bones.hips) return;
    const mk = (src, mat) => { const bs = src.skeleton.bones.map((b) => h.bones[b.name] || h.bones.hips), m = new THREE.SkinnedMesh(src.geometry, mat); src.matrixWorld.decompose(m.position, m.quaternion, m.scale); m.bind(new THREE.Skeleton(bs, src.skeleton.boneInverses), src.bindMatrix); m.frustumCulled = false; m.visible = false; h.model.add(m); return m; };
    let srcM = null, srcF = null; gltf.scene.traverse((o) => { if (o.isSkinnedMesh) { if (o.material.name === 'M_emberfire') srcF = o; else srcM = o; } });
    const own = []; h.model.traverse((o) => { if (o.isMesh) own.push(o); });
    const mat = foeMaterial(manB, { uSwap: { value: 0 } }), burning = foeMaterial(fireB, { ...mat.U, uHeat: { value: 1 }, uEmT: time, uEmS: { value: packed }, uSide: { value: 0 } });
    H2.man = mk(srcM, mat); H2.fire = mk(srcF, burning); H2.own = own; if (G.look.addOutline) { G.look.addOutline(H2.man, {}); G.look.addOutline(H2.fire, { warm: true }); }
    const B = h.bones; H2.pairs = [[B.fore_R, B.hand_R], [B.fore_L, B.hand_L], [B.shin_R, B.foot_R, B.toe_R], [B.shin_L, B.foot_L, B.toe_L]];
    if (h.body && h.body.learn) h.body.learn(gltf.animations);
  }
  function showHero() { const s = H2.sup > 0; for (const o of H2.own) o.visible = !H2.on; if (H2.man) { H2.man.visible = H2.on && !s; H2.fire.visible = H2.on && s; } }
  CH = createChampions(G, { D, Q, X: new Proxy({}, { get: (_, k) => X[k] }), R, aim, goto, faceHim, form, bolt, floorAt: (x, z) => Math.max(groundAt(x, z), 0), film: FLAG.film });
  function setSide(side, { place = false, quiet = false } = {}) {
    const fire = side === 'fire', h = G.hero; if (!H2.man) return; G.sideNow = fire ? 'fire' : 'water'; document.body.dataset.side = G.sideNow; H2.on = fire; if (!fire) { H2.sup = 0; if (h.fly) h.endFly(); } showHero();
    try { localStorage.setItem('thalor.side', G.sideNow); } catch (_) { /* a choice for this visit */ }
    G.fx.setSide && G.fx.setSide(fire); G.fireKit.install(fire); if (G.combat.relabel) G.combat.relabel();
    // what was coming for the other side goes back where it came from
    for (const e of R.list.slice()) { if (e.hp > 0) { e.hp = 0; X.free(e); } } R.list = []; R.on = false; R.cool = Q.raid.again_s * 0.5;
    if (place) { const a = (G.world.lifts || [])[0], sp = G.world.data.spawn; if (fire && a) { h.respawn(new THREE.Vector3(a.x + 5, a.z + 0.92, -(a.y + 5)), 2.4); h.land = true; h.grounded = true; h.air = false; G.camYaw = 2.4; h.place(); } else if (sp) { h.respawn(new THREE.Vector3(sp.x, sp.z, -sp.y), sp.yaw || 0); h.land = false; h.grounded = false; h.air = false; G.camYaw = sp.yaw || 0; h.place(); } }
    if (!quiet) { G.fx.ring(h.pos.clone(), 5, 0.6, fire ? 0xff8a30 : 0xbdf7ff); G.fx.sparks(h.pos, 16, fire ? 0xffa040 : 0xbdf7ff, 7); A().boom(); }
  }
  function heroSuper() {
    if (!H2.on) return false; const P = Q.super; if (H2.sup > 0) return false; if (H2.cool > 0) { G.ui.tip('The fire is still coming back', 1.4); return false; }
    H2.sup = P.hero_s; showHero(); const h = G.hero; burst(v1.copy(h.pos), 30, 2.2); A().boom(); A().roar && A().roar(); G.combat.log.push({ t: G.time, type: 'hero_super' }); G.ui.toast('All Fire', 'Harder and faster, for as long as it burns', 3);
    for (const e of G.enemies.alive()) if (e.pos.distanceTo(h.pos) < P.blast_m) { e.onHit(40, h.pos, 'blast', { knock: 14, stun: 0.8, poise: 40 }); } return true;
  }
  function heroBurn(dt) {
    if (!H2.on) return; const h = G.hero, B = h.bones; if (H2.sup > 0 && (H2.sup -= dt) <= 0) { H2.cool = Q.super.hero_again_s; showHero(); burst(v1.copy(h.pos), 12, 1); } if (H2.cool > 0) H2.cool -= dt;
    const sup = H2.sup > 0, burning = h.flyPose; if (!burning) { H2.spool = 0; H2.ringT = 0; } if (!burning && !sup) return;
    h.root.updateMatrixWorld(true); B.spine_3.getWorldPosition(v1); B.hips.getWorldPosition(v2); H2.up.subVectors(v1, v2).normalize();
    const thrust = h.fly ? 1 + Math.min(h.speed / 12, 3) : h.glide ? 0.7 : burning ? 2 : 0.5, flick = 0.82 + 0.3 * Math.random(); H2.spool = Math.max(damp(H2.spool ?? 0, burning ? clamp(h.flyThrottle ?? 0.5, 0.3, 1) : 0.3, 3.2, dt), burning ? 0.4 : 0); h.flyUp && H2.up.copy(h.flyUp); jetsOf(H2.pairs, H2.up, H2.spool, 0, 3.1);
    if (sup) { const cam = G.camera.position; B.head.getWorldPosition(v1); v1.addScaledVector(H2.up, 0.12); v3.copy(Y).multiplyScalar(5).addScaledVector(h.vel, -0.5).normalize(); const Lc = 0.42 * flick, Wc = 0.3; viewX.subVectors(cam, v1).normalize().cross(v3).normalize(); G.fx.now(G.stats.frames % 3 ? 'flame2' : 'flame', v1.x + v3.x * Lc, v1.y + v3.y * Lc, v1.z + v3.z * Lc, viewX.x * Wc, viewX.y * Wc, viewX.z * Wc, v3.x * -Lc, v3.y * -Lc, v3.z * -Lc, FIRE, 1, 0.9, 0.55); }
    if (burning) { washUnder(h.pos, H2.spool, dt, H2); loud = Math.max(loud, 0.25 + 0.2 * thrust); if ((H2.smokeT = (H2.smokeT || 0) - dt) <= 0) { H2.smokeT = h.speed > 14 ? 0.09 : 0.18; v1.copy(h.pos).addScaledVector(H2.up, -3.2); G.fx.sp('smoke', v1, 0.5, 1, SMOKE, { s0: 0.14, s1: 0.5, a: 0.06, add: 0, hot: 0, vy: 0.5, drag: 0.7, rot: Math.random() * 6.28 }); } }
  }

  function step(dt) {
    stepShots(dt); raid(dt);
    if (R.water > 0 && (R.water -= dt) <= 0 && R.list.length && Q.water.in_raids) { if (callWater()) { if (!FLAG.film) G.ui.toast('A water elemental rises', 'It fights beside you', 4); } }      // it comes as the fire arrives
    for (let i = waters.length - 1; i >= 0; i--) { const e = waters[i]; if (e.prev) e.prev.copy(e.pos); else { e.prev = e.pos.clone(); e.draw = e.pos.clone(); } brain(e, dt); if (waters[i] !== e) continue; e.pos.addScaledVector(e.vel, dt); keepOut(e, dt); for (const o of waters) if (o !== e) { const d = e.pos.distanceTo(o.pos); if (d < 3 && d > 0.01) e.vel.addScaledVector(v1.subVectors(e.pos, o.pos).normalize(), (3 - d) * 6 * dt); } }
  }
  // the rings of fire on the Burnt Isle's squares, drawn while he's near one
  function rings() {
    const cam = G.camera.position, L = G.world.lifts || []; for (const a of L) {
      const x = a.x, y = a.z + 0.25, z = -a.y; if (Math.hypot(x - cam.x, y - cam.y, z - cam.z) > 90) continue; const R2 = 3.2, sp = 0.06 * Math.sin(G.time * 3);
      G.fx.now('ring', x, y, z, R2 + sp, 0, 0, 0, 0, R2 + sp, FIRE, 1, 1, 0.8);
      for (let i = 0; i < 6; i++) { const t = i * 1.047 + G.time * 0.7, cx = x + Math.cos(t) * 3, cz = z + Math.sin(t) * 3, Lk = 0.9 + 0.3 * Math.sin(G.time * 7 + i * 2), W2 = 0.42; v3.set(0, 1, 0); viewX.set(cx - cam.x, 0, cz - cam.z).normalize().cross(v3).normalize(); G.fx.now(i % 2 ? 'flame' : 'flame2', cx, y + Lk, cz, viewX.x * W2, 0, viewX.z * W2, 0, Lk, 0, FIRE, 1, 1, 0.6); }
    }
  }
  function frame(dt) { time.value = G.time; rings(); heroBurn(dt); for (const e of waters) { e.u.uFlash.value *= Math.exp(-16 * dt); draw(e, dt); } drawShots(); G.fireKit.frame(dt); CH.frame(); JET.flush(G.time); if (A().jet) A().jet(loud); loud = 0; }

  return {
    pool, brain, keepOut, draw, struck, died, step, frame, raidNow, callWater, ignite, waters, raids: R, shots, MAX, setSide, heroSuper, dressHero, heroMul: () => (H2.sup > 0 ? Q.super.damage : 1), get heroForm() { return H2; },
    champions: () => CH, warm: [...pool.map((s) => s.g), ...waterPool.map((s) => s.g), JET.mesh, FL.mesh],
    blend(a) { for (const e of waters) if (e.prev) e.draw.lerpVectors(e.prev, e.pos, a); },
    use(x) { X = x; dressHero(G.hero); R.auto = !(FLAG.qa || FLAG.demo || FLAG.film); let back = false; try { back = !!localStorage.getItem('thalor.save.v2'); } catch (_) { /* no store: a new player */ } if (!back) R.cool = Q.raid.new_player_s; },
    born,
  };
  function born(e) { e.side = e.side || R.side || 'fire'; e.super = false; e.superT = 0; form(e.slot, !!e.friend); e.u.uSwap.value = e.side === 'water' ? 1 : 0; e.u.uSide.value = e.side === 'water' ? 1 : 0; e.heat = 1; e.doused = 0; e.up = new THREE.Vector3(0, 1, 0); e.ask = new THREE.Vector3(); e.thrust = 1; e.w = [1, 0, 0, 0]; e.vel.set(0, 0, 0); e.state = 'swimTo'; e.u.uHeat.value = 1; e.u.uFade.value = 0; e.ring = Q.flight.ring_m; e.ang = 0; e.heading = Math.atan2(G.hero.pos.x - e.pos.x, G.hero.pos.z - e.pos.z); e.splashed = false; e.wetNow = false; e.onGround = false;
    const a = e.slot.acts; for (const n of WEIGHTS) { a[n].reset(); a[n].setEffectiveWeight(n === 'fly_hover' ? 1 : 0); a[n].play(); }
  }
}
