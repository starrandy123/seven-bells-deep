// Where the surf breaks (Randy, 1 Nov: "we need waves too we can surf"). Real surf breaks on beaches whose bed deepens gently and steadily out to sea, so the
// breaks are found on the world's own seabed: from each island's middle, out to its shoreline, every 3 degrees; a beach qualifies when there's no rock in its
// first 45 m out, the bed deepens all the way, and it is 0.8-4.5 m deep 10 m out and 5-14 m at 45 m (what lies past that, a shelf or a drop, doesn't matter).
// A run of neighbouring beaches is one break, placed at its best angle, if it gives 40 m of shore or more; breaks closer than 110 m merge to the better one.
// Each break: where its waterline is (scene x, z), the way out to sea, half its width along the shore, how far out the swell builds (m), its height, its phase.
// The sea (sky.js) draws the waves from these and its CPU wave reads the same formula, so what the hero rides is the water you see.
export function findBreaks(data, heightAt, max = 6) {
  const islands = (data.poi || []).filter((p) => p.z > 0 && p.r >= 40), all = [];
  for (const isl of islands) {
    const cands = [];
    for (let a = 0; a < 360; a += 3) {
      const r = (a * Math.PI) / 180, dx = Math.cos(r), dy = Math.sin(r);
      let shore = null, wasLand = false;
      for (let s = 0; s < isl.r * 2.6; s += 2) { const z = heightAt(isl.x + dx * s, isl.y + dy * s); if (z > 0.3) wasLand = true; else if (wasLand && z < 0) { shore = s; break; } }
      if (shore === null) continue;
      const at = (m) => -heightAt(isl.x + dx * (shore + m), isl.y + dy * (shore + m)), D = [10, 20, 30, 45].map(at);
      let ok = D[0] > 0.8 && D[0] < 4.5 && D[3] > 5 && D[3] < 14;
      for (let i = 1; i < 4 && ok; i++) if (D[i] < D[i - 1] - 0.3) ok = false;
      for (let m = 2; m <= 45 && ok; m += 2) if (at(m) < 0.3) ok = false;
      if (ok) cands.push({ a, shore, dx, dy, score: -Math.abs(D[3] - 8) - Math.abs(D[0] - 2) });
    }
    const runs = [];
    for (const c of cands) { const last = runs[runs.length - 1]; if (last && c.a - last[last.length - 1].a <= 6) last.push(c); else runs.push([c]); }
    for (const run of runs) {
      const best = run.reduce((p, q) => (q.score > p.score ? q : p)), arc = ((run[run.length - 1].a - run[0].a + 3) * Math.PI / 180) * best.shore;
      if (arc < 40) continue;
      const x = isl.x + best.dx * best.shore, y = isl.y + best.dy * best.shore;
      all.push({ x, y, dx: best.dx, dy: best.dy, half: Math.min(70, Math.max(30, arc * 0.6)), score: best.score + arc * 0.02, isl: isl.id });
    }
  }
  all.sort((p, q) => q.score - p.score);
  const keep = [];
  for (const b of all) if (keep.every((k) => Math.hypot(k.x - b.x, k.y - b.y) > 110)) keep.push(b);
  // scene coordinates (x, z = -y): the waterline, the way out to sea; the swell builds over the last 75 m; 1.15 m swell at 10 m deep; each break its own phase
  return keep.slice(0, max).map((b, i) => ({ x: b.x, z: -b.y, ox: b.dx, oz: -b.dy, half: b.half, band: 75, amp: 1.15, phase: i * 2.17 + 0.6, isl: b.isl }));
}

// The breaker, as the CPU reads it (the GLSL in sky.js is the same formula, line for line). p: scene x, z; depth: metres of water there (positive); t: the sea's
// clock. Returns the height it adds, and fills `out` (when given) with the foam (0-1), the shoreward speed of the wave and how much of a face is here (0-1).
export const BREAK_K = (2 * Math.PI) / 36, BREAK_W = 6.0 * BREAK_K;      // a 36 m wavelength travelling shoreward at 6 m/s (a 6 s period)
export function breakerAt(B, x, z, depth, t, out) {
  let y = 0, foam = 0, face = 0, cx = 0, cz = 0;
  for (const b of B) {
    const rx = x - b.x, rz = z - b.z, o = rx * b.ox + rz * b.oz, l = -rx * b.oz + rz * b.ox;
    if (o < -4 || o > b.band + 10 || Math.abs(l) > b.half + 14) continue;
    const eL = 1 - smooth(b.half - 18, b.half + 12, Math.abs(l)), eO = smooth(b.band + 8, b.band - 22, o) * smooth(-3, 6, o), e = eL * eO;
    if (e <= 0) continue;
    const h = Math.max(depth, 0.4), set = 0.42 + 0.58 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.1745 + b.phase), 2);
    const ash = b.amp * set * Math.pow(10 / Math.max(h, 1.2), 0.25), A = Math.min(ash, 0.39 * h), sig = Math.min(ash / Math.max(0.39 * h, 1e-3), 1.4), s1 = Math.min(sig, 1);
    const phi = BREAK_K * o + BREAK_W * t + b.phase * 7, g = phi - 0.7 * s1 * (1 - Math.cos(phi)), f = Math.pow(0.5 + 0.5 * Math.cos(g), 1 + 2 * s1);
    y += e * A * (2 * f - 0.8);
    foam += e * smooth(0.82, 1.05, sig) * smooth(0.35, 0.8, f);
    // a face: the shoreward slope ahead of a crest (sin(g) < 0 is the shoreward side of it), as tall as the wave is here
    const fw = e * Math.max(0, -Math.sin(g)) * smooth(0.3, 0.9, A);
    if (fw > face) { face = fw; cx = -b.ox * (BREAK_W / BREAK_K); cz = -b.oz * (BREAK_W / BREAK_K); }
  }
  if (out) { out.foam = Math.min(1, foam); out.face = Math.min(1, face); out.cx = cx; out.cz = cz; }
  return y;
}
function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
