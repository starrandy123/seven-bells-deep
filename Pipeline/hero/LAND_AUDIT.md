# Land movement audit, before any fix

Build as of 23:15, 31 Oct, live `web/`. Filmed from the game's own camera with `web_check/move_film.mjs` (stepped at 60 Hz, drawn bones logged every frame) and read with
`web_check/move_read.mjs`. Sunward Isle: open meadow at (-358, 488), the 36° slope at (-310, 434), the west shore at (-512, 452); the super sprint on the longest clear line on the map.

A first run was thrown out: the "flat" spot was the temple floor and he was running on the spot against a wall, so those numbers came from a pinned body. Caught by looking at the frames.

## What the numbers say

| Phase | Speed (m/s) | Planted foot slide, worst | Bound | Notes |
|---|---|---|---|---|
| walk | 1.5 | 8.5 cm/frame | 3 | mean 2.0 |
| run | 7.0 | 8.7 cm/frame | 3 | clip keyed for 4.2 m/s, played at 1.67× |
| sprint | 13 → 36 | 16.4 cm/frame | 3 | |
| super | 36 | 38 cm/frame mean 21; 53 at the charge | 3 | an 8.2 m/s clip capped at 3.2×, so 26 m/s of the speed is plain gliding |
| stop from 31 m/s | 31 → 0 | 33.5 cm/frame | 3 | sheds nearly all of it in about 0.3 s; no weight at all |
| U-turn | 7 | 13 cm/frame | 3 | heading turns at 251°/s with nothing in the legs |
| 36° slope, walk up | 1.75 | 8.9 cm/frame | 3 | toes 18 cm into the hill, the other foot 27 cm above it |
| 36° slope, run up | 7.0 | 27 cm/frame | 3 | toes 72 cm into the hill; hips down to 0.26 m over ground; no slowdown at all |
| landing | | hips ÿ 926-1,853 m/s² | | one-frame pop from air pose into a crouch |
| shore | 7 | hips ÿ 1,930 m/s²; y steps 54 cm in one frame | continuous | `land` flips at ground -1.4 and the height jumps to the swim line |

## What I saw, frame by frame

1. **Feet slide everywhere.** `timeScale = speed / clip speed` is the whole of the stride match: legs keep the clip's stride length and only the rate changes, so past the clip's range they skate.
   Cadence goes wrong too: at 7 m/s the 4.2 m/s clip runs at 1.67×, so the legs flicker far faster than a person's would.
2. **He glides on the root.** The body moves as a rigid shape at constant height; the stride doesn't push him. Nothing rises or falls with the steps in the world; only what the clip happens to do.
3. **Nothing has weight on stops.** `damp(vel, 0, 9)` on land: from 31 m/s to a stop in a few frames, feet still cycling. No plant, no brace, no settle.
4. **Starts have no lean.** Velocity eases in at 9/s; the body is already upright at full clip. No drive off the rear foot.
5. **Turns snap and glide.** Heading follows velocity at 6.5/s. Body stays upright with no lean into the turn (bank is zeroed on land). A U-turn is a smooth swing of a rigid figure, no plant, no pivot.
6. **The jump has no anticipation and no weight.** `h.vel.y = 10.5` the same frame as the press. Gravity 19. Fixed height: press length does nothing. No coyote time, no buffer, no second jump. In the air he holds the clip while the arms slowly float.
7. **Landings pop.** One-frame cut into the `land` clip's crouch (fade 0.05 s), ring and shake. Same landing from 1 m or 10 m. `h.state = 'hurt'` steals control for 0.38 s on anything over 9 m/s fall.
8. **Plain cross-fades everywhere** (`fadeIn/fadeOut`), and the set switches water-land with no handling at all: `set` swaps in one frame while `blend` carries on.
9. **Float in `h.pos.y`.** `damp(h.pos.y, g + STAND, 18)` means he lags terrain and overshoots crests; on the slope the feet are simply wrong by the slope's rise over the stance width.
10. **No IK at all.** Feet follow the clip's flat ground. On 36° one foot is deep in the hill and the other hovers.
11. **No slope limit that reads.** A flat rule, rise/run over 1.5 (56°) in one step, stops him dead; he ran up 36° at the full 7 m/s, then stopped like hitting glass and stood with speed 0.39 in a stuck-looking state. The grid is 2.5 m bilinear, so the rule is noisy.
12. **Super sprint reads as a shape sliding.** 36 m/s on an 8.2 m/s clip capped at 3.2×: legs in slow motion against racing ground, exactly what M6 names. The camera pulls so far back he's small.
13. **Ledges:** off a ledge only above 5 m/s and a 0.9 m drop, otherwise he snaps down through `damp`.
14. **The shore is a state flip.** `land` true at ground > -1.15, false at < -1.4. Height jumps 54 cm in a frame. No wading at all: full run into waist-deep water, then instantly a swimmer.
15. **The mantle.** From the game's camera, which is behind him nearly always, it covers him from shoulders to knees: he reads as a blue shape on two small legs, and it hangs still at a run. This hides what the legs do, and the owner saw it flare. It's both too big for this camera and too dead. It needs wind from velocity, and to be narrower and shorter so the body reads.
16. **The camera frames a small figure** at every speed; it lerps at 22/s (exponential, frame-rate-safe but not a spring), and `camP.y` clamps can pop. At 36 m/s he's a dot.
17. **`trident` on land** at 7 m/s swings level at the hip: acceptable, a check after legs are right.

## Causes, grouped

- Everything is `hero.js` steering a position, with the legs an unrelated clip. There's no link from the body's real motion to the feet.
- No inertialization, followers, IK, or stride model exist. `damp()` is the only tool, used for everything.
- Sim and pose are tangled: the state machine picks clips by speed thresholds.

## What fixes this

Legs driven from the sim: a stride phase advanced by distance walked, feet pinned in the world while planted, swing arcs to predicted plants on the real terrain, two-bone IK from hips dropped to reach. Upper body from clips phase-locked to that stride. Lean, pivot and landing crouch from second-order followers. Inertialization on every switch.
