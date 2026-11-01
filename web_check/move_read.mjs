// Reads a move_film log: what the drawn body did, phase by phase. Nothing here passes or fails; it's the audit's instrument.
import fs from 'fs';
const [file] = process.argv.slice(2); const L = JSON.parse(fs.readFileSync(file));
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const phases = [...new Set(L.map((r) => r.n))];
for (const ph of phases) {
  const R = L.filter((r) => r.n === ph); if (R.length < 3) continue;
  let slip = 0, slipAt = 0, nPlant = 0, sumSlip = 0, hover = 0, under = 0, maxTurn = 0, maxJerkY = 0, maxHipA = 0;
  const G = (r, f, g) => r[f][1] - r[g] - 0.03;   // the ankle bone's height over the ground under it, less nothing: read as drawn
  for (let i = 1; i < R.length; i++) {
    const a = R[i - 1], b = R[i];
    for (const [f, t, g] of [['fR', 'tR', 'gR'], ['fL', 'tL', 'gL']]) {
      const low = Math.min(b[t][1] - b[g], b[f][1] - b[g]);
      hover = Math.max(hover, 0); under = Math.min(under, low);
      // "planted" as the eye would call it: the toe within 7 cm of the ground on both frames
      const lowA = a[t][1] - a[g], lowB = b[t][1] - b[g];
      if (lowA < 0.07 && lowB < 0.07) { const m = d(a[t], b[t]) * 100; nPlant++; sumSlip += m; if (m > slip) { slip = m; slipAt = b.t; } }
    }
    maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(b.hd - a.hd), Math.cos(b.hd - a.hd))) * 60 * 57.3);
    if (i > 1) { const c = R[i - 2]; maxHipA = Math.max(maxHipA, Math.abs(b.hips[1] - 2 * a.hips[1] + c.hips[1]) * 3600); }
  }
  const sp = R.map((r) => Math.hypot(r.v[0], r.v[2])), hipY = R.map((r) => r.hips[1] - r.gr), ankleY = R.flatMap((r) => [r.fR[1] - r.gR, r.fL[1] - r.gL]);
  const fmt = (x, n = 2) => (+x).toFixed(n);
  console.log(`${ph.padEnd(8)} n=${String(R.length).padStart(3)} speed ${fmt(sp[0])}→${fmt(sp[sp.length - 1])} (max ${fmt(Math.max(...sp))}) · toe on ground ${String(nPlant).padStart(3)} frames, slide mean ${fmt(nPlant ? sumSlip / nPlant : 0)} max ${fmt(slip)} cm/frame at ${fmt(slipAt)} s · lowest toe ${fmt(under * 100, 1)} cm · ankle ${fmt(Math.min(...ankleY), 3)}..${fmt(Math.max(...ankleY), 3)} · hips over ground ${fmt(Math.min(...hipY))}..${fmt(Math.max(...hipY))} · turn max ${fmt(maxTurn, 0)}°/s · hips ÿ max ${fmt(maxHipA, 0)} m/s²`);
}
