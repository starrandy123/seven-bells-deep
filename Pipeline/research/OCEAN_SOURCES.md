# The open sea: sources

Randy, 2 Nov: "We need dynamic waves too and actual cool water movement in the ocean! All must be done well". Built in `web/js/sky.js` (the wave block, `seaWaves`, `setWind`, `capAt`), held by wall E30.

Each number below was read at its source on 2 Nov. Nothing was copied as code or asset: these are methods and measured relations.

## What the sea does now

- Six trochoids (Gerstner waves) in place of four sine swells: each point of the surface turns in a circle, so crests come sharp and troughs broad.
- Their lengths and directions are fixed about the peak of a 7 m/s wind, spread the way a wind sea spreads. Fixed frequencies mean no wave's phase ever jumps while the wind changes.
- The wind of the hour freshens and eases over minutes, Beaufort 3 to 5, and a storm drives it on. It sets how much of each wave there is, by a real spectrum.
- Whitecaps show where the surface folds as a crest squeezes it, and the share of the sea that is white follows the measured relation for that wind.
- A height asked at any world point undoes the waves' sideways pull in two steps, so what swims and floats rides the surface that is drawn.

## Sources

| Source | What it gave | Where it is used |
|---|---|---|
| Finch, "Effective Water Simulation from Physical Models", GPU Gems ch. 1 (NVIDIA, 2004), [read at source](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models) | The Gerstner wave as games draw it; steepness shared out as Qᵢ = Q/(wᵢAᵢ·numWaves): "As long as we select our Qi such that this sum is always less than or equal to 1, we will form sharp peaks but never loops"; the trochoid's normal | `WAVE_GLSL`, `setWind` |
| Tessendorf, "Simulating Ocean Water", SIGGRAPH course notes (2001), as cited by Finch for the dispersion relation | Deep-water dispersion ω² = gk; choppy waves; the Jacobian of the horizontal displacement as the test for where the surface folds | wave speeds; whitecaps (`vCap`) |
| Pierson and Moskowitz (1964), via [wikiwaves](https://www.wikiwaves.org/index.php/Ocean-Wave_Spectra) and [STAB 2009](https://mail.shipstab.org/files/Proceedings/STAB/STAB2009/STAB_2009_s09-p2.pdf) | Spectral peak ω_p = 0.877 g/U₁₉.₅, which is 0.855 g/U at 10 m | `setWind` |
| Hasselmann et al., JONSWAP (1973), via the same and [arXiv 2606.28165](https://arxiv.org/pdf/2606.28165) | Peak enhancement γ = 3.3 (a fitted North Sea average), width σ = 0.07 below the peak and 0.09 above; γ = 1 recovers Pierson-Moskowitz | `setWind` |
| Monahan and O'Muircheartaigh, J. Phys. Oceanogr. (1980), via [PMC6209970](https://pmc.ncbi.nlm.nih.gov/articles/PMC6209970) | Whitecap cover, robust fit: W = 3.84×10⁻⁶ U^3.41, about 1% at 10 m/s | `capAt`: the fold threshold is set so that share of the sea folds that far |
| Beaufort scale probable wave heights, via [NOAA WPC](https://www.wpc.ncep.noaa.gov/html/beaufortbody.html) and a [copy of the Met Office table](https://officerofthewatch.co.uk/2016/06/beaufort-wind-force-scale/) | Force 3: 0.6 m (1.0); force 4: 1.0 m (1.5); force 5: 2.0 m (2.5). The WMO's own table wasn't reached | the check on the result |

## Measured on our sea (2 Nov, 40,000 random points each)

| Wind | Significant height | Beaufort's probable height | Whitecap cover asked |
|---|---|---|---|
| 4.6 m/s | 0.63 m | force 3: 0.6 m | 0.07% |
| 7 m/s | 1.45 m | force 4: 1.0 m (max 1.5) | 0.29% |
| 9 m/s | 2.32 m | force 5: 2.0 m (max 2.5) | 0.69% |
| 11 m/s | 2.08 m | force 6: 3 m | 1.37% |

Past 9 m/s the spectrum's peak moves below the longest wave we carry, so the sea stops growing: a ceiling we keep on purpose, so a swimmer can still play in it.

## Open work studied, nothing copied

The FFT ocean (Tessendorf's method) is the best there is, and too heavy for a phone as it stands: several float textures and a transform every frame. Following his rule that too heavy for the phone isn't a no, this is its optimized form: a handful of trochoids drawn from the same spectrum, no textures, the cost all in arithmetic. Open implementations of the same idea exist: the trochoid cascades of the Crest ocean system (MIT) and the WebGL FFT oceans among the three.js examples (MIT). They are named here as the nearest open work. Their code was not read for this build: the method comes from the papers above.
