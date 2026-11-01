// Shoalsong: sea life as an everyday power. Holding Call spreads a ring, and what it touches follows him for about 20 s. Each kind does one job. No creature here comes from nothing:
// these are the world's own schools, rays, turtles and sharks (life.js), steered by the fields they already swim by, and they go home when the song ends. Minnow's book teaches the song:
// fish always answer; rays, turtles, sharks and the whale once he has logged them. The song's top tier is the pack, then the Whale's Breach, which is here too.
import * as THREE from 'three';
import { bendSwim, foeMaterial } from './enemies.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const ZF = new THREE.Vector3(0, 0, 1);

export function createShoal(G, h, D, C) {
  const S = D.shoal, lv = C.lv, U = D.upgrades.shoalsong, ringM = () => S.ring_m * (lv('shoalsong') >= 1 ? U.ring : 1), leadS = () => S.lead_s * (lv('shoalsong') >= 2 ? U.lead : 1), maxLed = () => S.max_led + (lv('shoalsong') >= 3 ? U.more : 0);
  const led = [], to = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), goal = new THREE.Vector3();
  const song = { on: false, r: 0, stage: 0, list: [], i: 0, n: 0 }, seen = {};
  let lightT = 0, liftT = 0, bookT = 0, mark = null, shieldAt = 0;

  const knows = (kind) => { if (S.always.includes(kind)) return true; const c = G.quest && G.quest.collect; return !c || !!c.logged[kind]; };
  const active = () => { let n = 0; for (const l of led) if (!l.going) n++; return n; };
  // sea here, at a height a body can swim at? Moves p.y into the water and says yes, or says no on land
  const inSea = (p) => { const g = G.world.heightAt(p.x, -p.z) + 1.2; if (g > -1) return false; p.y = clamp(p.y, g, -1); return true; };
  const foeNear = (p, range) => { let best = null, bd = range; for (const e of G.enemies.alive()) { const d = e.pos.distanceTo(p); if (d < bd) { bd = d; best = e; } } return best; };

  // everything that can hear him, nearest first. Called once for a song, and the ring walks down the list
  function whoHears() {
    const out = [], L = G.life; if (!L) return out;
    for (const s of L.schools) if (s.c.y > -1e3) out.push({ type: 'school', ref: s, kind: s.kind, pos: L.schoolPos(s) });      // life.js parks the schools that keep him company far down while the eye's in the air
    for (const k in S.jobs) { const H = L.herds[k]; if (!H || !knows(k)) continue; for (const a of H.agents) if ((!a.mode || a.mode === 'soar') && !a.off) out.push({ type: 'agent', ref: a, kind: k, pos: a.pos }); }
    for (const c of out) c.d = c.pos.distanceTo(h.pos);
    return out.sort((a, b) => a.d - b.d);
  }

  function join(c) {
    const had = led.find((l) => l.ref === c.ref);
    if (had) { had.going = false; had.until = G.time + leadS(); return; }
    const job = S.jobs[c.kind], school = c.type === 'school', a = c.ref;
    led.push({ type: c.type, ref: a, kind: c.kind, job, born: G.time, until: G.time + leadS(), going: false, a: rand(0, 6.283), r: S.orbit[job], biteT: rand(0.2, 1), under: 0, foe: null,
      pos: school ? new THREE.Vector3().copy(c.pos) : a.pos, goal: new THREE.Vector3().copy(c.pos), home: (school ? a.c : a.home).clone(), homeR: school ? a.r : a.radius, air: a.mode === 'soar' });
    C.log('joined', { kind: c.kind, job, d: +c.d.toFixed(1) });
  }

  // nobody in the ring: the nearest school hears him anyway, so a song never falls on empty water, and on land the nearest gull (P13c). Close, it comes; far, it comes in out of the fog behind the camera
  function behind(R, k, out) { v1.subVectors(G.camera.position, h.pos); v1.y = 0; if (v1.lengthSq() < 1e-3) v1.set(0, 0, 1); v1.normalize(); const an = (k * Math.PI) / 4; return out.set(h.pos.x + (v1.x * Math.cos(an) - v1.z * Math.sin(an)) * R, h.pos.y, h.pos.z + (v1.x * Math.sin(an) + v1.z * Math.cos(an)) * R); }
  function callInFar() {
    const c = song.list.find((q) => q.type === 'school'), b = song.list.find((q) => q.kind === 'gull'); v2.copy(h.pos); const wet = inSea(v2);
    if (c && wet) {
      if (c.d < S.fetch_m) { join(c); return true; }
      let spot = null; for (const R of [S.ring_m + 12, S.ring_m, 28, 14]) for (let k = 0; k < 8 && !spot; k++) { behind(R, k, v2); if (inSea(v2)) spot = v2; }
      if (spot) { join(c); c.ref.c.copy(spot); c.ref.r = S.school_r; led[led.length - 1].goal.copy(spot); return true; }
    }
    if (!b) return false;        // on land, or in water too thin for a school: the nearest gull
    join(b); if (b.d >= S.fetch_m) { behind(S.ring_m + 12, 0, b.ref.home); b.ref.home.y = Math.max(G.world.heightAt(b.ref.home.x, -b.ref.home.z), 0) + S.watch_y; }
    return true;
  }

  function sing() {
    song.on = true; song.r = 3; song.stage = 0; song.list = whoHears(); song.i = 0; song.n = 0;
    C.log('song', { heard: song.list.length }); G.quest && G.quest.note && (G.quest.note('power:shoalsong'), h.powers.call && G.quest.note('power:call'));
    G.fx.song(h.pos, S.ring_tap_m); G.audio.whale(); C.teach('shoalsong', 'Shoalsong', 'What the ring touches follows you');
  }
  function stepRing(dt) {
    if (!song.on) return;
    const holding = !!G.combat.charging; song.r += S.ring_mps * dt;
    if (song.stage === 0 && holding && song.r >= S.ring_tap_m) { song.stage = 1; G.fx.song(h.pos, ringM()); }
    const max = song.stage ? ringM() : S.ring_tap_m, reach = Math.min(song.r, max);
    while (song.i < song.list.length && song.list[song.i].d <= reach && active() < maxLed()) { join(song.list[song.i++]); song.n++; }
    if (song.r < max) return;
    song.on = false; if (!active() && !callInFar()) G.ui.tip && G.ui.tip('Nothing in the sea hears you here', 2);
    C.log('song_end', { led: active(), ring: max }); song.list = [];
  }
  function release(l) {
    if (l.going) return; l.going = true; C.log('left', { kind: l.kind, held: +(G.time - l.born).toFixed(1) });
    if (l.type === 'agent' && !l.air) { l.ref.home.copy(l.home); l.ref.radius = l.homeR; l.ref.wayT = 0; }
  }
  // a school is a ball on a long loop: narrowed, the loop comes in round its centre, and widened again it goes back. Both eased, so the ball never jumps
  function placeSchool(l, dt) {
    const s = l.ref; s.out = 0; if (s.c.y < -1e3) s.c.copy(l.goal); s.r += (S.school_r - s.r) * (1 - Math.exp(-dt * 1.6)); s.excite = Math.max(s.excite, 0.6);      // s.out: life.js sets a school down elsewhere once it's been out of the frame a while, and this one is taken
    if (s.fleeR > 7) { s.fleeR = 6.5; s.fleeP.copy(h.pos); }       // a school he leads holds its nerve: the pack and the roar scatter the wild ones, not these
    to.subVectors(l.goal, s.c); const d = to.length(); if (d > 0.01) s.c.addScaledVector(to, Math.min(1, (Math.min(d * 2.4, S.rush_mps) * dt) / d));
    G.life.schoolPos(s, l.pos);
  }
  function placeAgent(l, dt, rush) {
    const a = l.ref;
    if (l.air) { a.radius += (S.orbit.watch - a.radius) * (1 - Math.exp(-dt * 1.6)); to.subVectors(l.goal, a.home); const d = to.length(); if (d > 0.01) a.home.addScaledVector(to, Math.min(1, (S.rush_mps * dt) / d)); return; }      // a soaring gull is drawn round its home: move the home
    a.home.copy(l.goal); a.radius = 4; a.way.copy(l.goal); a.wayT = 3;
    to.subVectors(l.goal, a.pos); const d = to.length();
    if (d > 3 || rush) { a.pos.addScaledVector(to, (Math.min(d * 2.4, rush || S.rush_mps) * dt) / Math.max(d, 0.01)); to.divideScalar(Math.max(d, 0.01)); a.dir.lerp(to, 1 - Math.exp(-dt * 5)).normalize(); a.speed = G.life.herds[l.kind].sp.burst; a.fear = 0; }
  }
  function step(dt) {
    stepRing(dt);
    if ((bookT -= dt) <= 0) { bookT = 1; const c = G.quest && G.quest.collect; if (c && G.combat.has('shoalsong')) for (const k in S.book) if (c.logged[k] && !seen[k]) { seen[k] = 1; C.teach('song_' + k, 'Shoalsong', S.book[k]); } }
    let schools = 0;
    for (let i = led.length - 1; i >= 0; i--) {
      const l = led[i];
      if (!l.going && G.time >= l.until) release(l);
      if (l.going) {
        if (l.type !== 'school' && !l.air) { led.splice(i, 1); continue; }
        const s = l.ref, at = l.air ? s.home : s.c, span = l.air ? 'radius' : 'r'; s.out = 0; if (at.y < -1e3) { s[span] = l.homeR; led.splice(i, 1); continue; } s[span] += (l.homeR - s[span]) * (1 - Math.exp(-dt * 1.2)); to.subVectors(l.home, at); const d = to.length(); if (d > 0.01) at.addScaledVector(to, Math.min(1, (S.home_mps * dt) / d));
        if (d < 1 && Math.abs(s[span] - l.homeR) < 0.3) { at.copy(l.home); s[span] = l.homeR; led.splice(i, 1); }
        continue;
      }
      // where this one belongs: a circle round him, or on the foe its job sends it to
      l.a += dt * 0.5; l.foe = null; goal.set(h.pos.x + Math.cos(l.a) * l.r, h.pos.y + Math.sin(l.a * 1.7) * 1.2, h.pos.z + Math.sin(l.a) * l.r);
      if (l.job === 'hunt') { const m = mark && mark.hp > 0 && !mark.hidden ? mark : foeNear(h.pos, S.hunt_m); if (m) { goal.copy(m.pos); l.foe = m; } }
      if (l.job === 'shield' && ++schools > S.shield_schools) { const m = foeNear(h.pos, S.swarm_m); if (m) { goal.copy(m.pos); l.foe = m; if (m.pos.distanceTo(l.pos) < 8) { m.slowFor(0.5, S.swarm_slow); l.swarmed = true; } } }
      if (l.under > 0) { l.under -= dt; goal.set(h.pos.x, h.pos.y - 1.6, h.pos.z); if (!h.land) h.vel.y = Math.max(h.vel.y, S.lift_mps); }
      if (l.job === 'watch') { goal.set(h.pos.x, Math.max(G.world.heightAt(h.pos.x, -h.pos.z), 0) + S.watch_y, h.pos.z); l.goal.copy(goal); }
      else if (inSea(goal) || inSea(goal.lerp(l.pos, 0.35)) || inSea(goal.lerp(l.pos, 0.5))) l.goal.copy(goal);                 // over a shoal or on land they wait at the nearest sea
      if (l.type === 'school') placeSchool(l, dt); else placeAgent(l, dt, l.under > 0 ? S.lift_rush_mps : l.job === 'hunt' && l.foe ? S.hunt_mps : 0);
      if (l.job === 'hunt' && l.foe && (l.biteT -= dt) <= 0 && l.foe.pos.distanceTo(l.pos) < S.bite_m) {
        l.biteT = S.hunt_every_s; const res = l.foe.onHit(S.hunt_damage, l.pos, 'bite', { move: 'shoalsong', element: 'water', knock: 3, stun: 0.3, poise: 10 }); C.log('hunt', { foe: l.foe.kind, res });
        v1.copy(l.foe.pos); v1.y += 0.6; G.fx.sparks(v1, 10, 0xffc0a0, 6); G.audio.hit(false);
      }
    }
    // the rays carry light: it follows him through the dark, lit from the nearest ray
    if ((lightT -= dt) <= 0) { const m = h.pos.y < S.dark_y ? led.find((l) => l.job === 'light' && !l.going && l.pos.distanceTo(h.pos) < S.light_near_m) : null; if (m) { lightT = S.light_every_s; v1.copy(m.pos).lerp(h.pos, 0.5); G.look.flash(v1, 0x8fe6ff, S.light_m, S.light_every_s * 1.4); G.fx.rayLight(m.pos); C.log('raylight', {}); } }
    liftT = Math.max(0, liftT - dt); stepBreach(dt);
  }

  // a school takes the blow: it breaks round him and that one is spent. An unblockable blow goes through a school as it goes through a parry: its law is 'dodge this'
  function absorb(opts) {
    if ((opts && opts.unblockable) || G.time < shieldAt) return false;
    const l = led.find((q) => q.job === 'shield' && !q.going && q.pos.distanceTo(h.pos) < S.shield_m); if (!l) return false;
    shieldAt = G.time + S.shield_every_s; release(l); G.life.scatter(h.pos, 9); G.fx.bubbles(h.pos, 30, 2.4); G.fx.sparks(h.pos, 12, 0xcff6ff, 7); G.audio.splash(); G.hitstop = Math.max(G.hitstop, 0.04); C.log('shielded', { kind: l.kind }); return true;
  }
  // a turtle comes up under him when he's knocked about, and carries him up out of it
  function lift() {
    if (liftT > 0 || h.land) return false; const l = led.find((q) => q.job === 'lift' && !q.going && q.pos.distanceTo(h.pos) < S.lift_near_m); if (!l) return false;
    liftT = S.lift_every_s; l.under = S.lift_s; h.stun = Math.min(h.stun, S.lift_stun); G.fx.bubbles(h.pos, 14, 1.4); C.log('lifted', {}); return true;
  }

  // ------------------------------------------------------------------ the Whale's Breach: the song's top tier. It comes up through what he's fighting, side on to the camera, and armour doesn't stop it
  const src = G.creatures && G.creatures.whale, geoW = src ? src.geometry : new THREE.CapsuleGeometry(2.4, 17, 6, 12).rotateX(Math.PI / 2);
  const baseW = src ? src.material.clone() : new THREE.MeshStandardMaterial({ color: 0x33424e, roughness: 0.5 }), swimW = { t: { value: 0 }, amp: { value: 1 } };
  bendSwim(baseW, G, geoW, swimW);
  const matW = foeMaterial(baseW, { uAmp: swimW.amp }), whale = new THREE.Mesh(geoW, matW); whale.visible = false; whale.frustumCulled = false; G.scene.add(whale); G.fx.warmList.push(whale);
  const Bk = { on: false, t: 0, tc: 0.5, p: new THREE.Vector3(), s: new THREE.Vector3(), v: new THREE.Vector3(), a: null, broke: false, under: true, end: 3, cp: new THREE.Vector3() };
  function breach(a) {
    const B = S.breach, t = a.target; Bk.on = true; Bk.t = -B.tell_s; Bk.a = a; Bk.broke = false; a.hits.clear();
    if (t) Bk.p.copy(t.pos); else { C.camDir(v1); v1.y = 0; Bk.p.copy(h.pos).addScaledVector(v1.normalize(), 14); }
    const floor = G.world.heightAt(Bk.p.x, -Bk.p.z); Bk.p.y = Math.max(Bk.p.y, floor + 2);
    // steep, from as deep as the sea is here, and set by the height it reaches: near the top it leaves the water, whatever the depth under it. Side on to the camera, so its length shows
    v1.subVectors(Bk.p, G.camera.position); v1.y = 0; v1.normalize(); v2.set(-v1.z, 0, v1.x);
    const down = clamp(Bk.p.y - floor - 5, 3, B.depth_m), sy = Bk.p.y - down, apex = Bk.p.y > B.top_y ? B.apex_m : Bk.p.y + B.clear_m, vy = Math.sqrt(2 * B.grav * Math.max(apex - sy, 4));
    Bk.tc = (vy - Math.sqrt(Math.max(vy * vy - 2 * B.grav * down, 0))) / B.grav; Bk.v.copy(v2).multiplyScalar(B.side_mps); Bk.v.y = vy; Bk.s.copy(Bk.p).addScaledVector(v2, -B.side_mps * Bk.tc); Bk.s.y = sy;
    Bk.under = sy < 0; Bk.end = (2 * vy) / B.grav + B.sink_s;
    G.fx.circle(Bk.p, null, B.radius_m, 'water', B.tell_s + 0.25); G.fx.bubbles(Bk.p, 14, 6); G.audio.whale(); C.log('tell', { foe: 'whale' });
  }
  function stepBreach(dt) {
    if (!Bk.on) return; const B = S.breach; Bk.t += dt; swimW.t.value += dt * 7;
    if (Bk.t < 0) { if (Math.random() < 0.25) G.fx.bubbles(Bk.p, 2, B.radius_m * 0.5); return; }
    const t = Bk.t, P = whale.position; whale.visible = true; P.copy(Bk.s).addScaledVector(Bk.v, t); P.y -= 0.5 * B.grav * t * t;
    to.copy(Bk.v); to.y -= B.grav * t; whale.quaternion.setFromUnitVectors(ZF, to.normalize());
    matW.U.uThin.value = Math.max(clamp(1 - t / 0.2, 0, 1), clamp((t - (Bk.end - B.sink_s)) / B.sink_s, 0, 1));
    const under = P.y < 0;
    if (under !== Bk.under) { Bk.under = under; Bk.cp.set(P.x, 0.1, P.z); G.audio.splash(); G.fx.crown(Bk.cp, 6.5); C.log('surface', { up: !under }); }
    if (!Bk.broke && t >= Bk.tc) {
      Bk.broke = true; const a = Bk.a; a.from = v1.copy(Bk.p).setY(Bk.p.y - 4).clone(); C.log('breach', {});
      for (const e of G.enemies.alive()) { if (e.pos.distanceTo(Bk.p) < B.radius_m + (e.r || 0.8)) { if (e.armour > 0) e.armour = 0; if (e.def.shield) e.guardBroken = e.def.guard_break_s; C.land(e, a); } }
      if (G.boss && G.boss.active) { if (G.boss.breakArmour) G.boss.breakArmour(B.open_s); G.boss.strike(Bk.p, B.radius_m, (e, m) => C.land(e, a, m)); }
      G.fx.shock(Bk.p, B.radius_m, 'water'); G.life.scatter(Bk.p, 30); G.audio.boom(); if (!(G.settings && G.settings.shake === false)) G.shake(0.7);
    }
    if (t >= Bk.end) { Bk.on = false; whale.visible = false; }
  }

  function clear() {
    for (const l of led) { if (l.type === 'school') { l.ref.c.copy(l.home); l.ref.r = l.homeR; } else { l.ref.home.copy(l.home); l.ref.radius = l.homeR; } }
    led.length = 0; song.on = false; song.list = []; mark = null; Bk.on = false; whale.visible = false;
  }
  return { sing, step, absorb, lift, breach, knows, led, song, whale, breaching: () => Bk.on, setMark(e) { mark = e; }, clear };
}
