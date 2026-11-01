// R: the ride leans. Randy, 1 Nov: "The glide looks stiff and it doesn't lean dynamically when riding". Every number is read off the drawn body, the root's own up, on a ride at sea and on land.
//   node ride_lean.mjs <base> <chromium|webkit>
import { gate } from './lib/h.mjs';
const W = await gate('ride_lean', { budget: 80 });
const { line, open, section, finish } = W;
await section(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'], async () => {
  const { page, errors, close } = await open('?film&fresh&tier=phone');
  const r = await page.evaluate(() => {
    const G = window.__game, Q = window.__qa, h = G.hero, THREE_V = h.pos.constructor, up = new THREE_V(), out = {};
    G.started = G.playing = true; G.quest.events.hold(true); for (const m of G.quest.missions.active.slice()) G.quest.missions.stop(m); if (G.enemies.clearAll) G.enemies.clearAll(); h.inv = 1e6;
    // the lean as drawn: the root's up, read across his own forward (+ = toward his right)
    const lean = () => { h.root.updateMatrixWorld(true); up.set(0, 1, 0).applyQuaternion(h.root.quaternion); const sn = Math.sin(h.drawHeading ?? h.heading), cs = Math.cos(h.drawHeading ?? h.heading); return Math.atan2(-(up.x * cs - up.z * sn), up.y) * 57.3; };
    const run = (f, mx, my = 1, boost = true, each) => { for (let i = 0; i < f; i++) { Q.drive({ my, mx, ud: 0, boost }); G.frame(1 / 60); G.camYaw = h.heading; if (each) each(i); } };
    const start = () => { const w = Q.openWater(120); Q.swimAt(w.x, w.y, -0.3); h.place(); Q.aim(w.ax, w.ay, 0); G.camYaw = h.heading; run(120, 0); return h.state === 'surf'; };
    out.surf = start();
    run(120, 0, 1, true); out.v = Math.hypot(h.vel.x, h.vel.z);
    let peakR = 0, t80 = null, lns = []; const was = lean(); run(90, 1, 1, true, (i) => { const l = lean(); lns.push(l); if (l > peakR) peakR = l; }); for (let i = 0; i < lns.length; i++) if (t80 === null && lns[i] > 0.8 * peakR) t80 = i / 60;
    out.right = peakR; out.t80 = t80; out.was = was;
    let back = null; run(90, 0, 1, true, (i) => { if (back === null && Math.abs(lean()) < 8) back = i / 60; }); out.back = back;
    let peakL = 0; run(90, -1, 1, true, () => { const l = lean(); if (l < peakL) peakL = l; }); out.left = peakL;
    run(120, 0, 1, true); let lo = 99, hi = -99; run(300, 0, 1, true, () => { const l = lean(); if (l < lo) lo = l; if (l > hi) hi = l; }); out.lo = lo; out.hi = hi;
    // slower, the same stick: no boost, down to the ride's own speed
    run(160, 0, 1, false); const vs = Math.hypot(h.vel.x, h.vel.z); let peakS = 0; run(70, 1, 1, false, () => { const l = lean(); if (l > peakS) peakS = l; }); out.slowV = vs; out.slow = peakS;
    return out;
  });
  line('R1', r.surf && r.right >= 22 && r.right <= 34, `a hard turn right tips the whole body into it, from the feet: ${r.right.toFixed(1)}° at ${r.v.toFixed(1)} m/s (22 to 34: the pose adds its own, and at 38 he read as falling over)`);
  line('R2', r.left <= -22 && r.left >= -34, `and the same to the left: ${r.left.toFixed(1)}°`);
  line('R3', r.t80 !== null && r.t80 <= 0.7, `it's quick: 80% of the lean in ${r.t80 === null ? '-' : r.t80.toFixed(2)} s (0.7 at most)`);
  line('R4', r.back !== null && r.back <= 0.9, `let go and he comes back up: under 8° in ${r.back === null ? '-' : r.back.toFixed(2)} s (0.9 at most)`);
  line('R5', r.hi - r.lo >= 2 && r.hi - r.lo <= 16, `ridden straight he's balancing, never rigid: ${r.lo.toFixed(1)}° to ${r.hi.toFixed(1)}° over 5 s (a range of 2 to 16)`);
  line('R6', r.slow < r.right, `the lean follows the speed: ${r.slow.toFixed(1)}° at ${r.slowV.toFixed(1)} m/s against ${r.right.toFixed(1)}° at ${r.v.toFixed(1)}`);
  line('R7', errors.length === 0, `no page errors: ${errors.length}`);
  await close();
});
await finish();
