// Aiming a chain at a world direction, as a look-at node does: the turn from where the face points to where it should is cut into shares from the chest up, so no one joint takes it all, and it stops where a neck stops.
import * as THREE from 'three';
const qH = new THREE.Quaternion(), qP = new THREE.Quaternion(), qD = new THREE.Quaternion(), F = new THREE.Vector3(), A = new THREE.Vector3(), L = new THREE.Vector3();
const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// chain: bones from the chest up; shares: each one's part, summing to 1; head: the last bone; face: the way the face points, in the head's own space; goal: a unit vector in the world; most: the furthest it turns; k: how much of it (0 to 1)
// Past `most` the turn gives way as the goal goes round behind him, to none at all straight behind, so a goal crossing his back takes the head through its rest instead of
// throwing it from one shoulder to the other in a frame (the flip Godot's LookAtModifier3D, MIT, detects and blends through the rest pose)
export function aimChain(chain, shares, head, face, goal, most, k = 1) {
  head.getWorldQuaternion(qH); F.copy(face).applyQuaternion(qH); A.crossVectors(F, goal);
  const sn = A.length(); if (sn < 1e-4) return 0; A.divideScalar(sn);
  const raw = Math.atan2(sn, F.dot(goal)), behind = raw > most ? 1 - smooth01((raw - most) / Math.max(Math.PI - most, 1e-3)) : 1, ang = Math.min(raw, most) * k * behind;
  for (let i = 0; i < chain.length; i++) { const b = chain[i]; b.parent.getWorldQuaternion(qP); L.copy(A).applyQuaternion(qP.invert()); qD.setFromAxisAngle(L, ang * shares[i]); b.quaternion.premultiply(qD); }
  return ang;
}
// the way a head faces, in its own space, from its bind pose in a rig that faces +Z
export const faceIn = (headWorldQ) => new THREE.Vector3(0, 0, 1).applyQuaternion(headWorldQ.clone().invert());

// Where a look points and how much it looks, both eased, so a goal that jumps (a new target, a speed crossing a line, a blow starting) turns the head instead of snapping it.
// The direction follows its goal on a critically damped spring turned the short way round, and the weight on one of its own: simple_spring_damper_exact,
// Daniel Holden, Spring-It-On (MIT), the same spring as the flight's body (hero.js bodySpring). Plain numbers: nothing is made in a frame.
export const lookState = () => ({ x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, k: 0, kv: 0, on: false });
// s: the state; gx, gy, gz: the goal, a unit vector; k: the weight wanted; half, halfK: the half-lives of the turn and of the weight, seconds
export function lookSpring(s, gx, gy, gz, k, dt, half = 0.12, halfK = 0.1) {
  if (!s.on) { s.x = gx; s.y = gy; s.z = gz; s.vx = s.vy = s.vz = 0; s.on = true; }
  if (dt > 0) {
    // the offset from the goal to where it looks, as an angle times its axis
    let ax = gy * s.z - gz * s.y, ay = gz * s.x - gx * s.z, az = gx * s.y - gy * s.x; const sn = Math.hypot(ax, ay, az), cs = gx * s.x + gy * s.y + gz * s.z, th = Math.atan2(sn, cs);
    if (sn > 1e-7) { ax /= sn; ay /= sn; az /= sn; } else if (cs < 0) { ax = -gz; ay = 0; az = gx; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l; if (Math.hypot(ax, az) < 0.5) { ax = 1; ay = 0; az = 0; } } else { ax = 0; ay = 1; az = 0; }
    const y = (2 * 0.69314718) / half, e = Math.exp(-y * dt), j0x = ax * th, j0y = ay * th, j0z = az * th, j1x = s.vx + j0x * y, j1y = s.vy + j0y * y, j1z = s.vz + j0z * y;
    const ox = e * (j0x + j1x * dt), oy = e * (j0y + j1y * dt), oz = e * (j0z + j1z * dt); s.vx = e * (s.vx - j1x * y * dt); s.vy = e * (s.vy - j1y * y * dt); s.vz = e * (s.vz - j1z * y * dt);
    // where it looks now: the goal turned by what's left of the offset (Rodrigues)
    const phi = Math.hypot(ox, oy, oz);
    if (phi < 1e-7) { s.x = gx; s.y = gy; s.z = gz; }
    else { const ux = ox / phi, uy = oy / phi, uz = oz / phi, c = Math.cos(phi), sp = Math.sin(phi), d = ux * gx + uy * gy + uz * gz; s.x = gx * c + (uy * gz - uz * gy) * sp + ux * d * (1 - c); s.y = gy * c + (uz * gx - ux * gz) * sp + uy * d * (1 - c); s.z = gz * c + (ux * gy - uy * gx) * sp + uz * d * (1 - c); const l = Math.hypot(s.x, s.y, s.z) || 1; s.x /= l; s.y /= l; s.z /= l; }
    const yk = (2 * 0.69314718) / halfK, ek = Math.exp(-yk * dt), k0 = s.k - k, k1 = s.kv + k0 * yk; s.k = Math.min(1, Math.max(0, ek * (k0 + k1 * dt) + k)); s.kv = ek * (s.kv - k1 * yk * dt);
  }
  return s;
}
