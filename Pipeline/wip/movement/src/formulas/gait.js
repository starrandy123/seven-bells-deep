// The stride: how a body's speed becomes cadence and contact. The gaits are real, each a captured stride with the length, time and share on the ground it was run with, on his legs (moves.json, read back from the capture's feet).
// Between two gaits the stride is the blend of theirs, and the clip runs at the rate that matches the ground, so a foot going back under him goes at his speed. Numbers are in DESIGN.md §Movement.
const RATE = 1.25;       // he's a hero in a 2 km world: every capture plays this much faster than it was run, stride for stride
export const GAITS = { walk: { v: 1.29, T: 0.96, L: 1.242, beta: 0.625, on_L: 0.472 }, run: { v: 3.92, T: 0.587, L: 2.30, beta: 0.364, on_L: 0.5 }, sprint: { v: 5.89, T: 0.48, L: 2.83, beta: 0.417, on_L: 0.444 } };
export const setGaits = (moves) => { for (const k in GAITS) { const g = moves && moves[k] && moves[k].gait; if (g) GAITS[k] = { v: g.v * RATE, T: g.T / RATE, L: g.L, beta: g.beta, on_L: g.on_L }; } };
/* MATCH: the speed past which a stride can't follow the ground (M6). Past it the feet are carried on with him at what's left over and see less and less of the ground's speed, down to SEEN by 22 m/s; only the cadence keeps rising */
export const MATCH = 9.2, SEEN = 7;
export const seenAt = (v) => { if (v <= MATCH) return v; const t = Math.min(1, (v - MATCH) / (22 - MATCH)); return MATCH + (SEEN - MATCH) * t * t * (3 - 2 * t); };
const T_SLOWEST = 1.5, T_MATCH = 0.46, T_FASTEST = 0.33, V_FASTEST = 36;      // s, a whole stride: how slow a slow walk's steps go, then how fast they go past the fastest capture
const mix = (a, b, k) => a + (b - a) * k;
/* v: the speed the gait is blended by, a moment behind his real one so a knock doesn't jump the pose; speed: his real one, which sets the rate */
export function stride(v, speed, out = {}) {
  const w = GAITS.walk, r = GAITS.run, f = GAITS.sprint, u = Math.max(0, v), s = Math.max(0, speed);
  const a = Math.min(1, Math.max(0, (u - w.v) / (r.v - w.v))), b = Math.min(1, Math.max(0, (u - r.v) / (f.v - r.v)));
  out.wa = 1 - a; out.ru = a * (1 - b); out.sp = a * b;
  const by = (n) => out.wa * w[n] + out.ru * r[n] + out.sp * f[n];
  out.L = by('L'); out.beta = by('beta'); out.onL = by('on_L');
  out.T = s < w.v ? Math.min(T_SLOWEST, out.L / Math.max(s, 0.01)) : s <= f.v ? out.L / s : s <= MATCH ? mix(f.T, T_MATCH, (s - f.v) / (MATCH - f.v)) : mix(T_MATCH, T_FASTEST, Math.min(1, (s - MATCH) / (V_FASTEST - MATCH)));
  out.k = s < w.v ? Math.max(0.12, s * out.T / out.L) : 1;      // how much of the clip's stride he takes: a slow walk's is shorter
  // past the fastest clip the ground goes by faster than the clip's foot goes back: a foot's time on the ground shortens by that much, as a real sprinter's does, and its swing takes the rest
  out.bt = out.beta * Math.min(1, out.L / out.T / Math.max(s, 0.01));
  return out;
}
/* where in the clip a leg is, for how far it is through its stride: its stance at the ground's speed, its swing in what's left */
export const warp = (p, S) => (p < S.bt ? (p * S.beta) / S.bt : S.beta + ((p - S.bt) * (1 - S.beta)) / (1 - S.bt));
/* a foot's way from where it is to where it's going, as a share: at rest at both ends */
export const along = (s) => s * s * (3 - 2 * s);
