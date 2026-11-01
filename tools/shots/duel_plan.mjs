// A filmed fight: the Warden and an Emberkin, from a camera that holds them both, low over the water. Writes a plan for web_check/film.mjs.
//   node duel_plan.mjs <base url> <out.json> [seconds] [stage: sea|beach]
import fs from 'fs';
const [base, out, seconds = '20', stage = 'sea'] = process.argv.slice(2);
const setup = `(() => { const Q = window.__qa, h = G.hero, s = G.world.data.spawn, T = h.pos.constructor;
  ${stage === 'beach' ? "Q.walkAt(-268, -566);" : "Q.swimAt(s.x, s.y, -0.4);"} h.inv = 0; h.maxHp = h.hp = 900; Object.assign(h.powers, { dash: true, spin: true, wave: true, ice: true, call: true });
  G.noBeacon = true; G.camera.fov = 40; G.camera.updateProjectionMatrix(); G.camYaw = ${stage === 'beach' ? 1.2 : 0.5}; window.__e = G.ember.raidNow(1)[0]; const D = window.__d = { n: 0, mid: new T(h.pos.x, 2, h.pos.z), cam: new T(), first: true, next: 8.2, step: 0 }; D.cam.copy(h.pos).add(new T(-Math.sin(G.camYaw) * 9, 1.6, -Math.cos(G.camYaw) * 9));
  // the lens stands to one side of the line between them, a little behind him, low, and keeps them both in frame; everything it does is damped, so it moves as a person moves a camera
  G.filmCam = (dt) => { const c = G.camera, e = window.__e, a = h.drawPos || h.pos, b = e.draw || e.pos, far = a.distanceTo(b), near = Math.min(far, 34), t = 1 - Math.exp(-2.6 * dt), T2 = new T().subVectors(b, a); T2.y = 0; const L = T2.length() || 1; T2.multiplyScalar(1 / L);
    const side = new T(T2.z, 0, -T2.x); const mid = new T().lerpVectors(a, b, Math.min(1, 9 / Math.max(far, 9)) * 0.55), want = new T().copy(a).addScaledVector(T2, -8.0 - near * 0.55).addScaledVector(side, 5 + near * 0.32); want.y = Math.max(a.y + 1.1 + near * 0.05, G.world.heightAt(want.x, -want.z) + 1, 0.8);
    D.cam.lerp(want, t); D.mid.lerp(mid, 1 - Math.exp(-3.4 * dt)); c.position.copy(D.cam); c.up.set(0, 1, 0); c.lookAt(D.mid.x, D.mid.y + 0.6 + Math.min(near, 18) * 0.1, D.mid.z); }; })()`;
// the Warden's side of it: he holds the surface, reads the distance, and answers: whip at range, the current when it's near, the geyser under it, blows when it's down
const each = `const Q = window.__qa, h = G.hero, e = window.__e, D = window.__d; D.n++; const d = e.pos.distanceTo(h.pos), w = { my: 0, mx: 0, ud: h.pos.y < -0.55 && !h.land ? 1 : 0 };
  if (t > D.next && e.hp > 0 && e.state !== 'swimTo') { const yawTo = Math.atan2(e.pos.x - h.pos.x, e.pos.z - h.pos.z); G.camYaw = yawTo; if (e.doused > 0 && d < 7) { w.atk = true; D.next = t + 0.42; } else if (d < 16.5) { D.step++; if (D.step % 4 === 2 && d < 13) w.dash = true; else if (D.step % 4 === 0 && d < 13) w.p4 = true; else w.atk = true; D.next = t + 1.05; } }
  Q.drive(w); if (D.n % 45 === 0) console.log('roof ' + JSON.stringify({ t: +t.toFixed(1), st: e.state, y: +e.pos.y.toFixed(1), d: +d.toFixed(1), heat: +e.heat.toFixed(2), hp: e.hp | 0, hhp: h.hp | 0, doused: +(e.doused || 0).toFixed(1) }));`;
fs.writeFileSync(out, JSON.stringify({ url: base + '?fresh&tier=phone&film&qa', hud: false, shots: [{ name: 'duel', seconds: +seconds, warm: 6, setup, each }] }));
