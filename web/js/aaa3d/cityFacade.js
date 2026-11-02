/**
 * src/world/cityFacade.js — THE CITY'S FACADE: the generator's own look, in WebGL (batch 49, 2026-09-30).
 *
 * THE OWNER, 2026-09-30: "Quality of the building meshes and all needs to be top tier though for the city just like GTA and the COD game we had
 * in AAA3d. We need the material teaching and all to stay and be used correctly."
 *
 * three.js r185's SkyscraperGenerator dresses every tower with ONE TSL material (`createSkyscraperMaterial` and its `interior`,
 * vendor/addons/jsm/generators/city/SkyscraperGenerator.js): brickwork in running bond keyed to the brick-snapped floors and bays, mortar that
 * stays crisp near and dissolves far, a domed brick relief on the normal, world-space weathering (a slow tonal drift, a clay mottle, soot
 * streaks pooling low, a gentler grime on roofs and ledges), smooth dressed stone on the frames and ornament, louvered AC units, and grimy
 * glass that looks INTO A FURNISHED ROOM — walls, floorboards, a rug, a ceiling lamp, a door, a picture, a table, a sofa, wardrobes and
 * curtains, one room shared by neighbouring panes, some rooms lit in a spread of bulb colours. TSL is WebGPU-only; batch 40 carried a
 * two-line stand-in (one flat colour per part). This file is that material in GLSL on MeshStandardMaterial (onBeforeCompile), lit by this
 * world's sun, sky and fog like every other lit surface. The math is the generator's, in its order; what differs is marked "ported:".
 *
 * THE AUTHOR'S STYLE STAYS THE STYLE: the palette is each tower's masonry (the brick's fired colour), the trim its dressed-stone frames, the
 * ornament its finials, the glass the glazing's own tint — the vertex colour carries the part's colour, converted from the author's sRGB hex
 * to the linear light the renderer works in (as three.js's `color(0x…)` does), and the facade treats each part the generator's way.
 *
 * THE LIT ROOMS FOLLOW THE CLOCK: `lit` is the share of rooms with the lights on and `glow` their radiance in this scene's units — one pair of
 * uniforms per city, written by the scene from the world's own clock (sandbox.js `_cityLightsTick`), never a second idea of the hour.
 *
 * The MIT License — Copyright © 2010-2026 three.js authors (the facade and interior math)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
 * ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH
 * THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as THREE from 'three';
import { PartId } from './cityGen.js';

/* the generator's masonry module (cityGen.js BRICK — the floors and bays are snapped to it) and its joint */
const BRICK_H = 0.3, BRICK_L = 0.6, MORTAR = 0.025;

/* ported: TSL `color(0x…)` is the hex in the LINEAR working space — the same conversion, done once, spelled as a GLSL literal */
function lin(hex) {
	const c = new THREE.Color(hex);
	return 'vec3(' + c.r.toFixed(5) + ', ' + c.g.toFixed(5) + ', ' + c.b.toFixed(5) + ')';
}
const f1 = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/* THE SHARED GLSL: the generator's `hash` (a PCG step, [0,1)), MaterialX-style gradient noise and its fractal sum, and a smoothstep that
   takes its edges in either order (TSL's does; GLSL's is undefined for edge0 >= edge1 — the generator writes smoothstep(0.7, 0.45, …)). */
const COMMON = `
float cityHashU(uint v) {
	uint state = v * 747796405u + 2891336453u;
	uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
	return float((word >> 22u) ^ word) * (1.0 / 4294967296.0);
}
float citySS(float e0, float e1, float x) { float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
uint cityCorner(vec3 c) {
	uvec3 q = uvec3(ivec3(c) + ivec3(1048576));
	uint h = (q.x * 73856093u) ^ (q.y * 19349663u) ^ (q.z * 83492791u);
	h = h * 747796405u + 2891336453u; h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u; return (h >> 22u) ^ h;
}
float cityGradDot(uint h, vec3 f) {
	uint k = h & 15u;
	float u = k < 8u ? f.x : f.y;
	float v = k < 4u ? f.y : ((k == 12u || k == 14u) ? f.x : f.z);
	return ((k & 1u) == 0u ? u : -u) + ((k & 2u) == 0u ? v : -v);
}
/* ported: mx_noise_float — gradient (improved Perlin) noise, ≈ −1..1 */
float cityNoise(vec3 p) {
	vec3 i = floor(p), f = p - i;
	vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
	float n000 = cityGradDot(cityCorner(i), f);
	float n100 = cityGradDot(cityCorner(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0));
	float n010 = cityGradDot(cityCorner(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0));
	float n110 = cityGradDot(cityCorner(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0));
	float n001 = cityGradDot(cityCorner(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0));
	float n101 = cityGradDot(cityCorner(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0));
	float n011 = cityGradDot(cityCorner(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0));
	float n111 = cityGradDot(cityCorner(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0));
	return 0.95 * mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
/* ported: mx_fractal_noise_float(p, octaves) — lacunarity 2, diminish 0.5 */
float cityFbm2(vec3 p) { return cityNoise(p) + 0.5 * cityNoise(p * 2.0); }
float cityFbm3(vec3 p) { return cityNoise(p) + 0.5 * cityNoise(p * 2.0) + 0.25 * cityNoise(p * 4.0); }
/* the generator's bumpNormal: the screen-space derivatives of a procedural height into Mikkelsen's surface gradient (the built-in bump map
   reads its height through a UV and would return a zero gradient here) */
vec3 cityBump(vec3 nrm, vec3 posView, float h) {
	vec3 dpdx = dFdx(posView), dpdy = dFdy(posView);
	vec3 r1 = cross(dpdy, nrm), r2 = cross(nrm, dpdx);
	float det = dot(dpdx, r1);
	vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
	return normalize(abs(det) * nrm - grad);
}
`;

const FACADE_BODY = `
	/* the zone, read off the flat per-face partId (a per-face id must not interpolate) */
	float cPart = floor(vCityPart + 0.5);
	float isPier = step(abs(cPart - ${f1(PartId.PIER)}), 0.5), isFrame = step(abs(cPart - ${f1(PartId.FRAME)}), 0.5), isOrn = step(abs(cPart - ${f1(PartId.ORNAMENT)}), 0.5);
	float isStone = 1.0 - max(isFrame, isOrn);
	vec3 cBase = vColor.rgb;   // vColor is a vec4 in this build (r185: USE_COLOR carries alpha)
	/* broad weathering, all from world position: a slow tonal drift, a fine clay mottle, sooty vertical streaks that pool low down */
	float cTone = cityFbm2(vCityWorld * 0.03) * 0.18;
	float cMottle = cityNoise(vCityWorld * 0.7) * 0.06;
	float cStreak = cityFbm2(vec3(vCityWorld.x * 1.5, vCityWorld.y * 0.04, vCityWorld.z * 1.5));
	/* ported: the soot pools toward the city's OWN ground (its pad, local y 0) — the generator's world y 0 is its ground; this world's is not */
	float cDirt = citySS(-0.1, 0.45, cStreak) * citySS(210.0, 0.0, vCityLocal.y) * 0.6;
	/* brickwork in running bond, keyed off the city-local position: courses up y, the across-face axis the tangent of the face's normal */
	vec3 cN = normalize(vCityNrmW);
	vec3 cNa = abs(cN);
	float cAcross = vCityLocal.x * cN.z - vCityLocal.z * cN.x;
	float cRow = vCityLocal.y / ${f1(BRICK_H)};
	float cCourse = floor(cRow);
	float cCol = cAcross / ${f1(BRICK_L)} + mod(cCourse, 2.0) * 0.5;
	/* anti-aliased mortar: never below the pixel footprint, faded to keep its energy — crisp near, dissolving far */
	float cMU = ${(MORTAR / (2 * BRICK_L)).toFixed(6)}, cMV = ${(MORTAR / (2 * BRICK_H)).toFixed(6)};
	float cDdU = clamp((cNa.z * fwidth(vCityWorld.x) + cNa.x * fwidth(vCityWorld.z)) / ${f1(BRICK_L)}, 1e-6, 0.5);
	float cDdV = clamp(fwidth(cRow), 1e-6, 0.5);
	float cDistU = 0.5 - abs(fract(cCol) - 0.5);
	float cDistV = 0.5 - abs(fract(cRow) - 0.5);
	float cDrawU = max(cDdU, cMU), cDrawV = max(cDdV, cMV);
	float cLineU = citySS(cDrawU + cDdU, cDrawU - cDdU, cDistU) * min(cMU / cDrawU, 1.0);
	float cLineV = citySS(cDrawV + cDdV, cDrawV - cDdV, cDistV) * min(cMV / cDrawV, 1.0);
	float cWall = citySS(0.7, 0.45, cNa.y);           // brick only on vertical walls — not roofs, ledges, cornice tops
	float cJoint = max(cLineU, cLineV) * cWall;
	uint cKey = (uint(cCourse + 65536.0) * 73856093u) ^ (uint(floor(cCol) + 65536.0) * 19349663u);
	float cRnd = cityHashU(cKey), cRnd2 = cityHashU(cKey + 1u);
	/* the domed brick relief (its bevel never sub-pixel) and a rougher mortar */
	float cTexel = length(fwidth(vCityWorld));
	float cBevel = max(cTexel * 1.5, 0.02);
	float cFace = citySS(0.0, cBevel, cDistU * ${f1(BRICK_L)}) * citySS(0.0, cBevel, cDistV * ${f1(BRICK_H)}) * cWall;
	float cityH = cFace * 0.008 * isStone;
	float cRough = cityNoise(vCityWorld * 0.5) * 0.08 + 0.82 + cJoint * 0.12;
	/* stone zones: brick and weathering on the tower's colour, the piers lightened */
	float cPerBrick = 1.0 + cTone + cMottle + (cRnd - 0.5) * 0.14;
	float cWarm = (cRnd2 - 0.5) * 0.14;
	vec3 cTint = mix(cBase, vec3(1.0), 0.12 * isPier) * cPerBrick * vec3(1.0 + cWarm, 1.0, 1.0 - cWarm);
	vec3 cMasonry = mix(cTint, cTint * 0.6, cJoint);
	float cRoofMask = 1.0 - cWall;
	float cRoofGrime = cRoofMask > 0.0 ? citySS(0.0, 0.55, cityFbm3(vCityWorld * 0.025)) * 0.22 : 0.0;
	vec3 cStone = mix(cMasonry, ${lin(0x4a4236)}, mix(cDirt, cRoofGrime, cRoofMask));
	/* frames: smooth dressed stone (the author's trim); ornament: dressed stone with the tonal drift (the author's ornament) */
	vec3 cOrnament = cBase * (1.0 + cTone);
	diffuseColor.rgb = isFrame > 0.5 ? cBase : (isOrn > 0.5 ? cOrnament : cStone);
	float cityRoughness = isOrn > 0.5 ? 0.8 : cRough;
`;
const GLASS_HELPERS = `
/* the room box's nearest-face slab hit: tN, the point, whether it hits, and the point in the box's own 0..1 */
struct CityBox { float tN; vec3 p; bool hit; vec3 qb; };
CityBox cityBoxHit(vec3 bMin, vec3 bMax, vec3 o, vec3 d) {
	vec3 ta = (bMin - o) / d, tb = (bMax - o) / d;
	vec3 lo = min(ta, tb), hi = max(ta, tb);
	CityBox b; b.tN = max(max(lo.x, lo.y), lo.z); b.p = o + d * b.tN; b.hit = min(min(hi.x, hi.y), hi.z) > b.tN && b.tN > 0.0; b.qb = (b.p - bMin) / (bMax - bMin);
	return b;
}
float cityRect(float ax, float ay, float cx, float cy, float hw, float hh) { return citySS(hw + 0.006, hw - 0.006, abs(ax - cx)) * citySS(hh + 0.006, hh - 0.006, abs(ay - cy)); }
`;
/* the glass body takes the room hash H (one per material, the generator's hash offsets) */
function glassBody(H) { return `
	/* INTERIOR MAPPING (the generator's \`interior\`): the view ray, in the pane's room frame (across, up, into the wall), cast into the room box */
	vec3 g_rN = normalize(vCityNrmL);
	vec3 g_rU = normalize(cross(vec3(0.0, 1.0, 0.0), g_rN));
	vec3 g_rD = vCityLocal - vRoomC;
	vec3 g_rRay = normalize(vCityLocal - cityCamLocal);
	vec3 g_o = vec3(dot(g_rD, g_rU), g_rD.y, 0.0);
	vec3 g_dir = vec3(dot(g_rRay, g_rU), g_rRay.y, -dot(g_rRay, g_rN));
	/* ported: a near-zero direction divides to ±inf in the generator's WGSL; GLSL leaves it undefined — held a hair off zero */
	g_dir = mix(g_dir, sign(g_dir + 1e-9) * 1e-5, vec3(lessThan(abs(g_dir), vec3(1e-5))));
	float g_setback = 0.1;
	vec3 g_boxMax = vec3(vRoomS.x * 0.5, vRoomS.y * 0.5, g_setback + vRoomS.y * 1.55);
	vec3 g_boxMin = vec3(-g_boxMax.x, -g_boxMax.y, g_setback);
	vec3 g_tFar = max((g_boxMin - g_o) / g_dir, (g_boxMax - g_o) / g_dir);
	float g_t = min(min(g_tFar.x, g_tFar.y), g_tFar.z);
	vec3 g_hitP = g_o + g_dir * g_t;
	vec3 g_q = (g_hitP - g_boxMin) / (g_boxMax - g_boxMin);
	bool g_onBack = g_q.z > 0.998, g_onCeil = g_q.y > 0.998, g_onFloor = g_q.y < 0.002;
	vec3 g_cCell = floor(vRoomC * 2.0);
	uint g_cKey = (uint(g_cCell.x + 2097152.0) * 73856093u) ^ (uint(g_cCell.y + 2097152.0) * 19349663u) ^ (uint(g_cCell.z + 2097152.0) * 83492791u);
	float g_seed = ${H(12.9898, 78.233, 37.719)}, g_seed2 = ${H(39.346, 11.135, 83.155)};
	/* ported: the share of lit rooms is the scene's (the clock), the generator's step(0.8, …) its 20 % */
	float g_lit = step(1.0 - cityLights.x, ${H(63.21, 9.17, 51.43)});
	vec3 g_warmLight = mix(${lin(0xffb845)}, ${lin(0xffe49c)}, ${H(27.1, 4.9, 61.7)});
	vec3 g_coolLight = mix(${lin(0xdfe8ff)}, ${lin(0x9fb6ff)}, ${H(8.3, 51.2, 17.6)});
	vec3 g_lightCol = ${H(44.7, 19.3, 6.1)} > 0.88 ? g_coolLight : g_warmLight;
	float g_depth = vRoomS.y * 1.55;
	#define CITY_FALLOFF(z) mix(1.0, 0.42, clamp(((z) - g_setback) / g_depth, 0.0, 1.0))
	/* the shell: muted plaster with a darker skirting, floorboards and a rug, a ceiling lamp, a door and a framed picture on the back wall */
	vec3 g_wall = mix(${lin(0x9a8b73)}, ${lin(0x6f7a82)}, g_seed);
	g_wall = mix(g_wall, ${lin(0xb9ad97)}, g_seed2 * 0.6);
	vec3 g_wallCol = mix(g_wall, g_wall * 0.5, citySS(0.05, 0.04, g_q.y));
	float g_seam = step(0.94, fract(g_q.x * 6.0));
	vec3 g_boards = mix(${lin(0x4a3320)}, ${lin(0x6a4c30)}, g_seed) * (1.0 - g_seam * 0.3);
	vec3 g_rug = mix(${lin(0x7a3b32)}, ${lin(0x3a5760)}, g_seed2);
	vec3 g_floorCol = mix(g_boards, g_rug, cityRect(g_q.x, g_q.z, 0.5, 0.62, 0.3, 0.26) * 0.9);
	float g_lamp = citySS(0.16, 0.13, length(vec2(g_q.x - 0.5, g_q.z - 0.5)));
	vec3 g_ceilCol = mix(mix(g_wall, vec3(1.0), 0.5), g_lightCol * mix(1.0, 4.5, g_lit), g_lamp);
	float g_doorX = mix(0.22, 0.78, g_seed);
	vec3 g_door = mix(${lin(0x5a4631)}, ${lin(0x39383c)}, step(0.5, g_seed2));
	float g_picX = g_doorX < 0.5 ? mix(0.68, 0.82, g_seed2) : mix(0.18, 0.32, g_seed2);
	vec3 g_picCol = mix(${lin(0x2c3a4a)}, ${lin(0x7a5a3a)}, ${H(5.1, 9.2, 3.3)});
	vec3 g_backCol = mix(g_wallCol, g_door, cityRect(g_q.x, g_q.y, g_doorX, 0.33, 0.085, 0.35));
	g_backCol = mix(g_backCol, ${lin(0x141210)}, cityRect(g_q.x, g_q.y, g_picX, 0.56, 0.075, 0.085));
	g_backCol = mix(g_backCol, g_picCol, cityRect(g_q.x, g_q.y, g_picX, 0.56, 0.055, 0.065));
	vec3 g_shellCol = g_onBack ? g_backCol : (g_onCeil ? g_ceilCol : (g_onFloor ? g_floorCol : g_wallCol));
	/* soft corner shading where two surfaces meet */
	#define CITY_AO(a) (citySS(0.0, 0.15, a) * citySS(0.0, 0.15, 1.0 - (a)))
	float g_edgeAO = g_onBack ? CITY_AO(g_q.x) * CITY_AO(g_q.y) : ((g_onFloor || g_onCeil) ? CITY_AO(g_q.x) * CITY_AO(g_q.z) : CITY_AO(g_q.y) * CITY_AO(g_q.z));
	float g_bestT = g_t;
	vec3 g_bestCol = g_shellCol * mix(0.72, 1.0, g_edgeAO) * CITY_FALLOFF(g_hitP.z);
	float g_bestEmit = 1.0;
	float g_halfU = g_boxMax.x, g_floorY = g_boxMin.y, g_ceilY = g_boxMax.y, g_backZ = g_boxMax.z;
	float g_midZ = g_setback + g_depth * 0.5;
	/* the furniture: a low table, a sofa against the back wall, wardrobes in the back corners — the nearest surface wins */
	float g_tCx = mix(-0.6, 0.6, g_seed), g_tCz = g_midZ + mix(-0.4, 0.5, g_seed2);
	CityBox g_tbl = cityBoxHit(vec3(g_tCx - 0.6, g_floorY, g_tCz - 0.35), vec3(g_tCx + 0.6, g_floorY + 0.42, g_tCz + 0.35), g_o, g_dir);
	if (g_tbl.hit && g_tbl.tN < g_bestT) { g_bestT = g_tbl.tN; g_bestEmit = 1.0; g_bestCol = mix(${lin(0x4a3526)}, ${lin(0x6b4a30)}, g_seed2) * (g_tbl.qb.y > 0.94 ? 1.25 : 0.8) * CITY_FALLOFF(g_tbl.p.z); }
	float g_sofaCx = mix(-g_halfU * 0.3, g_halfU * 0.3, g_seed2);
	CityBox g_sofa = cityBoxHit(vec3(g_sofaCx - 1.1, g_floorY, g_backZ - 0.95), vec3(g_sofaCx + 1.1, g_floorY + mix(0.8, 0.9, g_seed), g_backZ - 0.1), g_o, g_dir);
	if (g_sofa.hit && g_sofa.tN < g_bestT) { g_bestT = g_sofa.tN; g_bestEmit = 1.0; g_bestCol = mix(${lin(0x5a4a3a)}, ${lin(0x42566a)}, g_seed) * (g_sofa.qb.y > 0.9 ? 1.12 : 0.85) * CITY_FALLOFF(g_sofa.p.z); }
	vec3 g_wardCol = mix(${lin(0x3a2c22)}, ${lin(0x55473a)}, g_seed);
	CityBox g_wl = cityBoxHit(vec3(-g_halfU * 0.82 - 0.5, g_floorY, g_backZ - 0.7), vec3(-g_halfU * 0.82 + 0.5, g_floorY + mix(1.7, 2.3, g_seed), g_backZ - 0.1), g_o, g_dir);
	if (g_wl.hit && ${H(7.3, 2.1, 9.9)} > 0.4 && g_wl.tN < g_bestT) { g_bestT = g_wl.tN; g_bestEmit = 1.0; g_bestCol = g_wardCol * (g_wl.qb.y > 0.94 ? 1.2 : 0.82) * CITY_FALLOFF(g_wl.p.z); }
	CityBox g_wr = cityBoxHit(vec3(g_halfU * 0.82 - 0.5, g_floorY, g_backZ - 0.7), vec3(g_halfU * 0.82 + 0.5, g_floorY + mix(1.7, 2.3, g_seed2), g_backZ - 0.1), g_o, g_dir);
	if (g_wr.hit && ${H(3.7, 8.4, 1.5)} > 0.4 && g_wr.tN < g_bestT) { g_bestT = g_wr.tN; g_bestEmit = 1.0; g_bestCol = g_wardCol * (g_wr.qb.y > 0.94 ? 1.2 : 0.82) * CITY_FALLOFF(g_wr.p.z); }
	/* curtains just inside the glass, drawn part-way in from each side, in a muted domestic fabric picked per room */
	float g_pick = ${H(22.4, 6.7, 91.2)} * 6.0;
	vec3 g_fabric = mix(${lin(0xcabfa6)}, ${lin(0xd8cdb8)}, g_seed2);
	if (g_pick > 1.0) g_fabric = mix(${lin(0x8a7a64)}, ${lin(0x9b8c72)}, g_seed2);
	if (g_pick > 2.0) g_fabric = mix(${lin(0x706a64)}, ${lin(0x837d76)}, g_seed2);
	if (g_pick > 3.0) g_fabric = mix(${lin(0x5f7079)}, ${lin(0x6f818b)}, g_seed2);
	if (g_pick > 4.0) g_fabric = mix(${lin(0x6c7558)}, ${lin(0x79835f)}, g_seed2);
	if (g_pick > 5.0) g_fabric = mix(${lin(0x8c5a44)}, ${lin(0x9a6a52)}, g_seed2);
	float g_cz0 = g_setback, g_cz1 = g_setback + 0.12;
	float g_sL = citySS(0.3, 1.0, g_seed), g_sR = citySS(0.3, 1.0, g_seed2);
	float g_lw = g_halfU * g_sL * g_sL, g_rw = g_halfU * g_sR * g_sR;
	CityBox g_dl = cityBoxHit(vec3(-g_halfU, g_floorY, g_cz0), vec3(-g_halfU + g_lw, g_ceilY, g_cz1), g_o, g_dir);
	if (g_dl.hit && g_lw > 0.05 && g_dl.tN < g_bestT) { g_bestT = g_dl.tN; g_bestEmit = 0.2; g_bestCol = g_fabric * mix(0.78, 1.12, fract(g_dl.p.x * 2.5)) * CITY_FALLOFF(g_dl.p.z); }
	CityBox g_dr = cityBoxHit(vec3(g_halfU - g_rw, g_floorY, g_cz0), vec3(g_halfU, g_ceilY, g_cz1), g_o, g_dir);
	if (g_dr.hit && g_rw > 0.05 && g_dr.tN < g_bestT) { g_bestT = g_dr.tN; g_bestEmit = 0.2; g_bestCol = g_fabric * mix(0.78, 1.12, fract(g_dr.p.x * 2.5)) * CITY_FALLOFF(g_dr.p.z); }
	/* lit rooms read brighter and take their bulb's colour */
	vec3 g_warmth = mix(vec3(1.0), g_lightCol, g_lit * 0.85);
	vec3 g_roomRgb = g_bestCol * g_warmth * mix(1.0, 1.3, g_lit);
	float g_roomW = g_lit * g_bestEmit;
	/* grimy glazing: the room shows through a dusty film and dirt pooled along each pane's sill — old glass, never an open hole */
	float g_filmNoise = cityFbm2(vec3(vCityWorld.x * 1.3, vCityWorld.y * 0.06, vCityWorld.z * 1.3));
	float g_dustStreak = citySS(-0.15, 0.5, g_filmNoise) * 0.45;
	float g_pooled = citySS(0.32, 0.0, vCityUv.y) * 0.4;
	float g_grime = clamp(0.64 + g_dustStreak + g_pooled, 0.0, 0.95);
	/* ported: the dirty glass is the author's glass colour (the generator's two dark greys, 0x13161a..0x232b31, are one such glass) */
	vec3 g_dirtyGlass = cityGlass * mix(0.72, 1.3, cityNoise(vCityWorld * 0.3) * 0.5 + 0.5);
	diffuseColor.rgb = mix(g_roomRgb * ${lin(0xb6c6bf)}, g_dirtyGlass, g_grime);
	vec3 cityGlow = g_roomRgb * g_roomW * cityLights.y * (1.0 - g_grime * 0.6);
`; }

/* ── THE MASONRY: walls, piers, frames, ornament (one draw) ─────────────────────────────────────────────────────────────────────────── */
export function createFacadeMaterial() {
	const m = new THREE.MeshStandardMaterial({ name: 'city.facade', vertexColors: true, roughness: 0.86, metalness: 0 });
	m.onBeforeCompile = (sh) => {
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', '#include <common>\nattribute float partId;\nflat varying float vCityPart;\nvarying vec3 vCityLocal;\nvarying vec3 vCityWorld;\nvarying vec3 vCityNrmW;')
			.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCityPart = partId; vCityLocal = position; vCityWorld = (modelMatrix * vec4(position, 1.0)).xyz; vCityNrmW = normalize(mat3(modelMatrix) * normal);');
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', '#include <common>\nflat varying float vCityPart;\nvarying vec3 vCityLocal;\nvarying vec3 vCityWorld;\nvarying vec3 vCityNrmW;\n' + COMMON)
			.replace('#include <color_fragment>', FACADE_BODY)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = cityRoughness;')
			.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = cityBump(normal, -vViewPosition, cityH);');
	};
	m.customProgramCacheKey = () => 'city.facade.v1';
	return m;
}

/* ── THE GLASS: a furnished room behind every pane (one draw) ───────────────────────────────────────────────────────────────────────── */
export function createGlassMaterial(glassLinear) {
	const m = new THREE.MeshStandardMaterial({ name: 'city.glass', roughness: 0.18, metalness: 0 });
	const u = {
		cityCamLocal: { value: new THREE.Vector3() },
		cityGlass: { value: new THREE.Color().setRGB(glassLinear[0], glassLinear[1], glassLinear[2]) },
		cityLights: { value: new THREE.Vector2(0.2, 4.0) },        // (share of rooms lit, their radiance) — the generator's 20 % and ×4
	};
	m.userData.uniforms = u;
	/* the room is cast in the city's own frame: the camera, carried into it each draw (the city group is placed, never rotated) */
	m.userData.onBeforeRender = (mesh, camera) => { u.cityCamLocal.value.copy(camera.position); mesh.worldToLocal(u.cityCamLocal.value); };
	/* one room per cell of the pane's room centre; the generator's `hash(kx,ky,kz)` offsets, spelled as uint literals */
	const H = (kx, ky, kz) => 'cityHashU(g_cKey + ' + Math.round((kx + ky * 7 + kz * 13) * 100) + 'u)';
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, u);
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', '#include <common>\nattribute vec3 roomCenter;\nattribute vec2 roomSize;\nflat varying vec3 vRoomC;\nvarying vec2 vRoomS;\nvarying vec3 vCityLocal;\nvarying vec3 vCityWorld;\nvarying vec3 vCityNrmL;\nvarying vec2 vCityUv;')
			.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRoomC = roomCenter; vRoomS = roomSize; vCityLocal = position; vCityWorld = (modelMatrix * vec4(position, 1.0)).xyz; vCityNrmL = normal; vCityUv = uv;');
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', '#include <common>\nuniform vec3 cityCamLocal;\nuniform vec3 cityGlass;\nuniform vec2 cityLights;\nflat varying vec3 vRoomC;\nvarying vec2 vRoomS;\nvarying vec3 vCityLocal;\nvarying vec3 vCityWorld;\nvarying vec3 vCityNrmL;\nvarying vec2 vCityUv;\n' + COMMON + `` + GLASS_HELPERS + ``)
			.replace('#include <color_fragment>', glassBody(H))
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cityGlow;');
	};
	m.customProgramCacheKey = () => 'city.glass.v1';
	return m;
}

/* ── THE AC UNITS: a louvered white-plastic box, grimier toward the base where it drips (one draw) ─────────────────────────────────── */
export function createAcMaterial() {
	const m = new THREE.MeshStandardMaterial({ name: 'city.ac', roughness: 0.52, metalness: 0 });
	m.onBeforeCompile = (sh) => {
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', '#include <common>\nvarying vec3 vCityWorld;\nvarying vec3 vCityNrmW;\nvarying vec2 vCityUv;')
			.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCityWorld = (modelMatrix * vec4(position, 1.0)).xyz; vCityNrmW = normalize(mat3(modelMatrix) * normal); vCityUv = uv;');
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', '#include <common>\nvarying vec3 vCityWorld;\nvarying vec3 vCityNrmW;\nvarying vec2 vCityUv;\n' + COMMON)
			.replace('#include <color_fragment>', `
	float aTexel = length(fwidth(vCityWorld));
	float aVent = citySS(0.65, 0.4, abs(normalize(vCityNrmW).y));     // the vertical vented sides, not the flat top
	float aLouver = aVent * citySS(0.08, 0.015, aTexel);                // the louvers fade out before a slat nears a pixel
	float aDinge = cityNoise(vCityWorld * 0.4) * 0.5 + 0.5;
	vec3 aPaint = mix(${lin(0xf2f1ec)}, ${lin(0xcfccc2)}, aDinge) + cityNoise(vCityWorld * 5.0) * 0.04;
	float aGrille = citySS(0.06, 0.14, vCityUv.x) * citySS(0.94, 0.86, vCityUv.x) * citySS(0.12, 0.2, vCityUv.y) * citySS(0.96, 0.88, vCityUv.y) * aLouver;
	float aSlats = fract(vCityUv.y * 6.0);
	vec3 aBody = aPaint * mix(1.0, mix(0.82, 1.04, aSlats) * 0.42, aGrille);
	float aStreak = cityFbm3(vec3(vCityWorld.x * 6.0, vCityWorld.y * 0.5, vCityWorld.z * 6.0)) * 0.5 + 0.5;
	float aGrime = citySS(0.4, 0.0, vCityUv.y) * aStreak * (aDinge + 0.3);
	diffuseColor.rgb = mix(aBody, ${lin(0x6f685a)}, aGrime * 0.5);
	float cityH = aGrille * (aSlats * 0.012 - 0.01);
	float cityRoughness = 0.52 + aGrille * 0.08;
`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = cityRoughness;')
			.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = cityBump(normal, -vViewPosition, cityH);');
	};
	m.customProgramCacheKey = () => 'city.ac.v1';
	return m;
}

/** the lit rooms of a built city: the share with the lights on and their radiance (the scene's clock writes them) */
export function setCityLights(group, share, glow) {
	let n = 0;
	group.traverse((o) => { const u = o.material && o.material.userData && o.material.userData.uniforms; if (u && u.cityLights) { u.cityLights.value.set(share, glow); n++; } });
	return n;
}

/* ── ported (DrownedCity, 2 Nov 2026): THE WHOLE BUILDING IN ONE DRAW ─────────────────────────────────────────────────────────────────────
   Randy: "We have AAA3d city here in the orgo_u repo. Use that and make it work with our memory budget and art style". three.js r185's
   generator dresses a tower with ONE material that branches on `partId`; this is that again in WebGL: the masonry above and the glass above,
   chosen per fragment by the part, so a building costs one draw on a phone, not two. The glass's room is cast in WORLD space (a building here
   is only ever moved, never turned, so its local axes are the world's): the room centre is carried into the world in the vertex stage and the
   eye is the renderer's own cameraPosition, so one material serves every building with no per-mesh uniform. The glass tint rides in the
   vertex colour like the other parts' colours. `cityLights` is (share of rooms lit, their radiance), written from the game's clock. */
export function createBuildingMaterial() {
	const m = new THREE.MeshStandardMaterial({ name: 'saltlight.building', vertexColors: true, roughness: 0.86, metalness: 0 });
	const u = { cityLights: { value: new THREE.Vector2(0.2, 4.0) } };
	m.userData.uniforms = u;
	const H = (kx, ky, kz) => 'cityHashU(g_cKey + ' + Math.round((kx + ky * 7 + kz * 13) * 100) + 'u)';
	/* the glass body, in world space: its local position and normal are the world's, the eye is cameraPosition, its tint the vertex colour */
	const glass = glassBody(H).replace(/vCityLocal/g, 'vCityWorld').replace(/cityCamLocal/g, 'cameraPosition').replace(/vCityNrmL/g, 'vCityNrmW').replace(/cityGlass/g, 'vColor.rgb').replace('vec3 cityGlow =', 'cityGlow =');
	const masonry = FACADE_BODY.replace('float cityH =', 'cityH =').replace('float cityRoughness =', 'cityRoughness =');
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, u);
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', '#include <common>\nattribute float partId;\nattribute vec3 roomCenter;\nattribute vec2 roomSize;\nflat varying float vCityPart;\nflat varying vec3 vRoomC;\nvarying vec2 vRoomS;\nvarying vec3 vCityLocal;\nvarying vec3 vCityWorld;\nvarying vec3 vCityNrmW;\nvarying vec2 vCityUv;')
			.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCityPart = partId; vCityLocal = position; vCityWorld = (modelMatrix * vec4(position, 1.0)).xyz; vCityNrmW = normalize(mat3(modelMatrix) * normal); vRoomC = (modelMatrix * vec4(roomCenter, 1.0)).xyz; vRoomS = roomSize; vCityUv = uv;');
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', '#include <common>\nuniform vec2 cityLights;\nflat varying float vCityPart;\nflat varying vec3 vRoomC;\nvarying vec2 vRoomS;\nvarying vec3 vCityLocal;\nvarying vec3 vCityWorld;\nvarying vec3 vCityNrmW;\nvarying vec2 vCityUv;\n' + COMMON + GLASS_HELPERS)
			.replace('#include <color_fragment>', '#include <color_fragment>\nfloat cityH = 0.0; float cityRoughness = 0.18; vec3 cityGlow = vec3(0.0);\nif (abs(floor(vCityPart + 0.5) - ' + f1(PartId.GLASS) + ') < 0.5) {\n' + glass + '\n} else {\n' + masonry + '\n}\n')
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = cityRoughness;')
			.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = cityBump(normal, -vViewPosition, cityH);')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cityGlow;');
	};
	m.customProgramCacheKey = () => 'saltlight.building.v1';
	return m;
}
