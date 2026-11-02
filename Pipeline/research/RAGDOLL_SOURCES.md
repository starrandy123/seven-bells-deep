# How bodies are thrown

Randy, 2 Nov: "We need rag doll physics and characters getting pushed back with these attacks and also losing their air thrusters when hit" · "Make sure the ragdoll works for water too in the water fights and feel natural". Titles of games and films stay in the memory record.

## The method

Thomas Jakobsen, "Advanced Character Physics", GDC 2001, the paper behind the corpses in a well-known stealth game: a stick figure of particles, Verlet integration (`x += x-oldx+a*dt*dt`), sticks kept by relaxation with the correction shared between the two ends, collisions by projecting the point out, limits as inequality constraints on a distance, 1 to 10 relaxation iterations, orientation for rendering derived from the particles. Read at gamedeveloper.com/programming/advanced-character-physics.

Written new in `web/js/ragdoll.js`: 15 points, 24 sticks, 4 iterations at 60 Hz. No library and no wasm. The heavier option was Rapier, which Crumple Lab uses; it stays an option if this ever needs real contact between bodies, cut down as his rule says.

## What was added to it

- A knee and an elbow bend one way: a hinge correction after relaxation.
- It writes over the clips by a weight, so it blends in over 50 ms and back out over 300 to 800 ms.
- Under water the figure is nearly weightless, with heavy drag: it drifts and turns instead of falling.
- Hips and chest carry the blow, the limbs and head trail it.
- Getting up comes from real capture, CMU subject 140: face down and on the back, hips included, played at 1.5 times.

## Numbers

From a hard third-person action series' measured reactions: light flinch 0.33 to 0.37 s, medium 0.83 to 0.97 s, heavy 1.02 to 1.25 s, knockdown 3.1 to 3.7 s to stand, with a roll out allowed from about 1.7 s. Published pushback distances don't exist; a knockdown here lands about 3 m off and a finisher about 8, to tune by eye.

## What real footage changed

Read frame by frame from a superhero film series and its published making-of pieces (VFX supervisors, editors, stunt coordinators; titles in the memory record):

- Thrust is gone at once and completely when a flyer is hit. There's no flicker. So no sputter, and the flame blows off the nozzle in 0.2 s.
- A relight is a burst, longer and brighter than cruise, leaving a white cloud. Not a fade-in.
- A thrown body has one line of force. The trunk leads at the point the blow struck, head and limbs trail loose and unequal, and it turns less than half a turn in the air. So spin came down from 5 to 1.8 rad/s.
- The path rises first. A flat launch from chest height lands in 0.5 s and reads as a shove: 7 m/s of lift gives about 1.4 s in the air.
- It lands on the back or hip, never the feet, with dust at contact, and slides on friction of about 0.7: 2.6 m from 6 m/s, 7.3 m from 10 m/s. Stunt rigs throw about 3 body heights; a super-strong punch 3 to 6.
- It stays down, then rises hand, push-up, knee, up. That's what the CMU get-up capture does.
