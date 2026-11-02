// Saltlight's buildings, from the AAA3d city. Randy, 2 Nov: "This city is terrible! Revamp it fully. The buildings are literally flawed dude" · "We need to download other models and put it there.
// It also looks flat with no foliage. We have AAA3d city here in the orgo_u repo. Use that and make it work with our memory budget and art style".
// The source is orgo_u/aaa3d at fe8f7c1 (his own engine): world/cityGen.js, three.js r185's CityGenerator, SkyscraperGenerator and SidewalkGenerator carried as they are (MIT), and
// world/cityFacade.js, the generator's own facade in WebGL (brick in running bond, mortar crisp near and gone far, a domed brick relief, soot pooling low, roof grime, dressed-stone frames, and
// glass that looks into a furnished room, lit on the clock). Copied into js/aaa3d/ with its notices; what's ours is marked "ported:" there.
// Cut to a phone (his rule: too heavy is not a no, make the optimised version), the way AAA3d's own HLOD does it: a building costs 4k to 34k triangles and 1-6 MB as the generator makes it,
// so only the nearest stand as themselves, each in one draw (createBuildingMaterial: masonry and glass chosen per fragment by the part); the rest are their own box, the same size and masonry,
// in the one instanced draw metro.js already has. One is built per update on a phone, so nothing hitches, and what falls behind is given back.
import * as THREE from 'three';
import { SkyscraperGenerator, PartId } from './aaa3d/cityGen.js';
import { createBuildingMaterial } from './aaa3d/cityFacade.js';

// the masonry by tone, linear, the same four the far boxes wear (metro_kit.js TONES[1]): buff brick, red brick, limestone, brown brick; dressed-stone trim lighter on brick, darker on stone
const BASE = [[0.42, 0.30, 0.19], [0.30, 0.13, 0.08], [0.50, 0.45, 0.36], [0.24, 0.15, 0.11]];
const TRIM = [[0.50, 0.46, 0.38], [0.50, 0.46, 0.38], [0.30, 0.28, 0.24], [0.50, 0.46, 0.38]];
// the glazing's own tints: smoke, green, bronze, blue; and the generator's off-white window units (0xf2f1ec..0xcfccc2), linear
const GLASS = [[0.035, 0.045, 0.055], [0.04, 0.055, 0.05], [0.06, 0.045, 0.035], [0.03, 0.05, 0.08]], AC = [0.76, 0.75, 0.70];

// the generator's geometry, coloured part by part the way the AAA3d city colours it (world/city.js): walls the masonry, piers a little lighter, frames the trim, ornament a fifth toward white
export function buildingGeometry(b) {
  const mesh = new SkyscraperGenerator({ ...b.gen }).build(), g = mesh.geometry, n = g.attributes.position.count, ID = g.attributes.partId.array, C = new Float32Array(n * 3);
  const base = BASE[b.tone] || BASE[0], trim = TRIM[b.tone] || TRIM[0], glass = GLASS[b.glass || 0], orn = base.map((c) => c + (1 - c) * 0.22), pier = base.map((c) => c + (1 - c) * 0.12);
  for (let i = 0; i < n; i++) {
    let id = ID[i] | 0; const col = id === PartId.GLASS ? glass : id === PartId.AC ? AC : id === PartId.FRAME ? trim : id === PartId.ORNAMENT ? orn : id === PartId.PIER ? pier : base;
    // the window units read as smooth dressed stone, never brick, as the AAA3d city does with no material library
    if (id === PartId.AC) ID[i] = PartId.FRAME;
    C[i * 3] = col[0]; C[i * 3 + 1] = col[1]; C[i * 3 + 2] = col[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.attributes.partId.needsUpdate = true;
  return g;
}

export function createNearBuildings({ scene, look, plan, towers, phone }) {
  // a film run streams all it can see, unless asked for the game's own budget (lod=game: how the cost is measured)
  const film = typeof location !== 'undefined' && /[?&]film\b/.test(location.search) && !/[?&]lod=game\b/.test(location.search);
  // how many stand as themselves, and inside what distance: a phone holds 6 (about 60k triangles and 20 MB), a film run all it can see
  const N = film ? 48 : phone ? 6 : 14, R_IN = film ? 700 : phone ? 140 : 240, R_OUT = R_IN + 30, PER = film ? 99 : phone ? 1 : 2;
  const mat = createBuildingMaterial();
  // the game's look on top (look.js): its sun, sky, fog and baked shadow; and the shade chosen as the walls' is (metro.js), a face from the sun in the teal of an anime street's shade, the base darker
  look.patch(mat, { key: 'saltlight_building', uniforms: { tOcDmg: look.uniforms.tOcDmg, ocDmgC: look.uniforms.ocDmgC } });
  { const ob = mat.onBeforeCompile; mat.onBeforeCompile = function (sh, r) { ob.call(this, sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nflat varying vec2 vSlB;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSlB = vec2(modelMatrix[3].x, modelMatrix[3].z);');
    // the damage's functions after everything the look declares (its noise among them), just before main
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'flat varying vec2 vSlB;\n' + DMG_PARS + '\nfloat slGlow = 0.0; vec3 slGlowC = vec3(0.0);\nvoid main() {')
      .replace('#include <roughnessmap_fragment>', `{ float slit = smoothstep(-.05, .3, dot(normalize(vCityNrmW), normalize(ocSunA)));
      diffuseColor.rgb *= mix(vec3(.22, .36, .45), vec3(1.0), slit) * mix(.7, 1.0, smoothstep(0.0, 2.4, vCityLocal.y));
      // its damage: the slot whose centre is this building's (scorch.js keys a building by its centre)
      vec4 slD = vec4(0.0); for (int k = 0; k < 32; k++) { vec4 c = ocDmgC[k]; if (abs(c.x - vSlB.x) + abs(c.z - vSlB.y) < .6 && c.w > 0.0) slD = max(slD, slDmgTile(k, vCityWorld)); }
      diffuseColor.rgb = slDamage(diffuseColor.rgb, slD, vCityWorld, slGlow, slGlowC); }
    #include <roughnessmap_fragment>`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += slGlowC*slGlow*1.6;'); }; }
  const blds = plan.boxes.map((b, i) => ({ b, i })).filter((e) => e.b.kind === 0 && e.b.gen), hide = new THREE.Matrix4().makeScale(0, 0, 0), keep = new Map(), M = new THREE.Matrix4();
  let t = 0, tris = 0;
  const show = (e, on) => { if (on) { towers.getMatrixAt(e.i, M); keep.set(e.i, M.clone()); towers.setMatrixAt(e.i, hide); } else if (keep.has(e.i)) { towers.setMatrixAt(e.i, keep.get(e.i)); keep.delete(e.i); } towers.instanceMatrix.needsUpdate = true; };
  function stand(e) {
    const g = buildingGeometry(e.b), m = new THREE.Mesh(g, mat); m.position.set(e.b.x, e.b.z0, -e.b.y); m.name = 'saltlight_building'; m.frustumCulled = true; g.computeBoundingSphere();
    scene.add(m); e.mesh = m; tris += g.attributes.position.count / 3; show(e, true);
  }
  function fall(e) { scene.remove(e.mesh); tris -= e.mesh.geometry.attributes.position.count / 3; e.mesh.geometry.dispose(); e.mesh = null; show(e, false); }
  // the distance to a building is to its nearest point, the eye's height counted, so a flight over the roofs streams what is under it
  const distTo = (e, c) => { const b = e.b, dx = Math.max(Math.abs(c.x - b.x) - b.sx / 2, 0), dz = Math.max(Math.abs(-c.z - b.y) - b.sy / 2, 0), dy = Math.max(c.y - (b.z0 + b.h), 0, b.z0 - c.y); return Math.hypot(dx, dy, dz); };
  function update(camera, dt = 0.016, light = { share: 0.2, glow: 4 }) {
    mat.userData.uniforms.cityLights.value.set(light.share, light.glow);
    t -= dt; if (t > 0) return; t = film ? 0 : 0.2;
    const c = camera.position; for (const e of blds) e.d = distTo(e, c);
    const want = blds.filter((e) => e.d < (e.mesh ? R_OUT : R_IN)).sort((a, b) => a.d - b.d).slice(0, N), set = new Set(want);
    for (const e of blds) if (e.mesh && !set.has(e)) fall(e);
    let built = 0; for (const e of want) { if (e.mesh) continue; if (built++ >= PER) break; stand(e); }
  }
  return { update, get stats() { return { standing: blds.filter((e) => e.mesh).length, tris: Math.round(tris), max: N, radius: R_IN }; }, material: mat };
}

// Damage (Randy, 2 Nov: "We need it with building damage too"): the same masks the houses take (scorch.js, from Frostbite 2's destruction masking, Pipeline/research/CITY_LIFE_SOURCES.md,
// "Building damage"), drawn the way the houses draw them (city_glsl.js): soot climbing from a hit in a V, stone flushing pink with heat and its windows lit from inside, an ice shell in ribs,
// and the break in three layers, the face off, coursed stone under it, then the room behind by a ray into 3 x 3.4 m cells. The tile is found round the building by a diamond and up it by its height.
export const DMG_PARS = /* glsl */`
uniform mediump sampler2DArray tOcDmg; uniform vec4 ocDmgC[32];
vec4 slDmgTile(int s, vec3 P) { vec4 c = ocDmgC[s]; vec2 p = P.xz - c.xz, a = abs(p); float q = p.x/(a.x + a.y + 1e-3), u = (p.y >= 0.0 ? 1.0 - q : 3.0 + q)*.25;
  float v = (P.y - c.y)*c.w*.85 + max(9.0 - max(a.x, a.y), 0.0)*.0167; return texture(tOcDmg, vec3(u, v, float(s))); }
// the room behind a breach: a ray into 3 x 3.4 x 3 m cells (van Dongen's interior mapping), the face it meets drawn as a lived-in room lit by the daylight through the hole: plaster walls, a timber
// floor in boards, a pale ceiling, its corners darker and its far end dimmer, so a broken wall reads as a hole into a room and not as a dark stain
vec3 slRoom(vec3 P) {
  vec3 V = normalize(P - cameraPosition) + 1e-4, cell = vec3(3.0, 3.4, 3.0), t = ((floor(P/cell) + step(0.0, V))*cell - P)/V;
  float d = min(t.x, min(t.y, t.z)); vec3 H = P + V*d, q = fract(H/cell);
  bool flr = t.y <= min(t.x, t.z) && V.y < 0.0, top = t.y <= min(t.x, t.z) && V.y > 0.0, sideX = t.x <= min(t.y, t.z);
  vec3 c = flr ? mix(vec3(.20, .12, .06), vec3(.30, .19, .10), step(.5, fract(H.x*1.6))) : top ? vec3(.46, .44, .40) : vec3(.40, .34, .27)*(.85 + .15*q.y);
  vec2 e = flr || top ? q.xz : vec2(sideX ? q.z : q.x, q.y);
  float ao = smoothstep(0.0, .14, e.x)*smoothstep(0.0, .14, 1.0 - e.x)*smoothstep(0.0, .14, e.y)*smoothstep(0.0, .14, 1.0 - e.y);
  return c*(.5 + .5*ao)*(.25 + .75*exp(-d*.18))*.7;
}
vec3 slDamage(vec3 col, vec4 D, vec3 P, inout float glow, inout vec3 glowC) {
  if (D.r + D.g + D.b + D.a < .008) return col;
  vec2 Q = vec2((P.x + P.z)*.5, P.y);
  float n1 = texture(tOcNoise, Q*.19).r, n2 = texture(tOcNoise, Q*.83).g, det = n1*.62 + n2*.38 - .5, rib = texture(tOcNoise, vec2(Q.x*.55, Q.y*.04)).b - .5;
  float fC = D.r + det*.7 + rib*.22, soot = clamp((fC - .5)*7.0 + .5, 0.0, 1.0);
  col = mix(col, col*.16 + .008, soot); glow *= 1.0 - soot;
  col = mix(col, mix(col*vec3(1.25, .72, .62), vec3(.72, .68, .62), smoothstep(.75, 1.0, D.g)), smoothstep(.3, .7, D.g)*(1.0 - soot));
  glow = max(glow, D.g*(.55 + .45*n2)); glowC = mix(glowC, vec3(1.0, .42, .10), D.g);
  float fF = D.b + det*.9 + rib*.35, ice = clamp((fF - .5)*6.0 + .5, 0.0, 1.0);
  col = mix(col, mix(vec3(.46, .58, .66), vec3(.74, .83, .90), n1)*(.88 + .24*smoothstep(.0, .16, rib + .08)), ice); glow *= 1.0 - ice*.92;
  float fB = D.a + det*.8;
  if (fB > .38) { col = mix(vec3(.30, .26, .22), vec3(.46, .38, .30), n2)*(.8 + .3*step(.5, fract(Q.y/.35))); glow = 0.0; }
  if (fB > .62) col = slRoom(P);
  return col;
}
`;
