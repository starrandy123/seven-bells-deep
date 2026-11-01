# Drowned City: the far meshes: <name>__far, the same origin, scale and silhouette at about a quarter of the triangles, drawn past FAR_RANGE (130 m on a phone, 190 on a desktop).
# Each is painted from its near mesh, so it keeps the moss, the gold and the stains. Lit faces stay lit, by the same rule, so a city still glitters from far off.
import math

import numpy as np

from meshkit import Mesh, TAU, box, fan, grid, hexc, join, lathe, mix, sphere, tube
from gen_arch import COLDLIT, GOLDLIT, face_dir, face_out
from gen_nature import ribbon, unit


def bake_from(far, near, k=10, lit=0.94):
    """Colour each far corner from the k nearest near faces, leaving out what is lit. keep marks far faces whose colour is already right (lit panes)."""
    nc = near.corners().mean(axis=1)
    col = near.C[..., :3].mean(axis=1)
    plain = col.max(axis=1) < lit                                        # (an animal's white belly isn't a lit window: lit=2 keeps every face)
    nc, col = nc[plain], col[plain]
    P = far.corners().reshape(-1, 3)
    out = np.zeros_like(P)
    for i in range(0, len(P), 500):
        q = P[i:i + 500]
        d = ((q[:, None, :] - nc[None, :, :]) ** 2).sum(axis=2)
        idx = np.argpartition(d, min(k, d.shape[1] - 1), axis=1)[:, :k]
        out[i:i + 500] = col[idx].mean(axis=1)
    keep = getattr(far, 'keep', None)
    baked = out.reshape(-1, 3, 3)
    if keep is None:
        far.C[..., :3] = baked
    else:
        far.C[~keep, :, :3] = baked[~keep]
    return far


def lit_pane(x0, x1, z0, z1, y, col, sgn=-1.0):
    m = Mesh([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [[0, 1, 2], [0, 2, 3]], S=False)
    face_dir(m, (0.0, sgn, 0.0))
    m.C[..., :3] = col
    return m


def with_keep(meshes, lit):
    """Join plain meshes and lit panes, marking the panes so the bake leaves them."""
    out = join(meshes + lit)
    n = sum(m.tris for m in meshes)
    out.keep = np.arange(out.tris) >= n
    return out


def block(x0, x1, y0, y1, z0, z1, nx=1, nz=1):
    return box(x0, x1, y0, y1, z0, z1, S=False, nx=nx, nz=nz)


def arched_block(w, h, t, hw, spring, top, N=9):
    """A block with an arched tunnel through y: two faces stitched from the arch to the rectangle, the soffit, the jambs."""
    th = np.linspace(math.pi, 0.0, N)
    inner = [(hw * math.cos(a), spring + (top - spring) * math.sin(a)) for a in th]
    outer = []
    for i, (x, z) in enumerate(inner):
        f = i / (N - 1.0)
        outer.append((-w / 2.0 + w * f, h))
    jl = [(-hw, 0.0), (-w / 2.0, 0.0)]
    parts = []
    for y, sgn in ((-t / 2.0, -1.0), (t / 2.0, 1.0)):
        P = np.array([[[x, y, z] for x, z in inner], [[x, y, z] for x, z in outer]])
        g = grid(P, S=False)
        face_dir(g, (0.0, sgn, 0.0))
        parts.append(g)
        for sx in (-1, 1):
            q = np.array([[sx * hw, y, 0.0], [sx * w / 2.0, y, 0.0], [sx * w / 2.0, y, h if False else inner[0][1]], [sx * hw, y, inner[0][1]]])
            m = Mesh(q, [[0, 1, 2], [0, 2, 3]], S=False)
            face_dir(m, (0.0, sgn, 0.0))
            parts.append(m)
            q = np.array([[sx * hw, y, inner[0][1]], [sx * w / 2.0, y, inner[0][1]], [sx * w / 2.0, y, h]])     # the corner above the springing
            m = Mesh(q, [[0, 1, 2]], S=False)
            face_dir(m, (0.0, sgn, 0.0))
            parts.append(m)
    # the side walls and the top; the soffit
    so = grid(np.array([[[x, -t / 2.0, z] for x, z in inner], [[x, t / 2.0, z] for x, z in inner]]), S=True)
    face_dir(so, (0.0, 0.0, -1.0))
    parts.append(so)
    for sx in (-1, 1):
        q = np.array([[sx * w / 2.0, -t / 2.0, 0.0], [sx * w / 2.0, t / 2.0, 0.0], [sx * w / 2.0, t / 2.0, h], [sx * w / 2.0, -t / 2.0, h]])
        m = Mesh(q, [[0, 1, 2], [0, 2, 3]], S=False)
        face_dir(m, (sx, 0.0, 0.0))
        parts.append(m)
    q = np.array([[-w / 2.0, -t / 2.0, h], [w / 2.0, -t / 2.0, h], [w / 2.0, t / 2.0, h], [-w / 2.0, t / 2.0, h]])
    m = Mesh(q, [[0, 1, 2], [0, 2, 3]], S=False)
    face_dir(m, (0.0, 0.0, 1.0))
    parts.append(m)
    return join(parts)


def column():
    return lathe([(1.7, -1.0), (1.7, 0.4), (1.3, 1.1), (1.26, 3.0), (1.16, 8.0), (1.04, 12.6), (1.3, 13.0), (1.62, 13.4), (1.62, 13.96)], 9)


def column_broken():
    return lathe([(1.7, -1.0), (1.7, 0.4), (1.3, 1.1), (1.24, 4.0), (1.16, 7.6), (0.7, 8.6), (0.2, 9.0)], 8)


def wall_bay():
    return join([arched_block(12.0, 14.4, 2.0, 2.8, 6.2, 9.1), block(-6.1, 6.1, -1.2, 1.2, 13.9, 14.3, nx=3)])


def wall_broken():
    parts = []
    for c, x1 in enumerate((6.0, 6.0, 5.0, 3.0, 0.8, -0.8, -3.0)):
        parts.append(block(-6.0, x1, -0.9, 0.9, c * 1.45 - (1.0 if c == 0 else 0.0), (c + 1) * 1.45, nx=2))
    return join(parts)


def arch():
    return join([arched_block(20.0, 14.5, 6.0, 5.0, 9.5, 14.0), block(-10.4, 10.4, -3.5, 3.5, 14.5, 16.4, nx=3), block(-9.0, 9.0, -2.6, 2.6, 16.4, 20.4, nx=3)] +
                [lathe([(0.95, -1.0), (0.95, 2.6), (0.62, 2.8), (0.52, 13.4), (0.95, 14.4)], 6).moved(sx * 7.6, sy * 3.42, 0.0) for sx in (-1, 1) for sy in (-1, 1)])


def temple_front():
    W, D = 34.0, 12.0
    z0, H = 1.65, 15.0
    parts = [block(-W / 2 - 2.0, W / 2 + 2.0, -D / 2 - 2.0, D / 2, -1.0, 0.55, nx=3), block(-W / 2 - 1.2, W / 2 + 1.2, -D / 2 - 1.2, D / 2, 0.55, 1.1, nx=3), block(-W / 2 - 0.4, W / 2 + 0.4, -D / 2 - 0.4, D / 2, 1.1, 1.65, nx=3)]
    xs = np.linspace(-W / 2 + 2.6, W / 2 - 2.6, 6)
    for i, x in enumerate(xs):
        if i == 0:
            parts.append(lathe([(1.5, z0), (1.2, z0 + 0.8), (1.12, z0 + 5.6), (0.5, z0 + 6.6)], 7).moved(x, -D / 2 + 2.0, 0.0))
        else:
            parts.append(lathe([(1.5, z0), (1.2, z0 + 0.8), (1.0, z0 + H - 1.2), (1.56, z0 + H)], 7).moved(x, -D / 2 + 2.0, 0.0))
    ez = z0 + H
    xb = xs[1] - 2.4
    parts.append(block(xb, W / 2, -D / 2, D / 2, ez, ez + 2.8, nx=4))
    pz, ph = ez + 2.8, 5.8
    poly = [(W / 2, pz), (0.0, pz + ph), (-5.0, pz + 4.0), (-8.3, pz + 3.0), (xb + 2.5, pz + 2.5), (xb + 3.2, pz)]
    Pf = np.array([[x, -D / 2 + 0.1, z] for x, z in poly])
    Pb = np.array([[x, D / 2, z] for x, z in poly])
    fr = fan(Pf, Pf.mean(axis=0), S=False)
    face_dir(fr, (0.0, -1.0, 0.0))
    sd = grid(np.stack([Pf, Pb], 0), wrap_v=True, S=False)
    c_ = Pf.mean(axis=0)
    k = np.sum(sd.face_normals() * (sd.corners().mean(axis=1) - c_), axis=1) < 0
    sd.T[k] = sd.T[k][:, ::-1]
    return join(parts + [fr, sd])


def arena_bay():
    w, t = 11.9, 9.0
    parts = [block(-w / 2.0, w / 2.0, -t / 2.0, t / 2.0, -6.5, 0.4, nx=2)]
    z = 0.4
    for h in (10.6, 9.8, 8.6):
        parts.append(arched_block(w, h, t, (w - 3.2) / 2.0, (h - 1.3) * 0.62, h - 1.3, N=5).moved(0.0, 0.0, z))
        z += h
    parts.append(block(-w / 2.0, w / 2.0, -t / 2.0 + 0.2, t / 2.0 - 0.2, z, z + 2.9, nx=2))
    m = join(parts)
    # the tunnel the arched block makes is blind: a core wall closes it
    m = join([m, block(-w / 2.0, w / 2.0, -0.6, 0.6, 0.4, z).tinted(hexc('#181c1c'))])
    return m


def bell_shrine():
    parts = [lathe([(8.4, -1.2), (8.4, 0.5), (6.9, 1.5), (0.0, 1.5)], 10, S=False)]
    for i in range(6):
        a = i / 6.0 * TAU + 0.26
        h = 6.2 if i == 4 else 11.1
        parts.append(lathe([(0.8, 1.5), (0.64, 2.0), (0.56, h - 0.5), (0.9, h)], 5).moved(6.2 * math.cos(a), 6.2 * math.sin(a), 0.0))
    z = 11.1
    parts.append(lathe([(7.2, z), (7.2, z + 1.5), (6.6, z + 2.6), (3.9, z + 4.7), (1.3, z + 5.2)], 12))
    return join(parts)


def dome_hall():
    R = 18.0
    N = 12
    a_w = TAU / N
    circ = 1.0 / math.cos(a_w / 2.0)
    plain = [lathe([(R + 2.6, -1.2), (R + 2.6, 1.0), (R * circ, 2.2), (R * circ, 19.0), (R * circ + 1.2, 20.0), (R * 0.95, 20.5), (R * 0.9, 25.0), (R * 0.68, 30.0), (R * 0.32, 33.6), (2.6, 34.4), (2.6, 37.4), (0.3, 41.0)], N, start=a_w / 2.0)]
    lit = []
    for i in range(N):
        pts = [lit_pane(-1.62, 1.62, z0, z1, -R - 0.05, GOLDLIT).rot('z', i * a_w) for z0, z1 in ((3.2, 9.4), (12.0, 16.8))]
        lit += pts
    return with_keep(plain, lit)


def tower_of(col):
    N = 8
    circ = 1.0 / math.cos(TAU / N / 2.0)
    prof = [(5.3, -1.0), (5.3, 0.4), (4.5 * circ, 2.6)]
    for i in range(1, 10):
        z = 3.0 + i * 5.7
        r = (4.5 - 0.22 * i) * circ
        prof += [(r, z), (r * 1.05, z + 0.1), (r, z + 0.3)] if i in (3, 6, 9) else [(r, z)]
    z = 3.0 + 9 * 5.7
    r = 4.5 - 0.22 * 9
    prof += [(r * 0.8, z + 0.6), (r * 0.8, z + 3.2), (r + 0.3, z + 3.5), (0.7, z + 8.0), (0.12, z + 10.2)]
    plain = [lathe(prof, N, S=False, start=TAU / 16.0)]
    lit = []
    for i in range(9):
        z0, z1 = 3.0 + i * 5.7, 3.0 + (i + 1) * 5.7
        rm = 4.5 - 0.22 * (i + 0.5) + 0.04
        for k in range(0, N, 2):
            lit.append(lit_pane(-0.56, 0.56, z0 + 1.3, z1 - 1.2, -rm, col).rot('z', k * TAU / N))
    g = lathe([(r * 0.82, z + 0.6), (r * 0.82, z + 3.2)], 8)
    g.C[..., :3] = col
    return with_keep(plain, lit + [g])


def tower():
    return tower_of(GOLDLIT)


def tower_cold():
    return tower_of(COLDLIT)


def facade(col, lancet):
    w, h, t = 16.0, 13.0, 2.4
    hw = 0.62 if lancet else 0.92
    plain = [block(-w / 2.0, w / 2.0, -t / 2.0, t / 2.0, -1.0, h + 0.5, nx=4, nz=2), block(-w / 2.0, w / 2.0, -t / 2.0 - 1.5, -t / 2.0, 6.0, 7.4)]
    lit = [lit_pane(x - hw, x + hw, z0, z1, -t / 2.0 - 0.02, col) for x in (-6.4, -3.2, 0.0, 3.2, 6.4) for z0, z1 in ((0.9, 5.0), (7.5, 11.8))]
    return with_keep(plain, lit)


def wall_windows():
    return facade(GOLDLIT, False)


def wall_windows_cold():
    return facade(COLDLIT, True)


def palm_far(seed, height, lean, bend):
    rs = np.random.RandomState(seed)
    d0 = rs.uniform(0, TAU)
    dx, dy = math.cos(d0), math.sin(d0)
    pts = np.array([[dx * (lean * (t * 1.15 - 0.15 * t ** 3) - bend * t ** 3), dy * (lean * (t * 1.15 - 0.15 * t ** 3) - bend * t ** 3), height * t * (1.0 - 0.04 * lean / height) - 0.5] for t in (0.0, 0.35, 0.7, 1.0)])
    parts = [tube(pts, [0.46, 0.26, 0.21, 0.19], sides=4, cap_end=False)]
    top = pts[-1]
    for f in range(10):
        a = f * 2.39996
        out = np.array([math.cos(a), math.sin(a), 0.0])
        side = np.array([-out[1], out[0], 0.0])
        L = 5.6
        rise = 1.0 - 0.5 * (f / 10.0)
        P = [top + out * L * u * (1.0 - 0.14 * u) + np.array([0, 0, 1.0]) * L * (rise * u - 0.72 * u * u * (1.0 + 0.5 * u)) for u in (0.0, 0.4, 0.75, 1.0)]
        for q in range(3):
            W = (0.9, 0.9, 0.5)[q]
            v = [P[q] - side * W, P[q] + side * W, P[q + 1] + side * W * 0.7, P[q + 1] - side * W * 0.7]
            m = Mesh(v, [[0, 1, 2], [0, 2, 3]])
            parts.append(m)
    return join(parts)


def palm_a():
    return palm_far(601, 14.0, 3.4, 1.4)


def palm_b():
    return palm_far(602, 11.0, 5.6, 2.6)


def oak_far(seed, h, spread):
    rs = np.random.RandomState(seed)
    parts = [tube([[0, 0, -0.6], [0.0, 0.0, h * 0.4]], [0.8, 0.5], sides=5, cap_end=False)]
    blobs = [((0.0, 0.0, h * 0.74), spread * 0.56)]
    for k in range(6):
        a = k / 6.0 * TAU + rs.uniform(-0.3, 0.3)
        r = spread * rs.uniform(0.55, 0.72)
        z = h * rs.uniform(0.54, 0.72)
        blobs.append(((r * math.cos(a), r * math.sin(a), z), spread * rs.uniform(0.4, 0.5)))
    Ns = [np.repeat(parts[0].face_normals()[:, None, :], 3, axis=1)]
    for c, r in blobs:
        s = sphere(c, (r, r, r * 0.8), seg=6, rings=3)
        parts.append(s)
        Ns.append((s.corners() - np.asarray(c)) / np.maximum(np.linalg.norm(s.corners() - np.asarray(c), axis=-1, keepdims=True), 1e-6))
    m = join(parts)
    m.N = np.concatenate(Ns)
    return m


def tree_oak_a():
    return oak_far(611, 13.0, 9.5)


def tree_oak_b():
    return oak_far(612, 10.5, 8.0)


def cottage_far(L, W, H, rise):
    parts = [block(-L / 2.0, L / 2.0, -W / 2.0, W / 2.0, -0.7, H, nx=3, nz=2)]
    for sgn in (-1, 1):
        q = np.array([[-L / 2.0 - 0.5, sgn * (W / 2.0 + 0.5), H - 0.2], [L / 2.0 + 0.5, sgn * (W / 2.0 + 0.5), H - 0.2], [L / 2.0 + 0.5, 0.0, H + rise], [-L / 2.0 - 0.5, 0.0, H + rise]])
        m = Mesh(q, [[0, 1, 2], [0, 2, 3]], S=False)
        face_dir(m, (0.0, sgn * 0.3, 1.0))
        parts.append(m)
        t_ = Mesh([[sgn * L / 2.0, -W / 2.0, H], [sgn * L / 2.0, W / 2.0, H], [sgn * L / 2.0, 0.0, H + rise]], [[0, 1, 2]], S=False)
        face_dir(t_, (sgn, 0.0, 0.0))
        parts.append(t_)
    return join(parts)


def cottage_a():
    return cottage_far(10.0, 7.0, 4.6, 3.4)


def cottage_b():
    return cottage_far(12.0, 7.6, 6.4, 3.8)


def ice_ceiling():
    return box(-24.0, 24.0, -24.0, 24.0, -5.2, 0.8, S=False)


def seagrass():
    """Nine wide blades for the thirty-five near ones: the same tuft from 20 m."""
    rs = np.random.RandomState(18)
    parts = []
    for i in range(9):
        a, r = rs.uniform(0, TAU), 0.6 * math.sqrt(rs.rand())
        p = np.array([r * math.cos(a), r * math.sin(a), -0.05])
        L = rs.uniform(1.0, 1.8)
        lean = rs.uniform(0, TAU)
        bend = np.array([math.cos(lean), math.sin(lean), 0.0])
        pts = [p + np.array([0, 0, L * (t - 0.12 * t * t)]) + bend * (0.36 * L * t * t) for t in (0.0, 0.34, 0.68, 1.0)]
        parts.append(ribbon(pts, [0.14, 0.19, 0.17, 0.03], np.array([-bend[1], bend[0], 0.0]), hexc('#2b5428'), hexc('#7d9a3f')))
    return join(parts)


def kelp_stalk(L=24.0):
    """The stipe in four rows, the same lazy S, and a dozen broad blades for the thirty-two near ones. Same height, so the sway reads the same."""
    rs = np.random.RandomState(19)
    rows = 13
    pts = np.array([[1.5 * math.sin(i / 12.0 * 2.6 + 0.3) * (i / 12.0), 1.0 * math.sin(i / 12.0 * 3.7 + 2.1) * (i / 12.0), L * i / 12.0 - 0.25] for i in range(rows)])
    stipe = tube(pts[::4], np.linspace(0.12, 0.05, 4), sides=3, cap_end=True)
    parts = [stipe]
    drift = unit([0.5, 0.25, 0.0])
    Nb = 12
    for i in range(Nb):
        t = (i + 1.0) / (Nb + 0.6)
        j = t * (rows - 1)
        k = int(j)
        p = pts[k] + (pts[min(k + 1, rows - 1)] - pts[k]) * (j - k)
        a = i * 2.39996
        out = np.array([math.cos(a), math.sin(a), 0.0])
        side = np.array([-out[1], out[0], 0.0])
        bl = rs.uniform(4.0, 6.0) * (0.8 + 0.5 * t)
        stream = unit(out * 0.45 + np.array([0, 0, 1.0]) + drift * 0.4)
        q0 = p + out * 0.14
        q = [q0 + stream * bl * u + out * bl * 0.2 * math.sin(u * 3.1) for u in (0.0, 0.34, 0.68, 1.0)]
        w = rs.uniform(0.34, 0.5)
        parts.append(ribbon(q, [w * 0.5, w, w * 0.8, 0.04], side, hexc('#5c4e18'), hexc('#a08a2e')))
    return join(parts)


def anemone():
    """A squat column and a crown of thirty long tentacles, one triangle each: the same soft dome from 24 m. Painted from the near mesh."""
    rs = np.random.RandomState(16)
    parts = [lathe([(0.34, -0.1), (0.3, 0.22), (0.36, 0.42), (0.1, 0.5)], 6)]
    for i in range(30):
        a = i * 2.39996
        r = 0.08 + 0.3 * math.sqrt((i + 0.5) / 30.0)
        p = np.array([r * math.cos(a), r * math.sin(a), 0.42])
        d = np.array([math.cos(a) * r * 1.3, math.sin(a) * r * 1.3, 0.5 - r * 0.5])
        side = np.array([-math.sin(a), math.cos(a), 0.0]) * 0.07
        m = Mesh(np.array([p - side, p + side, p + d]), [[0, 1, 2]], S=False)
        parts.append(m)
    return join(parts)


FAR = dict(anemone=anemone, ice_ceiling=ice_ceiling, seagrass=seagrass, kelp_stalk=kelp_stalk, column=column, column_broken=column_broken, wall_bay=wall_bay, wall_broken=wall_broken, arch=arch, temple_front=temple_front, arena_bay=arena_bay, bell_shrine=bell_shrine,
           dome_hall=dome_hall, tower=tower, tower_cold=tower_cold, wall_windows=wall_windows, wall_windows_cold=wall_windows_cold, palm_a=palm_a, palm_b=palm_b,
           tree_oak_a=tree_oak_a, tree_oak_b=tree_oak_b, cottage_a=cottage_a, cottage_b=cottage_b)
