# Fire flight and turbine jets: what they're built from

Randy, 2 Nov 2026: "Fire thursters look unnatural too. They must fire like an actual gas turbine on user. The movement for flight must be more graceful and fluid. This is not good still. Find best open examples to use. We also need hover too". And his meta rule, same day: "Never just make shit up from scratch. Always have the best examples and sources online before just starting because I have my AAA standards".

Nothing below is shipped as an image or copied as an asset. Photos were studied in a scratch folder only.

## The jet: real engines first

| Source | What it gave | Licence |
|---|---|---|
| [J58 on a test stand](https://commons.wikimedia.org/wiki/File:J58_AfterburnerT.jpeg), [SR-71 in afterburner](https://commons.wikimedia.org/wiki/File:SR-71_Blackbird_afterburn.jpg), [F-16 on takeoff](https://commons.wikimedia.org/wiki/File:South_Carolina_F-16_taking_off_in_Afghanistan.jpg) | The shape: a straight, thin, rigid cone from a hot nozzle, no wander. Translucent blue-violet body in the dark, a pale shaft in daylight. Bright orange-white diamonds evenly spaced on the axis, fading with distance | Study only |
| [Shock diamond, Wikipedia](https://en.wikipedia.org/wiki/Shock_diamond) | First Mach disk at x = 0.67 D0 √(P0/P1); turbulent shear dissipates the pattern with distance | CC BY-SA, a fact |
| [Afterburner flame colour, MigFlug](https://migflug.com/afterburner/?p=24902932) | Blue comes from excited CH and C2 in clean burning, orange from glowing soot; the blue washes out in daylight | Study only |
| [Engine flame, godotshaders.com](https://godotshaders.com/shader/engine-flame/) | The method: a mesh, noise scrolling along it, a colour gradient, alpha from a view-angle term so the edge fades | CC0 |
| [Sci-fi engine thrust, gameidea.org](https://gameidea.org/2024/08/22/sci-fi-engine-thrust-shader/) | A truncated cone rather than a pointed one keeps the UVs parallel; noise stretched along the jet | Method only; the full shader isn't published |

## The body and the turbines

| Source | What it gave | Licence |
|---|---|---|
| [Jet suit flyer, Commons](https://commons.wikimedia.org/wiki/File:Jet_suit_flyer.jpg) | The pose: torso about 45° forward, legs together and trailing, knees soft, arms low and near the line of the body. Not flat. Exhaust barely visible in daylight | CC BY-SA 4.0, study only |
| An engineering society's article on the suit | Thrust shared about a third each arm, a third the back, like a tripod; a trigger and throttle on each arm | Study only |
| A magazine piece on the same suit | Arm engines steer by vectoring; the pilot balances by hand | Study only |

## The flight

| Source | What it gave | Licence |
|---|---|---|
| A developer blog post on a VR flight game | Obey Newton: thrust, drag and gravity summed each frame. Keep forward momentum so turns carve at speed. Bumpers nudge away from geometry. Finer control in tight places | Study only |
| Two reviews of that game | Palms down hovers, palms back goes forward; the flight prototype began as physics thrusters on the palms | Study only |
| [Daniel Holden, Spring-It-On](https://theorangeduck.com/page/spring-roll-call) ([code](https://github.com/orangeduck/Spring-It-On)) | Input as a goal velocity, and the critically damped character spring: acceleration stays continuous, so there's never a snap. Halflife trades response for smoothness | See the licence line in the repo |

The named film, game and talk references are kept outside this repo.

**No open superhero flight controller exists that I could find.** Searched GitHub, the Godot asset library and three.js; the nearest are [Godot 3D Flight Control](https://godotengine.org/asset-library/asset/edit/9429) (MIT, a Star Fox plane) and [AMSG](https://godotengine.org/asset-library/asset/edit/7660) (MIT, ground movement). So the controller is written here from the sources above, and says so.
