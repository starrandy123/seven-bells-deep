// Second-order dynamics, one form for every spring: k2·y'' + k1·y' + y = x + k3·x', with k1 = z/(πf), k2 = 1/(2πf)², k3 = r·z/(2πf).
// f how fast; z damping (1 critical; below 1 a step overshoots by exp(−πz/√(1−z²))); r response (0 starts from rest; z 1, r 2 follows a steady ramp with no lag);
// cap the most |y''| may be. Stepped EXACTLY in its relative form, so the path is the same at any frame rate and stable at any step.
export function second({ f, z = 1, r = 0, cap = Infinity }) {
  const w = 2 * Math.PI * f; return { f, z, r, cap, w, k1: z / (Math.PI * f), k2: 1 / (w * w), k3: (r * z) / w };
}
const KEYS = ['x', 'y', 'z'], isVec = (a) => a !== null && typeof a === 'object', zero = (l) => (isVec(l) ? { x: 0, y: 0, z: 0 } : 0);
const copy = (x) => (isVec(x) ? { x: x.x, y: x.y, z: x.z } : x);
export const follower = (x = 0) => ({ u: zero(x), ud: zero(x), v: zero(x), x: copy(x), y: copy(x) });   // sitting on x
function exact(P, u0, v0, dt) {                // u'' = −w²u − 2zw·u' over dt, in closed form
  const w = P.w, z = P.z;
  if (Math.abs(z - 1) < 1e-4) { const c = v0 + w * u0, e = Math.exp(-w * dt); return [(u0 + c * dt) * e, (v0 - w * c * dt) * e]; }
  if (z < 1) { const a = z * w, b = w * Math.sqrt(1 - z * z), e = Math.exp(-a * dt), cs = Math.cos(b * dt), sn = Math.sin(b * dt);
    return [e * (u0 * cs + ((v0 + a * u0) / b) * sn), e * (v0 * cs - ((a * v0 + w * w * u0) / b) * sn)]; }
  const q = w * Math.sqrt(z * z - 1), r1 = -z * w + q, r2 = -z * w - q, A = (v0 - r2 * u0) / (r1 - r2), B = u0 - A, e1 = Math.exp(r1 * dt), e2 = Math.exp(r2 * dt);
  return [A * e1 + B * e2, r1 * A * e1 + r2 * B * e2];
}
/* RELATIVE: s.u (the follower's lag), s.ud (its rate), v the target's rate this step: for a target with no position (an attitude) */
export function carry(P, s, v, dt) {
  if (!(dt > 0)) return s.u;
  const vec = isVec(s.u), c = P.k3 - P.k1;
  if (vec) for (const k of KEYS) { const dv = v[k] - s.v[k]; s.u[k] -= c * dv; s.ud[k] -= dv; s.v[k] = v[k]; }   // a change of rate lands now
  else { const dv = v - s.v; s.u -= c * dv; s.ud -= dv; s.v = v; }
  if (!(P.cap < Infinity)) {
    if (vec) for (const k of KEYS) { const r = exact(P, s.u[k], s.ud[k], dt); s.u[k] = r[0]; s.ud[k] = r[1]; }
    else { const r = exact(P, s.u, s.ud, dt); s.u = r[0]; s.ud = r[1]; }
    return s.u;
  }
  // capped: sub-steps, each EXACT while the acceleration at its start and its end is within the cap; where the cap binds, the acceleration held at the cap
  const n = Math.max(1, Math.ceil(dt * 480 - 1e-9)), h = dt / n, w2 = P.w * P.w, d2 = 2 * P.z * P.w;
  for (let i = 0; i < n; i++) {
    if (vec) {
      const a = { x: -w2 * s.u.x - d2 * s.ud.x, y: -w2 * s.u.y - d2 * s.ud.y, z: -w2 * s.u.z - d2 * s.ud.z }, l = Math.hypot(a.x, a.y, a.z);
      let ex = l <= P.cap ? KEYS.map((q) => exact(P, s.u[q], s.ud[q], h)) : null;
      if (ex && Math.hypot(...ex.map(([u1, v1]) => -w2 * u1 - d2 * v1)) > P.cap) ex = null;
      if (ex) KEYS.forEach((q, j) => { s.u[q] = ex[j][0]; s.ud[q] = ex[j][1]; });
      else { const k = P.cap / l; for (const q of KEYS) { const aq = a[q] * k; s.u[q] += s.ud[q] * h + 0.5 * aq * h * h; s.ud[q] += aq * h; } }
    } else {
      const a = -w2 * s.u - d2 * s.ud; let ex = Math.abs(a) <= P.cap ? exact(P, s.u, s.ud, h) : null;
      if (ex && Math.abs(-w2 * ex[0] - d2 * ex[1]) > P.cap) ex = null;
      if (ex) { s.u = ex[0]; s.ud = ex[1]; } else { const ac = Math.sign(a) * P.cap; s.u += s.ud * h + 0.5 * ac * h * h; s.ud += ac * h; }
    }
  }
  return s.u;
}
/* ABSOLUTE: y follows a target x (a number or {x, y, z}); its rate over the step is (x − its last value) / dt */
export function chase(P, s, x, dt) {
  if (!(dt > 0)) return s.y;
  const vec = isVec(x), c = P.k3 - P.k1, v = vec ? { x: (x.x - s.x.x) / dt, y: (x.y - s.x.y) / dt, z: (x.z - s.x.z) / dt } : (x - s.x) / dt;
  carry(P, s, v, dt);
  if (vec) for (const k of KEYS) { s.x[k] = x[k]; s.y[k] = x[k] + c * v[k] + s.u[k]; } else { s.x = x; s.y = x + c * v + s.u; }
  return s.y;
}
/* a kick: the follower is pushed off its path with a speed (a landing into the knees); the path back is its own spring */
export function kick(s, dv) { s.ud += dv; }
/* FIRST-ORDER, exact: the share of the way in dt, never k·dt, which is another ease at every frame rate */
export const ease = (dt, tau) => (tau <= 0 ? 1 : 1 - Math.exp(-dt / tau));
export const first = (tau, y, x, dt) => y + (x - y) * ease(dt, tau);
/* the short way round to a target angle, so a follower of an angle never spins the long way */
export const nearAngle = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
