# Drowned City: W13, real architecture. "No flat boxes": cut stone with chamfered joints, mouldings swept from a profile, fluted shafts on Attic bases, roof tiles, doors and windows with depth, weathering and moss in the corners.
# One family per culture: Thalor's marble; Meridon's gilded limestone; Vesper's rock-cut dark stone. Each mesh keeps its colours in vertex corners; ambient occlusion is baked after, from the finished mesh.
import math

import numpy as np

from meshkit import Mesh, Perlin3, TAU, box, fan, grid, hexc, join, lathe, mix, sphere, sstep, tube

MARBLE = hexc('#d4cfbf')
LIME = hexc('#b4af9f')                                                  # Meridon's limestone, kept under 0.6 so only a lit window trips the look's glow
DARK = hexc('#3d4148')                                                  # Vesper's cut basalt
GOLD = hexc('#c9a24a')
OLDGOLD = hexc('#a07f38')
VERD = hexc('#4f8a78')
ALGAE = hexc('#3d6e5a')
GOLDLIT = np.array([1.0, 0.72, 0.28])
COLDLIT = np.array([0.22, 0.86, 1.0])
DOORW = hexc('#3a2c1e')


def fract(x):
    return x - np.floor(x)


def face_out(m, c):
    """A convex piece: every triangle looks away from its middle c."""
    n = m.face_normals()
    d = np.sum(n * (m.corners().mean(axis=1) - np.asarray(c)), axis=1)
    k = d < 0
    m.T[k] = m.T[k][:, ::-1]
    m.C[k] = m.C[k][:, ::-1]
    return m


def face_dir(m, v):
    """A surface: every triangle looks along v."""
    n = m.face_normals()
    k = np.sum(n * np.asarray(v), axis=1) < 0
    m.T[k] = m.T[k][:, ::-1]
    m.C[k] = m.C[k][:, ::-1]
    return m


def bevel_box(x0, x1, y0, y1, z0, z1, c=0.06, col=None, S=False):
    """A block with its edges cut: 44 triangles. The chamfers catch the light that a box's edge never does."""
    c = min(c, (x1 - x0) * 0.45, (y1 - y0) * 0.45, (z1 - z0) * 0.45)
    X, Y, Z = (x0, x1), (y0, y1), (z0, z1)
    Xi, Yi, Zi = (x0 + c, x1 - c), (y0 + c, y1 - c), (z0 + c, z1 - c)
    V, idx = [], {}

    def v(kind, i, j, k):
        key = (kind, i, j, k)
        if key not in idx:
            idx[key] = len(V)
            V.append({'x': (X[i], Yi[j], Zi[k]), 'y': (Xi[i], Y[j], Zi[k]), 'z': (Xi[i], Yi[j], Z[k])}[kind])
        return idx[key]

    T = []

    def q(a, b, c_, d):
        T.append((a, b, c_))
        T.append((a, c_, d))

    for i in (0, 1):
        q(v('x', i, 0, 0), v('x', i, 1, 0), v('x', i, 1, 1), v('x', i, 0, 1))
        q(v('y', 0, i, 0), v('y', 1, i, 0), v('y', 1, i, 1), v('y', 0, i, 1))
        q(v('z', 0, 0, i), v('z', 1, 0, i), v('z', 1, 1, i), v('z', 0, 1, i))
    for i in (0, 1):
        for j in (0, 1):
            q(v('x', i, j, 0), v('y', i, j, 0), v('y', i, j, 1), v('x', i, j, 1))
            q(v('x', i, 0, j), v('z', i, 0, j), v('z', i, 1, j), v('x', i, 1, j))
            q(v('y', 0, i, j), v('z', 0, i, j), v('z', 1, i, j), v('y', 1, i, j))
    for i in (0, 1):
        for j in (0, 1):
            for k in (0, 1):
                T.append((v('x', i, j, k), v('y', i, j, k), v('z', i, j, k)))
    m = Mesh(V, T, S=S)
    face_out(m, ((x0 + x1) / 2.0, (y0 + y1) / 2.0, (z0 + z1) / 2.0))
    if col is not None:
        m.C[..., :3] = col
    return m


def ashlar(x0, x1, z0, z1, y, sgn, rs, base=MARBLE, course=1.9, stone=3.6, c=0.09, rel=0.06, gap=None, dark=0.46, holes=None, tone=(0.74, 0.36)):
    """A wall face of cut stone, looking along sgn*y: each stone raised, its edges mitred and chamfered (ten triangles), each its own tone, the joints dark. Staggered courses, as a mason lays them.
    gap(z) -> half width of an opening centred on x = 0; holes = [(x0, x1, z0, z1)] square openings."""
    nc = max(1, int(round((z1 - z0) / course)))
    ch = (z1 - z0) / nc
    V, T, C = [], [], []
    holes = holes or []
    for k in range(nc):
        za, zb = z0 + k * ch, z0 + (k + 1) * ch
        e = [x0]
        x = x0 + stone * (0.55 if k % 2 else 1.0) * rs.uniform(0.86, 1.14)
        while x < x1 - stone * 0.3:
            e.append(x)
            x += stone * rs.uniform(0.84, 1.16)
        e.append(x1)
        blocked = []
        if gap is not None:
            g = max(gap(za), gap((za + zb) / 2.0), gap(zb))
            if g > 0.0:
                blocked.append((-g, g))
        for h0, h1, hz0, hz1 in holes:
            if zb > hz0 and za < hz1:
                blocked.append((h0, h1))
        for a_, b_ in zip(e[:-1], e[1:]):
            pieces = [(a_, b_)]
            for g0, g1 in blocked:
                nxt = []
                for u, w_ in pieces:
                    if g1 <= u or g0 >= w_:
                        nxt.append((u, w_))
                    else:
                        nxt += [(u, min(w_, g0)), (max(u, g1), w_)]
                pieces = nxt
            for u, w_ in pieces:
                if w_ - u < 0.26:
                    continue
                cc = min(c, (w_ - u) * 0.3, (zb - za) * 0.3)
                t_ = tone[0] + tone[1] * rs.rand()
                i0 = len(V)
                for xx, zz in ((u, za), (w_, za), (w_, zb), (u, zb)):
                    V.append((xx, y, zz))
                    C.append(base * t_ * dark)
                for xx, zz in ((u + cc, za + cc), (w_ - cc, za + cc), (w_ - cc, zb - cc), (u + cc, zb - cc)):
                    V.append((xx, y + sgn * rel, zz))
                    C.append(base * t_)
                for q in range(4):
                    a0, b0, c0, d0 = i0 + q, i0 + (q + 1) % 4, i0 + 4 + (q + 1) % 4, i0 + 4 + q
                    T += [(a0, b0, c0), (a0, c0, d0)]
                T += [(i0 + 4, i0 + 5, i0 + 6), (i0 + 4, i0 + 6, i0 + 7)]
    V, T, C = np.array(V), np.array(T), np.array(C)
    m = Mesh(V, T, S=False)
    m.C[..., :3] = C[T]
    return face_dir(m, (0.0, sgn, 0.0))


def moulding(x0, x1, y, z, prof, sgn, col, n=1):
    """A moulding: a profile [(proud, up), ...] swept along x, on a wall face looking along sgn*y."""
    pr = np.asarray(prof, dtype=np.float64)
    xs = np.linspace(x0, x1, n + 1)
    P = np.array([[[xx, y + sgn * d, z + h] for d, h in pr] for xx in xs])
    m = grid(P, S=True)
    face_dir(m, (0.0, sgn, 0.0) if False else (0.0, sgn, 0.3))
    # the soffit faces of a cornice look down, not out
    q = m.corners().mean(axis=1)
    m.C[..., :3] = col
    return join([m, _ends(pr, x0, x1, y, z, sgn, col)])


def _ends(pr, x0, x1, y, z, sgn, col):
    parts = []
    for xx, s_ in ((x0, -1.0), (x1, 1.0)):
        rim = np.array([[xx, y + sgn * d, z + h] for d, h in pr])
        rim = np.vstack([rim, [[xx, y, z + pr[-1, 1]], [xx, y, z + pr[0, 1]]]])
        f = fan(rim, rim.mean(axis=0), S=False)
        face_dir(f, (s_, 0.0, 0.0))
        f.C[..., :3] = col
        parts.append(f)
    return join(parts)


OGEE = [(0.0, 0.0), (0.06, 0.03), (0.08, 0.16), (0.2, 0.2), (0.3, 0.34), (0.34, 0.5), (0.5, 0.52), (0.56, 0.6), (0.56, 0.72), (0.0, 0.72)]
STRING = [(0.0, 0.0), (0.1, 0.05), (0.14, 0.18), (0.14, 0.3), (0.04, 0.36), (0.0, 0.36)]
PLINTH = [(0.34, 0.0), (0.34, 0.5), (0.2, 0.58), (0.14, 0.74), (0.0, 0.8)]


def dentils(x0, x1, y, z, sgn, col, pitch=0.5, w=0.24, d=0.14, h=0.2):
    """A row of small square blocks under a cornice."""
    parts = []
    n = int((x1 - x0) / pitch)
    for i in range(n):
        x = x0 + (i + 0.5) * (x1 - x0) / n
        a, b = (y, y + sgn * d) if sgn > 0 else (y + sgn * d, y)
        parts.append(box(x - w / 2.0, x + w / 2.0, a, b, z, z + h, S=False))
    m = join(parts)
    # no back faces or tops: nothing sees them
    keep = (m.face_normals()[:, 2] < 0.5) & (m.face_normals()[:, 1] * sgn > -0.5)
    m.T, m.C, m.S = m.T[keep], m.C[keep], m.S[keep]
    m.C[..., :3] = col
    return m


def weather(m, seed=1, moss=0.6, stain=0.6, low=4.0, gild=None):
    """Age on what the colours already are: dark stains running down from every ledge, a warm patina in blotches, moss in what faces up and creeping up from the foot, pale barnacle crust low down."""
    pn = Perlin3(seed)
    P = m.corners()
    n = m.face_normals()[:, None, :]
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    col = m.C[..., :3].copy()
    warm = 0.5 + 0.5 * pn.fbm(x * 0.09, y * 0.09, z * 0.09, 3)
    col = col * (0.8 + 0.3 * warm)[..., None]
    col = mix(col, col * np.array([1.0, 0.86, 0.66]), (0.5 * sstep(0.5, 0.8, warm))[..., None])
    streak = sstep(0.42, 0.7, 0.5 + 0.5 * pn.fbm(x * 0.8, y * 0.8, z * 0.04, 3))
    col = mix(col, col * np.array([0.46, 0.5, 0.46]), (stain * streak * (0.5 + 0.5 * sstep(0.2, 0.7, 0.5 + 0.5 * pn.fbm(x * 0.2, y * 0.2, z * 0.2, 2))))[..., None])
    up = sstep(0.1, 0.8, n[..., 2])
    foot = sstep(low, 0.0, z - z.min())
    patch = sstep(0.36, 0.6, 0.5 + 0.5 * pn.fbm(x * 0.3, y * 0.3, z * 0.3, 4))
    fine = 0.5 + 0.5 * pn.fbm(x * 1.7, y * 1.7, z * 1.7, 2)
    w = np.clip(up * 1.2 + foot * 0.85 + 0.22, 0, 1) * patch * moss * (0.5 + 0.7 * fine)
    col = mix(col, mix(hexc('#2e4a30'), hexc('#6d8a3e'), fine[..., None]), np.clip(w, 0, 1)[..., None])
    fleck = sstep(0.72, 0.84, 0.5 + 0.5 * pn(x * 3.6, y * 3.6, z * 3.6)) * foot
    col = mix(col, hexc('#a39d8a'), (0.55 * fleck)[..., None])
    m.C[..., :3] = col
    return m


def fluted(z0, z1, r0, r1, drums, segs, rs, broken=None, lean=0.05):
    """A fluted shaft of stacked drums, entasis across the whole height, the arrises sharp, each drum a hand out of true. broken(theta) gives a jagged top."""
    parts = []
    H = z1 - z0
    edges = np.linspace(z0, z1, drums + 1)
    th = np.linspace(0, TAU, segs, endpoint=False)
    kf = 1.0 - 0.1 * (np.arange(segs) % 2)

    def rad(z):
        t = (z - z0) / H
        return (r0 + (r1 - r0) * t) * (1.0 + 0.03 * math.sin(math.pi * min(t * 1.5, 1.0)))

    for d in range(drums):
        a, b = edges[d], edges[d + 1]
        ox, oy = rs.uniform(-lean, lean) * (d + 1) * 0.5, rs.uniform(-lean, lean) * (d + 1) * 0.5
        rows = [(a, rad(a) * 0.955), (a + 0.1, rad(a + 0.1)), (b, rad(b))]
        P = np.stack([np.stack([r * kf * np.cos(th) + ox, r * kf * np.sin(th) + oy, np.full(segs, z)], 1) for z, r in rows], 0)
        if broken is not None and d == drums - 1:
            P[2, :, 2] += broken(th)
        g_ = grid(P, wrap_v=True, flip=True)
        parts.append(g_)
    t_ = fan(P[-1], P[-1].mean(axis=0) + np.array([0, 0, -0.1 if broken is not None else 0.0]), S=False)
    if t_.face_normals()[0, 2] < 0:
        t_ = t_.flip()
    parts.append(t_)
    return join(parts)


def attic_base(r, z0, S=12, square=True):
    """An Attic base: a square plinth, torus, scotia, torus."""
    k = r / 1.26
    prof = [(1.5, 0.36), (1.56, 0.46), (1.54, 0.62), (1.42, 0.7), (1.3, 0.76), (1.26, 0.92), (1.34, 1.0), (1.34, 1.08), (1.26, 1.14)]
    parts = [lathe([(a * k, z0 + b * k) for a, b in prof], S)]
    if square:
        parts.append(bevel_box(-1.7 * k, 1.7 * k, -1.7 * k, 1.7 * k, z0 - 1.1, z0 + 0.36 * k, c=0.07))
    return join(parts)


def capital(z, r, R, S=12):
    """A capital: the shaft's neck, an echinus swelling out, a ring of egg-and-dart in the corners' colour, a square abacus with chamfered edges."""
    prof = [(r * 0.98, z), (r * 1.04, z + 0.12), (r * 1.0, z + 0.2), (r * 1.26, z + 0.52), (R * 0.94, z + 0.82), (R * 0.98, z + 0.92)]
    e = lathe(prof, S)
    a = bevel_box(-R, R, -R, R, z + 0.9, z + 1.3, c=0.08)
    return join([e, a])


# ---------------------------------------------------------------- Thalor: marble
def column():
    """A marble column of the great order: an Attic base, twelve flutes on five drums, a moulded capital, weather in every flute."""
    rs = np.random.RandomState(31)
    H = 14.0
    m = join([attic_base(1.26, 0.0), fluted(1.42, H - 1.3, 1.26, 1.04, 5, 24, rs), capital(H - 1.34, 1.02, 1.62)])
    m.C[..., :3] = MARBLE
    return weather(m, 31, 0.6, 0.7)


def column_broken():
    rs = np.random.RandomState(32)
    r2 = np.random.RandomState(33)
    knots = r2.uniform(-1.0, 1.1, 9)
    th0 = np.linspace(0, TAU, 9)
    knots[-1] = knots[0]
    edge = lambda th: np.interp(th, th0, knots) + r2.uniform(-0.1, 0.1, th.shape)
    m = join([attic_base(1.26, 0.0), fluted(1.42, 8.0, 1.26, 1.14, 3, 24, rs, broken=edge)])
    m.C[..., :3] = MARBLE
    return weather(m, 32, 0.8, 0.7)


def column_fallen():
    """Drums where they fell, in a line that has lost its order, sunk in the silt; the capital beyond them."""
    rs = np.random.RandomState(34)
    parts = []
    y = -6.2
    for d in range(4):
        L = rs.uniform(2.2, 3.0)
        s_ = fluted(0.0, L, 1.2 - d * 0.05, 1.15 - d * 0.05, 1, 20, rs, lean=0.0)
        b_ = fan(np.stack([1.2 * np.cos(np.linspace(0, TAU, 10, endpoint=False)), 1.2 * np.sin(np.linspace(0, TAU, 10, endpoint=False)), np.full(10, 0.02)], 1), (0, 0, 0.02), flip=True, S=False)
        m = join([s_, b_]).rot('x', -math.pi / 2 + rs.uniform(-0.09, 0.09)).rot('z', rs.uniform(-0.16, 0.16))
        parts.append(m.moved(rs.uniform(-0.55, 0.55), y, 1.0 + rs.uniform(-0.1, 0.12)))
        y += L + rs.uniform(0.25, 0.8)
    parts.append(capital(-0.6, 1.02, 1.62).rot('x', 1.4).rot('z', 0.5).moved(1.5, y + 0.7, 0.86))
    m = join(parts)
    m.C[..., :3] = MARBLE
    return weather(m, 34, 0.9, 0.6, low=2.5)


def voussoirs(hw, spring, top, t, width=1.15, n=9, col=MARBLE, rs=None):
    """The ring of wedge stones round an arch, each with chamfered faces, standing proud of the wall, a keystone at the crown; jamb stones below."""
    rs = rs or np.random.RandomState(9)
    parts = []
    y0, y1 = -t / 2.0 - 0.12, t / 2.0 + 0.12
    ra, rb = hw, top - spring
    for i in range(n):
        a0 = math.pi * i / n + 0.012
        a1 = math.pi * (i + 1) / n - 0.012
        key = i == n // 2
        w_ = width * (1.3 if key else 1.0)
        ring = [(ra * math.cos(a0), spring + rb * math.sin(a0)), ((ra + w_) * math.cos(a0), spring + (rb + w_) * math.sin(a0)), ((ra + w_) * math.cos(a1), spring + (rb + w_) * math.sin(a1)), (ra * math.cos(a1), spring + rb * math.sin(a1))]
        c_ = np.mean(ring, axis=0)
        inset = [c_ + (np.array(q) - c_) * 0.9 for q in ring]
        P = []
        for yy, shape in ((y0 + 0.07, inset), (y0, ring), (y1, ring), (y1 - 0.07, inset)):
            P.append([[q[0], yy - (0.08 if key and yy < 0 else 0.0), q[1]] for q in shape])
        P = np.array(P)
        s_ = grid(P, wrap_v=True, S=False)
        f = Mesh(P[0], [[0, 1, 2], [0, 2, 3]], S=False)
        b = Mesh(P[3], [[0, 2, 1], [0, 3, 2]], S=False)
        m = join([s_, f, b])
        face_out(m, (c_[0], 0.0, c_[1]))
        m.C[..., :3] = col * (0.88 + 0.22 * rs.rand())
        parts.append(m)
    for sgn in (-1, 1):
        nj = int(spring / 1.5)
        for j in range(nj):
            a, b = j * spring / nj, (j + 1) * spring / nj
            x0, x1 = (sgn * hw, sgn * (hw + width * (1.0 if j % 2 else 0.8))) if sgn > 0 else (sgn * (hw + width * (1.0 if j % 2 else 0.8)), sgn * hw)
            parts.append(bevel_box(x0, x1, y0, y1, a + 0.01, b - 0.01, c=0.06, col=col * (0.88 + 0.2 * rs.rand())))
    return join(parts)


def window_unit(x, z0, z1, hw, y, sgn, glass, frame, depth=0.5, arched=True, proud=0.1, fw=0.2, sill=True):
    """A window with real depth, on a face looking along sgn*y: a stone frame standing proud, a reveal going back into the wall, the light at the back of it, a sill under. The hole in the ashlar is cut by the caller."""
    if arched:
        spring = z1 - hw * 1.1
        pts = [(x - hw, z0), (x + hw, z0), (x + hw, spring), (x + hw * 0.62, spring + hw * 0.82), (x, z1), (x - hw * 0.62, spring + hw * 0.82), (x - hw, spring)]
    else:
        pts = [(x - hw, z0), (x + hw, z0), (x + hw, z1), (x - hw, z1)]
    c = np.mean(pts, axis=0)
    out = [(c[0] + (p[0] - c[0]) * (1.0 + fw / hw), c[1] + (p[1] - c[1]) * (1.0 + fw / max(z1 - z0, 0.1) * 2.0)) for p in pts]
    F = np.array([[p[0], y + sgn * proud, p[1]] for p in out])
    I = np.array([[p[0], y + sgn * proud, p[1]] for p in pts])
    B = np.array([[p[0], y - sgn * depth, p[1]] for p in pts])
    O = np.array([[p[0], y, p[1]] for p in out])
    fr = grid(np.stack([F, I], 0), wrap_v=True, S=False)
    face_dir(fr, (0.0, sgn, 0.0))
    ou = grid(np.stack([O, F], 0), wrap_v=True, S=False)
    nv = ou.corners().mean(axis=1) - np.array([c[0], y, c[1]])
    k = np.sum(ou.face_normals() * nv, axis=1) < 0
    ou.T[k] = ou.T[k][:, ::-1]
    re = grid(np.stack([I, B], 0), wrap_v=True, S=False)
    nv = np.array([c[0], y, c[1]]) - re.corners().mean(axis=1)
    k = np.sum(re.face_normals()[:, [0, 2]] * nv[:, [0, 2]], axis=1) < 0
    re.T[k] = re.T[k][:, ::-1]
    fr.C[..., :3] = frame
    ou.C[..., :3] = frame * 0.9
    re.C[..., :3] = frame * 0.62
    g = fan(B, B.mean(axis=0), S=False)
    face_dir(g, (0.0, sgn, 0.0))
    g.C[..., :3] = glass
    if not sill:
        return join([fr, ou, re, g])
    sl = bevel_box(x - hw - fw * 1.3, x + hw + fw * 1.3, min(y, y + sgn * (proud + 0.16)), max(y, y + sgn * (proud + 0.16)), z0 - 0.2, z0 - 0.02, c=0.03, col=frame)
    return join([fr, ou, re, g, sl])


def wall_core(w, h, t, rs, base=MARBLE, course=1.9, gap=None, foot=1.0, stone=3.6, plinth=True, holes=None):
    """A wall's two faces of cut stone and its ends. The core between the faces is never seen, so it isn't made."""
    parts = [ashlar(-w / 2.0, w / 2.0, 0.0, h, -t / 2.0, -1.0, rs, base, course, stone, gap=gap, holes=holes), ashlar(-w / 2.0, w / 2.0, 0.0, h, t / 2.0, 1.0, rs, base, course, stone, gap=gap, holes=holes)]
    for sx in (-1, 1):
        e = box(sx * w / 2.0 - 0.02, sx * w / 2.0 + 0.02, -t / 2.0, t / 2.0, 0.0, h, S=False, nz=1)
        e.C[..., :3] = base * 0.9
        parts.append(e)
    if plinth:
        parts.append(box(-w / 2.0, w / 2.0, -t / 2.0 - 0.04, t / 2.0 + 0.04, -foot, 0.02).tinted(base * 0.8))
    return parts


def wall_bay():
    """A bay of a Thalor house: ashlar on both faces, a plinth moulding, a tall arched door with its jambs and voussoirs, a string course with a gold band, two small windows with deep reveals, a dentilled cornice."""
    rs = np.random.RandomState(35)
    w, h, t = 12.0, 14.0, 1.8
    hw, spring, top = 2.5, 6.2, 8.8

    def gap(z):
        if z < 0.0 or z > top + 0.3:
            return 0.0
        if z < spring:
            return hw + 0.3
        return (hw + 0.3) * math.sqrt(max(1.0 - ((z - spring) / (top + 0.3 - spring)) ** 2, 0.0))

    holes = [(x - 0.74, x + 0.74, 10.66, 12.74) for x in (-3.4, 3.4)]
    parts = wall_core(w, h, t, rs, gap=gap, holes=holes, course=2.15, stone=4.2)
    parts.append(voussoirs(hw, spring, top, t, rs=rs, n=7))
    for sgn in (-1, 1):
        y = sgn * (t / 2.0 + 0.05)
        parts.append(moulding(-w / 2.0, -hw - 1.2, y, 0.0, PLINTH, sgn, MARBLE * 0.92))
        parts.append(moulding(hw + 1.2, w / 2.0, y, 0.0, PLINTH, sgn, MARBLE * 0.92))
        parts.append(moulding(-w / 2.0, w / 2.0, y, 9.86, STRING, sgn, GOLD * 0.9))
        parts.append(moulding(-w / 2.0 - 0.02, w / 2.0 + 0.02, y, h - 0.34, OGEE, sgn, MARBLE * 1.04))
        parts.append(dentils(-w / 2.0 + 0.1, w / 2.0 - 0.1, y, h - 0.58, sgn, MARBLE * 0.96, pitch=1.5))
        for x in (-3.4, 3.4):                                            # the upper windows: a recessed dark light, a lintel and a sill
            yf = sgn * (t / 2.0 + 0.0)
            parts.append(window_unit(x, 10.7, 12.7, 0.7, yf, sgn, hexc('#0d1314'), MARBLE * 0.98, depth=0.5, arched=False))
    top_ = box(-w / 2.0, w / 2.0, -t / 2.0 - 0.1, t / 2.0 + 0.1, h + 0.3, h + 0.4, S=False).tinted(MARBLE)
    parts.append(top_)
    m = weather(join(parts), 35, 0.6, 0.7)
    # solids from the wall's own numbers: two piers, the mass over the door, the arch's shoulders. The door stays open
    pier = (w / 2.0 - (hw + 0.2)) / 2.0
    m.col_list = [{'t': 'box', 'x': sx * (hw + 0.2 + pier), 'y': 0.0, 'z0': -1.0, 'z1': h + 0.4, 'hx': pier, 'hy': t / 2.0 + 0.06} for sx in (-1, 1)]
    m.col_list.append({'t': 'box', 'x': 0.0, 'y': 0.0, 'z0': top + 0.1, 'z1': h + 0.4, 'hx': hw + 0.2, 'hy': t / 2.0 + 0.06})
    for sx in (-1, 1):
        m.col_list.append({'t': 'box', 'x': sx * (hw - 0.3), 'y': 0.0, 'z0': spring + 1.4, 'z1': top + 0.1, 'hx': 0.5, 'hy': t / 2.0 + 0.06})
    return m


def wall_broken():
    """What an earthquake left: the same cut stone, stepped down to one end, each stone a chamfered block, some lying at the foot."""
    rs = np.random.RandomState(36)
    pn = Perlin3(36)
    w, t = 12.0, 1.8
    parts = [box(-w / 2.0, w / 2.0, -t / 2.0 - 0.04, t / 2.0 + 0.04, -1.0, 0.02).tinted(MARBLE * 0.8)]
    ch = 1.45
    for c in range(7):
        z0, z1 = c * ch, (c + 1) * ch
        x = -w / 2.0 + (1.5 if c % 2 else 0.0)
        while x < w / 2.0 - 0.3:
            L = rs.uniform(2.4, 3.6)
            a, b = max(x, -w / 2.0), min(x + L, w / 2.0)
            xm = (a + b) / 2.0
            tops = 1.6 + 8.6 * float(sstep(5.8, -3.8, xm + 1.1 * math.sin(xm * 1.3))) + 1.4 * float(pn(xm * 0.32, 0.5, 0.5))
            if (z0 + z1) / 2.0 < tops:
                parts.append(bevel_box(a + 0.015, b - 0.015, -t / 2.0 + rs.uniform(-0.05, 0.05), t / 2.0 + rs.uniform(-0.05, 0.05), z0 + 0.01, z1 - 0.01, c=0.07, col=MARBLE * (0.84 + 0.26 * rs.rand())))
            x += L
    for i in range(5):
        cx, cy = rs.uniform(-1.0, 6.0), rs.uniform(-3.4, 3.4)
        if abs(cy) < 1.2:
            cy += 1.4 * (1 if cy >= 0 else -1)
        b = bevel_box(-0.9, 0.9, -0.5, 0.5, -0.45, 0.45, c=0.08, col=MARBLE * (0.84 + 0.2 * rs.rand())).rot('x', rs.uniform(-0.5, 0.5)).rot('y', rs.uniform(-0.5, 0.5)).rot('z', rs.uniform(0, 3.0))
        parts.append(b.moved(cx, cy, 0.25))
    m = join(parts)
    return weather(m, 36, 0.85, 0.6)


def arch():
    """A triumphal arch across an avenue: an ashlar mass, a deep barrel, four engaged fluted columns on pedestals, a gold frieze under a dentilled cornice, an attic with a carved tablet."""
    rs = np.random.RandomState(37)
    w, t = 20.0, 6.0
    H0 = 14.5
    hw, spring, top = 5.0, 9.5, 14.0

    def gap(z):
        if z > top + 0.3:
            return 0.0
        return hw + 0.3 if z < spring else (hw + 0.3) * math.sqrt(max(1.0 - ((z - spring) / (top + 0.3 - spring)) ** 2, 0.0))

    parts = wall_core(w, H0, t, rs, gap=gap, stone=3.8)
    parts.append(voussoirs(hw, spring, top, t, width=1.25, n=9, rs=rs))
    # the barrel: its soffit
    n = 9
    th = np.linspace(math.pi, 0.0, n)
    Ps = np.array([[[hw * math.cos(a), yy, spring + (top - spring) * math.sin(a)] for a in th] for yy in (-t / 2.0, t / 2.0)])
    so = grid(Ps, S=True)
    face_dir(so, (0.0, 0.0, -1.0))
    so.C[..., :3] = MARBLE * 0.7
    parts.append(so)
    for sy in (-1, 1):
        y = sy * (t / 2.0 + 0.05)
        for sx in (-1, 1):
            cx, cy = sx * 7.6, sy * (t / 2.0 + 0.42)
            parts.append(bevel_box(cx - 1.0, cx + 1.0, cy - 0.95, cy + 0.95, -1.0, 1.9, c=0.08).tinted(MARBLE * 0.96))      # the pedestal
            parts.append(attic_base(0.62, 2.1, S=10, square=False).moved(cx, cy, 0.0))
            parts.append(fluted(2.72, H0 - 1.04, 0.62, 0.52, 2, 12, rs, lean=0.02).moved(cx, cy, 0.0).tinted(MARBLE))
            parts.append(capital(H0 - 1.06, 0.52, 0.95, S=10).moved(cx, cy, 0.0))
        parts.append(moulding(-w / 2.0 - 0.4, w / 2.0 + 0.4, y + sy * 0.4, H0 + 0.26, [(0.0, 0.0), (0.12, 0.06), (0.14, 0.9), (0.04, 0.96), (0.0, 0.96)], sy, GOLD))    # the frieze
        parts.append(moulding(-w / 2.0 - 0.7, w / 2.0 + 0.7, y + sy * 0.4, H0 + 1.22, OGEE, sy, MARBLE * 1.04))
        parts.append(dentils(-w / 2.0 - 0.4, w / 2.0 + 0.4, y + sy * 0.4, H0 + 1.0, sy, MARBLE * 0.95, pitch=1.1))
    parts.append(box(-w / 2.0 - 0.4, w / 2.0 + 0.4, -t / 2.0 - 0.44, t / 2.0 + 0.44, H0 + 0.02, H0 + 0.26, S=False).tinted(MARBLE * 0.85))
    attic = wall_core(w - 2.0, 3.6, t - 0.8, rs, stone=4.2, plinth=False)
    parts += [p.moved(0.0, 0.0, H0 + 1.94) for p in attic]
    parts.append(box(-w / 2.0 + 0.6, w / 2.0 - 0.6, -t / 2.0 + 0.1, t / 2.0 - 0.1, H0 + 5.54, H0 + 5.9, S=False).tinted(MARBLE))
    for sy in (-1, 1):
        y = sy * (t / 2.0 - 0.4 + 0.02)
        a, b = (y, y + 0.16) if sy > 0 else (y - 0.16, y)
        parts.append(bevel_box(-5.6, 5.6, a, b, H0 + 2.4, H0 + 4.9, c=0.06).tinted(MARBLE * 1.02))
        for k, z in enumerate((H0 + 4.3, H0 + 3.8, H0 + 3.3, H0 + 2.9)):      # the worn inscription: lines of cut letters
            L = (4.4, 4.9, 3.8, 4.2)[k]
            parts.append(box(-L, L, (b if sy > 0 else a - 0.01), (b + 0.01 if sy > 0 else a), z, z + 0.16, S=False).tinted(hexc('#5c584c')))
    m = weather(join(parts), 37, 0.55, 0.7)
    pier = (w / 2.0 - hw) / 2.0
    m.col_list = [{'t': 'box', 'x': sx * (hw + pier), 'y': 0.0, 'z0': -1.0, 'z1': H0 + 1.9, 'hx': pier, 'hy': t / 2.0} for sx in (-1, 1)]
    m.col_list.append({'t': 'box', 'x': 0.0, 'y': 0.0, 'z0': top + 0.1, 'z1': H0 + 1.9, 'hx': hw, 'hy': t / 2.0})
    m.col_list.append({'t': 'box', 'x': 0.0, 'y': 0.0, 'z0': H0 + 1.9, 'z1': H0 + 5.9, 'hx': w / 2.0 - 0.6, 'hy': t / 2.0 - 0.1})
    for sx in (-1, 1):
        m.col_list.append({'t': 'box', 'x': sx * (hw - 0.5), 'y': 0.0, 'z0': spring + 2.6, 'z1': top + 0.1, 'hx': 0.7, 'hy': t / 2.0})
    return m


def stair():
    """A monumental flight, one sweep of worn treads with rounded noses, dished in the middle by feet, its cheek walls of cut stone. Origin at the foot of the flight's middle."""
    rs = np.random.RandomState(38)
    w, n, rise, run = 20.0, 14, 0.44, 1.0
    xs = np.linspace(-w / 2.0, w / 2.0, 7)
    rows = []
    y0 = -n * run / 2.0
    for i in range(n):
        y = y0 + i * run
        rows += [(y, i * rise), (y, (i + 1) * rise - 0.06), (y + 0.06, (i + 1) * rise), (y + run, (i + 1) * rise)]
    P = np.zeros((len(rows), len(xs), 3))
    for r_, (y, z) in enumerate(rows):
        i_ = r_ // 4
        wear = 0.05 * (1.0 - (xs / (w / 2.0)) ** 2) * (r_ % 4 >= 2)
        P[r_, :, 0] = xs
        P[r_, :, 1] = y
        P[r_, :, 2] = z - wear + 0.015 * rs.rand()
    m = grid(P, S=False)
    face_dir(m, (0.0, -0.4, 1.0))
    C = m.corners()
    m.C[..., :3] = MARBLE * (0.84 + 0.2 * rs.rand(m.tris // 2).repeat(2))[:, None, None]
    parts = [m, box(-w / 2.0, w / 2.0, y0, -y0, -0.9, 0.0, S=False).tinted(MARBLE * 0.7)]
    for s_ in (-1, 1):
        x0, x1 = s_ * (w / 2.0) - 0.9, s_ * (w / 2.0) + 0.9
        parts.append(bevel_box(x0, x1, y0 - 0.5, 0.0, -0.8, n * rise * 0.5 + 0.8, c=0.09).tinted(MARBLE * 0.96))
        parts.append(bevel_box(x0, x1, 0.0, -y0, -0.8, n * rise + 0.9, c=0.09).tinted(MARBLE * 0.96))
    return weather(join(parts), 38, 0.8, 0.5, low=2.0)


def tile_roof(w, d, rise, rows, ripples, c0, c1, rs, hole=None, eave=0.5):
    """A pitched roof of barrel tiles, ridge along x: each row laps the one below, each column a rounded tile, none quite the same tone. Gable ends of stone. Sits with z 0 at the eaves."""
    nx = ripples * 2 + 1
    xs = np.linspace(-w / 2.0 - eave, w / 2.0 + eave, nx)
    parts = []
    for sgn in (-1, 1):
        P = np.zeros((rows * 2, nx, 3))
        for r in range(rows):
            for q, f in enumerate((0.0, 0.92)):
                t = (r + f) / float(rows)
                y = sgn * (d / 2.0 + eave) * (1.0 - t)
                z = rise * (t - 0.0) - eave * rise / (d / 2.0) * (1.0 - t) + (0.05 if q == 0 else -0.04)
                P[r * 2 + q, :, 0] = xs
                P[r * 2 + q, :, 1] = y
                P[r * 2 + q, :, 2] = z + 0.07 * (np.arange(nx) % 2 == 1)
        m = grid(P, S=True)
        nu, nv = P.shape[0] - 1, P.shape[1] - 1
        quad = np.arange(m.tris) // 2
        ru, cv = quad // nv, quad % nv
        tile = fract(np.sin((ru // 2) * 12.9898 + (cv // 2) * 78.233 + sgn) * 43758.5453)
        m.C[..., :3] = mix(c0, c1, tile[:, None, None])
        face_dir(m, (0.0, sgn * 0.3, 1.0))
        if hole is not None:
            fc = m.corners().mean(axis=1)
            keep = ~hole(fc[:, 0], fc[:, 1])
            m.T, m.C, m.S = m.T[keep], m.C[keep], m.S[keep]
        parts.append(m)
    return parts


def roof_slab():
    """A pitched roof of old terracotta tiles on a stone cornice, a corner of it fallen in, so a swimmer can drop into the room below."""
    rs = np.random.RandomState(40)
    S = 26.0
    hole = lambda x, y: np.hypot(x - 6.0, y - 5.0) < 6.5
    parts = tile_roof(S, S, 4.4, 10, 8, hexc('#6d3f2c'), hexc('#a8694a'), rs, hole=hole, eave=0.4)
    for sgn in (-1, 1):
        tri = np.array([[sgn * (S / 2.0), -S / 2.0, 0.0], [sgn * (S / 2.0), S / 2.0, 0.0], [sgn * (S / 2.0), 0.0, 4.4]])
        m = Mesh(tri, [[0, 1, 2]], S=False)
        face_dir(m, (sgn, 0.0, 0.0))
        m.C[..., :3] = MARBLE * 0.85
        parts.append(m)
    parts.append(box(-S / 2.0, S / 2.0, -S / 2.0, S / 2.0, -0.5, 0.0, S=False, nx=2, ny=2).tinted(MARBLE * 0.8))
    m = join(parts)
    m.V[:, 2] += 0.5
    return weather(m, 40, 0.85, 0.5, low=0.5)


def temple_front():
    """A temple's porch: three stepped courses, six fluted columns (one snapped), a three-banded architrave, a gold frieze, a dentilled cornice, a pediment with a gold mosaic and the trident mark; the west end of the roof has come down."""
    rs = np.random.RandomState(39)
    W, D = 34.0, 12.0
    parts = []
    for i in range(3):
        parts.append(bevel_box(-W / 2 - 2.0 + i * 0.8, W / 2 + 2.0 - i * 0.8, -D / 2 - 2.0 + i * 0.8, D / 2, -1.0, 0.55 * (i + 1), c=0.09, col=MARBLE * (0.9 + 0.05 * i)))
    z0 = 1.65
    H = 15.0
    xs = np.linspace(-W / 2 + 2.6, W / 2 - 2.6, 6)
    cy = -D / 2 + 2.0
    for i, x in enumerate(xs):
        parts.append(attic_base(1.2, z0, S=10, square=False).moved(x, cy, 0.0))
        parts.append(bevel_box(x - 1.6, x + 1.6, cy - 1.6, cy + 1.6, z0 - 0.02, z0 + 0.4, c=0.07, col=MARBLE))
        if i == 0:
            parts.append(fluted(z0 + 1.2, z0 + 6.4, 1.2, 1.12, 2, 12, rs, broken=lambda th: 0.8 * np.sin(th * 2.0 + 1.0)).moved(x, cy, 0.0).tinted(MARBLE))
            continue
        parts.append(fluted(z0 + 1.2, z0 + H - 1.1, 1.2, 1.0, 3, 12, rs).moved(x, cy, 0.0).tinted(MARBLE))
        parts.append(capital(z0 + H - 1.3, 1.0, 1.56, S=10).moved(x, cy, 0.0))
    ez = z0 + H
    x_b = xs[1] - 2.4                                                   # where the roof stops
    pz = ez + 2.8
    ph = 5.8
    for sy, y in ((-1, -D / 2 + 0.2), (1, D / 2)):
        parts.append(moulding(x_b, W / 2 - 0.4, y, ez, [(0.0, 0.0), (0.0, 0.34), (0.05, 0.36), (0.05, 0.72), (0.1, 0.74), (0.1, 1.04), (0.16, 1.1), (0.1, 1.2), (0.0, 1.2)], sy, MARBLE))
        parts.append(moulding(x_b + 0.3, W / 2 - 0.2, y, ez + 1.2, [(0.0, 0.0), (0.05, 0.05), (0.05, 1.05), (0.0, 1.1)], sy, GOLD))
        parts.append(moulding(x_b + 0.6, W / 2, y, ez + 2.1, OGEE, sy, MARBLE * 1.04))
        parts.append(dentils(x_b + 0.8, W / 2 - 0.4, y, ez + 1.92, sy, MARBLE * 0.95, pitch=1.1))
    parts.append(box(x_b, W / 2 - 0.4, -D / 2 + 0.3, D / 2, ez + 0.02, ez + 2.8, S=False).tinted(MARBLE * 0.6))
    for k in range(4):                                                  # broken stones of the frieze, still in place past the break
        x0 = x_b - 1.5 - k * 0.2
        parts.append(bevel_box(x0 - 0.2, x0 + 1.5, -D / 2 + 0.5, D / 2 - 0.5, ez, ez + 1.15 - k * 0.1, c=0.09, col=MARBLE * (0.86 + 0.2 * rs.rand())))
    apex = (0.0, pz + ph)
    edge = [(x_b + 3.2, pz + 0.0), (x_b + 2.2, pz + 1.0), (x_b + 3.0, pz + 1.9), (x_b + 2.5, pz + 2.5), (-8.3, pz + 3.0), (-5.0, pz + 4.0)]
    poly = [(W / 2, pz)] + [apex] + edge[::-1]
    Pf = np.array([[x, -D / 2 + 0.34, z] for x, z in poly])
    Pb = np.array([[x, D / 2, z] for x, z in poly])
    fr = fan(Pf, Pf.mean(axis=0), S=False)
    face_dir(fr, (0.0, -1.0, 0.0))
    fr.C[..., :3] = hexc('#a07f38')
    ba = fan(Pb, Pb.mean(axis=0), S=False)
    face_dir(ba, (0.0, 1.0, 0.0))
    ba.C[..., :3] = MARBLE * 0.9
    sd = grid(np.stack([Pf, Pb], 0), wrap_v=True, S=False)
    if np.mean(np.sum(sd.face_normals() * (sd.corners().mean(axis=1) - Pf.mean(axis=0)), axis=1)) < 0:
        sd = sd.flip()
    sd.C[..., :3] = hexc('#8e5d44') * 0.9
    parts += [fr, ba, sd]
    # the raking cornices on the side that stands: a real moulding, up the slope
    for y, sgn in ((-D / 2 - 0.1, -1.0),):
        a = np.array([W / 2 + 0.4, y, pz - 0.2])
        b = np.array([0.0, y, pz + ph + 0.1])
        pr = np.array(OGEE)
        P = []
        for t in (0.0, 1.0):
            o = a + (b - a) * t
            P.append([o + np.array([0.0, sgn * d * 0.9, h * 1.1]) for d, h in pr])
        rk = grid(np.array(P), S=True)
        face_dir(rk, (0.0, -0.6, 0.6))
        rk.C[..., :3] = MARBLE * 1.04
        parts.append(rk)
    # the trident mark, in the gold
    tr = [box(-0.2, 0.2, -D / 2 + 0.2, -D / 2 + 0.34, pz + 0.2, pz + 3.9, S=False)]
    for sx in (-1, 1):
        tr.append(tube([[sx * 0.1, -D / 2 + 0.26, pz + 3.0], [sx * 1.2, -D / 2 + 0.26, pz + 3.4], [sx * 1.3, -D / 2 + 0.26, pz + 4.7]], [0.16, 0.13, 0.03], sides=4))
    tr.append(tube([[0.0, -D / 2 + 0.26, pz + 3.8], [0.0, -D / 2 + 0.26, pz + 5.2]], [0.16, 0.03], sides=4))
    t_ = join(tr)
    t_.C[..., :3] = hexc('#e0bd62')
    m = weather(join(parts), 39, 0.6, 0.7)
    return join([m, t_])


# ---------------------------------------------------------------- Meridon: limestone and gold
def facade(col, seed, base, trim, buttress=False, lancet=False, moss=0.45):
    """A city facade, 16 m wide, 13 m tall, its back to its block or to the rock: two storeys of tall lit windows with real reveals, a balcony on corbels with its rail, a cornice. The look glows the lights; nothing else is that bright."""
    rs = np.random.RandomState(seed)
    w, h, t = 16.0, 13.0, 2.4
    hw = 0.62 if lancet else 0.92
    xs = [-5.2 + i * 2.6 * 2.0 for i in range(3)] if False else [-6.4 + i * 3.2 for i in range(5)]
    rows = ((0.9, 5.0), (7.2, 11.8))
    holes = [(x - hw - 0.08, x + hw + 0.08, z0 - 0.08, z1 + 0.08) for x in xs for z0, z1 in rows]
    parts = [ashlar(-w / 2.0, w / 2.0, 0.0, h, -t / 2.0, -1.0, rs, base, 3.25, 6.0, holes=holes, tone=(0.86, 0.22))]
    back = box(-w / 2.0, w / 2.0, -t / 2.0 + 0.5, t / 2.0, -1.0, h, S=False)
    back.C[..., :3] = base * 0.34                                        # dark, so a joint round a window never shows daylight
    parts.append(back)
    parts.append(box(-w / 2.0, w / 2.0, -t / 2.0, -t / 2.0 + 0.5, -1.0, 0.0, S=False).tinted(base * 0.7))
    y = -t / 2.0 - 0.05
    parts.append(moulding(-w / 2.0 - 0.02, w / 2.0 + 0.02, y, h - 0.32, OGEE, -1.0, trim))
    parts.append(moulding(-w / 2.0, w / 2.0, y, 0.0, PLINTH, -1.0, base * 0.9))
    parts.append(box(-w / 2.0 - 0.2, w / 2.0 + 0.2, -t / 2.0 - 0.5, t / 2.0, h + 0.38, h + 0.5, S=False).tinted(base))
    parts.append(box(-w / 2.0, w / 2.0, -t / 2.0 - 1.5, -t / 2.0, 6.0, 6.34, S=False).tinted(base))       # the balcony: a slab on corbels, posts, a rail
    for x in (-7.0, -3.5, 0.0, 3.5, 7.0):
        parts.append(moulding(x - 0.3, x + 0.3, y, 5.3, [(0.0, 0.0), (0.5, 0.36), (1.3, 0.66), (0.0, 0.7)], -1.0, base * 0.92))
    for x in np.linspace(-w / 2.0 + 0.3, w / 2.0 - 0.3, 7):
        b_ = box(x - 0.09, x + 0.09, -t / 2.0 - 1.45, -t / 2.0 - 1.27, 6.34, 7.26, S=False).tinted(base * 0.96)
        k = np.abs(b_.face_normals()[:, 2]) < 0.5
        b_.T, b_.C, b_.S = b_.T[k], b_.C[k], b_.S[k]
        parts.append(b_)
    parts.append(box(-w / 2.0, w / 2.0, -t / 2.0 - 1.52, -t / 2.0 - 1.2, 7.25, 7.45, S=False).tinted(trim))
    if buttress:                                                        # Vesper: fins of rock between the windows, stepping out at the foot
        for x in (-7.9, -4.8, -1.6, 1.6, 4.8, 7.9):
            parts.append(box(x - 0.34, x + 0.34, -t / 2.0 - 0.9, -t / 2.0 + 0.1, -0.8, 5.8, S=False).tinted(base * 0.9))
            parts.append(box(x - 0.26, x + 0.26, -t / 2.0 - 0.56, -t / 2.0 + 0.1, 5.8, h, S=False).tinted(base * 0.9))
    m = weather(join(parts), seed, moss, 0.6)
    win = [window_unit(x, z0, z1, hw, -t / 2.0, -1.0, col, trim * 0.96, depth=0.42, arched=True, sill=False) for x in xs for z0, z1 in rows]
    return join([m] + win)


def wall_windows():
    return facade(GOLDLIT, 71, LIME, OLDGOLD)


def wall_windows_cold():
    return facade(COLDLIT, 72, DARK, hexc('#5a6470'), buttress=True, lancet=True, moss=0.25)


def dome_hall():
    """Meridon's domed hall: a twelve-sided drum on a moulded base, pilasters between tall windows with real reveals, a gilded cornice, a ribbed copper dome with a gold lantern. 36 m across, 34 m tall."""
    rs = np.random.RandomState(73)
    N = 12
    R = 18.0
    a_w = TAU / N
    sides = []
    w_side = 2.0 * R * math.tan(a_w / 2.0)
    wins = []
    rows = ((3.2, 9.4), (12.0, 16.8))
    for i in range(N):
        a = i * a_w
        lit = []
        holes = [(-1.7, 1.7, z0 - 0.08, z1 + 0.08) for z0, z1 in rows]
        s_ = [ashlar(-w_side / 2.0, w_side / 2.0, 0.0, 19.0, 0.0, -1.0, rs, LIME, 4.75, 7.0, holes=holes, tone=(0.86, 0.2))]
        s_.append(bevel_box(-w_side / 2.0 - 0.05, -w_side / 2.0 + 0.85, -0.5, 0.2, -1.0, 19.0, c=0.1, col=LIME * 1.02))     # the pilaster
        s_.append(moulding(-w_side / 2.0, w_side / 2.0, -0.05, 10.8, STRING, -1.0, OLDGOLD))
        m_ = join(s_)
        wn = join([window_unit(0.0, z0, z1, 1.62, 0.0, -1.0, GOLDLIT, OLDGOLD, depth=0.6) for z0, z1 in rows])
        c_, s2 = math.cos(a), math.sin(a)
        for mesh in (m_, wn):
            mesh.V = mesh.V + np.array([0.0, -R, 0.0])
        sides.append(m_.rot('z', a))
        wins.append(wn.rot('z', a))
    drum = join(sides)
    # the plinth and the cornice, turned
    pl = lathe([(R + 2.6, -1.2), (R + 2.6, 1.0), (R + 1.2, 1.2), (R + 1.1, 2.0), (R + 0.2, 2.3), (R, 2.4)], N, S=False, start=a_w / 2.0)
    pl.C[..., :3] = LIME * 0.9
    co = lathe([(R, 19.0), (R + 0.7, 19.2), (R + 0.75, 19.8), (R + 1.2, 20.1), (R + 1.2, 20.5), (R * 0.9, 20.6)], N * 2, S=False, start=a_w / 2.0)
    co.C[..., :3] = OLDGOLD
    # the dome: copper gone green, ribs of gold
    segs = 20
    th = np.linspace(0, TAU, segs, endpoint=False)
    prof = []
    for a in np.linspace(0.0, 1.0, 8):
        q = a * math.pi / 2.0 * 0.94
        prof.append((R * 0.97 * math.cos(q), 20.5 + 14.0 * math.sin(q)))
    D = np.array([np.stack([r * np.cos(th), r * np.sin(th), np.full(segs, z)], 1) for r, z in prof])
    dome = grid(D, wrap_v=True, S=True, flip=True)
    pn = Perlin3(73)
    Cc = dome.corners()
    v = 0.5 + 0.5 * pn.fbm(Cc[..., 0] * 0.1, Cc[..., 1] * 0.1, Cc[..., 2] * 0.1, 3)
    streak = 0.5 + 0.5 * pn.fbm(Cc[..., 0] * 0.5, Cc[..., 1] * 0.5, Cc[..., 2] * 0.06, 2)
    dome.C[..., :3] = mix(mix(hexc('#2f5850'), hexc('#6a9a84'), v[..., None]), hexc('#7a5a30'), (0.35 * sstep(0.55, 0.8, streak))[..., None])
    ribs = []
    for k in range(N):
        a = k * a_w + a_w / 2.0
        rp = [(r * 1.012 * math.cos(a), r * 1.012 * math.sin(a), z) for r, z in prof[:7]]
        t_ = tube(rp, np.linspace(0.3, 0.14, 7), sides=3, cap_end=False)
        t_.C[..., :3] = GOLD * 0.86
        ribs.append(t_)
    z_t, r_t = prof[-1][1], prof[-1][0]
    lan = lathe([(r_t, z_t), (2.6, z_t + 0.3), (2.6, z_t + 0.6), (2.5, z_t + 3.0), (3.0, z_t + 3.2), (3.0, z_t + 3.6), (1.2, z_t + 5.0), (0.3, z_t + 7.0), (0.06, z_t + 8.0)], 12)
    lan.C[..., :3] = mix(hexc('#2f5850'), GOLD * 0.8, 0.5)
    m = weather(join([drum, pl]), 73, 0.35, 0.5)
    glow = lathe([(2.62, z_t + 0.7), (2.56, z_t + 2.9)], 12)
    glow.C[..., :3] = GOLDLIT
    return join([m, co, dome, lan, glow] + ribs + wins)


def tower_of(col, seed, base=LIME, trim=OLDGOLD, cap_col=None):
    """A tall slender tower of nine storeys, tapering: real cut stone and deep windows on the two storeys a swimmer passes close to, plain courses above with lancets set in them, moulded bands, three balconies, a colonnaded lantern and a spire. 66 m tall."""
    rs = np.random.RandomState(seed)
    H = 56.0
    N = 8
    parts, lit = [], []
    circ = 1.0 / math.cos(TAU / N / 2.0)
    parts.append(lathe([(5.3, -1.0), (5.3, 0.3), (4.8, 0.7), (4.7, 2.0), (4.55 * circ * 0.99, 2.4), (4.5 * circ, 3.0)], N, S=False, start=TAU / 16.0).tinted(base * 0.9))
    th = np.linspace(0, TAU, N, endpoint=False) + TAU / 16.0
    for i in range(9):
        z0, z1 = 3.0 + i * 5.7, 3.0 + (i + 1) * 5.7
        r0, r1 = 4.5 - 0.22 * i, 4.5 - 0.22 * (i + 1)
        if i < 2:
            wf, wt = 2.0 * r0 * math.tan(TAU / N / 2.0), 2.0 * r1 * math.tan(TAU / N / 2.0)
            for k in range(N):
                a = k * TAU / N
                on_win = k % 2 == 0
                hl = [(-0.62, 0.62, z0 + 1.3, z1 - 1.3)] if on_win else None
                f = ashlar(-wf / 2.0, wf / 2.0, z0, z1, 0.0, -1.0, rs, base, 2.85, 4.0, holes=hl, tone=(0.86, 0.2), rel=0.04, c=0.07)
                f.V[:, 0] *= 1.0 - (1.0 - wt / wf) * (f.V[:, 2] - z0) / (z1 - z0)
                f.V[:, 1] += -r0 + (r0 - r1) * (f.V[:, 2] - z0) / (z1 - z0)
                parts.append(f.rot('z', a))
                if on_win:
                    w_ = window_unit(0.0, z0 + 1.34, z1 - 1.34, 0.56, 0.0, -1.0, col, trim, depth=0.36, proud=0.06, fw=0.14, sill=False)
                    w_.V[:, 1] += -(r0 + r1) / 2.0
                    lit.append(w_.rot('z', a))
        else:
            P = np.array([np.stack([r * circ * np.cos(th), r * circ * np.sin(th), np.full(N, z)], 1) for z, r in ((z0, r0), (z1, r1))])
            g_ = grid(P, wrap_v=True, S=False, flip=True)
            g_.C[..., :3] = base * (0.84 + 0.2 * rs.rand())
            parts.append(g_)
            for k in range(0, N, 2):                                     # a lancet, set flat in the stone, its lintel a shade dark
                a = k * TAU / N
                rm = (r0 + r1) / 2.0 + 0.03
                q = Mesh([(-0.5, -rm, z0 + 1.3), (0.5, -rm, z0 + 1.3), (0.5, -rm, z1 - 1.8), (0.0, -rm, z1 - 1.2), (-0.5, -rm, z1 - 1.8)], [[0, 1, 2], [0, 2, 3], [0, 3, 4]], S=False)
                face_dir(q, (0.0, -1.0, 0.0))
                q.C[..., :3] = col
                lit.append(q.rot('z', a))
        band = lathe([(r1 * circ * 0.99, z1 - 0.1), (r1 * circ * 1.05, z1), (r1 * circ * 1.05, z1 + 0.2), (r1 * circ * 0.99, z1 + 0.3)], N, S=False, start=TAU / 16.0)
        band.C[..., :3] = trim
        parts.append(band)
        if i in (2, 5, 8):                                               # a balcony, with its rail
            b = lathe([(r1 * circ, z1 - 0.6), (r1 * circ + 1.3, z1 + 0.1), (r1 * circ + 1.3, z1 + 0.3), (r1 * circ, z1 + 0.32)], N, S=False, start=TAU / 16.0)
            b.C[..., :3] = base
            rail = lathe([(r1 * circ + 1.2, z1 + 0.34), (r1 * circ + 1.24, z1 + 1.1), (r1 * circ + 1.06, z1 + 1.14), (r1 * circ + 1.02, z1 + 0.34)], N, S=False, start=TAU / 16.0)
            rail.C[..., :3] = trim * 0.9
            parts += [b, rail]
    z = 3.0 + 9 * 5.7
    r = 4.5 - 0.22 * 9
    for k in range(8):                                                  # the lantern's little columns
        a = (k + 0.5) * TAU / 8.0
        c_ = lathe([(0.26, z + 0.3), (0.17, z + 0.7), (0.17, z + 2.9), (0.26, z + 3.3)], 5).moved(r * 0.92 * math.cos(a), r * 0.92 * math.sin(a), 0.0)
        c_.C[..., :3] = base
        parts.append(c_)
    top = lathe([(r + 0.3, z + 3.3), (r + 0.3, z + 3.7), (0.7, z + 8.0), (0.12, z + 10.2)], 10)
    C = top.corners()
    top.C[..., :3] = cap_col if cap_col is not None else mix(hexc('#2f5850'), hexc('#6a9a84'), sstep(z + 3.0, z + 8.0, C[..., 2])[..., None])
    m = weather(join(parts), seed, 0.3, 0.5)
    g = lathe([(r * 0.74, z + 0.3), (r * 0.74, z + 3.3)], 10)
    g.C[..., :3] = col
    return join([m, top, g] + lit)


def tower():
    return tower_of(GOLDLIT, 74)


def tower_cold():
    return tower_of(COLDLIT, 75, DARK, hexc('#5a6470'), cap_col=hexc('#22303a'))
