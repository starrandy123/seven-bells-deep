
# Combat's clips (owner: combat, 31 Oct)

Timings are counted from `reference/fluidity_ref_action_rpg.mp4` (DESIGN.md §Combat): wind-up 0.17-0.23 s, a blow's fastest moment right at contact, the next action starting 0.13-0.33 s after contact. A clip's contact time matters more than its length, because `combat.json` maps move frames to clip times and speeds a clip through its recovery. Every clip is one shot, in place, upright. Until a clip lands I use the stand-in named.

| Name | Purpose | Timing | Stand-in now |
|---|---|---|---|
| `dodge_water` | barrel roll sideways in water, body streamlined | 0.42 s, the roll complete by 0.3 s | `leap` + `h.roll` |
| `dodge_land` | a low slip or roll, weight carried forward, ends ready to strike | 0.42 s, feet set by 0.3 s | `jump` |
| `launcher` | rising upward sweep, whole body lifts, the trident ends high | 0.55 s, contact 0.12 s | `atk_dash` |
| `air1`, `air2` | two cuts in the air, no ground under him, legs trail | 0.42 s each, contact 0.12 s | `atk1`, `atk2` |
| `plunge` | hangs a beat, then drives down, trident first | 0.30 s then a loopable last pose | `atk3` from 0.72 s |
| `plunge_land` | the landing, trident in the ground, rises out of it | 0.37 s | `atk3` from 1.05 s |
| `riposte` | a hard thrust from the guard pose | 0.5 s, contact 0.08 s | `atk_dash` |
| `finisher_water`, `finisher_ice` | a big two-beat ender on a stunned foe | 0.77 s, contact 0.13 s | `atk_spin` |
| `whip` | the free hand lashes forward, the shoulder leads | 0.53 s, contact 0.12 s | `atk1` |
| `geyser` | the trident's butt slams down and the hand sweeps up | 0.63 s, contact 0.2 s | `cast_wave` |
| `lance_throw` | an overhand throw, the free hand | 0.57 s, release 0.17 s | `cast_wave` |
| `glacier_stomp` | a stomp with the trident driven down | 0.73 s, contact 0.23 s | `atk3` |
| `breath_cone` | palm out, braced, holding the cone | one shot 1.2 s, steady from 0.13 s to 1.03 s | `cast_wave` |
| `atk3` retimed | its blade peaks at 0.92 s; the first half is a slow turn. Please bring the peak to 0.3-0.4 s, or leave it and I keep starting it at 0.5 s | contact ≤ 0.4 s | `atk3` from 0.5 s |

For the Reaver family (`reaver.glb`): `tell_slash` and `tell_chop`, a held wind-up a person can read from behind a phone at 0.6-1.0 s, then the blow in 0.1 s; `shield_guard` (Captain, shield forward), `throw` (Archer's harpoon, release 0.13 s after the tell), `stagger` (dazed 2.6 s, loop). Stand-ins: `atk1`, `atk2` slowed through the tell.

Meshes wanted (movement or world, whichever suits): Reaver Captain with a real shield and heavier armour; Hammerhead (`creatures.glb`); later Moray, Anglerfish, Giant Crab, Siren, Frost Wight, Magma Husk. Until then the Captain carries a plain disc on `fore_L` and the Hammerhead a flattened head on the shark.
