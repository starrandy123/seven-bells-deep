# How the duel is staged and shot

Read on 2 Nov 2026, after his word that the fight between the two sides "must be great and feature all their highlighted powers". Film and game titles are kept out of this repo; they're in the memory record.

## What was wrong

Two fighters running side by side, each on its own, 40 to 60 m apart over open water. Nobody answered anybody, and neither was big enough in the frame to read a stance.

## The sources

- David Bordwell, on Hong Kong action, davidbordwell.net/blog/category/national-cinemas-hong-kong/ . Start with clarity: bright sets, a steady camera, framing planned round the movement. Rhythm needs "slight pauses"; don't "cut away to something else before a punch or kick is completed". "More distant shots should be held longer than closer ones." Close shots there run 16 to 28 frames. Shots overlap: "What will occupy shot B is launched on the fringes of shot A". A blow can be enlarged: the same action again, closer and slower, which "extends the action's beat". And "amplify the expressive qualities of the action".
- The Gravestock thesis on wuxia editing, Flinders University, chapters 3 and 4: the kick-off shot, the insert.
- A fight game's camera post-mortem, beatdowncity.com/?p=291 : separate the camera's focus from the fighters, make its travel highlight the attacker, set rules for when it zooms, adjust height and amount to keep feet in frame.
- Unreal and Godot forum threads on two-fighter cameras: a rig at the midpoint, a zoom that scales with separation between a floor and a ceiling, and a hard limit on how far apart the fighters get, since at full zoom they still walk out of frame. Community practice, not vetted talks. No GDC talk on 3D fighter cameras turned up.
- Fan guides to the best-known flying-fighter series: rush chains, a clash where two fighters collide and trade a run of hits, vanishing around the opponent. Tips sites, no primary source on the camera. Nothing open to reuse: this is built from the ideas.

## What was built, in `web/js/champion.js`

- Turns: one attacks and the other answers, with half a second to a second between.
- The exchange: the one attacked turns to meet it. Every other time he blocks all three and answers with a side kick. Otherwise he's caught, and the third blow throws him back.
- A hard limit: 11 m apart, 15 during the great powers, within 12 m of the stage.
- The stage's axis runs along the coast, fire to the north and water to the south, so the camera offshore keeps fire on the left and the volcano and lava falls behind. It never crosses that line.
- The director frames from the separation, so both stay big enough to read with their feet in. Quiet: a two-shot, then low. A blow coming: over the other's shoulder, on the attacker. An exchange: side-on, no cuts. The great powers: wide, held 2.3 s. A blow that lands: cut in closer at 40% speed for 0.3 s.
