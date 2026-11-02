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

## The fighting styles

The named series and shipped games behind this are in the session memory, outside the repo.

- **Fire** comes from Northern Shaolin: bow stance with the front knee at 90° and the rear leg straight, horse stance, drop stance. Long range, quick advance and retreat, full extension with a hard stop at the end of each blow, whirlwind kicks, low sweeps. Inhale, exhale, fire.
- **Water** comes from Yang tai chi: rear foot at 45°, weight 60/40, arms that move because the waist moves. Pull back, then push the palms out on the exhale. Slow even flow, then one whole-body burst.
- **Combat design:** frame data as a table (`web/data/combat.json`), a buffer, cancel windows after the hit, hitstop on both sides scaled by damage and lighter for projectiles, attack tokens so only a few foes commit at once.
- **Clean motion capture:** CMU (free for commercial use), ACCAD (CC BY 3.0), 100STYLE (CC BY 4.0), Quaternius UAL2 (CC0).
- **Not usable, non-commercial:** LaFAN1, Bandai Namco, SFU, UMONS-TAICHI, AIST++.
