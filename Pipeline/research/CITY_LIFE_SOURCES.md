# A city that looks lived in: sources

Randy, 2 Nov 2026: "The city looks bland and not lived in. Come on man, go find the requirements and standards of an open world city and lights and pedestrians and cars and shit and complaints users have with these to make it look good". Then: "The buildings look flat and not actually 3d bro" · "What did you look up that says to build the cities like this?" · "The city looks like paper machet and not good at all. This is what slop looks like."

**Why this file exists.** Saltlight (`web/js/metro.js`) was built from planning sources only: a grid, a height limit, a setback rule, interior mapping for the windows. Nobody looked up what makes a game city read as solid and lived in. This file is that research, read 2 Nov by three research passes plus my own reading. Titles of games and the studios' names stay out of repo files: each game-derived item below says "(game source N)" and the record `reference_city_life_sources_2026_11_02.md` in the owner's memory holds the names and links.

Built from it: `web/js/streetlife.js` (commit bbbd8d3), then the towers' depth, the city's land and its damage (the last three sections).

## Crowds

| Rule | Source |
|---|---|
| Three tiers of detail by distance: full behaviour within 12 m (capped at 40), cheap "puppets" from 12 to 40 m, beyond 40 m about 2,000 polygons and 11 bones on fixed paths, under 25 µs of CPU each; 10,000 on screen | game source 1: a GDC 2015 talk on a crowd of 10,000 and its write-up |
| Each level of detail has a distance and a maximum count, and the distances may differ inside and outside the view | game source 2: an engine's crowd-system documentation |
| About 7 people per 100 m of pavement in the densest published city build (35,000 walkers on 512 km of pavement) | game source 3: the build's published statistics (our arithmetic) |
| Pavement crowding grades B to C: 4 to 49 m² per person | FHWA-RD-98-107 (1998), https://www.fhwa.dot.gov/publications/research/safety/pedbike/98107/section3.cfm |
| Clones of appearance are far easier to see than clones of motion; colour, facing and motion hide them | McDonnell et al., "Clone Attack!", SIGGRAPH 2008, https://research.gold.ac.uk/id/eprint/15203 |
| The head and upper body take most first glances; head accessories and top variation are among the most effective changes | McDonnell et al., "Eye-catching Crowds", SIGGRAPH 2009 |
| Walking speed 1.34 ± 0.26 m/s | Weidmann 1993, as quoted by secondary sources |
| Usual walk 1.43 ± 0.15 m/s; arm swing 53.4 ± 16.6° front to back (healthy adults 30-40) | PMC4549059, Tables 1-2, https://pmc.ncbi.nlm.nih.gov/articles/PMC4549059 |
| Arms swing out of phase with the leg on the same side; 1.25 m/s | Collins, Adamczyk and Kuo, Proc. R. Soc. B 2009, https://pmc.ncbi.nlm.nih.gov/articles/PMC2817299 |
| 60% stance, 40% swing; hip about 30° flexed at heel contact, 10-15° extended before toe-off; knee 10-15° in early stance, about 60° in swing | gait references (Wikipedia, lower-limb walking pattern; Kharb 2011) |
| Fixed "attractors" (a musician, a stall) and dynamic ones (a chat, an argument); reactions have a comfort distance and fade with distance | game source 4: a GDC 2017 talk on civilian behaviour |
| Walkers aim a few metres ahead on pavement paths, wait at the kerb for the light; when a car comes, they press to a wall or dive | game source 5: a 2001 developer article on an open-city racing game's traffic and walkers |

## Traffic

| Rule | Source |
|---|---|
| The Intelligent Driver Model; Table 1: T 1.6 s, a 0.73, b 1.67 m/s², δ 4, s0 2 m | Treiber, Hennecke and Helbing, Phys. Rev. E 62, 1805 (2000), arXiv cond-mat/0002177 |
| For a city only v0 changes; realistic a 0.8-2.5 m/s², b about 2; any step under 0.5 s gives the same result | Treiber's notes, https://traffic-simulation.de/info/info_IDM.html |
| Amber 3-6 s, red clearance 0.5-2 s, minimum green 7-15 s, cycles of 50-120 s studied | FHWA Signal Timing Manual |
| Density = total vehicle length over total road length, per road type; a car enters a junction only if its whole length fits on the exit road; at the edge of the simulated area a car moves to the opposite lane instead of being deleted | game source 5 |
| About 6.5 moving cars and 17 parked cars per 100 m of road | game source 3 (our arithmetic) |
| Cars and crowds are the first things cut for frame rate | game source 6: a 2022 interview on a city game's port |

## What players complain of (each with its fix)

1. Empty streets, crowds the first thing cut on weaker machines. Fix: cut the detail tier, never the number of people (game source 1).
2. Cars and people appearing or vanishing when the camera turns. Fix: never make or remove anyone in view; remove only after 2 s out of view; spawn in view only at the fog's edge; a person keeps one look for life. (Press reviews and patch notes of game source 7; a former developer of an open-city series on spawn radii: cars in view placed about 70 m out and removed at 90 m, out of view 15 m and 25 m, removed only after 2 s off screen.)
3. Walkers as scenery with no routine or reaction. Fix: everyone visibly doing something; who is out changes with the hour.
4. Traffic on rails. Fix: lanes, braking for people, reacting to danger, density by time of day (game source 7's 2.0 patch notes).
5. Clone walkers. Fix: build looks from parts and palettes.
6. Buildings as a backdrop: no interiors, copy-paste blocks. Fix: rooms behind windows (interior mapping, van Dongen 2008), some with people in them; never repeat a street front.
7. Night windows all lit the same yellow. Fix: light windows at random in two or three tints; offices off late; many small cheap lights (signs, head and tail lights).

## Lights

| Rule | Source |
|---|---|
| 3000 K for every luminaire; avenues 1.0-1.2 fc, cross streets 0.8-1.0, intersections 1.5-2.5 (about twice mid-block), pavements 0.6-0.8; brightest to darkest up to 4:1 (6:1 on pavements), so separate pools are normal; standard poles 30 ft with a cobra head, pedestrian poles 14 ft | NYC DOT Street Design Manual, https://www.nycstreetdesign.info/node/1850 and /node/1852 |
| One lamp post to about 18 m of pavement | game source 3 (our arithmetic) |
| Without real lights for lamps and headlights, nearly all of the night comes from emissive windows | game source 3 |
| Each building its own lit share, windows lit in groups by floor | Shamus Young, Pixel City (blog; code GPL-3.0, read not copied) |
| Night lights repeat nightly but each decorrelates by about an hour after one night | Dobler et al., Information Systems 2015 |
| Midnight is a fault line: shop and street lighting stay on all night, indoor lights go off at different times | Meier 2018, TU Berlin |
| Real lights recompile shaders when added; keep a fixed pool, use cards and pools for the rest | three.js forum threads 11802 and 49316 |

## Street dressing

| Rule | Source |
|---|---|
| Hand-placed bins and paper; noisy places need empty space for the eye to rest ("controlled chaos") | game source 8: a 2026 interview on a hand-built night city |
| Ready-made prop groups with litter on or off and random colour; objects look placed; "plastering the entire scene with tiny details is a sure way to wreck performance" | game source 9: an article on a Manhattan game's street dressing |
| People stop about 7 times more often at active shop fronts; at least 10 doorways per 100 m; ground floors at least 4 m tall | Gehl, Kaefer and Reigstad 2006, via The City at Eye Level, https://thecityateyelevel.com/stories/close-encounters-with-buildings/ |

## On a phone (implementation)

- Crowds: one instanced draw, the walk cycle posed in the vertex shader from the measured gait (`streetlife.js`); a vertex-animation-texture bake (three.js `webgl_gpgpu_birds_gltf`, MIT) is the next step up if closer people need more motion.
- Steering: a pavement graph with following on each line and signal-tied crossings is what shipped open-city games used; ORCA/RVO (van den Berg et al. 2011) and navmesh crowds are more than pavements need.
- Lights: emissive windows in the facade shader, instanced cards and ground pools additive, a few real lights only near the player.

## The towers' depth (read 2 Nov, afternoon)

His words: "The buildings look flat and not actually 3d bro" · "The city looks like paper machet" · "We need to fix the quality issue with the builds we make because I have reiterated for Claude to find the correct requirements and examples and standards and open source code examples of cities and use that here" · "DONT REINVENT THE WHEEL!"

What was wrong, measured on the before frames (844x390, scratchpad `before/`): every tower is a smooth box with its windows painted flush; nothing stands proud of a wall, so the sun draws no shadow line across a facade; roofs are bare; the shade side washes everything one teal-grey.

| Rule | Source |
|---|---|
| A building is a mass model, then its facade split into ground floor, floors and top floors, each floor into bays, each bay into wall, window, wall; the window is pushed into the wall by a window depth (`window S(1r,1r,window depth)`); a 0.3 m ledge sits between floor groups (`fac Subdiv("Y",3.5,0.3,3,3,3){ floor \| ledge \| floor \| floor \| floor }`); the front wall is chosen by whether it sees the street | Müller, Wonka, Haegler, Ulmer and Van Gool, "Procedural Modeling of Buildings", SIGGRAPH 2006, pp. 3-6, https://peterwonka.net/Publications/pdfs/2006.SG.Mueller.ProceduralModelingOfBuildings.final.pdf |
| Shipped cities build every tower from a volume styled by a shape grammar, a bottom and an upper style, out of "hundreds of instances" of kit pieces; very little custom geometry | game source 10: a 2021 engine demo city's documentation |
| Building kits: "collections of models of wall panels with windows, doors etc.", picked per footprint | game source 9 (its building tool) |
| Windows in three layers: frame and glass, then curtains, then a flat picture of a room; two room depths (rooms, shallow shop displays); far away the effect fades to a flat image while the window is small on screen | game source 11: a 2018 developer article on a racing game's window shader |
| A whole distant district is one low-poly mesh in one draw (a hill district 2,500 triangles; several city blocks one draw); far lights are quads | game source 12: a frame study of a 2013 open-world city |
| Players' word for flat procedural buildings: "made out of computerized cardboard", "a shoddy, out-of-place box"; they also notice no variety in height and the wrong wall colour close up | game source 13: a flight simulator's forum, 2024 |
| Projections from a facade (cornices, sills, band courses, opening frames, AC units): at most 4 in (0.10 m) into the street below 10 ft, 10 in (0.25 m) above; balconies 2 ft 6 in (0.76 m); fire escapes 4 ft 6 in (1.37 m); sun fins 2 ft 6 in | NYC Building Code §3202.2.1.2, Local Law 28 of 2012, https://www.nyc.gov/assets/buildings/local_laws/ll28of2012.pdf |
| Parapets at most 4 ft (1.22 m) by zoning; a fire parapet at least 30 in (0.76 m) | NYC Zoning Resolution 23-411; IBC 2021 §705.11.1 |
| A railing wall at least 1.1 m round balconies from the 2nd floor up and round roof terraces | Japan, Building Standards Act Enforcement Order Art. 126 (Tokyo Metropolitan Government handout) |
| A masonry window's reveal "is usually made 4 inches, but is sometimes 8 inches" (0.10-0.20 m) | Cyclopedia of Architecture, Carpentry and Building, "Windows in Brick Walls" |
| Curtain wall: 63.5 mm sightline, 152-190 mm deep | Kawneer 1600 Wall System 5 data |
| Shop fronts: glazing on at least half the wall between 2 ft and 12 ft, starting no higher than 2 ft 6 in; blank wall at most 10 ft | NYC Zoning Resolution 37-34 |
| Roof gear: water tanks 10-12 ft across and tall (3.0-3.7 m); packaged HVAC units 1.9 x 1.2 x 0.84 m up to 4.0 x 2.2 x 1.45 m; lift overruns 3.9-5.4 m clear | JLC "Watering Manhattan"; Carrier 48FC technical data; Otis Gen3 hoistway data |
| Interior mapping: a ray against a regular grid of planes, constant time for any number of rooms; keep corners opaque to hide seams | van Dongen, CGI 2008 |
| Parallax occlusion: samples grow at grazing angles (8-50); fade it out with distance; a production version: a brute-force loop of at most 24 steps, mip level by hand, faded with distance | Tatarchuk, I3D 2006; a 2014 GDC deck on a pirate game's renderer (game source 14) |
| Sky light down a street canyon: a wall element sees the sky over the opposite roof, (1 - sin a)/2 with a = atan((H - z)/W) (the 2D configuration factor 1/2 d(sin φ), Nusselt's unit sphere); the same rule gives the canyon floor W/sqrt(W^2+4H^2), Oke's published 0.447 at H/W 1 and 0.246 at H/W 2 | Siegel and Howell's configuration-factor method; Oke 1981 benchmarks via Johnson and Watson 1984 |
| Large-scale sky occlusion for buildings, from a top-down depth render blurred 7x7, applied to sky light only | game source 14 (its "world ambient occlusion") |

**The open code used (downloaded on his word, "You have permissions to download and all"):**

- `achrefelouafi/ProceduralBuildingsThreeJS`, MIT (Copyright 2026 mohamedachrefelouafi), https://github.com/achrefelouafi/ProceduralBuildingsThreeJS: three.js ports of Blender geometry-node buildings, verified against Blender to the float. Its French generator (`src/generator.ts`) is Müller's split with real numbers: sides of 3 m bays, a 4.2 m ground floor with the door on the middle bay, 3.2 m upper floors, a corner pier per floor, a cornice per bay. Its New York kit carries the pieces a facade is built from, as 1 m units made to stretch: cornice profile (72 triangles, 1.06 m out, 1.0 m tall), belt course (36), sill (24), lintel (12), balcony slab (12), window AC unit (276); its Chinese kit adds the roof (stair bulkhead 394, tank 880, vents, antennas, dishes) at hero detail (an AC unit 1,722 triangles), too heavy to repeat on a phone as it stands.
- `hec-ovi/glb-buildings-skill`, MIT (Copyright 2026 Hector Oviedo): floor bands to low-poly glTF with a triangle budget proved before a file exists (2-10k triangles a building). Read, not used: its buildings are made one at a time; ours are a city laid out at load.
- `Rototu/procedural-skyscraper-city-generator-and-shader`, MIT (2019), and OSM2World, MIT: read; nothing taken.

**How Saltlight's towers are built from these, cut to a phone** (his second meta rule: too heavy is not a no; learn it and make an optimised version):

1. Every volume keeps its one instanced box and shader (rooms by interior mapping). The shader sets each window into the wall by a reveal (0.10-0.20 m on punched walls, 0.05 m on curtain glass): the ray meets the jambs, head and sill before the glass, and the head throws its shadow on the glass by the sun's angle. Far off, it fades to the flat window, as game source 11 does.
2. The kit pieces stand proud of the wall as real geometry, merged at load into a few static meshes by district (one draw each, culled by district, as game source 12 merges districts): a cornice and parapet on every roofline, a belt course over the shop floor and at every setback, slab edges on every floor of ribbon-window buildings, fins on fin buildings, sills under punched windows on the lower floors, balconies with 1.1 m railing walls on apartment blocks, AC units, and roof gear sized from the real units (tanks, packaged units, lift overruns).
3. Lower floors in a narrow street take less sky, by the configuration factor above with each face's own street width and opposite height; the bases sit darker where they meet the ground.

## The city's land (read 2 Nov, afternoon)

His words: "We need the city placed on land and not segregated from the shit" · "Make sure the land is primed to support the city and elevations and shit well". His pick from the three put to him: Saltlight on a mainland grown from the Burnt Isle.

| Rule | Source |
|---|---|
| Street grades: local 10% (13-15% at most), collector 6-8%, arterial 4-6%; over 12% fire pumps labour | Rigby ID and other municipal codes; McMinnville OR steep-streets memo, 2017 |
| A street with kerb and gutter needs at least 0.5% to drain (0.3% with cross-slope), so a "flat" plain runs about 0.5-2% | county code; SCDOT Instructional Bulletin 02 |
| The steepest city streets: 31-41% (San Francisco's top ten) | 7x7 with Stephen Von Worley's data |
| Retaining walls step 1.2-1.8 m; a terrace at least twice the lower wall's height behind it | Douglas County CO, Renton WA, Hideout UT codes |
| A quay's crown stands 1.0-2.0 m over mean monthly high water for large quays (tidal range under 3 m), 0.5-1.5 m for small; where waves reach it, HWL + H1/3/2 + 0.5 m; at least 1.5 m (British Standard) | NILIM, Technical Standards for Port and Harbour Facilities, reference chapter, p. 256, https://www.ysk.nilim.go.jp/kakubu/kouwan/sisetu/tscphf.pdf |
| Coastal cities between sea and hills: Kobe "wedged between the coast and the mountains... long and narrow", widened by artificial islands; Hong Kong's north shore widened by reclamation under a 552 m peak; Wellington's 1840 grid planned for flat land, the city later up its valleys and lower slopes; Kagoshima faces an active volcano across its bay, a 107 m hill (Shiroyama) in its heart | Wikipedia (Kobe, Victoria Peak, Victoria Harbour, Wellington); gltjp.com, Shiroyama Park |
| Roads follow the coastline and the least elevation; short steep streets join the levels (the "San Francisco rule"); highways cross water as bridges | Parish and Müller, "Procedural Modeling of Cities", SIGGRAPH 2001 |
| Street fields from the shore and the height field: major roads follow the contours, minor ones the gradient | Chen, Esch, Wonka, Müller and Zhang, "Interactive Procedural Street Modeling", SIGGRAPH 2008 |
| An open implementation of that: streamlines through tensor fields, the coastline as one, lots by recursive splitting; no terrain height | ProbableTrain/MapGenerator, LGPL-3.0, https://github.com/ProbableTrain/MapGenerator (read; the grid stays, see below) |
| Buildings on slopes: platforms under them, or skirts that reach into the ground, so nothing floats | an open-source RTS's tracker and forum (0 A.D., Wildfire Games); an engine forum thread |
| Roads cut and fill through terrain, the slope shown as a number while laying them | game source 15: a 2023 city builder's road tools |
| His own rule for this world (W26): cliffs and mountain edges read as natural rock, no razor crease, no smooth faces, a foot that blends in | EPIC.md W26 |

**The plan, from these.** Saltlight leaves its disc in the north-west sea and stands on a coastal plain west of the Ash City, joined to it by land and road, the way Kagoshima faces its volcano and Kobe sits between sea and hills: quays on the north and west at +2.5 m (the NILIM rule over this sea's waves), the plain rising inland at about 2% so its streets drain and stay well under an arterial's 4-6%, a wooded ridge behind it to the south with a rounded crest (W26), and the land running east into the Burnt Isle's plain at the Ash City's level. The grid stays a grid: it is what a plain gets (Wellington's 1840 plan, Manhattan's), and the street life runs on it. Each building stands on a platform at its plot's downhill corner with a skirt into the ground.

## Building damage

His words: "We need it with building damage too". What the game already has (`web/js/scorch.js`): a damage mask per building that's hit (char, heat, frost, and a blow in stages: the face off, a breach, the room behind), all mending after 30 s; built for the village houses, not yet the towers.

| Rule | Source |
|---|---|
| Destruction in three steps: remove the piece, add detail meshes round the hole, then a mask that replaces the albedo and normals; then particles and mesh debris. The mask is a distance field from spheres at about 2 m a texel (8x8x8), atlased; 0.2-0.77 ms on a 2006 console | game source 16: a 2010 SIGGRAPH course talk on a shooter engine's destruction masking (Kihl) |
| Buildings with beams in the walls and rebar in the concrete; "a wall is replaced with a blown out wall" in most games; the cost is drawing the insides of walls | game source 17: interviews on a 2009 open-world destruction game |
| Pre-fracture everything offline with the seams hidden until it's hit; fracturing live is "too computationally expensive and unpredictable" | game source 18: a 2026 article on a 2023 shooter's procedural buildings |
| Fracture patterns made in advance and placed at the point of impact | Müller, Chentanez and Kim, "Real Time Dynamic Fracture with Volumetric Approximate Convex Decompositions", SIGGRAPH 2013 |
| What's destroyed comes back while the player is away | game source 19: a 2015 interview on an open-world sandbox's destruction |
| Glass cracks when its mean temperature has risen 75-85 °C (gas 130-340 °C); it falls much later and hotter (a 6 mm pane at about 15 min with the gas near 585 °C, half the glass staying in place); curtain walls failed at 700-870 °C | Hietaniemi, VTT Working Papers 41, 2005 |
| Water on hot glass: 6 mm tempered glass survives a water film only to about 250 °C; it crazes as it cools fast, as under a firefighter's spray | Shao et al., 2014 (USTC State Key Lab of Fire Science) |
| Soot rises in a V from an opening: "V-shaped patterns are created by flames, convective or radiated heat from hot fire gases, or smoke within the fire plume" | NFPA 921, as quoted in NIST's glossary |
| Heated concrete spalls: "explosive ejection of chunks of concrete from the surface", from about 200 °C; severe spalling strips the cover off the rebar | Fletcher et al., 2007 (University of Edinburgh) |
| A tower's core survives a burn-out while its perimeter falls where the mullions were bare | "Lessons from Madrid", New Steel Construction (Windsor Tower, 2005) |
| An impact destroys columns and scours the cover off others; a bay collapses about 20 minutes later | ASCE Civil Engineering, 2021, on the Pentagon investigations |
| Firefighting water freezes on a building at single-digit °F: ice on hydrants, ladders and the walls | weather.com, Chicago, 23 Jan 2013 |

**Open code for it:** three.js `ConvexObjectBreaker` (MIT): recursive plane cuts through the impact point, at most 16 pieces in the official example; `dgreenheck/three-pinata` v2.0.1 (MIT, licence in `lib/LICENSE`): Voronoi fracture, "10-50 fragments is optimal"; Rapier.js (Apache-2.0): 800 bodies in two instanced draws in three.js's own example; NVIDIA Blast (BSD-3-Clause): a stress solver for what falls; Blender Cell Fracture (GPL; its output is ours) for fracturing offline.

**For Saltlight, on a phone:** the towers take the same masks as the houses (char and a soot V over a hit, heat glow, frost, washed and crazed glass, the face off and then the room), plus what falls: pre-broken chunks of wall and glass thrown from the hit as one instanced draw, with dust, and everything mending after 30 s as now.
