// Inertialization (David Bollo, "Inertialization: High-Performance Animation Transitions in Gears of War", GDC 2018). A switch is instant; what the eye would see as a pop
// is carried as an offset from the new pose that dies away on a quintic, starting at the pose's real position, speed and an acceleration, ending at rest. Never a cross-fade.
export function quintic(x0, v0, t1) {
  let T = t1, v = v0;
  if (x0 > 0 ? v > 0 : v < 0) v = 0;                                    // moving away from the new pose: start it from rest, so it never overshoots outward
  if (Math.abs(v) > 1e-9) { const m = Math.abs((-5 * x0) / v); if (m < T) T = m; }  // already arriving fast: land sooner rather than swing through
  T = Math.max(T, 1e-3);
  const T2 = T * T;
  let a0 = (-8 * v * T - 20 * x0) / T2;
  if (x0 >= 0 ? a0 < 0 : a0 > 0) a0 = 0;
  const A = -(a0 * T2 + 6 * v * T + 12 * x0) / (2 * T2 * T2 * T);
  const B = (3 * a0 * T2 + 16 * v * T + 30 * x0) / (2 * T2 * T2);
  const C = -(3 * a0 * T2 + 12 * v * T + 20 * x0) / (2 * T2 * T);
  return { x0, v, a0, A, B, C, T };
}
export function at(c, t) {
  if (t >= c.T) return 0;
  return (((((c.A * t + c.B) * t + c.C) * t + c.a0 / 2) * t + c.v) * t) + c.x0;
}
