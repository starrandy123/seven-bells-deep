// Runs in the page before the game: the checks' own helpers, on window.__qa. It never changes the game until a wall asks: the game's own rules run,
// fed through the game's own input (ui.sample), read from the game's own state. All positions in Blender metres unless a name says three.
(function () {
  'use strict';
  const Q = window.__qa = {};
  const G = () => window.__game;
  Q.start = () => { const g = G(); const t = document.getElementById('title'); if (t) t.classList.remove('on'); const h = document.getElementById('hud'); if (h) h.classList.add('on'); g.started = g.playing = true; };
  // the same input a player gives, through the page's own sample: wish = { my, mx, ud, boost, jump, atk, ... }; one-shots are cleared by whoever consumes them
  Q.drive = (wish) => {
    const g = G();
    if (!Q._wrapped) { const s = g.ui.sample; Q._wrapped = true; g.ui.sample = (...a) => { const v = s(...a); const w = Q._wish; if (w) { for (const k in w) v[k] = w[k]; for (const k of ['jump', 'atk', 'dash', 'spin', 'wave', 'p4', 'stance', 'parry', 'call', 'ride']) if (w[k]) w[k] = false; } return v; }; }
    Q._wish = wish;
  };
  Q.aim = (dx, dy, dz) => { const g = G(), l = Math.hypot(dx, dy, dz) || 1; g.camYaw = Math.atan2(dx, -dy); g.camPitch = Math.asin(dz / l); };
  Q.place = (x, y, z) => { const h = G().hero; h.pos.set(x, z, -y); h.prev.copy(h.pos); if (h.drawPos) h.drawPos.copy(h.pos); };
  Q.where = () => { const p = G().hero.pos; return { x: p.x, y: -p.z, z: p.y }; };
  // a hero with nothing else going on: no hurt, no ride, no fight, full tanks
  Q.calm = () => { const h = G().hero; Object.assign(h, { dead: false, ride: null, atk: null, next: null, stun: 0, inv: 1e6, hp: h.maxHp, boostFuel: 1, boostOut: false, plunge: false }); h.state = 'swim'; };
  Q.swimAt = (x, y, z, vx = 0, vy = 0, vz = 0, surge = 0) => { const h = G().hero; Q.calm(); Q.place(x, y, z); h.land = false; h.air = false; h.grounded = false; h.surge = surge; h.boostHeld = surge > 0 ? 2 : 0; h.vel.set(vx, vz, -vy); };
  Q.walkAt = (x, y, vx = 0, vy = 0, surge = 0, stand = 0.92) => { const g = G(), h = g.hero, z = g.world.heightAt(x, y) + stand; Q.calm(); Q.place(x, y, z); h.land = true; h.air = false; h.grounded = true; h.surge = surge; h.boostHeld = surge > 0 ? 2 : 0; h.vel.set(vx, 0, -vy); };
  Q.leapAt = (x, y, z, vx, vy, vz) => { const h = G().hero; Q.calm(); Q.place(x, y, z); h.land = false; h.air = true; h.grounded = false; h.surge = 0; h.boostHeld = 0; h.vel.set(vx, vz, -vy); };
  // signed distance from a point to a solid: negative inside. A plain copy of the shapes in the world's file, not the world's own collide: it judges that.
  Q.sd = (c, x, y, z) => {
    if (c.t === 'cyl') { const dr = Math.hypot(x - c.x, y - c.y) - c.r, dz = Math.max(c.z0 - z, z - c.z1); return dr > 0 && dz > 0 ? Math.hypot(dr, dz) : Math.max(dr, dz); }
    const y0 = c.yaw || 0, cs = Math.cos(y0), sn = Math.sin(y0), dx = x - c.x, dy = y - c.y, lx = Math.abs(dx * cs + dy * sn) - c.hx, ly = Math.abs(-dx * sn + dy * cs) - c.hy, lz = Math.max(c.z0 - z, z - c.z1);
    const ox = Math.max(lx, 0), oy = Math.max(ly, 0), oz = Math.max(lz, 0), o = Math.hypot(ox, oy, oz); return o > 0 ? o : Math.max(lx, ly, lz);
  };
  Q.rad = (c) => (c.t === 'cyl' ? c.r : Math.hypot(c.hx, c.hy));
  // a hash of the solids, for walls that look many points up
  Q.hash = (cols, cell = 16) => {
    const m = new Map();
    cols.forEach((c, i) => { const r = Q.rad(c) + 2, x0 = Math.floor((c.x - r) / cell), x1 = Math.floor((c.x + r) / cell), y0 = Math.floor((c.y - r) / cell), y1 = Math.floor((c.y + r) / cell); for (let a = x0; a <= x1; a++) for (let b = y0; b <= y1; b++) { const k = a * 100003 + b; let l = m.get(k); if (!l) m.set(k, l = []); l.push(i); } });
    return { near: (x, y) => m.get(Math.floor(x / cell) * 100003 + Math.floor(y / cell)) || [] };
  };
  // the nearest solid to a point, signed
  Q.nearest = (H, cols, x, y, z) => { let best = 1e9, who = -1; for (const i of H.near(x, y)) { const c = cols[i]; if (c.off) continue; const d = Q.sd(c, x, y, z); if (d < best) { best = d; who = i; } } return { d: best, i: who }; };
  // the page's frames, as a list of times: Q.frames(n).then(...)
  Q.frames = (n) => new Promise((done) => { const t = []; let last = performance.now(); const f = (now) => { t.push(now - last); last = now; if (t.length < n) requestAnimationFrame(f); else done(t); }; requestAnimationFrame(f); });
  // open water: a stretch of sea with nothing near a straight line, for walls that need a clean run. Seeded by its arguments, so it's the same place each time.
  Q.openWater = (len = 60, depth = 18) => {
    const g = G(), W = g.world, d = W.data, C = d.colliders, H = Q.hash(C, 16), S = d.size_m, ox = d.origin[0], oy = d.origin[1];
    for (let k = 0; k < 4000; k++) {
      const x = ox + S * (0.08 + 0.84 * (((k * 0.61803398875) % 1))), y = oy + S * (0.08 + 0.84 * (((k * 0.7548776662) % 1))), a = ((k * 0.5698402910) % 1) * 6.283, ax = Math.cos(a), ay = Math.sin(a), z = -depth;
      let good = true;
      for (let t = -6; t <= len + 6 && good; t += 3) { const px = x + ax * t, py = y + ay * t; if (W.heightAt(px, py) > z - 3 || Q.nearest(H, C, px, py, z).d < 4) good = false; }
      if (good) return { x, y, z, ax, ay };
    }
    return null;
  };
  // hold the page's frames, as a hidden tab does; let them go, and whatever was waiting runs
  (function () { const raf0 = window.requestAnimationFrame.bind(window); Q.held = null; window.requestAnimationFrame = (cb) => { if (Q.held) { Q.held.push(cb); return 0; } return raf0(cb); }; Q.holdFrames = () => { Q.held = []; }; Q.freeFrames = () => { const l = Q.held || []; Q.held = null; for (const cb of l) raf0(cb); }; })();
  // is something drawn? a grid across the picture, read right after a draw: lit cells and distinct colours (a cleared frame has one)
  Q.pixels = (n = 7) => { const g = G(); g.look.render(); const gl = g.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4), seen = new Set(); let lit = 0; for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) { gl.readPixels(Math.floor((w * i) / (n + 1)), Math.floor((h * j) / (n + 1)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (px[0] + px[1] + px[2] > 30) lit++; seen.add((px[0] >> 3) + ',' + (px[1] >> 3) + ',' + (px[2] >> 3)); } return { lit, distinct: seen.size, of: n * n, w, h }; };
  Q.vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  Q.opaque = (e) => { let o = 1; for (let n = e; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
  Q.showAll = () => document.querySelectorAll('.btn').forEach((b) => b.classList.add('show'));
  // every element with its own text, visible now
  Q.texts = (root = document.body) => { const out = []; for (const el of [root, ...root.querySelectorAll('*')]) { const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(); if (!own || !Q.vis(el) || Q.opaque(el) < 0.05) continue; const r = el.getBoundingClientRect(); if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue; const cs = getComputedStyle(el); out.push({ el: el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''), text: own.slice(0, 40), size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400 }); } return out; };
  // what a wall says it found, kept for the node side
  Q.keep = {};
  // every AudioContext the page makes, and each resume with the event it ran in
  (function () {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; Q.audio = [];
    const Wrapped = function (...a) { const c = new AC(...a); const rec = { ctx: c, resumes: [] }; Q.audio.push(rec); const r = c.resume.bind(c); c.resume = () => { rec.resumes.push(window.event ? window.event.type : 'no event'); return r(); }; return c; };
    Wrapped.prototype = AC.prototype; window.AudioContext = Wrapped; if (window.webkitAudioContext) window.webkitAudioContext = Wrapped;
  })();
})();
