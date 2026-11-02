# Lava with a body

Randy, 2 Nov: "the lava is just going in the water without turning into steam or solid rock at the bottom?" · "The lava coming down the mountain also looks like a sheet of paper and not actually done right". Titles of games stay in the memory record.

## Read at source

- Lipman and Banks 1987, the measured channels of a 1984 eruption: 12-16 m wide, 6.5-7.7 m deep, "approximately rectangular", walls near vertical, the lava 0.5-1 m below the levee crest, speeds mostly 1-5 m/s.
- Hon et al. 1993: surface temperature of a fresh sheet flow, 700 C at a minute down to 251 C at 109 minutes. Fit used: T = 700 (t / 60 s)^-0.22.
- Griffiths 2001, Mattox and Mangan 1997, USGS Volcano Watch and HVO pages.
- Jeffreys' equation for a laminar channel, the base of the FLOWGO models: h = (3 eta q / (rho g sin theta))^(1/3), v = q / h.
- Planck radiance in linear sRGB through the CIE 1931 fit (Wyman), then a per-channel camera exposure: yellow in footage is exposure, not hue, and 1150 C lava is about as bright as sunlit dark rock.

## What's built

- `web/js/lava.js`: the surface is the age of each bit of skin. A rigid raft down the middle, two shear belts, lanes that each slide at their own speed, chevrons bowed downstream, cracks that open under strain and shut under compression. One read of a ramp texture turns age into light, with a night row and a day row.
- The crust is lit: dark rock by day, its folds carrying the light.
- Thickness and speed from Jeffreys' law, the surface flat across and below its walls, and a levee mesh each side: a near-vertical inside face red with heat, a crest, a rubble shoulder. One draw.

## Still to do from the study

Rerouting the steepest rivers so falls are events, falls through `fallStrips`, the black bench and steam mountain where it meets the sea, rafts and lobes.
