// A body thrown by a blow (Randy, 2 Nov: "We need rag doll physics and characters getting pushed back with these attacks"). Pipeline/research/RAGDOLL_SOURCES.md.
// The method is Thomas Jakobsen's, from the corpses in Hitman ("Advanced Character Physics", GDC 2001): a stick figure of particles moved by Verlet integration, its sticks kept by relaxation, a collision answered by projecting the point out. His text: "x += x-oldx+a*fTimeStep*fTimeStep", the correction shared between the two ends, an inequality on a distance for an angular limit, "orientation derived from particle positions for rendering". No engine and no wasm: fifteen points, a phone doesn't notice.
// Works on any body on the shared rig. It runs after the clips have been sampled and writes over them with a weight, so it blends in and out of whatever the body was doing.
import * as THREE from 'three';

const NAMES = ['hips', 'spine_3', 'head', 'arm_R', 'arm_L', 'fore_R', 'fore_L', 'hand_R', 'hand_L', 'leg_R', 'leg_L', 'shin_R', 'shin_L', 'foot_R', 'foot_L'], N = NAMES.length;
const HIP = 0, CHEST = 1, HEAD = 2, SR = 3, SL = 4, ER = 5, EL = 6, HR = 7, HL = 8, TR = 9, TL = 10, KR = 11, KL = 12, FR = 13, FL = 14;
// the trunk is braced so it holds its shape; the neck and the limbs are chains
const TRUNK = [[HIP, CHEST], [CHEST, SR], [CHEST, SL], [SR, SL], [HIP, TR], [HIP, TL], [TR, TL], [SR, TR], [SL, TL], [SR, TL], [SL, TR], [CHEST, TR], [CHEST, TL], [HIP, SR], [HIP, SL]];
const CHAIN = [[CHEST, HEAD], [SR, ER], [ER, HR], [SL, EL], [EL, HL], [TR, KR], [KR, FR], [TL, KL], [KL, FL]];
// how far a limb may fold, as a shortest distance between its ends: an inequality, as the paper has it
const FOLD = [[SR, HR, ER, 0.42], [SL, HL, EL, 0.42], [TR, FR, KR, 0.55], [TL, FL, KL, 0.55]];
const STEP = 1 / 60, RELAX = 4, SLIDE = 0.7 * 9.81 * STEP * STEP;

const a0 = new THREE.Vector3(), a1 = new THREE.Vector3(), a2 = new THREE.Vector3(), a3 = new THREE.Vector3(), mt = new THREE.Matrix4(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();

export function createRagdoll(model) {
  const bone = (n) => model.getObjectByName(n), B = NAMES.map(bone), P = new Float32Array(N * 3), O = new Float32Array(N * 3);
  if (!B.every(Boolean)) return null;
  const ORDER = ['hips', 'spine_1', 'spine_2', 'spine_3', 'neck', 'head', 'clav_R', 'arm_R', 'fore_R', 'hand_R', 'clav_L', 'arm_L', 'fore_L', 'hand_L', 'leg_R', 'shin_R', 'foot_R', 'leg_L', 'shin_L', 'foot_L'].map((n) => [n, bone(n)]).filter((x) => x[1]);
  const Q0 = new Map(), W = new Map(), DRAWN = new Map(); for (const [, b] of ORDER) { Q0.set(b, new THREE.Quaternion()); W.set(b, new THREE.Quaternion()); DRAWN.set(b, new THREE.Quaternion()); }
  const sticks = [], folds = [], at = (i, v) => v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  const qP0 = new THREE.Quaternion(), qC0 = new THREE.Quaternion(), dirs = new Map(), hipsWorld = new THREE.Vector3(), dHips = new THREE.Vector3();
  let acc = 0;
  const R = { on: false, w: 0, floor: -1e9, settled: 0, wet: false };

  // the figure's orientation at the hips and the chest, from its points: "orientation derived from particle positions"
  function basis(out, i, j, k, l) {
    at(i, a0); at(j, a1); a0.sub(a1).normalize(); at(k, a1); at(l, a2); a1.sub(a2).normalize(); a2.crossVectors(a0, a1).normalize(); a1.crossVectors(a2, a0).normalize();
    mt.makeBasis(a0, a1, a2); return out.setFromRotationMatrix(mt);
  }
  // v: the velocity the body had. push: what the blow adds, carried by the hips and chest with the arms, legs and head trailing behind. spin: radians a second, about its own axis through the hips
  R.start = (v, push, spin) => {
    model.updateMatrixWorld(true); const v3 = a3;
    for (let i = 0; i < N; i++) { B[i].getWorldPosition(v3); P[i * 3] = v3.x; P[i * 3 + 1] = v3.y; P[i * 3 + 2] = v3.z; }
    for (const [, b] of ORDER) { b.getWorldQuaternion(Q0.get(b)); DRAWN.get(b).copy(b.quaternion); }
    sticks.length = 0; folds.length = 0;
    const len = (i, j) => Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]);
    for (const [i, j] of TRUNK) sticks.push([i, j, len(i, j), 1]);
    for (const [i, j] of CHAIN) sticks.push([i, j, len(i, j), 1]);
    for (const [i, j, m, k] of FOLD) folds.push([i, j, (len(i, m) + len(m, j)) * k, m]);
    basis(qP0, TR, TL, CHEST, HIP); basis(qC0, SR, SL, CHEST, HIP); dirs.clear();
    for (const [a, b, n] of [[CHEST, HEAD, 'neck'], [SR, ER, 'arm_R'], [ER, HR, 'fore_R'], [SL, EL, 'arm_L'], [EL, HL, 'fore_L'], [TR, KR, 'leg_R'], [KR, FR, 'shin_R'], [TL, KL, 'leg_L'], [KL, FL, 'shin_L']]) { at(b, a0); at(a, a1); dirs.set(n, a0.sub(a1).normalize().clone()); }
    const lead = [1, 1, 0.5, 0.8, 0.8, 0.6, 0.6, 0.45, 0.45, 0.9, 0.9, 0.7, 0.7, 0.5, 0.5], wx = spin ? spin.x : 0, wy = spin ? spin.y : 0, wz = spin ? spin.z : 0, hx = P[0], hy = P[1], hz = P[2];
    for (let i = 0; i < N; i++) {
      const o = i * 3, rx = P[o] - hx, ry = P[o + 1] - hy, rz = P[o + 2] - hz, k = lead[i];
      O[o] = P[o] - (v.x + push.x * k + wy * rz - wz * ry) * STEP; O[o + 1] = P[o + 1] - (v.y + push.y * k + wz * rx - wx * rz) * STEP; O[o + 2] = P[o + 2] - (v.z + push.z * k + wx * ry - wy * rx) * STEP;
    }
    hipsWorld.set(P[0], P[1], P[2]); dHips.set(0, 0, 0); acc = 0; R.on = true; R.settled = 0; R.wet = false; R.w = 0;
  };
  function sub() {
    const g = R.wet ? -2.2 : -16 , keep = R.wet ? 0.93 : 0.998, gh = g * STEP * STEP;
    for (let i = 0; i < N * 3; i += 3) {
      const vx = (P[i] - O[i]) * keep, vy = (P[i + 1] - O[i + 1]) * keep, vz = (P[i + 2] - O[i + 2]) * keep;
      O[i] = P[i]; O[i + 1] = P[i + 1]; O[i + 2] = P[i + 2]; P[i] += vx; P[i + 1] += vy + gh; P[i + 2] += vz;
    }
    for (let it = 0; it < RELAX; it++) {
      for (const s of sticks) {
        const a = s[0] * 3, b = s[1] * 3, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-5, k = (0.5 * s[3] * (d - s[2])) / d;
        P[a] += dx * k; P[a + 1] += dy * k; P[a + 2] += dz * k; P[b] -= dx * k; P[b + 1] -= dy * k; P[b + 2] -= dz * k;
      }
      for (const s of folds) {
        const a = s[0] * 3, b = s[1] * 3, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-5; if (d >= s[2]) continue; const k = (0.5 * (d - s[2])) / d;
        P[a] += dx * k; P[a + 1] += dy * k; P[a + 2] += dz * k; P[b] -= dx * k; P[b + 1] -= dy * k; P[b + 2] -= dz * k;
      }
    }
    hingeTo(); floor();
  }
  // a knee bends one way and an elbow the other: the middle joint is pushed back to the side it belongs on
  function hingeTo() {
    at(SR, a0); at(SL, a1); a0.sub(a1); at(CHEST, a1); at(HIP, a2); a1.sub(a2); a2.crossVectors(a0, a1).normalize(); const fx = a2.x, fy = a2.y, fz = a2.z;
    for (const [m, x, y, s] of [[KR, TR, FR, 1], [KL, TL, FL, 1], [ER, SR, HR, -1], [EL, SL, HL, -1]]) { const o = m * 3, ax = x * 3, ay = y * 3, mx = P[o] - (P[ax] + P[ay]) * 0.5, my = P[o + 1] - (P[ax + 1] + P[ay + 1]) * 0.5, mz = P[o + 2] - (P[ax + 2] + P[ay + 2]) * 0.5, d = (mx * fx + my * fy + mz * fz) * s; if (d < 0.02) { const k = (0.02 - d) * s * 0.5; P[o] += fx * k; P[o + 1] += fy * k; P[o + 2] += fz * k; } }
  }
  function floor() {
    const f = R.floor; let moved = 0; R.down = 0;
    for (let i = 0; i < N; i++) {
      const o = i * 3, r = i === HEAD ? 0.13 : i <= CHEST ? 0.16 : 0.08; moved += Math.abs(P[o] - O[o]) + Math.abs(P[o + 1] - O[o + 1]) + Math.abs(P[o + 2] - O[o + 2]);
      // on the ground it slides on friction of about 0.7, the figure for a body on a road, so a body down at 6 m/s stops in 2.6 m and at 10 m/s in 7 m
      if (P[o + 1] < f + r) { P[o + 1] = f + r; O[o + 1] = P[o + 1]; const dx = P[o] - O[o], dz = P[o + 2] - O[o + 2], sp = Math.hypot(dx, dz), k = sp > 1e-6 ? Math.max(0, sp - SLIDE) / sp : 0; O[o] = P[o] - dx * k; O[o + 2] = P[o + 2] - dz * k; if (i === HIP || i === CHEST) R.down = 1; }
    }
    R.settled = moved < 0.05 ? R.settled + STEP : 0;
  }
  // floorY: the ground under him. Above it, the sea is water if wet is true
  R.step = (dt, floorY, wet) => { if (!R.on) return; R.floor = floorY; R.wet = !!wet; acc = Math.min(acc + dt, 0.05); while (acc >= STEP) { acc -= STEP; sub(); } };
  R.hips = (out) => out.set(P[0], P[1], P[2]);
  // the velocity of the hips, for handing the body back to the flight or the walk
  R.velocity = (out) => out.set(P[0] - O[0], P[1] - O[1], P[2] - O[2]).multiplyScalar(1 / STEP);
  // shifts the whole figure: a wall or the end of the stage has moved him
  R.shift = (x, y, z) => { for (let i = 0; i < N * 3; i += 3) { P[i] += x; P[i + 1] += y; P[i + 2] += z; O[i] += x; O[i + 1] += y; O[i + 2] += z; } };
  // face up or face down, for which way he gets up
  R.faceUp = () => { at(SR, a0); at(SL, a1); a0.sub(a1); at(CHEST, a1); at(HIP, a2); a1.sub(a2); return a2.crossVectors(a0, a1).y > 0; };
  R.stop = () => { R.on = false; R.w = 0; };

  const aimed = (base, from, to, n, out) => { const d = dirs.get(n); at(to, a0); at(from, a1); a0.sub(a1).normalize(); a1.copy(d).applyQuaternion(base); q2.setFromUnitVectors(a1, a0); return out.copy(q2).multiply(base); };
  const dArm = new THREE.Quaternion(), dLeg = new THREE.Quaternion(), dP = new THREE.Quaternion(), dC = new THREE.Quaternion(), qS = new THREE.Quaternion(), tmp = new THREE.Vector3();
  // writes the figure over the pose the clips left, by weight w (0 the clips, 1 the figure). The model's matrices must be up to date.
  // dt: the frame's time. No bone turns past 40 rad/s from the frame before (POSE_SOURCES.md): the figure's limbs are read off its points, and a point thrown round by the
  // relaxation or the hinge turned a raider's forearm at up to 80 rad/s for a frame or two
  R.apply = (w, dt = 1 / 60) => {
    if (w <= 0.001) return; R.w = w;
    dP.copy(basis(q0, TR, TL, CHEST, HIP)).multiply(q1.copy(qP0).invert()); dC.copy(basis(q0, SR, SL, CHEST, HIP)).multiply(q1.copy(qC0).invert());
    const set = (n, d) => { const b = bone2.get(n); if (b) W.get(b).copy(d).multiply(Q0.get(b)); };
    set('hips', dP); set('spine_1', qS.copy(dP).slerp(dC, 0.33)); set('spine_2', qS.copy(dP).slerp(dC, 0.66)); set('spine_3', dC); set('clav_R', dC); set('clav_L', dC);
    aimed(dC, CHEST, HEAD, 'neck', dArm); set('neck', qS.copy(dC).slerp(dArm, 0.5)); set('head', dArm);
    aimed(dC, SR, ER, 'arm_R', dArm); set('arm_R', dArm); aimed(dArm, ER, HR, 'fore_R', dLeg); set('fore_R', dLeg); set('hand_R', dLeg);
    aimed(dC, SL, EL, 'arm_L', dArm); set('arm_L', dArm); aimed(dArm, EL, HL, 'fore_L', dLeg); set('fore_L', dLeg); set('hand_L', dLeg);
    aimed(dP, TR, KR, 'leg_R', dArm); set('leg_R', dArm); aimed(dArm, KR, FR, 'shin_R', dLeg); set('shin_R', dLeg); set('foot_R', dLeg);
    aimed(dP, TL, KL, 'leg_L', dArm); set('leg_L', dArm); aimed(dArm, KL, FL, 'shin_L', dLeg); set('shin_L', dLeg); set('foot_L', dLeg);
    const lim = Math.min(1.4, 40 * Math.max(dt, 1 / 240));
    for (const [, b] of ORDER) { const par = b.parent; if (W.has(par)) q0.copy(W.get(par)); else par.getWorldQuaternion(q0); q1.copy(q0).invert().multiply(W.get(b)); b.quaternion.slerp(q1, w); const d = DRAWN.get(b), a = 2 * Math.acos(Math.min(1, Math.abs(d.dot(b.quaternion)))); if (a > lim) b.quaternion.copy(d.slerp(b.quaternion, lim / a)); d.copy(b.quaternion); }
    const hp = B[0]; tmp.set(P[0], P[1], P[2]); hp.parent.worldToLocal(tmp); hp.position.lerp(tmp, w);
  };
  const bone2 = new Map(ORDER);
  return R;
}
