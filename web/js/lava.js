// The lava itself: the rivers of fireisle.js and the crater's lake, one draw. Pipeline/research/WORLD_SOURCES.md.
// Colour is temperature, from USGS's table: red below 1073 K, orange to 1273 K, yellow above; fresh lava is about 1443 K. A crust forms in seconds and thickens with the square root of time, so a river is molten at the vent and further down it's dark plates with hot seams, which is what the footage shows. The plates ride the flow: their coordinate along the river is time, so where it runs steep they stretch into the streaks of a lava fall.
import * as THREE from 'three';
import { lavaLines, FIRE_HILL, chan, ISLE } from './fireisle.js';

// the surface: Pipeline/research/LAVA_SOURCES.md. A rigid raft down the middle, two shear belts, lanes that each slide at their own speed, chevrons bowed downstream, cracks that open under strain and shut under compression
const LAVA_SURFACE = /* glsl */`
void lavaSurface(vec3 V, vec3 Ng, out vec3 glow, out float crustAlbedo, out float rough, out float h) {
  // 1. The belts wander slowly: width and bends are the mesh's job, this only keeps them from being parallel
  float k0 = vF.z;
  float n = vL.x + (k0 - .5)*.20, a = abs(n);

  // 2. Across the channel: a rigid raft down the middle, sluggish margins, all the shear in two belts between them
  float x = clamp((.80 - a)/.64, 0.0, 1.0);
  float tear = 4.0*x*(1.0 - x);              // shear rate: where the crust gets torn off

  // 3. Shear lanes: lenses bounded by discrete shears. Each lane slides rigidly, so nothing distorts and nothing needs a crossfade
  float g = max(a - .16, 0.0)*12.0, lane = floor(g), fg = g - lane;
  float xl = clamp((.80 - (.16 + (lane + .5)/12.0))/.64, 0.0, 1.0), ul = a < .16 ? 1.0 : mix(.05, 1.0, xl*xl*(3.0 - 2.0*xl));
  float off = fract((lane + 1.0)*.618 + step(0.0, n)*.27)*37.0;
  float y = (vL.y - ocTime*ul)*UREF + off;

  // 4. Fish-scale cells across the flow and folds a metre apart, both bowed downstream at the middle (the chevrons)
  float m = n*vL.w;
  vec2 q = vec2(m, y + .50*n*n*vL.w);
  vec4 p = texture(tLava, q*vec2(.14, .26));
  float fold = texture(tLava, q*vec2(.045, .065) + vec2(.31, .77)).b;

  // 5. How far a crack stands open: strain opens it, compression shuts it, a low eye sees only its far wall
  float NoV = max(abs(dot(Ng, V)), .05), slant = sqrt(1.0/(NoV*NoV) - 1.0);
  float open = clamp(.03 + .10*tear + .30*max(vF.x, 0.0) - .03*max(-vF.x, 0.0), .015, .46);
  float crack = (1.0 - smoothstep(open*.5, open, p.r))*clamp(1.0 - .45*slant, .18, 1.0);
  float hair = (1.0 - smoothstep(0.0, .14, min(fg, 1.0 - fg)))*smoothstep(.56, .70, a)*smoothstep(-.1, .55, sin((vL.z - ocTime*ul*UREF)*.17 + lane*2.4));
  float e = abs(vL.x), lip = (1.0 - smoothstep(0.0, .45/vL.w, abs(e - .985)))*smoothstep(.30, .62, k0);

  // 6. Everything visible is skin age, seconds this bit of surface has been in the air (Hon: 700 C at 60 s, 450 C at 5 min)
  float belt = smoothstep(.05, .75, tear + (p.a - .5)*.55), ridge = smoothstep(.30, .80, fold*(.55 + .75*p.r));
  float body = min(vL.y, mix(vL.y, 22.0, belt));            // a torn belt never gets old
  float mesh = max(belt, 1.0 - smoothstep(18.0, 60.0, vL.y));   // young lava is all mesh, older only where it is torn
  float skin = body*mix(1.0, mix(1.6, .40, ridge), mesh)*(.9 + .2*p.g);
  skin = mix(skin, .9, max(crack, hair*.85));
  skin = mix(skin, .35, lip);
  float fallS = mix(16.0, 3.2, 1.0 - a*a)*mix(.72, 2.6, smoothstep(.40, .78, p.a));
  skin = mix(skin, fallS, vF.y);                            // a fall: a hot core, orange-red edges, long soft veins of what has already cooled
  float far = smoothstep(.12, .5, fwidth(q.y)*.26);         // the threads have gone under a pixel: their light stays, or a far river goes dark
  skin = mix(skin, body*.62, far*(1.0 - vF.y));
  float at = clamp(log2(skin + .25)*.095 + .2, 0.0, 1.0);
  vec3 r = texture(tRamp, vec2(at, mix(.75, .25, ocNight))).rgb;      // one read: linear filtering between the two rows is the day-night blend
  glow = r*r*mix(1.2, 2.2, ocNight);

  // 7. What the day sees: old crust pale silver, three times the levee's albedo; folds carry the light
  float young = 1.0 - smoothstep(2.0, 14.0, skin);
  crustAlbedo = mix(.034, .010, young)*(.78 + .44*fold);
  rough = mix(.62, .34, ridge);
  h = fold*.10 + p.r*.03 - max(crack, hair)*.10;
}
`;

// The surface's two textures, made once. Pipeline/research/LAVA_SOURCES.md
// tLava: r how far to the nearest crack (exact: to the bisector of the two nearest plate centres), g the plate's own random, b folds across the flow, a a soft noise. Plates bent by noise so no crack is a straight line
function lavaTex(n = 256) {
  let s = 80963; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, G = 7, C = n / G, P = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) P.push([(i + 0.15 + rnd() * 0.7) * C, (j + 0.15 + rnd() * 0.7) * C, rnd()]);
  const vn = (x, y, f) => { const sx = Math.sin(x * f * 0.0491 + y * f * 0.0213) + Math.sin(y * f * 0.0377 - x * f * 0.0161 + 1.7); return sx * 0.5; };
  const b = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const wx = x + vn(x, y, 1) * 5, wy = y + vn(y + 31, x, 1) * 5, gi = Math.floor(wx / C), gj = Math.floor(wy / C); let best = -1, bd = 1e9, bx = 0, by = 0;
    const cand = []; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = (gi + di + G) % G, jj = (gj + dj + G) % G, p = P[jj * G + ii], px = p[0] + Math.floor((gi + di) / G) * n - (((gi + di) % G + G) % G === ii ? 0 : 0), py = p[1] + Math.floor((gj + dj) / G) * n; const qx = (gi + di) * C + (p[0] - ii * C), qy = (gj + dj) * C + (p[1] - jj * C); cand.push([qx, qy, p[2]]); const d = Math.hypot(wx - qx, wy - qy); if (d < bd) { bd = d; best = cand.length - 1; } }
    const c0 = cand[best]; let edge = 1e9; for (let k = 0; k < cand.length; k++) { if (k === best) continue; const c = cand[k], ex = c[0] - c0[0], ey = c[1] - c0[1], el = Math.hypot(ex, ey) || 1, mx = (c[0] + c0[0]) * 0.5, my = (c[1] + c0[1]) * 0.5; edge = Math.min(edge, -((wx - mx) * ex + (wy - my) * ey) / el); }
    const fold = Math.pow(0.5 + 0.5 * Math.sin((y / n) * 14 * 6.2832 + vn(x, y, 2) * 2.2), 2.2), noise = 0.5 + 0.25 * vn(x, y, 3) + 0.15 * vn(x * 2.1, y * 1.9, 5);
    const o = (y * n + x) * 4; b[o] = Math.min(255, (edge / (C * 0.5)) * 255); b[o + 1] = c0[2] * 255; b[o + 2] = fold * 255; b[o + 3] = Math.max(0, Math.min(255, noise * 255));
  }
  const t = new THREE.DataTexture(b, n, n, THREE.RGBAFormat, THREE.UnsignedByteType); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
}
// tRamp: the skin's age to its light. Skin temperature from a measured fresh sheet flow, 700 C at a minute falling as t^-0.22, the core 1150 C under it; colour is Planck radiance, then a camera's exposure per channel, since yellow in footage is exposure, not hue. Row 0 night (E 10), row 1 day (E 2.2). Stored as square roots so the darks don't band
function rampTex() {
  const n = 256, b = new Uint8Array(n * 2 * 4);
  for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) {
    const at = i / (n - 1), skin = Math.max(0, Math.pow(2, (at - 0.2) / 0.095) - 0.25), C = Math.min(1150, 700 * Math.pow(Math.max(skin, 0.01) / 60, -0.22)), K = C + 273.15, x = 7.027e-4 - 1 / K, R = Math.exp(22963 * x), Gr = 0.127 * Math.exp(27722 * x), E = row ? 2.2 : 10;
    const r = 1 - Math.exp(-E * R), g = 1 - Math.exp(-E * Gr), bl = 0.35 * g * g * g + 0.04 * r * (1 - g), o = (row * n + i) * 4; b[o] = Math.sqrt(r) * 255; b[o + 1] = Math.sqrt(g) * 255; b[o + 2] = Math.sqrt(Math.min(1, bl)) * 255; b[o + 3] = 255;
  }
  const t = new THREE.DataTexture(b, n, 2, THREE.RGBAFormat, THREE.UnsignedByteType); t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t;
}

// Jeffreys' equation for a steady laminar channel, the basis of the lava-flow models: thickness h = (3 eta q / (rho g sin theta))^(1/3), speed v = q / h. q 3 m2/s, rho 1500, eta 300 Pa s: 2 m/s on 3 degrees, 4.6 m/s on 40
const jeffreys = (slope) => { const s = Math.max(Math.sin(Math.atan(slope)), Math.sin(0.035)), h = Math.cbrt((3 * 300 * 3) / (1500 * 9.81 * s)); return 3 / h; };

export function createLava(scene, look, heightAt, phone) {
  const P = [], A = [], F = [], I = []; let base = 0; const ends = [];
  // the walls a channel builds for itself: a near-vertical inside face 0.8 m above the lava, a crest about 0.4 of its width, and a rubble shoulder out to a toe 3 widths across. One mesh, one draw, rock that's red where it's hot
  const LP = [], LC = [], LI = [], lc = new THREE.Color(); let lb = 0;
  const levee = (p, nx, ny, w, z, i, more) => {
    for (const side of [-1, 1]) {
      const jit = 0.75 + 0.5 * Math.abs(Math.sin(i * 1.7 + side * 2.3)), crest = z + 0.8 + jit, out = [0, 0.02, 0.32, 0.7, 1.25], hgt = [z - 0.4, crest, crest - 0.15, 0, 0];
      for (let k = 0; k < 5; k++) {
        const d = w * (1 + out[k] * (k > 1 ? 1 : 0) + (k === 1 ? 0.04 : 0)), x = p[0] + nx * d * side, y = p[1] + ny * d * side, g = heightAt(x, y), zz = k === 4 ? g - 0.3 : k === 3 ? Math.max(g, (crest + g) * 0.5 - 0.6) : hgt[k];
        LP.push(x, zz, -y); LC.push(k === 0 ? 1 : k === 1 ? 0.35 : 0, 0.85 + 0.3 * Math.abs(Math.sin(i * 3.1 + k)));
      }
      if (more) for (let k = 0; k < 4; k++) { const v = lb + k, o = 10; LI.push(v, v + 1, v + o + 1, v, v + o + 1, v + o); }
      lb += 5;
    }
  };
  const strip = (pts0, w, age0) => {
    let cut = pts0.findIndex((p, i) => i > 6 && heightAt(p[0], p[1]) < 0.15); if (cut < 0) cut = pts0.length - 1; const pts = pts0.slice(0, cut + 2);      // a river ends at the sea, and that's where the steam is
    // a lava flow stands proud of the ground, a low thick tongue, so the surface rides above the highest of what's under its width
    const raw = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)], dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w; return Math.max(heightAt(p[0], p[1]), heightAt(p[0] + nx * 0.7, p[1] + ny * 0.7), heightAt(p[0] - nx * 0.7, p[1] - ny * 0.7)) + 0.9; });
    const zs = raw.map((_, i) => { let s = 0, n = 0; for (let k = -1; k <= 1; k++) { const v = raw[i + k]; if (v !== undefined) { s += v; n++; } } return Math.max(s / n, -0.9); });
    let T = 0, S = 0; const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, ds = i ? Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) : 0, drop = i ? Math.max(0, zs[i - 1] - zs[i]) : 0, slope = ds ? drop / ds : 0, speed = jeffreys(slope); T += ds / speed; S += ds;
      const ww = w * (i < 4 ? 0.5 + i * 0.125 : 1) * (1.15 + 0.2 * Math.sin(i * 0.9));
      const v0 = 1.1 + (i ? Math.max(0, zs[i - 1] - zs[i]) / Math.max(ds, 1e-3) : 0) * 9, v1 = i + 1 < n ? 1.1 + Math.max(0, zs[i] - zs[i + 1]) / Math.max(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]), 1e-3) * 9 : v0, stretch = Math.max(-1, Math.min(1, (v1 - v0) / Math.max(v0, 1))), fall = Math.max(0, Math.min(1, (slope - 0.9) / 0.9)), slow = (Math.sin(i * 0.37 + age0 * 9) * 0.5 + 0.5);
      for (const sd of [-1, -0.45, 0, 0.45, 1]) { const x = pts[i][0] + nx * ww * sd, y = pts[i][1] + ny * ww * sd; P.push(x, zs[i] + 0.2, -y); A.push(sd, T + age0 * 40, S, ww); F.push(stretch, fall, slow, 0); }
      if (i + 1 < n) for (let k = 0; k < 4; k++) { const v = base + i * 5 + k; I.push(v, v + 1, v + 6, v, v + 6, v + 5); }
      levee(pts[i], nx, ny, ww, zs[i] + 0.2, i, i + 1 < n);
    }
    base = P.length / 3; const e = pts[n - 1]; if (heightAt(e[0], e[1]) < 1.5) ends.push(new THREE.Vector3(e[0], 0.3, -e[1]));
  };
  lavaLines().forEach((l, i) => { const out = l.pts.filter((p) => Math.hypot(p[0] - FIRE_HILL.x, p[1] - FIRE_HILL.y) > 27); strip(out, l.w, i > 2 ? 0.35 : 0); });      // each river starts at the rim, where the lake spills
  // the crater's lake: a disc of the same stuff, the youngest in the world
  const ring = 36, R = 19, cz = heightAt(FIRE_HILL.x, FIRE_HILL.y) + 13, c0 = base; P.push(FIRE_HILL.x, cz, -FIRE_HILL.y); A.push(0, 30, 0, R); F.push(0, 0, 0.5, 0);
  for (const r of [0.4, 0.75, 1]) for (let j = 0; j < ring; j++) { const a = (j / ring) * 6.2832; P.push(FIRE_HILL.x + Math.cos(a) * R * r, cz, -(FIRE_HILL.y + Math.sin(a) * R * r)); A.push(Math.cos(a) * r, 26 + 18 * r, Math.sin(a) * r * R, R); F.push(0, 0, 0.5 + 0.5 * Math.sin(a * 3), 0); }
  for (let j = 0; j < ring; j++) { const n = (j + 1) % ring; I.push(c0, c0 + 1 + j, c0 + 1 + n); for (let q = 0; q < 2; q++) { const a = c0 + 1 + q * ring + j, b = c0 + 1 + q * ring + n, c = a + ring, d = b + ring; I.push(a, c, d, a, d, b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aL', new THREE.Float32BufferAttribute(A, 4)); g.setAttribute('aF', new THREE.Float32BufferAttribute(F, 4)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
  // lit: old crust is pale silver in the sun, three times the levee's albedo, and its folds carry the light. Its own light is the age of each bit of skin, so most of the surface goes dark within a minute and thin threads carry nearly all the light, which is what makes real lava look hot
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
  look.patch(m, {
    key: 'lavaflow2', uniforms: { tLava: { value: lavaTex() }, tRamp: { value: rampTex() } }, vertexDecl: 'attribute vec4 aL, aF;\nvarying vec4 vL, vF;\n', vertexBend: 'vL = aL; vF = aF;',
    fragmentPars: 'varying vec4 vL, vF; uniform sampler2D tLava, tRamp;\nconst float UREF = 3.0;\nvec3 lvGlow; float lvAlb, lvRough, lvH;\n' + LAVA_SURFACE,
    albedo: /* glsl */`{ vec3 V = normalize(cameraPosition - vOcP), Ng = normalize(cross(dFdx(vOcP), dFdy(vOcP))); lavaSurface(V, Ng, lvGlow, lvAlb, lvRough, lvH); diffuseColor.rgb = vec3(lvAlb); }`,
    glow: 'ocGlow = lvGlow;',
  });
  const mesh = new THREE.Mesh(g, m); mesh.name = 'lava'; mesh.frustumCulled = true; scene.add(mesh);
  { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(LC, 3)); lg.setIndex(LI); lg.computeVertexNormals(); lg.computeBoundingSphere();
    lg.deleteAttribute('color'); lg.setAttribute('aHot', new THREE.Float32BufferAttribute(LC, 2));
    // dark clinker outside, the inside face red where the lava has it
    const lm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }); look.patch(lm, { key: 'levee', vertexDecl: 'attribute vec2 aHot;\nvarying vec2 vHot;\n', vertexBend: 'vHot = aHot;', fragmentPars: 'varying vec2 vHot;\n', albedo: 'diffuseColor.rgb = mix(vec3(.013, .012, .011), vec3(.16, .022, .009), vHot.x)*vHot.y;', glow: 'ocGlow = vec3(1.0, .25, .06)*vHot.x*vHot.x*(.25 + .5*ocNight);' }); const lv = new THREE.Mesh(lg, lm); lv.name = 'lava_levee'; scene.add(lv); }
  // basalt columns along the isle's shore: jittered hexagons, as real columns crack on cooling, stepped like the great causeways
  const basalt = (() => {
    const N = phone ? 420 : 760, g = new THREE.CylinderGeometry(1.5, 1.6, 1, 6, 1).translate(0, 0.5, 0), mt = new THREE.MeshStandardMaterial({ color: 0x1b1a1c, roughness: 0.82, flatShading: true }); look.patch(mt, { key: 'basalt' }); const im = new THREE.InstancedMesh(g, mt, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), c = new THREE.Color(); let s = 31991, n = 0; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 12000 && n < N; i++) {
      const a = rnd() * 6.283, r = ISLE.R * (0.72 + rnd() * 0.52), x = ISLE.x + Math.cos(a) * r, y = ISLE.y + Math.sin(a) * r, z = heightAt(x, y); if (z < -3 || z > 7 || Math.sin(a * 3 + 1) + Math.sin(a * 7) < 0.1) continue; const dH = heightAt(x + 8, y) - heightAt(x - 8, y), dI = heightAt(x, y + 8) - heightAt(x, y - 8); if (Math.hypot(dH, dI) < 2.4) continue; if (Math.hypot(x - 246, y + 760) < 120) continue;
      const h = 3 + rnd() * rnd() * 11; q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * 1.05); m4.compose(p3.set(x, z - 1.5, -y), q, s3.set(1 + rnd() * 0.35, h, 1 + rnd() * 0.35)); im.setMatrixAt(n, m4); c.setScalar(0.72 + rnd() * 0.6); im.setColorAt(n, c); n++;
    }
    im.count = n; im.frustumCulled = false; im.name = 'basalt'; scene.add(im); return im;
  })();
  // what the footage has round the lava: a fountain of fire at the vent, steam where it meets the sea, sparks in the air. All of it only near him
  const vent = new THREE.Vector3(FIRE_HILL.x, cz + 1, -FIRE_HILL.y), v = new THREE.Vector3(), STEAM = new THREE.Color(0.86, 0.87, 0.9), HOT = new THREE.Color(1.0, 0.55, 0.16), EMB = new THREE.Color(1.0, 0.42, 0.08); let tF = 0, tS = 0, tE = 0, tB = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let tRoar = 0;
  function frame(G, dt) {
    // the rivers and the crater roar and crackle as you come near, a few times a second. Past the last channel chan() says 9: that's far, not near
    if ((tRoar -= dt) <= 0 && G.audio.lava) { tRoar = 0.25; const p = G.camera.position, x = p.x, y = -p.z, c = chan(x, y), far = Math.min(c >= 9 ? 999 : c * 7, Math.hypot(x - FIRE_HILL.x, y - FIRE_HILL.y) * 0.8), t = Math.max(0, Math.min(1, (70 - far) / 60)); G.audio.lava(t * t * (3 - 2 * t) * (p.y < -0.5 ? 0 : 1)); }
    const cam = G.camera.position, far = cam.distanceTo(vent); basalt.visible = far < 900; if (far > 520) return; const F = G.flames;
    // lava burns anyone who isn't fire
    { const h = G.hero; if (G.sideNow !== 'fire' && !h.dead && (tB -= dt) <= 0) { tB = 0.5; const g = heightAt(h.pos.x, -h.pos.z); if (h.pos.y - g < 3 && chan(h.pos.x, -h.pos.z) < 1.05) { h.damage(9, h.pos, { unblockable: true }); G.fx.sparks(h.pos, 8, 0xff8030, 6); G.ui.tip && G.ui.tip('Lava: get off it', 1.6); } } }
    if ((tF -= dt) <= 0 && far < 420) { tF = 0.08; const a = rnd(0, 6.283), s = rnd(0, 7); if (F) F.puff(v.set(vent.x + Math.cos(a) * s, vent.y, vent.z + Math.sin(a) * s), rnd(3.5, 6.5), rnd(0.7, 1.1), Math.cos(a) * rnd(1, 5), rnd(16, 30), Math.sin(a) * rnd(1, 5), 0.7, -6, 2.2); }
    if ((tS -= dt) <= 0) { tS = 0.16; for (const e of ends) { if (e.distanceToSquared(cam) > 340 * 340) continue; v.set(e.x + rnd(-5, 5), 0.5, e.z + rnd(-5, 5)); G.fx.sp('smoke', v, 3, rnd(2.2, 3.6), STEAM, { s0: 2.4, s1: 9, a: 0.42, add: 0, hot: 0, vy: rnd(3, 7), vx: rnd(-1, 1), vz: rnd(-1, 1), drag: 0.4, rot: Math.random() * 6.28 }); } }
    if ((tE -= dt) <= 0 && cam.y > -1) { tE = 0.05; const a = rnd(0, 6.283), d = rnd(3, 34); if (Math.hypot(cam.x - vent.x, cam.z - vent.z) < 270) { v.set(cam.x + Math.cos(a) * d, cam.y + rnd(-8, 8), cam.z + Math.sin(a) * d); G.fx.sp('dot', v, 0.1, rnd(1.2, 2.4), EMB, { s0: 0.13, s1: 0.03, hot: 1, add: 1, vx: rnd(-1.5, 1.5), vy: rnd(1.5, 4), vz: rnd(-1.5, 1.5) }); } }
  }
  return { mesh, ends, cz, frame, lines: lavaLines() };
}
