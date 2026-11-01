// The water a land ride leaves behind (Randy, 1 Nov: "The land surf should leave some water too"). The stream behind him (wake.js) runs for a few seconds;
// what it leaves lasts: ground soaked dark that dries over most of a minute, puddles standing in it that shrink and go over half a minute, and grass laid
// flat and dark along the way he came. A map of it follows him across the world, 96 m a side, a texel every 37.5 cm:
//   r: how wet the ground is · g: standing water · b: how fresh (the shine of water still moving) · a: unused
// Rides stamp it (stamp(), each piece of the trail a capsule, the strongest of what's there kept); every 0.2 s it dries a step and, when he has gone far enough
// from its middle, moves by whole texels so nothing blurs. The ground's and the grass's shaders read it through look's tOcWet and ocWetM.
import * as THREE from 'three';

const SIZE = 96, RES = 256, STEP = SIZE / 16;          // the map's side (m), its texels, how far it moves at a time (a whole number of texels)
const DRY = [52, 26, 3.5];                              // seconds for soaked ground, standing water and the fresh shine to go
const MAXQ = 24;

export function createWetMap(renderer, U) {
  const mk = () => new THREE.WebGLRenderTarget(RES, RES, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
  let cur = mk(), next = mk();
  const cam = new THREE.OrthographicCamera(-.5, .5, .5, -.5, -1, 1);
  const origin = new THREE.Vector2(0, 0);                 // the map's middle, in the game's x, z
  let live = false, dryAcc = 0, clearNow = true;

  // drying and moving: the old map read back shifted by whole texels, less what dried
  const copyM = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uShift: { value: new THREE.Vector2() }, uDry: { value: new THREE.Vector3() } }, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy + .5; gl_Position = vec4(position.xy*2.0, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tSrc; uniform vec2 uShift; uniform vec3 uDry; varying vec2 vUv;
      void main(){ vec2 s = vUv + uShift; vec4 c = (s.x < 0.0 || s.y < 0.0 || s.x > 1.0 || s.y > 1.0) ? vec4(0.0) : texture2D(tSrc, s);
        gl_FragColor = vec4(max(c.rgb - uDry, 0.0), 0.0); }`,
  });
  const copyQ = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), copyM); copyQ.frustumCulled = false;
  const copyScene = new THREE.Scene(); copyScene.add(copyQ);

  // the stamps: up to MAXQ capsules a frame, each a quad round its segment; the fragment finds its distance to the segment. Standing water comes in blobs
  // (a noise on the ground's own place, so a puddle is where it is however often he passes); max blending keeps the strongest of old and new.
  const qP = new Float32Array(MAXQ * 4 * 3), qA = new Float32Array(MAXQ * 4 * 4), qB = new Float32Array(MAXQ * 4 * 4), qI = [];
  for (let i = 0; i < MAXQ; i++) { const b = i * 4; qI.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  const qG = new THREE.BufferGeometry();
  qG.setAttribute('position', new THREE.BufferAttribute(qP, 3).setUsage(THREE.DynamicDrawUsage));
  qG.setAttribute('aSeg', new THREE.BufferAttribute(qA, 4).setUsage(THREE.DynamicDrawUsage));      // segment ends (map metres)
  qG.setAttribute('aW', new THREE.BufferAttribute(qB, 4).setUsage(THREE.DynamicDrawUsage));        // half width, standing water, wetness, unused
  qG.setIndex(qI);
  const stampM = new THREE.ShaderMaterial({
    uniforms: { uOrigin: { value: origin } }, depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    vertexShader: `attribute vec4 aSeg, aW; varying vec4 vSeg, vW; varying vec2 vM;
      void main(){ vSeg = aSeg; vW = aW; vM = position.xy; gl_Position = vec4(position.xy/${SIZE.toFixed(1)}*2.0, 0.0, 1.0); }`,
    fragmentShader: `uniform vec2 uOrigin; varying vec4 vSeg, vW; varying vec2 vM;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 a = vSeg.xy, b = vSeg.zw, ab = b - a; float t = clamp(dot(vM - a, ab)/max(dot(ab, ab), 1e-4), 0.0, 1.0); float d = length(vM - a - ab*t)/vW.x;
        if (d > 1.0) discard;
        vec2 wp = vec2(vM.x + uOrigin.x, vM.y - uOrigin.y);        // the world's own place (Blender x, y): a puddle stays where it formed
        float n = vn(wp*.55)*.62 + vn(wp*1.7 + 9.1)*.38;
        float wet = (1.0 - smoothstep(.55, 1.0, d))*vW.z;
        float pud = (1.0 - smoothstep(.25, .95, d))*smoothstep(.18, .52, n)*vW.y;
        gl_FragColor = vec4(wet, pud, (1.0 - smoothstep(.3, 1.0, d)), 0.0);
      }`,
  });
  const stampQ = new THREE.Mesh(qG, stampM); stampQ.frustumCulled = false;
  const stampScene = new THREE.Scene(); stampScene.add(stampQ);
  const queue = [];

  U.tOcWet.value = cur.texture; U.ocWetM.value.set(0, 0, 1 / SIZE, 0);

  // a piece of trail on the ground (game x, z at each end), its half width, how much water it leaves standing (0-1) and how wet (0-1)
  function stamp(x0, z0, x1, z1, w, pud = 1, wet = 1) { if (queue.length < MAXQ * 2) queue.push(x0, z0, x1, z1, w, pud, wet); if (!live) { live = true; origin.set(Math.round(x1 / STEP) * STEP, Math.round(z1 / STEP) * STEP); } }

  const prevCol = new THREE.Color();
  function update(dt, fx, fz) {
    if (!live) return;
    const prevT = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevA = renderer.getClearAlpha(); renderer.getClearColor(prevCol);
    renderer.autoClear = false;
    if (clearNow) { for (const t of [cur, next]) { renderer.setRenderTarget(t); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false); } clearNow = false; }
    // move and dry: when he's a quarter of the way out from the middle, the map follows him by whole steps
    dryAcc += dt;
    const nx = Math.abs(fx - origin.x) > SIZE * .25 ? Math.round(fx / STEP) * STEP : origin.x, nz = Math.abs(fz - origin.y) > SIZE * .25 ? Math.round(fz / STEP) * STEP : origin.y;
    if (dryAcc >= .2 || nx !== origin.x || nz !== origin.y) {
      copyM.uniforms.tSrc.value = cur.texture; copyM.uniforms.uShift.value.set((nx - origin.x) / SIZE, -(nz - origin.y) / SIZE);
      copyM.uniforms.uDry.value.set(dryAcc / DRY[0], dryAcc / DRY[1], dryAcc / DRY[2]); dryAcc = 0;
      renderer.setRenderTarget(next); renderer.render(copyScene, cam);
      const t = cur; cur = next; next = t; origin.set(nx, nz); U.tOcWet.value = cur.texture;
    }
    // the stamps since last frame
    if (queue.length) {
      const n = Math.min(MAXQ, queue.length / 7);
      for (let i = 0; i < MAXQ; i++) {
        const o = i * 7, has = i < n;
        // map metres: x right, the game's -z up (so the texture's v runs with the world's y, as the ground's shader reads it)
        const ax = has ? queue[o] - origin.x : 0, ay = has ? -(queue[o + 1] - origin.y) : 0, bx = has ? queue[o + 2] - origin.x : 0, by = has ? -(queue[o + 3] - origin.y) : 0, w = has ? queue[o + 4] : 0;
        const x0 = Math.min(ax, bx) - w, x1 = Math.max(ax, bx) + w, y0 = Math.min(ay, by) - w, y1 = Math.max(ay, by) + w;
        const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        for (let k = 0; k < 4; k++) { const v = i * 4 + k; qP[v * 3] = corners[k][0]; qP[v * 3 + 1] = corners[k][1]; qP[v * 3 + 2] = 0; qA.set([ax, ay, bx, by], v * 4); qB.set([Math.max(w, 1e-3), has ? queue[o + 5] : 0, has ? queue[o + 6] : 0, 0], v * 4); }
      }
      queue.splice(0, n * 7);
      qG.attributes.position.needsUpdate = true; qG.attributes.aSeg.needsUpdate = true; qG.attributes.aW.needsUpdate = true;
      renderer.setRenderTarget(cur); renderer.render(stampScene, cam);
    }
    U.ocWetM.value.set(origin.x, origin.y, 1 / SIZE, 1);
    renderer.setRenderTarget(prevT); renderer.autoClear = prevAuto; renderer.setClearColor(prevCol, prevA);
  }
  // its two programs are compiled at boot: left to the first ride, they stalled that frame 150 ms (pace, 1 Nov: world.update, 1 new program, 2 new textures)
  function prewarm() { renderer.compile(copyScene, cam); renderer.compile(stampScene, cam); }
  return { stamp, update, prewarm, get origin() { return origin; }, get live() { return live; }, restore() { clearNow = true; } };
}
