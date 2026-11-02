// FEEL: how the controls answer a thumb, measured on a phone turned (844 x 390, as he plays) with real fingers (the devtools' touch, Chromium) through the page's own
// stick and buttons, the game stepped frame by frame (?film) so every number is the game's clock and not this machine's. The targets and where each comes from:
// Pipeline/research/CONTROL_SOURCES.md.
//   node feel.mjs <base> chromium [--only=F1,F2] [--out=dir] [--clips] [--json=file]
//   --clips also films each scheme under the fingers (frames with the touches drawn on them) into <out>/clips
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
import { gate } from './lib/h.mjs';
const W = await gate('feel', { budget: 900, engines: ['chromium'] });
const { line, note, open, section, finish, out, flags } = W;
const TURNED = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const CLIPS = !!flags.clips, RES = {};
const deg = (a) => +(a * 57.2958).toFixed(1);

// in the page: the frame stepper, the trace, the scenes
const RIG = () => {
  const G = window.__game, Q = window.__qa, h = G.hero, V = h.pos.constructor, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  G.bot = null; if (G.enemies && G.enemies.clearAll) G.enemies.clearAll(); G.enemies.step = () => {}; G.quest.step = () => {}; G.quest.note = () => {}; if (G.ember && G.ember.raids) G.ember.raids.auto = false;
  const render0 = G.look.render.bind(G.look); let drawn = false;
  const F = window.__feel = {
    draw(on) { drawn = on; G.look.render = on ? render0 : () => {}; },
    sea: Q.openWater(120, 18),
    // the trace: what a player sees of him, each step. hd: the way he faces; py: his path's yaw; pp: its pitch; cy, cp: the view
    snap(t) { const v = h.vel, s = Math.hypot(v.x, v.y, v.z); return { t, hd: h.heading, py: s > 0.5 ? Math.atan2(v.x, v.z) : h.heading, pp: s > 0.5 ? Math.asin(Math.max(-1, Math.min(1, v.y / s))) : 0, np: h.fly ? h.nPitch : 0, cy: G.camYaw, cp: G.camPitch, sp: s, x: h.pos.x, y: h.pos.y, z: h.pos.z, fly: !!h.fly, st: h.state, land: !!h.land, air: !!h.air, surf: h.state === 'surf', bank: h.fly ? h.nBank || 0 : h.bank || 0 }; },
    step(n, keep) { const out = []; for (let i = 0; i < n; i++) { G.frame(1 / 60); F.t += 1 / 60; if (keep) out.push(F.snap(F.t)); } return out; },
    t: 0,
    flatLand(on) { const Wd = G.world; Wd.__h0 = Wd.__h0 || Wd.heightAt; Wd.heightAt = on ? () => 2 : Wd.__h0; },
    // scenes, each from rest with the view straight behind him
    ground(side) { G.ember.setSide(side, { place: false, quiet: true }); h.endFly(); F.flatLand(true); const s = F.sea; Q.walkAt(s.x, s.y); h.heading = G.camYaw = Math.atan2(s.ax, -s.ay); G.camPitch = -0.05; h.vel.set(0, 0, 0); h.spd = 0; h.place(); F.t = 0; return F.snap(0); },
    swim() { G.ember.setSide('water', { place: false, quiet: true }); h.endFly(); F.flatLand(false); const s = F.sea; Q.swimAt(s.x, s.y, -4); h.heading = G.camYaw = Math.atan2(s.ax, -s.ay); G.camPitch = -0.05; h.place(); F.t = 0; return F.snap(0); },
    surfStart() { G.ember.setSide('water', { place: false, quiet: true }); h.endFly(); F.flatLand(false); const s = F.sea, a = Math.atan2(s.ax, -s.ay); Q.swimAt(s.x, s.y, -0.5, s.ax * 14, s.ay * 14, 0); h.heading = G.camYaw = a; G.camPitch = -0.05; h.place(); F.t = 0; return F.snap(0); },
    air(y = 80) { G.ember.setSide('fire', { place: false, quiet: true }); F.flatLand(false); h.endFly(); Q.calm(); h.pos.set(700, y, 300); h.prev.copy(h.pos); h.vel.set(0, 0, 0); h.air = true; h.land = false; h.grounded = false; h.fireAir = true; h.launchT = 9; h.heading = G.camYaw = 0.5; G.camPitch = -0.05; h.place(); F.t = 0; return F.snap(0); },
    reset() { F.flatLand(false); Q.drive(null); },
    // a real open meadow for the films: the longest clear, gentle straight run on land (move_walls' own search)
    meadow(side) {
      if (!F.line) { const H = (x, z) => G.world.heightAt(x, -z), free = (x, z) => !G.world.collide({ x, y: -z, z: H(x, z) + 1 }, 0.6), steep = (x, z) => { const e = 1.5; return Math.hypot(H(x + e, z) - H(x - e, z), H(x, z + e) - H(x, z - e)) / (2 * e); };
        let best = null, bl = 0; const size = G.world.data.size_m / 2;
        for (let x = -size; x < size; x += 12) for (let z = -size; z < size; z += 12) { if (H(x, z) < 1.2) continue; for (let a = 0; a < 8; a++) { const yaw = (a * Math.PI) / 4, sx = Math.sin(yaw), sz = Math.cos(yaw); let r = 0; for (let k = 1; k < 60; k++) { const px = x + sx * k * 3, pz = z + sz * k * 3; if (H(px, pz) < 1 || steep(px, pz) > 0.22 || !free(px, pz)) break; r = k; } if (r > bl) { bl = r; best = { x, z, yaw }; } } }
        F.line = best; }
      const L = F.line; G.ember.setSide(side, { place: false, quiet: true }); h.endFly(); F.flatLand(false); Q.walkAt(L.x, -L.z); h.heading = G.camYaw = L.yaw; G.camPitch = -0.05; h.vel.set(0, 0, 0); h.spd = 0; h.place(); F.t = 0; return L;
    },
  };
  return { sea: F.sea };
};

// real fingers through the devtools; a lift keeps the others down (input.mjs's way: a touchMove that names fewer points isn't a lift on this Chromium)
function fingers(page, cdp, show) {
  const P = new Map();
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([id, p]) => ({ id, x: p.x, y: p.y })) });
  const paint = () => (show ? page.evaluate((pts) => { let d = document.getElementById('__fing'); if (!d) { d = document.createElement('div'); d.id = '__fing'; d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999'; document.body.appendChild(d); } d.innerHTML = pts.map(([id, p]) => `<div style="position:absolute;left:${p.x - 19}px;top:${p.y - 19}px;width:38px;height:38px;border-radius:50%;background:rgba(255,140,40,.30);border:3px solid #ff8a1e;box-shadow:0 0 0 2px rgba(0,0,0,.65),0 0 12px rgba(255,140,40,.8)"></div>`).join(''); }, [...P]) : null);
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return {
    async down(id, x, y) { P.set(id, { x, y, x0: x, y0: y }); await send('touchStart', [...P]); await settle(); await paint(); },
    async move(id, x, y) { const p = P.get(id); p.x = x; p.y = y; await send('touchMove', [...P]); await settle(); await paint(); },
    async up(id) { P.delete(id); await send('touchEnd', []); if (P.size) { await send('touchStart', [...P].map(([i, p]) => [i, { x: p.x0, y: p.y0 }])); await send('touchMove', [...P]); } await settle(); await paint(); },
    async none() { if (!P.size) return; P.clear(); await send('touchEnd', []); await settle(); await paint(); },
  };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the first time a trace's value comes within `tol` of a goal (signed turn from the start), after `from`
// every time is from the trace's own start (the frame the stick moved), never the scene's
const t0Of = (tr) => tr[0].t - 1 / 60;
const reach = (tr, key, a0, goal, tol = 5 / 57.2958) => { for (const s of tr) { if (Math.abs(wrap(s[key] - a0) - goal) <= tol || (Math.sign(goal) * wrap(s[key] - a0) >= Math.abs(goal) - tol && Math.abs(goal) < 3)) return +(s.t - t0Of(tr)).toFixed(2); } return null; };
// a turn that keeps going: radians turned so far, unwrapped
const unwrapTurn = (tr, key, a0) => { let acc = 0, last = a0; return tr.map((s) => { acc += wrap(s[key] - last); last = s[key]; return { t: s.t, a: acc }; }); };
const firstOver = (u, ang) => { for (const s of u) if (Math.abs(s.a) >= ang) return +(s.t - (u[0].t - 1 / 60)).toFixed(2); return null; };

await section(['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'], async () => {
  const { page, ctx, errors, close } = await open('?film&fresh&tier=phone&qa&nomirror', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => window.__game && window.__game.frame && window.__game.booted, null, { timeout: 120000 });
  const rig = await page.evaluate(RIG); note(`open sea for the runs: ${JSON.stringify(rig.sea)}`);
  const cdp = await ctx.newCDPSession(page), T = fingers(page, cdp, CLIPS);
  const box = (id) => page.evaluate((i) => { const r = document.getElementById(i).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }, id);
  const scene = (name, ...a) => page.evaluate(([n, a]) => window.__feel[n](...a), [name, a]);
  const step = (n, keep = true) => page.evaluate(([n, k]) => window.__feel.step(n, k), [n, keep]);
  await page.evaluate(() => window.__feel.draw(false));
  const R = await page.evaluate(() => { const s = document.getElementById('stick'); return { travel: 54, base: s.getBoundingClientRect().width }; });
  // where the left thumb lands: in the stick's zone (the left 42%, below the top 30%) but off the drawn stick and every button, so the stick floats there; a full push goes past the rim
  const S = await box('stick'), spot = await page.evaluate(() => { for (const [x, y] of [[250, 250], [230, 230], [270, 270], [210, 240]]) { const e = document.elementFromPoint(x, y); if (e && e.tagName === 'CANVAS') return [x, y]; } return null; });
  if (!spot) throw new Error('no free spot for the floating stick');
  const [SX, SY] = spot, FULL = 70, B = await box('bBoost');
  note(`stick drawn at ${Math.round(S.x)},${Math.round(S.y)} (${Math.round(S.w)} px), the thumb floats it at ${SX},${SY}; Boost/Fly at ${Math.round(B.x)},${Math.round(B.y)} (${Math.round(B.w)} px)`);

  // a turn on the stick: lands, pushes to (dx, dy) at full, holds for `secs`; then lets go and watches `after` seconds
  async function turn(dx, dy, secs, after = 2.5, opts = {}) {
    await T.down(1, SX, SY); await step(2, false);
    const tr = [];
    await T.move(1, SX + dx, SY + dy); tr.push(...await step(Math.round(secs * 60)));
    if (opts.untilTurned) { /* already held */ }
    await T.up(1); const rel = tr.length ? tr[tr.length - 1].t : 0; const aft = await step(Math.round(after * 60));
    return { tr, aft, rel };
  }
  // camera behind him: the time after `from` until the view's yaw stays within 5° of his facing (or his path when he's moving fast)
  const settleCam = (aft, t0) => { let last = null; for (const s of aft) { const off = Math.abs(wrap(s.cy - (s.sp > 6 ? s.py : s.hd))); if (off > 5 / 57.2958) last = s.t; } return last === null ? 0 : +(last - t0).toFixed(2); };

  // F1: on his feet, both heroes: from a run, the stick swung to the right (90°) and pulled back (180°); a let-go mid-turn; a resting thumb
  for (const side of ['water', 'fire']) {
    const out = RES['ground_' + side] = {};
    let s0 = await scene('ground', side); await T.down(1, SX, SY); await step(2, false); await T.move(1, SX, SY - FULL); await step(90, false);
    let s1 = (await step(1))[0]; const a0 = s1.hd, cy0 = s1.cy;
    await T.move(1, SX + FULL, SY); let tr = await step(90); out.t90 = reach(tr, 'hd', a0, -Math.PI / 2); out.sp90 = +tr[tr.length - 1].sp.toFixed(1);
    await T.move(1, SX, SY - FULL); await step(90, false); s1 = (await step(1))[0];
    await T.move(1, SX, SY + FULL); tr = await step(150); out.t180 = reach(tr, 'hd', s1.hd, Math.PI, 8 / 57.3); out.minSp180 = +Math.min(...tr.map((s) => s.sp)).toFixed(1);
    // let go mid-turn: run, swing right, lift at 45°; how much more he turns, how far he coasts
    await T.move(1, SX, SY - FULL); await step(90, false); s1 = (await step(1))[0]; await T.move(1, SX + FULL, SY);
    let k = 0, cur = s1; for (; k < 60; k++) { cur = (await step(1))[0]; if (Math.abs(wrap(cur.hd - s1.hd)) >= Math.PI / 4) break; }
    await T.up(1); const aft = await step(120); const fin = aft[aft.length - 1];
    out.overshoot = deg(Math.abs(wrap(fin.hd - cur.hd))); out.coast = +Math.hypot(fin.x - cur.x, fin.z - cur.z).toFixed(2); out.stopT = (() => { for (const s of aft) if (s.sp < 0.3) return +(s.t - cur.t).toFixed(2); return null; })();
    // the view on the ground after a 90° run to the side: does it come round behind him, and when
    out.camAfter90 = deg(Math.abs(wrap(fin.cy - cy0)));
    // a thumb resting 4 px off the centre for 3 s
    s0 = await scene('ground', side); await T.down(1, SX, SY); await T.move(1, SX + 3, SY + 3); const dz = await step(180); const e = dz[dz.length - 1];
    out.drift = +Math.hypot(e.x - s0.x, e.z - s0.z).toFixed(2); out.driftTurn = deg(Math.abs(wrap(e.hd - s0.hd))); await T.up(1); await step(10, false);
    note(`F1 ${side} on foot: ${JSON.stringify(out)}`);
  }
  line('F1', true, `on foot (both): ${JSON.stringify({ water: RES.ground_water, fire: RES.ground_fire })}`);

  // F2: swimming, the Warden: right 90° and back 180°, the stick alone
  {
    const out = RES.swim = {};
    await scene('swim'); await T.down(1, SX, SY); await step(2, false); await T.move(1, SX, SY - FULL); await step(90, false); let s1 = (await step(1))[0];
    await T.move(1, SX + FULL, SY); let tr = await step(150); out.t90 = reach(tr, 'py', s1.py, -Math.PI / 2);
    await T.move(1, SX, SY - FULL); await step(90, false); s1 = (await step(1))[0];
    await T.move(1, SX, SY + FULL); tr = await step(180); out.t180 = reach(tr, 'py', s1.py, Math.PI, 8 / 57.3); out.t180body = reach(tr, 'hd', s1.hd, Math.PI, 8 / 57.3);
    await T.up(1); await step(30, false);
    note(`F2 swim: ${JSON.stringify(out)}`); line('F2', true, `swimming: ${JSON.stringify(out)}`);
  }

  // F3: surfing: a full carve right, held; how long to come round 90° and 180°, and the view behind him after
  {
    const out = RES.surf = {};
    await scene('surfStart'); await T.down(2, B.x, B.y); await T.down(1, SX, SY); await T.move(1, SX, SY - FULL); let ok = false;
    for (let i = 0; i < 90 && !ok; i++) ok = (await step(1))[0].surf;
    out.up = ok; await step(30, false); const s1 = (await step(1))[0];
    await T.move(1, SX + FULL, SY); const tr = await step(300); const u = unwrapTurn(tr, 'hd', s1.hd); out.t90 = firstOver(u, Math.PI / 2); out.t180 = firstOver(u, Math.PI);
    await T.move(1, SX, SY - FULL); const aft = await step(240); out.camSettle = settleCam(aft, tr[tr.length - 1].t); out.over = deg(Math.abs(unwrapTurn(aft, 'hd', tr[tr.length - 1].hd).slice(-1)[0].a));
    await T.none(); await step(30, false);
    note(`F3 surf: ${JSON.stringify(out)}`); line('F3', out.up, `surfing: ${JSON.stringify(out)}`);
  }

  // F4: the man in red in flight with Fly held: full stick right, how long to come round 90° and 180°; let go at 90°, how much further; the view behind
  {
    const out = RES.fly = {};
    await scene('air'); await T.down(2, B.x, B.y); await step(180, false);
    let s1 = (await step(1))[0]; out.cruise = +s1.sp.toFixed(1); out.flying = s1.fly;
    await T.down(1, SX, SY); await step(2, false); await T.move(1, SX + FULL, SY);
    const tr = await step(420); const u = unwrapTurn(tr, 'py', s1.py); out.t90 = firstOver(u, Math.PI / 2); out.t180 = firstOver(u, Math.PI); out.rate1s = deg(Math.abs(u[59].a)); out.maxBank = deg(Math.max(...tr.map((s) => Math.abs(s.bank))));
    out.lag = (() => { for (const s of u) if (Math.abs(s.a) > 5 / 57.3) return s.t - tr[0].t + 1 / 60; return null; })();
    // a fresh turn, let go at 90°
    await T.up(1); await step(240, false); s1 = (await step(1))[0];
    await T.down(1, SX, SY); await step(2, false); await T.move(1, SX + FULL, SY); let k = 0, cur = s1, acc = 0, last = s1.py;
    for (; k < 600; k++) { cur = (await step(1))[0]; acc += wrap(cur.py - last); last = cur.py; if (Math.abs(acc) >= Math.PI / 2) break; }
    await T.up(1); const aft = await step(240); const ua = unwrapTurn(aft, 'py', cur.py); out.overshoot = deg(Math.abs(ua[ua.length - 1].a));
    out.stopT = (() => { let t = null; for (let i = 1; i < ua.length; i++) if (Math.abs(ua[i].a - ua[i - 1].a) * 60 > 2 / 57.3) t = ua[i].t - cur.t; return t === null ? 0 : +t.toFixed(2); })();
    out.camSettle = settleCam(aft, cur.t);
    note(`F4 fly turn: ${JSON.stringify(out)}`); line('F4', out.flying, `flight turn (Fly held): ${JSON.stringify(out)}`);
  }

  // F5: climb and dive in flight, Fly held: stick up for 1 s, then let go; stick down for 1 s, then let go
  {
    const out = RES.climb = {};
    for (const [name, dy] of [['up', -FULL], ['down', FULL]]) {
      await scene('air'); await T.none(); await T.down(2, B.x, B.y); await step(180, false); const s1 = (await step(1))[0];
      await T.down(1, SX, SY); await step(2, false); await T.move(1, SX, SY + dy); const tr = await step(60);
      const at = (t) => tr[Math.min(tr.length - 1, Math.round(t * 60) - 1)];
      await T.up(1); const aft = await step(150);
      out[name] = { pitch025: deg(at(0.25).pp), pitch05: deg(at(0.5).pp), pitch1: deg(at(1).pp), vy1: +(at(1).y - s1.y).toFixed(1), pitchAfter1: deg(aft[59].pp), pitchAfter25: deg(aft[aft.length - 1].pp) };
    }
    await T.none(); note(`F5 climb/dive: ${JSON.stringify(out)}`); line('F5', true, `climb and dive (Fly held; "up" is the stick pushed up): ${JSON.stringify(out)}`);
  }

  // F6: hovering, Fly let go: full stick right, the time to face 90° and 180°
  {
    const out = RES.hover = {};
    await scene('air'); await T.none(); await T.down(2, B.x, B.y); await step(60, false); await T.up(2); await step(240, false); const s1 = (await step(1))[0]; out.sp = +s1.sp.toFixed(2); out.fly = s1.fly;
    await T.down(1, SX, SY); await step(2, false); await T.move(1, SX + FULL, SY); const tr = await step(300); const u = unwrapTurn(tr, 'hd', s1.hd); out.t90 = firstOver(u, Math.PI / 2); out.t180 = firstOver(u, Math.PI); out.drift = +Math.hypot(tr[tr.length - 1].x - s1.x, tr[tr.length - 1].z - s1.z).toFixed(1);
    await T.none(); await step(30, false);
    note(`F6 hover turn: ${JSON.stringify(out)}`); line('F6', out.fly, `hover turn (Fly let go): ${JSON.stringify(out)}`);
  }

  // F7: a thumb resting near the middle in flight: 3 px and 6 px off for 3 s, Fly held
  {
    const out = RES.flyDrift = {};
    for (const px of [3, 6]) {
      await scene('air'); await T.none(); await T.down(2, B.x, B.y); await step(120, false); const s1 = (await step(1))[0];
      await T.down(1, SX, SY); await T.move(1, SX + px, SY - px); const tr = await step(180); const e = tr[tr.length - 1];
      out['px' + px] = { turn: deg(Math.abs(unwrapTurn(tr, 'py', s1.py).slice(-1)[0].a)), pitch: deg(e.pp - s1.pp) }; await T.up(1); await step(5, false);
    }
    await T.none(); note(`F7 drift: ${JSON.stringify(out)}`); line('F7', true, `flight, a thumb resting off the middle: ${JSON.stringify(out)}`);
  }

  // F8: the skim (Boost held on his feet, the man in red): full stick right from a straight run
  {
    const out = RES.skim = {};
    await scene('ground', 'fire'); await T.down(2, B.x, B.y); await T.down(1, SX, SY); await T.move(1, SX, SY - FULL); await step(120, false); const s1 = (await step(1))[0]; out.skim = s1.fly; out.sp = +s1.sp.toFixed(1);
    await T.move(1, SX + FULL, SY); const tr = await step(240); out.t90 = reach(tr, 'py', s1.py, -Math.PI / 2); const u = unwrapTurn(tr, 'py', s1.py); out.turned4s = deg(Math.abs(u[u.length - 1].a));
    await T.none(); await step(30, false); await page.evaluate(() => window.__feel.reset());
    note(`F8 skim: ${JSON.stringify(out)}`); line('F8', true, `skim on the jets: ${JSON.stringify(out)}`);
  }
  // F9: a thumb set down on the drawn stick but not dead on its centre (12 px off, as a thumb lands): what the stick reads before the thumb has moved at all
  {
    const out = RES.landOnStick = {};
    const s0 = await scene('ground', 'water'); await T.down(1, S.x + 12, S.y - 4); const tr = await step(60); const e = tr[tr.length - 1];
    out.read = await page.evaluate(() => { const u = window.__game.ui.input; return [+u.mx.toFixed(2), +u.my.toFixed(2)]; }); out.moved1s = +Math.hypot(e.x - s0.x, e.z - s0.z).toFixed(2); await T.up(1); await step(30, false);
    note(`F9 land on the stick: ${JSON.stringify(out)}`); line('F9', true, `a thumb set down 12 px off the drawn stick's centre: ${JSON.stringify(out)}`);
  }
  const real = errors.filter((x) => !/qa\.js|Failed to load/.test(x));
  line('F0', !real.length, `${real.length} page errors ${real[0] || ''}`);

  // the clips: each scheme under the fingers, drawn, the touches shown
  if (CLIPS) {
    const dir = path.join(out, 'clips'); fs.mkdirSync(dir, { recursive: true });
    await page.evaluate(() => window.__feel.draw(true));
    const film = async (name, setup, script) => {
      const fr = path.join(dir, name); fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr, { recursive: true }); let n = 0;
      const shoot = async (frames, every = 2) => { for (let i = 0; i < frames; i++) { await step(1, false); if (i % every === 0) await page.screenshot({ path: path.join(fr, String(n++).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 80 }); } await page.waitForTimeout(350); };
      await T.none(); await setup(); await step(20, false); await script(shoot);
      await T.none();
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(fr, '%04d.jpg'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', path.join(dir, name + '.mp4')]);
      const k = Math.max(1, Math.floor(n / 8)); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(fr, '%04d.jpg'), '-vf', `select='not(mod(n\\,${k}))',scale=422:-2,tile=4x2`, '-frames:v', '1', path.join(dir, name + '_strip.jpg')]);
      fs.rmSync(fr, { recursive: true, force: true }); note(`clip ${name}: ${n} frames`);
    };
    // his takeoff, as he set it: Boost held on his feet runs on the jets, Jump is the big fire jump, and in the air Boost is Fly: held to fly, let go to hover
    await film('takeoff', () => page.evaluate(() => window.__feel.meadow('fire')), async (shoot) => { await T.down(1, SX, SY); await T.move(1, SX, SY - FULL); await shoot(30); await T.down(2, B.x, B.y); await shoot(50); const J = await box('bJump'); await T.down(3, J.x, J.y); await shoot(8); await T.up(3); await shoot(60); await T.move(1, SX, SY); await shoot(40); await T.move(1, SX + FULL, SY); await shoot(70); await T.move(1, SX, SY); await shoot(30); await T.up(2); await shoot(60); await T.up(1); await shoot(20); });
    await film('fly_turn', () => scene('air', 60), async (shoot) => { await T.down(2, B.x, B.y); await shoot(90); await T.down(1, SX, SY); await T.move(1, SX + FULL, SY); await shoot(150); await T.up(1); await shoot(90); await T.down(1, SX, SY); await T.move(1, SX, SY - FULL); await shoot(60); await T.up(1); await shoot(60); });
    await film('hover', () => scene('air', 60), async (shoot) => { await T.down(2, B.x, B.y); await shoot(40); await T.up(2); await shoot(80); await T.down(1, SX, SY); await T.move(1, SX - FULL, SY); await shoot(120); await T.up(1); await shoot(40); });
    await film('ground_water', () => page.evaluate(() => window.__feel.meadow('water')), async (shoot) => { await T.down(1, SX, SY); await T.move(1, SX, SY - FULL); await shoot(90); await T.move(1, SX + FULL, SY); await shoot(60); await T.move(1, SX, SY + FULL); await shoot(60); await T.up(1); await shoot(40); });
    await film('ground_fire', () => page.evaluate(() => window.__feel.meadow('fire')), async (shoot) => { await T.down(1, SX, SY); await T.move(1, SX, SY - FULL); await shoot(90); await T.move(1, SX + FULL, SY); await shoot(60); await T.move(1, SX, SY + FULL); await shoot(60); await T.up(1); await shoot(40); });
    await film('surf', () => scene('surfStart'), async (shoot) => { await T.down(2, B.x, B.y); await T.down(1, SX, SY); await T.move(1, SX, SY - FULL); await shoot(60); await T.move(1, SX + FULL, SY); await shoot(120); await T.move(1, SX, SY - FULL); await shoot(60); });
    await film('swim', () => scene('swim'), async (shoot) => { await T.down(1, SX, SY); await T.move(1, SX, SY - FULL); await shoot(60); await T.move(1, SX + FULL, SY); await shoot(80); await T.up(1); await shoot(30); });
  }
  if (flags.json) fs.writeFileSync(flags.json, JSON.stringify(RES, null, 1));
  await close();
});
await finish();
