// src/core/mathx.js — pure math, seeded randomness, and the deterministic noise stack.
//
// WAVE 0. Zero dependencies (not even three.js) — the chunk worker imports this module and must
// NOT pull 1.2MB of three.module.js into every worker just to evaluate terrain noise. Every
// function here is pure and allocation-free unless it is explicitly a build-time helper
// (filletPolyline) or writes into a caller-supplied `out` (worley2, domainWarp2, vogelDisk…).
//
// ── ARGUMENT-ORDER CONVENTION (read this, it is a real trap) ──────────────────────────────────
//   smoothstep / smootherstep / invLerp use **GLSL order**: (edge0, edge1, x).
//   THREE.MathUtils.smoothstep uses (x, min, max). THEY ARE NOT INTERCHANGEABLE.
//   Every parameter table in docs/research/ is written in GLSL order (e.g.
//   `smoothstep(0.62, 0.70, 1.0 - worleyF1(uv*38.0))`), and half of this engine's CPU code is a
//   transliteration of a shader, so GLSL order is the one that keeps CPU bakes and GPU shaders
//   readable side by side. clamp/lerp happen to agree in both conventions.
//
// ── DETERMINISM (ARCHITECTURE.md D4) ──────────────────────────────────────────────────────────
//   No unseeded randomness, no wall-clock read of any kind, and no transcendental in the hash
//   path. The hashes are integer bit-mixers (Math.imul over int32), so a chunk keyed on
//   (worldSeed, cellX, cellY) regenerates BYTE-IDENTICALLY on every run, in every JS engine, in
//   the worker and on the main thread. The popular `fract(sin(x)*43758.5453)` GLSL hash is
//   deliberately NOT used for CPU generation: it is a transcendental whose last bits differ
//   between a double-precision Math.sin and a highp GPU sin, which would make CPU-baked and
//   GPU-baked variants of the same material disagree. `hashSin2` is provided separately, and
//   only for code that must match a shader tap exactly.
//
// ── SOURCES ───────────────────────────────────────────────────────────────────────────────────
//   docs/research/procedural-pbr-material-synthesis-entirely-i.md  — fBm 5 octaves / lac 2.02 /
//       gain 0.5 / per-octave rotation mat2(0.80,0.60,-0.60,0.80); Worley F1/F2 3x3 jitter
//       0.8-1.0; ridged = 1 - |2n-1| powered 6-12.
//   docs/research/authoring-aaa-quality-3d-assets-purely-in-co.md  — the exact 2D fillet math
//       (there is NO mesh beveler in r185; every hard-surface asset is a filleted 2D profile).
//   docs/research/the-call-of-duty-renderer-mw2019-mwii-mwiii.md  — Jimenez interleaved gradient
//       noise magic = vec3(0.06711056, 0.00583715, 52.9829189), temporal scroll frame*5.588238.
//   docs/research/aaa-gameplay-feel-fps-character-controller-g.md — damp() is the frame-rate
//       independent form of Eiserloh asymptotic averaging; lambda = -60*ln(1-k).
//   vendor/three.module.js (shadowmap_pars_fragment) — vogelDiskSample + goldenAngle constant,
//       reproduced here bit-for-bit so CPU-side sample placement matches r185's shader.

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────────────────────

export const TAU = Math.PI * 2;
export const PI = Math.PI;
export const HALF_PI = Math.PI * 0.5;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const EPSILON = 1e-9;

/** r185's own value, verified in vendor/three.module.js shadowmap_pars_fragment. Do not "round". */
export const GOLDEN_ANGLE = 2.399963229728653;

/** The plastic constant; 1/g and 1/g^2 give the R2 low-discrepancy sequence (Roberts). */
const PLASTIC = 1.32471795724474602596;
const R2_A1 = 1 / PLASTIC;
const R2_A2 = 1 / (PLASTIC * PLASTIC);

/** Jimenez IGN. All dither in this engine — PCF rotation, contact-shadow ray start, froxel slice
 *  offset, film grain, LOD cross-fade — goes through THESE constants so the noise is phase
 *  coherent and TAA resolves all of it with one history. Changing any of them is a visual bug. */
export const IGN_MAGIC_X = 0.06711056;
export const IGN_MAGIC_Y = 0.00583715;
export const IGN_MAGIC_Z = 52.9829189;
/** Temporal scroll per frame (CoD/Jimenez). Golden-ratio-ish so successive frames decorrelate. */
export const IGN_FRAME_SCROLL = 5.588238;

/** fBm defaults. lacunarity is 2.02 and NEVER 2.0 — at exactly 2.0 every octave's lattice lands
 *  on the previous octave's lattice and the sum grows faint plus/cross-shaped artefacts that read
 *  unmistakably as "Perlin". (procedural-pbr dossier, pitfall list.) */
export const FBM_OCTAVES = 5;
export const FBM_LACUNARITY = 2.02;
export const FBM_GAIN = 0.5;
/** Per-octave domain rotation. Written in GLSL column-major order exactly as the dossier states it
 *  — mat2(0.80,0.60,-0.60,0.80) — so `m * v` is (0.80x - 0.60y, 0.60x + 0.80y). det = 1, i.e. a
 *  pure rotation of ~36.87 deg. Its job is to stop octave features aligning along the axes. */
const ROT_A = 0.80, ROT_B = 0.60;

/** Shared frozen default for optional-options parameters — avoids `{}` allocation per call in the
 *  terrain inner loop, which runs tens of millions of times per streamed chunk. */
const EMPTY = Object.freeze({});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Scalar basics
// ─────────────────────────────────────────────────────────────────────────────────────────────

export function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
export function saturate(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
export function lerp(a, b, t) { return a + (b - a) * t; }

/** GLSL order. Returns the unclamped parameter; use invLerpSat when you need [0,1]. */
export function invLerp(edge0, edge1, x) {
  const d = edge1 - edge0;
  return d === 0 ? 0 : (x - edge0) / d;
}
export function invLerpSat(edge0, edge1, x) { return saturate(invLerp(edge0, edge1, x)); }

/** GLSL order: smoothstep(edge0, edge1, x). Hermite, C1 continuous. */
export function smoothstep(edge0, edge1, x) {
  const t = saturate(invLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
}

/** GLSL order. Quintic (Perlin's improved fade), C2 continuous — mandatory for anything whose
 *  DERIVATIVE is consumed (height -> normal map), because smoothstep's second derivative is
 *  discontinuous at the lattice and shows up as faint grid lines in the baked normal. */
export function smootherstep(edge0, edge1, x) {
  const t = saturate(invLerp(edge0, edge1, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Quintic fade on an already-normalised t in [0,1]. Hot path — no clamp, no divide. */
function fade5(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
/** Analytic derivative of fade5 on an already-normalised coordinate. */
function fade5d(t) { return 30 * t * t * (t - 1) * (t - 1); }

export function remap(x, inLo, inHi, outLo, outHi) {
  return outLo + (outHi - outLo) * invLerp(inLo, inHi, x);
}
export function remapSat(x, inLo, inHi, outLo, outHi) {
  return outLo + (outHi - outLo) * invLerpSat(inLo, inHi, x);
}

/** Linear approach with a hard rate cap (units/second is the caller's business). This is the
 *  correct tool for anything the design spec states as a RATE — e.g. vehicle steerRateIn in
 *  deg/s — where an exponential damp would be wrong. */
export function moveTowards(x, target, maxDelta) {
  const d = target - x;
  if (d > maxDelta) return x + maxDelta;
  if (d < -maxDelta) return x - maxDelta;
  return target;
}

export function fract(x) { return x - Math.floor(x); }
export function sign(x) { return x < 0 ? -1 : (x > 0 ? 1 : 0); }
export function step(edge, x) { return x < edge ? 0 : 1; }

/** Ping-pong in [0,length]. Used for wind gust phases and idle-loop drivers. */
export function pingpong(x, length = 1) {
  const t = x - Math.floor(x / (length * 2)) * length * 2;
  return t < length ? t : length * 2 - t;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Angles
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Wrap to (-PI, PI]. */
export function wrapPi(a) {
  let t = (a + PI) % TAU;
  if (t < 0) t += TAU;
  return t - PI;
}
/** Wrap to [0, TAU). */
export function wrapTau(a) {
  const t = a % TAU;
  return t < 0 ? t + TAU : t;
}
/** Shortest signed rotation from `from` to `to`, in (-PI, PI]. */
export function angleDelta(from, to) { return wrapPi(to - from); }

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Easings (used by the HUD, viewmodel and camera; never by physics)
// ─────────────────────────────────────────────────────────────────────────────────────────────

export function easeOutCubic(x) { const u = 1 - saturate(x); return 1 - u * u * u; }
export function easeInCubic(x) { const t = saturate(x); return t * t * t; }
export function easeInOutCubic(x) {
  const t = saturate(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Overshoot-and-settle. Default c1 = 1.70158 is the canonical Penner constant, which produces a
 *  ~10% overshoot — this is exactly the hitmarker scale punch (1.6 -> 1.0 over 90 ms) in the
 *  gameplay-feel dossier. Raise c1 for a snappier, more arcade punch. */
export function easeOutBack(x, c1 = 1.70158) {
  const c3 = c1 + 1;
  const t = saturate(x) - 1;
  return 1 + c3 * t * t * t + c1 * t * t;
}

/** Fast attack, long tail — the shape of a muzzle-flash light decay or a hit-flash alpha. */
export function easeOutExpo(x) {
  const t = saturate(x);
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Closed amplitude envelope used by authored powers and other swept effects.
 * Value and slope are both zero at t=0 and t=1, so a cast cannot pop into or out of existence.
 */
export function bell(t) {
  const x = saturate(Number(t) || 0);
  const s = Math.sin(PI * x);
  return s * s;
}

/**
 * Parallel-transport a section's right vector by the minimal rotation from tangent t0 to t1.
 * Writes xyz at `out[offset..offset+2]`; no vectors or quaternions are allocated in the hot path.
 *
 * Ported from snowflow_demo — src/spells/bending.js
 * Upstream: https://github.com/Noniv/snowflow_demo @ 545039733b74eec742862f161990142c7ca7c7ec
 * MIT License · Copyright (c) 2026 Maksymilian Dendura
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 * Adapted: allocation-free scalar API; deterministic antiparallel fallback; JS number arithmetic.
 * The local version adds a deterministic antiparallel guard; adjacent authored spine samples
 * normally take only the straight/regular branches, but a public math primitive must be total.
 */
export function transport(out, offset, rx, ry, rz, t0x, t0y, t0z, t1x, t1y, t1z) {
  let ax = t0y * t1z - t0z * t1y;
  let ay = t0z * t1x - t0x * t1z;
  let az = t0x * t1y - t0y * t1x;
  const sn = Math.hypot(ax, ay, az);
  const cs = clamp(t0x * t1x + t0y * t1y + t0z * t1z, -1, 1);

  if (sn < 1e-7) {
    if (cs >= 0) {
      out[offset] = rx; out[offset + 1] = ry; out[offset + 2] = rz;
      return out;
    }
    // Exact antiparallel turn: choose the least-aligned cardinal axis, cross it with t0, then
    // apply the pi Rodrigues rotation (v' = 2*axis*dot(axis,v) - v).
    if (Math.abs(t0x) <= Math.abs(t0y) && Math.abs(t0x) <= Math.abs(t0z)) {
      ax = 0; ay = t0z; az = -t0y;
    } else if (Math.abs(t0y) <= Math.abs(t0z)) {
      ax = -t0z; ay = 0; az = t0x;
    } else {
      ax = t0y; ay = -t0x; az = 0;
    }
    const al = Math.hypot(ax, ay, az) || 1;
    ax /= al; ay /= al; az /= al;
    const d = ax * rx + ay * ry + az * rz;
    let ox = 2 * ax * d - rx, oy = 2 * ay * d - ry, oz = 2 * az * d - rz;
    const ol = Math.hypot(ox, oy, oz) || 1;
    out[offset] = ox / ol; out[offset + 1] = oy / ol; out[offset + 2] = oz / ol;
    return out;
  }

  ax /= sn; ay /= sn; az /= sn;
  const angle = Math.atan2(sn, cs);
  const c = Math.cos(angle), s = Math.sin(angle);
  const d = ax * rx + ay * ry + az * rz;
  const cx = ay * rz - az * ry;
  const cy = az * rx - ax * rz;
  const cz = ax * ry - ay * rx;
  let ox = rx * c + cx * s + ax * d * (1 - c);
  let oy = ry * c + cy * s + ay * d * (1 - c);
  let oz = rz * c + cz * s + az * d * (1 - c);
  const ol = Math.hypot(ox, oy, oz) || 1;
  out[offset] = ox / ol; out[offset + 1] = oy / ol; out[offset + 2] = oz / ol;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Frame-rate-independent damping and springs
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The ONLY legal way to smooth a value toward a target in this engine.
 *
 *   damp(x, y, lambda, dt) === lerp(x, y, 1 - exp(-lambda*dt))
 *
 * `x += (target - x) * 0.1` is frame-rate dependent: at 144 fps it converges 2.4x faster than at
 * 60. Every "floaty on my 144Hz monitor" bug report is that line. Identical to
 * THREE.MathUtils.damp (vendor/three.core.js:2412) — duplicated here so the worker and the sim
 * never need three.js.
 *
 * lambda is in 1/seconds: the value covers 63% of the remaining distance in 1/lambda seconds.
 */
export function damp(x, y, lambda, dt) {
  return x + (y - x) * (1 - Math.exp(-lambda * dt));
}

/** damp() on a circular quantity (radians). Takes the short way round and re-wraps, so yaw
 *  smoothing never spins the long way at the +/-PI seam. */
export function dampAngle(x, y, lambda, dt) {
  return wrapPi(x + wrapPi(y - x) * (1 - Math.exp(-lambda * dt)));
}

/** damp() applied component-wise to any {x,y,z}. Zero allocation — mutates and returns `out`. */
export function damp3(out, tx, ty, tz, lambda, dt) {
  const a = 1 - Math.exp(-lambda * dt);
  out.x += (tx - out.x) * a;
  out.y += (ty - out.y) * a;
  out.z += (tz - out.z) * a;
  return out;
}

/**
 * Convert an old-school 60 fps per-frame blend factor k into a lambda: lambda = -60*ln(1-k).
 * Reference points from the gameplay dossier: k=0.1 -> 6.32, k=0.2 -> 13.39, k=0.5 -> 41.59.
 * Use this when porting a tuning value written as "x += (t-x)*0.15", never as a runtime call.
 */
export function lambdaFromBlend60(k) {
  const kk = clamp(k, 0, 0.999999);
  return -60 * Math.log(1 - kk);
}
/** Inverse, for reporting a lambda back in the units a designer recognises. */
export function blend60FromLambda(lambda) { return 1 - Math.exp(-lambda / 60); }

/**
 * Analytic damped-harmonic-oscillator step. Mutates `state` in place ({x, v}) and returns it.
 *
 *   k    = stiffness in 1/s^2 (omega = sqrt(k) is the natural frequency in rad/s)
 *   zeta = damping ratio; 1 = critically damped (default, and the right answer for weapon sway,
 *          camera arms and HUD punch), <1 rings, >1 crawls.
 *
 * WHY THE CLOSED FORM AND NOT EULER: the dossier writes sway as an explicit-Euler integration
 * (`v += (-k*x - 2*sqrt(k)*v + f)*dt`). That is unconditionally UNSTABLE for k*dt^2 > ~4 — with
 * swayStiffness = 62 it explodes the moment a frame hitches past ~250 ms, which is precisely when
 * you least want the viewmodel to fly off screen. The exact solution of the same ODE is stable for
 * ANY dt, costs one exp() plus a sin/cos only in the non-critical branch, and matches Euler to
 * within float noise at 120 Hz. Same spring, no blow-up.
 */
export function springStep(state, target, k, dt, zeta = 1) {
  if (dt <= 0) return state;
  const omega = Math.sqrt(Math.max(k, 0));
  if (omega <= 0) { state.x += state.v * dt; return state; }

  let y = state.x - target;          // displacement from the rest point
  const v0 = state.v;

  if (zeta > 0.9999 && zeta < 1.0001) {
    // Critically damped: y(t) = (A + B t) e^{-w t}, A = y0, B = v0 + w*y0.
    const e = Math.exp(-omega * dt);
    const A = y;
    const B = v0 + omega * A;
    const yt = (A + B * dt) * e;
    state.v = (B - omega * (A + B * dt)) * e;
    state.x = target + yt;
  } else if (zeta < 1) {
    // Underdamped: rings at the damped frequency wd.
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * omega * dt);
    const c = Math.cos(wd * dt), s = Math.sin(wd * dt);
    const C = (v0 + zeta * omega * y) / wd;
    state.x = target + e * (y * c + C * s);
    state.v = e * (v0 * c - ((omega * omega * y + zeta * omega * v0) / wd) * s);
  } else {
    // Overdamped: two real roots, both negative.
    const sq = Math.sqrt(zeta * zeta - 1);
    const r1 = -omega * (zeta - sq);
    const r2 = -omega * (zeta + sq);
    const c1 = (v0 - r2 * y) / (r1 - r2);
    const c2 = y - c1;
    const e1 = Math.exp(r1 * dt), e2 = Math.exp(r2 * dt);
    state.x = target + c1 * e1 + c2 * e2;
    state.v = r1 * c1 * e1 + r2 * c2 * e2;
  }
  return state;
}

/** springStep on a circular quantity: integrate the wrapped displacement, then re-wrap. */
export function springStepAngle(state, target, k, dt, zeta = 1) {
  const t = state.x + wrapPi(target - state.x);
  springStep(state, t, k, dt, zeta);
  state.x = wrapPi(state.x);
  return state;
}

/** The damping coefficient that makes a spring of stiffness k critically damped. */
export function criticalDamping(k) { return 2 * Math.sqrt(Math.max(k, 0)); }

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Low-discrepancy sequences (TAA jitter, IBL prefilter, shadow taps, prop scatter)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Radical inverse of `i` in `base` — the Halton sequence. halton(0, b) === 0, so TAA must pass
 * (frameIndex % period) + 1: a zero jitter on the first frame of every cycle produces a visible
 * 1-frame sharpening pulse. Bases must be coprime; use 2 and 3 for a 2D jitter.
 */
export function halton(i, base) {
  let f = 1, r = 0, n = i >>> 0;
  while (n > 0) {
    f /= base;
    r += f * (n % base);
    n = Math.floor(n / base);
  }
  return r;
}

/** Halton(2,3) pair into `out` ({x,y}), centred on 0 — i.e. in [-0.5, 0.5]. Zero allocation. */
export function halton2(i, out) {
  out.x = halton(i, 2) - 0.5;
  out.y = halton(i, 3) - 0.5;
  return out;
}

/**
 * Roberts' R2 sequence. Lower discrepancy than Halton in 2D and, unlike Halton, has no structured
 * "streaks" at low sample counts — the right choice for scattering props/decals across a chunk.
 */
export function r2(i, out) {
  out.x = fract(0.5 + R2_A1 * i);
  out.y = fract(0.5 + R2_A2 * i);
  return out;
}

/** Hammersley point set — needs the total count up front, so it is for offline/prefilter work
 *  (IBL specular prefilter, BRDF LUT), not for a temporal sequence. */
export function hammersley(i, count, out) {
  out.x = i / count;
  out.y = halton(i, 2);
  return out;
}

/**
 * Vogel (sunflower) disk sample, byte-identical to r185's `vogelDiskSample` in
 * shadowmap_pars_fragment. Reproduced on the CPU so any hand-written shadow/AO/SSR chunk we
 * generate places its taps on the SAME spiral the stock PCF uses — mixing two different disks
 * makes the two noise fields fight and TAA cannot resolve either cleanly.
 * `phi` is the per-pixel rotation, normally ign(fragX, fragY, frame) * TAU.
 */
export function vogelDisk(i, count, phi, out) {
  const r = Math.sqrt((i + 0.5) / count);
  const theta = i * GOLDEN_ANGLE + phi;
  out.x = Math.cos(theta) * r;
  out.y = Math.sin(theta) * r;
  return out;
}

/**
 * Jimenez interleaved gradient noise — the single dither source for the whole engine.
 *
 * Exactly r185's `interleavedGradientNoise` (which is exactly Jimenez's CoD:AW original), plus
 * the standard temporal scroll `p += frame * 5.588238`. IGN is "half way between dithered and
 * random": it has random-noise value richness with dither-like spatial coherence, so shadow
 * penumbrae and volumetric slices do not boil under camera motion.
 *
 * `x`,`y` are PIXEL coordinates (gl_FragCoord.xy), not UVs. Pass the frame index already wrapped
 * to whatever period the matching shader uses (typically 64) so CPU and GPU stay in phase and the
 * float never grows large enough to lose mantissa bits.
 */
export function ign(x, y, frame = 0) {
  const s = frame * IGN_FRAME_SCROLL;
  const d = (x + s) * IGN_MAGIC_X + (y + s) * IGN_MAGIC_Y;
  return fract(IGN_MAGIC_Z * fract(d));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Integer hashing + seeded PRNG
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Murmur3 32-bit finalizer. Full avalanche in 5 integer ops, no transcendental, exact in int32,
 *  therefore identical on every machine — which is what makes chunk regeneration byte-stable. */
function mix32(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** uint32 lattice hash. Inputs are treated as integers (already floored by the caller). */
function hash2u(ix, iy, seed) {
  return mix32(Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1));
}
function hash3u(ix, iy, iz, seed) {
  return mix32(
    Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^
    Math.imul(iz, 0x1b873593) ^ Math.imul(seed, 0x9e3779b1),
  );
}

const INV_U32 = 1 / 4294967296;

/** Deterministic hash of a 2D integer lattice point -> [0,1). Fractional input is floored. */
export function hash2(x, y, seed = 0) {
  return hash2u(Math.floor(x), Math.floor(y), seed | 0) * INV_U32;
}
/** Deterministic hash of a 3D integer lattice point -> [0,1). */
export function hash3(x, y, z, seed = 0) {
  return hash3u(Math.floor(x), Math.floor(y), Math.floor(z), seed | 0) * INV_U32;
}
/** Two decorrelated [0,1) values from ONE hash (high/low 16 bits) — the cell-jitter primitive.
 *  16-bit resolution is far below the visible threshold for a feature-point offset. */
export function hash2v(x, y, seed, out) {
  const h = hash2u(Math.floor(x), Math.floor(y), seed | 0);
  out.x = (h >>> 16) / 65536;
  out.y = (h & 0xffff) / 65536;
  return out;
}

/**
 * The classic GLSL sin-hash with Mikkelsen's hextiling constants, provided ONLY for CPU code that
 * must reproduce a specific shader tap (e.g. pre-computing a hex-tile offset table that the
 * material will re-derive on the GPU). It is a transcendental, so its low bits are not guaranteed
 * identical to the GPU's — never build world generation on it. Use hash2/hash3 for that.
 */
export function hashSin2(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}

/**
 * mulberry32 — 32-bit state, period 2^32, passes gjrand/PractRand at this size, ~3ns per draw.
 * Returns a CALLABLE that also carries helpers, so `rng()` works everywhere a bare function is
 * expected while `rng.range(a,b)` stays available to the kits.
 *
 * Every stochastic decision in the engine (prop scatter, tree species, crack placement, AI barks,
 * recoil dice) must come from one of these, keyed deterministically. See cellSeed().
 */
export function mulberry32(seed) {
  let a = seed >>> 0;

  const rng = function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) * INV_U32;
  };

  rng.isRng = true;
  /** Current state — snapshot it to make a sequence resumable across a save/stream boundary. */
  rng.state = () => a >>> 0;
  rng.setState = (s) => { a = s >>> 0; return rng; };

  rng.range = (lo, hi) => lo + (hi - lo) * rng();
  /** Integer in [0, n). */
  rng.int = (n) => Math.floor(rng() * n);
  /** Integer in [lo, hi] inclusive. */
  rng.irange = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  rng.bool = (p = 0.5) => rng() < p;
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  /** Symmetric jitter in [-m, +m] — the shape most tuning tables are written in ("+/- 25%"). */
  rng.jitter = (m) => (rng() * 2 - 1) * m;
  rng.pick = (arr) => (arr.length ? arr[Math.floor(rng() * arr.length)] : undefined);
  /** Weighted pick; `weights[i]` need not be normalised. */
  rng.weighted = (arr, weights) => {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = rng() * total;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  };
  /** In-place Fisher-Yates. Deterministic given the state. */
  rng.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  rng.gaussian = () => gaussian(rng);
  /** Uniform point on the unit circle. */
  rng.unit2 = (out) => { const t = rng() * TAU; out.x = Math.cos(t); out.y = Math.sin(t); return out; };
  /** Uniform point on the unit SPHERE (area-correct: z is uniform, not the angle). */
  rng.unit3 = (out) => {
    const z = 1 - 2 * rng();
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const t = rng() * TAU;
    out.x = r * Math.cos(t); out.y = r * Math.sin(t); out.z = z;
    return out;
  };
  /**
   * Derive an independent child stream and ADVANCE the parent, so two forks are never identical.
   * Use this to give each sub-system its own stream: adding a tree to a chunk must not shift the
   * crack pattern on a wall, or every edit re-rolls the whole world.
   */
  rng.fork = (tag = 0) => mulberry32(
    mix32(((rng() * 4294967296) >>> 0) ^ Math.imul((tag | 0) + 0x2545f491, 0x9e3779b1)),
  );

  return rng;
}

/**
 * The world-generation key. A chunk at (cx, cy) under `worldSeed` must produce the identical seed
 * every time it is streamed in, from any direction, at any LOD — this is what lets the streamer
 * evict and rebuild without the world visibly changing behind the player.
 * Never returns 0 (some downstream generators treat 0 as "unseeded").
 */
export function cellSeed(worldSeed, cx, cy) {
  const h = mix32(
    Math.imul(worldSeed | 0, 0x9e3779b1) ^
    Math.imul(cx | 0, 0x85ebca6b) ^
    Math.imul(cy | 0, 0xc2b2ae35),
  );
  return h === 0 ? 0x9e3779b9 : h;
}

/** 3D variant, for voxel-ish or vertically-stacked cells (building floors, froxel jitter tables). */
export function cellSeed3(worldSeed, cx, cy, cz) {
  const h = mix32(
    Math.imul(worldSeed | 0, 0x9e3779b1) ^
    Math.imul(cx | 0, 0x85ebca6b) ^
    Math.imul(cy | 0, 0xc2b2ae35) ^
    Math.imul(cz | 0, 0x27d4eb2d),
  );
  return h === 0 ? 0x9e3779b9 : h;
}

/**
 * Standard normal (mean 0, sigma 1) by Box-Muller, from any [0,1) generator.
 *
 * Deliberately does NOT cache the second variate. Caching would put hidden state either in module
 * scope (two interleaved rngs would then steal each other's spare — a determinism bug that only
 * appears when a second system starts drawing) or on the rng object (breaks for a plain closure).
 * Two draws per call is cheaper than that class of bug.
 *
 * Use for anything that should cluster around a nominal value rather than fill a box: recoil
 * dispersion, ped walk-speed variation, per-instance scale.
 */
export function gaussian(rng) {
  let u1 = rng();
  if (u1 < 1e-12) u1 = 1e-12;          // log(0) guard; mulberry32 can legitimately return 0
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * rng());
}

/** Gaussian clamped to +/-`sigmas` by resampling-free clamping — keeps outliers out of a budget
 *  (e.g. an instance scale that must never exceed its LOD's screen-error assumption). */
export function gaussianClamped(rng, sigmas = 3) {
  return clamp(gaussian(rng), -sigmas, sigmas);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Deterministic noise stack
//
// PERIOD / TILEABILITY CONTRACT (D7 — every texture in this game is a GPU/CPU bake, and a bake
// that does not tile is a visible seam on every wall in the city):
//   `period` is expressed in LATTICE CELLS. When period > 0 the lattice index is wrapped with
//   mod(period) before hashing, so f(x + period) === f(x) exactly. When period === 0 the noise is
//   unbounded (world/terrain use).
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Wrap a lattice index into [0, period) for tileable bakes; identity when period is 0. */
function wrapLattice(i, period) {
  if (period <= 0) return i;
  const m = i % period;
  return m < 0 ? m + period : m;
}

/**
 * Value noise, 2D, quintic-faded, output in [0,1].
 * Value (not gradient/Perlin) noise on purpose: it is ~3x cheaper, has no zero-at-the-lattice
 * signature, and every use here is either fBm-summed or domain-warped, both of which destroy the
 * blockiness value noise is criticised for.
 */
export function valueNoise2(x, y, seed = 0, period = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const ux = fade5(x - ix), uy = fade5(y - iy);
  const s = seed | 0;
  const x0 = wrapLattice(ix, period), x1 = wrapLattice(ix + 1, period);
  const y0 = wrapLattice(iy, period), y1 = wrapLattice(iy + 1, period);
  const n00 = hash2u(x0, y0, s), n10 = hash2u(x1, y0, s);
  const n01 = hash2u(x0, y1, s), n11 = hash2u(x1, y1, s);
  const a = n00 + (n10 - n00) * ux;
  const b = n01 + (n11 - n01) * ux;
  return (a + (b - a) * uy) * INV_U32;
}

const _noisedOut = { value: 0, dx: 0, dy: 0 };
const _fbmdOut = { value: 0, dx: 0, dy: 0, highFrequencyEnergy: 0 };
const _noisedScratch = { value: 0, dx: 0, dy: 0 };

/**
 * Value noise plus its exact analytic first derivative.
 *
 * `out.value` is in [0,1]; dx/dy are derivatives in lattice units. This is the same quintic
 * interpolation and integer hash as valueNoise2(), not a look-alike derivative field. A caller
 * may therefore replace `valueNoise2` with `noised2(...).value` without moving the world.
 */
export function noised2(x, y, seed = 0, period = 0, out = _noisedOut) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const tx = x - ix, ty = y - iy;
  const ux = fade5(tx), uy = fade5(ty);
  const dux = fade5d(tx), duy = fade5d(ty);
  const s = seed | 0;
  const x0 = wrapLattice(ix, period), x1 = wrapLattice(ix + 1, period);
  const y0 = wrapLattice(iy, period), y1 = wrapLattice(iy + 1, period);
  const n00 = hash2u(x0, y0, s) * INV_U32;
  const n10 = hash2u(x1, y0, s) * INV_U32;
  const n01 = hash2u(x0, y1, s) * INV_U32;
  const n11 = hash2u(x1, y1, s) * INV_U32;
  const a = n00 + (n10 - n00) * ux;
  const b = n01 + (n11 - n01) * ux;
  out.value = a + (b - a) * uy;
  out.dx = ((n10 - n00) + ((n11 - n01) - (n10 - n00)) * uy) * dux;
  out.dy = (b - a) * duy;
  return out;
}

/**
 * Analytic-derivative fBm. `dx/dy` are with respect to the ORIGINAL input coordinates, including
 * every octave's rotation and frequency scale; treating a high-octave local derivative as though
 * it were in base-domain units is the common implementation bug this Jacobian prevents.
 */
export function fbmd2(
  x, y, oct = FBM_OCTAVES, lac = FBM_LACUNARITY, gain = FBM_GAIN,
  opts = EMPTY, out = _fbmdOut,
) {
  const seed = opts.seed | 0;
  const period = opts.period > 0 ? Math.round(opts.period) : 0;
  const rotate = opts.rotate === undefined ? period === 0 : !!opts.rotate;
  let sum = 0, gx = 0, gy = 0, norm = 0, amp = 1;
  let px = x, py = y, mult = 1;
  // p_octave = J * p_input.
  let j00 = 1, j01 = 0, j10 = 0, j11 = 1;

  for (let o = 0; o < oct; o++) {
    const os = (seed + Math.imul(o, 0x3c6ef35f)) | 0;
    let sx, sy;
    if (period === 0) {
      const n = noised2(px, py, os, 0, _noisedScratch);
      sx = n.dx * j00 + n.dy * j10;
      sy = n.dx * j01 + n.dy * j11;
      sum += amp * n.value;
      if (rotate) {
        const rx = ROT_A * px - ROT_B * py;
        const ry = ROT_B * px + ROT_A * py;
        px = rx * lac; py = ry * lac;
        const a00 = (ROT_A * j00 - ROT_B * j10) * lac;
        const a01 = (ROT_A * j01 - ROT_B * j11) * lac;
        const a10 = (ROT_B * j00 + ROT_A * j10) * lac;
        const a11 = (ROT_B * j01 + ROT_A * j11) * lac;
        j00 = a00; j01 = a01; j10 = a10; j11 = a11;
      } else {
        px *= lac; py *= lac;
        j00 *= lac; j01 *= lac; j10 *= lac; j11 *= lac;
      }
    } else {
      const P = Math.max(1, Math.round(period * mult));
      const m = P / period;
      const n = noised2(x * m, y * m, os, P, _noisedScratch);
      sx = n.dx * m; sy = n.dy * m;
      sum += amp * n.value;
      mult *= lac;
    }
    gx += amp * sx; gy += amp * sy;
    norm += amp;
    amp *= gain;
  }
  const inv = norm > 0 ? 1 / norm : 0;
  out.value = sum * inv;
  out.dx = gx * inv;
  out.dy = gy * inv;
  out.highFrequencyEnergy = 0;
  return out;
}

/**
 * Derivative-damped fBm. High octaves lose weight where the accumulated field is already steep:
 *   w = 1 / (1 + damping * dot(slope, slope)).
 * `damping=0` is the deliberate A/B/refutation arm and is exactly the ordinary fBm sum.
 */
export function fbmDamped2(
  x, y, oct = FBM_OCTAVES, lac = FBM_LACUNARITY, gain = FBM_GAIN,
  damping = 1, opts = EMPTY, out = _fbmdOut,
) {
  const seed = opts.seed | 0;
  const period = opts.period > 0 ? Math.round(opts.period) : 0;
  const rotate = opts.rotate === undefined ? period === 0 : !!opts.rotate;
  const dampAmount = Math.max(0, Number(damping) || 0);
  let sum = 0, gx = 0, gy = 0, slopeX = 0, slopeY = 0;
  let norm = 0, amp = 1, hf = 0, px = x, py = y, mult = 1;
  let j00 = 1, j01 = 0, j10 = 0, j11 = 1;

  for (let o = 0; o < oct; o++) {
    const os = (seed + Math.imul(o, 0x3c6ef35f)) | 0;
    let sx, sy, value;
    if (period === 0) {
      const n = noised2(px, py, os, 0, _noisedScratch);
      value = n.value;
      sx = n.dx * j00 + n.dy * j10;
      sy = n.dx * j01 + n.dy * j11;
      if (rotate) {
        const rx = ROT_A * px - ROT_B * py;
        const ry = ROT_B * px + ROT_A * py;
        px = rx * lac; py = ry * lac;
        const a00 = (ROT_A * j00 - ROT_B * j10) * lac;
        const a01 = (ROT_A * j01 - ROT_B * j11) * lac;
        const a10 = (ROT_B * j00 + ROT_A * j10) * lac;
        const a11 = (ROT_B * j01 + ROT_A * j11) * lac;
        j00 = a00; j01 = a01; j10 = a10; j11 = a11;
      } else {
        px *= lac; py *= lac;
        j00 *= lac; j01 *= lac; j10 *= lac; j11 *= lac;
      }
    } else {
      const P = Math.max(1, Math.round(period * mult));
      const m = P / period;
      const n = noised2(x * m, y * m, os, P, _noisedScratch);
      value = n.value; sx = n.dx * m; sy = n.dy * m;
      mult *= lac;
    }
    // Accumulate the octave's amplitude-scaled slope BEFORE computing w: the octave that creates
    // a steep cell must damp itself as well as all finer octaves.
    slopeX += amp * sx; slopeY += amp * sy;
    const w = 1 / (1 + dampAmount * (slopeX * slopeX + slopeY * slopeY));
    const aw = amp * w;
    sum += aw * value;
    gx += aw * sx; gy += aw * sy;
    norm += aw;
    if (o > 0) hf += aw * aw * (sx * sx + sy * sy);
    amp *= gain;
  }
  const inv = norm > 0 ? 1 / norm : 0;
  out.value = sum * inv;
  out.dx = gx * inv;
  out.dy = gy * inv;
  out.highFrequencyEnergy = hf;
  return out;
}

/** Ridge transform with the exact derivative of the underlying quintic value noise. */
export function ridgedd2(x, y, power = 1, seed = 0, period = 0, out = _noisedOut) {
  const n = noised2(x, y, seed, period, _noisedScratch);
  const q = n.value * 2 - 1;
  const base = Math.max(0, 1 - Math.abs(q));
  const p = Math.max(0, power);
  const value = p === 0 ? 1 : Math.pow(base, p);
  const factor = (p === 0 || base === 0) ? 0 : -2 * (q < 0 ? -1 : 1) * p * Math.pow(base, p - 1);
  out.value = value;
  out.dx = factor * n.dx;
  out.dy = factor * n.dy;
  return out;
}

/** Value noise, 3D, quintic-faded, output in [0,1]. Feeds the 32^3 volumetric density texture and
 *  any solid/tri-planar material variation. */
export function valueNoise3(x, y, z, seed = 0, period = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const ux = fade5(x - ix), uy = fade5(y - iy), uz = fade5(z - iz);
  const s = seed | 0;
  const x0 = wrapLattice(ix, period), x1 = wrapLattice(ix + 1, period);
  const y0 = wrapLattice(iy, period), y1 = wrapLattice(iy + 1, period);
  const z0 = wrapLattice(iz, period), z1 = wrapLattice(iz + 1, period);

  const c000 = hash3u(x0, y0, z0, s), c100 = hash3u(x1, y0, z0, s);
  const c010 = hash3u(x0, y1, z0, s), c110 = hash3u(x1, y1, z0, s);
  const c001 = hash3u(x0, y0, z1, s), c101 = hash3u(x1, y0, z1, s);
  const c011 = hash3u(x0, y1, z1, s), c111 = hash3u(x1, y1, z1, s);

  const a0 = c000 + (c100 - c000) * ux, b0 = c010 + (c110 - c010) * ux;
  const a1 = c001 + (c101 - c001) * ux, b1 = c011 + (c111 - c011) * ux;
  const l0 = a0 + (b0 - a0) * uy, l1 = a1 + (b1 - a1) * uy;
  return (l0 + (l1 - l0) * uz) * INV_U32;
}

/**
 * fBm, 2D, scalar hot-loop form. Output normalised to [0,1].
 *
 *   opts = { seed, period, rotate }
 *
 * TWO REGIMES, and the difference is load-bearing:
 *
 *  • period === 0 (world / terrain): the domain is ROTATED by mat2(0.80,0.60,-0.60,0.80) and
 *    scaled by lacunarity 2.02 each octave. Rotation + a non-integer lacunarity is what stops the
 *    octave lattices aligning; at lac exactly 2.0 with no rotation you get the plus-shaped
 *    cross-hatch that reads as "Perlin" from across the room.
 *
 *  • period > 0 (tileable bake): rotation is DISABLED — an arbitrary rotation destroys
 *    periodicity, full stop — and each octave's period is the INTEGER round(period * lac^o), so
 *    tiling is exact while the frequency ratio stays 2.02-ish and irrational-looking. Keep the
 *    base period >= 32: at tiny base periods round(P*2.02^o) collapses back onto round(P*2^o) and
 *    you have re-created the exact alignment artefact you were avoiding. Measured octave periods:
 *      P=16 -> [16, 32, 65, 132, 266]     octave 1 lands EXACTLY on 2x — do not use P<32
 *      P=32 -> [32, 65, 131, 264, 533]    clean
 *      P=64 -> [64, 129, 261, 528, 1066]  clean; this is the default for a 1024 bake
 *    Residual tiling error is ~2e-14 (double rounding in the rational multiplier), i.e. 5e-12 LSB
 *    at 8-bit — exact for every output format this engine writes.
 *
 * Octaves are additionally decorrelated by a per-octave seed offset, so two octaves that happen to
 * land on the same lattice cell do not return the same value.
 */
export function fbm2xy(x, y, oct = FBM_OCTAVES, lac = FBM_LACUNARITY, gain = FBM_GAIN, opts = EMPTY) {
  const seed = opts.seed | 0;
  const period = opts.period > 0 ? Math.round(opts.period) : 0;
  const rotate = opts.rotate === undefined ? period === 0 : !!opts.rotate;

  let sum = 0, norm = 0, amp = 1;
  let px = x, py = y;
  let mult = 1;                                     // frequency multiplier for the tiling path

  for (let o = 0; o < oct; o++) {
    const os = (seed + Math.imul(o, 0x3c6ef35f)) | 0;   // decorrelate octaves
    if (period === 0) {
      sum += amp * valueNoise2(px, py, os, 0);
      if (rotate) {
        // GLSL column-major mat2(0.80,0.60,-0.60,0.80) * v  ->  (0.80x - 0.60y, 0.60x + 0.80y)
        const rx = ROT_A * px - ROT_B * py;
        const ry = ROT_B * px + ROT_A * py;
        px = rx * lac; py = ry * lac;
      } else {
        px *= lac; py *= lac;
      }
    } else {
      const P = Math.max(1, Math.round(period * mult));
      const m = P / period;                          // exact rational multiplier => exact tiling
      sum += amp * valueNoise2(x * m, y * m, os, P);
      mult *= lac;
    }
    norm += amp;
    amp *= gain;
  }
  return norm > 0 ? sum / norm : 0;
}

/** Contract form: `p` is any {x,y}. Delegates to fbm2xy; no allocation. */
export function fbm2(p, oct = FBM_OCTAVES, lac = FBM_LACUNARITY, gain = FBM_GAIN, opts = EMPTY) {
  return fbm2xy(p.x, p.y, oct, lac, gain, opts);
}

/** fBm, 3D, scalar hot-loop form. Same two regimes as fbm2xy. The 3D per-octave rotation is a
 *  rotation about Y composed with one about Z, both built from the same 0.80/0.60 pair so the
 *  decorrelation strength matches the 2D case. */
export function fbm3xyz(x, y, z, oct = FBM_OCTAVES, lac = FBM_LACUNARITY, gain = FBM_GAIN, opts = EMPTY) {
  const seed = opts.seed | 0;
  const period = opts.period > 0 ? Math.round(opts.period) : 0;
  const rotate = opts.rotate === undefined ? period === 0 : !!opts.rotate;

  let sum = 0, norm = 0, amp = 1;
  let px = x, py = y, pz = z;
  let mult = 1;

  for (let o = 0; o < oct; o++) {
    const os = (seed + Math.imul(o, 0x3c6ef35f)) | 0;
    if (period === 0) {
      sum += amp * valueNoise3(px, py, pz, os, 0);
      if (rotate) {
        const ax = ROT_A * px - ROT_B * pz;          // rotate in XZ
        const az = ROT_B * px + ROT_A * pz;
        const bx = ROT_A * ax - ROT_B * py;          // then in XY
        const by = ROT_B * ax + ROT_A * py;
        px = bx * lac; py = by * lac; pz = az * lac;
      } else {
        px *= lac; py *= lac; pz *= lac;
      }
    } else {
      const P = Math.max(1, Math.round(period * mult));
      const m = P / period;
      sum += amp * valueNoise3(x * m, y * m, z * m, os, P);
      mult *= lac;
    }
    norm += amp;
    amp *= gain;
  }
  return norm > 0 ? sum / norm : 0;
}

/** Contract form: `p` is any {x,y,z}. */
export function fbm3(p, oct = FBM_OCTAVES, lac = FBM_LACUNARITY, gain = FBM_GAIN, opts = EMPTY) {
  return fbm3xyz(p.x, p.y, p.z, oct, lac, gain, opts);
}

const _warpOut = { x: 0, y: 0 };

/**
 * Quilez domain warp — returns the WARPED COORDINATE (not a noise value) in `out`, so the caller
 * can feed it to whatever field it likes (fbm, worley, a gradient ramp).
 *
 *   opts = { seed, period, oct, lac, gain, levels }   levels: 1 = single warp, 2 = warp-the-warp
 *
 * This is the single highest-value-per-line function in material synthesis: it is what turns
 * isotropic "TV static fBm" into flow, marbling, rust creep, cracked mud and cloud filaments.
 * The dossier's concrete use is a SINGLE level at strength 0.35 on concrete paste.
 *
 * TILEABLE: when period > 0 the decorrelated warp channels are separated by SEED rather than by
 * the usual coordinate offsets (vec2(5.2,1.3) etc.), because a non-integer coordinate offset
 * breaks periodicity. The warp itself preserves tiling — out(x+P) = x+P+w(x) — since w is periodic.
 */
export function domainWarp2(x, y, strength = 1, opts = EMPTY, out = _warpOut) {
  const oct = opts.oct === undefined ? 4 : opts.oct;
  const lac = opts.lac === undefined ? FBM_LACUNARITY : opts.lac;
  const gain = opts.gain === undefined ? FBM_GAIN : opts.gain;
  const levels = opts.levels === undefined ? 2 : opts.levels;
  const seed = opts.seed | 0;
  const period = opts.period > 0 ? Math.round(opts.period) : 0;
  const tiling = period > 0;

  // Channel options differ only by seed; when not tiling we ALSO offset the domain, which is what
  // iq's original does and gives slightly richer decorrelation for free.
  _optA.seed = seed; _optA.period = period; _optA.rotate = !tiling;
  _optB.seed = (seed ^ 0x51633e2d) | 0; _optB.period = period; _optB.rotate = !tiling;

  const ox = tiling ? 0 : 5.2, oy = tiling ? 0 : 1.3;
  // Signed in [-1,1] so the warp displaces both ways around the sample point.
  let qx = fbm2xy(x, y, oct, lac, gain, _optA) * 2 - 1;
  let qy = fbm2xy(x + ox, y + oy, oct, lac, gain, _optB) * 2 - 1;

  if (levels >= 2) {
    _optC.seed = (seed ^ 0x2c1b3a71) | 0; _optC.period = period; _optC.rotate = !tiling;
    _optD.seed = (seed ^ 0x68e31da4) | 0; _optD.period = period; _optD.rotate = !tiling;
    const wx = x + 4 * qx, wy = y + 4 * qy;
    const rx = fbm2xy(wx + (tiling ? 0 : 1.7), wy + (tiling ? 0 : 9.2), oct, lac, gain, _optC) * 2 - 1;
    const ry = fbm2xy(wx + (tiling ? 0 : 8.3), wy + (tiling ? 0 : 2.8), oct, lac, gain, _optD) * 2 - 1;
    qx = rx; qy = ry;
  }

  out.x = x + 4 * strength * qx;
  out.y = y + 4 * strength * qy;
  return out;
}

// Reusable option records for domainWarp2 — allocating four `{}` per texel would dominate the
// bake cost. Never expose these; they are overwritten on every call.
const _optA = { seed: 0, period: 0, rotate: true };
const _optB = { seed: 0, period: 0, rotate: true };
const _optC = { seed: 0, period: 0, rotate: true };
const _optD = { seed: 0, period: 0, rotate: true };

const _worleyOut = { f1: 0, f2: 0, id: 0, cx: 0, cy: 0 };

/**
 * Worley / cellular noise, 2D, 3x3 neighbourhood.
 *
 *   opts = { seed, period, jitter }   jitter defaults to 0.9 (dossier: 0.8-1.0)
 *   out  = { f1, f2, id, cx, cy }     distances in CELL units; `id` is the winning cell's [0,1)
 *                                      hash; cx/cy are its integer coordinates.
 *
 * `id` is not a nicety — per-cell random colour is called out in the dossier as "the single
 * biggest 'not procedural' cue" in exposed-aggregate concrete, cobbles, gravel and tile. Any
 * material that uses F1 without also using `id` will read as plastic.
 *
 * The 3x3 search is exact for F1 with jitter <= 1 (a feature point cannot leave its own cell).
 * F2 can be marginally wrong at a cell corner; that is standard practice and invisible in the
 * F2-F1 crack/edge term, which is what F2 is actually for.
 *
 * Note the default `out` is a shared module scratch: read the fields before the next call, or
 * pass your own object.
 */
export function worley2(x, y, opts = EMPTY, out = _worleyOut) {
  const seed = opts.seed | 0;
  const period = opts.period > 0 ? Math.round(opts.period) : 0;
  const jitter = opts.jitter === undefined ? 0.9 : opts.jitter;

  const cx = Math.floor(x), cy = Math.floor(y);
  let f1 = 1e30, f2 = 1e30, bx = cx, by = cy, bh = 0;

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox, gy = cy + oy;
      const h = hash2u(wrapLattice(gx, period), wrapLattice(gy, period), seed);
      // Feature point = cell centre + jittered offset, so jitter 0 gives a perfect grid and
      // jitter 1 lets the point reach the cell edges.
      const px = gx + 0.5 + ((h >>> 16) / 65536 - 0.5) * jitter;
      const py = gy + 0.5 + ((h & 0xffff) / 65536 - 0.5) * jitter;
      const dx = px - x, dy = py - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; bx = gx; by = gy; bh = h; }
      else if (d < f2) { f2 = d; }
    }
  }
  out.f1 = f1; out.f2 = f2; out.id = bh * INV_U32; out.cx = bx; out.cy = by;
  return out;
}

/** Scalar convenience: just F1. */
export function worleyF1(x, y, opts = EMPTY) { return worley2(x, y, opts, _worleyOut).f1; }
/** Scalar convenience: F2-F1, the cell-BOUNDARY field (cracks, grout, tile edges, cobble gaps). */
export function worleyEdge(x, y, opts = EMPTY) {
  const w = worley2(x, y, opts, _worleyOut);
  return w.f2 - w.f1;
}

/**
 * Ridge transform: folds a [0,1] field about 0.5 so the former midline becomes a crest.
 * `power` sharpens the crest — the dossier calls for 6-12 for crack lines, 1 for mountain ridges.
 */
export function ridged(n, power = 1) {
  const r = 1 - Math.abs(2 * n - 1);
  return power === 1 ? r : Math.pow(r < 0 ? 0 : r, power);
}

/** Ridged multifractal fBm — ridged() applied PER OCTAVE (not to the sum), which is what produces
 *  branching mountain/erosion structure rather than a single folded blob. */
export function ridgedFbm2(x, y, oct = FBM_OCTAVES, lac = FBM_LACUNARITY, gain = FBM_GAIN, opts = EMPTY) {
  const seed = opts.seed | 0;
  const period = opts.period > 0 ? Math.round(opts.period) : 0;
  const rotate = opts.rotate === undefined ? period === 0 : !!opts.rotate;
  let sum = 0, norm = 0, amp = 1, px = x, py = y, mult = 1;
  for (let o = 0; o < oct; o++) {
    const os = (seed + Math.imul(o, 0x3c6ef35f)) | 0;
    let n;
    if (period === 0) {
      n = valueNoise2(px, py, os, 0);
      if (rotate) {
        const rx = ROT_A * px - ROT_B * py;
        const ry = ROT_B * px + ROT_A * py;
        px = rx * lac; py = ry * lac;
      } else { px *= lac; py *= lac; }
    } else {
      const P = Math.max(1, Math.round(period * mult));
      n = valueNoise2(x * (P / period), y * (P / period), os, P);
      mult *= lac;
    }
    sum += amp * (1 - Math.abs(2 * n - 1));
    norm += amp;
    amp *= gain;
  }
  return norm > 0 ? sum / norm : 0;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 2D polyline filleting — the ONLY bevel this engine has
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Build points of the same class as the input (THREE.Vector2 in -> THREE.Vector2 out) without
 *  importing three.js. Anything with .clone()+.set() is treated as a vector; everything else gets
 *  a plain {x,y}, which Shape/Path/LatheGeometry all accept. */
function pointFactory(sample, override) {
  if (typeof override === 'function') return override;
  if (sample && typeof sample.clone === 'function' && typeof sample.set === 'function') {
    return (x, y) => sample.clone().set(x, y);
  }
  return (x, y) => ({ x, y });
}

/**
 * Round every interior corner of a 2D polyline with a true tangent arc.
 *
 * r185 ships NO CSG, NO subdivision surface and NO general mesh beveler (verified across all 30
 * addon subdirs). A hand-written half-edge beveler is a week of work and degenerates on procedural
 * output. So the engine never needs one: every hard-surface asset is authored as a 2D profile,
 * FILLETED HERE, then extruded / lathed / lofted / swept — and the fillet becomes a real 3D bevel
 * on the entire silhouette. That thin moving specular sliver along every edge is the difference
 * between "made of metal" and "made of math"; a perfectly sharp 90 deg edge is the loudest
 * blockout tell there is.
 *
 *   pts    array of {x,y} (THREE.Vector2 works and is returned)
 *   r      radius: a number, an array indexed by corner, or fn(i, point) -> number
 *   segs   arc segments. 1 = flat CHAMFER, 2 = the AAA workhorse round, 3 = hero silhouette edge.
 *          Emits segs+1 points per filleted corner.
 *   closed true wraps the first/last corners; false leaves the endpoints untouched.
 *   opts   { make, eps }
 *
 * Per corner V with neighbours A and B:
 *   u = norm(A-V), w = norm(B-V);  theta = acos(dot(u,w))            // interior angle
 *   t = R / tan(theta/2)                                             // tangent setback
 *   t = min(t, |A-V|/2, |B-V|/2)                                     // never eat past an edge
 *   R' = t * tan(theta/2)                                            // radius after clamping
 *   C  = V + norm(u+w) * (R' / sin(theta/2))                         // arc centre on the bisector
 *
 * The HALF-edge clamp is why two adjacent large fillets can never overlap or invert: each corner
 * may consume at most half of any edge it touches. R' is recomputed after clamping, so an
 * over-large radius degrades to the biggest arc that fits instead of producing NaN.
 *
 * The tangent points T1/T2 are emitted EXACTLY (not re-derived from C + R'*(cos,sin)) so the
 * result is bit-exact on axis-aligned edges — that is what makes a 2x1 rectangle's bbox stay
 * exactly 2.0000 x 1.0000. Fillets always cut INWARD; the bbox can never grow.
 */
export function filletPolyline(pts, r, segs = 2, closed = false, opts = EMPTY) {
  const n = pts ? pts.length : 0;
  if (!n) return [];
  const make = pointFactory(pts[0], opts.make);
  if (n < 3 || segs < 1) {
    const copy = new Array(n);
    for (let i = 0; i < n; i++) copy[i] = make(pts[i].x, pts[i].y);
    return copy;
  }

  const radiusAt = typeof r === 'function'
    ? r
    : (Array.isArray(r) ? (i) => r[i] || 0 : () => r);
  const eps = opts.eps === undefined ? 1e-9 : opts.eps;
  const out = [];

  for (let i = 0; i < n; i++) {
    const V = pts[i];
    if (!closed && (i === 0 || i === n - 1)) { out.push(make(V.x, V.y)); continue; }

    const A = pts[(i - 1 + n) % n];
    const B = pts[(i + 1) % n];
    const R = radiusAt(i, V);

    let ax = A.x - V.x, ay = A.y - V.y;
    let bx = B.x - V.x, by = B.y - V.y;
    const la = Math.sqrt(ax * ax + ay * ay);
    const lb = Math.sqrt(bx * bx + by * by);
    if (!(R > 0) || la < eps || lb < eps) { out.push(make(V.x, V.y)); continue; }
    ax /= la; ay /= la; bx /= lb; by /= lb;

    const d = clamp(ax * bx + ay * by, -1, 1);
    const theta = Math.acos(d);
    // Collinear (nothing to round) or a hairpin spike (the arc would be degenerate): emit V.
    if (theta > PI - 1e-4 || theta < 1e-4) { out.push(make(V.x, V.y)); continue; }

    const halfT = Math.tan(theta * 0.5);
    let t = R / halfT;
    const halfA = 0.5 * la, halfB = 0.5 * lb;
    if (t > halfA) t = halfA;
    if (t > halfB) t = halfB;
    const Rp = t * halfT;
    if (!(Rp > eps)) { out.push(make(V.x, V.y)); continue; }

    const t1x = V.x + t * ax, t1y = V.y + t * ay;
    const t2x = V.x + t * bx, t2y = V.y + t * by;

    let sx = ax + bx, sy = ay + by;                 // unnormalised bisector
    const ls = Math.sqrt(sx * sx + sy * sy);
    if (ls < eps) { out.push(make(V.x, V.y)); continue; }
    sx /= ls; sy /= ls;

    const cdist = Rp / Math.sin(theta * 0.5);
    const ccx = V.x + sx * cdist, ccy = V.y + sy * cdist;

    const a1 = Math.atan2(t1y - ccy, t1x - ccx);
    const a2 = Math.atan2(t2y - ccy, t2x - ccx);
    const sweep = wrapPi(a2 - a1);                  // short way — the fillet arc subtends PI-theta

    out.push(make(t1x, t1y));                       // exact tangent point
    for (let k = 1; k < segs; k++) {
      const ang = a1 + sweep * (k / segs);
      out.push(make(ccx + Rp * Math.cos(ang), ccy + Rp * Math.sin(ang)));
    }
    out.push(make(t2x, t2y));                       // exact tangent point
  }
  return out;
}

/** Signed area of a closed polyline (positive = counter-clockwise). ExtrudeGeometry needs CCW
 *  outer contours and CW holes; getting this backwards inverts the extruded normals. */
export function polylineArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a * 0.5;
}

/** Axis-aligned bounds of a polyline into `out` ({minX,minY,maxX,maxY}). Used by the fillet
 *  acceptance check and by kit modules that must place a part inside a module envelope. */
export function polylineBounds(pts, out = { minX: 0, minY: 0, maxX: 0, maxY: 0 }) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  out.minX = minX; out.minY = minY; out.maxX = maxX; out.maxY = maxY;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Module handle
// ─────────────────────────────────────────────────────────────────────────────────────────────

const _stats = Object.freeze({ ms: 0 });
/**
 * mathx is pure and stateless: it has no per-frame cost of its OWN — every cycle it burns is
 * charged to the caller that invoked it. Reported as 0 so debug/debugApi.js can aggregate every
 * module uniformly without a special case.
 */
export function stats() { return _stats; }

/**
 * Factory form, for the modules whose contract takes mathx as an injected dependency
 * (e.g. createCameraRig(constants, mathx)). Returns the same pure functions; there is no
 * per-instance state, so two engines can share one handle safely.
 */
export function createMathx() {
  return {
    TAU, PI, HALF_PI, DEG2RAD, RAD2DEG, EPSILON, GOLDEN_ANGLE,
    FBM_OCTAVES, FBM_LACUNARITY, FBM_GAIN,
    IGN_MAGIC_X, IGN_MAGIC_Y, IGN_MAGIC_Z, IGN_FRAME_SCROLL,
    clamp, saturate, lerp, invLerp, invLerpSat, smoothstep, smootherstep,
    remap, remapSat, moveTowards, fract, sign, step, pingpong,
    wrapPi, wrapTau, angleDelta,
    easeOutCubic, easeInCubic, easeInOutCubic, easeOutBack, easeOutExpo,
    bell, transport,
    damp, dampAngle, damp3, lambdaFromBlend60, blend60FromLambda,
    springStep, springStepAngle, criticalDamping,
    halton, halton2, r2, hammersley, vogelDisk, ign,
    mulberry32, cellSeed, cellSeed3, gaussian, gaussianClamped,
    hash2, hash3, hash2v, hashSin2,
    valueNoise2, valueNoise3, noised2, fbmd2, fbmDamped2, ridgedd2,
    fbm2, fbm2xy, fbm3, fbm3xyz,
    domainWarp2, worley2, worleyF1, worleyEdge, ridged, ridgedFbm2,
    filletPolyline, polylineArea, polylineBounds,
    stats, selfTest,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Acceptance self-test
//
// Waves 0-4 produce no renderable frame, so they gate on their own unit acceptance criteria
// (ARCHITECTURE.md §4 / module_plan gate). This asserts the three criteria in this module's
// contract plus the invariants that would silently corrupt every downstream bake if they broke.
// It ASSERTS named pass/fail invariants — it does not dump values to be eyeballed.
//   node -e "import('./src/core/mathx.js').then(m=>console.log(JSON.stringify(m.selfTest(),null,2)))"
// ─────────────────────────────────────────────────────────────────────────────────────────────

export function selfTest() {
  const failures = [];
  let checks = 0;
  const check = (name, ok, detail) => { checks++; if (!ok) failures.push({ name, detail }); };

  // ── 1. filletPolyline on a 2x1 rectangle keeps the bbox EXACTLY 2.0000 x 1.0000, and the 90 deg
  //       setback at segs=2 equals R*(sqrt(2)-1) to 4dp.
  {
    const R = 0.12;
    const rect = [{ x: -1, y: -0.5 }, { x: 1, y: -0.5 }, { x: 1, y: 0.5 }, { x: -1, y: 0.5 }];
    const f = filletPolyline(rect, R, 2, true);
    const b = polylineBounds(f);
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    check('fillet.bbox.width', Math.abs(w - 2) < 1e-12, `width=${w}`);
    check('fillet.bbox.height', Math.abs(h - 1) < 1e-12, `height=${h}`);
    check('fillet.bbox.noGrowth', b.minX >= -1 && b.maxX <= 1 && b.minY >= -0.5 && b.maxY <= 0.5,
      JSON.stringify(b));
    check('fillet.pointCount', f.length === 12, `got ${f.length}, expected 4 corners x 3 points`);

    // Setback = distance from the original corner to the arc apex = R*(sqrt(2)-1) at 90 deg.
    const corner = rect[2];                       // (1, 0.5)
    const apex = f[7];                            // corner 2 -> points 6,7,8; 7 is the arc midpoint
    const setback = Math.sqrt((apex.x - corner.x) ** 2 + (apex.y - corner.y) ** 2);
    const expect = R * (Math.SQRT2 - 1);
    check('fillet.setback90', Math.abs(setback - expect) < 5e-5,
      `setback=${setback.toFixed(6)} expected=${expect.toFixed(6)}`);

    // An over-large radius on a short edge must clamp, not NaN or invert.
    const tiny = filletPolyline([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], 0.9, 2, true);
    check('fillet.overlargeClamp', tiny.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)
      && p.x >= -1e-12 && p.x <= 1 + 1e-12 && p.y >= -1e-12 && p.y <= 1 + 1e-12), 'R=0.9 on a 1-unit edge');

    // segs=1 is a flat chamfer: 2 points per corner.
    check('fillet.chamfer', filletPolyline(rect, R, 1, true).length === 8, 'segs=1');
  }

  // ── 2. mulberry32(1234) produces an identical first-1000 sequence across runs.
  {
    const a = mulberry32(1234), b = mulberry32(1234);
    let same = true, inRange = true, sum = 0;
    for (let i = 0; i < 1000; i++) {
      const x = a(), y = b();
      if (x !== y) same = false;
      if (!(x >= 0 && x < 1)) inRange = false;
      sum += x;
    }
    check('rng.reproducible', same, 'two mulberry32(1234) streams diverged');
    check('rng.range', inRange, 'draw outside [0,1)');
    check('rng.uniformish', Math.abs(sum / 1000 - 0.5) < 0.03, `mean=${(sum / 1000).toFixed(4)}`);
    // State snapshot/restore must resume the identical stream (streaming save/restore depends on it).
    const c = mulberry32(99); c(); c(); const s = c.state(); const v1 = c();
    check('rng.stateRestore', mulberry32(0).setState(s)() === v1, 'setState did not resume the stream');
    // cellSeed must be a pure function of its key.
    check('rng.cellSeedStable', cellSeed(7, -3, 11) === cellSeed(7, -3, 11), 'cellSeed not pure');
    check('rng.cellSeedDistinct', cellSeed(7, -3, 11) !== cellSeed(7, 11, -3), 'cellSeed key collision');
  }

  // ── 3. damp() at 30/60/144 fps converges to within 1e-4 over 1 s.
  {
    const run = (fps) => {
      let x = 0;
      const dt = 1 / fps;
      for (let i = 0; i < fps; i++) x = damp(x, 1, 6, dt);
      return x;
    };
    const a = run(30), b = run(60), c = run(144);
    const spread = Math.max(a, b, c) - Math.min(a, b, c);
    check('damp.frameRateIndependent', spread < 1e-4, `spread=${spread.toExponential(3)}`);
    check('damp.exactForm', Math.abs(damp(0, 1, 6, 0.25) - (1 - Math.exp(-1.5))) < 1e-15, 'not lerp(x,y,1-exp(-l*dt))');
    check('damp.lambdaFromBlend60', Math.abs(lambdaFromBlend60(0.1) - 6.3216) < 1e-3, 'k=0.1 should give ~6.3216');
    // dampAngle must take the SHORT way across the +/-PI seam (0.283 rad forward, not 6.0 back).
    const da = dampAngle(3.0, -3.0, 20, 1);
    check('damp.angleShortPath', Math.abs(wrapPi(da - -3.0)) < 1e-6, `converged to ${da}, expected ~-3.0`);
    check('damp.angleWrapped', da >= -PI && da <= PI, `${da}`);
    // A half-step must land between the endpoints going FORWARD through +PI, never back through 0.
    const half = dampAngle(3.0, -3.0, 6, 1 / 60);
    check('damp.angleNoLongWay', wrapPi(half - 3.0) > 0, `moved backwards: ${half}`);
  }

  // ── 4. Noise invariants: range, tileability, and the anti-alignment constants.
  {
    let lo = 1, hi = 0;
    for (let i = 0; i < 4096; i++) {
      const v = valueNoise2(i * 0.37, i * 0.11, 1234, 0);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    check('noise.range', lo >= 0 && hi <= 1 && hi - lo > 0.6, `[${lo.toFixed(3)}, ${hi.toFixed(3)}]`);

    const P = 64;
    let tileOk = true;
    for (let i = 0; i < 64; i++) {
      const x = i * 0.7, y = i * 0.31;
      if (Math.abs(valueNoise2(x, y, 5, P) - valueNoise2(x + P, y, 5, P)) > 1e-12) tileOk = false;
      if (Math.abs(valueNoise2(x, y, 5, P) - valueNoise2(x, y + P, 5, P)) > 1e-12) tileOk = false;
    }
    check('noise.valueTiles', tileOk, 'valueNoise2 is not periodic under its declared period');

    _optA.seed = 9; _optA.period = P; _optA.rotate = false;
    let fbmTileOk = true;
    for (let i = 0; i < 64; i++) {
      const x = i * 0.9, y = i * 0.43;
      if (Math.abs(fbm2xy(x, y, 5, FBM_LACUNARITY, 0.5, _optA) - fbm2xy(x + P, y + P, 5, FBM_LACUNARITY, 0.5, _optA)) > 1e-12) fbmTileOk = false;
    }
    check('noise.fbmTiles', fbmTileOk, 'fbm2 is not periodic under its declared period');
    check('noise.lacunarity', FBM_LACUNARITY !== 2.0, 'lacunarity 2.0 aligns octave lattices');
    check('noise.rotationIsRotation', Math.abs(ROT_A * ROT_A + ROT_B * ROT_B - 1) < 1e-12, 'per-octave matrix is not orthonormal');

    const w = worley2(3.7, -2.3, { seed: 4, jitter: 0.9 }, { f1: 0, f2: 0, id: 0, cx: 0, cy: 0 });
    check('noise.worleyOrder', w.f2 >= w.f1 && w.f1 >= 0, `f1=${w.f1} f2=${w.f2}`);
    check('noise.worleyId', w.id >= 0 && w.id < 1, `id=${w.id}`);
    check('noise.ridged', Math.abs(ridged(0.5) - 1) < 1e-12 && Math.abs(ridged(0)) < 1e-12, 'ridged is not 1-|2n-1|');

    // Analytic derivative acceptance: 1,000 deterministic, non-hand-picked points against a
    // symmetric central difference. This is the gate that catches both a wrong fade derivative
    // and a forgotten octave Jacobian.
    let maxNoiseErr = 0, maxFbmErr = 0;
    const eps = 1e-5;
    const nd = { value: 0, dx: 0, dy: 0 };
    const fd = { value: 0, dx: 0, dy: 0, highFrequencyEnergy: 0 };
    const fOpts = { seed: 713, period: 0, rotate: true };
    for (let i = 0; i < 1000; i++) {
      const x = ((i * 0.7548776662466927) % 1) * 97.31 - 41.7;
      const y = ((i * 0.5698402909980532) % 1) * 83.17 - 32.2;
      noised2(x, y, 91, 0, nd);
      const ndx = (valueNoise2(x + eps, y, 91) - valueNoise2(x - eps, y, 91)) / (2 * eps);
      const ndy = (valueNoise2(x, y + eps, 91) - valueNoise2(x, y - eps, 91)) / (2 * eps);
      maxNoiseErr = Math.max(maxNoiseErr, Math.abs(nd.dx - ndx), Math.abs(nd.dy - ndy));
      fbmd2(x * 0.07, y * 0.07, 5, FBM_LACUNARITY, FBM_GAIN, fOpts, fd);
      const fdx = (fbm2xy((x + eps) * 0.07, y * 0.07, 5, FBM_LACUNARITY, FBM_GAIN, fOpts)
        - fbm2xy((x - eps) * 0.07, y * 0.07, 5, FBM_LACUNARITY, FBM_GAIN, fOpts)) / (2 * eps);
      const fdy = (fbm2xy(x * 0.07, (y + eps) * 0.07, 5, FBM_LACUNARITY, FBM_GAIN, fOpts)
        - fbm2xy(x * 0.07, (y - eps) * 0.07, 5, FBM_LACUNARITY, FBM_GAIN, fOpts)) / (2 * eps);
      // Central difference above is with respect to unscaled x/y; fd is with respect to its
      // direct input, hence the 0.07 chain-rule factor.
      maxFbmErr = Math.max(maxFbmErr, Math.abs(fd.dx * 0.07 - fdx), Math.abs(fd.dy * 0.07 - fdy));
    }
    check('noise.analyticDerivative1000', maxNoiseErr < 1e-4,
      `max |analytic-central|=${maxNoiseErr.toExponential(3)}`);
    check('noise.fbmDerivativeJacobian1000', maxFbmErr < 1e-4,
      `max |analytic-central|=${maxFbmErr.toExponential(3)}`);

    // The damping must be switchable and must preferentially suppress fine energy on steep
    // cells. Sort by undamped base slope, compare the lowest/highest quartiles, and retain the
    // damping=0 arm as the planted refutation.
    const energyRows = [];
    const zero = { value: 0, dx: 0, dy: 0, highFrequencyEnergy: 0 };
    const damped = { value: 0, dx: 0, dy: 0, highFrequencyEnergy: 0 };
    for (let i = 0; i < 256; i++) {
      const x = i * 0.173 + 0.19, y = i * 0.097 - 7.3;
      noised2(x, y, 313, 0, nd);
      fbmDamped2(x, y, 6, FBM_LACUNARITY, FBM_GAIN, 0, { seed: 313 }, zero);
      fbmDamped2(x, y, 6, FBM_LACUNARITY, FBM_GAIN, 1, { seed: 313 }, damped);
      energyRows.push({
        slope: nd.dx * nd.dx + nd.dy * nd.dy,
        ratio: damped.highFrequencyEnergy / Math.max(zero.highFrequencyEnergy, 1e-12),
      });
    }
    energyRows.sort((a, b) => a.slope - b.slope);
    let flatRatio = 0, steepRatio = 0;
    for (let i = 0; i < 64; i++) {
      flatRatio += energyRows[i].ratio;
      steepRatio += energyRows[energyRows.length - 1 - i].ratio;
    }
    flatRatio /= 64; steepRatio /= 64;
    check('noise.derivativeDampingSwitch', energyRows.some((r) => r.ratio < 0.99),
      'damping=1 did not differ from the damping=0 refutation arm');
    check('noise.derivativeDampingSteepCells', steepRatio < flatRatio,
      `steep ratio=${steepRatio.toFixed(4)} flat ratio=${flatRatio.toFixed(4)}`);
  }

  // ── 5. Dither/sequence constants must stay phase-coherent with the vendored shader.
  {
    check('ign.constants', IGN_MAGIC_X === 0.06711056 && IGN_MAGIC_Y === 0.00583715 && IGN_MAGIC_Z === 52.9829189,
      'IGN magic constants drifted from Jimenez / r185');
    const v = ign(101, 57, 3);
    check('ign.range', v >= 0 && v < 1, `${v}`);
    check('ign.temporal', ign(101, 57, 3) !== ign(101, 57, 4), 'IGN does not advance per frame');
    check('halton.zero', halton(0, 2) === 0 && Math.abs(halton(1, 2) - 0.5) < 1e-15, 'radical inverse wrong');
    check('vogel.goldenAngle', GOLDEN_ANGLE === 2.399963229728653, 'golden angle differs from r185');
    const vd = vogelDisk(4, 5, 0, { x: 0, y: 0 });
    check('vogel.inDisk', Math.sqrt(vd.x * vd.x + vd.y * vd.y) <= 1 + 1e-12, 'sample outside the unit disk');
  }

  // ── 6. springStep must be stable at absurd dt (the frame-hitch case that kills explicit Euler).
  {
    const s = { x: 1, v: 0 };
    for (let i = 0; i < 50; i++) springStep(s, 0, 62, 0.5);   // 500 ms steps, swayStiffness = 62
    check('spring.stableAtHugeDt', Number.isFinite(s.x) && Math.abs(s.x) < 1e-6, `x=${s.x}`);
    const s2 = { x: 1, v: 0 };
    for (let i = 0; i < 240; i++) springStep(s2, 0, 62, 1 / 120);
    check('spring.criticalNoOvershoot', s2.x >= -1e-6, `undershot to ${s2.x}`);
    const s3 = { x: 0, v: 0 };
    springStep(s3, 1, 40, 1 / 120, 0.4);
    check('spring.underdampedRuns', Number.isFinite(s3.x) && Number.isFinite(s3.v), 'zeta<1 branch produced NaN');
    const s4 = { x: 0, v: 0 };
    springStep(s4, 1, 40, 1 / 120, 2.5);
    check('spring.overdampedRuns', Number.isFinite(s4.x) && Number.isFinite(s4.v), 'zeta>1 branch produced NaN');
  }

  // ── 7. Swept-effect primitives close cleanly and preserve a transported orthonormal frame.
  {
    check('bell.closed', bell(0) === 0 && bell(1) < 1e-29 && bell(0.5) === 1,
      `bell=[${bell(0)},${bell(0.5)},${bell(1)}]`);
    const out = new Float32Array(6);
    transport(out, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0);
    const norm = Math.hypot(out[0], out[1], out[2]);
    check('transport.minimalQuarterTurn', Math.abs(out[0] + 1) < 1e-6
      && Math.abs(out[1]) < 1e-6 && Math.abs(out[2]) < 1e-6 && Math.abs(norm - 1) < 1e-6,
    `right=[${out[0]},${out[1]},${out[2]}] norm=${norm}`);
    transport(out, 3, 0, 1, 0, 1, 0, 0, -1, 0, 0);
    check('transport.antiparallelTotal', Number.isFinite(out[3]) && Number.isFinite(out[4])
      && Number.isFinite(out[5]) && Math.abs(Math.hypot(out[3], out[4], out[5]) - 1) < 1e-6,
    `right=[${out[3]},${out[4]},${out[5]}]`);
  }

  return { pass: failures.length === 0, failures, checks };
}
