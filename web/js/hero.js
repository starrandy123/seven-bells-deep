// The Warden: where he goes. Swimming, running, leaping, the surface, the shore, the whale, the camera. Gameplay is in three.js coordinates; world.js speaks Blender's.
// body.js draws him from what's decided here; combat.js decides his blows.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { FLAG, W, TOUCH } from './config.js';
import { createCombat } from './combat.js';
import { createBody } from './body.js';
import { createWake } from './wake.js';
import { second, follower, chase, first, nearAngle } from './formulas/follow.js';
import { fromApex, speedFor, moved } from './formulas/jump.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (cur, tgt, k, dt) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const CRUISE = 7.5, BOOST = 15.5, SUPER = 48, LAND_RUN = 5.9, LAND_SPRINT = 8.7, LAND_SUPER = 36, STAND = 0.92, SWIM_Y = -0.55;     // SWIM_Y: where he floats, head out, and the depth at which his feet leave the bottom
// The jump, in the numbers a designer chooses (DESIGN.md §Movement): height and time; gravity and speed follow. One gravity for every jump, so the air always feels the same.
const LAND_SURF_IN = 0.35, LAND_SURF_TOP = 19, LAND_SURF_CRUISE = 14, SLOPE_PULL = 0.62;      // Randy, 1 Nov: Boost on land rides the water: a held sprint this long rolls into it; its top and cruise; how much of gravity along the slope he feels
const SURF_RIDE = 14, SURF_TOP = 26, SURF_OFF = 6, SURF_STORM = 20, SWELL_STORM = 1.7, SURF_TURN = 2.2, SURF_SWELL = 0.75, SURF_START = 9, SURF_SHALLOW = -1.0;      // the surf: speeds, how fast the stick carves, the swell's height, what it takes to get up on one
const TIDE_TIERS = [0, 15.5, 20, 25], TIDE_WINDOW = 0.14, TIDE_HOLD = 1.8;      // Tidepulse: the speed of each tier (the first is BOOST), how far from a kick a press still counts, how long a tier lasts unrenewed
const EDGE_ZONE = 46, EDGE_BACK = 9, EDGE_PUSH = 44;        // the sea at the map's edge: metres over which it acts, the band where it shoves back, its grip on him
const J = fromApex(2.4, 0.4), V_DOUBLE = speedFor(2.0, J.g), V_LEAP = speedFor(8.5, J.g), JUMP_PREP = 0.067, COYOTE = 0.12, BUFFER = 0.15, CUT = 2.8;
// the dolphin leap: its own gravity, for 1.5-3 s in the air; how high over the sea for the speed he hits the surface at (swimming, boosted, at super speed); the most he carries forward; what counts as coming up
const BREACH_G = 15, BREACH_H = [6.4, 11.6, 19.6], BREACH_S = [7.5, 15.5, 38], BREACH_FLAT = 26, BREACH_ARC = 6, BREACH_UP = 1.5, BREACH_MIN = 3.5;
// a tap of Jump in the water: how hard he drives up, how near the surface it takes him all the way out, how long a deep tap's kick lasts. Chaining: a dip this long under the water, and a tap this soon after going in still counts
const DRIVE_V = 13, DRIVE_NEAR = 4, DRIVE_DEEP = 0.5, PORPOISE_T = 0.42, CHAIN_LATE = 0.45;
// the shot of a leap: how far off to the side, plus this much per metre of the leap; how many radians round from straight ahead of him; how high over the water; how far up the frame he may sit; the field
const SHOT_FAR = 5.5, SHOT_RISE = 0.4, SHOT_AWAY = 1.9, SHOT_LOW = 1.1, SHOT_HIGH = 0.33, SHOT_FOV = 50;
const ARM_HOLD = 3;       // s after the last blow that the trident stays in his hand
const WEDGE = 0.31;      // m, his body's half width (A1)
// Randy, 1 Nov: "I can't sprint or climb uphill". Measured: at 40° he stood frozen, and 16% of the islands' land is 36° or steeper. Open-world standard: he walks up
// to 50°, slowing; scrambles up to 68°, slower still; only a real cliff stops him
const TAN_CLIMB = Math.tan((50 * Math.PI) / 180), TAN_WALL = Math.tan((68 * Math.PI) / 180), STEP_UP = 0.52, SLOPE_READ = 0.6, SKIN = 0.02;       // A7: the steepest ground he walks up, and the highest top he stands on without a jump: his sphere (0.42, centred 0.92 up) clears anything under 0.50

// what each thing he can wear does to him: the suit's tint, the bronze's. And each form of the trident: its tint, and how much it glows. Ids from web/data/gear.json
const OUTFITS = { warden: [[1, 1, 1], [1, 1, 1]], gilded: [[1.12, 0.96, 0.62], [1.4, 1.12, 0.6]], ember: [[0.78, 0.36, 0.3], [0.72, 0.5, 0.42]], keeper: [[0.62, 0.76, 0.86], [0.86, 0.92, 1.04]] };
const LEVEL_CRUISE = [0, 1.125, 1.125, 1.125], LEVEL_BOOST = [0, 0, 1.86, 1.86], LEVEL_HOLD = [0.75, 0.75, 0.75, 0.45];      // what each level of Speed adds to cruise and boost, m/s, and how long boost is held before super speed, s
const FORMS = { tide_fork: [[1, 1, 1], 0], kelp_tine: [[0.62, 1.04, 0.7], 0.16], rime_fork: [[0.76, 0.96, 1.24], 0.42], forge_fork: [[1.24, 0.6, 0.34], 0.62], old_fork: [[0.86, 0.8, 0.7], 0] };

export const FALLBACK_MOVES = {
  atk1: { dur: 0.7, hit: [0.22, 0.36], reach: 3.1, arc_deg: 70, lunge: 2.2, cancel: 0.42 },
  atk2: { dur: 0.8, hit: [0.26, 0.42], reach: 3.3, arc_deg: 150, lunge: 1.8, cancel: 0.5 },
  atk3: { dur: 1.1, hit: [0.5, 0.66], reach: 3.8, arc_deg: 200, lunge: 2.6, cancel: 0.82 },
  atk_dash: { dur: 0.75, hit: [0.1, 0.5], reach: 3.2, arc_deg: 100, lunge: 12, cancel: 0.6 },
  atk_spin: { dur: 1.0, hit: [0.15, 0.7], reach: 6.4, arc_deg: 360, lunge: 0, cancel: 0.8 },
  cast_wave: { dur: 0.9, hit: [0.34, 0.4], reach: 0, arc_deg: 0, lunge: 0, cancel: 0.7 },
  parry: { dur: 0.55, hit: null, reach: 0, arc_deg: 0, lunge: 0, cancel: 0.4 },
  hit_front: { dur: 0.5, hit: null }, hit_back: { dur: 0.5, hit: null }, death: { dur: 2.5, hit: null }, victory: { dur: 3, hit: null }, leap: { dur: 1.2, hit: null }, pick_up: { dur: 0.6, hit: null },
};

function patchHero(mat, G) {
  // the Warden's own surface on top of the ocean's: the suit's scale pattern, bronze, and the glowing lines
  G.look.patch(mat, { skinned: true });
  const inner = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    if (inner) inner(s, r);
    s.uniforms.uGlow = G.heroGlow; s.uniforms.uGlowCol = G.heroGlowCol; s.uniforms.uScales = G.heroScales; s.uniforms.uSuit = G.heroSuit; s.uniforms.uMetal = G.heroMetal; s.uniforms.uForm = G.heroForm; s.uniforms.uFormGlow = G.heroFormGlow; s.uniforms.uWeaponBone = G.heroWeaponBone; s.uniforms.uCapeBones = G.heroCapeBones;
    s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 _mask; uniform float uWeaponBone; uniform vec2 uCapeBones; varying vec4 vMask; varying vec3 vRest; varying float vForm, vCloth;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      vMask = _mask; vRest = position; vForm = dot(vec4(lessThan(abs(skinIndex - uWeaponBone), vec4(0.5))), skinWeight); vCloth = dot(step(vec4(uCapeBones.x - 0.5), skinIndex) * step(skinIndex, vec4(uCapeBones.y + 0.5)), skinWeight);`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uGlow, uScales, uFormGlow; uniform vec3 uGlowCol, uSuit, uMetal, uForm; varying vec4 vMask; varying vec3 vRest; varying float vForm, vCloth;
      float heroScales(vec2 p) { vec2 q = vec2(p.x + 0.5 * floor(p.y), fract(p.y)); vec2 f = fract(q) - 0.5; return length(f * vec2(1.0, 1.4)); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.4, vMask.b);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      metalnessFactor = max(metalnessFactor, vMask.b * 0.9);`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= mix(mix(mix(vec3(1.0), uSuit, max(vMask.r, vCloth)), uMetal, vMask.b), uForm, vForm);
      if (vMask.r * uScales > 0.02) { float d = heroScales(vec2(atan(vRest.x, vRest.z) * 9.0, vRest.y * 26.0));
        diffuseColor.rgb *= mix(1.0, 0.62 + 0.75 * smoothstep(0.5, 0.2, d), vMask.r * uScales); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      // the tattoos are baked cyan in the emissive map: take their strength from it and their colour from the stance, so skin and bronze glow alike
      totalEmissiveRadiance = uGlowCol * (max(totalEmissiveRadiance.g, totalEmissiveRadiance.b) * 1.05 + vMask.g * uGlow) + uForm * vForm * uFormGlow;`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.customProgramCacheKey = () => key + '|warden';
}

export async function createHero(G) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  G.heroGlow = { value: 1.2 }; G.heroGlowCol = { value: new THREE.Color(0.18, 0.86, 1.0) }; G.heroScales = { value: 1 }; G.heroSuit = { value: new THREE.Color(1, 1, 1) }; G.heroMetal = { value: new THREE.Color(1, 1, 1) }; G.heroForm = { value: new THREE.Color(1, 1, 1) }; G.heroFormGlow = { value: 0 }; G.heroWeaponBone = { value: -9 }; G.heroCapeBones = { value: new THREE.Vector2(-9, -9) };
  const root = new THREE.Group(); G.scene.add(root);
  let moves = FALLBACK_MOVES, model = null, clips = [], inked = null;
  const bones = {};
  try {
    const r = await fetch('assets/moves.json'); if (r.ok) moves = { ...FALLBACK_MOVES, ...(await r.json()) };
    const gltf = await loader.loadAsync(G.tier === 'phone' ? 'assets/hero_phone.glb' : 'assets/hero.glb');      // the phone's has its textures at half size: about 16 MB less in memory
    model = gltf.scene; root.add(model); clips = gltf.animations;
    model.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        o.frustumCulled = false; o.castShadow = false;
        const m = o.material; if (o.geometry.attributes._mask) patchHero(m, G); else G.look.patch(m, { skinned: true });
        m.needsUpdate = true; if (o.isSkinnedMesh) inked = o;
      }
    });
    if (inked) { const list = inked.skeleton.bones.map((b, i) => (/^cape_/.test(b.name) ? i : -1)).filter((i) => i >= 0); G.heroWeaponBone.value = inked.skeleton.bones.findIndex((b) => b.name === 'weapon'); if (list.length) G.heroCapeBones.value.set(Math.min(...list), Math.max(...list)); }
    if (inked) G.look.addOutline?.(inked);          // the Painted look's line round him: it shows only in that look
  } catch (e) {
    console.warn('hero.glb not here yet', e);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: 0x0c5c66, roughness: 0.4 }));
    body.position.y = 0.9; G.look.patch(body.material, {}); root.add(body); model = body;
  }

  const h = {
    root, pos: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, pitchT: 0, tilt: 0, bank: 0, speed: 0,
    hp: 100, maxHp: 100, tide: 60, maxTide: 100, inv: 0, cool: { dash: 0, spin: 0, wave: 0, call: 0 }, powers: { dash: false, spin: false, wave: false, call: false }, ride: null, rideT: 0, surge: 0, boostHeld: 0, land: false, grounded: false, drawPos: new THREE.Vector3(), prev: new THREE.Vector3(),
    state: 'swim', atk: null, next: null, air: false, boostFuel: 1, combatT: 99, target: null, stun: 0, dead: false, parryT: 0, locked: false, moves,
    drawYaw: 0, bodyPitch: 0, jumps: 0, coyote: 0, jumpBuf: 0, jumpPrep: 0, jumpHold: false, apexY: 0, pivot: 0, spd: 0, omega: 0, accel: 0,
  };
  h.gravity = J.g; h.standLine = SWIM_Y - STAND - 0.1;
  G.hero = h;

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3(), tmpRide = new THREE.Vector3();
  const tipW = new THREE.Vector3(), midW = new THREE.Vector3();
  let stepSfx = 0;

  const whalePos = (w) => w.position || w.pos, whaleDir = (w) => w.forward || w.dir;
  // the root of a whale's fin: what his hands close on
  h.finAt = (w, out) => { const f = whaleDir(w), L = w.length || 25; out.copy(whalePos(w)).addScaledVector(f, L * 0.04); out.y += 2.9 + L * 0.03; return out; };
  // the ground: the terrain, and timber decks where he's up at their level (a swimmer goes under a pier, never up through it)
  const decks = (G.world.data.decks || []).map((d) => ({ ...d, c: Math.cos(d.yaw || 0), s: Math.sin(d.yaw || 0) }));
  const deckTop = (x, z) => {
    const y = -z;
    for (let i = 0; i < decks.length; i++) { const d = decks[i], dx = x - d.x, dy = y - d.y; if (Math.abs(dx * d.c + dy * d.s) <= d.hx && Math.abs(-dx * d.s + dy * d.c) <= d.hy) return d.z; }
    return -Infinity;
  };
  // solids he can stand on: anything whose top he's at or near. A low one is a step; a high one he has to jump to
  const solidTop = (x, z, most) => G.world.solidTop(x, -z, most);
  const terrain = (x, z) => Math.max(G.world.heightAt(x, -z), G.icePath ? G.icePath.heightAt(x, z) : -Infinity);
  const groundAt = h.groundAt = (x, z) => {
    const feet = h.pos.y - STAND, t = decks.length ? deckTop(x, z) : -Infinity; let g = terrain(x, z);
    if (t > g && t <= feet + 0.7) g = t;
    const s = solidTop(x, z, feet + STEP_UP); return s > g ? s : g;
  };
  // ------------------------------------------------------------------ waterfalls he swims up (Randy, 1 Nov: "I need to also be able to swim up waterfalls")
  // Each fall is a column of water down its rock: the sheet walks out from the lip until it's clear of the ground at that height, exactly as world.js draws it, so the
  // water he swims in is the water he sees. Rows every metre down, each with the sheet's centre (game coordinates) and the way out from the rock.
  // The column runs on down into the fall's pool (rivers.js digs it; world.js pours the sheet on under its surface), so he can start up from in the water.
  const FALLS = (G.world.data.waterfalls || []).map((f) => {
    const bot = f.pool !== undefined ? Math.min(f.z1, f.pool - 0.25) : f.z1;
    const c = Math.cos(f.yaw || 0), sn = Math.sin(f.yaw || 0), H = f.z0 - bot, rows = Math.max(2, Math.ceil(H)); let o = 0; const row = [];
    for (let i = 0; i <= rows; i++) {
      const z = f.z0 - (H * i) / rows;
      for (; o < 60; o += 0.2) { const ly = -o; if (G.world.heightAt(f.x - ly * sn, f.y + ly * c) < z - 0.35) break; }
      const ly = -(o + 0.35); row.push({ y: z, x: f.x - ly * sn, z: -(f.y + ly * c), hw: f.hwAt ? f.hwAt(((f.z0 - z) / (f.z0 - f.z1))) : f.w * 0.5 });      // the sheet's own width at this height (world.js)
    }
    // out of the rock (game x, z): the sheet faces down its own local -y; along it: its local x
    return { f, row, hw: f.w * 0.5, out: { x: sn, z: c }, side: { x: c, z: -sn }, top: f.z0, bot };
  });
  // where a point sits on a fall: its height's row, how far across the sheet and how far out from it (standing in its pool counts: the foot of the column)
  function onFall(F, x, y, z) {
    if (y < F.bot - 1.8 || y > F.top + 0.4) return null;
    const t = clamp((F.top - y) / (F.top - F.bot), 0, 1) * (F.row.length - 1), i = Math.min(F.row.length - 2, Math.floor(t)), u = t - i, a = F.row[i], b = F.row[i + 1];
    const cx = a.x + (b.x - a.x) * u, cz = a.z + (b.z - a.z) * u, dx = x - cx, dz = z - cz;
    return { cx, cz, hw: a.hw + (b.hw - a.hw) * u, across: dx * F.side.x + dz * F.side.z, outward: dx * F.out.x + dz * F.out.z };
  }
  const CLIMB_V = 6.5, CLIMB_BOOST = 11, CLIMB_SIDE = 3.2, CLIMB_OUT = 0.55;      // m/s up the falls, boosted, across them; how far out from the sheet's centre he swims
  function fallNear() {
    for (const F of FALLS) { const q = onFall(F, h.pos.x, h.pos.y, h.pos.z); if (q && Math.abs(q.across) < q.hw + 0.4 && q.outward > -1.2 && q.outward < 2.4) return { F, q }; }
    return null;
  }
  // in: he's at the water and pushing into it (toward the rock or up), or comes down into it from a jump
  function tryClimb(u, wishX, wishZ) {
    if (!FALLS.length || h.climb || h.state !== 'swim' || h.surf || h.ride) return false;
    const n = fallNear(); if (!n) return false;
    const into = -(wishX * n.F.out.x + wishZ * n.F.out.z);
    if (!(into > 0.35 || (h.air && h.vel.y < 0) || (u.ud > 0.5))) return false;
    h.climb = n.F; h.air = false; h.land = false; h.grounded = false; h.breach = null; h.jumps = 0; h.vel.set(0, 0, 0); h.porpoise = null; h.driveT = 0;
    G.fx.bubbles(h.pos.clone(), 14, 0.8); G.audio.splash(); if (G.quest) G.quest.note('falls');
    return true;
  }
  function stepClimb(u, dt, boosting) {
    const F = h.climb, q = onFall(F, h.pos.x, h.pos.y, h.pos.z);
    if (!q || Math.abs(q.across) > q.hw + 0.8) { h.climb = null; leave(0); return; }
    // the stick: forward or up is up the water, back is down it, sideways runs across the sheet
    const up = clamp(u.my + Math.max(0, u.ud), -1, 1), side = clamp(u.mx, -1, 1), vUp = (boosting ? CLIMB_BOOST : CLIMB_V) * up;
    // across, measured against the camera: the sheet's own side, signed so stick-right goes to the screen's right
    const sr = (F.side.x * right.x + F.side.z * right.z) >= 0 ? 1 : -1, vSide = CLIMB_SIDE * side * sr;
    h.vel.y = damp(h.vel.y, vUp, 6, dt);
    const across = clamp(q.across + vSide * dt, -Math.max(0.2, q.hw - 0.3), Math.max(0.2, q.hw - 0.3)), outward = damp(q.outward, CLIMB_OUT, 8, dt);
    const ny = h.pos.y + h.vel.y * dt, q2 = onFall(F, h.pos.x, ny, h.pos.z) || q;
    h.pos.set(q2.cx + F.side.x * across + F.out.x * outward, ny, q2.cz + F.side.z * across + F.out.z * outward);
    // facing the rock, a breath of speed into it so the body points at the water, head up the fall
    h.vel.x = -F.out.x * 0.6 + F.side.x * vSide; h.vel.z = -F.out.z * 0.6 + F.side.z * vSide;
    h.heading = Math.atan2(-F.out.x, -F.out.z);
    if (Math.random() < dt * 6) G.fx.bubbles(h.pos.clone(), 2, 0.4);
    // over the top: up and over the lip into the water above it
    if (h.pos.y >= F.top - 0.1 && up > 0) { h.climb = null; leave(7.5); h.vel.x = -F.out.x * 4.5; h.vel.z = -F.out.z * 4.5; h.jumps = 1; splash(0.6); return; }
    // down to its foot: on his feet
    if (h.pos.y <= F.bot + STAND && up < 0) { h.climb = null; const g = groundAt(h.pos.x, h.pos.z); if (h.pos.y - g <= STAND + 0.6) { h.land = true; h.grounded = true; h.pos.y = g + STAND; h.spd = 0; } else leave(0); return; }
    // Jump lets go: a kick off the water, away from the rock
    if (h.jumpBuf > 0) { h.jumpBuf = 0; h.climb = null; leave(6); h.vel.x = F.out.x * 5; h.vel.z = F.out.z * 5; h.jumps = 1; }
  }
  // out of anything that moved into him. A solid never lifts a walker, unless it's straight under him (he has come down onto its top) or he was put right inside one: then he stands on it
  function settle() { const x = h.pos.x, y = h.pos.y, z = h.pos.z; if (!collide(0.42)) return; const up = h.pos.y - y; if (up < 0.6 && (up <= 0 || Math.hypot(h.pos.x - x, h.pos.z - z) > 0.002)) h.pos.y = y; }
  // collide and slide (Fauerby): he goes as far as he can, and what's left of the move runs along what he met. `flat` keeps him at his height: a walker is stopped by a wall, never lifted
  const sA = { x: 0, y: 0, z: 0 }, sB = { x: 0, y: 0, z: 0 };
  function slide(dx, dy, dz, r, flat) {
    const x0 = h.pos.x, y0 = h.pos.y, z0 = h.pos.z; let hitAny = false; if (!flat) collide(r);      // never starts inside something
    for (let i = 0; i < 3; i++) {
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) < 1e-6) break;
      sA.x = h.pos.x; sA.y = -h.pos.z; sA.z = h.pos.y; sB.x = h.pos.x + dx; sB.y = -(h.pos.z + dz); sB.z = h.pos.y + dy;
      const hit = G.world.sweep ? G.world.sweep(sA, sB, r) : null;
      if (!hit) { h.pos.x += dx; h.pos.y += dy; h.pos.z += dz; break; }
      hitAny = true; h.pos.x = hit.x; h.pos.z = -hit.y; if (!flat) h.pos.y = hit.z;
      let nx = hit.nx, ny = hit.nz, nz = -hit.ny; if (flat) { ny = 0; const l = Math.hypot(nx, nz); if (l < 1e-5) { if (h.pos.y - terrain(h.pos.x + dx, h.pos.z + dz) > r + 0.02) { h.vel.x = 0; h.vel.z = 0; break; } h.pos.x += dx * (1 - hit.t); h.pos.z += dz * (1 - hit.t); break; } nx /= l; nz /= l; }      // pushed straight up or down: that's the ground, which is no wall to a walker, or a solid at his chest, which is      // the ground under a walker isn't a wall: his height is the ground's business
      const left = 1 - hit.t; dx *= left; dy *= left; dz *= left;
      h.pos.x += nx * SKIN; h.pos.z += nz * SKIN; if (!flat) h.pos.y += ny * SKIN;       // off the surface by a hair: the next leg mustn't start out touching what it's sliding along
      const dn = dx * nx + dy * ny + dz * nz; if (dn < 0) { dx -= nx * dn; dy -= ny * dn; dz -= nz * dn; }
      const vn = h.vel.x * nx + h.vel.y * ny + h.vel.z * nz; if (vn < 0) { h.vel.x -= nx * vn; if (!flat) h.vel.y -= ny * vn; h.vel.z -= nz * vn; }
    }
    // a wedge: the sea floor rising under a rock's edge pushes him up as the rock pushes him down, the two cancel, and a sweep reads that as free. His centre never gets closer than WEDGE to anything: he goes back to where he was
    if (!flat) { sA.x = h.pos.x; sA.y = -h.pos.z; sA.z = h.pos.y; if (G.world.collide(sA, WEDGE)) { const deep = Math.hypot(sA.x - h.pos.x, sA.y + h.pos.z, sA.z - h.pos.y); sB.x = x0; sB.y = -z0; sB.z = y0; const was = G.world.collide(sB, WEDGE) ? Math.hypot(sB.x - x0, sB.y + z0, sB.z - y0) : 0; if (deep > was + 1e-4) { h.pos.set(x0, y0, z0); h.vel.multiplyScalar(0.2); return true; } } }
    return hitAny;
  }
  function collide(r) {
    const p = { x: h.pos.x, y: -h.pos.z, z: h.pos.y };
    if (G.world.collide(p, r)) { h.pos.set(p.x, p.z, -p.y); return true; }
    return false;
  }

  const body = h.body = bones.hips ? createBody(G, h, { root, model, bones, clips, STAND, moves }) : { draw() {}, play() { return false; }, clear() {}, inertia() {}, has: () => false, place() {} };
  const play = (name, fade) => body.play(name, fade), has = (n, alt) => (body.has(n) ? n : alt);
  const wake = h.wake = inked ? createWake(G, h, inked) : null;

  G.combat = createCombat(G, h, {
    moves,
    play(name, fade) { body.play(name, fade); },
    clear(fade = 0.18) { body.clear(fade); },
  });

  h.respawn = (p, yaw) => {
    h.surf = null; h.carve = 0; h.pos.copy(p); h.prev.copy(p); h.drawPos.copy(p); h.vel.set(0, 0, 0); h.hp = h.maxHp; h.tide = 60; h.dead = false; h.state = 'swim'; h.heading = yaw || 0; h.inv = 2; h.spd = 0;
    body.clear(0.2); body.place();
  };

  // what he wears and carries, by the ids in web/data/gear.json. An id we don't know leaves him as he is
  let speedLevel = 0; h.setSpeedLevel = (n) => { speedLevel = clamp(n | 0, 0, 3); };
  h.setOutfit = (id, tint) => { const o = OUTFITS[id]; if (o) { G.heroSuit.value.setRGB(...o[0]); G.heroMetal.value.setRGB(...o[1]); h.outfit = id; } if (tint) G.heroSuit.value.set(tint); };
  h.setForm = (id) => { const f = FORMS[id]; if (!f) return; G.heroForm.value.setRGB(...f[0]); G.heroFormGlow.value = f[1]; h.form = id; };
  h.cine = (on) => { if (on) { h.state = 'cine'; h.vel.multiplyScalar(0.1); } else if (h.state === 'cine') h.state = 'swim'; };
  h.playOnce = (name) => { body.play(name, 0.15); };

  // ------------------------------------------------------------------ on his feet
  const mv = { x: 0, y: 0, z: 0 }; let wallCut = false, wallX = 0, wallZ = 0, moveX = 0, moveZ = 1;
  const speedUp = (v) => (v < 6 ? 11 : v < 9 ? 14 : 22), slowDown = (v) => (v > 14 ? 24 : v > 9 ? 20 : 12);
  // the turn: a goal swings round to the stick at the rate his speed allows, and the heading follows it critically damped, so a turn eases in, eases out and lands with no overshoot
  const turnF = second({ f: 2.2, z: 1 }); let turnS = follower(0), turnGoal = 0;
  // ------------------------------------------------------------------ the surf: a state of its own. A boost along the surface lifts a swell under him and he's up on it, riding the sea: the stick carves, boost
  // sets the speed, jump launches him off, and it ends in a dive or on a beach
  const carveF = second({ f: 1.6, z: 1 }), swellF = second({ f: 1.1, z: 1 }); let carveS = follower(0), swellS = follower(0);
  const waveY = (x, z) => (G.sky && G.sky.waveAt ? G.sky.waveAt(x, z) : 0);
  function startSurf() {
    const v = Math.hypot(h.vel.x, h.vel.z); h.state = 'surf'; h.surf = { v: Math.min(v, SURF_TOP), t: 0 }; h.heading = Math.atan2(h.vel.x, h.vel.z); h.vel.y = 0; carveS = follower(0); swellS = follower(0); h.surgeLock = true;
    G.audio.splash(); G.fx.ring(new THREE.Vector3(h.pos.x, 0.05, h.pos.z), 6, 0.7, 0xe8fbff); G.quest && G.quest.note('surf');
  }
  function endSurf() { h.state = 'swim'; h.surf = null; h.carve = 0; h.surgeLock = false; }
  // Boost on land: he calls the water up under his feet and rides it (Randy, 1 Nov: "for the boost in land, we need the water animation and movement surf")
  function startLandSurf() {
    h.state = 'surf'; h.surf = { v: Math.max(h.spd, LAND_SURF_CRUISE * 0.75), t: 0, land: true }; h.land = false; h.grounded = false; h.vel.y = 0; carveS = follower(0); swellS = follower(0);
    G.fx.ring(h.pos.clone().setY(h.pos.y - STAND + 0.05), 4, 0.6, 0xe8fbff); G.audio.splash(); if (G.quest) G.quest.note('land_surf');
  }
  function stepSurf(u, dt) {
    const s = h.surf; s.t += dt;
    if (h.jumpBuf > 0) { const was = s.v; h.jumpBuf = 0; endSurf(); breach(was); return; }
    const sy = Math.sin(G.camYaw), cy = Math.cos(G.camYaw), wx = sy * Math.max(u.my, 0) + right.x * u.mx, wz = cy * Math.max(u.my, 0) + right.z * u.mx, mag = Math.hypot(wx, wz), off = mag > 0.1 ? wrap(Math.atan2(wx, wz) - h.heading) : 0;
    const carve = chase(carveF, carveS, clamp(-off / 0.8, -1, 1) * Math.min(mag, 1), dt); h.carve = carve;
    h.omega = -carve * SURF_TURN * (1 - 0.4 * clamp((s.v - SURF_RIDE) / (SURF_TOP - SURF_RIDE), 0, 1)); h.heading = wrap(h.heading + h.omega * dt);
    const storm = G.sky && G.sky.weather === 'storm', onLand = !!s.land;
    const target = u.my < -0.4 ? SURF_OFF - 2 : onLand ? (u.boost ? LAND_SURF_TOP : SURF_OFF - 3) : u.boost ? SURF_TOP : storm ? SURF_STORM : SURF_RIDE;
    s.v = Math.min(onLand ? LAND_SURF_TOP + 6 : SURF_TOP, s.v + clamp(target - s.v, -11 * dt, (onLand ? 7 : 10) * dt));
    if (!onLand) {     // at sea the water's own slope pulls the ride (down a face, faster); on a breaker's face the wave carries him shoreward with it
      const sn = Math.sin(h.heading), cn = Math.cos(h.heading), w0 = waveY(h.pos.x, h.pos.z), sl = (waveY(h.pos.x + sn * 1.5, h.pos.z + cn * 1.5) - w0) / 1.5;
      s.v = Math.max(0, s.v - 9.81 * 0.85 * sl * dt);
      const bk = G.sky && G.sky.breakAt ? G.sky.breakAt(h.pos.x, h.pos.z) : null;
      if (bk && bk.face > 0.02) { s.cx = bk.cx * bk.face; s.cz = bk.cz * bk.face; s.onFace = bk.face; s.v = Math.min(SURF_TOP + 6, s.v + 4 * bk.face * dt); } else { s.cx = s.cz = 0; s.onFace = 0; }
    }
    if (onLand) {      // the slope pulls along the ride: faster downhill, slower up
      const sn = Math.sin(h.heading), cn = Math.cos(h.heading), g0 = terrain(h.pos.x, h.pos.z), sl = (terrain(h.pos.x + sn * 1.2, h.pos.z + cn * 1.2) - g0) / 1.2;
      s.v = Math.max(0, s.v - 9.81 * SLOPE_PULL * (sl / Math.sqrt(1 + sl * sl)) * dt);
      if (sl > TAN_WALL) { s.v = 0; }
    }
    h.vel.set(Math.sin(h.heading) * s.v + (onLand ? 0 : s.cx || 0), 0, Math.cos(h.heading) * s.v + (onLand ? 0 : s.cz || 0));      // (the wave's carry goes through the same collisions)
    // something in the way: the ride glances off it along the way it was pushed, keeping most of its speed; only a hit near head-on costs it (seen in the game: a
    // rock at the shore stopped a 19 m/s ride dead)
    const px = h.pos.x, pz = h.pos.z;
    if (slide(h.vel.x * dt, 0, h.vel.z * dt, 0.62, true)) {
      const mx = h.pos.x - px, mz = h.pos.z - pz, real = Math.hypot(mx, mz) / Math.max(dt, 1e-4), keep = real / Math.max(Math.hypot(h.vel.x, h.vel.z), 1e-3);
      if (keep > 0.15) { h.heading = wrap(h.heading + wrap(Math.atan2(mx, mz) - h.heading) * 0.6); s.v = Math.max(real, s.v * (0.55 + 0.4 * keep)); }
      else { s.v *= 0.35; h.heading = wrap(h.heading + (carve >= 0 ? -1 : 1) * 1.2); G.shake(0.2); G.audio.splash(); }      // near head-on: thrown aside, a third of the speed
    }
    const y = chase(swellF, swellS, SURF_SWELL * (storm && !onLand ? SWELL_STORM : 1) * clamp((s.v - SURF_OFF + 1) / 3, 0, 1), dt);
    const g = groundAt(h.pos.x, h.pos.z);
    // the shore both ways: a land ride runs on out over the sea, a sea ride runs on up the beach while Boost is held
    if (onLand && g < SURF_SHALLOW) s.land = false;
    else if (!onLand && g > SURF_SHALLOW && u.boost) s.land = true;
    const base = s.land ? Math.max(g, waveY(h.pos.x, h.pos.z), riverY(h.pos.x, h.pos.z)) : waveY(h.pos.x, h.pos.z);      // over a river the ride runs on its water
    // off an edge on land: he flies off it, still on his water
    if (s.land && h.pos.y - (base + y + STAND * 0.86) > 1.6) { const v = s.v; endSurf(); leave(0); h.jumps = 1; h.vel.set(Math.sin(h.heading) * v, 0, Math.cos(h.heading) * v); return; }
    h.pos.y = s.land ? h.pos.y + clamp(base + y + STAND * 0.86 - h.pos.y, -12 * dt, 30 * dt) : base + y + STAND * 0.86; h.swellY = y; h.surfBase = base;
    // the ends. On land: let go of Boost and the water runs out under him, and he runs on. At sea: into the shallows he runs up the beach; pressed down or out of speed he goes under
    if (s.land) { if (s.v < SURF_OFF) { const v = s.v; endSurf(); h.land = true; h.grounded = true; h.spd = v; h.pos.y = g + STAND; h.landSurfT = 0; G.audio.splash(); } return; }
    if (g > SURF_SHALLOW) { endSurf(); leave(2.5); h.jumps = 1; h.apexY = h.pos.y; G.fx.ring(new THREE.Vector3(h.pos.x, 0.05, h.pos.z), 5, 0.6, 0xe8fbff); G.audio.splash(); G.quest && G.quest.note('surf_beach'); return; }
    if (u.ud < -0.4 || s.v < SURF_OFF || G.camPitch < -0.6) { endSurf(); leave(-2.5); h.jumps = 1; h.apexY = h.pos.y; G.quest && G.quest.note('surf_dive'); }
  }
  function leave(vy) { h.air = true; h.grounded = false; h.vel.y = vy; h.apexY = h.pos.y; }
  // the dolphin leap. He comes out at the height his speed earns, on his own gravity, and his body follows the arc
  const breachH = (v) => { const [a, b, c] = BREACH_S, [ha, hb, hc] = BREACH_H; return v <= b ? ha + (hb - ha) * clamp((v - a) / (b - a), 0, 1) : hb + (hc - hb) * clamp((v - b) / (c - b), 0, 1); };
  function splash(size) {
    const p = new THREE.Vector3(h.pos.x, waveY(h.pos.x, h.pos.z) + 0.05, h.pos.z); G.audio.splash();
    G.fx.ring(p, 3 + size * 3.5, 1.3, 0xe8fbff);
    if (h.onSplash) h.onSplash(p, size); if (G.settings?.shake !== false) G.shake(0.08 + 0.1 * size);
  }
  function breach(v) {
    const H = breachH(v), flat = Math.hypot(h.vel.x, h.vel.z); if (flat > BREACH_FLAT) { h.vel.x *= BREACH_FLAT / flat; h.vel.z *= BREACH_FLAT / flat; } else if (flat < BREACH_ARC) { const k = Math.min(flat, 1), x = flat > 0.01 ? h.vel.x / flat : Math.sin(h.heading), z = flat > 0.01 ? h.vel.z / flat : Math.cos(h.heading); h.vel.x = (k ? x : Math.sin(h.heading)) * BREACH_ARC; h.vel.z = (k ? z : Math.cos(h.heading)) * BREACH_ARC; }      // always some way forward: straight up isn't an arc
    h.air = true; h.grounded = false; h.jumps = 2; h.jumpHold = false; h.leapHi = true; h.plunge = false; h.jumpBuf = 0; h.driveT = 0; h.porpoise = null; h.chainT = 0; h.vel.y = Math.sqrt(2 * BREACH_G * H); h.apexY = h.pos.y; h.breach = { v, H, v0: h.vel.y, u: 0 }; h.shotYaw = Math.atan2(h.vel.x, h.vel.z); h.shotH = Math.max(H, h.porpoiseWas ? h.shotH || 0 : 0);
    G.audio.splash(); h.splashIn = 0.13; h.splashSize = H / 10; G.quest && G.quest.note('leap');       // the column goes up when he's clear of it
  }
  function jumpNow() {
    const sprinting = h.surge > 0.4 || h.spd > 7.2, v = sprinting ? V_LEAP : J.v;
    leave(v); h.jumps = 1; h.jumpHold = true; h.leapHi = sprinting; h.jumpT = 0;
    if (sprinting) { G.fx.ring(h.pos.clone().setY(h.pos.y - STAND + 0.1), 7, 0.55, 0xfff0c8); G.shake(0.25); G.audio.boom(); }
    G.audio.swing();
  }
  // a river or a fall's pool under a game point (world.js waterAt reads Blender x, y): its surface and the way it runs, or null
  const riverAt = (x, z) => (G.world.waterAt ? G.world.waterAt(x, -z) : null);
  const riverY = (x, z) => { const w = riverAt(x, z); return w ? w.W : -Infinity; };
  function stepGround(u, dt, boosting) {
    const sy = Math.sin(G.camYaw), cy = Math.cos(G.camYaw); let wx = sy * u.my + right.x * u.mx, wz = cy * u.my + right.z * u.mx, amt = Math.min(1, Math.hypot(wx, wz));
    // a solid in the way: the part of the stick that pushes into it is lost and the rest runs along it, so he turns along a wall, or stands against one, and never stutters at it
    if (amt > 0.04 && G.world.sweep) {
      const l = Math.hypot(wx, wz), reach = 0.14 + h.spd * dt;
      sA.x = h.pos.x; sA.y = -h.pos.z; sA.z = h.pos.y; sB.x = sA.x + (wx / l) * reach; sB.y = sA.y - (wz / l) * reach; sB.z = sA.z;
      const hit = G.world.sweep(sA, sB, 0.42); let nx = hit ? hit.nx : 0, nz = hit ? -hit.ny : 0; const n = Math.hypot(nx, nz);
      if (n > 1e-4) { nx /= n; nz /= n; const dn = wx * nx + wz * nz; if (dn < 0) { wx -= nx * dn; wz -= nz * dn; amt = Math.min(amt, Math.hypot(wx, wz)); } }
    }
    // velocity is the truth at the start of a step: a knock, a lunge's end or a check that set it is kept, in its own direction. A wall's cut to it isn't a new way to face
    const flat0 = Math.hypot(h.vel.x, h.vel.z);
    if (Math.abs(flat0 - h.spd) > 0.01 || (flat0 > 0.5 && (h.vel.x * moveX + h.vel.z * moveZ) / flat0 < 0.9)) { h.spd = flat0; if (flat0 > 0.5 && !(wallCut && h.pos.x === wallX && h.pos.z === wallZ)) h.heading = Math.atan2(h.vel.x, h.vel.z); }
    wallCut = false;
    const g0 = groundAt(h.pos.x, h.pos.z), rw = riverAt(h.pos.x, h.pos.z), depth = Math.max(0, -g0, rw ? rw.W - g0 : 0), wade = 1 - 0.42 * smooth(0, 0.3, depth), sn = Math.sin(h.heading), cn = Math.cos(h.heading);
    h.riverDepth = rw ? Math.max(0, rw.W - g0) : 0;
    // the ground ahead: he slows up a hill, and what's too steep he doesn't climb
    const ahead = (groundAt(h.pos.x + sn * 0.7, h.pos.z + cn * 0.7) - g0) / 0.7, hill = 1 - 0.3 * smooth(0.15, TAN_CLIMB, ahead) - 0.3 * smooth(TAN_CLIMB, TAN_WALL, ahead) + 0.12 * smooth(0.1, 0.6, -ahead);
    h.landSurfT = boosting && h.spd > LAND_SPRINT - 1.2 && !h.jumpPrep ? (h.landSurfT || 0) + dt : 0;
    if (h.landSurfT > LAND_SURF_IN && depth < 0.3) { h.landSurfT = 0; startLandSurf(); return; }
    const top = h.surge > 0.4 ? LAND_SUPER : boosting ? LAND_SPRINT : LAND_RUN;      // h.surge is the sea's: it fades on land (below), so it only carries a run out of the water
    let target = top * amt * wade * hill; h.stick = amt; h.landGoal = target;
    const wishYaw = amt > 0.04 ? Math.atan2(wx, wz) : h.heading, err = wrap(wishYaw - h.heading);
    // a sharp reverse at speed: plant, brake, turn on the spot, go
    if (!h.pivot && amt > 0.3 && Math.abs(err) > 2.09 && h.spd > 2.6) h.pivot = 1;
    if (h.pivot) { target = 0; if (h.spd < 1.3) h.pivot = 0; }
    const wMax = h.pivot ? 0.6 : Math.min(11, 24 / Math.max(h.spd, 0.1));
    if (Math.abs(wrap(h.heading - turnS.y)) > 1e-4) { turnS = follower(h.heading); turnGoal = h.heading; }      // something else set his facing: the turn starts from there
    turnGoal += clamp(wrap(wishYaw - turnGoal), -wMax * dt, wMax * dt);
    const y0 = turnS.y, y1 = chase(turnF, turnS, nearAngle(y0, turnGoal), dt);
    h.omega = (y1 - y0) / dt; h.heading = wrap(y1); turnGoal = nearAngle(y1, turnGoal);
    const want = clamp((target - h.spd) * 7, -slowDown(h.spd), speedUp(h.spd));
    h.accel = first(0.05, h.accel, want, dt);
    h.spd = Math.max(0, h.spd + h.accel * dt);
    // from a stand he goes the way the stick says, at once, and his body comes round after it; by a jog he goes the way he faces
    const moveYaw = h.heading + wrap(wishYaw - h.heading) * (1 - smooth(0.6, 3, h.spd)); moveX = Math.sin(moveYaw); moveZ = Math.cos(moveYaw);
    h.vel.set(moveX * h.spd, 0, moveZ * h.spd);
    moveOnGround(dt);
    // a river's current leans on a wader: a drift down its course, more the deeper he stands (his own speed and facing are left alone)
    if (rw && h.riverDepth > 0.25 && h.land && !h.air) { const k = rw.v * 0.32 * smooth(0.25, 0.9, h.riverDepth) * dt; slide(rw.vx * k, 0, -rw.vy * k, 0.42, true); }
    // the jump: a press, or one buffered a moment before he landed, or just after he ran off an edge
    if (h.jumpBuf > 0 && !h.jumpPrep && h.land && !h.air) { h.jumpBuf = 0; h.jumpPrep = JUMP_PREP; body.play(has('jump', 'leap'), 0.05, true); }
    if (h.jumpPrep) { h.jumpPrep -= dt; if (h.jumpPrep <= 0) { h.jumpPrep = 0; jumpNow(); } }
  }
  function moveOnGround(dt) {
    settle();
    const px = h.pos.x, pz = h.pos.z, g0 = groundAt(px, pz), t0 = terrain(px, pz);
    const met = slide(h.vel.x * dt, 0, h.vel.z * dt, 0.42, true);
    let run = Math.hypot(h.pos.x - px, h.pos.z - pz);
    // too steep: read over a stride's reach ahead, so a step he can take isn't a wall and a bank taken in tiny frames is still a bank. The push up the slope is lost, the rest runs along it, so a bank stops him cleanly
    // a bank's own steepness counts as well as the way he's going across it: nobody traverses a 55° face just by going at it slantwise
    const steep = (x0, z0, x1, z1, len) => { const B = Math.max(len, SLOPE_READ), ux = (x1 - x0) / Math.max(len, 1e-5), uz = (z1 - z0) / Math.max(len, 1e-5); if ((terrain(x0 + ux * B, z0 + uz * B) - t0) / B > TAN_WALL) return true;
      const e = SLOPE_READ, gx = (terrain(x1 + e, z1) - terrain(x1 - e, z1)) / (2 * e), gz = (terrain(x1, z1 + e) - terrain(x1, z1 - e)) / (2 * e); return Math.hypot(gx, gz) > TAN_WALL && ux * gx + uz * gz > 0.15; };
    if (run > 1e-4 && steep(px, pz, h.pos.x, h.pos.z, run)) {
      const e = SLOPE_READ, gx = terrain(px + e, pz) - terrain(px - e, pz), gz = terrain(px, pz + e) - terrain(px, pz - e), l = Math.hypot(gx, gz) || 1, nx = gx / l, nz = gz / l, vn = h.vel.x * nx + h.vel.z * nz;
      if (vn > 0) { h.vel.x -= nx * vn; h.vel.z -= nz * vn; }
      h.pos.x = px; h.pos.z = pz; slide(h.vel.x * dt, 0, h.vel.z * dt, 0.42, true); run = Math.hypot(h.pos.x - px, h.pos.z - pz);
      if (run > 1e-4 && steep(px, pz, h.pos.x, h.pos.z, run)) { h.pos.x = px; h.pos.z = pz; run = 0; h.vel.x = h.vel.z = 0; }
      h.spd = Math.hypot(h.vel.x, h.vel.z); if (h.spd < 0.3) { h.spd = 0; h.vel.x = h.vel.z = 0; h.accel = 0; }
      wallCut = true; wallX = h.pos.x; wallZ = h.pos.z;      // a bank's cut to his speed isn't a new way to face, any more than a wall's
    }
    if (met) { const real = Math.hypot(h.vel.x, h.vel.z); if (real < h.spd) { h.spd = real; h.accel = 0; } wallCut = true; wallX = h.pos.x; wallZ = h.pos.z; }
    const g1 = groundAt(h.pos.x, h.pos.z);
    // off an edge: more of a drop than the ground's slope or a step allows, and he's in the air, with a moment left to jump
    if (g0 - g1 > Math.max(run * 1.25 + 0.05, STEP_UP + 0.05)) { leave(0); h.coyote = COYOTE; h.jumps = 0; return; }
    // never a jump in height: he goes to the ground at the pace he's going, and up out of the water at a wader's
    const goal = g1 + STAND, off = Math.abs(goal - h.pos.y), pace = run / Math.max(dt, 1e-4), most = (goal > h.pos.y && h.pos.y < 0 ? Math.max(4.4, pace * 0.62) : Math.max(3, pace * 1.6)) * dt;
    h.pos.y = off < 0.04 ? goal : h.pos.y + Math.sign(goal - h.pos.y) * Math.min(off, most);
    settle();       // rising with the ground can bring something overhead into him: it moves him aside, never up through it
    // deep enough that he floats: the height is the same either side of this line
    if (g1 + STAND < SWIM_Y - 0.03) { h.land = false; h.grounded = false; }
  }
  function stepGroundIdle(dt) { h.spd = Math.hypot(h.vel.x, h.vel.z); h.vel.y = 0; moveOnGround(dt); }
  function stepAir(u, dt, held) {
    h.jumpT = (h.jumpT || 0) + dt;
    const rising = h.vel.y > 0, cut = rising && h.jumpHold && !held && h.jumpT > 0.05 ? CUT : 1;
    if (!held || !rising) h.jumpHold = false;
    if (h.splashIn > 0 && (h.splashIn -= dt) <= 0) splash(h.splashSize);
    if (h.breach) h.breach.u = clamp((h.breach.v0 - h.vel.y) / (2 * h.breach.v0), 0, 1);
    const g = h.breach ? BREACH_G : h.plunge ? 70 : J.g * (rising && !h.jumpHold && !h.leapHi && h.jumps === 1 ? CUT : cut);
    if (h.breach && h.jumpBuf > 0 && h.vel.y < 3) { h.jumpBuf = 0; h.chainT = 9; }      // from the top of the arc on, a tap is for the next leap
    // a little steering in the air; he keeps the speed he left with
    const sy = Math.sin(G.camYaw), cy = Math.cos(G.camYaw), wx = sy * u.my + right.x * u.mx, wz = cy * u.my + right.z * u.mx, flat = Math.hypot(h.vel.x, h.vel.z), reach = Math.max(flat, 4.5);
    h.vel.x += wx * 9 * dt; h.vel.z += wz * 9 * dt; const f2 = Math.hypot(h.vel.x, h.vel.z); if (f2 > reach) { h.vel.x *= reach / f2; h.vel.z *= reach / f2; }
    h.vel.y -= g * dt; mv.x = 0; mv.y = 0; mv.z = 0; moved(mv, h.vel, g, dt);      // the step's mean velocity, so the apex designed is the apex reached
    slide(mv.x, mv.y, mv.z, 0.42, false);
    { const t = terrain(h.pos.x, h.pos.z) + 0.42; if (h.pos.y < t) { h.pos.y = t; if (h.vel.y < 0) h.vel.y = 0; } }      // a leap into rising ground at speed runs up it, never under it
    h.apexY = Math.max(h.apexY, h.pos.y);
    // a second jump, or the first if he's only just left the edge
    if (h.jumpBuf > 0 && h.coyote > 0) { h.jumpBuf = 0; h.coyote = 0; body.play(has('jump', 'leap'), 0.05, true); jumpNow(); }
    else if (h.jumpBuf > 0 && h.jumps >= 1 && h.jumps < 2 && !h.plunge) { h.jumpBuf = 0; h.jumps = 2; h.vel.y = V_DOUBLE; h.jumpHold = false; h.leapHi = false; h.apexY = h.pos.y; body.play(has('jump2', has('jump', 'leap')), 0.05, true); G.audio.swing(); G.fx.ring(h.pos.clone(), 3.5, 0.4, 0xbdf7ff); }
    const g1 = groundAt(h.pos.x, h.pos.z);
    if (g1 > SWIM_Y - STAND - 0.1 && h.vel.y <= 0 && h.pos.y <= g1 + STAND) landOn(g1);
    else if (h.pos.y < -0.2 && h.vel.y < 0 && g1 < SWIM_Y - STAND) {
      const b = h.breach; h.land = false; h.air = false; h.breach = null;
      if (b) {
        splash(b.H / 9); G.fx.bubbles(h.pos, 10, 0.9); G.quest && G.quest.note('dive');
        if (h.chainT > 0 || h.jumpBuf > 0) { h.jumpBuf = 0; h.chainT = 0; h.porpoise = { t: 0, v: b.v, up: Math.sqrt(2 * BREACH_G * b.H), x: h.vel.x, z: h.vel.z }; }       // the next leap, all the speed kept: down, round and out
        else { h.keepV = b.v; h.keepT = CHAIN_LATE; h.pitchBack = 0.8; h.lensHold = 0.6; h.vel.y = Math.max(h.vel.y, -16); if (u.boost && Math.hypot(h.vel.x, h.vel.z) > SURF_START) startSurf(); }
        return;
      }
      G.audio.splash(); if (u.boost && Math.hypot(h.vel.x, h.vel.z) > SURF_START && !h.plunge) startSurf(); G.fx.ring(new THREE.Vector3(h.pos.x, -0.05, h.pos.z), h.plunge ? 16 : 7, 1.1, 0xe8fbff); G.fx.bubbles(h.pos, h.plunge ? 44 : 26, 1.6); G.quest && G.quest.note('dive');
      if (h.plunge) { h.plunge = false; h.vel.y = Math.max(h.vel.y, -22); G.shake(0.7); G.audio.hit(true); G.look.flash(h.pos, 0xbdf7ff, 20, 0.5); G.life && G.life.scatter(h.pos, 30); }
    }
  }
  // how a landing goes depends on how far he fell
  function landOn(g) {
    const fell = h.apexY - (g + STAND), plunged = h.plunge;
    h.breach = null; h.chainT = 0; h.air = false; h.land = true; h.grounded = true; h.pos.y = g + STAND; h.vel.y = 0; h.jumps = 0; h.leapHi = false; h.plunge = false; h.spd = Math.hypot(h.vel.x, h.vel.z); h.heading = h.spd > 1 ? Math.atan2(h.vel.x, h.vel.z) : h.heading;
    h.landH = fell; h.landT = G.time;
    body.clear(0.1);
    if (plunged) { G.fx.ring(h.pos.clone(), 14, 0.8, 0xfff0c8); G.shake(0.7); G.audio.hit(true); }
    if (fell > 6 || plunged) { body.play(has('land', 'hit_front'), 0.05, true); h.state = 'hurt'; h.stun = (moves.land && moves.land.stands) || 0.5; h.vel.multiplyScalar(0.25); h.spd *= 0.25; G.fx.ring(h.pos.clone().setY(h.pos.y - STAND + 0.1), 9, 0.6, 0xfff0c8); G.shake(0.5); G.audio.hit(false); }
    else if (fell > 1.6) { G.fx.ring(h.pos.clone().setY(h.pos.y - STAND + 0.1), 3.5, 0.35, 0xfff0c8); G.shake(0.12); G.audio.hit(false); }
    if (h.jumpBuf > 0 && h.state === 'swim') { h.jumpBuf = 0; h.jumpPrep = JUMP_PREP * 0.5; }
  }

  h.step = (dt) => {
    const u = G.ui.sample(), cam = G.camera;
    h.prevHeading = h.heading;
    h.inv = Math.max(0, h.inv - dt); h.parryT = Math.max(0, h.parryT - dt); h.combatT += dt;
    for (const k in h.cool) h.cool[k] = Math.max(0, h.cool[k] - dt);
    if (h.combatT > 6 && h.hp < h.maxHp && !h.dead) h.hp = Math.min(h.maxHp, h.hp + 5 * dt);
    h.tide = Math.min(h.maxTide, h.tide + 3.5 * dt);
    if (h.dead || h.state === 'cine') { h.vel.multiplyScalar(Math.exp(-2.5 * dt)); if (h.dead) h.vel.y -= 0.7 * dt; h.pos.addScaledVector(h.vel, dt); collide(0.5); u.atk = u.dash = u.spin = u.wave = u.parry = false; return; }

    // the look: the stick and the mouse turn the camera directly
    G.camYaw = wrap(G.camYaw + u.yaw); G.camPitch = clamp(G.camPitch + u.pitch, -1.35, 1.2); if ((h.state === 'surf' || h.ride || h.breach) && !u.yaw) G.camYaw = wrap(G.camYaw + wrap(h.heading - G.camYaw) * (1 - Math.exp(-1.6 * dt)));
    h.pitchBack = Math.max(0, (h.pitchBack || 0) - dt); if (!u.pitch && (h.breach || h.pitchBack > 0)) G.camPitch *= Math.exp(-4 * dt);      // the look comes level through a leap, so back in the water he doesn't swim where it was pointing
    u.yaw = 0; u.pitch = 0;

    // a whale's fin: take it, and the sea carries you
    h.rideT -= dt;
    if (h.rideT <= 0) { h.rideT = 0.25; h.nearWhale = null; if (!h.ride && G.life && G.life.whales) for (const w of G.life.whales) { if (whalePos(w).distanceTo(h.pos) < 19 && !h.air && h.state === 'swim') h.nearWhale = w; } G.ui.rideHint(!!h.nearWhale || !!h.ride); }
    if (u.ride) {
      u.ride = false;
      if (h.ride) { h.vel.copy(whaleDir(h.ride)).multiplyScalar(9); h.ride = null; G.ui.tip('You let go', 1.6); }
      else if (h.nearWhale) { h.ride = h.nearWhale; G.audio.whale(); G.ui.tip('Riding. F or Ride to let go', 3); }
    }
    if (h.ride) {
      const w = h.ride, f = whaleDir(w), L = w.length || 25;
      h.finAt(w, tmpRide); h.vel.copy(tmpRide).sub(h.pos).divideScalar(Math.max(dt, 1 / 240));
      h.pos.add(wish.copy(h.vel).multiplyScalar(dt * 0.18)); if (h.vel.length() > 20) h.vel.setLength(20);
      h.heading = Math.atan2(f.x, f.z); h.pitchT = Math.asin(clamp(f.y, -1, 1)); h.speed = 9; h.bank = damp(h.bank, 0, 3, dt); h.tilt = damp(h.tilt, 1.46, 3, dt); h.combatT = 99;
      u.atk = u.dash = u.spin = u.wave = u.parry = u.call = false;
      return;
    }

    G.combat.presses(u, dt);
    if (h.carried) { const c = h.carried; h.vel.subVectors(c.p, h.pos).divideScalar(Math.max(dt, 1 / 240)); h.pos.copy(c.p); h.heading = c.yaw; h.air = true; h.land = false; h.grounded = false; h.surf = null; h.breach = null; h.driveT = 0; h.porpoise = null; h.jumps = 1; h.apexY = h.pos.y; h.plunge = false; h.speed = 9; return; }      // combat's: a spout has him, wherever it says
    if (h.surf && h.state !== 'surf') { h.surf = null; h.carve = 0; h.air = true; h.grounded = false; h.vel.y = 0; h.apexY = h.pos.y; h.jumps = 1; }

    // the wish: where the camera looks, with the stick
    fwd.set(Math.sin(G.camYaw) * Math.cos(G.camPitch), Math.sin(G.camPitch), Math.cos(G.camYaw) * Math.cos(G.camPitch));
    right.set(-Math.cos(G.camYaw), 0, Math.sin(G.camYaw));
    wish.set(0, 0, 0).addScaledVector(fwd, u.my).addScaledVector(right, u.mx); wish.y += u.ud;
    const inputAmt = Math.min(1, wish.length()); if (inputAmt > 0.001) wish.normalize();

    if (h.boostFuel <= 0.02) h.boostOut = true; else if (h.boostFuel > 0.3) h.boostOut = false;   // one impulse per burst, never a stutter at the bottom of the tank
    const boosting = u.boost && (h.land || !h.boostOut) && inputAmt > 0.2 && h.state === 'swim' && !h.air;
    h.boostFuel = clamp(h.boostFuel + (boosting && !h.land ? -0.065 : 0.22) * dt, 0, 1);      // a sprint on land costs nothing; the sea's boost has its tank
    // Tidepulse: boost pressed in time with his kick steps him up a tier; a miss keeps the tier he has; held, it's tier 1, so nobody's locked out of it. Plain swimming costs nothing
    if (!h.land && !h.air && h.state === 'swim') {
      h.tideT = Math.max(0, (h.tideT || 0) - dt); if (h.tideT <= 0) h.tideTier = 0;
      if (u.boost && !h.tidePress) { const off = Math.min(h.beatAgo ?? 9, (h.beatEvery ?? 9) - (h.beatAgo ?? 9)); if (off <= TIDE_WINDOW && (h.tideTier || 0) < 3) { h.tideTier = (h.tideTier || 0) + 1; G.audio.bubble(); h.tidePop = G.time; } else if (!h.tideTier) h.tideTier = 1; h.tideT = TIDE_HOLD; }
      if (u.boost) { h.tideT = Math.max(h.tideT, 0.4); }
      h.tidePress = !!u.boost;
    } else { h.tideTier = 0; h.tidePress = !!u.boost; }
    if (boosting && !h.wasBoost) { if (!h.land) h.vel.addScaledVector(wish, 6); G.fx.ring(h.pos.clone(), 3, 0.45, 0xbdf7ff, wish.clone().negate()); G.audio.bubble(); }
    h.wasBoost = boosting;
    // hold it and the sea lets go of you: super speed
    h.boostHeld = boosting && !h.land ? h.boostHeld + dt : 0;      // super speed is the sea's: held on land it stays a sprint
    const surgeWas = h.surge; h.surge = damp(h.surge, h.boostHeld > LEVEL_HOLD[speedLevel] ? 1 : 0, h.boostHeld > LEVEL_HOLD[speedLevel] ? 3.2 : 4.5, dt);
    if (surgeWas < 0.45 && h.surge >= 0.45) { G.fx.ring(h.pos.clone(), 11, 0.7, 0xdffaff, wish.clone().negate()); G.fx.bubbles(h.pos, 30, 1.2); G.audio.boom(); G.shake(0.4); G.quest && G.quest.note('super'); G.life && G.life.scatter(h.pos, 24); }
    if (h.surge > 0.4 && G.enemies) { for (const e of G.enemies.alive()) { if (e.pos.distanceTo(h.pos) < 3.2 + (e.r || 0.8) && (!e.ramT || G.time > e.ramT)) { e.ramT = G.time + 1; e.onHit(34, h.pos, 'atk_dash'); G.fx.sparks(e.pos, 18, 0xdffaff, 10); G.audio.hit(true); G.shake(0.3); G.hitstop = Math.max(G.hitstop, 0.05); } } }

    if (u.jump) { h.jumpBuf = BUFFER; u.jump = false; } else h.jumpBuf = Math.max(0, h.jumpBuf - dt);
    const heldJump = u.jumpHeld !== undefined ? u.jumpHeld : TOUCH ? true : u.ud > 0;
    h.coyote = Math.max(0, h.coyote - dt);
    if (!h.climb && (h.land || h.air) && inputAmt + Math.max(0, u.ud) > 0.2) tryClimb(u, wish.x, wish.z);
    if (h.climb) stepClimb(u, dt, u.boost && inputAmt > 0.2);
    else if (h.air) stepAir(u, dt, heldJump);
    else if (h.state === 'surf') stepSurf(u, dt);
    else if (h.state === 'swim' && h.land) stepGround(u, dt, boosting);
    else if (h.state === 'swim') {
      const tierV = TIDE_TIERS[h.tideTier || 0], top = Math.max(boosting ? BOOST + LEVEL_BOOST[speedLevel] : CRUISE + LEVEL_CRUISE[speedLevel], tierV) + h.surge * (SUPER - Math.max(BOOST + LEVEL_BOOST[speedLevel], tierV)), tgtV = wish.clone().multiplyScalar(top * Math.max(inputAmt, h.surge));
      const k = inputAmt > 0.05 ? (boosting ? 3.6 : 2.5) : 1.5;
      h.vel.x = damp(h.vel.x, tgtV.x, k, dt); h.vel.y = damp(h.vel.y, tgtV.y, k, dt); h.vel.z = damp(h.vel.z, tgtV.z, k, dt);
      if (inputAmt < 0.05) h.vel.y += Math.sin(G.time * 1.1) * 0.06 * dt;
      // along the surface at speed under boost, the sea comes up under him
      h.surfT = boosting && h.pos.y > SWIM_Y - 0.6 && Math.hypot(h.vel.x, h.vel.z) > SURF_START && Math.abs(h.vel.y) < 4 && groundAt(h.pos.x, h.pos.z) < SURF_SHALLOW - 1 ? (h.surfT || 0) + dt : 0;
      if (h.surfT > 0.2) { h.surfT = 0; startSurf(); }
    } else if (h.state === 'attack' || h.state === 'parry') {
      G.combat.stepAttack(dt);
    } else if (h.state === 'hurt') {
      h.stun -= dt; h.vel.multiplyScalar(Math.exp(-2.6 * dt));
      if (h.stun <= 0) { h.state = 'swim'; body.clear(0.16); }
    }

    // a tap of Jump in the water, with no aiming: near the surface he drives up and out on his own; deeper, one strong kick up. A dip between two leaps keeps all his speed
    if (h.state === 'swim' && !h.land && !h.air && !h.climb) {
      h.keepT = Math.max(0, (h.keepT || 0) - dt);
      if (h.jumpBuf > 0) { const deep = waveY(h.pos.x, h.pos.z) - h.pos.y; h.jumpBuf = 0; h.driveV = Math.max(h.speed, h.keepT > 0 ? h.keepV : 0); h.driveT = deep <= DRIVE_NEAR ? (deep + 1.2) / DRIVE_V + 0.1 : DRIVE_DEEP; G.fx.bubbles(h.pos, 12, 0.7); G.audio.bubble(); }
      if (h.driveT > 0) { h.driveT -= dt; h.vel.y = Math.max(h.vel.y, DRIVE_V); }
      if (h.porpoise) { const p = h.porpoise; p.t += dt; h.vel.x = p.x; h.vel.z = p.z; h.vel.y = p.up * (2 * Math.min(p.t / PORPOISE_T, 1) - 1); if (p.t > PORPOISE_T + 0.3) h.porpoise = null; }
    } else if (!h.air) { h.driveT = 0; h.porpoise = null; }
    if (h.land && !h.air && h.state !== 'swim') stepGroundIdle(dt);       // a blow, a parry, a hit on land: carried by the blow's own speed, on the ground
    else if (!h.air && !h.land && h.state !== 'surf' && !h.climb) slide(h.vel.x * dt, h.vel.y * dt, h.vel.z * dt, 0.62, false);

    // the shore: he comes up onto his feet where he can stand with his head out, and the height never jumps
    if (!h.air && !h.land && h.state !== 'surf' && !h.climb) {
      const g = groundAt(h.pos.x, h.pos.z);
      if (g + STAND >= SWIM_Y && h.pos.y < 0.5) { h.land = true; h.grounded = true; h.spd = Math.hypot(h.vel.x, h.vel.z); if (G.quest) G.quest.note('land'); }
    }

    // the surface: gentle at low speed, a leap when you hit it fast, or when you ask
    if (h.state === 'surf' || h.climb) { /* the swell, or a fall, has him */ }
    else if (!h.air && !h.land) {
      if (h.pos.y > SWIM_Y) {
        if (h.state === 'swim' && h.porpoise) breach(h.porpoise.v);
        else if (h.state === 'swim' && h.driveT > 0) breach(h.driveV);
        else if (h.state === 'swim' && h.vel.y > BREACH_UP && h.speed > BREACH_MIN) breach(h.speed);       // any real speed, going up: he's out
        else { h.pos.y = SWIM_Y; h.vel.y = Math.min(0, h.vel.y); }
      }
      collide(0.62);
    } else if (h.vel.y < 0 && h.pos.y < 1 && h.air) body.clear(0.3);

    // the map's edge: the sea turns him back. Over the last stretch his outward speed is held to what can still stop in time, however fast he came; close to the line it runs the other way, a current
    // shoving him back in. It follows the map's size, and the line itself is firm
    const EDGE = (G.world.data.size_m || 1280) / 2 - 4;
    for (const k of ['x', 'z']) {
      const s = Math.sign(h.pos[k]), left = EDGE - Math.abs(h.pos[k]); if (left >= EDGE_ZONE) continue;
      const allow = left > EDGE_BACK ? Math.sqrt(2 * EDGE_PUSH * (left - EDGE_BACK)) : -(EDGE_BACK - left) * 1.6, out = h.vel[k] * s;
      if (out > allow) {
        h.vel[k] = allow * s; if (h.land && !h.air) h.spd = Math.hypot(h.vel.x, h.vel.z); if (h.surf) h.surf.v = Math.min(h.surf.v, Math.hypot(h.vel.x, h.vel.z));
        if (G.time > (h.edgeT || 0)) { h.edgeT = G.time + 0.3; G.fx.bubbles(h.pos.clone(), 5, 0.8); if (G.time > (h.edgeTip || 0)) { h.edgeTip = G.time + 6; G.ui.tip('The sea turns you back', 2); G.fx.ring(h.pos.clone(), 7, 0.7, 0xdffaff); G.audio.bubble(); } }
      }
      if (left < 0) { h.pos[k] = EDGE * s; h.vel[k] = Math.min(0, h.vel[k] * s) * s; collide(0.5); }       // the line doesn't put him inside something that stands on it
    }

    h.speed = h.vel.length();
    // the trident: in his hand from the first blow to ARM_HOLD after the last, on his back the rest of the time. A dodge doesn't draw it
    { const c = G.combat.cur; h.armT = c && c.def && c.def.kind !== 'dodge' ? 0 : (h.armT ?? 9) + dt; h.armed = h.armT < ARM_HOLD; }
    // the body follows the water: a heading, a pitch, a tilt from upright to streamlined, a bank into turns
    if (h.land && !h.air) { h.bank = damp(h.bank, 0, 8, dt); h.pitchT = damp(h.pitchT, 0, 8, dt); }
    else if (h.state === 'swim' || h.air) {
      if (h.speed > 1.2) {
        const y = Math.atan2(h.vel.x, h.vel.z), dy = wrap(y - h.heading);
        h.heading = wrap(h.heading + dy * (1 - Math.exp(-6.5 * dt)));
        h.bank = damp(h.bank, clamp(-dy * 1.1, -0.9, 0.9), 5, dt);
        h.pitchT = damp(h.pitchT, h.air && !h.breach ? clamp(Math.atan2(h.vel.y, Math.hypot(h.vel.x, h.vel.z)), -0.35, 0.35) : Math.atan2(h.vel.y, Math.hypot(h.vel.x, h.vel.z)), h.breach ? 10 : 6, dt);
      } else { h.heading = wrap(h.heading + wrap(G.camYaw - h.heading) * (1 - Math.exp(-2.4 * dt))); h.bank = damp(h.bank, 0, 4, dt); h.pitchT = damp(h.pitchT, 0, 3, dt); }
    } else { h.bank = damp(h.bank, 0, 8, dt); }
    const tiltGoal = h.climb ? 1.3 : h.breach ? 1.46 : h.land || h.air || h.state === 'surf' ? 0 : h.state === 'swim' ? smooth(1.6, 5, h.speed) * 1.42 + h.surge * 0.1 : (h.tiltGoal ?? 0.18);
    h.tiltTo = tiltGoal; h.tilt = damp(h.tilt, tiltGoal, h.state === 'attack' || h.breach ? 12 : 5, dt);
    stepSfx += h.speed * dt;
    if ((boosting || (h.tideTier || 0) > 1) && !h.land && stepSfx > 2.5) { stepSfx = 0; G.fx.bubbles(h.pos.clone(), 3 + (h.surge * 4 | 0) + (h.tideTier || 0) * 2, 0.5 + (h.tideTier || 0) * 0.2); }
  };

  const blendShare = () => { const d2 = h.pos.distanceToSquared(h.prev); return d2 > 1e-8 ? clamp(Math.sqrt(h.drawPos.distanceToSquared(h.prev) / d2), 0, 1) : 1; };
  h.animate = (dt) => {
    h.bodyPitch = h.state === 'attack' || h.state === 'parry' ? h.pitchT * 0.7 : h.pitchT;
    // the heading drawn between the last two steps, as position is, so a frame that ran no step or two doesn't stutter
    const a = G.alpha !== undefined ? G.alpha : blendShare();
    h.drawHeading = (h.prevHeading === undefined ? h.heading : h.prevHeading + wrap(h.heading - h.prevHeading) * a);
    body.draw(dt); if (wake) wake.update(dt);
    G.heroScales.value = G.look.lookName === 'painted' ? 0 : 1;
    G.heroGlow.value = damp(G.heroGlow.value, h.state === 'attack' ? 3.4 : h.speed > 11 ? 2.2 : 1.1, 10, dt);
    if (bones.weapon && bones.weapon_tip) {
      bones.weapon_tip.getWorldPosition(tipW); bones.weapon.getWorldPosition(midW); midW.lerp(tipW, 0.5);
      G.fx.pushTrail(tipW, midW, h.state === 'attack' ? 1 : 0);
    }
    G.ui.hurt(Math.max(0, 1 - h.hp / (h.maxHp * 0.4)) * 0.7 + (h.inv > 0.2 ? 0.4 : 0));
  };

  // ------------------------------------------------------------------ the camera: a spring arm behind the look. The player turns it directly, so yaw and pitch have no lag; the
  // pivot rides a tight follower (it takes the footsteps' bob out, not the run); the arm's length is on a slow one; a swept probe pulls it in at once, and it springs back out.
  const C = { pivot: second({ f: 4.5, z: 1, r: 2 }), arm: second({ f: 1.0, z: 1 }), fov: second({ f: 0.8, z: 1 }), roll: second({ f: 0.6, z: 1 }), lock: second({ f: 0.9, z: 1 }), out: second({ f: 1.6, z: 1 }), aside: second({ f: 1.4, z: 1 }), quick: second({ f: 4, z: 1 }), shot: second({ f: 2.2, z: 1 }) };
  const S = { pivot: follower({ x: 0, y: 0, z: 0 }), arm: follower(4.4), fov: follower(62), roll: follower(0), lock: follower({ x: 0, y: 0, z: 0 }), out: follower(4.4), aside: follower(0), up: follower(0), crest: follower(0), arc: follower(0) };
  let shotK = 0, shotSide = 1; const shotP = new THREE.Vector3();
  const HOLD_SHARE = 0.55, HOLD_RATE = 4;    // in a fight the look turns toward a target further off centre than this share of the half frame, at this rate, radians a second
  const ROOM = 2.6, AVOID = [[0.5, 0], [-0.5, 0], [0.95, 0], [-0.95, 0], [0, 0.7], [1.4, 0], [-1.4, 0], [0.7, 0.7], [-0.7, 0.7], [0, -0.3], [0.7, -0.3], [-0.7, -0.3], [0, 2], [1.6, 0.7], [-1.6, 0.7], [1.4, -0.3], [-1.4, -0.3], [2.2, 0], [-2.2, 0], [0, -0.6], [0.7, -0.6], [-0.7, -0.6], [0, 6], [2.2, -0.3], [-2.2, -0.3], [3.14, 0.7], [3.14, -0.3]], ARM_R = 0.25, KEEP = 0.8, BAND = 0.3, MIN_ARM = 1.7, CUT_ARM = 1.2, RIDE_ARM = 9.5, RIDE_LIFT = 2.4;       // ROOM: the arm that's long enough, metres; AVOID: the turns tried, yaw and a rise, smallest first
  let avoidI = -1, avoidT = 0, lensUp = true, wasNear = false; const probe = { x: 0, y: 0, z: 0 }, from = { x: 0, y: 0, z: 0 }, to = { x: 0, y: 0, z: 0 }, camP = new THREE.Vector3(), tv3 = new THREE.Vector3(), CAM_R = 0.55; let shakeA = 0, camReady = false;   // CAM_R: more than twice the near plane, the standard's bound
  G.shake = (a) => { if (G.settings?.shake !== false) shakeA = Math.min(1, Math.max(shakeA, a)); };
  G.camYaw = 0; G.camPitch = -0.05;
  function clearArm(px, py, pz, dx, dy, dz, want) {       // how far back the arm can go along (dx, dy, dz) before it meets anything: A5
    if (G.world.sweep) {
      from.x = px; from.y = -pz; from.z = py; to.x = px + dx * want; to.y = -(pz + dz * want); to.z = py + dy * want;
      const hit = G.world.sweep(from, to, ARM_R); return hit ? Math.max(0.5, hit.t * want) : want;
    }
    const step = 0.42; let d = 0.7;
    for (; d < want + step; d += step) {
      const s = Math.min(d, want); probe.x = px + dx * s; probe.y = -(pz + dz * s); probe.z = py + dy * s;
      if (G.world.collide(probe, CAM_R)) return Math.max(0.5, s - step);
      if (s >= want) break;
    }
    return want;
  }
  h.camera = (dt) => {
    const cam = G.camera, fight = h.combatT < 2.6, tgt = fight && h.target && h.target.pos ? h.target.pos : null;
    if (!camReady) { S.pivot = follower({ x: h.drawPos.x, y: h.drawPos.y + 0.5, z: h.drawPos.z }); camReady = true; }
    if (tgt) { const off = wrap(Math.atan2(tgt.x - h.drawPos.x, tgt.z - h.drawPos.z) - G.camYaw), far = Math.abs(off) - HOLD_SHARE * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect); if (far > 0 && Math.hypot(tgt.x - h.drawPos.x, tgt.z - h.drawPos.z) > 1.6) G.camYaw = wrap(G.camYaw + Math.sign(off) * Math.min(far, HOLD_RATE * dt)); }
    const tier = !h.land && !h.air ? h.tideTier || 0 : 0;
    const wet = !h.land && !h.air && h.state !== 'surf', tight = wet ? 1 - (cam.aspect >= 1 ? 0.47 : 0.13) * smooth(1.5, 7, h.speed) : 1, goal = (h.carried ? h.carried.arm : h.ride ? RIDE_ARM : (fight ? 5.2 : 3.9) + tier * 0.25 + clamp(h.speed - 7, 0, 10) * (wet ? 0.02 : 0.06) + h.surge * (h.land ? 0.15 : wet ? 0.2 : 1.2) + (cam.aspect < 1 ? 0.5 : 0)) * tight;
    const armWant = chase(C.arm, S.arm, goal, dt);
    // in a fight the frame opens to hold him and what he's fighting
    const lx = tgt ? clamp((tgt.x - h.drawPos.x) * 0.26, -2.2, 2.2) : 0, ly = tgt ? clamp((tgt.y - h.drawPos.y) * 0.2, -1, 1) : 0, lz = tgt ? clamp((tgt.z - h.drawPos.z) * 0.26, -2.2, 2.2) : 0;
    const lk = chase(C.lock, S.lock, { x: lx, y: ly, z: lz }, dt);
    const piv = chase(C.pivot, S.pivot, { x: h.drawPos.x, y: h.drawPos.y + 0.5 - (h.carried ? h.carried.drop || 0 : 0), z: h.drawPos.z }, dt);      // the arm hangs from his chest: the lock turns the lens toward what he's fighting, it doesn't move the arm
    const cp = Math.cos(G.camPitch), dx = -Math.sin(G.camYaw) * cp, dy = -Math.sin(G.camPitch), dz = -Math.cos(G.camYaw) * cp;
    // over the right shoulder and a little above, so a swimmer reads as a whole body, never a pair of feet
    const sh = (fight ? 0.35 : 0.6) * (1 - smooth(6, 12, h.speed)), lift = ((fight ? 0.9 : 1.15) + (wet ? 0.8 * smooth(3, 12, h.speed) : 0) + (h.ride ? RIDE_LIFT : 0) - tier * 0.1) * tight; let bx = dx * armWant - Math.cos(G.camYaw) * sh, bz = dz * armWant + Math.sin(G.camYaw) * sh, by = dy * armWant + lift, bl = Math.hypot(bx, by, bz) || 1;
    // something close behind him (a column in a fight): the arm swings round it, the smallest turn that gives him room, so the lens doesn't end up sitting on his back
    // the arm starts from a point clear of what he's beside: a sphere that starts in contact would read every way as blocked
    probe.x = h.drawPos.x; probe.y = -h.drawPos.z; probe.z = h.drawPos.y + 0.5; G.world.collide(probe, ARM_R + 0.05); const ox = probe.x, oy = probe.z, oz = -probe.y;
    bx += piv.x - ox; by += piv.y - oy; bz += piv.z - oz; bl = Math.hypot(bx, by, bz) || 1;       // from his chest itself to where the lens would be: what the arm has to clear is what's between those two
    // the ground rising between his chest and the lens: the lens goes up over it as he goes, instead of the arm snapping in, and comes back on a spring
    { let need = 0; for (let i = 2; i <= 10; i++) { const t = i / 10, over = terrain(ox + bx * t, oz + bz * t) + ARM_R + 0.12 - (oy + by * t); if (over > 0) need = Math.max(need, over / t); }
      const crest = need >= S.crest.y ? (S.crest = follower(need), need) : chase(C.aside, S.crest, need, dt); if (crest > 1e-3) { by += crest; bl = Math.hypot(bx, by, bz) || 1; } }
    let ux = bx / bl, uy = by / bl, uz = bz / bl, aside = 0, over = 0; const roomy = Math.min(bl, ROOM), first_ = clearArm(ox, oy, oz, ux, uy, uz, bl);
    if (first_ < roomy) {        // the turn in use while it serves; else the smallest that gives him room; nowhere has room: the longest there is
      const reach = (k) => { const [yw, ov] = AVOID[k], c = Math.cos(yw), sn = Math.sin(yw), vx = ux * c + uz * sn, vz = uz * c - ux * sn, l = Math.hypot(vx, uy + ov, vz); return clearArm(ox, oy, oz, vx / l, (uy + ov) / l, vz / l, bl); };
      if (--avoidT <= 0 && (avoidI < 0 || reach(avoidI) < roomy)) { let best = first_ + 0.5; avoidI = -1; avoidT = 4; for (let i = 0; i < AVOID.length; i++) { const f = reach(i); if (f >= roomy) { avoidI = i; avoidT = 0; break; } if (f > best) { best = f; avoidI = i; } } }      // nowhere with room: it looks again in a few frames, not every frame
      if (avoidI >= 0) { aside = AVOID[avoidI][0]; over = AVOID[avoidI][1]; }
    } else avoidI = -1;
    if (S.out.y < CUT_ARM && avoidI >= 0) { S.aside = follower(aside); S.up = follower(over); }        // the lens on his chest: a cut to where it can stand beats anything eased
    const near = S.out.y < MIN_ARM; if (near !== wasNear) { wasNear = near; S.out = follower(S.out.y); S.aside = follower(S.aside.y); S.up = follower(S.up.y); }      // a follower can't change its rate mid-run: it's seated afresh on where it is
    const swung = chase(near ? C.quick : C.aside, S.aside, aside, dt), up = chase(near ? C.quick : C.aside, S.up, over, dt); if (Math.abs(swung) + Math.abs(up) > 1e-3) { const c = Math.cos(swung), sn = Math.sin(swung), vx = ux * c + uz * sn, vz = uz * c - ux * sn, l = Math.hypot(vx, uy + up, vz); ux = vx / l; uy = (uy + up) / l; uz = vz / l; }
    // pulled in at once by anything between him and the lens; back out on a spring
    const free = clearArm(ox, oy, oz, ux, uy, uz, bl); if (S.out.y < CUT_ARM && free > S.out.y + 0.6) S.out = follower(Math.min(free, ROOM));
    const out = free < S.out.y ? (S.out = follower(free), free) : chase(near ? C.quick : C.out, S.out, free, dt), use = clamp(out, 0.3, bl);
    camP.set(ox + ux * use, oy + uy * use, oz + uz * use);
    // down in the water the lens stays under; floating at the surface it rides above, and between the two it goes over smoothly with his depth
    h.lensHold = Math.max(0, (h.lensHold || 0) - dt);       // going in, the lens stays up for the splash, then follows him down
    if (!h.air && !h.land && h.state !== 'surf' && !h.porpoise && !(h.lensHold > 0) && camP.y > -0.25) { const under = smooth(0.7, 1.6, -h.pos.y); camP.y += (-0.25 - camP.y) * under; }
    // a leap is shot from the water, as a dolphin is filmed: low, off to one side and a little behind, tilted up, so he rises large against the sky and the horizon. If anything stands in the way, or he's gone under, it's back to the arm: a cut, so the lens doesn't drift down through the water line
    { const c = h.carried, on = h.breach || h.porpoise || h.lensHold > 0 || (c && c.low), H = c && c.low ? 0 : h.shotH || 6, far = c && c.low ? c.low : SHOT_FAR + H * SHOT_RISE; let wants = false;
      if (on) { const w = waveY(h.drawPos.x, h.drawPos.z) + SHOT_LOW, yaw = h.shotYaw ?? h.heading;
        const place = (sd) => { const a = yaw + sd * SHOT_AWAY; shotP.set(h.drawPos.x + Math.sin(a) * far, w, h.drawPos.z + Math.cos(a) * far); const dx = shotP.x - ox, dy = shotP.y - oy, dz = shotP.z - oz, l = Math.hypot(dx, dy, dz) || 1; return clearArm(ox, oy, oz, dx / l, dy / l, dz / l, l) >= l - 0.2; };
        if (place(shotSide)) wants = true; else if (shotK < 0.05 && place(-shotSide)) { shotSide = -shotSide; wants = true; } }
      if (!wants && !h.air && h.pos.y < -0.3 && shotK > 0) { S.arc = follower(0); shotK = 0; } else shotK = chase(C.shot, S.arc, wants ? 1 : 0, dt);
      if (shotK > 0.001) camP.lerp(shotP, shotK); }
    // the lens is never half in the water: it goes through the surface in a frame, from this far on one side to this far on the other
    { const w = waveY(camP.x, camP.z), d = camP.y - w; if (lensUp && d < -0.1) lensUp = false; else if (!lensUp && d > 0.1) lensUp = true; if (Math.abs(d) < BAND) camP.y = w + (lensUp ? BAND : -BAND); }
    if (h.surge > 0.5 && G.settings?.shake !== false) shakeA = Math.max(shakeA, 0.1 * h.surge);
    if (shakeA > 0.001) { camP.x += (Math.random() - 0.5) * shakeA * 0.28; camP.y += (Math.random() - 0.5) * shakeA * 0.28; shakeA *= Math.exp(-7 * dt); }
    // and pushed clear of anything still near the lens, the ground included; the shake goes first, so it can't shake the lens into anything
    probe.x = camP.x; probe.y = -camP.z; probe.z = camP.y;
    if (G.world.collide(probe, CAM_R)) { camP.set(probe.x, probe.z, -probe.y); for (let i = 0; i < 3 && G.world.collide(probe, CAM_R); i++) { camP.lerp(tv3.set(ox, oy, oz), 0.5); probe.x = camP.x; probe.y = -camP.z; probe.z = camP.y; } if (G.world.collide(probe, CAM_R)) camP.set(probe.x, probe.z, -probe.y); }      // a gap too tight to clear: in toward the pivot, which is clear
    cam.position.copy(camP);
    const roll = chase(C.roll, S.roll, -h.bank * 0.12, dt);
    cam.up.set(Math.sin(roll), Math.cos(roll), 0).normalize();
    // he never leaves the frame, whatever a lock or a swing asks: the look turns back until his chest is inside this share of the frame's half height or half width
    let tx = piv.x + lk.x + Math.sin(G.camYaw) * 1.4, ty = piv.y + lk.y + Math.sin(G.camPitch) * 1.4, tz = piv.z + lk.z + Math.cos(G.camYaw) * 1.4;
    if (shotK > 0.001) {        // the same shot's look: up at him, with him high in the frame and the sea and the horizon under him as long as they fit
      const lx = h.drawPos.x + h.vel.x * 0.08 - camP.x, lz = h.drawPos.z + h.vel.z * 0.08 - camP.z, dh = Math.hypot(lx, lz) || 1, elev = Math.atan2(h.drawPos.y + 0.5 - camP.y, dh), aim = elev - Math.min(Math.max(elev, 0) * 0.6, SHOT_HIGH);
      tx += (camP.x + lx - tx) * shotK; ty += (camP.y + Math.tan(aim) * dh - ty) * shotK; tz += (camP.z + lz - tz) * shotK;
    }
    { const p = cam.position, ax = tx - p.x, ay = ty - p.y, az = tz - p.z, al = Math.hypot(ax, ay, az) || 1, cx = h.drawPos.x - p.x, cy = h.drawPos.y + 0.5 - p.y, cz = h.drawPos.z - p.z, cl = Math.hypot(cx, cy, cz) || 1, half = (cam.fov * Math.PI) / 360, most = Math.min(half, Math.atan(Math.tan(half) * cam.aspect)) * KEEP, ang = Math.acos(clamp((ax * cx + ay * cy + az * cz) / (al * cl), -1, 1));
      if (ang > most) { const k = most / ang; tx = p.x + ((cx / cl) * (1 - k) + (ax / al) * k) * al; ty = p.y + ((cy / cl) * (1 - k) + (ay / al) * k) * al; tz = p.z + ((cz / cl) * (1 - k) + (az / al) * k) * al; } }
    cam.lookAt(tx, ty, tz);
    const fov = chase(C.fov, S.fov, shotK > 0.5 ? (cam.aspect < 1 ? 62 : SHOT_FOV) : (cam.aspect < 1 ? 70 : 58) + clamp(h.speed - 7, 0, 12) * (wet ? 0.3 : 0.8) + h.surge * (h.land ? 3 : wet ? 6 : 16) + tier * 1.5, dt);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
  };

  h.prev.copy(h.pos); h.drawPos.copy(h.pos);
  h.place = () => { h.prev.copy(h.pos); h.drawPos.copy(h.pos); wallCut = false; camReady = false; S.arm = follower(3.9); S.out = follower(3.9); body.place(); };
  return h;
}
