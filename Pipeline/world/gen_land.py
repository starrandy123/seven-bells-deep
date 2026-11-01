# Drowned City: the land, from code: coconut palms, the understorey, beach and cliff rock, driftwood. Same rules as the sea's props: origin at the base, z up, real metres.
# Leaves are one layer (the look draws them two-sided), every natural thing smooth-shaded.
import math

import numpy as np

from meshkit import Mesh, Perlin3, TAU, field_grid, grid, hexc, join, mix, sd_ellipsoid, smax, smin, sphere, sstep, surface_nets, tube
from gen_nature import close_field, paint_rock, ribbon, rock_field, seams, strata_stack, unit


def palm(seed, height, lean, n_fronds, bend):
    """A coconut palm, Cocos nucifera: a slim ringed trunk, swollen at the foot, leaning and curving back toward the light; a crown of long arching fronds that droop at the tips, their leaflets a comb along each edge; a cluster of green nuts."""
    rs = np.random.RandomState(seed)
    pn = Perlin3(seed)
    N = 11
    pts = []
    d0 = rs.uniform(0, TAU)
    dx, dy = math.cos(d0), math.sin(d0)
    for i in range(N):
        t = i / (N - 1.0)
        off = lean * (t * 1.15 - 0.15 * t ** 3) - bend * t * t * t
        pts.append([dx * off, dy * off, height * t * (1.0 - 0.04 * lean / height) - 0.5])
    pts = np.array(pts)
    rad = np.array([0.5, 0.36, 0.28, 0.25, 0.24, 0.23, 0.22, 0.21, 0.2, 0.19, 0.19])
    trunk = tube(pts, rad, sides=8, cap_end=False)
    C = trunk.corners()
    ringz = 0.5 + 0.5 * np.sin(C[..., 2] * 7.0)
    tone = 0.5 + 0.5 * pn.fbm(C[..., 0] * 1.5, C[..., 1] * 1.5, C[..., 2] * 0.6, 3)
    trunk.C[..., :3] = mix(hexc('#54483a'), hexc('#8d7d68'), (0.5 * tone + 0.4 * ringz)[..., None])
    parts = [trunk]
    top = pts[-1]
    up = unit(pts[-1] - pts[-2])
    # the crown's heart
    heart = sphere(top + up * 0.3, (0.42, 0.42, 0.62), seg=7, rings=4)
    heart.C[..., :3] = hexc('#6b6a36')
    parts.append(heart)
    for k in range(5):
        a = k / 5.0 * TAU
        nut = sphere(top - up * 0.42 + np.array([math.cos(a), math.sin(a), 0.0]) * 0.34, (0.17, 0.17, 0.2), seg=5, rings=3)
        nut.C[..., :3] = hexc('#52622c') if k % 2 else hexc('#7d6a2c')
        parts.append(nut)
    golden = 2.39996
    for f in range(n_fronds):
        a = f * golden + rs.uniform(-0.2, 0.2)
        out = np.array([math.cos(a), math.sin(a), 0.0])
        side = np.array([-out[1], out[0], 0.0])
        L = rs.uniform(5.0, 6.6)
        rise = rs.uniform(0.7, 1.3) * (1.0 - 0.5 * (f / float(n_fronds)))         # the young fronds stand up, the old hang
        rows = 7
        R_ = []
        for i in range(rows):
            u = i / (rows - 1.0)
            R_.append(top + up * 0.4 + out * L * u * (1.0 - 0.14 * u) + np.array([0, 0, 1.0]) * L * (rise * u - 0.72 * u * u * (1.0 + 0.5 * u)))
        R_ = np.array(R_)
        spine = tube(R_, np.linspace(0.07, 0.012, rows), sides=3, cap_end=False)
        spine.C[..., :3] = hexc('#a09a50')
        parts.append(spine)
        # the leaflets: one long narrow blade after another down each side, hanging a little, shortest at the two ends
        nl = 13
        V, T_, Cc = [], [], []
        ru = np.linspace(0.04, 0.985, nl)
        for j, u in enumerate(ru):
            q = u * (rows - 1.0)
            k = min(int(q), rows - 2)
            p0 = R_[k] + (R_[k + 1] - R_[k]) * (q - k)
            d = unit(R_[k + 1] - R_[k])
            nrm = unit(np.cross(d, side))
            lf = 1.3 * math.sin(math.pi * (0.1 + 0.88 * u)) ** 0.7 * rs.uniform(0.86, 1.08)
            base = L / nl * 0.56
            for sg in (-1, 1):
                tip_ = p0 + d * lf * 0.56 + side * sg * lf * 0.82 + np.array([0, 0, -lf * 0.34])
                i0 = len(V)
                V += [p0, p0 + d * base, tip_]
                T_.append([i0, i0 + 1, i0 + 2])
                g = mix(hexc('#2f5e2c'), hexc('#7aa03e'), rs.rand())
                g2 = mix(g, hexc('#b8ac52'), float(sstep(0.7, 1.0, u)) * 0.6)
                Cc.append([g2 * 0.9, g2 * 0.9, g2 * 1.2])
        leaf = Mesh(np.array(V), np.array(T_))
        leaf.C[..., :3] = np.array(Cc)
        parts.append(leaf)
    m = join(parts)
    low = tube(pts[:4], rad[:4], sides=8, cap_end=False)
    m.col_parts = [(low, 1, float(pts[1, 0]), float(pts[1, 1]))]
    return m


def palm_a():
    return palm(601, 14.0, 3.4, 12, 1.4)


def palm_b():
    return palm(602, 11.0, 5.6, 12, 2.6)


def _leaves(rs, c, r, n, size, c0, c1):
    """A shell of leaves round a ball of shade."""
    parts = []
    for i in range(n):
        v = unit(rs.normal(size=3) * np.array([1.0, 1.0, 0.8]) + np.array([0, 0, 0.3]))
        p = np.asarray(c) + v * r * rs.uniform(0.62, 1.24) * np.array([1.0, 1.0, 0.8])
        t = unit(np.cross(v, rs.normal(size=3)))
        b = np.cross(v, t)
        s = size * rs.uniform(0.7, 1.2)
        q = np.array([p - t * s * 0.5 + b * 0.0, p + t * s * 0.1 + b * s * 0.26 + v * s * 0.05, p + t * s * 0.9, p + t * s * 0.1 - b * s * 0.26 + v * s * 0.05])
        m = Mesh(q, [[0, 1, 2], [0, 2, 3]])
        m.C[..., :3] = mix(c0, c1, rs.rand())
        parts.append(m)
    return parts


def bush():
    """A shrub: a dark mass of shade under a skin of leaves, lit as one soft form. About 2.4 m tall."""
    import gen_village as V_
    rs = np.random.RandomState(603)
    blobs = [((0.0, 0.0, 1.05), 1.26), ((1.0, 0.45, 0.72), 0.82), ((-0.9, -0.5, 0.78), 0.9), ((0.2, -1.0, 0.62), 0.74)]
    core = []
    for c, r in blobs:
        s_ = sphere(c, (r * 0.74, r * 0.74, r * 0.62), seg=6, rings=4)
        s_.C[..., :3] = hexc('#16280f')
        s_.N = (s_.corners() - np.asarray(c)) / np.maximum(np.linalg.norm(s_.corners() - np.asarray(c), axis=-1, keepdims=True), 1e-6)
        core.append(s_)
    return V_.join_n(core + [V_.foliage(rs, blobs, 34, 0.72, hexc('#1f3d1c'), hexc('#3c6a2c'), hexc('#7ea442'))])


def fern():
    """A ground fern: a rosette of arching fronds, each a toothed strip, paler toward the tip."""
    rs = np.random.RandomState(604)
    parts = []
    for i in range(13):
        a = i * 2.39996 + rs.uniform(-0.2, 0.2)
        out = np.array([math.cos(a), math.sin(a), 0.0])
        side = np.array([-out[1], out[0], 0.0])
        L = rs.uniform(1.0, 1.7)
        P, W = [], []
        rows = 9
        for k in range(rows):
            u = k / (rows - 1.0)
            P.append(out * L * 0.8 * u + np.array([0, 0, L * (1.5 * u - 1.05 * u * u) - 0.05]))
            W.append(0.21 * math.sin(math.pi * (0.1 + 0.88 * u)) ** 0.7 * (1.0 if k % 2 == 0 else 0.55))
        parts.append(ribbon(P, W, side, hexc('#2c5226'), hexc('#7aa843')))
    return join(parts)


def grass_tuft():
    """A tuft of coarse island grass, its blades bent over by the trade wind."""
    rs = np.random.RandomState(605)
    parts = []
    for i in range(34):
        a, r = rs.uniform(0, TAU), 0.42 * math.sqrt(rs.rand())
        p = np.array([r * math.cos(a), r * math.sin(a), -0.05])
        L = rs.uniform(0.6, 1.25)
        lean = rs.uniform(-0.8, 0.8) + 0.7
        bend = np.array([math.cos(lean), math.sin(lean), 0.0])
        pts = [p + np.array([0, 0, L * (t - 0.2 * t * t)]) + bend * (0.42 * L * t * t) for t in (0.0, 0.36, 0.7, 1.0)]
        side = np.array([-bend[1], bend[0], 0.0])
        parts.append(ribbon(pts, [0.03, 0.03, 0.022, 0.005], side, hexc('#3f6a2c'), mix(hexc('#92a84a'), hexc('#c9c07a'), rs.uniform(0.0, 0.7))))
    return join(parts)


def _rock_mesh(size, seed, pitch, facets=8):
    hx, hy, h = size[0] / 2.0, size[1] / 2.0, size[2]
    X, Y, Z, lo, p = field_grid((-hx * 1.2, -hy * 1.2, -1.0), (hx * 1.2, hy * 1.2, h * 1.1), pitch)
    F = rock_field(X, Y, Z, size, seed, facets, 0.03)
    F = smax(F, (lo[2] + p * 1.5) - Z, p)
    close_field(F, p)
    return surface_nets(F, lo, p)


def beach_rock_mesh():
    """A shore boulder, low and broad, worn by the sea on its seaward side."""
    return _rock_mesh((6.0, 4.4, 2.2), 606, 0.34, 12)


def cliff_rock():
    """Black basalt: a sea cliff standing in tall rounded columns over banded lava flows, each flow a ledge. Lofted, so nothing is a flat facet up close."""
    m = strata_stack((34.0, 22.0, 30.0), 607, beds=11, segs=34, flutes=9, flute_amp=0.07, prof=lambda t: 1.0 - 0.26 * t ** 1.3, wander=0.12, wob=0.16)
    e = m.beds
    paint_basalt(m, 607)
    return seams(m, e, 0.5)


def paint_basalt(m, seed):
    pn = Perlin3(seed)
    C = m.corners()
    n = m.face_normals()[:, None, :]
    f = 0.13
    t = 0.5 + 0.5 * pn.fbm(C[..., 0] * f, C[..., 1] * f, C[..., 2] * f, 4)
    col = mix(hexc('#14151a'), hexc('#3e3b3d'), t[..., None])
    moss = sstep(0.35, 0.85, n[..., 2]) * sstep(0.32, 0.6, 0.5 + 0.5 * pn.fbm(C[..., 0] * 0.3, C[..., 1] * 0.3, C[..., 2] * 0.3 + 3.0, 3))
    col = mix(col, hexc('#37542c'), (0.8 * moss)[..., None])
    col = mix(col, hexc('#6a5a48'), (sstep(0.7, 0.86, t) * 0.4)[..., None])
    m.C[..., :3] = col
    return m


def driftwood():
    """A bleached silver log, its root plate still on, salt-worn and split."""
    rs = np.random.RandomState(608)
    pn = Perlin3(608)
    pts = [[-3.2, 0.0, 0.34], [-1.6, 0.14, 0.3], [0.1, -0.1, 0.28], [1.7, 0.1, 0.24], [3.0, 0.3, 0.2]]
    parts = [tube(pts, [0.36, 0.32, 0.28, 0.24, 0.12], sides=7)]
    for k in range(5):
        a = k / 5.0 * TAU + 0.3
        parts.append(tube([[-3.1, 0.0, 0.34], [-3.6, math.cos(a) * 0.6, 0.36 + math.sin(a) * 0.5], [-3.8, math.cos(a) * 1.1, 0.36 + math.sin(a) * 0.86]], [0.15, 0.09, 0.02], sides=4))
    parts.append(tube([[0.8, 0.0, 0.4], [1.2, 0.6, 0.8], [1.3, 1.1, 1.05]], [0.09, 0.06, 0.02], sides=4))
    m = join(parts)
    C = m.corners()
    m.C[..., :3] = mix(hexc('#5a544a'), hexc('#a59d8c'), (0.5 + 0.5 * np.sin(C[..., 1] * 13.0 + 3.0 * pn.fbm(C[..., 0] * 0.8, C[..., 1] * 0.8, C[..., 2] * 0.8, 2)))[..., None])
    m.V[:, 2] -= 0.1
    return m
