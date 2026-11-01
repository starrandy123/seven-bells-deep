// Jumps from height and time: choose the apex and the time to it; gravity and take-off follow.
export const fromApex = (h, t) => ({ g: (2 * h) / (t * t), v: (2 * h) / t });
export const speedFor = (h, g) => Math.sqrt(2 * g * h), timeFor = (h, g) => Math.sqrt((2 * h) / g);
export function moved(p, v, g, dt) {      // after v.y -= g·dt: the step's MEAN velocity, so the apex designed is the apex reached
  p.x += v.x * dt; p.y += v.y * dt + 0.5 * g * dt * dt; p.z += v.z * dt; return p;
}
/* how hard a press cut short brings the rise down: the gravity multiple that ends a rise from v at height `h` above where it was cut */
export const cutGravity = (v, h) => (v * v) / (2 * h);
