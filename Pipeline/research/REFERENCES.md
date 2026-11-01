# References for the ocean-hero game (working title Thalor)

Research only, written 31 Oct 2026. Nothing here ships: keep it out of `web/`. DC names and studio names appear only to say what we learned and what to stay away from. Everything in the game, its listing and its files follows `EPIC.md` §1.6.

**Tags.** No tag: read at the source. `[feed]`: Reddit post title or first 500 characters, through `reddit_top.py`. `[snippet]`: seen only in a search result, page not read, so treat as not verified. `(ours)`: our proposal, no outside source. `(physics)`, `(derived)`: follows from physics, or computed from another value in the row. Every invented name is a proposal and has not been through the name check (EPIC S2).

**How far to trust this.** Reddit comments could not be read: WebFetch refuses reddit.com, so every Reddit item is a title or the opening of a post. None of the 460 top posts read talks about an Aquaman game. The fan ranking rests on one 15-post ResetEra thread, a few articles and those Reddit posts. It is a judgment, not a survey. Pages that refused automated reading were left alone and are listed in (e).

---

## (a) What to build, ranked by how much fans care

**What fans say makes the character cool:** he is far stronger than his joke reputation ("I think Aquaman has one of the worst PRs", [r/Aquaman](https://www.reddit.com/r/Aquaman/comments/1oy8md5/how_strong_do_you_think_aquaman_should_be/), 16 Nov 2025 `[feed]`), he talks to the whole sea, his trident does everything, and he belongs to two worlds. So the Warden must look strong in the first minute.

1. **Swimming that is a joy in itself.** The first thing fans ask for and the main failure of the 2003 game. Build **Tidepulse** (extends M12).
2. **A full, living ocean worth leaving the city for.** Already W1-W8 and W15. Hold it to density, because an empty sea is the second failure. Subnautica 2's sales show the audience is real ([IGN via r/gaming](https://www.reddit.com/r/gaming/comments/1tpyfs3/subnautica_2_has_sold_so_well_that_krafton_has_to/), 28 May 2026 `[feed]`).
3. **Sea life as a power used all the time.** Fans' own words: "Superman+Pikmin." P5 is only a summon. Build **Shoalsong** (new).
4. **The trident as a real weapon.** Build **Homeward Cast**, throw and call back (new, adds to P4).
5. **Dread in the deep dark.** The most praised set piece of the 2018 film. Build **Vigil Light** (new, for W5 and G1 chapter 6).
6. **Rival sea peoples with something at stake.** Build **the Six Holds** and **Bell Claim** (adds to G1, G2).
7. **Both worlds.** Fans push back on a game that is only underwater. Already M5, M9, W9, T1-T4; add **High Breach** and make Sunward Hollow matter.
8. **Power that keeps growing.** P9, plus the **Storm Bell** (new).
9. **Bosses that are places, not big health bars.** P7, with **Spine Climb** rules.
10. **A bonded mount.** M11, as **Wakebond**.
11. **Surf and ice.** These are the owner's asks, not fans'. Fan evidence names water, storms and electricity, and I found none for surfing or ice. Do them anyway, because they set us apart: **Crestline** (M10) and the Ice Path rules (P2, P3).

**Changes this research asks of EPIC:**
- Add requirements for Tidepulse, Shoalsong, Homeward Cast, Vigil Light and Omens.
- Rename W5. "The Trench" is DC's proper name for its deep-sea monster kingdom ([Wikipedia](https://en.wikipedia.org/wiki/The_Trench_(comics))), and §1.6 bans it. Proposal: **the Vesper Deep**.
- M5 says "real anticipation". Celeste's `Jump()` sets full speed at once, with no wind-up ((d)). Any crouch must not delay the takeoff.

---

## (b) Desire or lesson, evidence, our original design

### b1. The fantasy beats

| Fan desire | Evidence | Our original design | EPIC |
|---|---|---|---|
| Swimming as fun as the best traversal | ResetEra's opening pitch wants swimming as enjoyable as web-slinging ([thread](https://www.resetera.com/threads/pitch-your-dream-aquaman-game.231343/), 19 Jun 2020). Abzû's boost comes in escalating levels with a rhythm, and "one-frame pops are sort of our enemy" ([Game Developer](https://www.gamedeveloper.com/design/-i-abzu-i-and-the-challenge-of-conveying-emotions-through-game-design), 2 Aug 2016). Only 38% of players earned Spider-Man's five-fast-travels trophy ([r/truegaming](https://www.reddit.com/r/truegaming/comments/1ti17a2/respecting_the_players_time_and_how_marvels/), 19 May 2026 `[feed]`). | **Tidepulse.** Boost is a beat. Press in time with the kick and speed steps up one of three tiers, with a bigger wake, a lower pitch and a wider camera. A missed beat holds the tier and never stalls you. Holding boost still gives tier 1, so a phone player is never locked out. No stamina on plain swimming. | M12, new |
| Leaping out of the ocean | Zora Link can "jump out at high speeds, much like a dolphin" ([Destructoid](https://destructoid.com/?p=82790) `[snippet]`). | **High Breach.** Leaving the water at tier 2 or 3 keeps all speed and adds lift (ours), and the air pays off: throw, plunge strike, ring pickups, clearing a ship's deck. | M9, T2, new |
| Commanding sea life | "Superman+Pikmin." and "Underwater Pikmin but with fish instead of Pikmin." ([thread](https://www.resetera.com/threads/pitch-your-dream-aquaman-game.231343/)). "He's one of the best telepaths in the DC verse" ([r/Aquaman](https://www.reddit.com/r/Aquaman/comments/1oy8md5/how_strong_do_you_think_aquaman_should_be/) `[feed]`). In 2003 the summon medals were unreliable ([Game Hoard](https://thegamehoard.com/2019/12/02/aquaman-battle-for-atlantis-gamecube), 2 Dec 2019). | **Shoalsong.** Hold to hum: a ring spreads and the creatures it touches follow for about 20 s (ours). Each kind has one job: a school is a moving shield, rays light the dark, turtles lift you, sharks hunt what you mark, a whale breaks armour. The world's own schools are the army, so W15 pays twice. Some kind must always be in reach (ours). P5's summons become its top tier. | P5, new |
| The trident as a real weapon | "his trident can allow him to do all kinds of crazy stuff" ([r/Aquaman](https://www.reddit.com/r/Aquaman/comments/1oy8md5/how_strong_do_you_think_aquaman_should_be/) `[feed]`). "Arkham but under sea" ([thread](https://www.resetera.com/threads/pitch-your-dream-aquaman-game.231343/)). God of War's recall rules ([Napoli](https://www.gamedeveloper.com/design/recalling-the-leviathan-axe), 8 May 2018). | **Homeward Cast**, with the trident **Saltfang**. Throw it, then call it back from anywhere. Curved return that is easy to see, bends through enemies, hits on the way back, 0.1 s pre-move, arrives within 1.5 s, the catch never locks the player, sound attached to the weapon. | P4, new |
| Dread in the deep | CinemaBlend and The Ringer single out the film's descent ("legitimately terrifying and beautiful", [Ringer](https://www.theringer.com/2018/12/24/movies/aquaman-exit-survey) `[snippet]`). Kotaku wants "the mysteries and horrors stalking the waters below" ([Kotaku](https://kotaku.com/it-might-finally-be-time-for-a-new-aquaman-game-1820578574), 18 Nov 2017). | **Vigil Light** in **the Vesper Deep.** Below a line the only light is the trident's pulse. Each pulse shows the swarm, **the Gloam**, for about 2 s (ours), and they flinch from it. The fear is how many there are. A bell strike clears them. Not the film's scene: no flare, no red light, no fall through a column of monsters. | W5, G1, new |
| Rival peoples and a stake | "a lost relic that would give them massive leverage"; another poster pitches a diplomacy game ([thread](https://www.resetera.com/threads/pitch-your-dream-aquaman-game.231343/)). | **The Six Holds** (b2) and **Bell Claim.** Each Hold wants the Tide Bells rung its way. What you do for them decides who stands with you at the Sunken Arena. No throne, no heir, no brother. | G1, G2 |
| Both worlds | "imagining a game that would be mostly underwater levels just feels wrong" ([thread](https://www.resetera.com/threads/pitch-your-dream-aquaman-game.231343/)). Missions "set both underwater and above ground" ([WhatCulture](https://whatculture.com/gaming/10-comic-characters-still-waiting-video-game-justice), 28 Feb 2014). "a man of both worlds" ([r/Aquaman](https://www.reddit.com/r/Aquaman/comments/1j4d54r/whats_your_opinion_on_the_geoff_johns_run/), 5 Mar 2025 `[feed]`). Fans also love the hero's home town ([r/Aquaman](https://www.reddit.com/r/Aquaman/comments/1va6vcx/does_anyone_else_love_amnesty_bay/), 29 Jul 2026 `[feed]`). | **Sunward Hollow** is the human anchor: people who know the Warden, and it recovers as the sea does (Haul and Hearth, b3). About 60-70% of play in water (ours): the film is two-thirds underwater ([CinemaBlend](https://cinemablend.com/news/2435330/how-much-of-the-aquaman-movie-actually-takes-place-underwater) `[snippet]`) and Black Flag is 60% land, 40% sea ([GamesBeat](https://gamesbeat.com/ubisoft-40-percent-of-assassins-creed-iv-is-naval-missions/) `[snippet]`). | W9, T1-T4 |
| Power that keeps growing | "to see how powerful I can make Aquaman until an editor says stop" ([r/Aquaman](https://www.reddit.com/r/Aquaman/comments/1uktr1v/adams_stated_goal_is_to_see_how_powerful_i_can/), 1 Jul 2026 `[feed]`). | The first minute shows strength. Late in the game the **Storm Bell** lets the player start Storm Surge by hand at a shrine. | P9, G5, new |
| A mount you bond with | The pitch asks for mounts ([thread](https://www.resetera.com/threads/pitch-your-dream-aquaman-game.231343/)). "my favorite use of the Ikran" is fighting from the air ([One More Game](https://onemoregame.ph/avatar-frontiers-of-pandora-pc-review/), 6 Dec 2023). | **Wakebond.** Earn one whale by healing it (G3's wounded whale). Your call brings it anywhere, even mid-leap, and it fights under you. Never a seahorse. | M11, G3 |
| Powers outside fights | "seeing mundane uses for their powers" ([r/truegaming](https://www.reddit.com/r/truegaming/comments/1rvc813/utility_magic_thats_useful_outside_of_combat/), 16 Mar 2026 `[feed]`). A grapple, a parry and fishing are one post's "Four Pillars" ([r/gamedesign](https://www.reddit.com/r/gamedesign/comments/1rlr8ow/the_four_pillars_of_game_design/), 5 Mar 2026 `[feed]`). | **Odd Jobs.** Each power solves one job in the village or reef: Geyser refloats a boat, Water Whip hauls a net, Ice Path bridges a gap. Add **pier fishing** at Sunward Hollow; the owner's own reference frame shows it. | G3 |

### b2. How the undersea world is built, as generic patterns

The film counts seven kingdoms and shows six; only three survive in the comics ([Den of Geek](https://www.denofgeek.com/us/movies/aquaman/278207/aquaman-what-are-the-seven-kingdoms-of-atlantis), 17 Dec 2018). The comics list many rival cities over decades ([Wikipedia](https://en.wikipedia.org/wiki/Atlantis_(DC_Comics))). Don't copy the count.

| Pattern | Evidence | Our version |
|---|---|---|
| Each people is one animal motif, one depth band and one temperament, stacked from civilised near the light to instinct at the bottom | Scholars with fish traits, hermits with crustacean traits on the sea floor, monsters that act on instinct ([Den of Geek](https://www.denofgeek.com/us/movies/aquaman/278207/aquaman-what-are-the-seven-kingdoms-of-atlantis)) | **The Six Holds**, table below |
| Environment follows the people | "if this was real, how would people really live there?" ([Brzeski](https://discussingfilm.net/2020/08/22/bill-brzeski-on-creating-the-world-of-aquaman-and-sequel-hopes-exclusive-interview/), 22 Aug 2020) | Each Hold's kit (W13) comes from how it lives |
| Swimmers build for three dimensions: doors top and bottom "It's like being in zero gravity", so "doors are on the top, on the bottom" ([Nerdist](https://nerdist.com/article/aquaman-atlantis-look-dc-comics/), 17 Jul 2018) | **Meridon**, built underwater, has roof doors and no stairs. **Thalor**, built on land before it drowned, keeps stairs and street doors. The buildings tell the story |
| A classical base grown over with coral | Greek design that became organic, like living coral ([Brzeski](https://discussingfilm.net/2020/08/22/bill-brzeski-on-creating-the-world-of-aquaman-and-sequel-hopes-exclusive-interview/)) | Our own order: spiral-fluted columns with shell capitals, reef growing up one side only |
| A city reads through pockets of light | "making sure that there were pockets of light and pockets of darkness" across 7,300 buildings ([fxguide](https://www.fxguide.com/?p=245015), 24 Jan 2019) | Meridon's lamps come in clusters with dark blocks between, and the lit squares lead the eye to the centre |
| Bend optics so the action stays readable | Red falloff stretched over long distances; "the audience sees kilometers into the deep ocean"; his eyes adapt as the story's excuse ([fxguide](https://www.fxguide.com/?p=245015)) | **Deepsight.** Colour within about 40 m of the hero (ours) stays near true, then falls off. The Warden's eyes are the reason, a small beat in chapter 1 |
| One warm source in a blue world | Lava kept visible to add reds and warm pools ([fxguide](https://www.fxguide.com/?p=245015)) | Cindermere's glow, Meridon's gold, and one warm accent in every blue frame (ours) |
| Craft move like animals | "the vehicle's movement inspired by elements of how fish move" ([fxguide](https://www.fxguide.com/?p=245015)) | Reaver skiffs flex tail-first and bank like rays |
| Busy lanes prove a living city | 150,000 ships in Atlantis's traffic lanes ([Wikipedia](https://en.wikipedia.org/wiki/Aquaman_(film))) | Instanced ghost lights flowing along Meridon's current lines (W4) |
| Lost cities give mystery a place | A desert colony and a city under Antarctic ice ([film](https://en.wikipedia.org/wiki/Aquaman_(film)), [sequel](https://en.wikipedia.org/wiki/Aquaman_and_the_Lost_Kingdom)) | Thalor is ours. Nothing frozen and undead at Rimehold: see (c) |

**The Six Holds** (ours), on EPIC's places:

| Hold | Depth | People | Emblem | Travel | Far tell |
|---|---|---|---|---|---|
| Thalor (W3) | Mid | Empty; the Warden's lost order | Old sea turtle | Dead current lanes that wake with each bell | The Colossus |
| Meridon (W4) | Upper | Proud tide-scholars | Nautilus | Lamp barges on current lines | Gold domes |
| Vesper (W5) | Deep | Secretive lantern-keepers | Anglerfish | Cable cars down the cliff | Cold cyan glow |
| Cindermere (W6) | Vents | Smiths who trade in oaths | Ember eel | Heat chimneys | Red glow, ash snow |
| Rimehold (W7) | Under ice | Hermits who keep the ice | Narwhal | Seal-drawn sledges | Light through the ice |
| Wrackreach (W8) | Surface wrecks | Scavengers and lost sailors | Moray | Patched hulks | Ghost lanterns in fog |

### b3. What the best ocean and traversal games teach

| Topic | Lesson and evidence | Our design |
|---|---|---|
| Swim feel | Subnautica's water is the foundation, not an obstacle, "fast wie Fliegen", almost like flying ([MeinMMO](https://mein-mmo.de/en/why-do-many-players-love-subnautica-2-even-though-everyone-hates-underwater-levels,1569136/), 26 May 2026). Abzû adds flips with no gameplay purpose, and the diver sways at rest ([Game Developer](https://www.gamedeveloper.com/design/-i-abzu-i-and-the-challenge-of-conveying-emotions-through-game-design)). The film's hero moves little and speed reads from bursts around him ([fxguide](https://www.fxguide.com/?p=245015)). | Water is the fastest place in the game. A free barrel roll on a flick, for joy alone. At top speed the body stays calm, and the wake, bubbles and camera carry the speed (matches M6). |
| Movement forgiveness | Spider-Man cheats physics: the arc adjusts to keep you moving forward, the web shortens near the ground, a wall starts a wall-run instead of a crash ([Costiuc](https://www.gamedeveloper.com/design/marvel-s-spider-man-design-analysis), 29 Oct 2018). One button to start, optional depth above it ([NME](https://www.nme.com/features/how-the-web-swinging-of-marvels-spider-man-makes-its-superhero-fantasy-soar-3287136), 10 Aug 2022). Prototype's dash can "hop over cars and small obstacles, run up walls" ([Worthplaying](https://www.worthplaying.com/article/2009/9/4/reviews/68112-pc-review-prototype/), 4 Sep 2009). | **Glance.** Touching rock at speed slides along it, never a stop. Near the seabed the path levels by itself. Super sprint hops low obstacles without a button press (ours). |
| Camera | Maneater fights had you "fighting to reposition the camera" and the lock-on "isn't very helpful" ([JDR](https://www.jumpdashroll.com/article/maneater-review), 2 Jun 2020). Black Flag's bell dives were called "a nightmare" for camera and steering in one user review ([GameSpot](https://www.gamespot.com/assassins-creed-iv-black-flag/user-reviews/2200-12586921/) `[snippet]`). | **Threat Ring.** Arcs at the screen's edge show attackers from behind, above and below, tied to P8's telegraphs. Fights frame the enemy without the player steering the camera (M13). |
| Biomes | Subnautica's materials, creatures and structures make its areas places to linger, not just cross ([MeinMMO](https://mein-mmo.de/en/why-do-many-players-love-subnautica-2-even-though-everyone-hates-underwater-levels,1569136/)). It ties progress to capability as well as depth ([analysis](https://feedme.design/designing-with-depth-how-subnautica-turns-the-ocean-into-its-greatest-threat) `[snippet]`). | Gates are visible and physical, never invisible walls: **Pressure Seals** glow and push you back gently until the right power is earned. |
| World events | Rare cares about "the frequency of encounters" more than map size, about one every 15-30 minutes on its large sea ([TweakTown](https://www.tweaktown.com/news/60911/sea-thieves-map-15-30-minute-ship-encounters/index.html) `[snippet]`). A sail on the horizon is the surprise ([Game Developer](https://www.gamedeveloper.com/design/how-emotional-psychology-and-the-goonies-inspired-i-sea-of-thieves-i-), 16 Jun 2016). | **Omens.** Every G5 event shows from far away first: a gyre of birds, a storm column, a glowing wake, a falling star. On a 2 km map, one every 2-3 minutes (ours). |
| Collectibles | Endless Ocean Luminous: the grind of repetitive scanning; 23% of critics recommend it ([OpenCritic](https://opencritic.com/game/16419/-) `[snippet]`). | The codex (G6) is a by-product of play and it pays: every species logged teaches Shoalsong something. Lore tablets sit where the view is already worth the trip. |
| Missions and loop | Dave the Diver's two halves feed each other: dive by day, serve by night, money buys better dives ([Xbox Wire](https://news.xbox.com/en-us/2025/11/20/dave-the-diver-xbox/) `[snippet]`). But "the game doesn't trust you to enjoy those core elements enough" ([r/patientgamers](https://www.reddit.com/r/patientgamers/comments/1p196sx/dave_the_diver_gets_in_its_own_way/), 19 Nov 2025 `[feed]`). | **Haul and Hearth.** What you bring up restores the Hollow: boats return, stalls open, lamps relight, people change what they say. Keep the system count low. |
| Bosses | The Colossus designs were tied to how each is beaten, so they had to be built and tested to know they worked ([developers](https://glitterberri.com/extended-developer-interview/the-graphic-designers-tell-it-straight/) `[snippet]`). Sea of Thieves's Kraken strikes on open water, not in a scripted arena ([Windows Central](https://www.windowscentral.com/sea-of-thieves-kraken) `[snippet]`). | **Spine Climb.** Each boss has a verb: freeze the Kraken's arms and sever them, ride the Leviathan's back to reach a wound, shatter the Cinder Colossus's crust. Block out the fight and test it before modelling. |
| Surf | Wave Race made the water the star; reviewers praise "great water physics" ([Nintendo Life](https://www.nintendolife.com/reviews/n64/wave-race-64) `[snippet]`). Genshin's shark surf works in fights and exploration, but one guide calls it clunky ([KQM](https://keqingmains.com/q/mualani-quickguide/) `[snippet]`). | **Crestline.** He rides the sea's real wave function, the one `sky.js` draws, so what you see is what you ride. Carving down a face gains speed, and a jump at the crest launches. |
| Ice paths | Zelda's Cryonis needs existing water and allows three pillars; a fourth breaks the first ([Zelda Dungeon](https://www.zeldadungeon.net/wiki/Cryonis) `[snippet]`). Infamous 2's Ice Launch raises a pillar to leap from ([wiki](https://infamous.fandom.com/wiki/File:Infamousdinnerwithsasha_13.jpg) `[snippet]`). | Ice Path keeps P3's 8 s, cracks visibly before it goes, and only forms on water. **Frostlift:** an ice pillar throws him up, the ice stance's answer to High Breach. |
| Water powers | Korra's bending divided reviewers: fluid to some, "too stilted" to [Shacknews](https://www.shacknews.com/article/86918/the-legend-of-korra-review-chi-blocked) `[snippet]`. GameVortex wanted depth such as enemy weaknesses ([review](https://gamevortex.com/gamevortex/soft_rev.php/6229) `[snippet]`). | P3 and P6 already answer this. Water must read as weight and flow on the hit frame (P11, L5). |
| Onboarding | Testers with no instructions were sailing within five minutes, because players bring pirate expectations; mechanics are "believable, but not realistic" ([Game Developer](https://www.gamedeveloper.com/design/how-emotional-psychology-and-the-goonies-inspired-i-sea-of-thieves-i-)). | Lean on what everyone expects of a sea hero. Teach through the first swim (G8). |

---

## (c) What to avoid

| Avoid | Evidence | Instead |
|---|---|---|
| Water as a penalty | Slow movement, restricted tools and air timers are the usual complaints ([Witness](https://uliwitness.github.io/why-underwater-levels-suck-so-often), 26 Nov 2023). | Water is the fastest, freest state. No air timer. |
| Flight with fins | "Most of the game is just swimming in a straight line" ([DJCube](https://djcube.co.uk/aquaman-battle-for-atlantis/)). Swimming was superhero flight with leg kicks ([Game Hoard](https://thegamehoard.com/2019/12/02/aquaman-battle-for-atlantis-gamecube)). Scores: 27/100 and 26/100 ([Wikipedia](https://en.wikipedia.org/wiki/Aquaman:_Battle_for_Atlantis)). | Currents, wakes, breaches, Glance, reasons to change depth. |
| Flat combat | Fights locked into a near-2D lane, and punches "incredibly dull and rigid when executed"; off-screen foes hit freely ([Game Hoard](https://thegamehoard.com/2019/12/02/aquaman-battle-for-atlantis-gamecube)). "mashing a button to fight" ([WhatCulture](https://whatculture.com/gaming/10-comic-characters-still-waiting-video-game-justice)). Maneater repeats the problem ([JDR](https://www.jumpdashroll.com/article/maneater-review)). | Full 3D, Threat Ring, one counter per enemy (P6). |
| Bosses as bigger enemies | The final boss "feels like a regular enemy with a bigger health bar" ([DJCube](https://djcube.co.uk/aquaman-battle-for-atlantis/)). Eleven enemy types, mostly reskins ([Game Hoard](https://thegamehoard.com/2019/12/02/aquaman-battle-for-atlantis-gamecube)). | Spine Climb. |
| An empty, boxy city | The city had "boxy buildings" ([Game Hoard](https://thegamehoard.com/2019/12/02/aquaman-battle-for-atlantis-gamecube)). "nothing interesting to look at", and no sea life ([DJCube](https://djcube.co.uk/aquaman-battle-for-atlantis/)). | W13, W15, pockets of light. |
| Forced vehicle levels | Four submarine levels with unclear objectives and off-screen damage ([Game Hoard](https://thegamehoard.com/2019/12/02/aquaman-battle-for-atlantis-gamecube)). | The hero stays the vehicle. Mounts are always optional. |
| A drunk camera | "borderline drunk at times", and it clips through walls ([Game Hoard](https://thegamehoard.com/2019/12/02/aquaman-battle-for-atlantis-gamecube)). | M13. |
| Invisible walls | "underwater and full of invisible walls" ([TCRF](https://new.tcrf.net/Aquaman:_Battle_for_Atlantis) `[snippet]`). | Pressure Seals. |
| Static story, no introduction | Comic panels with no voice, and no introduction to the hero ([DJCube](https://djcube.co.uk/aquaman-battle-for-atlantis/)). | C1, and teach who he is through play. |
| Repetition | "you'll be playing the same missions over and over again" ([JDR](https://www.jumpdashroll.com/article/maneater-review)). | Each mission has a new verb or place. |
| Stacking "fun" on the player | "everything around me trying to sell me fun" ([r/patientgamers](https://www.reddit.com/r/patientgamers/comments/1p19q3m/spiderman_2_is_the_video_game_equivalent_of_being/), 19 Nov 2025 `[feed]`). Map clearance as the real loop ([r/patientgamers](https://www.reddit.com/r/patientgamers/comments/1vc0cox/dont_be_misguided_far_cry_and_assassins/), 31 Jul 2026 `[feed]`). | Optional events, few icons, discovery through Omens. |
| A signature move that drops frames | Maneater's corkscrew: "the game becomes framey and seizes up" ([JDR](https://www.jumpdashroll.com/article/maneater-review)). | Test every power at its largest on a phone. |
| Locking the best moves early | Throws locked behind the skill tree limit early play ([Costiuc](https://www.gamedeveloper.com/design/marvel-s-spider-man-design-analysis)). | Give the fun verbs early; upgrades widen them. |
| Murky water | Murky water cuts visibility and contrast ([Witness](https://uliwitness.github.io/why-underwater-levels-suck-so-often)). | Deepsight. |

**Past Aquaman games.** The only full game found is Battle for Atlantis (Lucky Chicken, TDK, 2003). I found no cancelled Aquaman game and no Superfriends-era Aquaman game. TDK signed a long-term deal for several ([Wikipedia](https://en.wikipedia.org/wiki/Aquaman:_Battle_for_Atlantis)), and I found no sequel. That is not proof none was started.

**Never reproduce (DC):**
- Names: Aquaman, Atlantis, Atlan, Xebel, Mera, Orm, Ocean Master, Black Manta, Karathen, Necrus, Kordax, Sunken Citadel, Topo, Kingfish, and the Brine, the Fishermen, the Deserters or the Trench as names of peoples or places.
- Story: a half-human heir of a lighthouse keeper and a sea queen; a half-brother rival; a lost king's trident guarded by a monster; a count of seven kingdoms; a hero leading every sea creature into a final battle.
- Images: a red flare lighting a swarm in a dark descent; seahorse cavalry; crab or fish-headed peoples; an octopus drummer; a black trident; a frozen undead city; a hidden sea at the world's core; a manta-helmeted hunter; the orange-and-green suit.
- W9's lighthouse and G3's relighting are fine as harbour scenery, and the lighthouse is in the owner's reference. It must never be the Warden's home.

---

## (d) Numbers for movement feel

**Struck, 31 Oct 2026.** An earlier version of this section, and lines in (a), (b1), (c) and (e), used numbers read from a Super Mario 64 decompilation and a Sonic 1 disassembly. That broke the clean-room rule in `steal_skill.md` §0, which bars decompiled or disassembled code "in any form, for any purpose". It was this research pass's error. Everything from those two sources is gone: start, stop and turn figures, the pivot trigger, gait thresholds, the clip-rate and lean formulas, jump speeds, heights and windows, the fall cap, water penalties and stroke timing. Don't use a copy of them from an older version of this file. Each idea below now has a public source or is a plain (ours) choice, and a missing number is written as a gap. Set the (ours) values from the target and the test room, not from this pass's author, who read those files.

Each row names its source. Celeste's numbers come from the source file its authors published under the MIT licence, recorded in (e). It runs at 60 Hz in pixels per second, so use its ratios and times; the units don't carry over.

`web/js/hero.js` today has `COYOTE` 0.12 s, `BUFFER` 0.15 s, `JUMP_PREP` 0.067 s and an apex of 2.4 m in 0.4 s. `COYOTE` sits near Celeste's 0.1 s and below GMTK's "usually something like 0.2". I found no public reference for `BUFFER` or the apex. `JUMP_PREP` uses 67 ms of the 100 ms response guideline, where Celeste's `Jump()` has no wind-up.

**On land**

| Item | Number or rule | Source | Use for |
|---|---|---|---|
| Start, 0 to top speed | Celeste 0.09 s (`MaxRun` 90, `RunAccel` 1000) | [Celeste](https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs) | M4. Pick by weight of the hero |
| Stop | Celeste brakes at its start rate. Stopping from full speed in 0.5 s is "most of the time too long" | Celeste, [Pignole](https://gamedeveloper.com/design/platformer-controls-how-to-avoid-limpness-and-rigidity-feelings), 3 Jan 2014 | M4 |
| Three separate rates | Input with the motion uses acceleration, no input uses deceleration, input against the motion uses turn speed | [GMTK devlog](https://gmtk.itch.io/platformer-toolkit/devlog/395523/behind-the-code), scripts dated 22 Jun 2022 | M4, M14 |
| Turn rate | **Gap:** no public number found. Set it in the test room against the wall in `steal_skill.md` §2: a turn's rate changes in a frame by at most 40% of its peak | `steal_skill.md` | M4 |
| When a turn becomes a pivot | M4's 120°+ stands. Pignole boosts acceleration when input opposes movement, scaled by how opposed it is. A pivot also needs speed, so slow turns just rotate (ours) | EPIC M4, [Pignole](https://gamedeveloper.com/design/platformer-controls-how-to-avoid-limpness-and-rigidity-feelings) | M4 |
| Gait switch with a dead zone | People go from walk to run near Froude 0.5 (`Fr = v²/(l·g)`), around 2.0 m/s. With a 0.92 m leg (`STAND` in `hero.js`) that is 2.1 m/s (derived). The transition shows hysteresis, so use different speeds up and down. **Gap:** no published width read; set it in the test room (ours) | [Wikipedia](https://en.wikipedia.org/wiki/Transition_from_walking_to_running), [Kram 1997](https://cob.silverchair.com/jeb/article/200/4/821/7425/Effect-of-reduced-gravity-on-the-preferred-walk) `[snippet]`, [Diedrich & Warren 1995](https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_77206852) `[snippet]` | M1, M6 |
| Stride match | `StrideScale = LocomotionSpeed / RootMotionSpeed`. Lyra starts on distance matching, then blends in stride warping toward the jog | [Epic warping](https://dev.epicgames.com/documentation/unreal-engine/pose-warping-in-unreal-engine), [Epic Lyra](https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-in-lyra-sample-game-in-unreal-engine) | M1 |
| Lean | A body balanced in a turn leans `tan θ = v²/(g·r)`, lateral acceleration over g: 14.3° at 10 m/s on a 40 m curve (physics, computed). Super speeds need a cap, set in the test room (ours). The lean runs through M4's second-order follower | Physics. On running curves: Greene 1985 (doi:10.1115/1.3138542), Chang & Kram 2007 (doi:10.1242/jeb.02728), both `[snippet]`, citations only | M4 |
| Facing against travel | Unreal's orientation warp twists the spine, guarded at 90° by default, spread along the spine | [Epic](https://dev.epicgames.com/documentation/unreal-engine/pose-warping-in-unreal-engine) | M4, M14 |
| Starts and stops without sliding | Distance matching drives the clip from distance to a target | [Epic](https://dev.epicgames.com/documentation/unreal-engine/locomotion-in-unreal-engine) | M4 |
| Simulation vs animation | Let both move, then pull the character toward the simulation with a damper. Cap the correction at 0.5 of velocity. Rotate slower than position. Foot locking is a last resort | [Holden](https://theorangeduck.com/page/code-vs-data-driven-displacement), 23 Sep 2021 | M1, M2 |
| Human speeds for clips | Run just over 4 m/s, strafe under 3, back about 2; walk 1.75, 1.5, 1.25. Mocap sped up about 10% for response | Holden | M1 |
| Pose changes | A cross-fade evaluates two states, roughly double the cost; inertialization avoids it ([Bollo](https://gdcvault.com/play/1025165/Inertialization-High-Performance-Animation-Transitions), GDC 2018 `[snippet]`). Damper: `damping = 4·ln2 / halflife` ([Holden](https://theorangeduck.com/page/spring-roll-call), 4 Mar 2021) | as cited | M3, `formulas/` |

**The jump**

| Item | Number or rule | Source | Use for |
|---|---|---|---|
| Coyote time | Celeste `JumpGraceTime = 0.1` s, 6 frames. Third-party pages say 5: the source file says 0.1 s. GMTK: "usually something like 0.2" | Celeste, [GMTK devlog](https://gmtk.itch.io/platformer-toolkit/devlog/395523/behind-the-code) | M5 |
| Input buffer | **Gap:** no public number found. Celeste's `Jump()` consumes a buffer, but its length isn't in the published file. GMTK holds the press until a counter passes `jumpBuffer`, value not given. Pignole recommends a buffer without a number | Celeste, [GMTK devlog](https://gmtk.itch.io/platformer-toolkit/devlog/395523/behind-the-code), [Pignole](https://gamedeveloper.com/design/platformer-controls-how-to-avoid-limpness-and-rigidity-feelings) | M5 |
| Height by press length | Celeste holds jump speed for up to 0.2 s. GMTK applies a `jumpCutoff` multiplier while rising once the button is released. Pignole suggests a cut-jump speed limit of gravity / 10 | as cited | M5 |
| Hang at the top | Celeste halves gravity while vertical speed is under 40 and the button is held | Celeste | M5 |
| Run carries into jump | Celeste adds 40 to horizontal speed at takeoff, 44% of run speed (`JumpHBoost`). Pittman designs a jump from height and distance at a given run speed ([recap](https://blogs.jccc.edu/dpatter/2016/03/15) `[snippet]`) | as cited | M5 |
| Fall cap | Celeste 160, 240 holding down | Celeste | Landings |
| Air control | Celeste 65% of ground acceleration | Celeste | M5 |
| Squash and stretch | Celeste: takeoff scale (0.6, 1.4), recovers at 1.75/s, 0.23 s. Landing up to (1.6, 0.4), scaled by fall speed | Celeste | M5 landings |
| Anticipation | Celeste's `Jump()` sets full speed at once, with no wind-up state. Pignole gives player input priority over animations, even if it interrupts them. A crouch must not hold back the takeoff: keep it inside the 100 ms guideline, or in the legs only, and overlap it with the rise (ours) | Celeste, [Pignole](https://gamedeveloper.com/design/platformer-controls-how-to-avoid-limpness-and-rigidity-feelings) | M5 |
| Height and time formula | `g = 2h/t²`, `v0 = 2h/t`, t = time to apex. GMTK's devlog sets gravity this way, and it is the subject of [Pittman](https://gdcvault.com/play/1023148/Math-for-Game-Programmers-Building), GDC 2016 (slides not read). A down-gravity multiplier makes landings snappier (GMTK); no value given | [GMTK devlog](https://gmtk.itch.io/platformer-toolkit/devlog/395523/behind-the-code) | `formulas/` |
| Corner forgiveness | 4 pixels up and sideways. List of ten forgiveness features: [Thorson](https://maddymakesgames.com/articles/celeste_and_forgiveness/) | Celeste | M7 |
| Response | 100 ms is the usual ceiling for direct control, attributed to Swink ([slides](https://medienwissenschaft.uni-bayreuth.de/wp-content/uploads/GxD-07-Interfaces.pdf) `[snippet]`, book not read) | as cited | §1 |

**Water and recall**

| Item | Number or rule | Source | Use for |
|---|---|---|---|
| A typical water penalty | Celeste's swim: top speed 89% of its run at the surface, 67% underwater, acceleration 60% (`SwimMax` 80, `SwimUnderwaterMax` 60, `SwimAccel` 600). Slowed movement is the usual complaint ([Witness](https://uliwitness.github.io/why-underwater-levels-suck-so-often)) | Celeste, as cited | The opposite of what we want: water is our fastest state |
| Leaving the water | **Gap:** no public number found. Keep all speed and add lift (ours) | (ours) | High Breach |
| Boost rhythm | Abzû's boost comes in escalating levels with a rhythm; no timings in what I read. A missed beat holds the tier (ours) | [Game Developer](https://www.gamedeveloper.com/design/-i-abzu-i-and-the-challenge-of-conveying-emotions-through-game-design) | Tidepulse |
| Weapon recall | 0.1 s wiggle, 1.5 s hard limit on return, zero tween on start and catch, three rumbles | [Napoli](https://www.gamedeveloper.com/design/recalling-the-leviathan-axe) | Homeward Cast |
| Fish at scale | Abzû: "ten to twenty thousand individually animating fish running on the PS4", one draw per species, no skeletons | [Game Developer](https://www.gamedeveloper.com/design/-i-abzu-i-and-the-challenge-of-conveying-emotions-through-game-design) | W15 |

---

## (e) Sources, and what could not be verified

**Not verified:**
- Reddit comments: none readable. WebFetch refuses reddit.com; only the tool's feed was used. Subs read: r/aquaman (top 100 of the year and of all time), r/DCcomics, r/DC_Cinematic, r/patientgamers, r/GameIdeas, r/Games, r/gaming, r/truegaming, r/gamedesign. Saved in `scratch/reddit_*.json`.
- ResetEra quotes come through a page summariser; the two Pikmin lines were confirmed twice.
- Superfriends-era or cancelled Aquaman games: nothing found.
- Pages that refused reading, used only as `[snippet]` or not at all: Comic Vine thread, GameSpot's 2001 announcement, DC.com, Wind Waker analysis on Medium, Zelda Dungeon's art-style article, Codrops' Susurrus case study, TweakTown, Kram 1997, the Pittman recap, Epic's [Lyra tech blog](https://www.unrealengine.com/tech-blog/adapting-lyra-animation-to-your-ue5-game). The Guilty Gear handout's host refused connection. A [Penn thesis](https://core.ac.uk/download/76389183.pdf) on responsiveness versus natural motion also refused, and is worth a person's read for M5.
- Talks known only by listing, never watched: Pittman, Bollo, McIntosh ([Uncharted animation and control](https://gdcvault.com/play/1012300/Animation-and-Player-Control-in), GDC 2010), Rosen ([procedural animation](https://gdcvault.com/play/1020049/Animation-Bootcamp-An-Indie-Approach), GDC 2014), Sheahan ([Spider-Man traversal](https://gdcvault.com/play/1026422/contactUs), GDC 2019), Nava ([Abzû art](https://www.gdcvault.com/play/1024409/Creating-the-Art-of-ABZ), GDC 2017), the Paragon animation talk, GMTK's [Celeste video](https://amara.org/v/C3BEJ/).
- Gaps in (d), no public number found: turn rate, input buffer length, the width of a gait dead zone, speed on leaving the water. Black Flag's diving complaints rest on one user review and one [PC Invasion](https://pcinvasion.com/assassins-creed-iv-black-flag-pc-review/2) line. Beyond Blue: only "Too short" and "Lacks any real depth" ([Softpedia](https://news.softpedia.com/news/beyond-blue-review-530407.shtml) `[snippet]`). Avatar: Quest for Balance: nothing found.

**Licensed source read:** [Celeste `Player.cs`](https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs), commit `7fd7ae760bc9` (28 Mar 2019), sha256 `7a8606d886c083b1f16932c919564a612e17d5c8418aec01421f877e9e92be5b`. Its authors published it under the [MIT licence](https://raw.githubusercontent.com/NoelFB/Celeste/master/LICENSE), © 2018 Noel Berry: "Permission is hereby granted, free of charge". The [README](https://github.com/NoelFB/Celeste) calls the class files "a learning resource" and says the licence "only applies to the code in this repo", not the game or its assets. Numbers only: no code copied, no copy kept. If one of its numbers ships, credit it in `CREDITS.md` and add its row to the clean-room record.

**Also read:** [three.js r185](https://cdn.jsdelivr.net/npm/three@0.185.0/) (MIT) and this game's `web/js` and `Pipeline/hero`.

All other links are in place in the text. Dates are given where the page shows one.

---

## (f) The Painted look

In the design, UI, listing and reels this is **the Painted look**. No studio's name anywhere we ship.

**The reference is an AI concept video, not a real-time game** (`reference/README.md`). Each frame is a fresh painting. Take its colour, light and shape language. Its per-frame brushwork can't be matched live, and nobody should promise that.

**What the frames show:** huge cumulus lit peach from a low sun, a teal sky and sea, gold on the horizon, big flat shadow shapes with soft edges, thin dark lines only near the viewer, rocks as large planes, grass as soft masses, a character of simple shapes. Colours sampled from `anime_ref_sunset.png` (median of clean regions, from a compressed screenshot, so anchors, not targets):

| Sky high | Sky low | Cloud lit | Cloud top | Horizon | Sea near | Sea deep | Wood | Plank shadow | Moss | Fish accent |
|---|---|---|---|---|---|---|---|---|---|---|
| #5aa59e | #63a89f | #c4a493 | #e0b696 | #f4bd87 | #397f78 | #40726d | #785f52 | #313d48 | #2c441b | #fa2c50 |

### f1. How the published games do it

| Game | What is published | What we take |
|---|---|---|
| **Genshin Impact** | GDC 2021 talk ([listing](https://gdcvault.com/play/1027538/-Genshin-Impact-Crafting-an)), read through [Famitsu's report](https://www.famitsu.com/news/202107/23228135.html): artists draw cloud silhouettes and keyframe their growth, a tool turns those into gradient maps, and two maps (base, rim) carry 24-hour light. Each grass model stores one colour, tinted freely, lighter on mobile. Trees get a minimum light. Normal shading failed on faces, so they built a light-direction mask. [Slides](https://docswell.com/s/UnityJapan/KWRPQ5-210617-unity-dojo20211mihoyozhenzhongyi): two pipelines, mobile leads, "PBR based stylized rendering"; soft shadows cost 1.3-2.6 ms on console, a colour LUT pass under 0.05 ms. Mobile detail is thin. | Two-channel clouds, one-colour grass, a light floor on trees |
| **Guilty Gear Xrd** | [ASW's line deck](https://docswell.com/s/ASW_Academy/5LVY67-GG-Toonline-Eng) (28 Nov 2025): inverted hull, extruded in the vertex shader, width from vertex colour (0 none, 0.5 standard, 1 double), scaled by `distance × tan(FOV/2)`, a Z offset to hide lines, and a second normal set used only for the hull. [Talk summary](https://videohighlight.com/v/yhGjCzxJV3E) (machine summary, handout unreachable): about 40,000 triangles, hand-edited normals, vertex paint for shadow thresholds, each frame a keyframe. | Hull rules, separate hull normals, threshold from vertex colour |
| **Sable** | [GDC 2022 report](https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability) (25 Mar 2022): flat shading loses depth, so they layered lighting, fog and lines. Fog was "really, really key". A moonlight shadow keeps characters grounded. Lines fade with distance, because pop-in was "ugly and a real problem". | Fog and shadow before lines; fade lines with distance |
| **Ni no Kuni** | The team "adjusted the movements to be slightly choppier" ([Exclaim](https://exclaim.ca/music/article/handmade_tale-ni_no_kuni_life_of_artisanal_animation), 1 Apr 2013). No shader talk found. | Not for gameplay: see traps |
| **Breath of the Wild** | **Technique not verified.** GDC 2017 coverage gives art goals only: the art must be "easy to lie" ([Zelda Universe](https://zeldauniverse.net/2017/03/14/takizawa-explains-how-the-wind-waker-hd-inspired-the-visual-style-for-breath-of-the-wild/) `[snippet]`). A mod turning cel shading off shows the same assets looking grittier ([PC Gamer](https://pcgamer.com/heres-how-breath-of-the-wild-looks-on-pc-without-cel-shading) `[snippet]`). No rendering talk was read. | The look lives in lighting, not assets |
| **Wind Waker** | **Technique not verified.** [Gordon's analysis](https://medium.com/@gordonnl/wind-waker-graphics-analysis-a0b575a31127) refused reading. No black outlines ([Codex Gamicus](https://gamicus.fandom.com/wiki/The_Legend_of_Zelda:_The_Wind_Waker) `[snippet]`). | No outlines on the world |

### f2. The ranked recipe

Done first: `web/js/looks/painted.js` and `look.js` already give a three-tone ramp with brush-broken edges, warm lights and cool shadows, rim, a seven-band grade, a painted cloud panorama, a painted sea and ground, and a live switch. That all costs little and stays. Below is what comes next, in order of likeness gained per cost.

Limits: 1.3 MP on a phone (`config.js`), 100 draws, no composer on a phone tier (`GAME.md`). Costs are estimates from reads, draws and triangles. **Nothing here was measured on a phone.**

| # | Step | Phone cost | Why |
|---|---|---|---|
| 1 | **Soft foliage normals.** Build canopies from 3-5 solid blobs, no alpha cards. Transfer normals from an inflated proxy in Blender (Normal Edit radial, or Data Transfer). Cut the proxy cone-shaped so undersides don't go black. Add a light floor | 0 reads. Saves alpha overdraw. +12 bytes a vertex only if kept as a separate attribute | The largest gap on land. [Method](https://forums.unrealengine.com/t/spherical-normals-for-trees-blender/98732), 18 Aug 2017 |
| 2 | **Grass as one mass.** Blades take the ground's normal and colour, tinted per instance. Opaque geometry near, painted ground far, no alpha on a phone | 0 extra reads; triangles set by W9's budget | Grass and ground light as one ([Unreal forum](https://forums.unrealengine.com/t/grass-lighting/152158) `[snippet]`), Genshin's one colour. Alpha overdraw warning: [Unity thread](https://discussions.unity.com/t/wip-environment-beginner/1534785) `[snippet]` |
| 3 | **Big shapes on rock and land.** In Painted, turn off W12's detail normals. Colour by slope: warm tops, cool sides, moss on what faces up | Saves a read | The frames show large planes |
| 4 | **Cloud panorama stores light, not colour.** R = shade, G = rim, A = alpha. Colour comes from the sky table at runtime | Same 1 read | W16's 14-minute day: one texture gives noon and dusk. Genshin's two maps |
| 5 | **Fog per biome as a painted value.** Tune `moods` and `haze` first | 0 | Sable's main tool |
| 6 | **Inverted hull on the hero, bosses, and the nearest few enemies only** (f3) | +1 draw and +100% triangles per mesh (hero +16k) | Ties the character to the paint |
| 7 | **Hero shading.** `COLOR_0` already holds baked shade (`Pipeline/hero/common.py`): in Painted, use it to shift the ramp threshold instead of multiplying. Soften face normals from an ellipsoid proxy. Set `_MASK` scale pattern to 0 | 0 reads | Guilty Gear's vertex control; simple shapes |
| 8 | **A ground shadow that always exists.** A soft quad stretched along the sun | +1 draw, no shadow map | Sable. Filtered shadows cost 1.3-2.6 ms on a console (Genshin slides) |
| 9 | **LUT, only if the analytic grade can't reach the frame** (f5) | +1 3D read per shaded pixel, 20-144 KB | The grade is free; a LUT is not |
| 10 | **Desktop only: Kuwahara at half resolution** (f4) | Not on a phone | Polish, last |

### f3. Outlines

| Method | How | Phone cost | Verdict |
|---|---|---|---|
| Inverted hull | Draw the mesh again, back faces only, pushed out in the vertex shader | +1 draw per mesh, +100% triangles, skinning runs twice, tiny fragment cost, ~0 MB if geometry is shared. MSAA smooths it | **Use, on a few meshes** |
| Fresnel rim | One term in the shader | ~0 | Keep as an accent (already in). Breaks on sharp edges ([Ameye](https://ameye.dev/notes/rendering-outlines/), Aug 2021) |
| Screen-space edges | Sobel or Roberts over depth, normals, colour in a full-screen pass | Needs a composer, which is banned on a phone, plus depth and normal buffers | **No** on a phone |
| Blurred buffer, jump flood | Silhouette passes | Extra full-screen passes | **No** |

How to build it:
- Don't use r185's `OutlineEffect` as it stands: it renders the scene a second time, doubling draws unless each material opts out. Its vertex maths is MIT and worth borrowing.
- Add a second `SkinnedMesh` that shares the geometry and skeleton. Toggle it with `visible`.
- Width from `COLOR_0.a` (`common.py` writes 1.0 there today, so it is free; ours): 0 none, 0.5 standard. Scale by distance and fade to nothing by about 40 m (ours).
- Use a smoothed normal attribute for the hull only, or hard edges split the line.
- Line colour is a dark tint of the local colour, not black (ours; the frames show this).
- The renderer has `stencil: false`, so stencil-based outline tutorials don't apply.

### f4. Kuwahara and painterly filters

**A phone can't afford them, and the composer ban rules them out anyway.** The arithmetic, from [Heckel's implementations](https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders/) (29 Oct 2024):

| Filter | Reads per pixel | At 1.3 MP |
|---|---|---|
| Basic, 4 sectors, kernel 6 | 144 | 187 M a frame |
| Extended, 8 sectors, radius 4 (40 × radius, counted from the article's code) | 160 | 208 M a frame |
| Anisotropic | More, over three passes | Not computed |

The whole Painted frame reads roughly 2-5 textures per pixel today (estimate), so this is about 30-70 times that. The filter's look is flat tones with kept edges, and the ramp, the band grade and the brush-broken edges already give that in the material for one extra read. [Kyprianidis 2009](https://diglib.eg.org/handle/10.2312/CGF.v28i7pp1955-1963) reports interactive rates on a GPU `[snippet]`; I found no phone timing anywhere. Desktop option: 4 sectors, kernel 4, half resolution, about 38 M reads, in the desktop tier only, untested.

### f5. Colour grading by LUT

- **Keep the analytic grade** in `CustomToneMapping` (`look.js`). It needs no composer and no read.
- If a LUT is needed, sample it there, not through `LUTPass`, which needs a composer. Use a `Data3DTexture` from `LUTCubeLoader` or `LUTImageLoader`, and apply LUTPass's half-texel remap: `uvw = c*(1 - 1/size) + 0.5/size`.
- 17³ is 20 KB, 33³ is 144 KB. Use hardware filtering; tetrahedral is more accurate but slower ([postprocessing docs](https://pmndrs.github.io/postprocessing/docs/interfaces/LUT3DEffectOptions.html) `[snippet]`).
- Tone mapping runs in every material, so the read repeats with overdraw. Encode to sRGB before the lookup and decode after, or the shadows band.

### f6. Keeping both looks on one asset set

- **Numbers, not shaders** (L1). One program set, `ocPaint` as a uniform, tables in `web/js/looks/`. This is already the design: keep it.
- **No `#define` per look.** A recompile stalls a phone at the moment of the switch. If a variant is unavoidable, warm it first with `renderer.compileAsync()` (in r185).
- **One normal slot is the trap.** Proxy normals on trees also change the Real look. Either accept them in both (they look fine on foliage) or keep `_SOFTN` beside `normal` and `mix` by `ocPaint`. Guilty Gear keeps separate normal sets for the same reason.
- **Hull meshes toggle with `visible`.** Create them once, never on the switch (L1's 20-switch leak check).
- **Bake neutral.** Vertex colour stays albedo and occlusion, never lit colour, or one look inherits the other's light.
- **The cross-fade is short.** During `0 < ocPaint < 1`, `sky.js` runs both skies, so keep it under about 0.3 s (ours).
- **Regression stills for both looks**, per biome.
- Precedent: Genshin feeds one art set through two pipelines ([slides](https://docswell.com/s/UnityJapan/KWRPQ5-210617-unity-dojo20211mihoyozhenzhongyi)).

### f7. Open-source libraries

Versions and licences read from each package on jsDelivr, 31 Oct 2026.

| Library | Version, licence | three.js | Use |
|---|---|---|---|
| three.js addons | r185, MIT | - | `LUTCubeLoader`, `LUTImageLoader`, `OutlineEffect` vertex code, `MeshToonMaterial` |
| `@pixiv/three-vrm-materials-mtoon` | 3.5.5, MIT | >=0.137 | Don't adopt: `look.patch()` already does this. Use its parameters as a checklist: shade colour, shading shift, toony, rim, outline width |
| `postprocessing` | 6.39.5, Zlib | >=0.168 <0.187 | Desktop only. Has `LUT3DEffect`; no Kuwahara class in its build. r187 falls outside its range |
| `@tresjs/post-processing` | 3.11.1, MIT | >=0.169 | Needs Vue and TresJS. Read its [Kuwahara](https://post-processing.tresjs.org/guide/pmndrs/kuwahara) code only |
| `three-custom-shader-material` | 6.4.0, MIT | >=0.159 | Not needed. Warns about stacking with `onBeforeCompile` |
| `@takram/three-clouds` | 0.7.6, MIT | >=0.170 | **Not for this game.** Its README: iPhone 13 at 36-53 fps on Low, and it recommends a skybox if that's too slow |

### f8. Traps

- **Stepped animation fights M14.** Guilty Gear and Ni no Kuni get their hand-drawn feel from choppy motion, and the owner wants fluidity. Don't step gameplay animation. Try it on cape and hair only, and only if the judge likes it.
- **A face shadow map is possible but comes second.** The hero now has UVs and an atlas (`common.py`; `GAME.md`'s contract still says vertex colours). Try soft normals first, since they cost no read. Add a small light-direction mask only if close-ups need it. Props have no UVs, so this stays hero-only.
- **`MeshToonMaterial` can't do warm-cool.** Its gradient map reads only `.r` in r185. Keep `ocPaintLit`.
- **`DoubleSide` undoes soft normals.** r185 flips the normal on back faces (`normal *= faceDirection`). Remove that for foliage, or duplicate faces.
- **Power effects stay readable.** L5 bans flat brush strokes on powers. Painted changes the world, not the clarity of a hit.
- **Painted must not lose the fight.** Hold the Warden's 60-pixel silhouette (`ART.md`) in both looks, and never let the ramp hide a telegraph (P8).
