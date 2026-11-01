// Does hero.glb (or reaver.glb) really work in three.js? A bare page, served only inside this run (it never writes a file under web/):
// loads the glb the way the game will, plays every clip, reads _mask, the bones, the point of the weapon, the textures, and takes a picture.
//   node check_three.mjs [hero|reaver] [clip for the picture] [frame seconds]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire('/Users/randy/Documents/package.json');
const pw = require('playwright');
const [name = 'hero', shotClip = 'idle_combat', shotT = '0.4', view = ''] = process.argv.slice(2);
const PHONE = view.startsWith('phone'), TILT = view.includes('tilt');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const HTML = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#0a3a4a}canvas{display:block}</style>
<script type="importmap">{ "imports": { "three": "./vendor/three/build/three.module.min.js", "three/addons/": "./vendor/three/examples/jsm/" } }</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const out = { errors: [] };
try {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(${PHONE ? 2 : 1}); r.setSize(${PHONE ? 390 : 560}, ${PHONE ? 844 : 760}); document.body.appendChild(r.domElement);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0d4a5c);
  sc.add(new THREE.HemisphereLight(0xcfeeff, 0x0a2a33, 1.3));
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.2); sun.position.set(2, 4, 3); sc.add(sun);
  const rim = new THREE.DirectionalLight(0x7fe4ff, 2.0); rim.position.set(-3, 2, -3); sc.add(rim);
  const cam = new THREE.PerspectiveCamera(${PHONE ? 52 : 32}, ${PHONE ? '390 / 844' : '560 / 760'}, 0.1, 50); ${PHONE ? (TILT ? 'cam.position.set(1.0, 2.6, -3.6); cam.lookAt(0, 0.6, 0.6);' : 'cam.position.set(1.0, 1.9, -4.2); cam.lookAt(0, 1.0, 0);') : 'cam.position.set(1.9, 1.5, 5.4); cam.lookAt(0, 1.05, 0);'}
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const t0 = performance.now();
  const gltf = await loader.loadAsync('assets/${name}.glb?' + Date.now());
  out.loadMs = Math.round(performance.now() - t0);
  const root = gltf.scene; sc.add(root);
  let skinned = null, meshes = 0;
  root.traverse(o => { if (o.isMesh) { meshes++; if (o.isSkinnedMesh) skinned = o; o.frustumCulled = false; } });
  out.meshes = meshes;
  const g = skinned.geometry, m = skinned.material;
  out.attributes = Object.fromEntries(Object.entries(g.attributes).map(([k, a]) => [k, [a.itemSize, a.array.constructor.name, a.normalized, a.count]]));
  out.tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
  const mask = g.attributes._mask;
  if (mask) { const n = mask.count, c = [0, 0, 0, 0], mx = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) { const v = [mask.getX(i), mask.getY(i), mask.getZ(i), mask.getW(i)]; v.forEach((x, k) => { if (x > 0.02) c[k]++; mx[k] = Math.max(mx[k], x); }); }
    out.mask = { above: c, max: mx.map(x => +x.toFixed(3)) }; }
  out.material = { type: m.type, name: m.name, vertexColors: m.vertexColors, side: m.side, metalness: m.metalness, roughness: m.roughness, emissive: m.emissive.getHexString(), emissiveIntensity: m.emissiveIntensity,
    maps: Object.fromEntries(['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'emissiveMap'].map(k => [k, m[k] ? [m[k].image.width, m[k].image.height, m[k].colorSpace] : null])) };
  out.bones = skinned.skeleton.bones.map(b => b.name);
  const tip = root.getObjectByName('weapon_tip'), wp = root.getObjectByName('weapon');
  out.tipLocal = tip ? tip.position.toArray().map(x => +x.toFixed(4)) : null;
  out.clips = {};
  const mix = new THREE.AnimationMixer(root); const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (const c of gltf.animations) {
    mix.stopAllAction(); const a = mix.clipAction(c); a.reset().play();
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], tipMax = 0;
    for (let i = 0; i <= 12; i++) { mix.setTime(c.duration * i / 12); root.updateMatrixWorld(true); r.render(sc, cam);
      if (tip) { tip.getWorldPosition(v); wp.getWorldPosition(w); tipMax = Math.max(tipMax, v.distanceTo(w)); v.toArray().forEach((x, k) => { mn[k] = Math.min(mn[k], x); mx[k] = Math.max(mx[k], x); }); } }
    out.clips[c.name] = { dur: +c.duration.toFixed(3), tracks: c.tracks.length, tipFromGrip: +tipMax.toFixed(3) };
    a.stop();
  }
  const c = gltf.animations.find(c => c.name === '${shotClip}') || gltf.animations[0];
  mix.stopAllAction(); mix.clipAction(c).reset().play(); mix.setTime(${+shotT}); ${TILT ? 'root.position.set(0, 0.75, -0.7); root.rotation.x = 80 * Math.PI / 180;' : ''} root.updateMatrixWorld(true); r.render(sc, cam);
  out.calls = r.info.render.calls; out.renderTris = r.info.render.triangles; out.textures = r.info.memory.textures; out.geometries = r.info.memory.geometries;
  out.glErrors = r.getContext().getError();
} catch (e) { out.errors.push(String(e.stack || e)); }
window.__out = out;
</script>`;
const browser = await pw.chromium.launch({ headless: true, channel: 'chromium' }).catch(() => pw.chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: PHONE ? { width: 390, height: 844 } : { width: 560, height: 760 }, deviceScaleFactor: PHONE ? 2 : 1 });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.route('**/__hero_check.html', r => r.fulfill({ contentType: 'text/html', body: HTML }));
await page.goto('http://127.0.0.1:8791/__hero_check.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.__out, null, { timeout: 90000 });
const out = await page.evaluate(() => window.__out);
const shot = path.join(HERE, 'preview', `three_${name}_${shotClip}${view ? '_' + view : ''}.png`);
await page.screenshot({ path: shot });
await browser.close();
console.log(JSON.stringify({ ...out, pageErrors: errs, shot }, null, 0));
