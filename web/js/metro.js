// The skyscraper city (Randy, 2 Nov: "We need ground cities too with skyscrapers and full anime type POIs we can visit and do fights in"; that night: "What about the skyscrapers cities? We need that design and implemented too").
// Laid out from the cities study, Pipeline/research/CITY_SOURCES.md §4, in its order: the island, the plan, the heights, the towers, the street, then the places.
// The plan: a 64 m pitch, 52 m blocks and 12 m streets, every third street an avenue. The heights: a 31 m roofline, as old Tokyo's height limit left a level cornice that towers later broke, with rare towers rising out of it
// (31 + 155 r³ in the core, as one open city generator does), and the top storeys stepped back off the street, as Japan's road-slant rule cuts them. A tower is stretched boxes, one draw for every tier of every building,
// and its windows are rooms drawn in the shader by van Dongen's interior mapping: a ray into a box one bay wide and one storey high, so a city of rooms costs no textures at all.
// Working names, owed a names search: Saltlight, the Signal Mast, the Bell Ring.
import * as THREE from 'three';

export const METRO = { id: 'saltlight', name: 'Saltlight', x: -680, y: 700, R: 270, Z: 7 };
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const PITCH = 64, BLOCK = 52, STOREY = 3.4, DATUM = 31, EXTENT = 220;
// the grid the street life walks and drives on (streetlife.js)
export const GRID = { PITCH, BLOCK, EXTENT };
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

export function addMetro(data) {
  if (data.poi.some((p) => p.id === METRO.id)) return;
  data.poi.push({ id: METRO.id, name: METRO.name, x: METRO.x, y: METRO.y, z: METRO.Z, r: METRO.R * 0.86, noBreak: true, metro: true });
  // what stood on this sea floor is under the city now
  const under = (x, y) => Math.hypot(x - METRO.x, y - METRO.y) < METRO.R * 1.05;
  for (const k in data.instances) { const L = data.instances[k]; let hit = false; for (let i = 0; i < L.length; i += 6) if (under(L[i], L[i + 1])) { hit = true; break; } if (!hit) continue; const keep = []; for (let i = 0; i < L.length; i += 6) if (!under(L[i], L[i + 1])) keep.push(L[i], L[i + 1], L[i + 2], L[i + 3], L[i + 4], L[i + 5]); data.instances[k] = keep; }
  for (const s of data.schools || []) if (under(s.x, s.y)) { const a = Math.atan2(s.y - METRO.y, s.x - METRO.x); s.x = METRO.x + Math.cos(a) * METRO.R * 1.5; s.y = METRO.y + Math.sin(a) * METRO.R * 1.5; }
}
// the ground: flat at the street datum, a quay wall at the city's edge, and the sea bed beyond
export function metroZ(x, y, bed) {
  const d = Math.hypot(x - METRO.x, y - METRO.y) / METRO.R; if (d >= 1.35) return bed;
  if (d < 0.86) return METRO.Z;
  if (d < 0.9) return METRO.Z + (-10 - METRO.Z) * smooth((d - 0.86) / 0.04);
  return -10 + (Math.min(bed, -10) + 10) * smooth((d - 0.9) / 0.45);
}
export function raiseMetro(data, Hz, n, cell, ox, oy) {
  const near = Math.ceil((METRO.R * 1.4) / cell), ci = Math.round((METRO.x - ox) / cell), cj = Math.round((METRO.y - oy) / cell);
  for (let j = Math.max(0, cj - near); j <= Math.min(n - 1, cj + near); j++) for (let i = Math.max(0, ci - near); i <= Math.min(n - 1, ci + near); i++) { const o = j * n + i; Hz[o] = metroZ(ox + i * cell, oy + j * cell, Hz[o]); }
  for (const p of data.pearls || []) if (Math.hypot(p[0] - METRO.x, p[1] - METRO.y) < METRO.R * 0.9) p[2] = METRO.Z + 1.3;
}

// ---------------------------------------------------------------- the plan
// Every box is { x, y (data), z0, h, sx, sy, yaw, seed, foot, kind, bay }: kind 0 a storeyed volume with windows, 1 roof gear, 2 an aircraft lamp
export function planMetro(data) {
  const rnd = rngOf(90210), boxes = [], colliders = [], signs = [], cx = METRO.x, cy = METRO.y, Z = METRO.Z; let tall60 = 0, tall150 = 0, lots = 0;
  const box = (b) => { boxes.push(b); if (b.kind !== 2) colliders.push({ t: 'box', x: b.x, y: b.y, z0: b.z0, z1: b.z0 + b.h, hx: b.sx / 2, hy: b.sy / 2, yaw: b.yaw || 0, city: METRO.id, type: 'tower' }); };
  // the places take their blocks first: the Bell Ring a square of four, east of the centre; the Signal Mast on the western quay, where the sea sees it
  const ring = { i0: 1, j0: -1, x: cx + 1.5 * PITCH, y: cy - 0.5 * PITCH }, mast = { x: cx - 3 * PITCH, y: cy };
  const taken = (i, j) => (i >= 1 && i <= 2 && j >= -1 && j <= 0) || (i === -3 && j === 0);
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
    const bx = cx + i * PITCH, by = cy + j * PITCH, dc = Math.hypot(bx - cx, by - cy); if (dc > EXTENT - 20 || taken(i, j)) continue;
    // every third street an avenue: the blocks beside it give up 4 m to it
    const wX = BLOCK - (i % 3 === 0 ? 4 : 0), wY = BLOCK - (j % 3 === 0 ? 4 : 0);
    const one = dc < 100 ? rnd() < 0.5 : rnd() < 0.15;
    const plots = one ? [[bx, by, wX, wY]] : [[bx - wX / 4, by - wY / 4, wX / 2 - 2, wY / 2 - 2], [bx + wX / 4, by - wY / 4, wX / 2 - 2, wY / 2 - 2], [bx - wX / 4, by + wY / 4, wX / 2 - 2, wY / 2 - 2], [bx + wX / 4, by + wY / 4, wX / 2 - 2, wY / 2 - 2]];
    for (const [px, py, pw, pd] of plots) {
      const d = Math.hypot(px - cx, py - cy), seed = rnd(); lots++;
      let h = d < 100 ? DATUM + 155 * rnd() ** 3 : d < 170 ? (rnd() < 0.6 ? DATUM : 15 + 15 * rnd()) : 15 + 15 * rnd();
      if (h > 60 && (tall60 + 1) / lots > 0.2) h = DATUM + 20 * rnd(); if (h > 150 && tall150 >= 3) h = 90 + 50 * rnd(); if (h > 60) tall60++; if (h > 150) tall150++;
      h = Math.max(STOREY * 4, Math.round(h / STOREY) * STOREY); const bay = [3.2, 4.0, 4.8, 3.6][Math.floor(seed * 4)];
      if (h <= DATUM + 0.1) {
        // a mid-rise: its block of storeys, and the top one stepped back off the street
        const top = h > 18 ? STOREY : 0; box({ x: px, y: py, z0: Z, h: h - top, sx: pw - 1, sy: pd - 1, seed, foot: Z, kind: 0, bay });
        if (top) box({ x: px, y: py, z0: Z + h - top, h: top, sx: pw - 6.5, sy: pd - 6.5, seed, foot: Z, kind: 0, bay });
        if (rnd() < 0.45) box({ x: px + (rnd() - 0.5) * pw * 0.4, y: py + (rnd() - 0.5) * pd * 0.4, z0: Z + h, h: 2.6, sx: 3, sy: 3, seed, foot: Z, kind: 1, bay });
        // its blade signs: up the corner, out over the street
        if (rnd() < 0.8) { const n = 1 + Math.floor(rnd() * 2); for (let k = 0; k < n; k++) { const side = rnd() < 0.5, sgn = rnd() < 0.5 ? -1 : 1; signs.push({ x: px + (side ? sgn * (pw / 2 + 0.7) : (rnd() - 0.5) * pw * 0.7), y: py + (side ? (rnd() - 0.5) * pd * 0.7 : sgn * (pd / 2 + 0.7)), z: Z + 4.5 + rnd() * 3, h: 4 + rnd() * Math.min(9, h - 9), yaw: side ? 0 : Math.PI / 2, hue: Math.floor(rnd() * 6), seed: rnd() }); } }
        continue;
      }
      // a tower: a podium to the roofline, a shaft that rises out of it, its shape one of five, its top stepped back and crowned
      const pod = Math.min(DATUM, 10 + Math.round(rnd() * 4) * STOREY), mass = Math.floor(rnd() * 5), shaftW = pw * (0.55 + 0.2 * rnd()), shaftD = pd * (0.55 + 0.2 * rnd());
      box({ x: px, y: py, z0: Z, h: pod, sx: pw - 1, sy: pd - 1, seed, foot: Z, kind: 0, bay });
      const H = h - 2 * STOREY;
      if (mass === 0) box({ x: px, y: py, z0: Z + pod, h: H - pod, sx: shaftW, sy: shaftD * 0.62, seed, foot: Z, kind: 0, bay });
      else if (mass === 1) { const m1 = pod + (H - pod) * 0.6; box({ x: px, y: py, z0: Z + pod, h: m1 - pod, sx: shaftW, sy: shaftD, seed, foot: Z, kind: 0, bay }); box({ x: px, y: py, z0: Z + m1, h: H - m1, sx: shaftW - 6, sy: shaftD - 6, seed, foot: Z, kind: 0, bay }); }
      else if (mass === 2) { const g = shaftW * 0.42; box({ x: px - shaftW * 0.29, y: py, z0: Z + pod, h: H - pod, sx: g, sy: shaftD, seed, foot: Z, kind: 0, bay }); box({ x: px + shaftW * 0.29, y: py, z0: Z + pod, h: (H - pod) * 0.78, sx: g, sy: shaftD, seed: (seed + 0.37) % 1, foot: Z, kind: 0, bay }); }
      else if (mass === 3) { let z = pod, w = shaftW, dd = shaftD; for (let t = 0; t < 3; t++) { const hh = (H - pod) / 3; box({ x: px, y: py, z0: Z + z, h: hh, sx: w, sy: dd, seed, foot: Z, kind: 0, bay }); z += hh; w -= 4; dd -= 4; } }
      else { box({ x: px, y: py, z0: Z + pod, h: (H - pod) * 0.7, sx: shaftW, sy: shaftD, seed, foot: Z, kind: 0, bay }); box({ x: px, y: py, z0: Z + pod + (H - pod) * 0.7, h: (H - pod) * 0.3, sx: Math.min(shaftW, shaftD) * 0.78, sy: Math.min(shaftW, shaftD) * 0.78, yaw: Math.PI / 4, seed, foot: Z, kind: 0, bay }); }
      // the setback storeys, and the crown
      const tw = mass === 2 ? shaftW * 0.42 : mass === 3 ? shaftW - 8 : mass === 4 ? Math.min(shaftW, shaftD) * 0.78 : shaftW, td = mass === 0 ? shaftD * 0.62 : mass === 2 ? shaftD : mass === 3 ? shaftD - 8 : mass === 4 ? Math.min(shaftW, shaftD) * 0.78 : shaftD - (mass === 1 ? 6 : 0);
      const ox = mass === 2 ? px - shaftW * 0.29 : px, yaw = mass === 4 ? Math.PI / 4 : 0, wTop = (mass === 1 ? tw - 6 : tw);
      box({ x: ox, y: py, z0: Z + H, h: STOREY, sx: wTop - 5.5, sy: td - 5.5, yaw, seed, foot: Z, kind: 0, bay });
      box({ x: ox, y: py, z0: Z + H + STOREY, h: STOREY, sx: wTop - 11, sy: td - 11, yaw, seed, foot: Z, kind: 0, bay });
      const crown = Math.floor(rnd() * 3), topZ = Z + H + 2 * STOREY;
      if (crown === 0) { const sh = 10 + rnd() * 22; box({ x: ox, y: py, z0: topZ, h: sh, sx: 1.4, sy: 1.4, seed, foot: Z, kind: 1, bay }); if (topZ + sh > 100) box({ x: ox, y: py, z0: topZ + sh, h: 0.9, sx: 0.9, sy: 0.9, seed, foot: Z, kind: 2, bay }); }
      else if (crown === 1) { for (let k = 0; k < 3; k++) box({ x: ox + (k - 1) * 3.6, y: py + (rnd() - 0.5) * 3, z0: topZ, h: 3 + rnd() * 2, sx: 2.8, sy: 2.8, seed, foot: Z, kind: 1, bay }); if (topZ > 100) box({ x: ox, y: py, z0: topZ + 5, h: 0.9, sx: 0.9, sy: 0.9, seed, foot: Z, kind: 2, bay }); }
      else if (topZ > 100) box({ x: ox, y: py, z0: topZ, h: 0.9, sx: 0.9, sy: 0.9, seed, foot: Z, kind: 2, bay });
    }
  }
  // the Bell Ring: an octagon ring raised 1.5 m on a moat, a bowl of steps round it, four banner masts and a bronze bell hung over the middle
  const R0 = 20, BOWL = 46;
  colliders.push({ t: 'cyl', x: ring.x, y: ring.y, z0: Z - 2, z1: Z + 1.5, r: R0, city: METRO.id, type: 'ring' });
  for (let k = 0; k < 4; k++) { const r1 = 28 + k * 4.5; for (let a = 0; a < 16; a++) { const ang = (a / 16) * Math.PI * 2, x = ring.x + Math.cos(ang) * r1, y = ring.y + Math.sin(ang) * r1; colliders.push({ t: 'box', x, y, z0: Z, z1: Z + 0.8 + k * 0.8, hx: 2.3, hy: (r1 * Math.PI * 2) / 32 + 0.4, yaw: ang, city: METRO.id, type: 'bowl' }); } }
  // the Signal Mast: three legs, decks at 110 and 190 m you can stand on, 240 m to its tip
  colliders.push({ t: 'cyl', x: mast.x, y: mast.y, z0: Z, z1: Z + 17, r: 13, city: METRO.id, type: 'mast_base' }, { t: 'cyl', x: mast.x, y: mast.y, z0: Z + 108, z1: Z + 110, r: 9.5, city: METRO.id, type: 'mast_deck' }, { t: 'cyl', x: mast.x, y: mast.y, z0: Z + 188, z1: Z + 190, r: 6, city: METRO.id, type: 'mast_deck' });
  return { boxes, colliders, signs, ring: { ...ring, R0, BOWL }, mast, center: { x: cx, y: cy } };
}

// ---------------------------------------------------------------- what's drawn
function boxGeo() {
  // a unit box standing on its base, no floor: ten triangles
  const P = [], N = [], F = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]];
  for (const n of F) { const u = n[1] ? [1, 0, 0] : [-n[2], 0, n[0]], v = n[1] ? [0, 0, -1] : [0, 1, 0], c = [n[0] * 0.5, n[1] ? 1 : 0.5, n[2] * 0.5]; const q = (a, b) => [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b, c[2] + u[2] * a + v[2] * b]; const A = q(-0.5, -0.5), B = q(0.5, -0.5), C = q(0.5, 0.5), Dd = q(-0.5, 0.5); for (const p of [A, B, C, A, C, Dd]) { P.push(...p); N.push(...n); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return g;
}

export function buildMetro({ scene, look, plan, phone }) {
  const Z = METRO.Z, meshes = [], B = plan.boxes, n = B.length;
  // the towers: every tier of every building in one draw. Per box: its seed, the height of its building's foot, its kind, its window bay
  const geo = boxGeo(), tw = new Float32Array(n * 4); geo.setAttribute('aTw', new THREE.InstancedBufferAttribute(tw, 4));
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.05 });
  look.patch(mat, { key: 'metro', ink: true,
    vertexDecl: 'attribute vec4 aTw;\nvarying vec4 vTw; varying vec3 vFa; varying vec3 vWN;\n',
    // each face's own metres: u along it, v above the building's foot, so storeys stay true however the box is stretched (the study's Appendix A)
    vertexBend: /* glsl */`{ vTw = aTw; vec3 S = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vec3 tl = vec3(normal.z, 0.0, -normal.x); float W = abs(normal.x) > .5 ? S.z : S.x;
      vFa = vec3((dot(position, tl) + .5)*W, position.y*S.y + (instanceMatrix[3].y - aTw.y), normal.y > .5 ? 1.0 : 0.0); vWN = normalize(mat3(instanceMatrix)*normal); }`,
    fragmentPars: /* glsl */`varying vec4 vTw; varying vec3 vFa; varying vec3 vWN;
      float mh(float x) { return fract(sin(x*127.1)*43758.5453); }
      // a room behind the glass: a ray into a box one bay wide and one storey deep, tested against only the three planes it faces (van Dongen 2008)
      vec3 ocRoom(vec2 f, vec3 rd, vec2 cell, float d, float id, float lit, float near) {
        vec3 r = rd/vec3(cell, d), p = vec3(f, 0.0), t3 = (step(vec3(0.0), r) - p)/r; float t = min(t3.z, min(t3.x, t3.y)); vec3 h = p + r*t;
        float h1 = mh(id*7.31), h2 = mh(id*3.17), h3 = mh(id*5.77); vec3 wall = mix(vec3(.60, .55, .46), vec3(.42, .50, .56), step(.5, h1));
        vec3 c = t == t3.z ? wall*(.72 + .28*h.y) : t == t3.x ? wall*.58 : r.y > 0.0 ? mix(wall*.86, vec3(1.0, .86, .62)*1.7, exp(-dot(h.xz - vec2(.5, .3), h.xz - vec2(.5, .3))*7.0)) : mix(vec3(.15, .12, .10), vec3(.30, .24, .19), h2);
        if (near > .5) { float tf = (.40 + .25*h3)/r.z; if (tf < t) { vec3 q = p + r*tf; if (q.y < .28 + .22*h3 && fract(q.x*(2.0 + floor(h2*3.0)) + h1) < .7) c = vec3(.045, .045, .06); } }
        return c*mix(.05, 1.0, lit); }
      vec3 ocWin; float ocWinGlow;\n`,
    albedo: /* glsl */`{
      float seed = vTw.x, kind = vTw.z, dist = length(vOcP - cameraPosition); ocWin = vec3(0.0); ocWinGlow = 0.0;
      if (kind > .5) { diffuseColor.rgb = kind > 1.5 ? vec3(.25, .02, .02) : vec3(.16, .165, .17)*(.8 + .25*mh(seed*9.0)); }
      else if (vFa.z > .5) { vec2 g = fract(vOcP.xz*.5); diffuseColor.rgb = vec3(.11, .11, .12)*(.9 + .1*step(.95, max(g.x, g.y))); }
      else {
        // four facade families by the building's seed: curtain glass, punched stone, ribbon windows, and fins. Walls in the measured anime-city creams and greys
        float fam = floor(mh(seed*13.7)*4.0); vec2 cell = vec2(vTw.w, ${STOREY.toFixed(1)}); vec2 uv = vFa.xy, f = fract(uv/cell), id2 = floor(uv/cell);
        // the anime city's walls: a warm cream, a warm grey, a brick and a slate, picked by the seed (§2's measured street, lit #decb9e on teal shade #273b40)
        float wk = mh(seed*3.3); vec3 stone = (wk < .4 ? vec3(.40, .33, .20) : wk < .7 ? vec3(.25, .245, .235) : wk < .85 ? vec3(.28, .12, .07) : vec3(.075, .085, .095))*mix(.88, 1.08, mh(seed*5.1)), frame = fam < .5 ? vec3(.05, .055, .06) : stone*.7;
        float mx = fam < .5 ? .05 : fam < 1.5 ? .3 : fam < 2.5 ? .0 : .2, mb = fam < .5 ? .08 : fam < 1.5 ? .28 : fam < 2.5 ? .36 : .06, mt = fam < .5 ? .06 : fam < 1.5 ? .22 : fam < 2.5 ? .2 : .06;
        bool shop = uv.y < 6.8; if (shop) { mx = .04; mb = .06; mt = uv.y > 3.4 ? .5 : .12; }
        bool win = f.x > mx && f.x < 1.0 - mx && f.y > mb && f.y < 1.0 - mt;
        vec3 col = frame;
        if (win) {
          vec3 Fn = normalize(vWN), T = vec3(Fn.z, 0.0, -Fn.x), V = normalize(vOcP - cameraPosition), rd = vec3(dot(V, T), V.y, -dot(V, Fn));
          float rid = id2.x*17.0 + id2.y*131.0 + seed*977.0, share = .15 + .45*mh(seed*21.0), floorLit = step(mh(seed*41.0), .25)*step(mh(id2.y + seed*61.0), share*1.6), lit = max(step(mh(rid), share), floorLit);
          vec2 wf = vec2((f.x - mx)/(1.0 - 2.0*mx), (f.y - mb)/(1.0 - mb - mt));
          vec3 room = dist < 270.0 ? ocRoom(wf, rd, cell*vec2(1.0 - 2.0*mx, 1.0 - mb - mt), 4.0, rid, mix(.35, lit, ocNight), dist < 40.0 ? 1.0 : 0.0) : mix(vec3(.10, .12, .14), vec3(.9, .75, .5), lit*ocNight)*(.6 + .4*mh(floor(uv.x/(cell.x*3.0)) + floor(uv.y/(cell.y*2.0))*7.0));
          if (shop) room = mix(vec3(.55, .48, .36), vec3(.70, .58, .40), mh(rid))*(uv.y < 3.4 ? 1.0 : .25);
          // the glass: the room through it head on, the sky in it at a glance
          float fres = pow(1.0 - abs(dot(V, Fn)), 3.0); vec3 sky = mix(vec3(.10, .21, .31), vec3(.02, .03, .06), ocNight);
          col = mix(room, sky, clamp(fres*.85 + (fam < .5 ? .18 : .06), 0.0, 1.0));
          ocWin = room; ocWinGlow = shop ? 1.0 : lit*ocNight;
        } else col = fam < .5 && !shop ? frame : stone*(.92 + .08*mh(id2.x + id2.y*3.0));
        diffuseColor.rgb = col;
      }
      // the shade is chosen, not computed (the study's A3, from a fighting game's art talk): a face turned from the sun takes a teal tint, so lit to shade runs about 6 to 1 as anime streets do
      if (kind < .5) diffuseColor.rgb *= mix(vec3(.22, .36, .45), vec3(1.0), smoothstep(-.05, .3, dot(normalize(vWN), normalize(ocSunA)))); }`,
    glow: /* glsl */`{ ocGlow = ocWin*ocWinGlow*(.25 + .9*ocNight); if (vTw.z > 1.5) ocGlow = vec3(1.0, .08, .04)*(.4 + 3.0*step(.5, fract(ocTime*.5 + vTw.x)))*(.3 + .7*ocNight); }`,
  });
  const towers = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  B.forEach((b, i) => { q.setFromAxisAngle(Y, b.yaw || 0); m4.compose(p.set(b.x, b.z0, -b.y), q, s.set(b.sx, b.h, b.sy)); towers.setMatrixAt(i, m4); tw[i * 4] = b.seed; tw[i * 4 + 1] = b.foot; tw[i * 4 + 2] = b.kind; tw[i * 4 + 3] = b.bay; });
  towers.frustumCulled = false; towers.name = 'metro_towers'; scene.add(towers); meshes.push(towers);

  // the street: one ground, its asphalt, kerbs, pavements, avenue lanes and zebra crossings all drawn in the shader from the plan's grid (C14, C18)
  const groundGeo = new THREE.CircleGeometry(METRO.R * 0.86, phone ? 48 : 72).rotateX(-Math.PI / 2), gm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  look.patch(gm, { key: 'metro_ground',
    fragmentPars: `uniform vec2 uMetroC;\n`,
    // the plan's blocks are centred on the grid's points, so a block runs from -BLOCK/2 to +BLOCK/2 and the street from there to the next block (this drew them 6 m off, half of each street as pale paving).
    // A 12 m street: a 2.5 m pavement each side with its kerb, and two 3.5 m lanes, the way a city's local street is laid out; crossings at every corner
    albedo: /* glsl */`{ vec2 w = vec2(vOcP.x, -vOcP.z) - uMetroC + ${(BLOCK / 2).toFixed(1)}; vec2 c = mod(w, ${PITCH.toFixed(1)});
      vec2 inS = step(vec2(${BLOCK.toFixed(1)}), c), u = c - ${BLOCK.toFixed(1)}; float street = max(inS.x, inS.y), cross = inS.x*inS.y;
      float n1 = fract(sin(dot(floor(vec2(vOcP.x, vOcP.z)*.8), vec2(12.9, 78.2)))*437.5);
      // the pavement: concrete flags 1.5 m square, their joints darker; on a block it runs up to the buildings
      vec2 fl = abs(fract(vec2(vOcP.x, vOcP.z)/1.5) - .5); float joint = step(.47, max(fl.x, fl.y));
      vec3 pave = vec3(.30, .29, .27)*(.92 + .08*n1)*(1.0 - .22*joint);
      vec3 col = pave;
      if (street > .5) {
        // across the street: 0 to 12 m from one block's edge to the next; pavements on 0-2.5 and 9.5-12, a kerb at their edge
        float ax = inS.x*(1.0 - inS.y), ay = inS.y*(1.0 - inS.x);
        float acr = ax > .5 ? u.x : u.y, along = ax > .5 ? c.y : c.x;
        vec3 asph = vec3(.050, .050, .055)*(.9 + .1*n1);
        if (cross > .5) {
          // the crossing itself: asphalt, with the pavements' corners squared off
          float cx0 = min(u.x, ${(PITCH - BLOCK).toFixed(1)} - u.x), cy0 = min(u.y, ${(PITCH - BLOCK).toFixed(1)} - u.y);
          col = (cx0 < 2.5 && cy0 < 2.5) ? pave : asph;
        } else {
          float side = min(acr, ${(PITCH - BLOCK).toFixed(1)} - acr);
          if (side < 2.5) col = mix(pave, vec3(.46, .45, .42), step(2.3, side));
          else {
            col = asph;
            // the centre line, dashed 3 m in 9; the crossings: white bars 0.5 m wide across the lanes, 4 m deep, at each end of the block
            float centre = step(abs(acr - 6.0), .08)*step(fract(along/9.0), .34);
            float zeb = (step(along, 4.0) + step(${(BLOCK - 4).toFixed(1)}, along))*step(.5, fract(acr/1.0));
            float stopL = step(abs(along - 4.4), .2) + step(abs(along - ${(BLOCK - 4.4).toFixed(1)}), .2);
            col = mix(col, vec3(.70, .70, .66), clamp(centre + zeb + stopL*step(acr, 6.0)*(1.0 - step(${(BLOCK / 2).toFixed(1)}, along)) + stopL*step(6.0, acr)*step(${(BLOCK / 2).toFixed(1)}, along), 0.0, 1.0));
          }
        }
      }
      diffuseColor.rgb = col; }`,
  });
  gm.userData.uMetroC = { value: new THREE.Vector2(plan.center.x, plan.center.y) };
  { const ob = gm.onBeforeCompile; gm.onBeforeCompile = function (sh, r) { ob && ob.call(this, sh, r); sh.uniforms.uMetroC = gm.userData.uMetroC; }; }
  const ground = new THREE.Mesh(groundGeo, gm); ground.position.set(METRO.x, Z + 0.03, -METRO.y); ground.name = 'metro_ground'; scene.add(ground);

  // the blade signs (C12): original glyphs only, no brand and no real writing, in the neon hues measured off anime streets. One quad each, one draw
  const S = plan.signs.slice(0, phone ? 260 : 600), sgGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), sd = new Float32Array(S.length * 4); sgGeo.setAttribute('aSg', new THREE.InstancedBufferAttribute(sd, 4));
  const sgm = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  sgm.onBeforeCompile = (sh) => {
    sh.uniforms.ocTime = look.uniforms.ocTime; sh.uniforms.ocNight = look.uniforms.ocNight;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aSg; varying vec4 vSg; varying vec2 vSu;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSg = aSg; vSu = vec2(position.x + .5, position.y);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float ocTime, ocNight; varying vec4 vSg; varying vec2 vSu;\nfloat sh1(float x) { return fract(sin(x*91.7)*43758.5); }').replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );
      { vec3 hue = vSg.x < .5 ? vec3(.81, .34, .37) : vSg.x < 1.5 ? vec3(.35, .68, .75) : vSg.x < 2.5 ? vec3(.40, .81, .75) : vSg.x < 3.5 ? vec3(.31, .63, .45) : vSg.x < 4.5 ? vec3(.67, .51, .29) : vec3(.65, .36, .27);
        float rows = max(2.0, floor(vSg.z)); vec2 g = vec2(vSu.x, vSu.y*rows); vec2 gi = floor(g*vec2(4.0, 4.0)), gf = fract(g);
        float cellOn = step(.45, sh1(gi.x + gi.y*7.0 + floor(g.y)*31.0 + vSg.y*300.0)), inner = step(.12, vSu.x)*step(vSu.x, .88)*step(.03, fract(g.y))*step(fract(g.y), .9);
        float border = 1.0 - step(.06, vSu.x)*step(vSu.x, .94)*step(.02, vSu.y)*step(vSu.y, .98), flick = .85 + .15*step(.97, sh1(floor(ocTime*8.0) + vSg.y*50.0));
        vec3 c = mix(vec3(.04, .04, .05), hue*1.6, max(border, cellOn*inner)*flick); diffuseColor.rgb = c*(.55 + .9*ocNight); }`);
  };
  const signs = new THREE.InstancedMesh(sgGeo, sgm, Math.max(1, S.length));
  S.forEach((g, i) => { q.setFromAxisAngle(Y, g.yaw); m4.compose(p.set(g.x, g.z, -g.y), q, s.set(1.2, g.h, 1)); signs.setMatrixAt(i, m4); sd[i * 4] = g.hue; sd[i * 4 + 1] = g.seed; sd[i * 4 + 2] = g.h / 1.1; sd[i * 4 + 3] = 0; });
  signs.count = S.length; signs.frustumCulled = false; signs.name = 'metro_signs'; scene.add(signs);

  // the Signal Mast (§4d 5): three legs leaning in to a 240 m tip, cross-braced, two decks, painted in the red and white bands that air safety asks of a tall mast
  const mastGeo = (() => {
    const parts = [], M = plan.mast, legs = 3, H = 240, base = 12, add = (g) => parts.push(g);
    const strut = (a, b, r) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(), g = new THREE.CylinderGeometry(r, r, L, 4, 1); g.translate(0, L / 2, 0); const qq = new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()); g.applyQuaternion(qq); g.translate(a.x, a.y, a.z); const c = new Float32Array(g.attributes.position.count); for (let i = 0; i < c.length; i++) { const yy = g.attributes.position.getY(i); c[i] = Math.floor(yy / 24) % 2; } g.setAttribute('aBand', new THREE.BufferAttribute(c, 1)); add(g); };
      const legAt = (k, y) => { const r = base * (1 - y / H) + 1.2 * (y / H), a = (k / legs) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); };
    for (let k = 0; k < legs; k++) strut(legAt(k, 0), legAt(k, H), 0.55);
    for (let y = 0; y < H - 16; y += 16) for (let k = 0; k < legs; k++) { strut(legAt(k, y), legAt((k + 1) % legs, y + 16), 0.18); strut(legAt((k + 1) % legs, y), legAt(k, y + 16), 0.18); }
    for (const [y, r] of [[110, 9.5], [190, 6]]) { const g = new THREE.CylinderGeometry(r, r, 2, 12, 1); g.translate(0, y - 1, 0); const c = new Float32Array(g.attributes.position.count).fill(2); g.setAttribute('aBand', new THREE.BufferAttribute(c, 1)); add(g); }
    { const g = new THREE.CylinderGeometry(13, 14, 17, 12, 1); g.translate(0, 8.5, 0); const c = new Float32Array(g.attributes.position.count).fill(3); g.setAttribute('aBand', new THREE.BufferAttribute(c, 1)); add(g); }
    const all = parts.map((g) => g.toNonIndexed()); let cnt = 0; for (const g of all) cnt += g.attributes.position.count; const P = new Float32Array(cnt * 3), Nn = new Float32Array(cnt * 3), Bd = new Float32Array(cnt); let o = 0;
    for (const g of all) { g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); Nn.set(g.attributes.normal.array, o * 3); Bd.set(g.attributes.aBand.array, o); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); out.setAttribute('aBand', new THREE.BufferAttribute(Bd, 1)); out.translate(M.x, Z, -M.y); return out;
  })();
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3 });
  look.patch(mastMat, { key: 'metro_mast', vertexDecl: 'attribute float aBand;\nvarying float vBand; varying float vMy;\n', vertexBend: '{ vBand = aBand; vMy = position.y; }', fragmentPars: 'varying float vBand; varying float vMy;\n',
    albedo: '{ diffuseColor.rgb = vBand > 2.5 ? vec3(.26, .26, .27) : vBand > 1.5 ? vec3(.55, .55, .57) : vBand > .5 ? vec3(.55, .05, .03) : vec3(.66, .66, .68); }',
    glow: '{ ocGlow = vec3(1.0, .08, .04)*step(vMy, 9999.0)*0.0 + vec3(1.0, .1, .05)*step(.5, fract(ocTime*.5))*step(234.0 + 7.0, vMy)*(.5 + 2.0*ocNight); }' });
  const mastM = new THREE.Mesh(mastGeo, mastMat); mastM.name = 'metro_mast'; mastM.frustumCulled = false; scene.add(mastM);

  // the Bell Ring (§4d 1): the floor bright as a tournament floor so every silhouette reads, a dark moat round it, steps rising to the bowl's rim, four banner masts and the bell
  const ringGeo = (() => {
    const R = plan.ring, parts = [], tag = (g, k) => { const c = new Float32Array(g.attributes.position.count).fill(k); g.setAttribute('aK', new THREE.BufferAttribute(c, 1)); parts.push(g.toNonIndexed()); };
    { const g = new THREE.CylinderGeometry(R.R0, R.R0, 3.5, 8, 1); g.rotateY(Math.PI / 8); g.translate(0, -0.25, 0); tag(g, 0); }
    { const g = new THREE.RingGeometry(R.R0, R.R0 + 5, 32, 1); g.rotateX(-Math.PI / 2); g.translate(0, -0.6, 0); tag(g, 1); }
    for (let k = 0; k < 4; k++) { const r1 = 26 + k * 4.5, g = new THREE.CylinderGeometry(r1 + 2.3, r1 + 2.3, 0.8 + k * 0.8, 32, 1, true); g.translate(0, (0.8 + k * 0.8) / 2, 0); tag(g, 2); const top = new THREE.RingGeometry(r1 - 2.3, r1 + 2.3, 32, 1); top.rotateX(-Math.PI / 2); top.translate(0, 0.8 + k * 0.8, 0); tag(top, 2); }
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2, x = Math.cos(a) * (R.BOWL - 2), z = Math.sin(a) * (R.BOWL - 2); const m = new THREE.CylinderGeometry(0.35, 0.45, 40, 6, 1); m.translate(x, 20, z); tag(m, 3); const b = new THREE.PlaneGeometry(3, 12); b.translate(x + 1.7, 32, z); tag(b, 4); }
    { const g = new THREE.BoxGeometry(2 * R.R0 + 8, 1, 1); g.translate(0, 22, 0); tag(g, 3); for (const sx of [-1, 1]) { const p = new THREE.BoxGeometry(1, 22, 1); p.translate(sx * (R.R0 + 4), 11, 0); tag(p, 3); } }
    { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.4 + 2.6 * Math.pow(t, 1.6) + (t > 0.85 ? 0.4 : 0), 21.5 - 6 * t)); } const g = new THREE.LatheGeometry(pts, 16); tag(g, 5); }
    let cnt = 0; for (const g of parts) cnt += g.attributes.position.count; const P = new Float32Array(cnt * 3), K = new Float32Array(cnt); let o = 0;
    for (const g of parts) { P.set(g.attributes.position.array, o * 3); K.set(g.attributes.aK.array, o); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('aK', new THREE.BufferAttribute(K, 1)); out.computeVertexNormals(); out.translate(R.x, Z + 1.5, -R.y); return out;
  })();
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide });
  look.patch(ringMat, { key: 'metro_ring', vertexDecl: 'attribute float aK;\nvarying float vK;\n', vertexBend: '{ vK = aK; }', fragmentPars: 'varying float vK;\n',
    albedo: '{ vec2 g = fract(vOcP.xz*.25); float line = step(.96, max(g.x, g.y)); diffuseColor.rgb = vK < .5 ? mix(vec3(.80, .82, .84), vec3(.40, .48, .58), line) : vK < 1.5 ? vec3(.01, .025, .035) : vK < 2.5 ? vec3(.26, .25, .23) : vK < 3.5 ? vec3(.08, .085, .09) : vK < 4.5 ? vec3(.45, .06, .05) : vec3(.30, .18, .07); }',
    glow: '{ ocGlow = vK > 3.5 && vK < 4.5 ? vec3(.3, .03, .02)*ocNight : vec3(0.0); }' });
  const ringM = new THREE.Mesh(ringGeo, ringMat); ringM.name = 'metro_ring'; scene.add(ringM);

  // seen from far: the whole city draws from 1,100 m, the mast from the far plane, so the skyline is there to fly at
  const centre = new THREE.Vector3(METRO.x, Z, -METRO.y);
  function update(camera) { const d = camera.position.distanceTo(centre); const on = d < 1150; towers.visible = on; ground.visible = d < 700; signs.visible = d < 500; ringM.visible = d < 900; mastM.visible = true; }
  return { meshes: [towers], all: [towers, ground, signs, mastM, ringM], update, plan };
}
