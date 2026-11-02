// The trailer's camera, injected before the game. It moves only the camera (the game's own G.filmCam hook) and never a rule.
// Two shapes, both from the references: the hero holds the same place in frame from cut to cut (GMTK, "keep the focus point in generally the same place between cuts"),
// and a boss is filmed over his shoulder, low, with him and the boss in one frame (scale read against the man, not a boss alone).
(function () {
  'use strict';
  const R = window.__rig = {};
  const G = () => window.__game;
  const S = { first: true, cx: 0, cy: 0, cz: 0, lx: 0, ly: 0, lz: 0 };
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  // keep the lens on his side of the surface and out of the ground
  function fit(x, y, z, under) {
    const g = G(), W = g.world; let fy = y;
    const ground = W.heightAt(x, -z);
    if (Number.isFinite(ground)) fy = Math.max(fy, ground + 0.6);
    if (under) fy = Math.min(fy, -0.7); else if (fy < 0.8 && ground < 0) fy = Math.max(fy, 0.8);
    return fy;
  }
  // the lens never ends up inside a wall or a rock: swept from his chest the way the game's own arm is (hero.js clearArm), it stops short of whatever is between
  const from = { x: 0, y: 0, z: 0 }, to = { x: 0, y: 0, z: 0 };
  function clear(p, x, y, z) {
    const W = G().world; if (!W.sweep) return [x, y, z];
    from.x = p.x; from.y = -p.z; from.z = p.y + 0.6; to.x = x; to.y = -z; to.z = y;
    const hit = W.sweep(from, to, 0.45); if (!hit) return [x, y, z];
    const t = Math.max(0.12, hit.t - 0.04); return [p.x + (x - p.x) * t, p.y + 0.6 + (y - p.y - 0.6) * t, p.z + (z - p.z) * t];
  }
  R.clear = clear;
  function place(c, x, y, z, lx, ly, lz, fov, k, dt) {
    if (S.first || !(k > 0)) { S.cx = x; S.cy = y; S.cz = z; S.lx = lx; S.ly = ly; S.lz = lz; S.first = false; }
    else { S.cx = damp(S.cx, x, k, dt); S.cy = damp(S.cy, y, k, dt); S.cz = damp(S.cz, z, k, dt); S.lx = damp(S.lx, lx, k * 1.4, dt); S.ly = damp(S.ly, ly, k * 1.4, dt); S.lz = damp(S.lz, lz, k * 1.4, dt); }
    c.position.set(S.cx, S.cy, S.cz); c.up.set(0, 1, 0); if (fov) { c.fov = fov; c.updateProjectionMatrix(); } c.lookAt(S.lx, S.ly, S.lz); c.updateMatrixWorld();
  }
  // a camera set by his own frame: o.yaw() or the gameplay yaw gives "ahead"; ang turns the lens round him (0 = behind, PI = in front); dist, up, side; look = [ahead, up]
  R.hero = (o = {}) => {
    const g = G(); S.first = true;
    g.filmCam = (dt) => {
      const h = g.hero, p = h.drawPos || h.pos, c = g.camera;
      const yaw = typeof o.yaw === 'function' ? o.yaw() : (o.yaw ?? g.camYaw);
      const a = yaw + Math.PI + (typeof o.ang === 'function' ? o.ang() : (o.ang || 0));
      const d = o.dist || 6, up = o.up ?? 1.2, side = o.side || 0;
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
      let x = p.x + Math.sin(a) * d + rx * side, z = p.z + Math.cos(a) * d + rz * side;
      const under = o.under ?? (p.y < -0.6); let y = fit(x, p.y + up, z, under);
      if (o.clear !== false) [x, y, z] = clear(p, x, y, z);
      const L = o.look || [1.5, 0.6], at = o.at ? o.at() : null;
      if (at) place(c, x, y, z, p.x + (at.x - p.x) * (o.w ?? 0.35), p.y + L[1] + (at.y - p.y) * (o.w ?? 0.35), p.z + (at.z - p.z) * (o.w ?? 0.35), o.fov || 52, o.k ?? 6, dt);
      else place(c, x, y, z, p.x + fx * L[0], p.y + L[1], p.z + fz * L[0], o.fov || 52, o.k ?? 6, dt);
    };
  };
  // over his shoulder at a target (a boss's head, a foe): behind him on the line from it, a little to one side, low; looks between them, weighted to the target
  R.ots = (tgt, o = {}) => {
    const g = G(); S.first = true;
    g.filmCam = (dt) => {
      const h = g.hero, p = h.drawPos || h.pos, c = g.camera, t = typeof tgt === 'function' ? tgt() : tgt;
      if (!t) return;
      let dx = t.x - p.x, dz = t.z - p.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const rx = -dz, rz = dx, back = o.back || 5, side = o.side ?? 1.6, up = o.up ?? 0.5, w = o.w ?? 0.45;
      const x = p.x - dx * back + rx * side, z = p.z - dz * back + rz * side;
      const under = o.under ?? (p.y < -0.6); let y = fit(x, p.y + up, z, under), X = x, Z = z;
      if (o.clear !== false) [X, y, Z] = clear(p, x, y, z);
      const ly = p.y + (t.y - p.y) * w + (o.lookUp ?? 0.8);
      place(c, X, y, Z, p.x + (t.x - p.x) * w, ly, p.z + (t.z - p.z) * w, o.fov || 55, o.k ?? 5, dt);
    };
  };
  // a fixed lens that turns to keep him in frame (a tripod on the set)
  R.tripod = (x, y, z, o = {}) => {
    const g = G(); S.first = true;
    g.filmCam = (dt) => { const h = g.hero, p = h.drawPos || h.pos; place(g.camera, x, y, z, p.x + (o.dx || 0), p.y + (o.dy ?? 0.6), p.z + (o.dz || 0), o.fov || 50, o.k ?? 4, dt); };
  };
  R.yawTo = (t) => { const g = G(), h = g.hero; return Math.atan2(t.x - h.pos.x, t.z - h.pos.z); };
})();
