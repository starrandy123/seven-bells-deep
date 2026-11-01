# Randy's corrections and complaints to the cloud session, 1 Nov 2026

This file collects every complaint, correction and strong reaction Randy gave the cloud Claude session (`session_01S4NVNRcxF6MiKavcYr4S4o`) about how it builds games. They are in his exact words, with typos kept.

Times are UTC; his clock is one hour ahead. "Cause" is what I had done that he was reacting to.

This covers only what he said to this session, from 07:12 to 13:56 UTC, plus one line relayed by the Mac session at 15:41 UTC. Older rules live in the NotesMosaic MCP's rules and in `Pipeline/AGENTS.md`.

One redaction: the repo's clean-room rule bars a certain film's title from every file, so where he named it, it is shown as `[film title withheld]`. Nothing else is changed.

## Said more than once

- **AAA standard: four times.**
  - 08:43: "WE SPOKE ABOUT HAVING AAA STANDARDS AND THATS FOR BUTTONS TOO."
  - 10:01: "make it fully AAA worthy"
  - 12:41: "tested and proven at the AAA standard. Not lazy work"
  - 12:47: "based on my standards and AAA"
- **The waterfall and its water not meeting the land: three times.**
  - 12:41: "The waterfall looks disconnected from the land and is unnatural"
  - 13:24: "The water needs to actually ride out on the ground too to make the river stream on ground"
  - 13:56: "I’m talking about the waterfall"
- **The phone HUD layout: corrected three times in 38 minutes** (08:22, 08:43, 09:00).
- **The water on land being unnatural:** 09:34, then again at 12:41 (above).

## Movement

- "The water on land is unnatural and I can’t sprint or climb uphill. I need to also be able to swim up waterfalls too." **09:34.**
  - Cause: the build itself. Sprint was tied to the Boost fuel tank and jumped him to 36 m/s "super speed" even on land. Anything over 42° stopped him like a wall, and hills slowed him by up to 55%. The falls were only drawn, so they were dry land to the movement code.
- "Yeah all the fighting and movement and ocean environment and actual cities with blocks underwater inspired by the [film title withheld] movie and real life land cities too and not just one building. You need to actually implement a full game here based on my standards and AAA" **12:47.**
  - Cause: I was fixing his items one at a time. Movement never got an AAA pass, and still hasn't.

## Camera

Nothing said to this session about the camera.

## Controls

- "THE HUD FOR MOBILE IS TERRIBLE! It has too many buttons! That is a rule we have set in the notesmosaic MCP. Look at how crowded it is! It’s ugly." **08:22.**
  - Cause: the crowded phone HUD on the build. It was in the phone clips going into his reel, and it had passed the checks.
- "WE SPOKE ABOUT HAVING AAA STANDARDS AND THATS FOR BUTTONS TOO." **08:43.**
  - Cause: my first redesign (`d51d8ae`) was my own invention, not a researched standard.

## HUD

- "We stick to the minimalistic diamond design and the shit we had last time but implementing the rest of the other features and a hotbar to equip different powers and all" **08:22.**
  - Cause: as above.
- "You have access to the MCP and can fix it from there. I can’t believe this got passed" **08:22.**
- "NO! The hot bar must be on the middle! Look at Coleseum in the vertical and widescreen. We need to use best practice standard MMO type HUD for these games HUD. This is bad still" **08:43.**
  - Cause: `d51d8ae` didn't put the hotbar in the middle.
- "Stop just coming up with shit and find the best layout that is industry standard and A/B tested" **08:43.**
- "Search online for the standard" **08:43.**
- "Put the hot bar below that diamond and joystick buttons" **09:00.**
  - Cause: `af05bb3` put the hotbar in the middle, between the stick and the arc, not below them. This was the third correction.

## Land

- "The water on land is unnatural" **09:34** (in full under Movement).
- "Yeah The waterfall looks disconnected from the land and is unnatural the next steps will make it better but it’s not done yet. We need the environment and nature and pieces to blend well." **12:41.**
  - Cause: the falls after `8d95b35` and `f850eb1`: a sheet on the rock, and a blue strip lying on the grass at its foot.

## Water

- "The water on land is unnatural" **09:34.**
- "Yeah The waterfall looks disconnected from the land and is unnatural the next steps will make it better but it’s not done yet." **12:41.**
- "Also for the boost in land, we need the water animation and movement surf to be actually better and we need waves too we can surf once that happens. All this needs to be done well and tested and proven at the AAA standard. Not lazy work" **12:41.**
  - Cause: Boost on land as it was then, before `3f840fb`. There were no waves to surf.
- "The water needs to actually ride out on the ground too to make the river stream on ground. We have much work to do here" **13:24.**
  - Cause: the falls' outflow was still a strip draped on the grass (`b3c241c`). **I misread this as being about the land ride** and built a land-ride trail (`c66a460`).
- "I’m talking about the waterfall" **13:56.**
  - Cause: that misreading.
- "The land surf should leave some water too" **13:56.**
  - Cause: the land ride's trail vanished after a few seconds.

## Cities

- "actual cities with blocks underwater inspired by the [film title withheld] movie and real life land cities too and not just one building" **12:47.**
  - Cause: each city site was a landmark or two, not a city.
- "The cities must come with the nice detail and textures of the art style too and look out of a comic book" **13:06.**
  - Cause: my first cities commit (`82b7379`) was plain massing.

## Combat

- "Yeah all the fighting and movement and ocean environment …" **12:47.**
  - Cause: fighting had had no pass at all. It still hasn't.

## Polish (the reel)

- "Fix the mask too on my clips" **07:55.**
  - Cause: the cut-out of him had holes and bad edges.
- "The tornado clip in the beginning needs to be better too and better rendered and we can just use the combat takes as the beginning part" **08:22.**
  - Cause: the opening tornado clip in reel v2.
- "Like this. Just have my cutout in the main center and have the frames running above me" **08:31**, with a reference screenshot.
  - Cause: reel v2's layout wasn't his format.
- "No captions needed though" **08:43.**
  - Cause: reel v3 had captions.
- "Remove the “NOT SLOP” word on the screen and just say built on my M1 Mac" **08:43.**
  - Cause: reel v3's headline.
- "Also fix my video a little bit more. I have too long gaps in between takes. I need 0.1s distance in between so we can get it right" **09:10.**
  - Cause: reel v4's gaps.
- "Also I need the right the description better with the name of the game on notesmosaic" **09:20.**
  - Cause: my first post description didn't name Thalor.
- "We want to enphasize how we have other high quality games like this in notesmosaic too" **09:29.**
  - Cause: the description only talked about Thalor.

## Process

- "Also record the clips on my new format that we agreed on last time" **08:22.**
  - Cause: I hadn't used the format agreed in an earlier session.
- "That is a rule we have set in the notesmosaic MCP." **08:22.**
  - Cause: the HUD broke a rule that was already written down.
- "Stop just coming up with shit and find the best layout that is industry standard and A/B tested" **08:43.**
- "You need to actually implement a full game here based on my standards and AAA" **12:47.**
- "Max effort now. This is not to be played with" **13:27.**
  - Cause: the pace and effort he was seeing.

## Speed

- "We have much work to do here" **13:24.**
- "going slow and a little sloppy". Relayed by the Mac session at 15:41 (16:41 his time); not said to me directly.

## Sloppiness

- "I can’t believe this got passed" **08:22.**
- "This is bad still" **08:43.**
- "Not lazy work" **12:41.**
- "a little sloppy" (relayed, 15:41).

## Testing

- "I can’t believe this got passed" **08:22.**
  - Cause: the crowded HUD had passed the checks.
- "All this needs to be done well and tested and proven at the AAA standard. Not lazy work" **12:41.**
  - Cause: I had committed things marked "not yet checked" and moved on. This was **not met**: nothing was checked on a device, in WebKit, or by the project's walls (see `HANDOFF.md`).

## Reporting

Nothing said to this session about reporting.

## Everything he said to this session, verbatim, in order

| Time (UTC) | Message |
|---|---|
| 07:12 | Hey you will take over the next Claude for rendering my video and all. Be sure to communicate and see if you can take over |
| 07:20 | I allow it here |
| 07:53 | The other Claude session is closed now. You are the main one |
| 07:55 | You can record the phone clips yourself. Fix the mask too on my clips |
| 08:22 | Also record the clips on my new format that we agreed on last time / For the reel / The tornado clip in the beginning needs to be better too and better rendered and we can just use the combat takes as the beginning part / THE HUD FOR MOBILE IS TERRIBLE! It has too many buttons! That is a rule we have set in the notesmosaic MCP. Look at how crowded it is! It’s ugly. We stick to the minimalistic diamond design and the shit we had last time but implementing the rest of the other features and a hotbar to equip different powers and all / You have access to the MCP and can fix it from there. I can’t believe this got passed |
| 08:31 | [screenshot] Like this. Just have my cutout in the main center and have the frames running above me |
| 08:43 | No captions needed though / NO! The hot bar must be on the middle! Look at Coleseum in the vertical and widescreen. We need to use best practice standard MMO type HUD for these games HUD. This is bad still / WE SPOKE ABOUT HAVING AAA STANDARDS AND THATS FOR BUTTONS TOO. Stop just coming up with shit and find the best layout that is industry standard and A/B tested / Search online for the standard / Remove the “NOT SLOP” word on the screen and just say built on my M1 Mac |
| 09:00 | Put the hot bar below that diamond and joystick buttons |
| 09:05 | Nice, give me a good description for my video so we can link the GitHub repo and notesmosaic mcp too |
| 09:10 | Also fix my video a little bit more. I have too long gaps in between takes. I need 0.1s distance in between so we can get it right |
| 09:20 | Also I need the right the description better with the name of the game on notesmosaic |
| 09:25 | Make the repo public and publish the game on notesmosaic |
| 09:29 | You can remove my takes from the repo and all once we have the satisfied takes and clip. We want to enphasize how we have other high quality games like this in notesmosaic too |
| 09:34 | Okay good enough. Now to work on the game. The water on land is unnatural and I can’t sprint or climb uphill. I need to also be able to swim up waterfalls too. |
| 09:58 | Great we posted. Clean up the repo |
| 10:01 | You can remove the Mac status and all. I made it public. Continue the game dev from here autonomously to make it fully AAA worthy |
| 12:41 | Yeah The waterfall looks disconnected from the land and is unnatural the next steps will make it better but it’s not done yet. We need the environment and nature and pieces to blend well. Also for the boost in land, we need the water animation and movement surf to be actually better and we need waves too we can surf once that happens. All this needs to be done well and tested and proven at the AAA standard. Not lazy work |
| 12:47 | Yeah all the fighting and movement and ocean environment and actual cities with blocks underwater inspired by the [film title withheld] movie and real life land cities too and not just one building. You need to actually implement a full game here based on my standards and AAA |
| 13:06 | The cities must come with the nice detail and textures of the art style too and look out of a comic book |
| 13:24 | The water needs to actually ride out on the ground too to make the river stream on ground. We have much work to do here |
| 13:27 | Max effort now. This is not to be played with |
| 13:56 | I’m talking about the waterfall / The land surf should leave some water too |
| 15:41 | (relayed by the Mac session) the work has been "going slow and a little sloppy"; he wants a full handoff and a fresh Claude on his Mac for Part 2 |
