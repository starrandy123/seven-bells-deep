
# §Combat (owner: combat)

## How the reference was measured

Source: `reference/fluidity_ref_action_rpg.mp4`, 960×540, 30 fps, 646 frames, 21.53 s. Study only: timing and how a burst is layered, counted from frames; nothing of its art, characters, effects or name ships.
- **Frames by eye:** `ffmpeg select=between(n,a,b),tile=8x6` strips of consecutive frames for eight windows (f0-47, 90-137, 180-227, 240-287, 300-347, 370-431, 425-472, 484-531, 555-602), and 1:1 crops around four contacts. A *contact* is the first frame a burst shows. One frame is 33.3 ms, so every count below is ±33 ms.
- **By instrument:** gray frames at 160×90 and 320×180 read in Node: per frame the mean luma, the share of pixels at luma ≥ 235, and the motion of pixels under luma 200 in both frames (so a burst's own animation can't read as motion). The same reader runs on our clips, so parity is a number, not an opinion.

## What the reference does (30 fps frames, then seconds)

| Thing | Count | Seconds | Read from |
|---|---|---|---|
| Hit to next hit in a chain | median 14 f, range 10-20 | 0.47 (0.33-0.67) | f12→24→38, 95→109→125, 183→193→207, 261→274→290, 374→388 (10 gaps) |
| Wind-up (blade reverses → contact) | 5-7 f, usually 5-6 | 0.17-0.23 | f5→12, 90→95, 104→109, 187→193, 202→207, 268→274 |
| Active | 1-2 f | ≤ 0.07 | the blade sweeps 60-90° a frame just before contact |
| Contact → next wind-up begins (how early the next action starts) | 4-10 f, median 8 | 0.13-0.33, median 0.27 | f183→187, 12→20, 95→103, 193→202, 109→118 |
| Dodge travel (sideways slip) | 8-10 f | 0.27-0.33 | ring first at f423, feet set by f431 |
| Dodge roll (full tumble) | 10 f + 6 f to rise | 0.33 + 0.20 | f329-338, up by f344 |
| Dodge → next blow begins / lands | 10 f / 13 f | 0.33 / 0.43 | f423 → wind-up f433 → contact f436 |
| Hit-stop, whole frame | none measurable | 0 | non-burst motion at c+0..c+2 stays 70-120% of the 10 frames before, over 22 contacts; the camera never stops |
| Hit-stop, bodies | ≤ 1 f light, 2-3 f heavy | ≤ 0.03 / 0.07-0.10 | crops f486-497 (held 3 f) against f105-116 (no hold, the body turns through the blow) |
| Burst, time to peak | median 3 f | 0.10 | peak bright area over 21 contacts |
| Burst, white-hot core | 2-3 f | 0.07-0.10 | f436-437, f490-491, f183-184 |
| Burst, whole, light blow | 8-10 f | 0.27-0.33 | f12-19, f95-103, f261-271 |
| Beam through the target, after the core | starts c+3..4, lasts 5 f | 0.17 | f15-19, f97-101, f265-268, f467-471 |
| Thin line left in the air | up to 18 f | 0.60 | f443-461 |
| Target rings on a cast, rising | 20 f+ | 0.67 | f509-533 |
| Screen lift at contact, mean luma of 255 | median +10, biggest +30 | | f436: 108 → 131 → 134 in 2 frames, back in 7 |
| Bright area at peak, share of the frame | median 1.8%, biggest 7.4% | | luma ≥ 235; f436 is the biggest |
| Death | dissolve to dark smoke, 24 f | 0.80 | f577-600 |

**How a burst is layered** (order of appearance): a white-hot core with uneven thin spikes at c; a pale crescent along the blade's path c..c+3; heavy streak sparks flung outward c+1..c+5; a long tapered beam through the target c+3..c+8; embers to c+10. Big blows add a thin shockwave ring; casts add rings rising over the target. Size: a light core is about the target's torso, spikes to about 1.2× that; the biggest (f436) spans half the frame's height for 3 frames.

**What it teaches:** speed comes from short wind-ups and from the next action starting 0.13-0.33 s after contact, not from freezing the frame. The burst is what lands the blow; bodies hold for at most 2-3 reference frames. Nothing in the clip ever stops: the camera moves through every contact.

## The design, from those counts

Frames below are 60 Hz sim frames. Everything is in `web/data/combat.json`; `web/js/combat_core.js` holds the rules, in Node-testable code. **Nothing stops dead:** every press lives 0.2 s (buffer), and each move states the first frame each class of input may start. **Strike chain:** blow to blow 0.40-0.50 s, inside the reference's 0.33-0.67. **Wind-up:** 10-14 f (0.17-0.23 s, the reference's). **Dodge:** a press of Boost in a fight, 0.33 s, invulnerable 16 f; Strike from frame 14 (reference 0.33 s), which is the launcher, and held Boost runs on into the boost. **Hit-stop:** bodies only, never the frame: 0.03 s light, 0.08 s heavy, 0.10 s finisher (ours within the reference's 0.03-0.10). **Burst:** starts on the contact step; white core, crescent, sparks with weight, beam at +0.055 s, ring on big blows; capped under 10% of the screen at any distance, upright or turned, and at most three big flashes a second (E3). **Cleave:** off-target foes take half (ours: a sweep at a crowd otherwise kills a group as fast as one foe).

Kinds of number: the rows above are measured. `tell_s`, foe hit points, the cleave, difficulty and every damage figure are ours, tuned by the fight bots in `web_check/combat/walls_fights.mjs`.

<!-- frame data: written by web_check/combat/frames.mjs, do not edit by hand -->

| Move | Clip | Wind-up | Active | Total | Dodge from | Parry from | Strike from | Power from | Walk out | Damage | Cost | Cooldown | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Thrust `strike1` | atk1 | 10 | 4 | 36 (0.60 s) | 0 | 0 | 24 | 15 | 26 | 16 | – | – | → strike2 |
| Sweep `strike2` | atk2 | 10 | 5 | 38 (0.63 s) | 0 | 0 | 24 | 16 | 28 | 20 | – | – | → strike3 |
| Overhead `strike3` | atk3 | 14 | 6 | 46 (0.77 s) | 0 | 0 | 30 | 24 | 32 | 36 | – | – | → strike1; breaks ice |
| Rising Tide `launcher` | launcher | 7 | 5 | 34 (0.57 s) | 0 | 0 | 20 | 16 | 26 | 22 | – | – | → air1; throws up 11 m/s |
| Aerial Cut `air1` | air1 | 7 | 4 | 26 (0.43 s) | 0 | 0 | 18 | 12 | 22 | 14 | – | – | → air2 |
| Aerial Sweep `air2` | air2 | 7 | 5 | 28 (0.47 s) | 0 | 0 | 18 | 13 | 24 | 18 | – | – | → plunge |
| Plunge `plunge` | plunge | 6 | 60 | 66 (1.10 s) | 12 | – | – | – | – | 44 | – | – | breaks ice |
| Plunge landing `plunge_land` | plunge_land | 1 | 1 | 22 (0.37 s) | 0 | 0 | 8 | 6 | 8 | – | – | – |  |
| Riposte `riposte` | riposte | 5 | 4 | 30 (0.50 s) | 0 | 0 | 18 | 12 | 20 | 42 | – | – | → strike2; breaks ice |
| Undertow `counter` | atk3 | 6 | 6 | 38 (0.63 s) | 6 | 6 | 24 | 18 | 26 | 60 | – | – | invulnerable 0-14; → strike1; breaks ice |
| Finisher `finisher` | finisher_water | 8 | 8 | 40 (0.67 s) | 20 | 20 | 26 | 24 | 28 | 110 | – | – | invulnerable 0-20; breaks ice |
| Dodge `dodge` | dodge_water | 0 | 0 | 20 (0.33 s) | 18 | 14 | 14 | 14 | 16 | – | – | – | invulnerable 1-16 |
| Parry `parry` | parry | 2 | 0 | 36 (0.60 s) | 8 | – | 30 | 30 | 30 | – | – | – | guards 2-30 |
| Frost Guard `guard` | parry | 2 | 0 | 36 (0.60 s) | 8 | – | 30 | 30 | 30 | – | – | – | guards 2-30; freezes the attacker |
| Water Whip `whip` | whip | 7 | 8 | 32 (0.53 s) | 0 | 0 | 16 | 16 | 20 | 10 | 8 | 0.9 s | soak 1 |
| Riptide `riptide` | atk_dash | 5 | 20 | 40 (0.67 s) | 6 | 6 | 26 | 26 | 28 | 30 | 15 | 2.6 s | soak 1 |
| Maelstrom `maelstrom` | atk_spin | 8 | 48 | 66 (1.10 s) | 8 | 8 | 56 | 56 | 58 | 13 | 30 | 6 s | soak 1 |
| Tidal Wave `wave` | cast_wave | 18 | 4 | 46 (0.77 s) | 0 | 0 | 24 | 24 | 28 | 46 | 40 | 7 s |  |
| Geyser `geyser` | geyser | 12 | 4 | 38 (0.63 s) | 0 | 0 | 20 | 20 | 24 | 26 | 24 | 5 s | throws up 14 m/s; soak 1 |
| Frost Lance `lance` | lance_throw | 10 | 4 | 34 (0.57 s) | 0 | 0 | 18 | 18 | 22 | 22 | 16 | 1.8 s | chill 3 |
| Glacier `glacier` | glacier_stomp | 14 | 4 | 44 (0.73 s) | 0 | 0 | 24 | 24 | 28 | 28 | 26 | 5 s | throws up 7 m/s; chill 2 |
| Winter's Breath `breath` | breath_cone | 8 | 54 | 72 (1.20 s) | 8 | 8 | 30 | 30 | 62 | 7 | 24 | 5 s | chill 1 |
| Ice Path `icepath` | – | 0 | 0 | 1 (0.02 s) | 0 | 0 | 0 | 0 | 0 | – | 20 | 9 s |  |
| Shoalsong `shoalsong` | – | 0 | 0 | 1 (0.02 s) | 0 | 0 | 0 | 0 | 0 | – | 12 | 6 s |  |
| Whale's Breach `breach` | cast_wave | 16 | 4 | 46 (0.77 s) | 0 | 0 | 26 | 26 | 30 | 150 | 90 | 40 s | throws up 16 m/s; soak 1 |
| Homeward Cast `cast` | lance_throw | 10 | 1 | 32 (0.53 s) | 0 | 0 | 14 | 14 | 18 | 26 | 6 | 0.5 s |  |
| Call of the Deep `call` | cast_wave | 16 | 4 | 46 (0.77 s) | 0 | 0 | 26 | 26 | 30 | – | 70 | 22 s |  |

| Foe | HP | Poise | Counter | Blow | Tell | Can land for | Open after | Damage |
|---|---|---|---|---|---|---|---|---|
| Reaver | 240 | 110 | any blow; parry for a full opening | slash | 0.62 s | 0.16 s | 0.55 s | 9 |
| Reaver | 240 | 110 | any blow; parry for a full opening | chop | 0.72 s | 0.18 s | 0.65 s | 11 |
| Reaver Captain | 480 | 180 | shield: parry the bash or freeze him for a long opening; it is down while he recovers from a swing | bash | 0.75 s | 0.18 s | 0.8 s | 14 |
| Reaver Captain | 480 | 180 | shield: parry the bash or freeze him for a long opening; it is down while he recovers from a swing | overhead (dodge only) | 1 s | 0.2 s | 1 s | 20 |
| Reaver Archer | 160 | 70 | dodge sideways; a parry sends the harpoon back; the whip pulls him in | harpoon | 0.95 s | 0.1 s | 0.7 s | 10 |
| Shark | 150 | 80 | dodge through the lunge, strike as it turns | lunge | 0.72 s | 0.95 s | 1.8 s | 11 |
| Moray | 200 | 80 | hidden until he is close: dodge the snap, then strike while it hangs out of its hole; the whip drags it into the open | snap | 0.6 s | 0.45 s | 1.7 s | 14 |
| Anglerfish | 280 | 90 | its lure shows in the dark: a blow from range stuns it, and it is slow to turn | gulp | 0.9 s | 0.7 s | 1.6 s | 18 |
| Giant Crab | 420 | 200 | armour: heavy blows crack it, a frozen crab shatters it; until then blows barely mark it | pincer | 0.8 s | 0.2 s | 0.9 s | 14 |
| Giant Crab | 420 | 200 | armour: heavy blows crack it, a frozen crab shatters it; until then blows barely mark it | slam (dodge only) | 1.05 s | 0.22 s | 1.2 s | 20 |
| Siren | 170 | 60 | her song draws him in: any hit breaks it, and the whip reaches her first | charm | 1.1 s | 1.6 s | 0.8 s | 0 |
| Frost Wight | 300 | 120 | the cold can't touch it; soak it and it takes half again as much | slash | 0.62 s | 0.16 s | 0.55 s | 11 |
| Magma Husk | 320 | 130 | dry, it shrugs off blows: soak it to crack the crust, then strike | chop | 0.72 s | 0.18 s | 0.65 s | 13 |
| Duelist | 300 | 150 | two blows and he's set: the next he turns aside and answers. Stop when he glows, parry the answer, and he's wide open. One of his swings hangs before it falls | slash | 0.62 s | 0.16 s | 0.55 s | 10 |
| Duelist | 300 | 150 | two blows and he's set: the next he turns aside and answers. Stop when he glows, parry the answer, and he's wide open. One of his swings hangs before it falls | feint | 0.72 s | 0.18 s | 0.65 s | 12 |
| Thornback | 210 | 95 | spines up, a blow at arm's length comes back on you: wait for them to lie flat, or reach it from afar | dart | 0.7 s | 0.8 s | 1.5 s | 11 |
| Hammerhead | 320 | 130 | two at once: dodge the pair, then strike a flank (× 1.5 while it recovers) | charge | 0.85 s | 1.1 s | 1.6 s | 16 |

<!-- end frame data -->

### Bosses (data: `bosses` in combat.json; `web/js/boss.js`, `web/js/bosses2.js`)

| Boss | HP | How it's beaten | Read at 3 skills |
|---|---|---|---|
| The Leviathan | 3400 | Parry the bite (its jaws gape through the tell), then strike the head at × 2 for 4.5 s | 56-115 s |
| The Frost Wyrm | 3000 | The same serpent; water × 1.3, ice × 0.5; it calls Frost Wights | 61-88 s |
| The Kraken | 900 + 5 arms of 300 | Each slam is told by a circle where he stood; a slammed arm lies open, frozen it takes × 3; sever every arm, then the mantle opens | 44-48 s |
| The Cinder Colossus | 1150 | Armoured (× 0.1) until all 3 vents are capped with ice, held 7 s each; the core then stays open 9 s and its cracks go dark | 71-96 s |

Foe health, poise, the cleave and every boss number are ours, tuned by the fights wall. Stun and stagger have a rule of their own (ours): a light blow doesn't break a told blow, and a foe can't be held down by repeating them for 1.6 s, because every foe was otherwise stun-locked and the novice took no damage.


### Who stands where (data: `rosters` in combat.json)

The world and the missions only ever name Reavers, sharks and `mixed`, so the rest of the cast stood on the test stage alone until 1 Nov. An encounter's soldier and fish slots now fill from a place's lists: the bell it's tied to, else the nearest hold within 320 m, else the open sea; 300 m round the spawn is the reef. The story opens each list a kind per bell, so a new player meets one or two kinds at a place and the cast arrives a counter at a time. Each kind's first swing says what beats it (`short`). An encounter with its own `mix` keeps it. All numbers (ours).

### Foes that make him read

| Read | Who | The rule | Numbers (ours) |
|---|---|---|---|
| Stop hitting | Duelist | Two blows in a row set him (he glows). The next is turned aside and he answers at once; parry the answer and he's open. Left alone the stance lapses | set within 1.6 s, stance 1.3 s, answer told 0.5 s |
| Wait for the true beat | Duelist's feint | The swing stops most of the way up, the rim dies, and it falls late. A parry on the first beat is early | hangs 0.42 s; the rim falls to 0.14 |
| Don't strike now | Thornback | Spines up, a blow at arm's length comes back on him. Reach it from afar, or wait | up 2.4 s, flat 2.6 s, thorn 7 |

`combat_bot.js` has a fourth skill, `masher`, who holds Strike and reads nothing. The fights wall compares him with the expert, so "demands a read" is a measured line.

### Shoalsong (data: `shoal` in combat.json; `web/js/shoal.js`)

Call's press sings. Held, the ring spreads: a tap reaches 26 m, held 44 m, and what it touches follows him for 20 s, at most 8 at once. These are the world's own creatures, steered by the fields `life.js` already swims them by, so `life.js` didn't change. They go home after.

| Kind | Job | How |
|---|---|---|
| Schools | Shield, then swarm | The first takes one blow and is spent (not an unblockable: that blow's law is "dodge this"). Any more swarm the nearest foe within 22 m, its pace × 0.55 |
| Rays | Light the dark | Below 30 m, a 26 m light from the nearest ray within 22 m |
| Turtles | Lift him | When a blow knocks him about, one comes up under him and carries him up at 9 m/s for 0.7 s, every 5 s at most |
| Sharks, hammerheads | Hunt what he marks | The last foe he struck, else the nearest within 30 m; 16 a bite, every 1.5 s |
| Gulls | Keep him company on land | Circle him, 11 m up. No sea creature can come there (P13c) |

Minnow's book teaches the song: fish and gulls always answer, the rest once logged, and a toast says so. A school's ball rides a long loop round its centre, so led schools narrow that loop to 2 m and widen it again going home, both eased, or the ball would jump.

With nothing in the ring, the nearest school hears him anyway. Under 70 m it swims in; further, it comes in out of the fog behind the camera. In water under 2.2 m deep or on land, a gull comes instead. Most of the map needs this: the world's 31 schools are thin on 2,048 m.

The song's top tiers are P5's: held 0.7 s, the pack; held 1.5 s with the whale in the book, the breach. A breach is told by a circle and a boil 1.4 s before it lands, comes up side on to the camera, strips armour, breaks a guard, and on the Colossus opens the core 6 s.

### Homeward Cast (data: `moves.cast`; `web/js/homeward.js`)

Thrown at 48 m/s, it goes through what it meets, up to 34 m, and hangs or sticks there 7 s. Cast or Strike calls it home from anywhere, even from a hurt: the bone that carries it in his hand is folded while it's away, and a mesh of its own flies. The way home is a spline through up to 3 foes within 16 m of the straight line, in the order it reaches them, their live positions each step; with none it swings wide by 7 m. The time is set when it's called, at most 1.25 s, so distance can't break P14c. Catching it changes nothing about what he's doing. A shield stops a throw, but a blow reads from where the trident is, so the way home takes a Captain from behind. Damage 26 out, 34 back.

### Boss intros

The rise lasts as long as the cinematic over it (6.6 s); with none, or skipped, it cuts to the short way (2.4 s, serpents 4.2 s), so a fight starts as soon as he can play it. Kraken: the sand goes, the arms come up one by one, the mantle, then the eyes open and it roars. Colossus: the bed splits and glows, he comes up dark, the fire climbs him, his eyes light. The serpents swim a falling circle in, then come round to the camera to open their mouths. `b.bearing()` says where a camera stands to look a boss in the face.

# §Movement (owner: movement)

Every number here is (ours) unless a source is named: chosen and tuned against clips and walls, never measured from another game. Sources are rows of `Pipeline/research/STANDARDS.md`; none is decompiled or disassembled (`CLEANROOM.md`, `steal_skill.md` §0). Celeste's figures come from the file its makers published under MIT, as `[CelesteSrc]`.

## How he's built

`hero.js` moves the body through the world at 60 Hz. `body.js` draws it once a display frame, in this order: clips sampled (no AnimationMixer: it only writes a bone when the blended value changes, so anything layered on a held pose would pile up) → inertialization → lean → a foot that's down held on the real ground → a correction on the clip's own leg → mantle. On land the whole body is the capture's, legs included, and the clip runs at the rate that matches his speed. A foot that's down stays where it came down and the leg bends only as far as that takes; over the end of a stance it's given back to the clip, so nothing is left for the leg to catch up with in the air. Everything that moves him goes through collide and slide (`world.sweep`, after Fauerby), so a step at any speed meets every solid on the way.

## The stride (`formulas/gait.js`): real strides, read back from the capture's feet

The Rocketbox files have the hips nailed to one spot, so `Pipeline/hero/mocap_fit.py` reads where the body really went from the feet that were down: the length of the stride, the speed it was run at, and the rise, sway and surge of the hips, on his own legs (0.409 + 0.407 m). Each gait's numbers go into `moves.json` as `gait`.

| Gait | Clip | T s as run | Stride m | v m/s as run | At `RATE` 1.25: T, v | Share on the ground |
|---|---|---|---|---|---|---|
| walk | `m_walk_neutral_01` | 1.20 | 1.24 | 1.04 | 0.96 s, 1.29 m/s | 0.63 |
| run | `m_run_neutral_01` | 0.73 | 2.30 | 3.14 | 0.59 s, 3.92 m/s | 0.36 |
| sprint | `m_run_fast_01` | 0.60 | 2.83 | 4.71 | 0.48 s, 5.89 m/s | 0.42 |

Between two gaits the stride is the blend of theirs and T = stride / speed, so a foot going back under him goes at his speed.

| Name | Value | Kind | Why |
|---|---|---|---|
| `RATE` | 1.25 | (ours), the lead's call | he's a hero in a 2 km world: every capture plays this much faster than it was run, stride for stride |
| `T_SLOWEST` | 1.5 s | (ours) | below the walk the steps stop slowing and the stride shortens instead (`S.k`) |
| `T_MATCH`, `T_FASTEST` | 0.46 s at `MATCH`, 0.33 s at 36 m/s | (ours) | past the fastest clip the cadence rises slowly: M1b's 5 steps a second up to sprint (capture's steps aren't even, so a stride of 0.46 s is 4.9 at its quicker step), M6a's 6 at 36 m/s |
| `S.bt`, `warp` | the clip's share × (clip's ground speed / his) | derived | past the fastest clip a foot's time on the ground shortens as a real sprinter's does [Weyand00]; each leg runs the stance at the ground's speed and takes the rest for its swing |
| `MATCH`, `SEEN` | 9.2, 7 m/s | (ours) | past `MATCH` a stride can't follow the ground. The feet are carried on with him and stop being held at all by `MATCH` + 2 m/s: the legs are the clip's, and blur, dust and afterimages take over (M6b) |
| `MAX_DROP` | 0.26 m | (ours) | how far the hips go down to reach a planted foot, on a slope; a foot pushing off never pulls him down |
| stance release | last 40 % of the stance, at most 1.9 cm a 60 Hz frame | (ours), under M1's 3 cm | what the hold has taken up goes back to the clip before the foot leaves |
| soft reach | the last 3.3 % of a leg | (ours) | a knee coming out of straight turns fastest of all, so nothing asks for the very end of it |
| `REACH_OFF` | 0.965 of the leg | (ours), the soft reach's start | a foot well into its stance comes up when the leg has run out of reach, as a real foot does. Held on, the reach read 1.108 of the leg: the foot dragged and the knee snapped at 2,129°/s against the capture's 1,160 |
| `KNEE_RATE`, `TOE_RATE`, `FOOT_RATE` | 24.4, 24 and 20 rad/s | (ours), under M3's 1,500 | a knee has a top speed: a foot in the air gives along the line from the hip. The toe is the capture's without its noise, which reads 1,576°/s at `RATE` on a joint that small. A foot in the air turns no faster than this, and lands at the angle it has, up to 0.3 rad off the clip's, with the roll taking it the rest of the way: a tap, release and tap left a foot no swing to get flat in, and it flipped at 8,167°/s |
| `ONCE_MOST`, `ONCE_SLOPE` | 2.4 m/s, 0.27 (15°) | (ours) | a capture of a start begins at a stand on the flat. He lands from a run, wades ashore or comes off the land ride already going, and on a hill the stride does it |
| `SLOPE_STRIDE` | 0.45, from 0.2 of slope to 0.7 | (ours) | the most a hill shortens his steps, up, down or across, read from the ground's own steepness 0.8 m around him; they quicken to match, so the ground's speed is the same. On the flat stride a 32° descent had both feet off the ground at a walk and the hips stepping 30 cm a frame. M2h |
| Hips on a hill | start down at 25 % of a swing, all of it by 90 %, over 0.1-0.3 slope | (ours) | they lead the foot that's coming instead of dropping when it lands |
| Foot to the slope | 35-95 % of a swing | (ours) | the ankle sets the foot to the ground it's about to land on: it no longer flies level and snaps on contact, which read 3,500°/s. M2j |

A real start and a real stop (`run_start`, `run_stop`, `walk_start`, `walk_stop`, and each off the other foot, `_m`) play at `RATE`, with the frames each foot is down read by eye from the files. Out of a fight only: in a fight footwork stays on the stride.

## Speeds and forces

| Name | Value | Kind | Why |
|---|---|---|---|
| `CRUISE`, `BOOST`, `SUPER` | 7.5, 15.5, 48 m/s | (ours) | swim speeds, kept from the game before this round |
| `LAND_RUN`, `LAND_SPRINT`, `LAND_SUPER` | 5.9, 9.1, 36 m/s | the first two from the clips | the fastest capture at `RATE`, and what a stride holds with its stance shortened; super kept from the game before |
| Speed up | 6.5 m/s² below 2.5, 11 to 6, 14 to 9.5, 22 above | read from the captures, at `RATE` | a real start leans and gathers before it goes; super is a release |
| Slow down | 9 m/s² below 9.5, 20 to 14, 24 above | read from `m_run_stop`, at `RATE` | he stops the way the capture stops: about 1.9 m from a run |
| `WALK_TOP`, `WALK_EASE` | 2.6 m/s, 2.4 m/s² | read from `m_walk_start`, `m_walk_stop`, at `RATE` | a walk's start and stop take the time the captures do: at the run's rate the body left the planted foot behind |
| Turn | at most 24 / v rad/s, 11 at walking | (ours) | a lateral 24 m/s², about 2.4 g, a hero's carve. A goal swings to the stick at that rate and the heading follows it critically damped, so a turn lands with no overshoot (M4f) |
| Pivot | stick over 120° from his heading above 2.6 m/s | (ours), M4c's 120° | |
| `TAN_CLIMB`, `TAN_WALL` | tan 50°, tan 68° | (ours), the cloud session on his "I can't sprint or climb uphill" | he walks up to 50°, slowing, scrambles to 68°, and only a real cliff stops him. Past A7's 35-45°: M7, M7c and M7d still read the old limit, and a change record has to settle them |
| `STEP_UP` | 0.52 m | (ours), derived | the top he stands on with no jump. His sphere is 0.42 m, centred 0.92 up, so it clears anything under 0.50; A7 wants 0.40 to pass and 0.60 to refuse |
| `SLOPE_READ` | 0.6 m | (ours), derived from A7 | the slope is read over this: a 0.40 m step reads 34°, a 0.60 m step 45°, so one passes and one refuses; a frame's own run would read any step as a cliff at a walk |
| Slow on a hill | to 45 % at the limit | (ours) | M7d |
| Wading | to 58 % from 0.3 m deep | (ours) | M8b's 60 % |
| `STAND`, `SWIM_Y` | 0.92, -0.55 m | (ours) | his sim point over the ground, and where he floats: the same height as standing at the depth his feet leave the bottom, so the shore never jumps |
| `EDGE_ZONE`, `EDGE_BACK`, `EDGE_PUSH` | 46 m, 9 m, 44 m/s² | (ours) | the sea at the map's edge: it holds his outward speed to what can stop by `EDGE_BACK`, then shoves him back; 48 m/s stops in 26 m |
| `BREACH_G`, `BREACH_H`, `BREACH_S` | 15 m/s²; 6.4, 11.6, 19.6 m at 7.5, 15.5, 38 m/s | (ours), the owner's 5, 10, 18 m and 1.5-3 s | the dolphin leap: its own gravity and how high over the sea for the speed he comes up at; apex read by M9d |
| `BREACH_FLAT`, `BREACH_ARC` | 26 m/s, 6 m/s | (ours) | the most he carries forward, and the least: straight up isn't an arc |
| `SHOT_FAR`, `SHOT_RISE`, `SHOT_AWAY`, `SHOT_LOW`, `SHOT_HIGH`, `SHOT_FOV` | 5.5 m + 0.4 m per m of leap, 1.9 rad, 1.1 m, 0.33 rad, 50° | (ours), the owner's note | a leap filmed from the water: low, to one side and a little behind, tilted up, so height and hang read against the sky and the horizon. From right behind, a straight body along its path is a dot |
| `BREACH_UP`, `BREACH_MIN` | 1.5, 3.5 m/s | (ours) | what counts as coming up at a real speed; no button and no aiming past that |
| `DRIVE_V`, `DRIVE_NEAR`, `DRIVE_DEEP` | 13 m/s, 4 m, 0.5 s | (ours), the lead's 4 m | a tap of Jump in the water: within `DRIVE_NEAR` he's driven up and out, deeper it's a kick this long |
| `PORPOISE_T`, `CHAIN_LATE` | 0.42 s, 0.45 s | (ours) | chaining: the dip under the water with all his speed kept; a tap this soon after going in still chains |
| `CLOTH_SWIM`, `CLOTH_HUG` | 0.34, -0.42 rad | (ours) | the most the water lifts the mantle off his back, and how it lies at a swim, along his arched back: streaming straight out behind him it was edge-on to the lens and gone from the frame |
| `DRAW_T`, `SHEATHE_T`, `ARM_HOLD` | 0.2 s, 0.35 s, 3 s | (ours), the lead's 0.2 and 3 s | the trident rides on his back out of a fight: to hand on a blow, a parry or a power, back after this long with no blow |
| `SLOT_WAY`, `SLOT_AT` | up over the right shoulder, 22 cm off his back | (ours) | where it rides, fixed to the chest, in the rest pose |
| `WEDGE` | 0.31 m | (ours), over A1's 0.30 | where a floor and a solid squeeze him, their pushes cancel and a sweep reads free: his centre never gets closer than this to a solid |
| `SKIN` | 2 cm | (ours) | collide and slide steps this far off a surface before its next leg, so a slide along the sea floor isn't stopped by still touching it |
| `SURF_RIDE`, `SURF_TOP`, `SURF_OFF` | 14, 26, 6 m/s | (ours), `SURF_TOP` is M10c's 26 | the ride's speed, boosted speed, and the speed under which the sea lets him go |
| `SURF_TURN` | 2.2 rad/s | (ours) | full stick's carve, down to 60 % of it at the top speed. The look steers a ride too: the wish, stick and look together, is what he carves toward |
| `SURF_STORM`, `SWELL_STORM` | 20 m/s, × 1.7 | (ours) | in the storm the waves carry him: this speed with no boost, a swell this much higher (M10f) |
| `SURF_SWELL` | 0.75 m | (ours) | the swell under him: enough to read as a wave on the phone |
| `SURF_START` | 9 m/s | (ours) | boost along the surface over this for 0.2 s puts him up on a swell |
| `SURF_SHALLOW` | -1.0 m | (ours) | ground this close to the sea ends the ride on the beach |
| Crawl | `126_02` frames 180-254, 74 frames at 30 Hz, a stroke of each arm | CMU, read by how the motion repeats (the sharpest repeat, 14° a bone, is at 74) | the left wrist's markers are lost in this take, so the left arm is the right arm's capture, mirrored, half a cycle later. A hand turns at most 70° about its forearm. It plays at 0.9 + v / 8 times as run: a 1.3 s cycle at cruise, the most the arm's 779°/s allows under M12a |
| Strokes | tread under 0.8 m/s (out at 1.3), crawl, long kick from 12 m/s (back at 10.5) | (ours) | a crawl's arm can be half a turn from the tread's or the long kick's, and a blend across that whips the arm round at 5,800°/s. Each change of stroke is a switch through the inertial blend |
| Tread | `m_idle_neutral_01` above the hips; arms out 21° and forward 16°, elbows 34°, a 15° scull three times in five seconds; legs a slow pedal | Rocketbox (MIT) and (ours) | no take has a tread: the upper body is a real man at rest, floated |
| Tidepulse's beat | each arm stroke, two to the cycle | (ours) | it was one wrap of the old kick |
| `TIDE_TIERS` | 15.5, 20, 25 m/s | (ours) | Tidepulse's tiers; the first is `BOOST`; all under super, which stays a release. Each tier: more bubbles, a lens 0.1 m lower, an arm 0.25 m longer, 1.5° more field (M15d) |
| `TIDE_WINDOW`, `TIDE_HOLD` | 0.14 s, 1.8 s | (ours) | how far from a kick a press still counts, and how long a tier lasts unrenewed |
| `HOLD_SHARE`, `HOLD_RATE` | 55 % of the half frame, 4 rad/s | (ours) | in a fight the look turns toward a target further off centre than this: M13e |
| `FACE_RATE` | 12.5 rad/s, 716°/s | (ours), M14e's 720 | what his drawn facing turns at most, whatever sets it |
| `CAM_R` | 0.55 m | (ours) | the lens's collide radius: more than twice the near plane (QS-A5) |
| `ROOM`, `AVOID` | 2.6 m, twenty-six turns | (ours) | an arm shorter than this and the arm swings round what's behind him, the smallest turn first: to the open side, over him, under a low roof, right round if it must; nowhere has room, and it takes the longest there is (QS-A5a, J3) |
| Over the shoulder | 0.6 m, 0.35 m in a fight, gone by 12 m/s | (ours) | at speed the lens trails along his own path, which he has just proved clear; off to the side it runs into the trees he passes (J5) |
| `ARM_R` | 0.25 m | (ours) | the arm's own thickness. What stops it is something on the line from his chest to the lens, not a trunk he's running past; the lens's own clearance is `CAM_R`, at its end (J5) |
| `MIN_ARM`, `CUT_ARM` | 1.7, 1.2 m | (ours), about J3's 1.5 | an arm under `MIN_ARM` comes out and swings at the quick rate, 4 Hz; under `CUT_ARM` the lens is on his chest, and it cuts to where it can stand |
| `RIDE_ARM`, `RIDE_LIFT` | 9.5 m, 2.4 m | (ours) | on a whale the look follows it, from over its back: at 13 m he was under M13d's 60 px on a phone, and its body hid him |
| `KEEP` | 80 % of the half frame | (ours) | his chest stays inside this, whatever a lock or a swing asks: the look turns back (J3) |
| `BAND` | 0.3 m | (ours), over J4's 0.25 | the lens is never this close to the water: it goes through in a frame (J4) |
| `DUST`, `GHOSTS_PHONE`, `GHOSTS_DESK` | 44, 2, 3 | (ours) | the wake's caps: one draw for the dust, one a ghost |
| `OUTFITS`, `FORMS` | suit and bronze tints, trident tint and glow | (ours), set by eye | ids from `web/data/gear.json`; tints in the Warden's own shader, so a change adds no file and no program |
| `LEVEL_CRUISE`, `LEVEL_BOOST`, `LEVEL_HOLD` | +15 % cruise, +12 % boost, 0.75 → 0.45 s | (ours), missions' numbers | what each level of Speed buys, as `web/data/upgrades.json` names them: cruise faster, boost faster, super speed sooner |

## The jump (`formulas/jump.js`: height and time choose gravity and speed [Pittman16])

| Name | Value | Kind | Why |
|---|---|---|---|
| Full jump | 2.4 m in 0.40 s → g 30 m/s², v 12 m/s | (ours), method [Pittman16] | superhuman but with weight; one gravity for every jump, so the air always feels the same |
| `CUT` | gravity × 2.8 while rising | (ours) | a tap gives about a metre |
| `V_DOUBLE` | 2.0 m more | (ours) | |
| `V_LEAP` | 8.5 m | (ours) | the superhero leap, M5h's 7 m and more |
| `JUMP_PREP` | 4 frames, 67 ms | (ours) | long enough to read, inside the 0.10 s of M5c. Celeste's jump has no wind-up at all [CelesteSrc] |
| `COYOTE` | 120 ms | (ours), near the published 0.1 s [CelesteSrc] [Thorson] | |
| `BUFFER` | 150 ms | (ours) | no published length (STANDARDS) |
| Landing | under 1.6 m: the knees · 1.6-6 m: and dust · over 6 m: the superhero landing, free at `stands` | (ours) | M5g |
| `BRAKE`, `HIPS_EASE` | 105, 45 m/s² | (ours) | together under M5g's 150: the drawn hips stop at `BRAKE`, so from a long fall they start just before the feet touch, and a pose's change of hip height adds no more than `HIPS_EASE`. The rules' height isn't touched |
| depth of a landing | 2.5 cm per m/s over 1, 3 to 60 cm | (ours) | grows with the fall (M5g); recovery follower 2.2 → 1.3 Hz with it |
| Legs in a hard landing | up to 76 % of straight, by the impact from 3 to 9 m/s; `HOVER_OUT` 1.5 m/s | (ours) | while the hips brake, a foot stays this close under him until the ground comes to it, then settles the last of the way at `HOVER_OUT`: a near-straight leg is the one that spins fastest (M3) |

## Followers (`formulas/follow.js`), each at f Hz, damping z, response r, all (ours)

| Follower | f | z | r | cap | |
|---|---|---|---|---|---|
| Drawn heading | 3.2 | 1 | 1 | 120 rad/s² | whatever sets a facing, the body never snaps |
| The sim's heading | 2.2 | 1 | 0 | | follows the goal; critical, so it lands (M4f). A cap here once made it weave: a cap on the follower of a rate is a cap on jerk |
| Ground under the root | 4.5 | 1 | 2 | 90 m/s² | no lag on a steady slope, no jitter over the terrain's 2.5 m creases |
| Hips drop to reach | 7 | 1 | 2 | | |
| Locomotion weights | 1.5 | 1 | 0 | | clip weights move with this, never with raw speed |
| Lean forward, into a turn | 2.2, 2.0 | 0.75, 0.8 | 0.4 | | |
| Mantle swing | 1.5, 1.4 | 0.75, 0.7 | 0 | | slow; damped so it doesn't flare (he saw it) |

Mantle and hair hang along what pulls on them, read in his chest's frame: gravity in the air, none in the water, plus his motion at up to 1.6 × gravity by 12 m/s (ours). So a body thrown forward at a sprint is already most of the way there, and the cloth can't stand over his head.

## The switch: inertialization [Bollo18] [Holden21b]

| Name | Value | Kind | Why |
|---|---|---|---|
| blend time | 0.10-0.30 s by what changed, longer for a bigger offset | (ours) | |
| `SWITCH_RATE` | 10.5 rad/s (600°/s) | (ours), read against M3m: 7.6 gave 1,554°/s, 8.7 gave 1,516, 10.5 gave 1,467, because a blow's fast part is then past the offset | each joint's offset gets the time it needs to die at this rate, up to 0.6 s. A fixed time pops the joints that happen to be far apart; knee pops are the known fault [Holden23] |
| `FACE_RATE` | 12.5 rad/s, 716°/s | (ours), M14e's 720 | what his drawn facing turns at most, whatever sets it |

## Clips (`Pipeline/hero/moves.py`, Python, 30 fps)

Keys are poses at times, solved by IK; between them Catmull-Rom on the joints' turns, a delay per joint and a spring per joint. Method after `Pipeline/colosseum/anim.py`. `DELAY` (hips first, trident last), `SPRING` (stiff trunk, loose ends): (ours), set by eye. Times in combat's clips are its counts from `reference/fluidity_ref_action_rpg.mp4` [RefClip].

| Name | Value | Kind | Why |
|---|---|---|---|
| `LIMIT`, `LIMIT_BLOW` | 1,150, 2,400°/s | (ours), under M3b's 1,500 and M3c's 2,700 | what no joint passes in a clip; a key pair that asks for more takes it over more frames |
| `limit` on a clip | 820°/s on the two dodges | (ours) | combat plays a dodge 1.29 times as fast and from wherever he was, and a switch adds to it: this keeps the sum under M3b's 1,500 |
| `atk_dash_land` | `atk_dash`'s beats, upright | (ours) | riptide on land: the water clip's flat body over planted legs whipped the knees |
| carries | stand, walk, run, sprint: shaft up, tipped ahead, tipped back, streaming back | (ours) | each within 118° of the next at every joint, so a blend never spins the fist. A quaternion blend across nearly 180° is what spun it |
| `stands`, `takeoff` | 0.52, 0.07 s | (ours) | the frames the rules hand over on |
| `WALK`, `RUN`, `SPRINT` | the clips' own gait: speed, duty, foot places | (ours) | the Reaver's `run` only; the Warden's come from the capture |
| `GAMEPLAY` | forward carry and cancel after each blow | (ours) | older clips; `web/data/combat.json` rules these now |
| hip height in the gait clips | read back from the feet: -0.03, -0.04, -0.11 m on average | the capture's | |
| combat's clips | times from `reference/fluidity_ref_action_rpg.mp4` [RefClip], through `CLIP_REQUESTS.md` | measured by combat | wind-up 0.17-0.23 s, contact as requested, read back into `moves.json` as `contact` and `hit` from each clip's real point |
| windows | hit from the point's speed over 55 % of its peak | (ours), read off each body's own clips | |

## Frame data: how motion flows in the reference

`DESIGN.md §Combat` has the blow timing, measured properly over 22 contacts. What movement adds, counted at 30 fps from `reference/fluidity_ref_action_rpg.mp4`, ±1 frame (±33 ms):

| What | Frames | Seconds | Where |
|---|---|---|---|
| Roll's end → blow lands | 13-14 f | 0.45 | f247 → f261: 8 f run-in, 5 f wind-up, no rest between them |
| Heavy blow's follow-through, held and easing | 14-16 f | 0.5 | f125-139, f388-403: the pose keeps moving slowly, so it reads as weight and not a stop |
| From a held follow-through to running | at most 8 f | 0.27 | f404-412 |
| Longest stretch of low motion during a fight | 4 f | 0.13 | f66-69, f536-539, f541-544 by frame difference (median of the clip × 0.45); a deliberate skill wind-up runs 8-12 f |
| Standing still | only when the fight is over | | f585 on |

What it teaches movement: nothing ends in a stand. Every action hands on to the next, and the only true pauses are chosen ones. So landings, stops and blows on land must be cancellable early, with the legs still in stride.

## The look's choices (owner: look)

- **Leaf cards on trees, a stated departure from `REFERENCES.md` §f2 step 1 ("no alpha cards"):** the oak canopies read as flat plates, so each tree carries clumps turned to the eye (150 on phone), cut by a painted mask, lit by a round canopy normal. 300 triangles a tree on phone. The lead approved the result over the rule. (ours)
- **Cloud panorama:** one 4096 x 800 painting that holds light on the form in red and coverage in alpha; colours come from the look's table, so day and sunset share it (§f2 step 4; a separate rim channel was not needed).
- **Ramp, band grade, brush:** three tones, nine bands at 24% mix, brush break-up within 44 m (fades in from 44 m to 16 m). All (ours), set by eye beside `reference/`.
- **Lens:** the lens is drawn as glass 0.95 m out so a crossing fills the frame for a beat. (ours)
- **Near-field colour:** below the surface a stone within about 7 m keeps its colour (`ocNearFill`). (ours)
- **The day:** 14 minutes on one clock in `sky.js`. Each look has a table for day, dusk, night and storm, and the clock blends them. Sun and moon move on the dome, but the baked sun maps keep one direction, so shadows change in strength and colour, not angle. Rebaking two maps as the sun moves would cost more than a 14-minute day shows. (ours)
- **A small figure:** under about 120 CSS px tall a figure goes dark with a pale line round it, in either look, so nothing has to guess what's behind it. A dark shape reads on bright water and the pale line on dark. Above that size only the Painted look draws a line. (ours, for L6)

# §Missions (owner: missions)

Every number here is (ours): chosen by eye on a 390 x 844 phone and tuned against the bot's walls (`web_check/g_story.mjs`, `g_side.mjs`, `g_events.mjs`), never measured from another game.

| Where | What it holds | Kind | How it was set |
|---|---|---|---|
| `challenges.json (ours)` | Rings in a run, ring sizes, wave counts | (ours) | Long enough to feel like a run, and the bot finishes each with time to spare |
| `cinematics.json (ours)` | Shot lengths, orbit angles, radii, heights, field of view | (ours) | Bells run under 4 s and boss arrivals 3 s so play isn't held long; the opening is two 24 s swings that keep the Warden readable behind the title |
| `codex.json (ours)` | `near`, how close he swims to log a species | (ours) | Close enough to mean he went to look |
| `events.json (ours)` | `first` 120 s, `gap` 140 to 180 s start to start, each event's length, cooldown and pay | (ours) | `gap` is G10b's "an omen every 2-3 minutes"; the rest is read from `g_events.mjs`'s printed gaps |
| `missions.json (ours)` | `bells`, `story`, `side`, `fixtures`: radii, offsets, counts, rewards, timers | (ours) | Each chapter under 480 s an objective for the bot (G1), pay set so `g_data.mjs` G6s holds: every source has a sink |
| `people.json (ours)` | `people`, `extra`: where each person stands, the children's 0.76 scale | (ours) | By eye |
| `relics.json (ours)` | Tablet offsets from their places | (ours) | Off the main route, so a tablet is found by looking |
| `upgrades.json (ours)` | `cost`: 5, 11, 19 pearls and a tablet for the third level | (ours) | P9c: 15 tracks cost 525 pearls against 468 to find once, 112%, so a player chooses until events and runs have paid more |
| `FOG_N` | 128 cells across the map's fog (`quest.js`) | (ours) | 16 m a cell on the 2,048 m map; one bit a cell keeps the save small |
| `SIZE` | 512 px, the chart (`map.js`) | (ours) | 4 m a pixel on the 2,048 m map: sharp at the map's middle zoom on a phone |
| `CAP` | 32 of each mission thing in a bank (`things.js`) | (ours) | More than any objective lays at once |
| `CELL` | 16 m, the bot's route grid (`botnav.js`) | (ours) | Coarse enough to search in under a millisecond, fine enough for the gaps the map has |
| `SETTINGS` | Default music, sound and camera speed, all 1 (`ui.js`) | (ours) | The middle of each range |
| `keepClear` | Radius 0.55 m, a cinematic camera's clearance (`cine.js`) | (ours) | Over twice the near plane |
