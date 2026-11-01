// The powers in the world: what a cast leaves behind once it's released. Lashes, wave fronts, lances, ice spikes, geysers, the frozen sea. All of it steps
// with the sim, never by a timer, so hit-stop and a stepped film see the same fight. combat.js decides when a power fires; this decides what it does.
import * as THREE from 'three';
import { createShoal } from './shoal.js';
import { createHomeward } from './homeward.js';
import { createSpout } from './spout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FPS = 60;

export function createPowers(G, h, D, C) {
  const lives = [], plates = [], Shoal = createShoal(G, h, D, C), Home = createHomeward(G, h, D, C), Spout = createSpout(G, h, D, C);
  const to = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let up = {}, pathT = 0, lastPlate = null; const U = D.upgrades, lv = (k) => up[k] || 0;

  const hand = (out) => { out.copy(h.pos); out.y += 0.25; out.x += Math.sin(h.heading) * 0.7; out.z += Math.cos(h.heading) * 0.7; return out; };
  // a vent he's looking at outranks the boss behind it: Lance is how a player caps one
  function ventAhead(out) {
    const B = G.boss; if (!B || !B.active || !B.vents) return false; C.camDir(v2); let best = 0.8, got = false;
    for (const q of B.vents) { if (!q.l || q.l.capped || q.capped) continue; out.set(q.p.x - h.pos.x, q.p.y + 2 - h.pos.y, q.p.z - h.pos.z); const l = out.length() || 1, c = out.dot(v2) / l; if (l < 30 && c > best) { best = c; got = true; to.copy(out).multiplyScalar(1 / l); } }
    if (got) out.copy(to); return got;
  }
  const aimDir = (a, out) => {
    if (a.id === 'lance' && ventAhead(out)) { a.atVent = true; return out; }
    if (a.target) { out.subVectors(a.target.pos, h.pos); if (a.target.r) out.y += 0.1; return out.normalize(); }
    return C.camDir(out);
  };

  // who is inside a sphere; the boss answers by its own parts
  function sweep(p, r, fn) {
    if (G.enemies) for (const e of G.enemies.alive()) { if (e.pos.distanceTo(p) < r + (e.r || 0.8)) fn(e); }
    if (G.boss && G.boss.active) G.boss.strike(p, r, (t, mul) => fn(t, mul));
  }

  // ------------------------------------------------------------------ the moment a cast starts: a circle at his feet, rings on what he's aimed at
  function begin(id, a) {
    const d = a.def, el = d.element;
    if (id === 'wave' || id === 'geyser' || id === 'lance' || id === 'glacier' || id === 'breath' || id === 'call' || id === 'breach') {
      v1.copy(h.pos); v1.y -= h.land && !h.air ? 0.85 : 0.7;
      G.fx.circle && G.fx.circle(v1, null, id === 'call' ? 2.8 : 2.0, el, (d.startup + 14) / FPS);
      if (a.target && (id === 'lance' || id === 'geyser')) G.fx.circle && G.fx.circle(a.target.pos, null, 1.9, el, 0.55);
    }
    if (id === 'riptide') { aimDir(a, a.dir); G.fx.riptide && G.fx.riptide(true); G.audio.swing(); G.fx.ring(h.pos.clone(), 1.7, 0.22, 0x7ff3ff, C.camDir(v1).clone().negate()); }
    if (id === 'maelstrom') { G.fx.spin(h.pos); G.audio.swing(); if (lv('maelstrom') >= 2) a.stunMul = U.maelstrom.stun; }
    if (id === 'geyser' && lv('geyser') >= 1) a.launchMul = U.geyser.launch;
    if (id === 'wave' && lv('wave') >= 3) a.status = { soak: 1 };
    if (id === 'breath' && lv('breath') >= 3) a.status = { chill: U.breath.chill };
    if (id === 'riptide' && lv('riptide') >= 2) a.dashMul = U.riptide.dash;
  }

  function release(id, a) {
    const d = a.def;
    C.log('release', { id });
    switch (id) {
      case 'whip': whip(a); break;
      case 'riptide': break;
      case 'maelstrom': if (G.enemies) G.enemies.pull(h.pos, radiusOf()); break;
      case 'wave': wave(a); break;
      case 'geyser': geyser(a); break;
      case 'lance': lance(a); break;
      case 'glacier': glacier(a); break;
      case 'breath': a.tick = 0; break;
      case 'call': aimDir(a, v1); G.enemies.callPack(h.pos, v1); G.audio.roar(); if (!(G.settings && G.settings.shake === false)) G.shake(0.4); break;
      case 'breach': Shoal.breach(a); break;
      case 'cast': Home.thrown(a); break;
    }
  }

  function during(a, dt) {
    const d = a.def, f = a.f, hitEnd = d.startup + d.active;
    if (a.id === 'maelstrom' && f >= d.startup && f < hitEnd && G.enemies) G.enemies.drag(h.pos, radiusOf(), dt);
    if (a.id === 'maelstrom' && lv('maelstrom') >= 3 && !a.thrown && f >= hitEnd) { a.thrown = true; if (G.enemies) for (const e of G.enemies.alive()) { to.subVectors(e.pos, h.pos); const l = to.length() || 1; if (l < radiusOf() + 2 && e.frozen <= 0) { e.vel.addScaledVector(to, U.maelstrom.throw_mps / l); e.vel.y += 4; } } G.fx.ring(h.pos.clone(), radiusOf(), 0.4, 0x7ff3ff); }
    if (a.id === 'breath' && f >= d.startup && f < hitEnd) breath(a, dt);
  }

  function end(a) { if (a.id === 'riptide') G.fx.riptide && G.fx.riptide(false); }
  const radiusOf = () => D.moves.maelstrom.radius_m * (lv('maelstrom') >= 1 ? U.maelstrom.radius : 1);

  // ------------------------------------------------------------------ Water Whip: a reaching lash, it grabs and pulls
  function whip(a) {
    lives.push({ kind: 'whip', a, t: 0, T: 6 / FPS, target: a.target, back: 0, done: false, tip: new THREE.Vector3(), reach: a.def.range_m * (lv('whip') >= 1 ? U.whip.range : 1) });
    G.audio.swing();
  }

  // ------------------------------------------------------------------ Tidal Wave: a front that travels; it strikes what it reaches, when it reaches it
  function wave(a) {
    const d = a.def, dir = aimDir(a, new THREE.Vector3()), from = h.pos.clone(); from.y += 0.4;
    G.fx.wave(from, dir, stanceWave());
    lives.push({ kind: 'wave', a, from, dir, d: 1, speed: d.speed_mps, max: d.range_m * (lv('wave') >= 2 ? U.wave.range : 1), w: d.width_m * (lv('wave') >= 1 ? U.wave.width : 1) });
    if (!(G.settings && G.settings.shake === false)) G.shake(0.3);
    G.audio.splash();
  }
  const stanceWave = () => 'water';

  // ------------------------------------------------------------------ Geyser: the bed answers: a tell, then a column that throws them up
  function floorNear(p, reach) {
    const g = G.world.heightAt(p.x, -p.z), below = p.y - g;
    return below > 0 && below < reach ? g : p.y - 2.2;     // the bed if it's close, or an upwelling just under them in open water
  }
  function geyser(a) {
    const d = a.def, p = new THREE.Vector3();
    if (a.target) p.copy(a.target.pos); else { C.camDir(v1); v1.y = Math.max(v1.y, -0.3); p.copy(h.pos).addScaledVector(v1.normalize(), d.range_m * 0.5); }
    p.y = floorNear(p, 9);
    spawnGeyser(p, d, a, false);
    if (lv('geyser') >= 3) lives.push({ kind: 'later', t: U.geyser.again_s, fn: () => spawnGeyser(p.clone(), d, a, false) });
    G.audio.bubble(); G.fx.circle && G.fx.circle(p, null, d.radius_m * 1.1, 'water', d.tell_s + 0.25);
  }
  function spawnGeyser(p, d, a, hostile) {
    const r = d.radius_m;
    const l = { kind: 'geyser', a, p, r, h: 13, t: 0, tell: d.tell_s, T: d.tell_s + d.last_s, on: false, capped: false, hostile, burstT: 0 };
    lives.push(l); return l;
  }
  // ice over a column stops it; a moment later the pressure throws the cap off in pieces
  function capGeysers(p, r) {
    for (const l of lives) {
      if (l.kind !== 'geyser' || l.capped || l.t >= l.T) continue;
      if (Math.hypot(l.p.x - p.x, l.p.z - p.z) < l.r + r) {
        l.capped = true; l.on = false; l.burstT = l.capHold || D.interactions.capped.burst_s; C.interact('capped'); C.log('capped', {});
        v1.copy(l.p); v1.y += 0.8; G.fx.shatter && G.fx.shatter(v1, 6, 1.2);
        for (let i = 0; i < 5; i++) { v2.set(Math.cos(i * 1.26), 0.8, Math.sin(i * 1.26)); G.fx.spike && G.fx.spike(v1, v2, 2.4, 0.9, l.burstT + 0.1); }
      }
    }
  }

  // ------------------------------------------------------------------ Frost Lance: a thrown spear that freezes what it meets
  function lance(a) {
    const d = a.def, dir = aimDir(a, new THREE.Vector3()), p = hand(new THREE.Vector3());
    const c = G.fx.crystal ? G.fx.crystal(p, dir, 2.4, 0.26, 9) : null;
    lives.push({ kind: 'lance', a, p, dir, left: d.range_m, speed: d.speed_mps, c, trailT: 0, pierce: lv('lance') >= 2 ? U.lance.pierce : 0, seen: new Set() });
    G.audio.swing();
  }

  // ------------------------------------------------------------------ Glacier: spikes burst in a line, one after another
  function glacier(a) {
    const d = a.def, dir = new THREE.Vector3(Math.sin(h.heading), 0, Math.cos(h.heading));
    if (a.target) { dir.subVectors(a.target.pos, h.pos); dir.y = 0; dir.normalize(); }
    const n = d.spikes + (lv('glacier') >= 1 ? U.glacier.spikes : 0), gap = (d.range_m * n) / d.spikes / n, base = h.pos.clone(); base.y = floorNear(base, 6);
    lives.push({ kind: 'glacier', a, base, dir, n, gap, i: 0, clock: 0, every: 0.032, y: base.y });
    G.audio.boom();
  }
  function spikeAt(l) {
    const a = l.a, d = a.def, s = (l.i + 1) * l.gap + 1.6, p = v1.copy(l.base).addScaledVector(l.dir, s), big = (1 + 0.5 * Math.sin((l.i / l.n) * Math.PI)) * (lv('glacier') >= 2 ? U.glacier.tall : 1), stay = lv('glacier') >= 3 ? U.glacier.stay_s : 1.5;
    p.y = l.base.y; const g = G.world.heightAt(p.x, -p.z); if (p.y - g < 4 && p.y > g - 3) p.y = g;
    p.x += (l.i % 2 ? 1 : -1) * 0.5;
    if (G.fx.spike) { for (let k = 0; k < 3; k++) { v2.set(k === 0 ? 0 : (k === 1 ? 0.45 : -0.45), 1, k === 0 ? 0 : (k === 1 ? 0.3 : -0.3)).normalize(); G.fx.spike(p, v2, (k === 0 ? 3.9 : 2.6) * big, (k === 0 ? 1.0 : 0.72) * big, stay); } G.fx.frostBurst && G.fx.frostBurst(p, 1.2 * big); }
    capGeysers(p, d.radius_m);
    const q = p.clone(); q.y += 1.2;
    sweep(q, d.radius_m, (e, mul) => C.land(e, a, mul));
    l.i++;
  }

  // ------------------------------------------------------------------ Winter's Breath: a cone that slows and freezes
  function breath(a, dt) {
    const d = a.def, dir = aimDir(a, v2), cone = d.cone_deg * (lv('breath') >= 1 ? U.breath.cone : 1), cos = Math.cos((cone * Math.PI) / 360), range = d.range_m;
    hand(v1);
    if (G.fx.frost) G.fx.frost(v1, dir, range, cone);
    a.tick -= dt * FPS;
    if (a.tick > 0) return; a.tick = d.rehit_f; a.hits.clear();
    if (G.enemies) for (const e of G.enemies.alive()) {
      to.subVectors(e.pos, h.pos); const l = to.length(); if (l > range + (e.r || 0.8)) continue;
      if (to.dot(dir) / (l || 1) < cos) continue;
      C.land(e, a); if (e.slowFor) e.slowFor(1.2, lv('breath') >= 2 ? U.breath.slow : d.slow);
    }
    capGeysers(v1.copy(h.pos).addScaledVector(dir, range * 0.5), range * 0.4);
    if (G.boss && G.boss.active) { to.subVectors(G.boss.head, h.pos); const l = to.length(); if (l < range && to.dot(dir) / (l || 1) > cos) C.land(G.boss.headT, a); }
  }

  // ------------------------------------------------------------------ Ice Path: the sea freezes under him, and holds eight seconds
  function instant(id) {
    if (id === 'spout') { Spout.start(); return; }
    if (id === 'shoalsong') { const d = D.moves.shoalsong; h.tide -= d.cost; C.cool.shoalsong = d.cooldown; Shoal.sing(); return; }      // Call's press: it costs little, and he goes on with what he was doing
    if (id !== 'icepath') return;
    const d = D.moves.icepath;
    h.tide -= d.cost; C.cool.icepath = d.cooldown; pathT = d.lay_s; lastPlate = null; C.log('release', { id }); G.quest && G.quest.note && G.quest.note('power:icepath');
    G.audio.swing(); G.fx.stance && G.fx.stance(h.pos, 'ice');
    C.interact('frozen_sea');
  }
  function layPath(dt) {
    if (pathT <= 0) return; pathT -= dt;
    if (Math.abs(h.pos.y) > 3.2 || G.world.heightAt(h.pos.x, -h.pos.z) > -1) return;
    const hold = D.interactions.frozen_sea.hold_s + (lv('icepath') >= 1 ? U.icepath.hold_s : 0), far = !lastPlate || Math.hypot(h.pos.x - lastPlate.x, h.pos.z - lastPlate.z) > 1.8;
    if (!far) return;
    lastPlate = { x: h.pos.x, z: h.pos.z, r: 4.2 * (lv('icepath') >= 2 ? U.icepath.radius : 1), t: hold, hold }; plates.push(lastPlate);
    v1.set(lastPlate.x, 0.02, lastPlate.z); G.fx.plate && G.fx.plate(v1, lastPlate.r, hold);
    if (plates.length > 40) plates.shift();
  }
  // what stands on the sea here: the surface, if a plate holds
  G.icePath = { heightAt(x, z) { for (const p of plates) { if (p.t > 0 && Math.hypot(x - p.x, z - p.z) < p.r) return 0.05; } return -Infinity; }, get plates() { return plates; } };

  // ------------------------------------------------------------------ every step
  function step(dt) {
    layPath(dt); Shoal.step(dt); Home.step(dt); Spout.step(dt, C.jumpHeld());
    for (let i = plates.length - 1; i >= 0; i--) { plates[i].t -= dt; if (plates[i].t <= 0) plates.splice(i, 1); }
    for (let i = lives.length - 1; i >= 0; i--) {
      const l = lives[i]; if (stepLife(l, dt)) lives.splice(i, 1);
    }
  }

  function stepLife(l, dt) {
    switch (l.kind) {
      case 'whip': {
        l.t += dt; hand(v1); const t = l.target, alive = t && (t.hp === undefined || t.hp > 0);
        if (l.back > 0) { l.back -= dt; if (alive) l.tip.copy(t.pos); G.fx.whip && G.fx.whip(v1, l.tip, clamp(l.back / 0.28, 0, 1)); return l.back <= 0; }
        if (alive) { to.subVectors(t.pos, v1); const dist = to.length(), q = clamp(l.t / l.T, 0, 1), travel = q * q * (3 - 2 * q); l.tip.copy(v1).addScaledVector(to, travel); if (dist > l.reach + 4) l.done = true; }
        else { C.camDir(v2); l.tip.copy(v1).addScaledVector(v2, l.reach * clamp(l.t / l.T, 0, 1)); }
        G.fx.whip && G.fx.whip(v1, l.tip, 1);
        if (l.t >= l.T && !l.done) { l.done = true; if (alive) { const pull = l.a.def.pull_mps * (lv('whip') >= 2 ? U.whip.pull : 1); C.land(t, l.a); if (G.enemies && G.enemies.grab) G.enemies.grab(t, pull); if (lv('whip') >= 3 && G.enemies) { let o = null, best = l.reach; for (const e of G.enemies.alive()) { const q = e.pos.distanceTo(t.pos); if (e !== t && q < best) { best = q; o = e; } } if (o) { C.land(o, l.a); G.enemies.grab(o, pull); } } } }
        if (l.done) l.back = 0.28;
        return false;
      }
      case 'wave': {
        const was = l.d; l.d += l.speed * dt;
        const hit = (e, mul, pos) => { to.subVectors(pos, l.from); const along = to.dot(l.dir); if (along < was - 1 || along > l.d + 1) return; if (to.addScaledVector(l.dir, -along).length() > l.w + (e.r || 0.8)) return; C.land(e, l.a, mul); if (e.vel) e.vel.addScaledVector(l.dir, 14); };
        if (G.enemies) for (const e of G.enemies.alive()) hit(e, 1, e.pos);
        if (G.boss && G.boss.active) hit(G.boss.headT, 1, G.boss.head);
        return l.d >= l.max;
      }
      case 'geyser': {
        l.t += dt;
        if (l.capped) {
          l.burstT -= dt;
          if (l.burstT <= 0) {
            v1.copy(l.p); v1.y += 1; G.fx.shatter && G.fx.shatter(v1, D.interactions.capped.shards, 1.5); G.audio.boom();
            sweep(v1, l.r + 3, (e, mul) => { if (e.onHit) e.onHit(D.interactions.capped.damage * (mul || 1), l.p, 'ice', { move: 'capped', element: 'ice', status: { chill: 1 }, knock: 8, stun: 0.8, poise: 20, launch: 8 }); });
            return true;
          }
          return false;
        }
        const was = l.on; l.on = l.t >= l.tell && l.t < l.T;
        if (G.fx.geyser) G.fx.geyser(l.p, l.r, l.h, l.t, l.tell, l.T);
        if (l.on && !was && !l.hostile) { G.audio.splash(); C.log('geyser', {}); }
        if (l.on && !l.hostile) { v1.copy(l.p); for (let k = 0; k < 3; k++) { v1.y = l.p.y + 2 + k * 4; sweep(v1, l.r, (e, mul) => C.land(e, l.a, mul)); } }
        return l.t >= l.T;
      }
      case 'lance': {
        const step = l.speed * dt; l.p.addScaledVector(l.dir, step); l.left -= step; if (l.c) l.c.place(l.p, l.dir);
        l.trailT -= dt; if (l.trailT <= 0) { l.trailT = 0.03; G.fx.motes && G.fx.motes(l.p, 2, 'ice'); }
        let done = false;
        // a Lance thrown at a vent goes to the vent: it doesn't stop on the boss he's standing beside
        if (!l.a.atVent) sweep(l.p, 1.2, (e, mul) => {
          if (done || l.seen.has(e)) return; l.seen.add(e); C.land(e, l.a, mul); if (l.a.hits) l.a.hits.delete(e);
          if (lv('lance') >= 1 && e.frozen > 0) e.frozen *= U.lance.frozen;
          if (lv('lance') >= 3) { sweep(l.p, U.lance.burst_m, (o, m2) => { if (o !== e) { const had = l.a.hits.has(o); if (!had) C.land(o, l.a, (m2 || 1) * 0.5); } }); G.fx.shatter && G.fx.shatter(l.p, 10, 1); }
          if (l.pierce > 0) l.pierce--; else done = true;
        });
        const w = { x: l.p.x, y: -l.p.z, z: l.p.y };
        if (!done && (l.left <= 0 || G.world.collide(w, 0.2))) done = true;
        capGeysers(l.p, 1); if (l.a.atVent && l.a.capDone) done = true;
        if (done) { if (l.c) l.c.kill(); G.fx.shatter && G.fx.shatter(l.p, 8, 0.8); }
        return done;
      }
      case 'later': l.t -= dt; if (l.t <= 0) { l.fn(); return true; } return false;
      case 'glacier': {
        l.clock -= dt;
        while (l.clock <= 0 && l.i < l.n) { spikeAt(l); l.clock += l.every; }
        return l.i >= l.n;
      }
    }
    return true;
  }

  return { begin, release, during, end, step, instant, lives, plates, upgrades(u) { up = u || {}; }, spawnGeyser, shoal: Shoal, home: Home, spout: Spout, quiet() { Home.reset(); }, clear() { lives.length = 0; plates.length = 0; pathT = 0; Shoal.clear(); Home.reset(); Spout.clear(); } };
}
