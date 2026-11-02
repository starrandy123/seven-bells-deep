// The sea mirrors the world. Randy, 2 Nov: "we HAVE 0 shadows in the game or water reflections!". Pipeline/research/LIGHT_SOURCES.md
// One small pass, every other frame, while the sea is in view: the land as a coarse lit grid, every building as a box in its own colour with its windows lit at night, and the fire, all seen by a camera under the sea's plane. The sea reads it where it reads the sky, and the waves stretch it into streaks.
import * as THREE from 'three';

export function createMirror({ renderer, U, heightAt, biomeWeights, ox, oy, size, cities, isle, phone }) {
  const W = 256, s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(); cam.matrixAutoUpdate = false; cam.matrixWorldAutoUpdate = false;
  let rt = null, frame = 0, h0 = 0;
  const day = { value: 1 }, night = { value: 0 };
  // the land: a grid over the world, its colour and its light baked once, never below the sea
  { const n = phone ? 80 : 112, P = new Float32Array(n * n * 3), C = new Uint8Array(n * n * 3), w4 = [0, 0, 0, 0], sun = U.ocSunA.value, step = size / (n - 1), h = (x, y) => Math.max(heightAt(x, y), -0.6);
    for (let j = 0, k = 0; j < n; j++) for (let i = 0; i < n; i++, k++) {
      const bx = ox + i * step, by = oy + j * step, y = h(bx, by), dx = h(bx + step, by) - h(bx - step, by), dy = h(bx, by + step) - h(bx, by - step), nl = Math.hypot(dx, 2 * step, dy), ndl = Math.max(0, (-dx * sun.x + 2 * step * sun.y + dy * sun.z) / nl);
      P[k * 3] = bx; P[k * 3 + 1] = y; P[k * 3 + 2] = -by; biomeWeights(bx, by, w4);
      const ash = Math.hypot(bx - isle.x, by - isle.y) < isle.R * 1.1, g = w4[1], sand = y < 2.2 ? 1 : 0, rock = Math.min(1, Math.max(0, (dy * dy + dx * dx) / (step * step) - 0.3));
      let r = 0.30, gg = 0.42, b = 0.22; if (sand) { r = 0.74; gg = 0.68; b = 0.52; } else if (g < 0.35 || rock > 0.5) { r = 0.44; gg = 0.42; b = 0.39; } if (ash) { r = 0.11; gg = 0.10; b = 0.10; }
      const L = 0.4 + 0.75 * ndl; C[k * 3] = Math.min(255, r * L * 255); C[k * 3 + 1] = Math.min(255, gg * L * 255); C[k * 3 + 2] = Math.min(255, b * L * 255);
    }
    const I = []; for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i; I.push(a, a + 1, a + n, a + 1, a + n + 1, a + n); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3, true)); g.setIndex(I);
    const m = new THREE.ShaderMaterial({ uniforms: { uDay: day, ocHaze: U.ocHaze }, side: THREE.DoubleSide, vertexColors: true, toneMapped: false,
      vertexShader: 'varying vec3 vC; varying float vF; void main(){ vec4 w = modelMatrix*vec4(position.x, max(position.y, 0.0), position.z, 1.0); vC = color; vF = 1.0 - exp(-distance(w.xyz, cameraPosition)*.0011); gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: 'uniform float uDay; uniform vec3 ocHaze; varying vec3 vC; varying float vF; void main(){ gl_FragColor = vec4(mix(vC*vC*uDay, ocHaze, vF), 1.0); }' });
    const o = new THREE.Mesh(g, m); o.frustumCulled = false; s.add(o); }
  // the buildings: one box each, from the size of what stands there, in its own colour. Only what's above the sea
  { const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0); const L = [], M = new THREE.Matrix4(), B = new THREE.Box3(), c = new THREE.Vector3(), z = new THREE.Vector3(), cm = new THREE.Matrix4(), col = new THREE.Color();
    for (const m of cities) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); B.copy(m.geometry.boundingBox); B.getSize(z); if (z.y < 3) continue; B.getCenter(c); for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); if (M.elements[13] + B.max.y * Math.hypot(M.elements[4], M.elements[5], M.elements[6]) < 1) continue; cm.makeTranslation(c.x, B.min.y, c.z).scale(z); L.push(M.clone().multiply(cm), m.instanceColor ? (m.getColorAt(i, col), col.clone()) : new THREE.Color(0.8, 0.78, 0.72)); } }
    const n = L.length / 2, im = new THREE.InstancedMesh(box, new THREE.ShaderMaterial({ uniforms: { uDay: day, uNight: night, ocHaze: U.ocHaze, ocSunA: U.ocSunA }, side: THREE.DoubleSide, toneMapped: false,
      vertexShader: 'uniform vec3 ocSunA; varying vec3 vC, vW; varying float vF, vL; void main(){ vec4 w = modelMatrix*instanceMatrix*vec4(position, 1.0); w.y = max(w.y, 0.0); vec3 nn = normalize(mat3(instanceMatrix)*normal); vL = .45 + .6*max(dot(nn, ocSunA), 0.0); vC = instanceColor; vW = w.xyz; vF = 1.0 - exp(-distance(w.xyz, cameraPosition)*.0011); gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: 'uniform float uDay, uNight; uniform vec3 ocHaze; varying vec3 vC, vW; varying float vF, vL; void main(){ vec3 c = vC*vC*vL*uDay*.8; c += vec3(1.0, .62, .26)*uNight*step(.55, fract(vW.y*.31))*step(2.0, vW.y)*.7; gl_FragColor = vec4(mix(c, ocHaze, vF), 1.0); }' }), Math.max(1, n));
    for (let i = 0; i < n; i++) { im.setMatrixAt(i, L[i * 2]); im.setColorAt(i, L[i * 2 + 1]); } im.count = n; im.frustumCulled = false; s.add(im); }

  // the sea's own surface reads where the camera's ray lands: the same place on the screen, as seen from under the plane
  const R = new THREE.Matrix4().makeScale(1, -1, 1), col = new THREE.Color();
  return {
    // the fire and anything else that should stand in the sea are borrowed for the pass and given back
    render(camera, above, borrow) {
      if (!above.visible || camera.position.y < 0.5) { U.ocReflOn.value = 0; return; }
      if ((frame++ & 1) && rt) return;
      const w = W, hgt = Math.max(64, Math.round(W / Math.max(camera.aspect, 0.5)));
      if (!rt || rt.height !== hgt) { if (rt) rt.dispose(); rt = new THREE.WebGLRenderTarget(w, hgt, { type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); U.tOcRefl.value = rt.texture; }
      cam.projectionMatrix.copy(camera.projectionMatrix); cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse); cam.matrixWorld.copy(camera.matrixWorld).premultiply(R); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
      const sun = U.ocSunCol.value; day.value = Math.min(1.4, (sun.r + sun.g + sun.b) * 0.5 + 0.12); night.value = Math.max(0, 1 - day.value * 1.6);
      const back = []; for (const o of borrow) if (o && o.visible) { back.push([o, o.parent]); s.add(o); }
      const prev = renderer.getRenderTarget(), a = renderer.getClearAlpha(); renderer.getClearColor(col);
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(s, cam); renderer.setRenderTarget(prev); renderer.setClearColor(col, a);
      for (const [o, p] of back) p.add(o);
      U.ocReflOn.value = 1;
    },
    restore() { if (rt) { rt.dispose(); rt = null; } },
  };
}
