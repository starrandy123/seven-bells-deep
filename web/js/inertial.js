// A clip changing can't make a limb jump: the change is instant, and what the old pose had becomes an offset that dies away on top of the new one, so nothing moves faster than the body could.
// Randy, 2 Nov: "The fighting looks very choppy". Measured over a duel, hands and feet hit 67 m/s for a frame as a clip began, three times a real kick. Pipeline/research/POSE_SOURCES.md
// The method is inertialization, Bollo, GDC 2018. The decay is Daniel Holden's spring.h, Motion-Matching (MIT), written here for a skeleton of plain arrays: no allocation in a frame, and nothing at all to do once the offsets are spent.
const HALF = 0.1, MOST = 25, DONE = 1e-3, POP = 40;

export function createInertial(model) {
  const bones = []; model.traverse((o) => { if (o.isBone && !/^(root|cape|hair|weapon)/.test(o.name)) bones.push(o); });
  const n = bones.length, hips = bones.find((o) => o.name === 'hips') || bones[0];
  // the last two poses out, the offset of each bone as a scaled angle-axis, and its velocity. Then the hips' position, the only bone that travels
  const Q0 = new Float32Array(n * 4), Q1 = new Float32Array(n * 4), X = new Float32Array(n * 3), V = new Float32Array(n * 3), P0 = new Float32Array(3), P1 = new Float32Array(3), PX = new Float32Array(3), PV = new Float32Array(3);
  let seen = 0, armed = false, on = false, half = HALF, last = 1 / 60;

  function keep() { Q1.set(Q0); P1.set(P0); for (let i = 0, k = 0; i < n; i++, k += 4) { const q = bones[i].quaternion; Q0[k] = q.x; Q0[k + 1] = q.y; Q0[k + 2] = q.z; Q0[k + 3] = q.w; } P0[0] = hips.position.x; P0[1] = hips.position.y; P0[2] = hips.position.z; seen = Math.min(2, seen + 1); }
  // log of a unit quaternion, twice: axis times angle. The short way round
  function saa(x, y, z, w, out, k) { if (w < 0) { x = -x; y = -y; z = -z; w = -w; } const s = Math.sqrt(x * x + y * y + z * z); const f = s < 1e-6 ? 2 : (2 * Math.atan2(s, w)) / s; out[k] = x * f; out[k + 1] = y * f; out[k + 2] = z * f; }
  const T = new Float32Array(3);
  function begin() {
    const dt = Math.max(last, 1 / 240);
    for (let i = 0, k = 0, j = 0; i < n; i++, k += 4, j += 3) {
      const b = bones[i].quaternion, ax = Q0[k], ay = Q0[k + 1], az = Q0[k + 2], aw = Q0[k + 3], bx = -b.x, by = -b.y, bz = -b.z, bw = b.w;
      // what's left between the last pose out and this one
      saa(aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz, X, j);
      // and how it was moving: the last pose over the one before
      const cx = -Q1[k], cy = -Q1[k + 1], cz = -Q1[k + 2], cw = Q1[k + 3];
      saa(aw * cx + ax * cw + ay * cz - az * cy, aw * cy - ax * cz + ay * cw + az * cx, aw * cz + ax * cy - ay * cx + az * cw, aw * cw - ax * cx - ay * cy - az * cz, T, 0);
      let vx = T[0] / dt, vy = T[1] / dt, vz = T[2] / dt; const s = Math.sqrt(vx * vx + vy * vy + vz * vz); if (s > MOST) { const f = MOST / s; vx *= f; vy *= f; vz *= f; } V[j] = vx; V[j + 1] = vy; V[j + 2] = vz;
    }
    for (let a = 0; a < 3; a++) { PX[a] = P0[a] - hips.position.getComponent(a); PV[a] = Math.max(-9, Math.min(9, (P0[a] - P1[a]) / dt)); }
    on = true;
  }
  function jumped(dt) {
    // anything that gets past a kick, a weight stepping or an action stopping, is caught by its size: no joint turns 40 rad/s
    const lim = Math.cos(Math.min(1.4, POP * dt) * 0.5);
    for (let i = 0, k = 0; i < n; i++, k += 4) { const q = bones[i].quaternion; if (Math.abs(q.x * Q0[k] + q.y * Q0[k + 1] + q.z * Q0[k + 2] + q.w * Q0[k + 3]) < lim) return true; }
    return false;
  }
  return {
    // a change this frame: h is how fast it dies away, in half-lives of a spring. Hit reactions want it short so the blow reads at once
    kick(h = HALF) { armed = true; half = h; },
    reset() { seen = 0; armed = false; on = false; X.fill(0); V.fill(0); PX.fill(0); PV.fill(0); },
    // after the mixer has written this frame's pose, before anything bends it
    apply(dt) {
      if (dt <= 0) return;
      if (seen === 2 && (armed || jumped(dt))) begin(); armed = false; last = dt;
      if (on) {
        const y = (2 * Math.LN2) / half, e = Math.exp(-y * dt); let most = 0;
        for (let i = 0, k = 0; i < n; i++, k += 3) {
          const j0x = X[k], j0y = X[k + 1], j0z = X[k + 2], j1x = V[k] + j0x * y, j1y = V[k + 1] + j0y * y, j1z = V[k + 2] + j0z * y;
          const ox = e * (j0x + j1x * dt), oy = e * (j0y + j1y * dt), oz = e * (j0z + j1z * dt); X[k] = ox; X[k + 1] = oy; X[k + 2] = oz; V[k] = e * (V[k] - j1x * y * dt); V[k + 1] = e * (V[k + 1] - j1y * y * dt); V[k + 2] = e * (V[k + 2] - j1z * y * dt);
          const a = Math.sqrt(ox * ox + oy * oy + oz * oz); if (a > most) most = a; if (a < 1e-6) continue;
          const c = Math.cos(a * 0.5), s = Math.sin(a * 0.5) / a, ax = ox * s, ay = oy * s, az = oz * s, q = bones[i].quaternion, bx = q.x, by = q.y, bz = q.z, bw = q.w;
          q.set(c * bx + ax * bw + ay * bz - az * by, c * by - ax * bz + ay * bw + az * bx, c * bz + ax * by - ay * bx + az * bw, c * bw - ax * bx - ay * by - az * bz);
        }
        for (let a = 0; a < 3; a++) { const j0 = PX[a], j1 = PV[a] + j0 * y, o = e * (j0 + j1 * dt); PX[a] = o; PV[a] = e * (PV[a] - j1 * y * dt); hips.position.setComponent(a, hips.position.getComponent(a) + o); }
        if (most < DONE) on = false;
      }
      keep();
    },
    get on() { return on; },
  };
}
