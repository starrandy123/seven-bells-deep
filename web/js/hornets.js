// The Cinder Hornet (Randy, 2 Nov: "We need fire type animals too that the fire elementals can fight just like the water bosses"). Pipeline/research/LIFE_SOURCES.md R-4.
// Read off three real insects: the giant hornet, whose lone scout marks a target and brings the nest; the tarantula hawk's rust wings on a blue-black body; the bombardier beetle's hot spray, fired in pulses with a pop and aimed by turning the body. Drawn twelve times life size, 0.6 m.
// The swarm holds together the way midge swarms are modelled: each keeps off its neighbours and is drawn to the swarm's centre by a pull that falls with distance and is capped, a gravity of sound.
// It's the one animal that makes a slow flyer move: it catches a glide and loses a cruise. One draw for every hornet, its wings beating in the shader.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt)), rnd = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2;

// a body of facets: head, thorax, a waisted abdomen, two wings off the top of the thorax, six legs that hang. z is forward, y up; 0.6 m long. aPart: 0 body, 1 abdomen, 2 left wing, 3 right wing, 4 legs
function hornetGeo() {
  const P = [], A = [];
  const tri = (a, b, c, part) => { P.push(...a, ...b, ...c); A.push(part, part, part); };
  const bulb = (cz, rx, ry, rz, part, n = 6) => { const top = [0, ry, cz], bot = [0, -ry, cz], f = [0, 0, cz + rz], k = [0, 0, cz - rz]; const ring = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; ring.push([Math.cos(a) * rx, Math.sin(a) * ry, cz]); }
    for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; tri(f, a, b, part); tri(k, b, a, part); } void top; void bot; };
  bulb(0.25, 0.06, 0.055, 0.06, 0);
  bulb(0.13, 0.085, 0.08, 0.08, 0);
  bulb(-0.12, 0.095, 0.085, 0.19, 1, 8);
  // wings: from the top of the thorax out and back, the rust that reads at a distance
  for (const s of [-1, 1]) { const part = s < 0 ? 2 : 3, r = [0.02 * s, 0.07, 0.16], o = [0.33 * s, 0.09, 0.02], t = [0.3 * s, 0.08, -0.1], b = [0.03 * s, 0.07, 0.06]; tri(r, o, t, part); tri(r, t, b, part); tri(r, t, o, part); tri(r, b, t, part); }
  // legs: six slivers hanging under the thorax
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const z = 0.17 - i * 0.05, a = [0.04 * s, -0.04, z], b = [0.06 * s, -0.04, z - 0.02], c = [0.09 * s, -0.24 - i * 0.02, z - 0.06]; tri(a, b, c, 4); tri(a, c, b, 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aPart', new THREE.Float32BufferAttribute(A, 1)); g.computeVertexNormals(); return g;
}

export function createHornets(G, D) {
  const F = D.hornet, phone = G.tier === 'phone', MAXH = phone ? F.most_phone : F.most;
  const geo = hornetGeo(), data = new Float32Array(MAXH * 4), iData = new THREE.InstancedBufferAttribute(data, 4); geo.setAttribute('iData', iData);
  const mat = new THREE.MeshStandardMaterial({ color: 0x0b0c14, roughness: 0.4, metalness: 0.15, side: THREE.DoubleSide });
  G.look.patch(mat, { key: 'hornet',
    vertexDecl: 'attribute float aPart; attribute vec4 iData;\nvarying float vPart; varying vec4 vData;\n',
    // the wings beat far faster than a frame: drawn at an angle that jumps each frame, they read as the blur a real wing makes
    vertexBend: /* glsl */`{ vPart = aPart; vData = iData; vec3 q = position;
      if (aPart > 1.5 && aPart < 3.5) { float s = aPart < 2.5 ? -1.0 : 1.0, a = (.15 + .75*abs(sin(ocTime*97.0 + iData.x)))*iData.y; float c = cos(a*s), n = sin(a*s); vec2 xy = vec2(q.x, q.y - .07); q.x = c*xy.x - n*xy.y; q.y = n*xy.x + c*xy.y + .07; }
      transformed = q; }`,
    fragmentPars: 'varying float vPart; varying vec4 vData;\n',
    albedo: /* glsl */`{ vec3 c = vec3(.010, .012, .03); if (vPart > .5 && vPart < 1.5) c = vec3(.02, .008, .004); if (vPart > 1.5 && vPart < 3.5) c = vec3(.42, .11, .02); if (vPart > 3.5) c = vec3(.006); diffuseColor.rgb = c; }`,
    glow: /* glsl */`{ float ab = step(.5, vPart)*step(vPart, 1.5); ocGlow = vec3(1.0, .38, .05)*ab*(.35 + .9*vData.z) + vec3(1.0, .9, .8)*vData.w*.6; }`,
  });
  const im = new THREE.InstancedMesh(geo, mat, MAXH); im.count = 0; im.frustumCulled = false; im.name = 'hornets'; G.scene.add(im); G.fx.warmList && G.fx.warmList.push(im);

  // the nest: in a stack of basalt columns on the shore under the Ember Gate, the comb's hexagons rhyming with the columns'
  const nest = new THREE.Vector3(F.nest[0], 0, F.nest[1]); let nestSet = false;
  function placeNest() {
    if (nestSet) return; nestSet = true; const B = G.scene.getObjectByName('basalt'); let best = null, bd = 1e9; const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    if (B) for (let i = 0; i < B.count; i++) { B.getMatrixAt(i, m); m.decompose(p, q, s); if (s.y < 6) continue; const d = Math.hypot(p.x - nest.x, p.z - nest.z); if (d < bd) { bd = d; best = { x: p.x, y: p.y + s.y + 0.6, z: p.z }; } }
    if (best && bd < 120) nest.set(best.x, best.y, best.z); else nest.y = Math.max(G.world.heightAt(nest.x, -nest.z), 0) + 6;
  }

  const DUMMY = () => ({ uFlash: { value: 0 }, uTell: { value: 0 }, uFrost: { value: 0 }, uWet: { value: 0 }, uFade: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) } });
  const H = []; for (let i = 0; i < MAXH; i++) H.push({ i, on: false, hornet: true, def: F, kind: undefined, hidden: false, r: F.r, pos: new THREE.Vector3(), vel: new THREE.Vector3(), hp: 0, maxHp: F.hp, state: 'off', t: 0, a: rnd(0, TAU), dir: Math.random() < 0.5 ? -1 : 1, phase: rnd(0, TAU), wing: 1, heat: 0, flash: 0, frozen: 0, armour: 0, u: DUMMY(), blow: null, clock: 0, yaw: 0, pitch: 0.5,
    onHit(dmg, from, type, info = {}) { return struck(this, dmg, from, info); }, slowFor() {} });
  const S = { scout: null, markT: 0, callT: 0, cool: 0, swarm: false, lost: 0, told: false, seenT: 0 };
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e3 = new THREE.Euler(0, 0, 0, 'YXZ'), one = new THREE.Vector3(1, 1, 1), HOT = new THREE.Color(1, 0.42, 0.06), SMK = new THREE.Color(0.2, 0.18, 0.16);
  const log = (type, extra) => G.combat.log.push({ t: G.time, type, foe: 'hornet', ...extra });
  const free = () => H.find((h) => !h.on);
  function wake(h, state, at) { h.marked = false; h.on = true; h.state = state; h.hp = F.hp; h.wing = 1; h.heat = 0.3; h.flash = 0; h.t = 0; h.blow = null; h.clock = 0; h.pos.copy(at || nest); h.vel.set(rnd(-2, 2), 3, rnd(-2, 2)); h.a = rnd(0, TAU); h.soakT = 0; }

  // what a blow does: an ordinary blow takes half of one; fire that isn't a fist burns its paper wings away and it drops; water soaks them and it falls and crawls
  function struck(h, dmg, from, info) {
    if (!h.on || h.hp <= 0) return 'miss'; h.flash = 1; const el = info.element || (G.sideNow === 'fire' ? 'fire' : 'water'); v1.subVectors(h.pos, from).normalize(); h.vel.addScaledVector(v1, 7);
    if (!info.melee && el === 'fire') { h.hp = 0; h.wing = 0; h.state = 'fall'; h.t = 2; log('hornet_burnt'); if (h === S.scout || h.marked) { h.marked = false; S.scout = null; S.cool = F.again_s; log('scout_down'); } G.combat.teach('hornet_burn', 'Wings burnt', 'Fire takes their wings: a blast clears a swarm'); return 'dead'; }
    h.hp -= dmg; if (!info.melee && (el === 'water' || el === 'ice')) { h.wing = 0; h.soakT = F.soak_s; h.state = 'crawl'; h.t = F.soak_s; log('hornet_soaked'); }
    if (h.hp <= 0) { h.hp = 0; h.wing = 0; h.state = 'fall'; h.t = 2; log('hornet_dead'); if (h === S.scout || h.marked) { h.marked = false; S.scout = null; S.cool = F.again_s; log('scout_down'); } return 'dead'; }
    if (h.state === 'tell' || h.state === 'strike') { endBlow(h); h.state = 'stun'; h.t = 0.6; } return 'hit';
  }

  // ------------------------------------------------------------------ every frame
  let attackers = 0;
  function endBlow(h) { if (h.blow) { attackers = Math.max(0, attackers - 1); h.blow = null; } }
  function step(dt) {
    if (!dt) return; const hero = G.hero; S.cool = Math.max(0, S.cool - dt);
    if (Math.hypot(hero.pos.x - nest.x, hero.pos.z - nest.z) > F.wake_m * 3 && !H.some((h) => h.on)) { im.count = 0; return; }
    placeNest();
    const dn = hero.pos.distanceTo(nest), flying = hero.air;
    // a few always hang in short arcs before the nest, the way a hunting hornet does at the mouth of a hive
    const guards = H.filter((h) => h.on && h.state === 'guard').length; if (dn < F.wake_m * 2.5 && guards < F.guards && !S.swarm) { const h = free(); if (h) wake(h, 'guard'); }
    // the scout: one comes out to him, hangs off him and marks him; if it lives to fly home, the nest comes
    if (!S.scout && !S.swarm && S.cool <= 0 && !hero.dead && dn < F.wake_m) { const h = H.find((q) => q.on && q.state === 'guard') || free(); if (h) { if (!h.on) wake(h, 'scout'); h.state = 'scout'; S.scout = h; S.markT = 0; log('scout_out'); if (!S.told) { S.told = true; G.combat.teach('hornet_scout', 'A Cinder Hornet scout', 'Kill it before it flies home, or the nest comes'); } } }
    if (S.callT > 0 && (S.callT -= dt) <= 0) { S.swarm = true; S.lost = 0; let n = 0; for (const h of H) { if (n >= F.swarm) break; if (!h.on || h.state === 'guard') { if (!h.on) wake(h, 'swarm'); h.state = 'swarm'; n++; } } log('swarm', { n }); G.ui.toast && G.ui.toast('The nest is coming', 'Out-fly them, or burn their wings', 3); }
    // the swarm gives up when he's far from the nest or has out-flown it for a while
    if (S.swarm) { const d = H.reduce((m, h) => (h.on && h.state !== 'off' && h.hp > 0 ? Math.min(m, h.pos.distanceTo(hero.pos)) : m), 1e9); S.lost = d > F.lose_m ? S.lost + dt : 0; if (Math.hypot(hero.pos.x - nest.x, hero.pos.z - nest.z) > F.leash_m || S.lost > F.lose_s || hero.dead || !H.some((h) => h.on && h.hp > 0 && h.state !== 'home' && h.state !== 'guard')) { S.swarm = false; S.cool = F.again_s; for (const h of H) if (h.on && h.hp > 0) { endBlow(h); h.state = 'home'; } log('swarm_off'); } }
    // the swarm's centre, for the pull that holds it together
    let cx = 0, cy = 0, cz = 0, cn = 0; for (const h of H) if (h.on && h.hp > 0 && (h.state === 'swarm' || h.state === 'tell')) { cx += h.pos.x; cy += h.pos.y; cz += h.pos.z; cn++; } if (cn) { cx /= cn; cy /= cn; cz /= cn; }
    for (const h of H) if (h.on) think(h, dt, cn, cx, cy, cz);
    draw(dt);
  }

  function steerTo(h, x, y, z, sp, k, dt) { v1.set(x - h.pos.x, y - h.pos.y, z - h.pos.z); const d = v1.length() || 1; v1.multiplyScalar(Math.min(sp, d * 2.2) / d); h.vel.x = damp(h.vel.x, v1.x, k, dt); h.vel.y = damp(h.vel.y, v1.y, k, dt); h.vel.z = damp(h.vel.z, v1.z, k, dt); return d; }
  function think(h, dt, cn, cx, cy, cz) {
    const hero = G.hero, hp = hero.pos; h.t -= dt; h.flash = Math.max(0, h.flash - dt * 5); h.heat = damp(h.heat, h.state === 'strike' && h.blow && h.blow.id === 'scald' ? 1 : 0.3, 6, dt);
    switch (h.state) {
      case 'guard': h.a += dt * 0.9 * h.dir; steerTo(h, nest.x + Math.cos(h.a) * 2.4, nest.y + 1.5 + Math.sin(h.a * 2.3) * 0.5, nest.z + Math.sin(h.a) * 2.4, 3, 3, dt); break;
      case 'scout': { const d = steerTo(h, hp.x + Math.cos(h.a) * F.mark_m, hp.y + 1.5, hp.z + Math.sin(h.a) * F.mark_m, F.chase_mps, 2.5, dt); if (d < 2) { h.state = 'mark'; h.t = F.mark_s; log('tell', { blow: 'mark', tell_s: F.mark_tell_s }); G.audio.tell && G.audio.tell(false); } break; }
      case 'mark': {      // legs down, abdomen pumping, hanging off him: if it lives the 3 s it goes home with his scent
        h.a += dt * 0.4 * h.dir; steerTo(h, hp.x + Math.cos(h.a) * F.mark_m, hp.y + 1.5 + Math.sin(G.time * 3 + h.phase) * 0.4, hp.z + Math.sin(h.a) * F.mark_m, F.chase_mps, 3, dt); h.heat = 0.6 + 0.4 * Math.abs(Math.sin(G.time * 9));
        if (h.t <= 0) { h.state = 'home'; h.marked = true; S.cool = F.again_s * 2; log('marked'); G.ui.toast && G.ui.toast('Marked', 'The scout is flying home with your scent: catch it', 3); } break; }
      case 'home': { const d = steerTo(h, nest.x, nest.y + 1.5, nest.z, F.cruise_mps, 2.5, dt); if (d < 2.5) { if (h.marked) { h.marked = false; S.callT = F.call_s; log('recruited'); } if (h === S.scout) S.scout = null; h.state = 'guard'; } break; }
      case 'swarm': {      // round him, kept off each other, drawn to the swarm's centre; one or two at a time come in
        h.a += dt * 1.3 * h.dir; const R = F.ring_m + Math.sin(G.time * 0.7 + h.phase) * 1.2; steerTo(h, hp.x + Math.cos(h.a) * R, hp.y + 1 + Math.sin(G.time * 1.3 + h.phase) * 1.4, hp.z + Math.sin(h.a) * R, F.chase_mps, 2.2, dt);
        for (const o of H) { if (o === h || !o.on || o.hp <= 0) continue; v2.subVectors(h.pos, o.pos); const d2 = v2.lengthSq(); if (d2 < 2.25 && d2 > 1e-4) h.vel.addScaledVector(v2, (1.6 / d2) * dt * 6); }
        if (cn > 1) { v2.set(cx - h.pos.x, cy - h.pos.y, cz - h.pos.z); const d2 = Math.max(v2.lengthSq(), 1); h.vel.addScaledVector(v2.normalize(), Math.min(F.pull_cap, F.pull_k / d2) * dt); }
        const d = h.pos.distanceTo(hp); if (h.t <= 0 && attackers < G.combat.difficulty().tokens && d < F.scald.range_m + 2 && !hero.dead) { const b = d < 4 ? F.jab : Math.random() < 0.5 ? F.scald : F.jab; h.blow = b; attackers++; h.state = 'tell'; h.clock = 0; log('tell', { blow: b.id, tell_s: b.tell_s }); G.audio.tell && G.audio.tell(false); }
        else if (h.t <= 0) h.t = rnd(0.4, 0.9); break; }
      case 'tell': {      // the jab: a short arc back, the abdomen curling under. The scald: the abdomen swung to aim, and the pops
        const b = h.blow; h.clock += dt; v1.subVectors(h.pos, hp).normalize(); steerTo(h, hp.x + v1.x * (b.id === 'jab' ? 3.2 : 5.5), hp.y + 1.2, hp.z + v1.z * (b.id === 'jab' ? 3.2 : 5.5), 8, 4, dt);
        if (b.id === 'scald' && (h.popT = (h.popT || 0) - dt) <= 0) { h.popT = 0.2; G.audio.hit && G.audio.hit(false); }
        if (h.clock >= b.tell_s) { h.state = 'strike'; h.clock = 0; h.done = false; if (b.id === 'jab') { v1.subVectors(hp, h.pos).normalize(); h.vel.copy(v1).multiplyScalar(F.chase_mps * 1.2); } } break; }
      case 'strike': {
        const b = h.blow; h.clock += dt;
        if (b.id === 'jab' && !h.done && h.pos.distanceTo(hp) < b.reach_m) { h.done = true; const res = hero.damage(b.damage, h.pos); log('contact', { blow: 'jab', res }); if (res === 'parried') { endBlow(h); h.state = 'stun'; h.t = 1.2; h.vel.multiplyScalar(-0.5); break; } }
        if (b.id === 'scald') { v1.subVectors(hp, h.pos); const d = v1.length(); v1.normalize(); for (let k = 0; k < 2; k++) { v2.copy(v1).add(v3.set(rnd(-0.25, 0.25), rnd(-0.25, 0.25), rnd(-0.25, 0.25))).normalize(); G.fx.sp('dot', h.pos, 0.12, 0.42, HOT, { s0: 0.1, s1: 0.32, hot: 0.35, add: 0.6, vx: v2.x * 14, vy: v2.y * 14, vz: v2.z * 14 }); }
          if (!h.done && d < b.range_m) { h.done = true; const res = hero.damage(b.damage, h.pos); log('contact', { blow: 'scald', res }); } }
        if (h.clock >= b.strike_s) { endBlow(h); h.state = 'swarm'; h.t = rnd(0.9, 1.8); } break; }
      case 'stun': h.vel.multiplyScalar(Math.exp(-3 * dt)); h.vel.y -= 4 * dt; if (h.t <= 0) h.state = S.swarm ? 'swarm' : 'home'; break;
      case 'crawl': { const g = G.world.heightAt(h.pos.x, -h.pos.z); h.vel.y -= 9.8 * dt; if (h.pos.y < g + 0.15) { h.pos.y = g + 0.15; h.vel.set(h.vel.x * 0.3, 0, h.vel.z * 0.3); } if (h.t <= 0) { h.wing = 1; h.state = S.swarm ? 'swarm' : 'home'; h.vel.y = 4; } break; }
      case 'fall': { const g = Math.max(G.world.heightAt(h.pos.x, -h.pos.z), -0.2); h.vel.y -= 9.8 * dt; if ((h.puff = (h.puff || 0) - dt) <= 0) { h.puff = 0.08; G.fx.sp('smoke', h.pos, 0.3, 0.6, SMK, { s0: 0.12, s1: 0.4, a: 0.3, add: 0, hot: 0, vy: 0.6 }); } if (h.pos.y < g + 0.1) { h.pos.y = g + 0.1; h.vel.set(0, 0, 0); } if (h.t <= 0) { endBlow(h); h.on = false; h.state = 'off'; } break; }
    }
    if (h.state !== 'crawl' && h.state !== 'fall' && h.state !== 'stun') { const g = G.world.heightAt(h.pos.x, -h.pos.z); if (h.pos.y < Math.max(g, 0) + 0.8) h.vel.y = Math.max(h.vel.y, 3); }
    const sp = h.vel.length(), cap = h.state === 'strike' ? F.chase_mps * 1.3 : F.chase_mps; if (sp > cap) h.vel.multiplyScalar(cap / sp); h.pos.addScaledVector(h.vel, dt);
  }

  // the bodies: hanging at 30° with legs down when slow, lying out along the way at speed
  function draw(dt) {
    let n = 0; const hero = G.hero;
    for (const h of H) {
      if (!h.on) continue; const sp = Math.hypot(h.vel.x, h.vel.z); if (sp > 0.6) h.yaw = Math.atan2(h.vel.x, h.vel.z); else { v1.subVectors(hero.pos, h.pos); h.yaw = damp(h.yaw, Math.atan2(v1.x, v1.z), 4, dt); }
      h.pitch = damp(h.pitch, h.state === 'fall' || h.state === 'crawl' ? 0 : -(0.52 - 0.4 * clamp(sp / 14, 0, 1)), 6, dt);
      e3.set(h.pitch, h.yaw, h.state === 'fall' ? G.time * 6 : Math.sin(G.time * 2 + h.phase) * 0.15); qq.setFromEuler(e3); v1.copy(h.pos); v1.y += Math.sin(G.time * 5 + h.phase) * 0.05;
      m4.compose(v1, qq, one); im.setMatrixAt(n, m4); const o = n * 4; data[o] = h.phase; data[o + 1] = h.wing; data[o + 2] = h.heat; data[o + 3] = h.flash; n++;
    }
    im.count = n; if (n) { im.instanceMatrix.needsUpdate = true; iData.needsUpdate = true; }
  }
  // what blows can find: the ones in the air or on the ground and not yet gone
  function targets(list) { for (const h of H) if (h.on && h.hp > 0 && h.state !== 'guard') list.push(h); return list; }
  return { step, targets, nest, list: H, S };
}
