# What fire, water and ice do to the world

Randy, 2 Nov: "be able to burn the environment and do some building damage" · "The water guys can extinguish and freeze, and even destroy some parts of their env (you can make a recommendation for that. BUILDINGS recover of course)" · "environment burns". Titles of games stay in the memory record.

## The rules of it

- Three laws, from a GDC 2017 talk on an open-world game's chemistry: elements change materials, elements change each other, materials never change materials.
- Every burnable thing carries health, flammability, flame and wetness, as a shipped voxel game's fire does (its dev blog 53).
- Fire must not spread for ever: a shooter's fire designer stopped it because "it's just not fun", and balancing it took longer than the mechanics.

## Fire on the ground: `web/js/scorch.js`

A cell model, Alexandridis et al. 2008 as given by Russo et al. 2014 (CET 36), calibrated on a real island fire:

`p = .58 (1 + veg)(1 + den) e^(.045 V) e^(.131 V (cos θ - 1)) e^(.078 slope°)`, per neighbour.

With 1.5 m cells at 5 Hz, a cell burning 0.8 s, wind 8 m/s and grass `veg` -0.3, the head runs 2.4 m/s and 35 cells burn at the peak, which is a line. At 1.6 s it's a carpet, which is the wrong look. A real cured-grass head runs about 20% of the wind speed.

What the footage says, and the map does: a thin bright line with black country behind it, a net of glowing red points that thins as it cools, smoke standing back from the line, trees burning on at the tips after the ground goes out, and green coming back as scattered shoots that join up. It never fades in evenly.

## The water side's way of breaking things

Pressure knocks things off. Wedge: freeze it, then a heavy blow breaks it, because ice expands 9%. Quench: water on stone that fire has heated cracks it, as miners broke rock for centuries. The fire side mirrors Wedge with heat. So each side can break a wall its own way, and each can use the other's work.

## Buildings

Frostbite 2's destruction masks (Kihl, SIGGRAPH 2010) are the idea: sharp edges from noise on a low-resolution field. Flattened here to one small texture layer per damaged building, with parts that fold their vertices to a point, no `discard`, as Arm's guide asks.
