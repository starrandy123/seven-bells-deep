# How anything in this game gets built

Randy, 2 Nov 2026: "Never just make shit up from scratch. Always have the best examples and sources online before just starting because I have my AAA standards". And, when it worked: "this is how we must tackle new features and others". This file is that method, so nobody reinvents it.

## The order

1. **Name the standard.** If he names one, that's the one. Don't swap it for something nearby. A jet suit pilot's lean was a real source and still the wrong standard.
2. **Get real footage.** Video storyboards and thumbnails give stills of film and game footage. Real-world subjects get real photos and physics first. Stills stay in a scratch folder, for study only.
3. **Look for proven open work.** Open frameworks, mocap, assets and code that already solve it. Read them at source. If none exists, say so and write down the nearest sources. Record licences in `web/rights.json`.
4. **Read the shapes off the references, in words and numbers:** body line, head, arms, legs, timing, colour, proportions. Write that into the code's comments and into `Pipeline/research/`. No names of famous films, games, shows or characters in this repo: they go in the session's memory record outside it.
5. **Build it from those numbers.**
6. **Make a board:** render the result beside the references, from side, front and back, in each state. Compare before anything else. Assets rebuild in seconds, so iterate here.
7. **Then look through the game's own camera at 844x390**, phone turned. Then walls, weight, upload.
8. Log his words in `EPIC.md` §11 at once. `accepted` is his word alone.

## Traps already paid for

- In `Pipeline/hero/moves*.py` a positive spine or head goes back and up, and a negative one folds forward and down. Flight shipped with the head looking at the ground because of this.
- `arm(d1, d2, palm)` directions are (right, forward, up) in the root's frame. Negative forward is behind him.
- A slew limit must keep its own state. Limiting toward the current velocity each frame strangles the turn.
- `cam.up` tricks only roll the camera for some headings. `cam.rotateZ()` after `lookAt` is correct for all.
- Storyboard pages can be WebP with a .jpg name. `sips -s format jpeg` converts them.
- A wall says the rules hold. It never says it looks right. Only he says that.

## Budgets on his phone

Q5 under 96 MB after the whole map (F2m, F2n). Q7 100 draws. Q8 500k triangles. `web_check/weigh.mjs`.

## Too heavy is not a no

Randy, 2 Nov: "Also for shit that is "too heavy" for the phone, we can still learn and use it and make an optimized version if it's the best out there. This is where we can improvise a little. That's another meta rule".

If the best thing out there doesn't fit the phone, learn it, use it, and cut it down until it does. And each piece is researched on its own, for behaviour, results and how the world answers: "Don't just half ass it and call it done. We need it to mimic actual life with proven techniques and requirements to get these done and open source tools and frameworks available."
