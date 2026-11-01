# Epic status (one line per requirement; see EPIC.md)

Parts such as M1a report on their parent's line. A parent is `check green` when all its parts are.

| ID | What | Status | Check |
|---|---|---|---|
| M1 | Stride match: planted feet don't slide. A foot on the ground m | building | land now real capture, live 07:56; move_walls M1 family red, 4.6 cm a frame (limit 3); M1b, M1c red; see Pipeline/wip/movement/NOTES.md |
| M2 | Foot placement on terrain: two-bone IK plants the feet on the  | building | move_walls M2 red, 3.1 cm (limit 3); M2b, M2c green |
| M3 | Pose changes never pop: inertialization on every switch (Bollo | building | move_walls M3, M3m red on the capture legs; fix for the double-jump flip private, unrun; M3c green |
| M4 | Starts, stops, pivots: a start lean, a stop with a settle, a p | building | move_walls M4c red; real starts and stops private, M4s and M4t written, unrun |
| M5 | The jump: real anticipation, height set by press length, coyot | check green | move_walls M5a-j, M5g2 |
| M6 | Super sprint reads right: no legs running in slow motion at 36 | building | move_walls M6a, M6b; blur and M6c judge owed |
| M7 | Slopes: the Warden climbs what looks climbable and nothing els | check green | move_walls M7, M7b, M7c, M7d; rates A7, A7s |
| M8 | Wade and shore: deep water → wading (slowed, splash at the kne | check green | move_walls M8, M8b; splash judge owed |
| M9 | The surface: treading, breaching, diving in. See TRANS | building | move_walls M9a, M9d green; M9b, M9c look_shots --cross are look |
| M10 | Surf: ride the sea on a rising wave (a state of its own, with  | check green | move_walls M10a-d, M10f, M10g; M10e looked at, modest |
| M11 | Ride a whale or a dolphin, with a real grip pose | check green | move_walls M11a, M11b; ride film looked at, camera reworked |
| M12 | Swim is smooth at every speed: no pops between tread, slow, fa | check green | move_walls M12a, M12b, M12c |
| M13 | Camera: spring arm with second-order followers, never inside a | building | move_walls M13d, M13e; judged J3, J3c, J4, J5 green; play A5 13 frames left before the leap, not reread since |
| M14 | Fluidity, to the reference (`reference/fluidity_ref_action_rpg | building | web_check/combat walls; M14g judge owed; combat adds: [wall_fluid] green for blows (no dead stretch over 0.33 s, buffer 0.20 s, speed kept ≥ 80%) |
| M15 | Tidepulse: boost is a beat | check green | move_walls M15a, b, c, e; M15d judge owed |
| P1 | Water stance: Water Whip (a reaching lash that grabs and pulls | check green | `walls_page` [wall_powers], plants caught; every Water slot and the Whip fired by touch in Chromium and WebKit (`walls_touch` T2, T3) |
| P2 | Ice stance: Frost Lance (a thrown spear that freezes), Glacier | check green | [wall_powers], [wall_elements]; every Ice slot and Frost Guard by touch in both engines (`walls_touch` T1, T2); P2d Ice Path under a surf: 20 plates, 39 m in 2 s at 13 m/s or better, 0 frames in the water, and by touch (T6) |
| P3 | Elements combine: soaked + frozen = shatter for big damage; fr | check green | [wall_elements]: six named interactions, the sea holds 8.02 s, shatter × 3; each plant caught; P3f taught once per save, first.mjs not read by me |
| P4 | Melee: the three-hit combo, launchers, aerial strikes, plunge | check green | [wall_frames], data walls; the Waterspout: hold Jump on the water, 28 m over the sea, wall green, film at 1x; plants held on the lead's word until he's seen it |
| P5 | Call of the Deep: summon a shark pack, later a whale's breach | building | Call fires by touch and key; hold tiers walled: 0.7 s the pack, 1.5 s the Whale's Breach once the whale is in the book; the breach leaves the sea, told 1.2 s, strips armour, and opens the Colossus; P5 upgrades none; judge owed |
| P6 | Enemies, at least 9 kinds, each with a counter: Reaver, Reaver | building | 13 kinds, 2 new (Duelist, Thornback) plus a feint; 7 fights on land, soldiers only (`walls_land`: open on foot from the sea, every foe on the ground, each lands a blow, won at 3 skills); `rosters` puts the whole cast on the map, a kind per bell (they stood only on the test stage before); every encounter fought at its own place at 3 skills (`walls_sites`); masher wall: Duelist 52 hurt to an expert's 0; P6e judge owed |
| P7 | Bosses, at least 4: the Leviathan (arena), the Kraken (ship gr | building | four bosses at their mission places at 3 skills; rule walls + plants for each; intros: rise holds for the cinematic, no blow in it, a skip hands over at once; shot lists with missions, `boss_*` in cinematics.json not yet adopted; judge owed |
| P8 | Telegraphs are fair: every enemy blow shows ≥ 0.5 s before it | check green | [wall_telegraph]: least 0.65 s over every blow of every kind, parry 0.50 s, at most 2 at once, off-screen marks; plants caught. P8b sound via G.audio.tell |
| P9 | Upgrades: pearls and relics buy levels at shrines: health, tid | building | every level has its rule, `applyUpgrades` wall green for health, whip, glacier, wave; other levels written, not each read |
| P11 | Impact, to the reference: bright layered hit bursts, a flash o | check green | [wall_impact], `walls_look`: burst on the contact step, light gone by 0.33 s, at most 4.9% of the screen; plants caught; judge owed (P11b, P11e) |
| P10 | Balance: bots at three skill levels; a chapter is winnable wit | building | `walls_sites`: 26 encounters and 4 bosses on the 2,048 m map at 3 skills; `hard` and `easy` NOT read (stopped on the lead's word); expert 5-33 s, median 14 (was 3-15 s), on land 8-28 s; per chapter not read by me: rosters change what the story bots meet |
| P12 | Stances: one button switches Water and Ice | building | Stance button and key live, glow set by stance, Ice locked until quest grants it; playthrough not read by me |
| P13 | Shoalsong: sea life as an everyday power | building | `shoal.js`; [wall_powers] P13a 20 s, b every job, c 0 silent of 163 places (land by gull), d book, e tiers, plants caught; `upgrades.json` levels owed from missions; codex through `g_collect` not read; judge owed |
| P14 | Homeward Cast: throw and recall the trident | building | `homeward.js`; [wall_powers] P14a-c: from any range 1.27 s at most, through foes on the way back; P14d [wall_fluid]; by touch in both engines; P14e `whirr` in audio, not heard; judge owed |
| W1 | Reef Shelf | building | live: sea arch, reef, turtles. check_world.py; far_reef looked at (Pipeline/world/preview/stage_sheet.jpg); W19 judging owed |
| W2 | Kelp Cathedral | building | live with an organic outline and the Nave Spire. check_world.py; far_kelp looked at; stills for judging owed |
| W3 | Thalor, the Drowned City | building | live, Colossus at 1.12 so the trident breaks the surface. check_world.py; far_thalor looked at |
| W4 | Meridon, the Gilded City | building | live with the Gilded Spire and Gilded Bell. check_world.py; far_meridon looked at |
| W5 | The Vesper Deep and the city of Vesper | building | live, renamed the Vesper Deep, anglerfish placed. check_world.py W15a; deep stills dark, look tuning |
| W6 | Cindermere, the Vent Fields | building | live: smokers, lava cracks, forge, Cinder Cone with lava ribs, a breached crater and reefs, nothing growing on it. check_world.py; stills preview/pk_sheet.jpg. Near lava reads plain; ash and heat are look |
| W7 | Rimehold, the Frozen Sea | building | live: ice sheet of 83 tiles on 16 overlapping solids, 1.7 m clear over the floor, pillars, tunnels, Rime Bell, Rime Berg, narwhals, seals. check_world.py stuck rules; in_ice looked at |
| W8 | Wrackreach, the Ship Graveyard | building | live: wrecks, ghost lanterns, the Stood Ship, the Kraken pit with buttressed walls, broken floor, ribs on its ledges (preview/game_s4_in_kraken3.jpg). Near rock plain in the dark |
| W9 | Sunward Isle (land) | building | live, reshaped on 1 Nov after the owner called it flat: dunes, headland, rolling green, a 60 m hill with the temple, reefs, clumps of trees. check_world.py walks; stills preview/ph_sheet.jpg. W9 awaits his eye |
| W10 | Crown Isle (land) | building | live with river, Crown Falls, temple, stair, black beaches, reefs at the waterline. check_world.py; stills preview/pc_sheet.jpg |
| W11 | Frost Isle (land) | building | live: snow rolling from an uneven shore, stony shelf, cliffs north-west, fort on the ice shelf, stands of pine, bergs. check_world.py; stills preview/pf_sheet.jpg. Snow tile shows up close (look) |
| W12 | Terrain quality: no visible polygons up close, real detail nor | building | nearest level 1.25 m on a Catmull-Rom curve, heightAt the same; stills w12a-d before and after; M2 and A3-A5 not rerun |
| W13 | Building quality: real architecture: bevels, trim, cornices, c | building | W13a ice kit on stage; accepted kits conditional on phone frame time, not measured |
| W14 | Collision from meshes (A1, A2, A8): colliders generated from e | building | fit_colliders.py, live with 25,909 colliders. collide.mjs stage reading one land build back, not a round: A1 5 of 128,018 within 0.3 m, 0 inside; A1k pass, A1v 66 of 70, A2d 147 of 147, A2dc 140 of 144, A8 pass; A2 424, A2n 971, A2t 459. Not re-read on the reshaped land |
| W15 | Life everywhere: at least 25 species, schooling with real beha | building | 25 species live and placed. check_world.py W15a |
| W16 | Day, night and weather: a day of about 14 minutes, stars and m | building | clock, stars, moon, dusk, night, storm, rain, fog, bloom in both looks; stills in both engines; flights night 5.26 ms, storm 5.69 ms (Chromium phone); no wall yet |
| W17 | Streaming holds at 48 m/s with no hitch (B4) and no holes | todo | |
| W18 | The map at 2,048 m, grid 1,025 | check green | live since 03:56 on 1 Nov: 2,048 m, grid 1,025, biomes W1-W11. check_world.py ALL PASSED on the live files |
| W19 | Each biome is its own place | building | W19b: one far landmark per biome, each looked at (preview/stage_sheet.jpg); W19 judging owed |
| W20 | Vigil Light: dread in the deep dark | todo | |
| W21 | The Six Holds pattern | building | the Six Holds in world.json holds, tied to their POIs. check_world.py W21; missions' reading owed |
| G1 | Story in seven chapters: Waking (reef) · The Green Nave (kelp) | building | Paused on his word, see the pick-up note below. Last g_story: 8 chapters, 7 bells, Leviathan down, 1,623 s of game time, Chromium only, one run. WebKit last read 1,709 s, before the Wyrm changes. g_data G1a, G1b, G1p; g_collect G1g, G1o, G1r, G1s pass; G1w red |
| G2 | People: at least 8 named NPCs with dialogue boxes and portrait | check green | g_side G2t 15 people, g_screens G2d by fingers, g_data S2b, both engines. Stand-in bodies until the new builder's |
| G3 | Side missions, at least 12: nets to cut, lost divers, a wounde | building | g_side 15 of 16 both engines: s_whale stalls. Fix in (followers keep to his trail), not read (reruns paused) |
| G4 | Challenges: super speed ring runs, surf runs, arena waves, eac | building | g_side Chromium 6 of 6, WebKit 5 of 6: c_pit, which combat's rosters slowed; run alone in Chromium it also stalled, at 0 of 5. Fix in (fights go to combat's fighter), not read. A surf run is surface rings: nothing asks that he really surfs |
| G5 | World events, at least 6: Reaver raid on the village, shark fr | check green | g_side 6 of 6 fired, ended, paid; g_events G5c, G5e, G5s, G10b, both engines |
| G6 | Collectibles: pearls, 20 relic tablets of lore, a codex of eve | building | g_collect G6a, G6b, G6c, G6r 143 pearls, both engines; forms and outfits looked at in stills, Chromium. P9c written, 525 of 468 is 112%, the line not read in a run. New foes in the book, not read in a run |
| G7 | Screens: a map with fog of war and fast travel between shrines | building | g_screens 15 of 15, g_hud G7h with Cast and Jump up at six sizes, QA ui 13 of 13, contrast. input C1t and C1k for QA to re-read (timing, a bank) |
| G8 | Onboarding: in control within one tap (G1 of the standard), te | building | first.mjs 11 of 11 on the new opening; g_data G8c, G8w; g_screens G8g by touch, both engines. G8b and G8c are the judge's |
| G9 | Saves: every step survives a reload; runs with storage blocked | check green | g_saves 7 of 7, both engines, new map; state 6 of 6, both engines (round 6) |
| G10 | Omens: events seen from far off | building | g_events G10b gaps 144-176 s; four omens looked at from 300 m in Chromium stills (scratchpad, not look_shots). G10a read by a person owed |
| L1 | Looks are data, and switch live: `web/js/looks/real.js`, `pain | check green | look_shots --flips: 20 flips, 0 programs, textures or geometries gained |
| L2 | The Painted look, to the references (`reference/`): teal sea,  | building | first pass: side_sunset.jpg, side_coast.jpg; awaits his eye |
| L3 | Above water is as good as below: sun, sky, clouds, sea to the  | building | sea to the horizon, foam, wet sand, land shadow map |
| L4 | Phone smoothness: MSAA, no shimmer, no banding, soft particles | building | look_shots --flight on the 2,048 m map 5.7-6.8 ms average, p95 up to 8.5, on this Mac: a phone not measured; weigh.mjs on a copy of what's live 6 of 6: Q5 85.6, Painted 88.9, Q6 passes. Spawn 247k triangles on a copy. A real iPhone owed |
| L5 | Effects for every power: water reads as water (thick, refracti | building | look.waterMat, iceMat, setFrost looked at on test shapes and the Warden in both looks; not yet on a real power |
| L6 | The Warden and every enemy at 3:1, 60 px tall, both looks | building | RED since figures keep their colours: open blue (body in the sea seen from the air) 1.62:1 Real, 2.66:1 Painted; kelp 2.96:1 Real; not rerun since the last ink change. Enemies not read yet |
| T1 | Find the black frames' cause and remove it, or make it a delib | check green | look_shots --cross (both engines, treading too) + --plant: cause was a dark half dome at the waterline |
| T2 | Going up: the waterline crosses the lens, a meniscus, water sh | check green | clip web_check/look/tr_chromium.mp4 at 1/4; awaits judge |
| T3 | Going down: a splash, bubbles across the lens, the sound drops | check green | same clip; awaits judge |
| T4 | Half in, half out: a camera at the surface shows both, split b | check green | still t4_phone_wide_sheet.jpg |
| C1 | In-game cinematics system: a shot list as data, letterbox, ski | building | g_screens C1b, C1c, C1d, C1s (14 cinematics, 1,003 samples), both engines; g_data C1e. Combat's boss shots copied in after that: C1s not reread. C1f in perf.mjs not read |
| C2 | Unreal trailer: the world's assets in Unreal 5.3 through the b | todo | |
| C3 | Browser films for reels, in the square layout's size and in ve | todo | |
| S1 | The stack panel and a public page tell the true story: an 8 GB | building | stack.js holds the stack with no Unreal. Read against ~fact_list owed, and his read (S1c) |
| S2 | A title that passes the name check in seven stores and the tra | building | Searches dated 2026-11-01 in web_check/names_searched.json, g_data S2a, S2b. The trademark register is owed by a person |
| S3 | Reels, Eyes and Sales lanes, written with `Jakeschincariol/ins | todo | |
| S4 | "make this a standard in notesmosaic": the method goes into sk | todo | |
| S5 | Listing: thumbnail, description, certify, launch, publish: eac | todo | |
| Q1 | Median frame rate at least 59 fps at phone size | building | perf B3, turned B3t: r6 Chromium median 16.7 ms, WebKit 17.0 on its 1 ms clock, the middle half's mean 16.67 and 16.76, 3,596 frames, upright and turned |
| Q2 | At most 5% long frames | building | perf B4, pace B4p B4s, turned B4t B4st: 0.08% at worst in r6, both engines |
| Q3 | No frame over 50 ms after the first input | building | r6: B4p red in WebKit, 294 ms at 59.5 s; Chromium's first read 259 ms, its second none. B4pc on a cold cache red in both: Chromium 119 ms at 12.2 s, WebKit 104 ms at 56.6 s with `thing_net` first drawn then; each stall now prints what was first drawn |
| Q4 | Frame work at or under 11 ms at p95 | building | perf B3j: p95 2.6 ms Chromium, 2.0 WebKit, r6 |
| Q5 | Working memory under 96 MB | building | weigh F2, CR-22: 90.0 MB in the starting look, 6.0 MB of room, r6 Chromium; F2p red in Painted at 111.0 MB. A definition chosen, not a pass earned; a real iPhone owed. WebKit gives no heap, so it has no Q5 reading |
| Q6 | Working memory peak under 128 MB | building | weigh F2t red: 158.9 MB at most, at load, the raw heap at 114.8-124.9, r6 Chromium; F2l, with a collection at every sample, 93.6 MB. Soak Q6 now binds play. WebKit gives no heap, so it has no Q6 reading |
| Q7 | At most 100 draw calls | building | perf B5, turned B5tt: 62 draws at most, r6, both engines; the big map not read yet |
| Q8 | At most 500k triangles (TBR) | building | perf B5t, turned B5tt: 367k at most, r6, both engines; the big map not read yet |
| Q9 | At most 20 MB before first play | building | load B1: 5.24 MB as sent, r6, both engines |
| Q10 | On screen in 1 s, playable in 10 s, at 10 Mbps | building | load B2p 96 ms, B2 6,473 ms on a 4x slower CPU, WebKit 31 and 5,449 ms, r6 |
| Q11 | Every wall in both engines, upright and turned | building | tools/round.sh: r6 read every wall in both engines: 281 of 320 lines pass, others 188 of 223 |
| Q12 | A real iPhone, ten minutes, no reload | todo | |
| Q13 | Visible response within 50 ms of a press | building | lag: 16.2 ms Chromium, 15.0 WebKit, r6; plant q13_frames_late |
| Q14 | Drawn motion even within 2% at every rate | building | rates A6d: 0.0% at 8 stamp lists with 30 Hz, r6, both engines |
| Q15 | Every MUST checkpoint has a check or a reason | building | CHECKPOINT_MAP.md: all 34 mapped, status from r6: 25 pass, 9 fail |
| Q16 | Clean room: every number sourced, no barred source | building | static r6: Q16a red, 21 of 54 constants with no line; Q16d red, 32 of 39 data groups; Q16b pass |
| Q17 | Every wall has a plant | building | plants.mjs: 179 written; 47 ran on r6, 44 caught, 3 missed and rewritten; none ran on r7, which stopped. move_plants.mjs: 65, r6 read 48 red, 1 not caught, 16 stale |
| Q18 | No remote code | building | load Q18, static Q18s: 0, r6, both engines |
| Q19 | Everything public claims only what was done | todo | |
| Q20 | No banned name in shipped files or the listing | building | static Q20: 0 of 33 names in 66 files, r6 |
| Q21 | Every round keeps its evidence | building | runs/6: ROUND.log, gate/, clips/, JUDGE.md |
| Q22 | A second session judges each frozen round | building | runs/6/JUDGE.md final; r7 frozen 05:39:38, stopped 05:49 on the lead's word with no score: runs/7/JUDGE.md says what was read |
| Q23 | Published bytes match the frozen copy | todo | |
| Q24 | Files the first view doesn't need load after first play | check green | load Q24 on a copy of the live map: 3 packs load late, 0.97 MB; 3.82 MB as sent before first play. Packs wait for the hero to move, or half a minute at the title |

## Pick-up: missions, paused 2026-11-01 on his word ("Pause on the missions for now")

Frost Wyrm stall (ch4.5, reported 736 s on the 06:36 snapshot, 3 bells):
- As far as I read it this is the bot, not a soft-lock. Alone from ch4.5 the Wyrm died in 74 s and the hero never died, so it can be reached and hurt. Two of two chained runs finished it.
- Where the time went: in one chained run ch4.5 stayed open from about 650 s to past 1,460 s. For about 600 of those seconds the Warden stood at z +2 on the ice over the Rime caves, near (250, 850), swinging at 7-8 foes 9-13 m away under the ice, with the Wyrm still asleep. Kills crept from 37 to 42. The foes were left from ch4.4 plus `patrol_rime_caves`. Nothing holds a player there; he can swim on. No test proves that.
- Yes, foes do reach the boss place: world's `rime_court` (5) stands exactly where the Wyrm wakes, and `cinder_court` (5) at the Colossus, on top of the Wyrm's own summons. A court also guards its bell.
- Live changes, both in `web/js/quest.js` (`missions.js` calls the second): `walled()` makes the bot ignore foes behind rock or ice, and `clearCourt()` marks a world encounter within 60 m of a boss place cleared when the boss objective starts, if it's idle. No wall checks `clearCourt` directly.
- One `g_story` since then: green, longest objective 276 s (ch5.10). One Chromium run; the stall was intermittent, so one green doesn't close it.

Still open:
- G1w red, `s_bell.1` "no way for a straight 70 m". Probably the check: the fight is in open water at (283, -312, -4), the ground on the line from Crown Cove is 2 m or lower with no solids at body height, and 5 m slices show free cells that connect. Widening the walk over land (ground + 6) didn't turn it green, and I never found why the walk fails.
- `s_whale` (followers keep to his trail, hop when stuck) and The Pit (fights go to combat's fighter): fixes in, `g_side` never reread.
- Combat's boss shots: C1s not reread. WebKit `g_hud` not read after Cast and Jump.

