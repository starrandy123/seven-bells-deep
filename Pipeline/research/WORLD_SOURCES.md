# Buildings, the volcano and bosses: what they're built from

Randy, 2 Nov 2026: "Combat, cities, buildings, boss fights, all must be built off adjacent frameworks that have been proven." Named games stay in the session memory, outside this repo.

## Sunken buildings

Real sites: Pavlopetri (roof tiles at 3-4 m), Baiae (mosaics under sand, gas bubbles), Heracleion (canals, basins, 5.4 m statues). What makes a sunken city read as rich rather than bland:

- Three scales at once: the 20 m mass, the 4 m colonnade (columns 8-10 diameters tall), sub-metre growth.
- One big statue per plaza. Break the silhouette of one building in three. Light one window in four, warm against the blue.
- Colour falls off per channel, red first: extinction about .25, .06, .03 per metre. Haze carries the mood.
- Growth follows exposure: tops and edges grow, silted flats and interiors stay poor.
- God rays as cone meshes (threex.volumetricspotlight, MIT).

## Procedural buildings

A shape grammar, our own code in the form CGA made standard: Lot, Mass, Facade, Floor, Bay; split and comp; a seed per lot; terminals are palette meshes. WFC (MIT) and hex-map-wfc (MIT) show adjacency and one-palette batching. Kenney and Quaternius kits are CC0, for reference.

## Lava

Temperature to colour, from USGS: red 873-1073 K, orange 1073-1273 K, yellow 1273-1473 K; fresh Hawaiian lava about 1443 K. A crust forms in seconds and thickens with the square root of time; it breaks into plates with hot seams. Basalt columns are jittered hexagons. Flow by two phases half a cycle apart (MIT-0, Catlike Coding; three.js Water2, MIT). Shadertoy's default licence is non-commercial: not used.

## Bosses

Build-up, reveal, teach, escalate, false death, the last push, kill, victory. The arena and the boss are designed together. Attacks that come from the body read better than detached red zones. Tells: quick .75 s, heavy 1-1.5 s, arena 2-3 s. Punish windows 2-4 s. Three phases, sound on every tell. No more than two aggressors.
