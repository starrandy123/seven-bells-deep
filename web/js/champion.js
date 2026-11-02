// The champions: the boss each side meets, and the duel that shows both (Randy, 2 Nov: "Make sure we have the right bosses for the fire elementals too"; "The fight between the water and fire elementals must be great and feature all their highlighted powers"). Pipeline/research/WORLD_SOURCES.md.
// A fight in the shape boss fights have had for thirty years: a build-up and a reveal; a first phase that teaches; a second and third that escalate; a false death; the last push; the kill. Every blow comes from his body and is told, for 0.75 s if it's quick, up to 1.5 if it's heavy, 2.6 if it fills the arena, with a sound; after each he stands open for two to three seconds.
// He's an Emberkin's body, in its all-element form: the same rig, flight and hit rules, with a head of his own. Nothing here is new machinery: the looks are the same calls the players' powers make.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
const Y = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;

export function createChampions(G, A) {
  let beaten = false; const C = A.D.champions, M = C.moves, v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3(); let duel = null;
  const fxOf = () => (G.fireKit && G.fireKit.water) || G.fx, KIT = () => G.fireKit.look;
  const handOf = (e, out, i = 0) => e.slot.jets[i][1].getWorldPosition(out);
  const foeOf = (e) => e.foe || G.hero;
  function hit(e, T, n, opts = {}) {
    if (T === G.hero) { const res = T.damage(n, e.pos, { heavy: !!opts.heavy, unblockable: !!opts.unblockable }); G.combat.log.push({ t: G.time, type: 'contact', foe: 'champion', blow: e.B.move, res }); return res; }
    return T.onHit(n, e.pos, 'champion', { element: e.side, melee: false, status: e.side === 'water' ? { soak: 1 } : {}, knock: 7, stun: 0.3, poise: 30 });
  }
  const phaseOf = (e) => { const q = e.hp / e.maxHp; let p = 0; C.phases.forEach((f, i) => { if (q <= f.at) p = i; }); return p; };
  // In the duel they take turns: a fight is a conversation, one attacks and the other answers, with a slight pause between (the pause-burst-pause of Hong Kong action). Pipeline/research/DUEL_SOURCES.md
  const BUSY = { tell: 1, strike: 1, guard: 1, clash: 1 };
  function nextMove(e) {
    if (duel) { const o = e.foe; if (o && (BUSY[o.B.st] || (duel.last === e && o.B.st !== 'fallen'))) { e.B.t = 0.1; return; } duel.last = e; }
    const B = e.B, list = C.phases[phaseOf(e)].moves.filter((m) => m !== B.move), T = foeOf(e), d = e.pos.distanceTo(T.pos); let id = list[Math.floor(Math.random() * list.length)];
    if (B.since > 3 && !B.didBig) { const big = list.find((m) => M[m].big); if (big) id = big; }
    if (d > 26 && (id === 'wheel')) id = 'rush';
    if (duel) { B.seq = ((B.seq ?? (e.side === 'fire' ? -1 : 2)) + 1) % C.show.length; id = C.show[B.seq]; }      // the showcase goes through everything, in the order that builds
    B.move = id; B.since = M[id].big ? 0 : B.since + 1; B.didBig = !!M[id].big; const m = M[id]; B.st = 'tell'; B.t = m.tell_s * (e.super ? 0.82 : 1); B.total = B.t; B.done = false; B.f = 0; B.p = null; B.d = 0;
    if (m.clip) { const a = A.X.playClip(e, m.clip, 0.12, true); if (a && m.clip_t) { a.time = m.clip_t[0]; a.setEffectiveTimeScale((m.clip_t[1] - m.clip_t[0]) / m.tell_s); } e.act = a; }
    if (T === G.hero) { G.audio.tell && G.audio.tell(); G.combat.log.push({ t: G.time, type: 'tell', foe: 'champion', blow: id, tell_s: m.tell_s }); }
    if (id === 'geyser') { B.p = new THREE.Vector3().copy(T.pos); B.p.y = A.floorAt(T.pos.x, T.pos.z); B.g = 0; }
    if (id === 'wall') { B.dir = new THREE.Vector3().subVectors(T.pos, e.pos).setY(0).normalize(); }
    if (id === 'rush') { B.dir = new THREE.Vector3().subVectors(T.pos, e.pos).normalize(); }
  }
  function endMove(e, again) { const B = e.B; B.st = 'open'; B.t = duel ? rnd(0.5, 0.85) : rnd(C.recover_s[0], C.recover_s[1]) * (again ? 0.5 : 1) * (e.super ? 0.75 : 1); if (e.cur) e.cur.fadeOut(0.2); e.cur = null; }

  // the exchange: the one attacked turns to meet it. Every other time he blocks all three and answers with a side kick; the rest he's caught, and the third blow throws him back
  function meet(e, T, m) {
    if (!T.B || T.B.st === 'fallen') return; T.B.st = 'guard'; T.B.t = m.beat_s * m.clips.length + 0.5; duel.n = (duel.n || 0) + 1; T.B.blocks = duel.n % 2 === 1; A.X.playClip(T, 'e_guard', 0.08, true);
  }
  function landed(e, T, last) {
    v1.subVectors(T.pos, e.pos).normalize();
    if (T.B.blocks) { T.vel.addScaledVector(v1, 3); v2.lerpVectors(e.pos, T.pos, 0.55); v2.y += 0.9; G.fx.sparks(v2, 9, e.side === 'fire' ? 0xffb060 : 0xa8e8ff, 8); G.audio.hit(false); if (last) answer(T, e); return; }
    A.X.playClip(T, last ? 'stagger' : 'hit_front', 0.05, true); hit(e, T, M.combo.damage * (last ? 2 : 1)); T.vel.addScaledVector(v1, last ? 16 : 3.5); if (last) thrown(T);
  }
  function answer(e, T) {
    const F = G.flames, a = A.X.playClip(e, 'e_side', 0.06, true); if (a) { a.time = 0.42; a.setEffectiveTimeScale(1.5); } e.B.st = 'open'; e.B.t = 0.6; v1.subVectors(T.pos, e.pos).normalize(); F.wetNext = e.side === 'fire' ? 0 : 1; G.fireKit.flare(v2.copy(e.pos).addScaledVector(v1, 1.3), v1, 1.5); F.wetNext = 0; hit(e, T, 16); T.vel.addScaledVector(v1, 18); A.X.playClip(T, 'stagger', 0.06, true); thrown(T);
  }
  function thrown(T) { G.slowT = 0.3; G.slowK = 0.4; if (duel) { duel.hit = 0.6; duel.who = T; } }

  function strike(e, dt, T) {
    const B = e.B, id = B.move, m = M[id], fire = e.side === 'fire', F = G.flames; B.f += dt; F.wetNext = fire ? 0 : 1;
    switch (id) {
      case 'volley': if ((B.g = (B.g ?? 0) - dt) <= 0 && (B.d || 0) < m.shots) { B.d = (B.d || 0) + 1; B.g = m.gap_s; A.bolt(e, m); } A.faceHim(e, dt, 9); if (B.f > m.time_s) endMove(e); break;
      case 'rush': { e.vel.copy(B.dir).multiplyScalar(m.speed_mps); e.ask.copy(B.dir).multiplyScalar(30); v1.copy(e.vel).normalize(); F.comet(v2.copy(e.pos).addScaledVector(v1, 0.9), e.vel, 2, 6, 0.09); F.puff(e.pos, rnd(0.6, 1), 0.3, -v1.x * 7 + rnd(-3, 3), rnd(-1, 3), -v1.z * 7 + rnd(-3, 3), 4, fire ? 2 : -2, 1.5); if (!B.done && e.pos.distanceTo(T.pos) < m.reach_m) { B.done = true; hit(e, T, m.damage, { heavy: true }); G.fireKit.burst(v1.copy(T.pos), 1, null); } if (duel && B.done) { e.vel.multiplyScalar(0.15); if (T.B && T.B.st !== 'fallen') { A.X.playClip(T, 'stagger', 0.05, true); T.vel.addScaledVector(B.dir, 15); thrown(T); } endMove(e); break; } if (B.f > m.time_s) endMove(e, !B.done); break; }
      case 'combo': {      // in close: the stick-fighter's three blows, each one a burst of his element at the point of contact. Every champion does this; it's where the martial art shows
        if (!B.done) { const d = e.pos.distanceTo(T.pos); if (d > m.reach_m && B.f < m.close_s) { v1.subVectors(T.pos, e.pos).normalize(); e.vel.copy(v1).multiplyScalar(m.speed_mps); e.ask.copy(v1).multiplyScalar(24); A.faceHim(e, dt, 12); break; } B.done = true; B.f = 0; B.d = 0; e.vel.multiplyScalar(0.2); if (duel) meet(e, T, m); }
        A.faceHim(e, dt, 12); const at = m.beat_s * B.d; if (B.d < m.clips.length && B.f >= at) { const clip = m.clips[B.d], a = A.X.playClip(e, clip, 0.05, true); if (a) { a.time = m.clip_at[B.d]; a.setEffectiveTimeScale(1.5); } B.d++; if (duel && T.B && T.B.st === 'guard') landed(e, T, B.d === m.clips.length); const i = B.d === 3 ? 3 : B.d % 2; e.slot.jets[i][1].getWorldPosition(v1); v3.subVectors(T.pos, v1).normalize(); G.fireKit.flare(v1, v3, 1.1); if (B.d === 3) { v2.crossVectors(v3, Y).normalize(); F.arc(v4.copy(e.pos).lerp(T.pos, 0.45), v2.clone().negate(), v3, 2.2, 3.1, 1.3, 0.28); } if (e.pos.distanceTo(T.pos) < m.reach_m + 2.2) { hit(e, T, m.damage); G.fireKit.burst(v2.copy(T.pos), 0.8, v3); } if (T.vel) T.vel.addScaledVector(v3, B.d === 3 ? 8 : 2.4); }
        if (B.f > m.beat_s * m.clips.length + 0.3) endMove(e); break; }
      case 'whip': { const s = clamp(B.f / 0.12, 0, 1) * clamp((m.time_s - B.f) / 0.14, 0, 1); handOf(e, v1); v2.copy(T.pos); const l = v2.distanceTo(v1); if (l > m.range_m) v2.lerpVectors(v1, T.pos, m.range_m / l); (fire ? KIT() : fxOf()).whip(v1, v2, s); if (!B.done && B.f > 0.16 && l < m.range_m) { B.done = true; hit(e, T, m.damage); if (T.vel) T.vel.addScaledVector(v3.subVectors(e.pos, T.pos).normalize(), m.pull_mps); } if (B.f > m.time_s) endMove(e); break; }
      case 'wheel': { if (!B.done) { B.done = true; B.tick = 0; if (fire) KIT().spin(e.pos, e.pos); else fxOf().spin(e.pos, e.pos); A.X.playClip(e, 'e_kick', 0.1, true); } if ((B.tick -= dt) <= 0) { B.tick = 0.33; if (e.pos.distanceTo(T.pos) < m.radius_m) hit(e, T, m.damage); } e.heading += dt * 9; if (B.f > m.time_s) endMove(e); break; }
      case 'wall': { if (!B.done) { B.done = true; v1.copy(e.pos); v1.y = A.floorAt(e.pos.x, e.pos.z) + 0.4; (fire ? KIT() : fxOf()).wave(v1, B.dir, 'water'); B.from = v1.clone(); B.d = 1.5; B.hit = false; } B.d += dt * m.speed_mps; v1.subVectors(T.pos, B.from); const al = v1.dot(B.dir), sd = Math.abs(v1.x * B.dir.z - v1.z * B.dir.x), low = T.pos.y - A.floorAt(T.pos.x, T.pos.z) < 5; if (!B.hit && Math.abs(al - B.d) < 2.6 && sd < m.width_m / 2 && low) { B.hit = true; hit(e, T, m.damage, { heavy: true, unblockable: true }); } if (B.d > m.range_m) endMove(e); break; }
      case 'geyser': { B.g += dt; (fire ? KIT() : fxOf()).geyser(B.p, m.radius_m, m.height_m, B.g + B.total, B.total, B.total + m.last_s); if (!B.done && Math.hypot(T.pos.x - B.p.x, T.pos.z - B.p.z) < m.radius_m && T.pos.y - B.p.y < m.height_m) { B.done = true; hit(e, T, m.damage, { heavy: true, unblockable: true }); if (T.vel) T.vel.y = Math.max(T.vel.y, 14); } if (B.g > m.last_s) endMove(e); break; }
      case 'nova': { if (!B.done) { B.done = true; B.d = 2; B.hit = false; B.tick = 0; G.audio.boom(); if (!(G.settings && G.settings.shake === false)) G.shake(0.5); } B.d += dt * m.speed_mps; if ((B.tick -= dt) <= 0) { B.tick = 0.05; const ny = A.floorAt(e.pos.x, e.pos.z) + 0.2; for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU + B.d * 0.03; v1.set(e.pos.x + Math.cos(a) * B.d, ny, e.pos.z + Math.sin(a) * B.d); F.tongue(v1, Y, 2.4, rnd(3.5, 5.5), 0.24); } } const dd = Math.hypot(T.pos.x - e.pos.x, T.pos.z - e.pos.z), low = T.pos.y - A.floorAt(T.pos.x, T.pos.z) < 3.2; if (!B.hit && Math.abs(dd - B.d) < 3 && low) { B.hit = true; hit(e, T, m.damage, { heavy: true, unblockable: true }); } if (B.d > m.radius_m) endMove(e); break; }
    }
    F.wetNext = 0;
  }

  // the telling: every blow gathers at his hands first
  function tell(e, dt, T) {
    const B = e.B, q = 1 - B.t / B.total, F = G.flames, m = M[B.move]; A.faceHim(e, dt, 9); e.u.uTell.value = q * q * 1.3; if (e.side !== 'fire') F.wetNext = 1;
    if ((B.tg = (B.tg || 0) - dt) <= 0) { B.tg = 0.05; handOf(e, v1, 0); handOf(e, v2, 1); F.puff(v1, 0.3 + q * 0.5, 0.2, rnd(-1, 1), rnd(0, 2), rnd(-1, 1), 3, 1, 1.4); F.puff(v2, 0.3 + q * 0.5, 0.2, rnd(-1, 1), rnd(0, 2), rnd(-1, 1), 3, 1, 1.4); }
    if (B.move === 'geyser') { const fire = e.side === 'fire'; B.g = (B.g || 0) + dt; (fire ? KIT() : fxOf()).geyser(B.p, m.radius_m, m.height_m, B.total - B.t, B.total, B.total + m.last_s); }
    if (B.move === 'nova') { want.set(0, 2, 0); A.aim(e, want, 12, dt); }
    F.wetNext = 0;
  }
  const want = new THREE.Vector3();

  // his head, one step
  function step(e, dt) {
    const B = e.B, T = foeOf(e); B.t -= dt; e.super = phaseOf(e) >= 2; e.heat = 1;
    if (e.state === 'dead') return false; e.state = 'champ';
    if (B.st !== 'fallen' && !B.falsed && e.hp < e.maxHp * C.false_at) { B.falsed = true; B.st = 'fallen'; B.t = C.false_s; e.noHit = true; e.vel.multiplyScalar(0.3); if (e.cur) e.cur.fadeOut(0.2); e.cur = null; A.X.playClip(e, 'stagger', 0.2, true); G.audio.boom(); }
    switch (B.st) {
      case 'intro': { v1.copy(T.pos); v2.subVectors(e.pos, T.pos).setY(0).normalize(); A.goto(e, T.pos.x + v2.x * C.hold_m, Math.max(T.pos.y, A.floorAt(e.pos.x, e.pos.z)) + C.high_m, T.pos.z + v2.z * C.hold_m, C.in_mps, 40, dt); A.faceHim(e, dt); if (B.t <= 0) { B.st = 'idle'; B.t = 1; } break; }
      case 'idle': case 'open': {
        if (duel) { const f = e.side === 'fire' ? -1 : 1, R = 3.5 + Math.sin(G.time * 0.5) * 0.7, s = duel.p, o = e.foe, weave = o && o.B.st === 'strike' ? Math.sin(G.time * 5 + f) * 2.6 : 0; A.goto(e, s.x + Math.sin(G.time * 0.31 + f) * 2 + weave * 0.5, s.y + (f < 0 ? 4 : 3) + Math.sin(G.time * 0.7 + f) * 0.9 + weave * 0.4, s.z + f * R, 26, 46, dt); }
        else { B.ang = (B.ang ?? Math.atan2(e.pos.z - T.pos.z, e.pos.x - T.pos.x)) + dt * 0.3; const R = C.hold_m + Math.sin(G.time * 0.4) * 3; A.goto(e, T.pos.x + Math.cos(B.ang) * R, Math.max(T.pos.y, A.floorAt(e.pos.x, e.pos.z)) + C.high_m, T.pos.z + Math.sin(B.ang) * R, 12, 34, dt); }
        A.faceHim(e, dt); if (B.t <= 0) nextMove(e); break; }
      case 'guard': { A.faceHim(e, dt, 14); e.vel.multiplyScalar(Math.exp(-5 * dt)); if (B.t <= 0) { B.st = 'open'; B.t = 0.5; } break; }
      case 'clash': { const D = duel; if (!D) { B.st = 'idle'; break; } v1.lerpVectors(D.a.pos, D.b.pos, 0.5); A.goto(e, v1.x, v1.y, v1.z, 40, 80, dt); A.faceHim(e, dt, 12); if (e === D.a && D.a.pos.distanceTo(D.b.pos) < 3.2) clash(D); break; }
      case 'tell': want.set(0, 0, 0); A.aim(e, want, 24, dt); tell(e, dt, T); if (B.t <= 0) { B.st = 'strike'; B.f = 0; e.u.uTell.value = 0; B.g = 0; if (e.act && M[B.move].clip_t) e.act.setEffectiveTimeScale(1); } break;
      case 'strike': if (B.move !== 'rush') { want.set(0, 0, 0); A.aim(e, want, 24, dt); } strike(e, dt, T); break;
      case 'fallen': { want.set(0, -3, 0); A.aim(e, want, 20, dt); const f = A.floorAt(e.pos.x, e.pos.z) + 1.2; if (e.pos.y < f) { e.pos.y = f; e.vel.y = 0; } if (B.t <= 0) { B.st = 'idle'; B.t = 0.4; e.noHit = false; e.hp = Math.max(e.hp, e.maxHp * C.last_hp); G.fireKit.burst(v1.copy(e.pos), 2, null); G.audio.roar(); if (!(G.settings && G.settings.shake === false)) G.shake(0.7); if (!duel && !A.film) G.ui.toast(e.B.name, C.false_line, 3); } break; }
    }
    return true;
  }

  // the head-on meeting: fire and water at full stretch, both thrown back, the sea's steam between them, and a beat where time holds
  function clash(D) {
    const a = D.a, b = D.b, F = G.flames; v1.lerpVectors(a.pos, b.pos, 0.5); v2.subVectors(b.pos, a.pos).normalize(); G.hitstop = Math.max(G.hitstop || 0, 0.22); G.audio.boom(); G.audio.hit(true); if (!(G.settings && G.settings.shake === false)) G.shake(0.8); G.fireKit.burst(v3.copy(v1).addScaledVector(v2, -0.8), 2, v2.clone().negate()); F.wetNext = 1; G.fireKit.burst(v3.copy(v1).addScaledVector(v2, 0.8), 2, v2); F.wetNext = 0;
    for (let i = 0; i < 6; i++) { const r = rnd(0, TAU); v3.set(v1.x + Math.cos(r) * 2, v1.y + rnd(-1, 1), v1.z + Math.sin(r) * 2); G.fx.sp('smoke', v3, 3, rnd(0.7, 1.3), STEAM, { s0: 1, s1: 3.6, a: 0.3, add: 0, hot: 0, vx: Math.cos(r) * 5, vy: rnd(2, 5), vz: Math.sin(r) * 5, drag: 1.4, rot: r }); }
    G.fx.ring(v1.clone(), 16, 0.7, 0xffffff, v3.subVectors(G.camera.position, v1).normalize().clone()); a.vel.copy(v2).multiplyScalar(-22); b.vel.copy(v2).multiplyScalar(22); a.B.st = b.B.st = 'open'; a.B.t = 0.9; b.B.t = 2.1; hit(a, b, 18); hit(b, a, 18); D.clashT = rnd(11, 15); D.who = null;
  }
  const STEAM = new THREE.Color(0.9, 0.92, 0.95);
  function spawn(side, at, foe = null) {
    const p = at || new THREE.Vector3(G.hero.pos.x + Math.sin(G.camYaw) * C.from_m, G.hero.pos.y + 26, G.hero.pos.z + Math.cos(G.camYaw) * C.from_m);
    A.R.side = side; const e = A.X.spawn('emberkin', p); if (!e) return null;
    const c = C[side]; e.champ = side; e.side = side; e.maxHp = e.hp = duel ? C.duel_hp : C.hp; e.first = false; e.foe = foe; e.B = { st: 'intro', t: 2.4, total: 1, move: null, name: c.name, since: 0 }; e.state = 'champ'; e.poise = 1e6; e.heat = 1;
    A.form(e.slot, true); e.u.uHeat.value = 1; e.u.uSide.value = side === 'water' ? 1 : 0; e.u.uSwap.value = side === 'water' ? 1 : 0; e.slot.g.scale.setScalar(C.scale);
    return e;
  }
  function start(side) {
    if (G.champ) return null; const c = C[side], e = spawn(side); if (!e) return null;
    G.champ = { e, name: c.name, get hp() { return e.hp; }, get maxHp() { return e.maxHp; } }; document.querySelector('#bossbar b').textContent = c.name.toUpperCase();
    G.audio.setMood && G.audio.setMood('tense'); G.audio.roar(); if (!A.film) G.ui.toast(c.name, c.hint, 5); G.combat.log.push({ t: G.time, type: 'champion', side });
    return e;
  }
  function frame() {
    const c = G.champ; if (!c) return; if (c.e.hp <= 0 || !c.e.slot || !c.e.champ) { G.combat.log.push({ t: G.time, type: 'champion_down' }); if (!A.film) G.ui.toast(c.name + ' falls', 'The ' + (c.e.side === 'fire' ? 'fire' : 'sea') + ' goes quiet', 5); G.audio.setMood && G.audio.setMood('calm'); c.e.slot.g.scale.setScalar(1); G.champ = null; beaten = true; A.onChampDown && A.onChampDown(); }
  }
  // the showcase: both at once, nobody else in it. Where lava meets the sea, the best stage this world has
  function startDuel(at) {
    if (duel) return duel; duel = {}; const p = at || new THREE.Vector3(514, 12, 868), a = spawn('fire', v1.copy(p).add(v2.set(0, 8, -9)).clone()), b = spawn('water', v1.copy(p).add(v2.set(0, 6, 9)).clone()); a.foe = b; b.foe = a; a.B.t = 1.2; b.B.t = 1.2; duel.a = a; duel.b = b; duel.p = p; duel.clashT = 9; duel.last = b; return duel;
  }
  function endDuel() { if (!duel) return; for (const e of [duel.a, duel.b]) { if (e) { e.hp = 0; e.champ = null; e.slot.g.scale.setScalar(1); A.X.free(e); } } duel = null; }
  // the director: the duel shot as a fight is shot. Pipeline/research/DUEL_SOURCES.md
  // The camera stays on the sea's side of the two of them, so each keeps their side of the screen and the volcano stands behind. Far shots are held longer than close ones and nothing cuts before a blow lands. It frames from how far apart they are, so both are always big enough to read, feet in. A quiet moment is a two-shot, a blow on its way is seen over the other's shoulder, an exchange stays side-on without a cut, the great powers go wide, and a blow that lands cuts in closer
  const HOLD = { two: 1.3, low: 1.6, overA: 0.85, overB: 0.85, wide: 2.3, tight: 0.3 }, GREAT = { wall: 1, nova: 1, geyser: 1, wheel: 1 };
  const lens = { p: new THREE.Vector3(), at: new THREE.Vector3(), shot: '', held: 0, calm: 0, fov: 50 };
  function direct(dt) {
    const D = duel; if (!D) return; const a = D.a, b = D.b, c = G.camera.position, mid = v1.lerpVectors(a.pos, b.pos, 0.5), d = a.pos.distanceTo(b.pos), dir = v2.subVectors(b.pos, a.pos).normalize(), side = v3.crossVectors(dir, Y).normalize(); lens.held += dt; D.hit = Math.max(0, (D.hit || 0) - dt);
    const on = (e) => e.B.st === 'tell' || e.B.st === 'strike', atk = on(a) ? a : on(b) ? b : null, close = a.B.st === 'guard' || b.B.st === 'guard' || a.B.st === 'clash' || (atk && atk.B.move === 'combo' && atk.B.st === 'strike');
    let want = lens.calm % 2 ? 'low' : 'two'; if (D.hit > 0 && D.who) want = 'tight'; else if (close) want = 'two'; else if (atk && GREAT[atk.B.move]) want = 'wide'; else if (atk) want = atk === a ? 'overB' : 'overA';
    const cut = !lens.shot || (want !== lens.shot && (want === 'tight' || lens.held >= HOLD[lens.shot])); if (cut) { if (lens.shot && want !== 'two' && want !== 'low') lens.calm++; lens.shot = want; lens.held = 0; }
    const tanH = Math.tan(((lens.fov * Math.PI) / 360)) * Math.max(G.camera.aspect, 0.56), far = clamp((d * 0.5 + 2.4) / tanH, 6, 18), P = v4, look = lens.look || (lens.look = new THREE.Vector3()); let k = 7, fov = 50;
    switch (lens.shot) {
      case 'two': P.copy(mid).addScaledVector(side, -far); P.y += 0.4; look.copy(mid); look.y -= 0.2; break;
      case 'low': P.copy(mid).addScaledVector(side, -far * 0.92); P.y -= 2.8; look.copy(mid); look.y += 0.5; break;
      case 'overA': P.copy(a.pos).addScaledVector(dir, -3.6).addScaledVector(side, -1.5); P.y += 1.1; look.copy(b.pos); break;
      case 'overB': P.copy(b.pos).addScaledVector(dir, 3.6).addScaledVector(side, -1.5); P.y += 1.1; look.copy(a.pos); break;
      case 'wide': P.copy(mid).addScaledVector(side, -(15 + d * 0.5)).addScaledVector(dir, 3); P.y += 3; look.copy(mid); look.y += 1.5; k = 3; fov = 46; break;
      case 'tight': { const w = D.who || a; P.copy(w.pos).addScaledVector(side, -6.4); P.y += 0.3; look.copy(w.pos); fov = 44; k = 14; break; }
    }
    if (cut) { lens.p.copy(P); lens.at.copy(look); } else { lens.p.lerp(P, 1 - Math.exp(-k * dt)); lens.at.lerp(look, 1 - Math.exp(-9 * dt)); }
    lens.p.y = Math.max(lens.p.y, A.floorAt(lens.p.x, lens.p.z) + 0.7); c.copy(lens.p); G.camera.up.set(0, 1, 0); lens.fov = fov; if (Math.abs(G.camera.fov - fov) > 0.1) { G.camera.fov = fov; G.camera.updateProjectionMatrix(); } G.camera.lookAt(lens.at);
  }
  // Watch the duel, from the pause menu: the fight plays, he's set aside; any touch ends it
  let show = null;
  function watch(on) {
    const h = G.hero;
    if (on && !show) { show = { pos: h.pos.clone(), inv: h.inv, again: 0 }; h.model.visible = false; document.body.classList.add('duelShow'); h.inv = 1e6; startDuel(); lens.shot = ''; lens.held = 0; G.filmCam = direct; G.noBeacon = true; show.end = () => watch(false); setTimeout(() => { addEventListener('pointerdown', show.end, { once: true }); }, 400); }
    else if (!on && show) { removeEventListener('pointerdown', show.end); endDuel(); h.model.visible = true; document.body.classList.remove('duelShow'); h.inv = show.inv; G.filmCam = null; G.noBeacon = false; show = null; }
  }
  // a hard limit on how far apart they get and how far they wander: nobody leaves the shot
  function tether(D, dt) {
    const a = D.a, b = D.b; v1.subVectors(b.pos, a.pos); const d = v1.length(), big = (e) => e.B.st === 'strike' && GREAT[e.B.move], most = big(a) || big(b) ? 14 : 10; if (d > most) { const k = ((d - most) * (1 - Math.exp(-7 * dt)) * 0.5) / d; a.pos.addScaledVector(v1, k); b.pos.addScaledVector(v1, -k); }
    for (const e of [a, b]) { const x = e.pos.x - D.p.x, z = e.pos.z - D.p.z, r = Math.hypot(x, z), q = 1 - Math.exp(-4 * dt); if (r > 12) { e.pos.x -= (x * (r - 12) * q) / r; e.pos.z -= (z * (r - 12) * q) / r; } const hi = D.p.y + 9, lo = D.p.y - 5; if (e.pos.y > hi) e.pos.y += (hi - e.pos.y) * q; if (e.pos.y < lo) e.pos.y += (lo - e.pos.y) * q; }
  }
  function stepDuel(dt) { const D = duel; if (!D) return; tether(D, dt); D.clashT -= dt; const free = (e) => e.B.st === 'open' || e.B.st === 'idle'; if (D.clashT <= 0 && free(D.a) && free(D.b) && D.a.hp > 0 && D.b.hp > 0) { D.a.B.st = D.b.B.st = 'clash'; D.clashT = 99; } }
  function stepShow(dt) { stepDuel(dt); if (!show) return; const h = G.hero, D = duel; h.pos.copy(show.pos); h.vel.set(0, 0, 0); if (!D) return; if (D.a.hp <= 0 || D.b.hp <= 0) { show.again += dt; if (show.again > 3.5) { show.again = 0; endDuel(); startDuel(); } } }
  return { step, start, startDuel, endDuel, frame, direct, watch, stepShow, get duel() { return duel; }, get beaten() { return beaten; } };
}
