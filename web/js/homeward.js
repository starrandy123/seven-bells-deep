// Homeward Cast: he throws the trident, it goes through what it meets, and it comes back when he calls, from anywhere, on a curve that runs through the foes near the way home. It's a thing
// in the world while it's gone: the bone that carries it in his hand is folded away and this mesh flies instead. The return is timed, not chased, so it can't take longer than back_max_s
// however far it went. A catch changes nothing about what he's doing: he's free the whole way.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ZF = new THREE.Vector3(0, 0, 1);
const crm = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);

export function createHomeward(G, h, D, C) {
  const d = D.moves.cast, lv = C.lv, U = D.upgrades.cast, v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const clean = (g) => { const q = g.toNonIndexed(); q.deleteAttribute('uv'); return q; };
  const parts = [new THREE.CylinderGeometry(0.035, 0.035, 2.3, 6).rotateX(Math.PI / 2), new THREE.BoxGeometry(0.42, 0.05, 0.05).translate(0, 0, 1.1)];
  for (const x of [-0.17, 0, 0.17]) parts.push(new THREE.ConeGeometry(0.05, x ? 0.46 : 0.56, 5).rotateX(Math.PI / 2).translate(x, 0, 1.33));
  const mat = new THREE.MeshStandardMaterial({ color: 0xc99a3f, metalness: 0.9, roughness: 0.34, emissive: 0x2ad0ff, emissiveIntensity: 0.35 }); G.look.patch(mat, {});
  const mesh = new THREE.Mesh(mergeGeometries(parts.map(clean), false), mat); mesh.visible = false; mesh.frustumCulled = false; G.scene.add(mesh); G.fx.warmList.push(mesh);
  const T = { state: 'held', p: new THREE.Vector3(), v: new THREE.Vector3(), to: new THREE.Vector3(), left: 0, t: 0, dur: 1, hangT: 0, a: null, moteT: 0, stops: [], stuck: false };
  G.homeT = T;
  let B, scale0 = null;
  const bone = () => { if (B === undefined) { B = (h.bones && h.bones.weapon) || G.scene.getObjectByName('weapon') || null; if (B) scale0 = B.scale.clone(); } return B; };
  const hand = (out) => { const b = bone(); if (b) return b.getWorldPosition(out); out.copy(h.pos); out.y += 0.5; return out; };
  function fold(gone) { const b = bone(); if (b) { if (gone) b.scale.setScalar(0.001); else b.scale.copy(scale0); } mesh.visible = gone && G.sideNow !== 'fire'; if (G.ui.setCast) G.ui.setCast(gone); if (G.audio.whirr) G.audio.whirr(gone); }
  function hits(mul) {
    const a = T.a; a.from = T.p;
    if (G.enemies) for (const e of G.enemies.alive()) { if (!a.hits.has(e) && e.pos.distanceTo(T.p) < 1.4 + (e.r || 0.8) && C.land(e, a, mul) === 'blocked') T.left = 0; }
    if (G.boss && G.boss.active) G.boss.strike(T.p, 1.6, (e, m) => C.land(e, a, (m || 1) * mul));
  }

  function thrown(a) {
    hand(T.p); if (a.target) T.v.subVectors(a.target.pos, T.p).normalize(); else C.camDir(T.v);
    T.v.multiplyScalar(d.speed_mps); T.left = d.range_m * (lv('cast') >= 2 ? U.range : 1); T.state = 'out'; T.a = a; T.stuck = false; a.hits.clear(); fold(true); C.log('thrown', {}); G.audio.swing();
  }
  // home by way of the foes near the straight line, in the order it reaches them; with none, a wide swing, so it still comes home on a curve
  function recall() {
    if (T.state !== 'out' && T.state !== 'hang') return false;
    hand(T.to); const far = T.p.distanceTo(T.to); v1.subVectors(T.to, T.p).normalize(); T.t = 0; T.a.hits.clear(); T.stops.length = 0; T.stops.push({ p: T.p.clone(), e: null });
    const near = []; if (G.enemies) for (const e of G.enemies.alive()) { v2.subVectors(e.pos, T.p); const along = v2.dot(v1), off = v2.addScaledVector(v1, -along).length(); if (along > -3 && along < far + 3 && off < d.bend_m) near.push({ e, along }); }
    near.sort((a, b) => a.along - b.along); for (const q of near.slice(0, lv('cast') >= 3 ? U.stops : d.back_stops)) T.stops.push({ p: q.e.pos.clone(), e: q.e });
    if (T.stops.length === 1) { v2.set(-v1.z, 0, v1.x); if (v2.lengthSq() < 0.01) v2.set(1, 0, 0); T.stops.push({ p: T.p.clone().lerp(T.to, 0.5).addScaledVector(v2.normalize(), Math.min(d.swing_m, far * 0.3)), e: null }); }
    T.stops.push({ p: T.to, e: null });
    let len = 0; for (let i = 1; i < T.stops.length; i++) len += T.stops[i].p.distanceTo(T.stops[i - 1].p);
    T.dur = clamp(len / d.back_mps, d.back_min_s, d.back_max_s); T.state = 'back'; C.log('recall', { far: +far.toFixed(1), dur: +T.dur.toFixed(2), through: near.length }); G.audio.swing(); G.fx.sparks(T.p, 8, 0x9ff4ff, 5); return true;
  }
  function curve(q, out) {
    const P = T.stops, n = P.length - 1, f = Math.min(q * n, n - 1e-6), i = f | 0, u = f - i, a = P[Math.max(0, i - 1)].p, b = P[i].p, c = P[i + 1].p, e = P[Math.min(n, i + 2)].p;
    return out.set(crm(a.x, b.x, c.x, e.x, u), crm(a.y, b.y, c.y, e.y, u), crm(a.z, b.z, c.z, e.z, u));
  }
  function caught() {
    T.state = 'held'; fold(false); T.a = null; hand(v1); G.fx.sparks(v1, 14, 0x9ff4ff, 7); G.fx.ring(v1.clone(), 1.6, 0.2, 0x7ff3ff, v2.subVectors(G.camera.position, v1).normalize()); G.audio.hit(false); C.log('caught', {});
  }
  function step(dt) {
    if (T.state === 'held') return;
    if (h.dead || h.state === 'cine') { T.state = 'held'; fold(false); return; }
    if (T.state === 'out') {
      T.p.addScaledVector(T.v, dt); T.left -= T.v.length() * dt; hits(1);
      const w = { x: T.p.x, y: -T.p.z, z: T.p.y }, solid = G.world.collide(w, 0.2) || T.p.y < G.world.heightAt(T.p.x, -T.p.z) + 0.2;
      if (T.left <= 0 || solid) { T.state = 'hang'; T.hangT = d.hang_s; T.stuck = !!solid; C.log('hang', { stuck: T.stuck }); if (solid) { G.audio.hit(false); G.fx.sparks(T.p, 10, 0xffe7a8, 6); } }
    } else if (T.state === 'hang') { if ((T.hangT -= dt) <= 0) recall(); }
    else {
      T.t += dt; const q = clamp(T.t / T.dur, 0, 1); hand(T.to); for (const s of T.stops) if (s.e && s.e.hp > 0) s.p.copy(s.e.pos);
      v3.copy(T.p); curve(q, T.p); T.v.subVectors(T.p, v3).multiplyScalar(1 / Math.max(dt, 1e-3)); hits(((d.back_damage / d.damage) * (lv('cast') >= 1 ? U.back : 1))); G.fx.whip(T.to, T.p, 0.35);
      if (q >= 1) { caught(); return; }
    }
    mesh.position.copy(T.p);
    if (T.state !== 'hang' && T.v.lengthSq() > 1e-3) mesh.quaternion.setFromUnitVectors(ZF, v1.copy(T.v).normalize().multiplyScalar(T.state === 'back' ? -1 : 1));      // the butt comes home first, to the hand
    if (T.state === 'hang' && !T.stuck) mesh.rotateZ(dt * 3);
    if ((T.moteT -= dt) <= 0 && T.state !== 'hang') { T.moteT = 0.03; G.fx.motes(T.p, 1, 'water'); }
    if (G.audio.whirrAt) { const cam = G.camera, dist = T.p.distanceTo(cam.position); v1.subVectors(T.p, cam.position).normalize(); v2.set(1, 0, 0).applyQuaternion(cam.quaternion); G.audio.whirrAt(clamp(v1.dot(v2) * 1.4, -1, 1), clamp(1 - dist / 45, 0, 1), clamp(T.v.length() / 50, 0, 1)); }
  }
  return { thrown, recall, step, T, mesh, get out() { return T.state !== 'held'; }, get flying() { return T.state === 'back'; }, reset() { if (T.state !== 'held') { T.state = 'held'; fold(false); } } };
}
