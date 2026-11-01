// The ocean: one light model shared by everything in the sea.
//   look.patch(material, opts)   adds depth absorption, in-scatter, caustics and the sun's shadow to any three.js lit material
//   look.update(dt, cameraPos) · look.flash(pos, colour, radius, life) · look.setMood(name, seconds) · look.render() · look.resize(w, h)
//
// The water is a closed-form single-scattering integral: the sun fades with depth (ocKd, per channel, red first) and everything fades
// along the view path (ocKv); what is scattered toward the eye along that path is integrated analytically, so a ray that looks up runs
// through brighter water than one that looks down, and no fog here is ever flat. Colours are set by depth, never by hand.
import * as THREE from 'three';
import real from './looks/real.js';
import painted from './looks/painted.js';
import painted_day from './looks/painted_day.js';
import real_dusk from './looks/real_dusk.js';
import real_night from './looks/real_night.js';
import real_storm from './looks/real_storm.js';
import painted_night from './looks/painted_night.js';
import painted_storm from './looks/painted_storm.js';

const NF = 4;                       // flash slots, in every shader

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// A mood is the water's whole state, kept per look in looks/*.js. The region moods blend by the biome the camera is in; 'bossfight'
// and 'victory' sit on top.
const LOOKS = { real, painted, painted_day };
// A look through the day: the table for each hour and for bad weather. sky.js holds the clock and hands look.setSky the weights.
const HOURS = {
  real: { day: real, dusk: real_dusk, night: real_night, storm: real_storm },
  painted: { day: painted_day, dusk: painted, night: painted_night, storm: painted_storm },
  painted_day: { day: painted_day, dusk: painted_day, night: painted_day, storm: painted_day },     // pinned, for stills
};
const INK_TALL = 1.9, INK_FULL = 72, INK_NONE = 120;                   // metres; the CSS px tall where a figure's small-figure line is full, and where it's gone
const NO_WATER = { scat: [1, 1, 1], deep: [1, 1, 1], sun: 1, caus: 1, amb: 1, ex: 1, shaft: 1 }, NO_LIGHT = { sun: [1, 1, 1], hemi: [1, 1, 1] };
const MOOD_KEYS = ['Kd', 'Kv', 'scat', 'deep', 'phase'];
const MOOD_NUMS = ['sun', 'caus', 'amb', 'ex', 'shaft'];

// Skin, in the animal's own space so it travels with the body. ocBody: z of the nose, length, half span, height.
// Frost: ice creeps out from a point over a body, in crystal facets with a cold glow. ocFrostP: origin xyz, amount 0..1.
const FROST_A = /* glsl */`
  float ocFz = 0.0;
  if (ocFrostP.w > 0.0) {
    float n = texture(tOcNoise, vOcP.xz*1.3 + vOcP.y*vec2(.9, -.7)).a*.6 + texture(tOcNoise, vOcP.zy*3.7).b*.4;
    float grow = ocFrostP.w*3.4 - distance(vOcP, ocFrostP.xyz) - n*.9;
    ocFz = smoothstep(.0, .22, grow);
    float vein = 1.0 - smoothstep(.0, .05, abs(n - .5));                     // white fractures through the ice
    vec3 ice = mix(vec3(.52, .78, .96), vec3(.90, .97, 1.0), n);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(ice, vec3(1.0), vein*.7), ocFz*.88);
  }`;
const FROST_N = /* glsl */`
  if (ocFz > 0.0) {
    vec3 ocCell = floor(vOcP*6.5);
    vec3 ocHs = fract(sin(vec3(dot(ocCell, vec3(127.1, 311.7, 74.7)), dot(ocCell, vec3(269.5, 183.3, 246.1)), dot(ocCell, vec3(113.5, 271.9, 124.6))))*43758.5453) - .5;
    normal = normalize(normal + mat3(viewMatrix)*ocHs*1.1*ocFz);             // facets: each small crystal turns its own way
  }`;
const FROST_G = /* glsl */`
  if (ocFz > 0.0) {
    float ocRf = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
    outgoingLight += vec3(.30, .70, 1.0)*ocFz*(ocRf*ocRf*1.5 + .10);
  }`;

const SKIN_COMMON = /* glsl */`
  float ocSL = clamp((ocBody.x - vOcL.z)/ocBody.y, 0.0, 1.0);
  float ocDors = smoothstep(-.42, .42, vOcL.y/(ocBody.w*.5));
  float ocM1 = texture(tOcNoise, vOcL.zx*SC1 + vOcL.y*SC1*.7).a, ocM2 = texture(tOcNoise, (vOcL.zy + vOcL.xx*vec2(.83, -.61))*SC2 + .37).b, ocM3 = texture(tOcNoise, vec2(vOcL.x*1.7 + vOcL.y*1.3, vOcL.z + vOcL.y*.7)*SC3).a;
  float ocMott = smoothstep(.32, .68, ocM1*.6 + ocM2*.4);`;
const SKINS = {
  // mottled grey-blue, pale scars, barnacles on the chin and head, a pale pleated belly
  whale: SKIN_COMMON.replace(/SC1/g, '.042').replace(/SC2/g, '.19').replace(/SC3/g, '.83') + /* glsl */`
  { vec3 skin = diffuseColor.rgb*mix(.58, 1.16, ocMott);
    float fleck = smoothstep(.70, .75, ocM3)*smoothstep(.50, .72, ocM2);
    skin = mix(skin, vec3(.36, .40, .42), fleck*.22);
    float zone = (1.0 - smoothstep(.03, .26, ocSL))*.95;
    float barn = smoothstep(.60, .66, ocM3)*smoothstep(.38, .56, ocM2)*zone;
    skin = mix(skin, vec3(.64, .61, .53)*(.8 + .4*ocM2), clamp(barn*1.3, 0.0, 1.0));
    float fin = smoothstep(.20, .30, abs(vOcL.x)/ocBody.z);
    skin = mix(vec3(.58, .61, .62)*(.80 + .32*ocM2), skin, smoothstep(.10, .46, ocDors + (ocM1 - .5)*.26));
    diffuseColor.rgb = mix(skin, vec3(.075, .095, .115)*(.7 + .7*ocM2), fin); }`,
  // sand-grey above, a white belly with a clean line, fine dermal mottling, darker fin tips
  shark: SKIN_COMMON.replace(/SC1/g, '.34').replace(/SC2/g, '1.1').replace(/SC3/g, '3.1') + /* glsl */`
  { vec3 skin = diffuseColor.rgb*mix(.74, 1.10, ocMott)*(.92 + .16*ocM3);
    skin = mix(vec3(.74, .76, .76)*(.9 + .2*ocM2), skin, smoothstep(.16, .30, ocDors + (ocM1 - .5)*.10));
    diffuseColor.rgb = skin; }`,
  // a real fish: the paint-box colour calmed, a dark back, a silver flank, fine scales catching the light
  fish: SKIN_COMMON.replace(/SC1/g, '4.3').replace(/SC2/g, '11.0').replace(/SC3/g, '23.0') + /* glsl */`
  { vec3 skin = diffuseColor.rgb;
    float l = dot(skin, vec3(.3, .6, .1));
    skin = mix(vec3(l), skin, .66);
    float sc = sin(vOcL.z*140.0 + sin(vOcL.y*120.0)*1.4)*sin(vOcL.y*160.0 + vOcL.z*50.0);
    skin *= 1.0 + sc*.09 + (ocMott - .5)*.22;
    skin = mix(mix(skin, vec3(.80, .84, .86), .46), skin*.56, smoothstep(.18, .86, ocDors));
    diffuseColor.rgb = skin; }`,
  // sleek: a grey cape over a pale flank
  dolphin: SKIN_COMMON.replace(/SC1/g, '.28').replace(/SC2/g, '.9').replace(/SC3/g, '2.6') + /* glsl */`
  { vec3 skin = diffuseColor.rgb*mix(.82, 1.08, ocMott);
    skin = mix(vec3(.70, .72, .74), skin, smoothstep(.10, .34, ocDors + (ocM1 - .5)*.14));
    diffuseColor.rgb = skin; }`,
};

export const OCEAN_GLSL = /* glsl */`
#define NF ${NF}
uniform float ocTime, ocCaus, ocSunGain, ocAmb, ocLamps, ocPulse, ocPaint, ocBrush, ocFog, ocNight;
uniform vec3 ocToneW, ocToneC, ocHaze;
uniform vec4 ocRimC;
uniform vec3 ocKd, ocKv, ocScat, ocDeep, ocSunW, ocSunA, ocSunCol, ocHemi, ocHemiW;
uniform vec2 ocPhase;
uniform vec4 ocSunM, ocShade, ocMap, ocLandM;
uniform highp sampler3D tOcCaustic;
uniform highp sampler2D tOcHeight;
uniform sampler2D tOcSun, tOcNoise, tOcLand, tOcPool, tOcShoal;
uniform vec4 ocFlashP[NF];
uniform vec4 ocFlashC[NF];

// What the water scatters toward the eye along a ray: starts at depth d0, runs len metres.
vec3 ocScatter(vec3 rd, float d0, float len) {
  vec3 A = max(ocKv - ocKd*rd.y, vec3(.0016));
  vec3 I = (1.0 - exp(-A*len))/A*ocKv;
  float mu = max(dot(rd, ocSunW), 0.0);
  float m2 = mu*mu, m4 = m2*m2, m8 = m4*m4;
  float ph = (1.0 + ocPhase.x*m8 + ocPhase.y*m8*m8*m4)*exp(min(rd.y, 0.0)*1.75);
  // Far shafts: light and shade radiating from the sun's place in the water, in everything the view passes through.
  vec3 e = rd - ocSunW*dot(rd, ocSunW);
  vec2 ang = e.xz/(length(e) + .0001);
  float r = texture(tOcNoise, ang*.23 + ocTime*vec2(.0023, -.0014)).a;
  ph *= 1.0 + (smoothstep(.34, .72, r) - .42)*(.30 + m2*.95)*exp(-d0*.024);
  return (ocScat*exp(-ocKd*d0)*ph + ocDeep)*I;
}

// A surface colour seen through the water.
vec3 ocApply(vec3 col, vec3 P) {
  vec3 C = cameraPosition;
  vec3 v = P - C;
  float D = length(v);
  vec3 rd = v/max(D, .001);
  float s0 = 0.0, s1 = D;
  if (C.y > 0.0) s0 = rd.y < -.0001 ? min(C.y/-rd.y, D) : D;           // from the air: the path starts at the surface
  else if (P.y > 0.0) s1 = rd.y > .0001 ? min(-C.y/rd.y, D) : D;       // up out of the water: it ends there
  float len = max(s1 - s0, 0.0);
  col = col*exp(-ocKv*len) + ocScatter(rd, max(-C.y, 0.0), len);
  if (C.y > 0.0) col = mix(col, ocHaze, 1.0 - exp(-min(s0, D)*(.00085 + ocFog*.022)));
  return col;
}

// A meadow's colour field, shared by the ground and the blades: 0 dark and lush .. 1 light and dry, drifting over hundreds of metres.
float ocMeadow(vec2 p) {
  float a = texture(tOcNoise, p*.00187 + .13).a;
  float b = texture(tOcNoise, vec2(p.x*.83 - p.y*.56, p.x*.56 + p.y*.83)*.0073).b;
  float c = texture(tOcNoise, vec2(p.x*.6 + p.y*.8, p.y*.6 - p.x*.8)*.0291).a;
  return a*.50 + b*.34 + c*.16;
}
vec3 ocMeadowTint(vec2 p) {                                            // warm drift to cool drift, far slower than the tile
  float d = texture(tOcNoise, vec2(p.y*.72 + p.x*.69, p.x*.72 - p.y*.69)*.00113 + .4).b;
  return mix(vec3(1.16, 1.04, .70), vec3(.84, 1.0, 1.08), smoothstep(.3, .7, d));
}

// Rock, in the ground and in the rock props alike: beds laid nearly level, each its own tone and lit along its top, split by dark cracks and joints. Both are one stone.
// Where a pixel can't hold a bed it goes to plain rock, so nothing shimmers far off.
float ocRockTone(vec3 P) {
  float w1 = texture(tOcNoise, P.xz*.021 + P.y*.003).a, w2 = texture(tOcNoise, P.zx*.11 + P.y*vec2(.03, -.02)).b;
  float v = (P.y + dot(P.xz, vec2(.035, .055)) + (w1 - .5)*5.0 + (w2 - .5)*1.3)*.62, i = floor(v), f = v - i;
  float h = fract(sin(i*12.9898)*43758.5453), px = max(fwidth(v), .001), lw = max(.022, px*1.1);
  float bed = (1.0 - smoothstep(lw, lw*2.4, min(f, 1.0 - f)))*smoothstep(.36, .56, w2 + h*.28);      // a bed's parting comes and goes: a line all the way round is a contour on a map
  float ac = dot(P.xz, vec2(.77, .64)) + P.y*.2 + h*37.0 + (w2 - .5)*2.4, aj = ac*.27, a = fract(aj), apx = max(min(fwidth(aj), .5), .001), aw = max(.03, apx*1.1);
  float joint = (1.0 - smoothstep(aw, aw*2.4, min(a, 1.0 - a)))*step(.35, fract(h*7.7 + floor(aj)*.37));
  float thin = .95 + .10*sin(v*19.0 + w2*7.0);                                                         // the fine layers inside a bed
  return mix(1.0, (.80 + .38*h)*(.90 + .20*f)*thin*(1.0 - .52*max(bed, joint*.7)), 1.0 - smoothstep(.14, .50, px));
}

// Close to, the deep's own glow falls on what faces you: near rock keeps its surface where no sun reaches.
vec3 ocNear(vec3 P, vec3 N) {
  vec3 V = cameraPosition - P; float d = length(V), k = max(dot(N, V/d), 0.0);
  return ocDeep*9.0*k*k*exp(-d*.05)*(1.0 - smoothstep(-50.0, -22.0, P.y));
}

// What the sea floor's own fires and lanterns throw, from a map of it. Lava lights from below, so undersides and the edges of a form catch it; a lantern lights what stands round it.
vec3 ocPool(vec3 P, vec3 N) {
  if (P.y > -4.0) return vec3(0.0);
  vec2 uv = (vec2(P.x - ocMap.x, -P.z - ocMap.y)/ocMap.z + .5)/ocMap.w;
  vec2 q = texture(tOcPool, uv).rg;
  if (q.x + q.y < .01) return vec3(0.0);
  float h = max(P.y - texture(tOcHeight, uv).r, 0.0), rim = 1.0 - max(dot(N, normalize(cameraPosition - P)), 0.0);
  rim *= rim;
  float flick = .86 + .14*sin(ocTime*2.3 + P.x*.21 + P.z*.17);
  float lava = q.x*exp(-h*.040)*(.60 + .55*max(-N.y, 0.0) + 1.3*rim)*flick, lamp = q.y*exp(-h*.028)*(.60 + .40*max(N.y, 0.0) + .8*rim);
  return vec3(2.6, .56, .10)*lava + vec3(.40, 1.15, .86)*lamp;
}

// The Painted look's light: three tones with soft edges, the edges broken by a brush.
float ocPaintRamp(float x, float b) {
  x += (b - .5)*.20;
  return .34*smoothstep(.20, .27, x) + .40*smoothstep(.45, .52, x) + .26*smoothstep(.74, .81, x);
}
vec3 ocPaintLit(vec3 alb, vec3 N, vec3 P, float depth, float lit, float caus) {
  alb = mix(alb, vec3(dot(alb, vec3(.3, .6, .1))), .10)*.90 + vec3(.052, .048, .062);    // no black in a painting: darks open up, whites settle
  float b = texture(tOcNoise, P.xz*.33 + P.y*vec2(.21, -.17)).a;
  // Near the eye the ramp's edge is a loaded brush: strokes lying across the surface, each a little lighter or darker than the last.
  vec3 ocE = P - cameraPosition;
  float near = (1.0 - smoothstep(16.0, 44.0, length(ocE)))*ocBrush;
  if (near > 0.0) {
    vec2 st = vec2(dot(P.xz, vec2(.71, .71)) + P.y*.6, dot(P.xz, vec2(-.71, .71)) - P.y*.4);
    float s1 = texture(tOcNoise, st*vec2(.31, 1.15)).a, s2 = texture(tOcNoise, st.yx*vec2(.83, .24) + .3).b;
    b = mix(b, s1*.7 + s2*.3, near*.8);
    alb *= 1.0 + ((s1*.6 + s2*.4) - .5)*.46*near;
  }
  vec3 sunDir = P.y > 0.0 ? ocSunA : ocSunW;
  float r = ocPaintRamp(dot(N, sunDir)*.5 + .5, b)*(.30 + .70*lit);
  vec3 fade = exp(-ocKd*depth*.55);
  return mix(alb*ocToneC*.56, alb*ocToneW*1.06*(.82 + .18*caus), r)*ocAmb*(.45 + .55*fade)*ocSunGain + alb*ocDeep*7.0*ocAmb;      // (the deep's own glow: no sun reaches it, and a painting has no black)
}

// The baked, static sun: the depth at which each sun ray first hits something.
float ocSunLit(vec3 P, float depth) {
  if (P.y > 0.0) {                                                     // above the sea: the highest thing on each sun ray, baked once
    vec2 ql = P.xz - ocSunA.xz*(P.y/ocSunA.y);
    float hl = texture(tOcLand, (ql - ocLandM.xy)*ocLandM.zw, .5).r; hl *= hl*140.0;
    return smoothstep(-1.9, .1, P.y - hl);
  }
  vec2 q = P.xz + ocSunW.xz*(depth/ocSunW.y);
  float h = texture(tOcSun, (q - ocSunM.xy)*ocSunM.zw).r; h *= h*300.0;   // stored as a square root: finest where the reef is
  vec2 sq = (q - ocShade.xy)/ocShade.w;
  float shade = 1.0 - .72*exp(-dot(sq, sq))*step(ocShade.z, depth);
  return smoothstep(-1.9, .5, h - depth)*shade;
}

// World-space caustics, two layers, projected along the sun: a multiplier on the sun whose mean is 1. Light that focuses here left
// somewhere else, so the dark between the lines is real too. With depth the web blurs, then is gone by about 60 m.
float ocCausticsRaw(vec3 P, float depth) {
  if (P.y > 0.0 || depth > 66.0) return 1.0;
  vec2 q = P.xz + ocSunW.xz*(depth/ocSunW.y);
  float t = ocTime;
  float blur = .42 + depth*.034;
  float a = texture(tOcCaustic, vec3(q*.1120 + vec2(t*.0060, -t*.0038), t*.078), blur).r*5.0;
  float b = texture(tOcCaustic, vec3(q.yx*vec2(-.0430, .0430) + vec2(-t*.0024, t*.0031), t*.047 + .37), blur + .3).r*5.0;
  float g = 1.0 - smoothstep(4.0, 62.0, depth);
  float m = a*(.46 + .54*b);
  m = mix(m, sqrt(m), .62);
  return 1.0 + (m - 1.0)*g*ocCaus;
}
float ocCaustics(vec3 P, float depth, float facing) {
  return mix(1.0, ocCausticsRaw(P, depth), smoothstep(-.05, .55, facing));
}

vec3 ocFlash(vec3 P) {
  vec3 L = vec3(0.0);
  for (int i = 0; i < NF; i++) {
    if (ocFlashC[i].a <= 0.0) continue;
    vec3 d = P - ocFlashP[i].xyz;
    float a = max(1.0 - dot(d, d)/(ocFlashP[i].w*ocFlashP[i].w), 0.0);
    L += ocFlashC[i].rgb*ocFlashC[i].a*a*a;
  }
  return L;
}

// Close to the eye the water hasn't taken the colours yet: at 3 m a stone keeps its own, whatever the depth.
vec3 ocNearFill(vec3 P, float depth) {
  vec3 v = P - cameraPosition;
  return (1.0 - exp(-ocKd*depth*.9))*exp(-dot(v, v)*.012)*.46;
}

// The water's own glow lights everything, mostly from above.
vec3 ocAmbient(vec3 Nw, float depth) {
  float up = .36 + .64*(Nw.y*.5 + .5);
  vec3 sky = mix(vec3(.64, .71, .80)*ocHemi, mix(vec3(.54, .68, .76)*ocHemiW, ocScat, .30), smoothstep(.0, 1.5, depth));   // in the air, the air's light
  return (sky*exp(-ocKd*depth*.9) + ocDeep*3.0)*up*ocAmb;
}
`;

// ---------------------------------------------------------------- the tile we read for ripples, clouds and macro variation
function periodicField(size, waves, seed, slope) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const f = new Float32Array(size * size), dx = new Float32Array(size * size), dy = new Float32Array(size * size);
  const sx = new Float32Array(size), cx = new Float32Array(size), sy = new Float32Array(size), cy = new Float32Array(size);
  for (let w = 0; w < waves; w++) {
    const ang = rnd() * Math.PI * 2, k = 1 + Math.floor(Math.pow(rnd(), 1.6) * 22);
    const kx = Math.round(Math.cos(ang) * k), ky = Math.round(Math.sin(ang) * k); if (!kx && !ky) continue;
    const a = 1 / Math.pow(Math.hypot(kx, ky), slope), ph = rnd() * 6.283;
    for (let i = 0; i < size; i++) {
      const u = (i / size) * Math.PI * 2;
      sx[i] = Math.sin(kx * u + ph); cx[i] = Math.cos(kx * u + ph); sy[i] = Math.sin(ky * u); cy[i] = Math.cos(ky * u);
    }
    for (let y = 0, o = 0; y < size; y++) for (let x = 0; x < size; x++, o++) {
      const sn = sx[x] * cy[y] + cx[x] * sy[y], cs = cx[x] * cy[y] - sx[x] * sy[y];
      f[o] += a * sn; dx[o] += a * kx * cs; dy[o] += a * ky * cs;
    }
  }
  return { f, dx, dy };
}
function normBytes(a) {
  let lo = 1e9, hi = -1e9; for (let i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; }
  return (i) => Math.round(255 * (a[i] - lo) / (hi - lo));
}
function makeNoiseTexture(size) {
  const w = periodicField(size, 42, 11, 1.25), c = periodicField(size, 54, 29, .95), g = periodicField(size, 48, 47, .8);
  const nx = normBytes(w.dx), ny = normBytes(w.dy), cl = normBytes(c.f), gr = normBytes(g.f);
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { out[i * 4] = nx(i); out[i * 4 + 1] = ny(i); out[i * 4 + 2] = cl(i); out[i * 4 + 3] = gr(i); }
  try { for (const F of [w, c, g]) for (const a of [F.f, F.dx, F.dy]) if (a.buffer.transfer) a.buffer.transfer(0); } catch (e) { /* their memory now, not at a collection the load won't reach; if not, the collector has it */ }
  const t = new THREE.DataTexture(out, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

// A grid for a bake, in typed arrays. PlaneGeometry builds one from plain arrays by push, and three of those were the most the load left behind it: 89 MB of garbage in one task.
// Its vertices and its triangles, without its normals and uvs. flat lays it on the ground (x, z), about cx, cy; otherwise it stands facing the camera (x, y).
function bakeGrid(size, seg, cx, cy, flat) {
  const n = seg + 1, pos = new Float32Array(n * n * 3), idx = new Uint32Array(seg * seg * 6), d = size / seg, r = size / 2;
  for (let j = 0, o = 0; j < n; j++) for (let i = 0; i < n; i++, o += 3) {
    pos[o] = i * d - r + cx;
    if (flat) pos[o + 2] = j * d - r + cy; else pos[o + 1] = r - j * d + cy;
  }
  for (let j = 0, o = 0; j < seg; j++) for (let i = 0; i < seg; i++, o += 6) {
    const a = i + n * j, b = a + n;
    idx[o] = a; idx[o + 1] = b; idx[o + 2] = a + 1; idx[o + 3] = b; idx[o + 4] = b + 1; idx[o + 5] = a + 1;
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

// ---------------------------------------------------------------- caustics: real refraction, baked at start on the GPU
// A periodic wave surface bends a fine grid of sun rays onto the seabed; where the grid folds, light piles up. 32 slices of a loop, in a
// tile that repeats in x, y and time. Each slice stores light/5, so a slice's mean reads about .2 and a mean of 1 is the undisturbed sun.
function bakeCaustics(renderer, tier) {
  const N = tier === 'phone' ? 192 : 256, L = 32, NW = 16, seg = tier === 'phone' ? 300 : 400;
  const rt = new THREE.WebGL3DRenderTarget(N, N, L, {
    format: THREE.RedFormat, type: THREE.UnsignedByteType, depthBuffer: false, generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
  });
  rt.texture.wrapR = THREE.RepeatWrapping;
  let s = 91; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const uW = [], uA = []; let curve2 = 0;
  for (let i = 0; i < NW; i++) {
    const ang = rnd() * 6.283, mag = 2.2 + Math.pow(rnd(), 1.3) * 7;
    const kx = Math.round(Math.cos(ang) * mag), ky = Math.round(Math.sin(ang) * mag); if (!kx && !ky) { i--; continue; }
    const k = Math.hypot(kx, ky), a = 1 / Math.pow(k, 2.05), rate = Math.max(1, Math.round(Math.sqrt(k) * 1.1)) * (rnd() < .5 ? -1 : 1);
    uW.push(new THREE.Vector3(kx, ky, rate)); uA.push(new THREE.Vector2(a, rnd() * 6.283));
    const kk = (2 * Math.PI * k) * (2 * Math.PI * k); curve2 += a * a * kk * kk * .5;
  }
  const uD = 1.12 / Math.sqrt(curve2);
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false, transparent: true, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    uniforms: { uT: { value: 0 }, uD: { value: uD }, uW: { value: uW }, uA: { value: uA } },
    vertexShader: /* glsl */`
      #define NW ${NW}
      #define TAU 6.28318530718
      uniform float uT, uD; uniform vec3 uW[NW]; uniform vec2 uA[NW];
      varying float vI;
      void main() {
        vec2 p = position.xy, g = vec2(0.0);
        float hxx = 0.0, hxy = 0.0, hyy = 0.0;
        for (int i = 0; i < NW; i++) {
          vec2 k = TAU*uW[i].xy;
          float ph = dot(k, p) + uW[i].z*uT + uA[i].y, a = uA[i].x, c = cos(ph), sn = sin(ph);
          g += a*k*c;
          hxx -= a*k.x*k.x*sn; hxy -= a*k.x*k.y*sn; hyy -= a*k.y*k.y*sn;
        }
        vec2 q = p + uD*g;
        float det = (1.0 + uD*hxx)*(1.0 + uD*hyy) - uD*hxy*uD*hxy;
        vI = .2/max(abs(det), .09);
        gl_Position = vec4(q*2.0 - 1.0, 0.0, 1.0);
      }`,
    fragmentShader: `varying float vI; void main() { gl_FragColor = vec4(vI, 0.0, 0.0, 1.0); }`,
  });
  // Drawn at twice the size, then filtered down: the folds stay thin without the grid's stairs.
  const big = new THREE.WebGLRenderTarget(N * 2, N * 2, { format: THREE.RedFormat, type: THREE.UnsignedByteType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  const down = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false, uniforms: { t: { value: big.texture }, px: { value: 1 / (N * 2) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform sampler2D t; uniform float px;
      void main() {
        float c = texture2D(t, vUv).r*.2;
        c += (texture2D(t, vUv + vec2(px, px)).r + texture2D(t, vUv + vec2(-px, px)).r + texture2D(t, vUv + vec2(px, -px)).r + texture2D(t, vUv + vec2(-px, -px)).r)*.2;
        gl_FragColor = vec4(c, 0.0, 0.0, 1.0);
      }`,
  });
  const g = bakeGrid(1.7, seg, .5, .5, false);
  const q = new THREE.Mesh(g, mat); q.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(q);
  const qd = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), down); qd.frustumCulled = false;
  const sd = new THREE.Scene(); sd.add(qd);
  const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget(), auto = renderer.autoClear, col = new THREE.Color(); renderer.getClearColor(col); const al = renderer.getClearAlpha();
  renderer.autoClear = false; renderer.setClearColor(0x000000, 1);
  rt.texture.generateMipmaps = false;
  for (let i = 0; i < L; i++) {
    mat.uniforms.uT.value = i / L * Math.PI * 2;
    renderer.setRenderTarget(big); renderer.clear(); renderer.render(sc, c);
    if (i === L - 1) rt.texture.generateMipmaps = true;
    renderer.setRenderTarget(rt, i); renderer.render(sd, c);
  }
  renderer.setRenderTarget(prev); renderer.autoClear = auto; renderer.setClearColor(col, al);
  g.dispose(); mat.dispose(); down.dispose(); qd.geometry.dispose(); big.dispose();
  return rt;
}

export function createLook({ renderer, scene, camera, tier = 'phone' }) {
  const phone = tier === 'phone';
  let causticRT = null;

  // The tone curve keeps hue: only real highlights run to white, so turquoise stays turquoise.
  THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
    'vec3 CustomToneMapping( vec3 color ) { return color; }',
    /* glsl */`vec3 CustomToneMapping( vec3 color ) {
      color *= toneMappingExposure;
      float pk = max(max(color.r, color.g), color.b) + 1e-5;
      float m = 1.0 - exp(-pk*1.32);
      m = mix(m, m*m*(3.0 - 2.0*m), .42);
      vec3 hue = color/pk;
      float w = smoothstep(.9, 5.0, pk);
      vec3 out_ = mix(hue, vec3(1.0), w*.92)*m;
      if (ocGrade.w > 0.0) {
        // the look's grade: warm lights, cool shadows, a limited ramp, more colour
        vec3 base = out_;
        float l = dot(out_, vec3(.26, .62, .12));
        out_ *= mix(ocGradeC, ocGradeL, smoothstep(.03, .55, l));
        if (ocGrade.z > 0.0) { float v = l*ocGrade.z, f = fract(v); float l2 = (floor(v) + smoothstep(.12, .88, f))/ocGrade.z; out_ *= mix(1.0, l2/max(l, .002), .24); }
        l = dot(out_, vec3(.26, .62, .12));
        out_ = mix(vec3(l), out_, ocGrade.x);
        out_ = mix(out_, clamp((out_ - .46)*ocGrade.y + .46, 0.0, 1.0), smoothstep(.02, .24, l));     // (a contrast that spares the darks: the deep keeps its forms)
        out_ = mix(base, out_, ocGrade.w);
      }
      if (ocRes.x > 0.0) { vec2 vq = gl_FragCoord.xy*ocRes - .5; out_ *= 1.0 - dot(vq, vq)*.42; }
      out_ *= 1.0 + (fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) - .5)*.018;   // no banding in the long blues
      return out_;
    }`).replace('vec3 CustomToneMapping', 'uniform vec2 ocRes;\nuniform vec4 ocGrade;\nuniform vec3 ocGradeL, ocGradeC;\nvec3 CustomToneMapping');
  renderer.toneMapping = THREE.CustomToneMapping;
  renderer.toneMappingExposure = 1;

  // The sun: in the air, then bent by the surface (Snell) into the water.
  const sunA = new THREE.Vector3(.40, .80, .44).normalize();
  const h = new THREE.Vector2(sunA.x, sunA.z).multiplyScalar(1 / 1.33);
  const sunW = new THREE.Vector3(h.x, Math.sqrt(1 - h.lengthSq()), h.y).normalize();

  const black = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType); black.needsUpdate = true;
  const white = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
  white.minFilter = white.magFilter = THREE.LinearFilter; white.needsUpdate = true;

  // The look: `?look=` wins, then what the player saved, then Real.
  const q = new URLSearchParams(location.search);
  const saved = (() => { try { return localStorage.getItem('thalor.look'); } catch (e) { return null; } })();
  let lookName = LOOKS[q.get('look')] ? q.get('look') : LOOKS[saved] ? saved : 'real';
  const L0 = LOOKS[lookName];
  const m0 = L0.moods.reef;
  const U = {
    ocHemi: { value: new THREE.Vector3(1, 1, 1) }, ocHemiW: { value: new THREE.Vector3(1, 1, 1) }, ocInkH: { value: 844 }, ocInkBg: { value: 0 }, ocFog: { value: 0 }, ocNight: { value: 0 }, ocBio: { value: 0 }, ocStorm: { value: 0 }, ocBolt: { value: 0 }, ocGlint: { value: 1 },
    ocMoon: { value: new THREE.Vector3(-.36, .52, .78).normalize() }, ocSkyL: { value: sunA.clone() }, ocSkyLC: { value: new THREE.Vector3(1, .93, .78) },
    ocTime: { value: 0 }, ocCaus: { value: m0.caus }, ocSunGain: { value: 1 }, ocAmb: { value: 1 }, ocLamps: { value: 0 }, ocPulse: { value: 0 },
    ocKd: { value: v3(m0.Kd) }, ocKv: { value: v3(m0.Kv) }, ocScat: { value: v3(m0.scat) }, ocDeep: { value: v3(m0.deep) },
    ocSunW: { value: sunW }, ocSunA: { value: sunA }, ocSunCol: { value: new THREE.Vector3(3.0, 2.82, 2.42) },
    ocPhase: { value: new THREE.Vector2(m0.phase[0], m0.phase[1]) },
    ocSunM: { value: new THREE.Vector4(0, 0, 1 / 2600, 1 / 2600) },
    ocShade: { value: new THREE.Vector4(0, 0, 1e5, 1) },
    ocFrostP: { value: new THREE.Vector4(0, 0, 0, 0) },
    ocLandM: { value: new THREE.Vector4(0, 0, 1 / 2600, 1 / 2600) }, tOcLand: { value: null },
    tOcCaustic: { value: (causticRT = bakeCaustics(renderer, tier)).texture },
    tOcSun: { value: white },
    tOcNoise: { value: makeNoiseTexture(256) }, tOcPool: { value: black }, tOcShoal: { value: black },
    tOcHeight: { value: new THREE.DataTexture(new Float32Array([-100]), 1, 1, THREE.RedFormat, THREE.FloatType) },
    ocMap: { value: new THREE.Vector4(-640, -640, 2.5, 513) },
    ocFlashP: { value: Array.from({ length: NF }, () => new THREE.Vector4(0, 0, 0, 1)) },
    ocFlashC: { value: Array.from({ length: NF }, () => new THREE.Vector4(0, 0, 0, 0)) },
    ocAddGain: { value: phone ? 1 : .5 },
    ocRes: { value: new THREE.Vector2(0, 0) },
    ocShaft: { value: 1 },
    ocPaint: { value: L0.paint }, ocSunLow: { value: L0.sky.sunLow }, ocBrush: { value: L0.brush },
    ocGrade: { value: new THREE.Vector4(1, 1, 0, 0) }, ocGradeL: { value: v3(L0.warm) }, ocGradeC: { value: v3(L0.cool) },
    ocToneW: { value: v3(L0.warm) }, ocToneC: { value: v3(L0.cool) }, ocRimC: { value: new THREE.Vector4(...L0.rim) }, ocHaze: { value: v3(L0.haze) },
    ocSkyZ: { value: v3(L0.sky.zenith) }, ocSkyH: { value: v3(L0.sky.horizon) }, ocGlowC: { value: v3(L0.sky.glow) },
    ocCloudL: { value: v3(L0.sky.cloudLit) }, ocCloudM: { value: v3(L0.sky.cloudMid) }, ocCloudS: { value: v3(L0.sky.cloudShade) },
    ocSeaS: { value: v3(L0.sea.shallow) }, ocSeaD: { value: v3(L0.sea.deep) },
    ocLandSand: { value: v3(L0.land.sand) }, ocLandWet: { value: v3(L0.land.wet) }, ocLandGL: { value: v3(L0.land.grassLit) }, ocLandGD: { value: v3(L0.land.grassDark) },
    ocLandJ: { value: v3(L0.land.jungle) }, ocLandRL: { value: v3(L0.land.rockLit) }, ocLandRD: { value: v3(L0.land.rockDark) }, ocLandP: { value: v3(L0.land.pale) },
  };

  // Scene lights exist so any standard material lights without our help; patch() then fades them by depth.
  const sun = new THREE.DirectionalLight(0xfff2dc, 3.0); sun.position.copy(sunW).multiplyScalar(400); scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9fb8c4, .55); scene.add(hemi);
  const sunBase = sun.color.clone(), hemiBase = hemi.color.clone(), groundBase = hemi.groundColor.clone(), sunMul = new THREE.Vector3(1, 1, 1);

  // A small reflection of the sea so bronze and metal have something to read; patch() fades it with depth.
  function bakeEnv() {
    const s = new THREE.Scene();
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, toneMapped: false, uniforms: { uSun: { value: sunW } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: /* glsl */`
        varying vec3 vD; uniform vec3 uSun;
        void main() {
          vec3 d = normalize(vD);
          float up = d.y*.5 + .5;
          vec3 c = mix(vec3(.004, .035, .075), vec3(.03, .42, .55), smoothstep(.15, .62, up));
          c = mix(c, vec3(.42, 1.05, 1.15), smoothstep(.6, 1.0, up));
          float mu = max(dot(d, uSun), 0.0);
          c += vec3(1.0, .95, .82)*(pow(mu, 10.0)*1.2 + pow(mu, 90.0)*6.0);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const g = new THREE.SphereGeometry(10, 32, 16);
    s.add(new THREE.Mesh(g, m));
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(s, 0, .1, 100, { size: phone ? 128 : 256 });
    pm.dispose(); g.dispose(); m.dispose();
    scene.environment = rt.texture;
  }
  bakeEnv();
  scene.environmentIntensity = 1;
  // A lost context takes what was baked on the GPU with it. three brings back all it holds in memory, and the bakes are run again here.
  const restores = [];
  function onRestore(fn) { restores.push(fn); }
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    causticRT = bakeCaustics(renderer, tier); U.tOcCaustic.value = causticRT.texture;
    bakeEnv();
    for (const f of restores) f();
  });

  // ---------------------------------------------------------------- patching any lit material
  const OC_V = /* glsl */`
    { vec4 ocW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        ocW = instanceMatrix*ocW;
      #endif
      vOcP = (modelMatrix*ocW).xyz; }`;
  const OC_LIGHT = /* glsl */`
    { vec3 ocP = vOcP;
      float ocD = max(-ocP.y, 0.0);
      vec3 ocN = normalize((vec4(normal, 0.0)*viewMatrix).xyz);
      vec3 ocDown = exp(-ocKd*ocD/ocSunW.y)*ocSunGain;
      float ocF = dot(ocN, ocSunW);
      float ocLit = ocSunLit(ocP, ocD);
      float ocCR = 1.0 + (ocCausticsRaw(ocP, ocD*OC_CD) - 1.0)*OC_CG;
      float ocC = mix(1.0, ocCR, smoothstep(-.05, .55, ocF));
      vec3 ocGain = ocDown*ocLit*ocC;
      reflectedLight.directDiffuse *= ocGain;
      reflectedLight.directSpecular *= ocGain;
      vec3 ocFade = exp(-ocKd*ocD*.85);
      reflectedLight.indirectDiffuse *= ocFade;
      reflectedLight.indirectSpecular *= ocFade;
      // Grounded: close to the seabed the water's glow is cut off.
      vec2 ocUv = (vec2(ocP.x - ocMap.x, -ocP.z - ocMap.y)/ocMap.z + .5)/ocMap.w;
      float ocAbove = ocP.y - texture(tOcHeight, ocUv).r;
      float ocG = .42 + .58*smoothstep(0.0, 3.2, ocAbove);
      reflectedLight.indirectDiffuse += diffuseColor.rgb*(ocAmbient(ocN, ocD)*ocG + ocFlash(ocP) + ocNearFill(ocP, ocD));
      // Light thrown back up by sunlit sand: it dances on undersides, on bellies, under arches.
      float ocUnder = max(-ocN.y, 0.0);
      if (ocUnder > 0.0) reflectedLight.indirectDiffuse += diffuseColor.rgb*ocSunCol*.17*ocDown*ocUnder*ocCR*ocCR*smoothstep(46.0, 3.0, ocAbove)*ocAmb;
      OC_WRAP
      if (ocPaint > 0.0) {
        vec3 ocP3 = ocPaintLit(diffuseColor.rgb, ocN, ocP, ocD, ocLit, ocCR);
        float ocRimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
        ocP3 += ocRimC.rgb*ocRimF*ocRimC.a*(.35 + .65*max(ocN.y*.5 + .5, 0.0))*(.4 + .6*diffuseColor.rgb + .3);
        reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, ocP3, ocPaint);
        reflectedLight.indirectDiffuse *= 1.0 - ocPaint;
        reflectedLight.directSpecular *= 1.0 - ocPaint*.75;
        reflectedLight.indirectSpecular *= 1.0 - ocPaint*.75;
      }
      reflectedLight.directDiffuse += (diffuseColor.rgb + .03)*(ocPool(ocP, ocN) + ocNear(ocP, ocN));
    }`;
  const WRAP = /* glsl */`
      { float ocW = clamp((ocF + WRAPK)/(1.0 + WRAPK), 0.0, 1.0);
        reflectedLight.directDiffuse += diffuseColor.rgb*ocSunCol*.32*ocW*ocW*ocDown*ocLit*ocC*vec3(1.0, .78, .72); }`;

  const patchIds = new Map();
  const patchId = (f) => { const t = f.toString(); let i = patchIds.get(t); if (i === undefined) patchIds.set(t, i = patchIds.size); return i; };
  function patch(material, opts = {}) {
    const key = ['ocean', opts.wrap || 0, opts.emissiveAttr || '', opts.key || '', opts.caustic || 1, opts.skin || '', opts.causticDepth || 1, (opts.frost || opts.skinned) ? 'ice' : '', (opts.ink || opts.skinned) ? 'ink' : ''].join('/');
    const before = material.onBeforeCompile;
    const owned = before && before !== THREE.Material.prototype.onBeforeCompile;
    material.onBeforeCompile = function ocean(shader, r) {
      if (owned) before.call(this, shader, r);
      for (const k in U) shader.uniforms[k] = U[k];
      if (opts.uniforms) for (const k in opts.uniforms) shader.uniforms[k] = opts.uniforms[k];
      let vs = shader.vertexShader, fs = shader.fragmentShader;
      vs = 'varying vec3 vOcP;\nuniform float ocTime;\n' + (opts.vertexDecl || '') + '\n' + (opts.vertexPars || '') + '\n' + vs.replace('#include <project_vertex>', opts.vertexExtra || ('#include <project_vertex>' + OC_V));
      if (opts.normalExtra) vs = vs.replace('#include <beginnormal_vertex>', opts.normalExtra);
      if (opts.vertexBend) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + opts.vertexBend);
      if (opts.frost || opts.skinned) {
        shader.uniforms.ocFrostP = U.ocFrostP;
        fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + FROST_A);
        fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FROST_N);
        fs = fs.replace('#include <opaque_fragment>', FROST_G + '\n#include <opaque_fragment>');
        fs = 'uniform vec4 ocFrostP;\n' + fs;
      }
      if (opts.skin) {
        shader.uniforms.ocBody = { value: opts.body || new THREE.Vector4(1, 2, 1, 1) };
        vs = 'varying vec3 vOcL;\n' + vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOcL = position;');
        fs = 'varying vec3 vOcL;\nuniform vec4 ocBody;\n' + fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + SKINS[opts.skin]);
      }
      const wrap = opts.wrap ? WRAP.replace(/WRAPK/g, Number(opts.wrap).toFixed(3)) : '';
      fs = fs.replace('#include <common>', '#include <common>\nvarying vec3 vOcP;\n' + OCEAN_GLSL + (opts.fragmentPars || ''));
      fs = fs.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + OC_LIGHT.replace('OC_WRAP', wrap).replace('OC_CG', Number(opts.caustic || 1).toFixed(3)).replace('OC_CD', Number(opts.causticDepth || 1).toFixed(3)));
      // opts.glow: light of its own. It crosses the water with less loss than reflected light, so gold stays gold at a distance.
      fs = fs.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor.rgb = ocApply(gl_FragColor.rgb, vOcP);' + (opts.glow ? `\n { vec3 ocGlow = vec3(0.0); ${opts.glow} gl_FragColor.rgb += ocGlow*exp(-ocKv.g*length(vOcP - cameraPosition)*.42); }` : ''));
      if (opts.emissiveAttr) {
        vs = `attribute vec4 ${opts.emissiveAttr};\nvarying float vOcEm;\n` + vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n vOcEm = ${opts.emissiveAttr}.g;`);
        fs = 'varying float vOcEm;\n' + fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vOcEm;');
      }
      if (opts.fragmentPost) fs = fs.replace('#include <opaque_fragment>', opts.fragmentPost + '\n#include <opaque_fragment>');
      if (opts.albedo) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + opts.albedo);
      if (opts.normalHook) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + opts.normalHook);
      shader.vertexShader = vs; shader.fragmentShader = fs;
    };
    // A caller may wrap onBeforeCompile after this: its text joins the key, so two different wrappers never share a program.
    let keyFor = null, keyNow = '';                                       // (a small number for the text: three joins this key every time it looks a program up)
    material.customProgramCacheKey = () => { const f = material.onBeforeCompile; if (f !== keyFor) { keyFor = f; keyNow = key + '|' + patchId(f); } return keyNow; };
    material.needsUpdate = true;
    return material;
  }

  // ---------------------------------------------------------------- god rays: sheets that hang along the sun, stopped by what they hit
  const NS = phone ? 40 : 70, SR = 72;
  const shafts = (() => {
    const g = new THREE.InstancedBufferGeometry();
    const seg = 6, pos = [], idx = [];
    for (let i = 0; i <= seg; i++) { const v = i / seg; pos.push(-1, v, 0, 1, v, 0); }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const a = new Float32Array(NS * 4);
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < NS; i++) { a[i * 4] = rnd() * SR * 2; a[i * 4 + 1] = rnd() * SR * 2; a[i * 4 + 2] = 2.2 + rnd() * rnd() * 11; a[i * 4 + 3] = rnd(); }
    g.setAttribute('aS', new THREE.InstancedBufferAttribute(a, 4)); g.instanceCount = NS;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, toneMapped: false, side: THREE.DoubleSide,
      uniforms: { ...U, uR: { value: SR } },
      vertexShader: /* glsl */`
        attribute vec4 aS; uniform float uR, ocTime, ocAddGain, ocShaft;
        uniform vec3 ocSunW, ocKd; uniform vec4 ocSunM; uniform sampler2D tOcSun;
        varying vec3 vC; varying vec2 vQ; varying float vS;
        void main() {
          vec2 rel = mod(aS.xy + vec2(ocTime*.22, ocTime*.13) - cameraPosition.xz + uR, 2.0*uR) - uR;
          vec2 top = cameraPosition.xz + rel;
          float hit = texture(tOcSun, (top - ocSunM.xy)*ocSunM.zw).r; hit *= hit*300.0;
          float span = min(hit, 96.0)/ocSunW.y;
          float v = position.y;
          vec3 P = vec3(top.x, 0.0, top.y) - ocSunW*span*v;
          vec3 side = normalize(cross(ocSunW, cameraPosition - P));
          P += side*position.x*aS.z*(1.0 + v*.5);
          gl_Position = projectionMatrix*viewMatrix*vec4(P, 1.0);
          float d = max(-P.y, 0.0), cam = length(cameraPosition - P);
          float beat = .50 + .28*sin(ocTime*(.17 + .21*aS.w) + aS.w*40.0) + .22*sin(ocTime*(.41 + .3*aS.w) + aS.w*17.0);
          float f = (1.0 - smoothstep(.70*uR, uR, length(rel)))*smoothstep(2.0, 16.0, cam)*smoothstep(0.0, .03, v)*(1.0 - smoothstep(.35, 1.0, v));
          vC = vec3(.85, 1.0, .92)*exp(-ocKd*d*.8)*f*beat*(.095 + .09*aS.w)*ocAddGain*ocShaft*step(cameraPosition.y, .5);
          vQ = vec2(position.x, v); vS = aS.w;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vC; varying vec2 vQ; varying float vS;
        void main() {
          float x = vQ.x, a = 1.0 - x*x; a *= a;
          float y = vQ.y*1.6;
          float s1 = sin(x*4.6 + vS*37.0 + y), s2 = sin(x*8.3 + vS*53.0 - y*1.3), s3 = sin(x*2.4 + vS*11.0);
          float st = max(.66 + .22*s1 + .13*s2 + .2*s3, 0.0);
          gl_FragColor = vec4(vC*a*st, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 20;
    scene.add(mesh);
    return mesh;
  })();

  // ---------------------------------------------------------------- marine snow: one draw, wrapped around the camera in the shader
  const snow = (() => {
    const n = phone ? 900 : 2600, box = 46;
    const a = new Float32Array(n * 3), sd = new Float32Array(n);
    let s = 33; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { a[i * 3] = rnd() * box; a[i * 3 + 1] = rnd() * box; a[i * 3 + 2] = rnd() * box; sd[i] = rnd(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('aSd', new THREE.BufferAttribute(sd, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, toneMapped: false,
      uniforms: { ...U, uBox: { value: box }, uPix: { value: 1 } },
      vertexShader: /* glsl */`
        attribute float aSd;
        uniform float uBox, ocTime, uPix, ocAddGain, ocBio; uniform vec3 ocScat, ocKd, ocSunCol;
        varying vec3 vC; varying float vR;
        void main() {
          float sd = aSd;
          vec3 p = position + vec3(sin(ocTime*.11 + sd*40.0)*1.1, -ocTime*(.05 + .05*sd) + sin(ocTime*.09 + sd*19.0)*.4, cos(ocTime*.13 + sd*23.0)*1.1);
          vec3 rel = mod(p - cameraPosition + .5*uBox, uBox) - .5*uBox;
          vec3 wp = cameraPosition + rel;
          vec4 mv = viewMatrix*vec4(wp, 1.0);
          gl_Position = projectionMatrix*mv;
          float dist = -mv.z;
          float ps = uPix*(.012 + .05*sd*sd)/max(dist, .3);
          gl_PointSize = clamp(ps, 1.8, 12.0);
          float f = (1.0 - smoothstep(.34, .5, length(rel)/uBox))*smoothstep(.4, 2.5, dist);
          float d = max(-wp.y, 0.0);
          vC = (vec3(.12, .17, .18) + ocScat*.30)*exp(-ocKd*d*.75)*f*ocAddGain*step(wp.y, 0.0)*min(1.0, ps/1.8);
          vC += vec3(.05, .62, .78)*ocBio*.5*f*ocAddGain*step(wp.y, 0.0)*step(.55, fract(sd*7.3))*(.6 + .4*sin(ocTime*2.1 + sd*40.0));   // at night some of the snow is alive
          vR = sd;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vC; varying float vR;
        void main() {
          vec2 q = gl_PointCoord*2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard;
          gl_FragColor = vec4(vC*(1.0 - r)*(1.0 - r), 1.0);
        }`,
    });
    const mesh = new THREE.Points(g, m); mesh.frustumCulled = false; mesh.renderOrder = 22;
    scene.add(mesh);
    return mesh;
  })();

  // ---------------------------------------------------------------- flashes: a light in every shader, and a glow in the water
  const flashes = Array.from({ length: NF }, () => ({ age: 1, life: 0, c: new THREE.Color(), r: 1, p: new THREE.Vector3() }));
  const flashGlow = (() => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const a = new THREE.InstancedBufferAttribute(new Float32Array(NF * 4), 4), c = new THREE.InstancedBufferAttribute(new Float32Array(NF * 3), 3);
    a.setUsage(THREE.DynamicDrawUsage); c.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aP', a); g.setAttribute('aC', c); g.instanceCount = NF;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, toneMapped: false,
      uniforms: { ocAddGain: U.ocAddGain },
      vertexShader: /* glsl */`
        attribute vec4 aP; attribute vec3 aC; varying vec3 vC; varying vec2 vQ; uniform float ocAddGain;
        void main() { vec4 mv = viewMatrix*vec4(aP.xyz, 1.0); mv.xy += position.xy*aP.w; gl_Position = projectionMatrix*mv; vC = aC*ocAddGain; vQ = position.xy; }`,
      fragmentShader: `varying vec3 vC; varying vec2 vQ; void main(){ float r = max(1.0 - dot(vQ, vQ), 0.0); gl_FragColor = vec4(vC*r*r*r, 1.0); }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 24; mesh.visible = false;
    scene.add(mesh);
    return mesh;
  })();
  function flash(pos, colour = 0xffffff, radius = 8, life = .35) {
    let f = flashes[0]; for (const x of flashes) if (x.age / Math.max(x.life, 1e-3) > f.age / Math.max(f.life, 1e-3)) f = x;
    f.age = 0; f.life = life; f.r = radius; f.p.copy(pos); f.c.set(colour);
  }

  // ---------------------------------------------------------------- moods
  // The water table in force: a private copy, written in place while a look changes, so a switch allocates nothing once it has settled.
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ACTIVE = clone(L0.moods);
  let lookFrom = null, lookTo = L0, lookK = 1, lookSecs = .7;
  // Every numeric field of a table, flat, in one order: [uniform value, r, g, b...]
  function lookValues(L) {
    return [L.paint, L.grade.sat, L.grade.contrast, L.grade.bands, L.sky.sunLow, L.brush, ...L.warm, ...L.cool, ...L.rim, ...L.haze,
      ...L.sky.zenith, ...L.sky.horizon, ...L.sky.glow, ...L.sky.cloudLit, ...L.sky.cloudMid, ...L.sky.cloudShade, ...L.sea.shallow, ...L.sea.deep,
      ...L.land.sand, ...L.land.wet, ...L.land.grassLit, ...L.land.grassDark, ...L.land.jungle, ...L.land.rockLit, ...L.land.rockDark, ...L.land.pale,
      ...(L.light || NO_LIGHT).sun, ...(L.light || NO_LIGHT).hemi];
  }
  const lookA = new Float32Array(lookValues(L0)), lookB = new Float32Array(lookValues(L0)), lookN = new Float32Array(lookValues(L0));
  function writeLook() {
    const v = lookN; let i = 0;
    const put = (u) => { u.value.set(v[i], v[i + 1], v[i + 2]); i += 3; };
    U.ocPaint.value = v[0]; const sat = v[1], con = v[2], bands = v[3]; U.ocSunLow.value = v[4]; U.ocBrush.value = v[5]; i = 6;
    put(U.ocToneW); U.ocGradeL.value.copy(U.ocToneW.value); put(U.ocToneC); U.ocGradeC.value.copy(U.ocToneC.value);
    U.ocRimC.value.set(v[i], v[i + 1], v[i + 2], v[i + 3]); i += 4; put(U.ocHaze);
    put(U.ocSkyZ); put(U.ocSkyH); put(U.ocGlowC); put(U.ocCloudL); put(U.ocCloudM); put(U.ocCloudS); put(U.ocSeaS); put(U.ocSeaD);
    put(U.ocLandSand); put(U.ocLandWet); put(U.ocLandGL); put(U.ocLandGD); put(U.ocLandJ); put(U.ocLandRL); put(U.ocLandRD); put(U.ocLandP);
    sunMul.set(v[i], v[i + 1], v[i + 2]); i += 3;
    sun.color.setRGB(sunBase.r * sunMul.x, sunBase.g * sunMul.y, sunBase.b * sunMul.z);
    scene.environmentIntensity = v[i + 1];                             // what metal sees goes down with the sky
    U.ocHemi.value.set(v[i], v[i + 1], v[i + 2]); U.ocHemiW.value.set(v[i] ** .8, v[i + 1] ** .8, v[i + 2] ** .8);
    hemi.color.setRGB(hemiBase.r * v[i], hemiBase.g * v[i + 1], hemiBase.b * v[i + 2]); hemi.groundColor.setRGB(groundBase.r * v[i], groundBase.g * v[i + 1], groundBase.b * v[i + 2]);
    U.ocGrade.value.set(sat, con, bands, v[0]);
  }
  // Every table of a look, flat, once, and the weights of the moment. A clock tick writes these in place.
  const flats = {}, skyW = { day: 1, dusk: 0, night: 0, storm: 0 };
  const flatsOf = (name) => (flats[name] ||= Object.fromEntries(Object.keys(HOURS[name]).map(k => [k, new Float32Array(lookValues(HOURS[name][k]))])));
  const waterNow = { scat: [1, 1, 1], deep: [1, 1, 1], sun: 1, caus: 1, amb: 1, ex: 1, shaft: 1 };
  function mixSky() {
    const F = flatsOf(lookName), H = HOURS[lookName];
    for (let i = 0; i < lookB.length; i++) { let v = 0; for (const k in skyW) v += F[k][i] * skyW[k]; lookB[i] = v; }
    for (let c = 0; c < 3; c++) { waterNow.scat[c] = 0; waterNow.deep[c] = 0; }
    waterNow.sun = waterNow.caus = waterNow.amb = waterNow.ex = waterNow.shaft = 0;
    for (const k in skyW) {
      const w = skyW[k], t = H[k].water || NO_WATER;
      for (let c = 0; c < 3; c++) { waterNow.scat[c] += t.scat[c] * w; waterNow.deep[c] += t.deep[c] * w; }
      waterNow.sun += t.sun * w; waterNow.caus += t.caus * w; waterNow.amb += t.amb * w; waterNow.ex += t.ex * w; waterNow.shaft += t.shaft * w;
    }
    if (lookK >= 1) { lookN.set(lookB); writeLook(); writeMoods(1); }
  }
  function setSky(w) { for (const k in skyW) skyW[k] = w[k] || 0; mixSky(); }
  function setLook(name, seconds = .7) {
    const L = LOOKS[name]; if (!L) return lookName;
    lookFrom = lookTo; lookTo = L; lookK = 0; lookSecs = Math.max(seconds, .001); lookName = name;
    lookA.set(lookN); mixSky();
    if (moodTarget) moodTarget = ACTIVE[moodName] || null;
    try { localStorage.setItem('thalor.look', name); } catch (e) { /* storage blocked: the switch still holds for this visit */ }
    return name;
  }
  function writeMoods(k) {
    for (const name in ACTIVE) {
      const a = (lookFrom || lookTo).moods[name], b = lookTo.moods[name], o = ACTIVE[name];
      for (const f of MOOD_KEYS) { const m = waterNow[f]; for (let c = 0; c < o[f].length; c++) o[f][c] = (a[f][c] + (b[f][c] - a[f][c]) * k) * (m ? m[c] : 1); }
      for (const f of MOOD_NUMS) o[f] = (a[f] + (b[f] - a[f]) * k) * waterNow[f];
    }
  }
  function stepLook(dt) {
    if (lookK >= 1) return;
    lookK = Math.min(1, lookK + dt / lookSecs);
    const k = lookK * lookK * (3 - 2 * lookK);
    for (let i = 0; i < lookN.length; i++) lookN[i] = lookA[i] + (lookB[i] - lookA[i]) * k;
    writeLook();
    writeMoods(k);
  }
  let moodName = 'normal', moodT = 0, moodFrom = 0, moodSecs = 1, moodTarget = null;
  const regionKeys = ['reef', 'kelp', 'city', 'trench', 'cinder', 'ice', 'wrack'];
  const region = [1, 0, 0, 0, 0, 0, 0], regionNow = [1, 0, 0, 0, 0, 0, 0];
  const blend = {};
  writeLook();
  function setMood(name, t = 2) {
    moodName = name; moodTarget = ACTIVE[name] || null; moodSecs = Math.max(t, .001);
    moodFrom = moodT;
  }
  function setRegion(w) { for (let i = 0; i < 7; i++) region[i] = w[i] || 0; }
  let lastO = 0;
  function applyMood() {
    for (const k of MOOD_KEYS) { const a = (blend[k] ||= [0, 0, 0]); a[0] = a[1] = a[2] = 0; for (let i = 0; i < 7; i++) { const m = ACTIVE[regionKeys[i]][k]; for (let c = 0; c < m.length; c++) a[c] += m[c] * regionNow[i]; } }
    for (const k of MOOD_NUMS) { let s = 0; for (let i = 0; i < 7; i++) s += ACTIVE[regionKeys[i]][k] * regionNow[i]; blend[k] = s; }
    if (lastTarget && moodT > 0) {
      const t = moodT;
      for (const k of MOOD_KEYS) { const m = lastTarget[k]; for (let c = 0; c < m.length; c++) blend[k][c] += (m[c] - blend[k][c]) * t; }
      for (const k of MOOD_NUMS) blend[k] += (lastTarget[k] - blend[k]) * t;
    }
    U.ocKd.value.set(...blend.Kd); U.ocKv.value.set(...blend.Kv); U.ocScat.value.set(...blend.scat); U.ocDeep.value.set(...blend.deep);
    U.ocPhase.value.set(blend.phase[0], blend.phase[1]);
    U.ocSunGain.value = blend.sun; U.ocAmb.value = blend.amb; U.ocShaft.value = blend.shaft;
    U.ocCaus.value = blend.caus * (camera.position.y > 0 ? .5 : 1);               // from the air the web is seen through a moving surface
    { const w = lastTarget && lastTarget.warm ? moodT : 0; U.ocSunCol.value.set((3.0 + .9 * w) * sunMul.x, (2.82 + .2 * w) * sunMul.y, (2.42 - .55 * w) * sunMul.z); }
    renderer.toneMappingExposure = blend.ex * (1 + kickNow);
  }
  let lastTarget = null, kickNow = 0;

  const tmpC = new THREE.Vector3();
  function update(dt, cameraPos) {
    const cp = cameraPos || camera.position;
    U.ocTime.value += dt;
    stepLook(dt);
    kickNow = kickV; kickV *= Math.exp(-dt * 3.4);
    U.ocPulse.value = .5 + .5 * Math.sin(U.ocTime.value * 1.1);
    const k = 1 - Math.exp(-dt * 1.4);
    for (let i = 0; i < 7; i++) regionNow[i] += (region[i] - regionNow[i]) * k;
    if (moodTarget) { lastTarget = moodTarget; moodT = Math.min(1, moodT + dt / moodSecs); } else moodT = Math.max(0, moodT - dt / moodSecs);
    applyMood();
    let any = false;
    const gp = flashGlow.geometry.attributes.aP, gc = flashGlow.geometry.attributes.aC;
    flashes.forEach((f, i) => {
      if (f.age < f.life) f.age += dt;
      const on = f.age < f.life, q = on ? 1 - f.age / f.life : 0, e = q * q;
      U.ocFlashP.value[i].set(f.p.x, f.p.y, f.p.z, f.r);
      U.ocFlashC.value[i].set(f.c.r * 1.3, f.c.g * 1.3, f.c.b * 1.3, e);
      gp.setXYZW(i, f.p.x, f.p.y, f.p.z, Math.min(f.r, 26) * (.34 + .3 * (1 - q)));
      gc.setXYZ(i, f.c.r * e * .2, f.c.g * e * .2, f.c.b * e * .2);
      any = any || on;
    });
    flashGlow.visible = any;
    if (any) { gp.needsUpdate = true; gc.needsUpdate = true; }
    snow.material.uniforms.uPix.value = renderer.getDrawingBufferSize(tmpV).y * .9;
    stepOutlines(cp);
  }
  const tmpV = new THREE.Vector2();

  // ---------------------------------------------------------------- the frame: one pass on a phone; bloom and a grade on a computer
  // renderer.info is reset by each render, so a composer's last pass hides the scene: this keeps the scene pass's own numbers.
  const passInfo = { calls: 0, triangles: 0, points: 0, lines: 0 };
  function sceneInfo() { const r = renderer.info.render; passInfo.calls = r.calls; passInfo.triangles = r.triangles; passInfo.points = r.points; passInfo.lines = r.lines; }
  function stats() { return { ...passInfo, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: (renderer.info.programs || []).length }; }
  let post = null;
  if (!phone) post = makePost();
  function makePost() {
    const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
    const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    const hdr = new THREE.WebGLRenderTarget(size.x, size.y, { ...rtOpts, depthBuffer: true, samples: 4 });
    const chain = [4, 8, 16, 32, 64].map(d => new THREE.WebGLRenderTarget(Math.max(2, size.x / d | 0), Math.max(2, size.y / d | 0), rtOpts));
    const fsv = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
    const downM = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, toneMapped: false, uniforms: { tSrc: { value: null }, uPx: { value: new THREE.Vector2() }, uHi: { value: 0 } },
      vertexShader: fsv,
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uPx; uniform float uHi;
        void main() {
          vec3 c = texture2D(tSrc, vUv).rgb*.25
            + (texture2D(tSrc, vUv + uPx*vec2(-1,-1)).rgb + texture2D(tSrc, vUv + uPx*vec2(1,-1)).rgb + texture2D(tSrc, vUv + uPx*vec2(-1,1)).rgb + texture2D(tSrc, vUv + uPx*vec2(1,1)).rgb)*.1875;
          if (uHi > .5) { float l = max(max(c.r, c.g), c.b); c *= smoothstep(.75, 2.2, l); c = min(c, vec3(6.0)); }
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const upM = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, toneMapped: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
      uniforms: { tSrc: { value: null }, uPx: { value: new THREE.Vector2() } }, vertexShader: fsv,
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uPx;
        void main() {
          vec3 c = (texture2D(tSrc, vUv + uPx*vec2(-1,-1)).rgb + texture2D(tSrc, vUv + uPx*vec2(1,-1)).rgb + texture2D(tSrc, vUv + uPx*vec2(-1,1)).rgb + texture2D(tSrc, vUv + uPx*vec2(1,1)).rgb)*.25;
          gl_FragColor = vec4(c*.75, 1.0);
        }`,
    });
    const compM = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, toneMapped: true,
      uniforms: { tSrc: { value: hdr.texture }, tBloom: { value: chain[0].texture }, uT: U.ocTime, uUnder: { value: 1 }, ocGrade: U.ocGrade, ocGradeL: U.ocGradeL, ocGradeC: U.ocGradeC, ocRes: U.ocRes },
      vertexShader: fsv,
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D tSrc, tBloom; uniform float uT, uUnder;
        void main() {
          vec2 w = vec2(sin(vUv.y*11.0 + uT*1.1), cos(vUv.x*9.0 + uT*.9))*.0011*uUnder;
          vec2 uv = vUv + w;
          vec3 c = texture2D(tSrc, uv).rgb + texture2D(tBloom, uv).rgb*.55;
          vec2 q = vUv - .5;
          c *= 1.0 - dot(q, q)*.62;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), downM); quad.frustumCulled = false;
    const qs = new THREE.Scene(); qs.add(quad);
    const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(qs, qc); };
    return {
      resize() {
        renderer.getDrawingBufferSize(size);
        hdr.setSize(size.x, size.y);
        [4, 8, 16, 32, 64].forEach((d, i) => chain[i].setSize(Math.max(2, size.x / d | 0), Math.max(2, size.y / d | 0)));
      },
      target: hdr,
      render() {
        renderer.getDrawingBufferSize(tmpV);
        if (tmpV.x !== hdr.width || tmpV.y !== hdr.height) this.resize();
        renderer.setRenderTarget(hdr); renderer.clear(); renderer.render(scene, camera);
        sceneInfo();
        let src = hdr.texture, sx = hdr.width, sy = hdr.height;
        for (let i = 0; i < chain.length; i++) {
          downM.uniforms.tSrc.value = src; downM.uniforms.uPx.value.set(1 / sx, 1 / sy); downM.uniforms.uHi.value = i === 0 ? 1 : 0;
          pass(downM, chain[i]); src = chain[i].texture; sx = chain[i].width; sy = chain[i].height;
        }
        const auto = renderer.autoClear; renderer.autoClear = false;
        for (let i = chain.length - 1; i > 0; i--) {
          upM.uniforms.tSrc.value = chain[i].texture; upM.uniforms.uPx.value.set(.5 / chain[i].width, .5 / chain[i].height);
          pass(upM, chain[i - 1]);
        }
        renderer.autoClear = auto;
        compM.uniforms.uUnder.value = camera.position.y < 0 ? 1 : 0;
        pass(compM, null);
      },
    };
  }
  function render() { if (post) post.render(); else { renderer.render(scene, camera); sceneInfo(); } }
  // The drawing buffer's real size is the one source: a pass is never sized by the ratio twice.
  function resize() {
    renderer.getDrawingBufferSize(tmpV);
    U.ocRes.value.set(phone ? 1 / tmpV.x : 0, phone ? 1 / tmpV.y : 0);   // (on a computer the final pass draws the vignette)
    if (post) post.resize();
  }
  resize();

  // Materials for the powers. Thick water: a body of its own that bends what's behind it (from the ocean's analytic light, no frame read),
  // a bright lip where it turns away, foam on its edges, ripples running along it. Ice: facets, cold light caught inside, a hard rim.
  // Both take { opacity }, and their uniform `uAge` (0..1 over a blow's life) thins them out. They obey the look: a three-tone ramp in Painted.
  const POWER_V = /* glsl */`
    varying vec3 vP, vN; varying vec2 vUv2;
    void main() {
      vec4 w = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        w = instanceMatrix*w;
      #endif
      w = modelMatrix*w;
      vP = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vUv2 = uv;
      gl_Position = projectionMatrix*viewMatrix*w;
    }`;
  function powerMat(fragment, opts) {
    const u = { ...U, uAge: { value: 0 }, uOpacity: { value: opts.opacity ?? 1 }, uTint: { value: new THREE.Color(opts.tint ?? 0xffffff) } };
    return new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexShader: POWER_V, fragmentShader: fragment });
  }
  const POWER_F = /* glsl */`
    varying vec3 vP, vN; varying vec2 vUv2; uniform float uAge, uOpacity; uniform vec3 uTint;
    ${OCEAN_GLSL}
    uniform vec3 ocSeaS, ocSeaD;`;
  const waterMat = (opts = {}) => powerMat(POWER_F + /* glsl */`
    void main() {
      vec3 v = vP - cameraPosition; float dist = length(v); vec3 rd = v/dist;
      float t = ocTime*1.4;
      float a = texture(tOcNoise, vUv2*vec2(2.1, .7) + vec2(-t*.17, t*.11)).r - .5, b = texture(tOcNoise, vUv2*vec2(4.7, 1.9) + vec2(t*.23, -t*.19)).g - .5;
      vec3 n = normalize(vN + vec3(a, b, a - b)*.8);
      if (dot(n, rd) > 0.0) n = -n;
      float nv = clamp(-dot(n, rd), 0.0, 1.0), f = pow(1.0 - nv, 3.0);
      // what lies behind, bent: the sea's own light along the refracted ray
      vec3 bent = refract(rd, n, .75); if (dot(bent, bent) < .01) bent = reflect(rd, n);
      vec3 behind = ocScatter(normalize(bent), max(-vP.y, 0.0), 26.0) + ocSeaS*.25;
      float mu = max(dot(reflect(rd, n), vP.y < 0.0 ? ocSunW : ocSunA), 0.0), m2 = mu*mu, m4 = m2*m2, m16 = m4*m4; m16 *= m16;
      vec3 c = mix(behind*(1.1 + a), mix(vec3(.72, .96, 1.04), vec3(1.0), f), f*.82) + vec3(1.0, .98, .92)*(m16*1.3);
      float foamN = texture(tOcNoise, vUv2*vec2(3.3, 1.2) + vec2(-t*.31, 0.0)).b;
      float foam = smoothstep(.58, .74, foamN + f*.32 + uAge*.2);
      c = mix(c, vec3(1.1, 1.14, 1.16), foam*(.5 + .5*f));
      if (ocPaint > 0.0) { float r = ocPaintRamp(nv, foamN); c = mix(c, mix(ocSeaD*1.3, mix(ocSeaS*1.5, vec3(1.0), f), r)*uTint, ocPaint*.8); }
      float alpha = clamp(mix(.56, .98, f) + foam*.4, 0.0, 1.0)*uOpacity*(1.0 - smoothstep(.6, 1.0, uAge));
      gl_FragColor = vec4(c*uTint, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`, opts);
  const iceMat = (opts = {}) => powerMat(POWER_F + /* glsl */`
    void main() {
      vec3 v = vP - cameraPosition; float dist = length(v); vec3 rd = v/dist;
      // the crystal's own flat faces, whatever the mesh's normals say, each tilted a little by what's frozen inside it
      vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
      n = normalize(n + (texture(tOcNoise, vP.xz*.13 + vP.y*.09).rgb - .5)*.22);
      if (dot(n, rd) > 0.0) n = -n;
      float nv = clamp(-dot(n, rd), 0.0, 1.0), f = pow(1.0 - nv, 2.5);
      // cold light held inside: brighter where the ray runs long through it, cracks of white where the noise folds
      float inner = texture(tOcNoise, vP.xz*.37 + vP.y*.21).a;
      vec3 c = mix(vec3(.08, .28, .56), vec3(.42, .80, 1.02), inner*.65 + nv*.35);
      c = mix(c, vec3(.90, .97, 1.05), f);
      float crack = 1.0 - smoothstep(.0, .035, abs(texture(tOcNoise, vP.zy*.29 + vP.x*.17).b - .5));
      c += vec3(.5, .8, 1.0)*crack*.34;
      float mu = max(dot(reflect(rd, n), vP.y < 0.0 ? ocSunW : ocSunA), 0.0), m2 = mu*mu, m4 = m2*m2, m16 = m4*m4; m16 *= m16;
      c += vec3(.9, .97, 1.0)*m16*m16*2.4;
      if (ocPaint > 0.0) { float r = ocPaintRamp(nv*.5 + inner*.5, inner); c = mix(c, mix(vec3(.16, .42, .74), vec3(.80, .95, 1.05), r), ocPaint*.75); }
      gl_FragColor = vec4(c*uTint, clamp(.80 + f*.2, 0.0, 1.0)*uOpacity*(1.0 - smoothstep(.7, 1.0, uAge)));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`, opts);

  // Frost on one mesh, even if its material is shared: look.setFrost(mesh, 0..1, worldPoint). 0 clears it. Needs a material patched with
  // { skinned: true } or { frost: true }.
  function setFrost(mesh, amount, origin) {
    let f = mesh.userData.ocFrost;
    if (!f) {
      f = mesh.userData.ocFrost = new THREE.Vector4();
      const before = mesh.onBeforeRender, after = mesh.onAfterRender;
      mesh.onBeforeRender = function (r, sc, ca, ge, ma, gr) { U.ocFrostP.value.copy(f); ma.uniformsNeedUpdate = true; before.call(this, r, sc, ca, ge, ma, gr); };
      mesh.onAfterRender = function (r, sc, ca, ge, ma, gr) { U.ocFrostP.value.w = 0; ma.uniformsNeedUpdate = true; after.call(this, r, sc, ca, ge, ma, gr); };
    }
    if (origin) f.set(origin.x, origin.y, origin.z, amount); else f.w = amount;
  }

  // An ink line for a character: the same mesh, inside out, pushed out along its normals, a constant weight on the screen.
  // In the Painted look it's a dark line. In either look, as a figure gets small on the screen, the line turns pale and the body goes dark (patch, for
  // { skinned } or { ink }): a dark shape reads on bright water, its pale edge on dark, so nothing has to guess what lies behind him and he keeps 3:1 on anything.
  const outlines = [];
  function addOutline(mesh) {
    // (in the transparent list, after the sea: a body just under the surface keeps its line when the eye is above it)
    const m = new THREE.MeshBasicMaterial({ color: 0x12222e, side: THREE.BackSide, toneMapped: false, transparent: true });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.ocPaint = U.ocPaint; sh.uniforms.ocInkH = U.ocInkH; sh.uniforms.ocInkBg = U.ocInkBg; 
      sh.vertexShader = 'uniform float ocPaint, ocInkH, ocInkBg;\nvarying float vInkS;\n' + sh.vertexShader.replace('#include <project_vertex>', /* glsl */`
        #include <project_vertex>
        {
          vec3 nv = normalize(normalMatrix*objectNormal);
          float perM = projectionMatrix[1][1]*ocInkH*.5/max(-mvPosition.z, .1), small = 1.0 - smoothstep(${INK_FULL}.0, ${INK_NONE}.0, perM*${INK_TALL.toFixed(1)});
          mvPosition.xyz += nv*max(ocPaint*1.2, small*1.5)/perM;
          gl_Position = projectionMatrix*mvPosition;
          // a small figure keeps its own colours; its line is whatever stands out: dark on sky, bright water and sand, pale in the deep and at night
          vInkS = small*ocInkBg*(1.0 - step(0.0, cameraPosition.y)*(1.0 - step(.3, modelMatrix[3].y)));
        }`);
      sh.fragmentShader = 'varying float vInkS;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(vec3(.004, .010, .018), vec3(.42, .86, 1.0), vInkS);');
    };
    m.customProgramCacheKey = () => 'ink4';
    let o;
    if (mesh.isSkinnedMesh) { o = new THREE.SkinnedMesh(mesh.geometry, m); o.bind(mesh.skeleton, mesh.bindMatrix); o.bindMode = mesh.bindMode; } else o = new THREE.Mesh(mesh.geometry, m);
    o.frustumCulled = false; o.name = (mesh.name || 'mesh') + '_ink'; o.renderOrder = 17; o.visible = false;
    o.position.copy(mesh.position); o.quaternion.copy(mesh.quaternion); o.scale.copy(mesh.scale);
    mesh.parent.add(o); outlines.push(o);
    return o;
  }
  let inkBg = 0; const INK_BG = .125;
  // A hull is a second draw of the whole figure: it's kept only while it can be seen.
  function stepOutlines(cp) {
    const H = U.ocInkH.value = renderer.getSize(tmpV).y, P = camera.projectionMatrix.elements[5], e = tmpC;
    // How bright what lies behind a figure is: the sky, or the water's own light along the view (ocScatter, green, for the middle of the frame). Under a line the ink is pale, over it dark.
    camera.getWorldDirection(tmpC); let bg = U.ocHaze.value.y;
    if (cp.y < 0) {
      const ry = tmpC.y, Kv = U.ocKv.value.y, Kd = U.ocKd.value.y, A = Math.max(Kv - Kd * ry, .0016), mu = Math.max(tmpC.dot(U.ocSunW.value), 0), m2 = mu * mu, m4 = m2 * m2, m8 = m4 * m4;
      bg = (U.ocScat.value.y * Math.exp(Kd * cp.y) * (1 + U.ocPhase.value.x * m8 + U.ocPhase.value.y * m8 * m8 * m4) * Math.exp(Math.min(ry, 0) * 1.75) + U.ocDeep.value.y) * (1 - Math.exp(-A * 70)) / A * Kv * renderer.toneMappingExposure;
    }
    inkBg = bg; U.ocInkBg.value += ((bg < INK_BG ? 1 : 0) - U.ocInkBg.value) * .35;
    for (const o of outlines) {
      const a = o.parent.matrixWorld.elements; e.set(a[12], a[13], a[14]);
      o.visible = U.ocPaint.value > .01 || P * H * .5 / Math.max(e.distanceTo(cp), .1) * INK_TALL < INK_NONE;
    }
  }

  // The surface crossing: a kick of the exposure, and anyone who wants to know (sound, spray): look.onCross((dir, speed, strength) => ...)
  let kickV = 0;
  const crossFns = [];
  const kick = (v) => { kickV = v; };
  const onCross = (fn) => { crossFns.push(fn); };
  const crossed = (dir, speed, s) => { for (const f of crossFns) f(dir, speed, s); };

  // Every program compiled while the page is still loading: a new family seen at 48 m/s must not stall a frame.
  // Every program the scene can ask for, built in the driver's own threads: the page stays free while they link, and this resolves when they've finished.
  // It gives up waiting at 12 s, and the links run on: boot must never hang on a driver.
  // On a computer the scene draws into the HDR target: three builds a different program for a target (no tone mapping, linear output), so the programs are asked for there.
  function precompile() {
    const was = renderer.getRenderTarget();
    if (post) renderer.setRenderTarget(post.target);
    const done = renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(was);
    return Promise.race([done, new Promise((r) => setTimeout(r, 12000))]);
  }

  // Later bakes publish their results through these.
  U.tOcLand.value = black;
  function setSunMap(texture, m) { U.tOcSun.value = texture; U.ocSunM.value.copy(m); }
  function setLandMap(texture, m) { U.tOcLand.value = texture; U.ocLandM.value.copy(m); }

  return { get inkBg() { return inkBg; }, bakeGrid, upload: (t) => renderer.initTexture(t), causticRT, uniforms: U, tier, stats, precompile, kick, onCross, crossed, addOutline, setFrost, waterMat, iceMat, setLook, setSky, onRestore, skyTable: (n) => LOOKS[n].sky, get lookName() { return lookName; }, looks: Object.keys(LOOKS), patch, update, flash, setMood, setRegion, render, resize, setSunMap, setLandMap, glsl: OCEAN_GLSL, sunA, sunW, sun, hemi, shafts, snow, setLandMap };
}
