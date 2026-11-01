# Drowned City: the animals, from code, to the owner's bar: "a real life figure and animals". Every body is lofted from stations taken from each
# species' real proportions, in units of total length; colour edges run along mesh rows, so a shark's waterline is as crisp as a mesh edge.
# Head toward -y, spine on x = 0, z = 0 (the life and boss shaders read the bounding box and the raw positions), real metres, no rigs.
import math

import numpy as np

from meshkit import (Mesh, Perlin3, TAU, fan, field_grid, grid, hexc, join, lathe, mix, pchip, sd_capsule, sd_ellipsoid, smax, smin, sphere, sstep, surface_nets, tube)
from gen_nature import close_field, unit

RAD = math.pi / 180.0


def curve(pts, n):
    """Catmull-Rom through key points, n samples."""
    P = np.asarray(pts, dtype=np.float64)
    m = len(P)
    Q = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for s in np.linspace(0, m - 1, n):
        i = min(int(s), m - 2)
        t = s - i
        p0, p1, p2, p3 = Q[i], Q[i + 1], Q[i + 2], Q[i + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    return np.array(out)


def eye_at(p, n, r, ball, iris=None, lid=None, segs=12, pupil=0.62):
    e1 = unit(np.cross(n, [0.13, 0.2, 1.0]))
    e2 = np.cross(n, e1)
    th = np.linspace(0, TAU, segs, endpoint=False)
    cs = np.cos(th)[:, None] * e1 + np.sin(th)[:, None] * e2
    rows = [(1.0, 0.0), (pupil + 0.02, 0.32), (pupil - 0.02, 0.33), (0.3, 0.44)]
    P = np.array([p + cs * r * a + n * r * b for a, b in rows])
    g_, f_ = grid(P, wrap_v=True), fan(P[-1], p + n * r * 0.47)
    if np.dot(g_.face_normals()[0], n) < 0:
        g_ = g_.flip()
    if np.dot(f_.face_normals()[0], n) < 0:
        f_ = f_.flip()
    m = join([g_, f_])
    c = m.corners()
    rad = np.linalg.norm((c - p) - (c - p) @ n[:, None] * n[None, None, :] if False else (c - p) - ((c - p) @ n)[..., None] * n, axis=-1) / r
    fm = rad.mean(axis=1) > pupil
    col = np.broadcast_to(ball, m.C[..., :3].shape).copy()
    if iris is not None:
        col[fm] = iris
    m.C[..., :3] = col
    if lid is None:
        return m
    # the lid: a soft collar of skin
    Q = np.array([p + cs * r * 1.55 - n * r * 0.1, p + cs * r * 1.22 + n * r * 0.2, p + cs * r * 0.98 + n * r * 0.1])
    l = grid(Q, wrap_v=True)
    if np.dot(l.face_normals()[0], n) < 0:
        l = l.flip()
    l.C[..., :3] = lid
    return join([m, l])


def disc_at(p, n, r, col, segs=8, lift=0.0, rough=None):
    """A flat round decal on the skin: a spot, a pore, a belly mark."""
    e1 = unit(np.cross(n, [0.13, 0.2, 1.0]))
    e2 = np.cross(n, e1)
    th = np.linspace(0, TAU, segs, endpoint=False)
    k = 1.0 if rough is None else rough
    ring = p + n * lift + (np.cos(th)[:, None] * e1 + np.sin(th)[:, None] * e2) * r * (np.ones(segs) if rough is None else rough)[:, None]
    m = fan(ring, p + n * lift)
    if np.dot(m.face_normals()[0], n) < 0:
        m = m.flip()
    m.C[..., :3] = col
    return m


def fin(O, e1, e2, LE, TE, th, nu=8, nc=3, colfn=None, tip=0.16, power=0.55, S=True):
    """A fin: a closed airfoil shell between a leading and a trailing edge. O origin, e1 chordwise, e2 spanwise; LE, TE key points (a, b) in that plane.
    colfn(u, c, side) -> rgb, u root..tip, c leading..trailing, side +1 / -1 for the two faces."""
    O, e1, e2 = np.asarray(O, np.float64), np.asarray(e1, np.float64), np.asarray(e2, np.float64)
    n = np.cross(e1, e2)
    n = n / np.linalg.norm(n)
    le, te = curve(LE, nu + 1), curve(TE, nu + 1)
    us = np.linspace(0, 1, nu + 1)
    cs = np.linspace(0, 1, nc + 1) ** 1.25
    A = np.zeros((nu + 1, nc + 1, 3))
    B = np.zeros((nu + 1, nc + 1, 3))
    for i in range(nu + 1):
        for j in range(nc + 1):
            c = cs[j]
            p = le[i] * (1 - c) + te[i] * c
            h = 0.5 * th * (1.0 - (1.0 - tip) * us[i]) * math.sin(math.pi * c ** power) ** 0.85
            A[i, j] = O + e1 * p[0] + e2 * p[1] + n * h
            B[i, j] = O + e1 * p[0] + e2 * p[1] - n * h
    a, b = grid(A), grid(B, flip=True)
    if np.dot(a.face_normals()[len(a.T) // 2], n) < 0:
        a, b = a.flip(), b.flip()
    if colfn is not None:
        U = np.repeat(us[:, None], nc + 1, axis=1).ravel()
        C = np.repeat(cs[None, :], nu + 1, axis=0).ravel()
        for mesh, sd in ((a, 1.0), (b, -1.0)):
            mesh.C[..., :3] = colfn(U[mesh.T], C[mesh.T], np.full(mesh.T.shape, sd))
    return join([a, b])


def mirrored(m):
    return m.scaled(-1.0, 1.0, 1.0)


class Body:
    """A body lofted along y. keys: t, top, bot, hw, zw (level of the widest point), n (section exponent, 2 an ellipse, higher boxier), in units of L."""

    def __init__(self, L, keys, ax=None, y_nose=None):
        self.L = L
        self.k = {a: np.asarray(b, dtype=np.float64) for a, b in keys.items()}
        self.y0 = -L / 2.0 if y_nose is None else y_nose
        self.ax = ax
        self.disp = None

    def sec(self, t):
        k = self.k
        top = pchip(k['t'], k['top'], t)
        bot = pchip(k['t'], k['bot'], t)
        hw = pchip(k['t'], k['hw'], t)
        zw = pchip(k['t'], k['zw'], t) if 'zw' in k else (top + bot) * 0.5
        n = pchip(k['t'], k['n'], t) if 'n' in k else np.full_like(np.asarray(t, dtype=np.float64), 2.0)
        return top, bot, hw, zw, n

    def point(self, t, phi, side=1.0, extra=0.0):
        """t along the body, phi from the dorsal line (0) to the ventral (pi), side +1 for x > 0."""
        t = np.asarray(t, dtype=np.float64)
        phi = np.asarray(phi, dtype=np.float64)
        top, bot, hw, zw, n = self.sec(t)
        s, c = np.sin(phi), np.cos(phi)
        ex = 2.0 / n
        x = hw * np.abs(s) ** ex
        hz = np.where(c >= 0, top - zw, zw - bot)
        z = zw + np.sign(c) * hz * np.abs(c) ** ex
        ax = 0.0 if self.ax is None else self.ax(t)
        L = self.L
        P = np.stack([side * x * L, self.y0 + t * L + 0.0 * x, (z + ax) * L], axis=-1)
        if self.disp is not None or np.any(extra):
            nn = self.normal(t, phi, side)
            d = (self.disp(t, phi, side) if self.disp is not None else 0.0) + extra
            P = P + nn * np.asarray(d)[..., None]
        return P

    def normal(self, t, phi, side=1.0):
        top, bot, hw, zw, n = self.sec(t)
        s, c = np.sin(phi), np.cos(phi)
        hz = np.where(c >= 0, top - zw, zw - bot)
        nx = s / np.maximum(hw, 1e-4) * side
        nz = c / np.maximum(hz, 1e-4)
        l = np.sqrt(nx * nx + nz * nz)
        # the slope of the body at this station
        e = 0.004
        ta, tb = np.clip(t - e, 0, 1), np.clip(t + e, 0, 1)
        ra = self._rad(ta, phi)
        rb = self._rad(tb, phi)
        ny = -(rb - ra) / np.maximum(tb - ta, 1e-6) * 1.0
        v = np.stack([nx / l, ny, nz / l], axis=-1)
        return v / np.linalg.norm(v, axis=-1, keepdims=True)

    def _rad(self, t, phi):
        top, bot, hw, zw, n = self.sec(t)
        s, c = np.sin(phi), np.cos(phi)
        hz = np.where(c >= 0, top - zw, zw - bot)
        ex = 2.0 / n
        return np.hypot(hw * np.abs(s) ** ex, hz * np.abs(c) ** ex)

    def loft(self, ts, rows, skin, cap_tail=True):
        """ts stations; rows(t) -> half-ring of angles (0 .. pi), same length every station. skin(t, phi, side, P, face_phi, face_t) -> rgb at corners."""
        ts = np.asarray(ts, dtype=np.float64)
        Phi = np.stack([rows(t) for t in ts], 0)                         # (rings, R + 1)
        R = Phi.shape[1] - 1
        full = np.concatenate([Phi, Phi[:, -2:0:-1]], axis=1)            # around, wrap
        sides = np.concatenate([np.ones(R + 1), -np.ones(R - 1)])
        side_full = np.broadcast_to(sides, full.shape)
        tt = np.broadcast_to(ts[:, None], full.shape)
        P = self.point(tt, full, side_full)
        m = grid(P, wrap_v=True)
        Tv, Pv, Sv = tt.ravel(), full.ravel(), side_full.ravel()
        fphi = Pv[m.T].mean(axis=1)
        ft = Tv[m.T].mean(axis=1)
        cols = skin(Tv[m.T], Pv[m.T], Sv[m.T], m.corners(), fphi, ft)
        m.C[..., :3] = cols
        parts = [m]
        nose = P[0].mean(axis=0)
        nf = fan(P[0], nose)
        nf.C[..., :3] = skin(np.full((nf.tris, 3), ts[0]), np.full((nf.tris, 3), 1.0), np.ones((nf.tris, 3)), nf.corners(), np.full(nf.tris, 1.0), np.full(nf.tris, ts[0]))
        parts.append(nf)
        if cap_tail:
            tf = fan(P[-1], P[-1].mean(axis=0))
            tf.C[..., :3] = skin(np.full((tf.tris, 3), ts[-1]), np.full((tf.tris, 3), 1.0), np.ones((tf.tris, 3)), tf.corners(), np.full(tf.tris, 1.0), np.full(tf.tris, ts[-1]))
            parts.append(tf)
        return join(parts).outward()

    def strip(self, ts, phis, side, width, col, lift=0.006):
        """A decal laid on the skin along (t, phi): a mouth, a gill slit, a throat groove. width: a number or a list, metres."""
        ts, phis = np.asarray(ts, dtype=np.float64), np.asarray(phis, dtype=np.float64)
        P = self.point(ts, phis, side, extra=lift)
        N = self.normal(ts, phis, side)
        d = np.gradient(P, axis=0)
        b = np.cross(N, d)
        b = b / np.maximum(np.linalg.norm(b, axis=1, keepdims=True), 1e-9)
        w = np.broadcast_to(np.asarray(width, dtype=np.float64), ts.shape)[:, None] * 0.5
        m = grid(np.stack([P - b * w, P + b * w], 1))
        if np.dot(m.face_normals()[len(ts) // 2], N[len(ts) // 2]) < 0:
            m = m.flip()
        m.C[..., :3] = col
        return m

    def dome(self, t, phi, side, r, h, col, seg=5):
        """A flattened knob on the skin: a tubercle, a barnacle."""
        p = self.point(np.array(t), np.array(phi), side)
        n = self.normal(np.array(t), np.array(phi), side)
        e1 = unit(np.cross(n, [0.0, 1.0, 0.13]))
        e2 = np.cross(n, e1)
        th = np.linspace(0, TAU, seg, endpoint=False)
        cs = np.cos(th)[:, None] * e1 + np.sin(th)[:, None] * e2
        # a rounded boss: a foot in the skin, a shoulder, a soft top
        rows = np.array([p + r * cs * 1.15 - n * r * 0.12, p + r * cs * 0.72 + n * h * 0.7])
        m = join([grid(rows, wrap_v=True), fan(rows[-1], p + n * h)])
        if np.dot(m.face_normals()[0], n) < 0:
            m = m.flip()
        m.C[..., :3] = col
        return m

    def eye(self, t, phi, side, r, ball, iris=None, lid=None, segs=12, pupil=0.62):
        """A real eye, not a stud: a shallow dome with a round pupil (rings on the pupil's edge, so it is crisp), set in a low fold of skin."""
        p = self.point(np.array(t), np.array(phi), side)
        n = self.normal(np.array(t), np.array(phi), side)
        return eye_at(p, n, r, ball, iris, lid, segs, pupil)


def rows_with(waterline, nd, nv, phi_top=0.0, phi_bot=math.pi):
    """Half-ring angles with one row exactly on the waterline(t), so a colour edge lies on a mesh edge."""
    def f(t):
        w = float(waterline(t))
        return np.concatenate([np.linspace(phi_top, w, nd, endpoint=False), np.linspace(w, phi_bot, nv + 1)])
    return f


def jag(seed, f=1.0):
    """A one-dimensional wobble for a line's edge."""
    pn = Perlin3(seed)

    def j(t):
        return float(pn(t * 19.0 * f, 0.3, 1.7) + 0.5 * pn(t * 53.0 * f, 2.1, 0.4))
    return j


# ---------------------------------------------------------------- great white shark
def shark():
    """Carcharodon carcharias, 4.2 m: conical snout, black eye, five long gill slits, tall stiff first dorsal, tiny second dorsal and anal, sickle pectorals with black tips
    beneath, a caudal keel and a tail nearly lunate; grey above, white below, the line between them sharp and torn."""
    L = 4.2
    k = dict(
        t=[0.0, 0.012, 0.03, 0.06, 0.09, 0.13, 0.19, 0.26, 0.33, 0.40, 0.48, 0.56, 0.63, 0.70, 0.76, 0.80, 0.84],
        top=[0.0035, 0.0125, 0.024, 0.042, 0.056, 0.072, 0.089, 0.1015, 0.1055, 0.1015, 0.0895, 0.073, 0.0555, 0.039, 0.0285, 0.0235, 0.0195],
        bot=[0.0025, -0.0035, -0.0105, -0.0225, -0.0365, -0.057, -0.084, -0.1035, -0.1095, -0.1045, -0.0895, -0.0715, -0.0505, -0.0315, -0.0185, -0.0125, -0.0045],
        hw=[0.0002, 0.011, 0.0245, 0.0445, 0.0595, 0.0745, 0.0895, 0.0985, 0.1, 0.093, 0.0805, 0.0635, 0.0455, 0.03, 0.024, 0.0165, 0.0055],
        zw=[0.003, 0.0045, 0.006, 0.006, 0.004, 0.0, -0.004, -0.005, -0.004, -0.003, -0.001, 0.001, 0.003, 0.004, 0.0065, 0.0085, 0.0085],
        n=[2.0, 2.0, 2.1, 2.2, 2.2, 2.2, 2.2, 2.3, 2.3, 2.3, 2.3, 2.3, 2.4, 2.6, 2.2, 2.2, 2.0],
    )
    b = Body(L, k)
    wob = jag(201)

    def water(t):
        base = float(np.interp(t, [0.0, 0.1, 0.2, 0.33, 0.5, 0.68, 0.8, 0.84], [112, 106, 101, 97, 95, 88, 74, 66])) * RAD
        return base + (4.5 * RAD) * wob(t) * sstep(0.02, 0.1, t)

    pn = Perlin3(202)

    def skin(t, phi, side, P, fphi, ft):
        w = np.array([water(x) for x in ft])
        upper = fphi < w
        n = pn.fbm(P[..., 0] * 2.0, P[..., 1] * 2.0, P[..., 2] * 2.0, 3)
        fine = pn.fbm(P[..., 0] * 9.0, P[..., 1] * 9.0, P[..., 2] * 9.0, 2)
        back = mix(hexc('#343e47'), hexc('#6b7680'), sstep(20 * RAD, 96 * RAD, phi + 0.16 * n)[..., None])
        back = back * (0.9 + 0.2 * n[..., None] + 0.1 * fine[..., None])
        back = mix(back, hexc('#8d8775'), (0.16 * sstep(0.1, 0.5, n))[..., None])
        # the head is paler and scratched, the old scars of its own kind
        back = mix(back, hexc('#8c969c'), (0.22 * sstep(0.16, 0.04, t) * sstep(0.1, 0.45, fine))[..., None])
        belly = hexc('#f1f2ec') * (0.95 + 0.06 * n[..., None] + 0.04 * fine[..., None])
        return np.where(upper[:, None, None], back, belly)

    gills = [0.185, 0.2, 0.215, 0.23, 0.245]

    def relief(t, phi, side):
        out = 0.0
        band = sstep(62 * RAD, 74 * RAD, phi) * sstep(128 * RAD, 116 * RAD, phi)
        for g in gills:                                                  # each slit's rear lip stands over the next
            out = out + band * 0.016 * sstep(g + 0.0125, g + 0.0005, t) * sstep(g - 0.0006, g + 0.0006, t)
        # the lateral ridge toward the keel; a soft shoulder over the pectoral
        out = out + 0.012 * np.exp(-((phi - 1.62) / 0.14) ** 2) * sstep(0.52, 0.72, t)
        out = out + 0.014 * np.exp(-((phi - 2.0) / 0.3) ** 2) * np.exp(-((t - 0.26) / 0.05) ** 2)
        # the brow over the eye
        return out + 0.012 * np.exp(-((phi - 1.14) / 0.16) ** 2) * np.exp(-((t - 0.075) / 0.03) ** 2)

    b.disp = relief
    g_rings = [g + d for g in gills for d in (-0.0015, 0.0015, 0.0075)]
    ts = np.array(sorted(set(np.round(np.concatenate([[0.0015, 0.006, 0.012, 0.02], np.linspace(0.03, 0.18, 14), g_rings, np.linspace(0.256, 0.30, 4), np.linspace(0.32, 0.84, 26)]), 5))))
    body = b.loft(ts, rows_with(water, 8, 6), skin)
    parts = [body]

    def grey_fin(u, c, side):
        return np.broadcast_to(hexc('#4a5560'), u.shape + (3,)).copy()

    def top_white(tipk=0.0):
        def f(u, c, side):
            top = mix(hexc('#3d4750'), hexc('#59646d'), sstep(0.0, 0.6, u)[..., None])
            under = np.where(side[..., None] > 0, top, mix(hexc('#efefe8'), hexc('#121416'), sstep(0.66, 0.76, u)[..., None]))
            return under
        return f

    def Ptop(t):
        return b.point(np.array(t), np.array(0.0))

    # first dorsal: stiff, tall, the trailing edge concave, a free rear tip
    t0, t1 = 0.335, 0.455
    z0 = float(Ptop(t0)[2])
    O = np.array([0.0, b.y0 + t0 * L, z0 - 0.09])
    fd = fin(O, [0, 1, 0], [0, 0, 1], [(0.0, 0.0), (0.135, 0.15), (0.28, 0.36), (0.41, 0.54), (0.5, 0.62)], [(0.52, 0.0), (0.54, 0.09), (0.50, 0.25), (0.47, 0.42), (0.5, 0.62)], 0.085, nu=9, nc=3,
             colfn=lambda u, c, s: mix(hexc('#4a5560'), hexc('#2f373e'), sstep(0.5, 1.0, u)[..., None]))
    parts.append(fd)
    # second dorsal and anal: tiny, the tell of the family
    O = np.array([0.0, b.y0 + 0.625 * L, float(Ptop(0.625)[2]) - 0.03])
    parts.append(fin(O, [0, 1, 0], [0, 0, 1], [(0.0, 0.0), (0.05, 0.05), (0.09, 0.11)], [(0.16, 0.0), (0.13, 0.05), (0.09, 0.11)], 0.018, nu=3, nc=2, colfn=grey_fin))
    pa = b.point(np.array(0.665), np.array(math.pi))
    parts.append(fin((0.0, pa[1], pa[2] + 0.03), [0, 1, 0], [0, 0, -1], [(0.0, 0.0), (0.05, 0.05), (0.09, 0.1)], [(0.14, 0.0), (0.12, 0.05), (0.09, 0.1)], 0.018, nu=3, nc=2,
                     colfn=lambda u, c, s: np.broadcast_to(hexc('#d9dcd8'), u.shape + (3,)).copy()))
    # pectorals: low on the flank, swept down and back
    py = b.y0 + 0.232 * L
    down = unit([0.82, 0.0, -0.57])
    colf = top_white()
    pf = fin((0.10, py, -0.135 * 1.0), [0, 1, 0], down, [(0.0, 0.0), (0.2, 0.2), (0.42, 0.46), (0.62, 0.7), (0.76, 0.88)], [(0.42, 0.0), (0.52, 0.16), (0.62, 0.42), (0.72, 0.68), (0.76, 0.88)], 0.075, nu=9, nc=3,
             colfn=lambda u, c, s: colf(u, c, -s))
    parts.append(pf)
    parts.append(mirrored(pf))
    # pelvics, low and small
    p2 = b.point(np.array(0.565), np.array(135 * RAD))
    pv = fin(p2 + np.array([-0.02, 0.0, 0.03]), [0, 1, 0], unit([0.72, 0.0, -0.69]), [(0.0, 0.0), (0.1, 0.12), (0.22, 0.26)], [(0.28, 0.0), (0.27, 0.12), (0.22, 0.26)], 0.03, nu=4, nc=2,
             colfn=lambda u, c, s: mix(hexc('#59646d'), hexc('#e2e4de'), (0.5 + 0.5 * s)[..., None]))
    parts += [pv, mirrored(pv)]
    # the tail: both lobes in one vertical plane, the keel on the stock
    Yt = lambda t: b.y0 + t * L
    up = fin((0.0, 0.0, 0.0), [0, 1, 0], [0, 0, 1], [(Yt(0.765), 0.05), (Yt(0.82), 0.11), (Yt(0.885), 0.34), (Yt(0.945), 0.62), (Yt(1.0), 0.88)],
             [(Yt(0.875), 0.09), (Yt(0.925), 0.17), (Yt(0.965), 0.34), (Yt(0.99), 0.6), (Yt(1.0), 0.88)], 0.075, nu=10, nc=3,
             colfn=lambda u, c, s: mix(hexc('#4a5560'), hexc('#2b3238'), sstep(0.55, 1.0, u)[..., None]))
    lo = fin((0.0, 0.0, 0.0), [0, 1, 0], [0, 0, 1], [(Yt(0.785), 0.01), (Yt(0.82), -0.09), (Yt(0.865), -0.3), (Yt(0.925), -0.62)],
             [(Yt(0.875), 0.09), (Yt(0.905), -0.05), (Yt(0.925), -0.3), (Yt(0.925), -0.62)], 0.075, nu=8, nc=3,
             colfn=lambda u, c, s: mix(hexc('#4a5560'), hexc('#2b3238'), sstep(0.5, 1.0, u)[..., None]))
    parts += [up, lo]
    for s in (-1, 1):                                                    # the caudal keel: a low ridge on each side of the stock
        kp = b.point(np.linspace(0.70, 0.815, 7), np.full(7, 90 * RAD), s)
        keel = tube(kp, [0.004, 0.018, 0.03, 0.03, 0.022, 0.012, 0.003], sides=4, cap_end=False)
        keel.C[..., :3] = hexc('#4a5560')
        parts.append(keel)
    # five gill slits, long, curving forward at the top; the last sits over the pectoral's root
    for side in (-1, 1):
        for i, t in enumerate([0.185, 0.2, 0.215, 0.23, 0.245]):
            n = 7
            s = np.linspace(0.0, 1.0, n)
            ph = (72 + 46 * s - i * 1.5) * RAD
            tt = t + 0.008 * (s - 0.5) ** 2 * 4.0
            parts.append(b.strip(t + 0.0012 + 0.008 * (s - 0.5) ** 2 * 4.0, ph, side, 0.005 + 0.008 * np.sin(s * math.pi), hexc('#232a31'), lift=0.003))
    # the mouth: an underslung arc, with the points of the upper teeth showing
    for side in (-1, 1):
        n = 12
        s = np.linspace(0.0, 1.0, n)
        tt = 0.056 + 0.074 * s ** 1.15
        ph = (179 - 58 * s ** 0.8) * RAD
        parts.append(b.strip(tt, ph, side, 0.052 - 0.03 * s, hexc('#120d0e'), lift=0.004))
        lip = b.strip(tt - 0.0012, ph - 3.0 * RAD, side, 0.011, hexc('#8d7d7a'), lift=0.0055)
        parts.append(lip)
        for q in np.linspace(0.04, 0.82, 11):                            # teeth: little triangles along the gum
            t0 = 0.056 + 0.074 * q ** 1.15
            ph0 = (179 - 58 * q ** 0.8) * RAD
            a = b.point(np.array(t0 - 0.0028), np.array(ph0 + 1.0 * RAD), side, extra=0.008)
            c = b.point(np.array(t0 + 0.0028), np.array(ph0 + 1.0 * RAD), side, extra=0.008)
            d = b.point(np.array(t0), np.array(ph0 + 5.5 * RAD), side, extra=0.01)
            tm = Mesh([a, c, d], [[0, 1, 2]], S=False)
            if np.dot(tm.face_normals()[0], b.normal(np.array(t0), np.array(ph0), side)) < 0:
                tm = tm.flip()
            tm.C[..., :3] = hexc('#f4f1e6')
            parts.append(tm)
        parts.append(b.strip(np.array([0.027, 0.03, 0.033]), np.array([126, 132, 138]) * RAD, side, 0.008, hexc('#23292e'), lift=0.003))     # the nostril
        parts.append(b.eye(0.0735, 74 * RAD, side, 0.022, hexc('#050608'), lid=hexc('#3a444c'), pupil=0.9))
        # the pores of the snout, the ampullae: a real great white's freckles
        rs = np.random.RandomState(203 + int(side))
        for k in range(16):
            t_, a_ = rs.uniform(0.012, 0.085), rs.uniform(56, 124) * RAD
            pp = b.point(np.array(t_), np.array(a_), side)
            nn = b.normal(np.array(t_), np.array(a_), side)
            parts.append(disc_at(pp, nn, rs.uniform(0.0022, 0.0042), hexc('#2b333a'), segs=5, lift=0.0015))
    return join(parts)


# ---------------------------------------------------------------- blacktip reef shark
def reef_shark():
    """Carcharhinus melanopterus, 2.6 m: slim, a short rounded snout, big eyes, ink-black tips on every fin with a pale band under the first dorsal's, a pale stripe along the flank."""
    L = 2.6
    k = dict(
        t=[0.0, 0.01, 0.03, 0.06, 0.10, 0.16, 0.24, 0.32, 0.42, 0.52, 0.62, 0.70, 0.76, 0.80, 0.84],
        top=[0.002, 0.012, 0.025, 0.04, 0.052, 0.063, 0.071, 0.074, 0.071, 0.062, 0.048, 0.036, 0.027, 0.022, 0.016],
        bot=[0.002, -0.006, -0.015, -0.028, -0.043, -0.06, -0.073, -0.079, -0.074, -0.062, -0.044, -0.03, -0.019, -0.013, -0.004],
        hw=[0.0002, 0.016, 0.031, 0.047, 0.057, 0.066, 0.073, 0.074, 0.067, 0.056, 0.042, 0.03, 0.022, 0.015, 0.005],
        zw=[0.002, 0.003, 0.003, 0.002, 0.0, -0.002, -0.003, -0.003, -0.002, 0.0, 0.002, 0.003, 0.005, 0.0065, 0.006],
        n=[2.0, 2.1, 2.2, 2.2, 2.2, 2.2, 2.3, 2.3, 2.3, 2.3, 2.4, 2.6, 2.3, 2.2, 2.0],
    )
    b = Body(L, k)
    wob = jag(211, 0.6)
    pn = Perlin3(212)

    def water(t):
        return (float(np.interp(t, [0.0, 0.2, 0.45, 0.6, 0.8, 0.84], [116, 106, 112, 90, 78, 70])) + 2.0 * wob(t)) * RAD

    def skin(t, phi, side, P, fphi, ft):
        w = np.array([water(x) for x in ft])
        upper = fphi < w
        n = pn.fbm(P[..., 0] * 3.0, P[..., 1] * 3.0, P[..., 2] * 3.0, 3)
        fine = pn.fbm(P[..., 0] * 7.0, P[..., 1] * 7.0, P[..., 2] * 7.0, 2)
        back = mix(hexc('#6d654b'), hexc('#a79c7f'), sstep(30 * RAD, 102 * RAD, phi + 0.14 * n)[..., None]) * (0.93 + 0.14 * n[..., None] + 0.08 * fine[..., None])
        belly = hexc('#f2f1e8') * (0.96 + 0.04 * fine[..., None])
        return np.where(upper[:, None, None], back, belly)

    ts = np.concatenate([[0.002, 0.008, 0.016, 0.026], np.linspace(0.036, 0.3, 24), np.linspace(0.32, 0.84, 22)])
    parts = [b.loft(ts, rows_with(water, 8, 6), skin)]
    BLACK = hexc('#0d0e10')
    TAN = hexc('#92886b')
    PALE = hexc('#ece6d2')

    def inked(u, c, side, at=0.68, soft=0.05, band=True):
        col = np.broadcast_to(TAN, u.shape + (3,)).copy()
        if band:
            col = mix(col, PALE, sstep(at - 0.3, at - 0.14, u)[..., None])
        return mix(col, BLACK, sstep(at, at + soft, u)[..., None])

    Ptop = lambda t: b.point(np.array(t), np.array(0.0))
    O = np.array([0.0, b.y0 + 0.335 * L, float(Ptop(0.335)[2]) - 0.05])
    parts.append(fin(O, [0, 1, 0], [0, 0, 1], [(0.0, 0.0), (0.09, 0.1), (0.2, 0.25), (0.3, 0.38)], [(0.36, 0.0), (0.33, 0.1), (0.3, 0.24), (0.33, 0.38)], 0.05, nu=8, nc=3, colfn=lambda u, c, s: inked(u, c, s, 0.66)))
    O = np.array([0.0, b.y0 + 0.615 * L, float(Ptop(0.615)[2]) - 0.02])
    parts.append(fin(O, [0, 1, 0], [0, 0, 1], [(0.0, 0.0), (0.06, 0.05), (0.13, 0.12)], [(0.18, 0.0), (0.15, 0.06), (0.15, 0.12)], 0.02, nu=4, nc=2, colfn=lambda u, c, s: inked(u, c, s, 0.6, band=False)))
    pa = b.point(np.array(0.655), np.array(math.pi))
    parts.append(fin((0.0, pa[1], pa[2] + 0.02), [0, 1, 0], [0, 0, -1], [(0.0, 0.0), (0.05, 0.05), (0.11, 0.1)], [(0.15, 0.0), (0.13, 0.05), (0.13, 0.1)], 0.02, nu=4, nc=2, colfn=lambda u, c, s: inked(u, c, s, 0.6, band=False)))
    down = unit([0.84, 0.0, -0.54])
    pf = fin((0.065, b.y0 + 0.235 * L, -0.08), [0, 1, 0], down, [(0.0, 0.0), (0.14, 0.14), (0.3, 0.33), (0.44, 0.5), (0.55, 0.62)], [(0.28, 0.0), (0.34, 0.12), (0.42, 0.3), (0.5, 0.48), (0.55, 0.62)], 0.045, nu=9, nc=3,
             colfn=lambda u, c, s: inked(u, c, s, 0.72, 0.04, band=False))
    pv = fin(b.point(np.array(0.55), np.array(135 * RAD)) + np.array([-0.012, 0, 0.018]), [0, 1, 0], unit([0.72, 0.0, -0.69]), [(0.0, 0.0), (0.07, 0.07), (0.14, 0.15)], [(0.18, 0.0), (0.18, 0.08), (0.14, 0.15)], 0.02, nu=4, nc=2,
             colfn=lambda u, c, s: inked(u, c, s, 0.64, band=False))
    parts += [pf, mirrored(pf), pv, mirrored(pv)]
    Yt = lambda t: b.y0 + t * L
    up = fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Yt(0.77), 0.035), (Yt(0.84), 0.075), (Yt(0.91), 0.21), (Yt(0.965), 0.37), (Yt(1.0), 0.47)],
             [(Yt(0.875), 0.05), (Yt(0.915), 0.085), (Yt(0.955), 0.16), (Yt(0.985), 0.33), (Yt(1.0), 0.47)], 0.03, nu=10, nc=3,
             colfn=lambda u, c, s: mix(mix(np.broadcast_to(TAN, u.shape + (3,)).copy(), BLACK, sstep(0.86, 0.98, c)[..., None]), BLACK, sstep(0.72, 0.78, u)[..., None]))
    lo = fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Yt(0.8), -0.005), (Yt(0.84), -0.05), (Yt(0.875), -0.14), (Yt(0.905), -0.25)],
             [(Yt(0.875), 0.05), (Yt(0.88), -0.04), (Yt(0.895), -0.14), (Yt(0.905), -0.25)], 0.03, nu=7, nc=3,
             colfn=lambda u, c, s: inked(u, c, s, 0.5, 0.06, band=False))
    parts += [up, lo]
    for side in (-1, 1):
        for i, t in enumerate([0.19, 0.203, 0.216, 0.229, 0.242]):
            s = np.linspace(0.0, 1.0, 5)
            parts.append(b.strip(t + 0.004 * (s - 0.5), (84 + 26 * s) * RAD, side, 0.006 + 0.006 * np.sin(s * math.pi), hexc('#39362b'), lift=0.002))
        s = np.linspace(0.0, 1.0, 9)
        parts.append(b.strip(0.05 + 0.056 * s ** 1.2, (179 - 60 * s ** 0.8) * RAD, side, 0.014 - 0.008 * s, hexc('#2a2622'), lift=0.0025))
        parts.append(b.eye(0.0785, 76 * RAD, side, 0.017, hexc('#060708'), iris=hexc('#b8a878'), lid=hexc('#7a7157'), pupil=0.6))
    return join(parts)


# ---------------------------------------------------------------- bottlenose dolphin
def dolphin():
    """Tursiops truncatus, 2.6 m: a short thick beak set off by a crease from the melon, the blowhole behind it, a tall falcate dorsal at mid-back, a keeled tail stock and notched flukes;
    a dark dorsal cape over grey flanks, a pale belly tinged pink. Skin smooth as wet rubber."""
    L = 2.6
    k = dict(
        t=[0.0, 0.012, 0.03, 0.05, 0.062, 0.078, 0.10, 0.13, 0.17, 0.23, 0.30, 0.38, 0.46, 0.56, 0.66, 0.76, 0.84, 0.90, 0.93],
        top=[0.0045, 0.0115, 0.0145, 0.0165, 0.0205, 0.038, 0.057, 0.0725, 0.0845, 0.0955, 0.103, 0.1055, 0.1, 0.085, 0.066, 0.046, 0.0325, 0.0225, 0.014],
        bot=[-0.0015, -0.0135, -0.019, -0.0225, -0.0255, -0.033, -0.043, -0.056, -0.0725, -0.0905, -0.103, -0.106, -0.099, -0.083, -0.0625, -0.0405, -0.0255, -0.017, -0.0105],
        hw=[0.0003, 0.0135, 0.0185, 0.022, 0.0255, 0.0345, 0.0455, 0.059, 0.0715, 0.0845, 0.093, 0.0955, 0.09, 0.075, 0.0555, 0.0345, 0.018, 0.0105, 0.012],
        zw=[0.002, 0.0, -0.002, -0.003, -0.003, 0.0, 0.003, 0.004, 0.003, 0.002, 0.0, 0.0, 0.0, 0.0005, 0.001, 0.002, 0.003, 0.002, 0.001],
        n=[2.0, 2.0, 2.0, 2.05, 2.1, 2.1, 2.1, 2.1, 2.1, 2.1, 2.1, 2.1, 2.1, 2.1, 2.2, 2.3, 2.0, 1.8, 1.9],
    )
    b = Body(L, k)
    pn = Perlin3(221)

    def line(t):
        return float(np.interp(t, [0.0, 0.1, 0.25, 0.45, 0.7, 0.93], [118, 112, 104, 100, 92, 84])) * RAD

    def cape(t):
        return float(np.interp(t, [0.0, 0.14, 0.3, 0.45, 0.62, 0.8, 0.93], [50, 58, 66, 76, 52, 44, 40])) * RAD

    def skin(t, phi, side, P, fphi, ft):
        w = np.interp(t, [0.0, 0.1, 0.25, 0.45, 0.7, 0.93], np.array([118, 112, 104, 100, 92, 84]) * RAD)
        c = np.interp(t, [0.0, 0.14, 0.3, 0.45, 0.62, 0.8, 0.93], np.array([50, 58, 66, 76, 52, 44, 40]) * RAD)
        n = pn.fbm(P[..., 0] * 1.5, P[..., 1] * 1.5, P[..., 2] * 1.5, 3)
        col = mix(hexc('#39434d'), hexc('#6f7c88'), sstep(c - 0.14, c + 0.12, phi + 0.03 * n)[..., None])
        col = mix(col, hexc('#a4aeb6'), sstep(w - 0.34, w, phi)[..., None])
        col = mix(col, hexc('#f2e6e0'), sstep(w - 0.03, w + 0.28, phi)[..., None])
        return col

    ts = np.concatenate([[0.002, 0.008, 0.016, 0.026, 0.036, 0.046, 0.054, 0.06, 0.066, 0.072, 0.08], np.linspace(0.09, 0.3, 16), np.linspace(0.32, 0.93, 28)])
    b.disp = lambda t, phi, side: 0.0
    parts = [b.loft(ts, lambda t: np.linspace(0, math.pi, 15), skin)]
    DK = hexc('#39434d')
    Ptop = lambda t: b.point(np.array(t), np.array(0.0))
    # the dorsal: falcate, its tip leaning back over its concave rear edge
    O = np.array([0.0, b.y0 + 0.47 * L, float(Ptop(0.47)[2]) - 0.05])
    parts.append(fin(O, [0, 1, 0], [0, 0, 1], [(0.0, 0.0), (0.1, 0.1), (0.22, 0.2), (0.35, 0.28), (0.45, 0.32)], [(0.42, 0.0), (0.38, 0.08), (0.355, 0.16), (0.385, 0.25), (0.45, 0.32)], 0.07, nu=9, nc=3,
                     colfn=lambda u, c, s: mix(DK, hexc('#2e3740'), sstep(0.2, 1.0, u)[..., None])))
    # the flippers: short, broad-based, pointed, swept back
    fp = b.point(np.array(0.235), np.array(122 * RAD), 1.0)
    flip = fin(fp + np.array([-0.02, 0, 0.0]), unit([0.15, 1.0, -0.1]), unit([0.84, 0.1, -0.53]), [(0.0, 0.0), (0.07, 0.11), (0.17, 0.24), (0.28, 0.35), (0.38, 0.43)], [(0.26, 0.0), (0.28, 0.11), (0.3, 0.22), (0.34, 0.34), (0.38, 0.43)], 0.05, nu=8, nc=3,
               colfn=lambda u, c, s: mix(hexc('#6f7c88'), hexc('#46515c'), sstep(0.1, 0.8, u)[..., None]))
    parts += [flip, mirrored(flip)]
    # flukes: broad, swept, a clean notch in the middle
    y = b.y0 + 0.895 * L
    fl = fin((0.0, y, 0.0), [0, 1, 0], [1, 0, 0], [(0.0, 0.0), (0.03, 0.09), (0.09, 0.2), (0.17, 0.3), (0.235, 0.345)], [(0.3, 0.0), (0.265, 0.09), (0.255, 0.2), (0.25, 0.3), (0.235, 0.345)], 0.05, nu=9, nc=3,
             colfn=lambda u, c, s: mix(hexc('#465160'), hexc('#2e3740'), sstep(0.3, 1.0, u)[..., None]))
    parts += [fl, mirrored(fl)]
    # the mouth's long line, up at the corner; the blowhole; the eye over the mouth's corner
    for side in (-1, 1):
        s = np.linspace(0.0, 1.0, 14)
        tt = 0.003 + 0.112 * s
        ph = (93 + 5.0 * np.sin(s * math.pi) - 7.0 * s ** 4) * RAD
        parts.append(b.strip(tt, ph, side, 0.0052 - 0.0022 * s, hexc('#2c3339'), lift=0.0012))
        parts.append(b.eye(0.1325, 92 * RAD, side, 0.0115, hexc('#090a0c'), iris=hexc('#4a3a2a'), lid=hexc('#5a6672'), pupil=0.68))
    s = np.linspace(-1.0, 1.0, 7)
    parts.append(b.strip(0.142 - 0.006 * np.abs(s) ** 2 * 0 + 0.0 * s + 0.004 * s * s, np.abs(s) * 7.0 * RAD, 1.0, 0.012, hexc('#23282d'), lift=0.0015))
    parts.append(b.strip(0.142 + 0.004 * s * s, np.abs(s) * 7.0 * RAD, -1.0, 0.012, hexc('#23282d'), lift=0.0015))
    return join(parts)


# ---------------------------------------------------------------- humpback whale
def whale():
    """Megaptera novaeangliae, a 26 m showpiece: a flat knobbled rostrum over a great lower jaw, the lip arching to the eye; throat grooves from chin to navel; pectorals a third of the body long,
    scalloped and white; a small dorsal on a hump; a keeled tail stock and broad flukes with a serrated trailing edge, a notch in the middle; black above, mottled white below."""
    L = 26.0
    k = dict(
        t=[0.0, 0.015, 0.04, 0.08, 0.13, 0.18, 0.24, 0.30, 0.36, 0.42, 0.50, 0.58, 0.66, 0.74, 0.82, 0.88, 0.92, 0.945],
        top=[0.0, 0.0105, 0.0215, 0.0345, 0.0515, 0.0695, 0.088, 0.101, 0.108, 0.1115, 0.1105, 0.1045, 0.097, 0.0815, 0.062, 0.0445, 0.0305, 0.0205],
        bot=[-0.003, -0.0285, -0.0565, -0.0805, -0.0975, -0.1085, -0.1175, -0.124, -0.128, -0.128, -0.1175, -0.098, -0.076, -0.056, -0.039, -0.027, -0.02, -0.0145],
        hw=[0.002, 0.0235, 0.0415, 0.0605, 0.0775, 0.0885, 0.0965, 0.1015, 0.1035, 0.1015, 0.093, 0.081, 0.0655, 0.0475, 0.0305, 0.0195, 0.0145, 0.012],
        zw=[-0.003, -0.012, -0.024, -0.033, -0.037, -0.038, -0.036, -0.03, -0.024, -0.02, -0.014, -0.008, -0.002, 0.004, 0.008, 0.009, 0.006, 0.004],
        n=[2.0, 2.0, 2.0, 2.05, 2.1, 2.1, 2.15, 2.2, 2.2, 2.2, 2.2, 2.2, 2.25, 2.3, 2.4, 2.5, 2.2, 2.0],
    )
    b = Body(L, k)
    pn = Perlin3(231)

    def lip_phi(t):
        """The mouth line, as an angle from the dorsal line."""
        return pchip([0.0, 0.05, 0.12, 0.18, 0.215, 0.235, 0.26], np.array([74, 66, 62, 62.5, 72, 92, 104]) * RAD, np.clip(t, 0.0, 0.26))

    def disp(t, phi, side):
        # the narrow rostrum sits in the wide jaw: the skin above the lip steps in
        lip = lip_phi(t)
        step = sstep(lip + 0.03, lip - 0.09, phi) * sstep(0.235, 0.17, t) * sstep(0.0, 0.03, t)
        out = -0.016 * L * step
        # the splash guard round the blowholes, the ridge behind
        guard = np.exp(-((t - 0.158) / 0.012) ** 2) * sstep(0.3, 0.0, phi)
        out = out + 0.0055 * L * guard
        hump = np.exp(-((t - 0.655) / 0.03) ** 2) * sstep(0.34, 0.0, phi)
        out = out + 0.0065 * L * hump
        return out

    b.disp = disp

    def water(t):
        return float(np.interp(t, [0.0, 0.2, 0.3, 0.55, 0.8, 0.945], [128, 128, 124, 132, 150, 176])) * RAD

    def skin(t, phi, side, P, fphi, ft):
        w = np.interp(t, [0.0, 0.2, 0.3, 0.55, 0.8, 0.945], np.array([128, 128, 124, 132, 150, 176]) * RAD)
        n = pn.fbm(P[..., 0] * 0.32, P[..., 1] * 0.32, P[..., 2] * 0.32, 4)
        m = pn.fbm(P[..., 0] * 1.1 + 4.0, P[..., 1] * 1.1, P[..., 2] * 1.1, 3)
        dark = mix(hexc('#14171b'), hexc('#2d3238'), (0.5 + 0.8 * n * 0.5)[..., None])
        dark = mix(dark, hexc('#454b50'), sstep(0.34, 0.6, m)[..., None] * 0.5)
        pale = mix(hexc('#d4d6d2'), hexc('#f4f3ec'), (0.5 + 0.5 * m)[..., None])
        edge = w + 0.22 * n + 0.1 * m                                    # the torn border of the white, a different map on each whale
        k_ = sstep(edge - 0.16, edge + 0.16, phi)
        col = mix(dark, pale, k_[..., None])
        chin = sstep(0.16, 0.02, t) * sstep(1.6, 2.2, phi)              # the chin's own patches of barnacle grey
        col = mix(col, hexc('#8e9490'), (0.5 * chin * sstep(0.1, 0.4, m))[..., None])
        return col

    ts = np.concatenate([[0.003, 0.009, 0.016, 0.024], np.linspace(0.034, 0.26, 24), np.linspace(0.275, 0.945, 35)])

    def rows(t):
        lip = float(lip_phi(t)) if t < 0.235 else 92.0 * RAD
        # one row on the lip; rows gather there so the step in the skin stays sharp
        return np.concatenate([np.linspace(0.0, lip - 0.09, 7, endpoint=False), np.array([lip - 0.09, lip - 0.03, lip]), np.linspace(lip + 0.06, math.pi, 8)])

    parts = [b.loft(ts, rows, skin)]
    # the mouth line, sweeping up the jaw and dropping at the eye
    for side in (-1, 1):
        s = np.linspace(0.0, 1.0, 26)
        tt = 0.004 + 0.232 * s
        parts.append(b.strip(tt, lip_phi(tt), side, 0.075 - 0.035 * s, hexc('#090b0d'), lift=0.03))
        parts.append(b.eye(0.243, 96 * RAD, side, 0.11, hexc('#070809'), iris=hexc('#3a2c20'), lid=hexc('#23272b'), pupil=0.7))
        # the throat grooves: many, near parallel, from the chin to the navel, dark in pale
        for g in range(11):
            f = g / 10.0
            s = np.linspace(0.0, 1.0, 21)
            t0 = 0.018 + 0.03 * (1.0 - f)
            t1 = 0.46 + 0.1 * f ** 1.5
            tt = t0 + (t1 - t0) * s
            ph = (118.0 + 60.0 * f + 2.5 * np.sin(s * 3.1 + g)) * RAD
            ph = ph + (180.0 * RAD - ph) * 0.0
            w = 0.1 * np.sin(np.clip(s * 1.12, 0, 1) * math.pi) ** 0.5 + 0.014
            parts.append(b.strip(tt, np.minimum(ph, 177 * RAD), side, w, hexc('#2c3034'), lift=0.03))
    # the knobs of the head: tubercles along the rostrum and the jaw, each with its hair follicle
    rs = np.random.RandomState(232)
    pale_b = hexc('#6b7072')
    for i in range(16):
        t = 0.012 + i * 0.0115
        for side in (-1, 1):
            parts.append(b.dome(t + rs.uniform(-0.003, 0.003), (9.0 + rs.uniform(0, 30)) * RAD, side, 0.17, 0.05, hexc('#262b30'), seg=6))
    for i in range(10):
        t = 0.012 + i * 0.016
        for side in (-1, 1):
            parts.append(b.dome(t + rs.uniform(-0.003, 0.003), float(lip_phi(t)) + (9.0 + rs.uniform(0, 14)) * RAD, side, 0.16, 0.045, hexc('#262b30'), seg=6))
    for i in range(14):                                                  # barnacles on the chin
        t, a, sd = rs.uniform(0.006, 0.05), rs.uniform(120, 176) * RAD, rs.choice([-1.0, 1.0])
        parts.append(b.dome(t, a, sd, rs.uniform(0.09, 0.2), 0.06, hexc('#b8b8ae'), seg=6))
    # the blowholes, twin slits on the guard
    for side in (-1, 1):
        s = np.linspace(0.0, 1.0, 5)
        parts.append(b.strip(0.15 + 0.014 * s, (3.2 + 3.5 * s) * RAD, side, 0.1, hexc('#0a0c0e'), lift=0.03))
    # the dorsal: a stub on a hump
    O = b.point(np.array(0.64), np.array(0.0)) + np.array([0, 0, -0.32])
    parts.append(fin(O, [0, 1, 0], [0, 0, 1], [(0.0, 0.0), (0.45, 0.14), (0.9, 0.31), (1.2, 0.44)], [(1.5, 0.0), (1.42, 0.14), (1.32, 0.3), (1.2, 0.44)], 0.5, nu=5, nc=3,
                     colfn=lambda u, c, s: np.broadcast_to(hexc('#191d21'), u.shape + (3,)).copy()))
    # the pectorals: a third of the body long, narrow, the leading edge scalloped by its knuckles; white beneath, white mottled above
    knob = []
    nk = 10
    for i in range(nk + 1):
        u = i / nk
        knob.append((-0.2 * math.sin(u * math.pi) * 0.9 + 0.1 * (1 - u) + (0.24 if i % 2 else 0.0) * (0.3 + 0.7 * math.sin(u * math.pi)), 8.0 * u))
    LE = [(1.6 * u * u * 1.7 + a, b_) for (a, b_), u in zip(knob, np.linspace(0, 1, nk + 1))]
    TE = [(2.5 - 0.6 * u + 1.6 * u * u * 1.7 + 0.15 * math.sin(u * 3.0), 8.0 * u) for u in np.linspace(0, 1, nk + 1)]
    TE[-1] = LE[-1]
    fp = b.point(np.array(0.30), np.array(122 * RAD), 1.0)

    pf = fin(fp + np.array([-0.2, 0, 0.1]), unit([0.3, 1.0, 0.05]), unit([0.76, 0.18, -0.62]), LE, TE, 0.36, nu=22, nc=4)
    Cp = pf.corners()
    nn = pn.fbm(Cp[..., 0] * 0.9, Cp[..., 1] * 0.9, Cp[..., 2] * 0.9, 3)
    ups = pf.face_normals()[:, None, 2] > -0.1
    top = mix(hexc('#20252a'), hexc('#e8e7e0'), sstep(-0.32, -0.02, nn * 0.8 + 0.2 - 0.34 * sstep(2.4, 0.3, np.linalg.norm(Cp - fp, axis=-1)))[..., None])
    pf.C[..., :3] = np.where(ups[..., None], top, hexc('#efeee8') * (0.96 + 0.05 * nn[..., None]))
    parts += [pf, mirrored(pf)]
    # the flukes: broad, swept, a deep notch, the trailing edge serrated, black above and white-and-black below
    span = 4.5
    fy = b.y0 + 0.925 * L
    te = []
    for i in range(13):
        u = i / 12.0
        y = 1.85 - 0.3 * u + 0.34 * math.sin(u * 2.6) + (0.1 if i % 2 else 0.0)
        te.append((y if u > 0 else 1.5, span * u))
    te[-1] = (1.55, span)
    le = [(0.0, 0.0), (0.0, 0.4), (0.26, 1.3), (0.72, 2.5), (1.22, 3.6), (1.55, span)]

    def flk(u, c, s):
        top = mix(hexc('#1a1e22'), hexc('#2a2f34'), (0.5 + 0.5 * np.sin(u * 9.0))[..., None])
        low = mix(hexc('#f0efe9'), hexc('#121416'), np.clip(sstep(0.72, 0.9, c) + sstep(0.5, 1.0, u) * 0.6 + 0.4 * sstep(0.3, 0.5, np.sin(u * 19.0 + c * 7.0)), 0, 1)[..., None])
        return np.where(s[..., None] > 0, low, top)

    fl = fin((0.0, fy, 0.05), [0, 1, 0], [1, 0, 0], le, te, 0.34, nu=18, nc=3, colfn=flk)
    parts += [fl, mirrored(fl)]
    return join(parts)


# ---------------------------------------------------------------- reef manta
def manta():
    """Mobula alfredi, 6.4 m across: a diamond disc with pointed, back-swept wings, a wide terminal mouth between rolled cephalic fins; dark above with the species' pale shoulder patches;
    white beneath with dark belly spots, five gill slits a side; a short plain tail."""
    span, front, rear = 3.2, -1.52, 1.1
    pn = Perlin3(241)
    nu, nc = 25, 16
    ss = np.linspace(0.0, 1.0, nu + 1) ** 1.12
    xs = span * ss
    le = pchip([0.0, 0.1, 0.17, 0.3, 0.5, 0.7, 0.88, 1.0], [front, front + 0.02, front + 0.12, front + 0.5, front + 0.98, front + 1.34, front + 1.6, front + 1.82], ss)
    te = pchip([0.0, 0.08, 0.2, 0.4, 0.6, 0.8, 0.92, 1.0], [rear, rear - 0.02, rear - 0.1, rear - 0.34, rear - 0.56, rear - 0.76, rear - 0.82, front + 1.82], ss)
    cc = np.linspace(0.0, 1.0, nc + 1) ** 1.1
    X = np.repeat(xs[:, None], nc + 1, axis=1)
    Y = le[:, None] + (te - le)[:, None] * cc[None, :]
    fx = X / span
    chord = np.clip((Y - le[:, None]) / np.maximum((te - le)[:, None], 1e-4), 0, 1)
    thick = (0.22 * (1.0 - sstep(0.0, 0.42, fx)) ** 1.1 + 0.03 * (1.0 - fx) + 0.006) * np.sin(math.pi * chord ** 0.62) ** 0.72
    camber = -0.26 * fx ** 2.0 + 0.1 * (1.0 - sstep(0.0, 0.34, fx)) + 0.05 * np.sin(chord * 3.0) * (1.0 - fx)
    top = np.stack([X, Y, camber + thick], 2)
    bot = np.stack([X, Y, camber - thick * 0.72], 2)
    a, b = grid(top), grid(bot, flip=True)

    def surf(x, y, sgn=1.0):
        """The disc's height at (x, y), top (sgn 1) or belly (sgn -1)."""
        x = np.abs(np.asarray(x, dtype=np.float64))
        y = np.asarray(y, dtype=np.float64)
        f = x / span
        l_, t_ = np.interp(x, xs, le), np.interp(x, xs, te)
        ch = np.clip((y - l_) / np.maximum(t_ - l_, 1e-4), 0.0, 1.0)
        th_ = (0.22 * (1.0 - sstep(0.0, 0.42, f)) ** 1.1 + 0.03 * (1.0 - f) + 0.006) * np.sin(math.pi * ch ** 0.62) ** 0.72
        cam = -0.26 * f ** 2.0 + 0.1 * (1.0 - sstep(0.0, 0.34, f)) + 0.05 * np.sin(ch * 3.0) * (1.0 - f)
        return cam + (th_ if sgn > 0 else -th_ * 0.72)


    def shoulder(P):
        """The reef manta's pale shoulder patch: its front edge runs straight out from the spiracle, its rear edge melts to the wing, the back's dark line between the pair."""
        x, y = np.abs(P[..., 0]), P[..., 1]
        n = 0.09 * pn.fbm(x * 2.6, y * 2.6, 0.5 + 0 * x, 3)
        front_edge = (-1.0 + 0.36 * (x - 0.38)) + n
        rear_edge = (0.1 + 0.05 * (x - 0.4) - 0.46 * (x - 0.4) ** 1.0) + n * 1.5
        return sstep(-0.03, 0.07, y - front_edge) * sstep(0.1, -0.12, y - rear_edge) * sstep(0.26, 0.42, x + n) * sstep(2.0, 1.4, x)

    def dark_skin(P):
        n = pn.fbm(P[..., 0] * 1.2, P[..., 1] * 1.2, 2.0 + 0 * P[..., 0], 3)
        return mix(hexc('#14181d'), hexc('#2e3439'), (0.5 + 0.6 * n)[..., None])

    C = a.corners()
    col = dark_skin(C)
    col = mix(col, hexc('#3b4044'), (sstep(0.8, 0.98, np.abs(C[..., 0]) / span) * 0.3)[..., None])
    a.C[..., :3] = col
    C = b.corners()
    white = hexc('#f1f0e8')
    spot_n = pn(C[..., 0] * 2.6, C[..., 1] * 2.6, 7.0 + 0 * C[..., 0])
    col = np.broadcast_to(white, C.shape).copy()
    tp = sstep(0.82, 1.0, np.abs(C[..., 0]) / span) * 0.6 + sstep(0.9, 1.0, np.clip((C[..., 1] - le[0]) / (te[0] - le[0]), 0, 1)) * 0.4
    ch = np.interp(np.abs(C[..., 0]), xs, le)
    edge = (C[..., 1] - np.interp(np.abs(C[..., 0]), xs, te))
    col = mix(col, hexc('#2a2e32'), np.clip(sstep(-0.16, -0.02, edge) * 0.85 + sstep(0.86, 1.0, np.abs(C[..., 0]) / span) * 0.7, 0, 1)[..., None])
    b.C[..., :3] = col
    half = join([a, b])
    # the shoulder patch, a decal laid on the wing: its front edge clean and straight, its rear fading into the dark, as on the real fish
    nu2, nv2 = 16, 5
    fe = curve([(0.42, -0.98), (0.8, -0.86), (1.2, -0.68), (1.62, -0.44), (1.92, -0.22)], nu2)
    re = curve([(0.42, 0.14), (0.72, 0.06), (1.1, -0.1), (1.56, -0.28), (1.92, -0.22)], nu2)
    wob = 1.0 + 0.05 * np.sin(np.arange(nu2) * 1.9)
    PP = np.zeros((nu2, nv2 + 1, 3))
    for i_ in range(nu2):
        for j_ in range(nv2 + 1):
            f_ = (j_ / float(nv2)) ** 0.8
            q = fe[i_] * (1 - f_) + re[i_] * (1 - 0.14 * f_ * (wob[i_] - 1.0) * 10.0) * f_ + fe[i_] * 0.14 * f_ * (wob[i_] - 1.0) * 10.0 * f_
            PP[i_, j_] = (q[0], q[1], float(surf(q[0], q[1])) + 0.012)
    patch_m = grid(PP)
    if patch_m.face_normals()[len(patch_m.T) // 2, 2] < 0:
        patch_m = patch_m.flip()
    Cc = patch_m.corners()
    rowf = np.clip(np.round(((Cc[..., 1, None] * 0))).astype(float)[..., 0], 0, 1)
    jidx = (np.arange(nu2 * (nv2 + 1)) % (nv2 + 1)) / float(nv2)
    fade = jidx[patch_m.T]
    patch_m.C[..., :3] = mix(hexc('#e4e3d9'), hexc('#454a4e'), sstep(0.5, 1.0, fade)[..., None])
    half = join([half, patch_m])
    parts = [half, mirrored(half)]
    # the cephalic fins: short flat paddles, rolled in toward the mouth
    th = np.linspace(0.0, 1.0, 8)
    for side in (-1, 1):
        rowsA = []
        for k_, u in enumerate(th):
            cx_, cy_, cz_ = side * (0.5 - 0.02 * math.sin(u * 2.4) - 0.2 * u ** 2.0), front + 0.16 - 0.5 * u, 0.02 - 0.09 * u
            w = 0.09 * (1.0 - 0.25 * u) * (1.0 - u ** 5)
            roll = 0.7 + 2.4 * u
            ring = []
            for a2 in np.linspace(0.0, TAU, 7, endpoint=False):
                x2, z2 = math.cos(a2) * w, math.sin(a2) * w * 0.34
                ring.append((cx_ + side * (x2 * math.cos(roll) - z2 * math.sin(roll)), cy_, cz_ + x2 * math.sin(roll) + z2 * math.cos(roll)))
            rowsA.append(ring)
        c = join([grid(np.array(rowsA), wrap_v=True), fan(np.array(rowsA)[-1], np.array(rowsA)[-1].mean(axis=0))]).outward()
        n = pn.fbm(c.corners()[..., 0] * 5.0, c.corners()[..., 1] * 5.0, c.corners()[..., 2] * 5.0, 2)
        c.C[..., :3] = mix(hexc('#14181d'), hexc('#3a3f43'), (0.5 + 0.5 * n)[..., None])
        parts.append(c)
        ep = np.array([side * 0.56, front + 0.3, float(surf(0.56, front + 0.3)) * 0.5])
        parts.append(eye_at(ep, unit([side * 1.0, -0.2, 0.25]), 0.03, hexc('#060709'), iris=hexc('#3b3020'), lid=hexc('#20262b'), segs=10, pupil=0.7))
        for g in range(5):                                               # the gill slits, in two curved rows under the disc
            s = np.linspace(0.0, 1.0, 6)
            x_ = 0.32 + 0.2 * s + 0.045 * g
            y_ = -0.86 + g * 0.2 + 0.07 * s
            pts = np.stack([side * x_, y_, surf(x_, y_, -1.0) - 0.006], 1)
            st = np.stack([pts + np.array([0, -0.011, 0]), pts + np.array([0, 0.011, 0])], 1)
            m = grid(st)
            if m.face_normals()[0, 2] > 0:
                m = m.flip()
            m.C[..., :3] = hexc('#4a4f54')
            parts.append(m)
    # the belly's dark spots: each manta's own fingerprint, crisp
    rs = np.random.RandomState(242)
    for k in range(13):
        sd = rs.choice([-1.0, 1.0])
        x0, y0 = rs.uniform(0.1, 1.3), rs.uniform(-0.3, 0.6)
        parts.append(disc_at(np.array([sd * x0, y0, float(surf(x0, y0, -1.0))]), np.array([0.0, 0.0, -1.0]), rs.uniform(0.035, 0.09), hexc('#1f2429'), segs=9, lift=0.006, rough=0.82 + 0.26 * rs.rand(9)))
    # the mouth: a wide dark slit across the very front of the head, its corners between the cephalic fins
    mx = np.linspace(-0.3, 0.3, 11)
    my = np.interp(np.abs(mx), xs, le) + 0.006
    zc = surf(np.abs(mx), my + 0.02, 1.0) * 0.5 + surf(np.abs(mx), my + 0.02, -1.0) * 0.5
    M = np.stack([np.stack([mx, my, zc - 0.02], 1), np.stack([mx, my, zc + 0.016], 1)], 1)
    mm = grid(M)
    if mm.face_normals()[0, 1] > 0:
        mm = mm.flip()
    mm.C[..., :3] = hexc('#07080a')
    parts.append(mm)
    # the short plain tail
    tl = np.linspace(0.0, 1.0, 7)
    pts = np.stack([0.0 * tl, rear - 0.1 + 1.15 * tl, 0.03 - 0.1 * tl ** 2], 1)
    t = tube(pts, [0.075, 0.05, 0.036, 0.028, 0.02, 0.012, 0.004], sides=5)
    t.C[..., :3] = hexc('#14181d')
    parts.append(t)
    return join(parts)


# ---------------------------------------------------------------- green sea turtle
def turtle():
    """Chelonia mydas, 1.4 m: a smooth heart-shaped shell of real scutes (5 vertebrals, 4 pairs of costals, a ring of marginals), each with a sunburst of olive and dark brown, the seams dark and sunken;
    a cream plastron; a blunt head of large pale-edged scales, a serrated beak; long paddle front flippers, each with one claw; short rounded rear flippers."""
    pn = Perlin3(251)
    S = 0.5                                                              # half the shell's length
    W0 = 0.43                                                            # half its width

    def outline(a):
        """The shell's rim: broad at the shoulders, tapering to a point behind. a: 0 at the nose, pi at the tail."""
        c = np.cos(a)
        r = (1.0 - 0.02 * c * c)
        wx = W0 * (1.0 + 0.1 * c - 0.14 * c * c)
        wy = S * (1.0 + 0.1 * (-c) * sstep(0.2, 1.0, -c))
        return np.sin(a) * wx, -c * wy

    def dome_z(x, y):
        rim_ang = np.arctan2(x, -y)
        ex, ey = outline(rim_ang)
        r = np.clip(np.hypot(x, y) / np.maximum(np.hypot(ex, ey), 1e-5), 0.0, 1.0)
        return (0.205 * (1.0 - r ** 2.3) ** 0.62) * (1.0 + 0.1 * np.cos(rim_ang)) + 0.012 * (1.0 - r) * np.cos(x * 11.0)

    # scute seeds: real numbers of them
    seeds, kind = [], []
    for y in (-0.36, -0.185, -0.005, 0.175, 0.345):
        seeds.append((0.0, y))
        kind.append('v')
    for y in (-0.29, -0.09, 0.11, 0.29):
        for sx in (-1, 1):
            k_ = 0.255 if y < 0.2 else 0.19
            seeds.append((sx * k_, y))
            kind.append('c')
    nm = 13
    for i in range(nm):
        a = (i + 0.5) / nm * math.pi
        for sx in (-1, 1):
            ex, ey = outline(np.array(a))
            seeds.append((sx * float(ex) * 0.915, float(ey) * 0.925))
            kind.append('m')
    seeds = np.array(seeds)

    def boundary(i, rays=20, gap=0.0055):
        """Star polygon of cell i: along each ray, where the nearest other seed or the rim takes over."""
        s = seeds[i]
        out = []
        for a in np.linspace(0.0, TAU, rays, endpoint=False):
            d = np.array([math.cos(a), math.sin(a)])
            best = 1.0
            for j in range(len(seeds)):
                if j == i:
                    continue
                e = seeds[j] - s
                den = 2.0 * float(np.dot(d, e))
                if den > 1e-6:
                    best = min(best, float(np.dot(e, e)) / den)
            # the rim
            lo, hi = 0.0, 1.0
            for _ in range(18):
                mid = (lo + hi) / 2.0
                p = s + d * mid
                ang = math.atan2(p[0], -p[1])
                ex, ey = outline(np.array(ang))
                if math.hypot(p[0], p[1]) < math.hypot(float(ex), float(ey)):
                    lo = mid
                else:
                    hi = mid
            rim = lo
            out.append(s + d * max(min(best - gap, rim - gap * 0.3), 0.004))
        return np.array(out)

    plates = []
    for i in range(len(seeds)):
        big = kind[i] != 'm'
        B = boundary(i, 16 if big else 9)
        rings = []
        for f in ((1.0, 0.82, 0.42) if big else (1.0, 0.5)):
            q = seeds[i] + (B - seeds[i]) * f
            z = dome_z(q[:, 0], q[:, 1]) + (0.0 if f == 1.0 else 0.006)
            rings.append(np.stack([q[:, 0], q[:, 1], z], 1))
        cen = np.array([seeds[i][0], seeds[i][1], float(dome_z(np.array(seeds[i][0]), np.array(seeds[i][1]))) + 0.008])
        g_, f_ = grid(np.array(rings), wrap_v=True, S=True), fan(rings[-1], cen)
        if g_.face_normals()[0, 2] < 0:
            g_ = g_.flip()
        if f_.face_normals()[0, 2] < 0:
            f_ = f_.flip()
        m = join([g_, f_])
        P = m.corners()
        # the growth point sits toward each scute's rear, and the sunburst rays from it
        gx, gy = seeds[i][0], seeds[i][1] + 0.03
        ang = np.arctan2(P[..., 1] - gy, P[..., 0] - gx)
        rd = np.hypot(P[..., 1] - gy, P[..., 0] - gx)
        rn = rd / max(float(rd.max()), 1e-5)
        burst = 0.5 + 0.5 * (0.6 * np.sin(ang * 5.0 + i * 1.7) + 0.4 * np.sin(ang * 11.0 - i * 2.3))
        tone = 0.5 + 0.5 * pn.fbm(P[..., 0] * 5.0, P[..., 1] * 5.0, i * 0.7 + 0 * P[..., 0], 3)
        col = mix(hexc('#3d3014'), hexc('#8a7a34'), np.clip(0.34 + 0.56 * burst + 0.42 * (tone - 0.5) + 0.16 * (1.0 - rn), 0, 1)[..., None])
        col = mix(col, hexc('#a8975a'), (sstep(0.66, 0.9, tone) * 0.4 * (1.0 - rn))[..., None])
        col = mix(col, hexc('#241d0c'), (sstep(0.82, 1.0, rn) * 0.3)[..., None])
        m.C[..., :3] = col
        plates.append(m)
    # the bone under the seams: dark
    rr = np.linspace(0.0, 0.995, 5)[1:]
    th = np.linspace(0.0, TAU, 28, endpoint=False)
    ex, ey = outline(th)
    und = []
    for r in rr:
        z = dome_z(ex * r, ey * r) - 0.004
        und.append(np.stack([ex * r, ey * r, z], 1))
    und = np.array(und)
    base = join([grid(und, wrap_v=True), fan(und[0], (0, 0, float(dome_z(np.array(0.0), np.array(0.0))) - 0.004), S=True)])
    base.C[..., :3] = hexc('#14100a')
    if base.face_normals()[len(base.T) // 2, 2] < 0:
        base = base.flip()
    # the plastron: a flat cream underside, with its own seams
    pr = np.linspace(0.0, 1.0, 4)[1:]
    pl = []
    for r in pr:
        pl.append(np.stack([ex * r * 0.96, ey * r * 0.96, np.full(28, -0.1 * (1.0 - r ** 2.0))], 1))
    pl = np.array(pl)
    plast = join([grid(pl, wrap_v=True), fan(pl[0], (0, 0, -0.1))])
    if plast.face_normals()[len(plast.T) // 2, 2] > 0:
        plast = plast.flip()
    C = plast.corners()
    seam = sstep(0.012, 0.004, np.abs(np.sin(C[..., 1] * 14.0)) * 0.08) + sstep(0.012, 0.004, np.abs(C[..., 0]))
    plast.C[..., :3] = mix(hexc('#e8dcae'), hexc('#a89a6c'), np.clip(seam, 0, 1)[..., None])
    parts = plates + [base, plast]
    # rim skirt, closing shell to plastron
    rim = np.stack([np.stack([ex * 0.995, ey * 0.995, np.zeros(28) + 0.002], 1), np.stack([ex * 0.955, ey * 0.955, np.zeros(28) - 0.006], 1)], 0)
    rm = grid(rim, wrap_v=True)
    rm.C[..., :3] = hexc('#3a3220')
    parts.append(rm)

    def scales(m, c0, c1, c2, under=None, seed=252):
        """The skin's big polygonal scales: each quad of the mesh a scale of its own tone, dark with pale ones among them, as on a real turtle's head and flippers."""
        rs = np.random.RandomState(seed)
        n = m.tris
        q = np.repeat(np.arange((n + 1) // 2), 2)[:n]
        pick = rs.rand(int(q.max()) + 1)
        tone = pick[q]
        col = np.zeros((n, 3))
        col[tone < 0.55] = c0
        col[(tone >= 0.55) & (tone < 0.9)] = c1
        col[tone >= 0.9] = c2
        m.C[..., :3] = np.broadcast_to(col[:, None, :], (n, 3, 3))
        if under is not None:
            low = m.face_normals()[:, 2] < -0.25
            m.C[low, :, :3] = under
        return m

    # the neck and head: short, blunt, the snout rounded, a big eye under a bony brow, a serrated beak
    L = 0.46
    k = dict(t=[0.0, 0.03, 0.08, 0.16, 0.27, 0.4, 0.55, 0.72, 0.9, 1.0], top=[0.012, 0.055, 0.09, 0.118, 0.13, 0.12, 0.09, 0.076, 0.082, 0.086], bot=[-0.018, -0.042, -0.07, -0.088, -0.095, -0.098, -0.09, -0.085, -0.09, -0.09],
             hw=[0.008, 0.042, 0.07, 0.095, 0.112, 0.116, 0.1, 0.095, 0.105, 0.115], zw=[-0.005, -0.005, 0.0, 0.01, 0.015, 0.01, 0.0, -0.005, -0.005, 0.0], n=[2.0, 2.0, 2.1, 2.2, 2.2, 2.2, 2.1, 2.0, 2.0, 2.0])
    hd = Body(L, k, y_nose=-0.72)
    hd.ax = lambda t: 0.04 * (1.0 - t) ** 2 + 0.015
    D_, M_, Y_ = hexc('#3a2d17'), hexc('#4c3c20'), hexc('#7d6a3c')

    def hskin(t, phi, side, P, fphi, ft):
        return np.broadcast_to(hexc('#59462a'), P.shape).copy()

    head = hd.loft(np.concatenate([[0.012, 0.04, 0.07], np.linspace(0.11, 1.0, 13)]), lambda t: np.linspace(0, math.pi, 9), hskin)
    scales(head, D_, M_, Y_, under=hexc('#ddd3a4'))
    parts.append(head)
    for side in (-1, 1):
        parts.append(hd.eye(0.2, 70 * RAD, side, 0.019, hexc('#060708'), iris=hexc('#6a4e24'), lid=hexc('#3a2e18'), pupil=0.7))
        s_ = np.linspace(0.0, 1.0, 8)
        parts.append(hd.strip(0.012 + 0.15 * s_, (122 - 36 * s_) * RAD, side, 0.0075, hexc('#17120a'), lift=0.0012))
    # the flippers: long, curved, one claw on the leading edge; the rear ones short and round. Pale under, scaled above
    FLE = [(0.0, 0.0), (-0.03, 0.2), (0.04, 0.45), (0.18, 0.68), (0.34, 0.86)]
    FTE = [(0.2, 0.0), (0.24, 0.2), (0.3, 0.45), (0.35, 0.68), (0.34, 0.86)]
    fO, fe1, fe2 = np.array([0.26, -0.3, -0.005]), unit([0.05, 1.0, 0.02]), unit([0.96, 0.22, -0.16])
    front = fin(fO, fe1, fe2, FLE, FTE, 0.05, nu=14, nc=3, tip=0.3)
    scales(front, D_, M_, Y_, under=hexc('#e2d8aa'), seed=253)
    cl = curve(FLE, 15)[6]
    cp = fO + fe1 * cl[0] + fe2 * cl[1]
    claw = tube([cp, cp + np.array([0.008, -0.018, -0.003]), cp + np.array([0.016, -0.03, -0.006])], [0.01, 0.007, 0.002], sides=4)
    claw.C[..., :3] = hexc('#c9b98a')
    rear = fin((0.13, 0.44, -0.015), unit([-0.1, 1.0, 0.0]), unit([0.9, 0.42, -0.1]), [(0.0, 0.0), (0.0, 0.1), (0.04, 0.19), (0.1, 0.26)], [(0.17, 0.0), (0.2, 0.11), (0.2, 0.2), (0.1, 0.26)], 0.04, nu=7, nc=3, tip=0.3)
    scales(rear, D_, M_, Y_, under=hexc('#e2d8aa'), seed=254)
    tail = tube([[0.0, 0.5, -0.02], [0.0, 0.58, -0.03], [0.0, 0.64, -0.04]], [0.05, 0.03, 0.004], sides=6)
    tail.C[..., :3] = hexc('#3a2e1a')
    arm = tube(np.array([[0.1, -0.3, 0.0], [0.2, -0.3, 0.0], [0.3, -0.285, -0.006]]), [0.05, 0.055, 0.045], sides=7)
    arm.V[:, 2] = arm.V[:, 2] * 0.6 - 0.012
    leg = tube(np.array([[0.05, 0.42, 0.0], [0.12, 0.44, 0.0], [0.17, 0.46, -0.004]]), [0.045, 0.045, 0.035], sides=6)
    leg.V[:, 2] = leg.V[:, 2] * 0.6 - 0.018
    arm.C[..., :3] = leg.C[..., :3] = hexc('#8a7a58')
    parts += [front, mirrored(front), claw, mirrored(claw), rear, mirrored(rear), tail, arm, mirrored(arm), leg, mirrored(leg)]
    return join(parts)


# ---------------------------------------------------------------- reef fish
def bony_fish(L, k, ts, skin, dorsal, anal, tail, pect, vent, eye_t, eye_phi, eye_r, iris, rows=7):
    """The common plan of a reef fish: a compressed loft, long dorsal and anal fins, a tail, pectorals, ventrals, an eye. Fins are given as (LE, TE, colfn, thick)."""
    b = Body(L, k)
    parts = [b.loft(ts, lambda t: np.linspace(0, math.pi, rows), skin)]
    Y = lambda t: b.y0 + t * L

    def on_top(t):
        return float(b.point(np.array(t), np.array(0.0))[2])

    def on_bot(t):
        return float(b.point(np.array(t), np.array(math.pi))[2])

    LE, TE, col, th, nu = dorsal
    parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Y(a), on_top(a) - 0.008 + c * L) for a, c in LE], [(Y(a), on_top(a) - 0.008 + c * L) for a, c in TE], th, nu=nu, nc=2, colfn=col, tip=0.5))
    LE, TE, col, th, nu = anal
    parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Y(a), on_bot(a) + 0.008 - c * L) for a, c in LE], [(Y(a), on_bot(a) + 0.008 - c * L) for a, c in TE], th, nu=nu, nc=2, colfn=col, tip=0.5))
    (LEu, TEu), col, th, nu = tail
    for sgn in (1.0, -1.0):                                              # two lobes: the fork is the gap between them
        parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Y(a), sgn * c * L) for a, c in LEu], [(Y(a), sgn * c * L) for a, c in TEu], th, nu=nu, nc=2, colfn=col, tip=0.5))
    t0, phi0, LE, TE, col, th = pect
    p = b.point(np.array(t0), np.array(phi0), 1.0)
    pf = fin(p + np.array([-0.002, 0, 0]), unit([0.2, 1.0, -0.12]), unit([0.55, 0.45, -0.7]), [(a * L, c * L) for a, c in LE], [(a * L, c * L) for a, c in TE], th, nu=4, nc=2, colfn=col, tip=0.5)
    parts += [pf, mirrored(pf)]
    t0, phi0, LE, TE, col, th = vent
    p = b.point(np.array(t0), np.array(phi0), 1.0)
    vf = fin(p, [0, 1, 0], unit([0.3, 0.2, -0.93]), [(a * L, c * L) for a, c in LE], [(a * L, c * L) for a, c in TE], th, nu=3, nc=2, colfn=col, tip=0.5)
    parts += [vf, mirrored(vf)]
    for side in (-1, 1):
        parts.append(b.eye(eye_t, eye_phi, side, eye_r, hexc('#050608'), iris=iris, segs=8, pupil=0.55))
    return b, parts


def solid(c):
    c = hexc(c)
    return lambda u, cc, s: np.broadcast_to(c, u.shape + (3,)).copy()


def fish_a():
    """Yellow tang, Zebrasoma flavescens: a deep, thin disc, a small pointed mouth on a long snout, tall sail fins, a white scalpel at the tail. Pure lemon yellow, faintly lined."""
    L = 0.45
    k = dict(t=[0.0, 0.03, 0.08, 0.14, 0.22, 0.32, 0.46, 0.6, 0.71, 0.8, 0.84], top=[0.005, 0.014, 0.034, 0.1, 0.178, 0.238, 0.262, 0.214, 0.132, 0.062, 0.04], bot=[-0.005, -0.012, -0.026, -0.064, -0.124, -0.192, -0.238, -0.198, -0.122, -0.06, -0.038],
             hw=[0.001, 0.008, 0.016, 0.03, 0.045, 0.054, 0.054, 0.044, 0.03, 0.017, 0.012], zw=[0.0, 0.0, 0.003, 0.012, 0.014, 0.012, 0.008, 0.004, 0.0, 0.0, 0.0], n=[2.0] * 11)
    ts = [0.006, 0.03, 0.06, 0.09, 0.13, 0.19, 0.28, 0.4, 0.54, 0.66, 0.76, 0.84]
    pn = Perlin3(261)

    def skin(t, phi, side, P, fphi, ft):
        lines = 0.5 + 0.5 * np.sin((P[..., 2] * 90.0 + P[..., 1] * 16.0))
        c = mix(hexc('#ffd61a'), hexc('#ffe45a'), (0.45 * lines)[..., None])
        return mix(c, hexc('#f0c000'), sstep(0.0, 0.2, 0.5 - np.abs(phi - 1.57))[..., None] * 0.0 + (0.2 * sstep(0.4, 1.0, np.cos(phi))[..., None]))

    Yel = lambda u, c, s: mix(hexc('#ffd020'), hexc('#ffe878'), sstep(0.5, 1.0, u)[..., None])
    dorsal = ([(0.22, 0.0), (0.3, 0.1), (0.46, 0.155), (0.62, 0.145), (0.76, 0.085), (0.81, 0.05)], [(0.22, 0.0), (0.38, 0.0), (0.54, 0.0), (0.68, 0.0), (0.77, 0.0), (0.81, 0.05)], Yel, 0.006, 7)
    anal = ([(0.36, 0.0), (0.44, 0.1), (0.56, 0.14), (0.68, 0.115), (0.77, 0.07), (0.81, 0.04)], [(0.36, 0.0), (0.48, 0.0), (0.6, 0.0), (0.7, 0.0), (0.77, 0.0), (0.81, 0.04)], Yel, 0.006, 7)
    tail = (([(0.82, 0.02), (0.88, 0.075), (0.95, 0.128), (1.0, 0.155)], [(0.93, 0.0), (0.945, 0.03), (0.975, 0.085), (1.0, 0.155)]), Yel, 0.007, 4)
    # (the tail's rear edge is nearly straight: its two edges meet at the rays' tips)
    pect = (0.27, 96 * RAD, [(0.0, 0.0), (0.04, 0.06), (0.09, 0.13)], [(0.08, 0.0), (0.13, 0.05), (0.09, 0.13)], solid('#fff0a0'), 0.005)
    vent = (0.26, 152 * RAD, [(0.0, 0.0), (0.03, 0.05), (0.06, 0.09)], [(0.07, 0.0), (0.08, 0.05), (0.06, 0.09)], Yel, 0.005)
    b, parts = bony_fish(L, k, ts, skin, dorsal, anal, tail, pect, vent, 0.185, 62 * RAD, 0.0175, hexc('#c7a020'))
    for side in (-1, 1):                                                 # the scalpel: a white blade on the tail stock
        p = b.point(np.array(0.8), np.array(90 * RAD), side, extra=0.0015)
        m = Mesh([p + np.array([0, -0.014, 0.003]), p + np.array([0, 0.012, 0.004]), p + np.array([side * 0.004, 0.0, -0.006])], [[0, 1, 2]], S=False)
        if m.face_normals()[0, 0] * side < 0:
            m = m.flip()
        m.C[..., :3] = hexc('#ffffff')
        parts.append(m)
    # the small pointed mouth
    return join(parts)


def fish_b():
    """Sergeant major, Abudefduf saxatilis: an oval, deep-bodied damsel, silver-white with a yellow back and five crisp black bars, a forked tail with dark edges."""
    L = 0.6
    k = dict(t=[0.0, 0.02, 0.06, 0.13, 0.22, 0.34, 0.48, 0.6, 0.7, 0.78, 0.83], top=[0.006, 0.04, 0.086, 0.138, 0.186, 0.222, 0.226, 0.194, 0.138, 0.08, 0.05], bot=[-0.006, -0.028, -0.064, -0.114, -0.164, -0.208, -0.212, -0.178, -0.122, -0.068, -0.044],
             hw=[0.001, 0.02, 0.036, 0.05, 0.061, 0.067, 0.064, 0.052, 0.036, 0.022, 0.015], zw=[0.0, 0.002, 0.005, 0.006, 0.006, 0.005, 0.004, 0.002, 0.001, 0.0, 0.0], n=[2.0] * 11)
    bars = [0.285, 0.395, 0.505, 0.62, 0.74]
    edges = sorted(set([round(b_ + d, 4) for b_ in bars for d in (-0.024, 0.024)]))
    ts = np.array(sorted(set([0.006, 0.03, 0.08, 0.14, 0.2] + edges + [0.83])))
    Bk = hexc('#0f1114')

    def skin(t, phi, side, P, fphi, ft):
        z = P[..., 2] / L
        yel = sstep(0.06, 0.2, z)
        c = mix(hexc('#dfe6e6'), hexc('#f2dc58'), (0.85 * yel)[..., None])
        c = mix(c, hexc('#f4f6f2'), sstep(2.0, 2.8, phi)[..., None])
        k_ = np.zeros(ft.shape, dtype=bool)
        for b_ in bars:
            k_ |= np.abs(ft - b_) < 0.024
        barmask = k_[:, None] * (fphi[:, None] < 2.3)
        return np.where(barmask[..., None], Bk, c)

    W_ = lambda u, c, s: mix(hexc('#d9d3a8'), hexc('#8f8c6e'), sstep(0.4, 1.0, u)[..., None])
    dorsal = ([(0.24, 0.0), (0.3, 0.055), (0.46, 0.065), (0.6, 0.07), (0.74, 0.085), (0.82, 0.075)], [(0.24, 0.0), (0.4, 0.0), (0.56, 0.0), (0.7, 0.0), (0.76, 0.0), (0.82, 0.075)], W_, 0.008, 7)
    anal = ([(0.54, 0.0), (0.6, 0.06), (0.68, 0.08), (0.76, 0.085), (0.82, 0.07)], [(0.54, 0.0), (0.62, 0.0), (0.7, 0.0), (0.76, 0.0), (0.82, 0.07)], W_, 0.008, 5)
    Tc = lambda u, c, s: mix(hexc('#e8e4cc'), Bk, np.clip(sstep(0.0, 0.2, c - 0.72), 0, 1)[..., None])
    tail = (([(0.81, 0.035), (0.88, 0.085), (0.96, 0.145), (1.0, 0.178)], [(0.905, 0.0), (0.93, 0.03), (0.97, 0.095), (1.0, 0.178)]), Tc, 0.008, 4)
    pect = (0.28, 106 * RAD, [(0.0, 0.0), (0.05, 0.06), (0.11, 0.12)], [(0.08, 0.0), (0.14, 0.05), (0.11, 0.12)], solid('#f2eedb'), 0.006)
    vent = (0.31, 160 * RAD, [(0.0, 0.0), (0.05, 0.05), (0.1, 0.1)], [(0.08, 0.0), (0.11, 0.05), (0.1, 0.1)], solid('#e8e6d8'), 0.006)
    b, parts = bony_fish(L, k, ts, skin, dorsal, anal, tail, pect, vent, 0.13, 72 * RAD, 0.0185, hexc('#c9a22a'))
    for side in (-1, 1):
        p = b.point(np.array(0.285), np.array(100 * RAD), side, extra=0.002)
        parts.append(disc_at(p, b.normal(np.array(0.285), np.array(100 * RAD), side), 0.012, Bk, segs=7))
    return join(parts)


def fish_c():
    """A silver jack (Caranx): a steep forehead, a torpedo body, a sickle tail on a thin stock with bony scutes, long pectorals; blue-steel back, mirror-silver sides, a dark spot on the gill cover, lemon fins."""
    L = 0.8
    k = dict(t=[0.0, 0.02, 0.06, 0.12, 0.2, 0.3, 0.42, 0.54, 0.66, 0.76, 0.83], top=[0.004, 0.026, 0.066, 0.108, 0.135, 0.146, 0.138, 0.112, 0.074, 0.038, 0.016], bot=[-0.004, -0.024, -0.055, -0.092, -0.122, -0.14, -0.134, -0.102, -0.062, -0.03, -0.014],
             hw=[0.001, 0.018, 0.034, 0.048, 0.057, 0.062, 0.056, 0.042, 0.027, 0.014, 0.009], zw=[0.0, 0.0, 0.003, 0.004, 0.004, 0.003, 0.002, 0.001, 0.001, 0.0, 0.0], n=[2.0] * 11)
    ts = [0.006, 0.03, 0.08, 0.14, 0.2, 0.28, 0.38, 0.48, 0.58, 0.68, 0.76, 0.83]

    def skin(t, phi, side, P, fphi, ft):
        y = P[..., 1]
        st = 0.5 + 0.5 * np.sin(P[..., 2] * 60.0 + P[..., 1] * 7.0)
        c = mix(hexc('#3f6c88'), hexc('#d8e2e6'), sstep(0.55, 1.15, phi)[..., None])
        c = mix(c, hexc('#f6f7f4'), sstep(1.5, 2.3, phi)[..., None])
        c = c * (0.94 + 0.12 * st[..., None])
        k_ = sstep(0.018, 0.012, np.hypot(ft[:, None] - 0.205, (phi - 1.05) * 0.1) * 1.0)
        return mix(c, hexc('#101418'), k_[..., None])

    Y = lambda u, c, s: mix(hexc('#d9c95a'), hexc('#7a8a6a'), sstep(0.3, 1.0, u)[..., None])
    dorsal = ([(0.28, 0.0), (0.34, 0.1), (0.42, 0.075), (0.56, 0.045), (0.74, 0.03), (0.8, 0.015)], [(0.28, 0.0), (0.42, 0.0), (0.56, 0.0), (0.68, 0.0), (0.76, 0.0), (0.8, 0.015)], Y, 0.006, 6)
    anal = ([(0.46, 0.0), (0.51, 0.09), (0.58, 0.065), (0.68, 0.04), (0.76, 0.028), (0.8, 0.012)], [(0.46, 0.0), (0.56, 0.0), (0.66, 0.0), (0.72, 0.0), (0.77, 0.0), (0.8, 0.012)], Y, 0.006, 6)
    tail = (([(0.815, 0.012), (0.87, 0.07), (0.94, 0.15), (1.0, 0.225)], [(0.875, 0.0), (0.905, 0.035), (0.95, 0.11), (1.0, 0.225)]), lambda u, c, s: mix(hexc('#d9c95a'), hexc('#3b4a44'), sstep(0.5, 1.0, u)[..., None]), 0.007, 5)
    pect = (0.235, 104 * RAD, [(0.0, 0.0), (0.09, 0.04), (0.2, 0.09), (0.3, 0.13)], [(0.05, 0.0), (0.14, 0.02), (0.24, 0.06), (0.3, 0.13)], solid('#e8e0a0'), 0.005)
    vent = (0.27, 165 * RAD, [(0.0, 0.0), (0.03, 0.04), (0.07, 0.07)], [(0.06, 0.0), (0.08, 0.04), (0.07, 0.07)], solid('#ece6c8'), 0.005)
    b, parts = bony_fish(L, k, ts, skin, dorsal, anal, tail, pect, vent, 0.1, 80 * RAD, 0.0225, hexc('#d9d0a0'))
    for side in (-1, 1):                                                 # the bony scutes on the tail stock, and the mouth
        s = np.linspace(0.0, 1.0, 5)
        parts.append(b.strip(0.62 + 0.21 * s, np.full(5, 90 * RAD), side, 0.004 + 0.008 * s, hexc('#aeb8b6'), lift=0.0012))
        s = np.linspace(0.0, 1.0, 5)
        parts.append(b.strip(0.012 + 0.07 * s, (108 + 16 * s) * RAD, side, 0.005, hexc('#20282c'), lift=0.001))
    return join(parts)


# ---------------------------------------------------------------- moon jelly
def jelly():
    """Aurelia, 1.2 m across: a shallow bell with a scalloped hem, four pale horseshoes showing through, frilled oral arms and a fringe of fine tentacles. Bell above z 0, tentacles below (the shader's pulse reads that)."""
    R, H = 0.6, 0.42
    rs = np.random.RandomState(271)
    rings = 9
    segs = 32
    Pt = np.zeros((rings, segs, 3))
    th = np.linspace(0, TAU, segs, endpoint=False)
    for i in range(rings):
        u = i / (rings - 1.0)
        a = u * 1.5
        scal = 1.0 + 0.025 * np.abs(np.sin(th * 8.0)) * u ** 4
        r = R * math.sin(a) * scal
        Pt[i, :, 0] = r * np.cos(th)
        Pt[i, :, 1] = r * np.sin(th)
        Pt[i, :, 2] = H * math.cos(a) + 0.005
    bell = join([grid(Pt, wrap_v=True), fan(Pt[0], (0, 0, H + 0.01), flip=True)])
    C = bell.corners()
    r = np.hypot(C[..., 0], C[..., 1])
    ang = np.arctan2(C[..., 1], C[..., 0])
    gon = sstep(0.1, 0.03, np.abs(r - 0.2 - 0.05 * np.cos(4.0 * ang))) * (np.cos(4.0 * ang) > -0.45)
    col = mix(hexc('#8fc6dc'), hexc('#e6f4fa'), sstep(0.25, 0.6, r)[..., None])
    col = mix(col, hexc('#f4c4d8'), gon[..., None])
    bell.C[..., :3] = col
    if bell.face_normals()[0, 2] < 0:
        bell = bell.flip()
    Pi = Pt.copy()
    Pi[..., :2] *= 0.965
    Pi[..., 2] -= 0.05
    inner = grid(Pi[2:], wrap_v=True, flip=True)
    inner.C[..., :3] = hexc('#bcdde8')
    parts = [bell, inner]
    # the oral arms: four frilled ribbons from the middle
    for k in range(4):
        a = k / 4.0 * TAU + 0.5
        pts = []
        for i in range(7):
            t = i / 6.0
            pts.append([math.cos(a) * (0.1 + 0.08 * t) + 0.05 * math.sin(t * 7.0 + k), math.sin(a) * (0.1 + 0.08 * t) + 0.05 * math.cos(t * 6.0 + k), 0.2 - 0.95 * t])
        pts = np.array(pts)
        side = unit([-math.sin(a), math.cos(a), 0.0])
        w = np.array([0.03, 0.07, 0.085, 0.08, 0.065, 0.04, 0.008])[:, None]
        frill = 0.03 * np.sin(np.arange(7) * 2.4)[:, None] * np.array([[math.cos(a), math.sin(a), 0.0]])
        A = np.stack([pts - side * w, pts + frill, pts + side * w], 1)
        m = join([grid(A), grid(A, flip=True)])
        m.C[..., :3] = hexc('#f2d4e0')
        parts.append(m)
    # the fringe of tentacles round the hem
    for k in range(18):
        a = k / 18.0 * TAU + rs.uniform(-0.1, 0.1)
        L = rs.uniform(0.7, 1.3)
        p0 = np.array([math.cos(a) * R * 0.97, math.sin(a) * R * 0.97, 0.03])
        pts = [p0]
        for i in range(1, 5):
            t = i / 4.0
            pts.append(p0 + np.array([math.cos(a) * (-0.14 * t + 0.03 * math.sin(t * 8.0 + k)), math.sin(a) * (-0.14 * t) + 0.03 * math.cos(t * 7.0 + k), -L * t]))
        m = tube(pts, [0.008, 0.007, 0.006, 0.005, 0.002], sides=3, cap_end=False)
        m.C[..., :3] = hexc('#dff0f6')
        parts.append(m)
    return join(parts)


# ---------------------------------------------------------------- the Leviathan
def serpent_head():
    """A sea-dragon's head as one carved field, long as a crocodile's and heavy as a moray's: brow ridges, nostril bosses, a jaw hinged open, a bony frill. Head at -y, about 7 m long."""
    p = 0.075
    X, Y, Z, lo, p = field_grid((-2.7, -7.6, -3.0), (2.7, 1.2, 3.2), p)
    pn = Perlin3(281)
    # upper skull: snout to crown
    sk = sd_capsule(X, Y, Z * 1.25, (0, -6.9, 0.72), (0, -3.6, 1.0), 0.5, 1.02)
    sk = smin(sk, sd_capsule(X, Y, Z, (0, -3.8, 0.8), (0, -0.6, 0.65), 1.2, 1.5), 0.6)
    sk = smin(sk, sd_ellipsoid(X, Y, Z, (0, -1.8, 1.5), (1.75, 2.6, 0.95)), 0.5)      # the crown
    for s in (-1, 1):
        sk = smin(sk, sd_ellipsoid(X, Y, Z, (s * 0.46, -6.65, 1.16), (0.25, 0.42, 0.25)), 0.15)   # nostril bosses
        sk = smin(sk, sd_capsule(X, Y, Z, (s * 0.62, -5.9, 1.05), (s * 1.08, -3.5, 1.86), 0.13, 0.3), 0.25)   # brow ridge
        sk = smax(sk, -sd_ellipsoid(X, Y, Z, (s * 1.28, -3.3, 1.28), (0.34, 0.5, 0.3)), 0.12)    # the socket
    # the palate cut flat, so the mouth opens
    gape = -0.04 * (Y + 7.0) + 0.42
    sk = smax(sk, gape - Z, 0.1)
    # lower jaw, dropped open 26 degrees about the hinge
    a = 0.46
    c_, s_ = math.cos(a), math.sin(a)
    hy, hz = -0.8, 0.4
    Yj = (Y - hy) * c_ + (Z - hz) * s_ + hy
    Zj = -(Y - hy) * s_ + (Z - hz) * c_ + hz
    jw = sd_capsule(X, Yj, Zj * 1.25, (0, -6.7, -0.22), (0, -1.0, -0.22), 0.42, 1.0)
    for s in (-1, 1):
        jw = smin(jw, sd_capsule(X, Yj, Zj, (s * 0.62, -6.1, 0.05), (s * 1.3, -0.8, 0.25), 0.18, 0.42), 0.2)
    jw = smax(jw, Zj - 0.26, 0.1)
    d = smin(sk, jw, 0.08)
    # the throat, into the neck
    d = smin(d, sd_capsule(X, Y, Z, (0, -1.5, 0.1), (0, 1.3, 0.0), 1.45, 1.45), 0.4)
    # keeled scales: a coarse relief
    d += 0.03 * pn.fbm(X * 2.2, Y * 2.2, Z * 2.2, 3)
    F = d
    close_field(F, p)
    return surface_nets(F, lo, p)


def serpent(decimate):
    """The Leviathan, 60 m: an evenly ringed body (a path bends it), banded plates along the belly, a dorsal ribbon of fin the whole way, a glowing line down each flank, a carved head with jaws and a frill."""
    L = 60.0
    rings = 112
    pn = Perlin3(282)
    ts = np.linspace(0.0, 1.0, rings)
    t_head = 6.2 / L
    k = dict(t=[0.0, 0.03, 0.1, 0.24, 0.42, 0.62, 0.8, 0.92, 1.0], top=[1.5, 1.52, 1.66, 1.96, 2.08, 1.86, 1.34, 0.76, 0.14], bot=[-1.5, -1.52, -1.68, -2.0, -2.12, -1.86, -1.3, -0.72, -0.1], hw=[1.5, 1.42, 1.5, 1.72, 1.82, 1.62, 1.14, 0.62, 0.12], zw=[0.0] * 9, n=[2.0] * 9)
    k = {a: (np.array(v) / L if a != 't' and a != 'n' else np.array(v)) for a, v in k.items()}
    b = Body(L, k, y_nose=-L / 2.0 + 6.2)
    Lb = L - 6.2
    b.L = Lb
    bt = np.linspace(0.0, 1.0, rings - int(rings * 6.2 / L))
    rows = lambda t: np.linspace(0, math.pi, 8)
    Bk, Sc = hexc('#0c1c26'), hexc('#1d3a44')
    Bl = hexc('#7fa79c')

    def skin(t, phi, side, P, fphi, ft):
        band = np.floor(t.min(axis=1) * 34.0 + 1e-6) % 2                 # whole rings, so a plate is never split along a triangle
        col = mix(Bk, Sc, (0.3 + 0.7 * sstep(0.0, 1.5, phi))[..., None])
        col = col * (0.82 + 0.3 * band)[:, None, None]
        n = pn.fbm(P[..., 0] * 0.4, P[..., 1] * 0.4, P[..., 2] * 0.4, 3)
        col = mix(col, hexc('#2a2a3f'), (0.34 * sstep(0.1, 0.5, n))[..., None])
        belly = (fphi > 128 * RAD)[:, None, None]
        pl = Bl * (0.72 + 0.4 * band)[:, None, None]
        col = np.where(belly, pl, col)
        return col

    def water_rows(t):
        return np.array([0.0, 28, 56, 84, 94, 104, 128, 155, 180]) * RAD

    body = b.loft(bt, water_rows, skin)
    # the lines of light: the row between 84 and 104 degrees glows
    lines = []
    for side in (-1, 1):
        s = np.linspace(0.01, 0.985, 66)
        m = b.strip(s, np.full(66, 94 * RAD), side, 0.3 * (1.0 - 0.75 * s), hexc('#38f0e0'), lift=0.03)
        m.glow(1.0)
        lines.append(m)
    # the dorsal ribbon: one long fin, its height breathing along the body
    ribbon_u = np.linspace(0.02, 0.985, 56)
    H = 1.5 * (0.7 + 0.3 * np.sin(ribbon_u * 41.0)) * (1.0 - ribbon_u ** 3) + 0.12
    base = b.point(ribbon_u, np.zeros(56))
    top = base + np.stack([0 * H, 0.45 * H, H], 1)
    rib = np.stack([base + np.array([0, 0, -0.1]), base * 0.5 + top * 0.5, top], 1)
    th = (0.09 * (1.0 - ribbon_u) + 0.015)[:, None]
    Ra = rib.copy()
    Rb = rib.copy()
    Ra[:, 0, 0] += th[:, 0]
    Ra[:, 1, 0] += th[:, 0] * 0.5
    Rb[:, 0, 0] -= th[:, 0]
    Rb[:, 1, 0] -= th[:, 0] * 0.5
    ma, mb = grid(Ra), grid(Rb, flip=True)
    if ma.face_normals()[10, 0] < 0:
        ma, mb = ma.flip(), mb.flip()
    rb = join([ma, mb])
    C = rb.corners()
    rb.C[..., :3] = mix(hexc('#10323a'), hexc('#2fa6a0'), sstep(0.2, 1.3, (C[..., 2] - b.point(np.clip((C[..., 1] - b.y0) / Lb, 0, 1), np.zeros(C.shape[:2]))[..., 2]))[..., None])
    # the tail blade: the body ends in a tall thin fin
    tb = fin((0.0, b.y0 + 0.93 * Lb, 0.0), [0, 1, 0], [0, 0, 1], [(0.0, 0.5), (1.5, 1.6), (3.0, 2.2), (4.6, 0.0)], [(0.0, -0.5), (1.5, -1.6), (3.0, -2.2), (4.6, 0.0)], 0.12, nu=9, nc=3,
             colfn=lambda u, c, s: mix(hexc('#10323a'), hexc('#2fa6a0'), sstep(0.2, 1.0, c)[..., None]))
    # the head
    head = decimate(serpent_head(), 1050)
    head = head.moved(0, -L / 2.0 + 7.05 + 0.0, 0.0)                     # snout to y = -30
    P = head.corners()
    n = head.face_normals()[:, None, :]
    tone = 0.5 + 0.5 * pn.fbm(P[..., 0] * 1.5, P[..., 1] * 1.5, P[..., 2] * 1.5, 3)
    col = mix(hexc('#0c1c26'), hexc('#27505a'), tone[..., None])
    under = sstep(-0.1, -0.7, n[..., 2])
    col = mix(col, Bl * 0.8, under[..., None])
    head.C[..., :3] = col
    head.S = np.ones(head.tris, dtype=bool)
    Hy = -L / 2.0 + 7.05
    parts = [head]
    # the teeth: long conical fangs, upper and lower, the back of the mouth dark
    rs = np.random.RandomState(283)
    teeth = []
    a = 0.46
    c_, s_ = math.cos(a), math.sin(a)

    def tooth(p, d, L_, r):
        ring = [p + r * np.array([math.cos(q), math.sin(q) * 0.6, 0.0]) for q in np.linspace(0, TAU, 5, endpoint=False)]
        return fan(np.array(ring), p + d * L_)

    for side in (-1, 1):
        for i in range(10):
            y = -6.75 + i * 0.56
            xx = side * (0.5 + 0.075 * i)
            f = 0.6 + 0.7 * math.sin((i + 1) / 11.0 * math.pi)
            t = tooth(np.array([xx, y + Hy, 0.62 + 0.04 * i]), unit([0.0, 0.1, -1.0]), rs.uniform(0.4, 0.62) * f, 0.1 * f)
            t.C[..., :3] = hexc('#efe8d0')
            teeth.append(t.outward())
            # lower: rotate the point about the hinge
            jy = y
            jz = 0.26
            hy, hz = -0.8, 0.4
            yy = (jy - hy) * c_ - (jz - hz) * s_ + hy
            zz = (jy - hy) * s_ + (jz - hz) * c_ + hz
            t = tooth(np.array([xx * 0.94, yy + Hy, zz]), unit([0.0, -s_ * 0.2, c_]), rs.uniform(0.34, 0.5) * f, 0.09 * f)
            t.C[..., :3] = hexc('#efe8d0')
            teeth.append(t.outward())
    parts += teeth
    # the mouth's dark, the eyes, the frill of spines behind the jaw and the crest over the skull
    throat = sphere((0, Hy - 1.2, -0.25), (1.25, 2.5, 0.75), seg=10, rings=6)
    throat.C[..., :3] = hexc('#2a0a14')
    parts.append(throat)
    for side in (-1, 1):
        e = sphere((side * 1.16, Hy - 3.35, 1.3), (0.2, 0.3, 0.2), seg=8, rings=6)
        e.C[..., :3] = hexc('#ffb238')
        e.glow(1.0)
        parts.append(e)
        for i in range(7):
            a2 = 0.28 + i * 0.3
            root = np.array([side * 1.25 * math.cos(a2 - 0.9), Hy - 0.25 + 0.1 * i, 1.25 * math.sin(a2 - 0.9) + 0.2])
            tip = root + np.array([side * (1.1 + 0.15 * i) * math.cos(a2 - 0.6), 1.6 + 0.28 * i, (1.3 + 0.1 * i) * math.sin(a2 - 0.3)])
            sp = tube([root, (root + tip) / 2.0 + np.array([0, 0.1, 0.05]), tip], [0.18, 0.1, 0.012], sides=4)
            sp.C[..., :3] = hexc('#1a3f46')
            parts.append(sp)
    Sp = []
    crest = fin((0.0, Hy - 4.6, 1.5), [0, 1, 0], [0, 0, 1], [(0.0, 0.0), (0.8, 0.5), (2.0, 1.22), (3.2, 1.6), (4.6, 1.55)], [(5.9, 0.0), (5.6, 0.3), (5.3, 0.65), (5.0, 1.1), (4.6, 1.55)], 0.16, nu=9, nc=3,
               colfn=lambda u, c, s: mix(hexc('#10323a'), hexc('#2fa6a0'), sstep(0.2, 1.0, u)[..., None]))
    parts.append(crest)
    hm = join(parts)
    hm.V = (hm.V - np.array([0.0, Hy, 0.0])) * 1.42 + np.array([0.0, Hy + 2.6, 0.0])     # a head as big as the body asks for, its throat in the neck
    m = join([body, rb, tb, hm] + lines)
    m.V[:, 1] = m.V[:, 1] + (-L / 2.0 - m.V[:, 1].min())                  # snout exactly at -30
    return m


def _decimator():
    import bl
    return bl.decimate


# name: (maker, collision, shapes, pitch, ao)   (creatures carry no collision: the game hits them by a sphere)
def _table():
    d = _decimator()
    return {
        'fish_a': (fish_a, None, 0, 0.02, 0.0),
        'fish_b': (fish_b, None, 0, 0.02, 0.0),
        'fish_c': (fish_c, None, 0, 0.02, 0.0),
        'reef_shark': (reef_shark, None, 0, 0.04, 0.0),
        'shark': (shark, None, 0, 0.05, 0.0),
        'dolphin': (dolphin, None, 0, 0.04, 0.0),
        'turtle': (turtle, None, 0, 0.03, 0.0),
        'manta': (manta, None, 0, 0.1, 0.0),
        'whale': (whale, None, 0, 0.3, 0.0),
        'jelly': (jelly, None, 0, 0.03, 0.0),
        'serpent': (lambda: serpent(d), None, 0, 0.5, 0.0),
    }


CREATURES = _table()
SHEET = {'fish': ['fish_a', 'fish_b', 'fish_c'], 'sharks': ['shark', 'reef_shark'], 'mammals': ['dolphin', 'whale'], 'land': ['goat', 'giant_crab', 'crab', 'gull']}
