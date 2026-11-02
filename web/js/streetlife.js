// Saltlight lived in. Randy, 2 Nov: "The city looks bland and not lived in. Come on man, go find the requirements and standards of an open world city and lights and
// pedestrians and cars and shit and complaints users have with these to make it look good". What shipped cities, their developers and their players taught, each read
// at source (Pipeline/research/CITY_LIFE_SOURCES.md):
//  - nobody is made or taken away in view: the whole population lives all the time on its pavements and in its lanes. Who is out changes with the hour, and only for
//    someone out of sight for two seconds; the far edge of what's drawn dissolves by a dither, never a pop
//  - a weaker device draws fewer details, never fewer people
//  - every walker is doing something: walking at a measured gait, waiting at the kerb for the signal, on a phone, talking; and they run from a fight
//  - no two alike in one view: one body of parts, each part coloured from its own palette, at a spread of heights and builds
//  - cars keep to lanes, stop at the signals and behind whatever is in front of them (the Intelligent Driver Model), give way to walkers when they turn, brake for him
//  - many small cheap lights at night: street lamps and their pools, headlights and tail lights, the signals
import * as THREE from 'three';
import { METRO, GRID } from './metro.js';

const { PITCH, BLOCK } = GRID, HB = BLOCK / 2, BOX = (PITCH - BLOCK) / 2, LANE = 1.75, GZ = METRO.Z + 0.03, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// the Intelligent Driver Model (Treiber, Hennecke and Helbing, Phys. Rev. E 62, 1805, 2000): Table 1's T 1.6 s, s0 2 m, b 1.67 m/s2, delta 4; for a city Treiber's own notes
// change only v0 (50 km/h here) and give 0.8-2.5 m/s2 as a realistic a (1.0 here); a step under 0.5 s changes nothing, so the cars think at 10 Hz and are drawn in between
const IDM = { v0: 13.9, T: 1.6, a: 1.0, b: 1.67, s0: 2.0 };
// the signals, inside the ranges of the US Signal Timing Manual (FHWA): a 60 s cycle, 24 s of green, 4 s of amber (3-6) and 2 s all-red (0.5-2) each way, north-south first.
// A walker starts across only in the first 14 s of the green that runs beside them
const CYC = 60, NS_G = 24, NS_Y = 28, NS_R = 30, EW_G = 54, EW_Y = 58, WALK = 14;
const phaseAt = (t, off) => (((t + off) % CYC) + CYC) % CYC;
// 0 green, 1 amber, 2 red, for traffic on the north-south (0) or east-west (1) axis
function signal(t, off, axis) { const p = phaseAt(t, off); if (axis === 0) return p < NS_G ? 0 : p < NS_Y ? 1 : 2; return p >= NS_R && p < EW_G ? 0 : p >= EW_G && p < EW_Y ? 1 : 2; }
function walkOn(t, off, axis) { const p = phaseAt(t, off); return axis === 0 ? p < WALK : p >= NS_R && p < NS_R + WALK; }

// ---------------------------------------------------------------- the gait: measured, not invented
// Speed: 1.43 ± 0.15 m/s at a usual walk (healthy adults 30-40, PMC4549059 Table 2); 1.25 m/s in Collins, Adamczyk and Kuo, Proc. R. Soc. B 2009.
// Cycle: 60% stance, 40% swing. Hip: about 30° flexed at heel contact, 10-15° extended before toe-off. Knee: 10-15° in early stance, about 60° at most in swing.
// Arms: 53.4 ± 16.6° from front to back at the usual walk (PMC4549059), out of phase with the leg on the same side (Collins et al. 2009); the elbow moves through about 30°.
const PART = { BODY: 0, LTH: 1, LSH: 2, RTH: 3, RSH: 4, LUA: 5, LFA: 6, RUA: 7, RFA: 8, HEAD: 9 };
const MAT = { SKIN: 0, TOP: 1, BOT: 2, HAIR: 3, SHOE: 4, SLEEVE: 5, LONG: 6, HAT: 7 };

function personGeometry() {
  const P = [], N = [], A = [], M = [];
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const quad = (a, b, c, d, part, mat) => { const n = new THREE.Vector3().subVectors(v3(b), v3(a)).cross(new THREE.Vector3().subVectors(v3(c), v3(a))).normalize(); for (const q of [a, b, c, a, c, d]) { P.push(q[0], q[1], q[2]); N.push(n.x, n.y, n.z); A.push(part); M.push(mat); } };
  // a box that may taper: bottom half-sizes (bx, bz), top half-sizes (tx, tz), centred on (x, z), from y0 up to y1
  const box = (x, z, y0, y1, bx, bz, tx, tz, part, mat, dz = 0) => {
    const b = [[x - bx, y0, z - bz], [x + bx, y0, z - bz], [x + bx, y0, z + bz + dz], [x - bx, y0, z + bz + dz]], t = [[x - tx, y1, z - tz], [x + tx, y1, z - tz], [x + tx, y1, z + tz], [x - tx, y1, z + tz]];
    quad(b[0], b[3], b[2], b[1], part, mat); quad(t[0], t[1], t[2], t[3], part, mat);
    quad(b[0], b[1], t[1], t[0], part, mat); quad(b[1], b[2], t[2], t[1], part, mat); quad(b[2], b[3], t[3], t[2], part, mat); quad(b[3], b[0], t[0], t[3], part, mat);
  };
  const ball = (cx, cy, cz, rx, ry, rz, part, mat, ws, hs, top = Math.PI) => {
    const g = new THREE.SphereGeometry(1, ws, hs, 0, TAU, 0, top).toNonIndexed(), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { P.push(cx + p.getX(i) * rx, cy + p.getY(i) * ry, cz + p.getZ(i) * rz); const nn = new THREE.Vector3(n.getX(i) / rx, n.getY(i) / ry, n.getZ(i) / rz).normalize(); N.push(nn.x, nn.y, nn.z); A.push(part); M.push(mat); }
  };
  // a 1.75 m person facing +z, the left side at +x; joints: hips (±0.09, 0.90), knees 0.48, shoulders (±0.235, 1.40), elbows 1.13, neck 1.50
  box(0, 0, 0.86, 1.03, 0.17, 0.11, 0.165, 0.105, PART.BODY, MAT.BOT);
  box(0, 0, 1.02, 1.42, 0.16, 0.105, 0.195, 0.12, PART.BODY, MAT.TOP);
  box(0, 0, 1.38, 1.47, 0.215, 0.10, 0.17, 0.09, PART.BODY, MAT.TOP);
  box(0, 0.005, 1.45, 1.54, 0.05, 0.05, 0.048, 0.048, PART.HEAD, MAT.SKIN);
  ball(0, 1.635, 0.012, 0.102, 0.122, 0.112, PART.HEAD, MAT.SKIN, 7, 5);
  ball(0, 1.648, 0.0, 0.112, 0.118, 0.12, PART.HEAD, MAT.HAIR, 7, 3, Math.PI * 0.52);
  box(0, -0.085, 1.40, 1.66, 0.10, 0.045, 0.105, 0.055, PART.HEAD, MAT.LONG);
  // a cap for some: the head and the top of the body are where the eye goes first in a crowd, and a head accessory is among the most telling changes there (McDonnell et al., SIGGRAPH 2009)
  ball(0, 1.675, -0.005, 0.12, 0.085, 0.128, PART.HEAD, MAT.HAT, 7, 3, Math.PI * 0.5);
  box(0, 0.125, 1.668, 1.69, 0.085, 0.055, 0.08, 0.05, PART.HEAD, MAT.HAT);
  for (const s of [1, -1]) {
    const th = s > 0 ? PART.LTH : PART.RTH, sh = s > 0 ? PART.LSH : PART.RSH, ua = s > 0 ? PART.LUA : PART.RUA, fa = s > 0 ? PART.LFA : PART.RFA;
    box(0.09 * s, 0, 0.47, 0.91, 0.062, 0.07, 0.078, 0.082, th, MAT.BOT);
    box(0.09 * s, 0, 0.085, 0.49, 0.05, 0.055, 0.06, 0.062, sh, MAT.BOT);
    box(0.09 * s, 0.045, 0.0, 0.09, 0.055, 0.12, 0.05, 0.07, sh, MAT.SHOE);
    box(0.235 * s, 0, 1.12, 1.43, 0.045, 0.048, 0.055, 0.055, ua, MAT.TOP);
    box(0.24 * s, 0, 0.875, 1.135, 0.036, 0.038, 0.044, 0.044, fa, MAT.SLEEVE);
    box(0.24 * s, 0.005, 0.78, 0.88, 0.03, 0.04, 0.034, 0.036, fa, MAT.SKIN);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(A, 1)); g.setAttribute('aMat', new THREE.Float32BufferAttribute(M, 1));
  return g;
}

// the pose, in the vertex shader: each limb turns about its joint; the phase, gait and pose come per person
const PERSON_GLSL = /* glsl */`
attribute float aPart, aMat; attribute vec4 aG, aSkin, aTop, aBot, aHair;
flat varying vec3 vSlCol; varying float vSlFade;
vec3 slP; mat3 slR;
mat3 slRx(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
float slG(float f, float m, float w) { float x = (f - m)/w; return exp(-x*x); }
void slPose(vec3 p) {
  float ph = aG.x, gait = aG.y, pose = aG.z, walk = clamp(gait, 0.0, 1.0), run = clamp(gait - 1.0, 0.0, 1.0), part = aPart;
  float d = 0.01745;
  // legs: hip 10 + 20 cos (flexed 30 at heel contact, extended 10 before toe-off); knee 15 in early stance, 60 at most in swing; running opens both
  float side = (part < 2.5) ? 0.0 : 3.14159, f = fract((ph + side)/6.28318);
  float hipW = (10.0 + 20.0*cos(ph + side))*d, kneeW = (4.0 + 12.0*slG(f, .12, .07) + 56.0*slG(f, .72, .11))*d;
  float hipR = (15.0 + 35.0*cos(ph + side))*d, kneeR = (18.0 + 22.0*slG(f, .15, .08) + 88.0*slG(f, .70, .15))*d;
  float stand = pose > 2.5 ? (side > 1.0 ? 10.0 : 2.0)*d : 2.0*d;
  float hip = mix(mix(0.0, hipW, walk), hipR, run), knee = mix(mix(stand, kneeW, walk), kneeR, run);
  // arms: 53 degrees front to back, out of phase with the leg on the same side; the elbow through about 30; running bends it to 85
  float aside = (part == 5.0 || part == 6.0) ? 0.0 : 3.14159;
  float shW = (5.0 - 26.5*cos(ph + aside))*d, elW = (25.0 - 14.0*cos(ph + aside))*d, shR = (10.0 - 35.0*cos(ph + aside))*d, elR = 85.0*d;
  float t = ph*0.2, shS = (2.0 + 1.5*sin(t + aside))*d, elS = 8.0*d;
  if (pose > 0.5 && pose < 1.5 && aside > 1.0) { shS = 32.0*d; elS = 105.0*d; shW = shS; elW = elS; }
  if (pose > 1.5 && pose < 2.5) { shS = (12.0 + 10.0*sin(t*3.1 + aside))*d; elS = (40.0 + 30.0*sin(t*2.3 + aside*1.3))*d; }
  if (pose > 2.5) { shS = 14.0*d; elS = 95.0*d; }
  float sh = mix(mix(shS, shW, walk), shR, run), el = mix(mix(elS, elW, walk), elR, run);
  float nod = (pose > 0.5 && pose < 1.5) ? 22.0*d : 0.0, lean = run*9.0*d + walk*2.0*d;
  vec3 hipP = vec3(part < 2.5 ? 0.09 : -0.09, 0.90, 0.0), kneeP = vec3(hipP.x, 0.48, 0.0);
  vec3 shP = vec3((part == 5.0 || part == 6.0) ? 0.235 : -0.235, 1.40, 0.0), elP = vec3(shP.x*1.02, 1.13, 0.0);
  slR = mat3(1.0); slP = p;
  if (part >= 0.5 && part <= 4.5) {
    mat3 Rh = slRx(-hip);
    if (part == 2.0 || part == 4.0) { mat3 Rk = slRx(knee); slP = hipP + Rh*((kneeP - hipP) + Rk*(p - kneeP)); slR = Rh*Rk; }
    else { slP = hipP + Rh*(p - hipP); slR = Rh; }
  } else if (part >= 4.5 && part <= 8.5) {
    mat3 Rs = slRx(-sh);
    if (part == 6.0 || part == 8.0) { mat3 Re = slRx(-el); slP = shP + Rs*((elP - shP) + Re*(p - elP)); slR = Rs*Re; }
    else { slP = shP + Rs*(p - shP); slR = Rs; }
  } else if (part == 9.0) { mat3 Rn = slRx(nod); vec3 nk = vec3(0.0, 1.50, 0.0); slP = nk + Rn*(p - nk); slR = Rn; }
  if (part == 0.0 || part >= 4.5) { mat3 Rl = slRx(lean); vec3 w = vec3(0.0, 0.92, 0.0); slP = w + Rl*(slP - w); slR = Rl*slR; }
  slP.y += (walk*0.015 + run*0.035)*(-cos(2.0*ph));
  // a short-haired person's long hair folds away into the head
  if ((aMat == 6.0 && aHair.w < 0.5) || (aMat == 7.0 && aSkin.w < 0.5)) slP = vec3(0.0, 1.62, 0.0);
  vec3 hat = aSkin.w < 1.5 ? vec3(.03, .03, .035) : aSkin.w < 2.5 ? vec3(.04, .06, .14) : aSkin.w < 3.5 ? vec3(.45, .38, .27) : aSkin.w < 4.5 ? vec3(.45, .06, .05) : vec3(.75, .75, .72);
  vSlCol = aMat == 0.0 ? aSkin.rgb : aMat == 1.0 ? aTop.rgb : aMat == 2.0 ? aBot.rgb : aMat == 3.0 || aMat == 6.0 ? aHair.rgb : aMat == 4.0 ? vec3(aBot.w) : aMat == 7.0 ? hat : (aTop.w > 0.5 ? aSkin.rgb : aTop.rgb);
  vSlFade = aG.w;
}`;

// ---------------------------------------------------------------- the cars: four bodies on shared wheels and lamps, placed by each car's own length and width
const KIND = [
  // name, length, width, body top, cabin: bottom from-to, top from-to, roof height, wheel radius, wheel inset from the ends
  { L: 4.6, W: 1.82, body: 0.80, cb: [-1.2, 1.05], ct: [-0.9, 0.55], roof: 1.42, r: 0.32, inset: 0.82 },
  { L: 4.0, W: 1.76, body: 0.82, cb: [-1.85, 0.95], ct: [-1.7, 0.42], roof: 1.48, r: 0.31, inset: 0.72 },
  { L: 4.95, W: 1.96, body: 1.02, cb: [-2.42, 1.25], ct: [-2.38, 0.85], roof: 1.98, r: 0.34, inset: 0.80 },
  { L: 11.2, W: 2.5, body: 1.18, cb: [-5.5, 5.4], ct: [-5.45, 5.3], roof: 2.95, r: 0.50, inset: 2.30 },
];
function carGeometry() {
  const P = [], N = [], A = [], K = [], M = [];
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const quad = (a, b, c, d, part, kind, mat) => { const n = new THREE.Vector3().subVectors(v3(b), v3(a)).cross(new THREE.Vector3().subVectors(v3(c), v3(a))).normalize(); for (const q of [a, b, c, a, c, d]) { P.push(q[0], q[1], q[2]); N.push(n.x, n.y, n.z); A.push(part); K.push(kind); M.push(mat); } };
  const prism = (w0, w1, y0, y1, z0b, z1b, z0t, z1t, part, kind, matSide, matTop) => {
    const b = [[-w0, y0, z0b], [w0, y0, z0b], [w0, y0, z1b], [-w0, y0, z1b]], t = [[-w1, y1, z0t], [w1, y1, z0t], [w1, y1, z1t], [-w1, y1, z1t]];
    quad(t[0], t[1], t[2], t[3], part, kind, matTop); quad(b[0], b[3], b[2], b[1], part, kind, matSide);
    quad(b[0], b[1], t[1], t[0], part, kind, matSide); quad(b[1], b[2], t[2], t[1], part, kind, matSide); quad(b[2], b[3], t[3], t[2], part, kind, matSide); quad(b[3], b[0], t[0], t[3], part, kind, matSide);
  };
  KIND.forEach((k, i) => {
    const h = k.L / 2, w = k.W / 2;
    // the body: its nose and tail drawn in a little at the top
    prism(w, w - 0.04, 0.28 + (i === 3 ? 0.08 : 0), k.body, -h, h, -h + 0.12, h - (i === 3 ? 0.05 : 0.25), 0, i, 0, 0);
    // the cabin: glass on its sides, the roof in the body's paint
    prism(w - 0.08, w - 0.2 + (i >= 2 ? 0.12 : 0), k.body, k.roof, k.cb[0], k.cb[1], k.ct[0], k.ct[1], 0, i, 1, 0);
  });
  // a taxi's lamp on the roof: shown only on a taxi
  prism(0.32, 0.30, KIND[0].roof, KIND[0].roof + 0.2, -0.6, -0.15, -0.58, -0.17, 0, 4, 3, 3);
  // four wheels, built round the sedan's, moved to each car's own in the shader
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const g = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 7, 1).rotateZ(Math.PI / 2).toNonIndexed(), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i) + sx * 0.80, p.getY(i) + 0.32, p.getZ(i) + sz * 1.48); N.push(n.getX(i), n.getY(i), n.getZ(i)); A.push(2); K.push(-1); M.push(2); }
  }
  // the lamps: two at the front, two at the back
  for (const sx of [1, -1]) { quad([sx * 0.62 - 0.17, 0.55, 2.31], [sx * 0.62 + 0.17, 0.55, 2.31], [sx * 0.62 + 0.17, 0.68, 2.31], [sx * 0.62 - 0.17, 0.68, 2.31], 3, -1, 4); quad([sx * 0.66 + 0.15, 0.62, -2.31], [sx * 0.66 - 0.15, 0.62, -2.31], [sx * 0.66 - 0.15, 0.74, -2.31], [sx * 0.66 + 0.15, 0.74, -2.31], 4, -1, 5); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(A, 1)); g.setAttribute('aKind', new THREE.Float32BufferAttribute(K, 1)); g.setAttribute('aMat', new THREE.Float32BufferAttribute(M, 1));
  return g;
}
const CAR_GLSL = /* glsl */`
attribute float aPart, aKind, aMat; attribute vec4 aCar, aDim;
flat varying vec3 vSlCol; flat varying float vSlLamp; varying float vSlFade, vSlBrake;
vec3 slP;
void slCar(vec3 p) {
  // aCar: paint, kind (0 sedan, 1 hatch, 2 van, 3 bus, 4 taxi: a sedan with its roof lamp); aDim: length, width, wheel radius, fade + 2 x braking
  float k = aCar.w, body = k > 3.5 ? 0.0 : k;
  float show = (aKind < -0.5 || aKind == body || (aKind == 4.0 && k > 3.5)) ? 1.0 : 0.0;
  slP = p;
  float L = aDim.x, W = aDim.y, r = aDim.z, inset = body == 3.0 ? 2.3 : body == 1.0 ? 0.72 : 0.82;
  if (aPart == 2.0) { vec3 piv = vec3(sign(p.x)*0.80, 0.32, sign(p.z)*1.48), q = p - piv; slP = vec3(sign(p.x)*(W*0.5 - 0.13), r, sign(p.z)*(L*0.5 - inset)) + q*(r/0.32); }
  if (aPart == 3.0 || aPart == 4.0) { slP.z = sign(p.z)*(L*0.5 + 0.015); slP.x = p.x*(W/1.82); slP.y = p.y + (body == 3.0 ? 0.25 : body == 2.0 ? 0.12 : 0.0); }
  if (show < 0.5) slP = vec3(0.0, -2.0, 0.0);
  vSlCol = aMat == 0.0 ? aCar.rgb : aMat == 1.0 ? vec3(.055, .07, .085) : aMat == 2.0 ? vec3(.035) : aMat == 3.0 ? vec3(.95, .78, .2) : aMat == 4.0 ? vec3(.95, .93, .85) : vec3(.6, .04, .03);
  vSlLamp = aMat == 4.0 ? 1.0 : aMat == 5.0 ? 2.0 : aMat == 3.0 ? 3.0 : 0.0;
  vSlFade = fract(aDim.w); vSlBrake = floor(aDim.w)*0.5;
}`;

// ---------------------------------------------------------------- the street's furniture
// one geometry from parts, each part tagged with what it is made of
function merge(parts) {
  const P = [], N = [], M = [];
  for (const [g0, mat] of parts) { const g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); M.push(mat); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('aMat', new THREE.Float32BufferAttribute(M, 1)); return g;
}
// a street lamp: a 9.1 m pole and a cobra head out over the road, New York's standard (30 ft, NYC DOT Street Design Manual); its light 3000 K, the colour the city specifies
function lampGeometry() {
  return merge([
    [new THREE.CylinderGeometry(0.065, 0.1, 9.0, 6, 1, true).translate(0, 4.5, 0), 0],
    [new THREE.BoxGeometry(0.08, 0.08, 1.7).translate(0, 8.95, 0.8), 0],
    [new THREE.BoxGeometry(0.34, 0.15, 0.72).translate(0, 8.98, 1.85), 1],
    [new THREE.PlaneGeometry(0.26, 0.56).rotateX(Math.PI / 2).translate(0, 8.9, 1.85), 2],
  ]);
}
// a traffic signal: a post with a head of three lamps facing the traffic it stops
function signalGeometry() {
  return merge([
    [new THREE.CylinderGeometry(0.06, 0.08, 3.1, 6, 1, true).translate(0, 1.55, 0), 0],
    [new THREE.BoxGeometry(0.34, 0.98, 0.26).translate(0, 3.55, 0), 1],
    [new THREE.CircleGeometry(0.11, 8).translate(0, 3.86, 0.135), 3],
    [new THREE.CircleGeometry(0.11, 8).translate(0, 3.55, 0.135), 4],
    [new THREE.CircleGeometry(0.11, 8).translate(0, 3.24, 0.135), 5],
  ]);
}
// a street tree: a trunk and a crown of two lobes
function treeGeometry() {
  return merge([
    [new THREE.CylinderGeometry(0.1, 0.15, 3.2, 5, 1, true).translate(0, 1.6, 0), 0],
    [new THREE.IcosahedronGeometry(1.9, 0).scale(1, 0.85, 1).translate(0, 4.5, 0), 1],
    [new THREE.IcosahedronGeometry(1.35, 0).translate(0.45, 5.7, -0.2), 1],
  ]);
}

// ---------------------------------------------------------------- who they are: no two alike in one view
// colour first, then build and height: clones of appearance are far easier to see than clones of motion, and colour and size hide them (McDonnell et al., "Clone Attack!", SIGGRAPH 2008)
const lin = (hex) => { const c = new THREE.Color(); c.setHex(hex, THREE.SRGBColorSpace); return [c.r, c.g, c.b]; };
const SKIN = [0xf1d0b5, 0xe2b896, 0xc89671, 0xa06c4c, 0x7a4f35, 0x4e3324].map(lin);
const TOPS = [0x1b1b1d, 0x3a3b3f, 0x7d7f82, 0xe8e6e1, 0x1f2a44, 0x3d5a80, 0x55603e, 0xb8a585, 0x6e2333, 0xb23a32, 0xc99a2e, 0x2f6f73, 0xd99aa5, 0x2e4a33, 0x5b3d2b, 0x9cc3d9].map(lin);
const BOTS = [0x1e2a3e, 0x4f6d8f, 0x161617, 0x5a5b5f, 0x9b8a6b, 0x23304a, 0x4d5238, 0xc2b59b, 0x4a3628, 0xdedcd6].map(lin);
const HAIR = [0x0e0c0b, 0x2b1d14, 0x4a3020, 0x6d4a2f, 0xc9a66b, 0x7d3a1d, 0x9a9a98].map(lin);
const pick = (a, r) => a[Math.floor(r * a.length) % a.length];
// the paint on the cars: mostly white, black, greys and silver, then blue and red, a few others (the world's car colours by share)
const PAINT = [[0xeeeeec, 0.35], [0x111214, 0.19], [0x6b6e72, 0.17], [0xb6b9bc, 0.09], [0x23395d, 0.08], [0x8e1b1b, 0.06], [0x6b5a43, 0.03], [0x2f4a35, 0.02], [0xb57d1e, 0.01]].map(([h, w]) => [lin(h), w]);
const paint = (r) => { let a = 0; for (const [c, w] of PAINT) { a += w; if (r < a) return c; } return PAINT[0][0]; };
const TAXI = lin(0xe3a91e);

export function createStreetLife(G) {
  const W = G.world, plan = W.metro && W.metro.plan; if (!plan) return null;
  const scene = G.scene, look = G.look, U = look.uniforms, phone = G.tier === 'phone', rnd = (() => { let z = 4021; return () => ((z = (z * 16807) % 2147483647) - 1) / 2147483646; })();
  const cx = plan.center.x, cy = plan.center.y, RG = METRO.R * 0.86;

  // ---------------------------------------------------------------- the crossings and the lanes between them
  const xs = (a) => cx + HB + BOX + a * PITCH, ys = (b) => cy + HB + BOX + b * PITCH, key = (a, b) => a + ',' + b;
  const nodes = new Map();
  for (let a = -5; a <= 4; a++) for (let b = -5; b <= 4; b++) { const x = xs(a), y = ys(b); if (Math.hypot(x - cx, y - cy) <= RG - 16) nodes.set(key(a, b), { a, b, x, y }); }
  // a crossing with one road only is a dead end: drop it, and again, until every crossing has a way on
  for (let again = true; again;) { again = false; for (const [k, n] of nodes) { let deg = 0; for (const [da, db] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (nodes.has(key(n.a + da, n.b + db))) deg++; if (deg < 2) { nodes.delete(k); again = true; } } }
  const H = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }, RIGHT = { N: 'E', E: 'S', S: 'W', W: 'N' }, LEFT = { N: 'W', W: 'S', S: 'E', E: 'N' }, OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const nodeList = [...nodes.values()], links = [];
  for (const n of nodeList) { n.off = (((n.a * 7 + n.b * 13) % CYC) + CYC) % CYC; n.in = {}; n.out = {}; n.busy = { N: 0, S: 0, E: 0, W: 0 }; n.inside = []; }
  const addLink = (from, to, d) => { const h = H[d], r = [h[1], -h[0]], L = { id: links.length, from, to, d, h, r, axis: d === 'N' || d === 'S' ? 0 : 1, x0: from.x + h[0] * BOX + r[0] * LANE, y0: from.y + h[1] * BOX + r[1] * LANE, len: PITCH - 2 * BOX, cars: [] }; links.push(L); from.out[d] = L; to.in[d] = L; };
  for (const n of nodeList) { const up = nodes.get(key(n.a, n.b + 1)), rt = nodes.get(key(n.a + 1, n.b)); if (up) { addLink(n, up, 'N'); addLink(up, n, 'S'); } if (rt) { addLink(n, rt, 'E'); addLink(rt, n, 'W'); } }
  // a way through a crossing: on straight, or round its corner, 4.25 m out for a right turn and 7.75 m for a left
  function movement(n, d, k) {
    const nd = k === 'S' ? d : k === 'R' ? RIGHT[d] : LEFT[d], out = n.out[nd]; if (!out) return null;
    const h = H[d], r = [h[1], -h[0]], ex = n.x - h[0] * BOX + r[0] * LANE, ey = n.y - h[1] * BOX + r[1] * LANE;
    if (k === 'S') return { k, out, n, d, len: 2 * BOX, ex, ey, h, side: nd };
    const sg = k === 'R' ? 1 : -1, rad = k === 'R' ? BOX - LANE : BOX + LANE;
    return { k, out, n, d, len: (Math.PI / 2) * rad, ex, ey, h, rad, cw: k === 'R', ccx: n.x + sg * r[0] * BOX - h[0] * BOX, ccy: n.y + sg * r[1] * BOX - h[1] * BOX, side: nd };
  }
  const MV = new Map(); for (const n of nodeList) for (const d in n.in) for (const k of ['S', 'R', 'L']) { const m = movement(n, d, k); if (m) MV.set(n.a + ',' + n.b + d + k, m); }
  const mvOf = (n, d, k) => MV.get(n.a + ',' + n.b + d + k) || null;
  function moveAt(mv, m, o) {
    if (mv.k === 'S') { o.x = mv.ex + mv.h[0] * m; o.y = mv.ey + mv.h[1] * m; o.hx = mv.h[0]; o.hy = mv.h[1]; return o; }
    const th = (m / mv.rad) * (mv.cw ? -1 : 1), vx = mv.ex - mv.ccx, vy = mv.ey - mv.ccy, c = Math.cos(th), s = Math.sin(th), px = vx * c - vy * s, py = vx * s + vy * c, l = Math.hypot(px, py) || 1;
    o.x = mv.ccx + px; o.y = mv.ccy + py; o.hx = mv.cw ? py / l : -py / l; o.hy = mv.cw ? -px / l : px / l; return o;
  }
  function chooseNext(c) {
    const n = c.L.to, d = c.L.d, opts = []; let tot = 0;
    for (const [k, w] of [['S', 0.6], ['R', 0.25], ['L', 0.15]]) { const m = mvOf(n, d, k); if (m) { opts.push([m, w]); tot += w; } }
    let r = rnd() * tot; for (const [m, w] of opts) { if ((r -= w) <= 0) return m; } return opts.length ? opts[opts.length - 1][0] : null;
  }

  // ---------------------------------------------------------------- the cars: one to every 30 m of lane by day, the density of the busiest published city builds
  const cars = [], laneM = links.length * (PITCH - 2 * BOX), nCars = Math.round(laneM / 30);
  const KW = [[0, 0.5], [1, 0.25], [2, 0.14], [4, 0.07], [3, 0.04]];
  for (let i = 0; i < nCars && links.length; i++) {
    let r = rnd(), kind = 0; for (const [k, w] of KW) { if ((r -= w) <= 0) { kind = k; break; } }
    const spec = KIND[kind === 4 ? 0 : kind], L = links[(i * 7) % links.length];
    const s = (L.len - 4) * ((Math.floor(i / links.length) * 0.37 + rnd() * 0.1) % 1) + 2;
    if (L.cars.some((q) => Math.abs(q.s - s) < (q.len + spec.L) / 2 + 3)) continue;
    const c = { L, s, v: 0, mv: null, m: 0, kind, len: spec.L, w: spec.W, rad: spec.r, col: kind === 4 ? TAXI : paint(rnd()), nightOut: rnd() < 0.45, out: true, hideT: 0, brake: 0, next: null, x: 0, y: 0, hx: 0, hy: 1 };
    L.cars.push(c); cars.push(c);
  }
  for (const L of links) L.cars.sort((p, q) => p.s - q.s);
  for (const c of cars) c.next = chooseNext(c);

  // ---------------------------------------------------------------- the people: about 7 to every 100 m of pavement by day, the density of the busiest published city builds
  const blocks = [];
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { const bx = cx + i * PITCH, by = cy + j * PITCH, far = Math.hypot(Math.abs(bx - cx) + HB + 3, Math.abs(by - cy) + HB + 3); if (far <= RG - 4) blocks.push({ i, j, bx, by }); }
  const blockAt = new Map(blocks.map((b) => [key(b.i, b.j), b]));
  const LINES = [0.8, 1.75];
  const people = [];
  for (const b of blocks) {
    const n = Math.round(((BLOCK + 4) * 4 * 7) / 100);
    for (let k = 0; k < n; k++) {
      const line = k % 2, E = HB + LINES[line], per = 8 * E, h = 1.55 + 0.4 * (rnd() + rnd()) / 2;
      const p = { b, line, dir: line === 0 ? 1 : -1, s: rnd() * per, E, per, base: 1.34 + 0.26 * (rnd() + rnd() + rnd() - 1.5) * 0.8, v: 0, ph: rnd() * TAU, gait: 1, pose: rnd() < 0.15 ? 1 : 0, state: 'walk', t: 0, lat: (rnd() - 0.5) * 0.4, side: 0, x: 0, y: 0, hx: 1, hy: 0,
        h, build: 0.9 + rnd() * 0.22, skin: pick(SKIN, rnd()), top: pick(TOPS, rnd()), bot: pick(BOTS, rnd()), hair: pick(HAIR, rnd()), long: rnd() < 0.38 ? 1 : 0, hat: rnd() < 0.18 ? 1 + Math.floor(rnd() * 5) : 0, sleeve: rnd() < 0.4 ? 1 : 0, shoe: [0.03, 0.03, 0.7, 0.22][Math.floor(rnd() * 4)],
        cross: null, nightOut: rnd() < 0.4, out: true, hideT: 0, flee: 0 };
      // some stand and talk in pairs, in front of the shops: a person on the street is always doing something
      if (k % 9 === 4) { p.state = 'idle'; p.pose = 2; p.t = 20 + rnd() * 50; p.gait = 0; }
      const prev = people[people.length - 1];
      if (k % 9 === 5 && prev && prev.state === 'idle' && prev.b === b) { p.line = prev.line; p.dir = prev.dir; p.E = prev.E; p.per = prev.per; p.s = (prev.s + 0.9) % prev.per; p.state = 'idle'; p.pose = 2; p.t = prev.t; p.gait = 0; p.pair = true; }
      people.push(p);
    }
  }

  // ---------------------------------------------------------------- where a walker is on their block's loop: four sides, anticlockwise from the south-west corner
  const SIDES = [[-1, -1, 1, 0, 0, -1], [1, -1, 0, 1, 1, 0], [1, 1, -1, 0, 0, 1], [-1, 1, 0, -1, -1, 0]];
  function loopAt(p, o) {
    const E = p.E, side = Math.floor(p.s / (2 * E)) % 4, u = p.s - side * 2 * E, S = SIDES[side], off = p.lat + p.side;
    o.x = p.b.bx + S[0] * E + S[2] * u + S[4] * off; o.y = p.b.by + S[1] * E + S[3] * u + S[5] * off; o.hx = S[2] * p.dir; o.hy = S[3] * p.dir; o.side = side; return o;
  }
  // straight on at a corner, across the street: the block across, the crossing it uses (relative to the block), the strip of the crossing, whose green lets them walk, where they join
  const ACROSS = {
    '0,1': [1, 0, 0, -1, 'N', 1, 0], '1,1': [0, 1, 0, 0, 'W', 0, 2], '2,1': [-1, 0, -1, 0, 'S', 1, 4], '3,1': [0, -1, -1, -1, 'E', 0, 6],
    '0,-1': [-1, 0, -1, -1, 'N', 1, 2], '1,-1': [0, -1, 0, -1, 'W', 0, 4], '2,-1': [1, 0, 0, 0, 'S', 1, 6], '3,-1': [0, 1, -1, 0, 'E', 0, 8],
  };
  const tmp = { x: 0, y: 0, hx: 0, hy: 0, side: 0 }, tmp2 = { x: 0, y: 0, hx: 0, hy: 0, side: 0 };
  function startCross(p, side) {
    const A = ACROSS[side + ',' + p.dir], nb = blockAt.get(key(p.b.i + A[0], p.b.j + A[1])); if (!nb) return false;
    const node = nodes.get(key(p.b.i + A[2], p.b.j + A[3])) || null;
    loopAt(p, tmp); const E = HB + LINES[p.line], s1 = A[6] * E - (p.dir < 0 ? 0.01 : 0) - (A[6] === 8 ? 0 : 0);
    const q = { b: nb, E, s: ((s1 % (8 * E)) + 8 * E) % (8 * E), lat: p.lat, side: 0, dir: p.dir }; loopAt(q, tmp2);
    p.cross = { node, strip: A[4], axis: A[5], x0: tmp.x, y0: tmp.y, x1: tmp2.x, y1: tmp2.y, len: Math.hypot(tmp2.x - tmp.x, tmp2.y - tmp.y), m: 0, nb, s1: q.s, going: false };
    p.state = 'wait'; return true;
  }

  // ---------------------------------------------------------------- the meshes
  const capP = phone ? 220 : 360, capC = phone ? 100 : 160, RP = phone ? 120 : 165, RC = phone ? 200 : 260;
  const ditherFS = `if (vSlFade < .999) { float sl_n = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233)))*43758.5453); if (sl_n > vSlFade) discard; }`;
  const pm = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  look.patch(pm, { key: 'sl_people', vertexPars: PERSON_GLSL, normalExtra: 'vec3 objectNormal = vec3(normal); slPose(position); objectNormal = slR*objectNormal;', vertexBend: 'transformed = slP;',
    fragmentPars: 'flat varying vec3 vSlCol; varying float vSlFade;\n', albedo: `diffuseColor.rgb = vSlCol; ${ditherFS}` });
  const pg = personGeometry(), PI = { G: new Float32Array(capP * 4), SK: new Float32Array(capP * 4), TP: new Float32Array(capP * 4), BT: new Float32Array(capP * 4), HR: new Float32Array(capP * 4) };
  for (const [n, a] of [['aG', PI.G], ['aSkin', PI.SK], ['aTop', PI.TP], ['aBot', PI.BT], ['aHair', PI.HR]]) { const at = new THREE.InstancedBufferAttribute(a, 4); at.setUsage(THREE.DynamicDrawUsage); pg.setAttribute(n, at); }
  const peopleM = new THREE.InstancedMesh(pg, pm, capP); peopleM.count = 0; peopleM.frustumCulled = false; peopleM.name = 'sl_people'; peopleM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(peopleM);

  const cm = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.15 });
  look.patch(cm, { key: 'sl_cars', vertexPars: CAR_GLSL, normalExtra: 'vec3 objectNormal = vec3(normal); slCar(position);', vertexBend: 'transformed = slP;',
    fragmentPars: 'flat varying vec3 vSlCol; flat varying float vSlLamp; varying float vSlFade, vSlBrake;\n', albedo: `diffuseColor.rgb = vSlCol; ${ditherFS}`,
    glow: 'if (vSlLamp > .5) ocGlow = vSlLamp < 1.5 ? vec3(1.0, .93, .80)*(.06 + 2.6*ocNight) : vSlLamp < 2.5 ? vec3(1.0, .06, .04)*(.10 + 1.4*ocNight + 1.6*vSlBrake) : vec3(.95, .75, .2)*(.15 + 1.2*ocNight);' });
  const cg = carGeometry(), CI = { C: new Float32Array(capC * 4), D: new Float32Array(capC * 4) };
  for (const [n, a] of [['aCar', CI.C], ['aDim', CI.D]]) { const at = new THREE.InstancedBufferAttribute(a, 4); at.setUsage(THREE.DynamicDrawUsage); cg.setAttribute(n, at); }
  const carsM = new THREE.InstancedMesh(cg, cm, capC); carsM.count = 0; carsM.frustumCulled = false; carsM.name = 'sl_cars'; carsM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(carsM);

  // the furniture: where every lamp, signal and tree stands, set once; the nearest are drawn
  const lampsAt = [], signalsAt = [], treesAt = [];
  for (const b of blocks) for (let side = 0; side < 4; side++) {
    const S = SIDES[side], E = HB + 2.2, yaw = Math.atan2(S[4], -S[5]);
    for (const u of [8, 26, 44]) lampsAt.push({ x: b.bx + S[0] * E + S[2] * u * (2 * E) / BLOCK, y: b.by + S[1] * E + S[3] * u * (2 * E) / BLOCK, yaw, k: 1 });
    const avenue = (side === 1 || side === 3) ? b.i % 3 === 0 : b.j % 3 === 0;
    if (avenue) for (const u of [17, 35]) { const Et = HB + 1.9; treesAt.push({ x: b.bx + S[0] * Et + S[2] * u * (2 * Et) / BLOCK, y: b.by + S[1] * Et + S[3] * u * (2 * Et) / BLOCK, yaw: rnd() * TAU, k: 0.85 + rnd() * 0.35, tint: rnd() }); }
  }
  // at the crossings, a lamp on every corner: New York lights its intersections at about twice mid-block (NYC DOT); and a signal on every far corner, facing the traffic it stops
  for (const n of nodeList) for (const [sx, sy] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    lampsAt.push({ x: n.x + sx * (BOX - 0.9), y: n.y + sy * (BOX - 1.6), yaw: Math.atan2(-sx, sy), k: 2 });
    // NE faces south traffic going north (axis 0), SE faces west traffic going east (axis 1), SW faces north traffic going south, NW faces east traffic going west
    const faces = sx > 0 && sy > 0 ? [0, -1, 0] : sx > 0 ? [-1, 0, 1] : sy < 0 ? [0, 1, 0] : [1, 0, 1];
    signalsAt.push({ x: n.x + sx * (BOX - 1.7), y: n.y + sy * (BOX - 0.8), yaw: Math.atan2(faces[0], -faces[1]), off: n.off, axis: faces[2] });
  }
  const glowM = (key, glow, extra = {}) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.25 }); look.patch(m, { key, ...extra, glow }); return m; };
  const lampMat = glowM('sl_lamps', 'if (vSlM > 1.5) ocGlow = vec3(1.0, .71, .42)*(.04 + 3.2*ocNight);', {
    vertexPars: 'attribute float aMat; flat varying float vSlM;\n', vertexBend: 'vSlM = aMat;', fragmentPars: 'flat varying float vSlM;\n',
    albedo: 'diffuseColor.rgb = vSlM < .5 ? vec3(.055, .065, .06) : vSlM < 1.5 ? vec3(.16, .17, .17) : vec3(.9, .82, .65);' });
  const sigU = { value: 0 };
  const sigMat = glowM('sl_signals', 'if (vSlM > 2.5) ocGlow = vSlOn*(vSlM < 3.5 ? vec3(1.0, .08, .05) : vSlM < 4.5 ? vec3(1.0, .55, .05) : vec3(.15, 1.0, .45))*(.9 + 2.0*ocNight);', {
    uniforms: { uSigT: sigU },
    vertexPars: `attribute float aMat; attribute vec2 aSig; uniform float uSigT; flat varying float vSlM, vSlOn;\n`,
    vertexBend: `vSlM = aMat; { float p = mod(uSigT + aSig.x, ${CYC.toFixed(1)}); float st = aSig.y < .5 ? (p < ${NS_G.toFixed(1)} ? 0.0 : p < ${NS_Y.toFixed(1)} ? 1.0 : 2.0) : (p >= ${NS_R.toFixed(1)} && p < ${EW_G.toFixed(1)} ? 0.0 : p >= ${EW_G.toFixed(1)} && p < ${EW_Y.toFixed(1)} ? 1.0 : 2.0); vSlOn = (aMat == 3.0 && st == 2.0) || (aMat == 4.0 && st == 1.0) || (aMat == 5.0 && st == 0.0) ? 1.0 : 0.0; }`,
    fragmentPars: 'flat varying float vSlM, vSlOn;\n',
    albedo: 'diffuseColor.rgb = vSlM < .5 ? vec3(.05, .055, .05) : vSlM < 1.5 ? vec3(.025, .03, .03) : vec3(.04);' });
  const treeMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: true });
  look.patch(treeMat, { key: 'sl_trees', vertexPars: 'attribute float aMat; attribute vec2 aTr; flat varying float vSlM; varying float vSlT;\n',
    vertexBend: 'vSlM = aMat; vSlT = aTr.x; if (aMat > .5) { float h = max(transformed.y - 3.0, 0.0); transformed.x += sin(ocTime*1.1 + aTr.x*37.0)*.05*h; transformed.z += cos(ocTime*.9 + aTr.x*21.0)*.04*h; }',
    fragmentPars: 'flat varying float vSlM; varying float vSlT;\n',
    albedo: 'diffuseColor.rgb = vSlM < .5 ? vec3(.10, .07, .05) : mix(vec3(.10, .21, .07), vec3(.20, .30, .09), vSlT);' });
  function staticMesh(geo, mat, list, cap, name, extra) {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, cap)); m.count = 0; m.frustumCulled = false; m.name = name; scene.add(m);
    if (extra) for (const [n, size] of extra) { const at = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size); at.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(n, at); }
    return { m, list, cap };
  }
  const lampsS = staticMesh(lampGeometry(), lampMat, lampsAt, phone ? 260 : 420, 'sl_lamps');
  const sigS = staticMesh(signalGeometry(), sigMat, signalsAt, phone ? 120 : 200, 'sl_signals', [['aSig', 2]]);
  const treeS = staticMesh(treeGeometry(), treeMat, treesAt, phone ? 120 : 200, 'sl_trees', [['aTr', 2]]);

  // the light the lamps throw, and the headlights on the road: one additive quad each, drawn only by night; and a soft shadow under each person and car
  const capPool = lampsS.cap + capC, poolG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolA = new Float32Array(capPool * 4); poolG.setAttribute('aPool', new THREE.InstancedBufferAttribute(poolA, 4));
  const poolMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { ocNight: U.ocNight },
    vertexShader: `attribute vec4 aPool; varying vec2 vQ; varying vec4 vP; void main() { vQ = position.xz*2.0; vP = aPool; gl_Position = projectionMatrix*viewMatrix*instanceMatrix*vec4(position, 1.0); }`,
    fragmentShader: `uniform float ocNight; varying vec2 vQ; varying vec4 vP; void main() { float r = vP.y > .5 ? length(vec2(vQ.x, (vQ.y + 1.0)*.5)) : length(vQ); float a = max(1.0 - r*r, 0.0); a *= a; vec3 c = vP.y > .5 ? vec3(1.0, .93, .80) : vec3(1.0, .71, .42); gl_FragColor = vec4(c*a*vP.x*smoothstep(.15, .8, ocNight), 1.0); }` });
  const poolM = new THREE.InstancedMesh(poolG, poolMat, capPool); poolM.count = 0; poolM.frustumCulled = false; poolM.renderOrder = 4; poolM.name = 'sl_pools'; scene.add(poolM);
  const capS = capP + capC, shG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, uniforms: { ocNight: U.ocNight },
    vertexShader: `varying vec2 vQ; void main() { vQ = position.xz*2.0; gl_Position = projectionMatrix*viewMatrix*instanceMatrix*vec4(position, 1.0); }`,
    fragmentShader: `uniform float ocNight; varying vec2 vQ; void main() { float r = length(vQ), a = max(1.0 - r*r, 0.0); gl_FragColor = vec4(0.0, 0.0, 0.0, a*a*mix(.42, .22, ocNight)); }` });
  const shM = new THREE.InstancedMesh(shG, shMat, capS); shM.count = 0; shM.frustumCulled = false; shM.renderOrder = 3; shM.name = 'sl_shadows'; scene.add(shM);
  const all = [peopleM, carsM, lampsS.m, sigS.m, treeS.m, poolM, shM];

  // a matrix straight into the array: turned by yaw about the vertical, scaled, at (x, height, -y)
  function put(arr, i, x, y, z, yaw, sx, sy, sz) { const c = Math.cos(yaw), s = Math.sin(yaw), o = i * 16; arr[o] = c * sx; arr[o + 1] = 0; arr[o + 2] = -s * sx; arr[o + 3] = 0; arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0; arr[o + 8] = s * sz; arr[o + 9] = 0; arr[o + 10] = c * sz; arr[o + 11] = 0; arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1; }
  let packAt = { x: 1e9, y: 1e9 }, packT = 0;
  function packStatics(px, py) {
    for (const S of [lampsS, sigS, treeS]) {
      const L = S.list; for (const e of L) e.d = Math.hypot(e.x - px, e.y - py);
      const near = L.filter((e) => e.d < 420).sort((a, b) => a.d - b.d).slice(0, S.cap), arr = S.m.instanceMatrix.array;
      near.forEach((e, i) => { put(arr, i, e.x, GZ, -e.y, e.yaw, e.k && S !== lampsS ? e.k : 1, e.k && S !== lampsS ? e.k : 1, e.k && S !== lampsS ? e.k : 1); if (S === sigS) { const a = S.m.geometry.attributes.aSig; a.array[i * 2] = e.off; a.array[i * 2 + 1] = e.axis; a.needsUpdate = true; } if (S === treeS) { const a = S.m.geometry.attributes.aTr; a.array[i * 2] = e.tint; a.needsUpdate = true; } });
      S.m.count = near.length; S.m.instanceMatrix.needsUpdate = true; S.near = near;
    }
    packAt = { x: px, y: py };
  }

  // ---------------------------------------------------------------- the traffic, each step
  const idm = (v, gap, dv) => { const ss = IDM.s0 + Math.max(0, v * IDM.T + (v * dv) / (2 * Math.sqrt(IDM.a * IDM.b))); return IDM.a * (1 - (v / IDM.v0) ** 4 - (ss / Math.max(gap, 0.05)) ** 2); };
  let hero = null, danger = null;
  function carStep(c, dt, t) {
    let gap = 1e9, vl = 0;
    if (!c.mv) {
      const L = c.L, lead = L.cars[L.cars.indexOf(c) + 1];
      if (lead) { gap = lead.s - c.s - (lead.len + c.len) / 2; vl = lead.v; }
      else {
        const stopAt = L.len - 1.0 - c.len / 2, toStop = stopAt - c.s, n = L.to, mv = c.next, sig = signal(t, n.off, L.axis);
        let hold = sig === 2 || (sig === 1 && toStop > (c.v * c.v) / (2 * IDM.b) + 0.5) || !mv || c.panic > 0;
        if (!hold) {
          // the whole car must fit on the road it turns into, and nobody may be on the crossing it leaves by
          const tail = mv.out.cars[0]; if (tail && tail.s - tail.len / 2 < c.len + 2.5) hold = true;
          if (mv.k !== 'S' && n.busy[mv.side] > 0) hold = true;
          // a left turn gives way to what comes the other way
          if (mv.k === 'L') { const on = n.in[OPP[L.d]]; if (on && on.cars.some((q) => q.next && q.next.k !== 'L' && L.len - q.s < 34 && q.v > 1)) hold = true; if (n.inside.some((q) => q.mv.d === OPP[L.d] && q.mv.k !== 'L')) hold = true; }
          // one car in the crossing on a path that cuts across this one: wait for it
          if (n.inside.some((q) => q.mv.side !== mv.side && q.mv.d !== L.d && q.mv.d !== OPP[L.d])) hold = true;
        }
        if (hold) { gap = Math.max(0.05, toStop); vl = 0; }
        else { const tail = mv.out.cars[0]; if (tail) { gap = L.len - c.s + mv.len + tail.s - (tail.len + c.len) / 2; vl = tail.v; } }
      }
    } else {
      const mv = c.mv, n = mv.n; let best = null;
      for (const q of n.inside) if (q !== c && q.mv.side === mv.side && q.m > c.m && (!best || q.m < best.m)) best = q;
      if (best) { gap = best.m - c.m - (best.len + c.len) / 2; vl = best.v; }
      else { const tail = mv.out.cars[0]; if (tail) { gap = mv.len - c.m + tail.s - (tail.len + c.len) / 2; vl = tail.v; } }
      if (mv.k !== 'S' && n.busy[mv.side] > 0 && mv.len - c.m > 2.5) { gap = Math.min(gap, mv.len - c.m - 2.5); vl = 0; }
    }
    // him, on foot in the road ahead: brake for him
    if (hero) { const rx = hero.x - c.x, ry = hero.y - c.y, along = rx * c.hx + ry * c.hy, lat = Math.abs(rx * c.hy - ry * c.hx); if (along > 0 && along < 30 && lat < 1.9) { gap = Math.min(gap, along - c.len / 2 - 1.2); vl = 0; } }
    const a = clamp(idm(c.v, gap, c.v - vl), -9, IDM.a);
    c.brake = a < -0.6 || (c.v < 0.3 && gap < 6) ? 1 : 0;
    c.v = Math.max(0, c.v + a * dt); const ds = c.v * dt;
    if (!c.mv) {
      c.s += ds;
      if (c.s >= c.L.len && c.next) { const L = c.L; L.cars.splice(L.cars.indexOf(c), 1); c.mv = c.next; c.m = c.s - L.len; c.mv.n.inside.push(c); }
      else if (c.s >= c.L.len) c.s = c.L.len, c.v = 0;
    } else {
      c.m += ds;
      if (c.m >= c.mv.len) { const mv = c.mv; mv.n.inside.splice(mv.n.inside.indexOf(c), 1); c.L = mv.out; c.s = c.m - mv.len; c.L.cars.unshift(c); c.mv = null; c.next = chooseNext(c); }
    }
    if (!c.mv) { c.x = c.L.x0 + c.L.h[0] * c.s; c.y = c.L.y0 + c.L.h[1] * c.s; c.hx = c.L.h[0]; c.hy = c.L.h[1]; }
    else { moveAt(c.mv, c.m, tmp); c.x = tmp.x; c.y = tmp.y; c.hx = tmp.hx; c.hy = tmp.hy; }
    if (c.panic > 0) c.panic -= dt;
  }

  // ---------------------------------------------------------------- the people, each step
  const lines = new Map();
  function personStep(p, dt, t) {
    // a fight close by: they run from it, along their pavement, away from him
    if (danger && p.state !== 'cross' && p.state !== 'flee' && Math.hypot(p.x - danger.x, p.y - danger.y) < 38) {
      if (p.state === 'wait') p.cross = null; p.state = 'flee'; p.flee = 6 + rnd() * 4; p.pose = 0;
      loopAt(p, tmp); if (tmp.hx * (p.x - danger.x) + tmp.hy * (p.y - danger.y) < 0) { p.dir = -p.dir; p.line = p.dir > 0 ? 0 : 1; p.E = HB + LINES[p.line]; p.per = 8 * p.E; }
    }
    let want = 0, gaitTo = 1;
    if (p.state === 'idle') { p.t -= dt; gaitTo = 0; if (p.t <= 0) { p.state = 'walk'; p.pose = rnd() < 0.15 ? 1 : 0; p.side = 0; } }
    else if (p.state === 'wait') {
      gaitTo = 0; const X = p.cross; if (!p.pose) p.pose = 3;
      if (!X.node || walkOn(t, X.node.off, X.axis)) { p.state = 'cross'; X.going = true; if (X.node) X.node.busy[X.strip]++; p.pose = p.pose === 3 ? 0 : p.pose; }
    } else if (p.state === 'cross') {
      const X = p.cross; want = p.base * 1.08; X.m += p.v * dt;
      if (X.m >= X.len) { if (X.node) X.node.busy[X.strip] = Math.max(0, X.node.busy[X.strip] - 1); p.b = X.nb; p.s = X.s1; p.cross = null; p.state = 'walk'; }
    } else {
      want = p.state === 'flee' ? 3.6 : p.base; gaitTo = p.state === 'flee' ? 2 : 1;
      if (p.state === 'flee' && (p.flee -= dt) <= 0) { p.state = 'walk'; gaitTo = 1; }
      // keep a step behind whoever walks ahead on the same line
      if (p.lead) { const gp = p.dir > 0 ? (p.lead.s - p.s + p.per) % p.per : (p.s - p.lead.s + p.per) % p.per; if (gp < 1.1) want = Math.min(want, p.lead.v * (gp < 0.6 ? 0 : 1)); }
      // him on the pavement ahead: step round him
      let sideTo = 0; if (hero) { const dx = hero.x - p.x, dy = hero.y - p.y, d = Math.hypot(dx, dy); if (d < 2.2 && dx * p.hx + dy * p.hy > 0) sideTo = 0.75; }
      p.side += (sideTo - p.side) * Math.min(1, dt * 3);
      const before = Math.floor(p.s / (2 * p.E)), s1 = p.s + p.dir * p.v * dt, wrapped = ((s1 % p.per) + p.per) % p.per, after = Math.floor(wrapped / (2 * p.E));
      if (after !== before && p.state === 'walk' && rnd() < 0.4) {
        // at the corner: straight on across the street, the way most people go on, or round the corner
        p.s = p.dir > 0 ? after * 2 * p.E : before * 2 * p.E; const side = p.dir > 0 ? before : before;
        if (!startCross(p, side)) p.s = wrapped;
      } else p.s = wrapped;
    }
    p.v += (want - p.v) * Math.min(1, dt * 4); p.gait += (gaitTo - p.gait) * Math.min(1, dt * 3.5);
    // the stride: a step every 0.44 x height metres, so a 1.75 m walker at 1.4 m/s takes about 110 steps a minute
    p.ph += (TAU * p.v * dt) / Math.max(0.6, (p.gait > 1.2 ? 1.25 : 0.88) * p.h);
    if (p.state === 'cross' || (p.state === 'wait' && p.cross)) { const X = p.cross, f = clamp(X.m / Math.max(X.len, 0.1), 0, 1); p.x = X.x0 + (X.x1 - X.x0) * f; p.y = X.y0 + (X.y1 - X.y0) * f; const l = Math.max(X.len, 0.01); p.hx = (X.x1 - X.x0) / l; p.hy = (X.y1 - X.y0) / l; }
    else { loopAt(p, tmp); p.x = tmp.x; p.y = tmp.y; p.hx = tmp.hx; p.hy = tmp.hy; if (p.state === 'idle') { const S = SIDES[tmp.side]; p.x -= S[4] * 0.55; p.y -= S[5] * 0.55; p.hx = (p.pair ? -1 : 1) * tmp.hx; p.hy = (p.pair ? -1 : 1) * tmp.hy; } }
  }

  // ---------------------------------------------------------------- each frame
  const frustum = new THREE.Frustum(), pm4 = new THREE.Matrix4(), sph = new THREE.Sphere(new THREE.Vector3(), 2.5);
  let thinkT = 0, live = false;
  function update(dt, camera) {
    const cp = camera.position, cdx = cp.x - cx, cdy = -cp.z - cy, far = Math.hypot(cdx, cdy);
    const on = far < 700; if (on !== live) { live = on; for (const m of all) m.visible = on; } if (!on) return;
    const t = G.time, night = U.ocNight.value; dt = Math.min(dt, 0.1); sigU.value = t;
    const h = G.hero; hero = h && !h.fly && !h.air && h.pos.y < GZ + 2.6 ? { x: h.pos.x, y: -h.pos.z } : null;
    danger = h && h.combatT < 1.0 && h.pos.y < GZ + 40 ? { x: h.pos.x, y: -h.pos.z } : null;
    // cars think at 10 Hz in steps of their own; drawn where they are
    thinkT += dt;
    while (thinkT >= 0.05) { thinkT -= 0.05; for (const c of cars) if (c.out) { if (danger && Math.hypot(c.x - danger.x, c.y - danger.y) < 45) c.panic = 3; carStep(c, 0.05, t); } }
    // the people: who leads whom on each line, then their step
    lines.clear(); for (const p of people) { if (!p.out || p.state === 'cross' || p.state === 'wait' || p.state === 'idle') { p.lead = null; continue; } const k = p.b.i * 100 + p.b.j + p.line * 10000; let L = lines.get(k); if (!L) lines.set(k, (L = [])); L.push(p); }
    for (const L of lines.values()) { L.sort((a, b) => a.s - b.s); for (let i = 0; i < L.length; i++) L[i].lead = L.length > 1 ? (L[0].dir > 0 ? L[(i + 1) % L.length] : L[(i - 1 + L.length) % L.length]) : null; }
    for (const p of people) if (p.out) personStep(p, dt, t);

    // who is out: fewer by night; someone goes in or comes out only after two seconds out of sight and 50 m away, never in view
    pm4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm4);
    const seen = (x, y, z, r) => { sph.center.set(x, z, -y); sph.radius = r; return frustum.intersectsSphere(sph); };
    for (const p of people) { const w = night > 0.5 ? p.nightOut : true; if (w === p.out) { p.hideT = 0; continue; } const d = Math.hypot(p.x - cdx - cx, p.y - cdy - cy); if (d > 50 && !seen(p.x, p.y, GZ + 1, 1.5)) p.hideT += dt; else p.hideT = 0; if (p.hideT > 2) { p.out = w; p.hideT = 0; if (p.state === 'cross' && p.cross && p.cross.node) p.cross.node.busy[p.cross.strip] = Math.max(0, p.cross.node.busy[p.cross.strip] - 1); if (!w) { p.cross = null; p.state = 'walk'; } } }
    for (const c of cars) { const w = night > 0.5 ? c.nightOut : true; if (w === c.out) { c.hideT = 0; continue; } const d = Math.hypot(c.x - cdx - cx, c.y - cdy - cy); if (d > 60 && !seen(c.x, c.y, GZ + 1, 4)) c.hideT += dt; else c.hideT = 0; if (c.hideT > 2) { c.out = w; c.hideT = 0; c.v = 0; } }

    // draw the nearest; the far edge dissolves
    const px = cdx + cx, py = cdy + cy;
    if ((packT -= dt) <= 0 || Math.hypot(px - packAt.x, py - packAt.y) > 20) { packT = 0.5; packStatics(px, py); }
    const sel = []; for (const p of people) { if (!p.out) continue; const d = Math.hypot(p.x - px, p.y - py); if (d < RP) sel.push([d, p]); }
    if (sel.length > capP) sel.sort((a, b) => a[0] - b[0]);
    const n = Math.min(sel.length, capP), PA = peopleM.instanceMatrix.array, SA = shM.instanceMatrix.array;
    for (let i = 0; i < n; i++) {
      const [d, p] = sel[i], yaw = Math.atan2(p.hx, -p.hy), k = p.h / 1.75, o = i * 4, fade = clamp((RP - d) / 25, 0, 1) * (sel.length > capP ? clamp((capP - i) / 25, 0, 1) : 1);
      put(PA, i, p.x, GZ, -p.y, yaw, p.build * k, k, k);
      PI.G[o] = p.ph; PI.G[o + 1] = p.gait; PI.G[o + 2] = p.pose; PI.G[o + 3] = Math.max(0.001, fade);
      PI.SK[o] = p.skin[0]; PI.SK[o + 1] = p.skin[1]; PI.SK[o + 2] = p.skin[2]; PI.SK[o + 3] = p.hat;
      PI.TP[o] = p.top[0]; PI.TP[o + 1] = p.top[1]; PI.TP[o + 2] = p.top[2]; PI.TP[o + 3] = p.sleeve;
      PI.BT[o] = p.bot[0]; PI.BT[o + 1] = p.bot[1]; PI.BT[o + 2] = p.bot[2]; PI.BT[o + 3] = p.shoe;
      PI.HR[o] = p.hair[0]; PI.HR[o + 1] = p.hair[1]; PI.HR[o + 2] = p.hair[2]; PI.HR[o + 3] = p.long;
      put(SA, i, p.x, GZ + 0.02, -p.y, 0, 0.9 * fade, 1, 0.9 * fade);
    }
    peopleM.count = n; peopleM.instanceMatrix.needsUpdate = true; for (const a of ['aG', 'aSkin', 'aTop', 'aBot', 'aHair']) pg.attributes[a].needsUpdate = true;
    const selC = []; for (const c of cars) { if (!c.out) continue; const d = Math.hypot(c.x - px, c.y - py); if (d < RC) selC.push([d, c]); }
    if (selC.length > capC) selC.sort((a, b) => a[0] - b[0]);
    const m = Math.min(selC.length, capC), CA = carsM.instanceMatrix.array, PO = poolM.instanceMatrix.array; let pools = 0;
    for (let i = 0; i < m; i++) {
      const [d, c] = selC[i], yaw = Math.atan2(c.hx, -c.hy), o = i * 4, fade = clamp((RC - d) / 30, 0, 1);
      put(CA, i, c.x, GZ, -c.y, yaw, 1, 1, 1);
      CI.C[o] = c.col[0]; CI.C[o + 1] = c.col[1]; CI.C[o + 2] = c.col[2]; CI.C[o + 3] = c.kind;
      CI.D[o] = c.len; CI.D[o + 1] = c.w; CI.D[o + 2] = c.rad; CI.D[o + 3] = Math.min(0.999, Math.max(0.001, fade)) + 2 * c.brake;
      put(SA, n + i, c.x, GZ + 0.02, -c.y, yaw, c.w * 1.25 * fade, 1, c.len * 1.15 * fade);
      // its headlights on the road ahead, by night
      if (night > 0.15 && d < 160) { put(PO, pools, c.x + c.hx * (c.len / 2 + 5), GZ + 0.04, -(c.y + c.hy * (c.len / 2 + 5)), yaw, 3.4, 1, 10); poolA[pools * 4] = 0.22 * fade; poolA[pools * 4 + 1] = 1; pools++; }
    }
    carsM.count = m; carsM.instanceMatrix.needsUpdate = true; cg.attributes.aCar.needsUpdate = true; cg.attributes.aDim.needsUpdate = true;
    shM.count = n + m; shM.instanceMatrix.needsUpdate = true;
    // the lamps' pools: the intersections' lamps throw twice the light of the street's (NYC DOT)
    if (night > 0.15 && lampsS.near) for (const e of lampsS.near) { if (pools >= capPool) break; if (e.d > 300) continue; const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw); put(PO, pools, e.x + fx * 1.85, GZ + 0.035, -e.y + fz * 1.85, 0, 18, 1, 18); poolA[pools * 4] = (e.k === 2 ? 0.30 : 0.16) * clamp((320 - e.d) / 60, 0, 1); poolA[pools * 4 + 1] = 0; pools++; }
    poolM.count = pools; poolM.instanceMatrix.needsUpdate = true; poolG.attributes.aPool.needsUpdate = true; poolM.visible = live && pools > 0;
  }
  return { update, people, cars, nodes: nodeList, links, blocks, get drawn() { return { people: peopleM.count, cars: carsM.count, lamps: lampsS.m.count, signals: sigS.m.count, trees: treeS.m.count, pools: poolM.count }; } };
}
