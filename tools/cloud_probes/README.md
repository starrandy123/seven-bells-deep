# Cloud probes (from the 1 Nov cloud session)

These are the scripts the cloud session used to look at the game. Until now they only
existed in that session's scratch folder.

They are headless Chromium runs with software WebGL (SwiftShader). They are not a real
device, not WebKit, and not the project's walls in `web_check/`. A frame of a heavy scene
can take minutes, and some city frames took more than 15 minutes.

- How they run: serve `web/` first (`node web_check/serve.mjs ../web 8843` from `web_check/`).
  Then `node <probe>.mjs <outdir> <tag>`.
  The scripts load `web_check/lib/qa_page.js` and `film.js` as init scripts. `film.js` is a
  copy of the old `Pipeline/film/tools/film.js`, which was purged from the repo on 1 Nov.
- Hard-coded paths: they use the cloud container's paths (`/tmp/claude-0/...`,
  `/opt/node-tools/node_modules/` for Playwright). Change these before running.
- How they set up a shot: they open the game with `?film&fresh&tier=desktop` and call
  `__qa.start()` and `__film.quiet()`. `__film.quiet()` stops the quest and hides enemies, so
  a shot does not show normal play.
- Why waits are fast: the newer probes swap `G.look.render` for a no-op while time passes,
  and draw only the frame they keep. A shot then takes seconds instead of minutes.
- `offline/`: node scripts that decode `web/assets/height_z.bin` and run `rivers.js`,
  `city.js` and `surf.js` against the real height field, without a browser. They need a
  `node_modules/three` that points at `web/vendor/three`, and `node --preserve-symlinks`.
- `shots/`: the last frames each probe made, as JPEGs, so the state can be seen without
  running anything.
