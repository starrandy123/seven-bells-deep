# Steal Like an Artist

**Skill version:** 1.4.0
**For:** any coding agent — Claude Code, Codex, Cursor, ChatGPT — asked to remake a console game or a genre for the web, through the NotesMosaic MCP or in its own repository.
**Design rule:** **Public facts in, measured feel out. Nothing of the original's code, assets, names or art ever enters the room.**
**The name:** steal like an artist — take everything that is public (how it feels, the published methods, the measurements) and make it yours; never the files.

> "Reverse engineering" in this skill means one thing: recovering how a game FEELS — its timing, its forces, its assists, its controls, its rules of play — from what its makers and players have said and shown in public, and rebuilding that feel in an original game of your own. It never means taking anything the original is made of. A remake built this way is a new game with a familiar feel: its own name, its own world, its own characters, its own code.

**Reading this through the NotesMosaic MCP:** any agent connects at `https://notesmosaic.com/mcp` (the steps for each app: https://notesmosaic.com/developers/mcp). `list_skills` names this skill and `read_skill {"name": "steal-like-an-artist"}` hands any connected agent the whole text — nothing to install. The platform's own rules are `get_rules {"doc": "PUBLISHING.md"}` (and `PORTING.md` for a game the person already owns); read them before building, and again before shipping.

**Play a game made with this method:** https://notesmosaic.com/sim/UQteU6RzJa3sotS3 — an original skateboarding game, remade clean-room from public facts by the method below. It plays in a browser, on a phone or a computer.

**The method in the open:** https://github.com/starrandy123/steal-like-an-artist — this skill, the game made with it, its record and its tests.

## 0. The clean room: what goes in, what never does

### What may go in

- **Interviews and talks** by the original's makers (how they tuned the controls, what rate they read the input at, what the physics ran at, how the body was driven).
- **Official documentation**: manuals, accessibility pages, settings menus as published (an assist's name and its default value), patch notes.
- **Reviews, wikis and published research**: what players and critics report about timing and difficulty; biomechanics and physics papers for the real activity (a real ollie's height, a real push's cadence, a real punch's speed).
- **Footage, watched for mechanics and timing only**: how long a move takes, when the input lands, how far a jump carries. You may count frames. You may not trace, copy or reuse a single frame, a pose, a model or a sound.
- **The real world**: building codes for stair risers, the published dimensions of real equipment, the records for what a person can do.
- **Licensed code, assets and data** — under a permissive licence that lets a shipped game include the work: MIT, Apache-2.0, BSD, zlib,
  CC0, CC-BY (with its credit), or a dataset's own licence that says so — CMU's motion capture database, for one: "You may include this data
  in commercially-sold products, but you may not resell this data directly, even in converted form." Each licence is read at its source and
  recorded with the work (its URL, the files, their sha256 and the licence sentence); each is credited; used as tools, libraries or physics
  targets, never as a copy of a game. **Never** a non-commercial (NC) or research-only licence, nor a model that inherits one (SMPL, AMASS).

### What never goes in

- **Decompiled, disassembled, recompiled or leaked code** of the original, in any form, for any purpose — not to read, not to "check a number".
- **Ripped assets**: models, textures, animations, sounds, music, level data, fonts, UI art — not as files, not as references to trace.
- **ROMs, disc images, save files or memory dumps.**
- **Another game's animations, art, characters, names, park or level layouts, music or branding** — including the original's own title, its logo, its characters' names and looks, and its signature places.
- **An unlicensed repository as more than a reading of its README.** No licence means all rights reserved: you may learn that the project exists and what it claims; you do not open its code or its assets.
- **Any secret.** If a source looks like it was not meant to be public, it stays out.

### The record: CLEANROOM.md

Every number in the game has one row in `CLEANROOM.md`: what it is, its value, its **kind**, and its **source**.

| Kind | Meaning |
|---|---|
| **published** | stated in a public source (link it) |
| **published (the idea)** | a public source describes the method; the numbers are yours |
| **physics** | follows from physics (say how) |
| **derived** | computed from other rows (give the formula) |
| **own** | your design choice (say why, and what it was measured against) |
| **the person's choice** | the person's decision, in their words |

The top of the file says **what was read and what was not** — the sources consulted and, by name of category, what was deliberately left unopened. A gap is written as a gap ("no published rolling resistance for urethane wheels was found"), never filled by guessing and hiding it. When a later round changes a number, its row is updated in place with the date and the reason; the old value is not left lying in the table.

A worked example: a skate game built this way recorded rows like these (abridged):

| Number | Value | Kind | Source (abridged) |
|---|---|---|---|
| input read per pointer sample; each flick graded 1–5 accuracy × 1–5 speed | — | published (the idea) | the original's lead designer, in a games-industry interview: the stick read at 120 Hz, gestures graded |
| simulation step | 1/120 s | own | the original's physics ran at 60 Hz (another interview with the same designer) |
| gravity rolling / in the air | 9.81 / 12.5 m/s² | physics / own | the air's gravity by a published jump-design method (apex height + time to apex) |
| ollie apex | 0.30 → 0.85 m | own | ceiling: the world record for the highest ollie |
| ledge height | 0.36 m | published | real park ledges, 13½–14¼ in |
| stair riser / tread | 0.16 / 0.32 m | published | a building-code summary |
| the push's peak | 13 m/s² | the person's choice | chosen over a measured natural push |
| grind capture radius | 0.20 + 0.50 × assist m | own | the original's grind assist defaults to 50 (its accessibility page) |

## 1. Research → a cited specs table

1. **Name the genre's verbs.** For a skate game: push, carve, pop, flip, grab, grind, manual, land, bail, transfer. For a fighter: walk, dash, jump, block, the frame data of each normal and special, throws, combos. For a racer: throttle, brake, steer, drift, boost, collide. Each verb becomes a row-group in the table.
2. **Search each verb in public sources** — interviews, talks, manuals, accessibility pages, wikis, papers, the real-world activity. Keep every link. Prefer primary sources (the makers' own words) over summaries; when only a summary exists, say so in the row.
3. **Watch footage for timing**, never for art. Count frames at a known frame rate: a pop's time to apex, a punch's startup, a lap's sector times. Write the count and how it was taken.
4. **Build the parity table** (the contract, in `DESIGN.md` §1): each row a behaviour of the original, what the remake will do, and how it will be measured. A row no instrument can measure is not a row yet.
5. **Write the gaps.** What could not be found is listed as such, with what the remake does instead and why.
6. **Pick the original's FEEL, not its look.** The remake gets its own name, its own world and characters, its own palette and sound. A familiar mechanic is free; a name, a character, a level, a song or a logo is not.

## 1a. Work backward from the studied techniques — the standard

The standard: before you write a formula, a contact rule or an assist, use the technique the study found — and work backward from what it
measured to your own version, compliantly, so the time goes into the game's own features.

- **Before you write a formula, a contact rule or an assist, look up how it is already done — published METHODS and public FACTS, never
  another game's code, animation data or levels.** The study (your research notes, §1) names how the makers and the researchers do each verb
  in public: their talks, papers and docs. Take the **published method** — the idea — write it fresh with your own numbers, and record it in
  `CLEANROOM.md` as **published (the idea)**, with its source.
- **Work backward from the target.** Start from the behaviour the study measured or published (a real landing's squat by drop height, a real
  push's phase times, a published input window). Choose the studied technique that produces it. Tune its numbers to the target, with a wall
  that reads the target off the running game (§2).
- **Invent only where nothing published fits** — and say why in `DESIGN.md`. A new formula is a cost: it needs its own truth test, its own
  plants, its own explanation. Spend the invention on the game's **own features** (its world, its tricks, its modes, what makes it yours), not on
  re-deriving physics that is already known.
- **Compliant always (§0):** a method is an idea, free to use; code, animation data, names and levels are not. A technique learned from a
  talk about a commercial game is used as the idea, written fresh, with the talk as its source — never anything decompiled, recompiled or
  ripped. Open motion data is used only under its own licence, recorded like any base (its URL, files, sha256 and licence sentence).

**Studied techniques this remake used — each one public, each with its source kind** (add your genre's from your own study):

| Verb | The studied technique | Its public source (kind: published (the idea)) |
|---|---|---|
| the simulation's clock | a fixed step with an accumulator (§6) | Glenn Fiedler, *Fix Your Timestep!* |
| every follower: legs, trunk, camera, look | critically damped second-order dynamics, `f · ζ · r` (§6) | t3ssel8r, *Giving Personality to Procedural Animations using Math* |
| riding a surface | four raycasts at the wheels, the board on the plane through their contacts; a probe from above with a step-up height (§6) | the raycast-vehicle method (Bullet's `btRaycastVehicle`, zlib); a character controller's step offset (Unity docs) |
| meeting a face | **continuous collision as a stop on the path**: sweep, time of impact, stop a millimetre short, take away the motion into the face | Erin Catto, Box2D's time of impact (*Continuous Collision*, GDC) |
| the heading on the ground | the heading turns toward the travel **at most** as fast as the steering and the forces turn it; the rest is a **skid** scrubbed by the wheels' lateral grip | the friction-circle / lateral-grip model of arcade vehicle physics (*Car Physics for Games*, Marco Monster) |
| leaving an edge | a body leaves a surface when its **support** (its middle) passes the edge; a contact past a convex edge touches nothing | the ground check of character controllers |
| a board on an edge (the high-centre) | exact closest points: the deck a rectangle, the edge a segment | Christer Ericson, *Real-Time Collision Detection* |
| a landing assist | a critically damped turn timed by the predicted landing (§6) | the second-order method above, aimed at the landing |
| a contact already there | a contact present as the step begins is corrected a share a step, never all at once | Baumgarte's position stabilisation, as Box2D uses it |
| stopping at a face mid-step | **collide and slide**: stop at the time of impact, then carry the rest of the step along the face, a few bumps a step, the body seated once after them | Kasper Fauerby, *Improved Collision Detection and Response* (2003); the character controller's slide move |
| a fall | a Verlet ragdoll: particles and distance constraints | Thomas Jakobsen, *Advanced Character Physics* (GDC 2001) |
| a fall's start | the body hands the ragdoll the velocities of its last two animation frames (no reset, no fling), the muscles at partial strength, the human fall timeline (arms out ~0.1 s after balance is lost) | Erin Catto, Diablo 3's ragdolls (GDC 2012); the lab fall studies the research notes cite |
| moving between poses | **inertialization**: on a switch, the old pose's offset and its velocity decay to the new pose over a short time, never a cross-fade | David Bollo, *Inertialization: High-Performance Animation Transitions in "Gears of War"* (GDC 2018), as the study cites it |
| choosing the next pose | **motion matching**: the next pose searched from captured motion by the trajectory and the feet | Simon Clavet, *Motion Matching and The Road to Next-Gen Animation* (GDC 2016), as the study cites it |
| cyclic motion (a push, a stride) | **phase-locked cycles with foot locking**: a cycle's phase drives the pose, the planted foot pinned by IK while it is down | foot-phase-matched transitions and foot locking, as the study's animation-methods note cites them |
| captured motion | **motion capture as a physics target**, never as a pack: the measured timings and angles become the walls' bounds; open data only under its own licence, recorded like a base | the CMU Graphics Lab database's licence sentence (§0) |
| an input gesture | sample the stick fast and grade each gesture by accuracy and speed | the original's lead designer in published interviews (§0's worked example) |
| an input gesture, buffered | a gesture a moment early or late still counts: an input buffer and a coyote window | input buffers and coyote windows, as the study's flick-controls note cites them (its timings low-confidence) |

**Where nothing published fits, you invent — and say it is yours** (§1a's third rule). Two of this remake's, each walled and planted:
- **The body carried at the legs' limit** (ours): the body follows the board on a capped spring, and its lag from the board is held to the
  legs' limit; held there, the lag keeps only its rate back in — never its rate round the limit — so the board carries the body. Held with only
  its outward rate taken, the body slid round the board at the limit (a 171° orbit in 0.2 s; the rider's head against a ramp). The wall
  reads the lag's direction while it is held: it may not turn.
- **The roll-in speed per lip, measured** (ours): whether a board rolls over a coping or drops in is decided by the speed each lip was
  measured to hold the rolled crossing at, through the game's own gates — never a number set by feel. Every lip of the reference park
  measured 0: every run from the deck drops in.

**A measurement fixes the reference before a fix.** Measure against the thing the eye compares with (the hands against the drawn trousers'
surface, not the shoulders' line), and try a planned plant before its wall is built: a brake that "can never let a follower pass its target"
was refused when its old version, planted, never passed a target either — it was no wall.

Before each new piece of work, read the study's notes for that verb and add its rows here: what the method is, how it is applied, and its
source.

## 2. Every spec becomes a measured wall, planted both ways

A spec is only real when a test reads it off the running game and fails when it is broken.

### The wall

- **Drive the real code, not a model of it.** A Node test imports the game's own simulation and its own pose code, steps them frame by frame exactly as the page does (the fixed sim step, the pose at the display rate), and reads the number every frame — on every case it applies to (a sweep: every speed, every phase of a stroke, every element of the level).
- **At the rates players' screens run, with the stamps browsers hand them, and after a hitch.** 60, 90, 120 and 144 Hz, a display a hair off its name (59.94), each stamp coarsened to 0.1 ms, and the clock's phase left on a step's edge by a hitch. A constant frame is the one case where a fixed step draws evenly: every drive and every clip of a skate game handed its page a constant frame, and none could see that at 90 Hz its frames moved 0.75× or 1.5× their time and at 120 Hz after a hitch a third of them did not move (§6, the blend).
- **State the bound in the line**, and print the worst case with where and when it happened: `✔ the hips ride the legs: at most 57 m/s² on the ground (≤ 60; the bank going up at 6 m/s, 0.73 s)`. A reading that does not say where its worst case was cannot be acted on.
- **Read what the player sees.** Measure the drawn deck, the drawn hips, the camera — not the plumbing behind them. A row write, a version bump or a passing syntax check is not the feel.
- **Prove the instrument** on a known case before trusting it: change the input and watch the reading move. A null, a zero and an empty list are the cheapest lies an instrument can tell.
- **Classes, not one number**, where the physics differs: e.g. the body's acceleration bounded on the ground, a higher bound in the 0.2 s after a pop, a landing or a catch, and the air reported (not hidden, not passed) until its own class is built.

### The plant

Every wall comes with a **plant**: the defect it guards, put back into a copy of the tree, which the wall must turn **RED by its own line**.

```js
// tests/plants.mjs — one entry per defect the game once had or a wall exists to keep out
{ name: 'trunk_uncapped',
  why: 'the trunk\'s turn uncapped: a step in the board\'s turn rate came on the body at once (78 m/s² at a bank\'s seam)',
  edits: [{ file: 'build/js/view/skater.js', old: '<the exact current text>', new: '<the defect>' }],
  test: 'surfaces.mjs', catches: /✖ the hips ride the legs on the ground/ },
```

- Each round rebuilds every planted copy **fresh from the tree as it stands** and runs the wall **as it ships**. A plant's verdict from an older instrument is stale.
- An edit that no longer applies (the code moved) makes the plant **STALE**: rewrite it against the new code, never drop it.
- RED for another reason proves nothing: the catch line must be this defect's own line. If a plant cannot reach its defect (another guard holds it), rewrite the plant until it does — and note why in its `why`.
- **A defect found once is a class.** When you find one instance (a shared object held past its next use, a number in two places that disagree), write the quick script that finds every instance, wall it, then fix them all.

### Smoothness walls that worked (a skate game; adapt the classes to your genre)

| Wall | Bound | What it caught |
|---|---|---|
| the deck never jumps on the ground | a move the path takes and gives back ≤ 1 cm a frame (the smaller of two opposite second differences) | a teleport on a rail catch (54 cm); a 6 cm setback at a coping |
| the deck follows the ground at the ground's rate | its turn ≤ 120°/s over the turn of the plane through its four wheels' contacts | the mean-of-normals board turning 750°/s over a seam |
| the hips ride the legs | world acceleration ≤ 60 m/s² on the ground, ≤ 150 after a pop/landing/catch, the air reported | a body bolted to the board (235 at a pop, 255 at a rail's bend) |
| within the legs' reach, the feet pinned | the hips within sink 15, rise 3, sway 8 cm of the pose in the board's frame; the legs ≤ 0.98 of straight; the feet ≤ 1.5 cm RMS off their pins | springs set too soft or too stiff |
| the springs settle | after a step: overshoot ≤ 10 % of the excursion, at most one change of sign | an underdamped spring (ζ 0.2) |
| no joint pops | every joint ≤ 1,500°/s | a head whipping 120° in a frame; a limb's bend plane flipping |
| a turn eases in and out | its rate changes in a frame by ≤ 40 % of its peak, the first and last frames included | a board starting a 340°/s turn in one frame |
| the board never inside the level | a wheel's lowest point ≤ 1 cm into a solid, read at EVERY simulation step (a 120 Hz screen draws each one), on every assist preset a player can pick: the nearest surface along six rays from the point, met from behind, is how deep | a trailing truck through a deck's edge on the no-assist preset (9.7 cm); a corner wheel through a transition in a tilted landing (named, held, fixed in the landing work) |

Run the walls on **every preset a player can choose**, not only the default: the no-assist preset is where the board comes down as it flew, and where the clipping was.

## 3. The chain: where a bug starts

A RED wall says THAT something broke and where its worst case was; the chain says WHERE IT STARTED. The pipeline is recorded frame by frame, stage by stage, each stage read for its OWN breaks; when a wall goes RED at frame N, the chain names the first stage, in the pipeline's order, that broke in the frames up to N. Every stage after it only followed.

**The stages** (a character on a board; adapt the list to the genre — a racer: input → body → suspension → wheels → camera; a fighter: input → state machine → root motion → pose → bones):

| Stage | Read for its own break |
|---|---|
| sim | the simulation's own body: its position and its attitude, each a move taken and given back (> 1 cm, > 2°) |
| board | the drawn board on the sim's frame: the deck taken and given back (> 1 cm) |
| pose | the pose's own targets before any follower: the hips where the pose puts them (> 100 m/s² on the ground), the head's look (> 150 rad/s²) |
| trunk | the body's attitude after the board's: its angular acceleration (> 50 rad/s² on the ground, its follower's cap being 43) |
| target | the legs' target in the world: taken and given back |
| legs | the hips on their spring, by the legs' classes (on the ground, after an impulse); out of the legs' reach |
| ik | the feet on the deck: taken and given back; a leg past 0.98 of straight |
| bones | any joint turning faster than 1,500°/s |
| mesh | the drawn figure's far points (the nose, the hands, the toes): taken and given back |

```js
// tests/lib/chain.mjs — after each frame of a wall's drive:  C.frame(f, sim, events)   ·   under a RED gate:  C.say(N)
blame(N, back = 12) {                       // the earliest frame in the window with a break; at it, the most upstream stage
  for (const r of ring.filter((r) => r.f <= N && r.f >= N - back)) {
    if (!r.R.length) continue;
    const first = r.R.slice().sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || b.v - a.v)[0];
    return { stage: first.stage, what: first.what, frame: r.f };
  }
  return null;
}
```

Under every RED gate the wall prints the chain's line:

```text
✖ the hips ride the legs on the ground: at most 193 m/s² (≤ 60; the bank, up it at 6 m/s, at 0.73 s (roll))
  ↳ where it starts: trunk — the body's turn accelerating, 190 rad/s² (over 50) at frame 41; after it only target, legs
```

**Calibrate it on the clean build.** A chain that breaks on the shipped game blames a stage that only moved as it always does. Each sweep ends with `THE CHAIN IS QUIET ON THIS BUILD` — every reading's largest value over every case, none over its bound — and prints the census on request. A reading a wall already holds keeps the wall's bound; a reading no wall holds (the far points, the ankles) is the chain's own: calibrate it on the clean build (about 1.4 × its largest) and say so — a calibration, never a bar. A known defect the chain sees on the clean build is named and REPORTED on its own line, its window left to that report (a rider entering an arc at full rate steps the body's turn — 302 rad/s²; a body that lags the arc put 217 m/s² on the hips; and an eased entry with the same chord could not fit: with the board's middle at the rider's path minus the hips' 0.92 m, a curvature over 1/0.92 runs the board BACKWARD — the geometry's limit, not a tuning miss. The fix is the model's: a board ROLLS over a coping, the rider leaning before it goes over), never silently skipped.

**The traps it taught** (each made a blame lie before it was found):
- Read a move taken and given back only when its whole window is on the ground or on a rail, as the wall reads it; a window holding a frame in the air is the airs' class (a landing's own snap).
- Set a move on the frame it WAS (the wall's label: the second of its four samples), not the frame it was seen — two frames late, a blame looks behind the break and finds nothing.
- A reading known only later (a turn's step against the turn's peak) is noted on its own frame when it is known, and held for a frame not yet recorded.
- Keep pushing every reading's history on the frames it is not read: a history with a gap across an air read a hand "3.8 m taken and given back".
- A foot making its own stroke moves on purpose: leave it to the walls that read the stroke.
- Read what the stage actually used: the head's look as drawn, not the follower's state — a plant that bypasses the follower leaves its state still.

**Prove it on the plants.** Each plant names the stage its edit is in (`starts: 'trunk'`); the plant runner checks that the chain's line under the plant's catch names that stage, and fails the plant if it names another. A plant that is no discontinuity — a cadence, a latency, a foot's placement, a pose's shape, a turn not taken — is outside the chain's reach: it says why (`outside: 'a cadence is a rhythm, not a break'`) and its own wall catches it. A skate game's record: 17 of 33 motion plants blamed on their own stage (sim 6, pose 4, ik 3, trunk 2, legs 1, bones 1); 16 outside, each with its reason.

## 4. The judge loop: a second session reads frozen copies

- **Freeze before judging.** A round runs on a frozen copy of the tree (`<game>_r<n>`), never on the live working folder; nothing in a frozen copy is edited while its round reads it.
- **One round, one folder of evidence** (`runs/<n>/`): every Node wall; then, one at a time on the GPU, the browser drives (what is drawn, every state upright and turned, the camera's framing, the face, the HUD, frame times both ways, the input bots on both engines, the sound, the phone's weight through the turns); then every plant on the instruments as they ship. One line a step in `ROUND.log`.
- **A second session judges** — a supervisor that did not write the code — reading the frozen copy, the log, the plants and the clips, and saying what holds. The builder corrects its own earlier claims in writing when a measurement contradicts them.
- **Clips at a locked clock** from the game's OWN camera, at 1× (how it feels) and ¼ (what happens frame by frame), of the moves the round changed — and **one clip on a real display's stamp list** (60 Hz after a hitch: a steady roll, then a push): a locked clock cannot show pacing. A screenshot never passes a build; a clip is read by eye only after the walls are green.
- **The published bytes are checked**: after a publish, read every published file back and compare its sha256 with the frozen copy's.
- **The person's word makes it public.** Building it and playtesting it privately are the agent's work. Certifying, launching and publishing happen when the person asks: on NotesMosaic a LAUNCH is going public — `launch_game` makes a certified version what every player loads — and `publish_game` puts it into the community.

## 5. Tools: use the existing ones, and record them

### Blender, headless, for models

Blender's command line runs a Python script with no window — model, rig, bake and export from scripts you keep in the repository:

```sh
blender -b --disable-autoexec --python sources/make_prop.py -- --out build/assets/prop.glb
```

- **`--disable-autoexec` on every downloaded `.blend`**: a `.blend` can carry Python that runs on open. Give each download its own new folder, keep your scripts outside it, and open it with auto-run off.
- **A CC0 base is recorded before it is used**: its URL, its version, the file's sha256 and the licence text go in `CREDITS.md` and `CLEANROOM.md`. Only the base is third-party; everything built on it (clothes, hair, the face's detail, textures, props) is yours. The base file stays in `sources/`, outside what ships; only what you derive ships.
- **Export glTF** (`bpy.ops.export_scene.gltf`, binary `.glb`), with the triangle budget and the texture atlas's size stated and measured.
- **Read renders, not hopes**: render previews from the script (front, three-quarters, profile, the play view) and look at them before the game does.
- **Every drawn mesh is walled for its shape, at every level of detail**: each piece ONE closed surface — every edge on exactly two triangles (an edge on one is a hole's rim, on three or more a pinched seam) — and each piece's Euler characteristic read against its design: χ = V − E + F = 2 − 2g − b, with g its handles (a tunnel through it) and b its open boundary loops (edges on one triangle: a cuff, a hem left open), both named per piece. A closed piece with no tunnel reads 2; a dent (a mouth, an eye socket modelled as a hollow) is neither a handle nor a boundary and changes nothing. Read the exported index buffer, not the modeller's word: "every piece still closed" was said for four builds while a jacket, the hair and the shoes had edges on four triangles and a head had a tunnel under the nose's bridge. Plant a pinched seam and a tunnel, and watch the wall go RED.
- **The see-through drive**: on the GPU, draw the character alone on a layer of its own over a flat colour, posed as the game poses it (riding, its deepest crouch), from close behind, above-behind and the sides — where the follow camera looks most — and count the background's pixels the frame's edge cannot reach over background: the level seen THROUGH the body. It must read RED on a build with a known tunnel and 0 on a closed one.
- **A skinned character keeps the game's animation** when it is fitted to the game's skeleton: export the game's bones (names, hierarchy, rest pose) to a Blender armature, model the character in that rest pose, weight it to those bones, export, and in the game bind the mesh to the EXISTING bones (their rest is its bind pose; the bone lengths unchanged, because the IK and every motion wall read them). Prove the pipeline with a test mesh bound and posed back in the game before the modelling hours go in:
  - **The space.** A rig that is Y-up with its nose at +Z (three.js, glTF) goes into Blender (Z-up, its front at −Y) as (x, y, z) → (x, −z, y); the glTF exporter's Y-up writes it back. Check that every exported joint stands on the game's bone head (a few microns, not centimetres).
  - **The test mesh.** One small box per bone, its corners weighted 1.0 to that bone, plus a capsule on Blender's automatic weights.
  - **Bind as the game binds.** Remap the glTF's joints to the game's bones BY NAME, never by their order. Use the game's own bind matrix (a rig built at the origin binds with the identity).
  - **Check against what Blender wrote, not the mapping under test.** Pose the rig with the game's own animation and check that every box corner follows, exactly, the bone Blender gave it — read from the glTF's joint name, apart from the remap. A check that reads the same mapping it tests passes any mapping. Plant a remap by order and a world bind matrix, and watch both go RED.
  - **Four influences.** glTF keeps the four strongest weights a vertex has. Limit the weights to four in Blender before export, or the game's skinning is not Blender's.

### Libraries and repositories

- **Read the licence at the repository's own licence file** before reading its code. MIT, Apache-2.0 and CC0 are usable, each credited in `CREDITS.md` with its licence text in `build/licenses/`. No licence: README only.
- **Vendor and pin** what ships (an exact version, its licence beside it). A NotesMosaic page loads no remote code: libraries are bundled into the game's own files, or run at build time on your machine.
- **Prefer a well-known library or formula to a new one** (§6). Write your own only where nothing suitable is licensed, and say why in `DESIGN.md`.

## 6. The standard formulas — one module each, each with its truth

Every formula the game leans on lives ONCE, in `build/js/formulas/`, and every caller imports it: the legs, the trunk, the look, the crouch, the camera and the air's attitude all call the same follower; nothing hand-rolls a spring. Each module has its **truth test** (`tests/formulas.mjs`) — the formula against its closed form or its defining property, alone, in seconds, before any game wall reads what it drives — and **plants of its classic bugs** that turn that test RED. Print every follower's parameters in `DESIGN.md`.

### A fixed simulation step — `formulas/step.js`

```js
export const clock = (step, maxSteps) => ({ step, maxSteps, acc: 0, dropped: 0 });
export function advance(C, dt, run) {          // a frame's time as whole steps; a long frame runs maxSteps and drops the rest, counted
  C.acc += dt; let n = 0;
  while (C.acc >= C.step && n < C.maxSteps) { run(C.step, n); C.acc -= C.step; n++; }
  if (C.acc >= C.step) { C.dropped += Math.floor(C.acc / C.step); C.acc = 0; }
  return n;
}
// the page: prev = sim.read() before each step; advance(C, dt, (step, i) => { prev = sim.read(); sim.step(step, controls.sample(i === 0)); })
// — the input sampled per STEP — then draw drawn(prev, sim.read(), alpha(C)): the BLEND below

/* THE BLEND (Glenn Fiedler, "Fix Your Timestep!", its last section): a frame is drawn between the last two steps at alpha — what is left
   of the frame's time over a step — so the drawn instant moves by exactly each frame's own time, whatever whole steps ran under it */
export const alpha = (C) => Math.min(1, Math.max(0, C.acc / C.step));
export const mix = (a, b, t) => a + (b - a) * t;
export function slerpFrame(upA, fwdA, upB, fwdB, t) {   // an attitude given as an up and a heading: the short way between them
  const a = quatOf(upA, fwdA); let b = quatOf(upB, fwdB), d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map((c) => -c); d = -d; }
  let k0, k1; if (d > 0.9995) { k0 = 1 - t; k1 = t; } else { const th = Math.acos(d), s = Math.sin(th); k0 = Math.sin((1 - t) * th) / s; k1 = Math.sin(t * th) / s; }
  const q = [0, 1, 2, 3].map((i) => k0 * a[i] + k1 * b[i]), l = Math.hypot(...q); for (let i = 0; i < 4; i++) q[i] /= l;
  return { up: rotate(q, [0, 1, 0]), fwd: rotate(q, [0, 0, 1]) };   // quatOf: the basis (up × fwd, up, fwd) as a quaternion; rotate: q·v·q⁻¹
}
```

Draw positions mixed, attitudes slerped, a continuous clock (a phase's time, a flip's progress) mixed; everything discrete — the state, the trick, the events — from the newest step. **Except where a discrete thing and a clock are one thing:** a stroke's phase and its clock drive the foot's curve together, so the stroke is taken from the step whose phase holds the drawn instant, its clock run on to that instant (the newest phase on the last one's clock put the foot a step ahead of its own curve: it landed at 4.6 m/s over the ground at every plant). Cut the blend at a respawn and wherever the page moves the sim by hand: nothing is drawn between two places. The eye sees the newest step at most one step later — say so in every latency reading. Truth: under browser stamp lists (60 Hz locked after a hitch, 59.94, 90, 120 after a hitch, 144; 0.1 ms stamps) every frame's drawn move is its speed × its own time within 2 % (read at the newest step instead: 0 to 2×); the slerp's ends and its middle at half the turn. Plant: no blend (alpha held at 1) → RED. On the page: a drive that hands the frame loop a LIST of stamps and reads the drawn board's move per frame at a steady roll, both ways (THE DRAWN MOTION IS EVEN), planted unblended → RED. A design that says "state rendered interpolated between the last two steps" over a game that draws its newest step is a defect of the commonest class — specified, never wired: grep for the reader before you believe the sentence.

Truth: a replay of the real simulation through the clock is byte-identical; 240 frames of 1/120 s and 80 of 3/120 s end on the same bytes (only if the input is read per step, by the step's own count); a 250 ms frame runs 6 steps and drops 24, counted. Plant: no step limit (the spiral of ever-longer frames).

### Second-order dynamics — `formulas/follow.js`

One form for every spring: `k2·y'' + k1·y' + y = x + k3·x'`, with `k1 = z/(πf)`, `k2 = 1/(2πf)²`, `k3 = r·z/(2πf)` — **f** how fast, **z** damping (1 = critically damped; below 1 a step overshoots by `exp(−πz/√(1−z²))`), **r** response (0 starts from rest; with z = 1, **r = 2** makes k3 = k1: a steady ramp is followed with no lag, and a change of the target's rate lands at once), **cap** the most |y''| may be (a person's limit on how hard a turn can start). It is stepped EXACTLY, in its relative form `u = y − x − (k3 − k1)·v` (v the target's rate), where `u'' = −w²u − 2zw·u'` has a closed form — so the path is the same at 30, 60, 120 or 144 Hz, and stable at any step; **with a cap, exact wherever the cap does not bind** (sub-steps, each exact while its acceleration at both ends is within the cap, held at the cap where it binds). A spring stepped by Euler is a different spring at every frame rate — and a capped one sub-stepped by Euler at a fixed 1/480 s was 4 % off the exact path at 10 Hz and grew without end from about 76 Hz.

```js
export function second({ f, z = 1, r = 0, cap = Infinity }) {
  const w = 2 * Math.PI * f; return { f, z, r, cap, w, k1: z / (Math.PI * f), k2: 1 / (w * w), k3: (r * z) / w };
}
const KEYS = ['x', 'y', 'z'], isVec = (a) => a !== null && typeof a === 'object', zero = (l) => (isVec(l) ? { x: 0, y: 0, z: 0 } : 0);
const copy = (x) => (isVec(x) ? { x: x.x, y: x.y, z: x.z } : x);
export const follower = (x = 0) => ({ u: zero(x), ud: zero(x), v: zero(x), x: copy(x), y: copy(x) });   // sitting on x
function exact(P, u0, v0, dt) {                // u'' = −w²u − 2zw·u' over dt, in closed form
  const w = P.w, z = P.z;
  if (Math.abs(z - 1) < 1e-4) { const c = v0 + w * u0, e = Math.exp(-w * dt); return [(u0 + c * dt) * e, (v0 - w * c * dt) * e]; }
  if (z < 1) { const a = z * w, b = w * Math.sqrt(1 - z * z), e = Math.exp(-a * dt), cs = Math.cos(b * dt), sn = Math.sin(b * dt);
    return [e * (u0 * cs + ((v0 + a * u0) / b) * sn), e * (v0 * cs - ((a * v0 + w * w * u0) / b) * sn)]; }
  const q = w * Math.sqrt(z * z - 1), r1 = -z * w + q, r2 = -z * w - q, A = (v0 - r2 * u0) / (r1 - r2), B = u0 - A, e1 = Math.exp(r1 * dt), e2 = Math.exp(r2 * dt);
  return [A * e1 + B * e2, r1 * A * e1 + r2 * B * e2];
}
/* RELATIVE: s.u (the follower's lag), s.ud (its rate), v the target's rate this step — for a target with no position (an attitude) */
export function carry(P, s, v, dt) {
  if (!(dt > 0)) return s.u;
  const vec = isVec(s.u), c = P.k3 - P.k1;
  if (vec) for (const k of KEYS) { const dv = v[k] - s.v[k]; s.u[k] -= c * dv; s.ud[k] -= dv; s.v[k] = v[k]; }   // a change of rate lands now
  else { const dv = v - s.v; s.u -= c * dv; s.ud -= dv; s.v = v; }
  if (!(P.cap < Infinity)) {
    if (vec) for (const k of KEYS) { const r = exact(P, s.u[k], s.ud[k], dt); s.u[k] = r[0]; s.ud[k] = r[1]; }
    else { const r = exact(P, s.u, s.ud, dt); s.u = r[0]; s.ud = r[1]; }
    return s.u;
  }
  /* capped: sub-steps, each EXACT while the acceleration at its start and its end is within the cap; where the cap binds, the acceleration
     held at the cap through the sub-step (a constant acceleration, itself stepped exactly) */
  const n = Math.max(1, Math.ceil(dt * 480 - 1e-9)), h = dt / n, w2 = P.w * P.w, d2 = 2 * P.z * P.w;
  for (let i = 0; i < n; i++) {
    if (vec) {
      const a = { x: -w2 * s.u.x - d2 * s.ud.x, y: -w2 * s.u.y - d2 * s.ud.y, z: -w2 * s.u.z - d2 * s.ud.z }, l = Math.hypot(a.x, a.y, a.z);
      let ex = l <= P.cap ? KEYS.map((q) => exact(P, s.u[q], s.ud[q], h)) : null;
      if (ex && Math.hypot(...ex.map(([u1, v1]) => -w2 * u1 - d2 * v1)) > P.cap) ex = null;
      if (ex) KEYS.forEach((q, j) => { s.u[q] = ex[j][0]; s.ud[q] = ex[j][1]; });
      else { const k = P.cap / l; for (const q of KEYS) { const aq = a[q] * k; s.u[q] += s.ud[q] * h + 0.5 * aq * h * h; s.ud[q] += aq * h; } }
    } else {
      const a = -w2 * s.u - d2 * s.ud; let ex = Math.abs(a) <= P.cap ? exact(P, s.u, s.ud, h) : null;
      if (ex && Math.abs(-w2 * ex[0] - d2 * ex[1]) > P.cap) ex = null;
      if (ex) { s.u = ex[0]; s.ud = ex[1]; } else { const ac = Math.sign(a) * P.cap; s.u += s.ud * h + 0.5 * ac * h * h; s.ud += ac * h; }
    }
  }
  return s.u;
}
/* ABSOLUTE: y follows a target x (a number or {x, y, z}); its rate over the step is (x − its last value) / dt */
export function chase(P, s, x, dt) {
  if (!(dt > 0)) return s.y;
  const vec = isVec(x), c = P.k3 - P.k1, v = vec ? { x: (x.x - s.x.x) / dt, y: (x.y - s.x.y) / dt, z: (x.z - s.x.z) / dt } : (x - s.x) / dt;
  carry(P, s, v, dt);
  if (vec) for (const k of KEYS) { s.x[k] = x[k]; s.y[k] = x[k] + c * v[k] + s.u[k]; } else { s.x = x; s.y = x + c * v + s.u; }
  return s.y;
}
/* FIRST-ORDER, exact: the share of the way in dt — never k·dt, which is another ease at every frame rate */
export const ease = (dt, tau) => (tau <= 0 ? 1 : 1 - Math.exp(-dt / tau));
export const first = (tau, y, x, dt) => y + (x - y) * ease(dt, tau);
```

A skate game's followers, for scale: the legs `f 4, z 1, r 2`; the trunk's attitude `f 1.2, z 1, r 2, cap 43 rad/s²`; the crouch `f 3, z 1, r 0`; the head's look `f 1.19, z 1, r 0`; the camera first-order.

Truth (each to 1e-9 unless said): the critically damped step response against `1 − (1 + ωt)e^(−ωt)`; z 0.3 against its closed form and its overshoot 0.3723; f 20 Hz stepped at 0.1 s bounded and settled; the same path at 30, 60, 120 and 144 Hz (targets whose corners fall on sixths of a second, read on the sixths); the cap held on every step; r 2 follows a ramp with no lag, r 0 lags it by k1·rate; `ease(1/60, 0.1) = 1 − e^(−1/6)`. **The trap in the cap's test:** the follower's acceleration is the change of ITS OWN rate (v + u′) — a change of the target's rate moves v and u′ opposite ways and the follower's rate not at all — so read the step's change of u′ after the kick, not before. **A capped follower whose cap never binds IS the exact one**: to 1e-9 at 30–144 Hz for f up to 200 Hz, critically damped and underdamped, and one that binds hard never grows. Plants: dt left out of a step; an Euler step; a share per frame instead of per second; the cap ignored; the capped path sub-stepped by Euler.

### Riding a surface — `formulas/contact.js`

A board, a car or a sled sits on the plane THROUGH its wheels' contact points (the diagonals' cross product), not on the mean of the normals under them — over a seam it then turns as each pair of wheels crosses, over the wheelbase's travel, never in a frame:

```js
export function plane(c, got, up, out = [0, 0, 0]) {   // c: the contacts [front-left, front-right, back-left, back-right]; got: which touch
  const k = [0, 1, 2, 3].filter((i) => got[i]); let a, b;
  if (k.length === 4) { a = sub(c[0], c[3]); b = sub(c[1], c[2]); }          // the diagonals
  else if (k.length === 3) { a = sub(c[k[1]], c[k[0]]); b = sub(c[k[2]], c[k[0]]); }
  else return null;
  out[0] = a[1] * b[2] - a[2] * b[1]; out[1] = a[2] * b[0] - a[0] * b[2]; out[2] = a[0] * b[1] - a[1] * b[0];
  const l = Math.hypot(...out); if (l < 1e-6) return null;                     // in a line: no plane
  const s = (out[0] * up[0] + out[1] * up[1] + out[2] * up[2] < 0 ? -1 : 1) / l; out[0] *= s; out[1] *= s; out[2] *= s; return out;
}
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
```

Truth: over a seam (the front pair 2.3 cm down a 25° bank) within 1e-12 of the plane's own normal; three contacts their own plane; two contacts, or three in a line, no plane; the normal toward the board's up whatever order the wheels come in. **A twisted board** (one wheel 2 cm up — no plane holds all four): the normal is the diagonals' cross under every symmetry of the board (front for back, left for right) and none of the four three-wheel planes; a test on a coplanar seam alone passes a plane through ANY three of the wheels. Over the sweep, read how far the board's turn rate changes in the step a wheel comes into its touch window or leaves it (three contacts to four): a skate game read 21°/s at most against its 120 — had it read over, the wheel would be faded in over its window. Plants: the sign flipped; the sides' cross instead of the diagonals'; three of the four. A wheel touches only ground within a few centimetres of its line (lower, it is over a drop); past an edge the body rolls on the wheels that touch while its middle is over the ground, then flies. Rails are authored polylines; the catch is at the rail's top, steered toward it inside a capture radius while falling — and the board's attitude is aimed at the rail BEFORE the catch, not snapped at it. **Across the rail the board comes on at the speed it came in with:** its offset onto the rail's line eased by a cubic (Hermite) from the offset AND its own sideways rate, to rest on the line; up and along, the catch stops it as a landing does. Eased from rest instead, a board drifting 3.4 m/s onto a ledge stopped dead at the catch and was then eased the last 8 cm on — its path took 1 cm and gave it back.

### Jumps from height and time — `formulas/jump.js`

```js
export const fromApex = (h, t) => ({ g: (2 * h) / (t * t), v: (2 * h) / t });   // choose the apex and the time to it; gravity and take-off follow
export const speedFor = (h, g) => Math.sqrt(2 * g * h), timeFor = (h, g) => Math.sqrt((2 * h) / g);
export function moved(p, v, g, dt) {      // after v[1] -= g·dt: the step's MEAN velocity, so the apex designed is the apex reached
  p[0] += v[0] * dt; p[1] += v[1] * dt + 0.5 * g * dt * dt; p[2] += v[2] * dt; return p;
}
```

Truth: stepped at 1/120 s the apex within 0.2 mm and half a step of the design; the inverses agree. Plant: the position stepped by the velocity at the step's end (1.9 cm off an 85 cm ollie, and the predicted landing not the one made). Write h and t in `CLEANROOM.md`.

### Pushes, strides, strokes — `formulas/stroke.js`

A stroke's force is a half sine over the WHOLE contact — nothing at the plant, nothing at the lift — its peak bounded, its cadence inside the published range for the real activity; the foot meets and leaves the ground at the ground's speed.

```js
export function plan({ want, speed, aMax, sweep, driveMax }) {   // the contact lasts while the board rolls `sweep`, counting half its own gain
  let T = Math.min(driveMax, sweep / Math.max(speed, 0.01)), g = want;
  for (let i = 0; i < 3; i++) { g = Math.min(want, (aMax * 2 * T) / Math.PI); T = Math.min(driveMax, sweep / Math.max(speed + g / 2, 0.01)); }
  return { T, gain: Math.min(want, (aMax * 2 * T) / Math.PI) };
}
export const peak = (gain, T) => (gain * Math.PI) / (2 * T);
export function gave(u0, u1, gain) {       // the speed given between the shares u0 and u1 of the contact: the half sine's own integral
  const a = Math.min(1, Math.max(0, u0)), b = Math.min(1, Math.max(0, u1));
  return b > a ? (gain * (Math.cos(Math.PI * a) - Math.cos(Math.PI * b))) / 2 : 0;
}
```

Truth: stepped at 1/120 s the contact gives its gain exactly (to 1e-9) at every speed; under 0.1 % of the gain in its first and last 1 %; the peak never over aMax. Plants: the force stepped as rate × dt (a 7-step contact gave 98.3 % of its gain); the whole gain paid in the first 30 ms.

### A body on its legs

The rider's hips follow the pose's target on a critically damped spring in the WORLD (the knees give when the board pops, lands or catches), within the legs' reach in the board's frame, the feet pinned to the board by two-bone IK. The body's attitude follows the board's on its own capped spring (§6). A landing is taken by that spring — not by a canned dip animated on top of it. Where a rider DRIVES a turn (rolling over a coping, a turn in the air), the rider's middle goes round on its own arc and the board turns under them, square to it (a rigid rider standing square to the board: the model chosen here, not a published one) — and enters that arc gradually: a rider put on it at full rate steps the body's turn in a frame (the chain finds it, §3).

## 7. The game's layout

```text
<game>/
  build/                    what ships: the page and everything it loads
    index.html
    js/formulas/            the standard formulas, one module each (§6) — every caller imports them
    js/sim/                 the fixed-step simulation (no drawing)
    js/view/                the scene, the character's pose, the camera
    js/input/  js/audio/  js/game/
    js/config.js            EVERY number as data (physics, assists, tricks, the level, the springs); its sources in CLEANROOM.md
    assets/                 glTF and textures derived from sources/ — never a downloaded file as it came
    vendor/                 pinned third-party code, each with its licence in licenses/
    CREDITS.md  rights.json
  sources/                  Blender scripts, recorded CC0 bases (never shipped)
  tests/
    lib/                    the shared readers: the figure posed as the page poses it, the body on its legs, the chain (§3), the
                            board inside the level, a mesh's topology
    formulas.mjs            each formula's truth (§6)
    drive/                  browser drives (one at a time, on the GPU)
    plants.mjs  run_all.sh  round.sh
  DESIGN.md                 the parity table, the controls, the physics, the art, the budgets, the risks
  CLEANROOM.md              every number's source
  MODDING.md                how to add a level element, a prop, a trick, a character
  runs/<round>/             frozen evidence, one folder a round
```

- **The level is data.** Every element (a ramp, a rail, a ledge, a prop) is a row in config with its real dimensions; the collision mesh and the drawn mesh are generated from the same row.
- **The tricks, the assists and the springs are data.** A tuning change is a config change with its `CLEANROOM.md` row.
- **The character is a Blender script plus its skeleton's contract** (bone names, rest pose, lengths), so a new rider is a new script and a new set of textures, and the animation code is unchanged.

## 8. Shipping through NotesMosaic

1. **Read the platform's rules first**: `get_rules {"doc": "PUBLISHING.md"}`. A game is checked on its output: it boots and says so on its first painted frame (`window.__MOSA_BOOT.ok = true`), works on a phone upright and turned, is safe, and passes in Chromium and WebKit.
2. **Upload** a build (`begin_bundle_upload`) or write files (`write_game_files`); the person plays it in the conversation (`play_game`).
3. **A device decides whether it works**: `playtest_game`, then `get_playtest`. A static check (`check_game`) cannot see boot, frame rate or a phone.
4. **rights.json** (PUBLISHING.md §5b): certification needs it. A clean-room remake is the person's own original game: say so, with the record. **A famous game never as it is** — an original with the mechanic, its own name, characters and world.
5. **Weigh what a phone is asked to hold** (the textures, the buffers, every drawing surface), measured upright, turned and back; keep well under the phone's ceiling. Frame times both ways inside the budget.
6. `certify_game` → `launch_game` (the version every player loads: going public) → `publish_game` (into the community) — **each when the person asks**, never on the agent's own judgement that it is ready.

## 9. Updating and modding

- **An update is a round**: change the tree, run the walls (every plant still RED by its own line), freeze, run the round, read the clips, then publish — never around it. A fix that reached the live game by any other path is reported, then redone through the tree.
- **A mod adds data, not engine code**: a new level element, prop, trick or character is a config row plus (for a model) a Blender script in `sources/`, re-exported into `build/assets/`. Its walls are the same walls: the level census, the camera's sight rules, the frame budget, the phone's weight, the topology of every new mesh (closed, no pinched edge, no hole).
- **A mod's sources are recorded like the game's**: any base it starts from has its URL, version, sha256 and licence in `CREDITS.md` and `CLEANROOM.md`.
- **Keep the old with the new**: the previous version stays playable until the new one passes its round; a version's published bytes are read back.

## 10. Definition of done

- [ ] `CLEANROOM.md`: every number with its kind and source; what was read and what was not; the gaps named.
- [ ] Every formula, contact rule and assist is a studied technique with its source (§1a), or `DESIGN.md` says why nothing published fit.
- [ ] `DESIGN.md`: the parity table, every row with its instrument; the formulas used (§6) and their parameters.
- [ ] Every standard formula one module (§6), every caller on it, each with its truth test and its classic bugs planted.
- [ ] Every spec a wall with a stated bound and its worst case printed; every wall with a plant that turns it RED by its own line; the walls run on every preset a player can pick.
- [ ] The chain quiet on the build, its line under every RED gate, and every plant blamed on the stage its edit is in — or outside its reach, saying why (§3).
- [ ] A frozen round: every Node wall green, the browser drives green on both engines, upright and turned, the phone weighed, frame times both ways, every plant caught.
- [ ] Clips at 1× and ¼ from the game's own camera of the moves the round changed, read by a second session.
- [ ] Assets: their scripts in `sources/`, any base recorded, their budgets measured, every piece's topology walled at every level of detail, the see-through drive at 0.
- [ ] Nothing of the original: no name, character, level, art, animation, music or logo; no unlicensed code opened.
- [ ] `rights.json` written; the platform's playtest and certification passed; listed only on the person's word.

## 11. Task prompt template

```text
Use the `steal-like-an-artist` skill.

Remake the feel of [GAME or GENRE] as an original game called [NAME] — its own world, characters and look.
Research the public record first and write CLEANROOM.md (every number with its source) and DESIGN.md (the parity
table, each row with how it will be measured). Work backward from the studied techniques (§1a): use the published
method for every formula, invent only for the game's own features. Build the walls before tuning, plant each defect back to prove the
wall, and freeze a copy for every round of review. Make the models in Blender headless from scripts kept in sources/,
recording any CC0 base you start from. Ship through the platform's playtest and certification with rights.json;
I will decide when it is listed.
```
