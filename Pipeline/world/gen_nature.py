# Drowned City: the living sea floor and its rock, from code. Each function returns a Mesh, or for sculpted rock a Mesh to decimate and a painter.
# Shapes follow the real things: fractured, bedded rock; staghorn, sea fan, table and brain corals; tube sponges; bubble-tip anemones; giant kelp
# with its blades and gas bladders; turtle grass. Colours are in linear albedo, with variation inside every piece.
import math
import numpy as np

from meshkit import (Mesh, Perlin3, TAU, bake_ao, field_grid, fan, grid, hexc, join, lathe, mix, sd_ellipsoid, smax, smin, sphere, sstep, surface_nets, tube)

SAND = hexc('#e8d9b0')
CORAL = hexc('#ff7a6b')
ORANGE = hexc('#ff9d4d')
VIOLET = hexc('#9c6bff')
YELLOW = hexc('#ffd35a')
OLIVE = hexc('#8a8a2e')
LITKELP = hexc('#c8c24a')


def unit(v):
    v = np.asarray(v, dtype=np.float64)
    return v / max(np.linalg.norm(v), 1e-9)


def close_field(F, h):
    F[0, :, :] = F[-1, :, :] = h
    F[:, 0, :] = F[:, -1, :] = h
    F[:, :, 0] = F[:, :, -1] = h
    return F


# ---------------------------------------------------------------- rock
def rock_field(X, Y, Z, size, seed, facets=9, bed=0.035, cz_k=0.36):
    """Water-worn rock: a body with a few broad fracture planes rounded off by the sea, bedding seams, and lumps at three sizes. No hard facets: the owner asked for smooth."""
    hx, hy, h = size[0] / 2.0, size[1] / 2.0, size[2]
    cz = h * cz_k
    rz = h - cz
    R = (hx + hy + rz) / 3.0
    pn = Perlin3(seed)
    r = np.random.RandomState(seed)
    wx = X + R * 0.2 * pn.fbm(X / R, Y / R, Z / R, 2)
    wy = Y + R * 0.2 * pn.fbm(X / R + 5.1, Y / R, Z / R, 2)
    wz = Z + R * 0.12 * pn.fbm(X / R, Y / R + 3.3, Z / R, 2)
    U, V, W = wx / hx, wy / hy, (wz - cz) / rz
    d = (np.sqrt(U * U + V * V + W * W) - 1.0) * R
    for i in range(facets):                                             # broad old fracture faces, their edges long since rounded
        n = unit(r.normal(size=3) * np.array([1.0, 1.0, 0.75]))
        k = r.uniform(0.66, 0.98)
        d = smax(d, (U * n[0] + V * n[1] + W * n[2] - k) * R, 0.14 * R)
    tilt = unit(r.normal(size=3) * np.array([0.3, 0.3, 1.0]))
    s = (X * tilt[0] + Y * tilt[1] + Z * tilt[2]) / max(h / 6.0, 0.3)
    bedding = np.abs((s + 0.6 * pn.fbm(X / R * 0.7, Y / R * 0.7, Z / R * 0.7, 2)) % 1.0 - 0.5) * 2.0
    d += bed * R * sstep(0.62, 1.0, bedding)
    d += R * 0.1 * pn.fbm(X / R * 1.9, Y / R * 1.9, Z / R * 1.9, 2)
    return d


def paint_rock(m, seed=1, wet=0.55, tone=None):
    """Colour by what real rock carries: bedding, iron stains, crusts of coralline algae, weed on what faces up. Dark and wet, with variation at every scale, never one grey."""
    pn = Perlin3(seed + 50)
    P = m.corners()
    n = m.face_normals()[:, None, :]
    ext = max((m.V.max(axis=0) - m.V.min(axis=0)).max(), 1.0)
    f = 6.0 / ext
    x, y, z = P[..., 0] * f, P[..., 1] * f, P[..., 2] * f
    t = 0.5 + 0.5 * pn.fbm(x * 0.8, y * 0.8, z * 0.8, 4)
    bands = 0.5 + 0.5 * np.sin((z * 3.4 + 0.5 * x + 1.6 * pn.fbm(x, y, z, 2)) * 2.2)
    base = mix(hexc('#3c3a36'), hexc('#8a8476'), (0.2 + 0.8 * t)[..., None])
    base = mix(base, hexc('#655a4a'), (0.5 * bands)[..., None])
    rust = sstep(0.55, 0.8, 0.5 + 0.5 * pn.fbm(x * 1.7 + 9.0, y * 1.7, z * 1.7, 3))
    base = mix(base, hexc('#74503a'), (0.5 * rust)[..., None])
    crust = sstep(0.6, 0.78, 0.5 + 0.5 * pn.fbm(x * 2.6, y * 2.6 + 4.0, z * 2.6, 3))
    base = mix(base, hexc('#8f6170'), (0.38 * crust * wet)[..., None])                       # coralline crust, only here and there
    weed = sstep(0.1, 0.75, n[..., 2]) * sstep(0.34, 0.66, 0.5 + 0.5 * pn.fbm(x * 1.3, y * 1.3, z * 1.3 + 7.0, 3))
    base = mix(base, hexc('#3f5436'), (0.8 * wet * weed)[..., None])
    flecks = sstep(0.7, 0.86, 0.5 + 0.5 * pn(x * 5.0, y * 5.0, z * 5.0))
    base = mix(base, hexc('#a8a292'), (0.2 * flecks)[..., None])
    if tone is not None:
        base = base * tone
    m.C[..., :3] = base
    m.C[..., 3] = 1.0
    return m


def crag_plan(seed, facets):
    r = np.random.RandomState(seed)
    planes = [(unit(r.normal(size=3) * np.array([1.0, 1.0, 0.55])), r.uniform(0.62, 0.92)) for i in range(facets)]
    tilt = unit(r.normal(size=3) * np.array([0.22, 0.22, 1.0]))
    joints = [(unit(r.normal(size=3) * np.array([1.0, 1.0, 0.35])), r.uniform(-0.55, 0.55)) for i in range(4)]
    return planes, tilt, joints


def crag_terms(X, Y, Z, size, seed, facets, beds):
    """What fresh-broken rock is made of, shared by its shape and its paint: beds, their undercuts, joints."""
    hx, hy, h = size[0] / 2.0, size[1] / 2.0, size[2]
    R = (hx + hy + h * 0.64) / 3.0
    pn = Perlin3(seed)
    planes, tilt, joints = crag_plan(seed, facets)
    s = (X * tilt[0] + Y * tilt[1] + Z * tilt[2]) / (h / beds) + 0.45 * pn.fbm(X / R * 0.6, Y / R * 0.6, Z / R * 0.6, 2)
    gaps = [np.abs((X * n[0] + Y * n[1] + Z * n[2]) / R - o + 0.05 * pn.fbm(X / R * 1.3 + i, Y / R * 1.3, Z / R * 1.3, 2)) * R for i, (n, o) in enumerate(joints)]
    return R, pn, planes, s, np.minimum.reduce(gaps)


def crag(size, seed, pitch, facets=11, beds=5.0, wet=0.55, tone=None):
    """Fresh-broken rock for a phone: flat fracture faces meeting in hard edges, tilted beds each with a lip over a dark undercut, joints cracked in from the surface. Light and dark by face and by bed, so it still reads
    as stone at the size of a thumbnail."""
    hx, hy, h = size[0] / 2.0, size[1] / 2.0, size[2]
    X, Y, Z, lo, p = field_grid((-hx * 1.2, -hy * 1.2, -0.9), (hx * 1.2, hy * 1.2, h * 1.08), pitch)
    R, pn, planes, s, g = crag_terms(X, Y, Z, size, seed, facets, beds)
    cz = h * 0.36
    rz = h - cz
    wx, wy, wz = X + R * 0.05 * pn.fbm(X / R, Y / R, Z / R, 2), Y + R * 0.05 * pn.fbm(X / R + 5.1, Y / R, Z / R, 2), Z + R * 0.03 * pn.fbm(X / R, Y / R + 3.3, Z / R, 2)
    U, V, W = wx / hx, wy / hy, (wz - cz) / rz
    d = (np.sqrt(U * U + V * V + W * W) - 1.0) * R
    for n, k in planes:
        d = smax(d, (U * n[0] + V * n[1] + W * n[2] - k) * R, 0.025 * R)
    f = s - np.floor(s)
    d = d + 0.05 * R * sstep(0.72, 0.98, f)
    w = max(0.62 * pitch, 0.2)
    d = np.maximum(d, np.minimum(w - g, d + R * 0.16))
    d = d + R * 0.028 * pn.fbm(X / R * 3.0, Y / R * 3.0, Z / R * 3.0, 2)
    d = smax(d, (lo[2] + p * 1.5) - Z, p)
    close_field(d, p)
    m = paint_rock(surface_nets(d, lo, p), seed, wet, tone)
    C = m.corners()
    R, pn, planes, s, g = crag_terms(C[..., 0], C[..., 1], C[..., 2], size, seed, facets, beds)
    f = s - np.floor(s)
    bed_t = 0.86 + 0.28 * (0.5 + 0.5 * np.sin(np.floor(s) * 12.9898 + seed))
    U, V, W = C[..., 0] / hx, C[..., 1] / hy, (C[..., 2] - cz) / rz
    which = np.argmax(np.stack([U * n[0] + V * n[1] + W * n[2] - k for n, k in planes], axis=-1), axis=-1)
    face_t = 0.84 + 0.3 * (0.5 + 0.5 * np.sin(which * 7.13 + seed * 0.37))
    dark = (1.0 - 0.7 * sstep(2.2, 0.8, g / w)) * (1.0 - 0.45 * sstep(0.7, 0.98, f))
    m.C[..., :3] = np.clip(m.C[..., :3] * (bed_t * face_t * dark)[..., None], 0.0, 1.0)
    return m


def strata_stack(size, seed, beds=12, segs=28, flutes=0, flute_amp=0.0, prof=None, wander=0.14, wob=0.2, cap=True):
    """Rock as it is laid down: a stack of beds, each its own outline, each with a lip standing proud and a dark undercut beneath it. Lofted rows, so the triangles are even
    and there is no facet or pinch to see, and the ledges are true geometry. prof(t) gives the outline's size up the stack. A long rough axis keeps it from reading as turned."""
    rs = np.random.RandomState(seed)
    pn = Perlin3(seed)
    hx, hy, H = size[0] / 2.0, size[1] / 2.0, size[2]
    prof = prof or (lambda t: 1.0 - 0.34 * t + 0.4 * float(sstep(0.16, 0.0, t)))
    edges = np.cumsum(np.concatenate([[0.0], rs.uniform(0.35, 1.7, beds)]))     # thick beds and thin ones, as rock is
    edges = -1.4 + edges / edges[-1] * (H + 1.4)
    th = np.linspace(0, TAU, segs, endpoint=False)
    cx, cy = np.cos(th), np.sin(th)
    rows = []
    # the whole stack dips one way, as tilted strata do, and each bed wanders across the face
    dip = unit(rs.normal(size=2)) * rs.uniform(0.07, 0.15)
    shift = np.cumsum(rs.normal(size=(beds, 2)) * 0.09, axis=0)
    for b in range(beds):
        z0, z1 = edges[b], edges[b + 1]
        th_b = z1 - z0
        bedshape = 1.0 + 0.15 * pn(cx * 1.1 + b * 0.31, cy * 1.1, b * 0.43 + 0.0 * cx) + 0.06 * pn(cx * 2.6 + b, cy * 2.6, b * 0.9 + 0.0 * cx) + rs.uniform(-0.05, 0.05)
        for f, off in ((0.0, -0.05), (0.2, 0.035), (0.8, 0.012)):
            z = z0 + th_b * f
            t = np.clip(z / H, 0.0, 1.0)
            k = prof(float(t)) * bedshape * (1.0 + wob * pn.fbm(cx * 1.1, cy * 1.1, np.full(segs, z * 0.07), 3))
            if flutes:
                k = k * (1.0 + flute_amp * np.abs(np.sin(th * flutes * 0.5 + b * 0.7)))
            k = k + off * min(1.0, th_b / 2.5) * 6.0 / max(hx, 6.0)
            ox = wander * hx * float(pn(z * 0.05, 3.1, 7.7)) * 2.0 + shift[b, 0] * hx * 0.5
            oy = wander * hy * float(pn(z * 0.05, 8.3, 1.9)) * 2.0 + shift[b, 1] * hy * 0.5
            X_, Y_ = hx * k * cx + ox, hy * k * cy + oy
            sag = 0.5 * th_b * pn(cx * 1.2, cy * 1.2, np.full(segs, b * 1.7))                 # a bed's top is never level
            rows.append(np.stack([X_, Y_, z + (X_ * dip[0] + Y_ * dip[1]) + sag], 1))
    last = rows[-1]
    if cap:                                                             # the broken top
        c = last.mean(axis=0)
        for f, dz in ((0.82, 0.3), (0.52, 0.9), (0.2, 1.1)):
            q = c + (last - c) * f
            q[:, 2] = last[:, 2] + dz + 0.7 * pn.fbm(cx * 1.6, cy * 1.6, np.full(segs, 2.0), 2)
            rows.append(q)
    P = np.array(rows)
    g_ = grid(P, wrap_v=True)
    if np.mean(np.sum(g_.face_normals()[:segs] * (g_.corners().mean(axis=1)[:segs] - np.array([0.0, 0.0, P[0, :, 2].mean()])), axis=1)) < 0:
        g_ = g_.flip()
    t_, b_ = fan(P[-1], P[-1].mean(axis=0) + np.array([0, 0, 0.15])), fan(P[0], P[0].mean(axis=0))
    if t_.face_normals()[0, 2] < 0:
        t_ = t_.flip()
    if b_.face_normals()[0, 2] > 0:
        b_ = b_.flip()
    m = join([g_, t_, b_])
    m.beds = edges
    m.bed_rows = (segs, beds)
    m.P = P                                                              # the loft's own grid: a far mesh is every other row and column of it
    return m


def seams(m, edges, dark=0.42, width=0.24):
    """Darken each bed's underside: the shadow line that makes strata read from far off and from close to."""
    # the beds are rows of the loft: a row's own index says which part of a bed it is (undercut, lip, face), which holds however the bed dips
    n = getattr(m, 'bed_rows', None)
    if n is None:
        z = m.corners()[..., 2]
        i = np.clip(np.searchsorted(edges, z) - 1, 0, len(edges) - 2)
        f = (z - edges[i]) / np.maximum(edges[i + 1] - edges[i], 1e-3)
        m.C[..., :3] = m.C[..., :3] * (dark + (1.0 - dark) * sstep(0.0, width, f))[..., None]
        return m
    segs, beds = n
    fi = np.arange(m.tris) // 2
    row = fi // segs
    under = (row % 3 == 2) & (row < beds * 3)                           # the row of faces that closes one bed into the undercut of the next
    m.C[under, :, :3] *= dark
    m.C[(row % 3 == 0) & (row < beds * 3), :, :3] *= 1.08
    return m


def rock_pillar():
    m = strata_stack((10.0, 9.0, 32.0), 104, beds=12, segs=28, wander=0.2, wob=0.24)
    e = m.beds
    paint_rock(m, 104, tone=1.25)
    return seams(m, e, 0.5)


def islet_rock():
    """Gull Rock: low beds of pale stone, tilted, stepped back from the sea."""
    m = strata_stack((50.0, 41.0, 17.0), 106, beds=7, segs=34, prof=lambda t: 1.0 - 0.72 * t ** 1.3, wander=0.14, wob=0.32)
    e = m.beds
    paint_rock(m, 106, 0.3, tone=1.35)
    return seams(m, e, 0.55)


def rock(size, seed, pitch=None, facets=9, bed=0.05):
    pitch = pitch or max(size) / 20.0                                   # the mesh's own resolution: no decimation, so no pinches
    hx, hy, h = size[0] / 2.0, size[1] / 2.0, size[2]
    X, Y, Z, lo, p = field_grid((-hx * 1.2, -hy * 1.2, -0.9), (hx * 1.2, hy * 1.2, h * 1.08), pitch)
    F = rock_field(X, Y, Z, size, seed, facets, bed)
    F = smax(F, (lo[2] + p * 1.5) - Z, p)
    close_field(F, p)
    return surface_nets(F, lo, p)


def pillar(size, seed):
    """A sea stack: tall, bedded, undercut, wider at the foot, the top broken."""
    pitch = max(size[0], size[1]) / 26.0
    hx, hy, h = size[0] / 2.0, size[1] / 2.0, size[2]
    X, Y, Z, lo, p = field_grid((-hx * 1.5, -hy * 1.5, -1.2), (hx * 1.5, hy * 1.5, h * 1.04), pitch)
    pn = Perlin3(seed)
    t = np.clip(Z / h, 0.0, 1.0)
    wob = 0.26 * pn.fbm(Z / (h * 0.22), Z * 0 + 2.0, Z * 0 + 1.0, 3)                            # the waist moves with height
    wob2 = 0.26 * pn.fbm(Z / (h * 0.22), Z * 0 + 6.0, Z * 0 + 3.0, 3)
    rad = (1.0 - 0.34 * t + 0.42 * sstep(0.2, 0.0, t)) * (1.0 + 0.09 * np.sin(Z * 0.42 + 1.5 * pn.fbm(X / hx, Y / hy, Z / h, 2)))
    U, V = (X - wob * hx) / (hx * rad), (Y - wob2 * hy) / (hy * rad)
    d = (np.sqrt(U * U + V * V) - 1.0) * min(hx, hy)
    d += min(hx, hy) * (0.22 * pn.fbm(X / hx * 1.6, Y / hy * 1.6, Z / hx * 0.6, 3) + 0.07 * pn.fbm(X / hx * 3.5, Y / hy * 3.5, Z / hx * 3.0, 2))
    top = h * (0.9 + 0.08 * pn.fbm(X / hx * 1.2, Y / hy * 1.2, X * 0 + 4.0, 2))
    d = smax(d, Z - top, 0.5)
    d = smax(d, (lo[2] + p * 1.5) - Z, p)
    close_field(d, p)
    return surface_nets(d, lo, p)


def sea_arch():
    """A huge natural arch: a rock bridge of bedded stone, thin in the middle, a tunnel you swim through (along y). Its top stands clear of the sea."""
    p = 3.2
    X, Y, Z, lo, p = field_grid((-60.0, -22.0, -2.2), (60.0, 22.0, 42.0), p)
    pn = Perlin3(1931)
    wx = X + 6.0 * pn.fbm(X / 34.0, Y / 34.0, Z / 34.0, 3)
    wy = Y + 5.0 * pn.fbm(X / 34.0 + 3.0, Y / 34.0, Z / 34.0, 3)
    wz = Z + 3.0 * pn.fbm(X / 30.0, Y / 30.0 + 2.0, Z / 30.0, 3)
    deck = 32.0 + 7.0 * sstep(10.0, 40.0, np.abs(wx)) + 2.0 * pn.fbm(X / 22.0, Y / 22.0, X * 0, 2)    # the top, lower at mid-span
    mass = smax(np.maximum(np.abs(wx) - 50.0, np.abs(wy) - (11.5 + 5.0 * sstep(26.0, 0.0, Z) + 3.0 * sstep(14.0, 44.0, np.abs(wx)))), wz - deck, 5.0)
    bore = (np.sqrt((wx / 27.0) ** 2 + ((wz - 4.0) / 19.0) ** 2) - 1.0) * 19.0
    d = smax(mass, -bore, 2.2)
    beds = np.abs(((wz + 0.14 * wx) / 7.4 + 0.5 * pn.fbm(X / 26.0, Y / 26.0, Z / 26.0, 2)) % 1.0 - 0.5) * 2.0
    d += 1.5 * sstep(0.45, 1.0, beds)
    d += 2.8 * pn.fbm(X / 15.0, Y / 15.0, Z / 15.0, 2)
    d = smax(d, (lo[2] + p * 1.5) - Z, p)
    close_field(d, p)
    return surface_nets(d, lo, p)


def islet():
    """Gull Rock: a broken crown of bedded rock standing out of the sea."""
    p = 0.55
    X, Y, Z, lo, p = field_grid((-30.0, -27.0, -1.8), (30.0, 27.0, 17.0), p)
    pn = Perlin3(77)
    wx = X + 3.0 * pn.fbm(X / 12.0, Y / 12.0, Z / 12.0, 3)
    wy = Y + 3.0 * pn.fbm(X / 12.0 + 3.0, Y / 12.0, Z / 12.0, 3)
    d = sd_ellipsoid(wx, wy, Z, (0, 0, -4.0), (25.0, 21.0, 17.0))
    d = smin(d, sd_ellipsoid(wx, wy, Z, (6.0, -4.0, 2.0), (8.0, 7.0, 13.0)), 3.0)
    d = smin(d, sd_ellipsoid(wx, wy, Z, (-9.0, 6.0, 0.0), (9.0, 8.0, 9.0)), 3.0)
    tilt = (Z + 0.32 * X - 0.12 * Y) / 2.3
    beds = np.abs((tilt + 0.5 * pn.fbm(X / 10.0, Y / 10.0, Z / 10.0, 2)) % 1.0 - 0.5) * 2.0
    d += 0.6 * sstep(0.55, 1.0, beds)
    d += 2.0 * pn.fbm(X / 8.0, Y / 8.0, Z / 8.0, 2)
    d = smax(d, (lo[2] + p * 1.5) - Z, p)
    close_field(d, p)
    return surface_nets(d, lo, p)


# ---------------------------------------------------------------- corals
def _gradient(m, p0, d, L, c0, c1, power=1.0):
    t = np.clip(((m.corners() - p0) @ d) / max(L, 1e-6), 0.0, 1.0) ** power
    m.C[..., :3] = mix(c0, c1, t[..., None])
    return m


def _curved(p, d, L, n, rs, wander=0.14, lift=0.08):
    pts = [p.copy()]
    q, dd = p.copy(), d.copy()
    for i in range(n):
        dd = unit(dd + rs.normal(size=3) * wander + np.array([0, 0, lift]))
        q = q + dd * L / n
        pts.append(q.copy())
    return np.array(pts), dd


def coral_branch():
    """A staghorn thicket: many antlers from one base, branching at wide angles, tips turning up to the light, pale at the growing point, the old base dark."""
    rs = np.random.RandomState(11)
    root, mid, tip = hexc('#5e3530'), hexc('#d2806a'), hexc('#fbe6d4')
    parts = []

    def grow(p, d, L, r, lvl):
        pts, dd = _curved(p, d, L, 2, rs, 0.1, 0.2 + 0.08 * lvl)
        m = tube(pts, [r, r * 0.86, r * 0.68], sides=(5, 4, 3)[lvl], cap_end=lvl == 2)
        c0 = mix(root, mid, min(lvl / 1.5, 1.0))
        c1 = tip if lvl == 2 else mix(mid, tip, 0.3 * lvl)
        _gradient(m, p, unit(pts[-1] - p), np.linalg.norm(pts[-1] - p), c0, c1, 1.3)
        parts.append(m)
        if lvl == 2:
            return
        for k in range(3):
            a = rs.uniform(0, TAU)
            side = unit(np.cross(dd, [math.cos(a), math.sin(a), 0.3]))
            cd = unit(dd + side * rs.uniform(0.6, 1.1))
            grow(pts[1 + (k % 2)], cd, L * rs.uniform(0.62, 0.86), r * 0.62, lvl + 1)

    for k in range(6):
        a = k / 6.0 * TAU + rs.uniform(-0.3, 0.3)
        grow(np.array([math.cos(a) * 0.16, math.sin(a) * 0.16, -0.12]), unit([math.cos(a) * 0.75, math.sin(a) * 0.75, 0.8]), rs.uniform(0.8, 1.05), 0.07, 0)
    return join(parts)


def coral_fan():
    """A gorgonian sea fan: ribs that fork again and again as they spread, cross-linked into a fine lattice, flat and slightly cupped to the current; violet, paler at the edge."""
    rs = np.random.RandomState(12)
    dark, mid, tip = hexc('#35195f'), hexc('#8a48c4'), hexc('#d8a8f0')
    parts, outer = [], []

    def cup(p):
        p = np.array(p, dtype=np.float64)
        p[..., 1] = p[..., 1] + 0.1 * (p[..., 0] ** 2) - 0.03 * p[..., 2] ** 2
        return p

    def rib(p, a, L, r, gen):
        q = np.array(p, dtype=np.float64)
        pts = [q.copy()]
        aa = a
        for k in range(2):
            aa += rs.normal() * 0.07
            q = q + np.array([math.sin(aa), 0.0, math.cos(aa)]) * L / 2.0
            pts.append(q.copy())
        cp = cup(np.array(pts))
        m = tube(cp, np.linspace(r, r * 0.72, 3), sides=3, cap_end=False)
        _gradient(m, cp[0], np.array([0, 0, 1.0]), 2.9, mix(dark, mid, 0.5 + 0.25 * gen), tip, 1.3)
        parts.append(m)
        if gen == 3:
            outer.append(q.copy())
            return
        for s_ in (-1, 1):
            rib(q, aa + s_ * rs.uniform(0.2, 0.34), L * rs.uniform(0.72, 0.9), r * 0.76, gen + 1)

    for i in range(5):
        a = (i / 4.0 - 0.5) * 1.5
        rib([0.0, 0.0, 0.3], a, 0.85, 0.042, 0)
    e = np.array(outer)
    inner = []
    for m_ in parts:
        pass
    o = np.argsort(np.arctan2(e[:, 0], e[:, 2] - 0.3))
    for i in range(len(o) - 1):                                         # the lattice: cross links between neighbouring tips, and a little further in
        a_, b_ = e[o[i]], e[o[i + 1]]
        for f in (1.0, 0.72):
            pa, pb = np.array([0, 0, 0.3]) + (a_ - np.array([0, 0, 0.3])) * f, np.array([0, 0, 0.3]) + (b_ - np.array([0, 0, 0.3])) * f
            c_ = cup(np.array([pa, (pa + pb) / 2.0, pb]))
            m = tube(c_, [0.01, 0.01, 0.01], sides=3, cap_end=False)
            m.C[..., :3] = mix(mid, tip, 0.6)
            parts.append(m)
    stem = tube([[0.0, 0.0, -0.15], [0.01, 0.0, 0.15], [0.0, 0.0, 0.34]], [0.08, 0.055, 0.04], sides=5, cap_end=False)
    stem.C[..., :3] = dark
    parts.append(stem)
    return join(parts)


def coral_table():
    """Table Acropora: broad shelves on a single trunk, their rims frilled with fingers; dusty tan, the living rim pale; a rough top of little corymbs."""
    rs = np.random.RandomState(13)
    pn = Perlin3(13)
    trunk, top, rim = hexc('#57462f'), hexc('#a08655'), hexc('#efe0b6')
    parts = [lathe([(0.42, -0.2), (0.27, 0.25), (0.2, 0.8), (0.3, 1.04), (0.5, 1.12)], 9).tinted(trunk)]

    def plate(cx, cy, cz, R, tilt_x, tilt_y, nr=6, nt=26):
        th = np.linspace(0, TAU, nt, endpoint=False)
        edge = R * (1.0 + 0.18 * pn(np.cos(th) * 1.5 + cx, np.sin(th) * 1.5 + cy, th * 0 + 1.0) + 0.07 * np.sin(th * 9.0 + 1.0) + 0.05 * np.sin(th * 15.0))
        rr = np.linspace(0.03, 1.0, nr + 1)[:, None] * edge[None, :]
        X = rr * np.cos(th)
        Y = rr * np.sin(th)
        Z = 0.14 * (rr / R) ** 2 * R * 0.38 + 0.05 * pn(X * 2.0, Y * 2.0, X * 0) + 0.035 * pn(X * 6.0, Y * 6.0, X * 0 + 3.0)
        Ptop = np.stack([X, Y, Z + 0.06], 2)
        Pbot = np.stack([X * 0.98, Y * 0.98, Z - 0.09 - 0.14 * (1.0 - rr / R)], 2)
        t = grid(Ptop, wrap_v=True)
        b = grid(Pbot[::2], wrap_v=True, flip=True)
        if t.face_normals()[len(t.T) // 2, 2] < 0:
            t, b = t.flip(), b.flip()
        s = grid(np.stack([Pbot[-1], Ptop[-1]], 0), wrap_v=True)
        if np.mean(np.sum(s.face_normals()[:, :2] * s.corners().mean(axis=1)[:, :2], axis=1)) < 0:
            s = s.flip()
        for mesh in (t, b, s):
            C = mesh.corners()
            r_c = np.linalg.norm(C[..., :2], axis=-1) / np.max(edge)
            spot = 0.5 + 0.5 * pn(C[..., 0] * 5.0, C[..., 1] * 5.0, C[..., 2] * 0 + 7.0)
            mesh.C[..., :3] = mix(mix(top * 0.74, top * 1.12, spot[..., None]), rim, sstep(0.7, 1.0, r_c)[..., None])
        b.C[..., :3] = b.C[..., :3] * 0.55
        fingers = []
        for k in range(14):
            a = th[rs.randint(nt)] + rs.uniform(-0.08, 0.08)
            i = int(((a % TAU) / TAU) * nt) % nt
            r0 = edge[i] * rs.uniform(0.84, 0.98)
            p = np.array([r0 * math.cos(a), r0 * math.sin(a), 0.14 * 0.38 * R * (r0 / R) ** 2 + 0.04])
            d = unit([math.cos(a) * 0.75, math.sin(a) * 0.75, 1.0])
            f = tube([p, p + d * 0.09, p + d * 0.17], [0.05, 0.04, 0.024], sides=3)
            f.C[..., :3] = rim
            fingers.append(f)
        return join([t, b, s] + fingers).rot('x', tilt_x).rot('y', tilt_y).moved(cx, cy, cz)

    parts.append(plate(0.15, 0.1, 1.1, 2.3, 0.05, -0.04))
    parts.append(plate(-0.6, -0.4, 0.6, 1.25, 0.1, 0.12, nr=4, nt=20))
    return join(parts)


def coral_brain():
    """A brain coral boulder: a lobed dome ploughed with meandering valleys, cut face by face so the maze stays crisp; ridges olive-tan, valleys pale."""
    pn = Perlin3(14)
    rings, segs = 22, 31
    lat = np.linspace(0.0, 1.0, rings + 1)[1:]
    th = np.linspace(0, TAU, segs, endpoint=False)
    R, H = 2.0, 1.55
    A = lat[:, None] * (math.pi / 2 + 0.3)
    TH = np.broadcast_to(th[None, :], (rings, segs))
    sx, sy, sz = np.sin(A) * np.cos(TH), np.sin(A) * np.sin(TH), np.cos(A)
    lobes = 1.0 + 0.14 * pn(sx * 1.2, sy * 1.2, sz * 1.2) + 0.05 * pn(sx * 2.8, sy * 2.8, sz * 2.8 + 5.0)
    X, Y, Z = R * sx * lobes, R * sy * lobes, H * sz * lobes + 0.25

    def meander(x, y, z):
        w = 0.42 * pn(x * 0.6, y * 0.6, z * 0.6)
        return np.abs(pn(x * 1.12 + w, y * 1.12 - w, z * 1.12 + 3.0))

    P = np.stack([X, Y, Z], 2)
    n = P * np.array([1.0, 1.0, 1.4]) - np.array([0, 0, 0.25])
    n = n / np.linalg.norm(n, axis=2, keepdims=True)
    P = P - n * (0.12 * sstep(0.17, 0.06, meander(X, Y, Z)))[..., None]
    m = grid(P, wrap_v=True)
    f_ = fan(P[0], (0, 0, Z.max() + 0.02))
    if m.face_normals()[len(m.T) // 2, 2] < 0 and False:
        m = m.flip()
    c_ = m.corners().mean(axis=1) - np.array([0, 0, 0.25])
    if np.mean(np.sum(m.face_normals() * c_, axis=1)) < 0:
        m = m.flip()
    if f_.face_normals()[0, 2] < 0:
        f_ = f_.flip()
    m = join([m, f_])
    C = m.corners()
    val = sstep(0.2, 0.05, meander(C[..., 0], C[..., 1], C[..., 2]))
    tone = 0.5 + 0.5 * pn.fbm(C[..., 0] * 0.8, C[..., 1] * 0.8, C[..., 2] * 0.8 + 5.0, 3)
    ridge = mix(hexc('#5f5a28'), hexc('#ad9550'), tone[..., None])
    m.C[..., :3] = mix(ridge, hexc('#d6cca2'), (0.72 * val)[..., None])
    return m


def coral_tube():
    """Tube sponges: a clump of thick, lumpy, open-topped pipes leaning out of one foot, the throats dark, sun-yellow fading to ochre below."""
    rs = np.random.RandomState(15)
    pn = Perlin3(15)
    parts = [sphere((0, 0, 0.1), (0.72, 0.72, 0.42), seg=10, rings=6).tinted(hexc('#8e5f18'))]
    for k in range(8):
        a = k / 8.0 * TAU + rs.uniform(-0.3, 0.3)
        d = 0.05 if k == 0 else rs.uniform(0.3, 0.64)
        h = rs.uniform(0.9, 2.1) * (1.25 if k == 0 else 1.0)
        r = rs.uniform(0.16, 0.3)
        zs = np.array([-0.05, 0.22, 0.5, 0.76, 0.92, 1.0]) * h
        rad = r * np.array([0.72, 0.84, 1.0, 1.1, 1.18, 1.26])
        n_ = 10
        th = np.linspace(0, TAU, n_, endpoint=False)
        rows = []
        for z, q in zip(zs, rad):
            rows.append((q * (1.0 + 0.24 * pn(np.cos(th) * 1.3 + k, np.sin(th) * 1.3, th * 0 + z * 2.2)), z))
        rows.append((rad[-1] * 0.82 * np.ones(n_), zs[-1] + 0.01))
        rows.append((rad[-1] * 0.62 * np.ones(n_), zs[-1] - 0.32))
        ring = np.zeros((len(rows), n_, 3))
        for i, (q, z) in enumerate(rows):
            lean = (max(z, 0.0) / h) ** 1.5 * 0.36
            ring[i, :, 0] = (d + lean) * math.cos(a) + q * np.cos(th)
            ring[i, :, 1] = (d + lean) * math.sin(a) + q * np.sin(th)
            ring[i, :, 2] = z
        m = grid(ring, wrap_v=True)
        c_ = m.corners().mean(axis=1)[:len(zs) * 0 + 40] - ring[:, :, :].mean(axis=(0, 1))
        if np.mean(np.sum(m.face_normals()[:40] * c_, axis=1)) < 0:
            m = m.flip()
        C = m.corners()
        s_ = np.clip(C[..., 2] / h, 0, 1)
        col = mix(hexc('#7d5a1a'), hexc('#d9a33a'), sstep(0.0, 0.7, s_ + 0.3 * pn.fbm(C[..., 0] * 3.0, C[..., 1] * 3.0, C[..., 2] * 3.0, 2))[..., None])
        spots = sstep(0.1, 0.5, pn(C[..., 0] * 8.0, C[..., 1] * 8.0, C[..., 2] * 8.0))
        col = mix(col, hexc('#f0d278'), (0.34 * spots)[..., None])
        inner = (np.arange(len(m.T)) // (2 * n_)) >= len(zs) - 1
        col[inner] = hexc('#241607')
        m.C[..., :3] = col
        parts.append(m)
        f_ = fan(ring[-1], (ring[-1, :, 0].mean(), ring[-1, :, 1].mean(), zs[-1] - 0.5))
        if f_.face_normals()[0, 2] < 0:
            f_ = f_.flip()
        parts.append(f_.tinted(hexc('#120b04')))
    return join(parts)


def anemone():
    """A long-tentacled anemone: a mop that hides its own short column, the tentacles drooping outward, gold-green at the root, rose at the tip."""
    rs = np.random.RandomState(16)
    body = lathe([(0.8, -0.12), (0.76, 0.1), (0.68, 0.24), (0.5, 0.3), (0.0, 0.34)], 11)
    body.C[..., :3] = hexc('#7a3f4c')
    parts = [body]
    N = 56
    for i in range(N):
        a = i * 2.39996
        r = 0.74 * math.sqrt((i + 0.5) / N)
        p = np.array([r * math.cos(a), r * math.sin(a), 0.28])
        out = np.array([math.cos(a), math.sin(a), 0.0])
        L = rs.uniform(0.75, 1.25)
        pts = [p]
        q = p.copy()
        d = unit(out * (0.2 + r) + np.array([0, 0, 1.0]))
        for k in range(3):
            d = unit(d + out * 0.42 + np.array([0, 0, -0.34]) + rs.normal(size=3) * 0.08)
            q = q + d * L / 3
            pts.append(q.copy())
        m = tube(pts, [0.05, 0.047, 0.04, 0.012], sides=3)
        C = m.corners()
        s_ = np.clip(np.linalg.norm(C - p, axis=-1) / L, 0, 1)
        m.C[..., :3] = mix(mix(hexc('#7c8c3a'), hexc('#d8a0b0'), sstep(0.15, 0.7, s_)[..., None]), hexc('#ff6aaa'), sstep(0.7, 1.0, s_)[..., None])
        parts.append(m)
    return join(parts)


def glow_coral():
    """Deep-water bamboo coral: pale whips in a loose fan, jointed, tipped with living light. Its colours are neutral: the look tints each instance cyan or magenta and lights it by these values."""
    rs = np.random.RandomState(17)
    stem, lit = np.array([0.05, 0.05, 0.06]), np.array([0.95, 0.97, 1.0])
    parts = []

    def grow(p, d, L, r, lvl):
        pts, dd = _curved(p, d, L, 3, rs, 0.1, 0.12)
        m = tube(pts, np.linspace(r, r * 0.55, 4), sides=4 if lvl == 0 else 3, cap_end=False)
        C = m.corners()
        t = np.clip(((C - p) @ unit(pts[-1] - p)) / L, 0, 1)
        m.C[..., :3] = mix(stem, lit, (sstep(0.0, 1.0, (lvl + t) / 3.0) ** 2.2)[..., None])
        parts.append(m)
        for i in range(1, 4):
            a = rs.uniform(0, TAU)
            o = np.array([math.cos(a), math.sin(a), 0.2]) * 0.1
            tip = tube([pts[i], pts[i] + o], [0.022, 0.006], sides=3)    # the polyps: small bright spurs
            tip.C[..., :3] = lit * (0.45 + 0.18 * i)
            parts.append(tip)
        if lvl >= 2:
            return
        for k in range(2):
            a = rs.uniform(0, TAU)
            cd = unit(dd + np.array([math.cos(a), math.sin(a), 0.0]) * rs.uniform(0.5, 0.9))
            grow(pts[-2 if k == 0 else -1], cd, L * 0.74, r * 0.66, lvl + 1)

    for k in range(3):
        a = k / 3.0 * TAU + 0.4
        grow(np.array([0, 0, -0.1]), unit([math.cos(a) * 0.3, math.sin(a) * 0.3, 1.0]), 1.5, 0.06, 0)
    return join(parts)


# ---------------------------------------------------------------- weed
def ribbon(points, widths, side, c0, c1, folded=0.0):
    """A blade, one layer: the look draws kelp, grass and leaves two-sided. folded lifts the midrib, for a leaf with a keel."""
    P = np.asarray(points, dtype=np.float64)
    W = np.asarray(widths, dtype=np.float64)[:, None]
    side = np.asarray(side, dtype=np.float64)
    if side.ndim == 1:
        side = np.broadcast_to(unit(side), P.shape)
    d = np.gradient(P, axis=0)
    nrm = np.cross(d, side)
    nrm = nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    if folded:
        m = grid(np.stack([P - side * W - nrm * folded * W, P, P + side * W - nrm * folded * W], 1))
    else:
        m = grid(np.stack([P - side * W, P + side * W], 1))
    C = m.corners()
    t = np.clip(np.linalg.norm(C - P[0], axis=-1) / max(np.linalg.norm(P[-1] - P[0]), 1e-6), 0, 1)
    m.C[..., :3] = mix(c0, c1, t[..., None])
    return m


def seagrass():
    """Turtle grass: a thick tuft of flat strap blades, each its own length and bend, green with sun-bleached tips."""
    rs = np.random.RandomState(18)
    parts = []
    for i in range(35):
        a, r = rs.uniform(0, TAU), 0.8 * math.sqrt(rs.rand())
        p = np.array([r * math.cos(a), r * math.sin(a), -0.05])
        L = rs.uniform(0.7, 1.8)
        lean = rs.uniform(0, TAU)
        bend = np.array([math.cos(lean), math.sin(lean), 0.0])
        pts = [p + np.array([0, 0, L * (t - 0.12 * t * t)]) + bend * (0.36 * L * t * t) for t in (0.0, 0.34, 0.68, 1.0)]
        side = np.array([-bend[1], bend[0], 0.0])
        g0, g1 = hexc('#2b5428'), mix(hexc('#7d9a3f'), hexc('#c9c07a'), rs.uniform(0.0, 0.6))
        parts.append(ribbon(pts, [0.04, 0.055, 0.05, 0.014], side, g0, g1))
    return join(parts)


def kelp_stalk(L=24.0):
    """Giant kelp, Macrocystis: one stipe climbing to the light in a long lazy S, and dozens of long golden blades streaming up and away from it, each from a gas bladder, so a plant reads as a tall feathered column, not a stem with leaves.
    Rows along z every 2 m, so a shader can sway it. Cheap on purpose: it is instanced by the hundred."""
    rs = np.random.RandomState(19)
    rows = 13
    pts = np.array([[1.5 * math.sin(i / 12.0 * 2.6 + 0.3) * (i / 12.0), 1.0 * math.sin(i / 12.0 * 3.7 + 2.1) * (i / 12.0), L * i / 12.0 - 0.25] for i in range(rows)])
    stipe = tube(pts, np.linspace(0.1, 0.035, rows), sides=3, cap_end=True)
    stipe.C[..., :3] = mix(hexc('#4a3c17'), hexc('#7a6a24'), (stipe.corners()[..., 2] / L)[..., None])
    parts = [stipe]
    Nb = 32
    drift = unit([0.5, 0.25, 0.0])
    for i in range(Nb):
        t = (i + 1.0) / (Nb + 0.6)
        j = t * (rows - 1)
        k = int(j)
        p = pts[k] + (pts[min(k + 1, rows - 1)] - pts[k]) * (j - k)
        a = i * 2.39996 + rs.uniform(-0.3, 0.3)
        out = np.array([math.cos(a), math.sin(a), 0.0])
        side = np.array([-out[1], out[0], 0.0])
        bl = rs.uniform(3.2, 5.2) * (0.8 + 0.5 * t)
        if i % 3 == 0:
            b = sphere(p + out * 0.16, (0.09, 0.09, 0.15), seg=4, rings=2)
            b.tint(hexc('#a08a2e'))
            parts.append(b)
        stream = unit(out * rs.uniform(0.3, 0.6) + np.array([0, 0, 1.0]) + drift * 0.4)
        q0 = p + out * 0.14
        q = [q0 + stream * bl * u + out * bl * 0.2 * math.sin(u * 3.1) + side * bl * 0.14 * math.sin(u * 4.4 + i) for u in (0.0, 0.25, 0.5, 0.75, 1.0)]
        c0 = mix(hexc('#5c4e18'), OLIVE, rs.uniform(0.1, 0.7))
        c1 = mix(OLIVE, LITKELP, rs.uniform(0.2, 1.0))
        w = rs.uniform(0.13, 0.24)
        parts.append(ribbon(q, [w * 0.4, w, w * 0.92, w * 0.66, 0.02], side, c0, c1))
    return join(parts)
