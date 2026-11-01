# Quality sources and checkpoints: Nest Raid and Sandsweep

Researched 2026-10-28 for Randy's ask: "the character can run through buildings and all. That's terrible. We need to find the best standards and checkpoints for good games like these and apply those."

How to read this file:
- Every quote was copied from the page at the URL beside it, fetched on 2026-10-28. "…" marks text left out of a quote.
- **(ours)** marks a number we chose, such as a test tolerance. No source gave it.
- **Not found** means I looked and could not verify it. Part 5 lists these.
- The games use three.js r185 and Rapier 0.21 (KinematicCharacterController), on desktop and iPhone Safari. The Rapier pages read here are the "User Guide: JavaScript (0.21)", the same version.
- NotesMosaic's own bar (from its MCP instructions) says a game must boot, work "on a phone upright and turned", be safe, and pass in Chromium and WebKit (iPhone). The tests below assume that harness: windowless Playwright in Chromium and WebKit, plus a real-iPhone playtest.

Test hooks the automatic tests assume. These are ours, and the games need them in test builds:
- `__test.input({move:[x,z], sprint, jump, act})` drives the game's real input path.
- `__test.state()` returns the character position, grounded state, game time, audio state, coins and the like.
- `__test.step(n, dt)` advances the fixed-step loop by hand.
- `__test.colliders()` / `__test.visuals()` list each building's Rapier collider handles and its three.js visual meshes.

---

## Part 1. The checklist (34 checkpoints)

**MUST** = a phone web game must pass it. These come first in each group. **SHOULD** = strong practice.

### A. Collision and movement

**A1 · MUST · The character cannot enter a building: the collider covers what you see.**
- Source: ISTQB Certified Tester Game Testing (CT-GaMe) syllabus v1.0.1, p. 33, https://www.istqb.org/wp-content/uploads/2024/11/ISTQB_CT_GaMe_Syllabus_v1.0.1_LtrKuyi.pdf: "If the collider of the object is much smaller than its visual model, then the character will be able to “fall into the texture” or go through it." Also p. 33: "the size of the collider must correspond to the visible model, especially if the player can interact directly with this object." Also p. 38: "Testing that the collision model matches the visual model."
- Source: Rapier JS 0.21, Colliders, https://rapier.rs/docs/user_guides/javascript/colliders: "Triangle meshes (in 3D) and polylines (in 2D) can be used to describe the boundary of any kind of shape. This is generally useful to describe the fixed environment in games (terrains, buildings, etc.)"
- Source: EA SEED, "Augmenting Automated Game Testing with Deep Reinforcement Learning" (IEEE CoG 2020), https://arxiv.org/pdf/2103.15819: "the RL agent quickly finds a way of exploiting the missing collision mesh and learns to walk through the wall to maximize its reward"
- Automatic test, in two parts:
  - (a) **Static check, no browser.** For each building, sample about 2,000 points on the visual mesh, skipping parts tagged decorative. For each point, `world.projectPoint(p, false)` gives its distance to the collider. Use `solid = false`, so a point inside an oversized box still projects to the box's surface. Then do the reverse: for each collider vertex, three-mesh-bvh `closestPointToPoint` gives its distance to the visual mesh. Fail if the p95 distance is over 5 cm, or if any axis of the collider's AABB differs from the visual AABB by more than 5 cm **(ours)**. This catches today's "boxes smaller than buildings" at once.
  - (b) **Wall-walk probe, Playwright, Chromium and WebKit.** For each building, try 16 headings × {walk, sprint, jump}. Spawn 3 m outside the footprint and hold input toward the building's centre for 3 s through the real KCC. Measure with `bvh.closestPointToPoint` from the capsule's axis. Fail if the capsule ever comes closer to the visual mesh than radius − 2 cm **(ours)**, or ends inside the footprint.

**A2 · MUST · No invisible walls and no standing on air.**
- Source: ISTQB CT-GaMe p. 33 (URL above): "If the size of the object’s collider is larger than the visible model, a situation may arise when the character rests against an invisible wall or stands in the air on a tiny support." Also p. 54–55: "the player sees that the character's path is blocked by a waist-high fence, but it is impossible to get over it … from the player's point of view, this situation looks like a defect that ruins the immersion in the game."
- Automatic test: reuse the A1(b) probe.
  - When the KCC stops at a wall (`computedCollision(i)` reports a hit), the gap between the capsule surface and the visual surface must be ≤ KCC offset + 5 cm **(ours)**.
  - When `computedGrounded()` is true, a ray straight down from the capsule bottom must hit visual ground within offset + 5 cm.
  - Walk the bot through every doorway and opening that looks open. Each must let it through.

**A3 · MUST · The character never gets stuck.**
- Source: ISTQB CT-GaMe p. 54: "Geometry defects are situations where the player's character is partially stuck in some parts of the level / map. As a rule, such defects are found on the edges of the map, ledges, slopes."
- Source: EA SEED (arXiv 2103.15819): "using a navigation mesh is not an effective way of finding areas where players could get stuck. These areas are often found in places human players are not expected to reach … we used the Stuck Player sand-box to analyze the positions in the map where agents would time-out."
- Source: Rapier JS 0.21, Character controller, https://rapier.rs/docs/user_guides/javascript/character_controller: "if the character seems to get stuck inexplicably, try increasing the offset"
- Automatic test: a seeded bot plays 15 min per game in Playwright. It mixes random headings with goal-seeking to every nest, pickup, shop and dig spot.
  - Log a "stuck" event when input is held, the character moves < 5 cm in 2 s, and 8 escape directions plus a jump all fail to move it 20 cm **(ours)**.
  - Output the coordinates and a heatmap, the way EA SEED plots its time-out positions.
  - Any stuck event fails the run.

**A4 · MUST · Nothing falls through the world (character, loot, treasure).**
- Source: ISTQB CT-GaMe p. 54: "Another common situation is death when being stuck, namely, the character visually falling under the surface of the level / map and falling down. Ultimately, the character either dies and the level has to start again, or falls endlessly in the void, and the game has to be restarted."
- Source: Glenn Fiedler, "Fix Your Timestep!" (2004), https://gafferongames.com/post/fix_your_timestep/: "fast moving objects tunneling through walls and players falling through the floor!"
- Source: Rapier JS 0.21, CCD, https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd: "Every fast-moving dynamic rigid-body is swept against the fixed colliders … Note however that this is not enabled fol dynamic rigid-bodies with mesh-like shapes (triangle meshes, polylines, heightfields)" ("fol" is the page's typo).
- Automatic test: run these checks on every physics step of the A3 bot.
  - Assert `y ≥ groundY(x,z) − 0.10 m`, where groundY comes from a downward ray against the visual ground. Also assert `y > killY` and that the character stays inside the map bounds **(ours)**.
  - Sandsweep: after every dig, a downward ray at the character, each treasure and each dropped item must hit.
  - Sandsweep: at the dug cells, collider height and visual height must match within 1 cm **(ours)**.
  - Any kill-plane rescue counts as a fail.

**A5 · MUST · The third-person camera never goes inside a wall.**
- Source: Unreal Engine API, USpringArmComponent, https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/USpringArmComponent: "This component tries to maintain its children at a fixed distance from the parent, but will retract the children if there is a collision, and spring back when there is no collision." Its bDoCollisionTest flag: "If true, do a collision test using ProbeChannel and ProbeSize to prevent camera clipping into level."
- Background: John Nesky's GDC 2014 talk "50 Camera Mistakes". Game Developer describes it: "He went on to take the audience on a tour of all the poor game camera design decisions he and other designers have made in recent years, offering thoughtful advice on how to sidestep or solve each of them." https://www.gamedeveloper.com/design/video-50-common-game-camera-mistakes----and-how-to-fix-them
- Automatic test, on every bot frame:
  - Cast a ray from the camera pivot (the character's head) to the camera against the visual-mesh BVH. A hit nearer than the camera is a fail, unless the camera has already pulled in.
  - `bvh.closestPointToPoint(camera.position)` must be ≥ 2 × `camera.near` **(ours)**.

**A6 · MUST · Physics behaves the same at any frame rate (30 / 60 / 120 / 144 Hz).**
- Source: CrazyGames Gameplay requirements, https://docs.crazygames.com/requirements/gameplay/: "Consistent Physics: The game's physics must perform consistently across different monitor refresh rates (e.g. 144 Hz, 165 Hz)"
- Source: Fiedler, "Fix Your Timestep!" (URL above): "The problem is that the behavior of your physics simulation depends on the delta time you pass in. The effect could be subtle as your game having a slightly different “feel” depending on framerate or it could be as extreme as your spring simulation exploding to infinity…"
- Automatic test: run the same 5 s scripted input (forward, sprint, one jump) through `__test.step` four times, with frame dt of 1/30, 1/60, 1/120 and 1/144. Final position and jump apex must agree within 1% **(ours)**. This also tests the fixed-step accumulator.

**A7 · SHOULD · Steps, slopes and ground snap work as configured. The character climbs what looks climbable, and nothing else.**
- Source: Rapier JS 0.21, Character controller (URL above):
  - "If enabled, the autostep setting allows the character to climb stairs automatically and walk over small obstacles."
  - "Autostepping will only activate if the character is touching the floor right before the obstacle."
  - "The max slope climb angle: if the angle between the slope to climb and the horizontal floor is larger than this value, then the character won’t be able to slide up this slope."
  - Snap-to-ground: "Typical usages of snap-to-ground include going downstairs or remaining in contact with the floor when moving downhill."
- Source: Unity Character Controller, https://docs.unity3d.com/Manual/class-CharacterController.html: "Step Offset can affect this too, make sure that this value is between 0.1 and 0.4 for a 2 meter sized human." Note this is Unity's figure, for a different controller.
- Automatic test: build a code-only test room with steps of 0.10, 0.25, 0.40 and 0.60 m and ramps of 20°, 35°, 45° and 55°. Each must pass or fail exactly as the autostep height and max-slope settings say. The bot must also reach every upper floor, ledge and ramp in the real levels that is meant to be reachable.

**A8 · SHOULD · Collider types follow the engines' guidance.** Static buildings get a trimesh of the visual mesh, or of a simplified mesh made in Blender. Moving things get convex hulls or primitives. The character is a capsule. Floors and terrain get internal-edge fixing.
- Source: Rapier JS 0.21, Colliders (URL above):
  - "It is however strongly recommended to avoid triangles that are long and thin because they can result in a lower numerical stability of collision-detection."
  - "TrimeshFlags::FIX_INTERNAL_EDGES is a popular choice to help with correcting ghost collision."
  - "It is discouraged to use a triangle meshes or a polylines for colliders attached to dynamic rigid-bodies. Because they have no interior, it is easy for another object to get stuck into them."
- Source: Rapier Character controller: "it is recommended to either use a cuboid, a ball, or a capsule since they involve less computations and less numerical approximations."
- Source: Unity, Introduction to Mesh colliders, https://docs.unity3d.com/Manual/mesh-colliders-introduction.html: "A good approach is to use Mesh colliders for static scene geometry, and compound colliders for moving GameObjects."
- Source: Godot, Collision shapes (3D), https://docs.godotengine.org/en/stable/tutorials/physics/collision_shapes_3d.html: "When not using GridMaps for level design, concave shapes are the best approach for a level's collision. That said, if your level has small details, you may want to exclude those from collision for performance and game feel."
- Automatic test: a build-time script runs these checks.
  - Every static building collider is a trimesh, or convex parts made from its own mesh. Every dynamic body is convex or primitive. The character is a capsule.
  - Fail on any trimesh triangle with an aspect ratio over 20:1 **(ours)**.
  - Floors and terrain carry the FIX_INTERNAL_EDGES flag.
  - Dev builds render a Rapier `world.debugRender()` overlay screenshot per building for a human to look at. Release builds contain no debug renderer (see F1).

### B. Performance and loading

**B1 · MUST · Small initial download.**
- Source: Poki, Choosing your web game engine, https://developers.poki.com/guide/web-engine: "File size is important; for a good web game the initial download should not exceed 5MB and 8MB in total."
- Source: Google GameSnacks requirements, https://developers.google.com/gamesnacks/developer: "The initial download must be less than 15 MiB." "The initial download should be less than 5 MiB."
- Source: CrazyGames Technical requirements, https://docs.crazygames.com/requirements/technical/: "The game must have an initial download size ≤ 50MB. In order to be eligible for the mobile homepage, the initial download size needs to be ≤ 20MB." Also: "There's a file count limit on 1500 files as high file counts will make loading slower."
- Automatic test: Playwright (Chromium) with a CDP session. Sum `Network.loadingFinished.encodedDataLength` from navigation to the first moment input moves the character.
  - Target ≤ 5 MiB initial and ≤ 8 MB total (Poki).
  - Hard fail above 15 MiB initial (GameSnacks).
  - Also log the file count.

**B2 · MUST · Something on screen in about 1 s, playable in under 10–15 s on a 10 Mbps phone connection.**
- Source: GameSnacks (URL above): "Your game must show a loading screen or be interactive in less than 1 second on any connection of at least 10 Mbps." "Your game must be playable in less than 15 seconds on any connection of at least 10 Mbps."
- Source: Poki Requirements, https://developers.poki.com/guide/requirements-quality: "Players tend to move to another game if loading takes more than 10 seconds, and they load from everywhere in the world. Keep the initial download even smaller with progressive loading."
- Source: Google Play core app quality, https://developer.android.com/docs/quality-guidelines/core-app-quality: "App loads quickly or provides onscreen feedback to the user (a progress indicator or similar cue) if the app takes longer than two seconds to load."
- Automatic test: run Playwright under CDP `Network.emulateNetworkConditions` (10 Mbps down) with a 4× CPU throttle **(ours)**.
  - Time to the first painted frame (`__MOSA_BOOT.ok`) must be ≤ 1 s, with a loading screen or progress bar showing if loading lasts past 2 s.
  - Time to playable must be ≤ 10 s as the target, and ≤ 15 s hard.

**B3 · MUST · Holds frame rate on a low-end phone (30 fps floor, 60 fps target), with headroom for heat.**
- Source: GameSnacks (URL above): "Your game must run at 30 fps or greater on any device with the following specs or better: CPU: Qualcomm 215, Samsung Exynos 7570, Mediatek MT6737, or similar · RAM: 2 GiB · GPU: Arm Mali-T720 MP1, Qualcomm Adreno 308, or similar"
- Source: Google Play core app quality (URL above): "App renders frames every 16 (or fewer) milliseconds to display at least 60 frames per second."
- Source: Roblox, Performance optimization, https://create.roblox.com/docs/performance-optimization: "By default, Roblox games target 60 FPS, which is one frame every 16.67 milliseconds with proper frame pacing."
- Source: Unity, "Optimize your mobile game performance", https://unity.com/blog/games/optimize-your-mobile-game-performance-tips-on-profiling-memory-and-code-architecture-from: "We recommend that you use only about 65% of the available time to allow for cooldown between frames. A typical frame budget will be approximately 22 ms per frame at 30 fps and 11 ms per frame at 60 fps."
- Automatic test: an in-page recorder logs rAF frame times while the bot walks the heaviest scene. For Nest Raid that is the most buildings, guards and bots on screen; for Sandsweep, the biggest dug field.
  - Report p50, p95 and p99. Pass if p95 ≤ 33.3 ms (30 fps floor); the target is p95 ≤ 16.7 ms.
  - JS update+render time, measured with `performance.now()`, should have p95 ≤ 11 ms (Unity's 65%).
  - Run it in WebKit and on a real iPhone (NotesMosaic playtest). CPU-throttled Chromium is only a proxy.
  - stats-gl gives GPU time in Chromium.
  - Manual: play 15 min on an iPhone and feel for heat or throttling.

**B4 · MUST · No hitches: no long frames during play, taps answered fast.**
- Source: Chrome for Developers, Long Animation Frames API, https://developer.chrome.com/docs/web-platform/long-animation-frames: "A long animation frame is when a rendering update is delayed beyond 50 milliseconds (the same as the threshold for the Long Tasks API)."
- Source: web.dev, INP, https://web.dev/articles/inp: "An INP below or at 200 milliseconds means a page has good responsiveness."
- Source: CrazyGames Quality guidelines, https://docs.crazygames.com/requirements/quality/: "The game responds quickly to the player's actions."
- Automatic test:
  - Chromium: `new PerformanceObserver(...).observe({type:'long-animation-frame', buffered:true})` during the bot run. Zero LoAF over 50 ms after the first input, except inside declared loading steps.
  - web-vitals `onINP` on UI taps must be ≤ 200 ms.

**B5 · SHOULD · Draw calls, triangles and memory stay inside a budget, and nothing leaks over a long session.**
- Source: three.js docs, WebGLRenderer, https://threejs.org/docs/pages/WebGLRenderer.html: `.info` "Holds a series of statistical information about the GPU memory and the rendering process. Useful for debugging and monitoring." InfoMemory: "The number of active geometries." / "The number of active textures."
- Source: Roblox, Design for performance, https://create.roblox.com/docs/performance-optimization/design: "choose at least one "baseline" device, test your game on it throughout the development process, and pay close attention to frame rate and memory usage." Its worked example for one baseline device: "you need to stay below 1,000 draw calls and 1,000,000 triangles". This is an example, not a rule.
- Source: Roblox, Performance optimization (URL above): "Even if a game has low starting memory usage, memory leaks can cause that amount to increase over time."
- Automatic test:
  - Read `renderer.info.render.calls` and `.triangles` at 10 fixed camera spots, against a per-game budget set from the iPhone baseline **(ours)**.
  - Run a 20-min soak (repeated raids and digs). Read `renderer.info.memory.geometries/textures` and the JS heap (CDP `Performance.getMetrics`) every 30 s. Fail on steady growth: more than 10% after warm-up **(ours)**.

### C. Mobile input and UI

**C1 · MUST · The whole game is playable by touch alone (and by mouse alone on desktop).**
- Source: GameSnacks (URL above): "Your game must be entirely playable using touch input." "Your game must be entirely playable using mouse input." "Your game should be entirely playable using keyboard input."
- Source: CrazyGames Technical (URL above): "Game supports mouse, keyboard, and touch if mobile is supported."
- Source: Apple HIG, Designing for games, https://developer.apple.com/design/human-interface-guidelines/designing-for-games: "people generally use touch to play games on iPhone; on a Mac, players tend to expect keyboard and mouse or trackpad support"
- Automatic test: use a Playwright WebKit iPhone profile (`isMobile`, `hasTouch`). Complete the core loop using only `touchscreen.tap` and synthesized touch drags.
  - Nest Raid: steal one egg and bank it.
  - Sandsweep: dig, find, sell, then buy one upgrade.
  - Repeat with mouse only on a desktop profile, then keyboard only.

**C2 · MUST · Works upright and turned. Rotating or resizing mid-game breaks nothing.**
- Source: Poki Requirements (URL above): "On mobile, cover the full screen in portrait or landscape, or both for the best experience. Force mobile control schemes on tablets."
- Source: GameSnacks (URL above): "Your game must support a 9:16 portrait aspect ratio." "When the frame size changes, your game must immediately resize to follow these requirements." "Your game must not lock the browser orientation."
- Source: Google Play core app quality (URL above): "App handles rapid transitions between display orientations and device folding and unfolding with no display rendering problems and without losing state."
- Source: Poki, Easy access & onboarding, https://developers.poki.com/guide/easy-access: "we strongly advise supporting portrait: portrait-playable games see more players enter gameplay on average"
- Automatic test: mid-run, switch the viewport between 390×844 and 844×390 ten times, then do free resizes.
  - The canvas must fill the viewport (≤ 2 px letterbox, **ours**).
  - The renderer size and `camera.aspect` must update.
  - The HUD must stay inside the viewport.
  - No console errors.
  - `__test.state()` must be unchanged (position, coins, carried item).

**C3 · MUST · Touch targets are big enough and far enough apart.**
- Source: Apple HIG, Game controls, https://developer.apple.com/design/human-interface-guidelines/game-controls: "Make sure frequently used controls are a minimum size of 44x44 pt, and less important controls, such as menus, are a minimum size of 28x28 pt to accommodate people’s fingers."
- Source: Apple HIG, Accessibility, https://developer.apple.com/design/human-interface-guidelines/accessibility: "In general, it works well to add about 12 points of padding around elements that include a bezel. For elements without a bezel, about 24 points of padding works well around the element’s visible edges."
- Source: Google Play core app quality (URL above): "Touch targets are at least 48 dp."
- Source: WCAG 2.2, SC 2.5.8 (AA), https://www.w3.org/TR/WCAG22/: "The size of the target for pointer inputs is at least 24 by 24 CSS pixels, except when:"
- Source: Game Accessibility Guidelines (basic), https://gameaccessibilityguidelines.com/basic/: "Ensure interactive elements / virtual controls are large and well spaced, particularly on small or touch screens"
- Automatic test: at 375×667 and 430×932, list every DOM control plus the hit rects the game exports for canvas buttons.
  - Gameplay controls must be ≥ 44×44 CSS px; menu controls ≥ 28×28.
  - Bezelled controls must be ≥ 12 px apart.
  - Our conversion, not a source's: on iPhone Safari at default zoom, 1 CSS px = 1 pt.

**C4 · MUST · Controls and HUD stay clear of the notch, Dynamic Island and home indicator.**
- Source: Apple HIG, Game controls (URL above): "Make sure to position buttons where they don’t overlap system features like the Home indicator or Dynamic Island on iPhone."
- Source: CrazyGames, CrazyGames App, https://docs.crazygames.com/resources/crazygames-app/: "For HTML5 games, prefer the CSS safe area environment variables where possible" and "Keep gameplay fullscreen, but move important UI into the safe area."
- Source: Roblox, Cross-platform, https://create.roblox.com/docs/projects/cross-platform: "Ensure that all buttons/controls are interactable and that they are not blocked or obscured by device cutouts or Roblox UI elements."
- Automatic test:
  - HUD CSS must use `env(safe-area-inset-*)`, checked statically.
  - If the test runner cannot emulate the insets, a test stylesheet injects insets measured on a real iPhone, upright and turned **(ours)**. No control rect may intersect them.
  - Take a real-iPhone screenshot via the NotesMosaic playtest.

**C5 · MUST · Browser gestures never leak in: no double-tap zoom, text selection, long-press menu, or page scroll.**
- Source: CrazyGames Technical (URL above): "When playing on some devices like tablets for example, double tapping, or pressing and holding can show the magnification tool, or it can select the entire game and show a contextual menu. To prevent frustration, this CSS should be added to the body of your game:" (`user-select: none`)
- Source: MDN, touch-action, https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action: `none`: "Disable browser handling of all panning and zooming gestures." `manipulation`: "disable additional non-standard gestures such as double-tap to zoom."
- Source: CrazyGames, Common fixes, https://docs.crazygames.com/resources/html5/common-fixes/: "The snippet below addresses common UX issues caused by default browser behavior:" ("Unwanted page scroll", "Unwanted key events"…)
- Source: Poki Requirements (URL above): "prevent game viewport scrolling from affecting the parent page during the review process."
- Automatic test:
  - Double-tap and long-press the canvas. `visualViewport.scale === 1`, `getSelection().toString() === ''`, and no context menu.
  - Space and the arrow keys must not scroll a tall parent page (load the game in an iframe inside one).
  - `getComputedStyle(canvas).touchAction === 'none'`.

**C6 · SHOULD · Thumb layout and feedback follow Apple's touch-control rules.** The movement stick appears where the left thumb lands. The right side pans the camera. Every button shows a press state.
- Source: Apple HIG, Game controls (URL above):
  - "Typically, players expect to control movement using the left side of their screen, and control camera direction using the right side of their screen."
  - "For movement control, opt to show a virtual thumbstick wherever the player lands their thumb instead of a static thumbstick position. For camera control, opt to use direct touch to pan the camera instead of a virtual thumbstick."
  - "Always include visible and tactile press states. A virtual control feels unresponsive without a visual and physical press state."
  - "Place frequently used buttons near a player’s thumb, avoiding the circular regions where players expect movement and camera input to happen."
- Automatic test:
  - Touch down at 20 random points in the left half. The stick's origin (from `__test.state()`) must equal the touch point, and a drag must move the character.
  - A right-half drag must change camera yaw.
  - Each button's rect must differ in a screenshot between touchstart and touchend.

### D. Audio and focus

**D1 · MUST · On tab hide, app switch, screen lock or any overlay or ad, the game pauses and goes silent, then comes back cleanly.**
- Source: MDN, Page Visibility API, https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API: "When the user minimizes the window, switches to another tab, or the document is entirely obscured by another window, the API sends a visibilitychange event … if your web app is playing a video, it can pause the video when the user puts the tab into the background, and resume playback when the user returns to the tab." Also: "Most browsers stop sending requestAnimationFrame() callbacks to background tabs or hidden <iframe>s in order to improve performance and battery life."
- Source: Google Play core app quality (URL above): "When the app is the foreground app, it pauses when the device goes to sleep and resumes when the device wakes up." / "… it pauses when the device is locked and resumes when the device is unlocked."
- Source: Poki Requirements (URL above): "Audio management: automatically mute game audio during advertisement playback." "gameplayStop() must fire on any gameplay interruption (pause, menu open, level end, cutscene)."
- Source: CrazyGames, Advertisement, https://docs.crazygames.com/requirements/ads/: "Ensure that a user cannot progress the game while requesting or showing an ad." "You should mute your audio whenever an advertisement starts playing, and unmute it when the ad has finished."
- Automatic test: run it windowless. Simulate hiding by overriding `document.visibilityState`/`hidden` and dispatching `visibilitychange`, then `pagehide`.
  - Within one frame, game time must stop (Δ = 0 over 5 s), `AudioContext.state` must not be `'running'` (or master gain = 0), and guards and bots must not move.
  - On show, there must be no catch-up jump (clamped dt). The game shows a paused state, or resumes cleanly.
  - Repeat through the game's own pause hook for overlays.
  - Manual on an iPhone: lock and unlock, the home swipe, and a notification.

**D2 · MUST · Audio starts only from a tap, and comes back after iOS interrupts it.**
- Source: CrazyGames Technical (URL above): "On iOS, the AudioContext enters an interrupted state when the app is backgrounded or interrupted by system events like phone calls." "To revive the audio, developers must call the resume() method within a valid user-initiated gesture, such as a touchend or click event. Simply listening for a visibility change is insufficient, as WebKit restricts audio playback until a direct interaction occurs."
- Source: MDN, Autoplay guide, https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay: "In the Web Audio API, a website or app can start playing audio using the start() method on a source node linked to the AudioContext. Doing so outside the context of handling a user input event is subject to autoplay rules."
- Automatic test:
  - Fresh load with no input: no autoplay or NotAllowedError messages in the console.
  - The first `touchend`/`pointerup` must leave `ctx.state === 'running'`.
  - In WebKit, call `ctx.suspend()` to stand in for an interruption. The next touchend must make it `'running'` again.
  - Manual on an iPhone: a call or Siri mid-game, then a tap. Sound must return.

**D3 · SHOULD · Separate music and SFX volumes, saved across visits, with even sound levels.**
- Source: Game Accessibility Guidelines (basic), https://gameaccessibilityguidelines.com/basic/: "Provide separate volume controls or mutes for effects, speech and background / music" and "Ensure that all settings are saved/remembered"
- Source: CrazyGames Quality (URL above): "Audio levels are consistent." "Sounds aren't too loud or quiet"
- Automatic test:
  - Set music to 0 and SFX to 50, reload, and assert the values are kept (storage wrapped in try/catch, see F3).
  - Loudness: route the master bus to an AnalyserNode in test builds. Flag any SFX whose RMS sits more than 6 dB from the median **(ours)**, or listen by hand.

### E. Accessibility

**E1 · MUST · Text is readable on a phone.**
- Source: Apple HIG, Designing for games (URL above): "To keep text comfortably legible on each device, ensure that it contrasts well with the background and uses at least the recommended minimum text size in each platform." The table gives "iOS, iPadOS | 17 pt | 11 pt" (default | minimum).
- Source: Xbox Accessibility Guideline 101, Text display, https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101: "Mobile/Xbox Game Streaming: 18 px at 100 DPI · 36 px at 200 DPI · 72 px at 400 DPI · Scale linearly as DPI increases". It adds: "For context, a 5.5" screen with a 1080p resolution is roughly 400 DPI."
- Source: CrazyGames Gameplay (URL above): "Text and images must be legible on devices with a devicePixelRatio:1, on responsive iframe sizes (16x9 ratio) and mobile screens (if applicable)." One of its listed sizes is "800 x 450 px (mobile)".
- Automatic test:
  - Every visible DOM text must compute to ≥ 11 CSS px, and HUD and body text to ≥ 17 px, at iPhone sizes.
  - Canvas-drawn labels: the game exports their sizes, which must meet the same rule.
  - Take a DPR-1 screenshot at 800×450 for a manual read.

**E2 · MUST · Text and key icons have enough contrast, and nothing important is shown by colour alone.**
- Source: XAG 102, Contrast, https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102: "Standard-sized text and visual elements (those that aren't considered large-scale) that provide important information or context for gameplay should have a contrast ratio of at least 4.5:1 against their background." "Large-scale text and large-scale visual elements should meet a minimum contrast of 3:1 against their background."
- Source: Game Accessibility Guidelines (basic): "Ensure no essential information is conveyed by a fixed colour alone"
- Automatic test:
  - DOM UI: Lighthouse accessibility audit.
  - HUD over the 3D world: take screenshots at 10 bot positions and compute the WCAG contrast ratio between each label's pixels and the pixels around it. Small text needs ≥ 4.5:1, large text ≥ 3:1.
  - Colour alone: screenshots through a colour-vision-deficiency filter get a manual review. Check guard alert states, rarity colours, and sand versus treasure.

**E3 · MUST · No seizure-risk flashing. Camera shake can be turned off.**
- Source: XAG 118, Photosensitivity, https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/118: "All games should be tested for photosensitive seizure triggers, regardless of whether the game includes intentional flashing." "Flashes occur too frequently (approximately more than three per second)."
- Source: WCAG 2.2, SC 2.3.1 (URL above): "Web pages do not contain anything that flashes more than three times in any one second period, or the flash is below the general flash and red flash thresholds."
- Source: XAG 117, https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117: "Avoid the use of camera shake, camera bobbing effects, motion blur, mouse blur, and more or provide an option to turn off these behaviors."
- Automatic test:
  - Record the bot session with Playwright `recordVideo`, plus a scripted pass through every VFX: alarm, steal, level-up, rare-treasure sparkle. Run EA's open-source IRIS on the video. It must report zero luminance or red-flash failures.
  - With "reduce motion" on, and under Playwright `reducedMotion:'reduce'`, the camera-shake amplitude in `__test.state()` must be 0.

**E4 · SHOULD · Controls are simple and remappable on desktop, and work on any keyboard layout. Hold actions can be toggles. Haptics can be switched off.**
- Source: XAG 107, Input, https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/107: "Players should be given the option to remap all of the controls within the game itself, regardless of platform-level remapping support that might be present." Also: "Toggles and “auto” holds: For game controls that must typically be held down for longer periods of time like accelerating, sprinting, firing a weapon, repetitive jumping, etc. consider allowing players to toggle this action on permanently."
- Source: CrazyGames Quality (URL above): "Note that in some countries, like France, the standard keyboard has AZERTY layout, and the typical WASD keys for movement are ZQSD on that layout."
- Source: GameSnacks (URL above): "If your game includes haptic feedback the user must be able to switch it off."
- Automatic test:
  - Dispatch `KeyboardEvent{code:'KeyW', key:'z'}` and the character must move. This proves bindings use `event.code`.
  - Remap a key, reload, and the binding must be kept.
  - Sprint and dig have a toggle setting.
  - With haptics off, `navigator.vibrate` is never called (stub it and count the calls).

### F. Stability

**F1 · MUST · No crashes and no uncaught errors over a long session.**
- Source: Apple App Store Review Guidelines 2.1(a), https://developer.apple.com/app-store/review/guidelines/: "Make sure your app has been tested on-device for bugs and stability before you submit it … We will reject incomplete app bundles and binaries that crash or exhibit obvious technical problems."
- Source: GameSnacks (URL above): "Your game must not cause consistently reproducible crashes."
- Source: CrazyGames Gameplay (URL above): "Smooth Performance: The game must load quickly and play seamlessly without errors or crashes"
- Source: Poki Requirements (URL above): "Clean build: remove all development tools, debug code, and testing artifacts before publication."
- Source: Android vitals, https://developer.android.com/topic/performance/vitals: "BAD BEHAVIOR THRESHOLD … User-perceived crash rate 1.09% [overall] 8% [per phone model]". This is a native-app benchmark, borrowed for comparison. It is not a web requirement.
- Automatic test:
  - Run a 20–30 min Playwright soak in Chromium and in WebKit: the A3 bot plus a seeded gremlins.js horde (clicker, toucher, typer, fps mogwai). It passes with zero `pageerror`, zero `console.error`, no `page.on('crash')`, and no fps-mogwai errors. Save a Playwright trace on any failure.
  - Build check: no `debugRender`, stats panels or test hooks enabled in the release bundle.
  - Field check: crash and reload rate per device model from telemetry, compared with 1.09% overall and 8% per model.

**F2 · MUST · Memory stays inside iPhone limits.**
- Source: Roblox, Design for performance (URL above): "Lower-end devices, particularly mobile devices, have severe memory limitations and are susceptible to crashes due to out of memory (OOM) errors"
- Source: CrazyGames Technical (URL above): "Unity games will be disabled on iOS by default due to frequent crashes (caused by memory shortage)." For Unity builds it also says: "For iOS devices and low memory Android devices, we choose DPR value of 1 because these devices crash with higher natively supported DPR".
- Automatic test:
  - The B5 soak must stay flat.
  - Assert a pixel-ratio cap on phones: `renderer.getPixelRatio() ≤ 2` **(ours)**.
  - Run 20 min on a real iPhone in the NotesMosaic playtest with no reload or blank canvas.
  - Safari's per-tab memory limit: **not found** (Apple does not publish one).

**F3 · MUST · Progress is saved when the page hides, and the game still runs when storage is blocked.**
- Source: Chrome for Developers, Page Lifecycle API, https://developer.chrome.com/docs/web-platform/page-lifecycle-api: "The transition to hidden is also often the last state change that's reliably observable by developers (this is especially true on mobile…) … In other words, persist any unsaved application state and send any unsent analytics data."
- Source: Poki Requirements (URL above): "Incognito mode restricts localStorage, so wrap localStorage operations in a try/catch. Your game must stay playable." Also: "Save system: implement progress saving where appropriate, or clearly inform players when progress won't be saved upon exit."
- Source: Google Play core app quality (URL above), State_Preservation: "When returning to the foreground, the app restores the preserved state … Examples include changes to editable fields, game progress, menus, videos, and other sections of the app."
- Automatic test:
  - An `addInitScript` makes `localStorage.setItem` throw. The game must boot and play.
  - Earn coins and buy an upgrade, fire `visibilitychange` (hidden), then reload. Coins, upgrades and inventory must be restored.
  - A save written by the previous build must still load.

**F4 · SHOULD · Survives a lost WebGL context.**
- Source: MDN, webglcontextlost event, https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event: "The webglcontextlost event of the WebGL API is fired if the user agent detects that the drawing buffer associated with a WebGLRenderingContext object has been lost."
- Source: MDN, WEBGL_lose_context, https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_lose_context: "exposes functions to simulate losing and restoring a WebGLRenderingContext."
- Automatic test: call `gl.getExtension('WEBGL_lose_context').loseContext()`, wait 1 s, then call `restoreContext()`. The game must either draw again (canvas pixels not blank) or show a "tap to reload" message, with no uncaught exception.

### G. First-time experience

**G1 · MUST · A new player is in control within one tap: no title screen, no splash, no level select.**
- Source: CrazyGames Gameplay (URL above): "Games should land new users in gameplay immediately." "If this is not feasible given the game specifics, a maximum of 1 click is allowed."
- Source: Poki, Easy access & onboarding (URL above): "Skip the menu. For first-time players especially, skip splash screens, title screens, and level selects. Let them jump straight into the good part."
- Source: Apple HIG, Designing for games (URL above): "People appreciate being able to start playing without first having to change a lot of settings."
- Automatic test: in a fresh context with no storage, count the taps from the first painted frame until movement input moves the character. It must be ≤ 1. Log the time it takes.

**G2 · MUST · Onboarding teaches through play, with pictures more than words, the right controls for the device, and a way to skip it.**
- Source: CrazyGames Quality (URL above): "Implement the onboarding in gameplay." "Make the onboarding phase skippable." "Prioritize visuals and limit the use of text for onboarding." "Show the user how to control the game with a keyboard overlay or mouse gestures."
- Source: Poki Requirements (URL above): "Adaptive controls: display appropriate control schemes (mobile controls on mobile/tablets, keyboard instructions on desktop)." "Clear instructions: design tutorials that are visual and intuitive rather than text-heavy."
- Source: Apple HIG, Designing for games (URL above): "Teach through play. Players often learn better when they discover new information and mechanics in the context of your game’s world"
- Automatic test:
  - iPhone and iPad profiles show touch hints and no key glyphs. Desktop shows key hints. iPad gets the mobile controls.
  - The skip path works (state check).
  - Each onboarding step has ≤ 12 words of text **(ours)**.
  - Manual: watch 5 first-time players. Poki: "Playtest recordings show exactly how players move through your opening minutes."

**G3 · SHOULD · A safe start and a fast first reward: the first raid cannot fail, and the first sale and upgrade come quickly.**
- Source: Poki, Easy access & onboarding (URL above): "A safe beginner environment. Start with levels players will easily finish and scale from there. In Subway Surfers, players can't die during onboarding; they just try again until it clicks." "Introduce gradually. Reveal actions and buttons over the first few levels instead of front-loading everything at once."
- Source: Roblox, Onboarding, https://create.roblox.com/docs/production/game-design/onboarding: "New players typically decide their interest in a game within minutes." "Keeping thresholds low for a player's early levels allows them to level up quickly and feel the fun of progression immediately."
- Automatic test: a new-player bot follows the tutorial and times the first full loop (Nest Raid: first egg banked; Sandsweep: first sale) and the first upgrade bought. Targets are ≤ 60 s and ≤ 3 min **(ours)**. Guards must be unable to catch the player during the first raid (state check).

**G4 · SHOULD · Short loops, a goal always on screen, every milestone celebrated, and the funnel measured.**
- Source: Poki, Engagement, https://developers.poki.com/guide/engagement: "Quick, satisfying, repeatable loops of around 3 minutes perform best" "Congratulate the player. Confetti, a happy sound, a few words of praise at every milestone." "Set clear goals."
- Source: CrazyGames Quality (URL above): "There are clear goals that the player can reach."
- Source: Roblox, Onboarding (URL above): "The success of a FTUE is determined by how well it achieves two metrics: Day 1 retention · Onboarding goals". Also: "Providing short, mid, and long-term goals help players conceptualize future play sessions and envision their future success."
- Source: Poki Requirements (URL above): "gameplayStart() must fire on the player's first input (not on load)."
- Automatic test:
  - A goal element is visible in every HUD state (DOM or exported check).
  - Each milestone event in the log has a matching celebration event (sound and VFX).
  - Telemetry tracks loop duration (median ≈ 3 min) and one event per onboarding step, for the funnel and D1 retention.
  - "First input" is counted at the first input, not at load.
  - Manual: whether it is fun.

---

## Part 2. What the engine docs say about the clipping, and the fix they point to

The bug: "Colliders are currently boxes smaller than the buildings." The ISTQB syllabus names this exact defect: "If the collider of the object is much smaller than its visual model, then the character will be able to “fall into the texture” or go through it."

What the sources say to do:

1. **Static buildings: collide against their real shape.**
   - Rapier: trimeshes are "generally useful to describe the fixed environment in games (terrains, buildings, etc.)"
   - Unity: "A good approach is to use Mesh colliders for static scene geometry".
   - Godot: "concave shapes are the best approach for a level's collision", and "you can build a simplified collision mesh in a 3D modeler and have Godot generate a collision shape for it automatically."
   - Unreal: Use Complex Collision As Simple "allows us to use the trimesh for the physics simulation collision". Its chair example: the chair with simple collision makes a falling Pawn "slide off the large angled surface that covers the seat", while on the trimesh chair it "will land on the seat of the chair and stay there."
   - Applied to us: build a Rapier trimesh from each KayKit building's own mesh, or from a low-poly collision mesh made in Blender next to it. Unreal's naming convention for such meshes is "UCX_[RenderMeshName]_##"; we can use the same names in our GLBs **(ours)**. Leave small decoration out on purpose. ISTQB: "some objects in the game may well be decorative and have no collisions at all", but "the presence of a low fence, which suddenly prevents the player from climbing, will annoy the player".
2. **Clean trimeshes.**
   - Rapier: "strongly recommended to avoid triangles that are long and thin"; "TrimeshFlags::FIX_INTERNAL_EDGES is a popular choice to help with correcting ghost collision." Rapier also says "The winding of the triangles of a triangle mesh does not matter." Unity/PhysX differ: "Faces in collision meshes are one-sided."
   - TriMeshFlags reference, https://rapier.rs/javascript3d/enums/TriMeshFlags.html: FIX_INTERNAL_EDGES "eliminate or fix contacts normals that could lead to incorrect bumps in physics simulation (especially on flat surfaces)". MERGE_DUPLICATE_VERTICES and DELETE_DEGENERATE_TRIANGLES also exist.
3. **Moving or thrown things are convex.** Rapier: trimesh on dynamic bodies is "discouraged … Because they have no interior, it is easy for another object to get stuck into them … it is recommended to use a convex decomposition with a compound shape instead." Rapier's `ColliderDesc.convexHull(points)` "will automatically compute the convex hull of the given set of points." Unreal: "results are best when the hulls do not intersect with one another".
4. **The character controller.**
   - Use a capsule ("it is recommended to either use a cuboid, a ball, or a capsule").
   - Keep a small offset that is never zero. API: "This value should not be too large to avoid visual artifacts, but shouldn’t be too small (must not be zero) to improve numerical stability of the character controller." Guide: "It is not recommended to change the offset after the creation of the character controller."
   - Tune autostep, max slope climb angle, min slope slide angle and snap-to-ground (A7).
   - Gravity is on us: "it is up to you to emulate gravity by adding a downward component to that movement vector."
   - Godot's equivalent, safe_margin: "A higher value means it's more flexible for detecting collision, which helps with consistently detecting walls and floors." Unity's: "If your character gets stuck it is most likely because your Skin Width is too small."
5. **Sandsweep's sand.**
   - Rapier: "heightfields are useful to define large parts of terrains with simple topologies" and "use much less memory".
   - Unity warns about mesh colliders that change shape: "Every time the Mesh changes shape, the physics engine needs to recalculate the Mesh collider geometry, which causes a substantial performance overhead."
   - Applied to us: split the dig field into chunks, so one dig rebuilds one small heightfield collider in the same frame as its visual mesh **(ours)**. A4 tests that the two match.
6. **Make the colliders visible while building.**
   - Rapier: "game assets generally don’t match the shapes seen by the physics engine exactly. Therefore a collider given the wrong size … can be difficult to debug (and easy to misinterpret as physics-engine-bugs)." `world.debugRender()` returns line buffers for a three.js LineSegments. Its warning: "The debug-rendering is not free … meant to be enabled only when debugging".
   - Unreal's equivalent is the Player Collision view mode: "Console command: viewmode CollisionPawn … highlights assets that collide with a character or Pawn".
   - Godot's is Debug > Visible Collision Shapes: "collision shapes and raycast nodes (for 2D and 3D) will be visible in the running project."
7. **Camera.** A spring-arm style camera with a collision probe, so the camera never enters a wall (A5).
8. **Fixed timestep.** Fiedler: "Advance the physics simulation ahead in fixed dt time steps while also making sure that it keeps up with the timer values coming from the renderer" (A6).

---

## Part 3. Source notes (every URL, more quotes)

### 3.1 Web game portals

**CrazyGames: Technical requirements**: https://docs.crazygames.com/requirements/technical/
- "A key factor of a web game's success is the time it takes for a user to start playing. This is why we enforce strict file size limits."
- "A maximum total file size of 250MB is allowed. There's a file count limit on 1500 files as high file counts will make loading slower."
- "The game must have an initial download size ≤ 50MB. In order to be eligible for the mobile homepage, the initial download size needs to be ≤ 20MB."
- With the SDK: "the initial download size is measured between the start of loading and the occurence of the first Gameplay start event … This event should be triggered when the user enters in a playable state, so excludes menus and additional loading steps."
- "For externally hosted/loaded files our QA team will evaluate based on the time it takes to reach gameplay (≤ 20 seconds)."
- "Use only relative paths when referring to other files in the game bundle. Never use absolute paths"
- "We expect games to work on Chrome and Edge. Games that don't work well on Safari will be disabled on that browser."
- "Games will be disabled on Chromium OS if they do not work smoothly on a 4GB RAM device."
- "Game supports mouse, keyboard, and touch if mobile is supported."
- "Game should be playable in landscape mode on desktop. We allow vertical/portrait games to be published, especially if they are mobile friendly"
- "You can configure supported orientation in your submission. The website will make sure your game can be played only in those orientations, by asking the users to rotate their devices."
- Double-tap and long-press CSS (`user-select: none`): quoted in C5.
- "Unity games will be disabled on iOS by default due to frequent crashes (caused by memory shortage)."
- "Mobile games should work well inside the CrazyGames App, where games open in fullscreen and can be affected by device safe areas."
- For Unity: "For iOS devices and low memory Android devices, we choose DPR value of 1 because these devices crash with higher natively supported DPR"
- iOS audio: "Android keeps the AudioContext in a running state when a user moves to a different app (while still silencing the audio). On iOS, the AudioContext enters an interrupted state when the app is backgrounded or interrupted by system events like phone calls." The remedy is quoted in D2. "We did notice issues in games using Howler and PlayCanvas."
- FPS requirement: **not found** on this page.

**CrazyGames: Gameplay requirements**: https://docs.crazygames.com/requirements/gameplay/
- "Only games that prioritize quality and gameplay will be allowed on the platform."
- Readable content at DPR 1. The iframe sizes listed include "800 x 450 px (mobile)", "1080 x 607 px (tablet)", "1366 x 768 px (desktop - fullscreen)" and "907 x 510 px (desktop - non-fullscreen)", among others.
- "Consistent Physics: The game's physics must perform consistently across different monitor refresh rates (e.g. 144 Hz, 165 Hz)"
- "Intuitive controls: The game should have intuitive controls on different types of devices."
- "Smooth Performance: The game must load quickly and play seamlessly without errors or crashes"
- "Fullscreen mode is automatically provided by CrazyGames. Custom in-game fullscreen buttons are prohibited"
- Full Launch: "Games should land new users in gameplay immediately." "If this is not feasible given the game specifics, a maximum of 1 click is allowed."

**CrazyGames: Quality guidelines** (recommended, not mandatory): https://docs.crazygames.com/requirements/quality/
- "For a game to be successful it is crucial that users get to gameplay quickly, understand what the game is about and how to control it."
- Onboarding: "Provide a simple onboarding phase where new users land directly." "Implement the onboarding in gameplay." "Focus on the core functionality so users can start playing, avoid explaining every single feature." "Make the onboarding phase skippable." "Prioritize visuals and limit the use of text for onboarding."
- "The controls are consistent and intuitive throughout the game." "The game responds quickly to the player's actions." "The game processes information quickly to give players a feeling of smooth flow and continuity."
- "Audio levels are consistent." "Sounds aren't too loud or quiet"
- Restricted keys: "Escape closes fullscreen" · "Ctrl / Cmd + W closes the tab" · the AZERTY note (E4).

**CrazyGames: Advertisement**: https://docs.crazygames.com/requirements/ads/
- "Advertisements should not be shown while a user is playing."
- "Your game should be paused during a video ad: Ensure that a user cannot progress the game while requesting or showing an ad."
- "Your game should be muted during a video ad … You should mute your audio whenever an advertisement starts playing, and unmute it when the ad has finished."

**CrazyGames: Introduction**: https://docs.crazygames.com/requirements/intro/
- "Our launch process consists of 2 steps." Basic Launch, then Full Launch: "Once your game has been selected for Full Launch, you are required to comply to all integration requirements listed below."

**CrazyGames: Common fixes (HTML5)**: https://docs.crazygames.com/resources/html5/common-fixes/
- The snippet covers "Unwanted page scroll", "Unwanted key events", "Visibility changes on Samsung App" and "Context menu appearing outside the Unity canvas".

**CrazyGames: Mouse control tips**: https://docs.crazygames.com/resources/mouse-control/
- "On desktop, a significant part of our users plays outside fullscreen mode. Your game should avoid users accidentally leaving the game by clicking outside of the game frame."
- For first-person games: "Lock the mouse in the center of the screen during gameplay" and "Implement a keyboard shortcut to unlock the mouse (e.g. Escape, Tab)".

**CrazyGames: CrazyGames App**: https://docs.crazygames.com/resources/crazygames-app/
- "On some devices, rounded corners, notches, and dynamic islands can overlap or cut off UI placed too close to the screen edges. This is especially visible for buttons, menus, health bars, currencies, and other important HUD elements."

**Poki: Requirements**: https://developers.poki.com/guide/requirements-quality
- "Before your game can go live, our QA team checks it against the requirements below."
- Hard requirements: desktop, mobile and tablet support (quoted in C2).
- "16:9 aspect ratio. Your game must scale to cover the full canvas. Scale proportionally to 640x360, 836x470, or 1031x580."
- Incognito (quoted in F3).
- "No external requests. Poki blocks all external requests by default. Bundle fonts, assets, and libraries into your build."
- Technical standards:
  - "gameplayStart() must fire on the player's first input (not on load)."
  - "gameplayStop() must fire on any gameplay interruption (pause, menu open, level end, cutscene)."
  - "Clean build"
  - "Save system"
  - "Small file size. Players tend to move to another game if loading takes more than 10 seconds"
- Platform integration: "prevent game viewport scrolling from affecting the parent page"; "Mobile controls: automatically force mobile control schemes on tablet devices."; "Responsive design: ensure a consistent experience across different screen sizes and input methods."
- UI and UX:
  - "Streamlined entry: minimize UI screens and menus, ideally placing players directly into gameplay."
  - "Keyboard support: for keyboard-controlled games, implement ESC or spacebar for pause/resume."
  - "Cutscene management: ensure all cutscenes and introductory sequences are skippable."
  - "Clear instructions: design tutorials that are visual and intuitive rather than text-heavy."
  - "Adaptive controls"
- Ads: "Audio management: automatically mute game audio during advertisement playback."

**Poki: Choosing your web game engine**: https://developers.poki.com/guide/web-engine
- "File size is important; for a good web game the initial download should not exceed 5MB and 8MB in total."
- On three.js: "The file size of a compressed Three.js project is 151KB." Also: "Three.js does not natively support touch controls and has no built in responsive scaling to portrait or landscape layouts. These need to be programmed in."

**Poki: Easy access & onboarding**: https://developers.poki.com/guide/easy-access
- "You never get a second chance to make a first impression. The first couple of minutes often decide your game's success"
- "Loading screens: a loading bar gives players a sense of progress."
- "Progressive loading: download only the essentials first (menu, tutorial, first stage) and fetch the rest in the background while the player starts. … Drop-off during loading is brutally underestimated."
- Onboarding: "Skip the menu", "A safe beginner environment", "Explain with visuals" and "Introduce gradually" (quoted in G1–G3).
- "A big share of all Poki gameplays are on mobile, so think about mobile compatibility from day one."

**Poki: Engagement**: https://developers.poki.com/guide/engagement
- "Web players have shorter sessions and return less often than mobile players, so the first session carries most of the weight. Quick, satisfying, repeatable loops of around 3 minutes perform best, and about an hour of content is usually the right scope"
- "Support touch and keyboard. Players should navigate with mouse and keyboard alike: WASD or arrows through menus, space or return for the primary button."
- "Keep gameplay continuous. Across every genre, games where the player can constantly perform an action outperform games with waiting and downtime."

**Poki: Inspector**: https://developers.poki.com/guide/inspector
- "Right below your game are some additional details about your game, such as the loading time and file size."
- Scaling tests and a mobile QR mode.

**Google GameSnacks: requirements**: https://developers.google.com/gamesnacks/developer
- Size, device floor, load time, crashes, aspect ratio, touch and haptics: quoted in B1, B2, B3, C1, C2, F1 and E4.
- "The size of the game must not be more than 100 MiB."
- Browsers: "Your game must run correctly on the two most recent major versions of the following browsers: Chrome on Android, iOS, Windows and macOS · Safari on iOS and macOS · Firefox on Android and Windows · Edge on Windows"
- "Your game must clearly communicate to the user if it's paused." "Your game should save user progress when it is paused."
- "Your game must render clearly across different screen resolutions. For example, UI elements must not be blurry, pixelated, or stretched."
- "Your game should make a best effort to be accessible. We recommend aiming to meet the Web Content Accessibility Guidelines (WCAG), level AA."
- GameSnacks-only rules (its SDK): "Your game must not use the web Page Visibility API or similar web APIs." "Your game must not use any other form of storage including cookies, localStorage, sessionStorage, and IndexedDB." "Your game should not show an overall mute button".

**GameDistribution: SDK implementation (GitHub wiki)**: https://github.com/GameDistribution/GD-HTML5/wiki/SDK-Implementation
- "Invoke a method to pause AND mute your game within the SDK_GAME_PAUSE event. Will be called every time a video advertisement is ready to play. It is important that the game is muted, as background audio through video advertisements is forbidden."
- Listed requirements: "Game audio is muted when the ad is displayed" · "The game pauses when the ad is displayed"
- Public file-size or load-time limit: **not found**.

### 3.2 Platform quality bars

**Apple App Store Review Guidelines** (Last Updated: October 16, 2026): https://developer.apple.com/app-store/review/guidelines/
- Before you submit: "Test your app for crashes and bugs."
- 2.1(a): quoted in F1.
- 2.4.2: "Design your app to use power efficiently and be used in a way that does not risk damage to the device. Apps should not rapidly drain battery, generate excessive heat, or put unnecessary strain on device resources."
- 4.2: "Your app should include features, content, and UI that elevate it beyond a repackaged website."
- 4.7 matters to NotesMosaic's own app, which hosts HTML5 games: "Apps may offer certain software that is not embedded in the binary, specifically HTML5 and JavaScript mini apps and mini games … You are responsible for all such software offered in your app, including ensuring that such software complies with these Guidelines and all applicable laws."
- 4.7.1 requires "a method for filtering objectionable material, a mechanism to report content and timely responses to concerns, and the ability to block abusive users".
- 4.7.4: "You must provide an index of software and metadata available in your app."
- 4.7.5 requires a way "to identify software that exceeds the app’s age rating".

**Apple HIG: Designing for games**: https://developer.apple.com/design/human-interface-guidelines/designing-for-games (change log: June 9, 2025)
- "Let people play as soon as installation completes." "Teach through play." "Defer requests until the right time."
- Text sizes, iOS: "17 pt | 11 pt" (default | minimum).
- "buttons in iOS must be at least 44x44 pt to accommodate touch interaction."
- "Integrate device features into your layout … relying on platform-provided safe areas when possible"
- "Make sure in-game menus adapt to different aspect ratios … such as 16:10, 19.5:9, and 4:3."
- "give players the ability to customize parameters like type size, game control mapping, motion intensity, and sound balance."

**Apple HIG: Game controls**: https://developer.apple.com/design/human-interface-guidelines/game-controls (change log: June 9, 2025)
- Touch controls: quoted in C3, C4 and C6.
- "Use symbols that communicate the actions they perform … Avoid using abstract shapes or controller-based naming like A, X, or R1 as artwork"
- "Show and hide virtual controls to reflect gameplay."
- "Combine functionality into a single control."
- Keyboards: "Let players customize key bindings."

**Apple HIG: Accessibility**: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Control sizes, iOS: "44x44 pt | 28x28 pt" (default | minimum), plus the padding quote in C3.
- "Augment audio cues with visual cues. This is especially important for games"
- Contrast: "Up to 17 pts | All | 4.5:1" and "18 pts | All | 3:1" (WCAG AA values, as used by Accessibility Inspector).

**Google Play: core app quality**: https://developer.android.com/docs/quality-guidelines/core-app-quality
- App_Startup_Time, Rendering_Performance, Sleep_Resume / Lock_Resume, Orientation_Transitions, State_Preservation and Touch_Target_Size: quoted above.
- "App does not crash or block the UI thread causing ANR (Android Not Responding) errors."
- Visual_Contrast: "3:1 for large text and graphics" · "4.5:1 for small text (less than 18 pt or less than 14 pt if text is bold)"
- Audio: "When the user initiates audio playback, the app should do one of the following within one second: Start playing the audio · Provide a visual indicator that the audio data is being prepared"

**Android vitals**: https://developer.android.com/topic/performance/vitals
- "Your app's core vitals affect your app's visibility on Google Play."
- Thresholds: user-perceived crash rate 1.09% overall, 8% per phone model; user-perceived ANR rate 0.47% overall, 8% per phone model.
- "The memory usage metric has different thresholds for each device RAM tier and app state, and differs for apps and games." These are native-app metrics.

**Xbox Accessibility Guidelines (XAG)**: https://learn.microsoft.com/en-us/gaming/accessibility/guidelines
- "The XAGs aren't intended to act as a checklist to validate any type of compliance or legal requirements."
- 101 Text display: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101 — the sizes in E1. "Players should be able to resize text up to 200 percent of the minimum font sizes (as previously listed), without the loss of content, functionality, or meaning."
- 102 Contrast: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102 — 4.5:1 and 3:1 (E2). "On mobile/Xbox Game Streaming, large text is defined as: 36 px at 100 DPI · 72 px at 200 DPI · 144 px at 400 DPI". "A high contrast mode (either light, dark, or both) should be provided. When enabled, the contrast ratios should equal or exceed 7:1".
- 107 Input: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/107 — remap and toggles (E4). "A UI should be navigable by using single, non-simultaneous key presses."
- 117 Visual distractions and motion settings: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117
- 118 Photosensitivity: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/118 — "A flash is defined as a 10% change in luminance (where 100% is the maximum luminance of a white screen)". Also: "Flashes take up a certain amount of the screen (approximately 20 percent or more)."

**Game Accessibility Guidelines (basic level)**: https://gameaccessibilityguidelines.com/basic/
- "the four most commonly complained about accessibility issues (source) are remapping, text size, colorblindness, and subtitle presentation."
- Motor: "Include toggle/slider for any haptics" · "Ensure interactive elements / virtual controls are large and well spaced, particularly on small or touch screens" · "Include an option to adjust the sensitivity of controls" · "Allow controls to be remapped / reconfigured"
- Cognitive: "Avoid flickering images and repetitive patterns" · "Include interactive tutorials" · "Allow the game to be started without the need to navigate through multiple levels of menus" · "Use an easily readable default font size"
- Vision: "Provide high contrast between text/UI and background" · "If the game uses field of view (3D engine only), set an appropriate default for the expected viewing environment" · "Ensure no essential information is conveyed by a fixed colour alone"
- Hearing: "Ensure no essential information is conveyed by sounds alone" · "Provide separate volume controls or mutes for effects, speech and background / music"
- General: "Ensure that all settings are saved/remembered" · "Offer a wide choice of difficulty levels"

**WCAG 2.2**: https://www.w3.org/TR/WCAG22/
- SC 2.5.8 (AA): "at least 24 by 24 CSS pixels". SC 2.5.5 (AAA): "at least 44 by 44 CSS pixels".
- SC 2.3.1 (A): the flash rule quoted in E3.

### 3.3 Collision and character movement in engine docs

**Unreal: Simple versus Complex Collision**: https://dev.epicgames.com/documentation/en-us/unreal-engine/simple-versus-complex-collision-in-unreal-engine
- "Simple Collision are primitives like cubes, spheres, capsules, and convex hulls. Complex Collision is the trimesh of a given object."
- "Use Simple Collision As Complex … This helps save memory since we don't need to bake the trimesh"
- "Use Complex Collision As Simple … This allows us to use the trimesh for the physics simulation collision. Note that if you are using UseComplexAsSimple you cannot simulate the object, but you can use it to collide with other simulated (simple) objects."

**Unreal: FBX Static Mesh Pipeline (custom collision, UCX)**: https://dev.epicgames.com/documentation/en-us/unreal-engine/fbx-static-mesh-pipeline-in-unreal-engine
- "Simplified collision geometry is important for optimizing collision detection in-game. … Generally, this is true for any mesh with an opening or concave area that objects need to not collide with."
- Name prefixes: UBX_ (box), UCP_ (capsule), USP_ (sphere), UCX_ (convex). "A Convex object can be any completely closed convex 3D shape."
- "RenderMeshName must be identical to the name of the render mesh the collision mesh is associated with in the 3D application."
- "Currently, spheres are only used for rigid-body collision and Unreal's zero-extent traces (e.g. weapons), not non-zero extent traces (e.g. Player movement). … In general you probably want to create UCX primitives."
- "Breaking up a non-convex mesh into convex primitives is a complex operation, and can give unpredictable results."

**Unreal: Viewport modes (Player Collision)**: https://dev.epicgames.com/documentation/en-us/unreal-engine/viewport-modes-in-unreal-engine
- "Console command: viewmode CollisionPawn" — "The Player Collision viewmode highlights assets that collide with a character or Pawn"

**Unreal: USpringArmComponent**: https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/USpringArmComponent (quoted in A5)

**Unity: Introduction to Mesh colliders**: https://docs.unity3d.com/Manual/mesh-colliders-introduction.html
- "Mesh colliders match the shape of a Mesh exactly, for extremely accurate collision simulation."
- "you can make the shape of the collider exactly the same as the shape of the visible Mesh for the GameObject, which creates more precise and realistic collisions."
- "A good approach is to use Mesh colliders for static scene geometry, and compound colliders for moving GameObjects."
- "Concave Mesh colliders can only be static (that is, they have no physics body) or kinematic"
- "Faces in collision meshes are one-sided. This means GameObjects can pass through them from one direction, but collide with them from the other."

**Unity: Compound colliders**: https://docs.unity3d.com/Manual/compound-colliders-introduction.html
- "They are useful when you need an accurate collider for a concave shape, or if you have a model that would be too computationally demanding to simulate with a Mesh collider."

**Unity: Collider types**: https://docs.unity3d.com/Manual/collider-types-introduction.html
- "Use Static colliders for geometry that always stays in the same place and never moves around (for example, floors, walls and other motionless elements of a Scene)."

**Unity: Character Controller**: https://docs.unity3d.com/Manual/class-CharacterController.html
- "It will slide along walls, walk up stairs (if they are lower than the Step Offset) and walk on slopes within the Slope Limit."
- "The Skin Width is one of the most critical properties to get right when tuning your Character Controller. If your character gets stuck it is most likely because your Skin Width is too small."
- "It's good practice to keep your Skin Width at least greater than 0.01 and more than 10% of the Radius."

**Godot: Collision shapes (3D)**: https://docs.godotengine.org/en/stable/tutorials/physics/collision_shapes_3d.html
- "We recommend favoring primitive shapes for dynamic objects such as RigidBodies and CharacterBodies as their behavior is the most reliable."
- Convex: "Create Single Convex Collision Sibling uses the Quickhull algorithm … Create Multiple Convex Collision Siblings uses the V-HACD algorithm."
- "Concave shapes are the slowest option but are also the most accurate in Godot. You can only use concave shapes within StaticBodies."
- "Most games out there don't have a 100% accurate collision. They find creative ways to hide it or otherwise make it unnoticeable during normal gameplay."

**Godot: Debugging tools**: https://docs.godotengine.org/en/stable/tutorials/scripting/debug/overview_of_debugging_tools.html (Visible Collision Shapes, Part 2)

**Godot: CharacterBody3D**: https://docs.godotengine.org/en/stable/classes/class_characterbody3d.html
- safe_margin: "Extra margin used for collision recovery when calling move_and_slide()."

**Rapier JS 0.21: Character controller**: https://rapier.rs/docs/user_guides/javascript/character_controller
- "The well-known move-and-slide operation is the main feature of a character controller."
- "character-control (especially for the player’s character itself) is often very game-specific. Therefore the builtin character controller may not work perfectly out-of-the-box for all game types."
- "The built-in character controller does not support rotational movement. It only supports translations."
- "these dynamic bodies will generally not react to (i.e. not be pushed by) the character because the character controller’s offset prevents actual contacts from happening." Use `setApplyImpulsesToDynamicBodies(true)`.
- Offset, slopes, autostep, snap and gravity: quoted in A3, A7 and Part 2.

**Rapier JS API: KinematicCharacterController**: https://rapier.rs/javascript3d/classes/KinematicCharacterController.html
- `computedGrounded()`: "The result of ground detection computed by the last call to this.computeColliderMovement."

**Rapier JS 0.21: Colliders**: https://rapier.rs/docs/user_guides/javascript/colliders
- Trimesh, heightfield and convex: quoted above. "A triangle mesh/polyline is composed of triangles/segments with no thickness. This means that geometric queries like point-containment tests won't work intuitively because the triangle mesh is assumed to have no interior."
- So for "is the character inside a building?" tests, measure against the visual mesh with three-mesh-bvh, or use closed convex parts. Do not rely on point containment against a trimesh.

**Rapier JS 0.21: Scene queries**: https://rapier.rs/docs/user_guides/javascript/scene_queries
- `world.castRay`, `world.castShape`, `world.projectPoint`, `world.intersectionsWithPoint`, and "The exact intersection test World.intersectionsWithShape searches for all the colliders with shapes intersecting the given shape."

**Rapier JS 0.21: Debug-renderer**: https://rapier.rs/docs/user_guides/javascript/debug_render (quoted in Part 2)

**Rapier JS 0.21: CCD**: https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd
- "Continuous Collision Detection (CCD) is used to make sure that fast-moving objects don't miss any contacts (a problem usually called tunneling)."

**Rapier JS API: TriMeshFlags**: https://rapier.rs/javascript3d/enums/TriMeshFlags.html (quoted in Part 2)

**Glenn Fiedler: Fix Your Timestep!** (Jun 10, 2004): https://gafferongames.com/post/fix_your_timestep/ (quoted in A4, A6 and Part 2)

### 3.4 QA practice for collision, and automated playtesting

**ISTQB CT-GaMe syllabus v1.0.1** (dated October 21, 2022 on its pages): https://www.istqb.org/wp-content/uploads/2024/11/ISTQB_CT_GaMe_Syllabus_v1.0.1_LtrKuyi.pdf · certification page https://www.istqb.org/certifications/game-testing/
- p. 32–33, Collisions: "A collision mesh or collider is created for the finished object model to interact with its environment and other objects. This an invisible simplified form of an object". Also: "For most static objects in the environment such as buildings, rocks and crashed cars, developers use low-poly colliders." The smaller-collider and larger-collider defects are quoted in A1 and A2.
- p. 38: "Testing that the collision model matches the visual model. … This may lead to defects when the player is visually hidden behind the model, but in fact can be damaged by an enemy."
- p. 41: "The graphics testing tools include automated scripts that provide automatic passage of the character along a given route in the game. They are especially used in performance and compatibility testing."
- p. 53: "Level physical shell settings that prevent the character from getting out of the level or getting stuck in its geometry."
- p. 54: geometry defects (stuck), falling under the map, and inaccessible places ("a certain game character with the help of its unique features (e.g., higher jumps than the rest) may end up in it").

**EA SEED: Augmenting Automated Game Testing with Deep Reinforcement Learning** (IEEE CoG 2020): https://arxiv.org/abs/2103.15819 · https://arxiv.org/pdf/2103.15819
- Abstract: "With DRL, the framework is capable of exploring and/or exploiting the game mechanics based on a user-defined, reinforcing reward signal. As a result, test coverage is increased and unintended game play mechanics, exploits and bugs are discovered in a multitude of game types."
- Walk-through-wall and stuck-detection: quoted in A1 and A3. Fig. 5: "The small boxes show where the agents timeout, clearly indicating where on the map the agents get stuck."

**EA SEED: Improving Playtesting Coverage via Curiosity Driven Reinforcement Learning Agents** (2021): https://arxiv.org/abs/2103.13798
- "Each of these agents is rewarded based on the novelty of its actions, thus encouraging a curious and exploratory behaviour on a complex 3D scenario … The curious agents are able to learn the complex navigation mechanics required to reach the different areas around the map, thus providing the necessary data to identify potential issues."

**Rare, Sea of Thieves automated testing** (GDC 2019 talk by Robert Masella, "Automated Testing of Gameplay Features in 'Sea of Thieves'", GDC Vault id 1026366). GDC Vault was down for maintenance on 2026-10-28, so these quotes come from Game Developer:
- https://www.gamedeveloper.com/production/-i-sea-of-thieves-i-devs-share-automated-testing-tips-at-gdc-2019: "he'll reveal the framework that was built by Rare to easily let team members create automated tests, the different test types the Rare team built, and what test coverage was felt to be right for the game."
- https://www.gamedeveloper.com/design/how-rare-automates-testing-for-ai-and-more-in-sea-of-thieves-part-4-of-4-: "every single time a member of the team attempts to commit their work to the projects source code repository, there are tests ready to check whether the changes this person has proposed will break the game."

**gremlins.js** (monkey testing, MIT): https://github.com/marmelab/gremlins.js
- "A monkey testing library written in JavaScript, for Node.js and the browser. Use it to check the robustness of web applications by unleashing a horde of undisciplined gremlins."
- "the "fps" mogwai monitors the number of frame per second, every 500ms" and "if the number of frames per seconds drops below 10, the fps mogwai will log an error".
- "After 10 errors, a special mogwai stops the test. He's called _Gizmo_".
- It is seedable ("If you want the attack to be repeatable, you need to seed the random number generator"), and Playwright runs it via `page.addInitScript`.
- Species: clicker, toucher, formFiller, scroller and typer gremlins; alert, fps and gizmo mogwais.

**Android UI/Application Exerciser Monkey**: https://developer.android.com/studio/test/other-testing-tools/monkey
- "The Monkey is a program that runs on your emulator or device and generates pseudo-random streams of user events such as clicks, touches, or gestures, as well as a number of system-level events. You can use the Monkey to stress-test applications that you are developing, in a random yet repeatable manner."

**Airtest (NetEase, engine-agnostic, image-based)**: https://github.com/AirtestProject/Airtest
- "Cross-Platform UI Automation Framework for Games and Apps". "Airtest uses image recognition technology to locate UI elements so that you can automate games and apps without injecting any code."

**iv4XR core / aplib (agent-based testing, EU project)**: https://github.com/iv4xr-project/aplib
- "Iv4xr-core is a Java Library providing intelligent agents for automated testing. The primary use case is for testing highly interactive systems such as computer games though the library is generic enough to also be able to handle other types of systems."

**EA IRIS (photosensitivity analysis, open source)**: https://github.com/electronicarts/IRIS
- "IRIS is a solution created by EA to identify video footage that could potentially cause photosensitive epileptic risks." It detects "Luminance flashes" and "Red saturation flashes". It warns that it "is not intended to guarantee, certify or otherwise validate visual content's compliance with legal, regulatory or other requirements."

### 3.5 Tools for automatic checks in a three.js game

- **Rapier debugRender**: https://rapier.rs/docs/user_guides/javascript/debug_render
- **three-mesh-bvh**: https://github.com/gkjohnson/three-mesh-bvh. "A Bounding Volume Hierarchy (BVH) implementation to speed up raycasting and enable spatial queries against three.js meshes." Its examples include "Player movement" (https://gkjohnson.github.io/three-mesh-bvh/characterMovement.html) and "Shape intersection". From API.md, https://github.com/gkjohnson/three-mesh-bvh/blob/master/API.md: `closestPointToPoint` "Computes the closest distance from the point to the mesh".
- **stats-gl**: https://github.com/RenaudRohlinger/stats-gl. "WebGL/WebGPU Performance Monitor with real-time FPS, CPU, and GPU timing. Supports Three.js". Also: "To support GPU monitoring on Safari you need to enable Timer Queries under WebKit Feature Flags > WebGL Timer Queries".
- **stats.js**: https://github.com/mrdoob/stats.js. "FPS Frames rendered in the last second." "MS Milliseconds needed to render a frame." "MB MBytes of allocated memory. (Run Chrome with `--enable-precise-memory-info`)"
- **Spector.js**: https://github.com/BabylonJS/Spector.js. "Explore and Troubleshoot your WebGL scenes (All engines and Vanilla script support) with ease." "It enables capturing of all the available information from a frame."
- **three.js renderer.info**: https://threejs.org/docs/pages/WebGLRenderer.html (quoted in B5)
- **Lighthouse**: https://developer.chrome.com/docs/lighthouse/overview. "Lighthouse is an open-source, automated tool to help you improve the quality of web pages. … It has audits for performance, accessibility, SEO, and more."
- **Web Vitals**: https://web.dev/articles/vitals. "LCP should occur within 2.5 seconds", "INP of 200 milliseconds or less", "CLS of 0.1. or less", and "a good threshold to measure is the 75th percentile of page loads, segmented across mobile and desktop devices." Library: https://github.com/GoogleChrome/web-vitals
- **INP**: https://web.dev/articles/inp (quoted in B4)
- **Long Animation Frames**: https://developer.chrome.com/docs/web-platform/long-animation-frames (quoted in B4)
- **Playwright Trace Viewer**: https://playwright.dev/docs/trace-viewer. "Playwright Trace Viewer is a GUI tool that helps you explore recorded Playwright traces after the script has run. Traces are a great way for debugging your tests when they fail on CI."
- **MDN**: Page Visibility https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API · Autoplay https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay · WEBGL_lose_context https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_lose_context · webglcontextlost https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event · touch-action https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- **Chrome Page Lifecycle API**: https://developer.chrome.com/docs/web-platform/page-lifecycle-api

### 3.6 Casual and mobile UX, and game feel

**Roblox Creator Hub**
- Performance optimization: https://create.roblox.com/docs/performance-optimization. "When a game has a consistent, smooth frame rate, even basic actions like running and jumping feel more precise and enjoyable." "Join time is the total time from when a player clicks the play button to when the world is rendered and they can move. Long join times hurt user acquisition and retention—players may leave before ever entering your experience." "From a business perspective, performant games often have higher user engagement, better user retention, and make more money."
- Design for performance: https://create.roblox.com/docs/performance-optimization/design. "Whenever possible, write event-driven code rather than per-frame calculations." "When you add meshes and textures, use and reuse them rather than importing duplicate copies." "Avoid transparency values other than 0 (visible) and 1 (invisible)."
- Onboarding (FTUE): https://create.roblox.com/docs/production/game-design/onboarding. "Onboarding, also known as the First-Time User Experience (FTUE), comprises the first few minutes of gameplay that new players experience." "Many of the most successful onboarding experiences follow these high-level practices: Teach the essentials · Get to the fun quickly · Leave players wanting more". "It is critical that players understand both what they are expected to do and why they should do it." "Ending the onboarding experience with an intentionally designed moment of joy leaves players feeling accomplished and excited to return for their next session."
- Mobile input: https://create.roblox.com/docs/input/mobile. "The majority of Roblox sessions are played on mobile devices"
- Cross-platform: https://create.roblox.com/docs/projects/cross-platform. "Ensure that all UI elements are visible on all screen sizes and orientations."
- Adaptive design: https://create.roblox.com/docs/production/publishing/adaptive-design. "Always select font sizes that are readable on mobile devices, not just desktop. Test on actual devices, and verify text is legible at the smallest expected size."
- UI/UX design: https://create.roblox.com/docs/production/game-design/ui-ux-design. "small screens can easily get overwhelmed with excessive buttons, screens, and text."

**Unity: Optimize your mobile game performance** (Unity's engineers): https://unity.com/blog/games/optimize-your-mobile-game-performance-tips-on-profiling-memory-and-code-architecture-from
- "Profile early, often, and on the target device."
- "Remember to profile and optimize for both the highest- and lowest-spec devices that you plan to support."
- The frame-budget and thermal 65% quotes are in B3.

**Steve Swink, "Game Feel: The Secret Ingredient"** (Game Developer / Gamasutra, November 23, 2007): https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient
- "game feel is slippery. It’s mostly subconscious, a combination of sights, sounds, and instant response to action. … If it’s off by just a little bit, a game’s goose is cooked."
- "Response -- How the system processes, modifies, and responds to player input in real time." "Context -- How constraints give spatial meaning to motion." "Polish -- The interactive impression of physicality created by the harmony of animation, sounds, and effects with input-driven motion."
- "Polish can include sprays or dustings of particles where things hit or interact, screen shake, view angle shifts, or the squash and stretch of objects colliding."

**"Juice It or Lose It"** (Martin Jonasson and Petri Purho, 2012). GDC Vault listings: https://gdcvault.com/play/1016487/ (down for maintenance on 2026-10-28). No quote verified, and sources disagree on the venue (GDC Europe 2012 or Nordic Game 2012).

**John Nesky, "50 Camera Mistakes"** (GDC 2014): https://www.gamedeveloper.com/design/video-50-common-game-camera-mistakes----and-how-to-fix-them (quoted in A5)

---

## Part 4. Where sources disagree

- **Escape key.** Poki: "implement ESC or spacebar for pause/resume". CrazyGames: "Escape closes fullscreen". Use Space or P for pause, and let Escape fall back to the browser.
- **Orientation.** Poki strongly advises supporting portrait. GameSnacks requires 9:16 portrait and forbids locking orientation. CrazyGames lets you declare the supported orientation and asks the player to rotate. NotesMosaic requires upright and turned, so support both.
- **Touch target units.** Apple: 44×44 pt (28 for menus). Google: 48 dp. WCAG: 24×24 CSS px (AA) and 44×44 (AAA). The strictest that fits the HUD is Apple's 44.
- **GameSnacks-only rules.** No Page Visibility API, no localStorage, no overall mute button. These exist because its SDK handles those things. They apply only to a GameSnacks build; every other source expects the opposite.
- **Frame-rate floor.** GameSnacks: 30 fps on its low-end spec. Google Play core quality: 60 fps. Roblox targets 60. CrazyGames and Poki publish no fps number (**not found**).

## Part 5. Not found, or could not verify

- A numeric fps requirement from CrazyGames or Poki: **not found**.
- A tab-hide pause requirement from CrazyGames or Poki: **not found**. Poki covers "pause" only through `gameplayStop()`. CrazyGames covers only iOS audio resume and ads. The pause-on-hide sources are MDN, Google Play core quality and Chrome's Page Lifecycle doc.
- A GameDistribution file-size, load-time or mobile requirement: **not found** in its public SDK wiki.
- An iOS Safari per-tab memory limit: **not found** (Apple publishes none).
- Poki's player device report numbers: **not found**. The page loads its charts by script, and they did not render in the fetch.
- GDC Vault session pages (Sea of Thieves, 50 Camera Mistakes, Juice It or Lose It): the Vault was down for maintenance on 2026-10-28. Descriptions come from Game Developer articles.
- Maddy Thorson's "Celeste & Forgiveness" (coyote time, jump buffering): **not found** at its source, so it is left out.
- The ISTQB syllabus gives no numeric tolerance for "collider matches visual". Every centimetre tolerance in Part 1 is **ours**.
- Roblox Creator Hub thumb-zone or touch-target size rules: **not found**. Roblox's adaptive and cross-platform pages give principles, not sizes.
- The iPhone conversion 1 CSS px = 1 pt is ours, not from a source.
