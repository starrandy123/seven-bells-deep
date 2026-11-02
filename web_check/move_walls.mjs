// MOVE's walls: the drawn body, read every frame, on the real game. node move_walls.mjs <base> chromium [--only=M1,M3] [--out=dir]
//   M1 planted feet don't slide · M2 feet on the real ground · M3 no joint pops · M4 turns ease, stops settle, pivots · M5 the jump · M7 slopes · M8 the shore · M12 swims · M14 no dead frames · M20 a real look swipe
// Each reads the drawn bones. Rendering is left out, so it runs in seconds; the rules and the pose are the game's own, frame by frame at the rate named.
import { gate, SMALL, PHONE } from './lib/h.mjs';
const W = await gate('move', { budget: 170, engines: ['chromium', 'webkit'] });     // a phone-sized reading of the feet and frame, and each section's page, in a run of about 30 s
const { line, note, open, section, finish } = W;

// in the page: a rig for reading the drawn body
const RIG = () => {
  const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, THREE_V = h.pos.constructor, q = h.pos.clone();
  G.look.render = () => {}; G.bot = null; if (G.enemies && G.enemies.clearAll) G.enemies.clearAll(); const foesStep = G.enemies.step; G.enemies.step = () => {}; G.quest.step = () => {}; G.quest.draw = () => {}; G.quest.note = () => {};
  Q.calm(); h.inv = 1e6;
  const pick = (n) => h.root.getObjectByName(n), F = { R: pick('foot_R'), L: pick('foot_L') }, T = { R: pick('toe_R'), L: pick('toe_L') }, v = new THREE_V(), v2 = new THREE_V();
  // the sole's two contact points in each foot bone's own space, from the rest pose: heel under the ankle's back, ball at the toe bone
  const sole = {};
  const bones = []; h.root.traverse((o) => { if (o.isBone) bones.push(o); });
  const R = { bones, q: bones.map((x) => x.quaternion.clone()), F, T,
    // the point of the foot that's on the ground: heel while it's rocked back on it, ball otherwise
    heel(l, out) { const s = l.s; F[s].getWorldPosition(out); const fw = l.fw, nw = l.nw, H = b.FT.heel, A = b.FT.h; out.x += -fw[0] * H - nw[0] * A; out.y += -fw[1] * H - nw[1] * A; out.z += -fw[2] * H - nw[2] * A; return out; },
    ball(l, out) { return T[l.s].getWorldPosition(out); },
    kind: (l) => (l.rock > 0.02 ? 'heel' : 'ball'),
    // a fake world: the rules read G.world.heightAt, so a wall can stand him on any shape, out over deep water where nothing else is in the way. fn(x, z) in three's axes; null puts the real one back
    room(fn) { const W = G.world; W.__h0 = W.__h0 || W.heightAt; W.heightAt = fn ? (x, y) => fn(x, -y) : W.__h0; },
    sea: Q.openWater(90, 18),
    // hips' tilt from upright, degrees, in the direction he faces: + forward
    lean() { const m = pick('hips').matrixWorld.elements, up = pick('spine_2'), u = new THREE_V(), v3 = new THREE_V(); pick('hips').getWorldPosition(u); pick('spine_3').getWorldPosition(v3); v3.sub(u).normalize(); const f = v3.x * Math.sin(h.drawYaw) + v3.z * Math.cos(h.drawYaw); return Math.asin(Math.max(-1, Math.min(1, f))) * 57.3; },
    // every animated bone's turn since the last call, degrees a second: the worst, and which
    knees(dt, st) { let w = 0; for (const n of ['shin_R', 'shin_L']) { const x = pick(n), k = 'k' + n, q0 = st[k] || (st[k] = x.quaternion.clone()), d = Math.min(1, Math.abs(q0.dot(x.quaternion))), r = (2 * Math.acos(d) * 57.2958) / dt; if (r > w) w = r; q0.copy(x.quaternion); } return w; },
    joints(dt, st) { let w = 0, who = ''; bones.forEach((x, i) => { const q0 = st[i] || (st[i] = x.quaternion.clone()), d = Math.min(1, Math.abs(q0.dot(x.quaternion))), r = (2 * Math.acos(d) * 57.2958) / dt; if (r > w && !/cape|hair/.test(x.name) && !(x.name === 'weapon' && h.body.sheathK > 0)) { w = r; who = x.name; } q0.copy(x.quaternion); }); return [w, who]; },
    frame(dt, fn) { G.frame(dt); if (fn) fn(); },
    at(x, z, yaw) { const y = G.world.heightAt(x, -z); Q.calm(); h.pos.set(x, y + 0.92, z); h.vel.set(0, 0, 0); h.spd = 0; h.land = true; h.air = false; h.grounded = true; h.surge = 0; h.boostHeld = 0; h.heading = yaw; G.camYaw = yaw; G.camPitch = -0.05; h.place(); },
  };
  // open meadow on Sunward: a clear straight run, and how long it is
  const free = (x, z) => { const p = { x, y: -z, z: G.world.heightAt(x, -z) + 1 }; return !G.world.collide(p, 0.6); };
  const H = (x, z) => G.world.heightAt(x, -z), steep = (x, z) => { const e = 1.5; return Math.hypot(H(x + e, z) - H(x - e, z), H(x, z + e) - H(x, z - e)) / (2 * e); };
  let best = null, bl = 0; const size = G.world.data.size_m / 2;
  for (let x = -size; x < size; x += 12) for (let z = -size; z < size; z += 12) { if (H(x, z) < 1.2) continue;
    for (let a = 0; a < 8; a++) { const yaw = a * Math.PI / 4, sx = Math.sin(yaw), sz = Math.cos(yaw); let r = 0; for (let k = 1; k < 60; k++) { const px = x + sx * k * 3, pz = z + sz * k * 3; if (H(px, pz) < 1 || steep(px, pz) > 0.22 || !free(px, pz)) break; r = k; } if (r > bl) { bl = r; best = { x, z, yaw, run: r * 3 }; } } }
  R.line = best; R.foesStep = foesStep; window.__rig = R; return best;
};

const open1 = async () => { const o = await open('?film&fresh&tier=phone', { ctx: SMALL }); await o.page.evaluate(() => { const G = window.__game; G.started = G.playing = true; }); await o.page.evaluate(RIG).then((b) => note(`clear line: ${JSON.stringify(b)}`)); return o; };

// M1 -------------------------------------------------------------------------------
const M1 = async (page, stamp) => page.evaluate((hz) => {
  const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, R = window.__rig, L = R.line, V = h.pos.constructor, cur = [new V(), new V()], was = [new V(), new V()], dt = 1 / hz;
  const out = { worst: 0, where: '', n: 0, speeds: {}, up: 0 }, hz0 = hz, process_m1 = true;
  const run = (name, wish, secs, warm, cap) => {
    R.at(L.x, L.z, L.yaw); Q.drive(wish); const N = Math.round(secs * hz); let held = [false, false], kinds = ['', ''];
    for (let i = 0; i < N; i++) {
      G.frame(dt);
      b.legs.forEach((l, k) => {
        const down = l.down, kind = R.kind(l); R[kind](l, cur[k]);
        // a foot counts from the frame after it landed until the frame before it lifts; its own step on to the ground is the swing's. A point is only ever compared with itself:
        // heel with heel, ball with ball. A foot rolling from one to the other is on the ground at both
        if (down && held[k] && kind === kinds[k] && i > warm && !(cap && h.spd > cap) && h.land && !h.air) { const m = Math.hypot(cur[k].x - was[k].x, cur[k].y - was[k].y, cur[k].z - was[k].z) * 100; out.n++; if (m > out.worst) { out.worst = m; out.where = `${name} ${h.spd.toFixed(1)} m/s, foot ${l.s}, ${kind}, ${(i * dt).toFixed(2)} s`; } }
        if (hz0 === 60 && name === 'walk' && i < 12 && process_m1) (out.rows = out.rows || []).push(`${i} ${l.s} ${down ? 'D' : 's'} ${kind} ball ${cur[k].x.toFixed(3)} ${cur[k].y.toFixed(3)} ${cur[k].z.toFixed(3)} A ${l.A.map((v) => v.toFixed(3)).join(' ')} rock ${(l.rock || 0).toFixed(3)} toe ${(l.toe || 0).toFixed(3)} ph ${l.ph.toFixed(3)} sp ${h.spd.toFixed(2)} root ${h.root.position.y.toFixed(3)} drop ${(h.dropNow || 0).toFixed(3)} fit ${(h.legFit && h.legFit[k] ? h.legFit[k].share : 0).toFixed(3)}`);
        held[k] = down; kinds[k] = kind; was[k].copy(cur[k]);
      });
      if (h.speed > (out.speeds[name] || 0)) out.speeds[name] = +h.speed.toFixed(1);
    }
  };
  run('walk', { my: 0.22, mx: 0, ud: 0, boost: false }, 3, 5); run('jog', { my: 0.55, mx: 0, ud: 0, boost: false }, 2.5, 5); run('run', { my: 1, mx: 0, ud: 0, boost: false }, 2.5, 5); run('sprint', { my: 1, mx: 0, ud: 0, boost: true }, 2.2, 5, 9.1);
  return out;
}, stamp);

await section(['M1'], async () => {
  const o = await open1();
  for (const hz of [60, 90, 120, 144]) {
    const r = await M1(o.page, hz);
    if (process.argv.includes('--m3') && r.rows) console.log(`M1 frames:\n  ${r.rows.join('\n  ')}`);
    line(`M1${hz === 60 ? '' : '_' + hz}`, r.n > 200 && r.worst <= 3, `planted feet don't slide: at most ${r.worst.toFixed(2)} cm a frame at ${hz} Hz over ${r.n} foot-frames (≤ 3; ${r.where}); speeds reached ${JSON.stringify(r.speeds)}`);
  }
  if (o.errors.length) line('M1e', false, 'page errors: ' + o.errors.slice(0, 3).join(' | '));
  await o.close();
});

// M2 -------------------------------------------------------------------------------
// M1b, M1c: the stride itself, read from the feet and the hips ------------------------
await section(['M1b', 'M1s', 'M1c', 'M6a'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, R = window.__rig, L = R.line, dt = 1 / 60, hips = h.root.getObjectByName('hips'), V = h.pos.constructor, v = new V(), out = { top: 0, topAt: '', rows: [] };
    // every step's length in time, against the speed at it: walk, jog, run, then a sprint and on up to super
    const room = () => { const s = R.sea; R.room(() => 6); R.at(s.x - s.ax * 140, -s.y + s.ay * 140, Math.atan2(s.ax, -s.ay)); }; const starts = []; const steps = (wish, n, noSuper) => { room(); h.boostFuel = 1; Q.drive(wish); let was = b.legs.map((l) => l.down), last = -1, nth = 0; const list = []; for (let i = 0; i < n; i++) { if (noSuper) h.boostHeld = 0; G.frame(dt); b.legs.forEach((l, k) => { if (l.down && !was[k]) { if (last >= 0) { const rate = 1 / ((i - last) * dt); if (++nth > 2) list.push([h.spd, rate]); else starts.push([h.spd, rate, nth]); } last = i; } was[k] = l.down; }); } return list; };      // the first steps of a start aren't a cadence yet, so M1b leaves them out; M1s reads them, because a leg that flickers at every start is seen at every start (QA, second reader)
    const all = [...steps({ my: 0.22, mx: 0, ud: 0, boost: false }, 300), ...steps({ my: 0.55, mx: 0, ud: 0, boost: false }, 240), ...steps({ my: 1, mx: 0, ud: 0, boost: false }, 240), ...steps({ my: 1, mx: 0, ud: 0, boost: true }, 300), ...steps({ my: 1, mx: 0, ud: 0, boost: true }, 300, true)];
    for (const [s, rate] of all) { if (s <= 9.2 && rate > out.top) { out.top = rate; out.topAt = s.toFixed(1); } }
    out.starts = starts.map((x) => [+x[0].toFixed(1), +x[1].toFixed(2), x[2]]); R.room(null); const fast = all.filter((x) => x[0] > 34); out.fast = fast.length ? fast.reduce((a, x) => a + x[1], 0) / fast.length : 0; out.n = all.length; out.vmax = all.reduce((a, x) => Math.max(a, x[0]), 0);
    out.at = [1.3, 3.9, 5.9, 9.1, 20, 36].map((s) => { const near = all.filter((x) => Math.abs(x[0] - s) < 1.2); return near.length ? `${s} m/s ${(near.reduce((a, x) => a + x[1], 0) / near.length).toFixed(2)}/s` : ''; }).filter(Boolean);
    // the hips over a walk, and where in the step they're lowest
    const walk = () => { room(); Q.drive({ my: 0.22, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 70; i++) G.frame(dt); const ys = [], marks = []; let was = b.legs.map((l) => l.down); for (let i = 0; i < 150; i++) { G.frame(dt); hips.getWorldPosition(v); ys.push(v.y - G.world.heightAt(h.pos.x, -h.pos.z)); b.legs.forEach((l, k) => { if (l.down && !was[k]) marks.push(i); was[k] = l.down; }); } let sum = 0, n = 0; for (let m = 0; m + 1 < marks.length; m++) { const a = marks[m], c = marks[m + 1]; let lo = a; for (let i = a; i < c; i++) if (ys[i] < ys[lo]) lo = i; sum += (lo - a) / (c - a); n++; } return { bob: (Math.max(...ys) - Math.min(...ys)) * 100, low: n ? sum / n : -1 }; };
    out.walk = walk(); R.room(null); return out;
  });
  line('M1b', r.top <= 5 && r.top > 3 && r.n > 20, `the step rate stays at or under 5 a second up to sprint: most ${r.top.toFixed(2)}, at ${r.topAt} m/s; ${r.at.join(', ')}`);
  { const top = r.starts.reduce((a, x) => (x[1] > a[1] ? x : a), [0, 0, 0]); line('M1s', r.starts.length >= 8 && top[1] <= 5, `a start's first two steps, which M1b leaves out, at or under M1b's own 5 a second: most ${top[1].toFixed(2)}/s, step ${top[2]} of a start, at ${top[0]} m/s, over ${r.starts.length} steps: ${r.starts.map((x) => x[1].toFixed(1)).join(' ')}`); }
  line('M1c', r.walk.bob >= 2 && r.walk.low >= 0 && r.walk.low <= 0.34, `the hips rise and fall with the steps: ${r.walk.bob.toFixed(1)} cm at a walk (≥ 2), lowest ${(r.walk.low * 100).toFixed(0)} % of the way from one contact to the next (just after it)`);
  // Randy, 1 Nov: "The water on land is unnatural and I can't sprint or climb uphill." f850eb1 made his decision the design: "he walks up to 50 degrees, slowing, scrambles to 68,
// and only a cliff stops him; on land Boost is a steady sprint with no tank and no super speed (that stays the sea's)". These walls hold that, not what came before it
  // held on the real ground, as a player holds it: his top over 5 s
  r.vmax = await o.page.evaluate(() => { const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, L = R.line; R.room(null); R.at(L.x, L.z, L.yaw); h.boostFuel = 1; Q.drive({ my: 1, mx: 0, ud: 0, boost: true }); let top = 0; for (let i = 0; i < 300; i++) { G.frame(1 / 60); top = Math.max(top, Math.hypot(h.vel.x, h.vel.z)); } return top; });
  // and 3f840fb, the same day, made a held sprint roll into a ride on its own water ("for the boost in land, we need the water animation and movement surf"): 19 m/s at most on the flat
  line('M6a', r.vmax >= 12 && r.vmax <= 20 && r.fast === 0, `on land Boost is a sprint that rolls into his water ride, never the sea's super speed (f850eb1, 3f840fb): held 5 s his top is ${r.vmax.toFixed(1)} m/s (12 to 20; the ride's top is 19, the sea's super speed 36), ${r.fast ? 'steps past 34 m/s at ' + r.fast.toFixed(2) + '/s' : 'no step past 34 m/s'}`);
  await o.close();
});

await section(['M2', 'M2k', 'M2h', 'M2j'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, R = window.__rig, V = h.pos.constructor, H = (x, z) => G.world.heightAt(x, -z), dt = 1 / 60, a = new V(), c = new V();
    const out = { foot: 0, footAt: '', share: 0, shareAt: '', sole: 0, soleAt: '', n: 0, drop: 0, seen: {}, hip: 0, hipAt: '', flight: 0, walked: 0, jw: 0, jwAt: '' }, hipB = h.root.getObjectByName('hips'), hv = new V(), st = {};
    // real slopes on real land: for each steepness, the first clear stretch, walked up and across and run down
    const size = G.world.data.size_m / 2, spots = {};
    const steep = (x, z) => { const e = 1.5; return [(H(x + e, z) - H(x - e, z)) / (2 * e), (H(x, z + e) - H(x, z - e)) / (2 * e)]; };
    for (let x = -size; x < size; x += 7) for (let z = -size; z < size; z += 7) { if (H(x, z) < 3) continue; const [gx, gz] = steep(x, z), s = Math.hypot(gx, gz), deg = Math.atan(s) * 57.3; for (const want of [8, 16, 24, 32, 40]) if (Math.abs(deg - want) < 1.2 && !spots[want]) { const p = { x, y: -z, z: H(x, z) + 1.2 }; if (!G.world.collide(p, 0.6)) spots[want] = { x, z, yaw: Math.atan2(gx, gz), deg }; } }
    for (const k in spots) { const s = spots[k], x0 = s.x, z0 = s.z;
      for (const [name, yaw, my] of [['up', s.yaw, 0.25], ['across', s.yaw + 1.57, 0.25], ['down', s.yaw + 3.14, 0.4], ['run up', s.yaw, 1]]) {
        R.at(x0, z0, yaw); Q.drive({ my, mx: 0, ud: 0, boost: false }); const N = 130; let hy0 = null;
        for (let i = 0; i < N; i++) { G.frame(dt); const [jr, jw] = R.joints(dt, st); hipB.getWorldPosition(hv); const hy = hv.y - H(h.pos.x, h.pos.z); if (i < 12) { hy0 = hy; continue; }
          if (!h.air) { const d = Math.abs(hy - hy0) * 100; if (d > out.hip) { out.hip = d; out.hipAt = `${k}° ${name}, ${(i * dt).toFixed(2)} s`; } if (my < 0.5) { out.walked++; if (b.legs.every((l) => !l.down)) { out.flight++; const c = `${k} ${name}`; (out.flightAt = out.flightAt || {})[c] = (out.flightAt[c] || 0) + 1; } } if (jr > out.jw) { out.jw = jr; out.jwAt = `${jw}, ${k}° ${name}, ${(i * dt).toFixed(2)} s`; } } hy0 = hy;
          b.legs.forEach((l, k2) => { const f = h.legFit && h.legFit[k2]; if (f && f.share > out.share) { out.share = f.share; out.shareAt = `${k}° ${name}`; }
            if (!l.down || h.air) return; { const e = 0.6, gx = (H(l.G[0] + e, l.G[2]) - H(l.G[0] - e, l.G[2])) / (2 * e), gz = (H(l.G[0], l.G[2] + e) - H(l.G[0], l.G[2] - e)) / (2 * e); if (Math.hypot(gx, gz) > 0.97) { out.past = (out.past || 0) + 1; return; } } { const f = l.f, S = (t) => (H(l.G[0] + f[0] * (t + 0.15), l.G[2] + f[2] * (t + 0.15)) - H(l.G[0] + f[0] * (t - 0.15), l.G[2] + f[2] * (t - 0.15))) / 0.3; if (Math.abs(S(0.3) - S(-0.3)) > 0.22) { out.kink = (out.kink || 0) + 1; if (Math.abs(l.rock) < 0.05) { R.ball(l, a); R.heel(l, c); const e = Math.max(Math.abs(a.y - H(a.x, a.z)), Math.abs(c.y - H(c.x, c.z))) * 100; out.kinkN = (out.kinkN || 0) + 1; if (e > (out.kinkFoot || 0)) { out.kinkFoot = e; out.kinkAt = `${k}° ${name}, foot ${l.s}, ${(i * dt).toFixed(2)} s, the slope changing by ${Math.abs(S(0.3) - S(-0.3)).toFixed(2)}`; } } return; } }       /* a kink under the foot: its sole can't lie on both sides of it. M2k reads these */ { const e = 0.32, q = (x, z) => Math.abs(h.groundAt(x, z) - H(x, z)) > 0.01; if (q(l.G[0], l.G[2]) || q(l.G[0] + e, l.G[2]) || q(l.G[0] - e, l.G[2]) || q(l.G[0], l.G[2] + e) || q(l.G[0], l.G[2] - e)) { out.edge = (out.edge || 0) + 1; return; } } out.n++;
            // the foot's flat or rocked contact, over the real ground under that point
            if (Math.abs(l.rock) < 0.05) { R.ball(l, a); R.heel(l, c); const e = Math.max(Math.abs(a.y - H(a.x, a.z)), Math.abs(c.y - H(c.x, c.z))) * 100; if (e > out.foot) { out.foot = e; out.footAt = `${k}° ${name}, foot ${l.s}, ${(i * dt).toFixed(2)} s, rock ${l.rock.toFixed(3)}, ph ${l.ph.toFixed(2)}, err ${l.err ? (Math.hypot(...l.err) * 100).toFixed(1) : 0}, ball ${(a.y - H(a.x, a.z)).toFixed(3)}, heel ${(c.y - H(c.x, c.z)).toFixed(3)}, ${h.spd.toFixed(1)} m/s, solo ${(l.solo || 0).toFixed(2)}, gait ${b.gaitOn ? 1 : 0}`; }
              const eN = 0.3, gx = H(l.G[0] + eN, l.G[2]) - H(l.G[0] - eN, l.G[2]), gz = H(l.G[0], l.G[2] + eN) - H(l.G[0], l.G[2] - eN), n = [-gx / (2 * eN), 1, -gz / (2 * eN)], m = Math.hypot(...n), d = (n[0] * l.nw[0] + n[1] * l.nw[1] + n[2] * l.nw[2]) / m, ang = Math.acos(Math.min(1, d)) * 57.3; if (ang > out.sole) { out.sole = ang; out.soleAt = `${k}° ${name}, foot ${l.s}, ${(i * dt).toFixed(2)} s, rock ${l.rock.toFixed(3)}, ph ${l.ph.toFixed(2)}, ${h.spd.toFixed(1)} m/s, n ${n.map((q) => (q / m).toFixed(2))} vs ${l.nw.map((q) => q.toFixed(2))}`; } } });
          out.drop = Math.max(out.drop, h.dropNow || 0); out.seen[k] = (out.seen[k] || 0) + 1; }
      } }
    return out;
  });
  line('M2', r.n > 300 && r.foot <= 3 && Object.keys(r.seen).length >= 3, `planted feet are on the real ground: at most ${r.foot.toFixed(2)} cm off over ${r.n} foot-frames (≤ 3; ${r.footAt}); slopes tried ${Object.keys(r.seen).join(', ')}°; ${r.kink || 0} frames on a kink under the sole, ${r.past || 0} frames on ground past 44° and ${r.edge || 0} on or at the edge of a solid left out (this reads the terrain)`);
  line('M2k', (r.kinkN || 0) === 0 || r.kinkFoot <= 6, `feet on a kink, which M2 leaves out: at most ${(r.kinkFoot || 0).toFixed(2)} cm off over ${r.kinkN || 0} flat-footed frames of ${r.kink || 0} (≤ 6, ours: twice M2's, for a rigid sole across a bend)${r.kinkAt ? `; ${r.kinkAt}` : ''}; M2 leaves out ${((r.kink || 0) / Math.max(1, (r.kink || 0) + r.n) * 100).toFixed(0)}% of the frames it could read`);
  // M2 reads a foot. Nothing read the body on a hill, and on steep ground the hips stepped 30 cm in a frame with both feet off the ground at a walk, under every wall here
  line('M2h', r.hip <= 12 && r.flight <= r.walked * 0.02, `on a hill the hips ride the ground and he walks on his feet: at most ${r.hip.toFixed(1)} cm a frame against the ground under him (≤ 12, M8's own; ${r.hipAt}); both feet off the ground ${r.flight} of ${r.walked} walking frames (≤ 2 %${r.flightAt ? `; ${JSON.stringify(r.flightAt)}` : ''})`);
  line('M2j', r.jw <= 1500, `on a hill no joint passes M3's 1,500°/s: at most ${r.jw.toFixed(0)}°/s (${r.jwAt})`);
  line('M2b', r.share <= 0.9985, `no leg past 0.998 of straight, as a real knee at a heel strike: most ${r.share.toFixed(3)} (${r.shareAt}); hips dropped ${(r.drop * 100).toFixed(0)} cm at most`);
  line('M2c', r.sole <= 6, `the sole follows the slope: at most ${r.sole.toFixed(1)}° off the ground (≤ 6; ${r.soleAt})`);
  await o.close();
});

// M3 -------------------------------------------------------------------------------
await section(['M3', 'M3c'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, L = R.line, dt = 1 / 60, st = {}, s = R.sea;
    const out = { w: 0, who: '', at: '', cases: {}, blow: 0, blowWho: '', blowAt: '', knees: {} }, wasMode = { v: h.body.mode };
    // a blow's active frames: the only class allowed the higher bound
    const active = () => { const a = h.atk; if (!a || h.state !== 'attack') return false; if (a.def) return a.f >= a.def.startup && a.f < a.def.startup + a.def.active; const m = a.m; return !!(m && m.hit && a.t >= m.hit[0] && a.t <= m.hit[1]); };
    const round = {}, ring = []; const hold = (name, wish, secs) => { Q.drive(wish); const N = Math.round(secs * 60); let cw = 0, cwho = '', cwhat = '', at = 0, knee = 0, kAt = 0, tail = 0, keep = null;
      for (let i = 0; i < N; i++) { G.frame(dt); const [w, who] = R.joints(dt, st); ring.push(`${i} ${Math.round(w)} ${who} fall${h.body.fall.mode} root${h.root?.position?.y?.toFixed(2)} ${h.body.legs.map((l, q) => `${l.down ? 'D' : 's'}${l.ph.toFixed(2)} ${(h.legFit && h.legFit[q] ? h.legFit[q].share : 0).toFixed(2)} y${l.A[1].toFixed(2)} c${(l.clear || 0).toFixed(3)} G${l.G[1].toFixed(2)}`).join(' | ')}`); if (ring.length > 7) ring.shift(); if (tail > 0 && keep) { keep.push(ring[ring.length - 1]); tail--; } if (i === 0) continue;
        if (!active() && w > cw) { keep = ring.slice(); tail = 4; round[name] = keep; }
        const kn = R.knees(dt, st); if (i < 24 && kn > knee) { knee = kn; kAt = i * dt; }
        if (active()) { if (w > out.blow) { out.blow = w; out.blowWho = who; out.blowAt = `${name}, ${(i * dt).toFixed(2)} s`; } continue; }
        if (w > cw) { cw = w; cwho = who; at = i * dt; cwhat = `${h.spd.toFixed(1)} m/s, air ${h.air ? 1 : 0}, fall ${h.body.fall.mode}, off ${h.body.inertActive ? 1 : 0}, shot ${h.body.shot ? h.body.shot.name : '-'}, drop ${(h.dropNow || 0).toFixed(3)}, ground ${h.groundAt(h.pos.x, h.pos.z).toFixed(2)}, ${h.body.legs.map((l, q) => `${l.down ? 'D' : 's'}${l.ph.toFixed(2)} ${(h.legFit && h.legFit[q] ? h.legFit[q].share : 0).toFixed(2)} y${l.A[1].toFixed(2)}`).join(' | ')}`; } }
      out.cases[name] = `${Math.round(cw)} ${cwho} @${at.toFixed(2)}`; out.knees[name] = Math.round(knee); if (cw > out.w) { out.w = cw; out.who = cwho; out.at = `${name}, ${at.toFixed(2)} s, ${cwhat}`; } };
    const go = { my: 1, mx: 0, ud: 0, boost: false }, none = { my: 0, mx: 0, ud: 0, boost: false };
    R.at(L.x, L.z, L.yaw); hold('stand', none, 0.5); hold('walk', { ...go, my: 0.22 }, 0.8); hold('start', go, 1.0); hold('sprint', { ...go, boost: true }, 0.7); hold('super', { ...go, boost: true }, 1.6); hold('stop from super', none, 1.3); hold('run', go, 0.8);
    R.at(L.x, L.z, L.yaw); Q.drive(none); for (let i = 0; i < 24; i++) { G.frame(dt); R.joints(dt, st); R.knees(dt, st); } hold('run 2', go, 0.9); h.boostFuel = 1; hold('sprint 2', { ...go, boost: true }, 0.6); hold('stop', none, 1.3); hold('run again', go, 0.8);
    hold('jump', { ...go, jump: true }, 0.25); hold('double', { ...go, jump: true }, 1.2); hold('after', go, 0.5);
    R.at(L.x, L.z, L.yaw); hold('still', none, 0.3); hold('jump up', { ...none, jump: true }, 0.25); hold('in the air', none, 0.9); hold('after 2', none, 0.6);
    R.at(L.x, L.z, L.yaw); hold('still 2', none, 0.3); hold('blow on land', { ...none, atk: true }, 0.9); hold('blow into run', { ...go, atk: true }, 0.8); hold('run on', go, 0.5);
    out.round = round; return out;
  });
  await o.page.evaluate(() => { window.__rig.room(null); });
  line('M3', r.w <= 1500, `outside a blow's active frames no joint passes 1,500°/s: at most ${r.w.toFixed(0)}°/s (${r.who}, ${r.at}); by case ${JSON.stringify(r.cases)}`);
  if (process.argv.includes('--m3')) for (const k of ['super', 'stop from super', 'stop', 'run']) console.log(`M3 frames ${k}:\n  ${(r.round[k] || []).join('\n  ')}`);
  note(`M3 knees, worst rate within 0.4 s of each switch: ${JSON.stringify(r.knees)}`);
  line('M3c', r.blow > 0 && r.blow <= 2700, `inside a blow's active frames no joint passes 2,700°/s: at most ${r.blow.toFixed(0)}°/s (${r.blowWho}, ${r.blowAt})`);
  await o.close();
});

// M3m: every move, in the water and on land, as combat plays its clip --------------------------
await section(['M3m'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, L = R.line, s = R.sea, dt = 1 / 60, st = {}, C = G.combat, out = { w: 0, who: '', blow: 0, blowWho: '', rows: [], n: 0 };
    if (!C.data || !C.data.moves) return { none: true };
    const none = { my: 0, mx: 0, ud: 0, boost: false }; G.bot = null;
    const one = (id, where) => { C.reset(); if (where === 'land') R.at(L.x, L.z, L.yaw); else { Q.swimAt(s.x, s.y, -10); h.place(); } Q.drive(none); h.tide = h.maxTide; h.inv = 1e6; for (let i = 0; i < 30; i++) G.frame(dt); C.startAttack(id); const a = C.cur; if (!a) return; out.n++; let w = 0, who = '', bw = 0; for (let i = 0; i < 200 && C.cur; i++) { h.tide = h.maxTide; G.frame(dt); const [v, b] = R.joints(dt, st); if (id === 'dodge' && where === 'land') out.rows.push(`${i} ${Math.round(v)} ${b} sp${h.spd.toFixed(1)} rock${h.body.legs.map((l) => `${l.down ? 'D' : 's'}${l.ph.toFixed(2)} r${(l.rock || 0).toFixed(2)} y${l.A[1].toFixed(2)}`).join(' | ')} beta${h.body.S.beta.toFixed(2)} T${h.body.S.T.toFixed(2)}`); if (i < 1) continue; const c = C.cur; if (!c) break; const on = c.f >= c.def.startup && c.f < c.def.startup + c.def.active; if (on) bw = Math.max(bw, v); else if (v > w) { w = v; who = `${b} @f${c.f.toFixed(0)}`; } } (out.all = out.all || []).push(`${Math.round(w)} ${id} ${where} ${who}`); if (w > out.w) { out.w = w; out.who = `${id} ${where}, ${who}`; } if (bw > out.blow) { out.blow = bw; out.blowWho = `${id} ${where}`; } };
    for (const id of Object.keys(C.data.moves)) { if (id === 'icepath' || id === 'guard') continue; one(id, 'water'); one(id, 'land'); } C.reset();
    return out;
  });
  if (process.argv.includes('--m3')) console.log(`M3m all: ${(r.all || []).sort((a, b) => parseInt(b) - parseInt(a)).slice(0, 14).join(' · ')}`);
  line('M3m', !r.none && r.n >= 30 && r.w <= 1500 && r.blow <= 2700, r.none ? 'no moves to read' : `every move as combat plays it, ${r.n} runs in water and on land: at most ${r.w.toFixed(0)}°/s outside its active frames (≤ 1,500; ${r.who}), ${r.blow.toFixed(0)}°/s inside (≤ 2,700; ${r.blowWho})`);
  await o.close();
});

// M4 -------------------------------------------------------------------------------
await section(['M4', 'M4f', 'M4p', 'M4l'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, s = R.sea, dt = 1 / 60, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)); R.room(() => 6); const L = { x: s.x, z: -s.y, yaw: Math.atan2(s.ax, -s.ay) };      // a flat of his own over open water: a turn runs off any line, and nothing stands beside this one
    // a turn: the camera (so the stick's meaning) swings by `by`; read the drawn heading's rate each frame
    const turn = (by, secs = 1.0) => { R.at(L.x, L.z, L.yaw); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 70; i++) G.frame(dt); const rates = []; let y0 = h.drawYaw; G.camYaw = L.yaw + by; let minS = 99; for (let i = 0; i < secs * 60; i++) { G.frame(dt); const d = wrap(h.drawYaw - y0) / dt; y0 = h.drawYaw; rates.push(d); minS = Math.min(minS, h.spd); }
      const peak = Math.max(...rates.map(Math.abs)); let worst = 0, at = 0; for (let i = 1; i < rates.length; i++) { const c = Math.abs(rates[i] - rates[i - 1]) / peak; if (c > worst) { worst = c; at = i; } } const first = Math.abs(rates[0]) / peak; return { peak: peak * 57.3, worst: Math.max(worst, first), at: at * dt, minS, near: rates.slice(Math.max(0, at - 3), at + 4).map((x) => Math.round(x * 57.3)), head: rates.slice(0, 5).map((x) => Math.round(x * 57.3)) }; };
    const t90 = turn(1.57), t180 = turn(3.1, 1.4);
    // a turn lands on the stick: how far past it he goes, and how long until he's there and stays
    const land = (by, secs = 1.8) => { R.at(L.x, L.z, L.yaw); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 70; i++) G.frame(dt); const goal = L.yaw + by; G.camYaw = goal; let past = 0, settled = -1; const n = Math.round(secs * 60), err = []; for (let i = 0; i < n; i++) { G.frame(dt); const e = wrap(goal - h.heading) * Math.sign(by); err.push(e); past = Math.max(past, -e); } for (let i = n - 1; i >= 0; i--) if (Math.abs(err[i]) > 0.052) { settled = (i + 1) * dt; break; } return { deg: Math.round(by * 57.3), past: past * 57.3, settled }; };
    const lands = [land(0.8), land(-1.57), land(2.0), land(3.1, 2.2)];
    // leaning into what the feet do
    R.at(L.x, L.z, L.yaw); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 40; i++) G.frame(dt); const lean0 = R.lean(); let lf = -99, lb = 99;
    Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 24; i++) { G.frame(dt); lf = Math.max(lf, R.lean()); } for (let i = 0; i < 50; i++) G.frame(dt); const leanRun = R.lean();
    Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 40; i++) { G.frame(dt); lb = Math.min(lb, R.lean()); }
    let settle = 0, end = 0; for (let i = 0; i < 90; i++) { G.frame(dt); } end = R.lean();
    return { t90, t180, lean0, lf, leanRun, lb, end, lands };
  });
  line('M4', r.t90.worst <= 0.4 && r.t180.worst <= 0.4, `a turn eases in and out: its rate changes in a frame by at most ${(Math.max(r.t90.worst, r.t180.worst) * 100).toFixed(0)} % of its peak (≤ 40 %; 90°: peak ${r.t90.peak.toFixed(0)}°/s, worst ${(r.t90.worst * 100).toFixed(0)} % at ${r.t90.at.toFixed(2)} s; 180°: peak ${r.t180.peak.toFixed(0)}°/s, worst ${(r.t180.worst * 100).toFixed(0)} % at ${r.t180.at.toFixed(2)} s, rates there ${r.t180.near.join(' ')}; first frames ${r.t180.head.join(' ')})`);
  line('M4f', r.lands.every((x) => x.past <= 3 && x.settled >= 0 && x.settled <= x.deg * 0 + 1.6), `a turn lands on the stick, no weaving: ${r.lands.map((x) => `${x.deg}°: ${x.past.toFixed(1)}° past it (≤ 3), within 3° by ${x.settled.toFixed(2)} s`).join('; ')}`);
  line('M4p', r.t180.minS < 2.8, `a 180° at a run pivots: he brakes to ${r.t180.minS.toFixed(1)} m/s to turn (< 2.8)`);
  line('M4l', r.lf - r.lean0 >= 4 && r.lf - r.leanRun >= 3 && r.lean0 - 0 > -99 && r.lb < r.leanRun - 3, `the body leans into a start and back from a stop: +${(r.lf - r.lean0).toFixed(1)}° starting (≥ 4), +${(r.lf - r.leanRun).toFixed(1)}° past a steady run's lean (≥ 3), ${(r.lb - r.leanRun).toFixed(1)}° stopping (≤ -3), at rest again ${r.end.toFixed(1)}° (was ${r.lean0.toFixed(1)}°)`);
  await o.close();
});

// M4r: M4 reads a turn on a flat of its own, which says what the turn is and not what a player gets. The same turns on real ground: slopes under him, kept clear of solids, because a turn into a wall is J2's and M1's (QA, second reader).
await section(['M4r'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, W = G.world, dt = 1 / 60, C = W.data.colliders, Hs = Q.hash(C, 16), H = (x, z) => W.heightAt(x, -z), wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), size = W.data.size_m / 2 - 40, spots = []; R.room(null); let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 60000 && spots.length < 10; k++) { const x = -size + rnd() * size * 2, z = -size + rnd() * size * 2, g = H(x, z); if (g < 1.5) continue; let ok = true; for (const d of [5, 10, 15, 20, 24]) { for (let a = 0; a < 8 && ok; a++) { const px = x + Math.sin(a * 0.785) * d, pz = z + Math.cos(a * 0.785) * d, g2 = H(px, pz); if (g2 < 0.8 || Math.abs(g2 - g) > d * 0.5 || Q.nearest(Hs, C, px, -pz, g2 + 0.9).d < 1.3) ok = false; } if (!ok) break; } if (ok && !spots.some((s) => Math.hypot(s.x - x, s.z - z) < 60)) spots.push({ x, z, g: +g.toFixed(1) }); }
    const turn = (s, yaw, by, secs) => { const sx = Math.sin(yaw), sz = Math.cos(yaw); R.at(s.x - sx * 8, s.z - sz * 8, yaw); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 70; i++) G.frame(dt); const rates = []; let y0 = h.drawYaw; G.camYaw = yaw + by; let air = 0; for (let i = 0; i < secs * 60; i++) { G.frame(dt); const d = wrap(h.drawYaw - y0) / dt; y0 = h.drawYaw; rates.push(d); if (h.air) air++; }
      const peak = Math.max(...rates.map(Math.abs)); let worst = Math.abs(rates[0]) / peak, at = 0; for (let i = 1; i < rates.length; i++) { const c = Math.abs(rates[i] - rates[i - 1]) / peak; if (c > worst) { worst = c; at = i; } } return { worst, at: at * dt, peak: peak * 57.3, air, near: rates.slice(Math.max(0, at - 2), at + 3).map((x) => Math.round(x * 57.3)), s, by }; };
    const out = { n: 0, worst: 0, at: null, spots: spots.length, air: 0, over: 0 };
    for (const s of spots) for (const y of [0.4, 2.0, 3.6, 5.2]) for (const [by, secs] of [[1.57, 1], [-1.57, 1], [3.1, 1.4]]) { const t = turn(s, y, by, secs); out.n++; if (t.air) { out.air++; continue; } if (t.worst > 0.4) out.over++; if (t.worst > out.worst) { out.worst = t.worst; out.at = { x: Math.round(s.x), z: Math.round(s.z), g: s.g, yaw: y, by, peak: Math.round(t.peak), when: +t.at.toFixed(2), near: t.near }; } }
    return out;
  });
  line('M4r', r.spots >= 5 && r.n - r.air >= 30 && r.worst <= 0.4, `a turn on real ground, the walkable slopes of ${r.spots} places clear of solids, ${r.n} turns of 90° and 180° at a run: its rate changes in a frame by at most ${(r.worst * 100).toFixed(0)} % of its peak (≤ 40 %, M4's bound); ${r.over} over; ${r.air} left out because he left the ground in the turn${r.at ? `; worst ${JSON.stringify(r.at)}` : ''}`);
  await o.close();
});

// M4b, M4c: stops settle, pivots fire across their range -----------------------------
await section(['M4b', 'M4c'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, R = window.__rig, L = R.line, dt = 1 / 60, go = { my: 1, mx: 0, ud: 0, boost: false }, none = { my: 0, mx: 0, ud: 0, boost: false }, V = h.pos.constructor, a = new V(), c = new V();
    const sea = R.sea, FLOOR = 6, far = (k) => [sea.x - sea.ax * k, -sea.y + sea.ay * k]; R.room(() => FLOOR); const yawS = Math.atan2(sea.ax, -sea.ay);
    R.at(...far(120), yawS); Q.drive(none); for (let i = 0; i < 60; i++) G.frame(dt); const rest = R.lean();
    const stop = (name, wish, warm) => { R.at(...far(120), yawS); h.boostFuel = 1; Q.drive(wish); for (let i = 0; i < warm; i++) G.frame(dt); const from = h.spd; Q.drive(none); const s = []; for (let i = 0; i < 170; i++) { G.frame(dt); s.push(R.lean() - rest); }
      // the lean goes back past rest as he brakes, then returns: how far it swings through rest on the way back, against the excursion
      const lo = Math.min(...s), hi = Math.max(...s.slice(s.indexOf(lo))), over = lo < -2 ? Math.max(0, hi) / Math.abs(lo) : 0; let flips = 0; for (let i = 1; i < s.length; i++) if (Math.abs(s[i]) > 0.3 && Math.abs(s[i - 1]) > 0.3 && s[i] * s[i - 1] < 0) flips++; return { name, from: +from.toFixed(1), lo: +lo.toFixed(1), over: +(over * 100).toFixed(0), flips, end: +h.spd.toFixed(2) }; };
    const stops = [stop('run', go, 70), stop('fast', { ...go, boost: true }, 12), stop('sprint', { ...go, boost: true }, 30), stop('super', { ...go, boost: true }, 180)]; R.room(null);
    // a sharp turn fires the pivot, with the feet pinned through it
    const piv = (deg) => { R.at(L.x, L.z, L.yaw); Q.drive(go); for (let i = 0; i < 70; i++) G.frame(dt); G.camYaw = L.yaw + (deg * Math.PI) / 180; let fired = false, slide = 0, held = [false, false], kinds = ['', ''], was = [new V(), new V()], cur = [new V(), new V()]; for (let i = 0; i < 70; i++) { G.frame(dt); if (h.pivot) fired = true; b.legs.forEach((l, k) => { const kind = R.kind(l); R[kind](l, cur[k]); if (l.down && held[k] && kind === kinds[k]) slide = Math.max(slide, Math.hypot(cur[k].x - was[k].x, cur[k].y - was[k].y, cur[k].z - was[k].z) * 100); held[k] = l.down; kinds[k] = kind; was[k].copy(cur[k]); }); } return { deg, fired, slide: +slide.toFixed(2) }; };
    return { stops, piv: [120, 135, 150, 165, 180].map(piv), small: piv(100) };
  });
  line('M4b', r.stops.every((s) => s.over <= 10 && s.flips <= 1 && s.end < 0.1), `a stop settles: ${r.stops.map((s) => `from ${s.from} m/s the lean reaches ${s.lo}°, swings through rest by ${s.over} % (≤ 10), ${s.flips} change of sign (≤ 1), ends at ${s.end} m/s`).join('; ')}`);
  line('M4c', r.piv.every((p) => p.fired && p.slide <= 3) && !r.small.fired, `a turn of 120° or more fires the pivot on planted feet: ${r.piv.map((p) => `${p.deg}°: ${p.fired ? 'yes' : 'NO'}, ${p.slide} cm`).join(', ')}; 100°: ${r.small.fired ? 'fired' : 'steered'}`);
  await o.close();
});

// M5 -------------------------------------------------------------------------------
await section(['M5a', 'M5b', 'M5c', 'M5d', 'M5e', 'M5f', 'M5g', 'M5h'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, R = window.__rig, s = R.sea, dt = 1 / 60, FLOOR = 6;
    // over deep water, on a made floor: a level meadow with a ledge 30 m on, for the coyote
    const ax = s.ax, az = -s.ay, X0 = s.x, Z0 = -s.y, along = (x, z) => (x - X0) * ax + (z - Z0) * az;
    R.room((x, z) => (along(x, z) > 30 ? FLOOR - 8 : FLOOR));
    const yaw = Math.atan2(ax, az), start = (p = -6) => { R.at(X0 + ax * p, Z0 + az * p, yaw); };
    const none = { my: 0, mx: 0, ud: 0, boost: false }, run = { my: 1, mx: 0, ud: 0, boost: false };
    const apex = (hold, stick = none, pre = 10) => { start(); Q.drive({ ...stick }); for (let i = 0; i < pre; i++) G.frame(dt); const y0 = h.pos.y; Q.drive({ ...stick, jump: true, jumpHeld: true, ud: 1 }); let top = 0, f = 0, left = 0, rose = -1; for (let i = 0; i < 140; i++) { if (i === hold) { Q._wish.jumpHeld = false; Q._wish.ud = 0; } G.frame(dt); if (rose < 0 && h.air) rose = i; top = Math.max(top, h.pos.y - y0); if (i > 6 && !h.air) break; } return { top, rose }; };
    const full = apex(40), tap = apex(2);
    // coyote: off the ledge at a run; press just after leaving, and later
    const coyote = (after) => { start(8); Q.drive(run); let i = 0; for (; i < 400 && !h.air; i++) G.frame(dt); for (let k = 0; k < after; k++) G.frame(dt); const v0 = h.vel.y; Q.drive({ ...run, jump: true, jumpHeld: true, ud: 1 }); G.frame(dt); return { v0, v1: h.vel.y, jumps: h.jumps }; };
    const cIn = coyote(6), cOut = coyote(12);
    // buffer: press 0.1 s before touching down
    start(); Q.drive(none); h.pos.y = FLOOR + 0.92 + 1.5; h.prev.copy(h.pos); h.drawPos.copy(h.pos); h.air = true; h.land = false; h.apexY = h.pos.y; h.vel.set(0, 0, 0); h.jumps = 1; let bufAir = false; { let i = 0; while (i < 200 && h.pos.y + h.vel.y * 0.1 - 15 * 0.01 > FLOOR + 0.92) { G.frame(dt); i++; } Q.drive({ ...none, jump: true, jumpHeld: true, ud: 1 }); for (let k = 0; k < 24; k++) { G.frame(dt); if (k > 8 && h.air && h.vel.y > 2) bufAir = true; } }
    // double
    start(); Q.drive(none); for (let i = 0; i < 6; i++) G.frame(dt); Q.drive({ ...none, jump: true, jumpHeld: true, ud: 1 }); for (let i = 0; i < 22; i++) G.frame(dt); const y1 = h.pos.y, v1 = h.vel.y; Q.drive({ ...none, jump: true, jumpHeld: true, ud: 1 }); for (let i = 0; i < 3; i++) G.frame(dt); const v2 = h.vel.y, j2 = h.jumps; for (let i = 0; i < 4; i++) G.frame(dt); Q.drive({ ...none, jump: true, jumpHeld: true, ud: 1 }); for (let i = 0; i < 2; i++) G.frame(dt); const v3 = h.vel.y, j3 = h.jumps;
    // landings by height
    const drop = (m) => { start(); Q.drive(none); for (let i = 0; i < 8; i++) G.frame(dt); h.pos.y = FLOOR + 0.92 + m; h.prev.copy(h.pos); h.drawPos.copy(h.pos); h.air = true; h.land = false; h.apexY = h.pos.y; h.vel.set(0, 0, 0); let shot = null, st = ''; let lowest = 9; for (let i = 0; i < 160; i++) { G.frame(dt); if (!h.air && !shot) { shot = (b.shot && b.shot.name) || 'none'; st = h.state; } if (!h.air) lowest = Math.min(lowest, (h.dropNow || 0) * -1); } return { shot, st, sink: -lowest }; };
    const d1 = drop(1), d3 = drop(3.5), d9 = drop(9);
    // sprint: the superhero leap
    R.room((x, z) => FLOOR); start(-30); Q.drive({ ...run, boost: true }); for (let i = 0; i < 68; i++) G.frame(dt); const fast = h.spd; Q.drive({ ...run, boost: true, jump: true, jumpHeld: true, ud: 1 }); let top = 0; const y0 = h.pos.y; for (let i = 0; i < 90; i++) { G.frame(dt); top = Math.max(top, h.pos.y - y0); }
    R.room(null);
    return { full, tap, cIn, cOut, bufAir, y1, v1, v2, j2, v3, j3, d1, d3, d9, fast, leap: top };
  });
  line('M5a', Math.abs(r.full.top - 2.4) < 0.06, `a full press reaches the jump's designed apex: ${r.full.top.toFixed(3)} m (2.40 ± 0.06), feet leave at frame ${r.full.rose}`);
  line('M5b', r.tap.top <= r.full.top * 0.5, `height is set by press length: the shortest press reaches ${r.tap.top.toFixed(2)} m, at most half the longest, ${r.full.top.toFixed(2)} m`);
  line('M5c', r.full.rose >= 3 && r.full.rose <= 6, `real anticipation, still answered at once: the feet leave ${r.full.rose} frames after the press (3-6)`);
  line('M5d', r.cIn.v1 > 8 && r.cOut.jumps !== 1, `coyote time: a press 6 frames (0.10 s) off the edge still jumps (v ${r.cIn.v1.toFixed(1)} m/s), 12 frames off it doesn't (v ${r.cOut.v1.toFixed(1)}, jumps ${r.cOut.jumps})`);
  line('M5e', r.bufAir, `a press just before landing is kept: he jumps on touchdown (${r.bufAir})`);
  line('M5f', r.v2 > r.v1 + 3 && r.j2 === 2 && r.j3 === 2 && r.v3 < r.v2, `a second jump in the air and no third: v ${r.v1.toFixed(1)} → ${r.v2.toFixed(1)} m/s, jumps ${r.j2}; third press v ${r.v3.toFixed(1)}, jumps ${r.j3}`);
  line('M5g', r.d1.shot === 'none' && r.d3.shot === 'none' && r.d9.shot === 'land', `landings scale with the fall: 1 m ${r.d1.shot}, 3.5 m ${r.d3.shot}, 9 m ${r.d9.shot}`);
  line('M5h', r.leap > 7, `a superhero leap at sprint: ${r.leap.toFixed(1)} m high at ${r.fast.toFixed(0)} m/s (> 7)`);
  await o.close();
});

// M5g hips, M5i, M5j: the clip and the rules agree -------------------------------------
await section(['M5g2', 'M5i', 'M5j'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, R = window.__rig, s = R.sea, dt = 1 / 60, FLOOR = 6, hips = h.root.getObjectByName('hips'), V = h.pos.constructor, v = new V(); R.room(() => FLOOR);
    const start = () => R.at(s.x, -s.y, 0), none = { my: 0, mx: 0, ud: 0, boost: false };
    start(); Q.drive(none); for (let i = 0; i < 10; i++) G.frame(dt); Q.drive({ ...none, jump: true, jumpHeld: true, ud: 1 }); let shotAt = -1; for (let i = 0; i < 30; i++) { G.frame(dt); if (h.air) { shotAt = b.shot ? b.shot.t : -1; break; } }
    const drop = (m) => { start(); Q.drive(none); for (let i = 0; i < 8; i++) G.frame(dt); h.pos.y = FLOOR + 0.92 + m; h.prev.copy(h.pos); h.drawPos.copy(h.pos); h.air = true; h.land = false; h.apexY = h.pos.y; h.vel.set(0, 0, 0); h.state = 'swim'; let t0 = -1, free = -1, ys = [], worst = 0, wAt = 0; for (let i = 0; i < 260; i++) { G.frame(dt); hips.getWorldPosition(v); ys.push(v.y); if (t0 < 0 && !h.air) t0 = i; if (t0 >= 0 && free < 0 && h.state === 'swim') free = i; if (i > 3) { const n = ys.length, a = Math.abs(ys[n - 1] - 2 * ys[n - 2] + ys[n - 3]) * 3600; if (a > worst) { worst = a; wAt = i - t0; } } } const low = Math.min(...ys.slice(t0)), rest = ys[ys.length - 1], back = ys.slice(t0).findIndex((y, i) => i > 2 && y >= low + (rest - low) * 0.9 && ys[t0 + i - 1] <= y); return { m, hips: Math.round(worst), at: wAt, free: t0 >= 0 && free >= 0 ? +((free - t0) * dt).toFixed(3) : -1, sink: +(rest - low).toFixed(3), back: +(back * dt).toFixed(2) }; };
    const out = { shotAt, takeoff: h.moves.jump && h.moves.jump.takeoff, stands: h.moves.land && h.moves.land.stands, d: [drop(1), drop(3.5), drop(9)] }; R.room(null); return out;
  });
  const w = Math.max(...r.d.map((x) => x.hips));
  line('M5g2', w <= 150 && r.d[2].sink > r.d[1].sink && r.d[1].sink > r.d[0].sink && r.d[2].back > r.d[1].back && r.d[1].back > r.d[0].back, `landings grow with the fall with the hips at or under 150 m/s²: ${r.d.map((x) => `${x.m} m: ${x.hips} m/s² (frame ${x.at}), ${(x.sink * 100).toFixed(0)} cm down, back up in ${x.back} s`).join('; ')}`);
  line('M5i', Math.abs(r.shotAt - r.takeoff) <= 1 / 60 + 1e-3, `the feet leave within a frame of the clip's takeoff: clip at ${r.shotAt.toFixed(3)} s, takeoff ${r.takeoff}`);
  line('M5j', Math.abs(r.d[2].free - r.stands) <= 1 / 30, `control comes back at stands: ${r.d[2].free} s after the landing (stands ${r.stands})`);
  await o.close();
});

// M6b: what shows past the match limit --------------------------------------------------
await section(['M6b'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, L = R.line, dt = 1 / 60; R.at(L.x, L.z, L.yaw); h.boostFuel = 1; Q.drive({ my: 1, mx: 0, ud: 0, boost: true }); let g = 0, d = 0, sp = 0; const under = []; for (let i = 0; i < 230; i++) { G.frame(dt); const a = h.wake ? h.wake.active : { ghosts: 0, dust: 0 }; if (h.spd > 22) { g = Math.max(g, a.ghosts); d = Math.max(d, a.dust); sp = Math.max(sp, h.spd); } else if (h.spd < 12) under.push(a.ghosts); } return { g, d, sp, quiet: under.every((x) => x === 0) };
  });
  // Randy, 1 Nov: "The water on land is unnatural and I can't sprint or climb uphill." f850eb1 made his decision the design: "he walks up to 50 degrees, slowing, scrambles to 68,
// and only a cliff stops him; on land Boost is a steady sprint with no tank and no super speed (that stays the sea's)". These walls hold that, not what came before it
  line('M6b', r.sp === 0 && r.g === 0 && r.quiet, `on land Boost stays under the match limit (22 m/s), so he leaves no afterimages and no dust wake there; they're the sea's super speed's (f850eb1): over 22 m/s ${r.sp ? r.sp.toFixed(0) + ' m/s, ' + r.g + ' ghosts, ' + r.d + ' puffs' : 'never'}; none at a run: ${r.quiet}`);
  await o.close();
});

// M7 -------------------------------------------------------------------------------
await section(['M7', 'M7b', 'M7c', 'M7d'], async () => {
  const o = await open1();
  const r0 = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, s = R.sea, dt = 1 / 60, FLOOR = 6, ax = s.ax, az = -s.ay, X0 = s.x, Z0 = -s.y, yaw = Math.atan2(ax, az);
    const out = [];
    for (const deg of [20, 35, 45, 55, 65, 75]) {
      const t = Math.tan((deg * Math.PI) / 180), rise = 8, run_ = rise / t;
      R.room((x, z) => { const a = (x - X0) * ax + (z - Z0) * az; return a < 0 ? FLOOR : a < run_ ? FLOOR + a * t : FLOOR + rise; });
      for (const [name, my] of [['walk', 0.3], ['run', 1]]) {
        R.at(X0 - ax * 4, Z0 - az * 4, yaw); Q.drive({ my, mx: 0, ud: 0, boost: false }); let jit = 0, pa = 0, topY = 0, back = 0, a0 = -4, stop = 0; const N = Math.round((my < 0.5 ? 18 : 10) * 60), P = [];
        for (let i = 0; i < N; i++) { G.frame(dt); const a = (h.pos.x - X0) * ax + (h.pos.z - Z0) * az; P.push(a); topY = Math.max(topY, h.pos.y - FLOOR - 0.92); if (a < a0 - 0.01) back = Math.max(back, a0 - a); a0 = Math.max(a0, a); }
        // the jitter once he's stopped: taken and given back, frame to frame
        const tail = P.slice(-60); for (let i = 2; i < tail.length; i++) { const d1 = tail[i - 1] - tail[i - 2], d2 = tail[i] - tail[i - 1]; if (d1 * d2 < 0) jit = Math.max(jit, Math.min(Math.abs(d1), Math.abs(d2))); }
        out.push({ deg, name, top: topY, reach: rise, jit: jit * 100, back });
      }
    }
    // the bank stops him cleanly, and he isn't stuck; a run up 35° is slower than on the flat
    const ramp = (deg) => { const t = Math.tan((deg * Math.PI) / 180); R.room((x, z) => { const a = (x - X0) * ax + (z - Z0) * az; return a < 0 ? FLOOR : FLOOR + Math.min(a, 30) * t; }); };
    ramp(75); R.at(X0 - ax * 12, Z0 - az * 12, yaw); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); let t0 = -1, tStop = -1; for (let i = 0; i < 180; i++) { const was = h.spd; G.frame(dt); if (t0 < 0 && i > 8 && h.spd < was - 0.3) t0 = i; if (t0 >= 0 && tStop < 0 && h.spd < 0.05) tStop = i; }
    G.camYaw = yaw + Math.PI; const p0 = h.pos.clone(); for (let i = 0; i < 30; i++) G.frame(dt); const free = h.pos.distanceTo(p0);
    const speedOn = (deg) => { ramp(deg); R.at(X0 + ax * (deg ? 3 : -30), Z0 + az * (deg ? 3 : -30), yaw); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); let m = 0; for (let i = 0; i < 90; i++) { G.frame(dt); m = Math.max(m, Math.hypot(h.pos.x - h.prev.x, h.pos.z - h.prev.z) * 60); } return m; };
    R.room(() => FLOOR); const flat = (R.at(X0 - ax * 30, Z0 - az * 30, yaw), Q.drive({ my: 1, mx: 0, ud: 0, boost: false }), (() => { for (let i = 0; i < 90; i++) G.frame(dt); return h.spd; })()); const hill = speedOn(35);
    R.room(null);
    // a wall: a real solid on land, run into head on, then the stick away
    let wall = null; const W = G.world, H = (x, z) => W.heightAt(x, -z);
    for (const c of W.data.colliders) { if (c.t !== 'box' || c.hx < 2 || c.hy < 2) continue; const cs = Math.cos(c.yaw || 0), sn = Math.sin(c.yaw || 0), nx = cs, ny = sn, px = c.x + nx * (c.hx + 7), py = c.y + ny * (c.hx + 7), g = W.heightAt(px, py); if (g < 1 || c.z1 < g + 2 || c.z0 > g + 0.4) continue; let clear = true; for (let k = 1; k <= 7 && clear; k++) { const q = { x: c.x + nx * (c.hx + 0.5 + k), y: c.y + ny * (c.hx + 0.5 + k), z: W.heightAt(c.x + nx * (c.hx + 0.5 + k), c.y + ny * (c.hx + 0.5 + k)) + 1 }; if (W.collide(q, 0.6) || Math.abs(q.z - 1 - g) > 1) clear = false; } if (clear) { wall = { x: px, z: -py, yaw: Math.atan2(-nx, ny) }; break; } }
    let hitT = -1, wallStop = -1, wFree = 0; if (wall) { R.at(wall.x, wall.z, wall.yaw); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); let was = 0, t1 = -1; for (let i = 0; i < 150; i++) { G.frame(dt); if (t1 < 0 && h.spd < was - 0.5) t1 = i; if (t1 >= 0 && wallStop < 0 && h.spd < 0.05) wallStop = (i - t1) * dt; was = h.spd; } G.camYaw = wall.yaw + Math.PI; const p1 = h.pos.clone(); for (let i = 0; i < 30; i++) G.frame(dt); wFree = h.pos.distanceTo(p1); }
    return { rows: out, extra: { stop: tStop >= 0 && t0 >= 0 ? (tStop - t0) * dt : -1, free, flat, hill, wall: !!wall, wallStop, wFree } };
  });
  const ex = r0.extra, r = r0.rows;
  // Randy, 1 Nov: "The water on land is unnatural and I can't sprint or climb uphill." f850eb1 made his decision the design: "he walks up to 50 degrees, slowing, scrambles to 68,
// and only a cliff stops him; on land Boost is a steady sprint with no tank and no super speed (that stays the sea's)". These walls hold that, not what came before it
  line('M7c', ex.stop >= 0 && ex.stop <= 0.25 && ex.free > 0.15 && ex.wall && ex.wallStop >= 0 && ex.wallStop <= 0.25 && ex.wFree > 0.15, `at a cliff (75°, past the 68° he scrambles to) and at a wall his speed reaches zero within 0.25 s and he isn't stuck: cliff ${ex.stop.toFixed(2)} s, then the stick away moves him ${ex.free.toFixed(2)} m in 0.5 s (a start is the capture's now, M4s and M4w: 0.42 m/s by 0.2 s); wall ${ex.wall ? `${ex.wallStop.toFixed(2)} s, ${ex.wFree.toFixed(2)} m` : 'none found'}`);
  line('M7d', ex.hill < ex.flat * 0.95 && ex.hill > ex.flat * 0.5, `a run up 35° slows him and doesn't stop him (f850eb1: "he walks up to 50 degrees, slowing"; he stood frozen at 40° before it): ${ex.hill.toFixed(1)} of ${ex.flat.toFixed(1)} m/s (50 to 95 %)`);
  // Randy, 1 Nov: "The water on land is unnatural and I can't sprint or climb uphill." f850eb1 made his decision the design: "he walks up to 50 degrees, slowing, scrambles to 68,
// and only a cliff stops him; on land Boost is a steady sprint with no tank and no super speed (that stays the sea's)". These walls hold that, not what came before it
  const up = r.filter((x) => x.deg <= 65), no = r.filter((x) => x.deg >= 70);
  line('M7', up.every((x) => x.top > 3.5) && up.filter((x) => x.name === 'run').every((x) => x.top > x.reach - 0.3) && no.every((x) => x.top < 0.6), `he walks up to 50°, scrambles to 68° and a cliff stops him (f850eb1): ${r.map((x) => `${x.deg}° ${x.name} ${x.top.toFixed(1)} m`).join(', ')} of 8`);
  const j = Math.max(...r.map((x) => x.jit)); line('M7b', j <= 1, `no stair-step jitter at a bank: a move taken and given back at most ${j.toFixed(2)} cm a frame (≤ 1)`);
  await o.close();
});

// M8 -------------------------------------------------------------------------------
await section(['M8'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, s = R.sea, dt = 1 / 60, ax = s.ax, az = -s.ay, X0 = s.x, Z0 = -s.y, yaw = Math.atan2(ax, az);
    // a beach: land behind, the floor falling into deep water ahead
    R.room((x, z) => { const a = (x - X0) * ax + (z - Z0) * az; return 2 - a * 0.14; });
    const H = window.__rig, hipsB = h.root.getObjectByName('hips'), v = new (h.pos.constructor)();
    const leg = (back) => { R.at(X0, Z0, back ? yaw + Math.PI : yaw); if (back) { Q.swimAt(0, 0, 0); h.pos.set(X0 + ax * 36, -1.15, Z0 + az * 36); h.vel.set(0, 0, 0); h.land = false; h.air = false; h.heading = yaw + Math.PI; h.spd = 0; G.camYaw = yaw + Math.PI; h.place(); }
      Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); G.camPitch = 0; let dy = 0, dyAt = 0, hipY = null, dH = 0, hAt = 0, flips = 0, was = h.land, minSp = 99, sp = []; let py = h.pos.y; const N = 60 * 7;
      for (let i = 0; i < N; i++) { G.frame(dt); const d = Math.abs(h.pos.y - py); py = h.pos.y; if (d > dy) { dy = d; dyAt = i * dt; } hipsB.getWorldPosition(v); if (hipY !== null) { const e = Math.abs(v.y - hipY); if (e > dH) { dH = e; hAt = i * dt; } } hipY = v.y; if (h.land !== was) { flips++; was = h.land; } if (h.land) { const a = (h.pos.x - X0) * ax + (h.pos.z - Z0) * az; sp.push([a, h.spd, -G.world.heightAt(h.pos.x, -h.pos.z)]); } }
      return { dy: +dy.toFixed(4), dyAt: +dyAt.toFixed(2), dH: +dH.toFixed(4), hAt: +hAt.toFixed(2), flips, end: [h.pos.y, h.land], sp: sp.filter((_, i) => i % 40 === 0).map((x) => [+x[0].toFixed(1), +x[1].toFixed(1)]), wade: sp.filter((x) => x[2] >= 0.4 && x[2] <= 1.2).map((x) => x[1]), run: Math.max(...sp.map((x) => x[1])) }; };
    const out_ = leg(false), back = leg(true); R.room(null); return { out_, back };
  });
  const w = Math.max(r.out_.dy, r.back.dy), wh = Math.max(r.out_.dH, r.back.dH);
  line('M8', w <= 0.08 && wh <= 0.12, `the shore never pops: his height moves at most ${(w * 100).toFixed(1)} cm a step (≤ 8) and the drawn hips ${(wh * 100).toFixed(1)} cm a frame (≤ 12, ours), both ways; crossed ${r.out_.flips}+${r.back.flips} times; worst at ${r.out_.dyAt}/${r.back.dyAt} s`);
  const sp = r.out_.sp, top = r.out_.run, wd = r.out_.wade; line('M8b', wd.length > 20 && Math.max(...wd) <= top * 0.6, `in water 0.4-1.2 m deep he wades at no more than 60 % of run: at most ${wd.length ? Math.max(...wd).toFixed(2) : '?'} of ${top.toFixed(2)} m/s over ${wd.length} steps; ${JSON.stringify(sp)} (metres out, m/s)`);
  await o.close();
});
// M9a, M12: the water --------------------------------------------------------------
await section(['M9a', 'M12a', 'M12b'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, s = R.sea, dt = 1 / 60, st = {}, head = h.root.getObjectByName('head'), V = h.pos.constructor, v = new V();
    Q.swimAt(s.x, s.y, -0.6); h.place(); G.camYaw = 0; G.camPitch = 0; Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); let far = 0; for (let i = 0; i < 180; i++) { G.frame(dt); if (i > 60) { head.getWorldPosition(v); far = Math.max(far, Math.abs(v.y)); } }
    // the ladder: tread, slow, cruise, boost, super, and back, deep
    Q.swimAt(s.x, s.y, -10); h.place(); G.camYaw = Math.atan2(s.ax, -s.ay); G.camPitch = 0; let w = 0, who = '', at = '', sup = 0; const leg = (name, wish, n) => { Q.drive(wish); for (let i = 0; i < n; i++) { G.frame(dt); const [r, b] = R.joints(dt, st); if (i > 1 && r > w) { w = r; who = b; at = `${name}, ${h.speed.toFixed(1)} m/s, ${(i * dt).toFixed(2)} s`; } } };
    leg('tread', { my: 0, mx: 0, ud: 0, boost: false }, 40); leg('slow', { my: 0.4, mx: 0, ud: 0, boost: false }, 70); leg('cruise', { my: 1, mx: 0, ud: 0, boost: false }, 80); h.boostFuel = 1; leg('boost', { my: 1, mx: 0, ud: 0, boost: true }, 50); h.boostFuel = 1; leg('super', { my: 1, mx: 0, ud: 0, boost: true }, 100); leg('off', { my: 1, mx: 0, ud: 0, boost: false }, 80); leg('stop', { my: 0, mx: 0, ud: 0, boost: false }, 120);
    // a bank at cruise
    Q.swimAt(s.x, s.y, -10); h.place(); G.camYaw = 0; G.camPitch = 0; Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 80; i++) G.frame(dt); let bank = 0; for (let i = 0; i < 90; i++) { G.camYaw += 0.03; G.frame(dt); bank = Math.max(bank, Math.abs(h.bank)); }
    return { far, w, who, at, bank: bank * 57.3 };
  });
  line('M9a', r.far <= 0.3, `treading with no input he keeps to sea level: his head within ${r.far.toFixed(2)} m of it (≤ 0.3)`);
  line('M12a', r.w <= 1500, `tread, slow, cruise, boost, super and back: every joint at most ${r.w.toFixed(0)}°/s (≤ 1,500; ${r.who}, ${r.at})`);
  line('M12b', r.bank >= 10, `he banks into a swim turn: ${r.bank.toFixed(1)}° at full stick at cruise (≥ 10)`);
  await o.close();
});

// M12c, M13d, M13e: the frame ----------------------------------------------------------
await section(['M12c', 'M13d', 'M13e'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, L = R.line, s = R.sea, dt = 1 / 60, cam = G.camera, V = h.pos.constructor, a = new V(), out = { tall: {}, view: {} };
    const points = ['head', 'foot_R', 'foot_L', 'hand_R', 'hand_L', 'hips'].map((n) => h.root.getObjectByName(n));
    // his box on the screen, from the bones. The top of the head is a hand above the head bone
    const box = () => { cam.updateMatrixWorld(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9; points.forEach((p, i) => { p.getWorldPosition(a); if (i === 0) a.y += 0.12; a.project(cam); x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); y0 = Math.min(y0, a.y); y1 = Math.max(y1, a.y); }); return { x0, x1, y0, y1 }; };
    for (const [name, W, H] of [['upright', 390, 844], ['turned', 844, 390]]) { cam.aspect = W / H; cam.updateProjectionMatrix();
      let lo = 1e9, at = '', out_ = 0, seen = 0, worst = 0, wet = 1e9, wetAt = '';
      const go = (label, wish, n, inWater) => { Q.drive(wish); for (let i = 0; i < n; i++) { G.frame(dt); if (i < 8) continue; const b = box(); if (inWater) { seen++; const o = Math.max(Math.abs(b.x0), Math.abs(b.x1), Math.abs(b.y0), Math.abs(b.y1)); if (o > 1) { out_++; worst = Math.max(worst, o); } } const t = Math.max(((b.y1 - b.y0) / 2) * H, inWater ? ((b.x1 - b.x0) / 2) * W : 0); if (label === 'super' && inWater) { if (t < wet) { wet = t; wetAt = `${h.speed.toFixed(0)} m/s`; } } else if (t < lo) { lo = t; at = `${label} ${h.speed.toFixed(0)} m/s`; } } };
      R.at(L.x, L.z, L.yaw); go('stand', { my: 0, mx: 0, ud: 0, boost: false }, 30); go('run', { my: 1, mx: 0, ud: 0, boost: false }, 60); h.boostFuel = 1; go('super', { my: 1, mx: 0, ud: 0, boost: true }, 170);
      Q.swimAt(s.x, s.y, -10); h.place(); G.camYaw = Math.atan2(s.ax, -s.ay); G.camPitch = 0; go('tread', { my: 0, mx: 0, ud: 0, boost: false }, 40, true); go('cruise', { my: 1, mx: 0, ud: 0, boost: false }, 80, true); h.boostFuel = 1; go('boost', { my: 1, mx: 0, ud: 0, boost: true }, 60, true); h.boostFuel = 1; go('super', { my: 1, mx: 0, ud: 0, boost: true }, 140, true);
      out.tall[name] = { lo: +lo.toFixed(0), at, wet: +wet.toFixed(0), wetAt }; out.view[name] = { out: out_, seen, worst: +worst.toFixed(2) }; }
    cam.aspect = 390 / 844; cam.updateProjectionMatrix();
    // a fight with something locked: both in view
    R.foesStep && (G.enemies.step = R.foesStep); Q.swimAt(s.x, s.y, -10); h.place(); G.enemies.spawnNear(h.pos, 1); let both = 0, n = 0, locked = 0, tOut = 0, hOut = 0, tx = 0, ty = 0, held = 0; const f = G.enemies.alive()[0];
    if (f) { f.pos.copy(h.pos).add(new V(5, 0, 5)); for (let i = 0; i < 420; i++) { Q.drive({ my: i % 120 < 60 ? 0.6 : 0, mx: i % 200 < 100 ? 0.5 : -0.5, ud: 0, boost: false, atk: i % 30 === 0 }); h.inv = 1e6; G.frame(dt); const t = h.target; if (t && t.pos && ++held > 24) { locked++; cam.updateMatrixWorld(); a.copy(h.drawPos); a.project(cam); const inH = Math.abs(a.x) <= 1 && Math.abs(a.y) <= 1 && a.z < 1; a.copy(t.pos); a.project(cam); const inT = Math.abs(a.x) <= 1 && Math.abs(a.y) <= 1 && a.z < 1; n++; if (inH && inT) both++; else if (!inT) { tOut++; tx = Math.max(tx, Math.abs(a.x)); ty = Math.max(ty, Math.abs(a.y)); } else hOut++; } } }
    out.fight = { both, n, locked, tOut, hOut, tx: +tx.toFixed(2), ty: +ty.toFixed(2) }; return out;
  });
  const vw = r.view, bad = vw.upright.out + vw.turned.out;
  line('M12c', vw.upright.seen > 100 && bad === 0, `his whole body stays in view at every swim speed: ${bad} of ${vw.upright.seen + vw.turned.seen} frames with a part outside (upright worst ${vw.upright.worst}, turned ${vw.turned.worst}; 1 is the frame's edge)`);
  line('M13d', r.tall.upright.lo >= 60 && r.tall.turned.lo >= 60, `he stands at least 60 px tall at every speed on a phone: upright ${r.tall.upright.lo} px (${r.tall.upright.at}), turned ${r.tall.turned.lo} px (${r.tall.turned.at}). From behind at super in the water, foreshortened, he's ${r.tall.upright.wet} and ${r.tall.turned.wet} px long: reported, not bound`);
  line('M13e', r.fight.n > 100 && r.fight.both / r.fight.n >= 0.95, `in a lock-on fight both are in view: ${r.fight.both} of ${r.fight.n} frames (≥ 95 %); target out ${r.fight.tOut} (furthest ${r.fight.tx}, ${r.fight.ty}), he out ${r.fight.hOut}`);
  await o.close();
});
// M10, M11: the surf and the ride ---------------------------------------------------
await section(['M10a', 'M10b', 'M10c', 'M10d', 'M10f', 'M10g'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, s = R.sea, dt = 1 / 60, ax = s.ax, az = -s.ay, X0 = s.x, Z0 = -s.y, yaw = Math.atan2(ax, az), out = {}, noted = [];
    const qn = G.quest.note; G.quest.note = (k) => { noted.push(k); };
    // up on it: a boost along the surface
    const up = (y = -0.6) => { Q.swimAt(X0 - ax * 60, -(Z0 - az * 60), y); h.place(); G.camYaw = yaw; G.camPitch = 0; h.heading = yaw; h.boostFuel = 1; Q.drive({ my: 1, mx: 0, ud: 0, boost: true }); let f = 0; for (; f < 240 && h.state !== 'surf'; f++) { G.frame(dt); h.boostFuel = 1; if (h.pos.y < -0.8) h.pos.y = -0.6; } return f; };
    out.frames = up(); out.state = h.state; out.noted = noted.slice();
    // M10c read the top anywhere; since the surfable breakers (1 Nov) a breaking wave's face carries him on past Boost's top, up to 6 m/s more, by design. Boost's own top is read
    // off a face, and a face's push is held to its own bound (2 Nov)
    let top = 0, faceTop = 0, onWave = 99, t = 0; for (let i = 0; i < 240; i++) { G.frame(dt); h.boostFuel = 1; if (h.surf && h.surf.onFace) faceTop = Math.max(faceTop, h.speed); else top = Math.max(top, h.speed); if (i > 90) onWave = Math.min(onWave, h.pos.y - 0.92 * 0.86 - G.sky.waveAt(h.pos.x, h.pos.z)); if (h.state === 'surf') t++; }
    out.top = top; out.faceTop = faceTop; out.onWave = onWave; out.held = t;
    // the stick carves: half stick, full stick
    const rate = (mx) => { Q.drive({ my: 0, mx, ud: 0, boost: false }); for (let i = 0; i < 50; i++) G.frame(dt); const y0 = h.heading; for (let i = 0; i < 30; i++) G.frame(dt); return Math.atan2(Math.sin(h.heading - y0), Math.cos(h.heading - y0)) * 2; };
    out.half = rate(0.5); out.full = rate(1); out.left = rate(-1); out.stateAfter = h.state;
    // jump launches him
    Q.drive({ my: 1, mx: 0, ud: 0, boost: true, jump: true, jumpHeld: true }); G.frame(dt); const y0 = h.pos.y; let air = false, high = 0; for (let i = 0; i < 90; i++) { G.frame(dt); if (h.air) air = true; high = Math.max(high, h.pos.y - y0); if (i > 3) Q._wish.jump = false; } out.air = air; out.high = high;
    // a dive
    up(); for (let i = 0; i < 20; i++) G.frame(dt); Q.drive({ my: 0, mx: 0, ud: -1, boost: false }); let under = false; for (let i = 0; i < 90; i++) { G.frame(dt); if (h.state === 'swim' && !h.air && h.pos.y < -0.3) under = true; } out.dive = under; out.diveState = h.state;
    // a storm's waves carry him: with no boost the ride runs faster and the swell stands higher
    { const ride = () => { up(); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); let n = 0, v = 0, sw = 0, on = true; for (let i = 0; i < 180; i++) { G.frame(dt); if (h.state !== 'surf') on = false; if (i >= 150) { v += h.speed; sw += h.swellY || 0; n++; } } return { v: v / n, sw: sw / n, on }; }; out.calm = ride(); G.sky.setWeather('storm', 0.01); out.storm = ride(); out.named = G.sky.weather; G.sky.setWeather('calm', 0.01); }
    // out of speed
    up(); Q.drive({ my: -1, mx: 0, ud: 0, boost: false }); let ended = false; for (let i = 0; i < 240; i++) { G.frame(dt); if (h.state !== 'surf') { ended = true; break; } } out.slowEnds = ended;
    // up a beach. M10g held that a ride into the shallows put him on his feet with Boost still held; since his 1 Nov word ("for the boost in land, we need the water animation and
    // movement surf") a sea ride with Boost held runs on up the beach on its own water, and it's letting go of Boost there that puts him on his feet. The wall holds that now (2 Nov)
    R.room((x, z) => { const a = (x - X0) * ax + (z - Z0) * az; return a < 20 ? -14 : -14 + (a - 20) * 0.5; });
    up(); Q.drive({ my: 1, mx: 0, ud: 0, boost: true }); let rode = false, beach = false; for (let i = 0; i < 360; i++) { G.frame(dt); h.boostFuel = 1; if (h.surf && h.surf.land) { rode = true; break; } }
    Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 300; i++) { G.frame(dt); if (h.land && !h.air && h.state !== 'surf') { beach = true; break; } } out.rode = rode; out.beach = beach; R.room(null); G.quest.note = qn;
    return out;
  });
  line('M10a', r.state === 'surf' && r.held > 200 && r.onWave > 0.2, `a boost along the surface puts him up on a swell, a state of its own: ${r.state} after ${r.frames} frames, held ${r.held} of 240, feet ${r.onWave.toFixed(2)} m over the sea at the lowest; quest told ${JSON.stringify(r.noted)}`);
  line('M10b', Math.abs(r.full) > Math.abs(r.half) * 1.4 && Math.abs(r.full) > 0.8 && r.full * r.left < 0, `the stick carves his heading: ${r.half.toFixed(2)} rad/s at half stick, ${r.full.toFixed(2)} at full, ${r.left.toFixed(2)} the other way`);
  line('M10c', r.top > 20 && r.top <= 26.001 && r.faceTop <= 32.001, `boost sets the surf's speed, up to 26 m/s: at most ${r.top.toFixed(2)} off a breaking face; on a face the wave carried him to ${r.faceTop.toFixed(2)} (up to 32)`);
  line('M10d', r.air && r.high > 1.2, `jump launches him off the wave: ${r.high.toFixed(2)} m over the swell`);
  line('M10f', r.storm.on && r.calm.on && r.named === 'storm' && r.storm.v > r.calm.v + 3 && r.storm.sw > r.calm.sw * 1.4, `the storm's waves carry him, ours: ${r.calm.v.toFixed(1)} m/s on a swell of ${r.calm.sw.toFixed(2)} m in calm, ${r.storm.v.toFixed(1)} m/s on ${r.storm.sw.toFixed(2)} m in the storm, no boost`);
  line('M10g', r.dive && r.slowEnds && r.rode && r.beach, `a ride ends in a dive or on a beach: down dives (${r.dive}), out of speed he goes under (${r.slowEnds}); into the shallows with Boost held it runs on up the beach on its water (${r.rode}), and let go of Boost there he's on his feet (${r.beach})`);
  await o.close();
});

await section(['M11a', 'M11b'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, dt = 1 / 60, w = G.life.whales[0], out = {}, V = h.pos.constructor, a = new V(); if (!w) return { none: true };
    G.life.update(dt, h.pos); Q.swimAt(w.pos.x + 6, -w.pos.z, w.pos.y + 5); h.place(); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 20; i++) { G.life.update(dt, h.pos); G.frame(dt); }
    out.near = !!h.nearWhale; Q.drive({ my: 0, mx: 0, ud: 0, boost: false, ride: true }); G.frame(dt); Q._wish.ride = false; out.on = !!h.ride; let worst = 0, n = 0, hands = 0;
    for (let i = 0; i < 240; i++) { G.life.update(dt, h.pos); G.frame(dt); if (i < 60 || !h.handsR) continue; h.finAt(h.ride, a); n++; worst = Math.max(worst, h.handsR.distanceTo(a), h.handsL.distanceTo(a)); }
    out.worst = worst * 100; out.n = n; Q.drive({ my: 0, mx: 0, ud: 0, boost: false, ride: true }); G.frame(dt); Q._wish.ride = false; out.off = !h.ride; Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); const p0 = h.pos.clone(); for (let i = 0; i < 60; i++) { G.life.update(dt, h.pos); G.frame(dt); } out.free = h.pos.distanceTo(p0); out.state = h.state; return out;
  });
  line('M11a', !r.none && r.near && r.on && r.off && r.free > 2 && r.state === 'swim', `he mounts, rides and leaves a whale with nothing stuck: in reach ${r.near}, on ${r.on}, off ${r.off}, then swims ${(r.free || 0).toFixed(1)} m in a second`);
  line('M11b', !r.none && r.n > 100 && r.worst <= 5, `his hands stay on the grip while riding: at most ${(r.worst || 0).toFixed(1)} cm off it (≤ 5) over ${r.n} frames`);
  await o.close();
});

await section(['M15a', 'M15b', 'M15c', 'M15e'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, s = R.sea, dt = 1 / 60, out = {}, go = { my: 1, mx: 0, ud: 0, boost: false };
    const start = () => { Q.swimAt(s.x, s.y, -12); h.place(); G.camYaw = Math.atan2(s.ax, -s.ay); G.camPitch = 0; h.boostFuel = 1; h.tideTier = 0; Q.drive(go); for (let i = 0; i < 120; i++) G.frame(dt); };
    const untilBeat = (off) => { for (let i = 0; i < 300; i++) { const e = h.beatEvery ?? 1, a = h.beatAgo ?? 0, away = Math.min(a, e - a); if (off ? away > Math.min(0.2, e * 0.4) : away < 0.03) return true; G.frame(dt); } return false; };
    const press = () => { Q.drive({ ...go, boost: true }); for (let i = 0; i < 3; i++) G.frame(dt); Q.drive(go); for (let i = 0; i < 3; i++) G.frame(dt); };
    // in time, three times
    start(); const tiers = [], speeds = []; for (let k = 0; k < 3; k++) { untilBeat(false); press(); for (let i = 0; i < 70; i++) G.frame(dt); tiers.push(h.tideTier); speeds.push(+h.speed.toFixed(1)); } out.tiers = tiers; out.speeds = speeds;
    // out of time: the tier holds, and a press keeps it alive
    const was = h.tideTier; untilBeat(true); press(); out.afterMiss = h.tideTier; out.was = was;
    // held from nothing
    start(); untilBeat(true); Q.drive({ ...go, boost: true }); for (let i = 0; i < 20; i++) G.frame(dt); out.held = h.tideTier;
    // plain swimming costs nothing
    start(); const f0 = h.boostFuel, t0 = h.tide; for (let i = 0; i < 300; i++) G.frame(dt); out.fuel = h.boostFuel - f0;
    return out;
  });
  line('M15a', r.tiers[0] >= 1 && r.tiers[1] === r.tiers[0] + 1 && r.tiers[2] === 3 && r.speeds[2] > r.speeds[0] + 3, `boost in time with the kick steps him up a tier: tiers ${r.tiers.join(', ')} at ${r.speeds.join(', ')} m/s`);
  line('M15b', r.afterMiss === r.was, `a missed beat holds his tier: ${r.was} before, ${r.afterMiss} after`);
  line('M15c', r.held >= 1, `held boost gives tier 1: ${r.held}`);
  line('M15e', Math.abs(r.fuel) < 0.001, `plain swimming costs no stamina: ${r.fuel.toFixed(4)} in 5 s`);
  await o.close();
});

// the dolphin leap: how high over the sea, by how fast he comes up ---------------------
await section(['M9d'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, R = window.__rig, s = R.sea, dt = 1 / 60, c = 0.86, sn = 0.5;
    const one = (v, boost, surge) => { h.state = 'swim'; h.surf = null; h.surgeLock = false; h.air = false; h.breach = null; Q.swimAt(s.x, s.y, -3.5, s.ax * v * c, s.ay * v * c, v * sn, surge); Q.aim(s.ax * c, s.ay * c, sn); h.boostFuel = 1; h.boostHeld = surge ? 2 : 0; Q.drive({ my: 1, mx: 0, ud: 0, boost }); let top = -9, air = 0, breach = false; for (let i = 0; i < 300; i++) { h.boostFuel = 1; G.frame(dt); if (h.air) { air += dt; breach = breach || !!h.breach; } top = Math.max(top, h.pos.y - G.sky.waveAt(h.pos.x, h.pos.z)); if (air > 0 && !h.air) break; } return { top, air, breach }; };
    return { swim: one(7.5, false, 0), boost: one(15.5, true, 0), sup: one(48, true, 1) };
  });
  const say = (x) => `${x.top.toFixed(1)} m, ${x.air.toFixed(1)} s in the air`;
  line('M9d', r.swim.top >= 5 && r.boost.top >= 10 && r.sup.top >= 18, `coming up through the surface he leaps, no button: swimming ${say(r.swim)} (≥ 5 m), boosted ${say(r.boost)} (≥ 10 m), at super speed ${say(r.sup)} (≥ 18 m)`);
  await o.close();
});

if (process.argv.some((a) => a.startsWith('--only=PROBE'))) await section(['PROBE'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, R = window.__rig, L = R.line, dt = 1 / 60, st = {}, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const go = { my: 1, mx: 0, ud: 0, boost: false }, none = { my: 0, mx: 0, ud: 0, boost: false }, out = {};
    const rec = (name, plan, top = 1) => { const rows = []; for (const [wish, n] of plan) { Q.drive(wish); for (let i = 0; i < n; i++) { G.frame(dt); const [w, who] = R.joints(dt, st); rows.push({ i: rows.length, sp: +h.spd.toFixed(1), vy: +h.vel.y.toFixed(1), w: Math.round(w), who, fall: b.fall.mode, fy: +(b.fall.y || 0).toFixed(2), fv: +(b.fall.v || 0).toFixed(1), rootY: +G.hero.root?.position?.y?.toFixed?.(2), ph: +b.phase.toFixed(2), beta: +b.S.beta.toFixed(2), drop: +(h.dropNow || 0).toFixed(3), L: b.legs.map((l, k) => `${l.down ? 'D' : 's'}${l.ph.toFixed(2)} ${(h.legFit && h.legFit[k] ? h.legFit[k].share : 0).toFixed(3)} y${l.A[1].toFixed(2)}`).join(' | '), shot: b.shot ? `${b.shot.name} ${b.shot.t.toFixed(2)}` : '', state: h.state, air: h.air ? 1 : 0, offs: b.inertActive ? 1 : 0 }); } }
      const seg = rows.slice(2), big = seg.reduce((a, x) => (x.w > a.w ? x : a), seg[0]); out[name] = rows.slice(Math.max(0, big.i - 7), big.i + 5); };
    try {
    // J5's own runs: at each snap, what stopped the arm
    { const W = G.world, C = W.data.colliders, Hs = Q.hash(C, 16), cam = G.camera, d = W.data, S = d.size_m, ox = d.origin[0], oy = d.origin[1]; let seed = 11, runs = 0; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, rows = []; const was_render = G.look.render; G.look.render = () => {};
      for (let k = 0; k < 8000 && runs < 40; k++) { const x = ox + rnd() * S, y = oy + rnd() * S, g = W.heightAt(x, y); if (g < 1.5 || Q.nearest(Hs, C, x, y, g + 0.9).d < 1.5) continue; const a = rnd() * 6.283, dx = Math.sin(a), dy = Math.cos(a); Q.walkAt(x, y, dx * 6, dy * 6); Q.aim(dx, dy, 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: true }); G.camPitch = -0.1; h.place(); runs++; const arms = []; let cool = 0;
        for (let i = 0; i < 300; i++) { G.frame(dt); if (G.quest.cineOn && G.quest.cineOn()) { arms.push(arms[arms.length - 1] || 4); continue; } const p = cam.position, A = Math.hypot(p.x - h.drawPos.x, p.y - h.drawPos.y - 0.5, p.z - h.drawPos.z); arms.push(A); if (cool > 0) { cool--; continue; } if (i >= 66) { const w = arms[i - 6], q = A / w; if (q <= 0.6) { cool = 60; const c = h.camInfo, sx = c.o[0] + c.u[0] * c.free, sy = c.o[1] + c.u[1] * c.free, sz = c.o[2] + c.u[2] * c.free, n = Q.nearest(Hs, C, sx, -sz, sy), gr = W.heightAt(sx, -sz), nc = n.c || n.k || n.i; rows.push({ run: runs, i, at: [+h.pos.x.toFixed(0), +(-h.pos.z).toFixed(0), +h.pos.y.toFixed(0)], sp: +h.spd.toFixed(0), was: +w.toFixed(2), arm: +A.toFixed(2), first: +c.first.toFixed(2), free: +c.free.toFixed(2), use: +c.use.toFixed(2), a: c.avoidI, sw: +c.swung.toFixed(2), up: +c.up.toFixed(2), stop: [+sx.toFixed(1), +(-sz).toFixed(1), +sy.toFixed(1)], solid: +n.d.toFixed(2), ground: +(sy - gr).toFixed(2), what: typeof nc === 'object' && nc ? { t: nc.t, hx: nc.hx, hy: nc.hy, r: nc.r, z0: nc.z0, z1: nc.z1 } : nc }); } } } }
      G.look.render = was_render; out.j5 = rows; }
    // a fight in a tight place, J3's own start: the arm's numbers every quarter second
    if (G.enemies.encounters) { const list = G.enemies.encounters, stride = Math.max(1, Math.floor(list.length / 24)), was_render = G.look.render; G.look.render = () => {}; for (const k in h.powers) h.powers[k] = true; let top = 0, keep = null; const sums = [];
      for (let i = 0; i < list.length; i += stride) for (const yaw of [2.4, 0.2]) { const e = list[i], rows = []; let bad = 0; h.inv = 1e6; h.dead = false; h.hp = h.maxHp; h.tide = h.maxTide = 900; h.pos.copy(e.c).add({ x: 3, y: 2, z: 4 }); h.vel.set(0, 0, 0); h.prev.copy(h.pos); h.place(); G.camYaw = yaw; G.camPitch = -0.15; Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); for (let f = 0; f < 40; f++) G.frame(dt); const start = [+h.pos.x.toFixed(1), +(-h.pos.z).toFixed(1), +h.pos.y.toFixed(1)];
        for (let f = 0; f < 300; f++) { if (f % 22 === 8) Q._wish.atk = true; if (f % 68 === 30) { for (const k in h.cool) h.cool[k] = 0; h.tide = 900; Q._wish[['dash', 'spin', 'wave', 'call'][Math.floor(f / 68) % 4]] = true; } h.inv = 1e6; G.frame(dt); if (G.quest.cineOn && G.quest.cineOn()) continue; const c = G.camera.position, n = h.camInfo || {}, dist = Math.hypot(c.x - h.drawPos.x, c.y - h.drawPos.y - 0.5, c.z - h.drawPos.z); if (dist < 1.5) bad++; if (f % 12 === 0) rows.push({ f, at: [+h.pos.x.toFixed(1), +(-h.pos.z).toFixed(1), +h.pos.y.toFixed(1)], dist: +dist.toFixed(2), cam: [+c.x.toFixed(1), +(-c.z).toFixed(1), +c.y.toFixed(1)], first: +(n.first || 0).toFixed(2), free: +(n.free || 0).toFixed(2), use: +(n.use || 0).toFixed(2), a: n.avoidI, sw: +(n.swung || 0).toFixed(2), up: +(n.up || 0).toFixed(2), st: h.state }); }
        sums.push([e.id, yaw, bad]); if (bad > top) { top = bad; keep = [{ id: e.id, yaw, bad, start }, ...rows]; } }
      G.look.render = was_render; out.j3 = keep || []; out.j3sum = [{ sums: sums.filter((x) => x[2] > 0) }]; }
    // the two charges that still get into a solid, step by step: A1's own start, heading, speed and boost
    for (const [name, cx, cy, x0, y0, v, surge] of [['a1_13', -349.3, -383.1, -348, -393.1, 13, 0], ['a1_36', -391.7, -411, -373.8, -408.7, 36, 1]]) {
      const C = G.world.data.colliders, c = C.find((k) => Math.hypot(k.x - cx, k.y - cy) < 0.3), L0 = Math.hypot(cx - x0, cy - y0), d = [(cx - x0) / L0, (cy - y0) / L0], rows = [];
      if (!c) continue;
      Q.walkAt(x0, y0, d[0] * v, d[1] * v, surge); Q.aim(d[0], d[1], 0); Q.drive({ my: 1, mx: 0, ud: 0, boost: true });
      for (let i = 0; i < 60; i++) { h.step(dt); const w = Q.where(), sd = Q.sd(c, w.x, w.y, w.z); if (sd < 1.6) rows.push({ i, x: +w.x.toFixed(2), y: +w.y.toFixed(2), z: +w.z.toFixed(2), sd: +sd.toFixed(3), t: +G.world.heightAt(w.x, w.y).toFixed(2), g: +h.groundAt(w.x, -w.y).toFixed(2), sp: +h.spd.toFixed(1), vz: +h.vel.y.toFixed(1), land: h.land ? 1 : 0, air: h.air ? 1 : 0 }); }
      out[name] = [{ c: { x: c.x, y: c.y, hx: c.hx, hy: c.hy, z0: c.z0, z1: c.z1, a: c.a ?? c.rot ?? c.yaw, t: c.t } }, ...rows];
    }
    } catch (e) { out.err = [{ e: String(e.stack).slice(0, 400) }]; }
    // swim charges that end up inside: A1's own start, heading and speed
    for (const [name, cx, cy, x0, y0, z0, v, boost, surge, n] of [['s_slab', 116, 909.6, -178.5, 871.1, -3.8, 15.5, true, 0, 620], ['s_disc', -886.1, 168.5, -901.7, 180.5, -68.1, 48, true, 1, 50]]) {
      const C = G.world.data.colliders, c = C.find((k) => Math.hypot(k.x - cx, k.y - cy) < 0.4), L0 = Math.hypot(cx - x0, cy - y0), d = [(cx - x0) / L0, (cy - y0) / L0], rows = []; if (!c) continue;
      Q.swimAt(x0, y0, z0, d[0] * v, d[1] * v, 0, surge); Q.aim(d[0], d[1], 0); Q.drive({ my: 1, mx: 0, ud: 0, boost }); let a = Q.where();
      for (let i = 0; i < n; i++) { h.step(dt); const w = Q.where(), sd = Q.sd(c, w.x, w.y, w.z); if (sd < 1.4 && (rows.length < 40)) rows.push({ i, x: +w.x.toFixed(2), y: +w.y.toFixed(2), z: +w.z.toFixed(2), sd: +sd.toFixed(3), g: +G.world.heightAt(w.x, w.y).toFixed(2), sp: +h.speed.toFixed(1), v: [+h.vel.x.toFixed(1), +(-h.vel.z).toFixed(1), +h.vel.y.toFixed(1)], st: h.state, air: h.air ? 1 : 0, land: h.land ? 1 : 0 }); a = w; }
      out[name] = [{ c: { x: c.x, y: c.y, hx: c.hx, hy: c.hy, r: c.r, z0: c.z0, z1: c.z1, yaw: c.yaw, t: c.t } }, ...rows];
    }
    // a fall and its landing, the drawn hips frame by frame
    { const s = R.sea, FLOOR = 6, hips = h.root.getObjectByName('hips'), v = new (h.pos.constructor)(); R.room(() => FLOOR); for (const m of [1, 3.5, 9]) { R.at(s.x, -s.y, 0); Q.drive(none); for (let i = 0; i < 8; i++) G.frame(dt); h.pos.y = FLOOR + 0.92 + m; h.prev.copy(h.pos); h.drawPos.copy(h.pos); h.air = true; h.land = false; h.apexY = h.pos.y; h.vel.set(0, 0, 0); const rows = []; let y1 = null, y2 = null; for (let i = 0; i < 260; i++) { G.frame(dt); hips.getWorldPosition(v); const a = y2 === null ? 0 : (v.y - 2 * y1 + y2) * 3600; y2 = y1; y1 = v.y; rows.push({ i, air: h.air ? 1 : 0, sim: +(h.pos.y - FLOOR).toFixed(3), root: +(h.root.position.y - FLOOR).toFixed(3), hips: +(v.y - FLOOR).toFixed(3), a: Math.round(a), mode: b.fall.mode, fv: +b.fall.v.toFixed(2), D: +b.fall.D.toFixed(2), drop: +(h.dropNow || 0).toFixed(3), off: +(v.y - h.root.position.y).toFixed(3), L: b.legs.map((l, k) => `${l.down ? 'D' : 's'} ${(h.legFit && h.legFit[k] ? h.legFit[k].share : 0).toFixed(2)}`).join(' '), shot: b.shot ? b.shot.name : '' }); } const t0 = rows.findIndex((x) => !x.air), w = rows.reduce((x, r2, k) => (k > 3 && Math.abs(r2.a) > Math.abs(x.a) ? r2 : x), rows[4]); out['fall' + m] = rows.slice(Math.max(0, t0 - 8), t0 + 16).concat(rows.slice(w.i - 2, w.i + 3)); } R.room(null); }
    { const s = R.sea, FLOOR = 6, ax = s.ax, az = -s.ay, X0 = s.x, Z0 = -s.y, yaw = Math.atan2(ax, az), t = Math.tan((55 * Math.PI) / 180); R.room((x, z) => { const a = (x - X0) * ax + (z - Z0) * az; return a < 0 ? FLOOR : FLOOR + Math.min(a, 30) * t; }); R.at(X0 - ax * 12, Z0 - az * 12, yaw); Q.drive(go); const rows = []; for (let i = 0; i < 140; i++) { G.frame(dt); if (i > 80) rows.push({ i, a: +((h.pos.x - X0) * ax + (h.pos.z - Z0) * az).toFixed(3), spd: +h.spd.toFixed(2), vel: +Math.hypot(h.vel.x, h.vel.z).toFixed(2), acc: +h.accel.toFixed(1) }); } out.limit = rows.filter((x, i) => i % 3 === 0); R.room(null); }
    { const s = R.sea, FLOOR = 6, ax = s.ax, az = -s.ay, X0 = s.x, Z0 = -s.y, yaw = Math.atan2(ax, az), t = Math.tan((55 * Math.PI) / 180); R.room((x, z) => { const a = (x - X0) * ax + (z - Z0) * az; return a < 0 ? FLOOR : a < 5.6 ? FLOOR + a * t : FLOOR + 8; }); R.at(X0 - ax * 4, Z0 - az * 4, yaw); Q.drive(go); const rows = []; for (let i = 0; i < 300; i++) { G.frame(dt); if (i % 12 === 0 || (i > 30 && i < 60)) rows.push({ i, a: +((h.pos.x - X0) * ax + (h.pos.z - Z0) * az).toFixed(3), y: +(h.pos.y - FLOOR).toFixed(2), spd: +h.spd.toFixed(2), air: h.air ? 1 : 0, land: h.land ? 1 : 0, hd: +(h.heading * 57.3).toFixed(0) }); } out.m7 = rows; R.room(null); }
    { const rows = []; Q.swimAt(322, -300, -2); h.place(); const aim = () => { const dx = 334 - h.pos.x, dy = 2 - h.pos.y, dz = 291 - h.pos.z; G.camYaw = Math.atan2(dx, dz); G.camPitch = Math.atan2(dy, Math.hypot(dx, dz)); }; Q.drive(go); for (let i = 0; i < 420; i++) { aim(); G.frame(dt); if (i % 30 === 0) rows.push({ i, x: +h.pos.x.toFixed(1), y: +h.pos.y.toFixed(2), z: +(-h.pos.z).toFixed(1), g: +h.groundAt(h.pos.x, h.pos.z).toFixed(2), land: h.land ? 1 : 0, spd: +h.speed.toFixed(1), st: h.state }); } out.bot = rows; }
    { const W = G.world, spot = (x, y, name) => { const rows = []; const g0 = W.heightAt(x, y); for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; if (g0 > -1.4) { Q.walkAt(x, y); } else { Q.swimAt(x, y, Math.min(-0.6, g0 + 2)); } h.place(); G.camYaw = a; G.camPitch = 0; h.heading = a; Q.drive({ ...go, boost: false }); const p0 = h.pos.clone(); for (let i = 0; i < 90; i++) G.frame(dt); rows.push({ a: k * 45, moved: +h.pos.distanceTo(p0).toFixed(2), y: +h.pos.y.toFixed(2), g: +h.groundAt(h.pos.x, h.pos.z).toFixed(2), land: h.land ? 1 : 0, air: h.air ? 1 : 0, st: h.state, spd: +h.spd.toFixed(1) }); } const gr = []; for (let dx = -4; dx <= 4; dx += 2) { const row = []; for (let dy = -4; dy <= 4; dy += 2) row.push(+W.heightAt(x + dx, y + dy).toFixed(1)); gr.push(row.join(' ')); } out['spot_' + name] = rows.concat([{ ground: gr }]); }; spot(468, -23, 'a3t2'); { const rows = []; for (let t = 0; t <= 1.0001; t += 0.05) { const x = 468 + (420 - 468) * t, y = -23 + (-80 + 23) * t; rows.push(+W.heightAt(x, y).toFixed(1)); } out.path = [{ heights: rows }]; const near = []; for (let a = 0; a < 16; a++) { const row = []; for (let d = 4; d <= 40; d += 6) row.push(+W.heightAt(468 + Math.cos(a * 0.3927) * d, -23 + Math.sin(a * 0.3927) * d).toFixed(0)); near.push(`${a * 22.5}: ${row.join(' ')}`); } out.around = [{ near }]; } }
    { const best = []; for (let k = 0; k < 18; k++) { R.at(L.x, L.z, L.yaw); h.boostFuel = 1; Q.drive(go); for (let i = 0; i < 60 + k; i++) G.frame(dt); Q.drive({ ...go, boost: true }); for (let i = 0; i < 42; i++) { G.frame(dt); const [w, who] = R.joints(dt, st); if (i > 1) best.push({ k, i, w: Math.round(w), who, sp: +h.spd.toFixed(1), beta: +b.S.beta.toFixed(2), T: +b.S.T.toFixed(2), L: b.legs.map((l, q) => `${l.down ? 'D' : 's'}${l.ph.toFixed(2)} ${(h.legFit && h.legFit[q] ? h.legFit[q].share : 0).toFixed(3)} y${l.A[1].toFixed(2)}`).join(' | ') }); } } best.sort((p, q) => q.w - p.w); out.sprintStart = best.slice(0, 6); }
    R.at(L.x, L.z, L.yaw); rec('run', [[none, 6], [go, 140]]);
    R.at(L.x, L.z, L.yaw); h.boostFuel = 1; rec('sprint', [[go, 60], [{ ...go, boost: true }, 42]]);
    h.boostFuel = 1; rec('super', [[{ ...go, boost: true }, 100]]);
    rec('stop', [[none, 60]]);
    R.at(L.x, L.z, L.yaw); rec('jump', [[go, 60], [{ ...go, jump: true }, 20]]); rec('double', [[{ ...go, jump: true }, 40]]);
    R.at(L.x, L.z, L.yaw); Q.drive(none); for (let i = 0; i < 24; i++) { G.frame(dt); R.joints(dt, st); R.knees(dt, st); } rec('m3_double', [[go, 54], [{ ...go, boost: true }, 36], [none, 78], [go, 48], [{ ...go, jump: true }, 15], [{ ...go, jump: true }, 72]]);
    rec('m3_stop', [[go, 60], [{ ...go, boost: true }, 42], [{ ...go, boost: true }, 96], [none, 78]]);
    // the turn
    const tn = (by) => { R.at(L.x, L.z, L.yaw); Q.drive(go); const rows = []; let y0 = h.drawYaw; const row = (i) => { const d = wrap(h.drawYaw - y0) / dt * 57.3; y0 = h.drawYaw; rows.push({ i, sp: +h.spd.toFixed(1), hd: +((wrap(h.heading - L.yaw)) * 57.3).toFixed(1), dy: +(wrap(h.drawYaw - L.yaw) * 57.3).toFixed(1), rate: Math.round(d), om: +(h.omega * 57.3).toFixed(0), piv: h.pivot, cam: +(wrap(G.camYaw - L.yaw) * 57.3).toFixed(0), acc: +h.accel.toFixed(1) }); }; for (let i = 0; i < 70; i++) { G.frame(dt); row(i); } G.camYaw = L.yaw + by; for (let i = 70; i < 150; i++) { G.frame(dt); row(i); } return rows.filter((x) => x.i % 6 === 0 || (x.i > 66 && x.i < 78)); };
    out.t90 = tn(1.57); out.t100 = tn(1.75); out.t135 = tn(2.36);
    return out;
  });
  for (const k in r) { console.log('--- ' + k); for (const x of r[k]) console.log(JSON.stringify(x)); }
  await o.close();
});
// M20: a real look swipe, on the real game at its own frame rate. No other wall touches the look, so when the line that clears it was swallowed by a comment one swipe kept the camera turning for ever (1 Nov)
await section(['M20', 'M20b'], async () => {
  const o = await open('?fresh&tier=phone', { ctx: { ...PHONE, deviceScaleFactor: 1 } }), page = o.page;
  const dive = await page.$('#dive'); if (dive && await dive.isVisible()) await dive.click();
  await page.waitForTimeout(1200);
  // the thumb lands on whatever is really under it, so a layer over the canvas fails this too
  const swipe = (where) => page.evaluate(async (where) => {
    const G = window.__game, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), frame = () => new Promise((f) => requestAnimationFrame(f));
    const DX = -60, DY = 40, k = 0.0052 * (G.settings.camera || 1), x0 = innerWidth * 0.75, y0 = innerHeight * 0.5, on = document.elementFromPoint(x0, y0);
    const ev = (t, x, y) => on.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: t === 'pointerup' ? 0 : 1 }));
    const y1 = G.camYaw, p1 = G.camPitch; ev('pointerdown', x0, y0);
    for (let i = 1; i <= 10; i++) { ev('pointermove', x0 + DX * i / 10, y0 + DY * i / 10); await frame(); }
    ev('pointerup', x0 + DX, y0 + DY); await frame(); await frame();
    const y2 = G.camYaw, p2 = G.camPitch; await new Promise((f) => setTimeout(f, 1500));
    return { where, on: on.id || on.tagName, want: [-DX * k, -DY * k], turned: [wrap(y2 - y1), p2 - p1], drift: [wrap(G.camYaw - y2), G.camPitch - p2] };
  }, where);
  const water = await swipe('water');
  await page.evaluate(RIG); await page.evaluate(() => { const R = window.__rig, L = R.line; R.at(L.x, L.z, L.yaw); }); await page.waitForTimeout(400);
  const land = await swipe('land'), both = [water, land], deg = (a) => +(a * 57.3).toFixed(1);
  const say = (r, k) => `${r.where} ${r[k].map(deg).join(', ')}°`;
  line('M20', both.every((r) => r.on === 'c' && r.turned.every((a, i) => Math.abs(a - r.want[i]) <= Math.abs(r.want[i]) * 0.15)), `a swipe on the right of the screen turns the camera by the swipe: ${both.map((r) => say(r, 'turned')).join(' · ')}, wanted ${water.want.map(deg).join(', ')}° (within 15 %), on ${both.map((r) => r.on).join(', ')}`);
  line('M20b', both.every((r) => r.drift.every((a) => Math.abs(a) < 0.02)), `the camera stops when the thumb lifts: in the next 1.5 s ${both.map((r) => say(r, 'drift')).join(' · ')} (under 1.1°)`);
  await o.close();
});
// M4s: a start and a stop are the capture's, on feet that stay down --------------------
await section(['M4s', 'M4t', 'M4w'], async () => {
  const o = await open1();
  const r = await o.page.evaluate(() => {
    const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, R = window.__rig, dt = 1 / 60, V = h.pos.constructor, s = R.sea, go = { my: 1, mx: 0, ud: 0, boost: false }, none = { my: 0, mx: 0, ud: 0, boost: false };
    R.room(() => 6); const home = () => R.at(s.x - s.ax * 140, -s.y + s.ay * 140, Math.atan2(s.ax, -s.ay));
    // how far a foot that's down moves in a frame, through this stretch
    const watch = (N, each) => { let worst = 0, held = [false, false], kinds = ['', ''], was = [new V(), new V()], cur = [new V(), new V()]; for (let i = 0; i < N; i++) { G.frame(dt); if (each) each(i); b.legs.forEach((l, k) => { const kind = R.kind(l); R[kind](l, cur[k]); if (l.down && held[k] && kind === kinds[k]) worst = Math.max(worst, cur[k].distanceTo(was[k]) * 100); held[k] = l.down; kinds[k] = kind; was[k].copy(cur[k]); }); } return worst; };
    home(); Q.drive(none); for (let i = 0; i < 30; i++) G.frame(dt); Q.drive(go); let name = '', first = -1; const startSlide = watch(60, (i) => { if (b.loco && !name) { name = b.loco; first = i; } });
    home(); Q.drive(go); for (let i = 0; i < 120; i++) G.frame(dt); const from = h.spd; Q.drive(none); let sName = '', sFirst = -1, end = -1; const stopSlide = watch(150, (i) => { if (b.loco && !sName) { sName = b.loco; sFirst = i; } if (end < 0 && h.spd < 0.05) end = i; });
    const both = b.legs.every((l) => l.down);
    // a walk's start: he's on the capture's pace, so the hips don't have to go down after a foot he's left behind, and he's moving at once
    home(); Q.drive(none); for (let i = 0; i < 30; i++) G.frame(dt); Q.drive({ ...go, my: 0.22 }); let sink = 0, wName = '', v02 = 0; for (let i = 0; i < 70; i++) { G.frame(dt); sink = Math.max(sink, h.dropNow || 0); if (b.loco && !wName) wName = b.loco; if (i === 12) v02 = h.spd; }
    R.room(null); return { name, first, startSlide, sName, sFirst, stopSlide, end, from, both, sink, wName, v02 };
  });
  line('M4s', /run_start|walk_start/.test(r.name) && r.first >= 0 && r.first <= 6 && r.startSlide <= 3, `a start is the capture's: ${r.name || 'none'} within ${r.first} frames of the press (≤ 6), a foot that's down moves at most ${r.startSlide.toFixed(2)} cm a frame (≤ 3)`);
  line('M4t', /run_stop/.test(r.sName) && r.sFirst >= 0 && r.sFirst <= 21 && r.stopSlide <= 3 && r.end >= 0 && r.both, `a stop is the capture's: ${r.sName || 'none'} within ${r.sFirst} frames of letting go from ${r.from.toFixed(1)} m/s (≤ 21), a foot that's down moves at most ${r.stopSlide.toFixed(2)} cm a frame (≤ 3), still at ${(r.end / 60).toFixed(2)} s, both feet down ${r.both}`);
  line('M4w', /walk_start/.test(r.wName) && r.sink <= 0.08 && r.v02 > 0.3, `a walk's start is on the capture's pace: ${r.wName || 'none'}, the hips go down at most ${(r.sink * 100).toFixed(1)} cm after a foot left behind (≤ 8, ours), moving at ${r.v02.toFixed(2)} m/s by 0.2 s (> 0.3)`);
  await o.close();
});
// a probe, not a wall: a run, frame by frame
if (process.argv.includes('--jumprow')) { const o = await open1(); const rows = await o.page.evaluate(() => { const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, R = window.__rig, L = R.line, dt = 1 / 60, st = {}, rows = [];
    R.at(L.x, L.z, L.yaw); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 40; i++) G.frame(dt); R.joints(dt, st); Q.drive({ my: 1, mx: 0, ud: 0, boost: false, jump: true }); for (let i = 0; i < 75; i++) { G.frame(dt); if (i === 22) Q.drive({ my: 1, mx: 0, ud: 0, boost: false, jump: true }); else if (i === 2) Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); const [w, who] = R.joints(dt, st); rows.push(`${i} ${Math.round(w)} ${who} air${h.air ? 1 : 0} land${h.land ? 1 : 0} fall${b.fall.mode} gait${b.gaitOn ? 1 : 0} ${b.mode} shot${b.shot ? b.shot.name : '-'} ${b.legs.map((l) => `${l.down ? 'D' : 's'}${l.ph.toFixed(2)} r${l.rock.toFixed(2)} y${l.A[1].toFixed(2)} fw${l.fw.map((x) => x.toFixed(1))} nw${l.nw.map((x) => x.toFixed(1))}`).join(' | ')}`); } return rows; }); console.log(rows.join('\n')); await o.close(); }
if (process.argv.includes('--runrow')) { const o = await open1(); const rows = await o.page.evaluate(() => { const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, R = window.__rig, L = R.line, dt = 1 / 60, st = {}, rows = [];
    R.at(L.x, L.z, L.yaw); Q.drive({ my: 1, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 90; i++) { G.frame(dt); const [w, who] = R.joints(dt, st); if (i > 40) rows.push(`${i} ${Math.round(w)} ${who} v${h.speed.toFixed(1)} ph${b.phase.toFixed(2)} k${(b.S.k || 0).toFixed(2)} T${b.S.T.toFixed(2)} ${b.legs.map((l) => `${l.down ? 'D' : 's'}${l.ph.toFixed(2)} r${l.rock.toFixed(2)} y${l.A[1].toFixed(2)} sh${(h.legFit ? h.legFit[b.legs.indexOf(l)].share : 0).toFixed(2)} e${l.err ? (Math.hypot(...l.err) * 100).toFixed(0) : 0} d${l.cA ? (Math.hypot(l.A[0] - l.cA[0], l.A[1] - l.cA[1], l.A[2] - l.cA[2]) * 100).toFixed(0) : 0}`).join(' | ')} drop${(h.dropNow || 0).toFixed(3)}`); } return rows; }); console.log(rows.join('\n')); await o.close(); }
// a probe, not a wall: a start, a stop or a landing at a run, frame by frame: --legrow=start|stop|sprintstart|jump|shore|once
{ const lr = process.argv.find((a) => a.startsWith('--legrow=')); if (lr) { const o = await open1(); const rows = await o.page.evaluate((what) => { const Q = window.__qa, G = window.__game, h = G.hero, b = h.body, R = window.__rig, s = R.sea, dt = 1 / 60, V = h.pos.constructor, rows = [], go = { my: 1, mx: 0, ud: 0, boost: false }, none = { my: 0, mx: 0, ud: 0, boost: false }, was = [new V(), new V()], cur = [new V(), new V()], st = {}, held = [false, false], kinds = ['', ''], hip = h.root.getObjectByName('hips'), hp = new V(), hw = new V();
    R.room(() => 6); const home = () => R.at(s.x - s.ax * 140, -s.y + s.ay * 140, Math.atan2(s.ax, -s.ay));
    const row = (i) => { const [w, who] = R.joints(dt, st), d = b.legs.map((l, k) => { const kind = R.kind(l); R[kind](l, cur[k]); const m = l.down && held[k] && kind === kinds[k] ? cur[k].distanceTo(was[k]) * 100 : -1; held[k] = l.down; kinds[k] = kind; was[k].copy(cur[k]); const Hg = (x, z) => G.world.heightAt(x, -z), ba = R.ball(l, new V()), he = R.heel(l, new V()), gap = l.down ? Math.max(Math.abs(ba.y - Hg(ba.x, ba.z)), Math.abs(he.y - Hg(he.x, he.z))) * 100 : -1; return `${l.s}:${l.down ? 'D' : 's'} ph${l.ph.toFixed(2)} r${(l.rock || 0).toFixed(2)} ${kind[0]} gap${gap < 0 ? '-' : gap.toFixed(1)} mv${m < 0 ? '-' : m.toFixed(1)} e${l.err ? (Math.hypot(...l.err) * 100).toFixed(0) : 0} rel${l.rel ? (Math.hypot(...l.rel) * 100).toFixed(1) : 0} re${(l.reach || 0).toFixed(3)} off${l.cA ? (Math.hypot(l.A[0] - l.cA[0], l.A[1] - l.cA[1] - (l.down ? 0 : (l.gy || 0)), l.A[2] - l.cA[2]) * 100).toFixed(1) : 0} y${(l.A[1] - 6).toFixed(2)}`; }); hip.getWorldPosition(hw); const hy = (hw.y - hp.y) * 100; hp.copy(hw); rows.push(`${String(i).padStart(3)} v${h.spd.toFixed(2)} ${(b.loco || '-').padEnd(13)} ph${b.phase.toFixed(2)} gait${b.gaitOn ? 1 : 0} drop${(h.dropNow || 0).toFixed(2)} hipdy${hy.toFixed(1)} ${Math.round(w)} ${who} | ${d.join(' | ')}`); };
    const run = (wish, n, from = 0) => { Q.drive(wish); for (let i = 0; i < n; i++) { G.frame(dt); row(from + i); } };
    if (what === 'start') { home(); Q.drive(none); for (let i = 0; i < 30; i++) G.frame(dt); run(go, 80); }
    else if (what === 'sprintstart') { home(); Q.drive(none); for (let i = 0; i < 30; i++) G.frame(dt); run({ ...go, boost: true }, 80); }
    else if (what === 'walkstart') { home(); Q.drive(none); for (let i = 0; i < 30; i++) G.frame(dt); run({ ...go, my: 0.22 }, 110); }
    else if (what === 'stop') { home(); Q.drive(go); for (let i = 0; i < 120; i++) G.frame(dt); run(none, 110); }
    else if (what === 'walkstop') { home(); Q.drive({ ...go, my: 0.22 }); for (let i = 0; i < 180; i++) G.frame(dt); run(none, 150); }
    else if (what === 'start0') { home(); run({ ...go, boost: true }, 70); }
    else if (what === 'double') { home(); Q.drive(go); for (let i = 0; i < 100; i++) G.frame(dt); run({ ...go, jump: true }, 1); run(go, 21, 1); run({ ...go, jump: true }, 1, 22); run(go, 90, 23); }
    else if (what === 'hill') { R.room(null); const H = (x, z) => G.world.heightAt(x, -z), e = 1.5, size = G.world.data.size_m / 2; let spot = null; for (let x = -size; x < size && !spot; x += 7) for (let z = -size; z < size; z += 7) { if (H(x, z) < 3) continue; const gx = (H(x + e, z) - H(x - e, z)) / (2 * e), gz = (H(x, z + e) - H(x, z - e)) / (2 * e), deg = Math.atan(Math.hypot(gx, gz)) * 57.3; if (Math.abs(deg - 32) < 1.2 && !G.world.collide({ x, y: -z, z: H(x, z) + 1.2 }, 0.6)) { spot = { x, z, yaw: Math.atan2(gx, gz) }; break; } } R.at(spot.x, spot.z, spot.yaw + 3.14); run({ ...go, my: 0.4 }, 130); }
    else if (what === 'hill40') { R.room(null); const H = (x, z) => G.world.heightAt(x, -z), e = 1.5, size = G.world.data.size_m / 2; let spot = null; for (let x = -size; x < size && !spot; x += 7) for (let z = -size; z < size; z += 7) { if (H(x, z) < 3) continue; const gx = (H(x + e, z) - H(x - e, z)) / (2 * e), gz = (H(x, z + e) - H(x, z - e)) / (2 * e), deg = Math.atan(Math.hypot(gx, gz)) * 57.3; if (Math.abs(deg - 40) < 1.2 && !G.world.collide({ x, y: -z, z: H(x, z) + 1.2 }, 0.6)) { spot = { x, z, yaw: Math.atan2(gx, gz) }; break; } } R.at(spot.x, spot.z, spot.yaw + 3.14); run({ ...go, my: 0.4 }, 130); }
    else if (what === 'rideoff') { home(); h.boostFuel = 1; Q.drive({ ...go, boost: true }); for (let i = 0; i < 180; i++) G.frame(dt); run(none, 100); run(go, 40, 100); }
    else if (what === 'series') { home(); Q.drive(go); for (let i = 0; i < 240; i++) G.frame(dt); home(); h.boostFuel = 1; run({ ...go, boost: true }, 70); }
    else if (what === 'run') { home(); Q.drive(go); for (let i = 0; i < 120; i++) G.frame(dt); run(go, 60); }
    else if (what === 'pivot') { home(); Q.drive(go); for (let i = 0; i < 90; i++) G.frame(dt); G.camYaw += Math.PI * 0.95; run(go, 70); }
    else if (what === 'jump') { home(); Q.drive(go); for (let i = 0; i < 90; i++) G.frame(dt); Q.drive({ ...go, jump: true }); G.frame(dt); Q.drive(go); for (let i = 0; i < 80 && h.air !== true; i++) G.frame(dt); let n = 0; while (h.air && n++ < 200) G.frame(dt); run(go, 60); }
    return rows; }, lr.split('=')[1]); console.log(rows.join('\n')); await o.close(); } }
await finish();
