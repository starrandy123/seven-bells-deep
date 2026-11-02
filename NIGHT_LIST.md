# Every ask from the night of 1-2 Nov, tracked

His words are in `EPIC.md` §11. "Done" here means built and checked. `accepted` is his word alone. Method: `STANDARD.md`.

| # | Ask | State |
|---|---|---|
| 1 | Fire elementals: no staff, regular men in red, all-fire as super mode | Built (Build 35-37) |
| 2 | Cities on the ground and in the sky, and enemies for the fire side | Built. Build 60 adds the sky fortresses he named on 1 Nov: the Cinder Keep and the Ember Gate, floating keeps read off a real castle's plan |
| 3 | Choose water or fire on the home screen, switch from pause | Built |
| 4 | Foot thrusters are one | Built |
| 5 | Water looks unnatural from the air | Built, his eye |
| 6 | Thrusters fire like an actual gas turbine | Build 41, his eye |
| 7 | Flight graceful and fluid, like Iron Man, head forward, hands along the body | Build 41, his eye |
| 8 | Hover | Build 42, his eye |
| 9 | Takeoff good | Build 42, his eye |
| 10 | Boost held on the ground runs on thrusters, Jump is a big fire jump, in the air Boost is Fly, held to fly or hover | Build 42, his eye |
| 11 | Fire fights as fire: emitted, blasted, comboed, not water recoloured | Build 43: new flame system and kit. Moves still to come (#12) |
| 12 | Martial-arts elemental fighting styles, for both sides | Build 50: fire's blows and powers cut from the karate forms already here. More kicks and water's tai chi wait on his yes for 25 CMU files, 41 MB |
| 13 | Fire ranged and close attacks, combos | Build 43: one button, both ranges. Longer combos with #12 |
| 14 | Combat, cities, buildings, bosses built off proven frameworks | Combat: frame data and boss structure from published talks (`Pipeline/research/FIRE_SOURCES.md`). Cities: lofted roofs and streets from `WORLD_SOURCES.md`. Bosses: tells and punish windows. His eye |
| 15 | The right bosses for the fire side and the land people | Build 47: the Tidecaller for fire, the Cinder King for water. The Last Seawall at the harbour, Build 49 |
| 16 | Underwater buildings stop being bland, from real references | Build 45: dark water, lit windows, rims of light, moving lights, reefs on the streets. Build 54: kit halls have dark glass and lit glazing bars |
| 17 | Nice buildings on land and in the fire cities | Build 48: fire cities rebuilt with lofted curved roofs and lacquered walls; harbour town has balconies and awnings. Build 58: real lattice screens with boards, rails and paper lit from a hot spot; the fire side opens on the plaza facing the volcano |
| 18 | A volcano world to contrast the waterfall | Build 46: the cone, the vent, lava rivers and falls, steam, embers. Basalt columns and lava that hurts the water side still to come |
| 19 | The water against fire fight shows every power, for showcase clips | Build 47: Pause, Watch the duel. Build 59: staged and shot from real fight-film sources (`Pipeline/research/DUEL_SOURCES.md`): turns, blocks and counters, a hard distance limit, a director that cuts on the blows. Moves improve with #12 |
| 20 | Sand and grass on the water side's beaches, a real transition | Build 44, his eye |
| 21 | Running stops feeling stiff | Build 44, his eye |
| 22 | Clips of fire and water elementals fighting | After #19. He hasn't said game camera or directed |
| 23 | Keep the method written down so it isn't reinvented | `STANDARD.md`, `Pipeline/research/` |

Owed from before: two real thumbs on Boost and Jump (real touch fingers in Chromium, S9 and S10, Build 56), a real iPhone, a lost graphics context repainting the isle (fixed, Build 56), Q7 at Thalor (102 now), the merge of `fire` into `part2` (done at Build 53).

Added by me as owed work: fire side objectives (road.js), Build 51. Lava burns the water side, Build 51. Basalt columns, Build 51.

Open, not root-caused: on Build 56's first platform run, Chromium's desktop pass reported "Cannot read properties of undefined (reading 'x')" twice, and it showed the title over the boot's preheat view. It did not come back in three more runs, one of them cold on Build 57. Ruled out locally: slow files, each file failing, 24 random boots, input through a slow boot with the platform's own probes, a saved row, negative time. Build 57 added fetch retries, a time floor and a frame that draws even if a part throws, which is a guard, not a fix. If it comes back, `watchrun.mjs` catches the whole stack.
