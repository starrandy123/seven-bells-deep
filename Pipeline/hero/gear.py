# The pieces that aren't the man: bronze, cloth, the trident. Every one is measured against the real body (a limb's own radius at each height and
# angle), so a bracer fits that forearm. Rigid pieces ride one bone at 100%; a strap that must bend with him copies the skin's weights.
import math
import numpy as np
from mathutils import Vector
import tex

BRONZE = (0.588, 0.323, 0.050)     # #c99a3f in linear
BRONZE_DK = (0.25, 0.135, 0.03)
PEARL = (0.81, 0.86, 0.79)         # #e9efe6
TEAL = (0.0037, 0.107, 0.133)      # #0c5c66
CYAN = (0.078, 0.87, 1.0)          # #4ff0ff
INDIGO = (0.0103, 0.0252, 0.156)   # #1a2c6e
LEATHER = (0.09, 0.05, 0.03)
ZERO = (0.0, 0.0, 0.0, 0.0)
M_METAL = (0.0, 0.0, 1.0, 0.0); M_GLOW = (0.0, 1.0, 0.0, 0.0); M_SCALE = (1.0, 0.0, 0.0, 0.0)
M_BOSS = (0.0, 0.0, 1.0, 0.02)        # a small raised piece: so near the skin that baked shade would swamp it, so it is left out of the shade

def tri(x): return abs(((x % 2.0) + 2.0) % 2.0 - 1.0)

class Gear:
    def __init__(s, rng):
        s.v = []; s.w = []; s.f = []; s.uv = []; s.col = []; s.mask = []; s.hard = []; s.rng = rng
    def vert(s, p, w):
        s.v.append(tuple(p)); s.w.append(w); return len(s.v) - 1
    def face(s, ids, uvs, col, mask=ZERO, hard=True):
        s.f.append(tuple(ids)); s.uv.append(uvs); s.col.append(col); s.mask.append(mask); s.hard.append(hard)
    def tris(s): return sum(len(f) - 2 for f in s.f)

HAIR_UV = (0.16, 0.36, 0.14, 0.07)         # a patch of his own hair in the head block
def tile_uv(name, a, b, scale=0.25):
    u0, v0, du, dv = HAIR_UV if name == 'hair' else tex.swatch_uv(name)
    return (u0 + du * tri(a / scale), v0 + dv * tri(b / scale))

def grid(g, rows, w, col, mask=ZERO, swatch='bronze', closed=True, hard=False, cap0=False, cap1=False, uvscale=0.25, face_filter=None):
    """A surface from rows of points (all the same length). col and mask may be functions (row, column) -> value."""
    R = len(rows); N = len(rows[0])
    # the UV follows arc length along and around
    ids = []
    lenv = [0.0]
    for i in range(1, R):
        lenv.append(lenv[-1] + (Vector(rows[i][0]) - Vector(rows[i - 1][0])).length)
    uvs = []
    for i in range(R):
        rid = []; ruv = []; a = 0.0
        for j in range(N):
            if j: a += (Vector(rows[i][j]) - Vector(rows[i][j - 1])).length
            rid.append(g.vert(rows[i][j], w(rows[i][j]) if callable(w) else w)); ruv.append(tile_uv(swatch, a, lenv[i], uvscale))
        ids.append(rid); uvs.append(ruv)
    for i in range(R - 1):
        for j in range(N if closed else N - 1):
            k = (j + 1) % N
            if face_filter and not face_filter(i, j): continue
            c = col(i, j) if callable(col) else col; m = mask(i, j) if callable(mask) else mask
            g.face((ids[i][j], ids[i][k], ids[i + 1][k], ids[i + 1][j]), (uvs[i][j], uvs[i][k], uvs[i + 1][k], uvs[i + 1][j]), c, m, hard)
    if cap0 or cap1:
        for i, on in ((0, cap0), (R - 1, cap1)):
            if not on: continue
            c = col(0, 0) if callable(col) else col; m = mask(0, 0) if callable(mask) else mask
            ctr = tuple(np.mean(np.array(rows[i]), axis=0))
            cid = g.vert(ctr, w(ctr) if callable(w) else w)
            cuv = tile_uv(swatch, 0.05, 0.05, uvscale)
            for j in range(N):
                k = (j + 1) % N
                tri_ids = (ids[i][j], cid, ids[i][k]) if i == 0 else (ids[i][j], ids[i][k], cid)
                tri_uvs = (uvs[i][j], cuv, uvs[i][k]) if i == 0 else (uvs[i][j], uvs[i][k], cuv)
                g.face(tri_ids, tri_uvs, c, m, hard)
    return ids

def axes(u):
    """Two directions square to u: e1 towards fighter front where it can, e2 = u x e1."""
    u = np.array(u, dtype=np.float64); u /= np.linalg.norm(u)
    f = np.array((0.0, -1.0, 0.0))
    if abs(u.dot(f)) > 0.9: f = np.array((0.0, 0.0, 1.0))
    e1 = f - u * u.dot(f); e1 /= np.linalg.norm(e1); e2 = np.cross(u, e1)
    return e1, e2

class Limb:
    """A piece of the real body seen from a bone's axis: radius by (s along the axis, angle round it)."""
    def __init__(s, co, sel, A, B, ns=30, na=24):
        s.A = np.array(A); s.B = np.array(B); s.L = np.linalg.norm(s.B - s.A); s.u = (s.B - s.A) / s.L; s.e1, s.e2 = axes(s.u)
        p = co[sel] - s.A; t = p @ s.u; q = p - t[:, None] * s.u
        x, y = q @ s.e1, q @ s.e2; ang = np.arctan2(y, x); rad = np.hypot(x, y)
        s.ns, s.na = ns, na; s.smin = -0.25 * s.L; s.smax = 1.25 * s.L
        G = np.zeros((ns, na)); si = np.clip(((t - s.smin) / (s.smax - s.smin) * ns).astype(int), 0, ns - 1); ai = ((ang + math.pi) / (2 * math.pi) * na).astype(int) % na
        np.maximum.at(G, (si, ai), rad)
        # fill empty bins from their neighbours, then soften
        for _ in range(12):
            E = G == 0
            if not E.any(): break
            Nb = np.stack((np.roll(G, 1, 0), np.roll(G, -1, 0), np.roll(G, 1, 1), np.roll(G, -1, 1)))
            c = (Nb > 0).sum(0); val = Nb.sum(0) / np.maximum(c, 1)
            G[E] = val[E]
        for _ in range(1):
            G = 0.5 * G + 0.125 * (np.roll(G, 1, 1) + np.roll(G, -1, 1)) + 0.25 * G
            G = G / 1.0
        s.G = G
    def r(s, sv, ang):
        fs = (sv - s.smin) / (s.smax - s.smin) * s.ns - 0.5; fa = (ang + math.pi) / (2 * math.pi) * s.na - 0.5
        i = int(np.clip(math.floor(fs), 0, s.ns - 2)); j = int(math.floor(fa)) % s.na; ds = float(np.clip(fs - i, 0, 1)); da = fa - math.floor(fa)
        j2 = (j + 1) % s.na
        return float((s.G[i, j] * (1 - da) + s.G[i, j2] * da) * (1 - ds) + (s.G[i + 1, j] * (1 - da) + s.G[i + 1, j2] * da) * ds)
    def p(s, sv, ang, off=0.0):
        r = s.r(sv, ang) + off
        return tuple(s.A + s.u * sv + (s.e1 * math.cos(ang) + s.e2 * math.sin(ang)) * r)

def shell(g, L, s0, s1, bone, rows=8, cols=20, off=0.008, a0=-math.pi, a1=math.pi, closed=True, flare=None, col=BRONZE, mask=M_METAL, trim=True, trim_col=PEARL, swatch='bronze'):
    """A plate round a limb from s0 to s1 (fractions of its length), `off` metres clear of the skin; a rolled edge at both ends."""
    def station(k):
        return s0 + (s1 - s0) * k / (rows - 1)
    C = cols if closed else cols + 1
    def ring(sv, extra):
        return [L.p(sv * L.L, a0 + (a1 - a0) * j / (cols if closed else cols), off + extra) for j in range(C)]
    Rows = []
    if trim:
        Rows.append(ring(station(0) - 0.012, 0.000)); Rows.append(ring(station(0) - 0.012, 0.007))
    for k in range(rows):
        t = k / (rows - 1); e = 0.0
        if flare: e = flare(t)
        Rows.append(ring(station(k), 0.005 + e))
    if trim:
        Rows.append(ring(station(rows - 1) + 0.012, 0.007)); Rows.append(ring(station(rows - 1) + 0.012, 0.000))
    n = len(Rows)
    def cf(i, j):
        if trim and (i < 2 or i >= n - 3): return trim_col
        return col
    grid(g, Rows, {bone: 1.0}, cf, mask, swatch, closed=closed, hard=True)

def tube(g, path, radii, w, col, mask=ZERO, n=6, swatch='bronze', hard=False, cap0=True, cap1=True, squash=1.0, roll=0.0):
    """A tube along a path (radii one each), parallel transported."""
    pts = [np.array(p, dtype=np.float64) for p in path]
    T = [pts[1] - pts[0]] + [pts[i + 1] - pts[i - 1] for i in range(1, len(pts) - 1)] + [pts[-1] - pts[-2]]
    T = [t / np.linalg.norm(t) for t in T]
    e1, _ = axes(T[0]); rows = []
    for i, p in enumerate(pts):
        e1 = e1 - T[i] * e1.dot(T[i]); e1 /= np.linalg.norm(e1); e2 = np.cross(T[i], e1)
        r = radii[i]
        rows.append([tuple(p + (e1 * math.cos(2 * math.pi * j / n + roll) * r + e2 * math.sin(2 * math.pi * j / n + roll) * r * squash)) for j in range(n)])
    return grid(g, rows, w, col, mask, swatch, closed=True, hard=hard, cap0=cap0, cap1=cap1, uvscale=0.5)

def blade(g, A, B, side, width, w, col=BRONZE, mask=M_METAL, thick=0.006, n=6, belly=0.3, soft=False):
    """A leaf: from A to B, widest a third up, sharp both ends, a raised spine. `side` is its flat's width direction. soft: a rounded fin, no point at all."""
    A, B = np.array(A), np.array(B); u = B - A; L = np.linalg.norm(u); u /= L; side = np.array(side); side = side - u * u.dot(side); side /= np.linalg.norm(side); nrm = np.cross(u, side)
    rows = []
    for k in range(n + 1):
        t = k / n; c = A + (B - A) * t
        wd = width * (min(t / belly, 1.0) ** 0.7 if t < belly else (1 - (t - belly) / (1 - belly)) ** 0.75)
        if soft: wd = width * math.sin(t * math.pi) ** 0.55 * (1.0 - 0.25 * t)
        wd = max(wd, 0.0005)
        rows.append([tuple(c + side * wd), tuple(c + nrm * thick), tuple(c - side * wd), tuple(c - nrm * thick)])
    grid(g, rows, w, col, mask, 'bronze', closed=True, hard=True, uvscale=0.4)

def ribbon(g, pts, nrms, width, w, col=CYAN, mask=M_GLOW):
    """A line of light: a thin flat strip lying on a surface."""
    ids = []; uvs = []
    u0, v0, du, dv = tex.swatch_uv('glow')
    uv = (u0 + du * 0.5, v0 + dv * 0.5)
    for i, p in enumerate(pts):
        p = np.array(p); n = np.array(nrms[i]); T = np.array(pts[min(i + 1, len(pts) - 1)]) - np.array(pts[max(i - 1, 0)]); T /= max(np.linalg.norm(T), 1e-6)
        s = np.cross(T, n); s /= max(np.linalg.norm(s), 1e-6)
        a = g.vert(p + s * width, w(p) if callable(w) else w); b = g.vert(p - s * width, w(p) if callable(w) else w); ids.append((a, b))
    for i in range(len(ids) - 1):
        g.face((ids[i][0], ids[i][1], ids[i + 1][1], ids[i + 1][0]), (uv, uv, uv, uv), col, mask, False)

def trident(g, G, t, f, bone='weapon', length=1.05):
    """Three tines, 2.1 m end to end, centred on the grip: G the grip, t the shaft's way (the point), f the fan's direction across the tines."""
    G, t, f = np.array(G), np.array(t), np.array(f); f = f - t * t.dot(f); f /= np.linalg.norm(f); up = np.cross(t, f)
    W = {bone: 1.0}
    P = lambda s, x=0.0, y=0.0: G + t * s + f * x + up * y
    # the shaft: bronze, ringed where the hands go, a teal wrap at the grip
    ss = [-0.86, -0.80, -0.30, -0.26, -0.22, 0.22, 0.26, 0.30, 0.58, 0.63]
    rr = [0.022, 0.0165, 0.0165, 0.021, 0.0175, 0.0175, 0.021, 0.0165, 0.0165, 0.021]
    tube(g, [P(s) for s in ss], rr, W, lambda i, j: (BRONZE if (i in (2, 3, 5, 6) or i > 7 or i == 0) else BRONZE_DK), M_METAL, n=8)
    # the butt: a spike with two fins
    tube(g, [P(-0.86), P(-0.90), P(-1.05)], [0.022, 0.03, 0.002], W, BRONZE, M_METAL, n=6, hard=True, cap1=False)
    for sx in (-1, 1): blade(g, P(-0.84, sx * 0.012), P(-1.00, sx * 0.075), up, 0.020, W, thick=0.004, n=6, soft=True)
    # the head's collar
    tube(g, [P(0.60), P(0.635), P(0.665), P(0.70)], [0.021, 0.036, 0.036, 0.024], W, BRONZE, M_METAL, n=8, hard=False)
    # the crossbar that carries the tines, a shallow bowl
    bar = []; rad = []
    for k in range(9):
        x = -0.135 + 0.27 * k / 8; bar.append(P(0.70 + 0.11 * (abs(x) / 0.135) ** 1.8 + 0.0, x)); rad.append(0.017 + 0.012 * (1 - abs(x) / 0.135))
    tube(g, bar, rad, W, BRONZE, M_METAL, n=6, cap0=True, cap1=True, squash=0.65)
    # middle tine straight to the very point, side tines curve in a little at the tips
    tube(g, [P(0.70), P(0.76), P(0.80)], [0.020, 0.015, 0.014], W, BRONZE, M_METAL, n=6)
    blade(g, P(0.79), P(length), f, 0.040, W, thick=0.011, n=7, belly=0.38)
    for sx in (-1, 1):
        pth = [P(0.80, sx * 0.135), P(0.84, sx * 0.137), P(0.88, sx * 0.132)]
        tube(g, pth, [0.013, 0.011, 0.010], W, BRONZE, M_METAL, n=6)
        blade(g, P(0.872, sx * 0.133), P(0.985, sx * 0.112), f, 0.027, W, thick=0.008, n=6, belly=0.35)
        blade(g, P(0.80, sx * 0.143), P(0.88, sx * 0.19), up, 0.017, W, thick=0.005, n=6, soft=True)      # the outer barbs, rounded
    # the glow lines: down the middle of each tine, both faces
    for fc in (-1, 1):
        ribbon(g, [P(s, 0, fc * (0.0118 - 0.09 * (s - 0.80))) for s in np.linspace(0.81, 0.99, 7)], [up * fc] * 7, 0.0028, W)
        for sx in (-1, 1):
            ribbon(g, [P(s, sx * (0.134 - (s - 0.88) * 0.19 if s > 0.88 else 0.135), fc * 0.0115) for s in np.linspace(0.76, 0.95, 6)], [up * fc] * 6, 0.0022, W)
        ribbon(g, [P(s, 0, fc * 0.0205) for s in (0.24, 0.40, 0.56)], [up * fc] * 3, 0.0018, W)
        ribbon(g, [P(s, 0, fc * 0.0205) for s in (-0.56, -0.40, -0.24)], [up * fc] * 3, 0.0018, W)

def mantle(g, surface, y0, length, rows, cols, names, rng, att):
    """The torn mantle. It hangs from both shoulders: the top edge sags between them in a U and lies on his real back (surface(x, z) gives y there), then falls free
    in fin rays, flaring, to a torn hem. A bone owns the middle of its length of cloth; the top edge stays on the chest."""
    # broad round lobes with a few short soft tears between them: nothing tapers to a point, and nothing thin is left hanging at the edges
    tears = [(-0.21, 0.046, rng.uniform(0.08, 0.11)), (0.05, 0.042, rng.uniform(0.07, 0.10)), (0.27, 0.046, rng.uniform(0.08, 0.11))]
    def hem(c):
        l = 0.93 + 0.040 * math.sin(c * 2 * math.pi * 3.5 + 0.7) + 0.016 * math.sin(c * 2 * math.pi * 8.3 + 2.1)
        for cn, wn, dn in tears: l -= dn * math.exp(-((c - cn) / wn) ** 2)
        e = min(1.0, (0.5 - abs(c)) / 0.09)              # both side edges curve up in a round shoulder
        return l - 0.14 * (1 - e) ** 2
    L = [hem(j / cols - 0.5) for j in range(cols + 1)]
    ids = []
    nb = len(names)
    def weights(v):
        b = v * nb
        if b < 0.08: return {att: 1.0}
        if b < 0.5:
            t = (b - 0.08) / 0.42; return {att: 1 - t, names[0]: t}
        k = int(b - 0.5)
        if k >= nb - 1: return {names[-1]: 1.0}
        t = b - 0.5 - k; return {names[k]: 1 - t, names[k + 1]: t}
    for i in range(rows + 1):
        v = i / rows; row = []
        for j in range(cols + 1):
            c = j / cols - 0.5
            wd = 0.36 + 0.13 * v ** 0.8         # narrow enough to see his arms past it from behind, the game's camera; it ends above the knee, so his legs read at a run
            x = c * wd
            ztop = 1.385 + 0.110 * (abs(c) * 2) ** 2.6 - 0.05 * max(0.0, abs(c) * 2 - 0.9) / 0.1
            z = ztop - length * v * (1.0 + (L[j] - 1.0) * v ** 0.6) * (1.0 - 0.10 * (abs(c) * 2) ** 2)
            fold = (0.010 + 0.042 * v) * math.sin(c * 2 * math.pi * 3.5 + 1.3 * v) + (0.004 + 0.016 * v) * math.sin(c * 2 * math.pi * 7.5 - 0.9 * v + 1.0)
            free = y0 + 0.02 + 0.15 * v ** 0.85 + fold
            sy = surface(x, z)
            y = max(free, sy + 0.014) if sy is not None else free
            if i == 0 and sy is not None: y = sy + 0.012
            uv = tile_uv('cloth', x, z, 0.5)
            row.append((g.vert((x, y, z), weights(v)), uv))
        ids.append(row)
    def shade(i, j):
        """Each corner its own colour: the gradient runs smooth, indigo to cyan at the hem, with soft fin rays in the folds' rhythm."""
        v = i / rows; a = min(1.0, max(0.0, (v - 0.30) / 0.70)) ** 1.5
        ray = 0.88 + 0.12 * math.sin(j / cols * 2 * math.pi * 7.5 - 0.9 * v + 1.0)
        return tuple((INDIGO[k] + (CYAN[k] * 0.70 - INDIGO[k]) * a) * ray for k in range(3))
    for i in range(rows):
        for j in range(cols):
            v = (i + 0.5) / rows
            m = (0.0, max(0.0, (v - 0.84) * 2.0), 0.0, 0.45 + 0.55 * v)
            q = (ids[i][j], ids[i][j + 1], ids[i + 1][j + 1], ids[i + 1][j])
            g.face(tuple(x[0] for x in q), tuple(x[1] for x in q), [shade(i, j), shade(i, j + 1), shade(i + 1, j + 1), shade(i + 1, j)], m, False)

def kilt(g, L, z_top, n, rng):
    """War-kilt strips round the hips: scale cloth with a bronze tip. Each hangs from the belt on the hips and rides its thigh at the tip, so it opens with a kick."""
    for k in range(n):
        a = -math.pi + 2 * math.pi * (k + 0.5) / n
        front = math.cos(a); side = math.sin(a)
        h = (0.235 if front > 0 else 0.255) + 0.018 * (rng.random() - 0.5) * 2
        wd = 0.042
        bone = 'leg_L' if side > 0 else 'leg_R'
        centre = abs(side) < 0.28
        rows = []; R = 6
        for r in range(R + 1):
            t = r / R
            row = []
            for j in range(3):
                e = (j - 1) * wd * (1.0 + 0.16 * t)
                # the tip comes to a soft point
                tip = t + (0.09 * (1 - abs(j - 1)) if r == R else 0.0)
                z = z_top - h * tip
                aa = a + e / 0.205
                fr = (z - L.smin_z) / L.L
                row.append(L.p(fr * L.L, aa, 0.012 + 0.026 * t))
            rows.append(row)
        def w(p, top=z_top, h=h, bone=bone, centre=centre):
            t = max(0.0, min(1.0, (top - p[2]) / h)) ** 1.2
            if centre: return {'hips': 1 - 0.8 * t, 'leg_L': 0.4 * t, 'leg_R': 0.4 * t}
            return {'hips': 1 - 0.9 * t, bone: 0.9 * t}
        tint = TEAL
        def col(i, j, tint=tint):
            if i >= R - 1: return BRONZE
            if j == 0 and False: return PEARL
            return tuple(min(1.0, x * 1.25) for x in tint)
        def msk(i, j): return M_METAL if i >= R - 1 else M_SCALE
        grid(g, rows, w, col, msk, 'scale', closed=False, hard=True, uvscale=0.22)

RUST = (0.254, 0.044, 0.016)       # #8a3b22
IRON = (0.045, 0.040, 0.036)
BARNACLE = (0.46, 0.43, 0.33)

def spear(g, G, t, f, bone='weapon', length=1.05):
    """A drowned soldier's spear, 2.1 m, rust and black iron, its point at exactly `length` from the grip."""
    G, t, f = np.array(G), np.array(t), np.array(f); f = f - t * t.dot(f); f /= np.linalg.norm(f); up = np.cross(t, f)
    W = {bone: 1.0}
    P = lambda s, x=0.0, y=0.0: G + t * s + f * x + up * y
    ss = [-0.98, -0.40, -0.36, 0.36, 0.40, 0.60, 0.64]; rr = [0.016, 0.0165, 0.021, 0.0165, 0.021, 0.0155, 0.024]
    tube(g, [P(s) for s in ss], rr, W, lambda i, j: (RUST if i in (1, 3, 5) else IRON), (0, 0, 0.5, 0), n=7)
    tube(g, [P(-0.98), P(-1.05)], [0.018, 0.002], W, RUST, (0, 0, 0.5, 0), n=5, hard=True, cap1=False)
    blade(g, P(0.62), P(length), f, 0.058, W, col=RUST, mask=(0, 0, 0.5, 0), thick=0.012, n=8, belly=0.36)
    for sx in (-1, 1): blade(g, P(0.70, sx * 0.04), P(0.60, sx * 0.13), up, 0.016, W, col=IRON, mask=(0, 0, 0.5, 0), thick=0.005, n=3, belly=0.4)

def barnacle(g, p, n, r, h, w):
    """One barnacle: a little ridged cone with a dark mouth."""
    n = np.array(n, dtype=np.float64); n /= np.linalg.norm(n); e1, e2 = axes(n); p = np.array(p)
    sides = 5
    ring = lambda rad, ht: [tuple(p + n * ht + (e1 * math.cos(2 * math.pi * j / sides) + e2 * math.sin(2 * math.pi * j / sides)) * rad) for j in range(sides)]
    rows = [ring(r, -0.003), ring(r * 0.62, h), ring(r * 0.28, h * 0.72)]
    grid(g, rows, w, lambda i, j: (BARNACLE if i == 0 else (0.03, 0.04, 0.035)), (0, 0, 0, 0), 'cloth', closed=True, hard=True, cap1=True, uvscale=0.1)

def ponytail(g, base, n, rng):
    """A warrior's tail of dark hair from the crown, held by a bronze ring: three bones, so it swings on the springs. Several locks, so it isn't a rope."""
    base = np.array(base)
    H = (0.040, 0.030, 0.022)
    def w(p):
        t = max(0.0, min(1.0, (base[2] - p[2]) / 0.36)) * 3
        if t < 0.35: return {'head': 1.0 - t / 0.35, 'hair_1': t / 0.35}
        if t < 1.5: f = (t - 0.35) / 1.15; return {'hair_1': 1 - f, 'hair_2': f}
        if t < 2.6: f = (t - 1.5) / 1.1; return {'hair_2': 1 - f, 'hair_3': f}
        return {'hair_3': 1.0}
    locks = [(0.0, 0.0, 1.0), (-0.012, 0.004, 0.86), (0.012, 0.004, 0.9), (0.0, 0.012, 0.74)]
    for ox, oy, ln in locks:
        pts = []; rad = []
        for k in range(8):
            t = k / 7
            pts.append(base + np.array((ox * (1 + 2.6 * t), 0.012 + oy + 0.10 * t ** 0.8 + 0.018 * math.sin(t * 5 + ox * 60), -0.40 * ln * t ** 0.92)))
            rad.append(0.0165 * (1.0 - t ** 1.6 * 0.94) * (1.0 if k else 0.8))
        tube(g, pts, rad, w, (1.0, 1.0, 1.0), (0, 0, 0, 0.8), n=5, swatch='hair', cap0=True, cap1=False)
    # the ring
    u = np.array((0.0, 0.22, -1.0)); u /= np.linalg.norm(u)
    tube(g, [base + u * 0.006, base + u * 0.02, base + u * 0.034], [0.0215, 0.0235, 0.0205], {'head': 1.0}, BRONZE, M_METAL, n=8, hard=True)
