// The game's start and its loop: a fixed 60 Hz step for the rules, one draw a frame.
import { createCityLights } from './reefcity.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { TITLE, FLAG, W, TOUCH, detectTier, pixelRatioFor } from './config.js';
import { createLook } from './look.js';
import { createWorld } from './world.js';
import { createLife } from './life.js';
import { createSky } from './sky.js';
import { findBreaks } from './surf.js';
import { createHero } from './hero.js';
import { createFx } from './fx.js';
import { createEnemies } from './enemies.js';
import { createScorch } from './scorch.js';
import { createFireLight } from './firelight.js';
import { createBirds } from './birds.js';
import { createBoss } from './boss.js';
import { createQuest } from './quest.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { createBot } from './bot.js';
import { clock, advance, alpha as blendOf } from './formulas/step.js';

const STEP = 1 / 60;
const G = window.__game = { time: 0, hitstop: 0, paused: false, started: false, playing: false, film: FLAG.film, tier: detectTier(), camYaw: 0, camPitch: 0, stats: { frames: 0 } };

async function boot() {
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.25, 900);
  Object.assign(G, { renderer, scene, camera, audio: createAudio() });
  G.ui = createUI(G);

  const look = G.look = createLook({ renderer, scene, camera, tier: G.tier });
  function fit() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(pixelRatioFor(G.tier, w, h)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix(); look.resize && look.resize(w, h);
  }
  addEventListener('resize', fit); fit();

  G.ui.setLoad(0.1, 'Filling the sea');
  G.world = await createWorld({ renderer, scene, camera, look, tier: G.tier, onProgress: (f) => G.ui.setLoad(0.1 + f * 0.45, 'Raising the drowned city') });

  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const pick = async (url, had) => { const out = {}; try { const g = had || await loader.loadAsync(url); g.scene.updateMatrixWorld(true); g.scene.traverse((o) => { if (o.isMesh) { const m = o.material; if (m && !m.__patched && url.includes('props')) { look.patch(m, {}); m.__patched = true; } out[/^mesh_\d+/.test(o.name) && o.parent ? o.parent.name : o.name] = o; } }); } catch (e) { console.warn(url, e); } return out; };
  G.props = await pick('assets/props.glb', G.world.glbs && G.world.glbs.props); G.creatures = await pick('assets/creatures.glb', G.world.glbs && G.world.glbs.creatures); G.world.glbs = null;     // the meshes are out of them, and a parser keeps the whole file it read
  G.ui.setLoad(0.65, 'Waking the Warden');

  G.sky = createSky({ scene, look, tier: G.tier });
  // the surf: breaks found on the world's own beaches, drawn by the sea and ridden by the hero from the same formula (surf.js)
  G.sky.setBreakers(findBreaks(G.world.data, G.world.heightAt), G.world.heightAt);
  G.life = createLife({ scene, look, world: G.world, tier: G.tier, camera });
  G.fx = createFx(G);
  if (look.onCross) look.onCross((dir, speed, strength) => { G.audio.setUnder(dir === 'down'); if (strength > 0.25) G.audio.splash(); });
  await createHero(G);
  G.ui.setLoad(0.85, 'Calling the Reavers');
  G.enemies = await createEnemies(G);
  G.dmg = createScorch(G); G.fireLight = createFireLight(G, G.dmg.grid, G.dmg.touch); G.birds = createBirds(G);
  createBoss(G);
  G.quest = createQuest(G);
  if (FLAG.demo) G.bot = createBot(G);
  // every program the game can ask for is built now, the pooled and hidden ones too, so a first shark can't stall a frame
  const hidden = []; scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  await look.precompile(); for (const o of hidden) o.visible = false; G.fx.prewarm();
  if (G.world.wet && G.world.wet.prewarm) G.world.wet.prewarm();
  // a linked program still stalls at its first real draw, in the GPU process, where the page's clock can't see it (pace, 1 Nov: 253 ms at 9 s of play, no stage of the game).
  // So one frame draws everything once now, in the same task as the frame that replaces it, behind the loading screen.
  { const back = []; scene.traverse((o) => { if (!o.isMesh && !o.isPoints && !o.isLine && !o.isGroup) return; back.push([o, o.visible, o.frustumCulled, o.count]); o.visible = true; o.frustumCulled = false; if (o.isInstancedMesh && !o.count) o.count = 1; });
    look.render(); for (const [o, v, f, c] of back) { o.visible = v; o.frustumCulled = f; if (o.isInstancedMesh) o.count = c; } }

  const sp = G.world.data.spawn, h = G.hero;
  h.pos.copy(W(sp.x, sp.y, sp.z)); h.heading = G.camYaw = sp.yaw || 0;
  camera.position.copy(h.pos).add(new THREE.Vector3(-Math.sin(G.camYaw) * 5, 1.4, -Math.cos(G.camYaw) * 5));
  if (FLAG.qa) { try { await import('./qa.js').then((m) => m.install(G)); } catch (e) { console.warn('no qa', e); } }

  document.addEventListener('visibilitychange', () => { if (document.hidden && G.started) G.ui.setPause(true); });
  G.ui.setLoad(1, 'Ready');
  G.ui.ready(() => { G.started = true; G.playing = true; });
  if (FLAG.demo || FLAG.film) { document.getElementById('title').classList.remove('on'); document.getElementById('hud').classList.add('on'); G.started = true; G.playing = true; }

  G.frame = frame;
  let last = performance.now(), booted = false;
  function tick(now) {
    requestAnimationFrame(tick);
    // after a long task a frame's own timestamp can fall before the clock read just before it, so the step has a floor as well as a ceiling
    try { if (!FLAG.film) { const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; frame(dt); } }
    finally { if (!booted) { booted = true; if (window.__MOSA_BOOT) window.__MOSA_BOOT.ok = true; G.booted = true; } }
  }
  requestAnimationFrame(tick);
}

const C = clock(STEP, 5);
function step(dt) {
  G.time += dt;
  let scale = 1; if (G.hitstop > 0) { G.hitstop -= dt; scale = 0.1; }
  if (G.slowT > 0) { G.slowT -= dt; scale = Math.min(scale, G.slowK || 0.28); }
  const d = dt * scale;
  G.hero.prev.copy(G.hero.pos); G.enemies.keep();
  if (G.bot) { const u = G.ui.input; const s = G.ui.sample; G.ui.sample = () => { const v = s(); G.bot.drive(v, dt); return v; }; G.hero.step(d); G.ui.sample = s; } else G.hero.step(d);
  G.enemies.step(d); G.boss.step(d); G.quest.step(dt); G.turf.step(dt);
}

// One part of the world throwing must not leave the player looking at a stopped picture: the frame still draws. The error isn't caught, so it's still reported.
function frame(dt) {
  if (G.paused) { G.look.render(); return; }
  try { update(dt); } finally { G.look.render(); G.stats.frames++; }
}
function update(dt) {
  const { hero, camera, look } = G;
  if (G.started) {
    advance(C, dt, step);
  } else {
    G.time += dt; G.camYaw += dt * 0.03;     // the title: the camera drifts round him
  }
  // the rules tick at 60 Hz, the screen at whatever it likes: every moving thing is drawn between its last two steps
  const alpha = G.started ? blendOf(C) : 1;
  hero.drawPos.lerpVectors(hero.prev, hero.pos, alpha); G.enemies.blend(alpha);
  hero.animate(dt); G.enemies.animate(dt); G.boss.draw();
  if (G.filmCam) G.filmCam(dt); else if (!(G.quest.cineOn && G.quest.cineOn())) hero.camera(dt);
  G.quest.draw(G.time);
  look.update(dt, camera.position); G.world.update(dt, camera, hero.pos); G.dmg.update(dt, hero.pos.x, hero.pos.z); G.life.update(dt, hero.pos); G.sky.update(dt, camera); (G.cityLights ||= createCityLights(G, G.world.cities.cities, G.world.heightAt)).frame(); if (G.world.lava) G.world.lava.frame(G, dt); G.fx.update(dt, G.time); G.fx.speed(hero.surge, hero.vel, dt);
  G.birds.step(dt, camera.position); G.fireLight.update(dt, camera.position);
  { const c = camera.position, d = Math.hypot(c.x - 300, c.z - 800), s = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); }; G.look.camY = c.y; G.look.setBiome((1 - s(190, 450, d)) * (1 - s(60, 90, c.y))); if ((G.leafT = (G.leafT || 0) - dt) <= 0) { G.leafT = 0.5; const w = c.y > 0 && c.y < 60 ? Math.min(1, G.dmg.treesNear(c.x, c.z) / 4) : 0; G.look.uniforms.ocLeaves.value += (w - G.look.uniforms.ocLeaves.value) * 0.5; } } if (!/nomirror/.test(location.search)) G.world.mirror.render(camera, G.sky.above, [G.flames && G.flames.mesh]);
  G.audio.update(dt, Math.min(1, hero.speed / 16), hero.combatT < 3);
  if (G.audio.freshwater && G.world.rivers) freshSound(hero.pos);
  G.ui.update(dt);
}

// the fresh water's sound (audio.freshwater): a fall's roar from how near its foot is, a stream's chatter from how near its course is (more where it runs white).
// Read four times a second: the river's samples are a few hundred.
let freshT = 0, roar = 0, babble = 0;
function freshSound(p) {
  if ((freshT -= 1 / 60) <= 0) {
    freshT = 0.25; const x = p.x, y = -p.z, P = G.world.rivers; roar = 0; babble = 0;
    const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (const pl of P.pools) roar = Math.max(roar, 1 - sm(8, 75, Math.hypot(x - pl.ft.x, y - pl.ft.y, (p.y - pl.W) * 0.5)));
    for (const rv of P.rivers) for (let i = 0; i <= rv.N; i += 2) { const d = Math.hypot(x - rv.X[i], y - rv.Y[i]); if (d < 32) babble = Math.max(babble, (1 - sm(3, 30, d)) * (0.45 + 0.55 * rv.TURB[i])); }
    if (p.y < -0.5) { roar *= 0.3; babble *= 0.2; }                  // under the sea, the land's water is far away
  }
  G.audio.freshwater(babble, roar);
}

boot().catch((e) => { console.error(e); const s = document.querySelector('#load small'); if (s) s.textContent = 'Something broke: ' + e.message; });
