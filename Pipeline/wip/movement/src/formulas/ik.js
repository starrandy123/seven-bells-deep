// Two-bone IK with a real hinge, and turns as frames. Plain arrays and tuples: [x, y, z], quaternions [x, y, z, w], so the truth tests run with no renderer.
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a) => { const l = len(a); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0]; };

/* an orthonormal frame from a (kept) and b (made square to it): [a, b, a×b] */
export function frame(a, b) { const u = unit(a), d = dot(u, b), v = unit([b[0] - u[0] * d, b[1] - u[1] * d, b[2] - u[2] * d]); return [u, v, cross(u, v)]; }
/* the quaternion of the matrix with these columns */
export function quatOf(c) {
  const [[m00, m10, m20], [m01, m11, m21], [m02, m12, m22]] = c, tr = m00 + m11 + m22; let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  const l = Math.hypot(...q); return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
/* the turn that takes frame f0 to frame f1 */
export function turn(f0, f1) {
  const col = (k) => [0, 1, 2].map((r) => f1[0][r] * f0[0][k] + f1[1][r] * f0[1][k] + f1[2][r] * f0[2][k]);
  return quatOf([col(0), col(1), col(2)]);
}
export const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
export function qrot(q, v) {
  const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx];
}
/* the shortest turn taking direction a to direction b, both unit */
export const arc = (a, b) => { const c = cross(a, b), w = 1 + dot(a, b); if (w < 1e-6) return [1, 0, 0, 0]; const l = Math.hypot(c[0], c[1], c[2], w); return [c[0] / l, c[1] / l, c[2] / l, w / l]; };
export const qaxis = (a, r) => { const s = Math.sin(r / 2), u = unit(a); return [u[0] * s, u[1] * s, u[2] * s, Math.cos(r / 2)]; };

/* A limb's rest shape: root, joint and end at rest. hingeHint says which way the joint folds: a turn about it takes the upper bone's line towards the lower's. */
export function rest(A, K, E, hingeHint) {
  const d1 = unit(sub(K, A)), d2 = unit(sub(E, K)); let h = cross(d1, d2);
  if (len(h) < 1e-3 || dot(h, hingeHint) < 0) h = hingeHint;
  return { l1: len(sub(K, A)), l2: len(sub(E, K)), d1, d2, hinge: unit(h) };
}
/* Solves root S to end W with the joint on the side of `pole`. stretch keeps the limb under that share of straight. Returns the joint, the end reached and how far it missed. */
export function solve(R, S, W, pole, stretch = 0.98) {
  const v = sub(W, S), far = (R.l1 + R.l2) * stretch, near = Math.abs(R.l1 - R.l2) + 1e-3, l = len(v), d = Math.min(far, Math.max(near, l)), n = unit(v);
  const a = (R.l1 * R.l1 - R.l2 * R.l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(R.l1 * R.l1 - a * a, 0));
  let p = sub(pole, scale(n, dot(pole, n))); if (len(p) < 1e-4) p = sub([0, 0, 1], scale(n, n[2])); p = unit(p);
  const J = add(add(S, scale(n, a)), scale(p, h)), E = add(S, scale(n, d));
  return { J, E, miss: Math.max(0, l - d), share: d / (R.l1 + R.l2), perp: p };
}
/* The two world turns (from the rest pose) for a solved limb: a hinge between them, so no twist comes in between the bones */
export function turns(R, S, sol) {
  const d1 = unit(sub(sol.J, S)), d2 = unit(sub(sol.E, sol.J)); let h = cross(d1, d2);
  if (len(h) < 1e-3) h = cross(d1, scale(sol.perp, -1));
  h = unit(h);
  const q1 = turn(frame(R.d1, cross(R.hinge, R.d1)), frame(d1, cross(h, d1))), q2 = turn(frame(R.d2, cross(R.hinge, R.d2)), frame(d2, cross(h, d2)));
  return [q1, q2];
}
