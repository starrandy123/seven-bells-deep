// The formulas' truth, alone, in seconds, no browser: each against its closed form or its defining property. PASS/FAIL lines; a plant turns its line red: node formulas.mjs [--plant=<name>]
import { pathToFileURL } from 'url'; import path from 'path'; import fs from 'fs'; import os from 'os';
const dir = process.argv.find((a) => a.startsWith('--dir='))?.slice(6) || new URL('../web/js/formulas/', import.meta.url).pathname;
const plant = process.argv.find((a) => a.startsWith('--plant='))?.slice(8);
// a plant: the classic bug, put into a temporary copy of the formulas
const PLANTS = {
  euler: ['follow.js', 'if (!(P.cap < Infinity)) {\n', 'if (!(P.cap < Infinity)) {\n    { const a = -P.w * P.w * s.u - 2 * P.z * P.w * s.ud; s.u += s.ud * dt; s.ud += a * dt; return s.u; }\n'],
  no_dt: ['follow.js', "const k = P.cap / l; for (const q of KEYS)", "const k = P.cap / l; for (const q of KEYS)"], // replaced below by name
  cap_ignored: ['follow.js', 'if (!(P.cap < Infinity)) {', 'if (true) {'],
  jump_end_velocity: ['jump.js', 'p.y += v.y * dt + 0.5 * g * dt * dt', 'p.y += v.y * dt'],
  quintic_no_clamp: ['inertial.js', 'if (x0 > 0 ? v > 0 : v < 0) v = 0;', ''],
  quintic_cubic: ['inertial.js', 'return (((((c.A * t + c.B) * t + c.C) * t + c.a0 / 2) * t + c.v) * t) + c.x0;', 'return c.x0 * (1 - t / c.T);'],
  ik_no_stretch: ['ik.js', 'far = (R.l1 + R.l2) * stretch', 'far = (R.l1 + R.l2) * 1.2'],
  ik_no_hinge: ['ik.js', 'if (len(h) < 1e-3) h = cross(d1, scale(sol.perp, -1));\n  h = unit(h);', 'h = R.hinge;'],
  stride_duty: ['gait.js', 's <= f.v ? out.L / s :', 's <= f.v ? 0.6 :'],
  swing_linear: ['gait.js', 'export const along = (s) => s * s * (3 - 2 * s);', 'export const along = (s) => s;'],
  blend_off: ['step.js', 'export const alpha = (C) => Math.min(1, Math.max(0, C.acc / C.step));', 'export const alpha = (C) => 1;'],
};
let D = dir;
if (plant) {
  const p = PLANTS[plant]; if (!p) { console.log('no such plant'); process.exit(2); }
  D = fs.mkdtempSync(path.join(os.tmpdir(), 'plant_'));
  for (const f of fs.readdirSync(dir)) fs.copyFileSync(path.join(dir, f), path.join(D, f));
  const fp = path.join(D, p[0]); let s = fs.readFileSync(fp, 'utf8');
  if (plant === 'no_dt') s = s.replace('const c = v0 + w * u0, e = Math.exp(-w * dt);', 'const c = v0 + w * u0, e = Math.exp(-w / 60);');
  else { if (!s.includes(p[1])) { console.log('PLANT STALE', plant); process.exit(2); } s = s.replace(p[1], p[2]); }
  fs.writeFileSync(fp, s);
}
const imp = (f) => import(pathToFileURL(path.join(D, f)).href);
const { second, follower, chase, carry, ease, kick } = await imp('follow.js'), J = await imp('jump.js'), I = await imp('inertial.js'), K = await imp('ik.js'), Ga = await imp('gait.js'), St = await imp('step.js');
let fails = 0, n = 0; const line = (ok, s) => { n++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${s}`); };

// follow.js ------------------------------------------------
{ const P = second({ f: 2, z: 1 }), s = follower(1), w = 2 * Math.PI * 2; s.u = -1; s.y = 0; let worst = 0, t = 0;       // a true step: the target already at 1, the follower at 0, at rest
  for (let i = 0; i < 120; i++) { const y = chase(P, s, 1, 1 / 60); t += 1 / 60; worst = Math.max(worst, Math.abs(y - (1 - (1 + w * t) * Math.exp(-w * t)))); }
  line(worst < 1e-9, `follow: a critically damped step is the closed form 1-(1+wt)e^-wt: worst ${worst.toExponential(2)} (≤ 1e-9)`); }
{ const P = second({ f: 2, z: 0.3 }), s = follower(1); s.u = -1; s.y = 0; let mx = 0; for (let i = 0; i < 4000; i++) mx = Math.max(mx, chase(P, s, 1, 1 / 2000)); line(Math.abs(mx - 1.37233) < 1e-5, `follow: z 0.3 overshoots by exp(-πz/√(1-z²)) = 0.3723: got ${(mx - 1).toFixed(4)}`); }
{ const P = second({ f: 20, z: 1 }), s = follower(0); let y = 0; for (let i = 0; i < 40; i++) y = chase(P, s, 1, 0.1); line(Number.isFinite(y) && Math.abs(y - 1) < 1e-6, `follow: 20 Hz stepped at 0.1 s stays bounded and settles: ${y.toFixed(9)}`); }
{ // the target's corners fall on sixths of a second, so every rate steps on them; read at the same instants
  const X = [0, 1, 0.5, 2, 1.5, 0, 0.7], tgt = (t) => { const k = Math.min(5, Math.floor(t * 6 + 1e-9)), f = t * 6 - k; return X[k] + (X[k + 1] - X[k]) * f; };
  const run = (hz, P0) => { const P = second(P0), s = follower(0), out = []; for (let i = 1; i <= hz; i++) { const y = chase(P, s, tgt(i / hz), 1 / hz); if (i % (hz / 6) === 0) out.push(y); } return out; };
  for (const P0 of [{ f: 3, z: 0.6, r: 1 }, { f: 4, z: 1, r: 2 }, { f: 1.2, z: 0.8, r: 0 }]) { const R = [30, 60, 120, 144].map((h) => run(h, P0)); let sp = 0; for (let k = 0; k < 6; k++) { const v = R.map((r) => r[k]); sp = Math.max(sp, Math.max(...v) - Math.min(...v)); }
    line(sp < 1e-9, `follow: f ${P0.f} z ${P0.z} r ${P0.r}: the path is the same at 30, 60, 120, 144 Hz: spread ${sp.toExponential(2)} (≤ 1e-9)`); } }
{ const P = second({ f: 2, z: 1, r: 2 }), s = follower(0); let e = 0; for (let i = 1; i < 300; i++) { const x = i / 60 * 3, y = chase(P, s, x, 1 / 60); if (i > 180) e = Math.max(e, Math.abs(y - x)); } line(e < 1e-7, `follow: r 2 follows a steady ramp with no lag once settled: ${e.toExponential(2)} (≤ 1e-7)`); }
{ const P = second({ f: 2, z: 1, r: 0 }), s = follower(0); let y = 0; for (let i = 1; i < 300; i++) y = chase(P, s, i / 60 * 3, 1 / 60); const lag = 299 / 60 * 3 - y; line(Math.abs(lag - P.k1 * 3) < 1e-7, `follow: r 0 lags a ramp by k1·rate: ${lag.toFixed(6)} (${(P.k1 * 3).toFixed(6)})`); }
{ const P = second({ f: 8, z: 1, cap: 40 }), s = follower(0); let worst = 0; for (let i = 0; i < 300; i++) { const b = s.ud + s.v; chase(P, s, 1, 1 / 60); worst = Math.max(worst, Math.abs(s.ud + s.v - b) * 60); } line(worst <= 40.5, `follow: the cap holds: most |y''| ${worst.toFixed(2)} (≤ 40)`); }
{ const a = second({ f: 3, z: 1 }), b = second({ f: 3, z: 1, cap: 1e9 }), s = follower(0), q = follower(0); let e = 0; for (let i = 0; i < 300; i++) e = Math.max(e, Math.abs(chase(a, s, 1, 1 / 60) - chase(b, q, 1, 1 / 60))); line(e < 1e-9, `follow: a cap that never binds IS the exact path: ${e.toExponential(2)} (≤ 1e-9)`); }
line(Math.abs(ease(1 / 60, 0.1) - (1 - Math.exp(-1 / 6))) < 1e-12, 'follow: ease(1/60, 0.1) = 1 - e^(-1/6)');

// jump.js --------------------------------------------------
{ const D = J.fromApex(2.6, 0.42), p = { x: 0, y: 0, z: 0 }, v = { x: 0, y: D.v, z: 0 }; let top = 0; for (let i = 0; i < 200; i++) { v.y -= D.g / 120; J.moved(p, v, D.g, 1 / 120); top = Math.max(top, p.y); }
  line(Math.abs(top - 2.6) < 2e-3, `jump: stepped at 120 Hz the apex is the design's: ${(top * 100).toFixed(2)} cm (260 ± 0.2)`); }
{ const D = J.fromApex(2.6, 0.42); line(Math.abs(J.speedFor(2.6, D.g) - D.v) < 1e-9 && Math.abs(J.timeFor(2.6, D.g) - 0.42) < 1e-9, 'jump: speedFor and timeFor are the inverses of fromApex'); }

// inertial.js ----------------------------------------------
{ let bad = 0, worst = '';
  for (const [x0, v0, T] of [[1, 0, 0.3], [1, -2, 0.3], [-0.7, 1, 0.25], [0.5, 3, 0.3], [2, -30, 0.3]]) {
    const c = I.quintic(x0, v0, T), h = 1e-5, x = (t) => I.at(c, t), dx = (t) => (x(t + h) - x(t - h)) / (2 * h);
    const e0 = Math.abs(x(0) - x0), eT = Math.abs(x(c.T - 1e-7)), dT = Math.abs(dx(c.T - 2e-5)), d0 = Math.abs(((x(h) - x(0)) / h) - c.v);
    if (e0 > 1e-9 || eT > 1e-5 || dT > 1e-3 || d0 > Math.abs(c.a0) * h + 1e-6)   /* a one-sided difference carries a0·h/2 */ { bad++; worst = `${x0},${v0}: x(0) ${e0.toExponential(1)} x(T) ${eT.toExponential(1)} x'(T) ${dT.toExponential(1)}`; }
  }
  line(bad === 0, `inertial: the quintic starts on the offset at its speed and ends at rest: ${bad} bad ${worst}`); }
{ let over = 0, at_ = ''; for (const [x0, v0] of [[1, 0], [1, -1], [1, -5], [1, -20], [0.3, -9], [-1, 4]]) { const c = I.quintic(x0, v0, 0.3), s = Math.sign(x0); let lo = 0; for (let t = 0; t < c.T; t += 1e-3) lo = Math.min(lo, s * I.at(c, t)); if (lo < -0.02 * Math.abs(x0)) { over = lo; at_ = `${x0},${v0}`; } }
  line(!over, `inertial: arriving fast it never overshoots past the new pose by more than 2 %: ${over.toFixed(4)} ${at_}`); }
{ const c = I.quintic(1, 3, 0.3); line(I.at(c, 0.01) <= 1.0 + 1e-9, `inertial: moving away from the pose it starts from rest, never outward: x(0.01) ${I.at(c, 0.01).toFixed(4)} (≤ 1)`); }

// ik.js ----------------------------------------------------
{ const R = K.rest([0, 1, 0], [0, 0.5, 0.02], [0, 0, 0], [1, 0, 0]); let worst = 0, miss = 0;
  for (const W of [[0, 0.2, 0.1], [0.2, 0.3, 0.3], [0, 0.1, -0.3], [-0.3, 0.4, 0.2]]) { const s = K.solve(R, [0, 1, 0], W, [0, 0, 1]), a = K.len(K.sub(s.J, [0, 1, 0])), b = K.len(K.sub(s.E, s.J)); worst = Math.max(worst, Math.abs(a - R.l1), Math.abs(b - R.l2)); miss = Math.max(miss, K.len(K.sub(s.E, W))); }
  line(worst < 1e-9 && miss < 1e-9, `ik: bones keep their lengths and the end lands on the target: length ${worst.toExponential(1)}, end ${miss.toExponential(1)}`); }
{ const R = K.rest([0, 1, 0], [0, 0.5, 0.02], [0, 0, 0], [1, 0, 0]), s = K.solve(R, [0, 1, 0], [0, -3, 0], [0, 0, 1]); line(s.share <= 0.98 + 1e-9 && s.miss > 0, `ik: out of reach the limb stops at 0.98 of straight and says how far it missed: ${s.share.toFixed(4)}, miss ${s.miss.toFixed(2)} m`); }
{ const R = K.rest([0, 1, 0], [0, 0.5, 0.02], [0, 0, 0], [1, 0, 0]), s = K.solve(R, [0, 1, 0], [0, 0.3, -0.2], [0, 0, 1]); line(s.J[2] > -0.2 + 0.05, `ik: the joint bends to the pole's side: knee z ${s.J[2].toFixed(3)}`);
  const [q1, q2] = K.turns(R, [0, 1, 0], s), a = K.qrot(q1, R.d1), b = K.unit(K.sub(s.J, [0, 1, 0])), c = K.qrot(q2, R.d2), d = K.unit(K.sub(s.E, s.J)), h1 = K.qrot(q1, R.hinge), h2 = K.qrot(q2, R.hinge);
  line(K.len(K.sub(a, b)) < 1e-9 && K.len(K.sub(c, d)) < 1e-9, `ik: the turns put each rest bone on its solved line: ${K.len(K.sub(a, b)).toExponential(1)}, ${K.len(K.sub(c, d)).toExponential(1)}`);
  line(K.len(K.sub(h1, h2)) < 1e-9, `ik: one hinge: no twist comes in between thigh and shin: ${K.len(K.sub(h1, h2)).toExponential(1)}`); }
{ // the hinge must turn with the leg: with the knee pointing sideways it can't be the rest hinge. A hinge left at rest twists the knee off its plane
  const R = K.rest([0, 1, 0], [0, 0.5, 0.02], [0, 0, 0], [1, 0, 0]), S = [0, 1, 0], s = K.solve(R, S, [0.1, 0.3, 0.1], [1, 0, 0]), [q1, q2] = K.turns(R, S, s), hw = K.qrot(q1, R.hinge), d1 = K.unit(K.sub(s.J, S)), d2 = K.unit(K.sub(s.E, s.J));
  const e = Math.max(Math.abs(K.dot(hw, d1)), Math.abs(K.dot(hw, d2))); line(e < 1e-9, `ik: with the knee turned aside the hinge stays square to both bones: ${e.toExponential(1)} (≤ 1e-9)`); }
{ let e = 0; for (const a of [[1, 0, 0], [0.3, 0.8, -0.2]]) for (const b of [[0, 1, 0], [0.5, 0.1, 0.9]]) { const f0 = K.frame(a, b), f1 = K.frame(b, [0.2, 0.3, 1]), q = K.turn(f0, f1); for (let i = 0; i < 3; i++) e = Math.max(e, K.len(K.sub(K.qrot(q, f0[i]), f1[i]))); } line(e < 1e-9, `ik: turn(f0, f1) takes one frame to the other: ${e.toExponential(1)}`); }

// gait.js --------------------------------------------------
{ let bad = ''; const o = {}, w = Ga.GAITS.walk.v, f = Ga.GAITS.sprint.v; for (let v = w; v <= f; v += 0.05) { Ga.stride(v, v, o); if (Math.abs(o.T * v - o.L) > 1e-6) bad = `${v.toFixed(2)}: ${(o.T * v).toFixed(3)} v ${o.L.toFixed(3)}`; }
  line(!bad, `gait: at every speed the clips cover a stride takes the time that matches the ground, so a foot going back under him goes at his speed: ${bad || `${w}-${f} m/s`}`); }
{ const o = {}; let prev = 9, mono = true; for (let v = 0.2; v <= 36; v += 0.2) { Ga.stride(v, v, o); if (o.T > prev + 1e-9) mono = false; prev = o.T; } Ga.stride(8.8, 8.8, o); const c9 = 2 / o.T; Ga.stride(Ga.GAITS.walk.v, Ga.GAITS.walk.v, o); const c1 = 120 / o.T; line(mono && c1 > 100 && c1 < 130 && c9 > 3.5 && c9 <= 5, `gait: cadence only rises with speed, walk ${c1.toFixed(0)} steps/min (100-130), fast run ${c9.toFixed(1)} steps/s (3.5-5)`); }
{ const e = [Ga.along(0), 1 - Ga.along(1), (Ga.along(1e-4) - Ga.along(0)) / 1e-4, (Ga.along(1) - Ga.along(1 - 1e-4)) / 1e-4]; line(e.every((x) => Math.abs(x) < 1e-3), `gait: a swing leaves and lands at rest: ${e.map((x) => x.toExponential(1)).join(' ')}`); }

{ const o = {}; let top = 0; for (let v = 0.5; v <= Ga.MATCH; v += 0.1) { Ga.stride(v, v, o); top = Math.max(top, 2 / o.T); } line(top <= 5 + 1e-9, `gait: at most 5 steps a second up to sprint (M1b): ${top.toFixed(2)}`); Ga.stride(36, 36, o); line(2 / o.T >= 6, `gait: at least 6 steps a second at 36 m/s (M6a): ${(2 / o.T).toFixed(2)}`); }

if (Ga.seenAt) { let bad = '', last = 0; for (let v = 0; v <= 36; v += 0.05) { const q = Ga.seenAt(v); if (v <= Ga.MATCH && Math.abs(q - v) > 1e-9) bad = `${v.toFixed(2)}: ${q}`; if (Math.abs(q - last) > 0.0501) bad = `jump at ${v.toFixed(2)}`; last = q; } const end = Ga.seenAt(36); line(!bad && Math.abs(end - Ga.SEEN) < 1e-9, `gait: the feet see all of the ground's speed up to MATCH, then less, with no jump, down to SEEN: ${bad || `${end} at 36 m/s`}`); }
if (Ga.away) { let top = 0; for (let k = 0; k <= 200; k++) top = Math.max(top, Ga.away(k / 200)); const ends = Math.abs(Ga.away(0)) + Math.abs(Ga.away(0.5)) + Math.abs(Ga.away(1)); line(ends < 1e-12 && Math.abs(top - 0.0962) < 0.0005 && Math.abs((Ga.away(1e-5) / 1e-5) - 1) < 1e-3, `gait: the swing's bow starts at the ground's speed and ends where it should: peak ${top.toFixed(4)}, ends ${ends.toFixed(3)}`); }

// step.js --------------------------------------------------
{ const C = St.clock(1 / 60, 5); let n = 0; St.advance(C, 0.25, () => n++); line(n === 5 && C.dropped === 10, `step: a 250 ms frame runs 5 steps and drops 10, counted: ${n}, ${C.dropped}`); }
{ // the drawn instant moves by each frame's own time, on a real display's stamps
  const lists = { '59.94 Hz': Array.from({ length: 200 }, () => 1 / 59.94), '90 Hz': Array.from({ length: 200 }, () => 1 / 90), '120 after a hitch': [0.05, ...Array.from({ length: 200 }, () => 1 / 120)], '144 Hz': Array.from({ length: 200 }, () => 1 / 144) };
  let worst = 0, where = '';
  for (const [name, L] of Object.entries(lists)) { const C = St.clock(1 / 60, 5); let pos = 0, prev = 0, last = null, seen = 0; for (const dt of L) { St.advance(C, dt, (h) => { prev = pos; pos += h; }); const d = St.mix(prev, pos, St.alpha(C)); if (last !== null && ++seen > 12) { const e = Math.abs((d - last) - dt) / dt; if (e > worst) { worst = e; where = name; } } last = d; } }      // from the twelfth frame: the first have no step behind them to draw from
  line(worst < 0.02, `step: every frame's drawn move is its own time within 2 %: worst ${(worst * 100).toFixed(2)} % at ${where}`); }
console.log(`${n - fails} of ${n} formula truths hold`); process.exit(fails ? 1 : 0);
