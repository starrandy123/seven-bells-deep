// src/geo/kitVeg.js — VEGETATION: trees, bushes, grass, the leaf atlas and the wind system.
//
// WAVE 2 content module. Depends on geo/meshops.js (bounds/byte accounting), mat/materials.js
// (applyPBRPatch for bark) and core/{mathx,constants}.js. It imports no other kit and no scene.
// Everything except `update(dt)` runs at BUILD time.
//
// ── WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────────────────────────────
// r185 vendors a complete tree skeleton generator at
// `vendor/addons/jsm/generators/TreeGenerator.js` — and it CANNOT BE IMPORTED. Its top two
// imports are `three/webgpu` (MeshStandardNodeMaterial) and `three/tsl`, neither of which exists
// in `vendor/`; `MeshStandardNodeMaterial` appears 0 times in three.module.js and three.core.js.
// `import { TreeGenerator } from 'three/addons/generators/TreeGenerator.js'` throws a bare
// specifier resolution failure before a single line of it runs. ARCHITECTURE.md §1 therefore
// names this file as the place the PURE-GEOMETRY half is ported to. §A below is that port:
// `growBranch` / `transport` / `ringAt` / `perpendicular` / `emitTube`, algorithm-identical to the
// addon, extended with the four things the addon does not produce and a shipped tree needs —
// cylindrical bark UVs, a vertex-colour bark tint, the per-vertex wind attribute, and an INDEX
// buffer (the addon emits non-indexed position+normal only, i.e. 6 verts per quad).
//
// ── THE SIX LAWS OF THIS FILE (each is an acceptance criterion, not a preference) ─────────────
//  V1  THE PIPE MODEL IS THE SILHOUETTE. childRadius = parentRadius·(1/n)^(1/2.3) (da Vinci /
//      Murray), golden-angle roll 2.39996 rad per sibling so siblings never line up, phototropic
//      up-pull so the crown fills. Get these three wrong and no amount of leaf detail rescues it —
//      the tree reads as a fractal toy. [AUTHORING §Vegetation]
//  V2  PARALLEL TRANSPORT, NEVER FRENET. A Frenet frame flips 180° at every inflection point of a
//      gnarled branch and takes the bark texture with it. `transport()` rotates the frame by the
//      MINIMAL rotation carrying t0 onto t1 — 6 lines, no flip, ever. [AUTHORING §Sweeps]
//  V3  SPHERE NORMAL TRANSFER IS THE MAKE-OR-BREAK. Leaf cards shaded by their own (physically
//      correct) flat normals produce hard per-card black/white banding that screams "billboards".
//      Every canopy vertex gets  n = normalize( mix( normalize(v − canopyCentroid), cardNormal,
//      0.20 ) ). This is the polycount/Yarsa normal-transfer trick done analytically instead of
//      through a Maya dome transfer. There is no path through this file that ships a leaf card
//      with its raw face normal.
//      ⭐ AND THAT INCLUDES THE LOD2 CARD, which was the one exemption for the life of the file —
//      it carried a single up-biased constant per quad, and there were sun azimuths at which the
//      only quad still receiving light was the one edge-on to the viewer. Screen-weighted, the
//      brightest texel on a whole distant tree measured 0.0000. The card takes the same transfer
//      about its own centroid now; the arithmetic is in `buildTreeBillboard`'s docblock and
//      `selfTest` §4b sweeps the sun azimuth and refuses a card that has no lit limb.
//  V4  LEAVES ARE CLUSTERS, NEVER SINGLE LEAVES. 5–9 alpha-tested cards per TERMINAL TWIG, each
//      card carrying a whole painted sprig. One card per leaf is 40× the geometry for a worse
//      read, because the win is silhouette density, not leaf count.
//  V5  THE ATLAS IS DILATED BEFORE IT IS MIPPED. 8 px of RGB flood into the alpha = 0 region.
//      Without it mip 3+ averages the (black) empty texels into every leaf edge and every distant
//      card gets a dark halo — the single most common foliage bug in shipped games. Mips are then
//      generated on the CPU with Castano alpha-coverage preservation, so a canopy does not
//      evaporate as it recedes (a plain box mip loses ~35% of its alpha-test coverage by mip 4).
//  V6  BENT NORMALS ON GRASS, ALWAYS. N' = normalize( mix( faceNormal, vec3(0,1,0), 0.62 ) ).
//      A physically correct blade normal makes half the field face away from the sun; the field
//      renders black and noisy — salt-and-pepper static. Every shipped game bends toward up. It
//      is not a hack: it is an approximation of the FIELD's aggregate scattering, and the
//      grass-coherence gate measures exactly this. [RAGE §Foliage]
//
// ── ALPHA TESTING, AND WHY `transparent` STAYS FALSE ──────────────────────────────────────────
// `alphaTest: 0.42` + `transparent: false` + `shadowSide: DoubleSide`. Transparent foliage sorts
// back-to-front per object (wrong at the leaf level anyway), does not write depth — so it breaks
// the EqualDepth forward pass in frame-graph stage 4 — and turns 50k cards into unbounded
// overdraw. Alpha-tested cards write depth, sort correctly for free, and cost one `discard`.
// [AUTHORING §Vegetation traps] + [STREAM §Impostors].
//
// ── THE FRAME-GRAPH CONTRACT (integrator, read this) ──────────────────────────────────────────
// Wind is a VERTEX displacement. Stage 2 (prepass MRT) and stage 1 (shadow cascades) render this
// geometry with DIFFERENT materials, and if they do not apply the IDENTICAL displacement the
// stage-4 `EqualDepth` test fails and the vegetation vanishes. This module therefore exports the
// wind GLSL and `applyWind(material, kind)` so the prepass/depth/HLOD materials inject the same
// code from the same source. `depthMaterial(kind)` returns a ready-made one for
// `mesh.customDepthMaterial`.
//
// ── DETERMINISM (D4) ──────────────────────────────────────────────────────────────────────────
// Every stochastic decision flows from `mulberry32(seed)` derived from the caller's seed, NEVER
// from the shared stream — `tree('oak', 7)` returns the identical tree whether it is the first or
// the ten-thousandth call. Placement is a hash-jittered grid keyed on (worldSeed, cell), and
// `placement.sampler()` REFUSES to hand back a MeshSurfaceSampler without
// `setRandomGenerator()` — the addon's default is `Math.random` and that alone fails the
// grass-determinism gate. Wind phase is a function of `simTime` (an accumulated dt sum), so the
// gate's "screenshot, drive 600 m, come back" comparison is pixel-identical modulo wind phase.
//
// ── SOURCES ───────────────────────────────────────────────────────────────────────────────────
//   docs/research/the-gta-v-gta-vi-rage-engine-open-world-defe.md §"Foliage: hash-jittered grass
//       instance batches, two-scale wind, bent normals, card LOD" (placement grid, 40/12 per m²
//       densities, bent normal 0.62, two-scale wind 1/24 m @ 0.6 m/s + 1.9 Hz, bend = w·t³·0.35 m,
//       wrapped diffuse w = 0.5, backscatter pow(dot(V,−L), 8)·thickness·1.6), §"Parameter table
//       → FOLIAGE", §"Gates → GRASS-COHERENCE / GRASS-DETERMINISM", §"Traps".
//   docs/research/authoring-aaa-quality-3d-assets-purely-in-co.md §"Vegetation — trunk by
//       recursive tapered sweep, leaves by clustered cards with SPHERE-PROJECTED normals",
//       §"VEGETATION (from the vendored TreeGenerator defaults, verified)", §"Traps".
//   docs/research/open-world-streaming-lod-and-frame-budget-en.md §"Three tiers", §"Impostors".
//   vendor/addons/jsm/generators/TreeGenerator.js — the ported algorithm + its verified defaults.
//   vendor/addons/jsm/math/MeshSurfaceSampler.js:162 — `setRandomGenerator`.
//   src/core/constants.js — DIELECTRIC_ALBEDO.grassGreen/grassDry/woodOak*, ROUGHNESS_BANDS.grass,
//       POROSITY.grass, GEOMETRY.
//
//   node tools/check.mjs src/geo/kitVeg.js

import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

import { DIELECTRIC_ALBEDO, ROUGHNESS_BANDS, POROSITY } from './constants.js';
import {
  clamp, saturate, lerp, smoothstep, mulberry32, cellSeed, fbm2xy, valueNoise2,
  GOLDEN_ANGLE, TAU, PI, DEG2RAD,
} from './mathx.js';

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Constants — every number carries its source
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Shared frozen default so an omitted options bag never allocates. */
const EMPTY = Object.freeze({});

/**
 * The global vegetation budget + the shading constants that are LAW rather than taste.
 * Changing anything in here changes an acceptance gate, so each entry names the gate.
 */
export const VEG = Object.freeze({
  /** [AUTHORING §VEGETATION] tree LOD0 6.6 k measured; the module contract's cap is 7 k, and
   *  `tree()` allocates the canopy card count from whatever the woody half did not spend, so the
   *  cap is STRUCTURAL — there is no parameter set that can exceed it. */
  maxTrisLOD0: 7000,
  maxTrisLOD1: 2200,          // [AUTHORING] LOD1 2.0k
  maxTrisBush: 1400,          // [AUTHORED] a bush is a tree's crown without the bole
  /** [AUTHORING §Vegetation] 5–9 cards per TERMINAL twig — never one card per leaf (V4).
   *  ⭐ w7 — THE UPPER BOUND WAS THE CANOPY'S REAL CEILING, NOT THE BUDGET. Measured: the LOD0 oak
   *  emitted 945 cards = 1,890 tris against a card budget of ~1,790 CARDS. The crown was leaving
   *  half its allowance unspent because 9 x (terminal twigs) is all it could ask for, so raising
   *  the woody/canopy split alone would only have made the tree cheaper, not fuller. 14 lets a
   *  terminal twig carry a real spray. `emitCanopy` still clamps to `cardBudget`, so the structural
   *  cap in `tree()` is untouched and no tier can exceed `maxTrisLOD0`. */
  cardsPerTwig: [5, 14],
  /** [AUTHORING] card 0.18–0.35 m. ⚠️ THIS IS A NOMINAL, NOT THE SHIPPED SIZE — see
   *  `leafAreaTarget` below and the block in `emitCanopy`. A metre size authored as a constant
   *  cannot be right for both a 1.2 m shrub and a 16.5 m oak with an 8.2 m crown. */
  cardSize: [0.18, 0.35],
  /* ⛔⛔⛔ THE NUMBER THAT MADE EVERY TREE IN THE CITY LOOK DEAD, AND IT WAS NEVER A BUG IN THE
     CANOPY PIPELINE. Measured, on the real drained city at the `drive_cam` station:
       city.pool.treeCanopy   instanced, visible=true, count=6, 0 degenerate scales,
                              geo veg.canopy 1890 tris, mat veg.leaf alphaTest 0.42 DoubleSide,
                              map veg.leafAtlas READY, 29.4% of its texels opaque above alphaTest,
                              instances co-located with treeTrunk, nearest 43.4 m at scale 1.09
     Every part of that is correct. `tree('oak',3)` returns a canopy of 945 real alpha-cut cards
     and they DO render — you can see them in the frame. They are simply far too SMALL:

       card area   945 x (0.30 m)^2 x 0.72          =  61 m^2
       crown disc  pi x (8.214 m)^2                 = 212 m^2
       leaf area index                              = 0.29

     A canopy needs a GEOMETRIC leaf-area index of ~3 to read as foliage (real broadleaf LAI is
     3-6, and an alpha-cut card is only ~27% opaque, so the geometric figure must run ahead of the
     optical one). At 0.29 the tree is TEN TIMES too sparse and renders as a bare winter tree with
     a few leaves clinging to it — which is exactly the eye review's "every tree is dead".

     ⭐ THE ROOT IS THAT CARD SIZE WAS AN ABSOLUTE METRE CONSTANT while the crown radius is
     GROWN — `growBranch` produces whatever radius the species parameters imply (oak 8.2 m, birch
     9.4 m, pine 4.7 m, shrub ~1 m), and a 0.30 m card is right for one of those and wrong for the
     rest. The size is now DERIVED from the crown the grower actually produced and the card count
     the budget actually allowed, so the ratio is scale-invariant by construction:

         s = R * sqrt( pi * leafAreaTarget / (0.72 * N) )

     0.72 is the card's own width:length ratio, set where the corners are written. This costs ZERO
     triangles — the same 945 cards, sized to the tree they hang on. */
  /** 2026-08-09, owner by-eye on the forest gold: "the trees need more leaves" — 3.2 sat at the
   *  bottom of the real broadleaf 3-6 band and near trunks still read sparse. 4.4 fills the crown
   *  (same card count, cards resize; the 4x nominal ceiling below still guards the sprig read). */
  leafAreaTarget: 4.4,
  /** Ceiling on the derived enlargement, as a multiple of the species' authored nominal. A sprig
   *  card is a CLUSTER of leaves (the oak tile is painted with 15), so 1 m on an 8 m crown is a
   *  real sprig — but past ~4x the nominal a card stops reading as foliage and starts reading as
   *  a frond, so the derivation is clamped and the clamp is visible in `stats()`. */
  cardScaleMax: 4.0,
  cardScaleMin: 1.0,
  /** [AUTHORING] ±25° tilt off the twig-perpendicular. */
  cardTiltDeg: 25,
  /** [AUTHORING §Vegetation] THE sphere-normal blend. 0.15–0.3 is the usable band; 0.20 is the
   *  dossier's number and the one the coherence gate was written against. */
  sphereNormalBlend: 0.20,
  /** [RAGE §Foliage] THE grass trick. Do not lower this "for correctness" — see V6. */
  grassBentNormal: 0.62,
  /** [AUTHORING §Vegetation] alphaTest not transparent, so cards write depth. */
  alphaTest: 0.42,
  /** [AUTHORING] blade 0.35 m tall, 0.02 m base, 4 quads (8 tris), 3 blades per clump. */
  bladeHeight: 0.35,
  bladeBaseWidth: 0.020,
  bladeQuads: 4,
  bladesPerClump: 3,
  /** [RAGE §Foliage] 40 blades/m² to 25 m, 12/m² to 60 m, 0 beyond; total capped at 160 k. */
  grassDensityNear: 40,
  grassDensityFar: 12,
  grassRingNear: 25,
  grassRingFar: 60,
  grassInstanceCap: 160000,
  /** [AUTHORING §Vegetation] the LOD0 blade ring; past it the 6-blades-in-one-card LOD1 takes over
   *  and cuts the instance count 6×. */
  grassBladeRing: 35,
  /** [RAGE §Foliage] reject placement above 38° of slope — grass does not grow on a cliff and a
   *  blade planted on one intersects the ground. cos(38°) = 0.788. */
  slopeMaxCos: Math.cos(38 * DEG2RAD),
  /** ⭐ THE DISTANCE `bush()` STOPS EXISTING — published as a NUMBER because two scenes were
   *  already hard-coding it from a sentence in this file's prose (`sandbox.js:454`
   *  `const CULL_BUSH_M = 42; // kitVeg: "a bush past 40 m..."`). A shrub publishes two tiers and
   *  no billboard on purpose; see the refutation block on `bush()` for the white-cone frame that
   *  settled it. 42 is the value both consumers already ship, so adopting the published field is
   *  a no-op for them and a drift-stop for the next one. */
  bushCullMetres: 42,
  /** Energy ceiling on the LOD2 bole's effective diffuse albedo, per channel. A dielectric that
   *  reflects more than ~0.9 of the light landing on it is not a material, it is a light source —
   *  and the brightest bark in the table (birch, linear 0.616) sits 1.46x under it, so this is a
   *  wall for a future species table, never a live clamp. See `boleModulator`. */
  boleAlbedoCeiling: 0.9,
});

/**
 * Wind. Two scales, and BOTH are load-bearing: the gust FRONTS are what sell a field as wind
 * rather than as an animation, and the per-blade phase is what stops 40,000 instances beating in
 * unison. [RAGE §Foliage: "global gust from a scrolling FBM texture sampled at world scale 1/24 m
 * moving at 0.6 m/s … plus a per-blade phase from hash(instanceID) at 1.9 Hz. Bend is cubic in
 * height: offset = windVec · t³ · bendScale, bendScale 0.35 m at wind 1.0"].
 */
export const WIND = Object.freeze({
  gustMetres: 24,             // [RAGE] one gust cell spans 24 m of world
  gustSpeed: 0.6,             // [RAGE] m/s — the front travel speed
  detailHz: 1.9,              // [RAGE] per-blade chatter
  bendMetres: 0.35,           // [RAGE] lateral offset at t = 1, wind = 1
  /** The gust field never reaches 0: a dead-calm patch in the middle of a moving field reads as a
   *  bug, not as calm. Remap the [0,1] FBM into [gustFloor, 1]. [AUTHORED, matched by eye] */
  gustFloor: 0.35,
  gustTexSize: 256,           // [RAGE] "generate a 256² RG8 FBM texture once at boot"
  /** Cross-wind flutter as a fraction of the main bend. Above ~0.4 the blade orbits instead of
   *  bending, which reads as underwater. [AUTHORED] */
  flutterPerp: 0.30,
  flutterAlong: 0.22,
  /** Wrapped-diffuse w and the backscatter exponent for two-sided leaf transmission.
   *  [RAGE §Foliage] max(0,(N·L+w)/((1+w)²)) with w = 0.5; pow(saturate(dot(V,−L)), 8)·thick·1.6 */
  wrap: 0.5,
  backscatterPower: 8.0,
  backscatterGain: 1.6,
  /** ⭐ V8 — TRANSMITTANCE / REFLECTANCE, per channel. Measured leaf optics (Knapp & Carter, and
   *  every PROSPECT-family leaf model) put visible transmittance and reflectance close in the
   *  green (both gated by the same chlorophyll window), higher in the red — where the mesophyll
   *  scatters more than the surface does — and near zero in the blue, which chlorophyll a/b
   *  absorb hardest of all. The ratio, not the absolute, is what belongs here: it multiplies the
   *  leaf's own albedo so a pale birch and a deep pine keep their identity and only the HUE
   *  shifts, toward the yellow-green a backlit crown is recognised by. [AUTHORED from that band] */
  transmissionTint: [1.30, 1.05, 0.34],
  /** How much of the sky hemisphere behind a leaf comes through it. A leaf's diffuse
   *  transmittance is 0.3-0.5 in the visible; 0.45 sits in that band and is what stops a card
   *  facing away from the sky from rendering as a hole in it. */
  skyTransmission: 0.45,
});

/** Leaf atlas layout. 1024² / 4×4 tiles of 256². One texture, one material, every species. */
const ATLAS = Object.freeze({
  size: 1024,
  cols: 4,
  rows: 4,
  tile: 256,
  /** [AUTHORING §Vegetation traps / V5] 8 px of RGB dilation into alpha = 0 BEFORE mipping. */
  dilatePx: 8,
  /** Empty margin inside each tile. Two jobs: it gives the dilation somewhere to go without
   *  crossing a tile boundary, and it keeps the deep mips (where a 256 px tile is 16 px) from
   *  bleeding one species into its neighbour. */
  padPx: 14,
  /** Alpha-coverage reference for the Castano mip rescale — MUST equal the material's alphaTest,
   *  or the correction preserves the wrong thing. */
  coverageRef: VEG.alphaTest,
  /** The two bounds `solidCoreOf` searches under; both are derived there, not tasted.
   *  1.48x alphaTest so a bilinear tap straddling the core's edge still clears alphaTest, and a
   *  floor of 8 texels per tile because below that the one-texel guard band cannot fit inside
   *  `padPx` (measured: 4 returns NO core on every seed tried). */
  coreAlphaMin: 0.62,
  coreMinTileTexels: 8,
});

/** Tile indices in the atlas. Neighbours are deliberately similar so deep-mip bleed is green into
 *  green. Index = row·4 + col. */
const TILE = Object.freeze({
  oakA: 0, oakB: 1, mapleA: 2, mapleB: 3,
  birchA: 4, birchB: 5, poplarA: 6, poplarB: 7,
  willowA: 8, willowB: 9, pineA: 10, pineB: 11,
  shrubA: 12, shrubB: 13, grassCard: 14, canopyBlob: 15,
});

/** Bark texture. One TILING set (albedo/normal/ORM) shared by every species; the per-species
 *  character comes from the vertex-colour tint plus the (very different) silhouettes. A per-species
 *  bark texture would be 5× the memory and 5× the material ids for a difference the eye reads from
 *  colour anyway — and D6 caps us at ~40 material ids in view. */
const BARK = Object.freeze({
  size: 512,
  /** Metres of trunk one tile covers vertically. Real bark furrow spacing on a mature oak is
   *  60–120 mm; a 1.2 m tile at 512 px is 2.3 mm/texel, which holds the furrow at a 1 m read. */
  worldMetres: 1.2,
  /** Furrow anisotropy: the pattern varies fast AROUND the trunk and slowly ALONG it. These are
   *  INTEGER multiples of the noise period, which is what keeps the bake exactly tileable. */
  freqAround: 6,
  freqAlong: 1,
  roughness: 0.88,            // [PBR §M] woodPlank raw 0.78 → bark is rougher still
  porosity: POROSITY.woodRaw, // [PBR §I] 0.60
});

/** Linear-RGB authoring colours. Sources: [PBR §J] measured dielectric albedos in constants.js. */
const TINT = Object.freeze({
  /** Bark base — the mid-brown every species tints away from. Between woodOakLate and woodOakEarly. */
  barkBase: [0.140, 0.098, 0.062],
  /** Fresh growth at the twig tips is markedly lighter and greener than the bole. */
  barkTip: [0.175, 0.140, 0.085],
  /** Moss/damp at the very base of the bole. Not a green tint — a desaturated darkening plus a
   *  small green bias; a saturated green skirt reads as a video-game tree. */
  barkFoot: [0.070, 0.072, 0.048],
  leafSummer: [0.075, 0.130, 0.042],   // [PBR §J] grassGreen, pushed slightly greener
  leafDeep: [0.048, 0.085, 0.030],
  leafPale: [0.120, 0.160, 0.058],
  leafAutumn: [0.180, 0.098, 0.030],
  needle: [0.042, 0.070, 0.038],
  /** ⭐ E-BIOME FOREST/CANYON (2026-09-05) — two more needle tints, so the roster's THREE conifer
   *  biomes stop being one Scots pine at three scales (`BIOME_SCOPE.md` FOR-4). `needleDark` is
   *  the boreal spruce: darker and BLUER than pine, which is the only colour cue that separates a
   *  taiga from a pine field at silhouette distance. `needleDry` is the dryland juniper: lighter,
   *  yellower, lower chroma — a sage-green rather than a forest-green (CAN-4).
   *  Both stay inside `tintRatio`'s clamp against their own atlas tiles and both are asserted by
   *  `tint.ratioUnclamped.*` / `tint.speciesMatchesItsTiles.*` like every shipped species. */
  needleDark: [0.032, 0.054, 0.036],
  needleDry: [0.062, 0.082, 0.052],
  grassGreen: DIELECTRIC_ALBEDO.grassGreen,   // [PBR §J] [0.075, 0.115, 0.038]
  grassDry: DIELECTRIC_ALBEDO.grassDry,       // [PBR §J] [0.180, 0.145, 0.070]
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ⛔⛔ V7 — THE VERTEX COLOUR IS A MODULATOR, NOT AN ALBEDO. (measured 2026-07-28)
//
// Every mapped vegetation material multiplies TWO factors: `map` (the bake) and `vColor`
// (r185's <color_fragment>: `diffuseColor *= vColor`). The bake is ALREADY painted in the species
// tint — `bakeLeafAtlas`'s plan hands `TINT.leafSummer` to `paintSprigTile`, `bakeBark` paints
// from `TINT.barkBase`. So writing the SAME tint into the vertex colour SQUARES it.
//
// MEASURED on the shipped build, through `tools/_w6_veg.mjs` (real page, real bake, real
// geometry, opaque texels only, sRGB decoded):
//     atlas mean LINEAR   = [0.08460, 0.12886, 0.04358]   <- a correct, real leaf reflectance
//     vertex colour mean  = [0.04866, 0.08021, 0.02588]   <- the same tint, a second time
//     EFFECTIVE ALBEDO    = [0.00412, 0.01034, 0.00113]   <- 12.5x below a real leaf in green,
//                                                            and BELOW the rubric's 0.02 floor on
//                                                            EVERY channel.
//
// A dielectric with a dead diffuse is not black — it is GREY PLASTIC, because the only thing left
// is the 4% specular reflecting the sky. That is exactly what the eye reported and exactly what
// the frame measures: the canopy rim against a bright sky came back [0.417, 0.423, 0.427] —
// **bluer than it is green**. It also produced the black flared SKIRT at the trunk foot, because
// `barkFoot` [0.070,0.072,0.048] against a bake painted in `barkBase` [0.140,0.098,0.062] lands at
// 0.0098 linear — HALF of the (already too dark) bole, applied over the bottom 12% of the bole.
//
// THE FIX IS A NORMALISATION, NOT A CONSTANT. The bake is the colour AUTHORITY (it carries the
// per-tile species hue, the margin warmth, the vein lift, the two-scale mottle). The vertex colour
// carries only what varies PER CARD / PER INSTANCE and must therefore sit around 1.0: the value
// jitter, the autumn hue break, the canopy-depth AO, the young-wood lightening, the mossy foot.
// `tintRatio` converts an authored absolute tint into that modulator by dividing by the tint the
// BAKE used, so every authored hue relationship survives byte-for-byte and only the magnitude —
// which was never meant to be applied twice — goes away.
//
// ⚠️ `grassClump`'s LOD0 blades are the ONE exception and are deliberately left absolute:
// `grassMaterial` has NO map, so there the vertex colour IS the albedo. Normalising it would be
// the same defect with the sign flipped.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Component-wise `target / reference`, clamped. The clamp is not a fudge: a reference channel can
 *  be legitimately tiny (bark blue is 0.062) and an authored target 3x it, which is a real hue
 *  shift; but a ratio above 4 would mean the two colours are not the same family and the caller
 *  has passed the wrong reference — clamping keeps that a wrong-looking tree instead of a
 *  fireball, and `selfTest` asserts the shipped ratios never reach the clamp. */
function tintRatio(target, reference) {
  return [
    clamp(target[0] / Math.max(1e-4, reference[0]), 0.05, 4),
    clamp(target[1] / Math.max(1e-4, reference[1]), 0.05, 4),
    clamp(target[2] / Math.max(1e-4, reference[2]), 0.05, 4),
  ];
}

/** Which tint the BAKE painted each atlas tile with. Kept beside `TILE` so the two cannot drift;
 *  `bakeLeafAtlas`'s plan is asserted against it in `selfTest`. Index = the TILE value. */
const TILE_TINT = Object.freeze([
  TINT.leafSummer, TINT.leafDeep, TINT.leafSummer, TINT.leafPale,
  TINT.leafPale, TINT.leafSummer, TINT.leafSummer, TINT.leafDeep,
  TINT.leafPale, TINT.leafSummer, TINT.needle, TINT.leafDeep,
  TINT.leafDeep, TINT.leafSummer, TINT.grassGreen, TINT.leafSummer,
]);

/**
 * The modulator that paints BARK over a LEAF texel — `tintRatio`'s job with `tintRatio`'s clamp
 * deliberately removed, and the reason is worth reading before anyone puts it back.
 *
 * `tintRatio` caps at 4x because "a ratio above 4 would mean the two colours are not the same
 * family and the caller has passed the wrong reference". At the LOD2 bole the two colours are not
 * the same family ON PURPOSE — the bole rides the leaf material to stay inside one draw call, so
 * it is painting bark over the atlas's measured green core, and the reference is provably the
 * right one (it is the mean of the exact texels the quad samples). MEASURED: birch bark is
 * authored at linear [0.616, 0.412, 0.242] — `barkTint: [4.40, 4.20, 3.90]`, the one genuinely
 * pale bark in the table — against a core of [0.073, 0.121, 0.039]; the honest ratio is
 * [8.40, 3.40, 6.20] and `tintRatio` returned [4.00, 3.40, 4.00], which multiplies out to
 * [0.293, 0.412, 0.156] — GREEN-DOMINANT. A white-birch bole coming out greener than it is red is
 * a worse answer than a large multiplier.
 *
 * ⛔ AND HIGH GAIN COSTS NOTHING HERE, which is the part that decides it. Every artefact a big
 * multiplier could amplify is RELATIVE and therefore gain-invariant: the core's leaf mottle is
 * ~6 % of its own value at 1x and ~6 % at 8x, and the 8-bit sRGB step at the core's byte values
 * (63-95) is 0.4-0.5 % relative either way. Nothing is quantised after the multiply — it lands in
 * a Float32 vertex attribute and is multiplied by the sampled texel in the fragment shader.
 *
 * So the only real bound is the one V7's own lesson names: the bound belongs on the PRODUCT, not
 * on either factor. `ceiling` is an ENERGY bound — a dielectric albedo above ~0.9 is not a
 * material, it is a light — and it is applied as a UNIFORM scale so the authored hue survives
 * intact rather than one channel flattening against a wall. `selfTest` asserts no shipped species
 * reaches it, so if it ever fires that is a species table problem, not a silent recolour.
 */
function boleModulator(target, reference, ceiling) {
  const r = [
    target[0] / Math.max(1e-4, reference[0]),
    target[1] / Math.max(1e-4, reference[1]),
    target[2] / Math.max(1e-4, reference[2]),
  ];
  const peak = Math.max(target[0], target[1], target[2]);
  const s = peak > ceiling ? ceiling / peak : 1;
  return [r[0] * s, r[1] * s, r[2] * s];
}

/** R3 — the LEAF modulator: `boleModulator`'s product-bounded math for canopy cards and the
 *  billboard. WHY NOT `tintRatio` (measured 2026-08-05, the lime-conifer defect): the winter
 *  dress pulls the leaf target toward fresh-snow albedo (~0.8) against an atlas reference near
 *  0.05-0.13, so the honest ratio runs 6-17x — and tintRatio's per-channel 4x clamp flattened
 *  every channel against the wall with BLUE (the frost carrier) losing the most, which multiplies
 *  out to atlas-green x4 = LIME. The billboard "frosted correctly" only because its canopyBlob
 *  reference tile is brighter, keeping its ratios under the clamp — the exact per-tier split the
 *  R3 row filed. This is the birch-bark case from `boleModulator`'s own docblock (a target that is
 *  a different colour family ON PURPOSE, against a provably-correct reference): the bound belongs
 *  on the PRODUCT, applied as a UNIFORM scale so the hue survives. For every undressed species
 *  selfTest 6c guarantees the ratios sit inside tintRatio's clamps, so this function is
 *  numerically IDENTICAL there — no summer tree changes by a single bit. */
const LEAF_ALBEDO_CEILING = 0.92;   // fresh snow is 0.84; above ~0.9 a dielectric is a light
function leafModulator(target, reference) {
  return boleModulator(target, reference, LEAF_ALBEDO_CEILING);
}

/** §1b — the conical far-silhouette taper for needle species. ONE constant: `tree()` shapes the
 *  billboard with it and selfTest derives the cone-transfer reference from it; two copies is how
 *  the wall drifts from the geometry it walls. */
const NEEDLE_BILLBOARD_TAPER = 0.82;

/** R3 — the winter dress in ONE place (tree() and selfTest both call it; two copies of the blend
 *  is how a wall drifts from the thing it walls). Pulls a leaf tint toward fresh-snow albedo,
 *  capped at 0.88 so a dark needle edge reads through the load. */
function dressLeafTint(tint, snow01) {
  const SNOW_LEAF = [0.80, 0.84, 0.90];   // fresh-snow albedo, slightly blue in the hollows
  const k = 0.88 * Math.max(0, Math.min(1, snow01));
  return [
    tint[0] * (1 - k) + SNOW_LEAF[0] * k,
    tint[1] * (1 - k) + SNOW_LEAF[1] * k,
    tint[2] * (1 - k) + SNOW_LEAF[2] * k,
  ];
}

/** The weighted mean of the tints of the tiles a canopy actually samples. This — not a single
 *  global reference — is the right denominator, because a species draws from two or three tiles
 *  that were painted in DIFFERENT tints, and the atlas's own per-tile variety must survive. */
function atlasTintFor(tiles, weights) {
  let r = 0, g = 0, b = 0, wsum = 0;
  for (let i = 0; i < tiles.length; i++) {
    const t = TILE_TINT[tiles[i]] || TINT.leafSummer;
    const w = weights && weights[i] !== undefined ? weights[i] : 1;
    r += t[0] * w; g += t[1] * w; b += t[2] * w; wsum += w;
  }
  if (wsum <= 0) return TINT.leafSummer;
  return [r / wsum, g / wsum, b / wsum];
}

// ── the species table ─────────────────────────────────────────────────────────────────────────
//
// Every field maps 1:1 onto a verified `TreeGenerator.defaults` key except the four marked ⊕,
// which are this port's additions:
//   ⊕ excurrent   — child length scales by (1 − 0.75·t) up the parent. Conifers are EXCURRENT
//                   (one dominant leader, branches shortening with height → a cone); broadleaves
//                   are DELIQUESCENT (the leader dissolves into the crown). The addon has no
//                   knob for this and a pine built without it reads as a lumpy oak.
//   ⊕ leafTiles   — which atlas tiles this species' cards draw from, with weights.
//   ⊕ barkTint    — linear-RGB multiplier written into the woody vertex colour.
//   ⊕ crownFlex   — wind flexibility of the woody chain at t = 1 (a poplar whips, an oak does not).

const SPECIES_DEF = {
  oak: {
    label: 'English oak',
    levels: 4,
    children: [3, 7, 5],
    branchAngle: [44, 56, 62],
    angleVariance: 15,
    lengthRatio: 0.62,
    trunkLength: 8.6, trunkLengthVar: 0.20,
    trunkRadius: 0.34,
    taper: 0.55, taperCurve: 0.70,
    rootFlare: 0.62, flareFrac: 0.18,
    radiusExponent: 2.3,
    minRadius: 0.011, minLength: 0.50,
    droop: 0.07, upPull: 0.28,
    gnarl: [0.05, 0.16, 0.26, 0.32],
    radialSegments: 7,
    sectionLength: 1.30,
    childStart: 0.12, trunkClear: 0.30,
    excurrent: 0.10,
    barkTint: [1.00, 0.94, 0.88],
    leafTiles: [TILE.oakA, TILE.oakB, TILE.mapleA],
    leafWeights: [0.44, 0.44, 0.12],
    leafTint: TINT.leafSummer,
    cardSize: [0.26, 0.34],
    crownFlex: 0.55,
  },
  maple: {
    label: 'field maple',
    levels: 4,
    children: [4, 7, 5],
    branchAngle: [40, 52, 58],
    angleVariance: 13,
    lengthRatio: 0.64,
    trunkLength: 8.0, trunkLengthVar: 0.18,
    trunkRadius: 0.27,
    taper: 0.58, taperCurve: 0.72,
    rootFlare: 0.45, flareFrac: 0.15,
    radiusExponent: 2.3,
    minRadius: 0.010, minLength: 0.48,
    droop: 0.05, upPull: 0.34,
    gnarl: [0.04, 0.14, 0.24, 0.30],
    radialSegments: 7,
    sectionLength: 1.25,
    childStart: 0.12, trunkClear: 0.26,
    excurrent: 0.15,
    barkTint: [0.92, 0.92, 0.94],
    leafTiles: [TILE.mapleA, TILE.mapleB, TILE.oakB],
    leafWeights: [0.45, 0.45, 0.10],
    leafTint: TINT.leafSummer,
    cardSize: [0.24, 0.32],
    crownFlex: 0.62,
  },
  birch: {
    label: 'silver birch',
    levels: 4,
    children: [3, 8, 6],
    branchAngle: [34, 46, 54],
    angleVariance: 12,
    lengthRatio: 0.66,
    trunkLength: 9.4, trunkLengthVar: 0.22,
    trunkRadius: 0.165,
    taper: 0.62, taperCurve: 0.80,
    rootFlare: 0.28, flareFrac: 0.12,
    radiusExponent: 2.3,
    minRadius: 0.008, minLength: 0.42,
    droop: 0.13, upPull: 0.46,
    gnarl: [0.03, 0.11, 0.22, 0.30],
    radialSegments: 6,
    sectionLength: 1.30,
    childStart: 0.14, trunkClear: 0.34,
    excurrent: 0.20,
    // Birch bark is the one genuinely pale bark. 4.4× the base tint lands it near sRGB 0.62 — the
    // measured white-birch albedo band — while the SAME furrow texture underneath still reads,
    // because the lenticel banding the eye actually looks for is a value pattern, not a hue.
    barkTint: [4.40, 4.20, 3.90],
    leafTiles: [TILE.birchA, TILE.birchB],
    leafWeights: [0.5, 0.5],
    leafTint: TINT.leafPale,
    cardSize: [0.18, 0.26],
    crownFlex: 0.85,
  },
  poplar: {
    label: 'Lombardy poplar',
    levels: 4,
    children: [5, 8, 5],
    branchAngle: [22, 28, 34],
    angleVariance: 8,
    lengthRatio: 0.58,
    trunkLength: 12.0, trunkLengthVar: 0.16,
    trunkRadius: 0.26,
    taper: 0.70, taperCurve: 0.88,
    rootFlare: 0.34, flareFrac: 0.10,
    radiusExponent: 2.3,
    minRadius: 0.009, minLength: 0.45,
    droop: 0.02, upPull: 0.74,
    gnarl: [0.02, 0.08, 0.16, 0.22],
    radialSegments: 6,
    sectionLength: 1.60,
    childStart: 0.06, trunkClear: 0.10,
    excurrent: 0.55,
    barkTint: [0.86, 0.88, 0.86],
    leafTiles: [TILE.poplarA, TILE.poplarB],
    leafWeights: [0.5, 0.5],
    leafTint: TINT.leafSummer,
    cardSize: [0.18, 0.24],
    crownFlex: 1.00,
  },
  willow: {
    label: 'weeping willow',
    levels: 4,
    children: [4, 6, 7],
    branchAngle: [52, 66, 78],
    angleVariance: 18,
    lengthRatio: 0.76,
    trunkLength: 6.8, trunkLengthVar: 0.20,
    trunkRadius: 0.36,
    taper: 0.50, taperCurve: 0.62,
    rootFlare: 0.70, flareFrac: 0.22,
    radiusExponent: 2.3,
    minRadius: 0.007, minLength: 0.55,
    // Droop is the whole species: 0.34 per unit length pulls the twig tips down hard, and upPull
    // is nearly off so the golden-angle roll is allowed to send children downward.
    droop: 0.34, upPull: 0.06,
    gnarl: [0.06, 0.14, 0.20, 0.24],
    radialSegments: 6,
    sectionLength: 1.10,
    childStart: 0.10, trunkClear: 0.22,
    excurrent: 0.0,
    barkTint: [0.90, 0.86, 0.78],
    leafTiles: [TILE.willowA, TILE.willowB],
    leafWeights: [0.5, 0.5],
    leafTint: TINT.leafPale,
    cardSize: [0.22, 0.30],
    crownFlex: 1.00,
  },
  pine: {
    label: 'Scots pine',
    levels: 4,
    children: [6, 6, 4],
    // Near-horizontal whorls: a conifer's first-order branches leave the leader at 70–85°, and
    // the droop then pulls the outer half down. Getting this angle wrong is what makes a
    // procedural conifer look like a bottle brush.
    branchAngle: [76, 62, 54],
    angleVariance: 9,
    lengthRatio: 0.52,
    trunkLength: 13.5, trunkLengthVar: 0.18,
    trunkRadius: 0.30,
    taper: 0.78, taperCurve: 1.00,
    rootFlare: 0.44, flareFrac: 0.12,
    radiusExponent: 2.3,
    minRadius: 0.008, minLength: 0.40,
    droop: 0.16, upPull: 0.05,
    gnarl: [0.02, 0.07, 0.14, 0.20],
    radialSegments: 6,
    sectionLength: 1.70,
    childStart: 0.08, trunkClear: 0.38,
    excurrent: 0.85,
    barkTint: [1.10, 0.82, 0.62],
    leafTiles: [TILE.pineA, TILE.pineB],
    leafWeights: [0.5, 0.5],
    leafTint: TINT.needle,
    cardSize: [0.20, 0.28],
    crownFlex: 0.40,
  },
  /* ══ E-BIOME 2026-09-05 — THREE ROWS, ZERO NEW MACHINERY ═══════════════════════════════════
     Every field below maps onto the SAME `TreeGenerator` path the seven shipped species use, and
     the three of them share the SAME bark material, the SAME leaf atlas and therefore the SAME
     two draw-call families. `reports/epic_finish2/BIOME_SCOPE.md` FOR-4 and CAN-4 are the scope;
     the defect they name is that `classifyBiome` produces THREE needled biomes (CONIFER, TAIGA,
     ALPINE_MEADOW's fringe) and four identities advertise `conifer`, while `SPECIES_DEF` had
     exactly ONE needled row — "the recolour ceiling terrainGen's header outlawed for landforms,
     wearing a species hat".
     ⛔ WHAT THEY ARE NOT: they are not new GEOMETRY and they do not make an arid world grow on
     their own. A species row is a FORM; what decides where it stands is the habitat rule
     (`world/forestDressing.js`) or the scene's own recipe. A row with no chooser is a species
     nobody plants, which is the defect class this whole lane is about. ═════════════════════════ */
  spruce: {
    label: 'boreal spruce',
    levels: 4,
    children: [7, 6, 4],
    /* The spruce silhouette is a SPIRE, and two numbers make it: whorls that leave the leader
       almost horizontally (82 degrees against pine's 76) and a `droop` of 0.30 against pine's
       0.16, which pulls the outer half of every whorl DOWN. That downswept whorl over a narrow
       taper is the shape a taiga reads by; a pine at a smaller scale is not it. */
    branchAngle: [82, 70, 62],
    angleVariance: 7,
    lengthRatio: 0.46,
    trunkLength: 16.0, trunkLengthVar: 0.16,
    trunkRadius: 0.26,
    taper: 0.82, taperCurve: 1.05,
    rootFlare: 0.40, flareFrac: 0.11,
    radiusExponent: 2.3,
    minRadius: 0.007, minLength: 0.36,
    droop: 0.30, upPull: 0.03,
    gnarl: [0.015, 0.05, 0.11, 0.16],
    radialSegments: 6,
    sectionLength: 1.75,
    childStart: 0.05, trunkClear: 0.22,
    /* 0.95 against pine's 0.85 — the leader dominates almost completely, which is what closes the
       cone at the top instead of letting it open into a lumpy crown. */
    excurrent: 0.95,
    barkTint: [0.86, 0.80, 0.74],
    leafTiles: [TILE.pineA, TILE.pineB],
    leafWeights: [0.5, 0.5],
    leafTint: TINT.needleDark,
    cardSize: [0.16, 0.22],
    crownFlex: 0.26,
  },
  juniper: {
    label: 'dryland juniper',
    levels: 4,
    children: [5, 6, 4],
    branchAngle: [58, 66, 70],
    angleVariance: 22,
    lengthRatio: 0.60,
    /* 4.6 m: a juniper is a TREE-SHAPED SHRUB, and its shortness is the point — it is what puts a
       readable object on a canyon bench without putting a 13 m Scots pine on a desert. */
    trunkLength: 4.6, trunkLengthVar: 0.26,
    trunkRadius: 0.22,
    taper: 0.48, taperCurve: 0.62,
    /* The heaviest root flare in the table. A dryland conifer's bole is mostly buttress. */
    rootFlare: 0.72, flareFrac: 0.24,
    radiusExponent: 2.3,
    minRadius: 0.008, minLength: 0.30,
    droop: 0.10, upPull: 0.30,
    /* GNARL IS THE SPECIES. 0.48 at the twigs against pine's 0.20 — the wood wanders, which is
       what a century of drought stress looks like and what stops this reading as a small pine. */
    gnarl: [0.16, 0.34, 0.42, 0.48],
    radialSegments: 6,
    sectionLength: 0.75,
    childStart: 0.10, trunkClear: 0.12,
    excurrent: 0.50,
    barkTint: [1.05, 0.84, 0.72],
    leafTiles: [TILE.pineA, TILE.pineB, TILE.shrubA],
    leafWeights: [0.4, 0.4, 0.2],
    leafTint: TINT.needleDry,
    cardSize: [0.14, 0.20],
    crownFlex: 0.35,
  },
  cottonwood: {
    label: 'valley cottonwood',
    levels: 4,
    children: [4, 7, 6],
    branchAngle: [46, 58, 66],
    angleVariance: 16,
    lengthRatio: 0.68,
    trunkLength: 10.5, trunkLengthVar: 0.20,
    /* The thickest bole in the table after the willow. A riparian broadleaf on a desert wash is
       the ONE big green thing in the frame and it has to carry that read from underneath. */
    trunkRadius: 0.38,
    taper: 0.52, taperCurve: 0.66,
    rootFlare: 0.66, flareFrac: 0.20,
    radiusExponent: 2.3,
    minRadius: 0.008, minLength: 0.50,
    droop: 0.20, upPull: 0.22,
    gnarl: [0.05, 0.15, 0.24, 0.30],
    radialSegments: 7,
    sectionLength: 1.20,
    childStart: 0.14, trunkClear: 0.30,
    excurrent: 0.08,
    /* Pale grey-green furrowed bark — 2.1x the base, well under birch's 4.4x, which is the one
       genuinely white bark in the table and the calibration point for how far this can go. */
    barkTint: [2.10, 2.00, 1.80],
    leafTiles: [TILE.poplarA, TILE.poplarB, TILE.mapleA],
    leafWeights: [0.42, 0.42, 0.16],
    leafTint: TINT.leafPale,
    cardSize: [0.24, 0.32],
    crownFlex: 0.78,
  },
  shrub: {
    label: 'hedge shrub',
    levels: 3,
    children: [6, 5],
    branchAngle: [48, 58],
    angleVariance: 20,
    lengthRatio: 0.60,
    trunkLength: 0.55, trunkLengthVar: 0.25,
    trunkRadius: 0.035,
    taper: 0.55, taperCurve: 0.70,
    rootFlare: 0.30, flareFrac: 0.20,
    radiusExponent: 2.3,
    minRadius: 0.004, minLength: 0.10,
    droop: 0.05, upPull: 0.36,
    gnarl: [0.08, 0.20, 0.28],
    radialSegments: 5,
    sectionLength: 0.34,
    childStart: 0.06, trunkClear: 0.10,
    excurrent: 0.0,
    barkTint: [0.88, 0.86, 0.80],
    leafTiles: [TILE.shrubA, TILE.shrubB],
    leafWeights: [0.5, 0.5],
    leafTint: TINT.leafDeep,
    cardSize: [0.13, 0.19],
    crownFlex: 1.00,
  },
};

/** Frozen deep copy so a consumer cannot mutate the table under another consumer. */
export const SPECIES = Object.freeze(
  Object.fromEntries(Object.keys(SPECIES_DEF).map((k) => [k, Object.freeze({ ...SPECIES_DEF[k] })])),
);
export const SPECIES_NAMES = Object.freeze(Object.keys(SPECIES_DEF));

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Module-scope scratch. Build-time allocation is fine; `update(dt)` allocates NOTHING (§4 rule 6).
// ══════════════════════════════════════════════════════════════════════════════════════════════

const _up = /* @__PURE__ */ new THREE.Vector3(0, 1, 0);
const _axis = /* @__PURE__ */ new THREE.Vector3();
const _t0 = /* @__PURE__ */ new THREE.Vector3();
const _t1 = /* @__PURE__ */ new THREE.Vector3();
const _n0 = /* @__PURE__ */ new THREE.Vector3();
const _b0 = /* @__PURE__ */ new THREE.Vector3();
const _p0 = /* @__PURE__ */ new THREE.Vector3();
const _sc = /* @__PURE__ */ new THREE.Vector3();
const _ringOut = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, nx: 0, ny: 0, nz: 0, radius: 0, arc: 0 };

/** Global counters, mirrored into `stats()`. */
const _counters = {
  trees: 0, bushes: 0, clumps: 0, geometries: 0, triangles: 0, bytes: 0,
  cards: 0, tubes: 0, atlasBakes: 0, barkBakes: 0, textureBytes: 0, updates: 0,
  /** How many canopies wanted a card larger than `VEG.cardScaleMax` allowed. A non-zero count
   *  means a species' crown has outgrown what 2-triangle cards can fill at this budget, and the
   *  honest answer then is more cards (a bigger LOD0 cap), not a bigger clamp. */
  cardScaleClamped: 0,
};

// ── tiny helpers ──────────────────────────────────────────────────────────────────────────────

/** Linear → sRGB transfer (IEC 61966-2-1). The atlas albedo ships in an sRGB8 texture, so the
 *  authored LINEAR colours must be encoded here or every leaf lands ~2 stops too dark. */
function linearToSRGB(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** sRGB → linear, the EXACT inverse of `linearToSRGB` and the exact transfer the sampler applies
 *  to an `SRGBColorSpace` texture. Anything that reasons about the albedo the FRAGMENT sees must
 *  read the shipped bytes back through this, never the float the painter wrote — the round trip
 *  through 8 bits is where a 0.5 % error becomes a visible one on a 0.04 blue channel. */
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** 8-bit quantise with a round, not a floor: a floor loses half an LSB on every channel and
 *  systematically darkens the whole atlas. */
function toByte(x) { return clamp(Math.round(x * 255), 0, 255); }

/** Deterministic 32-bit hash → [0,1). Used where a value must be reproducible from coordinates
 *  rather than drawn from a stream (per-tube phase, per-card tile choice). */
function hashF(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Pick an index from `weights` (need not be normalised) with a value already in [0,1). */
function pickWeighted(weights, u) {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];
  let r = u * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

/**
 * String edits on a shader source, with the same fail-CLOSED contract gfx/materialPatch.js uses:
 * a `find` that is missing or ambiguous is a hard error, never a silent no-op. An injection that
 * fails open is the worst failure mode there is — the material compiles, renders, and is simply
 * wrong, and nothing in the frame tells you.
 */
function applyEdits(src, edits, id, stage) {
  let out = src;
  for (let i = 0; i < edits.length; i++) {
    const e = edits[i];
    const at = out.indexOf(e.find);
    if (at === -1) {
      throw new Error(
        `[kitVeg] ${id}: ${stage} anchor not present: ${JSON.stringify(e.find.slice(0, 80))} — ` +
        'the injection would have silently done nothing.',
      );
    }
    if (out.indexOf(e.find, at + e.find.length) !== -1) {
      throw new Error(`[kitVeg] ${id}: ${stage} anchor is ambiguous: ${JSON.stringify(e.find.slice(0, 80))}`);
    }
    const next = e.mode === 'before' ? `${e.insert}\n${e.find}`
      : e.mode === 'replace' ? e.insert
        : `${e.find}\n${e.insert}`;
    out = out.slice(0, at) + next + out.slice(at + e.find.length);
  }
  return out;
}

/** GLSL float literal — `1` is an int in GLSL and `float x = 1;` does not compile. */
function g(n) {
  const s = Number(n).toPrecision(8).replace(/0+$/, '').replace(/\.$/, '.0');
  return s.indexOf('.') === -1 && s.indexOf('e') === -1 ? `${s}.0` : s;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §A — THE PORTED TreeGenerator SKELETON
//
// Algorithm-identical to vendor/addons/jsm/generators/TreeGenerator.js (`growBranch`,
// `perpendicular`, `transport`, `ringAt`), with the WebGPU/TSL material half deleted and four
// additions marked ⊕. Ported rather than imported because the addon's top-level
// `import { MeshStandardNodeMaterial } from 'three/webgpu'` throws in this project (ARCH §1).
//
// Rings are stored in FLAT typed arrays rather than the addon's `{pos, tangent, normal, binormal,
// radius}` object per ring: a 4-level tree is ~170 tubes × up to 25 rings = 4,000 ring objects and
// 16,000 Vector3 clones per tree, which is 20 ms of GC on a streaming budget of 1.6 ms.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Ring stride in `Tube.data`: pos(3) tangent(3) normal(3) binormal(3) radius(1) arcLength(1). */
const RING_STRIDE = 14;

/** A unit vector perpendicular to (x,y,z) — cross with the least-aligned axis. Direct port. */
function perpendicular(x, y, z, out) {
  if (Math.abs(x) < 0.9) { _axis.set(1, 0, 0); } else { _axis.set(0, 1, 0); }
  out.set(x, y, z).cross(_axis).normalize();
  // A degenerate cross (the tangent IS the chosen axis to within float noise) would hand every
  // ring a zero frame and collapse the tube to a line. Fall back to the other axis.
  if (out.lengthSq() < 1e-12) out.set(0, 0, 1).cross(_axis).normalize();
  return out;
}

/**
 * PARALLEL TRANSPORT (V2). Rotate frame vector `n` by the minimal rotation carrying t0 onto t1.
 * This is the 6-line function the dossier says to steal, and the reason is worth restating: a
 * Frenet frame is built from the curve's second derivative, which VANISHES and then reverses at
 * an inflection point — so a gnarled branch's bark texture snaps through 180° mid-branch. Parallel
 * transport has no second derivative in it and therefore cannot flip.
 */
function transport(t0x, t0y, t0z, t1x, t1y, t1z, n) {
  _axis.set(t0y * t1z - t0z * t1y, t0z * t1x - t0x * t1z, t0x * t1y - t0y * t1x);
  const sin = _axis.length();
  if (sin < 1e-6) return n;                       // already parallel — nothing to transport
  _axis.divideScalar(sin);
  const dot = t0x * t1x + t0y * t1y + t0z * t1z;
  n.applyAxisAngle(_axis, Math.atan2(sin, dot));
  return n;
}

/** Sample the branch frame at fraction t ∈ [0,1] for spawning a child. Direct port, flat-array. */
function ringAt(data, count, t, out) {
  const f = clamp(t, 0, 0.999) * (count - 1);
  const i = Math.floor(f);
  const frac = f - i;
  const a = i * RING_STRIDE;
  const b = Math.min(i + 1, count - 1) * RING_STRIDE;
  out.px = lerp(data[a], data[b], frac);
  out.py = lerp(data[a + 1], data[b + 1], frac);
  out.pz = lerp(data[a + 2], data[b + 2], frac);
  _t0.set(lerp(data[a + 3], data[b + 3], frac), lerp(data[a + 4], data[b + 4], frac), lerp(data[a + 5], data[b + 5], frac)).normalize();
  _n0.set(lerp(data[a + 6], data[b + 6], frac), lerp(data[a + 7], data[b + 7], frac), lerp(data[a + 8], data[b + 8], frac)).normalize();
  out.tx = _t0.x; out.ty = _t0.y; out.tz = _t0.z;
  out.nx = _n0.x; out.ny = _n0.y; out.nz = _n0.z;
  out.radius = lerp(data[a + 12], data[b + 12], frac);
  out.arc = lerp(data[a + 13], data[b + 13], frac);
  return out;
}

/**
 * Grow one branch as a gently curved, tapered tube and recurse, collecting tubes into `tubes`.
 * Direct port of `growBranch` with the ⊕ additions.
 *
 * @param {Array} tubes           output; each entry {data, count, radial, level, phase, baseY, len}
 * @param {number[]} base         [x,y,z] world start
 * @param {number[]} dir          [x,y,z] unit growth direction
 */
function growBranch(tubes, bx, by, bz, dx, dy, dz, length, baseRadius, level, p, random, budget) {
  // Two hard stops, both STRUCTURAL rather than advisory: the triangle cap is what makes the
  // module contract's "tree LOD0 ≤ 7 k tris" impossible to exceed with any parameter set, and the
  // tube cap bounds the recursion for a species table someone later edits to children [9,9,9].
  if (tubes.length >= budget.maxTubes || budget.tris >= budget.maxWoodyTris) return;

  const sections = Math.max(3, Math.min(24, Math.round(length / p.sectionLength)));
  // The addon drops one radial segment per level; we floor at 3 (a triangular prism still reads as
  // a twig at the 3–5 px it occupies) and cap the trunk at 8 — past that the extra ring vertices
  // buy nothing the bark normal map is not already delivering.
  const radial = clamp(p.radialSegments - level, 3, 8);
  const step = length / sections;
  const gnarl = p.gnarl[Math.min(level, p.gnarl.length - 1)];

  const count = sections + 1;
  const data = new Float32Array(count * RING_STRIDE);

  _t0.set(dx, dy, dz).normalize();
  perpendicular(_t0.x, _t0.y, _t0.z, _n0);
  _p0.set(bx, by, bz);
  let arc = 0;

  for (let s = 0; s <= sections; s++) {
    const t = s / sections;

    // Non-linear taper down to (1 − taper) of the base. taperCurve < 1 keeps the bole FULL and
    // then tapers, which is what a real bole does; taperCurve = 1 is a straight cone and reads as
    // a traffic cone with branches.
    let radius = baseRadius * ((1 - p.taper) + p.taper * Math.pow(1 - t, p.taperCurve));
    if (level === 0 && p.rootFlare > 0) {
      // Cubic knee confined to the bottom `flareFrac`. The flare is what plants the tree in the
      // ground; without it a trunk looks like a pipe pushed into the terrain.
      const flare = Math.max(0, (p.flareFrac - t) / p.flareFrac);
      radius *= 1 + p.rootFlare * flare * flare * flare;
    }

    _b0.set(_t0.y * _n0.z - _t0.z * _n0.y, _t0.z * _n0.x - _t0.x * _n0.z, _t0.x * _n0.y - _t0.y * _n0.x);

    const o = s * RING_STRIDE;
    data[o] = _p0.x; data[o + 1] = _p0.y; data[o + 2] = _p0.z;
    data[o + 3] = _t0.x; data[o + 4] = _t0.y; data[o + 5] = _t0.z;
    data[o + 6] = _n0.x; data[o + 7] = _n0.y; data[o + 8] = _n0.z;
    data[o + 9] = _b0.x; data[o + 10] = _b0.y; data[o + 11] = _b0.z;
    data[o + 12] = radius;
    data[o + 13] = arc;

    if (s < sections) {
      let nx = _t0.x + (random() * 2 - 1) * gnarl;
      let ny = _t0.y + (random() * 2 - 1) * gnarl;
      let nz = _t0.z + (random() * 2 - 1) * gnarl;
      if (level > 0) ny -= p.droop * step;          // branches sag; the trunk stays vertical
      const inv = 1 / Math.max(1e-6, Math.hypot(nx, ny, nz));
      nx *= inv; ny *= inv; nz *= inv;

      transport(_t0.x, _t0.y, _t0.z, nx, ny, nz, _n0);
      _n0.normalize();                              // renormalise: 24 transports accumulate drift
      _p0.x += nx * step; _p0.y += ny * step; _p0.z += nz * step;
      _t0.set(nx, ny, nz);
      arc += step;
    }
  }

  const isTerminal = level >= p.levels - 1 || length < p.minLength;
  tubes.push({
    data, count, radial, level, isTerminal,
    // ⊕ per-tube wind phase, hashed from the QUANTISED base position so it is a pure function of
    // where the branch is — two trees built from the same seed hash identically, and a branch that
    // moves by a millimetre between LOD tiers does not change phase and pop.
    phase: hashF(Math.round(bx * 64), Math.round(by * 64), Math.round(bz * 64)),
    baseY: by,
    length,
  });
  budget.tris += sections * radial * 2;

  if (isTerminal) return;

  // Fork: children spread along the upper branch, tilted off the local tangent, rolled by the
  // GOLDEN ANGLE (V1) so no two siblings ever line up, and thinned by the pipe model.
  const n = p.children[Math.min(level, p.children.length - 1)];
  const angle = p.branchAngle[Math.min(level, p.branchAngle.length - 1)];
  // THE PIPE MODEL (da Vinci / Murray): the summed cross-section of the children equals the
  // parent's, with the exponent 2.3 rather than the idealised 2.0 because real wood must also
  // carry a bending moment. childBase = parentBase · (1/n)^(1/2.3).
  const pipeDrop = Math.pow(1 / n, 1 / p.radiusExponent);
  const start = level === 0 ? p.trunkClear : p.childStart;

  for (let i = 0; i < n; i++) {
    const t = start + ((i + 0.5 + (random() - 0.5) * 0.6) / n) * (1 - start);
    const ring = ringAt(data, count, t, _ringOut);

    const tilt = (angle + (random() * 2 - 1) * p.angleVariance) * DEG2RAD;
    const roll = i * GOLDEN_ANGLE + (random() * 2 - 1) * 0.4;

    // Tilt off a PERPENDICULAR axis first, then roll about the parent axis, then pull back toward
    // the light. Order matters: roll-then-tilt sends half the children downward.
    _t1.set(ring.tx, ring.ty, ring.tz);
    _n0.set(ring.nx, ring.ny, ring.nz);
    _t1.applyAxisAngle(_n0, tilt);
    _sc.set(ring.tx, ring.ty, ring.tz);
    _t1.applyAxisAngle(_sc, roll);
    if (p.upPull > 0) _t1.lerp(_up, p.upPull).normalize();

    // Never fatter than the wood it leaves, never below the hair-thin floor.
    const childBase = Math.max(p.minRadius, Math.min(baseRadius * pipeDrop, ring.radius));
    // ⊕ EXCURRENT FORM: shorten children as they climb the leader. 0 = deliquescent (broadleaf),
    //   1 = a full cone. This is the single parameter that separates a conifer from a lumpy oak.
    const childLen = length * p.lengthRatio * lerp(1, 1 - 0.75 * t, p.excurrent);

    growBranch(tubes, ring.px, ring.py, ring.pz, _t1.x, _t1.y, _t1.z,
      childLen, childBase, level + 1, p, random, budget);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §B — WOODY GEOMETRY: sweep the tubes into ONE indexed BufferGeometry
//
// The addon emits non-indexed position+normal only — 6 vertices per quad, no UVs, no way to bind a
// bark material. This emitter produces the full shipped vertex format and an index buffer, which
// is a 2.7× vertex saving on the same triangles.
//
// UV CONTRACT. u runs AROUND the tube, v runs ALONG it, both in TILES of the bark texture
// (BARK.worldMetres = 1.2 m). Two details that are not obvious:
//   • u uses the tube's BASE radius, not the per-ring radius. Per-ring would skew the pattern into
//     a spiral as the tube tapers.
//   • the u span is SNAPPED to a whole number of tiles, so the seam at the back of the trunk lands
//     exactly on the texture's own wrap and disappears. Since the bark bake is exactly tileable
//     (mathx's `period` contract), that makes a trunk genuinely seamless — normally the one place
//     every procedural tree shows a vertical scar.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * @param {Array} tubes    from growBranch
 * @param {object} p       species params
 * @param {object} o       {treeHeight, uvScale, tintBaseMod, tintTipMod, tintFootMod, crownFlex}
 *                         The three tint fields are MODULATORS relative to the bark bake's own
 *                         `TINT.barkBase` (V7), never absolute albedos.
 * @returns {THREE.BufferGeometry} indexed, with position/normal/uv/color/aWind
 */
function emitWoody(tubes, p, o) {
  let vertCount = 0;
  let idxCount = 0;
  for (let i = 0; i < tubes.length; i++) {
    const t = tubes[i];
    vertCount += t.count * (t.radial + 1);          // +1 = the duplicated seam column (UV wrap)
    idxCount += (t.count - 1) * t.radial * 6;
  }

  const pos = new Float32Array(vertCount * 3);
  const nrm = new Float32Array(vertCount * 3);
  const uv = new Float32Array(vertCount * 2);
  const col = new Float32Array(vertCount * 3);
  const wind = new Float32Array(vertCount * 4);
  const idx = new (vertCount > 65535 ? Uint32Array : Uint16Array)(idxCount);

  const invH = 1 / Math.max(0.001, o.treeHeight);
  let v = 0;
  let ii = 0;

  for (let ti = 0; ti < tubes.length; ti++) {
    const tube = tubes[ti];
    const { data, count, radial, level } = tube;
    const base = v;

    // Snap the circumference to whole tiles so the seam column lands on the texture wrap.
    const rBase = data[12];
    const tilesAround = Math.max(1, Math.round((TAU * rBase) / BARK.worldMetres));
    // Levels beyond the first two are thin enough that one tile around is right regardless.
    const uSpan = level >= 2 ? 1 : tilesAround;

    // Flexibility ramps with depth: the bole barely moves, the twigs whip. `crownFlex` is the
    // species' whole-crown amplitude at t = 1.
    const flex = o.crownFlex * lerp(0.10, 1.0, Math.min(1, level / Math.max(1, p.levels - 1)));

    for (let r = 0; r < count; r++) {
      const d = r * RING_STRIDE;
      const px = data[d], py = data[d + 1], pz = data[d + 2];
      const nx = data[d + 6], ny = data[d + 7], nz = data[d + 8];
      const bx = data[d + 9], byy = data[d + 10], bz = data[d + 11];
      const radius = data[d + 12];
      const vCoord = data[d + 13] / BARK.worldMetres;

      // ── wind attribute (see the WIND GLSL for the exact consumer) ──────────────────────────
      //   x = t, the normalised distance from the anchor. The shader cubes it: t³ keeps the base
      //       planted and puts all the motion in the top third, which is what wood does.
      //   y = phase in [0,1)
      //   z = flexibility
      //   w = arm length in metres, so the shader can subtract the arc-length SAGITTA and stop a
      //       swaying branch from visibly stretching.
      const tHeight = saturate((py - 0) * invH);
      const armLen = Math.max(0.05, Math.hypot(px, py, pz));

      // Vertex colour: species tint × (young-wood lightening toward the twigs) × (damp/mossy
      // darkening in the bottom 12% of the bole) × a per-tube ±5% value break, so 400 instanced
      // trees do not all carry the identical bark value.
      const youth = level >= 2 ? saturate((level - 1) / Math.max(1, p.levels - 2)) : 0;
      const foot = level === 0 ? saturate(1 - (py * invH) / 0.12) : 0;
      const vary = 0.95 + 0.10 * tube.phase;
      // V7 — MODULATOR, not albedo. `bakeBark` already paints in `TINT.barkBase`; writing the
      // absolute tint here squared it, and `barkFoot` squared is what drew the BLACK FLARED SKIRT
      // the eye found where the bole meets the pavement (0.0098 linear, half an already-dark bole).
      const cr = lerp(o.tintBaseMod[0], o.tintTipMod[0], youth) * vary;
      const cg = lerp(o.tintBaseMod[1], o.tintTipMod[1], youth) * vary;
      const cb = lerp(o.tintBaseMod[2], o.tintTipMod[2], youth) * vary;

      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * TAU;
        const cs = Math.cos(a), sn = Math.sin(a);
        const rx = cs * nx + sn * bx;
        const ry = cs * ny + sn * byy;
        const rz = cs * nz + sn * bz;

        const v3 = v * 3;
        pos[v3] = px + rx * radius; pos[v3 + 1] = py + ry * radius; pos[v3 + 2] = pz + rz * radius;
        nrm[v3] = rx; nrm[v3 + 1] = ry; nrm[v3 + 2] = rz;
        uv[v * 2] = (j / radial) * uSpan;
        uv[v * 2 + 1] = vCoord;
        col[v3] = lerp(cr, o.tintFootMod[0], foot);
        col[v3 + 1] = lerp(cg, o.tintFootMod[1], foot);
        col[v3 + 2] = lerp(cb, o.tintFootMod[2], foot);
        const w4 = v * 4;
        wind[w4] = tHeight; wind[w4 + 1] = tube.phase; wind[w4 + 2] = flex; wind[w4 + 3] = armLen;
        v++;
      }
    }

    // Stitch consecutive rings into quads, wound so the normals face out (matches the addon).
    const stride = radial + 1;
    for (let r = 0; r < count - 1; r++) {
      const a = base + r * stride;
      const b = base + (r + 1) * stride;
      for (let j = 0; j < radial; j++) {
        idx[ii++] = a + j; idx[ii++] = b + j + 1; idx[ii++] = b + j;
        idx[ii++] = a + j; idx[ii++] = a + j + 1; idx[ii++] = b + j + 1;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aWind', new THREE.BufferAttribute(wind, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.name = 'veg.woody';
  return geo;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §C — CANOPY: clustered leaf cards + THE SPHERE NORMAL TRANSFER (V3/V4)
//
// Cards are placed on the TERMINAL twigs only, in clusters of 5–9, each card carrying a whole
// painted sprig from the atlas. Then — and this is the step that decides whether the tree reads as
// AAA or as a 2004 billboard tree — every card vertex's normal is replaced by a blend of the
// direction from the CANOPY CENTROID and the card's own face normal:
//
//     n = normalize( mix( normalize(v − C), cardNormal, 0.20 ) )
//
// The card normal is kept at 20% so the cards retain a little individual definition and the crown
// does not read as a shaded beach ball. At 0% the canopy is a sphere; at 100% it is the black/white
// per-card banding this whole technique exists to remove.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * @param {Array} tubes      from growBranch (terminal tubes are the twigs)
 * @param {object} p         species params
 * @param {Function} random  seeded PRNG
 * @param {object} o         {cardBudget, uvTiles, uvWeights, tint, sizeRange, treeHeight, crownFlex}
 * @returns {THREE.BufferGeometry|null}
 */
function emitCanopy(tubes, p, random, o) {
  const twigs = [];
  for (let i = 0; i < tubes.length; i++) if (tubes[i].isTerminal) twigs.push(tubes[i]);
  if (!twigs.length || o.cardBudget < 3) return null;

  // Allocate the budget across the twigs. `cardBudget` is whatever the woody half did not spend
  // (V-budget law), so the ≤7 k cap cannot be exceeded by any parameter set.
  const cap = o.cardCap || VEG.cardsPerTwig[1];
  // FLOOR, not round: rounding up can overspend the budget by half a card per twig, which on a
  // 1,500-twig tree is 750 cards — and the budget is what makes the ≤7 k cap structural.
  const perTwig = clamp(Math.floor(o.cardBudget / twigs.length), 0, cap);
  // If even the MINIMUM cluster does not fit, thin the twigs deterministically (every k-th keeps
  // its cluster) rather than shrinking clusters below 5 — a 2-card "cluster" is a billboard again.
  let stride = 1;
  let cards = perTwig;
  if (perTwig < VEG.cardsPerTwig[0]) {
    cards = VEG.cardsPerTwig[0];
    stride = Math.max(1, Math.ceil((twigs.length * cards) / Math.max(1, o.cardBudget)));
  }

  const used = [];
  for (let i = 0; i < twigs.length; i += stride) used.push(twigs[i]);
  const total = used.length * cards;
  if (total < 3) return null;

  /* ── LEAF AREA INDEX. See the block on `VEG.leafAreaTarget`: the card's metre size is DERIVED
     here, once `total` is known, from the crown the branch grower actually produced. A card is
     `size` long and `size * 0.72` wide (the corners below), so N cards carry 0.72 * N * s^2 of
     leaf area against a crown disc of pi * R^2, and solving for the target ratio gives `want`.
     The species' authored `sizeRange` keeps its VARIATION (min:max ratio) and loses its absolute
     scale, which was the thing that could not be right for every species at once. */
  const crownR = Math.max(0.30, o.crownRadius || 0);
  const nominal = Math.max(1e-4, (o.sizeRange[0] + o.sizeRange[1]) * 0.5);
  const want = crownR * Math.sqrt((Math.PI * VEG.leafAreaTarget) / (0.72 * total));
  const areaScale = clamp(want / nominal, VEG.cardScaleMin, VEG.cardScaleMax);
  const sizeLo = o.sizeRange[0] * areaScale;
  const sizeHi = o.sizeRange[1] * areaScale;
  _counters.cardScaleClamped += (want / nominal > VEG.cardScaleMax) ? 1 : 0;

  const vertCount = total * 4;
  const pos = new Float32Array(vertCount * 3);
  const nrm = new Float32Array(vertCount * 3);
  const uv = new Float32Array(vertCount * 2);
  const col = new Float32Array(vertCount * 3);
  const wind = new Float32Array(vertCount * 4);
  const thick = new Float32Array(vertCount);
  const idx = new (vertCount > 65535 ? Uint32Array : Uint16Array)(total * 6);

  const tileW = 1 / ATLAS.cols;
  const tileH = 1 / ATLAS.rows;
  const invH = 1 / Math.max(0.001, o.treeHeight);

  /* V7 — the vertex colour is a MODULATOR. Derive both hue targets ONCE, relative to the tint the
     atlas tiles this species samples were actually baked in. Hoisted out of the card loop: it is
     the same three floats for every card and the loop is the hot path. */
  const atlasRef = atlasTintFor(o.uvTiles, o.uvWeights);
  // R3 — leafModulator, not tintRatio: hue-preserving under the winter dress (see its docblock);
  // byte-identical for undressed species. The autumn target must be DRESSED like the base tint or
  // the 6% turned sprigs paint warm summer yellow onto a frosted crown.
  const tintMod = leafModulator(o.tint, atlasRef);
  const autumnMod = leafModulator(o.autumnTint || TINT.leafAutumn, atlasRef);

  let v = 0;
  let ii = 0;
  let cx = 0, cy = 0, cz = 0;                    // running canopy centroid

  for (let ci = 0; ci < used.length; ci++) {
    const twig = used[ci];
    const { data, count } = twig;

    for (let k = 0; k < cards; k++) {
      // Cards start a quarter of the way along the twig — a cluster hanging off the fork looks
      // glued on. The +jitter keeps them from forming visible rings.
      const t = 0.25 + 0.75 * ((k + 0.5) / cards) + (random() - 0.5) * (0.7 / cards);
      const ring = ringAt(data, count, t, _ringOut);

      // Orientation: roll about the twig axis (golden-angle stepped so a cluster spirals like real
      // phyllotaxis rather than fanning), then tilt ±25° off the perpendicular.
      const roll = k * GOLDEN_ANGLE + random() * 0.7;
      const tilt = (random() * 2 - 1) * VEG.cardTiltDeg * DEG2RAD;

      _t0.set(ring.tx, ring.ty, ring.tz);
      _n0.set(ring.nx, ring.ny, ring.nz).applyAxisAngle(_t0, roll).normalize();
      // The card's LENGTH axis leans away from the twig by (90° − tilt) so the sprig hangs out
      // into the light instead of lying along the branch.
      _t1.copy(_n0).multiplyScalar(Math.cos(tilt)).addScaledVector(_t0, Math.sin(tilt)).normalize();
      // WIDTH axis = length × twig, giving a frame that is orthonormal by construction.
      _b0.crossVectors(_t1, _t0).normalize();
      if (_b0.lengthSq() < 1e-8) _b0.set(1, 0, 0);

      const size = lerp(sizeLo, sizeHi, random());
      const half = size * 0.5;
      // Real sprigs are longer than they are wide; 1.0 : 0.72 matches the painted tiles.
      const hw = half * 0.72;

      // Card origin: slightly off the twig surface so the card does not z-fight the twig it hangs
      // from, and pushed OUT along the card's own length so the sprig starts at the twig.
      const ox = ring.px + _n0.x * ring.radius * 1.2;
      const oy = ring.py + _n0.y * ring.radius * 1.2;
      const oz = ring.pz + _n0.z * ring.radius * 1.2;

      // Corners. UV v = 0 is the sprig STEM end (at the twig) and v = 1 the tip, which is how the
      // tiles are painted — a flipped card puts the stem in mid-air.
      const mx = ox + _t1.x * (half * 2), my = oy + _t1.y * (half * 2), mz = oz + _t1.z * (half * 2);
      const fx = _b0.x * hw, fy = _b0.y * hw, fz = _b0.z * hw;

      const nx = _t0.x, ny = _t0.y, nz = _t0.z;   // card face normal (before the sphere transfer)

      // Tile choice + a deterministic horizontal mirror, so 1,800 cards are not 6 sprites repeated.
      const tileIdx = o.uvTiles[pickWeighted(o.uvWeights, random())];
      const tcx = (tileIdx % ATLAS.cols) * tileW;
      const tcy = Math.floor(tileIdx / ATLAS.cols) * tileH;
      // Inset by half a texel-of-the-padded-margin so bilinear filtering never reaches the
      // neighbouring tile.
      const inset = (ATLAS.padPx * 0.5) / ATLAS.size;
      const u0 = tcx + inset, u1 = tcx + tileW - inset;
      const v0 = tcy + inset, v1 = tcy + tileH - inset;
      const mirror = random() < 0.5;
      const uL = mirror ? u1 : u0;
      const uR = mirror ? u0 : u1;

      // Per-card leaf MODULATOR (V7 — read the block above `tintRatio`): a hue/value break plus,
      // at the outside of the crown, a warmer autumn tone. Both are expressed RELATIVE to the tint
      // the atlas tiles this species samples were baked in, so the atlas keeps the absolute
      // albedo and this stays a multiplier around 1.0. Deep-canopy AO is applied below once the
      // centroid is known.
      const jit = 0.82 + 0.34 * random();
      const autumn = random() < 0.06 ? 0.55 : 0.0;   // a few turned sprigs — real crowns are not uniform
      const cr = lerp(tintMod[0], autumnMod[0], autumn) * jit;
      const cg = lerp(tintMod[1], autumnMod[1], autumn) * jit;
      const cb = lerp(tintMod[2], autumnMod[2], autumn) * jit;

      const tH = saturate(oy * invH);
      const arm = Math.max(0.05, Math.hypot(ox, oy, oz));
      const flex = o.crownFlex;                    // cards are the most flexible thing on the tree

      const quad = [
        [ox - fx, oy - fy, oz - fz, uL, v0],
        [ox + fx, oy + fy, oz + fz, uR, v0],
        [mx + fx, my + fy, mz + fz, uR, v1],
        [mx - fx, my - fy, mz - fz, uL, v1],
      ];
      const first = v;
      for (let q = 0; q < 4; q++) {
        const c = quad[q];
        const v3 = v * 3;
        pos[v3] = c[0]; pos[v3 + 1] = c[1]; pos[v3 + 2] = c[2];
        nrm[v3] = nx; nrm[v3 + 1] = ny; nrm[v3 + 2] = nz;
        uv[v * 2] = c[3]; uv[v * 2 + 1] = c[4];
        col[v3] = cr; col[v3 + 1] = cg; col[v3 + 2] = cb;
        const w4 = v * 4;
        wind[w4] = tH; wind[w4 + 1] = twig.phase; wind[w4 + 2] = flex; wind[w4 + 3] = arm;
        // Thickness for the two-sided transmission term: the sprig is thinnest at its tip, so the
        // tip transmits most. This is what makes a backlit crown glow at the EDGES, which is the
        // whole read.
        thick[v] = lerp(0.55, 1.0, c[4]);
        cx += c[0]; cy += c[1]; cz += c[2];
        v++;
      }
      idx[ii++] = first; idx[ii++] = first + 1; idx[ii++] = first + 2;
      idx[ii++] = first; idx[ii++] = first + 2; idx[ii++] = first + 3;
    }
  }

  // ── THE SPHERE NORMAL TRANSFER (V3) ───────────────────────────────────────────────────────
  cx /= v; cy /= v; cz /= v;
  let maxR2 = 0;
  for (let i = 0; i < v; i++) {
    const i3 = i * 3;
    const dx = pos[i3] - cx, dy = pos[i3 + 1] - cy, dz = pos[i3 + 2] - cz;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 > maxR2) maxR2 = r2;
  }
  const invR = 1 / Math.max(1e-4, Math.sqrt(maxR2));
  const kCard = VEG.sphereNormalBlend;

  for (let i = 0; i < v; i++) {
    const i3 = i * 3;
    let dx = pos[i3] - cx, dy = pos[i3 + 1] - cy, dz = pos[i3 + 2] - cz;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) { dx = 0; dy = 1; dz = 0; } else { dx /= len; dy /= len; dz /= len; }
    const sx = lerp(dx, nrm[i3], kCard);
    const sy = lerp(dy, nrm[i3 + 1], kCard);
    const sz = lerp(dz, nrm[i3 + 2], kCard);
    const inv = 1 / Math.max(1e-6, Math.hypot(sx, sy, sz));
    nrm[i3] = sx * inv; nrm[i3 + 1] = sy * inv; nrm[i3 + 2] = sz * inv;

    // CANOPY-DEPTH AO, baked into the vertex colour while the centroid is in hand. A crown lit
    // uniformly from skirt to core is the second-biggest foliage tell after per-card banding; the
    // interior of a real crown sits 2–3 stops down. 0.42 at the core is measured off photographs
    // of deciduous crowns under an overcast sky.
    const ao = lerp(0.42, 1.0, smoothstep(0.15, 0.95, len * invR));
    col[i3] *= ao; col[i3 + 1] *= ao; col[i3 + 2] *= ao;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aWind', new THREE.BufferAttribute(wind, 4));
  geo.setAttribute('aVegThick', new THREE.BufferAttribute(thick, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.name = 'veg.canopy';
  geo.userData.canopy = { centroid: [cx, cy, cz], radius: Math.sqrt(maxR2), cards: total };
  _counters.cards += total;
  return geo;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §D — GRASS: blade clumps with BENT NORMALS (V6), and the 6-blades-in-one-card LOD1
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * One clump: 3 blades × 4 quads = 24 triangles. [AUTHORING §Vegetation: "3-blade clumps, each
 * blade a 4-quad strip (8 tris) with a taper and a bend; 0.35 m tall, 0.02 m base width"].
 *
 * The blade is built along a CIRCULAR ARC, not a straight line with a rotation at the tip: a real
 * blade's curvature is continuous, and a hinged blade catches the light in two flat bands instead
 * of one sweep. Normals are the true surface normals of that arc, then bent 62% toward world up.
 *
 * @param {object} opts {seed, blades, height, width, bend, dry, quads}
 */
function buildGrassClump(opts = EMPTY) {
  const rng = mulberry32((opts.seed | 0) || 0x51ade);
  const blades = clamp(opts.blades === undefined ? VEG.bladesPerClump : opts.blades | 0, 1, 8);
  const quads = clamp(opts.quads === undefined ? VEG.bladeQuads : opts.quads | 0, 2, 6);
  const baseH = opts.height === undefined ? VEG.bladeHeight : opts.height;
  const baseW = opts.width === undefined ? VEG.bladeBaseWidth : opts.width;
  const dry = opts.dry === undefined ? 0.25 : saturate(opts.dry);

  const rows = quads + 1;
  const vertCount = blades * rows * 2;
  const pos = new Float32Array(vertCount * 3);
  const nrm = new Float32Array(vertCount * 3);
  const uv = new Float32Array(vertCount * 2);
  const col = new Float32Array(vertCount * 3);
  const wind = new Float32Array(vertCount * 4);
  const thick = new Float32Array(vertCount);
  const idx = new Uint16Array(blades * quads * 6);

  let v = 0;
  let ii = 0;
  const k = VEG.grassBentNormal;

  for (let b = 0; b < blades; b++) {
    // Clump footprint: blades fan out of a ~30 mm tuft, never from one point (a shared origin
    // reads as a single fat blade from anywhere above eye level).
    const a0 = rng() * TAU;
    const rr = 0.015 * Math.sqrt(rng());
    const ox = Math.cos(a0) * rr;
    const oz = Math.sin(a0) * rr;

    const h = baseH * lerp(0.72, 1.18, rng());
    const w = baseW * lerp(0.85, 1.15, rng());
    // Total bend angle from vertical, 25–72°. Below 25° the clump reads as wire; past ~75° the
    // blade lies down and the bent normal has nothing left to rescue.
    const bendA = lerp(25, 72, rng()) * DEG2RAD * (opts.bend === undefined ? 1 : opts.bend);
    const yaw = rng() * TAU;                       // the direction the blade leans
    const dirX = Math.cos(yaw), dirZ = Math.sin(yaw);
    const stiff = lerp(0.75, 1.25, rng());
    const bladePhase = rng();
    const dryness = saturate(dry + (rng() - 0.5) * 0.35);

    const first = v;
    // Arc of total turn `bendA` over arc-length h: radius R = h / bendA. Parametrised BY ARC
    // LENGTH s, with the turn measured from vertical, the spine is exactly
    //     rise(s)    = R·sin(κs)          (κ = 1/R)
    //     lateral(s) = R·(1 − cos(κs))
    // so the blade keeps its length no matter how far it bends — which is the whole reason for
    // integrating the tangent instead of rotating a straight strip. At bend 25° a 0.35 m blade
    // stands 0.34 m and leans 0.075 m; at 72° it stands 0.265 m and leans 0.19 m. Both measured.
    const R = h / Math.max(1e-3, bendA);

    for (let r = 0; r < rows; r++) {
      const t = r / quads;                          // arc-length fraction = the wind attribute
      const ang = bendA * t;
      const sx = R * (1 - Math.cos(ang));           // lateral travel along the lean direction
      const sy = R * Math.sin(ang);                 // ...and the rise
      const px = ox + dirX * sx;
      const py = sy;
      const pz = oz + dirZ * sx;

      // Width taper: (1−t)^0.7 holds the blade broad through the middle and then closes to a
      // point. A linear taper reads as a triangle, which is the classic "grass = cone" tell.
      const hw = 0.5 * w * Math.pow(1 - t, 0.7) + 0.00035;

      // Surface normal of the arc at t. Spine tangent T = (dirX·sin, cos, dirZ·sin); width axis
      // W = (−dirZ, 0, dirX). −(T × W) reduces exactly to (−cos·dirX, sin, −cos·dirZ): HORIZONTAL
      // at the sheath — a vertical blade is a vertical ribbon and its face normal must be
      // horizontal — rotating to straight up as the blade folds over. That horizontal start is
      // precisely why the 0.62 bend is not optional: without it half the field faces away from the
      // sun. Analytic rather than a cross product per vertex because it is exact, and this is the
      // hottest inner loop in the kit (160 k instances × 30 vertices).
      const sA = Math.sin(ang), cA = Math.cos(ang);
      const wX = -dirZ, wZ = dirX;                  // width axis: horizontal, ⟂ to the lean
      const fnX = -cA * dirX;
      const fnY = sA;
      const fnZ = -cA * dirZ;

      // ── THE BENT NORMAL (V6) ───────────────────────────────────────────────────────────────
      let bnX = lerp(fnX, 0, k), bnY = lerp(fnY, 1, k), bnZ = lerp(fnZ, 0, k);
      const bl = 1 / Math.max(1e-6, Math.hypot(bnX, bnY, bnZ));
      bnX *= bl; bnY *= bl; bnZ *= bl;

      // Colour: dark and cool at the sheath, lighter and drier at the tip. The base darkening is
      // real self-shadowing inside the tuft and it is what stops a field reading as flat felt.
      const shade = lerp(0.38, 1.0, Math.pow(t, 0.65));
      const gr = lerp(TINT.grassGreen[0], TINT.grassDry[0], dryness * lerp(0.4, 1.0, t)) * shade;
      const gg = lerp(TINT.grassGreen[1], TINT.grassDry[1], dryness * lerp(0.4, 1.0, t)) * shade;
      const gb = lerp(TINT.grassGreen[2], TINT.grassDry[2], dryness * lerp(0.4, 1.0, t)) * shade;

      for (let s = 0; s < 2; s++) {
        const sgn = s === 0 ? -1 : 1;
        const v3 = v * 3;
        pos[v3] = px + wX * hw * sgn;
        pos[v3 + 1] = py;
        pos[v3 + 2] = pz + wZ * hw * sgn;
        nrm[v3] = bnX; nrm[v3 + 1] = bnY; nrm[v3 + 2] = bnZ;
        uv[v * 2] = s; uv[v * 2 + 1] = t;
        col[v3] = gr; col[v3 + 1] = gg; col[v3 + 2] = gb;
        const w4 = v * 4;
        wind[w4] = t; wind[w4 + 1] = bladePhase; wind[w4 + 2] = stiff; wind[w4 + 3] = Math.max(0.02, h * t);
        // A blade is ~0.2 mm thick and transmits heavily; the tip transmits most.
        thick[v] = lerp(0.7, 1.0, t);
        v++;
      }
      if (r < quads) {
        const a = first + r * 2;
        idx[ii++] = a; idx[ii++] = a + 1; idx[ii++] = a + 3;
        idx[ii++] = a; idx[ii++] = a + 3; idx[ii++] = a + 2;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aWind', new THREE.BufferAttribute(wind, 4));
  geo.setAttribute('aVegThick', new THREE.BufferAttribute(thick, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.name = 'veg.grassClump';
  geo.userData.aaa = { tris: blades * quads * 2, blades, height: baseH };
  _counters.clumps++;
  return geo;
}

/**
 * Grass LOD1: ONE alpha-tested card carrying six painted blades. [RAGE §Foliage] "LOD1 (25–60 m):
 * a 4-vertex card carrying 6 painted blades in its alpha, which cuts instance count 6× for that
 * band." It samples the SAME atlas as the leaf cards, so it shares the leaf material and costs no
 * extra draw call family.
 *
 * Two crossed quads rather than one: a single card disappears edge-on, and at 25–60 m the player
 * is moving laterally most of the time. 4 tris.
 */
function buildGrassCard(opts = EMPTY) {
  const w = opts.width === undefined ? 0.62 : opts.width;
  const h = opts.height === undefined ? 0.42 : opts.height;
  const tileW = 1 / ATLAS.cols;
  const tileH = 1 / ATLAS.rows;
  const tcx = (TILE.grassCard % ATLAS.cols) * tileW;
  const tcy = Math.floor(TILE.grassCard / ATLAS.cols) * tileH;
  const inset = (ATLAS.padPx * 0.5) / ATLAS.size;
  const u0 = tcx + inset, u1 = tcx + tileW - inset;
  const v0 = tcy + inset, v1 = tcy + tileH - inset;

  const planes = 2;
  const pos = new Float32Array(planes * 4 * 3);
  const nrm = new Float32Array(planes * 4 * 3);
  const uv = new Float32Array(planes * 4 * 2);
  const col = new Float32Array(planes * 4 * 3);
  const wind = new Float32Array(planes * 4 * 4);
  const thick = new Float32Array(planes * 4);
  const idx = new Uint16Array(planes * 6);

  const k = VEG.grassBentNormal;
  let v = 0, ii = 0;
  for (let pi = 0; pi < planes; pi++) {
    const a = (pi / planes) * PI + 0.25;
    const ax = Math.cos(a) * w * 0.5, az = Math.sin(a) * w * 0.5;
    // Face normal of the card, then bent to up by the SAME 0.62 — a card whose normal was left
    // horizontal is exactly the black-field failure the bent normal exists to prevent.
    let nx = -Math.sin(a), nz = Math.cos(a);
    let ny = 0;
    nx = lerp(nx, 0, k); ny = lerp(ny, 1, k); nz = lerp(nz, 0, k);
    const nl = 1 / Math.hypot(nx, ny, nz);
    nx *= nl; ny *= nl; nz *= nl;

    const first = v;
    const corners = [
      [-ax, 0, -az, u0, v0], [ax, 0, az, u1, v0], [ax, h, az, u1, v1], [-ax, h, -az, u0, v1],
    ];
    for (let q = 0; q < 4; q++) {
      const c = corners[q];
      const v3 = v * 3;
      pos[v3] = c[0]; pos[v3 + 1] = c[1]; pos[v3 + 2] = c[2];
      nrm[v3] = nx; nrm[v3 + 1] = ny; nrm[v3 + 2] = nz;
      uv[v * 2] = c[3]; uv[v * 2 + 1] = c[4];
      col[v3] = 1; col[v3 + 1] = 1; col[v3 + 2] = 1;
      const t = c[1] / h;
      const w4 = v * 4;
      wind[w4] = t; wind[w4 + 1] = pi * 0.37; wind[w4 + 2] = 0.85; wind[w4 + 3] = Math.max(0.02, h * t);
      thick[v] = lerp(0.7, 1.0, t);
      v++;
    }
    idx[ii++] = first; idx[ii++] = first + 1; idx[ii++] = first + 2;
    idx[ii++] = first; idx[ii++] = first + 2; idx[ii++] = first + 3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aWind', new THREE.BufferAttribute(wind, 4));
  geo.setAttribute('aVegThick', new THREE.BufferAttribute(thick, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.name = 'veg.grassCard';
  geo.userData.aaa = { tris: planes * 2 };
  return geo;
}

/**
 * ⭐ §D-bis — THE FERN (E-BIOME FOREST, 2026-09-05). `BIOME_SCOPE.md` FOR-3, verbatim: "There is
 * no undergrowth — `ferns` is a taller grass clump."
 *
 * THE DEFECT IT REPAIRS, on BOTH paths at once:
 *   · `world/vegPlacer.js#placeGroundcover` had `const tall = kind === 'meadow' || kind === 'ferns'`
 *     and then built the SAME `grassClump` at the same size for both, while
 *     `describeVegGrammar()` published `kinds: ['grass','meadow','ferns']` as if they were three
 *     things. Two of the three names were one geometry.
 *   · the streamed stack has a real `fern` prototype (`chunkWorker PROTO_TABLE` row 5, h 0.70,
 *     moistMin 0.58) and `biomeSpec.TARGET_MORPHEMES` resolves fern|frond|bracken|understor to
 *     it — and `scenes/city.js`'s RECIPE draws it as `bushObj`.
 *   · `grep -n fern src/geo/kitVeg.js` returned NOTHING but atlas tile names. There was no fern
 *     in the kit to draw even if a consumer had wanted one.
 *
 * THE FORM: a rosette of `fronds` CROZIER ARCS, each a tapered quad strip whose UVs sweep one
 * atlas tile vertically. The arc is the SAME arc-length integration `buildGrassClump` uses (a
 * circular arc parametrised by arc length, so the frond keeps its length however far it bends)
 * with two differences that are the whole species: the frond is ~14x wider than a blade, and the
 * bend runs to 88 degrees rather than 72 — a fern frond arches over past the horizontal, which is
 * the silhouette the eye reads as "forest floor" rather than "long grass".
 *
 * ⛔ IT SAMPLES THE SHRUB TILE, AND THAT IS A COMPROMISE, NOT A DESIGN. The atlas is 4x4 = 16
 * tiles and ALL SIXTEEN ARE TAKEN (`TILE`); adding a pinnate frond tile means re-plumbing
 * `ATLAS.cols/rows`, `TILE_TINT` (which `selfTest` asserts against the bake plan) and the bake's
 * `plan` — a whole edit to the atlas contract, on a night with no browser to look at the result.
 * So the frond borrows `shrubA`/`shrubB`, whose alpha is a leafy sprig: read at fern scale it
 * gives a broken, pinnate-ish edge rather than a solid paddle, which is 80% of the read for 0% of
 * the atlas risk. A REAL frond tile is the honest next step and is named here rather than
 * implied.
 *
 * COST, and it is the reason this is the highest look-per-triangle item in the lane: LOD0 is
 * `fronds * quads * 2` triangles — 6 x 3 x 2 = 36 by default, against `grassClump`'s 24 — and it
 * binds `materials.leaf`, the SAME material the canopy cards and `grassCard` already use, so it
 * adds ZERO draw-call families and ZERO programs. `scenes/forest.js` places 2786 ferns inside
 * 355,984 herb-layer triangles; at 36 tris a full understorey is ~0.10 M triangles, ~2% of the
 * 5.2 M Tier A cap.
 *
 * @param {object} opts {seed, fronds, quads, height, width, dry, tile}
 */
function buildFernClump(opts = EMPTY) {
  const rng = mulberry32((opts.seed | 0) || 0xfe27);
  const fronds = clamp(opts.fronds === undefined ? 6 : opts.fronds | 0, 1, 12);
  const quads = clamp(opts.quads === undefined ? 3 : opts.quads | 0, 2, 6);
  const baseH = opts.height === undefined ? 0.62 : opts.height;
  const baseW = opts.width === undefined ? 0.19 : opts.width;
  /* `dry` walks the vertex colour from a deep shade-green toward a bracken brown. It is a
     MODULATOR around 1.0, not an albedo (V7): this geometry rides the mapped leaf material, so
     writing an absolute tint here would square the bake exactly as the canopy once did. */
  const dry = opts.dry === undefined ? 0.15 : saturate(opts.dry);
  const tile = opts.tile === undefined ? TILE.shrubA : opts.tile | 0;

  const tileW = 1 / ATLAS.cols;
  const tileH = 1 / ATLAS.rows;
  const inset = (ATLAS.padPx * 0.5) / ATLAS.size;
  const tu0 = (tile % ATLAS.cols) * tileW + inset;
  const tu1 = (tile % ATLAS.cols) * tileW + tileW - inset;
  const tv0 = Math.floor(tile / ATLAS.cols) * tileH + inset;
  const tv1 = Math.floor(tile / ATLAS.cols) * tileH + tileH - inset;

  /* The modulator, computed ONCE against the tile the frond actually samples — the same
     denominator law `atlasTintFor` states for a canopy. `leafDeep` is the shade target: an
     understorey fern lives under a closed canopy and is the darkest green in the frame. */
  const ref = atlasTintFor([tile], [1]);
  const wet = leafModulator(TINT.leafDeep, ref);
  const brown = leafModulator([0.115, 0.086, 0.038], ref);

  const rows = quads + 1;
  const vertCount = fronds * rows * 2;
  const pos = new Float32Array(vertCount * 3);
  const nrm = new Float32Array(vertCount * 3);
  const uv = new Float32Array(vertCount * 2);
  const col = new Float32Array(vertCount * 3);
  const wind = new Float32Array(vertCount * 4);
  const thick = new Float32Array(vertCount);
  const idx = new Uint16Array(fronds * quads * 6);

  let v = 0;
  let ii = 0;
  const k = VEG.grassBentNormal;

  for (let b = 0; b < fronds; b++) {
    /* The rosette. Fronds leave a ~60 mm crown at EVEN azimuths plus a jitter — a fern's fronds
       radiate from one rhizome and a purely random yaw leaves gaps and doubles, which reads as
       three separate plants rather than one. */
    const a0 = (b / fronds) * TAU + (rng() - 0.5) * (TAU / fronds) * 0.7;
    const rr = 0.03 * Math.sqrt(rng());
    const ox = Math.cos(a0) * rr;
    const oz = Math.sin(a0) * rr;

    const h = baseH * lerp(0.68, 1.22, rng());
    const w = baseW * lerp(0.82, 1.18, rng());
    // 46-88 degrees. The top of the range is past a grass blade's 72: a frond ARCHES OVER, and
    // that overhang is what puts a shadow on the litter under it.
    const bendA = lerp(46, 88, rng()) * DEG2RAD;
    const yaw = a0 + (rng() - 0.5) * 0.5;         // the frond leans the way it left the crown
    const dirX = Math.cos(yaw), dirZ = Math.sin(yaw);
    const stiff = lerp(0.55, 0.95, rng());        // softer than grass — a frond flops
    const phase = rng();
    const dryness = saturate(dry + (rng() - 0.5) * 0.30);
    const R = h / Math.max(1e-3, bendA);

    const first = v;
    for (let r = 0; r < rows; r++) {
      const t = r / quads;
      const ang = bendA * t;
      const sx = R * (1 - Math.cos(ang));
      const sy = R * Math.sin(ang);
      const px = ox + dirX * sx;
      const py = sy;
      const pz = oz + dirZ * sx;

      /* Width profile: a frond is NARROW at the stipe, WIDEST at about a third of its length and
         tapers to the tip — sin(pi * t^0.62) puts the maximum at t ~ 0.30. A (1-t)^0.7 taper (the
         grass blade's) would make it a triangle, which is the shape a fern is not. */
      const hw = 0.5 * w * Math.sin(PI * Math.pow(t, 0.62)) + 0.004;

      const sA = Math.sin(ang), cA = Math.cos(ang);
      const wX = -dirZ, wZ = dirX;
      const fnX = -cA * dirX;
      const fnY = sA;
      const fnZ = -cA * dirZ;
      let bnX = lerp(fnX, 0, k), bnY = lerp(fnY, 1, k), bnZ = lerp(fnZ, 0, k);
      const bl = 1 / Math.max(1e-6, Math.hypot(bnX, bnY, bnZ));
      bnX *= bl; bnY *= bl; bnZ *= bl;

      // Shade at the stipe, dry at the tip — the same self-shadowing gradient the blade carries,
      // shallower because a frond is flat and catches more of the sky along its whole length.
      const shade = lerp(0.52, 1.0, Math.pow(t, 0.55));
      const d1 = dryness * lerp(0.35, 1.0, t);
      const cr = lerp(wet[0], brown[0], d1) * shade;
      const cg = lerp(wet[1], brown[1], d1) * shade;
      const cb = lerp(wet[2], brown[2], d1) * shade;

      for (let s = 0; s < 2; s++) {
        const sgn = s === 0 ? -1 : 1;
        const v3 = v * 3;
        pos[v3] = px + wX * hw * sgn;
        pos[v3 + 1] = py;
        pos[v3 + 2] = pz + wZ * hw * sgn;
        nrm[v3] = bnX; nrm[v3 + 1] = bnY; nrm[v3 + 2] = bnZ;
        uv[v * 2] = s === 0 ? tu0 : tu1;
        uv[v * 2 + 1] = tv0 + (tv1 - tv0) * t;
        col[v3] = cr; col[v3 + 1] = cg; col[v3 + 2] = cb;
        const w4 = v * 4;
        wind[w4] = t; wind[w4 + 1] = phase; wind[w4 + 2] = stiff; wind[w4 + 3] = Math.max(0.02, h * t);
        thick[v] = lerp(0.75, 1.0, t);
        v++;
      }
      if (r < quads) {
        const a = first + r * 2;
        idx[ii++] = a; idx[ii++] = a + 1; idx[ii++] = a + 3;
        idx[ii++] = a; idx[ii++] = a + 3; idx[ii++] = a + 2;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aWind', new THREE.BufferAttribute(wind, 4));
  geo.setAttribute('aVegThick', new THREE.BufferAttribute(thick, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.name = 'veg.fernClump';
  geo.userData.aaa = { tris: fronds * quads * 2, fronds, height: baseH };
  return geo;
}

/**
 * Fern LOD1: two crossed cards on the same atlas tile, 4 triangles — exactly `grassCard`'s
 * contract and for exactly its reason (a single card disappears edge-on, and past ~25 m the
 * player is moving laterally most of the time). Bind `materials.leaf`.
 */
function buildFernCard(opts = EMPTY) {
  const w = opts.width === undefined ? 0.66 : opts.width;
  const h = opts.height === undefined ? 0.52 : opts.height;
  const tile = opts.tile === undefined ? TILE.shrubB : opts.tile | 0;
  const tileW = 1 / ATLAS.cols;
  const tileH = 1 / ATLAS.rows;
  const inset = (ATLAS.padPx * 0.5) / ATLAS.size;
  const u0 = (tile % ATLAS.cols) * tileW + inset;
  const u1 = (tile % ATLAS.cols) * tileW + tileW - inset;
  const v0 = Math.floor(tile / ATLAS.cols) * tileH + inset;
  const v1 = Math.floor(tile / ATLAS.cols) * tileH + tileH - inset;

  const ref = atlasTintFor([tile], [1]);
  const mod = leafModulator(TINT.leafDeep, ref);

  const planes = 2;
  const pos = new Float32Array(planes * 4 * 3);
  const nrm = new Float32Array(planes * 4 * 3);
  const uv = new Float32Array(planes * 4 * 2);
  const col = new Float32Array(planes * 4 * 3);
  const wind = new Float32Array(planes * 4 * 4);
  const thick = new Float32Array(planes * 4);
  const idx = new Uint16Array(planes * 6);

  const k = VEG.grassBentNormal;
  let v = 0, ii = 0;
  for (let pi = 0; pi < planes; pi++) {
    const a = (pi / planes) * PI + 0.42;
    const ax = Math.cos(a) * w * 0.5, az = Math.sin(a) * w * 0.5;
    let nx = -Math.sin(a), nz = Math.cos(a);
    let ny = 0;
    nx = lerp(nx, 0, k); ny = lerp(ny, 1, k); nz = lerp(nz, 0, k);
    const nl = 1 / Math.hypot(nx, ny, nz);
    nx *= nl; ny *= nl; nz *= nl;

    const first = v;
    const corners = [
      [-ax, 0, -az, u0, v0], [ax, 0, az, u1, v0], [ax, h, az, u1, v1], [-ax, h, -az, u0, v1],
    ];
    for (let q = 0; q < 4; q++) {
      const c = corners[q];
      const v3 = v * 3;
      pos[v3] = c[0]; pos[v3 + 1] = c[1]; pos[v3 + 2] = c[2];
      nrm[v3] = nx; nrm[v3 + 1] = ny; nrm[v3 + 2] = nz;
      uv[v * 2] = c[3]; uv[v * 2 + 1] = c[4];
      col[v3] = mod[0]; col[v3 + 1] = mod[1]; col[v3 + 2] = mod[2];
      const t = c[1] / h;
      const w4 = v * 4;
      wind[w4] = t; wind[w4 + 1] = pi * 0.41; wind[w4 + 2] = 0.7; wind[w4 + 3] = Math.max(0.02, h * t);
      thick[v] = lerp(0.75, 1.0, t);
      v++;
    }
    idx[ii++] = first; idx[ii++] = first + 1; idx[ii++] = first + 2;
    idx[ii++] = first; idx[ii++] = first + 2; idx[ii++] = first + 3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aWind', new THREE.BufferAttribute(wind, 4));
  geo.setAttribute('aVegThick', new THREE.BufferAttribute(thick, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.name = 'veg.fernCard';
  geo.userData.aaa = { tris: planes * 2 };
  return geo;
}

/**
 * Tree LOD2: the cross billboard. [AUTHORING] "LOD2 = a 2-quad cross billboard, 4 tris."
 * Three quads here, not two — a 2-quad cross has a 45° azimuth where the crown is edge-on twice
 * per revolution and visibly thins.
 *
 * ⚠️ INTEGRATOR: this is the DISTANT-STANDIN, not the HLOD impostor. The real hemi-octahedral
 * impostor is baked by the HLOD system from a render of LOD0; this card exists so a tree that
 * falls out of the impostor atlas still has a silhouette instead of a hole.
 *
 * ══ ⛔⛔ TWO DEFECTS LIVED HERE FOR THE WHOLE LIFE OF THIS FILE, AND BOTH ARE WHY A RIDGELINE
 *        READ AS DARK FLOATING SHARDS. Neither is an albedo bug — the tile is FINE, measured:
 *        `TILE.canopyBlob` opaque-texel mean is LINEAR [0.0778, 0.1291, 0.0417] at 0.650 coverage,
 *        an ordinary mid-green leaf reflectance. Do not darken or re-tint it. ══
 *
 * ── 1. THE CROWN FLOATED. ────────────────────────────────────────────────────────────────────
 * The card spanned y0 = 0.20·height to y1 = 1.02·height and there was NO trunk, on the stated
 * ground that "at 100 m+ a 0.3 m trunk is under a pixel". Both halves of that are wrong and it is
 * arithmetic, not taste. LOD2 switches at `lodDetail[2].distanceK × radius`, and `radius` is the
 * CROWN radius, so the switch is much closer than 100 m for a narrow tree. Measured, at the 60°
 * vertical FOV and 900 px viewport the streamer's own `screenPx` assumes:
 *
 *     species   height   LOD2 switch   the 0.20·h GAP under the card   bole width at the switch
 *     oak       12.17 m      161.1 m        2.43 m  =  11.8 px             0.68 m  =  3.3 px
 *     poplar    13.98 m       62.9 m        2.80 m  =  34.6 px             0.44 m  =  5.4 px
 *
 * A 12-to-35 pixel band of daylight under every distant crown is not a sub-pixel detail; it is
 * THE silhouette, and it is the difference between "a tree on a ridge" and "a dark blob hovering
 * over a ridge". The bole is 3–5 px wide at the same distance, i.e. three to five times the width
 * the old note claimed disqualified it.
 *
 * ── 2. THE QUAD THAT WAS LIT WAS THE ONE YOU COULD NOT SEE. ──────────────────────────────────
 * Every vertex of a plane carried ONE constant normal, biased toward world up
 * (`normalize(-sin a·0.45, 1, cos a·0.45)` → n.y = 0.9119, |n_h| = 0.4104), so a whole quad had
 * exactly one lighting answer and the card had three. With the sun at 13° elevation
 * (L.y = 0.2250, |L_h| = 0.9744) each quad's lambert is
 *
 *     N·L = 0.9119·0.2250 + 0.4104·0.9744·cos Δφ = 0.2052 + 0.3999·cos Δφ
 *
 * and the three plane normals sit at azimuths 90° / 150° / 210° — a 120° arc, not a full ring. At
 * sun azimuth 0° that is 0.2052 / 0 / 0, and the ONE quad still carrying a positive term is the
 * plane whose own azimuth is 0°, which is EXACTLY EDGE-ON to a viewer standing at azimuth 0°.
 *
 * ⭐ THE LIT QUAD IS THE ONE YOU CANNOT SEE. Both measurements below sample the card's SURFACE
 * (bilinear normals over an inscribed-ellipse coverage mask, each quad weighted by its projected
 * width |sin(a − φ_view)|), swept over all view AND sun azimuths at 13° elevation:
 *
 *     screen-weighted card MEAN         min       max      mean over all (view, sun)
 *       BEFORE                        0.0000    0.5514             0.2470
 *       AFTER                         0.0225    0.4517             0.2592
 *
 *     BRIGHTEST SINGLE TEXEL anywhere on the card, minimised over all (view, sun)
 *       BEFORE                        0.0000     <- no pixel of the tree receives any sun at all
 *       AFTER                         0.2459
 *
 * ⭐⭐ THE FIX ADDS 5 % OF LIGHT AND REMOVES A 100 % BLACKOUT, and that ratio is the whole point:
 * a brightening hack moves the mean, this moves the FLOOR. The card stops having one answer per
 * quad and starts having a gradient. (`selfTest` §4b asserts the cheaper vertex-level form of the
 * same thing — worst-azimuth brightest crown vertex ≥ 0.20; the shipped species measure
 * 0.4227 (poplar) to 0.7278 (willow), and the old geometry scored 0.0052.)
 *
 * ── THE ROOT, AND IT IS LAW V3, NOT A NEW IDEA. ──────────────────────────────────────────────
 * V3 says every canopy vertex gets n = normalize(mix(normalize(v − centroid), cardNormal, 0.20))
 * and that "there is no path through this file that ships a leaf card with its raw face normal".
 * This was that path. The billboard is a proxy for a VOLUME, so it takes the same sphere transfer
 * `emitCanopy` applies, about the card's own centroid — which is exactly (0, (y0+y1)/2, 0) by
 * symmetry, so no accumulation pass is needed.
 *
 * The four corners of a quad land in the tile's TRANSPARENT margin (the blob is an inscribed
 * ellipse), so what the eye actually sees is the INTERPOLATED field, and that field is right for
 * any crown aspect ratio: averaging the two left corner normals gives the crown's left limb
 * (−0.955, 0, 0.297 for the oak), the two top ones give its top (0, 0.922, 0.388), and the quad
 * centre collapses to the face normal because the two radials there cancel and only the 0.20 blend
 * term survives. Squat crown or columnar poplar, the limbs come out horizontal.
 *
 * ⭐ AND IT TURNS THE SKY TRANSMISSION BACK ON. `FOLIAGE_TRANSLUCENT_FRAGMENT`'s V8b term is
 * `saturate(0.5 − 0.5·dot(N, up))` — the sky irradiance arriving on the BACK of a leaf, which is
 * what stops a card facing away from the sky reading as a hole punched in it. Pinned at n.y =
 * 0.9119 that term was 0.0440, i.e. off. Sphere-transferred it runs 0.2121 (crown top) to 0.7879
 * (crown underside): 4.8x to 17.9x, and the underside of a distant crown gets the transmitted
 * skylight a real one has instead of going flat black.
 *
 * ── THE TRI BUDGET ───────────────────────────────────────────────────────────────────────────
 * 6 tris (3 crown quads) -> 10 tris (+ a 2-quad crossed bole, 4 tris). The bole is crossed at 0°
 * and 90° rather than reusing the crown's 3 azimuths because for a THIN vertical bar the figure of
 * merit is the worst-case projected width, and perpendicular is the optimum: min over view azimuth
 * is 1.00× a single quad's width for a 0°/90° pair against 0.87× for a 0°/60° pair, at half the
 * triangles of a third quad. The tier still replaces a MEASURED 4,384-triangle oak LOD0, so the
 * reduction goes 731:1 -> 438:1; on `scenes/forest.js`'s heaviest station (1,836 live billboards)
 * that is 11,016 -> 18,360 triangles, +0.14 % of the 5.2 M frame cap.
 *
 * @param {object} [bole]  `{radius, flare, tint, uv}` — omit and the crown ships alone at 6 tris,
 *                         which is what happens when the atlas search finds no opaque core.
 */
/* §1b (2026-08-05): `taper` narrows the TOP corners (0 = the old rectangle; ~0.8 = conifer). The
 * frozen-world census proved the far field is ALL billboards past ~60 m, and a species-agnostic
 * round crown card put a broadleaf silhouette on every distant pine — the frame read as an
 * orchard on snowpack. One number, per species, from the same SPRIG table that already knows
 * which leaves are needles. */
function buildTreeBillboard(height, radius, tint, bole, taper) {
  const crownPlanes = 3;
  const bolePlanes = bole && bole.uv ? 2 : 0;
  const quads = crownPlanes + bolePlanes;
  const pos = new Float32Array(quads * 4 * 3);
  const nrm = new Float32Array(quads * 4 * 3);
  const uv = new Float32Array(quads * 4 * 2);
  const col = new Float32Array(quads * 4 * 3);
  const wind = new Float32Array(quads * 4 * 4);
  const thick = new Float32Array(quads * 4);
  const idx = new Uint16Array(quads * 6);

  const tileW = 1 / ATLAS.cols, tileH = 1 / ATLAS.rows;
  const tcx = (TILE.canopyBlob % ATLAS.cols) * tileW;
  const tcy = Math.floor(TILE.canopyBlob / ATLAS.cols) * tileH;
  const inset = (ATLAS.padPx * 0.5) / ATLAS.size;
  const u0 = tcx + inset, u1 = tcx + tileW - inset;
  const v0 = tcy + inset, v1 = tcy + tileH - inset;

  const y0 = height * 0.20;                       // the crown card starts above the bole
  const y1 = height * 1.02;
  const yc = (y0 + y1) * 0.5;                     // the 12 corners' centroid, exactly, by symmetry
  const kCard = VEG.sphereNormalBlend;            // V3 — the SAME 0.20 `emitCanopy` uses
  let v = 0, ii = 0;
  for (let pi = 0; pi < crownPlanes; pi++) {
    const a = (pi / crownPlanes) * PI;
    const ax = Math.cos(a) * radius, az = Math.sin(a) * radius;
    // The card's TRUE face normal — horizontal, perpendicular to the plane. It is the 20 % term of
    // the transfer, not the answer; see the docblock for why the old up-bias put the lit quad
    // edge-on to the viewer.
    const fx = -Math.sin(a), fz = Math.cos(a);
    const first = v;
    // The taper narrows only the TOP corners — base width is the crown's, apex is (1-taper) of it.
    const tk = Math.max(0, Math.min(0.95, taper || 0));
    const txv = ax * (1 - tk), tzv = az * (1 - tk);
    const corners = [
      [-ax, y0, -az, u0, v0], [ax, y0, az, u1, v0], [txv, y1, tzv, u1, v1], [-txv, y1, -tzv, u0, v1],
    ];
    for (let q = 0; q < 4; q++) {
      const c = corners[q];
      const v3 = v * 3;
      pos[v3] = c[0]; pos[v3 + 1] = c[1]; pos[v3 + 2] = c[2];
      /* V3 on a sphere, OR ITS CONE FORM ON A TAPERED CARD (R3 follow-through, measured
         2026-08-05): the §1b taper made the needle silhouette a cone but left the SPHERE
         transfer, and a tall narrow tapered crown's corner radials collapse to ±vertical — the
         quads then live off the 0.20 face blend alone, and `litQuadIsNeverTheHiddenOne.pine`
         went red (1 of 3 quads lit at the worst azimuth). A cone's surface normal is the BOLE's
         cylinder law with a slope: horizontally radial off the AXIS, tilted up by the cone's
         half-angle — so every quad keeps an azimuth-spread lit limb at any sun. tk = 0 keeps the
         sphere path bit-identical for every broadleaf. */
      let sx, sy, sz;
      if (tk > 0) {
        const hl = Math.max(1e-6, Math.hypot(c[0], c[2]));
        const tilt = (radius * tk) / Math.max(0.01, y1 - y0);   // tan of the cone half-angle
        const hn = 1 / Math.hypot(1, tilt);
        sx = lerp((c[0] / hl) * hn, fx, kCard);
        sy = lerp(tilt * hn, 0, kCard);
        sz = lerp((c[2] / hl) * hn, fz, kCard);
      } else {
        // V3, verbatim: radial off the crown centroid, blended 0.20 toward the card normal.
        const dx = c[0], dy = c[1] - yc, dz = c[2];
        const dl = Math.max(1e-6, Math.hypot(dx, dy, dz));
        sx = lerp(dx / dl, fx, kCard);
        sy = lerp(dy / dl, 0, kCard);
        sz = lerp(dz / dl, fz, kCard);
      }
      const inv = 1 / Math.max(1e-6, Math.hypot(sx, sy, sz));
      nrm[v3] = sx * inv; nrm[v3 + 1] = sy * inv; nrm[v3 + 2] = sz * inv;
      uv[v * 2] = c[3]; uv[v * 2 + 1] = c[4];
      col[v3] = tint[0]; col[v3 + 1] = tint[1]; col[v3 + 2] = tint[2];
      const t = (c[1] - y0) / Math.max(0.01, y1 - y0);
      const w4 = v * 4;
      // A distant tree still needs to move — a static tree in a field of swaying ones is the thing
      // the eye locks onto. Amplitude is tiny because at 120 m 0.35 m is a third of a pixel.
      wind[w4] = t; wind[w4 + 1] = pi * 0.41; wind[w4 + 2] = 0.35; wind[w4 + 3] = Math.max(0.4, height * t);
      thick[v] = 0.8;
      v++;
    }
    idx[ii++] = first; idx[ii++] = first + 1; idx[ii++] = first + 2;
    idx[ii++] = first; idx[ii++] = first + 2; idx[ii++] = first + 3;
  }

  /* ── THE BOLE ────────────────────────────────────────────────────────────────────────────────
     Same geometry, therefore the same InstancedMesh and the same draw call. Publishing it as a
     separate `trunk` on `lodTiers[2]` would have been the tidier-looking answer and it costs a
     SECOND instanced draw per prototype per streamer leaf at the one tier whose entire purpose is
     to be free — and `scenes/sandbox.js` spent 987 of its first render's 1,112 draw calls on props.
     So the bole rides the leaf material and buys its bark colour the way V7 says colour is bought
     here: a vertex-colour MODULATOR of what the atlas already painted, computed by `tree()` as
     `tintRatio(barkBase × species barkTint, atlas.coreLinear)`.

     THE CYLINDER TRANSFER, which is V3's law with the axis in place of the centroid: radial off
     the bole AXIS, blended by the same 0.20 toward the face normal. The four corner columns then
     sit at azimuths 0/90/180/270 pulled 14° toward their own face, so a bole always has a lit limb
     — measured worst case over all sun azimuths at 13° elevation: mean 0.2150, brightest 0.8600.
     The centre of each quad is where the two radials cancel and the blend term alone survives, so
     it resolves to the face normal — which is the correct answer for the middle of a cylinder and
     the reason the 0.20 is not optional. */
  if (bolePlanes) {
    const yTop = height * 0.34;         // 0.14·h of OVERLAP with the crown card, never a butt joint
    const wBase = bole.radius * (1 + bole.flare * 0.45);
    const wTop = bole.radius * 0.80;
    const bu0 = bole.uv[0], bv0 = bole.uv[1], bu1 = bole.uv[2], bv1 = bole.uv[3];
    for (let pi = 0; pi < bolePlanes; pi++) {
      const a = (pi / bolePlanes) * PI;
      const dx = Math.cos(a), dz = Math.sin(a);
      const fx = -Math.sin(a), fz = Math.cos(a);
      const first = v;
      const corners = [
        [-wBase * dx, 0, -wBase * dz, bu0, bv0, -1],
        [wBase * dx, 0, wBase * dz, bu1, bv0, 1],
        [wTop * dx, yTop, wTop * dz, bu1, bv1, 1],
        [-wTop * dx, yTop, -wTop * dz, bu0, bv1, -1],
      ];
      for (let q = 0; q < 4; q++) {
        const c = corners[q];
        const v3 = v * 3;
        pos[v3] = c[0]; pos[v3 + 1] = c[1]; pos[v3 + 2] = c[2];
        const sx = lerp(dx * c[5], fx, kCard);
        const sz = lerp(dz * c[5], fz, kCard);
        const inv = 1 / Math.max(1e-6, Math.hypot(sx, sz));
        nrm[v3] = sx * inv; nrm[v3 + 1] = 0; nrm[v3 + 2] = sz * inv;
        uv[v * 2] = c[3]; uv[v * 2 + 1] = c[4];
        col[v3] = bole.tint[0]; col[v3 + 1] = bole.tint[1]; col[v3 + 2] = bole.tint[2];
        const w4 = v * 4;
        /* aWind.x = 0 -> bend = amplitude · t³ = 0. The bole does not sway, and that is not
           laziness: the crown card's own bend is also 0 at its bottom edge (its t is 0 there), so
           a static bole and a swaying crown share a JOINT THAT NEVER OPENS. aWind.w is the bend
           arm and must stay positive — the shader reads `max(aWind.w, 0.02)`. */
        wind[w4] = 0; wind[w4 + 1] = pi * 0.41; wind[w4 + 2] = 0; wind[w4 + 3] = Math.max(0.4, yTop);
        // Wood does not transmit. Thickness 0 zeroes BOTH halves of the foliage transmission term
        // (the wrapped-diffuse sun lobe and the V8b sky-through-the-leaf term), so the bole is lit
        // by the standard PBR path alone and does not glow when the sun is behind the tree.
        thick[v] = 0;
        v++;
      }
      idx[ii++] = first; idx[ii++] = first + 1; idx[ii++] = first + 2;
      idx[ii++] = first; idx[ii++] = first + 2; idx[ii++] = first + 3;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aWind', new THREE.BufferAttribute(wind, 4));
  geo.setAttribute('aVegThick', new THREE.BufferAttribute(thick, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.name = 'veg.billboard';
  geo.userData.aaa = { tris: quads * 2, crownTris: crownPlanes * 2, boleTris: bolePlanes * 2 };
  return geo;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §E — PROCEDURAL TEXTURES (D7)
//
// ⚠️ DEVIATION, DELIBERATE, DOCUMENTED. D7 says textures are GPU-synthesised into render targets
// by mat/texgen.js. These three are baked on the CPU instead, and the reason is V5: the leaf atlas
// must be DILATED into its alpha = 0 region and then mipped with Castano alpha-COVERAGE
// PRESERVATION. Neither is expressible through `generateMipmaps` on an RT — the GPU's mip
// generator gives a plain box filter over the un-dilated base, which is precisely the bug. The
// bake is lazy (a scene with no vegetation never pays it) and costs ~1.4 M texels of scalar work,
// measured in the tens of milliseconds, once, at boot.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** A tile-local float canvas: A = coverage, H = height (→ normal), C = LINEAR rgb. */
function makeTile(size) {
  return { size, A: new Float32Array(size * size), H: new Float32Array(size * size), C: new Float32Array(size * size * 3) };
}

/**
 * Rasterise one leaf/needle/blade into a tile, src-over.
 *
 * The half-width profile is the whole identity of a species, so it is a first-class parameter:
 *   ovate       hw = W·sin(πu)^0.62·(1.10 − 0.25u)   — the generic broadleaf
 *   lobed       ovate × (1 + 0.26·sin(7πu − 0.6))    — oak/maple; the lobes ARE the read
 *   serrate     ovate × (1 + 0.05·sin(30πu))         — birch; a fine tooth the mip eats gracefully
 *   lanceolate  W·sin(πu)^0.45·(1.20 − 0.50u)        — willow: long, narrow, weighted to the base
 *   needle      W·(1 − 0.55u)                        — conifer
 *   blade       W·(1 − u)^0.75                       — grass, for the LOD1 card
 */
function paintLeaf(tile, cfg) {
  const S = tile.size;
  const { cx, cy, len, wid, ang, shape, curve } = cfg;
  const ca = Math.cos(-ang), sa = Math.sin(-ang);

  // Conservative pixel bounds: the leaf never leaves a disc of radius len + wid around its origin.
  const rad = Math.ceil(len + wid + 2);
  const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(S - 1, Math.ceil(cx + rad));
  const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(S - 1, Math.ceil(cy + rad));

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      const a = dx * ca - dy * sa;                 // along the leaf, 0 → len
      let b = dx * sa + dy * ca;                   // across the leaf
      const u = a / len;
      if (u < 0 || u > 1) continue;
      // Spine curve: the midrib arcs, so a cluster of identically-shaped leaves still reads as
      // organic. Straight midribs are the "generated" tell in every procedural foliage atlas.
      b -= curve * len * u * u;

      let hw;
      if (shape === 'needle') hw = wid * (1 - 0.55 * u);
      else if (shape === 'blade') hw = wid * Math.pow(1 - u, 0.75) + 0.35;
      else if (shape === 'lanceolate') hw = wid * Math.pow(Math.sin(PI * u), 0.45) * (1.20 - 0.50 * u);
      else {
        hw = wid * Math.pow(Math.sin(PI * u), 0.62) * (1.10 - 0.25 * u);
        if (shape === 'lobed') hw *= 1 + 0.26 * Math.sin(u * PI * 7 - 0.6);
        else if (shape === 'serrate') hw *= 1 + 0.05 * Math.sin(u * PI * 30);
      }
      hw = Math.max(0.35, hw);

      const ab = Math.abs(b);
      if (ab > hw + 1.4) continue;
      // 1.2 px of soft edge. Not for anti-aliasing — alphaTest hard-cuts it — but so the COVERAGE
      // rescale in the mip chain has a gradient to work on. A binary alpha mask cannot be
      // coverage-corrected: every mip is either 0 or 1 and the search has no purchase.
      const cov = saturate((hw - ab) / 1.2 + 0.5);
      if (cov <= 0.004) continue;

      const r = ab / hw;

      // ── height field: cross-sectional cupping + the midrib ridge + secondary veins ─────────
      const cup = (1 - r * r) * cfg.cup;
      const rib = Math.exp(-(r * r) * 26) * cfg.rib;
      // Veins leave the midrib at ~55°, so the phase mixes a and |b|. The abs() is what makes them
      // mirror across the midrib instead of running as a diagonal corduroy.
      const veinP = a * cfg.veinFreq - ab * cfg.veinFreq * 0.55;
      const vein = shape === 'needle' || shape === 'blade' ? 0
        : Math.max(0, Math.sin(veinP)) * 0.28 * (1 - r * 0.4);
      const mottle = valueNoise2(px * 0.09, py * 0.09, cfg.seed) - 0.5;
      const h = cup + rib + vein * 0.5 + mottle * 0.10;

      // ── albedo ────────────────────────────────────────────────────────────────────────────
      // Chlorophyll is NOT uniform: mottle at two scales, a lighter midrib and veins, a darker
      // base (where the leaf is in its own shadow) and a warmer margin (sun damage + thinner
      // lamina). Flat green is the single loudest "procedural" signal a leaf can send.
      const mot2 = valueNoise2(px * 0.035, py * 0.035, cfg.seed ^ 0x5bd1) - 0.5;
      let lr = cfg.tint[0], lg = cfg.tint[1], lb = cfg.tint[2];
      const value = 1 + mottle * 0.30 + mot2 * 0.34;
      lr *= value; lg *= value; lb *= value;
      const veinLift = 1 + (vein + rib * 1.4) * 0.55;
      lr *= veinLift; lg *= veinLift; lb *= veinLift;
      // Margin warmth: mix toward the autumn tone at the very edge and the very tip.
      const margin = saturate((r - 0.72) / 0.28) * 0.34 + saturate((u - 0.86) / 0.14) * 0.22;
      lr = lerp(lr, TINT.leafAutumn[0], margin * cfg.marginWarm);
      lg = lerp(lg, TINT.leafAutumn[1], margin * cfg.marginWarm);
      lb = lerp(lb, TINT.leafAutumn[2], margin * cfg.marginWarm);
      // Base shading — the sprig's own occlusion where the leaves crowd the stem.
      const baseDark = lerp(0.62, 1.0, saturate(u / 0.22));
      lr *= baseDark; lg *= baseDark; lb *= baseDark;

      // src-over into the tile
      const i = py * S + px;
      const inv = 1 - cov;
      const i3 = i * 3;
      tile.C[i3] = tile.C[i3] * inv + lr * cov;
      tile.C[i3 + 1] = tile.C[i3 + 1] * inv + lg * cov;
      tile.C[i3 + 2] = tile.C[i3 + 2] * inv + lb * cov;
      tile.H[i] = tile.H[i] * inv + h * cov;
      tile.A[i] = tile.A[i] + cov * (1 - tile.A[i]);
    }
  }
}

/** Per-species sprig recipes. A "card" is a whole SPRIG (V4), so each tile is a small composition. */
// COVERAGE IS THE TUNING TARGET, not leaf count. A card whose tile is only ~10% opaque forces the
// canopy to buy its mass in extra CARDS — 3× the geometry and 3× the alpha-test overdraw for the
// same silhouette — and reads thin and wiry besides. These recipes are tuned against MEASURED tile
// coverage at alphaTest 0.42: sprigs land at 0.22–0.32 (pine needles are genuinely the sparsest at
// 0.22, maple the densest at 0.32) and the canopy blob — a whole distant crown — at 0.64.
// `selfTest` asserts the 0.20 floor, so a recipe edit that thins a species is caught, not admired.
const SPRIG = {
  oak: { shape: 'lobed', leaves: 15, len: [76, 116], wid: [30, 44], cup: 0.55, rib: 0.42, veinFreq: 0.16, marginWarm: 0.7, spread: 0.55, curve: 0.10 },
  maple: { shape: 'lobed', leaves: 13, len: [84, 124], wid: [38, 54], cup: 0.40, rib: 0.38, veinFreq: 0.13, marginWarm: 0.8, spread: 0.62, curve: 0.06 },
  birch: { shape: 'serrate', leaves: 28, len: [62, 92], wid: [28, 40], cup: 0.48, rib: 0.40, veinFreq: 0.22, marginWarm: 0.5, spread: 0.58, curve: 0.12 },
  poplar: { shape: 'ovate', leaves: 26, len: [64, 96], wid: [34, 50], cup: 0.52, rib: 0.44, veinFreq: 0.20, marginWarm: 0.6, spread: 0.55, curve: 0.14 },
  willow: { shape: 'lanceolate', leaves: 42, len: [96, 146], wid: [17, 25], cup: 0.62, rib: 0.50, veinFreq: 0.26, marginWarm: 0.4, spread: 0.34, curve: 0.20 },
  pine: { shape: 'needle', leaves: 96, len: [88, 138], wid: [5.4, 8.2], cup: 0.75, rib: 0.20, veinFreq: 0, marginWarm: 0.25, spread: 0.40, curve: 0.06 },
  shrub: { shape: 'ovate', leaves: 34, len: [52, 78], wid: [30, 44], cup: 0.50, rib: 0.40, veinFreq: 0.24, marginWarm: 0.55, spread: 0.70, curve: 0.10 },
  /* E-BIOME 2026-09-05. These three do NOT add atlas tiles — the bake `plan` is a fixed list and
     the new species sample the tiles the shipped ones already painted (see their `leafTiles`).
     What a SPRIG row buys them is `shape`, which is read in exactly two places: the billboard
     taper (a needle species gets a CONICAL far silhouette, `NEEDLE_BILLBOARD_TAPER`) and the
     selfTest's cone-normal reference. Without a row here a spruce would carry a broadleaf
     billboard, which is the whole silhouette at the distance most of them are drawn at. */
  spruce: { shape: 'needle', leaves: 104, len: [70, 108], wid: [4.6, 7.0], cup: 0.80, rib: 0.18, veinFreq: 0, marginWarm: 0.18, spread: 0.34, curve: 0.05 },
  juniper: { shape: 'needle', leaves: 88, len: [58, 88], wid: [5.0, 7.6], cup: 0.70, rib: 0.22, veinFreq: 0, marginWarm: 0.32, spread: 0.52, curve: 0.09 },
  cottonwood: { shape: 'ovate', leaves: 24, len: [70, 104], wid: [40, 58], cup: 0.46, rib: 0.42, veinFreq: 0.18, marginWarm: 0.62, spread: 0.60, curve: 0.10 },
};

/** Paint one sprig tile: leaves arranged along a curved rachis, back-to-front. */
function paintSprigTile(tile, recipe, tint, seed) {
  const rng = mulberry32(seed);
  const S = tile.size;
  const pad = ATLAS.padPx;
  // The rachis runs bottom-centre (the stem, uv v = 0) to the top, arced slightly.
  const x0 = S * 0.5 + (rng() - 0.5) * S * 0.05;
  const y0 = S - pad - 4;
  const y1 = pad + 6;
  const arc = (rng() - 0.5) * S * 0.18;

  const n = recipe.leaves;
  for (let i = 0; i < n; i++) {
    // Alternate phyllotaxis with a golden-angle-derived side flip, then a decreasing length up the
    // rachis — a sprig whose leaves are all the same size is the giveaway.
    const t = (i + 0.5) / n;
    const side = (i % 2 === 0 ? 1 : -1) * lerp(0.55, 1.0, rng());
    const rx = x0 + arc * Math.sin(t * PI);
    const ry = lerp(y0, y1, t);
    const shrink = lerp(1.0, 0.55, t * t);
    const len = lerp(recipe.len[0], recipe.len[1], rng()) * shrink;
    const wid = lerp(recipe.wid[0], recipe.wid[1], rng()) * shrink;
    // Leaves leave the rachis at 40–75° and tip upward toward the light.
    const spreadA = lerp(0.42, 0.78, rng()) * recipe.spread;
    const ang = -PI * 0.5 + side * spreadA * PI * 0.5 + (rng() - 0.5) * 0.20;
    paintLeaf(tile, {
      cx: rx, cy: ry, len, wid: wid * 0.5, ang,
      shape: recipe.shape, curve: recipe.curve * (side > 0 ? 1 : -1),
      cup: recipe.cup, rib: recipe.rib, veinFreq: recipe.veinFreq,
      marginWarm: recipe.marginWarm,
      tint: [tint[0] * lerp(0.86, 1.14, rng()), tint[1] * lerp(0.86, 1.14, rng()), tint[2] * lerp(0.86, 1.14, rng())],
      seed: (seed + i * 977) | 0,
    });
  }
  // The stem itself — a sprig with no visible petiole floats.
  paintLeaf(tile, {
    cx: x0, cy: (y0 + y1) * 0.5, len: (y0 - y1), wid: 1.9, ang: -PI * 0.5,
    shape: 'blade', curve: -arc / Math.max(1, y0 - y1) * 0.9,
    cup: 0.9, rib: 0.6, veinFreq: 0, marginWarm: 0.2,
    tint: [tint[0] * 1.25, tint[1] * 1.05, tint[2] * 0.72], seed: seed ^ 0x9e37,
  });
}

/** The LOD1 grass card: six painted blades, fanned, with the tallest in the middle. */
function paintGrassCardTile(tile, seed) {
  const rng = mulberry32(seed);
  const S = tile.size;
  const pad = ATLAS.padPx;
  // Nine blades, not six: at the 25–60 m band the card replaces six LOD0 CLUMPS (18 blades), and a
  // six-blade card visibly thins the field exactly where the LOD1 ring begins.
  for (let i = 0; i < 9; i++) {
    const cxp = pad + 12 + (S - 2 * pad - 24) * ((i + 0.5) / 9 + (rng() - 0.5) * 0.05);
    const h = (S - 2 * pad) * lerp(0.55, 0.98, 1 - Math.abs(i - 4) / 4.8) * lerp(0.9, 1.1, rng());
    const lean = (rng() - 0.5) * 0.55;
    const dry = rng() * 0.55;
    paintLeaf(tile, {
      cx: cxp, cy: S - pad, len: h, wid: 9.0 * lerp(0.8, 1.25, rng()),
      ang: -PI * 0.5 + lean, shape: 'blade', curve: lean * 0.9,
      cup: 0.85, rib: 0.35, veinFreq: 0, marginWarm: 0.35,
      tint: [
        lerp(TINT.grassGreen[0], TINT.grassDry[0], dry) * 1.6,
        lerp(TINT.grassGreen[1], TINT.grassDry[1], dry) * 1.6,
        lerp(TINT.grassGreen[2], TINT.grassDry[2], dry) * 1.6,
      ],
      seed: (seed + i * 613) | 0,
    });
  }
}

/** The LOD2 canopy blob: a dense disc of small leaves, so a 120 m tree keeps a foliage EDGE
 *  (ragged, alpha-tested) rather than the smooth ellipse that reads as a lollipop. */
function paintCanopyBlobTile(tile, tint, seed) {
  const rng = mulberry32(seed);
  const S = tile.size;
  const pad = ATLAS.padPx;
  const R = (S - 2 * pad) * 0.5;
  const cx = S * 0.5, cy = S * 0.5;
  for (let i = 0; i < 420; i++) {
    // sqrt() for a uniform disc, then biased outward slightly so the rim stays dense and the
    // silhouette stays busy.
    const rr = R * Math.pow(rng(), 0.42);
    const a = rng() * TAU;
    // Vertical squash: a crown is wider than it is tall.
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr * 0.86;
    const shade = lerp(0.45, 1.15, saturate(rr / R) * 0.6 + (1 - saturate(py / S)) * 0.55);
    paintLeaf(tile, {
      cx: px, cy: py, len: lerp(22, 40, rng()), wid: lerp(11, 19, rng()) * 0.5,
      ang: rng() * TAU, shape: 'ovate', curve: 0.1,
      cup: 0.5, rib: 0.35, veinFreq: 0.3, marginWarm: 0.5,
      tint: [tint[0] * shade, tint[1] * shade, tint[2] * shade],
      seed: (seed + i * 251) | 0,
    });
  }
}

/**
 * V5 — DILATE the RGB 8 px into the alpha = 0 region.
 *
 * Frontier flood rather than N full-image passes: only texels adjacent to already-valid ones do
 * any work, so 1 M texels cost ~120 k operations instead of 8 M. Alpha is NOT touched — only the
 * colour that the mip filter will later average.
 *
 * WHY IT MATTERS (the classic foliage bug): mip 0 never samples the empty region, because
 * alphaTest discards it. Mip 3 does — a 2×2 box at mip 2 straddles the leaf edge, averages the
 * (black, alpha 0) outside texels into the (green, alpha 1) inside ones, and every card at 20 m+
 * gets a dark rim. Dilating first makes the outside texels the same green as the edge, so the
 * average is correct at every level.
 */
function dilateRGB(rgb, alpha, w, h, passes) {
  const valid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) valid[i] = alpha[i] > 0.004 ? 1 : 0;

  let frontier = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (valid[i]) continue;
      if ((x > 0 && valid[i - 1]) || (x < w - 1 && valid[i + 1])
        || (y > 0 && valid[i - w]) || (y < h - 1 && valid[i + w])) frontier.push(i);
    }
  }

  for (let pass = 0; pass < passes && frontier.length; pass++) {
    const next = [];
    const filled = frontier;
    for (let f = 0; f < filled.length; f++) {
      const i = filled[f];
      const x = i % w, y = (i / w) | 0;
      let r = 0, g2 = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || (dx === 0 && dy === 0)) continue;
          const j = yy * w + xx;
          if (!valid[j]) continue;
          const j3 = j * 3;
          r += rgb[j3]; g2 += rgb[j3 + 1]; b += rgb[j3 + 2]; n++;
        }
      }
      if (n) { const i3 = i * 3; rgb[i3] = r / n; rgb[i3 + 1] = g2 / n; rgb[i3 + 2] = b / n; }
    }
    // Promote the frontier only AFTER the whole pass, so the flood advances one ring at a time
    // instead of smearing one texel's colour across the whole margin in scan order.
    for (let f = 0; f < filled.length; f++) valid[filled[f]] = 1;
    for (let f = 0; f < filled.length; f++) {
      const i = filled[f];
      const x = i % w, y = (i / w) | 0;
      for (let d = 0; d < 4; d++) {
        const xx = x + (d === 0 ? -1 : d === 1 ? 1 : 0);
        const yy = y + (d === 2 ? -1 : d === 3 ? 1 : 0);
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        const j = yy * w + xx;
        if (!valid[j]) { valid[j] = 2; next.push(j); }
      }
    }
    for (let f = 0; f < next.length; f++) valid[next[f]] = 0;   // un-mark; they fill next pass
    frontier = next;
  }
}

/**
 * Alpha-coverage-preserving mip chain (Castano, "Computing Alpha Mipmaps", 2010).
 *
 * A plain box mip of an alpha mask LOWERS the fraction of texels above `alphaTest` at every level,
 * because averaging pulls edge texels down. Measured on this atlas: coverage falls from 1.00 to
 * ~0.63 by mip 4. Visually that is a canopy that thins and finally evaporates as you back away —
 * and it is usually misdiagnosed as an LOD bug. The fix is to bisect for a per-level alpha SCALE
 * that restores mip 0's coverage.
 */
function buildCoverageMips(baseRGBA, w0, h0, ref) {
  const levels = [];
  const coverageOf = (data, n, scale) => {
    let c = 0;
    for (let i = 0; i < n; i++) if (Math.min(1, (data[i * 4 + 3] / 255) * scale) >= ref) c++;
    return c / n;
  };

  let src = baseRGBA;
  let w = w0, h = h0;
  levels.push({ data: src, width: w, height: h });
  const target = coverageOf(src, w * h, 1);

  while (w > 1 || h > 1) {
    const nw = Math.max(1, w >> 1);
    const nh = Math.max(1, h >> 1);
    const dst = new Uint8Array(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const sx = Math.min(w - 1, x * 2), sy = Math.min(h - 1, y * 2);
        const sx1 = Math.min(w - 1, sx + 1), sy1 = Math.min(h - 1, sy + 1);
        const a = (sy * w + sx) * 4, b = (sy * w + sx1) * 4;
        const c = (sy1 * w + sx) * 4, d = (sy1 * w + sx1) * 4;
        const o = (y * nw + x) * 4;
        // Plain box on RGB — correct precisely BECAUSE the base was dilated (V5); a coverage- or
        // alpha-weighted average here would be the "right" answer for an un-dilated atlas and the
        // wrong one for this atlas, double-counting the edge.
        for (let ch = 0; ch < 4; ch++) {
          dst[o + ch] = (src[a + ch] + src[b + ch] + src[c + ch] + src[d + ch] + 2) >> 2;
        }
      }
    }
    // Bisect the alpha scale. 12 iterations resolve to 1/4096 of the [0.05, 12] range, which is
    // far below the 1/255 quantisation the result is written into.
    let lo = 0.05, hi = 12.0;
    for (let it = 0; it < 12; it++) {
      const mid = (lo + hi) * 0.5;
      if (coverageOf(dst, nw * nh, mid) < target) lo = mid; else hi = mid;
    }
    const scale = (lo + hi) * 0.5;
    if (Math.abs(scale - 1) > 0.004) {
      for (let i = 0; i < nw * nh; i++) {
        dst[i * 4 + 3] = clamp(Math.round(dst[i * 4 + 3] * scale), 0, 255);
      }
    }
    levels.push({ data: dst, width: nw, height: nh });
    src = dst; w = nw; h = nh;
  }
  return levels;
}

/** ⭐ THE SOLID CORE OF A TILE — the sub-rect the LOD2 BOLE samples, found by MEASUREMENT.
 *
 * The LOD2 billboard's bole (see `buildTreeBillboard`) rides in the SAME geometry as the crown
 * card, so it is drawn by `veg.leaf` and can only sample the LEAF ATLAS. Every tile in that atlas
 * is an alpha-CUT sprig or blob — `TILE.canopyBlob` measures 0.650 coverage above `alphaTest` on
 * the shipped seed — so a bole quad handed the whole tile comes out with 35 % of itself DISCARDED.
 * At the LOD2 switch distance a 12.2 m oak's bole is 4.2 px wide; a third of that stippled away is
 * a dashed line, not a trunk.
 *
 * So the bole asks the atlas where its OPAQUE CORE is instead of hard-coding a rect. That is not
 * fastidiousness: `bakeLeafAtlas(worldSeed ^ 0x1eaf)` paints a DIFFERENT blob for every world, so
 * a rect verified against one seed is unverified for every other one (measured over five seeds the
 * best core moves from (80,144) to (164,176) and its half-size from 14 px to 24 px).
 *
 * THE TWO BOUNDS, both derived rather than picked:
 *   • `alphaMin` 0.62 — 1.48x the 0.42 `alphaTest`. Bilinear + trilinear taps average the rect
 *     against its neighbours, so the rect additionally carries a ONE-TEXEL GUARD BAND at every
 *     level and every texel under that band must clear the same bar. A tap that lands half on the
 *     core and half on a texel sitting exactly ON alphaTest still resolves to 0.52 > 0.42.
 *   • `minTileTexels` 8 — the deepest level considered. Below 8 texels per tile the one-texel
 *     guard band cannot fit inside the tile's own transparent pad margin (`ATLAS.padPx`), which is
 *     why 4 returns NO rect on every seed tested. It costs nothing: a tile sampled at 8 texels is
 *     a card ~8 px on screen, where the bole is a fifth of a pixel wide.
 *
 * Returns tile-LOCAL normalised coords plus `deepestLevel`, so `selfTest` can assert the chain the
 * search actually certified rather than trusting that it ran.
 */
function solidCoreOf(mips, tileIndex, alphaMin, minTileTexels) {
  const cols = ATLAS.cols;
  const tileX = tileIndex % cols;
  const tileY = Math.floor(tileIndex / cols);
  const thr = Math.round(clamp(alphaMin, 0, 1) * 255);

  const levels = [];
  for (let L = 0; L < mips.length; L++) {
    const t = mips[L].width / cols;
    if (t < minTileTexels || t !== Math.floor(t)) break;
    levels.push(t);
  }
  if (!levels.length) return null;

  // Summed-area table of the "opaque enough" mask, per level, over THIS tile only. A rect is fully
  // opaque iff its sum equals its area — one O(1) test per level per candidate.
  const sums = [];
  for (let li = 0; li < levels.length; li++) {
    const t = levels[li];
    const mip = mips[li];
    const w = mip.width;
    const ox = tileX * t, oy = tileY * t;
    const W = t + 1;
    const S = new Int32Array(W * W);
    for (let y = 0; y < t; y++) {
      for (let x = 0; x < t; x++) {
        const a = mip.data[((oy + y) * w + ox + x) * 4 + 3];
        S[(y + 1) * W + x + 1] = (a >= thr ? 1 : 0)
          + S[y * W + x + 1] + S[(y + 1) * W + x] - S[y * W + x];
      }
    }
    sums.push(S);
  }

  const solidAt = (li, u0, v0, u1, v1) => {
    const t = levels[li];
    const S = sums[li];
    const W = t + 1;
    const x0 = Math.max(0, Math.floor(u0 * t) - 1), x1 = Math.min(t, Math.ceil(u1 * t) + 1);
    const y0 = Math.max(0, Math.floor(v0 * t) - 1), y1 = Math.min(t, Math.ceil(v1 * t) + 1);
    const area = (x1 - x0) * (y1 - y0);
    if (area <= 0) return false;
    return (S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0]) === area;
  };

  /* Largest first, so the first hit is the answer and the search is O(1) in the common case.
     Half-size steps by ONE base texel (a coarser size lattice quietly reports a smaller core than
     exists: an 8-texel lattice returned half = 8 where a 1-texel lattice returns 14), centres on a
     1/64 tile grid. Ceiling at T/8 because the bole is 2-8 px wide on screen and a core larger
     than a 64-texel square buys nothing but boot time. MEASURED cost of this whole function,
     summed-area tables included: 0.9-6.2 ms against the 409-504 ms bake it rides on, i.e. ~1 %. */
  const T = ATLAS.tile;
  const GRID = 64;
  for (let hpx = T >> 3; hpx >= 1; hpx--) {
    const h = hpx / T;
    for (let cy = 0; cy <= GRID; cy++) {
      for (let cx = 0; cx <= GRID; cx++) {
        const u = cx / GRID, v = cy / GRID;
        const u0 = u - h, u1 = u + h, v0 = v - h, v1 = v + h;
        if (u0 < 0 || v0 < 0 || u1 > 1 || v1 > 1) continue;
        let deepest = -1;
        let ok = true;
        for (let li = 0; li < levels.length; li++) {
          if (!solidAt(li, u0, v0, u1, v1)) { ok = false; break; }
          deepest = li;
        }
        if (ok) return { u0, v0, u1, v1, half: h, deepestLevel: deepest, levels: levels.length };
      }
    }
  }
  return null;
}

/** Sobel a height field into a PACKED RG normal map (r185 reconstructs Z — `USE_PACKED_NORMALMAP`,
 *  three.module.js:7602, gated on `isPackedRGFormat`). Two channels instead of three is a third of
 *  the bandwidth for a mathematically identical unit normal. */
function heightToPackedRG(H, w, h, strength) {
  const out = new Uint8Array(w * h * 2);
  for (let y = 0; y < h; y++) {
    const ym = y > 0 ? y - 1 : y, yp = y < h - 1 ? y + 1 : y;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : x, xp = x < w - 1 ? x + 1 : x;
      const dX = (H[y * w + xp] - H[y * w + xm]) * strength;
      const dY = (H[yp * w + x] - H[ym * w + x]) * strength;
      // n = normalize(-dX, -dY, 1); v flips because texture v runs down while tangent-space Y
      // runs up (OpenGL convention, which is what three's normal chunk expects).
      const inv = 1 / Math.sqrt(dX * dX + dY * dY + 1);
      out[(y * w + x) * 2] = toByte((-dX * inv) * 0.5 + 0.5);
      out[(y * w + x) * 2 + 1] = toByte((dY * inv) * 0.5 + 0.5);
    }
  }
  return out;
}

/**
 * Bake the whole 1024² leaf atlas: 14 sprig tiles + the grass card + the canopy blob, dilated,
 * mipped with coverage preservation, plus a half-res packed-RG normal map.
 */
function bakeLeafAtlas(seed, anisotropy) {
  const S = ATLAS.size;
  const T = ATLAS.tile;
  const rgbaF = new Float32Array(S * S * 3);
  const alphaF = new Float32Array(S * S);
  const heightF = new Float32Array(S * S);

  const plan = [
    [TILE.oakA, 'oak', TINT.leafSummer], [TILE.oakB, 'oak', TINT.leafDeep],
    [TILE.mapleA, 'maple', TINT.leafSummer], [TILE.mapleB, 'maple', TINT.leafPale],
    [TILE.birchA, 'birch', TINT.leafPale], [TILE.birchB, 'birch', TINT.leafSummer],
    [TILE.poplarA, 'poplar', TINT.leafSummer], [TILE.poplarB, 'poplar', TINT.leafDeep],
    [TILE.willowA, 'willow', TINT.leafPale], [TILE.willowB, 'willow', TINT.leafSummer],
    [TILE.pineA, 'pine', TINT.needle], [TILE.pineB, 'pine', TINT.leafDeep],
    [TILE.shrubA, 'shrub', TINT.leafDeep], [TILE.shrubB, 'shrub', TINT.leafSummer],
  ];

  const tile = makeTile(T);
  /* ⛔ THE ONE CANVAS→GL SEAM (2026-08-09, owner: "the grass is placed upside down"). The painters
   * author in CANVAS space — y grows DOWNWARD, roots at `cy = S − pad` — and every consumer states
   * the same contract in its own words ("uv v = 0 is the sprig STEM end", grassCard's ground
   * corners at v0). But a DataTexture uploads row 0 at GL v=0, so an unflipped blit put the
   * canvas TOP (blade/sprig TIPS) at v=0: grass cards and shrub sprigs hung upside down, and tree
   * leaf cards wore their stems in mid-air (the "bare poles" read). The flip lives HERE, per tile,
   * so tile coordinates stay put and the height→normal derivation downstream inherits it. Radial
   * tiles (canopy blob) are orientation-blind either way. */
  const blitTile = (index) => {
    const tx = (index % ATLAS.cols) * T;
    const ty = Math.floor(index / ATLAS.cols) * T;
    for (let y = 0; y < T; y++) {
      const dstRow = (ty + y) * S + tx;
      for (let x = 0; x < T; x++) {
        const s = (T - 1 - y) * T + x;
        const d = dstRow + x;
        alphaF[d] = tile.A[s];
        heightF[d] = tile.H[s];
        rgbaF[d * 3] = tile.C[s * 3];
        rgbaF[d * 3 + 1] = tile.C[s * 3 + 1];
        rgbaF[d * 3 + 2] = tile.C[s * 3 + 2];
      }
    }
    tile.A.fill(0); tile.H.fill(0); tile.C.fill(0);
  };

  for (let i = 0; i < plan.length; i++) {
    paintSprigTile(tile, SPRIG[plan[i][1]], plan[i][2], (seed + i * 7919) | 0);
    blitTile(plan[i][0]);
  }
  paintGrassCardTile(tile, (seed ^ 0x6ea5) | 0);
  blitTile(TILE.grassCard);
  paintCanopyBlobTile(tile, TINT.leafSummer, (seed ^ 0x13b7) | 0);
  blitTile(TILE.canopyBlob);

  // V5 — dilate BEFORE anything is quantised or mipped.
  dilateRGB(rgbaF, alphaF, S, S, ATLAS.dilatePx);

  const base = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    base[i * 4] = toByte(linearToSRGB(saturate(rgbaF[i * 3])));
    base[i * 4 + 1] = toByte(linearToSRGB(saturate(rgbaF[i * 3 + 1])));
    base[i * 4 + 2] = toByte(linearToSRGB(saturate(rgbaF[i * 3 + 2])));
    base[i * 4 + 3] = toByte(saturate(alphaF[i]));
  }

  const mips = buildCoverageMips(base, S, S, ATLAS.coverageRef);
  const map = new THREE.DataTexture(mips[0].data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  map.mipmaps = mips;
  map.generateMipmaps = false;          // the chain is ours; letting the GPU regenerate undoes V5
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.anisotropy = anisotropy;
  map.name = 'veg.leafAtlas';
  map.needsUpdate = true;

  // Normal map at half res: a leaf's normal detail is midrib + cupping, both low-frequency, and
  // 512² halves the bandwidth on the single most-sampled texture in an outdoor frame.
  const NS = S >> 1;
  const halfH = new Float32Array(NS * NS);
  for (let y = 0; y < NS; y++) {
    for (let x = 0; x < NS; x++) {
      const s = (y * 2) * S + x * 2;
      halfH[y * NS + x] = (heightF[s] + heightF[s + 1] + heightF[s + S] + heightF[s + S + 1]) * 0.25;
    }
  }
  const normalMap = new THREE.DataTexture(
    heightToPackedRG(halfH, NS, NS, 2.6), NS, NS, THREE.RGFormat, THREE.UnsignedByteType,
  );
  normalMap.colorSpace = THREE.NoColorSpace;      // data, never colour
  normalMap.wrapS = THREE.ClampToEdgeWrapping;
  normalMap.wrapT = THREE.ClampToEdgeWrapping;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.magFilter = THREE.LinearFilter;
  normalMap.generateMipmaps = true;               // a normal map has no coverage to preserve
  normalMap.anisotropy = anisotropy;
  normalMap.name = 'veg.leafNormal';
  normalMap.needsUpdate = true;

  let bytes = 0;
  for (let i = 0; i < mips.length; i++) bytes += mips[i].data.length;
  bytes += NS * NS * 2 * 1.34;                    // +mips
  _counters.atlasBakes++;
  _counters.textureBytes += bytes;

  /* THE BOLE SAMPLER. `buildTreeBillboard` needs one rect of this atlas that is opaque all the way
     down the chain, plus the LINEAR colour that rect actually carries — because V7 (the block above
     `tintRatio`) says the vertex colour is a MODULATOR of what the bake painted, and the bole's
     modulator has to be measured against the CORE's colour, not the tile mean. Getting that
     denominator wrong is the same defect V7 documents, one sampler over. */
  const core = solidCoreOf(mips, TILE.canopyBlob, ATLAS.coreAlphaMin, ATLAS.coreMinTileTexels);
  let coreUV = null;
  let coreLinear = null;
  let coreDeepestLevel = -1;
  if (core) {
    const tileX = TILE.canopyBlob % ATLAS.cols;
    const tileY = Math.floor(TILE.canopyBlob / ATLAS.cols);
    coreUV = [
      (tileX + core.u0) / ATLAS.cols, (tileY + core.v0) / ATLAS.rows,
      (tileX + core.u1) / ATLAS.cols, (tileY + core.v1) / ATLAS.rows,
    ];
    coreDeepestLevel = core.deepestLevel;
    const px0 = tileX * T + Math.round(core.u0 * T), px1 = tileX * T + Math.round(core.u1 * T);
    const py0 = tileY * T + Math.round(core.v0 * T), py1 = tileY * T + Math.round(core.v1 * T);
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = py0; y < py1; y++) {
      for (let x = px0; x < px1; x++) {
        // Read back through the SHIPPED base level, sRGB-decoded exactly the way the shader will,
        // so this is the product the fragment sees and not the float the painter wrote.
        const i = (y * S + x) * 4;
        r += srgbToLinear(mips[0].data[i] / 255);
        g += srgbToLinear(mips[0].data[i + 1] / 255);
        b += srgbToLinear(mips[0].data[i + 2] / 255);
        n++;
      }
    }
    if (n > 0) coreLinear = [r / n, g / n, b / n];
  }

  return {
    map, normalMap, size: S, tile: T, cols: ATLAS.cols, rows: ATLAS.rows, bytes, TILE,
    /** UV rect of the densest fully-opaque sub-tile of `TILE.canopyBlob`, ATLAS-normalised.
     *  `null` means the search found none — the caller then ships a crown with no bole rather
     *  than a stippled one (a clamp that keeps the worst case WORKING, not FAMILIAR). */
    coreUV,
    /** The mean LINEAR rgb of `coreUV` at mip 0 — the V7 denominator for the bole's tint. */
    coreLinear,
    /** Deepest mip index the core was certified solid at. `selfTest` asserts this, not the search. */
    coreDeepestLevel,
  };
}

/**
 * Bark: one EXACTLY TILEABLE 512² set (albedo sRGB, packed-RG normal, ORM RGBA).
 *
 * Tileability is not cosmetic here — §B snaps the trunk's u span to a whole number of tiles so the
 * seam at the back of the bole lands on the texture's own wrap. That only works if the texture
 * genuinely wraps, which mathx's `period` contract guarantees (period in LATTICE CELLS, rotation
 * disabled, per-octave period = round(P·lac^o); residual error 2e-14, i.e. exact at 8 bits).
 *
 * The furrow field is RIDGED noise, anisotropic 6 : 1 (fast around the trunk, slow along it), which
 * is what makes vertical furrows rather than a lichen blotch. Cracks come from a second, finer
 * ridge; plates from a low-frequency threshold that lifts whole islands.
 */
function bakeBark(seed, anisotropy) {
  const S = BARK.size;
  const P = 32;                                    // base period in lattice cells (mathx: keep ≥32)
  const H = new Float32Array(S * S);
  const albedo = new Uint8Array(S * S * 4);
  const orm = new Uint8Array(S * S * 4);

  const opt = { period: P, seed };
  const optFine = { period: P, seed: seed ^ 0x51ed };
  const optPlate = { period: P, seed: seed ^ 0x2b7f };

  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      // Anisotropic sample coords. INTEGER multiples of the period keep the wrap exact.
      const ax = u * P * BARK.freqAround;
      const ay = v * P * BARK.freqAlong;

      // Primary furrows: ridged fBm. ridge = 1 − |2n − 1| turns the smooth field's zero crossings
      // into sharp creases, which is exactly what a furrow is.
      const n1 = fbm2xy(ax, ay, 4, 2.02, 0.5, opt);
      const furrow = 1 - Math.abs(2 * n1 - 1);
      // Fine checking across the furrows — the horizontal cracking that breaks a ridge into plates.
      const n2 = fbm2xy(ax * 1.6, ay * 7.0, 3, 2.02, 0.5, optFine);
      const check = 1 - Math.abs(2 * n2 - 1);
      // Plate lift: a low-frequency mask that raises whole islands of bark, so the surface has a
      // secondary form and not just a uniform corduroy.
      const plate = smoothstep(0.42, 0.72, fbm2xy(ax * 0.34, ay * 0.34, 3, 2.02, 0.5, optPlate));

      let h = Math.pow(furrow, 1.35) * 0.78 + check * 0.20 + plate * 0.30;
      h += (valueNoise2(x * 0.55, y * 0.55, seed ^ 0x77) - 0.5) * 0.07;   // grain
      h = saturate(h);
      H[y * S + x] = h;

      // Albedo tracks height: the ridges are sun-bleached and grey, the furrows are dark and damp.
      // Correlating albedo with height (rather than using an independent noise) is what makes bark
      // read as one material instead of a green-screen of two.
      const tone = lerp(0.55, 1.30, Math.pow(h, 0.85));
      const damp = (1 - h) * 0.35;                 // furrows hold moisture → darker AND cooler
      const r = TINT.barkBase[0] * tone * (1 - damp * 0.55);
      const gch = TINT.barkBase[1] * tone * (1 - damp * 0.40);
      const b = TINT.barkBase[2] * tone * (1 - damp * 0.20);
      const i4 = (y * S + x) * 4;
      albedo[i4] = toByte(linearToSRGB(saturate(r)));
      albedo[i4 + 1] = toByte(linearToSRGB(saturate(gch)));
      albedo[i4 + 2] = toByte(linearToSRGB(saturate(b)));
      albedo[i4 + 3] = 255;

      // ORM (D7): R = baked AO, G = roughness, B = metal, A = height (the patch reads .a for the
      // puddle/parallax band; bark uses it as the height it was derived from).
      // AO from the cavity term: a furrow is a real occluder, and this is the darkening that makes
      // the trunk read as deep rather than printed.
      const ao = lerp(0.42, 1.0, Math.pow(h, 0.65));
      const rough = clamp(BARK.roughness + (1 - h) * 0.08 - plate * 0.04, 0.55, 0.99);
      orm[i4] = toByte(ao);
      orm[i4 + 1] = toByte(rough);
      orm[i4 + 2] = 0;                             // wood is a dielectric — metalness is 0, always
      orm[i4 + 3] = toByte(h);
    }
  }

  const mk = (data, format, srgb, name) => {
    const t = new THREE.DataTexture(data, S, S, format, THREE.UnsignedByteType);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;                // MUST repeat — the UVs are in tiles
    t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = anisotropy;
    t.name = name;
    t.needsUpdate = true;
    return t;
  };

  const normal = mk(heightToPackedRG(H, S, S, 3.4), THREE.RGFormat, false, 'veg.barkNormal');
  const bytes = (S * S * 4 * 2 + S * S * 2) * 1.34;
  _counters.barkBakes++;
  _counters.textureBytes += bytes;

  return {
    albedo: mk(albedo, THREE.RGBAFormat, true, 'veg.barkAlbedo'),
    normal,
    orm: mk(orm, THREE.RGBAFormat, false, 'veg.barkORM'),
    bytes,
  };
}

/**
 * The gust field: a 256² exactly-tileable RG8 fBm, sampled in the VERTEX shader.
 * [RAGE §Foliage] "generate a 256² RG8 FBM texture once at boot in a worker; sample it in the
 * vertex shader (vertex texture fetch is guaranteed in WebGL2)".
 *
 * R = the gust magnitude field (the FRONTS). G = a decorrelated field used for the cross-wind
 * component, so the flutter is not a rigid 90° of the main bend.
 *
 * `minFilter` is LinearFilter with NO mipmaps: a vertex-shader `texture2D` has no derivatives, so
 * a mipped texture would sample an implementation-defined level — in practice the coarsest — and
 * the gust fronts would silently disappear.
 */
function bakeGustNoise(seed) {
  const S = WIND.gustTexSize;
  const P = 32;
  const data = new Uint8Array(S * S * 2);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * P, v = (y / S) * P;
      // 3 octaves, not 5: gust FRONTS are a large-scale feature and the fine octaves only add
      // per-blade noise the 1.9 Hz term already supplies, at the cost of visible tiling.
      const a = fbm2xy(u, v, 3, 2.02, 0.55, { period: P, seed });
      const b = fbm2xy(u, v, 3, 2.02, 0.55, { period: P, seed: seed ^ 0x9e3d });
      const i = (y * S + x) * 2;
      // Contrast-stretch: a raw fBm sits in [0.25, 0.75] and reads as a uniform breeze. Fronts need
      // the field to actually reach both ends of its range.
      data[i] = toByte(saturate((a - 0.5) * 1.9 + 0.5));
      data[i + 1] = toByte(saturate((b - 0.5) * 1.9 + 0.5));
    }
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.name = 'veg.gust';
  tex.needsUpdate = true;
  _counters.textureBytes += S * S * 2;
  return tex;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §F — THE SHADER: two-scale wind (vertex) + foliage shading (fragment)
//
// These strings are EXPORTED so gfx/prepass.js, the shadow depth material and the HLOD baker can
// inject the byte-identical displacement. If the prepass and the forward pass disagree by one
// millimetre the stage-4 EqualDepth test fails and the vegetation disappears — a bug that presents
// as "the trees are invisible on high tier only", because the prepass is a high-tier feature.
//
// Anchors are chosen so this composes with mat/materials.js's AAA_PBR patch in EITHER hook order:
// `#include <common>`, `#include <begin_vertex>`, `#include <lights_fragment_end>` are all
// 'after'-mode there, and `#include <normal_fragment_maps>` (which AAA_PBR REPLACES) is only used
// by the foliage variants, which deliberately do not take the AAA_PBR patch.
// ══════════════════════════════════════════════════════════════════════════════════════════════

const WIND_PARS_VERTEX = `
// -- AAA_VEG -- two-scale wind -------------------------------------------------------------------
attribute vec4 aWind;          // x = t (distance from anchor, 0..1)  y = phase  z = flex  w = arm (m)
uniform vec4 uVegWind;         // xy = wind direction (world XZ, unit)  z = strength  w = simTime
uniform vec4 uVegWindTune;     // x = 1/gustMetres  y = gustSpeed  z = detailHz  w = bendMetres
uniform sampler2D uVegGust;
#ifdef AAA_VEG_TRANSLUCENT
	attribute float aVegThick;
	varying float vVegThick;
#endif`;

const WIND_BODY_VERTEX = `
#ifdef AAA_VEG
{
	// Object -> world through the SAME batching/instancing chain <project_vertex> uses, so a
	// BatchedMesh and a plain Mesh land on the identical gust phase. A mismatch would make every
	// batch boundary sway out of step, which is far more visible than it sounds.
	// POINT order is BATCHING then INSTANCING then model -- verified against the r185 chunk
	// (three.module.js:467). The composite linear map is therefore
	// mat3(model) * mat3(instance) * mat3(batching), which is the OPPOSITE nesting order, so the
	// two blocks below are deliberately not symmetrical. Getting this backwards is silent: it only
	// shows on a BatchedMesh inside an InstancedMesh, where the wind would blow the wrong way.
	vec4 vegP = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		vegP = batchingMatrix * vegP;
	#endif
	#ifdef USE_INSTANCING
		vegP = instanceMatrix * vegP;
	#endif
	vec3 vegWorld = ( modelMatrix * vegP ).xyz;

	mat3 vegM = mat3( modelMatrix );
	#ifdef USE_INSTANCING
		vegM = vegM * mat3( instanceMatrix );
	#endif
	#ifdef USE_BATCHING
		vegM = vegM * mat3( batchingMatrix );
	#endif

	float vegT = uVegWind.w;
	vec2 vegDir = uVegWind.xy;

	// SCALE 1 -- the GUST FRONT. A scrolling fBm at world scale 1/24 m moving 0.6 m/s. The travelling
	// fronts are what sell a field as wind; one shared sine reads as a flag. [RAGE sec.Foliage]
	vec2 vegUV = ( vegWorld.xz - vegDir * ( uVegWindTune.y * vegT ) ) * uVegWindTune.x;
	vec2 vegNoise = texture2D( uVegGust, vegUV ).rg;
	float gust = mix( ${g(WIND.gustFloor)}, 1.0, vegNoise.r );

	// SCALE 2 -- the per-blade phase at 1.9 Hz, decorrelated by BOTH the authored attribute phase and
	// the INSTANCE's own world position. Without the world term, 40,000 instances of one clump
	// share 3 phases and the whole field pulses in unison.
	float vegHash = fract( sin( dot( floor( vegWorld.xz * 3.0 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
	float phase = 6.2831853 * ( aWind.y + vegHash );
	float flutter = sin( 6.2831853 * uVegWindTune.z * vegT + phase );
	float flutter2 = sin( 6.2831853 * uVegWindTune.z * 0.61 * vegT + phase * 1.7 + vegNoise.g * 6.2831853 );

	// CUBIC IN HEIGHT. offset = windVec * t^3 * bendScale. A LINEAR bend hinges the whole member at
	// its base; t^3 keeps the base planted and puts the motion in the top third, which is what wood
	// and grass actually do. [RAGE sec.Foliage]
	float t = aWind.x;
	float bend = uVegWindTune.w * uVegWind.z * aWind.z * ( t * t * t );

	float along = bend * ( gust + ${g(WIND.flutterAlong)} * flutter );
	float across = bend * ${g(WIND.flutterPerp)} * flutter2;

	// ARC-LENGTH CONSERVATION. A pure lateral offset STRETCHES the member: a 0.35 m blade grows to
	// 0.39 m at full wind and the whole field visibly breathes. Subtract the circular sagitta
	// d ~= lat^2/(2*arm) along the member's own up axis. Clamped to half the arm so an absurd wind
	// value cannot fold the geometry through itself.
	float lat = sqrt( along * along + across * across );
	float arm = max( aWind.w, 0.02 );
	float drop = min( ( lat * lat ) / ( 2.0 * arm ), arm * 0.5 );

	// World -> object by the TRANSPOSE (v * M == transpose(M) * v). Valid for the rotate + uniform
	// scale transforms every vegetation instance uses, and normalize() cancels the scale outright,
	// so no matrix inverse is needed in the hot path.
	vec3 windObj = vec3( vegDir.x, 0.0, vegDir.y ) * vegM;
	vec3 perpObj = vec3( -vegDir.y, 0.0, vegDir.x ) * vegM;
	vec3 upObj   = vec3( 0.0, 1.0, 0.0 ) * vegM;
	float lw = length( windObj ), lp = length( perpObj ), lu = length( upObj );
	windObj = lw > 1e-5 ? windObj / lw : vec3( 1.0, 0.0, 0.0 );
	perpObj = lp > 1e-5 ? perpObj / lp : vec3( 0.0, 0.0, 1.0 );
	upObj   = lu > 1e-5 ? upObj   / lu : vec3( 0.0, 1.0, 0.0 );

	transformed += windObj * along + perpObj * across - upObj * drop;
}
#endif
#ifdef AAA_VEG_TRANSLUCENT
	vVegThick = aVegThick;
#endif`;

const FOLIAGE_PARS_FRAGMENT = `
// -- AAA_VEG -- foliage shading ------------------------------------------------------------------
uniform vec4 uVegSun;        // xyz = WORLD direction toward the sun, w = sun visibility [0,1]
uniform vec3 uVegSunColor;   // pre-exposed sun illuminance (D1) -- what the DirectionalLight got
uniform vec4 uVegFoliage;    // x = residual up-bend  y = translucency  z = backscatter pow  w = wrap
uniform vec4 uVegSky;        // xyz = pre-exposed SKY illuminance  w = sky transmission gain
uniform vec3 uVegTransTint;  // leaf TRANSMITTANCE / REFLECTANCE ratio -- see V8
#ifdef AAA_VEG_TRANSLUCENT
	varying float vVegThick;
#endif`;

const FOLIAGE_NORMAL_FRAGMENT = `
#ifdef AAA_VEG_FOLIAGE
	// r185's <normal_fragment_begin> flips the shading normal on back faces under DOUBLE_SIDED
	// (three.module.js:441). Foliage normals are AUTHORED side-independent -- sphere-projected on
	// leaves (V3), bent-to-up on grass (V6) -- so the flip is exactly wrong: it points the back of
	// every blade DOWNWARD and the field renders black, which is the artefact the bent normal
	// exists to remove. Multiplying by faceDirection a second time restores the authored normal.
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
		nonPerturbedNormal *= faceDirection;
	#endif
	#ifdef AAA_VEG_UPBEND
		// Optional residual bend toward world up, for the case where a normal map has tilted the
		// authored normal back off-up. 0 by default: the geometry already carries the bend.
		vec3 vegUpView = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
		normal = normalize( mix( normal, vegUpView, uVegFoliage.x ) );
	#endif
#endif`;

const FOLIAGE_TRANSLUCENT_FRAGMENT = `
#ifdef AAA_VEG_TRANSLUCENT
{
	// TWO-SIDED FOLIAGE TRANSMISSION. [RAGE sec.Foliage]: wrapped diffuse max(0,(N*L+w)/((1+w)^2)) with
	// w = 0.5, plus a tight backscatter lobe pow(saturate(dot(V,-L)), 8)*thickness*1.6.
	//
	// Evaluated on -N, so this is strictly the light coming THROUGH the leaf from behind; it does
	// not double-count the front-lit lambert the standard loop already integrated.
	//
	// !!? It deliberately does NOT re-run the CSM lookup: a second getShadow() here costs more than
	// the entire rest of this material. It is gated instead by uVegSun.w (the scene's sun
	// visibility -- 0 at night, lowered under heavy cloud) and by the vertex-baked canopy-depth term
	// already multiplied into vColor, so a leaf deep inside the crown transmits about half what a
	// rim leaf does. The residual error is a faint glow on shadowed rim leaves, which reads as
	// bounce and is the trade every forward-lit foliage shader makes.
	// * V8 -- THE TRANSMITTED SPECTRUM IS NOT THE REFLECTED ONE. A leaf's transmittance and its
	// reflectance are different curves: both are gated by the chlorophyll absorption bands, but
	// transmission travels the full mesophyll and comes out markedly WARMER -- red passes, blue is
	// almost entirely absorbed. Multiplying diffuseColor alone (which is REFLECTANCE) makes a
	// backlit crown the same green as a front-lit one, and the single most recognisable AAA
	// foliage read is that a backlit canopy goes YELLOW-GREEN while the front stays cool.
	// uVegTransTint is that ratio, authored in WIND.transmissionTint.
	vec3 vegTrans = diffuseColor.rgb * uVegTransTint;

	vec3 vegL = normalize( ( viewMatrix * vec4( uVegSun.xyz, 0.0 ) ).xyz );
	float vegW = uVegFoliage.w;
	float vegNL = dot( -normal, vegL );
	float wrapped = max( 0.0, ( vegNL + vegW ) / ( ( 1.0 + vegW ) * ( 1.0 + vegW ) ) );
	float backs = pow( saturate( dot( geometryViewDir, -vegL ) ), uVegFoliage.z ) * ${g(WIND.backscatterGain)};
	reflectedLight.directDiffuse += uVegSunColor * uVegSun.w * uVegFoliage.y * vVegThick
		* vegTrans * ( wrapped + backs );

	// * V8b -- SKYLIGHT THROUGH THE LEAF. The direct term above is zero whenever the sun is not
	// behind the card, which is most cards most of the time -- and a card whose shading normal
	// points away from the sky then has NOTHING: r185 evaluates the IBL irradiance on normal
	// only, so the hemisphere behind the leaf is never integrated and the card renders as a black
	// hole punched in a bright sky. That is the exact frame this lane was handed.
	//
	// The missing half is the sky irradiance arriving on the BACK, which for a uniform hemisphere
	// is E_sky * (0.5 - 0.5 * dot(N, up)) -- one dot product, no second IBL fetch. Divided by PI
	// because this one IS a full-hemisphere integral, unlike the single-direction sun term above.
	vec3 vegUpV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
	float vegBackSky = saturate( 0.5 - 0.5 * dot( normal, vegUpV ) );
	reflectedLight.indirectDiffuse += uVegSky.xyz * uVegSky.w * uVegFoliage.y * vVegThick
		* vegTrans * vegBackSky * ${g(1 / Math.PI)};
}
#endif`;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §G — THE FACTORY
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * @param {object} materials  the mat/materials.js handle. Used for `applyPBRPatch` (bark only) and
 *                            the anisotropy ceiling. Foliage deliberately does NOT take the
 *                            AAA_PBR patch — that patch REPLACES `<normal_fragment_maps>`, which is
 *                            the anchor the bent/sphere normal correction needs (see §F).
 * @param {object} meshops    the geo/meshops.js handle. Used for `setBounds`/`geometryBytes`.
 * @param {Function} rng      seeded PRNG (mathx `mulberry32`). Used ONLY where the caller supplied
 *                            no seed; every seeded entry point derives its own stream so call
 *                            ORDER can never change output (D4).
 * @param {object} [opts]     {seed, anisotropy, atlas:{...}, translucency, upBend, registry}
 */
export function createVeg(materials, meshops, rng, opts = EMPTY) {
  // The shared stream is consulted EXACTLY ONCE, here, to derive the world seed when the caller
  // gave none. After that nothing in this module draws from it: every entry point derives its own
  // stream from (worldSeed, its own key), so call ORDER can never change output (D4).
  const stream = typeof rng === 'function' ? rng : mulberry32(0x5EED17);
  const worldSeed = (opts.seed | 0) || (((stream() * 4294967296) >>> 0) | 1);
  const mo = meshops || null;
  const setBounds = mo && typeof mo.setBounds === 'function'
    ? mo.setBounds
    : (geo) => { geo.computeBoundingBox(); geo.computeBoundingSphere(); return geo; };
  const geometryBytes = mo && typeof mo.geometryBytes === 'function' ? mo.geometryBytes : () => 0;
  const lodDetail = mo && mo.LOD_DETAIL ? mo.LOD_DETAIL : null;

  const anisotropy = clamp(opts.anisotropy === undefined ? 8 : opts.anisotropy | 0, 1, 16);
  let disposed = false;
  /** V9 — 'default' | 'tod' | 'explicit'. Reported by `stats()`; 'default' means the frame was
   *  shaded against the constructor's placeholder sun and is a DEFECT, not a state. */
  let sunSource = 'default';
  let todRef = null;

  /* --- shared uniform holders. `{value}` objects, bound BY REFERENCE into every veg material, so
        setWind/setSun are ONE write each regardless of how many materials exist. ------------- */
  const uVegWind = { value: new THREE.Vector4(1, 0, 1, 0) };            // dirX, dirZ, strength, simTime
  const uVegWindTune = { value: new THREE.Vector4(1 / WIND.gustMetres, WIND.gustSpeed, WIND.detailHz, WIND.bendMetres) };
  const uVegGust = { value: null };
  const uVegSun = { value: new THREE.Vector4(0.4, 0.82, 0.41, 1) };     // world dir TOWARD the sun, visibility
  const uVegSunColor = { value: new THREE.Vector3(1, 0.97, 0.92) };
  const uVegFoliage = {
    value: new THREE.Vector4(
      opts.upBend === undefined ? 0 : saturate(opts.upBend),
      opts.translucency === undefined ? 0.55 : saturate(opts.translucency),
      WIND.backscatterPower,
      WIND.wrap,
    ),
  };
  /** V8b — pre-exposed SKY illuminance (xyz) + the leaf's diffuse sky transmittance (w). */
  const uVegSky = {
    value: new THREE.Vector4(0, 0, 0, opts.skyTransmission === undefined
      ? WIND.skyTransmission : saturate(opts.skyTransmission)),
  };
  /** V8 — the transmittance/reflectance ratio. One uniform, every foliage material, by reference. */
  const uVegTransTint = {
    value: new THREE.Vector3(
      WIND.transmissionTint[0], WIND.transmissionTint[1], WIND.transmissionTint[2],
    ),
  };

  /** The module contract's `windUniforms`: hand this straight to any other module that wants to
   *  animate with the same clock (gfx/prepass.js, the HLOD baker, a wind-driven particle system). */
  const windUniforms = Object.freeze({
    uVegWind, uVegWindTune, uVegGust, uVegSun, uVegSunColor, uVegFoliage, uVegSky, uVegTransTint,
  });

  /* --- lazy bakes ------------------------------------------------------------------------- */
  let atlas = null;
  let bark = null;
  const hooks = new Map();
  const mats = { bark: null, leaf: null, grass: null };
  const depthMats = new Map();
  const cache = new Map();                  // species|seed|lod -> built record

  function ensureGust() {
    if (!uVegGust.value) uVegGust.value = bakeGustNoise(worldSeed ^ 0x77aa);
    return uVegGust.value;
  }
  function ensureAtlas() {
    if (!atlas) atlas = bakeLeafAtlas(worldSeed ^ 0x1eaf, anisotropy);
    return atlas;
  }
  function ensureBark() {
    if (!bark) bark = bakeBark(worldSeed ^ 0xba21, anisotropy);
    return bark;
  }

  /* --- shader plumbing --------------------------------------------------------------------- */

  /* ⭐⭐ `invariant gl_Position;` — THE BEAUTY HALF, FOR THE MATERIALS THAT CANNOT GET IT FROM
     mat/materials.js. That declaration is injected by `materials.applyPBRPatch`'s VERTEX_EDITS, and
     FOLIAGE DELIBERATELY DOES NOT TAKE THAT PATCH (AAA_PBR REPLACES <normal_fragment_maps>, which
     would delete the sphere-transferred leaf normal — see §F). So `veg.leaf` and `veg.grass` had no
     way to receive it, which is why reports/_idle_patch.md §7 could list `veg.leaf` as "coverage
     could not be certified" and why it stayed uncertified: it was not a sampling accident, it was
     structural. `veg.bark` DOES take the patch, so it is excluded here by `kind` — a second
     declaration of invariance on the same variable is a redeclaration, not a no-op, and ANGLE is
     entitled to refuse it. */
  const INVARIANT_DECL = 'invariant gl_Position;   // AAA_VEG — the beauty half of the depth contract with gfx/prepass.js';

  /** What a wind-displaced material carries in `userData.aaaVertexDisplacement`, and the tag the
   *  prepass registers under. ONE constant so the two halves cannot be spelled apart. */
  const VEG_DISPLACEMENT_TAG = 'veg.wind';

  const VERTEX_EDITS = [
    { find: '#include <common>', mode: 'after', insert: WIND_PARS_VERTEX },
    { find: '#include <begin_vertex>', mode: 'after', insert: WIND_BODY_VERTEX },
  ];
  /** The same list, plus the invariance declaration, for a material that is not PBR-patched. */
  const VERTEX_EDITS_INVARIANT = [
    { find: '#include <common>', mode: 'after', insert: `${INVARIANT_DECL}\n${WIND_PARS_VERTEX}` },
    { find: '#include <begin_vertex>', mode: 'after', insert: WIND_BODY_VERTEX },
  ];
  const FOLIAGE_FRAGMENT_EDITS = [
    { find: '#include <common>', mode: 'after', insert: FOLIAGE_PARS_FRAGMENT },
    { find: '#include <normal_fragment_maps>', mode: 'after', insert: FOLIAGE_NORMAL_FRAGMENT },
    { find: '#include <lights_fragment_end>', mode: 'after', insert: FOLIAGE_TRANSLUCENT_FRAGMENT },
  ];

  const WIND_BINDINGS = [['uVegWind', uVegWind], ['uVegWindTune', uVegWindTune], ['uVegGust', uVegGust]];
  const FOLIAGE_BINDINGS = WIND_BINDINGS.concat([
    ['uVegSun', uVegSun], ['uVegSunColor', uVegSunColor], ['uVegFoliage', uVegFoliage],
    ['uVegSky', uVegSky], ['uVegTransTint', uVegTransTint],
  ]);

  /**
   * ONE hook function object per (kind, stage-set), memoised. That matters: materialPatch's setter
   * de-duplicates by function IDENTITY (`rec.hooks.indexOf(fn) !== -1`), so a memoised hook makes
   * `applyWind` idempotent, and two materials of the same kind share one compiled program.
   */
  function hookFor(kind, wantFragment, wantInvariant) {
    const key = `${kind}|${wantFragment ? 'vf' : 'v'}${wantInvariant ? '|inv' : ''}`;
    let h = hooks.get(key);
    if (h) return h;
    const binds = wantFragment ? FOLIAGE_BINDINGS : WIND_BINDINGS;
    const edits = wantInvariant ? VERTEX_EDITS_INVARIANT : VERTEX_EDITS;
    h = function aaaVegHook(shader) {
      for (let i = 0; i < binds.length; i++) shader.uniforms[binds[i][0]] = binds[i][1];
      shader.vertexShader = applyEdits(shader.vertexShader, edits, key, 'vertex');
      if (wantFragment) {
        shader.fragmentShader = applyEdits(shader.fragmentShader, FOLIAGE_FRAGMENT_EDITS, key, 'fragment');
      }
      /* ⛔ PUBLISH THE COMPOSED SHADER, THE SAME WAY gfx/materialPatch.js:510 DOES.
         `tools/_idle_invariance_wall.mjs` and `materials.selfTest` both certify coverage by reading
         `material.userData.shader`, and a material whose hook never wrote it reads as
         "never compiled/patched" — which is how `veg.leaf` came to be listed as UNCERTIFIED in
         reports/_idle_patch.md §7 and stayed that way while it really was uncovered. It was never a
         sampling accident; it was a material outside the one convention those readers know. */
      if (this && this.userData) this.userData.shader = shader;
    };
    hooks.set(key, h);
    return h;
  }

  /**
   * Chain the veg shader onto a material, composing with gfx/materialPatch.js in EITHER order.
   *
   * If materialPatch has installed its accessor, a plain assignment lands in `rec.setter`, which
   * ADOPTS the hook into the dispatch chain and re-derives `customProgramCacheKey` from
   * `material.defines` — which is exactly why the defines are written FIRST. Without that ordering
   * the memoised key would not see AAA_VEG, and three.js would hand the swaying material the
   * NON-swaying material's compiled program (three.core.js:21018).
   *
   * If there is no accessor we own the chain ourselves and must supply the cache key by hand.
   */
  function chainShader(material, kind, defines, wantFragment, wantInvariant) {
    material.defines = material.defines || {};
    const keys = Object.keys(defines);
    for (let i = 0; i < keys.length; i++) material.defines[keys[i]] = defines[keys[i]];

    const hook = hookFor(kind, wantFragment, wantInvariant);
    const desc = Object.getOwnPropertyDescriptor(material, 'onBeforeCompile');
    const managed = !!(desc && typeof desc.get === 'function');

    if (managed) {
      material.onBeforeCompile = hook;                 // adopted by materialPatch's setter
    } else {
      const prev = typeof material.onBeforeCompile === 'function' ? material.onBeforeCompile : null;
      material.onBeforeCompile = prev
        ? function aaaVegChain(shader, renderer) { prev.call(this, shader, renderer); hook.call(this, shader, renderer); }
        : hook;
      const prevKey = typeof material.customProgramCacheKey === 'function' ? material.customProgramCacheKey : null;
      material.customProgramCacheKey = function aaaVegKey() {
        return `${prevKey ? prevKey.call(this) : this.type}|aaaveg:${kind}${wantInvariant ? '|inv' : ''}`;
      };
    }
    material.needsUpdate = true;
    return material;
  }

  /** The define set per kind. Distinct define sets are what keep the three veg programs apart in
   *  the program cache without three extra patch ids. */
  function definesFor(kind) {
    const d = { AAA_VEG: 1 };
    if (kind !== 'bark') {
      d.AAA_VEG_FOLIAGE = 1;
      d.AAA_VEG_TRANSLUCENT = 1;
      if (uVegFoliage.value.x > 0) d.AAA_VEG_UPBEND = 1;
    }
    return d;
  }

  /**
   * PUBLIC: give any material the identical wind displacement. This is how gfx/prepass.js, a
   * shadow depth material and the HLOD baker stay in lockstep with the forward pass — and staying
   * in lockstep is not optional, because stage 4 renders with EqualDepth against stage 2's depth.
   */
  function applyWind(material, kind = 'bark') {
    ensureGust();
    const foliage = kind !== 'bark';
    // A depth/prepass material has no lighting chunks, so only the vertex half can be injected.
    const hasLighting = material.isMeshStandardMaterial || material.isMeshPhysicalMaterial
      || material.isMeshLambertMaterial || material.isMeshPhongMaterial;
    /* `veg.bark` receives `invariant gl_Position;` from materials.applyPBRPatch; foliage cannot take
       that patch at all (§F) and so must carry the declaration itself. `kind` is the honest
       discriminator: it is the same flag that decides the patch, one call site above. */
    const wantInvariant = foliage;
    chainShader(material, kind, definesFor(kind), foliage && hasLighting, wantInvariant);

    /* ⭐⭐⭐ AND THE HALF THAT WAS MISSING FOR THE WHOLE LIFE OF THIS FILE.
       This module's own header, 40 lines up, says the prepass and the depth/HLOD materials "inject
       the same code from the same source". They never did: `applyWind` had EIGHT occurrences
       repo-wide and all eight were inside this file. `gfx/prepass.js` wrote the depth of foliage
       standing still while the opaque pass drew it bent by up to WIND.bendMetres, the beauty
       fragment lost the depth comparison for the same surface, and it was never shaded — MEASURED
       2026-07-29 at 50.1 % of every foliage pixel in the city (reports/_foliage_depth.md), which is
       the "shadow bug on the trees" the user reported.
       The prepass now composes THIS EXACT STRING into its own program, and its
       `vertexDisplacement.*` walls fail if the two ever drift or if a future displacement (water,
       flags, cloth, destruction) is added without registering. A comment could not have prevented
       this; a registration + a gate can. */
    material.userData = material.userData || {};
    material.userData.aaaVertexDisplacement = VEG_DISPLACEMENT_TAG;
    registerWindWithPrepass();
    return material;
  }

  /** Idempotent, and it fails LOUD rather than silently rendering black trees again. */
  let prepassRegistered = false;
  function registerWindWithPrepass() {
    if (prepassRegistered) return true;
    const reg = opts.registry;
    const pre = reg && typeof reg.get === 'function' ? reg.get('prepass') : null;
    if (!pre) {
      // The low tier runs with no prepass at all (main.js:1345) and that is a legitimate,
      // fully-shaded configuration — there is no second program to keep in step with.
      prepassRegistered = true;
      return false;
    }
    if (typeof pre.registerVertexDisplacement !== 'function') {
      throw new Error('[kitVeg] the prepass service does not expose registerVertexDisplacement(). '
        + 'Foliage displaces vertices in the vertex shader; without the prepass composing the same '
        + 'displacement it writes depth for a surface that is not where the beauty pass draws one, '
        + 'and 50% of every foliage pixel loses the depth test and is never shaded.');
    }
    ensureGust();
    pre.registerVertexDisplacement({
      id: 'veg.wind',
      tag: VEG_DISPLACEMENT_TAG,
      // BY REFERENCE, not by copy: the same strings this module injects into its own materials.
      parsVertex: WIND_PARS_VERTEX,
      bodyVertex: WIND_BODY_VERTEX,
      // The same uniform HOLDERS, so `update(dt)` drives both programs off one clock (D4).
      uniforms: { uVegWind, uVegWindTune, uVegGust },
      // AAA_VEG only. AAA_VEG_TRANSLUCENT would declare `aVegThick` + a varying the prepass
      // fragment shader never reads, and AAA_VEG_FOLIAGE/UPBEND are fragment-side.
      defines: { AAA_VEG: 1 },
    });
    prepassRegistered = true;
    return true;
  }

  /* --- materials --------------------------------------------------------------------------- */

  function barkMaterial() {
    if (mats.bark) return mats.bark;
    const set = ensureBark();
    const m = new THREE.MeshStandardMaterial({
      name: 'veg.bark',
      map: set.albedo,
      normalMap: set.normal,
      normalMapType: THREE.TangentSpaceNormalMap,
      // ORM (D7): ONE texture serves aoMap + roughnessMap + metalnessMap because r185's own chunks
      // already read .r/.g/.b respectively. One fetch, one sampler, three maps.
      roughnessMap: set.orm,
      metalnessMap: set.orm,
      aoMap: set.orm,
      roughness: 1.0,
      metalness: 0.0,
      // Per-species tint + the young-wood / mossy-foot gradients live in the vertex colour, so five
      // species share ONE material id (D6 caps us near 40 in view).
      vertexColors: true,
      side: THREE.FrontSide,
      // NO `dithering` — the display dither is composite.js:756, after the sRGB encode. See the
      // note at mat/materials.js `makeMaterialFor`; materials.selfTest().dither.* is the wall.
    });
    m.normalScale.set(1, 1);
    if (materials && typeof materials.applyPBRPatch === 'function') {
      // Bark takes the full AAA_PBR patch: it needs the indirect-only AO, the specular-AA roughness
      // clamp and the detail normal, and it has no alphaTest and no bent normal, so nothing in that
      // patch conflicts. (Foliage cannot: AAA_PBR REPLACES <normal_fragment_maps>. See §F.)
      materials.applyPBRPatch(m, {
        orm: true, detail: true, hex: false, ssao: true,
        porosity: BARK.porosity, detailTiling: 22, detailBlend: 0.24,
        macroAlbedo: 0.10, macroRough: 0.06,
      });
    }
    applyWind(m, 'bark');
    mats.bark = m;
    return m;
  }

  function leafMaterial() {
    if (mats.leaf) return mats.leaf;
    const a = ensureAtlas();
    const m = new THREE.MeshStandardMaterial({
      name: 'veg.leaf',
      map: a.map,
      normalMap: a.normalMap,
      normalMapType: THREE.TangentSpaceNormalMap,
      // THE alpha contract. alphaTest, NOT transparent, so the cards write depth, sort correctly
      // for free, survive the EqualDepth forward pass and do not become unbounded overdraw.
      alphaTest: VEG.alphaTest,
      transparent: false,
      side: THREE.DoubleSide,
      // Without this the canopy casts shadow from only half its cards and the tree's shade reads
      // as a lace doily. [AUTHORING §Vegetation]
      shadowSide: THREE.DoubleSide,
      roughness: 0.74,
      metalness: 0.0,
      vertexColors: true,
      // NO `dithering` — see bark above; the display dither lives at composite.js:756.
    });
    m.normalScale.set(0.85, 0.85);
    applyWind(m, 'leaf');
    mats.leaf = m;
    return m;
  }

  function grassMaterial() {
    if (mats.grass) return mats.grass;
    const m = new THREE.MeshStandardMaterial({
      name: 'veg.grass',
      // NO map: a LOD0 blade is ~2 cm wide, which is well under a pixel past 6 m, and giving it an
      // alpha-tested texture would buy a `discard` on 160,000 instances for detail nothing can
      // resolve. Colour comes from the vertex gradient; the LOD1 CARD is the textured one.
      color: 0xffffff,
      roughness: lerp(ROUGHNESS_BANDS.grass[0], ROUGHNESS_BANDS.grass[1], 0.5),   // [PBR §M] blade 0.62
      metalness: 0.0,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
      vertexColors: true,
      // NO `dithering` — see bark above; the display dither lives at composite.js:756.
    });
    applyWind(m, 'grass');
    mats.grass = m;
    return m;
  }

  /**
   * A depth material carrying the SAME wind displacement, for `mesh.customDepthMaterial`.
   * Assign it or the shadow of a swaying canopy stays nailed to the ground — which reads as
   * "the shadows are broken" and gets debugged in the wrong module for an afternoon.
   */
  function depthMaterial(kind = 'leaf') {
    const cached = depthMats.get(kind);
    if (cached) return cached;
    const m = new THREE.MeshDepthMaterial({
      name: `veg.depth.${kind}`,
      depthPacking: THREE.RGBADepthPacking,
      alphaTest: kind === 'leaf' ? VEG.alphaTest : 0,
      map: kind === 'leaf' ? ensureAtlas().map : null,
      side: kind === 'bark' ? THREE.FrontSide : THREE.DoubleSide,
    });
    applyWind(m, kind);
    depthMats.set(kind, m);
    return m;
  }

  /* --- assembly ---------------------------------------------------------------------------- */

  function finishGeometry(geo, tangents) {
    if (!geo) return null;
    if (tangents && geo.index && geo.attributes.uv && geo.attributes.normal) geo.computeTangents();
    setBounds(geo);
    _counters.geometries++;
    _counters.triangles += geo.index ? geo.index.count / 3 : 0;
    _counters.bytes += geometryBytes(geo);
    return geo;
  }

  /**
   * Build one tier. LOD tiers for a PROCEDURAL asset are produced by RE-RUNNING the generator with
   * lower parameters, never by decimating (meshops law: a quadric decimator eats the cheapest edges
   * first, which on a tree is the twigs, and LOD1 pops from "tree" to "coat rack").
   *
   * `levelDrop` removes the twig level — the tri saving is almost entirely there (144 twig tubes
   * against 22 branches). That leaves the LEVEL-2 branches as the new terminals, and far fewer of
   * them, so the canopy must buy its MASS back in card AREA rather than card count: `cardScale`
   * enlarges each card and `cardCap` lifts the per-twig cluster limit. Judged as area, not count —
   * oak LOD0 945 cards at 1.0× versus LOD1 ~400 at 1.55× is a ~30% mass step across a dithered,
   * TAA-resolved cross-fade, which is invisible. Dropping to 108 cards (the naive result) is a
   * 9× step and pops from across the map.
   */
  /**
   * ⭐ `cardCap` IS A CALLER KNOB, AND THE REASON IS A MEASURED BY-EYE DEFECT ON A NEW MAP.
   *
   * `VEG.leafAreaTarget` DERIVES a card's metre size from the crown and the card COUNT
   * (`s = R·sqrt(pi·LAI / (0.72·N))`), so the count is the only lever that changes card SIZE
   * without changing canopy MASS. At the default cap of 14 per terminal twig an oak emits ~945
   * cards on an 8.2 m crown, which solves to a **1.0 m** card. Seen from the 20 m a city street
   * gives you that is a correct-looking sprig. Seen from UNDER the tree — which is the entire
   * experience of `scenes/forest.js` — a 1 m leaf reads as a jungle frond, and the first render
   * of that map came back looking like a rainforest rather than a temperate wood.
   *
   * Raising the cap to 30 gives ~2 040 cards (still inside the structural `cardBudget`), and the
   * SAME leaf-area solve then returns **0.68 m** — 2.2× more cards at 0.68× the linear size, so
   * the crown carries identical mass and identical triangles-per-square-metre while every
   * individual card stops reading as a banana leaf.
   *
   * DEFAULT UNCHANGED. Absent the option this is `VEG.cardsPerTwig[1]`, byte-for-byte what
   * `scenes/city.js` and `scenes/arena.js` already get. A scene that wants a close-up canopy asks
   * for one; nothing is taken away from a scene that does not.
   */
  function buildTier(name, p, seed, maxTris, levelDrop, cardCap) {
    const rand = mulberry32(seed);
    const capLOD0 = cardCap && cardCap > 0 ? cardCap : VEG.cardsPerTwig[1];
    const params = {
      ...p,
      levels: Math.max(2, p.levels - levelDrop),
      children: levelDrop
        ? p.children.map((c, i) => Math.max(2, Math.round(c * (i === 0 ? 1.0 : 0.82))))
        : p.children,
      radialSegments: Math.max(4, p.radialSegments - levelDrop),
      trunkLength: p.trunkLength * (1 + (rand() * 2 - 1) * p.trunkLengthVar),
      cardScale: levelDrop ? 1.55 : 1.0,
      // The LOD1 tier drops the twig level, so it has far fewer terminals to hang cards on and its
      // cap has always run ahead of LOD0's. Keep that RATIO when a caller raises the base.
      cardCap: levelDrop ? Math.round(capLOD0 * (24 / VEG.cardsPerTwig[1])) : capLOD0,
    };

    /* ⛔⛔ w7 — THE SPLIT WAS BACKWARDS FOR A STREET TREE, MEASURED: trunk 3,418 tris against a
       canopy of 1,890. 0.55 gives the WOODY half more than the crown on an asset whose entire
       silhouette from 5 m out is the crown; the bole is a tapered cylinder that a viewer never
       counts sides on, and it is instanced 260 times in the city pool.

       0.34 is not a taste. The woody half is the sum of `radialSegments`-sided tubes and it stops
       when it hits this cap, so the cap IS the trunk cost: 0.34 x 7000 = 2,380, which still buys
       the trunk, 22 branches and the level-1 forks at 6-8 sides — every silhouette a bole has.
       What the crown does with the ~1,000 triangles it gains is §"cardsPerTwig" below: the w6 judge
       filed vegetation as "large individually-visible flat quads ... no canopy MASS", and mass is
       bought in CARDS. Both halves of that were one number. */
    const budget = { tris: 0, maxTubes: 900, maxWoodyTris: Math.floor(maxTris * 0.34) };
    const tubes = [];
    growBranch(tubes, 0, 0, 0, 0, 1, 0, params.trunkLength, p.trunkRadius, 0, params, rand, budget);

    let height = 0.001;
    let radius = 0.001;
    for (let i = 0; i < tubes.length; i++) {
      const { data, count } = tubes[i];
      for (let r = 0; r < count; r++) {
        const o = r * RING_STRIDE;
        if (data[o + 1] > height) height = data[o + 1];
        const rad = Math.hypot(data[o], data[o + 2]);
        if (rad > radius) radius = rad;
      }
    }

    // V7 — the bark bake is painted in `TINT.barkBase`, so what the vertex colour carries is the
    // RATIO to it: the species tint, the young-wood lift at the twigs, and the damp foot. Every
    // authored relationship is preserved and only the second application of the base tint is gone.
    const woody = finishGeometry(emitWoody(tubes, params, {
      treeHeight: height,
      tintBaseMod: tintRatio(
        [TINT.barkBase[0] * p.barkTint[0], TINT.barkBase[1] * p.barkTint[1], TINT.barkBase[2] * p.barkTint[2]],
        TINT.barkBase,
      ),
      tintTipMod: tintRatio(
        [TINT.barkTip[0] * p.barkTint[0], TINT.barkTip[1] * p.barkTint[1], TINT.barkTip[2] * p.barkTint[2]],
        TINT.barkBase,
      ),
      tintFootMod: tintRatio(TINT.barkFoot, TINT.barkBase),
      crownFlex: p.crownFlex,
    }), true);

    const woodyTris = budget.tris;
    // THE BUDGET LAW: the canopy gets exactly what the woody half did not spend. There is no
    // parameter set that can push LOD0 past VEG.maxTrisLOD0.
    const cardBudget = Math.max(0, Math.floor((maxTris - woodyTris) / 2));
    const canopy = finishGeometry(emitCanopy(tubes, params, rand, {
      cardBudget,
      crownRadius: radius,
      uvTiles: p.leafTiles,
      uvWeights: p.leafWeights,
      tint: p.leafTint,
      autumnTint: p.autumnTint,   // R3 — dressed by tree() when o.snow > 0; undefined in summer
      sizeRange: [p.cardSize[0] * params.cardScale, p.cardSize[1] * params.cardScale],
      cardCap: params.cardCap,
      treeHeight: height,
      crownFlex: p.crownFlex,
    }), true);

    _counters.tubes += tubes.length;
    const tris = woodyTris + (canopy ? canopy.index.count / 3 : 0);
    return { trunk: woody, canopy, tris, height, radius: Math.max(radius, height * 0.18) };
  }

  /**
   * `tree(species, seed) -> {trunk, canopy, lodTiers}`
   *
   * `trunk` and `canopy` are the LOD0 geometries (the same objects as `lodTiers[0]`). Both are
   * INDEXED and carry position/normal/uv/tangent/color/aWind (+ aVegThick on the canopy).
   * Bind them with `handle.materials.bark` and `handle.materials.leaf`.
   */
  function tree(species = 'oak', seed = 1, o = EMPTY) {
    if (disposed) throw new Error('[kitVeg] tree() after dispose()');
    const name = SPECIES_DEF[species] ? species : 'oak';
    if (!SPECIES_DEF[species]) {
      console.warn(`[kitVeg] unknown species '${species}' — falling back to oak. Known: [${SPECIES_NAMES.join(', ')}]`);
    }
    /* ** THE WINTER DRESS (2026-08-05, snowflow-first §1b). Measured by census on the first frozen
     * world: the frost gate correctly left ONLY conifers standing — and they stood SUMMER-GREEN on
     * snowpack, because this kit has exactly one season. `o.snow` (0..1) pulls the canopy tint
     * toward the measured fresh-snow albedo (materials.js REF.snow 0.8414); the pull caps at 0.88
     * so a dark needle edge reads through the load — a snow-laden conifer, not a white cone. Every tier
     * and the billboard inherit it through `p.leafTint`, which is the ONE tint seam they already
     * share. Bark is untouched: trunks read dark against snow in every reference frame. */
    const snow = Math.max(0, Math.min(1, Number(o.snow) || 0));
    // Quantized into the cache key — a key that ignores an option hands the second caller the
    // first caller's geometry (the cardCap lesson, same sentence).
    const snowQ = Math.round(snow * 8);
    const key = `${name}|${seed | 0}|${o.maxTris || 0}|${o.cardCap || 0}|s${snowQ}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const pBase = SPECIES_DEF[name];
    // R3 — the dress is dressLeafTint (ONE copy of the blend, shared with selfTest), and it
    // dresses the AUTUMN target too: the 6% turned sprigs must frost like the rest of the crown.
    const p = snowQ > 0 ? {
      ...pBase,
      leafTint: dressLeafTint(pBase.leafTint, snowQ / 8),
      autumnTint: dressLeafTint(TINT.leafAutumn, snowQ / 8),
    } : pBase;
    // Derive the stream from (worldSeed, species, seed) rather than drawing from the shared one:
    // `tree('oak', 7)` must be identical whether it is the first call or the ten-thousandth (D4).
    const s0 = cellSeed(worldSeed, seed | 0, name.charCodeAt(0) * 131 + name.length);
    const maxTris = clamp(o.maxTris || VEG.maxTrisLOD0, 400, VEG.maxTrisLOD0);
    const cardCap = o.cardCap ? clamp(o.cardCap | 0, VEG.cardsPerTwig[0], 64) : 0;

    const t0 = buildTier(name, p, s0, maxTris, 0, cardCap);
    const t1 = buildTier(name, p, s0, Math.min(VEG.maxTrisLOD1, maxTris), 1, cardCap);
    /* The billboard's BOLE samples one measured-opaque rect of the leaf atlas, so the atlas has to
       exist before the geometry does. This costs nothing: `leafMaterial()` three lines below in
       the same record materialises it anyway, so `ensureAtlas()` here only moves the same lazy
       bake a few microseconds earlier in the same call. */
    const atl = ensureAtlas();
    // V7 — the canopyBlob tile is baked in `TINT.leafSummer`, so the billboard's vertex colour
    // is the species tint RELATIVE to it, not the species tint itself.
    // §1b: needle species carry a conical far silhouette — same SPRIG table that shapes the leaves.
    const _sprigShape = SPRIG[name] && SPRIG[name].shape;
    const _billboardTaper = _sprigShape === 'needle' ? NEEDLE_BILLBOARD_TAPER : 0;
    const billboard = finishGeometry(
      buildTreeBillboard(t0.height, t0.radius * 1.05, leafModulator(p.leafTint, TILE_TINT[TILE.canopyBlob]),
        atl.coreUV && atl.coreLinear ? {
          radius: p.trunkRadius,
          flare: p.rootFlare,
          uv: atl.coreUV,
          /* V7 again, and the denominator is the thing that is easy to get wrong: the bole is
             drawn over the atlas's CORE texels, not over the tile mean and not over a bark bake,
             so the modulator that produces `barkBase × species barkTint` must divide by the core's
             own measured linear colour. `selfTest` asserts the PRODUCT lands in a bark band above
             the rubric's 0.02 dielectric floor — a per-factor check cannot see a per-product
             defect, which is the whole lesson of the V7 block above `tintRatio`.
             `boleModulator`, not `tintRatio`: see its docblock for the birch measurement that
             separates them. */
          tint: boleModulator(
            [TINT.barkBase[0] * p.barkTint[0], TINT.barkBase[1] * p.barkTint[1], TINT.barkBase[2] * p.barkTint[2]],
            atl.coreLinear,
            VEG.boleAlbedoCeiling,
          ),
        } : null, _billboardTaper), false,
    );

    // Switch distances. meshops publishes distanceK PER UNIT OF BOUNDING RADIUS, tuned so a tier
    // flips when its smallest preserved feature drops under ~2 px; a tree's "radius" for that
    // purpose is its crown radius, not its height.
    const k1 = lodDetail && lodDetail[1] ? lodDetail[1].distanceK : 8;
    const k2 = lodDetail && lodDetail[2] ? lodDetail[2].distanceK : 25;

    const rec = {
      species: name,
      seed: seed | 0,
      trunk: t0.trunk,
      canopy: t0.canopy,
      height: t0.height,
      radius: t0.radius,
      tris: t0.tris,
      lodTiers: [
        { lod: 0, distance: 0, trunk: t0.trunk, canopy: t0.canopy, tris: t0.tris },
        { lod: 1, distance: k1 * t0.radius, trunk: t1.trunk, canopy: t1.canopy, tris: t1.tris },
        /* LOD2 still has no woody GEOMETRY — a 2.5 k-triangle tapered tube at 161 m is indefensible
           — but it is no longer trunkLESS: `buildTreeBillboard` carries a 4-triangle crossed bole
           inside the crown card, on the same material and the same draw call. The claim that used
           to sit here ("at 100 m+ a 0.3 m trunk is under a pixel") is measurably false at the
           distance this tier actually switches: 3.3 px wide for an oak at 161 m, 5.4 px for a
           poplar at 62.9 m, under an 11.8–34.6 px band of daylight where the bole should be. The
           arithmetic is in `buildTreeBillboard`'s docblock.
           `tris` is READ FROM THE GEOMETRY, not restated — this field said 6 while the geometry
           said 6, and the only reason that stayed true is that nobody changed the geometry. */
        {
          lod: 2,
          distance: k2 * t0.radius,
          trunk: null,
          canopy: billboard,
          tris: billboard.index.count / 3,
        },
      ],
      /** Metres past which a consumer should stop drawing this prototype entirely. `null` = never:
       *  a tree publishes a billboard tier and the streamer may keep it to the horizon. `bush()`
       *  publishes a FINITE one — see the block there. */
      cullDistance: null,
      materials: { bark: barkMaterial(), leaf: leafMaterial() },
    };
    if (rec.tris > VEG.maxTrisLOD0) {
      // Structurally unreachable (the budget law above), so if it ever fires the budget accounting
      // has drifted from the emitter and every downstream memory figure is wrong too.
      throw new Error(`[kitVeg] tree('${name}',${seed}) emitted ${rec.tris} tris, over the ${VEG.maxTrisLOD0} LOD0 cap`);
    }
    _counters.trees++;
    cache.set(key, rec);
    return rec;
  }

  /**
   * `bush(seed) -> {trunk, canopy, lodTiers}` — a shrub is a crown without a bole. Same builder,
   * `shrub` parameters, a 1.4 k budget and TWO tiers.
   *
   * ⛔⛔ THE MISSING THIRD TIER IS THE FEATURE, AND GIVING IT ONE WOULD RE-BREAK A FIXED FRAME.
   * REFUTED, with the frame that condemned it: `scenes/sandbox.js:524-530` carries the note
   * "asking it for tier 2 and taking tier 1 is exactly the invented tier that speckled the first
   * render white", and `scenes/forest.js:1639-1641` independently made the same call — it culls
   * shrubs at `shrubCull` "rather than inventing a tier the kit refused to author". The measured
   * failure was hundreds of small WHITE CONES to the horizon: a bush is 0.84 m tall, at 300 m its
   * alpha-tested cards are 2-3 px, the atlas resolves to its own DILATED border (V5) and the shrub
   * renders as a white blob. A billboard tier here would hand both scenes back the exact geometry
   * they had to learn to refuse.
   *
   * SO THE ABSENCE IS MADE EXPLICIT INSTEAD OF INVENTED AWAY. It was already harmless — both
   * consumers drop an unauthored tier rather than clamping to the last one — but it was harmless
   * by PROSE: `sandbox.js:454` hard-codes `const CULL_BUSH_M = 42;` with the comment
   * `// kitVeg: "a bush past 40 m..."`, a number copied out of a sentence in THIS file. That is a
   * drift waiting to happen — change the sentence and the scene keeps 42 forever. `cullDistance`
   * is now a published FIELD, so a consumer can read the kit's own limit instead of quoting it,
   * and `selfTest` asserts a two-tier record always carries one.
   */
  /* ══ THE DEADFALL (snowflow-first §1b remainder, 2026-08-06) ══════════════════════════════════
     `world/chunkWorker.js` proto 8 `deadwood` carries wWild 0.44 — a real share of a wild
     biome's ground detail — and dropped as `noKit` because this kit grew nothing that lies down:
     scenes/sandbox.js:567 measured the gap by grep ("PROPS holds 40 names and NOT ONE matches
     /log|snag|dead/") and named the repair here. The form is the kit's OWN machinery pointed
     sideways: `growBranch` takes an arbitrary base + direction (the trunk keeps whatever line it
     is given — droop is branch-only, upPull is fork-only, both measured at :888/:938), so a
     fallen log is a level-2 grow along a HORIZONTAL axis at trunk-radius height, with short
     broken stubs pulled upward at the fork (upPull 0.45 keeps them out of the ground), zero
     crownFlex (dead wood does not sway), and NO canopy pass at all — a dead log wearing leaf
     cards would be the exact wrong answer emitCanopy exists to give. Bark is silvered (dead wood
     weathers pale and desaturated) through the same modulator law every living species uses. */
  const DEADFALL_DEF = Object.freeze({
    label: 'deadfall log',
    levels: 2,
    children: [3],
    branchAngle: [58],
    angleVariance: 18,
    lengthRatio: 0.15,
    trunkLength: 3.1, trunkLengthVar: 0.28,
    trunkRadius: 0.16,
    taper: 0.42, taperCurve: 0.9,
    rootFlare: 0.55, flareFrac: 0.10,     // the torn butt end
    radiusExponent: 2.3,
    minRadius: 0.02, minLength: 0.25,
    droop: 0.05, upPull: 0.30,            // broken stubs point up-ish but STAY SHORT (the
                                          // liesDown wall measured 1.64m at 0.22/0.45)
    gnarl: [0.10, 0.30],
    radialSegments: 6,
    sectionLength: 0.55,
    childStart: 0.25, trunkClear: 0.15,
    excurrent: 0,
    barkTint: [1.30, 1.26, 1.14],         // silvered dead wood — pale, desaturated
    crownFlex: 0,
  });

  function deadfall(seed = 1, o = EMPTY) {
    if (disposed) throw new Error('[kitVeg] deadfall() after dispose()');
    const key = `deadfall|${seed | 0}|${o.maxTris || 0}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const s0 = cellSeed(worldSeed, seed | 0, 0xDEAD);
    const maxTris = clamp(o.maxTris || 900, 200, 1600);

    const buildLog = (levelDrop) => {
      const rand = mulberry32(s0 + levelDrop);
      const p = levelDrop
        ? { ...DEADFALL_DEF, levels: 1, radialSegments: 5 }   // LOD1: the bare trunk, no stubs
        : DEADFALL_DEF;
      const L = p.trunkLength * (1 + (rand() * 2 - 1) * p.trunkLengthVar);
      const yaw = rand() * Math.PI * 2;
      const dx = Math.cos(yaw), dz = Math.sin(yaw);
      const budget = { tris: 0, maxTubes: 60, maxWoodyTris: maxTris };
      const tubes = [];
      // Base at one end, trunk-radius above the ground, growing HORIZONTALLY (+3° so the tip
      // rests a touch higher than the butt — a felled trunk over uneven ground, not a laser).
      growBranch(tubes, -dx * L * 0.5, p.trunkRadius * 1.15, -dz * L * 0.5,
        dx, 0.03, dz, L, p.trunkRadius, 0, p, rand, budget);
      let radius = 0.001;
      let height = 0.001;
      for (let i = 0; i < tubes.length; i++) {
        const { data, count } = tubes[i];
        for (let r = 0; r < count; r++) {
          const off = r * RING_STRIDE;
          const rad = Math.hypot(data[off], data[off + 2]);
          if (rad > radius) radius = rad;
          if (data[off + 1] > height) height = data[off + 1];
        }
      }
      const woody = finishGeometry(emitWoody(tubes, p, {
        treeHeight: Math.max(0.5, height),
        tintBaseMod: tintRatio(
          [TINT.barkBase[0] * p.barkTint[0], TINT.barkBase[1] * p.barkTint[1], TINT.barkBase[2] * p.barkTint[2]],
          TINT.barkBase,
        ),
        tintTipMod: tintRatio(
          [TINT.barkTip[0] * p.barkTint[0], TINT.barkTip[1] * p.barkTint[1], TINT.barkTip[2] * p.barkTint[2]],
          TINT.barkBase,
        ),
        tintFootMod: tintRatio(TINT.barkFoot, TINT.barkBase),
        crownFlex: 0,
      }), true);
      return { woody, tris: budget.tris, radius, height };
    };

    const t0 = buildLog(0);
    const t1 = buildLog(1);
    const k1 = lodDetail && lodDetail[1] ? lodDetail[1].distanceK : 8;
    const rec = {
      species: 'deadfall',
      seed: seed | 0,
      trunk: t0.woody,
      canopy: null,
      height: t0.height,
      radius: t0.radius,
      tris: t0.tris,
      lodTiers: [
        { lod: 0, distance: 0, trunk: t0.woody, canopy: null, tris: t0.tris },
        { lod: 1, distance: k1 * t0.radius, trunk: t1.woody, canopy: null, tris: t1.tris },
        /* NO billboard tier, and that is the bush() lesson verbatim: a 0.3 m-high lying log at
           150 m is under 2 px, and an alpha-tested card there resolves to its own dilated border.
           `cullDistance` below makes the absence explicit instead of invented away. */
      ],
      cullDistance: 64,
      materials: { bark: barkMaterial(), leaf: null },
    };
    _counters.trees++;
    cache.set(key, rec);
    return rec;
  }

  /* ══ THE WINDTHROW SET (E-BIOME FOREST, 2026-09-05) — `BIOME_SCOPE.md` FOR-2 ═══════════════════
     The scope's finding, verbatim: "The AAA forest exists and is LOCKED IN A SCENE — the same
     defect shape `vegPlacer` was created to fix." `scenes/forest.js` builds `logGeometry`,
     `stumpGeometry` and `rootPlateGeometry` as CLOSURES INSIDE `build(ctx)` on a bespoke 384 m
     field id, so no generated world can ever have them; meanwhile `deadfall()` — the fallen bole,
     already built, already gated — had ZERO consumers repo-wide outside its own selfTest.

     `deadfall()` was already the LOG. These two are the other two members, moved into the kit
     beside it so a generated world can reach them:
       · `snag(seed)`      the standing broken bole  (forest.js `stumpGeometry`)
       · `rootPlate(seed)` the disc of earth a windthrown tree stands on end (`rootPlateGeometry`)

     ⚠️ THE SCENE STILL CARRIES ITS OWN COPIES, and that is stated rather than discovered: this
     lane's region does not include `src/scenes/`, so `forest.js` was NOT re-pointed at these.
     Two copies of a geometry is exactly the drift this codebase keeps paying for, so re-pointing
     the scene is OWED WORK and belongs to whoever owns `scenes/`. What is fixed today is that the
     vocabulary is no longer unreachable.

     ⛔ THEY SHARE `materials.bark` WITH EVERY TREE IN THE FRAME, which is the whole budget
     argument: a windthrow layer of logs + snags + root plates adds ZERO draw-call families and
     ZERO programs to a forest that is already drawing trunks. forest.js binds its root plate to a
     DIRT material instead; that is one more material and one more draw call, and this kit has no
     soil material to offer, so the plate rides bark with the damp-foot modulator (the same
     `tintRatio(TINT.barkFoot, TINT.barkBase)` every bole's foot already uses) — darker and
     desaturated, which reads as torn earth on bark texture. Honest difference, named. */

  /** The standing dead conifer: a short bole with a jagged splintered top and a few broken stubs
   *  high up (the low branches went first). Same two-tier trunk-only contract as `deadfall()` —
   *  no canopy pass, no billboard tier, a FINITE `cullDistance` — for the same measured reason
   *  `bush()` states: an alpha-tested card at 2 px resolves to its own dilated border, and a dead
   *  pole has no crown to justify one. `excurrent` is high and `trunkClear` is 0.55 so what few
   *  stubs there are sit in the top half. */
  const SNAG_DEF = Object.freeze({
    label: 'standing snag',
    levels: 3,
    children: [4, 3],
    branchAngle: [70, 58],
    angleVariance: 24,
    lengthRatio: 0.30,
    trunkLength: 8.5, trunkLengthVar: 0.30,
    trunkRadius: 0.24,
    taper: 0.86, taperCurve: 1.10,
    rootFlare: 0.58, flareFrac: 0.14,
    radiusExponent: 2.3,
    minRadius: 0.02, minLength: 0.30,
    droop: 0.02, upPull: 0.22,
    gnarl: [0.03, 0.10, 0.18],
    radialSegments: 6,
    sectionLength: 1.50,
    childStart: 0.35, trunkClear: 0.55,
    excurrent: 0.90,
    barkTint: [1.30, 1.24, 1.12],         // silvered, the same weathering DEADFALL_DEF carries
    crownFlex: 0,                          // dead wood does not sway
  });

  function snag(seed = 1, o = EMPTY) {
    if (disposed) throw new Error('[kitVeg] snag() after dispose()');
    const key = `snag|${seed | 0}|${o.maxTris || 0}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const s0 = cellSeed(worldSeed ^ 0x5a9, seed | 0, 0x51a6);
    const maxTris = clamp(o.maxTris || 800, 200, 1600);

    const buildSnag = (levelDrop) => {
      const rand = mulberry32(s0 + levelDrop);
      const p = levelDrop
        ? { ...SNAG_DEF, levels: 1, radialSegments: 5 }   // LOD1: the bare pole, no stubs
        : SNAG_DEF;
      const L = p.trunkLength * (1 + (rand() * 2 - 1) * p.trunkLengthVar);
      const budget = { tris: 0, maxTubes: 40, maxWoodyTris: maxTris };
      const tubes = [];
      // Straight up from the ground, with a ~4 degree lean so a stand of them is not a picket
      // fence. `growBranch` takes an arbitrary base + direction — the same machinery `deadfall`
      // points sideways, pointed up.
      const lean = (rand() * 2 - 1) * 0.07;
      const leanZ = (rand() * 2 - 1) * 0.07;
      growBranch(tubes, 0, 0, 0, lean, 1, leanZ, L, p.trunkRadius, 0, p, rand, budget);
      let radius = 0.001;
      let height = 0.001;
      for (let i = 0; i < tubes.length; i++) {
        const { data, count } = tubes[i];
        for (let r = 0; r < count; r++) {
          const off = r * RING_STRIDE;
          const rad = Math.hypot(data[off], data[off + 2]);
          if (rad > radius) radius = rad;
          if (data[off + 1] > height) height = data[off + 1];
        }
      }
      const woody = finishGeometry(emitWoody(tubes, p, {
        treeHeight: Math.max(0.5, height),
        tintBaseMod: tintRatio(
          [TINT.barkBase[0] * p.barkTint[0], TINT.barkBase[1] * p.barkTint[1], TINT.barkBase[2] * p.barkTint[2]],
          TINT.barkBase,
        ),
        tintTipMod: tintRatio(
          [TINT.barkTip[0] * p.barkTint[0], TINT.barkTip[1] * p.barkTint[1], TINT.barkTip[2] * p.barkTint[2]],
          TINT.barkBase,
        ),
        tintFootMod: tintRatio(TINT.barkFoot, TINT.barkBase),
        crownFlex: 0,
      }), true);
      return { woody, tris: budget.tris, radius, height };
    };

    const t0 = buildSnag(0);
    const t1 = buildSnag(1);
    const k1 = lodDetail && lodDetail[1] ? lodDetail[1].distanceK : 8;
    const rec = {
      species: 'snag',
      seed: seed | 0,
      trunk: t0.woody,
      canopy: null,
      height: t0.height,
      radius: t0.radius,
      tris: t0.tris,
      lodTiers: [
        { lod: 0, distance: 0, trunk: t0.woody, canopy: null, tris: t0.tris },
        { lod: 1, distance: k1 * t0.radius, trunk: t1.woody, canopy: null, tris: t1.tris },
      ],
      /** Metres past which a consumer must stop drawing it. Through the streamer's own projection
       *  (`screenPx = h * viewportH / (dist * 2 * tanHalf)`, 900 px, 60 degree vertical FOV) an
       *  8.5 m pole at 150 m is 30 px TALL and about 1.5 px WIDE — a vertical hairline that
       *  aliases into a shimmer as the camera moves. Published as DATA, not prose, for the exact
       *  reason `deadfall`'s block gives: `sandbox.js:454` hard-codes a number copied out of a
       *  sentence in this file. */
      cullDistance: 150,
      materials: { bark: barkMaterial(), leaf: null },
    };
    _counters.trees++;
    cache.set(key, rec);
    return rec;
  }

  /**
   * `rootPlate(seed, {radius}) -> {geo, tris, radius}` — the disc of earth and roots a windthrown
   * tree stands on end, PAIRED with `deadfall()`: a fallen bole with no plate at its butt is the
   * clearest tell that a "forest floor" was scattered rather than grown, and `scenes/forest.js`
   * places 7 standing plates for exactly that reason.
   *
   * A direct port of that scene's `rootPlateGeometry` — a jagged front ring, a flatter back ring
   * and two centres, so it has THICKNESS and does not read as a decal — re-emitted with the kit's
   * own attribute set (position/normal/uv/color/aWind) so it binds `materials.bark` instead of
   * needing a soil material of its own.
   */
  function rootPlate(seed = 1, o = EMPTY) {
    if (disposed) throw new Error('[kitVeg] rootPlate() after dispose()');
    const r = clamp(o.radius === undefined ? 2.7 : o.radius, 0.6, 6);
    const key = `rootplate|${seed | 0}|${r.toFixed(3)}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const rand = mulberry32(cellSeed(worldSeed ^ 0x9107, seed | 0, 0x71a7));

    const RS = 13;
    const verts = RS * 2 + 2;
    const pos = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const col = new Float32Array(verts * 3);
    const wind = new Float32Array(verts * 4);   // all zero: a root plate does not sway
    const idx = new Uint16Array(RS * 12);
    const cFront = RS * 2;
    const cBack = RS * 2 + 1;

    /* The plate is TORN EARTH on a bark texture, so its vertex colour is the damp-foot modulator
       every bole's own base already carries — dark and desaturated against `TINT.barkBase`, which
       is what the bake painted. Absolute soil colour here would square the bake (V7). */
    const foot = tintRatio(TINT.barkFoot, TINT.barkBase);

    for (let i = 0; i < RS; i++) {
      const a = (i / RS) * TAU;
      const rr = r * (0.72 + 0.42 * rand());
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr * 0.92 + r * 0.9;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = 0.16 + 0.10 * rand();
      const b = RS + i;
      pos[b * 3] = x * 0.94;
      pos[b * 3 + 1] = y;
      pos[b * 3 + 2] = -0.16;
      // Planar UV in metres, so the bark bake's 1.2 m world tiling reads at the right scale.
      for (const vi of [i, b]) {
        uv[vi * 2] = pos[vi * 3] / BARK.worldMetres;
        uv[vi * 2 + 1] = pos[vi * 3 + 1] / BARK.worldMetres;
        col[vi * 3] = foot[0]; col[vi * 3 + 1] = foot[1]; col[vi * 3 + 2] = foot[2];
      }
    }
    pos[cFront * 3] = 0; pos[cFront * 3 + 1] = r * 0.9; pos[cFront * 3 + 2] = 0.34;
    pos[cBack * 3] = 0; pos[cBack * 3 + 1] = r * 0.9; pos[cBack * 3 + 2] = -0.30;
    for (const vi of [cFront, cBack]) {
      uv[vi * 2] = 0;
      uv[vi * 2 + 1] = (r * 0.9) / BARK.worldMetres;
      // The centre of the plate is the deepest shade in it — a bowl of roots, not a lit face.
      col[vi * 3] = foot[0] * 0.72; col[vi * 3 + 1] = foot[1] * 0.72; col[vi * 3 + 2] = foot[2] * 0.72;
    }
    let t = 0;
    for (let i = 0; i < RS; i++) {
      const a = i;
      const b = (i + 1) % RS;
      idx[t++] = cFront; idx[t++] = a; idx[t++] = b;
      idx[t++] = cBack; idx[t++] = RS + b; idx[t++] = RS + a;
      idx[t++] = a; idx[t++] = RS + a; idx[t++] = b;
      idx[t++] = b; idx[t++] = RS + a; idx[t++] = RS + b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aWind', new THREE.BufferAttribute(wind, 4));
    geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, t), 1));
    geo.computeVertexNormals();
    geo.name = 'veg.rootPlate';
    geo.userData.aaa = { tris: t / 3, radius: r };
    const rec = {
      species: 'rootPlate',
      seed: seed | 0,
      trunk: finishGeometry(geo, true),
      canopy: null,
      height: r * 1.8,
      radius: r,
      tris: t / 3,
      lodTiers: [{ lod: 0, distance: 0, trunk: geo, canopy: null, tris: t / 3 }],
      /** ONE tier and a finite cull, and the absence of a second is deliberate: a root plate is a
       *  flat disc whose whole read is its silhouette against the litter, and at the distance a
       *  second tier would switch there is no silhouette left to preserve. */
      cullDistance: 90,
      materials: { bark: barkMaterial(), leaf: null },
    };
    cache.set(key, rec);
    return rec;
  }

  function fern(o = EMPTY) {
    if (disposed) throw new Error('[kitVeg] fern() after dispose()');
    const key = `fern|${o.seed | 0}|${o.fronds | 0}|${o.quads | 0}|${o.height || 0}|${o.width || 0}|${o.dry || 0}|${o.tile === undefined ? -1 : o.tile | 0}`;
    const hit = cache.get(key);
    if (hit) return hit;
    ensureAtlas();
    const geo = finishGeometry(buildFernClump(o), true);
    cache.set(key, geo);
    return geo;
  }

  function fernCard(o = EMPTY) {
    if (disposed) throw new Error('[kitVeg] fernCard() after dispose()');
    const key = `ferncard|${o.width || 0}|${o.height || 0}|${o.tile === undefined ? -1 : o.tile | 0}`;
    const hit = cache.get(key);
    if (hit) return hit;
    ensureAtlas();
    const geo = finishGeometry(buildFernCard(o), true);
    cache.set(key, geo);
    return geo;
  }

  function bush(seed = 1, o = EMPTY) {
    if (disposed) throw new Error('[kitVeg] bush() after dispose()');
    const name = SPECIES_DEF[o.species] ? o.species : 'shrub';
    const key = `bush|${name}|${seed | 0}|${o.cardCap || 0}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const p = SPECIES_DEF[name];
    const s0 = cellSeed(worldSeed ^ 0xb05, seed | 0, 0x5b);
    const maxTris = clamp(o.maxTris || VEG.maxTrisBush, 200, VEG.maxTrisLOD0);
    const cardCap = o.cardCap ? clamp(o.cardCap | 0, VEG.cardsPerTwig[0], 64) : 0;
    const t0 = buildTier(name, p, s0, maxTris, 0, cardCap);
    const t1 = buildTier(name, p, s0, Math.max(220, Math.floor(maxTris * 0.35)), 1, cardCap);

    const k1 = lodDetail && lodDetail[1] ? lodDetail[1].distanceK : 8;
    const rec = {
      species: name,
      seed: seed | 0,
      trunk: t0.trunk,
      canopy: t0.canopy,
      height: t0.height,
      radius: t0.radius,
      tris: t0.tris,
      lodTiers: [
        { lod: 0, distance: 0, trunk: t0.trunk, canopy: t0.canopy, tris: t0.tris },
        { lod: 1, distance: k1 * t0.radius, trunk: t1.trunk, canopy: t1.canopy, tris: t1.tris },
      ],
      /** ⭐ THE DECLARED END OF THIS PROTOTYPE. There is no tier past `lodTiers[1]` and there is
       *  not meant to be (the block above); this is the distance a consumer should stop drawing
       *  it, published as data so nobody has to quote a comment. */
      cullDistance: VEG.bushCullMetres,
      materials: { bark: barkMaterial(), leaf: leafMaterial() },
    };
    _counters.bushes++;
    cache.set(key, rec);
    return rec;
  }

  /** `grassClump()` — 3 blades × 8 tris, bent normals baked in. Instance it; do not build one per
   *  blade. Bind with `handle.materials.grass`. */
  function grassClump(o = EMPTY) {
    if (disposed) throw new Error('[kitVeg] grassClump() after dispose()');
    const key = `clump|${o.seed | 0}|${o.blades | 0}|${o.quads | 0}|${o.height || 0}|${o.dry || 0}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const geo = finishGeometry(buildGrassClump(o), false);
    cache.set(key, geo);
    return geo;
  }

  /** `grassCard()` — the 25–60 m LOD1 band: 6 painted blades on 2 crossed quads, on the LEAF
   *  material (same atlas, same draw-call family). */
  function grassCard(o = EMPTY) {
    if (disposed) throw new Error('[kitVeg] grassCard() after dispose()');
    const key = `card|${o.width || 0}|${o.height || 0}`;
    const hit = cache.get(key);
    if (hit) return hit;
    ensureAtlas();
    const geo = finishGeometry(buildGrassCard(o), true);
    cache.set(key, geo);
    return geo;
  }

  /** `leafAtlas()` — {map, normalMap, size, tile, cols, rows, TILE}. Baked on first call. */
  function leafAtlas() { return ensureAtlas(); }

  /* --- wind + sun driving ------------------------------------------------------------------ */

  /**
   * @param {number} directionRad compass direction the wind BLOWS TOWARD, radians about +Y
   * @param {number} strength     0 = still, 1 = the authored 0.35 m bend, >1 = a gale
   */
  function setWind(directionRad, strength) {
    const v = uVegWind.value;
    if (directionRad !== undefined) { v.x = Math.cos(directionRad); v.y = Math.sin(directionRad); }
    if (strength !== undefined) v.z = clamp(strength, 0, 4);
    return v;
  }

  /** Drive from a weather record: `WEATHER[type].windMps`. Beaufort-ish: 12 m/s is the authored
   *  full-scale bend, above which grass lies flat and the sagitta clamp takes over. */
  function setWindMps(mps, directionRad) { return setWind(directionRad, clamp(mps / 12, 0, 4)); }

  /**
   * The sun, for the two-sided transmission term. `color` must already be PRE-EXPOSED (D1) — the
   * same value that went into `DirectionalLight.color × intensity`, or backlit leaves will be four
   * orders of magnitude too bright in the HDR buffer.
   */
  function setSun(dirWorld, colorPreExposed, visibility) {
    sunSource = 'explicit';
    if (dirWorld) {
      const l = Math.max(1e-6, Math.hypot(dirWorld.x, dirWorld.y, dirWorld.z));
      uVegSun.value.set(dirWorld.x / l, dirWorld.y / l, dirWorld.z / l, uVegSun.value.w);
    }
    if (colorPreExposed) uVegSunColor.value.set(colorPreExposed.x ?? colorPreExposed.r, colorPreExposed.y ?? colorPreExposed.g, colorPreExposed.z ?? colorPreExposed.b);
    if (visibility !== undefined) uVegSun.value.w = saturate(visibility);
    return uVegSun.value;
  }

  /** Pre-exposed SKY illuminance for the V8b through-the-leaf skylight term. */
  function setSky(illuminancePreExposed, transmittance) {
    if (illuminancePreExposed !== undefined) {
      const v = illuminancePreExposed;
      if (typeof v === 'number') uVegSky.value.set(v, v, v, uVegSky.value.w);
      else uVegSky.value.set(v.x ?? v.r, v.y ?? v.g, v.z ?? v.b, uVegSky.value.w);
    }
    if (transmittance !== undefined) uVegSky.value.w = saturate(transmittance);
    return uVegSky.value;
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // ⛔⛔ V9 — A SETTER NOBODY CALLS IS A UNIFORM NOBODY SETS. (measured 2026-07-28)
  //
  // `setSun` shipped correct, documented, and NEVER CALLED — grep `setSun` across `src/` and the
  // only hits are this file. So on the shipped build the transmission term ran against the
  // CONSTRUCTOR DEFAULTS. Measured live in `city @ drive_cam`, through `tools/_w6_veg.mjs`:
  //
  //     veg  sunDir = [0.400, 0.820, 0.410]   colour = [1.000, 0.970, 0.920]
  //     tod  sunDir = [0.742, 0.670, 0.028]   pre-exposed sun illuminance = 2.6995
  //     >>   direction error 30.99 deg        radiance ratio 0.359
  //
  // The shader compiled, ran, added its term, and passed every wall in `selfTest` — for a sun 31
  // degrees away from the one in the sky, at a third of its brightness. The backscatter lobe is
  // pow(...,8), i.e. a ~25 degree cone, so a 31 degree error does not dim it: it MISSES.
  //
  // ⭐ THE ROOT IS THE DIRECTION OF THE DEPENDENCY, not the missing call. A module that can only
  // be PUSHED its inputs is broken by every integrator who does not know it exists, and the bug is
  // invisible because nothing is undefined and nothing throws. So this module now ACQUIRES the
  // sun instead of waiting for it: `update()` reads `tod` from the registry it was handed, once,
  // and mirrors it every frame. `setSun`/`setSky` still win outright and permanently (they set
  // `sunSource = 'explicit'`), so an integrator who does drive it is never overridden.
  //
  // `stats().sunSource` reports which path fed the frame — 'default' is now a REPORTABLE DEFECT
  // rather than a silent one, and `selfTest` asserts a veg built with a tod-bearing registry never
  // leaves it there.
  // ════════════════════════════════════════════════════════════════════════════════════════════

  /** Mirror one tod evaluation into the foliage uniforms. Physical -> pre-exposed here (D1), so
   *  the caller never has to know the convention. Zero allocation: scalar writes only. */
  function setSunFromTod(tod) {
    if (!tod) return false;
    const dir = tod.sunDirection;
    const pre = tod.preExposure;
    if (!dir || !(pre > 0)) return false;
    const l = Math.max(1e-6, Math.hypot(dir.x, dir.y, dir.z));
    const s = uVegSun.value;
    s.x = dir.x / l; s.y = dir.y / l; s.z = dir.z / l;
    // Visibility: the sun is gone below the horizon and fades through the last few degrees rather
    // than snapping, which is what the term is gated on at dusk.
    s.w = saturate((tod.sunElevationDeg + 2) / 6);
    const e = Math.max(0, tod.sunIlluminance) * pre;
    // Warm the transmitted sun the way the sky already warms the direct one. The hue comes from
    // tod's own key colour when it exposes one; otherwise the D65-ish neutral it was authored at.
    const c = uVegSunColor.value;
    c.x = e; c.y = e * 0.985; c.z = e * 0.955;
    const skyE = Math.max(0, tod.skyIlluminance) * pre;
    const k = uVegSky.value;
    k.x = skyE * 0.86; k.y = skyE * 0.93; k.z = skyE;   // skylight is blue; the leaf tints it green
    return true;
  }

  /**
   * `update(dt)` — the ONLY per-frame entry point. Advances `simTime`, which is an ACCUMULATED dt
   * sum and never a clock read (D4/D5): a deterministic replay reproduces the wind frame for frame,
   * and the grass-determinism gate's "screenshot, drive 600 m, come back" comparison holds because
   * phase is a function of absolute simTime, not of when the cell loaded.
   *
   * ZERO allocation: three scalar writes into pre-existing Vector4s.
   */
  function update(dt) {
    // V9 — acquire the sun rather than wait to be pushed it. The registry lookup happens at most
    // once per frame and stops entirely the moment it succeeds (the handle is cached) or the
    // moment an integrator calls setSun (sunSource === 'explicit').
    if (sunSource !== 'explicit') {
      if (!todRef && opts.registry && typeof opts.registry.get === 'function') {
        try { todRef = opts.registry.get('tod') || null; } catch (e) { void e; todRef = null; }
      }
      if (todRef && setSunFromTod(todRef)) sunSource = 'tod';
    }
    const step = dt > 0 ? (dt < 0.25 ? dt : 0.25) : 0;   // D5's frameDt clamp, mirrored
    const v = uVegWind.value;
    v.w += step;
    // Keep simTime bounded. At 1e5 s a float32 uniform has 8 ms of resolution left and the 1.9 Hz
    // term starts to stutter; 4096 is a whole number of gust-texture wraps at 0.6 m/s / 24 m
    // (0.6·4096/24 = 102.4 tiles) so the wrap is invisible.
    if (v.w > 4096) v.w -= 4096;
    _counters.updates++;
    return v.w;
  }

  /* --- placement (D4 — the grass-determinism gate lives here) ------------------------------ */

  const placement = {
    /**
     * Hash-jittered grid, the Horizon-Zero-Dawn / GTA model:
     *     p = cellOrigin + ( vec2(i,j) + vec2(hash(i,j), hash(j,i)) ) · spacing
     * O(1) per point, no Poisson pass, and — the part that matters — DETERMINISTIC PER CELL, so a
     * cell regenerates identically and the grass never "moves" when the player drives back.
     *
     * Writes stride-4 records into `out`: [x, z, hashA, hashB]. The two hashes are handed back so
     * the caller can derive yaw/scale/species from the same deterministic source without a second
     * PRNG. Terrain height, slope rejection and road/building masks belong to the world module —
     * pass `accept(x, z, hashA, hashB)` to apply them.
     *
     * @returns {number} the number of records written (≤ out.length / 4)
     */
    grid(out, cellX, cellZ, cellSize, spacing, o = EMPTY) {
      const seed = cellSeed(o.worldSeed === undefined ? worldSeed : o.worldSeed, cellX, cellZ);
      const n = Math.max(1, Math.floor(cellSize / spacing));
      const ox = cellX * cellSize;
      const oz = cellZ * cellSize;
      const jitter = o.jitter === undefined ? 0.85 : saturate(o.jitter);
      const accept = typeof o.accept === 'function' ? o.accept : null;
      const cap = Math.floor(out.length / 4);
      let w = 0;
      for (let j = 0; j < n && w < cap; j++) {
        for (let i = 0; i < n && w < cap; i++) {
          const ha = hashF(i, j, seed);
          const hb = hashF(j, i, seed ^ 0x5bd1e995);
          const x = ox + (i + 0.5 + (ha - 0.5) * jitter) * spacing;
          const z = oz + (j + 0.5 + (hb - 0.5) * jitter) * spacing;
          if (accept && !accept(x, z, ha, hb)) continue;
          const k = w * 4;
          out[k] = x; out[k + 1] = z; out[k + 2] = ha; out[k + 3] = hb;
          w++;
        }
      }
      return w;
    },

    /**
     * A MeshSurfaceSampler with the seeded generator INSTALLED — the only way to get one out of
     * this module.
     *
     * ⚠️ VERIFIED at MeshSurfaceSampler.js:162: `this.randomFunction = Math.random` unless
     * `setRandomGenerator` is called. Every reload puts the props somewhere else, and the player
     * sees it the first time they drive back down a road. This wrapper exists so that failure mode
     * is not reachable from this codebase.
     *
     * Use it for SCATTERED props (trees, bushes, rocks). Use `grid()` for the 160 k grass blades —
     * the sampler is a JS call per instance and a binary search per sample.
     */
    sampler(mesh, seed, weightAttribute) {
      const s = new MeshSurfaceSampler(mesh);
      if (weightAttribute) s.setWeightAttribute(weightAttribute);
      s.setRandomGenerator(mulberry32(cellSeed(worldSeed, (seed | 0) || 1, 0x5a3)));
      s.build();
      return s;
    },

    /** [RAGE §Foliage] 40 blades/m² to 25 m, 12/m² to 60 m, 0 beyond. */
    densityAt(distance) {
      if (distance <= VEG.grassRingNear) return VEG.grassDensityNear;
      if (distance <= VEG.grassRingFar) return VEG.grassDensityFar;
      return 0;
    },

    /** Slope rejection helper: `true` if a blade may stand on this normal (≤ 38°). */
    slopeOk(normalY) { return normalY >= VEG.slopeMaxCos; },
  };

  /* --- stats + teardown --------------------------------------------------------------------- */

  /**
   * ⚠️ The build counters are MODULE-GLOBAL, not per-handle, and that is deliberate: during a hot
   * swap two `createVeg` handles coexist, and what the memory ledger needs to see is the TOTAL
   * outstanding vegetation, not one scene's half of it. They are monotonic, so — exactly like
   * `renderer.info.memory` — their real value is as a leak canary: counts that keep climbing while
   * the player stands still mean a `dispose()` is missing upstream.
   */
  function stats() {
    return {
      // Zero per-frame GPU/CPU work of our own: `update()` is three scalar writes into shared
      // uniform holders, and every emitter runs at build time (ARCH §4 rule 5).
      ms: 0,
      trees: _counters.trees,
      bushes: _counters.bushes,
      clumps: _counters.clumps,
      cards: _counters.cards,
      tubes: _counters.tubes,
      geometries: _counters.geometries,
      triangles: _counters.triangles,
      bytes: _counters.bytes,
      textureBytes: _counters.textureBytes,
      textureMB: _counters.textureBytes / (1024 * 1024),
      updates: _counters.updates,
      materials: (mats.bark ? 1 : 0) + (mats.leaf ? 1 : 0) + (mats.grass ? 1 : 0) + depthMats.size,
      atlasBaked: !!atlas,
      barkBaked: !!bark,
      simTime: uVegWind.value.w,
      wind: uVegWind.value.z,
      cached: cache.size,
      /** V9 — which path fed the foliage sun this frame. 'default' is a DEFECT: the frame was
       *  shaded against the constructor's placeholder direction and radiance. */
      sunSource,
      sunDir: [uVegSun.value.x, uVegSun.value.y, uVegSun.value.z],
      sunVisibility: uVegSun.value.w,
      sunPreExposed: [uVegSunColor.value.x, uVegSunColor.value.y, uVegSunColor.value.z],
      skyPreExposed: [uVegSky.value.x, uVegSky.value.y, uVegSky.value.z],
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const v of cache.values()) {
      if (v && v.isBufferGeometry) { v.dispose(); continue; }
      if (v && v.trunk) v.trunk.dispose();
      if (v && v.canopy) v.canopy.dispose();
      if (v && v.lodTiers) {
        for (let i = 1; i < v.lodTiers.length; i++) {
          const t = v.lodTiers[i];
          if (t.trunk) t.trunk.dispose();
          if (t.canopy) t.canopy.dispose();
        }
      }
    }
    cache.clear();
    for (const k of Object.keys(mats)) if (mats[k]) { mats[k].dispose(); mats[k] = null; }
    for (const m of depthMats.values()) m.dispose();
    depthMats.clear();
    if (atlas) { atlas.map.dispose(); atlas.normalMap.dispose(); atlas = null; }
    if (bark) { bark.albedo.dispose(); bark.normal.dispose(); bark.orm.dispose(); bark = null; }
    if (uVegGust.value) { uVegGust.value.dispose(); uVegGust.value = null; }
  }

  const handle = {
    // --- the module contract ---
    tree, bush, grassClump, leafAtlas, windUniforms, update, SPECIES, stats,
    /** §1b — the fallen form (proto 8 `deadwood`'s named repair). Trunk-only record, two tiers,
     *  finite cull, no canopy and no billboard by design. */
    deadfall,
    /** ⭐ E-BIOME FOREST 2026-09-05 — THE WINDTHROW SET and THE UNDERGROWTH, the two vocabulary
     *  holes `BIOME_SCOPE.md` FOR-2/FOR-3 measured. `snag`/`rootPlate` complete the deadfall set
     *  on the SAME bark material (zero new draw-call families); `fern`/`fernCard` are the real
     *  understorey `placeGroundcover` was aliasing onto tall grass, on the SAME leaf material as
     *  the canopy (zero new programs). See each function's block for what it is and what it is
     *  honestly not. */
    snag, rootPlate, fern, fernCard,

    // --- additive, all documented above ---
    grassCard,
    depthMaterial,
    applyWind,
    setWind, setWindMps, setSun, setSky, setSunFromTod,
    placement,
    SPECIES_NAMES,
    VEG, WIND, TILE,
    /** Bind these to the geometries `tree`/`bush`/`grassClump` return. */
    materials: {
      get bark() { return barkMaterial(); },
      get leaf() { return leafMaterial(); },
      get grass() { return grassMaterial(); },
    },
    /** The raw GLSL, so gfx/prepass.js injects the byte-identical displacement (see §F). */
    shader: Object.freeze({
      WIND_PARS_VERTEX, WIND_BODY_VERTEX,
      FOLIAGE_PARS_FRAGMENT, FOLIAGE_NORMAL_FRAGMENT, FOLIAGE_TRANSLUCENT_FRAGMENT,
      vertexEdits: VERTEX_EDITS, fragmentEdits: FOLIAGE_FRAGMENT_EDITS,
    }),
    get disposed() { return disposed; },
    dispose,
    deps: { materials, meshops, rng: stream },
  };

  if (opts.registry && typeof opts.registry.provide === 'function') opts.registry.provide('veg', handle);
  return handle;
}

export default createVeg;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Acceptance self-test
//
// Wave 2 produces no renderable frame, so it gates on its own unit criteria. This ASSERTS named
// PASS/FAIL invariants against numbers predicted from the dossier — it does not dump values to be
// eyeballed (`feedback_probes_must_assert_not_observe`). The by-eye and screenshot gates
// (grass coherence, grass determinism, silhouette Q ≥ 3.0) run later, on a real frame.
//
//   node -e "import('./src/geo/kitVeg.js').then(m=>console.log(JSON.stringify(m.selfTest(),null,2)))"
//   (needs an import map for the bare 'three' specifier; tools/check.mjs covers static validation)
// ══════════════════════════════════════════════════════════════════════════════════════════════

export function selfTest() {
  const failures = [];
  let checks = 0;
  const check = (name, ok, detail) => { checks++; if (!ok) failures.push({ name, detail }); };

  const veg = createVeg(null, null, mulberry32(1), { seed: 0xA3D, anisotropy: 4 });

  // 1 — the pipe model. childBase / parentBase must equal (1/n)^(1/2.3) for every species.
  for (const name of SPECIES_NAMES) {
    const p = SPECIES_DEF[name];
    const n = p.children[0];
    const expected = Math.pow(1 / n, 1 / 2.3);
    check(`pipeModel.${name}`, Math.abs(Math.pow(1 / n, 1 / p.radiusExponent) - expected) < 1e-12,
      `radiusExponent ${p.radiusExponent} ≠ 2.3`);
  }

  // 2 — THE TRIANGLE CAP. Every species, several seeds, LOD0 ≤ 7000 (module contract).
  let worst = 0;
  for (const name of SPECIES_NAMES) {
    for (let s = 1; s <= 4; s++) {
      const t = veg.tree(name, s * 37);
      worst = Math.max(worst, t.tris);
      check(`triBudget.${name}.${s}`, t.tris <= VEG.maxTrisLOD0, `${t.tris} > ${VEG.maxTrisLOD0}`);
      check(`lodShrinks.${name}.${s}`, t.lodTiers[1].tris < t.lodTiers[0].tris,
        `LOD1 ${t.lodTiers[1].tris} not below LOD0 ${t.lodTiers[0].tris}`);
      check(`lodDistances.${name}.${s}`,
        t.lodTiers[0].distance < t.lodTiers[1].distance && t.lodTiers[1].distance < t.lodTiers[2].distance,
        'LOD switch distances are not monotonic');
    }
  }

  // ⭐ 2b — THE PUBLISHED END OF A PROTOTYPE. A REFUTATION, WALLED SO IT STAYS ONE.
  //
  // `bush()` publishing only two tiers is not an omission — `scenes/sandbox.js:524-530` and
  // `scenes/forest.js:1639-1641` both had to learn, from a rendered frame, that clamping a bush to
  // the last authored tier speckles the horizon with white cones. What WAS missing is that the
  // limit lived in prose, and `sandbox.js:454` copied it into a literal (`CULL_BUSH_M = 42`).
  // These assert the shape of the contract in both directions: a two-tier record must declare
  // where it ends, and a three-tier one must declare that it does not.
  {
    const b = veg.bush(31);
    check('bush.twoTiersOnly', b.lodTiers.length === 2 && b.lodTiers[2] === undefined,
      `bush publishes ${b.lodTiers.length} tiers — a billboard tier here is the white-cone frame again`);
    check('bush.declaresItsCullDistance',
      Number.isFinite(b.cullDistance) && b.cullDistance > b.lodTiers[1].distance,
      `bush cullDistance ${b.cullDistance} is not a finite distance beyond its last tier (${b.lodTiers[1].distance.toFixed(1)} m)`);
    check('bush.cullDistanceMatchesTheShippedConsumers', b.cullDistance === VEG.bushCullMetres && VEG.bushCullMetres === 42,
      `VEG.bushCullMetres is ${VEG.bushCullMetres}; scenes/sandbox.js ships CULL_BUSH_M = 42 and would silently diverge`);
    const t = veg.tree('oak', 3);
    check('tree.declaresNoCull', t.cullDistance === null && t.lodTiers.length === 3,
      'a tree publishes a billboard tier, so its cullDistance must be null (draw it to the horizon)');

    // §1b — THE DEADFALL'S CONTRACT, the same shape discipline: it must actually LIE DOWN (a log
    // that grew upward is the defect the whole form exists to end), spread along the ground, ship
    // exactly two trunk-only tiers, and declare a finite cull like every non-billboard record.
    const d = veg.deadfall(17);
    let dMaxY = 0;
    {
      const dp = d.trunk.attributes.position.array;
      for (let i = 1; i < dp.length; i += 3) if (dp[i] > dMaxY) dMaxY = dp[i];
    }
    check('deadfall.liesDown', dMaxY <= 1.3 && d.radius >= 1.0,
      `deadfall peaks at y=${dMaxY.toFixed(2)}m with ground reach ${d.radius.toFixed(2)}m — `
      + 'a fallen log is long and low, never tall');
    check('deadfall.trunkOnlyTwoTiers',
      d.lodTiers.length === 2 && d.canopy === null
      && d.lodTiers.every((tier) => tier.canopy === null && tier.trunk),
      `deadfall tiers=${d.lodTiers.length}, canopy=${!!d.canopy} — a dead log wearing leaf cards `
      + 'or a billboard is the exact wrong answer');
    check('deadfall.declaresItsCullDistance',
      Number.isFinite(d.cullDistance) && d.cullDistance > d.lodTiers[1].distance,
      `deadfall cullDistance ${d.cullDistance} is not finite beyond its last tier`);
  }

  // 3 — DETERMINISM (D4 / the grass-determinism gate). Same seed → byte-identical positions, and
  //     crucially it must NOT matter how many other trees were built in between.
  {
    const a = veg.tree('birch', 909);
    veg.tree('pine', 12); veg.tree('willow', 13); veg.tree('oak', 14);
    const veg2 = createVeg(null, null, mulberry32(999), { seed: 0xA3D, anisotropy: 4 });
    veg2.tree('oak', 5);
    const b = veg2.tree('birch', 909);
    const pa = a.trunk.attributes.position.array;
    const pb = b.trunk.attributes.position.array;
    let same = pa.length === pb.length;
    if (same) for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) { same = false; break; }
    check('determinism.callOrderIndependent', same, 'same seed produced different geometry');
    veg2.dispose();
  }

  // 4 — V3: every canopy normal is unit length AND biased toward the centroid. A card that kept its
  //     raw face normal would have dot(n, v−C) near 0 on the cards perpendicular to the radius.
  {
    const t = veg.tree('oak', 3);
    const n = t.canopy.attributes.normal.array;
    const p = t.canopy.attributes.position.array;
    const c = t.canopy.userData.canopy.centroid;
    let unit = true; let minDot = 1; let bad = 0;
    for (let i = 0; i < n.length; i += 3) {
      const L = Math.hypot(n[i], n[i + 1], n[i + 2]);
      if (Math.abs(L - 1) > 1e-3) unit = false;
      const dx = p[i] - c[0], dy = p[i + 1] - c[1], dz = p[i + 2] - c[2];
      const dl = Math.max(1e-6, Math.hypot(dx, dy, dz));
      const d = (n[i] * dx + n[i + 1] * dy + n[i + 2] * dz) / dl;
      if (d < minDot) minDot = d;
      if (d < 0.30) bad++;
    }
    check('sphereNormal.unit', unit, 'canopy normals are not normalised');
    // With an 0.20 card blend the worst case is a card whose own normal is fully anti-radial:
    // mix(1, −1, 0.2) = 0.6 before renormalisation, so nothing should fall below ~0.55.
    check('sphereNormal.radialBias', bad === 0, `${bad} canopy vertices below dot 0.30 (min ${minDot.toFixed(3)})`);
  }

  // ⭐⭐ 4b — THE LOD2 BILLBOARD. THE FOUR WALLS THAT DID NOT EXIST.
  //
  // Every check above this line looks at LOD0, and the LOD2 card was the one leaf geometry in the
  // file exempt from all of them — which is how it kept a floating, trunkless crown and a
  // constant per-quad normal through every wave. Ask law 2's question: what would this look like
  // if it were broken? It would look like a correct atlas, a correct tint and a green LOD0 tree,
  // and every existing check would stay green. So the walls have to be on the DISTANT tier's own
  // silhouette and its own shading.
  {
    const SUN_EL = 13 * DEG2RAD;             // the grazing sun the ridgeline defect was reported at
    const Ly = Math.sin(SUN_EL), Lh = Math.cos(SUN_EL);
    let worstGapPx = 0;
    for (const name of SPECIES_NAMES) {
      const t = veg.tree(name, 3);
      const tier = t.lodTiers[2];
      const g = tier.canopy;
      const p = g.attributes.position.array;
      const n = g.attributes.normal.array;
      const th = g.attributes.aVegThick.array;
      const w = g.attributes.aWind.array;
      const verts = g.attributes.position.count;
      const ud = g.userData.aaa || {};

      // (1) THE FIELD MUST BE READ FROM THE GEOMETRY. `lodTiers[2].tris` was the literal 6 for the
      //     life of the file; a literal that happens to be right is not a measurement.
      check(`billboard.trisFromGeometry.${name}`, tier.tris === g.index.count / 3,
        `lodTiers[2].tris ${tier.tris} vs geometry ${g.index.count / 3}`);
      check(`billboard.triBudget.${name}`, tier.tris === 10 && ud.crownTris === 6 && ud.boleTris === 4,
        `${tier.tris} tris (crown ${ud.crownTris}, bole ${ud.boleTris}) — the tier is 3 crown quads + a 2-quad bole`);

      // (2) THE SILHOUETTE REACHES THE GROUND. The defect was a crown starting at 0.20 x height
      //     with nothing under it — 11.8 px of daylight for an oak at its 161 m switch distance,
      //     34.6 px for a poplar at 62.9 m. The second half of the check is what gives the first
      //     half teeth: the gap it closes has to be worth closing.
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < p.length; i += 3) { if (p[i + 1] < minY) minY = p[i + 1]; if (p[i + 1] > maxY) maxY = p[i + 1]; }
      check(`billboard.reachesGround.${name}`, minY === 0,
        `lowest vertex at y=${minY.toFixed(3)} — the crown floats`);
      /* The teeth, and they have to be in PIXELS, not metres — the first draft compared
         0.20 x height against 0.8 m and `shrub` (1.21 m tall) failed it, reading as "too small to
         matter". It is not: a tier's switch distance scales with the CROWN RADIUS, so a small
         prototype switches close and its gap is just as large on screen. Through the streamer's
         own projection (`screenPx = h * viewportH / (dist * 2 * tanHalf)`, 900 px, 60 deg vertical
         FOV) the gap the old card left measures 34.6 px on a poplar, 21.5 px on a shrub, 11.8 px
         on an oak and 5.2 px on the willow — the willow is the honest floor, because a 7.0 m tree
         with an 8.4 m crown radius does not switch until 210 m. */
      const TAN_HALF = Math.tan(30 * DEG2RAD);
      const gapPx = (t.height * 0.20 * 900) / Math.max(1, tier.distance * 2 * TAN_HALF);
      if (gapPx > worstGapPx) worstGapPx = gapPx;
      check(`billboard.gapWasWorthClosing.${name}`, gapPx >= 4,
        `the gap this wall closes is only ${gapPx.toFixed(1)} px at the ${tier.distance.toFixed(0)} m switch — too small for the wall to mean anything`);
      // The bole top must sit ABOVE the crown card's bottom, or the two meet at a butt joint that
      // opens into a 1 px seam the moment either end moves or a vertex snaps.
      check(`billboard.boleOverlapsCrown.${name}`, maxY > t.height * 1.0 && t.height * 0.34 > t.height * 0.20,
        'bole and crown do not overlap');

      // (3) V3 ON THE CARD. Two invariants, and the SECOND is the one that fails the old geometry:
      //     unit length was always true, a normal that VARIES across the card never was.
      let unit = true, minRadial = 1, worstQuadSpread = -1;
      const yc = (t.height * 0.20 + t.height * 1.02) * 0.5;
      /* The reference SURFACE is per-species (R3 follow-through): a needle billboard is a CONE
         (taper NEEDLE_BILLBOARD_TAPER), so its expected transfer is horizontally radial off the
         axis with the cone's up-tilt — measuring a cone's normals against a centroid-sphere would
         re-file the exact red this fixed, with the sign flipped. */
      const isNeedle = SPRIG[name] && SPRIG[name].shape === 'needle';
      let crownR = 0;
      for (let i = 0; i < 12; i++) crownR = Math.max(crownR, Math.hypot(p[i * 3], p[i * 3 + 2]));
      const coneTilt = (crownR * NEEDLE_BILLBOARD_TAPER) / Math.max(0.01, t.height * 1.02 - t.height * 0.20);
      for (let i = 0; i < 12; i++) {            // the 12 crown corners; the bole is 12..19
        const i3 = i * 3;
        if (Math.abs(Math.hypot(n[i3], n[i3 + 1], n[i3 + 2]) - 1) > 1e-4) unit = false;
        let dx, dy, dz;
        if (isNeedle) {
          const hl = Math.max(1e-6, Math.hypot(p[i3], p[i3 + 2]));
          const hn = 1 / Math.hypot(1, coneTilt);
          dx = (p[i3] / hl) * hn; dy = coneTilt * hn; dz = (p[i3 + 2] / hl) * hn;
        } else {
          dx = p[i3]; dy = p[i3 + 1] - yc; dz = p[i3 + 2];
        }
        const dl = Math.max(1e-6, Math.hypot(dx, dy, dz));
        const d = (n[i3] * dx + n[i3 + 1] * dy + n[i3 + 2] * dz) / dl;
        if (d < minRadial) minRadial = d;
      }
      for (let q = 0; q < 3; q++) {
        let worst = 1;
        for (let i = 0; i < 4; i++) {
          for (let j = i + 1; j < 4; j++) {
            const a3 = (q * 4 + i) * 3, b3 = (q * 4 + j) * 3;
            const d = n[a3] * n[b3] + n[a3 + 1] * n[b3 + 1] + n[a3 + 2] * n[b3 + 2];
            if (d < worst) worst = d;
          }
        }
        if (worst > worstQuadSpread) worstQuadSpread = worst;
      }
      check(`billboard.normalsUnit.${name}`, unit, 'billboard normals are not normalised');
      // Same bound as `sphereNormal.radialBias`: a 0.20 blend against a fully anti-radial card
      // normal bottoms out near 0.55, so 0.30 is the floor with headroom either side.
      check(`billboard.sphereTransferred.${name}`, minRadial >= 0.30,
        `worst crown normal is only ${minRadial.toFixed(3)} radial — this card kept a face normal`);
      /* ⭐ THE ONE THAT WOULD HAVE CAUGHT IT, AND THE FIRST DRAFT OF IT DID NOT.
         The defect is that all FOUR corners of a quad carried one identical normal, so a whole
         quad had a single lighting answer. Draft one asserted a spread in n.y > 0.8, and `willow`
         failed it honestly: a 7.0 m tree with a 17.7 m crown has near-horizontal corner radials
         and only 0.602 of n.y spread, which is CORRECT for a squat crown — the wall was measuring
         crown shape, not the defect. The defect-shaped quantity is the angle between corners
         WITHIN a quad: diagonal corners sit on opposite sides of the centroid, so their radials
         are near-opposite for any aspect ratio (measured min dot -0.88 for both the oak and the
         willow) and the old geometry scored exactly +1.000 on every quad. */
      check(`billboard.quadNormalsDiverge.${name}`, worstQuadSpread <= 0.0,
        `the least-varying crown quad has all four corner normals within dot ${worstQuadSpread.toFixed(3)} — that quad shades as one flat value`);

      // (4) ⭐⭐ THE CARD IS NEVER UNLIT. Sweep the sun azimuth at 13 deg elevation and require
      //     that the crown always has a lit limb. MEASURED on the old geometry: at sun azimuth 0
      //     the brightest of all twelve vertices reached N.L = 0.0052 and the one quad still
      //     carrying a positive term was exactly edge-on to a viewer standing at that azimuth —
      //     screen-weighted, the brightest texel on the whole tree was 0.0000. This bound is 38x
      //     the old geometry's 0.0052; the shipped species clear it by 2.11x (poplar, the
      //     narrowest crown) to 3.64x (willow, the widest).
      let worstBrightest = 1;
      let worstLitQuads = 3;
      for (let a = 0; a < 72; a++) {
        const phi = (a / 72) * TAU;
        const lx = Lh * Math.cos(phi), lz = Lh * Math.sin(phi);
        let brightest = 0;
        let litQuads = 0;
        for (let q = 0; q < 3; q++) {
          let quadMax = 0;
          for (let k = 0; k < 4; k++) {
            const i3 = (q * 4 + k) * 3;
            const d = n[i3] * lx + n[i3 + 1] * Ly + n[i3 + 2] * lz;
            if (d > quadMax) quadMax = d;
          }
          if (quadMax > brightest) brightest = quadMax;
          if (quadMax >= 0.15) litQuads++;
        }
        if (brightest < worstBrightest) worstBrightest = brightest;
        if (litQuads < worstLitQuads) worstLitQuads = litQuads;
      }
      check(`billboard.neverUnlit.${name}`, worstBrightest >= 0.20,
        `at the worst sun azimuth the brightest vertex on the card is ${worstBrightest.toFixed(4)}`);
      // Two of three, because the viewer can always be standing where one of them is edge-on.
      check(`billboard.litQuadIsNeverTheHiddenOne.${name}`, worstLitQuads >= 2,
        `only ${worstLitQuads} of 3 crown quads carry any sun at the worst azimuth — the lit one can be the edge-on one`);

      // (5) THE BOLE. Wood does not transmit and a bole does not sway; both are attributes, both
      //     are silently wrong-able, and both change the frame.
      let boleThick = 0, boleBend = 0, boleArm = Infinity, crownThick = 0;
      for (let i = 12; i < verts; i++) {
        boleThick += Math.abs(th[i]);
        boleBend += Math.abs(w[i * 4]) + Math.abs(w[i * 4 + 2]);
        boleArm = Math.min(boleArm, w[i * 4 + 3]);
      }
      for (let i = 0; i < 12; i++) crownThick += th[i];
      check(`billboard.boleDoesNotTransmit.${name}`, boleThick === 0 && crownThick > 0,
        `bole aVegThick sum ${boleThick} (must be 0), crown ${crownThick.toFixed(2)} (must be > 0)`);
      check(`billboard.boleDoesNotSway.${name}`, boleBend === 0,
        'the bole carries a non-zero wind amplitude — a trunk that bends opens the joint with the crown');
      check(`billboard.boleArmIsPositive.${name}`, boleArm > 0.02,
        `bole aWind.w is ${boleArm} — the shader's max(aWind.w, 0.02) would be doing the work`);
      // The bole's normals are the CYLINDER transfer: horizontal, and spread across the ring.
      let boleNyMax = 0, boleAzSpread = 0;
      const az = [];
      for (let i = 12; i < verts; i++) {
        boleNyMax = Math.max(boleNyMax, Math.abs(n[i * 3 + 1]));
        az.push(Math.atan2(n[i * 3 + 2], n[i * 3]));
      }
      for (let i = 0; i < az.length; i++) for (let j = i + 1; j < az.length; j++) {
        let d = Math.abs(az[i] - az[j]); if (d > PI) d = TAU - d;
        if (d > boleAzSpread) boleAzSpread = d;
      }
      check(`billboard.boleNormalsHorizontal.${name}`, boleNyMax < 1e-6,
        `bole normal.y reaches ${boleNyMax} — a bole is a vertical cylinder, its normals are horizontal`);
      check(`billboard.boleNormalsRing.${name}`, boleAzSpread > 2.6,
        `bole normals span only ${(boleAzSpread * 180 / PI).toFixed(1)} deg of azimuth — a sun on the other side leaves it black`);

      // (6) V7 ON THE BOLE, ON THE PRODUCT. Same law as `albedo.leafGreenInBand`, one sampler over:
      //     the bole is drawn over the atlas CORE, so `coreLinear x vertexColour` is the albedo the
      //     fragment gets and it must land on bark, above the rubric's 0.02 dielectric floor.
      const atl = veg.leafAtlas();
      const cAttr = g.getAttribute('color');
      const bc = [cAttr.getX(12), cAttr.getY(12), cAttr.getZ(12)];
      const want = [
        TINT.barkBase[0] * SPECIES_DEF[name].barkTint[0],
        TINT.barkBase[1] * SPECIES_DEF[name].barkTint[1],
        TINT.barkBase[2] * SPECIES_DEF[name].barkTint[2],
      ];
      const got = [atl.coreLinear[0] * bc[0], atl.coreLinear[1] * bc[1], atl.coreLinear[2] * bc[2]];
      check(`billboard.boleAlbedoIsBark.${name}`,
        Math.abs(got[0] - want[0]) < 1e-6 && Math.abs(got[1] - want[1]) < 1e-6 && Math.abs(got[2] - want[2]) < 1e-6,
        `bole effective albedo [${got.map((x) => x.toFixed(5))}] vs authored [${want.map((x) => x.toFixed(5))}]`);
      check(`billboard.boleAboveRubricFloor.${name}`, got[0] > 0.02 && got[1] > 0.02 && got[2] > 0.02,
        `bole effective albedo [${got.map((x) => x.toFixed(5))}] has a channel below the rubric's 0.02 dielectric floor`);
      // The bole's ONE clamp is on the PRODUCT, and no shipped species may reach it — if it ever
      // fires, a species table authored a bark brighter than a material can be and that is the
      // thing to fix, not a silently recoloured trunk. Birch, the brightest, sits at 0.616.
      check(`billboard.boleUnderEnergyCeiling.${name}`,
        Math.max(got[0], got[1], got[2]) < VEG.boleAlbedoCeiling - 1e-9,
        `bole peak albedo ${Math.max(got[0], got[1], got[2]).toFixed(4)} reached the ${VEG.boleAlbedoCeiling} energy ceiling`);
    }
    // The per-species bound above is set at the WILLOW's honest 5.2 px. This is the other half of
    // the same claim: somewhere in the shipping table the gap was large, so "the crown floated" is
    // a statement about the frame and not a technicality.
    check('billboard.someGapWasLarge', worstGapPx >= 10,
      `the largest gap the bole closes across the whole species table is ${worstGapPx.toFixed(1)} px`);
  }

  // 5 — V6: the grass bent normal. Every blade normal must have y ≥ the value the 0.62 bend
  //     guarantees for the most-folded blade (72° of arc → face normal y = cos 72° = 0.309).
  {
    const g2 = veg.grassClump({ seed: 4 });
    const n = g2.attributes.normal.array;
    let minY = 1; let unit = true;
    for (let i = 0; i < n.length; i += 3) {
      if (Math.abs(Math.hypot(n[i], n[i + 1], n[i + 2]) - 1) > 1e-4) unit = false;
      if (n[i + 1] < minY) minY = n[i + 1];
    }
    // WORST CASE is the sheath, where the face normal is fully HORIZONTAL (a vertical blade is a
    // vertical ribbon): mix(0, 1, 0.62) = 0.62 up against 0.38 sideways, normalised → 0.8526.
    // Anything materially below that means the bend was weakened, and the field goes noisy.
    check('bentNormal.unit', unit, 'grass normals are not normalised');
    check('bentNormal.upBias', minY >= 0.85, `min blade normal.y = ${minY.toFixed(3)}, expected ≥ 0.85 (the 0.62 bend at a horizontal face normal)`);
    check('bentNormal.notOverBent', minY <= 0.999, 'every normal is straight up — the face normal was discarded, not blended');
    check('grassTris', g2.index.count / 3 === VEG.bladesPerClump * VEG.bladeQuads * 2,
      `${g2.index.count / 3} tris, expected ${VEG.bladesPerClump * VEG.bladeQuads * 2}`);
  }

  // 6 — V5: the atlas is dilated and coverage-preserving.
  {
    const a = veg.leafAtlas();
    const mips = a.map.mipmaps;
    check('atlas.mipChain', mips.length === Math.log2(ATLAS.size) + 1, `${mips.length} levels`);
    // Dilation: no texel with alpha 0 may still be pure black inside the 8 px ring around a leaf.
    // Sample the ring by counting fully-black-and-transparent texels adjacent to an opaque one.
    const d0 = mips[0].data;
    const S = ATLAS.size;
    let halo = 0;
    for (let y = 1; y < S - 1; y += 3) {
      for (let x = 1; x < S - 1; x += 3) {
        const i = (y * S + x) * 4;
        if (d0[i + 3] > 8) continue;
        const rgt = ((y * S) + x + 1) * 4;
        if (d0[rgt + 3] > 128 && d0[i] === 0 && d0[i + 1] === 0 && d0[i + 2] === 0) halo++;
      }
    }
    check('atlas.dilated', halo === 0, `${halo} black transparent texels adjacent to opaque ones`);
    // Coverage preservation: mip 4's alpha-test coverage must stay within 10% of mip 0's.
    const cov = (lvl) => {
      let c = 0;
      const n = lvl.width * lvl.height;
      for (let i = 0; i < n; i++) if (lvl.data[i * 4 + 3] / 255 >= VEG.alphaTest) c++;
      return c / n;
    };
    const c0 = cov(mips[0]);
    const c4 = cov(mips[4]);
    check('atlas.coveragePreserved', Math.abs(c4 - c0) <= 0.10 * Math.max(0.02, c0),
      `mip0 ${c0.toFixed(4)} vs mip4 ${c4.toFixed(4)}`);

    // PER-TILE DENSITY. A card whose tile is mostly empty forces the canopy to buy its mass in
    // extra cards — 3× the geometry and 3× the alpha-test overdraw for the same silhouette.
    const T = ATLAS.tile;
    for (let ti = 0; ti < ATLAS.cols * ATLAS.rows; ti++) {
      const tx = (ti % ATLAS.cols) * T, ty = Math.floor(ti / ATLAS.cols) * T;
      let op = 0;
      for (let y = 0; y < T; y += 2) {
        for (let x = 0; x < T; x += 2) if (d0[((ty + y) * S + tx + x) * 4 + 3] / 255 >= VEG.alphaTest) op++;
      }
      const c = op / ((T / 2) * (T / 2));
      const floor = ti === TILE.canopyBlob ? 0.55 : 0.20;
      check(`atlas.tileDensity.${ti}`, c >= floor, `tile ${ti} coverage ${c.toFixed(3)} < ${floor}`);
    }

    // ⭐ 6a-bis — THE BOLE SAMPLER, RE-DERIVED FROM THE SHIPPED BYTES.
    //
    // `solidCoreOf` returns `deepestLevel` and it would be trivial to assert that field and call
    // it proven — which is precisely the "a gate that reports success about itself" shape. So this
    // re-walks the rect the atlas PUBLISHED, plus its one-texel guard band, at every level, out of
    // the mip data the GPU will actually sample. If the search's bookkeeping and its output ever
    // disagree, this fails and the search's own field does not.
    check('atlas.coreExists', !!a.coreUV && !!a.coreLinear,
      'no opaque core found in the canopy tile — the LOD2 bole cannot be drawn');
    if (a.coreUV) {
      const tileX = TILE.canopyBlob % ATLAS.cols, tileY = Math.floor(TILE.canopyBlob / ATLAS.cols);
      const un0 = a.coreUV[0] * ATLAS.cols - tileX, un1 = a.coreUV[2] * ATLAS.cols - tileX;
      const vn0 = a.coreUV[1] * ATLAS.rows - tileY, vn1 = a.coreUV[3] * ATLAS.rows - tileY;
      check('atlas.coreInsideItsTile', un0 > 0 && vn0 > 0 && un1 < 1 && vn1 < 1 && un1 > un0 && vn1 > vn0,
        `core rect [${un0.toFixed(3)},${vn0.toFixed(3)}]-[${un1.toFixed(3)},${vn1.toFixed(3)}] escapes tile ${TILE.canopyBlob}`);
      // A card sampled at 8 texels per tile is ~8 px on screen; anything shallower than that and
      // the bole is under a pixel, so level 5 (256 >> 5 = 8) is the contract.
      check('atlas.coreDeepEnough', a.coreDeepestLevel >= 5,
        `core certified only to mip ${a.coreDeepestLevel}; the bole dissolves before the card does`);
      /* ⛔ THE BAR HERE IS THE MATERIAL'S, NOT THE SEARCH'S — and the first draft got that wrong.
         It read `ATLAS.coreAlphaMin`, the same constant `solidCoreOf` searches under, so lowering
         that constant lowered the wall with it and the wall stayed green on a core that would
         stipple. A gate whose threshold moves with the thing it grades cannot fail. Proven: with
         `coreAlphaMin` planted at 0.20 the draft passed and this version fails by name. The honest
         bar is `alphaTest` plus filtering headroom, because that is what the FRAGMENT compares
         against; `coreAlphaMin` is then checked separately for sitting above it. */
      const thr = Math.round(VEG.alphaTest * 1.25 * 255);
      let worstAlpha = 255, worstLevel = -1;
      for (let L = 0; L <= a.coreDeepestLevel; L++) {
        const mip = mips[L];
        const tl = mip.width / ATLAS.cols;
        const ox = tileX * tl, oy = tileY * tl;
        const x0 = Math.max(0, Math.floor(un0 * tl) - 1), x1 = Math.min(tl, Math.ceil(un1 * tl) + 1);
        const y0 = Math.max(0, Math.floor(vn0 * tl) - 1), y1 = Math.min(tl, Math.ceil(vn1 * tl) + 1);
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const al = mip.data[((oy + y) * mip.width + ox + x) * 4 + 3];
            if (al < worstAlpha) { worstAlpha = al; worstLevel = L; }
          }
        }
      }
      check('atlas.coreIsOpaqueEverywhere', worstAlpha >= thr,
        `core + guard band drops to alpha ${worstAlpha} at mip ${worstLevel}, under the ${thr} bar (alphaTest ${VEG.alphaTest} x 1.25) — the bole would stipple`);
      // ...and the constant the SEARCH runs under has to sit above that same bar, or the search is
      // certifying something the material will reject.
      check('atlas.coreAlphaMinAboveAlphaTest', ATLAS.coreAlphaMin >= VEG.alphaTest * 1.25,
        `ATLAS.coreAlphaMin ${ATLAS.coreAlphaMin} is under alphaTest ${VEG.alphaTest} x 1.25 — the search would accept a rect the shader discards`);
      // The core's colour is the V7 denominator for the bole. If it ever lands off a leaf tile the
      // bole tint would silently absorb the error.
      check('atlas.coreLinearIsLeafColoured', a.coreLinear[1] > a.coreLinear[0] && a.coreLinear[1] > a.coreLinear[2] * 1.5,
        `core mean linear [${a.coreLinear.map((x) => x.toFixed(4))}] is not a leaf colour — wrong tile?`);
    }

    // ⭐⭐ 6b — V7: THE EFFECTIVE DIFFUSE ALBEDO. THE WALL THAT DID NOT EXIST.
    //
    // Every check above this line looked at ONE factor: the atlas is a correct leaf colour, the
    // vertex colour is a correct leaf colour, and both passed for the module's whole life while
    // the material multiplied them into 0.0103 linear green — 12.5x below a real leaf and below
    // the rubric's 0.02 dielectric floor on every channel. A per-factor check cannot see a
    // per-PRODUCT defect, which is exactly the class law 2 names.
    //
    // Ask it the other way: what would this look like if it were broken? It would look like a
    // correct atlas and a correct vertex colour. So the wall must be on the PRODUCT, and it is
    // computed here the way the SHADER computes it — sRGB texel decoded to linear, times the
    // vertex colour, over the geometry the shipped entry point actually builds.
    // `srgbToLinear` is the module's own helper, deliberately — this wall and `bakeLeafAtlas`'s
    // core measurement must decode through the SAME transfer or the wall is grading a different
    // number than the one that ships.
    let aN = 0, aR = 0, aG = 0, aB = 0;
    for (let i = 0; i < d0.length; i += 4) {
      if (d0[i + 3] / 255 < VEG.alphaTest) continue;
      aR += srgbToLinear(d0[i] / 255); aG += srgbToLinear(d0[i + 1] / 255); aB += srgbToLinear(d0[i + 2] / 255);
      aN++;
    }
    const atlasMean = aN ? [aR / aN, aG / aN, aB / aN] : [0, 0, 0];
    const canopy = veg.tree('oak', 3).canopy;
    const cAttr = canopy.getAttribute('color');
    let vR = 0, vG = 0, vB = 0;
    for (let i = 0; i < cAttr.count; i++) { vR += cAttr.getX(i); vG += cAttr.getY(i); vB += cAttr.getZ(i); }
    const vn = Math.max(1, cAttr.count);
    const eff = [atlasMean[0] * (vR / vn), atlasMean[1] * (vG / vn), atlasMean[2] * (vB / vn)];
    // A green leaf's measured reflectance: ~0.04-0.10 red, ~0.10-0.20 green, ~0.03-0.07 blue.
    // The floor here is the RUBRIC's dielectric floor; the ceiling stops the fix over-correcting
    // into an emissive-looking leaf.
    check('albedo.leafGreenInBand', eff[1] > 0.03 && eff[1] < 0.30,
      `effective leaf green albedo ${eff[1].toFixed(5)} (atlas ${atlasMean[1].toFixed(4)} x vcol ${(vG / vn).toFixed(4)})`);
    check('albedo.leafAboveRubricFloor', eff[0] > 0.02 && eff[2] > 0.02,
      `effective leaf albedo [${eff.map((v) => v.toFixed(5))}] has a channel below the rubric's 0.02 dielectric floor`);
    check('albedo.leafIsGreen', eff[1] > eff[0] * 1.15 && eff[1] > eff[2] * 1.5,
      `effective leaf albedo [${eff.map((v) => v.toFixed(5))}] does not read as chlorophyll`);
    // And the same product for BARK, which carried the identical defect and drew the black skirt.
    const trunk = veg.tree('oak', 3).trunk;
    const bAttr = trunk.getAttribute('color');
    let bR = 0, bG = 0, bB = 0;
    for (let i = 0; i < bAttr.count; i++) { bR += bAttr.getX(i); bG += bAttr.getY(i); bB += bAttr.getZ(i); }
    const bn = Math.max(1, bAttr.count);
    const barkEff = TINT.barkBase[0] * (bR / bn);
    check('albedo.barkAboveRubricFloor', barkEff > 0.02,
      `effective bark red albedo ${barkEff.toFixed(5)} is below the rubric's 0.02 dielectric floor`);
    // The vertex colour must be a MODULATOR. If it ever drifts back to carrying an absolute
    // albedo it will land near the tint (~0.1) instead of near 1, and this is the cheapest place
    // to catch that.
    check('albedo.vertexColourIsModulator', vG / vn > 0.35 && vG / vn < 2.0,
      `canopy vertex colour mean green ${(vG / vn).toFixed(4)} is not a modulator around 1.0`);
    check('albedo.barkVertexColourIsModulator', bR / bn > 0.35 && bR / bn < 2.5,
      `trunk vertex colour mean red ${(bR / bn).toFixed(4)} is not a modulator around 1.0`);
  }

  // 6c — V7: TILE_TINT must agree with what `bakeLeafAtlas` actually painted, and no shipped
  //      tint ratio may reach `tintRatio`'s clamp (a clamped ratio means a wrong reference).
  {
    for (const key of Object.keys(SPECIES_DEF)) {
      const p = SPECIES_DEF[key];
      const ref = atlasTintFor(p.leafTiles, p.leafWeights);
      const r = tintRatio(p.leafTint, ref);
      for (let i = 0; i < 3; i++) {
        check(`tint.ratioUnclamped.${key}`, r[i] > 0.051 && r[i] < 3.99,
          `${key} channel ${i} ratio ${r[i].toFixed(3)} reached the clamp — wrong atlas reference`);
      }
      // A species' own tint should be CLOSE to the tiles it samples; far apart means the species
      // table and the bake plan have drifted.
      check(`tint.speciesMatchesItsTiles.${key}`, r[1] > 0.55 && r[1] < 1.85,
        `${key} green ratio ${r[1].toFixed(3)} — leafTint and leafTiles disagree`);
    }
    check('tint.tileTintTableComplete', TILE_TINT.length === ATLAS.cols * ATLAS.rows,
      `TILE_TINT has ${TILE_TINT.length} entries for ${ATLAS.cols * ATLAS.rows} tiles`);
  }

  // 6c-bis — R3: THE WINTER DRESS KEEPS ITS HUE ALL THE WAY TO THE PIXEL, both directions.
  //   The lime-conifer defect: tintRatio's per-channel 4x clamp flattened the dressed target
  //   (snow ~0.8 over an atlas reference ~0.05-0.13 needs 6-17x) into atlas-green x4. The canopy
  //   now rides leafModulator (product-bounded, hue-preserving). Proven here on every species at
  //   full dress: the REALISED product (modulator x atlas reference) must stay frost-cool
  //   (blue >= green, the dress target's own ordering), and the PLANT arm shows the old tintRatio
  //   path fails exactly this on the conifers — a wall that cannot fail is not a gate.
  {
    let plantFailedSomewhere = false;
    for (const key of Object.keys(SPECIES_DEF)) {
      const p = SPECIES_DEF[key];
      const ref = atlasTintFor(p.leafTiles, p.leafWeights);
      const dressed = dressLeafTint(p.leafTint, 1);
      const m = leafModulator(dressed, ref);
      const product = [m[0] * ref[0], m[1] * ref[1], m[2] * ref[2]];
      check(`tint.dressStaysFrostCool.${key}`, product[2] >= product[1] * 0.98,
        `${key} dressed product [${product.map((v) => v.toFixed(3)).join(', ')}] reads green over blue — the lime defect`);
      check(`tint.dressUnderTheEnergyCeiling.${key}`, Math.max(...product) <= LEAF_ALBEDO_CEILING + 1e-6,
        `${key} dressed product peaks at ${Math.max(...product).toFixed(3)} — above the dielectric ceiling`);
      const planted = tintRatio(dressed, ref);
      const plantedProduct = [planted[0] * ref[0], planted[1] * ref[1], planted[2] * ref[2]];
      if (plantedProduct[2] < plantedProduct[1] * 0.98) plantFailedSomewhere = true;
    }
    check('tint.dressWallCanFail', plantFailedSomewhere,
      'the tintRatio plant arm passed the frost-cool check on EVERY species — the wall is vacuous');
  }

  // 6d — V9: a veg handed a registry that carries a tod must NEVER shade a frame against the
  //      constructor's placeholder sun. The failure this catches shipped: `setSun` had no caller
  //      anywhere in src/, so every foliage frame ran 31 degrees off at a third of the radiance.
  {
    const fakeTod = {
      sunDirection: { x: 0.742, y: 0.670, z: 0.028 },
      sunElevationDeg: 42, sunIlluminance: 106000, skyIlluminance: 16229,
      preExposure: 1 / (1.2 * Math.pow(2, 15)),
    };
    const reg = { get: (n) => (n === 'tod' ? fakeTod : null), provide() {} };
    const v2 = createVeg(null, null, mulberry32(2), { seed: 0xA3E, anisotropy: 4, registry: reg });
    check('sun.startsUnfed', v2.stats().sunSource === 'default', 'sunSource was not "default" before the first update');
    v2.update(1 / 60);
    const st = v2.stats();
    check('sun.acquiredFromTod', st.sunSource === 'tod', `sunSource stayed "${st.sunSource}" with a tod on the registry`);
    const dot = st.sunDir[0] * 0.742 + st.sunDir[1] * 0.670 + st.sunDir[2] * 0.028;
    check('sun.directionMatchesTod', dot > 0.9999, `foliage sun is ${(Math.acos(clamp(dot, -1, 1)) * 180 / Math.PI).toFixed(2)} deg off tod's`);
    const wantE = fakeTod.sunIlluminance * fakeTod.preExposure;
    check('sun.radianceIsPreExposed', Math.abs(st.sunPreExposed[0] - wantE) < wantE * 0.02,
      `foliage sun radiance ${st.sunPreExposed[0].toFixed(4)} vs pre-exposed ${wantE.toFixed(4)}`);
    check('sun.skyIsPreExposed', st.skyPreExposed[2] > 0,
      'the sky transmission term was never fed, so a leaf backlit by an overcast sky has nothing');
    // An explicit setter must WIN and must stay won — otherwise an integrator who does drive the
    // module is silently overridden by the acquisition path every frame.
    v2.setSun({ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 1 }, 1);
    v2.update(1 / 60);
    const st2 = v2.stats();
    check('sun.explicitWins', st2.sunSource === 'explicit' && st2.sunDir[1] > 0.999,
      'the tod acquisition path overrode an explicit setSun');
    v2.dispose();
  }

  // 7 — THE SHADER, against r185's REAL sources.
  //
  // This is the check that matters most in the file. An injection whose anchor is missing renders
  // a material that COMPILES, LOOKS fine at a glance and is simply not doing the thing — and
  // nothing in the frame tells you. So: pull the actual ShaderLib entries a MeshStandardMaterial
  // and a MeshDepthMaterial compile from, run the real edits over them, resolve the includes the
  // way WebGLProgram does, and assert both that the injection LANDED and that every identifier it
  // reads is genuinely in scope at that point.
  {
    let threw = false;
    try { applyEdits('nothing here', [{ find: '#include <begin_vertex>', insert: 'x' }], 'test', 'vertex'); }
    catch (e) { threw = true; }
    check('shader.failsClosed', threw, 'a missing anchor did not throw');
    check('shader.windUsesCubicHeight', WIND_BODY_VERTEX.indexOf('t * t * t') !== -1, 'bend is not cubic in height');
    check('shader.gustScrolls', WIND_BODY_VERTEX.indexOf('uVegWindTune.y * vegT') !== -1, 'the gust field does not scroll');
    check('shader.unflipsDoubleSided', FOLIAGE_NORMAL_FRAGMENT.indexOf('normal *= faceDirection') !== -1,
      'the DOUBLE_SIDED flip is not undone — the field will render black from behind');

    const lib = THREE.ShaderLib;
    const resolve = (src) => src.replace(/^[ \t]*#include +<([\w\d./]+)>/gm,
      (_, name) => (THREE.ShaderChunk[name] === undefined ? '' : resolve(THREE.ShaderChunk[name])));

    const edits = veg.shader;
    // MeshStandardMaterial compiles from ShaderLib.physical (shaderIDs.MeshStandardMaterial).
    let vs = null; let fs = null; let vd = null;
    try {
      vs = applyEdits(lib.physical.vertexShader, edits.vertexEdits, 'selfTest', 'vertex');
      fs = applyEdits(lib.physical.fragmentShader, edits.fragmentEdits, 'selfTest', 'fragment');
      vd = applyEdits(lib.depth.vertexShader, edits.vertexEdits, 'selfTest', 'depth-vertex');
    } catch (e) {
      check('shader.anchorsExistInR185', false, String(e && e.message));
    }
    if (vs && fs && vd) {
      check('shader.anchorsExistInR185', true);
      check('shader.landedVertex', vs.indexOf('uVegWindTune') !== -1 && vs.indexOf('transformed += windObj') !== -1);
      check('shader.landedDepthVertex', vd.indexOf('transformed += windObj') !== -1,
        'the depth material got no wind — a swaying canopy would cast a nailed-down shadow');
      check('shader.landedFragment', fs.indexOf('uVegSunColor') !== -1 && fs.indexOf('normal *= faceDirection') !== -1);

      // Scope proof. `faceDirection` is declared by <normal_fragment_begin>; `geometryViewDir`,
      // `reflectedLight` and `diffuseColor` must all be live where the transmission term lands.
      const rf = resolve(fs);
      const atNormal = rf.indexOf('AAA_VEG_FOLIAGE');
      const atTrans = rf.indexOf('AAA_VEG_TRANSLUCENT\n{');
      check('shader.faceDirectionInScope',
        atNormal > 0 && rf.lastIndexOf('float faceDirection', atNormal) !== -1,
        'faceDirection is not declared before the bent-normal correction');
      const declTrans = atTrans > 0 && rf.lastIndexOf('vec3 geometryViewDir', atTrans) !== -1
        && rf.lastIndexOf('ReflectedLight reflectedLight', atTrans) !== -1
        && rf.lastIndexOf('vec4 diffuseColor', atTrans) !== -1;
      check('shader.translucencyScope', declTrans,
        'geometryViewDir / reflectedLight / diffuseColor are not all in scope at the transmission term');
      // The batching/instancing chain must match <project_vertex> EXACTLY (batching first, then
      // instancing — three.module.js:467) or batch boundaries sway out of step.
      const bAt = WIND_BODY_VERTEX.indexOf('batchingMatrix * vegP');
      const iAt = WIND_BODY_VERTEX.indexOf('instanceMatrix * vegP');
      check('shader.batchingChain', bAt !== -1 && iAt !== -1 && bAt < iAt,
        'the wind world-position chain does not mirror <project_vertex> (batching must precede instancing)');
      const stock = THREE.ShaderChunk.project_vertex;
      check('shader.chainMatchesStock',
        stock.indexOf('batchingMatrix') < stock.indexOf('instanceMatrix'),
        'r185 changed <project_vertex> ordering — the wind chain must be re-derived');

      // SHIPPED GLSL MUST BE PURE ASCII. GLSL ES 3.00 sec.3.1 confines non-ASCII to comments, and
      // drivers vary on how strictly they enforce even that. An em dash in a comment that compiles
      // on this machine and fails on a user's is not a trade worth making for typography.
      for (const src of [WIND_PARS_VERTEX, WIND_BODY_VERTEX, FOLIAGE_PARS_FRAGMENT,
        FOLIAGE_NORMAL_FRAGMENT, FOLIAGE_TRANSLUCENT_FRAGMENT]) {
        let ok = true;
        for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) > 126) { ok = false; break; }
        check('shader.asciiOnly', ok, 'non-ASCII byte in shipped GLSL');
      }
    }
  }

  // 8 — update(dt) is pure w.r.t. dt and allocation-free in intent: the same dt sequence must give
  //     the same simTime, and a clock read anywhere would break it.
  {
    const before = veg.stats().simTime;
    veg.update(1 / 120); veg.update(1 / 120); veg.update(1 / 120);
    const after = veg.stats().simTime;
    check('update.accumulates', Math.abs((after - before) - 3 / 120) < 1e-6, `${after - before}`);
    veg.update(10); // clamped to 0.25 by D5's frameDt rule
    check('update.clampsDt', Math.abs((veg.stats().simTime - after) - 0.25) < 1e-6, 'dt was not clamped to 0.25');
  }

  const out = {
    module: 'geo/kitVeg.js',
    checks,
    failures: failures.length,
    worstLOD0Tris: worst,
    stats: veg.stats(),
    detail: failures,
  };
  veg.dispose();
  return out;
}
