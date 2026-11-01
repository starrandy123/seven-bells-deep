# Drowned City (folder name; the title lives in `web/js/config.js`, TITLE, until a name passes the check)

Randy, 31 Oct 2026, ~21:30 CET: "We need an open world aquaman swimming game that is breathtaking and custom fighting animations and
all and we give out the tech stack" · "I need a high quality AAA game out of this tonight so we can showcase and put on notesmosaic".

**Original hero and world.** Aquaman is DC's: the name, the orange-and-green suit and the blond beard never appear, in the game, its
listing or its files. Myth is free: tridents, drowned cities, the Leviathan. We never use "Atlantis" as a place name either, to stay
clear of the comics: the city is **Thalor**, invented. Never say a famous game or character is on NotesMosaic.

**This file is the interface control document: the contracts between owners.** `EPIC.md` is the requirements list, and §15 there lists
each interface with its check. `Pipeline/AGENTS.md` says who owns which file. Systems keeps this file. A contract changes through the
lead first (EPIC §18), then here, then in the code.

**How it's made.** The framework's shape (skill `game-framework`): Blender, headless and seeded, makes the world, the creatures, the
armour and the moves from code. The Warden's and the Reavers' bodies start from Microsoft Rocketbox avatars, changed by our scripts
(`CLEANROOM.md`). The browser (three.js r185, WebGL2) is the game and the only rulebook. Unreal 5.3 judges the look and films. One order
change, on his "tonight": the browser build comes first, and Unreal's look stage and film come after it.

**One game rule every owner keeps:** the first fight can't be lost. At 1 health in the first fight you're saved by a wave.

## Controls

| Action | Keys | Mouse | Touch |
|---|---|---|---|
| Move, relative to the camera (W goes where the camera looks, pitch included) | WASD | | Left stick |
| Look | | Drag, or pointer lock after a click | Drag on the right |
| Up, down | Space, C or left Ctrl | | |
| Jump. How long it's held sets the height | Space | | Jump |
| Boost | Shift | Hold both buttons: left first, then right | Boost |
| Strike | J | Left click | Strike |
| Parry | L | Right click | Parry |
| Power slots 1-4 | K, Q, E, G | | The four power buttons |
| Stance | X | | Stance |
| Call of the Deep | R | | Call |
| Talk, ride, the thing in front of you | F | Left click, when offered | Ride |
| Pause | Esc or P | | Pause |
| Map | M | | |
| Tech stack | H | | |

**Combat's design, approved by the lead (EPIC CR-7):** four power slots a stance. Water: Riptide, Maelstrom, Tidal Wave, Geyser. Ice:
Frost Lance, Glacier, Winter's Breath, Ice Path. Water Whip fires on Strike at range in Water. Frost Guard is Parry in Ice. There's no
Dodge button: a press of Boost in a fight dodges, and held it runs on into the boost. The buttons are in `web/index.html` and the keys in
`ui.js`; the moves arrive with combat's install (see Code interfaces).

Upright and turned both work. Touch targets, text and contrast are held by QS-C3, QS-E1 and QS-E2 through `web_check/ui.mjs` and `contrast.mjs`.

## Units and axes (the framework's)

Blender metres, z up, sea level z = 0, everything below is negative. A character faces -y, its right hand at -x, feet at z = 0.
glTF export turns this into three.js `(x, z, -y)`, so at rest a character faces three.js +z. All json uses **Blender coordinates**.
The browser's helper is `W(x, y, z) => new THREE.Vector3(x, z, -y)` (`web/js/config.js`).

## Who delivers what

`Pipeline/AGENTS.md` says who owns each file. This table says what each owner hands to the others.

| Owner | Delivers |
|---|---|
| movement | `web/assets/hero.glb`, `reaver.glb`, `moves.json`, `Pipeline/hero/preview/*.png`, the body in `web/js/body.js`, `web/js/formulas/*` |
| world | `web/assets/world.json`, `height_z.bin`, `biome_z.bin`, `biome2_z.bin`, `props.glb`, `props_*.glb`, `creatures.glb`, `web/assets/tex/*`, `Pipeline/world/assets.json` |
| look | The ocean, its light, the terrain, instances, schools, surface and sky: `web/js/look.js`, `world.js`, `life.js`, `sky.js`, `web/js/looks/*` |
| combat | `web/data/combat.json`, the fights: `web/js/combat.js`, `fx.js`, `enemies.js`, `boss.js` |
| missions | `web/data/*.json` other than `combat.json`, the story and screens: `web/js/quest.js`, `ui.js`, `stack.js`, `web/index.html` |
| lead | The frame loop and the wiring: `web/js/main.js`, `config.js`, `bot.js`, `audio.js`, `web/rights.json` |

## The contract: `web/assets/world.json` + binaries (world → look, lead, missions, combat)

Read `size_m`, `grid` and `origin` from the file; never hard-code them. The map is 2,048 m, grid 1,025, origin [-1024, -1024]. The raw `.bin` files aren't shipped:
`files` names the `_z.bin` files the game loads. The raw form below is what they decode to.

```
{ "seed": 1931, "size_m": 2048, "grid": 1025, "depth_scale_m": 260, "top_m": 90,
  "origin": [-1024, -1024],                // world x,y of grid cell (0,0)
  "biomes": ["reef", "kelp", "city", "trench"],     // the channels of biome.bin. Internal keys, never shown to a player
  "spawn": { "x":, "y":, "z":, "yaw": },  // yaw radians, 0 = facing -y
  "poi": [ { "id": "arena", "name": "The Sunken Arena", "x":, "y":, "z":, "r": }, ... ],   // named places, shown on arrival. name is public: EPIC Q20
  "bells": [ { "id": "reef"|"kelp"|"deep"|"gilded"|"rime"|"cinder"|"great", "name":, "x":, "y":, "z":, "yaw": } ],
  "arena": { "x":, "y":, "z":, "r":, "rx":, "ry":, "top":, "floor_rx":, "floor_ry":, "gate": { "x":, "y":, "z": } },
  "pearls": [ [x,y,z], ... ],  "chests": [ [x,y,z,yaw], ... ],
  "encounters": [ { "id":, "kind": "shark"|"reaver"|"mixed", "x":, "y":, "z":, "n":, "r":, "tied_to": "<bell id>"|null } ],
  "whales": [ { "path": [ [x,y,z], ... ] } ],      // closed loops
  "schools": [ { "kind": "fish_a"|"fish_b"|"fish_c", "n":, "x":, "y":, "z":, "r": } ],
  "drifters": [ { "kind": "jelly", "n":, "x":, "y":, "z":, "r": } ],
  "pods": [ { "id":, "x":, "y":, "z":, "n":, "r": } ],     // dolphins
  "sharks": [ { "x":, "y":, "z":, "n":, "r": } ],          // ambient, not encounters
  "land": [ { "id":, "name":, "x":, "y":, "z": } ],        // named beaches
  "decks": [ { "id":, "x":, "y":, "hx":, "hy":, "yaw":, "z": } ],   // walkable timber over water: half sizes hx, hy, top at z
  "rivers": [ { "id":, "w":, "pts": [ [x,y,z], ... ] } ],  // w metres wide; pts run source to mouth on the water's surface; z only falls; the bed is cut into height.bin
  "waterfalls": [ { "id":, "x":, "y":, "z0":, "z1":, "w":, "yaw": } ],  // x, y at the lip, falling z0 to z1, yaw as an instance's yaw
  "lod": { "<meshName>": metres },                         // the range of a mesh's far version
  "instances": { "<meshName>": [ x,y,z, yaw, scale, tint,   x,y,z, yaw, scale, tint, ... ] },  // flat array, 6 numbers each
  "colliders": [ { "t": "cyl", "x":, "y":, "z0":, "z1":, "r": }, { "t": "box", "x":, "y":, "z0":, "z1":, "hx":, "hy":, "yaw": } ],  // what no instance owns: the ice sheet as large overlapping rectangles (never tiles side by side), plugs under wide low solids, the shut gate (gate: true)
  // New map only, from here to notes:
  "col_kinds": { "<meshName>": [ { "t":, "x":, "y":, "z0":, "z1":, "r"|"hx","hy":, "yaw"?:, "foot"?: 1 } ] },  // a kind's solids in its own space; world.js sets them out per instance into data.colliders, so "colliders" in the file holds only what no instance owns. foot: z0 goes down to the lowest ground under it, less 0.4
  "openings": [ { "kind":, "x":, "y":, "z":, "dx":, "dy":, "sx"?:, "sy"?: } ],  // every way through a piece as placed: the middle, half the way, a side step onto solid (for its control)
  "files": { "height": "height_z.bin", "biome":, "biome2":, "sand_n":, "rock_n": },  // what to load in place of the default name. Named here = load this; not named = the old name
  "packs": { "<region>": { "file": "props_<region>.glb", "bytes":, "kinds": [ ... ] } },  // near meshes that stream after first play. A kind in a pack has its __far in props.glb, drawn at every distance until the near mesh lands
  "plumes": [ { "id":, "x":, "y":, "z":, "r":, "h": } ],   // a column of smoke or steam from x, y, z, r wide at the foot, h tall
  "life": [ { "kind":, "mode": "cruise"|"drift"|"lurk"|"crawl"|"raft"|"soar"|"graze", "n":, "x":, "y":, "z":, "r": } | { "kind":, "mode":, "pts": [ [x,y,z,yaw], ... ] } ],  // the second cast. A roaming group, or each one where it stands
  "holds": [ { "id":, "poi":, "depth":, "people":, "emblem":, "travel":, "far_tell": } ],  // W21: the Six Holds, one people, animal, depth and temperament for each sea. Text, public if shown: EPIC Q20
  "notes": { ... }                                         // the builder's own words on these fields
}
```

- `height.bin`: Uint16 little-endian, `grid x grid`, rows from y = origin upward. `z = top_m - value / 65535 * (top_m + depth_scale_m)`. Sea level is z = 0; z > 0 is land.
- `biome.bin`: Uint8 RGBA, `((grid-1)/2+1)²`: 513². Weights reef, kelp, city, trench, summing to 255. On land the channels mean beach sand, green, pale rock, black rock.
- `biome2.bin`: Uint8 RGBA, the same size as `biome.bin`. Weights cinder, ice, wrack, none, summing to 255. `none` = 255 means `biome.bin` alone decides. On land, ice is snow and cinder is black rock.
- `height_z.bin`, `biome_z.bin`, `biome2_z.bin`: the same data, small (the host sends `.bin` raw, Q24). Each is a zlib stream of second-order deltas, wrapped: along the row, then against the row below. Height: values halved (1.07 cm), low-byte plane then high-byte plane. Biome: planes r, g, b; a is what's left of 255. `check_world.py` proves they decode to the raw files.
- `props.glb`, `creatures.glb`: one named mesh per prop or creature, the name is the key in `instances`. Packed files keep that name on the parent node, not the mesh.
  Vertex colours (COLOR_0, linear albedo in rgb), no image textures, one material each file, name `M_prop`. Origin at the base, z up. Meshopt-packed by gltfpack.
  Remove any default white colour layer before export (Blender writes it to COLOR_0).
- Creatures are static meshes with their head toward -y; the look owner bends them in the vertex shader (a spine wave along y).
  `serpent` is a long straight tube along y, about 60 m, with its head at -y, evenly segmented so a path can bend it.

## The contract: `web/assets/hero.glb`, `reaver.glb`, `moves.json` (movement → lead, combat)

- One skinned mesh, one material `M_hero`, vertex colours as above plus a custom attribute `_MASK` (vec4: r scale-pattern strength, g
  emissive line strength, b metal, a cape/fin). Trident is part of the mesh, weighted 100% to bone `weapon`.
- Bones, exact names: `root` (at feet, never moves in a clip), `hips`, `spine_1`, `spine_2`, `spine_3`, `neck`, `head`, `clav_R`,
  `arm_R`, `fore_R`, `hand_R`, `weapon`, `clav_L`, `arm_L`, `fore_L`, `hand_L`, `leg_R`, `shin_R`, `foot_R`, `toe_R`, `leg_L`, `shin_L`,
  `foot_L`, `toe_L`, `cape_1`..`cape_5` (a chain from `spine_3`), `hair_1`..`hair_3` (a chain from `head`). Cape and hair are not keyed:
  code swings them on springs at runtime. The trident's tip is at bone `weapon` local +y, 1.05 m: an empty bone `weapon_tip`.
- Clips are **in place and upright**: the code tilts the whole body into the swim direction, so a swim clip moves limbs and spine
  only, with the torso's axis still along z. `root` has no keys; `hips` may move a little. Exact clip names:
  - Loops: `idle_tread`, `idle_combat`, `stand`, `walk`, `run`, `sprint`, `super`, `swim_slow`, `swim_fast`, `boost` (arms and legs read in a body tilted 80 degrees forward), `fall`.
  - One shots: `jump`, `jump2`, `leap`, `leap_super`, `land`, `atk1`, `atk2`, `atk3` (a three-hit combo), `atk_dash`, `atk_spin`, `cast_wave`, `parry`, `hit_front`, `hit_back`, `death`, `victory`, `pick_up`.
  - `surf_*` is owed by M10. A new clip is requested in `Pipeline/hero/CLIP_REQUESTS.md`.
- `reaver.glb`: the same skeleton and clip names (a separate mesh, a separate armour; only `idle_combat`, `swim_slow`, `swim_fast`,
  `atk1`, `atk2`, `hit_front`, `death` are needed; no cape).
- `moves.json`: `{ "<clip>": { "dur":, "loop":, "hit": [t0, t1] | null, "reach":, "arc_deg":, "lunge": metres, "cancel": t } }`, and where they apply:
  `peak_mps` (a blow's weapon-tip speed), `guard`: [t0, t1] (`parry`), `takeoff`: t (`jump`), `stands`: t (`land`), `speed`: m/s the clip was keyed for (`walk`, `run`, `sprint`).

## Code interfaces

Names here are read from the code at 00:01 on 1 Nov. An owner changing one tells the lead first.

| Interface | From → to | The contract |
|---|---|---|
| Hero to combat | movement ↔ combat | `createCombat(G, h, { moves, play(name, fade), clear(fade) })` in `combat.js` returns `{ presses, stepAttack, findTarget, startAttack }`. `hero.js` calls `G.combat.presses(u, dt)` and `G.combat.stepAttack(dt)`. Live code as of 00:01; combat's new build is still to install |
| Move data | combat → ui, `DESIGN.md` | `web/data/combat.json`: `stances`, `moves`, `impacts`, `status`, `interactions`, `foes`, `unlock`, `input`. **The game doesn't read it yet:** `data.js` doesn't load it, and live `combat.js` is the old code until combat installs |
| The body | movement → hero, combat | `createBody(G, h, { root, model, bones, clips, STAND })` in `body.js` returns `draw`, `play`, `clear`, `inertia`, `has`, `place`, `legs` |
| Look | look → all | `createLook` returns `render`, `resize`, `update`, `stats`, `precompile`, `patch(mat, opts)`, `setLook(name, seconds)`, `lookName`, `looks`, `setMood`, `setRegion`, `flash`, `kick`, `onCross`, `crossed`, `addOutline`, `setFrost`, `setSunMap`, `setLandMap` |
| World | look → all | `createWorld` returns `data`, `heightAt`, `biomeAt`, `biomeWeights`, `collide`, `sweep`, `update`, `setLampsLit`, `setGateOpen(on)`, `terrain`, `batches`, `creatures`, `glbs` |
| Life | look → lead, combat | `whales`, `pods`, `spray`, `onSplash`, `schools`, `schoolPos`, `scatter` |
| Bot | missions, lead → checks | `?demo` makes `createBot(G)`, whose `drive(u, dt)` asks `G.quest.botDrive(u, dt)` first, then `G.quest.target()` |
| Game data | missions → game | `web/js/data.js` loads `missions`, `dialogue`, `people`, `relics`, `codex`, `gear`, `upgrades`, `events`, `challenges` from `web/data/` before the modules run. A file that fails leaves an empty table, and `G.data.broken` names it |
| Saves | game → storage | `web/js/save.js`: one key, `thalor.save.v2`, holding `{ v: 2, ... }`. `thalor.save.v1` is still read. Every access is guarded. On NotesMosaic the port kit keeps the key in the player's own row. The look is `thalor.look`. A save from the previous build must still load (QS-F3) |
| The bundle | game → NotesMosaic | `tools/freeze.sh` copies `web/` without the dev pages to `runs/<n>/web`: relative paths, no remote code, `rights.json`, the boot flag below. Build uncompressed: the CDN sends brotli on text (JS, JSON, HTML), and `.glb`, `.bin` and `.png` raw (read 00:11 on 1 Nov). Files the first view doesn't need load after first play (EPIC Q24) |
| Recorded play | browser → Unreal | Not built for this game. `film.mjs` plan `rec` in the Colosseum's framework is the pattern (`ARCHITECTURE.md`). C2 needs it |

## Budgets

Frame rate, long frames, memory, draws, triangles and download are EPIC Q1-Q9, in one place, and Q9 is read on what the CDN sends. Drawing is capped at 1.3 MP on a phone (`pixelRatioFor`).

- Meshes: hero 16k triangles or fewer, Reaver 12k, props 200-1,500 each, creatures 300-3,000. A creature drawn only a few at a time may go to 8k. **These are guides: frame time and memory decide (Q4, Q5), not the count alone.**
- No `transmission`. No WebGPU-only effects. No composer on a phone tier.

## Hooks

`window.__game` holds the game. `?demo` plays itself, `?film` steps by `__game.frame(dt)`, `?qa` loads the checks, `?fly` a free camera,
`?fresh` starts with no save, `?tier=phone` or `?tier=desktop` forces a tier, `?look=real` or another name in `web/js/looks/` sets the look.
The page says it is ready on its first painted frame: `if (window.__MOSA_BOOT) window.__MOSA_BOOT.ok = true;`
