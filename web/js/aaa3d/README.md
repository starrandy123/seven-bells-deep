# js/aaa3d — carried from the owner's AAA3d engine

Copied on 2 Nov 2026 from `orgo_u/aaa3d` at commit `fe8f7c1` (Randy's own engine), on his word: "We have AAA3d city here in the orgo_u repo. Use that and make it work with our memory budget and art style".

| File | From | Licence |
|---|---|---|
| `cityGen.js` | `src/world/cityGen.js`: three.js r185's CityGenerator, SkyscraperGenerator and SidewalkGenerator, ported to WebGL by AAA3d | MIT, the three.js authors (notice in the file) |
| `cityFacade.js` | `src/world/cityFacade.js`: the generator's facade and interior math in GLSL; ours added at the end: `createBuildingMaterial`, the whole building in one draw | MIT, the three.js authors (notice in the file); AAA3d's port is the owner's |
| `kitVeg.js` | `src/geo/kitVeg.js`: AAA3d's vegetation kit | the owner's |
| `mathx.js`, `constants.js` | `src/core/` | the owner's |

Only the import paths were changed in the copies (`../core/x.js` to `./x.js`). How Saltlight uses them: `js/saltlight_build.js` and `js/saltlight_trees.js`.
