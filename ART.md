# The art brief

**The frame:** a hero alone in huge water. Abzû's clarity and colour, the scale of a cathedral, sun shafts through kelp, a marble city
going blue with distance. A few big shapes, lit well, beat many small ones: distance fog, silhouette and light do the work, and they are
also what a phone can afford. Never low-poly toy, never chibi, never grey.

**The target:** none frozen yet (the browser comes first tonight). The first frames he likes become it.

## The visual system (linear albedo in `Pipeline/palette.json`; these are the sRGB intents)

| Thing | Colour |
|---|---|
| Water, sunlit top 15 m | turquoise #5fe0e6 scatter |
| Water, 40 m | #0f7fa6 |
| Water, 100 m | #06304f |
| Trench | #030d24 |
| Sun through water | warm #ffe9b8, with a green-blue falloff |
| Warden's suit | deep teal #0c5c66 scales, pearl trim #e9efe6 |
| Warden's bronze | antique gold #c99a3f (crested half-helm, pauldrons, bracers, trident) |
| Warden's glow | cyan #4ff0ff lines along the arms, chest and trident tines |
| Warden's skin | warm brown #8a5a3c |
| Warden's cape | a torn fin-like mantle, indigo #1a2c6e to cyan at the hem |
| Reavers | barnacled black-green #1c2a26, rust #8a3b22, amber eyes #ffb238 |
| Reef | coral #ff7a6b, orange #ff9d4d, violet #9c6bff, yellow #ffd35a, sand #e8d9b0 |
| Kelp | olive-gold #8a8a2e, lit edge #c8c24a |
| Thalor | pale marble #d9d4c4, algae #3d6e5a, gold mosaic #c9a24a |
| Trench | rock #0b1320, glow cyan #38f0e0, magenta #ff3fb4 |

## Do

- Silhouette first: the Warden must read at 60 pixels tall.
- Every biome has one thing you can see from far away: the reef's sea arch, the kelp cathedral's light, the city's colossus, the trench's glow.
- Shape colours by depth, never by hand: the water absorbs red first, so a reef far away goes blue on its own.
- Motion everywhere: kelp sways, fish school, light moves on the sand, dust drifts.

## Don't

- No orange scale shirt, no green gloves, no blond beard (DC's). No store, Fab or scanned content. No textures from anywhere but our own code.
- No hard horizon, no empty blue, no flat lighting.
