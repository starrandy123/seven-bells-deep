// A3, A4, A5: the game plays itself, long, on the real rules, and every frame is read. The drawn picture is switched off so a minute of the lock covers many minutes of play:
// the rules, the streaming and the camera all still run. Two players: the goal bot (the game's own ?demo bot, ringing bells, fighting, then every pearl) and a seeded wanderer.
//   node play.mjs <base> <chromium|webkit> [--only=A3,A3t,A4,A4p,A5,A5w] [--minutes=4] [--seed=n]
import { gate, SMALL } from './lib/h.mjs';
import fs from 'fs';
const W = await gate('play', { budget: 175 });
const { line, note, open, section, finish, flags, out, seed } = W;
const minutes = +(flags.minutes || 30);

// the per-frame reader, in the page
const READER = () => {
  const Q = window.__qa, G = window.__game, W = G.world, h = G.hero, C = W.data.colliders, Hs = Q.hash(C, 16), cam = G.camera, S = W.data.size_m / 2, ox = W.data.origin[0] + S, oy = W.data.origin[1] + S;
  G.look.render = () => {};                // the rules run, the drawing doesn't
  const R = { frames: 0, under: [], off: [], nan: [], foeUnder: [], stuck: [], camGround: [], camSolid: [], camCross: [], lowest: 1e9, nearest: 1e9, still: 0, frameMax: 0, pearls: [], pearlT: 0, longestDry: 0, lastGot: 0, cells: new Set() };
  let lp = null, stillT = 0, quiet = 0;
  const say = (a, v) => { if (a.length < 400) a.push(v); };
  // input held, under 5 cm in 2 s, and 8 ways out and a jump all fail to move him 20 cm
  const escapes = () => { const g = G.bot; G.bot = null; const p0 = h.pos.clone(); let free = 0; const y0 = G.camYaw, pt = G.camPitch;
    for (let k = 0; k < 9 && free < 0.2; k++) { h.pos.copy(p0); h.prev.copy(p0); G.camYaw = (k / 8) * 6.283; G.camPitch = 0; Q.drive(k === 8 ? { my: 0, mx: 0, ud: 1, boost: false, jump: true } : { my: 1, mx: 0, ud: 0, boost: false }); for (let i = 0; i < 24; i++) h.step(1 / 60); free = Math.max(free, h.pos.distanceTo(p0)); }
    Q._wish = null; G.bot = g; G.camYaw = y0; G.camPitch = pt; return free; };
  const frame = (dt, busy) => {
    G.frame(dt); R.frames++; const f = R.frames, x = h.pos.x, y = -h.pos.z, z = h.pos.y, g = W.heightAt(x, y);
    if (![x, y, z, h.vel.x, h.vel.y, h.vel.z].every(Number.isFinite)) say(R.nan, [f, x, y, z]);
    R.lowest = Math.min(R.lowest, z - g); if (z < g - 0.1) say(R.under, [f, +x.toFixed(1), +y.toFixed(1), +z.toFixed(2), +g.toFixed(2), h.state]);
    if (Math.abs(x - ox) > S + 12 || Math.abs(y - oy) > S + 12) say(R.off, [f, +x.toFixed(1), +y.toFixed(1)]);
    for (const e of G.enemies.alive()) { const ex = e.pos.x, ey = -e.pos.z, ez = e.pos.y; if (!Number.isFinite(ez + ex + ey)) say(R.nan, ['foe', f]); else if (ez < W.heightAt(ex, ey) - 0.15) say(R.foeUnder, [f, e.kind || e.type || 'foe', +ex.toFixed(1), +ey.toFixed(1), +ez.toFixed(2)]); }
    R.cells.add(Math.floor(x / 32) * 4096 + Math.floor(y / 32));
    // the camera: never under the floor, never inside a solid or closer to one than twice the near plane, and no solid between him and it
    const c = cam.position, cx = c.x, cy = -c.z, cz = c.y, gc = W.heightAt(cx, cy), cine = G.quest.cineOn && G.quest.cineOn();
    if (quiet > 0) { quiet--; lp = null; return R; }
    if (h.dead || (G.quest.respawning && G.quest.respawning())) return R;
    const armL0 = Math.hypot(cx - x, cy - y, cz - z); if (!cine && armL0 < 30) { R.armN = (R.armN || 0) + 1; if (armL0 < 1.5) { R.armShort = (R.armShort || 0) + 1; if (armL0 < (R.armMin ?? 1e9)) { R.armMin = armL0; R.armAt = [f, +x.toFixed(1), +y.toFixed(1), +z.toFixed(1), h.state]; } } }
    if (armL0 <= 30 || cine) if (cz < gc + 0.05) say(R.camGround, [f, +cx.toFixed(1), +cy.toFixed(1), +cz.toFixed(2), +gc.toFixed(2), cine ? 'cine' : h.state]);
    const n = Q.nearest(Hs, C, cx, cy, cz); if (armL0 > 30 && !cine) return R; if (n.d < R.nearest) R.nearest = n.d; if (n.d < cam.near * 2) say(R.camSolid, [f, +cx.toFixed(1), +cy.toFixed(1), +cz.toFixed(1), +n.d.toFixed(2), cine ? 'cine' : h.state]);
    const armL = Math.hypot(cx - x, cy - y, cz - z); if (armL > 30 && !cine) { R.cuts = (R.cuts || 0) + 1; return R; }     // a respawn or a teleport, the camera on its way: under the fade, not an arm
    if (!cine) { const px = x, py = y, pz = z + 0.5, L = Math.hypot(cx - px, cy - py, cz - pz), steps = Math.ceil(L / 0.25); for (let i = 1; i < steps; i++) { const t = i / steps, qx = px + (cx - px) * t, qy = py + (cy - py) * t, qz = pz + (cz - pz) * t, m = Q.nearest(Hs, C, qx, qy, qz); if (m.d < -0.05 || qz < W.heightAt(qx, qy) - 0.05) { say(R.camCross, [f, +qx.toFixed(1), +qy.toFixed(1), +qz.toFixed(1), +L.toFixed(1), h.state]); break; } } }
    // stuck
    if (lp) { const d = Math.hypot(x - lp.x, y - lp.y, z - lp.z); if (busy && !h.dead && h.state === 'swim' && !cine && !h.ride) { stillT += dt; if (stillT >= 2) { if (Math.hypot(x - lp.a, y - lp.b, z - lp.c) < 0.05) { const free = escapes(); if (free < 0.2) { say(R.stuck, [f, +x.toFixed(1), +y.toFixed(1), +z.toFixed(1), +free.toFixed(2)]); } } stillT = 0; lp.a = h.pos.x; lp.b = -h.pos.z; lp.c = h.pos.y; } } else stillT = 0; lp.x = x; lp.y = y; lp.z = z; }
    else lp = { x, y, z, a: x, b: y, c: z };
    return R;
  };
  return { R, frame, hush: (n) => { quiet = n; } };
};

const summary = (R) => ({ ...R, cells: R.cells.size });

await section(['A3', 'A3t', 'A4', 'A5', 'A5a', 'A4e'], async () => {
  const { page, errors, close } = await open('?demo&film&fresh&tier=phone', { ctx: SMALL });
  await W.gpu(page);
  // the goal bot first
  const a = await page.evaluate(([src, minutes]) => {
    const { R, frame } = (new Function('return (' + src + ')()'))(); const G = window.__game, t0 = performance.now(), N = minutes * 60 * 60; let got = '', last = 0, dry = 0, dryAt = null, kills = 0, wonAt = -1, after = 0;
    // progress is anything the save would keep: a chapter, a mission's step, a kill, a pearl, a bell, a win
    const sig = () => { const s = G.quest.pack ? G.quest.pack() : null; if (!s) return `${G.quest.pearlCount()}|${G.quest.rungCount()}|${G.boss.dead}`; kills = s.kills || 0; return [s.chapter, JSON.stringify(s.missions), (s.bells || []).length, (s.pearls || []).length, s.kills, (s.cleared || []).length, s.won].join('|'); };
    for (let i = 0; i < N; i++) { frame(1 / 60, !!G.quest.target());
      if (i % 60 === 0) { const won = G.boss && G.boss.dead; if (won && wonAt < 0) wonAt = i; const now = sig(); if (now !== got) { got = now; last = i; } else if (i - last > dry && !won) { dry = i - last; const p = G.hero.pos; dryAt = [+p.x.toFixed(0), +(-p.z).toFixed(0), +p.y.toFixed(0)]; } else if (won && i - last > after) after = i - last; }
      if (performance.now() - t0 > 62000) break; }
    const tg = G.quest.target(), h = G.hero, foes = G.enemies.alive();
    return { ...R, cells: R.cells.size, ms: performance.now() - t0, dry: dry / 60, after: after / 60, wonAt: wonAt < 0 ? null : Math.round(wonAt / 60), dryAt, rung: G.quest.rungCount(), pearls: G.quest.pearlCount(), won: G.boss.dead, deadNow: h.dead, kills, chapter: G.quest.pack ? G.quest.pack().chapter : null,
      end: { state: h.state, hp: Math.round(h.hp), target: tg ? [+tg.x.toFixed(0), +(-tg.z).toFixed(0), +tg.y.toFixed(0)] : null, dist: tg ? +tg.distanceTo(h.pos).toFixed(1) : null, foes: foes.length, foe: foes[0] ? [foes[0].kind || foes[0].type || '?', +foes[0].pos.x.toFixed(0), +(-foes[0].pos.z).toFixed(0), +foes[0].pos.y.toFixed(0), Math.round(foes[0].hp || 0)] : null, enc: G.enemies.encounters.filter((e) => !e.cleared).length } };
  }, [String(READER), minutes]);
  note(`goal bot: ${a.frames} frames (${(a.frames / 3600).toFixed(1)} min of play) in ${Math.round(a.ms / 1000)} s, ${a.cells} map cells of 32 m, chapter ${a.chapter}, bells ${a.rung}, pearls ${a.pearls}, kills ${a.kills}, boss won ${a.won}`);
  // then the wanderer, from the same page
  const b = await page.evaluate(([src, minutes, seed]) => {
    const { R, frame, hush } = (new Function('return (' + src + ')()'))(); const G = window.__game, Q = window.__qa, h = G.hero, t0 = performance.now(), N = minutes * 60 * 60; G.bot = null; let s = seed * 7 + 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const W = G.world;
    let t = 0, wish = { my: 1, mx: 0, ud: 0, boost: false }, yaw = 0, pitch = 0;
    // every minute it starts somewhere else, so the whole map gets walked, sea and land
    const spots = (W.data.poi || []).map((p) => [p.x, p.y, p.z]); let spot = 0;
    for (let i = 0; i < N; i++) {
      if (i % 3600 === 0 && spots.length) { const C = W.data.colliders, Hc = Q._hc || (Q._hc = Q.hash(C, 16)); let p = null, g = 0, z = 0; for (let k = 0; k < spots.length && !p; k++) { const q = spots[spot++ % spots.length]; g = W.heightAt(q[0], q[1]); z = g > -1 ? g + 0.92 : Math.max(g + 2.5, Math.min(q[2], -2)); if (Q.nearest(Hc, C, q[0], q[1], z).d > 1) p = q; } /* a named place can stand inside a solid: dropping him there would read as the camera's fault */ if (p) { if (g > -1) Q.walkAt(p[0], p[1]); else Q.swimAt(p[0], p[1], z); h.inv = 0; hush(90); } }
      t -= 1 / 60; if (t <= 0) { t = 1 + rnd() * 5; yaw = rnd() * 6.283; pitch = (rnd() - 0.5) * 1.6; wish = { my: rnd() < 0.85 ? 1 : 0.5, mx: rnd() < 0.3 ? (rnd() - 0.5) * 2 : 0, ud: rnd() < 0.2 ? (rnd() < 0.5 ? 1 : -1) : 0, boost: rnd() < 0.5, jump: rnd() < 0.3, atk: rnd() < 0.2, parry: rnd() < 0.05 }; Q.drive(wish); }
      G.camYaw += Math.atan2(Math.sin(yaw - G.camYaw), Math.cos(yaw - G.camYaw)) * 0.04; G.camPitch += (pitch - G.camPitch) * 0.04;
      frame(1 / 60, true);
      if (performance.now() - t0 > 62000) break; }
    return { ...R, cells: R.cells.size, ms: performance.now() - t0 };
  }, [String(READER), minutes, seed]);
  note(`wanderer: ${b.frames} frames (${(b.frames / 3600).toFixed(1)} min of play) in ${Math.round(b.ms / 1000)} s, ${b.cells} map cells of 32 m`);
  fs.writeFileSync(`${out}/play_detail_${W.engine}.json`, JSON.stringify({ a, b }, null, 1));
  const mins = (a.frames + b.frames) / 3600, st = a.stuck.concat(b.stuck);
  line('A3', st.length === 0 && mins >= 3, `never stuck: ${mins.toFixed(1)} min of play (seed ${seed}), ${st.length} stuck (input held, under 5 cm in 2 s, 8 ways out and a jump all under 20 cm)${st.length ? ': ' + st.slice(0, 6).map((s) => `(${s[1]}, ${s[2]}) z ${s[3]}`).join(' · ') : ''}`);
  line('A3t', a.dry <= 120, `the goal bot always gets somewhere: longest stretch before the win with nothing the save would keep changing (a chapter, a mission's step, a kill, a pearl, a bell) ${a.dry.toFixed(0)} s (≤ 120)${a.dryAt ? ' near ' + a.dryAt : ''}; ${a.won ? `it won at ${a.wonAt} s, then ${a.after.toFixed(0)} s with nothing new (reported: free roam has no bound)` : 'it did not win in this run'}; at the end ${JSON.stringify(a.end)}`);
  const un = a.under.concat(b.under), offm = a.off.concat(b.off), nan = a.nan.concat(b.nan);
  line('A4', un.length === 0 && offm.length === 0 && nan.length === 0, `nothing falls through the world: ${a.frames + b.frames} frames, ${un.length} with him under the ground by over 0.10 m, ${offm.length} past the map's edge, ${nan.length} with a broken number; his lowest ${Math.min(a.lowest, b.lowest).toFixed(2)} m over the ground${un.length ? '; first: ' + JSON.stringify(un[0]) : ''}${offm.length ? '; off: ' + JSON.stringify(offm[0]) : ''}`);
  const fu = a.foeUnder.concat(b.foeUnder); line('A4e', fu.length === 0, `no foe under the ground by over 0.15 m: ${fu.length} frames${fu.length ? '; first: ' + JSON.stringify(fu[0]) : ''}`);
  const cg = a.camGround.concat(b.camGround), cs = a.camSolid.concat(b.camSolid), cc = a.camCross.concat(b.camCross);
  line('A5', cg.length === 0 && cs.length === 0 && cc.length === 0, `the camera in play: ${cg.length} frames under the ground, ${cs.length} closer than 0.5 m (twice the near plane) to a solid or inside one, ${cc.length} with a solid or the ground between him and it, of ${a.frames + b.frames}; nearest ${Math.min(a.nearest, b.nearest).toFixed(2)} m${cg[0] ? '; ground ' + JSON.stringify(cg[0]) : ''}${cs[0] ? '; solid ' + JSON.stringify(cs[0]) : ''}${cc[0] ? '; between ' + JSON.stringify(cc[0]) : ''}`);
  const nArm = (a.armN || 0) + (b.armN || 0), short = (a.armShort || 0) + (b.armShort || 0), amin = Math.min(a.armMin ?? 99, b.armMin ?? 99), aat = (a.armMin ?? 99) < (b.armMin ?? 99) ? a.armAt : b.armAt;
  line('A5a', nArm > 1000 && short / nArm <= 0.01, `the camera stands off him: the arm under 1.5 m in ${short} of ${nArm} frames (${(short / nArm * 100).toFixed(2)}%, ≤ 1%, ours: a body that close fills the frame and shows nothing), shortest ${amin === 99 ? 'none' : amin.toFixed(2) + ' m at ' + JSON.stringify(aat)}`);
  if (errors.length) line('F1p', false, `errors in the bots' play: ${errors.length}: ${errors[0]}`); else line('F1p', true, 'no errors in the bots\' play');
  await close();
});

// A5w: the worst place for a camera: his back to a wall. At solids across the map, he swims in with the wall behind him, and the arm has to come in.
await section(['A5w'], async () => {
  const { page, close } = await open('?film&fresh&tier=phone', { ctx: SMALL });
  const r = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, W = G.world, C = W.data.colliders, h = G.hero, Hs = Q.hash(C, 16), cam = G.camera; G.look.render = () => {}; G.bot = null; Q.start();
    const out = { tried: 0, inside: [], cross: [], ground: [], arm: [] }, wide = C.filter((c) => (c.t === 'box' ? Math.max(c.hx, c.hy) > 2 : c.r > 1.5) && c.z1 - c.z0 > 3 && c.z0 < -4); const stride = Math.max(1, Math.floor(wide.length / 260));
    for (let i = 0; i < wide.length; i += stride) {
      const c = wide[i], a = (i * 2.399) % 6.283, ax = Math.cos(a), ay = Math.sin(a), r = c.t === 'cyl' ? c.r : Math.abs(ax * Math.cos(c.yaw || 0) + ay * Math.sin(c.yaw || 0)) * c.hx + Math.abs(-ax * Math.sin(c.yaw || 0) + ay * Math.cos(c.yaw || 0)) * c.hy;
      const z = Math.min(c.z1 - 1, Math.max(c.z0 + 1, Math.min(-3, (c.z0 + c.z1) / 2))), x = c.x + ax * (r + 1), y = c.y + ay * (r + 1); if (z < W.heightAt(x, y) + 1 || Q.nearest(Hs, C, x, y, z).d < 0.6) continue;
      out.tried++; Q.swimAt(x, y, z); Q.aim(ax, ay, 0); Q.drive({ my: 0, mx: 0, ud: 0, boost: false }); for (let k = 0; k < 45; k++) { G.frame(1 / 60);
        const p = cam.position, cx = p.x, cy = -p.z, cz = p.y, n = Q.nearest(Hs, C, cx, cy, cz); if (k < 30) continue;
        if (k === 44) out.arm.push(Math.hypot(cx - h.pos.x, cy + h.pos.z, cz - h.pos.y));
        if (n.d < cam.near * 2 && out.inside.length < 300) { out.inside.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1), +n.d.toFixed(2)]); break; }
        if (cz < W.heightAt(cx, cy) + 0.05) { out.ground.push([+cx.toFixed(1), +cy.toFixed(1)]); break; }
        const w = Q.where(), L = Math.hypot(cx - w.x, cy - w.y, cz - w.z - 0.5), s = Math.ceil(L / 0.25); let hit = false; for (let j = 1; j < s && !hit; j++) { const t = j / s; if (Q.nearest(Hs, C, w.x + (cx - w.x) * t, w.y + (cy - w.y) * t, w.z + 0.5 + (cz - w.z - 0.5) * t).d < -0.05) hit = true; } if (hit) { out.cross.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1), +L.toFixed(1)]); break; } }
    }
    return out;
  });
  const aw = r.arm.slice().sort((p, q) => p - q);
  line('A5w', r.tried >= 100 && r.inside.length === 0 && r.cross.length === 0 && r.ground.length === 0, `his back to a wall at ${r.tried} solids: the camera closer than 0.5 m to a solid or inside it ${r.inside.length}, a solid between him and it ${r.cross.length}, under the ground ${r.ground.length} (0, 0, 0); the arm there: ${aw.length ? `shortest ${aw[0].toFixed(2)} m, median ${aw[aw.length >> 1].toFixed(2)} m` : 'never read'}${r.inside[0] ? '; first close at ' + r.inside[0] : ''}${r.cross[0] ? '; first behind a wall at ' + r.cross[0] : ''}`);
  await close();
});

// A4p: everything to collect can be reached: every pearl, chest and bell stands in water or air, over the ground, not in a solid.
await section(['A4p'], async () => {
  const { page, close } = await open('?film&fresh&tier=phone', { ctx: SMALL });
  const r = await page.evaluate(() => {
    const Q = window.__qa, G = window.__game, W = G.world, d = W.data, C = d.colliders, Hs = Q.hash(C, 16), out = { n: 0, under: [], inside: [] };
    const see = (kind, x, y, z, lift = 0.3) => { out.n++; const g = W.heightAt(x, y); if (z < g - 0.25) out.under.push([kind, +x.toFixed(1), +y.toFixed(1), +z.toFixed(1), +g.toFixed(1)]); const n = Q.nearest(Hs, C, x, y, z + lift); if (n.d < 0) out.inside.push([kind, +x.toFixed(1), +y.toFixed(1), +z.toFixed(1), +n.d.toFixed(2)]); };
    for (const p of d.pearls || []) see('pearl', p[0], p[1], p[2]); for (const p of d.chests || []) see('chest', p[0], p[1], p[2], 0.5); for (const b of d.bells || []) see('bell', b.x, b.y, b.z, 0); see('spawn', d.spawn.x, d.spawn.y, d.spawn.z, 0);
    return out;
  });
  line('A4p', r.n > 20 && !r.under.length && !r.inside.length, `everything to collect is in the open: ${r.n} pearls, chests, bells and the spawn; ${r.under.length} under the ground, ${r.inside.length} inside a solid${r.under[0] ? '; ' + r.under.slice(0, 4).join(' · ') : ''}${r.inside[0] ? '; ' + r.inside.slice(0, 4).join(' · ') : ''}`);
  await close();
});
await finish();
