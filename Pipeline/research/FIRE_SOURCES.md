# Fire fighting: what it's built from

Randy, 2 Nov 2026: "The fire fighting looks like water recorded too and doesn't look like actual fire being emitted and blasted and comboed at users."

The named shows and games he pointed to, and the frames studied, are kept outside this repo.

## The look, read off frames

- Three flat tones with hard lines between them: a near-white yellow core, an orange-yellow body, a red-orange rim.
- A blast is a comet: a round bright head and a long tapered tail.
- A kick or sweep throws a crescent, thin at both ends, gone in a third of a second.
- Fire breaks into tongues as it goes. It's never a smooth ribbon, which is what made the old kit read as water.
- A hit gives a spiked burst and round cell-shaded smoke.

## The method

| Source | What it gave | Licence |
|---|---|---|
| [Stylized Fire 3D, godotshaders.com](https://godotshaders.com/shader/stylized-fire-3d/), after Minions Art | `alpha = noise * mask - erosion`, then a smoothstep edge; lifetime drives erosion | MIT |
| [Alpha erosion, VFX docs](https://vfxdoc.readthedocs.io/en/latest/shaders/alpha-erosion/) | Threshold mechanics, a linear erosion map | Study only |
| [Overwatch FX study, realtimevfx.com](https://realtimevfx.com/t/overwatch-fx-pharah-rocket-study/758) | A greyscale shape coloured by a gradient map, plus erosion | Study only |
| [fire-simulation](https://github.com/neungkl/fire-simulation) | Pooled flame balls and sparks in three.js | MIT, method only |
