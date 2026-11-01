// A waterfall (Randy, 1 Nov: "It's literally just a sheet of paper"). No shipped waterfall is one sheet. The public breakdowns agree on the parts: separate cascades of different speeds and
// lengths for depth and volume, a broken silhouette, a bright lip, a splash that hides the landing, foam on the pool, mist (Roblox's Create waterfalls with VFX; Filo's Sketch #9 and "How
// we made waterfall in Season" on realtimevfx.com). So each fall here is one draw of many strips:
//   0 the core: a thick sheet that leaves the lip on the arc falling water really takes, bulged across so its sides turn away from the light;
//   1 the veil: thin, wider and in front of it, moving at its own speed, so the two slide over each other;
//   2 the ropes: narrow strands thrown a little further or shorter, breaking the outline and tearing apart on the way down;
//   3 the boil: a low wall of white water where it all lands, hiding the line the water meets the pool on.
// The arc is plain free fall from the river's own speed, so it follows from the place: g, the drop, how fast the river comes over the lip. Where the rock stands in the way, the water runs
// down the rock. Blender coordinates in, three.js out, as world.js's other water.
const G = 9.8;                    // m/s²
const LIP_V = 3.1;                // m/s over the lip (ours: a mountain stream)
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

export function fallStrips(f, opt) {
  const { heightAt, hwAt, lipZ, bot, seed = 4177 } = opt, P = [], A = [], B = [], I = [], W = [], WA = [], WI = [];
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const c = Math.cos(f.yaw || 0), sn = Math.sin(f.yaw || 0), h = lipZ - bot, T = Math.sqrt(2 * h / G);
  const world = (lx, o) => [f.x + lx * c + o * sn, f.y + lx * sn - o * c];
  // how far out from the lip the rock stands at this height: the water can't be nearer the hill than that
  const rockOut = (lx, z, from) => { let o = from; for (; o < 60; o += .25) { const [x, y] = world(lx, o); if (heightAt(x, y) < z - .3) break; } return o; };
  // a strip: nc + 1 across, nr + 1 down
  const strip = (nc, nr, cell) => {
    const base = P.length / 3;
    for (let i = 0; i <= nr; i++) for (let k = 0; k <= nc; k++) { const v = cell(i, k); P.push(v.x, v.z, -v.y); A.push(v.m, v.sd, v.w, v.t); B.push(v.lay, v.ph, v.a, v.sp); }
    for (let i = 0; i < nr; i++) for (let k = 0; k < nc; k++) { const a = base + i * (nc + 1) + k, b = a + nc + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
  };
  // the sheet at one point: from a little up the river, over the lip, down the arc
  const along = (lx, tau, v0, out0, last) => { const z = lipZ - .5 * G * tau * tau, o = Math.max(out0 + v0 * tau, rockOut(lx, z, last)); return { z, o }; };

  // 0 and 1: the core and the veil
  for (const [lay, nc, nr, wide, front, alpha, v0, ph] of [[0, 10, 20, 1, 0, 1, LIP_V, .13], [1, 8, 16, 1.13, .34, .62, LIP_V * 1.12, .61]]) {
    const last = new Float32Array(nc + 1);
    strip(nc, nr, (i, k) => {
      const t = i / nr, tau = T * t, sd = k / nc * 2 - 1, hw = hwAt(t) * wide, lx = sd * hw, { z, o } = along(lx, tau, v0, -.5 + .5 * Math.min(1, t * 8), last[k]);
      last[k] = o;
      const bulge = (1 - sd * sd) * (.34 + .9 * t) + front, oo = o + bulge, [x, y] = world(lx, oo);
      return { x, y, z, m: lipZ - z, sd, w: hw * 2, t, lay, ph, a: alpha, sp: 1 };
    });
  }
  // 2: the ropes
  const ROPES = 9;
  for (let r = 0; r < ROPES; r++) {
    const edge = r < 4, sd0 = edge ? (r % 2 ? 1 : -1) * (.82 + rnd() * .3) : -.8 + 1.6 * (r - 4 + rnd()) / (ROPES - 4), v0 = LIP_V * (.72 + rnd() * .6), wid = .34 + rnd() * .5, end = .62 + rnd() * .38, ph = rnd(), nr = 12, last = [0, 0, 0];
    strip(2, nr, (i, k) => {
      const t = i / nr * end, tau = T * t, sd = k - 1, spread = 1 + t * .9, lx = sd0 * hwAt(t) + sd * wid * .5 * spread, { z, o } = along(lx, tau, v0, -.3, last[k]);
      last[k] = o;
      const oo = o + .55 + (edge ? .2 : .45) * Math.sin(ph * 40 + t * 7), [x, y] = world(lx, oo);
      return { x, y, z, m: lipZ - z, sd, w: wid, t: i / nr, lay: 2, ph, a: 1 - Math.pow(i / nr, 3), sp: .8 + ph * .5 };
    });
  }
  // 3: the boil, a low wall of white water round the line it lands on
  { const nc = 22, nr = 3, ft = opt.foot, hw = hwAt(1) * 1.2, H = 2.3;
    for (const [out, hgt, ph] of [[.2, H, .37], [1.7, H * .62, .77]]) strip(nc, nr, (i, k) => {
      const sd = k / nc * 2 - 1, q = i / nr, lx = sd * hw * (1 + .1 * q), o = ft + out + (1 - sd * sd) * 1.5 + q * .7, [x, y] = world(lx, o);
      return { x, y, z: opt.water - .1 + q * hgt * (1 - .35 * sd * sd), m: q * hgt, sd, w: hw * 2, t: q, lay: 3, ph, a: 1, sp: 1 };
    });
  }
  // the wet rock behind it and beside it: a dark film on the stone, down the rock's own face
  { const nc = 8, nr = 20, last = new Float32Array(nc + 1), wb = W.length / 3;
    for (let i = 0; i <= nr; i++) for (let k = 0; k <= nc; k++) {
      const t = i / nr, z = lipZ - (lipZ - bot) * t, sd = k / nc * 2 - 1, hw = hwAt(t), lx = sd * hw * 1.45, o = rockOut(lx, z, last[k]); last[k] = o;
      const [x, y] = world(lx, o + .05); W.push(x, z + .02, -y); WA.push(t * h, sd, f.w, t);
    }
    for (let i = 0; i < nr; i++) for (let k = 0; k < nc; k++) { const a = wb + i * (nc + 1) + k, b = a + nc + 1; WI.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  return { P, A, B, I, W, WA, WI, T };
}

// the fall's vertex and fragment: strips share one material
export const FALL_V = /* glsl */`
  attribute vec4 aF, aG; uniform float ocTime; varying vec3 vP; varying vec4 vF, vG;
  void main() {
    vec3 p = position;
    if (aG.x > 2.5) { float k = aF.a*(1.0 - .3*aF.y*aF.y); p.y += k*(.4*sin(ocTime*3.1 + aG.y*40.0 + aF.y*9.0) + .24*sin(ocTime*5.3 + aF.y*23.0)); p.x += k*.25*sin(ocTime*2.3 + aF.y*17.0); }
    vP = p; vF = aF; vG = aG; gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.0);
  }`;
export const FALL_F = /* glsl */`
  float lay = vG.x, down = vF.a, across = vF.y, m = vF.x;
  float vv = sqrt(max(m, 0.0))*.55;                                         // the pattern stretches and speeds up as the water does
  float rate = (lay < .5 ? 1.0 : lay < 1.5 ? 1.34 : 1.6)*vG.w;
  float s1 = texture(tOcNoise, vec2(across*vF.z*.085 + vG.y, vv*.30 - t*.42*rate)).b;
  float s2 = texture(tOcNoise, vec2(across*vF.z*.27 + vG.y*3.1, vv*.62 - t*.78*rate)).a;
  float s3 = texture(tOcNoise, vec2(across*vF.z*.96 + vG.y*7.3, vv*1.5 - t*1.55*rate)).b;
  float stream = s1*.46 + s2*.34 + s3*.20;
  vec3 deep = vec3(.030, .075, .072)*(.45 + .55*ocSunGain), clear = mix(vec3(.15, .27, .25), ocHaze, .16)*(.45 + .55*ocSunGain);          // a mountain stream's water: dark bottle green, not the sea's blue
  vec3 foamC = min(ocHaze*1.32 + vec3(.1), vec3(1.0));
  float k = lay > 2.5 ? down : lay > 1.5 ? down*.6 + .3 : smoothstep(.0, .85, down);
  float white = smoothstep(.52 - .17*k, .66 - .12*k, stream + (lay > .5 && lay < 1.5 ? -.06 : 0.0));   // white veins that merge into a curtain as it falls
  vec3 c = mix(deep, clear, smoothstep(.34, .6, s1));
  c = mix(c, foamC, white);
  float side = 1.0 - across*across;                                         // the sheet's sides turn away from the light; it has a body
  c *= lay < 1.5 ? .66 + .40*side : 1.0;
  float sun = clamp(.5 + .5*dot(normalize(vec3(across*.7, .35, 1.0)), normalize(ocSunA)), 0.0, 1.0);
  c *= .84 + .32*sun;
  c += ocSunCol*.12*pow(max(s3 - .5, 0.0)*2.0, 2.0)*(1.0 - down);          // the sun caught in it
  float lipK = lay < .5 ? (1.0 - smoothstep(.0, .05, down))*.0 + smoothstep(.0, .04, down)*(1.0 - smoothstep(.04, .13, down)) : 0.0;
  c = mix(c, foamC, lipK*(.55 + .45*s2));                                   // the bright lip where it turns over
  float edge = 1.0 - smoothstep(.62 - .34*s1, 1.0, abs(across));            // its sides fray
  float alpha;
  if (lay > 2.5) {
    float bn = texture(tOcNoise, vec2(across*vF.z*.14 + vG.y, m*.22 - t*.46)).b*.6 + texture(tOcNoise, vec2(across*vF.z*.41 - t*.05, m*.5 - t*.8)).a*.4;
    float top = smoothstep(1.02, .05, down + (bn - .5)*1.5);
    c = mix(foamC*.86, foamC, smoothstep(.3, .7, bn));
    alpha = top*(1.0 - smoothstep(.72, 1.0, abs(across)))*.95;
  } else if (lay > 1.5) {
    float torn = smoothstep(.34 + .34*down, .58 + .30*down, s2*.6 + s3*.4);
    alpha = (1.0 - abs(across))*2.2*torn*vG.z; alpha = min(alpha, 1.0)*.9; c = mix(c, foamC, .78);
  } else if (lay > .5) alpha = edge*mix(.10, .62, white)*smoothstep(.0, .06, down)*vG.z;
  else alpha = edge*mix(.86, .98, white);
`;
