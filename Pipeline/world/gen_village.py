# Drowned City: W9, the land's own culture: Sunward's oaks, meadow grass and flowers, dry-stone walls, timber-and-stone cottages, a harbour of quays and piers, fishing boats, a lighthouse.
# Foliage carries custom normals, spherical from each clump, so a tree is lit as a soft mass of leaves, not a heap of cards. Our own designs.
import math

import numpy as np

from meshkit import Mesh, Perlin3, TAU, box, fan, grid, hexc, join, lathe, mix, sphere, sstep, tube
from gen_arch import GOLDLIT, ashlar, bevel_box, face_dir, face_out, tile_roof, weather, window_unit
from gen_nature import ribbon, unit

OAK_DARK, OAK_MID, OAK_LIT = hexc('#22401e'), hexc('#3f6a2c'), hexc('#7e9e42')
BARK = hexc('#4a3a2a')
PLASTER = hexc('#d9cfb6')
TIMBER = hexc('#33261a')
FIELD = hexc('#8d8270')


def with_normals(m, N):
    m.N = N
    return m


def beam(a, b, w, col, sides=4):
    t_ = tube([a, b], [w, w], sides=sides, cap_end=False, S=False)
    t_.C[..., :3] = col
    return t_


def foliage(rs, blobs, n_each, size, c0, c1, c2):
    """Cards of leaves round each clump, their corner normals pointing out of the clump, darker in, lit at the crown."""
    V, T, C, N = [], [], [], []
    top = max(b[0][2] + b[1] for b in blobs)
    low = min(b[0][2] - b[1] for b in blobs)
    for c, r in blobs:
        c = np.asarray(c, dtype=np.float64)
        for i in range(n_each):
            v = unit(rs.normal(size=3) * np.array([1.0, 1.0, 0.85]) + np.array([0, 0, 0.2]))
            p = c + v * r * rs.uniform(0.58, 1.12) * np.array([1.0, 1.0, 0.82])
            t = unit(np.cross(v, rs.normal(size=3)))
            b = np.cross(v, t)
            s = size * rs.uniform(0.75, 1.25)
            q = [p - t * s * 0.6, p + b * s * 0.32 + v * s * 0.12, p + t * s * 0.6, p - b * s * 0.32 + v * s * 0.12]
            i0 = len(V)
            V += q
            T += [(i0, i0 + 1, i0 + 2), (i0, i0 + 2, i0 + 3)]
            for g in q:
                h = (g[2] - low) / max(top - low, 1e-3)
                out = float(np.dot(unit(g - c), np.array([0.0, 0.0, 1.0])))
                k = float(np.clip(0.34 + 0.5 * h + 0.3 * out + rs.uniform(-0.1, 0.1), 0, 1))
                C.append(mix(c0, c1, k * 2.0) if k < 0.5 else mix(c1, c2, (k - 0.5) * 2.0))
                N.append(unit(g - c + np.array([0, 0, r * 0.3])))
    V, T, C, N = np.array(V), np.array(T), np.array(C), np.array(N)
    m = Mesh(V, T)
    m.C[..., :3] = C[T]
    return with_normals(m, N[T])


def join_n(meshes):
    """Join, keeping custom normals; a mesh without them keeps its faces' own."""
    Ns = []
    for m in meshes:
        Ns.append(getattr(m, 'N', None) if getattr(m, 'N', None) is not None else np.repeat(m.face_normals()[:, None, :], 3, axis=1))
    out = join(meshes)
    out.N = np.concatenate(Ns)
    return out


def oak(seed, h, spread):
    """An oak on open ground: a short thick bole, heavy limbs reaching out low, a broad round crown made of many clumps, dark underneath and bright on top."""
    rs = np.random.RandomState(seed)
    pn = Perlin3(seed)
    bole = tube([[0, 0, -0.6], [0.05, 0.05, h * 0.16], [0.0, -0.05, h * 0.36]], [0.95, 0.62, 0.5], sides=8, cap_end=False)
    parts = [bole]
    blobs = [((0.0, 0.0, h * 0.74), spread * 0.42)]
    for k in range(6):
        a = k / 6.0 * TAU + rs.uniform(-0.3, 0.3)
        r = spread * rs.uniform(0.55, 0.72)
        z = h * rs.uniform(0.54, 0.72)
        c = (r * math.cos(a), r * math.sin(a), z)
        blobs.append((c, spread * rs.uniform(0.3, 0.38)))
        parts.append(tube([[0.0, 0.0, h * 0.3], [c[0] * 0.5, c[1] * 0.5, z * 0.74], [c[0] * 0.92, c[1] * 0.92, z * 0.96]], [0.36, 0.2, 0.06], sides=5, cap_end=False))
    wood = join(parts)
    C = wood.corners()
    wood.C[..., :3] = mix(hexc('#2c2218'), hexc('#6a5842'), (0.5 + 0.5 * pn.fbm(C[..., 0] * 1.6, C[..., 1] * 1.6, C[..., 2] * 0.5, 3))[..., None])
    core = []
    for c, r in blobs:
        s = sphere(c, (r * 0.56, r * 0.56, r * 0.46), seg=6, rings=3)
        s.C[..., :3] = OAK_DARK * 0.85
        s.N = (s.corners() - np.asarray(c)) / np.maximum(np.linalg.norm(s.corners() - np.asarray(c), axis=-1, keepdims=True), 1e-6)
        core.append(s)
    leaves = foliage(rs, blobs, 88, spread * 0.17, OAK_DARK, OAK_MID, OAK_LIT)
    return join_n([wood] + core + [leaves])


def tree_oak_a():
    return oak(611, 13.0, 9.5)


def tree_oak_b():
    return oak(612, 10.5, 8.0)


def grass_patch():
    """A 4 m tile of meadow grass: 280 slim single-triangle blades, a bit over 17 to the square metre, in tufts, leaning with the wind, their normals up so they light with the ground. Its local z is height above the ground: the look lays each blade on the terrain."""
    rs = np.random.RandomState(613)
    V, T, C = [], [], []
    n = 0
    while n < 280:
        cx, cy = rs.uniform(-2.0, 2.0), rs.uniform(-2.0, 2.0)
        for i in range(rs.randint(3, 8)):
            x, y = cx + rs.normal() * 0.14, cy + rs.normal() * 0.14
            a = rs.uniform(0, TAU)
            s = np.array([math.cos(a), math.sin(a), 0.0]) * rs.uniform(0.022, 0.04)
            h = rs.uniform(0.22, 0.62)
            lean = np.array([rs.uniform(0.1, 0.36), rs.uniform(-0.14, 0.14), 0.0]) * h
            p = np.array([x, y, -0.04])
            i0 = len(V)
            V += [p - s, p + s, p + lean + np.array([0, 0, h])]
            T.append((i0, i0 + 1, i0 + 2))
            tip = mix(hexc('#5f8a38'), hexc('#b8b860'), rs.rand() ** 2)
            C += [hexc('#2e5426'), hexc('#2e5426'), tip]
            n += 1
    V, T, C = np.array(V), np.array(T), np.array(C)
    m = Mesh(V, T)
    m.C[..., :3] = C[T]
    return with_normals(m, np.broadcast_to(unit([0.12, 0.05, 1.0]), (len(T), 3, 3)).copy())


def wildflowers():
    """A 4 m tile of meadow flowers: thin green stems, each head a low dome of five petals 6-8 cm across, its eye darker or brighter: poppy, buttercup, daisy, cornflower, campion."""
    rs = np.random.RandomState(614)
    V, T, C = [], [], []
    cols = [(hexc('#dc6a58'), hexc('#3c2a24')), (hexc('#efd668'), hexc('#d9a93a')), (hexc('#f3f0e6'), hexc('#e0b840')), (hexc('#7f92da'), hexc('#3f4a8c')), (hexc('#e39ab0'), hexc('#c8688c'))]
    for i in range(38):
        x, y = rs.uniform(-2.0, 2.0), rs.uniform(-2.0, 2.0)
        h = rs.uniform(0.34, 0.74)
        a = rs.uniform(0, TAU)
        s = np.array([math.cos(a), math.sin(a), 0.0]) * 0.022
        p = np.array([x, y, -0.05])
        top = p + np.array([rs.uniform(-0.08, 0.08), rs.uniform(-0.08, 0.08), h])
        i0 = len(V)
        V += [p - s, p + s, top]
        T.append((i0, i0 + 1, i0 + 2))
        C += [hexc('#3f6a2c')] * 3
        petal, eye = cols[rs.randint(len(cols))]
        r = rs.uniform(0.03, 0.04)
        tx, ty = rs.uniform(-0.3, 0.3), rs.uniform(-0.3, 0.3)            # each head turned a little its own way
        i1 = len(V)
        V.append(top + np.array([0.0, 0.0, 0.012]))
        C.append(eye)
        a0 = rs.uniform(0, TAU)
        for k in range(5):
            b_ = a0 + k / 5.0 * TAU
            dx, dy = r * math.cos(b_), r * math.sin(b_)
            V.append(top + np.array([dx, dy, tx * dx + ty * dy - 0.004]))
            C.append(petal)
        T += [(i1, i1 + 1 + k, i1 + 1 + (k + 1) % 5) for k in range(5)]
    V, T, C = np.array(V), np.array(T), np.array(C)
    m = Mesh(V, T)
    m.C[..., :3] = C[T]
    return with_normals(m, np.broadcast_to(unit([0.0, 0.0, 1.0]), (len(T), 3, 3)).copy())


def stone_wall():
    """A dry-stone field wall, 8 m, about 1.3 m high: rough fieldstones laid in three uneven courses, a row of cope stones on edge along the top, and two courses of big footing stones below, which is what shows at the low end on a slope. Runs along x."""
    rs = np.random.RandomState(615)
    parts = []
    L = 8.0
    for c in range(-2, 3):
        z = -0.2 + c * 0.44
        x = -L / 2.0 - (0.3 if c % 2 else 0.0)
        while x < L / 2.0 - 0.1:
            w_ = rs.uniform(0.7, 1.4) if c >= 0 else rs.uniform(1.5, 2.6)
            a, b = max(x, -L / 2.0), min(x + w_, L / 2.0)
            th = 0.42 - c * 0.06
            s = box(a + 0.02, b - 0.02, -th + rs.uniform(-0.05, 0.05), th + rs.uniform(-0.05, 0.05), z, z + rs.uniform(0.38, 0.5), S=False)
            k = s.face_normals()[:, 2] > -0.5
            s.T, s.C, s.S = s.T[k], s.C[k], s.S[k]
            s.V = s.V + rs.normal(size=s.V.shape) * 0.022
            s.C[..., :3] = FIELD * (0.7 + 0.5 * rs.rand())
            parts.append(s)
            x += w_
    x = -L / 2.0
    while x < L / 2.0 - 0.1:
        w_ = rs.uniform(0.3, 0.46)
        s = box(x + 0.01, min(x + w_, L / 2.0) - 0.01, -0.3, 0.3, 1.1, 1.1 + rs.uniform(0.2, 0.32), S=False)
        k = s.face_normals()[:, 2] > -0.5
        s.T, s.C, s.S = s.T[k], s.C[k], s.S[k]
        s.C[..., :3] = FIELD * (0.64 + 0.4 * rs.rand())
        parts.append(s)
        x += w_
    return weather(join(parts), 615, 0.75, 0.4, low=0.6)


def timber_wall(L, H, rs, door=None, windows=()):
    """One wall of a cottage, looking -y, centred on x: plaster panels between dark oak posts, rails and braces. door = x of a door; windows = [x, ...]. Its stone footing is laid by the caller."""
    parts = []
    xs = [-L / 2.0] + [x for x in np.linspace(-L / 2.0, L / 2.0, 5)[1:-1]] + [L / 2.0]
    P = np.array([[[x, 0.0, 0.0] for x in xs], [[x, 0.0, H] for x in xs]])
    wall = grid(P, S=False)
    face_dir(wall, (0.0, -1.0, 0.0))
    wall.C[..., :3] = PLASTER * (0.94 + 0.1 * rs.rand(wall.tris // 2).repeat(2))[:, None, None]
    parts.append(wall)
    y = -0.05
    for x in xs:
        parts.append(beam((x, y, 0.0), (x, y, H), 0.1, TIMBER))
    for z in (0.02, H * 0.5, H - 0.02):
        parts.append(beam((-L / 2.0, y, z), (L / 2.0, y, z), 0.09, TIMBER))
    for a, b, s_ in ((xs[0], xs[1], 1.0), (xs[-1], xs[-2], 1.0)):
        parts.append(beam((a, y, 0.0), (b, y, H * 0.5), 0.07, TIMBER))
    if door is not None:
        parts.append(window_unit(door, 0.05, 2.1, 0.55, -0.02, -1.0, hexc('#5a3820'), TIMBER * 1.2, depth=-0.03, arched=False, fw=0.1, sill=False))
    for x in windows:
        parts.append(window_unit(x, H * 0.56, H * 0.56 + 0.92, 0.5, -0.02, -1.0, hexc('#14222a'), TIMBER * 1.3, depth=-0.03, arched=False, fw=0.08))
    return join(parts)


def cottage(seed, L, W, H, rise, roof0, roof1, windows_long=(-2.4, 2.4), door=0.0, chimney=1.0):
    """A cottage of Sunward Hollow: a footing of fieldstone, timber-framed plaster walls, a door and shuttered windows with depth, a tiled roof with an eave, a stone chimney."""
    rs = np.random.RandomState(seed)
    foot = 0.72
    parts = []

    def side(mesh, a, dist):
        return mesh.moved(0.0, -dist, 0.0).rot('z', a)

    for a, l_, d_, dr, ws in ((0.0, L, W / 2.0, door, windows_long), (math.pi, L, W / 2.0, None, windows_long), (math.pi / 2.0, W, L / 2.0, None, (0.0,)), (-math.pi / 2.0, W, L / 2.0, None, (0.0,))):
        s_ = ashlar(-l_ / 2.0, l_ / 2.0, -0.7, foot, 0.0, -1.0, rs, FIELD, 0.72, 1.3, c=0.05, rel=0.05, tone=(0.7, 0.5))
        parts.append(side(s_, a, d_ + 0.08))
        parts.append(side(timber_wall(l_, H - foot, rs, dr, ws).moved(0.0, 0.0, foot), a, d_))
    top = H
    parts_r = tile_roof(L + 0.1, W, rise, 7, 5, roof0, roof1, rs, eave=0.55)
    parts += [p.moved(0.0, 0.0, top) for p in parts_r]
    for sgn in (-1, 1):                                                 # the gable: plaster with a king post
        tri = np.array([[sgn * L / 2.0, -W / 2.0, top], [sgn * L / 2.0, W / 2.0, top], [sgn * L / 2.0, 0.0, top + rise]])
        g = Mesh(tri, [[0, 1, 2]], S=False)
        face_dir(g, (sgn, 0.0, 0.0))
        g.C[..., :3] = PLASTER * 0.92
        parts.append(g)
        parts.append(beam((sgn * (L / 2.0 + 0.04), 0.0, top), (sgn * (L / 2.0 + 0.04), 0.0, top + rise), 0.08, TIMBER))
        parts.append(beam((sgn * (L / 2.0 + 0.04), -W / 2.0, top), (sgn * (L / 2.0 + 0.04), 0.0, top + rise), 0.08, TIMBER))
        parts.append(beam((sgn * (L / 2.0 + 0.04), W / 2.0, top), (sgn * (L / 2.0 + 0.04), 0.0, top + rise), 0.08, TIMBER))
    cx = L * 0.3 * chimney
    parts.append(bevel_box(cx - 0.55, cx + 0.55, -0.55, 0.55, top, top + rise + 1.2, c=0.05, col=FIELD * 0.9))
    parts.append(lathe([(0.2, top + rise + 1.2), (0.17, top + rise + 1.6), (0.21, top + rise + 1.7)], 6).moved(cx, 0.0, 0.0).tinted(hexc('#7a4a34')))
    m = weather(join(parts), seed, 0.1, 0.22, low=0.8)                   # above the sea: a little lichen, a little rain
    m.col_box = (L / 2.0 + 0.1, W / 2.0 + 0.1)
    return m


def cottage_a():
    return cottage(621, 10.0, 7.0, 4.6, 3.4, hexc('#6d3f2c'), hexc('#a86a48'))


def cottage_b():
    """The larger house: two floors, slate blue roof, a door to one side."""
    return cottage(622, 12.0, 7.6, 6.4, 3.8, hexc('#3f4a58'), hexc('#6d7884'), windows_long=(-3.6, 0.0, 3.6), door=-1.6, chimney=-1.0)


def quay():
    """A harbour wall, 12 m of it: big fitted stones down to the seabed, a coping you can walk on, a bollard, an iron mooring ring. Faces the water at -y."""
    rs = np.random.RandomState(623)
    w, h = 12.0, 2.2
    parts = [ashlar(-w / 2.0, w / 2.0, -5.0, h, -2.0, -1.0, rs, FIELD * 1.05, 1.2, 2.6, c=0.08, rel=0.07, tone=(0.74, 0.34))]
    parts.append(bevel_box(-w / 2.0, w / 2.0, -2.3, 2.0, h, h + 0.34, c=0.08, col=FIELD * 1.1))
    parts.append(box(-w / 2.0, w / 2.0, -1.96, 2.0, -5.0, h, S=False).tinted(FIELD * 0.6))
    parts.append(lathe([(0.3, h + 0.3), (0.26, h + 0.8), (0.34, h + 0.92), (0.0, h + 1.0)], 7).tinted(hexc('#3a2e26')))
    th = np.linspace(0, TAU, 9)
    r = tube(np.stack([2.5 + 0.26 * np.cos(th), np.full(9, -2.14), 0.9 + 0.26 * np.sin(th)], 1), np.full(9, 0.035), sides=3, cap_end=False)
    r.C[..., :3] = hexc('#4a3226')
    m = weather(join(parts), 623, 0.85, 0.7, low=3.4)
    return join([m, r])


def pier():
    """A timber pier, 12 m long, 4.4 m wide, deck 1.9 m over the sea: weathered planks across it, moss in the joints, posts down to the seabed, a low rail on one side. Runs along y; origin at sea level."""
    rs = np.random.RandomState(624)
    pn = Perlin3(624)
    L, W, z = 12.0, 4.4, 1.9
    parts = []
    y = -L / 2.0
    while y < L / 2.0:
        d = rs.uniform(0.34, 0.46)
        s = box(-W / 2.0 + rs.uniform(-0.1, 0.1), W / 2.0 + rs.uniform(-0.1, 0.1), y + 0.02, min(y + d, L / 2.0) - 0.02, z - 0.08 + rs.uniform(-0.02, 0.02), z, S=False)
        k = s.face_normals()[:, 2] > -0.5
        s.T, s.C, s.S = s.T[k], s.C[k], s.S[k]
        tone = rs.uniform(0.7, 1.25)
        s.C[..., :3] = mix(hexc('#5a4632'), hexc('#8d6e4c'), rs.rand()) * tone
        parts.append(s)
        y += d
    for sx in (-1, 1):
        parts.append(beam((sx * (W / 2.0 - 0.1), -L / 2.0, z - 0.2), (sx * (W / 2.0 - 0.1), L / 2.0, z - 0.2), 0.14, hexc('#3a2c1e')))
        for yy in (-L / 2.0 + 0.3, 0.0, L / 2.0 - 0.3):
            parts.append(tube([[sx * (W / 2.0 - 0.1), yy, -9.0], [sx * (W / 2.0 - 0.1), yy, z + (1.0 if sx > 0 else 0.1)]], [0.2, 0.17], sides=6, cap_end=True).tinted(hexc('#42362a')))
    parts.append(beam((W / 2.0 - 0.1, -L / 2.0, z + 0.9), (W / 2.0 - 0.1, L / 2.0, z + 0.9), 0.06, hexc('#5a4632')))
    m = join(parts)
    C = m.corners()
    moss = sstep(0.42, 0.68, 0.5 + 0.5 * pn.fbm(C[..., 0] * 0.6, C[..., 1] * 0.6, C[..., 2] * 0.0 + 1.0, 3)) * (m.face_normals()[:, None, 2] > 0.5)
    m.C[..., :3] = mix(m.C[..., :3], hexc('#5e7a34'), (0.75 * moss)[..., None])
    wet = sstep(1.2, -0.2, C[..., 2])
    m.C[..., :3] = mix(m.C[..., :3], hexc('#2a2c22'), (0.8 * wet)[..., None])
    return m


def pier_house():
    """A fisherman's house on stilts at the pier's end: small, shingled, a net shed door. Origin at sea level; floor 1.9 m up."""
    h = cottage(625, 7.0, 5.0, 2.9, 2.4, hexc('#4a4640'), hexc('#7a7468'), windows_long=(-1.9, 1.9), door=0.0, chimney=1.0).moved(0.0, 0.0, 1.9)
    posts = [tube([[sx * 3.2, sy * 2.2, -9.0], [sx * 3.2, sy * 2.2, 1.9]], [0.2, 0.17], sides=6).tinted(hexc('#42362a')) for sx in (-1, 1) for sy in (-1, 1)]
    return join([h] + posts)


def boat_fishing():
    """A small wooden fishing boat, 11 m, moored: a sheered hull, white topsides over a blue strake and red bottom paint, a wheelhouse, a mast with its boom, stays, a heap of net. Runs along x; origin at the waterline."""
    rs = np.random.RandomState(626)
    L = 11.0
    nf, nv = 14, 7
    P = np.zeros((nf, nv, 3))
    for i in range(nf):
        s = i / (nf - 1.0)
        B = 1.9 * max(1.0 - abs(2.0 * s - 0.9) ** 2.4, 0.0) ** 0.6 + 0.04 + 0.5 * float(sstep(0.16, 0.0, s))
        sheer = 1.1 + 0.9 * float(sstep(0.6, 1.0, s)) ** 2 + 0.25 * float(sstep(0.3, 0.0, s))
        keel = -0.9 + 0.8 * float(sstep(0.82, 1.0, s)) + 0.25 * float(sstep(0.12, 0.0, s))
        for j in range(nv):
            v = j / (nv - 1.0)
            P[i, j] = (-L / 2.0 + s * L, B * math.sin(v * math.pi / 2.0) ** 0.7, keel + (sheer - keel) * v ** 1.2)
    a, b = grid(P, S=True), grid(P * np.array([1, -1, 1]), S=True, flip=True)
    if a.face_normals()[len(a.T) // 2, 1] < 0:
        a, b = a.flip(), b.flip()
    hull = join([a, b])
    row = (np.arange(hull.tris) // 2) % (nv - 1)
    col = np.where((row >= 5)[:, None], hexc('#2a5a8c'), np.where((row >= 3)[:, None], hexc('#d6d4c8'), hexc('#7a2c22')))
    hull.C[..., :3] = np.broadcast_to(col[:, None, :], (hull.tris, 3, 3))
    deck_p = np.stack([P[:, -1] - np.array([0, 0, 0.3]), P[:, -1] * np.array([1, -1, 1]) - np.array([0, 0, 0.3])], 1)
    deck = grid(deck_p, S=False)
    face_dir(deck, (0.0, 0.0, 1.0))
    deck.C[..., :3] = hexc('#8d7350')
    parts = [hull, deck]
    wh = bevel_box(-3.4, -1.2, -1.0, 1.0, 0.9, 2.9, c=0.05, col=hexc('#d9d6ca'))
    parts.append(wh)
    parts.append(bevel_box(-3.6, -1.0, -1.2, 1.2, 2.9, 3.05, c=0.04, col=hexc('#2a5a8c')))
    for sy in (-1, 1):
        g = box(-3.1, -1.5, sy * 1.0 - 0.02, sy * 1.0 + 0.02, 1.9, 2.6, S=False).tinted(hexc('#16242c'))
        parts.append(g)
    g = box(-1.22, -1.18, -0.8, 0.8, 1.9, 2.6, S=False).tinted(hexc('#16242c'))
    parts.append(g)
    parts.append(tube([[0.6, 0.0, 0.8], [0.6, 0.0, 9.2]], [0.11, 0.06], sides=5).tinted(hexc('#7a5a3a')))
    parts.append(tube([[0.6, 0.0, 3.6], [-2.8, 0.0, 4.2]], [0.07, 0.05], sides=4).tinted(hexc('#7a5a3a')))
    for q in ((5.4, 0.0, 1.9), (-5.2, 0.0, 1.5), (0.6, 1.8, 1.1), (0.6, -1.8, 1.1)):
        parts.append(tube([[0.6, 0.0, 8.8], q], [0.015, 0.015], sides=3, cap_end=False).tinted(hexc('#2a2a26')))
    nets = sphere((3.2, 0.0, 1.0), (1.1, 0.9, 0.42), seg=7, rings=4)
    nets.C[..., :3] = hexc('#6a7a5a')
    parts.append(nets)
    return join(parts)


def lighthouse():
    """Sunward Light: a tapering tower of pale banded stone on a stepped base, small windows up its side, a railed gallery, a lit lamp room, a dark domed cap. 34 m tall."""
    rs = np.random.RandomState(627)
    prof = [(6.4, -2.0), (6.4, 0.6), (5.4, 0.7), (5.3, 1.8), (4.6, 2.0)]
    rows = []
    for i, t in enumerate(np.linspace(0.0, 1.0, 13)):
        z = 2.0 + t * 22.0
        r = 4.5 - 1.7 * t ** 0.9
        rows.append((r, z))
    tower = lathe(prof + rows + [(3.5, 24.2), (3.5, 24.8), (2.2, 24.9)], 16)
    C = tower.corners()
    band = (np.floor(C.mean(axis=1)[:, 2] / 3.6) % 2 == 1)[:, None, None]
    tower.C[..., :3] = np.where(band, hexc('#c8c2b0'), hexc('#a89f8c'))
    parts = [weather(tower, 627, 0.6, 0.6, low=4.0)]
    for z, a in ((7.0, 0.4), (12.0, 2.2), (17.0, 4.0), (21.0, 5.6)):
        r = 4.5 - 1.7 * ((z - 2.0) / 22.0) ** 0.9
        w_ = window_unit(0.0, z, z + 1.5, 0.42, 0.0, -1.0, hexc('#101a20'), hexc('#8d8676'), depth=0.3, arched=True, proud=0.14, fw=0.12, sill=False)
        parts.append(w_.moved(0.0, -r + 0.05, 0.0).rot('z', a))
    gal = lathe([(3.0, 24.4), (3.9, 24.8), (3.9, 25.05), (2.2, 25.1)], 16, S=False)
    gal.C[..., :3] = hexc('#8d8676')
    rail = lathe([(3.84, 25.1), (3.84, 26.1), (3.72, 26.14), (3.72, 25.1)], 16, S=False)
    rail.C[..., :3] = hexc('#2c3a3e')
    room = lathe([(2.0, 25.1), (2.0, 28.4)], 12)
    room.C[..., :3] = GOLDLIT
    frames = []
    for k in range(6):
        a = k / 6.0 * TAU
        frames.append(tube([[2.04 * math.cos(a), 2.04 * math.sin(a), 25.1], [2.04 * math.cos(a), 2.04 * math.sin(a), 28.4]], [0.08, 0.08], sides=4, cap_end=False).tinted(hexc('#2c3a3e')))
    cap = lathe([(2.5, 28.4), (2.5, 28.7), (1.9, 29.8), (0.8, 30.8), (0.22, 31.2), (0.1, 33.0)], 12)
    cap.C[..., :3] = hexc('#2f4a4a')
    return join(parts + [gal, rail, room, cap] + frames)
