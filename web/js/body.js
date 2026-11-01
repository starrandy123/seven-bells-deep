// The Warden's body: from what the rules decided to the bones that get drawn. Runs once a frame, at any display rate.
//   clips (sampled here, phase-locked) → inertialization on every switch → lean from followers → a foot that's down held on the real ground → two-bone IK → mantle and hair.
// On land the whole body is the capture's, legs included, and the clip runs at the rate that matches his speed (formulas/gait.js). All that's added is what a body on real ground needs: a foot that's down stays
// where it came down, on the ground under it, and the leg bends to reach it. Sim and body are apart: hero.js moves the body through the world, this only draws it.
import * as THREE from 'three';
import { second, follower, chase, first, nearAngle } from './formulas/follow.js';
import { quintic, at } from './formulas/inertial.js';
import * as K from './formulas/ik.js';
import { stride, along, seenAt, setGaits, warp, GAITS, MATCH } from './formulas/gait.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const LEG_BONES = ['leg_', 'shin_', 'foot_', 'toe_'], MAX_DROP = 0.26;

// which one-shots keep the clip's own legs on land. Everything else stands on pinned feet, whatever the arms do
const DRAW_T = 0.2, SHEATHE_T = 0.35, SLOT_WAY = [-0.40, 0.90, -0.10], SLOT_AT = [0.0, -0.08, -0.215];      // s to draw and to put away; on his back: the way the tines point, up over the right shoulder, and where the grip sits from the chest bone, in the rest pose, facing +z
const CLOTH_SWIM = 0.34, CLOTH_HUG = -0.42;   // rad: the most the water lifts the mantle off his back, and how it lies at a swim, pressed down along a back that's arched
// a real start and a real stop: how fast they play (the same as the strides), which clip by how fast he's after going or was going, and where each hands over: to the stride, at this phase of it with the first foot down; to the stand, this far through, with both feet still
const ONCE_RATE = 1.25, ONCE_END = { run_start: 0.17, walk_start: 0.25 }, ONCE_CUT = { run_stop: 1.05, walk_stop: 1.25 }, RUN_FROM = 2.6;
// a capture of a start begins at a stand on the flat: he lands from a run, wades ashore or comes off the land ride already going, and on a hill the stride does it
const ONCE_MOST = 2.4, ONCE_SLOPE = 0.27;
const REACH_OFF = 0.965;      // how much of a leg's length a foot on the ground can be from the hip before it comes up
const STROKES = 2;           // arm strokes in one cycle of the crawl
const SLOPE_STRIDE = 0.45;     // the most a hill shortens his steps, up or down, and they quicken to match: the same speed on the ground, on legs that reach it
const KNEE_RATE = 24.4;      // rad/s, 1,400°/s: a knee has a top speed. Past the capture's it's the solver's, near the straight, where a small move of the ankle is a big turn of the knee
const FOOT_RATE = 20;        // rad/s: and the foot's. A handover can leave a foot in the air with no swing left to get flat in
const TOE_RATE = 24;         // rad/s: the toe joint is the capture's, without the capture's noise, 1,576°/s at his rate on a joint this small
const HOVER_OUT = 1.5;     // m/s: a hard landing's feet come the last of the way to the ground at this
const CLIP_LEGS = new Set(['death', 'jump', 'jump2', 'leap_super', 'surf_jump', 'glacier_stomp', 'dodge_land', 'atk_dash_land']);      // a land dodge goes off at 18 m/s in a frame or two, Riptide at 34: no foot could stay planted, and the slide's in the clip
// how a switch dies away: an offset is given the time it needs to die at this rate at most, radians a second, so a big difference takes longer than a small one and nothing pops (M3b)
const SWITCH_RATE = 10.5;
const HIPS_EASE = 45;         // m/s²: what a pose's hip change may add to a landing's brake (M5g)
const FACE_RATE = 12.5;      // M14e: his facing turns at most 716°/s, whatever sets it
// the landing. The drawn body stops at BRAKE m/s² (M5g's bound less a margin), which from a long fall means it starts just before the feet touch. Depth is by how hard he comes down
const BRAKE = 105, depthFor = (v) => clamp((v - 1) * 0.025, 0.03, 0.6);

export function createBody(G, h, { root, model, bones, clips, STAND, moves }) {
  setGaits(moves);
  // ---------------------------------------------------------------- the rest pose, in the model's own space (he faces +z, his left is +x)
  model.updateMatrixWorld(true);
  const names = Object.keys(bones), index = {}, REST = { q: {}, p: {} }, v0 = new THREE.Vector3(), q0 = new THREE.Quaternion();
  names.forEach((n, i) => { index[n] = i; bones[n].getWorldPosition(v0); bones[n].getWorldQuaternion(q0); REST.p[n] = v0.toArray(); REST.q[n] = [q0.x, q0.y, q0.z, q0.w]; });
  const N = names.length, rest = names.map((n) => { const q = bones[n].quaternion; return [q.x, q.y, q.z, q.w]; }), hipsRestP = bones.hips ? bones.hips.position.toArray() : [0, 1, 0];
  const hipsParent = bones.hips ? (bones.hips.parent.isBone ? bones.hips.parent.name : null) : null;
  const Pm = hipsParent ? REST.q[hipsParent] : [0, 0, 0, 1], Pmi = K.qconj(Pm);

  // every clip as its bones' interpolants
  const CL = {};
  for (const c of clips) {
    const e = { name: c.name, dur: c.duration, q: new Array(N).fill(null), p: null };
    for (const t of c.tracks) { const [b, prop] = t.name.split('.'), i = index[b]; if (i === undefined) continue; if (prop === 'quaternion') e.q[i] = t.createInterpolant(); else if (prop === 'position' && b === 'hips') e.p = t.createInterpolant(); }
    CL[c.name] = e;
  }
  const has = (n) => !!CL[n], animated = new Array(N).fill(false);
  for (const n in CL) CL[n].q.forEach((x, i) => { if (x) animated[i] = true; });
  const ACT = []; for (let i = 0; i < N; i++) if (animated[i]) ACT.push(i);
  const isLeg = (n) => LEG_BONES.some((b) => n === b + 'R' || n === b + 'L'), legSide = names.map((n) => (isLeg(n) ? (n.endsWith('R') ? 1 : 2) : 0));
  const groupA = ACT.filter((i) => !isLeg(names[i])), groupB = ACT.filter((i) => isLeg(names[i]));

  // sampled pose, output of last two frames, the running offsets
  const accQ = new Float64Array(N * 4), accW = new Float64Array(N), pose = new Float64Array(N * 4), last = new Float64Array(N * 4), last2 = new Float64Array(N * 4), accP = [0, 0, 0];
  let poseP = hipsRestP.slice(), lastP = hipsRestP.slice(), last2P = hipsRestP.slice();
  const offs = new Array(N).fill(null);
  for (let i = 0; i < N; i++) { const r = rest[i]; for (let k = 0; k < 4; k++) { pose[i * 4 + k] = r[k]; last[i * 4 + k] = r[k]; last2[i * 4 + k] = r[k]; } }
  let offP = null, inertT = 9, inertP = 9, pendingT = 0, prevDt = 1 / 60;

  // tR, tL: each leg's own time in the clip, if it isn't the body's
  function sample(name, t, w, tR, tL) {
    const c = CL[name]; if (!c || w <= 1e-4) return;
    const tt = clamp(t, 0, c.dur - 1e-4), uR = tR === undefined ? tt : clamp(tR, 0, c.dur - 1e-4), uL = tL === undefined ? tt : clamp(tL, 0, c.dur - 1e-4);
    for (const i of ACT) {
      const it = c.q[i]; let x, y, z, q;
      if (it) { const r = it.evaluate(legSide[i] === 1 ? uR : legSide[i] === 2 ? uL : tt); x = r[0]; y = r[1]; z = r[2]; q = r[3]; } else { const r = rest[i]; x = r[0]; y = r[1]; z = r[2]; q = r[3]; }
      const o = i * 4, s = accW[i] > 0 && accQ[o] * x + accQ[o + 1] * y + accQ[o + 2] * z + accQ[o + 3] * q < 0 ? -w : w;
      accQ[o] += x * s; accQ[o + 1] += y * s; accQ[o + 2] += z * s; accQ[o + 3] += q * s; accW[i] += w;
    }
    const r = c.p ? c.p.evaluate(tt) : hipsRestP; accP[0] += r[0] * w; accP[1] += r[1] * w; accP[2] += r[2] * w; accP.w = (accP.w || 0) + w;
  }
  function settle() {
    for (const i of ACT) { const o = i * 4, l = Math.hypot(accQ[o], accQ[o + 1], accQ[o + 2], accQ[o + 3]); if (l > 1e-6) for (let k = 0; k < 4; k++) pose[o + k] = accQ[o + k] / l; }
    if (accP.w > 0) { poseP[0] = accP[0] / accP.w; poseP[1] = accP[1] / accP.w; poseP[2] = accP[2] / accP.w; }
    accQ.fill(0); accW.fill(0); accP[0] = accP[1] = accP[2] = 0; accP.w = 0;
  }

  // ---------------------------------------------------------------- inertialization: a switch is instant, the difference dies away on a quintic
  function capture(group, T) {
    for (const i of group) {
      const o = i * 4, n = [pose[o], pose[o + 1], pose[o + 2], pose[o + 3]], p1 = [last[o], last[o + 1], last[o + 2], last[o + 3]], p2 = [last2[o], last2[o + 1], last2[o + 2], last2[o + 3]];
      let d = K.qmul(p1, K.qconj(n)); if (d[3] < 0) d = [-d[0], -d[1], -d[2], -d[3]];
      const s = Math.hypot(d[0], d[1], d[2]); if (s < 1e-5) { offs[i] = null; continue; }
      const ax = [d[0] / s, d[1] / s, d[2] / s], x0 = 2 * Math.atan2(s, d[3]);
      let e = K.qmul(p2, K.qconj(n)); if (e[3] < 0) e = [-e[0], -e[1], -e[2], -e[3]];
      const xp = 2 * Math.atan2(e[0] * ax[0] + e[1] * ax[1] + e[2] * ax[2], e[3]);
      offs[i] = { ax, c: quintic(x0, (x0 - xp) / Math.max(prevDt, 1 / 240), clamp((1.875 * x0) / SWITCH_RATE, T, 0.6)) };
    }
  }
  function offsets(group, t) {
    for (const i of group) {
      const f = offs[i]; if (!f) continue; const a = at(f.c, t);
      if (a === 0 && t >= f.c.T) { offs[i] = null; continue; }
      const o = i * 4, s = Math.sin(a / 2), q = [f.ax[0] * s, f.ax[1] * s, f.ax[2] * s, Math.cos(a / 2)], r = K.qmul(q, [pose[o], pose[o + 1], pose[o + 2], pose[o + 3]]);
      pose[o] = r[0]; pose[o + 1] = r[1]; pose[o + 2] = r[2]; pose[o + 3] = r[3];
    }
  }
  function captureP(T) { offP = [0, 1, 2].map((k) => { const x0 = lastP[k] - poseP[k], xp = last2P[k] - poseP[k]; return quintic(x0, (x0 - xp) / Math.max(prevDt, 1 / 240), clamp(Math.sqrt((20 * Math.abs(x0)) / HIPS_EASE), T, 0.6)); }); }      // the hips' place: a quintic starts at its hardest, 20 x0 / T², so T is what keeps that under HIPS_EASE
  function offsetsP(t) { if (!offP) return; for (let k = 0; k < 3; k++) poseP[k] += at(offP[k], t); if (t >= Math.max(offP[0].T, offP[1].T, offP[2].T)) offP = null; }
  const inertia = (T = 0.22) => { pendingT = Math.max(pendingT, T); };
  let pendingA = 0, inertA = 9;
  // a switch of the trunk only. The legs are solved from where the feet are: an offset on them would drag a foot that's down
  const trunk = (T) => { pendingA = Math.max(pendingA, T); };

  // ---------------------------------------------------------------- the one-shot on top of locomotion
  let shot = null;
  function play(name, fade = 0.08, auto = false) {
    if (!has(name)) return false;
    shot = { name, t: 0, dur: CL[name].dur, auto };
    inertia(clamp(fade * 3, 0.1, 0.26));
    return true;
  }
  function clear(fade = 0.18) { if (shot) { shot = null; inertia(clamp(fade * 1.4, 0.14, 0.3)); } }

  // ---------------------------------------------------------------- the legs
  const makeLeg = (s, i) => {
    const hip = REST.p['leg_' + s], knee = REST.p['shin_' + s], ank = REST.p['foot_' + s], toe = REST.p['toe_' + s];
    const f0 = K.unit([toe[0] - ank[0], 0, toe[2] - ank[2]]), up0 = [0, 1, 0];
    return { s, side: s === 'R' ? -1 : 1, off: i * 0.5, R: K.rest(hip, knee, ank, [1, 0, 0]), F0: K.frame(f0, up0), L: 0, down: true, G: [0, 0, 0], f: [0, 0, 1], n: [0, 1, 0], rock: 0, pitch: 0, toe: 0,
      ph: 0, pL: 0, S: [0, 0, 0], B0: 0, pitch0: 0, A: [0, 0, 0], fw: [0, 0, 1], nw: [0, 1, 0], solo: 0, toeOutYaw: Math.atan2(f0[0], f0[2]) };
  };
  const legs = ['R', 'L'].map(makeLeg); legs.forEach((l) => { l.L = l.R.l1 + l.R.l2; });
  const FT = { h: REST.p.foot_R ? REST.p.foot_R[1] : 0.1, ball: REST.p.foot_R ? Math.hypot(REST.p.toe_R[0] - REST.p.foot_R[0], REST.p.toe_R[2] - REST.p.foot_R[2]) : 0.13, heel: 0.06 };
  const IDLE = { R: { f: 0.02, l: -0.125 }, L: { f: 0.10, l: 0.145 } };   // where the feet stand at ease: the `stand` clip's own places, read below
  const S = {}; let phase = 0, gaitOn = false, landed = false, loco = null;
  const onNow = (w, t) => w.some((x) => t >= x[0] && t < x[1]), nextOn = (w, t, end) => { for (const x of w) if (x[0] > t) return x[0]; return end; };
  const steep = () => Math.hypot(h.groundAt(body[0] + 0.8, body[2]) - h.groundAt(body[0] - 0.8, body[2]), h.groundAt(body[0], body[2] + 0.8) - h.groundAt(body[0], body[2] - 0.8)) / 1.6;      // the ground's own steepness, whichever way he's going on it: across a hill the feet are at different heights just the same
  const onceOf = (base, mirror) => { const name = base + (mirror ? '_m' : ''), m = moves && moves[name]; return CL[name] && m && m.once ? { name, base, on: m.once.on, mirror, t: 0, dur: CL[name].dur } : null; };
  // the legs as the clips have them: his own joints under the sampled turns, in the model's space (he faces +z, his left is +x), before any foot is held or the body leans. held: the pose the walk or run gave, whatever a blow is doing above it
  const legOff = {}, held = new Float64Array(N * 4); let heldP = hipsRestP.slice();
  const hipsPU = bones.hips && hipsParent ? K.len(K.sub(REST.p.hips, REST.p[hipsParent])) / Math.max(K.len(hipsRestP), 1e-6) : 1;
  for (const s of ['R', 'L']) for (const [a, b] of [['hips', 'leg_'], ['leg_', 'shin_'], ['shin_', 'foot_'], ['foot_', 'toe_']]) { const pa = a === 'hips' ? a : a + s; legOff[b + s] = K.qrot(K.qconj(REST.q[pa]), K.sub(REST.p[b + s], REST.p[pa])); }
  const heldQ = (n) => { const o = index[n] * 4; return [held[o], held[o + 1], held[o + 2], held[o + 3]]; };
  function clipLeg(l) {
    const s = l.s, W0 = K.qmul(Pm, heldQ('hips')), dH = K.qrot(Pm, K.sub(heldP, hipsRestP)), P0 = K.add(REST.p.hips, K.scale(dH, hipsPU));
    const J = K.add(P0, K.qrot(W0, legOff['leg_' + s])), W1 = K.qmul(W0, heldQ('leg_' + s)), Kn = K.add(J, K.qrot(W1, legOff['shin_' + s])), W2 = K.qmul(W1, heldQ('shin_' + s)), A = K.add(Kn, K.qrot(W2, legOff['foot_' + s])), W3 = K.qmul(W2, heldQ('foot_' + s)), W4 = K.qmul(W3, heldQ('toe_' + s));
    const qf = K.qmul(W3, K.qconj(REST.q['foot_' + s])), qt = K.qmul(W4, K.qconj(REST.q['toe_' + s])), fw = K.qrot(qf, l.F0[0]), nw = K.qrot(qf, l.F0[1]), ax = K.unit(K.cross(nw, fw)), r = K.qmul(qt, K.qconj(qf));
    return { J, Kn, A, W1, W2, fw, nw, rock: Math.atan2(fw[1], Math.hypot(fw[0], fw[2])), toe: 2 * Math.atan2(r[0] * ax[0] + r[1] * ax[1] + r[2] * ax[2], r[3]) };
  }
  // the slope under a foot: where the two sides disagree it's an edge, not a slope, and the gentler side is the truth
  const gentler = (a, b) => (Math.abs(a - b) > 0.09 ? (Math.abs(a) < Math.abs(b) ? a : b) : (a + b) / 2);
  const groundN = (x, z, out) => { const e = 0.3, c = h.groundAt(x, z), gx = gentler(h.groundAt(x + e, z) - c, c - h.groundAt(x - e, z)), gz = gentler(h.groundAt(x, z + e) - c, c - h.groundAt(x, z - e)); const n = K.unit([-gx / e, 1, -gz / e]); out[0] = n[0]; out[1] = n[1]; out[2] = n[2]; return out; };
  const onSlope = (f, n) => K.unit(K.sub(f, K.scale(n, K.dot(f, n))));
  // a foot's forward and up, pitched by a: + toes up
  const pitched = (f, n, a) => { const c = Math.cos(a), s = Math.sin(a); return [[f[0] * c + n[0] * s, f[1] * c + n[1] * s, f[2] * c + n[2] * s], [n[0] * c - f[0] * s, n[1] * c - f[1] * s, n[2] * c - f[2] * s]]; };
  // the ankle of a foot rocked over its heel (rock > 0) or its ball (rock < 0), the rest of the foot's place on the ground G
  function ankleOn(l, out) {
    const [fw, nw] = pitched(l.f, l.n, l.rock); l.fw = fw; l.nw = nw;
    if (l.rock >= 0) { const p = K.sub(l.G, K.scale(l.f, FT.heel)); return K.add(K.add(p, K.scale(fw, FT.heel)), K.scale(nw, FT.h)); }
    const p = K.add(l.G, K.scale(l.f, FT.ball)); return K.add(K.add(p, K.scale(fw, -FT.ball)), K.scale(nw, FT.h));
  }
  const body = [0, 0, 0], fwd = [0, 0, 1], left = [1, 0, 0], vel = [0, 0, 0], seen = [0, 0, 0];      // seen: his velocity as the feet have it: all of it up to MATCH
  const toWorld = (p) => [fwd[0] * p[2] + left[0] * p[0], p[1], fwd[2] * p[2] + left[2] * p[0]];
  // where this foot stands at ease
  function aim(l) { const io = IDLE[l.s], x = body[0] + fwd[0] * io.f + left[0] * io.l, z = body[2] + fwd[2] * io.f + left[2] * io.l; return [x, h.groundAt(x, z), z]; }
  function plantAt(l, G, a, way) {
    l.G = G; groundN(G[0], G[2], l.n);
    const c = Math.cos(l.toeOutYaw), s = Math.sin(l.toeOutYaw), fx = fwd[0] * c + (fwd[2]) * s, fz = fwd[2] * c - fwd[0] * s;   // his own foot's turn off straight ahead
    l.f = onSlope(way ? [way[0], 0, way[2]] : [fx, 0, fz], l.n); l.rock = a; l.down = true; l.solo = 0; l.rel = null;
    if (h.onPlant) h.onPlant(l, G);
  }
  const toeTo = (l, to, dt) => (l.toe === undefined ? to : l.toe + clamp(to - l.toe, -TOE_RATE * dt, TOE_RATE * dt));
  function lift(l) { l.down = false; l.keep = false; l.pL = l.ph; if (loco) { l.t0 = loco.t; l.t1 = nextOn(loco.on[l.s], loco.t, loco.dur); } l.gy = l.G[1] - body[1]; l.D0 = K.sub(l.A, [l.cA[0], l.cA[1] + l.gy, l.cA[2]]); l.fw0 = l.fw; l.nw0 = l.nw; l.fclear = null; l.clear = 0; }

  // the gait: which clips, and how far through them. First in the frame, so the pose is this frame's
  function advance(dt, full) {
    const eased = chase(P.stride, F.stride, full, dt); stride(eased, full, S);
    { const k = 1 - SLOPE_STRIDE * smooth(0.2, 0.7, chase(P.slope, F.slope, steep(), dt)); S.T *= k; S.k *= k; }
    // past the match limit what a stride can't take is carried: the feet go on with him at the difference, and from here on they see MATCH
    const speed = seenAt(full), share = full > 0 ? speed / full : 1, cx = vel[0] * (1 - share) * dt, cz = vel[2] * (1 - share) * dt; seen[0] = vel[0] * share; seen[2] = vel[2] * share;
    if (cx || cz) for (const l of legs) { l.G[0] += cx; l.G[2] += cz; l.G[1] += clamp(h.groundAt(l.G[0], l.G[2]) - l.G[1], -0.05, 0.05); if (l.down) l.A = ankleOn(l); }
    const swinging = legs.some((l) => !l.down), want = speed > 0.28;
    if (loco) {
      loco.t += dt * ONCE_RATE;
      const start = loco.base.endsWith('start'), wants = h.stick > 0.04;
      if (start && !wants && !swinging) { loco = null; gaitOn = false; trunk(0.2); }
      else if (!start && wants) { handOver((legs[0].down ? 0.16 : 0.16 + S.onL) % 1); }       // he's off again: straight into the stride, off the foot that's down
      else if (start && loco.t >= loco.dur - 1e-3) handOver((ONCE_END[loco.base] + (loco.mirror ? 0.5 : 0)) % 1);
      else if (!start && loco.t >= (ONCE_CUT[loco.base] ?? loco.dur)) { if (!swinging || loco.t >= loco.dur - 1e-3) { loco = null; gaitOn = false; trunk(0.3); } }
    } else if (gaitOn && !shot && !h.armed && !(h.stick > 0.04) && speed > 0.9) {         // he's let go: a real stop, from the next foot that's under him
      const w = (a) => { const p = ((phase - a) % 1 + 1) % 1; return p > 0.1 && p < 0.32; }, base = speed > RUN_FROM ? 'run_stop' : 'walk_stop';
      if ((w(0) || w(S.onL)) && steep() <= ONCE_SLOPE) { const o = onceOf(base, !w(0)); if (o) { loco = o; trunk(0.18); for (const l of legs) if (!l.down) { l.t0 = 0; l.t1 = nextOn(o.on[l.s], 0, o.dur); l.fresh = true; } } }
    }
    if (want && !gaitOn) {                             // setting off: the foot further behind goes first, at once
      const dir = speed > 0.05 ? [seen[0] / speed, 0, seen[2] / speed] : fwd, back = (l) => (l.G[0] - body[0]) * dir[0] + (l.G[2] - body[2]) * dir[2];
      const a = back(legs[0]) < back(legs[1]) ? legs[0] : legs[1];
      if (!shot && !loco && h.stick > 0.04 && !h.armed && speed < ONCE_MOST && steep() <= ONCE_SLOPE) { const o = onceOf((h.landGoal ?? 9) > RUN_FROM ? 'run_start' : 'walk_start', a.s === 'L'); if (o) { loco = o; gaitOn = true; trunk(0.16); } }
    }
    if (want && !gaitOn) {
      const dir = speed > 0.05 ? [seen[0] / speed, 0, seen[2] / speed] : fwd, back = (l) => (l.G[0] - body[0]) * dir[0] + (l.G[2] - body[2]) * dir[2];
      const a = back(legs[0]) < back(legs[1]) ? legs[0] : legs[1];
      // the other foot stays down: past the speed where a stance is under half the cycle, that puts this one mid-way through its swing. And a new phase is a new pose of the arms: it goes through the blend
      const was = phase; phase = a.s === 'L' ? (Math.max(S.bt, 1 - S.onL) + 0.001 + S.onL) % 1 : Math.max(S.bt, S.onL) + 0.001; gaitOn = true; if (Math.abs(((phase - was + 1.5) % 1) - 0.5) > 0.04) { if (speed > ONCE_MOST) inertia(0.16); else pendingA = 0.16; }       // landing at a run the legs take the blend as well: the feet have only just come down, and a new phase turns the thigh in its socket
    }
    if (!want && !swinging && !loco) gaitOn = false;
    if (gaitOn && !loco) phase = (phase + dt / S.T) % 1;
    gaitWant = want;
  }
  // from a start or a stop into the stride: a new pose, through the blend, and a foot in the air carries on from where it is
  function handOver(p) { loco = null; phase = p; gaitOn = true; trunk(0.18); for (const l of legs) if (l.down) l.keep = true; else l.fresh = true; }
  function stepLegs(dt, full) {
    const speed = seenAt(full), dir = speed > 0.05 ? [seen[0] / speed, 0, seen[2] / speed] : fwd, hold = 1 - smooth(MATCH, MATCH + 2, full);
    for (const l of legs) {
      const prev = l.ph, wantDown = loco ? onNow(loco.on[l.s], loco.t) : false, fwP = l.fw, nwP = l.nw; l.ph = (phase - (l.s === 'L' ? S.onL : 0) + 1) % 1;
      // the leg the clip wants, where he is: the foot's way ahead goes the way he's going, by the stride the ground asks for
      const c = l.c = clipLeg(l), ahead = c.A[2] * (loco ? 1 : S.k), fwW = l.cfw = toWorld(c.fw), nwW = l.cnw = toWorld(c.nw); l.toe = toeTo(l, c.toe, dt);
      l.cA = [body[0] + left[0] * c.A[0] + dir[0] * ahead, body[1] + c.A[1], body[2] + left[2] * c.A[0] + dir[2] * ahead];
      l.pole = toWorld([c.Kn[0] - (c.J[0] + c.A[0]) / 2, c.Kn[1] - (c.J[1] + c.A[1]) / 2, c.Kn[2] - (c.J[2] + c.A[2]) / 2 + 0.02]);
      if (l.solo > 0) {                                // a settling step: its own short clock, nothing to do with the stride
        l.solo = Math.max(0, l.solo - dt); const s = 1 - l.solo / l.soloT, E = aim(l), nE = [0, 1, 0]; groundN(E[0], E[2], nE);
        const e = along(s), lift_ = 0.07 * Math.sin(Math.PI * s), Ee = [E[0], E[1] + FT.h, E[2]];
        l.A = [l.S[0] + (Ee[0] - l.S[0]) * e, l.S[1] + (Ee[1] - l.S[1]) * e + lift_, l.S[2] + (Ee[2] - l.S[2]) * e];
        const [fw, nw] = pitched(onSlope(l.f, nE), nE, l.pitch0 * (1 - e)); l.fw = fw; l.nw = nw;
        if (l.solo === 0) plantAt(l, E, 0, fwW);
        continue;
      }
      const seated = l.fresh;      // a new clock isn't a foot coming round to the ground
      if (l.fresh) { l.fresh = false; if (!l.down) { l.pL = l.ph; l.D0 = K.sub(l.A, [l.cA[0], l.cA[1] + (l.gy || 0), l.cA[2]]); l.fw0 = l.fw; l.nw0 = l.nw; } }
      if (l.down) {
        {
          // on the ground the foot does what the clip's foot does, heel to ball, turning about whichever is down; it just stays where it is. As he slows the clip moves on faster than a foot can roll
          const most = lerp(7, 16, smooth(1.5, 7, speed)) * dt;
          l.rock += clamp(c.rock - l.rock, -most, most);
          // and over the end of the stance it's given back to the clip, no faster than a foot on the ground can go unseen, so the leg doesn't have to catch up with the capture in the air
          const A = ankleOn(l), share = gaitOn && !loco && !l.keep ? smooth(0.6, 1, l.ph / Math.max(S.bt, 0.01)) : 0, room = 0.019 * dt * 60, gnd = h.groundAt(A[0], A[2]) - body[1];
          l.rel = l.rel || [0, 0, 0];
          { const d = [0, 1, 2].map((k) => share * (l.cA[k] + (k === 1 ? gnd : 0) - A[k]) - l.rel[k]), m = Math.hypot(d[0], d[1], d[2]), g = m > room ? room / m : 1; for (let k = 0; k < 3; k++) { l.rel[k] += d[k] * g; A[k] += l.rel[k]; } }
          if (l.err) { const e = Math.exp(-dt * 40); l.err = K.scale(l.err, e); if (K.len(l.err) < 1e-3) l.err = null; else { A[0] += l.err[0]; A[1] += l.err[1]; A[2] += l.err[2]; } }
          l.A = A;
          // and it comes up when the leg has run out of reach, as a real foot does: held on past that he'd need a longer leg, the foot would drag and the knee would snap when it let go
          const spent = (l.reach || 0) > REACH_OFF && (loco ? l.rock < -0.35 : gaitOn && gaitWant && l.ph > S.bt * 0.6) && (speed > 3.2 || legs.every((o) => o === l || o.down));      // and a walk keeps a foot on the ground
          if (loco ? !wantDown || spent : (gaitOn && gaitWant && l.ph >= S.bt) || spent) { if (loco && wantDown) l.early = true; lift(l); } else continue;
        }
      }
      if (l.early && !(loco && wantDown)) l.early = false;
      const wrapped = loco ? wantDown && !l.early : !seated && l.ph < prev && prev > 0.5;
      if (wrapped || !gaitOn) {
        // it's down: this is the place on the ground that puts the foot where it came to, and what's left over goes in a moment
        const a = l.rock = clamp(c.rock, -0.35, 0.6), flat = [fwW[0], 0, fwW[2]], f = K.len(flat) > 0.4 && K.dot(flat, fwd) > 0 ? K.unit(flat) : fwd, up = l.nw, A = [l.cA[0], l.cA[1] + l.gy, l.cA[2]], off = a >= 0 ? K.add(K.scale(f, FT.heel), K.scale(l.fw, -FT.heel)) : K.add(K.scale(f, -FT.ball), K.scale(l.fw, FT.ball)), Gx = A[0] + off[0] - up[0] * FT.h, Gz = A[2] + off[2] - up[2] * FT.h;
        plantAt(l, [Gx, h.groundAt(Gx, Gz), Gz], a, f); l.rock = clamp(Math.atan2(K.dot(fwP, l.n), K.dot(fwP, l.f)), a - 0.3, a + 0.3);       // it comes down at the angle it has: the roll takes it to the clip's from there
        const on = ankleOn(l); l.err = K.len(K.sub(A, on)) < 0.2 ? K.sub(A, on) : null; if (l.err) { const m = K.len(l.err); if (m > 0.022) l.err = K.scale(l.err, 0.022 / m); } l.rel = null;       // the sole never carries on sunk in the ground or over it: the impact takes that up
        l.A = K.add(on, l.err || [0, 0, 0]); continue;
      }
      // in the air it's the capture's foot. What it left the ground with dies away early in the swing, and it stays that high over whatever ground is under it
      const s = loco && l.t1 !== undefined ? clamp((loco.t - l.t0) / Math.max(l.t1 - l.t0, 0.02), 0, 1) : clamp((l.ph - l.pL) / Math.max(1 - l.pL, 1e-3), 0, 1), fade = 1 - smooth(0, 0.7, s), x = l.cA[0] + l.D0[0] * fade, z = l.cA[2] + l.D0[2] * fade, g = h.groundAt(x, z); l.sw = s;
      { const most = 5 * dt, under = g - body[1]; l.gy += clamp(under - l.gy, -most, most); }
      let y = l.cA[1] + l.D0[1] * fade + l.gy;
      { const need = Math.max(0, g + 0.075 - y); l.clear = Math.min(chase(P.clear, l.fclear || (l.fclear = follower(0)), need, dt), need + (1 - s) * 0.6); } y += l.clear;       // never through a rise in the ground on the way, and lifted over it on a spring, not in a frame
      l.A = [x, y, z]; const k2 = smooth(0, 1, fade);
      l.fw = K.unit([fwW[0] + (l.fw0[0] - fwW[0]) * k2, fwW[1] + (l.fw0[1] - fwW[1]) * k2, fwW[2] + (l.fw0[2] - fwW[2]) * k2]); l.nw = K.unit([nwW[0] + (l.nw0[0] - nwW[0]) * k2, nwW[1] + (l.nw0[1] - nwW[1]) * k2, nwW[2] + (l.nw0[2] - nwW[2]) * k2]);
      // on a hill the ankle sets the foot to the ground it's about to land on, over the second half of the swing: it doesn't fly level and snap to the slope on contact
      if (F.slope.y > 0.2 && s > 0.35) { const n = groundN(x, z, [0, 1, 0]), k3 = smooth(0.35, 0.95, s), q = K.arc([0, 1, 0], K.unit([n[0] * k3, 1 + (n[1] - 1) * k3, n[2] * k3])); l.fw = K.qrot(q, l.fw); l.nw = K.qrot(q, l.nw); }
      { const T = K.turn(K.frame(fwP, nwP), K.frame(l.fw, l.nw)), sg = T[3] < 0 ? -1 : 1, ang = 2 * Math.acos(Math.min(1, T[3] * sg)), most = FOOT_RATE * dt; if (ang > most) { const q = K.qaxis([T[0] * sg, T[1] * sg, T[2] * sg], most); l.fw = K.qrot(q, fwP); l.nw = K.qrot(q, nwP); } }
    }
    // past what a stride can follow nothing holds them: the legs are the clip's, and the wake and the ghosts show the rest
    if (hold < 1) { const k = 1 - hold, mixed = (a, b) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; for (const l of legs) { l.A = mixed(l.A, l.cA); l.fw = K.unit(mixed(l.fw, l.cfw)); l.nw = K.unit(mixed(l.nw, l.cnw)); } }
    // standing still with the feet apart: the stride's last foot comes up to the other, a settling step
    if (!gaitOn && !legs.some((l) => l.solo > 0)) {
      let worst = null, far = 0.17;
      for (const l of legs) { const E = aim(l), d = Math.hypot(E[0] - l.G[0], E[2] - l.G[2]); if (d > far) { far = d; worst = l; } }
      if (worst) { worst.down = false; worst.S = worst.A.slice(); worst.pitch0 = worst.rock; worst.soloT = worst.solo = 0.26; }
    }
  }

  const tq = new THREE.Quaternion(), tv = new THREE.Vector3(), hipJ = [[0, 0, 0], [0, 0, 0]];
  const arr = (q) => [q.x, q.y, q.z, q.w];
  const setLocal = (i, parentW, worldQ) => { const r = K.qmul(K.qconj(parentW), worldQ), o = i * 4; pose[o] = r[0]; pose[o + 1] = r[1]; pose[o + 2] = r[2]; pose[o + 3] = r[3]; };
  function solveLegs(hipsW, dt) {
    const out = [];
    legs.forEach((l, k) => {
      const s = l.s, S0 = hipJ[k];
      // a hard landing: the feet stay up under him, knees bent, until the ground comes to them. A near-straight leg is the one that spins fastest
      if (fall.mode === 1) { const most = lerp(1, 0.76, smooth(3, 9, fall.hit || 0)) * l.L, dx = S0[0] - l.A[0], dz = S0[2] - l.A[2], r2 = most * most - dx * dx - dz * dz; l.hover = r2 > 0 ? Math.max(0, S0[1] - Math.sqrt(r2) - l.A[1]) : 0; }
      else l.hover = Math.max(0, (l.hover || 0) - HOVER_OUT * (1 / 60));
      if (l.hover > 0) l.A = [l.A[0], l.A[1] + l.hover, l.A[2]];
      // the capture's leg, turned only as far as reaching this place takes: left alone it's the capture to the degree, twist and all
      // the last of a leg's reach is soft: a knee coming out of straight turns fastest of all, so nothing asks for the very end of it
      { const v = K.sub(l.A, S0), d = K.len(v), far = 0.998 * l.L, soft = 0.965 * l.L; l.reach = d / l.L; if (d > soft) { const e = far - (far - soft) * Math.exp(-(d - soft) / (far - soft)); l.A = K.add(S0, K.scale(v, e / d)); } }
      { const a = l.R.l1, b = l.R.l2, v = K.sub(l.A, S0), d = K.len(v), k = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1)), most = KNEE_RATE * dt, was = l.kn ?? k, to = l.down ? k : clamp(k, was - most, was + most);
        if (to !== k) { const e = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(to)); l.A = K.add(S0, K.scale(v, e / d)); } l.kn = to; }      // a foot in the air gives along the line from the hip; one on the ground stays where it is
      const sol = K.solve(l.R, S0, l.A, l.pole, 0.998), c = l.c, qy = [0, Math.sin(yawNow / 2), 0, Math.cos(yawNow / 2)];
      const wT = K.qmul(K.arc(K.unit(K.qrot(qy, K.sub(c.Kn, c.J))), K.unit(K.sub(sol.J, S0))), K.qmul(qy, c.W1)), wS = K.qmul(K.arc(K.unit(K.qrot(qy, K.sub(c.A, c.Kn))), K.unit(K.sub(sol.E, sol.J))), K.qmul(qy, c.W2));
      const qf = K.turn(l.F0, K.frame(l.fw, l.nw)), wF = K.qmul(qf, REST.q['foot_' + s]);
      const axis = K.unit(K.cross(l.nw, l.fw)), wTo = K.qmul(K.qmul(K.qaxis(axis, l.toe), qf), REST.q['toe_' + s]);
      setLocal(index['leg_' + s], hipsW, wT); setLocal(index['shin_' + s], wT, wS); setLocal(index['foot_' + s], wS, wF); setLocal(index['toe_' + s], wF, wTo);
      out.push(sol);
    });
    return out;
  }

  // ---------------------------------------------------------------- followers
  const P = {
    stride: second({ f: 4, z: 1 }), slope: second({ f: 2, z: 1 }), clear: second({ f: 5, z: 1 }), yaw: second({ f: 3.2, z: 1, r: 1, cap: 120 }), ground: second({ f: 4.5, z: 1, r: 2, cap: 90 }), drop: second({ f: 7, z: 1, r: 2 }),
    pace: second({ f: 1.5, z: 1 }), leanF: second({ f: 2.2, z: 0.75, r: 0.4 }), leanS: second({ f: 2.0, z: 0.8, r: 0.4 }), look: second({ f: 1.6, z: 1 }),
  };
  const F = { stride: follower(0), slope: follower(0), yaw: follower(0), ground: follower(0), drop: follower(0), rise: follower(0), pace: follower(0), leanF: follower(0), leanS: follower(0), look: follower(0) };
  const gripRel = new THREE.Vector3(), tv2 = new THREE.Vector3(); let stroke = 'tread', gaitWant = false, yawNow = 0, surfT = 0, gripShare = 0, rideT = 0, facing = 0, ready = false, lastSpeed = 0, lastYaw = 0, swimPh = 0, treadT = 0, standT = 0, airT = 0, mode = 'water', legClip = true;

  // ---------------------------------------------------------------- mantle and hair: free swing, wind from his own motion
  const chain = [];
  for (const [base, n, amp] of [['cape_', 5, 0.06], ['hair_', 3, 0.08]]) for (let i = 1; i <= n; i++) { const b = bones[base + i]; if (b) chain.push({ b, cape: base === 'cape_', q0: b.quaternion.clone(), i, n, amp, ax: 0, az: 0 }); }
  const qx = new THREE.Quaternion(), ez = new THREE.Euler(), P_cape = { x: second({ f: 1.5, z: 0.75 }), z: second({ f: 1.4, z: 0.7 }) };
  chain.forEach((c) => { c.fx = follower(0); c.fz = follower(0); });
  const restChest = K.qconj(REST.q.spine_3 || [0, 0, 0, 1]);
  // Cloth hangs along what pulls on it: down, in the air (nothing in the water), and away from his motion, by how fast the air or the sea goes past. That line, read in his chest's frame, is how far it
  // lifts off his back: thrown forward at a sprint he's already most of the way there, flat out in the water it lies along him, and it can't stand up over his head at any lean
  function swing(dt, speed, onLand) {
    const t = G.time, sp = clamp(speed / 12, 0, 1), inAir = onLand || h.air, pull = smooth(0.8, 12, speed) * 1.6, n = Math.max(h.vel.length(), 0.01);
    bones.spine_3.updateWorldMatrix(true, false); bones.spine_3.getWorldQuaternion(tq);
    const q = K.qmul(arr(tq), restChest), U = K.qrot(q, [0, 1, 0]), Fw = K.qrot(q, [0, 0, 1]);
    const dx = (-h.vel.x / n) * pull, dy = (-h.vel.y / n) * pull - (inAir ? 1 : 0), dz = (-h.vel.z / n) * pull;
    const du = dx * U[0] + dy * U[1] + dz * U[2], df = dx * Fw[0] + dy * Fw[1] + dz * Fw[2];
    const water = !onLand && !h.air, adrift = water ? 1 - smooth(0.6, 3.5, speed) : 0;
    // swimming the mantle lies along his back: streaming straight out behind him it's edge-on to the lens, and gone
    const lift0 = Math.abs(du) + Math.abs(df) > 1e-3 ? clamp(Math.atan2(-df, -du), -0.1, water ? CLOTH_SWIM : 1.3) : 0, lift_ = water ? lift0 + (CLOTH_HUG - lift0) * smooth(2.5, 7, speed) : lift0, turn = clamp(F.leanS.y * 2.0, -1, 1);
    for (const c of chain) {
      const wave = Math.sin(t * (1.1 + sp * 4.2) - c.i * 0.8) * (0.25 + sp * 0.5), share = c.cape ? (c.i === 1 ? 0.46 : 0.135) : (c.i === 1 ? 0.6 : 0.2);
      // at rest in the water cloth and hair don't hang, they lift and wander
      const rise = adrift * (c.cape ? (c.i === 1 ? 0.3 : 0.06) + 0.1 * Math.sin(t * 0.7 - c.i * 0.9) : (c.i === 1 ? 0.34 : 0.14) + 0.08 * Math.sin(t * 0.9 - c.i));
      const goalX = lift_ * share + c.amp * wave * (onLand ? 0.5 : 1 + adrift * 3) + rise, goalZ = c.amp * 0.5 * Math.sin(t * 0.9 - c.i) * (onLand ? 0.4 : 1) + turn * 0.09 + adrift * 0.05 * Math.sin(t * 0.53 - c.i * 0.6);
      c.ax = chase(P_cape.x, c.fx, goalX, dt); c.az = chase(P_cape.z, c.fz, goalZ, dt);
      ez.set(c.ax, 0, c.az); qx.setFromEuler(ez); c.b.quaternion.copy(c.q0).multiply(qx);
    }
  }

  // ---------------------------------------------------------------- a fall and its landing, as one curve on the drawn body. The rules' height is left alone: he lands when they say
  const fall = { mode: 0, y: 0, v: 0, a: 0, D: 0, was: 0, last: 0, air: false };
  function brake(y, v, ground) { fall.mode = 1; fall.y = y; fall.v = v; fall.D = depthFor(fall.hit || v); fall.a = (v * v) / (2 * Math.max(y - ground + fall.D, 0.02)); }
  function fallen(dt, onGround, free, base) {
    const ground = onGround ? h.pos.y - STAND : h.groundAt(h.drawPos.x, h.drawPos.z);
    if (onGround && fall.air) F.ground = follower(ground);          // he's down: the ground under him is where it is, whatever the drawn body is doing
    fall.air = h.air;
    let out = onGround ? F.ground.y : base;
    if (fall.mode === 0) {
      if (h.air && h.vel.y < -1 && ground > h.standLine) {
        // from here it can still stop at the depth this fall earns, at BRAKE: it starts now
        const v = -h.vel.y, H = Math.max(free - ground, 0); fall.hit = Math.sqrt(v * v + 2 * h.gravity * H);
        if ((v * v) / (2 * Math.max(H + depthFor(fall.hit), 0.02)) >= BRAKE) brake(fall.last, v, ground);
      }
      if (onGround && fall.was > 1.5) { fall.hit = fall.was; brake(fall.last, fall.was, ground); }
      fall.was = h.air ? Math.max(-h.vel.y, 0) : 0;
    }
    if (fall.mode === 1) {
      fall.was = 0;
      if (h.air && h.vel.y > 0) { fall.mode = 2; F.rise = follower(fall.y - base); P.rise = second({ f: 2.4, z: 1 }); }      // a second jump, just before he touched
      else {
        fall.v = Math.max(0, fall.v - fall.a * dt); fall.y -= fall.v * dt;
        if (fall.v <= 0 || fall.y <= ground - fall.D) { fall.y = Math.max(fall.y, ground - fall.D); fall.mode = 2; F.rise = follower(fall.y - ground); P.rise = second({ f: lerp(2.2, 1.3, smooth(0.08, 0.5, fall.D)), z: 1 }); }
        else { fall.last = fall.y; return fall.y; }
      }
    }
    if (fall.mode === 2) { const off = chase(P.rise, F.rise, 0, dt); if (Math.abs(off) < 0.002) fall.mode = 0; out += off; }
    fall.last = out; return out;
  }
  // ---------------------------------------------------------------- the trident on his back. One leaf bone: each frame its local pose is set so that in the world it sits at a place fixed to the chest, and it blends from the fist to there and back
  const sheath = { k: 1, p0: new THREE.Vector3(), slotP: new THREE.Vector3(), slotQ: new THREE.Quaternion() }; let guardT = 0;
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), hq = new THREE.Quaternion(), sq = new THREE.Quaternion(), hm = new THREE.Matrix4();
  if (bones.weapon && REST.p.weapon_tip) {
    sheath.p0.copy(bones.weapon.position);
    const s0 = K.unit(K.sub(REST.p.weapon_tip, REST.p.weapon)), f0 = K.unit(K.cross(s0, [0, 1, 0])), d = K.unit(SLOT_WAY), e = K.unit(K.cross(d, [0, 0, 1]));
    const W = K.qmul(K.turn(K.frame(s0, f0), K.frame(d, e)), REST.q.weapon), Rc = REST.q.spine_3, l = K.qmul(K.qconj(Rc), W), P = K.add(REST.p.spine_3, SLOT_AT), lp = K.qrot(K.qconj(Rc), K.sub(P, REST.p.spine_3));
    sheath.slotQ.set(l[0], l[1], l[2], l[3]); sheath.slotP.set(lp[0], lp[1], lp[2]);
  }
  function wear(dc) {
    const b = bones.weapon; if (!b || !REST.p.weapon_tip) return;
    sheath.k = h.armed ? Math.max(0, sheath.k - dc / DRAW_T) : Math.min(1, sheath.k + dc / SHEATHE_T);
    if (sheath.k <= 0.001) { b.position.copy(sheath.p0); return; }
    const hand = bones.hand_R, sp = bones.spine_3; hand.updateWorldMatrix(true, false); sp.updateWorldMatrix(true, false);
    hand.getWorldQuaternion(hq); sp.getWorldQuaternion(sq); const k = smooth(0, 1, sheath.k);
    wq.copy(hq).multiply(b.quaternion); tvW.copy(sq).multiply(sheath.slotQ); wq.slerp(tvW, k);
    wp.copy(sheath.p0).applyMatrix4(hand.matrixWorld); tvP.copy(sheath.slotP).applyMatrix4(sp.matrixWorld); wp.lerp(tvP, k);
    b.position.copy(wp.applyMatrix4(hm.copy(hand.matrixWorld).invert())); b.quaternion.copy(hq.invert().multiply(wq));
  }
  const tvW = new THREE.Quaternion(), tvP = new THREE.Vector3();
  // ---------------------------------------------------------------- a leap's body: one curve from the nose to the toes, the shape of the path he's on. Going up he's long and a little arched back, over the top he folds round it, and he goes in long again, with a slow wave running down him all the way
  const sideAxis = {}, LEG0 = 0.34, SHIN0 = -0.42;       // the legs long: what takes the swim-dodge pose's bent hips and knees out
  function bend(n, a) { const i = index[n]; if (i === undefined || !a) return; const ax = sideAxis[n] || (sideAxis[n] = K.qrot(K.qconj(REST.q[n]), [1, 0, 0])), q = K.qaxis(ax, a), o = i * 4, r = K.qmul([pose[o], pose[o + 1], pose[o + 2], pose[o + 3]], q); pose[o] = r[0]; pose[o + 1] = r[1]; pose[o + 2] = r[2]; pose[o + 3] = r[3]; }
  function arc() {
    const u = h.breach.u, c = Math.sin(Math.PI * (u * 1.2 - 0.1)), top = Math.sin(Math.PI * u), w = 6.283 * 1.15 * airT, wave = (lag, amp) => Math.sin(w - lag) * amp * (0.45 + 0.55 * top);
    bend('spine_1', 0.14 * c + wave(0.6, 0.04)); bend('spine_2', 0.18 * c + wave(0.3, 0.04)); bend('spine_3', 0.16 * c + wave(0, 0.03)); bend('neck', 0.08 * c); bend('head', 0.14 * c);
    for (const [s, off] of [['R', 0], ['L', 0.35]]) {
      bend('leg_' + s, LEG0 - 0.16 * c + wave(1.0 + off, 0.1)); bend('shin_' + s, SHIN0 + 0.06 * top + Math.max(0, wave(1.9 + off, 0.2))); bend('foot_' + s, 0.75 + wave(2.8 + off, 0.16));
      bend('arm_' + s, (s === 'L' ? -0.85 : -0.55) * top * top); bend('fore_' + s, (s === 'L' ? 0.7 : 0.4) * top * top);
    }
  }
  // going from upright to long, or back: the chest goes first and folds, the legs come after it, bent, and straighten as he arrives. He doesn't swing over like a plank
  function leadIn(g) { const a = Math.abs(g); bend('spine_1', 0.14 * g); bend('spine_2', 0.17 * g); bend('spine_3', 0.13 * g); bend('head', -0.22 * Math.max(g, 0)); for (const s of ['R', 'L']) { bend('leg_' + s, (s === 'R' ? -0.42 : -0.3) * a); bend('shin_' + s, (s === 'R' ? 0.42 : 0.6) * a); } }
  // ---------------------------------------------------------------- one frame
  function draw(dt) {
    const onGround = h.land && !h.air, speed = onGround ? Math.hypot(h.vel.x, h.vel.z) : h.speed, scale = G.hitstop > 0 ? 0.08 : 1, dc = dt * scale;
    if (!ready) { F.yaw = follower(h.heading); F.ground = follower(h.drawPos.y - STAND); ready = true; lastYaw = h.heading; facing = h.heading; }
    // the drawn heading follows the rules' heading: nothing that sets a facing can snap the body
    const wanted = chase(P.yaw, F.yaw, nearAngle(F.yaw.y, h.drawHeading === undefined ? h.heading : h.drawHeading), dt), turnBy = nearAngle(0, wanted - facing), most_ = FACE_RATE * dt; facing += clamp(turnBy, -most_, most_); const yaw = facing;
    root.position.copy(h.drawPos);
    const free = h.drawPos.y - STAND * Math.cos(h.tilt);
    if (onGround) root.position.y = chase(P.ground, F.ground, h.drawPos.y - STAND, dt);
    else { root.position.y = free; F.ground = follower(root.position.y); }
    root.position.y = fallen(dt, onGround, free, root.position.y);
    // floating: nothing holds him, so he's never quite where he was. A slow rise and fall, a slow wander, and the whole body turning a little on the water
    const adrift = !onGround && !h.air && h.state !== 'surf' && !h.ride ? 1 - smooth(0.6, 2.8, speed) : 0, t0 = G.time;
    if (adrift > 0) { root.position.y += adrift * (0.07 * Math.sin(t0 * 0.83) + 0.03 * Math.sin(t0 * 1.71 + 1)); root.position.x += adrift * 0.06 * Math.sin(t0 * 0.47); root.position.z += adrift * 0.06 * Math.sin(t0 * 0.37 + 2); }
    // riding: his hands stay on the fin and the body hangs from them. A mount eases over 0.4 s, and everything else about him is the ride's clip
    gripShare = h.ride ? Math.min(1, gripShare + dt / 0.4) : 0;
    if (h.ride && gripShare > 0) { h.finAt(h.ride, tv); if (h.ride.dir) tv.addScaledVector(h.ride.dir, (h.ride.speed || 0) * dt); tv.sub(gripRel); root.position.lerp(tv, smooth(0, 1, gripShare)); }      // the whale moves after this in the frame: the hands go where the fin will be
    h.drawYaw = yaw; yawNow = yaw;
    const sY = Math.sin(yaw), cY = Math.cos(yaw); fwd[0] = sY; fwd[2] = cY; left[0] = cY; left[2] = -sY;
    body[0] = h.drawPos.x; body[1] = root.position.y; body[2] = h.drawPos.z; vel[0] = h.vel.x; vel[2] = h.vel.z;

    // ---- which pose is the base
    const m = onGround ? 'land' : h.air ? 'air' : h.state === 'surf' ? 'surf' : 'water';
    if (m !== mode) { inertia(m === 'land' ? 0.16 : 0.24); mode = m; loco = null; }
    if (shot && shot.auto && shot.t >= shot.dur) clear(0.18);
    if (m === 'land') {
      // the legs and the walk or run are always worked out, under anything a blow does above them
      advance(dt, speed);
      standT = (standT + dc) % (CL.stand ? CL.stand.dur : 3);
      const pace = chase(P.pace, F.pace, Math.min(speed, 12), dt), st = 1 - smooth(0.1, 0.8, pace), go = 1 - st;
      if (sheath.k < 0.995 && CL.idle_combat) { guardT = (guardT + dc) % CL.idle_combat.dur; sample('stand', standT, st * (0.5 + 0.5 * sheath.k)); sample('idle_combat', guardT, st * 0.5 * (1 - sheath.k)); } else sample('stand', standT, st);
      if (loco) { accQ.fill(0); accW.fill(0); accP[0] = accP[1] = accP[2] = 0; accP.w = 0; sample(loco.name, Math.min(loco.t, loco.dur - 1e-3), 1); }
      else { const pR = warp(phase, S), pL = warp((phase - S.onL + 1) % 1, S); for (const [n, w] of [['walk', S.wa], ['run', S.ru], ['sprint', S.sp]]) if (CL[n]) sample(n, phase * CL[n].dur, go * w, pR * CL[n].dur, ((pL + GAITS[n].on_L) % 1) * CL[n].dur); }
      settle(); held.set(pose); heldP = poseP.slice();
    }
    if (shot) { shot.t += dc * (shot.rate ?? 1); sample(shot.name, shot.t, 1); }
    else if (m === 'land') { /* the pose above */ }
    else if (m === 'surf') {
      surfT = (surfT + dc * (0.75 + 0.75 * smooth(8, 26, h.surf ? h.surf.v : 0))) % (CL.surf_stand ? CL.surf_stand.dur : 2); const c = h.carve || 0, w = Math.abs(c), side = c > 0 ? 'surf_carve_R' : 'surf_carve_L';
      sample('surf_stand', surfT, 1 - w); if (w > 1e-3) sample(side, surfT * (CL[side] ? CL[side].dur / (CL.surf_stand ? CL.surf_stand.dur : 2) : 1), w);
    } else if (m === 'air' && h.breach && CL.dodge_water) { airT += dc; sample('dodge_water', 0.2, 1); }      // a leap: long, arms ahead of him; `arc` below bends it along the path
    else if (m === 'air') { airT += dc; sample(has('fall') ? 'fall' : 'idle_tread', airT % (has('fall') ? CL.fall.dur : 3), 1); }
    else if (h.ride && CL.ride_grip) { rideT = (rideT + dc) % CL.ride_grip.dur; sample('ride_grip', rideT, 1); }
    else {
      treadT = (treadT + dc) % (CL.idle_tread ? CL.idle_tread.dur : 3);
      // the tread, the crawl and the long kick are different ways of holding the arms, up to half a turn apart: nothing can be blended across that without the arm whipping round. Each change of stroke is a switch, and it goes through the inertial blend
      const sp2 = h.speed, hy = has('super') ? h.surge : 0, next = sp2 < (stroke === 'tread' ? 1.3 : 0.8) && hy < 0.02 ? 'tread' : sp2 < (stroke === 'boost' ? 10.5 : 12) && hy < 0.02 ? 'crawl' : 'boost';
      if (next !== stroke) { stroke = next; inertia(0.3); }
      const tr = stroke === 'tread' ? 1 - hy : 0, cr = stroke === 'crawl' ? 1 - hy : 0, bo = stroke === 'boost' ? 1 - hy : 0, d = CL.swim_fast ? CL.swim_fast.dur : 1;
      const rate = cr * (0.9 + sp2 / 8) / d + bo * Math.min(2.4, 0.8 + sp2 / 18) / (CL.boost ? CL.boost.dur : 0.6) + hy / (CL.super ? CL.super.dur : 0.33);
      const was = swimPh; swimPh = (swimPh + (rate + tr * 0.4) * dc) % 1; h.beatAgo = Math.floor(swimPh * STROKES) !== Math.floor(was * STROKES) ? 0 : (h.beatAgo ?? 0) + dc; h.beatEvery = 1 / (STROKES * Math.max(rate + tr * 0.4, 0.2));      // Tidepulse keeps time with each arm's stroke
      if (sheath.k < 0.995 && CL.idle_combat) { guardT = (guardT + dc) % CL.idle_combat.dur; sample('idle_tread', treadT, tr * (0.5 + 0.5 * sheath.k)); sample('idle_combat', guardT, tr * 0.5 * (1 - sheath.k)); } else sample('idle_tread', treadT, tr);
      for (const [n, w] of [['swim_fast', cr], ['boost', bo], ['super', hy]]) if (CL[n]) sample(n, swimPh * CL[n].dur, w);
    }
    if (shot || m !== 'land') settle();
    if (m === 'land' && !(shot && CLIP_LEGS.has(shot.name))) for (const i of groupB) { const o = i * 4; for (let k = 0; k < 4; k++) pose[o + k] = held[o + k]; }
    if (sheath.k > 0.002 && sheath.k < 0.998) { const r = Math.sin(Math.PI * sheath.k); bend('arm_R', -1.5 * r); bend('fore_R', -1.15 * r); }      // the hand goes back over the shoulder for it
    if (m === 'air' && h.breach) arc();
    else if (m === 'water' && !shot) { const g = clamp((h.tiltTo ?? h.tilt) - h.tilt, -1.4, 1.4); if (Math.abs(g) > 0.02) leadIn(g); }

    // ---- switches: the difference dies away on the quintic
    const wantClip = !onGround || !!(shot && CLIP_LEGS.has(shot.name)) || !!api.raw;
    if (wantClip !== legClip) { inertia(0.14); legClip = wantClip; if (!wantClip) landFeet(); }
    const fresh = pendingT > 0, T = pendingT; pendingT = 0;
    if (fresh) { capture(groupA, T); captureP(T); inertT = 0; inertA = 0; inertP = 0; }
    else if (pendingA > 0) { capture(groupA, pendingA); captureP(pendingA); inertA = 0; inertP = 0; }
    pendingA = 0; offsets(groupA, inertA); offsetsP(inertP);

    // ---- lean: the body goes into what the feet are doing, on followers, at the hips
    const accel = dt > 0 ? (speed - lastSpeed) / Math.max(dt, 1 / 240) : 0, turnRate = dt > 0 ? nearAngle(0, yaw - lastYaw) / Math.max(dt, 1 / 240) : 0; lastSpeed = speed; lastYaw = yaw;
    const gLean = onGround ? clamp(-accel * 0.016, -0.36, 0.3) : 0, gBank = onGround ? clamp(-turnRate * speed * 0.016, -0.42, 0.42) : 0;
    const lf = chase(P.leanF, F.leanF, gLean, dt), ls = chase(P.leanS, F.leanS, gBank, dt);
    if (Math.abs(lf) + Math.abs(ls) > 1e-4) {
      const qm = K.qmul(K.qaxis([1, 0, 0], -lf), K.qaxis([0, 0, 1], ls)), ql = K.qmul(K.qmul(Pmi, qm), Pm), i = index.hips, o = i * 4, r = K.qmul(ql, [pose[o], pose[o + 1], pose[o + 2], pose[o + 3]]);
      pose[o] = r[0]; pose[o + 1] = r[1]; pose[o + 2] = r[2]; pose[o + 3] = r[3];
    }

    // ---- write the trunk, then stand it on its feet
    const hb = bones.hips, hi = index.hips * 4;
    qY.setFromAxisAngle(AY, yaw + adrift * 0.12 * Math.sin(t0 * 0.23)); qX.setFromAxisAngle(AX, h.tilt - h.bodyPitch * (h.tilt > 0.5 ? 1 : 0.4) + adrift * (0.2 + 0.05 * Math.sin(t0 * 0.31 + 1))); qB.setFromAxisAngle(AY, h.bank + (h.roll || 0) + adrift * 0.06 * Math.sin(t0 * 0.43));
    root.quaternion.copy(qY).multiply(qX).multiply(qB);
    // the ride's lean and rake (hero.js): the root stands at his feet, so he tips from there and they stay on the water
    if (h.surfLean || h.surfRake) { qL.setFromAxisAngle(AZ, h.surfLean || 0); qR.setFromAxisAngle(AX, h.surfRake || 0); root.quaternion.multiply(qL).multiply(qR); }
    if (!wantClip) {
      stepLegs(dt, speed);
      hb.position.set(poseP[0], poseP[1], poseP[2]); hb.quaternion.set(pose[hi], pose[hi + 1], pose[hi + 2], pose[hi + 3]); hb.updateWorldMatrix(true, false);
      legs.forEach((l, k) => { tv.copy(bones['leg_' + l.s].position).applyMatrix4(hb.matrixWorld); hipJ[k] = tv.toArray(); });
      // the hips drop to reach: no leg past 0.98 of straight
      let need = 0, soon = 0;
      // only a foot on the ground can pull him down; a foot in the air just reaches as far as it can
      if (fall.mode !== 1) legs.forEach((l, k) => {
        const J = hipJ[k], d = Math.hypot(J[0] - l.A[0], J[2] - l.A[2]), R = 0.995 * l.L, room = R * R - d * d;
        // on a hill the hips start down before the foot that's coming lands, instead of dropping when it does
        if (!l.down) { if (gaitOn && room > 0) soon = Math.max(soon, (J[1] - (h.groundAt(l.A[0], l.A[2]) + FT.h + Math.sqrt(room))) * smooth(0.25, 0.9, l.sw || 0) * smooth(0.1, 0.3, F.slope.y)); return; }
        if (room > 0) need = Math.max(need, (J[1] - (l.A[1] + Math.sqrt(room))) * smooth(-0.5, -0.12, l.rock));       // a foot pushing off lets go of him by degrees: it doesn't pull him down after it, and he doesn't spring up off it in a frame
        if (room <= 0 || J[1] - (l.A[1] + Math.sqrt(Math.max(room, 0))) > MAX_DROP) { if (gaitOn) lift(l); }      // run out of leg: it comes up, he doesn't go down after it
      });
      need = Math.min(need, MAX_DROP);
      const dropNow = Math.max(chase(P.drop, F.drop, Math.max(0, need, Math.min(soon, MAX_DROP)), dt), need - 0.004);
      h.dropNow = dropNow;
      if (dropNow > 0) { const dl = K.qrot(Pmi, [0, -dropNow, 0]); poseP[0] += dl[0]; poseP[1] += dl[1]; poseP[2] += dl[2]; hipJ[0] = [hipJ[0][0], hipJ[0][1] - dropNow, hipJ[0][2]]; hipJ[1] = [hipJ[1][0], hipJ[1][1] - dropNow, hipJ[1][2]]; hb.position.set(poseP[0], poseP[1], poseP[2]); hb.updateWorldMatrix(true, false); }
      hb.getWorldQuaternion(tq); h.legFit = solveLegs(arr(tq), dt);
    } else { h.dropNow = 0; F.drop = follower(0); seen[0] = vel[0]; seen[2] = vel[2]; }
    if (fresh) capture(groupB, T);
    offsets(groupB, inertT);
    inertT += dc; inertA += dc; inertP += dc;

    // ---- the bones
    for (const i of ACT) { const o = i * 4, b = bones[names[i]]; b.quaternion.set(pose[o], pose[o + 1], pose[o + 2], pose[o + 3]); for (let k = 0; k < 4; k++) { last2[o + k] = last[o + k]; last[o + k] = pose[o + k]; } }
    hb.position.set(poseP[0], poseP[1], poseP[2]); last2P = lastP; lastP = poseP.slice();
    wear(dc);
    prevDt = dt;
    swing(dt, speed, onGround);
    if (h.ride) { root.updateWorldMatrix(true, false); bones.hand_R.updateWorldMatrix(true, false); bones.hand_L.updateWorldMatrix(true, false); tv.setFromMatrixPosition(bones.hand_R.matrixWorld); tv2.setFromMatrixPosition(bones.hand_L.matrixWorld); h.handsR = tv.clone(); h.handsL = tv2.clone(); gripRel.copy(tv).add(tv2).multiplyScalar(0.5).sub(root.position); }
  }
  const qY = new THREE.Quaternion(), qX = new THREE.Quaternion(), qB = new THREE.Quaternion(), qL = new THREE.Quaternion(), qR = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);

  // the feet come down from the air: each lands where it is, on the ground under it
  function landFeet() {
    for (const l of legs) {
      const b = bones['foot_' + l.s]; b.updateWorldMatrix(true, false); tv.setFromMatrixPosition(b.matrixWorld);
      const x = tv.x, z = tv.z, G0 = [x, h.groundAt(x, z), z]; plantAt(l, G0, 0); l.A = ankleOn(l);
    }
    gaitOn = false;
  }
  function place() {            // a teleport: the feet go with him, nothing is drawn between
    root.position.copy(h.drawPos); root.position.y -= STAND;
    const sY = Math.sin(h.heading), cY = Math.cos(h.heading); fwd[0] = sY; fwd[2] = cY; left[0] = cY; left[2] = -sY; body[0] = h.drawPos.x; body[2] = h.drawPos.z; vel[0] = vel[2] = 0; seen[0] = seen[2] = 0; fall.mode = 0; fall.was = 0;
    F.yaw = follower(h.heading); F.ground = follower(h.drawPos.y - STAND); F.stride = follower(0); lastYaw = h.heading; facing = h.heading; lastSpeed = 0; gaitOn = false;
    for (const l of legs) { const E = aim(l); plantAt(l, E, 0); l.A = ankleOn(l); l.cA = l.A; l.solo = 0; l.hover = 0; l.err = null; }
    for (const i of ACT) offs[i] = null; offP = null; inertT = inertA = inertP = 9; pendingT = pendingA = 0; loco = null;       // what the last pose was doing doesn't follow him
    legClip = !(h.land && !h.air); mode = h.land && !h.air ? 'land' : h.air ? 'air' : h.state === 'surf' ? 'surf' : 'water';
    ready = true;
  }
  // where the feet stand at ease is where the `stand` clip has them
  if (CL.stand) { sample('stand', 0, 1); settle(); held.set(pose); heldP = poseP.slice(); for (const l of legs) { const c = clipLeg(l); IDLE[l.s] = { f: c.A[2], l: c.A[0] }; } }
  const api = { draw, play, clear, inertia, has, place, raw: false, get shot() { return shot; }, legs, S, FT, get phase() { return phase; }, get gaitOn() { return gaitOn; }, get loco() { return loco ? loco.name : null; }, get fall() { return fall; }, get sheathK() { return sheath.k; }, get mode() { return mode; }, get inertActive() { return inertT < 0.3; } };
  return api;
}
