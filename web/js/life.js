// What swims. Every animal moves as its species does, in the vertex shader:
//   fish and sharks bend side to side, stiff at the head, amplitude growing to the tail;
//   whales and dolphins beat their flukes up and down, in slow powerful strokes;
//   a manta flies, a wave running from the shoulder to the wing tip;
//   a turtle rows with its long front flippers and glides between strokes;
//   a jelly pulses, tentacles trailing.
// Speed comes from behaviour: cruise, turn, a startled burst. A tail's beat follows the speed. A school turns like one body: each fish
// follows the same curve a moment later than the one ahead, so a turn passes through the school as a wave.
//   life.update(dt, focus) · life.scatter(pos, radius) · life.whales[i].pos, .dir · life.pods[i].pos, .dir   (all three.js coordinates, live)
import * as THREE from 'three';
import { W } from './config.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const PARS = /* glsl */`
  attribute vec4 aAnim;     // phase, amount, turn, spare
  uniform vec4 uBody;       // z of the nose, length, half span, height`;

const BEND = {
  // side to side: a wave runs nose to tail; the head yaws only a little against it
  lateral: /* glsl */`
    { float s = clamp((uBody.x - transformed.z)/uBody.y, 0.0, 1.0);
      float amp = (.008 + .026*s + .092*s*s)*aAnim.y;
      float wv = sin(TAU_*s*1.05 - aAnim.x);
      float turn = aAnim.z*s*s*.26 + aAnim.z*(1.0 - s)*(1.0 - s)*.05;
      transformed.x += uBody.y*(amp*wv + turn);
      transformed.x += uBody.y*.010*(1.0 - s)*(1.0 - s)*sin(aAnim.x + 1.2)*aAnim.y;
    }`,
  // up and down: the stroke lives in the rear third, the flukes lag the peduncle
  fluke: /* glsl */`
    { float s = clamp((uBody.x - transformed.z)/uBody.y, 0.0, 1.0);
      float amp = (.003 + .012*s*s + .085*s*s*s*s)*aAnim.y;
      transformed.y += uBody.y*amp*sin(TAU_*s*.56 - aAnim.x);
      float fl = smoothstep(.80, 1.0, s);
      transformed.y += uBody.y*.022*fl*fl*sin(TAU_*.62 - aAnim.x - 1.0)*aAnim.y;
      transformed.y += uBody.y*.0035*(1.0 - s)*sin(aAnim.x + 2.4)*aAnim.y;
      transformed.x += uBody.y*aAnim.z*s*s*.13;
    }`,
  // a flying wing: lift starts at the shoulder and travels to the tip, the front edge leading
  manta: /* glsl */`
    { float w = clamp(abs(transformed.x)/uBody.z, 0.0, 1.0);
      float s = clamp((uBody.x - transformed.z)/uBody.y, 0.0, 1.0);
      float k = smoothstep(.10, .95, w);
      float ph = aAnim.x - w*2.3 - s*1.3;
      transformed.y += uBody.z*aAnim.y*k*(.16 + .30*w)*sin(ph);
      transformed.x -= sign(transformed.x)*uBody.z*.05*k*k*(1.0 - cos(ph))*.5;
      transformed.z += uBody.z*.05*k*cos(ph)*aAnim.y;
      float tail = smoothstep(.68, 1.0, s)*(1.0 - k);
      transformed.y += uBody.y*.05*tail*sin(aAnim.x*.5 - s*6.0);
      transformed.x += uBody.y*aAnim.z*s*s*.08;
    }`,
  // a walker's legs: each side steps in turn, lifted and swung; aAnim.y is 0 at rest
  crawl: /* glsl */`
    { float k = smoothstep(.34, .78, clamp(abs(transformed.x)/uBody.z, 0.0, 1.0));
      float ph = aAnim.x + transformed.z*5.0/uBody.y + step(0.0, transformed.x)*3.14159;
      transformed.y += uBody.w*.14*k*max(sin(ph), 0.0)*aAnim.y;
      transformed.z += uBody.w*.12*k*cos(ph)*aAnim.y;
    }`,
  // a grazer: the neck goes down to the grass; aAnim.z is how far, aAnim.y its walk
  graze: /* glsl */`
    { float s = clamp((transformed.z - (uBody.x - uBody.y*.36))/(uBody.y*.36), 0.0, 1.0);
      transformed.y -= s*s*uBody.w*.62*aAnim.z;
      transformed.z -= s*s*uBody.w*.10*aAnim.z;
      float low = 1.0 - smoothstep(.0, .42, transformed.y/uBody.w);       // the legs
      transformed.z += low*uBody.w*.10*sin(aAnim.x + transformed.z*7.0/uBody.y + step(0.0, transformed.x)*3.14159)*aAnim.y;
    }`,
  // a shell that breathes along its axis: the jets are what move it
  pulse: /* glsl */`
    { transformed *= 1.0 + .035*sin(aAnim.x)*aAnim.y; transformed.y += uBody.w*.03*sin(aAnim.x*.5)*aAnim.y; }`,
  // rowing: long front flippers swing about the shoulder; the rear ones steer. aAnim.x = flipper angle, aAnim.y = sweep
  turtle: /* glsl */`
    { float sgn = sign(transformed.x);
      float front = smoothstep(uBody.x - uBody.y*.66, uBody.x - uBody.y*.42, transformed.z);
      float dx = max(abs(transformed.x) - uBody.z*.36, 0.0);
      float w = front*smoothstep(0.0, uBody.z*.12, dx);
      float d0 = dx*w;
      transformed.y += d0*sin(aAnim.x);
      transformed.x -= sgn*d0*(1.0 - cos(aAnim.x));
      transformed.z -= d0*sin(aAnim.y)*.85;
      float rear = (1.0 - smoothstep(uBody.x - uBody.y*.82, uBody.x - uBody.y*.60, transformed.z));
      float dr = max(abs(transformed.x) - uBody.z*.22, 0.0)*rear;
      transformed.y += dr*sin(aAnim.x*.35 + 1.0)*.5;
      float neck = smoothstep(uBody.x - uBody.y*.22, uBody.x, transformed.z);
      transformed.y += neck*uBody.y*.02*sin(aAnim.x*.5);
      transformed.x += uBody.y*aAnim.z*neck*.05;
    }`,
};

const JELLY_V = /* glsl */`
  attribute vec4 aJelly;
  uniform vec4 uBody;
  uniform vec4 uFlee;`;

// A stand-in body, real size, while creatures.glb is on its way: an ellipsoid with its nose at +z.
function standInBody(name) {
  const SZ = { fish_a: [.08, .16, .45], fish_b: [.1, .2, .6], fish_c: [.14, .3, .8], whale: [3.2, 3.6, 26], dolphin: [.5, .55, 2.6], shark: [.7, .9, 4.2], reef_shark: [.5, .6, 2.6], manta: [3.2, .4, 3.4], turtle: [.8, .3, 1.2], jelly: [.6, .9, .6] };
  const s = SZ[name] || [.5, .5, 1.5];
  const g = new THREE.SphereGeometry(1, 20, 24).rotateX(Math.PI / 2).scale(s[0], s[1], s[2] / 2);
  const c = new Float32Array(g.attributes.position.count * 3).fill(.5); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

export function createLife({ scene, look, world, tier = 'phone', camera }) {
  const phone = tier === 'phone';
  const data = world.data, U = look.uniforms;

  const body = (name) => {
    const G = world.creatures && world.creatures[name];
    const g = G || standInBody(name);
    g.computeBoundingBox();
    const b = g.boundingBox, L = b.max.z - b.min.z;
    const span = Math.max(Math.abs(b.min.x), Math.abs(b.max.x)), hgt = b.max.y - b.min.y;
    return { g, uBody: new THREE.Vector4(b.max.z, L, span, hgt), L };
  };
  const skin = (gloss) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: gloss, metalness: .0, envMapIntensity: 1 });

  // ---------------------------------------------------------------- individuals: an agent with a behaviour, a body in an instanced mesh
  const SP = {
    whale:      { mode: 'fluke',   cruise: 3.4, burst: 6,   beat: .062, amt: 1.0, caus: 2.4, reach: 340, turn: .10, gloss: .52, size: 1.34 },
    dolphin:    { mode: 'fluke',   cruise: 7.5, burst: 12,  beat: .30,  amt: 1.0, caus: 1.6, reach: 200, turn: 1.1, gloss: .30 },
    shark:      { mode: 'lateral', cruise: 3.0, burst: 9,   beat: .42,  amt: 1.0, caus: 1.4, reach: 200, turn: .7,  gloss: .50 },
    reef_shark: { mode: 'lateral', cruise: 2.6, burst: 9,   beat: .52,  amt: 1.0, caus: 1.4, reach: 180, turn: .9,  gloss: .50 },
    manta:      { mode: 'manta',   cruise: 2.3, burst: 5.5, beat: .13,  amt: 1.0, caus: 1.8, reach: 220, turn: .25, gloss: .60 },
    turtle:     { mode: 'turtle',  cruise: 1.1, burst: 3.2, beat: .17,  amt: 1.0, caus: 1.6, reach: 160, turn: .35, gloss: .42 },
    // the second cast
    hammerhead: { mode: 'lateral', cruise: 3.1, burst: 9,   beat: .40,  amt: 1.0, caus: 1.4, reach: 190, turn: .7,  gloss: .48 },
    barracuda:  { mode: 'lateral', cruise: 3.4, burst: 11,  beat: .62,  amt: .8,  caus: 1.4, reach: 130, turn: .9,  gloss: .34 },
    moray:      { mode: 'lateral', cruise: 0,   burst: 0,   beat: .30,  amt: 1.0, caus: 1.2, reach: 70,  turn: .5,  gloss: .50 },
    ember_eel:  { mode: 'lateral', cruise: 0,   burst: 0,   beat: .30,  amt: 1.0, caus: 1.0, reach: 110, turn: .5,  gloss: .46, glow: true },
    anglerfish: { mode: 'lateral', cruise: .8,  burst: 3,   beat: .55,  amt: .7,  caus: 1.0, reach: 110, turn: .4,  gloss: .34, glow: true },
    parrotfish: { mode: 'lateral', cruise: 1.2, burst: 5,   beat: .80,  amt: .8,  caus: 1.6, reach: 90,  turn: 1.0, gloss: .36 },
    narwhal:    { mode: 'fluke',   cruise: 4.0, burst: 9,   beat: .22,  amt: 1.0, caus: 1.6, reach: 230, turn: .5,  gloss: .46 },
    seal:       { mode: 'fluke',   cruise: 4.4, burst: 10,  beat: .52,  amt: 1.0, caus: 1.6, reach: 170, turn: 1.5, gloss: .32 },
    nautilus:   { mode: 'pulse',   cruise: .55, burst: 2,   beat: .34,  amt: 1.0, caus: 1.2, reach: 80,  turn: .3,  gloss: .30 },
    gull:       { mode: 'manta',   cruise: 8.5, burst: 12,  beat: .22,  amt: 1.0, caus: 1.0, reach: 230, turn: 1.0, gloss: .70, size: 1.5 },
    sea_otter:  { mode: 'fluke',   cruise: .3,  burst: 1,   beat: .12,  amt: .4,  caus: 1.2, reach: 110, turn: .3,  gloss: .58 },
    crab:       { mode: 'crawl',   cruise: 1.1, burst: 2.6, beat: 1.4,  amt: 1.0, caus: 1.2, reach: 44,  turn: 1.5, gloss: .40 },
    giant_crab: { mode: 'crawl',   cruise: .7,  burst: 2,   beat: .55,  amt: 1.0, caus: 1.2, reach: 150, turn: .8,  gloss: .44 },
    goat:       { mode: 'graze',   cruise: .8,  burst: 3,   beat: 1.1,  amt: 1.0, caus: 1.0, reach: 120, turn: 1.0, gloss: .74 },
  };
  const herds = {};
  function herd(kind, n) {
    if (herds[kind]) return herds[kind];
    const sp = SP[kind] || SP.reef_shark, B = body(kind);
    const geo = B.g.clone(); geo.setAttribute('aAnim', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const uBody = { value: B.uBody };
    const mat = look.patch(skin(sp.gloss), {
      key: 'body-' + sp.mode + (sp.glow ? '-glow' : ''), caustic: sp.caus, causticDepth: sp.mode === 'fluke' ? .46 : .7,
      skin: kind === 'whale' ? 'whale' : kind === 'dolphin' ? 'dolphin' : /shark/.test(kind) ? 'shark' : null, body: B.uBody,
      vertexPars: PARS + '\n#define TAU_ 6.2831853\n', uniforms: { uBody },
      vertexBend: BEND[sp.mode], glow: sp.glow ? 'ocGlow = vColor.rgb*4.2*smoothstep(.90, .97, max(max(vColor.r, vColor.g), vColor.b))*(.7 + .3*ocPulse);' : undefined,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false; mesh.name = 'life_' + kind;
    scene.add(mesh);
    let far = null;
    const FG = world.creatures && world.creatures[kind + '__far'];
    if (FG) {
      const fg = FG.clone(); fg.setAttribute('aAnim', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
      const fm = new THREE.InstancedMesh(fg, mat, n);
      fm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); fm.frustumCulled = false; fm.count = 0; fm.visible = false; fm.name = 'life_' + kind + '__far';
      scene.add(fm); far = { mesh: fm, anim: fg.attributes.aAnim };
    }
    return (herds[kind] = { kind, sp, B, mesh, far, agents: [], anim: geo.attributes.aAnim });
  }
  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), M = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

  function agent(kind, pos, n) {
    const h = herd(kind, n);
    const a = {
      kind, pos: pos.clone(), dir: new THREE.Vector3(Math.random() - .5, 0, Math.random() - .5).normalize(), speed: h.sp.cruise, target: h.sp.cruise,
      home: pos.clone(), radius: 40, way: pos.clone(), wayT: 0, phase: Math.random() * TAU, amt: 1, turn: 0, bank: 0, fear: 0, seed: Math.random(), glide: 0,
      flipA: 0, flipB: 0, stroke: Math.random(),
    };
    h.agents.push(a);
    return a;
  }

  const cnt = {};
  const needed = (k, n) => { cnt[k] = (cnt[k] || 0) + n; };
  // The company a camera keeps: see keepCompany. How many of each can be about at once, and who's about in which water.
  const BAND = phone ? { turtle: 3, manta: 3, parrotfish: 4, reef_shark: 2, barracuda: 3, hammerhead: 1, anglerfish: 2, nautilus: 2, seal: 3, narwhal: 1 } : { turtle: 4, manta: 4, parrotfish: 6, reef_shark: 3, barracuda: 4, hammerhead: 2, anglerfish: 3, nautilus: 3, seal: 4, narwhal: 2 };
  const ALONG = [                                                         // reef, kelp, city, trench, cinder, ice, wrack
    ['turtle', 'manta', 'parrotfish', 'turtle', 'parrotfish', 'manta', 'reef_shark', 'parrotfish', 'turtle'],
    ['turtle', 'parrotfish', 'manta', 'barracuda', 'parrotfish', 'reef_shark', 'turtle', 'barracuda'],
    ['reef_shark', 'barracuda', 'manta', 'turtle', 'barracuda', 'hammerhead', 'parrotfish'],
    ['manta', 'hammerhead', 'reef_shark', 'barracuda', 'anglerfish', 'nautilus', 'manta'],
    ['anglerfish', 'nautilus', 'reef_shark', 'anglerfish', 'barracuda', 'nautilus'],
    ['seal', 'narwhal', 'seal', 'turtle', 'seal', 'manta'],
    ['barracuda', 'anglerfish', 'reef_shark', 'hammerhead', 'nautilus', 'barracuda', 'anglerfish'],
  ];
  const GULLS = phone ? 7 : 12, ESCORT = phone ? 5 : 6, BOATS = phone ? 3 : 5, FAR2 = phone ? 14 * 14 : 3600;      // (a fish's near mesh is 700 triangles and it's a few dozen pixels long)
  for (const k in BAND) needed(k, BAND[k]);
  needed('gull', GULLS); needed('dolphin', ESCORT); needed('whale', 1);
  for (const d of data.drifters || []) if (d.kind !== 'jelly') needed(d.kind, d.n);
  needed('whale', (data.whales || []).length);
  const podList = data.pods || [{ id: 'open_blue', x: 420, y: -80, z: -3, n: 6, r: 130 }];
  for (const p of podList) needed('dolphin', p.n || 5);
  const sharkList = data.sharks || [{ x: 60, y: -360, z: -20, n: 3, r: 90 }, { x: -120, y: -300, z: -24, n: 2, r: 80 }, { x: 300, y: -220, z: -30, n: 2, r: 110 }];
  for (const s of sharkList) needed('reef_shark', s.n || 1);
  for (const e of data.life || []) needed(e.kind, e.pts ? e.pts.length : e.n || 1);

  // Drifters.
  for (const d of data.drifters || []) {
    if (d.kind === 'jelly') continue;
    for (let i = 0; i < d.n; i++) {
      const a = agent(d.kind, W(d.x + (Math.random() - .5) * d.r, d.y + (Math.random() - .5) * d.r, d.z), cnt[d.kind]);
      a.home.copy(W(d.x, d.y, d.z)); a.radius = d.r;
    }
  }
  for (const s of sharkList) for (let i = 0; i < (s.n || 1); i++) {
    const a = agent('reef_shark', W(s.x + (Math.random() - .5) * s.r, s.y + (Math.random() - .5) * s.r, s.z), cnt.reef_shark);
    a.home.copy(W(s.x, s.y, s.z)); a.radius = s.r || 80;
  }

  // The second cast: world.json's `life`. Swimmers roam a home like the drifters; the rest keep to a place of their own (stepCast).
  const STAYS = { lurk: 1, crawl: 1, raft: 1, soar: 1, graze: 1 };
  for (const e of data.life || []) {
    const n = e.pts ? e.pts.length : e.n || 1;
    for (let i = 0; i < n; i++) {
      const q = e.pts && e.pts[i];
      const a = agent(e.kind, q ? W(q[0], q[1], q[2]) : W(e.x + (Math.random() - .5) * e.r, e.y + (Math.random() - .5) * e.r, e.z), cnt[e.kind]);
      if (q) { a.dir.set(Math.sin(q[3] || 0), 0, Math.cos(q[3] || 0)); a.home.copy(a.pos); a.radius = 7; } else { a.home.copy(W(e.x, e.y, e.z)); a.radius = e.r; }
      if (STAYS[e.mode]) { a.mode = e.mode; a.speed = 0; a.ang = Math.random() * TAU; a.sense = Math.random() < .5 ? 1 : -1; a.moving = false; a.wayT = Math.random() * 3; a.neck = 0; }
    }
  }

  // Whales keep to their closed paths.
  const whales = (data.whales || []).map((w) => {
    const curve = new THREE.CatmullRomCurve3(w.path.map(p => W(p[0], p[1], p[2])), true, 'centripetal');
    const pts = curve.getSpacedPoints(600), len = curve.getLength();
    const a = agent('whale', pts[0], cnt.whale);
    a.path = pts; a.pathLen = len; a.u = Math.random();
    a.pos0 = () => a.pos;
    return { agent: a, pos: a.pos, dir: a.dir, get speed() { return a.speed; }, get length() { return herds.whale.B.L * SP.whale.size; } };
  });
  whales.forEach((w, i) => { const a = w.agent; const f = a.u * 600 | 0; a.pos.copy(a.path[f]); a.dir.subVectors(a.path[(f + 3) % 600], a.path[f]).normalize(); });

  // A dolphin pod runs a loop near the surface; each animal porpoises, and every few seconds the pod leaps.
  const pods = podList.map((p, pi) => {
    const n = p.n || 5, list = [];
    const curve = p.path ? new THREE.CatmullRomCurve3(p.path.map(q => W(q[0], q[1], -2.5)), true, 'centripetal') : null;
    const pts = curve ? curve.getSpacedPoints(600) : null;
    const pod = { list, curve, pts, u: Math.random(), c: W(p.x ?? 0, p.y ?? 0, -2.5), r: p.r || 120, clock: Math.random() * 10, len: curve ? curve.getLength() : TAU * (p.r || 120) };
    for (let i = 0; i < n; i++) {
      const a = agent('dolphin', pod.c, cnt.dolphin);
      a.podOff = new THREE.Vector3((i % 3 - 1) * 3.4 + (Math.random() - .5), 0, -((i / 2 | 0)) * 3.8 + (Math.random() - .5));
      a.podPh = Math.random() * .08 + i * .018; a.last = a.pos.clone(); list.push(a);
    }
    return { ...pod, pod, pos: list[0].pos, dir: list[0].dir };
  });
  const podCentre = new THREE.Vector3(), podDir = new THREE.Vector3(), podRt = new THREE.Vector3();
  function stepPod(entry, dt) {
    const pod = entry.pod;
    pod.clock += dt;
    const v = 8.5;
    pod.u = (pod.u + dt * v / pod.len) % 1;
    if (pod.pts) {
      const f = pod.u * 600, i = f | 0, a = pod.pts[i % 600], b = pod.pts[(i + 1) % 600];
      podCentre.lerpVectors(a, b, f - i); podDir.subVectors(b, a).normalize();
    } else {
      const t = pod.u * TAU; podCentre.set(pod.c.x + Math.cos(t) * pod.r, 0, pod.c.z + Math.sin(t) * pod.r * .7); podDir.set(-Math.sin(t), 0, Math.cos(t) * .7).normalize();
    }
    podRt.crossVectors(UP, podDir).normalize();
    const T = 8.5;
    for (const a of pod.list) {
      const ph = ((pod.clock / T) + a.podPh) % 1;
      // under at about 3 m, a long rise, then the arc through the air
      let y = -3.1 + Math.sin(ph * TAU * 3) * .35;
      if (ph > .62) { const w = (ph - .62) / .38, arc = Math.sin(Math.PI * smooth(0, 1, w)); y = -3.1 + arc * 7.2; }
      P0.copy(podCentre).addScaledVector(podRt, a.podOff.x).addScaledVector(podDir, a.podOff.z); P0.y = y;
      a.last.copy(a.pos); a.pos.copy(P0);
      P1.subVectors(a.pos, a.last); const m = P1.length();
      if (m > 1e-4) a.dir.lerp(P1.divideScalar(m), 1 - Math.exp(-dt * 7)).normalize();
      a.speed = m / Math.max(dt, 1e-3);
      const air = a.pos.y > 0;
      a.amt = air ? .2 : ph > .55 ? 1.5 : 1.0;               // a hard stroke into the leap, the tail still in the air
      a.phase += dt * TAU * (air ? .4 : SP.dolphin.beat * Math.max(a.speed, 4));
      if (air && !a.flown) { a.flown = true; spray(a.pos, .8); }
      if (!air && a.flown) { a.flown = false; spray(a.pos, 1.3); if (life.onSplash) life.onSplash(a.pos.clone()); }
    }
  }

  // Spray: droplets flung when a body breaks the surface. One draw, ballistic in the shader, written into a ring.
  const spray = (() => {
    const N = phone ? 150 : 260, a = new Float32Array(N * 3), v = new Float32Array(N * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aV', new THREE.BufferAttribute(v, 4).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, N);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, toneMapped: false,
      uniforms: { ocTime: U.ocTime, ocAddGain: U.ocAddGain, uPix: { value: 600 } },
      vertexShader: /* glsl */`
        attribute vec4 aV; uniform float ocTime, ocAddGain, uPix; varying float vA;
        void main() {
          float t = ocTime - aV.w;
          if (t < 0.0 || t > 1.5 || aV.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          vec3 p = position + aV.xyz*t + vec3(0.0, -4.9*t*t, 0.0);
          vec4 mv = viewMatrix*vec4(p, 1.0);
          gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(uPix*.05/max(-mv.z, .5), 1.6, 9.0);
          vA = (1.0 - t/1.5)*smoothstep(-.6, 0.0, p.y)*ocAddGain;
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        void main() { vec2 q = gl_PointCoord*2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard; gl_FragColor = vec4(vec3(.82, .92, .96)*vA*(1.0 - r), 1.0); }`,
    });
    const mesh = new THREE.Points(g, m); mesh.frustumCulled = false; mesh.renderOrder = 23; scene.add(mesh);
    let at = 0;
    return (p, power = 1) => {
      const t = U.ocTime.value, n = Math.round(30 * power);
      for (let i = 0; i < n; i++) {
        const k = at % N, ang = Math.random() * TAU, r = (.8 + Math.random() * 2.4) * power, up = (2.2 + Math.random() * 3.6) * Math.sqrt(power);
        a[k * 3] = p.x + Math.cos(ang) * .5; a[k * 3 + 1] = .05; a[k * 3 + 2] = p.z + Math.sin(ang) * .5;
        v[k * 4] = Math.cos(ang) * r; v[k * 4 + 1] = up; v[k * 4 + 2] = Math.sin(ang) * r; v[k * 4 + 3] = t + Math.random() * .08;
        at++;
      }
      g.attributes.position.needsUpdate = true; g.attributes.aV.needsUpdate = true;
    };
  })();

  // Behaviour: go somewhere, slow into turns, bolt when something comes close.
  const away = new THREE.Vector3(), want = new THREE.Vector3();
  const scareList = [];
  // The ones that don't swim about: a head out of a hole, a walker on the ground, a raft on the swell, a gull on its circle.
  function stepCast(a, h, dt, focus) {
    const sp = h.sp, t = U.ocTime.value, near = focus ? a.pos.distanceTo(focus) : 1e3;
    if (a.mode === 'lurk') {
      a.phase += dt * (near < 7 ? 3.2 : 1.1); a.amt = near < 7 ? 1.3 : .46 + .26 * Math.sin(t * .37 + a.seed * 9); a.turn = Math.sin(t * .23 + a.seed * 20) * .7;
    } else if (a.mode === 'raft') {
      a.pos.x += Math.sin(t * .05 + a.seed * 30) * dt * .22; a.pos.z += Math.cos(t * .04 + a.seed * 17) * dt * .22;
      a.pos.y = (look.waveAt ? look.waveAt(a.pos.x, a.pos.z) : 0) + .04;
      a.phase += dt * .7; a.amt = .4; a.bank = Math.PI + Math.sin(t * .9 + a.seed * 11) * .12;
      a.dir.set(Math.sin(a.ang + t * .03), 0, Math.cos(a.ang + t * .03));
    } else if (a.mode === 'soar') {
      a.ang += dt * sp.cruise / Math.max(a.radius * (.5 + a.seed * .5), 8) * a.sense;
      const r = a.radius * (.5 + a.seed * .5), ca = Math.cos(a.ang), sa = Math.sin(a.ang);
      a.pos.set(a.home.x + ca * r, a.home.y + Math.sin(t * .23 + a.seed * 20) * 5, a.home.z + sa * r);
      a.dir.set(-sa * a.sense, 0, ca * a.sense);
      // flap a few beats, then hold the wings out
      const beat = Math.sin(t * .31 + a.seed * 40) > .35 ? 1 : .12; a.amt += (beat - a.amt) * (1 - Math.exp(-dt * 2.4));
      a.phase += dt * TAU * 2.4 * sp.beat * 3; a.bank = -a.sense * .3;
    } else {                                                            // crawl, graze: short walks and long stops
      a.wayT -= dt;
      const scared = near < (h.kind === 'crab' ? 3.5 : 7);
      if (a.wayT <= 0 || (scared && !a.moving)) {
        a.moving = scared || !a.moving; a.wayT = a.moving ? 1 + Math.random() * 2.6 : 2 + Math.random() * 7;
        if (a.moving) {
          let yaw = Math.random() * TAU;
          if (scared) yaw = Math.atan2(a.pos.x - focus.x, a.pos.z - focus.z);
          else if (a.pos.distanceTo(a.home) > a.radius) yaw = Math.atan2(a.home.x - a.pos.x, a.home.z - a.pos.z);
          a.way.set(Math.sin(yaw), 0, Math.cos(yaw));
        }
      }
      const v = a.moving ? (scared ? sp.burst : sp.cruise) : 0;
      a.speed += (v - a.speed) * (1 - Math.exp(-dt * 5));
      a.pos.addScaledVector(a.way, a.speed * dt);
      a.pos.y = world.heightAt(a.pos.x, -a.pos.z);
      if (h.kind === 'goat') { if (a.speed > .05) a.dir.lerp(a.way, 1 - Math.exp(-dt * 3)).normalize(); a.neck += ((a.moving ? 0 : 1) - a.neck) * (1 - Math.exp(-dt * 1.6)); a.turn = a.neck; }
      else if (h.kind === 'crab' || h.kind === 'giant_crab') { a.dir.set(-a.way.z || a.dir.x, 0, a.way.x || a.dir.z).normalize(); }        // a crab walks sideways
      a.amt += ((a.speed > .08 ? 1 : 0) - a.amt) * (1 - Math.exp(-dt * 6));
      a.phase += dt * TAU * sp.beat * a.speed;
    }
  }
  function stepAgent(a, h, dt, focus) {
    const sp = h.sp;
    if (a.mode) return stepCast(a, h, dt, focus);
    if (a.path) {                                                      // a whale: the path, always; it never hurries
      a.u = (a.u + dt * a.speed / a.pathLen) % 1;
      const f = a.u * 600, i = f | 0, pa = a.path[i % 600], pb = a.path[(i + 1) % 600], pc = a.path[(i + 24) % 600];
      a.pos.lerpVectors(pa, pb, f - i);
      want.subVectors(pc, a.pos).normalize();
      a.speed += (sp.cruise * (1 + .14 * Math.sin(a.seed * 9 + U.ocTime.value * .05)) - a.speed) * dt * .2;
    } else {
      a.wayT -= dt;
      if (a.wayT <= 0 || a.pos.distanceToSquared(a.way) < 16) {
        const r = a.radius; a.wayT = 8 + Math.random() * 16;
        a.way.set(a.home.x + (Math.random() - .5) * r * 1.6, a.home.y + (Math.random() - .5) * Math.min(14, r * .2), a.home.z + (Math.random() - .5) * r * 1.6);
        const g = world.heightAt(a.way.x, -a.way.z) + 2.5; if (a.way.y < g) a.way.y = g; if (a.way.y > -1.5) a.way.y = -1.5;
      }
      want.subVectors(a.way, a.pos).normalize();
      if (focus) {
        away.subVectors(a.pos, focus); const d = away.length();
        const near = h.kind === 'turtle' ? 7 : h.kind === 'manta' ? 11 : 10;
        if (d < near) a.fear = Math.max(a.fear, 1 - d / near * .4);
        if (a.fear > .02) want.lerp(away.divideScalar(Math.max(d, .1)), Math.min(1, a.fear * 1.2)).normalize();
      }
      for (const s of scareList) { away.subVectors(a.pos, s.p); const d = away.length(); if (d < s.r) { a.fear = 1; want.copy(away).divideScalar(Math.max(d, .1)); } }
      a.fear = Math.max(0, a.fear - dt * .42);
      const g = world.heightAt(a.pos.x, -a.pos.z) + 1.6; if (a.pos.y < g + 2) want.y = Math.max(want.y, .35);
      if (a.pos.y > -.8) want.y = Math.min(want.y, -.3);
      want.normalize();
      const bend = 1 - a.dir.dot(want);
      a.target = (sp.cruise * (1 - .35 * smooth(.05, .6, bend))) * (1 - a.fear) + sp.burst * a.fear;
      a.speed += (a.target - a.speed) * (1 - Math.exp(-dt * (a.fear > .1 ? 4.5 : 1.0)));
    }
    // Turn at the species' rate, the body curving into it.
    const rate = sp.turn * (1 + a.fear * 2.5);
    X.crossVectors(a.dir, want);
    const sign = Math.sign(X.y) || 1, err = Math.acos(clamp(a.dir.dot(want), -1, 1));
    a.dir.lerp(want, 1 - Math.exp(-dt * rate * 1.4)).normalize();
    a.turn += ((-sign * Math.min(1, err * 2.2)) - a.turn) * (1 - Math.exp(-dt * 3));
    a.bank += ((sign * Math.min(.5, err) * .5) - a.bank) * (1 - Math.exp(-dt * 1.5));
    if (!a.path) a.pos.addScaledVector(a.dir, a.speed * dt);

    if (sp.mode === 'turtle') {
      // Power stroke, a long glide with the flippers swept back, a quick recovery. Speed follows the stroke.
      const pace = (.09 + a.fear * .55);
      a.stroke = (a.stroke + dt * pace) % 1;
      const p = a.stroke;
      let ang, sweep;
      if (p < .28) { const k = smooth(0, 1, p / .28); ang = .95 - 2.25 * k; sweep = .15 + 1.05 * k; a.glide = 1.9; }
      else if (p < .78) { const k = (p - .28) / .50; ang = -1.3 + .22 * k; sweep = 1.2 - .1 * k; a.glide = 1 - .72 * k; }
      else { const k = smooth(0, 1, (p - .78) / .22); ang = -1.08 + 2.03 * k; sweep = 1.1 - .95 * k; a.glide = .5; }
      a.phase = ang; a.flipB = sweep;
      a.pos.addScaledVector(a.dir, (a.glide - 1) * a.speed * dt);
      a.amt = sweep;
    } else {
      a.amt += ((sp.mode === 'fluke' ? 1 + a.fear * .4 : 1 + a.fear * .8 + Math.abs(a.turn) * .3) - a.amt) * (1 - Math.exp(-dt * 3));
      a.phase += dt * TAU * sp.beat * Math.max(a.speed, sp.cruise * .55);
    }
  }
  function compose(a, h, i, mesh = h.mesh, anim = h.anim) {
    Z.copy(a.dir); X.crossVectors(UP, Z).normalize(); Y.crossVectors(Z, X);
    if (a.bank) { const c = Math.cos(a.bank), s = Math.sin(a.bank); P0.copy(X).multiplyScalar(c).addScaledVector(Y, s); Y.multiplyScalar(c).addScaledVector(X, -s); X.copy(P0); }
    M.makeBasis(X, Y, Z).setPosition(a.pos);
    { const k = (h.sp.size || 1) * (a.grow ?? 1); if (k !== 1) M.scale(P0.setScalar(k)); }
    M.toArray(mesh.instanceMatrix.array, i * 16);
    anim.setXYZW(i, a.phase, a.amt, a.turn, 0);
  }

  // ---------------------------------------------------------------- schools: one curve, each fish a moment behind the one ahead
  const SCHOOL_FRAME = /* glsl */`
    float ocT = uClock - (aFish.z*.5 + .5)*uDelay - aFish.w*uDelay*.16;
    vec3 ocA = ocPath(ocT - .05), ocB = ocPath(ocT + .05);
    vec3 ocFw = normalize(ocB - ocA);
    vec3 ocC = (ocA + ocB)*.5;
    vec3 ocRt = normalize(cross(vec3(0.0, 1.0, 0.0), ocFw));
    vec3 ocUp = cross(ocFw, ocRt);
    float ocS = sin(uClock*2.3 + aFish.w*40.0), ocS2 = cos(uClock*1.7 + aFish.w*23.0);
    vec3 ocPos = ocC + ocRt*(aFish.x*uCtr.w + ocS*.28) + ocUp*(aFish.y*uCtr.w*.46 + ocS2*.18) + ocFw*aFish.z*uCtr.w*1.25;
    vec3 ocAw = ocPos - uFlee.xyz;
    float ocDa = length(ocAw) + .001;
    float ocK = uFlee.w*exp(-ocDa*ocDa/(uFleeR*uFleeR));
    ocAw /= ocDa;
    ocPos += ocAw*ocK*uFleeR*.65;
    ocFw = normalize(ocFw + ocAw*ocK*1.9);
    ocRt = normalize(cross(vec3(0.0, 1.0, 0.0), ocFw));
    ocUp = cross(ocFw, ocRt);
    mat3 ocFr = mat3(ocRt, ocUp, ocFw);
    float ocFlap = uFlap*(.9 + .2*fract(aFish.w*13.0)) + aFish.w*50.0;
    vec3 objectNormal = ocFr*vec3(normal);`;
  const SCHOOL_PROJECT = /* glsl */`
    float ocSz = (.78 + .42*fract(aFish.w*7.13))*uGrow;
    { float s = clamp((uBody.x - transformed.z)/uBody.y, 0.0, 1.0);
      float amp = (.010 + .026*s + .10*s*s)*uAmp;
      transformed.x += uBody.y*amp*sin(6.2831853*s*1.05 - ocFlap);
    }
    vec3 ocW3 = ocPos + ocFr*(transformed*ocSz);
    vec4 mvPosition = viewMatrix*vec4(ocW3, 1.0);
    gl_Position = projectionMatrix*mvPosition;
    vOcP = ocW3;`;
  const SCHOOL_PARS = /* glsl */`
    attribute vec4 aFish;      // place in the school (x, y, z in -1..1), seed
    uniform vec4 uCtr, uBody, uFlee;
    uniform vec3 uPh;
    uniform float uClock, uFlap, uAmp, uFleeR, uSpan, uDelay, uGrow;
    vec3 ocPath(float t) {
      return uCtr.xyz + uSpan*vec3(sin(t) + .5*sin(2.3*t + uPh.x), .16*sin(1.1*t + uPh.y) + .07*sin(3.1*t), cos(.9*t + uPh.z) + .45*sin(1.7*t + uPh.x));
    }`;

  const schoolBodies = {};
  const schoolList = (data.schools || []).map((s, i) => ({ ...s, ball: Math.max(2.2, Math.cbrt(s.n) * (s.kind === 'fish_c' ? 1.3 : .95)), c: W(s.x, s.y, s.z), i, clock: Math.random() * 40, flap: 0, excite: 0, flee: 0, fleeP: new THREE.Vector3(0, 1e4, 0), fleeR: 8, ph: [Math.random() * 6, Math.random() * 6, Math.random() * 6], slot: -1, fp: new THREE.Vector3() }));
  const POOL = phone ? 7 : 12, FISH_MAX = phone ? 56 : 72, SHOALS = phone ? 4 : 6;
  const pool = [];
  function poolMesh(kind, far = false) {
    const key = far ? kind + '__far' : kind, B = (schoolBodies[key] ||= body(key));
    const a = new Float32Array(FISH_MAX * 4);
    for (let i = 0; i < FISH_MAX; i++) {
      // a soft ball, denser in the middle
      let x, y, z; do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; } while (x * x + y * y + z * z > 1);
      a[i * 4] = x; a[i * 4 + 1] = y; a[i * 4 + 2] = z; a[i * 4 + 3] = Math.random();
    }
    const g = new THREE.InstancedBufferGeometry();
    g.index = B.g.index; for (const k in B.g.attributes) g.setAttribute(k, B.g.attributes[k]);
    g.setAttribute('aFish', new THREE.InstancedBufferAttribute(a, 4));
    g.instanceCount = FISH_MAX;
    const u = {
      uCtr: { value: new THREE.Vector4() }, uBody: { value: B.uBody }, uFlee: { value: new THREE.Vector4(0, 1e4, 0, 0) }, uPh: { value: new THREE.Vector3() },
      uClock: { value: 0 }, uFlap: { value: 0 }, uAmp: { value: 1 }, uFleeR: { value: 8 }, uSpan: { value: 20 }, uDelay: { value: .2 }, uGrow: { value: 1 },
    };
    const m = look.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .34, metalness: .35 }), {
      key: 'school', uniforms: u, vertexPars: SCHOOL_PARS, normalExtra: SCHOOL_FRAME, vertexExtra: SCHOOL_PROJECT, skin: 'fish', body: B.uBody,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.visible = false; mesh.name = 'school_' + kind;
    scene.add(mesh);
    return { mesh, u, kind, far, school: null };
  }

  // ---------------------------------------------------------------- jellies: one draw, driven in the shader; they light the trench
  const jelly = (() => {
    const list = (data.drifters || []).filter(d => d.kind === 'jelly');
    let total = 0; for (const d of list) total += d.n;
    if (!total) return null;
    const B = body('jelly');
    const cap = phone ? Math.min(total, 110) : total;
    const a = new Float32Array(cap * 4), M4 = new Float32Array(cap * 16), groups = [];
    let k = 0;
    const dm = new THREE.Object3D();
    for (const d of list) {
      const start = k;
      for (let i = 0; i < d.n && k < cap; i++, k++) {
        dm.position.copy(W(d.x + (Math.random() - .5) * d.r * 2, d.y + (Math.random() - .5) * d.r * 2, d.z + (Math.random() - .5) * 18));
        const s = .7 + Math.random() * .9; dm.scale.setScalar(s); dm.rotation.set(0, Math.random() * 6, 0); dm.updateMatrix(); dm.matrix.toArray(M4, k * 16);
        a[k * 4] = Math.random(); a[k * 4 + 1] = .3 + Math.random() * .3; a[k * 4 + 2] = Math.random(); a[k * 4 + 3] = Math.random();
      }
      groups.push({ start, count: k - start, c: W(d.x, d.y, d.z), r: d.r + 20 });
    }
    const geo = B.g.clone(); geo.setAttribute('aJelly', new THREE.InstancedBufferAttribute(a, 4).setUsage(THREE.DynamicDrawUsage));
    const mat = look.patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: 0, transparent: true, opacity: .62, side: THREE.DoubleSide, depthWrite: false }), {
      key: 'jelly', uniforms: { uBody: { value: B.uBody } }, vertexPars: JELLY_V,
      vertexBend: /* glsl */`
        { float cy = fract(ocTime*aJelly.y + aJelly.x);
          float p = cy < .26 ? smoothstep(0.0, .26, cy) : 1.0 - smoothstep(.26, 1.0, cy);
          float h = uBody.w;
          float top = smoothstep(-.35*h, .05*h, transformed.y);
          transformed.xz *= 1.0 - .30*p*top;
          transformed.y += .16*h*p*top;
          float tail = 1.0 - top;
          float tl = max(-transformed.y, 0.0);
          transformed.x += tail*tl*.34*sin(ocTime*.8 + aJelly.x*30.0 + tl*2.2);
          transformed.z += tail*tl*.34*cos(ocTime*.7 + aJelly.z*30.0 + tl*1.7);
          transformed.y += tail*(1.0 - p)*.1*h;
          transformed.y += sin(ocTime*.11 + aJelly.x*40.0)*2.6;
          transformed.x += sin(ocTime*.07 + aJelly.z*40.0)*1.8;
          vOcJ = p; }`,
      vertexDecl: 'varying float vOcJ;',
      fragmentPars: 'varying float vOcJ;',
      fragmentPost: /* glsl */`outgoingLight += (vec3(.25, .85, 1.0)*(.45 + vOcJ*1.2)*(.4 + .6*smoothstep(25.0, 90.0, -vOcP.y)))*(.6 + .4*diffuseColor.r);`,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false; mesh.renderOrder = 5; mesh.name = 'jelly';
    scene.add(mesh);
    return { mesh, M4, a, groups, attr: geo.attributes.aJelly };
  })();

  // One body of each kind exists from the start, so its program is compiled on the loading screen.
  for (const k of new Set(schoolList.map(s => s.kind))) pool.push(poolMesh(k));
  // Schools that stay near whoever's looking: ordinary schools, moved. Their bodies are made here too: nothing new is built in play.
  const shoals = [];
  for (let i = 0; i < SHOALS; i++) {
    const kind = ['fish_a', 'fish_b', 'fish_a', 'fish_c', 'fish_b', 'fish_a'][i], ball = kind === 'fish_c' ? 5 : 3.8;
    const s = { kind, n: FISH_MAX, r: 3.4, ball, c: new THREE.Vector3(0, -1e4, 0), i: schoolList.length, clock: Math.random() * 40, flap: 0, excite: 0, flee: 0, fleeP: new THREE.Vector3(0, 1e4, 0), fleeR: 8, ph: [Math.random() * 6, Math.random() * 6, Math.random() * 6], slot: -1, fp: new THREE.Vector3(), grow: 1 };
    schoolList.push(s); shoals.push(s);
    if (pool.filter(p => p.kind === kind && !p.far).length < SHOALS) pool.push(poolMesh(kind));
    if (world.creatures && world.creatures[kind + '__far']) pool.push(poolMesh(kind, true));
  }

  // ---------------------------------------------------------------- the company a camera keeps
  // The map's own animals are spread over two kilometres and a phone sees forty metres of water. So a few stay near whoever's looking: schools and a handful of animals of that water
  // are set down ahead, out of the way of the eye or growing in, and let go when they're left behind. Nothing here is a new kind of animal: they swim by the rules everything else does.
  const OFFP = new THREE.Vector3(0, -1e4, 0), fw = new THREE.Vector3(), lastCam = new THREE.Vector3(), Q = { x: 0, y: 0, z: 0 };
  const band = {}, gulls = [];
  for (const k in BAND) { band[k] = []; for (let i = 0; i < BAND[k]; i++) { const a = agent(k, OFFP, cnt[k]); a.off = true; a.grow = 1; band[k].push(a); } }
  for (let i = 0; i < GULLS; i++) { const a = agent('gull', OFFP, cnt.gull); a.off = true; a.mode = 'soar'; a.speed = 0; a.ang = Math.random() * TAU; a.sense = Math.random() < .5 ? 1 : -1; a.radius = 26 + Math.random() * 34; a.amt = 1; gulls.push(a); }
  let camYaw = 0, camV = 0, rosterT = 0, firstSeat = true, cone = 1;
  // A place in the water ahead of the eye: x, y, z in P0, or false. Clear of solids; between the bed and the surface, near the eye's own depth.
  function waterAhead(cam, near, far, cone, keep) {
    for (let k = 0; k < 8; k++) {
      const a = camYaw + (Math.random() - .5) * (k < 5 ? cone : cone * 2.4), d = near + Math.random() * (far - near), x = cam.x + Math.sin(a) * d, z = cam.z + Math.cos(a) * d, bed = world.heightAt(x, -z);
      if (bed > -2.8) continue;
      const lo = bed + 1.2 + keep, hi = -1.2 - keep, y = lo >= hi ? (lo + hi) / 2 : clamp(cam.y + (Math.random() - .5) * 8, lo, hi);
      Q.x = x; Q.y = -z; Q.z = y;
      if (world.collide(Q, keep + .6)) continue;
      P0.set(x, y, z);
      return true;
    }
    return false;
  }
  function roster(cam) {
    const w = world.regionAt(cam.x, -cam.z); let r = 0; for (let i = 1; i < 7; i++) if (w[i] > w[r]) r = i;
    const list = ALONG[r], wet = cam.y < .6 && cam.y > -130;
    let seats = firstSeat ? 99 : 1;
    for (const k in band) {
      let want = wet ? list.filter(x => x === k).length : 0;
      for (const a of band[k]) {
        if (!a.off) {
          P1.subVectors(a.pos, cam); const d = P1.length();
          sph.center.copy(a.pos); sph.radius = 1; a.out = fr.intersectsSphere(sph) ? 0 : (a.out || 0) + .4;
          if (want <= 0 || d > 74 || a.out > 1.1) { a.off = true; a.pos.copy(OFFP); a.out = 0; } else want--;
        }
      }
      for (const a of band[k]) {
        if (want <= 0 || seats <= 0) break;
        if (!a.off) continue;
        if (!waterAhead(cam, firstSeat ? 10 : 16 + camV, firstSeat ? 26 : 34 + camV, cone, 1)) continue;
        a.off = false; a.pos.copy(P0); a.home.copy(P0); a.way.copy(P0); a.wayT = 0; a.radius = 24; a.fear = 0; a.grow = firstSeat ? 1 : 0; a.speed = SP[k].cruise;
        a.dir.set(Math.sin(camYaw + (Math.random() - .5) * 4 + Math.PI), 0, Math.cos(camYaw + (Math.random() - .5) * 4 + Math.PI));
        want--; seats--;
      }
    }
  }
  function keepCompany(dt, cam) {
    camera.getWorldDirection(fw); camYaw = Math.atan2(fw.x, fw.z); cone = 1.7 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);      // what's seated is seated in the frame: a phone held upright sees about 36 degrees across
    camV += (Math.min(40, P1.subVectors(cam, lastCam).length() / Math.max(dt, 1e-3)) - camV) * (1 - Math.exp(-dt * 2)); lastCam.copy(cam);
    const wet = cam.y < .6 && cam.y > -130;
    let moved = false;
    for (const s of shoals) {
      s.grow = Math.min(1, s.grow + dt * .8);
      if (!wet) { if (s.c.y > -1e3) s.c.copy(OFFP); continue; }
      let go = s.c.y < -1e3;
      if (!go) { schoolPos(s, P1); sph.center.copy(P1); sph.radius = s.ball; s.out = fr.intersectsSphere(sph) ? 0 : (s.out || 0) + dt; go = P1.distanceTo(cam) > 58 || s.out > .5; }
      if (go && (firstSeat || !moved) && waterAhead(cam, firstSeat ? 9 : 16 + camV * .8, firstSeat ? 24 : 34 + camV * .8, cone, s.ball * .7)) {
        s.c.copy(P0); s.clock = Math.random() * 40; s.grow = firstSeat ? 1 : 0; s.excite = s.flee = 0; s.out = 0; moved = true;
      }
    }
    for (const k in band) for (const a of band[k]) if (a.grow < 1) a.grow = Math.min(1, a.grow + dt * .7);
    rosterT -= dt;
    if (rosterT <= 0 || firstSeat) { rosterT = .4; roster(cam); firstSeat = false; }
    // gulls: over land and off the shore, wherever the eye is in the air
    const air = cam.y > -.6;
    for (const a of gulls) {
      if (!air) { if (!a.off) { a.off = true; a.pos.copy(OFFP); } continue; }
      P0.copy(cam).addScaledVector(fw, 46); P0.x += Math.sin(a.seed * 40) * 26; P0.z += Math.cos(a.seed * 31) * 26;
      P0.y = Math.max(world.heightAt(P0.x, -P0.z), 0) + 10 + a.seed * 15;
      if (a.off || a.home.distanceTo(cam) > 130) { a.off = false; a.home.copy(P0); } else a.home.lerp(P0, 1 - Math.exp(-dt * .3));
    }
  }

  // ---------------------------------------------------------------- dolphins that find him
  // Near the surface a pod comes in and keeps him company, each animal holding a place beside him and arcing out in its own time. When he leaves the water they leave it with him: life.leap().
  const esc = { list: [], state: 0, wait: 4, t: 0, air: false, last: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), away: new THREE.Vector3(), speed: 0 };
  for (let i = 0; i < ESCORT; i++) { const a = agent('dolphin', OFFP, cnt.dolphin); a.off = true; a.script = true; a.last = a.pos.clone(); a.arc = null; a.arcT = 1; a.arcH = 2; a.next = 1 + Math.random() * 7; a.side = i % 2 ? 1 : -1; a.row = (i + 1) >> 1; esc.list.push(a); }
  const arc = (a, h, T, delay = 0) => { a.arc = -delay; a.arcT = T; a.arcH = h; };
  function leap(h = 5) { if (esc.state === 1) esc.list.forEach((a, i) => arc(a, h * (.8 + Math.random() * .35), 1.2 + h * .08, i * .07 + Math.random() * .06)); }
  function stepEscort(dt, f) {
    const E = esc, bed = world.heightAt(f.x, -f.z), wet = f.y > -10 && f.y < 14 && bed < -3;
    P1.subVectors(f, E.last); P1.y = 0; const sp = P1.length() / Math.max(dt, 1e-3); E.last.copy(f);
    if (sp > 90) { if (E.state) { E.state = 0; E.wait = 8; for (const a of E.list) { a.off = true; a.pos.copy(OFFP); } } return; }            // he was put somewhere
    E.speed += (sp - E.speed) * (1 - Math.exp(-dt * 3));
    if (sp > 1.5) { P1.normalize(); E.dir.lerp(P1, 1 - Math.exp(-dt * 2.4)).normalize(); } else { const c = Math.cos(dt * .4), s = Math.sin(dt * .4), x = E.dir.x; E.dir.x = x * c - E.dir.z * s; E.dir.z = x * s + E.dir.z * c; }
    if (E.state === 0) {
      if (!wet) return;
      E.wait -= dt; if (E.wait > 0) return;
      E.state = 1; E.t = 0;
      const sd = Math.random() < .5 ? 1 : -1, ax = E.dir.z * sd, az = -E.dir.x * sd;
      for (const a of E.list) { a.off = false; a.pos.set(f.x + ax * (46 + a.row * 4) + E.dir.x * (20 + a.row * 6), -2.4, f.z + az * (46 + a.row * 4) + E.dir.z * (20 + a.row * 6)); a.last.copy(a.pos); a.arc = null; }
    }
    E.t += dt;
    if (E.state === 1 && (!wet || E.t > 55)) { E.state = 2; E.t = 0; E.away.set(E.dir.z - E.dir.x, 0, -E.dir.x - E.dir.z).normalize(); }
    if (E.state === 2 && E.t > 5) { E.state = 0; E.wait = 18 + Math.random() * 26; for (const a of E.list) { a.off = true; a.pos.copy(OFFP); } return; }
    if (f.y > .7 && !E.air) { E.air = true; leap(Math.min(6, 2.6 + f.y * .6)); } else if (f.y < 0) E.air = false;
    podRt.crossVectors(UP, E.dir).normalize();
    const t = U.ocTime.value, spread = E.speed < 2 ? 1.8 : 1;
    for (const a of E.list) {
      if (E.state === 1) P0.copy(f).addScaledVector(podRt, a.side * (2.2 + 1.2 * a.row) * spread).addScaledVector(E.dir, (7.5 + 3.6 * a.row + (a.side > 0 ? 1.2 : 0)) * spread); else P0.copy(a.pos).addScaledVector(E.away, 20);      // ahead of him: an upright phone sees nothing beside him
      P1.subVectors(P0, a.pos); P1.y = 0; const d = P1.length(), v = E.state === 1 ? Math.min(d * 1.7, Math.max(E.speed + 6, 13)) : 14;
      a.last.copy(a.pos);
      if (d > 1e-3) a.pos.addScaledVector(P1, v * dt / d);
      let y = -2.3 + Math.sin(t * 1.4 + a.seed * 20) * .45;
      if (a.arc === null) { a.next -= dt; if (a.next <= 0 && E.state === 1) { arc(a, 1.5 + Math.random() * 2, 1.1 + Math.random() * .3); a.next = 5 + Math.random() * 8; } }
      else { a.arc += dt; if (a.arc >= a.arcT) a.arc = null; }
      const up = a.arc !== null && a.arc >= 0;
      if (up) { const w = a.arc / a.arcT; y = -1.5 + (a.arcH + 1.5) * 4 * w * (1 - w); }
      a.pos.y += (y - a.pos.y) * (1 - Math.exp(-dt * (up ? 16 : 3)));
      { const g = world.heightAt(a.pos.x, -a.pos.z) + 1.2; if (a.pos.y < g) a.pos.y = g; }
      P1.subVectors(a.pos, a.last); const m = P1.length();
      if (m > 1e-4) a.dir.lerp(P1.divideScalar(m), 1 - Math.exp(-dt * 7)).normalize();
      a.speed = m / Math.max(dt, 1e-3);
      const air = a.pos.y > 0;
      a.amt = air ? .2 : up ? 1.5 : 1;
      a.phase += dt * TAU * (air ? .4 : SP.dolphin.beat * Math.max(a.speed, 4));
      if (air && !a.flown) { a.flown = true; spray(a.pos, .8); splash(a.pos, 1.6); }
      if (!air && a.flown) { a.flown = false; spray(a.pos, 1.3); splash(a.pos, 2.4); if (life.onSplash) life.onSplash(a.pos.clone()); }
    }
  }

  // ---------------------------------------------------------------- a whale breaches, far off
  const bre = { a: agent('whale', OFFP, cnt.whale), t: -1, wait: 7 + Math.random() * 8, x: 0, z: 0, hd: 0, wasUp: false };
  bre.a.off = true; bre.a.script = true;
  function stepBreach(dt, cam) {
    const B = bre, a = B.a;
    if (B.t < 0) {
      if (cam.y < -9) return;
      B.wait -= dt; if (B.wait > 0) return;
      B.wait = 15 + Math.random() * 22;
      for (let k = 0; k < 6; k++) {
        const an = camYaw + (Math.random() - .5) * .9, d = 120 + Math.random() * 150, x = cam.x + Math.sin(an) * d, z = cam.z + Math.cos(an) * d;
        if (world.heightAt(x, -z) > -14) continue;
        B.x = x; B.z = z; B.hd = Math.random() * TAU; B.t = 0; B.wasUp = false; a.off = false; break;
      }
      if (B.t < 0) return;
    }
    B.t += dt;
    const v = 20.5, y = -19 + v * B.t - 4.7 * B.t * B.t, p = 1.32 - 1.55 * smooth(.7, 3.5, B.t);        // up nearly straight, over, and down on its side
    a.pos.set(B.x + Math.sin(B.hd) * 5 * B.t, y, B.z + Math.cos(B.hd) * 5 * B.t);
    a.dir.set(Math.cos(p) * Math.sin(B.hd), Math.sin(p), Math.cos(p) * Math.cos(B.hd));
    a.bank = smooth(.8, 3.2, B.t) * 1.35; a.amt = .5; a.phase += dt * 1.6; a.turn = 0;
    const up = y > 0;
    if (up && !B.wasUp) { B.wasUp = true; splash(a.pos, 11); spray(a.pos, 2.4); }
    if (B.wasUp && !up) { B.wasUp = false; splash(a.pos, 17); spray(a.pos, 3); if (life.onSplash) life.onSplash(a.pos.clone()); }
    if (B.t > 5.8) { B.t = -1; a.off = true; a.pos.copy(OFFP); a.bank = 0; }
  }

  // ---------------------------------------------------------------- water thrown up by a body: seen from far off, where droplets aren't
  const splash = (() => {
    const N = phone ? 8 : 14, P = new Float32Array(N * 4 * 3), A = new Float32Array(N * 4 * 2), C = new Float32Array(N * 4 * 2), idx = new Uint16Array(N * 6);
    for (let i = 0; i < N; i++) { for (let k = 0; k < 4; k++) { C[(i * 4 + k) * 2] = k & 1 ? 1 : -1; C[(i * 4 + k) * 2 + 1] = k >> 1 ? 1 : 0; P[(i * 4 + k) * 3 + 1] = -1e4; } idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aA', new THREE.BufferAttribute(A, 2).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aC', new THREE.BufferAttribute(C, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: U,
      vertexShader: /* glsl */`
        attribute vec2 aA, aC; uniform float ocTime; varying vec2 vQ; varying float vT; varying vec3 vP;
        void main() {
          float t = (ocTime - aA.x)/(1.0 + aA.y*.14);
          if (t < 0.0 || t > 1.0 || position.y < -100.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float rise = aA.y*(1.5*t - .9*t*t)*(1.0 + aC.y*.3);
          vec3 p = position + vec3(0.0, aC.y*rise, 0.0);
          vec4 c = viewMatrix*vec4(p, 1.0);
          c.x += aC.x*aA.y*(.42 + .75*t)*(1.0 - .5*aC.y);
          vP = p; vQ = aC; vT = t;
          gl_Position = projectionMatrix*c;
        }`,
      fragmentShader: /* glsl */`
        varying vec2 vQ; varying float vT; varying vec3 vP;
        ${look.glsl}
        void main() {
          float n = texture(tOcNoise, vQ*.5 + vec2(vT*.3, -vT*.7) + vP.xz*.01).b*.6 + texture(tOcNoise, vQ*1.3 - vec2(vT*.5, vT)).a*.4;
          float r = abs(vQ.x)*(1.0 + vQ.y*.5) + vQ.y*.72 + (n - .5)*.8;
          float a = (1.0 - smoothstep(.45, 1.0, r))*(1.0 - smoothstep(.45, 1.0, vT))*smoothstep(.0, .08, vT)*.9;
          if (a < .01) discard;
          gl_FragColor = vec4(ocApply(vec3(.86, .92, .94)*(.75 + .35*ocSunGain), vP), a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 22; mesh.name = 'splash'; scene.add(mesh);
    let at = 0;
    return (p, size) => {
      const i = at++ % N, t = U.ocTime.value;
      for (let k = 0; k < 4; k++) { const o = i * 4 + k; P[o * 3] = p.x; P[o * 3 + 1] = .05; P[o * 3 + 2] = p.z; A[o * 2] = t; A[o * 2 + 1] = size; }
      g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true;
    };
  })();

  // ---------------------------------------------------------------- boats under way, each with its wake
  const boats = (() => {
    const b0 = (world.batches || []).find(b => b.name === 'boat_fishing'), I = data.instances.boat_fishing;
    if (!b0 || !I) return null;
    const D = new THREE.Object3D(); D.position.set(I[0], I[2], -I[1]); D.rotation.set(0, I[3], 0); D.scale.setScalar(I[4]); D.updateMatrix();
    const node = D.matrix.clone().invert().multiply(new THREE.Matrix4().fromArray(b0.M, 0));
    const mesh = new THREE.InstancedMesh(b0.mesh.geometry, b0.mesh.material, BOATS);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BOATS * 3).fill(1), 3);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.name = 'boats'; scene.add(mesh);
    const L = 46, W0 = 1.3, W1 = W0 + L * .36, wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-W0, 0, 0, W0, 0, 0, -W1, 0, -L, W1, 0, -L]), 3));
    wg.setAttribute('aW', new THREE.BufferAttribute(new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]), 2));
    wg.setIndex([0, 2, 1, 1, 2, 3]);
    const wm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: U,
      vertexShader: /* glsl */`
        attribute vec2 aW; varying vec2 vW; varying vec3 vP;
        void main() { vW = aW; vec4 w = modelMatrix*instanceMatrix*vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */`
        varying vec2 vW; varying vec3 vP;
        ${look.glsl}
        void main() {
          if (cameraPosition.y < 0.0) discard;
          float u = abs(vW.x), v = vW.y, n = texture(tOcNoise, vP.xz*.10 + vec2(0.0, ocTime*.04)).b*.6 + texture(tOcNoise, vP.xz*.31 - ocTime*.03).a*.4;
          float arms = smoothstep(.70, .90, u + (n - .5)*.16)*(1.0 - smoothstep(.90, 1.0, u)), core = (1.0 - smoothstep(.0, .22 + .26*v, u))*(1.0 - smoothstep(.0, .62, v));
          float a = (arms*.75 + core)*smoothstep(.34, .60, n + (1.0 - v)*.30)*(1.0 - smoothstep(.40, 1.0, v));
          if (a < .01) discard;
          gl_FragColor = vec4(ocApply(vec3(.90, .95, .96)*(.7 + .4*ocSunGain), vP), a*.9);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const wake = new THREE.InstancedMesh(wg, wm, BOATS);
    wake.instanceMatrix.setUsage(THREE.DynamicDrawUsage); wake.frustumCulled = false; wake.count = 0; wake.renderOrder = 15; wake.name = 'wakes'; scene.add(wake);
    return { node, mesh, wake, list: Array.from({ length: BOATS }, (_, i) => ({ x: 0, z: 0, yaw: 0, turn: 0, v: 4.5 + i * .8, on: false, look: i * .3, grow: 1, seed: Math.random() * 9 })) };
  })();
  const bM = new THREE.Matrix4(), bQ = new THREE.Quaternion(), bE = new THREE.Euler(), bS = new THREE.Vector3(), bP = new THREE.Vector3();
  function stepBoats(dt, cam) {
    if (!boats) return;
    let n = 0;
    const seen = cam.y > -30;
    for (const b of boats.list) {
      if (b.on) {
        const dx = b.x - cam.x, dz = b.z - cam.z, d = Math.hypot(dx, dz);
        sph.center.set(b.x, 1, b.z); sph.radius = 14;
        if (d > 520 || (d > 200 && !fr.intersectsSphere(sph) && Math.random() < dt * .1)) b.on = false;
      }
      if (!b.on && seen) {
        for (let k = 0; k < 4 && !b.on; k++) {
          const a = camYaw + (Math.random() - .5) * 1.4, d = 90 + Math.random() * 150, x = cam.x + Math.sin(a) * d, z = cam.z + Math.cos(a) * d;
          if (world.heightAt(x, -z) > -5) continue;
          b.x = x; b.z = z; b.yaw = a + (Math.random() < .5 ? 1 : -1) * (.9 + Math.random() * .9); b.turn = 0; b.on = true; b.grow = 0;
        }
        if (!b.on) continue;
      }
      if (!b.on) continue;
      b.look -= dt;
      if (b.look <= 0) {                                                  // the skipper looks ahead: deep water, or come round
        b.look = .5;
        const sy = Math.sin(b.yaw), cy = Math.cos(b.yaw), ahead = world.heightAt(b.x + sy * 40, -(b.z + cy * 40)), port = world.heightAt(b.x + Math.sin(b.yaw - .7) * 40, -(b.z + Math.cos(b.yaw - .7) * 40)), star = world.heightAt(b.x + Math.sin(b.yaw + .7) * 40, -(b.z + Math.cos(b.yaw + .7) * 40));
        b.turn = ahead > -6 || port > -4 || star > -4 ? (port < star ? -.5 : .5) : Math.sin(U.ocTime.value * .05 + b.seed) * .06;
      }
      b.yaw += b.turn * dt; b.grow = Math.min(1, b.grow + dt * .5);
      b.x += Math.sin(b.yaw) * b.v * dt; b.z += Math.cos(b.yaw) * b.v * dt;
      const y = look.waveAt ? look.waveAt(b.x, b.z) : 0;
      bP.set(b.x, y, b.z); bE.set(0, b.yaw, -b.turn * .22); bQ.setFromEuler(bE); bS.setScalar(b.grow);
      bM.compose(bP, bQ, bS); bM.multiply(boats.node).toArray(boats.mesh.instanceMatrix.array, n * 16);
      bP.y = Math.max(y, 0) + .12; bM.compose(bP, bQ, bS).toArray(boats.wake.instanceMatrix.array, n * 16);
      n++;
    }
    boats.mesh.count = boats.wake.count = n; boats.mesh.visible = boats.wake.visible = n > 0;
    if (n) { boats.mesh.instanceMatrix.needsUpdate = true; boats.wake.instanceMatrix.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- the frame
  const fr = new THREE.Frustum(), pv = new THREE.Matrix4(), sph = new THREE.Sphere(), fpos = new THREE.Vector3();
  let tick = 0;

  function scatter(pos, radius = 14) {
    const p = pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z);
    scareList.push({ p, r: radius * 1.4, t: .25 });
    for (const s of schoolList) {
      if (s.c.distanceTo(p) > radius + s.r * 3.2) continue;
      s.excite = 1; s.flee = 1; s.fleeP.copy(p); s.fleeR = Math.min(radius * 1.2, 30);
    }
  }

  function update(dt, focus) {
    tick++;
    const cam = camera.position;
    if (focus) fpos.copy(focus); else fpos.copy(cam);
    camera.updateMatrixWorld();
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(pv);

    // Individuals.
    for (const k in herds) {
      const h = herds[k], R = h.sp.reach; let w = 0, wf = 0;
      for (const a of h.agents) {
        if (a.off) continue;
        if (k !== 'dolphin' && !a.script) stepAgent(a, h, dt, fpos);
        if (a.pos.distanceToSquared(cam) > R * R) continue;
        sph.center.copy(a.pos); sph.radius = h.B.L * (h.sp.size || 1);
        if (!fr.intersectsSphere(sph)) continue;
        if (h.far && a.pos.distanceToSquared(cam) > FAR2) compose(a, h, wf++, h.far.mesh, h.far.anim); else compose(a, h, w++);
      }
      if (h.far) {
        const fm = h.far.mesh; fm.count = wf; fm.visible = wf > 0;
        if (wf) { fm.instanceMatrix.needsUpdate = true; h.far.anim.needsUpdate = true; fm.instanceMatrix.clearUpdateRanges(); fm.instanceMatrix.addUpdateRange(0, wf * 16); h.far.anim.clearUpdateRanges(); h.far.anim.addUpdateRange(0, wf * 4); }
      }
      h.mesh.count = w; h.mesh.visible = w > 0;
      if (w) { h.mesh.instanceMatrix.needsUpdate = true; h.anim.needsUpdate = true; h.mesh.instanceMatrix.clearUpdateRanges(); h.mesh.instanceMatrix.addUpdateRange(0, w * 16); h.anim.clearUpdateRanges(); h.anim.addUpdateRange(0, w * 4); }
    }
    for (const p of pods) stepPod(p, dt);
    keepCompany(dt, cam); stepEscort(dt, fpos); stepBreach(dt, cam); stepBoats(dt, cam);
    for (let i = scareList.length - 1; i >= 0; i--) { scareList[i].t -= dt; if (scareList[i].t <= 0) scareList.splice(i, 1); }

    // The nearest whale's shadow: on the seabed and on anything under it.
    let best = null, bd = 1e12;
    for (const w of whales) { const d = w.agent.pos.distanceToSquared(cam); if (d < bd) { bd = d; best = w.agent; } }
    if (best) { const depth = -best.pos.y, q = U.ocSunW.value; U.ocShade.value.set(best.pos.x + q.x * (depth / q.y), best.pos.z + q.z * (depth / q.y), depth, herds.whale.B.L * SP.whale.size * .36); }

    // Schools: each advances its own clock; the nearest take the pool's bodies.
    let want2 = [];
    for (const s of schoolList) {
      const d = s.c.distanceTo(fpos);
      const near = s.r * 1.6 + 8;
      if (d < near) { s.excite = Math.max(s.excite, (1 - d / near) * .8); }
      s.excite = Math.max(0, s.excite - dt * .33);
      s.flee = Math.max(0, s.flee - dt * .55);
      if (d < near * 1.4) { const w = (1 - d / (near * 1.4)); if (w * .9 > s.flee) { s.flee = w * .9; s.fleeR = 6.5; } if (s.fleeR <= 6.5) s.fleeP.copy(fpos); }
      const pace = 1 + s.excite * 3.2;
      const span = s.r * 2.3;
      s.clock += dt * pace * 2.1 / span;
      s.flap += dt * TAU * (2.4 + s.excite * 7);
      const dc = s.c.distanceTo(cam);
      s.dist = dc;
      if (dc < 170) want2.push(s);
    }
    want2.sort((a, b) => a.dist - b.dist);
    want2 = want2.slice(0, POOL);
    const hasFar = (k) => !!(world.creatures && world.creatures[k + '__far']);
    for (const s of want2) s.farNow = hasFar(s.kind) && (s.farNow ? s.dist > (phone ? 6 : 24) : s.dist > (phone ? 8 : 30));
    for (const p of pool) { if (p.school && (!want2.includes(p.school) || p.far !== !!p.school.farNow)) { p.school.slot = -1; p.school = null; p.mesh.visible = false; } }
    for (const s of want2) {
      if (s.slot >= 0) continue;
      const far = !!s.farNow;
      let p = pool.find(x => !x.school && x.kind === s.kind && x.far === far);
      if (!p) { if (pool.length >= POOL * 4) continue; p = poolMesh(s.kind, far); pool.push(p); }
      p.school = s; s.slot = 1;
    }
    for (const p of pool) {
      const s = p.school; if (!s) continue;
      const u = p.u, span = s.r * 2.3;
      sph.center.copy(s.c); sph.radius = span * 1.8 + s.r;
      const vis = fr.intersectsSphere(sph);
      p.mesh.visible = vis; if (!vis) continue;
      u.uCtr.value.set(s.c.x, s.c.y, s.c.z, s.ball);
      u.uPh.value.set(s.ph[0], s.ph[1], s.ph[2]);
      u.uGrow.value = s.grow ?? 1; u.uClock.value = s.clock; u.uFlap.value = s.flap; u.uAmp.value = 1 + s.excite * .55; u.uSpan.value = span; u.uDelay.value = 2.4 * s.ball / span;
      u.uFlee.value.set(s.fleeP.x, s.fleeP.y, s.fleeP.z, s.flee); u.uFleeR.value = s.fleeR;
      p.mesh.geometry.instanceCount = Math.min(FISH_MAX, s.n, s.dist > 70 ? 14 : s.dist > 34 ? 32 : FISH_MAX);
    }

    // Jellies: whole groups in or out by distance.
    if (jelly && tick % 10 === 1) {
      let w = 0;
      const am = jelly.mesh.instanceMatrix.array, ja = jelly.attr.array;
      for (const g of jelly.groups) {
        if (g.c.distanceTo(cam) - g.r > 190) continue;
        am.set(jelly.M4.subarray(g.start * 16, (g.start + g.count) * 16), w * 16);
        ja.set(jelly.a.subarray(g.start * 4, (g.start + g.count) * 4), w * 4);
        w += g.count;
      }
      jelly.mesh.count = w; jelly.mesh.visible = w > 0;
      jelly.mesh.instanceMatrix.needsUpdate = true; jelly.attr.needsUpdate = true;
    }
  }

  // The same curve as the shader's, for anyone who needs to find a school.
  const schoolPos = (s, out = new THREE.Vector3()) => {
    const t = s.clock, S = s.r * 2.3;
    return out.set(s.c.x + S * (Math.sin(t) + .5 * Math.sin(2.3 * t + s.ph[0])), s.c.y + S * (.16 * Math.sin(1.1 * t + s.ph[1]) + .07 * Math.sin(3.1 * t)), s.c.z + S * (Math.cos(.9 * t + s.ph[2]) + .45 * Math.sin(1.7 * t + s.ph[0])));
  };
  const life = { update, scatter, whales, pods, herds, schools: schoolList, schoolPos, spray, splash, leap, shoals, band, escort: esc, breach: bre, boats, onSplash: null };
  // A body breaking the surface throws water: the eye is right beside it, so the spray is round the focus.
  look.onCross((dir, speed, s) => { if (dir === 'up') spray(fpos, 1.2 + s * 1.6); });
  return life;
}
