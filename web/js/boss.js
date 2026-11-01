// The Leviathan: a 60 m sea serpent. The mesh is a straight tube along z; the vertex shader lays it along a path texture, and the path is
// a follow-the-leader chain behind the head, so the whole body pours through the arena after it.
import * as THREE from 'three';
import { W } from './config.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createKraken, createColossus } from './bosses2.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
const N = 128, RISE = 4.2;

function fallbackGeometry() { return new THREE.CylinderGeometry(0.4, 2.2, 60, 14, 120, false).rotateX(Math.PI / 2); }

// The head is one carved mesh with its lower jaw dropped 26 degrees about a hinge (Pipeline/world/gen_creatures.py). In three.js coordinates, along the serpent:
const HINGE_Y = 0.4, HINGE_Z = 23.75;
// teeth are part of the mesh, so the path bends them and the jaw carries them: ivory cones along each jaw's edge, plain position/normal/colour so they merge into a body of any layout
function withTeeth(src) {
  const plain = new THREE.BufferGeometry(), keep = ['position', 'normal', 'color', 'jawFix'], n = src.attributes.position.count;
  for (const k of keep) { const a = src.attributes[k]; if (!a) continue; const items = k === 'color' ? 3 : 3, out = new Float32Array(n * items); for (let i = 0; i < n; i++) { out[i * 3] = a.getX(i); out[i * 3 + 1] = a.getY(i); out[i * 3 + 2] = a.getZ(i); } plain.setAttribute(k, new THREE.BufferAttribute(out, items)); }
  if (src.index) plain.setIndex(Array.from(src.index.array));
  if (!plain.attributes.color || !plain.attributes.normal) return src;
  const parts = [plain.index ? plain.toNonIndexed() : plain], ivory = [0.6, 0.57, 0.46];   // under the serpent's own glow threshold, or a tooth burns white
  parts[0].setAttribute('jawFix', new THREE.BufferAttribute(new Float32Array(parts[0].attributes.position.count), 1));
  const tooth = (x, y, z, len, tip) => { const g = new THREE.ConeGeometry(0.1, len, 5, 1, true).toNonIndexed(); if (tip < 0) g.rotateX(Math.PI); g.translate(x, y + (tip * len) / 2, z); const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) { c[i] = ivory[0]; c[i + 1] = ivory[1]; c[i + 2] = ivory[2]; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); g.setAttribute('jawFix', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(tip < 0 ? 1 : 0), 1)); parts.push(g); };   // the upper row stays with the skull
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) {
    const t = i / 8, Y = -6.7 + t * 4.6, up = 0.42 - 0.04 * (Y + 7) - 0.02;                    // along the palate, head-local Blender Y to three.js z
    tooth(s * (0.72 + t * 0.42), up, 22.95 - Y, 0.5 - t * 0.14, -1);
    const a = 0.46, hy = -0.8, hz = 0.4, jy = Y, jz = 0.28, c_ = Math.cos(a), s_ = Math.sin(a), wy = (jy - hy) * c_ - (jz - hz) * s_ + hy, wz = (jy - hy) * s_ + (jz - hz) * c_ + hz;   // the lower row, dropped with the jaw
    tooth(s * (0.62 + t * 0.4), wz, 22.95 - wy, 0.4 - t * 0.1, 1);
  }
  const merged = mergeGeometries(parts.map((p) => { for (const k of Object.keys(p.attributes)) if (!keep.includes(k)) p.deleteAttribute(k); return p; }), false);
  return merged || src;
}

// One serpent, of any name: the Leviathan and the Frost Wyrm differ only in their row of combat.json. A mesh, a path and a head that hunts.
function makeSerpent(G, C) {
  const data = G.world.data, ar = data.arena || { x: 0, y: 0, z: -55, r: 45 }, centre = W(ar.x, ar.y, ar.z), tint = C.tint || [1, 1, 1];
  const src = G.creatures && G.creatures.serpent;
  const geo = src ? withTeeth(src.geometry) : fallbackGeometry();
  geo.computeBoundingBox(); const bb = geo.boundingBox, headZ = bb.max.z, len = bb.max.z - bb.min.z;
  const tex = new Float32Array(N * 4), pathTex = new THREE.DataTexture(tex, N, 1, THREE.RGBAFormat, THREE.FloatType);
  pathTex.minFilter = pathTex.magFilter = THREE.NearestFilter; pathTex.needsUpdate = true;
  const U = { uPath: { value: pathTex }, uHeadZ: { value: headZ }, uLen: { value: len }, uBT: { value: 0 }, uGlow: { value: 0.6 }, uStun: { value: 0 }, uJaw: { value: -0.38 }, uBossTint: { value: new THREE.Color(tint[0], tint[1], tint[2]) } };
  const mat = src ? src.material.clone() : new THREE.MeshStandardMaterial({ color: 0x0e2a3a, roughness: 0.42, metalness: 0.2 });
  G.look.patch(mat, {});
  const inner = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    if (inner) inner(s, r);
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>
      attribute float jawFix; uniform sampler2D uPath; uniform float uHeadZ, uLen, uBT, uJaw; varying float vS; varying vec3 vLoc;
      vec3 pathP(float s) { float f = clamp(s, 0.0, 1.0) * ${(N - 1).toFixed(1)}; int i = int(floor(f)); int j = min(i + 1, ${N - 1});
        return mix(texelFetch(uPath, ivec2(i, 0), 0).xyz, texelFetch(uPath, ivec2(j, 0), 0).xyz, fract(f)); }`)
      .replace('#include <beginnormal_vertex>', `
      // the jaw: what lies under the palate and ahead of the hinge turns about it. uJaw 0 is as modelled, -0.46 shut, above 0 a wide gape
      vec3 jp = position; { float hY = 22.95 - jp.z, gape = -0.04 * (hY + 7.0) + 0.42 - 0.1, low = smoothstep(gape + 0.02, gape - 0.12, jp.y) * smoothstep(23.2, 24.0, jp.z) * (1.0 - jawFix);
        vec2 r = vec2(jp.z - ${HINGE_Z.toFixed(2)}, jp.y - ${HINGE_Y.toFixed(2)}); float ca = cos(uJaw * low), sa = sin(uJaw * low); jp.z = ${HINGE_Z.toFixed(2)} + r.x * ca + r.y * sa; jp.y = ${HINGE_Y.toFixed(2)} - r.x * sa + r.y * ca; }
      float sS = clamp((uHeadZ - jp.z) / uLen, 0.0, 1.0); vS = sS; vLoc = position;
      vec3 sT = normalize(pathP(sS - 0.012) - pathP(sS + 0.012) + vec3(0.0, 0.0, 1e-4));
      vec3 sR = normalize(cross(vec3(0.0, 1.0, 0.0), sT) + vec3(1e-4, 0.0, 0.0)); vec3 sU = cross(sT, sR);
      vec3 objectNormal = normalize(sR * normal.x + sU * normal.y + sT * normal.z);`)
      .replace('#include <begin_vertex>', `
      vec3 transformed = pathP(sS) + sR * jp.x + sU * jp.y;
      transformed += sR * sin(sS * 16.0 - uBT * 2.2) * 0.8 * smoothstep(0.05, 0.4, sS);`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uGlow, uStun; uniform vec3 uBossTint; varying float vS; varying vec3 vLoc;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec2 q = vec2(atan(vLoc.x, vLoc.y) * 6.0, vLoc.z * 1.5); q.x += 0.5 * floor(q.y); vec2 f = fract(q) - 0.5;
        float d = length(f * vec2(1.0, 1.5)); diffuseColor.rgb *= (0.5 + 0.72 * smoothstep(0.56, 0.1, d)) * uBossTint;
        // the inside of the mouth: dark wet red, going to black down the throat
        float inMouth = smoothstep(22.2, 23.2, vLoc.z) * smoothstep(1.7, 1.3, abs(vLoc.x)) * smoothstep(-0.85, -0.55, vLoc.y) * smoothstep(1.05, 0.8, vLoc.y) * (1.0 - step(abs(vColor.r - 0.6) + abs(vColor.g - 0.57), 0.05));   // the teeth stay ivory
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.02, 0.0, 0.01), vec3(0.34, 0.05, 0.07), smoothstep(23.0, 27.0, vLoc.z)), inMouth); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = min(roughnessFactor, 0.42);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_COLOR
      { float m = max(vColor.r, max(vColor.g, vColor.b)); totalEmissiveRadiance += vColor.rgb * smoothstep(0.72, 1.0, m) * uGlow * 1.3; }
      #endif
      totalEmissiveRadiance += vec3(1.0, 0.8, 0.3) * uStun * smoothstep(0.1, 0.0, vS);`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : ''; mat.customProgramCacheKey = () => key + '|serpent';
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.visible = false; G.scene.add(mesh);

  const pts = []; for (let i = 0; i < N; i++) pts.push(new THREE.Vector3());
  const seg = len / (N - 1), head = new THREE.Vector3(), headV = new THREE.Vector3(), goal = new THREE.Vector3(), tmp = new THREE.Vector3();

  const orbs = [];
  const orbMat = new THREE.MeshBasicMaterial({ color: C.orb, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const orbGeo = new THREE.SphereGeometry(0.5, 12, 10);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(orbGeo, orbMat); m.visible = false; G.scene.add(m); orbs.push({ m, on: false, v: new THREE.Vector3(), t: 0 }); }

  const b = {
    id: C.id, name: C.name, active: false, dead: false, hp: C.hp, maxHp: C.hp, mode: 'rise', t: 0, angle: 0, phase: 1, stunned: 0, summoned: false,
    bodyT: { pos: new THREE.Vector3(), r: 2.4, onHit: (d, from, type, info) => hurt(d * 0.5 * took(info), type) },
    headT: { pos: new THREE.Vector3(), r: 2.8, onHit: (d, from, type, info) => hurt(d * (b.stunned > 0 ? 2 : 1) * took(info), type) },
  };
  b.facing = new THREE.Vector3(0, 0, 1);    // where the head points: for anything that frames it
  const took = (info) => (C.takes && info && C.takes[info.element]) || 1;
  G.bosses = G.bosses || {}; G.bosses[C.id] = b;
  const jawTo = (a, k, dt) => { U.uJaw.value = damp(U.uJaw.value, a, k, dt); };
  const tell = (blow, s) => { G.combat.log.push({ t: G.time, type: 'tell', foe: C.id, blow, tell_s: s }); G.audio.tell && G.audio.tell(false); };

  function hurt(d) {
    if (!b.active || b.dead) return; b.hp -= d; U.uGlow.value = 1.6;
    if (b.hp <= 0) { b.hp = 0; b.dead = true; b.mode = 'die'; b.t = 7; G.audio.roar(); G.quest && G.quest.onBossDead(C.id); G.look.setMood('victory', 1); }
  }

  function wake() {
    if (b.active) return;
    G.boss = b; { const nameEl = document.querySelector('#bossbar b'); if (nameEl) nameEl.textContent = C.name.toUpperCase(); }
    if (!C.arena) { const h = G.hero, floor = G.world.heightAt(h.pos.x, -h.pos.z); centre.set(h.pos.x, Math.min(-6, floor + 8), h.pos.z); }
    b.active = true; mesh.visible = true; b.mode = 'rise'; b.t = b.riseLen = C.intro_s || RISE; b.introYaw = G.camYaw + Math.PI; b.stunned = 0; b.summoned = false; b.roared = false; U.uJaw.value = -0.42;   // its wounds stay: a second try starts where the last one ended
    head.copy(centre).add(new THREE.Vector3(0, -1, 0)); head.y = Math.max(head.y, G.world.heightAt(head.x, -head.z) + 2.4); for (let i = 0; i < N; i++) { const a = i * 0.22, r = 3 + i * 0.09; pts[i].copy(head).add(tmp.set(Math.cos(a) * r, -0.2 * i * seg * 0.06, Math.sin(a) * r)); }
    headV.set(0, 0, 0); G.audio.setMood('tense'); G.look.setMood('bossfight', 1); G.shake(0.5); G.fx.bubbles(head, 40, 6);
    G.ui.toast(C.name, C.hint, 5);
  }
  function stop() { b.active = false; mesh.visible = false; for (const o of orbs) { o.on = false; o.m.visible = false; } }

  function spit() {
    const h = G.hero; let n = 0;
    for (const o of orbs) { if (o.on || n >= 3 + (b.phase > 2 ? 2 : 0)) continue; o.on = true; o.m.visible = true; o.t = 4; o.m.position.copy(head); tmp.subVectors(h.pos, head).normalize(); tmp.x += (n - 1) * 0.3; tmp.y += (n - 1) * 0.14; o.v.copy(tmp).multiplyScalar(12); n++; }
  }

  function step(dt) {
    if (!b.active) return;
    const h = G.hero, pc = b.hp / b.maxHp; b.phase = pc > 0.66 ? 1 : pc > 0.33 ? 2 : 3; b.t -= dt; if (b.mode === 'rise' && b.t > RISE && !(G.cine && G.cine.active)) b.t = b.riseLen = RISE;      // no cinematic over it, or a skipped one: the short way up U.uBT.value += dt * (1 + (3 - b.phase) * 0); U.uGlow.value = damp(U.uGlow.value, 0.6, 3, dt);
    const speedUp = 1 + (b.phase - 1) * 0.22;
    switch (b.mode) {
      case 'rise': {
        // out of its coils, slow: the mouth stays shut until it stands over the arena, then it opens, and the sea takes the roar
        // with a cinematic over it, it swims a falling circle in first, and comes round to the camera to open its mouth
        // the spiral runs outward and ends on the camera's side, then straight at the lens: a body this long coils round anything inside it, so the head has to finish outside its own coils
        const long = b.riseLen > RISE, swing = long ? Math.max(0, Math.min(1, (b.t - 2.2) / (b.riseLen - 2.2))) : 0, turn = Math.max(0, swing - 0.22) / 0.78, an = turn * 5.5 + Math.atan2(Math.cos(b.introYaw), Math.sin(b.introYaw)), q = 1 - b.t / b.riseLen, R = long ? 26 * (1 - turn * 0.7) : 7;
        goal.copy(centre).add(tmp.set(Math.cos(an) * R, 16 - swing * 12, Math.sin(an) * R)); headV.lerp(tmp.subVectors(goal, head).multiplyScalar(0.55 + q), 1 - Math.exp(-2 * dt));
        if (!b.roared && b.t < 1.5) { b.roared = true; G.audio.roar(); G.shake(0.9); G.look.flash(head, C.roar, 26, 0.7); G.fx.ring(head.clone(), 26, 1.1, C.roar, tmp.subVectors(G.camera.position, head).normalize().clone()); G.fx.bubbles(head, 40, 5); G.life && G.life.scatter(head, 60); }
        jawTo(b.t < 1.5 ? 0.34 : -0.42, b.t < 1.5 ? 7 : 3, dt); U.uGlow.value = Math.max(U.uGlow.value, 0.4 + q * 2); if (b.roared && C.id === 'wyrm') G.fx.motes(head, 3, 'ice');
        if (b.t <= 0) { b.mode = 'circle'; b.t = 3.5; }
        break;
      }
      case 'circle': {
        // it coils around the Warden, not the arena: the body is always in reach and the head always a threat
        b.angle += dt * 0.95 * speedUp; const R = 12 + Math.sin(b.angle * 0.7) * 3;
        goal.set(h.pos.x + Math.cos(b.angle) * R, Math.min(-4, h.pos.y + 2 + Math.sin(b.angle * 1.9) * 4), h.pos.z + Math.sin(b.angle) * R);
        goal.lerp(centre, 0.12);
        tmp.subVectors(goal, head); const d = tmp.length() || 1; headV.lerp(tmp.multiplyScalar(17 * speedUp / d), 1 - Math.exp(-2.6 * dt));
        jawTo(-0.36 + Math.max(0, Math.sin(G.time * 0.8)) * 0.08, 4, dt);
        if (b.t <= 0) { const roll = Math.random(); if (b.phase >= 2 && !b.summoned && pc < 0.5) { b.summoned = true; G.enemies.spawnNear(h.pos, 2, C.summon); G.ui.tip(C.summon_tip, 3); b.t = 3; } else if (b.phase >= 2 && roll < 0.4) { b.mode = 'spit'; b.t = 1.1; tell('spit', 1.1); } else { b.mode = 'rear'; b.t = 1.25 / speedUp; tell('bite', b.t); G.audio.roar(); } }
        break;
      }
      case 'spit': headV.multiplyScalar(Math.exp(-3 * dt)); jawTo(0.1, 6, dt); U.uGlow.value = Math.max(U.uGlow.value, 1.4 + (1.1 - b.t) * 1.6); if (b.t <= 0) { spit(); U.uJaw.value = 0.3; b.mode = 'circle'; b.t = 3.5 / speedUp; } break;
      case 'rear': {
        tmp.subVectors(h.pos, head); const dr = tmp.length() || 1; goal.copy(head).addScaledVector(tmp, -(16 - Math.min(16, dr)) / dr); goal.y += 0.5; headV.lerp(tmp.subVectors(goal, head).multiplyScalar(5), 1 - Math.exp(-6 * dt)); U.uGlow.value = 2.4; G.shake(0.12); jawTo(0.42, 7, dt);
        if (b.t <= 0) { b.mode = 'bite'; b.t = 1.05; tmp.subVectors(h.pos, head).normalize(); headV.copy(tmp).multiplyScalar(27 * speedUp); b.bit = false; b.cue = false; }
        break;
      }
      case 'bite': {
        const d = head.distanceTo(h.pos);
        jawTo(d < 6 ? -0.46 : 0.46, d < 6 ? 30 : 8, dt);
        if (!b.cue && d < 22) { b.cue = true; G.ui.cue('parry'); }
        if (!b.bit && d < 3.8) { b.bit = true; const res = h.damage(C.bite, head, { heavy: true }); G.combat.log.push({ t: G.time, type: 'contact', foe: C.id, blow: 'bite', res }); if (res === 'parried') { b.mode = 'stun'; b.stunned = 4.5; b.t = 4.5; headV.multiplyScalar(-0.15); G.audio.roar(); G.look.flash(head, 0xffe7a8, 22, 0.5); G.ui.tip('Strike the head!', 3); } }
        if (b.t <= 0 && b.mode === 'bite') { b.mode = 'circle'; b.t = 4 / speedUp; }
        break;
      }
      case 'stun': {
        goal.set(head.x, Math.min(head.y, centre.y + 2.5), head.z); headV.lerp(tmp.subVectors(goal, head), 1 - Math.exp(-3 * dt)); U.uStun.value = 0.6 + Math.sin(G.time * 6) * 0.4; jawTo(0.08, 3, dt);
        b.stunned = b.t; if (b.t <= 0) { b.stunned = 0; U.uStun.value = 0; b.mode = 'circle'; b.t = 4; }
        break;
      }
      case 'die': {
        headV.y = damp(headV.y, -1.6, 0.8, dt); headV.x *= 0.98; headV.z *= 0.98; U.uStun.value = 0; jawTo(0.2, 1.2, dt); if (b.t <= 0) stop();
        break;
      }
    }
    head.addScaledVector(headV, dt);
    if (head.y > -3) head.y = -3;
    const floor = G.world.heightAt(head.x, -head.z) + 2.2; if (head.y < floor) head.y = floor;
    pts[0].copy(head); b.facing.subVectors(pts[0], pts[3]).normalize();
    for (let i = 1; i < N; i++) { tmp.subVectors(pts[i], pts[i - 1]); const d = tmp.length() || 1; pts[i].copy(pts[i - 1]).addScaledVector(tmp, seg / d); }
    for (const o of orbs) {
      if (!o.on) continue; o.t -= dt; o.m.position.addScaledVector(o.v, dt);
      if (o.m.position.distanceTo(h.pos) < 1.5) { o.on = false; o.m.visible = false; h.damage(C.spit, o.m.position); }
      if (o.t <= 0) { o.on = false; o.m.visible = false; }
    }
    b.headT.pos.copy(head);
  }

  function draw() {
    if (!b.active) return;
    for (let i = 0; i < N; i++) { tex[i * 4] = pts[i].x; tex[i * 4 + 1] = pts[i].y; tex[i * 4 + 2] = pts[i].z; tex[i * 4 + 3] = 1; }
    pathTex.needsUpdate = true;
  }

  b.lockPoint = (p) => {
    if (b.stunned > 0 || head.distanceTo(p) < 7) return b.headT;
    let best = 0, bd = 1e9; for (let i = 8; i < N; i += 8) { const d = pts[i].distanceTo(p); if (d < bd) { bd = d; best = i; } }
    b.bodyT.pos.copy(pts[best]); return b.bodyT;
  };
  b.strike = (p, reach, hit) => {
    if (head.distanceTo(p) < reach + 3) { hit(b.headT); return; }
    for (let i = 8; i < N; i += 8) { const r = 2.6 * (1 - i / N) + 0.6; if (pts[i].distanceTo(p) < reach + r) { b.bodyT.pos.copy(pts[i]); hit(b.bodyT); return; } }
  };
  b.waved = (p, dir) => {
    tmp.subVectors(head, p); const along = tmp.dot(dir); if (along < 0 || along > 40) return;
    if (tmp.addScaledVector(dir, -along).length() < 8) { hurt(70); G.fx.sparks(head, 16, 0xbdf7ff, 9); }
  };
  b.step = step; b.draw = draw; b.wake = wake; b.stop = stop; b.head = head; b.pos = head; b.frame = head; b.pts = pts; b.bearing = () => b.introYaw;      // it swims round to this before it opens its mouth
  G.fx.warmList.push(mesh);
  return b;
}

export function createBoss(G) {
  const R = G.combat.data.bosses, make = (id) => makeSerpent(G, { id, ...R[id] }), lev = make('leviathan');
  make('wyrm'); createKraken(G, { id: 'kraken', ...R.kraken }); createColossus(G, { id: 'colossus', ...R.colossus });
  G.boss = lev;       // the one the game is about right now: wake() moves this
  return lev;
}

