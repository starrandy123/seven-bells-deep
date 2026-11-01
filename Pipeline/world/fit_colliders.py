# Drowned City: every hard piece's collision, made from its own drawn shape and measured the way the game's wall measures it. W14, A1, A2.
#   python fit_colliders.py [name,name,...] [--world path/to/world.json]     numpy and OpenCV only: no Blender.  Writes out/col_fit.json, one entry a piece.
# The shape: the mesh in voxels, with every gap too narrow for his body closed (a window, the joints of a wall, the inside of a sealed hull), then swept from the foot up, each level's footprint
# covered by circles and rectangles that go on upward until they would stand out from the shape. So a collider stands a little proud of what is drawn and never far from it, which answers both of the wall's questions:
#   A1v: every drawn point is inside a collider or within 0.32 m of one.  A2: a collider's open side is within 0.6 m of something drawn.  Measured here at the scale the piece is really placed at, before it ships.
# Openings come from the same voxels: a hole in the piece's silhouette, looking along x or along y, big enough for him, is a way through. Each is published with the solid beside it, for its control.
import json
import math
import os
import re
import sys
import time

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from meshkit import Mesh, _sample_surface

CACHE = os.path.join(HERE, 'out', 'cache')
OUTP = os.path.join(HERE, 'out', 'col_fit.json')
RAW = os.path.join(HERE, 'out', 'cache_raw')                            # the natural pieces as generated, before they are drawn in to their colliders
# the wall's own lists (web_check/drawn.mjs): what is swum through on purpose, and what is hard only at its trunk
SOFT = re.compile(r'^(seagrass|kelp_stalk|grass_tuft|grass|fern|bush|flower|wildflower|reed|anemone|coral_fan|coral_branch|coral_tube|glow_coral)')
TREE = re.compile(r'^(palm|oak|tree)')
SKIP = {'arena_gate', 'arena_floor', 'lava_crack', 'ice_ceiling', 'stair_crown', 'snow_pine', 'iceberg', 'iceberg_great', 'islet'}    # the gate is the world's; the floor and the cracks are ground; the ceiling is one slab of the sheet's own numbers
NATURAL = re.compile(r'^(rock_|sea_arch|islet|cliff_rock|beach_rock|kelp_spire|iceberg|ice_pillar|ice_floe|coral_|smoker|wreck_(hull|bow|stern|stand))')
FAR_LIM = [0.6]                   # the wall's limit for this piece: 0.6 m for what is built, 1.5 m for a big natural shape, where a prism can't hug and a swimmer can't tell
AIRK = {'bridge_span', 'roof_slab', 'boat_fishing', 'ice_floe', 'quay', 'lamp_brazier', 'statue_head', 'statue_torso'}     # their origin isn't the ground: nothing of them is forgiven for being low
AIR_NOW = [False]
HOLLOW = re.compile(r'^wreck_')                                         # ribs and decks inside the sealed solid: pulled in, never pushed out through the planks
BODY = 0.62                       # his collision sphere when he swims
THIN = 0.2                        # no solid's half thickness under this: at 48 m/s he moves 0.8 m a step
MAX_OUT, MAX_IN = 0.46, 0.26      # how far a collider may stand proud of the shape, how far short of it, at full tolerance, metres as placed
MAX_ROUGH = 0.74                  # a step up a rough slope stands proud at its top and flush at its foot: the wall lets a quarter of a side pass 0.6 m, so natural rock may step this high
# a piece hollow to a body but not meant to be entered: the gap closed is wider than the body
SEAL = {'wreck_stand': 3.6, 'wreck_hull': 3.0, 'wreck_bow': 3.0, 'wreck_stern': 3.0, 'cottage_a': 1.4, 'cottage_b': 1.4, 'pier_house': 1.4, 'boat_fishing': 1.0, 'dome_hall': 2.6, 'tower': 1.6, 'tower_cold': 1.6, 'lighthouse': 1.6, 'ice_tower': 1.6}
# a door into a room you can see into but not through: found by hand, because no silhouette has a hole in it (x, y, z, half length along the way in, side step to solid)
BLIND = {'forge_hall': [{'x': 0.0, 'y': -14.0, 'z': 5.0, 'dx': 0.0, 'dy': 5.5, 'sx': 14.0, 'sy': 0.0}]}


def dilate3(a, r):
    """Cube dilation, r cells each way, in cumulative sums."""
    if r <= 0:
        return a.copy()
    out = a
    for ax in range(3):
        c = np.cumsum(out.astype(np.int32), axis=ax)
        pad = [(0, 0)] * 3
        pad[ax] = (r + 1, r)
        c = np.pad(c, pad, mode='edge')
        lo = [slice(None)] * 3
        hi = [slice(None)] * 3
        n = out.shape[ax]
        lo[ax] = slice(0, n)
        hi[ax] = slice(2 * r + 1, 2 * r + 1 + n)
        low = c[tuple(lo)].copy()
        sl = [slice(None)] * 3
        sl[ax] = slice(0, r + 1)
        low[tuple(sl)] = 0
        out = (c[tuple(hi)] - low) > 0
    return out


def outside(free):
    """What of the free cells a flood from the box's faces reaches: sweeps up and down the slices, each slice's reach by its connected regions."""
    ext = np.zeros(free.shape, dtype=bool)
    ext[0, :, :] = ext[-1, :, :] = True
    ext[:, 0, :] = ext[:, -1, :] = True
    ext[:, :, 0] = ext[:, :, -1] = True
    ext &= free
    nz = free.shape[2]
    last = -1
    for sweep in range(12):
        for order in (range(nz), range(nz - 1, -1, -1)):
            prev = None
            for k in order:
                if prev is not None:
                    ext[:, :, k] |= ext[:, :, prev] & free[:, :, k]
                if ext[:, :, k].any():
                    c, lab = cv2.connectedComponents(free[:, :, k].astype(np.uint8), connectivity=4)
                    tab = np.zeros(c, dtype=bool)
                    tab[np.unique(lab[ext[:, :, k]])] = True
                    tab[0] = False
                    ext[:, :, k] = tab[lab]
                prev = k
        cnt = int(ext.sum())
        if cnt == last:
            break
        last = cnt
    return ext


def solid_of(m, h, seal):
    """Occupancy of the drawn surface, and the solid: closed by `seal` metres (of the piece) then flooded from outside."""
    lo, hi = m.V.min(axis=0), m.V.max(axis=0)
    r = max(int(math.ceil(seal / h)), 1)
    pad = (r + 2) * h
    o = lo - pad
    n = np.ceil((hi - lo + 2.0 * pad) / h).astype(int) + 1
    ijk = np.clip(np.floor((_sample_surface(m, h) - o) / h).astype(int), 0, n - 1)
    occ = np.zeros(n, dtype=bool)
    occ[ijk[:, 0], ijk[:, 1], ijk[:, 2]] = True
    ext = outside(~dilate3(occ, r))
    return ~dilate3(ext, r), occ, o


def grow_rect(i, j, I, order):
    """A rectangle from a cell, one side at a time, for as long as it holds nothing blocked. I: integral of what is blocked."""
    b = [i, i + 1, j, j + 1]
    nx, ny = I.shape[0] - 1, I.shape[1] - 1

    def clear(a0, a1, c0, c1):
        return I[a1, c1] - I[a0, c1] - I[a1, c0] + I[a0, c0] == 0

    moved = True
    while moved:
        moved = False
        for side in order:
            if side == 0 and b[0] > 0 and clear(b[0] - 1, b[0], b[2], b[3]):
                b[0] -= 1
                moved = True
            elif side == 1 and b[1] < nx and clear(b[1], b[1] + 1, b[2], b[3]):
                b[1] += 1
                moved = True
            elif side == 2 and b[2] > 0 and clear(b[0], b[1], b[2] - 1, b[2]):
                b[2] -= 1
                moved = True
            elif side == 3 and b[3] < ny and clear(b[0], b[1], b[3], b[3] + 1):
                b[3] += 1
                moved = True
    return b


def prim_mask(p, shape):
    a = np.zeros(shape, dtype=np.uint8)
    if p['t'] == 'cyl':
        cv2.circle(a, (int(round(p['j'])), int(round(p['i']))), int(round(p['r'])), 1, -1)
    else:
        a[p['b'][0]:p['b'][1], p['b'][2]:p['b'][3]] = 1
    return a


def candidates(i, j, r, F, blocked_I, tol_out, rmin):
    c = {'t': 'cyl', 'i': float(i), 'j': float(j), 'r': max(r + 0.25 * tol_out, rmin)}
    c['mask'] = prim_mask(c, F.shape)
    out = [c]
    for order in ((0, 1, 2, 3), (2, 3, 0, 1)):
        q = {'t': 'box', 'b': grow_rect(i, j, blocked_I, order)}
        q['mask'] = prim_mask(q, F.shape)
        out.append(q)
    return out


def make_bands(S, t, middle=False):
    """Slices grouped while each stays within the tolerance of the band's outline (so a thin brace crossing the band ends it, and is never drawn out into a wall). The outline is the union of its slices: nothing drawn is left out."""
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * t + 1, 2 * t + 1))
    ks = [k for k in range(S.shape[2]) if S[:, :, k].any()]
    out = []
    if not ks:
        return out
    k0, prev = ks[0], ks[0]
    OR = S[:, :, k0].astype(np.uint8)
    grown = [cv2.dilate(OR, ker)]
    for k in ks[1:]:
        F = S[:, :, k].astype(np.uint8)
        G = cv2.dilate(F, ker)
        o2 = OR | F
        if k != prev + 1 or any((o2 & (1 - g)).any() for g in grown + [G]):
            out.append((k0, prev + 1, S[:, :, (k0 + prev) // 2].astype(np.uint8) if middle else OR))
            k0, OR = k, F.copy()
            grown = [G]
        else:
            OR = o2
            grown.append(G)
        prev = k
    out.append((k0, prev + 1, S[:, :, (k0 + prev) // 2].astype(np.uint8) if middle else OR))
    return out


def edge_of(mask):
    return mask - cv2.erode(mask, np.ones((3, 3), np.uint8))


def sweep(S, tol_out, tol_in, rmin, middle=False):
    """Band by band from the foot up. What stands goes on upward while its outline still hugs the shape; what is bare gets a new primitive, the one that takes in most of it."""
    t = max(int(round(tol_out)), 1)
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * t + 1, 2 * t + 1))
    active, done = [], []
    small = max((1.6 * tol_in) ** 2, 6.0)
    last = None
    for k0, k1, F in make_bands(S, t, middle):                           # rough rock: a band takes its middle slice, so a side stands proud at its top and short at its foot by half as much
        if last is not None and k0 != last:                              # a gap in height: nothing carries across it
            for p in active:
                p['k1'] = last
                done.append(p)
            active = []
        last = k1
        G = cv2.dilate(F, ker)
        cov = np.zeros_like(F)
        keep = []
        for p in active:
            e = edge_of(p['mask'])
            if int((e & (1 - G)).sum()) > 0.14 * max(int(e.sum()), 1):   # more of its side off the shape than the wall would let pass
                p['k1'] = k0
                done.append(p)
            else:
                keep.append(p)
                cov |= p['mask']
        active = keep
        dt = cv2.distanceTransform(F, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
        # a rectangle hugs the shape: the tolerance bridges a notch, it isn't a margin to stand off by
        t2 = max(int(round(tol_out * 0.3)), 1)
        G2 = cv2.dilate(F, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * t2 + 1, 2 * t2 + 1)))
        blocked = cv2.integral((1 - G2).astype(np.uint8))
        ci, cj = np.unravel_index(int(np.argmax(dt)), dt.shape)
        for guard in range(60):
            if cov.any():                                                # only the rim may stay bare: a gap inside the solid would be a wall facing nothing
                dc = cv2.distanceTransform((1 - cov).astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
                need = (F > 0) & ((dc > tol_in) | ((dt > tol_in + 1.0) & (cov == 0)))
            else:
                need = F > 0
            nn = int(need.sum())
            if nn < small:
                break
            i, j = np.unravel_index(int(np.argmax(dt * need)), dt.shape)
            cand = candidates(i, j, float(dt[i, j]), F, blocked, tol_out, rmin) + candidates(ci, cj, float(dt[ci, cj]), F, blocked, tol_out, rmin)
            gains = [int((q['mask'] & need).sum()) for q in cand]
            b = int(np.argmax(gains))
            if cand[b]['t'] == 'box':                                    # a round thing stays round: it turns a body aside
                cg = max(g for g, q in zip(gains, cand) if q['t'] == 'cyl')
                if cg >= 0.92 * gains[b]:
                    b = int(np.argmax([g if q['t'] == 'cyl' else -1 for g, q in zip(gains, cand)]))
            p = cand[b]
            if gains[b] <= 0:
                break
            p['area'] = int(p['mask'].sum())
            p['k0'] = k0
            for q in list(active):                                       # what the new one swallows ends here
                if int((q['mask'] & p['mask']).sum()) >= 0.92 * q['area']:
                    active.remove(q)
                    q['k1'] = k0
                    done.append(q)
            active.append(p)
            cov = np.zeros_like(F)
            for q in active:
                cov |= q['mask']
    for p in active:
        p['k1'] = last
        done.append(p)
    return [p for p in done if p['k1'] > p['k0']]


def tidy(prims, S, step_min):
    """A primitive whose whole height lies inside another's goes; one that stops a slice short of its twin joins it."""
    out = []
    for p in sorted(prims, key=lambda q: -(q['area'] * (q['k1'] - q['k0']))):
        inside = False
        for q in out:
            if q['k0'] <= p['k0'] and q['k1'] >= p['k1'] and int((p['mask'] & q['mask']).sum()) >= 0.97 * p['area']:
                inside = True
                break
        if not inside and (p['k1'] - p['k0']) >= 1:
            out.append(p)
    # merge a primitive with the one right above it when they are the same shape
    out.sort(key=lambda q: q['k0'])
    merged = []
    for p in out:
        for q in merged:
            if q['k1'] == p['k0']:
                a, b = q['mask'], p['mask']
                u = int((a | b).sum())
                if int((a & b).sum()) >= 0.94 * u:
                    q['k1'] = p['k1']
                    break
        else:
            merged.append(p)
    return merged


def to_piece(prims, o, h, s_min):
    """Cells to the piece's metres. Nothing thinner than the wall allows, at the smallest scale it's placed at."""
    thin = THIN / max(s_min, 0.1)
    out = []
    for p in prims:
        z0, z1 = float(o[2] + p['k0'] * h), float(o[2] + p['k1'] * h)
        if z1 - z0 < 2.0 * thin:
            zm = 0.5 * (z0 + z1)
            z0, z1 = zm - thin, zm + thin
        if p['t'] == 'cyl':
            r = max((p['r'] + 0.5) * h, thin)
            out.append({'t': 'cyl', 'x': round(float(o[0] + (p['i'] + 0.5) * h), 3), 'y': round(float(o[1] + (p['j'] + 0.5) * h), 3), 'z0': round(z0, 3), 'z1': round(z1, 3), 'r': round(r, 3)})
        else:
            b = p['b']
            x0, x1 = o[0] + b[0] * h, o[0] + b[1] * h
            y0, y1 = o[1] + b[2] * h, o[1] + b[3] * h
            out.append({'t': 'box', 'x': round(float(x0 + x1) / 2.0, 3), 'y': round(float(y0 + y1) / 2.0, 3), 'z0': round(z0, 3), 'z1': round(z1, 3), 'hx': round(max(float(x1 - x0) / 2.0, thin), 3), 'hy': round(max(float(y1 - y0) / 2.0, thin), 3)})
    return out


def sd(c, P):
    """Signed distance from points to one primitive, in the piece's metres."""
    x, y, z = P[:, 0] - c['x'], P[:, 1] - c['y'], P[:, 2]
    dz = np.maximum(c['z0'] - z, z - c['z1'])
    if c['t'] == 'cyl':
        dx = np.hypot(x, y) - c['r']
        return np.hypot(np.maximum(dx, 0.0), np.maximum(dz, 0.0)) + np.minimum(np.maximum(dx, dz), 0.0)
    ax, ay = np.abs(x) - c['hx'], np.abs(y) - c['hy']
    out = np.sqrt(np.maximum(ax, 0.0) ** 2 + np.maximum(ay, 0.0) ** 2 + np.maximum(dz, 0.0) ** 2)
    return out + np.minimum(np.maximum(np.maximum(ax, ay), dz), 0.0)


def samples(m, s, cap=60000, seed=7):
    """Points on the drawn surface, about one per 0.25 m² as placed."""
    rs = np.random.RandomState(seed)
    a, b, c = m.V[m.T[:, 0]], m.V[m.T[:, 1]], m.V[m.T[:, 2]]
    ar = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1) * s * s
    n = min(int(ar.sum() / 0.25) + 16, cap)
    tri = rs.choice(len(ar), n, p=ar / max(ar.sum(), 1e-9))
    u, v = rs.rand(n), rs.rand(n)
    f = u + v > 1.0
    u[f], v[f] = 1.0 - u[f], 1.0 - v[f]
    return a[tri] + (b[tri] - a[tri]) * u[:, None] + (c[tri] - a[tri]) * v[:, None]


def rings(c, s):
    """The wall's own sample of a collider's side, as placed, then back in the piece's metres."""
    z0, z1 = (c['z0'] * s if AIR_NOW[0] else max(c['z0'] * s, -1.0)), c['z1'] * s
    pts = []
    if c['t'] == 'cyl':
        r = c['r'] * s
        n = min(24, int(math.ceil(6.283 * r / 0.8)))
        pts = [(c['x'] * s + math.cos(k / n * 6.283) * r, c['y'] * s + math.sin(k / n * 6.283) * r) for k in range(n)]
    else:
        hx, hy = c['hx'] * s, c['hy'] * s
        nx, ny = min(10, int(math.ceil(hx / 0.5))), min(10, int(math.ceil(hy / 0.5)))
        for u in range(-nx, nx + 1):
            for v in (-1, 1):
                pts.append((c['x'] * s + u / nx * hx, c['y'] * s + v * hy))
        for u in range(-ny, ny + 1):
            for v in (-1, 1):
                pts.append((c['x'] * s + v * hx, c['y'] * s + u / ny * hy))
    nz = max(1, min(6, int(math.ceil((z1 - z0) / 1.2))))
    out = []
    for x, y in pts:
        for k in range(nz + 1):
            z = z0 + (z1 - z0) * k / nz
            if z >= 0.2 or AIR_NOW[0]:
                out.append((x / s, y / s, z / s))
    return np.array(out) if out else np.zeros((0, 3))


def dilate_ball(a, r):
    """Round dilation, r cells: each slice grown by the circle at that height."""
    out = np.zeros(a.shape, dtype=np.uint8)
    u = a.astype(np.uint8)
    nz = a.shape[2]
    for dz in range(-r, r + 1):
        q = int(round(math.sqrt(max(r * r - dz * dz, 0))))
        ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * q + 1, 2 * q + 1))
        for k in range(nz):
            if u[:, :, k].any() and 0 <= k + dz < nz:
                out[:, :, k + dz] |= cv2.dilate(u[:, :, k], ker)
    return out > 0


class Drawn:
    """What the wall measures against: sample points on the surface, one per 0.25 m² as placed, and a tree over them. A voxel surface is denser than that and reads kinder than the wall does."""

    def __init__(self, m, s, smax=None):
        self.P = samples(m, smax or s, cap=120000).astype(np.float32)   # the wall samples a kind once, at its largest instance
        self.s = s
        self.idx = cv2.flann_Index(self.P, dict(algorithm=1, trees=4))

    def far(self, Q):
        """Which points stand farther than 0.6 m (as placed) from anything drawn."""
        if not len(Q):
            return np.zeros(0, dtype=bool)
        i, d = self.idx.knnSearch(Q.astype(np.float32), 1, params=dict(checks=48))
        return np.sqrt(d[:, 0]) * self.s > FAR_LIM[0]


def far_share(c, col, s, drawn, i):
    """How much of this collider's open side is farther than the wall allows from anything drawn. None: it has no open side."""
    R = rings(c, s)
    if not len(R):
        return None
    hid = np.zeros(len(R), dtype=bool)
    for j, e in enumerate(col):
        if j != i:
            hid |= sd(e, R) * s < 0.15
    R = R[~hid]
    if not len(R):
        return None
    return float(drawn.far(R).mean())


def drawn_points(m, s):
    P = samples(m, s)
    if TREE.match(m.name):
        lo, top = P[:, 2].min(), P[:, 2].max()
        P = P[(P[:, 2] < lo + (top - lo) * 0.3) & (np.hypot(P[:, 0], P[:, 1]) < 1.2 / s)]
    if AIR_NOW[0]:
        return P
    return P[P[:, 2] > 0.1 / s] if (P[:, 2] > 0.1 / s).sum() > 16 else P


def measure(m, col, s, drawn, P=None):
    """The wall's two numbers for this piece, at this scale: A1v's 95th percentile, and how many colliders fail A2."""
    P = drawn_points(m, s) if P is None else P
    d = np.full(len(P), 1e9)
    for c in col:
        d = np.minimum(d, sd(c, P))
    d = np.sort(np.clip(d * s if AIR_NOW[0] else np.minimum(d * s, np.maximum(P[:, 2], 0.0) * s), 0.0, 3.0))    # the wall forgives what is that close to the ground
    p95 = float(d[int(len(d) * 0.95)]) if len(d) else 0.0
    bad = sum(1 for i, c in enumerate(col) if (far_share(c, col, s, drawn, i) or 0.0) > 0.25)
    return p95, bad


def prune(col, s, drawn, budget, P, limit=0.285):
    """Fewer solids. The wall lets 5% of what is drawn stand past 0.32 m: spend that on what costs most for least: first what fails A2, then what alone covers least."""
    n = len(col)
    if not n:
        return []
    cov = np.stack([sd(c, P) * s <= limit for c in col])
    R = []
    for c in col:
        r = rings(c, s)
        R.append(r[:: max(len(r) // 80, 1)])                             # a thinner ring: enough to judge by, cheap enough to ask for every primitive
    nr = [drawn.far(r) for r in R]
    H = []                                                               # H[i][j, k]: does collider j hide ring point k of collider i
    for i, r in enumerate(R):
        q = np.zeros((n, len(r)), dtype=bool)
        if len(r):
            for j, e in enumerate(col):
                if j != i:
                    q[j] = sd(e, r) * s < 0.15
        H.append(q)
    keep = np.ones(n, dtype=bool)
    allow = int(0.045 * len(P))
    while keep.sum() > 1:
        idx = np.where(keep)[0]
        counts = cov[idx].sum(axis=0)
        room = allow - int((counts == 0).sum())
        uniq = (cov[idx] & (counts == 1)[None, :]).sum(axis=1)
        fails = []
        for q, i in enumerate(idx):
            if len(R[i]):
                vis = ~H[i][idx].any(axis=0)
                nv = int(vis.sum())
                if nv and int((nr[i] & vis).sum()) > 0.25 * nv:
                    fails.append(q)
        victim = None
        if fails:
            q = min(fails, key=lambda v: uniq[v])
            if uniq[q] <= room:
                victim = idx[q]
        if victim is None:
            q = int(np.argmin(uniq))
            if uniq[q] == 0 or (len(idx) > budget and uniq[q] <= room):
                victim = idx[q]
        if victim is None:
            break
        keep[victim] = False
    return [c for c, k in zip(col, keep) if k]


def sd_dir(c, P):
    """Signed distance to one primitive and the way out of it, at each point."""
    x, y, z = P[:, 0] - c['x'], P[:, 1] - c['y'], P[:, 2]
    zc = 0.5 * (c['z0'] + c['z1'])
    dz = np.abs(z - zc) - 0.5 * (c['z1'] - c['z0'])
    sz = np.sign(z - zc)
    g = np.zeros_like(P)
    if c['t'] == 'cyl':
        q = np.maximum(np.hypot(x, y), 1e-6)
        dr = q - c['r']
        ux, uy = x / q, y / q
        d = np.where((dr > 0) & (dz > 0), np.hypot(dr, dz), np.maximum(dr, dz))
        side = dr >= dz
        corner = (dr > 0) & (dz > 0)
        g[:, 0] = np.where(corner, ux * dr / np.maximum(d, 1e-6), np.where(side, ux, 0.0))
        g[:, 1] = np.where(corner, uy * dr / np.maximum(d, 1e-6), np.where(side, uy, 0.0))
        g[:, 2] = np.where(corner, sz * dz / np.maximum(d, 1e-6), np.where(side, 0.0, sz))
        return d, g
    ax, ay = np.abs(x) - c['hx'], np.abs(y) - c['hy']
    ox, oy, oz = np.maximum(ax, 0.0), np.maximum(ay, 0.0), np.maximum(dz, 0.0)
    q = np.sqrt(ox * ox + oy * oy + oz * oz)
    inside = q <= 0.0
    d = np.where(inside, np.maximum(np.maximum(ax, ay), dz), q)
    big = np.argmax(np.stack([ax, ay, dz]), axis=0)
    g[:, 0] = np.where(inside, (big == 0) * np.sign(x), ox * np.sign(x) / np.maximum(q, 1e-6))
    g[:, 1] = np.where(inside, (big == 1) * np.sign(y), oy * np.sign(y) / np.maximum(q, 1e-6))
    g[:, 2] = np.where(inside, (big == 2) * sz, oz * sz / np.maximum(q, 1e-6))
    return d, g


def conform(m, col, s, out_max=0.16, in_max=0.26, push=True, cap=1.0):
    """The drawn rock is pulled the last few tenths of a metre onto its collider, instead of a thousand little solids being laid over it. On a 30 m stone that can't be seen; to a swimmer's hand it is the difference between touching the rock and touching air.
    Each vertex past out_max outside the union or in_max inside it is moved to that line. The move is smoothed along the surface between passes, so no crease shows, and the last pass is pure projection, so the bound holds."""
    V = m.V.copy()
    move = np.zeros_like(V)
    n = len(V)
    a = np.concatenate([m.T[:, 0], m.T[:, 1], m.T[:, 2]])
    b = np.concatenate([m.T[:, 1], m.T[:, 2], m.T[:, 0]])
    for loop in range(5):
        P = V + move
        best = np.full(len(P), 1e9)
        depth = np.full(len(P), -1e9)
        gout = np.zeros_like(P)
        gin = np.zeros_like(P)
        for c in col:
            d, g = sd_dir(c, P)
            k = d < best
            best[k], gout[k] = d[k], g[k]
            q = -d > depth
            depth[q], gin[q] = -d[q], g[q]
        over = best * s > out_max
        move[over] -= gout[over] * (best[over] - out_max / s)[:, None]
        if push:
            under = depth * s > in_max
            move[under] += gin[under] * (depth[under] - in_max / s)[:, None]
        if loop < 4:                                                     # the move, not the rock, is smoothed: what the mesh's own detail says stays
            total = np.zeros_like(move)
            cnt = np.zeros(n)
            np.add.at(total, a, move[b])
            np.add.at(cnt, a, 1.0)
            move = 0.5 * move + 0.5 * total / np.maximum(cnt, 1.0)[:, None]
    q = np.linalg.norm(move, axis=1)                                     # no vertex goes further than this, whatever the solids say: a shape stays the shape it was drawn
    move = move * np.minimum(1.0, (cap / s) / np.maximum(q, 1e-9))[:, None]
    m.V = V + move
    return float(np.percentile(np.linalg.norm(move, axis=1), 95) * s), float(np.linalg.norm(move, axis=1).max() * s)


def budget_of(n, name=''):
    """How many solids a piece may spend. F2, the phone's memory, holds the whole map's list to about 15,000, and the world holds some kinds by the hundred."""
    if name in BUDGET:
        return BUDGET[name]
    return 5 if n >= 150 else 8 if n >= 60 else 16 if n >= 15 else 32 if n >= 4 else 80


BUDGET = {'coral_brain': 4, 'coral_table': 3, 'rock_a': 6, 'rock_b': 6, 'rock_c': 6, 'rock_pillar': 10, 'beach_rock': 3, 'wreck_hull': 14, 'wreck_bow': 10, 'wreck_stern': 10, 'wreck_mast': 5, 'smoker': 10, 'ice_pillar': 7, 'ice_floe': 3, 'cliff_rock': 24,
          'lamp_ghost': 2, 'column_fallen': 6, 'stair_steep': 10, 'roof_slab': 20, 'arena_seats': 6, 'ice_tower': 20, 'tower': 14, 'tower_cold': 12, 'temple_front': 24, 'bridge_span': 16, 'dome_hall': 48, 'sea_arch': 90, 'kelp_spire': 50, 'wreck_stand': 60, 'statue_colossus': 80, 'statue_head': 16, 'statue_torso': 24, 'statue_feet': 12, 'rib_bone': 30}


def openings_of(S, o, h, s):
    """Holes in the piece's silhouette looking along x and along y, wide enough for his body, each with the solid beside it."""
    out = []
    kz0 = int(math.ceil((0.0 - o[2]) / h))                              # the ground closes every opening at the foot
    for ax in (0, 1):
        sil = S.any(axis=ax).astype(np.uint8)                            # (b, z)
        cols = np.where(sil.any(axis=1))[0]
        if not len(cols):
            continue
        low = int(np.where(sil.any(axis=0))[0].min())                    # the ground closes it at the foot, wherever the piece's own foot is
        sil[:, :max(kz0, low + int(math.ceil(1.0 / (h * s))), 1)] = 1
        free = (1 - sil).astype(np.uint8)
        c, lab = cv2.connectedComponents(free, connectivity=4)
        edge = set(lab[0, :].tolist()) | set(lab[-1, :].tolist()) | set(lab[:, -1].tolist())
        for q in range(1, c):
            if q in edge:
                continue
            hole = (lab == q).astype(np.uint8)
            dt = cv2.distanceTransform(hole, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
            b, k = np.unravel_index(int(np.argmax(dt)), dt.shape)
            r = float(dt[b, k]) * h * s
            if r < 0.85:                                                 # his 0.62 and a margin
                continue
            xs = np.where(S[:, :, k].any(axis=1 - ax if ax == 0 else 0))[0]
            # along the way through: the piece's own thickness at this height
            line = S[:, :, max(k - 2, 0):k + 3].any(axis=2)
            thick = line.any(axis=1) if ax == 1 else line.any(axis=0)    # along the swim axis
            ext = np.where(line.any(axis=0 if ax == 1 else 1))[0]
            L = 0.5 * (ext.max() - ext.min() + 1) * h + 2.4 / s if len(ext) else 4.0 / s
            mid = (ext.max() + ext.min() + 1) * 0.5 * h if len(ext) else 0.0
            bc = float(o[1 - ax] + (b + 0.5) * h)
            zc = float(o[2] + (k + 0.5) * h)
            ac = float(o[ax] + mid)
            # the solid beside it: the nearest column at this height with a solid wall in it
            row = sil[:, k]
            side = None
            for off in range(int(dt[b, k]) + 2, sil.shape[0]):
                for sg in (1, -1):
                    w = b + sg * off
                    if 2 < w < sil.shape[0] - 3 and row[w - 2:w + 3].all():
                        side = sg * off * h
                        break
                if side is not None:
                    break
            e = {'z': round(zc, 3), 'r': round(r / s, 3)}
            if ax == 1:
                e.update({'x': round(bc, 3), 'y': round(ac, 3), 'dx': 0.0, 'dy': round(L, 3), 'sx': round(side, 3) if side else None, 'sy': 0.0})
            else:
                e.update({'x': round(ac, 3), 'y': round(bc, 3), 'dx': round(L, 3), 'dy': 0.0, 'sx': 0.0, 'sy': round(side, 3) if side else None})
            out.append(e)
    return out


def scales(path):
    W = json.load(open(path))
    out = {}
    for k, v in W['instances'].items():
        a = np.array(v, dtype=np.float64).reshape(-1, 6)[:, 4]
        out[k] = (len(a), float(np.percentile(a, 90)), float(a.max()), float(a.min()))
    return out


def fit(name, sc, cap=5e6):
    AIR_NOW[0] = name in AIRK
    FAR_LIM[0] = 1.5 if NATURAL.match(name) else 0.6
    raw = os.path.join(RAW, name + '.npz')
    src = raw if os.path.exists(raw) else os.path.join(CACHE, name + '.npz')
    z = np.load(src)
    m = Mesh(z['V'].astype(np.float64), z['T'].astype(np.int64))
    m.name = name
    n, s90, smax, smin = sc.get(name, (1, 1.0, 1.0, 1.0))
    natural = bool(NATURAL.match(name))
    s = max(s90 if natural else smax, 0.1)                               # a built kit has to hold at its largest scale: a temple's walls stand at 1.25, and an overhang grows with them
    e = m.V.max(axis=0) - m.V.min(axis=0) + 2.0
    h = float(np.clip((0.2 if natural else 0.11) / s, 0.04, 0.5))
    while np.prod(e / h + 10.0) > cap:
        h *= 1.1
    t0 = time.time()
    seal = SEAL.get(name, 0.32 if NATURAL.match(name) else BODY) / s      # a crevice in rock stays a crevice: closed wide, its lid would stand far from anything drawn
    S, occ, o = solid_of(m, h, seal)
    budget = budget_of(n, name)
    drawn = Drawn(m, s, smax)
    P = drawn_points(m, s)
    best = None
    for f in ((1.0, 0.7, 0.5, 0.36, 0.26) if not natural else (1.65, 1.3, 1.0, 0.8, 0.6)):   # coarse first: a finer sweep only for a piece that fails
        # rock: a few big solids that contain the shape: everything drawn is inside (A1v), and nothing stands proud by more than a swimmer can tell (A2's natural limit)
        tol_out, tol_in = (0.85 if natural else MAX_OUT) * f / s / h, (0.34 if natural else MAX_IN) * f / s / h
        col0 = to_piece(tidy(sweep(S, tol_out, tol_in, 0.22 / s / h, False), S, 1), o, h, smin)
        raw_n = len(col0)
        col = prune(col0, s, drawn, budget, P, limit=0.3 if natural else 0.285)
        p95, bad = measure(m, col, s, drawn, P)
        r = {'col': col, 'n': len(col), 'p95': round(p95, 3), 'bad': bad, 'f': f, 'raw': raw_n, 'moved': 0.0, 'moved95': 0.0}
        score = (p95 > 0.31) * 10.0 + bad + 0.3 * max(len(col) - budget, 0)
        if best is None or score < best['score']:
            r['score'] = score
            best = r
        if (bad == 0 and p95 <= 0.31 and len(col) <= budget) or time.time() - t0 > 30.0:
            break
    best_w = None
    if os.path.exists(raw):                                              # the wrap is retired: the piece as it was generated
        import shutil
        shutil.copy(raw, os.path.join(CACHE, name + '.npz'))
        os.remove(raw)
    if best_w is not None:                                               # the piece as drawn from now on
        if not os.path.exists(raw):
            os.makedirs(RAW, exist_ok=True)
            import shutil
            shutil.copy(os.path.join(CACHE, name + '.npz'), raw)
        q = dict(np.load(os.path.join(CACHE, name + '.npz')))
        q['V'] = best_w.V.astype(np.float32)
        np.savez_compressed(os.path.join(CACHE, name + '.npz'), **q)
    best['openings'] = BLIND.get(name, openings_of(S, o, h, s))
    best.update({'inst': n, 'scale': round(s, 2), 'pitch': round(h, 3), 'budget': budget, 'sec': round(time.time() - t0, 1), 'cells': int(np.prod(S.shape))})
    return best


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    missing = '--missing' in sys.argv                                    # go on where the last run stopped: the lock gives a job three minutes
    wpath = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--world=')), os.path.join(HERE, 'out', 'stage', 'world.json'))
    sc = scales(wpath)
    pieces = json.load(open(os.path.join(HERE, 'out', 'pieces.json')))
    keep = pieces.keys() if not args else args[0].split(',')
    names = [n for n in keep if '__far' not in n and n not in SKIP and not SOFT.match(n) and not TREE.match(n) and (n in sc or args) and os.path.exists(os.path.join(CACHE, n + '.npz'))]
    table = json.load(open(OUTP)) if os.path.exists(OUTP) else {}
    t0 = time.time()
    for n in names:
        if missing and n in table:
            continue
        if time.time() - t0 > float(os.environ.get('FIT_SECONDS', '150')):
            print('STOPPED at the time limit before', n, flush=True)
            break
        r = fit(n, sc)
        table[n] = r
        json.dump(table, open(OUTP + '.new', 'w'), separators=(',', ':'))
        os.replace(OUTP + '.new', OUTP)
        print('FIT %-18s x%-4d s %.2f h %.3f  raw %3d n %3d/%-3d  p95 %.2f  bad %2d  f %.2f  open %d  moved %.2f/%.2f  %.1fs' % (n, r['inst'], r['scale'], r['pitch'], r['raw'], r['n'], r['budget'], r['p95'], r['bad'], r['f'], len(r['openings']), r['moved95'], r['moved'], r['sec']), flush=True)
    print('TOTAL', sum(table[k]['n'] * table[k]['inst'] for k in table), 'colliders across', len(table), 'kinds', flush=True)
