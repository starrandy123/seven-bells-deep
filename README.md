# Seven Bells Deep

An open-world game for the browser and phones. Play the Warden, a water hero who swims, surfs and rides water tornadoes, or the man in
red, who flies on fire jets. Bosses that fight back, two stories, water against fire. In development, built with Claude Code.

**Play it free:** https://notesmosaic.com/sim/fD5GCoQ9gvo4okek

**30 seconds of the game:** [docs/media/SEVEN_BELLS_DEEP_30s.mp4](docs/media/SEVEN_BELLS_DEEP_30s.mp4)

## How it's built: a few markdown files

1. **Rules.** The non-negotiables every session reads first: never make anything up from scratch, find the best real examples first;
   if the best method is too heavy for a phone, make a lighter version of it.
2. **Research before code.** One sources file per feature in [`Pipeline/research/`](Pipeline/research/): the papers, the open-source
   code and the measurements it was built from, with their licences (`OCEAN_SOURCES.md`, `FLIGHT_SOURCES.md`, `CONTROL_SOURCES.md`,
   `SMOOTH_SOURCES.md` and more).
3. **Every ask in the owner's words.** [`EPIC.md`](EPIC.md), section 11, so nothing said is lost between sessions.
4. **Every mistake made a rule.** [`PET_PEEVES.md`](PET_PEEVES.md).
5. **A skill for the process that repeats.** [`Pipeline/research/steal_skill.md`](Pipeline/research/steal_skill.md), Steal Like an
   Artist: study how a game feels from public facts, never its code, art or name.

And checks that run: [`web_check/`](web_check/) holds the walls every build has to pass (movement, input on touch, frame pacing,
fights), so a rule that isn't followed fails the build.

## Run it

Serve `web/` with any static server, for example `node web_check/serve.mjs web 8800`, then open http://127.0.0.1:8800/ .

## Licence

The original code is MIT ([`LICENSE`](LICENSE)). Third-party code and assets keep their own licences ([`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)),
listed in [`web/rights.json`](web/rights.json) with their notices in [`web/licenses/`](web/licenses/).
