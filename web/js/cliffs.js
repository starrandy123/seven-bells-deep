// The land's rock (Randy, 1 Nov: "Look at the mountain edges and the environment! This does not look AAA! It looks very paper cut and not natural"). A height field can't make a
// cliff: a face is a smooth sheet, and grass ends on it in a razor line. What shipped open worlds do is keep the field as the base and place rock meshes over it by rules on slope and
// height, each kind on its own layer (van Muijden, GPU-Based Run-Time Procedural Placement in Horizon: Zero Dawn, GDC 2017, is the public account of placing by rule). So three layers,
// read off the carved ground, seeded, in world.json's own instance form:
//   · the face: crags set into every slope too steep to hold soil, big ones first, leaning with the slope, half buried, so the skyline and the wall both break up;
//   · the crest: small rock, ferns and bushes on the lip, so grass doesn't meet the drop in a line;
//   · the foot: the boulders and scree that fall off any real cliff, with bushes among them, so the wall doesn't meet the grass in a line.
// Blender coordinates throughout. A yaw of 100 or more marks a rock that leans with the ground (world.js).
export const LEAN = 100;
import * as THREE from 'three';
// The kit: a slab of cliff, a row of broken rock columns standing shoulder to shoulder, each a five-sided prism with its own height and depth, cracked apart from its neighbours, stepping
// back as it rises and capped with a top that slopes into the hill. Flat shaded and angular on purpose: round boulders on a slope read as potatoes (the first try, 1 Nov), and one
// bent sheet reads as paper (the second). Made here from code, so it weighs nothing to download. 7 m wide, 10 m tall, its face toward +z, its foot at the origin, buried below it.
export function slabGeometry(seed) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const W = 7, H = 10, pos = [], col = [];
  const tri = (a, b, c, t) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(.118 * t, .112 * t, .104 * t); };
  const quad = (a, b, c, d, t) => { tri(a, b, d, t); tri(a, d, c, t); };
  for (let x = -W / 2; x < W / 2 - .4;) {
    const w = .95 + rnd() * .95, cx = x + w / 2, h = H * (.6 + rnd() * .4) * (1 - .34 * Math.pow(Math.abs(cx) / (W / 2), 2)), d0 = .3 + rnd() * 1.5, step = .3 + rnd() * .5, t0 = .84 + rnd() * .34;
    x += w + .04 + rnd() * .12;
    const levels = [-8, h * (.3 + rnd() * .1), h * (.62 + rnd() * .12), h], rows = [];
    levels.forEach((y, l) => {
      const back = d0 - step * Math.max(0, l - 1) - l * .12, j = () => (rnd() - .5) * .3, hw = w * .5 * (l === 3 ? .86 : 1), lean = (rnd() - .5) * .18 * l;
      rows.push([[cx - hw + lean, y + j() * (l ? 1 : 0), -2.4], [cx - hw * .82 + j() + lean, y + j(), back * .72 + j()], [cx + (rnd() - .5) * w * .3 + lean, y + j(), back + .22], [cx + hw * .82 + j() + lean, y + j(), back * .72 + j()], [cx + hw + lean, y + j() * (l ? 1 : 0), -2.4]]);
    });
    for (let l = 0; l < 3; l++) for (let k = 0; k < 4; k++) quad(rows[l][k], rows[l][k + 1], rows[l + 1][k], rows[l + 1][k + 1], t0 * (.9 + rnd() * .24) * (k === 0 || k === 3 ? .8 : 1));
    const top = rows[3], peak = [cx, h + .1 + rnd() * .35, -1.6];
    for (let k = 0; k < 4; k++) tri(top[k], top[k + 1], peak, t0 * (.9 + rnd() * .2));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
const FACE = 1.15, FACE2 = 1.0, TOPS = 0.7, DROP = 1.0;     // ours: the slopes a big slab and a small one stand on (49° and 45°: gentler ground holds soil), the most a crest or a foot may tilt, how steep the drop beside it has to be
const SCAN = 3, LOOK = 4;                                    // ours: metres between candidates, and how far a crest or a foot looks for its drop
const CELL = 6, STRIDE = 7, CAP = 90000;

export function dressCliffs({ data, heightAt, waterAt, solids, skip }) {
  const add = { slab_a: [], slab_b: [], slab_c: [], beach_rock: [], bush: [], fern: [], grass_tuft: [] }, colliders = [];
  let s = 51829; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const [ox, oy] = data.origin, size = data.size_m;
  // the near solids: a rock never grows into a wall, a stair or a house
  const near = new Map(), SK = 12, hk = (x, y) => Math.floor(x / SK) * 100003 + Math.floor(y / SK);
  for (let i = 0; i < solids.length; i++) {
    const c = solids[i]; if (c.z1 < .5) continue;
    const r = c.t === 'cyl' ? c.r : Math.hypot(c.hx, c.hy);
    if (r > 40) continue;
    for (let a = Math.floor((c.x - r) / SK); a <= Math.floor((c.x + r) / SK); a++) for (let b = Math.floor((c.y - r) / SK); b <= Math.floor((c.y + r) / SK); b++) { const k = a * 100003 + b; let l = near.get(k); if (!l) near.set(k, l = []); l.push(c.x, c.y, r); }
  }
  const clearOf = (x, y, r) => { const l = near.get(hk(x, y)); if (l) for (let i = 0; i < l.length; i += 3) if (Math.hypot(x - l[i], y - l[i + 1]) < l[i + 2] + r) return false; return true; };
  const wet = (x, y, r) => waterAt(x, y) || waterAt(x + r, y) || waterAt(x - r, y) || waterAt(x, y + r) || waterAt(x, y - r);
  // the land, as candidates: x, y, z, slope, the way up. A typed list: this runs at load, on a phone, in the one second memory peaks
  const P = new Float32Array(CAP * STRIDE); let n = 0;
  for (let cx = ox + 12; cx < ox + size - 12; cx += 24) for (let cy = oy + 12; cy < oy + size - 12; cy += 24) {
    if (Math.max(heightAt(cx, cy), heightAt(cx - 10, cy - 10), heightAt(cx + 10, cy - 10), heightAt(cx - 10, cy + 10), heightAt(cx + 10, cy + 10)) < .6) continue;
    for (let x = cx - 12; x < cx + 12; x += SCAN) for (let y = cy - 12; y < cy + 12; y += SCAN) {
      const px = x + rnd() * SCAN, py = y + rnd() * SCAN, z = heightAt(px, py); if (z < .7 || n >= CAP) continue;
      const gx = (heightAt(px + 1.5, py) - heightAt(px - 1.5, py)) / 3, gy = (heightAt(px, py + 1.5) - heightAt(px, py - 1.5)) / 3, sl = Math.hypot(gx, gy);
      if (skip && skip(px, py)) continue;
      const o = n++ * STRIDE; P[o] = px; P[o + 1] = py; P[o + 2] = z; P[o + 3] = sl; P[o + 4] = sl > .001 ? gx / sl : 1; P[o + 5] = sl > .001 ? gy / sl : 0;
    }
  }
  const order = (j) => ((j * 7919) % n) * STRIDE;              // a fixed walk through the list, not the scan's rows (7919 is prime, so every candidate comes up once)
  const taken = new Map(), tk = (x, y) => Math.floor(x / CELL) * 100003 + Math.floor(y / CELL);
  const room = (x, y, r, k) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = taken.get(tk(x + a * CELL, y + b * CELL)); if (l) for (let i = 0; i < l.length; i += 3) if (Math.hypot(x - l[i], y - l[i + 1]) < (r + l[i + 2]) * k) return false; } return true; };
  const hold = (x, y, r) => { const q = tk(x, y); let l = taken.get(q); if (!l) taken.set(q, l = []); l.push(x, y, r); };
  const SLABS = ['slab_a', 'slab_b', 'slab_c'];
  // how much face stands above a point: up the slope until it eases
  const faceAbove = (x, y, z, ux, uy) => { let t = 0, zz = z; for (let d = 2; d <= 26; d += 2) { const q = heightAt(x + ux * d, y + uy * d); if ((q - zz) / 2 < .6) break; zz = q; t = q - z; } return t; };
  // the face: slabs overlapped into one wall, big ones first, then what fits in the gaps. Each stands in the slope and stops about at the crest
  for (const [lo, hi, k, least] of [[1.0, 1.5, .62, FACE], [.6, .95, .58, FACE2]]) {
    for (let j = 0; j < n; j++) {
      const o = order(j); if (P[o + 3] < least) continue;
      const x = P[o], y = P[o + 1], z = P[o + 2], t = faceAbove(x, y, z, P[o + 4], P[o + 5]), sc = Math.min(lo + rnd() * (hi - lo), (t + 2.4) / 8.6), r = 3.1 * sc;
      if (sc < .34 || t < 3.5 || !room(x, y, r, k) || !clearOf(x, y, r) || wet(x, y, r * .8)) continue;
      hold(x, y, r); add[SLABS[Math.floor(rnd() * 3)]].push(x, y, z - .9 * sc, LEAN + (rnd() - .5) * .5, sc, rnd());
      colliders.push({ t: 'cyl', x, y, r: r * .55, z0: z - 3, z1: z + 6 * sc });
    }
  }
  // the crest and the foot: what lies just down the slope and just up it. A crest is flat with a drop in front, a foot flat with a wall behind
  for (let j = 0; j < n; j++) {
    const o = order(j); if (P[o + 3] > TOPS) continue;
    const x = P[o], y = P[o + 1], z = P[o + 2], ux = P[o + 4], uy = P[o + 5], drop = (z - heightAt(x - ux * LOOK, y - uy * LOOK)) / LOOK, rise = (heightAt(x + ux * LOOK, y + uy * LOOK) - z) / LOOK;
    if (drop > DROP) {
      const q = rnd();
      if (q < .44) { if (room(x, y, 1.1, .9) && clearOf(x, y, 1) && !wet(x, y, 1)) { hold(x, y, 1.1); add.fern.push(x, y, z, rnd() * 6.283, 1 + rnd() * .8, rnd()); } }
      else if (q < .6) { if (room(x, y, 2, .9) && clearOf(x, y, 1.5) && !wet(x, y, 1.5)) { hold(x, y, 2); add.bush.push(x, y, z, rnd() * 6.283, .7 + rnd() * .6, rnd()); } }
      else if (room(x, y, .8, .9) && !wet(x, y, 1)) { hold(x, y, .8); add.grass_tuft.push(x, y, z, rnd() * 6.283, .9 + rnd() * .8, rnd()); }
    } else if (rise > DROP) {
      const q = rnd();
      if (q < .5) {
        const sc = .12 + rnd() * rnd() * .3, r = 2.4 * sc;
        if (room(x, y, r, .8) && clearOf(x, y, r + .5) && !wet(x, y, r + .4)) { hold(x, y, r); add.beach_rock.push(x, y, z - .35 * sc, LEAN + rnd() * 6.283, sc, rnd()); if (r > .6) colliders.push({ t: 'cyl', x, y, r: r * .7, z0: z - 1, z1: z + sc }); }
      } else if (q < .68) { if (room(x, y, 2, .9) && clearOf(x, y, 1.5) && !wet(x, y, 1.5)) { hold(x, y, 2); add.bush.push(x, y, z, rnd() * 6.283, .8 + rnd() * .7, rnd()); } }
      else if (q < .86) { if (room(x, y, 1, .9) && clearOf(x, y, 1) && !wet(x, y, 1)) { hold(x, y, 1); add.fern.push(x, y, z, rnd() * 6.283, .9 + rnd() * .6, rnd()); } }
    }
  }
  return { add, colliders, counts: Object.fromEntries(Object.entries(add).map(([k, v]) => [k, v.length / 6])), candidates: n };
}
