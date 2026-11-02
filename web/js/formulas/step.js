// A fixed simulation step, and the blend that draws between steps (Glenn Fiedler, "Fix Your Timestep!", its last section).
export const clock = (step, maxSteps) => ({ step, maxSteps, acc: 0, dropped: 0 });
export function advance(C, dt, run) {          // a frame's time as whole steps; a long frame runs maxSteps and drops the rest, counted
  C.acc += dt; let n = 0;
  // a microsecond short of a step is a step: sums of a snapped frame time land on the step itself, and rounding must not leave one frame with none and the next with two
  while (C.acc >= C.step - 1e-6 && n < C.maxSteps) { run(C.step, n); C.acc -= C.step; n++; }
  if (C.acc >= C.step) { C.dropped += Math.floor(C.acc / C.step); C.acc = 0; }
  return n;
}
export const alpha = (C) => Math.min(1, Math.max(0, C.acc / C.step));
export const mix = (a, b, t) => a + (b - a) * t;
