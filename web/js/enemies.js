// Everything that fights the Warden. Encounters wake near him, one attacks at a time, and every blow is told before it lands (data/combat.json, foes).
// A foe carries its own state of the elements: soaked, chilled, frozen, staggered. Its own material shows it.
import { createInertial } from './inertial.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { W, retry } from './config.js';
import { createEmber } from './ember.js';
import { createRagdoll } from './ragdoll.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);

export function bendSwim(mat, G, geo, uniforms) {
  // a fish's body: stiff at the head, the wave growing toward the tail, side to side
  geo.computeBoundingBox(); const bb = geo.boundingBox, s3 = new THREE.Vector3(); bb.getSize(s3);
  G.look.patch(mat, { skin: 'shark', ink: true, body: new THREE.Vector4(bb.max.z, s3.z, s3.x / 2, s3.y) });
  const inner = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    if (inner) inner(s, r);
    s.uniforms.uSwim = uniforms.t; s.uniforms.uAmp = uniforms.amp;
    s.uniforms.uHead = { value: bb.max.z }; s.uniforms.uLen = { value: bb.max.z - bb.min.z };
    s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>
      uniform float uSwim, uAmp, uHead, uLen;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      { float sB = clamp((uHead - position.z) / uLen, 0.0, 1.0); float ph = modelMatrix[3].x * 0.7 + modelMatrix[3].z * 0.31;
        transformed.x += sin(sB * 5.2 - uSwim + ph) * uAmp * uLen * (0.015 + 0.11 * sB * sB); }`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : ''; mat.customProgramCacheKey = () => key + '|swim';
}

// one foe's own surface over the shared one: frost, wet, the tell's rim, the hit's flash, the dissolve. Same program for all, own uniforms for each.
export function foeMaterial(base, extra = {}) {
  const U = { uFrost: { value: 0 }, uWet: { value: 0 }, uTell: { value: 0 }, uFlash: { value: 0 }, uFade: { value: 0 }, uThin: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, ...extra };
  const m = base.clone(), inner = base.onBeforeCompile, keyFn = base.customProgramCacheKey;
  m.onBeforeCompile = function (s, r) {
    inner.call(this, s, r); Object.assign(s.uniforms, U);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
      uniform float uFrost, uWet, uTell, uFlash, uFade, uThin; uniform vec3 uTint;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      if (uFade > 0.001) { vec3 cell = floor(vOcP * 7.0); float nf = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453); if (nf < uFade) discard; }
      if (uThin > 0.001 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < uThin) discard;     // going thin, at the grain of the screen: a thing fading, not breaking up
      diffuseColor.rgb *= uTint;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.60, 0.83, 0.98) * (0.72 + 0.5 * dot(diffuseColor.rgb, vec3(0.4))), uFrost * 0.86);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.8, 1.0), uWet * 0.5);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.14, max(uFrost, uWet * 0.6));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float rimF = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.4);
        totalEmissiveRadiance += vec3(0.55, 0.88, 1.0) * rimF * uFrost * 1.7 + vec3(1.0, 0.56, 0.14) * rimF * uTell * 3.2 + vec3(0.2, 0.7, 1.0) * rimF * uWet * 0.5 + vec3(1.0) * uFlash * 1.3; }`);
  };
  m.customProgramCacheKey = () => keyFn.call(base) + '|foe';
  m.U = U; return m;
}

export async function createEnemies(G) {
  await G.combat.ready;
  const D = G.combat.data, S = D.status, I = D.interactions, FOES = D.foes;
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const MAX = G.tier === 'phone' ? 5 : 7;
  const swim = { t: { value: 0 }, amp: { value: 1 } }, probe = { x: 0, y: 0, z: 0 }, spot = new THREE.Vector3();
  const reaverPool = [];
  const noShake = () => G.settings && G.settings.shake === false;

  // a captain's shield and a hammerhead's head are real geometry until the world and movement owners hand over proper meshes
  const shieldGeo = new THREE.CylinderGeometry(0.62, 0.66, 0.1, 18, 1).rotateZ(Math.PI / 2);
  const shieldMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.5, metalness: 0.7 }); G.look.patch(shieldMat, {});

  try {
    const gltf = await retry(() => loader.loadAsync(G.tier === 'phone' ? 'assets/reaver_phone.glb' : 'assets/reaver.glb'));
    let shared = null;
    gltf.scene.traverse((o) => { if (o.isMesh) { shared = shared || o.material; } });
    if (shared) G.look.patch(shared, { skinned: true });
    for (let i = 0; i < MAX; i++) {
      const model = SkeletonUtils.clone(gltf.scene), g = new THREE.Group(); g.add(model); g.visible = false; G.scene.add(g);
      const mat = foeMaterial(shared);
      const skinned = []; model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = mat; if (o.isSkinnedMesh) skinned.push(o); } });
      if (G.look.addOutline) for (const o of skinned) G.look.addOutline(o);    // after the walk: an outline is a mesh too, and the walk would reach it
      const mixer = new THREE.AnimationMixer(model), acts = {}, still = createInertial(model);
      for (const c of gltf.animations) acts[c.name] = mixer.clipAction(c);
      const shield = new THREE.Mesh(shieldGeo, shieldMat); shield.visible = false; shield.frustumCulled = false; const arm = model.getObjectByName('fore_L') || model; arm.add(shield); shield.position.set(0.12, 0.22, 0);
      reaverPool.push({ g, mixer, acts, still, busy: false, mat, shield, tip: model.getObjectByName('weapon_tip') });
    }
  } catch (e) {
    console.warn('reaver.glb not here yet', e);
    const base = new THREE.MeshStandardMaterial({ color: 0x1c2a26, roughness: 0.6 }); G.look.patch(base, {});
    for (let i = 0; i < MAX; i++) { const g = new THREE.Group(), mat = foeMaterial(base), m = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 4, 8), mat); m.position.y = 0.9; g.add(m); g.visible = false; G.scene.add(g); reaverPool.push({ g, mixer: null, acts: {}, busy: false, mat, shield: null, tip: null }); }
  }

  // every foe's bone texture is built now, at the load: the first time a pool slot was drawn it cost a long frame, right as a fight began
  for (const s of reaverPool) s.g.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) { o.skeleton.computeBoneTexture(); G.renderer.initTexture(o.skeleton.boneTexture); } for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) if (o.material && o.material[k]) G.renderer.initTexture(o.material[k]); });

  // the sea's foes: one pool for each creature mesh, built on first need, the same shape every time
  const pools = { reaver: reaverPool };
  const crestMat = new THREE.MeshStandardMaterial({ color: 0xffb478, roughness: 0.5, emissive: 0xff5a10, emissiveIntensity: 0.55 }); G.look.patch(crestMat, {});
  function spineCrest(geo) {
    geo.computeBoundingBox(); const b = geo.boundingBox, L = b.max.z - b.min.z, parts = [];
    for (let i = 0; i < 9; i++) { const u = i / 8, H = 0.17 * L * Math.sin(0.25 + u * 2.6), c = new THREE.ConeGeometry(0.03 * L, H, 5).translate(0, H / 2, 0).rotateX(-0.5).translate(0, b.max.y * (1 - 0.4 * (2 * u - 1) ** 2) - 0.012 * L, b.min.z + L * (0.2 + 0.6 * u)).toNonIndexed(); c.deleteAttribute('uv'); parts.push(c); }
    return mergeGeometries(parts, false);
  }
  function fishPool(body) {
    if (pools[body]) return pools[body];
    const src = G.creatures && (G.creatures[body === 'shark' ? 'reef_shark' : body] || G.creatures[body] || G.creatures.shark), pool = [], n = body === 'shark' ? MAX : Math.max(3, MAX - 2);
    const geo = src ? src.geometry : new THREE.ConeGeometry(0.5, 3.4, 10).rotateX(Math.PI / 2);
    const base = src ? src.material.clone() : new THREE.MeshStandardMaterial({ color: 0x6b7a84, roughness: 0.5 });
    bendSwim(base, G, geo, swim);
    // a thornback's crest, down its back: it stands up when the spines are out, so the state shows on the body
    const spined = Object.values(FOES).some((f) => f.body === body && f.spined), crest = spined ? spineCrest(geo) : null;
    for (let i = 0; i < n; i++) { const g = new THREE.Group(), mat = foeMaterial(base, { uAmp: { value: 1 } }), m = new THREE.Mesh(geo, mat); m.frustumCulled = false; g.add(m); g.visible = false; if (crest) { const c = new THREE.Mesh(crest, crestMat); c.frustumCulled = false; c.scale.y = 0.03; g.add(c); g.userData.crest = c; } G.scene.add(g); pool.push({ g, busy: false, mat }); }
    pool.base = base; pool.geo = geo; pools[body] = pool; if (G.fx.warmList) G.fx.warmList.push(...pool.map((s) => s.g)); return pool;
  }
  const ember = G.ember = await createEmber(G, { foeMaterial, D }); pools.emberkin = ember.pool;
  for (const k in FOES) { if (k !== '_doc' && FOES[k].body !== 'reaver' && !FOES[k].flyer) fishPool(FOES[k].body); }
  const sharkPool = pools.shark;

  // the Call of the Deep: a pack of sharks comes from behind the Warden and goes through what's in front of him
  const PACK = G.tier === 'phone' ? 6 : 9;
  const pack = []; for (let i = 0; i < PACK; i++) { const g = new THREE.Group(), m = new THREE.Mesh(sharkPool.geo, sharkPool.base); m.frustumCulled = false; g.add(m); g.visible = false; G.scene.add(g); pack.push({ g, off: new THREE.Vector3((i % 3 - 1) * 3.2 + Math.random(), (i % 2) * 2 - 1, -(i / 3 | 0) * 4), d: 0 }); }
  let packT = 0; const packFrom = new THREE.Vector3(), packDir = new THREE.Vector3(), packHit = new Set(), packQ = new THREE.Quaternion();

  // harpoons: real things that fly, one mesh each, so a dodge really leaves them behind
  const harpoonGeo = new THREE.ConeGeometry(0.06, 1.9, 6).rotateX(Math.PI / 2), harpoonMat = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  const shots = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(harpoonGeo, harpoonMat); m.visible = false; m.frustumCulled = false; G.scene.add(m); shots.push({ m, on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, from: null, cued: false, dmg: 0, back: false }); }

  G.fx.warmList.push(...reaverPool.map((s) => s.g), ...sharkPool.map((s) => s.g), ...shots.map((s) => s.m), ...ember.warm);
  const data = G.world.data, encounters = (data.encounters || []).map((e) => ({ ...e, c: W(e.x, e.y, e.z), state: 'idle', list: [], cleared: false, cool: 0 }));
  // the fights on land: soldiers only, each at a named place (combat.json `land`). `at` is a poi or land id; dx, dy move it off that spot, onto ground that's open from where he arrives
  for (const f of (D.land && D.land.fights) || []) { const q = [...(data.poi || []), ...(data.land || [])].find((o) => o.id === f.at); if (!q) { console.error('a land fight at no place', f.id, f.at); continue; } const x = q.x + (f.dx || 0), y = q.y + (f.dy || 0), z = G.world.heightAt(x, y); encounters.push({ id: f.id, kind: 'reaver', mix: f.mix, n: f.mix.length, r: f.r || 30, spread: f.spread || 8, x, y, z, c: W(x, y, z + 0.92), state: 'idle', list: [], cleared: false, cool: 0, tied_to: null, land: true }); }
  const awake = [];
  let token = 0;

  function makeEnemy(kind, enc, p) {
    const F = FOES[kind]; if (!F) return null;
    const pool = pools[F.body], slot = pool && pool.find((s) => !s.busy);
    if (!slot || awake.length >= MAX * 2) return null;
    slot.busy = true; slot.g.visible = true; slot.g.scale.setScalar(F.scale || 1); if (slot.still) slot.still.reset();
    for (const k of ['uFrost', 'uWet', 'uTell', 'uFlash', 'uFade']) slot.mat.U[k].value = 0;
    if (slot.mat.U.uAmp) slot.mat.U.uAmp.value = F.walker ? 0.15 : 1;
    const tt = F.tint || [1, 1, 1]; slot.mat.U.uTint.value.setRGB(tt[0], tt[1], tt[2]);
    if (slot.shield) slot.shield.visible = !!F.shield;
    const e = {
      kind, def: F, slot, enc, pos: p.clone(), vel: new THREE.Vector3(), heading: Math.random() * 6.28, hp: F.hp * G.combat.difficulty().foe_hp, maxHp: F.hp * G.combat.difficulty().foe_hp, r: F.r, state: F.brain === 'fish' || F.brain === 'lurker' ? 'patrol' : 'swimTo', stunGuard: 0,
      t: 0, circleDir: Math.random() < 0.5 ? -1 : 1, phase: Math.random() * 6.28, cur: null, roll: 0, tilt: 0, hitDone: false, hold: false, blow: null, clock: 0,
      home: p.clone(), struck: 0, struckT: 0, stance: 0, spine: false, spineT: F.spined ? F.spined.flat_s * 0.5 : 0, armour: (F.armour || 0), fishy: F.body !== 'reaver' && !F.flyer, hidden: F.brain === 'lurker', soaked: 0, chill: 0, chillT: 0, frozen: 0, stagger: 0, launched: 0, poise: F.poise, guardBroken: 0, pull: null, slow: 1, slowT: 0, missile: 0, u: slot.mat.U, shatter: false, cued: false,
      onHit(dmg, from, type, info = {}) { return takeBlow(e, dmg, from, type, info); },
      slowFor(s, k) { e.slowT = Math.max(e.slowT, s); e.slow = Math.min(e.slow, k); },
    };
    if (F.body === 'reaver') for (const n of ['idle_combat', 'swim_slow', 'swim_fast', 'run']) { const a = slot.acts[n]; if (a) { a.reset(); a.setEffectiveWeight(n === 'idle_combat' ? 1 : 0); a.play(); } }
    if (F.flyer) ember.born(e);
    awake.push(e); return e;
  }

  // ------------------------------------------------------------------ thrown: a blow that carries takes the body out of its clips and gives it to the ragdoll (ragdoll.js). It flies, tumbles, lands or drifts, and comes back from wherever it ended up. Numbers in combat.json `rag`
  const ragV = new THREE.Vector3(), ragP = new THREE.Vector3(), ragS = new THREE.Vector3();
  function throwBody(e, dir, carry, o = {}) {
    const s = e.slot, Q = D.rag; if (!e.def.flyer && e.def.body !== 'reaver') return false; if (s.rag === undefined) s.rag = createRagdoll(s.g); if (!s.rag) return false; if (e.rag) return false;
    const under = e.pos.y < SEA_Y, k = under ? Q.water_carry : 1; ragV.copy(dir).multiplyScalar(carry * k); ragV.y += (under ? Q.water_up : Q.up_mps) * Math.min(1, carry / Q.ref_mps);
    ragS.set(-dir.z, 0, dir.x).multiplyScalar(Q.spin_rad * Math.min(1, carry / Q.ref_mps) * k); ragS.y = (Math.random() - 0.5) * Q.spin_rad * 0.5;
    s.g.updateMatrixWorld(true); s.rag.start(e.vel, ragV, ragS); if (!under) { ragP.copy(e.pos); G.fx.sparks(ragP, 6, 0xb8a890, 9); } e.vel.set(0, 0, 0); dropToken(e); if (!o.dead) endTell(e); if (e.cur) e.cur.fadeOut(0.1); e.cur = null;
    e.rag = { t: 0, T: o.T || (under ? Q.water_s : Q.down_s), w: 0, out: false, last: null, dead: !!o.dead }; if (!o.dead) { e.state = 'thrown'; e.t = 9; }
    if (e.def.flyer) ember.jetsLost(e, dir);
    G.combat.log.push({ t: G.time, type: 'thrown', foe: e.kind, carry: +carry.toFixed(1), under }); return true;
  }
  // dragged down by the water tornado (Randy, 2 Nov): the jets die, and what can't swim goes under. A soldier drowns; a champion is disarmed for a moment and takes every blow twice over
  function dragUnder(e) {
    const Q = D.turf; ragV.set(0, -1, 0); if (!throwBody(e, ragV, 26, { T: e.champ ? Q.disarm_s : Q.drown_s + 2 })) return; e.rag.drown = e.champ ? 0 : Q.drown_s; e.disarmT = e.champ ? Q.disarm_s : 0; G.combat.log.push({ t: G.time, type: 'dragged', foe: e.kind });
    if (e.champ) G.ui.toast(e.B.name + ' is disarmed', 'Strike now, while the sea has him', 3);
  }
  function stepRag(e, dt) {
    const r = e.rag, R = e.slot.rag; r.t += dt;
    if (r.drown > 0 && e.pos.y < SEA_Y) { r.drown -= dt; if ((r.bub = (r.bub || 0) - dt) <= 0) { r.bub = 0.25; G.fx.bubbles(e.pos, 5, 1); } if (r.drown <= 0 && e.hp > 0) { e.lastD = AY; e.lastKnock = 0; e.hp = 0; r.dead = true; r.drown = 0; die(e); G.combat.log.push({ t: G.time, type: 'drowned', foe: e.kind }); } }
    if (r.last) { const dx = e.pos.x - r.last.x, dz = e.pos.z - r.last.z; if (dx || dz) R.shift(dx, 0, dz); }
    R.hips(ragP); const g = footAt(ragP.x, ragP.z, ragP.y + 0.4), under = ragP.y < SEA_Y; R.step(dt, g, under); R.hips(e.pos); (r.last || (r.last = new THREE.Vector3())).copy(e.pos); e.vel.set(0, 0, 0);
    if (under && !r.wet) { r.wet = true; ember.fellIn && ember.fellIn(e); }
    // where the body comes down, and the wake it drags: dust scaled to how fast it's going
    if (!under && R.down) { R.velocity(ragV); const sp = Math.hypot(ragV.x, ragV.z); if (!r.hitGround) { r.hitGround = true; if (sp > 1) { G.fx.scuff(e.pos, 1.3, 4); G.audio.hit(true); } } if (sp > 2 && (r.dust = (r.dust || 0) - dt) <= 0) { r.dust = 0.1; G.fx.scuff(e.pos, 0.6 + sp * 0.05, 1); } }
    if (!r.dead && !r.out && (r.t >= r.T || (R.settled > D.rag.still_s && r.t > D.rag.min_s))) wakeRag(e, under, ragP.y - g < 1.2);
    return true;
  }
  function wakeRag(e, under, down) {
    const r = e.rag, R = e.slot.rag, Q = D.rag; r.out = true; r.blend = under ? Q.water_back_s : Q.back_s; R.velocity(ragV); e.vel.copy(ragV).multiplyScalar(0.3); e.state = 'stun'; e.t = r.blend + 0.1; e.stunGuard = 1.2;
    // on the ground he gets up the way a person does, from how he's lying, played on from the ragdoll's own pose
    if (down && !under) { const a = playClip(e, R.faceUp() ? 'up_back' : 'up_front', 0.1, true); if (a) { a.setEffectiveTimeScale(Q.up_speed); e.t = a.getClip().duration / Q.up_speed; r.blend = 0.3; } }
    if (e.def.flyer) ember.jetsBack(e);
  }
  function drawRag(e, dt) {
    const r = e.rag; if (!r) return; r.w = r.out ? Math.max(0, r.w - dt / r.blend) : Math.min(1, r.w + dt / 0.05); e.slot.g.updateMatrixWorld(true); e.slot.rag.apply(r.w); if (r.out && r.w <= 0) { e.slot.rag.stop(); e.rag = null; }
  }

  function playClip(e, name, fade, once) {
    const a = e.slot.acts && e.slot.acts[name]; if (!a) return null;
    // with a body that carries its own momentum the new clip takes over at once; a hit reaction's offset dies faster, so the blow reads in the frame it lands
    const still = e.slot.still;
    if (e.cur && e.cur !== a) { if (still) e.cur.stop(); else e.cur.fadeOut(0.1); }
    e.cur = a; a.reset(); if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } a.setEffectiveTimeScale(1); if (still) { a.setEffectiveWeight(a.weight || 1); still.kick(/^(hit_|stagger|death)/.test(name) ? 0.05 : 0.08); } else a.fadeIn(fade); a.play();
    return a;
  }

  // ------------------------------------------------------------------ a blow lands on a foe: the shield, the elements, the reaction
  const front = (e, from, arcDeg) => Math.abs(wrap(Math.atan2(from.x - e.pos.x, from.z - e.pos.z) - e.heading)) < (arcDeg * Math.PI) / 360;
  function takeBlow(e, dmg, from, type, info) {
    if (e.noHit) return 'blocked';
    if (e.hp <= 0) return 'dead';
    const F = e.def, status = info.status && !(F.immune === 'chill' && info.status.chill) ? info.status : {};
    if (status.chill) e.chillT = S.chill_decay_s;
    // the shield: parry him or freeze him and it's open for seconds. Any player gets the short way in: it's down while he recovers from his own swing
    if (F.shield && e.frozen <= 0 && e.guardBroken <= 0 && e.stagger <= 0 && e.state !== 'recover' && front(e, from, F.guard_arc_deg)) {
      if (status.chill) addChill(e, status.chill);     // cold goes through a shield, nothing else does
      if (e.frozen <= 0) { e.u.uFlash.value = 0.35; G.combat.log.push({ t: G.time, type: 'blocked', foe: e.kind }); return 'blocked'; }
    }
    // the duelist: two blows in a row and he's set. The next he turns aside and answers, so the way in is to stop, and parry what he swings
    if (F.riposte && info.melee && e.frozen <= 0 && e.stagger <= 0 && e.state !== 'recover' && e.state !== 'strike') {
      if (e.stance > 0) { e.stance = 0; e.struck = 0; e.u.uFlash.value = 0.4; G.combat.log.push({ t: G.time, type: 'riposte', foe: e.kind }); answer(e); return 'blocked'; }
      e.struckT = F.riposte.window_s; if (++e.struck >= F.riposte.after_hits) { e.struck = 0; e.stance = F.riposte.stance_s; G.combat.log.push({ t: G.time, type: 'stance', foe: e.kind }); if (G.fx.guard) G.fx.guard(e.pos, 'water'); G.audio.tell && G.audio.tell(false); }
    }
    // the thornback: spines up, a blow at arm's length comes back on him. Reach it from afar, or wait for them to lie flat
    if (F.spined && e.spine && info.melee && e.frozen <= 0) { e.u.uFlash.value = 0.4; G.combat.log.push({ t: G.time, type: 'thorn', foe: e.kind }); G.hero.damage(F.spined.thorn, e.pos, {}); return 'blocked'; }
    let mul = 1;
    if (F.flyer) { ember.struck(e, info); if (e.doused > 0) mul *= D.ember.heat.doused_mul; }
    if (e.frozen > 0) {
      if (info.move === 'riptide') { sendMissile(e, from); e.hp -= dmg; return e.hp <= 0 ? (die(e), 'dead') : 'missile'; }
      if (e.soaked > 0 || info.shatters) {
        const name = e.soaked > 0 ? 'shatter' : 'smash'; mul = I[name].damage_mul; e.shatter = true; e.frozen = 0; e.soaked = 0;
        G.combat.interact(name); G.combat.log.push({ t: G.time, type: 'shatter', name, foe: e.kind });
        G.fx.shatter && G.fx.shatter(e.pos, 16, 1.5); G.audio.boom();
      }
    }
    // a kind's own armour and weakness, each named in its `counter`
    if (e.armour > 0) { if (e.shatter) e.armour = 0; else if (info.heavy) e.armour -= 40; if (e.armour <= 0) { e.armour = 0; G.combat.teach('armour', 'Armour broken', 'It feels every blow now'); G.fx.shatter && G.fx.shatter(e.pos, 8, 1.2); G.audio.boom(); G.combat.log.push({ t: G.time, type: 'armour', foe: e.kind }); } else mul *= F.armour_mul; }
    if (F.needs_soak && e.soaked <= 0) mul *= F.needs_soak;
    if (F.soaked_mul && e.soaked > 0) mul *= F.soaked_mul;
    if (e.disarmT > 0) mul *= D.turf.hurt_k;
    e.hp -= dmg * mul * (F.flank_mul && e.state === 'recover' ? F.flank_mul : 1);
    e.u.uFlash.value = 1;
    if (e.hp <= 0) { e.lastD = new THREE.Vector3().subVectors(e.pos, from).normalize(); e.lastKnock = info.knock; die(e); return 'dead'; }
    if (status.soak) e.soaked = S.soaked_s;
    if (status.chill) addChill(e, status.chill);
    if (e.frozen > 0) { if (!e.shatter) return 'hit'; }
    e.shatter = false;
    const d = new THREE.Vector3().subVectors(e.pos, from).normalize();
    e.vel.addScaledVector(d, info.knock === undefined ? 6 : info.knock);
    e.flX = d.x; e.flZ = d.z; e.flA = info.heavy ? D.foeplay.flinch[2] : (info.poise || 0) >= 14 ? D.foeplay.flinch[1] : D.foeplay.flinch[0]; e.flT = 0;
    if (e.onLand && !e.launched && (info.knock || 0) >= D.foeplay.arc_knock) { e.launched = D.foeplay.arc_s; e.vel.y = D.foeplay.arc_up_mps; }
    if (info.launch) { e.launched = Math.max(e.launched, info.stun || 1.2); e.vel.y = Math.max(e.vel.y, info.launch); dropToken(e); }
    e.poise -= info.poise || 0;
    if (F.flyer) ember.jolt(e, d, 0.3 + 0.1 * (info.knock || 0));
    // a heavy blow in the open throws him: the ragdoll, not a clip
    { const kn = info.knock === undefined ? 6 : info.knock, Q = D.rag; if (!e.rag && e.frozen <= 0 && (info.heavy || kn >= Q.at_knock) && e.def && (e.def.flyer || e.def.body === 'reaver')) { e.vel.addScaledVector(d, -kn); if (throwBody(e, d, kn * (kn >= Q.finish_knock ? Q.carry_finish : Q.carry), {})) return 'hit'; e.vel.addScaledVector(d, kn); } }
    if (e.poise <= 0) { stagger(e); return 'hit'; }
    // a light blow doesn't stop a foe in its stride: it finishes what it told, and it can't be held down by mashing. A heavy blow, or a Siren's song, is what breaks a blow
    const told = e.state === 'tell' || e.state === 'strike', stops = info.heavy || F.fragile || (!told && e.stunGuard <= 0);
    if (stops) { dropToken(e); e.state = 'stun'; e.t = info.stun || 0.45; e.stunGuard = 1.6; endTell(e); if (F.body === 'reaver' || (F.flyer && e.doused <= 0)) playClip(e, 'hit_front', 0.05, true); }
    return 'hit';
  }
  function addChill(e, n) { e.chill += n; if (e.chill >= S.chill_to_freeze) freeze(e, true); }
  function freeze(e, spread) {
    if (e.hp <= 0 || e.frozen > 0) return;
    e.frozen = S.frozen_s; e.chill = 0; dropToken(e); endTell(e); e.pull = null; e.vel.multiplyScalar(0.15);
    G.fx.crust && G.fx.crust(e); G.audio.hit(true); G.combat.log.push({ t: G.time, type: 'freeze', foe: e.kind });
    if (spread && e.soaked > 0) {
      let n = 0; for (const o of awake) { if (o !== e && o.hp > 0 && o.soaked > 0 && o.frozen <= 0 && o.pos.distanceTo(e.pos) < I.flash_freeze.radius_m) { freeze(o, false); n++; } }
      if (n) { G.combat.interact('flash_freeze'); G.combat.log.push({ t: G.time, type: 'flash_freeze', n }); }
    }
  }
  function thaw(e) { e.frozen = 0; G.fx.thaw && G.fx.thaw(e); e.state = e.def.brain === 'lurker' ? 'back' : e.def.brain === 'fish' ? 'stalk' : 'circle'; e.t = 0.6; }
  function stagger(e) { e.stagger = S.stagger_s; e.poise = e.def.poise; dropToken(e); e.state = 'stun'; e.t = S.stagger_s; endTell(e); G.fx.stagger && G.fx.stagger(e); G.combat.log.push({ t: G.time, type: 'stagger', foe: e.kind }); if (e.def.body === 'reaver' && !playClip(e, 'stagger', 0.08, true)) playClip(e, 'hit_front', 0.05, true); }
  function sendMissile(e, from) {
    e.frozen = Math.max(e.frozen, 1.2); e.missile = 1.1; const d = new THREE.Vector3().subVectors(e.pos, from).normalize(); e.vel.copy(d).multiplyScalar(I.ice_missile.speed_mps);
    G.combat.interact('ice_missile'); G.combat.log.push({ t: G.time, type: 'ice_missile' });
  }
  // a blow ends for whatever reason: nothing may be left mid-blow with no blow in hand
  function endTell(e) { e.u.uTell.value = 0; e.blow = null; e.cued = false; if (e.state === 'tell' || e.state === 'strike' || e.state === 'recover') { e.state = e.def.brain === 'lurker' ? 'back' : e.def.brain === 'fish' ? 'stalk' : 'circle'; e.t = 0.6; } }

  function die(e) {
    dropToken(e); endTell(e); const broken = e.shatter; e.state = 'dead'; e.t = broken ? 0.05 : 0.9; G.quest && G.quest.note('kill'); G.hero.hp = Math.min(G.hero.maxHp, G.hero.hp + 9);
    G.combat.log.push({ t: G.time, type: 'kill', foe: e.kind });
    // the last of them: the moment leans out and the lens goes in
    if (e.enc && e.enc.list && e.enc.list.length && !e.enc.list.some((q) => q !== e && q.hp > 0 && !q.hidden)) { const Q = D.foeplay; G.slowT = Q.finish_s; G.slowK = Q.finish_k; G.fx.pushIn(e.pos, Q.finish_s * 1.5); G.combat.log.push({ t: G.time, type: 'finish', foe: e.kind }); G.audio.boom(); }
    if (!e.fishy && !broken && !throwBody(e, e.lastD || AY, (e.lastKnock === undefined ? 6 : e.lastKnock) * D.rag.carry + D.rag.kill_mps, { dead: true })) playClip(e, 'death', 0.08, true);
    if (e.def.flyer) { ember.died(e, broken); if (broken) e.slot.g.visible = false; e.frozen = 0; e.stagger = 0; return; }
    if (broken) e.slot.g.visible = false; else { G.fx.dissolve && G.fx.dissolve(e.pos, e.def.body); G.fx.bubbles(e.pos, 18, 1.4); }
    e.frozen = 0; e.stagger = 0; e.vel.multiplyScalar(0.4);
  }
  function free(e) {
    e.slot.busy = false; e.slot.g.visible = false; if (e.slot.mixer) e.slot.mixer.stopAllAction();
    const i = awake.indexOf(e); if (i >= 0) awake.splice(i, 1); const j = e.enc ? e.enc.list.indexOf(e) : -1; if (j >= 0) e.enc.list.splice(j, 1);
  }
  const dropToken = (e) => { if (e.hold) { e.hold = false; token = Math.max(0, token - 1); } };
  // who may strike now: a token each, at most two in all (P8e), archers filling in round the melee, and nobody opens on him during a finisher
  const takeToken = (e) => { if (e.hold) return true; const c = G.combat.cur; if (c && c.id === 'finisher') return false; if (token >= (e.def.brain === 'archer' ? 2 : G.combat.difficulty().tokens)) return false; e.hold = true; token++; return true; };

  // the ground rules, for every foe on every step: sea things stay in the sea, over the bed. Soldiers swim where it's deep and walk where they can stand
  const STAND = 0.92, SEA_Y = -0.8, WADE = -1.3;   // below WADE he floats; the hero's own shore line is the same
  const groundAt = (x, z) => G.world.heightAt(x, -z);
  const TAN_WALK = Math.tan((46 * Math.PI) / 180), STEP = 0.55;
  // what a walker stands on: the ground, or a solid whose top is within a step of his feet, as the hero does, so a fight on stairs or a deck stays a fight
  const footAt = (x, z, feet) => { const g = groundAt(x, z), s = G.world.solidTop(x, -z, feet + STEP); return s > g ? s : g; };
  function collide(e, r, px, pz, dt) {
    // thrown clear of the sea, or off his feet: he flies till the ground takes him. Solids still stop him
    if (e.launched > 0 && e.pos.y > SEA_Y && dt) {
      e.vel.y -= 26 * dt; const q = { x: e.pos.x, y: -e.pos.z, z: e.pos.y }; if (G.world.collide(q, r) && Number.isFinite(q.x + q.y + q.z)) { e.pos.set(q.x, q.z, -q.y); }
      const f = footAt(e.pos.x, e.pos.z, e.pos.y - STAND); if (e.pos.y > f + STAND || f < SEA_Y - 0.4) return;
      e.pos.y = f + STAND; e.vel.y = 0; e.launched = 0; G.fx.silt(e.pos, 1.2, false); G.audio.hit(false); return;
    }
    if (e.onLand && e.def.body === 'reaver') { const feet = e.pos.y - STAND, f = footAt(e.pos.x, e.pos.z, feet); if (f > feet) e.pos.y = f + STAND; }      // up the step first, or the step stops him
    const p = { x: e.pos.x, y: -e.pos.z, z: e.pos.y };
    if (G.world.collide(p, r)) { if (Number.isFinite(p.x + p.y + p.z)) e.pos.set(p.x, p.z, -p.y); else if (!e.nanTold) { e.nanTold = true; console.error('world.collide returned non-finite', e.kind, e.enc && e.enc.id, [e.pos.x, e.pos.y, e.pos.z, r]); } }
    const g = groundAt(e.pos.x, e.pos.z), walker = e.def.body === 'reaver';
    if (e.def.walker === 'bed') { e.pos.y = g + e.r * 0.5; e.vel.y = 0; e.onLand = false; return; }
    if (!walker) {
      // a fish can't leave the water: where the bed comes up it turns back, and it never touches bottom
      const floor = g + e.r * 0.7;
      if (floor > SEA_Y - 0.4) { e.pos.x = px; e.pos.z = pz; e.vel.x *= -0.4; e.vel.z *= -0.4; const g0 = groundAt(px, pz); e.pos.y = Math.min(e.pos.y, SEA_Y); if (e.pos.y < g0 + e.r * 0.7) e.pos.y = g0 + e.r * 0.7; }
      else { if (e.pos.y > SEA_Y) { e.pos.y = SEA_Y; e.vel.y = Math.min(0, e.vel.y); } if (e.pos.y < floor) { e.pos.y = floor; e.vel.y = Math.max(0, e.vel.y); } }
      e.onLand = false;
      return;
    }
    const lifted = e.launched > 0 || e.state === 'dead';
    if (g > WADE - STAND) {
      // he can stand here: on his feet, the bed under him, up to his chest at the edge of the sea. Not up a cliff: no walker goes where the ground rises faster than he can climb it
      let feet = e.pos.y - STAND, f = footAt(e.pos.x, e.pos.z, feet); if (e.onLand) { const from = footAt(px, pz, feet), run = Math.hypot(e.pos.x - px, e.pos.z - pz); if (f - from > Math.max(STEP, run * TAN_WALK)) { e.pos.x = px; e.pos.z = pz; e.vel.x *= -0.2; e.vel.z *= -0.2; f = from; } }
      const want = f + STAND; e.onLand = true;
      if (lifted && e.pos.y > want) return;
      e.pos.y = e.pos.y > want + 0.05 && dt ? Math.max(want, e.pos.y - 14 * dt) : want; e.vel.y = 0;
    } else {
      e.onLand = false;
      if (e.pos.y > SEA_Y) { e.pos.y = SEA_Y; e.vel.y = Math.min(0, e.vel.y); }
      if (e.pos.y < g + 1) { e.pos.y = g + 1; e.vel.y = Math.max(0, e.vel.y); }
    }
  }
  // where a foe may start near a point: sea things stay in water, a soldier on land stands on it
  function placeFor(kind, enc, p) {
    const F = FOES[kind]; if (F.flyer) return p;      // the air is open: a flyer starts where it's told
    // a place with no height (a NaN goes through clamp untouched and never leaves): stand it near the hero's own depth, and say who sent it
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) { console.error('foe spawned with no place', kind, enc && enc.id); p.x = G.hero.pos.x; p.z = G.hero.pos.z; }
    if (!Number.isFinite(p.y)) { console.error('foe spawned with no height', kind, enc && enc.id); p.y = Math.min(SEA_Y, G.hero.pos.y); }
    const height = (q) => { const g = groundAt(q.x, q.z); if (F.body === 'reaver') q.y = g > WADE - STAND ? g + STAND : clamp(q.y, g + 1.2, SEA_Y); else if (F.walker === 'bed') q.y = g + F.r * 0.5; else q.y = clamp(q.y, g + F.r + 0.4, SEA_Y); return q; };
    const free = (q) => { probe.x = q.x; probe.y = -q.z; probe.z = q.y; return !G.world.collide(probe, 0.05); };          // his centre clear: the bed itself counts as a hit at any wider reach, and the step pushes the rest of him out
    height(p); if (free(p)) return p;
    // that spot's inside something: the nearest open water or ground round it
    for (let R = 3; R <= 18; R += 3) for (let k = 0; k < 8; k++) { spot.set(p.x + Math.cos(k * 0.785) * R, p.y, p.z + Math.sin(k * 0.785) * R); height(spot); if (free(spot)) return p.copy(spot); }
    console.error('foe spawned in a solid', kind, enc && enc.id); return p;
  }
  const wet = (p) => groundAt(p.x, p.z) < SEA_Y - 2.4;
  // a foe that can't reach him can't be fought: close by with rock between them for 12 s, it comes round behind him, out of sight. quest.js does the same for a mission's own
  const seeA = { x: 0, y: 0, z: 0 }, seeB = { x: 0, y: 0, z: 0 };
  function comeRound(enc, dt) {
    const h = G.hero; if (enc.ours || h.air || (h.land && !enc.land)) return;
    for (const e of enc.list) {
      if (e.hp <= 0 || e.hidden || e.def.flyer) continue; const d = e.pos.distanceTo(h.pos);
      // on the ground a foe can also be held by a ledge with nothing in the way: if he's getting no nearer, that counts
      if ((e.seeT = (e.seeT || 0) - dt) <= 0) { e.seeT = 0.5; seeA.x = h.pos.x; seeA.y = -h.pos.z; seeA.z = h.pos.y; seeB.x = e.pos.x; seeB.y = -e.pos.z; seeB.z = e.pos.y; const held = enc.land && d > (e.def.hold_m || 6) + 2.5 && d > (e.lastD === undefined ? 1e9 : e.lastD) - 0.4; e.lastD = d; e.walled = held || (d < 30 && !!G.world.sweep(seeA, seeB, 0.4)); }
      if (!e.walled) { e.far = 0; continue; } if ((e.far = (e.far || 0) + dt) < 12) continue;
      e.far = 0; e.walled = false; const a = G.camYaw + Math.PI + (Math.random() - 0.5) * 1.6; e.pos.copy(placeFor(e.kind, enc, new THREE.Vector3(h.pos.x + Math.sin(a) * 10, h.pos.y - 1, h.pos.z + Math.cos(a) * 10))); e.safe = null; e.vel.set(0, 0, 0); G.combat.log.push({ t: G.time, type: 'cameRound', foe: e.kind });
    }
  }
  // who stands here. The story opens the place's list one kind a bell, so the cast arrives a counter at a time
  const holds = (data.holds || []).map((q) => { const p = (data.poi || []).find((o) => o.id === q.poi); return p ? { id: q.id, x: p.x, z: -p.y } : null; }).filter(Boolean);
  function rosterOf(enc) {
    const R = D.rosters; if (enc.tied_to && R[enc.tied_to]) return R[enc.tied_to];
    if (Math.hypot(enc.c.x - data.spawn.x, enc.c.z + data.spawn.y) < R.reef_m) return R.reef;
    let best = 'open', bd = R.near_m; for (const q of holds) { const d = Math.hypot(q.x - enc.c.x, q.z - enc.c.z); if (d < bd) { bd = d; best = q.id; } }
    return R[best] || R.open;
  }
  const opened = () => { if (G.enemies && G.enemies.opened !== undefined) return G.enemies.opened; let n = 1; for (const b of data.bells || []) if (G.quest && G.quest.isRung && G.quest.isRung(b.id)) n++; return n; };
  function kindAt(enc, i, n) {
    if (enc.mix) { const k = enc.mix[i % enc.mix.length]; return enc.land && n < 3 ? 'reaver' : k; }      // ground near the start doesn't open with a Captain: until two bells are rung the raiders there are Reavers
    const slot = enc.kind === 'mixed' ? (i % 2 ? 'fish' : 'soldier') : enc.kind === 'shark' ? 'fish' : enc.kind === 'reaver' ? 'soldier' : null; if (!slot) return enc.kind;
    const list = rosterOf(enc)[slot]; return list[(enc.kind === 'mixed' ? i >> 1 : i) % Math.min(list.length, n)];
  }

  const to = new THREE.Vector3(), side = new THREE.Vector3();
  function steer(e, goal, speed, k, dt) {
    to.subVectors(goal, e.pos); const d = to.length() || 1; to.multiplyScalar((speed * e.slow) / d);
    e.vel.x = damp(e.vel.x, to.x, k, dt); e.vel.y = damp(e.vel.y, to.y, k, dt); e.vel.z = damp(e.vel.z, to.z, k, dt); return d;
  }

  // ------------------------------------------------------------------ a blow's tell: the part a person reads. Nothing lands before its tell has run
  function beginTell(e, forced) {
    const F = e.def, raw = forced || F.blows[Math.floor(Math.random() * F.blows.length)], dif = G.combat.difficulty();
    // the difficulty moves a blow's tell and its weight, never past the half second a phone player is owed
    const b = dif.tell === 1 && dif.damage === 1 ? raw : { ...raw, tell_s: Math.max(0.5, raw.tell_s * dif.tell), damage: raw.damage * dif.damage };
    if (F.short) { const blue = e.def.flyer && e.side === 'water'; G.combat.teach('meet_' + e.kind + (blue ? '_blue' : ''), blue ? 'A man in blue' : F.name, blue ? 'Fire boils him dry. Strike when he falls' : F.short); }      // the first swing of a new kind says what beats it
    e.blow = b; e.state = 'tell'; e.clock = 0; e.hitDone = false; e.cued = false; e.goal = (e.goal || new THREE.Vector3()).copy(G.hero.pos);
    G.combat.log.push({ t: G.time, type: 'tell', foe: e.kind, blow: b.id, tell_s: b.tell_s, unblockable: !!b.unblockable });
    G.fx.tell && G.fx.tell(e, b); G.audio.tell && G.audio.tell(!!b.unblockable);
    if (b.clip) { const a = playClip(e, b.clip, 0.1, true); if (a && b.clip_t) { a.time = b.clip_t[0]; a.setEffectiveTimeScale((b.clip_t[1] - b.clip_t[0]) / b.tell_s); } e.act = a; }
  }
  // his answer to a blow turned aside: it comes at once, whoever else holds a turn
  function answer(e) { endTell(e); e.vel.multiplyScalar(0.3); beginTell(e, e.def.riposte.blow); }
  function tellStep(e, dt) {
    const b = e.blow, F = b.feint_s || 0, T = b.tell_s + F; e.clock += dt;
    // a feint: the swing stops most of the way up with the rim gone dull, and falls late, so a parry on the first beat is early. What gives it away is that the rim dies
    const at = b.tell_s * 0.62, hanging = F > 0 && e.clock > at && e.clock < at + F, q = clamp(F > 0 && e.clock >= at + F ? (e.clock - F) / b.tell_s : e.clock / b.tell_s, 0, 1);
    e.u.uTell.value = hanging ? 0.14 : q * q * (b.unblockable ? 1.4 : 1);
    if (F > 0 && e.act && b.clip_t) e.act.setEffectiveTimeScale(hanging ? 0 : (b.clip_t[1] - b.clip_t[0]) / b.tell_s);
    if (!e.cued && !b.unblockable && !hanging && e.clock >= T - (b.parry_cue_s || 0.42) && e.pos.distanceTo(G.hero.pos) < 14 && e.def.brain !== 'archer') { e.cued = true; G.ui.cue('parry'); }
    return e.clock >= T;
  }
  function beginStrike(e) {
    const b = e.blow; e.state = 'strike'; e.clock = 0; e.u.uTell.value = 0;
    G.combat.log.push({ t: G.time, type: 'strike', foe: e.kind, blow: b.id });
    G.audio.swing();
    if (e.act && b.clip_t) e.act.setEffectiveTimeScale(Math.max(0.2, (b.clip_t[2] - b.clip_t[1]) / Math.max(0.1, b.strike_s + b.recover_s)));
  }
  function blowLands(e, b, from) {
    e.hitDone = true; const res = G.hero.damage(b.damage, from, { unblockable: !!b.unblockable, heavy: !!b.unblockable });
    G.combat.log.push({ t: G.time, type: 'contact', foe: e.kind, blow: b.id, res });
    if (res === 'parried') {
      if (G.hero.guardFroze) { freeze(e, true); e.frozen *= G.hero.guardHold || 1; return res; }
      if (e.def.shield) { e.guardBroken = e.def.guard_break_s; G.combat.teach('captain', 'Guard broken', 'Strike while the shield is down'); }
      dropToken(e); endTell(e); e.state = 'stun'; e.t = 1.6; if (e.def.body === 'reaver') playClip(e, 'hit_front', 0.05, true); else e.vel.multiplyScalar(-0.3);
    }
    return res;
  }

  // ------------------------------------------------------------------ what a soldier does while he waits his turn: he doesn't stand. He steps, cuts the other way, feints
  function footwork(e, dt, dist) {
    const Q = D.foeplay; if ((e.stepT = (e.stepT === undefined ? rand(0.2, 0.9) : e.stepT) - dt) > 0 || dist > 9) return; e.stepT = rand(Q.every_s[0], Q.every_s[1]);
    to.subVectors(G.hero.pos, e.pos); to.y = 0; to.normalize(); const r = Math.random(); G.combat.log.push({ t: G.time, type: 'foot', foe: e.kind, what: r < Q.feint ? 'feint' : r < Q.feint + Q.cut ? 'cut' : 'back' });
    if (r < Q.feint) { e.waitLeft = e.t; e.state = 'feint'; e.t = Q.feint_s; e.vel.addScaledVector(to, Q.in_mps); if (e.def.body === 'reaver') playClip(e, 'tell_slash', 0.06, true); }
    else if (r < Q.feint + Q.cut) { e.circleDir *= -1; side.crossVectors(to, AY).normalize().multiplyScalar(e.circleDir * Q.cut_mps); e.vel.add(side); }
    else e.vel.addScaledVector(to, -Q.back_mps);
  }
  // ------------------------------------------------------------------ the soldier: closes, circles, waits his turn, tells, strikes
  function soldier(e, dt) {
    const h = G.hero, dist = e.pos.distanceTo(h.pos), F = e.def;
    e.t -= dt;
    switch (e.state) {
      case 'swimTo': steer(e, h.pos, F.speed_mps, 2.2, dt); if (dist < F.hold_m + 1.8) { e.state = 'circle'; e.t = rand(0.6, 2.2); } break;
      case 'circle': {
        to.subVectors(h.pos, e.pos); side.crossVectors(to, AY).normalize().multiplyScalar(e.circleDir * 3.2);
        const hold = (dist - F.hold_m) * 1.6; to.normalize().multiplyScalar(hold).add(side).multiplyScalar(e.slow);
        e.vel.x = damp(e.vel.x, to.x, 3, dt); e.vel.y = damp(e.vel.y, to.y, 3, dt); e.vel.z = damp(e.vel.z, to.z, 3, dt);
        if (dist > 12) e.state = 'swimTo';
        if (e.t <= 0 && takeToken(e)) { beginTell(e); break; }
        if (e.t <= 0 && !e.hold) e.t = 0.3;
        footwork(e, dt, dist);
        break;
      }
      // a feint: a hard step in with the blade coming up, and straight back out. No blow in it and no rim, so it asks nothing of a parry: it's a man looking for his moment
      case 'feint': e.vel.multiplyScalar(Math.exp(-5 * dt)); if (e.t <= 0) { to.subVectors(h.pos, e.pos); to.y = 0; to.normalize(); e.vel.addScaledVector(to, -D.foeplay.back_mps); e.state = 'circle'; e.t = Math.min(rand(0.2, 0.7), e.waitLeft || 0.6); if (e.cur) e.cur.fadeOut(0.16); e.cur = null; } break;
      case 'tell': {
        const near = dist > 3.2; steer(e, h.pos, near ? 2.6 : 0.2, 6, dt);
        if (tellStep(e, dt)) beginStrike(e);
        break;
      }
      case 'strike': {
        const b = e.blow; e.clock += dt; steer(e, h.pos, dist > 2.4 ? b.lunge_mps : 0.2, 8, dt);
        if (!e.hitDone && dist < b.reach_m + 0.4) blowLands(e, b, e.pos);
        if (e.state === 'strike' && e.clock >= b.strike_s) { e.state = 'recover'; e.clock = 0; }
        break;
      }
      case 'recover': {
        const b = e.blow; e.clock += dt; e.vel.multiplyScalar(Math.exp(-5 * dt));
        if (e.clock >= b.recover_s) { dropToken(e); endTell(e); e.state = 'circle'; e.t = rand(F.wait_s[0], F.wait_s[1]); if (e.cur) e.cur.fadeOut(0.18); e.cur = null; }
        break;
      }
      case 'stun': e.vel.multiplyScalar(Math.exp(-3 * dt)); if (e.t <= 0) { e.state = 'circle'; e.t = 0.6; if (e.cur) e.cur.fadeOut(0.18); e.cur = null; } break;
      case 'dead': e.vel.y = damp(e.vel.y, -1.1, 1.2, dt); e.vel.x *= 0.98; e.vel.z *= 0.98; if (e.t <= 0) free(e); break;
    }
    blendSoldier(e);
  }
  function blendSoldier(e) {
    const a = e.slot.acts, sp = e.vel.length();
    if (e.def.shield && !e.cur && e.state === 'circle' && a && a.shield_guard) playClip(e, 'shield_guard', 0.2, true);   // a Captain holds his shield up while he waits
    if (a && a.idle_combat) {
      const busy = e.cur ? 1 : 0, f = clamp(sp / 5, 0, 1);
      a.idle_combat.setEffectiveWeight((1 - f) * (1 - busy));
      const onFoot = e.onLand && a.run; if (a.swim_fast) a.swim_fast.setEffectiveWeight(onFoot ? 0 : f * (1 - busy)); if (a.run) a.run.setEffectiveWeight(onFoot ? f * (1 - busy) : 0);
    }
  }

  // ------------------------------------------------------------------ the archer: keeps his distance, aims in plain sight, and the harpoon really flies
  function archer(e, dt) {
    const h = G.hero, dist = e.pos.distanceTo(h.pos), F = e.def;
    e.t -= dt;
    switch (e.state) {
      case 'swimTo': steer(e, h.pos, F.speed_mps, 2.2, dt); if (dist < F.hold_m + 4) { e.state = 'circle'; e.t = rand(0.8, 2); } break;
      case 'circle': {
        to.subVectors(h.pos, e.pos); side.crossVectors(to, AY).normalize().multiplyScalar(e.circleDir * 2.4);
        const hold = (dist - F.hold_m) * 0.9; to.normalize().multiplyScalar(clamp(hold, -F.speed_mps, F.speed_mps)).add(side).multiplyScalar(e.slow);
        e.vel.x = damp(e.vel.x, to.x, 3, dt); e.vel.y = damp(e.vel.y, to.y, 3, dt); e.vel.z = damp(e.vel.z, to.z, 3, dt);
        if (e.t <= 0 && dist < 34 && takeToken(e)) beginTell(e); else if (e.t <= 0) e.t = 0.4;
        break;
      }
      case 'tell': e.vel.multiplyScalar(Math.exp(-5 * dt)); if (tellStep(e, dt)) { beginStrike(e); fire(e); } break;
      case 'strike': { const b = e.blow; e.clock += dt; if (e.clock >= b.strike_s) { e.state = 'recover'; e.clock = 0; } break; }
      case 'recover': { const b = e.blow; e.clock += dt; if (e.clock >= b.recover_s) { dropToken(e); endTell(e); e.state = 'circle'; e.t = rand(F.wait_s[0], F.wait_s[1]); if (e.cur) e.cur.fadeOut(0.18); e.cur = null; } break; }
      case 'stun': e.vel.multiplyScalar(Math.exp(-3 * dt)); if (e.t <= 0) { e.state = 'circle'; e.t = 0.6; if (e.cur) e.cur.fadeOut(0.18); e.cur = null; } break;
      case 'dead': e.vel.y = damp(e.vel.y, -1.1, 1.2, dt); e.vel.x *= 0.98; e.vel.z *= 0.98; if (e.t <= 0) free(e); break;
    }
    blendSoldier(e);
  }
  function fire(e) {
    const b = e.blow, s = shots.find((x) => !x.on); if (!s) return;
    s.on = true; s.back = false; s.cued = false; s.from = e; s.dmg = b.damage; s.t = 3; s.p.copy(e.pos); s.p.y += 0.3; s.m.visible = true;
    to.subVectors(G.hero.pos, s.p).normalize(); s.v.copy(to).multiplyScalar(b.speed_mps);
    s.m.position.copy(s.p); s.m.quaternion.setFromUnitVectors(AZ, to);
  }
  function stepShots(dt) {
    const h = G.hero;
    for (const s of shots) {
      if (!s.on) continue; s.t -= dt; s.p.addScaledVector(s.v, dt); s.m.position.copy(s.p);
      const dist = s.p.distanceTo(h.pos), sp = s.v.length() || 1;
      if (!s.back && !s.cued && dist / sp < 0.45) { s.cued = true; G.ui.cue('parry'); }
      let done = s.t <= 0;
      if (s.back) { const o = s.from; if (o && o.hp > 0 && s.p.distanceTo(o.pos) < 1.8) { o.onHit(s.dmg * 3, s.p, 'harpoon', { knock: 8, stun: 1.4, poise: 30 }); G.fx.impact && G.fx.impact(o.pos, to.copy(s.v).normalize(), 'heavy', 'water'); done = true; } }
      else if (dist < 1.5) {
        const res = h.damage(s.dmg, s.p); G.combat.log.push({ t: G.time, type: 'contact', foe: 'archer', blow: 'harpoon', res });
        if (res === 'parried') { s.back = true; s.t = 2; s.v.negate(); if (s.from) { to.subVectors(s.from.pos, s.p).normalize(); s.v.copy(to).multiplyScalar(sp * 1.2); s.m.quaternion.setFromUnitVectors(AZ, to); } }
        else if (res !== 'dodged' && res !== 'miss') done = true;
      }
      if (done) { s.on = false; s.m.visible = false; }
    }
  }

  // ------------------------------------------------------------------ the fish: patrols, stalks in a ring, sets itself, and goes straight through
  function fish(e, dt) {
    const h = G.hero, dist = e.pos.distanceTo(h.pos), F = e.def; e.t -= dt;
    switch (e.state) {
      case 'patrol': {
        e.phase += dt * 0.2; const c = e.enc ? e.enc.c : h.pos; to.set(c.x + Math.cos(e.phase) * 20, c.y + Math.sin(e.phase * 0.6) * 3, c.z + Math.sin(e.phase) * 20);
        steer(e, to, 4.6, 1.4, dt); if (dist < 30) { e.state = 'stalk'; e.t = rand(F.wait_s[0], F.wait_s[1]); } break;
      }
      case 'stalk': {
        e.phase += dt * 0.62 * e.circleDir; to.set(h.pos.x + Math.cos(e.phase) * F.ring_m, h.pos.y + 1 + Math.sin(e.phase * 1.7) * 1.5, h.pos.z + Math.sin(e.phase) * F.ring_m);
        steer(e, to, F.speed_mps, 2.2, dt);
        if (e.t <= 0 && takeToken(e)) {
          beginTell(e);
          if (F.pairs) for (const o of awake) if (o !== e && o.kind === e.kind && o.state === 'stalk' && o.hp > 0 && token < 2) { o.hold = true; token++; o.t = 0.3; o.partner = true; beginTell(o); break; }
        }
        if (e.t <= 0 && !e.hold) e.t = 0.4;
        break;
      }
      case 'tell': {
        e.vel.multiplyScalar(Math.exp(-4 * dt)); e.goal.copy(h.pos);
        if (tellStep(e, dt)) { beginStrike(e); to.subVectors(h.pos, e.pos).normalize(); e.vel.copy(to).multiplyScalar(e.blow.speed_mps); e.t = e.blow.strike_s; e.cued = true; }
        break;
      }
      case 'strike': {
        const b = e.blow;
        if (!e.hitDone && dist < b.reach_m) blowLands(e, b, e.pos);
        if (e.state === 'strike' && e.t <= 0) { e.state = 'recover'; e.clock = 0; }
        break;
      }
      case 'recover': {
        const b = e.blow; e.clock += dt; e.vel.multiplyScalar(Math.exp(-2.2 * dt));
        if (e.clock >= b.recover_s * 0.4) { dropToken(e); endTell(e); e.partner = false; e.state = 'stalk'; e.t = rand(F.wait_s[0], F.wait_s[1]) + b.recover_s * 0.6; }
        break;
      }
      case 'stun': e.vel.multiplyScalar(Math.exp(-2.2 * dt)); e.roll = damp(e.roll, 2.6, 4, dt); if (e.t <= 0) { e.state = 'stalk'; e.t = 1.4; } break;
      case 'dead': e.vel.y = damp(e.vel.y, -0.9, 1, dt); e.vel.x *= 0.985; e.vel.z *= 0.985; e.roll = damp(e.roll, 3.14, 2, dt); if (e.t <= 0) free(e); break;
    }
    if (e.state !== 'stun' && e.state !== 'dead') e.roll = damp(e.roll, 0, 3, dt);
  }
  
  // ------------------------------------------------------------------ the moray: nothing to see until he's close. It strikes from its hole and hangs there, open, then goes back
  function lurker(e, dt) {
    const h = G.hero, dist = e.pos.distanceTo(h.pos), F = e.def; e.t -= dt;
    switch (e.state) {
      case 'patrol':
        e.hidden = true; e.slot.g.visible = false; e.vel.multiplyScalar(0.5);
        if (dist < F.wake_m && e.t <= 0 && takeToken(e)) { e.hidden = false; e.slot.g.visible = true; G.fx.bubbles(e.pos, 16, 1.2); beginTell(e); }
        break;
      case 'tell': e.vel.multiplyScalar(0.9); if (tellStep(e, dt)) { beginStrike(e); to.subVectors(h.pos, e.pos).normalize(); e.vel.copy(to).multiplyScalar(e.blow.speed_mps); e.cued = true; } break;
      case 'strike': { const b = e.blow; e.clock += dt; if (!e.hitDone && dist < b.reach_m) blowLands(e, b, e.pos); if (e.state === 'strike' && e.clock >= b.strike_s) { e.state = 'recover'; e.clock = 0; } break; }
      case 'recover': { const b = e.blow; e.clock += dt; e.vel.multiplyScalar(Math.exp(-3 * dt)); if (e.clock >= b.recover_s) { dropToken(e); endTell(e); steer(e, e.home, F.speed_mps, 6, dt); e.state = 'back'; } break; }
      case 'back': if (steer(e, e.home, F.speed_mps, 6, dt) < 0.8) { e.state = 'patrol'; e.t = rand(F.wait_s[0], F.wait_s[1]); } break;
      case 'stun': e.vel.multiplyScalar(Math.exp(-2.2 * dt)); if (e.t <= 0) { e.state = 'back'; } break;
      case 'stalk': case 'circle': e.state = 'back'; break;
      case 'dead': e.vel.y = damp(e.vel.y, -0.9, 1, dt); if (e.t <= 0) free(e); break;
    }
  }

  // ------------------------------------------------------------------ the siren: keeps off, sings, and the song draws him in until something breaks it
  function siren(e, dt) {
    const h = G.hero, dist = e.pos.distanceTo(h.pos), F = e.def; e.t -= dt;
    switch (e.state) {
      case 'swimTo': steer(e, h.pos, F.speed_mps, 2.2, dt); if (dist < F.hold_m + 3) { e.state = 'circle'; e.t = rand(0.8, 1.8); } break;
      case 'circle': {
        to.subVectors(h.pos, e.pos); side.crossVectors(to, AY).normalize().multiplyScalar(e.circleDir * 2); const hold = clamp((dist - F.hold_m) * 0.8, -F.speed_mps, F.speed_mps); to.normalize().multiplyScalar(hold).add(side).multiplyScalar(e.slow);
        e.vel.x = damp(e.vel.x, to.x, 3, dt); e.vel.y = damp(e.vel.y, to.y, 3, dt); e.vel.z = damp(e.vel.z, to.z, 3, dt);
        if (e.t <= 0 && dist < 26 && takeToken(e)) beginTell(e); else if (e.t <= 0) e.t = 0.4;
        break;
      }
      case 'tell': e.vel.multiplyScalar(Math.exp(-5 * dt)); if ((e.ringT = (e.ringT || 0) - dt) <= 0) { e.ringT = 0.26; G.fx.ring(e.pos.clone(), 3.4, 0.5, 0x8ffff0, to.subVectors(h.pos, e.pos).normalize().clone()); } if (tellStep(e, dt)) beginStrike(e); break;
      case 'strike': {
        const b = e.blow; e.clock += dt; to.subVectors(e.pos, h.pos); const l = to.length() || 1; if (l > 2.2) h.vel.addScaledVector(to, (b.pull_mps2 * dt) / l); h.combatT = 0;
        if ((e.ringT = (e.ringT || 0) - dt) <= 0) { e.ringT = 0.18; G.fx.ring(h.pos.clone(), 1.8, 0.3, 0x8ffff0, to.normalize().clone()); }
        G.combat.log.push({ t: G.time, type: 'charmed' }); if (G.combat.log.length > 1900) G.combat.log.splice(0, 400);
        if (e.clock >= b.strike_s) { e.state = 'recover'; e.clock = 0; }
        break;
      }
      case 'recover': { const b = e.blow; e.clock += dt; if (e.clock >= b.recover_s) { dropToken(e); endTell(e); e.state = 'circle'; e.t = rand(F.wait_s[0], F.wait_s[1]); if (e.cur) e.cur.fadeOut(0.18); e.cur = null; } break; }
      case 'stun': e.vel.multiplyScalar(Math.exp(-3 * dt)); if (e.t <= 0) { e.state = 'circle'; e.t = 0.6; if (e.cur) e.cur.fadeOut(0.18); e.cur = null; } break;
      case 'dead': e.vel.y = damp(e.vel.y, -1.1, 1.2, dt); if (e.t <= 0) free(e); break;
    }
    blendSoldier(e);
  }
  ember.use({ takeToken, dropToken, beginTell, tellStep, beginStrike, endTell, blowLands, playClip, free, drawRag, throwBody, spawn: (k, p, enc) => { const e = makeEnemy(k, enc || null, placeFor(k, enc || null, p.clone())); if (e && enc) enc.list.push(e); return e; } });
  const BRAIN = { soldier, archer, fish, lurker, siren, flyer: ember.brain };

  // what holds a foe outside its own head: ice, a lash, being thrown. True means its brain sits this step out
  function held(e, dt) {
    if (e.rag) { stepRag(e, dt); if (!e.rag || !e.rag.dead) return true; }
    if (e.hp <= 0) return false;
    if (e.spun) {
      const s = e.spun, Q = D.spout, rode = G.combat.powers.spout.riding; s.t -= dt; s.a += Q.spun_rad * dt; s.y += (s.top - s.y) * (1 - Math.exp(-2.2 * dt)); e.pos.set(s.base.x + Math.cos(s.a) * s.r, s.y, s.base.z + Math.sin(s.a) * s.r); e.vel.set(0, 0, 0); e.heading = wrap(e.heading + 11 * dt);
      if ((s.hitT -= dt) <= 0) { s.hitT = 0.5; takeBlow(e, Q.spun_damage, s.base, 'spout', { move: 'spout', element: 'water', status: { soak: 1 }, knock: 0, stun: 0, poise: 0 }); }
      if ((s.t <= 0 || !rode) && e.hp > 0 && (G.combat.powers.spout.T.drag || 0) > G.time) { e.spun = null; dragUnder(e); return true; }
      if ((s.t <= 0 || !rode) && e.hp > 0) { const a = s.a; e.spun = null; e.state = 'stun'; e.t = 1.2; e.launched = 1.4; e.vel.set(Math.cos(a) * Q.throw_mps, 7, Math.sin(a) * Q.throw_mps); takeBlow(e, Q.throw_damage, s.base, 'spout', { move: 'spout', element: 'water', knock: 0, stun: 1.2, poise: 60, heavy: true }); e.vel.set(Math.cos(a) * Q.throw_mps, 7, Math.sin(a) * Q.throw_mps); G.combat.log.push({ t: G.time, type: 'thrown', foe: e.kind }); G.fx.sparks(e.pos, 12, 0xcff6ff, 8); }
      if (e.hp <= 0) e.spun = null;
      return true;
    }
    if (e.soaked > 0) { e.soaked -= dt; e.u.uWet.value = damp(e.u.uWet.value, 1, 8, dt); e.wetT = (e.wetT || 0) - dt; if (e.wetT <= 0) { e.wetT = 0.22; G.fx.motes && G.fx.motes(e.pos, 1, 'water'); } } else e.u.uWet.value = damp(e.u.uWet.value, 0, 4, dt);
    if (e.chillT > 0) { e.chillT -= dt; if (e.chillT <= 0) e.chill = 0; }
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 1; }
    if (e.guardBroken > 0) e.guardBroken -= dt;
    if (e.struckT > 0 && (e.struckT -= dt) <= 0) e.struck = 0;
    if (e.stance > 0) { e.stance -= dt; if (e.state !== 'tell') e.u.uTell.value = e.stance > 0 ? 0.5 + Math.sin(G.time * 16) * 0.12 : 0; }
    { const crest = e.slot.g.userData.crest; if (crest) crest.scale.y = damp(crest.scale.y, e.spine ? 1 : 0.03, 14, dt); }
    if (e.def.spined) { const Q = e.def.spined; if ((e.spineT -= dt) <= 0) { e.spine = !e.spine; e.spineT = e.spine ? Q.up_s : Q.flat_s; G.combat.log.push({ t: G.time, type: e.spine ? 'spines' : 'flat', foe: e.kind }); if (e.spine && G.fx.spines) G.fx.spines(e.pos, e.r); if (!e.spine && e.state !== 'tell') e.u.uTell.value = 0; } if (e.spine) { if (e.state !== 'tell') e.u.uTell.value = 0.7; if ((e.barbT = (e.barbT || 0) - dt) <= 0) { e.barbT = 0.3; if (G.fx.spines) G.fx.spines(e.pos, e.r); } } }
    if (e.stunGuard > 0) e.stunGuard -= dt;
    if (e.stagger > 0) e.stagger -= dt;
    if (e.disarmT > 0) e.disarmT -= dt;
    e.u.uFrost.value = damp(e.u.uFrost.value, e.frozen > 0 ? 1 : 0, e.frozen > 0 ? 18 : 6, dt);
    if (e.slot.mat.U.uAmp) e.slot.mat.U.uAmp.value = e.frozen > 0 ? 0 : 1;
    if (e.frozen > 0) {
      e.frozen -= dt; if (e.frozen <= 0) { thaw(e); return false; }
      if (e.missile > 0) {
        e.missile -= dt;
        for (const o of awake) { if (o !== e && o.hp > 0 && o.pos.distanceTo(e.pos) < e.r + o.r + 0.6) { o.onHit(I.ice_missile.damage, e.pos, 'ice', { element: 'ice', knock: 12, stun: 1.2, poise: 30, status: { chill: 1 } }); G.fx.shatter && G.fx.shatter(e.pos, 14, 1.2); e.onHit(I.ice_missile.damage, o.pos, 'ice', { shatters: true }); e.missile = 0; break; } }
      } else { e.vel.multiplyScalar(Math.exp(-4 * dt)); e.vel.y = damp(e.vel.y, -0.5, 2, dt); }
      return true;
    }
    if (e.pull) {
      to.subVectors(G.hero.pos, e.pos); const d = to.length() || 1; e.pull.t -= dt;
      if (d < 2.8 || e.pull.t <= 0) { e.pull = null; e.vel.multiplyScalar(0.25); e.state = e.def.brain === 'lurker' ? 'back' : e.def.brain === 'fish' ? 'stalk' : 'circle'; e.t = 0.5; return false; }
      e.vel.copy(to).multiplyScalar(e.pull.speed / d); return true;
    }
    if (e.launched > 0) {
      e.launched -= dt; e.vel.x *= Math.exp(-3 * dt); e.vel.z *= Math.exp(-3 * dt);
      if (e.pos.y > 0) e.vel.y -= 16 * dt; else e.vel.y = damp(e.vel.y, e.launched > 0.5 ? 0.4 : -2.2, e.launched > 0.5 ? 3.2 : 2, dt);
      if (e.launched <= 0) { e.state = e.def.brain === 'lurker' ? 'back' : e.def.brain === 'fish' ? 'stalk' : 'circle'; e.t = 0.5; }
      return true;
    }
    return false;
  }

  const qY = new THREE.Quaternion(), qX = new THREE.Quaternion(), qR = new THREE.Quaternion(), qF = new THREE.Quaternion(), flAxis = new THREE.Vector3();
  function step(dt) {
    const h = G.hero;
    swim.t.value += dt * 7;
    for (const enc of encounters) {
      const d = enc.c.distanceTo(h.pos);
      if (enc.state === 'idle') {
        enc.cool -= dt;
        if (!enc.cleared && enc.cool <= 0 && d < (enc.r || 30) + 34 && !(enc.tied_to && G.quest && G.quest.isRung(enc.tied_to))) {
          enc.state = 'awake'; const n = enc.n || 3, open = opened();
          for (let i = 0; i < n; i++) {
            let kind = kindAt(enc, i, open); const a = (i / n) * 6.283;
            const p = enc.c.clone().add(new THREE.Vector3(Math.cos(a) * (enc.spread || 8), 1.5, Math.sin(a) * (enc.spread || 8)));
            if (FOES[kind] && FOES[kind].body !== 'reaver' && !FOES[kind].walker && !wet(p)) kind = 'reaver';     // no sharks on a beach: raiders hold the land
            if (kind === 'reaver' && G.combat.difficulty().captains && i % 3 === 2) kind = 'captain';              // the hard setting promotes every third soldier
            const e = makeEnemy(kind, enc, placeFor(kind, enc, p)); if (e) enc.list.push(e);
          }
          if (!enc.list.length) enc.state = 'idle';
          G.quest && G.quest.onEncounter(enc);
        }
      } else if (enc.state === 'awake') {
        comeRound(enc, dt);
        if (!enc.list.length) { enc.state = 'idle'; enc.cleared = true; G.quest && G.quest.onEncounterCleared(enc); }
        else if (d > (enc.r || 30) + 130) { for (const e of enc.list.slice()) { dropToken(e); free(e); } enc.state = 'idle'; enc.cool = 8; }
      }
    }
    for (let i = awake.length - 1; i >= 0; i--) {
      const e = awake[i];
      if (!held(e, dt)) BRAIN[e.def.brain](e, dt);
      if (awake[i] !== e) continue;     // freed this step
      if (e.spun) continue;             // the column has him
      for (const o of awake) { if (o === e) continue; const d = e.pos.distanceTo(o.pos), min = e.r + o.r + 0.4; if (d < min && d > 0.001) { to.subVectors(e.pos, o.pos).normalize(); e.vel.addScaledVector(to, (min - d) * 6 * dt); } }
      const px = e.pos.x, pz = e.pos.z; e.pos.addScaledVector(e.vel, dt); if (e.def.flyer) ember.keepOut(e, dt); else collide(e, e.r * 0.8, px, pz, dt);
      // the last good place: a non-finite number here would spread to everything that reads it, so it stops at this line and names itself
      // and it's refused if it ends with his centre inside a solid: a knock up a slope under a rock has the rock pushing down and the bed pushing up, which cancel, and neither says so
      if (Number.isFinite(e.pos.x + e.pos.y + e.pos.z + e.vel.x + e.vel.y + e.vel.z)) {
        probe.x = e.pos.x; probe.y = -e.pos.z; probe.z = e.pos.y;
        if (!G.world.collide(probe, 0.05)) (e.safe || (e.safe = new THREE.Vector3())).copy(e.pos); else if (e.safe) { e.pos.copy(e.safe); e.vel.multiplyScalar(-0.3); }
      }
      else { if (!e.nanTold) { e.nanTold = true; console.error('foe went non-finite', e.kind, e.state, e.enc && e.enc.id, JSON.stringify({ pos: [String(e.pos.x), String(e.pos.y), String(e.pos.z)], from: [px, pz], blow: e.blow && e.blow.id, t: e.t, slow: e.slow, pull: e.pull, launched: e.launched, frozen: e.frozen, missile: e.missile, vel: [e.vel.x, e.vel.y, e.vel.z] })); } e.pos.copy(e.safe || e.home); e.vel.set(0, 0, 0); }
      const sp = e.vel.length(), fishy = e.fishy;
      if (e.frozen > 0 || e.def.flyer) continue;
      if (sp > 0.6) { const y = Math.atan2(e.vel.x, e.vel.z); e.heading = wrap(e.heading + wrap(y - e.heading) * (1 - Math.exp(-(fishy ? 5 : 7) * dt))); }
      if (!fishy && e.state !== 'dead' && e.state !== 'swimTo') { const y = Math.atan2(h.pos.x - e.pos.x, h.pos.z - e.pos.z); e.heading = wrap(e.heading + wrap(y - e.heading) * (1 - Math.exp(-8 * dt))); }
      if (fishy && e.state === 'tell') { const y = Math.atan2(h.pos.x - e.pos.x, h.pos.z - e.pos.z); e.heading = wrap(e.heading + wrap(y - e.heading) * (1 - Math.exp(-6 * dt))); }
    }
    stepShots(dt); ember.step(dt);
  }

  const tipW = new THREE.Vector3();
  function animate(dt) {
    ember.frame(dt);
    swim.amp.value = 1 + (packT > 0 ? 0.6 : 0);
    if (packT > 0) {
      packT -= dt; const dist = (1.9 - packT) * 30 - 16;
      packQ.setFromUnitVectors(AZ, packDir);
      for (const p of pack) { p.g.visible = packT > 0; p.g.quaternion.copy(packQ); to.copy(p.off).applyQuaternion(packQ); p.g.position.copy(packFrom).add(to).addScaledVector(packDir, dist); }
      for (const e of awake) { if (e.hp <= 0 || packHit.has(e)) continue; to.subVectors(e.pos, packFrom); const a = to.dot(packDir); if (a > dist + 4 || a < dist - 12) continue; if (to.addScaledVector(packDir, -a).length() < 9) { packHit.add(e); e.onHit(70, packFrom, 'atk3', { heavy: true, knock: 10, stun: 1.1, poise: 40 }); G.fx.sparks(e.pos, 12, 0xbdf7ff, 7); G.audio.hit(true); } }
      if (G.boss && G.boss.active && !packHit.has(G.boss)) { to.subVectors(G.boss.head, packFrom); const a = to.dot(packDir); if (a < dist + 4 && a > dist - 12 && to.addScaledVector(packDir, -a).length() < 12) { packHit.add(G.boss); G.boss.headT.onHit(90, packFrom, 'atk3'); } }
    }
    for (const e of awake) {
      const g = e.slot.g; g.position.copy(e.draw || e.pos); if (e.hidden) continue;
      e.u.uFlash.value *= Math.exp(-16 * dt);
      if (e.def.flyer) { ember.draw(e, dt); continue; }
      if (e.state === 'dead') e.u.uFade.value = Math.min(1, e.u.uFade.value + dt * 1.25);
      qY.setFromAxisAngle(AY, e.heading);
      if (e.flA > 0) { e.flT += dt; if (e.flT > 0.8) e.flA = 0; }
      if (e.def.body === 'reaver') {
        const goal = e.onLand ? 0 : e.state === 'swimTo' ? clamp(e.vel.length() / 6, 0, 1) * 1.25 : 0.14; if (e.frozen <= 0) e.tilt = damp(e.tilt, goal, 6, dt);
        g.position.y -= 0.9 * Math.cos(e.tilt); qX.setFromAxisAngle(AX, e.tilt); g.quaternion.copy(qY).multiply(qX);
        if (e.flA > 0) { flAxis.set(e.flZ, 0, -e.flX); qF.setFromAxisAngle(flAxis, Math.sin(Math.min(1, e.flT / 0.05) * 1.5708) * Math.exp(-e.flT * 6.5) * e.flA); g.quaternion.premultiply(qF); }
        if (e.slot.mixer && e.frozen <= 0) { const t = G.hitstop > 0 ? dt * 0.08 : dt; e.slot.mixer.update(t); if (e.slot.still) e.slot.still.apply(t); }
        drawRag(e, dt);
        if (e.state === 'tell') G.fx.edge(e.pos, e.blow && e.blow.unblockable);
        if (e.state === 'tell' && e.slot.tip && G.fx.glint) { e.slot.tip.getWorldPosition(tipW); G.fx.glint(tipW, e.blow && e.blow.unblockable ? 0xff4422 : 0xffb238, clamp(e.clock / e.blow.tell_s, 0, 1)); }
      } else {
        const p = Math.atan2(e.vel.y, Math.hypot(e.vel.x, e.vel.z)); qX.setFromAxisAngle(AX, -p); qR.setFromAxisAngle(AZ, e.roll); g.quaternion.copy(qY).multiply(qX).multiply(qR);
        if (e.flA > 0) { flAxis.set(e.flZ, 0, -e.flX); qF.setFromAxisAngle(flAxis, Math.sin(Math.min(1, e.flT / 0.05) * 1.5708) * Math.exp(-e.flT * 6.5) * e.flA); g.quaternion.premultiply(qF); }
        if (e.def.lure && e.state !== 'dead' && G.fx.glint) { tipW.copy(e.pos); tipW.y += 1.1 * (e.def.scale || 1); tipW.x += Math.sin(e.heading) * 1.5; tipW.z += Math.cos(e.heading) * 1.5; G.fx.glint(tipW, 0x9ffff0, 0.28 + 0.14 * Math.sin(G.time * 3)); }
        if (e.state === 'tell') G.fx.edge(e.pos, !!(e.blow && e.blow.unblockable));
        if (e.state === 'tell' && G.fx.glint) { tipW.copy(e.pos); tipW.y += 0.5; tipW.x += Math.sin(e.heading) * 1.4; tipW.z += Math.cos(e.heading) * 1.4; G.fx.glint(tipW, 0xffb238, clamp(e.clock / e.blow.tell_s, 0, 1)); }
      }
      if (e.stagger > 0 && G.fx.glint) { tipW.copy(e.pos); tipW.y += 1.5; G.fx.glint(tipW, 0xfff0a0, 0.12 + 0.1 * Math.sin(G.time * 11)); }
    }
  }

  return {
    step, animate,
    keep() { for (const e of awake) { if (!e.prev) { e.prev = e.pos.clone(); e.draw = e.pos.clone(); } e.prev.copy(e.pos); } },
    blend(a) { for (const e of awake) { if (e.prev) e.draw.lerpVectors(e.prev, e.pos, a); } ember.blend(a); },
    alive: () => awake.filter((e) => e.hp > 0 && !e.hidden),   // what can be seen and struck; count() knows about a moray still in its hole
    count: () => awake.filter((e) => e.hp > 0).length, kindAt, rosterOf,
    all: () => awake,
    encounters,
    spawn(kind, p, enc = null) { const k = FOES[kind] && FOES[kind].body !== 'reaver' && !FOES[kind].walker && !FOES[kind].flyer && !wet(p) ? 'reaver' : kind, e = makeEnemy(k, enc, placeFor(k, enc, p.clone())); if (e && enc) enc.list.push(e); return e; },
    freeze(e) { freeze(e, true); },
    // the spout: what's near is drawn in and round; what reaches it is picked up, spun up the column, and thrown
    spout(base, topY, dt) {
      const Q = D.spout; for (const e of awake) { if (e.hp <= 0 || e.hidden || e.spun || e.frozen > 0) continue; const dx = e.pos.x - base.x, dz = e.pos.z - base.z, d = Math.hypot(dx, dz) || 1; if (d > Q.pull_m) continue;
        const k = 1 - d / Q.pull_m, ux = dx / d, uz = dz / d; e.vel.x += (-ux * Q.draw + -uz * Q.swirl) * (0.4 + k) * dt * 12; e.vel.z += (-uz * Q.draw + ux * Q.swirl) * (0.4 + k) * dt * 12;
        if (d < Q.grab_m) { dropToken(e); endTell(e); e.state = 'stun'; e.t = 30; e.spun = { a: Math.atan2(dz, dx), r: Math.max(d, Q.radius_m * 1.5), y: e.pos.y, t: Q.spun_s, hitT: 0.3, top: Math.min(topY - 3, Math.max(e.pos.y, 0) + Q.spun_up_m), base }; G.combat.log.push({ t: G.time, type: 'spun', foe: e.kind }); if (e.def.body === 'reaver') playClip(e, 'hit_front', 0.05, true); } } },
    pull(p, radius) { for (const e of awake) { if (e.hp <= 0 || e.frozen > 0) continue; const d = e.pos.distanceTo(p); if (d < radius) { to.subVectors(p, e.pos).normalize(); side.crossVectors(to, AY); e.vel.addScaledVector(to, 8).addScaledVector(side, 5); dropToken(e); endTell(e); e.state = 'stun'; e.t = 1.1; if (e.def.body === 'reaver') playClip(e, 'hit_front', 0.05, true); } } },
    drag(p, radius, dt) { for (const e of awake) { if (e.hp <= 0 || e.frozen > 0) continue; to.subVectors(p, e.pos); const d = to.length(); if (d < radius + 3 && d > 2.2) { to.multiplyScalar(1 / d); side.crossVectors(to, AY); e.vel.addScaledVector(to, 26 * dt).addScaledVector(side, 16 * dt); } } },
    grab(e, speed) { if (e.vel && e.frozen <= 0 && e.hp > 0) { dropToken(e); endTell(e); e.pull = { speed, t: 0.8 }; if (e.def.body === 'reaver' || e.def.flyer) playClip(e, 'hit_front', 0.05, true); } },
    waveFrom(p, dir) { /* the wave's front now lives in powers.js */ void p; void dir; },
    callPack(p, dir) { packFrom.copy(p); packDir.copy(dir).normalize(); packT = 1.9; packHit.clear(); G.life && G.life.scatter(p, 50); },
    spawnNear(p, n, kind = 'reaver') { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; makeEnemy(kind, null, placeFor(kind, null, p.clone().add(new THREE.Vector3(Math.cos(a) * 12, 2, Math.sin(a) * 12)))); } },
    clearAll() { for (const e of awake.slice()) { dropToken(e); free(e); } for (const s of shots) { s.on = false; s.m.visible = false; } },
    reset() { for (const enc of encounters) { if (enc.state === 'awake') { for (const e of enc.list.slice()) { dropToken(e); free(e); } enc.state = 'idle'; enc.cool = 4; } } },
  };
}
