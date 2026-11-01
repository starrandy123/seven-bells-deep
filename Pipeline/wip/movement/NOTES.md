# Movement: where it stands (1 Nov, 08:06)

**Merged into `web/js` on 1 Nov, evening: `src/` is history now, and no longer matches the live code. Read `DESIGN.md` §Movement and `EPIC_STATUS.md` for where it stands. Everything below is as written at 08:06.**

Written for the cloud session taking over. Randy's priority is the basics of the body: land first, then swim. Missions are paused.

## What's live

The 07:56:28 promote is in `web/`:

- The whole land body is real capture (Rocketbox), legs included: walk, jog, run and sprint.
- Speeds with clips at 1.25×: walk 1.3 m/s, jog 3.9, run 5.9, sprint 8.7, super 36.
- The trident rides on his back out of a fight, and the tread is the new one.

`body_live_0756.js` here is the live body as promoted, kept beside the newer one.

Walls on that build:

- `move_walls` 51 of 61, `judged` 7 of 7, M20 green.
- Combat has one red: the Ice Path wall. He skates at 8.7 m/s and it wants 9.
- WebKit, the plants and a phone reading haven't been run on it.

## What's here and not live

`src/` is the private copy, ahead of `web/js`. It has never been run in a browser. The last changes (below) went in after the last walls.

1. Which foot goes first at a start. The live formula can lift both feet at once.
2. A foot planted from past vertical no longer flips 180°. This is the 7,957°/s reading on `foot_L` after a double jump.
3. `LAND_SPRINT` 9.1 (fixes the Ice Path wall), `MATCH` 9.2, `T_MATCH` 0.46.
4. Real starts and stops: `loco` in `body.js`, `run_start`, `run_stop`, `walk_start`, `walk_stop` and each `_m` mirror. Fight footwork stays on the stride (`!h.armed`).
5. `speedUp` and `slowDown` in `hero.js`, matched to those clips.

The clips are already in the live `hero.glb` and `moves.json`, unplayed, so `src/` can be tested on the live assets. A rebuild also trims `once.v` from `moves.json`, harmlessly.

To test: copy `src/` over a copy of `web/js`, then run the walls, including the new M4s and M4t, then `film startstop`, `startstopback` and `sprintnear`. Promote only if a stop and a start look right from close. `M4b` (a stop settles) may need reading against what a real stop does.

Already updated in the tree for `src/`:

- `web_check/move_walls.mjs`: speeds, M7 times, M1c on a flat, M2b 0.998, M4s, M4t, M20. Probes `--runrow` and `--jumprow`.
- `web_check/move_plants.mjs`: 69 plants rewritten, all apply on `src/`, none run on this build.
- `web_check/formulas.mjs`: 31 of 31 on `src/`.
- `web_check/move_film.mjs`: `cmp`, `cmpraw`, `startstop`, `startstopback`, `sprintnear`.
- `DESIGN.md` §Movement.

Three things to know before running anything:

- `web_check/move_go.sh` defaults `DEV` to my scratchpad. Set `MOVE_DEV` to a folder of your own, and put `src/` in `$MOVE_DEV/src`.
- `Pipeline/hero/out/` is gitignored, but the bake needs `out/mocap_land.json` and `out/skeleton_hero.json`. Copy `hero_out/*` back there first. If `mocap_land.json` is missing, `moves.bake` silently falls back to the old procedural clips. `mocap_read.py` can remake it from `Pipeline/hero/mocap/rocketbox/`.
- `Pipeline/hero/moves.py` is ahead of the live assets: the fist's wider roll on the shaft (`ROLLS`), and `CAP_SWIM` empty but wired. A rebuild changes the fight clips slightly, so run combat's walls and `rates.py` after it.

## Open reds on the live build

- **M1 family, planted feet:** 4.6 cm a frame at 60 Hz, limit 3. Up to 18 cm in the first frames at 120/144 Hz after a teleport. The start fix may clear that; unproven.
- **M3, joints outside a blow:** 7,957°/s on the double-jump landing (fix in `src/`). A steady run peaks about 1,700°/s for one frame. Starts about 2,000. Super about 2,900 and stop from super about 3,100 (foot pitch at the hold's edge). The raw clip's shin is 930°/s, or 1,160 at 1.25×, and 1,690 at super's rate, so super needs either a bound of its own or a slower cadence. M6a wants 6 steps a second there.
- **M3m:** Riptide on land 2,539°/s outside its active frames, 3,465 inside (limit 2,700).
- **M1b:** step rate 5.45/s, limit 5. Capture's steps are uneven, hence `T_MATCH` 0.46 in `src/`.
- **M1c:** hips lowest 45 % of the way between contacts. The clip says 18 %, and the wall now reads on a flat in `src/`.
- **M2:** 3.1 cm, limit 3.
- **M4c:** pivot slide 4.4-6 cm, limit 3.
- **Combat:** the Ice Path wall (`src/` fixes the number).

Turns: `m_turn_*` isn't used. They're slow, 2.4 s for 90°, and the root yaw is taken out of the files. At the end of a pivot he turns on his planted feet, then the settling step.

## `joints.py` (`Pipeline/hero`, needs `out/skeleton_hero.json`)

All six lines pass on `moves.py` as it stands:

- Elbow past 150: 149.5 in `cast_wave`.
- Elbow backward, knee past 150, knee backward, arm off the body at rest: pass.
- Forearm twist: 94.0 (limit 95) in `glacier_stomp`, down from 179.

How it got there, all in `moves.py`: `elbow_swing` tries elbow swivels and shaft rolls, and `stops()` applies the joint stops after the springs. The rig's elbow hinge was right.

`rates.py` on this tree: the worst fight clip outside a blow is 1,466°/s (`atk1`), limit 1,500. None of this forearm work is live until a rebuild.

## The swim swap, next after land

Reader and retarget work offline, no Blender: `Pipeline/hero/mocap_cmu.py`, `moves.cap_swim(sk, take, start, n)`. `cap_swim` lines him up feet-to-head so he stands in his own space and the game's `h.tilt` lays him down. No root motion.

Trials, read from stick sheets and from how arms and legs move together. Frames are at 30 Hz after the reader's step of 4:

| Use | Trial | Start, frames | What it is |
|---|---|---|---|
| `swim_slow`, `swim_fast` | `126_02` | 180, 74 (2.47 s) | front crawl with a real flutter kick. The best one |
| arms alternative | `125_06` | 900, 53 | a clean crawl, but the legs hardly move |
| boost, if it reads better | `126_06` | 420, 59 | butterfly. `126_07` at 360, 54 is the other |

`125_01`, `02`, `04` and `126_03`, `04`, `05`, `08` are breaststroke. `125_07` is 3 s standing. There's no tread trial. For the tread's upper body use Rocketbox's idles.

To do:

- Set `CAP_SWIM = {'swim_slow': ('126_02', 180, 74), 'swim_fast': ('126_02', 180, 74)}` in `moves.py`, rebuild, and film `tread`, `flowwater`, `dolphin`.
- Keep `boost` and `super` as they are until it's judged.
- Check M12a-c.
- Check M15. Tidepulse's beat is one wrap of `swimPh`, and a crawl cycle is about 1.6 s where the kick was about 0.6 s, so make the beat each arm stroke, or more.
- Check the side-by-side against the raw clip, as for land.

## Credits for `rights.json`

Rocketbox (MIT): `m_walk_neutral_01`, `m_run_neutral_01`, `m_run_fast_01`, `m_idle_neutral_01`, and the four start and stop clips, which ship in `hero.glb`.

CMU isn't shipped yet. Add its credit when a swim clip goes in.

## Films

`films/side_by_side.mp4` is raw left, ours right, at the new speeds, from the build just before the last small fixes, and driftwood crosses the end. The clean one is owed: `cmp` and `cmpraw` now use the long straight, then `hstack` them.

`flow_land`, `flow_water` and `land_phone_back` ran with no page errors. I looked at `flow_land` only.
