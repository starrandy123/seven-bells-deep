// The man in red's palms, and the turn that puts them to the ground whenever his jets hold him up: the man the player flies (body.js) and every man in red the game flies (ember.js).
// Randy, 2 Nov: "The hands of the fire guy need to face down when in thrust", then, of the hover and the men in red, "Okay let's fix these".
// Each palm in its hand bone's own frame, measured off the skinned mesh (web/assets/ember.glb): the vertices weighted to the hand and their principal axes. n is the flattest, the palm's
// normal, on the side the fingers curl to (Pipeline/hero/base.py turns each finger "towards the palm"); a is the longest, from the wrist to the fingers; c is the middle of the palm.
// The look: a skydiver's track, arms at the sides and palms down; a jet suit's arm jets aimed at the ground and a little back; and the palm-thruster game's rule, palms down hovers
// (Pipeline/research/FLIGHT_SOURCES.md). The held flight arms bend each wrist 75° the palm's way with the palm up, so the turn over is most of a half turn of the hand about the forearm.
// One shape of hand from a hover to a boost: the hand turned over and lying along the forearm, then bent back at the wrist until the palm meets the ground. Standing on his jets that's a
// right angle, lying flat at speed it's a few degrees: no speed changes the turn over, so none can pop a wrist.
import * as K from './ik.js';

export const PALM = {
  R: { n: [0.9524, 0.114, 0.2828], a: [-0.0852, 0.99, -0.1123], c: [-0.013, 0.07, -0.008] },
  L: { n: [-0.8333, -0.4124, -0.3683], a: [-0.3113, 0.9004, -0.3039], c: [-0.017, 0.067, -0.018] },
};
// the forearm's share of the turn over, as a rig's forearm twist bone takes half the hand's roll, so no one ring of the sleeve is wrung. The most the last turn may change, rad/s, well
// under the 40 rad/s no joint may turn (Pipeline/research/POSE_SOURCES.md). The most the wrist bends back for it, rad: a wrist extends about 70°, and to 90° pushed
export const PALM_FORE = 0.5, PALM_FIX = 6, PALM_BEND = 1.6;
const ID = [0, 0, 0, 1];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// a share t of a turn q, about its own axis
export const part = (q, t) => { const s = Math.hypot(q[0], q[1], q[2]); if (s < 1e-6) return ID.slice(); const g = q[3] < 0 ? -1 : 1; return K.qaxis([q[0] * g, q[1] * g, q[2] * g], 2 * Math.atan2(s, Math.abs(q[3])) * t); };

// The turn over, worked out once for a held arm. q(name): the held arm's local turns; s: 'R' or 'L'; handAt: the hand bone's place on its forearm; chest: the chest bone's turn at rest, in his own
// space, where he faces +z. Gives the turn, in the hand's own frame, from the held hand to one that lies along its forearm with the palm to his front, and how much of it is about the forearm's own length
export function palmTurn(q, s, handAt, chest) {
  const fq = K.qmul(K.qmul(q('clav_' + s), q('arm_' + s)), q('fore_' + s)), front = K.qrot(K.qconj(fq), K.qrot(K.qconj(chest), [0, 0, 1]));
  const ax = K.unit(handAt), P = PALM[s], hq = q('hand_' + s);
  let D = K.qmul(K.qconj(hq), K.turn(K.frame(P.a, P.n), K.frame(ax, front))); if (D[3] < 0) D = D.map((x) => -x);
  const E = K.qmul(K.qmul(hq, D), K.qconj(hq));
  return { D, ax, twist: 2 * Math.atan2(K.dot(E, ax), E[3]) };
}

// The turn over by w (0 to 1), and the last turn to the ground, fix, by w too, on a forearm's and its hand's local turns, both written in place. The forearm takes its share about its own length,
// so in the world the hand is where the turns alone would put it
export function turnOver(T, fix, w, fore, hand) {
  const r = K.qaxis(T.ax, T.twist * PALM_FORE * w), f = K.qmul(fore, r), l = K.qmul(K.qmul(K.qconj(r), hand), K.qmul(part(T.D, w), part(fix, w)));
  for (let k = 0; k < 4; k++) { fore[k] = f[k]; hand[k] = l[k]; }
}

// The last turn to the ground, kept in the hand's own frame and moved, never jumped. W: the hand's turn in the world as drawn, with fix at w in it; dn: the way down. fix goes toward the turn that
// takes the palm the rest of the way, no faster than `most` radians this frame. Never more than PALM_BEND; and none from straight up, where the shortest way round is no way at all
export function toGround(fix, W, s, dn, w, most) {
  const W1 = K.qmul(W, K.qconj(part(fix, w))), p = K.qrot(W1, PALM[s].n), c = Math.max(-1, Math.min(1, K.dot(p, dn))), a = Math.min(Math.acos(c), PALM_BEND) * smooth(-1, -0.85, c);
  const want = a > 1e-4 ? K.qmul(K.qmul(K.qconj(W1), K.qaxis(K.cross(p, dn), a)), W1) : ID, d = K.qmul(K.qconj(fix), want);
  const g = 2 * Math.atan2(Math.hypot(d[0], d[1], d[2]), Math.abs(d[3])), to = g > most ? K.qmul(fix, part(d, most / g)) : want;
  for (let k = 0; k < 4; k++) fix[k] = to[k];
}
