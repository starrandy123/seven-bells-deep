# Drowned City: the new seas' pieces: Rimehold's ice, Frost Isle's fort and pines, Cindermere's smokers and lava, Wrackreach's lanterns and bones. Our own designs, from code.
import math

import numpy as np

from meshkit import Mesh, Perlin3, TAU, box, fan, field_grid, grid, hexc, join, lathe, mix, relax, smax, smin, sstep, surface_nets, tube
from gen_arch import COLDLIT, ashlar, bevel_box, face_dir, moulding, voussoirs, wall_core, weather, OGEE, window_unit
from gen_nature import close_field, paint_rock, rock, seams, strata_stack, unit

ICE = hexc('#bfe4ee')
ICE_DEEP = hexc('#4f9fc0')
SNOW = hexc('#eef4f6')
LAVA = np.array([1.0, 0.46, 0.08])


def ice_ceiling():
    """A 48 m tile of sea ice, seen from below: a hanging landscape of pressure ridges and rounded lobes, pale where it is thin, blue where it is thick; a skin of snow on top. Sea level is z 0.
    Its edge sits at the sheet's mean depth, 5.2 m, so tiles turned any way meet with no ridge along the join. The swimmer's ceiling is the world's `ice` grid, not a collider."""
    pn = Perlin3(701)
    S, n = 48.0, 16
    xs = np.linspace(-S / 2.0, S / 2.0, n + 1)
    Xg, Yg = np.meshgrid(xs, xs, indexing='ij')
    edge = np.minimum(1.0 - np.abs(Xg) / (S / 2.0), 1.0 - np.abs(Yg) / (S / 2.0))
    k = sstep(0.0, 0.34, edge)
    lobes = 5.0 * pn.fbm(Xg * 0.052, Yg * 0.052, Xg * 0.0, 3) + 3.4 * (sstep(0.5, 0.9, 0.5 + 0.5 * pn(Xg * 0.13, Yg * 0.13, Xg * 0.0 + 3.0)) - 0.22)
    depth = np.clip(5.2 + k * lobes, 2.6, 6.2)
    under = grid(np.stack([Xg, Yg, -depth], 2), S=True)
    face_dir(under, (0.0, 0.0, -1.0))
    C = under.corners()
    t = sstep(3.0, 8.6, -C[..., 2])
    under.C[..., :3] = mix(ICE * 1.06, ICE_DEEP, t[..., None])
    side = box(-S / 2.0, S / 2.0, -S / 2.0, S / 2.0, -5.2, 0.8, S=False)
    k_ = np.abs(side.face_normals()[:, 2]) < 0.5
    side.T, side.C, side.S = side.T[k_], side.C[k_], side.S[k_]
    side.C[..., :3] = ICE * 0.86
    q = np.linspace(-S / 2.0, S / 2.0, 9)                               # the snow in small squares, not one sheet: the wall samples what is drawn triangle by triangle
    Xt, Yt = np.meshgrid(q, q, indexing='ij')
    top = grid(np.stack([Xt, Yt, np.full(Xt.shape, 0.8)], 2), S=False)
    face_dir(top, (0.0, 0.0, 1.0))
    top.C[..., :3] = SNOW
    return join([under, side, top])


def ice_pillar():
    """A column of ice from the sea floor to the ceiling: a stalagmite and a stalactite that have met, drawn thin at the waist, its sides run smooth by slow water, clear blue with white in its heart. 60 m at scale 1."""
    H = 60.0
    zs = np.linspace(-1.0, H, 21)
    prof = [(6.8 * (1.0 - 0.62 * math.sin(math.pi * min(max(z / H, 0.0), 1.0)) ** 0.8), z) for z in zs]
    wob = lambda th, z, i: 1.0 + 0.035 * np.sin(th * 2.0 + z * 0.09) + 0.02 * np.sin(th * 3.0 - z * 0.13 + 1.0)    # nearly round: a stack of round solids hugs it
    m = lathe(prof, 16, S=True, wob=wob)
    C = m.corners()
    pn = Perlin3(702)
    v = 0.5 + 0.5 * pn.fbm(C[..., 0] * 0.14, C[..., 1] * 0.14, C[..., 2] * 0.05, 3)
    m.C[..., :3] = mix(ICE_DEEP, ICE * 1.1, sstep(0.25, 0.7, v)[..., None])
    return m


def vertex_normals(m):
    """Smooth normals at each corner: colour that follows them shows no facet."""
    n = np.zeros_like(m.V)
    fn = m.face_normals()
    for i in range(3):
        np.add.at(n, m.T[:, i], fn)
    n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
    return n[m.T]


def berg(size, seed, pitch, planes=15, peaks=2):
    """Ice breaks along planes: a body cut by many flat faces whose edges stay sharp, a tilted table for a top, one or two shoulders standing above it. Not a rounded stone."""
    hx, hy, h = size[0] / 2.0, size[1] / 2.0, size[2]
    X, Y, Z, lo, p = field_grid((-hx * 1.25, -hy * 1.25, -1.0), (hx * 1.25, hy * 1.25, h * 1.12), pitch)
    r = np.random.RandomState(seed)
    pn = Perlin3(seed)
    R = (hx + hy + h * 0.5) / 3.0
    t = np.clip(Z / h, 0.0, 1.0)
    U, V = X / (hx * (1.0 - 0.34 * t)), Y / (hy * (1.0 - 0.34 * t))
    d = (np.maximum(np.hypot(U, V), 0.0) - 1.0) * R
    for i in range(planes):                                             # the calved faces
        a_ = r.uniform(0, TAU)
        tilt = r.uniform(-0.25, 0.5)
        n = unit(np.array([math.cos(a_), math.sin(a_), tilt]))
        k = r.uniform(0.62, 0.95)
        d = smax(d, (U * n[0] + V * n[1] + (Z / h - 0.4) * n[2] * 2.0 - k) * R, 0.02 * R)
    tn = unit(np.array([r.uniform(-0.3, 0.3), r.uniform(-0.3, 0.3), 1.0]))
    top = (X / h * tn[0] + Y / h * tn[1] + (Z / h - 0.62) * tn[2]) * h
    for i in range(peaks):                                              # shoulders of older ice over the table
        cx, cy = r.uniform(-0.45, 0.45) * hx, r.uniform(-0.45, 0.45) * hy
        w = r.uniform(0.3, 0.42) * min(hx, hy)
        q = np.maximum(np.hypot(X - cx, Y - cy) / w - 1.0, -1.0) * w + (Z - h) * 0.22
        top = smin(top, q, 0.03 * R)
    d = smax(d, top, 0.03 * R)
    d = d + R * 0.035 * pn.fbm(X / R * 2.4, Y / R * 2.4, Z / R * 2.4, 2)
    d = smax(d, (lo[2] + p * 1.5) - Z, p)
    close_field(d, p)
    return surface_nets(d, lo, p)


def paint_berg(m, seed, sea):
    """White where snow lies, blue where it calved, the blue going deep below the sea line."""
    C = m.corners()
    n = vertex_normals(m)
    pn = Perlin3(seed)
    v = 0.5 + 0.5 * pn.fbm(C[..., 0] * 0.05, C[..., 1] * 0.05, C[..., 2] * 0.09, 3)
    col = mix(ICE_DEEP, ICE * 1.06, sstep(0.25, 0.58, v)[..., None])
    col = mix(col, SNOW, sstep(0.05, 0.6, n[..., 2])[..., None])
    m.C[..., :3] = mix(col, ICE_DEEP * 0.8, sstep(-1.0, -9.0, C[..., 2])[..., None])
    return m


def iceberg():
    """A berg, standing 22 m out of the sea on a blue foot. Origin at the sea."""
    return paint_berg(berg((60.0, 44.0, 36.0), 703, 2.8).moved(0.0, 0.0, -13.0), 703, 0.0)


def ice_floe():
    """A slab of broken sea ice, jammed along a lead: about 16 m by 12, standing 2 m out of the water, snow on it, blue where it broke. Hides the sheet's straight edge."""
    m = relax(rock((16.0, 12.0, 8.0), 716, 1.5, 7, 0.0), 1).moved(0.0, 0.0, -5.6)
    C = m.corners()
    n = vertex_normals(m)
    col = mix(ICE_DEEP, ICE * 1.04, sstep(-5.0, -0.4, C[..., 2])[..., None])
    m.C[..., :3] = mix(col, SNOW, sstep(0.1, 0.6, n[..., 2])[..., None])
    return m


def iceberg_great():
    """The Rime Berg: a mountain of old ice caught in the sheet, 60 m out of the sea, the one thing on the Frozen Sea you can steer by. Origin at the sea."""
    return paint_berg(berg((130.0, 96.0, 92.0), 733, 4.8, planes=18, peaks=3).moved(0.0, 0.0, -30.0), 733, 0.0)


def stair_crown(L=44.45, H=23.0, w=7.0):
    """The Temple Stair on Crown Isle: one long flight of black basalt up from the cove, 77 steps. Origin at its foot, rising along +y. Each tread sits a hand above the ramp cut under it,
    so a walker on the ground walks up it. No collision of its own: the ground under it is the stair."""
    rs = np.random.RandomState(735)
    n = int(round(H / 0.3))
    rise, run = H / n, L / n
    base = hexc('#34322e')
    V, T, C = [], [], []
    for k in range(n):
        z0, z1 = k * rise, (k + 1) * rise
        y0, y1 = k * run, (k + 1) * run
        i = len(V)
        V += [(-w / 2, y0, z0 - 0.04), (w / 2, y0, z0 - 0.04), (w / 2, y0, z1), (-w / 2, y0, z1), (-w / 2, y1, z1), (w / 2, y1, z1)]
        T += [(i, i + 1, i + 2), (i, i + 2, i + 3), (i + 3, i + 2, i + 5), (i + 3, i + 5, i + 4)]
        t = 0.8 + 0.34 * rs.rand()
        moss = rs.rand() < 0.16
        C += [base * t * 0.8] * 4 + [mix(base * t, hexc('#3f5a2c'), 0.4 if moss else 0.0)] * 2
    m = Mesh(np.array(V), np.array(T), S=False)
    m.C[..., :3] = np.array(C)[m.T]
    return m


def kelp_spire():
    """The Nave Spire: a sea stack on the kelp's great rib, standing 45 m out of the water over the forest, the place the otters raft under. Bedded like the pillars of the naves, grown huge."""
    m = strata_stack((30.0, 24.0, 78.0), 731, beds=22, segs=34, prof=lambda t: (1.0 - 0.56 * t ** 1.1) * (1.0 + 0.3 * float(sstep(0.14, 0.0, t))), wander=0.12, wob=0.2)
    e = m.beds
    paint_rock(m, 731, tone=1.2)
    return seams(m, e, 0.5)


def ice_wall():
    """A bay of the Frost Fort's wall: blocks of cut ice, a walkway and merlons on top, snow on every ledge. 14 m wide, 10 m tall."""
    rs = np.random.RandomState(704)
    w, h, t = 14.0, 10.0, 3.0
    parts = [ashlar(-w / 2.0, w / 2.0, 0.0, h, -t / 2.0, -1.0, rs, ICE, 2.5, 4.2, tone=(0.82, 0.3)), ashlar(-w / 2.0, w / 2.0, 0.0, h, t / 2.0, 1.0, rs, ICE, 2.5, 4.2, tone=(0.82, 0.3))]
    parts.append(box(-w / 2.0, w / 2.0, -t / 2.0 - 0.1, t / 2.0 + 0.1, -1.0, 0.0, S=False).tinted(ICE * 0.8))
    parts.append(box(-w / 2.0, w / 2.0, -t / 2.0 - 0.1, t / 2.0 + 0.1, h - 0.02, h + 0.3, S=False).tinted(SNOW))
    for x in np.linspace(-w / 2.0 + 1.0, w / 2.0 - 1.0, 5):
        parts.append(bevel_box(x - 0.8, x + 0.8, -t / 2.0 - 0.05, -t / 2.0 + 0.8, h + 0.3, h + 2.2, c=0.08, col=ICE))
        parts.append(box(x - 0.82, x + 0.82, -t / 2.0 - 0.07, -t / 2.0 + 0.82, h + 2.2, h + 2.36, S=False).tinted(SNOW))
    m = join(parts)
    m.col_box = (w / 2.0 - 0.05, t / 2.0 + 0.1)
    return m


def ice_tower():
    """A round tower of cut ice: a batter at the foot, each course of blocks its own tone and staggered, a jettied crown of merlons, a blue-lit slit or two. 24 m tall."""
    rs = np.random.RandomState(705)
    segs, courses = 18, 10
    parts = []
    zs = np.linspace(-1.0, 18.6, courses + 1)
    rad = lambda z: 6.8 + 1.6 * float(sstep(3.0, -1.0, z))
    for k in range(courses):
        z0, z1 = zs[k], zs[k + 1]
        th = np.linspace(0.0, TAU, segs + 1) + (k % 2) * TAU / segs / 2.0
        P = np.array([[[rad(z) * math.cos(a), rad(z) * math.sin(a), z] for a in th] for z in (z0, z1)])
        g = grid(P, S=True)
        tone = (0.78 + 0.34 * rs.rand(segs))[:, None, None]
        g.C[..., :3] = ICE[None, None, :] * np.repeat(tone, 2, axis=0)
        face_dir_out(g)
        parts.append(g)
    top = lathe([(6.8, 18.6), (7.8, 19.5), (7.9, 21.0), (6.5, 21.1), (0.0, 21.1)], segs, S=False)
    top.C[..., :3] = ICE * 0.92
    parts.append(top)
    parts.append(lathe([(6.5, 21.1), (0.0, 21.3)], segs, S=False).tinted(SNOW))
    for k in range(10):
        a = k / 10.0 * TAU
        parts.append(bevel_box(-1.0, 1.0, -0.6, 0.6, 21.0, 23.0, c=0.08, col=ICE).moved(0.0, -7.2, 0.0).rot('z', a))
        parts.append(box(-1.02, 1.02, -0.62, 0.62, 23.0, 23.2, S=False).tinted(SNOW).moved(0.0, -7.2, 0.0).rot('z', a))
    for k in range(4):
        parts.append(window_unit(0.0, 12.0, 15.0, 0.42, 0.0, -1.0, COLDLIT, ICE * 0.8, depth=-0.04, arched=True, fw=0.16, sill=False).moved(0.0, -6.82, 0.0).rot('z', k * TAU / 4.0 + 0.4))
    return join(parts)


def face_dir_out(m):
    """A band round the z axis: every triangle looks out."""
    n = m.face_normals()
    c = m.corners().mean(axis=1)
    k = n[:, 0] * c[:, 0] + n[:, 1] * c[:, 1] < 0
    m.T[k] = m.T[k][:, ::-1]
    m.C[k] = m.C[k][:, ::-1]
    return m


def arch_wall(w, h, t, hw, spring, top, base, rs, course, stone, width=1.2, n=9):
    """A wall of cut stone with an arch through it: the same way as the triumphal arch: stones up to the opening, the wedge stones round it, the soffit under."""
    def gap(z):
        if z > top + 0.3:
            return 0.0
        return hw + 0.3 if z < spring else (hw + 0.3) * math.sqrt(max(1.0 - ((z - spring) / (top + 0.3 - spring)) ** 2, 0.0))

    parts = wall_core(w, h, t, rs, base=base, course=course, gap=gap, stone=stone)
    parts.append(voussoirs(hw, spring, top, t, width=width, n=n, col=base * 1.05, rs=rs))
    th = np.linspace(math.pi, 0.0, n)
    so = grid(np.array([[[hw * math.cos(a), yy, spring + (top - spring) * math.sin(a)] for a in th] for yy in (-t / 2.0, t / 2.0)]), S=True)
    face_dir(so, (0.0, 0.0, -1.0))
    so.C[..., :3] = base * 0.7
    parts.append(so)
    return parts


def ice_gate():
    """The fort's gate: a tall arch in a wall of cut ice, two square gate towers either side of it, merlons, snow on every ledge. Wide enough for a swimmer or a walker to go through."""
    rs = np.random.RandomState(714)
    w, h, t = 14.0, 13.0, 3.0
    hw, spring, top = 3.4, 6.4, 9.8
    parts = arch_wall(w, h, t, hw, spring, top, ICE, rs, 2.1, 3.8)
    parts.append(box(-w / 2.0, w / 2.0, -t / 2.0 - 0.1, t / 2.0 + 0.1, h - 0.02, h + 0.3, S=False).tinted(SNOW))
    for x in np.linspace(-w / 2.0 + 1.6, w / 2.0 - 1.6, 4):
        parts.append(bevel_box(x - 0.8, x + 0.8, -t / 2.0 - 0.05, -t / 2.0 + 0.8, h + 0.3, h + 2.2, c=0.08, col=ICE))
        parts.append(box(x - 0.82, x + 0.82, -t / 2.0 - 0.07, -t / 2.0 + 0.82, h + 2.2, h + 2.36, S=False).tinted(SNOW))
    for sx in (-1, 1):
        cx = sx * (w / 2.0 + 1.6)
        parts.append(ashlar(cx - 2.0, cx + 2.0, 0.0, h + 3.0, -2.6, -1.0, rs, ICE, 2.1, 2.2, tone=(0.82, 0.3)))
        parts.append(ashlar(cx - 2.0, cx + 2.0, 0.0, h + 3.0, 2.6, 1.0, rs, ICE, 2.1, 2.2, tone=(0.82, 0.3)))
        parts.append(ashlar(-2.6, 2.6, 0.0, h + 3.0, 2.0, 1.0, rs, ICE, 2.1, 2.2, tone=(0.82, 0.3)).rot('z', -math.pi / 2.0).moved(cx, 0.0, 0.0))
        parts.append(ashlar(-2.6, 2.6, 0.0, h + 3.0, 2.0, 1.0, rs, ICE, 2.1, 2.2, tone=(0.82, 0.3)).rot('z', math.pi / 2.0).moved(cx, 0.0, 0.0))
        parts.append(bevel_box(cx - 2.5, cx + 2.5, -3.1, 3.1, h + 3.0, h + 3.7, c=0.12, col=ICE * 0.96))
        parts.append(box(cx - 2.52, cx + 2.52, -3.12, 3.12, h + 3.7, h + 3.9, S=False).tinted(SNOW))
    m = join(parts)
    pier = (w / 2.0 - hw) / 2.0
    m.col_list = [{'t': 'box', 'x': sx * (hw + 0.1 + pier), 'y': 0.0, 'z0': -1.0, 'z1': h + 0.3, 'hx': pier, 'hy': t / 2.0 + 0.1} for sx in (-1, 1)]
    m.col_list.append({'t': 'box', 'x': 0.0, 'y': 0.0, 'z0': top + 0.1, 'z1': h + 0.3, 'hx': hw + 0.2, 'hy': t / 2.0 + 0.1})
    for sx in (-1, 1):
        m.col_list.append({'t': 'box', 'x': sx * (hw - 0.3), 'y': 0.0, 'z0': spring + 1.6, 'z1': top + 0.1, 'hx': 0.5, 'hy': t / 2.0 + 0.1})
        m.col_list.append({'t': 'box', 'x': sx * (w / 2.0 + 1.6), 'y': 0.0, 'z0': -1.0, 'z1': h + 3.9, 'hx': 2.5, 'hy': 3.1})
    return m


def snow_pine():
    """A pine on Frost Isle: tiers of dark needles bowed under snow, each tier's rim torn into branch tips, the trunk showing near the ground. About 14 m."""
    parts = [lathe([(0.34, -0.5), (0.28, 3.0), (0.06, 13.6)], 6).tinted(hexc('#3a2c20'))]
    for i, (z, r) in enumerate(((2.4, 3.8), (4.6, 3.2), (6.6, 2.6), (8.5, 2.0), (10.3, 1.4), (12.0, 0.8))):
        th = np.linspace(0, TAU, 14, endpoint=False) + i * 0.4
        k = 1.0 + 0.2 * np.where(np.arange(14) % 2 == 0, 1.0, -1.0)
        sag = np.where(np.arange(14) % 2 == 0, -0.34, 0.1)
        ring = np.stack([r * k * np.cos(th), r * k * np.sin(th), z - 0.5 + sag], 1)
        c = fan(ring, (0.0, 0.0, z + 2.0))
        face_dir(c, (0.0, 0.0, 1.0))
        Cc = c.corners()
        up = sstep(-0.1, 0.75, (Cc[..., 2] - (z - 0.5)) / 2.5)
        c.C[..., :3] = mix(hexc('#1d3a2c'), SNOW, up[..., None])
        u = fan(ring, (0.0, 0.0, z - 0.9))
        face_dir(u, (0.0, 0.0, -1.0))
        u.C[..., :3] = hexc('#132a20')
        parts += [c, u]
    return join(parts)


def smoker():
    """A black smoker: a chimney of mineral crust grown round a hot vent, lumpy, ringed with sulphur-yellow and rust, a few side spires, its throat glowing. 15 m at scale 1."""
    rs = np.random.RandomState(707)
    pn = Perlin3(707)
    parts = []
    spires = [((0.0, 0.0), 15.0, 1.7), ((2.2, 0.8), 9.0, 1.0), ((-1.9, 1.5), 7.0, 0.9), ((0.6, -2.3), 11.0, 1.1)]
    for (cx, cy), h, r in spires:
        n = 9
        zs = np.linspace(-0.6, h, n)
        pts = np.stack([cx + 0.12 * np.sin(zs * 0.6 + cx) * zs / h, cy + 0.12 * np.cos(zs * 0.5 + cy) * zs / h, zs], 1)    # straight enough to stand as one stack: a lean costs a pile of solids
        rad = r * (1.2 - 0.82 * zs / h) * (1.0 + 0.06 * np.sin(zs * 2.3 + cx * 3.0))
        t_ = tube(pts, rad, sides=7, cap_end=False)
        C = t_.corners()
        v = 0.5 + 0.5 * pn.fbm(C[..., 0] * 0.8, C[..., 1] * 0.8, C[..., 2] * 0.6, 3)
        col = mix(hexc('#17161a'), hexc('#4a3a2c'), v[..., None])
        col = mix(col, hexc('#a88a2c'), (sstep(0.62, 0.78, v) * 0.7)[..., None])
        t_.C[..., :3] = col
        parts.append(t_)
        ring = pts[-1] + np.stack([rad[-1] * np.cos(np.linspace(0, TAU, 7, endpoint=False)), rad[-1] * np.sin(np.linspace(0, TAU, 7, endpoint=False)), np.zeros(7)], 1)
        g = fan(ring, pts[-1] + np.array([0.0, 0.0, -0.2]), S=False)
        face_dir(g, (0.0, 0.0, 1.0))
        g.C[..., :3] = LAVA
        parts.append(g)
    return join(parts)


def lava_crack():
    """A fissure in the basalt: a jagged 30 m split, glowing from below, its lips black and crusted. It lies on the ground; only the molten core passes the look's glow rule."""
    rs = np.random.RandomState(708)
    n = 15
    ts = np.linspace(-15.0, 15.0, n)
    cy = np.cumsum(rs.normal(size=n)) * 0.55
    cy -= cy.mean()
    w = 1.3 * np.sin(np.linspace(0.04, math.pi - 0.04, n)) ** 0.7 * (0.7 + 0.5 * rs.rand(n))
    core = np.stack([np.stack([ts, cy - w * 0.62, np.full(n, 0.03)], 1), np.stack([ts, cy + w * 0.62, np.full(n, 0.03)], 1)], 1)
    c = grid(core, S=False)
    face_dir(c, (0.0, 0.0, 1.0))
    c.C[..., :3] = LAVA
    parts = [c]
    for sgn in (-1, 1):
        lip = np.stack([np.stack([ts, cy + sgn * w * 0.62, np.full(n, 0.03)], 1), np.stack([ts, cy + sgn * w * 1.5, np.full(n, 0.34)], 1), np.stack([ts, cy + sgn * w * 2.4, np.full(n, -0.3)], 1)], 1)
        m = grid(lip, S=True)
        face_dir(m, (0.0, 0.0, 1.0))
        C = m.corners()
        m.C[..., :3] = mix(hexc('#401808'), hexc('#121216'), sstep(0.0, 0.3, C[..., 2] + 0.0)[..., None])
        parts.append(m)
    return join(parts)


def forge_hall():
    """The Drowned Forge: a hall of black stone over a hearth that has never gone out. One great arch in the front, heavy buttresses, a stepped roof; inside, a hood of stone over a pool of fire, an anvil the size of a cart, two quenching troughs. A swimmer goes in by the arch. 40 m wide, 28 deep, 26 tall. Our own design."""
    rs = np.random.RandomState(709)
    base = hexc('#34343a')
    w, h, d, t = 40.0, 22.0, 28.0, 2.6                                  # outer width, wall height, depth, wall thickness
    hw, spring, top = 8.0, 8.5, 17.0
    y0, y1 = -d / 2.0, d / 2.0
    parts = [p.moved(0.0, y0 + t / 2.0, 0.0) for p in arch_wall(w, h, t, hw, spring, top, base, rs, 2.8, 5.0, width=1.5, n=11)]
    parts += [p.moved(0.0, y1 - t / 2.0, 0.0) for p in wall_core(w, h, t, rs, base=base, course=2.8, stone=5.0)]
    for sx in (-1, 1):                                                  # the long walls, the same stone turned a quarter
        for sgn in (1.0, -1.0):
            f = ashlar(-d / 2.0, d / 2.0, 0.0, h, sgn * t / 2.0, sgn, rs, base, 2.8, 5.0, tone=(0.74, 0.4))
            parts.append(f.rot('z', -math.pi / 2.0).moved(sx * (w / 2.0 - t / 2.0), 0.0, 0.0))
    for sx in (-1, 1):                                                  # buttresses
        for x in (11.5, 18.4):
            cx = sx * x
            parts.append(bevel_box(cx - 1.5, cx + 1.5, y0 - 2.4, y0 + 0.1, -1.0, 16.0, c=0.2, col=base * 1.12))
            P = np.array([[cx - 1.5, y0 - 2.4, 16.0], [cx + 1.5, y0 - 2.4, 16.0], [cx + 1.5, y0, 20.0], [cx - 1.5, y0, 20.0]])
            slope = Mesh(P, [[0, 1, 2], [0, 2, 3]], S=False)
            face_dir(slope, (0.0, -1.0, 1.0))
            slope.C[..., :3] = base * 1.0
            parts.append(slope)
            for sgn in (-1.0, 1.0):
                sd = Mesh(np.array([[cx + sgn * 1.5, y0 - 2.4, 16.0], [cx + sgn * 1.5, y0, 16.0], [cx + sgn * 1.5, y0, 20.0]]), [[0, 1, 2]], S=False)
                face_dir(sd, (sgn, 0.0, 0.0))
                sd.C[..., :3] = base * 0.92
                parts.append(sd)
    parts.append(bevel_box(-w / 2.0 - 0.8, w / 2.0 + 0.8, y0 - 0.8, y1 + 0.8, h, h + 1.3, c=0.2, col=base * 0.86))         # the eaves
    parts.append(bevel_box(-w / 2.0 + 4.0, w / 2.0 - 4.0, y0 + 3.0, y1 - 3.0, h + 1.3, h + 3.2, c=0.2, col=base * 0.8))     # the stepped roof
    parts.append(bevel_box(-9.0, 9.0, -6.0, 8.0, h + 3.2, h + 4.6, c=0.2, col=base * 0.76))
    inner = box(-w / 2.0 + t - 0.05, w / 2.0 - t + 0.05, y0 + t - 0.05, y1 - t + 0.05, -1.0, h, S=False).flip()              # the dark of the hall, seen from inside
    inner.C[..., :3] = base * 0.34
    k_ = np.array([not (abs(float(c[1]) - (y0 + t - 0.05)) < 0.01) for c in inner.corners().mean(axis=1)])                    # the wall with the arch has its own back
    inner.T, inner.C, inner.S = inner.T[k_], inner.C[k_], inner.S[k_]
    parts.append(inner)
    back = y1 - t - 0.1                                                 # the hearth stands against the back wall
    parts.append(bevel_box(-7.5, 7.5, back - 7.0, back, -1.0, 1.4, c=0.1, col=base * 1.1))                                   # its kerb
    hood = [(-7.0, back - 6.0, 9.0), (7.0, back - 6.0, 9.0), (7.0, back, 9.0), (-7.0, back, 9.0), (-3.0, back - 3.0, 19.0), (3.0, back - 3.0, 19.0), (3.0, back, 19.0), (-3.0, back, 19.0)]
    hm = Mesh(np.array(hood), [[0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [3, 0, 4], [3, 4, 7], [4, 5, 6], [4, 6, 7], [0, 3, 2], [0, 2, 1]], S=False).outward()
    hm.C[..., :3] = base * 0.78
    under = np.array([[-7.0, back - 6.0, 9.0], [7.0, back - 6.0, 9.0], [7.0, back, 9.0], [-7.0, back, 9.0]])
    parts.append(hm)
    for sx in (-1, 1):                                                  # the hood's corbels
        parts.append(bevel_box(sx * 6.4 - 0.6, sx * 6.4 + 0.6, back - 6.0, back - 4.8, 1.4, 9.0, c=0.1, col=base * 1.0))
    fire = box(-6.6, 6.6, back - 6.4, back - 0.4, 1.3, 1.45, S=False, nx=4, ny=2)
    fire.C[..., :3] = LAVA
    glow = Mesh(under, [[0, 2, 1], [0, 3, 2]], S=False)
    glow.C[..., :3] = np.array([1.0, 0.62, 0.2])
    # the anvil and the troughs
    parts.append(bevel_box(-3.2, 3.2, -4.6, -1.8, -1.0, 2.4, c=0.15, col=base * 0.7))
    parts.append(bevel_box(-4.6, 4.6, -4.2, -2.2, 2.4, 3.8, c=0.12, col=hexc('#22242a')))
    for sx in (-1, 1):
        parts.append(bevel_box(sx * 12.4 - 1.5, sx * 12.4 + 1.5, -2.0, 8.0, -1.0, 2.0, c=0.1, col=base * 1.05))
        q = box(sx * 12.4 - 1.1, sx * 12.4 + 1.1, -1.6, 7.6, 2.0, 2.06, S=False)
        q.C[..., :3] = LAVA * 0.9
        parts.append(q)
    m = weather(join(parts), 709, 0.0, 0.7, low=2.0)
    out = join([m, fire, glow])
    pier = (w / 2.0 - hw) / 2.0
    fy = y0 + t / 2.0
    out.col_list = [{'t': 'box', 'x': sx * (hw + pier), 'y': fy, 'z0': -1.0, 'z1': h + 0.5, 'hx': pier, 'hy': t / 2.0 + 0.1} for sx in (-1, 1)]
    out.col_list.append({'t': 'box', 'x': 0.0, 'y': fy, 'z0': top + 0.1, 'z1': h + 0.5, 'hx': hw, 'hy': t / 2.0 + 0.1})
    out.col_list.append({'t': 'box', 'x': 0.0, 'y': y1 - t / 2.0, 'z0': -1.0, 'z1': h + 0.5, 'hx': w / 2.0, 'hy': t / 2.0 + 0.1})
    out.col_list += [{'t': 'box', 'x': sx * (w / 2.0 - t / 2.0), 'y': 0.0, 'z0': -1.0, 'z1': h + 0.5, 'hx': t / 2.0 + 0.1, 'hy': d / 2.0} for sx in (-1, 1)]
    out.col_list.append({'t': 'box', 'x': 0.0, 'y': 0.0, 'z0': h, 'z1': h + 5.0, 'hx': w / 2.0, 'hy': d / 2.0})           # the roof
    out.col_list.append({'t': 'box', 'x': 0.0, 'y': back - 3.5, 'z0': -1.0, 'z1': 1.5, 'hx': 7.5, 'hy': 3.5})              # the kerb
    out.col_list.append({'t': 'box', 'x': 0.0, 'y': back - 3.0, 'z0': 9.0, 'z1': h, 'hx': 7.0, 'hy': 3.0})                 # the hood
    out.col_list.append({'t': 'box', 'x': 0.0, 'y': -3.2, 'z0': -1.0, 'z1': 3.8, 'hx': 4.6, 'hy': 1.4})                    # the anvil
    out.col_list += [{'t': 'box', 'x': sx * 12.4, 'y': 3.0, 'z0': -1.0, 'z1': 2.0, 'hx': 1.5, 'hy': 5.0} for sx in (-1, 1)]
    return out


def lamp_ghost():
    """A lantern on a broken spar, long past anyone's hand, still alight: a cage of black iron round a pale green flame, big enough to read from across the graveyard."""
    iron = hexc('#1a1a1c')
    spar = tube([[0.0, 0.0, -0.8], [0.2, 0.1, 2.5], [0.5, 0.1, 6.4]], [0.22, 0.17, 0.1], sides=5).tinted(hexc('#2c2820'))
    arm = tube([[0.5, 0.1, 6.2], [1.5, 0.1, 6.3]], [0.07, 0.05], sides=4).tinted(iron)
    flame = lathe([(0.12, 4.3), (0.4, 4.7), (0.46, 5.1), (0.3, 5.5), (0.06, 5.9)], 6, S=True).moved(1.5, 0.1, 0.0)
    flame.C[..., :3] = np.array([0.5, 1.0, 0.62])
    cage = [lathe([(0.56, 4.14), (0.6, 4.24), (0.1, 4.3)], 6, S=False).moved(1.5, 0.1, 0.0).tinted(iron), lathe([(0.6, 5.9), (0.55, 6.0), (0.08, 6.26)], 6, S=False).moved(1.5, 0.1, 0.0).tinted(iron)]
    for k in range(4):
        a = k / 4.0 * TAU + 0.4
        cage.append(tube([[1.5 + 0.58 * math.cos(a), 0.1 + 0.58 * math.sin(a), 4.2], [1.5 + 0.58 * math.cos(a), 0.1 + 0.58 * math.sin(a), 5.95]], [0.03, 0.03], sides=3, cap_end=False).tinted(iron))
    return join([spar, arm, flame] + cage)


def rib_bone():
    """A rib of something very large, curved up out of the silt, 26 m tall: flattened in section as a rib is, a ridge along its outer edge, grey-white, pitted and split with age, dark with old weed at the foot. They ring the Kraken's pit."""
    pn = Perlin3(711)
    n, sides = 22, 12
    th = np.linspace(0.0, 1.0, n)
    pts = np.stack([8.0 * th ** 2, 0.5 * np.sin(th * 3.0), 26.0 * np.sin(th * 1.5) - 0.8], 1)
    d = np.gradient(pts, axis=0)
    d = d / np.linalg.norm(d, axis=1, keepdims=True)
    side = np.array([0.0, 1.0, 0.0])
    out = np.cross(d, side)
    out = out / np.linalg.norm(out, axis=1, keepdims=True)
    a = np.linspace(0.0, TAU, sides, endpoint=False)
    P = np.zeros((n, sides, 3))
    for i in range(n):
        r = 1.65 * (1.0 - 0.8 * th[i] ** 1.4)
        ridge = 1.0 + 0.3 * np.exp(-((a - math.pi) / 0.5) ** 2)
        lump = 1.0 + 0.14 * pn.fbm(pts[i, 0] * 0.3 + np.cos(a), pts[i, 1] * 0.3 + np.sin(a), np.full(sides, pts[i, 2] * 0.22), 2)
        P[i] = pts[i] + (np.cos(a)[:, None] * out[i] * ridge[:, None] + np.sin(a)[:, None] * side * 0.62) * (r * lump)[:, None]
    m = join([grid(P, wrap_v=True), fan(P[-1], pts[-1] + d[-1] * 0.5)]).outward()
    C = m.corners()
    v = 0.5 + 0.5 * pn.fbm(C[..., 0] * 0.5, C[..., 1] * 0.5, C[..., 2] * 0.5, 3)
    col = mix(hexc('#6a6658'), hexc('#c4bea8'), v[..., None])
    col = mix(col, hexc('#3a3226'), (sstep(0.62, 0.8, 0.5 + 0.5 * pn.fbm(C[..., 0] * 1.6, C[..., 1] * 1.6, C[..., 2] * 0.5, 2)) * 0.7)[..., None])
    m.C[..., :3] = mix(hexc('#2a3024'), col, sstep(0.0, 5.0, C[..., 2])[..., None])
    return m
