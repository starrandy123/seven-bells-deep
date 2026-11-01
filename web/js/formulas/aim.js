// Aiming a chain at a world direction, as a look-at node does: the turn from where the face points to where it should is cut into shares from the chest up, so no one joint takes it all, and it stops where a neck stops.
import * as THREE from 'three';
const qH = new THREE.Quaternion(), qP = new THREE.Quaternion(), qD = new THREE.Quaternion(), F = new THREE.Vector3(), A = new THREE.Vector3(), L = new THREE.Vector3();
// chain: bones from the chest up; shares: each one's part, summing to 1; head: the last bone; face: the way the face points, in the head's own space; goal: a unit vector in the world; most: the furthest it turns; k: how much of it (0 to 1)
export function aimChain(chain, shares, head, face, goal, most, k = 1) {
  head.getWorldQuaternion(qH); F.copy(face).applyQuaternion(qH); A.crossVectors(F, goal);
  const sn = A.length(); if (sn < 1e-4) return 0; A.divideScalar(sn);
  const ang = Math.min(Math.atan2(sn, F.dot(goal)), most) * k;
  for (let i = 0; i < chain.length; i++) { const b = chain[i]; b.parent.getWorldQuaternion(qP); L.copy(A).applyQuaternion(qP.invert()); qD.setFromAxisAngle(L, ang * shares[i]); b.quaternion.premultiply(qD); }
  return ang;
}
// the way a head faces, in its own space, from its bind pose in a rig that faces +Z
export const faceIn = (headWorldQ) => new THREE.Vector3(0, 0, 1).applyQuaternion(headWorldQ.clone().invert());
