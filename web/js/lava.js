// The lava itself: the rivers of fireisle.js and the crater's lake, one draw. Pipeline/research/WORLD_SOURCES.md.
// Colour is temperature, from USGS's table: red below 1073 K, orange to 1273 K, yellow above; fresh lava is about 1443 K. A crust forms in seconds and thickens with the square root of time, so a river is molten at the vent and further down it's dark plates with hot seams, which is what the footage shows. The plates ride the flow: their coordinate along the river is time, so where it runs steep they stretch into the streaks of a lava fall.
import * as THREE from 'three';
import { lavaLines, FIRE_HILL } from './fireisle.js';

// a tiling cell map, made once: red the distance to the nearest point, green how close the second is (the seam)
function cells(n = 128, pts = 26) {
  let s = 80963; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, P = []; for (let i = 0; i < pts; i++) P.push([rnd() * n, rnd() * n]);
  const b = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let f1 = 1e9, f2 = 1e9; for (const p of P) for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) { const d = Math.hypot(x - p[0] - a * n, y - p[1] - c * n); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; } const o = (y * n + x) * 4, k = 255 / (n / Math.sqrt(pts)); b[o] = Math.min(255, f1 * k); b[o + 1] = Math.min(255, (f2 - f1) * k * 1.6); b[o + 3] = 255; }
  const t = new THREE.DataTexture(b, n, n, THREE.RGBAFormat, THREE.UnsignedByteType); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

export function createLava(scene, look, heightAt, phone) {
  const P = [], A = [], I = []; let base = 0; const ends = [];
  const strip = (pts, w, age0) => {
    // a lava flow stands proud of the ground, a low thick tongue, so the surface rides above the highest of what's under its width
    const raw = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)], dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w; return Math.max(heightAt(p[0], p[1]), heightAt(p[0] + nx * 0.7, p[1] + ny * 0.7), heightAt(p[0] - nx * 0.7, p[1] - ny * 0.7)) + 0.9; });
    const zs = raw.map((_, i) => { let s = 0, n = 0; for (let k = -1; k <= 1; k++) { const v = raw[i + k]; if (v !== undefined) { s += v; n++; } } return Math.max(s / n, -0.9); });
    let T = 0, S = 0; const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, ds = i ? Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) : 0, drop = i ? Math.max(0, zs[i - 1] - zs[i]) : 0, slope = ds ? drop / ds : 0, speed = 1.1 + slope * 9; T += ds / speed; S += ds;
      const ww = w * (i < 4 ? 0.5 + i * 0.125 : 1) * (1.15 + 0.2 * Math.sin(i * 0.9));
      for (const sd of [-1, -0.45, 0, 0.45, 1]) { const x = pts[i][0] + nx * ww * sd, y = pts[i][1] + ny * ww * sd; P.push(x, zs[i] - (Math.abs(sd) > 0.9 ? 1.5 : Math.abs(sd) > 0.4 ? 0.22 : 0), -y); A.push(sd, T, Math.min(1, age0 + S / 220), ww); }
      if (i + 1 < n) for (let k = 0; k < 4; k++) { const v = base + i * 5 + k; I.push(v, v + 1, v + 6, v, v + 6, v + 5); }
    }
    base = P.length / 3; const e = pts[n - 1]; if (heightAt(e[0], e[1]) < 1.5 || zs[n - 1] < 1) ends.push(new THREE.Vector3(e[0], 0.3, -e[1]));
  };
  lavaLines().forEach((l, i) => { const out = l.pts.filter((p) => Math.hypot(p[0] - FIRE_HILL.x, p[1] - FIRE_HILL.y) > 27); strip(out, l.w, i > 2 ? 0.35 : 0); });      // each river starts at the rim, where the lake spills
  // the crater's lake: a disc of the same stuff, the youngest in the world
  const ring = 36, R = 19, cz = heightAt(FIRE_HILL.x, FIRE_HILL.y) + 13, c0 = base; P.push(FIRE_HILL.x, cz, -FIRE_HILL.y); A.push(0, 0, 0, R);
  for (const r of [0.4, 0.75, 1]) for (let j = 0; j < ring; j++) { const a = (j / ring) * 6.2832; P.push(FIRE_HILL.x + Math.cos(a) * R * r, cz, -(FIRE_HILL.y + Math.sin(a) * R * r)); A.push(Math.cos(a) * r, Math.sin(a) * r * 9, 0.02, R); }
  for (let j = 0; j < ring; j++) { const n = (j + 1) % ring; I.push(c0, c0 + 1 + j, c0 + 1 + n); for (let q = 0; q < 2; q++) { const a = c0 + 1 + q * ring + j, b = c0 + 1 + q * ring + n, c = a + ring, d = b + ring; I.push(a, c, d, a, d, b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aL', new THREE.Float32BufferAttribute(A, 4)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
  const tC = cells(), m = new THREE.MeshBasicMaterial({ color: 0x050303, side: THREE.DoubleSide });
  look.patch(m, {
    key: 'lavaflow', uniforms: { tLC: { value: tC } }, vertexDecl: 'attribute vec4 aL;\nvarying vec4 vL;\n', vertexBend: 'vL = aL;',
    fragmentPars: 'varying vec4 vL; uniform sampler2D tLC;\n',
    glow: /* glsl */`{
      float sd = vL.x, age = vL.z, w = vL.w, t = ocTime; vec2 q = vec2(sd*w*.06, (vL.y - t*.55)*.17), q2 = vec2(sd*w*.15 + .37, (vL.y - t*.55)*.42 + .11);
      vec4 c1 = texture(tLC, q), c2 = texture(tLC, q2);
      float crust = smoothstep(.0, .55, sqrt(age))*smoothstep(.0, .5, c1.g + c2.g*.2 - .05);             // plates: thick at the middle of a cell, nothing on the seam
      float edge = abs(sd), stream = (1.0 - smoothstep(.3, 1.0, edge))*(1.0 - .75*smoothstep(.1, .9, age));   // the middle of the river stays open longest
      float T = 1443.0 - 640.0*crust*(1.0 - stream*.75) + 60.0*(c2.r - .5) - 120.0*age;                 // kelvin
      vec3 c = T < 873.0 ? vec3(.05, .012, .008) : T < 1073.0 ? mix(vec3(.05, .012, .008), vec3(.95, .10, .02), (T - 873.0)/200.0) : T < 1273.0 ? mix(vec3(.95, .10, .02), vec3(1.6, .50, .04), (T - 1073.0)/200.0) : mix(vec3(1.6, .50, .04), vec3(2.3, 1.45, .46), (T - 1273.0)/170.0);
      ocGlow = c*(1.0 + .12*sin(t*2.3 + vL.y*3.0)); }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.name = 'lava'; mesh.frustumCulled = true; scene.add(mesh);
  // what the footage has round the lava: a fountain of fire at the vent, steam where it meets the sea, sparks in the air. All of it only near him
  const vent = new THREE.Vector3(FIRE_HILL.x, cz + 1, -FIRE_HILL.y), v = new THREE.Vector3(), STEAM = new THREE.Color(0.86, 0.87, 0.9), HOT = new THREE.Color(1.0, 0.55, 0.16), EMB = new THREE.Color(1.0, 0.42, 0.08); let tF = 0, tS = 0, tE = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function frame(G, dt) {
    const cam = G.camera.position, far = cam.distanceTo(vent); if (far > 520) return; const F = G.flames;
    if ((tF -= dt) <= 0 && far < 420) { tF = 0.08; const a = rnd(0, 6.283), s = rnd(0, 7); if (F) F.puff(v.set(vent.x + Math.cos(a) * s, vent.y, vent.z + Math.sin(a) * s), rnd(3.5, 6.5), rnd(0.7, 1.1), Math.cos(a) * rnd(1, 5), rnd(16, 30), Math.sin(a) * rnd(1, 5), 0.7, -6, 2.2); }
    if ((tS -= dt) <= 0) { tS = 0.16; for (const e of ends) { if (e.distanceToSquared(cam) > 340 * 340) continue; v.set(e.x + rnd(-5, 5), 0.5, e.z + rnd(-5, 5)); G.fx.sp('smoke', v, 3, rnd(2.2, 3.6), STEAM, { s0: 2.4, s1: 9, a: 0.42, add: 0, hot: 0, vy: rnd(3, 7), vx: rnd(-1, 1), vz: rnd(-1, 1), drag: 0.4, rot: Math.random() * 6.28 }); } }
    if ((tE -= dt) <= 0 && cam.y > -1) { tE = 0.05; const a = rnd(0, 6.283), d = rnd(3, 34); if (Math.hypot(cam.x - vent.x, cam.z - vent.z) < 270) { v.set(cam.x + Math.cos(a) * d, cam.y + rnd(-8, 8), cam.z + Math.sin(a) * d); G.fx.sp('dot', v, 0.1, rnd(1.2, 2.4), EMB, { s0: 0.13, s1: 0.03, hot: 1, add: 1, vx: rnd(-1.5, 1.5), vy: rnd(1.5, 4), vz: rnd(-1.5, 1.5) }); } }
  }
  return { mesh, ends, cz, frame, lines: lavaLines() };
}
