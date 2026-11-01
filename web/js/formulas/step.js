// A fixed simulation step, and the blend that draws between steps (Glenn Fiedler, "Fix Your Timestep!", its last section).
export const clock = (step, maxSteps) => ({ step, maxSteps, acc: 0, dropped: 0 });
export function advance(C, dt, run) {          // a frame's time as whole steps; a long frame runs maxSteps and drops the rest, counted
  C.acc += dt; let n = 0;
  while (C.acc >= C.step && n < C.maxSteps) { run(C.step, n); C.acc -= C.step; n++; }
  if (C.acc >= C.step) { C.dropped += Math.floor(C.acc / C.step); C.acc = 0; }
  return n;
}
export const alpha = (C) => Math.min(1, Math.max(0, C.acc / C.step));
export const mix = (a, b, t) => a + (b - a) * t;
