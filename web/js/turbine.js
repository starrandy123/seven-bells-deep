// A gas turbine's jet, drawn as one (Randy, 2 Nov: "They must fire like an actual gas turbine on user"). Sources: Pipeline/research/FLIGHT_SOURCES.md.
// From the photographs (J58 on its stand, SR-71, F-16): a straight, thin, rigid cone from a hot nozzle, translucent, with bright diamonds evenly spaced on its axis that die away with distance. It never wanders.
// The diamonds: the first Mach disk stands 0.67 D √(P0/P1) from the nozzle, so about two nozzle widths here, and the shear along the jet's edge dissipates the pattern (Wikipedia, Shock diamond).
// The method: a truncated cone with a colour along it, noise run along it, and an alpha from the view angle so its edge is soft (the CC0 "Engine flame" shader, godotshaders.com). All the jets in the world are one draw.
import * as THREE from 'three';

const RINGS = [0, 0.03, 0.09, 0.2, 0.36, 0.58, 0.8, 1], SIDES = 10;

export function createTurbines(G, cap = 12) {
  const P = [], C = [], I = [];
  for (let k = 0; k < RINGS.length; k++) for (let j = 0; j <= SIDES; j++) { const a = (j / SIDES) * 6.2832; P.push(0, 0, 0); C.push(Math.cos(a), Math.sin(a), RINGS[k], j / SIDES); }
  for (let k = 0; k + 1 < RINGS.length; k++) for (let j = 0; j < SIDES; j++) { const a = k * (SIDES + 1) + j, b = a + 1, c = a + SIDES + 1, d = c + 1; I.push(a, b, d, a, d, c); }
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aC', new THREE.Float32BufferAttribute(C, 4)); g.setIndex(I);
  const data = new Float32Array(cap * 11), ib = new THREE.InstancedInterleavedBuffer(data, 11); ib.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iP', new THREE.InterleavedBufferAttribute(ib, 4, 0)); g.setAttribute('iD', new THREE.InterleavedBufferAttribute(ib, 4, 4)); g.setAttribute('iK', new THREE.InterleavedBufferAttribute(ib, 3, 8));
  g.instanceCount = 0; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const U = { uT: { value: 0 }, tN: { value: G.fx.noiseT } };
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation, uniforms: U,
    vertexShader: /* glsl */`
      attribute vec4 aC, iP, iD; attribute vec3 iK; varying vec3 vN, vW, vK; varying vec2 vUv;
      void main() {
        vec3 d = iD.xyz, a = normalize(cross(abs(d.y) < .9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), d)), b = cross(d, a), rad = a*aC.x + b*aC.y;
        float v = aC.z, R = iD.w*(1.0 + .22*smoothstep(0.0, .14, v))*(1.0 - .94*smoothstep(.2, 1.0, v));      // it leaves the nozzle at the nozzle's width, opens a little over the first cell, and draws straight to a point
        vec3 w = iP.xyz + d*v*iP.w + rad*R; vN = rad; vW = w; vK = iK; vUv = vec2(aC.w, v);
        gl_Position = projectionMatrix*viewMatrix*vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uT; uniform sampler2D tN; varying vec3 vN, vW, vK; varying vec2 vUv;
      void main() {
        vec3 V = normalize(cameraPosition - vW); float nv = abs(dot(normalize(vN), V)), u = vUv.y, P = vK.x, wet = vK.y, seed = vK.z;
        float edge = nv*nv, tail = pow(1.0 - u, 1.25)*smoothstep(1.0, .86, u);
        // the shock cells: six to the length of the jet at full power, sharp, tight on the axis, gone by the tail
        float cells = 4.0 + 2.0*P, c = .5 + .5*cos(6.2832*(u*cells - .3)), bead = pow(c, 9.0)*exp(-u*2.5)*pow(nv, 3.5);
        // what runs in it: streaks along the jet at speed, a shimmer in its brightness and nothing more: it never bends
        float streak = texture2D(tN, vec2(vUv.x*2.0 + seed, u*1.1 - uT*7.0)).r, fine = texture2D(tN, vec2(vUv.x*5.0 - seed, u*2.6 - uT*13.0)).g, shim = .78 + .44*(streak*.6 + fine*.4);
        float noz = exp(-u*30.0);      // the nozzle's own heat, the brightest thing in the photographs
        vec3 bodyC = mix(mix(mix(vec3(1.0, .93, .78), vec3(1.0, .58, .2), smoothstep(.04, .42, u)), vec3(.95, .28, .06), smoothstep(.42, .95, u)), vec3(.74, .92, 1.0), wet), beadC = mix(vec3(1.0, .86, .5), vec3(.92, .98, 1.0), wet), nozC = mix(vec3(1.0, .96, .84), vec3(.95, 1.0, 1.0), wet);
        float body = edge*tail*shim*(.62 + .5*P), rim = (1.0 - edge)*tail*.16*(.6 + .4*streak);
        vec3 rgb = bodyC*(body + rim) + beadC*bead*(1.4 + 1.4*P)*shim + nozC*noz*edge*2.6;
        gl_FragColor = vec4(rgb*(.78 + .22*P), clamp(body*.8 + rim + bead*.9 + noz*edge, 0.0, 1.0));
      }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 15.7; mesh.visible = false; G.scene.add(mesh);
  let n = 0;
  return {
    mesh,
    // one jet this frame: where its nozzle is, the way it blows, its length, its nozzle's radius, its power (0-1), water or fire, and a number of its own
    add(x, y, z, dx, dy, dz, len, rad, power, wet = 0, seed = 0) { if (n >= cap) return; const o = n++ * 11; data[o] = x; data[o + 1] = y; data[o + 2] = z; data[o + 3] = len; data[o + 4] = dx; data[o + 5] = dy; data[o + 6] = dz; data[o + 7] = rad; data[o + 8] = power; data[o + 9] = wet; data[o + 10] = seed; },
    flush(t) { U.uT.value = t; g.instanceCount = n; mesh.visible = n > 0; if (n) { ib.clearUpdateRanges(); ib.addUpdateRange(0, n * 11); ib.needsUpdate = true; } n = 0; },
  };
}
