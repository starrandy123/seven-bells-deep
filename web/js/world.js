// The seabed and everything that stands on it.
//   world.data · world.heightAt(x, y) · world.biomeAt(x, y) · world.collide(p, r)   (all in Blender coordinates)
//   world.update(dt, camera, focus) · world.setLampsLit(0..1)
// The terrain is one instanced grid displaced by a height texture (CDLOD: patches of one mesh, morphing between levels, so nothing can
// crack and there is no chunk to stream or hitch on). Props are one InstancedMesh a kind, refilled from visible cells inside a budget.
import { createMirror } from './mirror.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { retry } from './config.js';
import { planCities } from './city.js';
import { addIsle, raiseIsle, paintIsle, skyRock, ISLE, lavaLines } from './fireisle.js';
import { createLava } from './lava.js';
import { planRivers, dressRivers, riverGeometry, NO_WATER } from './rivers.js';
import { dressCliffs, slabGeometry, LEAN } from './cliffs.js';
import { dressDunes } from './dunes.js';
import { dressReefCity } from './reefcity.js';
import { fallStrips, FALL_V, FALL_F } from './falls.js';
import { createWetMap } from './wetmap.js';
import { CITY_VERTEX_DECL, CITY_VERTEX_BEND, CITY_PARS, CITY_ALBEDO, CITY_POST, CITY_GLOW } from './city_glsl.js';

const GRID = 16;                                  // quads along a patch's side
const LEVELS = 6;                                 // 20, 40, 80, 160, 320, 640 m patches
const BIOMES = ['reef', 'kelp', 'city', 'trench'];

const IDENTITY = new THREE.Matrix4();
// A buffer's memory otherwise waits for a collection, and the load never gets one: its peak, where a phone's tab dies, holds everything it has already finished with. Only for an array nothing else can reach.
const letGo = (a) => { try { if (a && a.buffer && a.buffer.transfer) a.buffer.transfer(0); } catch (e) { /* the collector has it, as it would have */ } };
const getBin = (u) => retry(() => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.arrayBuffer(); }));
const getJSON = (u) => retry(() => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }));
// A packed grid: a zlib stream of byte planes holding second-order deltas (along the row, then against the row before). Height and weights compress
// hard this way, and the host sends .bin raw. The world's packer writes them; world.json's `files` names what exists, so nothing is probed.
async function unzlib(buf, length) {
  if (typeof DecompressionStream === 'function') return new Uint8Array(await new Response(new Response(buf).body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const { inflate } = await import('./inflate.js');                     // iOS before 16.4
  return inflate(new Uint8Array(buf), length);
}
async function heightFile(url, n) {                                     // lo plane, hi plane; stored at half the precision: 1.07 cm
  const nn = n * n, z = new Uint8Array(await getBin(url)), u = await unzlib(z.buffer, nn * 2), H = new Uint16Array(nn), d = new Int32Array(n);
  for (let j = 0, p = 0; j < n; j++) { let v = 0; for (let i = 0; i < n; i++, p++) { d[i] = (d[i] + (u[p] | u[p + nn] << 8)) & 0xffff; v = (v + d[i]) & 0xffff; H[p] = v * 2; } }
  letGo(u); letGo(z);
  return H.buffer;
}
async function weightFile(url, m) {                                     // r, g, b planes; the fourth weight is what's left of 255
  const mm = m * m, z = new Uint8Array(await getBin(url)), u = await unzlib(z.buffer, mm * 3), out = new Uint8Array(mm * 4), d = new Int32Array(m);
  for (let c = 0; c < 3; c++) { d.fill(0); for (let j = 0, p = 0; j < m; j++) { let v = 0; for (let i = 0; i < m; i++, p++) { d[i] = (d[i] + u[c * mm + p]) & 255; v = (v + d[i]) & 255; out[p * 4 + c] = v; } } }
  for (let p = 0; p < mm; p++) out[p * 4 + 3] = 255 - out[p * 4] - out[p * 4 + 1] - out[p * 4 + 2];
  letGo(u); letGo(z);
  return out.buffer;
}
// A quantized mesh hangs on an unnamed child whose scale and offset undo its integers. That node is folded into float positions here, once, so the
// wind and every other shader keep reading metres, and every reader of the file sees a plain mesh.
function unquantize(glb) {
  if (!glb) return;
  const done = new Set(), v = new THREE.Vector3();
  glb.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, p = g.attributes.position;
    if (!p || (p.array instanceof Float32Array && !done.has(g))) return;
    o.updateMatrix();
    if (!done.has(g)) {
      done.add(g);
      const a = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) v.fromBufferAttribute(p, i).applyMatrix4(o.matrix).toArray(a, i * 3);
      g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      g.boundingBox = g.boundingSphere = null;
    }
    o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.set(1, 1, 1); o.updateMatrix();
  });
  glb.scene.updateMatrixWorld(true);
  glb.parser = null;                                                    // its caches hold the file and every decoded view, all of it already copied or on its way to the GPU
}

// A kind's material family, by its name. The names are the world builder's.
function familyOf(name) {
  if (/palm|snow_pine/.test(name)) return 'palm';
  if (/^ice_(ceiling|pillar|floe|wall|gate)|iceberg/.test(name)) return 'ice';
  if (/^rock_|^slab_|sea_arch|^islet|cliff_rock|beach_rock|kelp_spire|wreck_stand/.test(name)) return 'rock';
  if (/^tree_/.test(name)) return 'tree';
  if (/grass_patch/.test(name)) return 'meadow';
  if (/wildflower/.test(name)) return 'flowers';
  if (/bush|fern|grass_tuft/.test(name)) return 'shrub';
  if (/boat_/.test(name)) return 'boat';
  if (/lava_crack|smoker|forge_hall/.test(name)) return 'lava';
  if (/lamp_ghost/.test(name)) return 'ghost';
  if (/wall_windows|dome_hall|tower|lighthouse/.test(name)) return 'lit';
  if (/kelp/.test(name)) return 'kelp';
  if (/seagrass/.test(name)) return 'grass';
  if (/glow/.test(name)) return 'glow';
  if (/anemone/.test(name)) return 'anemone';
  if (/coral/.test(name)) return 'coral';
  if (/lamp/.test(name)) return 'lamp';
  return 'stone';
}

// Grass: each vertex's height above its tile's plane is its height above the real ground at its own x, z, so tiles lie on any slope.
const MEADOW_V = (uReach) => /* glsl */`
    vec4 ocWp = modelMatrix*instanceMatrix*vec4(transformed, 1.0);
    vec3 ocB = (modelMatrix*instanceMatrix*vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float ocH = max(ocWp.y - ocB.y, 0.0);
    float ocG = texture(tOcHeight, (vec2(ocWp.x - ocMap.x, -ocWp.z - ocMap.y)/ocMap.z + .5)/ocMap.w).r;
    float ocDist = distance(ocWp.xyz, cameraPosition);
    float ocFade = (1.0 - smoothstep(${uReach}*.55, ${uReach}, ocDist))*smoothstep(.25, .75, ocG);
    float ocRd = ocG - texture(tOcRiver, (vec2(ocWp.x - ocMap.x, -ocWp.z - ocMap.y)/ocMap.z + .5)/ocMap.w*ocRiverM.xy - ocRiverM.zw).r;
    ocFade *= ocRd < -2.4 ? 1.0 : smoothstep(-.02, .18, ocRd);      // none under a river (deeper than any channel is a face beside it)
    vec2 ocWu = vec2(ocWp.x - ocWetM.x, ocWetM.y - ocWp.z)*ocWetM.z + .5;
    if (ocWetM.w > 0.0 && ocWu.x > .004 && ocWu.y > .004 && ocWu.x < .996 && ocWu.y < .996) { vec2 ocWv = texture(tOcWet, ocWu).rg; ocFade *= (1.0 - .8*ocWv.x)*(1.0 - smoothstep(.22, .40, ocWv.y)); }      // laid flat where a ride ran, under water in a puddle (wetmap.js)
    vec2 ocBu = vec2(ocWp.x - ocBurnM.x, ocBurnM.y - ocWp.z)*ocBurnM.z + .5;
    if (ocBurnM.w > 0.0 && ocBu.x > .01 && ocBu.y > .01 && ocBu.x < .99 && ocBu.y < .99) ocFade *= smoothstep(.05, .35, 1.0 - texture(tOcBurn, ocBu*vec2(1.0, .5)).r);      // gone where it burnt (scorch.js)
    float ocW1 = sin(dot(ocWp.xz, vec2(.23, .14)) - ocTime*1.75), ocW2 = sin(dot(ocWp.xz, vec2(-.11, .31)) - ocTime*1.13 + 1.3), ocW3 = sin(dot(ocWp.xz, vec2(.91, .67)) - ocTime*3.4);
    float ocGust = ocW1*.62 + ocW2*.38;
    vOcGust = vec2(ocGust, min(ocH*1.4, 1.0));
    ocWp.xz += vec2(.83, .55)*ocH*ocFade*(.26 + .34*ocGust + .07*ocW3);
    ocWp.y = ocG - .02 + ocH*ocFade*(1.0 - .16*max(ocGust, 0.0));
    vec4 mvPosition = viewMatrix*ocWp;
    gl_Position = projectionMatrix*mvPosition;
    vOcP = ocWp.xyz;`;
// Sway written in world space, so a yawed instance sways with the same current as its neighbours.
const TREE_BURN = /* glsl */`
    { vec2 ocBu = vec2(ocB.x - ocBurnM.x, ocBurnM.y - ocB.z)*ocBurnM.z + .5; vBurnT = ocBurnM.w > 0.0 && ocBu.x > .01 && ocBu.y > .01 && ocBu.x < .99 && ocBu.y < .99 ? texture(tOcBurn, ocBu*vec2(1.0, .5)).r : 0.0; }`;
const SWAY = (amp, freq, up) => /* glsl */`
    vec4 ocWp = modelMatrix*instanceMatrix*vec4(transformed, 1.0);
    vec3 ocB = (modelMatrix*instanceMatrix*vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float ocH = max(ocWp.y - ocB.y, 0.0);
    float ocPh = dot(ocB.xz, vec2(.041, .067));
    float ocA = ocH*(${amp})*(1.0 + ocH*(${up}));
    ocWp.x += ocA*(sin(ocTime*.31*${freq} - ocH*.085 + ocPh)*.8 + sin(ocTime*.19*${freq} - ocH*.052 + ocPh*1.7) + .45);
    ocWp.z += ocA*(cos(ocTime*.27*${freq} - ocH*.070 + ocPh*1.3)*.8 + sin(ocTime*.15*${freq} - ocH*.041 + ocPh*.7));
    vec4 mvPosition = viewMatrix*ocWp;
    gl_Position = projectionMatrix*mvPosition;
    vOcP = ocWp.xyz;`;

export async function createWorld({ renderer, scene, camera, look, tier = 'phone', onProgress, base = 'assets/', tweakHeight, packsNow }) {
  const phone = tier === 'phone';
  const prog = (f) => { if (onProgress) onProgress(f); };
  const U = look.uniforms;

  const data = await getJSON(base + 'world.json');
  const FILES = data.files || {}, half = (data.grid - 1) / 2 + 1;
  const [heightBuf, biomeBuf, biome2Buf] = await Promise.all([
    FILES.height ? heightFile(base + FILES.height, data.grid) : getBin(base + 'height.bin'),
    FILES.biome ? weightFile(base + FILES.biome, half) : getBin(base + 'biome.bin'),
    FILES.biome2 ? weightFile(base + FILES.biome2, half) : null,                // (absent on the small map; asked for by name only, as a 404 is a console error)
  ]);
  prog(.2);
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const [propsGLB, creaturesGLB, sandTex, rockTex] = await Promise.all([
    retry(() => loader.loadAsync(base + 'props.glb')).catch(() => null),
    retry(() => loader.loadAsync(base + 'creatures.glb')).catch(() => null),
    new THREE.TextureLoader().loadAsync(base + (FILES.sand_n || 'tex/sand_n.png')).catch(() => null),
    new THREE.TextureLoader().loadAsync(base + (FILES.rock_n || 'tex/rock_n.png')).catch(() => null),
  ]);
  unquantize(propsGLB);
  prog(.7);

  // ---------------------------------------------------------------- height, normals, biome
  const n = data.grid, size = data.size_m, cell = size / (n - 1), ox = data.origin[0], oy = data.origin[1];
  // What's only for the GPU leaves the heap after its upload (a phone has room for it once, not twice), and is rebuilt if a lost context asks for it.
  const freeAfter = (t) => { t.onUpdate = () => { letGo(t.image.data); t.image.data = null; t.onUpdate = null; }; return t; };
  const raw = new Uint16Array(heightBuf), HK = ((data.top_m || 0) + data.depth_scale_m) / 65535;
  const heightFloats = () => { const f = new Float32Array(n * n); for (let i = 0; i < n * n; i++) f[i] = (data.top_m || 0) - raw[i] * HK; return f; };
  const top = data.top_m || 0, Hz = heightFloats();
  // rivers levelled into the land (rivers.js): their channels and the falls' pools are carved here, before anything reads the field, so the ground drawn,
  // the ground walked on and every prop's footing all agree; written back into the 16 bits that heightAt and a lost context's rebuild read
  const riverPlan = planRivers(data, Hz, n, cell, ox, oy);
  addIsle(data); raiseIsle(data, Hz, n, cell, ox, oy);      // the Burnt Isle: the Emberkin's own land, raised here as the rivers are carved, so everything reads the same ground
  if (tweakHeight) tweakHeight(Hz, n, cell, ox, oy);
  if (riverPlan || tweakHeight) for (let i = 0; i < n * n; i++) raw[i] = Math.max(0, Math.min(65535, Math.round((top - Hz[i]) / HK)));

  const tHeight = new THREE.DataTexture(Hz, n, n, THREE.RedFormat, THREE.FloatType);
  tHeight.internalFormat = 'R16F'; tHeight.minFilter = tHeight.magFilter = THREE.LinearFilter; tHeight.needsUpdate = true; freeAfter(tHeight);
  U.tOcHeight.value = tHeight; U.ocMap.value.set(ox, oy, cell, n);
  // the rivers' surface level on the same grid: the ground's shader draws their wet bed and banks from it, and no grass grows under it
  const tRiver = riverPlan ? new THREE.DataTexture(riverPlan.fillLevel(), riverPlan.level.w, riverPlan.level.h, THREE.RedFormat, THREE.FloatType) : null;
  if (tRiver) U.ocRiverM.value.fromArray(riverPlan.level.map);
  if (tRiver) { tRiver.internalFormat = 'R16F'; tRiver.minFilter = tRiver.magFilter = THREE.LinearFilter; tRiver.needsUpdate = true; freeAfter(tRiver); U.tOcRiver.value = tRiver; }
  const wetMap = createWetMap(renderer, U);                              // the water a land ride leaves behind on the ground (wetmap.js)

  // Normals and a cheap sky-visibility term (how far below its neighbourhood a point sits), both from the original 16 bits.
  const nStep = phone && n > 513 ? 2 : 1, nN = (n - 1) / nStep + 1;      // (the big map's slopes at 4 m on a phone: the detail normals carry the rest)
  const normalBytes = (Hz) => {
    const sat = new Float64Array((n + 1) * (n + 1)), w = n + 1;
    for (let y = 0; y < n; y++) { let row = 0; for (let x = 0; x < n; x++) { row += Hz[y * n + x]; sat[(y + 1) * w + x + 1] = sat[y * w + x + 1] + row; } }
    const box = (x, y, r) => { const x0 = Math.max(0, x - r), x1 = Math.min(n, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(n, y + r + 1); return (sat[y1 * w + x1] - sat[y0 * w + x1] - sat[y1 * w + x0] + sat[y0 * w + x0]) / ((x1 - x0) * (y1 - y0)); };
    const out = new Uint8Array(nN * nN * 4), st = nStep;
    for (let j = 0, o = 0; j < nN; j++) for (let i = 0; i < nN; i++, o++) {
      const x = i * st, y = j * st;
      const xa = Hz[y * n + Math.max(x - st, 0)], xb = Hz[y * n + Math.min(x + st, n - 1)], ya = Hz[Math.max(y - st, 0) * n + x], yb = Hz[Math.min(y + st, n - 1) * n + x];
      const fx = (xb - xa) / (2 * cell * st), fy = (yb - ya) / (2 * cell * st), il = 1 / Math.hypot(fx, fy, 1);
      const h = Hz[y * n + x], a = Math.max(0, box(x, y, 5) - h) * .055 + Math.max(0, box(x, y, 16) - h) * .022;
      out[o * 4] = Math.round((-fx * il * .5 + .5) * 255); out[o * 4 + 1] = Math.round((fy * il * .5 + .5) * 255);
      out[o * 4 + 2] = Math.round(255 / (1 + a * a * 2.2 + a)); out[o * 4 + 3] = 255;
    }
    letGo(sat);
    return out;
  };
  const tNormal = (() => {
    const t = new THREE.DataTexture(normalBytes(Hz), nN, nN, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
    return freeAfter(t);
  })();

  // The GPU holds the weights in full. All the game asks of them is which water it's in, and every fourth sample answers that.
  const bn = (n - 1) / 2 + 1, biomeFull = new Uint8Array(biomeBuf), BS = 4, bc = (bn - 1) / BS + 1;
  const coarse = (src) => { const o = new Uint8Array(bc * bc * 4); for (let y = 0; y < bc; y++) for (let x = 0; x < bc; x++) for (let c = 0; c < 4; c++) o[(y * bc + x) * 4 + c] = src[(y * BS * bn + x * BS) * 4 + c]; return o; };
  const biomeBytes = coarse(biomeFull);
  // On a phone on the big map the GPU's copy is half size too: a weight changes slowly, and 8 m a sample shows nothing.
  const wStep = phone && bn > 257 ? 2 : 1, wN = (bn - 1) / wStep + 1;
  const smaller = (src) => { if (wStep === 1) return src; const o = new Uint8Array(wN * wN * 4); for (let y = 0; y < wN; y++) for (let x = 0; x < wN; x++) for (let c = 0; c < 4; c++) o[(y * wN + x) * 4 + c] = src[(y * wStep * bn + x * wStep) * 4 + c]; return o; };
  const tBiome = freeAfter(new THREE.DataTexture(smaller(biomeFull), wN, wN, THREE.RGBAFormat, THREE.UnsignedByteType));
  tBiome.minFilter = THREE.LinearMipmapLinearFilter; tBiome.magFilter = THREE.LinearFilter; tBiome.generateMipmaps = true; tBiome.needsUpdate = true;

  // The second weight file: cinder, ice, wrack, none. Absent on the small map.
  const biome2Full = biome2Buf ? paintIsle(new Uint8Array(biome2Buf), bn, 2 * cell, ox, oy) : null, biome2Bytes = biome2Full ? coarse(biome2Full) : null;
  const tBiome2 = biome2Bytes ? freeAfter(new THREE.DataTexture(smaller(biome2Full), wN, wN, THREE.RGBAFormat, THREE.UnsignedByteType)) : new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  tBiome2.minFilter = biome2Bytes ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; tBiome2.magFilter = THREE.LinearFilter; tBiome2.generateMipmaps = !!biome2Bytes; tBiome2.needsUpdate = true;

  const detail = (t) => {
    if (!t) return U.tOcNoise.value;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = phone ? 4 : 8;
    return t;
  };

  // ---------------------------------------------------------------- CPU copies of the same field
  const crv = (a, b, c, d, t) => b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
  function heightAt(x, y) {
    let fx = (x - ox) / cell, fy = (y - oy) / cell;
    fx = fx < 0 ? 0 : fx > n - 1.001 ? n - 1.001 : fx; fy = fy < 0 ? 0 : fy > n - 1.001 ? n - 1.001 : fy;
    const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * n + ix, H = raw;
    if (ix < 1 || iy < 1 || ix > n - 3 || iy > n - 3) return top - HK * (H[o] * (1 - ax) * (1 - ay) + H[o + 1] * ax * (1 - ay) + H[o + n] * (1 - ax) * ay + H[o + n + 1] * ax * ay);
    const r0 = crv(H[o - n - 1], H[o - n], H[o - n + 1], H[o - n + 2], ax), r1 = crv(H[o - 1], H[o], H[o + 1], H[o + 2], ax);
    const r2 = crv(H[o + n - 1], H[o + n], H[o + n + 1], H[o + n + 2], ax), r3 = crv(H[o + 2 * n - 1], H[o + 2 * n], H[o + 2 * n + 1], H[o + 2 * n + 2], ax);
    return top - HK * crv(r0, r1, r2, r3, ay);
  }
  function biomeWeights(x, y, out = [0, 0, 0, 0]) {
    let fx = (x - ox) / (2 * BS * cell), fy = (y - oy) / (2 * BS * cell);
    fx = Math.max(0, Math.min(bc - 1.001, fx)); fy = Math.max(0, Math.min(bc - 1.001, fy));
    const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy;
    for (let c = 0; c < 4; c++) {
      const a = biomeBytes[(iy * bc + ix) * 4 + c], b = biomeBytes[(iy * bc + ix + 1) * 4 + c], d = biomeBytes[((iy + 1) * bc + ix) * 4 + c], e = biomeBytes[((iy + 1) * bc + ix + 1) * 4 + c];
      out[c] = (a * (1 - ax) * (1 - ay) + b * ax * (1 - ay) + d * (1 - ax) * ay + e * ax * ay) / 255;
    }
    return out;
  }
  function biomeAt(x, y) { const w = biomeWeights(x, y); let b = 0; for (let i = 1; i < 4; i++) if (w[i] > w[b]) b = i; return BIOMES[b]; }

  // ---------------------------------------------------------------- terrain: one grid, many patches
  const leafS = cell * GRID / 2;                  // the nearest level has a vertex between the map's samples, on a smooth curve through them (heightAt reads the same curve)
  const ranges = Array.from({ length: LEVELS }, (_, i) => (phone ? 39 : 52) * Math.pow(2, i));
  const nodes = (() => {
    const scan = (x0, z0, s) => {                       // three.js x, z of the corner, size
      let lo = 1e9, hi = -1e9;
      const step = cell * 2.5;
      for (let z = z0; z <= z0 + s + .01; z += step) for (let x = x0; x <= x0 + s + .01; x += step) { const h = heightAt(x, -z); if (h < lo) lo = h; if (h > hi) hi = h; }
      return [lo, hi];
    };
    const make = (x0, z0, s, level) => {
      // two numbers for its height, not a box of its own: ten thousand nodes held 1.5 MB of boxes (a heap snapshot, 2 Nov). pick() builds the box when it needs one
      const node = { x0, z0, s, level, kids: null, lo: 0, hi: 0 };
      let lo, hi;
      if (level > 1) {                                  // (the nearest level has no nodes: see pick. On the big map a fourth of the tree)
        const m = s / 2;
        node.kids = [make(x0, z0, m, level - 1), make(x0 + m, z0, m, level - 1), make(x0, z0 + m, m, level - 1), make(x0 + m, z0 + m, m, level - 1)];
        lo = Math.min(...node.kids.map(k => k.lo)); hi = Math.max(...node.kids.map(k => k.hi));
      } else [lo, hi] = scan(x0, z0, s);
      node.lo = lo - .5; node.hi = hi + .5;
      return node;
    };
    const roots = [], rs = leafS * Math.pow(2, LEVELS - 1);
    const nr = Math.ceil(size / rs);                                    // one ring of roots past the edge: the seabed runs on under the fog
    for (let i = -1; i <= nr; i++) for (let j = -1; j <= nr; j++) roots.push(make(ox + i * rs, -oy - size + j * rs, rs, LEVELS - 1));
    return roots;
  })();

  const CAP = 520;
  const tGeo = new THREE.InstancedBufferGeometry();
  {
    const v = GRID + 1, pos = new Float32Array(v * v * 3), idx = [];
    for (let z = 0, o = 0; z < v; z++) for (let x = 0; x < v; x++, o++) { pos[o * 3] = x / GRID; pos[o * 3 + 2] = z / GRID; }
    for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
      const a = z * v + x, b = a + 1, c = a + v, d = c + 1;
      if ((x + z) & 1) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
    }
    tGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tGeo.setIndex(idx);
    tGeo.setAttribute('aNode', new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage));
    tGeo.instanceCount = 0;
  }
  const tRockDetail = detail(rockTex);
  const terrainU = { ...U, tNormal: { value: tNormal }, tBiome: { value: tBiome }, tBiome2: { value: tBiome2 }, tSand: { value: detail(sandTex) }, tRock: { value: tRockDetail }, uRange: { value: ranges }, uFocus: { value: new THREE.Vector4(0, -1e4, 0, 0) } };
  const terrainMat = new THREE.ShaderMaterial({
    uniforms: terrainU,
    vertexShader: /* glsl */`
      attribute vec4 aNode;
      uniform highp sampler2D tOcHeight; uniform vec4 ocMap; uniform float uRange[${LEVELS}];
      varying vec3 vP;
      vec2 muv(vec2 p) { return (vec2(p.x - ocMap.x, -p.y - ocMap.y)/ocMap.z + .5)/ocMap.w; }
      float cr(float a, float b, float c, float d, float t) { return b + .5*t*(c - a + t*(2.0*a - 5.0*b + 4.0*c - d + t*(3.0*(b - c) + d - a))); }
      float crRow(ivec2 o, int j, float t) {
        ivec2 q = o + ivec2(0, j);
        return cr(texelFetch(tOcHeight, q + ivec2(-1, 0), 0).r, texelFetch(tOcHeight, q, 0).r, texelFetch(tOcHeight, q + ivec2(1, 0), 0).r, texelFetch(tOcHeight, q + ivec2(2, 0), 0).r, t);
      }
      float heightCR(vec2 p) {
        vec2 G = vec2(p.x - ocMap.x, -p.y - ocMap.y)/ocMap.z, i = clamp(floor(G), vec2(1.0), vec2(ocMap.w - 3.0)), t = clamp(G - i, 0.0, 1.0);
        ivec2 o = ivec2(i);
        return cr(crRow(o, -1, t.x), crRow(o, 0, t.x), crRow(o, 1, t.x), crRow(o, 2, t.x), t.y);
      }
      void main() {
        vec2 g = position.xz*${GRID}.0;
        vec2 p = aNode.xy + position.xz*aNode.z;
        float y0 = texture(tOcHeight, muv(p)).r;
        float r = uRange[int(aNode.w + .5)];
        float d = distance(vec3(p.x, y0, p.y), cameraPosition);
        float morph = clamp((d - r*.62)/(r*.30), 0.0, 1.0);
        vec2 f = fract(g*.5)*2.0;
        vec2 q = aNode.xy + (g - f*morph)/${GRID}.0*aNode.z;
        float y = aNode.w < .5 ? heightCR(q) : texture(tOcHeight, muv(q)).r;
        vP = vec3(q.x, y, q.y);
        gl_Position = projectionMatrix*viewMatrix*vec4(vP, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vP;
      ${look.glsl}
      uniform sampler2D tNormal, tBiome, tBiome2, tSand, tRock, tGlow;
      uniform vec4 uFocus;
      uniform vec3 ocLandSand, ocLandWet, ocLandGL, ocLandGD, ocLandJ, ocLandRL, ocLandRD, ocLandP;
      vec2 muv(vec2 p) { return (vec2(p.x - ocMap.x, -p.y - ocMap.y)/ocMap.z + .5)/ocMap.w; }
      // A tile read square to the surface: read from above, a steep bank smears it down the slope.
      vec4 ocTile(vec3 P, vec3 N, float f, vec2 off, float sl) {
        vec4 a = texture(tOcNoise, P.xz*f + off);
        if (sl < .10) return a;
        float k = N.x*N.x/(N.x*N.x + N.z*N.z + .0001);
        vec4 b = texture(tOcNoise, P.zy*f + off)*k + texture(tOcNoise, P.xy*f + off)*(1.0 - k);
        return mix(a, b, smoothstep(.10, .30, sl));
      }
      const vec3 SAND = vec3(.80, .69, .45), SILT = vec3(.30, .32, .20), PAVE = vec3(.60, .58, .50), OOZE = vec3(.022, .030, .050);
      const vec3 RK_REEF = vec3(.34, .30, .25), RK_KELP = vec3(.17, .18, .13), RK_CITY = vec3(.46, .46, .41), RK_DEEP = vec3(.030, .040, .062);
      void main() {
        vec3 P = vP;
        vec2 uv = muv(P.xz);
        vec4 nt = texture(tNormal, uv, 1.1);
        vec2 nn = nt.rg*2.0 - 1.0;
        vec3 N = vec3(nn.x, sqrt(max(1.0 - dot(nn, nn), 0.0)), nn.y);
        vec4 bw = texture(tBiome, uv);
        float D = max(-P.y, 0.0);
        float slope = 1.0 - N.y;
        float m1 = texture(tOcNoise, P.xz*.0043).a, m2 = ocTile(P, N, .0191, vec2(.3), slope).a;
        float macro = m1*.62 + m2*.38;
        float rock = smoothstep(.10, .26, slope + (macro - .5)*.16);

        // fine surface: sand ripples on the flats; rock laid on from the side where the walls are steep
        vec2 sandN = texture(tSand, P.xz*.19).rg - .5;
        vec3 rockN;
        if (rock > .01) {
          vec2 a = texture(tRock, P.xz*.09).rg - .5;
          vec3 w = abs(N); w *= w; w *= w; w /= (w.x + w.y + w.z);
          if (slope > .22) {
            vec2 b = texture(tRock, P.zy*.09).rg - .5, c = texture(tRock, P.xy*.09).rg - .5;
            rockN = vec3(b.x*w.x + c.x*w.z + a.x*w.y, 0.0, c.y*w.z + a.y*w.y + b.y*w.x);
          } else rockN = vec3(a.x, 0.0, a.y);
        } else rockN = vec3(0.0);
        // ripples a wave leaves: steep on one side, a little bent, with the odd larger one
        float camD = length(P - cameraPosition);
        const vec2 dir = vec2(.832, .555);
        float ph = dot(P.xz, dir)*6.4 + m1*17.0 + (m2 - .5)*9.0;
        float rip = sin(ph + .8*sin(ph));
        float ph2 = dot(P.xz, vec2(-.555, .832))*1.7 + m2*9.0;
        float dry = smoothstep(-.8, .4, P.y);                                        // sand ripples belong to the sea
        vec2 wand = vec2(m1 - .5, m2 - .5)*9.0;                                      // the tile's own place wanders, so it doesn't repeat
        float ripW = (1.0 - rock)*(bw.r + bw.g*.5)*(1.0 - smoothstep(10.0, 44.0, camD))*(1.0 - dry);
        N.xz += dir*rip*.17*ripW + dir.yx*sin(ph2)*.07*ripW;
        vec3 Nbase = N;
        N.xz += (sandN*.34*(1.0 - rock)*(1.0 - bw.a*.85) + rockN.xz*.95*rock)*(1.0 - dry);
        if (dry > 0.0) {
          vec2 ln = ocTile(P, Nbase, .277, wand, slope).rg - .5, lm = ocTile(P.zyx, Nbase.zyx, .083, vec2(.2), slope).rg - .5;
          N.xz += (ln*.22*(1.0 - .55*texture(tBiome2, uv).g)*(1.0 - smoothstep(24.0, 90.0, camD)) + lm*.45*(1.0 - rock*.85))*dry;
          N.xz += rockN.xz*.95*rock*dry;
        }
        N = normalize(N);

        // albedo by biome, shaded by the two macro scales
        vec3 flat_ = SAND*bw.r + SILT*bw.g + PAVE*bw.b + OOZE*bw.a;
        vec3 wall = RK_REEF*bw.r + RK_KELP*bw.g + RK_CITY*bw.b + RK_DEEP*bw.a;
        flat_ *= .78 + .44*macro;
        if (camD < 46.0) { float grain = texture(tOcNoise, P.xz*1.9).a, fine = texture(tOcNoise, P.zx*5.3).b; flat_ *= 1.0 + mix(-.14 + .28*mix(grain, fine, .5), 0.0, smoothstep(30.0, 46.0, camD)); flat_ *= 1.0 + .10*rip*ripW; }
        wall *= .62 + .76*m2;
        float rockT = rock > .01 ? ocRockTone(P) : 1.0;
        wall *= rockT;
        wall = mix(wall, wall*vec3(.62, .90, .66), smoothstep(.45, .75, m1)*N.y);
        vec4 b2 = texture(tBiome2, uv);
        flat_ = mix(mix(mix(flat_, vec3(.040, .036, .040), b2.r), vec3(.56, .72, .84)*(.8 + .3*macro), b2.g), vec3(.20, .21, .18)*(.8 + .4*macro), b2.b);
        wall = mix(mix(mix(wall, vec3(.030, .024, .026)*(.7 + .9*m2), b2.r), vec3(.40, .60, .76)*(.7 + .6*m2), b2.g), vec3(.13, .14, .12)*(.7 + .7*m2), b2.b);
        vec3 alb = mix(flat_, wall, rock); float ocEmb = 0.0;
        // above the tide: white sand, then green, then grey and black rock; wet sand along the waterline
        float wetK = 0.0, wetPud = 0.0;
        if (P.y > -3.0) {
          float hA = P.y + (m2 - .5)*2.2;
          float lap = .22*sin(ocTime*.55 + P.x*.021 + P.z*.017) + .10*sin(ocTime*.91 - P.x*.043);
          wetK = 1.0 - smoothstep(.15, 1.05, P.y - lap + (m1 - .5)*.5);
          float n3 = ocTile(P, Nbase, .083, vec2(.0), slope).b, n4 = mix(ocTile(P.zyx, Nbase.zyx, .27, wand, slope).a, .5, smoothstep(24.0, 110.0, camD));
          vec3 beach = mix(ocLandSand*(.88 + .16*macro + .10*n4), ocLandWet, wetK*.9);
          // the bands of a real shore: the bare berm, then a foredune where dune grass comes in by clumps, then the green. Dune grass is paler and drier than a meadow's, and the sand shows between it
          float upBeach = smoothstep(1.0, 3.8, hA + (n4 - .5)*1.3), clumps = mix(smoothstep(.42, .60, n3*.5 + n4*.5 + upBeach*.3 - .1), .42, smoothstep(26.0, 80.0, camD));
          vec3 duneG = mix(ocLandGL*vec3(1.05, .96, .72), ocLandGD*vec3(1.1, 1.02, .78), n4); beach = mix(beach, duneG, clumps*upBeach*(1.0 - wetK));
          float mdw = ocMeadow(P.xz);
          vec3 grass = mix(ocLandGD, ocLandGL, smoothstep(.26, .74, mdw + (n4 - .5)*.12))*ocMeadowTint(P.xz);
          vec3 jungle = mix(ocLandJ*.32, ocLandJ, n3*.6 + n4*.4);
          vec3 green = mix(grass, jungle, smoothstep(.34, .66, macro*.6 + n3*.4)*smoothstep(4.0, 12.0, hA));
          float steep = smoothstep(.20, .40, slope + (m2 - .5)*.14);
          vec3 stone = mix(ocLandRD, ocLandRL, smoothstep(.3, .72, n3*.6 + n4*.4));
          stone *= rockT;
          vec3 pale = mix(ocLandP*.5, ocLandP, smoothstep(.3, .72, n3*.6 + n4*.4));
          vec3 black = mix(vec3(.014, .014, .018), vec3(.075, .072, .08), smoothstep(.3, .75, n3*.5 + n4*.5));
          float bsum = max(bw.r + bw.g + bw.b + bw.a, .001);
          vec3 ground = (beach*bw.r + mix(beach, green, smoothstep(1.2, 3.6, hA + (n4 - .5)*1.6))*bw.g + pale*bw.b + black*bw.a)/bsum;
          ground = mix(ground, stone*(.6 + 1.2*bw.b + .2*bw.r) + black*bw.a*.5, steep*(1.0 - bw.r*.4));
          ground = mix(ground, vec3(.40, .43, .48)*(.90 + .16*macro), b2.g*(1.0 - steep*.7));          // snow: a little under what the sun will make white
          // ash and black rock: basalt where it's bare, a rust of oxidised lava in patches, sulphur near the vents, as a real lava field has
          vec3 ashC = mix(vec3(.034, .031, .034)*(.8 + .7*n3), vec3(.062, .040, .034)*(.8 + .5*n4), .55*smoothstep(.46, .78, n3*.45 + n4*.3 + macro*.25)); ashC = mix(ashC, vec3(.24, .19, .06)*(.7 + .5*n4), smoothstep(.68, .82, n4*.5 + macro*.5)*smoothstep(38.0, 70.0, P.y));
          // the isle in bands, measured off real volcanic ground (Pipeline/research/CITY_SOURCES.md): it isn't black. Black sand at the shore; a lapilli plain in wind ripples; smooth sheets with dark cracks near the lava; an oxidised cone in strata; fumarole fields, the brightest ground there is
          { float Hh = b2.a, rip = .9 + .2*sin(dot(P.xz, vec2(1.3, .7)) + n4*6.0);
            vec3 lap = mix(vec3(.078, .082, .088), vec3(.171, .171, .168), smoothstep(.25, .8, n3*.6 + macro*.4))*rip;
            vec3 sheet = mix(vec3(.107, .093, .10), vec3(.19, .165, .177), n4)*(1.0 - .85*(1.0 - smoothstep(.0, .06, abs(fract(n3*6.0 + macro*2.0) - .5))));
            vec3 cone = mix(vec3(.165, .125, .06), vec3(.40, .29, .13), smoothstep(.35, .65, fract(P.y*.09 + n4*.6)))*(.85 + .3*n3);
            vec3 fum = mix(vec3(.35, .26, .18), vec3(.59, .49, .36), n4*.7 + macro*.3);
            vec3 shore = mix(vec3(.036, .038, .045), vec3(.0075, .0086, .0128), 1.0 - smoothstep(.3, 1.2, P.y));
            float wS = smoothstep(.22, .45, Hh)*(1.0 - smoothstep(.75, .95, Hh)), wC = smoothstep(26.0, 44.0, P.y)*(1.0 - smoothstep(92.0, 100.0, P.y)), wF = smoothstep(.6, .75, Hh)*smoothstep(.76, .84, macro + n3*.08)*(1.0 - wC);
            vec3 band = mix(mix(mix(lap, sheet, wS), cone, wC), fum, wF);
            band = mix(band, shore, 1.0 - smoothstep(.8, 1.8, P.y));
            ashC = mix(ashC, band, .85); }
          ground = mix(ground, ashC, b2.r);
          if (camD < 60.0) ground *= mix(.82 + .36*ocTile(P, Nbase, 1.7, wand, slope).a, 1.0, smoothstep(34.0, 60.0, camD));
          alb = mix(alb, ground, smoothstep(-2.8, -.5, P.y));
          // a river's bed and banks (rivers.js): under its water a bed of stones, mossy where it's deep, the sun's ripples running over it; along its edge a
          // band of damp, darker earth with a sheen on it, its edge wandering as a real one does
          float rUnder = texture(tOcRiver, uv*ocRiverM.xy - ocRiverM.zw).r - P.y;
          if (rUnder > -1.4 && rUnder < 2.4) {                // (deeper than any channel is a rock face beside the water, not its bed)
            float damp = smoothstep(-1.05 + (n4 - .5)*.6, -.04, rUnder), bedK = smoothstep(-.06, .10, rUnder);
            float st = texture(tOcNoise, P.xz*.045 + wand*.01).a, pb = texture(tOcNoise, P.zx*.15 + .37).b;      // read from above: a bank's slope mustn't smear it into stripes
            vec3 bedC = mix(vec3(.075, .068, .052), vec3(.22, .20, .155), smoothstep(.50, .70, st*.7 + pb*.3))*(.8 + .4*n3);
            bedC = mix(bedC, bedC*vec3(.62, .86, .58), smoothstep(.25, 1.0, rUnder)*smoothstep(.4, .7, macro));
            float caus = texture(tOcNoise, P.xz*.042 + vec2(ocTime*.0061, ocTime*.0040)).b*texture(tOcNoise, P.xz*.033 - vec2(ocTime*.0045, -ocTime*.0068)).a;
            bedC *= 1.0 + smoothstep(.20, .42, caus)*.45*smoothstep(.04, .25, rUnder)*(1.0 - smoothstep(.4, 1.6, rUnder));
            alb = mix(alb, alb*vec3(.52, .54, .50), damp*(1.0 - bedK));
            alb = mix(alb, bedC, bedK);
            wetK = max(wetK, max(damp*.75, bedK));
          }
          // the water a land ride left (wetmap.js): the ground soaked dark and shining, and puddles standing in it, broken up by the ground's own grain
          vec2 wu = vec2(P.x - ocWetM.x, ocWetM.y - P.z)*ocWetM.z + .5;
          if (ocWetM.w > 0.0 && wu.x > .004 && wu.y > .004 && wu.x < .996 && wu.y < .996) {
            vec4 wm = texture(tOcWet, wu);
            float soak = wm.r*(1.0 - .35*smoothstep(.15, .45, slope));
            alb *= 1.0 - .46*soak;
            wetK = max(wetK, soak);
            wetPud = smoothstep(.30, .46, wm.g + (n4 - .5)*.32 + (m2 - .5)*.20)*(1.0 - smoothstep(.10, .26, slope));
          }
          // what fire and ice left (scorch.js): black ground with a net of red points in it, a sheet of frost, both broken up by the ground's own grain, never a soft circle
          vec2 bu = vec2(P.x - ocBurnM.x, ocBurnM.y - P.z)*ocBurnM.z + .5;
          if (ocBurnM.w > 0.0 && bu.x > .01 && bu.y > .01 && bu.x < .99 && bu.y < .99) {
            vec4 bm = texture(tOcBurn, bu*vec2(1.0, .5)); float be = (n4 - .5)*.34 + (m2 - .5)*.22, bf = smoothstep(.44, .56, bm.b + be*1.3);
            alb = mix(alb, vec3(.018, .016, .015) + vec3(.03)*n4, smoothstep(.44, .56, bm.r + be));
            alb = mix(alb, mix(vec3(.50, .60, .68), vec3(.78, .86, .92), m2), bf);
            float bn = texture(tOcNoise, P.xz*.73).g*.6 + n4*.4; ocEmb = bm.a*smoothstep(.80 - .17*bm.a, .84 - .15*bm.a, bn)*(1.0 - bf);
          }
        }
        if (bw.b > .08) {
          vec2 fg = P.xz/vec2(4.4, 2.9); float row = floor(fg.y); fg.x += mod(row, 2.0)*.5;
          vec2 id = floor(fg), ff = fract(fg);
          float jw = fwidth(fg.y)*1.4 + .02;
          float joint = mix(1.0, smoothstep(0.0, jw*.7, min(ff.x, 1.0 - ff.x))*smoothstep(0.0, jw, min(ff.y, 1.0 - ff.y)), 1.0 - smoothstep(26.0, 72.0, length(P - cameraPosition)));
          float tone = texture(tOcNoise, id*.0371).a;
          float drift = smoothstep(.34, .62, macro + (m2 - .5)*.4);                  // sand has drifted over much of it
          float paved = bw.b*(1.0 - rock)*(1.0 - drift*.86)*(1.0 - b2.g);        // (the Frost Isle's land is city weight under its snow: no bricks there)
          alb *= mix(vec3(1.0), mix(vec3(.46), vec3(.78 + .46*tone, .76 + .46*tone, .70 + .46*tone), joint), paved);
          alb = mix(alb, alb*vec3(.50, .74, .56), smoothstep(.56, .74, m2)*paved*.8);
        }
        float ao = nt.b;

        // the moving shadow of what swims above
        vec3 sunB = P.y > 0.0 ? ocSunA : ocSunW;
        float fh = max(uFocus.y - P.y, 0.0);
        vec2 fd = P.xz - (uFocus.xz - sunB.xz/sunB.y*fh*.9);                         // the body's shadow falls along the sun, drawn out by height
        vec2 sa = normalize(sunB.xz + 1e-4); float fa = dot(fd, sa), fb = dot(fd, vec2(-sa.y, sa.x));
        float fw = uFocus.w*(1.0 + fh*.05);
        float blob = 1.0 - (.55 + .2*ocPaint)*exp(-(fa*fa*.42 + fb*fb)/(fw*fw + .001))*smoothstep(0.0, 20.0, 30.0 - fh);

        float ndl = max(dot(N, ocSunW), 0.0);
        float lit = ocSunLit(P, D);
        float ca = ocCaustics(P, D, ndl);
        vec3 down = exp(-ocKd*D/ocSunW.y)*ocSunGain;
        vec3 c = alb*(ocSunCol*.45*down*ndl*lit*blob*ca + ocAmbient(N, D)*.36*(.35 + .65*ao) + ocNearFill(P, D));
        float airK = smoothstep(-.25, .25, P.y);
        if (airK > 0.0) {
          // in the air the sun is the sun, and the sky is the fill
          vec3 sky = vec3(.40, .54, .76)*ocHemi*(.45 + .55*N.y)*(.35 + .65*ao);
          vec3 inAir = alb*(ocSunCol*.66*max(dot(N, ocSunA), 0.0)*blob*lit + sky*.72);
          vec3 Hv = normalize(ocSunA + normalize(cameraPosition - P));
          float spec = pow(max(dot(N, Hv), 0.0), 60.0)*wetK;
          c = mix(c, inAir + vec3(1.0, .94, .84)*spec*1.6, airK);
          if (wetPud > 0.0) {                                  // a puddle: the sky in a still sheet of water, the sun's glint in it, the ground dark under it
            vec3 Vp = normalize(cameraPosition - P);
            float Fp = .03 + .97*pow(1.0 - max(Vp.y, 0.0), 5.0);
            vec2 rp = vec2(texture(tOcNoise, P.xz*.06 + ocTime*.004).b, texture(tOcNoise, P.zx*.06 - ocTime*.003).a) - .5;     // a breath of ripple
            vec3 Np = normalize(vec3(rp.x*.08, 1.0, rp.y*.08)), Rp = reflect(-Vp, Np);
            vec3 skyP = mix(vec3(.62, .74, .86), vec3(.34, .52, .78), smoothstep(0.0, .7, Rp.y))*ocHemi;
            vec3 pud = mix(c*.32, skyP, .18 + .7*Fp) + vec3(1.0, .95, .85)*pow(max(dot(Rp, ocSunA), 0.0), 420.0)*2.4;
            c = mix(c, pud, wetPud*airK*.92);
          }
        }
        if (ocPaint > 0.0) {
          // the painted ground: colours from the table, underwater rock too; the same ramp as everything else
          vec3 pa = alb;
          if (P.y < -.5) {
            float tn = smoothstep(.3, .7, m1*.5 + m2*.5);
            vec3 pSand = mix(ocLandSand*.86, ocLandSand*1.06, tn);
            pa = mix(mix(pSand, flat_*1.5, bw.g + bw.b*.6 + bw.a), mix(ocLandRD, ocLandRL, smoothstep(.3, .7, m2))*(1.0 - bw.a*.7), rock);
            pa = mix(mix(pa, vec3(.070, .055, .058)*(.8 + .6*m2), b2.r), vec3(.15, .18, .17)*(.8 + .5*m2), b2.b);      // basalt, the wrecks' grey silt
          }
          vec3 Np = normalize(mix(N, Nbase, .86));
          if (airK > 0.0) {
            float st = smoothstep(.16, .36, 1.0 - Nbase.y + (m2 - .5)*.12);
            vec3 warm = mix(ocLandRL, ocLandP, .6), cool = mix(ocLandRD, ocLandRL, .35);
            vec3 rk = mix(cool, warm, smoothstep(.1, .62, dot(Nbase, ocSunA) + (m1 - .5)*.3))*rockT;
            rk = mix(rk, ocLandGD*1.3, smoothstep(.76, .92, Nbase.y)*smoothstep(.4, .7, m2));
            pa = mix(pa, rk, st*airK*(1.0 - bw.r*.5));
          }
          vec3 pc = ocPaintLit(pa, Np, P, D, lit*blob, mix(ca, 1.0, airK));
          pc += pa*ocSunCol*.09*(ca - 1.0)*(1.0 - airK)*down;
          c = mix(c, pc, ocPaint);
        }
        vec4 gw = texture(tGlow, uv);
        float beat = .72 + .28*sin(ocTime*1.1 + P.x*.05 + P.z*.07);
        c += alb*(vec3(.16, 1.3, 1.15)*gw.r*beat + vec3(1.5, .3, 1.0)*gw.g*beat)*(1.0 + 8.0*bw.a)*1.6 + (alb + .05)*vec3(1.5, .82, .30)*(gw.b*ocLamps + gw.a)*2.8;
        c += (alb + .03)*(ocPool(P, N) + ocNear(P, N) + ocFire(P, N)) + vec3(1.0, .22, .04)*ocEmb*2.0;
        c = ocApply(c, P);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const terrain = new THREE.Mesh(tGeo, terrainMat); terrain.frustumCulled = false; terrain.renderOrder = 0;
  scene.add(terrain);

  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), near = new THREE.Vector3();
  let FAR = 460;                                  // in the water nothing is seen past this; from the air the other island is
  let picked = 0;
  const leafBox = new THREE.Box3(), nodeBox = new THREE.Box3();
  function pick(node, cam) {
    nodeBox.min.set(node.x0, node.lo, node.z0); nodeBox.max.set(node.x0 + node.s, node.hi, node.z0 + node.s); nodeBox.clampPoint(cam, near);
    const d = near.distanceTo(cam);
    if (d > FAR || !frustum.intersectsBox(nodeBox)) return;
    if (d > ranges[node.level - 1]) {
      if (picked < CAP) { tGeo.attributes.aNode.setXYZW(picked, node.x0, node.z0, node.s, node.level); picked++; }
      return;
    }
    if (node.kids) { for (const k of node.kids) pick(k, cam); return; }
    const m = node.s / 2;                               // four nearest patches, in the box of the node that holds them
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const x = node.x0 + i * m, z = node.z0 + j * m;
      leafBox.min.set(x, node.lo, z); leafBox.max.set(x + m, node.hi, z + m);
      if (picked < CAP && frustum.intersectsBox(leafBox)) { tGeo.attributes.aNode.setXYZW(picked, x, z, m, 0); picked++; }
    }
  }
  function updateTerrain(camera) {
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
    FAR = camera.position.y > -1.5 ? 860 : 460;
    picked = 0; for (const r of nodes) pick(r, camera.position);
    tGeo.instanceCount = picked;
    const a = tGeo.attributes.aNode; a.clearUpdateRanges(); a.addUpdateRange(0, picked * 4); a.needsUpdate = true;
  }

  // ---------------------------------------------------------------- instances
  const lit = (o) => new THREE.MeshLambertMaterial(o);
  const MATS = {
    // rock: the terrain's own rock detail, laid on from the three axes; strata and weed; near pixels only pay for the fine normals
    rock: () => look.patch(lit({ vertexColors: true }), {
      key: 'rock', uniforms: { tRockN: { value: tRockDetail } }, fragmentPars: 'uniform sampler2D tRockN;\n',
      albedo: /* glsl */`{ float ocN1 = texture(tOcNoise, vOcP.xz*.031 + vOcP.y*vec2(.017, -.011)).a, ocN2 = texture(tOcNoise, vOcP.zx*.13 + vOcP.y*vec2(.07, .05)).b;
        diffuseColor.rgb *= (.70 + .56*ocN2)*ocRockTone(vOcP);
        float ocAl = smoothstep(.42, .70, ocN1*.7 + ocN2*.3)*smoothstep(1.2, -.6, vOcP.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(.40, .68, .46) + vec3(.006, .02, .012), ocAl*.8); }`,
      normalHook: /* glsl */`{ vec3 ocCam = vOcP - cameraPosition;
        if (dot(ocCam, ocCam) < 8100.0) {
          vec3 ocWn = normalize((vec4(normal, 0.0)*viewMatrix).xyz);
          vec3 ocW = abs(ocWn); ocW *= ocW; ocW /= (ocW.x + ocW.y + ocW.z);
          vec2 ocA = texture(tRockN, vOcP.zy*.085).rg - .5, ocB = texture(tRockN, vOcP.xz*.085).rg - .5, ocC2 = texture(tRockN, vOcP.xy*.085).rg - .5;
          vec3 ocD2 = vec3(0.0, ocA.x, ocA.y)*ocW.x + vec3(ocB.x, 0.0, ocB.y)*ocW.y + vec3(ocC2.x, ocC2.y, 0.0)*ocW.z;
          ocWn = normalize(ocWn + ocD2*1.5);
          normal = normalize((viewMatrix*vec4(ocWn, 0.0)).xyz);
        } }`,
    }),
    // ice: pale, lit from within where it is thin; light falls through it from above
    ice: () => look.patch(lit({ vertexColors: true }), {
      wrap: .8, key: 'ice',
      fragmentPost: /* glsl */`{ vec3 ocV = normalize(vOcP - cameraPosition);
        float ocUp = smoothstep(-.9, .4, ocV.y), ocN1 = texture(tOcNoise, vOcP.xz*.11 + vOcP.y*.07).a;
        outgoingLight += diffuseColor.rgb*vec3(.34, .72, .96)*(.34 + .66*ocUp)*(.65 + .7*ocN1)*exp(-ocKd*max(-vOcP.y, 0.0)*.5); }`,
    }),
    stone: () => look.patch(lit({ vertexColors: true }), {
      key: 'stone',
      albedo: /* glsl */`{ float ocN1 = texture(tOcNoise, vOcP.xz*.037 + vOcP.y*vec2(.021, -.013)).a, ocN2 = texture(tOcNoise, vOcP.zx*.17 + vOcP.y*vec2(.09, .07)).b;
        float ocAl = smoothstep(.40, .68, ocN1*.72 + ocN2*.28)*smoothstep(1.2, -.6, vOcP.y);
        diffuseColor.rgb = mix(diffuseColor.rgb*(.84 + .34*ocN2), diffuseColor.rgb*vec3(.34, .62, .40) + vec3(.004, .018, .012), ocAl*.82); }`,
    }),
    meadow: () => look.patch(lit({ vertexColors: true, side: THREE.DoubleSide }), {
      wrap: .5, key: 'meadow', vertexExtra: MEADOW_V(phone ? '60.0' : '150.0'), vertexDecl: 'varying vec2 vOcGust;\n', vertexPars: 'uniform highp sampler2D tOcHeight, tOcRiver; uniform vec4 ocRiverM; uniform sampler2D tOcWet, tOcBurn; uniform vec4 ocMap, ocWetM, ocBurnM;\n',
      fragmentPars: 'varying vec2 vOcGust;\nuniform vec3 ocLandGL, ocLandGD;\n',
      // the ground's own colours, the same noise, so the blades melt into the land; a gust lightens the tips as it passes
      albedo: /* glsl */`{ float ocM = ocMeadow(vOcP.xz);
        vec3 ocG = mix(ocLandGD, ocLandGL, smoothstep(.26, .74, ocM + (vOcGust.y - .5)*.26))*ocMeadowTint(vOcP.xz);
        float ocFar = 1.0 - smoothstep(16.0, 52.0, distance(vOcP, cameraPosition));
        diffuseColor.rgb = ocG*(1.0 + ocFar*vOcGust.y*(.14 + .30*max(vOcGust.x, 0.0)))*mix(1.62, 1.0, ocPaint); }`,
    }),
    flowers: () => look.patch(lit({ vertexColors: true, side: THREE.DoubleSide }), {
      wrap: .6, key: 'flowers', vertexExtra: MEADOW_V(phone ? '64.0' : '120.0'), vertexDecl: 'varying vec2 vOcGust;\n', vertexPars: 'uniform highp sampler2D tOcHeight, tOcRiver; uniform vec4 ocRiverM; uniform sampler2D tOcWet, tOcBurn; uniform vec4 ocMap, ocWetM, ocBurnM;\n', fragmentPars: 'varying vec2 vOcGust;\n',
    }),
    boat: () => look.patch(lit({ vertexColors: true }), {
      key: 'boat',
      vertexExtra: /* glsl */`
        vec4 ocWp = modelMatrix*instanceMatrix*vec4(transformed, 1.0);
        vec3 ocB = (modelMatrix*instanceMatrix*vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float ocPh = ocB.x*.13 + ocB.z*.17;
        vec3 ocD = ocWp.xyz - ocB;
        ocWp.y += sin(ocTime*.9 + ocPh)*.10 + ocD.x*sin(ocTime*.7 + ocPh)*.035 + ocD.z*sin(ocTime*.53 + ocPh*1.3)*.022;
        vec4 mvPosition = viewMatrix*ocWp;
        gl_Position = projectionMatrix*mvPosition;
        vOcP = ocWp.xyz;`,
    }),
    palm: () => look.patch(lit({ vertexColors: true, side: THREE.DoubleSide }), { wrap: .5, key: 'palm', vertexExtra: SWAY('.011', '5.5', '.018') }),
    tree: () => look.patch(lit({ vertexColors: true, side: THREE.DoubleSide }), {
      wrap: .55, key: 'tree', vertexDecl: 'varying float vBurnT;\n', vertexPars: 'uniform sampler2D tOcBurn; uniform vec4 ocBurnM;\n', vertexExtra: SWAY('.006', '4.6', '.022') + TREE_BURN,
      // the canopy is drawn by the leaf cards; the mesh keeps the trunk and boughs
      albedo: /* glsl */`{ if (vColor.g > vColor.r*1.12 && vColor.g > vColor.b*1.2) discard;
        float ocB1 = texture(tOcNoise, vec2((vOcP.x + vOcP.z)*.91, vOcP.y*.11)).a, ocB2 = texture(tOcNoise, vec2((vOcP.x - vOcP.z)*2.7, vOcP.y*.37)).b;
        float ocR = smoothstep(.34, .70, ocB1*.6 + ocB2*.4);
        diffuseColor.rgb = mix(vec3(.16, .11, .08), vec3(.36, .27, .19), ocR)*(.90 + .2*ocB2)*(1.0 - .9*smoothstep(.1, .6, vBurnT)); }`,
      fragmentPars: 'varying float vBurnT;\n',
    }),
    // leaf cards: each a soft clump turned to the eye, lit by the canopy's round normal, cut by the painted mask
    leaves: () => look.patch(lit({ alphaToCoverage: true }), {
      wrap: .6, key: 'leaves', uniforms: { tLeaf: { value: tLeaf } },
      vertexDecl: 'varying vec2 vLeaf, vLeafB;\nattribute vec4 aCard;\n', vertexPars: 'uniform sampler2D tOcBurn; uniform vec4 ocBurnM;\n',
      vertexExtra: /* glsl */`
        vec4 ocWp = modelMatrix*instanceMatrix*vec4(transformed, 1.0);
        vec3 ocB = (modelMatrix*instanceMatrix*vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec2 ocBu = vec2(ocB.x - ocBurnM.x, ocBurnM.y - ocB.z)*ocBurnM.z + .5;
        vLeafB = ocBurnM.w > 0.0 && ocBu.x > .01 && ocBu.y > .01 && ocBu.x < .99 && ocBu.y < .99 ? texture(tOcBurn, ocBu*vec2(1.0, .5)).rb : vec2(0.0);      // what fire and ice did at the foot of the tree (scorch.js)
        float ocPh = dot(ocWp.xyz, vec3(.21, .17, .13));
        ocWp.xyz += vec3(.83, .1, .55)*(sin(ocTime*1.7 + ocPh) + .6*sin(ocTime*.9 + ocPh*.6))*.14;
        vec4 mvPosition = viewMatrix*ocWp;
        float ocS = length(instanceMatrix[0].xyz);
        mvPosition.xy += aCard.xy*ocS*(.55 + .45*smoothstep(3.0, 18.0, -mvPosition.z));   // close by, smaller clumps rather than big flat ones
        gl_Position = projectionMatrix*mvPosition;
        vOcP = ocWp.xyz; vLeaf = aCard.zw;`,
      fragmentPars: 'varying vec2 vLeaf, vLeafB;\nuniform sampler2D tLeaf;\nuniform vec3 ocLandGL, ocLandGD;\n',
      // burnt leaves go from their ragged edge in, and what's left of the clump is black with a red rim; rime turns them pale
      albedo: /* glsl */`{ vec2 ocT = texture2D(tLeaf, vLeaf).rg; float ocLb = smoothstep(.08, .7, vLeafB.x);
        diffuseColor.a = smoothstep(.35 + ocLb*.56, .65 + ocLb*.32, ocT.r);
        if (diffuseColor.a < .05) discard;
        diffuseColor.rgb = mix(mix(ocLandGD*1.25, ocLandGL*.86, ocT.g)*vColor.rgb, vec3(.035, .028, .024) + vec3(.34, .09, .02)*(1.0 - ocT.r)*step(vLeafB.x, .9), ocLb);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.70, .80, .86)*(.8 + .3*ocT.g), smoothstep(.2, .7, vLeafB.y)); }`,
    }),
    shrub: () => look.patch(lit({ vertexColors: true, side: THREE.DoubleSide }), { wrap: .6, key: 'shrub', vertexExtra: SWAY('.05', '7.5', '.2') }),
    // windows and domes that light themselves: the brightest, most saturated vertex colours glow, each building at its own flicker
    lit: () => look.patch(lit({ vertexColors: true }), {
      key: 'lit',
      // a window is dark glass with its glazing bars and the light behind them, not a flat pale panel
      albedo: /* glsl */`{ float ocW = smoothstep(.72, .95, max(max(vColor.r, vColor.g), vColor.b)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.018, .026, .034), ocW); }`,
      // (the world builder's rule: only lit window faces reach .95 in any channel)
      glow: /* glsl */`{ float ocPane = texture(tOcNoise, floor(vOcP.xz*.7 + vOcP.y*.5)*.0173 + vOcP.y*.011).a;
        ocGlow = pow(vColor.rgb, vec3(1.9))*smoothstep(.72, .95, max(max(vColor.r, vColor.g), vColor.b))*(1.0 + .22*sin(ocTime*.7 + vOcP.x*.13 + vOcP.z*.19))*(.32 + 1.5*ocPane*ocPane)*vec3(1.5, 1.05, .6)*(.55 + .45*texture(tOcNoise, floor(vOcP.xz*.5)*.07 + floor(vOcP.y*.4)*.13).r)*step(.1, fract(vOcP.y*.8))*step(.1, fract((vOcP.x + vOcP.z)*.62));
        ocGlow *= max(ocNight, mix(1.0, mix(.7, 1.0, 1.0 - smoothstep(-125.0, -75.0, vOcP.y)), 1.0 - smoothstep(-6.0, -1.0, vOcP.y)))*exp(-(ocKv - ocKv.g)*.4*length(vOcP - cameraPosition)); }`,      // under the water a window is a lamp only where the day's light has gone (city_glsl.js, CITY_GLOW)
    }),
    coral: () => look.patch(lit({ vertexColors: true }), {
      wrap: .55, key: 'coral',
      albedo: /* glsl */`{ float ocA = texture(tOcNoise, vOcP.xz*.83 + vOcP.y*vec2(.61, -.47)).a, ocB = texture(tOcNoise, vOcP.zx*3.1 + vOcP.y*vec2(1.7, 1.3)).b;
        float ocP2 = smoothstep(.22, .74, ocA*.35 + ocB*.65);
        diffuseColor.rgb *= mix(vec3(.70, .66, .72), vec3(1.12, 1.10, 1.06), ocP2);
        float ocCam = length(vOcP - cameraPosition);
        if (ocCam < 2.2 && fract(52.98*fract(dot(gl_FragCoord.xy, vec2(.0671, .0058)))) > (ocCam - .9)/1.3) discard; }`,
    }),
    kelp: () => look.patch(lit({ vertexColors: true, side: THREE.DoubleSide }), {
      wrap: .9, key: 'kelp', vertexExtra: SWAY('.0125', '1.0', '.022'),
      // a blade is thin: toward the sun it glows gold from behind
      fragmentPost: /* glsl */`{ vec3 ocV = normalize(vOcP - cameraPosition); float ocMu = max(dot(ocV, ocSunW), 0.0);
        float ocD = max(-vOcP.y, 0.0);
        outgoingLight += diffuseColor.rgb*vec3(1.25, 1.12, .50)*ocSunCol*exp(-ocKd*ocD*.8)*ocSunLit(vOcP, ocD)*(.16 + .9*ocMu*ocMu*ocMu); }`,
    }),
    grass: () => look.patch(lit({ vertexColors: true, side: THREE.DoubleSide }), {
      wrap: .7, key: 'grass', vertexExtra: SWAY('.075', '2.1', '.25'),
    }),
    anemone: () => look.patch(lit({ vertexColors: true }), { wrap: .6, key: 'anemone', vertexExtra: SWAY('.04', '2.6', '.5') }),
    glow: () => look.patch(lit({ vertexColors: true }), {
      wrap: .3, key: 'glow',
      glow: /* glsl */`ocGlow = vColor.rgb*(.62 + .30*sin(ocTime*1.3 + vOcP.x*.31 + vOcP.z*.23))*(.45 + .55*exp(-length(vOcP - cameraPosition)*.022));`,
    }),
    lava: () => look.patch(lit({ vertexColors: true }), {
      key: 'lava', albedo: 'diffuseColor.rgb *= .3;',                   // (it gives light: what falls on it mustn't wash it white)
      // the world paints what burns at full strength: its own colour, hotter where the slow noise runs through it
      glow: /* glsl */`{ float ocHeat = texture(tOcNoise, vOcP.xz*.031 + vOcP.y*.02 + ocTime*vec2(.006, .004)).b; float ocM = max(max(vColor.r, vColor.g), vColor.b);
        float ocCrust = smoothstep(.34, .62, texture(tOcNoise, vOcP.xz*.37 + vOcP.y*.11 + ocTime*vec2(-.004, .003)).a);
        ocGlow = vColor.rgb*vec3(1.7, 1.3, .9)*smoothstep(.72, .95, ocM)*(.5 + .7*smoothstep(.3, .7, ocHeat))*(.32 + .68*ocCrust)*(.84 + .16*ocPulse); }`,
    }),
    ghost: () => look.patch(lit({ vertexColors: true }), {
      key: 'ghost',
      glow: /* glsl */`ocGlow = pow(vColor.rgb, vec3(1.5))*vec3(.70, 1.5, 1.15)*smoothstep(.72, .95, max(max(vColor.r, vColor.g), vColor.b))*(1.0 + .35*ocPulse);`,
    }),
    // the cities' buildings (city.js): weathered stone and weed like the old kit, and their windows glow warm when the lamps are lit and at night
    // the cities' buildings (city.js massing, city_glsl.js drawing): every surface drawn from its aFac in comic ink, hatched where it turns from the sun,
    // its windows lit warm (cold in the deep) when the lamps are lit, at night, and always below 18 m
    city: () => look.patch(lit({ vertexColors: true }), {
      key: 'city3', vertexDecl: CITY_VERTEX_DECL, vertexBend: CITY_VERTEX_BEND, fragmentPars: CITY_PARS, albedo: CITY_ALBEDO, fragmentPost: CITY_POST, glow: CITY_GLOW, uniforms: { tOcDmg: U.tOcDmg, ocDmgC: U.ocDmgC },
    }),
    lamp: () => look.patch(lit({ vertexColors: true }), {
      key: 'lamp',
      glow: /* glsl */`ocGlow = pow(vColor.rgb, vec3(1.5))*vec3(3.0)*smoothstep(.72, .95, max(max(vColor.r, vColor.g), vColor.b))*max(ocLamps, ocNight*step(0.0, vOcP.y))*3.2;`,
    }),
  };
  const matCache = {};
  const familyMat = (f) => (matCache[f] ||= MATS[f]());

  // A stand-in shape while props.glb is on its way, so the game runs from the first json.
  function standIn(name) {
    const g = standInShape(name);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(.55), 3));
    return g;
  }
  function standInShape(name) {
    if (/kelp/.test(name)) return new THREE.CylinderGeometry(.18, .32, 38, 6, 8).translate(0, 19, 0);
    if (/seagrass/.test(name)) return new THREE.ConeGeometry(.5, 1.5, 4).translate(0, .75, 0);
    if (/coral|anemone/.test(name)) return new THREE.IcosahedronGeometry(1, 0).translate(0, .6, 0);
    if (/column|lamp/.test(name)) return new THREE.CylinderGeometry(.9, 1, 8, 8).translate(0, 4, 0);
    if (/colossus/.test(name)) return new THREE.CylinderGeometry(5, 8, 60, 8).translate(0, 30, 0);
    if (/arch/.test(name)) return new THREE.TorusGeometry(26, 6, 6, 16, Math.PI);
    return new THREE.BoxGeometry(3, 3, 3).translate(0, 1.5, 0);
  }
  // Rock is exported faceted: one averaged normal per corner position turns the facets into one surface, at no cost in vertices.
  function smoothNormals(g) {
    const p = g.attributes.position, n = g.attributes.normal; if (!n) return;
    let cap = 16; while (cap < p.count * 2) cap *= 2;                     // corners found by their exact place, in a table of numbers: strings for a key left 9 MB behind on the big map
    const slot = new Int32Array(cap).fill(-1), home = new Int32Array(p.count), sum = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let h = (Math.imul(Math.round(x * 4096), 73856093) ^ Math.imul(Math.round(y * 4096), 19349663) ^ Math.imul(Math.round(z * 4096), 83492791)) & (cap - 1);
      for (;;) { const o = slot[h]; if (o < 0) { slot[h] = i; home[i] = i; break; } if (p.getX(o) === x && p.getY(o) === y && p.getZ(o) === z) { home[i] = o; break; } h = (h + 1) & (cap - 1); }
      const o = home[i] * 3; sum[o] += n.getX(i); sum[o + 1] += n.getY(i); sum[o + 2] += n.getZ(i);
    }
    const out = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const o = home[i] * 3, a = sum[o], b = sum[o + 1], c = sum[o + 2], l = Math.hypot(a, b, c) || 1; out[i * 3] = a / l; out[i * 3 + 1] = b / l; out[i * 3 + 2] = c / l; }
    letGo(slot); letGo(home); letGo(sum);
    g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  }
  // gltfpack keeps a name on the parent node of a quantized mesh.
  const meshName = (o) => (!o.name || /^mesh_\d+/.test(o.name)) && o.parent ? o.parent.name : o.name;
  const geoms = {};
  if (propsGLB) propsGLB.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.updateWorldMatrix(true, false);
    geoms[meshName(o)] = { geometry: o.geometry, node: o.matrixWorld.clone() };
  });

  // Creatures: real metres in plain floats, so the shaders can bend them by body length.
  const creatures = {};
  if (creaturesGLB) creaturesGLB.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.updateWorldMatrix(true, false);
    const name = meshName(o), src = o.geometry, g = new THREE.BufferGeometry(), cnt = src.attributes.position.count;
    const pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < cnt; i++) {
      v.fromBufferAttribute(src.attributes.position, i).applyMatrix4(o.matrixWorld); v.toArray(pos, i * 3);
      if (src.attributes.normal) { v.fromBufferAttribute(src.attributes.normal, i).applyMatrix3(nm).normalize(); v.toArray(nor, i * 3); }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (src.attributes.color) g.setAttribute('color', src.attributes.color);
    else g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cnt * 3).fill(.5), 3));
    if (src.index) g.setIndex(src.index);
    if (!src.attributes.normal) g.computeVertexNormals();
    creatures[name] = g;
  });

  // coral #ff7a6b, orange #ff9d4d, violet #9c6bff, yellow #ffd35a (ART.md), linear, plus a rose between them
  const C_CORAL = [.86, .20, .15], C_ORANGE = [.92, .34, .08], C_VIOLET = [.34, .15, .86], C_YELLOW = [.90, .62, .11], C_ROSE = [.84, .17, .34];
  const REEF = {
    coral_brain: [C_YELLOW, C_ORANGE, C_ROSE, C_CORAL], coral_table: [C_ORANGE, C_CORAL, C_YELLOW], coral_tube: [C_VIOLET, C_YELLOW, C_ORANGE],
    coral_branch: [C_CORAL, C_ROSE, C_ORANGE], coral_fan: [C_VIOLET, C_ROSE, C_CORAL], anemone: [C_ROSE, C_ORANGE, C_VIOLET], other: [C_CORAL, C_ORANGE, C_VIOLET, C_YELLOW],
  };
  const CS = 56;                 // cell size in metres
  const FAR_RANGE = phone ? 130 : 190;
  const batches = [];
  const dummy = new THREE.Object3D(), tc = new THREE.Color();
  const keep = phone ? { seagrass: .5, kelp_stalk: .85, glow_coral: .7 } : {};
  // A soft mask of leaf clusters, painted once: red is coverage, green the light within a cluster.
  function leafMask() {
    const S = 384, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    let r = 11; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1500; i++) {
      // thick at the heart of the clump, ragged at its edge; later leaves sit on top and catch more light
      const a = rnd() * 6.283, d = Math.pow(rnd(), .62) * S * .46, px = S / 2 + Math.cos(a) * d, py = S / 2 + Math.sin(a) * d, l = 5 + rnd() * 7, g = Math.round(50 + 205 * (i / 1500) * (.55 + .45 * rnd()));
      x.save(); x.translate(px, py); x.rotate(rnd() * 6.283); x.fillStyle = `rgb(255,${g},0)`; x.beginPath(); x.ellipse(0, 0, l, l * .5, 0, 0, 6.3); x.fill(); x.restore();
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    return t;
  }
  // the cities (city.js): planned here, before any instance is drawn, lit or collided with, because each city clears its footprint of the clutter it replaces
  const cityPlan = planCities(data, heightAt, { phone });
  if (riverPlan) { const add = dressRivers(riverPlan, heightAt); for (const k in add) if (add[k].length) data.instances[k] = (data.instances[k] || []).concat(add[k]); }     // stones and plants along the water (rivers.js)
  // the rock over the land's bare faces, and what falls off them (cliffs.js): none on the Frost Isle's ice and none in the Cone's ash, for now
  const cliffPlan = dressCliffs({ data, heightAt, waterAt: riverPlan ? riverPlan.waterAt : () => null, solids: (data.colliders || []).concat(cityPlan.colliders),
    skip: (x, y) => { if (Math.hypot(x - ISLE.x, y - ISLE.y) < ISLE.R * 1.3) return true; const f = (data.waterfalls || []).find((q) => Math.hypot(x - q.x, y - q.y) < 40); if (!f) return false; const c = Math.cos(f.yaw || 0), sn = Math.sin(f.yaw || 0), dx = x - f.x, dy = y - f.y, across = dx * c + dy * sn, along = dx * sn - dy * c; return Math.abs(across) < f.w * .5 + 1.2 + Math.max(0, along - 8) * .3 && along > -5 && along < 24; } });
  for (const k in cliffPlan.add) if (cliffPlan.add[k].length) data.instances[k] = (data.instances[k] || []).concat(cliffPlan.add[k]);
  cliffPlan.add = null;
  { const add = dressReefCity(cityPlan.cities, cityPlan.sets || {}, heightAt); for (const k in add) if (add[k].length) data.instances[k] = (data.instances[k] || []).concat(add[k]); }
  { const busy = new Set(), K = (x, y) => Math.floor(x / 10) * 100003 + Math.floor(y / 10); for (const c of (data.colliders || []).concat(cityPlan.colliders)) { if (c.z1 < .5) continue; const r = c.t === 'cyl' ? c.r : Math.hypot(c.hx, c.hy); if (r > 40) continue; for (let dx = -r - 3; dx <= r + 3; dx += 8) for (let dy = -r - 3; dy <= r + 3; dy += 8) busy.add(K(c.x + dx, c.y + dy)); }
    data.instances.grass_tuft = (data.instances.grass_tuft || []).concat(dressDunes({ data, heightAt, skip: (x, y) => Math.hypot(x - ISLE.x, y - ISLE.y) < ISLE.R + 10 || busy.has(K(x, y)) })); }
  const tLeaf = data.instances.tree_oak_a || data.instances.tree_oak_b ? leafMask() : null;
  // Cards scattered over a mesh's foliage (its green corners), in real metres; `normal` points out from the canopy, so the mass lights as one.
  function leafCards(G, want) {
    const g = G.geometry, p = g.attributes.position, c = g.attributes.color, idx = g.index; if (!c) return null;
    const tris = [], v = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), mid = new THREE.Vector3();
    const leafy = (i) => c.getY(i) > c.getX(i) * 1.12 && c.getY(i) > c.getZ(i) * 1.2;
    let total = 0, ct = 0;
    const n = (idx ? idx.count : p.count) / 3;
    for (let t = 0; t < n; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      if (!(leafy(i0) && leafy(i1) && leafy(i2))) continue;
      A.fromBufferAttribute(p, i0).applyMatrix4(G.node); B.fromBufferAttribute(p, i1).applyMatrix4(G.node); C.fromBufferAttribute(p, i2).applyMatrix4(G.node);
      const area = v.subVectors(B, A).cross(mid.subVectors(C, A)).length() * .5; total += area;
      tris.push([A.clone(), B.clone(), C.clone(), total]); mid.copy(A).add(B).add(C); v.copy(mid).divideScalar(3); ct++;
    }
    if (!ct) return null;
    const centre = new THREE.Vector3(); for (const t of tris) centre.add(t[0]).add(t[1]).add(t[2]); centre.divideScalar(ct * 3);
    let r0 = 37; const rnd = () => (r0 = (r0 * 16807) % 2147483647) / 2147483647;
    const pos = [], nor = [], cor = [], idc = [];
    for (let k = 0; k < want; k++) {
      const a = rnd() * total; let lo = 0, hi = tris.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (tris[m][3] < a) lo = m + 1; else hi = m; }
      const t = tris[lo]; let u = rnd(), w = rnd(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
      const q = t[0].clone().multiplyScalar(1 - u - w).addScaledVector(t[1], u).addScaledVector(t[2], w), nrm = q.clone().sub(centre).normalize();
      const sz = 1.5 + rnd() * 1.4, rot = rnd() * 6.283, cr = Math.cos(rot) * sz, sr = Math.sin(rot) * sz, base = k * 4;
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(q.x, q.y, q.z); nor.push(nrm.x, nrm.y, nrm.z); cor.push(cx * cr - cy * sr, cx * sr + cy * cr, cx * .5 + .5, cy * .5 + .5); }
      idc.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('aCard', new THREE.Float32BufferAttribute(cor, 4)); out.setIndex(idc);
    return out;
  }

  // A reef is a crowd: each placed coral gathers neighbours on the ground around it, kept to seeded offsets.
  function gather(name, family, src) {
    if (name === 'coral_brain' || name === 'coral_table') return src;   // hard: a copy with no collider would be a ghost a swimmer passes through
    const extra = family === 'coral' || family === 'anemone' ? (phone ? 1 : 2) : name === 'seagrass' ? (phone ? 1 : 3) : family === 'kelp' ? (phone ? 1 : 2) : 0;
    if (!extra) return src;
    const out = src.slice(); let s = 4021 + name.length * 977;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < src.length; i += 6) for (let e = 0; e < extra; e++) {
      const a = rnd() * 6.283, d = family === 'kelp' ? .8 + rnd() * 2.8 : 1.6 + rnd() * (name === 'seagrass' ? 5 : 6.5), x = src[i] + Math.cos(a) * d, y = src[i + 1] + Math.sin(a) * d;
      out.push(x, y, heightAt(x, y) - .12, rnd() * 6.283, src[i + 4] * (family === 'kelp' ? .74 + rnd() * .26 : .62 + rnd() * .62), rnd());
    }
    return out;
  }
  const LIST0 = 48;                                                      // copies a batch's list holds to begin with (ours)
  const UP3 = new THREE.Vector3(0, 1, 0), X3 = new THREE.Vector3(1, 0, 0), leanN = new THREE.Vector3(), leanQ = new THREE.Quaternion(), yawQ = new THREE.Quaternion();
  for (const [k, sd] of [['slab_a', 7141], ['slab_b', 90127], ['slab_c', 31337]]) geoms[k] = { geometry: slabGeometry(sd), node: IDENTITY };
  for (const name of Object.keys(data.instances)) {
    const family = familyOf(name);
    const placed = data.instances[name].length / 6;
    const src = gather(name, family, data.instances[name]);
    // A near mesh in a region pack arrives after first play: until then its far mesh draws at every distance, so there's never a hole.
    const G = geoms[name] || geoms[name + '__far'] || { geometry: standIn(name), node: new THREE.Matrix4() }, waiting = !geoms[name] && !!geoms[name + '__far'];
    if ((family === 'rock' || family === 'tree') && !name.startsWith('slab_')) smoothNormals(G.geometry);     // (a tree's foliage triangles are not drawn; its leaf cards have their own normals. A slab stays flat shaded)
    const total = src.length / 6;
    const rate = keep[name] || 1;
    const order = [];
    for (let i = 0; i < total; i++) { if (rate < 1 && ((i * 2654435761) >>> 0) / 4294967296 > rate) continue; order.push(i); }
    const count = order.length;
    if (!count) continue;
    const cellS = family === 'meadow' || family === 'flowers' ? 18 : CS;
    const cellOf = (i) => [Math.floor(src[i * 6] / cellS), Math.floor(src[i * 6 + 1] / cellS)];
    // cell by cell, with each cell's placed pieces first: a far cell draws only those
    const cx = (i) => Math.floor(src[i * 6] / cellS), cy = (i) => Math.floor(src[i * 6 + 1] / cellS);
    order.sort((a, b) => cx(a) - cx(b) || cy(a) - cy(b) || (a >= placed) - (b >= placed) || ((a * 2654435761) >>> 0) - ((b * 2654435761) >>> 0));

    G.geometry.computeBoundingSphere();
    const bs = G.geometry.boundingSphere, nodeS = G.node.getMaxScaleOnAxis();
    const mean = new THREE.Vector3(.2, .2, .2);
    if (G.geometry.attributes.color && (family === 'coral' || family === 'anemone')) {
      const ca = G.geometry.attributes.color; mean.set(0, 0, 0);
      for (let i = 0; i < ca.count; i++) { mean.x += ca.getX(i); mean.y += ca.getY(i); mean.z += ca.getZ(i); }
      mean.divideScalar(ca.count); mean.x = Math.max(mean.x, .03); mean.y = Math.max(mean.y, .03); mean.z = Math.max(mean.z, .03);
    }
    const M = new Float32Array(count * 16), C = new Float32Array(count * 3), cells = [];
    let maxS = 0;
    for (let k = 0; k < count; k++) {
      const i = order[k], o = i * 6, s = src[o + 4], t = src[o + 5];
      maxS = Math.max(maxS, s);
      dummy.position.set(src[o], src[o + 2] + (name === 'lava_crack' ? .16 : 0), -src[o + 1]); dummy.scale.setScalar(s);
      if (src[o + 3] >= LEAN - 3) {                                      // set into a slope (cliffs.js): a slab faces down it and lies back with it; a stone leans with it, turned about its own axis first
        const e = 1.5, gx = (heightAt(src[o] + e, src[o + 1]) - heightAt(src[o] - e, src[o + 1])) / (2 * e), gy = (heightAt(src[o], src[o + 1] + e) - heightAt(src[o], src[o + 1] - e)) / (2 * e), sl = Math.hypot(gx, gy) || 1e-3;
        if (name.startsWith('slab_')) { const back = Math.min(.62, Math.PI / 2 - Math.atan(sl)); yawQ.setFromAxisAngle(UP3, Math.atan2(-gx, gy) + (src[o + 3] - LEAN)); leanQ.setFromAxisAngle(X3, -back); dummy.quaternion.copy(yawQ).multiply(leanQ); }
        else { leanN.set(-gx, 1, gy).normalize().lerp(UP3, .25).normalize(); leanQ.setFromUnitVectors(UP3, leanN); yawQ.setFromAxisAngle(UP3, src[o + 3] - LEAN); dummy.quaternion.copy(leanQ).multiply(yawQ); }
      } else dummy.rotation.set(0, src[o + 3], 0);
      dummy.updateMatrix();
      dummy.matrix.multiply(G.node).toArray(M, k * 16);
      if (family === 'glow') tc.setRGB(t < .5 ? .15 : 1.0, t < .5 ? .95 : .20, t < .5 ? .85 : .68);
      else if (family === 'coral' || family === 'anemone') {
        // the reef's colours come from the brief: every piece takes one, so a coral head reads pink, orange, violet or yellow
        const list = REEF[name] || REEF.other, c = list[Math.floor(t * list.length * .999)], g = .66 + ((t * 13.7) % 1) * .46;
        tc.setRGB(c[0] * g / mean.x, c[1] * g / mean.y, c[2] * g / mean.z);
      }
      else if (family === 'kelp' || family === 'grass' || family === 'palm' || family === 'shrub' || family === 'tree') tc.setRGB(.82 + t * .36, .84 + t * .3, .8 + t * .1);
      else if (family === 'lit' || family === 'lava' || family === 'ghost') tc.setRGB(1, 1, 1);
      else tc.setRGB(.86 + t * .24, .86 + t * .23, .86 + t * .2);
      C[k * 3] = tc.r; C[k * 3 + 1] = tc.g; C[k * 3 + 2] = tc.b;
      const c = cellOf(i), last = cells[cells.length - 1];
      if (last && last.cx === c[0] && last.cy === c[1]) { last.count++; if (i < placed) last.base++; }
      else cells.push({ cx: c[0], cy: c[1], start: k, count: 1, base: i < placed ? 1 : 0 });
    }
    const rad = bs.radius * nodeS * maxS + bs.center.length() * nodeS * maxS;
    for (const c of cells) {
      // the true centre of the cell's pieces, three.js axes
      let sx = 0, sy = 0, sz = 0; for (let k = c.start; k < c.start + c.count; k++) { sx += M[k * 16 + 12]; sy += M[k * 16 + 13]; sz += M[k * 16 + 14]; }
      c.center = new THREE.Vector3(sx / c.count, sy / c.count, sz / c.count);
      let rr = 0; for (let k = c.start; k < c.start + c.count; k++) { const dx = M[k * 16 + 12] - c.center.x, dy = M[k * 16 + 13] - c.center.y, dz = M[k * 16 + 14] - c.center.z; rr = Math.max(rr, Math.hypot(dx, dy, dz)); }
      c.sphere = new THREE.Sphere(c.center, rr + rad);
    }
    // A heavy piece's far mesh takes over past `farRange`, cell by cell, in the same draw order.
    const FG = geoms[name + '__far'];
    let far = null;
    if (FG) {
      if (family === 'rock' && FG !== G) smoothNormals(FG.geometry);
      const sameNode = FG.node.equals(G.node), MF = sameNode ? M : new Float32Array(count * 16), a = new THREE.Matrix4(), ib = new THREE.Matrix4().copy(G.node).invert();
      if (!sameNode) for (let k = 0; k < count; k++) { a.fromArray(M, k * 16).multiply(ib).multiply(FG.node).toArray(MF, k * 16); }
      const fm = new THREE.InstancedMesh(FG.geometry, familyMat(family), Math.min(count, LIST0));
      fm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.min(count, LIST0) * 3), 3);
      fm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); fm.instanceColor.setUsage(THREE.DynamicDrawUsage);
      fm.frustumCulled = false; fm.count = 0; fm.visible = false; fm.name = name + '__far';
      scene.add(fm); far = { mesh: fm, M: MF, range: ((data.lod && data.lod[name]) || FAR_RANGE) * (phone ? .7 : 1) };
    }
    let cards = null;
    if (family === 'tree') {
      const cg = leafCards(G, phone ? 150 : 220);
      if (cg) {
        const plain = G.node.equals(IDENTITY), MC = plain ? M : new Float32Array(count * 16), a = new THREE.Matrix4(), ib = new THREE.Matrix4().copy(G.node).invert();
        if (!plain) for (let k = 0; k < count; k++) a.fromArray(M, k * 16).multiply(ib).toArray(MC, k * 16);
        const cm = new THREE.InstancedMesh(cg, familyMat('leaves'), Math.min(count, LIST0));
        cm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.min(count, LIST0) * 3), 3);
        cm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cm.instanceColor.setUsage(THREE.DynamicDrawUsage);
        cm.frustumCulled = false; cm.count = 0; cm.visible = false; cm.name = name + '_leaves';
        scene.add(cm); cards = { mesh: cm, M: MC };
      }
    }
    const mesh = new THREE.InstancedMesh(G.geometry, familyMat(family), Math.min(count, LIST0));
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.min(count, LIST0) * 3), 3);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0; mesh.name = name; mesh.visible = false;
    if (!(G.geometry.attributes.color)) mesh.material = familyMat(family);
    scene.add(mesh);
    const reach = family === 'meadow' ? (phone ? 60 : 150) : family === 'flowers' ? (phone ? 56 : 120) : Math.min(460, (family === 'kelp' ? (phone ? 120 : 300) : family === 'palm' || family === 'tree' ? 440 : family === 'lit' ? 430 : family === 'shrub' ? (phone ? 110 : 170) : /beach_rock|cliff_rock|driftwood/.test(name) ? 340 : family === 'grass' ? (phone ? 60 : 95) : family === 'coral' ? (phone ? 62 : 150) : family === 'anemone' ? (phone ? 40 : 120) : family === 'lamp' || family === 'glow' || family === 'ghost' || family === 'lava' ? 240 : 150) + rad * 7) * (phone ? .86 : 1);
    batches.push({ name, family, mesh, M, C, cells, reach, count, rad, far, cards, waiting: waiting ? G.node : null });
  }

  // ---------------------------------------------------------------- the rest of the world, after first play
  // The region packs, nearest first, one at a time, and one kind a frame, so nothing arrives as a stall. A pack that fails to load leaves the far meshes standing.
  const packList = Object.values(data.packs || {}), packsDone = [], arrivals = [];
  let packFrames = 0, packBusy = false, packFrom = null, playing = !!packsNow;
  function nextPack(focus) {
    let best = -1, bd = Infinity;
    packList.forEach((p, i) => {
      for (const k of p.kinds || []) { const a = data.instances[k]; if (!a) continue; for (let j = 0; j + 1 < a.length; j += 60) { const d = Math.hypot(a[j] - focus.x, a[j + 1] + focus.z); if (d < bd) { bd = d; best = i; } } }
    });
    if (best < 0) best = packList.length - 1;
    const p = packList.splice(best, 1)[0];
    packBusy = true;
    loader.loadAsync(base + p.file).then((glb) => {
      unquantize(glb);
      glb.scene.traverse((o) => { if (o.isMesh) { o.updateWorldMatrix(true, false); arrivals.push(o); } });
      packsDone.push(p.file); packBusy = false;
    }).catch(() => { packBusy = false; });
  }
  function arrive(o) {
    const b = batches.find(x => x.waiting && x.name === meshName(o)); if (!b) return;
    if (b.family === 'rock') smoothNormals(o.geometry);
    if (!b.waiting.equals(o.matrixWorld)) {
      if (b.far && b.far.M === b.M) b.far.M = b.M.slice();
      if (b.cards && b.cards.M === b.M) b.cards.M = b.M.slice();
      const inv = new THREE.Matrix4().copy(b.waiting).invert(), a = new THREE.Matrix4();
      for (let k = 0; k < b.count; k++) a.fromArray(b.M, k * 16).multiply(inv).multiply(o.matrixWorld).toArray(b.M, k * 16);
    }
    b.mesh.geometry = o.geometry; b.waiting = null;
  }
  function stepPacks(cp, focus) {
    if (arrivals.length) { arrive(arrivals.shift()); return; }
    if (packBusy || !packList.length) return;
    // What the first view doesn't need waits for first play: he has moved. Half a minute at the title and it comes anyway.
    if (focus) { packFrom ||= focus.clone(); playing ||= focus.distanceTo(packFrom) > .3; }
    if (++packFrames > 45 && (playing || packFrames > 1800)) nextPack(cp);
  }

  // ---------------------------------------------------------------- glow: pools on the ground, and soft cards in the water (a phone's bloom)
  const tGlow = (() => {
    const gs = phone ? 2 : 1, gn = (bn - 1) / gs + 1;      // the smallest pool of light here is 11 m across: on a phone 8 m a texel holds it, and a quarter of the memory
    const bytes = () => {
    const out = new Float32Array(gn * gn * 4);
    const splat = (x, y, r, ch, amp) => {
      const c = 2 * cell * gs, gx = (x - ox) / c, gy = (y - oy) / c, R = Math.ceil(r / c);
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
        const ix = Math.round(gx) + i, iy = Math.round(gy) + j; if (ix < 0 || iy < 0 || ix >= gn || iy >= gn) continue;
        const dx = (ix - gx) * c, dy = (iy - gy) * c, d = Math.max(0, 1 - (dx * dx + dy * dy) / (r * r));
        out[(iy * gn + ix) * 4 + ch] += amp * d * d;
      }
    };
    const G = data.instances.glow_coral || [], Lp = data.instances.lamp || [];
    for (let i = 0; i < G.length; i += 6) splat(G[i], G[i + 1], 11 * G[i + 4], G[i + 5] < .5 ? 0 : 1, .55);
    for (let i = 0; i < Lp.length; i += 6) splat(Lp[i], Lp[i + 1], 15, 2, .9);
    for (const k of ['wall_windows', 'tower', 'dome_hall']) { const L = data.instances[k] || []; for (let i = 0; i < L.length; i += 6) splat(L[i], L[i + 1], 20 * L[i + 4], 3, .5); }
    for (const k of ['wall_windows_cold', 'tower_cold']) { const L = data.instances[k] || []; for (let i = 0; i < L.length; i += 6) splat(L[i], L[i + 1], 20 * L[i + 4], 0, .5); }
    for (const l of lavaLines()) for (let i = 0; i < l.pts.length; i += 4) splat(l.pts[i][0], l.pts[i][1], 13, 3, .1);      // the land round a lava river is lit by it
    const b = new Uint8Array(gn * gn * 4); for (let i = 0; i < b.length; i++) b[i] = Math.min(255, out[i] * 255);
    letGo(out);
    return b;
    };
    const t = new THREE.DataTexture(bytes(), gn, gn, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.remake = bytes;
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    return freeAfter(t);
  })();
  terrainU.tGlow = { value: tGlow };

  // The sea floor's own light, one small map read by everything in the deep: red for lava, green for the lanterns nothing tends.
  const tPool = (() => {
    const inst = data.instances, src = [['lava_crack', 0, 60, .80], ['smoker', 0, 40, .70], ['forge_hall', 0, 56, .70], ['lamp_brazier', 0, 18, .55], ['lamp_ghost', 1, 28, 1]];
    if (!src.some(([k]) => inst[k] && inst[k].length)) return null;
    const bytes = () => {
      const a = new Float32Array(bn * bn * 2), c2 = 2 * cell;
      for (const [k, ch, r, amp] of src) {
        const L = inst[k] || [], R = Math.ceil(r / c2);
        for (let i = 0; i + 5 < L.length; i += 6) {
          if (L[i + 2] > -4) continue;
          const gx = (L[i] - ox) / c2, gy = (L[i + 1] - oy) / c2, cx = Math.round(gx), cy = Math.round(gy);
          for (let j = -R; j <= R; j++) for (let e = -R; e <= R; e++) {
            const ix = cx + e, iy = cy + j; if (ix < 0 || iy < 0 || ix >= bn || iy >= bn) continue;
            const d = Math.hypot(ix - gx, iy - gy) * c2 / r; if (d >= 1) continue;
            const f = 1 - d; a[(iy * bn + ix) * 2 + ch] += amp * f * f;
          }
        }
      }
      // the Kraken's pit: a faint cold light with no lantern to explain it
      for (const p of data.poi || []) if (p.id === 'kraken_lair') {
        const R = Math.ceil(90 / c2), gx = (p.x - ox) / c2, gy = (p.y - oy) / c2;
        for (let j = -R; j <= R; j++) for (let e = -R; e <= R; e++) { const ix = Math.round(gx) + e, iy = Math.round(gy) + j; if (ix < 0 || iy < 0 || ix >= bn || iy >= bn) continue; const d = Math.hypot(ix - gx, iy - gy) * c2 / 90; if (d < 1) a[(iy * bn + ix) * 2 + 1] += .42 * (1 - d) * (1 - d); }
      }
      const b = new Uint8Array(bn * bn * 2); for (let i = 0; i < b.length; i++) b[i] = Math.min(255, a[i] * 255);
      letGo(a);
      return b;
    };
    const t = new THREE.DataTexture(bytes(), bn, bn, THREE.RGFormat, THREE.UnsignedByteType);
    t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; t.remake = bytes;
    U.tOcPool.value = t;
    return freeAfter(t);
  })();

  const cards = (() => {
    const G = data.instances.glow_coral || [], Lp = data.instances.lamp || [], list = [];
    const lampTop = (() => { const g = geoms.lamp; if (!g) return 7.5; g.geometry.computeBoundingBox(); return g.geometry.boundingBox.max.clone().applyMatrix4(g.node).y; })();
    for (let i = 0; i < G.length; i += 6) { if (phone && i % 12) continue; const t = G[i + 5] < .5; list.push([G[i], G[i + 2] + 1.0 * G[i + 4], -G[i + 1], 2.6 * G[i + 4], t ? .10 : 1, t ? .95 : .18, t ? .85 : .66, 0]); }
    for (let i = 0; i < Lp.length; i += 6) list.push([Lp[i], Lp[i + 2] + lampTop * Lp[i + 4] * .94, -Lp[i + 1], 6.5, 1, .62, .22, 1]);
    {                                                                   // lanterns nothing tends: always lit, a cold green in the murk
      const H = data.instances.lamp_ghost || [], g = geoms.lamp_ghost;
      let top = 3; if (g) { g.geometry.computeBoundingBox(); top = g.geometry.boundingBox.max.clone().applyMatrix4(g.node).y; }
      for (let i = 0; i < H.length; i += 6) list.push([H[i], H[i + 2] + top * H[i + 4] * .9, -H[i + 1], 16, .36, 1, .70, 2]);
    }
    {                                                                   // the water glowing over the fires, a broad soft red: the form that shows from far off
      const bins = new Map();
      for (const k of ['lava_crack', 'smoker', 'forge_hall']) {
        const L = data.instances[k] || [];
        for (let i = 0; i + 5 < L.length; i += 6) { if (L[i + 2] > -4) continue; const key = Math.floor(L[i] / 46) * 4096 + Math.floor(L[i + 1] / 46); let b = bins.get(key); if (!b) bins.set(key, b = { x: 0, y: 0, z: 0, n: 0 }); b.x += L[i]; b.y += L[i + 1]; b.z += L[i + 2]; b.n++; }
      }
      for (const b of bins.values()) list.push([b.x / b.n, b.z / b.n + 7, -b.y / b.n, 30 + b.n * 4, .36, .085, .022, 2]);
    }
    for (const [k, c, h] of [['wall_windows', [1, .66, .24], 4], ['tower', [1, .66, .24], 18], ['dome_hall', [1, .66, .24], 10], ['wall_windows_cold', [.12, .86, 1], 4], ['tower_cold', [.12, .86, 1], 18]]) {
      const L = data.instances[k] || [];
      for (let i = 0; i < L.length; i += 6) list.push([L[i], L[i + 2] + h * L[i + 4], -L[i + 1], 16 * L[i + 4], c[0], c[1], c[2], 3]);
    }
    {
      const bins = new Map();
      for (let i = 0; i < G.length; i += 6) {
        const k = Math.floor(G[i] / 70) * 4096 + Math.floor(G[i + 1] / 70); let b = bins.get(k); if (!b) bins.set(k, b = { x: 0, y: 0, z: 0, n: 0, m: 0 });
        b.x += G[i]; b.y += G[i + 1]; b.z += G[i + 2]; b.n++; if (G[i + 5] >= .5) b.m++;
      }
      for (const b of bins.values()) { if (b.n < 4) continue; const m = b.m / b.n; list.push([b.x / b.n, b.z / b.n + 9, -b.y / b.n, 34 + b.n * .8, .10 + .5 * m, .62 * (1 - m) + .1, .62 - .1 * m, 2]); }
    }
    if (!list.length) return null;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(l => l.slice(0, 4))), 4));
    g.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(l => l.slice(4, 8))), 4));
    g.instanceCount = list.length;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, toneMapped: false,
      uniforms: { ocLamps: U.ocLamps, ocTime: U.ocTime, ocKv: U.ocKv, ocAddGain: U.ocAddGain },
      vertexShader: /* glsl */`
        attribute vec4 aP, aC; uniform float ocLamps, ocTime, ocAddGain; uniform vec3 ocKv;
        varying vec3 vC; varying vec2 vQ;
        void main() {
          vec4 mv = viewMatrix*vec4(aP.xyz, 1.0);
          float d = length(mv.xyz);
          if (d > (aC.a > 1.5 ? 430.0 : 230.0) || d < 1.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          bool lit = aC.a > 2.5;
          mv.xy += position.xy*aP.w;
          gl_Position = projectionMatrix*mv;
          float g = lit ? .34 : aC.a > 1.5 ? .62 : aC.a > .5 ? ocLamps*.62 : (.32 + .16*sin(ocTime*1.3 + aP.x*.31 - aP.z*.23));
          vC = aC.rgb*g*exp(-ocKv*d*(aC.a > .5 && aC.a < 1.5 ? .34 : aC.a > 1.5 ? .5 : .8))*smoothstep(1.5, 6.0, d)*ocAddGain*(aC.a > 1.5 && !lit ? smoothstep(14.0, 60.0, d) : 1.0);
          vQ = position.xy;
        }`,
      fragmentShader: `varying vec3 vC; varying vec2 vQ; void main(){ float r = max(1.0 - dot(vQ, vQ), 0.0); gl_FragColor = vec4(vC*r*r, 1.0); }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 18; scene.add(mesh);
    return mesh;
  })();

  // ---------------------------------------------------------------- rivers and falls, drawn with the sea's own light
  const freshwater = (() => {
    const R = data.rivers || [], F = data.waterfalls || [];
    if (!R.length && !F.length) return null;
    const fpos = [], fflow = [], fgeo = [], fidx = [], wpos = [], wflow = [], widx = [];
    // the rivers and the falls' pools (rivers.js): level water in the channels the land was carved to, its edges in under the banks so the ground draws the shore
    const rg = riverPlan ? riverGeometry(riverPlan, heightAt) : null;
    const fallsMist = [];
    for (const f of F) {
      // Randy, 1 Nov: "the waterfall looks disconnected from the land", "just a sheet of paper". The strips leave the lip at the height and the width of the river that feeds it and
      // pour on down into its pool (falls.js), a dark wet band on the rock behind and around them, mist off the foot.
      const pl = riverPlan ? riverPlan.pools.find((q) => q.f === f) : null, bot = f.pool !== undefined ? Math.min(f.z1, f.pool - .25) : f.z1;
      const feed = R.find(r => { const q = r.pts[r.pts.length - 1]; return Math.hypot(q[0] - f.x, q[1] - f.y) < 3; }), rv = feed && riverPlan ? riverPlan.rivers.find((r) => r.id === feed.id) : null;
      if (rv) f.z0 = rv.W[rv.N] + .1;                                   // the lip is where the river's surface comes to it
      const hwTop = rv ? Math.min(f.w * .5, rv.HW[rv.N] + .3) : f.w * .5, hwAt = t => (hwTop + (f.w * .5 - hwTop) * (t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t))) * (1 + t * .06);
      const c = Math.cos(f.yaw || 0), sn = Math.sin(f.yaw || 0), h = f.z0 - bot;
      f.hwAt = (t) => hwAt(Math.min(1, t * (f.z0 - f.z1) / h));          // the hero's climb reads the same width (its rows run lip to z1)
      const foot = pl ? (pl.ft.x - f.x) * sn - (pl.ft.y - f.y) * c : 6;
      const S = fallStrips(f, { heightAt, hwAt, lipZ: f.z0, bot, foot, water: pl ? pl.W : f.z1 });
      const off = fpos.length / 3; fpos.push(...S.P); fflow.push(...S.A); fgeo.push(...S.B); for (const i of S.I) fidx.push(i + off);
      const wo = wpos.length / 3; wpos.push(...S.W); wflow.push(...S.WA); for (const i of S.WI) widx.push(i + wo);
      const r0 = hwAt(1) * .30, Wz = pl ? pl.W : f.z1;
      for (const [sd, puffs] of [[-.6, 5], [0, 7], [.6, 5]]) { const lx = sd * hwAt(1), o = foot + 1.4; fallsMist.push({ x: f.x + lx * c + o * sn, y: f.y + lx * sn - o * c, z: Wz + .2, r: r0, h: Math.min(6, h * .3), puffs, deep: 2 }); }
    }
    const make = (P, A, I, kind, B) => {
      if (!I.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aF', new THREE.Float32BufferAttribute(A, 4)); if (B) g.setAttribute('aG', new THREE.Float32BufferAttribute(B, 4)); g.setIndex(I);
      const river = kind === 'river', fall = kind === 'fall', wet = kind === 'wet';
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: U,
        vertexShader: fall ? FALL_V : river ? `attribute vec4 aF, aG; varying vec3 vP; varying vec4 vF, vG; void main(){ vP = position; vF = aF; vG = aG; gl_Position = projectionMatrix*viewMatrix*vec4(position, 1.0); }`
          : `attribute vec4 aF; varying vec3 vP; varying vec4 vF; void main(){ vP = position; vF = aF; gl_Position = projectionMatrix*viewMatrix*vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
          varying vec3 vP; varying vec4 vF;${river || fall ? ' varying vec4 vG;' : ''}
          ${look.glsl}
          uniform vec3 ocSkyZ, ocSkyH, ocSeaS, ocSeaD;
          void main() {
            vec3 v = vP - cameraPosition; float dist = length(v); vec3 rd = v/dist;
            float t = ocTime;
            ${wet ? /* glsl */`
            // the wet rock behind and beside a fall: darker, glossy, a film of water sliding down it
            float s1 = texture(tOcNoise, vec2(vF.y*vF.z*.2 + .1, vF.x*.03 - t*.35)).b;
            vec3 c = vec3(.012, .016, .016) + ocSunCol*.05*smoothstep(.62, .8, s1);
            float alpha = (1.0 - smoothstep(.35 + .3*s1, 1.0, abs(vF.y)))*(.42 + .18*s1)*smoothstep(0.0, .06, vF.a + .02);` : fall ? /* glsl */`
            ${FALL_F}`  : /* glsl */`
            // a river or a fall's pool (Randy, 1 Nov: "the water on land is unnatural", "ride out on the ground"): level water in its own channel. How deep it
            // is comes from the ground under it, so it's clear over the shallows and the bed shows through, deep and green-dark in the channel. Its surface
            // rides the current at the river's own speed (aF.x is the time the water takes to get here, so the pattern runs faster and stretches where the river
            // is steep), in three layers at different speeds so it lives instead of sliding; it breaks white in the rapids and churns under a fall, and laps a
            // lace of foam along its shore. The sky and the sun are in it.
            vec2 huv = (vec2(vP.x - ocMap.x, -vP.z - ocMap.y)/ocMap.z + .5)/ocMap.w;
            float dep = vG.x - texture(tOcHeight, huv).r;
            float tau = vF.x, across = vF.y, turb = vF.w, churn = vG.y;
            // (the noise tile holds ~48 cells: a ripple of a metre is ~.02 of the tile; finer than ~.1 a metre only aliases into stripes, so the finest layer
            // gives way with distance)
            // the ripples run along the current: each layer is drawn out five or six times longer than it is wide, so it reads as moving water and not as a blotched pane
            float near = 1.0 - smoothstep(9.0, 30.0, dist);
            float a = texture(tOcNoise, vec2(across*.07 + .37, (tau - t)*.017)).b;
            float b = texture(tOcNoise, vec2(across*.19 + .11 + t*.002, (tau - t*.82)*.052)).a;
            float c3 = mix(.5, texture(tOcNoise, vec2(across*.52 + .73 - t*.003, (tau - t*1.2)*.15)).b, near);
            float c4 = mix(.5, texture(tOcNoise, vec2(across*1.35 + .29, (tau - t*1.5)*.38)).a, near);
            float rough = .62 + .8*turb + 1.1*churn;
            vec3 n = normalize(vec3(((a - .5)*.30 + (b - .5)*.42 + (c3 - .5)*.5 + (c4 - .5)*.34)*rough, 1.0, ((b - .5)*.24 + (c3 - .5)*.18 + (c4 - .5)*.12)*rough));
            float F = .02 + .98*pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
            vec3 Rr = reflect(rd, n);
            // what it mirrors: at a stream's low angle that is its own banks and the trees over them, dark and green, with the sky only where the ripples tip up; no water reads as water mirroring pale haze
            float edgeK = smoothstep(.35, 1.05, abs(across)/vF.z);
            vec3 skyR = mix(ocSkyH*.72, ocSkyZ*.94, smoothstep(.0, .42, Rr.y));
            vec3 refl = mix(skyR, vec3(.022, .058, .030), clamp(.42 + .45*edgeK + .55*(1.0 - smoothstep(.02, .22, Rr.y)), 0.0, .92));
            float deep = smoothstep(.06, 1.1, dep);
            vec3 body = mix(vec3(.075, .098, .058), vec3(.012, .046, .040), deep);                 // clear over the shallows (the bed shows, drawn wet), bottle green as it deepens
            vec3 c = mix(body, refl, min(F*.9, .82));
            vec3 Hh = normalize(ocSunA - rd);
            c += ocSunCol*(.7 + .8*turb)*pow(max(dot(n, Hh), 0.0), 160.0);                         // glints
            // flecks and thin lines of bubbles drawn out along the current; white in the rapids and the churn under a fall
            float strk = smoothstep(.60, .86, texture(tOcNoise, vec2(across*.7 + .51 + a*.4, (tau - t*1.05)*.11)).b*.7 + c4*.3)*(1.0 - smoothstep(.55, 1.0, abs(across)/vF.z));
            float fn = texture(tOcNoise, vec2(across*.12 + .2, (tau - t)*.05)).b*.6 + c3*.4;
            float white = smoothstep(.70 - .38*turb - .5*churn, .94 - .22*churn, fn + b*.15)*max(turb, churn);
            float lace = (1.0 - smoothstep(.02, .20, dep))*smoothstep(.45, .74, c3*.6 + a*.4);
            vec3 foamC = ocHaze*1.2 + vec3(.06);
            c = mix(c, foamC, clamp(max(max(white, lace*.75), strk*.20), 0.0, 1.0));
            float alpha = smoothstep(0.0, .10, dep)*mix(.30, .94, max(max(deep, F*.85), max(white, lace)))*vG.z;
            if (alpha < .004) discard;`}
            gl_FragColor = vec4(ocApply(c, vP), alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      const mesh = new THREE.Mesh(g, m); mesh.name = kind; mesh.frustumCulled = false; mesh.renderOrder = wet ? 12 : fall ? 14 : 13; scene.add(mesh);
      return mesh;
    };
    return { river: rg ? make(rg.P, rg.A, rg.I, 'river', rg.B) : null, falls: make(fpos, fflow, fidx, 'fall', fgeo), wet: make(wpos, wflow, widx, 'wet'), mist: fallsMist };
  })();

  // ---------------------------------------------------------------- smoke over a crater: soft puffs rising in a loop, one draw for all of them
  const plumes = (() => {
    const list = (data.plumes || []).map(f => ({ ...f, puffs: 10, deep: 0 })).concat(freshwater ? freshwater.mist : []);
    {                                                                   // each black smoker's own smoke, lit from the fire under it
      const L = data.instances.smoker || [], g = geoms.smoker || geoms.smoker__far;
      let top = 8; if (g) { g.geometry.computeBoundingBox(); top = g.geometry.boundingBox.max.clone().applyMatrix4(g.node).y; }
      for (let i = 0; i + 5 < L.length; i += 6) if (L[i + 2] < -10) list.push({ x: L[i], y: L[i + 1], z: L[i + 2] + top * L[i + 4] * .92, r: 1.5 * L[i + 4], h: 30 * L[i + 4], puffs: phone ? 7 : 10, deep: 1 });
    }
    if (!list.length) return null;
    const n = list.reduce((t, f) => t + f.puffs, 0), P = new Float32Array(n * 4 * 3), A = new Float32Array(n * 4 * 4), Q = new Float32Array(n * 4 * 3), idx = new Uint16Array(n * 6);
    let v = 0, e = 0;
    for (const f of list) for (let i = 0; i < f.puffs; i++) {
      const base = [f.x, f.z, -f.y], ph = i / f.puffs, sd = ((i * 2654435761 + (f.x * 97 | 0)) >>> 0) / 4294967296;
      for (let k = 0; k < 4; k++, v++) { P.set(base, v * 3); A.set([ph, sd, f.r, f.h], v * 4); Q.set([k & 1 ? 1 : -1, k >> 1 ? 1 : -1, f.deep], v * 3); }
      idx.set([v - 4, v - 3, v - 2, v - 2, v - 3, v - 1], e); e += 6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aA', new THREE.BufferAttribute(A, 4)); g.setAttribute('aQ', new THREE.BufferAttribute(Q, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: U,
      vertexShader: /* glsl */`
        attribute vec4 aA; attribute vec3 aQ; uniform float ocTime; varying vec3 vP; varying vec2 vQ; varying float vT, vS, vD;
        void main() {
          vD = aQ.z;
          if (aQ.z > .5 && distance(position, cameraPosition) > 210.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float mist = step(1.5, aQ.z);                                  // a fall's spray: quick, low, wide, drifting off the foot
          float t = fract(ocTime*(mist > .5 ? .16 : aQ.z > .5 ? .055 : .018) + aA.x), rise = aA.w*(t*.88 + t*t*.12), drift = mist > .5 ? .12 : aQ.z > .5 ? .25 : 1.0;
          vec3 p = position + vec3(10.0*t*t*drift + (aA.y - .5)*aA.z*t*2.2, rise, -7.0*t*t*drift + sin(aA.y*40.0)*aA.z*t*1.6);
          float sz = aA.z*(aQ.z > .5 ? 1.0 + 3.4*t : .75 + 3.4*t);
          vec4 c = viewMatrix*vec4(p, 1.0);
          vP = p; vQ = aQ.xy; vT = t; vS = aA.y;
          c.xy += aQ.xy*sz*vec2(1.0, mist > .5 ? 1.0 : aQ.z > .5 ? 1.9 : 1.0);
          gl_Position = projectionMatrix*c;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vP; varying vec2 vQ; varying float vT, vS, vD;
        ${look.glsl}
        void main() {
          float r = length(vQ), n = texture(tOcNoise, vQ*.21 + vec2(vS*3.1, vT*.34)).b*.6 + texture(tOcNoise, vQ*.57 - vec2(vT*.41, vS*2.3)).a*.4;
          float a = smoothstep(1.0, .35, r + (n - .5)*.72)*(1.0 - smoothstep(.55, 1.0, vT))*smoothstep(.0, .07, vT)*.74;
          if (a < .01) discard;
          // lit on the side of the sky's light, a warm glow low in the column
          float lit = clamp(.5 + dot(normalize(vec3(vQ, .4)), vec3(.4, .6, .4))*.5 + (n - .5), 0.0, 1.0);
          vec3 c = mix(vec3(.050, .046, .050), vec3(.46, .44, .44), lit*(.3 + .7*vT));
          c = c*(.25 + .75*ocSunGain) + vec3(1.2, .42, .10)*(1.0 - smoothstep(.0, .16, vT))*.5;
          if (vD > 1.5) {                                                // a fall's mist: white, lit by the sky, thin
            c = mix(ocHaze*1.05, vec3(.92, .96, 1.0), .45 + .35*lit)*(.45 + .55*ocSunGain);
            a *= .2*smoothstep(4.0, 14.0, distance(vP, cameraPosition));
          } else if (vD > .5) {                                          // black smoke, the fire's red on its underside, fading up the column
            float n2 = texture(tOcNoise, vQ*.9 + vec2(vS*5.0, vT*1.3)).b*.6 + texture(tOcNoise, vQ*2.3 - vec2(vT*.9, vS*3.0)).a*.4;
            a = (1.0 - smoothstep(.25, 1.0, r + (n2 - .5)*1.3))*(1.0 - smoothstep(.55, 1.0, vT))*smoothstep(.0, .05, vT)*.86;
            float fire = (1.0 - smoothstep(.0, .55, vT))*(.5 + .5*(1.0 - smoothstep(-.8, .1, vQ.y + (n2 - .5))));
            c = mix(vec3(.040, .028, .030), vec3(2.2, .50, .09), fire*fire);
          }
          gl_FragColor = vec4(ocApply(c, vP), a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 16; mesh.name = 'plumes'; scene.add(mesh);
    return mesh;
  })();

  const nearAhead = new THREE.Vector2();
  // ---------------------------------------------------------------- fine grass at the feet: thin, soft, the colour of the ground
  const nearGrass = (() => {
    const hasMeadow = data.instances.grass_patch && data.instances.grass_patch.length > 0;
    if (!hasMeadow) return null;
    const N = phone ? 5800 : 15000, BOX = phone ? 13 : 18, seg = 2;                  // a blade: a tapering strip of two quads and a tip
    const vPerBlade = seg * 2 + 1, roots = new Float32Array(N * vPerBlade * 4), shape = new Float32Array(N * vPerBlade * 2), idx = new (N * vPerBlade < 65536 ? Uint16Array : Uint32Array)(N * (seg * 2 + 1) * 3);
    let s = 41; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let b = 0, o = 0, ii = 0; b < N; b++) {
      const x = rnd() * BOX * 2, z = rnd() * BOX * 2, seed = rnd(), base = b * vPerBlade;
      for (let k = 0; k <= seg; k++) {
        const t = k / seg;
        const put = (side, up) => { roots[o * 4] = x; roots[o * 4 + 1] = z; roots[o * 4 + 2] = seed; roots[o * 4 + 3] = rnd(); shape[o * 2] = side; shape[o * 2 + 1] = up; o++; };
        if (k < seg) { put(-(1 - t * .55), t); put(1 - t * .55, t); } else put(0, 1);
      }
      for (let k = 0; k < seg - 1; k++) { const a = base + k * 2; idx[ii++] = a; idx[ii++] = a + 1; idx[ii++] = a + 2; idx[ii++] = a + 1; idx[ii++] = a + 3; idx[ii++] = a + 2; }
      const l = base + (seg - 1) * 2; idx[ii++] = l; idx[ii++] = l + 1; idx[ii++] = l + 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('aRoot', new THREE.BufferAttribute(roots, 4)); g.setAttribute('aShape', new THREE.BufferAttribute(shape, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = look.patch(lit({ side: THREE.DoubleSide }), {
      wrap: .5, key: 'nearGrass', uniforms: { uBox: { value: BOX }, uAhead: { value: nearAhead }, uFoc: terrainU.uFocus, tBiomeG: { value: tBiome } },
      vertexDecl: 'varying vec2 vOcGust;\nattribute vec4 aRoot;\nattribute vec2 aShape;\n',
      vertexPars: 'uniform highp sampler2D tOcHeight, tOcRiver; uniform vec4 ocRiverM; uniform sampler2D tOcWet, tOcBurn; uniform vec4 ocMap, uFoc, ocWetM, ocBurnM; uniform sampler2D tBiomeG; uniform float uBox; uniform vec2 uAhead;\n',
      vertexExtra: /* glsl */`
        vec2 ocRel = mod(aRoot.xy - uAhead + uBox, 2.0*uBox) - uBox;
        vec2 ocW2 = uAhead + ocRel;
        vec2 ocUv = (vec2(ocW2.x - ocMap.x, -ocW2.y - ocMap.y)/ocMap.z + .5)/ocMap.w;
        float ocG = texture(tOcHeight, ocUv).r;
        float ocBi = texture(tBiomeG, ocUv).g;
        float ocD3 = distance(vec3(ocW2.x, ocG, ocW2.y), cameraPosition);
        float ocFade = (1.0 - smoothstep(uBox*.72, uBox*.98, length(ocRel)))*smoothstep(.2, .7, ocG)*smoothstep(.15, .45, ocBi + aRoot.w*.2);
        float ocRd = ocG - texture(tOcRiver, ocUv*ocRiverM.xy - ocRiverM.zw).r; ocFade *= ocRd < -2.4 ? 1.0 : smoothstep(-.02, .18, ocRd);
        vec2 ocWu = vec2(ocW2.x - ocWetM.x, ocWetM.y - ocW2.y)*ocWetM.z + .5;
        vec2 ocWv = ocWetM.w > 0.0 && ocWu.x > .004 && ocWu.y > .004 && ocWu.x < .996 && ocWu.y < .996 ? texture(tOcWet, ocWu).rg : vec2(0.0);      // laid flat where a ride ran, under water in a puddle (wetmap.js)
        vec2 ocBu = vec2(ocW2.x - ocBurnM.x, ocBurnM.y - ocW2.y)*ocBurnM.z + .5;
        vec4 ocBm = ocBurnM.w > 0.0 && ocBu.x > .01 && ocBu.y > .01 && ocBu.x < .99 && ocBu.y < .99 ? texture(tOcBurn, ocBu*vec2(1.0, .5)) : vec4(0.0);      // gone where it burnt, and back blade by blade (scorch.js)
        float ocH = (.28 + .46*aRoot.z)*ocFade*(1.0 - .82*ocWv.x)*(1.0 - smoothstep(.22, .40, ocWv.y))*smoothstep(aRoot.w*.4 + .05, aRoot.w*.4 + .2, 1.0 - ocBm.r);
        float ocAng = aRoot.w*6.283, ocT = aShape.y;
        vec2 ocDir = vec2(cos(ocAng), sin(ocAng));
        float ocW1 = sin(dot(ocW2, vec2(.23, .14)) - ocTime*1.75), ocW4 = sin(dot(ocW2, vec2(-.11, .31)) - ocTime*1.13 + 1.3), ocW3 = sin(dot(ocW2, vec2(.91, .67)) - ocTime*3.4 + aRoot.z*3.0);
        float ocGust = ocW1*.62 + ocW4*.38;
        vec2 ocLean = (vec2(.83, .55)*(.18 + .30*ocGust + .07*ocW3) + ocDir*.34)*(1.0 - smoothstep(.4, .7, ocBm.b));
        vec2 ocAway = ocW2 - uFoc.xz; float ocAd = length(ocAway) + .001;
        if (abs(uFoc.y - ocG) < 2.5) ocLean += ocAway/ocAd*1.6*exp(-ocAd*ocAd*.8);      // a body parts the grass
        vec3 ocWt = vec3(ocW2.x, ocG + ocH*ocT*(1.0 - .30*ocT*length(ocLean)), ocW2.y);
        ocWt.xz += ocLean*ocH*ocT*ocT;
        vec3 ocSide = normalize(cross(vec3(ocDir.y, 0.0, -ocDir.x), vec3(0.0, 1.0, 0.0)) + vec3(1e-3));
        ocWt.xz += vec2(ocDir.y, -ocDir.x)*aShape.x*(.017 + .012*aRoot.z)*ocFade;
        vOcGust = vec2(ocGust, ocT);
        vec4 mvPosition = viewMatrix*vec4(ocWt, 1.0);
        gl_Position = projectionMatrix*mvPosition;
        vOcP = ocWt;`,
      normalExtra: 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);',   // light like the ground beneath
      fragmentPars: 'varying vec2 vOcGust;\nuniform vec3 ocLandGL, ocLandGD;\n',
      albedo: /* glsl */`{ float ocM = ocMeadow(vOcP.xz);
        vec3 ocG = mix(ocLandGD, ocLandGL, smoothstep(.26, .74, ocM + (vOcGust.y - .5)*.30))*ocMeadowTint(vOcP.xz);
        diffuseColor.rgb = ocG*(.90 + vOcGust.y*(.16 + .30*max(vOcGust.x, 0.0)))*mix(1.62, 1.0, ocPaint);
        vec2 ocWu = vec2(vOcP.x - ocWetM.x, ocWetM.y - vOcP.z)*ocWetM.z + .5;
        if (ocWetM.w > 0.0 && ocWu.x > .004 && ocWu.y > .004 && ocWu.x < .996 && ocWu.y < .996) { float ocWr = texture(tOcWet, ocWu).r; diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(.42, .48, .50), ocWr); } }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.visible = false; mesh.name = 'near_grass';
    scene.add(mesh);
    return { mesh, u: m, box: BOX };
  })();

  // ---------------------------------------------------------------- bubbles: one draw, risen in the shader, near ones only
  const bubbles = (() => {
    const G = data.instances.glow_coral || [], Rk = data.instances.rock_b || [], V = data.vents || [], spots = [];
    for (const v of V) spots.push([v.x ?? v[0], v.y ?? v[1], v.z ?? v[2]]);
    for (let i = 0; i < G.length && spots.length < 36; i += 6 * 11) spots.push([G[i], G[i + 1], G[i + 2]]);
    for (let i = 0; i < Rk.length && spots.length < 60; i += 6 * 4) spots.push([Rk[i], Rk[i + 1], Rk[i + 2] + 1]);
    if (!spots.length) return null;
    const per = phone ? 14 : 26, n = spots.length * per, a = new Float32Array(n * 3), sd = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const s = spots[i / per | 0]; a[i * 3] = s[0]; a[i * 3 + 1] = s[2]; a[i * 3 + 2] = -s[1]; sd[i * 2] = Math.random(); sd[i * 2 + 1] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('aS', new THREE.BufferAttribute(sd, 2));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, toneMapped: false,
      uniforms: { ocTime: U.ocTime, ocScat: U.ocScat, ocKd: U.ocKd, ocAddGain: U.ocAddGain, uPix: { value: 500 } },
      vertexShader: /* glsl */`
        attribute vec2 aS; uniform float ocTime, uPix, ocAddGain; uniform vec3 ocScat, ocKd; varying vec3 vC;
        void main() {
          float t = fract(ocTime*(.045 + .03*aS.y) + aS.x);
          float rise = t*t*.3 + t*.7, H = 26.0 + 22.0*aS.y;
          vec3 p = position + vec3(sin(t*14.0 + aS.x*30.0)*.32*(.3 + t), rise*H, cos(t*11.0 + aS.y*30.0)*.32*(.3 + t));
          vec4 mv = viewMatrix*vec4(p, 1.0);
          float d = -mv.z;
          if (d < .5 || d > 110.0 || p.y > -.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(uPix*(.05 + .10*aS.y*(.5 + t))/d, 1.5, 22.0);
          vC = (vec3(.34, .46, .46) + ocScat*.55)*exp(-ocKd*max(-p.y, 0.0)*.6)*(1.0 - smoothstep(70.0, 110.0, d))*smoothstep(0.0, .06, t)*ocAddGain;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vC;
        void main() {
          vec2 q = gl_PointCoord*2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard;
          float rim = smoothstep(.45, .95, r)*(1.0 - smoothstep(.9, 1.0, r));
          float hi = exp(-dot(q - vec2(-.35, -.35), q - vec2(-.35, -.35))*22.0);
          gl_FragColor = vec4(vC*(rim*.9 + hi*1.6 + .05), 1.0);
        }`,
    });
    const mesh = new THREE.Points(g, m); mesh.frustumCulled = false; mesh.renderOrder = 21; scene.add(mesh);
    return mesh;
  })();
  // ---------------------------------------------------------------- spray where a fall lands (rivers.js pools): drops thrown up and out off the pool along the
  // line the sheet hits, arcing and falling back, white against the rock; one draw, moved in the shader
  const fallSpray = (() => {
    const list = riverPlan ? riverPlan.pools : [];
    if (!list.length) return null;
    const per = phone ? 170 : 380, n = list.length * per, a = new Float32Array(n * 3), sd = new Float32Array(n * 4), dir = new Float32Array(n * 2);
    let seed = 7741; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    list.forEach((pl, j) => {
      const sx = -pl.uy, sy = pl.ux;                                   // across the sheet (Blender)
      for (let i = 0; i < per; i++) {
        const k = j * per + i, u = rnd() * 2 - 1, x = pl.ft.x + sx * u * pl.sheetHalf * .9 + pl.ux * rnd() * .9, y = pl.ft.y + sy * u * pl.sheetHalf * .9 + pl.uy * rnd() * .9;
        a[k * 3] = x; a[k * 3 + 1] = pl.W + .05; a[k * 3 + 2] = -y;
        const sp = (rnd() - .5) * 2.4, dx = pl.ux * Math.cos(sp) - pl.uy * Math.sin(sp), dy = pl.ux * Math.sin(sp) + pl.uy * Math.cos(sp);      // out from the rock, fanned
        dir[k * 2] = dx; dir[k * 2 + 1] = -dy;
        sd[k * 4] = rnd(); sd[k * 4 + 1] = rnd(); sd[k * 4 + 2] = rnd(); sd[k * 4 + 3] = rnd();
      }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('aS', new THREE.BufferAttribute(sd, 4)); g.setAttribute('aD', new THREE.BufferAttribute(dir, 2));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { ocTime: U.ocTime, ocHaze: U.ocHaze, ocSunCol: U.ocSunCol, uPix: { value: 500 } },
      vertexShader: /* glsl */`
        attribute vec4 aS; attribute vec2 aD; uniform float ocTime, uPix; varying float vA;
        void main() {
          float life = .75 + .7*aS.w, t = fract(ocTime/life + aS.x)*life;
          float up = 2.6 + 5.2*aS.z*aS.z, out_ = 1.0 + 3.6*aS.y;
          vec3 p = position + vec3(aD.x*out_*t, up*t - 4.9*t*t, aD.y*out_*t);
          vec4 mv = viewMatrix*vec4(p, 1.0); float d = -mv.z;
          if (d < .3 || d > 150.0 || p.y < position.y - .08) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(uPix*(.05 + .10*aS.w)/d, 1.0, 28.0);
          vA = (1.0 - t/life)*smoothstep(0.0, .06, t)*(1.0 - smoothstep(100.0, 150.0, d));
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 ocHaze, ocSunCol; varying float vA;
        void main() { vec2 q = gl_PointCoord*2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard; float a = pow(1.0 - r, 1.5)*vA*.62;
          gl_FragColor = vec4(min(ocHaze*1.15 + ocSunCol*.05, vec3(1.0)), a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Points(g, m); mesh.frustumCulled = false; mesh.renderOrder = 17; scene.add(mesh);
    return mesh;
  })();
  const pxSize = new THREE.Vector2();

  let cursor = 0;
  const lastCam = new THREE.Vector3(1e9, 0, 0), lastDir = new THREE.Vector3(), dirNow = new THREE.Vector3();
  // A batch's list on the GPU holds what's in view, not the whole world's copies of a kind: it starts short and grows the first time a view asks for more (1 Nov: every list at full
  // size was 2.0 MB on the GPU, and as much again in the page's own copy, once all of them had been drawn). The old list is handed back, and a grown one keeps a margin so a kind doesn't grow every few steps.
  function roomFor(m, need, most) {
    if (need <= m.instanceMatrix.count) return;
    const n = Math.min(most, Math.ceil(need * 1.5)), a = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16), c = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    a.setUsage(THREE.DynamicDrawUsage); c.setUsage(THREE.DynamicDrawUsage); a.array.set(m.instanceMatrix.array); c.array.set(m.instanceColor.array);
    m.dispose(); m.instanceMatrix = a; m.instanceColor = c;
  }
  function refill(b, cam) {
    let w = 0, wf = 0;
    const fm = b.far ? b.far.mesh : null;
    let wc = 0; const cm = b.cards ? b.cards.mesh : null;
    for (const c of b.cells) {
      const d = c.center.distanceTo(cam) - c.sphere.radius;
      if (d > b.reach || !frustum.intersectsSphere(c.sphere)) continue;
      if (cm) { roomFor(cm, wc + c.count, b.count); cm.instanceMatrix.array.set(b.cards.M.subarray(c.start * 16, (c.start + c.count) * 16), wc * 16); cm.instanceColor.array.set(b.C.subarray(c.start * 3, (c.start + c.count) * 3), wc * 3); wc += c.count; }
      if (fm) c.farOn = c.farOn ? d > b.far.range - 6 : d > b.far.range + 6;
      if (fm && c.farOn) {
        roomFor(fm, wf + c.count, b.count);
        fm.instanceMatrix.array.set(b.far.M.subarray(c.start * 16, (c.start + c.count) * 16), wf * 16);
        fm.instanceColor.array.set(b.C.subarray(c.start * 3, (c.start + c.count) * 3), wf * 3);
        wf += c.count;
        continue;
      }
      const thin = b.family === 'meadow' || b.family === 'flowers' ? Math.ceil(c.count * (d < 14 ? 1 : d < 30 ? .55 : .28)) : 0;
      const n = thin || (d > (phone ? 24 : 80) && c.base ? c.base : c.count);
      roomFor(b.mesh, w + n, b.count);
      b.mesh.instanceMatrix.array.set(b.M.subarray(c.start * 16, (c.start + n) * 16), w * 16);
      b.mesh.instanceColor.array.set(b.C.subarray(c.start * 3, (c.start + n) * 3), w * 3);
      w += n;
    }
    if (cm) {
      cm.count = wc; cm.visible = wc > 0;
      if (wc) { const ia = cm.instanceMatrix, ic = cm.instanceColor; ia.clearUpdateRanges(); ia.addUpdateRange(0, wc * 16); ia.needsUpdate = true; ic.clearUpdateRanges(); ic.addUpdateRange(0, wc * 3); ic.needsUpdate = true; }
    }
    if (fm) {
      fm.count = wf; fm.visible = wf > 0;
      if (wf) { const fa = fm.instanceMatrix, fc = fm.instanceColor; fa.clearUpdateRanges(); fa.addUpdateRange(0, wf * 16); fa.needsUpdate = true; fc.clearUpdateRanges(); fc.addUpdateRange(0, wf * 3); fc.needsUpdate = true; }
    }
    b.mesh.count = w; b.mesh.visible = w > 0;
    if (w) { const am = b.mesh.instanceMatrix, ac = b.mesh.instanceColor; am.clearUpdateRanges(); am.addUpdateRange(0, w * 16); am.needsUpdate = true; ac.clearUpdateRanges(); ac.addUpdateRange(0, w * 3); ac.needsUpdate = true; }
  }
  function updateInstances(camera) {
    camera.getWorldDirection(dirNow);
    // Everything refills in one go only when the view has really changed; else a few kinds a frame keep it fresh.
    const moved = lastCam.distanceToSquared(camera.position) > 36 || lastDir.dot(dirNow) < .985;
    if (moved) { lastCam.copy(camera.position); lastDir.copy(dirNow); for (const b of batches) refill(b, camera.position); return; }
    for (let i = 0; i < 3 && batches.length; i++) { cursor = (cursor + 1) % batches.length; refill(batches[cursor], camera.position); }
  }

  // ---------------------------------------------------------------- the sun's map: one bake at load, then it is a texture read
  // A bake's depth buffer is for the bake. Its picture moves to a target without one: 2.2 MB each that nothing reads again.
  function noDepth(rt, S) {
    const out = new THREE.WebGLRenderTarget(S, S, { format: THREE.RedFormat, type: THREE.UnsignedByteType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false });
    const m = new THREE.ShaderMaterial({ uniforms: { t: { value: rt.texture } }, depthTest: false, depthWrite: false, toneMapped: false, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: 'uniform sampler2D t; void main() { gl_FragColor = texelFetch(t, ivec2(gl_FragCoord.xy), 0); }' });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const q = new THREE.Mesh(g, m), s = new THREE.Scene(), prev = renderer.getRenderTarget(); q.frustumCulled = false; s.add(q);
    renderer.setRenderTarget(out); renderer.render(s, new THREE.Camera()); renderer.setRenderTarget(prev);
    g.dispose(); m.dispose(); rt.dispose();
    return out;
  }
  function bakeSun() {
    const S = phone ? 768 : 1024;
    // sun rays hit the plane y = 0 at q; the map covers the world sheared along the sun
    const pad = 140 * Math.tan(Math.acos(U.ocSunW.value.y)) + 30;
    const cx = ox + size / 2, cz = -(oy + size / 2), half = size / 2 + pad;
    const m = new THREE.Vector4(cx - half, cz - half, 1 / (2 * half), 1 / (2 * half));
    const rt = new THREE.WebGLRenderTarget(S, S, { format: THREE.RedFormat, type: THREE.UnsignedByteType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: true });
    const proj = /* glsl */`
      uniform vec3 ocSunW; uniform vec4 ocSunM; varying float vD;
      vec4 ocBake(vec3 P) {
        float d = max(-P.y, 0.0);
        vec2 q = P.xz + ocSunW.xz*(d/ocSunW.y);
        vec2 uv = (q - ocSunM.xy)*ocSunM.zw;
        vD = d;
        return vec4(uv*2.0 - 1.0, sqrt(d/300.0)*2.0 - 1.0, 1.0);
      }`;
    const u = { ocSunW: U.ocSunW, ocSunM: { value: m }, tOcHeight: U.tOcHeight, ocMap: U.ocMap };
    const frag = `varying float vD; void main(){ gl_FragColor = vec4(sqrt(vD/300.0), 0.0, 0.0, 1.0); }`;
    const instM = new THREE.ShaderMaterial({ uniforms: u, side: THREE.DoubleSide, toneMapped: false, vertexShader: proj + `void main(){ gl_Position = ocBake((modelMatrix*instanceMatrix*vec4(position, 1.0)).xyz); }`, fragmentShader: frag });
    const landM = new THREE.ShaderMaterial({
      uniforms: u, side: THREE.DoubleSide, toneMapped: false, fragmentShader: frag,
      vertexShader: proj + /* glsl */`
        uniform highp sampler2D tOcHeight; uniform vec4 ocMap;
        void main() { vec3 p = position; vec2 uv = (vec2(p.x - ocMap.x, -p.z - ocMap.y)/ocMap.z + .5)/ocMap.w; p.y = texture(tOcHeight, uv).r; gl_Position = ocBake(p); }`,
    });
    const s = new THREE.Scene();
    const land = look.bakeGrid(size + 2 * pad, 300, cx, cz, true);
    const lm = new THREE.Mesh(land, landM); lm.frustumCulled = false; s.add(lm);
    const temp = [];
    for (const b of batches) {
      if (b.family === 'grass' || b.family === 'anemone' || b.family === 'glow') continue;
      const im = new THREE.InstancedMesh(b.mesh.geometry, instM, b.count);
      im.instanceMatrix.array.set(b.M); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; s.add(im); temp.push(im);
    }
    addCasters(s, temp, instM);
    const prev = renderer.getRenderTarget(), col = new THREE.Color(); renderer.getClearColor(col); const al = renderer.getClearAlpha();
    renderer.setRenderTarget(rt); renderer.setClearColor(0xffffff, 1); renderer.clear();
    renderer.render(s, new THREE.Camera());
    renderer.setRenderTarget(prev); renderer.setClearColor(col, al);
    land.dispose(); landM.dispose(); instM.dispose(); temp.forEach(i => i.dispose());
    const kept = noDepth(rt, S);
    look.setSunMap(kept.texture, m);
    return kept;
  }
  // what stands in the sun besides the props: every building, and the sky islands, which lay their shadow on the land under them. Randy, 2 Nov: "we HAVE 0 shadows in the game". Pipeline/research/LIGHT_SOURCES.md
  let cityMeshes = [], skyMeshes = [];
  function addCasters(s, temp, instM) {
    for (const m of cityMeshes) { const im = new THREE.InstancedMesh(m.geometry, instM, m.count); im.instanceMatrix.array.set(m.instanceMatrix.array); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; s.add(im); temp.push(im); }
    for (const m of skyMeshes) { const im = new THREE.InstancedMesh(m.geometry, instM, 1); m.updateWorldMatrix(true, false); im.setMatrixAt(0, m.matrixWorld); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; s.add(im); temp.push(im); }
  }

  // The same for the land: along the true sun, the highest surface on each ray, so hills, walls, trees and houses throw soft shadows.
  function bakeLand() {
    const S = phone ? 768 : 1024, TOP = 180, sa = U.ocSunA.value;
    const pad = TOP * Math.tan(Math.acos(sa.y)) + 30;
    const cx = ox + size / 2, cz = -(oy + size / 2), half = size / 2 + pad;
    const m = new THREE.Vector4(cx - half, cz - half, 1 / (2 * half), 1 / (2 * half));
    const rt = new THREE.WebGLRenderTarget(S, S, { format: THREE.RedFormat, type: THREE.UnsignedByteType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: true });
    const proj = /* glsl */`
      uniform vec3 ocSunA; uniform vec4 ocLandM; varying float vD;
      vec4 ocBake(vec3 P) {
        float h = clamp(P.y, 0.0, ${TOP}.0);
        vec2 q = P.xz - ocSunA.xz*(h/ocSunA.y);
        vD = sqrt(h/${TOP}.0);
        return vec4((q - ocLandM.xy)*ocLandM.zw*2.0 - 1.0, 1.0 - vD*2.0, 1.0);
      }`;
    const u = { ocSunA: U.ocSunA, ocLandM: { value: m }, tOcHeight: U.tOcHeight, ocMap: U.ocMap };
    const frag = `varying float vD; void main(){ gl_FragColor = vec4(vD, 0.0, 0.0, 1.0); }`;
    const instM = new THREE.ShaderMaterial({ uniforms: u, side: THREE.DoubleSide, toneMapped: false, vertexShader: proj + `void main(){ gl_Position = ocBake((modelMatrix*instanceMatrix*vec4(position, 1.0)).xyz); }`, fragmentShader: frag });
    const landM = new THREE.ShaderMaterial({
      uniforms: u, side: THREE.DoubleSide, toneMapped: false, fragmentShader: frag,
      vertexShader: proj + /* glsl */`
        uniform highp sampler2D tOcHeight; uniform vec4 ocMap;
        void main() { vec3 p = position; vec2 uv = (vec2(p.x - ocMap.x, -p.z - ocMap.y)/ocMap.z + .5)/ocMap.w; p.y = texture(tOcHeight, uv).r; gl_Position = ocBake(p); }`,
    });
    const s = new THREE.Scene();
    const land = look.bakeGrid(size + 2 * pad, 400, cx, cz, true);
    const lm = new THREE.Mesh(land, landM); lm.frustumCulled = false; s.add(lm);
    const temp = [];
    for (const b of batches) {
      if (b.family === 'meadow' || b.family === 'flowers' || b.family === 'shrub') continue;
      let top = -1e9; for (let k = 0; k < b.count; k++) top = Math.max(top, b.M[k * 16 + 13]);
      if (top + b.rad < 0) continue;
      const im = new THREE.InstancedMesh(b.mesh.geometry, instM, b.count);
      im.instanceMatrix.array.set(b.M); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; s.add(im); temp.push(im);
    }
    addCasters(s, temp, instM);
    const prev = renderer.getRenderTarget(), col = new THREE.Color(); renderer.getClearColor(col); const al = renderer.getClearAlpha();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear();
    renderer.render(s, new THREE.Camera());
    renderer.setRenderTarget(prev); renderer.setClearColor(col, al);
    land.dispose(); landM.dispose(); instM.dispose(); temp.forEach(i => i.dispose());
    look.setLandMap(noDepth(rt, S).texture, m);
  }
  look.onRestore(() => {
    const f = heightFloats();
    tHeight.image.data = f; freeAfter(tHeight); tHeight.needsUpdate = true;
    if (tRiver) { tRiver.image.data = riverPlan.fillLevel(); freeAfter(tRiver); tRiver.needsUpdate = true; }
    wetMap.restore();
    tNormal.image.data = normalBytes(f); freeAfter(tNormal); tNormal.needsUpdate = true;
    tGlow.image.data = tGlow.remake(); freeAfter(tGlow); tGlow.needsUpdate = true;
    if (tPool) { tPool.image.data = tPool.remake(); freeAfter(tPool); tPool.needsUpdate = true; }
    bakeSun(); bakeLand();
    const again = (t, name, file) => { (FILES[name] ? weightFile(base + FILES[name], bn) : getBin(base + file)).then((b) => { const u = new Uint8Array(b); t.image.data = smaller(name === 'biome2' ? paintIsle(u, bn, 2 * cell, ox, oy) : u); freeAfter(t); t.needsUpdate = true; }).catch(() => {}); };
    tBiome.image.data = new Uint8Array(wN * wN * 4); tBiome.needsUpdate = true; again(tBiome, 'biome', 'biome.bin');
    if (biome2Bytes) { tBiome2.image.data = new Uint8Array(wN * wN * 4); tBiome2.needsUpdate = true; again(tBiome2, 'biome2', 'biome2.bin'); }
  });
  prog(.95);

  // ---------------------------------------------------------------- colliders
  // Every solid is ten numbers in one typed array: x, y, z0, z1, r or hx, hy, cos yaw, sin yaw, yaw, and a spare. Fifty thousand of them as objects cost the heap
  // what a phone can't give. data.colliders is a view of the store, made only if something asks (the walls do; the game reads the store).
  // Most solids are copies per instance, so world.json can hold a kind's shape once. The arena gate is the world's: its solids and mesh stand until setGateOpen(true), then it sinks into the sand.
  const G8 = data.arena && data.arena.gate;
  // the cities' solids join the world's own (planned above, before any instance was drawn)
  data.colliders = (data.colliders || []).concat(cityPlan.colliders, cliffPlan.colliders);
  // the cities' ink: the hull pushed out a constant 1.2 px on the screen near, thinning to nothing by 120 m. It's in the water's haze like everything else (Randy, 1 Nov: "there is a
  // black outline that follows when I'm approaching them": drawn flat black, the outline hung in the water ahead of buildings the haze had already taken)
  const cityInk = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: U,
    vertexShader: /* glsl */`uniform float ocInkH; varying vec3 vP;
      void main() {
        vec3 ocN = normal; vec4 wp = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          ocN = mat3(instanceMatrix)*ocN; wp = instanceMatrix*wp;
        #endif
        wp = modelMatrix*wp; vec4 mv = viewMatrix*wp; vP = wp.xyz;
        vec3 nv = normalize(normalMatrix*ocN); float d = max(-mv.z, .1), perM = projectionMatrix[1][1]*ocInkH*.5/d;
        mv.xyz += nv*1.2*(1.0 - smoothstep(50.0, 120.0, d))/perM; gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`varying vec3 vP;
      ${look.glsl}
      void main() {
        gl_FragColor = vec4(ocApply(vec3(.016, .040, .052), vP), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  cityMeshes = cityPlan.build(scene, (k) => k === 'ink' ? cityInk : familyMat('city'));
  // each building's damage slot (scorch.js): a geometry of its own over the shared buffers, so the instanced damage values are per city
  for (const m of cityMeshes) { const g = m.geometry, g2 = new THREE.BufferGeometry(); for (const k in g.attributes) g2.setAttribute(k, g.attributes[k]); g2.setIndex(g.index); g2.boundingBox = g.boundingBox; g2.boundingSphere = g.boundingSphere; g2.setAttribute('aDmg', new THREE.InstancedBufferAttribute(new Uint8Array(m.count * 4), 4, true).setUsage(THREE.DynamicDrawUsage)); m.geometry = g2; }
  { const before = new Set(scene.children); skyRock(scene, look, U); for (const o of scene.children) if (!before.has(o)) o.traverse((q) => { if (q.isMesh) skyMeshes.push(q); }); }
  bakeSun(); bakeLand();
  const mirror = createMirror({ renderer, U, heightAt, biomeWeights, ox, oy, size, cities: cityMeshes, isle: ISLE, phone });
  const lava = createLava(scene, look, heightAt, phone);
  const listed = data.colliders || [], kinds = data.col_kinds || {};
  let NS = listed.length, NV = 0;
  for (const name in kinds) { const I = data.instances[name]; if (I) NS += (I.length / 6 | 0) * kinds[name].length; }
  NV = NS;
  if (G8 && G8.col) NS += G8.col.length;
  const SN = 10, F = new Float32Array(NS * SN), CYL = new Uint8Array(NS), OFF = new Uint8Array(NS), GATE = new Uint8Array(NS);
  let sn = 0;
  const put = (t, x, y, z0, z1, a, b, yaw) => {
    const o = sn * SN; CYL[sn] = t === 'cyl' ? 1 : 0;
    F[o] = x; F[o + 1] = y; F[o + 2] = z0; F[o + 3] = z1; F[o + 4] = a; F[o + 5] = b; F[o + 6] = Math.cos(yaw); F[o + 7] = Math.sin(yaw); F[o + 8] = yaw;
    return sn++;
  };
  for (const c of listed) { const i = put(c.t, c.x, c.y, c.z0, c.z1, c.t === 'cyl' ? c.r : c.hx, c.t === 'cyl' ? 0 : c.hy, c.yaw || 0); if (c.gate) GATE[i] = 1; }
  for (const name in kinds) {
    const I = data.instances[name]; if (!I) continue;
    for (let k = 0; k + 5 < I.length; k += 6) {
      const x = I[k], y = I[k + 1], z = I[k + 2], yaw = I[k + 3], s = I[k + 4], co = Math.cos(yaw), si = Math.sin(yaw);
      for (const c of kinds[name]) {
        const wx = x + (c.x * co - c.y * si) * s, wy = y + (c.x * si + c.y * co) * s, cyl = c.t === 'cyl';
        let z0 = z + c.z0 * s;
        if (c.foot) {                                                   // a piece on a slope reaches down past the lowest ground under it
          const R = cyl ? c.r * s : Math.hypot(c.hx, c.hy) * s;
          z0 = Math.min(z0, Math.min(heightAt(wx, wy), heightAt(wx + R, wy), heightAt(wx - R, wy), heightAt(wx, wy + R), heightAt(wx, wy - R)) - .4);
        }
        put(c.t, wx, wy, z0, z + c.z1 * s, cyl ? c.r * s : c.hx * s, cyl ? 0 : c.hy * s, cyl ? 0 : yaw + (c.yaw || 0));
      }
    }
  }
  if (G8 && G8.col) {
    const c = Math.cos(G8.yaw || 0), s = Math.sin(G8.yaw || 0);
    for (const k of G8.col) { const i = put(k.t, G8.x + k.x * c - k.y * s, G8.y + k.x * s + k.y * c, G8.z + k.z0, G8.z + k.z1, k.t === 'cyl' ? k.r : k.hx, k.t === 'cyl' ? 0 : k.hy, (k.yaw || 0) + (G8.yaw || 0)); GATE[i] = 1; }
  }
  delete data.col_kinds;
  class Solid {
    constructor(i) { this.i = i; }
    get t() { return CYL[this.i] ? 'cyl' : 'box'; } get x() { return F[this.i * SN]; } get y() { return F[this.i * SN + 1]; } get z0() { return F[this.i * SN + 2]; } get z1() { return F[this.i * SN + 3]; }
    get r() { return CYL[this.i] ? F[this.i * SN + 4] : undefined; } get hx() { return CYL[this.i] ? undefined : F[this.i * SN + 4]; } get hy() { return CYL[this.i] ? undefined : F[this.i * SN + 5]; }
    get yaw() { return F[this.i * SN + 8]; } get gate() { return GATE[this.i] === 1; } toJSON() { return { t: this.t, x: this.x, y: this.y, z0: this.z0, z1: this.z1, r: this.r, hx: this.hx, hy: this.hy, yaw: this.yaw }; }
    get off() { return OFF[this.i] === 1; } set off(v) { OFF[this.i] = v ? 1 : 0; }
  }
  let views = null;
  Object.defineProperty(data, 'colliders', { enumerable: true, configurable: true, get() { return (views ||= Array.from({ length: NV }, (_, i) => new Solid(i))); } });
  let gateMesh = null, gateNow = 0, gateTo = 0, gateTop = 0;
  if (G8) {
    const g = geoms.arena_gate || { geometry: new THREE.BoxGeometry(10, 15, 1.6).translate(0, 7.5, 0), node: new THREE.Matrix4() };
    gateMesh = new THREE.Mesh(g.geometry, familyMat('stone'));
    gateMesh.matrixAutoUpdate = false; gateMesh.frustumCulled = false; gateMesh.name = 'arena_gate';
    gateTop = (G8.size && G8.size[2]) || 15;
    scene.add(gateMesh);
  }
  const placeGate = () => {
    if (!gateMesh) return;
    dummy.position.set(G8.x, G8.z - gateNow * (gateTop + 1), -G8.y); dummy.rotation.set(0, G8.yaw || 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
    gateMesh.matrix.copy(dummy.matrix); if (geoms.arena_gate) gateMesh.matrix.multiply(geoms.arena_gate.node);
    gateMesh.visible = gateNow < .995;
  };
  placeGate();
  function setGateOpen(on) { gateTo = on ? 1 : 0; for (let i = 0; i < NS; i++) if (GATE[i]) OFF[i] = on ? 1 : 0; }
  // The cells a solid touches, as flat lists: start[cell] .. start[cell + 1] in `items`.
  const HC = 32, HX0 = Math.floor(ox / HC) - 2, HY0 = Math.floor(oy / HC) - 2, HN = Math.ceil(size / HC) + 5;
  const hcell = (v, o) => { const c = Math.floor(v / HC) - o; return c < 0 ? 0 : c >= HN ? HN - 1 : c; };
  const stampOf = new Uint32Array(NS), start = new Int32Array(HN * HN + 1); let stamp = 0;
  const reachOf = (i) => (CYL[i] ? F[i * SN + 4] : Math.hypot(F[i * SN + 4], F[i * SN + 5]));
  for (let i = 0; i < NS; i++) {
    const r = reachOf(i), x = F[i * SN], y = F[i * SN + 1], x0 = hcell(x - r, HX0), x1 = hcell(x + r, HX0), y0 = hcell(y - r, HY0), y1 = hcell(y + r, HY0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) start[cy * HN + cx + 1]++;
  }
  for (let i = 0; i < HN * HN; i++) start[i + 1] += start[i];
  const items = new Int32Array(start[HN * HN]), fill = start.slice();
  for (let i = 0; i < NS; i++) {
    const r = reachOf(i), x = F[i * SN], y = F[i * SN + 1], x0 = hcell(x - r, HX0), x1 = hcell(x + r, HX0), y0 = hcell(y - r, HY0), y1 = hcell(y + r, HY0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) items[fill[cy * HN + cx]++] = i;
  }
  function pushCyl(p, k, r) {
    const o = k * SN, cx = F[o], cy = F[o + 1], z0 = F[o + 2], z1 = F[o + 3], R = F[o + 4];
    const dz = Math.max(z0, Math.min(z1, p.z)) - p.z, dx = p.x - cx, dy = p.y - cy, h = Math.hypot(dx, dy);
    if (Math.abs(dz) >= r || h >= R + r) return false;
    if (h > R) {                                                   // beside the cylinder, or round its rim
      const nx = dx / h, ny = dy / h, qx = h - R, qz = -dz, dist = Math.hypot(qx, qz);
      if (dist >= r || dist < 1e-6) return false;
      const m = (r - dist) / dist; p.x += nx * qx * m; p.y += ny * qx * m; p.z += qz * m;
      return true;
    }
    if (dz !== 0) { p.z += dz > 0 ? dz - r : dz + r; return true; } // over or under it
    const up = z1 - p.z, dn = p.z - z0, out = R - h;              // inside it: leave by the nearest way
    if (out + r < Math.min(up, dn) + r || (up > r * 4 && dn > r * 4)) { const nx = h > 1e-6 ? dx / h : 1, ny = h > 1e-6 ? dy / h : 0; p.x += nx * (out + r); p.y += ny * (out + r); } else if (up < dn) p.z = z1 + r; else p.z = z0 - r;
    return true;
  }
  function pushBox(p, k, r) {
    const o = k * SN, bx = F[o], by = F[o + 1], z0 = F[o + 2], z1 = F[o + 3], hx = F[o + 4], hy = F[o + 5], bc = F[o + 6], bs = F[o + 7];
    const dx = p.x - bx, dy = p.y - by;
    let lx = dx * bc + dy * bs, ly = -dx * bs + dy * bc, lz = p.z;
    const qx = Math.max(-hx, Math.min(hx, lx)), qy = Math.max(-hy, Math.min(hy, ly)), qz = Math.max(z0, Math.min(z1, lz));
    const ex = lx - qx, ey = ly - qy, ez = lz - qz, d2 = ex * ex + ey * ey + ez * ez;
    if (d2 >= r * r) return false;
    if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; lx += ex * k; ly += ey * k; lz += ez * k; } else {
      const ax = hx - Math.abs(lx), ay = hy - Math.abs(ly), az = Math.min(z1 - lz, lz - z0), m = Math.min(ax, ay, az);
      if (m === ax) lx = Math.sign(lx || 1) * (hx + r); else if (m === ay) ly = Math.sign(ly || 1) * (hy + r); else lz = (z1 - lz < lz - z0) ? z1 + r : z0 - r;
    }
    p.x = bx + lx * bc - ly * bs; p.y = by + lx * bs + ly * bc; p.z = lz;
    return true;
  }
  // Which solid holds this point, or -1. A centre, not a touch; a centre on a face counts as in.
  function solidAt(x, y, z) {
    const c = hcell(y, HY0) * HN + hcell(x, HX0);
    for (let e = start[c], end = start[c + 1]; e < end; e++) {
      const k = items[e], o = k * SN; if (OFF[k] || z < F[o + 2] || z > F[o + 3]) continue;
      const dx = x - F[o], dy = y - F[o + 1];
      if (CYL[k] ? dx * dx + dy * dy <= F[o + 4] * F[o + 4] : Math.abs(dx * F[o + 6] + dy * F[o + 7]) <= F[o + 4] && Math.abs(-dx * F[o + 7] + dy * F[o + 6]) <= F[o + 5]) return k;
    }
    return -1;
  }
  // Which solid a body of radius r overlaps here, or -1. A graze of a centimetre doesn't count.
  function solidNear(x, y, z, r) {
    const R = r - .01, x0 = hcell(x - r, HX0), x1 = hcell(x + r, HX0), y0 = hcell(y - r, HY0), y1 = hcell(y + r, HY0);
    stamp++;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = cy * HN + cx;
      for (let e = start[c], end = start[c + 1]; e < end; e++) {
        const k = items[e]; if (stampOf[k] === stamp) continue; stampOf[k] = stamp; if (OFF[k]) continue;
        const o = k * SN, dz = z - Math.max(F[o + 2], Math.min(F[o + 3], z)), dx = x - F[o], dy = y - F[o + 1];
        let ex, ey = 0;
        if (CYL[k]) ex = Math.max(Math.hypot(dx, dy) - F[o + 4], 0);
        else { ex = Math.max(Math.abs(dx * F[o + 6] + dy * F[o + 7]) - F[o + 4], 0); ey = Math.max(Math.abs(-dx * F[o + 7] + dy * F[o + 6]) - F[o + 5], 0); }
        if (ex * ex + ey * ey + dz * dz < R * R) return k;
      }
    }
    return -1;
  }
  // The centre of a body is inside a solid. Pushes can't be trusted here: two boxes sharing a face hand it back and forth, a bed rising under a rock's lower edge undoes the push down, and either
  // sums to nothing, which reads as free. So it walks out, ten ways from where it is, the first square to this solid's faces, to the nearest place a body fits, the ground counted. That's the nearest
  // face when the face leads anywhere; but it can lead into the next box, and a rock is a heap of boxes.
  function eject(p, r, k) {
    const o = k * SN, a0 = CYL[k] ? Math.atan2(p.y - F[o + 1], p.x - F[o]) : F[o + 8], x0 = p.x, y0 = p.y, z0 = p.z;
    const at = (x, y, z) => Math.max(z, heightAt(x, y) + r);
    let best = 70;
    for (let w = 0; w < 10; w++) {
      const a = a0 + w * Math.PI / 4, ux = w < 8 ? Math.cos(a) : 0, uy = w < 8 ? Math.sin(a) : 0, uz = w === 8 ? 1 : w === 9 ? -1 : 0;
      for (let s = .5, was = 0; s < best; was = s, s += s < 8 ? .5 : s < 24 ? 1 : 2) {
        const x = x0 + ux * s, y = y0 + uy * s, z = z0 + uz * s;
        if (uz < 0 && z < heightAt(x, y) + r) break;                        // down to the bed: no way out
        if (solidNear(x, y, at(x, y, z), r) >= 0) continue;
        let lo = was, hi = s;                                               // out: back to the edge
        for (let i = 0; i < 4; i++) { const m = (lo + hi) / 2, mx = x0 + ux * m, my = y0 + uy * m; if (solidNear(mx, my, at(mx, my, z0 + uz * m), r) >= 0) lo = m; else hi = m; }
        best = hi; p.x = x0 + ux * hi; p.y = y0 + uy * hi; p.z = at(p.x, p.y, z0 + uz * hi);
        break;
      }
    }
    if (best < 70) return;
    let z = at(x0, y0, F[o + 3] + r);                                       // nowhere near: up, over whatever is stacked here
    for (let i = 0; i < 24; i++) { const m = solidNear(x0, y0, z, r); if (m < 0) break; z = F[m * SN + 3] + r + .01; }
    p.z = z;
  }
  // A body pushed out of one solid can land in its neighbour: passes until nothing moves, floor included. A touch isn't a push: under a millimetre
  // ends it. In a slot narrower than the body the pushes never settle: there the middle of the last two answers is the middle of the slot.
  function collide(p, r) {
    let hit = false, px = p.x, py = p.y, pz = p.z;
    for (let i = 0; i < 8; i++) {
      const k = solidAt(p.x, p.y, p.z);                                  // asked outright: pushes in turn can lift a body out of a solid before its turn comes, and the next one press it back
      if (k >= 0) { eject(p, r, k); hit = true; }
      px = p.x; py = p.y; pz = p.z;
      if (!collideOnce(p, r)) return hit;
      hit = true;
      if (Math.abs(p.x - px) + Math.abs(p.y - py) + Math.abs(p.z - pz) < .001) return hit;
    }
    p.x = (p.x + px) * .5; p.y = (p.y + py) * .5; p.z = Math.max((p.z + pz) * .5, heightAt(p.x, p.y) + r);
    const k = solidAt(p.x, p.y, p.z); if (k >= 0) eject(p, r, k);
    return hit;
  }
  // The first thing a sphere meets going from `from` to `to`, steps never longer than half its radius, so nothing thin is crossed.
  // Returns null if the way is clear, else { t (0..1 of the way), x, y, z (the last place before it), nx, ny, nz (the way it was pushed) }.
  const sw = { x: 0, y: 0, z: 0 }, sw0 = { x: 0, y: 0, z: 0 }, swHit = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 1 };
  function badStart(p, r) { sw0.x = p.x; sw0.y = p.y; sw0.z = p.z; collideOnce(sw0, r); return fought || solidAt(p.x, p.y, p.z) >= 0; }
  function sweep(from, to, r) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, d = Math.hypot(dx, dy, dz);
    const n = Math.max(1, Math.ceil(d / Math.max(r * .5, .08)));
    let lx = from.x, ly = from.y, lz = from.z, bad = -1;
    for (let i = 1; i <= n; i++) {
      const t = i / n; sw.x = from.x + dx * t; sw.y = from.y + dy * t; sw.z = from.z + dz * t;
      const qx = sw.x, qy = sw.y, qz = sw.z;
      if (collideOnce(sw, r)) {
        const wedged = fought, px = sw.x - qx, py = sw.y - qy, pz = sw.z - qz, l = Math.hypot(px, py, pz) || 1;
        // Touching isn't blocked: a body resting on a surface, or moving along it or off it, is pushed by a hair at every step. Only a move that heads into
        // the surface is stopped: more than a skin of 4 mm deep, and more than about 2 degrees into it.
        // And a push that doesn't settle means a gap narrower than the body (a ridge rising under a roof of ice): that's a wall, whichever way the push went. So is a step with the
        // centre inside a solid, where pushes that cancel read as no push at all. A body that starts in such a place may leave it by any way: a wall there would only freeze it.
        const heads = l >= .004 && (px * dx + py * dy + pz * dz) / (l * (d || 1)) <= -.03;
        let wall = !heads && (wedged || (l >= .004 && !settles(sw, r)) || solidAt(qx, qy, qz) >= 0);
        if (wall) { if (bad < 0) bad = badStart(from, r) ? 1 : 0; if (bad) wall = false; }
        if (!heads && !wall) { lx = qx; ly = qy; lz = qz; continue; }
        swHit.t = (i - 1) / n; swHit.x = lx; swHit.y = ly; swHit.z = lz;
        if (wall) { const m = d || 1; swHit.nx = -dx / m; swHit.ny = -dy / m; swHit.nz = -dz / m; } else { swHit.nx = px / l; swHit.ny = py / l; swHit.nz = pz / l; }
        return swHit;
      }
      lx = qx; ly = qy; lz = qz;
    }
    return null;
  }
  // Does a place pushed out of one surface settle, or does the next one push it back? A solid's push undone by the ground in the same pass is the plainest case: floor and roof fight.
  let fought = false;
  function settles(p, r) {
    for (let k = 0; k < 4; k++) {
      const x = p.x, y = p.y, z = p.z, pushed = collideOnce(p, r);
      if (fought) return false;
      if (!pushed || Math.abs(p.x - x) + Math.abs(p.y - y) + Math.abs(p.z - z) < .001) return true;
    }
    return false;
  }
  function collideOnce(p, r) {
    let hit = false;
    const zIn = p.z, x0 = hcell(p.x - r, HX0), x1 = hcell(p.x + r, HX0), y0 = hcell(p.y - r, HY0), y1 = hcell(p.y + r, HY0);
    stamp++;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = cy * HN + cx;
      for (let e = start[c], end = start[c + 1]; e < end; e++) {
        const k = items[e]; if (stampOf[k] === stamp) continue; stampOf[k] = stamp;
        if (OFF[k]) continue;
        if (CYL[k] ? pushCyl(p, k, r) : pushBox(p, k, r)) hit = true;
      }
    }
    const floor = heightAt(p.x, p.y) + r;
    fought = p.z < zIn - .001 && p.z < floor - .001;                    // a solid pressed it down below the ground
    if (p.z < floor) { p.z = floor; hit = true; }
    return hit;
  }

  // The highest top of any solid over a point, at or under `most`: what a walker can stand on.
  function solidTop(x, y, most) {
    let top = -Infinity;
    const c = hcell(y, HY0) * HN + hcell(x, HX0);
    for (let e = start[c], end = start[c + 1]; e < end; e++) {
      const k = items[e], o = k * SN, z1 = F[o + 3];
      if (OFF[k] || z1 > most || z1 <= top) continue;
      const dx = x - F[o], dy = y - F[o + 1];
      if (CYL[k] ? dx * dx + dy * dy <= F[o + 4] * F[o + 4] : Math.abs(dx * F[o + 6] + dy * F[o + 7]) <= F[o + 4] && Math.abs(-dx * F[o + 7] + dy * F[o + 6]) <= F[o + 5]) top = z1;
    }
    return top;
  }
  let lampsNow = 0, lampsTo = 0;
  function setLampsLit(v) { lampsTo = v; }

  const w4 = [0, 0, 0, 0], w7 = [0, 0, 0, 0, 0, 0, 0];
  function regionAt(x, y) {
    biomeWeights(x, y, w4);
    let c = 0, i = 0, r = 0;
    if (biome2Bytes) {
      const ix = Math.max(0, Math.min(bc - 1, Math.round((x - ox) / (2 * BS * cell)))), iy = Math.max(0, Math.min(bc - 1, Math.round((y - oy) / (2 * BS * cell)))), o = (iy * bc + ix) * 4;
      c = biome2Bytes[o] / 255; i = biome2Bytes[o + 1] / 255; r = biome2Bytes[o + 2] / 255;
    }
    const k = Math.max(0, 1 - c - i - r);
    for (let n = 0; n < 4; n++) w7[n] = w4[n] * k;
    w7[4] = c; w7[5] = i; w7[6] = r;
    return w7;
  }
  function update(dt, camera, focus) {
    cityPlan.update(scene, camera.position, phone);
    camera.updateMatrixWorld();
    updateTerrain(camera);
    updateInstances(camera);
    const cp = camera.position;
    stepPacks(cp, focus);
    look.setRegion(regionAt(cp.x, -cp.z));
    lampsNow += (lampsTo - lampsNow) * (1 - Math.exp(-dt * 1.6));
    U.ocLamps.value = lampsNow;
    if (Math.abs(gateNow - gateTo) > .0005) { gateNow += Math.sign(gateTo - gateNow) * Math.min(dt / 3.2, Math.abs(gateTo - gateNow)); placeGate(); }
    if (focus) terrainU.uFocus.value.set(focus.x, focus.y, focus.z, 2.4);
    if (focus) wetMap.update(dt, focus.x, focus.z);
    if (nearGrass) {
      camera.getWorldDirection(dirNow);
      const gy = heightAt(cp.x, -cp.z), on = cp.y > -1 && gy > -1.5 && cp.y - gy < 24;
      nearGrass.mesh.visible = on;
      if (on) { const l = Math.hypot(dirNow.x, dirNow.z) + 1e-3; nearAhead.set(cp.x + dirNow.x / l * nearGrass.box * .72, cp.z + dirNow.z / l * nearGrass.box * .72); }
    }
    if (bubbles || fallSpray) { renderer.getDrawingBufferSize(pxSize); if (bubbles) bubbles.material.uniforms.uPix.value = pxSize.y * .9; if (fallSpray) fallSpray.material.uniforms.uPix.value = pxSize.y * .9; }
  }

  // One update so the first frame has something to draw.
  camera.updateMatrixWorld();
  prog(1);

  // the placements as floats, read by index from here on: as plain arrays they held 3 MB of boxed numbers (a heap snapshot, 2 Nov)
  for (const k in data.instances) data.instances[k] = Float32Array.from(data.instances[k]);
  return {
    mirror, cityMeshes, data, heightAt, regionAt, biomeAt, cities: cityPlan, cliffs: cliffPlan, rivers: riverPlan, waterAt: riverPlan ? riverPlan.waterAt : () => null, wet: wetMap, biomeWeights, collide, sweep, solidTop, update, setLampsLit, setGateOpen, terrain, batches, creatures,
    lava, glbs: { props: propsGLB, creatures: creaturesGLB }, lifts: cityPlan.cities.filter((c) => c.lift).map((c) => c.lift),
    tris: () => {
      const t = (m) => m.visible ? m.count * (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 : 0;
      const out = []; let sum = 0;
      for (const b of batches) { const n = t(b.mesh) + (b.far ? t(b.far.mesh) : 0) + (b.cards ? t(b.cards.mesh) : 0); sum += n; if (n) out.push([b.name, Math.round(n), b.mesh.count, b.far ? b.far.mesh.count : 0]); }
      out.sort((a, b) => b[1] - a[1]);
      return { instancedTris: Math.round(sum), terrainTris: picked * GRID * GRID * 2, top: out.slice(0, 7) };
    },
    get packsDone() { return !packList.length && !packBusy && !arrivals.length; },
    stats: () => ({ patches: picked, instances: batches.reduce((s, b) => s + b.mesh.count + (b.far ? b.far.mesh.count : 0), 0), kinds: batches.filter(b => b.mesh.visible).length }),
  };
}
