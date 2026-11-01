# Rules for every builder on this game

Read first, in order: `EPIC.md` (the requirements, §1 is binding), `GAME.md` (contracts), `ART.md` (look), `Pipeline/research/steal_skill.md` (the method: walls, plants,
chain, formulas, frozen rounds), `Pipeline/research/QUALITY_SOURCES.md` (the 34 checkpoints), `Pipeline/research/REFERENCES.md` when it exists (fan wants, design references, movement numbers, the Painted look's recipe).

**The bar.** The owner: "this needs to be done well". A requirement is done when its check is green and you've looked at the result, never when the code exists. Don't report a thing as working unless you ran it.

**Ownership.** Edit only what you own. If you need a change in someone else's file, ask the lead with SendMessage to "main", with the exact change.

| Owner | Owns |
|---|---|
| movement | `web/js/hero.js`, `web/js/body.js`, `web/js/formulas/*`, `Pipeline/hero/*`, `web/assets/hero.glb`, `reaver.glb`, `moves.json`, any new character mesh |
| combat | `web/js/combat.js`, `fx.js`, `enemies.js`, `boss.js`, new combat files, `web/data/combat.json` |
| missions | `web/js/quest.js`, `ui.js`, `stack.js`, `web/index.html`, `web/data/missions.json` and other game data, new screens |
| look | `web/js/look.js`, `world.js`, `life.js`, `sky.js`, `web/js/looks/*`, `web/look_test.html`, `web_check/look_shots.mjs` |
| world | `Pipeline/world/*`, `web/assets/world.json`, `height.bin`, `biome.bin`, `props.glb`, `creatures.glb`, `web/assets/tex/*` |
| qa | `web_check/*` other than `look_shots.mjs`, `tools/*` |
| systems | `EPIC.md`, `GAME.md`, `CLEANROOM.md`, `Pipeline/research/STANDARDS.md`, `Pipeline/RISKS.md`, the traceability tables. IDs never change |
| lead | `web/js/main.js`, `config.js`, `bot.js`, `audio.js`, `web/rights.json` (owners may add a line for what they bring in) |

Clips: only movement edits `Pipeline/hero/moves.py`. Anyone who needs a clip writes it in `Pipeline/hero/CLIP_REQUESTS.md` (name, purpose, timing, loop or one shot) and tells the lead.

**Status.** When a requirement moves, change its line in `EPIC_STATUS.md` (`todo`, `building`, `check green`, `judged`), with the check's name. Keep your edit to your own lines.

**The machine (hard rules).** An 8 GB M1 that kernel-panicked on swap, and tonight a bug took swap to 29 GB.
- Every Blender run, headless browser run and other heavy process goes through `bash ~/.mosa/heavy.sh run <who> -- <command>`, one at a time, each under about 3 minutes.
- Every Blender script imports `Pipeline/hero/guard.py` or an equal guard, so a runaway job ends itself. Before a numpy array, know its size.
- Never Unreal unless the lead tells you. No visible windows: headless only.
- The local server is http://127.0.0.1:8791/ on `web/`. Serve a frozen copy on its own port.
- Don't delete anything outside your folders. Never touch the simulators, Xcode or Android SDK.
- Don't read `.env` or key files. No `git clone`, `pip install` or downloads of code: if you need one, say so and the lead asks the owner. A denied command is not retried or worked around.
- The tool's shell is zsh.

**Clean room (hard rule, `steal_skill.md` §0).** Never read, download, quote or take a number from decompiled, disassembled, recompiled or leaked code of any game, in any form, for any purpose, not even to check a number. Open-licensed source is fine with its licence recorded. A number comes from a public talk, doc, paper or our own measurement. On 31 Oct a research pass broke this; those numbers are struck from `REFERENCES.md` and must not be used.

**Original work.** Never Aquaman, Atlantis, DC names, a studio's name, or any famous character, in the game, files or text. `reference/` is for study and is never shipped.

**Reporting.** When your round's items are done, report to the lead in under 25 lines: what's green with its numbers, what you looked at, what's weak, what isn't verified. Say plainly what failed.
