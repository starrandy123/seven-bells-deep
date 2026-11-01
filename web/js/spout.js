// The water tornado: he makes it and rides it. Jump held on the water raises a twisting column round him and carries him up to the top of it; what's near is drawn in, spun and thrown; at
// the top he leaps off, into a dive or, with Strike, a slam. The column is one mesh deformed on the GPU, three ropes of water wound round a line that wanders, so 26 m of it costs no more to
// build than a hand-sized splash, and it draws in two passes, its far wall and then its near one.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const NU = 36, NV = 54;

export function createSpout(G, h, D, C) {
  const S = D.spout, U = { uT: { value: 0 }, uFall: { value: 0 }, uBase: { value: new THREE.Vector3() }, uTop: { value: new THREE.Vector3() }, uR: { value: S.radius_m }, uSway: { value: 0 }, uAlpha: { value: 1 }, tN: { value: G.fx.noiseT }, uSun: { value: G.fx.sunDir } };
  const V = new Float32Array((NU + 1) * (NV + 1) * 2), P0 = new Float32Array((NU + 1) * (NV + 1) * 3), I = []; let k = 0;
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { V[k++] = i / NU; V[k++] = j / NV; }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P0, 3)); geo.setAttribute('aUV', new THREE.BufferAttribute(V, 2)); geo.setIndex(I);
  const vs = `attribute vec2 aUV; uniform float uT, uR, uSway; uniform vec3 uBase, uTop; varying vec3 vN, vW; varying vec2 vQ;
    vec3 axis(float v) { float s = sin(v * 3.14159); vec2 w = vec2(sin(v * 5.0 - uT * 1.7) + 0.5 * sin(v * 11.0 + uT * 2.3), cos(v * 4.3 - uT * 1.4) + 0.5 * cos(v * 9.0 - uT * 2.1)) * s * uSway; return vec3(mix(uBase.x, uTop.x, v) + w.x, mix(uBase.y, uTop.y, v), mix(uBase.z, uTop.z, v) + w.y); }
    float rad(float v) { return uR * (0.62 + 0.34 * v) + uR * 1.7 * exp(-v * 13.0) + uR * 0.5 * smoothstep(0.88, 1.0, v); }
    vec3 at(float a, float v) { float A = a + v * 15.0 - uT * 6.5, R = rad(v) * (1.0 + 0.24 * sin(A * 3.0) + 0.07 * sin(A * 7.0 + v * 30.0 - uT * 9.0)); return axis(v) + vec3(cos(A), 0.0, sin(A)) * R; }
    void main() { float a = aUV.x * 6.28318, v = aUV.y; vec3 p = at(a, v), dA = at(a + 0.02, v) - p, dV = at(a, v + 0.012) - p; vN = normalize(cross(dV, dA)); vW = p; vQ = vec2(a + v * 15.0 - uT * 6.5, v); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`;
  const fs = `uniform float uT, uFall, uAlpha; uniform sampler2D tN; uniform vec3 uSun; varying vec3 vN, vW; varying vec2 vQ;
    void main() {
      vec3 Vw = normalize(cameraPosition - vW), N = normalize(vN); if (!gl_FrontFacing) N = -N;
      float v = vQ.y, rope = 0.5 + 0.5 * sin(vQ.x * 3.0), n1 = texture2D(tN, vec2(vQ.x * 0.159155, v * 1.5 - uT * 0.9)).r, n2 = texture2D(tN, vec2(vQ.x * 0.477465 + uT * 0.2, v * 4.5 - uT * 2.1)).r, n3 = texture2D(tN, vec2(vQ.x * 1.114085, v * 9.0 - uT * 3.3)).r;
      N = normalize(N + (vec3(n1, n2, 1.0 - n1) - 0.5) * 0.75);
      float nv = clamp(dot(N, Vw), 0.0, 1.0), fres = pow(1.0 - nv, 2.5); vec3 R = reflect(-Vw, N); float sky = smoothstep(-0.25, 0.85, R.y);
      vec3 deep = vec3(0.01, 0.22, 0.42), mid = vec3(0.07, 0.56, 0.78), lite = vec3(0.72, 0.98, 1.0), col = mix(deep, mid, smoothstep(0.15, 0.85, rope * 0.65 + n1 * 0.5));
      float vein = pow(clamp(1.0 - abs(n1 * 2.0 - 1.0) * 2.0, 0.0, 1.0), 6.0); col += lite * vein * 0.2 * (0.4 + 0.6 * nv); col = mix(col, mix(mid, lite * 1.25, sky), fres * 0.85);
      float s = max(dot(R, uSun), 0.0), spec = pow(s, 70.0) * 2.4 + pow(s, 9.0) * 0.25;
      // white where the ropes run hardest, at the skirt and the crown: the column is being torn as it turns
      float ends = smoothstep(0.1, 0.0, v) * 0.75 + smoothstep(0.86, 1.0, v) * 0.34, foam = smoothstep(0.42, 0.68, n1 * 0.42 + n2 * 0.42 + rope * 0.34 + ends - 0.14); col = mix(col, vec3(0.93, 0.99, 1.0), foam);
      float gone = uFall > 0.0 ? 1.0 - smoothstep(1.15 - uFall * 1.4, 1.35 - uFall * 1.4, v + (n2 - 0.5) * 0.3) : 1.0, a = clamp(0.62 + fres * 0.45 + vein * 0.2 + foam * 0.5, 0.0, 1.0) * uAlpha * gone * smoothstep(1.0, 0.9, v + (n2 - 0.5) * 0.14);
      if (a < 0.01) discard; gl_FragColor = vec4((col + spec) * a, a); }`;
  const mat = (side, order) => { const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side, toneMapped: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation, uniforms: U, vertexShader: vs, fragmentShader: fs }); const q = new THREE.Mesh(geo, m); q.frustumCulled = false; q.renderOrder = order; q.visible = false; G.scene.add(q); G.fx.warmList.push(q); return q; };
  const far = mat(THREE.BackSide, 15.2), near = mat(THREE.FrontSide, 15.6);       // after the sea's surface, which draws at 15

  const T = { on: false, mode: 'off', t: 0, base: new THREE.Vector3(), topY: 0, y0: 0, spin: 0, c: { p: new THREE.Vector3(), yaw: 0, arm: 6, drop: 0, low: S.cam_low }, foamT: 0, stick: [0, 0], held: false };
  const v1 = new THREE.Vector3(), fwd = new THREE.Vector3();
  const show = (on) => { far.visible = near.visible = on; };

  function start() {
    const d = D.moves.spout; h.tide -= d.cost; C.cool.spout = d.cooldown; T.on = true; T.mode = 'rise'; T.t = 0; T.foamT = 0; T.y0 = h.pos.y; T.spin = h.heading; T.base.set(h.pos.x, Math.min(-4, h.pos.y - 3), h.pos.z); T.topY = T.y0 + 1; T.c.p.copy(h.pos); T.c.yaw = h.heading; h.carried = T.c; h.shotYaw = G.camYaw; h.inv = Math.max(h.inv, 0.3);
    U.uFall.value = 0; U.uAlpha.value = 1; U.uSway.value = 0; U.uR.value = 1.2; U.uBase.value.copy(T.base); U.uTop.value.set(T.base.x, T.topY, T.base.z); show(true);
    C.log('spout', { y: +h.pos.y.toFixed(1) }); G.quest && G.quest.note && G.quest.note('power:spout'); C.teach('spout', 'Waterspout', 'Let go at the top to leap. Strike slams down'); G.audio.roar(); G.audio.boom(); if (G.audio.spoutRoar) G.audio.spoutRoar(true); if (!(G.settings && G.settings.shake === false)) G.shake(0.5);
    v1.set(T.base.x, 0.1, T.base.z); G.fx.sheet(v1, 3.6, S.radius_m); G.life && G.life.scatter && G.life.scatter(h.pos, 30);
  }
  // off the top: on along where he's looking, or straight down with Strike
  function leap(slam) {
    if (!T.on || (T.mode !== 'rise' && T.mode !== 'top')) return; h.carried = null; T.mode = 'fall'; T.t = 0; fwd.set(Math.sin(G.camYaw), 0, Math.cos(G.camYaw));
    h.vel.set(fwd.x * S.leap_mps, S.leap_up_mps, fwd.z * S.leap_mps); h.heading = G.camYaw; h.apexY = h.pos.y; if (!slam) h.breach = { v: S.leap_mps, H: h.pos.y + (S.leap_up_mps * S.leap_up_mps) / 40 }; C.log('leapt', { y: +h.pos.y.toFixed(1), slam: !!slam });      // the dolphin's arc: the body along it, and in head first G.audio.swing(); if (G.audio.spoutRoar) G.audio.spoutRoar(false);
    if (slam) { h.vel.set(fwd.x * 6, 2, fwd.z * 6); G.combat.startAttack('plunge'); }
  }
  function step(dt, held) {
    if (!T.on) return; T.t += dt; U.uT.value += dt; const fx = G.fx;
    if (h.dead || h.state === 'cine') { clear(); return; }
    if (T.mode === 'rise' || T.mode === 'top') {
      // the stick walks it across the sea, and him with it
      const mx = T.stick[0], my = T.stick[1], sn = Math.sin(G.camYaw), cs = Math.cos(G.camYaw), nx = T.base.x + (sn * my - cs * mx) * S.drift_mps * dt, nz = T.base.z + (cs * my + sn * mx) * S.drift_mps * dt; if (G.world.heightAt(nx, -nz) < -1.5) { T.base.x = nx; T.base.z = nz; }
      if (T.mode === 'rise') { const q = clamp(T.t / S.rise_s, 0, 1); T.topY = T.y0 + (S.apex_m + 2 - T.y0) * (1 - (1 - q) * (1 - q) * (1 - q)); if (q >= 1) { T.mode = 'top'; T.t = 0; v1.set(T.base.x, T.topY - 2.4, T.base.z); fx.sheet(v1, 2.2, S.radius_m * 0.7); } }
      else if (!held || T.t >= S.top_s) { leap(false); }
      // it starts as a rope of water round him and thickens as it climbs, so the lens is outside it from the first
      U.uR.value = 1.2 + (S.radius_m - 1.2) * clamp((T.topY - T.y0) / (S.apex_m * 0.7), 0, 1); U.uSway.value = Math.min(S.sway_m, (T.topY - T.base.y) * 0.14); U.uBase.value.copy(T.base); U.uTop.value.set(T.base.x, T.topY, T.base.z);
      // the lens backs off as it goes up, and looks across the column, him high in the frame and the sea at the foot of it
      { const q = clamp((T.topY - T.y0) / (S.apex_m - T.y0), 0, 1); T.c.arm = 6 + (S.cam_arm - 6) * q; T.c.drop = S.cam_drop * q; }
      if (h.carried) { T.spin += dt * (T.mode === 'top' ? 3 : S.spin_rad); const orbit = T.mode === 'top' ? 0.5 : 1.3, w = U.uT.value * 4; T.c.p.set(T.base.x + Math.cos(w) * orbit, T.topY + 0.3, T.base.z + Math.sin(w) * orbit); T.c.yaw = T.mode === 'top' ? G.camYaw : T.spin; h.inv = Math.max(h.inv, 0.2); G.heroGlow.value = Math.max(G.heroGlow.value, 4); G.camPitch += (S.cam_pitch - G.camPitch) * (1 - Math.exp(-2.4 * dt)); }
      if (G.enemies) G.enemies.spout(T.base, T.topY, dt);
    } else {
      // he's gone, and with nothing to hold it up it comes down
      U.uFall.value = clamp(T.t / S.fall_s, 0, 1); U.uSway.value *= 1 + dt * 0.8; if (U.uFall.value >= 1) { T.on = false; T.mode = 'off'; show(false); return; }
    }
    if ((T.foamT -= dt) <= 0) { T.foamT = 0.55; v1.set(T.base.x, 0.1, T.base.z); fx.sheet(v1, T.mode === 'fall' ? 1.4 : 2.2, U.uR.value * 1.3); }
    if (T.mode !== 'fall' || U.uFall.value < 0.5) fx.spoutSpray(T.base, T.topY, S.radius_m, T.mode === 'fall' ? 0.5 : 1, U.uFall.value);
  }
  function clear() { if (h.carried === T.c) { h.carried = null; h.shotYaw = undefined; } T.on = false; T.mode = 'off'; show(false); if (G.audio.spoutRoar) G.audio.spoutRoar(false); }
  return { start, leap, step, clear, T, set stick(v) { T.stick = v; }, get on() { return T.on; }, get riding() { return T.on && (T.mode === 'rise' || T.mode === 'top'); }, near, far };
}
