// The back of a beach (Randy, 2 Nov: "We need grass and sand for the beach too on the water side because there's no good transition"). A real beach goes in bands: wet sand at the waterline, a bare dry berm, then a foredune where grass comes in by clumps, thin at first and closing up, and then the green. Pipeline/research/BEACH_SOURCES.md.
// The ground's shader draws the bands. This sets the clumps: tufts where the ground has climbed out of the tide and the sea is still close, more of them the further up the beach.
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const NEAR = [[1, 0], [.7, .7], [0, 1], [-.7, .7], [-1, 0], [-.7, -.7], [0, -1], [.7, -.7]];
export function dressDunes({ data, heightAt, skip }) {
  const out = []; let s = 77317; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const [ox, oy] = data.origin, size = data.size_m;
  for (let i = 0; i < 26000 && out.length < 6 * 2100; i++) {
    const x = ox + rnd() * size, y = oy + rnd() * size, h = heightAt(x, y); if (h < 1.0 || h > 7 || (skip && skip(x, y))) continue;
    if (Math.abs(heightAt(x + 3, y) - h) + Math.abs(heightAt(x, y + 3) - h) > 1.6) continue;       // a flat or a dune's back, not a bank
    let sea = false; for (const [c, n] of NEAR) if (heightAt(x + c * 34, y + n * 34) < -0.3) { sea = true; break; } if (!sea) continue;
    if (rnd() > 0.25 + 0.75 * smooth(1.0, 3.2, h)) continue;
    const n = 3 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) { const a = rnd() * 6.283, d = rnd() * rnd() * 3.4, tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d, tz = heightAt(tx, ty); if (tz < 0.8) continue; out.push(tx, ty, tz - 0.04, rnd() * 6.283, 0.42 + rnd() * 0.42, rnd()); }
  }
  return out;
}
