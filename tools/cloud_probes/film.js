// Runs in the page before the game. The film's camera and hands: nothing here changes a rule. The hands press the game's own input, the camera is the game's own G.filmCam hook.
(function () {
  'use strict';
  const F = window.__film = {};
  const G = () => window.__game;
  const cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const ease = (t) => t * t * (3 - 2 * t);
  // a key: { t, p: [x, y, z] in Blender metres, at: [x, y, z], fov }. Catmull-Rom through the keys
  F.sample = (K, t) => {
    if (t <= K[0].t) return K[0]; if (t >= K[K.length - 1].t) return K[K.length - 1];
    let i = 0; while (i < K.length - 2 && t > K[i + 1].t) i++;
    const a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(K.length - 1, i + 2)], u = (t - b.t) / (c.t - b.t);
    const mix = (key) => [0, 1, 2].map((n) => cr(a[key][n], b[key][n], c[key][n], d[key][n], u));
    return { p: mix('p'), at: mix('at'), fov: (b.fov || 50) + ((c.fov || 50) - (b.fov || 50)) * u };
  };
  F.path = (keys, opts = {}) => {
    const g = G(); let t = 0;
    g.filmCam = (dt) => {
      t += dt; const s = F.sample(keys, t), c = g.camera, h = g.hero;
      c.position.set(s.p[0], s.p[2], -s.p[1]); c.up.set(0, 1, 0); c.fov = s.fov || keys[0].fov || 50; c.updateProjectionMatrix(); c.lookAt(s.at[0], s.at[2], -s.at[1]); c.updateMatrixWorld();
      if (opts.hideHero) { h.pos.set(s.p[0], s.p[2], -s.p[1]); h.prev.copy(h.pos); h.drawPos.copy(h.pos); h.vel.set(0, 0, 0); if (h.root) h.root.visible = false; }
    };
    return (dt) => g.filmCam(dt);
  };
  // the world with nobody in it: the hero stays with the camera, unseen, so the world streams round the lens, and no fight or mission starts
  F.quiet = () => { const g = G(); g.quest.step = () => {}; if (g.enemies && g.enemies.alive) for (const e of g.enemies.alive()) e.hidden = true; };
  F.eg = (x, y) => G().world.heightAt(x, y);
})();
