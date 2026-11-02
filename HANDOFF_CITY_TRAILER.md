# Handoff: Saltlight that looks real, then the trailer (2 Nov 2026, night)

You are picking up from session documents-4b on Randy's Mac. Read this whole file, then `~/.claude/CLAUDE.md` (his three standing rules), then the memory index `~/.claude/projects/-Users-randy-Documents/memory/MEMORY.md` and its record `project_drowned_city_2026_10_31.md`. The game is his ocean game; the worktree is this folder (`UnrealProjects/DrownedCity_fire`, branch `fire`, served on http://127.0.0.1:8852/, local commits only, never push).

## His words, newest last (log every new word of his in `EPIC.md` §11 at once)

On the trailer:
- "The video looks shit Claude. I need different cuts every 4 seconds and the underwater lights look like squares on surface. The clips from my original video yesterday were better for showcase with boss fights. There are dark figures in the frame where the hero is supposed to be. We are supposed to start with water fighting bosses, fire fighting enemies, the tornado doesn't look fleshed out and we need good looking frames. Look at standard game trailers and match ours to that"
- "Look at references and match ours to that standard. And if not then patch the game to fit"
- "We need new boss clips. The first clip literally shows just the boss getting hit and not the player. Plus we want to showcase the underwater cities, the various powers of each group being used in full frame. Do it again. This is not up to standard"
- "The fire guy needs the same treatment and we need to showcase the different use cases of the powers and building destructions too. This is why I said 3 seconds. For the flying, we want flying over to the cities overlooking water. No bland clips"
- "We need to showcase skyscrapers too in the land side" · "Flying around them and surfing through them too"

On the city:
- "The city looks bland and not lived in. Come on man, go find the requirements and standards of an open world city and lights and pedestrians and cars and shit and complaints users have with these to make it look good"
- "The buildings look flat and not actually 3d bro"
- "CLAUDE EHY DO I HAVE TO KEEP TELLING YOU OBVIOUS SHIT WITH THE REQUIREMENTS?! What did you look up that says to build the cities like this?"
- "The city looks like paper machet and not good at all. This is what slop looks like. You need to activate the desktop and start up a new Claude code terminal session on VS code to finish these requirements and shit and handoff the work"

## What went wrong, so it doesn't again

Saltlight was built from planning sources only (a grid, Tokyo's 31 m roofline, a tower-height curve, a setback rule, interior mapping). Nobody looked up what makes a shipped game city read as solid and lived in, and he had to point at each gap. His meta rule (in `~/.claude/CLAUDE.md`): before the first line, find the best real examples and sources online, read them at source, name them. Then build, then look at the frames the way he will (his phone, held landscape) before saying anything is done.

## State

- **His link:** Build 64 (upload 65ca0b0f, commit de5bf6c). His storage is 1,919.8 of 2,048 MB after the meter correction. Every booting build goes to his private link ("Upload every build"); certify, launch, publish and posting each need his yes.
- **Committed since Build 64, not uploaded yet:**
  - 993a9be: fire frames no longer veiled. The fire's glow in the air is the closed-form airlight of a point light (Sun et al. 2005). A fire light rolls off past 0.6 with its hue kept. A flash's glow keeps only a trace in the air. Effect sprites fade by the lens. Wall E33.
  - bbbd8d3: Saltlight lived in (`web/js/streetlife.js`, sources in `Pipeline/research/CITY_LIFE_SOURCES.md`):
    - walkers on a measured gait, crossing on the walk signal, talking in pairs, on phones, and running from fights;
    - Intelligent Driver Model traffic through signalled crossings (60 s cycle), turning, queueing, giving way to walkers and braking for him;
    - 9 m lamps every 18 m at 3000 K, with pools twice as bright at crossings;
    - signals, avenue trees, soft shadows, head and tail lights;
    - nobody is made or removed in view.

    Also in this commit: the street ground is drawn on the buildings' own grid (it was 6 m off: the "pale slab"), with pavements, kerbs, lanes and crossings. E24 forces the move it tests (it hung on the order of random numbers).
  - Two minutes of the city's traffic run clean: about 80 of 180 cars moving, none stuck in a crossing, and the walker counts on crossings never leak (`scratchpad` probe `hunt/traffic.mjs`, copied to `web_check/traffic_probe.mjs`).
- **Walls:** `wall_ember` 33 of 33 (chromium), `wall_sides` 9 of 9 (webkit), both on bbbd8d3's tree.
- **Budgets at a Saltlight street:** 49-54 draw calls of 100, 200-266k triangles of 500k (stills, phone tier).

## Open, in his order

1. **The towers look flat ("paper machet").** Research them first, at source. A research pass was running when this was written; whatever it returned is at the end of `Pipeline/research/CITY_LIFE_SOURCES.md` if it landed. Leads:
   - Müller, Wonka et al., "Procedural Modeling of Buildings", SIGGRAPH 2006 (CGA shape: mass model, facade split into floors and tiles, windows inset, ledges, cornices);
   - "Instant Architecture", SIGGRAPH 2003, and the CityEngine CGA reference;
   - architectural numbers for window reveals, cornice and belt-course projections, parapets, and ground-floor shop fronts (Gehl: at least 4 m tall, at least 10 doors per 100 m);
   - relief and parallax mapping for window depth (Policarpo and Oliveira 2005; Tatarchuk 2006);
   - ambient occlusion at bases and corners; faces separated by sun and shade.

   The facade shader is `metro.js` (interior mapping in `ocRoom`; the tower boxes are one instanced draw). Cheap wins that fit a phone:
   - an analytic window recess in the same shader (a shallow box ray, like the room ray);
   - thin instanced boxes for cornices and belt courses that throw shadow lines;
   - rooftop gear;
   - darker lower floors in narrow streets.

   The palette is also pale and flat by day.
2. **Street life polish:**
   - night windows in two or three tints, a lit share per building, and offices going dark after midnight at scattered times (sources in the file);
   - people in some lit rooms;
   - street dressing: bins, benches, bus shelters, manholes, and parked cars if a kerb lane is made;
   - the phone cap of 100 drawn cars is reached at street level.
3. **Trailer v3**, to Derek Lieu's line of rising action (cold open, heroes, escalation, twist, climax, button):
   - 3 s cuts, about 60 s, vertical 1080×1920, silent so he can talk over it;
   - his order: water against bosses first, then fire against enemies;
   - he must be large and in the same place in frame from cut to cut (GMTK: "keep the focus point in generally the same place between cuts").

   Tools are in `Pipeline/film/trailer/`:
   - `rig.js`: the camera. `__rig.hero({dist, up, ang, look, fov, k, under, at, w})` sets the lens round him; `__rig.ots(target, {back, side, up, w})` frames him over the shoulder against a boss. Both sweep clear of walls.
   - `shoot3.mjs`: films the game frame by frame. Plans hold shots with `setup`, `each`, `warm`, `warmUntil` and `log`.
   - `sheet.sh`: contact sheets.
   - `plans/`: every scout I ran.

   Scout at 270×480 (scale 2), shoot finals at 540×960 (scale 2):
   `env SHOOT_LIMIT=420 bash ~/.mosa/heavy.sh run <who> -- node Pipeline/film/trailer/shoot3.mjs <out> <plan.json> 540 960 2 30`

   **What scouted well:**
   - The Leviathan in its arena over his shoulder (`scout_b.json` `sb_lev_left`: about 1.5-3 s is him in front of its open maw). Its body sometimes crosses the lens, so take long takes and pick the windows.
   - The Cinder Colossus by the reef over his shoulder, bright water (`sb_colossus2`, 0-2.5 s).
   - The Kraken (`sb_kraken2`).
   - Meridon's dome, Thalor's statue and towers, and the Kelp Shrine (stills `scout_cities.json`). Swim him past them slowly, not on Boost: boosting makes him a streak.
   - The water hero's Maelstrom underwater with Reavers, and the Wave and Geyser at the surface with the lens above water (`under: false`).
   - The man in red's Firewheel on the Ash City plaza with newts. This was clean only after the look fixes in 993a9be; before them the frame was veiled.
   - Flights to Sunward Harbour and the High City (`scout3.json` `sun_fly`, `sky_fly`). He sat at the frame's right edge there, so bring the lens round.
   - The water hero surfing down a Saltlight street on his land Boost (`salt_surf`).
   - The meadow burn on Sunward Isle (`burn`): the grass fire spreads and leaves black ground.

   **Still to get:**
   - the fire side's bosses with him in frame: the Last Seawall (wakes at Sunward Harbour; `G.bosses.seawall.wake()`, centre 34 m out to sea) and the Tidecaller (`G.ember.champions().start('water')`);
   - building destruction (scorch.js `buildingHit`: fire chars and heats, a heavy blow breaks the face then the room, water washes and cracks hot stone, ice crusts, all mend after 30 s). The Sunward village houses are in `cityMeshes`;
   - flying round Saltlight's towers (the orbit scout looked away from the tower: use `__rig.ots` on the tower);
   - the water hero dousing a fire (switch sides about 40 frames into the burn, while it still burns);
   - the tornado lift to the High City (that scout put the lens inside the isle's slope).

   **Traps:**
   - `setSide('fire', { place: true })` now puts him in the High City. For the Ash City plaza use `Q.walkAt(246, -760)`.
   - End flight first on the ground (`h.endFly(); h.fly = false; h.fireAir = false`), or he lies flat in his flight pose.
   - At Boost speed use `k: 0`, or he leaves the frame.
   - A take's camera must be checked against bushes, rock and the High City's underside, which the sweep doesn't see.

   **Assembling the video** (his word after the handoff: "be sure it can put together the video too and fix the city building depths"):
   - Shoot the city's shots after the towers' depth is in, so the trailer shows the fixed city.
   - Write a cuts list, one line per shot: `<clip path> <start s> <duration s>`. About 20 shots of 3 s, on Lieu's line in his order:
     1. water against bosses: the Leviathan, Colossus and Kraken, him and the boss in one frame;
     2. fire against enemies: the plaza fight, the Pale Flame in the air;
     3. powers full frame and what they do: burn, douse, freeze, break a building, the tornado lift;
     4. the drowned cities;
     5. flights to the cities above the sea, and round and through Saltlight's towers;
     6. the twist: the Tidecaller's drag; the climax: a boss and All Fire;
     7. the button: a hero shot over Saltlight at sunset.
   - Run `bash Pipeline/film/trailer/build_trailer.sh <cuts.txt> <out dir>`. It writes `TRAILER.mp4` (1080×1920, 30 fps, hard cuts, silent), the phone copy `phone/TRAILER.mp4` (under 30 MB) and `sheet.jpg` (a frame every 2 s).
   - Read the sheet and the first frame of every cut before anyone sees it. Each shot must hold him large and in the same place, the boss or the power or the city behind him, and no dark figure, veil or square.
   - File both copies in `~/Documents/Marketing/ContentFunnel/out/2026-11-02/two_days/`, add an entry to `ContentFunnel/PROGRESS.md`, and send him the phone copy with SendUserFile. He is on his phone.
   - Yesterday's clips are in `~/Documents/UnrealProjects/DrownedCity/Pipeline/film/clips/final/` (1080×1920). He rejected `5b_boss_wide` as the opener: it shows the boss hit, not him.
4. **Build 65:** bump `BUILD` in `web/js/config.js` and `NEWS` in `web/js/ui.js`, then run `PART2_OUT=<scratchpad> bash tools/push.sh b65 8871`. Upload through the NotesMosaic MCP: `begin_bundle_upload` with the game id `ae306273-777b-4c7b-838e-bf58cc382378`, then PUT the zip, then `finish_bundle_upload`.
5. **Content:** the TWO DAYS script in `~/Documents/Marketing/ContentFunnel/plans/2026-11-02_scripts.md` awaits his review. The rejected v2 trailer is `out/2026-11-02/two_days/TRAILER_1080x1920.mp4`.

## Rules that bind (the full set is in his CLAUDE.md and the memory index)

- **Simulators:** never delete the iOS simulators, Xcode, or the Android emulators and SDK.
- **Sources:** never make it up from scratch: real sources first, read at source, named; open-licensed code only, licence recorded. Too heavy for the phone is not a no: learn it and make an optimised version.
- **Machine:** one heavy job at a time: `bash ~/.mosa/heavy.sh run <who> -- <cmd>`. It's an 8 GB M1. No visible browser windows. Blender scripts import `Pipeline/hero/guard.py`.
- **Names:**
  - Never Aquaman, Atlantis, DC, Marvel, a studio's name or a famous character in the game, files, listing or reels.
  - Game and film titles stay out of repo files (memory records hold them, e.g. `reference_city_life_sources_2026_11_02.md`).
  - Clean room: nothing decompiled or leaked.
- **Code style:** nothing after `//` on a line of code; comments go on their own line above.
- **Commits:** local only, never push. The trailer:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

  plus the session link of whoever commits.
- **Checks:** walls with `--only=E…` for what changed; a build re-reads only what it changes.
- **Never redesign his HUD.** Cliffs are not accepted. Certification row `e7a83387` must not be run.
- **Tool shell is zsh:** `$var` does not split, so quote globs or run bash.
- **Talking to him:** `accepted` is his word alone. He judges on his phone, held landscape. Short plain status lines; he posts, you never post.
