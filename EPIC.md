# The requirements epic (31 Oct 2026, night)

**Baseline 1.** Systems owns this file. A requirement's ID never changes meaning. Changes go through §18.

His words: "This is a prototype that needs full fleshing out with the details and powers and fights and structures and events and collectibles
and missions needed. We need different biomes too." · "All this needs to be recorded in a requirements epic and all these need to be
implemented well against our game dev standards so we can showcase it right and make this a standard in notesmosaic." · "Be sure to take your
time" · "this needs to be done well" · "done through the night so we come out swinging and can make another".

This file is the list. `GAME.md` keeps the contracts. `ART.md` keeps the look. A requirement is done only when its check is green, never when
its code exists. Status lives in `EPIC_STATUS.md`, one line per ID, updated by whoever moves it.

## 0. Find your requirement

| You are | Your rows | Also holds you |
|---|---|---|
| movement | §2: M1-M15 | Q1-Q4, Q13, Q14 |
| combat | §3: P1-P14 | Q1-Q8, M14, W20 |
| missions | §5: G1-G10 · S1, S2 · C1 | QS-C, QS-E, QS-G |
| look | §6: L1-L6 · §7: T1-T4 · W12, W16, W17, W20 | Q1-Q8 |
| world | §4: W1-W21 | Q8, Q9 |
| qa | §1: Q1-Q24 · §13 | §16, §17 |
| lead | §9: S3-S5 · C2, C3 · §17, §18 | §19 |
| systems | This file · `GAME.md` · `CLEANROOM.md` · §13-§19 | |
| Anyone before a freeze | §17 | |
| A new word from him | §18 | |

**Reading a row:**

| Column | Means |
|---|---|
| ID | Never changes. A parent keeps its ID; its parts are M1a, M1b. A parent is green only when all its parts are |
| Requirement | One "shall". What, not how. Where a row names a method, Why says who chose it |
| Why | The rationale, with today's reading where one exists |
| Source | N11 = his words, row in §14. `[Label]` = `Pipeline/research/STANDARDS.md`. QS-A5 = checkpoint A5 in `QUALITY_SOURCES.md`. A bare C1 or G1 is always a requirement here, never a checkpoint |
| Pri | M Must, S Should, C Could (`[MoSCoW]`). A release priority, not a cut: every S row stays in tonight's plan. Proposed by systems from his words. **Priority is his**, and fan evidence doesn't set it (§19) |
| V | T Test: a wall reads numbers off the running game. A Analysis. I Inspection. D Demonstration: a person judges, and the row says who and against what |
| Acceptance and check | The pass line, then the check. `` `name.mjs` `` exists today. `` `~name` `` is planned: the builder picks the final name and tells systems |
| Owner | In the section's heading. A row that differs says so |
| Status | The parent's line in `EPIC_STATUS.md` |

(ours) means we chose the number and no source gave it. TBR means a best estimate that §19 says who closes.

## 1. The standards every requirement is held to

These are the standards from his videos ("feed your AI proven standards in your field ... make it prove every step"), and they are binding:

1. **`~/Documents/UnrealProjects/QUALITY_SOURCES.md`: 34 checkpoints A1-G4** (ISTQB's game testing syllabus, CrazyGames, Poki, GameSnacks, Apple, Google
   Play, the Xbox and Game Accessibility Guidelines, the Rapier, Unity, Godot and Unreal docs). Every MUST has a check, or a stated reason it
   doesn't apply. "28 of 28" once hid a MUST with no check; map them all (`web_check/CHECKPOINT_MAP.md`).
2. **NotesMosaic's method, `read_skill steal-like-an-artist` (v1.4), saved at `Pipeline/research/steal_skill.md`:**
   - Public facts in, measured feel out. Every number has a source in `DESIGN.md`, or is marked (ours). Methods are studied and written fresh.
   - **Every spec is a wall**: a test that drives the real code, states its bound in its line, prints the worst case with where and when.
   - **Every wall has a plant**: the defect put back in a copy, which must turn that wall RED by its own line. `web_check/plants.mjs`.
   - **The chain** names the stage a break started in, for motion walls.
   - **Formulas live once** (`web/js/formulas/`: fixed step and blend, second-order follow, jump from height and time), each with a truth test.
   - **Frozen rounds**: `tools/freeze.sh` makes `runs/<n>/web`; every check reads the frozen copy on its own port; evidence in `runs/<n>/`.
   - **A second session judges** frozen copies, with clips at 1× and ¼ from the game's own camera. The builder doesn't grade its own round.
   - The published bytes are checked after an upload.
3. **The framework's five gates** (`~/.claude/skills/game-framework/ARCHITECTURE.md`): look, regression, gameplay, phone performance, provenance.
4. **Phone first:** both engines, upright and turned. Median 60 fps here, at most 5% long frames, working memory under 96 MB, never over 128 MB,
   at most 100 draws, at most 20 MB before first play (B1's bar for this size of game; report both sizes). A real iPhone is owed before launch.
5. **Honesty:** nothing public claims what isn't true. Unreal is credited only for what Unreal rendered. The stack panel and every reel say only what was done.
6. **Original:** no DC name, character, costume, place or story. Myth is free. Never "Aquaman" or "Atlantis" in the game, its listing or its files. No studio's name for the Painted look.
7. **Systems engineering (his word, 23:05):** this file is a requirements baseline. Each requirement is one verifiable statement with a method, traced to his words (§14), proved by a named check (§13), and changed only through §18. `Pipeline/research/STANDARDS.md` says where each rule comes from.

### What the words mean here

| Word | Means |
|---|---|
| Phone size | 390 × 844 at 3×, drawing capped at 1.3 MP (775 × 1677). Turned is 844 × 390 |
| Both engines | Chromium and WebKit, headless, on this Mac's GPU. Neither is a phone |
| A frame, in a bound | 1/60 s, the fixed step, whatever the display runs at. A bound "per frame" with no rate means nothing at 120 Hz |
| Long frame | Over 34 ms |
| Hitch | Over 50 ms |
| Frame work | Update plus render, read with `performance.now()`, not the wait for the display |
| Working memory | The GPU tally (textures, buffers, drawing surfaces) plus the JS heap. Raw or after a collection: open (X23) |
| Planted | A foot from its contact to its lift |
| Active frames | The frames a blow can hit. Startup counts up to and including the first of them (`[FrameData]`) |
| Telegraph | What the player sees before an enemy's first active frame |

### System requirements (Q). These hold every builder

| ID | Requirement | Why | Source | Pri | V | Owner | Acceptance and check |
|---|---|---|---|---|---|---|---|
| Q1 | The median frame rate shall be at least 59 fps at phone size | §1.4 says 60; 59 allows for rounding | §1.4 · QS-B3 | M | T | all, qa reads | Both engines, upright and turned. `perf.mjs` B3. A pass here says little about a phone: Q12 |
| Q2 | At most 5% of frames shall be long | §1.4. At 60 fps that's three a second, so this is the floor, not the aim | §1.4 · [AFP] | M | T | all, qa reads | On about a minute of frames (ours). `perf.mjs` B4, `pace.mjs` B4p, B4s, `turned.mjs` B4t, B4st. Objective ≤ 1% (ours) |
| Q3 | Every frame after the first input shall take at most 50 ms, declared loading steps aside | A share hides a single hitch; the player feels it | QS-B4 · [AndroidRender] | M | T | all, qa reads | In play and at 48 m/s. Two frames of 50-100 ms allowed for this Mac's own noise (ours), none on a phone. Any frame over 100 ms fails and prints what took the time. `perf.mjs` B4, `pace.mjs` B4l, B4p, B4s |
| Q4 | Frame work shall stay at or under 11 ms at p95 at phone size | Room for a slower GPU and for heat | QS-B3 · [RAIL] | S | T | all, qa reads | Report median, p95, p99, worst and the count (`[Percentiles]`). `perf.mjs` B3j reads update plus render submit; GPU time isn't in it |
| Q5 | Working memory shall stay under 96 MB in play | §1.4. iPhone tabs die with no warning | §1.4 · QS-F2 | M | T | all, qa reads | Upright, turned and back. `weigh.mjs` F2. **Fails at 104.6 MB on the raw heap.** What it counts is open (X23) |
| Q6 | Working memory shall peak under 128 MB | NotesMosaic warns from 128 MB | §1.4 · QS-F2 | M | T | all, qa reads | Peak over the soak. `weigh.mjs` F2t, `soak.mjs` Q6 |
| Q7 | A frame shall make at most 100 draw calls | §1.4 | §1.4 · QS-B5 · [Arm-GPU] | M | T | all, qa reads | At 12 of the world's places. `perf.mjs` B5 |
| Q8 | A frame shall submit at most 500k triangles (ours, TBR) | 389k at 1.3 MP is about 3 pixels a triangle; Arm asks for 10-20 | QS-B5 · [Arm-GPU] | S | T | look, world | `perf.mjs` B5t, `turned.mjs` B5tt. Objective 325k (ours, from `[Arm-GPU]`). Closes on the iPhone baseline |
| Q9 | The bytes the CDN sends before first play shall be at most 20 MB | §1.4's bar, read as the platform says: "build uncompressed (the CDN compresses)". Read at the CDN: brotli on text; `.glb`, `.bin` and `.png` go raw | §1.4 · QS-B1 · [Publishing] | M | T | all, qa reads | Both sizes reported: as files, and as the CDN sends them, brotli on text and binaries raw. `load.mjs` B1. Objective 15 MiB (GameSnacks) |
| Q10a | A loading screen or the game shall show within 1 s on a 10 Mbps connection | Players leave during loading | QS-B2 | M | T | qa | 10 Mbps, 4× CPU throttle (QS-B2). `load.mjs` B2p |
| Q10b | The game shall be playable within 10 s on a 10 Mbps connection | §1.3's phone gate. GameSnacks' hard line is 15 s | QS-B2 · §1.3 | M | T | qa | At the size the CDN sends, on a 4× slower CPU. `load.mjs` B2, with its control B2c. B2w reports the worst host, nothing compressed, against 15 s |
| Q11 | Every wall shall pass in both engines, upright and turned | NotesMosaic's bar | §1.4 | M | T | qa | `tools/round.sh` runs each wall in each. A wall that can't run in one says why |
| Q12 | A real iPhone shall run the game for ten minutes with no reload before launch | Headless on this Mac isn't a phone | §1.4 · §1.3 · [WebKitLPM] | M | D | lead | He or the playtest device; a person judges, with frame rate and reloads noted, in Low Power Mode too. Read the frame rate before and after the first tap. `~iphone_pass` |
| Q13 | The visible response to a press shall start within 50 ms of the input event (ours) | Leaves 50 ms for the phone's touch and display inside the 100 ms class | [Claypool06] [RAIL] [Swink08] | S | T | movement, combat | Press to first changed drawn state, for every action. `lag.mjs`, plant: a frame of added delay |
| Q14 | At a steady speed each frame's drawn move shall equal the speed times that frame's own time within 2% | Even pace matters more than a high average. A fixed step needs its blend | [Fiedler04] [AFP] [WebKitLPM] · steal §6 | M | T | movement | Stamp lists at 30, 59.94, 60, 90, 120, 144 Hz, and after a hitch. `rates.mjs` A6d, plant: no blend |
| Q15 | Every MUST among the 34 checkpoints shall have a check or a stated reason it doesn't apply | §1.1. "28 of 28" once hid a MUST | §1.1 | M | I | qa | `web_check/CHECKPOINT_MAP.md`, read at each review. Every row filled at 23:50 |
| Q16a | Every tuning number in shipped code and data shall have a sourced line in `DESIGN.md`, giving its value, kind and source, or (ours) | Clean room. A number with no source is how a decompiled one gets in | §1.2 · steal §0 · [NASA.req] | M | T | qa, each owner writes its lines | Every capital constant in `web/js` and numeric group in `web/data` has a `DESIGN.md` line carrying a kind. **Red until owners write them:** 29 constants and 22 groups (1,054 numbers) had no line on `runs/5`. Tuning that isn't a capital constant isn't read. `static.mjs` Q16a, Q16d, plants `q16a_unsourced`, `q16d_unsourced` |
| Q16b | Every source on record shall be a public talk, doc or paper, open-licensed source with its licence recorded in `CLEANROOM.md`, or our own measurement | §0 bars decompiled, disassembled, recompiled or leaked code in any form. It broke once tonight: `CLEANROOM.md`, R12 | §1.2 · steal §0 · `AGENTS.md` | M | T + I | qa, lead | Grep over shipped code, `DESIGN.md` and `Pipeline/research/` finds no decompilation or disassembly as a source, and no such file. A person reads new source lines at each review. `static.mjs` Q16b, plant: a line citing a decompilation |
| Q17 | Every wall shall have a plant that turns it RED by its own line | A wall that can't fail proves nothing | §1.2 | M | T | qa | `plants.mjs`. A stale plant is rewritten, never dropped |
| Q18 | The build shall load no remote code | Platform rule; Poki blocks external requests | QS Part 3 · [ISO25010] | M | T | qa | Requests off the game's origin: 0. `load.mjs` Q18, `static.mjs` Q18s |
| Q19 | Everything public shall claim only what was done | §1.5 | §1.5 · N22 · N23 | M | I | lead | A person reads every public text against S1's fact list before it goes out. `~fact_list` |
| Q20 | Shipped files and listing text shall hold no DC name, famous character or studio's name | §1.6. Internal keys such as the biome `trench` aren't public | §1.6 · N2 | M | T | qa, each owner | Whole-word grep of `web/` outside `vendor/`, and the listing, for 33 names. `static.mjs` Q20, plant: one banned word |
| Q21 | Every round shall keep its evidence in `runs/<n>/` | Rounds 4 and 5 are the first to keep any | §1.2 · [SEBoK] | M | I | qa | `ROUND.log`, clips and `JUDGE.md` present. `tools/round.sh` |
| Q22 | A session that didn't write the code shall judge each frozen round | The builder doesn't grade its own round | §1.2 | M | D | qa as judge | The judge reads the walls first, then clips at 1× and ¼. `runs/<n>/JUDGE.md` |
| Q23 | The published bytes shall match the frozen copy after every upload | §1.2 | §1.2 | S | T | lead | sha256 of each file read back. `~published` |
| Q24 | Files the first view doesn't need shall load after first play | The framework: "Load what the first view sees first and stream the rest after the first frame." It's what keeps Q10b on the big map | §1.3 · QS-B1 · [Publishing] | M | T + I | lead, look, world | `load.mjs` Q24 prints what loads late, and fails while nothing does: red today. The list of what loads before play is in `load_files_<engine>.json`, and a person checks each file is needed by the first view. A late load keeps Q3 |

## 2. Movement (MOVE). Owner: movement

His words: "look at how unnatural the movement is on land" · "we need to be able to jump on land too and surf with water".

Readings before any fix are in `Pipeline/hero/LAND_AUDIT.md`. Numbers go in `DESIGN.md` §Movement.

| ID | Requirement | Why | Source | Pri | V | Acceptance and check |
|---|---|---|---|---|---|---|
| **M1** | **Stride match** | | | | | |
| M1a | A planted foot shall move at most 3 cm a frame in the world, read from the drawn bones, at every land speed from walk (1.3 m/s) to sprint (13 m/s). The 3 cm is (ours) | Sliding feet are what he saw. 8.5-27 cm before any fix | N11 · [Kovar02] [EpicWarp] [Rosen14] | M | T | Worst case printed with where and when, at 60 and 120 Hz; 90 and 144 owed. `move_walls.mjs` M1, plant: timeScale fixed at 1 |
| M1b | The step rate shall stay at or under 5 steps/s (ours) up to sprint | Legs flicker past a clip's range. Fastest measured person: 4.32/s | N11 · [Mackala13] [Weyand00] | M | T | Maximum over the speed sweep. `gait.js` plans 4.8 at 13 m/s. `~wall_stride` |
| M1c | The hips shall rise and fall with the steps in the world, by at least 2 cm at walk (ours) | "He glides on the root" | N11 · [Williams01] | S | T | Peak to peak over a stride; lowest just after contact. `~wall_stride` |
| **M2** | **Foot placement on terrain** | | | | | |
| M2a | A planted sole shall sit within 3 cm of the real ground on slopes and steps. The 3 cm is (ours) | Toes 18-72 cm into the hill now. Two-bone IK is his method | N11 · [EpicWarp] [Kovar02] | M | T | The slope at (-310, 434) and the test room. `move_walls.mjs` M2 |
| M2b | Each leg shall stay at or under 0.98 of straight, the hips dropping to reach | Stretched limbs are a named defect | N11 · steal §2 · [ISTQB] | M | T | Maximum over every walk drive. `move_walls.mjs` M2b |
| M2c | A planted sole shall lie within 6° (ours) of the ground's slope | The sole follows the slope | N11 | S | T | Worst angle on the slope sweep. `move_walls.mjs` M2c |
| **M3** | **Pose changes never pop** | | | | | |
| M3a | Every pose switch shall go through inertialization, in one module | His choice of method: a cross-fade pops and evaluates two poses | N11 · [Bollo18] [Holden21b] | M | I + T | No `fadeIn`, `fadeOut` or `crossFade` on the ship path. `move_walls.mjs` M3, plant: a plain cross-fade |
| M3b | Outside a blow's active frames every drawn joint shall turn at most 1,500°/s | A pop reads as a joint's speed, and 2,000+°/s in a sprint or a jump is a real one (the lead, CR-17). Inertialization can pop knees | N11 · steal §2 · [Holden23] | M | T | Worst joint printed with its time; knees read at each switch. Fails at 2,270°/s today: movement fixes the motion (X21). `move_walls.mjs` M3 |
| M3c | Inside a blow's active frames every drawn joint shall turn at most 2,700°/s (ours) | The class the method allows: a blow is meant to be fast. His reference's blade sweeps up to 90° a frame at 30 fps | N26 · [RefClip] · steal §2 | M | T | Blows read 1,133-1,260°/s today. `move_walls.mjs` M3 needs this class |
| **M4** | **Starts, stops, pivots** | | | | | |
| M4a | The body shall lean toward its acceleration on a start, at least 4° at the peak (ours) | Starts had no lean | N11 · [Lasseter87] | S | T | Spine angle over a start. `move_walls.mjs` M4l |
| M4b | A stop from 7 m/s or more shall settle with overshoot of at most 10% and at most one change of sign | Stops had no weight: 31 m/s to 0 in about 0.3 s | N11 · steal §2 | M | T | Sweep of stop speeds. `~wall_turns` |
| M4c | A turn of 120° or more while moving shall play a pivot on a planted foot | He swung like a rigid figure | N11 | M | T | Pivot fires across 120-180°, and M1a holds through it. `move_walls.mjs` M4p reads 180°; 120° owed |
| M4d | A turn's rate shall change by at most 40% of its peak in a frame, first and last frames included | A turn eases in and out | N11 · steal §2 | M | T | Sweep of turns, worst printed. `move_walls.mjs` M4 |
| M4e | Every lean, follow and camera spring shall come from `web/js/formulas/follow.js` | Formulas live once | §1.2 | M | I | No hand-rolled spring in pose code. `formulas.mjs` |
| **M5** | **The jump** | | | | | |
| M5a | A full press shall reach the jump's designed apex, within 0.06 m (ours) | `formulas/jump.js` from height and time: 2.40 m in 0.4 s | N12 · [Pittman16] | M | T | `move_walls.mjs` M5a, `formulas.mjs` |
| M5b | The apex of the shortest press shall be at most half the apex of the longest | Height set by press length | N12 · [Pittman16] [CelesteSrc] | M | T | `move_walls.mjs` M5b |
| M5c | The feet shall leave the ground within 0.10 s of the press (ours) | Anticipation has to fit inside response. `JUMP_PREP` is 0.067 s, `takeoff` 0.07 s | N11 · N12 · [Lasseter87] [Swink08] | M | T | 3-6 frames after the press. `move_walls.mjs` M5c |
| M5d | A jump pressed up to 0.10 s after leaving a ledge shall fire | Coyote time. 0.1 s is published. `COYOTE` is 0.12 s | N12 · [Thorson] [CelesteSrc] | M | T | `move_walls.mjs` M5d reads 4 frames in, 12 out; 6 frames in is owed. Plant: window 0 |
| M5e | A jump pressed up to 0.10 s (ours) before landing shall fire on the landing frame | The input buffer. No public number. `BUFFER` is 0.15 s | N12 · [Thorson] | M | T | `move_walls.mjs` M5e. Plant: no buffer |
| M5f | A second jump shall fire once per flight | | N12 | S | T | The third press does nothing. `move_walls.mjs` M5f |
| M5g | Landing depth and recovery shall grow with fall height, with the hips at or under 150 m/s² | The same landing from 1 m and 10 m before; hips 926-1,853 m/s² | N12 · steal §2 | M | T | Falls of 1, 3.5 and 9 m. `move_walls.mjs` M5g |
| M5h | A jump from sprint speed or more shall rise at least 7 m (ours) | The superhero leap | N12 | S | T | `move_walls.mjs` M5h |
| M5i | The feet shall leave the ground within a frame of `takeoff` | The clip and the rise agree | N12 | S | T | `~wall_jump_clip` |
| M5j | Control shall return at `stands` | The landing hands back on a stated frame | N12 | S | T | `~wall_jump_clip` |
| **M6** | **Super sprint reads right** | | | | | |
| M6a | Above 13 m/s the step rate shall rise with speed to at least 6 steps/s at 36 m/s (ours) | No legs running in slow motion | N9 · N11 | M | T | Read from the bones. `gait.js` plans 6.7. `~wall_super` |
| M6b | Speed past what strides can match shall show blur, a dust wake and afterimages | Hides what a stride can't do | N9 | S | I | All three active over the match limit, stated in `DESIGN.md`. `~wall_super` |
| M6c | A super sprint shall read as a speedster, not a shape sliding | The eye decides. Reference: his word, "no legs running in slow motion" | N9 · N11 | M | D | The judge, then he, at 1× and ¼ from the game's camera. `film.mjs` |
| **M7** | **Slopes** | | | | | |
| M7a | The walkable slope limit shall lie between 35° and 45° (ours) | "Looks climbable" needs a number. `hero.js` sets 42° | N11 · QS-A7 | M | T | Climbs 20°, 35°, 41°; refuses 45°, 55°; steps as set. `rates.mjs` A7, A7s, `move_walls.mjs` M7 |
| M7b | On steps and slopes a move the path takes and gives back shall be at most 1 cm a frame | No stair-step jitter | N11 · steal §2 | M | T | `move_walls.mjs` M7b |
| M7c | At the limit or a wall his speed shall reach zero within 0.25 s (ours) with no stuck state | Stops him cleanly | N11 · QS-A3 | M | T | Stick away moves him at once. `move_walls.mjs` M7 |
| M7d | Run speed up a 35° slope shall be at most 60% of flat speed (ours) | No slowdown at all before | N11 | S | T | `move_walls.mjs` M7 |
| **M8** | **Wade and shore** | | | | | |
| M8a | His height shall change at most 8 cm a frame (ours) crossing the shore either way | A 54 cm step in a frame before | N11 · N10 | M | T | Both directions, at run. `move_walls.mjs` M8, plant: the depth flip back |
| M8b | In water 0.4 to 1.2 m deep (ours) he shall wade at no more than 60% of run speed (ours) | Deep water, wading, land, and back | N11 · N10 | S | T + D | Wade state, speed read; the judge sees the splash at the knees in a clip. `move_walls.mjs` M8b |
| **M9** | **The surface** | | | | | |
| M9a | With no input at the surface he shall tread within 0.3 m of sea level (ours) | | N2 · N17 | M | T | `~wall_swim` |
| M9b | A climb at boost speed shall breach into the air, T2 playing at the crossing | | N2 · N17 | M | T | `look_shots.mjs --cross` |
| M9c | A fall from the air shall enter the water, T3 playing at the crossing | | N2 · N17 | M | T | `look_shots.mjs --cross` |
| **M10** | **Surf** | | | | | |
| M10a | Surfing shall be a state of its own with `surf_*` clips, on a rising wave | His ask | N13 | M | T | State reads `surf`, wave under him. `~wall_surf`, `input.mjs` |
| M10b | The stick shall carve his heading while surfing | | N13 | M | T | Turn rate follows the stick. `~wall_surf` |
| M10c | Boost shall set surf speed, up to 26 m/s | | N13 | M | T | Speed never over 26. `~wall_surf` |
| M10d | Jump shall launch him off the wave | | N13 | M | T | `~wall_surf` |
| M10e | Surfing shall show a spray trail and a swell under him | | N13 | S | I | Both seen in the clip. `film.mjs` |
| M10f | Surfing shall work in the Storm Surge event | | N13 · G5 | S | T | The event's waves carry him. `g_events.mjs` |
| M10g | A ride shall end in a dive or on a beach | No dead end | N13 | M | T | Bot rides a course to each ending; also by touch. `~wall_surf`, `input.mjs` |
| **M11** | **Ride a whale or a dolphin** | | | | | |
| M11a | He shall mount, ride and leave a whale or a dolphin with no stuck state | | N7 | S | T | Bot does it. `~wall_ride` |
| M11b | His hands shall stay within 5 cm (ours) of the grip while riding | A real grip pose | N7 | S | T + D | Read from the bones, then the judge reads a clip. `~wall_ride`, `film.mjs` |
| **M12** | **Swim is smooth at every speed** | | | | | |
| M12a | Through tread, slow, fast, boost and super every drawn joint shall stay within M3b's bound | | N2 · N7 | M | T | `~wall_pose` on the swim set |
| M12b | He shall bank into a swim turn, at least 10° at full stick at cruise (ours) | | N2 | S | T | `~wall_swim` |
| M12c | His whole body shall stay in view at every swim speed | | N2 | M | T | Bounding box inside the viewport on every frame, upright and turned. `~wall_camera` |
| **M13** | **Camera** | | | | | |
| M13a | The camera shall ride a spring arm driven by `formulas/follow.js` | The method is the epic's | N7 · QS-A5 | M | I | `formulas.mjs` |
| M13b | The camera shall stay out of walls | | QS-A5 | M | T | `play.mjs` A5w |
| M13c | The camera shall stay above ground | | QS-A5 | M | T | `play.mjs` A5 |
| M13d | The Warden shall stand at least 60 px tall on screen at every speed on a phone, both orientations | `ART.md`. "At 36 m/s he's a dot" | N7 · N9 | M | T | Smallest height printed. `~wall_camera` |
| M13e | In a lock-on fight the Warden and the target shall both be in view on at least 95% of frames (ours) | A close camera hides foes | [Sheth19] | S | T | Bot fight. `~wall_camera` |
| **M14** | **Fluidity, to the reference** | | | | | |
| M14a | The longest stretch with no input accepted in any chain of actions shall be at most 0.33 s, being hit and death aside | His reference: next action 0.13-0.33 s after contact. Combo clips hold it longer now | N26 · [RefClip] | M | T | Longest stretch printed by action. `~wall_fluid`, plant: a long recovery |
| M14b | Every action shall take the next action from its cancel frame | No dead frames | N26 · [FrameData] | M | T | Frame table against the running game. `~wall_frames` |
| M14c | A press up to 0.15 s (ours) before a cancel frame shall fire at that frame | Inputs are buffered, and survive hit-stop | N26 · [Sakurai22] | M | T | `~wall_fluid`, plant: no buffer |
| M14d | Speed across a run into a blow, a blow into a dodge and a dodge into a blow shall keep at least 80% (ours) | Momentum carried through | N26 | S | T | Read across each pair. `~wall_fluid` |
| M14e | His facing shall turn at most 720°/s (ours) | The body never snaps to a new facing | N26 | S | T | `~wall_fluid` |
| M14f | `DESIGN.md` shall hold the counted blow length, recovery, cancel windows, dodge length and hit-stop, with how they were counted | Timing comes from the clip's frames | N26 | M | I | §Combat is in; §Movement owed |
| M14g | A run, blows and a dodge in a chain shall match the fluidity of `reference/fluidity_ref_action_rpg.mp4` | The eye decides | N26 | M | D | He and the judge, at 1× and ¼, beside the reference. `film.mjs` |
| **M15** | **Tidepulse: boost is a beat** (fan row, §19) | | | | | |
| M15a | A boost pressed in time with the kick shall step his speed up one of three tiers | Swimming as a joy in itself, fans' first want. Extends M12 | N20 · N2 | S | T | Each tier's speed in `DESIGN.md`. `~wall_swim` |
| M15b | A missed beat shall hold his tier | Never stalls him | N20 | S | T | `~wall_swim`, plant: a miss resets |
| M15c | Held boost shall give tier 1 | A phone player is never locked out | N20 · QS-C1 | S | T | `input.mjs` |
| M15d | Each tier shall show a bigger wake, a lower pitch and a wider camera | | N20 | S | I | Seen in the clip. `film.mjs` |
| M15e | Plain swimming shall cost no stamina | | N20 | S | T | `~wall_swim` |

## 3. Powers and combat (POW). Owner: combat

His words: "water attacks and ice powers" · "powers and fights".

Two elements, one trident. Water and Ice are stances: one button switches them, the Warden's glow lines go cyan or pale ice, and the four power buttons change (was three: CR-7).

Water's slots are Riptide, Maelstrom, Tidal Wave and Geyser. Ice's are Frost Lance, Glacier, Winter's Breath and Ice Path. Water Whip fires on Strike at range, and Frost Guard is Parry in Ice stance. There's no Dodge button: Boost dodges. Source: `web/data/combat.json`, `stances` and `moves`, on disk since 23:58. The game reads it once combat installs its build.

Every move's numbers live in `web/data/combat.json`, startup, active, recovery and cancel at 60 frames a second, with a table in `DESIGN.md`. P1 and P2 share one pass line: all ten powers fire by touch and by key, in both engines, and do what their row says.

| ID | Requirement | Why | Source | Pri | V | Acceptance and check |
|---|---|---|---|---|---|---|
| **P1** | **Water stance** | | | | | |
| P1a | Strike at range in Water stance shall fire Water Whip, which grabs a target and pulls it in | No slot of its own | N14 | M | T | `input.mjs`, `~wall_powers` |
| P1b | Riptide shall be a torpedo strike | Exists as dash | N14 | M | T | `input.mjs`, `~wall_powers` |
| P1c | Maelstrom shall spin foes in a vortex | Exists as spin | N14 | M | T | `input.mjs`, `~wall_powers` |
| P1d | Tidal Wave shall send a rolling wall forward | Exists as wave | N14 | M | T | `input.mjs`, `~wall_powers` |
| P1e | Geyser shall throw foes up on a column of water |  | N14 | S | T | `input.mjs`, `~wall_powers` |
| **P2** | **Ice stance** | | | | | |
| P2a | Frost Lance shall be a thrown spear that freezes | | N14 | M | T | `input.mjs`, `~wall_powers` |
| P2b | Glacier shall burst ice spikes from the ground in a line |  | N14 | S | T | `input.mjs`, `~wall_powers` |
| P2c | Winter's Breath shall slow, then freeze, in a cone |  | N14 | S | T | `input.mjs`, `~wall_powers` |
| P2d | Ice Path shall freeze the sea under him while surfing, for him to skate on | Needs M10 | N14 · N13 | M | T | `input.mjs`, `~wall_powers` |
| P2e | Parry in Ice stance shall be Frost Guard, freezing the attacker | No slot of its own | N14 | M | T | `input.mjs`, `~wall_powers` |
| **P3** | **Elements combine** | | | | | |
| P3a | Soaked plus frozen shall shatter for at least 2× a normal hit (ours) | | N14 | M | T | `~wall_elements` |
| P3b | A frozen enemy shall be smashable |  | N14 | S | T | `~wall_elements` |
| P3c | A frozen water surface shall hold for 8 s |  | N14 | S | T | 8 ± 0.1 s. `~wall_elements` |
| P3d | Ice shall block a geyser | | N14 | S | T | `~wall_elements` |
| P3e | The game shall have at least four named interactions |  | N14 | S | I | Listed in `combat.json` |
| P3f | Each interaction shall be taught once | Teach in four beats | N14 · [Hayashida12] | S | T | A first-use tip fires once, per save. `first.mjs` |
| **P4** | **Melee** | | | | | |
| P4a | Attack shall chain a three-hit combo | | N2 · N18 | M | T | `input.mjs`, `~wall_frames` |
| P4b | Launchers shall lift foes | | N18 | S | T | `~wall_frames` |
| P4c | Aerial strikes shall land in the air | | N18 | S | T | `~wall_frames` |
| P4d | A plunge from the air shall strike below him | | N18 | S | T | `~wall_frames` |
| P4e | A press of Boost in a fight shall dodge for 0.27-0.33 s with invulnerable frames | His reference's dodge. No Dodge button | N18 · N26 · [RefClip] | M | T | A blow in those frames does 0. `~wall_frames` |
| P4f | Parry shall stop a blow inside its window | P8c sets the window | N18 | M | T | `input.mjs`, `~wall_telegraph` |
| P4g | A finisher shall work on a stunned foe | | N18 | S | T | `~wall_frames` |
| P4h | A landed hit shall hold the bodies up to 0.03 s on a light blow and 0.07-0.10 s on a heavy one, the camera moving on | His reference never freezes the whole frame | N26 · [RefClip] [Sakurai22] | M | T | Read per blow. `~wall_frames` |
| P4i | A landed hit shall shake the camera, unless shake is off | QS-E3 says it can be turned off | N18 · QS-E3 | M | T | Off gives amplitude 0. `motion.mjs` |
| P4j | A landed hit shall play its sound and throw sparks | | N18 | M | I | Seen and heard in the clip. `film.mjs` |
| P4k | `DESIGN.md` shall hold the frame data table for every move | Startup, active, recovery, cancel | N18 · [FrameData] | M | I | Table matches `combat.json`. `~wall_frames` |
| P4l | The drawn weapon shall touch what its hit box hits | A named defect | [ISTQB] | S | T | Tip distance at each hit. `~wall_frames` |
| P4m | Boost held from a dodge shall run on into the boost | Nothing stops dead | N26 | M | T | `~wall_fluid` |
| **P5** | **Call of the Deep** | | | | | |
| P5a | Call shall summon a shark pack | Exists | N7 | S | T | `input.mjs` |
| P5b | Call shall later summon a whale's breach | Becomes Shoalsong's top tier (P13e) | N7 | C | T | `input.mjs` |
| **P6** | **Enemies** | | | | | |
| P6a | The game shall have at least 9 enemy kinds from this list: Reaver, Reaver Captain, Reaver Archer, Siren, Shark, Hammerhead, Moray, Anglerfish, Giant Crab, Frost Wight, Magma Husk |  | N18 | S | I | Listed in `combat.json` |
| P6b | Each kind shall have one stated counter: Captain's shield frozen or parried, Archer's harpoons, Siren's charm broken by a whip, Hammerhead's paired charge, Moray's ambush, Anglerfish's lure, Crab's armour shattered |  | N18 | S | I | Listed; each proved by the bot's win |
| P6c | The bot shall beat every kind | | N18 | M | T | `~bots` |
| P6d | Reaver raiders shall fight on the beach | | N18 · N10 | S | T | `~bots` |
| P6e | Every telegraph shall read clearly to a person on a phone | The eye decides | N18 · §1.4 | M | D | The judge, on a clip at phone size, in both looks |
| **P7** | **Bosses** | | | | | |
| P7a | The game shall have the Leviathan (arena), the Kraken (ship graveyard, tentacles to freeze and sever), the Frost Wyrm (ice sea) and the Cinder Colossus (vents) | The Kraken ends The Drowned Fleet (G1f) | N18 | S | I | Leviathan exists; the others are Round 3 |
| P7b | Each boss shall have three phases | | N18 | M | T | Each phase reached. `bossfight.mjs` |
| P7c | Each boss shall have a real intro | C1 | N18 | S | I | Each boss's shot list. `film.mjs` |
| P7d | The bot shall beat each boss | | N18 | M | T | `bossfight.mjs` |
| **P8** | **Telegraphs are fair** | | | | | |
| P8a | Every enemy blow shall show a visible telegraph at least 0.5 s before its first active frame | 0.5 s leaves about 0.2 s after reaction and input lag. Changed from "or a sound cue": X4 | §1.1 · N18 · [MHP] [Thompson18] | M | T + A | Shortest printed by enemy and blow. `~wall_telegraph`, plant: a 0.2 s telegraph |
| P8b | Every enemy blow shall also have a sound cue | Helps, but a phone is often muted | N18 · QS Part 3 | S | I | Heard in the clip |
| P8c | The parry window shall be at least 0.4 s (ours) | `parry` reads 0.43 s today. Wider than any game's, for touch | N18 · [Parry] | M | T | `moves.json` `guard` read at runtime. `~wall_telegraph` |
| P8d | An attacker off screen shall show on screen before it strikes | A close camera hides foes | [Sheth19] | S | T | Bot fight, marker seen for each. `~wall_telegraph` |
| P8e | At most 2 enemies (ours) shall attack at once, by token, none starting during a finisher | Fair crowds. Token counts are a difficulty setting | [Thompson18] | M | T | Most active at once, printed. `~wall_telegraph` |
| **P9** | **Upgrades** | | | | | |
| P9a | Pearls and relics shall buy levels at shrines | | N7 · N18 | S | T | `state.mjs` |
| P9b | Health, tide, speed and each power shall have 3 levels | | N18 | S | I | Listed in `combat.json` |
| P9c | The total price of all levels shall be 100-120% (ours) of what a full game can collect | Sinks a bit larger than sources | [Cook21] | S | A | Sum from the game's own data, printed. `g_collect.mjs` |
| P9d | Each level shall make a visible change | | N18 | S | I | Seen in the clip |
| P9e | Levels shall survive a reload |  | N18 | S | T | `state.mjs` |
| **P10** | **Balance** | | | | | |
| P10a | Bots at three skill levels shall play each chapter | | N16 · [ISTQB] | M | T | `~bots` |
| P10b | A chapter shall be winnable with no parry | | N16 | M | T | `~bots`, parry off |
| P10c | A death shall lose no progress | | N16 · [XAG108] | M | T | `state.mjs` |
| P10d | Difficulty shall change at any time, among at least 3 presets (ours), with no loss of progress | The guideline says four or more, and isn't a checklist | [XAG108] | S | T | `state.mjs`, `~bots` |
| **P11** | **Impact, to the reference** | | | | | |
| P11a | A blow's burst shall start on the contact frame | | N26 | M | T | Burst frame equals hit frame. `~wall_impact` |
| P11b | The burst shall layer a white core, crescent, sparks, a lit shockwave on big blows, a magic circle on casts, and a screen punch | The layering in `DESIGN.md` | N26 · [RefClip] | M | I | Each layer seen in the clip. `film.mjs` |
| P11c | A light blow's burst shall end within 0.33 s | Only as long as the blow | N26 · [RefClip] | S | T | `~wall_impact` |
| P11d | The bright area of a burst shall stay at or under 10% of the frame (ours) | The reference's largest is 7.4%. Keeps it under the flash rule (X5) | N26 · [RefClip] · QS-E3 | M | T | Read off the frame, in a three-hit chain. `motion.mjs` E3f, `~wall_impact` |
| P11e | Blows shall read big and clear on a phone, to the reference | The eye decides | N26 | M | D | He and the judge, at phone size, beside the reference. `film.mjs` |
| **P12** | **Stances** (was the prose above this table) | | | | | |
| P12a | One button of its own shall switch Water and Ice | Key X. The fourth slot's key is G | N14 | M | T | `input.mjs` |
| P12b | The Warden's glow lines shall go cyan in Water and pale ice in Ice | | N14 | M | I | Stills of both. `stills.mjs` |
| P12c | Ice shall stay locked until Rimehold (W7) | "Ice powers are earned here" | N14 | M | T | `playthrough.mjs` |
| **P13** | **Shoalsong: sea life as an everyday power** (fan row, §19) | | | | | |
| P13a | Holding the power shall spread a ring that makes the creatures it touches follow him for about 20 s (ours) | Fans' top want after swim feel. P5 is only a summon | N20 · N7 | S | T | Followers counted, time printed. `~wall_powers` |
| P13b | Each kind shall have one job: a school shields, rays light the dark, turtles lift him, sharks hunt what he marks, a whale breaks armour | The world's own schools are the army, so W15 pays twice | N20 | S | T | Each job proved once. `~wall_powers` |
| P13c | At least one followable kind shall be in reach anywhere on the map (ours) | Unreliable summons were the old failure | N20 | S | T | Bot samples the map at each spot. `~wall_powers` |
| P13d | The codex (G6) shall teach Shoalsong as species are logged | It pays for itself | N20 | C | T | `g_collect.mjs` |
| P13e | P5's summons shall be its top tier | Keeps P5's meaning | N20 | C | I | Listed in `combat.json` |
| **P14** | **Homeward Cast: throw and recall the trident** (fan row, §19) | | | | | |
| P14a | He shall throw the trident and call it back from anywhere | Adds to P4 | N20 · N18 | S | T | `input.mjs`, `~wall_powers` |
| P14b | It shall hit on the way back, on a curved path that bends through enemies | | N20 | S | T | Hits read on return. `~wall_powers` |
| P14c | It shall arrive within 1.5 s of the call | | N20 | S | T | Longest return printed. `~wall_powers` |
| P14d | The catch shall leave him free to act | | N20 · N26 | S | T | M14a holds through it. `~wall_fluid` |
| P14e | The sound shall come from the weapon | | N20 | C | I | Heard in the clip |

## 4. The world (WORLD). Owners: world (data, art), look (rendering)

His words: "underwater cities and land too" · "the land mass look better and actual grasslands too and we can have better quality buildings and terrain and all" · "We need different biomes too".

The map grows to 2,048 x 2,048 m (grid 1,025, 2 m a sample), so each biome has room. Each has its own palette, creatures, structures, music mood and one thing you see from far off.

**W1-W11 each read:** the map shall hold this biome with everything listed. Why: "We need different biomes too". Source: N10, N19, and N15 for W9-W11. V: I + D. Acceptance: `check_world.py` finds each named thing in the world data, `look_shots.mjs` takes a still of each biome, and he looks.

| ID | Biome | What it must have | Pri |
|---|---|---|---|
| W1 | Reef Shelf | coral heads, sand flats, the sea arch, reef fish, turtles | M |
| W2 | Kelp Cathedral | kelp naves, sun shafts, rock pillars, sea otters at the top | M |
| W3 | Thalor, the Drowned City | marble avenues, the Colossus, the Sunken Arena | M |
| W4 | Meridon, the Gilded City | domes, towers, bridges, gold windows, living citizens (ghost lights) | M |
| W5 | The Vesper Deep and the city of Vesper | cliff city in cold cyan, bioluminescence, anglerfish | M |
| W6 | Cindermere, the Vent Fields | black smokers, lava cracks, red glow, ash snow, heat currents | M |
| W7 | Rimehold, the Frozen Sea | an ice ceiling with light through it, blue caves, ice pillars, narwhals, seals. Ice powers are earned here | M |
| W8 | Wrackreach, the Ship Graveyard | hundreds of wrecks, fog, ghost lanterns, the Kraken's lair | S |
| W9 | Sunward Isle (land) | **real grasslands:** rolling meadows with wind in dense grass, wildflowers, oak-like trees, stone walls, Sunward Hollow village, a harbour with wooden piers and fishing boats, a lighthouse | M |
| W10 | Crown Isle (land) | volcano, jungle, waterfall, river, black beaches, temple stairs | S |
| W11 | Frost Isle (land) | snowfields, ice cliffs, a fortress on the ice shelf | S |

| ID | Requirement | Why | Source | Pri | V | Acceptance and check |
|---|---|---|---|---|---|---|
| **W12** | **Terrain quality** | | | | | |
| W12a | Terrain shall show no visible polygons from 3 m (ours) | A human call | N15 | M | D | He and the judge, on stills at 3 m. `look_shots.mjs` |
| W12b | Terrain shall carry detail normals |  | N15 | S | I | Stills with them on and off. `look_shots.mjs` |
| W12c | Cliffs shall show strata | | N15 | S | I | Stills. `look_shots.mjs` |
| W12d | Beaches shall show wet sand and foam | | N15 | M | I | Stills. `look_shots.mjs` |
| W12e | Rivers shall run downhill to the sea | | N15 | S | T | Height falls along each river. `check_world.py` |
| W12f | QS-A3 to QS-A5 shall hold on every landform | | N15 · QS-A3 · QS-A4 · QS-A5 | M | T | Bot walks land as well as sea. `play.mjs` A3, A4, A5 |
| **W13** | **Building quality** | | | | | |
| W13a | The world shall have a kit for each culture: marble, gilded, cliff, ice, timber village | | N15 | M | I | Listed in `assets.json`. `check_world.py` |
| W13b | Each kit shall have bevels, trim, cornices, fluted columns, roof tiles, and doors and windows with depth | Real architecture | N15 | M | I | Stills at 3 m. `look_shots.mjs` |
| W13c | Building pieces shall carry baked ambient occlusion in vertex colour | | N15 | S | T | Vertex colour varies across each piece. `check_world.py` |
| W13d | Every building piece shall have at least 40 triangles (ours) | "No flat boxes". A box has 12 | N15 | S | T | Smallest piece printed. `check_world.py` |
| W13e | Each kit shall show weathering and moss | | N15 | S | I | Stills. `look_shots.mjs` |
| W13f | Buildings shall read as real architecture from 3 m | The eye decides | N15 | M | D | He and the judge, on stills at 3 m. `look_shots.mjs` |
| **W14** | **Collision from meshes** | | | | | |
| W14a | Colliders shall be generated from each piece's own mesh | Hand-sized boxes were the old bug | N16 · QS-A1 · QS-A8 | S | I | The builder's script, read. `check_world.py` |
| W14b | Every doorway that looks open shall let him through | | QS-A2 | M | T | `collide.mjs` |
| W14c | A charge at any solid at real speed shall end outside it | 2 of 360 ended inside at the last gate | QS-A1 | M | T | Each charge has a control that gets in. `collide.mjs` |
| W14d | `check_world.py` shall pass on every world build | | N16 | M | T | `check_world.py` |
| **W15** | **Life everywhere** | | | | | |
| W15a | The world shall have at least 25 species | | N7 | S | I | Counted in the world data. `~wall_life` |
| W15b | Schools shall turn as a group | Real behaviour | N7 | S | T | Neighbours' headings agree. `~wall_life` |
| W15c | Birds shall fly over land | | N7 | S | I | Stills. `look_shots.mjs` |
| W15d | Crabs shall walk the beaches | | N7 | C | I | Stills. `look_shots.mjs` |
| W15e | Deer or goats shall graze the meadows | | N7 | C | I | Stills. `look_shots.mjs` |
| **W16** | **Day, night and weather** | | | | | |
| W16a | A day shall last 14 minutes ± 1 (ours) | "About 14" needs a band | N18 | S | T | `~wall_daynight` |
| W16b | The night shall show stars and a moon | | N18 | S | I | Stills. `look_shots.mjs` |
| W16c | The night sea shall show bioluminescence | | N18 | S | I | Stills. `look_shots.mjs` |
| W16d | The game shall have storm, rain and fog | | N18 | S | I | Stills. `look_shots.mjs` |
| W16e | Q1 to Q7 shall hold at night and in a storm | "All on a phone" | §1.4 | S | T | `perf.mjs` in those states. `~wall_daynight` |
| **W17** | **Streaming at 48 m/s** | | | | | |
| W17a | Every frame at 48 m/s shall take at most 50 ms | Top speed, QS-B4. Worst today 34.7 ms, turned, test page | N9 · QS-B4 | M | T | Longest run on the full map, upright and turned. `pace.mjs` B4s, `turned.mjs` B4st, at 45 m/s today |
| W17b | The view at 48 m/s shall hold no unloaded ground | No holes | N9 | M | T | Sky pixels below the horizon line: 0. `~wall_holes` |
| W18 | The map shall be 2,048 × 2,048 m, grid 1,025, 2 m a sample | Room for each biome: his "different biomes" need it. Was prose above W1. Now 1,280 m, 513 | N19 | M | T | Read from `world.json`. `check_world.py` |
| **W19** | **Each biome is its own place** (was prose above W1) | | | | | |
| W19a | Each biome shall have its own palette, creatures, structures and music mood |  | N19 | S | I | One sheet of all biomes in story order (`[ColourScript]`). `look_shots.mjs` |
| W19b | Each biome shall have one thing seen from far off | `ART.md` | N19 · [BOTW17] | M | I | A still from 300 m (ours) each. `look_shots.mjs` |
| **W20** | **Vigil Light: dread in the deep dark** (fan row, §19). Owners: look, combat | | | | | |
| W20a | Below a set depth in the Vesper Deep the only light shall be the trident's pulse | Fans praise this fear. Ours, not the film's: no flare, no red light, no fall through a column of monsters | N20 | S | T | Light sources read below the line. `~wall_dark` |
| W20b | Each pulse shall show the swarm, the Gloam, flinching from the light, for about 2 s (ours) | The fear is how many there are | N20 | S | T | `~wall_dark` |
| W20c | A bell strike shall clear the swarm | | N20 | S | T | `~wall_dark` |
| W20d | The Warden and his objective shall stay readable in the dark | Dark must not hide the game | QS-E2 · P8a | S | T | L6 and P8a read there. `~wall_read` |
| W21 | Each of W3-W8 shall have one people with one animal, one depth band and one temperament | The Six Holds pattern, from `REFERENCES.md` §b2. It gives the places a reason to differ. Bell Claim isn't in this baseline. Fan row, §19 | N20 | C | I | The table, in the game's data, read against the places. Names unchecked (S2b) |

## 5. Missions, events, collectibles (GAME). Owner: missions

| ID | Requirement | Why | Source | Pri | V | Acceptance and check |
|---|---|---|---|---|---|---|
| **G1** | **Story in seven chapters** | | | | | |
| G1a | The story shall run in order: Waking (reef), The Green Nave (kelp), The Gilded City (Meridon), Cold Water (Rimehold: ice), Fire Below (Cindermere), The Long Dark (Vesper), The Sunken Arena (Leviathan), then Thalor Wakes and free roam |  | N18 | M | I | Listed in `missions.json`. `g_data.mjs` |
| G1b | Each chapter shall have at least 3 objectives, a place, a fight and a reward |  | N18 | M | I | Counted from `missions.json`. `g_data.mjs` |
| G1c | The bot shall finish the story | A mission that never advances is a failure by name | N18 · QS-A3 | M | T | Names any mission that stalls. `g_story.mjs`, `playthrough.mjs` |
| G1d | Cold Water shall have a surface act on Frost Isle (W11) | Puts an isle on the story's path | N18 · N19 | S | T | Bot finishes it. `playthrough.mjs` |
| G1e | Fire Below shall have a surface act on Crown Isle (W10) | Puts an isle on the story's path | N18 · N19 | S | T | Bot finishes it. `playthrough.mjs` |
| G1f | The Drowned Fleet, an optional arc after Chapter 4, shall end at the Kraken in Wrackreach (W8) | Gives the Kraken a place in the story | N18 | S | T | Bot finishes it. `playthrough.mjs`, `bossfight.mjs` |
| G1g | The completion count shall reach 100% only with The Drowned Fleet done | The arc is optional but counts | N18 | S | T | Short of it, the count stays under 100. `g_collect.mjs` |
| **G2** | **People** | | | | | |
| G2a | The game shall have at least 8 named people, with dialogue boxes and portraits, in the village, the harbour and the cities | | N18 | S | T | Bot talks to each. `playthrough.mjs` |
| G2b | Every person's name shall be original | | §1.6 | M | I | S2b's search |
| G3 | The game shall have at least 12 side missions, among them nets to cut, lost divers, a wounded whale, a stolen bell, a lighthouse to relight and a sunken treasure hunt |  | N18 | S | T | Bot finishes each. `g_side.mjs` |
| **G4** | **Challenges** | | | | | |
| G4a | Challenges shall cover super speed ring runs, surf runs and arena waves |  | N18 · N9 | S | T | Bot finishes one of each. `g_side.mjs` |
| G4b | Each challenge shall save a best time | | N18 | S | T | Survives a reload. `state.mjs` |
| **G5** | **World events** | | | | | |
| G5a | The game shall have at least 6 world events: a Reaver raid on the village, a shark frenzy, a whale migration, a bioluminescent bloom at night, the Storm Surge, a sunken star |  | N18 | S | T | Each fires. `g_side.mjs` |
| G5b | Each event shall be announced, optional and rewarded | | N18 | S | T | Each ends and pays; ignored, it passes. `g_events.mjs` |
| **G6** | **Collectibles** | | | | | |
| G6a | Pearls and chests shall be collected and counted | | N18 | M | T | `g_collect.mjs` |
| G6b | The game shall have 20 relic tablets of lore | | N18 | S | T | `g_collect.mjs` |
| G6c | A codex shall log every species he swims near | | N18 | S | T | `g_collect.mjs` |
| G6d | The game shall have 5 trident forms | | N18 | C | I | Listed in the game's data |
| G6e | The game shall have 3 Warden outfits | No orange and green (`ART.md`) | N18 | C | I | Stills. `stills.mjs` |
| G6f | Each counter shall show how many are left and survive a reload | Progress in plain numbers | N18 · [XAG109] | S | T | `state.mjs` |
| **G7** | **Screens** | | | | | |
| G7a | A map shall show the world through fog of war | | N18 | M | T | `g_screens.mjs` |
| G7b | A quest log shall show current and finished objectives at any time | `[XAG109]` | N18 · [XAG109] | M | T | `g_screens.mjs` |
| G7c | Fast travel shall run between shrines | | N18 | S | T | `g_screens.mjs` |
| G7d | The codex shall have its own screen | | N18 | S | T | `g_screens.mjs` |
| G7e | Upgrades shall have their own screen | | N18 | S | T | `g_screens.mjs` |
| G7f | Settings shall hold music, sound, shake, camera speed, look and reduced flashing | | N18 · QS-E3 · QS-D3 | M | T | Each saved across a reload. `focus.mjs` D3, `g_screens.mjs` |
| G7g | Every screen shall pass QS-C1 to QS-C6 and QS-E1 to QS-E4 | Thumb-friendly | QS-C1 · QS-E1 | M | T | `ui.mjs`, `input.mjs`, `contrast.mjs`, `motion.mjs` |
| G7h | The HUD's parts shall stay clear of the vitals, the buttons, the stick and each other, upright and turned | From `g_hud.mjs`, where missions built it | N18 · QS-C3 | M | T | `g_hud.mjs` |
| **G8** | **Onboarding** | | | | | |
| G8a | A new player shall be in control within one tap | | QS-G1 | M | T | Taps counted from first paint. `first.mjs` |
| G8b | The game shall teach through play | The eye decides | QS-G2 | M | D | The judge, watching a first play. `film.mjs` |
| G8c | Each power shall be taught in four beats: a safe try, a harder use, a twist, a test | | [Hayashida12] | S | D | The judge, against `missions.json` |
| G8d | The controls shown shall be the device's own | | QS-G2 | M | T | Touch hints on touch, keys on desktop. `first.mjs` |
| G8e | Onboarding shall be skippable | | QS-G2 | M | T | `first.mjs` |
| **G9** | **Saves** | | | | | |
| G9a | Every step shall survive a reload |  | N18 · QS-F3 | M | T | A returning player walked. `g_saves.mjs` |
| G9b | The game shall run with storage blocked | | QS-F3 | M | T | `state.mjs` |
| G9c | A returning player shall resume where they were | A page is never reloaded once it was shown | QS-F3 | M | T | `g_saves.mjs` |
| G9d | Saves shall use the platform's bridge when it's there, local storage otherwise | | QS-F3 | S | T | Both paths. `state.mjs` |
| **G10** | **Omens: events seen from far off** (fan row, §19) | | | | | |
| G10a | Every G5 event shall show from at least 300 m (ours) first: a gyre of birds, a storm column, a glowing wake, a falling star | The surprise on the horizon draws you over | N20 | S | I | A still of each from 300 m. `look_shots.mjs` |
| G10b | An omen shall show every 2-3 minutes on the full map (ours) | Encounters matter more than map size | N20 | S | T | Gaps printed. `g_events.mjs` |

## 6. The look (LOOK). Owner: look

| ID | Requirement | Why | Source | Pri | V | Acceptance and check |
|---|---|---|---|---|---|---|
| **L1** | **Looks are data, and switch live** | | | | | |
| L1a | Each look shall be a table of colours, ramps, grades and flags in `web/js/looks/`, on one shader family | | N25 | M | I | `real.js`, `painted.js` |
| L1b | The pause menu shall switch looks live | | N25 | M | T | `input.mjs` |
| L1c | The chosen look shall survive a reload | | N25 | M | T | `state.mjs` |
| L1d | `?look=` shall set the look |  | N25 | S | T | `look_shots.mjs` |
| L1e | Twenty switches shall leave programs, textures and geometries unchanged | "Save the looks so we can switch back" | N25 | M | T | `look_shots.mjs --flips` |
| **L2** | **The Painted look, to the references** | | | | | |
| L2a | The Painted look shall follow the recipe in `REFERENCES.md` §f, under no studio's name |  | N25 · §1.6 | S | I | Read against the recipe. `static.mjs` Q20 for the name |
| L2b | The Painted look shall stand beside the references: teal sea, huge peach cumulus, painted rocks and grass, soft shadow shapes, a limited ramp, a warm-cool shift in shadow | His words: "Make it work with that quality reference" | N25 · N26 | M | D | **He looks**, side by side with `reference/anime_ref_sunset.png`, `anime_ref_coast_page.jpg` and, for daylight, the clip. `look_shots.mjs` |
| L3 | Above water shall show sun, sky, clouds, sea to the horizon, foam and wet sand, at the quality of below | "As good as" is a human call | N15 | M | I + D | The list by stills, then he looks. `look_shots.mjs` |
| **L4** | **Phone smoothness** | | | | | |
| L4a | The phone tier shall draw with MSAA | "Make it look smoother and better on mobile". 4× costs about 40 MB here | N8 · [Arm-GPU] | M | I | `look.stats()` reads it on. `perf.mjs` |
| L4b | A still camera's frames shall differ by at most 2 of 255 in mean per pixel (ours) | No shimmer | N8 | S | T | Two frames apart, at 6 spots. `~wall_stills` |
| L4c | Skies and deep water shall show no banding | Judged by eye so far, after dither | N8 | S | D | The judge, on phone-size stills. `stills.mjs` |
| L4d | Particles shall fade at surfaces they meet | Soft particles | N8 | S | I | Stills. `stills.mjs` |
| **L5** | **Effects for every power** | | | | | |
| L5a | Every power shall have its own effect |  | N14 | S | I | Clip of each. `film.mjs` |
| L5b | Water effects shall read as thick water with foam and droplets, ice as crystal facets with cold glow and spreading frost, never flat brush strokes | The eye decides | N14 | M | D | He and the judge, on clips. `film.mjs` |
| L6 | The Warden and every enemy shall contrast at least 3:1 with what's behind them at 60 px tall, in both looks | Silhouette first (`ART.md`). The Painted ramp must not hide a telegraph | [TF2-07] · QS-E2 · N26 | M | T | Read at 10 bot spots. `~wall_read` |

## 7. The surface crossing (TRANS). Owner: look

His words: "when I transition to the surface, the screen goes black for a little. That's okay but it needs more."

| ID | Requirement | Why | Source | Pri | V | Acceptance and check |
|---|---|---|---|---|---|---|
| **T1** | **The black frames** | | | | | |
| T1a | No frame through a crossing shall read darker than 0.75 of the median brightness, with at most 5% dark pixels, either way, unless it's a declared beat | The wall's bound | N17 | M | T | `look_shots.mjs --cross` in both engines, `--plant` |
| T1b | The cause shall be written down | Remove it or make it deliberate: either answers him | N17 | S | I | Named in the check's status line |
| **T2** | **Going up** | | | | | |
| T2a | The waterline shall cross the lens with a meniscus, water sheeting off | | N17 | M | I | Clip at ¼. `look_shots.mjs --cross --clip` |
| T2b | Droplets shall run down the screen for about 1 s | | N17 | M | I | Clip at ¼. `look_shots.mjs --cross --clip` |
| T2c | A burst of light and sound shall mark the crossing | | N17 | M | I | Clip at ¼. `look_shots.mjs --cross --clip` |
| T2d | Spray shall burst around him | | N17 | S | I | Clip at ¼. `look_shots.mjs --cross --clip` |
| **T3** | **Going down** | | | | | |
| T3a | A splash shall mark the entry | | N17 | M | I | Clip at ¼. `look_shots.mjs --cross --clip` |
| T3b | Bubbles shall cross the lens | | N17 | M | I | Clip at ¼. `look_shots.mjs --cross --clip` |
| T3c | The sound shall drop to underwater | | N17 | M | I | Heard in the clip. `look_shots.mjs --cross --clip` |
| T3d | The light shall shift | | N17 | S | I | Clip at ¼. `look_shots.mjs --cross --clip` |
| T4 | A camera at the surface shall show both worlds, split by a moving waterline | Half in, half out | N17 | M | I | Still. `look_shots.mjs` |

## 8. Cinematics (CINE). Owners: missions (C1), lead (C2, C3), until a film builder starts once the map settles

| ID | Requirement | Why | Source | Pri | V | Acceptance and check |
|---|---|---|---|---|---|---|
| **C1** | **In-game cinematics** | | | | | |
| C1a | Cinematics shall run from a shot list held as data | | N22 | S | I | Read the data |
| C1b | A cinematic shall show letterbox bars | | N22 | S | I | Stills. `stills.mjs` |
| C1c | A cinematic shall skip on one tap | Poki asks for it | QS Part 3 · N22 | M | T | `g_screens.mjs` |
| C1d | A cinematic shall pause | | [XAG108] | S | T | `g_screens.mjs` |
| C1e | Cinematics shall cover the opening, each bell, each boss's arrival and the ending | The opening must keep G8a (X9) | N22 | S | I | Shot lists read |
| C1f | Q1 to Q7 shall hold in a cinematic | "Runs on a phone" | §1.4 | S | T | `perf.mjs` during a cinematic |
| **C2** | **Unreal trailer** | | | | | |
| C2a | The world's assets shall be lit in Unreal 5.3 through the bridge and filmed by Movie Render Queue on this M1, replaying the browser's recorded play | His first sentence: "with unreal engine and blender" | N1 · N23 | S | I | The film exists. Its log names the engine |
| C2b | Swap shall stay under 7 GB through the whole render | Swap sits at 6-7 GB already (R1). Needs builders stopped | N22 | M | T | Sampled through the render. `~swap_watch` |
| C2c | The post text shall name which shots are Unreal | §1.5 | §1.5 · N23 | M | I | S1's fact list |
| C3 | Browser films for reels shall come in the square layout's size and in vertical | | N22 · N5 | S | T | `film.mjs` |

## 9. Showcase and platform (SHOW). Owner: lead (S1, S2: missions)

| ID | Requirement | Why | Source | Pri | V | Acceptance and check |
|---|---|---|---|---|---|---|
| **S1** | **The true story** | | | | | |
| S1a | The stack panel and a public page shall state: an 8 GB M1 MacBook, Claude Code, Blender, three.js, NotesMosaic and the Rocketbox base bodies | The true stack | N22 · N2 · §1.5 | M | I | Read against `~fact_list` |
| S1b | Unreal shall appear only once C2 exists, and only for what it rendered | | N23 · §1.5 | M | I | Read against `~fact_list` |
| S1c | The panel shall show a viewer they could build this on NotesMosaic | "users can use our platform to build faster, high quality tech stack, and nice cinematics too" | N22 | M | D | He reads it |
| **S2** | **Names** | | | | | |
| S2a | The title shall pass a name check in Steam, the App Store, Google Play, itch.io, Roblox, Poki and CrazyGames, and the trademark register | "Thalor" sits near a Steam game, "Thalorian Arena"; the title changes before anything public | §1.6 | M | I | The search written down, with dates |
| S2b | Every invented public name shall pass a web search before it ships | Names from `REFERENCES.md` are proposals. W5's old name was DC's | §1.6 | S | I | The search written down |
| S3 | Reels shall sort into Eyes and Sales lanes, written with `Jakeschincariol/instagram-agent-skill`'s tools under `PATTERNS.md` | He records. His take is his | N5 · N6 | S | I | Each reel read against `PATTERNS.md` |
| **S4** | **"make this a standard in notesmosaic"** | | | | | |
| S4a | The method shall go into skill `game-framework` | | N21 · N24 | S | I | The skill's text read |
| S4b | The method shall go into the platform's MCP skills, on his word | | N21 | C | I | His word, dated, in §18 |
| S5 | Thumbnail, description, certify, launch and publish shall each happen on his word, after a real iPhone | Nothing goes public without him | N4 · §12 | M | I | His word, dated, in §18. Q12 passed first |

## 10. Rounds

Each round: build → freeze → walls and plants → second-session judge → fix → his link updated.

1. **Round 1:** MOVE M1-M9, TRANS, the land and grassland base (W9, W12), Painted look first pass (L1, L2), stances with Water and Ice basics (P1, P2).
2. **Round 2:** the map at 2,048 m with all biomes (W1-W11), building quality (W13), enemies (P6), surf (M10), GAME G1, G6, G7.
3. **Round 3:** bosses (P7), events, side missions, NPCs, upgrades, day and night, weather, cinematics (C1).
4. **Round 4:** the full quality map (34 of 34 or stated), plants, balance, the Unreal trailer, reels, the title, his real iPhone pass.

**Placed by systems, because the rounds above don't name them** (the Q rows hold in every round):

| Round | IDs |
|---|---|
| 1 | M13, M14, P4, P8, P11, P12 |
| 2 | M11, M12, M15, P3, P14, W14, W15, W17, W18, W19, W21, G8, G9, L3, L4, L5, L6 |
| 3 | P5, P13, W20, G4, G10, C3 |
| 4 | S1, S4, S5 |

## 11. Everything he asked for, in his words, and where it lives

Nothing is dropped. A new word from him gets a row here the moment it arrives.

| Time (31 Oct) | His words | Where |
|---|---|---|
| 21:30 | "Test it with our own AI and animation and rig it for a new game in notesmosaic with unreal engine and blender" | C2, §12 |
| 21:30 | "open world aquaman swimming game that is breathtaking and custom fighting animations and all and we give out the tech stack" | all of §2-§6, S1; original hero, §1.6 |
| 21:30 | "Use higgsfield open source to start the videos and then go for the rest" | §12 |
| 21:30 | "high quality AAA game out of this tonight so we can showcase and put on notesmosaic" | §10, S5 |
| 21:40 | "Use this repo to do the videos too" (`Jakeschincariol/instagram-agent-skill`) | S3 |
| 21:45 | "We need a content funnel for getting eyes on us then one fore getting sales. We need to categorize our reels like that" | done: `ContentFunnel/PATTERNS.md`, the two lanes; S3 |
| 21:46 | "Continue autonomously tonight until we finish and reach high quality. We need a real life figure and animals and movement and powers" | hero on Rocketbox base; W15; §2, §3 |
| 22:31 | "Make it look smoother and better on mobile" | L4 |
| 22:31 | "We need the super speed too" | live; M6, W17 |
| 22:31 | "We need underwater cities and land too" | W3-W5, W9-W11 |
| 22:53 | "look at how unnatural the movement is on land" | M1-M8 |
| 22:53 | "we need to be able to jump on land too" | M5 |
| 22:53 | "surf with water" | M10 |
| 22:53 | "water attacks and ice powers" | P1-P3, L5 |
| 22:53 | "the land mass look better and actual grasslands too and we can have better quality buildings and terrain and all" | W9, W12, W13 |
| 22:53 | "apply the game testing and dev standards we spoke about in our videos" | §1 |
| 22:53 | "when I transition to the surface, the screen goes black for a little. That's okay but it needs more" | T1-T4 |
| 22:53 | "details and powers and fights and structures and events and collectibles and missions" | §3, §4, §5 |
| 22:53 | "We need different biomes too" | W1-W11 |
| 22:53 | "look online and Reddit for the right aquaman references we can use to build our world" | `Pipeline/research/REFERENCES.md`, original versions only |
| 22:53 | "recorded in a requirements epic ... make this a standard in notesmosaic" | this file, S4 |
| 22:53 | "emphasize how this was made with an M1 Mac and users can use our platform to build faster, high quality tech stack, and nice cinematics too" | S1, C1, C2 |
| 22:53 | "You used unreal engine for this yeah and blender too right?" | answered: Blender yes, Unreal not yet; C2 |
| 22:53 | "done through the night so we come out swinging and can make another" | §10, S4 |
| 22:56 | "Check out this art style too. See if we can make it in this anime type style with our layout. Find the best tools and practices to do this and save the looks so we can switch back. Make it work with that quality reference" | L1, L2 |
| 23:00 | "Fluidity like this too. All must be logged in the requirements" | M14, P11, L2 (the same reference shows the grassland look) |
| 23:05 | "Apply correct standard proven systems engineering principles in this in the requirements and find those standards online for game dev and smoothness and combat and movement and animation and art style rtc" | `Pipeline/research/STANDARDS.md`, §1, the baseline's form |
| 05:46, 1 Nov | "the characters movement right now is very stiff and unnatural" · "The movement is very bad and not AAA" | M16 real motion data, CR-31 |
| 05:46, 1 Nov | "the world on mobile is empty with no other characters" | W20 life in frame, W21 real people, CR-31 |
| 05:46, 1 Nov | "we need to be able to jump high in the water and out" · "I need to be able to jump jump out the water like a dolphin and that's not working" | M17 dolphin leap, CR-31 |
| 05:46, 1 Nov | "be able to do water tornadoes up and shit" | P15 water tornado, CR-31 |
| 05:46, 1 Nov | "The land doesn't look naturally part of the map and flat currently on my build and so does fighting" | W22 natural land, M16, CR-31 |
| 05:46, 1 Nov | "What have you been doing all night?! I see 18 running tasks but nothing promising yet. Maybe the fixes are to come in the next build and I am impatient but I expected more" | CR-31 |
| 06:45, 1 Nov | "When in water, he has an unnatural arm bend and shit for idle. This is bad basic character model movement sir! We need to fix these basics before focusing on anything else. Pause on the missions for now and perfect the body movement and walking and all and staying idle in the water with the trident holstered when not needed" | M18 trident holstered, M19 natural body, CR-32 |
| 06:47, 1 Nov | "I need a showcase with unreal when this is done so I can share with my users" | C2, CR-32 |
| 07:05, 1 Nov | "I'll be recording the script and you work on the gameplay video I need to prove every step and with unreal" | C2, C3, CR-33 |
| 07:04, 1 Nov | "THE CHARACTER STARTS OFF WITH THE WORLD SPINNING TOO MUCH IN THE WORLD! How was this not caught!" | C1 look stops when the thumb lifts, CR-34 |
| 07:05, 1 Nov | "This happened in mobile and I started on land. I need to start at sea with the loading screen area" | G12 every session starts at sea, CR-34 |
| 07:07, 1 Nov | "Running is also unnatural and stiff on land" | M16, CR-34 |
| 07:07, 1 Nov | "Claude you are missing the mark here. How did all these pass the requirements and shit with our systems engineering principles." | CR-34 |
| 07:28, 1 Nov | "Good, get the unreal clips and movement and shit and all done well for my video prep" | C2, C3, M16, M19 |
| 09:22, 1 Nov | "THE HUD FOR MOBILE IS TERRIBLE! It has too many buttons! That is a rule we have set in the notesmosaic MCP. Look at how crowded it is! It’s ugly. We stick to the minimalistic diamond design and the shit we had last time but implementing the rest of the other features and a hotbar to equip different powers and all" · "You have access to the MCP and can fix it from there. I can’t believe this got passed" | G13, CR-36 |
| 09:43, 1 Nov | "NO! The hot bar must be on the middle! Look at Coleseum in the vertical and widescreen. We need to use best practice standard MMO type HUD for these games HUD. This is bad still" · "WE SPOKE ABOUT HAVING AAA STANDARDS AND THATS FOR BUTTONS TOO. Stop just coming up with shit and find the best layout that is industry standard and A/B tested" · "Search online for the standard" | G13, CR-36 |
| 10:00, 1 Nov | "Put the hot bar below that diamond and joystick buttons" | G13, CR-36 |
| 10:25, 1 Nov | "Make the repo public and publish the game on notesmosaic" | §12: the repo went public by his hand at 11:01; publishing never happened and waits on his word to the Mac session |
| 10:34, 1 Nov | "Okay good enough. Now to work on the game. The water on land is unnatural and I can’t sprint or climb uphill. I need to also be able to swim up waterfalls too." | M20, M21, W23 |
| 10:58, 1 Nov | "Great we posted. Clean up the repo" | done by the cloud session |
| 11:01, 1 Nov | "You can remove the Mac status and all. I made it public. Continue the game dev from here autonomously to make it fully AAA worthy" | all of §20 |
| 13:41, 1 Nov | "Yeah The waterfall looks disconnected from the land and is unnatural the next steps will make it better but it’s not done yet. We need the environment and nature and pieces to blend well. Also for the boost in land, we need the water animation and movement surf to be actually better and we need waves too we can surf once that happens. All this needs to be done well and tested and proven at the AAA standard. Not lazy work" | W23, M22, M23, CR-34 |
| 13:47, 1 Nov | "Yeah all the fighting and movement and ocean environment and actual cities with blocks underwater inspired by the [film title withheld] movie and real life land cities too and not just one building. You need to actually implement a full game here based on my standards and AAA" | W24, W25, M16, M19, P4, P11 |
| 14:06, 1 Nov | "The cities must come with the nice detail and textures of the art style too and look out of a comic book" | W24 |
| 14:24, 1 Nov | "The water needs to actually ride out on the ground too to make the river stream on ground. We have much work to do here" | W23 (about the waterfall: his 14:56 word) |
| 14:27, 1 Nov | "Max effort now. This is not to be played with" | all of §20 |
| 14:56, 1 Nov | "I’m talking about the waterfall" · "The land surf should leave some water too" | W23, M22 |
| 16:41, 1 Nov | "I had to the cloud claude work on this but it has been going slow and a little sloppy." · "find whats wrong and what's needed to complete the AAAA requirements and all and then give it to the fresh claude chat here so we can have part 2 ready for the video." | CR-35, §20 |
| 16:41, 1 Nov | "We want bosses and fire elemental villains too that can fly with fire thrusters and have their fire biomes and they fight." | V1, V2, V6, V7 |
| 16:41, 1 Nov | "Please adhere to our high quality requirements standard and ask the other cloud one for all the pet peeves I've had with the game dev of claude." | §1, `PET_PEEVES.md` on `main` |
| 16:41, 1 Nov | "I need the fire elementals to have the same set of powers as the water one with different kinds of fire powers and fire tornados too and fire attacks and range attacks and the water elementals use their ice powers and water range too and all work well. We have a lot of unfinished work so lets go" | V3, V4, V5, V8, V9 |
| 16:57, 1 Nov | "The transition from the mountain down to the ground and the stream on ground look sloppy too. All need to be done well sir!" · "Look at the mountain edges and the environment! This does not look AAA! It looks very paper cut and not natural" · "It's literally just a sheet of paper. That's very embarrassing man" | W23, W26 |
| 17:10, 1 Nov | "yup, you got the elemental part right" (relayed by the lead) | V8: the water side is the Warden plus water-elemental allies who fight beside him; the fire side a new faction |
| 19:38, 1 Nov | "This is nice. The buildings need variety though and there is a black outline that follows when I’m approaching them. The water in the ground for the boost is too wide. The stance during the surf boost is not good and stiff too. Also the swimming in the water has the hand motion reversed. Let’s fix those then we can continue" | W24, M22, M10, M19, CR-40 |
| 19:45, 1 Nov | "Also I don’t see the tornado and hud shit in the notesmosaic page." Asked which page: "On the Thalor page", the option that said it means certifying and publishing once the five fixes pass | §12, CR-40 |
| 20:12, 1 Nov | "The stance is not good either. Look at surfing types" · "Look at the references" · "Online I mean" | M10, M22, CR-40 |
| 20:16, 1 Nov | "The colors and shapes and building types need to have the variety we need too. Do the work" | W24, CR-40 |
| evening, 1 Nov (his messages came during the run; the server log has him opening at 19:36 and 19:51 UTC) | "Make sure we use the correct updating link with the MCP reference" · "I don’t see it in my app still" · "It hit an error every time I leave. Dude did u update my game at all?!" · "The new update did not populate!" · "We must fix this in the MCP" · "Did you push the new update?" | CR-41 |
| CR-42 | 22:19, 1 Nov | **The ride leans.** It was stiff for two reasons, both read in the code: `h.bank` is forced to zero in the surf state, so nothing tilted the whole body and a turn only blended two poses over level feet; and the pose ran one fixed loop at any speed. Now `stepSurf` asks for a lean from the turn's own pull (v × ω, a 0.4 share of it, up to 27°), on a spring that goes a little past and comes back (f 1.7, ζ 0.6), and `body.js` turns the root about his feet, so they stay on the water. A rake follows the water's slope and his gain or loss of speed. Ridden straight he balances a few degrees either way. The pump's rate follows his speed, its size is up by half, the inside arm drops and the outside lifts, the eyes lead, the chest stands up through a hard carve, the camera rolls with him a tenth of the lean, and a hard carve throws its water off the outside rail. First try at 34 to 38° from the feet read as falling over, with the pose's own lean on top, so the most is 27°. The numbers are ours and his eye is the test | Lead, on his word | `web_check/ride_lean.mjs` R1-R7. His eye owed |
| evening, 1 Nov, after Build 31 went up | "Dude this better be with the HUD update too. The MCP needs to work well so the update reads on my app and not just the server. I need to be able to log into NotesMosAIc and go into the game and see the update" | CR-41 |
| evening, 1 Nov, after he saw Build 31 | "Good, the surf needs both hands back and have the guy lean forward. The underwater buildings are too bright and we need actual natural light and all underwater. Fix these and then I will give the fire elementals work to another Claude" | M22, W24, CR-41 |
| evening, 1 Nov, after Build 33 | "Okay good, the glide needs more work but we can work on the fire elementals now and the fire flight and fire cities and sky fortresses too give it to next Claude that is live now and fresh" | handoff §0 |
| evening, 1 Nov, after the fire work was handed over | "The glide looks stiff and it doesn’t lean dynamically when riding. We need clips of Fire and Water elementals fighting and shit" | M22, CR-42; the clips: documents-4b, CR-43 on |
| 22:45, 1 Nov | "Fire elementals don’t need a staff" | V1: no weapon on any Emberkin; they fight with fists, kicks and fire |
| 23:12, 1 Nov | "We need actual cities on ground and sky too and enemies for the fire elemental to fight" | V10, V11: real cities, on the ground and in the sky; V14: the fire elemental has enemies of his own |
| 23:24, 1 Nov | "Allow users to choose in the Home Screen for water and fire and be able to switch too" | V15, CR-45: both sides are played |
| 2 Nov, after Build 40 | "Fire thursters look unnatural too. They must fire like an actual gas turbine on user. The movement for flight must be more graceful and fluid. This is not good still. Find best open examples to use. We also need hover too" | V2, CR-49 |
| 2 Nov, on the pose board | "Yeaaahhh great job, this is how we must tackle new features and others. Take off must be good too" | The method is now the standard: real footage, shapes read off it, a board from three sides, then the game's camera. Takeoff built the same way, CR-49 |
| 2 Nov | "Combat, cities, buildings, boss fights, all must be built off adjacent frameworks that have been proven. For the fighting, we need [a cartoon's title withheld] like fighting styles with martial arts and elements etc. for the fire, we need to be able to do range attacks too and close range and all. Make sure we have the right bosses for the fire elementals too for them to fight and the land people too. The buildings in the underwater look very bland still and need to be fixed with the new standard we got for finding the right references and implementing them right so we have the nice buildings in land and sea and in the cities for fire. We need a volcano world too to contrast the waterfall. The fight between the water and fire elementals must be great and feature all their highlighted powers so we'd can showcase correctly" | CR-50, one job at a time, each from proven frameworks and real references |
| 2 Nov | "Running also feels stiff and that needs fixing via the same ways. I like the attention to detail you are putting here. Continue the same way for all of our requirements and shit so we don't lose this progress and don't have to reinvent the wheel" | CR-52; the method written down in `STANDARD.md` |
| 2 Nov, on Build 40 | "The fire fighting looks like water recorded too and doesn't look like actual fire being emitted and blasted and comboed at users. Plus I pressed the boost and it only dashed and didn't stay with the thrusters on ground. I told you how Inwanted the takeoff sequence to be. Boost, hold it like the water, jump to do big fire jump and while in the air, the boost button becomes fly and we can press and hold that to fly or even hover. I have given a lot of requirements and asks tonight and it all needs to be done well and tracked well per our standards and AAA and not reinventing the wheel and using proven frameworks/open source work/reference to build these correctly and fully and working" | CR-53, CR-54; every ask is tracked in `NIGHT_LIST.md` |
| 2 Nov | "Continue fully through the night with these asks and features intact and do the full work well. Don't stop until the game is fully complete" | The night's run; `EPIC_STATUS.md` keeps the state |
| 2 Nov | "We need grass and sand for the beach too on the water side because there's no good transition" | CR-51 |
| 2 Nov, on the flight | "The head must face forward too and not down. The whole body is messed up Claude! You need to actually look up how a body is meant to be when flying and shit! When I am talking about standards, you must find these!" | CR-49: the head is aimed at runtime along the spine, neck and head; the pose signs were backwards and were fixed. `STANDARD.md` step 1: name the standard he means |
| 2 Nov, on the flight | "Like [a film hero's name withheld]!" | The standard he meant. Slow, the body is along the thrust; fast, it's an arrow along the velocity with lift off the back. The name stays in the memory record, out of this repo |
| 2 Nov, on the Build 59 duel clip | "The duel looks a little sloppy and the lava is just going in the water without turning into steam or solid rock at the bottom? We need rag doll physics and characters getting pushed back with these attacks and also losing their air thrusters when hit" | CR-63 |
| 2 Nov, on the same clip | "The water duel is actually with the water guy with the trident from the start that I am talking about. The fighting looks very choppy" | CR-63: the duel's water fighter is the Warden |
| 2 Nov, on the same clip | "You need to look up frames of how these fights are done like [a game series withheld] and [a film series withheld] too and find the correct body and movement and shit requirements to make it all fit well. When this is done, I need a new showcase of both the water [a character's name withheld] elemental with the new features on web and phone and the fire one too. I want to nerd out about this game and how we did a part 2." | CR-64 |
| 2 Nov | "You have my go ahead to find all the other files you need and research and all" | His yes to the 25 CMU files and other open files this work needs. The clean room still holds |
| 2 Nov | "What about the ice powers of the water guys too? The blue fire guys I am fighting must be separate from the water elementals right? Who are these guys? They need better movement and flight fighting too and be able to burn the environment and do some building damage. Search up all that and make it work. The water guys can extinguish and freeze, and even destroy some parts of their env (you can make a recommendation for that. BUILDINGS recover of course) their env while the fire guys can do the same but with fire. We need this done well so the fights and duels actually look good. Make sure users can dodge while in the air and all. To make things fair, if a water elemental is fighting close to the water, they can use their water tornado to drag the fire guy and other enemy types (fire and all) in the ocean if they please. They can drown the henchmen and temporarily disarm the main character/bosses in the water when that happens and really damage them. You can extend my storage/delete old games from notesmosaic in my account too for this to happen. I will finish my print" · "My prompt i mean" | CR-65 |
| 2 Nov | "We need to discourage the elementals from fighting in their enemies turf. The fire elementals must be afraid of the water and water elementals must be afraid of the sky ones but they can reach each other. Water elementals must be able to summon a big water tornado with water nearby to basically be used as an elevator to get themselves in the air and reach the sky cities. Let's chill here for now with the water vs fire and we can continue that saga later after we get that done. We need fire type animals too that the fire elementals can fight just like the water bosses and shit and some peaceful birds etc that we can fly with and have beautiful views" | CR-66 |
| 2 Nov | "I authorize the deletion of unneeded drafts. This is another big requirements and features I have asked of you so this must be done well and researched for each piece to find all the various pieces and references and all to get the correct implementation for behaviors and results and fighting and environment response for all these types. Don't just half ass it and call it done. We need it to mimic actual life with proven techniques and requirements to get these done and open source tools and frameworks available. You have permission to get all the resources you need to make this happen and complete" | The bar for CR-63 to CR-66 |
| 2 Nov | "Also for shit that is "too heavy" for the phone, we can still learn and use it and make an optimized version if it's the best out there. This is where we can improvise a little. That's another meta rule" | `~/.claude/CLAUDE.md`, `STANDARD.md` |
| 2 Nov | "Make sure the ragdoll works for water too in the water fights and feel natural" | CR-63 |
| 2 Nov | "Also my problem with the fire duels is the thrusters don't look animated or altered when hit in a direction. They look static and just painted there. This needs fixing too" | CR-67 |
| 2 Nov | "The lava coming down the mountain also looks like a sheet of paper and not actually done right. We need this all to be done right with environment burns and shit and we need good ground transitions from earth to ocean like actual games. All that need to be tended to" | CR-68 |
| 2 Nov | "We also just need better foliage textures for bushes and plants and leaves blowing in the wind and leaves falling too in some places to make the world feel magical. Let's do this and we're good. Plus the boss HUD with health bar is blocking the screen and is too low on the mobile side. This is after you complete all these" | CR-69 |
| 2 Nov | "Some bugs too to correct after. When fire guy is in water, he can activated water tornadoes and all when that can't be the case. He can blast himself up but not with water. The flight controls need to match actual flight simulator games with the joystick being used to point in the directorion the user wants with the same control types and the fly is just to move forward. That's the other piece O need. Fire cities and and shit need their own foliage and lighting and ground variety too. It looks very bland and needs fixing. We need ground cities too with skyscrapers and full anime type POIs we can visit and do fights in. All this must follow our rules and research requirements" | CR-70 |
| 2 Nov | "Also I noticed we HAVE 0 shadows in the game or water reflections! Or fire having the light with the vex needed. That is a big oversight and must be added with respect to our memory FPS budget while keeping smooth and everything being done right. This is a big oversight we missed because fire must glow and shit with the city too" | CR-71 |
| 2 Nov | "When I fly with fire, I see some semblance of the water guy too smimming with the trident. Not good. Plus on the pause menu for when O chose fire, it should say "flame on" for continuing it other non trademarked shit. Plus we should be able to continue the game from where we left from. This is for after you do all the other work" | CR-72. His "or other non trademarked": that phrase is a comic hero's, so the button reads Ignite |
| 2 Nov, night | "The jet propulsion stream is too long too and the hands needs to be consistent and flail around too much" | V2, CR-49, NIGHT_LIST #55: the jets shorter, read off real jet-suit footage; in flight the hands held steady along the body as a pilot holds them |
| 2 Nov, night | "We need dynamic waves too and actual cool water movement in the ocean! All must be done well" | NIGHT_LIST #56: dynamic waves and real ocean movement, from real sea-state references and proven open ocean work |
| 2 Nov, night, right after | "Finish the rest of the epic then apply this" | NIGHT_LIST #56 waits until the rest of the epic is finished |
| 2 Nov, night, later | "Okay, just add the animals and wave check then we can record the full 1m gameplay of movement and fighting and adventures with both. We jump between water and fire and show them fighting and going through their adventures. I want to rave about this game online and speak on what we were able to accomplish" | NIGHT_LIST: the order is now the animals (#38), the waves (#56), then a one-minute gameplay film of both sides (#30). The ground city, fire city plants, lava falls and shores wait |
| 2 Nov, night, later still | "I want to emphasize how we were able to do this in two days and talk about my prompts and references while just showcasing the cool game" | NIGHT_LIST #57: the film is the game alone; his talk over it comes from his own prompts in this table and the references in `Pipeline/research/`, made with skill `content-funnel` |
| 2 Nov, night, after the waves | "What about the skyscrapers cities? We need that design and implemented too" | NIGHT_LIST #48: the ground city with skyscrapers and its places, from the cities study §4, before the film |
| 2 Nov, night, on the minute | "You can delete the list" | Done: the 23 drafts deleted on prod after a dry run that re-checked each (his, unpublished, unlisted, the title he was shown) |
| 2 Nov, night, on the minute | "The video looks shit Claude. I need different cuts every 4 seconds and the underwater lights look like squares on surface. The clips from my original video yesterday were better for showcase with boss fights. There are dark figures in the frame where the hero is supposed to be. We are supposed to start with water fighting bosses, fire fighting enemies, the tornado doesn't look fleshed out and we need good looking frames. Look at standard game trailers and match ours to that" | NIGHT_LIST #57: the film redone as a trailer, from real trailer practice; the square lights and dark figures fixed in the game |
| 2 Nov, while the flight was being rebuilt | "The hands motion need to be aligned with the body too and not behind" | V2, CR-49: in flight his arms lie along his body, the push through his centre, as a jet suit pilot's do |
| 2 Nov, while that was being built | "This is a meta rule. Never just make shit up from scratch. Always have the best examples and sources online before just starting because I have my AAA standards" | Written into the Mac's rules (`~/.claude/CLAUDE.md`); `Pipeline/research/FLIGHT_SOURCES.md` is this job's list |
| 23:53, 1 Nov, after the takeoff clip | "Make sure the foot thrusters are one. Look at the water and shit in that. It looks very unnatural" | V2, W25, CR-48 |
| 23:43, 1 Nov | "For the flight, let’s make sure the takeoff is smooth and good. We activate flight with the boost and jump and at that moment, the boost button turns into the fly button and they can choose to fly after that. The jump button can be held to glide down with fire at that moment" | V2, V15, CR-47 |
| 23:05, 1 Nov, after the first Emberkin still | "The fire elementals should just be a regular guy with red attire. We can use the all fire design as a super mode" | V1: a man in red; V13: the all-fire form is a super mode, CR-44 |
| 08:55-10:29, 1 Nov | The reel's corrections (the mask, the opening clip, his cut-out in the centre, no captions, the headline, 0.1 s gaps, the description, other games named): every word in `PET_PEEVES.md` on `main` | S3, the reel; his format for the next reel |

## 12. What's blocked, plainly

- Anymove itself can't run on this Mac (24 GB NVIDIA GPU to train), and cloning it was refused by the permission system. Its method can still be studied.
- Higgsfield's models are paid and hosted and need his login. Not needed for any requirement here.
- Nothing goes public without his word.
- He asked for the game to be published at 10:25 on 1 Nov. It never happened: NotesMosaic was blocked from the cloud session. The lead is confirming it with him. Publishing, certifying and launching stay on his word to the Mac session, each time.

## 13. Verification matrix

Which check proves what. Built from the rows above: a row's check is the truth, and this table is its index. `planned` means the check doesn't exist yet. Evidence for every check lands in `runs/<n>/` (Q21). Reading: `[NASA.ver]`, `[SEBoK]`.

294 requirements from 102 parents. Methods, counting a row's every method: Test 193, Analysis 2, Inspection 89, Demonstration 28. 40 checks exist and 26 are planned, so **70 rows have no working check yet**.

| Check | Exists | Method | Verifies |
|---|---|---|---|
| `CHECKPOINT_MAP.md` | yes | I | Q15 |
| `bossfight.mjs` | yes | T | P7b, d, G1f |
| `check_world.py` | yes | T I D | W1-W11, W12e, W13a, c, d, W14a, d, W18 |
| `collide.mjs` | yes | T | W14b, c |
| `contrast.mjs` | yes | T | G7g |
| `film.mjs` | yes | T I D | M6c, M10e, M11b, M14g, M15d, P4j, P7c, P11b, e, G8b, L5, C3 |
| `first.mjs` | yes | T | P3f, G8a, d, e |
| `focus.mjs` | yes | T | G7f |
| `formulas.mjs` | yes | T I | M4e, M5a, M13a |
| `g_collect.mjs` | yes | T A | P9c, P13d, G1g, G6a, b, c |
| `g_data.mjs` | yes | I | G1a, b |
| `g_events.mjs` | yes | T | M10f, G5b, G10b |
| `g_hud.mjs` | yes | T | G7h |
| `g_saves.mjs` | yes | T | G9a, c |
| `g_screens.mjs` | yes | T | G7a, b, c, d, e, f, C1c, d |
| `g_side.mjs` | yes | T | G3, G4a, G5a |
| `g_story.mjs` | yes | T | G1c |
| `input.mjs` | yes | T | M10a, g, M15c, P1, P2, P4a, f, P5, P12a, P14a, G7g, L1b |
| `lag.mjs` | yes | T | Q13 |
| `load.mjs` | yes | T I | Q9, Q10, Q18, Q24 |
| `look_shots.mjs` | yes | T I D | W1-W11, W12a, b, c, d, W13b, e, f, W15c, d, e, W16b, c, d, W19, G10a, L1d, L2b, L3, T4 |
| `look_shots.mjs --cross` | yes | T | M9b, c, T1a |
| `look_shots.mjs --cross --clip` | yes | I | T2, T3 |
| `look_shots.mjs --flips` | yes | T | L1e |
| `motion.mjs` | yes | T | P4i, P11d, G7g |
| `move_walls.mjs` | yes | T I D | M1a, M2, M3, M4a, c, d, M5a, b, c, d, e, f, g, h, M7, M8 |
| `pace.mjs` | yes | T | Q2, Q3, W17a |
| `perf.mjs` | yes | T I | Q1-Q4, Q7, Q8, W16e, L4a, C1f |
| `plants.mjs` | yes | T | Q17 |
| `play.mjs` | yes | T | M13b, c, W12f |
| `playthrough.mjs` | yes | T | P12c, G1c, d, e, f, G2a |
| `rates.mjs` | yes | T | Q14, M7a |
| `soak.mjs` | yes | T | Q6 |
| `state.mjs` | yes | T | P9a, e, P10c, d, G4b, G6f, G9b, d, L1c |
| `static.mjs` | yes | T I | Q16, Q18, Q20, L2a |
| `stills.mjs` | yes | I D | P12b, G6e, L4c, d, C1b |
| `tools/round.sh` | yes | T I | Q11, Q21 |
| `turned.mjs` | yes | T | Q2, Q8, W17a |
| `ui.mjs` | yes | T | G7g |
| `weigh.mjs` | yes | T | Q5, Q6 |
| `~bots` | planned | T | P6c, d, P10a, b, d |
| `~fact_list` | planned | I | Q19, S1a, b |
| `~iphone_pass` | planned | D | Q12 |
| `~published` | planned | T | Q23 |
| `~swap_watch` | planned | T | C2b |
| `~wall_camera` | planned | T | M12c, M13d, e |
| `~wall_dark` | planned | T | W20a, b, c |
| `~wall_daynight` | planned | T | W16a, e |
| `~wall_elements` | planned | T | P3a, b, c, d |
| `~wall_fluid` | planned | T | M14a, c, d, e, P4m, P14d |
| `~wall_frames` | planned | T I | M14b, P4a, b, c, d, e, g, h, k, l |
| `~wall_holes` | planned | T | W17b |
| `~wall_impact` | planned | T | P11a, c, d |
| `~wall_jump_clip` | planned | T | M5i, j |
| `~wall_life` | planned | T I | W15a, b |
| `~wall_pose` | planned | T | M12a |
| `~wall_powers` | planned | T | P1, P2, P13a, b, c, P14a, b, c |
| `~wall_read` | planned | T | W20d, L6 |
| `~wall_ride` | planned | T D | M11 |
| `~wall_stills` | planned | T | L4b |
| `~wall_stride` | planned | T | M1b, c |
| `~wall_super` | planned | T I | M6a, b |
| `~wall_surf` | planned | T | M10a, b, c, d, g |
| `~wall_swim` | planned | T | M9a, M12b, M15a, b, e |
| `~wall_telegraph` | planned | T A | P4f, P8a, c, d, e |
| `~wall_turns` | planned | T | M4b |
| Read by a person, no tool | | I D | Q22, M14f, P3e, P6a, b, e, P7a, P8b, P9b, d, P13e, P14e, W21, G2b, G6d, G8c, L1a, T1b, C1a, e, C2a, c, S1c, S2-S5 |

## 14. Traceability: his words to requirements to checks

Every row in §11, in order. Going the other way, each requirement's Source column names its N. A new word gets a row in §11 and a row here.

| N | Time | His words, short | Requirements | Checks |
|---|---|---|---|---|
| N1 | 21:30 | "rig it for a new game ... with unreal engine and blender" | C2a |  |
| N2 | 21:30 | "open world ... swimming game ... custom fighting animations ... tech stack" | Q20, M9, M12, M15a, P4a, S1a | `input.mjs`, `look_shots.mjs --cross`, `static.mjs`, `~fact_list`, `~wall_camera`, `~wall_frames` and 2 more (§13) |
| N3 | 21:30 | "Use higgsfield open source to start the videos" | Blocked, §12. Not needed for any requirement |  |
| N4 | 21:30 | "high quality AAA game out of this tonight" | S5 |  |
| N5 | 21:40 | "Use this repo to do the videos too" | C3, S3 | `film.mjs` |
| N6 | 21:45 | "a content funnel for getting eyes on us then one fore getting sales" | S3 |  |
| N7 | 21:46 | "a real life figure and animals and movement and powers" | M11, M12a, M13a, d, P5, P9a, P13a, W15 | `film.mjs`, `formulas.mjs`, `input.mjs`, `look_shots.mjs`, `state.mjs`, `~wall_camera` and 4 more (§13) |
| N8 | 22:31 | "Make it look smoother and better on mobile" | L4 | `perf.mjs`, `stills.mjs`, `~wall_stills` |
| N9 | 22:31 | "We need the super speed too" | M6, M13d, W17, G4a | `film.mjs`, `g_side.mjs`, `pace.mjs`, `turned.mjs`, `~wall_camera`, `~wall_holes` and 1 more (§13) |
| N10 | 22:31 | "We need underwater cities and land too" | M8, P6d, W1-W11 | `check_world.py`, `look_shots.mjs`, `move_walls.mjs`, `~bots` |
| N11 | 22:53 | "how unnatural the movement is on land" | M1, M2, M3a, b, M4a, b, c, d, M5c, M6a, c, M7, M8 | `film.mjs`, `move_walls.mjs`, `rates.mjs`, `~wall_stride`, `~wall_super`, `~wall_turns` |
| N12 | 22:53 | "jump on land too" | M5 | `formulas.mjs`, `move_walls.mjs`, `~wall_jump_clip` |
| N13 | 22:53 | "surf with water" | M10, P2d | `film.mjs`, `g_events.mjs`, `input.mjs`, `~wall_powers`, `~wall_surf` |
| N14 | 22:53 | "water attacks and ice powers" | P1-P3, P12, L5 | `film.mjs`, `first.mjs`, `input.mjs`, `playthrough.mjs`, `stills.mjs`, `~wall_elements` and 1 more (§13) |
| N15 | 22:53 | "the land mass look better and actual grasslands too ... buildings and terrain" | W9-W13, L3 | `check_world.py`, `look_shots.mjs`, `play.mjs` |
| N16 | 22:53 | "apply the game testing and dev standards" | P10a, b, c, W14a, d | `check_world.py`, `state.mjs`, `~bots` |
| N17 | 22:53 | "the screen goes black for a little ... it needs more" | M9, T1-T4 | `look_shots.mjs`, `look_shots.mjs --cross`, `look_shots.mjs --cross --clip`, `~wall_swim` |
| N18 | 22:53 | "details and powers and fights and structures and events and collectibles and missions" | P4a, b, c, d, e, f, g, i, j, k, P6, P7, P8a, b, c, P9a, b, d, e, P14a, W16a, b, c, d, G1, G2a, G3-G6, G7a, b, c, d, e, f, h, G9a | `bossfight.mjs`, `film.mjs`, `focus.mjs`, `g_collect.mjs`, `g_data.mjs`, `g_events.mjs` and 16 more (§13) |
| N19 | 22:53 | "We need different biomes too" | W1-W11, W18, W19, G1d, e | `check_world.py`, `look_shots.mjs`, `playthrough.mjs` |
| N20 | 22:53 | "look online and Reddit for the right ... references" | M15, P13, P14, W20a, b, c, W21, G10 | `film.mjs`, `g_collect.mjs`, `g_events.mjs`, `input.mjs`, `look_shots.mjs`, `~wall_dark` and 3 more (§13) |
| N21 | 22:53 | "recorded in a requirements epic ... make this a standard in notesmosaic" | S4 |  |
| N22 | 22:53 | "made with an M1 Mac ... build faster, high quality tech stack, and nice cinematics too" | Q19, C1a, b, c, e, C2b, C3, S1a, c | `film.mjs`, `g_screens.mjs`, `stills.mjs`, `~fact_list`, `~swap_watch` |
| N23 | 22:53 | "You used unreal engine for this yeah and blender too right?" | Q19, C2a, c, S1b | `~fact_list` |
| N24 | 22:53 | "done through the night so we come out swinging and can make another" | S4a |  |
| N25 | 22:56 | "this art style too ... save the looks so we can switch back" | L1, L2 | `input.mjs`, `look_shots.mjs`, `look_shots.mjs --flips`, `state.mjs`, `static.mjs` |
| N26 | 23:00 | "Fluidity like this too" | M3c, M14, P4e, h, m, P11, P14d, L2b, L6 | `film.mjs`, `look_shots.mjs`, `motion.mjs`, `move_walls.mjs`, `~wall_fluid`, `~wall_frames` and 2 more (§13) |
| N27 | 23:05 | "Apply correct standard proven systems engineering principles" | §1.7, §13-§19, `Pipeline/research/STANDARDS.md` |  |
| N28 | 09:22-10:00, 1 Nov | "THE HUD FOR MOBILE IS TERRIBLE!" · "find the best layout that is industry standard" · "Put the hot bar below that diamond" | G13, G14 | `g_hud.mjs`, `input.mjs`, `ui.mjs` |
| N29 | 10:34, 1 Nov | "I can’t sprint or climb uphill" · "swim up waterfalls" | M20, M21 | `~hill_walk`, `~falls_climb` |
| N30 | 13:41, 1 Nov | "the boost in land ... the water animation and movement surf" · "waves too we can surf" | M22, M23 | `~land_ride`, `~wave_ride` |
| N31 | 13:41-14:56, 1 Nov | "The waterfall looks disconnected from the land" · "ride out on the ground" · "I’m talking about the waterfall" | W23 | `~falls_stills` |
| N32 | 13:47-14:06, 1 Nov | "actual cities with blocks" · "look out of a comic book" | W24 | `weigh.mjs`, `~city_walk` |
| N33 | 13:47, 1 Nov | "ocean environment" | W25 | D, his eye |
| N34 | 16:41, 1 Nov | "fire elemental villains ... fire thrusters ... fire biomes ... same set of powers ... fire tornados ... range attacks" | V1-V9 | §20 |
| N35 | 16:57, 1 Nov | "very paper cut and not natural" · "just a sheet of paper" | W23, W26 | `~falls_stills`, D, his eye |

## 15. Interfaces

`GAME.md` is the interface control document, and systems keeps it, written from the code at 00:01 on 1 Nov. A change to an interface goes to the lead before the code does. `[NASA.icd]`

| ID | Interface | From → to | Defined in | Check | Open |
|---|---|---|---|---|---|
| IF1 | `world.json` | world → look, lead, missions, combat | `GAME.md` | `check_world.py`, `smoke.mjs` | |
| IF2 | `height.bin` | world → look | `GAME.md` | `check_world.py` | 2.1 MB at grid 1,025 |
| IF3 | `biome.bin`, `biome2.bin` | world → look | `GAME.md` | `check_world.py` | `biome2.bin` is approved but not in `web/assets/`, so `check_world.py` can't run |
| IF4 | `props.glb`, `creatures.glb` | world → look, lead | `GAME.md` | `check_world.py` | |
| IF5 | `hero.glb`, `reaver.glb` | movement → lead, combat | `GAME.md` | `Pipeline/hero/check_three.mjs` | |
| IF6 | `moves.json` | movement → combat, `hero.js` | `GAME.md` | `~wall_frames` | |
| IF7 | Clip requests | anyone → movement | `AGENTS.md`, `Pipeline/hero/CLIP_REQUESTS.md` | | |
| IF8 | Hero to combat | movement ↔ combat | `GAME.md` | `input.mjs` | Combat's install may change it |
| IF9 | Look, world and life APIs | look → all | `GAME.md` | `smoke.mjs` | |
| IF10 | `web/data/combat.json`: `stances`, `moves` | combat → missions (ui), `DESIGN.md` | `GAME.md`, `DESIGN.md` §Combat | `~wall_frames` | On disk since 23:58. The game doesn't read it until combat installs, and it may still change |
| IF11 | `web/data/*.json`, `G.quest.botDrive(u, dt)`, `G.quest.target()` | missions → lead's bot | `GAME.md` | `playthrough.mjs` | |
| IF12 | Test hooks: `window.__game`, `?demo`, `?film`, `?qa`, `?fly`, `?tier=`, `?fresh`, `?look=`, `__MOSA_BOOT` | game → checks | `GAME.md` | `smoke.mjs` | |
| IF13 | Saves: `thalor.save.v2` | game → storage or the platform's bridge | `GAME.md` | `state.mjs` | A save from the previous build must still load (QS-F3) |
| IF14 | Bundle: relative paths, no remote code, `rights.json`, first-frame boot flag | game → NotesMosaic | `PUBLISHING.md`, `GAME.md` | `tools/freeze.sh`, `~published` | The CDN sends brotli on text and everything else raw (read 00:11) |
| IF15 | Recorded play | browser → Unreal | `GAME.md`, `ARCHITECTURE.md` | `film.mjs` | Not built for this game. C2 needs it |
| IF16 | `Pipeline/palette.json` | look ↔ world | `ART.md` | | `ART.md` names it; the file doesn't exist. Either make it or change `ART.md` |
| IF17 | Evidence | checks → judge | §1.2 | `tools/round.sh` | Rounds 4 and 5 kept theirs. Round 4 was stopped and has no score |

## 16. Technical performance measures

The numbers that decide whether this ships, each against its line. `[NASA.tpm]`: current against expected, and act when it drifts. All are this Mac's GPU, in Chromium. **`r5` is Round 5, frozen 23:59, still running at 00:26: Chromium done, WebKit to come. Where it hasn't read yet: `r4` is Round 4, which qa stopped at 23:57 and which has no score; `dev` is qa's development reading, 23:19-23:29; `look` is the look owner's report, about 22:59; `move` is movement's own run, 23:53-23:58.** Each frozen round replaces this table.

| ID | Measure | Line | Objective | Last reading | State |
|---|---|---|---|---|---|
| TPM1 | Median frame time, phone size | ≥ 59 fps (Q1) | | 16.7 ms upright and turned at the heaviest place, `kelp_shrine`, p95 16.8, 3,596 frames (`r5`) | Holds here. The display caps it, so it shows no headroom |
| TPM2 | Frame work | p95 ≤ 11 ms (Q4) | | Update plus render submit: median 0.6 ms, p95 2.5, worst 3.7 (`r5`). With the GPU, 4.6-5.9 ms average, on the test page (`look`) | Holds. A phone's GPU is unread |
| TPM3 | Worst frame at top speed | ≤ 50 ms (W17a) | | 33.4 ms upright, a run at 45 m/s, top 54, 2,696 m; 16.8 ms turned at 42 m/s (`r5`) | Holds. Not read on the full map |
| TPM4 | Long frames | ≤ 5% (Q2) | ≤ 1% | 0.00% at the heaviest place, 0.06% in play, 0.00% on the run and turned (`r5`) | Holds |
| TPM5 | Hitches | 0 over 50 ms, 2 allowed here (Q3) | | **2 in play, the worst 417 ms; Long Animation Frames 442 and 80 ms** (`r5`). 0 at the heaviest place, on the run and turned. Desktop's worst frame 483 ms | Passes at the allowance, but 417 ms isn't this Mac's noise. Cause unnamed |
| TPM6 | Working memory | < 96 MB, peak < 128 MB (Q5, Q6) | | **104.6 MB:** GPU tally 48.8 MB (graphics 43, surfaces 5.8) plus raw heap 55.8 MB. Soak peak 101.9 MB. Heap after a collection about 34 MB, which would give about 83-89 MB (`r5`). WebKit gives no heap | **Q5 fails on the raw heap, Q6 holds,** on the small map. What it counts is open (X23) |
| TPM7 | Draw calls | ≤ 100 (Q7) | | At most 41 upright, at the arena; 57 turned, at `sunward_lighthouse`; 12 places (`r5`) | Holds |
| TPM8 | Triangles a frame | ≤ 500k, TBR (Q8) | 325k | At most 389k upright; **498k turned**, at `kelp_shrine` (`r5`) | **Holds by 2k turned, on the small map** |
| TPM9 | Bytes before first play | ≤ 20 MB as the CDN sends them (Q9) | 15 MiB | 6.87 MB as files, 4.18 MB gzipped per file, 65 files (`r5`). The CDN's real ratio is 0.77: the whole 22:43 upload is 7.27 MB as files and 5.62 MB as sent (read at the CDN, 00:11) | Holds. **gzip-per-file flatters it** |
| TPM10 | Whole build | Report both sizes | Poki 8 MB | `runs/5/web`: 7.35 MB, 71 files. At the CDN, 48 text files went from 2.28 MB to 0.62 MB by brotli; 22 binary files, 5.00 MB, went raw (00:11) | Holds. Grows with the map |
| TPM11 | Load at 10 Mbps, 4× slower CPU | ≤ 1 s to a screen, ≤ 10 s playable (Q10a, Q10b) | | First paint 104 ms; playable 7.8 s uncompressed (`r5`). As the CDN sends it, about 6.8 s; with the new map's 3.4 MB, which goes raw, about 9.7 s (systems' arithmetic on one reading) | **Holds by about 0.3 s on the new map,** before any other growth (X22, Q24) |
| TPM12 | Leaks | Under 10% growth (QS-B5) | | **Textures 20 to 29 (45%).** Geometries 124 to 136 (9.7%), programs 51 to 54, heap after a collection 33.0 to 34.2 MB, over 2,290 s (`r5`) | **Failing on textures** |
| TPM13 | Mesh guides (`GAME.md`) | Hero 16k, Reaver 12k, creatures 3k, or 8k if drawn few at a time. Frame time and memory decide | | Hero 14,080, Reaver 11,766. Whale 8,132, serpent 5,938, shark 4,938, manta 4,163, dolphin 3,932, reef shark 3,820, turtle 3,642, fish 666-782 (read from the GLBs, 23:58) | Whale 132 over, flagged. Frame time holds |
| TPM14 | Planted foot slide | ≤ 3 cm a frame (M1a) | | 1.80 cm at 60 Hz, 0.27 at 120 Hz (`move`). 8.5-38 cm before the fix | **Passes.** Not yet read in a frozen round |
| TPM15 | Landing and shore | Hips ≤ 150 m/s² (M5g); ≤ 8 cm a frame (M8a) | | Landings scale with the fall; shore 3.3 cm a step, drawn hips 8.7 cm a frame (`move`). 54 cm before the fix | **Passes.** Not yet read in a frozen round |
| TPM16 | Joint speed | ≤ 1,500°/s, ≤ 2,700°/s in a blow's active frames (M3b, M3c) | | Sprint 2,270, double jump 2,219, stop 2,044, jump 1,898. Blows 1,133-1,260 (`move`) | **Failing outside blows** (X21) |
| TPM17 | Turn easing | ≤ 40% of peak a frame (M4d) | | 78% (`move`) | **Failing** |
| TPM18 | Collision | 0 inside (W14c) | | **54,995 proved charges: 274 ended inside, 2,457 under 0.30 m. In the air 19 of 2,787 got in. 30 of 54 hard kinds covered** (`r5`). 112 inside in `r4` | **Failing** |
| TPM19 | The camera and the map's edge | QS-A4, QS-A5: 0 | | Of 216,000 frames, 400 under the ground and 800 too close to a solid; 400 past the map's edge (`r5`) | **Failing** |
| TPM20 | The 34 checkpoints | Every MUST passes (Q15) | | `CHECKPOINT_MAP.md` isn't rescored for Round 5 yet: 10 pass, 9 fail, 15 unread. Chromium in `r5`: passing `load`, `perf`, `pace`, `turned`, `lowpower`, `state`, `first`, `contrast`, `rates` but A7s; failing `collide`, `play`, `input`, `ui`, `focus`, `motion`, `weigh`, `soak` | **Failing** |
| TPM21 | Swap on this Mac | < 7 GB for C2 (C2b) | | 6.1-6.7 GB through the night, builders running. Peak 29 GB at 22:12 | **Watch** (R1) |
| TPM22 | Numbers with a sourced line | All (Q16a) | | 29 constants and 22 data groups, 1,054 numbers, had no line on `runs/5`, before two exclusions (qa) | **Failing** until each owner writes its lines |

## 17. Reviews, tied to the rounds

Short written gates, not meetings. `[NASA.rev]` lets early reviews be informal. A failed gate stops that round's freeze, not the night.

| Gate | Standard's name | When | Who | Pass line | Record |
|---|---|---|---|---|---|
| Requirements review | SRR | Now, before Round 1 freezes | Lead, systems | Each X in §19 has a decision. Each TBR has an owner | §18 |
| Design check | PDR and CDR, merged | Start of Rounds 2 and 3 | Each owner, in writing to the lead | Interface changes named (§15), clips requested, budget effect estimated (§16) | A row in `DESIGN.md` |
| Test readiness | TRR | Before each freeze | qa | Walls exist for the round's IDs, each instrument proven on a known case, plants current, `heavy.sh` free, swap under 7 GB | First line of `ROUND.log` |
| Frozen round | Verification | §10, each round | qa | `tools/freeze.sh`, then `tools/round.sh <n>`. Every wall read, every plant RED by its own line | `runs/<n>/ROUND.log` |
| Judge | Independent verification | After each frozen round | qa, as a session that didn't write the code | Walls first, then clips at 1× and ¼. Each finding becomes a check before it's fixed | `runs/<n>/JUDGE.md` |
| His look | Validation | After the judge | Randy | His word | §11, §14 |
| Launch review | Readiness | Round 4 | Lead, then his word | Q12 passed, Q15 complete, S2a passed, no X open | §18 |

## 18. Change control

This is the baseline. From now on:

1. **A new word from him:** the lead logs it in §11 at once, in his words. Systems adds its §14 row and a line below within the hour, with the IDs touched and the impact.
2. **A change a builder wants:** ask the lead with the exact words. A bound that can't be met is a change, not a miss to hide.
3. **The board is the lead. His word is above the board.** `[NASA.cm]`
4. **IDs never change meaning or get reused.** A dropped requirement stays, marked dropped. New work gets a new ID.
5. **Each change states its impact:** which rows, which TPMs, which round, which risk.

| CR | When (31 Oct) | Change | From | Impact |
|---|---|---|---|---|
| CR-1 | 00:26 | Baseline 1. All 68 first IDs kept. Rows split into parts, with attributes. New IDs: Q1-Q23, P12 and W18, W19 (from prose), L6. §0, §13-§19 added | N27 | None on what builders are building. Status stays on the parent's line |
| CR-2 | 00:26 | P8 no longer accepts a sound cue instead of a visible telegraph (X4) | §1.1 | Combat: every blow needs a visible telegraph. Lead may overrule |
| CR-3 | 23:40 | Clean room made a requirement: Q16a, Q16b, R12 | Lead, on the 23:33 finding | qa builds it into `static.mjs`. Every owner writes sourced lines in `DESIGN.md` |
| CR-4 | 23:40 | W5's public name is the Vesper Deep. It was "The Trench", DC's proper name. ID kept | Lead, from `REFERENCES.md` | World renames the place in `world.json`. Status line W5 needs the new name. Q20's list gains it |
| CR-5 | 23:40 | New rows from research: M15 Tidepulse, P13 Shoalsong, P14 Homeward Cast, W20 Vigil Light, G10 Omens, W21 the Six Holds; S2b for invented names | Lead, from `REFERENCES.md`, under N20 | Rounds 2-3. P13 and W20 add creatures and swarm to draws and memory, unmeasured. Priority: Should or Could until he says |
| CR-6 | 00:26 | `CLEANROOM.md` created at the project root: what went in, what never does, the breach of 31 Oct | Lead, `steal_skill.md` §0 | Licences recorded there. Number rows stay in `DESIGN.md` (X18) |
| CR-7 | 00:26 | Four power slots a stance, not three. Water Whip on Strike at range, Frost Guard on Parry in Ice, Dodge on Boost, Stance on its own button | Combat, reporting the lead's approval | P1a, P2e, P4e, P4m, P12a, §3's prose. Closes X8 |
| CR-8 | 00:26 | Parts re-lettered and bounds taken from `move_walls.mjs` so one letter means one thing: M5, M7; M2c 6°, M4a 4°, M8a 8 cm, M5h 7 m. Checks named as built | Systems | No ID's meaning changed. Parts are new tonight |

| CR-9 | 00:26 | P8a accepted: a visible telegraph is required | Lead | Closes X4 |
| CR-10 | 00:26 | Frost Isle is the surface act of Cold Water, Crown Isle of Fire Below. The Kraken ends an optional arc after Chapter 4, The Drowned Fleet, needed for 100%. New: G1d-G1g | Lead | Missions' story data. Closes X10 |
| CR-11 | 00:26 | C1 is missions'. C2 and C3 are the lead's until a film builder starts once the map settles | Lead | Closes X11 |
| CR-12 | 00:26 | `biome2.bin` carries the extra biomes | Lead | Closes X14. Not in `web/assets/` yet |
| CR-13 | 00:26 | Mesh guides raised to actuals: Reaver 12k, creatures drawn few at a time 8k. Frame time and memory decide, not the count alone | Lead | Closes X15. Whale 132 over, flagged |
| CR-14 | 00:26 | M3 gets classes, as `steal_skill` §2 allows: M3b 1,500°/s outside a blow's active frames, new M3c 2,700°/s (ours) inside | Lead | `move_walls.mjs` M3 needs the class. Closes X7, opens X21 |
| CR-15 | 00:26 | `GAME.md` and `CLEANROOM.md` move to systems. `GAME.md` rewritten from the code | Lead | Closes X1, X12. §15 updated |
| CR-16 | 00:26 | Must to Should, 28 rows: what a first public release could ship without: M5i, M5j, M6b, M8b, M14d, M14e, P1e, P2b, P2c, P3b, P3c, P3e, P6a, P6b, P7a, P9e, P11c, Q13, W12b, W13d, W14a, W18, W19a, G6f, L1d, L2a, L5a, T1b | Lead's ask. A proposal until he says | Must falls from 64% of rows. **Priority is his**: he can move any back |

| CR-17 | 00:26 | X21 decided: fix the motion, no new class. 2,000+°/s in a sprint or a jump is a real pop. M3b stands | Lead | Movement fixes sprint, double jump, stop and jump |
| CR-18 | 00:26 | X22 decided. Q9 and Q10b are read on what the host sends, both sizes reported. New Q24: files the first view doesn't need load after first play | Lead; `PUBLISHING.md`; read at the CDN | qa's `load.mjs` B1, B1n, B2. Lead, look and world for Q24 |
| CR-19 | 00:26 | W18 back to Must: he asked for different biomes, and they need the room. 27 of CR-16's 28 stay moved. Everything marked Should is still in tonight's plan: a release priority, not a cut, and his to overrule | Lead | World |

| CR-20 | 00:26 | Q3: any frame over 100 ms fails and prints what took the time. The two-frame allowance covers 50-100 ms only | qa | `pace.mjs` B4p, B4s, B4l. Tighter than CR-18's wording |
| CR-21 | 00:26 | New G7h, from `g_hud.mjs`. Rows name the checks as built: `g_*.mjs`, `lag.mjs`, `pace.mjs`, `turned.mjs` | Systems | No ID's meaning changed |
| CR-22 | 00:45 | X23 ruled by the lead: Q5 reads the GPU tally plus the heap after a collection, Q6 reads the raw figure, the platform's tally is reported beside them. All three print side by side | Lead | About 7-13 MB of room on the small map. V8 on this Mac only: WebKit gives no heap, and a real iPhone is still owed, so this reading never stands in for that test |
| CR-23 | 01:00 | Saves keep NotesMosaic's port kit (`mosa-port.js`, `saves: true`), as PUBLISHING.md §4 and PORTING.md §5 name it. Its room calls make the scan read `declaresMultiplayer: true` and add a two-player pass; accepted, since that pass ran with no finding on the 00:50 upload | Lead | The game stays single-player. A second boot signal from the kit is accepted |
| CR-24 | 03:56 | The 2,048 m map is the baseline: 42 POIs, seven bells, grid 1,025, 24,737 colliders. `Pipeline/world/golive.sh back` restores the 1,280 m map. Near meshes arrive after first play, so anything reading a drawn surface waits for `G.world.packsDone` | Lead; world | G1p reads 36 of 36 on it. `check_world.py` gains land props on the ground, whole base within 0.5 m, no seam holds a body, floor clear under the ice, no walkable gap under 1.5 m |
| CR-25 | 04:15 | New walls from round 6's clips, all with bounds of ours: J3 hero in frame in a fight, J3c the same with no solids, J4 lens on the water line, J5 lens snaps, B4pc first draws, F2l load with a collection at each sample. M2k, M4r, M1s read what movement's own walls skip, after a second reader found the three changes honest | qa; lead | M4 keeps its flat instrument; M4r is what a player gets |
| CR-26 | 04:30 | Accepted from combat, beyond the brief: the Captain's guard also drops while he recovers (this baseline said frozen or parried only), so a player who never parries has a way in; a cleave, off-target foes take half; light hits no longer interrupt a tell. All three are in `DESIGN.md` or `combat.json` | Lead; combat | P10 reads a novice who never parries, so the guard rule is what lets that wall hold |
| CR-27 | 05:27 | Collision rule: a body whose centre is inside a solid leaves by the nearest place it fits, walking ten ways out, not by that solid's nearest face, which in a seam leads into the next box. `sweep` stops a step that would put the centre inside, and a wedge where floor and roof cancel. At worst a body deep in a heap moves 32 m in one frame, and only if it was already inside | Lead; look | `look_shots --inside`, six set cases and `--plant-cancel`; `--narrow` |
| CR-28 | 05:27 | Q6 stays the raw figure. Load's churn came down instead of the reading changing: `buffer.transfer(0)`, typed bake grids, no throwaway geometry. Needs Safari 17.4 or later, so older iPhones keep the old behaviour, and a real iPhone is still unread | Lead; look | `weigh.mjs` 6 of 6: Q5 87.9 Real, 91.3 Painted; Q6 115.1. V8 on this Mac |
| CR-29 | 05:30 | P14 adds a Cast button, the tenth on-screen control, V on a keyboard. On a short phone it sits over Call in the left column, because the suggested spot hit the toast. P13 uses a held Call | Missions; combat | G7h overlap at six sizes. Nothing presses it until combat's install. Thumb reach on a real phone is unread |
| CR-30 | 05:40 | Foes by place: open-world fights only ever met Reavers and sharks, so `rosters` in `combat.json` fills the slots by place and opens a kind per bell. New Must: soldier-only fights on land, at Sunward's harbour, the Crown temple stairs, Frost Isle's fort and Cinder at least. He asked for land, fights and structures, and the map had no fight on land | Lead; combat | New walls: land foes stand on the ground, reach him, land a blow, won at 3 skills. Chapters read again on the new cast |
| CR-31 | 05:50 | **The owner's eye outranks the gates.** New Musts, in this order: M17 he leaps from the sea with no aiming, apex at least 5 m swimming, 10 boosted, 18 at super speed, Jump shown while swimming on a phone, chained leaps; P15 a water tornado he makes and rides, apex at least 20 m; W20 life in frame on a phone from the first second; W21 real people in the towns, in place of the robed stand-ins; W22 land that reads as natural islands, Sunward first; M16 real motion data on land in place of keyed clips. Round 7 and all plants are paused until these are built. Every build that boots goes to his private link at once; gates hold public release only | Lead, on his word | `ui.js` line 324 shows Jump while swimming. One plain wall each for M17 and P15. W20-W22 and M16 are judged by eye at phone size |
| CR-32 | 06:47 | **The body comes first.** Missions, combat, look and world are paused on his word. New Musts: M18 the trident rides on his back out of a fight, in water and on land, drawn on Strike, Parry or a power; M19 natural body: tread, swim, walk and run as a real body moves, with both hands free, elbows that bend one way, a relaxed rest pose. C2 stays Must: a showcase made in Unreal for his users once the body is right | Lead, on his word | New wall: joint ranges across every clip. The rest is judged by eye, close up, at 1× |
| CR-33 | 07:05 | The gameplay proof video and the Unreal showcase go in hand beside the body work. A new film builder owns `Pipeline/film/`: a clip proving each line of his approved script, and a showcase rendered in Unreal 5.3 on this Mac from the same assets. Hero close-ups stay drafts until the body is in. Movement keeps first call on the lock | Lead, on his word | `Pipeline/film/SHOTLIST.md` |
| CR-34 | 07:10 | **Verification is not validation.** Finding: this baseline verified proxies (joint speed, foot slide, frame time) and marked his words met when the proxies went green. Nothing validated the need: no returning player on a phone, no stranger judging the body, and most judge rows were never run. `input.mjs` does swipe by touch, but it read only that the camera turned, never that it stopped, and the lead paused it at 05:49, thirteen minutes before the look bug went in; its boost line would have gone red. A builder wrote and changed its own walls. New rule: a requirement in his words closes only on **his acceptance on his phone**. `check green` means verified and nothing more; `accepted` is his word alone. Each feel requirement carries a validation scenario in player terms and an independent judge who built none of it, comparing against a real reference at phone size. Every control is tested through its real input path, on a fresh and a returning player | Lead, on his word | New statuses in `EPIC_STATUS.md`. A QA pass drives real touch events. Look swipe and returning player tests written, in `scratchpad/spin/` |
| CR-35 | 17:00, 1 Nov | **Part 2.** The lead's audit, the cloud session's handoff and his words of 1 Nov logged. New: §20 with V1-V9 (the fire war), and the day's asks that had no row: M20-M23, W23-W26, G13, G14. The commits from 09:28 on stay unverified until read. The old `DrownedCity` folder stays as the archive; `DrownedCity_part2`, branch `part2`, is the working copy. The GitHub repo is public, so nothing private goes in it | Lead, on his word | Memory has 0.8-4 MB left, triangles reach 445k of 500k: V1-V9 can't land until room is made. Every V row closes on his acceptance on his phone (CR-34), never on a wall. New risk R20, below |
| CR-36 | 17:05, 1 Nov | **The phone HUD is his design (G13).** His accepted layout stays: the minimal diamond, Strike's arc, the hotbar at the foot of the screen in the bottom middle, under the stick and the arc. Only the Strike and Boost overlap is fixed: Boost moved 5 px left, which clears their boxes; the round buttons themselves never touched. `C1t.size`'s 62 px was never in `GAME.md`; it lived only in `input.mjs`'s line, so the bound is now QS-C3's own 44 px and the hotbar's 46 px passes. **Second reader (the lead, 17:13): accepted.** 62 is in no document; Google Play's 48 dp prints as a line of information, since Android is coming, and doesn't fail. QS-C3's 12 px apart stays red on the hotbar (5 px) and E1h's 17 px stays red on Boost, Parry and Jump (14 px): seven slots can't be 12 px apart across a 390 px phone, and those labels are part of the layout he accepted. Both are his call | Lead, under the handoff addendum, point 5 | `ui.mjs` C3 and E1h stay red until he rules. Nothing else in the layout moves without his word. A popup rule that changes no layout is G14 |
| CR-37 | 17:05, 1 Nov | G1w's walk on a 5 m grid gets half a cell of height over a shore. A beach steps down inside one cell, so the grid could not come down a shore he walks. Read: the hero walks and swims from Crown Cove to `s_bell.1`'s fight in 7.9 s, with the game's own input. Two pearls the cities closed in moved to the nearest open water, `build_world.py` `MOVED` and `world.json` | Lead | `g_collect` G1w, G1o. **Second reader (the lead, 17:13): accepted for `s_bell.1`, on one condition, now built:** the half cell raises the ceiling over land from 6 to 8.5 m, so the flood runs both ways and G1wb names every fight that passes only with it. Any name but `s_bell.1` goes to a real walk |
| CR-38 | 18:16, 1 Nov | Frame stalls traced. The lead's 167 ms and two later reads of 191 and 250 ms had two causes, both programs first used in play: the wet map's two programs compiled on the first land ride (`world.update` 149 ms, 1 new program, 2 new textures), and programs compiled at boot still stalling in the GPU process at their first real draw (253 ms at 9 s, no stage of the game). The wet map now compiles at boot, and one frame draws everything once behind the loading screen, in the same task as the frame that replaces it. Stalls hit a first-time player: a browser that has the shader cached shows none, so a clean read after a dirty one means little | Lead; the lead's second reading asked for | `pace` B4p and B4l 5 of 5 after the fix in Chromium and WebKit, worst 48 ms, no stall over 100 ms. Boot 1.1 to 1.2 s here. B4s stays red on its own speed bound (the swim averaged 26 m/s against 30), frames clean: movement's. A real iPhone is still owed |
| CR-39 | 19:06, 1 Nov | **Phase 1's body merged** (`Pipeline/wip/movement` and a builder's run): real starts and stops, hills, CMU crawl `126_02`, Rocketbox tread, forearm twist 94.0°. **Second read by the lead, who built none of it:** M1 skipping frames he isn't on his feet is honest, the land ride isn't a stride; M5h jumping before the ride takes over and M15c pressing off the beat move no bound; M2h, M2j, M4w are new and read what no wall read. M3 (1,830°/s, a stop inside the land ride's landing) and M2j (1,701°/s) stay red. M6a, M6b, M7, M7c, M7d, M10c, M10g were red on the baseline and stay red: M7 and M10 no longer read `check green`. **Memory:** CR-38's warm frame draws every list once, so the old 90.1 MB had never counted what a player loads later, and the true reading was 93.8 MB, Painted 97.1, over Q5, on a build already on his link. Instance lists now start at 48 and grow when a view asks (`roomFor`) | Lead; movement | `weigh` 6 of 6: 90.6 MB, Painted 93.9 with everything loaded. `pace` B4p, B4l pass in both engines on the merged tree, worst 37 ms. `g_story` 8 chapters before `roomFor`. The left arm of the crawl is the right arm mirrored, because the capture's left wrist is bad. Turns use no capture. Feel: his alone |
| CR-40 | 20:24, 1 Nov | His five fixes. **Crawl:** the take ran the arms the wrong way round for a body on its front, measured in the game (the hand over his back went toward his feet at 1.7 m/s); the clip is reversed in `moves.py` and reads +1.7 m/s. **Surf stance:** keyed from coaches' lists and photographs (ombe.co, rapturecamps.com; photographs looked at on pexels.com, study only, nothing kept in the game or repo): feet 80 cm apart, back foot across, front foot 45°, knees over the toes, back straight, arms wide with soft elbows; the legs pump and the arms answer late. **Water on land:** the disc under the ride was 15 m across; now a tongue 2 m by 4.6, trail 0.7 m wide, rings and spray cut. **Ink:** flat black, it hung in the water ahead of buildings the haze had taken; now in the haze, 1.2 px, and past 130 m not drawn. **Buildings:** three new sea silhouettes (`drum`, `hall`, `step`), three on land (`houseWing`, `towerHouse`, `loggia`), each building its own stone (eight), width, height, window style, dome and roof colour; a soft light of their own under the water keeps colour through the haze. **Memory:** the lead's whole-map tour read Painted at 97.0 MB; the Painted sky went from .5 to .34 scale, and `weigh` gained F2m and F2n, the whole-map lines. **The Thalor page** plays live version 1 from 31 Oct: his uploads land on the working branch and never reached it. He chose the page, so certify, launch and publish follow on passing checks | Lead, on his word | `weigh` 8 of 8: 93.6 MB after the whole map, Painted 95.1, 0.9 MB of room. Q7 at Thalor 98 draws, 2 under the bound. Six more types. His eye owed on all of it |
| CR-41 | 21:16, 1 Nov | **What was wrong:** CR-40 said the Thalor page played version 1 from 31 Oct. It never did. As owner he has always been served the working branch's head there (`ownerDraft`), his phone reported each build, and the certify, launch and publish I proposed on that claim was held: the certification was opened, never run, and expires by itself. What he saw at the first reef was no change: every slot of the hotbar hidden until learned, the tornado a held Jump with no word of it, every fix at a city, at speed or at the surface. **Done:** his hotbar stands from the start, dimmed until learned, a tap says which bell teaches it (`hud_open` H1-H4). The tornado is told after twelve seconds in the water (H7). The title and pause screens say the build, and a line says it once when it changes (H6, H8; `config.js`, BUILD). `ctx.resume()` refused on a closing page is caught in `audio.js` (H5), but that wasn't the whole cause: his phone still reported the refusal on Build 33, from a path not found, and it was `routed=recorded`, so he's no longer told. The game-side catch alone would not have stopped the notice; deploy 286 did. Windows from the `lit` kit and the city no longer burn in daylight water, and lose red with distance. **The stone's light:** the fill and the 55× give-back of CR-40 are gone: more of the sea's own `ocAmbient`, so a roof catches it, a wall has half and an underside none. **Surf:** both arms swept back, hands trailing, the whole body forward over the front foot from the ankles. **The MCP (orgo_u, its own commits):** an upload pushes "<game> has a new version", and its answer says the owner already has it; "AudioDestinationNode is not initialized" stops reaching creators as a player's error | Lead, on his word | Build 33 (commit 5db4b441): `hud_open` H1-H10, `ui` 10 of 13 (C3 and E1h wait for his ruling, C6 is older), fights, touch, returning at sea, the platform's playtest in both engines. Build 32: story, reach, weigh 8 of 8 in both engines, pace B4p three reads. Deploy 286, prod = tree bc2eea613, live checks 29 of 29. His eye owed on the surf and the light |
| CR-43 | 22:40, 1 Nov | **New: V10 fire cities, V11 sky fortresses, V12 clips of the two sides fighting**, from his words after Build 33 and his relayed word on clips. V12 sets the aim of Phase 3's smallest step: a fight that can be filmed, not a foe that stands there. The fire work moved to branch `fire` in worktree `DrownedCity_fire`, so nothing half-done ships on `part2`, which the glide work uses. **Room found so far, no look changed:** the Leviathan and the Frost Wyrm each held their own unindexed copy of one body; they now share one indexed body, 5,563 vertices for 2 × 18,354, the same 6,118 triangles; the creature file's parser is let go after its meshes are read | Lead, on his word | V10 and V11 wait on what he sees. `weigh` F2m and F2n re-read after the change |
| CR-44 | 23:10, 1 Nov | **On his word, the Emberkin is a regular man in red attire; the all-fire design he saw is a super mode** (V1 changed, new V13). Both forms ride one skeleton, so the super mode costs a second mesh and no clips. The water elemental built at 23:00 was never asked for, so it isn't called into a raid: the code stays for V8 and its look waits for his word, since by the same rule it may be a man in blue | Lead, on his word | `weigh` re-read. His eye owed |
| CR-45 | 23:26, 1 Nov | **Both sides are played (V15).** His word settles what CR-44 left open: the man in red isn't only a villain. The home screen offers Water or Fire and the choice can be changed later. V14's enemies follow from it: whoever he plays, the other side raids him. V3's fire kit and V2's flight become the player's as well as the foes'. The Burnt Isle is the fire side's home | Lead, on his word | New wall `~wall_sides`. Save carries the side. His eye owed |
| CR-46 | 23:27, 1 Nov | **The Burnt Isle (V6 in part, V10, V11).** An island of black rock under a volcano, raised at load into the same height field (`fireisle.js`), in open sea south of the islet, in sight of the start: the world's file doesn't change. The Ash City on it and the High City on a burning rock 86 m over it use the land city's streets and houses as data, scorched, windows always lit, so they cost instance lists and no new meshes. A ring of fire on each square carries him between them. 543 reef pieces and two schools under the new land are gone or moved, two pearls lifted to the new ground. **Room:** phone normal maps at a quarter, the terrain's glow map at half: Painted 92.2 MB after the whole map, 3.8 MB of room, with the Emberkin and the isle in | Lead, on his word | `weigh` 7 of 7. Draws at Thalor read 107 in this view on the build without the isle too, so Q7 was already over there: not new, and still owed. Start 73 draws, as before |
| CR-47 | 23:45, 1 Nov | **His flight controls (V2, V15).** Boost and Jump together launch him: the jets light and the lift eases in over 0.42 s. In the air the Boost button reads Fly: a press flies, held it's top speed, a tap ends it. Jump held glides him down on the fire, in flight or out of it. The double tap and hold-to-fly of Build 38 are gone | Lead, on his word | `wall_sides` S4, S5 rewritten to these buttons. His eye owed on the takeoff |
| CR-48 | 23:55, 1 Nov | **One foot jet, and the sea from the air.** The feet are held together in every flight pose and throw a single jet from between them. Flight is the first time anyone has seen the sea from above, and it showed three faults: a breaker's white water is worked out at the sea's vertices, which are metres apart a little way from the lens, so past about 60 m it read as hard white sheets with a dotted edge (it now fades by 150 m); the Burnt Isle's skirt was a wide shelf 2.4 m deep, pale and full of surf (it now drops straight into dark water, and the isle has no breaks); and sand in the shallows, seen through a nearly clear surface, went milky (from the air the shallows now take the water's own colour) | Lead, on his word | Stills from the same flight. His eye owed |
| CR-49 | 2 Nov | **Turbine jets, graceful flight, hover, takeoff.** The sprite flames are gone: each jet is a thin rigid cone with a hot nozzle and shock diamonds on its axis, built from photographs of real engines and the CC0 engine flame method, with a spool that lags the throttle. The player flies on Newton: a velocity spring (Holden, MIT) with continuous acceleration and carved turns that keep their speed. The body has two shapes read off real flight footage: slow, he stands on his jets with his arms out and palms down; fast, he's an arrow along his path, arms along his sides, legs together, and he rolls to bank like an aircraft. The head is aimed by the game and looks where he's going. Letting go of the stick hovers. Takeoff: a knee dip, ignition, a long drive with the arms out, a blast ring and wash under him. No open superhero flight controller exists; this one is written from those sources. |
| CR-50 | 2 Nov | **His next list, in his words in §11:** combat, cities, buildings and bosses built off proven frameworks; martial-arts elemental fighting; fire with ranged and close attacks; the right bosses for the fire side and the land people; underwater, land and fire city buildings redone from real references; a volcano world to contrast the waterfall; a water against fire fight that shows every power. |
| CR-51 | 2 Nov | **Sand and grass on the water side's beaches**, with a real transition. |
| CR-52 | 2 Nov | **Running stops feeling stiff**, by the same method. |
| CR-53 | 2 Nov | **His takeoff, corrected.** Boost held on the ground runs on the thrusters, like the water's Boost. Jump while it's held is a big fire jump. In the air Boost reads Fly: held, it flies or hovers. |
| CR-54 | 2 Nov | **Fire fights as fire.** Its own moves and real fire emitted, blasted and comboed: not the water kit recoloured. |
| CR-55 | 2 Nov | **Fire's second stance is fire and rock.** Lance, Stomp, Lava Path and Breath had kept the water side's ice looks; they now go through `firekit.look`. Lava Path crusts the sea. Build 53. |
| CR-56 | 2 Nov | **Fire's stances and kicks reach the legs.** On land the run cycle was overwriting the legs of every blow, so the capture's stance never showed. The fire clips join `CLIP_LEGS`. A guard from capture, fists alight in a fight, a whirlwind kick for the Firewheel. Build 55. |
| CR-57 | 2 Nov | **A lost graphics context keeps the isle.** The ground came back from its files without the isle painted over it. S11 reads it, and it fails with the fix taken out. Real fingers on Boost and Jump: S9, S10. Build 56. |
| CR-58 | 2 Nov | **The fire side opens on the High City's plaza facing the volcano, not a wall.** Its halls get lattice screens read off real fronts: board, rail, two leaves, paper lit from a hot spot. Build 58. |
| CR-59 | 2 Nov | **The duel is a conversation.** Turns, an exchange with blocks and counters, a hard distance limit, and a director that keeps its side of the line, frames from the separation, and cuts on the blows. Sources in `Pipeline/research/DUEL_SOURCES.md`. The road's second step is now the first flight, down to the Ash City. Build 59. |
| CR-60 | 2 Nov | **V11, sky fortresses.** Two keeps on floating rocks: a five-storey tower on a raised stone base, smaller keeps, corner turrets, tiled walls with a gate, read off Himeji's published plan. They share the High City's kit, so they add one draw. The road lands the player on the Cinder Keep. Build 60. |
| CR-61 | 2 Nov | **Found from the player's seat.** The phone's Emberkin pool holds two: Watch the duel with a raid on would have crashed, and a failed champion spawn was never tried again. Both fixed, E15 walks the whole fire road, E16 holds the duel. Fire powers stop calling water's sounds; lava roars and crackles. Build 62. |
| CR-62 | 2 Nov | **Losing on the fire side.** Death sent the man in red to the Warden's start, under the sea; New Game too, with the road left where it was. The Seawall counted as done when it woke, so losing to it ended the road, and the Tidecaller couldn't return after a reload. All fixed, E17 holds them. Build 63. |
| CR-63 | 2 Nov | **His notes on the duel.** The water fighter is the Warden, the trident hero from the start. The fighting stops being choppy. Lava meeting the sea makes steam and solid rock. Ragdoll physics, blows that push back, and thrusters lost when hit. |
| CR-64 | 2 Nov | **Fights read off real frames.** Body and movement requirements taken from frames of a hard third-person action series and a superhero film series, then a new showcase of both sides, on web and phone. Titles stay in the memory record. |
| CR-65 | 2 Nov | **The elements change the world, and the sea is a weapon.** Ice in the fights; the blue foes get their own identity, apart from the water elementals, with better flight fighting; fire burns and breaks the world, water puts it out, freezes and breaks it, and buildings recover; players dodge in the air; a water elemental near the sea drags foes in with the water tornado: henchmen drown, bosses and the main character are disarmed and hurt. His yes to extend his storage or delete his old games for this. |
| CR-66 | 2 Nov | **Turf.** Fire fears the water and water fears the sky, and each can still reach the other. A water elemental near water summons a great tornado that lifts them to the sky cities. The water-against-fire saga rests after that. Next: fire animals to fight, as the water side has its beasts and bosses, and peaceful birds to fly with. |
| CR-67 | 2 Nov | **Thrusters answer the body.** A jet carries inertia: it bends with motion, trails when he's thrown, kicks when he's hit, and swings as he steers. The straight cone read off a test stand was the wrong standard for a body in a fight. |
| CR-68 | 2 Nov | **Lava and shores done right.** Lava with body, read off real flows and the best shipped work, not a ribbon; the ground it passes burns; and earth meets ocean the way good games do it, on every coast. |
| CR-69 | 2 Nov | **The last of this list, after the rest.** Better foliage textures, leaves moving in the wind and falling in some places, and the boss's health bar moved out of the way on phones. |
| CR-70 | 2 Nov | **Fire can't use water.** In the sea he blasts himself out, no tornado. **Flight controls as flight games have them:** the stick points him, Fly only drives him forward. **Fire cities get their own foliage, light and ground. Ground cities with skyscrapers and anime-style places to visit and fight in.** |
| CR-71 | 2 Nov | **Light.** Real shadows, reflections on the water, and fire that lights the world it burns in, within the phone's memory and frame budgets. |
| CR-72 | 2 Nov | **Nothing of the Warden on the fire side in flight. Resume on the fire side says Ignite. Continue takes a player back to where they left off, which changes his 1 Nov word that every session starts at sea.** |

## 20. Part 2: the fire war, and the day's asks (V, M20-M23, W23-W26, G13, G14). Owner: lead

Baseline CR-35. Every row here is Must, and every row closes on **his acceptance on his phone** (CR-34): `check green` is verified, `accepted` is his word. Each row names a validation scenario in player terms. The checks marked `~` are planned.

**The two sides (his word, 17:10):** the water side is the Warden plus water-elemental allies who fight beside him, using water and ice, melee and range. The fire side is a new villain faction, working name the Emberkin. Names stay original and generic (§1.6).

| ID | Requirement | Why | Source | Pri | V | Acceptance, check and his validation scenario |
|---|---|---|---|---|---|---|
| V1 | The game shall have Emberkin soldiers, captains and champions: regular men in red attire, no weapon, who fight with fists, kicks and fire, readable at 40 m on a phone | A new enemy side, his ask | N34 | M | T + D | Mocap fights from CMU subjects 14, 135, 144, the source he approved. `weigh.mjs`, `~wall_emberkin`. **He sees one at 40 m on his phone and knows what it is** |
| V2 | Every Emberkin shall fly on fire thrusters at the feet and palms, always visible and heard: hover, strafe, climb, dive, boost, land, take off, over land and sea. Flight is a body animation, never a sliding figure. In water they hiss, steam, slow and weaken | "fly with fire thrusters" | N34 | M | T + D | `~wall_flight`, `~flow_flight`. **He sees one fly in from the horizon, circle, strafe and land, and it looks like a real flying fighter** |
| V3 | The fire side shall hold the same power set in fire, each its own move and look, in `combat.json`: Flame Whip, Flare Rush, Firewheel, Wall of Fire, Magma Geyser, Magma Lance, Obsidian Stomp, Flame Breath, Lava Path, fire tornado (rises 20 m or more, drags and throws, rideable by its caster), thrown fire spear with recall, ember swarm, Heat Guard | "same set of powers" | N34 | M | T + D | Foes use them on telegraphs of at least 0.5 s (P8). `~wall_fire_powers`, plants. **He meets each one and can read it before it lands** |
| V4 | Both sides shall have real ranged attacks. Fire: bolts, lances, breath. The Warden's side: water bolts and ice shards aimed by lock-on with one thumb, plus the lance and the wave. Hits land where aimed, with travel time, a trail and a real impact | "range attacks" · "water range too" | N34 | M | T + D | `~wall_range`, through real touch input. **He picks off a flyer from the ground and from the water** |
| V5 | Water shall douse and stagger fire, ice shatter magma, steam blind, lava melt ice, and a fire tornado meeting a water tornado shall make steam and a real event. Each pair is one rule in `combat.json` | "all work well" | N34 | M | T + D | One wall each, no tutorial. **He sees what beats what without being told** |
| V6 | The Cone shall become a true volcano region, with a burned land and lava-field biome on the surface: black rock, rivers of lava that flow like the game's rivers, ash in the air, burning ruins, an orange sky, plus Cindermere as built. Standing in lava hurts | "their fire biomes" | N34 | M | T + D | Part of a bigger map only if memory allows. `weigh.mjs`, `~wall_lava`. **It looks as good on his phone as Sunward at noon** |
| V7 | At least three new flying fire bosses, each with phases, a designed intro, its own arena and a signature move: a big one per biome, a duel with a champion who mirrors the Warden's whole kit, a final fight water against fire. The Cinder Colossus reworked to match | "bosses" | N34 | M | T + D | Foundations `boss.js`, `bosses2.js`. Camera holds him and the boss in frame (J3). `~wall_fire_bosses`. **He beats each one on his phone and would show someone** |
| V8 | Set-piece battles shall have water elementals and Emberkin fight each other around him, in the sky and at the shoreline, tied to story chapters once missions resume | "they fight" | N34 | M | T + D | `~wall_war`. **He stands in a battle that goes on with or without him** |
| V9 | Every power, flight state, tornado and foe shall work with the holster, dodge, leap, surf, ride and land run | "all work well" | N34 | M | T + D | Flow films for each. 60 fps target, no frame over 100 ms on the phone tier, Q5, Q6. Effects drawn after the sea. **He plays it all and nothing breaks** |
| V15 | The player shall choose water or fire on the home screen, and switch later: the fire elemental is played as the Warden is, with his own powers, his flight and his super mode | "Allow users to choose in the Home Screen for water and fire and be able to switch too" | N36 | M | T + D | `~wall_sides`, by real touch, fresh and returning. **He picks Fire on the home screen, plays him, switches to Water and back** |
| V14 | The fire elemental shall have enemies of his own to fight | "enemies for the fire elemental to fight" | N36 | M | T + D | Played as fire, the raids that come are water's. **He plays fire and has someone to fight** |
| V13 | An Emberkin shall have a super mode: the all-fire form, molten cracks, glowing core, crown of flame, armoured in slag. He goes into it in the fight, faster and harder, and water puts it out | "We can use the all fire design as a super mode" | N36 | M | T + D | `wall_ember`. **He watches a man in red ignite, and puts him out** |
| V10 | The fire side shall have cities of its own: Emberkin cities in the fire biomes, built by the fire people, as much real cities as Thalor and Sunward, in the same comic-book detail | "fire cities" | N36 | M | T + D | His words don't yet say where they stand or what they look like: **ask him before building.** Q7 and Q8 at each, `weigh.mjs`, `~wall_fire_city`. **He flies or swims into one and calls it a fire city** |
| V11 | The fire side shall hold sky fortresses: great strongholds in the sky that Emberkin fly from and fight around | "sky fortresses" | N36 | M | T + D | His words don't yet say how many, what holds them up or whether he goes aboard: **ask him before building.** Q7, Q8, `weigh.mjs`, `~wall_fortress`. **He sees one in the sky from far off and wants to go there** |
| V12 | The game shall yield clips of fire and water elementals really fighting on screen: the Warden and Emberkin trading real blows, each answering the other, from the game's own camera | "We need clips of Fire and Water elementals fighting and shit" | N36 | M | D | Goal of the first playable fire step: the fight has to exist before it can be shot. How he wants it filmed is his: ask when there's something to shoot. **He watches a clip and would post it** |
| M20 | He shall swim up a waterfall, from its pool to its top | "swim up waterfalls" | N29 | M | T + D | Commit `8d95b35` climbed Crown Falls; the climb from inside the new pool has never run. `~falls_climb`. **He swims into the pool and up the falls with one thumb** |
| M21 | He shall sprint and climb uphill wherever a hill looks climbable | "I can’t sprint or climb uphill" | N29 | M | T + D | `f850eb1`: 8.7 m/s up 50° in the cloud's probe, unread on a device. `~hill_walk`. **He runs up a hill on Sunward with no stop** |
| M22 | Boost on land shall ride the water with the swim's animation and movement, and leave water behind | "the water animation and movement surf" · "should leave some water" | N30 | M | T + D | Half done: the stream reads as water for 1 s, grey blobs by 10 s, gone by 40 s. `~land_ride`. **He rides a meadow, looks back, and sees water** |
| M23 | He shall surf real waves: the ride locks to the face and he trims along it | "waves too we can surf" | N30 | M | T + D | Today he outruns the 6 m/s wave at 26 m/s and no shot shows a face. `~wave_ride`. **He drops onto a wave and stays on it** |
| W23 | The falls and streams shall meet the land naturally: water that leaves the lip on an arc, in layers with thickness, a real splash at the foot, a stream of varied width with riffles, stones and plants at the waterline | "disconnected from the land" · "just a sheet of paper" | N31 · N35 | M | T + D | `~falls_stills`, beside real photographs at phone size. **He looks at Crown Falls and calls it a waterfall.** Shown to him before any other island |
| W24 | Cities shall be real: blocks and streets under the sea, towns on land, not one building, in the art style's comic-book detail | "actual cities with blocks" | N32 | M | T + D | Q7 and Q8 at each. City v2's two detail levels, Vesper's glow and the v2 Sunward town were never seen. `weigh.mjs`, `~city_walk`. **He swims down a street** |
| W25 | The ocean environment shall get an AAA pass | "ocean environment" | N33 | M | D | Not started. **He swims the first minutes and calls it AAA** |
| W26 | Cliffs and mountain edges shall read as natural rock on every island: no razor crease at the top, no bare smooth faces, a foot that blends into the ground | "very paper cut and not natural" | N35 | M | T + D | Method from how shipped open-world games dress cliffs, stills beside real photographs. `weigh.mjs`. **Crown Falls first, shown to him, then the other islands** |
| G13 | The phone HUD shall stay his accepted layout: the minimal diamond, Strike's arc, the hotbar at the foot in the bottom middle, under the stick and the arc, nothing overlapping | "Put the hot bar below that diamond" | N28 | M | T + D | CR-36. `g_hud.mjs` G7h, `input.mjs`. **Accepted by him at 10:00** |
| G14 | The feed shall say one thing at a time, biggest first, so popups never hide the game. Boss bar, timer and a teaching hint stay up; every other line takes its turn or lapses | Audit, 1 Nov: seven lines at once over the top half of the phone | N28 | M | T + D | `ui.js` `say`, 16:45 sheet. `~feed_one`. Changes no layout. **He plays the first minute and can see the game** |

## 19. Open items

**Open conflicts.**

| # | Conflict | Where it stands | Closes it |
|---|---|---|---|
| X5 | P11's flash on every contact against QS-E3's three flashes a second, and G7f's reduced flashing | P11d caps the area at 10%, under the size the flash rule counts. `motion.mjs` E3f hasn't read it on a three-hit chain | Combat, qa |
| X9 | C1e's opening cinematic against G8a's one tap | Baseline: the opening plays after control, or its skip counts as the one tap | Missions |
| X21 | M3b's 1,500°/s against locomotion. Sprint 2,270°/s, double jump 2,219, stop 2,044, jump 1,898 | **Decided (CR-17):** fix the motion, no new class. Open until `move_walls.mjs` M3 is green | Movement |
| X22 | Q9's 20 MB against Q10b's 10 s at 10 Mbps | **Decided (CR-18):** read on what the host sends, both sizes reported, and files the first view doesn't need load after first play (Q24). **The CDN read found that it compresses text only:** `.glb`, `.bin` and `.png` go raw, so the new map's 3.4 MB of binaries stays 3.4 MB. That reads about 9.7 s, by arithmetic on one reading. qa's `load.mjs` lines are written, not yet run. Open until Q24 is met | qa, lead, look, world |
| X23 | What Q5 and Q6 count. The platform's 128 and 192 MB lines and the framework's 96 MB line count only what the page asks the graphics card to hold. Systems added the JS heap to §1's definition, unsourced, without saying raw or collected. In Chromium: GPU 48.8 MB, raw heap 55.8 MB, together 104.6 MB, over the line. Heap after a collection about 34 MB, together about 83-89 MB, under it | **The lead's call, since it can turn Q5 green.** Systems' proposal: Q5 on the GPU tally plus the heap after a collection; Q6 on the raw figure; the platform's tally reported beside them. Until then Q5 reads raw and stays red | Lead |

**Closed conflicts.** The decision is in §18 or the row.

| # | Was | Closed by |
|---|---|---|
| X1 | First download, 20 MB against 12 MB | Q9; `load.mjs`; `GAME.md` (CR-15) |
| X2 | "Long frame" meant two things | Q2 and Q3; `perf.mjs` reads both |
| X3 | Q1 against the gate's 54 fps | qa: B3 reads 59 fps |
| X4 | P8 "or has a sound cue" against no information by sound alone | CR-9 |
| X6 | M5's 0.10 s against a `takeoff` of 0.29 s | Movement retimed it to 0.07 s |
| X7 | M3b against fast blows | CR-14 |
| X8 | Five powers against three buttons | CR-7 |
| X10 | The Kraken, W10 and W11 on no chapter | CR-10. Bells stay in `missions.json`, so C1e stands |
| X11 | Nobody held §8 | CR-11 |
| X12 | `GAME.md` out of date | CR-15 |
| X13 | C1-C3 and G1-G4 meaning two things | qa: `QS-` prefix on every line; `quality.mjs` retired |
| X14 | Eleven biomes on four channels | CR-12 |
| X15 | Meshes over `GAME.md`'s budgets | CR-13 |
| X16 | "The Trench" still shipped | World: `world.json` says The Vesper Deep; `static.mjs` Q20 passes |
| X17 | "3 cm a frame" changes with frame rate | A frame is 1/60 s (§1) |
| X18 | Number rows: `CLEANROOM.md` or `DESIGN.md` | `DESIGN.md`, one list |
| X19 | Q8's 500k against B5t's 1M | qa: B5t reads 500k |
| X20 | M7a against A7's 45° | qa: A7 climbs 41°, refuses 45° |

**Unverifiable as written, and what was done.**

| As written | Trouble | Now |
|---|---|---|
| M6 "reads right", "its limit" | No measure | M6a a number, M6c judged |
| M7 "what looks climbable" | No measure | M7a a band (ours), tested |
| M11 "a real grip pose", M12 "smooth" | No measure | M11b, M12a measures, plus a clip |
| M14 "nothing stops dead" | No measure | M14a-e measures from his reference, M14g judged |
| P6 "a human can read every telegraph" | Only a person can say | P8a measures, P6e judged |
| T1 "or make it a deliberate beat" | Two outcomes | T1a one bound, T1b the cause |
| W12 "no visible polygons", W13 "real architecture" | Only a person can say | W12a, W13f judged at 3 m, with W13b-e as checks |
| L3 "as good as below" | A comparison with no scale | A list, then he looks |
| L4 "no shimmer, no banding" | No measure | L4b a measure (ours). L4c stays by eye |
| S1 "tell the true story" | No fact list | S1a, `~fact_list` |
| G8 "teaches through play" | Only a person can say | G8b judged, G8a, d, e tested |

**Stay human by design:** Q12, Q22, M6c, M8b, M11b, M14g, P6e, P11e, W12a, W13f, G8b, c, L2b, L3, L4c, L5b, S1c, and how W1-W11 look. Each names its judge and reference. **No device here can verify:** Q12, and any real phone reading of Q1-Q8. Passes on this Mac are evidence, not proof.

**To be resolved.**

| TBR | Best estimate | Who | By |
|---|---|---|---|
| Q8 triangle line | 500k, objective 325k | qa, look | iPhone baseline, Round 4 at the latest |

**Fan evidence.** M15, P13, P14, W20, W21 and G10 come from `REFERENCES.md`. Its ranking is a judgement from Reddit post titles and openings, one 15-post thread and a few articles, not from read comments, since reddit.com couldn't be read. Surfing (M10) and ice (P2, P3) are his asks; research found no fan evidence for them, and they stay Must. Fan evidence never sets priority: his word does. `REFERENCES.md`'s names are proposals (S2b).

**Priority check.** By row: Must 160 (54%), Should 124 (42%), Could 10 (3%). `[MoSCoW]` caps Must at about 60% of effort, not of rows, and effort isn't estimated. CR-16 and CR-19 took Must from 64% of rows. Moved: counts, polish and method rows a first public release could ship without. Kept at Must: his direct asks at their core, including surf (M10a-d, M10g), the stances and Ice Path (P12, P2a, P2d, P2e), super speed (M6a, M6c), fluidity (M14a-c, M14g), the grasslands (W9) and the room for the biomes (W18). **Everything marked Should is still in tonight's plan: it's a release priority, not a cut, and his to overrule.**

**Not in this baseline, on purpose:** Bell Claim (`REFERENCES.md` rank 6; the lead named only the Six Holds pattern), and motion matching (`[Clavet16]`: no capture library, and the data costs phone memory).
