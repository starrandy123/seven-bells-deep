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
