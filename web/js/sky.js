// The sea's roof and the world above it.
// From below: a wobbling Snell's window with the sun's glare, total internal reflection beyond it.
// From above: real waves, sky and sun. The dome behind everything is the deep water, or the sky when the camera is in the air.
import * as THREE from 'three';
import { breakerAt, BREAK_K, BREAK_W } from './surf.js';

const AIR_GLSL = /* glsl */`
uniform vec3 ocSkyZ, ocSkyH, ocGlowC, ocCloudL, ocCloudM, ocCloudS, ocSeaS, ocSeaD, ocMoon, ocSkyL, ocSkyLC;
uniform float ocSunLow, ocBio, ocStorm, ocBolt, ocGlint, ocCloudIn;
// Stars, each a small round point so nothing shimmers as the view turns. Clouds are drawn over them.
float ocStar(vec3 rd) {
  vec3 p = rd*108.0, i = floor(p), f = p - i;
  float h = fract(sin(dot(i, vec3(12.9898, 78.233, 37.719)))*43758.5453);
  if (h < .90) return 0.0;
  vec3 o = fract(vec3(h*17.1, h*31.7, h*47.3))*.6 + .2;
  return smoothstep(.22, .05, length(f - o))*(.22 + .78*fract(h*91.0));
}
vec3 ocNightSky(vec3 rd, vec3 c, float clouds) {
  float k = ocNight*(1.0 - ocStorm), m = dot(rd, ocMoon);
  if (clouds > .995 && rd.y > 0.0) c += vec3(.74, .82, 1.0)*ocStar(rd)*k*smoothstep(.0, .16, rd.y)*(1.0 - smoothstep(.90, .9995, m));
  if (m > .9) {
    float th2 = (1.0 - m)*2.0, R = mix(.030, .052, ocPaint), R2 = R*R, disc = 1.0 - smoothstep(R2*.90, R2*1.10, th2);
    vec2 uv = (rd.xz - ocMoon.xz)/R*.17;
    float sea = texture(tOcNoise, uv + .37).b*.6 + texture(tOcNoise, uv*2.7).a*.4;
    vec3 face = mix(vec3(1.30, 1.32, 1.36), vec3(.78, .84, .96), smoothstep(.42, .60, sea)*(1.0 - ocPaint*.6));
    c = mix(c, face, disc*k);
    c += vec3(.34, .44, .70)*k*(exp(-th2*900.0)*.30 + exp(-th2*60.0)*.07)*(1.0 - disc);
  }
  return c;
}
vec3 ocRealSky(vec3 rd, float clouds) {
  float y = max(rd.y, 0.0);
  vec3 c = mix(ocSkyH, ocSkyZ, pow(y, .42));
  if (ocNight > .01) c = ocNightSky(rd, c, clouds);
  float mu = max(dot(rd, ocSkyL), 0.0);
  float m2 = mu*mu, m4 = m2*m2, m8 = m4*m4, m32 = m8*m8; m32 *= m32;
  c += ocGlowC*(m8*.16 + m32*.55)*ocGlint;
  if (clouds > 0.0 && rd.y > .015) {
    vec2 q = rd.xz/(rd.y + .16);
    vec2 w1 = ocTime*vec2(.0016, .0009), w2 = ocTime*vec2(-.002, .0014);
    float a = texture(tOcNoise, q*.11 + w1).b, b = texture(tOcNoise, q*.31 + w2).b;
    float n = a*.68 + b*.32, lit = .7;
    if (clouds > .8) {                                                    // the real sky: an eroded edge, and a lit side toward the sun
      n = a*.60 + b*.28 + texture(tOcNoise, q*.97 - w1*2.0).a*.12;
      float toSun = texture(tOcNoise, (q + ocSkyL.xz*.42)*.11 + w1).b*.68 + b*.32;
      lit = clamp(.56 + (n - toSun)*6.0, 0.0, 1.0);
    }
    float cov = smoothstep(.565, .675, n)*smoothstep(.02, .24, rd.y)*min(clouds, 1.0);
    c = mix(c, mix(ocCloudS, ocCloudL, lit), cov*.94);
  }
  float disc = smoothstep(.99955, .99985, mu);
  return c + vec3(1.0, .94, .80)*disc*60.0*(1.0 - ocNight);
}
// A painted sky: a low warm sun on the horizon, teal overhead, and the panorama of cumulus painted at load.
uniform sampler2D tOcClouds;
vec3 ocPaintSky(vec3 rd, float clouds) {
  float y = max(rd.y, 0.0);
  vec3 c = mix(ocSkyH, ocSkyZ, pow(y, .60));
  if (ocNight > .01) c = ocNightSky(rd, c, clouds);
  float mu = max(dot(rd, ocSkyL), 0.0), m2 = mu*mu, m4 = m2*m2, m16 = m4*m4; m16 *= m16;
  float m8 = m4*m4;
  c = mix(c, ocGlowC, (m8*.62 + m16*.3)*(1.0 - smoothstep(.0, .46, y))*ocGlint);
  c += ocGlowC*m16*m16*.85*ocGlint;
  if (clouds > 0.0) {
    vec2 uv = vec2(atan(rd.x, rd.z)/6.2831853 + .5 + ocTime*.00024, y*1.10);
    uv += (vec2(texture(tOcNoise, uv*vec2(5.7, 1.5)).b, texture(tOcNoise, uv*vec2(5.7, 1.5) + .41).a) - .5)*vec2(.009, .022);
    uv += (vec2(texture(tOcNoise, uv*vec2(25.0, 6.9)).a, texture(tOcNoise, uv*vec2(25.0, 6.9) + .19).b) - .5)*vec2(.0026, .0085);   // no painter draws circles
    vec4 t = textureLod(tOcClouds, uv, 0.0);
    // light on the form, coloured by the table; the side toward the sun warmer, the far banks sunk into the sky
    float tn = t.r;
    vec3 col = mix(ocCloudS, ocCloudM, smoothstep(.22, .62, tn));
    col = mix(col, ocCloudL, smoothstep(.60, .96, tn));
    col = mix(col, ocGlowC*1.05, m4*.34*smoothstep(.4, .9, tn)*ocGlint);
    col = mix(col, c, (1.0 - smoothstep(.0, .22, y))*.34);
    c = mix(c, col, smoothstep(.30, .62, t.a)*smoothstep(-.012, .02, rd.y)*ocCloudIn);
  }
  return c;
}
vec3 ocAir(vec3 rd, float clouds) {
  vec3 c;
  if (ocPaint >= 1.0) c = ocPaintSky(rd, clouds);
  else { c = ocRealSky(rd, clouds); if (ocPaint > 0.0) c = mix(c, ocPaintSky(rd, clouds), ocPaint); }
  if (ocStorm > .005) {
    // a low ceiling rolling in over whatever sky there was, lit from inside when lightning goes
    vec2 q = rd.xz/(abs(rd.y) + .2);
    float n = texture(tOcNoise, q*.085 + ocTime*vec2(.0060, .0040)).b*.62 + texture(tOcNoise, q*.26 - ocTime*vec2(.0090, .0050)).a*.38;
    vec3 s = mix(ocCloudS, mix(ocCloudM, ocCloudL, smoothstep(.50, .80, n)), smoothstep(.25, .60, n));
    s = mix(s, ocHaze, exp(-max(rd.y, 0.0)*7.0));
    s += vec3(.75, .80, 1.0)*ocBolt*(.35 + n);
    c = mix(c, s, ocStorm);
  }
  return c;
}`;

const WAVE_GLSL = /* glsl */`
uniform vec4 uW1, uW2, uW3, uW4;
float ocWave(vec2 p, float t) {
  return uW1.w*sin(dot(p, uW1.xy) + t*uW1.z) + uW2.w*sin(dot(p, uW2.xy) + t*uW2.z)
       + uW3.w*sin(dot(p, uW3.xy) + t*uW3.z) + uW4.w*sin(dot(p, uW4.xy) + t*uW4.z);
}
vec2 ocWaveD(vec2 p, float t) {
  return uW1.xy*uW1.w*cos(dot(p, uW1.xy) + t*uW1.z) + uW2.xy*uW2.w*cos(dot(p, uW2.xy) + t*uW2.z)
       + uW3.xy*uW3.w*cos(dot(p, uW3.xy) + t*uW3.z) + uW4.xy*uW4.w*cos(dot(p, uW4.xy) + t*uW4.z);
}`;

// The breakers (Randy, 1 Nov: "we need waves too we can surf"): surf.js breakerAt, the same formula line for line, so the CPU rides the water the GPU draws.
// Each break: A = waterline x, z and the way out to sea; B = half its width along the shore, how far out the swell builds, its height, its phase. Swell sets
// come and go (36 s); it shoals by Green's law from 10 m deep, steepens its shoreward face, and breaks when it stands taller than 0.78 of its depth.
const BREAK_GLSL = /* glsl */`
uniform vec4 ocBrkA[6], ocBrkB[6]; uniform vec2 ocBrkK; uniform float ocBrkN;
float ocBreak(vec2 p, float depth, float t, out float foam) {
  float y = 0.0; foam = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= ocBrkN) break;
    vec4 A = ocBrkA[i], B = ocBrkB[i];
    vec2 r = p - A.xy; float o = dot(r, A.zw), l = -r.x*A.w + r.y*A.z;
    if (o < -4.0 || o > B.y + 10.0 || abs(l) > B.x + 14.0) continue;
    float e = (1.0 - smoothstep(B.x - 18.0, B.x + 12.0, abs(l)))*(1.0 - smoothstep(B.y - 22.0, B.y + 8.0, o))*smoothstep(-3.0, 6.0, o);
    if (e <= 0.0) continue;
    float h = max(depth, .4), set = .42 + .58*pow(.5 + .5*sin(t*.1745 + B.w), 2.0);
    float ash = B.z*set*pow(10.0/max(h, 1.2), .25), Aw = min(ash, .39*h), sig = min(ash/max(.39*h, 1e-3), 1.4), s1 = min(sig, 1.0);
    float phi = ocBrkK.x*o + ocBrkK.y*t + B.w*7.0, g = phi - .7*s1*(1.0 - cos(phi)), f = pow(.5 + .5*cos(g), 1.0 + 2.0*s1);
    y += e*Aw*(2.0*f - .8);
    foam += e*smoothstep(.82, 1.05, sig)*smoothstep(.35, .8, f);
  }
  foam = min(foam, 1.0);
  return y;
}`;

// The camera's lens as a sheet of glass a metre out, so a crossing fills the frame for a beat. >0: that point of the glass is in the air.
const LENS_GLSL = /* glsl */`
uniform float uLensOn;
uniform vec3 uCamF, uCamR, uCamU;
float ocLensS(vec2 ndc) {
  vec3 L = cameraPosition + uCamF + ndc.x*uCamR + ndc.y*uCamU;
  return L.y - ocWave(L.xz, ocTime) + .016*sin(ndc.x*8.0 + ocTime*3.3) + .009*sin(ndc.x*21.0 - ocTime*5.1);
}`;

// Long swells: x, z wave vector (2 pi / wavelength), speed from deep-water dispersion, amplitude in metres.
function wave(dirDeg, lambda, amp) {
  const k = 2 * Math.PI / lambda, a = dirDeg * Math.PI / 180;
  return new THREE.Vector4(Math.cos(a) * k, Math.sin(a) * k, Math.sqrt(9.81 * k), amp);
}

// The cloud painting holds forms, not colours: grey is the light on the form, alpha the cloud. The shader colours it from the look's
// table, so sunset, day and any hour between use one painting. Far banks first, the great towers stacked over them, cirrus above.
// It's a generator: at boot it runs through under the loading screen, and on a live switch it paints a little each frame, then fades in.
function* paintClouds(sunAz, scale) {
  const W = 4096, H = 800, cv = document.createElement('canvas'); cv.width = W * scale; cv.height = H * scale;
  const x = cv.getContext('2d');
  x.scale(scale, scale);
  const g8 = (v) => { const n = Math.round(255 * Math.max(0, Math.min(1, v))); return `${n},${n},${n}`; };
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const puff = (px, py, r, tone, soft = .22, a = 1, sy = 1) => {
    const col = g8(tone);
    x.save(); x.scale(1, sy);
    for (const ox of [0, -W, W]) {
      const qx = px + ox; if (qx + r < 0 || qx - r > W) continue;
      const g = x.createRadialGradient(qx, py / sy, r * (1 - soft), qx, py / sy, r);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g; x.beginPath(); x.arc(qx, py / sy, r, 0, 6.3); x.fill();
    }
    x.restore();
  };
  const sunU = sunAz / 6.2831853 + .5;
  // One cloud: a stack of masses, wide at the foot, each with its own crown of lobes.
  const cumulus = (cx, base, w, h, tiers, far) => {
    let du = cx / W - sunU; du -= Math.round(du);
    const toSun = du > 0 ? -1 : 1;
    const lobes = [];
    for (let k = 0; k < tiers; k++) {
      const t0 = k / tiers, cw = w * (1 - t0 * .66) * (.7 + rnd() * .5), mx = cx + (rnd() - .5) * w * .34 * t0 * 2, my = base - h * (t0 * .86 + .08), mr = h * (.20 - t0 * .05);
      const n = 12 + (rnd() * 9 | 0);
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.2832, d = Math.sqrt(rnd());
        const px = mx + Math.cos(a) * d * cw * .5, py = my + Math.sin(a) * d * mr * .9, r = mr * (.42 + rnd() * .5);
        lobes.push([px, py, r, (base - py) / h]);
      }
    }
    for (let k = 0, m = lobes.length; k < m * 1.6; k++) {              // cauliflower: small lobes on the upper edges
      const l = lobes[Math.floor(rnd() * m)], a = -rnd() * 3.1416, rr = l[2] * (.72 + .36 * rnd());
      lobes.push([l[0] + Math.cos(a) * rr, l[1] + Math.sin(a) * rr, l[2] * (.20 + .24 * rnd()), l[3]]);
    }
    lobes.sort((a, b) => a[3] - b[3]);
    for (const [px, py, r] of lobes) puff(px, py, r, .10, .16);
    x.globalCompositeOperation = 'source-atop';
    const big = lobes.filter(l => l[2] > h * .06);
    // the form's light, built over many soft passes: grey foot, rose body, peach shoulders, cream crowns
    for (const [px, py, r, t] of big) puff(px + toSun * r * .14, py - r * .16, r * 1.10, .30, .55, .9);
    for (const [px, py, r, t] of big) if (t > .10) puff(px + toSun * r * .28, py - r * .30, r * 1.02, .50, .62, .9);
    for (const [px, py, r, t] of big) if (t > .20) puff(px + toSun * r * .42, py - r * .44, r * .90, .70, .68, .85);
    for (const [px, py, r, t] of big) if (t > .28 && rnd() < .8) puff(px + toSun * r * .54, py - r * .56, r * .66, .88, .74, .8);
    for (const [px, py, r, t] of big) if (t > .38 && rnd() < .45) puff(px + toSun * r * .62, py - r * .66, r * .36, 1.0, .8, .75);
    x.globalCompositeOperation = 'source-over';
  };
  // cirrus: long soft combed wisps high up
  for (let i = 0; i < 26; i++) {
    const cx = rnd() * W, cy = 40 + rnd() * 300, L = 200 + rnd() * 420, ang = -.10 + rnd() * .2, n = 16 + (rnd() * 18 | 0), tone = .72 + rnd() * .22;
    for (let k = 0; k < n; k++) { const t = rnd() - .5; puff(cx + t * L, cy + t * L * ang + (rnd() - .5) * 10, 8 + rnd() * 24, tone, .9, .10 + rnd() * .10, .32); }
    yield;
  }
  for (let i = 0; i < 26; i++) { cumulus(rnd() * W, H - 4 - rnd() * 8, 150 + rnd() * 220, 44 + rnd() * 54, 2, 1); yield; }            // the far banks
  for (let i = 0; i < 16; i++) { cumulus(rnd() * W, H - 6 - rnd() * 40, 110 + rnd() * 170, 70 + rnd() * 90, 2, .6); yield; }            // cloudlets low and scattered
  for (let i = 0; i < 13; i++) { cumulus((i + .15 + rnd() * .7) / 13 * W, H - 8 - rnd() * 30, 150 + rnd() * 170, 170 + rnd() * 250, 5, 0); yield; }   // the towers
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.premultiplyAlpha = false;
  t.onUpdate = () => { cv.width = cv.height = 1; t.onUpdate = null; };   // the page's copy goes once the GPU has it
  return t;
}

export function createSky({ scene, look, tier = 'phone', clock = true }) {
  const phone = tier === 'phone';
  const WV = { uW1: { value: wave(18, 41, .36) }, uW2: { value: wave(-33, 23, .22) }, uW3: { value: wave(71, 13, .11) }, uW4: { value: wave(-64, 7.5, .05) } };
  const BRK = { ocBrkA: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) }, ocBrkB: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) }, ocBrkK: { value: new THREE.Vector2(BREAK_K, BREAK_W) }, ocBrkN: { value: 0 } };
  const U = {
    ...look.uniforms, ...WV, ...BRK, uAbove: { value: 0 }, uLensOn: { value: 0 },
    tOcClouds: { value: null }, ocCloudIn: { value: 1 },
    uCamF: { value: new THREE.Vector3(0, 0, -1) }, uCamR: { value: new THREE.Vector3(1, 0, 0) }, uCamU: { value: new THREE.Vector3(0, 1, 0) },
  };

  // ---------------------------------------------------------------- the dome: the deep water, or the sky
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth,
    uniforms: U,
    vertexShader: /* glsl */`
      varying vec3 vD; varying vec4 vClip;
      void main() { vD = position; vec4 p = projectionMatrix*vec4(mat3(viewMatrix)*position, 1.0); gl_Position = p.xyww; vClip = p; }`,
    fragmentShader: /* glsl */`
      varying vec3 vD; varying vec4 vClip; uniform float uAbove;
      ${look.glsl}
      ${AIR_GLSL}
      ${WAVE_GLSL}
      ${LENS_GLSL}
      void main() {
        vec3 rd = normalize(vD);
        vec3 c;
        // Over the waterline on the glass the eye is already in the air, whichever side the camera's centre is on.
        // (Left out, a camera at the surface with a crest over it looked into a dark half dome: the black frames.)
        bool inAir = uAbove > .5 || (uLensOn > .5 && rd.y > -.02 && ocLensS(vClip.xy/vClip.w) > 0.0);
        if (inAir) {
          // the air; below the horizon the water body shows through the surface's blend
          if (rd.y > 0.0) c = mix(ocAir(rd, 1.0), ocHaze, exp(-rd.y*mix(38.0, 3.2, ocFog))*(1.0 - ocPaint*(1.0 - ocFog)));
          else c = mix(ocScatter(rd, 0.0, 400.0), ocHaze, exp(rd.y*5.0));
        } else {
          float d0 = max(-cameraPosition.y, 0.0);
          float len = rd.y > .004 ? min(d0/rd.y, 1600.0) : 1600.0;
          c = ocScatter(rd, max(d0, .4), len);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  dome.frustumCulled = false; dome.renderOrder = 10;   // last of the opaque, so it paints only what nothing covered
  scene.add(dome);

  // ---------------------------------------------------------------- the surface: rings around the camera, finest near it
  function ringGrid(rings, segs, r0, r1) {
    const pos = [], idx = [];
    pos.push(0, 0, 0);
    for (let i = 0; i <= rings; i++) {
      const r = r0 * Math.pow(r1 / r0, i / rings);
      for (let s = 0; s < segs; s++) { const a = (s + (i % 2) * .5) / segs * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
    }
    for (let s = 0; s < segs; s++) idx.push(0, 1 + (s + 1) % segs, 1 + s);
    for (let i = 0; i < rings; i++) for (let s = 0; s < segs; s++) {
      const a = 1 + i * segs + s, b = 1 + i * segs + (s + 1) % segs, c = 1 + (i + 1) * segs + s, d = 1 + (i + 1) * segs + (s + 1) % segs;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }
  const grid = ringGrid(phone ? 46 : 80, phone ? 72 : 128, 1.2, 1800);

  const VS = /* glsl */`
    uniform float ocTime;
    uniform highp sampler2D tOcHeight; uniform vec4 ocMap;
    ${WAVE_GLSL}
    ${BREAK_GLSL}
    varying vec3 vP; varying vec4 vClip; varying vec3 vBrk;
    float ocBedAt(vec2 q) { return texture(tOcHeight, (vec2(q.x - ocMap.x, -q.y - ocMap.y)/ocMap.z + .5)/ocMap.w).r; }
    void main() {
      vec3 p = position + vec3(cameraPosition.x, 0.0, cameraPosition.z);
      float fade = 1.0 - smoothstep(120.0, 620.0, length(position.xz));
      float bed = ocBedAt(p.xz);
      fade *= smoothstep(.0, 5.0, -bed);
      p.y = ocWave(p.xz, ocTime)*fade + .10*sin(ocTime*.55 + p.x*.021 + p.z*.017)*(1.0 - fade) + .05*sin(ocTime*.91 - p.x*.043)*(1.0 - fade);
      // the breakers, and their slope a metre over each way (the bed read again there) for the light, and their foam
      vBrk = vec3(0.0);
      if (ocBrkN > 0.0) {
        float near = 1.0 - smoothstep(320.0, 620.0, length(position.xz)), f0, f1, f2;
        float b0 = ocBreak(p.xz, -bed, ocTime, f0), b1 = ocBreak(p.xz + vec2(1.0, 0.0), -ocBedAt(p.xz + vec2(1.0, 0.0)), ocTime, f1), b2 = ocBreak(p.xz + vec2(0.0, 1.0), -ocBedAt(p.xz + vec2(0.0, 1.0)), ocTime, f2);
        p.y += b0*near; vBrk = vec3(f0, b1 - b0, b2 - b0)*near;
      }
      vP = p;
      gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.0);
      gl_Position.z = min(gl_Position.z, gl_Position.w*.99999);    // the sea runs on past the camera's far plane
      vClip = gl_Position;
      vClip = gl_Position;
    }`;
  const SURF_N = /* glsl */`
    ${WAVE_GLSL}
    varying vec3 vBrk;
    // The surface's normal: swells from the waves, ripples from two drifting layers of the noise tile; flatter with distance.
    vec3 ocSurfN(vec2 p, float dist, float gain) {
      vec2 s = ocWaveD(p, ocTime)*(1.0 - smoothstep(120.0, 620.0, dist)) + vBrk.yz;      // the swell's slope, and the breakers'
      vec2 a = texture(tOcNoise, p*.0610 + ocTime*vec2(.0092, .0061)).rg - .5;
      vec2 b = texture(tOcNoise, p.yx*.1730 + ocTime*vec2(-.0139, .0116)).rg - .5;
      vec2 c = texture(tOcNoise, p*.4100 + ocTime*vec2(.0220, -.0240)).rg - .5;
      float near = 1.0/(1.0 + dist*.012);
      vec2 r = (a*.55 + b*.95*(.35 + .65*near) + c*.8*near*near)*gain*(.45 + .55*near);
      return normalize(vec3(-s.x - r.x, 1.0, -s.y - r.y));
    }`;

  const below = new THREE.Mesh(grid, new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: U, vertexShader: VS,
    fragmentShader: /* glsl */`
      varying vec3 vP; varying vec4 vClip;
      ${look.glsl}
      ${AIR_GLSL}
      ${SURF_N}
      ${LENS_GLSL}
      const float ETA = 1.33;
      void main() {
        if (uLensOn > .5 && ocLensS(vClip.xy/vClip.w) > 0.0) discard;
        vec3 v = vP - cameraPosition;
        float dist = length(v);
        vec3 rd = v/dist;
        float len = dist;
        vec3 n = ocSurfN(vP.xz, dist, .34);
        float cosI = max(dot(rd, n), 0.0);
        float k = 1.0 - ETA*ETA*(1.0 - cosI*cosI);
        float cosT = sqrt(max(k, 0.0));
        float F = mix(1.0, .02 + .98*pow(1.0 - cosT, 5.0), smoothstep(-.12 - dist*.0012, .32 + dist*.0012, k));

        // the mirror: beyond the critical angle the surface shows the sea below
        vec3 R = reflect(rd, -n);
        float d = max(-vP.y, 0.0);
        vec2 uv = (vec2(vP.x - ocMap.x, -vP.z - ocMap.y)/ocMap.z + .5)/ocMap.w;
        float bed = max(-texture(tOcHeight, uv).r, 1.0);
        float rl = bed/max(-R.y, .08);
        vec3 mirror = ocScatter(R, 0.0, rl)*.82;
        vec3 sandL = vec3(.72, .70, .50)*(ocSunCol*.23*exp(-ocKd*bed*1.6) + ocScat*exp(-ocKd*bed)*.6)*exp(-ocKv*rl);
        mirror += sandL;
        mirror *= 1.0 + (n.x*1.3 - n.z*.9)*.9/(1.0 + dist*.02);

        // the window: the whole sky squeezed into a cone of about 97 degrees
        vec3 T = ETA*rd + (cosT - ETA*cosI)*n;
        T = normalize(vec3(T.x, abs(T.y) + .0001, T.z));
        vec3 air = ocAir(T, .7)*2.3*(.22 + .78*smoothstep(.0, .5, cosT));     // (clouds soft: a rippled window shreds a fine edge)
        float mu = max(dot(T, ocSkyL), 0.0);
        float m2 = mu*mu, m4 = m2*m2, m8 = m4*m4, m16 = m8*m8, m64 = m16*m16; m64 *= m64;
        vec3 glare = ocSkyLC*(m16*.45 + m64*3.2 + m64*m64*m64*60.0);
        vec3 c = mix(air + glare, mirror, F);

        // the rim: rays bent to the very edge of the window catch the light
        float rim = smoothstep(.0, .05, k)*(1.0 - smoothstep(.05, .34, k));
        c += vec3(.55, .95, 1.0)*rim*.34;

        c = c*exp(-ocKv*len) + ocScatter(rd, max(-cameraPosition.y, 0.0), len);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  below.frustumCulled = false; below.renderOrder = 9;
  scene.add(below);

  const above = new THREE.Mesh(grid, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    uniforms: U, vertexShader: VS,
    fragmentShader: /* glsl */`
      varying vec3 vP; varying vec4 vClip; uniform sampler2D tOcRefl; uniform float ocReflOn;
      ${look.glsl}
      ${AIR_GLSL}
      ${SURF_N}
      void main() {
        vec3 v = vP - cameraPosition;
        float dist = length(v);
        vec3 rd = v/dist;
        vec3 n = ocSurfN(vP.xz, dist, .21);
        float cosV = max(dot(-rd, n), 0.0);
        float F = .02 + .98*pow(1.0 - cosV, 5.0);
        vec3 R = reflect(rd, n); R.y = abs(R.y) + .001;
        vec3 sky = ocAir(R, .6);
        // the world in the sea (mirror.js): what stands above it, stretched along the line of sight by the waves, more the lower the eye
        if (ocReflOn > .5) { float sinE = max(-rd.y, .08); vec4 rf = texture(tOcRefl, vClip.xy/vClip.w*.5 + .5 + n.xz*vec2(.022, .022/sinE)); sky = mix(sky, rf.rgb, rf.a); }
        float mu = max(dot(R, ocSkyL), 0.0);
        float m2 = mu*mu, m4 = m2*m2, m8 = m4*m4, m16 = m8*m8, m64 = m16*m16, m256 = m64*m64;
        // the sun on the water: close to, a smooth ripple would mirror it as a white blot; it's a thousand small glints
        float glit = texture(tOcNoise, vP.xz*2.3 + ocTime*vec2(.070, -.055)).a*.6 + texture(tOcNoise, vP.zx*.93 - ocTime*vec2(.045, .060)).b*.4;
        float closeK = 1.0 - smoothstep(6.0, 80.0, dist);
        vec3 spec = ocSkyLC*(m256*m256*42.0*mix(1.0, smoothstep(.60, .70, glit)*.12, closeK) + m64*.35*(1.0 - closeK*.8));
        // the body glows from below: scattered light seen from above
        float bed0 = -texture(tOcHeight, (vec2(vP.x - ocMap.x, -vP.z - ocMap.y)/ocMap.z + .5)/ocMap.w).r;
        vec3 body = mix(ocSeaS, ocSeaD, smoothstep(6.0, 80.0, bed0))*(1.0 - F);
        float haze = 1.0 - exp(-dist*(.0021 + ocFog*.022));
        vec3 c = sky*F + spec + body*.62;
        float a = clamp(F + (1.0 - F)*.62 + haze, 0.0, 1.0);
        // the shallows clear over sand; foam runs in and out along the waterline
        float bed = bed0;
        float clearA = smoothstep(.2, 7.0, bed);
        clearA = mix(clearA, max(clearA, smoothstep(.2, 2.6, bed)*.8), smoothstep(5.0, 30.0, cameraPosition.y));      // seen from the air the shallows are water with a colour of their own, not the sand lit up through a pane of glass
        a = mix(F*.9 + .10, a, clearA);
        c = mix(sky*F*.9 + spec + body*.16, c, clearA);
        if (ocPaint > 0.0) {
          // A painted sea: two flat values of teal, strokes lying across the view, the sky on far water, the sun's path in dabs of gold.
          float st1 = texture(tOcNoise, vP.xz*.0097 + ocTime*vec2(.0021, .0012)).b;
          float st2 = texture(tOcNoise, vP.xz*.0470 - ocTime*vec2(.0016, .0030)).a;
          float st3 = texture(tOcNoise, vP.xz*.2100 + ocTime*vec2(.0052, -.0037)).b;
          float st4 = texture(tOcNoise, vP.zx*.6100 - ocTime*vec2(.0091, .0067)).a;
          float nearK = 1.0 - smoothstep(10.0, 90.0, dist);                   // close by the shapes are small and quiet, far off they are broad
          float tone = mix(st1*.58 + st2*.42, st2*.5 + st3*.5, nearK);
          float deepK = smoothstep(.8, 16.0, bed);
          vec3 sea = mix(ocSeaS, ocSeaD, deepK);
          sea = mix(sea*mix(.78, .90, nearK), sea*mix(1.10, 1.04, nearK), smoothstep(.26, .74, tone));
          // the sky lying in the water: more of it the flatter the view, the colour shifting with the angle
          vec3 ps = ocSkyL;
          vec3 mir = normalize(vec3(rd.x, -rd.y, rd.z));
          float pm = max(dot(mir, ps), 0.0), p2 = pm*pm, p4 = p2*p2, p8 = p4*p4, p16 = p8*p8, p64 = p16*p16; p64 *= p64;
          vec3 skyMir = mix(ocSkyH, ocSkyZ, pow(max(mir.y, 0.0), .6));
          skyMir = mix(skyMir, ocGlowC, p8*.7*ocGlint);
          float Fp = pow(1.0 - clamp(-rd.y, 0.0, 1.0), 4.0);
          sea = mix(sea, skyMir, Fp*.74);
          float far = 1.0 - exp(-dist*.0030);
          vec2 ruv = vec2(atan(rd.x + (tone - .5)*.10, rd.z)/6.2831853 + .5 + ocTime*.00024, max(-rd.y, 0.0)*1.10 + (st2 - .5)*.05);
          vec4 rc = textureLod(tOcClouds, ruv, 0.0);
          sea = mix(sea, mix(ocCloudM, ocCloudL, rc.r), smoothstep(.12, .92, rc.a)*Fp*.34*(.55 + .45*smoothstep(.3, .6, st2))*(1.0 - ocStorm));
          // specular dashes on the swell: small, sky-pale, gold down the sun's path
          float dash = smoothstep(.60, .70, mix(st3, st4, nearK)*.68 + st4*.32 + (st2 - .5)*.3);
          float gold = clamp(p8*1.1, 0.0, 1.0)*(.3 + .7*smoothstep(10.0, 70.0, dist))*ocGlint;
          dash *= (.12 + .88*smoothstep(.02, .32, Fp))*smoothstep(.30, .62, st2);        // a glint is a grazing thing: looking down from a hill, the tile mustn't show
          sea = mix(sea, mix(mix(ocSeaS*1.6, ocSkyH, .5), ocGlowC*1.5, gold), dash*(.22 + .68*gold)*(.5 + .5*smoothstep(6.0, 40.0, dist)));
          sea = mix(sea, ocGlowC*1.3, p64*.20*ocGlint);
          c = mix(c, sea, ocPaint);
          a = mix(a, mix(.66, .98, smoothstep(.2, 9.0, bed)), ocPaint);
        }
        float sh = 1.0 - smoothstep(.0, .8, bed + .10*sin(ocTime*.55 + vP.x*.021 + vP.z*.017));     // (a wide flat shore mustn't turn to a field of white)
        if (sh > 0.0) {
          vec2 fp = vP.xz*.21;
          float n1 = texture(tOcNoise, fp + ocTime*vec2(.006, .004)).b, n2 = texture(tOcNoise, fp*3.1 - ocTime*vec2(.011, .007)).a;
          float band = sin(bed*2.6 - ocTime*.8 + n1*7.0)*.5 + .5;
          float foam = sh*smoothstep(.40, .78, n2*.6 + n1*.4 + band*.42 - (1.0 - sh)*.6);
          c = mix(c, mix(vec3(1.25, 1.26, 1.24)*clamp(ocHaze.g*1.25 + .06, 0.0, 1.0), vec3(.24, 1.05, 1.20), ocBio), foam);
          a = max(a, foam*.96);
        }
        if (vBrk.x > .01) {      // a breaker's white water: torn at its edges by the noise, carried with the wave
          vec2 fq = vP.xz*.33;
          float w1 = texture(tOcNoise, fq + ocTime*vec2(.021, .013)).b, w2 = texture(tOcNoise, fq*2.6 - ocTime*vec2(.034, .022)).a;
          float bf = smoothstep(.22, .66, vBrk.x*1.2 + (w1*.6 + w2*.4 - .5)*.85)*(1.0 - smoothstep(55.0, 150.0, dist));
          c = mix(c, vec3(1.22, 1.24, 1.22)*clamp(ocHaze.g*1.25 + .06, 0.0, 1.0), bf);
          a = max(a, bf*.97);
        }
        if (ocBio > 0.0) {
          // the sea lit from within: broad slow drifts, two turned layers so no tile shows, and fine sparks close by where the ripples catch
          vec2 bq = mat2(.80, -.60, .60, .80)*vP.xz;
          float b1 = texture(tOcNoise, bq*.0047 + ocTime*vec2(.0011, .0007)).b*.6 + texture(tOcNoise, vP.zx*.0113 - ocTime*vec2(.0013, .0009)).a*.4;
          float b2 = texture(tOcNoise, bq*.097 - ocTime*vec2(.0070, .0050)).a, b3 = texture(tOcNoise, vP.xz*2.9 + ocTime*vec2(.0310, -.0270)).b, b4 = texture(tOcNoise, vP.zx*4.3 - ocTime*vec2(.0270, .0330)).a;
          float drift = smoothstep(.44, .66, b1), nearB = 1.0/(1.0 + dist*dist*.0009);
          float spark = smoothstep(.70, .84, b3*.55 + b4*.45)*nearB, pulse = .72 + .28*sin(ocTime*1.1 + b1*17.0);
          vec3 glow = (vec3(.015, .34, .46)*(.45 + .55*b2)*pulse + vec3(.20, .90, 1.0)*spark*1.5)*drift*ocBio*(.35 + .65*nearB);
          c += glow; a = max(a, dot(glow, vec3(.5)));
        }
        c = mix(c, ocHaze, haze*haze);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb *= 1.0;
        gl_FragColor.a = a;
      }`,
  }));
  above.frustumCulled = false; above.renderOrder = 15;
  scene.add(above);

  // ---------------------------------------------------------------- the lens: only while a crossing is happening
  const LU = { ...U, uUp: { value: 9 }, uDown: { value: 9 }, uStr: { value: 1 }, uAsp: { value: 1 }, uSunS: { value: new THREE.Vector3() } };
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, uniforms: LU,
    vertexShader: `varying vec2 vN; void main() { vN = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vN;
      uniform float uUp, uDown, uStr, uAsp, uAbove;
      uniform vec3 uSunS;
      ${look.glsl}
      ${AIR_GLSL}
      ${WAVE_GLSL}
      ${LENS_GLSL}
      float h1(float p) { p = fract(p*.1031); p *= p + 33.33; p *= p + p; return fract(p); }
      float h2(vec2 p) { vec3 q = fract(vec3(p.xyx)*.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y)*q.z); }

      // Water left on the glass. Lanes of cells: each cell may hold a bead that clings, then runs, with a smaller trail above it.
      // x: bead, yz: the bead's normal, a spherical cap.
      vec3 ocBeads(vec2 uv, float t, float cols, float seed, float run) {
        vec2 p = uv*vec2(cols, cols*.46);
        float c = floor(p.x);
        p.y += t*run*(.5 + h1(c + seed))*cols*.46 + h1(c*1.7 + seed)*9.0;
        vec2 id = floor(p), f = fract(p) - .5;
        float r0 = h2(id + seed);
        if (r0 < .74) return vec3(0.0);
        float q0 = (r0 - .74)/.26;
        vec2 c0 = vec2((q0 - .5)*.5 + .06*sin(uv.y*19.0 + r0*30.0), (h2(id + 7.0) - .5)*.4);
        float rad = .09 + .30*q0*q0;
        vec2 d = (f - c0)*vec2(1.0, 2.15)/rad;
        float l = dot(d, d);
        float bead = 1.0 - smoothstep(.62, 1.0, l);
        // the tail: narrower beads strung out above the bead as it runs
        float up = f.y - c0.y;
        float tail = run > .01 ? smoothstep(.0, .05, up)*(1.0 - smoothstep(.1, .46, up))*(1.0 - smoothstep(.015, .06, abs(f.x - c0.x)/(1.0 + up*.4))) : 0.0;
        return vec3(max(bead, tail*.55), bead > 0.0 ? d : vec2(0.0, -.4));
      }

      void main() {
        vec2 ndc = vN, uv = ndc*.5 + .5, sq = vec2(uv.x*uAsp, uv.y);
        vec3 rd = normalize(uCamF + ndc.x*uCamR + ndc.y*uCamU);
        vec3 C = vec3(0.0); float A = 0.0;

        // The waterline across the lens, half in, half out.
        if (uLensOn > .5) {
          float s = ocLensS(ndc);
          float under = 1.0 - smoothstep(-.012, .012, s);
          if (uAbove > .5) { C = ocScatter(rd, .4, 22.0) + vec3(.02, .07, .08); A = under*.62; }
          float rim = exp(-s*s/.00024), bend = exp(-(s + .05)*(s + .05)/.0016), veil = exp(-(s - .04)*(s - .04)/.0022);
          C = mix(C, vec3(.012, .085, .115), bend*.66); A = max(A, bend*.66);                        // water climbing the glass bends the sky away
          C = mix(C, vec3(1.05, 1.2, 1.22)*(.82 + .18*sin(ndc.x*33.0 + ocTime*4.0)), rim*.94); A = max(A, rim*.94);   // the bright lip
          C = mix(C, vec3(.75, .92, 1.0), veil*.13); A = max(A, veil*.13);
        }

        // Going up: the sheet falls away, drops run down, the light bursts in.
        if (uUp < 2.4) {
          float t = uUp, fade = 1.0 - smoothstep(1.35, 2.3, t);
          float wob = (texture(tOcNoise, vec2(uv.x*.7, t*.23)).b - .5)*.40 + (texture(tOcNoise, vec2(uv.x*1.9, t*.41)).a - .5)*.08;
          float line = 1.16 - t*3.0*(1.0 + .25*(uv.x - .5)) + wob;
          float e = uv.y - line;                                     // >0 cleared, <0 still sheeted
          float sheet = 1.0 - smoothstep(-.02, .02, e);
          if (sheet > 0.0) {
            float streak = texture(tOcNoise, vec2(uv.x*2.3 + .2, uv.y*.17 + t*.5)).a;
            vec3 film = mix(vec3(.05, .40, .52), vec3(.58, .86, .96), smoothstep(.30, .76, streak));
            float fa = sheet*(.20 + .34*smoothstep(.30, .80, streak));
            C = mix(C, film, fa); A = max(A, fa);
          }
          float lip = exp(-e*e/.0009);
          C = mix(C, vec3(1.0, 1.1, 1.14), lip*.55); A = max(A, lip*.55);
          // rivulets left by the sheet
          float wx = uv.x*5.0 + (texture(tOcNoise, vec2(uv.y*.33, uv.x*.7 + t*.1)).a - .5)*.9;
          float riv = smoothstep(.62, .84, texture(tOcNoise, vec2(wx, uv.y*.10 + t*.42)).b)*(1.0 - smoothstep(.15, .7, t))*smoothstep(.0, .05, e);
          C = mix(C, vec3(.78, .94, 1.0), riv*.24); A = max(A, riv*.24);

          vec2 gv = vec2(sq.x, uv.y);
          vec3 b1 = ocBeads(gv, t, 8.0, 1.3, .34), b2 = ocBeads(gv + .37, t, 15.0, 5.1, .20), b3 = ocBeads(gv + .71, t, 29.0, 9.7, .0);
          vec3 b = b1.x >= b2.x ? b1 : b2; if (b3.x > b.x) b = b3;
          float bead = b.x*fade*smoothstep(.0, .22, t)*uStr;
          if (bead > 0.0) {
            // a drop shows the world upside down: sea at its top, sky at its foot, the sun as a point of light
            vec3 skyC = vec3(.55, .78, 1.0), seaC = vec3(.05, .42, .50);
            float k = smoothstep(-.7, .7, b.z);
            vec3 inner = mix(skyC, seaC, k);
            float dim = dot(b.yz, b.yz);
            inner *= 1.0 - .38*smoothstep(.55, 1.0, dim);
            vec2 hl = b.yz - vec2(-.30, .46);
            inner += vec3(1.0, .97, .9)*exp(-dot(hl, hl)*20.0)*1.2;
            float ba = bead*(.42 + .34*smoothstep(.3, 1.0, dim));
            C = mix(C, inner, ba); A = max(A, ba);
          }

          // the burst: the first second of open air, and the sun in it
          float burst = exp(-t*6.0)*(.6 + .4*uStr);
          vec2 ds = (ndc - uSunS.xy)*vec2(uAsp, 1.0);
          float r = length(ds), ang = atan(ds.y, ds.x);
          float star = (.5 + .5*sin(ang*7.0 + 1.0))*(.5 + .5*sin(ang*13.0 - 2.0));
          float glow = (exp(-r*1.5)*.85 + exp(-r*6.0)*.8 + star*exp(-r*2.6)*.55)*uSunS.z + .14;
          float bA = clamp(burst*glow*1.25, 0.0, 1.0);
          C = mix(C, vec3(1.3, 1.26, 1.14), bA); A = max(A, bA);
        }

        // Going down: white water over the glass, then bubbles racing up it, and the light turning blue.
        if (uDown < 1.8) {
          float t = uDown;
          float n1 = texture(tOcNoise, sq*.55 + vec2(0.0, -t*.32)).b, n2 = texture(tOcNoise, sq*1.7 + vec2(.3, -t*.8)).a;
          float fn = n1*.55 + n2*.45;
          float foam = smoothstep(.40, .56, fn + (.26 - t*1.5))*(1.0 - smoothstep(.20, .52, t))*(.6 + .4*uStr);
          C = mix(C, mix(vec3(.30, .62, .74), vec3(1.0, 1.08, 1.10), smoothstep(.44, .66, fn)), foam); A = max(A, foam*.93);
          float dip = exp(-t*2.6)*.30;
          C = mix(C, vec3(.02, .12, .22), dip*(1.0 - A)); A = max(A, dip);
          for (int L = 0; L < 3; L++) {
            float l = float(L), sc = 4.0 + l*3.5;
            vec2 p = sq*sc + vec2(sin(t*(2.2 + l) + uv.y*7.0)*.05, -t*(1.1 + l*.42)*(1.0 + .5*t));
            vec2 id = floor(p), f = fract(p) - .5;
            float r0 = h2(id + l*7.3);
            if (r0 < .46) continue;
            vec2 c0 = (vec2(h2(id + 3.1), h2(id + 9.7)) - .5)*.5;
            float rad = (.11 + .30*h2(id + 5.3))*(1.0 - .15*l);
            float d = length(f - c0)/rad;
            if (d > 1.05) continue;
            float vis = (1.0 - smoothstep(.75, 1.75, t + r0*.5))*smoothstep(.04, .2, t);
            float ring = smoothstep(.62, .92, d)*(1.0 - smoothstep(.94, 1.04, d));
            vec2 hv = (f - c0)/rad - vec2(-.34, .38);
            float spark = exp(-dot(hv, hv)*18.0);
            float a = (ring*.72 + spark*.95 + .05)*vis;
            C = mix(C, vec3(.80, .96, 1.04), clamp(a, 0.0, 1.0)); A = max(A, clamp(a, 0.0, 1.0));
          }
        }

        gl_FragColor = vec4(C, clamp(A, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  lens.frustumCulled = false; lens.renderOrder = 1000; lens.visible = false;
  scene.add(lens);

  // ---------------------------------------------------------------- rain: streaks in a box that travels with the eye
  const rain = (() => {
    const N = phone ? 700 : 1800, seed = new Float32Array(N * 16), pos = new Float32Array(N * 12), idx = new Uint16Array(N * 6);
    let s0 = 11; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) {
      const a = rnd(), b = rnd(), c = rnd(), d = .75 + rnd() * .5;
      for (let k = 0; k < 4; k++) { const o = i * 4 + k; seed.set([a, b, c, d], o * 4); pos[o * 3] = k & 1 ? 1 : -1; pos[o * 3 + 1] = k >> 1; }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(seed, 4)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { ocTime: U.ocTime, uRain: { value: 0 }, uC: { value: new THREE.Vector3(.5, .55, .6) } },
      vertexShader: /* glsl */`
        attribute vec4 aS; uniform float ocTime, uRain; varying float vA;
        const vec3 BOX = vec3(36.0, 26.0, 36.0);
        void main() {
          vec3 vel = vec3(-6.0, -25.0, 3.5)*aS.w;
          vec3 p = mod(aS.xyz*BOX + vel*ocTime - cameraPosition + BOX*.5, BOX) - BOX*.5 + cameraPosition;
          vec4 a = viewMatrix*vec4(p, 1.0);
          vec3 dir = mat3(viewMatrix)*vel, side = normalize(cross(dir, a.xyz))*(.010 + length(a.xyz)*.0009);
          a.xyz += dir*.040*position.y + side*position.x;
          vA = uRain*(1.0 - abs(position.x))*smoothstep(1.0, 4.0, -a.z)*(1.0 - smoothstep(13.0, 19.0, -a.z));
          gl_Position = projectionMatrix*a;
        }`,
      fragmentShader: /* glsl */`
        varying float vA; uniform vec3 uC;
        void main() { gl_FragColor = vec4(uC*vA, 1.0); }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 900; mesh.visible = false; mesh.name = 'rain';
    scene.add(mesh);
    return mesh;
  })();

  // Sea level under a point, for a breach or a splash.
  const W = [WV.uW1.value, WV.uW2.value, WV.uW3.value, WV.uW4.value], W0 = W.map(v => v.w);
  // the CPU's water is the GPU's: the swell flattening over a shallow bed as the vertex shader does it, and the breakers by the same formula
  let breaks = [], bedAt = null;
  const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function waveAt(x, z) {
    const t = look.uniforms.ocTime.value; let y = 0;
    for (const w of W) y += w.w * Math.sin(x * w.x + z * w.y + t * w.z);
    if (!bedAt) return y;
    const depth = -bedAt(x, -z);
    y *= smooth01(0, 5, depth);
    if (breaks.length) y += breakerAt(breaks, x, z, depth, t);
    return y;
  }
  // for the hero on a board: the face here (0-1), the wave's shoreward speed, its foam
  const brkOut = { foam: 0, face: 0, cx: 0, cz: 0 };
  function breakAt(x, z) { if (!breaks.length || !bedAt) { brkOut.face = brkOut.foam = 0; return brkOut; } breakerAt(breaks, x, z, -bedAt(x, -z), look.uniforms.ocTime.value, brkOut); return brkOut; }
  function setBreakers(list, heightAt) {
    breaks = list || []; bedAt = heightAt || null;
    for (let i = 0; i < 6; i++) { const b = breaks[i]; if (b) { BRK.ocBrkA.value[i].set(b.x, b.z, b.ox, b.oz); BRK.ocBrkB.value[i].set(b.half, b.band, b.amp, b.phase); } }
    BRK.ocBrkN.value = Math.min(6, breaks.length);
  }

  // The crossing: which side the eye is on, how fast it went through, and what the lens does about it.
  let wasUp = false, lastH = null, tUp = 9, tDown = 9, sideT = 9;
  const vF = new THREE.Vector3(), vR = new THREE.Vector3(), vU = new THREE.Vector3(), sunN = new THREE.Vector3();
  function crossed(up, speed) {
    const s = Math.min(1, Math.max(.35, speed / 12));
    LU.uStr.value = s;
    if (up) { tUp = 0; tDown = 9; look.kick(.55 * s); } else { tDown = 0; tUp = 9; look.kick(-.24 * s); }
    look.crossed(up ? 'up' : 'down', speed, s);
  }
  const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true;
  U.tOcClouds.value = blank;

  // ---------------------------------------------------------------- the day and the weather
  // The hour runs 0 to 1: midnight, sunrise at .25, noon, sunset at .75. A day takes 14 minutes. Baked shadows stay where they were baked:
  // only the light's colour and strength move, and the sun and moon on the dome.
  const DAY = 840, ramp = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let hour = clock ? .38 : (look.lookName === 'painted' ? .75 : .5), running = clock, skyTick = 9, bolt = 0, boltIn = 9, seed = 7;
  const wx = { storm: 0, rain: 0, fog: 0, bloom: 0 }, wxTo = { storm: 0, rain: 0, fog: 0, bloom: 0 }, wxOf = {
    calm: { storm: 0, rain: 0, fog: 0, bloom: 0 }, storm: { storm: 1, rain: 1, fog: .12, bloom: 0 }, rain: { storm: .55, rain: .7, fog: .1, bloom: 0 },
    fog: { storm: .2, rain: 0, fog: 1, bloom: 0 }, bloom: { storm: 0, rain: 0, fog: 0, bloom: 1 },
  };
  let wxRate = 1 / 6, wxName = 'calm';
  const SUN_C = new THREE.Vector3(1, .93, .78), MOON_C = new THREE.Vector3(.40, .50, .72), skyW = { day: 1, dusk: 0, night: 0, storm: 0 };
  function setWeather(name, seconds = 6) {
    const t = wxOf[name]; if (!t) return wxName;
    wxName = name; wxRate = 1 / Math.max(seconds, .001);
    for (const k in wxTo) wxTo[k] = t[k];
    return name;
  }
  const isNight = () => hour < .2 || hour > .8;
  function setHour(h, run = running) { hour = ((h % 1) + 1) % 1; running = run; skyTick = 9; }
  function stepSky(dt) {
    if (running) hour = (hour + dt / DAY) % 1;
    let moving = false;
    for (const k in wx) { const d = wxTo[k] - wx[k]; if (d) { wx[k] += Math.sign(d) * Math.min(Math.abs(d), dt * wxRate); moving = true; } }
    skyTick += dt;
    if (bolt > .002) bolt *= Math.exp(-dt * 7.5);
    U.ocBolt.value = bolt;
    // lightning: a stroke now and then while it storms, and a sound hook for it
    if (wx.storm > .6) { boltIn -= dt; if (boltIn < 0) { seed = (seed * 16807) % 2147483647; boltIn = 6 + (seed % 1000) / 1000 * 11; bolt = 1; look.kick(.32); if (api.onBolt) api.onBolt(); } }
    if (skyTick < .25 && !moving) return;
    skyTick = 0;
    const c = hour, night = 1 - ramp(.16, .24, c) + ramp(.76, .84, c), dusk = ramp(.16, .24, c) * (1 - ramp(.26, .36, c)) + ramp(.64, .74, c) * (1 - ramp(.76, .84, c));
    const st = wx.storm;
    skyW.day = (1 - night - dusk) * (1 - st); skyW.dusk = dusk * (1 - st); skyW.night = night * (1 - st * .5); skyW.storm = st * (1 - night * .5);
    look.setSky(skyW);
    U.ocNight.value = night; U.ocStorm.value = st; U.ocFog.value = wx.fog; U.ocBio.value = Math.max(night * .32, wx.bloom);
    const sn = look.sunA, g = Math.abs(1 - 2 * night) * (1 - st * .9), L = U.ocSkyL.value;
    if (night < .5) L.set(sn.x, U.ocSunLow.value, sn.z).normalize(); else L.copy(U.ocMoon.value);
    U.ocGlint.value = g;
    U.ocSkyLC.value.copy(night < .5 ? SUN_C : MOON_C).multiplyScalar(g);
    rain.material.uniforms.uRain.value = wx.rain;
    { const h = U.ocHaze.value; rain.material.uniforms.uC.value.set(h.x * .34 + .02, h.y * .34 + .022, h.z * .34 + .026); }
    const wave = 1 + st * 1.25;
    for (let i = 0; i < 4; i++) W[i].w = W0[i] * wave;
  }
  let painter = null;
  function stepClouds(all) {
    if (U.tOcClouds.value !== blank || U.ocPaint.value <= 0) return;
    painter ||= paintClouds(Math.atan2(look.sunA.x, look.sunA.z), phone ? .34 : 1);      // (the clouds are soft: 3.1 MB at .5 was the most the Painted look cost a phone, and the most Q5 had to give)
    const t0 = performance.now();
    for (;;) {
      const r = painter.next();
      if (r.done) { U.tOcClouds.value = r.value; if (all) look.upload(r.value); else U.ocCloudIn.value = 0; return; }       // (painted in the load, its canvas goes before the next one comes)
      if (!all && performance.now() - t0 > 5) return;
    }
  }
  stepClouds(true);
  look.onRestore(() => { U.tOcClouds.value = blank; painter = null; });  // a lost context took the painting with it: paint it again
  function update(dt, camera) {
    stepSky(dt);
    stepClouds(false);
    if (U.ocCloudIn.value < 1) U.ocCloudIn.value = Math.min(1, U.ocCloudIn.value + dt * 1.2);
    const p = camera.position, h = p.y - waveAt(p.x, p.z);
    const vh = lastH === null || dt <= 0 ? 0 : (h - lastH) / dt; lastH = h;
    sideT += dt; tUp += dt; tDown += dt;
    const up = wasUp ? h > -.03 : h > .03;                       // a little hysteresis: a ripple never flips the world
    if (up !== wasUp) {
      if (Math.abs(vh) > 1.6 && Math.abs(vh) < 60 && sideT > .35) crossed(up, Math.abs(vh));   // a swell washing over the lens at rest is not an event
      wasUp = up; sideT = 0;
    }
    U.uAbove.value = up ? 1 : 0;
    below.visible = !up; above.visible = up;
    rain.visible = up && wx.rain > .01;

    const on = Math.abs(h) < 1.15;
    U.uLensOn.value = on ? 1 : 0;
    lens.visible = on || tUp < 2.4 || tDown < 1.8;
    LU.uUp.value = tUp; LU.uDown.value = tDown;
    if (on || lens.visible) {
      camera.updateMatrixWorld();
      const d = .95, ty = Math.tan(camera.fov * Math.PI / 360), tx = ty * camera.aspect, e = camera.matrixWorld.elements;
      vR.set(e[0], e[1], e[2]); vU.set(e[4], e[5], e[6]); vF.set(-e[8], -e[9], -e[10]);
      U.uCamF.value.copy(vF).multiplyScalar(d); U.uCamR.value.copy(vR).multiplyScalar(d * tx); U.uCamU.value.copy(vU).multiplyScalar(d * ty);
      LU.uAsp.value = camera.aspect;
      sunN.copy(U.ocSkyL.value).multiplyScalar(1000).add(p).project(camera);
      const facing = U.ocSkyL.value.dot(vF);
      LU.uSunS.value.set(sunN.x, sunN.y, (facing > 0 ? 1 : .35) * U.ocGlint.value);
    }
  }
  // For stills and for the game: fire a crossing without moving the camera.
  function testCross(up, speed = 12) { tUp = tDown = 9; crossed(up, speed); }

  look.waveAt = waveAt;                                                // for what floats
  const api = { above, update, waveAt, breakAt, setBreakers, get breaks() { return breaks; }, testCross, dome, below, above, lens, rain, setWeather, isNight, setHour, onBolt: null, get hour() { return hour; }, get weather() { return wxName; } };
  return api;
}
