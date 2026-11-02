# The touch controls: what they're built from (2 Nov 2026)

His words, oldest first: "Plus I pressed the boost and it only dashed and didn't stay with the thrusters on ground. I told you how I wanted the takeoff sequence to be. Boost, hold it like the water, jump to do big fire jump and while in the air, the boost button becomes fly and we can press and hold that to fly or even hover." · "The movement for flight must be more graceful and fluid. This is not good still. Find best open examples to use. We also need hover too." · "The flight controls need to match actual flight simulator games with the joystick being used to point in the direction the user wants with the same control types and the fly is just to move forward." · "THE CHARACTER STARTS OFF WITH THE WORLD SPINNING TOO MUCH IN THE WORLD!" · and on Build 67, on his phone: "The flight and movement controls are terrible! On mobile I told you to find the correct flight controls and movements."

Read 2 Nov by four research passes (the platforms, phone games with flight, console and PC flight, the numbers behind sticks and chase cameras) and checked at source where it mattered. Games are numbered (M1-M6 on phones, C1-C9 on consoles and PC); their titles and links are in the owner's memory record `reference_control_sources_2026_11_02.md`, as his rule keeps titles out of repo files. The first flight model's sources (the jets, the body, Newton, Spring-It-On) stay in `FLIGHT_SOURCES.md`.

## What was wrong, measured

`web_check/feel.mjs`: a phone turned (844 x 390, as he plays), real fingers through the devtools on the page's own stick and buttons, the game stepped at 60 Hz so the clock is the game's. Build 67:

| | Build 67 |
|---|---|
| Flight, Fly held, full stick: 90° / 180° | 2.67 s / 4.9 s; 0.48 s before the first 5°; 23° in the first second |
| Flight, let go of the stick at 90° | 14.4° more, still turning 0.88 s later |
| Flight, stick pushed up for 1 s | the nose went DOWN 17° (pull back to climb was the default); held there after letting go (-20.6° 2.5 s later) |
| Hover, full stick: 90° / 180° | 0.95 s / 1.57 s, turning on the spot |
| On foot: 90° / 180° from a run | 0.67 s / 1.23 s |
| On foot: a thumb resting 4 px off the stick's middle for 3 s | walked 1.65 m and turned 135°: no dead zone on the ground |
| A thumb set down on the drawn stick 12 px off its centre | read as 22% of a push: he walked off 0.85 m in 1 s with the thumb still |
| Surf: 90° / 180°, full carve | 1.38 s / 2.58 s |
| Skim on the jets: 90° | 1.87 s |

The flight was a flight simulator's (bank to turn, pull back to climb, the nose stays where it was left). Every phone-first source below dropped that model: M1's developers built "a fully-functional flight simulator" and threw it away for "a simple set of familiar controls"; M5's say "It is impossible to completely port the aircraft control interface from PC to the smartphones".

## The scheme

| | Left thumb | Right thumb |
|---|---|---|
| Both heroes, everywhere | A stick that appears wherever the thumb lands on the left half, the drawn stick included; it follows a thumb that slides past its rim; a radial dead zone of 0.12, scaled, full at 0.93 | A drag on the right turns the view 1:1 and stops when the thumb lifts; a thumb held on Boost or Fly drags the view as well |
| On foot (both) | Goes where the stick points, relative to the view; a small push walks, a big one runs | Strike, Parry, Jump, Boost (the Warden rides the water up onto the land; the man in red runs on his jets, the skim) |
| In the water (the Warden) | Swims where the stick points, relative to the view, up and down with it | Boost speeds, a press in time with his kick steps it up; Jump drives up and out |
| Surfing (the Warden) | Carves toward where the stick points | Boost: faster; Jump: leaps off |
| Skim (the man in red, Boost held on his feet) | Runs on the jets where the stick points | Jump: the big fire jump. Then Boost is Fly |
| Flying (Fly held): M1's airplane | X turns him, at a rate, and his body banks into it by itself; let go and the turn stops and the wings level (C5). Y points his nose: up climbs, down dives, and the nose levels out when the thumb lets go. Pull back to climb is a setting, off | Fly pushes him along his nose, faster the longer it's held; the view rides behind him by itself; a drag is a glance that comes back after 1 s; Jump tapped dodges, held takes him down |
| Hovering (Fly let go): M1's helicopter | Moves him where the stick points, relative to the view, and he turns to face it; a lifted thumb holds him still in the air | Free for the view and the fight; Fly again takes off where the view is aimed (C1) |

His words fix the stick pointing him and Fly only moving him forward. Where they and the research part: he asked for "actual flight simulator games ... with the same control types". The phone flight simulators (M6) and the pad flight simulators (C7, C8) bank to turn and pull back to climb, which is what Build 67 shipped and what he called terrible. The schemes that do what he described, where the stick points the craft where the player wants to go, are C5's STANDARD, C1's flight and C9's Simplified controls. C1 doesn't invert by default, C9 has no pitch stick at all (it flies where the player looks), and C5's own advice to beginners is to set pitch so the plane goes straight where the stick points (its default wasn't found). In a general sample only 12 of 144 players always invert. So the scheme follows his "point in the direction", and the flight simulators' pull back to climb is a setting.

## The platforms (read at source)

| Source | What it says (their words) | What we took |
|---|---|---|
| [Apple HIG, Game controls](https://developer.apple.com/design/human-interface-guidelines/game-controls) (touch guidance updated 9 Jun 2025; read from its DocC JSON) | "For movement control, opt to show a virtual thumbstick wherever the player lands their thumb instead of a static thumbstick position. For camera control, opt to use direct touch to pan the camera instead of a virtual thumbstick." "using as large of an input area as possible." "frequently used controls are a minimum size of 44x44 pt." "For multiple actions, such as walking or sprinting, consider combining the actions into a single control." | The stick floats wherever the left thumb lands, the drawn stick included. Look stays a direct drag. Boost and Fly stay one button that changes with the state |
| [WWDC 2026, Make your game great with touch](https://developer.apple.com/videos/play/wwdc2026/358/) (transcript on the page) | "I'll set the colliderShape to either leftSide or rightSide, which gives the thumbstick access to the entire half of the screen". "A small tilt means the character moves at a normal pace. If it's a big tilt, the character will sprint". The camera touchpad "moves exactly as far as their finger moves, with no latency or drift". "they hold button B and drag to aim, while still moving with the left thumbstick" | The stick's zone is the left half. The look is a 1:1 drag. A thumb held on Fly still drags the view |
| [WWDC 2024, Design advanced games for Apple platforms](https://developer.apple.com/videos/play/wwdc2024/10085/); [Meet with Apple, Design great interfaces for handheld games](https://developer.apple.com/videos/play/meet-with-apple/243/) (15 Dec 2025) | "build the sprint function directly into the virtual thumbstick". Direct touch to pan the camera, "way faster and more precise than any thumbstick"; inertia only for overhead cameras. "players will likely be playing your game with only their two thumbs" | No inertia on the look. Two thumbs: in flight the right one holds Fly, so the stick alone steers and the view comes round by itself |
| [Apple Touch Controller framework](https://developer.apple.com/documentation/touchcontroller) (iOS 26) | TCThumbstick `hidesWhenNotPressed`, `stickSize`, `colliderShape`; TCTouchpad `reportsRelativeValues`. No sizes or dead zones documented | The shapes above |
| [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps); [Google, Touch target size](https://support.google.com/accessibility/android/answer/7101858); [Android natural input](https://developer.android.com/games/develop/multiplatform/enable-natural-input-on-all-form-factors); [Google Play Games guidelines](https://developer.android.com/games/guidelines) | "at least 48x48dp, separated by 8dp of space or more ... about 9mm". Show touch controls on launch; use the insets. Nothing on a stick's size, dead zone or fixed versus floating | The buttons already pass (44 pt and up) |



| Source | Numbers | What we took |
|---|---|---|
| [Li, Zeng, Peng and Ma, Chinese CHI 2021, arXiv 2110.08753](https://arxiv.org/abs/2110.08753) (18 players, landscape, two thumbs, an action RPG with a fixed stick) | Thumbs landed in a 15.6 mm (95%) circle centred 15.9 mm from the left edge and 13.9 mm from the bottom; while steering they covered a 30 mm circle (95%), about 15 mm of travel each way. Stick centres in shipped games 9.8-19.4 mm from the edges. Attack button over 9 mm for 90% accuracy | A thumb steers through about 15 mm each way; our nub travelled 9 mm (54 px at about 6 pt/mm on an iPhone), so a full push came well inside a thumb's natural sweep |
| [Hoober, How Do Users Really Hold Mobile Devices? (UXmatters 2013)](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php); [Design for Fingers, Touch, and People (2017)](https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php) | 1,333 observations; "touchscreens sense only the geometric center of a user's contact patch"; accuracy 7 mm at the centre of the screen to 12 mm at the corners | Hit areas bigger than the art; the touch point is a centroid, so a thumb set down "on" the stick is never on its centre |
| [Dandekar, Raju and Srinivasan 2003, MIT Touch Lab](http://touchlab.mit.edu/publications/2003_009.pdf) | "the human fingertips are typically 16-20 mm in diameter" (index fingers; the paper has no thumb figure) | A thumb covers the whole nub and button: press states have to show round it |

## The stick and the camera: proven implementations, read at source

| Source (licence) | Numbers | What we took |
|---|---|---|
| [nipplejs](https://github.com/yoannmoinet/nipplejs) 1.0.4 (MIT), `Collection.ts` L80-98, `Joystick.ts` | mode `dynamic` ("a new joystick is created at each new touch"), size 100 px (radius 50), threshold 0.1, `follow` moves the base by the overshoot past the rim | Our stick is nipplejs's dynamic mode with follow, at its size (54 px of travel). Follow now on the ground too, not only in flight |
| [Godot Virtual-Joystick](https://github.com/MarcoFazioRandom/Virtual-Joystick-Godot) (MIT), `virtual_joystick.gd` L14-17, L138-140 | deadzone 10 of a 75 clamp (0.133), scaled radial: `(v - v̂·10)/(75 - 10)`; modes FIXED, DYNAMIC, FOLLOWING ("the joystick will follow it") | The scaled radial dead zone, ported |
| Unity Input System `OnScreenStick.cs` and `StickDeadzone` (Unity Companion License: numbers only) | movementRange 50; ExactPositionWithDynamicOrigin ("center of origin is determined by the initial press position"); dead zone min 0.125, max 0.925 | Inner 0.12, full output at 0.93 |
| Unreal Engine 5.3 `SVirtualJoystick.cpp` and its default joystick asset (EULA: numbers only) | A touch inside the zone re-centres the stick under the finger; travel radius 9.4% of the long edge; no dead zone in the widget; Enhanced Input's dead zone 0.2 radial | A thumb that lands on the drawn stick re-centres it |
| [Josh Sutphin, Doing Thumbstick Dead Zones Right (2013)](https://joshsutphin.com/blog/doing-thumbstick-dead-zones-right.html) | Axial snaps to the axes, radial "kicks" at the edge; scaled radial: `normalized * ((mag - dz)/(1 - dz))`; dead zones "often somewhere between 0.1 to 0.2" | The formula |
| [Microsoft, Getting started with XInput](https://learn.microsoft.com/en-us/windows/win32/xinput/getting-started-with-xinput) | Left stick dead zone 7849 of 32767 (0.24) for a worn physical stick; for driving, "cube the result ... more precision in the lower ranges" | A touch stick has no worn spring, so the lower end of the range (0.12); the cubic blend stays on flight pitch only |
| [Baldauf et al., ACM TOMM 2015](https://www.matthiasbaldauf.com/publications/Baldauf15a.pdf) (n = 30) | A floating stick under the touch needed significantly fewer glances than direction buttons; d-pad users "slowly drifted beyond the sensitive area" | Floating, with follow, so a drifting thumb never falls off the stick |
| Unreal Engine 5.3 third-person template, `TP_ThirdPersonCharacter.cpp` (EULA: numbers only) | Orient to movement at 500°/s; no camera lag, no auto-recentre. `USpringArmComponent`: when lag is on, 10/s for place and turn (about 0.1 s) | On foot he turns at up to 500°/s at a walk, eased so the M4 wall's rate rule holds |
| Cinemachine 3.1 `InputAxis.cs` L129, `OrbitalFollow` (Unity Companion License: numbers only) | Recentering waits 1 s with no input, then eases over 2 s (SmoothDamp 1 s) to "behind the Tracking Target's forward"; any input cancels it and restarts the clock | The flight view's drag-look comes back after 1 s idle; the follow behind him waits for the thumb to leave the view |
| [John Nesky, 50 Camera Mistakes, GDC 2014](https://www.gdcvault.com/play/1020460/50-Camera) (read through a transcript translation, not the video) | #23 swing the camera's yaw toward the running direction, taken from the velocity, not the stick; #35 wait after the player turns the camera; #28 separate logic in the air; #45 don't follow jumps rigidly | The view follows his path (velocity), never the stick; it never fights a thumb on the view |
| [three.js](https://github.com/mrdoob/three.js) r187 (MIT) OrbitControls, PointerLockControls | Touch rotate 2π per view height (about 0.016 rad/px on a phone); mouse look 0.002 rad/px | Our look drag (0.0052 rad/px) sits between them: kept |

## Phone games with flight or gliding (M1-M6; titles and links in the owner's memory record)

Read from their official help pages, manuals, changelogs and developer news, with wikis only where they quote the game; footage measured off YouTube storyboard frames (1-5 s apart), so no turn times could be read from it.

| Source | What it does | What we took |
|---|---|---|
| M1, a mobile-first flight game (official help centre; the platform's own "Behind the Design" article on it) | Two air modes. Closed wing: "Slide your finger on the d-pad area to navigate ... like a 'hover' or 'helicopter' mode", and a lifted thumb stops him. Open wing: "the ability to dive and climb ... like a 'glider' or 'airplane' mode", the stick "will simply guide the direction", "quickly dive by pushing the d-pad DOWN. You can push up to get out of the dive". Flight goes on with no thumb (10 s hands-off in the footage, the view straight behind). Tap jump to flap, hold to boost. "Invert Flight" is a setting. The team built "a fully-functional flight simulator" and dropped it for "a simple set of familiar controls". Its stick floats: a ring where the thumb lands, 0.28-0.36 of the screen height across | The whole scheme. Fly held is the airplane: the stick turns him and climbs or dives him, down dives, and the view rides behind on its own. Fly let go is the helicopter: the stick moves him where it points, as on foot, and a lifted thumb holds him still. Pitch inversion stays a setting, off |
| M2, an open-world action RPG's glider on phones (official settings on its wiki; footage) | The glider steers relative to the view (footage: stick back-left, he flies toward the lens); no climb; walk or run from how far the thumb is from the stick's centre; camera axes invert on a controller only | On foot and in hover, the stick stays relative to the view |
| M3, a battle royale's skydive and glide, and a second one's official tutorial | Skydiving holds the stick forward; the dive is set by looking down ("angle your character straight down"); a HUD layout tool; sticks at 0.19-0.21 of the height | Nothing new: confirms look-relative steering |
| M4, a block game's wing flight (its wiki; Bedrock 1.19.50 changelog) | "the player controls movement direction by turning (moving the aim point) ... To adjust pitch, the player moves the aim point upward and downward"; touch modes "Joystick & tap to interact", "D-Pad & tap to interact"; "Lock Joystick" (fixed or floating) | The flight goes where he points: the nose is the aim |
| M5, an arcade jet game on phones (developer news) | Cursor and Stick modes, with gyro; testers complained of "sudden turning and loss of control"; the developer: "It is impossible to completely port the aircraft control interface from PC to the smartphones" | The phone gets its own flight controls, not a desktop flight model's |
| M6, flight simulators on phones (official guides and manuals) | Tilt or two on-screen sticks (roll and pitch on one, rudder and throttle on the other); tilt forward to pitch down; the floating stick "can be activated in any free part of the screen"; "INVERT VERTICAL AXIS: Switch to normal or inverted" | The flight-sim pull-back-to-climb is what sims do; it stays a setting |

## Console and PC flight (C1-C9; titles and links in the owner's memory record)

| Source | What it does | What we took |
|---|---|---|
| C1, a powered-armour flight game (2019; the publisher's own control and accessibility pages) | "Right Stick: Rotate Camera/Steer While Flying"; by default the flyer goes where the stick is tilted, up climbs; "Invert Flight Look" exists and is Off by default; "Flight Take Off in Aim Direction" is On by default ("take off in the direction you are aiming, even if your character is facing away from it"); hover on its own button; hold or toggle for flight. On PC the flight cursor "will automatically return to center" after the mouse stops | Not inverted by default; Fly takes off where the view is aimed; letting go of the stick ends the turn and the climb |
| C2, a superhero team game's armoured flyer (its in-game skill text) | Right stick steers, hold the stick forward to speed up, held buttons go up and down, a hold of jump hovers | Hover is a state of its own, the buttons stay few |
| C3, C4, gliders (a web-slinger's wings, a caped detective's glide, a wingsuit, others) | Aircraft-style by default: pull back to climb, trading speed for height; invert settings everywhere | Pull back to climb is a real convention for gliders and jets: it stays a setting |
| C5, an arcade jet series (a games magazine's guide; a wiki on its 2026 entry) | STANDARD: "the plane turns toward where you push the stick", for beginners, low altitude and bad weather; EXPERT: bank and pitch like a real plane. The guide's tip for beginners: STANDARD with pitch set so the plane goes straight where the stick points. The 2026 entry's STANDARD: it turns toward the stick, "and when you let go the wings level themselves" | Stick X turns him at a rate, and his wings level when the thumb lets go; the bank is drawn, never asked of the thumb |
| C6, a combat flight game's Mouse Aim (the developer's news; its wiki) | An instructor flies the plane toward where you point and holds its path when you let go; stick curves "decreasing the sensitivity near the center", 1 to 2.5 | A soft curve near the middle of the stick for pitch |
| C7, C8, a space dogfighter and a civil flight simulator on a pad | Roll and pitch sticks; "Push forward to lower the nose; pull back to raise it" | The flight-sim convention, kept as the setting |
| C9, a 2026 military shooter's Simplified Jet Controls (the publisher's guide) | "you only need to look in the direction you wish to fly", "designed to reduce jet crashes" | Pointing, not piloting |
| [Corbett and Munneke, Cognitive Research: Principles and Implications, 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12185817/) | In a general sample "only 12 of 144 participants 'Always' inverted and 16 'Sometimes'"; one desktop flight simulator was "the only commercially popular platform that employed an inverted y-axis scheme (by default)" | Most players don't invert: push up to climb is the default |

## Open code used

The stick's dead zone is the scaled radial one of the Godot add-on (MIT) and Sutphin's article; the floating stick with its base following the thumb is nipplejs's dynamic mode with `follow` (MIT), written again in `web/js/ui.js` (no code copied: the idea and its numbers). The springs are Daniel Holden's (Spring-It-On, see `FLIGHT_SOURCES.md`). Unity's and Unreal's are read for their numbers only.

## After, measured

`web_check/feel.mjs` on both builds with the same fingers: before is the tree as it stood (b7b3ee9: Build 67 and the body's smoothness commits), after is this rebuild.

| | Before | After | What the sources give |
|---|---|---|---|
| Flight, Fly held, full stick: 90° / 180° | 2.53 s / 4.73 s | 1.08 s / 2.18 s | C5's STANDARD turns toward the stick at once |
| Flight: until the turn shows (5°) | 0.40 s | 0.10 s | |
| Flight: turned in the first second | 28° | 83° | |
| Flight: let go at 90°, the nose goes on | 10.4°, still turning 0.75 s later | 3.3°, stopped 0.13 s later | C5: the wings level when the stick lets go |
| Flight: the view behind him again after the turn | | 0.12 s | Unreal's spring arm lag: about 0.1 s |
| Flight: stick pushed up for 1 s | nose 17° DOWN | nose 68° up (22° by 0.25 s) | M1: down dives, up climbs; C1 not inverted by default |
| Flight: 1 s after letting go of it | held at -20.6° | 0.2° | |
| Hover, stick right | turned on the spot, 90° in 0.95 s, the view swung 120° | faces right in 0.38 s and moves right at 8 m/s, the view still; a lifted thumb stops him in 0.65 s | M1's helicopter |
| On foot, from a run: 90° / 180° | 0.67 s / 1.27 s | 0.40 s / 1.10 s | Unreal's template 500°/s (90° in 0.18 s); his walk and pivot captures cap it (the move walls) |
| On foot: let go mid-turn | 13.2° on | 12.1° on | Unreal and Unity stop at once |
| A thumb resting 4 px off the middle for 3 s | walked 2.67 m, turned 135° | still | a dead zone of 0.10-0.125 |
| A thumb set down 12 px off the drawn stick's centre | read 22% of a push, walked 0.85 m | reads nothing | the stick wherever the thumb lands |
| Swim, 90° / surf, 90° / skim, 90° | 1.0 s / 1.38 s / 1.85 s | the same | |

The view, read by the smoothness survey on both builds (the lens's turn rate and its place's acceleration, 60 Hz; 120 Hz where it says): the lens at a jump on land 5.8 rad/s and 2,030 m/s² before, 0.2 and 309 after; floating at depth, where every wave put the lens through the surface, 5.9 rad/s and 2,160 m/s², now 0.1 and 2; a hit or a throw in the water 4.0-5.4 rad/s, now 0.2; the swim boost's first frame 7.2 rad/s, now 0.6; Fly coming on after a takeoff 8.8 rad/s and 3,754 m/s², now 0.6 and 254; the skim's start 9.9 rad/s, now 1.3; his body turning as he takes off from a skim 55 rad/s, now 11; and at 120 Hz the lens's rate jumping from frame to frame in flight 185 rad/s², now 48, an air dodge 401 now 27, a landing 400 now 26, a fire combo 849 now 75, a swim turn 219 now 1.3. Unchanged: the lens's cut through the surface at a leap (by design, 8.5 rad/s) and the body's height snapping as a land ride starts (body.js).

Walls: E22 now holds this flight (it held the flight simulator's); E17, E32, S9, S10 pass; input 37 of 37 in Chromium and WebKit; lag passes; move_walls 57 of 66 in both engines, and every failure is the body's or was there before; M8b, M10c and M10g pass.
