# Handoff: the touch controls (2 Nov 2026)

His words, on Build 67 on his phone: "The flight and movement controls are terrible! On mobile I told you to find the correct flight controls and movements." Before that: "The flight controls need to match actual flight simulator games with the joystick being used to point in the direction the user wants with the same control types and the fly is just to move forward", and the takeoff: "Boost, hold it like the water, jump to do big fire jump and while in the air, the boost button becomes fly and we can press and hold that to fly or even hover."

## Sources

`Pipeline/research/CONTROL_SOURCES.md` has every source, its link and what it settled; the game titles behind its numbers (M1-M6 on phones, C1-C9 on consoles and PC) are in the owner's memory record `reference_control_sources_2026_11_02.md`. In short:

- Apple's HIG and WWDC 2026 "Make your game great with touch": the stick wherever the thumb lands, on the whole left half; a 1:1 look drag with no inertia; hold-and-drag on a button; 44 pt targets.
- The mobile-first flight game (M1): two air modes, a helicopter hover where the stick moves you and a lifted thumb stops you, and an airplane where the stick guides you and down dives; its makers dropped a full flight simulator for "a simple set of familiar controls". The arcade jet game (M5): PC flight controls can't be ported to phones.
- The point-where-you-go schemes (C5's STANDARD: turns toward the stick, wings level when it lets go; C1's flight, not inverted by default, takes off where you aim; C9's Simplified controls). Only 12 of 144 players always invert (Corbett and Munneke 2025).
- Numbers: nipplejs and the Godot joystick (MIT) for a floating stick that follows the thumb and a scaled radial dead zone (0.12, full at 0.93, from Unity's 0.125 and 0.925); Unreal's spring arm lag (about 0.1 s) and its third-person template's 500°/s turn; Cinemachine's recentring (1 s wait); Nesky's camera talk; Li et al. 2021 on thumb travel.

## The scheme

| | Left thumb | Right thumb |
|---|---|---|
| Everywhere | Floating stick on the left half, the drawn stick included; once down its base stays put for the touch (his word on Build 68); dead zone 0.12 | Drag looks 1:1; a thumb on Boost or Fly drags the view too |
| On foot (both) | Relative to the view; small push walks, big runs | Strike, Parry, Jump; Boost: the Warden rides water up the land, the man in red skims on his jets |
| Water, surf (Warden) | Relative to the view, 3D in the water; carves on the surf | Boost, Jump |
| Skim (man in red) | Relative to the view | Jump: the big fire jump; then Boost reads Fly |
| Flying, Fly held | X turns him at a rate (body banks by itself; let go: the turn stops, wings level); Y points the nose, up climbs, levels when let go; pull back is the "Climb in flight" setting (`pitchPull`) | Fly pushes along the nose; the view rides behind on a spring; a drag is a glance back after 1 s; Jump tap dodges, held descends |
| Hovering, Fly let go | Moves him where it points, relative to the view; he faces it; lifted thumb holds him | Free; Fly again takes off into the screen |

A pad (standard mapping) drives the same stick: left stick, right stick looks, A jump, X strike, B parry, Y stance, RB or RT Boost and Fly, Start pause.

## Done and measured

`web_check/feel.mjs` (real fingers through the devtools, phone turned, the game's own clock), before (b7b3ee9) then after: flight 90° 2.53 then 1.08 s, 180° 4.73 then 2.18 s, the turn showing after 0.40 then 0.10 s, 10.4 then 3.3° past the stick; the stick pushed up dived 17° and stayed, now climbs and levels when let go; on foot 90° 0.67 then 0.40 s; a resting thumb walked him 2.7 m and now doesn't; a thumb set down on the drawn stick read 22% and now reads nothing. The camera list from the smoothness survey (jump, under water, boost, Fly coming on, skim, 120 Hz) is in CONTROL_SOURCES.md's After section. A landing from flight flares (he comes in at about 1-4 m/s on his feet, not 18 m/s as an arrow), and a hover's velocity goes to its goal axis by axis, so Fly let go at speed with Jump held brakes and sinks at the descent's rate. The sea ride closes the gap to the wave on a spring at its start.

Walls changed for the scheme, each saying so in its file: E22 (it held the flight simulator's flight), input.mjs's finger lift (re-press where the fingers first landed), M10c (Boost's top read off breaking faces) and M10g (Boost held runs a sea ride on up the beach; let go puts him on his feet). Commits: 5d5ecec (sources, feel.mjs), 4742394 (the stick, settings, pad, menu wrap), 48cd180 (flight, hover, on foot, camera), and the last one on `fire` (landing flare, hover springs, sea ride start, this file).

## Left

- On-foot turning is still slower than Unreal's 500°/s (0.40 s for 90°): his walk, run and pivot captures and the move walls set the pace; a faster turn needs the body's work.
- A mid-turn let-go on foot runs on about 12° (Unreal and Unity stop at once).
- The skim (90° in 1.87 s at 21 m/s) and the surf (90° in 1.38 s) turn as they did; no source settled their numbers.
- The lens's cut through the water at a leap (8.5 rad/s) is by design and unchanged; the survey's landing case shows one camera cut near the ground at its own spot, not seen in a traced landing elsewhere: check it.
- No auto-follow of the view on foot (the third-person template and Cinemachine leave it off by default; Nesky's talk says follow the velocity). Try it gently if he asks for it.
- The before build used for comparison was served from a scratch checkout of b7b3ee9; it's removed.

Build 68 follow-ups (his words): the fire's aim is a soft lock inside a 40° cone round the view, never behind it, and he faces what he shoots at ("it looks in the wrong direction ... sometimes shoots behind me"); the stick's base no longer follows the thumb ("The joystick moves too with me too much").

Continue from `fire`, after the last commit named above.
