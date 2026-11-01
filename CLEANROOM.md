# The clean room: what went into this game, and what never did

`Pipeline/research/steal_skill.md` §0 asks every game to keep this record. Systems keeps it. It never ships. It names games only because a plain record has to.

**The rule:** public facts in, measured feel out. Nothing of another game's code, assets, names or art.

## What was read, and what wasn't

| Read | Where it's recorded |
|---|---|
| Standards, talks, papers and docs, each marked for how far it was read | `Pipeline/research/STANDARDS.md` |
| The 34 quality checkpoints and their sources | `Pipeline/research/QUALITY_SOURCES.md` |
| Fan posts, articles, public talks and the makers' own published source | `Pipeline/research/REFERENCES.md`, tagged by how far each was read |
| His reference clips and stills, for timing and colour only | `reference/`, `reference/README.md`, `DESIGN.md` §Combat |

**Left unopened, by rule:** ROMs, disc images and memory dumps. Ripped models, animations, textures, sounds and levels. Any repository with no licence. **Opened, against the rule, on 31 Oct:** see the breach below.

**Gaps, left as gaps:** no public number was found for the jump buffer, turn rate, dead-zone width or speed on leaving the water (`REFERENCES.md` §d). A gap stays a gap until a public source or an (ours) choice fills it.

## What went in

Each row was read at its source, and each licence is the work's own. Rocketbox and three.js ship; Celeste's numbers are targets, and none of its code is in the game.

| What | Where | From | Licence | sha256 |
|---|---|---|---|---|
| Rocketbox avatar `Sports_Male_01`, base of the Warden's body. Changed and dressed by our scripts | `Pipeline/hero/base_rocketbox/`, shipped changed in `web/assets/hero.glb` | https://github.com/microsoft/Microsoft-Rocketbox, `Assets/Avatars/Professions/`, copied 31 Oct | MIT, © 2020 Microsoft. `web/licenses/Microsoft-Rocketbox-LICENSE.md` | `dc63f02885e37786e0ed5c4d441f565dcfab4eac71f31a208edca74fe5cea8ed` (the FBX) |
| Rocketbox avatar `Military_Male_02`, base of the Reavers. Changed by our scripts | Same, shipped changed in `web/assets/reaver.glb` | Same | Same | `0f20df55226028524122fc70383aa8fab5d5e9da797436e07d3606245893efc5` (the FBX) |
| Rocketbox's licence file | `Pipeline/hero/base_rocketbox/LICENSE.md` | Same | | `17474e386e0b9e1a700cc3d06b2b0882a2c376d9c6b49c7f8274409b8f8d2352` |
| three.js r185 | `web/vendor/three/` | https://github.com/mrdoob/three.js | MIT. `web/vendor/three/LICENSE` | `86bcee248b64f44bcfc23c331ae74619061957d59cab040171dcb6fb5900beb6` (`three.module.min.js`), `05b2609338c76cd65daf74f3ac515bc9a5045e1b3b33edc07d8c9bd55250fa90` (`three.core.min.js`) |
| meshoptimizer's decoder | `web/vendor/three/examples/jsm/libs/` | https://github.com/zeux/meshoptimizer | MIT. `meshopt_LICENSE.md` beside it | |
| Celeste `Player.cs`: **numbers only**, as physics targets. `JumpGraceTime` 0.1 s, `VarJumpTime` 0.2 s and others listed in `REFERENCES.md` §d | No copy kept. None of its code is in the game | https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs, commit `7fd7ae760bc9`, 28 Mar 2019 | MIT, © 2018 Noel Berry. Published by its makers: "here as a learning resource". The licence covers that code, not the game or its assets | `7a8606d886c083b1f16932c919564a612e17d5c8418aec01421f877e9e92be5b` |

**Study only, never shipped:** `reference/anime_ref_sunset.png`, `anime_ref_coast_page.jpg` and `fluidity_ref_action_rpg.mp4`, sent by him. Watched for timing and colour; never traced, copied or reused.

**Everything else** is ours: the code, the world, the creatures, the moves and the sound. `web/rights.json` says so, and `Pipeline/world/assets.json` lists the world's files and records that this project's code made them.

## Where each number's row lives

`steal_skill.md` §0 says here. EPIC §1.2 says `DESIGN.md`. So there's one list, not two: **each tuning number has its row in `DESIGN.md`** (value, kind, source, or (ours)), and `web_check/static.mjs` reads them there (EPIC Q16a). The kinds are §0's: published, published (the idea), physics, derived, own, the person's choice. This file keeps what came in from outside, and the breach.

## What never goes in

From `steal_skill.md` §0 and `Pipeline/AGENTS.md`, for every builder and for any purpose, not even to check a number:

- Decompiled, disassembled, recompiled or leaked code of any game.
- Ripped models, textures, animations, sounds, music, level data, fonts or UI art.
- ROMs, disc images, save files or memory dumps.
- Another game's animations, art, characters, names, level layouts, music or branding.
- More than the README of a repository with no licence.
- Anything non-commercial or research-only, or a model that inherits such a licence.
- Any secret.
- DC's names, characters, costumes, places or story (EPIC §1.6).

A number comes from a public talk, doc or paper, open-licensed source with its licence recorded here, or our own measurement.

## The breach of 31 Oct 2026

**What happened.** A research pass downloaded a decompilation of Super Mario 64 and a disassembly of Sonic 1, read them, and put numbers from them in `REFERENCES.md`. `steal_skill.md` §0 bars that "in any form, for any purpose". The numbers never reached the game, as far as any check can show. What that claim rests on, and what it can't prove, is below.

**Why.** The researcher's own words: "EPIC §1 pointed to `steal_skill.md`, I never opened it, and I went to decompiled code when your brief asked for talks and developer posts." The brief asked for numbers "where they exist (e.g. Sonic, Mario, Celeste, Uncharted/Spider-Man talks)", so it named those games as sources of numbers.

**Times, CET, from the session logs:**

| When | What |
|---|---|
| 22:55 | Research brief sent |
| 23:10-23:15 | Files fetched with `curl` from `n64decomp/sm64` and `sonicretro/s1disasm` into `Pipeline/research/scratch/src/` |
| 23:10 on | Read with `grep`, numbers written into `REFERENCES.md` §a, §b1, §c, §d, §e |
| 23:31 | Systems reads §d while aligning EPIC.md, and sees the sources |
| 23:32 | Systems lists the folder by name, without opening the files, and searches the game for the numbers |
| 23:33:05 | Systems tells the lead |
| 23:33:15 | The lead lists the folder and greps `REFERENCES.md` to confirm |
| 23:33:30 | The lead deletes the Super Mario 64 and Sonic 1 files |
| 23:33:36-42 | The lead orders the strike, and tells movement, combat and missions |
| 23:33:57 | The rule goes in `Pipeline/AGENTS.md` |
| 23:34:08 | The lead tells the owner |
| 23:36:38 | Research fetches Celeste's MIT file once more for its sha256, then deletes it. No decompiled code is fetched again |
| 23:41:12 | Last strike. 23:41:46: research reports |

**What was fetched:** `sm64_step.c`, `sm64_moving.c`, `sm64_mario.c`, `sm64_airborne.c`, `sm64_submerged.c`, a note `sm64_interaction_note.txt`, `s1_main.asm`, `s1_constants.asm`, `s1_sonic.asm`, and a file list `s1_tree.json`. `celeste_Player.cs` was in the same folder; that one is allowed.

**Deleted:** all of the above, and the whole folder with it. Listed empty of them at 23:44: `Pipeline/research/scratch/` holds only Reddit feeds. No copy remains in the project. Excerpts remain in this session's agent logs, outside the project.

**Struck from `REFERENCES.md`**, everything from those two sources: start, stop and turn figures, the pivot trigger, gait thresholds, the clip-rate and lean formulas, jump speeds, heights and windows, the fall cap, water penalties and stroke timing. Also one line whose origin couldn't be confirmed, and the source lines. `REFERENCES.md` §d carries a note saying so. Ideas that remain were re-sourced to public work or marked as gaps.

**Who says they didn't use them, in their own words:**

| Owner | When | Their words |
|---|---|---|
| Movement | 23:35:43 | "Clean-room: I have not read REFERENCES.md (it was absent both times I listed Pipeline/research) and used no SM64, Mario or Sonic number; my gait, jump, pivot and lean values are my own, to be marked (ours) in DESIGN.md §Movement, or from steal_skill.md's formulas." |
| Combat | 23:42:00 | "Clean-room check, combat: I have not read REFERENCES.md and use no SM64, Mario or Sonic numbers; every value in web/data/combat.json is from my own frame counts of the clip or my own design, and DESIGN.md §Combat gives the method." |
| Missions | 23:33:53 | "Missions owner: I've used nothing from REFERENCES.md; I haven't opened it, and nothing in quest, ui or the data draws on it." |

Combat added at about 00:00 that `web/data/combat.json` was only in its private tree when it named the file, so that part of its statement was early; the file reached `web/data/` at 23:58. Its statement about where the numbers came from stands.

**What the logs show.** Systems searched every agent's session log, at 23:44, for tool calls naming `REFERENCES.md` or those files, as a check independent of what anyone said:

| Who | Calls | What they were |
|---|---|---|
| Research | 69 | Its own work and the strike |
| Lead | 2 touching the matter before the strike | The 23:33 listing and grep, then the delete. The grep showed the matching lines |
| Systems | Several | Read §d's text at 23:31. **Never opened the code files**, other than the Celeste constants |
| Missions | 1 | `head -5` at 23:08, before the file existed. It printed nothing |
| Movement | 0 reads | Only a sentence naming the file, written at 23:42 |
| Look | 1 | Read §f at 23:42, after the strike |
| Combat, world, qa | 0 | |

The lead's messages to builders were searched for the source names and four of the struck figures: none carried a number. Research grepped `web/js`, `DESIGN.md`, `EPIC.md` and `Pipeline/hero` for the struck values, and systems grepped the movement and combat code: neither found any.

**What none of this proves.** A text search finds only what's typed the same way. It can't show that nobody saw a number or an idea, or that an idea didn't travel in other words. The logs show tool calls, not what an agent inferred or was told outside them, and their statements are their own. Look, world and qa weren't asked; the logs are all that speaks for them. Research's re-sourced rows were written by the agent that read the code, so a public source now backs each idea, but the choice to look for it came from that reading. This record says what's known, and stops there.

**Who sets the (ours) values.** Those in the game are set by owners who never opened those files, not by the research pass. Those in `EPIC.md` are set by systems, which didn't open the files either, but did read §d's rows at 23:31 and wrote EPIC's rows after that. Systems took nothing from them: its draft numbers came first, and a comparison with the text it had read found no match. That's its own word, so the same limit applies. Movement can re-set any of them.

**What changed:**

- `Pipeline/AGENTS.md` carries the rule, for every builder.
- EPIC Q16a and Q16b make it a requirement. `web_check/static.mjs` greps shipped code and `DESIGN.md` for a sourced line, with plants. At 00:08 it's red: 29 constants and 22 data groups had no line yet.
- `Pipeline/RISKS.md` R12 tracks it.
- Lesson for briefs: name the kind of source wanted, never a game whose numbers are wanted, and point at §0 in the brief itself.

Open: nothing here has been judged by him yet. It's his rule, and what's done about it beyond this is his call.
