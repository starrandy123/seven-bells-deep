# A body that doesn't jump

Randy, 2 Nov: "The fighting looks very choppy". Titles of games and films stay in the memory record.

## What was measured

`hunt/pops.mjs`, kept in the night's scratchpad: every hand, foot and head in the fighter's own frame, at 60 Hz, for a whole 36 s duel. The fastest real hand is about 12 m/s and a real kick about 20.

| | fastest limb | samples over 25 m/s |
|---|---|---|
| before | 50 m/s | 56 |
| after | 14 m/s | 0 |

Two causes. A three-frame fade into a hit pose a metre away is 67 m/s by itself, in the world's frame. And `draw` in `ember.js` switched the flight poses from weight 0 to full weight the frame a move ended.

Mind the frame of reference: measured against `e.pos` a blow's own impulse reads as a pop, because the model is placed before the position changes. A pose is measured against the model's own group.

## The method

Inertialization, David Bollo, GDC 2018, "High-Performance Animation Transitions in Gears of War": drop the blend, treat a transition as a post-process. The new clip takes over at once, and the difference from the last pose out is an offset that decays on top of it. The talk itself is behind the vault; what was read at source is Daniel Holden's write-up and code.

- `theorangeduck.com/page/spring-roll-call`: `off_x = (src_x + off_x) - dst_x`, `off_v = (src_v + off_v) - dst_v`, decayed by an exact spring.
- `spring.h` and `controller.cpp`, github.com/orangeduck/Motion-Matching (MIT, Daniel Holden 2021): `decay_spring_damper_exact` for a quaternion in scaled angle-axis, `y = 2 ln2 / halflife`, `x = e(j0 + j1 dt)`, `v = e(v - j1 y dt)`. His default half-life is 0.1 s.
- `theorangeduck.com/page/dead-blending` was read as the alternative: it extrapolates the old pose and crossfades, needing no destination pose. It was not used: with a smoothstep alpha over 0.2 s a hit reaction starts late, and a hit has to read in the frame it lands.

## What's different here

- The destination's velocity isn't known on the frame of the change, so it's left out. A blow's reaction starts a little harder for it, which suits a blow.
- The half-life is 0.08 s for a move and 0.05 s for a hit reaction: an offset of 1.1 m then moves at under 10 m/s at its fastest.
- Each frame's bones are checked too: a joint that would turn faster than 40 rad/s is a jump, whatever caused it, and gets the same treatment.
- Nothing is allocated in a frame, and once the offsets are spent nothing runs but keeping the last two poses.
