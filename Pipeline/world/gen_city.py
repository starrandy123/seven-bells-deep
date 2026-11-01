# Drowned City: Thalor's stone kit, the colossus, the arena, the shrine and the wreck, from code. Our own designs.
# Origin at the base, z up, each piece's feet run a little below z 0 so it never floats on uneven ground. yaw 0 faces south (-y).
import math
import numpy as np

from meshkit import (Mesh, Perlin3, TAU, box, fan, field_grid, grid, hexc, join, lathe, mix, sd_capsule, sd_ellipsoid, smax, smin, sphere, sstep, surface_nets, tube)
from gen_nature import close_field, unit

MARBLE = hexc('#d9d4c4')
ALGAE = hexc('#3d6e5a')
GOLD = hexc('#c9a24a')
BRONZE = hexc('#6d5a2e')
VERDIGRIS = hexc('#4f8a78')


def fract(x):
    return x - np.floor(x)


def paint_marble(m, seed=2, algae=0.65, course=1.4, stone=3.2, gold=None, dark=None, base=None):
    """Old marble under the sea: each stone its own tone, stains running down from the ledges, weed on what faces up and at the foot.
    gold(P, n) and dark(P, n) give masks by corner."""
    pn = Perlin3(seed)
    P = m.corners()
    n = m.face_normals()[:, None, :]
    fc = P.mean(axis=1)
    c = np.floor(fc[:, 2] / course)
    s = np.floor((fc[:, 0] + fc[:, 1] * 0.7 + c * stone * 0.5) / stone)
    tone = fract(np.sin(c * 12.9898 + s * 78.233) * 43758.5453)[:, None]
    B = (MARBLE if base is None else base)
    col = np.broadcast_to(B * (0.8 + 0.27 * tone)[..., None], (len(P), 3, 3)).copy()
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    warm = 0.5 + 0.5 * pn.fbm(x * 0.09, y * 0.09, z * 0.09, 3)
    col = mix(col, hexc('#bfae8c'), (0.5 * warm)[..., None])
    streak = sstep(0.5, 0.74, 0.5 + 0.5 * pn.fbm(x * 0.55, y * 0.55, z * 0.05, 3))
    col = mix(col, hexc('#6f7468'), (0.55 * streak)[..., None])
    up = sstep(0.25, 0.95, n[..., 2])
    low = sstep(5.0, 0.0, z - z.min())
    patch = sstep(0.32, 0.66, 0.5 + 0.5 * pn.fbm(x * 0.21, y * 0.21, z * 0.21, 4))
    weed = np.clip(up * 0.95 + low * 0.7, 0, 1) * patch * algae
    col = mix(col, ALGAE * (0.8 + 0.5 * warm[..., None]), weed[..., None])
    sponge = sstep(0.68, 0.8, 0.5 + 0.5 * pn(x * 0.5 + 3.0, y * 0.5, z * 0.5))
    col = mix(col, hexc('#a8703c'), (0.5 * sponge * algae)[..., None])
    if dark is not None:
        col = mix(col, hexc('#2a2c2a'), dark(P, n)[..., None])
    if gold is not None:
        col = mix(col, GOLD, gold(P, n)[..., None])
    m.C[..., :3] = col
    return m


def drum_ring(z, r, segs, flutes):
    th = np.linspace(0, TAU, segs, endpoint=False)
    k = 1.0 - 0.055 * (0.5 + 0.5 * np.cos(th * flutes))
    return np.stack([r * k * np.cos(th), r * k * np.sin(th), np.full(segs, z)], 1)


def shaft(z0, z1, r0, r1, drums=5, segs=16, flutes=8, rs=None, broken_top=None):
    """A fluted shaft of stacked drums, each a hand's breadth out of true, the way real columns stand after an earthquake."""
    rs = rs or np.random.RandomState(3)
    parts = []
    H = z1 - z0
    edges = np.linspace(z0, z1, drums + 1)
    for d in range(drums):
        a, b = edges[d], edges[d + 1]
        ox, oy = rs.uniform(-0.05, 0.05) * (d + 1) * 0.5, rs.uniform(-0.05, 0.05) * (d + 1) * 0.5

        def rad(z):
            t = (z - z0) / H
            return (r0 + (r1 - r0) * t) * (1.0 + 0.035 * math.sin(math.pi * min(t * 1.6, 1.0)))

        rows = [a + 0.02, a + 0.1, b - 0.1, b - 0.02]
        rr = [rad(a) * 0.975, rad(a + 0.1), rad(b - 0.1), rad(b) * 0.975]
        P = np.stack([drum_ring(z, r, segs, flutes) for z, r in zip(rows, rr)], 0)
        P[..., 0] += ox
        P[..., 1] += oy
        if broken_top is not None and d == drums - 1:
            th = np.linspace(0, TAU, segs, endpoint=False)
            P[3, :, 2] += broken_top(th) * 1.0
            P[2, :, 2] += broken_top(th) * 0.35
        parts.append(grid(P, wrap_v=True, flip=True))
        parts.append(fan(P[-1], P[-1].mean(axis=0) + np.array([0, 0, -0.12 if broken_top is not None else 0.0]), S=False))
    return join(parts)


def col_base(R=1.7, S=True):
    b = box(-R, R, -R, R, -1.1, 0.36, nx=1, ny=1, nz=1)
    t = lathe([(1.5, 0.36), (1.56, 0.5), (1.5, 0.72), (1.3, 0.8), (1.24, 0.98), (1.3, 1.1)], 12)
    return join([b, t])


def col_capital(z, r=1.05, R=1.7):
    e = lathe([(r * 0.98, z), (r * 1.02, z + 0.2), (r * 1.3, z + 0.55), (R * 0.98, z + 0.8)], 12).moved()
    a = box(-R, R, -R, R, z + 0.8, z + 1.25)
    return join([e, a])


def column():
    rs = np.random.RandomState(31)
    H = 14.0
    m = join([col_base(), shaft(1.06, H - 1.28, 1.26, 1.04, 5, 16, 8, rs), col_capital(H - 1.3, 1.02)])
    return paint_marble(m, 31, 0.6, course=2.3, stone=99.0)


def column_broken():
    rs = np.random.RandomState(32)
    r2 = np.random.RandomState(33)
    knots = r2.uniform(-1.0, 1.1, 9)
    th0 = np.linspace(0, TAU, 9)
    knots[-1] = knots[0]

    def edge(th):
        return np.interp(th, th0, knots) + r2.uniform(-0.1, 0.1, th.shape)

    m = join([col_base(), shaft(1.06, 8.0, 1.26, 1.14, 3, 16, 8, rs, broken_top=edge)])
    return paint_marble(m, 32, 0.75, course=2.3, stone=99.0)


def column_fallen():
    """Drums where they fell, in a line that has lost its order, half into the silt."""
    rs = np.random.RandomState(34)
    parts = []
    y = -6.2
    for d in range(4):
        L = rs.uniform(2.2, 3.0)
        r = 1.2 - d * 0.05
        rows = [(r * 0.96, 0.02), (r, 0.12), (r, L - 0.12), (r * 0.96, L - 0.02)]
        P = np.stack([drum_ring(z, q, 14, 7) for q, z in rows], 0)
        m = join([grid(P, wrap_v=True), fan(P[0], P[0].mean(axis=0), flip=True, S=False), fan(P[-1], P[-1].mean(axis=0), S=False)]).outward()
        m = m.rot('x', -math.pi / 2 + rs.uniform(-0.09, 0.09)).rot('z', rs.uniform(-0.16, 0.16))
        m = m.moved(rs.uniform(-0.55, 0.55), y, r * 0.72 + rs.uniform(-0.1, 0.12))
        parts.append(m)
        y += L + rs.uniform(0.25, 0.8)
    cap = col_capital(-0.6, 1.02).rot('x', 1.4).rot('z', 0.5).moved(1.5, y + 0.7, 0.86)
    parts.append(cap)
    return paint_marble(join(parts), 34, 0.85, course=99.0, stone=99.0)


def _course(x0, x1, y0, y1, z0, z1, stones, rs):
    if x1 - x0 < 0.3:
        return None
    dy = rs.uniform(-0.035, 0.035)
    return box(x0, x1, y0 + dy, y1 + dy, z0 + 0.012, z1 - 0.012, nx=max(1, stones), ny=1, nz=1)


def masonry(w, h, t, rs, courses=10, opening=None, ruin=None, foot=1.0):
    """A wall of real courses, each stone its own tone (paint_marble), each course a hair out of line. opening = (half width, spring z, top z), an arched gap."""
    parts = [box(-w / 2, w / 2, -t / 2 - 0.05, t / 2 + 0.05, -foot, 0.0)]
    ch = h / courses
    for c in range(courses):
        z0, z1 = c * ch, (c + 1) * ch
        zm = (z0 + z1) / 2
        stagger = (c % 2) * 0.5
        n = int(round(w / 2.9))
        x_edges = [-w / 2]
        if ruin is None:
            if opening is None or zm > opening[2] + 0.2:
                m = _course(-w / 2, w / 2, -t / 2, t / 2, z0, z1, n, rs)
                parts.append(m)
                continue
            hw, spring, top = opening
            if zm < spring:
                gap = hw
            else:
                gap = hw * math.sqrt(max(1.0 - ((zm - spring) / (top - spring)) ** 2, 0.0))
            parts.append(_course(-w / 2, -gap - 0.02, -t / 2, t / 2, z0, z1, max(1, n // 2), rs))
            parts.append(_course(gap + 0.02, w / 2, -t / 2, t / 2, z0, z1, max(1, n // 2), rs))
        else:
            s = w / n
            for k in range(-1, n + 1):
                a = -w / 2 + (k + stagger) * s
                b = a + s
                a, b = max(a, -w / 2), min(b, w / 2)
                if b - a < 0.4:
                    continue
                if ruin((a + b) / 2, zm):
                    parts.append(_course(a + 0.02, b - 0.02, -t / 2, t / 2, z0, z1, 1, rs))
    return join(parts)


def voussoirs(hw, spring, top, t, width=1.15, n=11, y0=None):
    """The ring of wedge stones round an arch, standing a little proud of the wall, and the tall jamb stones below it."""
    parts = []
    y0 = -t / 2 - 0.1
    y1 = t / 2 + 0.1
    ra, rb = hw, top - spring
    for i in range(n):
        a0 = math.pi * i / n + 0.012
        a1 = math.pi * (i + 1) / n - 0.012
        inner = [(ra * math.cos(a), spring + rb * math.sin(a)) for a in (a0, a1)]
        outer = [((ra + width) * math.cos(a), spring + (rb + width) * math.sin(a)) for a in (a0, a1)]
        ring = np.array([inner[0], outer[0], outer[1], inner[1]])
        P = np.array([[[q[0], y0, q[1]] for q in ring], [[q[0], y1, q[1]] for q in ring]])
        side = grid(P, wrap_v=True)
        f = Mesh(P[0], [[0, 1, 2], [0, 2, 3]])
        b = Mesh(P[1], [[0, 2, 1], [0, 3, 2]])
        parts.append(join([side, f, b]).outward())
    for sgn in (-1, 1):
        parts.append(box(sgn * hw - (width if sgn < 0 else 0.0), sgn * hw + (0.0 if sgn < 0 else width), y0, y1, 0.0, spring, nz=int(spring / 1.6)))
    return join(parts)


def wall_bay():
    """A bay of Thalor's house walls: ashlar courses, a tall arched doorway you can swim through, a string course and a cornice."""
    rs = np.random.RandomState(35)
    w, h, t = 12.0, 14.0, 1.8
    hw, spring, top = 2.5, 6.2, 8.8
    parts = [masonry(w, h, t, rs, 10, opening=(hw + 0.3, spring, top + 0.3)), voussoirs(hw, spring, top, t)]
    parts.append(box(-w / 2 - 0.02, w / 2 + 0.02, -t / 2 - 0.22, t / 2 + 0.22, h - 0.15, h + 0.35))
    parts.append(box(-w / 2, w / 2, -t / 2 - 0.12, t / 2 + 0.12, 9.9, 10.15))
    m = join(parts)

    def gold(P, n):
        return 0.9 * sstep(0.03, 0.0, np.abs(P[..., 2] - 10.03) - 0.11)
    return paint_marble(m, 35, 0.55, gold=gold)


def wall_broken():
    """What an earthquake left: the same courses, stepped down to one end, stones gone, some of them lying at the foot."""
    rs = np.random.RandomState(36)
    w, h, t = 12.0, 10.5, 1.8
    pn = Perlin3(36)

    def ruin(x, z):
        tops = 2.0 + 8.2 * sstep(5.8, -3.6, x + 1.1 * math.sin(x * 1.3)) + 1.5 * float(pn(x * 0.32, 0.5, 0.5))
        hole = float(pn(x * 0.33, z * 0.28, 2.0)) > 0.34 and z > tops - 2.6      # stones gone only near the broken top, so none is left in the air
        return z < tops and not hole

    parts = [masonry(w, h, t, rs, 8, ruin=ruin)]
    for i in range(6):
        cx, cy = rs.uniform(-1.0, 6.0), rs.uniform(-3.4, 3.4)
        if abs(cy) < 1.1:
            cy += 1.4 * (1 if cy >= 0 else -1)
        b = box(-0.9, 0.9, -0.5, 0.5, -0.45, 0.45).rot('x', rs.uniform(-0.5, 0.5)).rot('y', rs.uniform(-0.5, 0.5)).rot('z', rs.uniform(0, 3.0))
        parts.append(b.moved(cx, cy, 0.25))
    return paint_marble(join(parts), 36, 0.8)


def arch():
    """A triumphal arch across an avenue: a deep barrel, pilasters, a frieze of gold mosaic, an attic with a blank tablet."""
    rs = np.random.RandomState(37)
    w, h, t = 20.0, 20.0, 6.0
    hw, spring, top = 5.0, 9.5, 14.0
    parts = [masonry(w, 15.8, t, rs, 9, opening=(hw + 0.3, spring, top + 0.3)), voussoirs(hw, spring, top, t, width=1.25, n=9)]
    for sx in (-1, 1):
        for sy in (-1, 1):                                              # engaged columns on the piers' faces
            s = shaft(1.0, 13.8, 0.62, 0.52, 3, 8, 4, rs).moved(sx * 7.6, sy * (t / 2 + 0.36), 0.0)
            parts.append(s)
            parts.append(box(sx * 7.6 - 0.95, sx * 7.6 + 0.95, sy * (t / 2 + 0.36) - 0.95, sy * (t / 2 + 0.36) + 0.95, -1.0, 1.0))
            parts.append(box(sx * 7.6 - 0.95, sx * 7.6 + 0.95, sy * (t / 2 + 0.36) - 0.95, sy * (t / 2 + 0.36) + 0.95, 13.8, 14.5))
    parts.append(box(-w / 2 - 0.4, w / 2 + 0.4, -t / 2 - 0.9, t / 2 + 0.9, 14.5, 15.8))
    parts.append(box(-w / 2 - 0.7, w / 2 + 0.7, -t / 2 - 1.2, t / 2 + 1.2, 15.8, 16.4))
    parts.append(box(-w / 2 + 1.0, w / 2 - 1.0, -t / 2 + 0.4, t / 2 - 0.4, 16.4, 20.0))
    parts.append(box(-w / 2 + 0.7, w / 2 - 0.7, -t / 2 + 0.1, t / 2 - 0.1, 19.7, 20.3))
    parts.append(box(-5.6, 5.6, -t / 2 + 0.3, t / 2 - 0.3, 16.9, 19.3))

    def gold(P, n):
        return 0.95 * sstep(0.04, 0.0, np.abs(P[..., 2] - 15.15) - 0.65) * (np.abs(n[..., 2]) < 0.5)
    return paint_marble(join(parts), 37, 0.55, gold=gold)


def stair():
    """A monumental flight, the treads worn, the cheek walls low, one corner broken away. Origin at the foot of the flight's middle."""
    rs = np.random.RandomState(38)
    w, n, rise, run = 20.0, 14, 0.44, 1.0
    parts = []
    for i in range(n):
        j = rs.uniform(-0.02, 0.02)
        parts.append(box(-w / 2 + 0.05, w / 2 - 0.05, -n * run / 2 + i * run, n * run / 2, -0.8, (i + 1) * rise + j, nx=4))
    for s in (-1, 1):
        parts.append(box(s * (w / 2) - 0.9, s * (w / 2) + 0.9, -n * run / 2 - 0.5, n * run / 2, -0.8, n * rise * 0.5 + 0.8))
        parts.append(box(s * (w / 2) - 0.9, s * (w / 2) + 0.9, 0.0, n * run / 2, n * rise * 0.5 + 0.8, n * rise + 0.9))
    return paint_marble(join(parts), 38, 0.8, course=0.44, stone=3.4)


def temple_front():
    """A temple's porch: three worn steps, six columns, entablature with a gold frieze, a pediment; the west end of the roof has come down, its edge left jagged."""
    rs = np.random.RandomState(39)
    W, D = 34.0, 12.0
    parts = []
    for i in range(3):
        parts.append(box(-W / 2 - 2.0 + i * 0.8, W / 2 + 2.0 - i * 0.8, -D / 2 - 2.0 + i * 0.8, D / 2, -1.0, 0.55 * (i + 1), nx=8))
    z0 = 1.65
    H = 15.0
    xs = np.linspace(-W / 2 + 2.6, W / 2 - 2.6, 6)
    cy = -D / 2 + 2.0
    for i, x in enumerate(xs):
        parts.append(box(x - 1.5, x + 1.5, cy - 1.5, cy + 1.5, z0, z0 + 0.5))
        if i == 0:
            parts.append(shaft(z0 + 0.5, z0 + 6.4, 1.2, 1.12, 2, 10, 5, rs, broken_top=lambda th: 0.8 * np.sin(th * 2.0 + 1.0)).moved(x, cy, 0))
            continue
        parts.append(shaft(z0 + 0.5, z0 + H - 1.1, 1.2, 1.0, 3, 10, 5, rs).moved(x, cy, 0))
        parts.append(lathe([(1.0, z0 + H - 1.15), (1.32, z0 + H - 0.6), (1.5, z0 + H - 0.4)], 8).moved(x, cy, 0))
        parts.append(box(x - 1.55, x + 1.55, cy - 1.55, cy + 1.55, z0 + H - 0.4, z0 + H))
    ez = z0 + H
    x_b = xs[1] - 2.4                                                   # where the roof stops
    pz = ez + 2.8
    ph = 5.8
    parts.append(box(x_b, W / 2 - 0.4, -D / 2 + 0.2, D / 2, ez, ez + 1.2, nx=7))
    parts.append(box(x_b + 0.3, W / 2 - 0.2, -D / 2 + 0.3, D / 2, ez + 1.2, ez + 2.3, nx=7))
    parts.append(box(x_b + 0.6, W / 2, -D / 2, D / 2 + 0.2, ez + 2.3, ez + 2.8, nx=7))
    for k in range(4):                                                  # broken stones of the frieze, still in place past the break
        x0 = x_b - 1.5 - k * 0.2
        parts.append(box(x0 - 0.2, x0 + 1.5, -D / 2 + 0.5, D / 2 - 0.5, ez, ez + 1.15 - k * 0.1))
    apex = (0.0, pz + ph)
    edge = [(x_b + 3.2, pz + 0.0), (x_b + 2.2, pz + 1.0), (x_b + 3.0, pz + 1.9), (x_b + 2.5, pz + 2.5), (-8.3, pz + 3.0), (-5.0, pz + 4.0)]
    poly = [(W / 2, pz)] + [apex] + edge[::-1]
    Pf = np.array([[x, -D / 2, z] for x, z in poly])
    Pb = np.array([[x, D / 2, z] for x, z in poly])
    c = Pf.mean(axis=0)
    fr = fan(Pf, c, S=False)
    if fr.face_normals()[0, 1] > 0:
        fr = fr.flip()
    ba = fan(Pb, Pb.mean(axis=0), S=False)
    if ba.face_normals()[0, 1] < 0:
        ba = ba.flip()
    sd = grid(np.stack([Pf, Pb], 0), wrap_v=True, S=False)
    if np.mean(np.sum(sd.face_normals() * (sd.corners().mean(axis=1) - c), axis=1)) < 0:
        sd = sd.flip()
    parts += [fr, ba, sd]
    # the raking cornice on the side that stands
    a, b = (W / 2 + 0.4, -D / 2 - 0.5, pz - 0.05), (0.0, -D / 2 - 0.5, pz + ph + 0.35)
    c2, d = (W / 2 + 0.4, D / 2 + 0.1, pz - 0.05), (0.0, D / 2 + 0.1, pz + ph + 0.35)
    q = np.array([a, b, d, c2])
    parts.append(join([grid(np.array([[a, c2], [b, d]]), S=False), grid(np.array([[a, b], [q[0] + (0, 0, -0.62), q[1] + (0, 0, -0.62)]]), S=False)]))
    m = join(parts)

    def gold(P, n):
        fr_ = sstep(0.03, 0.0, np.abs(P[..., 2] - (ez + 1.75)) - 0.5) * (n[..., 1] < -0.5)
        ty = (P[..., 2] > pz + 0.05) * (P[..., 1] < -D / 2 + 0.2) * (n[..., 1] < -0.5)
        return 0.95 * np.clip(fr_ + ty, 0, 1)

    m.S = np.zeros(m.tris, dtype=bool)
    return paint_marble(m, 39, 0.6, course=99.0, stone=5.0, gold=gold)


def roof_slab():
    """A flat roof of big square slabs, a corner of it fallen in, so a swimmer can drop into the room below."""
    rs = np.random.RandomState(40)
    pn = Perlin3(40)
    S, n = 26.0, 7
    c = S / n
    parts = []
    for i in range(n):
        for j in range(n):
            x, y = -S / 2 + (i + 0.5) * c, -S / 2 + (j + 0.5) * c
            if math.hypot(x - 6.0, y - 5.0) + 3.5 * float(pn(x * 0.2, y * 0.2, 0.5)) < 7.5:
                continue
            dz = rs.uniform(-0.05, 0.05)
            parts.append(box(x - c / 2 + 0.04, x + c / 2 - 0.04, y - c / 2 + 0.04, y + c / 2 - 0.04, 0.0 + dz, 1.1 + dz))
    return paint_marble(join(parts), 40, 0.95, course=99.0, stone=c)


PALE = hexc('#b4af9f')                                                  # the cities' stone, kept under 0.6 so only a lit window trips the look's glow


def lit(col):
    """A lit window's colour: max(rgb) at or over 0.95, the look's rule for what glows."""
    return np.array(col, dtype=np.float64)


GOLDLIT = lit((1.0, 0.72, 0.28))
COLDLIT = lit((0.22, 0.86, 1.0))


def window(x0, x1, z0, z1, y, col, sgn=-1.0):
    """A tall arched window on a face looking along sgn*y: a rectangle under a pointed arch, standing a hand off the wall."""
    xm = (x0 + x1) / 2.0
    P = np.array([[x0, y, z0], [x1, y, z0], [x1, y, z1 - (x1 - x0) * 0.45], [xm, y, z1], [x0, y, z1 - (x1 - x0) * 0.45]])
    m = fan(P, (xm, y, (z0 + z1) / 2.0), S=False)
    if m.face_normals()[0, 1] * sgn < 0:
        m = m.flip()
    m.C[..., :3] = col
    return m


def wall_windows_of(col, seed):
    """A city facade, 16 m wide, 13 m tall: two storeys of tall lit windows, a balcony with its balustrade on the upper floor, a cornice. Solid: its back goes against a street's block or a canyon wall. Faces -y."""
    rs = np.random.RandomState(seed)
    w, h, t = 16.0, 13.0, 2.4
    parts = [box(-w / 2.0, w / 2.0, -t / 2.0, t / 2.0, -1.0, h, nx=6, nz=4)]
    parts.append(box(-w / 2.0 - 0.2, w / 2.0 + 0.2, -t / 2.0 - 0.3, t / 2.0, h, h + 0.5, nx=3))         # the cornice
    parts.append(box(-w / 2.0, w / 2.0, -t / 2.0 - 1.5, -t / 2.0, 6.0, 6.35, nx=4))                    # the balcony's floor
    for x in np.linspace(-w / 2.0 + 0.3, w / 2.0 - 0.3, 7):                                            # its posts
        parts.append(box(x - 0.12, x + 0.12, -t / 2.0 - 1.5, -t / 2.0 - 1.26, 6.35, 7.3))
    parts.append(box(-w / 2.0, w / 2.0, -t / 2.0 - 1.52, -t / 2.0 - 1.24, 7.25, 7.45, nx=3))
    m = paint_marble(join(parts), seed, 0.5, course=1.6, stone=3.2, base=PALE)
    win = []
    for i in range(5):
        x = -6.4 + i * 3.2
        win.append(window(x - 0.95, x + 0.95, 0.9, 5.0, -t / 2.0 - 0.03, col))
        win.append(window(x - 0.95, x + 0.95, 7.0, 11.8, -t / 2.0 - 0.03, col))
    return join([m] + win)


def wall_windows():
    return wall_windows_of(GOLDLIT, 71)


def wall_windows_cold():
    return wall_windows_of(COLDLIT, 72)


def dome_hall():
    """Meridon's domed hall: a drum ringed with tall lit windows under a ribbed copper dome, a lantern on top that burns gold; 36 m across, 34 m tall, a shape that reads from 150 m."""
    R = 18.0
    segs = 24
    # the plinth and the drum, in rows, so a window can be whole faces
    prof = [(R + 2.4, -1.0), (R + 2.4, 1.2), (R + 0.6, 1.4), (R, 3.0), (R, 8.8), (R, 11.0), (R + 0.5, 11.2), (R + 0.5, 12.0), (R, 12.2), (R, 15.8), (R, 18.2), (R + 0.7, 18.4), (R + 0.7, 19.2)]
    th = np.linspace(0, TAU, segs, endpoint=False)
    P = np.array([np.stack([r * np.cos(th), r * np.sin(th), np.full(segs, z)], 1) for r, z in prof])
    stone = grid(P, wrap_v=True, S=False, flip=True)
    paint_marble(stone, 73, 0.45, course=2.4, stone=7.0, base=PALE)
    nf = len(stone.T)
    fi = np.arange(nf) // 2
    row = fi // segs
    col_ = fi % segs
    lamp_ = ((row == 3) | (row == 8)) & (col_ % 2 == 0)
    stone.C[lamp_, :, :3] = GOLDLIT
    # the dome: ribbed copper, verdigris, gold ribs
    dome_p = []
    for a in np.linspace(0.0, 1.0, 9):
        q = a * math.pi / 2.0 * 0.95
        dome_p.append((R * 0.98 * math.cos(q), 19.2 + 13.0 * math.sin(q)))
    D = np.array([np.stack([r * np.cos(th) * (1.0 + 0.012 * np.cos(th * 12.0)), r * np.sin(th) * (1.0 + 0.012 * np.cos(th * 12.0)), np.full(segs, z)], 1) for r, z in dome_p])
    dome = grid(D, wrap_v=True, S=True, flip=True)
    Cc = dome.corners()
    pn = Perlin3(73)
    v = 0.5 + 0.5 * pn.fbm(Cc[..., 0] * 0.1, Cc[..., 1] * 0.1, Cc[..., 2] * 0.1, 3)
    ang = np.arctan2(Cc[..., 1], Cc[..., 0])
    dome.C[..., :3] = mix(hexc('#335f54'), hexc('#6a9a84'), v[..., None])
    ribs = []
    for k in range(8):
        a = k / 8.0 * TAU + TAU / 48.0
        rp = [(r * 1.012 * math.cos(a), r * 1.012 * math.sin(a), z) for r, z in dome_p[:8]]
        t_ = tube(rp, np.full(8, 0.2), sides=3, cap_end=False)
        t_.C[..., :3] = GOLD * 0.8
        ribs.append(t_)
    # the lantern
    z_t = dome_p[-1][1]
    r_t = dome_p[-1][0]
    lan = lathe([(r_t, z_t), (2.4, z_t + 0.3), (2.4, z_t + 2.8), (2.9, z_t + 3.0), (1.1, z_t + 4.6), (0.3, z_t + 6.6)], 10)
    lan.C[..., :3] = mix(hexc('#3d6f60'), GOLD * 0.8, 0.3)
    glow = lathe([(2.45, z_t + 0.5), (2.45, z_t + 2.6)], 10)
    glow.C[..., :3] = GOLDLIT
    return join([stone, dome, lan, glow] + ribs)


def tower_of(col, seed):
    """A tall slender tower: a tapering shaft ringed by bands of lit windows, three balcony rings, a lantern room and a copper spire. 62 m tall, 9 m across at the foot."""
    H = 56.0
    segs = 12
    th = np.linspace(0, TAU, segs, endpoint=False)
    rows = [(-1.0, 5.2), (0.0, 5.2), (3.0, 4.5)]
    for i in range(9):
        z = 6.0 + i * 5.2
        r = 4.3 - 0.21 * i
        rows += [(z, r), (z + 1.0, r), (z + 3.6, r - 0.05), (z + 4.4, r - 0.08)]
    rows += [(H - 2.6, 2.4), (H, 3.0)]
    P = np.array([np.stack([r * np.cos(th), r * np.sin(th), np.full(segs, z)], 1) for z, r in rows])
    m = grid(P, wrap_v=True, S=False, flip=True)
    paint_marble(m, seed, 0.4, course=2.6, stone=4.0, base=PALE)
    fi = np.arange(len(m.T)) // 2
    row, c = fi // segs, fi % segs
    lamp_ = (row >= 2) & (((row - 3) % 4) == 0) & (row < len(rows) - 4) & (c % 2 == 0)
    m.C[lamp_, :, :3] = col
    parts = [m]
    for i in (2, 5, 8):                                                  # balcony rings
        z = 6.0 + i * 5.2 - 0.6
        r = 4.3 - 0.21 * i
        b = lathe([(r, z - 0.3), (r + 1.3, z), (r + 1.3, z + 0.3), (r, z + 0.3)], 12, S=False)
        paint_marble(b, seed + 1, 0.3, course=99.0, stone=99.0, base=PALE)
        parts.append(b)
    top = lathe([(3.0, H), (3.0, H + 0.3), (2.6, H + 0.4), (2.6, H + 3.2), (3.1, H + 3.3), (0.5, H + 8.0), (0.12, H + 10.5)], 12)
    C = top.corners()
    top.C[..., :3] = mix(hexc('#3d6f60'), hexc('#6a9a84'), sstep(H + 3.0, H + 8.0, C[..., 2])[..., None])
    parts.append(top)
    g = lathe([(2.65, H + 0.6), (2.65, H + 3.0)], 12)
    g.C[..., :3] = col
    parts.append(g)
    return join(parts)


def tower():
    return tower_of(GOLDLIT, 74)


def tower_cold():
    return tower_of(COLDLIT, 75)


def stair_steep():
    """A steep flight cut in a canyon wall: 22 steps climbing 14 m in 13.6 m, 9 m wide, low walls each side. Origin at the foot's middle; climbs toward +y."""
    rs = np.random.RandomState(77)
    w, n, rise, run = 9.0, 22, 14.0 / 22.0, 13.6 / 22.0
    parts = []
    for i in range(n):
        parts.append(box(-w / 2.0 + 0.05, w / 2.0 - 0.05, i * run, n * run, -0.8 + i * rise * 0.0, (i + 1) * rise + rs.uniform(-0.015, 0.015), nx=2))
    for s_ in (-1, 1):
        parts.append(box(s_ * w / 2.0 - 0.5, s_ * w / 2.0 + 0.5, 0.0, n * run, -0.8, n * rise + 0.8, nz=4, ny=3))
    return paint_marble(join(parts), 77, 0.5, course=0.64, stone=3.4, base=PALE)


def bridge_span():
    """A slender bridge, 36 m long: one flat arch of stone, a parapet each side, a small lit lantern at the crown and at each end. Runs along x; origin at its middle, z 0 at the deck's ends."""
    L, n = 36.0, 16
    xs = np.linspace(-L / 2.0, L / 2.0, n + 1)
    deck_z = 1.9 * (1.0 - (xs / (L / 2.0)) ** 2)
    soff_z = deck_z - 0.9 - 2.8 * (xs / (L / 2.0)) ** 2 * (np.abs(xs) > 0)
    hw = 2.7
    T = np.stack([xs, np.full(n + 1, -hw), deck_z], 1)
    U = np.stack([xs, np.full(n + 1, hw), deck_z], 1)
    Tb = np.stack([xs, np.full(n + 1, -hw), soff_z], 1)
    Ub = np.stack([xs, np.full(n + 1, hw), soff_z], 1)
    deck = grid(np.stack([T, U], 1), S=False)
    if deck.face_normals()[0, 2] < 0:
        deck = deck.flip()
    under = grid(np.stack([Ub, Tb], 1), S=True)
    if under.face_normals()[0, 2] > 0:
        under = under.flip()
    s1 = grid(np.stack([T, Tb], 1), S=False)
    if s1.face_normals()[0, 1] > 0:
        s1 = s1.flip()
    s2 = grid(np.stack([U, Ub], 1), S=False)
    if s2.face_normals()[0, 1] < 0:
        s2 = s2.flip()
    parts = [deck, under, s1, s2]
    for sgn in (-1, 1):
        r0 = np.stack([xs, np.full(n + 1, sgn * hw), deck_z], 1)
        r1 = np.stack([xs, np.full(n + 1, sgn * hw), deck_z + 1.2], 1)
        r2 = np.stack([xs, np.full(n + 1, sgn * (hw - 0.3)), deck_z + 1.2], 1)
        p1 = grid(np.stack([r0, r1], 1), S=False)
        if p1.face_normals()[0, 1] * sgn < 0:
            p1 = p1.flip()
        p2 = grid(np.stack([r1, r2], 1), S=False)
        if p2.face_normals()[0, 2] < 0:
            p2 = p2.flip()
        parts += [p1, p2]
    m = paint_marble(join(parts), 76, 0.4, course=99.0, stone=4.5, base=PALE)
    lights = []
    for x in (-L / 2.0 + 2.0, 0.0, L / 2.0 - 2.0):
        z = float(1.9 * (1.0 - (x / (L / 2.0)) ** 2))
        for sgn in (-1, 1):
            lights.append(box(x - 0.3, x + 0.3, sgn * (hw - 0.15) - 0.3, sgn * (hw - 0.15) + 0.3, z + 1.2, z + 2.2).tinted(GOLDLIT))
    return join([m] + lights)


def lamp():
    """A bronze street lamp on a stone foot: a bowl of flame; the flame is the only thing with alpha below 1, so a shader can light it with the bells."""
    post = lathe([(0.3, 1.0), (0.26, 1.3), (0.16, 1.55), (0.13, 5.6), (0.2, 5.75), (0.14, 6.0)], 8)
    post.C[..., :3] = BRONZE
    knots = lathe([(0.13, 3.2), (0.24, 3.32), (0.13, 3.44)], 8)
    knots.C[..., :3] = hexc('#8a6a32')
    bowl = lathe([(0.14, 6.0), (0.5, 6.25), (0.78, 6.55), (0.86, 6.8), (0.74, 6.8), (0.0, 6.5)], 10)
    bowl.C[..., :3] = hexc('#7b6530')
    foot = lathe([(0.8, -1.0), (0.8, 0.5), (0.6, 0.62), (0.5, 1.0), (0.32, 1.05), (0.0, 1.05)], 8)
    paint_marble(foot, 41, 0.7, course=99.0, stone=99.0)
    flame = lathe([(0.05, 6.55), (0.42, 6.85), (0.34, 7.25), (0.12, 7.7), (0.0, 8.0)], 8)
    flame.C[..., :3] = np.array([1.0, 0.62, 0.16])
    flame.glow(1.0)
    m = join([post, knots, bowl])
    pn = Perlin3(41)
    C = m.corners()
    v = sstep(0.4, 0.7, 0.5 + 0.5 * pn.fbm(C[..., 0] * 2.0, C[..., 1] * 2.0, C[..., 2] * 0.8, 3))
    m.C[..., :3] = mix(m.C[..., :3], VERDIGRIS, (0.75 * v)[..., None])
    return join([m, foot, flame])


# ---------------------------------------------------------------- the colossus
def colossus_body(zrange=None, no_mantle=False):
    """The Warden as one carved figure: a signed field of tapered limbs, so joints flow as stone does. A heroic standing pose, weight on the right leg,
    the left arm lost at the forearm, a fin-mantle behind. Erosion and two great bites are in the field too."""
    p = 0.34
    X, Y, Z, lo, p = field_grid((-16.0, -9.0, 4.0), (14.0, 9.0, 46.5), p)
    pn = Perlin3(1931)
    hipx = -0.7                                                         # the hips sit over the right leg
    d = sd_ellipsoid(X, Y, Z, (0.0, 0.0, 32.7), (6.5, 3.9, 6.0))                  # chest
    d = smin(d, sd_ellipsoid(X, Y, Z, (-3.0, -2.2, 34.0), (3.1, 2.1, 2.5)), 0.8)  # the breast plates of the cuirass
    d = smin(d, sd_ellipsoid(X, Y, Z, (3.0, -2.2, 34.0), (3.1, 2.1, 2.5)), 0.8)
    d = smin(d, sd_ellipsoid(X, Y, Z, (hipx * 0.5, 0.0, 27.3), (4.5, 3.1, 4.4)), 1.6)   # waist
    d = smin(d, sd_ellipsoid(X, Y, Z, (hipx, 0.0, 23.6), (4.9, 3.4, 3.7)), 1.2)   # hips
    # the kilt of strips: a flared skirt with deep pleats
    sk = np.clip((24.5 - Z) / 6.0, 0.0, 1.0)
    rsk = 5.0 + 1.0 * sk
    ang = np.arctan2(Y, X - hipx)
    pleat = 0.55 * np.abs(np.sin(ang * 11.0)) ** 0.6
    skirt = (np.sqrt(((X - hipx) / (rsk + pleat)) ** 2 + (Y / ((rsk + pleat) * 0.72)) ** 2) - 1.0) * rsk * 0.8
    skirt = smax(skirt, np.maximum(Z - 25.0, 19.2 - Z - 0.8 * np.sin(ang * 11.0)), 0.25)
    d = smin(d, skirt, 0.5)
    # the right leg straight and bearing; the left a step forward and out
    Rh, Rk, Ra = (-3.1, 0.0, 22.0), (-3.6, -0.5, 13.5), (-3.8, 0.1, 6.4)
    Lh, Lk, La = (2.4, -0.4, 22.0), (3.7, -2.5, 13.8), (4.4, -2.2, 6.4)
    d = smin(d, sd_capsule(X, Y, Z, Rh, Rk, 2.75, 1.75), 0.8)
    d = smin(d, sd_capsule(X, Y, Z, Rk, Ra, 1.95, 1.2), 0.5)
    d = smin(d, sd_capsule(X, Y, Z, Lh, Lk, 2.75, 1.75), 0.8)
    d = smin(d, sd_capsule(X, Y, Z, Lk, La, 1.95, 1.2), 0.5)
    d = smin(d, sd_ellipsoid(X, Y, Z, (-3.8, -0.2, 11.0), (1.95, 2.3, 3.2)), 0.5)  # calf and greave
    d = smin(d, sd_ellipsoid(X, Y, Z, (4.4, -2.1, 11.0), (1.95, 2.3, 3.2)), 0.5)
    d = smin(d, sd_capsule(X, Y, Z, (-3.8, 0.3, 5.8), (-4.0, -3.8, 5.3), 1.25, 0.85), 0.5)   # feet
    d = smin(d, sd_capsule(X, Y, Z, (4.4, -2.0, 5.8), (5.0, -6.2, 5.3), 1.25, 0.85), 0.5)
    # the right arm out and up, the fist on the shaft
    Sr, Er, Hr = (-6.3, 0.0, 36.3), (-10.4, -0.9, 31.6), (-12.0, -2.4, 36.0)
    d = smin(d, sd_capsule(X, Y, Z, Sr, Er, 2.3, 1.55), 0.8)
    d = smin(d, sd_capsule(X, Y, Z, Er, Hr, 1.6, 1.1), 0.4)
    d = smin(d, sd_ellipsoid(X, Y, Z, Hr, (1.5, 1.5, 1.7)), 0.3)
    # the left arm, lost below the elbow
    Sl, El, Wl = (6.3, 0.0, 36.3), (9.3, -0.6, 30.0), (9.0, -3.8, 26.6)
    arm = sd_capsule(X, Y, Z, Sl, El, 2.3, 1.55)
    fore = sd_capsule(X, Y, Z, El, Wl, 1.6, 1.25)
    d = smin(d, arm, 0.8)
    d = smin(d, fore, 0.4)
    # pauldrons, flared like shell
    d = smin(d, sd_ellipsoid(X, Y, Z, (-6.9, 0.0, 37.4), (2.9, 3.0, 1.9)), 0.3)
    d = smin(d, sd_ellipsoid(X, Y, Z, (6.9, 0.0, 37.4), (2.9, 3.0, 1.9)), 0.3)
    # neck, head, the crested half-helm
    d = smin(d, sd_capsule(X, Y, Z, (0, 0.2, 37.5), (0, -0.2, 40.0), 1.75, 1.6), 0.6)
    head = sd_ellipsoid(X, Y, Z, (0.0, -0.3, 41.0), (2.15, 2.6, 2.8))
    head = smin(head, sd_ellipsoid(X, Y, Z, (0.0, -1.2, 39.3), (1.6, 1.8, 1.8)), 0.8)     # the jaw
    d = smin(d, head, 0.4)
    brow = sd_ellipsoid(X, Y, Z, (0.0, 0.0, 41.9), (2.55, 2.95, 2.25))
    brow = smax(brow, 40.9 - Z - 0.25 * (Y + 2.5), 0.2)                 # the helm stops at the brow
    d = smin(d, brow, 0.15)
    crest = smax(np.abs(X) - 0.48 - 0.25 * sstep(44.0, 42.0, Z), sd_ellipsoid(X, Y, Z, (0.0, 1.1, 42.3), (1.0, 5.3, 3.9)), 0.1)
    crest = smax(crest, 40.9 - Z, 0.2)
    d = smin(d, crest, 0.15)
    # the mantle: a heavy fin of a cape from the shoulders to the calves, folded, its hem torn
    yc = 4.1 + 0.08 * (36.0 - Z) + 0.85 * np.sin(X * 0.95 + Z * 0.11) + 0.5 * np.sin(X * 2.1 - Z * 0.17)
    halfw = 6.4 + 2.6 * sstep(36.0, 18.0, Z)
    mantle = smax(np.abs(Y - yc) - 0.72, np.abs(X) - halfw, 0.5)
    hem = 11.0 + 3.0 * pn.fbm(X / 3.0, X * 0 + 2.0, X * 0, 3) + 2.0 * sstep(2.0, 8.0, np.abs(X))
    mantle = smax(mantle, np.maximum(Z - 37.2, hem - Z), 0.4)
    if not no_mantle:
        d = smin(d, mantle, 1.0)
    # the cuirass's seams and the belt, cut as shallow channels
    belt = np.abs(Z - 25.6) - 0.5
    d = np.where((belt < 0) & (d > -0.6) & (d < 0.6), d + 0.14, d)
    # what the sea took: a bite from the left shoulder, a slab off the right hip, the mantle's corner; the lost forearm's end
    for (c, r, k) in [((10.2, 1.4, 38.4), 4.0, 0.3), ((-6.0, -4.3, 21.5), 3.1, 0.3), ((7.5, 6.0, 16.0), 4.6, 0.4), ((9.0, -4.8, 25.0), 2.6, 0.2), ((-1.4, 6.1, 31.0), 2.4, 0.3)]:
        bite = np.sqrt((X - c[0]) ** 2 + (Y - c[1]) ** 2 + (Z - c[2]) ** 2) - r + 1.4 * pn.fbm(X / 2.2, Y / 2.2, Z / 2.2, 3)
        d = smax(d, -bite, k)
    d += 0.22 * pn.fbm(X / 3.4, Y / 3.4, Z / 3.4, 4) + 0.1 * pn.ridged(X / 1.5, Y / 1.5, Z / 1.5, 2)
    F = np.maximum(d, (lo[2] + p * 1.6) - Z)
    if zrange is not None:                                              # a broken piece of the same figure: the cuts are rough
        cut = 1.4 * pn.fbm(X / 2.6, Y / 2.6, X * 0 + 3.0, 3)
        F = smax(F, (zrange[0] + cut) - Z, 0.3)
        F = smax(F, Z - (zrange[1] + cut), 0.3)
    close_field(F, p)
    return surface_nets(F, lo, p)


def paint_statue(m, seed=5):
    """Weathered marble with what is left of its bronze and gold: the helm, the belt, the pauldrons, the mantle's edge."""
    z_of = lambda P: P[..., 2]

    def gold(P, n):
        x, y, z = P[..., 0], P[..., 1], P[..., 2]
        helm = ((z > 41.0) & (y > -2.7)) * 0.8
        pauld = (np.hypot(np.abs(x) - 6.9, y) < 3.1) * (z > 36.4) * (z < 39.8) * 0.7
        belt = sstep(0.5, 0.2, np.abs(z - 25.6)) * 0.85
        return np.clip(helm + pauld + belt, 0, 1) * sstep(0.32, 0.6, 0.5 + 0.5 * Perlin3(seed + 3).fbm(x / 3.1, y / 3.1, z / 3.1, 3))
    return paint_marble(m, seed, 0.72, course=2.4, stone=4.0, gold=gold)


def plinth():
    m = lathe([(13.0, -1.2), (13.0, 1.0), (11.6, 1.0), (11.6, 2.2), (10.2, 2.2), (10.2, 4.0), (9.6, 4.15), (9.6, 4.6), (0.0, 4.6)], 12, S=False, start=TAU / 24)
    rs = np.random.RandomState(4)
    return paint_marble(m, 44, 0.9, course=99.0, stone=99.0)


def trident():
    """The Warden's trident, planted on the plinth: a bronze shaft, a socket, three barbed tines. Its silhouette is the city's mark, so its head is broad."""
    x, y = -12.0, -2.4
    z0, z1 = 3.6, 44.6
    sh = lathe([(0.55, z0), (0.48, z0 + 1.0), (0.42, 20.0), (0.42, 35.0), (0.46, z1 - 1.0), (0.8, z1 - 0.4), (0.95, z1), (0.75, z1 + 0.6)], 7).moved(x, y, 0)
    parts = [sh]
    # the three tines: the middle straight, the two outers swept out then up, each ending in a barb
    cz = z1 + 0.5

    def tine(sx):
        pts = []
        for t in np.linspace(0.0, 1.0, 7):
            pts.append([x + sx * (3.2 * math.sin(t * 2.0) * (1.0 + 0.2 * t)), y, cz + 6.0 * t + 0.5 * t * t])
        return tube(pts, [0.5, 0.48, 0.42, 0.36, 0.3, 0.2, 0.05], sides=5, cap_end=True)

    parts.append(tube([[x, y, cz], [x, y, cz + 3.0], [x, y, cz + 6.0], [x, y, cz + 8.6]], [0.56, 0.48, 0.34, 0.05], sides=5))
    parts += [tine(-1.0), tine(1.0)]
    for sx, zb, xb in [(0.0, cz + 6.3, 0.0), (-1.0, cz + 4.7, -4.0), (1.0, cz + 4.7, 4.0)]:
        for s in (-1, 1):
            b = tube([[x + xb + s * 0.1, y, zb], [x + xb + s * 0.9, y, zb - 1.0]], [0.26, 0.04], sides=4)
            parts.append(b)
    m = join(parts)
    pn = Perlin3(45)
    C = m.corners()
    v = sstep(0.3, 0.62, 0.5 + 0.5 * pn.fbm(C[..., 0] * 0.8, C[..., 1] * 0.8, C[..., 2] * 0.3, 3))
    m.C[..., :3] = mix(hexc('#8a6a32'), VERDIGRIS, v[..., None])
    return m


def statue_head():
    """A fallen colossal head in its crested helm, lying on one cheek with the sand banked against it, the face turned up to the light. Our own design."""
    p = 0.12
    X, Y, Z, lo, p = field_grid((-6.0, -6.5, -1.0), (6.0, 6.5, 10.0), p)
    pn = Perlin3(46)
    a = 1.05
    c, s = math.cos(a), math.sin(a)
    b_ = 0.5
    cb, sb = math.cos(b_), math.sin(b_)
    Qx, Qz = X * c + (Z - 3.9) * s, -X * s + (Z - 3.9) * c
    px, py, pz = Qx, Y * cb + Qz * sb, -Y * sb + Qz * cb
    d = sd_ellipsoid(px, py, pz, (0.0, 0.0, 0.5), (3.05, 3.5, 3.9))
    d = smin(d, sd_ellipsoid(px, py, pz, (0.0, -1.2, -2.5), (2.15, 2.5, 2.4)), 1.0)       # jaw
    d = smin(d, sd_ellipsoid(px, py, pz, (0.0, -2.6, -3.6), (1.15, 1.2, 0.95)), 0.5)      # chin
    brow = sd_ellipsoid(px, py, pz, (0.0, -3.05, 1.15), (2.4, 0.7, 0.55))
    d = smin(d, brow, 0.35)
    nose = sd_capsule(px, py, pz, (0.0, -3.05, 1.0), (0.0, -4.15, -1.0), 0.42, 0.62)
    d = smin(d, nose, 0.3)
    for sx in (-1, 1):
        d = smax(d, -sd_ellipsoid(px, py, pz, (sx * 1.36, -3.35, 0.3), (0.8, 0.62, 0.46)), 0.16)    # eye sockets
        d = smin(d, sd_ellipsoid(px, py, pz, (sx * 1.34, -2.98, 0.28), (0.5, 0.36, 0.3)), 0.1)       # the blank stone eye
        d = smin(d, sd_ellipsoid(px, py, pz, (sx * 0.5, -3.55, -2.15), (0.52, 0.5, 0.26)), 0.3)      # lips
    d = smax(d, -sd_ellipsoid(px, py, pz, (0.0, -4.05, -2.33), (1.15, 0.4, 0.09)), 0.05)  # the mouth
    helm = sd_ellipsoid(px, py, pz, (0.0, 0.3, 1.2), (3.55, 4.1, 3.75))
    helm = smax(helm, 1.5 - pz - 0.55 * (py + 3.0), 0.12)                 # the rim over the brow, sweeping down behind
    d = smin(d, helm, 0.1)
    crest = smax(np.abs(px) - 0.75, sd_ellipsoid(px, py, pz, (0.0, 1.0, 2.9), (1.5, 6.6, 5.2)), 0.1)
    crest = smax(crest, 1.6 - pz, 0.3)
    d = smin(d, crest, 0.12)
    d += 0.07 * pn.fbm(X / 1.0, Y / 1.0, Z / 1.0, 4)
    bite = np.sqrt((px - 3.2) ** 2 + (py - 3.2) ** 2 + (pz - 3.0) ** 2) - 3.0 + 0.9 * pn.fbm(X / 1.4, Y / 1.4, Z / 1.4, 3)
    d = smax(d, -bite, 0.12)
    F = np.maximum(d, (lo[2] + p * 1.6) - Z)
    close_field(F, p)
    return surface_nets(F, lo, p)


# ---------------------------------------------------------------- the arena
def arcade_tier(w, t, z0, h, face_y, rs, recess=1.6, gold=False):
    """One storey of one bay's face, the Colosseum's way: pier, half column, an arch set deep with a dark back wall; solid behind, so nothing swims through."""
    hw = (w - 3.2) / 2.0
    spring = z0 + (h - 1.3) * 0.62
    top = z0 + h - 1.3
    sgn = 1.0 if face_y > 0 else -1.0
    y0, y1 = face_y, face_y - sgn * recess
    # the frame: left and right piers, the arch stitched to the top band
    N = 7
    inner = []
    for a in np.linspace(math.pi, 0.0, N):
        inner.append((hw * math.cos(a), spring + (top - spring) * math.sin(a)))
    outer = []
    for x, _ in inner:
        outer.append((x * (w / 2.0) / hw, top + 0.02))
    Pf = np.array([[[q[0], y0, q[1]] for q in inner], [[q[0], y0, q[1]] for q in outer]])
    arch_face = grid(Pf, S=False, flip=(sgn > 0))
    soffit = grid(np.array([[[q[0], y0, q[1]] for q in inner], [[q[0], y1, q[1]] for q in inner]]), S=True, flip=(sgn < 0))
    back = box(-hw - 0.1, hw + 0.1, min(y1, y1 + sgn * 0.05), max(y1, y1 + sgn * 0.05), z0, top + 0.4)
    parts = [arch_face, soffit, back]
    a, b = (min(y0, y1), max(y0, y1))
    for s in (-1, 1):
        x0, x1 = (s * hw, s * w / 2.0) if s > 0 else (s * w / 2.0, s * hw)
        parts.append(box(x0, x1, a, b, z0, spring))
        parts.append(box(s * w / 2.0 - 0.4 if s > 0 else s * w / 2.0, s * w / 2.0 + 0.0 if s > 0 else s * w / 2.0 + 0.4, a, b, spring, top + 0.02))
        hc = lathe([(0.62, z0 + 0.1), (0.5, z0 + 0.5), (0.42, z0 + h - 2.2), (0.6, z0 + h - 1.75), (0.66, z0 + h - 1.5)], 6).moved(s * (w / 2.0 - 0.8), face_y + sgn * 0.15, 0.0)
        parts.append(hc)
    parts.append(box(-w / 2.0 - 0.04, w / 2.0 + 0.04, a - 0.0 if sgn > 0 else y0 - 0.34, y0 + 0.34 if sgn > 0 else b, top, z0 + h, nx=3))
    # the moulded string course that closes the storey, and the keystone over the arch
    import gen_arch as R_
    parts.append(R_.moulding(-w / 2.0, w / 2.0, face_y, z0 + h - 1.12, [(0.0, 0.0), (0.1, 0.06), (0.14, 0.22), (0.26, 0.3), (0.3, 0.46), (0.0, 0.5)], sgn, MARBLE * 1.02))
    ky0, ky1 = (face_y - 0.5, face_y + 0.16) if sgn > 0 else (face_y - 0.16, face_y + 0.5)
    parts.append(R_.bevel_box(-0.55, 0.55, ky0, ky1, top - 0.95, top + 0.28, c=0.08, col=MARBLE))
    m = join(parts)
    return m


ARENA_T = 9.0                                                           # the ring's thickness, pier face to pier face


def arena_bay():
    """One bay of the oval: three storeys of arches on both faces, each set 3.7 m deep into the wall, with half columns on the piers and a dark core wall behind. Outer face -y, inner +y.
    Blind at the core, so nothing swims through; the depth is real, so the shadows are."""
    rs = np.random.RandomState(47)
    w, t = 11.9, ARENA_T
    ht = [10.6, 9.8, 8.6]
    parts = [box(-w / 2.0 - 0.02, w / 2.0 + 0.02, -t / 2.0 - 0.2, t / 2.0 + 0.2, -6.5, 0.4, nx=4)]
    z = 0.4
    for i, h in enumerate(ht):
        parts.append(arcade_tier(w, t, z, h, -t / 2.0, rs, recess=3.7))
        parts.append(arcade_tier(w, t, z, h, t / 2.0, rs, recess=3.7))
        z += h
    parts.append(box(-w / 2.0, w / 2.0, -t / 2.0 + 0.2, t / 2.0 - 0.2, z, z + 2.4, nx=3))
    parts.append(box(-w / 2.0 - 0.03, w / 2.0 + 0.03, -t / 2.0, t / 2.0, z + 2.4, z + 2.9, nx=3))
    m = join(parts)

    def dark(P, n):
        y = np.abs(P[..., 1])
        return 0.86 * ((y < t / 2.0 - 3.3) & (P[..., 2] < z)) * (np.abs(n[..., 1]) > 0.7)
    m = paint_marble(m, 47, 0.6, course=1.8, stone=3.2, dark=dark)
    m.col_box = (5.3, t / 2.0)                                           # as wide as the wall's inner face: neighbours meet there and never overlap
    return m


def arena_bay_broken():
    """A bay the sea has opened: one storey still stands, the storey over it is broken down to a stepped ruin, and the open water shows through the gap. Faces as arena_bay."""
    rs = np.random.RandomState(58)
    w, t = 11.9, ARENA_T
    parts = [box(-w / 2.0 - 0.02, w / 2.0 + 0.02, -t / 2.0 - 0.2, t / 2.0 + 0.2, -6.5, 0.4, nx=4)]
    h = 10.6
    parts.append(arcade_tier(w, t, 0.4, h, -t / 2.0, rs, recess=3.7))
    parts.append(arcade_tier(w, t, 0.4, h, t / 2.0, rs, recess=3.7))
    z = 0.4 + h
    for y, flip in ((-3.0, 1.0), (3.0, -1.0)):
        ruin = lambda x, zm, f=flip: zm < 1.4 + 7.5 * float(sstep(5.6, -5.4, f * x + 0.9 * math.sin(x * 1.4)))
        parts.append(masonry(w, 9.6, 2.6, rs, 7, ruin=ruin, foot=0.0).moved(0.0, y, z))
    m = join(parts)

    def dark(P, n):
        y = np.abs(P[..., 1])
        return 0.86 * ((y < t / 2.0 - 3.3) & (P[..., 2] < 10.0)) * (np.abs(n[..., 1]) > 0.7)
    m = paint_marble(m, 58, 0.75, course=1.5, stone=3.2, dark=dark)
    m.col_low = {'t': 'box', 'x': 0.0, 'y': 0.0, 'z0': -6.5, 'z1': 11.0, 'hx': 5.3, 'hy': t / 2.0}          # the storey that stands is as solid as a whole bay
    return m


def arena_seats():
    """A wedge of the seating bowl: nine worn tiers stepping up from the floor to the wall. Origin at the front's middle, low; climbs toward +y. Set one a bay, turned to face the floor."""
    rs = np.random.RandomState(59)
    n, rise, run = 9, 0.95, 1.5
    Y = n * run
    parts = []
    for i in range(n):
        y0 = i * run
        z1 = (i + 1) * rise + rs.uniform(-0.02, 0.02)
        w0, w1 = 4.9 + (6.5 - 4.9) * (y0 / Y), 6.5
        b = box(-1.0, 1.0, y0, Y, -1.0, z1, nx=3)
        f = (b.V[:, 1] - y0) / max(Y - y0, 1e-3)
        b.V[:, 0] = b.V[:, 0] * (w0 + (w1 - w0) * f) * (1.0 + rs.uniform(-0.003, 0.003))
        parts.append(b)
    m = paint_marble(join(parts), 59, 0.7, course=0.95, stone=3.1)
    # collision: three stacked slabs, disjoint, so a body pushed out of one is never pushed into its neighbour
    m.col_list = [{'t': 'box', 'x': 0.0, 'y': Y * 0.5, 'z0': -1.0, 'z1': 3.0, 'hx': 4.9, 'hy': Y * 0.5 - 0.02},
                  {'t': 'box', 'x': 0.0, 'y': Y * 0.67, 'z0': 3.0, 'z1': 6.0, 'hx': 5.4, 'hy': Y * 0.33 - 0.02},
                  {'t': 'box', 'x': 0.0, 'y': Y * 0.84, 'z0': 6.0, 'z1': 8.55, 'hx': 5.9, 'hy': Y * 0.16 - 0.02}]
    return m


def arena_floor():
    """The arena's mosaic: an oval of worn tesserae: a dull gold border, a running wave, rays of deep blue and old teal, a gold medallion with a trident star at the heart. Silted over in drifts. rx 33, ry 26 at scale 1."""
    pn = Perlin3(60)
    rings, segs = 15, 48
    rr = np.linspace(0.0, 1.0, rings + 1)[1:]
    th = np.linspace(0, TAU, segs, endpoint=False)
    P = np.array([np.stack([33.0 * r * np.cos(th), 26.0 * r * np.sin(th), np.zeros(segs)], 1) for r in rr])
    g_ = grid(P, wrap_v=True, S=False)
    f_ = fan(P[0], (0.0, 0.0, 0.0), S=False)
    if g_.face_normals()[0, 2] < 0:
        g_ = g_.flip()
    if f_.face_normals()[0, 2] < 0:
        f_ = f_.flip()
    m = join([f_, g_])
    C = m.corners()
    fc = C.mean(axis=1)
    r = np.hypot(fc[:, 0] / 33.0, fc[:, 1] / 26.0)
    a = (np.arctan2(fc[:, 1] / 26.0, fc[:, 0] / 33.0) + math.pi) / TAU
    sec = np.floor(a * segs + 1e-6)                                      # the sector this face sits in: patterns follow the mesh, so their edges are clean
    deep, teal, pale, gold, bone = hexc('#143450'), hexc('#2a6e70'), hexc('#8fb3a8'), hexc('#8f6f30'), hexc('#a79e88')
    col = np.where(((sec // 4) % 2 == 0)[:, None], deep, teal)
    wave = r > 0.82
    col[wave] = np.where(((sec[wave] // 2 + np.floor(r[wave] * 15.0)) % 2 == 0)[:, None], bone, deep)
    col[r > 0.935] = gold
    col[(r < 0.42) & (r > 0.33)] = gold
    inner = r < 0.33
    col[inner] = np.where(((sec[inner] // 4) % 2 == 0)[:, None], pale, bone)
    col[inner & ((sec % 16) < 2)] = gold                                 # the three tines of the star
    tess = 0.8 + 0.3 * (np.sin(fc[:, 0] * 37.0 + fc[:, 1] * 53.0) * 0.5 + 0.5)
    col = col * tess[:, None]
    silt = sstep(0.0, 0.42, pn.fbm(fc[:, 0] * 0.06, fc[:, 1] * 0.06, 0.5 + 0 * fc[:, 0], 3))
    col = mix(col, hexc('#8d866e'), (0.8 * silt)[:, None])
    m.C[..., :3] = np.broadcast_to(col[:, None, :], (m.tris, 3, 3))
    return m


def lamp_brazier():
    """A great bronze brazier on a stone foot: three legs, a wide bowl, a tall flame. 8 m tall. Its name puts it in the look's lamp family, so the bells light it; only the flame's corners pass the lamp rule."""
    foot = lathe([(1.5, -0.8), (1.5, 0.5), (1.15, 0.7), (1.0, 1.0), (0.0, 1.0)], 10)
    paint_marble(foot, 61, 0.7, course=99.0, stone=99.0, base=PALE)
    col_ = lathe([(0.34, 1.0), (0.26, 2.0), (0.22, 4.0), (0.34, 4.6), (0.22, 5.2)], 8)
    bowl = lathe([(0.22, 5.2), (1.0, 5.6), (1.8, 6.1), (2.15, 6.65), (1.95, 6.7), (0.0, 6.3)], 12)
    legs = []
    for k in range(3):
        a = k / 3.0 * TAU
        legs.append(tube([[math.cos(a) * 1.05, math.sin(a) * 1.05, 0.95], [math.cos(a) * 0.72, math.sin(a) * 0.72, 3.0], [math.cos(a) * 0.3, math.sin(a) * 0.3, 5.0]], [0.13, 0.1, 0.09], sides=5))
    m = join([col_, bowl] + legs)
    pn = Perlin3(61)
    C = m.corners()
    v = sstep(0.4, 0.7, 0.5 + 0.5 * pn.fbm(C[..., 0] * 1.4, C[..., 1] * 1.4, C[..., 2] * 0.8, 3))
    m.C[..., :3] = mix(hexc('#6d5228'), VERDIGRIS * 0.9, (0.7 * v)[..., None])
    fl = lathe([(0.05, 6.3), (1.6, 6.65), (1.45, 7.2), (1.0, 8.0), (0.5, 8.9), (0.08, 10.0)], 12, wob=lambda t, z, i: 1.0 + 0.34 * np.sin(t * 5.0 + z * 1.3) * min(i / 4.0, 1.0))
    # each ring is turned a little, so the tongues lick round
    for r_ in range(6):
        idx = np.arange(12) + r_ * 12
        a = r_ * 0.34
        x_, y_ = fl.V[idx, 0].copy(), fl.V[idx, 1].copy()
        fl.V[idx, 0], fl.V[idx, 1] = x_ * math.cos(a) - y_ * math.sin(a), x_ * math.sin(a) + y_ * math.cos(a)
    C2 = fl.corners()
    fl.C[..., :3] = mix(np.array([1.0, 0.72, 0.22]), np.array([1.0, 0.42, 0.08]), sstep(7.0, 9.6, C2[..., 2])[..., None])
    fl.glow(1.0)
    return join([foot, m, fl])


def arena_portal():
    """The ring's one way in: a tall arch right through the wall, with two storeys over it. The gate itself hangs in it, held shut by the game."""
    rs = np.random.RandomState(48)
    w, t = 11.9, ARENA_T
    hw, spring, top = 4.2, 8.8, 13.2
    H1 = 20.8
    parts = [masonry(w, H1 - 0.4, t, rs, 13, opening=(hw + 0.3, spring, top + 0.3)).moved(0, 0, 0.4), voussoirs(hw, spring + 0.4, top + 0.4, t, width=1.3, n=13)]
    parts.append(arcade_tier(w, t, H1, 8.6, -t / 2.0, rs))
    parts.append(arcade_tier(w, t, H1, 8.6, t / 2.0, rs))
    z = H1 + 8.6
    parts.append(box(-w / 2.0, w / 2.0, -t / 2.0 + 0.2, t / 2.0 - 0.2, z, z + 2.4, nx=3))
    parts.append(box(-w / 2.0 - 0.03, w / 2.0 + 0.03, -t / 2.0, t / 2.0, z + 2.4, z + 2.9, nx=3))
    # a tablet of gold over the arch
    parts.append(box(-3.4, 3.4, -t / 2.0 - 0.18, -t / 2.0 + 0.1, 16.2, 19.4))

    def gold(P, n):
        return 0.95 * (P[..., 1] < -t / 2.0 - 0.1) * (P[..., 2] > 16.3) * (P[..., 2] < 19.3)
    return paint_marble(join(parts), 48, 0.6, course=1.8, stone=3.2, gold=gold)


def arena_gate():
    """The arena's shut gate: two tall bronze leaves under an arched head, ribbed and studded, a gold trident across them. Fits the portal's arch."""
    hw, spring, top = 4.3, 9.2, 13.6
    th = np.linspace(math.pi, 0.0, 15)
    outline = [(hw * math.cos(a), spring + (top - spring) * math.sin(a)) for a in th]
    N = len(outline)
    y0, y1 = -0.5, 0.5
    Pf = np.array([[[x, y0, z] for x, z in outline], [[x, y0, 0.0] for x, z in outline]])
    Pb = np.array([[[x, y1, z] for x, z in outline], [[x, y1, 0.0] for x, z in outline]])
    f = grid(Pf, S=False)
    b = grid(Pb, S=False, flip=True)
    r = grid(np.array([[[x, y0, z] for x, z in outline], [[x, y1, z] for x, z in outline]]), S=False, flip=True)
    leaf = join([f, b, r, box(-hw, -hw + 0.01, y0, y1, 0, 0.1)])
    parts = [leaf]
    for sy in (-1, 1):
        for z in (2.2, 5.2, 8.2):
            parts.append(box(-hw + 0.2, hw - 0.2, sy * 0.5 - 0.14, sy * 0.5 + 0.14, z - 0.26, z + 0.26, nx=4))
        parts.append(box(-0.13, 0.13, sy * 0.5 - 0.2, sy * 0.5 + 0.2, 0.0, top - 0.2))
    m = join(parts)
    pn = Perlin3(49)
    C = m.corners()
    v = sstep(0.34, 0.62, 0.5 + 0.5 * pn.fbm(C[..., 0] * 0.5, C[..., 1] * 0.5 + 3.0, C[..., 2] * 0.5, 3))
    m.C[..., :3] = mix(hexc('#6d5228'), VERDIGRIS, (0.8 * v)[..., None])
    tr = []                                                              # the mark
    for sy in (-1, 1):
        y = sy * 0.72
        tr.append(box(-0.17, 0.17, y - 0.07, y + 0.07, 3.0, 9.2))
        for sx in (-1, 1):
            tr.append(tube([[sx * 0.1, y, 9.0], [sx * 1.3, y, 9.6], [sx * 1.5, y, 11.1]], [0.17, 0.15, 0.03], sides=4))
        tr.append(tube([[0, y, 9.0], [0, y, 10.4], [0, y, 11.8]], [0.17, 0.15, 0.03], sides=4))
    g = join(tr)
    g.C[..., :3] = GOLD
    return join([m, g])


# ---------------------------------------------------------------- the shrine and its bell
def bell_shrine():
    """A tholos: a round stepped podium, six columns (one snapped), a ring beam and a ribbed dome open at the eye, the bell's chain down the middle.
    Collision is its parts': the podium, each pillar, the roof. The middle is open water, so a swimmer can reach the bell."""
    rs = np.random.RandomState(50)
    R, H = 6.2, 9.6
    podium = lathe([(8.4, -1.2), (8.4, 0.5), (7.5, 0.5), (7.5, 1.0), (6.9, 1.0), (6.9, 1.5), (0.0, 1.5)], 14, S=False)
    pillars = []
    for i in range(6):
        a = i / 6.0 * TAU + 0.26
        x, y = R * math.cos(a), R * math.sin(a)
        import gen_arch as R_
        foot = lathe([(0.84, 1.5), (0.9, 1.7), (0.78, 1.82), (0.72, 1.96), (0.78, 2.04)], 10).moved(x, y, 0)
        if i == 4:
            col = join([foot, R_.fluted(2.04, 6.2, 0.68, 0.62, 2, 12, rs, broken=lambda th: 0.7 * np.sin(th * 2.0)).moved(x, y, 0)])
        else:
            col = join([foot, R_.fluted(2.04, 1.5 + H - 0.7, 0.68, 0.56, 2, 12, rs).moved(x, y, 0),
                        lathe([(0.54, 1.5 + H - 0.72), (0.6, 1.5 + H - 0.62), (0.76, 1.5 + H - 0.42), (0.92, 1.5 + H - 0.3), (0.92, 1.5 + H)], 8).moved(x, y, 0)])
        pillars.append((col, x, y))
    z = 1.5 + H
    ring = lathe([(7.2, z), (7.3, z + 1.0), (7.0, z + 1.0), (6.9, z + 1.5), (5.4, z + 1.5), (5.2, z), (7.2, z)], 14, S=False)
    prof = [(6.9, z + 1.5), (6.6, z + 2.6), (5.6, z + 3.8), (3.9, z + 4.7), (1.8, z + 5.2), (1.3, z + 5.15)]
    inner = [(1.15, z + 4.85), (3.4, z + 4.25), (5.4, z + 1.6)]
    dome = lathe(prof + inner, 16, wob=lambda t, zz, i: 1.0 + 0.03 * np.abs(np.cos(t * 4.0)) * (1 if i < 6 else 0), S=True)
    roof = join([ring, dome])
    m = join([podium] + [c for c, _, _ in pillars] + [roof])

    def gold(P, n):
        r = np.hypot(P[..., 0], P[..., 1])
        return 0.9 * sstep(0.1, 0.0, np.abs(P[..., 2] - (z + 0.5)) - 0.36) * (r > 6.9)

    m = paint_marble(m, 50, 0.7, course=99.0, stone=99.0, gold=gold)
    chain = tube([[0, 0, 7.8], [0.02, 0.02, 9.4], [0, 0, z + 4.9]], [0.1, 0.1, 0.1], sides=4, cap_end=False)
    chain.C[..., :3] = hexc('#3a3a32')
    cross = box(-1.5, 1.5, -0.1, 0.1, z + 4.72, z + 4.98)
    cross.C[..., :3] = hexc('#3a3a32')
    out = join([m, chain, cross])
    out.col_parts = [(podium, 2, 0.0, 0.0)] + [(c, 2 if i != 4 else 1, x, y) for i, (c, x, y) in enumerate(pillars)] + [(roof, 2, 0.0, 0.0)]
    return out


def bell():
    """A great bronze bell, verdigrised, with raised bands and a gold inscription ring. Origin at the mouth, height 3.3 m."""
    prof = [(1.58, 0.0), (1.66, 0.08), (1.52, 0.26), (1.22, 0.74), (1.08, 1.3), (1.02, 1.95), (0.98, 2.3), (0.84, 2.62), (0.58, 2.8), (0.2, 2.86), (0.2, 3.1), (0.34, 3.22), (0.2, 3.34), (0.0, 3.34)]
    m = lathe(prof, 20, wob=lambda t, z, i: 1.0)
    m.T = m.T
    pn = Perlin3(51)
    C = m.corners()
    v = sstep(0.35, 0.62, 0.5 + 0.5 * pn.fbm(C[..., 0] * 1.4, C[..., 1] * 1.4, C[..., 2] * 1.4, 3))
    col = mix(hexc('#8a6a32'), VERDIGRIS, (0.8 * v)[..., None])
    band = (sstep(0.06, 0.0, np.abs(C[..., 2] - 2.1) - 0.12) + sstep(0.06, 0.0, np.abs(C[..., 2] - 0.74) - 0.08))
    m.C[..., :3] = mix(col, GOLD, np.clip(band, 0, 1)[..., None])
    return m


def chest():
    """A sea-chest, oak gone black, iron bands, a corner of its lid sprung; the gold shows at the gap. Origin at the base, 1.9 m wide."""
    w, d, h = 1.9, 1.2, 0.8
    body = box(-w / 2, w / 2, -d / 2, d / 2, 0.0, h, nx=4, ny=2, nz=3)
    oak = hexc('#3a2a1c')
    body.C[..., :3] = oak
    th = np.linspace(0, math.pi, 9)
    rows = []
    for x in np.linspace(-w / 2, w / 2, 5):
        rows.append(np.stack([np.full(9, x), -d / 2 * np.cos(th) * 1.02, h + 0.05 + d / 2 * 0.72 * np.sin(th)], 1))
    lid = grid(np.array(rows), S=True, flip=False)
    end0 = fan(rows[0], rows[0].mean(axis=0), flip=False, S=False)
    end1 = fan(rows[-1], rows[-1].mean(axis=0), flip=True, S=False)
    lidm = join([lid, end0, end1]).outward()
    lidm.C[..., :3] = hexc('#4a3522')
    bands = []
    for x in (-0.62, 0.62):
        bands.append(box(x - 0.08, x + 0.08, -d / 2 - 0.03, d / 2 + 0.03, -0.01, h + 0.06))
        arc = np.stack([np.full(9, x), -(d / 2 + 0.05) * np.cos(th), h + 0.05 + (d / 2 + 0.05) * 0.72 * np.sin(th)], 1)
        bands.append(tube(arc, np.full(9, 0.075), sides=4, cap_end=False))
    b = join(bands)
    b.C[..., :3] = hexc('#5a4a3a')
    lock = box(-0.16, 0.16, -d / 2 - 0.06, -d / 2 + 0.02, h - 0.24, h + 0.14)
    lock.C[..., :3] = hexc('#c9a24a')
    glint = box(-0.7, 0.7, -d / 2 + 0.02, -d / 2 + 0.04, h + 0.0, h + 0.05)
    glint.C[..., :3] = hexc('#ffd35a')
    glint.glow(0.7)
    return join([body, lidm, b, lock, glint])


def pearl():
    """A tide pearl: a sphere with a soft orient. Origin at its middle; it floats. Alpha carries a small glow."""
    m = sphere((0, 0, 0), 0.34, seg=14, rings=10)
    C = m.corners()
    n = C / 0.34
    t = 0.5 + 0.5 * np.sin(n[..., 2] * 3.0 + n[..., 0] * 2.0)
    u = 0.5 + 0.5 * np.sin(n[..., 1] * 4.0 - n[..., 2] * 2.0)
    m.C[..., :3] = mix(mix(hexc('#f4efe6'), hexc('#ffe3ee'), t[..., None]), hexc('#d9f1ff'), (0.6 * u)[..., None])
    m.glow(0.3)
    return m


# ---------------------------------------------------------------- the wreck
def wreck_hull():
    """A generic old three-master on her side in the silt: plank rows, wales, gunports, a raised stern castle with its windows, a forecastle, a stove-in side with the ribs bare."""
    pn = Perlin3(52)
    nf, nv = 24, 10
    L = 46.0
    frames = np.linspace(0.0, 1.0, nf)
    rows = np.linspace(0.0, 1.0, nv)
    P = np.zeros((nf, nv, 3))

    def rail(s):
        return 9.0 + 5.4 * float(sstep(0.3, 0.06, s)) + 2.6 * float(sstep(0.8, 0.98, s))

    for i, s_ in enumerate(frames):
        B = 6.6 * max(1.0 - abs(2.0 * s_ - 0.94) ** 2.5, 0.0) ** 0.62 + 0.9 * float(sstep(0.1, 0.0, s_)) + 0.15
        keel = 0.25 + 1.8 * float(sstep(0.8, 1.0, s_)) ** 2 + 0.8 * float(sstep(0.12, 0.0, s_))
        for j, v in enumerate(rows):
            y = B * math.sin(v * math.pi / 2.0) ** 0.62 * (1.0 - 0.12 * float(sstep(0.62, 1.0, v)))    # tumblehome toward the rail
            P[i, j] = (-L / 2 + s_ * L, y, keel + (rail(s_) - keel) * v ** 1.25)
    side, other = P.copy(), P * np.array([1, -1, 1])
    keep = np.ones((nf - 1, nv - 1), dtype=bool)                         # the wound in her side
    for i in range(nf - 1):
        for j in range(nv - 1):
            s_, v = (i + 0.5) / (nf - 1.0), (j + 0.5) / (nv - 1.0)
            if math.hypot((s_ - 0.54) / 0.13, (v - 0.56) / 0.3) + 0.42 * float(pn(s_ * 9.0, v * 7.0, 0.5)) < 1.0:
                keep[i, j] = False
    A, B_ = grid(side, S=False), grid(other, S=False, flip=True)
    if A.face_normals()[len(A.T) // 2, 1] < 0:
        A, B_ = A.flip(), B_.flip()
    km = np.repeat(keep.ravel(), 2)
    B_.T, B_.C, B_.S = B_.T[km], B_.C[km], B_.S[km]
    hull = join([A, B_])
    C_ = hull.corners()
    fc = C_.mean(axis=1)
    strake = np.floor(fc[:, 2] * 1.05)
    tone = fract(np.sin(strake * 12.3 + np.floor(fc[:, 0] / 6.0) * 4.7) * 437.5)
    col = np.broadcast_to(mix(hexc('#2c2118'), hexc('#7a6040'), (0.25 + 0.75 * tone)[:, None, None]), (hull.tris, 3, 3)).copy()
    w = sstep(0.3, 0.6, 0.5 + 0.5 * pn.fbm(C_[..., 0] * 0.13, C_[..., 1] * 0.13, C_[..., 2] * 0.13, 4))
    col = mix(col, hexc('#4c5e46'), (0.55 * w)[..., None])
    low = sstep(3.0, 0.5, C_[..., 2])
    col = mix(col, hexc('#8a8468'), (0.5 * low)[..., None])
    hull.C[..., :3] = col
    parts = [hull]
    # her inside, seen through the wound: one coarse dark skin
    inn = grid(side[::4, ::3] * np.array([1, 0.96, 1]), S=False)
    if inn.face_normals()[len(inn.T) // 2, 1] > 0:
        inn = inn.flip()
    inn.C[..., :3] = hexc('#120e09')
    parts.append(inn)
    # the deck, a little under the rail, planked fore and aft, open in the waist
    Dk = np.stack([side[:, -2], side[:, -2] * 0.5 + other[:, -2] * 0.5, other[:, -2]], 1) - np.array([0, 0, 0.25])
    deck_ = grid(Dk, S=False)
    if deck_.face_normals()[0, 2] < 0:
        deck_ = deck_.flip()
    fc2 = deck_.corners().mean(axis=1)
    keepd = np.abs(fc2[:, 0] - 2.0) > 6.5
    deck_.T, deck_.C, deck_.S = deck_.T[keepd], deck_.C[keepd], deck_.S[keepd]
    dt = fract(np.sin(np.floor(fc2[keepd, 1] / 1.1) * 3.1) * 91.7)
    deck_.C[..., :3] = np.broadcast_to(mix(hexc('#2e2418'), hexc('#5a4630'), dt[:, None, None]), (deck_.tris, 3, 3))
    parts.append(deck_)
    # the ribs left standing in the wound
    for i in range(8, 17, 1):
        rib = tube(other[i, ::2] + np.array([0, 0.14, 0]), np.full(5, 0.2), sides=4, cap_end=False)
        rib.C[..., :3] = hexc('#54422e')
        parts.append(rib)
    # the wales: long strakes that give a ship her lines
    for j in (4, 7):
        t1 = tube(side[:, j] + np.array([0, 0.1, 0]), np.full(nf, 0.22), sides=4, cap_end=False)
        t2 = tube(other[:9, j] + np.array([0, -0.1, 0]), np.full(9, 0.22), sides=4, cap_end=False)
        t3 = tube(other[16:, j] + np.array([0, -0.1, 0]), np.full(8, 0.22), sides=4, cap_end=False)
        t1.C[..., :3] = t2.C[..., :3] = t3.C[..., :3] = hexc('#1f1812')
        parts += [t1, t2, t3]
    # gunports, black squares along the side
    for k in range(6):
        i = 5 + k * 3
        for src, sg in ((side, 1.0), (other, -1.0)):
            if sg < 0 and 7 < i < 17:
                continue
            c_ = src[i, 6]
            gp = box(c_[0] - 0.55, c_[0] + 0.55, c_[1] + sg * 0.02 - 0.08, c_[1] + sg * 0.02 + 0.08, c_[2] - 0.5, c_[2] + 0.5)
            gp.C[..., :3] = hexc('#0c0a07')
            parts.append(gp)
    # the transom: broad and flat, with the stern windows and a gold-leaf rail gone dull
    tr = grid(np.stack([side[0], other[0]], 0), S=False)
    if tr.face_normals()[0, 0] > 0:
        tr = tr.flip()
    tr.C[..., :3] = hexc('#3a2c1e')
    parts.append(tr)
    for k in (-3.0, 0.0, 3.0):
        w_ = box(-L / 2 - 0.12, -L / 2 + 0.05, k - 0.8, k + 0.8, 11.0, 12.6)
        w_.C[..., :3] = hexc('#0e0b07')
        parts.append(w_)
    parts.append(box(-L / 2 - 0.3, -L / 2 + 0.2, -5.4, 5.4, 13.0, 13.6).tinted(hexc('#8a6c3c')))
    sprit = tube([[L / 2 - 1.0, 0, 11.4], [L / 2 + 4.0, 0, 13.8], [L / 2 + 8.0, 0, 16.2]], [0.5, 0.42, 0.18], sides=5)
    sprit.C[..., :3] = hexc('#3a2c1e')
    parts.append(sprit)
    stump = tube([[-9.0, 0, 8.0], [-9.0, 0, 13.0], [-9.0, 0.2, 14.4]], [0.62, 0.56, 0.42], sides=6)
    stump2 = tube([[11.0, 0, 8.0], [11.0, 0, 11.0], [11.2, 0, 12.2]], [0.56, 0.5, 0.36], sides=6)
    stump.C[..., :3] = stump2.C[..., :3] = hexc('#3a2c1e')
    parts += [stump, stump2]
    m = join(parts)
    m = m.moved(0, 0, -7.0).rot('x', 0.42).rot('y', -0.05).moved(0, 0, 7.0)
    m.V[:, 2] -= m.V[:, 2].min() + 2.2
    return m


def wreck_mast():
    """A broken mast, snapped and leaning, the yard hanging off it and rope gone to weed."""
    pts = [[0, 0, -1.4], [0.3, 0.2, 4.0], [1.2, 0.5, 9.0], [2.5, 1.1, 14.5], [4.2, 1.6, 20.0]]
    m = tube(pts, [0.62, 0.56, 0.48, 0.42, 0.3], sides=6, cap_end=True)
    cn = lathe([(0.9, 0.0), (1.5, 0.5), (1.6, 1.0), (1.4, 1.0), (0.8, 0.45)], 8).moved(2.0, 0.9, 12.4)
    yard = tube([[-4.2, -2.4, 13.4], [2.0, 0.9, 13.6], [7.0, 4.2, 12.0]], [0.16, 0.3, 0.14], sides=5)
    ropes = []
    rs = np.random.RandomState(53)
    for k in range(4):
        a = np.array([rs.uniform(1.0, 2.6), rs.uniform(0.3, 1.2), rs.uniform(9.0, 14.0)])
        b = a + np.array([rs.uniform(1.0, 4.0), rs.uniform(-2.0, 2.0), -rs.uniform(6.0, 11.0)])
        c = (a + b) / 2 + np.array([0.4, 0.4, -0.8])
        r = tube([a, c, b], [0.05, 0.04, 0.04], sides=3)
        r.C[..., :3] = hexc('#39452c')
        ropes.append(r)
    w = join([m, cn, yard])
    pn = Perlin3(53)
    C = w.corners()
    v = sstep(0.34, 0.66, 0.5 + 0.5 * pn.fbm(C[..., 0] * 0.5, C[..., 1] * 0.5, C[..., 2] * 0.3, 3))
    w.C[..., :3] = mix(hexc('#4a3a28'), hexc('#3f5240'), (0.75 * v)[..., None])
    return join([w] + ropes)


def anchor():
    """An old iron anchor with a timber stock, lying over on one fluke."""
    parts = []
    sh = tube([[0, 0, 0.0], [0, 0, 2.6], [0, 0, 5.2]], [0.17, 0.14, 0.12], sides=6)
    ring = []
    th = np.linspace(0, TAU, 11)
    ring = tube(np.stack([0.42 * np.cos(th), 0.0 * th, 5.6 + 0.42 * np.sin(th)], 1), np.full(11, 0.05), sides=4, cap_end=False)
    arms = []
    for s in (-1, 1):
        pts = [[0, 0, 0.1], [s * 0.9, 0, 0.1], [s * 1.7, 0, 0.5], [s * 2.1, 0, 1.3]]
        arms.append(tube(pts, [0.18, 0.15, 0.12, 0.05], sides=5))
        pal = sphere((s * 1.75, 0, 0.8), (0.5, 0.1, 0.42), seg=6, rings=3, S=False)
        arms.append(pal)
    iron = join([sh, ring] + arms)
    pn = Perlin3(54)
    C = iron.corners()
    v = sstep(0.34, 0.62, 0.5 + 0.5 * pn.fbm(C[..., 0], C[..., 1], C[..., 2], 3))
    iron.C[..., :3] = mix(hexc('#3a2a22'), hexc('#8a4a2a'), v[..., None])
    stock = box(-0.26, 0.26, -2.4, 2.4, 4.72, 5.06)
    stock.C[..., :3] = hexc('#3a2c1e')
    m = join([iron, stock]).rot('y', 1.32).rot('x', 0.12)
    m.V[:, 2] -= m.V[:, 2].min() + 0.25
    return m
