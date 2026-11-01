// Checks born from the judge's clips: each finding on the screen becomes a number before it's fixed (EPIC §1.2). The wall names the round that found it.
//   J1  (round 5, sprint_1x) the cape stands up over his head at a sprint. Its tip stays under the top of his head at every speed on land, ours.
//   J2  (round 5, walk_quarter) pressing into a wall on foot, his heading swings round through a circle: the stick holds forward and the body turns its back. A wall stops him or he slides along it: he never faces more than 100° off the way he's pushing, ours.
//   J3  (round 6, ice_1x, powers_1x, dodge_quarter) in a fight the lens sat on his chest or inside him: 13 of 18 tiles of `ice` have no hero in them at all, and `powers` shows his stomach filling the frame. A5a reads the arm over all of play; this reads the fights, at every encounter, from the game's own camera: his chest is in the frame and at least 1.5 m from the lens (A5a's arm, ours) in 98% of a fight's frames, and it's never lost for more than 0.5 s, ours.
//   J3c the control: the same fights with every solid off. It says whether the reader sees the solids' doing, or the fight's own framing.
//   J4  (round 6, dive_1x) diving in from the air the lens rides the water: for a third of a second the frame is the surface's mirror of the sky, close up, and he's gone. The lens crosses: it spends at most 0.12 s (ours: 4 frames at 30 Hz) within 0.25 m of the drawn water, at four ways of diving in.
//   J5  (round 6, sprint_1x) at a sprint past a rock the lens snaps in, his head fills the bottom of the frame, and a quarter of a second later it's back: three tiles of the sheet. A snap: the arm comes in to 0.6 of its length or less within 0.1 s (he's two-thirds bigger on the screen at once). At most 2 a minute of sprinting on land, ours.
//   J6  (round 7, the lead's question on promote 4) under low roofs the lens may cut, or swing right round to stand in front of him, and then forward on the stick runs him at the lens. Read over the same fights: a cut is the lens moving over 1 m further than he did in one frame; in front is the lens past 90° of the way he's looking. Reported until a clip says what a player can stand.
//   node judged.mjs <base> <chromium|webkit> [--only=J1,J2,J3,J3c,J4,J5,J6]
import { gate, SMALL } from './lib/h.mjs';
const W = await gate('judged', { budget: 90 });
const { line, section, finish } = W;
await section(['J1'], async () => {
  const { page, close } = await open0();
  const r = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero; Q.start(); G.bot = null; G.look.render = () => {}; const room = 6, W = G.world, H0 = W.heightAt; W.heightAt = () => room; W.collide = (p, r) => { const f = room + r; if (p.z < f) { p.z = f; return true; } return false; }; if (W.sweep) W.sweep = () => null;
    const tip = h.root.getObjectByName('cape_5'), head = h.root.getObjectByName('head'); if (!tip || !head) return { none: true };
    const a = new h.pos.constructor(), b = new h.pos.constructor(), out = {};
    for (const [nm, boost, surge, v] of [['run', false, 0, 7], ['sprint', true, 0, 13], ['super', true, 1, 36]]) { Q.walkAt(100, 100, v, 0, surge); Q.aim(1, 0, 0); Q.drive({ my: 1, mx: 0, ud: 0, boost }); let worst = -1e9; for (let i = 0; i < 180; i++) { if (surge) { h.surge = 1; h.boostHeld = 2; h.boostFuel = 1; } G.frame(1 / 60); if (i < 30) continue; tip.getWorldPosition(a); head.getWorldPosition(b); worst = Math.max(worst, a.y - b.y); } out[nm] = +worst.toFixed(2); }
    W.heightAt = H0; return out;
  });
  if (r.none) line('J1', false, 'no cape or head bone to read'); else { const over = Object.entries(r).filter(([, v]) => v > 0.15); line('J1', over.length === 0, `the cape's tip against his head (round 5, sprint_1x): ${JSON.stringify(r)} m over the head bone at worst (≤ 0.15: the top of his head, ours)`); }
  await close();
});
await section(['J2'], async () => {
  const { page, close } = await open0();
  const r = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, W = G.world, C = W.data.colliders, Hs = Q.hash(C, 16); Q.start(); G.bot = null; G.look.render = () => {};
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), walls = C.filter((c) => c.t === 'box' && Math.max(c.hx, c.hy) > 1.5 && W.heightAt(c.x, c.y) > 0.2 && c.z0 < W.heightAt(c.x, c.y) + 1.5 && c.z1 > W.heightAt(c.x, c.y) + 1), stride = Math.max(1, Math.floor(walls.length / 90)), out = { tried: 0, bad: [], worst: 0 };
    for (let i = 0; i < walls.length; i += stride) { const c = walls[i]; for (const off of [0, 0.5, 1.0, -0.5, -1.0]) {
      const a = (i * 1.7) % 6.283, R = Math.hypot(c.hx, c.hy) + 5, x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R, g = W.heightAt(x, y); if (g < 0.2 || Q.nearest(Hs, C, x, y, g + 0.9).d < 0.8) continue;
      const push = Math.atan2(c.x - x, c.y - y) + off, dx = Math.sin(push), dy = Math.cos(push); Q.walkAt(x, y, dx * 5, dy * 5); Q.aim(dx, dy, 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); const yaw = G.camYaw; out.tried++; let worst = 0, at = null;
      for (let k = 0; k < 150; k++) { h.step(1 / 60); const e = Math.abs(wrap(h.heading - yaw)); if (e > worst) { worst = e; at = k; } }
      if (worst > out.worst) out.worst = worst; if (worst > 1.75) out.bad.push([+x.toFixed(1), +y.toFixed(1), +off.toFixed(1), +(worst * 57.3).toFixed(0), at]); } }
    return out;
  });
  line('J2', r.tried >= 30 && r.bad.length === 0, `pushing into a wall on foot, ${r.tried} tries at 5 angles (round 5, walk_quarter): he faces at worst ${(r.worst * 57.3).toFixed(0)}° off the way he's pushed (≤ 100); ${r.bad.length} over${r.bad.length ? ': ' + r.bad.slice(0, 4).map((b) => `(${b[0]}, ${b[1]}) ${b[3]}° at step ${b[4]}`).join(' · ') : ''}`);
  await close();
});
await section(['J3', 'J3c', 'J6'], async () => {
  const fights = async (solid) => {
    const { page, close } = await open0();
    const r = await page.evaluate((solid) => {
      const Q = window.__qa, G = window.__game, h = G.hero, W = G.world, cam = G.camera, V = h.pos.constructor, c = new V(), v = new V(), d = new V(); Q.start(); G.bot = null; G.look.render = () => {};
      if (!solid) { W.collide = () => false; if (W.sweep) W.sweep = () => null; }
      const list = G.enemies.encounters, stride = Math.max(1, Math.floor(list.length / 24)), out = { frames: 0, bad: 0, close: 0, outside: 0, runMax: 0, foeOn: 0, foeN: 0, near: 99, places: [], cuts: 0, front: 0, front2: 0, frontRun: 0, cutAt: [] };
      for (const k in h.powers) h.powers[k] = true;
      for (let i = 0; i < list.length; i += stride) for (const yaw of [2.4, 0.2]) {
        const e = list[i]; h.inv = 1e6; h.dead = false; h.hp = h.maxHp; h.tide = h.maxTide = 900; h.pos.copy(e.c).add({ x: 3, y: 2, z: 4 }); h.vel.set(0, 0, 0); h.prev.copy(h.pos); h.place(); G.camYaw = yaw; G.camPitch = -0.15; Q.drive({ my: 0, mx: 0, ud: 0, boost: false });
        for (let f = 0; f < 40; f++) G.frame(1 / 60);
        let bad = 0, n = 0, run = 0, runMax = 0, near = 99, cutsHere = 0, frontHere = 0, lx = cam.position.x, ly = cam.position.y, lz = cam.position.z, hx = h.drawPos.x, hy = h.drawPos.y, hz = h.drawPos.z, fr = 0;
        for (let f = 0; f < 300; f++) {
          if (f % 22 === 8) Q._wish.atk = true; if (f % 68 === 30) { for (const k in h.cool) h.cool[k] = 0; h.tide = 900; Q._wish[['dash', 'spin', 'wave', 'call'][Math.floor(f / 68) % 4]] = true; } h.inv = 1e6; G.frame(1 / 60); if (G.quest.cineOn && G.quest.cineOn()) continue;
          cam.updateMatrixWorld(); c.set(h.drawPos.x, h.drawPos.y + 0.5, h.drawPos.z); const dist = cam.position.distanceTo(c); cam.getWorldDirection(d); const front = (c.x - cam.position.x) * d.x + (c.y - cam.position.y) * d.y + (c.z - cam.position.z) * d.z > 0; v.copy(c).project(cam); const inFrame = front && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1, ok = dist >= 1.5 && inFrame;
          { const p = cam.position, moved = Math.hypot(p.x - lx, p.y - ly, p.z - lz), own = Math.hypot(h.drawPos.x - hx, h.drawPos.y - hy, h.drawPos.z - hz); if (moved - own > 1) { out.cuts++; cutsHere++; if (out.cutAt.length < 6) out.cutAt.push([e.id || i, f, +(moved - own).toFixed(1)]); } lx = p.x; ly = p.y; lz = p.z; hx = h.drawPos.x; hy = h.drawPos.y; hz = h.drawPos.z; const cp = Math.cos(G.camPitch), fx = Math.sin(G.camYaw) * cp, fy = Math.sin(G.camPitch), fz = Math.cos(G.camYaw) * cp, tx = c.x - p.x, ty = c.y - p.y, tz = c.z - p.z, l = Math.hypot(tx, ty, tz) || 1, dot = (tx * fx + ty * fy + tz * fz) / l; if (dot < 0) { out.front++; frontHere++; fr++; out.frontRun = Math.max(out.frontRun, fr); if (dot < -0.5) out.front2++; } else fr = 0; }
          n++; near = Math.min(near, dist); if (ok) run = 0; else { bad++; run++; runMax = Math.max(runMax, run); if (dist < 1.5) out.close++; if (!inFrame) out.outside++; }
          const t = h.target; if (t && t.pos) { const dt = cam.position.distanceTo(t.pos), fr = (t.pos.x - cam.position.x) * d.x + (t.pos.y - cam.position.y) * d.y + (t.pos.z - cam.position.z) * d.z > 0; v.copy(t.pos).project(cam); out.foeN++; if (fr && dt > 0.5 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) out.foeOn++; }
        }
        out.frames += n; out.bad += bad; out.runMax = Math.max(out.runMax, runMax); out.near = Math.min(out.near, near); out.places.push({ id: e.id || i, kind: e.kind, x: +h.pos.x.toFixed(0), y: +(-h.pos.z).toFixed(0), z: +h.pos.y.toFixed(0), yaw, bad, n, runMax, near: +near.toFixed(2), cuts: cutsHere, front: frontHere });
      }
      return out;
    }, solid);
    await close(); return r;
  };
  const say = (r) => { const w = r.places.slice().sort((a, b) => b.bad - a.bad).slice(0, 4).filter((p) => p.bad); return `${r.bad} of ${r.frames} frames (${(r.bad / Math.max(1, r.frames) * 100).toFixed(1)}%, ≤ 2%, ours: with no solids at all a dash leaves the frame for 1.1%) lost him: ${r.close} under 1.5 m, ${r.outside} outside the frame; the longest run ${(r.runMax / 60).toFixed(2)} s (≤ 0.5, ours); nearest ${r.near.toFixed(2)} m; what he's fighting on screen ${(r.foeOn / Math.max(1, r.foeN) * 100).toFixed(0)}% of ${r.foeN} frames${w.length ? `; worst: ${w.map((p) => `${p.kind || 'foes'} ${p.id} at (${p.x}, ${p.y}, ${p.z}) yaw ${p.yaw}: ${p.bad} of ${p.n}, ${(p.runMax / 60).toFixed(1)} s, ${p.near} m`).join(' · ')}` : ''}`; };
  const a = await fights(true), ok = a.frames > 3000 && a.bad / a.frames <= 0.02 && a.runMax <= 30;
  line('J3', ok, `a fight from the game's own camera (round 6, ice_1x, powers_1x): ${a.places.length} fights, 5 s each of strikes and every power, across the encounters, two ways of arriving: ${say(a)}`);
  line('J6', true, `the lens in a fight (reported, the eye judges it): ${a.cuts} cuts of over 1 m in a frame in ${a.frames} frames, ${(a.cuts / Math.max(0.01, a.frames / 3600)).toFixed(1)} a minute; fights with any: ${a.places.filter((p) => p.cuts).length} of ${a.places.length}, the most: ${a.places.slice().sort((x, y) => y.cuts - x.cuts).slice(0, 4).filter((p) => p.cuts).map((p) => `${p.id} yaw ${p.yaw}: ${p.cuts}`).join(' · ') || 'none'}; past 90° of the way he's looking on ${a.front} frames (${(a.front / Math.max(1, a.frames) * 100).toFixed(1)}%), past 120° on ${a.front2}, the longest ${(a.frontRun / 60).toFixed(2)} s, the most: ${a.places.slice().sort((x, y) => y.front - x.front).slice(0, 3).filter((p) => p.front).map((p) => `${p.id} yaw ${p.yaw}: ${p.front}`).join(' · ') || 'none'}`);
  const b = await fights(false);
  line('J3c', b.frames > 3000 && b.close / b.frames <= 0.01 && b.runMax <= 30, `the control, the same fights with every solid off: the lens under 1.5 m on ${b.close} frames (≤ 1%), so the arm's shortening is the solids' doing; what's left is the fight's own framing: ${say(b)}`);
});
await section(['J4'], async () => {
  const { page, close } = await open0();
  const r = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, cam = G.camera, w = Q.openWater(120, 14), out = []; Q.start(); G.bot = null;
    const waveAt = G.look.waveAt || (() => 0); G.look.render = () => {};
    for (const [z, vz, pitch] of [[4, 3, -0.5], [6, 0, -0.5], [4, 3, -0.2], [8, -2, -0.8]]) {
      Q.leapAt(w.x, w.y, z, w.ax * 8, w.ay * 8, vz); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); G.camPitch = pitch; h.place();
      let run = 0, top = 0, at = -1, was = 0, crossed = 0;
      for (let i = 0; i < 90; i++) { G.frame(1 / 30); const p = cam.position, d = p.y - waveAt(p.x, p.z); if (Math.abs(d) < 0.25) { run++; if (run > top) { top = run; at = i - run + 1; } } else run = 0; if (was && Math.sign(d) !== Math.sign(was)) crossed++; was = d; }
      out.push({ z, vz, pitch, s: +(top / 30).toFixed(2), at, crossed });
    }
    return out;
  });
  const worst = r.reduce((a, b) => (b.s > a.s ? b : a), r[0]);
  line('J4', worst.s <= 0.12 && r.every((x) => x.crossed >= 1), `diving in from the air (round 6, dive_1x): the lens's longest stay within 0.25 m of the drawn water ${worst.s} s (≤ 0.12, ours), from ${worst.z} m at pitch ${worst.pitch}, from frame ${worst.at}; every dive: ${r.map((x) => `${x.z} m, ${x.pitch}: ${x.s} s, crossed ${x.crossed}`).join(' · ')}`);
  await close();
});
await section(['J5'], async () => {
  const { page, close } = await open0();
  const r = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, W = G.world, C = W.data.colliders, Hs = Q.hash(C, 16), cam = G.camera, d = W.data, S = d.size_m, ox = d.origin[0], oy = d.origin[1]; Q.start(); G.bot = null; G.look.render = () => {};
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, out = { runs: 0, frames: 0, snaps: 0, worst: 1, list: [], armMin: 99 };
    for (let k = 0; k < 8000 && out.runs < 40; k++) {
      const x = ox + rnd() * S, y = oy + rnd() * S, g = W.heightAt(x, y); if (g < 1.5 || Q.nearest(Hs, C, x, y, g + 0.9).d < 1.5) continue;
      const a = rnd() * 6.283, dx = Math.sin(a), dy = Math.cos(a); Q.walkAt(x, y, dx * 6, dy * 6); Q.aim(dx, dy, 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: true }); G.camPitch = -0.1; h.place(); out.runs++;
      const arms = []; let cool = 0;
      for (let i = 0; i < 300; i++) { G.frame(1 / 60); if (G.quest.cineOn && G.quest.cineOn()) { arms.push(arms[arms.length - 1] || 4); continue; } const p = cam.position, A = Math.hypot(p.x - h.drawPos.x, p.y - h.drawPos.y - 0.5, p.z - h.drawPos.z); arms.push(A); out.frames++; out.armMin = Math.min(out.armMin, A); if (cool > 0) { cool--; continue; } if (i >= 66) { const was = arms[i - 6], q = A / was; if (q <= 0.6) { out.snaps++; cool = 60; out.worst = Math.min(out.worst, q); if (out.list.length < 200) out.list.push([+h.pos.x.toFixed(0), +(-h.pos.z).toFixed(0), +h.pos.y.toFixed(0), +was.toFixed(2), +A.toFixed(2)]); } } }
    }
    return out;
  });
  const mins = r.frames / 3600, rate = r.snaps / Math.max(0.01, mins);
  line('J5', r.runs >= 20 && rate <= 2, `the lens snapping in at a sprint on land (round 6, sprint_1x): ${r.snaps} snaps in ${mins.toFixed(1)} min of ${r.runs} runs, ${rate.toFixed(1)} a minute (≤ 2, ours); a snap: the arm to 0.6 of its length or less within 0.1 s; the deepest to ${r.worst.toFixed(2)} of its length; the shortest arm ${r.armMin.toFixed(2)} m${r.list.length ? `; at: ${r.list.slice(0, 4).map((x) => `(${x[0]}, ${x[1]}, ${x[2]}) ${x[3]} to ${x[4]} m`).join(' · ')}` : ''}`);
  await close();
});
async function open0() { return W.open('?film&fresh&tier=phone', { ctx: SMALL }); }
await finish();
