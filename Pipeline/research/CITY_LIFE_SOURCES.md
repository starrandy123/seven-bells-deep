# A city that looks lived in: sources

Randy, 2 Nov 2026: "The city looks bland and not lived in. Come on man, go find the requirements and standards of an open world city and lights and pedestrians and cars and shit and complaints users have with these to make it look good". Then: "The buildings look flat and not actually 3d bro" · "What did you look up that says to build the cities like this?" · "The city looks like paper machet and not good at all. This is what slop looks like."

**Why this file exists.** Saltlight (`web/js/metro.js`) was built from planning sources only: a grid, a height limit, a setback rule, interior mapping for the windows. Nobody looked up what makes a game city read as solid and lived in. This file is that research, read 2 Nov by three research passes plus my own reading. Titles of games and the studios' names stay out of repo files: each game-derived item below says "(game source N)" and the record `reference_city_life_sources_2026_11_02.md` in the owner's memory holds the names and links.

Built from it: `web/js/streetlife.js` (commit bbbd8d3). Still owed: the towers' depth (see the end).

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

## Owed: the towers' depth

Not yet researched at source when this was written; a research pass was running. Leads: Müller, Wonka, Haegler, Ulmer and Van Gool, "Procedural Modeling of Buildings" (SIGGRAPH 2006, CGA shape: mass model, facade split into floors and tiles, windows inset, ledges and cornices); Wonka et al., "Instant Architecture" (SIGGRAPH 2003); the CityEngine CGA reference; window reveal depths, cornice and belt-course projections from architectural sources; relief mapping (Policarpo and Oliveira 2005) and parallax occlusion mapping (Tatarchuk 2006) for window depth; baked ambient occlusion at bases and corners; faces separated by sun and shade.
