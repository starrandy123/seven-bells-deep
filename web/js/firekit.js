// How the fire side fights: fire emitted, blasted and comboed (Randy, 2 Nov). Pipeline/research/FIRE_SOURCES.md is what it's built from. The rules stay in combat.js and powers.js, as frame data; this file is what they look like on this side, and the blasts that carry a strike to a target at range.
// Every blow emits. Close, the fist or the foot bursts on him. Far, the same blow throws a comet that flies to him: one button, both ranges, as the elemental fighters it's drawn from do.
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createFireKit(G, F) {
  const UP = new THREE.Vector3(0, 1, 0), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), side = new THREE.Vector3(), SMOKE = new THREE.Color(0.32, 0.29, 0.28);
  const shots = []; for (let i = 0; i < 8; i++) shots.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), a: null, target: null, left: 0, f: null, mul: 1, k: 1, trail: 0 });
  const K = { rip: 0, spin: 0, spinA: 0, spinP: new THREE.Vector3(), wall: null, wallT: 0 };
  let binds = null, water = null;
  const floorAt = (p) => Math.max(G.world.heightAt(p.x, -p.z), 0);
  const smoke = (p, s, life = 0.9) => G.fx.sp('smoke', p, s, life, SMOKE, { s0: s * 0.5, s1: s * 1.5, a: 0.5, add: 0, hot: 0, vy: 1.3, drag: 1, rot: Math.random() * 6.28 });

  // a hand or a foot opening: the flash at the point of the blow
  function flare(p, dir, k = 1) {
    F.puff(p, 0.75 * k, 0.17, dir.x * 7, dir.y * 7, dir.z * 7, 6, 0.5, 1.5);
    for (let i = 0; i < 4; i++) { v1.copy(dir).multiplyScalar(rnd(5, 13)); v1.x += rnd(-3, 3); v1.y += rnd(-2.4, 3.2); v1.z += rnd(-3, 3); F.puff(p, rnd(0.28, 0.5) * k, rnd(0.18, 0.3), v1.x, v1.y, v1.z, 5, 2.5, 1.6); }
  }
  // what a hit gives: spikes of flame out from the point, a white heart, and round smoke after
  function burst(p, k = 1, dir = null) {
    for (let i = 0; i < 7; i++) { const a = rnd(0, TAU), z = rnd(-0.5, 1); v1.set(Math.cos(a) * Math.sqrt(1 - z * z), z, Math.sin(a) * Math.sqrt(1 - z * z)); if (dir) v1.addScaledVector(dir, 0.7).normalize(); F.tongue(p, v1, rnd(0.45, 0.7) * k, rnd(1.4, 2.5) * k, rnd(0.16, 0.26), v1.x * 3, v1.y * 3, v1.z * 3); }
    F.puff(p, 1.25 * k, 0.2, 0, 0, 0, 3, 0.5, 1.5); F.puff(p, 0.9 * k, 0.32, 0, 1, 0, 3, 2, 1.9);
    for (let i = 0; i < 3; i++) { v2.set(p.x + rnd(-0.5, 0.5) * k, p.y + rnd(-0.3, 0.6) * k, p.z + rnd(-0.5, 0.5) * k); smoke(v2, 0.95 * k); }
    G.fx.sparks(p, 8, 0xffb050, 8 * k);
  }
  // a thrown blast: a comet with a round head and a long tail, trailing puffs
  function throwShot(from, dir, a, target, opts = {}) {
    const s = shots.find((x) => !x.on) || shots[0], k = opts.k || 1, speed = opts.speed || 40;
    s.on = true; s.p.copy(from); s.v.copy(dir).multiplyScalar(speed); s.a = a; s.target = target; s.left = opts.range || 22; s.mul = opts.mul ?? 0.7; s.k = k; s.trail = 0; s.hit = new Set();
    s.f = F.comet(from, s.v, 1.15 * k, 4.4 * k, (opts.range || 22) / speed + 0.1); G.audio.fwoosh && G.audio.fwoosh();
    return s;
  }
  function endShot(s, hit) { s.on = false; if (s.f) { s.f.age = s.f.life; s.f = null; } burst(s.p, hit ? 1 : 0.7, null); }

  function stepShots(dt) {
    for (const s of shots) {
      if (!s.on) continue;
      if (s.target && s.target.pos && !(s.target.hp <= 0)) { v1.copy(s.target.pos); v1.y += 0.2; v2.subVectors(v1, s.p); const l = v2.length() || 1; v3.copy(s.v).normalize(); v3.lerp(v2.multiplyScalar(1 / l), 1 - Math.exp(-9 * dt)).normalize(); s.v.copy(v3).multiplyScalar(s.v.length()); if (s.f) { s.f.a.copy(v3); s.f.v.copy(s.v); s.f.p.copy(s.p); } }
      s.p.addScaledVector(s.v, dt); s.left -= s.v.length() * dt; if ((s.trail -= dt) <= 0) { s.trail = 0.035; v1.copy(s.v).normalize(); F.puff(v2.copy(s.p).addScaledVector(v1, -0.9), rnd(0.4, 0.62) * s.k, 0.22, -v1.x * 4 + rnd(-1, 1), -v1.y * 4 + rnd(-1, 1), -v1.z * 4 + rnd(-1, 1), 4, 2, 1.4); }
      let done = s.left <= 0 || s.p.y < G.world.heightAt(s.p.x, -s.p.z) + 0.1;
      if (!done && binds && s.a) {
        if (G.enemies) for (const e of G.enemies.alive()) { if (e.hidden || s.hit.has(e)) continue; if (e.pos.distanceTo(s.p) < (e.r || 0.8) + 0.9) { s.hit.add(e); s.a.hits.delete(e); s.a.from = v4.copy(s.p); binds.land(e, s.a, s.mul); done = true; break; } }
        if (!done && G.boss && G.boss.active) G.boss.strike(s.p, 1.8, (t, m) => { binds.land(t, s.a, (m || 1) * s.mul); done = true; });
      }
      if (done) endShot(s, true);
    }
  }

  // ------------------------------------------------------------------ a strike's first active frame
  function strike(a, limbName, far) {
    const h = G.hero, b = h.bones[limbName || 'hand_R'], foot = (limbName || '').startsWith('foot'), dir = v3.set(0, 0, 0); b.getWorldPosition(v2); const from = v4.copy(v2);
    if (a.shotAt && a.shotAt.pos) { dir.subVectors(a.shotAt.pos, from).normalize(); } else if (a.dir && a.dir.lengthSq() > 0.1) dir.copy(a.dir).normalize(); else dir.set(Math.sin(h.heading), 0, Math.cos(h.heading));
    flare(from, dir, foot ? 1.1 : 1);
    if (foot) {     // the kick throws its crescent, across him, from behind the foot to past it
      side.crossVectors(dir, UP).normalize(); v1.copy(from).lerp(h.pos, 0.55); F.arc(v1, v2.copy(side).multiplyScalar(-1), v3.clone().addScaledVector(UP, 0.5).normalize(), 1.9, 3.1, 1.25, 0.26);
    }
    if (far || !a.target) { const d = dir.clone(); throwShot(from.clone().addScaledVector(d, 0.5), d, a, a.shotAt || null, { k: a.def.impact === 'heavy' ? 1.35 : a.def.impact === 'medium' ? 1.1 : 0.9, mul: a.shotAt ? 0.7 : 0.7 }); } else burst(v1.copy(from).addScaledVector(dir, 0.6), 0.75, dir);
    if (!(G.settings && G.settings.shake === false)) G.shake(a.def.impact === 'heavy' ? 0.14 : 0.06);
  }

  // ------------------------------------------------------------------ what the powers look like here. Each takes the place of the water's call of the same name
  const noop = () => {};
  const look = {
    pushTrail: noop, circle: noop,
    impact(p, dir, kind) { burst(p, kind === 'heavy' ? 1.25 : kind === 'medium' ? 1 : 0.8, dir); },
    whip(a, b, s) { if (s <= 0.02) return; v1.subVectors(b, a); const l = v1.length() || 1; v1.multiplyScalar(1 / l); F.tongue(a, v1, 0.62 * s, l * 1.08, 0.09); F.tongue(a, v1, 0.32 * s, l * 1.15, 0.07); if (Math.random() < 0.7) { v2.copy(a).addScaledVector(v1, rnd(0.2, 1) * l); F.puff(v2, rnd(0.35, 0.6), 0.2, rnd(-2, 2), rnd(-1, 3), rnd(-2, 2), 4, 2, 1.5); } },
    riptide(on) { K.rip = on ? 1 : 0; if (on) burst(G.hero.pos, 0.8); },
    spin(p, who) { K.spin = 1.05; K.spinP.copy(p); K.spinWho = who || null; },
    wave(from, dir) { K.wall = { from: from.clone(), dir: dir.clone().setY(0).normalize(), d: 1.5, left: 38 }; K.wallT = 0; },
    geyser(p, r, H, t, tell, T) {
      if (t < tell) { if (Math.random() < 0.5) { const a = rnd(0, TAU), R = rnd(0, r); v1.set(p.x + Math.cos(a) * R, p.y + 0.1, p.z + Math.sin(a) * R); F.tongue(v1, UP, 0.5, rnd(0.5, 1.2), 0.2); } return; }
      const k = clamp(1 - (t - tell) / Math.max(T - tell, 0.01), 0.2, 1); F.tongue(p, UP, r * 1.5 * k, H * 0.95, 0.12); F.tongue(p, UP, r * 0.8 * k, H * 1.05, 0.1);
      for (let i = 0; i < 2; i++) { const a = rnd(0, TAU), R = rnd(0, r * 0.7); v1.set(p.x + Math.cos(a) * R, p.y + rnd(0, H * 0.7), p.z + Math.sin(a) * R); F.puff(v1, rnd(0.8, 1.4), rnd(0.25, 0.4), Math.cos(a) * 3, rnd(8, 16), Math.sin(a) * 3, 2, 3, 1.5); }
      if (Math.random() < 0.3) { v1.set(p.x, p.y + H * 0.9, p.z); smoke(v1, 2.2, 1.2); }
    },
    frost(p, dir, range, cone) { const c = (cone * Math.PI) / 360; for (let i = 0; i < 2; i++) { v1.copy(dir); v1.x += rnd(-c, c); v1.y += rnd(-c, c) * 0.6; v1.z += rnd(-c, c); v1.normalize().multiplyScalar(range * 3); F.puff(p, rnd(0.4, 0.7), rnd(0.28, 0.4), v1.x, v1.y, v1.z, 2.4, 2, 2.6); } },
    shock(p, r) { for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; v1.set(Math.cos(a), 0.2, Math.sin(a)).normalize(); F.tongue(v2.copy(p).addScaledVector(v1, 0.6), v1, 1, r * 0.8, 0.26, v1.x * 7, 0, v1.z * 7); } burst(p, 1.2); },
    guard(p) { const h = G.hero; v1.set(Math.sin(h.heading), 0, Math.cos(h.heading)); side.crossVectors(v1, UP).normalize(); v2.copy(p); v2.y += 0.9; F.arc(v2, v3.copy(side).multiplyScalar(-1), v1, 1.3, 3.14, 1.1, 0.24); },
    parry(p) { burst(p, 0.9); }, block(p) { burst(p, 0.6); },
    dodge(p, dir) { v1.copy(dir).multiplyScalar(-1); for (let i = 0; i < 5; i++) F.puff(p, rnd(0.4, 0.7), 0.26, v1.x * rnd(5, 11) + rnd(-2, 2), rnd(-1, 2), v1.z * rnd(5, 11) + rnd(-2, 2), 5, 1, 1.6); },
    perfect(p) { burst(p, 1.2); }, stance(p) { v1.copy(p); v1.y += 0.9; burst(v1, 0.7); },
    // the magma stance: what's ice on the water side is rock and fire here
    spike(p, dir, len, width) { v1.copy(dir).normalize(); F.tongue(p, v1, width * 1.5, len * 1.5, 0.36); F.tongue(p, v1, width * 0.7, len * 1.9, 0.28); G.fx.sparks(p, 3, 0xff9040, 5); },
    crystal() { return { place(np, nd) { v1.copy(nd).normalize().negate(); F.tongue(np, v1, 0.9, 6.5, 0.07); F.tongue(np, v1, 0.45, 8, 0.06); F.puff(np, 0.5, 0.16, v1.x * 3, v1.y * 3, v1.z * 3, 4, 2, 1.5); }, kill() {} }; },
    shatter(p, n, scale = 1) { burst(p, 0.8 * scale, null); }, frostBurst(p, r) { burst(p, 0.5 * r, null); },
  };
  function install(fire) {
    if (fire && !water) { water = {}; for (const k in look) { water[k] = G.fx[k]; G.fx[k] = look[k]; } }
    else if (!fire && water) { for (const k in water) G.fx[k] = water[k]; water = null; }
  }
  function frame(dt) {
    const h = G.hero; stepShots(dt); F.step(dt);
    if (G.sideNow === 'fire' && G.homeT && G.homeT.state !== 'held') {        // the Spear: the thrown lance on this side is a lance of fire, long and thin, and it comes back the same way
      const T = G.homeT; v1.subVectors(T.p, K.spearAt || T.p); K.spearAt = K.spearAt || T.p.clone(); const l = v1.length(); if (l > 1e-3) { v1.multiplyScalar(-1 / l); F.tongue(T.p, v1, 0.85, 7, 0.08); F.tongue(T.p, v1, 0.4, 8.5, 0.06); F.puff(T.p, rnd(0.45, 0.7), 0.2, v1.x * 3 + rnd(-1, 1), rnd(-1, 2), v1.z * 3 + rnd(-1, 1), 4, 2, 1.5); } K.spearAt.copy(T.p);
    } else K.spearAt = null;
    if (K.rip > 0) { v1.copy(h.vel); const sp = v1.length() || 1; v1.multiplyScalar(1 / sp); F.comet(v2.copy(h.pos).addScaledVector(v1, 0.9), h.vel, 1.9, 5.2, 0.09); for (let i = 0; i < 2; i++) F.puff(h.pos, rnd(0.6, 0.95), 0.3, -v1.x * 7 + rnd(-3, 3), rnd(-1, 3), -v1.z * 7 + rnd(-3, 3), 4, 2, 1.5); }
    if (K.spin > 0) { K.spin -= dt; K.spinA += dt * 11; const q = clamp(K.spin * 3, 0.3, 1), at = K.spinWho || h.pos; v3.copy(at); v3.y -= 0.1; for (let i = 0; i < 2; i++) { const a = K.spinA + i * Math.PI, R = i ? 4.1 : 2.3; v1.set(Math.cos(a), 0.06, Math.sin(a)); v2.set(-Math.sin(a), 0, Math.cos(a)); F.arc(v3, v1, v2, R, 1.7, 1.25 * q, 0.13); } if (Math.random() < 0.7) { const a = rnd(0, TAU); v1.set(Math.cos(a), 0, Math.sin(a)); F.puff(v2.copy(at).addScaledVector(v1, 3), rnd(0.5, 0.8), 0.28, v1.x * 7 - v1.z * 8, rnd(0, 3), v1.z * 7 + v1.x * 8, 3, 2, 1.5); } }
    if (K.wall) { const w = K.wall; w.d += dt * 34; w.left -= dt * 34; if ((K.wallT -= dt) <= 0) { K.wallT = 0.045; side.set(-w.dir.z, 0, w.dir.x); for (let i = -2; i <= 2; i++) { v1.copy(w.from).addScaledVector(w.dir, w.d).addScaledVector(side, i * 1.55 + rnd(-0.4, 0.4)); v1.y = floorAt(v1) + 0.05; F.tongue(v1, UP, rnd(1.5, 2.1), rnd(3.2, 5) * (1 - Math.abs(i) * 0.13), rnd(0.26, 0.36)); } } if (w.left <= 0) K.wall = null; }
  }
  return { strike, burst, frame, install, bind(b) { binds = b; }, comet: throwShot, flare, look, get water() { return water; } };
}
