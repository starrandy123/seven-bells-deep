# Smooth movement: what each fix is built from

Randy, 2 Nov: "Okay let's fix these and the movements smoothness and shit." Titles of games and films stay in the memory record.

## How it was measured

A survey script (kept in the session's scratchpad) steps the real game with `G.frame(dt)` at phone size and reads every drawn bone every frame, in the method of `POSE_SOURCES.md`: limbs in the model's own group, never against `e.pos`. A real hand tops out near 12 m/s and a real kick near 20; a joint past 40 rad/s is a pop. It covers both heroes in every state, the raiders, the champions and their duel, and the bosses' parts. It also reads the camera, and those numbers went to the controls owner. Before and after numbers for each fix are in the commit that makes it.

## The mixer only writes what changed

three.js r185, `PropertyMixer.apply` (MIT), read in the vendored build: after mixing, it calls `binding.setValue` only `if (buffer[i] !== buffer[i + stride])`, with the comment "value has changed -> update scene graph". A pose the mixer holds still is never written again. Anything laid on a bone after the mixer stays on it: a look-at, the inertial offset, a ragdoll's weight. The next frame lays it on again. Over a duel the champions' necks and heads turned at up to 187 rad/s, with 190 frames past 40 in 15 s.

The fix (`inertial.js`, `pre` and `mark`) keeps the mixer's own pose as it comes out and puts it back before the mixer runs again. Whatever goes on top then always goes on the mixer's pose. It costs two copies of about 25 quaternions per figure a frame, into arrays made once.

## The look

- Daniel Holden, Spring-It-On, `simple_spring_damper_exact` (MIT, github.com/orangeduck/Spring-It-On). The look's direction follows its goal on a critically damped spring, turned the short way round in scaled angle-axis, the same spring as the flight's body in `hero.js`. Its weight follows on a spring of its own. A goal that jumps, such as a new foe, a speed crossing a line or a blow starting, turns the head instead of snapping it. Half-lives are 0.12 s for the direction and 0.1 s for the weight (ours).
- Godot, `scene/3d/look_at_modifier_3d.cpp` (MIT), read at source. It detects a flip, when the target crosses behind the limit, and starts a timed transition that interpolates "via rest ... for preventing to penetrate the bone into the body". Taken: a goal crossing his back must take the head through its rest. Here the turn past the limit gives way smoothly to none straight behind (`aimChain`), so the axis flip there moves nothing.

## The bosses

- The same spring as above (Holden, MIT) turns the Kraken, the Colossus and the Seawall to face him, the short way round. The Kraken and the Colossus turned in a single step whenever he passed close. The Seawall's turn was eased on the raw angle, so it could spin the long way when the angle wrapped. It also moves the Kraken's arm tips and the Colossus's fists toward their goals, so they start and stop instead of jumping a share of the way each frame.
- A slam goes from where it was raised to its mark over the strike's own time, on a constant acceleration (ours), so it is fastest at the hit. Before, it was a first-order lerp at 40 to 44 a second, which covers half the way in the first frame. The timing of the hit is unchanged.
- The serpent's lunge reaches its 27 m/s over a tenth of a second on the same spring, instead of in one frame.
- Measured but left alone: a slam's reach has no limit. An arm or a fist sent at a Warden 50 m away still covers about 11 m in its last frame. Limiting it is a design call, because it changes who can be hit.

## The Warden's and the man in red's bodies

- Kovar, Schreiner and Gleicher, "Footskate Cleanup for Motion Capture Editing", SCA 2002 (`[Kovar02]` in STANDARDS.md): per-frame IK jumps when a foot's constraint switches on or off. Here one did. In a stop clip, a foot that ran out of leg was let go plainly while the clip still wanted it down. It was planted again the next frame at the clip's place, up to 45 cm away. It is now let go "early", the clip's own way of reaching out, so it swings to the clip's next contact.
- The same inertialization as every other switch (Bollo, GDC 2018; Holden's spring.h, MIT; `POSE_SOURCES.md`), on three switches that skipped it: the jets' poses coming on or off, the side changing, and the fire side's guard at its 3 s mark. The guard now has a weight of its own.
- The rule `inertial.js` keeps for the mixers, 40 rad/s, now holds for the Warden's trunk and arms too. A joint past it becomes an offset that dies away on the quintic, for that bone alone. The fire side's capture turns a wrist up to 3 rad between two of its 30 fps frames (`e_rev`, `e_side`, `e_lunge`), which was 91 rad/s at 240 Hz. The legs are left to the foot solver.

## Frame pacing

- Tyler Glaiel, "How to make your game run at 60fps" (2018), and his `frame_timer.cpp` in github.com/dbechrd/FrameTimingControl (MIT, copyright 2019 Tyler Glaiel), read at source. A fixed 60 Hz update on a 60 Hz screen, fed a timer with its own jitter, runs no update in one frame and two in the next whenever its accumulator sits near a step. His fix, taken here in `main.js`: snap a frame's time to a common refresh when it's within an error of it (his are 60, 30, 20, 15 and 120 Hz; here 60, 120, 30 and 20, with 90 and 144 added), average the last four, and treat a frame past eight steps as one. The snap error is 1 ms here (his is 0.2 ms), because a page's clock is coarsened to 100 µs (MDN, `performance.now`) and its frames carry their own jitter. The game time drifts from the wall clock by whatever the screen's real rate is off 60, a trade his article makes on purpose.
- Godot's `main/main_timer_sync.cpp` (MIT) was read as the alternative. It estimates the refresh from 60-frame averages and locks the estimate once it's confident. It is better when the refresh is unknown, and heavier than this game needs.
- Measured in Chromium on this Mac's 60 Hz screen, in the real loop, over 12 s. Before: 30 frames ran no rule step, 28 ran two, and there were 27 back-to-back pairs of them. In the first second a 0-1-2 run held for most of the second. After: 1 frame ran none, 2 ran two, and there were no pairs.
- Glenn Fiedler, "Fix Your Timestep!" (`[Fiedler04]` in STANDARDS.md), its last section: everything drawn is drawn between the last two steps. His place already was. Now his tilt, bank and pitch, the surf's lean and rake, the jets' attitude and the air dodge's roll are too (`main.js` keepDrawn, `body.js`), and so is his heading when he turns on the spot (`G.alpha`). At 120 Hz the body's turn rate jumped up to 52 rad/s in a frame in an air dodge, 8.4 in flight and 10.2 in a swim turn. After, those three are 5.7, 0.3 and 3.4.

## A foot out of reach in a landing

- Andy Nicholas's soft IK, as the Toolchefs Maya solver implements it (github.com/Toolchefs/softIkSolver, read at source; no licence file, so only the idea is taken). The README says: "the velocity of the joints that approach the full extension position is damped by an exponential function", applied as `dA + dSoft * (1 - exp(-(x - dA) / dSoft))`. `body.js` already gives each leg this soft reach (0.965 to 0.998 of its length). The knee snap at a landing at a run came from what the landing did on top of it: the lift that keeps the bent leg's reach was dropped to the ground in the frame a foot passed that reach.
- Taken from the stride's own rule, that a foot run out of leg comes up and swings: a foot carried past the bent leg's reach in the brake now comes up. Its lift comes down at 6 m/s (ours), not in a frame. A settling step, the stance's tidy-up after a stop, now only fires when he's standing. A landing at a run turned the stride off for a frame and started one at 7 m/s.

## Raiders, ragdolls and leaving the ground

- The raiders' drawn facing follows the rules' facing on the same spring as the bosses' turns (Holden, MIT). The rules' turn starts at full rate from rest, 13 to 16 rad/s in its first frame.
- The ragdoll (`ragdoll.js`, Jakobsen's method, `RAGDOLL_SOURCES.md`) reads its limbs off its points. Now no bone turns past the 40 rad/s of `POSE_SOURCES.md` from the frame before. A point thrown round by the relaxation or the hinge turned a forearm at up to 80 rad/s.
- Leaving the ground, the root's height used to snap from the ground's spring to the rules' height. Now what that spring still had in hand dies away on the same spring, as the switches' offsets do. A difference past 0.6 m is a teleport and isn't carried.
